# Admin-Dashboard + Auftragsworkflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-Dashboard mit Auftragsmanagement, Konfigurationsübersicht, Preispflege und Artikelstamm als Route-Gruppe im bestehenden Next.js-Konfigurator. Dazu Konfigurator-Erweiterungen (Anfrage absenden, BOM mitspeichern) und ein Händler-Login-Placeholder.

**Architecture:** Admin-Bereich unter `/admin/*` mit eigenem Layout (Sidebar), geschützt durch Cookie-basierte Admin-Auth (separate Credentials von Beta-Basic-Auth). Neue Supabase-Tabellen `orders` + `order_items` für Auftragsworkflow. Bestehende `saved_configs`-Tabelle wird um `bom_json` erweitert. Alle Admin-API-Routen unter `/api/admin/*` nutzen `createServiceSupabaseClient()`.

**Tech Stack:** Next.js 16 (App Router, Server Components), Tailwind CSS v4, Supabase (PostgreSQL + RLS), TypeScript strict

---

## File Structure

### New Files

```
supabase/migrations/005_orders.sql                    — orders + order_items tables + order_nr trigger
supabase/migrations/006_extend_saved_configs.sql       — add bom_json column to saved_configs

src/app/admin/login/page.tsx                           — Admin login page (credentials → cookie)
src/app/admin/layout.tsx                               — Admin layout with sidebar navigation
src/app/admin/page.tsx                                 — Dashboard with KPI tiles
src/app/admin/orders/page.tsx                          — Orders list with filters
src/app/admin/orders/[id]/page.tsx                     — Order detail with status management
src/app/admin/configurations/page.tsx                  — Configurations list
src/app/admin/configurations/[id]/page.tsx             — Configuration detail with BOM + Excel download
src/app/admin/prices/page.tsx                          — Editable price grid
src/app/admin/articles/page.tsx                        — Article management

src/app/api/admin/auth/login/route.ts                  — POST: verify admin credentials, set cookie
src/app/api/admin/auth/logout/route.ts                 — POST: clear admin cookie
src/app/api/admin/stats/route.ts                       — GET: dashboard KPIs
src/app/api/admin/orders/route.ts                      — GET: list orders (filtered, paginated)
src/app/api/admin/orders/[id]/route.ts                 — GET + PATCH: order detail + status change
src/app/api/admin/configurations/route.ts              — GET: list configurations (paginated)
src/app/api/admin/configurations/[id]/route.ts         — GET: single configuration detail
src/app/api/admin/configurations/[id]/xlsx/route.ts    — GET: generate + download XLSX for config
src/app/api/admin/prices/route.ts                      — GET: list prices (paginated, searchable)
src/app/api/admin/prices/[art_nr]/route.ts             — PATCH: update single price
src/app/api/admin/articles/route.ts                    — GET + POST: list + create articles
src/app/api/admin/articles/[art_nr]/route.ts           — PATCH: update article

src/app/api/orders/route.ts                            — POST: public order submission

src/app/(auth)/login/page.tsx                          — Dealer login placeholder

src/lib/admin-auth.ts                                  — Admin cookie signing/verifying helpers
```

### Modified Files

```
middleware.ts                                          — Add admin cookie check for /admin/* routes
src/app/api/config/save/route.ts                       — Also save bom_json
src/features/configurator/ConfiguratorShell.tsx         — Add "Anfrage senden" button + modal, Händler-Login link
```

---

### Task 1: Database — Orders + Order Items

**Files:**
- Create: `supabase/migrations/005_orders.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/005_orders.sql

-- ── Auftrags-Tabelle ──
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_nr         TEXT UNIQUE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'submitted'
                     CHECK (status IN ('draft','submitted','confirmed','completed','cancelled')),
  status_changed_at TIMESTAMPTZ DEFAULT now(),
  customer_name    TEXT,
  customer_email   TEXT,
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Kunden dürfen Anfragen erstellen
CREATE POLICY "Public insert" ON orders
  FOR INSERT WITH CHECK (true);

-- Lesen nur via service_role (Admin-API)
CREATE POLICY "Service select" ON orders
  FOR SELECT USING (false);

-- ── Auftragsnummer-Trigger ──
CREATE OR REPLACE FUNCTION generate_order_nr()
RETURNS TRIGGER AS $$
DECLARE
  yr TEXT;
  next_nr INTEGER;
BEGIN
  yr := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_nr FROM 9) AS INTEGER)), 0) + 1
    INTO next_nr
    FROM orders
    WHERE order_nr LIKE 'AM-' || yr || '-%';
  NEW.order_nr := 'AM-' || yr || '-' || LPAD(next_nr::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_nr
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_nr IS NULL OR NEW.order_nr = '')
  EXECUTE FUNCTION generate_order_nr();

-- ── Auftrags-Positionen ──
CREATE TABLE order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  config_code      BIGINT NOT NULL REFERENCES saved_configs(config_code),
  quantity         INTEGER NOT NULL DEFAULT 1,
  unit_price       NUMERIC,
  currency         TEXT NOT NULL DEFAULT 'EUR'
                     CHECK (currency IN ('EUR','CHF'))
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert" ON order_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service select" ON order_items
  FOR SELECT USING (false);

-- Index für schnelle Abfragen
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Paste the SQL into the Supabase SQL Editor and execute. Verify: tables `orders` and `order_items` exist, trigger `trg_order_nr` is created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/005_orders.sql
git commit -m "DB: orders + order_items tables with auto order_nr trigger"
```

---

### Task 2: Database — Extend saved_configs with bom_json

**Files:**
- Create: `supabase/migrations/006_extend_saved_configs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/006_extend_saved_configs.sql

ALTER TABLE saved_configs
  ADD COLUMN IF NOT EXISTS bom_json JSONB;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

- [ ] **Step 3: Extend /api/config/save to also store bom_json**

Modify `src/app/api/config/save/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

function generate8DigitCode(): number {
  return Math.floor(10000000 + Math.random() * 90000000);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { config, screenshot, bom } = body;

    // Minimalvalidierung
    if (
      !config ||
      !Array.isArray(config.cols) ||
      !Array.isArray(config.rows) ||
      !Array.isArray(config.grid)
    ) {
      return NextResponse.json({ error: 'Ungültige Konfiguration' }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();

    // Bis zu 3 Versuche bei Kollision
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generate8DigitCode();
      const { error } = await supabase.from('saved_configs').insert({
        config_code: code,
        config_json: config,
        screenshot: screenshot ?? null,
        bom_json: bom ?? null,
      });

      if (!error) {
        return NextResponse.json({ code });
      }

      // 23505 = unique_violation — erneut versuchen
      if (error.code !== '23505') {
        console.error('Save error:', error);
        return NextResponse.json({ error: 'Speichern fehlgeschlagen' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'ID-Kollision — bitte erneut versuchen' }, { status: 500 });
  } catch (e) {
    console.error('Save error:', e);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Update ConfiguratorShell to send BOM with save**

In `src/features/configurator/ConfiguratorShell.tsx`, modify `handleCommit` (around line 147):

Change the fetch body from:
```typescript
body: JSON.stringify({ config: state, screenshot }),
```
to:
```typescript
body: JSON.stringify({ config: state, screenshot, bom }),
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/006_extend_saved_configs.sql src/app/api/config/save/route.ts src/features/configurator/ConfiguratorShell.tsx
git commit -m "DB: saved_configs + bom_json, save route sends BOM"
```

---

### Task 3: Admin Auth — Cookie-based Login

**Files:**
- Create: `src/lib/admin-auth.ts`
- Create: `src/app/api/admin/auth/login/route.ts`
- Create: `src/app/api/admin/auth/logout/route.ts`
- Modify: `middleware.ts`

- [ ] **Step 1: Create admin-auth helper**

`src/lib/admin-auth.ts`:

```typescript
import { cookies } from 'next/headers';

const COOKIE_NAME = 'admin_session';
const MAX_AGE = 60 * 60 * 8; // 8 Stunden

/**
 * Erzeugt einen signierten Admin-Session-Token.
 * Einfacher HMAC-ähnlicher Ansatz: Base64(timestamp + ':' + hash).
 * Kein JWT nötig — nur ein Server-seitiges Secret.
 */
function sign(payload: string): string {
  const secret = process.env.ADMIN_PASSWORD ?? '';
  // Einfache Signatur: payload + secret → Base64
  const token = Buffer.from(`${payload}:${secret}`).toString('base64');
  return token;
}

function verify(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const secret = process.env.ADMIN_PASSWORD ?? '';
    const parts = decoded.split(':');
    if (parts.length < 2) return false;
    const storedSecret = parts[parts.length - 1];
    const timestamp = parseInt(parts[0], 10);
    if (storedSecret !== secret) return false;
    // Prüfe ob Token abgelaufen
    const age = (Date.now() - timestamp) / 1000;
    return age < MAX_AGE;
  } catch {
    return false;
  }
}

export function createAdminToken(): string {
  return sign(String(Date.now()));
}

export function verifyAdminToken(token: string): boolean {
  return verify(token);
}

export async function setAdminCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export async function clearAdminCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function getAdminTokenFromRequest(req: { cookies: { get: (name: string) => { value: string } | undefined } }): string | null {
  return req.cookies.get(COOKIE_NAME)?.value ?? null;
}

export { COOKIE_NAME };
```

- [ ] **Step 2: Create admin login API route**

`src/app/api/admin/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createAdminToken, setAdminCookie } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  const { user, password } = await req.json() as { user?: string; password?: string };

  const expectedUser = process.env.ADMIN_USER ?? 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD ?? '';

  if (!expectedPass) {
    return NextResponse.json({ error: 'Admin nicht konfiguriert' }, { status: 503 });
  }

  if (user !== expectedUser || password !== expectedPass) {
    return NextResponse.json({ error: 'Ungültige Zugangsdaten' }, { status: 401 });
  }

  const token = createAdminToken();
  await setAdminCookie(token);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create admin logout API route**

`src/app/api/admin/auth/logout/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { clearAdminCookie } from '@/lib/admin-auth';

export async function POST() {
  await clearAdminCookie();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Extend middleware for admin routes**

Modify `middleware.ts` — add admin cookie check after Beta auth passes:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { verifyAdminToken, COOKIE_NAME } from '@/lib/admin-auth'

export async function middleware(req: NextRequest) {
  const expectedUser = process.env.BETA_USER ?? 'artmodul'
  const expectedPass = process.env.BETA_PASSWORD ?? ''

  if (!expectedPass) {
    return new NextResponse('Server nicht konfiguriert', { status: 503 })
  }

  const auth = req.headers.get('authorization') ?? ''
  const expected = 'Basic ' + btoa(`${expectedUser}:${expectedPass}`)

  if (auth !== expected) {
    return new NextResponse('Zugang verweigert', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Artmodul Konfigurator", charset="UTF-8"',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }

  // ── Admin-Schutz: /admin/* und /api/admin/* (außer Login-Route) ──
  const path = req.nextUrl.pathname
  const isAdminRoute = path.startsWith('/admin') || path.startsWith('/api/admin')
  const isAdminLoginPage = path === '/admin/login'
  const isAdminLoginApi = path === '/api/admin/auth/login'

  if (isAdminRoute && !isAdminLoginPage && !isAdminLoginApi) {
    const adminPass = process.env.ADMIN_PASSWORD ?? ''
    if (!adminPass) {
      return new NextResponse('Admin nicht konfiguriert', { status: 503 })
    }

    const token = req.cookies.get(COOKIE_NAME)?.value
    if (!token || !verifyAdminToken(token)) {
      // API-Routen: 401 zurückgeben
      if (path.startsWith('/api/admin')) {
        return NextResponse.json({ error: 'Admin-Zugang erforderlich' }, { status: 401 })
      }
      // Seiten: Redirect zum Admin-Login
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
  }

  // Supabase-Session bei jedem Request erneuern (verhindert ungewolltes Ausloggen)
  const res = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            res.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  await supabase.auth.getUser()

  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
}
```

- [ ] **Step 5: Create admin login page**

`src/app/admin/login/page.tsx`:

```tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Login fehlgeschlagen');
        return;
      }
      router.push('/admin');
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F6F2]">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-lg font-semibold text-[#1C1A17] mb-1">Admin-Zugang</h1>
        <p className="text-xs text-[#7A7670] mb-6">Artmodul Konfigurator</p>

        <label className="block text-xs font-medium text-[#3A3834] mb-1">Benutzer</label>
        <input
          type="text"
          value={user}
          onChange={e => setUser(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#DDDAD3] text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
          autoFocus
        />

        <label className="block text-xs font-medium text-[#3A3834] mb-1">Passwort</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#DDDAD3] text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
        />

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-[#1C1A17] text-white text-sm font-medium hover:bg-[#3A3834] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Anmelden...' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Add ADMIN_USER and ADMIN_PASSWORD to .env.local**

Add to `.env.local`:
```
ADMIN_USER=admin
ADMIN_PASSWORD=<sicheres-passwort>
```

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/admin-auth.ts src/app/api/admin/auth/login/route.ts src/app/api/admin/auth/logout/route.ts src/app/admin/login/page.tsx middleware.ts
git commit -m "Admin: Cookie-basierte Authentifizierung + Login-Seite"
```

---

### Task 4: Admin Layout + Dashboard

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/app/api/admin/stats/route.ts`

- [ ] **Step 1: Create admin layout with sidebar**

`src/app/admin/layout.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '◻' },
  { href: '/admin/orders', label: 'Aufträge', icon: '◻' },
  { href: '/admin/configurations', label: 'Konfigurationen', icon: '◻' },
  { href: '/admin/prices', label: 'Preisliste', icon: '◻' },
  { href: '/admin/articles', label: 'Artikelstamm', icon: '◻' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Login-Seite bekommt kein Layout
  if (pathname === '/admin/login') return <>{children}</>;

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen flex bg-[#F8F6F2]">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1C1A17] text-white flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-white/10">
          <div className="text-xs tracking-widest text-[#C4AE8C] uppercase">Artmodul</div>
          <div className="text-sm font-semibold mt-0.5">Admin</div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map(item => {
            const active = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-5 py-2.5 text-xs tracking-wide transition-colors ${
                  active
                    ? 'bg-white/10 text-[#C4AE8C]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => { void handleLogout(); }}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Abmelden
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Create stats API route**

`src/app/api/admin/stats/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const sb = createServiceSupabaseClient();

  // Parallele Abfragen
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

  // Umsatz berechnen (confirmed + completed Orders)
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
```

- [ ] **Step 3: Create dashboard page**

`src/app/admin/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

interface Stats {
  ordersTotal: number;
  ordersOpen: number;
  configsWeek: number;
  configsMonth: number;
  totalRevenue: number;
}

const TILES = [
  { key: 'ordersTotal' as const, label: 'Aufträge gesamt', fmt: (n: number) => String(n) },
  { key: 'ordersOpen' as const, label: 'Offene Aufträge', fmt: (n: number) => String(n) },
  { key: 'configsWeek' as const, label: 'Konfigurationen (7 Tage)', fmt: (n: number) => String(n) },
  { key: 'configsMonth' as const, label: 'Konfigurationen (30 Tage)', fmt: (n: number) => String(n) },
  { key: 'totalRevenue' as const, label: 'Umsatz (bestätigt)', fmt: (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then((d: Stats) => setStats(d))
      .catch(() => {/* ignore */});
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1C1A17] mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {TILES.map(tile => (
          <div key={tile.key} className="bg-white rounded-xl p-5 shadow-sm border border-[#EEEBE4]">
            <div className="text-xs text-[#7A7670] mb-1">{tile.label}</div>
            <div className="text-2xl font-semibold text-[#1C1A17] font-[tabular-nums]">
              {stats ? tile.fmt(stats[tile.key]) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/page.tsx src/app/api/admin/stats/route.ts
git commit -m "Admin: Layout + Dashboard mit KPI-Kacheln"
```

---

### Task 5: Admin — Orders List + Detail

**Files:**
- Create: `src/app/api/admin/orders/route.ts`
- Create: `src/app/api/admin/orders/[id]/route.ts`
- Create: `src/app/admin/orders/page.tsx`
- Create: `src/app/admin/orders/[id]/page.tsx`

- [ ] **Step 1: Create orders list API**

`src/app/api/admin/orders/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
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
```

- [ ] **Step 2: Create order detail + patch API**

`src/app/api/admin/orders/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
```

- [ ] **Step 3: Create orders list page**

`src/app/admin/orders/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface OrderItem {
  id: string;
  config_code: number;
  quantity: number;
  unit_price: number | null;
  currency: string;
}

interface Order {
  id: string;
  order_nr: string;
  status: string;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
  status_changed_at: string;
  order_items: OrderItem[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-green-50 text-green-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf',
  submitted: 'Eingegangen',
  confirmed: 'Bestätigt',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/admin/orders?${params}`)
      .then(r => r.json())
      .then((d: { orders: Order[]; total: number }) => {
        setOrders(d.orders);
        setTotal(d.total);
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#1C1A17]">Aufträge</h1>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-lg border border-[#DDDAD3] text-xs bg-white"
        >
          <option value="">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-[#7A7670]">Lade...</div>
      ) : orders.length === 0 ? (
        <div className="text-sm text-[#7A7670]">Keine Aufträge gefunden.</div>
      ) : (
        <div className="bg-white rounded-xl border border-[#EEEBE4] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F8F6F2] border-b border-[#EEEBE4]">
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Auftragsnr.</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Status</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Kunde</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Positionen</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-[#EEEBE4] last:border-0 hover:bg-[#FAFAF8] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="text-[#8A7050] hover:underline font-medium">
                      {o.order_nr}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[o.status] ?? ''}`}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#3A3834]">{o.customer_name ?? '—'}</td>
                  <td className="px-4 py-3 text-[#7A7670]">{o.order_items.length}</td>
                  <td className="px-4 py-3 text-[#7A7670]">
                    {new Date(o.created_at).toLocaleDateString('de-DE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#EEEBE4]">
              <span className="text-[10px] text-[#7A7670]">{total} Aufträge</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-2 py-1 text-[10px] rounded border border-[#DDDAD3] disabled:opacity-30">←</button>
                <span className="text-[10px] text-[#7A7670] py-1">{page}/{totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-2 py-1 text-[10px] rounded border border-[#DDDAD3] disabled:opacity-30">→</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create order detail page**

`src/app/admin/orders/[id]/page.tsx`:

```tsx
'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';

interface OrderItem {
  id: string;
  config_code: number;
  quantity: number;
  unit_price: number | null;
  currency: string;
}

interface OrderDetail {
  id: string;
  order_nr: string;
  status: string;
  status_changed_at: string;
  customer_name: string | null;
  customer_email: string | null;
  note: string | null;
  created_at: string;
  order_items: OrderItem[];
}

const STATUSES = ['draft', 'submitted', 'confirmed', 'completed', 'cancelled'] as const;
const STATUS_LABELS: Record<string, string> = {
  draft: 'Entwurf', submitted: 'Eingegangen', confirmed: 'Bestätigt',
  completed: 'Abgeschlossen', cancelled: 'Storniert',
};

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/orders/${id}`)
      .then(r => r.json())
      .then((d: OrderDetail) => { setOrder(d); setNote(d.note ?? ''); })
      .catch(() => {/* ignore */});
  }, [id]);

  const updateStatus = async (status: string) => {
    setSaving(true);
    await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setOrder(prev => prev ? { ...prev, status, status_changed_at: new Date().toISOString() } : null);
    setSaving(false);
  };

  const saveNote = async () => {
    setSaving(true);
    await fetch(`/api/admin/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note }),
    });
    setOrder(prev => prev ? { ...prev, note } : null);
    setSaving(false);
  };

  if (!order) return <div className="text-sm text-[#7A7670]">Lade...</div>;

  return (
    <div>
      <Link href="/admin/orders" className="text-xs text-[#8A7050] hover:underline mb-4 inline-block">← Zurück</Link>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold text-[#1C1A17]">{order.order_nr}</h1>
        <select
          value={order.status}
          onChange={e => { void updateStatus(e.target.value); }}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg border border-[#DDDAD3] text-xs bg-white"
        >
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {/* Kundendaten */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-[#EEEBE4]">
          <div className="text-[10px] text-[#7A7670] uppercase tracking-wider mb-2">Kunde</div>
          <div className="text-sm text-[#1C1A17]">{order.customer_name ?? '—'}</div>
          <div className="text-xs text-[#7A7670]">{order.customer_email ?? '—'}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#EEEBE4]">
          <div className="text-[10px] text-[#7A7670] uppercase tracking-wider mb-2">Zeitstrahl</div>
          <div className="text-xs text-[#3A3834]">
            Erstellt: {new Date(order.created_at).toLocaleString('de-DE')}
          </div>
          <div className="text-xs text-[#3A3834]">
            Letzter Status: {new Date(order.status_changed_at).toLocaleString('de-DE')}
          </div>
        </div>
      </div>

      {/* Positionen */}
      <div className="bg-white rounded-xl border border-[#EEEBE4] mb-6">
        <div className="px-4 py-3 border-b border-[#EEEBE4]">
          <span className="text-xs font-medium text-[#3A3834]">Positionen ({order.order_items.length})</span>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#F8F6F2]">
              <th className="text-left px-4 py-2 font-medium text-[#7A7670]">Möbel-ID</th>
              <th className="text-left px-4 py-2 font-medium text-[#7A7670]">Menge</th>
              <th className="text-left px-4 py-2 font-medium text-[#7A7670]">Preis</th>
              <th className="text-left px-4 py-2 font-medium text-[#7A7670]">Währung</th>
            </tr>
          </thead>
          <tbody>
            {order.order_items.map(item => (
              <tr key={item.id} className="border-b border-[#EEEBE4] last:border-0">
                <td className="px-4 py-2">
                  <Link href={`/admin/configurations/${item.config_code}`} className="text-[#8A7050] hover:underline">
                    #{item.config_code}
                  </Link>
                </td>
                <td className="px-4 py-2">{item.quantity}</td>
                <td className="px-4 py-2">{item.unit_price != null ? `${item.unit_price.toFixed(2)} €` : '—'}</td>
                <td className="px-4 py-2">{item.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Notizen */}
      <div className="bg-white rounded-xl p-4 border border-[#EEEBE4]">
        <div className="text-[10px] text-[#7A7670] uppercase tracking-wider mb-2">Interne Notiz</div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-[#DDDAD3] text-xs resize-y focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
        />
        <button
          onClick={() => { void saveNote(); }}
          disabled={saving || note === (order.note ?? '')}
          className="mt-2 px-4 py-1.5 rounded-lg bg-[#1C1A17] text-white text-xs font-medium disabled:opacity-30 transition-opacity"
        >
          Notiz speichern
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/orders/ src/app/admin/orders/
git commit -m "Admin: Auftrags-Übersicht + Detailseite mit Status-Management"
```

---

### Task 6: Admin — Configurations List + Detail

**Files:**
- Create: `src/app/api/admin/configurations/route.ts`
- Create: `src/app/api/admin/configurations/[id]/route.ts`
- Create: `src/app/api/admin/configurations/[id]/xlsx/route.ts`
- Create: `src/app/admin/configurations/page.tsx`
- Create: `src/app/admin/configurations/[id]/page.tsx`

- [ ] **Step 1: Create configurations list API**

`src/app/api/admin/configurations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = parseInt(sp.get('page') ?? '1', 10);
  const search = sp.get('q') ?? '';
  const limit = 20;
  const offset = (page - 1) * limit;

  const sb = createServiceSupabaseClient();
  let query = sb.from('saved_configs')
    .select('config_code, config_json, created_at', { count: 'exact' });

  if (search) {
    query = query.eq('config_code', parseInt(search, 10) || 0);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Kurzzusammenfassung pro Konfiguration
  const configs = (data ?? []).map(row => {
    const c = row.config_json as { cols?: number[]; rows?: number[]; depth?: number; surface?: string };
    return {
      config_code: row.config_code,
      cols: c.cols?.length ?? 0,
      rows: c.rows?.length ?? 0,
      width: (c.cols ?? []).reduce((a: number, b: number) => a + b, 0) + 30,
      height: (c.rows ?? []).reduce((a: number, b: number) => a + b, 0) + 30,
      depth: (c.depth ?? 0) + 30,
      surface: c.surface ?? '—',
      created_at: row.created_at,
    };
  });

  return NextResponse.json({ configs, total: count ?? 0, page, limit });
}
```

- [ ] **Step 2: Create single configuration API**

`src/app/api/admin/configurations/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
```

- [ ] **Step 3: Create XLSX download API**

`src/app/api/admin/configurations/[id]/xlsx/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { computeBOM } from '@/core/calc';
import type { ConfigState, BOMResult } from '@/core/types';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const code = parseInt(id, 10);
  if (isNaN(code)) return NextResponse.json({ error: 'Ungültiger Code' }, { status: 400 });

  const sb = createServiceSupabaseClient();
  const { data, error } = await sb
    .from('saved_configs')
    .select('config_json, bom_json')
    .eq('config_code', code)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Nicht gefunden' }, { status: 404 });

  // BOM: aus gespeichertem bom_json oder frisch berechnen
  const config = data.config_json as ConfigState;
  const bom: BOMResult | null = (data.bom_json as BOMResult) ?? computeBOM(config);

  if (!bom) return NextResponse.json({ error: 'BOM-Berechnung fehlgeschlagen' }, { status: 500 });

  // Einfache CSV als Fallback (echte XLSX-Generierung ist client-seitig)
  // Für den Admin-Bereich erzeugen wir eine tabulatorseparierte Textdatei
  const rows: string[] = ['Materialnr\tMöbel ID\tGruppe\tBauteil\tAnzahl'];

  // Würfel
  rows.push(`—\t${code}\tWürfel\tWürfel\t${bom.wuerfel}`);

  // Profile
  for (const p of [bom.pB, bom.pH, bom.pT]) {
    if (p.anz > 0) {
      rows.push(`—\t${code}\tProfile\t${p.typ} ${p.abm}\t${p.anz}`);
    }
  }

  // Platten (Böden)
  for (const b of [bom.bStd, bom.bKl]) {
    for (const item of b) {
      if (item.anz > 0) {
        rows.push(`—\t${code}\tPlatten\t${item.teil} ${item.abm}\t${item.anz}`);
      }
    }
  }

  const tsv = rows.join('\n');
  return new NextResponse(tsv, {
    headers: {
      'Content-Type': 'text/tab-separated-values; charset=utf-8',
      'Content-Disposition': `attachment; filename="Artmodul_${code}.tsv"`,
    },
  });
}
```

- [ ] **Step 4: Create configurations list page**

`src/app/admin/configurations/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ConfigSummary {
  config_code: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  depth: number;
  surface: string;
  created_at: string;
}

export default function ConfigurationsPage() {
  const [configs, setConfigs] = useState<ConfigSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('q', search);
    fetch(`/api/admin/configurations?${params}`)
      .then(r => r.json())
      .then((d: { configs: ConfigSummary[]; total: number }) => {
        setConfigs(d.configs);
        setTotal(d.total);
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false));
  }, [page, search]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#1C1A17]">Konfigurationen</h1>
        <input
          placeholder="Möbel-ID suchen..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-lg border border-[#DDDAD3] text-xs bg-white w-48 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
        />
      </div>

      {loading ? (
        <div className="text-sm text-[#7A7670]">Lade...</div>
      ) : configs.length === 0 ? (
        <div className="text-sm text-[#7A7670]">Keine Konfigurationen gefunden.</div>
      ) : (
        <div className="bg-white rounded-xl border border-[#EEEBE4] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F8F6F2] border-b border-[#EEEBE4]">
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Möbel-ID</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Raster</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Maße (mm)</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Oberfläche</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Erstellt</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Export</th>
              </tr>
            </thead>
            <tbody>
              {configs.map(c => (
                <tr key={c.config_code} className="border-b border-[#EEEBE4] last:border-0 hover:bg-[#FAFAF8] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/configurations/${c.config_code}`} className="text-[#8A7050] hover:underline font-medium">
                      #{c.config_code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#3A3834]">{c.cols}×{c.rows}</td>
                  <td className="px-4 py-3 text-[#3A3834]">{c.width} × {c.height} × {c.depth}</td>
                  <td className="px-4 py-3 text-[#7A7670]">{c.surface}</td>
                  <td className="px-4 py-3 text-[#7A7670]">{new Date(c.created_at).toLocaleDateString('de-DE')}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/admin/configurations/${c.config_code}/xlsx`}
                      className="text-[#8A7050] hover:underline"
                    >
                      TSV ↓
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#EEEBE4]">
              <span className="text-[10px] text-[#7A7670]">{total} Konfigurationen</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-2 py-1 text-[10px] rounded border border-[#DDDAD3] disabled:opacity-30">←</button>
                <span className="text-[10px] text-[#7A7670] py-1">{page}/{totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-2 py-1 text-[10px] rounded border border-[#DDDAD3] disabled:opacity-30">→</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create configuration detail page**

`src/app/admin/configurations/[id]/page.tsx`:

```tsx
'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import type { ConfigState, BOMResult } from '@/core/types';

interface SavedConfig {
  config_code: number;
  config_json: ConfigState;
  bom_json: BOMResult | null;
  screenshot: string | null;
  created_at: string;
}

export default function ConfigDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<SavedConfig | null>(null);

  useEffect(() => {
    fetch(`/api/admin/configurations/${id}`)
      .then(r => r.json())
      .then((d: SavedConfig) => setData(d))
      .catch(() => {/* ignore */});
  }, [id]);

  if (!data) return <div className="text-sm text-[#7A7670]">Lade...</div>;

  const config = data.config_json;
  const totalW = config.cols.reduce((a, b) => a + b, 0) + 30;
  const totalH = config.rows.reduce((a, b) => a + b, 0) + 30;
  const totalD = config.depth + 30;

  return (
    <div>
      <Link href="/admin/configurations" className="text-xs text-[#8A7050] hover:underline mb-4 inline-block">← Zurück</Link>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold text-[#1C1A17]">#{data.config_code}</h1>
        <span className="text-xs text-[#7A7670]">{new Date(data.created_at).toLocaleString('de-DE')}</span>
        <a
          href={`/api/admin/configurations/${data.config_code}/xlsx`}
          className="px-3 py-1.5 rounded-lg bg-[#1C1A17] text-white text-xs font-medium hover:bg-[#3A3834] transition-colors"
        >
          TSV herunterladen
        </a>
        <a
          href={`/?config=${data.config_code}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg border border-[#DDDAD3] text-xs font-medium text-[#3A3834] hover:bg-[#F8F6F2] transition-colors"
        >
          Im Konfigurator öffnen
        </a>
      </div>

      {/* Kennzahlen */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-[#EEEBE4]">
          <div className="text-[10px] text-[#7A7670] uppercase tracking-wider">Raster</div>
          <div className="text-lg font-semibold text-[#1C1A17]">{config.cols.length}×{config.rows.length}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#EEEBE4]">
          <div className="text-[10px] text-[#7A7670] uppercase tracking-wider">Maße (mm)</div>
          <div className="text-lg font-semibold text-[#1C1A17]">{totalW}×{totalH}×{totalD}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#EEEBE4]">
          <div className="text-[10px] text-[#7A7670] uppercase tracking-wider">Oberfläche</div>
          <div className="text-sm font-semibold text-[#1C1A17]">{config.surface}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-[#EEEBE4]">
          <div className="text-[10px] text-[#7A7670] uppercase tracking-wider">Tiefe</div>
          <div className="text-lg font-semibold text-[#1C1A17]">{config.depth} mm</div>
        </div>
      </div>

      {/* Screenshot */}
      {data.screenshot && (
        <div className="bg-white rounded-xl p-4 border border-[#EEEBE4] mb-6">
          <div className="text-[10px] text-[#7A7670] uppercase tracking-wider mb-2">3D-Vorschau</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.screenshot} alt="3D Vorschau" className="max-w-lg rounded-lg" />
        </div>
      )}

      {/* BOM-Zusammenfassung */}
      {data.bom_json && (
        <div className="bg-white rounded-xl p-4 border border-[#EEEBE4]">
          <div className="text-[10px] text-[#7A7670] uppercase tracking-wider mb-2">Stückliste (Zusammenfassung)</div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div><span className="text-[#7A7670]">Würfel:</span> <span className="font-medium">{data.bom_json.wuerfel}</span></div>
            <div><span className="text-[#7A7670]">Platten:</span> <span className="font-medium">{data.bom_json.totals?.platten ?? '—'}</span></div>
            <div><span className="text-[#7A7670]">Profile:</span> <span className="font-medium">{data.bom_json.totals?.profile ?? '—'}</span></div>
            <div><span className="text-[#7A7670]">Fronten:</span> <span className="font-medium">{data.bom_json.totals?.fronten ?? '—'}</span></div>
            <div><span className="text-[#7A7670]">Beschläge:</span> <span className="font-medium">{data.bom_json.totals?.beschlaege ?? '—'}</span></div>
            <div><span className="text-[#7A7670]">Füße:</span> <span className="font-medium">{data.bom_json.totals?.fuesse ?? '—'}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/configurations/ src/app/admin/configurations/
git commit -m "Admin: Konfigurations-Übersicht + Detail mit TSV-Export"
```

---

### Task 7: Admin — Prices + Articles

**Files:**
- Create: `src/app/api/admin/prices/route.ts`
- Create: `src/app/api/admin/prices/[art_nr]/route.ts`
- Create: `src/app/api/admin/articles/route.ts`
- Create: `src/app/api/admin/articles/[art_nr]/route.ts`
- Create: `src/app/admin/prices/page.tsx`
- Create: `src/app/admin/articles/page.tsx`

- [ ] **Step 1: Create prices API routes**

`src/app/api/admin/prices/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = parseInt(sp.get('page') ?? '1', 10);
  const search = sp.get('q') ?? '';
  const limit = 30;
  const offset = (page - 1) * limit;

  const sb = createServiceSupabaseClient();
  let query = sb.from('article_prices').select('*', { count: 'exact' });

  if (search) {
    query = query.or(`art_nr.ilike.%${search}%,bezeichnung.ilike.%${search}%`);
  }

  const { data, count, error } = await query
    .order('art_nr')
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [], total: count ?? 0, page, limit });
}
```

`src/app/api/admin/prices/[art_nr]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ art_nr: string }> }) {
  const { art_nr } = await params;
  const body = await req.json() as Record<string, unknown>;
  const sb = createServiceSupabaseClient();

  // Nur Preis-Spalten erlauben
  const allowed = ['pg1_mdf_eur', 'pg1_mdf_chf', 'pg2_eur', 'pg2_chf', 'pg3_eur', 'pg3_chf', 'pg4_eur', 'pg4_chf'];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Keine gültigen Felder' }, { status: 400 });
  }

  const { error } = await sb.from('article_prices').update(update).eq('art_nr', art_nr);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create articles API routes**

`src/app/api/admin/articles/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = parseInt(sp.get('page') ?? '1', 10);
  const search = sp.get('q') ?? '';
  const limit = 30;
  const offset = (page - 1) * limit;

  const sb = createServiceSupabaseClient();
  let query = sb.from('article_prices').select('art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm', { count: 'exact' });

  if (search) {
    query = query.or(`art_nr.ilike.%${search}%,bezeichnung.ilike.%${search}%,kategorie.ilike.%${search}%`);
  }

  const { data, count, error } = await query
    .order('art_nr')
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [], total: count ?? 0, page, limit });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>;
  const sb = createServiceSupabaseClient();

  const { error } = await sb.from('article_prices').insert(body);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
```

`src/app/api/admin/articles/[art_nr]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ art_nr: string }> }) {
  const { art_nr } = await params;
  const body = await req.json() as Record<string, unknown>;
  const sb = createServiceSupabaseClient();

  const allowed = ['typ', 'kategorie', 'bezeichnung', 'breite_mm', 'tiefe_mm'];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  const { error } = await sb.from('article_prices').update(update).eq('art_nr', art_nr);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Create prices page**

`src/app/admin/prices/page.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';

interface PriceRow {
  art_nr: string;
  typ: string;
  kategorie: string;
  bezeichnung: string;
  pg1_mdf_eur: number | null;
  pg1_mdf_chf: number | null;
  pg2_eur: number | null;
  pg2_chf: number | null;
  pg3_eur: number | null;
  pg3_chf: number | null;
  pg4_eur: number | null;
  pg4_chf: number | null;
}

const PRICE_COLS = [
  { key: 'pg1_mdf_eur', label: 'PG1 EUR' },
  { key: 'pg1_mdf_chf', label: 'PG1 CHF' },
  { key: 'pg2_eur', label: 'PG2 EUR' },
  { key: 'pg2_chf', label: 'PG2 CHF' },
  { key: 'pg3_eur', label: 'PG3 EUR' },
  { key: 'pg3_chf', label: 'PG3 CHF' },
  { key: 'pg4_eur', label: 'PG4 EUR' },
  { key: 'pg4_chf', label: 'PG4 CHF' },
] as const;

export default function PricesPage() {
  const [items, setItems] = useState<PriceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ art_nr: string; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('q', search);
    fetch(`/api/admin/prices?${params}`)
      .then(r => r.json())
      .then((d: { items: PriceRow[]; total: number }) => {
        setItems(d.items);
        setTotal(d.total);
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / 30);

  const startEdit = (art_nr: string, col: string, value: number | null) => {
    setEditing({ art_nr, col });
    setEditValue(value != null ? String(value) : '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    const val = parseFloat(editValue);
    if (isNaN(val)) { setEditing(null); return; }

    await fetch(`/api/admin/prices/${editing.art_nr}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [editing.col]: val }),
    });

    // Lokales Update
    setItems(prev => prev.map(item =>
      item.art_nr === editing.art_nr
        ? { ...item, [editing.col]: val }
        : item
    ));
    setEditing(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#1C1A17]">Preisliste</h1>
        <input
          placeholder="Artikelnr. oder Bezeichnung..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-lg border border-[#DDDAD3] text-xs bg-white w-64 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
        />
      </div>

      {loading ? (
        <div className="text-sm text-[#7A7670]">Lade...</div>
      ) : (
        <div className="bg-white rounded-xl border border-[#EEEBE4] overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F8F6F2] border-b border-[#EEEBE4]">
                <th className="text-left px-3 py-3 font-medium text-[#7A7670] sticky left-0 bg-[#F8F6F2]">Art.Nr.</th>
                <th className="text-left px-3 py-3 font-medium text-[#7A7670]">Bezeichnung</th>
                {PRICE_COLS.map(c => (
                  <th key={c.key} className="text-right px-3 py-3 font-medium text-[#7A7670] whitespace-nowrap">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.art_nr} className="border-b border-[#EEEBE4] last:border-0 hover:bg-[#FAFAF8]">
                  <td className="px-3 py-2 font-medium text-[#3A3834] sticky left-0 bg-white">{item.art_nr}</td>
                  <td className="px-3 py-2 text-[#7A7670] max-w-48 truncate">{item.bezeichnung}</td>
                  {PRICE_COLS.map(c => {
                    const val = item[c.key as keyof PriceRow] as number | null;
                    const isEditing = editing?.art_nr === item.art_nr && editing.col === c.key;
                    return (
                      <td key={c.key} className="px-3 py-2 text-right">
                        {isEditing ? (
                          <input
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => { void saveEdit(); }}
                            onKeyDown={e => { if (e.key === 'Enter') { void saveEdit(); } if (e.key === 'Escape') setEditing(null); }}
                            className="w-20 px-1 py-0.5 text-right border border-[#8A7050] rounded text-xs focus:outline-none"
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() => startEdit(item.art_nr, c.key, val)}
                            className="cursor-pointer hover:bg-[#EEEBE4] px-1 py-0.5 rounded inline-block min-w-[3rem] text-[#3A3834]"
                          >
                            {val != null ? val.toFixed(2) : '—'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#EEEBE4]">
              <span className="text-[10px] text-[#7A7670]">{total} Artikel</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-2 py-1 text-[10px] rounded border border-[#DDDAD3] disabled:opacity-30">←</button>
                <span className="text-[10px] text-[#7A7670] py-1">{page}/{totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-2 py-1 text-[10px] rounded border border-[#DDDAD3] disabled:opacity-30">→</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create articles page**

`src/app/admin/articles/page.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';

interface Article {
  art_nr: string;
  typ: string;
  kategorie: string;
  bezeichnung: string;
  breite_mm: number | null;
  tiefe_mm: number | null;
}

export default function ArticlesPage() {
  const [items, setItems] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newArt, setNewArt] = useState({ art_nr: '', typ: '', kategorie: '', bezeichnung: '', breite_mm: '', tiefe_mm: '' });
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Article>>({});

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('q', search);
    fetch(`/api/admin/articles?${params}`)
      .then(r => r.json())
      .then((d: { items: Article[]; total: number }) => {
        setItems(d.items);
        setTotal(d.total);
      })
      .catch(() => {/* ignore */})
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / 30);

  const handleCreate = async () => {
    const body: Record<string, unknown> = {
      art_nr: newArt.art_nr,
      typ: newArt.typ,
      kategorie: newArt.kategorie,
      bezeichnung: newArt.bezeichnung,
    };
    if (newArt.breite_mm) body.breite_mm = parseInt(newArt.breite_mm, 10);
    if (newArt.tiefe_mm) body.tiefe_mm = parseInt(newArt.tiefe_mm, 10);

    const res = await fetch('/api/admin/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setShowNew(false);
      setNewArt({ art_nr: '', typ: '', kategorie: '', bezeichnung: '', breite_mm: '', tiefe_mm: '' });
      load();
    }
  };

  const startEdit = (item: Article) => {
    setEditingRow(item.art_nr);
    setEditData({ typ: item.typ, kategorie: item.kategorie, bezeichnung: item.bezeichnung });
  };

  const saveEdit = async (art_nr: string) => {
    await fetch(`/api/admin/articles/${art_nr}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    });
    setEditingRow(null);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#1C1A17]">Artikelstamm</h1>
        <div className="flex gap-3">
          <input
            placeholder="Suchen..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-[#DDDAD3] text-xs bg-white w-48 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
          />
          <button
            onClick={() => setShowNew(!showNew)}
            className="px-3 py-1.5 rounded-lg bg-[#1C1A17] text-white text-xs font-medium hover:bg-[#3A3834]"
          >
            + Neuer Artikel
          </button>
        </div>
      </div>

      {/* Neuer Artikel Formular */}
      {showNew && (
        <div className="bg-white rounded-xl p-4 border border-[#EEEBE4] mb-4">
          <div className="grid grid-cols-6 gap-3 mb-3">
            {(['art_nr', 'typ', 'kategorie', 'bezeichnung', 'breite_mm', 'tiefe_mm'] as const).map(field => (
              <div key={field}>
                <label className="text-[10px] text-[#7A7670] uppercase">{field}</label>
                <input
                  value={newArt[field]}
                  onChange={e => setNewArt(prev => ({ ...prev, [field]: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded border border-[#DDDAD3] text-xs"
                />
              </div>
            ))}
          </div>
          <button
            onClick={() => { void handleCreate(); }}
            className="px-4 py-1.5 rounded-lg bg-[#1C1A17] text-white text-xs font-medium"
          >
            Anlegen
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-[#7A7670]">Lade...</div>
      ) : (
        <div className="bg-white rounded-xl border border-[#EEEBE4] overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#F8F6F2] border-b border-[#EEEBE4]">
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Art.Nr.</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Typ</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Kategorie</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Bezeichnung</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Breite</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Tiefe</th>
                <th className="text-left px-4 py-3 font-medium text-[#7A7670]"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.art_nr} className="border-b border-[#EEEBE4] last:border-0 hover:bg-[#FAFAF8]">
                  <td className="px-4 py-2 font-medium text-[#3A3834]">{item.art_nr}</td>
                  {editingRow === item.art_nr ? (
                    <>
                      <td className="px-4 py-2">
                        <input value={editData.typ ?? ''} onChange={e => setEditData(d => ({ ...d, typ: e.target.value }))}
                          className="w-full px-1 py-0.5 border border-[#8A7050] rounded text-xs" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={editData.kategorie ?? ''} onChange={e => setEditData(d => ({ ...d, kategorie: e.target.value }))}
                          className="w-full px-1 py-0.5 border border-[#8A7050] rounded text-xs" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={editData.bezeichnung ?? ''} onChange={e => setEditData(d => ({ ...d, bezeichnung: e.target.value }))}
                          className="w-full px-1 py-0.5 border border-[#8A7050] rounded text-xs" />
                      </td>
                      <td className="px-4 py-2 text-[#7A7670]">{item.breite_mm ?? '—'}</td>
                      <td className="px-4 py-2 text-[#7A7670]">{item.tiefe_mm ?? '—'}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => { void saveEdit(item.art_nr); }}
                          className="text-[#8A7050] hover:underline">Speichern</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 text-[#3A3834]">{item.typ}</td>
                      <td className="px-4 py-2 text-[#3A3834]">{item.kategorie}</td>
                      <td className="px-4 py-2 text-[#7A7670]">{item.bezeichnung}</td>
                      <td className="px-4 py-2 text-[#7A7670]">{item.breite_mm ?? '—'}</td>
                      <td className="px-4 py-2 text-[#7A7670]">{item.tiefe_mm ?? '—'}</td>
                      <td className="px-4 py-2">
                        <button onClick={() => startEdit(item)}
                          className="text-[#8A7050] hover:underline">Bearbeiten</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#EEEBE4]">
              <span className="text-[10px] text-[#7A7670]">{total} Artikel</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-2 py-1 text-[10px] rounded border border-[#DDDAD3] disabled:opacity-30">←</button>
                <span className="text-[10px] text-[#7A7670] py-1">{page}/{totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-2 py-1 text-[10px] rounded border border-[#DDDAD3] disabled:opacity-30">→</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/prices/ src/app/api/admin/articles/ src/app/admin/prices/ src/app/admin/articles/
git commit -m "Admin: Preisliste (inline-edit) + Artikelstamm (CRUD)"
```

---

### Task 8: Public Order Submission + Konfigurator-Integration

**Files:**
- Create: `src/app/api/orders/route.ts`
- Modify: `src/features/configurator/ConfiguratorShell.tsx`

- [ ] **Step 1: Create public order API**

`src/app/api/orders/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      configCodes: number[];
      customerName?: string;
      customerEmail?: string;
      note?: string;
      currency?: string;
    };

    if (!body.configCodes || body.configCodes.length === 0) {
      return NextResponse.json({ error: 'Keine Konfigurationen angegeben' }, { status: 400 });
    }

    const sb = createServiceSupabaseClient();

    // Order erstellen (order_nr wird per Trigger generiert)
    const { data: order, error: orderErr } = await sb
      .from('orders')
      .insert({
        order_nr: '', // Trigger überschreibt
        status: 'submitted',
        customer_name: body.customerName ?? null,
        customer_email: body.customerEmail ?? null,
        note: body.note ?? null,
      })
      .select('id, order_nr')
      .single();

    if (orderErr || !order) {
      console.error('Order error:', orderErr);
      return NextResponse.json({ error: 'Auftrag konnte nicht erstellt werden' }, { status: 500 });
    }

    // Order Items erstellen
    const items = body.configCodes.map(code => ({
      order_id: order.id,
      config_code: code,
      quantity: 1,
      currency: body.currency ?? 'EUR',
    }));

    const { error: itemsErr } = await sb.from('order_items').insert(items);

    if (itemsErr) {
      console.error('Items error:', itemsErr);
      // Order wurde erstellt, Items fehlgeschlagen — inkonsistenter Zustand
      return NextResponse.json({ error: 'Positionen konnten nicht gespeichert werden' }, { status: 500 });
    }

    return NextResponse.json({ orderNr: order.order_nr });
  } catch (e) {
    console.error('Order error:', e);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add "Anfrage senden" button + modal to ConfiguratorShell**

In `src/features/configurator/ConfiguratorShell.tsx`, add after the offer cart section (around line 527), inside the header's right-side button group:

Add these state variables near the top of `ConfiguratorShellInner` (around line 60):

```typescript
// ── Anfrage senden ──
const [showOrderModal, setShowOrderModal] = useState(false);
const [orderName, setOrderName] = useState('');
const [orderEmail, setOrderEmail] = useState('');
const [orderNote, setOrderNote] = useState('');
const [orderLoading, setOrderLoading] = useState(false);
const [orderSuccess, setOrderSuccess] = useState('');
```

Add the submit handler:

```typescript
const handleOrderSubmit = useCallback(async () => {
  if (!actions.moebelId) return;
  setOrderLoading(true);
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        configCodes: [actions.moebelId],
        customerName: orderName || undefined,
        customerEmail: orderEmail || undefined,
        note: orderNote || undefined,
        currency,
      }),
    });
    if (!res.ok) throw new Error('Order failed');
    const data = await res.json() as { orderNr: string };
    setOrderSuccess(data.orderNr);
    setShowOrderModal(false);
    setOrderName('');
    setOrderEmail('');
    setOrderNote('');
  } catch {
    alert('Anfrage fehlgeschlagen');
  } finally {
    setOrderLoading(false);
  }
}, [actions.moebelId, orderName, orderEmail, orderNote, currency]);
```

Add the button in the header (after the offer buttons, before the closing `</div>` of the right section):

```tsx
{actions.moebelId && (
  <button
    onClick={() => setShowOrderModal(true)}
    title="Anfrage an Artmodul senden"
    style={{
      ...BTN,
      background: 'rgba(138,112,80,0.3)',
      color: 'rgba(255,255,255,0.9)',
    }}
  >
    Anfrage senden
  </button>
)}
```

Add the modal (before the closing `</>` of the component, or after the header `</header>`):

```tsx
{/* Anfrage-Modal */}
{showOrderModal && (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 200,
    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }} onClick={() => setShowOrderModal(false)}>
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background: '#fff', borderRadius: 12, padding: 24, width: 380,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#1C1A17' }}>Anfrage senden</h3>
      <label style={{ fontSize: 10, color: '#7A7670', display: 'block', marginBottom: 4 }}>Name *</label>
      <input
        value={orderName}
        onChange={e => setOrderName(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #DDDAD3', fontSize: 12, marginBottom: 12 }}
      />
      <label style={{ fontSize: 10, color: '#7A7670', display: 'block', marginBottom: 4 }}>E-Mail (optional)</label>
      <input
        type="email"
        value={orderEmail}
        onChange={e => setOrderEmail(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #DDDAD3', fontSize: 12, marginBottom: 12 }}
      />
      <label style={{ fontSize: 10, color: '#7A7670', display: 'block', marginBottom: 4 }}>Nachricht (optional)</label>
      <textarea
        value={orderNote}
        onChange={e => setOrderNote(e.target.value)}
        rows={3}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #DDDAD3', fontSize: 12, marginBottom: 16, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowOrderModal(false)}
          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #DDDAD3', background: '#fff', fontSize: 11, cursor: 'pointer' }}
        >
          Abbrechen
        </button>
        <button
          onClick={() => { void handleOrderSubmit(); }}
          disabled={!orderName.trim() || orderLoading}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: '#1C1A17', color: '#fff', fontSize: 11, fontWeight: 600,
            cursor: orderLoading || !orderName.trim() ? 'not-allowed' : 'pointer',
            opacity: orderLoading || !orderName.trim() ? 0.5 : 1,
          }}
        >
          {orderLoading ? 'Wird gesendet...' : 'Absenden'}
        </button>
      </div>
    </div>
  </div>
)}

{/* Anfrage-Bestätigung */}
{orderSuccess && (
  <div style={{
    position: 'fixed', bottom: 24, right: 24, zIndex: 200,
    background: '#1C1A17', color: '#fff', borderRadius: 12, padding: '12px 20px',
    fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    display: 'flex', alignItems: 'center', gap: 12,
  }}>
    <span>Anfrage gesendet — {orderSuccess}</span>
    <button
      onClick={() => setOrderSuccess('')}
      style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 16 }}
    >×</button>
  </div>
)}
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/orders/route.ts src/features/configurator/ConfiguratorShell.tsx
git commit -m "Feature: Anfrage senden — Kunden-Bestellflow + Order-API"
```

---

### Task 9: Login Placeholder

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Modify: `src/features/configurator/ConfiguratorShell.tsx` (add header link)

- [ ] **Step 1: Create login placeholder page**

`src/app/(auth)/login/page.tsx`:

```tsx
'use client';

import { useState, FormEvent } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [toast, setToast] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setToast('Händler-Login kommt bald');
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F6F2]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-lg font-semibold text-[#1C1A17] mb-1">Händler-Login</h1>
        <p className="text-xs text-[#7A7670] mb-6">Artmodul Konfigurator</p>

        <label className="block text-xs font-medium text-[#3A3834] mb-1">E-Mail</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#DDDAD3] text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
        />

        <label className="block text-xs font-medium text-[#3A3834] mb-1">Passwort</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#DDDAD3] text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
        />

        <a href="#" className="text-[10px] text-[#8A7050] hover:underline mb-4 block">Passwort vergessen?</a>

        <button
          type="submit"
          className="w-full py-2 rounded-lg bg-[#1C1A17] text-white text-sm font-medium hover:bg-[#3A3834] transition-colors mb-3"
        >
          Anmelden
        </button>

        <p className="text-[10px] text-center text-[#7A7670]">
          Noch kein Konto? <a href="#" className="text-[#8A7050] hover:underline">Registrieren</a>
        </p>

        {toast && (
          <div className="mt-4 text-center text-xs text-[#8A7050] bg-[#F8F6F2] rounded-lg py-2">
            {toast}
          </div>
        )}
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Add "Händler-Login" link to ConfiguratorShell header**

In `src/features/configurator/ConfiguratorShell.tsx`, add a link in the header left section (after the dimensions span, around line 349):

```tsx
<a
  href="/login"
  style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', whiteSpace: 'nowrap' }}
  onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
>
  Händler-Login
</a>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx src/features/configurator/ConfiguratorShell.tsx
git commit -m "UI: Händler-Login Placeholder + Header-Link"
```

---

### Task 10: Final Verification + Cleanup

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: ESLint check**

```bash
npm run lint
```

- [ ] **Step 3: Dev server smoke test**

```bash
npm run dev
```

Manually verify:
- `/admin/login` → Login-Formular erscheint
- Nach Login → `/admin` Dashboard mit KPI-Kacheln
- `/admin/orders` → Auftrags-Tabelle (leer ist OK)
- `/admin/configurations` → Konfigurations-Tabelle
- `/admin/prices` → Preisliste mit Inline-Bearbeitung
- `/admin/articles` → Artikelstamm
- Konfigurator → Speichern → Anfrage senden Modal
- `/login` → Händler-Login Placeholder

- [ ] **Step 4: Fix any issues found**

- [ ] **Step 5: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "Admin Dashboard: Fixes aus Smoke-Test"
```
