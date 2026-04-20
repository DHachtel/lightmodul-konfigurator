# Phase 1: Cleanup & Datenmodell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Artmodul legacy from core types, constants, state management, BOM calculation, and schemas. Produce a clean Lightmodul-only codebase that compiles without errors.

**Architecture:** Strip Artmodul compatibility fields from ConfigState, BOMResult, ConfigOpts, and all consumers. Remove unused UI components (ConfigGrid, GlobalBar Artmodul sections). Update Logo. Verify with `tsc --noEmit` after each task.

**Tech Stack:** TypeScript (strict), Next.js 16, React, Zod

**Note:** No test framework exists in this project. Verification is via `tsc --noEmit` (zero errors) and manual inspection. The CLAUDE.md autostart protocol (`tsc --noEmit` → commit) applies after each task.

**Roadmap (later phases get separate plans):**
- Phase 1: Cleanup & Datenmodell ← THIS PLAN
- Phase 2: BOM & Preise
- Phase 3: STP→GLB + 3D-Vorschau
- Phase 4: 3D als Hauptinteraktion (Shadow-Boxen, Raycasting)
- Phase 5: Händler-Workflow (Login, Bestellen, PDF)
- Phase 6: Admin-Panel (Händlerfreigabe, Bestellübersicht)

---

### Task 1: Clean up ConfigOpts and ConfigState in types.ts

**Files:**
- Modify: `src/core/types.ts`

- [ ] **Step 1: Remove Artmodul fields from ConfigOpts**

Replace the current `ConfigOpts` interface:

```typescript
// VORHER:
export interface ConfigOpts {
  footer: boolean
  shelves: boolean
  backWall: boolean
  outer: boolean
  inner: boolean
  back: boolean
}

// NACHHER:
export interface ConfigOpts {
  footer: boolean
  shelves: boolean
}
```

- [ ] **Step 2: Remove Artmodul fields from ConfigState**

Remove these fields from the `ConfigState` interface:
- `surface: string`
- `handle: string`
- `depth: number`
- `bomOverrides: Record<string, BomOverride>`
- `cableHoles: Record<string, boolean>`
- `catOverrides: Record<string, BomCatOverride>`
- `partColors: Record<string, string>`
- `cellColors: Record<string, string>`

Keep only:
```typescript
export interface ConfigState {
  cols: number[]
  rows: number[]
  depthLayers: number
  grid: Grid
  profileColor: string
  footer: string
  opts: ConfigOpts
}
```

- [ ] **Step 3: Remove frameGroup from Cell**

```typescript
// VORHER:
export interface Cell {
  type: CellType
  frameGroup: string
  shelves: number
}

// NACHHER:
export interface Cell {
  type: CellType
  shelves: number
}
```

- [ ] **Step 4: Remove BomOverride and BomCatOverride interfaces**

Delete `BomOverride` and `BomCatOverride` interfaces entirely from `types.ts`. They are no longer referenced.

- [ ] **Step 5: Verify** — Do NOT commit yet (compilation will fail until consumers are updated)

Run: `npx tsc --noEmit 2>&1 | head -50`
Expected: TypeScript errors in files that still reference removed fields. Note these files for subsequent tasks.

---

### Task 2: Clean up BOMResult in types.ts

**Files:**
- Modify: `src/core/types.ts`

- [ ] **Step 1: Replace BOMResult with Lightmodul-only fields**

Remove ALL existing fields and replace with:

```typescript
export interface BOMResult {
  wuerfel: number
  profileX: number
  profileY: number
  profileZ: number
  profileTotal: number
  framesStd: number
  framesLit: number
  framesTotal: number
  shelves: number
  footerQty: number
  footer: string
  schraubenM4: number
  schraubenM6: number
  scheiben: number
  einlegemuttern: number
  numCols: number
  numRows: number
  numDepth: number
  totalWidth: number
  totalHeight: number
  totalDepth: number
  boardMap: Record<string, BoardEntry>
  warnings: string[]
}
```

- [ ] **Step 2: Define BoardEntry cleanly**

Ensure `BoardEntry` exists (or create it):

```typescript
export interface BoardEntry {
  kategorie: string
  isFront: boolean
}
```

- [ ] **Step 3: Remove DimMap type if no longer needed**

Check if `DimMap` (`Record<string, number>`) is still used anywhere. If only in the old BOMResult fields (`pB`, `pH`, `pT`, `bStd`, etc.), remove it. If used elsewhere, keep it.

---

### Task 3: Clean up constants.ts

**Files:**
- Modify: `src/core/constants.ts`

- [ ] **Step 1: Remove Artmodul compatibility exports**

Remove these if present:
- `HANDLES` (empty array)
- `CABLE_HOLE_ART_NR` (empty string)
- `WALL_MOUNT_ART_NR`
- `CABLE_DUCT_ART_NR`
- Any `MATERIALS`, `WIDTHS`, `HEIGHTS` arrays
- Any `MAT_BY_V`, `HANDLE_BY_V`, `FOOTER_BY_V` lookup maps that reference Artmodul types

- [ ] **Step 2: Remove FRAME_GROUPS (deferred to later phase)**

Remove the `FRAME_GROUPS` array entirely. Frame groups are not part of the E2E Phase 1 (only RF/RL without product assignment).

- [ ] **Step 3: Add hardware ratio constants**

Add named constants for BOM hardware calculations:

```typescript
/** Hardware-Mengen pro Alu-Würfel (Montagereferenz) */
export const HW_M4_PER_CUBE = 4
export const HW_MUTTERN_PER_CUBE = 4
export const HW_M6_PER_CUBE = 2
export const HW_SCHEIBEN_PER_CUBE = 2
```

---

### Task 4: Clean up Zod schemas in schemas.ts

**Files:**
- Modify: `src/core/schemas.ts`

- [ ] **Step 1: Simplify CellSchema**

Remove `frameGroup`:

```typescript
export const CellSchema = z.object({
  type: CellTypeSchema,
  shelves: z.number().int().min(0).max(2).optional().default(0),
})
```

- [ ] **Step 2: Simplify ConfigStateSchema**

Remove all Artmodul fields. New schema:

```typescript
export const ConfigStateSchema = z.object({
  cols:         z.array(z.literal(600)).min(1).max(8),
  rows:         z.array(z.literal(600)).min(1).max(5),
  depthLayers:  z.number().int().min(1).max(4),
  grid:         z.array(z.array(z.array(CellSchema))),
  profileColor: z.string(),
  footer:       z.string(),
  opts: z.object({
    footer:  z.boolean().optional().default(true),
    shelves: z.boolean().optional().default(false),
  }),
})
```

- [ ] **Step 3: Update BomRequestSchema if it references removed fields**

Ensure `BomRequestSchema` wraps the new `ConfigStateSchema` without referencing `catOverrides`, `bomOverrides`, etc.

---

### Task 5: Clean up useConfigStore.ts

**Files:**
- Modify: `src/features/configurator/useConfigStore.ts`

- [ ] **Step 1: Update DEFAULT config**

```typescript
const DEFAULT: ConfigState = {
  cols:         [600],
  rows:         [600],
  depthLayers:  1,
  grid:         [[[{ type: 'O', shelves: 0 }]]],
  profileColor: 'SW',
  footer:       'stell_m6',
  opts:         { footer: true, shelves: false },
}
```

- [ ] **Step 2: Remove Artmodul actions from ConfigActions interface**

Remove these actions:
- `setSurface(v: string)`
- `setHandle(v: string)`
- `toggleOpt(k: 'outer' | 'inner' | 'back')`
- `setFrameGroup(r, c, d, group)`
- `setBomOverride(id, override)` / `clearBomOverride(id)`
- `setCatOverride(catKey, override)` / `clearCatOverride(catKey)`
- `setPartColor(plateId, hex)` / `clearPartColor(plateId)` / `clearAllPartColors()`
- `setCellColor(row, col, hex)` / `clearCellColor(row, col)`
- `setCableHole(boardId, value)`
- `setBomOverrideByBoard(boardId, material, color)` / `clearBomOverrideByBoard(boardId)`

Keep:
- `setDepthLayers(d)`, `setProfileColor(v)`, `setFooter(v)`
- `setType(r, c, t)`, `setShelves(r, c, n)`
- `setCol(c, w)`, `setRow(r, h)`
- `addColLeft/Right()`, `removeColLeft/Right()`
- `addRowTop()`, `removeRowTop()`
- `addDepthFront()`, `removeDepthFront()`
- `addFilledColLeft/Right()`, `addFilledRowTop()`
- `gravityError`, `clearGravityError()`, `frontTypeWarning`, `clearFrontTypeWarning()`
- `committedBOM`, `moebelId`, `commitBOM(bom)`, `setMoebelId(id)`
- `loadConfig(config, restoredMoebelId?)`

- [ ] **Step 3: Remove Artmodul action implementations**

In the hook body, remove the implementation functions for all removed actions. Also remove any references to `surface`, `handle`, `bomOverrides`, `catOverrides`, `partColors`, `cellColors`, `cableHoles` in the `update()` wrapper and other internal functions.

- [ ] **Step 4: Update `emptyCell()` calls**

Ensure all `emptyCell()` calls produce `{ type: '', shelves: 0 }` (no `frameGroup`).

- [ ] **Step 5: Update grid mutation functions**

In `addColLeft`, `addColRight`, `addRowTop`, `addDepthFront`, `addFilledColLeft`, etc.: ensure new cells are created as `{ type: '', shelves: 0 }` or `{ type: 'O', shelves: 0 }` without `frameGroup`.

- [ ] **Step 6: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -80`
Note remaining errors (likely in ConfiguratorShell, BOMPanel, API routes).

---

### Task 6: Clean up calc.ts (BOM computation)

**Files:**
- Modify: `src/core/calc.ts`

- [ ] **Step 1: Update computeBOM return type**

Ensure `computeBOM()` returns the new lean `BOMResult`. Remove all Artmodul compatibility fields from the return object:

Remove these from the return:
- `pB`, `pH`, `pT`, `pBt`, `pHt`, `pTt`, `pGes` → replace with `profileX`, `profileY`, `profileZ`, `profileTotal`
- `framesStd` (was `Record<string, number>`) → replace with `framesStd: number` (simple count)
- `framesLit` (was `Record<string, number>`) → replace with `framesLit: number` (simple count)
- `framesStdTotal`, `framesLitTotal`, `framesGes` → replace with `framesTotal`
- `fbMap`, `fbT` → replace with `shelves: number`
- `stoppfen` → remove entirely
- `beschlGes` → remove
- `catOverrides`, `partColors`, `colorSplits` → remove
- All empty Artmodul fields (`bStd`, `bKl`, `rMap`, `sAMap`, `sIMap`, `fMap`, `nK`, `nS`, `nTR`, `nTL`, `nDT`, `bolzen`, `klemm`, `scharn`, `kHalt`, `kDaem`, `schubF`, `plattenGes`, `totalSch`, `handle`, `handleObj`, `D`, `activeCols`, `activeRows`, `Bact`, `Hact`, `cableHolesQty`, `bomKabelQty`, `frontGes`) → remove

- [ ] **Step 2: Use hardware constants from constants.ts**

Import and use:
```typescript
import { HW_M4_PER_CUBE, HW_MUTTERN_PER_CUBE, HW_M6_PER_CUBE, HW_SCHEIBEN_PER_CUBE } from './constants'

// In computeBOM:
const schraubenM4 = wuerfel * HW_M4_PER_CUBE
const einlegemuttern = wuerfel * HW_MUTTERN_PER_CUBE
const schraubenM6 = wuerfel * HW_M6_PER_CUBE
const scheiben = wuerfel * HW_SCHEIBEN_PER_CUBE
```

- [ ] **Step 3: Remove stoppfen calculation**

Delete the stoppfen counting logic entirely.

- [ ] **Step 4: Simplify frame counting**

Instead of `framesStd: Record<string, number>` (grouped by frameGroup), just count total RF and RL:

```typescript
let framesStd = 0
let framesLit = 0
// In the cell iteration loop:
if (cell.type === 'RF') framesStd++
if (cell.type === 'RL') framesLit++
```

- [ ] **Step 5: Remove references to cell.frameGroup**

In the cell iteration, remove any logic that reads `cell.frameGroup`. Only `cell.type` and `cell.shelves` matter now.

- [ ] **Step 6: Remove createEmptyGrid's frameGroup default**

Ensure `emptyCell()` (or inline cell creation) returns `{ type: '', shelves: 0 }`.

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -80`

---

### Task 7: Clean up validation.ts

**Files:**
- Modify: `src/core/validation.ts`

- [ ] **Step 1: Remove deprecated stub functions**

Remove these no-op functions (and their exports):
- `getAvailableFrontTypes()`
- `gravityCheck()`
- `cellMissingSideWall()`
- `wouldDisconnect()`
- `validateBomOverrides()`
- `validateCatOverrides()`

Keep:
- `canPlace()`
- `getAvailableCellTypes()`
- `canAddCol()`, `canRemoveCol()`, `canAddRow()`, `canRemoveRow()`, `canAddDepth()`, `canRemoveDepth()`
- `maxShelves()`

- [ ] **Step 2: Update canPlace signature**

Remove the `_grid` parameter if unused:

```typescript
export function canPlace(
  _r: number, _c: number, _d: number, _type: CellType
): boolean {
  return true
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -40`

---

### Task 8: Remove or empty variants.ts

**Files:**
- Modify: `src/core/variants.ts`

- [ ] **Step 1: Check what imports computeBoardVariants**

Run: Search for `computeBoardVariants` across the codebase. Note all consumers.

- [ ] **Step 2: Remove all calls to computeBoardVariants**

In each consumer file, remove the import and any usage of `computeBoardVariants`. If a variable held its result, remove that variable.

- [ ] **Step 3: Delete variants.ts or reduce to empty export**

If no other exports are needed from `variants.ts`, delete the file. If other files import from it, leave an empty file:

```typescript
// Lightmodul: Keine Board-Varianten — BOM wird direkt berechnet
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -40`

---

### Task 9: Update ConfiguratorShell.tsx

**Files:**
- Modify: `src/features/configurator/ConfiguratorShell.tsx`

- [ ] **Step 1: Remove imports for deleted components/fields**

Remove imports for:
- `SidebarElement`
- `SidebarPlatte`
- `computeBoardVariants`
- Any type imports that no longer exist (`BomOverride`, `BomCatOverride`, etc.)

- [ ] **Step 2: Remove usage of deleted ConfigState fields**

Search within ConfiguratorShell for references to:
- `state.surface`, `state.handle`, `state.depth`
- `state.bomOverrides`, `state.catOverrides`, `state.partColors`, `state.cellColors`, `state.cableHoles`
- `actions.setSurface`, `actions.setHandle`, `actions.toggleOpt`
- `actions.setBomOverride`, `actions.setCatOverride`, `actions.setPartColor`, `actions.setCellColor`, `actions.setCableHole`

Remove or replace each reference. Where a prop was passed to a child component, remove that prop.

- [ ] **Step 3: Remove SidebarElement and SidebarPlatte from JSX**

Remove the `<SidebarElement ... />` and `<SidebarPlatte ... />` component renders from the layout.

- [ ] **Step 4: Remove computeBoardVariants usage**

Remove the `const variants = computeBoardVariants(state)` (or similar) and any props passing `variants` to children.

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -80`

---

### Task 10: Update BOMPanel.tsx

**Files:**
- Modify: `src/features/bom/BOMPanel.tsx`

- [ ] **Step 1: Update BOMResult field references**

Replace old field names with new ones:
- `bom.pBt` / `bom.pHt` / `bom.pTt` / `bom.pGes` → `bom.profileX` / `bom.profileY` / `bom.profileZ` / `bom.profileTotal`
- `bom.framesStdTotal` → `bom.framesStd`
- `bom.framesLitTotal` → `bom.framesLit`
- `bom.framesGes` / `bom.frontGes` → `bom.framesTotal`
- `bom.fbT` → `bom.shelves`
- `bom.stoppfen` → remove row
- `bom.beschlGes` → remove row
- `bom.warns` → `bom.warnings`

- [ ] **Step 2: Remove catOverrides UI**

Remove the category override editing section (dropdown/inputs for `catOverrides`).

- [ ] **Step 3: Remove board variants display**

Remove any rendering of `BoardVariant[]` data.

- [ ] **Step 4: Remove references to deleted ConfigState fields**

Remove any props or state references to `bomOverrides`, `catOverrides`, `partColors`, etc.

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -40`

---

### Task 11: Update GlobalBar.tsx → Minimal Sidebar

**Files:**
- Modify: `src/features/configurator/GlobalBar.tsx`

- [ ] **Step 1: Strip down to Lightmodul controls only**

Remove:
- Surface/material swatch selector (PG groups, MDF/Furnier)
- Handle selector
- Tiefe selector (depth is controlled via 3D Shadow-Boxen in Phase 4)
- Seiten/Rücken toggles (outer/inner/back)

Keep:
- Profile color selector (SW/WS — two swatches)
- Footer selector (Stellfuß M6 / Rolle)

- [ ] **Step 2: Simplify the component**

The resulting component should be minimal:

```tsx
// Profile color: two clickable swatches (black/white)
// Footer: dropdown with FOOTERS options
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -40`

---

### Task 12: Update API routes for new BOMResult

**Files:**
- Modify: `src/app/api/bom/route.ts`
- Modify: `src/app/api/datasheet/route.ts`
- Modify: `src/app/api/pdf/route.ts`

- [ ] **Step 1: Update /api/bom route**

The route calls `computeBOM(config)` and then maps BOMResult fields to price lookups. Update all field references:
- `bom.pGes` → `bom.profileTotal`
- `bom.framesStdTotal` → `bom.framesStd`
- `bom.framesLitTotal` → `bom.framesLit`
- `bom.fbT` → `bom.shelves`
- `bom.stoppfen` → remove
- `bom.catOverrides` → remove from response
- `bom.partColors` → remove from response
- `bom.warns` → `bom.warnings`

Also remove `computeBoardVariants` import and usage if present.

- [ ] **Step 2: Update /api/datasheet route**

Update any BOMResult field references. Remove `catOverrides`/`bomOverrides` from the request schema if present.

- [ ] **Step 3: Update /api/pdf route**

Update any BOMResult field references in the offer PDF generation.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -40`

---

### Task 13: Update PDF documents

**Files:**
- Modify: `src/features/pdf/DatasheetDocument.tsx`
- Modify: `src/features/pdf/OfferDocument.tsx`
- Modify: `src/features/pdf/MultiOfferDocument.tsx`
- Modify: `src/features/pdf/TechnicalDrawing.tsx`

- [ ] **Step 1: Update BOMResult field references in all PDF components**

Same field renames as Task 10/12. Search each file for old field names and replace.

- [ ] **Step 2: Remove Artmodul-specific sections**

Remove any sections that reference:
- Surface/material names
- Handle types
- Board variants
- Category overrides

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -40`

---

### Task 14: Update useModuleGeometry.ts

**Files:**
- Modify: `src/features/preview3d/useModuleGeometry.ts`

- [ ] **Step 1: Remove references to deleted ConfigState fields**

Remove any usage of:
- `state.surface`, `state.handle`
- `state.bomOverrides`, `state.partColors`, `state.cellColors`
- `state.opts.outer`, `state.opts.inner`, `state.opts.back`, `state.opts.backWall`
- `cell.frameGroup`

- [ ] **Step 2: Simplify frame rendering**

Instead of coloring frames by `frameGroup`, use a fixed color for RF and a different color (with LED indicator) for RL:

```typescript
const FRAME_STD_COLOR = '#c0c0c0'  // Neutral gray for standard frame
const FRAME_LIT_COLOR = '#e0d080'  // Warm tone for illuminated frame
```

- [ ] **Step 3: Remove Artmodul partTypes from SceneObject**

Clean up the `partType` union. Remove types that don't exist in Lightmodul:
- Keep: `'profil'`, `'wuerfel'`, `'front'`, `'fachboden'`, `'stellfuss'`, `'rolle'`
- Remove: `'seite_l'`, `'seite_r'`, `'boden'`, `'deckel'`, `'ruecken'`, `'zwischenboden'`, `'zwischenwand'`, `'eckverbinder'`, `'handle'`

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -40`

---

### Task 15: Update remaining consumers and fix all TS errors

**Files:**
- Various — all remaining files with TypeScript errors

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit 2>&1`
Collect ALL remaining errors.

- [ ] **Step 2: Fix each error**

For each remaining error:
- If it references a removed field → delete the reference
- If it references a renamed field → update the name
- If it's an import error → update or remove the import
- If a component prop no longer exists → remove the prop

Common files that may still have errors:
- `src/features/bom/exportXLS.ts` — BOMResult field references
- `src/features/configurator/CellEditorPopover.tsx` — frameGroup, bomOverrides
- `src/features/configurator/ConfigGrid.tsx` — may still be imported somewhere
- `src/app/api/admin/configurations/[id]/xlsx/route.ts` — BOMResult fields
- `src/app/api/offer/multi/route.ts` — BOMResult fields
- `src/lib/mail-templates.ts` — may reference old fields

- [ ] **Step 3: Delete unused component files**

Delete (or empty) these files if they are no longer imported anywhere:
- `src/features/configurator/SidebarElement.tsx`
- `src/features/configurator/SidebarPlatte.tsx`

Do NOT delete `ConfigGrid.tsx` yet — it may still be rendered in ConfiguratorShell. If it is, remove the render but keep the file for reference until Phase 4 replaces it with 3D interaction.

- [ ] **Step 4: Final verification**

Run: `npx tsc --noEmit`
Expected: 0 errors.

---

### Task 16: Update Logo

**Files:**
- Modify: The component that renders the header logo (likely in `ConfiguratorShell.tsx` or a shared `Header`/`Nav` component)

- [ ] **Step 1: Find the current logo/header component**

Search for "Artmodul" or "logo" in the JSX to find where the header brand is rendered.

- [ ] **Step 2: Replace with "MHZ LightModul" colored text**

```tsx
<span className="text-xl font-light tracking-wide">
  <span className="text-gray-600">MHZ</span>
  {' '}
  <span className="text-teal-500">L</span>
  <span className="text-gray-600">ight</span>
  <span className="text-red-500">M</span>
  <span className="text-gray-600">odul</span>
</span>
```

Adjust exact Tailwind color classes to match the logo screenshot (teal for L, red for M, gray for the rest). Fine-tune the shades if needed.

- [ ] **Step 3: Remove any Artmodul branding references**

Search for "Artmodul" across the codebase and replace with "Lightmodul" or "MHZ LightModul" as appropriate. This includes:
- Page titles (`<title>`, metadata)
- Alt texts
- PDF headers
- Error messages
- Comments (Deutsch — update to reference Lightmodul)

- [ ] **Step 4: Verify compilation and visual check**

Run: `npx tsc --noEmit`
Run: `npm run dev` — visually confirm the logo renders correctly.

---

### Task 17: Update middleware.ts

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Update Basic Auth username**

If the Basic Auth username is hardcoded as `artmodul`, change it to read from `BETA_USER` env var (it likely already does). If it has a fallback default of `artmodul`, change to `lightmodul`:

```typescript
const BETA_USER = process.env.BETA_USER || 'lightmodul'
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`

---

### Task 18: Final commit and verification

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Successful build (or note any non-TS errors for investigation).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Phase 1: Cleanup & Datenmodell — Artmodul-Altlasten entfernt, Lightmodul-only Typen"
```

- [ ] **Step 4: Verify dev server**

Run: `npm run dev`
Open in browser, confirm:
- Logo shows "MHZ LightModul"
- 3D preview renders (with existing procedural geometry)
- BOM panel shows Lightmodul categories
- No console errors
