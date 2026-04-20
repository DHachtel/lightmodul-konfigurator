// Edge-kompatible Hilfsfunktionen für Admin-Cookie-Authentifizierung
// WICHTIG: Kein Import von 'next/headers' auf Top-Level — verifyAdminToken und COOKIE_NAME
// werden in middleware.ts (Edge Runtime) importiert.
// Nutzt Web Crypto API (SubtleCrypto) — kompatibel mit Edge Runtime und Node.js.

export const COOKIE_NAME = 'admin_session';
const MAX_AGE = 60 * 60 * 8; // 8 Stunden

// HMAC-SHA256 Signatur via Web Crypto API (Edge-kompatibel)
async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  // Timing-safe Vergleich: konstante Laufzeit unabhängig von Übereinstimmung
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// Token-Format: "timestamp.hmac" — Secret ist NICHT im Token enthalten
async function sign(payload: string): Promise<string> {
  const secret = process.env.ADMIN_PASSWORD ?? '';
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

// Prüft ob ein Token gültig und nicht abgelaufen ist
export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const dotIdx = token.indexOf('.');
    if (dotIdx < 1) return false;
    const payload = token.substring(0, dotIdx);
    const signature = token.substring(dotIdx + 1);
    const secret = process.env.ADMIN_PASSWORD ?? '';
    if (!secret) return false;
    const valid = await hmacVerify(payload, signature, secret);
    if (!valid) return false;
    const timestamp = parseInt(payload, 10);
    if (isNaN(timestamp)) return false;
    const age = (Date.now() - timestamp) / 1000;
    return age >= 0 && age < MAX_AGE;
  } catch {
    return false;
  }
}

// Erstellt einen neuen Admin-Token mit aktuellem Timestamp
export async function createAdminToken(): Promise<string> {
  return sign(String(Date.now()));
}

// Setzt das Admin-Cookie (nur in Node.js API-Routen verwenden, nicht in Middleware)
export async function setAdminCookie(token: string): Promise<void> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: MAX_AGE,
    path: '/',
  });
}

// Löscht das Admin-Cookie (nur in Node.js API-Routen verwenden, nicht in Middleware)
export async function clearAdminCookie(): Promise<void> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Defense-in-Depth: In-Handler Admin-Auth-Guard für API-Routen.
// Zusätzlich zur Middleware-Prüfung — schützt bei Middleware-Bypass.
export async function requireAdmin(): Promise<true> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminToken(token))) {
    throw new AdminAuthError();
  }
  return true;
}

export class AdminAuthError extends Error {
  constructor() { super('Admin-Zugang erforderlich'); }
}
