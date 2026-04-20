# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🚀 SESSION-AUTOSTART — Lies das zuerst

Wenn du ohne explizite Aufgabe gestartet wirst (z.B. per `start_rc.bat` oder mit dem Hinweis „leg los"):

**Schritt 1 — DEV_BOARD lesen:**
Lies `DEV_BOARD_Konfigurator.html` und suche im Tab „To-Dos & Prompts" den nächsten Eintrag der **nicht** als `✓ Erledigt` markiert ist.

Aktueller Stand (April 2026):
- ✓ 3D Stufe 2 Phase A (A1–A3): Visual Foundation — abgeschlossen
- ✓ 3D Stufe 2 Phase B (B1–B3): Element-Selektion — abgeschlossen
- ✓ 3D Stufe 2 Phase C (C1–C3): Granulare Farben + BOM — abgeschlossen
- ○ 3D Stufe 2 Phase D (D1): GLB-Assets — GEBLOCKT (externe Assets fehlen)
- ○ Phase 4: Auth & Dealer-Workflow — nächste Hauptphase

**Schritt 2 — Sofort starten:**
Führe den gefundenen Prompt vollständig aus. Kein Rückfragen, kein Zusammenfassen was du vorhast — direkt loslegen.

**Schritt 3 — Fragen stellen (falls nötig):**
Wenn du eine Entscheidung brauchst die du nicht selbst treffen kannst: stelle **eine einzige, konkrete Frage** und warte. Der Nutzer antwortet per Remote Control vom Handy. Formuliere Fragen als Ja/Nein oder mit zwei konkreten Optionen — kein Fließtext.

**Schritt 4 — Nach jedem Prompt pausieren:**
Nach erfolgreichem Abschluss eines Prompts:
1. `tsc --noEmit` ausführen
2. Bei 0 Fehlern: `git add -A && git commit -m "3D Stufe 2 [Prompt-ID]: [Kurzbeschreibung]"`
3. DEV_BOARD-Eintrag als ✓ markieren (HTML-Kommentar im todo-item: `class="todo-item done-item"`)
4. **Kurz berichten was gemacht wurde** (2–3 Sätze) und fragen: „Weiter mit [nächster Prompt-ID]?" — dann warten.
5. Erst nach expliziter Bestätigung („ja", „weiter", „go") den nächsten Prompt starten.
6. Niemals mehrere Prompts hintereinander ohne Rückmeldung ausführen.
7. **Nach Phase A (Prompts A1–A3) komplett stoppen** und warten. Nicht selbstständig mit Phase B beginnen. Phasenwechsel erfordert immer explizite Anweisung des Nutzers.

**Remote Control:** Diese Session läuft ggf. mit `--rc`. Der Nutzer ist per Claude-App auf dem Handy verbunden und kann jederzeit eingreifen oder antworten.

---

## Projekt-Überblick

**Produkt:** Möbel-Konfigurator für das Artmodul-System
**Kunde:** MHZ Hachtel GmbH
**Repo:** `artmodul-konfigurator`

Der Konfigurator erlaubt es Endkunden und Händlern, Artmodul-Regalsysteme zu konfigurieren (Maße, Fronten, Materialien) und eine Stückliste (BOM) zu erzeugen. Die gesamte Berechnungslogik ist in `reference/artmodul_stueckliste.html` als validierter Prototyp hinterlegt — diese Datei ist die **Wahrheitsquelle für alle BOM-Berechnungen**.

---

## Umgebungsvariablen (`.env.local`)

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt-URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon-Key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role-Key — nur in API-Routen |
| `BETA_USER` | HTTP-Basic-Auth-Benutzername (Default: `artmodul`) |
| `BETA_PASSWORD` | HTTP-Basic-Auth-Passwort — **muss gesetzt sein** (sonst 503 Fail-Safe) |
| `NEXT_PUBLIC_SITE_URL` | Öffentliche App-URL für internen API-Self-Call in `/api/datasheet` |

**Wichtig:** `BETA_PASSWORD` muss in `.env.local` gesetzt sein, sonst blockiert `middleware.ts` alle Anfragen mit 503. Auf Vercel ist `VERCEL_URL` der Fallback für `NEXT_PUBLIC_SITE_URL`.

---

## Befehle

```bash
npm run dev      # Entwicklungsserver starten
npm run build    # Produktions-Build (TypeScript-Fehler und ESLint sichtbar)
npm run lint     # ESLint ausführen
npm run docs     # PROJECT_STATUS.html per Claude-CLI aktualisieren
```

Preisliste importieren (Excel → Supabase `article_prices`):
```bash
python scripts/import-prices.py [pfad/zur/Verkaufspreise.xlsx]
# Standardpfad: Verkaufspreise_02.xlsx im Projektstamm
# Liest Blatt 'Konfigurator_Export'; re-runnable (upsert auf art_nr)
# Benötigt NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (aus .env.local)
# Importiert EUR- und CHF-Spalten (pg1_mdf_eur, pg1_mdf_chf, …)
```

Alternativ: `scripts/seed_article_prices.sql` direkt im Supabase-SQL-Editor ausführen.

Es gibt kein Test-Framework — Korrektheit von BOM-Berechnungen gegen Prototyp manuell prüfen.

> **Beta-Zugangschutz:** Die gesamte App läuft hinter HTTP Basic Auth (`middleware.ts`). Alle API-Routen sind davon betroffen — inkl. internem Self-Call von `/api/datasheet` → `/api/bom`. Der `/api/datasheet`-Handler schickt `Authorization: Basic …` aus `BETA_USER`/`BETA_PASSWORD` mit.

---

## Tech Stack

| Bereich       | Technologie                              |
|---------------|------------------------------------------|
| Framework     | Next.js 16 (App Router)                  |
| Sprache       | TypeScript (strict)                      |
| Styling       | Tailwind CSS v4                          |
| Backend / DB  | Supabase (Auth, PostgreSQL, RLS)         |
| PDF           | @react-pdf/renderer (Node.js-Runtime)    |
| Hosting       | Vercel                                   |
| 3D            | Three.js / React Three Fiber (@react-three/fiber, @react-three/drei) |

---

## Architektur

### Schichtenmodell

```
src/core/          ← Pure Business-Logik, kein React, kein Server-Only
  types.ts         ← Alle TypeScript-Typen (inkl. BOMResult, PriceResponse)
  calc.ts          ← computeBOM(), buildBoardMap() — zellengenau berechnet
  constants.ts     ← MATERIALS, HANDLES, FOOTERS, WIDTHS, HEIGHTS + Lookup-Maps
                     MAT_BY_V, HANDLE_BY_V, FOOTER_BY_V (reverse-lookup Maps)
                     CABLE_HOLE_ART_NR — Artikelnummer für Kabeldurchlass-Bohrung
  validation.ts    ← canPlace(), getAvailableFrontTypes(), validateCatOverrides()
  pricing.ts       ← Duplikat-Typen (PriceLineItem, PriceResponse) — canonical in types.ts;
                     bei Importen immer @/core/types verwenden, nicht @/core/pricing

src/lib/
  utils.ts         ← sortEntries() — sortiert BOM-Einträge für konsistente Ausgabe

src/features/
  configurator/    ← ConfigGrid, GlobalBar, ConfiguratorShell
                     CellEditorPopover — Bauteil-Override-Popover (Oberfläche + Kabel pro boardId)
                     useConfigStore.ts — gesamter Konfiguratorzustand (custom hook)
  bom/             ← BOMPanel, exportXLS (generiert XLSX als raw XML, ohne externe Library)
  pdf/             ← OfferDocument (@react-pdf/renderer-Komponente)
                     DatasheetDocument — vollständiges Konfigurationsdatenblatt (BOM + Maßzeichnung + 3D-Screenshot + Preise)
                     TechnicalDrawing — SVG-Frontansicht mit Bemaßung für PDF (via @react-pdf/renderer SVG-Primitiven)
  preview3d/       ← useModuleGeometry.ts — konvertiert ConfigState → SceneObject[] (1mm = 0.01 Three.js-Einheiten)
                     Preview3D.tsx — React Three Fiber Canvas mit OrbitControls; onSnapshot-Callback für PNG-DataURL

src/types/         ← Browser-API-Typdeklarationen
  file-system-access.d.ts  ← window.showSaveFilePicker (Chrome/Edge File System Access API)

src/app/api/
  bom/route.ts       ← POST: computeBOM + Preislookup aus Supabase (service role)
  pdf/route.ts       ← POST: renderToBuffer(OfferDocument), nur dealer/admin
  datasheet/route.ts ← POST: Konfigurationsdatenblatt als PDF; customer ohne Preise, dealer/admin mit Preisen
                        Nimmt optional screenshot3d (PNG-DataURL) und moebelId entgegen
  price/route.ts     ← Preisabfrage (separater Endpunkt)
  auth/callback/     ← Supabase Auth-Callback

src/lib/supabase/
  client.ts        ← Browser-Client (anon key)
  server.ts        ← Server-Clients: createServerSupabaseClient + createServiceSupabaseClient
```

### Zustandsverwaltung

Kein globaler State-Manager (kein Zustand/Redux). Der gesamte Konfiguratorzustand liegt in **`useConfigStore`** (`src/features/configurator/useConfigStore.ts`, custom hook, `useState`-basiert). `ConfiguratorShell` konsumiert den Hook und reicht `[ConfigState, ConfigActions]` an Kind-Komponenten weiter.

Wichtige `ConfigActions`-Besonderheiten:
- `setType` — prüft Schwerkraft-Regel (Module von unten nach oben platzieren); setzt `gravityError` bei Verstoß
- `setCol`/`setRow` — setzt ungültige Fronttypen automatisch auf `'O'`; setzt `frontTypeWarning`
- Grid-Spalten: `addColLeft`, `addColRight`, `removeColLeft`, `removeColRight` (begrenzt auf MAX_COLS = 8)
- Grid-Zeilen: **nur oben** — `addRowTop`, `removeRowTop` (begrenzt auf MAX_ROWS = 10); kein addRowBottom
- Alle Grid-Mutationen: immutable (immer `[...row]`-Kopien)
- **Jede Config-Änderung** (über internen `update()`-Wrapper) invalidiert automatisch `committedBOM` und `moebelId`
- `commitBOM(bom)` — speichert BOM-Snapshot und erzeugt eine 6-stellige zufällige `moebelId`

### BOM-Datenfluss

1. `computeBOM(config)` (`src/core/calc.ts`) — pure Funktion, gibt `BOMResult | null` zurück
2. `BOMPanel` ruft `POST /api/bom` mit dem aktuellen `ConfigState` auf
3. API-Route berechnet BOM serverseitig, lädt Preise aus `article_prices`-Tabelle (service role), gibt `PriceResponse` zurück
4. `BOMPanel` zeigt Mengen + Preise, ermöglicht XLS-Export und PDF-Download

**Preistyp:** `/api/bom` liefert Preise an **alle** Aufrufer (inkl. nicht-eingeloggte Nutzer). Die Rolle bestimmt nur den Preistyp: `dealer` → EK (mit `discount_pct` aus `profiles`), alle anderen → UVP. Ein unauthentifizierter Customer bekommt also technisch Preise zurück — die UI blendet sie aber aus.

**Multi-Markt / Währung:** `BOMPanel` hat einen EUR/CHF-Umschalter. Die API liefert Preise je nach `currency`-Parameter. `article_prices` enthält sowohl `pg*_eur`- als auch `pg*_chf`-Spalten. MwSt-Sätze im Frontend: DE 19%, CH 8,1% (nur informativ, keine Preiskalkulation).

**committedBOM:** `BOMPanel` empfängt `committedBOM` (gespeicherte Version) und `onCommit` (Callback zum Speichern). Das Speichern der Konfiguration (`moebelId`) ist für `dealer`/`admin` vorgesehen — serverseitige Persistenz via Supabase. **XLS-Export ist nur aus `committedBOM` möglich** (nicht aus dem Live-BOM) — sichert Konsistenz zwischen Möbel-ID und exportierten Daten.

**Datenblatt-Export-Flow:** `handleDatasheetExport()` → rendert verstecktes `<Preview3D onSnapshot={…}>` → `onSnapshot` liefert PNG-DataURL → `useEffect` feuert `/api/datasheet`-POST mit `screenshot3d`. Der `/api/datasheet`-Handler ruft intern `/api/bom` auf (Self-Call via `NEXT_PUBLIC_SITE_URL` + Basic Auth).

### PDF-Routen

**`POST /api/pdf`** — nur für `dealer`/`admin`. Nimmt `{ config, pricing }`, berechnet BOM, rendert `OfferDocument` zu Buffer. Dateiname: `Artmodul_Angebot_<DD-MM-YYYY>.pdf`.

**`POST /api/datasheet`** — für alle Rollen. Nimmt `{ config, includePrice?, screenshot3d?, currency?, moebelId? }`. Rendert `DatasheetDocument`: Maßzeichnung (SVG), 3D-Screenshot (eingebettet als PNG), Kennzahl-Grid, BOM-Tabelle, optional Preisblock (nur dealer/admin + `includePrice: true`). Dateiname: `Artmodul_Datenblatt_<DD-MM-YYYY>.pdf`.

Beide Routen benötigen `export const runtime = 'nodejs'` (kein Edge).

### 3D-Vorschau

`useModuleGeometry(state)` — reiner memoized Hook, gibt `SceneObject[]` zurück. Geometrie-Konstanten: `s = 0.01` (1mm → Three.js-Einheit), `t = 19` (Plattendicke mm), `pd = 10` / `pd_i = 6` (Profil-Querschnitte außen/innen mm). Deckt ab: Außenplatten, Zwischenböden/-wände, Fronten mit Griffen, Aluminium-Profil-Gerüst.

`Preview3D` — Client Component (`'use client'`). Kamera passt sich adaptiv an Möbelgröße an. `onSnapshot`-Prop: feuert nach erstem Frame eine PNG-DataURL — wird von BOMPanel für das Datenblatt-PDF genutzt. `cameraElevation`-Prop steuert Kamerawinkel (0.35 live, 0.65 für Snapshot).

---

## Datenmodell (Kern)

```typescript
type CellType = '' | 'O' | 'K' | 'S' | 'TR' | 'TL' | 'DT';
// '' = leer, 'O' = offen, 'K' = Klappe, 'S' = Schublade
// 'TR'/'TL' = Tür rechts/links, 'DT' = Doppeltür

interface Cell {
  type: CellType;
  shelves: number; // 0–5 verstellbare Einlegeböden in dieser Zelle
}

interface ConfigState {
  cols: number[];      // Spaltenbreiten in mm — erlaubt: [420, 580, 780, 980]
  rows: number[];      // Zeilenhöhen in mm — erlaubt: [180, 360, 580, 660, 720, 1080, 1440, 1800]
  depth: number;       // 360 oder 580
  grid: Cell[][];      // [row][col], Dimensionen = rows.length × cols.length
  surface: string;     // MATERIALS[].v oder 'none'
  handle: string;      // HANDLES[].v oder 'none'
  footer: string;      // FOOTERS[].v, z.B. 'stell50'
  opts: { outer: boolean; inner: boolean }; // Seiten außen/innen
  bomOverrides: Record<string, BomOverride>;     // Instanz-Overrides (CellEditorPopover)
  cableHoles: Record<string, boolean>;           // boardId → Kabeldurchlass
  catOverrides: Record<string, BomCatOverride>;  // Kategorie-Level-Overrides (BOM-Panel)
}
```

`boardId`-Format (für `bomOverrides`/`cableHoles`): `bottom_r{R}_c{C}`, `top_r{R}_c{C}`, `back_r{R}_c{C}`, `side_r_r{R}_c{C}`, `front_r{R}_c{C}`

**Seitenwand-IDs**: Die linke Wand einer Zelle bei Spalte `C > 0` wird kanonisch als `side_r_r{R}_c{C-1}` adressiert (rechte Seite der linken Nachbarzelle). Nur bei `C === 0` lautet die ID `side_l_r{R}_c{0}`. Keine `side_l`-IDs für Innenwände.

**Override-Priorität** in der Preisberechnung (API-Route): bomOverride (Instanz) → catOverride (Kategorie, erste X Boards) → globale Materialgruppe (`pg`).

---

## Unveränderliche Regeln

### Sicherheit
- **NIEMALS** `service_role`-Key im Frontend — nur in `src/app/api/` und `supabase/functions/`
- **NIEMALS** `.env.local` committen
- Alle Supabase-Tabellen haben **RLS aktiviert** — Policies niemals deaktivieren

### BOM-Logik
- `src/core/calc.ts` muss **identische Ergebnisse** wie `reference/artmodul_stueckliste.html` liefern
- Preisrelevante Berechnungen laufen **serverseitig** (`src/app/api/bom/route.ts`)
- `catOverrides`-Schlüssel: `'boden'`, `'klappenboden'`, `'ruecken'`, `'seite_aussen'`, `'seite_aussen_sy32'`, `'seite_innen'`, `'seite_innen_sy32'`, `'fachboden'`, `'front_K'`, `'front_S'`, `'front_TR'`, `'front_TL'`, `'front_DT'`

### Code-Qualität
- TypeScript **strict mode** — keine `any`-Typen ohne Kommentar
- Kommentare auf **Deutsch**, Code (Variablen, Funktionen) auf **Englisch**
- Keine direkte DOM-Manipulation

---

## Maß-Einschränkungen

```
Breiten (mm):   420, 580, 780, 980   (MAX_COLS = 8)
Höhen (mm):     180, 360, 580, 660, 720, 1080, 1440, 1800   (MAX_ROWS = 10)
Tiefen (mm):    360, 580
Schubladen:     max. 980×360mm
Türen/Klappen:  max. 980mm Breite
Klappen:        max. 980mm Höhe
```

---

## Nutzerrollen

| Rolle      | Preise | PDF-Export | Config speichern | Währung       |
|------------|--------|------------|------------------|---------------|
| `customer` | nein   | nein       | nein             | —             |
| `dealer`   | EK     | ja         | ja               | EUR oder CHF  |
| `admin`    | UVP    | ja         | ja               | EUR oder CHF  |

Händler-Registrierung erfordert manuelle Admin-Freigabe. Profil-Tabelle: `profiles` (Felder: `role`, `discount_pct`).

---

## Was Claude Code in jeder Session prüfen soll

1. Ist RLS für alle neuen Tabellen aktiviert?
2. Wird kein `service_role`-Key im Frontend verwendet?
3. Stimmen neue BOM-Berechnungen mit dem Prototyp überein?
4. Ist `.env.local` in `.gitignore` eingetragen?
