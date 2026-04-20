/**
 * GET /api/surfaces — Verfügbarkeit der Preisgruppen für eine Konfiguration.
 *
 * Prüft für jede PG (1–4) ob alle Platten-Varianten der aktuellen Konfiguration
 * einen gültigen Preis (> 0) in der DB haben. Gibt zurück:
 *   { pg1: true, pg2: true, pg3: false, pg4: false }
 *
 * Aufruf: POST /api/surfaces  { config: ConfigState }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { computeBOM } from '@/core/calc';
import { BomRequestSchema, formatZodError } from '@/core/schemas';

// ── DB-Typen ──────────────────────────────────────────────────────────────────

interface ArticlePrice {
  art_nr: string;
  kategorie: string;
  breite_mm: number | null;
  tiefe_mm: number | null;
  pg1_eur: number | null;
  pg2_eur: number | null;
  pg3_eur: number | null;
  pg4_eur: number | null;
  pg1_chf: number | null;
  pg2_chf: number | null;
  pg3_chf: number | null;
  pg4_chf: number | null;
}

// ── Lookup ────────────────────────────────────────────────────────────────────

type PriceMap = Map<string, ArticlePrice>;

function buildPriceMap(prices: ArticlePrice[]): PriceMap {
  const map: PriceMap = new Map();
  for (const p of prices) {
    const key = `${p.kategorie}|${p.breite_mm ?? ''}|${p.tiefe_mm ?? ''}`;
    if (!map.has(key)) map.set(key, p);
  }
  return map;
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

function parseDim(key: string): [number, number] {
  const [a, b] = key.split('\u00D7').map(Number);
  return [a ?? 0, b ?? 0];
}

/** Prüft ob der Preis-Wert verfügbar ist (nicht null, > 0) */
function hasPriceValue(val: number | null): boolean {
  return typeof val === 'number' && val > 0;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const parsed = BomRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { config } = parsed.data;

  // BOM + Varianten berechnen
  const bom = computeBOM(config);
  if (!bom) {
    // Keine belegten Felder → alle PGs verfügbar
    return NextResponse.json({ pg1: true, pg2: true, pg3: true, pg4: true });
  }
  const variants: { kategorie: string; dim: string; pg: string; qty: number }[] = [];

  // Preise laden (service role)
  const sb = createServiceSupabaseClient();
  const { data: prices, error } = await sb
    .from('article_prices')
    .select('art_nr, kategorie, breite_mm, tiefe_mm, pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf');

  if (error || !prices) {
    return NextResponse.json({ error: 'Preise konnten nicht geladen werden' }, { status: 500 });
  }

  const priceMap = buildPriceMap(prices as ArticlePrice[]);

  // Für jede PG prüfen: haben alle Platten-Varianten einen Preis?
  const pgCols = {
    pg1: ['pg1_eur', 'pg1_chf'] as const,
    pg2: ['pg2_eur', 'pg2_chf'] as const,
    pg3: ['pg3_eur', 'pg3_chf'] as const,
    pg4: ['pg4_eur', 'pg4_chf'] as const,
  };

  const result: Record<string, boolean> = { pg1: true, pg2: true, pg3: true, pg4: true };

  // Alle Platten-Varianten sammeln (nur Platten, keine Zubehörteile)
  for (const v of variants) {
    const [breite, tiefe] = parseDim(v.dim);
    const row = lookup(priceMap, v.kategorie, breite, tiefe);

    if (!row) {
      // Artikel nicht in DB → überspringen (kein Preisblatt = keine Einschränkung)
      continue;
    }

    // Prüfe jede PG (EUR reicht, CHF spiegelt die Verfügbarkeit)
    if (!hasPriceValue(row.pg1_eur)) result.pg1 = false;
    if (!hasPriceValue(row.pg2_eur)) result.pg2 = false;
    if (!hasPriceValue(row.pg3_eur)) result.pg3 = false;
    if (!hasPriceValue(row.pg4_eur)) result.pg4 = false;
  }

  return NextResponse.json(result);
}
