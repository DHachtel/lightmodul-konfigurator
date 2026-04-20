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
  const status = sp.get('status');
  const page = parseInt(sp.get('page') ?? '1', 10);
  const limit = 20;
  const offset = (page - 1) * limit;

  const sb = createServiceSupabaseClient();
  let query = sb.from('orders').select('*, order_items(id, config_code, quantity, unit_price, currency)', { count: 'exact' });

  if (status) query = query.eq('status', status);

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data ?? [], total: count ?? 0, page, limit });
}
