import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { FOOTER_BY_V, ELEMENT_SIZE_MM } from '@/core/constants';
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

function buildPriceMap(prices: PriceRow[]): PriceMap {
  const map: PriceMap = new Map();
  for (const p of prices) {
    const key = `${p.kategorie}|${p.breite_mm ?? ''}|${p.tiefe_mm ?? ''}`;
    if (!map.has(key)) map.set(key, p);
  }
  return map;
}

function lookup(map: PriceMap, kategorie: string, breite?: number): PriceRow | undefined {
  if (breite !== undefined) {
    const key = `${kategorie}|${breite}|`;
    if (map.has(key)) return map.get(key);
  }
  const catKey = `${kategorie}||`;
  if (map.has(catKey)) return map.get(catKey);
  return undefined;
}

function unitPrice(row: PriceRow): number {
  return typeof row.pg1_eur === 'number' && row.pg1_eur > 0 ? row.pg1_eur : 0;
}

/** Einfache Preisberechnung (Lightmodul) */
function computeSimplePrice(bom: BOMResult, config: ConfigState, prices: PriceRow[]): number {
  if (prices.length === 0) return 0;
  const priceMap = buildPriceMap(prices);
  let total = 0;

  // Wuerfel
  const wRow = lookup(priceMap, 'Wuerfel');
  if (wRow) total += bom.wuerfel * unitPrice(wRow);

  // Profile
  const pRow = lookup(priceMap, 'Profil', 600);
  if (pRow) total += bom.profileTotal * unitPrice(pRow);

  // Einlegerahmen
  const rfRow = lookup(priceMap, 'Einlegerahmen', 600);
  if (rfRow) total += bom.framesStd * unitPrice(rfRow);
  const rlRow = lookup(priceMap, 'Einlegerahmen beleuchtet', 600);
  if (rlRow) total += bom.framesLit * unitPrice(rlRow);

  // Fachboeden
  const fbRow = lookup(priceMap, 'Fachboden');
  if (fbRow) total += bom.shelves * unitPrice(fbRow);

  // Stellfuesse
  if (bom.footerQty > 0) {
    const footerDef = FOOTER_BY_V[config.footer];
    if (footerDef) {
      const footerRow =
        prices.find(p => String(p.art_nr) === String(footerDef.art_nr)) ??
        prices.find(p => p.bezeichnung.toLowerCase().trim() === footerDef.l.toLowerCase().trim());
      if (footerRow) total += bom.footerQty * unitPrice(footerRow);
    }
  }

  return Math.round(total * 100) / 100;
}

/** Liefert Vorschaubilder + Zusammenfassungen fuer gespeicherte Konfigurationen. */
export async function GET(req: NextRequest) {
  const codesParam = req.nextUrl.searchParams.get('codes');
  if (!codesParam) return NextResponse.json([]);

  const codes = codesParam.split(',').map(Number).filter(n => !isNaN(n)).slice(0, 20);
  if (codes.length === 0) return NextResponse.json([]);

  // Rolle + Rabatt ermitteln
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
      const d = (config.depthLayers ?? 1) * ELEMENT_SIZE_MM + 30;
      summary = `${w}\u00d7${h}\u00d7${d} mm`;

      const bom = computeBOM(config);
      if (bom) {
        const uvp = computeSimplePrice(bom, config, priceRows);
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
