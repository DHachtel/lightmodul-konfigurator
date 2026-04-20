import { NextResponse } from 'next/server';
import { clearAdminCookie, requireAdmin, AdminAuthError } from '@/lib/admin-auth';

export async function POST() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Admin-Zugang erforderlich' }, { status: 401 });
    }
    throw e;
  }
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
