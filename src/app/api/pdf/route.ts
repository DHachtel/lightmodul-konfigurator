import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { computeBOM } from '@/core/calc';
import { OfferDocument } from '@/features/pdf/OfferDocument';
import type { ConfigState, PriceResponse } from '@/core/types';

// Nicht Edge-Runtime: @react-pdf/renderer benötigt Node.js-Umgebung
export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth: nur dealer / admin ─────────────────────────────────────────────
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['dealer', 'admin'].includes(profile.role as string)) {
    return NextResponse.json({ error: 'Keine Berechtigung (nur Händler/Admin)' }, { status: 403 });
  }

  // ── Request parsen ────────────────────────────────────────────────────────
  let body: { config?: ConfigState; pricing?: PriceResponse };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body' }, { status: 400 });
  }

  const { config, pricing } = body;
  if (!config || !pricing) {
    return NextResponse.json({ error: 'config und pricing erforderlich' }, { status: 400 });
  }

  // ── BOM berechnen (für Grid-Vorschau im PDF) ──────────────────────────────
  const bom = computeBOM(config);
  if (!bom) {
    return NextResponse.json({ error: 'Keine aktiven Felder in der Konfiguration' }, { status: 400 });
  }

  // ── PDF rendern ───────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(OfferDocument, { config, pricing, bom }) as any;
  const buffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);

  const ts = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
  const filename = `Lightmodul_Angebot_${ts}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
