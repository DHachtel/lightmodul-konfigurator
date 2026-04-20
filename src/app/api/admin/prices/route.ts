import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin, AdminAuthError } from '@/lib/admin-auth';

const PAGE_SIZE = 30;

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
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const q = sp.get('q')?.trim() ?? '';
  const offset = (page - 1) * PAGE_SIZE;

  const sb = createServiceSupabaseClient();
  let query = sb
    .from('article_prices')
    .select(
      'art_nr, bezeichnung, pg1_mdf_eur, pg1_mdf_chf, pg2_eur, pg2_chf, pg3_eur, pg3_chf, pg4_eur, pg4_chf',
      { count: 'exact' }
    );

  if (q) {
    query = query.or(`art_nr.ilike.%${q}%,bezeichnung.ilike.%${q}%`);
  }

  const { data, count, error } = await query
    .order('art_nr', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ prices: data ?? [], total: count ?? 0, page, limit: PAGE_SIZE });
}
