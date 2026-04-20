# 9 Konfigurator-Verbesserungen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 9 UX/visual/logic improvements for the Artmodul furniture configurator.

**Architecture:** Changes span core constants, validation logic, state management, 3D rendering, and UI components. Each task is independent and commits separately. No new dependencies needed — all work uses existing Three.js, React Three Fiber, and lucide-react.

**Tech Stack:** Next.js 16, TypeScript strict, React Three Fiber, @react-three/drei (CameraControls, Html), Three.js, lucide-react

---

### Task 1: Farb-Chips quadratisch mit abgerundeten Ecken

**Files:**
- Modify: `src/features/configurator/SidebarMoebel.tsx:161`
- Modify: `src/features/configurator/SidebarElement.tsx:167`
- Modify: `src/features/configurator/SidebarPlatte.tsx:133`

- [ ] **Step 1: Change CHIP borderRadius in SidebarMoebel.tsx**

In `src/features/configurator/SidebarMoebel.tsx` line 161, change:
```typescript
  width: 28, height: 28, borderRadius: '50%',
```
to:
```typescript
  width: 28, height: 28, borderRadius: '6px',
```

- [ ] **Step 2: Change CHIP borderRadius in SidebarElement.tsx**

In `src/features/configurator/SidebarElement.tsx` line 167, change:
```typescript
  width: 28, height: 28, borderRadius: '50%',
```
to:
```typescript
  width: 28, height: 28, borderRadius: '6px',
```

- [ ] **Step 3: Change CHIP borderRadius in SidebarPlatte.tsx**

In `src/features/configurator/SidebarPlatte.tsx` line 133, change:
```typescript
  width: 28, height: 28, borderRadius: '50%',
```
to:
```typescript
  width: 28, height: 28, borderRadius: '6px',
```

- [ ] **Step 4: Verify — run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/features/configurator/SidebarMoebel.tsx src/features/configurator/SidebarElement.tsx src/features/configurator/SidebarPlatte.tsx
git commit -m "UI: Farb-Chips quadratisch mit abgerundeten Ecken (borderRadius 6px)"
```

---

### Task 2: "Kein Griff" entfernen, Default = Bridge

**Files:**
- Modify: `src/core/constants.ts:50-51`
- Modify: `src/features/configurator/useConfigStore.ts:34`
- Modify: `src/features/configurator/SidebarMoebel.tsx:105-125`
- Modify: `src/features/bom/BOMPanel.tsx:714-727`
- Modify: `src/core/validation.ts:190-196`
- Modify: `src/features/preview3d/useModuleGeometry.ts` (handle guard)

- [ ] **Step 1: Remove 'none' handle from constants.ts**

In `src/core/constants.ts` line 50-51, remove the first entry:
```typescript
export const HANDLES: Handle[] = [
  { v: 'none',         l: '— kein Griff',         lb: null },
```
Change to:
```typescript
export const HANDLES: Handle[] = [
```
(The next line `{ v: 'push', ...}` becomes the first entry.)

- [ ] **Step 2: Change default handle in useConfigStore.ts**

In `src/features/configurator/useConfigStore.ts` line 34, change:
```typescript
  handle:  'none',
```
to:
```typescript
  handle:  'bridge',
```

- [ ] **Step 3: Remove handleWarn logic in SidebarMoebel.tsx**

In `src/features/configurator/SidebarMoebel.tsx` lines 105-125, simplify the handle section. Replace:
```typescript
      {/* ── GRIFF ── */}
      {(() => {
        const hasFronts = state.grid.some(row => row.some(c => c.type !== '' && c.type !== 'O'));
        const handleWarn = hasFronts && state.handle === 'none';
        return (
          <Section label={
            <span>
              Griff{handleWarn && (
                <span style={{ color: '#D04030', fontSize: 9, marginLeft: 6 }}>⚑ Pflicht</span>
              )}
            </span>
          }>
            <select
              value={state.handle}
              onChange={e => actions.setHandle(e.target.value)}
              style={{ ...SELECT_STYLE, marginTop: 10, borderColor: handleWarn ? '#D04030' : '#E2DFD9' }}
            >
              {HANDLES.map(h => <option key={h.v} value={h.v}>{h.l}</option>)}
            </select>
          </Section>
        );
      })()}
```
with:
```typescript
      {/* ── GRIFF ── */}
      <Section label="Griff">
        <select
          value={state.handle}
          onChange={e => actions.setHandle(e.target.value)}
          style={{ ...SELECT_STYLE, marginTop: 10 }}
        >
          {HANDLES.map(h => <option key={h.v} value={h.v}>{h.l}</option>)}
        </select>
      </Section>
```

- [ ] **Step 4: Remove 'none' guard in BOMPanel.tsx**

In `src/features/bom/BOMPanel.tsx` lines 714-727, replace:
```typescript
        {bom.frontGes > 0 && (
          <Group title="Griffe" total={bom.frontGes} csym={csym}>
            {state.handle === 'none'
              ? <BRow name={<span style={{ color: '#B04030' }}>⚑ kein Griff gewählt</span>} sub="" qty={0} csym={csym} />
              : <BRow
                  name={bom.handleObj.l ?? state.handle}
                  sub={bom.handleObj.lb ? `${bom.handleObj.lb}mm Lochbohrung` : 'kein Loch'}
                  qty={bom.frontGes}
                  csym={csym}
                  pi={pr('Griff', undefined, bom.frontGes)}
                />
            }
          </Group>
        )}
```
with:
```typescript
        {bom.frontGes > 0 && (
          <Group title="Griffe" total={bom.frontGes} csym={csym}>
            <BRow
              name={bom.handleObj.l ?? state.handle}
              sub={bom.handleObj.lb ? `${bom.handleObj.lb}mm Lochbohrung` : 'kein Loch'}
              qty={bom.frontGes}
              csym={csym}
              pi={pr('Griff', undefined, bom.frontGes)}
            />
          </Group>
        )}
```

- [ ] **Step 5: Remove handle === 'none' validation warning**

In `src/core/validation.ts` lines 190-196, remove:
```typescript
  // ── Griff-Pflichtfeld ─────────────────────────────────────────────────────
  const hasFronts = grid.some(row =>
    row.some(cell => cell.type !== '' && cell.type !== 'O')
  );
  if (hasFronts && state.handle === 'none') {
    warnings.push('Griff nicht ausgewählt — Pflichtfeld bei Frontmöbeln.');
  }
```

- [ ] **Step 6: Search and clean up any remaining 'none' handle references**

Search the codebase for `handle === 'none'` or `handle !== 'none'` and remove/adjust any remaining guards. Check:
- `src/features/preview3d/useModuleGeometry.ts` — if there's a skip condition for `handle === 'none'`, remove it so handles always render.
- `src/app/api/bom/route.ts` — if there's a `config.handle !== 'none'` guard, remove it.

- [ ] **Step 7: Verify — run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/core/constants.ts src/features/configurator/useConfigStore.ts src/features/configurator/SidebarMoebel.tsx src/features/bom/BOMPanel.tsx src/core/validation.ts src/features/preview3d/useModuleGeometry.ts src/app/api/bom/route.ts
git commit -m "Griff: 'Kein Griff' entfernt, Standard = Bridge"
```

---

### Task 3: Farbkorrektur Orange, Zinkgelb, Rubinrot

**Files:**
- Modify: `src/core/constants.ts:94-96`

Reference images analysed:
- Orange: Referenz `#ec7720`, aktuell `#e07020` → zu dunkel
- Zinkgelb: Referenz `#f9e900`, aktuell `#d8c800` → stark zu dunkel (Senf statt Gelb)
- Rubinrot: Referenz `#84002a`, aktuell `#8c0a2e` → leicht zu hell/rötlich

Three.js Rendering-Pipeline: sRGB→Linear-Konvertierung dunkelt Farben. Die Beleuchtung (HemisphereLight intensity=0.9 + DirectionalLight intensity=0.6) hellt wieder auf, aber nicht linear. MDF-Roughness (0.88) streut Licht breit. Netto-Effekt: gesättigte Farben werden leicht gedämpft. Daher Hex-Werte **leicht heller/gesättigter** als Referenz setzen.

- [ ] **Step 1: Update Orange hex + border**

In `src/core/constants.ts` line 95, change:
```typescript
  { v: 'KHOR', l: 'Orange',     pg: 'PG1', hex: '#e07020', border: '#c06018', textured: false },
```
to:
```typescript
  { v: 'KHOR', l: 'Orange',     pg: 'PG1', hex: '#f07a22', border: '#d06818', textured: false },
```

- [ ] **Step 2: Update Zinkgelb hex + border**

In `src/core/constants.ts` line 96, change:
```typescript
  { v: 'KHZG', l: 'Zinkgelb',   pg: 'PG1', hex: '#d8c800', border: '#b8a800', textured: false },
```
to:
```typescript
  { v: 'KHZG', l: 'Zinkgelb',   pg: 'PG1', hex: '#faed00', border: '#d8cc00', textured: false },
```

- [ ] **Step 3: Update Rubinrot hex + border**

In `src/core/constants.ts` line 94, change:
```typescript
  { v: 'KHRR', l: 'Rubinrot',   pg: 'PG1', hex: '#8c0a2e', border: '#700824', textured: false },
```
to:
```typescript
  { v: 'KHRR', l: 'Rubinrot',   pg: 'PG1', hex: '#88002c', border: '#6c0022', textured: false },
```

- [ ] **Step 4: Visueller Check im Browser**

Run: `npm run dev`

Öffne den Konfigurator, wähle nacheinander Orange, Zinkgelb, Rubinrot. Vergleiche das gerenderte Ergebnis im 3D-Canvas mit den Referenzbildern in `Oberflächen/MDF/`. Falls Abweichungen sichtbar: Hex-Werte iterativ anpassen (heller/gesättigter wenn zu dunkel im Rendering, dunkler wenn zu hell).

- [ ] **Step 5: Commit**

```bash
git add src/core/constants.ts
git commit -m "Farbkorrektur: Orange, Zinkgelb, Rubinrot an Referenzbilder angepasst"
```

---

### Task 4: Griff-Preislogik prüfen

**Files:**
- Read: `src/app/api/bom/route.ts` (handle pricing block)
- Read: `src/app/api/price/route.ts` (mirror pricing)
- Possibly modify: `scripts/import-prices.py`

- [ ] **Step 1: Check normalizeLabel function**

Read `src/app/api/bom/route.ts` and find the `normalizeLabel` function. Verify it handles:
- Umlauts: "groß" → should match DB entry
- Whitespace: trimming
- Case: case-insensitive matching

- [ ] **Step 2: Query Supabase for handle price entries**

Check if all 17 handle variants (push, luno, linea, rondo, axio, axio_gross, retrox, reling, reling_gross, uno, ombra, solano, arcano, bridge, bridge_gross, allungo) have individual rows in `article_prices` with `kategorie = 'Griff'`. If not, identify missing entries.

This can be verified by checking `scripts/import-prices.py` or `scripts/seed_article_prices.sql` to see which handle labels are seeded.

- [ ] **Step 3: Verify BOMPanel price display**

In `src/features/bom/BOMPanel.tsx`, the handle price is fetched via `pr('Griff', undefined, bom.frontGes)`. Trace through the `pr()` function to confirm it looks up by handle label (not just category), so different handles show different unit prices.

If `pr()` only matches on category without label discrimination, the same price would be returned for all handles — that's a bug. In that case, fix the lookup to include the handle label.

- [ ] **Step 4: Fix if needed and commit**

If changes were made:
```bash
git add -A
git commit -m "Fix: Griff-Preislogik — individueller Preis pro Griffmodell"
```

If no changes needed (logic already correct):
No commit — document findings.

---

### Task 5: Stellfuß mit Nivellierschraube

**Files:**
- Modify: `src/features/preview3d/useModuleGeometry.ts:522-547`

- [ ] **Step 1: Add Nivellierschraube to Stellfuß rendering**

In `src/features/preview3d/useModuleGeometry.ts`, inside the `if (isStell)` block (around line 522), after the existing Stellfuß SceneObject push loop (ends around line 570), add a second loop that creates Nivellierschraube objects at each foot position.

Find the loop that pushes Stellfuß objects (lines 551-570). After this loop's closing `}`, add:

```typescript
      // Nivellierschraube bündig in Stellfuß-Unterseite versenkt
      if (isStell) {
        const nivGlb = STRUCTURE_GLB_MAP['nivellierschraube'];
        const nivH = 30; // GLB-Höhe ~30mm
        const nivSize: [number, number, number] = [30 * s, nivH * s, 30 * s];
        // Y: Mitte auf Stellfuß-Unterkante → obere Hälfte im Profil versenkt, nur Platte sichtbar
        const nivY = (wuerfelBottom - footerH) * s;
        const nivRot: [number, number, number] = [-Math.PI / 2, 0, 0];

        for (let ci = 0; ci <= nC; ci++) {
          const wx = cubeX[ci];
          objs.push({
            id: `nivellier_f_${ci}`,
            partType: 'stellfuss',
            position: [wx * s, nivY, wuerfelZf * s],
            size: nivSize,
            color: CHROME,
            glbFile: nivGlb,
            preRotation: nivRot,
          });
          objs.push({
            id: `nivellier_b_${ci}`,
            partType: 'stellfuss',
            position: [wx * s, nivY, wuerfelZb * s],
            size: nivSize,
            color: CHROME,
            glbFile: nivGlb,
            preRotation: nivRot,
          });
        }
      }
```

Note: `footerH`, `wuerfelBottom`, `s`, `CHROME`, `cubeX`, `nC`, `wuerfelZf`, `wuerfelZb` are all in scope from the surrounding block. `STRUCTURE_GLB_MAP` is imported at the top of the file.

- [ ] **Step 2: Verify — run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Visual check in browser**

Run: `npm run dev`

Select "Stellfuß 50mm" as footer. Verify:
- The Stellfuß profile is still visible (vertical chrome rod)
- Below each Stellfuß, a Nivellierschraube base plate is visible
- The screw is flush (only plate visible, upper half hidden inside the profile)

- [ ] **Step 4: Commit**

```bash
git add src/features/preview3d/useModuleGeometry.ts
git commit -m "3D: Stellfuß zeigt Nivellierschraube bündig in Unterseite"
```

---

### Task 6: Fronten entfernen bei fehlenden Seitenwänden

**Files:**
- Modify: `src/features/configurator/useConfigStore.ts:176-178`
- Modify: `src/core/validation.ts` (new helper)

- [ ] **Step 1: Add helper function needsSideWall to validation.ts**

At the end of `src/core/validation.ts`, add:

```typescript
/**
 * Prüft ob eine Zelle [r, c] mindestens eine fehlende Seitenwand hat,
 * was Fronten (K, S, TR, TL, DT) unmöglich macht.
 * Eine Zelle braucht beidseitig Wände für Fronten.
 */
export function cellMissingSideWall(
  r: number, c: number,
  grid: Cell[][],
  opts: { outer: boolean; inner: boolean },
  numCols: number,
): boolean {
  const occupied = (row: number, col: number) =>
    grid[row]?.[col] != null && grid[row][col].type !== '';

  // Linke Wand fehlt?
  let leftMissing = false;
  if (c === 0) {
    // Randzelle links: braucht outer
    leftMissing = !opts.outer;
  } else if (!occupied(r, c - 1)) {
    // Innenzelle, Nachbar links leer: braucht inner
    leftMissing = !opts.inner;
  }

  // Rechte Wand fehlt?
  let rightMissing = false;
  if (c === numCols - 1) {
    // Randzelle rechts: braucht outer
    rightMissing = !opts.outer;
  } else if (!occupied(r, c + 1)) {
    // Innenzelle, Nachbar rechts leer: braucht inner
    rightMissing = !opts.inner;
  }

  return leftMissing || rightMissing;
}
```

- [ ] **Step 2: Enforce wall rule in toggleOpt**

In `src/features/configurator/useConfigStore.ts`, replace the `toggleOpt` action (lines 176-178):

```typescript
    toggleOpt: (k) => update(s => ({
      ...s, opts: { ...s.opts, [k]: !s.opts[k] },
    })),
```

with:

```typescript
    toggleOpt: (k) => update(s => {
      const newOpts = { ...s.opts, [k]: !s.opts[k] };
      // Fronten entfernen bei Zellen ohne Seitenwände
      if (k === 'outer' || k === 'inner') {
        const grid = s.grid.map((row, r) =>
          row.map((cell, c) => {
            if (cell.type === '' || cell.type === 'O') return cell;
            if (cellMissingSideWall(r, c, s.grid, newOpts, s.cols.length)) {
              return { ...cell, type: 'O' as CellType };
            }
            return cell;
          }),
        );
        return { ...s, opts: newOpts, grid };
      }
      return { ...s, opts: newOpts };
    }),
```

Add the import at the top of `useConfigStore.ts`:
```typescript
import { canPlace, getAvailableFrontTypes, cellMissingSideWall } from '@/core/validation';
```
(Extend the existing import that already imports `canPlace` and `getAvailableFrontTypes`.)

- [ ] **Step 3: Block front placement on cells without side walls**

In `src/features/configurator/useConfigStore.ts`, in the `setType` action (line 180), add a wall check after the gravity check. After line 197 (`setGravityError(null);`), before the `update()` call, add:

```typescript
      // Fronten nur bei vorhandenen Seitenwänden erlauben
      if (t !== '' && t !== 'O') {
        if (cellMissingSideWall(r, c, state.grid, state.opts, state.cols.length)) {
          setGravityError('Front nicht möglich — Seitenwand fehlt.');
          return;
        }
      }
```

- [ ] **Step 4: Verify — run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/core/validation.ts src/features/configurator/useConfigStore.ts
git commit -m "Logik: Fronten entfernen bei fehlenden Seitenwänden"
```

---

### Task 7: Grid-Konnektivitätsprüfung

**Files:**
- Modify: `src/core/validation.ts` (new function)
- Modify: `src/features/configurator/useConfigStore.ts:180-203`

- [ ] **Step 1: Add wouldDisconnect function to validation.ts**

At the end of `src/core/validation.ts`, add:

```typescript
/**
 * Prüft ob das Entfernen der Zelle [row, col] das Grid in getrennte Teile
 * aufteilen würde (Graph-Konnektivitäts-Check, 4-Nachbarschaft).
 * Gibt true zurück, wenn das Entfernen eine Trennung verursachen würde.
 */
export function wouldDisconnect(grid: Cell[][], row: number, col: number): boolean {
  const R = grid.length;
  const C = grid[0]?.length ?? 0;

  // Simuliertes Grid: Zielzelle auf leer setzen
  const occupied = (r: number, c: number): boolean => {
    if (r === row && c === col) return false; // simuliert entfernt
    return r >= 0 && r < R && c >= 0 && c < C && grid[r]?.[c]?.type !== '';
  };

  // Alle belegten Zellen sammeln (ohne die zu entfernende)
  const allOccupied: Array<[number, number]> = [];
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++)
      if (occupied(r, c)) allOccupied.push([r, c]);

  if (allOccupied.length === 0) return false; // Nichts übrig → kein Split

  // BFS von erster belegter Zelle
  const visited = new Set<string>();
  const queue: Array<[number, number]> = [allOccupied[0]];
  visited.add(`${allOccupied[0][0]}_${allOccupied[0][1]}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const nr = r + dr, nc = c + dc;
      const key = `${nr}_${nc}`;
      if (occupied(nr, nc) && !visited.has(key)) {
        visited.add(key);
        queue.push([nr, nc]);
      }
    }
  }

  return visited.size < allOccupied.length;
}
```

- [ ] **Step 2: Add connectivity check to setType**

In `src/features/configurator/useConfigStore.ts`, update the `setType` action. In the removal guard block (lines 182-188), add the connectivity check. Replace:

```typescript
      if (t === '' && currentType !== '') {
        // Entfernen: blockieren wenn direkt darüber eine belegte Zelle liegt
        if (r > 0 && (state.grid[r - 1]?.[c]?.type ?? '') !== '') {
          setGravityError('Modul kann nicht entfernt werden — Module darüber zuerst entfernen.');
          return;
        }
      }
```

with:

```typescript
      if (t === '' && currentType !== '') {
        // Entfernen: blockieren wenn direkt darüber eine belegte Zelle liegt
        if (r > 0 && (state.grid[r - 1]?.[c]?.type ?? '') !== '') {
          setGravityError('Modul kann nicht entfernt werden — Module darüber zuerst entfernen.');
          return;
        }
        // Entfernen: blockieren wenn Möbel dadurch geteilt würde
        if (wouldDisconnect(state.grid, r, c)) {
          setGravityError('Element kann nicht entfernt werden — Möbel würde geteilt.');
          return;
        }
      }
```

Add `wouldDisconnect` to the import:
```typescript
import { canPlace, getAvailableFrontTypes, cellMissingSideWall, wouldDisconnect } from '@/core/validation';
```

- [ ] **Step 3: Verify — run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Manual test in browser**

Run: `npm run dev`

Create a 3-column, 2-row configuration (H-shape or bridge shape). Try to remove the connecting bottom-center element. The removal should be blocked with the error message. Removing a corner element (that doesn't split) should still work.

- [ ] **Step 5: Commit**

```bash
git add src/core/validation.ts src/features/configurator/useConfigStore.ts
git commit -m "Logik: Grid-Konnektivitätsprüfung — Möbel-Teilung verhindern"
```

---

### Task 8: Fokus-Button in linker Sidebar

**Files:**
- Modify: `src/features/configurator/ConfiguratorShell.tsx:260-282`
- Modify: `src/features/preview3d/Preview3D.tsx:356-358, 736-741`

- [ ] **Step 1: Extend ThreeCanvasHandle with resetCamera**

In `src/features/preview3d/Preview3D.tsx` line 356-358, change:

```typescript
export interface ThreeCanvasHandle {
  captureScreenshot: (w?: number, h?: number) => Promise<string>;
}
```

to:

```typescript
export interface ThreeCanvasHandle {
  captureScreenshot: (w?: number, h?: number) => Promise<string>;
  resetCamera: () => void;
}
```

- [ ] **Step 2: Implement resetCamera in useImperativeHandle**

In `src/features/preview3d/Preview3D.tsx` lines 736-741, change:

```typescript
  useImperativeHandle(ref, () => ({
    captureScreenshot: (w?: number, h?: number) => {
      if (!screenshotRef.current) return Promise.resolve('');
      return screenshotRef.current.captureScreenshot(w, h);
    },
```

to:

```typescript
  useImperativeHandle(ref, () => ({
    captureScreenshot: (w?: number, h?: number) => {
      if (!screenshotRef.current) return Promise.resolve('');
      return screenshotRef.current.captureScreenshot(w, h);
    },
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
```

Note: `ccRef`, `boxMinX`, `boxMinY`, `boxMinZ`, `boxMaxX`, `boxMaxY`, `boxMaxZ` are all in scope within the `Preview3D` component.

- [ ] **Step 3: Add Focus button to ConfiguratorShell.tsx**

In `src/features/configurator/ConfiguratorShell.tsx`, add `Focus` to the lucide-react import. Find the existing import:
```typescript
import { RotateCcw, Sun, Moon } from 'lucide-react';
```
Change to:
```typescript
import { RotateCcw, Sun, Moon, Focus } from 'lucide-react';
```

Then after the "Neu" button closing tag (line 282), add the Focus button:

```typescript
      {/* ════════════════════════════════════════
          FOKUS BUTTON — unter Neu
          ════════════════════════════════════════ */}
      <button
        onClick={() => preview3DRef.current?.resetCamera()}
        style={{
          position: 'fixed', top: 148, left: 16, zIndex: 40,
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 8, padding: '6px 12px',
          border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
          color: '#6A6660', letterSpacing: '.04em',
          boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
          transition: 'color 0.14s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#171614'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#6A6660'; }}
      >
        <Focus size={12} strokeWidth={2} />
        Fokus
      </button>
```

- [ ] **Step 4: Verify — run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/features/preview3d/Preview3D.tsx src/features/configurator/ConfiguratorShell.tsx
git commit -m "UI: Fokus-Button zentriert Möbel in 3D-Ansicht"
```

---

### Task 9: Außenmaße-Button + 3D-Bemaßungslinien

**Files:**
- Create: `src/features/preview3d/DimensionOverlay.tsx`
- Modify: `src/features/configurator/ConfiguratorShell.tsx`
- Modify: `src/features/preview3d/Preview3D.tsx`

- [ ] **Step 1: Add showDimensions state to ConfiguratorShell**

In `src/features/configurator/ConfiguratorShell.tsx`, after the `currency` state (line 33), add:
```typescript
  const [showDimensions, setShowDimensions] = useState(false);
```

Add `Ruler` to the lucide-react import:
```typescript
import { RotateCcw, Sun, Moon, Focus, Ruler } from 'lucide-react';
```

- [ ] **Step 2: Add Maße button below Focus button**

In `src/features/configurator/ConfiguratorShell.tsx`, after the Focus button added in Task 8, add:

```typescript
      {/* ════════════════════════════════════════
          MAßE BUTTON — unter Fokus
          ════════════════════════════════════════ */}
      <button
        onClick={() => setShowDimensions(d => !d)}
        style={{
          position: 'fixed', top: 188, left: 16, zIndex: 40,
          display: 'flex', alignItems: 'center', gap: 6,
          background: showDimensions ? '#171614' : 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 8, padding: '6px 12px',
          border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500,
          color: showDimensions ? '#FAFAF8' : '#6A6660',
          letterSpacing: '.04em',
          boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
          transition: 'all 0.14s ease',
        }}
        onMouseEnter={(e) => { if (!showDimensions) e.currentTarget.style.color = '#171614'; }}
        onMouseLeave={(e) => { if (!showDimensions) e.currentTarget.style.color = '#6A6660'; }}
      >
        <Ruler size={12} strokeWidth={2} />
        Maße
      </button>
```

- [ ] **Step 3: Pass showDimensions prop to Preview3D**

In `src/features/configurator/ConfiguratorShell.tsx`, find the `<Preview3D` tag and add the prop:
```typescript
        <Preview3D
          ref={preview3DRef}
          state={state}
          bgColor={theme === 'dark' ? BG_DARK : BG_LIGHT}
          showDimensions={showDimensions}
          // ... rest of existing props
```

- [ ] **Step 4: Add showDimensions to Preview3DProps**

In `src/features/preview3d/Preview3D.tsx`, add to `Preview3DProps` interface (around line 515):
```typescript
  /** Bemaßungslinien im 3D-Canvas anzeigen */
  showDimensions?: boolean;
```

Add `showDimensions = false` to the destructuring in the component (around line 545):
```typescript
const Preview3D = forwardRef<ThreeCanvasHandle, Preview3DProps>(function Preview3D({
  state,
  cameraElevation = 0.55,
  // ... existing props
  showDimensions = false,
  bgColor = '#FAF8F5',
}, ref) {
```

- [ ] **Step 5: Create DimensionOverlay component**

Create `src/features/preview3d/DimensionOverlay.tsx`:

```typescript
'use client';

import { useMemo } from 'react';
import { Html } from '@react-three/drei';

const S = 0.01; // 1mm = 0.01 Three.js units
const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 9,
  fontWeight: 500,
  color: '#4A4640',
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(4px)',
  padding: '2px 6px',
  borderRadius: 4,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
};

interface DimensionOverlayProps {
  cols: number[];
  rows: number[];
  depth: number;
  grid: { type: string }[][];
}

export default function DimensionOverlay({ cols, rows, depth, grid }: DimensionOverlayProps) {
  const { xOff, yOff, wAct, hAct, minC, maxC, minR, maxR } = useMemo(() => {
    const numRows = rows.length, numCols = cols.length;
    let mnR = numRows, mxR = -1, mnC = numCols, mxC = -1;
    for (let r = 0; r < numRows; r++)
      for (let c = 0; c < numCols; c++)
        if (grid[r][c].type !== '') {
          if (r < mnR) mnR = r; if (r > mxR) mxR = r;
          if (c < mnC) mnC = c; if (c > mxC) mxC = c;
        }
    if (mxR < 0) { mnR = 0; mxR = numRows - 1; mnC = 0; mxC = numCols - 1; }
    const xO = cols.slice(0, mnC).reduce((a, b) => a + b, 0);
    const yO = rows.slice(mxR + 1).reduce((a, b) => a + b, 0);
    const w = cols.slice(mnC, mxC + 1).reduce((a, b) => a + b, 0);
    const h = rows.slice(mnR, mxR + 1).reduce((a, b) => a + b, 0);
    return { xOff: xO, yOff: yO, wAct: w, hAct: h, minC: mnC, maxC: mxC, minR: mnR, maxR: mxR };
  }, [cols, rows, grid]);

  // Profil-Würfel-Überstand: 30mm (PROF_MM) beidseitig
  const PROF = 30;
  const outerW = wAct + 2 * PROF;
  const outerH = hAct + 2 * PROF;
  const outerD = depth + 2 * PROF;

  // Positionen in Three.js-Einheiten
  const leftX = (xOff - PROF) * S;
  const rightX = (xOff + wAct + PROF) * S;
  const bottomY = (yOff - PROF) * S;
  const topY = (yOff + hAct + PROF) * S;
  const frontZ = (depth + PROF) * S;

  // Offset für Bemaßungslinien (Abstand vom Möbel)
  const off = 40 * S; // 40mm Abstand

  const fmt = (mm: number) => `${(mm / 10).toFixed(1)} cm`;

  return (
    <>
      {/* ── Gesamtbreite (unten) ── */}
      <Html
        position={[(leftX + rightX) / 2, bottomY - off, frontZ / 2]}
        center
        style={LABEL_STYLE}
      >
        {`Außenmaß ${fmt(outerW)}`}
      </Html>

      {/* ── Gesamthöhe (rechts) ── */}
      <Html
        position={[rightX + off, (bottomY + topY) / 2, frontZ / 2]}
        center
        style={LABEL_STYLE}
      >
        {`Außenmaß ${fmt(outerH)}`}
      </Html>

      {/* ── Gesamttiefe (unten vorne, diagonal) ── */}
      <Html
        position={[rightX + off, bottomY - off, frontZ / 2]}
        center
        style={LABEL_STYLE}
      >
        {`Tiefe ${fmt(outerD)}`}
      </Html>

      {/* ── Spaltenbreiten (unten) ── */}
      {cols.slice(minC, maxC + 1).map((w, i) => {
        const colIdx = minC + i;
        const colLeft = cols.slice(0, colIdx).reduce((a, b) => a + b, 0);
        const cx = (colLeft + w / 2) * S;
        return (
          <Html
            key={`cw_${colIdx}`}
            position={[cx, bottomY - off * 0.5, frontZ / 2]}
            center
            style={{ ...LABEL_STYLE, fontSize: 8 }}
          >
            {fmt(w)}
          </Html>
        );
      })}

      {/* ── Zeilenhöhen (rechts) ── */}
      {rows.slice(minR, maxR + 1).map((h, i) => {
        const rowIdx = minR + i;
        const rowBottom = rows.slice(rowIdx + 1).reduce((a, b) => a + b, 0);
        const cy = (rowBottom + h / 2) * S;
        return (
          <Html
            key={`rh_${rowIdx}`}
            position={[rightX + off * 0.5, cy, frontZ / 2]}
            center
            style={{ ...LABEL_STYLE, fontSize: 8 }}
          >
            {fmt(h)}
          </Html>
        );
      })}
    </>
  );
}
```

- [ ] **Step 6: Render DimensionOverlay in Preview3D**

In `src/features/preview3d/Preview3D.tsx`, add the import at the top:
```typescript
import DimensionOverlay from './DimensionOverlay';
```

Inside the Canvas, before the `</Canvas>` closing tag (around line 944), add:
```typescript
      {/* Bemaßungslinien — ausgeblendet bei Screenshot */}
      <group name="dimension-lines">
        {showDimensions && (
          <DimensionOverlay
            cols={state.cols}
            rows={state.rows}
            depth={state.depth}
            grid={state.grid}
          />
        )}
      </group>
```

- [ ] **Step 7: Hide dimension-lines in screenshots**

In `src/features/preview3d/Preview3D.tsx`, find the ScreenshotHelper where it hides groups for screenshots. Search for `ghost-zones` hiding logic. Add `'dimension-lines'` to the list of group names that get hidden during screenshot capture.

- [ ] **Step 8: Verify — run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 9: Visual check in browser**

Run: `npm run dev`

Click the "Maße" button. Verify:
- Outer dimension labels appear (Breite unten, Höhe rechts, Tiefe)
- Individual column widths and row heights appear
- Labels follow the Artmodul styling (small, clean, white background)
- Toggle off hides all labels
- Screenshot does not include dimension labels

- [ ] **Step 10: Commit**

```bash
git add src/features/preview3d/DimensionOverlay.tsx src/features/preview3d/Preview3D.tsx src/features/configurator/ConfiguratorShell.tsx
git commit -m "UI: Außenmaße-Button + 3D-Bemaßungslinien ein-/ausblendbar"
```
