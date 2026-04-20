import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server';
import { computeBOM } from '@/core/calc';
import { FOOTER_BY_V } from '@/core/constants';
import { BomRequestSchema, formatZodError } from '@/core/schemas';

// -- DB-Typen --

interface ArticlePrice {
  art_nr: string;
  typ: string;
  kategorie: string;
  bezeichnung: string;
  breite_mm: number | null;
  tiefe_mm: number | null;
  pg1_eur: number;
  pg2_eur: number | null;
  pg3_eur: number | null;
  pg4_eur: number | null;
  pg1_chf: number | null;
  pg2_chf: number | null;
  pg3_chf: number | null;
  pg4_chf: number | null;
}

import type { PriceLineItem, PriceResponse } from '@/core/types';
export type { PriceLineItem, PriceResponse };

// -- Lookup-Hilfen --

function getPriceCol(pg: string, currency: 'EUR' | 'CHF'): keyof ArticlePrice {
  const n = pg === 'PG2' ? 2 : pg === 'PG3' ? 3 : pg === 'PG4' ? 4 : 1;
  return `pg${n}_${currency.toLowerCase()}` as keyof ArticlePrice;
}

function unitPrice(row: ArticlePrice, pg: string, currency: 'EUR' | 'CHF'): number | null {
  const col = getPriceCol(pg, currency);
  const val = row[col];
  return typeof val === 'number' && val > 0 ? val : null;
}

type PriceMap = Map<string, ArticlePrice>;

function lookup(map: PriceMap, kategorie: string, breite?: number): ArticlePrice | undefined {
  if (breite !== undefined) {
    const key = `${kategorie}|${breite}|`;
    if (map.has(key)) return map.get(key);
  }
  const catKey = `${kategorie}||`;
  if (map.has(catKey)) return map.get(catKey);
  return undefined;
}

function buildPriceMap(prices: ArticlePrice[]): PriceMap {
  const map: PriceMap = new Map();
  for (const p of prices) {
    const key = `${p.kategorie}|${p.breite_mm ?? ''}|${p.tiefe_mm ?? ''}`;
    if (!map.has(key)) map.set(key, p);
  }
  return map;
}

function normalizeLabel(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

// -- Haupt-Handler --

export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = BomRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { config, currency: currencyRaw } = parsed.data;
  const currency: 'EUR' | 'CHF' = currencyRaw ?? 'EUR';

  const bom = computeBOM(config);
  if (!bom) {
    return NextResponse.json({ error: 'Keine belegten Felder' }, { status: 400 });
  }

  // -- Nutzer & Rolle --
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: string = 'customer';
  let discountPct: number = 0;

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, discount_pct')
      .eq('id', user.id)
      .single();
    if (profile) {
      role = profile.role as string;
      discountPct = (profile.discount_pct as number | null) ?? 0;
    }
  }

  const priceType: 'UVP' | 'EK' = role === 'dealer' ? 'EK' : 'UVP';

  // -- Preistabelle laden --
  const serviceClient = createServiceSupabaseClient();
  const { data: priceRows, error: priceErr } = await serviceClient
    .from('article_prices')
    .select('*');

  if (priceErr || !priceRows) {
    return NextResponse.json({ error: 'Preistabelle nicht erreichbar' }, { status: 503 });
  }

  const prices = priceRows as ArticlePrice[];
  const priceMap = buildPriceMap(prices);
  const pg = 'PG1'; // Lightmodul hat immer PG1

  const items: PriceLineItem[] = [];
  const missingItems: string[] = [];

  function addItem(
    bezeichnung: string,
    kategorie: string,
    row: ArticlePrice | undefined,
    qty: number,
    dimKey?: string,
  ): void {
    if (qty <= 0) return;
    if (!row) { missingItems.push(`${bezeichnung} (${qty}x)`); return; }
    const up = unitPrice(row, pg, currency);
    if (up === null) { missingItems.push(`${bezeichnung} -- kein Preis in ${pg}/${currency}`); return; }
    const finalUp = priceType === 'EK' ? up * (1 - discountPct) : up;
    items.push({
      art_nr: row.art_nr,
      bezeichnung: row.bezeichnung,
      kategorie,
      qty,
      unit_price: Math.round(finalUp * 100) / 100,
      total_price: Math.round(finalUp * qty * 100) / 100,
      dim_key: dimKey,
    });
  }

  // -- Wuerfel --
  addItem('Wuerfel 27mm', 'Wuerfel', lookup(priceMap, 'Wuerfel'), bom.wuerfel);

  // -- Profile (alle 600mm) --
  addItem('Profil 25mm 600mm', 'Profil', lookup(priceMap, 'Profil', 600), bom.profileTotal, '600');

  // -- Einlegerahmen --
  addItem('Einlegerahmen Standard', 'Einlegerahmen', lookup(priceMap, 'Einlegerahmen', 600), bom.framesStd, 'RF');
  addItem('Einlegerahmen beleuchtet', 'Einlegerahmen', lookup(priceMap, 'Einlegerahmen beleuchtet', 600), bom.framesLit, 'RL');

  // -- Fachboeden --
  addItem('Fachboden', 'Fachboden', lookup(priceMap, 'Fachboden'), bom.shelves);

  // -- Stellfuesse --
  if (bom.footerQty > 0) {
    const footerDef = FOOTER_BY_V[config.footer];
    if (footerDef) {
      const normalizedFooterLabel = normalizeLabel(footerDef.l);
      const footerRow =
        prices.find(p => String(p.art_nr) === String(footerDef.art_nr)) ??
        prices.find(p => normalizeLabel(p.bezeichnung) === normalizedFooterLabel);
      addItem(footerDef.l, 'Stellfuesse', footerRow, bom.footerQty);
    }
  }

  // -- Subtotals --
  const subtotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const item of items) {
    subtotals[item.kategorie] = (subtotals[item.kategorie] ?? 0) + item.total_price;
    grandTotal += item.total_price;
  }
  grandTotal = Math.round(grandTotal * 100) / 100;

  const response: PriceResponse = {
    items,
    subtotals,
    grand_total: grandTotal,
    currency,
    price_type: priceType,
    missing_items: missingItems,
    ...(priceType === 'EK' ? { active_discount_pct: discountPct } : {}),
  };

  return NextResponse.json(response);
}
