// @ts-nocheck — Artmodul-Legacydatei, wird in Phase 1 auf Lightmodul umgebaut
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { MAT_BY_V, HANDLES, FOOTER_BY_V } from '@/core/constants';
import { computeBOM } from '@/core/calc';
import type { ConfigState, BOMResult } from '@/core/types';

interface PriceRow {
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
}

type PriceMap = Map<string, PriceRow>;

/** Alle Preise in eine Lookup-Map überführen (Kategorie + Breite + Tiefe) */
function buildPriceMap(prices: PriceRow[]): PriceMap {
  const map: PriceMap = new Map();
  for (const p of prices) {
    const key = `${p.kategorie}|${p.breite_mm ?? ''}|${p.tiefe_mm ?? ''}`;
    if (!map.has(key)) map.set(key, p);
  }
  return map;
}

/** Lookup in Preistabelle nach Kategorie + optionaler Breite + optionaler Tiefe */
function lookup(map: PriceMap, kategorie: string, breite?: number, tiefe?: number): PriceRow | undefined {
  if (breite !== undefined && tiefe !== undefined) {
    const key = `${kategorie}|${breite}|${tiefe}`;
    if (map.has(key)) return map.get(key);
  }
  if (breite !== undefined) {
    const key = `${kategorie}|${breite}|`;
    if (map.has(key)) return map.get(key);
  }
  const catKey = `${kategorie}||`;
  if (map.has(catKey)) return map.get(catKey);
  return undefined;
}

/** Einheitspreis aus PriceRow lesen (EUR, UVP) */
function unitPrice(row: PriceRow, pg: string): number {
  const n = pg === 'PG2' ? 2 : pg === 'PG3' ? 3 : pg === 'PG4' ? 4 : 1;
  const col = `pg${n}_eur` as keyof PriceRow;
  const v = row[col];
  return typeof v === 'number' && v > 0 ? v : (typeof row.pg1_eur === 'number' ? row.pg1_eur : 0);
}

/** Einfache Preisberechnung aus BOM + Preistabelle (Netto, EUR, UVP) */
function computeSimplePrice(bom: BOMResult, config: ConfigState, prices: PriceRow[]): number {
  if (prices.length === 0) return 0;

  const priceMap = buildPriceMap(prices);
  const matObj = MAT_BY_V[config.surface ?? ''];
  const pg = matObj?.pg ?? 'PG1';
  let total = 0;

  // Würfel
  const wRow = lookup(priceMap, 'Würfel 30mm');
  if (wRow) total += bom.wuerfel * unitPrice(wRow, 'PG1');

  // Profile (zusammengefasst aus pB, pH, pT)
  const allProfiles: Record<string, number> = {};
  for (const [len, qty] of Object.entries(bom.pB)) allProfiles[len] = (allProfiles[len] ?? 0) + qty;
  for (const [len, qty] of Object.entries(bom.pH)) allProfiles[len] = (allProfiles[len] ?? 0) + qty;
  for (const [len, qty] of Object.entries(bom.pT)) allProfiles[len] = (allProfiles[len] ?? 0) + qty;

  for (const [len, qty] of Object.entries(allProfiles)) {
    const row = lookup(priceMap, 'Profil', Number(len));
    if (row) total += qty * unitPrice(row, 'PG1');
  }

  // Platten + Fronten — per Variante (Lightmodul: keine Board-Varianten)
  const variants: { kategorie: string; dim: string; pg: string; qty: number; kabel: boolean }[] = [];
  for (const v of variants) {
    if (v.qty <= 0) continue;
    const [b, t] = v.dim.split('×').map(Number);
    const row = lookup(priceMap, v.kategorie, b, t);
    if (row) total += v.qty * unitPrice(row, v.pg);
  }

  // Griff
  if (bom.frontGes > 0) {
    const handleDef = HANDLES.find(h => h.v === config.handle);
    if (handleDef) {
      const griffRow = prices.find(
        p => p.kategorie === 'Griff' && p.bezeichnung.toLowerCase().trim() === handleDef.l.toLowerCase().trim(),
      );
      if (griffRow) total += bom.frontGes * unitPrice(griffRow, 'PG1');
    }
  }

  // Füße / Rollen
  if (bom.footerQty > 0) {
    const footerDef = FOOTER_BY_V[config.footer];
    if (footerDef) {
      const footerRow =
        prices.find(p => String(p.art_nr) === String(footerDef.art_nr)) ??
        prices.find(p => p.bezeichnung.toLowerCase().trim() === footerDef.l.toLowerCase().trim());
      if (footerRow) total += bom.footerQty * unitPrice(footerRow, 'PG1');
    }
  }

  // Kabeldurchlass
  const cableQty = Object.values(config.cableHoles ?? {}).filter(Boolean).length;
  if (cableQty > 0) {
    const cableRow = prices.find(p => String(p.art_nr) === '9001');
    if (cableRow) total += cableQty * unitPrice(cableRow, 'PG1');
  }

  return Math.round(total * 100) / 100;
}

/** Liefert Vorschaubilder + Zusammenfassungen für gespeicherte Konfigurationen.
 *  Preise immer enthalten: dealer → EK (mit Rabatt), alle anderen → UVP. */
export async function GET(req: NextRequest) {
  const codesParam = req.nextUrl.searchParams.get('codes');
  if (!codesParam) return NextResponse.json([]);

  const codes = codesParam.split(',').map(Number).filter(n => !isNaN(n)).slice(0, 20);
  if (codes.length === 0) return NextResponse.json([]);

  // Rolle + Rabatt ermitteln — dealer bekommt EK, alle anderen UVP
  const { createServerSupabaseClient } = await import('@/lib/supabase/server');
  const authSb = await createServerSupabaseClient();
  const { data: { user } } = await authSb.auth.getUser();
  let discountPct = 0;
  if (user) {
    const { data: profile } = await authSb.from('profiles').select('role, discount_pct').eq('id', user.id).single();
    if (profile?.role === 'dealer') {
      discountPct = typeof profile.discount_pct === 'number' ? profile.discount_pct : 0;
    }
  }

  const sb = createServiceSupabaseClient();

  // Konfigurationen + Preistabelle immer parallel laden
  const configPromise = sb.from('saved_configs').select('config_code, screenshot, config_json').in('config_code', codes);
  const pricePromise = sb.from('article_prices').select('art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm, pg1_eur, pg2_eur, pg3_eur, pg4_eur');

  const [configRes, priceRes] = await Promise.all([configPromise, pricePromise]);

  const rows = configRes.data ?? [];
  const priceRows = (priceRes.data ?? []) as PriceRow[];

  const results = rows.map(row => {
    const config = row.config_json as ConfigState;
    let summary = '';
    let netPrice = 0;

    if (config?.cols && config?.rows) {
      const w = config.cols.reduce((a: number, b: number) => a + b, 0) + 30;
      const h = config.rows.reduce((a: number, b: number) => a + b, 0) + 30;
      const d = (config.depth ?? 360) + 30;
      const mat = MAT_BY_V[config.surface ?? ''];
      summary = `${w}\u00d7${h}\u00d7${d} mm` + (mat ? ` \u00b7 ${mat.l}` : '');

      const bom = computeBOM(config);
      if (bom) {
        const uvp = computeSimplePrice(bom, config, priceRows);
        // Dealer → EK (UVP abzüglich Rabatt), alle anderen → UVP
        netPrice = discountPct > 0 ? Math.round(uvp * (1 - discountPct / 100) * 100) / 100 : uvp;
      }
    }

    return {
      code: row.config_code as number,
      screenshot: row.screenshot as string | null,
      summary,
      netPrice,
    };
  });

  return NextResponse.json(results);
}
