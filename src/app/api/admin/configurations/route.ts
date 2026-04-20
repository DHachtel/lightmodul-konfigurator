import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin, AdminAuthError } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Admin-Zugang erforderlich' }, { status: 401 });
    }
    throw e;
  }
  const sp = req.nextUrl.searchParams;
  const page = parseInt(sp.get('page') ?? '1', 10);
  const search = sp.get('q') ?? '';
  const limit = 20;
  const offset = (page - 1) * limit;

  const sb = createServiceSupabaseClient();
  let query = sb.from('saved_configs')
    .select('config_code, config_json, created_at', { count: 'exact' });

  if (search) {
    query = query.eq('config_code', parseInt(search, 10) || 0);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Kurzzusammenfassung pro Konfiguration berechnen
  const configs = (data ?? []).map(row => {
    const c = row.config_json as { cols?: number[]; rows?: number[]; depth?: number; surface?: string };
    return {
      config_code: row.config_code,
      cols: c.cols?.length ?? 0,
      rows: c.rows?.length ?? 0,
      width: (c.cols ?? []).reduce((a: number, b: number) => a + b, 0) + 30,
      height: (c.rows ?? []).reduce((a: number, b: number) => a + b, 0) + 30,
      depth: (c.depth ?? 0) + 30,
      surface: c.surface ?? '—',
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ configs, total: count ?? 0, page, limit });
}
