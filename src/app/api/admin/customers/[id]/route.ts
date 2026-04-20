import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin, AdminAuthError } from '@/lib/admin-auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
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
    .from('profiles')
    .select('id, role, company, contact_name, phone, street, zip, city, country, discount_pct, approved_at, created_at, notes')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Kunde nicht gefunden' }, { status: 404 });
  }

  // E-Mail aus Auth
  const { data: authData } = await sb.auth.admin.getUserById(id);
  const email = authData?.user?.email ?? '';

  return NextResponse.json({ profile: { ...data, email } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Admin-Zugang erforderlich' }, { status: 401 });
    }
    throw e;
  }
  const { id } = await params;

  let body: {
    role?: string;
    discount_pct?: number;
    company?: string;
    contact_name?: string;
    phone?: string;
    street?: string;
    zip?: string;
    city?: string;
    country?: string;
    notes?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request' }, { status: 400 });
  }

  const sb = createServiceSupabaseClient();

  // Update-Objekt bauen — nur gesetzte Felder
  const update: Record<string, unknown> = {};

  if (body.company !== undefined) update.company = body.company || null;
  if (body.contact_name !== undefined) update.contact_name = body.contact_name || null;
  if (body.phone !== undefined) update.phone = body.phone || null;
  if (body.street !== undefined) update.street = body.street || null;
  if (body.zip !== undefined) update.zip = body.zip || null;
  if (body.city !== undefined) update.city = body.city || null;
  if (body.country !== undefined) update.country = body.country || null;
  if (body.notes !== undefined) update.notes = body.notes || null;

  // Rollenänderung mit Seiteneffekten
  if (body.role !== undefined) {
    update.role = body.role;
    if (body.role === 'dealer') {
      update.approved_at = new Date().toISOString();
      update.discount_pct = body.discount_pct ?? 0.30;
    } else if (body.role === 'customer') {
      update.approved_at = null;
      update.discount_pct = 0;
    }
  } else if (body.discount_pct !== undefined) {
    // Nur Rabatt ändern (ohne Rollenänderung)
    update.discount_pct = Math.max(0, Math.min(1, body.discount_pct));
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Keine Aenderungen' }, { status: 400 });
  }

  const { error } = await sb
    .from('profiles')
    .update(update)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
