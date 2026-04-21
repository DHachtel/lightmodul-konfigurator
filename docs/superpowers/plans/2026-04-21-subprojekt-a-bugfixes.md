# Sub-Projekt A: Bugfixes & Anpassungen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix BT shelves (3 statt 1), enable U-form configs, fix gravity cascade on delete, prepare Stellfuss GLB, improve delete UX, rename drill levels to Shop/Produktrahmen.

**Architecture:** 6 independent fixes touching core logic (calc, validation, geometry), state management (useConfigStore), and UI (Preview3D, Breadcrumb, useDrillDown). Each task is self-contained and can be committed independently.

**Tech Stack:** TypeScript, React, Three.js / React Three Fiber

**No test framework** — verification via `tsc --noEmit` and manual browser testing.

---

### Task 1: BT-Fachboden — 3 Stueck statt 1

**Files:**
- Modify: `src/features/preview3d/useModuleGeometry.ts` (BT fachboden section, ~lines 411-435)
- Modify: `src/core/calc.ts` (fachbodenBT counting, ~lines 151-167)

- [ ] **Step 1: Add 3 fachboden levels in useModuleGeometry.ts**

Find the BT fachboden loop (search for `bt_shelf`). Replace the single fachboden with 3:

```typescript
  // Worktop-Fachboden: 3 Ebenen pro BT-Zelle (unten, mitte, oben)
  for (let r = 0; r < nR; r++) {
    for (let c = 0; c < nC; c++) {
      for (let d = 0; d < nD; d++) {
        if (!isBTCell(r, c, d)) continue;

        const cellCenterX = xBase + (c + 0.5) * S;
        const cellCenterZ = zBase + (d + 0.5) * S;
        const shelfSize: [number, number, number] = [(S - P * 2) * s, 8 * s, (S - P * 2) * s];
        const shelfColor = '#C0B8A8';

        // Unterer Fachboden (Bodenniveau, Y = Unterkante Basiskubus)
        const yBottom = yBase + (nR - r - 1) * S;
        objs.push({
          id:       `bt_shelf_bot_r${r}_c${c}_d${d}`,
          partType: 'fachboden',
          position: [cellCenterX * s, yBottom * s, cellCenterZ * s],
          size:     shelfSize,
          color:    shelfColor,
          row: r, col: c, depth: d,
          roughness: 0.8, metalness: 0.0,
        });

        // Mittlerer Fachboden (Oberkante Basiskubus, Y = 600mm ueber Unterkante)
        const yMiddle = yBase + (nR - r) * S;
        objs.push({
          id:       `bt_shelf_mid_r${r}_c${c}_d${d}`,
          partType: 'fachboden',
          position: [cellCenterX * s, yMiddle * s, cellCenterZ * s],
          size:     shelfSize,
          color:    shelfColor,
          row: r, col: c, depth: d,
          roughness: 0.8, metalness: 0.0,
        });

        // Oberer Fachboden / Arbeitsplatte (Worktop-Niveau, Y = 960mm)
        const yTop = yBase + (nR - r) * S + BT_UP;
        objs.push({
          id:       `bt_shelf_top_r${r}_c${c}_d${d}`,
          partType: 'fachboden',
          position: [cellCenterX * s, yTop * s, cellCenterZ * s],
          size:     shelfSize,
          color:    shelfColor,
          row: r, col: c, depth: d,
          roughness: 0.8, metalness: 0.0,
        });
      }
    }
  }
```

- [ ] **Step 2: Update BOM counting in calc.ts**

Find `fachbodenBT++` in the BT counting loop. Change to `fachbodenBT += 3`:

```typescript
  for (let r = 0; r < nR; r++)
    for (let c = 0; c < nC; c++)
      for (let d = 0; d < nD; d++) {
        if (!isBT(r, c, d)) continue;
        fachbodenBT += 3; // 3 Fachboeden pro BT: unten, mitte, oben
      }
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/preview3d/useModuleGeometry.ts src/core/calc.ts
git commit -m "feat(BT): 3 Fachboeden pro Beratungstisch (unten, mitte, oben)"
```

---

### Task 2: U-Form / Innenhof — addDepthFront Fix

**Files:**
- Modify: `src/features/configurator/useConfigStore.ts` (~line 248-259, addDepthFront)

- [ ] **Step 1: Fix addDepthFront to create empty cells**

Find `addDepthFront` (search for `addDepthFront`). Change the cell creation from copying the last layer to always creating empty cells:

```typescript
    addDepthFront: () => update(s => {
      if (s.depthLayers >= MAX_DEPTH) return s;
      const nD = s.depthLayers + 1;
      // Neue Tiefenebene immer leer (nicht letzte Ebene kopieren)
      const grid: Grid = s.grid.map(rowArr =>
        rowArr.map(colArr => {
          return [...colArr, newCell()];
        })
      );
      return { ...s, depthLayers: nD, grid };
    }),
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/configurator/useConfigStore.ts
git commit -m "fix: addDepthFront erzeugt leere Zellen statt Kopie (ermoeglicht U-Form)"
```

---

### Task 3: Gravity-Kaskade beim Loeschen

**Files:**
- Modify: `src/features/configurator/useConfigStore.ts` (setCellType3D ~line 374, setType ~line 149)

- [ ] **Step 1: Add cascadeGravity helper**

Add this helper function after `trimEmptyEdges` (after ~line 61) and before `buildGrid3D`:

```typescript
/** Entfernt alle Zellen die nach einer Aenderung keinen Support mehr haben (Schwerkraft-Kaskade) */
function cascadeGravity(grid: Grid): Grid {
  const nR = grid.length;
  const nC = grid[0]?.length ?? 0;
  const nD = grid[0]?.[0]?.length ?? 0;
  let changed = true;

  // Kopie erstellen
  let g: Grid = grid.map(rowArr =>
    rowArr.map(colArr => colArr.map(cell => ({ ...cell })))
  );

  // Iterativ alle schwebenden Zellen entfernen (von oben nach unten)
  while (changed) {
    changed = false;
    for (let r = 0; r < nR; r++) {
      for (let c = 0; c < nC; c++) {
        for (let d = 0; d < nD; d++) {
          if (g[r][c][d].type === '') continue;
          const isBottom = r === nR - 1;
          const hasSupport = isBottom || g[r + 1]?.[c]?.[d]?.type !== '';
          if (!hasSupport) {
            g[r][c][d] = { type: '' as CellType, shelves: 0 };
            changed = true;
          }
        }
      }
    }
  }
  return g;
}
```

- [ ] **Step 2: Apply cascadeGravity in setCellType3D**

In `setCellType3D`, after setting the cell type to `''`, apply gravity cascade. Find:

```typescript
        const next = { ...s, grid };
        return t === '' ? trimEmptyEdges(next) : next;
```

Replace with:

```typescript
        let next = { ...s, grid };
        if (t === '') {
          next = { ...next, grid: cascadeGravity(next.grid) };
          next = trimEmptyEdges(next);
        }
        return next;
```

- [ ] **Step 3: Apply cascadeGravity in setType**

In `setType`, find the same pattern:

```typescript
        let next = { ...s, grid };

        // Nach Entfernen (type='') automatisch leere Raender aufraeumen
        return t === '' ? trimEmptyEdges(next) : next;
```

Replace with:

```typescript
        let next = { ...s, grid };
        if (t === '') {
          next = { ...next, grid: cascadeGravity(next.grid) };
          next = trimEmptyEdges(next);
          return next;
        }
        return next;
```

- [ ] **Step 4: Add CellType import for cascadeGravity**

Ensure `CellType` is available in the scope of `cascadeGravity`. It's already imported at the top of the file:

```typescript
import type { BOMResult, Cell, CellType, ConfigState, Grid } from '@/core/types';
```

No change needed if this import exists.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/configurator/useConfigStore.ts
git commit -m "fix: Gravity-Kaskade entfernt schwebende Elemente beim Loeschen"
```

---

### Task 4: Stellfuss GLB vorbereiten

**Files:**
- Modify: `src/features/preview3d/useModuleGeometry.ts` (~lines 287-307, Stellfuss section)

- [ ] **Step 1: Add glbFile to Stellfuss objects**

Find the Stellfuss rendering loop (search for `foot_ck`). Add `glbFile` property:

```typescript
  // ── Stellfüße ─────────────────────────────────────────────────────────────
  if (state.opts?.footer !== false) {
    for (let ck = 0; ck <= nC; ck++) {
      for (let dk = 0; dk <= nD; dk++) {
        if (!nodeActive(nR, ck, dk)) continue;

        const wx = xBase + ck * S;
        const wz = zBase + dk * S;

        objs.push({
          id:       `foot_ck${ck}_dk${dk}`,
          partType: 'stellfuss',
          position: [wx * s, -25 * s, wz * s],
          size:     [20 * s, 50 * s, 20 * s],
          color:    '#707070',
          glbFile:  '/models/stellfuss-m6.glb',
          roughness: 0.6,
          metalness: 0.3,
        });
      }
    }
  }
```

SmartMesh already handles `glbPath` fallback — if the GLB file doesn't exist yet, it renders the box geometry.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/useModuleGeometry.ts
git commit -m "feat: Stellfuss GLB-Pfad vorbereitet (Fallback auf Box bis GLB vorliegt)"
```

---

### Task 5: Verbessertes Loeschen (X-Button nur am selektierten Element)

**Files:**
- Modify: `src/features/preview3d/Preview3D.tsx` (cellButtons ~lines 876-940, rendering ~lines 1154-1163)

- [ ] **Step 1: Filter cellButtons to only selected element**

Find the `cellButtons` useMemo (search for `const cellButtons`). Add `selectedCell` to the filter logic. Replace the entire useMemo:

```typescript
  const cellButtons = useMemo(() => {
    const removes: { row: number; col: number; position: [number, number, number] }[] = [];

    // Nur X-Button am selektierten Element anzeigen
    if (!selectedCell) return { removes };

    const nR = state.rows.length;
    const nC = state.cols.length;
    const nD = state.depthLayers;
    const sEl = ELEMENT_SIZE_MM;
    const totalW = nC * sEl;
    const totalD = nD * sEl;
    const xBase = -totalW / 2;
    const yBase = 0;
    const zBase = -totalD / 2;

    const r = selectedCell.row;
    const c = selectedCell.col;

    const activeAny = (row: number, col: number) =>
      row >= 0 && row < nR && col >= 0 && col < nC &&
      (state.grid[row]?.[col]?.some(cell => cell.type !== '') ?? false);

    if (!activeAny(r, c)) return { removes };

    // Position: Zentrum des Wuerfels
    const cx = (xBase + (c + 0.5) * sEl) * S;
    const cy = (yBase + (nR - r - 0.5) * sEl) * S;
    const cz = (zBase + nD * 0.5 * sEl) * S;

    removes.push({ row: r, col: c, position: [cx, cy, cz] });

    return { removes };
  }, [state.grid, state.cols, state.rows, state.depthLayers, selectedCell]);
```

- [ ] **Step 2: Update RemoveButton component for larger size and hover effect**

Find the `RemoveButton` component (search for `function RemoveButton`). Update it to be larger (32px) and add hover-red feedback. Find the existing component and replace:

```typescript
function RemoveButton({ position, onClick }: {
  position: [number, number, number];
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Html position={position} center style={{ pointerEvents: 'auto' }}>
      <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onMouseEnter={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
        onMouseLeave={() => { setHovered(false); document.body.style.cursor = ''; }}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: hovered ? '#EF4444' : 'rgba(120,120,120,0.7)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: hovered ? '0 0 12px rgba(239,68,68,0.5)' : '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >×</div>
    </Html>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Manual test**

1. Click on an element in 3D — green highlight appears
2. X-button appears at center of selected element only (not on all elements)
3. Hover over X — it turns red
4. Click X — element is deleted, gravity cascade removes unsupported elements above

- [ ] **Step 5: Commit**

```bash
git add src/features/preview3d/Preview3D.tsx
git commit -m "fix: X-Button nur am selektierten Element, groesser, Hover-Rot"
```

---

### Task 6: Ebenen-Umbenennung (Shop / Produktrahmen)

**Files:**
- Modify: `src/features/preview3d/useDrillDown.ts` (DrillLevel type + all logic)
- Modify: `src/features/preview3d/Breadcrumb.tsx` (labels + nav items)
- Modify: `src/features/preview3d/Preview3D.tsx` (drillLevel prop type + references)
- Modify: `src/features/configurator/ConfiguratorShell.tsx` (sidebar switch + drillLevel references)

- [ ] **Step 1: Update DrillLevel type in useDrillDown.ts**

Find `type DrillLevel` (line 7). Replace:

```typescript
export type DrillLevel = 'shop' | 'produktrahmen';
```

Update `DrillState` (remove `selectedPlateId` and `selectedPlateType`):

```typescript
export interface DrillState {
  level: DrillLevel;
  selectedCell: { row: number; col: number } | null;
}
```

Update `DrillActions` (remove `handlePlateClick`, simplify):

```typescript
export interface DrillActions {
  handleMeshClick: (row: number, col: number) => void;
  handleMiss: () => void;
  goToLevel: (level: DrillLevel) => void;
  goUp: () => void;
}
```

Rewrite the hook implementation to only handle 2 levels:

```typescript
export function useDrillDown(): [DrillState, DrillActions] {
  const [level, setLevel] = useState<DrillLevel>('shop');
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);

  const handleMeshClick = useCallback((row: number, col: number) => {
    if (level === 'shop') {
      if (selectedCell?.row === row && selectedCell?.col === col) {
        // Doppelklick auf selbe Zelle → drill to produktrahmen
        setLevel('produktrahmen');
      } else {
        setSelectedCell({ row, col });
      }
    } else {
      // produktrahmen: Klick auf andere Zelle → wechsle Zelle
      setSelectedCell({ row, col });
    }
  }, [level, selectedCell]);

  const handleMiss = useCallback(() => {
    setLevel('shop');
    setSelectedCell(null);
  }, []);

  const goToLevel = useCallback((l: DrillLevel) => {
    setLevel(l);
    if (l === 'shop') setSelectedCell(null);
  }, []);

  const goUp = useCallback(() => {
    if (level === 'produktrahmen') {
      setLevel('shop');
      setSelectedCell(null);
    }
  }, [level]);

  return [{ level, selectedCell }, { handleMeshClick, handleMiss, goToLevel, goUp }];
}
```

- [ ] **Step 2: Update Breadcrumb.tsx**

Replace the nav items array to show 2 levels:

```typescript
export default function Breadcrumb({ level, selectedCell, onGoToLevel }: {
  level: DrillLevel;
  selectedCell: { row: number; col: number } | null;
  onGoToLevel: (level: DrillLevel) => void;
}) {
  const elementLabel = selectedCell
    ? `R${selectedCell.row + 1} / C${selectedCell.col + 1}`
    : 'Produktrahmen';

  const items = [
    { label: 'Shop', level: 'shop' as DrillLevel, active: level === 'shop', reachable: true },
    { label: elementLabel, level: 'produktrahmen' as DrillLevel, active: level === 'produktrahmen', reachable: !!selectedCell },
  ];

  // ... rest of rendering stays the same but remove Platte references
```

Remove the `selectedPlateType` prop and `PART_LABELS` map. Update the `BreadcrumbProps` interface accordingly.

- [ ] **Step 3: Update Preview3D.tsx drillLevel prop**

Find the `drillLevel` prop type in Preview3DProps interface. Change:

```typescript
  drillLevel?: 'shop' | 'produktrahmen';
```

Update the default value:

```typescript
  drillLevel = 'shop',
```

Remove all `'platte'` references. Remove `selectedPlateId` prop. Update highlight rendering:

```typescript
      {selectedCell && drillLevel === 'produktrahmen' && (
        <SelectionHighlight objects={objects} row={selectedCell.row} col={selectedCell.col} />
      )}
```

Remove `PlateHighlight` rendering.

- [ ] **Step 4: Update ConfiguratorShell.tsx**

Update the sidebar conditional rendering. Remove `SidebarPlatte`:

```typescript
          {drill.level === 'produktrahmen' && drill.selectedCell ? (
            <SidebarElement state={state} actions={actions} row={drill.selectedCell.row} col={drill.selectedCell.col} />
          ) : (
            <SidebarMoebel state={state} actions={actions} pgAvail={pgAvail} placementType={placementType} onPlacementTypeChange={setPlacementType} />
          )}
```

Update `onPlateClick` references — replace with `onMeshClick` only. Remove `handlePlateClick` from drillActions usage.

Update the `<Preview3D>` props:

```typescript
          onMeshClick={drillActions.handleMeshClick}
          onMiss={drillActions.handleMiss}
          drillLevel={drill.level}
          selectedCell={drill.selectedCell}
```

Remove `onPlateClick`, `selectedPlateId` props.

- [ ] **Step 5: Remove SidebarPlatte import**

In ConfiguratorShell.tsx, remove the SidebarPlatte import if it exists. The component file can remain for now but won't be rendered.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: 0 errors. This may require fixing additional references to `'moebel'`, `'element'`, `'platte'` throughout the codebase. Search for these strings and update all occurrences.

- [ ] **Step 7: Commit**

```bash
git add src/features/preview3d/useDrillDown.ts src/features/preview3d/Breadcrumb.tsx src/features/preview3d/Preview3D.tsx src/features/configurator/ConfiguratorShell.tsx
git commit -m "refactor: Ebenen umbenannt — Moebel→Shop, Element→Produktrahmen, Platte entfernt"
```

---

### Task 7: Final Integration Test

- [ ] **Step 1: Full compilation check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Manual browser tests**

1. **BT 3 Fachboeden:** Platziere einen BT — pruefe ob 3 Fachboeden sichtbar (unten, mitte, oben)
2. **U-Form:** Baue eine 3x3-Grundflaeche, entferne die mittlere Tiefenzelle — Luecke bleibt bestehen
3. **Gravity:** Baue 3 Wuerfel uebereinander, entferne den mittleren — oberer faellt/verschwindet
4. **Stellfuss:** Stellfuesse werden gerendert (Box-Fallback bis GLB vorliegt)
5. **Loeschen:** Klicke auf einen Wuerfel — X erscheint nur an diesem, wird rot bei Hover, loescht bei Klick
6. **Ebenen:** Breadcrumb zeigt "Shop > Produktrahmen", Drill-Down funktioniert mit 2 Ebenen

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: Sub-Projekt A komplett — Bugfixes & Anpassungen"
```
