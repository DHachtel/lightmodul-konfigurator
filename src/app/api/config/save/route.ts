import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { ConfigSaveSchema, formatZodError } from '@/core/schemas';

function generate8DigitCode(): number {
  return Math.floor(10000000 + Math.random() * 90000000);
}

export async function POST(req: NextRequest) {
  // ── Request parsen & validieren ─────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = ConfigSaveSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const { config, screenshot, bom } = parsed.data;

  try {

    const supabase = createServiceSupabaseClient();

    // Bis zu 3 Versuche bei Kollision
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generate8DigitCode();
      const { error } = await supabase.from('saved_configs').insert({
        config_code: code,
        config_json: config,
        screenshot: screenshot ?? null,
        bom_json: bom ?? null,
      });

      if (!error) {
        return NextResponse.json({ code });
      }

      // 23505 = unique_violation — erneut versuchen
      if (error.code !== '23505') {
        console.error('[/api/config/save] DB-Fehler:', error?.code, error?.message);
        return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'ID-Kollision — bitte erneut versuchen' }, { status: 500 });
  } catch (e) {
    console.error('[/api/config/save] Unerwarteter Fehler:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
