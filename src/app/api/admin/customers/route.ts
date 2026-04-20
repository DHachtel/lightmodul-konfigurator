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
  const limit = 20;
  const offset = (page - 1) * limit;
  const role = sp.get('role') ?? '';
  const search = sp.get('search') ?? '';

  const sb = createServiceSupabaseClient();

  let query = sb
    .from('profiles')
    .select(
      'id, role, company, contact_name, phone, street, zip, city, country, discount_pct, approved_at, created_at, notes',
      { count: 'exact' },
    );

  if (role) {
    query = query.eq('role', role);
  }

  if (search) {
    query = query.or(
      `company.ilike.%${search}%,contact_name.ilike.%${search}%`,
    );
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // E-Mail-Adressen aus Auth holen
  const { data: authData } = await sb.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  if (authData?.users) {
    for (const u of authData.users) {
      emailMap.set(u.id, u.email ?? '');
    }
  }

  // E-Mail-Suche clientseitig filtern (auth hat kein ILIKE)
  let profiles = (data ?? []).map(p => ({
    ...p,
    email: emailMap.get(p.id) ?? '',
  }));

  if (search) {
    const s = search.toLowerCase();
    profiles = profiles.filter(
      p => p.company?.toLowerCase().includes(s)
        || p.contact_name?.toLowerCase().includes(s)
        || p.email.toLowerCase().includes(s),
    );
  }

  return NextResponse.json({ profiles, total: count ?? 0, page, limit });
}
