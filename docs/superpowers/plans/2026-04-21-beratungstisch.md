# Beratungstisch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Beratungstisch" (consultation table) module type to the Lightmodul Konfigurator — a 600x600x600 base cube with a 360mm profile extension, worktop frame, and shelf as work surface.

**Architecture:** New CellType `'BT'` in the existing grid system. A BT cell occupies its position plus implicitly blocks the cell above (r-1). The vertical 600mm profile between base and upper grid node is replaced by 360mm profile + intermediate cube + 213mm profile. The worktop frame uses standard 600mm horizontal profiles at the intermediate cube level.

**Tech Stack:** TypeScript, React, Three.js (via useModuleGeometry)

**No test framework** — verification via `tsc --noEmit` and manual browser testing.

---

### Task 1: Extend Types

**Files:**
- Modify: `src/core/types.ts:10` (CellType)
- Modify: `src/core/types.ts:118-176` (BOMResult)

- [ ] **Step 1: Add 'BT' to CellType**

In `src/core/types.ts`, change line 10:

```typescript
export type CellType = '' | 'O' | 'RF' | 'RL' | 'BT';
```

- [ ] **Step 2: Add BT fields to BOMResult**

In `src/core/types.ts`, add after the `shelves` field (line 141) and before the footer section (line 143):

```typescript
  // ── Beratungstisch ───────────────────────────────────────────────────────
  /** Anzahl 360mm-Vertikalprofile (Erhoehung) */
  profil360: number;
  /** Anzahl 213mm-Vertikalprofile (Regalanschluss) */
  profil213: number;
  /** Anzahl Beratungstisch-Arbeitsplatten (= Fachboden auf Worktop-Rahmen) */
  fachbodenBT: number;
  /** Anzahl Zwischenwuerfel am Worktop-Niveau */
  wuerfelBT: number;
  /** Horizontale Worktop-Profile (600mm, X-Richtung am BT-Niveau) */
  worktopProfileX: number;
  /** Horizontale Worktop-Profile (600mm, Z-Richtung am BT-Niveau) */
  worktopProfileZ: number;
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: Errors in `calc.ts` and `BOMPanel.tsx` because BOMResult now requires new fields — this is expected and will be fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(BT): add CellType 'BT' and BOMResult fields for Beratungstisch"
```

---

### Task 2: Add Constants

**Files:**
- Modify: `src/core/constants.ts:56-61` (CELL_TYPES)

- [ ] **Step 1: Add BT profile length constants**

In `src/core/constants.ts`, add after `CUBE_SIZE_MM` (line 25):

```typescript
/** Beratungstisch: Erhoehungsprofil 360mm */
export const BT_PROFILE_UPPER_MM = 360;
/** Beratungstisch: Anschlussprofil 213mm (360 + 27 + 213 = 600) */
export const BT_PROFILE_LOWER_MM = 213;
```

- [ ] **Step 2: Add BT to CELL_TYPES**

In `src/core/constants.ts`, add to the `CELL_TYPES` array after the `'RL'` entry (line 60):

```typescript
  { v: 'BT', l: 'Beratungstisch'           },
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: Same errors as before (BOMResult fields) — no new errors from constants.

- [ ] **Step 4: Commit**

```bash
git add src/core/constants.ts
git commit -m "feat(BT): add Beratungstisch constants and cell type option"
```

---

### Task 3: Extend Validation

**Files:**
- Modify: `src/core/validation.ts`

- [ ] **Step 1: Add isBTBlocked helper**

In `src/core/validation.ts`, add after the imports (line 2):

```typescript
import type { Grid } from './types';
```

Then add after `maxShelves()` (line 56):

```typescript
/**
 * Prueft ob Position (r, c, d) von einem Beratungstisch darunter gesperrt ist.
 * Ein BT bei (r+1, c, d) sperrt (r, c, d).
 */
export function isBTBlocked(grid: Grid, r: number, c: number, d: number): boolean {
  const cellBelow = grid[r + 1]?.[c]?.[d];
  return cellBelow?.type === 'BT';
}

/**
 * Prueft ob eine Zelle am Rand des aktiven Grids liegt.
 * "Am Rand" = mindestens eine Nachbarposition (links, rechts, vorne, hinten)
 * ist leer oder ausserhalb des Grids.
 */
export function isEdgeCell(grid: Grid, r: number, c: number, d: number, nC: number, nD: number): boolean {
  // Links
  if (c === 0 || (grid[r]?.[c - 1]?.[d]?.type ?? '') === '') return true;
  // Rechts
  if (c === nC - 1 || (grid[r]?.[c + 1]?.[d]?.type ?? '') === '') return true;
  // Vorne
  if (d === 0 || (grid[r]?.[c]?.[d - 1]?.type ?? '') === '') return true;
  // Hinten
  if (d === nD - 1 || (grid[r]?.[c]?.[d + 1]?.type ?? '') === '') return true;
  return false;
}
```

- [ ] **Step 2: Update canPlace()**

Replace the `canPlace` function (lines 10-17):

```typescript
export function canPlace(
  r: number,
  c: number,
  d: number,
  type: CellType,
  grid?: Grid,
  nC?: number,
  nD?: number,
): boolean {
  // Nicht-BT: gesperrt wenn BT darunter
  if (type !== '' && type !== 'BT' && grid && isBTBlocked(grid, r, c, d)) {
    return false;
  }
  // BT-Regeln
  if (type === 'BT' && grid && nC !== undefined && nD !== undefined) {
    const nR = grid.length;
    // Nur unterste Reihe
    if (r !== nR - 1) return false;
    // Muss am Rand stehen
    if (!isEdgeCell(grid, r, c, d, nC, nD)) return false;
    // Zelle darueber muss frei sein (oder Grid wird erweitert)
    if (r > 0) {
      const above = grid[r - 1]?.[c]?.[d];
      if (above && above.type !== '' && above.type !== 'BT') return false;
    }
  }
  return true;
}
```

- [ ] **Step 3: Update getAvailableCellTypes()**

Replace `getAvailableCellTypes` (lines 23-25):

```typescript
export function getAvailableCellTypes(
  r?: number,
  c?: number,
  d?: number,
  grid?: Grid,
  nC?: number,
  nD?: number,
): CellType[] {
  const base: CellType[] = ['', 'O', 'RF', 'RL'];
  // BT nur wenn Position gueltig
  if (grid && r !== undefined && c !== undefined && d !== undefined && nC !== undefined && nD !== undefined) {
    if (isBTBlocked(grid, r, c, d)) {
      return []; // Gesperrte Zelle — kein Typ erlaubt
    }
    if (canPlace(r, c, d, 'BT', grid, nC, nD)) {
      base.push('BT');
    }
  }
  return base;
}
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: Possible errors in callers of `canPlace` / `getAvailableCellTypes` due to new parameters — these are optional so should be backwards-compatible.

- [ ] **Step 5: Commit**

```bash
git add src/core/validation.ts
git commit -m "feat(BT): extend validation with BT placement rules"
```

---

### Task 4: Extend BOM Calculation

**Files:**
- Modify: `src/core/calc.ts`

- [ ] **Step 1: Import BT constants**

In `src/core/calc.ts`, update the import on line 5:

```typescript
import { ELEMENT_SIZE_MM, HW_M4_PER_CUBE, HW_MUTTERN_PER_CUBE, HW_M6_PER_CUBE, HW_SCHEIBEN_PER_CUBE } from './constants';
```

No new constants needed in import — the profile lengths (360, 213) are counted but not used as dimensions here.

- [ ] **Step 2: Add BT counting logic**

In `src/core/calc.ts`, add after the Einlegerahmen section (after line 121) and before the Fachboeden section (line 123):

```typescript
  // ── Beratungstisch-Bauteile ─────────────────────────────────────────────
  let fachbodenBT = 0;
  let profil360 = 0;
  let profil213 = 0;
  let wuerfelBT = 0;
  let worktopProfileX = 0;
  let worktopProfileZ = 0;

  // BT-Zellen identifizieren
  const isBT = (r: number, c: number, d: number): boolean =>
    (grid[r]?.[c]?.[d]?.type ?? '') === 'BT';

  for (let r = 0; r < nR; r++)
    for (let c = 0; c < nC; c++)
      for (let d = 0; d < nD; d++) {
        if (!isBT(r, c, d)) continue;
        fachbodenBT++;
      }

  if (fachbodenBT > 0) {
    // Worktop-Knoten: BT-Zellen erzeugen Zwischenknoten auf Ebene r-1
    // Analog zur regulaeren Knoten-Logik, aber nur fuer BT-Zellen
    const btNodeActive = (rk: number, ck: number, dk: number): boolean => {
      // Ein Worktop-Knoten bei (rk, ck, dk) ist aktiv wenn mindestens
      // eine angrenzende Zelle ein BT ist (gleiche Logik wie nodeActive, aber fuer BT)
      const rMin = Math.max(0, rk - 1);
      const rMax = Math.min(nR - 1, rk);
      const cMin = Math.max(0, ck - 1);
      const cMax = Math.min(nC - 1, ck);
      const dMin = Math.max(0, dk - 1);
      const dMax = Math.min(nD - 1, dk);
      for (let r2 = rMin; r2 <= rMax; r2++)
        for (let c2 = cMin; c2 <= cMax; c2++)
          for (let d2 = dMin; d2 <= dMax; d2++)
            if (isBT(r2, c2, d2)) return true;
      return false;
    };

    // Zwischenwuerfel zaehlen (Worktop-Niveau)
    for (let rk = 0; rk <= nR; rk++)
      for (let ck = 0; ck <= nC; ck++)
        for (let dk = 0; dk <= nD; dk++)
          if (btNodeActive(rk, ck, dk)) wuerfelBT++;

    // Worktop horizontale Profile X-Richtung
    for (let rk = 0; rk <= nR; rk++)
      for (let ck = 0; ck < nC; ck++)
        for (let dk = 0; dk <= nD; dk++)
          if (btNodeActive(rk, ck, dk) && btNodeActive(rk, ck + 1, dk))
            worktopProfileX++;

    // Worktop horizontale Profile Z-Richtung
    for (let rk = 0; rk <= nR; rk++)
      for (let ck = 0; ck <= nC; ck++)
        for (let dk = 0; dk < nD; dk++)
          if (btNodeActive(rk, ck, dk) && btNodeActive(rk, ck, dk + 1))
            worktopProfileZ++;

    // 360mm-Profile: je Vertikalkante eines BT-Knotens
    // = Anzahl aktive BT-Worktop-Knoten (jeder hat genau ein 360mm-Profil darunter)
    // Aber nur wenn der zugehoerige Basis-Knoten auch aktiv ist
    for (let rk = 0; rk <= nR; rk++)
      for (let ck = 0; ck <= nC; ck++)
        for (let dk = 0; dk <= nD; dk++)
          if (btNodeActive(rk, ck, dk) && nodeActive(rk, ck, dk))
            profil360++;

    // 213mm-Profile: nur wo ueber dem BT ein aktives regulaeres Modul angrenzt
    // D.h. wo sowohl btNodeActive als auch nodeActive am gleichen Knoten
    // UND der Knoten darueber (rk-1) ebenfalls nodeActive ist (Modul in row r-1)
    for (let rk = 0; rk <= nR; rk++)
      for (let ck = 0; ck <= nC; ck++)
        for (let dk = 0; dk <= nD; dk++) {
          if (!btNodeActive(rk, ck, dk)) continue;
          // Pruefe ob oberhalb ein regulaeres Modul existiert
          // Der BT sitzt in der untersten Reihe (r = nR-1), Knoten rk = nR-1 (oben am BT)
          // Ein Modul darueber waere bei r = nR-2 → Knoten rk-1 = nR-2
          if (rk > 0 && nodeActive(rk - 1, ck, dk) && nodeActive(rk, ck, dk)) {
            // Es gibt ein regulaeres Modul oberhalb → 213mm Anschlussprofil noetig
            // Aber nur wenn das nicht nur durch den BT selbst aktiv ist
            // Pruefe ob es eine nicht-BT-Zelle gibt die den oberen Knoten aktiviert
            let hasRegularAbove = false;
            const rMin = Math.max(0, rk - 2);
            const rMax = Math.min(nR - 1, rk - 1);
            const cMin = Math.max(0, ck - 1);
            const cMax = Math.min(nC - 1, ck);
            const dMin = Math.max(0, dk - 1);
            const dMax = Math.min(nD - 1, dk);
            for (let r2 = rMin; r2 <= rMax; r2++)
              for (let c2 = cMin; c2 <= cMax; c2++)
                for (let d2 = dMin; d2 <= dMax; d2++)
                  if (isActive(grid[r2]?.[c2]?.[d2] ?? { type: '' as CellType, shelves: 0 }) && !isBT(r2, c2, d2))
                    hasRegularAbove = true;
            if (hasRegularAbove) profil213++;
          }
        }

    // Regulaere vertikale Profile korrigieren:
    // Zwischen einem BT (unterste Reihe) und dem Knoten darueber ersetzt
    // der BT das 600mm-Profil durch 360+Wuerfel+213. Das 600mm-Profil muss
    // also subtrahiert werden, wenn ein 213mm-Profil dort eingefuegt wurde.
    // profileY wird bereits in pH gezaehlt — wir subtrahieren spaeter.
  }
```

- [ ] **Step 3: Update the return statement**

In `src/core/calc.ts`, update the return (line 169-180) to include new fields:

```typescript
  return {
    wuerfel,
    profileX, profileY, profileZ, profileTotal,
    framesStd, framesLit, framesTotal,
    shelves,
    profil360, profil213, fachbodenBT, wuerfelBT,
    worktopProfileX, worktopProfileZ,
    footerQty, footer,
    schraubenM4: (wuerfel + wuerfelBT) * HW_M4_PER_CUBE,
    schraubenM6: (wuerfel + wuerfelBT) * HW_M6_PER_CUBE,
    scheiben: (wuerfel + wuerfelBT) * HW_SCHEIBEN_PER_CUBE,
    einlegemuttern: (wuerfel + wuerfelBT) * HW_MUTTERN_PER_CUBE,
    numCols: nC, numRows: nR, numDepth: nD,
    totalWidth: nC * S, totalHeight: nR * S, totalDepth: nD * S,
    boardMap,
    warnings,
  };
```

Note: Hardware now includes `wuerfelBT` in the calculation.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: Fewer errors — `calc.ts` should compile. Remaining errors in BOMPanel.

- [ ] **Step 5: Commit**

```bash
git add src/core/calc.ts
git commit -m "feat(BT): extend computeBOM with Beratungstisch counting logic"
```

---

### Task 5: Update State Management

**Files:**
- Modify: `src/features/configurator/useConfigStore.ts`

- [ ] **Step 1: Import validation helpers**

In `src/features/configurator/useConfigStore.ts`, update the import on line 6:

```typescript
import { maxShelves, isBTBlocked } from '@/core/validation';
```

- [ ] **Step 2: Handle BT in setType**

Replace the `setType` action (lines 149-166):

```typescript
    setType: (r, c, t) => {
      setGravityError(null);
      update(s => {
        const grid: Grid = s.grid.map((rowArr, ri) =>
          rowArr.map((colArr, ci) => {
            if (ri !== r || ci !== c) return [...colArr];
            return colArr.map((cell) => {
              const max = maxShelves(s.rows[r]);
              const shelves = Math.min(cell.shelves, max);
              return { type: t, shelves };
            });
          })
        );

        let next = { ...s, grid };

        // BT: sicherstellen dass Reihe darueber existiert und leer ist
        if (t === 'BT') {
          if (r === 0) {
            // Keine Reihe darueber → addRowTop
            if (next.rows.length < MAX_ROWS) {
              const nD = next.depthLayers;
              const newRow: Cell[][] = Array.from({ length: next.cols.length }, () =>
                Array.from({ length: nD }, newCell)
              );
              next = {
                ...next,
                rows: [PAD_ROW_H, ...next.rows],
                grid: [newRow, ...next.grid],
              };
            }
          } else {
            // Zelle darueber leeren
            next = {
              ...next,
              grid: next.grid.map((rowArr, ri) =>
                rowArr.map((colArr, ci) => {
                  if (ri !== r - 1 || ci !== c) return colArr;
                  return colArr.map(cell => ({ ...cell, type: '' as CellType }));
                })
              ),
            };
          }
        }

        // BT entfernt: Sperrung aufheben (implizit durch trimEmptyEdges)
        return t === '' ? trimEmptyEdges(next) : next;
      });
    },
```

- [ ] **Step 3: Handle BT phantom behavior in expandAndActivate3D**

In the `expandAndActivate3D` action, phantoms next to a BT cell should create a BT (not a regular 'O' cell). Add after the gravity check (after line 446):

```typescript
        // BT-Sperrung: nicht aktivieren wenn BT darunter
        if (r + 1 < rows.length && (grid[r + 1]?.[c]?.[d]?.type ?? '') === 'BT') {
          return s;
        }

        // BT-Propagation: wenn ein Nachbar auf gleicher Reihe ein BT ist,
        // wird die neue Zelle ebenfalls ein BT (statt 'O')
        let activationType: CellType = 'O';
        const nR2 = rows.length;
        if (r === nR2 - 1) { // Nur in der untersten Reihe
          const neighbors = [
            grid[r]?.[c - 1]?.[d],
            grid[r]?.[c + 1]?.[d],
            grid[r]?.[c]?.[d - 1],
            grid[r]?.[c]?.[d + 1],
          ];
          if (neighbors.some(n => n?.type === 'BT')) {
            activationType = 'BT';
          }
        }
```

Then change the activation line from `{ type: 'O' as CellType, shelves: 0 }` to `{ type: activationType, shelves: 0 }`.

Additionally, when a BT is placed via phantom, the cell above must be kept empty. Add after the activation:

```typescript
        // BT: sicherstellen dass Reihe darueber frei ist
        if (activationType === 'BT' && r > 0) {
          grid = grid.map((rowArr, ri) =>
            rowArr.map((colArr, ci) => {
              if (ri !== r - 1 || ci !== c) return colArr;
              return colArr.map(cell => ({ ...cell, type: '' as CellType }));
            })
          );
        }
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No new errors from useConfigStore.

- [ ] **Step 5: Commit**

```bash
git add src/features/configurator/useConfigStore.ts
git commit -m "feat(BT): handle BT placement and blocking in state management"
```

---

### Task 6: Extend 3D Geometry

**Files:**
- Modify: `src/features/preview3d/useModuleGeometry.ts`

- [ ] **Step 1: Import BT constants**

In `src/features/preview3d/useModuleGeometry.ts`, update the import on line 3:

```typescript
import { ELEMENT_SIZE_MM, PROFILE_COLOR_BY_V, FRAME_GROUP_BY_V, BT_PROFILE_UPPER_MM, BT_PROFILE_LOWER_MM, CUBE_SIZE_MM } from '@/core/constants';
```

- [ ] **Step 2: Add 'profil360' and 'profil213' to SceneObject partType**

In `src/features/preview3d/useModuleGeometry.ts`, update the partType union (lines 9-14):

```typescript
  partType:
    | 'profil' | 'wuerfel' | 'front' | 'fachboden'
    | 'stellfuss' | 'rolle'
    | 'profil360' | 'profil213'
    // Lightmodul-Kompatibilitaets-Typen
    | 'seite_l' | 'seite_r' | 'boden' | 'deckel' | 'ruecken'
    | 'zwischenboden' | 'zwischenwand' | 'eckverbinder' | 'handle';
```

- [ ] **Step 3: Add BT geometry generation**

In `src/features/preview3d/useModuleGeometry.ts`, add after the Stellfuesse section (after line 248) and before `return objs;` (line 250):

```typescript
  // ── Beratungstisch-Erhoehung ────────────────────────────────────────────
  const BT_UP = BT_PROFILE_UPPER_MM;  // 360mm
  const BT_LO = BT_PROFILE_LOWER_MM;  // 213mm

  const isBTCell = (r: number, c: number, d: number): boolean => {
    if (r < 0 || r >= nR || c < 0 || c >= nC || d < 0 || d >= nD) return false;
    return grid[r]?.[c]?.[d]?.type === 'BT';
  };

  // Worktop-Knoten: aktiv wenn mind. ein angrenzender BT
  const btNodeActive = (rk: number, ck: number, dk: number): boolean => {
    for (let r2 = Math.max(0, rk - 1); r2 <= Math.min(nR - 1, rk); r2++)
      for (let c2 = Math.max(0, ck - 1); c2 <= Math.min(nC - 1, ck); c2++)
        for (let d2 = Math.max(0, dk - 1); d2 <= Math.min(nD - 1, dk); d2++)
          if (isBTCell(r2, c2, d2)) return true;
    return false;
  };

  // BT-Zellen sitzen immer in der untersten Reihe (r = nR-1)
  // Worktop-Knoten sind auf der Oberkante der BT-Reihe (rk = nR-1)
  // Die Worktop-Hoehe ist 360mm ueber dem Oberkanten-Knoten
  const btRk = nR - 1; // Knoten-Reihe an Oberkante der untersten Zellen-Reihe

  for (let ck = 0; ck <= nC; ck++) {
    for (let dk = 0; dk <= nD; dk++) {
      if (!btNodeActive(btRk, ck, dk)) continue;

      const wx = xBase + ck * S;
      const wyBase = yBase + (nR - btRk) * S; // Hoehe des Oberkanten-Knotens
      const wz = zBase + dk * S;

      // Worktop-Zwischenwuerfel (auf Hoehe wyBase + BT_UP)
      const wyWorktop = wyBase + BT_UP;
      objs.push({
        id:       `bt_wuerfel_ck${ck}_dk${dk}`,
        partType: 'wuerfel',
        position: [wx * s, wyWorktop * s, wz * s],
        size:     [C * s, C * s, C * s],
        color:    matColor,
        roughness: 0.3,
        metalness: 0.7,
      });

      // 360mm Vertikalprofil (vom Oberkanten-Wuerfel zum Worktop-Wuerfel)
      const prof360Y = wyBase + BT_UP / 2;
      objs.push({
        id:       `bt_p360_ck${ck}_dk${dk}`,
        partType: 'profil360',
        position: [wx * s, prof360Y * s, wz * s],
        size:     [P * s, (BT_UP - C) * s, P * s],
        color:    matColor,
        roughness: 0.2,
        metalness: 0.8,
      });

      // 213mm Anschlussprofil: nur wenn oberhalb ein regulaeres Modul existiert
      if (btRk > 0 && nodeActive(btRk - 1, ck, dk)) {
        // Pruefe ob nicht-BT-Zelle den oberen Knoten aktiviert
        let hasRegularAbove = false;
        for (let r2 = Math.max(0, btRk - 2); r2 <= Math.min(nR - 1, btRk - 1); r2++)
          for (let c2 = Math.max(0, ck - 1); c2 <= Math.min(nC - 1, ck); c2++)
            for (let d2 = Math.max(0, dk - 1); d2 <= Math.min(nD - 1, dk); d2++)
              if (isActive(r2, c2, d2) && !isBTCell(r2, c2, d2))
                hasRegularAbove = true;

        if (hasRegularAbove) {
          const wyUpper = yBase + (nR - btRk + 1) * S; // Knoten eine Reihe hoeher
          const prof213Y = wyWorktop + (wyUpper - wyWorktop) / 2;
          objs.push({
            id:       `bt_p213_ck${ck}_dk${dk}`,
            partType: 'profil213',
            position: [wx * s, prof213Y * s, wz * s],
            size:     [P * s, (BT_LO - C) * s, P * s],
            color:    matColor,
            roughness: 0.2,
            metalness: 0.8,
          });
        }
      }
    }
  }

  // Worktop horizontale Profile (X-Richtung)
  for (let ck = 0; ck < nC; ck++) {
    for (let dk = 0; dk <= nD; dk++) {
      if (!btNodeActive(btRk, ck, dk) || !btNodeActive(btRk, ck + 1, dk)) continue;

      const wx = xBase + ck * S + S / 2;
      const wy = yBase + (nR - btRk) * S + BT_UP;
      const wz = zBase + dk * S;

      objs.push({
        id:       `bt_pX_ck${ck}_dk${dk}`,
        partType: 'profil',
        position: [wx * s, wy * s, wz * s],
        size:     [(S - C) * s, P * s, P * s],
        color:    matColor,
        roughness: 0.2,
        metalness: 0.8,
      });
    }
  }

  // Worktop horizontale Profile (Z-Richtung)
  for (let ck = 0; ck <= nC; ck++) {
    for (let dk = 0; dk < nD; dk++) {
      if (!btNodeActive(btRk, ck, dk) || !btNodeActive(btRk, ck, dk + 1)) continue;

      const wx = xBase + ck * S;
      const wy = yBase + (nR - btRk) * S + BT_UP;
      const wz = zBase + dk * S + S / 2;

      objs.push({
        id:       `bt_pZ_ck${ck}_dk${dk}`,
        partType: 'profil',
        position: [wx * s, wy * s, wz * s],
        size:     [P * s, P * s, (S - C) * s],
        color:    matColor,
        roughness: 0.2,
        metalness: 0.8,
      });
    }
  }

  // Worktop-Fachboden (Arbeitsplatte)
  for (let r = 0; r < nR; r++) {
    for (let c = 0; c < nC; c++) {
      for (let d = 0; d < nD; d++) {
        if (!isBTCell(r, c, d)) continue;

        const cellCenterX = xBase + (c + 0.5) * S;
        const worktopY = yBase + (nR - r) * S + BT_UP;
        const cellCenterZ = zBase + (d + 0.5) * S;

        objs.push({
          id:       `bt_shelf_r${r}_c${c}_d${d}`,
          partType: 'fachboden',
          position: [cellCenterX * s, worktopY * s, cellCenterZ * s],
          size:     [(S - P * 2) * s, 8 * s, (S - P * 2) * s],
          color:    '#C0B8A8',
          row:      r,
          col:      c,
          depth:    d,
          roughness: 0.8,
          metalness: 0.0,
        });
      }
    }
  }

  // Regulaere vertikale Profile am BT-Anschluss entfernen:
  // Wo ein 213mm+360mm das 600mm-Profil ersetzt, wurde das 600mm schon gerendert.
  // Die korrekte Loesung ist, in der vertikalen Profil-Schleife oben zu pruefen,
  // ob dort ein BT-Split vorliegt. Dazu muessen wir die bestehende Schleife anpassen.
  // → Siehe Step 4.
```

- [ ] **Step 4: Modify vertical profile loop to skip BT-split profiles**

In the existing vertical profile loop (lines 142-163), update the skip condition. Replace:

```typescript
        if (!nodeActive(rk, ck, dk) || !nodeActive(rk + 1, ck, dk)) continue;
```

With:

```typescript
        if (!nodeActive(rk, ck, dk) || !nodeActive(rk + 1, ck, dk)) continue;

        // BT-Split: wenn am Worktop-Niveau ein BT-Knoten liegt UND
        // oberhalb ein regulaeres Modul existiert, wird das 600mm-Profil
        // durch 360+Wuerfel+213 ersetzt → kein regulaeres Profil rendern
        if (rk === btRk && btNodeActive(btRk, ck, dk)) {
          // Pruefe ob oben regulaeres Modul
          let hasRegAbove = false;
          for (let r2 = Math.max(0, btRk - 2); r2 <= Math.min(nR - 1, btRk - 1); r2++)
            for (let c2 = Math.max(0, ck - 1); c2 <= Math.min(nC - 1, ck); c2++)
              for (let d2 = Math.max(0, dk - 1); d2 <= Math.min(nD - 1, dk); d2++)
                if (isActive(r2, c2, d2) && !isBTCell(r2, c2, d2))
                  hasRegAbove = true;
          if (hasRegAbove) continue; // Skip — wird durch 360+213 ersetzt
        }
```

Note: `btRk`, `btNodeActive`, and `isBTCell` must be defined before this loop. Move the BT helper functions and `btRk` constant to just after the `nodeActive` definition (after line 91), before the cube loop.

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors in useModuleGeometry.

- [ ] **Step 6: Commit**

```bash
git add src/features/preview3d/useModuleGeometry.ts
git commit -m "feat(BT): render Beratungstisch 3D geometry with split profiles"
```

---

### Task 7: Update UI Components

**Files:**
- Modify: `src/features/configurator/SidebarElement.tsx`

- [ ] **Step 1: Pass grid context to getAvailableCellTypes**

In `src/features/configurator/SidebarElement.tsx`, update the call on line 22:

```typescript
  const availableTypes = getAvailableCellTypes(row, col, 0, state.grid, state.cols.length, state.depthLayers);
```

- [ ] **Step 2: Handle BT-blocked cells**

In `src/features/configurator/SidebarElement.tsx`, add import and early return for blocked cells:

```typescript
import { getAvailableCellTypes, isBTBlocked } from '@/core/validation';
```

After the `if (!cell) return null;` check (line 18), add:

```typescript
  // Durch BT darunter gesperrte Zelle
  if (isBTBlocked(state.grid, row, col, 0)) {
    return (
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{
          background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8,
          padding: '10px 12px', marginBottom: 16,
        }}>
          <span style={{
            fontFamily: 'var(--font-sans)', fontWeight: 600,
            fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#92400E',
          }}>
            Gesperrt
          </span>
          <p style={{ fontSize: 11, color: '#B45309', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
            Diese Position ist durch den Beratungstisch darunter belegt.
          </p>
        </div>
      </div>
    );
  }
```

- [ ] **Step 3: Hide shelf controls for BT cells**

In `src/features/configurator/SidebarElement.tsx`, wrap the Fachboeden section in a condition:

```typescript
      {cell.type !== 'BT' && (
        <>
          <Divider />
          {/* -- FACHBOEDEN -- */}
          <Section label="Fachboeden">
            {/* ... existing shelf controls ... */}
          </Section>
        </>
      )}
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/configurator/SidebarElement.tsx
git commit -m "feat(BT): update sidebar with BT option and blocked cell display"
```

---

### Task 8: Update BOM Panel

**Files:**
- Modify: `src/features/bom/BOMPanel.tsx`

- [ ] **Step 1: Add BT totals to summary grid**

In `src/features/bom/BOMPanel.tsx`, in the totals grid (around lines 305-323), add after the hardware entry:

```typescript
            ...(bom.fachbodenBT > 0 ? [{ id: 'bt', v: bom.fachbodenBT, l: 'Beratungstische' }] : []),
```

- [ ] **Step 2: Add BT BOM groups**

In `src/features/bom/BOMPanel.tsx`, add after the Stellfuesse group (after line 390) and before the PriceSection:

```typescript
        {bom.fachbodenBT > 0 && (
          <Group title="Beratungstisch" total={bom.fachbodenBT + bom.profil360 + bom.profil213 + bom.wuerfelBT + bom.worktopProfileX + bom.worktopProfileZ} csym={csym}>
            <BRow name="Arbeitsplatte (Fachboden)" sub="" qty={bom.fachbodenBT} csym={csym}
              pi={pr('BT_Fachboden', undefined, bom.fachbodenBT)} />
            <BRow name="Profil 360mm" sub="" qty={bom.profil360} csym={csym}
              pi={pr('BT_Profil', '360', bom.profil360)} />
            {bom.profil213 > 0 && (
              <BRow name="Profil 213mm" sub="" qty={bom.profil213} csym={csym}
                pi={pr('BT_Profil', '213', bom.profil213)} />
            )}
            <BRow name="Worktop-Profile X" sub="600mm" qty={bom.worktopProfileX} csym={csym}
              pi={pr('BT_Profil', '600', bom.worktopProfileX)} />
            <BRow name="Worktop-Profile Z" sub="600mm" qty={bom.worktopProfileZ} csym={csym}
              pi={pr('BT_Profil', '600', bom.worktopProfileZ)} />
            <BRow name="Zwischenwuerfel" sub="" qty={bom.wuerfelBT} csym={csym}
              pi={pr('BT_Wuerfel', undefined, bom.wuerfelBT)} />
          </Group>
        )}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Manual browser test**

1. `npm run dev`
2. Open configurator
3. Place a regular `'O'` cell
4. Change cell type to `'BT'` — verify:
   - Row above is added/cleared automatically
   - 3D preview shows base cube + 360mm extension + worktop frame + fachboden
   - BOM panel shows Beratungstisch section with correct counts
5. Place a second BT next to the first — verify shared profiles
6. Place a regular module above-left of the BT — verify 213mm connection profiles appear
7. Remove the BT — verify blocked cell released, grid trims

- [ ] **Step 5: Commit**

```bash
git add src/features/bom/BOMPanel.tsx
git commit -m "feat(BT): display Beratungstisch items in BOM panel"
```

---

### Task 9: Update XLS Export

**Files:**
- Modify: `src/features/bom/exportXLS.ts`

- [ ] **Step 1: Read exportXLS.ts**

Read the file to understand the current row structure.

- [ ] **Step 2: Add BT rows to XLS export**

Add BT entries to `buildBOMRowsExtended()` after existing rows, conditional on `bom.fachbodenBT > 0`:

```typescript
  if (bom.fachbodenBT > 0) {
    rows.push(['', 'BERATUNGSTISCH', '', '', '', '']);
    rows.push(['', 'Arbeitsplatte (Fachboden)', '', String(bom.fachbodenBT), '', '']);
    rows.push(['', 'Profil 360mm', '', String(bom.profil360), '', '']);
    if (bom.profil213 > 0) {
      rows.push(['', 'Profil 213mm', '', String(bom.profil213), '', '']);
    }
    rows.push(['', 'Worktop-Profile X 600mm', '', String(bom.worktopProfileX), '', '']);
    rows.push(['', 'Worktop-Profile Z 600mm', '', String(bom.worktopProfileZ), '', '']);
    rows.push(['', 'Zwischenwuerfel', '', String(bom.wuerfelBT), '', '']);
  }
```

(Exact column layout must match the existing export structure — adjust after reading the file.)

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/bom/exportXLS.ts
git commit -m "feat(BT): include Beratungstisch items in XLS export"
```

---

### Task 10: Final Integration Test

- [ ] **Step 1: Full compilation check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Comprehensive manual test**

Test these scenarios in the browser:

1. **Standalone BT:** Place a single BT, verify 3D + BOM
2. **BT row:** Place 3 BTs side-by-side, verify shared profiles in 3D and correct counts in BOM
3. **BT L-shape:** Place BTs in an L-shape (column + depth), verify corner sharing
4. **BT + Regal:** Place regular modules adjacent to BT, verify 213mm connection profiles
5. **BT removal:** Remove BT, verify blocking released, trim works
6. **Edge-only:** Try to place BT in center of grid — should be blocked
7. **No stacking:** Try to place module on top of BT — should be blocked
8. **XLS export:** Export BOM with BT, verify new rows present

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: Beratungstisch (consultation table) module — complete implementation"
```
