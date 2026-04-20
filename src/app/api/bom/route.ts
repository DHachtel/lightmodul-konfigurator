import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceSupabaseClient } from '@/lib/supabase/server';
import { computeBOM } from '@/core/calc';
import { FOOTER_BY_V, HANDLES, MAT_BY_V } from '@/core/constants';
import { BomRequestSchema, formatZodError } from '@/core/schemas';

// ── DB-Typen ──────────────────────────────────────────────────────────────────

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

// ── Response-Typen (aus @/core/types) ────────────────────────────────────────
import type { PriceLineItem, PriceResponse } from '@/core/types';
export type { PriceLineItem, PriceResponse };

// ── Lookup-Hilfen ─────────────────────────────────────────────────────────────

/** Preisspalte aus Materialgruppe und Währung bestimmen */
function getPriceCol(pg: string, currency: 'EUR' | 'CHF'): keyof ArticlePrice {
  const n = pg === 'PG2' ? 2 : pg === 'PG3' ? 3 : pg === 'PG4' ? 4 : 1;
  return `pg${n}_${currency.toLowerCase()}` as keyof ArticlePrice;
}

/** Einheitspreis aus ArticlePrice-Zeile lesen */
function unitPrice(
  row: ArticlePrice,
  pg: string,
  currency: 'EUR' | 'CHF',
): number | null {
  const col = getPriceCol(pg, currency);
  const val = row[col];
  return typeof val === 'number' && val > 0 ? val : null;
}

/** BOM-Dimensionsschlüssel "W×H" in [breite, hoehe] zerlegen */
function parseDim(key: string): [number, number] {
  const [a, b] = key.split('×').map(Number);
  return [a ?? 0, b ?? 0];
}

type PriceMap = Map<string, ArticlePrice>;

/**
 * Lookup in Preistabelle nach Kategorie + optionaler Breite + optionaler Tiefe.
 * Gibt ersten passenden Treffer zurück.
 */
function lookup(
  map: PriceMap,
  kategorie: string,
  breite?: number,
  tiefe?: number,
): ArticlePrice | undefined {
  // Exakter Treffer (Kategorie + beide Maße)
  if (breite !== undefined && tiefe !== undefined) {
    const key = `${kategorie}|${breite}|${tiefe}`;
    if (map.has(key)) return map.get(key);
    // Fallback: vertauschte Dimensionen (Seiten: Variante liefert H×T, DB speichert T×H)
    const swapped = `${kategorie}|${tiefe}|${breite}`;
    if (map.has(swapped)) return map.get(swapped);
  }
  // Fallback: nur Kategorie + Breite (für Profile)
  if (breite !== undefined) {
    const key = `${kategorie}|${breite}|`;
    if (map.has(key)) return map.get(key);
  }
  // Fallback: nur Kategorie, keine Maße (z.B. Würfel, Griff)
  const catKey = `${kategorie}||`;
  if (map.has(catKey)) return map.get(catKey);
  return undefined;
}

/** Alle Preise in eine Lookup-Map überführen */
function buildPriceMap(prices: ArticlePrice[]): PriceMap {
  const map: PriceMap = new Map();
  for (const p of prices) {
    // Primärer Schlüssel: Kategorie + Breite + Tiefe
    const key = `${p.kategorie}|${p.breite_mm ?? ''}|${p.tiefe_mm ?? ''}`;
    if (!map.has(key)) map.set(key, p); // erster Eintrag gewinnt
  }
  return map;
}

/** Handle-Bezeichnung für Lookup normalisieren (lowercase, trim) */
function normalizeLabel(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

// ── Haupt-Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Request parsen & validieren ─────────────────────────────────────────────
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

  // ── BOM berechnen ───────────────────────────────────────────────────────────
  const bom = computeBOM(config);
  if (!bom) {
    return NextResponse.json({ error: 'Keine belegten Felder' }, { status: 400 });
  }
  const variants: { kategorie: string; dim: string; pg: string; qty: number; kabel: boolean }[] = [];

  // ── Nutzer & Rolle ermitteln ────────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Admins sehen UVP (sie konfigurieren, kaufen nicht)
  const priceType: 'UVP' | 'EK' = role === 'dealer' ? 'EK' : 'UVP';

  // ── Preistabelle laden (service role — öffentliche Daten, RLS umgehen) ──────
  const serviceClient = createServiceSupabaseClient();
  const { data: priceRows, error: priceErr } = await serviceClient
    .from('article_prices')
    .select('*');

  if (priceErr || !priceRows) {
    console.error('[/api/bom] Supabase article_prices query error:', priceErr);
    return NextResponse.json({ error: 'Preistabelle nicht erreichbar' }, { status: 503 });
  }

  const prices = priceRows as ArticlePrice[];
  const priceMap = buildPriceMap(prices);

  // ── Material → PG-Gruppe (global, für Nicht-Platten-Artikel) ─────────────────
  const matObj = MAT_BY_V[config.surface];
  const pg = matObj?.pg ?? 'PG1'; // Fallback: PG1 (MDF)

  // ── Preispositionen sammeln ─────────────────────────────────────────────────
  const items: PriceLineItem[] = [];
  const missingItems: string[] = [];

  function addItem(
    bezeichnung: string,
    kategorie: string,
    row: ArticlePrice | undefined,
    qty: number,
    useMaterialPg: boolean,
    dimKey?: string,
  ): void {
    if (qty <= 0) return;

    if (!row) {
      missingItems.push(`${bezeichnung} (${qty}×)`);
      return;
    }

    // Zubehör-Artikel haben immer PG1; Platten folgen dem Material-PG
    const effectivePg = useMaterialPg ? pg : 'PG1';

    const up = unitPrice(row, effectivePg, currency);
    if (up === null) {
      missingItems.push(`${bezeichnung} — kein Preis in ${effectivePg}/${currency}`);
      return;
    }
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

  // ── Würfel ──────────────────────────────────────────────────────────────────
  const wuerfelRow = lookup(priceMap, 'Würfel 30mm');
  addItem('Würfel 30mm', 'Würfel 30mm', wuerfelRow, bom.wuerfel, false);

  // ── Profile ─────────────────────────────────────────────────────────────────
  const allProfiles: Record<string, number> = {};
  for (const [len, qty] of Object.entries(bom.pB)) allProfiles[len] = (allProfiles[len] ?? 0) + qty;
  for (const [len, qty] of Object.entries(bom.pH)) allProfiles[len] = (allProfiles[len] ?? 0) + qty;
  for (const [len, qty] of Object.entries(bom.pT)) allProfiles[len] = (allProfiles[len] ?? 0) + qty;

  for (const [len, qty] of Object.entries(allProfiles)) {
    const row = lookup(priceMap, 'Profil', Number(len));
    addItem(`Profil 30mm ${len}mm`, 'Profil', row, qty, false, len);
  }

  // ── Platten + Fronten — per Variante (Oberfläche + Kabel) ─────────────────
  for (const v of variants) {
    const [b, t] = parseDim(v.dim);
    const row = lookup(priceMap, v.kategorie, b, t);
    if (!row) {
      if (v.qty > 0) missingItems.push(`${v.label} ${v.dim}mm (${v.qty}×)`);
      continue;
    }

    const up = unitPrice(row, v.pg, currency);
    if (up === null) {
      missingItems.push(`${v.label} ${v.dim}mm — kein Preis in ${v.pg}/${currency}`);
      continue;
    }

    const finalUp = priceType === 'EK' ? up * (1 - discountPct) : up;
    const surfaceSuffix = v.surfaceLabel !== 'Keine' ? ` · ${v.surfaceLabel}` : '';
    const cableSuffix = v.hasCable ? ' · Kabeldurchlass' : '';

    items.push({
      art_nr: row.art_nr,
      bezeichnung: `${v.label} ${v.dim}mm${surfaceSuffix}${cableSuffix}`,
      kategorie: v.kategorie,
      qty: v.qty,
      unit_price: Math.round(finalUp * 100) / 100,
      total_price: Math.round(finalUp * v.qty * 100) / 100,
      dim_key: v.dim,
      pg: v.pg,
    });
  }

  // ── Griff ────────────────────────────────────────────────────────────────────
  if (bom.frontGes > 0) {
    const handleDef = HANDLES.find(h => h.v === config.handle);
    if (handleDef) {
      const normalizedLabel = normalizeLabel(handleDef.l);
      // Griff-Artikel nach normalisierter Bezeichnung suchen
      const griffRow = prices.find(
        p => p.kategorie === 'Griff' && normalizeLabel(p.bezeichnung) === normalizedLabel,
      );
      addItem(handleDef.l, 'Griff', griffRow, bom.frontGes, false);
    }
  }

  // ── Füße / Rollen ─────────────────────────────────────────────────────────────
  if (bom.footerQty > 0) {
    const footerDef = FOOTER_BY_V[config.footer];
    if (footerDef) {
      // Primär nach art_nr suchen; Fallback nach normalisierter Bezeichnung
      // (falls art_nr in DB abweicht, z. B. Integer-Cast oder anderes Format)
      const normalizedFooterLabel = normalizeLabel(footerDef.l);
      const footerRow =
        prices.find(p => String(p.art_nr) === String(footerDef.art_nr)) ??
        prices.find(p => normalizeLabel(p.bezeichnung) === normalizedFooterLabel);
      addItem(footerDef.l, 'Füße / Rollen', footerRow, bom.footerQty, false);
    }
  }

  // ── Kabeldurchlass ──────────────────────────────────────────────────────────
  const cableQty = Object.values(config.cableHoles ?? {}).filter(Boolean).length;
  if (cableQty > 0) {
    const cableRow = prices.find(p => String(p.art_nr) === '9001');
    if (cableRow) {
      const cup = unitPrice(cableRow, 'PG1', currency);
      if (cup !== null) {
        const finalCup = priceType === 'EK' ? cup * (1 - discountPct) : cup;
        items.push({
          art_nr: '9001',
          bezeichnung: 'Kabeldurchlass ⌀80mm',
          kategorie: 'Kabeldurchlass',
          qty: cableQty,
          unit_price: Math.round(finalCup * 100) / 100,
          total_price: Math.round(finalCup * cableQty * 100) / 100,
          dim_key: '⌀80mm',
        });
      }
    }
  }

  // ── Subtotals berechnen ──────────────────────────────────────────────────────
  const subtotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const item of items) {
    subtotals[item.kategorie] = (subtotals[item.kategorie] ?? 0) + item.total_price;
    grandTotal += item.total_price;
  }

  grandTotal = Math.round(grandTotal * 100) / 100;

  // ── Antwort zusammenstellen ──────────────────────────────────────────────────
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
