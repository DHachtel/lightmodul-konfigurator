import { NextRequest, NextResponse } from 'next/server';
import { createAdminToken, setAdminCookie } from '@/lib/admin-auth';
import { timingSafeEqual } from 'crypto';

export async function POST(req: NextRequest) {
  let body: { user?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request' }, { status: 400 });
  }

  const { user, password } = body;

  const expectedUser = process.env.ADMIN_USER ?? 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD ?? '';

  if (!expectedPass) {
    return NextResponse.json({ error: 'Admin nicht konfiguriert' }, { status: 503 });
  }

  // Timing-safe Vergleich verhindert Zeichenweise Passwort-Enumeration
  const userBuf = Buffer.from(String(user ?? ''));
  const passBuf = Buffer.from(String(password ?? ''));
  const expUserBuf = Buffer.from(expectedUser);
  const expPassBuf = Buffer.from(expectedPass);

  const userOk = userBuf.length === expUserBuf.length && timingSafeEqual(userBuf, expUserBuf);
  const passOk = passBuf.length === expPassBuf.length && timingSafeEqual(passBuf, expPassBuf);

  if (!userOk || !passOk) {
    return NextResponse.json({ error: 'Ungültige Zugangsdaten' }, { status: 401 });
  }

  const token = await createAdminToken();
  await setAdminCookie(token);

  return NextResponse.json({ ok: true });
}
