import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { requireAdmin, AdminAuthError } from '@/lib/admin-auth';

// Erlaubte Preisspalten — keine anderen Felder dürfen per PATCH geändert werden
const ALLOWED_PRICE_KEYS = new Set([
  'pg1_mdf_eur',
  'pg1_mdf_chf',
  'pg2_eur',
  'pg2_chf',
  'pg3_eur',
  'pg3_chf',
  'pg4_eur',
  'pg4_chf',
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ art_nr: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Admin-Zugang erforderlich' }, { status: 401 });
    }
    throw e;
  }
  const { art_nr } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: Record<string, any> = await req.json();

  // Nur erlaubte Preisspalten übernehmen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_PRICE_KEYS.has(key)) {
      const val = body[key];
      update[key] = val === '' || val === null ? null : Number(val);
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Keine gültigen Felder angegeben' }, { status: 400 });
  }

  const sb = createServiceSupabaseClient();
  const { data, error } = await sb
    .from('article_prices')
    .update(update)
    .eq('art_nr', art_nr)
    .select('art_nr, bezeichnung, pg1_mdf_eur, pg1_mdf_chf, pg2_eur, pg2_chf, pg3_eur, pg3_chf, pg4_eur, pg4_chf')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ price: data });
}
