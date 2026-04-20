import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin, AdminAuthError } from '@/lib/admin-auth';

const PAGE_SIZE = 30;
const SELECT_COLS = 'art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm';

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
    .select(SELECT_COLS, { count: 'exact' });

  if (q) {
    query = query.or(`art_nr.ilike.%${q}%,bezeichnung.ilike.%${q}%,kategorie.ilike.%${q}%`);
  }

  const { data, count, error } = await query
    .order('art_nr', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ articles: data ?? [], total: count ?? 0, page, limit: PAGE_SIZE });
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Admin-Zugang erforderlich' }, { status: 401 });
    }
    throw e;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = await req.json();

  if (!body.art_nr) {
    return NextResponse.json({ error: 'art_nr ist erforderlich' }, { status: 400 });
  }

  const sb = createServiceSupabaseClient();
  const { data, error } = await sb
    .from('article_prices')
    .insert({
      art_nr: body.art_nr,
      typ: body.typ ?? null,
      kategorie: body.kategorie ?? null,
      bezeichnung: body.bezeichnung ?? null,
      breite_mm: body.breite_mm ? Number(body.breite_mm) : null,
      tiefe_mm: body.tiefe_mm ? Number(body.tiefe_mm) : null,
    })
    .select(SELECT_COLS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ article: data }, { status: 201 });
}
