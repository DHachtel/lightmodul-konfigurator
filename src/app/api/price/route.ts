// @ts-nocheck — Artmodul-Legacydatei, wird in Phase 1 auf Lightmodul umgebaut
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

// ── Response-Typen (aus @/core/pricing) ──────────────────────────────────────
import type { PriceLineItem, PriceResponse } from '@/core/pricing';
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
    console.error('[/api/price] Supabase article_prices query error:', priceErr);
    return NextResponse.json({ error: 'Preistabelle nicht erreichbar' }, { status: 503 });
  }

  const prices = priceRows as ArticlePrice[];
  const priceMap = buildPriceMap(prices);

  // ── Material → PG-Gruppe (global) ──────────────────────────────────────────
  const matObj = MAT_BY_V[config.surface];
  const pg = matObj?.pg ?? 'PG1'; // Fallback: PG1 (MDF)
  const { bomOverrides } = config;

  /** Preisgruppe für eine einzelne Override-Instanz bestimmen.
   *  Vorrang: bomOverrides[key].material → globales pg */
  function instancePg(key: string): string {
    const ov = bomOverrides[key];
    if (!ov) return pg;
    return MAT_BY_V[ov.material]?.pg ?? pg;
  }

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
    overridePrefix?: string,
  ): void {
    if (qty <= 0) return;

    if (!row) {
      missingItems.push(`${bezeichnung} (${qty}×)`);
      return;
    }

    // Zubehör-Artikel haben immer PG1; Platten folgen dem Material-PG
    const effectivePg = useMaterialPg ? pg : 'PG1';

    if (useMaterialPg && overridePrefix) {
      // Per-Instanz-Preisberechnung unter Berücksichtigung von bomOverrides
      let totalPrice = 0;
      for (let i = 0; i < qty; i++) {
        const ipg = instancePg(`${overridePrefix}_${i}`);
        const up = unitPrice(row, ipg, currency);
        if (up === null) {
          missingItems.push(`${bezeichnung} — kein Preis in ${ipg}/${currency}`);
          return;
        }
        const finalUp = priceType === 'EK' ? up * (1 - discountPct) : up;
        totalPrice += finalUp;
      }
      // unit_price: globaler PG für Anzeige; Fallback Durchschnitt
      const globalUp = unitPrice(row, effectivePg, currency);
      const displayUp = globalUp !== null
        ? (priceType === 'EK' ? globalUp * (1 - discountPct) : globalUp)
        : totalPrice / qty;

      items.push({
        art_nr: row.art_nr,
        bezeichnung: row.bezeichnung,
        // Übergebene Kategorie verwenden (nicht row.kategorie), damit BOMPanel-Lookup
        // unabhängig von der DB-Schreibweise immer den richtigen Key findet
        kategorie,
        qty,
        unit_price: Math.round(displayUp * 100) / 100,
        total_price: Math.round(totalPrice * 100) / 100,
        dim_key: dimKey,
      });
    } else {
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

  // ── Böden Standard ──────────────────────────────────────────────────────────
  for (const [dim, qty] of Object.entries(bom.bStd)) {
    if (qty <= 0) continue;
    const [b, t] = parseDim(dim);
    const row = lookup(priceMap, 'Boden', b, t);
    addItem(`Boden ${dim}mm`, 'Boden', row, qty, true, dim, `boden_${dim}`);
  }

  // ── Klappenböden ────────────────────────────────────────────────────────────
  for (const [dim, qty] of Object.entries(bom.bKl)) {
    if (qty <= 0) continue;
    const [b, t] = parseDim(dim);
    const row = lookup(priceMap, 'Klappenboden', b, t);
    addItem(`Klappenboden ${dim}mm`, 'Klappenboden', row, qty, true, dim, `klappenboden_${dim}`);
  }

  // ── Rücken ──────────────────────────────────────────────────────────────────
  for (const [dim, qty] of Object.entries(bom.rMap)) {
    if (qty <= 0) continue;
    const [b, t] = parseDim(dim);
    const row = lookup(priceMap, 'Rücken', b, t);
    addItem(`Rücken ${dim}mm`, 'Rücken', row, qty, true, dim, `ruecken_${dim}`);
  }

  // ── Seiten außen ────────────────────────────────────────────────────────────
  for (const [dim, qty] of Object.entries(bom.sAMap)) {
    if (qty <= 0) continue;
    const [h, d] = parseDim(dim);
    const row = lookup(priceMap, 'Seite außen', h, d);
    addItem(`Seite außen ${dim}mm`, 'Seite außen', row, qty, true, dim, `seite_aussen_${dim}`);
  }
  for (const [dim, qty] of Object.entries(bom.sAMapSY32)) {
    if (qty <= 0) continue;
    const [h, d] = parseDim(dim);
    const row = lookup(priceMap, 'Seite außen SY32', h, d);
    addItem(`Seite außen SY32 ${dim}mm`, 'Seite außen SY32', row, qty, true, dim, `seite_aussen_sy32_${dim}`);
  }

  // ── Seiten innen ────────────────────────────────────────────────────────────
  for (const [dim, qty] of Object.entries(bom.sIMap)) {
    if (qty <= 0) continue;
    const [h, d] = parseDim(dim);
    const row = lookup(priceMap, 'Seite innen', h, d);
    addItem(`Seite innen ${dim}mm`, 'Seite innen', row, qty, true, dim, `seite_innen_${dim}`);
  }
  for (const [dim, qty] of Object.entries(bom.sIMapSY32)) {
    if (qty <= 0) continue;
    const [h, d] = parseDim(dim);
    const row = lookup(priceMap, 'Seite innen SY32', h, d);
    addItem(`Seite innen SY32 ${dim}mm`, 'Seite innen SY32', row, qty, true, dim, `seite_innen_sy32_${dim}`);
  }

  // ── Fachböden (Fachboden klein als Standard) ─────────────────────────────────
  for (const [dim, qty] of Object.entries(bom.fbMap)) {
    if (qty <= 0) continue;
    const [b, t] = parseDim(dim);
    const row = lookup(priceMap, 'Fachboden klein', b, t);
    addItem(`Fachboden ${dim}mm`, 'Fachboden klein', row, qty, true, dim, `fachboden_${dim}`);
  }

  // ── Fronten ─────────────────────────────────────────────────────────────────
  const frontKatMap: Record<string, string> = {
    K:  'Klappe',
    S:  'Schublade',
    TR: 'Tür',
    TL: 'Tür',
    DT: 'Doppeltür',
  };

  for (const [typ, dimMap] of Object.entries(bom.fMap)) {
    const kat = frontKatMap[typ];
    if (!kat) continue;
    for (const [dim, qty] of Object.entries(dimMap)) {
      if (qty <= 0) continue;
      const [b, h] = parseDim(dim);
      const row = lookup(priceMap, kat, b, h);
      addItem(`${kat} ${dim}mm`, kat, row, qty, true, dim, `front_${typ}_${dim}`);
    }
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
