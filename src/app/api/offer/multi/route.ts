import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { computeBOM } from '@/core/calc';
import { computeBoardVariants } from '@/core/variants';
import { MultiOfferDocument } from '@/features/pdf/MultiOfferDocument';
import type { OfferItem } from '@/features/pdf/MultiOfferDocument';
import type { ConfigState } from '@/core/types';
import { FOOTER_BY_V, HANDLES, MAT_BY_V } from '@/core/constants';
import React from 'react';
import QRCode from 'qrcode';
import { MultiOfferRequestSchema, formatZodError } from '@/core/schemas';

export const runtime = 'nodejs';

// ── Preis-Hilfstypen (analog /api/bom) ──────────────────────────────────────

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

type PriceMap = Map<string, ArticlePrice>;

function getPriceCol(pg: string, currency: 'EUR' | 'CHF'): keyof ArticlePrice {
  const n = pg === 'PG2' ? 2 : pg === 'PG3' ? 3 : pg === 'PG4' ? 4 : 1;
  return `pg${n}_${currency.toLowerCase()}` as keyof ArticlePrice;
}

function unitPrice(row: ArticlePrice, pg: string, currency: 'EUR' | 'CHF'): number | null {
  const col = getPriceCol(pg, currency);
  const val = row[col];
  return typeof val === 'number' && val > 0 ? val : null;
}

function parseDim(key: string): [number, number] {
  const [a, b] = key.split('\u00D7').map(Number);
  return [a ?? 0, b ?? 0];
}

function lookup(
  map: PriceMap,
  kategorie: string,
  breite?: number,
  tiefe?: number,
): ArticlePrice | undefined {
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

/** Gesamtpreis (Netto UVP) für eine Konfiguration berechnen */
function computeNetPrice(
  config: ConfigState,
  bom: ReturnType<typeof computeBOM>,
  prices: ArticlePrice[],
  priceMap: PriceMap,
  currency: 'EUR' | 'CHF',
): number {
  if (!bom) return 0;

  const matObj = MAT_BY_V[config.surface];
  const pg = matObj?.pg ?? 'PG1';
  let total = 0;

  // Hilfsfunktion: Preis addieren
  const add = (
    row: ArticlePrice | undefined,
    qty: number,
    useMaterialPg: boolean,
  ): void => {
    if (qty <= 0 || !row) return;
    const effectivePg = useMaterialPg ? pg : 'PG1';
    const up = unitPrice(row, effectivePg, currency);
    if (up !== null) total += up * qty;
  };

  // Würfel
  add(lookup(priceMap, 'Würfel 30mm'), bom.wuerfel, false);

  // Profile
  const allProfiles: Record<string, number> = {};
  for (const [len, qty] of Object.entries(bom.pB)) allProfiles[len] = (allProfiles[len] ?? 0) + qty;
  for (const [len, qty] of Object.entries(bom.pH)) allProfiles[len] = (allProfiles[len] ?? 0) + qty;
  for (const [len, qty] of Object.entries(bom.pT)) allProfiles[len] = (allProfiles[len] ?? 0) + qty;
  for (const [len, qty] of Object.entries(allProfiles)) {
    add(lookup(priceMap, 'Profil', Number(len)), qty, false);
  }

  // Platten + Fronten — per Variante
  const variants = computeBoardVariants(config);
  for (const v of variants) {
    const [b, t] = parseDim(v.dim);
    const row = lookup(priceMap, v.kategorie, b, t);
    if (!row || v.qty <= 0) continue;
    const up = unitPrice(row, v.pg, currency);
    if (up !== null) total += up * v.qty;
  }

  // Griff
  if (bom.frontGes > 0) {
    const handleDef = HANDLES.find(h => h.v === config.handle);
    if (handleDef) {
      const nl = normalizeLabel(handleDef.l);
      const griffRow = prices.find(
        p => p.kategorie === 'Griff' && normalizeLabel(p.bezeichnung) === nl,
      );
      add(griffRow, bom.frontGes, false);
    }
  }

  // Füße / Rollen
  if (bom.footerQty > 0) {
    const footerDef = FOOTER_BY_V[config.footer];
    if (footerDef) {
      const nl = normalizeLabel(footerDef.l);
      const footerRow =
        prices.find(p => String(p.art_nr) === String(footerDef.art_nr)) ??
        prices.find(p => normalizeLabel(p.bezeichnung) === nl);
      add(footerRow, bom.footerQty, false);
    }
  }

  // Kabeldurchlass
  const cableQty = Object.values(config.cableHoles ?? {}).filter(Boolean).length;
  if (cableQty > 0) {
    const cableRow = prices.find(p => String(p.art_nr) === '9001');
    add(cableRow, cableQty, false);
  }

  return Math.round(total * 100) / 100;
}

// ── Haupt-Handler ───────────────────────────────────────────────────────────

function generate8DigitCode(): number {
  return Math.floor(10000000 + Math.random() * 90000000);
}

export async function POST(req: NextRequest) {
  // ── Auth: Rolle erkennen (optional) — Dealer → EK, alle anderen → UVP ──
  const { createServerSupabaseClient } = await import('@/lib/supabase/server');
  const authSb = await createServerSupabaseClient();
  const { data: { user } } = await authSb.auth.getUser();

  let priceType: 'EK' | 'UVP' = 'UVP';
  let discountPct = 0;

  if (user) {
    const { data: profile } = await authSb
      .from('profiles')
      .select('role, discount_pct')
      .eq('id', user.id)
      .single();

    if (profile?.role === 'dealer') {
      priceType = 'EK';
      discountPct = typeof profile.discount_pct === 'number' ? profile.discount_pct : 0;
    }
  }

  // ── Request parsen & validieren ─────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = MultiOfferRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { configCodes: codes, currency: currencyRaw } = parsed.data;
  const cur: 'EUR' | 'CHF' = currencyRaw ?? 'EUR';

  try {
    const supabase = createServiceSupabaseClient();

    // Alle Configs laden
    const { data: rows, error } = await supabase
      .from('saved_configs')
      .select('config_code, config_json, screenshot')
      .in('config_code', codes);

    if (error || !rows) {
      return NextResponse.json({ error: 'Laden fehlgeschlagen' }, { status: 500 });
    }

    if (rows.length !== codes.length) {
      const found = new Set(rows.map(r => r.config_code));
      const missing = codes.filter((c: number) => !found.has(c));
      return NextResponse.json({ error: `Nicht gefunden: ${missing.join(', ')}` }, { status: 404 });
    }

    // Preistabelle einmalig laden
    const { data: priceRows, error: priceErr } = await supabase
      .from('article_prices')
      .select('*');

    const hasPrices = !priceErr && priceRows && priceRows.length > 0;
    const prices = (hasPrices ? priceRows : []) as ArticlePrice[];
    const priceMap = buildPriceMap(prices);
    const showPrices = hasPrices;

    // BOM + Preis + AR-QR pro Config berechnen
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const items: OfferItem[] = await Promise.all(codes.map(async (code: number) => {
      const row = rows.find(r => r.config_code === code)!;
      const config = row.config_json as ConfigState;
      const bom = computeBOM(config);
      const uvp = hasPrices
        ? computeNetPrice(config, bom, prices, priceMap, cur)
        : 0;
      // Dealer → EK mit Rabatt, alle anderen → UVP
      const netPrice = priceType === 'EK'
        ? Math.round(uvp * (1 - discountPct / 100) * 100) / 100
        : uvp;

      // AR QR-Code als Data-URL generieren
      let arQrDataUrl: string | undefined;
      try {
        arQrDataUrl = await QRCode.toDataURL(`${appUrl}/ar?config=${code}`, {
          width: 200, margin: 1,
          color: { dark: '#1C1A17', light: '#FFFFFF' },
        });
      } catch { /* QR-Fehler ignorieren */ }

      return {
        configCode: code,
        config,
        bom: bom!,
        screenshot: row.screenshot ?? null,
        netPrice,
        arQrDataUrl,
      };
    }));

    // Angebots-ID generieren und speichern
    let offerCode = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      offerCode = generate8DigitCode();
      const { error: insertErr } = await supabase.from('offers').insert({
        offer_code: offerCode,
        config_codes: codes,
      });
      if (!insertErr) break;
      if (insertErr.code !== '23505') {
        console.error('[/api/offer/multi] DB-Fehler (offer insert):', insertErr?.code, insertErr?.message);
        return NextResponse.json({ error: 'Angebot speichern fehlgeschlagen' }, { status: 500 });
      }
      if (attempt === 2) {
        return NextResponse.json({ error: 'ID-Kollision' }, { status: 500 });
      }
    }

    // PDF rendern
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const element = React.createElement(MultiOfferDocument, { items, offerCode, currency: cur, showPrices }) as any;
    const buffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);

    const ts = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Artmodul_Angebot_${offerCode}_${ts}.pdf"`,
        'X-Offer-Code': String(offerCode),
      },
    });
  } catch (e) {
    console.error('[/api/offer/multi] Unerwarteter Fehler:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
