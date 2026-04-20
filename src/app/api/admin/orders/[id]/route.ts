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
  const sb = createServiceSupabaseClient();

  const { data, error } = await sb
    .from('orders')
    .select('*, order_items(id, config_code, quantity, unit_price, currency)')
    .eq('id', id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Admin-Zugang erforderlich' }, { status: 401 });
    }
    throw e;
  }
  const { id } = await params;
  const body = await req.json() as { status?: string; note?: string };
  const sb = createServiceSupabaseClient();

  const update: Record<string, unknown> = {};
  if (body.status) {
    update.status = body.status;
    update.status_changed_at = new Date().toISOString();
  }
  if (body.note !== undefined) update.note = body.note;

  const { error } = await sb.from('orders').update(update).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** DSGVO-Löschrecht: personenbezogene Daten anonymisieren, Auftrag bleibt erhalten */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Admin-Zugang erforderlich' }, { status: 401 });
    }
    throw e;
  }
  const { id } = await params;
  const sb = createServiceSupabaseClient();

  const { error } = await sb
    .from('orders')
    .update({
      customer_name: null,
      customer_email: null,
      customer_phone: null,
      customer_company: null,
      customer_street: null,
      customer_zip: null,
      customer_city: null,
      note: null,
      gdpr_consent_at: null,
    })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, anonymized: true });
}
