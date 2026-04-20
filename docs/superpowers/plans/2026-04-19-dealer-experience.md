# Dealer-Erlebnis im Konfigurator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eingeloggte Händler im Konfigurator erkennen und rollenbasierte Features (Preise, Angebots-PDF, User-Menu) freischalten.

**Architecture:** Neuer React Context (`UserContext`) lädt on-mount Supabase-Session + Profil. Context wird in ConfiguratorShell konsumiert: Header zeigt User-Pill statt Login-Link, BOMPanel zeigt rollenbasierte Preise, PDF-Buttons werden per Rolle ein-/ausgeblendet.

**Tech Stack:** Next.js 16, Supabase Auth (@supabase/ssr), React Context, TypeScript strict

**Hinweis:** Kein Test-Framework vorhanden — Korrektheit manuell prüfen. TDD-Schritte entfallen. Stattdessen: `tsc --noEmit` + `npm run lint` nach jeder Aufgabe.

---

## Dateistruktur

| Aktion | Datei | Verantwortung |
|--------|-------|---------------|
| Create | `src/contexts/UserContext.tsx` | React Context + Provider + `useUser` Hook |
| Modify | `src/features/configurator/ConfiguratorShell.tsx` | Provider einbinden, Login-Link → User-Pill, PDF-Button role-aware |
| Modify | `src/features/bom/BOMPanel.tsx` | PriceSection role-aware (EK+UVP für Dealer, UVP für Admin, nichts für Guest) |

---

## Task 1: UserContext erstellen

**Files:**
- Create: `src/contexts/UserContext.tsx`

- [ ] **Step 1: Datei erstellen**

Erstelle `src/contexts/UserContext.tsx`:

```typescript
'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export interface UserInfo {
  id: string;
  email: string;
  role: 'customer' | 'dealer' | 'admin';
  discountPct: number;
  company: string | null;
}

interface UserContextValue {
  user: UserInfo | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
});

export function useUser(): UserContextValue {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (cancelled || !authUser) { setLoading(false); return; }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, discount_pct, company')
          .eq('id', authUser.id)
          .single();

        if (cancelled) return;

        const role = (profile?.role === 'dealer' || profile?.role === 'admin')
          ? profile.role
          : 'customer' as const;

        setUser({
          id: authUser.id,
          email: authUser.email ?? '',
          role,
          discountPct: profile?.discount_pct ?? 0,
          company: profile?.company ?? null,
        });
      } catch {
        // Session abgelaufen oder Netzwerkfehler — als Gast behandeln
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.refresh();
  }, [router]);

  return (
    <UserContext.Provider value={{ user, loading, logout }}>
      {children}
    </UserContext.Provider>
  );
}
```

- [ ] **Step 2: Prüfen**

```bash
npx tsc --noEmit
```

Erwartet: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/UserContext.tsx
git commit -m "feat: UserContext — Supabase-Session + Profil laden (Rolle, Rabatt)"
```

---

## Task 2: UserProvider in ConfiguratorShell einbinden + User-Pill

**Files:**
- Modify: `src/features/configurator/ConfiguratorShell.tsx`

- [ ] **Step 1: Import hinzufügen**

Am Dateianfang (nach den bestehenden Imports, ca. Zeile 22) hinzufügen:

```typescript
import { UserProvider, useUser } from '@/contexts/UserContext';
```

- [ ] **Step 2: Login-Link durch User-Pill ersetzen**

In `ConfiguratorShellInner()`, den bestehenden Händler-Login-Link (Zeile 449–456):

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

Ersetzen durch:

```tsx
          <UserPill />
```

- [ ] **Step 3: UserPill-Komponente am Dateiende definieren**

Vor dem abschließenden `export default` (oder am Ende der Datei, bei den anderen Hilfskomponenten) hinzufügen:

```typescript
function UserPill() {
  const { user, loading, logout } = useUser();

  if (loading) return null;

  if (!user) {
    return (
      <a
        href="/login"
        style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', whiteSpace: 'nowrap' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
      >
        Händler-Login
      </a>
    );
  }

  const dotColor = user.role === 'dealer' ? '#4ADE80' : user.role === 'admin' ? '#60A5FA' : '#9CA3AF';
  const roleLabel = user.role === 'dealer' ? 'Händler' : user.role === 'admin' ? 'Admin' : null;
  const emailShort = user.email.length > 20 ? user.email.slice(0, 18) + '…' : user.email;
  const discountLabel = user.role === 'dealer' && user.discountPct > 0
    ? `${Math.round(user.discountPct * 100)}%`
    : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderRadius: 20, padding: '3px 12px',
      fontSize: 10, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      {roleLabel && <span style={{ fontWeight: 500 }}>{roleLabel}</span>}
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{emailShort}</span>
      {discountLabel && <span style={{ color: 'rgba(255,255,255,0.5)' }}>·&nbsp;{discountLabel}</span>}
      <button
        onClick={() => { void logout(); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)', fontSize: 10, padding: 0,
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
      >
        Logout
      </button>
    </div>
  );
}
```

- [ ] **Step 4: UserProvider um den Return von ConfiguratorShellInner wrappen**

Den `return (` Block in `ConfiguratorShellInner` (Zeile 369–370):

```tsx
  return (
    <div style={{ width: '100vw', height: 'calc(100vh - 36px)', ...
```

Ersetzen durch:

```tsx
  return (
    <UserProvider>
    <div style={{ width: '100vw', height: 'calc(100vh - 36px)', ...
```

Und am Ende der Funktion (vor dem `)` des return-Statements), nach dem letzten `</div>`:

```tsx
    </UserProvider>
```

**Wichtig:** Die `UserProvider`-Tags umschließen das gesamte `<div>` des Konfigurators.

- [ ] **Step 5: Prüfen**

```bash
npx tsc --noEmit && npm run lint
```

Erwartet: 0 Fehler.

- [ ] **Step 6: Commit**

```bash
git add src/features/configurator/ConfiguratorShell.tsx
git commit -m "feat: User-Pill im Header — zeigt Rolle, E-Mail, Rabatt, Logout"
```

---

## Task 3: PriceSection role-aware machen

**Files:**
- Modify: `src/features/bom/BOMPanel.tsx`

- [ ] **Step 1: Import hinzufügen**

Am Dateianfang (nach den bestehenden Imports) hinzufügen:

```typescript
import { useUser } from '@/contexts/UserContext';
```

- [ ] **Step 2: PriceSection-Signatur anpassen**

Die bestehende `PriceSection`-Funktion (Zeile 949) komplett ersetzen:

```typescript
function PriceSection({
  pricing,
  loading,
  currency,
  onCurrencyChange,
}: {
  pricing: PriceResponse | null;
  loading: boolean;
  currency: 'EUR' | 'CHF';
  onCurrencyChange: (c: 'EUR' | 'CHF') => void;
}) {
  const { user } = useUser();

  const fmt = (v: number) =>
    new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  const vatRate = currency === 'CHF' ? VAT_CH : VAT_DE;
  const currencySymbol = currency === 'CHF' ? 'CHF' : '€';

  // Rollenbasierte Sichtbarkeit: nur Dealer und Admin sehen Preise
  const canSeePrice = user?.role === 'dealer' || user?.role === 'admin';

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #E0DDD7', paddingTop: 12 }}>
      {/* Kopfzeile mit Währungsumschalter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.14em', color: '#A8A49C' }}>
          Preisindikation
        </div>
        {canSeePrice && (
          <div style={{ display: 'flex', gap: 3 }}>
            {(['EUR', 'CHF'] as const).map(c => (
              <button
                key={c}
                onClick={() => onCurrencyChange(c)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  padding: '2px 8px', borderRadius: 0, cursor: 'pointer',
                  border: '1px solid #E0DDD7',
                  background: currency === c ? '#171614' : 'transparent',
                  color: currency === c ? '#FAFAF8' : '#787470',
                }}
              >{c}</button>
            ))}
          </div>
        )}
      </div>

      {/* Nicht eingeloggt / Customer: Hinweis */}
      {!canSeePrice && (
        <div style={{ fontSize: 10, color: '#A8A49C', padding: '6px 0', fontStyle: 'italic' }}>
          Preise sind für registrierte Händler sichtbar.
        </div>
      )}

      {/* Dealer/Admin: Preisanzeige */}
      {canSeePrice && loading && (
        <div style={{ fontSize: 10, color: '#A8A49C', fontFamily: 'var(--font-mono)', padding: '6px 0' }}>
          Preis wird berechnet …
        </div>
      )}

      {canSeePrice && !loading && !pricing && (
        <div style={{ fontSize: 10, color: '#A8A49C', padding: '4px 0' }}>
          —
        </div>
      )}

      {canSeePrice && !loading && pricing && (
        <>
          <div style={{
            padding: '10px 12px',
            background: '#F5F3EE',
            border: '1px solid #E0DDD7',
            borderRadius: 1, marginBottom: 6,
          }}>
            {pricing.price_type === 'EK' ? (
              /* ── Dealer: EK + UVP + Marge ── */
              <>
                {/* EK Netto (Hauptpreis) */}
                <div style={{ fontSize: 9, color: '#A8A49C', marginBottom: 2 }}>
                  Ihr EK netto
                </div>
                <div style={{ fontSize: 24, fontWeight: 500, color: '#171614', lineHeight: 1 }}>
                  {fmt(pricing.grand_total)}&thinsp;{currencySymbol}
                </div>

                {/* UVP + Marge */}
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #E0DDD7' }}>
                  {(() => {
                    const disc = pricing.active_discount_pct ?? 0;
                    const uvp = disc > 0 ? pricing.grand_total / (1 - disc) : pricing.grand_total;
                    const marge = uvp - pricing.grand_total;
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4A4742', marginBottom: 3 }}>
                          <span>UVP netto</span>
                          <span>{fmt(uvp)}&thinsp;{currencySymbol}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4A8C50', marginBottom: 3 }}>
                          <span>Ihre Marge ({Math.round(disc * 100)}%)</span>
                          <span>{fmt(marge)}&thinsp;{currencySymbol}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* EK Brutto */}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E0DDD7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, color: '#171614' }}>
                    <span>EK brutto (inkl. {currency === 'CHF' ? '8,1' : '19'}&thinsp;%)</span>
                    <span>{fmt(pricing.grand_total * (1 + vatRate))}&thinsp;{currencySymbol}</span>
                  </div>
                </div>
              </>
            ) : (
              /* ── Admin: nur UVP ── */
              <>
                <div style={{ fontSize: 9, color: '#A8A49C', marginBottom: 2 }}>
                  UVP netto
                </div>
                <div style={{ fontSize: 24, fontWeight: 500, color: '#171614', lineHeight: 1 }}>
                  {fmt(pricing.grand_total)}&thinsp;{currencySymbol}
                </div>

                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E0DDD7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, color: '#171614' }}>
                    <span>UVP brutto (inkl. {currency === 'CHF' ? '8,1' : '19'}&thinsp;%)</span>
                    <span>{fmt(pricing.grand_total * (1 + vatRate))}&thinsp;{currencySymbol}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {pricing.missing_items.length > 0 && (
            <div style={{
              padding: '5px 10px', background: '#FBF8EE', border: '1px solid #DDD4B0',
              borderRadius: 1, fontSize: 9, color: '#6A5A30', marginBottom: 4,
            }}>
              <span style={{ fontWeight: 500 }}>Nicht preisbewertet:</span>{' '}
              {pricing.missing_items.slice(0, 3).join(', ')}
              {pricing.missing_items.length > 3 && ` +${pricing.missing_items.length - 3} weitere`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Prüfen**

```bash
npx tsc --noEmit && npm run lint
```

Erwartet: 0 Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/features/bom/BOMPanel.tsx
git commit -m "feat: Preisanzeige role-aware — EK+UVP+Marge für Dealer, UVP für Admin, nichts für Guest"
```

---

## Task 4: PDF-Buttons role-aware + Datasheet includePrice

**Files:**
- Modify: `src/features/configurator/ConfiguratorShell.tsx`

- [ ] **Step 1: useUser im ConfiguratorShellInner aufrufen**

Am Anfang von `ConfiguratorShellInner()` (nach den bestehenden Hooks, ca. Zeile 69):

```typescript
  const { user } = useUser();
  const canSeePrice = user?.role === 'dealer' || user?.role === 'admin';
```

- [ ] **Step 2: Angebots-PDF-Button (FileText) nur für Dealer/Admin sichtbar**

Den bestehenden PDF-Download-Button (Zeile 564–579):

```tsx
          {/* PDF-Download */}
          {actions.moebelId && (
            <button
              onClick={handlePdfDownload}
              disabled={offerLoading}
              title="PDF herunterladen"
              style={{
                ...BTN,
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.65)',
                padding: '4px 8px',
              }}
            >
              <FileText size={12} strokeWidth={2} />
            </button>
          )}
```

Ersetzen durch:

```tsx
          {/* Angebots-PDF — nur Dealer/Admin */}
          {actions.moebelId && canSeePrice && (
            <button
              onClick={handlePdfDownload}
              disabled={offerLoading}
              title="Angebot als PDF"
              style={{
                ...BTN,
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.65)',
                padding: '4px 8px',
              }}
            >
              <FileText size={12} strokeWidth={2} />
              <span style={{ fontSize: 9, letterSpacing: '.04em' }}>Angebot</span>
            </button>
          )}
```

- [ ] **Step 3: Datenblatt-Button für alle sichtbar, includePrice role-aware**

Im `handleDatasheet`-Callback (Zeile 285–310) den `body: JSON.stringify(...)` Aufruf anpassen. Aktuell:

```typescript
        body: JSON.stringify({
          config: state, screenshot3d, currency,
          moebelId: actions.moebelId,
          grandTotal: pricing?.grand_total ?? 0,
        }),
```

Ersetzen durch:

```typescript
        body: JSON.stringify({
          config: state, screenshot3d, currency,
          moebelId: actions.moebelId,
          grandTotal: pricing?.grand_total ?? 0,
          includePrice: canSeePrice,
        }),
```

- [ ] **Step 4: Prüfen**

```bash
npx tsc --noEmit && npm run lint
```

Erwartet: 0 Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/features/configurator/ConfiguratorShell.tsx
git commit -m "feat: PDF-Buttons role-aware — Angebots-PDF nur Dealer/Admin, Datenblatt-Preis optional"
```

---

## Task 5: Sidebar-Preisblock role-aware

**Files:**
- Modify: `src/features/configurator/ConfiguratorShell.tsx`

- [ ] **Step 1: Sidebar-Preisblock im SidebarMoebel prüfen und anpassen**

In ConfiguratorShell gibt es einen Preisblock in der Sidebar (ca. Zeile 1040–1093 — der Bereich mit `pricing?.grand_total`). Suche nach der Stelle, die `pricing` in der Sidebar anzeigt.

Den gesamten Sidebar-Preisblock mit einer `canSeePrice`-Prüfung umschließen:

```tsx
{canSeePrice && pricing && (
  // bestehender Preisblock
)}
```

Falls kein separater Sidebar-Preisblock existiert (nur in BOMPanel), diesen Step überspringen.

- [ ] **Step 2: Prüfen**

```bash
npx tsc --noEmit && npm run lint
```

- [ ] **Step 3: Commit**

```bash
git add src/features/configurator/ConfiguratorShell.tsx
git commit -m "fix: Sidebar-Preisblock nur für Dealer/Admin sichtbar"
```

---

## Task 6: Abschluss — tsc + lint + manueller Test

- [ ] **Step 1: Abschließende Prüfung**

```bash
npx tsc --noEmit && npm run lint
```

Erwartet: 0 Fehler bei beiden.

- [ ] **Step 2: Dev-Server starten und manuell testen**

```bash
npm run dev
```

Testmatrix:

| Szenario | Erwartung |
|----------|-----------|
| Ohne Login → `/configurator` | Login-Link sichtbar, keine Preise, kein Angebots-PDF-Button |
| Als Dealer einloggen → `/configurator` | Pill: "Händler · email · 30% · Logout", EK+UVP+Marge im BOM-Panel, Angebots-PDF-Button sichtbar |
| Als Admin einloggen → `/configurator` | Pill: "Admin · email · Logout", UVP im BOM-Panel, Angebots-PDF-Button sichtbar |
| Logout klicken | Pill verschwindet → Login-Link, Preise weg |
| Datenblatt als Guest | PDF ohne Preise |
| Datenblatt als Dealer | PDF mit Preisen |

- [ ] **Step 3: Abschluss-Commit**

```bash
git add -A
git commit -m "feat: Dealer-Erlebnis im Konfigurator — Session, Preise, PDF, User-Menu"
```
