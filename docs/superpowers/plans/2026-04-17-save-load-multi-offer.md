# Save/Load + Multi-Möbel-Angebot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Konfigurationen mit 8-stelliger ID in Supabase speichern/laden (public, kein Login) und mehrere Möbel zu einem gemeinsamen Angebots-PDF zusammenfassen.

**Architecture:** Neue `saved_configs`-Tabelle (public RLS) + zwei API-Routen (save/load). Warenkorb in localStorage, Multi-PDF via neuer `/api/offer/multi`-Route. Bestehende `configurations`-Tabelle bleibt für Phase 4 Auth unberührt.

**Tech Stack:** Next.js 16 App Router, Supabase (anon client), @react-pdf/renderer, TypeScript strict

---

## File Structure

### Neue Dateien
| Datei | Verantwortung |
|---|---|
| `supabase/migrations/003_saved_configs.sql` | Tabelle `saved_configs` + RLS |
| `supabase/migrations/004_offers.sql` | Tabelle `offers` + RLS |
| `src/app/api/config/save/route.ts` | POST — Config speichern, 8-stellige ID generieren |
| `src/app/api/config/load/route.ts` | GET — Config per Code laden |
| `src/app/api/offer/multi/route.ts` | POST — Multi-Möbel-PDF generieren + Angebots-ID speichern |
| `src/lib/offerCart.ts` | localStorage-Warenkorb Hilfsfunktionen |
| `src/features/pdf/MultiOfferDocument.tsx` | @react-pdf/renderer Komponente für Multi-Möbel-Angebot |

### Geänderte Dateien
| Datei | Änderung |
|---|---|
| `src/features/configurator/useConfigStore.ts` | `moebelId: number \| null`, `setMoebelId()`, `loadConfig()`, `commitBOM()` ohne ID |
| `src/features/configurator/ConfiguratorShell.tsx` | Save-Flow + URL-Parameter + Angebots-Badge + "Zum Angebot"-Button |
| `src/features/bom/BOMPanel.tsx` | Props-Typ `moebelId: number \| null`, Lade-Eingabefeld |
| `src/core/types.ts` | Keine Änderung nötig (ConfigState bleibt gleich) |

---

## Task 1: Datenbank-Migrationen

**Files:**
- Create: `supabase/migrations/003_saved_configs.sql`
- Create: `supabase/migrations/004_offers.sql`

- [ ] **Step 1: Migration für `saved_configs` schreiben**

```sql
-- supabase/migrations/003_saved_configs.sql

CREATE TABLE saved_configs (
  config_code BIGINT PRIMARY KEY,
  config_json JSONB NOT NULL,
  screenshot  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE saved_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON saved_configs
  FOR SELECT USING (true);

CREATE POLICY "Public insert" ON saved_configs
  FOR INSERT WITH CHECK (true);
```

- [ ] **Step 2: Migration für `offers` schreiben**

```sql
-- supabase/migrations/004_offers.sql

CREATE TABLE offers (
  offer_code   BIGINT PRIMARY KEY,
  config_codes BIGINT[] NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON offers
  FOR SELECT USING (true);

CREATE POLICY "Public insert" ON offers
  FOR INSERT WITH CHECK (true);
```

- [ ] **Step 3: Migrationen im Supabase SQL-Editor ausführen**

Beide SQL-Dateien nacheinander im Supabase Dashboard unter SQL Editor ausführen. Verifizieren:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('saved_configs', 'offers');
```
Erwartung: beide Tabellen gelistet.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/003_saved_configs.sql supabase/migrations/004_offers.sql
git commit -m "DB: saved_configs + offers Tabellen (public RLS)"
```

---

## Task 2: useConfigStore — moebelId-Typ + neue Actions

**Files:**
- Modify: `src/features/configurator/useConfigStore.ts`

- [ ] **Step 1: `moebelId`-Typ von `string | null` auf `number | null` ändern**

In der `ConfigActions`-Interface (Zeile 150):

```typescript
// ALT:
moebelId: string | null;

// NEU:
moebelId: number | null;
```

In der State-Initialisierung (Zeile 161):

```typescript
// bleibt gleich, Typ ist bereits kompatibel:
const [moebelId, setMoebelId] = useState<number | null>(null);
```

- [ ] **Step 2: `commitBOM()` — keine lokale ID mehr generieren**

Zeile 475–479 ändern:

```typescript
// ALT:
commitBOM: (bom: BOMResult) => {
  const id = String(Math.floor(100000 + Math.random() * 900000));
  setCommittedBOM(bom);
  setMoebelId(id);
},

// NEU:
commitBOM: (bom: BOMResult) => {
  setCommittedBOM(bom);
  // moebelId wird separat via setMoebelId() gesetzt (nach Server-Save)
},
```

- [ ] **Step 3: Neue Action `setMoebelId` im Interface und Objekt**

Im `ConfigActions`-Interface nach `commitBOM` hinzufügen:

```typescript
setMoebelId(id: number): void;
```

Im `actions`-Objekt nach `commitBOM` hinzufügen:

```typescript
setMoebelId: (id: number) => {
  setMoebelId(id);
},
```

- [ ] **Step 4: Neue Action `loadConfig` im Interface und Objekt**

Im `ConfigActions`-Interface hinzufügen:

```typescript
loadConfig(config: ConfigState): void;
```

Im `actions`-Objekt hinzufügen:

```typescript
loadConfig: (config: ConfigState) => {
  setState(autoResize(config));
  setCommittedBOM(null);
  setMoebelId(null);
  setGravityError(null);
  setFrontTypeWarning(null);
},
```

- [ ] **Step 5: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: Fehler in `BOMPanel.tsx` und `ConfiguratorShell.tsx` wegen `moebelId`-Typ-Änderung (string → number). Diese werden in Task 3 und 5 behoben.

- [ ] **Step 6: Commit**

```bash
git add src/features/configurator/useConfigStore.ts
git commit -m "Store: moebelId number, setMoebelId(), loadConfig(), commitBOM ohne ID"
```

---

## Task 3: API-Route POST /api/config/save

**Files:**
- Create: `src/app/api/config/save/route.ts`

- [ ] **Step 1: Route erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

function generate8DigitCode(): number {
  return Math.floor(10000000 + Math.random() * 90000000);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { config, screenshot } = body;

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

- [ ] **Step 2: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: Route kompiliert sauber.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/config/save/route.ts
git commit -m "API: POST /api/config/save — 8-stellige ID, Supabase-Insert"
```

---

## Task 4: API-Route GET /api/config/load

**Files:**
- Create: `src/app/api/config/load/route.ts`

- [ ] **Step 1: Route erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const codeStr = req.nextUrl.searchParams.get('code');

  if (!codeStr || !/^\d{8}$/.test(codeStr)) {
    return NextResponse.json({ error: 'Ungültiger Code (8-stellige Zahl erwartet)' }, { status: 400 });
  }

  const code = parseInt(codeStr, 10);
  const supabase = createServiceSupabaseClient();

  const { data, error } = await supabase
    .from('saved_configs')
    .select('config_json')
    .eq('config_code', code)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Konfiguration nicht gefunden' }, { status: 404 });
  }

  return NextResponse.json({ config: data.config_json });
}
```

- [ ] **Step 2: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: Route kompiliert sauber.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/config/load/route.ts
git commit -m "API: GET /api/config/load — Config per 8-stelligem Code laden"
```

---

## Task 5: ConfiguratorShell — Save-Flow + URL-Parameter

**Files:**
- Modify: `src/features/configurator/ConfiguratorShell.tsx`

- [ ] **Step 1: Import für `useSearchParams` und `useRouter` hinzufügen**

Am Anfang der Imports ergänzen:

```typescript
import { useSearchParams, useRouter } from 'next/navigation';
```

- [ ] **Step 2: `handleCommit` erweitern — Server-Save + Screenshot**

Den bestehenden `handleCommit` (Zeile 95–98) ersetzen:

```typescript
const [saveLoading, setSaveLoading] = useState(false);

const handleCommit = useCallback(async () => {
  if (!bom) return;
  setSaveLoading(true);
  try {
    actions.commitBOM(bom);
    const screenshot = preview3DRef.current
      ? await preview3DRef.current.captureScreenshot(1600, 900)
      : undefined;
    const res = await fetch('/api/config/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: state, screenshot }),
    });
    if (!res.ok) throw new Error('Save failed');
    const { code } = await res.json();
    actions.setMoebelId(code);
  } catch {
    alert('Speichern fehlgeschlagen');
  } finally {
    setSaveLoading(false);
  }
}, [bom, actions, state]);
```

- [ ] **Step 3: Speichern-Button — Loading-State**

Den Speichern-Button aktualisieren (aktuell Zeile 247–259):

```typescript
<button
  onClick={() => { void handleCommit(); }}
  disabled={!bom || saveLoading}
  title="Konfiguration speichern"
  style={{
    ...BTN,
    background: 'rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.85)',
    opacity: !bom || saveLoading ? 0.3 : 1,
  }}
>
  <Save size={12} strokeWidth={2} />
  {saveLoading ? '...' : 'Speichern'}
</button>
```

- [ ] **Step 4: URL-Parameter Laden beim Mount**

Innerhalb der `ConfiguratorShell`-Funktion, nach den bestehenden `useEffect`-Hooks:

```typescript
const searchParams = useSearchParams();
const router = useRouter();

useEffect(() => {
  const configCode = searchParams.get('config');
  if (!configCode || !/^\d{8}$/.test(configCode)) return;

  fetch(`/api/config/load?code=${configCode}`)
    .then(res => {
      if (!res.ok) return;
      return res.json();
    })
    .then(data => {
      if (data?.config) {
        actions.loadConfig(data.config);
        // URL bereinigen (kein Reload-Loop)
        router.replace('/', { scroll: false });
      }
    })
    .catch(() => {
      // Fehler ignorieren — normaler leerer Konfigurator
    });
  // Nur beim initialen Mount ausführen
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 5: Möbel-ID-Anzeige + Copy in der Header-Leiste**

Nach dem Speichern-Button, vor dem XLS-Button einfügen:

```typescript
{actions.moebelId && (
  <button
    onClick={() => { void navigator.clipboard.writeText(String(actions.moebelId)); }}
    title="Möbel-ID kopieren"
    style={{
      ...BTN,
      background: 'rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.65)',
      fontSize: 11,
      fontVariantNumeric: 'tabular-nums',
    }}
  >
    #{actions.moebelId}
  </button>
)}
```

- [ ] **Step 6: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler (nach BOMPanel-Fix in Task 6).

- [ ] **Step 7: Commit**

```bash
git add src/features/configurator/ConfiguratorShell.tsx
git commit -m "UI: Save-Flow mit Server-Persistenz + URL-Parameter Laden"
```

---

## Task 6: BOMPanel — moebelId-Typ + Lade-Eingabefeld

**Files:**
- Modify: `src/features/bom/BOMPanel.tsx`

- [ ] **Step 1: Props-Interface — `moebelId`-Typ anpassen**

```typescript
// ALT (Zeile 21):
moebelId: string | null;

// NEU:
moebelId: number | null;
```

- [ ] **Step 2: Alle `moebelId`-Referenzen prüfen**

`moebelId` wird in BOMPanel an folgenden Stellen verwendet:
- Zeile ~120: XLS-Export — `actions.moebelId ?? ts` → wird jetzt `number | undefined`, muss zu String: `String(moebelId)` oder `moebelId?.toString() ?? ts`
- Zeile ~553-571: Möbel-ID-Badge-Anzeige — `String(moebelId)` verwenden

Jede Stelle, die `moebelId` als String nutzt, mit `String(moebelId)` wrappen.

- [ ] **Step 3: Lade-Eingabefeld hinzufügen**

Neben der Möbel-ID-Anzeige (oder im Header-Bereich des BOMPanel) ein Eingabefeld + Button einfügen. Falls BOMPanel nicht mehr das primäre UI für die Möbel-ID ist (ConfiguratorShell hat das übernommen), dann das Lade-Eingabefeld in der ConfiguratorShell platzieren.

In `ConfiguratorShell.tsx` am Ende der rechten Header-Buttons ergänzen:

```typescript
const [loadCode, setLoadCode] = useState('');
const [loadError, setLoadError] = useState('');

const handleLoad = useCallback(async () => {
  if (!/^\d{8}$/.test(loadCode)) {
    setLoadError('8-stellige Zahl eingeben');
    return;
  }
  try {
    const res = await fetch(`/api/config/load?code=${loadCode}`);
    if (!res.ok) { setLoadError('Nicht gefunden'); return; }
    const data = await res.json();
    if (data?.config) {
      actions.loadConfig(data.config);
      setLoadCode('');
      setLoadError('');
    }
  } catch {
    setLoadError('Ladefehler');
  }
}, [loadCode, actions]);
```

UI im Header (nach dem PDF-Button):

```typescript
<div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
  <input
    value={loadCode}
    onChange={e => { setLoadCode(e.target.value.replace(/\D/g, '').slice(0, 8)); setLoadError(''); }}
    placeholder="ID laden"
    maxLength={8}
    style={{
      width: 80, padding: '5px 8px', borderRadius: 6, border: 'none',
      background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)',
      fontSize: 11, fontFamily: 'var(--font-sans)', fontVariantNumeric: 'tabular-nums',
      outline: 'none',
    }}
  />
  <button
    onClick={() => { void handleLoad(); }}
    disabled={loadCode.length !== 8}
    style={{
      ...BTN,
      background: 'rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.85)',
      opacity: loadCode.length === 8 ? 1 : 0.3,
      padding: '5px 10px',
    }}
  >
    Laden
  </button>
  {loadError && (
    <span style={{ fontSize: 9, color: '#e57373' }}>{loadError}</span>
  )}
</div>
```

- [ ] **Step 4: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

- [ ] **Step 5: Manueller Test**

Run: `npm run dev`
1. Möbel konfigurieren → Speichern → 8-stellige ID erscheint
2. ID kopieren → Seite neu laden → ID in Eingabefeld einfügen → Laden → Möbel wird wiederhergestellt
3. URL testen: `http://localhost:3000/?config=<ID>` → Möbel wird geladen

- [ ] **Step 6: Commit**

```bash
git add src/features/bom/BOMPanel.tsx src/features/configurator/ConfiguratorShell.tsx
git commit -m "UI: Möbel-ID Typ number + Lade-Eingabefeld + manueller Test OK"
```

---

## Task 7: offerCart — localStorage-Warenkorb

**Files:**
- Create: `src/lib/offerCart.ts`

- [ ] **Step 1: Modul erstellen**

```typescript
const STORAGE_KEY = 'artmodul_offer_items';

function read(): number[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((v): v is number => typeof v === 'number');
  } catch {
    return [];
  }
}

function write(items: number[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getOfferItems(): number[] {
  return read();
}

export function addOfferItem(code: number): void {
  const items = read();
  if (!items.includes(code)) {
    write([...items, code]);
  }
}

export function removeOfferItem(code: number): void {
  write(read().filter(c => c !== code));
}

export function clearOfferItems(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getOfferCount(): number {
  return read().length;
}
```

- [ ] **Step 2: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/lib/offerCart.ts
git commit -m "Lib: offerCart — localStorage-Warenkorb für Multi-Möbel"
```

---

## Task 8: MultiOfferDocument — PDF-Komponente

**Files:**
- Create: `src/features/pdf/MultiOfferDocument.tsx`

- [ ] **Step 1: Typen und Imports definieren**

```typescript
import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import type { BOMResult, ConfigState, DimMap } from '@/core/types';
import { HANDLE_BY_V, FOOTER_BY_V, MAT_BY_V } from '@/core/constants';
import { TechnicalDrawingView } from './TechnicalDrawing';

export interface OfferItem {
  configCode: number;
  config: ConfigState;
  bom: BOMResult;
  screenshot: string | null;
  netPrice: number;         // 0 wenn kein Preis (Customer)
}

interface MultiOfferDocumentProps {
  items: OfferItem[];
  offerCode: number;
  currency: 'EUR' | 'CHF';
  showPrices: boolean;       // false für Customer
}
```

- [ ] **Step 2: Styles definieren**

```typescript
const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#2A2A2A',
    backgroundColor: '#FAFAF8',
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0DDD8',
  },
  logoRow: { flexDirection: 'row' },
  logoArt: { fontSize: 18, fontFamily: 'Helvetica', color: '#2A2A2A', letterSpacing: 3 },
  logoModul: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#2A2A2A', letterSpacing: 3 },
  headerRight: { alignItems: 'flex-end' },
  headerMeta: { fontSize: 8, color: '#999' },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#2A2A2A', marginBottom: 16 },
  // Übersichtstabelle
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#CCC',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.25,
    borderBottomColor: '#E8E5E0',
  },
  colPos: { width: 30, fontSize: 8 },
  colId: { width: 70, fontSize: 8, fontVariantNumeric: 'tabular-nums' as const },
  colMasse: { width: 120, fontSize: 8 },
  colBez: { flex: 1, fontSize: 8 },
  colPreis: { width: 80, fontSize: 8, textAlign: 'right' },
  headText: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#666', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  // Summenblock
  sumBlock: { marginTop: 12, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#CCC' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  sumLabel: { fontSize: 9, color: '#666' },
  sumValue: { fontSize: 9, fontVariantNumeric: 'tabular-nums' as const },
  sumGross: { fontSize: 13, fontFamily: 'Helvetica-Bold' },
  // Detailseite
  renderingWrap: { marginBottom: 12, borderRadius: 4, overflow: 'hidden' },
  renderingImage: { width: '100%', height: 200, objectFit: 'contain' as const },
  drawingWrap: { marginBottom: 8 },
  kpiRow: { flexDirection: 'row', marginBottom: 8, gap: 4 },
  kpiValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  kpiLabel: { fontSize: 7, color: '#999', textTransform: 'uppercase' as const },
  bomTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  bomTableHead: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#CCC',
    paddingBottom: 3,
    marginBottom: 2,
  },
  bomTableRow: {
    flexDirection: 'row',
    paddingVertical: 2,
    borderBottomWidth: 0.25,
    borderBottomColor: '#E8E5E0',
  },
  bomColPos: { width: 24, fontSize: 8 },
  bomColBez: { flex: 1, fontSize: 8 },
  bomColQty: { width: 36, fontSize: 8, textAlign: 'right' },
  bomHeadText: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#666' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#BBB' },
});
```

- [ ] **Step 3: Hilfs-Funktionen und Header/Footer**

```typescript
function fmt(v: number, sym: string): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + '\u202f' + sym;
}

function getActiveDimensions(config: ConfigState) {
  const { rows, cols, grid } = config;
  let minR = rows.length, maxR = -1, minC = cols.length, maxC = -1;
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < cols.length; c++)
      if (grid[r]?.[c]?.type && grid[r][c].type !== '') {
        if (r < minR) minR = r; if (r > maxR) maxR = r;
        if (c < minC) minC = c; if (c > maxC) maxC = c;
      }
  if (maxR < 0) return { w: 0, h: 0, cells: 0 };
  const w = cols.slice(minC, maxC + 1).reduce((a, b) => a + b, 0);
  const h = rows.slice(minR, maxR + 1).reduce((a, b) => a + b, 0);
  let cells = 0;
  for (let r = minR; r <= maxR; r++)
    for (let c = minC; c <= maxC; c++)
      if (grid[r]?.[c]?.type && grid[r][c].type !== '') cells++;
  return { w, h, cells };
}

function describeMoebel(config: ConfigState): string {
  const dims = getActiveDimensions(config);
  const matObj = MAT_BY_V[config.surface];
  const matName = matObj?.l ?? 'Keine Oberfläche';
  return `${matName} · ${config.depth} mm Tiefe`;
}

function OfferHeader({ offerCode, ts }: { offerCode: number; ts: string }) {
  return (
    <View style={S.header}>
      <View style={S.logoRow}>
        <Text style={S.logoArt}>ART</Text>
        <Text style={S.logoModul}>MODUL</Text>
      </View>
      <View style={S.headerRight}>
        <Text style={S.headerMeta}>{ts}</Text>
        <Text style={S.headerMeta}>Angebot #{offerCode}</Text>
      </View>
    </View>
  );
}

function OfferFooter({ ts }: { ts: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>ARTMODUL by MHZ</Text>
      <Text style={S.footerText}>{ts}</Text>
    </View>
  );
}
```

- [ ] **Step 4: BOM-Aggregation für Detailseiten**

```typescript
interface BomDisplayItem {
  bezeichnung: string;
  dim_key: string;
  qty: number;
}

function buildBomDisplayItems(bom: BOMResult): BomDisplayItem[] {
  const map = new Map<string, BomDisplayItem>();
  const addEntries = (entries: DimMap, bezeichnung: string) => {
    for (const [dim, qty] of Object.entries(entries)) {
      if (qty <= 0) continue;
      const key = `${bezeichnung}|${dim}`;
      const existing = map.get(key);
      if (existing) { existing.qty += qty; }
      else { map.set(key, { bezeichnung, dim_key: dim, qty }); }
    }
  };
  if (bom.seite_aussen) addEntries(bom.seite_aussen, 'Seitenwand außen');
  if (bom.seite_aussen_sy32) addEntries(bom.seite_aussen_sy32, 'Seitenwand außen SY32');
  if (bom.seite_innen) addEntries(bom.seite_innen, 'Seitenwand innen');
  if (bom.seite_innen_sy32) addEntries(bom.seite_innen_sy32, 'Seitenwand innen SY32');
  if (bom.boden) addEntries(bom.boden, 'Boden/Deckel');
  if (bom.klappenboden) addEntries(bom.klappenboden, 'Klappenboden');
  if (bom.ruecken) addEntries(bom.ruecken, 'Rückwand');
  if (bom.fachboden) addEntries(bom.fachboden, 'Fachboden');
  if (bom.front_K) addEntries(bom.front_K, 'Klappe');
  if (bom.front_S) addEntries(bom.front_S, 'Schublade');
  if (bom.front_TR) addEntries(bom.front_TR, 'Tür rechts');
  if (bom.front_TL) addEntries(bom.front_TL, 'Tür links');
  if (bom.front_DT) addEntries(bom.front_DT, 'Doppeltür');
  if (bom.profil) addEntries(bom.profil, 'Profil');
  if (bom.griff) addEntries(bom.griff, 'Griff');
  if (bom.fuss) addEntries(bom.fuss, 'Fuß');
  return Array.from(map.values());
}
```

- [ ] **Step 5: Hauptkomponente zusammenbauen**

```typescript
export function MultiOfferDocument({ items, offerCode, currency, showPrices }: MultiOfferDocumentProps) {
  const ts = new Date().toLocaleDateString('de-DE');
  const csym = currency === 'CHF' ? 'CHF' : '€';
  const vatRate = currency === 'CHF' ? 0.081 : 0.19;
  const netTotal = items.reduce((sum, it) => sum + it.netPrice, 0);
  const grossTotal = netTotal + netTotal * vatRate;

  return (
    <Document>
      {/* ── Deckblatt ── */}
      <Page size="A4" style={S.page}>
        <OfferHeader offerCode={offerCode} ts={ts} />
        <Text style={S.title}>Angebot</Text>

        {/* Übersichtstabelle */}
        <View style={S.tableHead}>
          <Text style={[S.colPos, S.headText]}>Pos</Text>
          <Text style={[S.colId, S.headText]}>Möbel-ID</Text>
          <Text style={[S.colMasse, S.headText]}>Maße (B×H×T)</Text>
          <Text style={[S.colBez, S.headText]}>Beschreibung</Text>
          {showPrices && <Text style={[S.colPreis, S.headText]}>Einzelpreis</Text>}
        </View>

        {items.map((item, i) => {
          const dims = getActiveDimensions(item.config);
          return (
            <View key={item.configCode} style={S.tableRow} wrap={false}>
              <Text style={S.colPos}>{i + 1}</Text>
              <Text style={S.colId}>{item.configCode}</Text>
              <Text style={S.colMasse}>{dims.w + 30} × {dims.h + 30} × {item.config.depth + 30} mm</Text>
              <Text style={S.colBez}>{describeMoebel(item.config)}</Text>
              {showPrices && <Text style={S.colPreis}>{fmt(item.netPrice, csym)}</Text>}
            </View>
          );
        })}

        {/* Summenblock */}
        {showPrices && netTotal > 0 && (
          <View style={S.sumBlock}>
            <View style={S.sumRow}>
              <Text style={S.sumLabel}>Netto</Text>
              <Text style={S.sumValue}>{fmt(netTotal, csym)}</Text>
            </View>
            <View style={S.sumRow}>
              <Text style={S.sumLabel}>MwSt. {currency === 'CHF' ? '8,1%' : '19%'}</Text>
              <Text style={S.sumValue}>{fmt(netTotal * vatRate, csym)}</Text>
            </View>
            <View style={[S.sumRow, { marginTop: 4 }]}>
              <Text style={S.sumGross}>Brutto</Text>
              <Text style={[S.sumValue, S.sumGross]}>{fmt(grossTotal, csym)}</Text>
            </View>
          </View>
        )}

        <OfferFooter ts={ts} />
      </Page>

      {/* ── Detailseiten ── */}
      {items.map((item, i) => {
        const dims = getActiveDimensions(item.config);
        const bomItems = buildBomDisplayItems(item.bom);
        const matObj = MAT_BY_V[item.config.surface];
        const handleObj = HANDLE_BY_V[item.config.handle];
        const footerObj = FOOTER_BY_V[item.config.footer];

        return (
          <Page key={item.configCode} size="A4" style={S.page}>
            <OfferHeader offerCode={offerCode} ts={ts} />

            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10 }}>
              Pos. {i + 1} — Möbel #{item.configCode}
            </Text>

            {/* 3D-Screenshot */}
            {item.screenshot && (
              <View style={S.renderingWrap}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Image src={item.screenshot as any} style={S.renderingImage} />
              </View>
            )}

            {/* Maßzeichnung */}
            <View style={S.drawingWrap}>
              <TechnicalDrawingView config={item.config} />
            </View>

            {/* Kennzahlen */}
            <View style={S.kpiRow}>
              {[
                { l: 'Breite', v: `${dims.w + 30} mm` },
                { l: 'Höhe', v: `${dims.h + 30} mm` },
                { l: 'Tiefe', v: `${item.config.depth} mm` },
                { l: 'Felder', v: `${dims.cells}` },
                { l: 'Oberfläche', v: matObj?.l ?? 'Keine' },
              ].map(k => (
                <View key={k.l} style={{ flex: 1 }}>
                  <Text style={S.kpiValue}>{k.v}</Text>
                  <Text style={S.kpiLabel}>{k.l}</Text>
                </View>
              ))}
            </View>

            {/* BOM */}
            <Text style={S.bomTitle}>Stückliste</Text>
            <View style={S.bomTableHead}>
              <Text style={[S.bomColPos, S.bomHeadText]}>Pos</Text>
              <Text style={[S.bomColBez, S.bomHeadText]}>Beschreibung</Text>
              <Text style={[S.bomColQty, S.bomHeadText]}>Menge</Text>
            </View>
            {bomItems.map((bItem, bi) => (
              <View key={`${bItem.bezeichnung}-${bItem.dim_key}`} style={S.bomTableRow} wrap={false}>
                <Text style={S.bomColPos}>{bi + 1}</Text>
                <Text style={S.bomColBez}>{bItem.bezeichnung} ({bItem.dim_key})</Text>
                <Text style={S.bomColQty}>{bItem.qty}</Text>
              </View>
            ))}

            {/* Einzelpreis */}
            {showPrices && item.netPrice > 0 && (
              <View style={[S.sumBlock, { marginTop: 8 }]}>
                <View style={S.sumRow}>
                  <Text style={S.sumLabel}>Einzelpreis netto</Text>
                  <Text style={S.sumValue}>{fmt(item.netPrice, csym)}</Text>
                </View>
              </View>
            )}

            <OfferFooter ts={ts} />
          </Page>
        );
      })}
    </Document>
  );
}
```

- [ ] **Step 6: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/features/pdf/MultiOfferDocument.tsx
git commit -m "PDF: MultiOfferDocument — Deckblatt + Detailseiten"
```

---

## Task 9: API-Route POST /api/offer/multi

**Files:**
- Create: `src/app/api/offer/multi/route.ts`

- [ ] **Step 1: Route erstellen**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { computeBOM } from '@/core/calc';
import { MultiOfferDocument } from '@/features/pdf/MultiOfferDocument';
import type { OfferItem } from '@/features/pdf/MultiOfferDocument';
import type { ConfigState } from '@/core/types';
import React from 'react';

export const runtime = 'nodejs';

function generate8DigitCode(): number {
  return Math.floor(10000000 + Math.random() * 90000000);
}

export async function POST(req: NextRequest) {
  try {
    const { codes, currency = 'EUR' } = await req.json();

    if (!Array.isArray(codes) || codes.length === 0 || codes.length > 20) {
      return NextResponse.json({ error: 'Ungültige Codes (1–20 erwartet)' }, { status: 400 });
    }

    const supabase = createServiceSupabaseClient();

    // Alle Configs laden
    const { data: rows, error } = await supabase
      .from('saved_configs')
      .select('config_code, config_json, screenshot')
      .in('config_code', codes);

    if (error || !rows) {
      return NextResponse.json({ error: 'Laden fehlgeschlagen' }, { status: 500 });
    }

    if (rows.length !== codes.length) {
      const found = new Set(rows.map(r => r.config_code));
      const missing = codes.filter((c: number) => !found.has(c));
      return NextResponse.json({ error: `Nicht gefunden: ${missing.join(', ')}` }, { status: 404 });
    }

    // TODO Phase 4: Rollenbasierte Preise — aktuell showPrices = false
    const showPrices = false;

    // BOM pro Config berechnen
    const items: OfferItem[] = codes.map((code: number) => {
      const row = rows.find(r => r.config_code === code)!;
      const config = row.config_json as ConfigState;
      const bom = computeBOM(config);
      return {
        configCode: code,
        config,
        bom: bom!,
        screenshot: row.screenshot ?? null,
        netPrice: 0, // Preise in Phase 4 ergänzen
      };
    });

    // Angebots-ID generieren und speichern
    let offerCode = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      offerCode = generate8DigitCode();
      const { error: insertErr } = await supabase.from('offers').insert({
        offer_code: offerCode,
        config_codes: codes,
      });
      if (!insertErr) break;
      if (insertErr.code !== '23505') {
        console.error('Offer insert error:', insertErr);
        return NextResponse.json({ error: 'Angebot speichern fehlgeschlagen' }, { status: 500 });
      }
      if (attempt === 2) {
        return NextResponse.json({ error: 'ID-Kollision' }, { status: 500 });
      }
    }

    // PDF rendern
    const buffer = await renderToBuffer(
      React.createElement(MultiOfferDocument, { items, offerCode, currency, showPrices })
    );

    const ts = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Artmodul_Angebot_${offerCode}_${ts}.pdf"`,
        'X-Offer-Code': String(offerCode),
      },
    });
  } catch (e) {
    console.error('Multi-offer error:', e);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
```

- [ ] **Step 2: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/offer/multi/route.ts
git commit -m "API: POST /api/offer/multi — Multi-Möbel-PDF + Angebots-ID"
```

---

## Task 10: Angebots-UI — Badge + Buttons in ConfiguratorShell

**Files:**
- Modify: `src/features/configurator/ConfiguratorShell.tsx`

- [ ] **Step 1: offerCart importieren + React-State für Warenkorb-Count**

```typescript
import { getOfferItems, addOfferItem, removeOfferItem, clearOfferItems, getOfferCount } from '@/lib/offerCart';
import { ShoppingBag } from 'lucide-react';
```

State innerhalb der Komponente:

```typescript
const [offerCount, setOfferCount] = useState(0);
const [offerOpen, setOfferOpen] = useState(false);
const [offerItems, setOfferItems] = useState<number[]>([]);
const [offerLoading, setOfferLoading] = useState(false);

// localStorage beim Mount lesen
useEffect(() => {
  setOfferCount(getOfferCount());
  setOfferItems(getOfferItems());
}, []);
```

- [ ] **Step 2: "Zum Angebot hinzufügen"-Button nach Speichern**

Direkt nach der Möbel-ID-Anzeige (#{moebelId}-Button):

```typescript
{actions.moebelId && (
  <button
    onClick={() => {
      addOfferItem(actions.moebelId!);
      setOfferCount(getOfferCount());
      setOfferItems(getOfferItems());
    }}
    disabled={offerItems.includes(actions.moebelId)}
    title={offerItems.includes(actions.moebelId) ? 'Bereits im Angebot' : 'Zum Angebot hinzufügen'}
    style={{
      ...BTN,
      background: offerItems.includes(actions.moebelId) ? 'rgba(120,200,120,0.2)' : 'rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.85)',
      opacity: offerItems.includes(actions.moebelId) ? 0.5 : 1,
    }}
  >
    <ShoppingBag size={12} strokeWidth={2} />
    {offerItems.includes(actions.moebelId) ? 'Im Angebot' : '+ Angebot'}
  </button>
)}
```

- [ ] **Step 3: Angebots-Badge in der Toolbar**

Am Ende der rechten Header-Buttons (nach dem Lade-Eingabefeld):

```typescript
{offerCount > 0 && (
  <div style={{ position: 'relative' }}>
    <button
      onClick={() => setOfferOpen(o => !o)}
      style={{
        ...BTN,
        background: 'rgba(255,255,255,0.15)',
        color: 'rgba(255,255,255,0.85)',
      }}
    >
      <ShoppingBag size={12} strokeWidth={2} />
      Angebot ({offerCount})
    </button>

    {/* Dropdown */}
    {offerOpen && (
      <div style={{
        position: 'absolute', top: '100%', right: 0, marginTop: 4,
        background: '#fff', borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        padding: 12, minWidth: 220, zIndex: 100,
      }}>
        {offerItems.map(code => (
          <div key={code} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 11 }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>#{code}</span>
            <button
              onClick={() => {
                removeOfferItem(code);
                setOfferCount(getOfferCount());
                setOfferItems(getOfferItems());
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', fontSize: 14 }}
            >
              ×
            </button>
          </div>
        ))}
        <div style={{ borderTop: '1px solid #E8E5E0', marginTop: 8, paddingTop: 8, display: 'flex', gap: 6 }}>
          <button
            onClick={async () => {
              setOfferLoading(true);
              try {
                const res = await fetch('/api/offer/multi', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ codes: offerItems, currency }),
                });
                if (!res.ok) { alert('PDF-Fehler'); return; }
                const blob = await res.blob();
                const offerCode = res.headers.get('X-Offer-Code') ?? 'angebot';
                const ts = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `Artmodul_Angebot_${offerCode}_${ts}.pdf`;
                a.click();
              } catch { alert('Exportfehler'); }
              finally { setOfferLoading(false); }
            }}
            disabled={offerLoading}
            style={{
              flex: 1, padding: '6px 12px', borderRadius: 6, border: 'none',
              background: '#171614', color: '#fff', fontSize: 10, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            {offerLoading ? 'Erstelle...' : 'PDF erstellen'}
          </button>
          <button
            onClick={() => {
              clearOfferItems();
              setOfferCount(0);
              setOfferItems([]);
              setOfferOpen(false);
            }}
            style={{
              padding: '6px 10px', borderRadius: 6, border: '1px solid #E8E5E0',
              background: '#fff', color: '#999', fontSize: 10, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Leeren
          </button>
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/features/configurator/ConfiguratorShell.tsx
git commit -m "UI: Angebots-Warenkorb — Badge, Dropdown, PDF-Export"
```

---

## Task 11: End-to-End Manueller Test + Final Commit

**Files:** Keine neuen Dateien

- [ ] **Step 1: Dev-Server starten**

Run: `npm run dev`

- [ ] **Step 2: Save/Load testen**

1. Möbel konfigurieren (2×2, Eiche, Stellfuß)
2. "Speichern" klicken → 8-stellige ID erscheint in der Toolbar
3. ID notieren → Seite neu laden → ID in Eingabefeld eingeben → "Laden" → Möbel wiederhergestellt
4. URL testen: `http://localhost:3000/?config=<ID>` → Config wird geladen

- [ ] **Step 3: Multi-Möbel testen**

1. Erstes Möbel speichern → "Zum Angebot hinzufügen" klicken
2. "Neu" → Zweites Möbel konfigurieren → Speichern → "Zum Angebot hinzufügen"
3. "Angebot (2)"-Badge klicken → Dropdown zeigt beide IDs
4. "PDF erstellen" → PDF wird heruntergeladen mit Deckblatt + 2 Detailseiten

- [ ] **Step 4: TypeScript + ESLint prüfen**

Run: `npx tsc --noEmit && npm run lint`
Erwartung: 0 Fehler.

- [ ] **Step 5: Final Commit**

```bash
git add -A
git commit -m "Save/Load + Multi-Möbel-Angebot — Feature komplett"
```
