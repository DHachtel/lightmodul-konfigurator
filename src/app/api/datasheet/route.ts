import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { computeBOM } from '@/core/calc';
import { DatasheetDocument } from '@/features/pdf/DatasheetDocument';
import { DatasheetRequestSchema, formatZodError } from '@/core/schemas';

export const runtime = 'nodejs';

// ── POST /api/datasheet ────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Request parsen & validieren ─────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = DatasheetRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { config, screenshot3d, moebelId, currency: currencyRaw } = parsed.data;
  const currency: 'EUR' | 'CHF' = currencyRaw ?? 'EUR';
  const grandTotal = 0;

  // ── BOM berechnen ───────────────────────────────────────────────────────────
  const bom = computeBOM(config);
  if (!bom) {
    return NextResponse.json({ error: 'Keine aktiven Felder in der Konfiguration' }, { status: 400 });
  }

  // ── PDF rendern ─────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(DatasheetDocument, {
    config,
    bom,
    grandTotal,
    currency,
    screenshot3d: screenshot3d ?? null,
    moebelId: moebelId ?? null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
  } catch (err) {
    console.error('[/api/datasheet] renderToBuffer Fehler:', err);
    return NextResponse.json(
      { error: 'PDF-Generierung fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 },
    );
  }

  const ts = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
  const filename = `Artmodul_Datenblatt_${ts}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
