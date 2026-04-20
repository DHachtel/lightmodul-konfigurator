# Lightmodul Konfigurator — E2E Händler-Workflow Design

**Datum:** 2026-04-20
**Ziel:** Vollständiger Händler-Workflow end-to-end: Login → Konfigurieren (3D) → BOM mit Preisen → Bestellen → Admin verwaltet

---

## Entscheidungen aus Brainstorming

| Frage | Entscheidung |
|-------|-------------|
| Primäres Ziel | Vollständiger Händler-Workflow E2E |
| Preisdaten | Excel liegt vor, importierbar |
| Bestellnummer | `LM-YYYY-NNNN` (bis auf weiteres) |
| Produktgruppen pro Rahmen | Erstmal nur RF/RL ohne Produktgruppe — kommt später |
| Admin-Panel Scope | Minimal: Händler freigeben/sperren + Bestellungen einsehen (skalierbar) |
| Customer-Zugang | Kann konfigurieren + Datenblatt ohne Preise (Testphase, danach tbd) |
| 3D-Assets | GLB von Anfang an (STP-Dateien liegen vor, müssen konvertiert werden) |
| Raster | Nur 600mm jetzt, erweiterbar für Beratungstisch später |
| Konfiguration | Ausschließlich im 3D-Viewer (kein 2D-Grid) |
| Shadow-Boxen | Artmodul-System übernehmen für 3D-Grid-Erweiterung |
| Stoppfen | Erstmal aus BOM rauslassen (Klärung offen) |
| Stellfüße/Rollen | Behalten (tbd) |
| Logo | "MHZ LightModul" als farbiger Schriftzug nachgebaut |

---

## Phase 1 — Cleanup & Datenmodell

### ConfigState bereinigen

Entfernen:
- `surface`, `handle`, `depth` (Artmodul-Aliase)
- `bomOverrides` (keine Board-spezifischen Materialien)
- `catOverrides` (keine PG-Gruppen für Platten)
- `partColors`, `cellColors` (Artmodul-Farbsystem)
- `opts.inner`, `opts.back` (keine Rückwände/Innenwände)
- `cableHoles` (kein Lightmodul-Feature)

Behalten & bereinigen:
- `cols: number[]` — Array aus 600ern, Länge = Spaltenanzahl
- `rows: number[]` — Array aus 600ern, Länge = Zeilenanzahl
- `depthLayers: number` — 1–4
- `grid: Cell[][][]` — [row][col][depth]
- `profileColor: 'SW' | 'WS'`
- `footer: string`
- `opts.feet` (umbenannt von `opts.outer`)

### Cell vereinfachen

```typescript
interface Cell {
  type: CellType;   // '' | 'O' | 'RF' | 'RL'
  shelves: number;   // 0–2
}
```

`frameGroup` und `frameProduct` entfallen bis zur Produktgruppen-Phase.

### BOMResult bereinigen

Alle Artmodul-Felder entfernen. Lightmodul-only:

```typescript
interface BOMResult {
  wuerfel: number;
  profileX: number;
  profileY: number;
  profileZ: number;
  framesStd: number;      // RF
  framesLit: number;      // RL
  shelves: number;
  footerQty: number;
  schraubenM4: number;
  schraubenM6: number;
  scheiben: number;
  totalWidth: number;      // mm
  totalHeight: number;     // mm
  totalDepth: number;      // mm
  boardMap: Record<string, BoardEntry>;
  warnings: string[];
}
```

### Weitere Cleanup-Arbeiten

- `variants.ts` — Datei entfernen oder leeren (computeBoardVariants ist already no-op)
- Artmodul-Referenzen in Kommentaren, Labels, Fehlermeldungen ersetzen
- Logo im Header: "MHZ LightModul" als farbiger Schriftzug (M-grau, H-grau, Z-grau, Leerzeichen, L-türkis, i-g-h-t-grau, M-rot, o-d-u-l-grau)

---

## Phase 2 — BOM & Preise

### BOM-Berechnung validieren

Die Kernlogik in `calc.ts` ist bereits auf Lightmodul angepasst:
- Würfel: 1 pro aktiver Knoten — OK
- Profile X/Y/Z: 1 pro Verbindung zwischen aktiven Nachbarknoten — OK
- Rahmen RF/RL: Zählung aus cell.type — OK
- Fachböden: aus cell.shelves — OK
- Stellfüße: aktive Knoten an Bodenreihe — OK
- Hardware (M4, M6, Scheiben): feste Ratios pro Würfel — als Konstanten extrahieren

Stoppfen-Logik entfernen (offen).

### Preis-Import

- `scripts/import-prices.py` auf Lightmodul-Artikelschema anpassen
- Excel importieren → `article_prices` befüllen
- EUR + CHF Spalten

### Referenz-Stückliste

2–3 Musterkonfigurationen als `reference/lightmodul_stueckliste.html` für manuelle Validierung.

---

## Phase 3 — STP→GLB + 3D-Vorschau

### Asset-Konvertierung

STP-Dateien aus `Lightmodul/Files/Shop Step/` → GLB via Blender oder FreeCAD.

Benötigte Assets für Phase 1:

| Datei | Quelle |
|-------|--------|
| `public/models/lightmodul/wuerfel.glb` | Alu-Wuerfel 27x27 |
| `public/models/lightmodul/profil-600.glb` | Profil 25x25 l=600 |
| `public/models/lightmodul/rahmen-standard.glb` | Produktrahmen LightModul |
| `public/models/lightmodul/rahmen-beleuchtet.glb` | Produktrahmen + LED |
| `public/models/lightmodul/fachboden.glb` | Fachboden 600x600 |
| `public/models/lightmodul/stellfuss.glb` | Stellfuss M6 |

Polygon-Budget: ~5k Faces pro Asset. Kleinteile (Schrauben, Scheiben) weglassen.

Später (Beratungstisch): `profil-360.glb`, `profil-213.glb`

### Rendering-Strategie

**InstancedMesh** für Massenelemente:
- 1× InstancedMesh für alle Würfel
- 3× InstancedMesh für Profile (je Achse X/Y/Z, Rotation unterschiedlich)
- Einzelne Meshes für Rahmen, Fachböden, Stellfüße

Profilfarbe (SW/WS) als Material-Property, nicht als separate GLB.

### useModuleGeometry Umbau

- `SceneObject` bekommt `model: string` statt `geometry: 'box'`
- Position/Rotation-Berechnung bleibt (ist korrekt)
- `Preview3D.tsx` lädt GLBs via `useGLTF()`, erstellt InstancedMesh pro Typ

---

## Phase 4 — 3D als Hauptinteraktion

### 2D-Grid entfällt

`ConfigGrid.tsx` und `SidebarMoebel.tsx` werden entfernt. Der 3D-Viewer ist die einzige Konfigurationsoberfläche.

### Shadow-Box-System

Artmodul-Pattern übernehmen, auf 3D erweitert:
- Halbtransparente Wireframe-Boxen (600×600×600) an allen freien Nachbarpositionen
- "+" Button pro Ghost-Zone → fügt Zelle/Spalte/Zeile/Tiefenebene hinzu
- "×" Button an bestehenden Elementen → entfernt
- Maßangaben an Kanten
- Ghost-Zonen in alle 6 Richtungen (oben, unten, links, rechts, vorne, hinten)

### Zell-Interaktion

- Raycasting: Klick auf Zelle → selektieren + Highlight
- HTML-Overlay über Canvas (drei/drei `Html` component): Zelltyp-Wahl (leer/offen/RF/RL), Fachböden (0–2)
- OrbitControls für Drehen/Zoomen (Rechtsklick oder mittlere Maustaste)

### UI-Struktur

```
ConfiguratorShell
├── Sidebar (links, minimal)
│   ├── Profilfarbe (SW/WS Toggle)
│   └── Stellfuß/Rolle (Dropdown, tbd)
├── Preview3D (zentral, volle Breite)
│   ├── GLB InstancedMeshes
│   ├── Ghost-Boxen mit +/× Buttons
│   ├── Zell-Selektion → HTML-Overlay
│   └── OrbitControls
└── BOMPanel (rechts, einklappbar)
    ├── Stückliste mit Mengen
    ├── Preise (nur dealer/admin)
    └── Export-Buttons (XLS, PDF)
```

---

## Phase 5 — Händler-Workflow

### Login & Auth

Bereits funktionsfähig (Supabase Auth + Middleware). Anpassungen:
- Branding auf Lightmodul
- Registrierungs-Flow: Händler beantragt Zugang → Admin gibt frei

### Bestell-Flow

- Händler konfiguriert → BOM berechnen → Preise sehen (EK mit Rabatt)
- "Bestellen" Button → Auftragsformular (Kundenadresse, Notiz)
- POST `/api/orders` → Eintrag in `orders` + `order_items`
- Bestellnummer: `LM-YYYY-NNNN`
- Bestätigungs-E-Mail (Mail-Templates anpassen)

### PDF-Export

- Datenblatt (alle Rollen): 3D-Screenshot, Stückliste, Maße — ohne Preise für Customer
- Angebot (dealer/admin): Stückliste mit EK-Preisen
- Branding: "MHZ LightModul" Header

### Customer-Zugang (Testphase)

- Kann konfigurieren ohne Login
- Datenblatt-PDF ohne Preise exportieren
- Kein Bestellen, keine Preisansicht

---

## Phase 6 — Admin-Panel

### Minimaler Umfang

- **Händlerverwaltung:** Liste aller Händler-Accounts, Freigeben/Sperren-Toggle
- **Bestellübersicht:** Alle Bestellungen mit Status, Filterung nach Datum/Händler

### Spätere Erweiterungen (nicht in Phase 1)

- Rabatte pro Händler pflegen
- Artikelpreise einsehen/bearbeiten
- Gespeicherte Konfigurationen
- Dashboard mit KPIs

---

## Wiederverwendung

### 1:1 übernehmbar

- Auth-Flow (Login, Registrierung, Callback, Middleware)
- Supabase-Schema (profiles, article_prices, saved_configs, orders)
- API-Route-Pattern (Zod-Schemas, Service-Role)
- PDF-Pipeline (@react-pdf/renderer Grundgerüst)
- BOM→Preis-Flow (API→computeBOM→Preislookup→PriceResponse)
- XLS-Export (Raw XML)
- Rate Limiting, Admin-Token-Check

### Komplett neu

- `Preview3D.tsx` — von Nebenansicht zu Hauptinteraktion mit Raycasting, Shadow-Boxen, Overlays
- `useModuleGeometry.ts` — GLB-Referenzen statt prozedural
- UI-Struktur — 2D-Grid weg, minimale Sidebar, 3D zentral

### Entfällt

- `ConfigGrid.tsx`
- `SidebarMoebel.tsx`
- `SidebarElement.tsx`
- `SidebarPlatte.tsx`
- `GlobalBar.tsx` (wird zu minimaler Sidebar)
- `variants.ts` (oder leere Hülle)

---

## Risiken

| Risiko | Schwere | Mitigation |
|--------|---------|------------|
| STP→GLB Konvertierung (Qualität/Dateigröße) | Mittel | Früh konvertieren, ~5k Faces Budget |
| 3D-Interaktion Komplexität (Shadow-Boxen, Raycasting, Overlays) | Hoch | Schrittweise: erst statisch, dann interaktiv |
| Preisdaten-Format vs Import-Script | Niedrig | Script anpassen sobald Excel vorliegt |
| Hardware-Mengen unklar (Stoppfen etc.) | Niedrig | Weglassen, nachpflegen |
| Fehlende Referenz-Stückliste | Mittel | Musterkonfigurationen manuell validieren |

### Kritischer Pfad

```
Phase 1 (Cleanup) → Phase 2 (BOM/Preise) → Phase 3 (STP→GLB)
                                                    ↓
                                    Phase 4 (3D-Interaktion) ← riskantester Schritt
                                                    ↓
                                    Phase 5 (Händler-Flow) → Phase 6 (Admin)
```
