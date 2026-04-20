import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin, AdminAuthError } from '@/lib/admin-auth';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Admin-Zugang erforderlich' }, { status: 401 });
    }
    throw e;
  }
  const { id } = await params;
  const code = parseInt(id, 10);
  if (isNaN(code)) return NextResponse.json({ error: 'Ungültiger Code' }, { status: 400 });

  const sb = createServiceSupabaseClient();
  const { data, error } = await sb
    .from('saved_configs')
    .select('*')
    .eq('config_code', code)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

  return NextResponse.json(data);
}
