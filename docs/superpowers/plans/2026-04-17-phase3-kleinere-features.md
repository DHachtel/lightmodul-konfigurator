# Phase 3 Kleinere Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 7 unabhängige Konfigurator-Verbesserungen: Raster 10×10, Kabeldurchlass-Preis, PG-Tausch, PG-Gruppierung, Navigator zentriert, Fokus frontal, Doppel-Schublade S2.

**Architecture:** Alle Features sind unabhängig und ändern jeweils 1–3 Dateien. Keine neuen Abhängigkeiten.

**Tech Stack:** TypeScript, Next.js, React Three Fiber, Supabase, @react-pdf/renderer

---

## File Structure

### Geänderte Dateien
| Datei | Features |
|---|---|
| `src/core/constants.ts` | 1 (MAX_COLS), 3 (PG-Tausch), 7 (S2) |
| `src/core/types.ts` | 7 (CellType S2) |
| `src/core/calc.ts` | 7 (S2 BOM-Zählung) |
| `src/core/validation.ts` | 7 (S2 in getAvailableFrontTypes) |
| `src/app/api/bom/route.ts` | 2 (Kabeldurchlass-Preis) |
| `src/features/configurator/SidebarMoebel.tsx` | 4 (PG-Gruppierung) |
| `src/features/configurator/SidebarElement.tsx` | 7 (S2-Option) |
| `src/features/preview3d/Breadcrumb.tsx` | 5 (Navigator zentriert) |
| `src/features/preview3d/Preview3D.tsx` | 6 (Fokus frontal) |
| `src/features/configurator/ConfiguratorShell.tsx` | 6 (Fokus + Drill-Reset) |
| `src/features/preview3d/useModuleGeometry.ts` | 7 (S2 3D-Rendering) |

### Neue Dateien
| Datei | Zweck |
|---|---|
| `scripts/swap_pg2_pg3.sql` | SQL zum PG2↔PG3-Tausch in article_prices |

---

## Task 1: Raster 10×10

**Files:**
- Modify: `src/core/constants.ts:17`

- [ ] **Step 1: MAX_COLS ändern**

In `src/core/constants.ts` Zeile 17:

```typescript
// ALT:
export const MAX_COLS = 8;

// NEU:
export const MAX_COLS = 10;
```

- [ ] **Step 2: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/core/constants.ts
git commit -m "Config: MAX_COLS 8 → 10 (Raster bis 10×10)"
```

---

## Task 2: Kabeldurchlass-Preis

**Files:**
- Create: `scripts/insert_cable_hole_price.sql`
- Modify: `src/app/api/bom/route.ts`

- [ ] **Step 1: SQL für Supabase erstellen**

Datei `scripts/insert_cable_hole_price.sql`:

```sql
-- Kabeldurchlass als eigenen Preiseintrag anlegen
-- art_nr 9001 ist bereits als CABLE_HOLE_ART_NR in constants.ts definiert
INSERT INTO article_prices (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm, pg1_eur, pg1_chf, pg2_eur, pg2_chf, pg3_eur, pg3_chf, pg4_eur, pg4_chf)
VALUES ('9001', 'Zubehör', 'Kabeldurchlass', 'Kabeldurchlass ⌀80mm', NULL, NULL, 22.00, 24.00, 22.00, 24.00, 22.00, 24.00, 22.00, 24.00)
ON CONFLICT (art_nr) DO UPDATE SET
  pg1_eur = 22.00, pg1_chf = 24.00,
  pg2_eur = 22.00, pg2_chf = 24.00,
  pg3_eur = 22.00, pg3_chf = 24.00,
  pg4_eur = 22.00, pg4_chf = 24.00;
```

- [ ] **Step 2: Kabeldurchlass-Preis in API-Route anhängen**

In `src/app/api/bom/route.ts`: Nach dem Füße/Rollen-Block (nach Zeile 278), vor dem Subtotals-Block, einfügen:

```typescript
  // ── Kabeldurchlass ──────────────────────────────────────────────────────────
  const cableQty = Object.values(config.cableHoles ?? {}).filter(Boolean).length;
  if (cableQty > 0) {
    const cableRow = prices.find(p => String(p.art_nr) === '9001');
    if (cableRow) {
      const cup = unitPrice(cableRow, 'PG1', currency);
      if (cup !== null) {
        const finalCup = priceType === 'EK' ? cup * (1 - discountPct) : cup;
        items.push({
          art_nr: '9001',
          bezeichnung: 'Kabeldurchlass ⌀80mm',
          kategorie: 'Kabeldurchlass',
          qty: cableQty,
          unit_price: Math.round(finalCup * 100) / 100,
          total_price: Math.round(finalCup * cableQty * 100) / 100,
          dim_key: '⌀80mm',
        });
      }
    }
  }
```

- [ ] **Step 3: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

- [ ] **Step 4: Commit**

```bash
git add scripts/insert_cable_hole_price.sql src/app/api/bom/route.ts
git commit -m "Preis: Kabeldurchlass 22€/24CHF als eigene Position in BOM"
```

---

## Task 3: PG2 ↔ PG3 Tausch

**Files:**
- Modify: `src/core/constants.ts:86-110`
- Create: `scripts/swap_pg2_pg3.sql`

- [ ] **Step 1: constants.ts — PG-Felder tauschen**

In `src/core/constants.ts`:

Zeile 105–106 (Aluminium-Kommentar + ALG):
```typescript
// ALT:
  // PG2 Aluminium
  { v: 'ALG',  l: 'Alu glatt',  pg: 'PG2', hex: '#c0c8d0', border: '#a8b0b8', textured: true },

// NEU:
  // PG3 Aluminium
  { v: 'ALG',  l: 'Alu glatt',  pg: 'PG3', hex: '#c0c8d0', border: '#a8b0b8', textured: true },
```

Zeile 107–109 (Glas-Kommentar + FLG/VSG):
```typescript
// ALT:
  // PG3 Glas
  { v: 'FLG',  l: 'Klarglas',   pg: 'PG3', hex: '#c0dcd8', border: '#90b8b4', textured: false },
  { v: 'VSG',  l: 'Milchglas',  pg: 'PG3', hex: '#d0e4e0', border: '#a8c8c4', textured: false },

// NEU:
  // PG2 Glas
  { v: 'FLG',  l: 'Klarglas',   pg: 'PG2', hex: '#c0dcd8', border: '#90b8b4', textured: false },
  { v: 'VSG',  l: 'Milchglas',  pg: 'PG2', hex: '#d0e4e0', border: '#a8c8c4', textured: false },
```

- [ ] **Step 2: SQL-Skript für Supabase**

Datei `scripts/swap_pg2_pg3.sql`:

```sql
-- PG2 ↔ PG3 Spaltentausch in article_prices
-- Temporäre Spalten nutzen, um atomaren Tausch sicherzustellen
ALTER TABLE article_prices ADD COLUMN IF NOT EXISTS _tmp_pg2_eur NUMERIC;
ALTER TABLE article_prices ADD COLUMN IF NOT EXISTS _tmp_pg2_chf NUMERIC;

UPDATE article_prices SET
  _tmp_pg2_eur = pg2_eur,
  _tmp_pg2_chf = pg2_chf;

UPDATE article_prices SET
  pg2_eur = pg3_eur,
  pg2_chf = pg3_chf,
  pg3_eur = _tmp_pg2_eur,
  pg3_chf = _tmp_pg2_chf;

ALTER TABLE article_prices DROP COLUMN _tmp_pg2_eur;
ALTER TABLE article_prices DROP COLUMN _tmp_pg2_chf;
```

- [ ] **Step 3: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/core/constants.ts scripts/swap_pg2_pg3.sql
git commit -m "PG-Tausch: Alu → PG3, Glas → PG2 (constants + SQL)"
```

---

## Task 4: Sidebar PG-Gruppierung

**Files:**
- Modify: `src/features/configurator/SidebarMoebel.tsx`

- [ ] **Step 1: PG-Gruppierungslogik und Rendering**

In `SidebarMoebel.tsx`, die bestehende Material-Rendering-Logik (Zeilen 7, 22–57) ersetzen:

Entferne Zeile 7:
```typescript
// ALT:
const MAT_ALL = MATERIALS.filter(m => m.v !== 'none');
```

Ersetze den Oberfläche-Section-Inhalt (Zeilen 22–57) durch:

```typescript
{/* ── OBERFLÄCHE ── */}
<Section label="Oberfläche">
  {/* Keine-Oberfläche Button */}
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
    <button
      onClick={() => actions.setSurface('none')}
      title="Keine Oberfläche"
      style={{
        ...CHIP,
        background: '#E4E0D9',
        boxShadow: state.surface === 'none'
          ? '0 0 0 2.5px #fff, 0 0 0 4.5px #171614'
          : '0 0 0 1px rgba(0,0,0,0.13)',
        transform: state.surface === 'none' ? 'scale(1.1)' : 'scale(1)',
        fontSize: 13, color: '#9a9690',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >×</button>
  </div>

  {/* PG-Gruppen */}
  {PG_ORDER.map(pg => {
    const mats = MATERIALS.filter(m => m.pg === pg);
    if (mats.length === 0) return null;
    return (
      <div key={pg} style={{ marginTop: 12 }}>
        <span style={{ fontSize: 9, color: '#A8A49C', fontWeight: 500 }}>
          {pg} — {PG_LABELS[pg] ?? pg}
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {mats.map(m => (
            <button
              key={m.v}
              onClick={() => actions.setSurface(m.v)}
              title={`${m.l} (${m.pg})`}
              style={{
                ...CHIP,
                background: m.grad ?? m.hex,
                boxShadow: state.surface === m.v
                  ? '0 0 0 2.5px #fff, 0 0 0 4.5px #171614'
                  : '0 0 0 1px rgba(0,0,0,0.13)',
                transform: state.surface === m.v ? 'scale(1.1)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>
    );
  })}

  {matObj ? (
    <p style={{ fontSize: 9, color: '#A8A49C', marginTop: 8 }}>{matObj.l} · {matObj.pg}</p>
  ) : (
    <p style={{ fontSize: 9, color: '#C8C4BC', marginTop: 8 }}>Keine Oberfläche gewählt</p>
  )}
</Section>
```

Und am Anfang der Datei (nach den Imports) die Gruppierungskonstanten hinzufügen:

```typescript
const PG_ORDER = ['PG1', 'PG2', 'PG3', 'PG4'];
const PG_LABELS: Record<string, string> = {
  PG1: 'Kunstharz',
  PG2: 'Glas',
  PG3: 'Aluminium',
  PG4: 'Furnier',
};
```

- [ ] **Step 2: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/features/configurator/SidebarMoebel.tsx
git commit -m "UI: Materialien nach Preisgruppe (PG1–PG4) gruppiert"
```

---

## Task 5: Navigator zentriert

**Files:**
- Modify: `src/features/preview3d/Breadcrumb.tsx`

- [ ] **Step 1: Breadcrumb komplett ersetzen**

Ersetze den gesamten Inhalt von `src/features/preview3d/Breadcrumb.tsx`:

```typescript
'use client';

import type { DrillLevel } from './useDrillDown';

interface BreadcrumbProps {
  level: DrillLevel;
  selectedCell: { row: number; col: number } | null;
  selectedPlateType: string | null;
  onGoToLevel: (level: DrillLevel) => void;
}

const PART_LABELS: Record<string, string> = {
  seite_l: 'Seite L', seite_r: 'Seite R',
  boden: 'Boden', deckel: 'Deckel', ruecken: 'Rückwand',
  zwischenboden: 'Zwischenboden', zwischenwand: 'Zwischenwand', front: 'Front',
};

type NavItem = {
  label: string;
  level: DrillLevel;
  active: boolean;
  reachable: boolean;
};

export default function Breadcrumb({ level, selectedCell, selectedPlateType, onGoToLevel }: BreadcrumbProps) {
  const elementLabel = selectedCell
    ? `Element R${selectedCell.row + 1}·C${selectedCell.col + 1}`
    : 'Element';
  const platteLabel = selectedPlateType
    ? (PART_LABELS[selectedPlateType] ?? selectedPlateType)
    : 'Platte';

  const items: NavItem[] = [
    {
      label: 'Möbel',
      level: 'moebel',
      active: level === 'moebel',
      reachable: true,
    },
    {
      label: elementLabel,
      level: 'element',
      active: level === 'element',
      reachable: selectedCell !== null,
    },
    {
      label: platteLabel,
      level: 'platte',
      active: level === 'platte',
      reachable: selectedPlateType !== null,
    },
  ];

  return (
    <div style={{
      position: 'absolute',
      top: 68,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderRadius: 8,
      padding: '6px 14px',
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
    }}>
      {items.map((item, i) => (
        <span key={item.level} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && (
            <span style={{
              margin: '0 8px',
              color: '#C0BCB6',
              fontSize: 10,
            }}>›</span>
          )}
          <button
            onClick={() => item.reachable && !item.active && onGoToLevel(item.level)}
            disabled={item.active || !item.reachable}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px 4px',
              cursor: item.active || !item.reachable ? 'default' : 'pointer',
              color: item.active
                ? '#171614'
                : item.reachable
                  ? 'rgba(23,22,20,0.5)'
                  : 'rgba(23,22,20,0.25)',
              fontWeight: item.active ? 600 : 400,
              fontSize: 13,
              fontFamily: 'inherit',
              letterSpacing: '.02em',
              borderBottom: item.active ? '2px solid #171614' : '2px solid transparent',
              borderRadius: 0,
              paddingBottom: 2,
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={(e) => {
              if (item.reachable && !item.active) e.currentTarget.style.color = '#171614';
            }}
            onMouseLeave={(e) => {
              if (item.reachable && !item.active) e.currentTarget.style.color = 'rgba(23,22,20,0.5)';
            }}
          >
            {item.label}
          </button>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/Breadcrumb.tsx
git commit -m "UI: Navigator zentriert, größer, alle Ebenen sichtbar"
```

---

## Task 6: Fokus = Frontalansicht + Drill-Down-Reset

**Files:**
- Modify: `src/features/preview3d/Preview3D.tsx:802-811`
- Modify: `src/features/configurator/ConfiguratorShell.tsx`

- [ ] **Step 1: resetCamera → Frontalansicht**

In `src/features/preview3d/Preview3D.tsx`, Zeilen 802–811 ersetzen:

```typescript
// ALT:
resetCamera: () => {
  const cc = ccRef.current;
  if (!cc) return;
  const box = new THREE.Box3(
    new THREE.Vector3(boxMinX, boxMinY, boxMinZ),
    new THREE.Vector3(boxMaxX, boxMaxY, boxMaxZ),
  );
  const pad = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * 0.6;
  cc.fitToBox(box, true, { paddingLeft: pad, paddingRight: pad, paddingTop: pad, paddingBottom: pad });
},

// NEU:
resetCamera: () => {
  const cc = ccRef.current;
  if (!cc) return;
  const box = new THREE.Box3(
    new THREE.Vector3(boxMinX, boxMinY, boxMinZ),
    new THREE.Vector3(boxMaxX, boxMaxY, boxMaxZ),
  );
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  // Abstand so dass Möbel mit Padding reinpasst
  const dist = Math.max(size.x, size.y) * 1.4;
  // Frontalansicht: Kamera direkt vor dem Möbel (Z-Achse)
  cc.setLookAt(
    center.x, center.y, center.z + dist,
    center.x, center.y, center.z,
    true,
  );
},
```

- [ ] **Step 2: Fokus-Button — Drill-Down-Reset hinzufügen**

In `src/features/configurator/ConfiguratorShell.tsx`, den Fokus-Button (suche `onClick={() => preview3DRef.current?.resetCamera()}`) ändern:

```typescript
// ALT:
onClick={() => preview3DRef.current?.resetCamera()}

// NEU:
onClick={() => {
  preview3DRef.current?.resetCamera();
  drillActions.goToLevel('moebel');
}}
```

- [ ] **Step 3: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

- [ ] **Step 4: Commit**

```bash
git add src/features/preview3d/Preview3D.tsx src/features/configurator/ConfiguratorShell.tsx
git commit -m "UI: Fokus-Button → Frontalansicht + Drill-Down-Reset"
```

---

## Task 7: Doppel-Schublade (S2)

**Files:**
- Modify: `src/core/types.ts:4`
- Modify: `src/core/constants.ts:27-46`
- Modify: `src/core/calc.ts:140-157, 240-256`
- Modify: `src/core/validation.ts`
- Modify: `src/features/configurator/SidebarElement.tsx`
- Modify: `src/features/preview3d/useModuleGeometry.ts`

- [ ] **Step 1: CellType erweitern**

In `src/core/types.ts` Zeile 4:

```typescript
// ALT:
export type CellType = '' | 'O' | 'K' | 'S' | 'TR' | 'TL' | 'DT';

// NEU:
export type CellType = '' | 'O' | 'K' | 'S' | 'S2' | 'TR' | 'TL' | 'DT';
```

- [ ] **Step 2: FRONT_TYPE_AVAILABILITY + CELL_TYPES erweitern**

In `src/core/constants.ts`:

Zeile 32 — nach `S:` einfügen:
```typescript
  S:  { widths: [420, 580, 780, 980], heights: [180, 360] },
  S2: { widths: [420, 580, 780, 980], heights: [360] },
```

Zeile 43 — nach `Schublade` einfügen:
```typescript
  { v: 'S',  l: 'Schublade'  },
  { v: 'S2', l: '2× Schublade' },
```

- [ ] **Step 3: BOM-Zählung für S2 in calc.ts**

In `src/core/calc.ts`, im Fronttyp-Zählblock (Zeile 140–157):

Nach Zeile 145 (`else if (d.type === 'S')  { nS++; totalSch++; }`) einfügen:

```typescript
      else if (d.type === 'S2') { nS += 2; totalSch += 2; }
```

Nach Zeile 150 (`if (d.type === 'S' && ...`) einfügen:

```typescript
      if (d.type === 'S2' && (w > 980 || h > 360))
        warns.push(`2×Schublade Z${r + 1}/S${c + 1}: ${w}×${h}mm > max 980×360mm`);
```

Im Fronten-Block (Zeile 248–255), die Schleife ändern. Die aktuelle Logik:
```typescript
      if (d.type === '' || d.type === 'O') continue;
      const bl = d.type === 'DT' ? 2 : 1;
      addMap(fMap[d.type], `${CW[c]}×${RH[r]}`, bl);
```

Ersetzen durch:
```typescript
      if (d.type === '' || d.type === 'O') continue;
      if (d.type === 'S2') {
        // 2 Schubladen-Fronten à halbe Zellhöhe
        const halfH = Math.round(RH[r] / 2);
        addMap(fMap.S, `${CW[c]}×${halfH}`, 2);
      } else {
        const bl = d.type === 'DT' ? 2 : 1;
        addMap(fMap[d.type], `${CW[c]}×${RH[r]}`, bl);
      }
```

Beachte: S2 schreibt in `fMap.S` (gleiche Front-Kategorie wie S), aber mit halber Höhe und Menge 2.

- [ ] **Step 4: Beschläge für S2**

In `src/core/calc.ts`, Zeile 266 (`const schubF = totalSch;`): Ist bereits korrekt — `totalSch` wird in Step 3 für S2 um 2 erhöht.

- [ ] **Step 5: fMap-Typ erweitern**

In `src/core/calc.ts`, Zeile 241–247, muss der fMap-Typ nicht geändert werden — S2 schreibt in `fMap.S`, nicht in einen eigenen Key.

Aber der `BOMResult`-Typ in `types.ts` Zeile 165 (`fMap: Record<Exclude<CellType, '' | 'O'>, DimMap>`) muss S2 einschließen. Da S2 jetzt in CellType ist, wird `Exclude<CellType, '' | 'O'>` automatisch `'K' | 'S' | 'S2' | 'TR' | 'TL' | 'DT'`.

In `calc.ts` muss der fMap-Initialisierer (Zeile 241–247) S2 enthalten:

```typescript
// ALT:
  const fMap = {
    K:  {} as DimMap,
    S:  {} as DimMap,
    TR: {} as DimMap,
    TL: {} as DimMap,
    DT: {} as DimMap,
  };

// NEU:
  const fMap = {
    K:  {} as DimMap,
    S:  {} as DimMap,
    S2: {} as DimMap,
    TR: {} as DimMap,
    TL: {} as DimMap,
    DT: {} as DimMap,
  };
```

- [ ] **Step 6: SidebarElement — S2-Option**

In `src/features/configurator/SidebarElement.tsx`: Keine Änderung nötig — `CELL_TYPES` und `getAvailableFrontTypes` werden bereits dynamisch ausgelesen. S2 erscheint automatisch durch die Änderungen in `constants.ts`.

Prüfen: Der Filter in Zeile 51 (`CELL_TYPES.filter(ct => ct.v === 'O' || availableTypes.includes(ct.v))`) schließt S2 ein, wenn `getAvailableFrontTypes(w, h)` es zurückgibt.

- [ ] **Step 7: validation.ts — getAvailableFrontTypes**

Lese `src/core/validation.ts` und prüfe die `getAvailableFrontTypes`-Funktion. Sie iteriert über `FRONT_TYPE_AVAILABILITY` — da S2 dort eingetragen ist (Step 2), wird es automatisch berücksichtigt. Keine manuelle Änderung nötig.

Prüfe auch `canPlace` und `cellMissingSideWall` — beide prüfen `type !== ''`, nicht spezifische CellTypes. S2 wird korrekt behandelt.

- [ ] **Step 8: useModuleGeometry — S2 3D-Rendering**

In `src/features/preview3d/useModuleGeometry.ts`: Suche den Block, der Schubladen-Fronten rendert (wo `type === 'S'` geprüft wird). Ergänze die Logik:

Suche die Stelle wo die Front für `type === 'S'` gerendert wird. Füge einen zusätzlichen Block für S2 hinzu, der 2 Fronten à halber Höhe rendert:

```typescript
if (cell.type === 'S2') {
  const halfH = Math.round(rh / 2);
  // Untere Schublade
  // ... gleiche Front-Logik wie S, aber mit halfH statt rh, y-Offset für untere Hälfte
  // Obere Schublade
  // ... gleiche Front-Logik wie S, aber mit halfH statt rh, y-Offset für obere Hälfte
}
```

Die genaue Implementierung hängt davon ab, wie die S-Front aktuell gerendert wird. Lese die bestehende S-Logik in `useModuleGeometry.ts` und dupliziere sie mit angepasster Höhe und Y-Position. Jede der zwei Schubladen bekommt einen eigenen Griff.

- [ ] **Step 9: TypeScript prüfen**

Run: `npx tsc --noEmit`
Erwartung: 0 Fehler.

- [ ] **Step 10: Manueller Test**

Run: `npm run dev`
1. Element 580×360 wählen → "2× Schublade" erscheint als Option
2. S2 setzen → 2 Schubladen mit je 180mm Höhe in der 3D-Ansicht
3. BOM prüfen → 2× front_S mit 580×180 statt 1× front_S mit 580×360

- [ ] **Step 11: Commit**

```bash
git add src/core/types.ts src/core/constants.ts src/core/calc.ts src/features/preview3d/useModuleGeometry.ts
git commit -m "Feature: S2 Doppel-Schublade (2×180mm in 360er Zelle)"
```

---

## Task 8: Finale Prüfung

- [ ] **Step 1: TypeScript + ESLint**

Run: `npx tsc --noEmit && npm run lint`
Erwartung: 0 neue Fehler.

- [ ] **Step 2: SQL-Skripte auflisten**

Folgende SQL-Skripte müssen im Supabase SQL-Editor ausgeführt werden:
1. `scripts/insert_cable_hole_price.sql` — Kabeldurchlass-Preis anlegen
2. `scripts/swap_pg2_pg3.sql` — PG2 ↔ PG3 Spaltentausch

- [ ] **Step 3: Final Commit (falls nötig)**

```bash
git add -A
git commit -m "Phase 3: 7 Verbesserungen komplett"
```
