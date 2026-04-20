import { NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin, AdminAuthError } from '@/lib/admin-auth';

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Admin-Zugang erforderlich' }, { status: 401 });
    }
    throw e;
  }
  const sb = createServiceSupabaseClient();

  const [ordersTotal, ordersOpen, configsWeek, configsMonth, revenue] = await Promise.all([
    sb.from('orders').select('id', { count: 'exact', head: true }),
    sb.from('orders').select('id', { count: 'exact', head: true })
      .in('status', ['draft', 'submitted']),
    sb.from('saved_configs').select('config_code', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    sb.from('saved_configs').select('config_code', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
    sb.from('order_items').select('unit_price, quantity')
      .not('unit_price', 'is', null),
  ]);

  let totalRevenue = 0;
  if (revenue.data) {
    for (const item of revenue.data) {
      totalRevenue += (item.unit_price ?? 0) * (item.quantity ?? 1);
    }
  }

  return NextResponse.json({
    ordersTotal: ordersTotal.count ?? 0,
    ordersOpen: ordersOpen.count ?? 0,
    configsWeek: configsWeek.count ?? 0,
    configsMonth: configsMonth.count ?? 0,
    totalRevenue,
  });
}
