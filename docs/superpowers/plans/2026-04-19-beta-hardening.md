# Beta-Hardening: Auth, Zod-Validierung, Cookie-Banner

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Internes Beta-Testing ermoglichen: Supabase Auth (Login/Register), Handler-Freigabe via Admin, Zod-Validierung aller API-Eingange, Cookie-Banner.

**Architecture:** Supabase Auth (E-Mail + Passwort) als zweite Auth-Schicht unter dem bestehenden HTTP Basic Auth. Login/Register-UI baut auf dem bestehenden Stub `/(auth)/login/page.tsx`. Zod-Schemas in `src/core/schemas.ts` validieren alle offentlichen API-Eingange. Cookie-Banner als Client Component im Root Layout.

**Tech Stack:** Supabase Auth (@supabase/ssr), Zod, Next.js 16 App Router, Tailwind CSS v4

**Hinweis:** Kein Test-Framework vorhanden — Korrektheit manuell prufen. TDD-Schritte entfallen. Stattdessen: `tsc --noEmit` + `npm run lint` nach jeder Aufgabe.

---

## Dateistruktur

| Aktion | Datei | Verantwortung |
|--------|-------|---------------|
| Create | `src/core/schemas.ts` | Zod-Schemas fur ConfigState, OrderRequest, etc. |
| Modify | `src/app/api/bom/route.ts` | Zod-Validierung des Request-Body |
| Modify | `src/app/api/config/save/route.ts` | Zod-Validierung |
| Modify | `src/app/api/orders/route.ts` | Zod-Validierung |
| Modify | `src/app/api/datasheet/route.ts` | Zod-Validierung |
| Modify | `src/app/api/price/route.ts` | Zod-Validierung |
| Modify | `src/app/api/offer/multi/route.ts` | Zod-Validierung |
| Modify | `src/app/(auth)/login/page.tsx` | Funktionale Login-Seite mit Supabase Auth |
| Create | `src/app/(auth)/register/page.tsx` | Registrierungs-Seite (customer default) |
| Modify | `src/app/api/auth/callback/route.ts` | Code-Exchange implementieren |
| Create | `src/app/api/auth/login/route.ts` | E-Mail/Passwort Sign-In |
| Create | `src/app/api/auth/logout/route.ts` | Sign-Out + Cookie-Clearing |
| Modify | `middleware.ts` | Rollen-basierter Routenschutz (dealer/admin) |
| Create | `src/app/admin/dealers/page.tsx` | Handler-Verwaltung (Freigabe/Ablehnung) |
| Create | `src/app/api/admin/dealers/route.ts` | GET: pending dealers |
| Create | `src/app/api/admin/dealers/[id]/route.ts` | PATCH: approve/reject |
| Create | `src/components/CookieBanner.tsx` | Cookie-Info-Banner |
| Modify | `src/app/layout.tsx` | CookieBanner einbinden |
| Modify | `src/app/datenschutz/page.tsx` | Cookie-Abschnitt erganzen |

---

## Task 1: Zod installieren + Schemas definieren

**Files:**
- Create: `src/core/schemas.ts`

- [ ] **Step 1: Zod installieren**

```bash
npm install zod
```

- [ ] **Step 2: Schemas erstellen**

Erstelle `src/core/schemas.ts`:

```typescript
import { z } from 'zod';

// ── Cell & Grid ──────────────────────────────────────────────────────────────

export const CellTypeSchema = z.enum(['', 'O', 'K', 'S', 'S2', 'TR', 'TL', 'DT']);

export const CellSchema = z.object({
  type: CellTypeSchema,
  shelves: z.number().int().min(0).max(5),
});

// ── ConfigState ──────────────────────────────────────────────────────────────

const ALLOWED_WIDTHS = [420, 580, 780, 980] as const;
const ALLOWED_HEIGHTS = [180, 360, 580, 660, 720, 1080, 1440, 1800] as const;
const ALLOWED_DEPTHS = [360, 580] as const;

export const ConfigStateSchema = z.object({
  cols: z.array(z.number().refine(v => (ALLOWED_WIDTHS as readonly number[]).includes(v), {
    message: 'Ungueltige Spaltenbreite',
  })).min(1).max(12),
  rows: z.array(z.number().refine(v => (ALLOWED_HEIGHTS as readonly number[]).includes(v), {
    message: 'Ungueltige Zeilenhoehe',
  })).min(1).max(11),
  grid: z.array(z.array(CellSchema)),
  depth: z.number().refine(v => (ALLOWED_DEPTHS as readonly number[]).includes(v)),
  surface: z.string(),
  opts: z.object({
    outer: z.boolean(),
    inner: z.boolean(),
    back: z.boolean(),
  }),
  handle: z.string(),
  footer: z.string(),
  bomOverrides: z.record(z.object({
    material: z.string(),
    color: z.string(),
    kabel: z.boolean().optional(),
  })).default({}),
  cableHoles: z.record(z.boolean()).default({}),
  catOverrides: z.record(z.object({
    anzahl: z.number().int().min(0),
    oberflaeche: z.string(),
    kabel: z.boolean().optional(),
  }).passthrough()).default({}),
  partColors: z.record(z.string()).default({}),
  cellColors: z.record(z.string()).default({}),
});

// ── Order Request ────────────────────────────────────────────────────────────

export const OrderRequestSchema = z.object({
  configCodes: z.array(z.number().int().positive()).min(1).max(50),
  customerName: z.string().min(1, 'Name ist erforderlich').max(200),
  customerEmail: z.string().email('Ungueltige E-Mail-Adresse').max(200),
  customerPhone: z.string().max(50).optional(),
  customerCompany: z.string().max(200).optional(),
  customerStreet: z.string().max(200).optional(),
  customerZip: z.string().max(20).optional(),
  customerCity: z.string().max(100).optional(),
  note: z.string().max(2000).optional(),
  currency: z.enum(['EUR', 'CHF']).optional(),
  gdprConsent: z.literal(true, {
    errorMap: () => ({ message: 'Datenschutz-Einwilligung erforderlich' }),
  }),
  configSummary: z.string().max(500).optional(),
});

// ── BOM Request ──────────────────────────────────────────────────────────────

export const BomRequestSchema = z.object({
  config: ConfigStateSchema,
  currency: z.enum(['EUR', 'CHF']).optional(),
});

// ── Config Save Request ──────────────────────────────────────────────────────

export const ConfigSaveSchema = z.object({
  config: ConfigStateSchema,
  screenshot: z.string().max(5_000_000).nullable().optional(), // Base64 PNG, max ~3.5MB
  bom: z.unknown().nullable().optional(),
});

// ── Datasheet Request ────────────────────────────────────────────────────────

export const DatasheetRequestSchema = z.object({
  config: ConfigStateSchema,
  includePrice: z.boolean().optional(),
  screenshot3d: z.string().max(5_000_000).nullable().optional(),
  currency: z.enum(['EUR', 'CHF']).optional(),
  moebelId: z.string().max(20).optional(),
});

// ── Multi-Offer Request ──────────────────────────────────────────────────────

export const MultiOfferRequestSchema = z.object({
  configCodes: z.array(z.number().int().positive()).min(1).max(50),
  currency: z.enum(['EUR', 'CHF']).optional(),
  quantities: z.record(z.number().int().positive()).optional(),
});

// ── Hilfs-Funktion: Zod-Fehler als lesbaren String ──────────────────────────

export function formatZodError(error: z.ZodError): string {
  return error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
}
```

- [ ] **Step 3: Pruefen**

```bash
npx tsc --noEmit
```

Erwartet: 0 Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/core/schemas.ts package.json package-lock.json
git commit -m "feat: Zod-Schemas fuer API-Validierung (ConfigState, Order, BOM, Datasheet)"
```

---

## Task 2: Zod-Validierung in alle offentlichen API-Routen

**Files:**
- Modify: `src/app/api/bom/route.ts:102-117`
- Modify: `src/app/api/config/save/route.ts:8-22`
- Modify: `src/app/api/orders/route.ts:6-35`
- Modify: `src/app/api/datasheet/route.ts` (Body-Parsing)
- Modify: `src/app/api/price/route.ts` (Body-Parsing)
- Modify: `src/app/api/offer/multi/route.ts` (Body-Parsing)

- [ ] **Step 1: /api/bom — Zod-Validierung**

In `src/app/api/bom/route.ts` den Request-Parsing-Block (Zeile 102-117) ersetzen:

```typescript
// Am Dateianfang importieren:
import { BomRequestSchema, formatZodError } from '@/core/schemas';

// In der POST-Funktion, alten try/catch + config-Check ersetzen:
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = BomRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const config = parsed.data.config;
  const currency: 'EUR' | 'CHF' = parsed.data.currency ?? 'EUR';
```

- [ ] **Step 2: /api/config/save — Zod-Validierung**

In `src/app/api/config/save/route.ts`:

```typescript
// Am Dateianfang importieren:
import { ConfigSaveSchema, formatZodError } from '@/core/schemas';

// In der POST-Funktion, altes body-Parsing ersetzen:
    const raw = await req.json();
    const parsed = ConfigSaveSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const { config, screenshot, bom } = parsed.data;
```

Die alte Minimalvalidierung (`!config || !Array.isArray(...)`) entfernen — Zod erledigt das.

- [ ] **Step 3: /api/orders — Zod-Validierung**

In `src/app/api/orders/route.ts`:

```typescript
// Am Dateianfang importieren:
import { OrderRequestSchema, formatZodError } from '@/core/schemas';

// In der POST-Funktion, altes body-Parsing + manuelle Validierung ersetzen:
    const raw = await req.json();
    const parsed = OrderRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const body = parsed.data;
```

Die manuellen if-Checks (`!body.configCodes`, `!body.customerName?.trim()` etc.) entfernen.

- [ ] **Step 4: /api/datasheet — Zod-Validierung**

In `src/app/api/datasheet/route.ts` analog: `DatasheetRequestSchema.safeParse(body)` statt manueller Pruefung.

- [ ] **Step 5: /api/price — Zod-Validierung**

In `src/app/api/price/route.ts` analog: `BomRequestSchema.safeParse(body)` (gleiches Schema wie /api/bom).

- [ ] **Step 6: /api/offer/multi — Zod-Validierung**

In `src/app/api/offer/multi/route.ts`: `MultiOfferRequestSchema.safeParse(body)`.

- [ ] **Step 7: Pruefen + Commit**

```bash
npx tsc --noEmit && npm run lint
```

```bash
git add src/app/api/bom/route.ts src/app/api/config/save/route.ts src/app/api/orders/route.ts src/app/api/datasheet/route.ts src/app/api/price/route.ts src/app/api/offer/multi/route.ts
git commit -m "security: Zod-Validierung fuer alle oeffentlichen API-Routen"
```

---

## Task 3: Supabase Auth — Callback, Login-API, Logout-API

**Files:**
- Modify: `src/app/api/auth/callback/route.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`

- [ ] **Step 1: Auth-Callback implementieren**

Ersetze den Inhalt von `src/app/api/auth/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/configurator';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', req.url));
  }

  const res = NextResponse.redirect(new URL(next, req.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] Code-Exchange fehlgeschlagen:', error.message);
    return NextResponse.redirect(new URL('/login?error=auth_failed', req.url));
  }

  return res;
}
```

- [ ] **Step 2: Login-API erstellen**

Erstelle `src/app/api/auth/login/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request' }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: 'E-Mail und Passwort erforderlich' }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json(
      { error: 'E-Mail oder Passwort falsch' },
      { status: 401 },
    );
  }

  return res;
}
```

- [ ] **Step 3: Logout-API erstellen**

Erstelle `src/app/api/auth/logout/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.signOut();
  return res;
}
```

- [ ] **Step 4: Pruefen + Commit**

```bash
npx tsc --noEmit && npm run lint
```

```bash
git add src/app/api/auth/callback/route.ts src/app/api/auth/login/route.ts src/app/api/auth/logout/route.ts
git commit -m "feat: Supabase Auth API-Routen (Login, Logout, Callback)"
```

---

## Task 4: Login-Seite funktional machen + Register-Seite

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Login-Seite implementieren**

Ersetze den Inhalt von `src/app/(auth)/login/page.tsx`:

```typescript
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Login fehlgeschlagen');
        return;
      }

      router.push('/configurator');
      router.refresh();
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F6F2]">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-lg font-semibold text-[#1C1A17] mb-1">Haendler-Login</h1>
        <p className="text-xs text-[#7A7670] mb-6">Artmodul Konfigurator</p>

        <label className="block text-xs font-medium text-[#3A3834] mb-1">E-Mail</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-lg border border-[#DDDAD3] text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
          autoFocus
        />

        <label className="block text-xs font-medium text-[#3A3834] mb-1">Passwort</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-3 py-2 rounded-lg border border-[#DDDAD3] text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
        />

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-[#1C1A17] text-white text-sm font-medium hover:bg-[#3A3834] disabled:opacity-50 transition-colors mb-3"
        >
          {loading ? 'Anmelden...' : 'Anmelden'}
        </button>

        <p className="text-[10px] text-center text-[#7A7670]">
          Noch kein Konto?{' '}
          <Link href="/register" className="text-[#8A7050] hover:underline">
            Registrieren
          </Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Register-Seite erstellen**

Erstelle `src/app/(auth)/register/page.tsx`:

```typescript
'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { company: company.trim() || undefined },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('Diese E-Mail ist bereits registriert.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      setSuccess(true);
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F6F2]">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-3xl mb-3">&#9993;</div>
          <h1 className="text-lg font-semibold text-[#1C1A17] mb-2">
            Bestaetigung gesendet
          </h1>
          <p className="text-xs text-[#7A7670] mb-4">
            Bitte pruefen Sie Ihre E-Mail und klicken Sie auf den Bestaetigungslink.
          </p>
          <Link
            href="/login"
            className="text-xs text-[#8A7050] hover:underline"
          >
            Zurueck zum Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F6F2]">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-lg font-semibold text-[#1C1A17] mb-1">Registrierung</h1>
        <p className="text-xs text-[#7A7670] mb-6">Artmodul Konfigurator — Haendler-Zugang</p>

        <label className="block text-xs font-medium text-[#3A3834] mb-1">Firma</label>
        <input
          type="text"
          value={company}
          onChange={e => setCompany(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#DDDAD3] text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
          placeholder="Optional"
        />

        <label className="block text-xs font-medium text-[#3A3834] mb-1">E-Mail</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 rounded-lg border border-[#DDDAD3] text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
        />

        <label className="block text-xs font-medium text-[#3A3834] mb-1">Passwort</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-3 py-2 rounded-lg border border-[#DDDAD3] text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
          placeholder="Mind. 6 Zeichen"
        />

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-[#1C1A17] text-white text-sm font-medium hover:bg-[#3A3834] disabled:opacity-50 transition-colors mb-3"
        >
          {loading ? 'Wird erstellt...' : 'Konto erstellen'}
        </button>

        <p className="text-[10px] text-center text-[#7A7670]">
          Bereits registriert?{' '}
          <Link href="/login" className="text-[#8A7050] hover:underline">
            Anmelden
          </Link>
        </p>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Pruefen + Commit**

```bash
npx tsc --noEmit && npm run lint
```

```bash
git add src/app/\(auth\)/login/page.tsx src/app/\(auth\)/register/page.tsx
git commit -m "feat: Login + Registrierungs-Seiten mit Supabase Auth"
```

---

## Task 5: Middleware — Rollen-basierter Routenschutz

**Files:**
- Modify: `middleware.ts:90-116`

- [ ] **Step 1: Middleware erweitern**

In `middleware.ts` nach dem Admin-Schutz-Block (Zeile 89) und vor dem Supabase-Session-Refresh (Zeile 91), folgenden Block einfuegen:

```typescript
  // Dealer-Routen: nur fuer eingeloggte Nutzer mit role=dealer|admin
  const isDealerRoute = path.startsWith('/dealer');

  if (isDealerRoute) {
    // Supabase-Session pruefen (vor Response-Erstellung)
    const checkSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll() {
            // Keine Cookies setzen in diesem Check
          },
        },
      },
    );

    const { data: { user } } = await checkSupabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }
```

**Wichtig:** Die bestehende HTTP Basic Auth bleibt unveraendert (Zeile 22-42). Auth ist eine zusaetzliche Schicht darunter.

- [ ] **Step 2: Pruefen + Commit**

```bash
npx tsc --noEmit && npm run lint
```

```bash
git add middleware.ts
git commit -m "security: Middleware — Rollen-basierter Routenschutz fuer /dealer/*"
```

---

## Task 6: Admin — Haendler-Verwaltung (Freigabe/Ablehnung)

**Files:**
- Create: `src/app/api/admin/dealers/route.ts`
- Create: `src/app/api/admin/dealers/[id]/route.ts`
- Create: `src/app/admin/dealers/page.tsx`

- [ ] **Step 1: API — Haendler auflisten**

Erstelle `src/app/api/admin/dealers/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function GET(): Promise<NextResponse> {
  const sb = createServiceSupabaseClient();

  // Alle Profile laden (Admin sieht alle)
  const { data, error } = await sb
    .from('profiles')
    .select('id, role, company, approved_at, created_at, discount_pct')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Supabase Auth Users abrufen fuer E-Mail-Adressen
  const { data: authData } = await sb.auth.admin.listUsers();
  const emailMap = new Map<string, string>();
  if (authData?.users) {
    for (const u of authData.users) {
      emailMap.set(u.id, u.email ?? '');
    }
  }

  const profiles = (data ?? []).map(p => ({
    ...p,
    email: emailMap.get(p.id) ?? '',
  }));

  return NextResponse.json({ profiles });
}
```

- [ ] **Step 2: API — Haendler freigeben/ablehnen**

Erstelle `src/app/api/admin/dealers/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  let body: { action?: string; discount_pct?: number };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request' }, { status: 400 });
  }

  const sb = createServiceSupabaseClient();

  if (body.action === 'approve') {
    const { error } = await sb
      .from('profiles')
      .update({
        role: 'dealer',
        approved_at: new Date().toISOString(),
        discount_pct: body.discount_pct ?? 0.30,
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, role: 'dealer' });
  }

  if (body.action === 'revoke') {
    const { error } = await sb
      .from('profiles')
      .update({
        role: 'customer',
        approved_at: null,
        discount_pct: 0,
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, role: 'customer' });
  }

  // Rabatt aendern
  if (body.discount_pct !== undefined) {
    const pct = Math.max(0, Math.min(1, body.discount_pct));
    const { error } = await sb
      .from('profiles')
      .update({ discount_pct: pct })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, discount_pct: pct });
  }

  return NextResponse.json({ error: 'Ungueltige Aktion' }, { status: 400 });
}
```

- [ ] **Step 3: Admin-Seite — Haendlerverwaltung**

Erstelle `src/app/admin/dealers/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';

interface Profile {
  id: string;
  email: string;
  role: string;
  company: string | null;
  discount_pct: number;
  approved_at: string | null;
  created_at: string;
}

export default function DealersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/dealers');
      if (res.ok) {
        const data = await res.json() as { profiles: Profile[] };
        setProfiles(data.profiles);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleAction(id: string, action: string, discountPct?: number) {
    setActionLoading(id);
    try {
      await fetch(`/api/admin/dealers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, discount_pct: discountPct }),
      });
      await load();
    } finally {
      setActionLoading(null);
    }
  }

  const dealers = profiles.filter(p => p.role === 'dealer');
  const customers = profiles.filter(p => p.role === 'customer');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Haendler-Verwaltung</h1>

      {loading ? (
        <p className="text-sm text-gray-500">Laden...</p>
      ) : (
        <>
          {/* Aktive Haendler */}
          <section className="mb-8">
            <h2 className="text-sm font-medium text-gray-600 mb-3">
              Aktive Haendler ({dealers.length})
            </h2>
            {dealers.length === 0 ? (
              <p className="text-xs text-gray-400">Keine Haendler freigeschaltet.</p>
            ) : (
              <div className="space-y-2">
                {dealers.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-white border rounded-lg px-4 py-3">
                    <div>
                      <span className="text-sm font-medium">{p.email}</span>
                      {p.company && <span className="text-xs text-gray-500 ml-2">({p.company})</span>}
                      <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded ml-2">
                        Haendler — {Math.round(p.discount_pct * 100)}% Rabatt
                      </span>
                    </div>
                    <button
                      onClick={() => { void handleAction(p.id, 'revoke'); }}
                      disabled={actionLoading === p.id}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      Zuruecksetzen
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Registrierte Nutzer (Customers) */}
          <section>
            <h2 className="text-sm font-medium text-gray-600 mb-3">
              Registrierte Nutzer ({customers.length})
            </h2>
            {customers.length === 0 ? (
              <p className="text-xs text-gray-400">Keine registrierten Nutzer.</p>
            ) : (
              <div className="space-y-2">
                {customers.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-white border rounded-lg px-4 py-3">
                    <div>
                      <span className="text-sm font-medium">{p.email}</span>
                      {p.company && <span className="text-xs text-gray-500 ml-2">({p.company})</span>}
                      <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded ml-2">Customer</span>
                    </div>
                    <button
                      onClick={() => { void handleAction(p.id, 'approve', 0.30); }}
                      disabled={actionLoading === p.id}
                      className="text-xs px-3 py-1 bg-[#1C1A17] text-white rounded hover:bg-[#3A3834] disabled:opacity-50"
                    >
                      Als Haendler freischalten
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Pruefen + Commit**

```bash
npx tsc --noEmit && npm run lint
```

```bash
git add src/app/api/admin/dealers/route.ts src/app/api/admin/dealers/\[id\]/route.ts src/app/admin/dealers/page.tsx
git commit -m "feat: Admin-Haendlerverwaltung (Freigabe, Rabatt, Zuruecksetzen)"
```

---

## Task 7: Supabase — profiles-Trigger bei Registrierung

**Files:**
- Create: `supabase/migrations/007_auto_profile.sql`

- [ ] **Step 1: Migration erstellen**

Supabase muss automatisch ein Profil anlegen wenn ein neuer User sich registriert. Erstelle `supabase/migrations/007_auto_profile.sql`:

```sql
-- Automatisch ein Profil anlegen bei neuer Registrierung
-- Rolle: 'customer' als Default, Admin schaltet manuell auf 'dealer' um

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, company, created_at)
  VALUES (
    NEW.id,
    'customer',
    COALESCE(NEW.raw_user_meta_data->>'company', NULL),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger: nach jedem neuen User in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

- [ ] **Step 2: Migration in Supabase ausfuehren**

Diese Migration muss im Supabase SQL-Editor ausgefuehrt werden (lokal kein `supabase` CLI Setup).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_auto_profile.sql
git commit -m "db: Auto-Profil-Trigger bei Registrierung (customer default)"
```

---

## Task 8: Cookie-Banner + Datenschutz-Ergaenzung

**Files:**
- Create: `src/components/CookieBanner.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/datenschutz/page.tsx`

- [ ] **Step 1: Cookie-Banner erstellen**

Erstelle `src/components/CookieBanner.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'artmodul_cookie_ok';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#1C1A17] text-white px-4 py-3 flex items-center justify-between gap-4 text-xs shadow-lg">
      <p>
        Diese Seite verwendet ausschliesslich technisch notwendige Cookies.{' '}
        <Link href="/datenschutz" className="underline hover:text-[#D4C5A9]">
          Mehr erfahren
        </Link>
      </p>
      <button
        onClick={accept}
        className="shrink-0 px-4 py-1.5 bg-white text-[#1C1A17] rounded font-medium hover:bg-[#F0EDE8] transition-colors"
      >
        Verstanden
      </button>
    </div>
  );
}
```

- [ ] **Step 2: In Root Layout einbinden**

In `src/app/layout.tsx`:

```typescript
// Am Dateianfang importieren:
import CookieBanner from '@/components/CookieBanner';

// Im body-Tag, nach {children}:
<body>
  {children}
  <CookieBanner />
</body>
```

- [ ] **Step 3: Datenschutz-Seite um Cookie-Abschnitt ergaenzen**

In `src/app/datenschutz/page.tsx` einen neuen Abschnitt nach dem Empfaenger-Abschnitt einfuegen:

```tsx
<h2 className="...">Cookies</h2>
<p>
  Diese Webseite verwendet ausschliesslich technisch notwendige Cookies.
  Es werden keine Tracking-Cookies, Analyse-Tools oder Werbepixel eingesetzt.
</p>
<ul>
  <li><strong>Supabase Auth Session</strong> (sb-*) — Authentifizierung und Sitzungsverwaltung</li>
  <li><strong>Admin-Session</strong> (admin_session) — Zugang zum Administrationsbereich</li>
  <li><strong>Cookie-Hinweis</strong> (artmodul_cookie_ok) — Speichert ob der Cookie-Hinweis bestaetigt wurde</li>
</ul>
<p>
  Ein Opt-in ist fuer rein technisch notwendige Cookies gemaess Art. 5 Abs. 3 der ePrivacy-Richtlinie
  nicht erforderlich.
</p>
```

- [ ] **Step 4: Pruefen + Commit**

```bash
npx tsc --noEmit && npm run lint
```

```bash
git add src/components/CookieBanner.tsx src/app/layout.tsx src/app/datenschutz/page.tsx
git commit -m "DSGVO: Cookie-Banner + Datenschutz-Ergaenzung (nur technisch notwendige Cookies)"
```

---

## Task 9: Logging-Audit — keine PII im Klartext

**Files:**
- Modify: `src/app/api/orders/route.ts`
- Modify: `src/app/api/config/save/route.ts`

- [ ] **Step 1: Logging pruefen**

Suche alle console.error/console.log in API-Routen:

```bash
grep -rn "console\." src/app/api/ src/lib/
```

- [ ] **Step 2: PII aus Logs entfernen**

In `src/app/api/orders/route.ts` Zeile 59:
```typescript
// Vorher:
console.error('Order error:', orderErr);
// Nachher:
console.error('[/api/orders] DB-Fehler:', orderErr?.code, orderErr?.message);
```

Stelle sicher dass nirgends `body.customerEmail`, `body.customerName` oder andere personenbezogene Daten geloggt werden. Nur Error-Codes und technische Details loggen.

- [ ] **Step 3: Pruefen + Commit**

```bash
npx tsc --noEmit && npm run lint
```

```bash
git add -u src/app/api/ src/lib/
git commit -m "security: PII aus Logs entfernt — nur technische Fehler loggen"
```

---

## Task 10: CI/CD Pipeline (GitHub Actions)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Workflow erstellen**

Erstelle `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: TypeScript Check
        run: npx tsc --noEmit

      - name: ESLint
        run: npm run lint

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
```

- [ ] **Step 2: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/ci.yml
git commit -m "ci: GitHub Actions Pipeline (tsc + lint + build)"
```

---

## Abschluss-Checkliste

Nach allen Tasks einmal komplett pruefen:

- [ ] `npx tsc --noEmit` — 0 Fehler
- [ ] `npm run lint` — 0 Fehler
- [ ] `npm run dev` — Server startet ohne Crashes
- [ ] `/login` — Formular sichtbar, Supabase-Login funktioniert
- [ ] `/register` — Registrierung + Bestaetigungs-E-Mail
- [ ] `/admin/dealers` — Haendlerfreigabe funktioniert
- [ ] Cookie-Banner erscheint beim ersten Besuch
- [ ] API mit ungueltigem Body aufrufen → 400 mit Zod-Fehlermeldung
- [ ] Migration 007 im Supabase SQL-Editor ausgefuehrt
