# Kundenverwaltung im Admin-Bereich — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin kann alle registrierten Nutzer verwalten — Stammdaten pflegen, Rolle/Rabatt setzen, Kunden durchsuchen. Ersetzt die bisherige minimale Händlerverwaltung.

**Architecture:** DB-Migration erweitert `profiles` um Adress-/Kontaktfelder. Neue Admin-Seiten (Liste + Detail) ersetzen `/admin/dealers`. API-Routen folgen dem bestehenden Muster (paginiert, Service-Role-Client).

**Tech Stack:** Next.js 16 App Router, Supabase (service_role), TypeScript strict, Tailwind CSS v4

**Hinweis:** Kein Test-Framework vorhanden — `tsc --noEmit` + `npm run lint` nach jeder Aufgabe.

---

## Dateistruktur

| Aktion | Datei | Verantwortung |
|--------|-------|---------------|
| Create | `supabase/migrations/008_profile_fields.sql` | Neue Spalten in profiles |
| Create | `src/app/api/admin/customers/route.ts` | GET Kundenliste (paginiert, filterbar, suchbar) |
| Create | `src/app/api/admin/customers/[id]/route.ts` | GET + PATCH einzelner Kunde |
| Create | `src/app/admin/customers/page.tsx` | Kundenliste UI |
| Create | `src/app/admin/customers/[id]/page.tsx` | Kunden-Detailseite UI |
| Modify | `src/app/admin/layout.tsx` | Sidebar: "Kunden" Link ergänzen |
| Delete | `src/app/admin/dealers/page.tsx` | Ersetzt durch customers |
| Delete | `src/app/api/admin/dealers/route.ts` | Ersetzt durch customers |
| Delete | `src/app/api/admin/dealers/[id]/route.ts` | Ersetzt durch customers |

---

## Task 1: DB-Migration — Profilfelder erweitern

**Files:**
- Create: `supabase/migrations/008_profile_fields.sql`

- [ ] **Step 1: Migration erstellen**

Erstelle `supabase/migrations/008_profile_fields.sql`:

```sql
-- Erweiterte Profilfelder fuer Kundenverwaltung
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'DE';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notes TEXT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/008_profile_fields.sql
git commit -m "db: Profilfelder erweitern (Kontakt, Adresse, Notizen)"
```

- [ ] **Step 3: Migration im Supabase SQL-Editor ausführen**

Diese Migration muss manuell im Supabase Dashboard → SQL Editor ausgeführt werden.

---

## Task 2: API — Kundenliste

**Files:**
- Create: `src/app/api/admin/customers/route.ts`

- [ ] **Step 1: Route erstellen**

Erstelle `src/app/api/admin/customers/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
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
```

- [ ] **Step 2: Prüfen + Commit**

```bash
npx tsc --noEmit && npm run lint
```

```bash
git add src/app/api/admin/customers/route.ts
git commit -m "feat: API — Kundenliste (paginiert, filterbar, suchbar)"
```

---

## Task 3: API — Einzelkunde (GET + PATCH)

**Files:**
- Create: `src/app/api/admin/customers/[id]/route.ts`

- [ ] **Step 1: Route erstellen**

Erstelle `src/app/api/admin/customers/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
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
```

- [ ] **Step 2: Prüfen + Commit**

```bash
npx tsc --noEmit && npm run lint
```

```bash
git add src/app/api/admin/customers/\[id\]/route.ts
git commit -m "feat: API — Einzelkunde GET + PATCH (Stammdaten, Rolle, Rabatt)"
```

---

## Task 4: Kundenliste UI

**Files:**
- Create: `src/app/admin/customers/page.tsx`

- [ ] **Step 1: Seite erstellen**

Erstelle `src/app/admin/customers/page.tsx`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Profile {
  id: string;
  email: string;
  role: string;
  company: string | null;
  contact_name: string | null;
  phone: string | null;
  discount_pct: number;
  created_at: string;
}

interface ApiResponse {
  profiles: Profile[];
  total: number;
  page: number;
  limit: number;
}

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  dealer:   { label: 'Händler',  className: 'bg-green-50 text-green-700' },
  customer: { label: 'Customer', className: 'bg-gray-100 text-gray-600' },
  admin:    { label: 'Admin',    className: 'bg-blue-50 text-blue-700' },
};

const ROLE_OPTIONS = [
  { value: '', label: 'Alle Rollen' },
  { value: 'dealer', label: 'Händler' },
  { value: 'customer', label: 'Customer' },
  { value: 'admin', label: 'Admin' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function CustomersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (role) params.set('role', role);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/customers?${params}`);
      if (res.ok) {
        const data = await res.json() as ApiResponse;
        setProfiles(data.profiles);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, role, search]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1C1A17] mb-6">Kunden</h1>

      {/* Filter + Suche */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1">
          {ROLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setRole(opt.value); setPage(1); }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                role === opt.value
                  ? 'bg-[#1C1A17] text-white'
                  : 'bg-white text-[#7A7670] border border-[#E0DDD7] hover:bg-[#F0EDE7]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
          className="flex gap-2 ml-auto"
        >
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Firma, Name, E-Mail…"
            className="px-3 py-1.5 text-xs rounded-md border border-[#E0DDD7] bg-white w-56 focus:outline-none focus:ring-2 focus:ring-[#8A7050]/40"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs rounded-md bg-[#1C1A17] text-white hover:bg-[#3A3834]"
          >
            Suchen
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
              className="px-2 py-1.5 text-xs text-[#7A7670] hover:text-[#1C1A17]"
            >
              Zurücksetzen
            </button>
          )}
        </form>
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-xl border border-[#EEEBE4] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#EEEBE4] bg-[#FAF9F7]">
              <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Firma</th>
              <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Ansprechpartner</th>
              <th className="text-left px-4 py-3 font-medium text-[#7A7670]">E-Mail</th>
              <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Rolle</th>
              <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Rabatt</th>
              <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Registriert</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#A8A49C]">Laden…</td></tr>
            )}
            {!loading && profiles.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#A8A49C]">Keine Kunden gefunden.</td></tr>
            )}
            {!loading && profiles.map(p => {
              const rc = ROLE_CONFIG[p.role] ?? ROLE_CONFIG.customer;
              return (
                <tr key={p.id} className="border-b border-[#EEEBE4] last:border-0 hover:bg-[#FAF9F7] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${p.id}`} className="text-[#1C1A17] font-medium hover:underline">
                      {p.company || '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#4A4742]">{p.contact_name || '—'}</td>
                  <td className="px-4 py-3 text-[#4A4742]">{p.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${rc.className}`}>
                      {rc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#4A4742]">
                    {p.role === 'dealer' ? `${Math.round(p.discount_pct * 100)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#A8A49C]">{formatDate(p.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginierung */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-[#7A7670]">
          <span>Seite {page} von {totalPages} ({total} Kunden)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-[#E0DDD7] disabled:opacity-30 hover:bg-[#F0EDE7]"
            >
              Zurück
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-[#E0DDD7] disabled:opacity-30 hover:bg-[#F0EDE7]"
            >
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Prüfen + Commit**

```bash
npx tsc --noEmit && npm run lint
```

```bash
git add src/app/admin/customers/page.tsx
git commit -m "feat: Admin-Kundenliste — Tabelle, Rollenfilter, Suche, Paginierung"
```

---

## Task 5: Kunden-Detailseite UI

**Files:**
- Create: `src/app/admin/customers/[id]/page.tsx`

- [ ] **Step 1: Seite erstellen**

Erstelle `src/app/admin/customers/[id]/page.tsx`:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Profile {
  id: string;
  email: string;
  role: string;
  company: string | null;
  contact_name: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  discount_pct: number;
  approved_at: string | null;
  created_at: string;
  notes: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Formular-State
  const [role, setRole] = useState('customer');
  const [discountPct, setDiscountPct] = useState(30);
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('DE');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`);
      if (!res.ok) { router.push('/admin/customers'); return; }
      const data = await res.json() as { profile: Profile };
      const p = data.profile;
      setProfile(p);
      setRole(p.role);
      setDiscountPct(Math.round(p.discount_pct * 100));
      setCompany(p.company ?? '');
      setContactName(p.contact_name ?? '');
      setPhone(p.phone ?? '');
      setStreet(p.street ?? '');
      setZip(p.zip ?? '');
      setCity(p.city ?? '');
      setCountry(p.country ?? 'DE');
      setNotes(p.notes ?? '');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          discount_pct: discountPct / 100,
          company,
          contact_name: contactName,
          phone,
          street,
          zip,
          city,
          country,
          notes,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-[#A8A49C]">Laden…</div>;
  }

  if (!profile) {
    return <div className="text-sm text-[#A8A49C]">Kunde nicht gefunden.</div>;
  }

  const INPUT = 'w-full px-3.5 py-2.5 rounded-lg border border-[#E0DDD7] text-[13px] text-[#1C1A17] bg-[#FAFAF8] focus:outline-none focus:ring-2 focus:ring-[#8A7050]/40 focus:border-[#8A7050] transition-colors';
  const LABEL = 'block text-[11px] font-medium text-[#7A7670] uppercase tracking-widest mb-1.5';

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/admin/customers')}
          className="text-xs text-[#7A7670] hover:text-[#1C1A17]"
        >
          ← Kunden
        </button>
        <h1 className="text-xl font-semibold text-[#1C1A17]">
          {profile.company || profile.email}
        </h1>
      </div>

      {/* Sektion: Konto */}
      <section className="bg-white rounded-xl border border-[#EEEBE4] p-6 mb-4">
        <h2 className="text-xs font-medium text-[#A8A49C] uppercase tracking-widest mb-4">Konto</h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={LABEL}>E-Mail</label>
            <div className="px-3.5 py-2.5 rounded-lg bg-[#F0EDE7] text-[13px] text-[#7A7670]">
              {profile.email}
            </div>
          </div>
          <div>
            <label className={LABEL}>Rolle</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className={INPUT}
            >
              <option value="customer">Customer</option>
              <option value="dealer">Händler</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {role === 'dealer' && (
          <div className="mb-4">
            <label className={LABEL}>Rabatt (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={discountPct}
              onChange={e => setDiscountPct(parseInt(e.target.value) || 0)}
              className={`${INPUT} w-32`}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-[12px] text-[#A8A49C]">
          <div>Registriert: {formatDate(profile.created_at)}</div>
          {profile.approved_at && <div>Freigeschaltet: {formatDate(profile.approved_at)}</div>}
        </div>
      </section>

      {/* Sektion: Stammdaten */}
      <section className="bg-white rounded-xl border border-[#EEEBE4] p-6 mb-4">
        <h2 className="text-xs font-medium text-[#A8A49C] uppercase tracking-widest mb-4">Stammdaten</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Firma</label>
            <input type="text" value={company} onChange={e => setCompany(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Ansprechpartner</label>
            <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Telefon</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Straße</label>
            <input type="text" value={street} onChange={e => setStreet(e.target.value)} className={INPUT} />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <div>
              <label className={LABEL}>PLZ</label>
              <input type="text" value={zip} onChange={e => setZip(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Ort</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} className={INPUT} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Land</label>
            <input type="text" value={country} onChange={e => setCountry(e.target.value)} className={INPUT} />
          </div>
        </div>
      </section>

      {/* Sektion: Intern */}
      <section className="bg-white rounded-xl border border-[#EEEBE4] p-6 mb-6">
        <h2 className="text-xs font-medium text-[#A8A49C] uppercase tracking-widest mb-4">Intern</h2>
        <label className={LABEL}>Notizen</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className={`${INPUT} resize-y`}
          placeholder="Interne Notizen…"
        />
      </section>

      {/* Footer */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { void handleSave(); }}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-[#1C1A17] text-white text-[13px] font-medium hover:bg-[#3A3834] disabled:opacity-40 transition-colors"
        >
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
        {saved && (
          <span className="text-[13px] text-green-700 font-medium">
            Änderungen gespeichert
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Prüfen + Commit**

```bash
npx tsc --noEmit && npm run lint
```

```bash
git add src/app/admin/customers/\[id\]/page.tsx
git commit -m "feat: Admin-Kundendetail — Stammdaten, Rolle, Rabatt bearbeiten"
```

---

## Task 6: Sidebar + Aufräumen

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Delete: `src/app/admin/dealers/page.tsx`
- Delete: `src/app/api/admin/dealers/route.ts`
- Delete: `src/app/api/admin/dealers/[id]/route.ts`

- [ ] **Step 1: Sidebar aktualisieren**

In `src/app/admin/layout.tsx` den `NAV`-Array (Zeile 7–13) ersetzen:

```typescript
const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/orders', label: 'Aufträge' },
  { href: '/admin/customers', label: 'Kunden' },
  { href: '/admin/configurations', label: 'Konfigurationen' },
  { href: '/admin/prices', label: 'Preisliste' },
  { href: '/admin/articles', label: 'Artikelstamm' },
];
```

- [ ] **Step 2: Alte Dealers-Dateien löschen**

```bash
rm src/app/admin/dealers/page.tsx
rm src/app/api/admin/dealers/route.ts
rm src/app/api/admin/dealers/\[id\]/route.ts
rmdir src/app/admin/dealers
rmdir src/app/api/admin/dealers/\[id\]
rmdir src/app/api/admin/dealers
```

- [ ] **Step 3: Prüfen + Commit**

```bash
npx tsc --noEmit && npm run lint
```

```bash
git add -A
git commit -m "feat: Sidebar 'Kunden' ergänzt, alte Dealers-Seiten entfernt"
```

---

## Task 7: Abschluss — tsc + lint + manueller Test

- [ ] **Step 1: Abschließende Prüfung**

```bash
npx tsc --noEmit && npm run lint
```

Erwartet: 0 neue Fehler.

- [ ] **Step 2: Dev-Server starten und manuell testen**

```bash
npm run dev
```

Testmatrix:

| Szenario | Erwartung |
|----------|-----------|
| `/admin` → Sidebar | "Kunden" Link zwischen "Aufträge" und "Konfigurationen" |
| `/admin/customers` | Tabelle mit allen Nutzern, Rollenfilter, Suchfeld |
| Rollenfilter "Händler" | Nur Dealer angezeigt |
| Suche nach Firmenname | Gefilterte Ergebnisse |
| Klick auf Zeile | Detailseite mit allen Feldern |
| Stammdaten bearbeiten + Speichern | "Änderungen gespeichert" Meldung, Daten bleiben |
| Rolle auf "Händler" ändern | Rabatt-Feld erscheint, Speichern setzt approved_at |
| Rolle zurück auf "Customer" | Rabatt-Feld verschwindet, discount_pct = 0 |
| `/admin/dealers` | 404 (gelöscht) |
