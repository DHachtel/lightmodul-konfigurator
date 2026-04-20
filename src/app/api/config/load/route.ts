import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const codeStr = req.nextUrl.searchParams.get('code');

  if (!codeStr || !/^\d{8}$/.test(codeStr)) {
    return NextResponse.json({ error: 'Ungültiger Code (8-stellige Zahl erwartet)' }, { status: 400 });
  }

  const code = parseInt(codeStr, 10);
  const supabase = createServiceSupabaseClient();

  const { data, error } = await supabase
    .from('saved_configs')
    .select('config_json')
    .eq('config_code', code)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Konfiguration nicht gefunden' }, { status: 404 });
  }

  return NextResponse.json({ config: data.config_json });
}
