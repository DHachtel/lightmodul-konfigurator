# Drill-Down Engine + Breadcrumb — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the explicit mode-toggle buttons (Möbel/Element/Platte) with a drill-down navigation: click to select → click again to drill deeper → click empty to go back. Add a breadcrumb overlay showing the current level. Auto-zoom the camera on drill-down transitions.

**Architecture:** A new `useDrillDown` hook manages a 3-level state machine (möbel → element → platte). `Preview3D` receives a single unified click handler from this hook. `ConfiguratorShell` replaces the mode-toggle buttons with the breadcrumb and switches sidebar panels based on the current drill-down level. Three placeholder sidebar panels are created (real content is a follow-up plan).

**Tech Stack:** TypeScript, React (hooks, refs), React Three Fiber, camera-controls (`fitToBox`/`setLookAt`)

**Spec:** `docs/superpowers/specs/2026-04-16-3d-first-configurator-design.md`

---

### Task 1: Create useDrillDown hook

**Files:**
- Create: `src/features/preview3d/useDrillDown.ts`

- [ ] **Step 1: Create the drill-down state machine**

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';

// ── Typen ────────────────────────────────────────────────────────────────────

export type DrillLevel = 'moebel' | 'element' | 'platte';

export interface DrillState {
  level: DrillLevel;
  /** Selektiertes Element (Möbel- und Element-Ebene) */
  selectedCell: { row: number; col: number } | null;
  /** Selektierte Platte (Platten-Ebene) */
  selectedPlateId: string | null;
  selectedPlateType: string | null;
}

export interface DrillActions {
  /** Einheitlicher Klick-Handler für Platten (PlattenPart) */
  handlePlateClick: (row: number, col: number, plateId: string, partType: string) => void;
  /** Einheitlicher Klick-Handler für Griffe/Strukturteile (SmartMesh mit row/col) */
  handleMeshClick: (row: number, col: number) => void;
  /** Klick ins Leere (Canvas-Hintergrund) */
  handleMiss: () => void;
  /** Breadcrumb-Navigation: direkt zu einer Ebene springen */
  goToLevel: (level: DrillLevel) => void;
  /** Escape-Taste: eine Ebene hoch */
  goUp: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDrillDown(): [DrillState, DrillActions] {
  const [state, setState] = useState<DrillState>({
    level: 'moebel',
    selectedCell: null,
    selectedPlateId: null,
    selectedPlateType: null,
  });

  // Ref für stabile Callback-Referenzen (vermeidet Re-Render-Kaskaden)
  const stateRef = useRef(state);
  stateRef.current = state;

  const handlePlateClick = useCallback((row: number, col: number, plateId: string, partType: string) => {
    const s = stateRef.current;

    if (s.level === 'moebel') {
      // Möbel-Ebene: Klick auf Element → selektieren
      if (s.selectedCell && s.selectedCell.row === row && s.selectedCell.col === col) {
        // Bereits selektiert → Drill-Down in Element-Ebene
        setState({
          level: 'element',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      } else {
        // Neues Element selektieren (bleibe in Möbel-Ebene)
        setState({
          level: 'moebel',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      }
    } else if (s.level === 'element') {
      // Element-Ebene: Klick auf Platte → Drill-Down in Platten-Ebene
      if (s.selectedCell && s.selectedCell.row === row && s.selectedCell.col === col) {
        // Platte im selektierten Element → Drill-Down
        setState({
          level: 'platte',
          selectedCell: { row, col },
          selectedPlateId: plateId,
          selectedPlateType: partType,
        });
      } else {
        // Anderes Element geklickt → wechsle Element (bleibe in Element-Ebene)
        setState({
          level: 'element',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      }
    } else {
      // Platten-Ebene: Klick auf andere Platte im selben Element → wechsle Platte
      if (s.selectedCell && s.selectedCell.row === row && s.selectedCell.col === col) {
        setState({
          ...s,
          selectedPlateId: plateId,
          selectedPlateType: partType,
        });
      } else {
        // Andere Zelle → zurück zur Element-Ebene mit neuem Element
        setState({
          level: 'element',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      }
    }
  }, []);

  const handleMeshClick = useCallback((row: number, col: number) => {
    const s = stateRef.current;

    if (s.level === 'moebel') {
      if (s.selectedCell && s.selectedCell.row === row && s.selectedCell.col === col) {
        setState({
          level: 'element',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      } else {
        setState({
          level: 'moebel',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      }
    } else if (s.level === 'element') {
      if (!(s.selectedCell && s.selectedCell.row === row && s.selectedCell.col === col)) {
        setState({
          level: 'element',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      }
    } else {
      if (!(s.selectedCell && s.selectedCell.row === row && s.selectedCell.col === col)) {
        setState({
          level: 'element',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      }
    }
  }, []);

  const handleMiss = useCallback(() => {
    const s = stateRef.current;
    if (s.level === 'platte') {
      // Platten → Element
      setState({
        level: 'element',
        selectedCell: s.selectedCell,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    } else if (s.level === 'element') {
      // Element → Möbel (behalte Selektion)
      setState({
        level: 'moebel',
        selectedCell: s.selectedCell,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    } else {
      // Möbel → deselektieren
      setState({
        level: 'moebel',
        selectedCell: null,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    }
  }, []);

  const goToLevel = useCallback((level: DrillLevel) => {
    const s = stateRef.current;
    if (level === 'moebel') {
      setState({
        level: 'moebel',
        selectedCell: s.selectedCell,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    } else if (level === 'element') {
      setState({
        level: 'element',
        selectedCell: s.selectedCell,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    }
    // platte: kein direkter Sprung zur Platten-Ebene per Breadcrumb
  }, []);

  const goUp = useCallback(() => {
    const s = stateRef.current;
    if (s.level === 'platte') {
      setState({
        level: 'element',
        selectedCell: s.selectedCell,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    } else if (s.level === 'element') {
      setState({
        level: 'moebel',
        selectedCell: s.selectedCell,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    } else {
      setState({
        level: 'moebel',
        selectedCell: null,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    }
  }, []);

  return [state, { handlePlateClick, handleMeshClick, handleMiss, goToLevel, goUp }];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/useDrillDown.ts
git commit -m "3D Konfig: useDrillDown State-Maschine (Möbel→Element→Platte)"
```

---

### Task 2: Create Breadcrumb overlay

**Files:**
- Create: `src/features/preview3d/Breadcrumb.tsx`

- [ ] **Step 1: Create the breadcrumb component**

```typescript
'use client';

import type { DrillLevel } from './useDrillDown';

const PART_LABELS: Record<string, string> = {
  seite_l: 'Seite L', seite_r: 'Seite R',
  boden: 'Boden', deckel: 'Deckel', ruecken: 'Rückwand',
  zwischenboden: 'Zwischenboden', zwischenwand: 'Zwischenwand', front: 'Front',
};

interface BreadcrumbProps {
  level: DrillLevel;
  selectedCell: { row: number; col: number } | null;
  selectedPlateType: string | null;
  onGoToLevel: (level: DrillLevel) => void;
}

export default function Breadcrumb({ level, selectedCell, selectedPlateType, onGoToLevel }: BreadcrumbProps) {
  // Möbel-Ebene ohne Selektion → keine Breadcrumb anzeigen
  if (level === 'moebel' && !selectedCell) return null;

  const crumbs: { label: string; level: DrillLevel; active: boolean }[] = [
    { label: 'Möbel', level: 'moebel', active: level === 'moebel' },
  ];

  if (level === 'element' || level === 'platte') {
    const cellLabel = selectedCell ? `Element R${selectedCell.row + 1}·C${selectedCell.col + 1}` : 'Element';
    crumbs.push({ label: cellLabel, level: 'element', active: level === 'element' });
  }

  if (level === 'platte') {
    const plateLabel = selectedPlateType ? (PART_LABELS[selectedPlateType] ?? selectedPlateType) : 'Platte';
    crumbs.push({ label: plateLabel, level: 'platte', active: true });
  }

  return (
    <div style={{
      position: 'absolute', top: 68, left: 16, zIndex: 10,
      display: 'flex', alignItems: 'center', gap: 0,
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      borderRadius: 8, padding: '5px 10px',
      fontFamily: 'var(--font-sans)', fontSize: 11,
      boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
    }}>
      {crumbs.map((crumb, i) => (
        <span key={crumb.level} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && (
            <span style={{ margin: '0 6px', color: '#C0BCB6', fontSize: 9 }}>›</span>
          )}
          <button
            onClick={() => !crumb.active && onGoToLevel(crumb.level)}
            disabled={crumb.active}
            style={{
              background: 'none', border: 'none', padding: '2px 4px',
              cursor: crumb.active ? 'default' : 'pointer',
              color: crumb.active ? '#171614' : '#8A8680',
              fontWeight: crumb.active ? 600 : 400,
              fontSize: 11, fontFamily: 'inherit',
              letterSpacing: '.02em',
              textDecoration: crumb.active ? 'none' : 'none',
            }}
            onMouseEnter={(e) => {
              if (!crumb.active) e.currentTarget.style.color = '#171614';
            }}
            onMouseLeave={(e) => {
              if (!crumb.active) e.currentTarget.style.color = '#8A8680';
            }}
          >
            {crumb.label}
          </button>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/Breadcrumb.tsx
git commit -m "3D Konfig: Breadcrumb-Overlay für Drill-Down-Navigation"
```

---

### Task 3: Add auto-zoom to Preview3D

**Files:**
- Modify: `src/features/preview3d/Preview3D.tsx`

This task adds a `CameraDrillZoom` component inside the Canvas that animates the camera when the drill-down level changes. It also changes the click handler props to support the unified drill-down model.

- [ ] **Step 1: Update Preview3DProps interface**

Replace the existing `Preview3DProps` interface (line 374–382) with:

```typescript
interface Preview3DProps {
  state: ConfigState;
  cameraElevation?: number;
  /** Einheitlicher Klick-Handler: Platte geklickt (row, col, plateId, partType) */
  onPlateClick?: (row: number, col: number, plateId: string, partType: string) => void;
  /** Einheitlicher Klick-Handler: Mesh mit row/col geklickt (Griffe, Strukturteile) */
  onMeshClick?: (row: number, col: number) => void;
  /** Klick ins Leere */
  onMiss?: () => void;
  /** Drill-Down Level — steuert Highlight-Verhalten */
  drillLevel?: 'moebel' | 'element' | 'platte';
  selectedCell?: { row: number; col: number } | null;
  selectedPlateId?: string | null;
}
```

- [ ] **Step 2: Update the Preview3D component signature and click handlers**

Replace the `forwardRef` line and the destructuring (lines 384–392) with:

```typescript
const Preview3D = forwardRef<ThreeCanvasHandle, Preview3DProps>(function Preview3D({
  state,
  cameraElevation = 0.55,
  onPlateClick,
  onMeshClick,
  onMiss,
  drillLevel = 'moebel',
  selectedCell,
  selectedPlateId,
}, ref) {
```

- [ ] **Step 3: Update PlattenPart onClick handler**

Replace the `PlattenPart` `onClick` prop implementation (lines 259–266 in the mesh element) with:

```typescript
      onClick={(e) => {
        e.stopPropagation();
        if (obj.row != null && obj.col != null && onPlateClick) {
          onPlateClick(obj.row, obj.col, obj.id, obj.partType);
        }
      }}
```

- [ ] **Step 4: Update PlattenPart component props**

Replace the `PlattenPart` props interface (lines 173–188) — remove `interactionMode`, `onSelect`, `onSelectPlate` and replace with `onPlateClick`:

```typescript
function PlattenPart({
  obj,
  catOverrides,
  onPlateClick,
  partColors,
  cellColors,
}: {
  obj: SceneObject;
  catOverrides: Record<string, BomCatOverride>;
  onPlateClick?: (row: number, col: number, plateId: string, partType: string) => void;
  partColors?: Record<string, string>;
  cellColors?: Record<string, string>;
}) {
```

Remove the `interactionMode` logic from the onClick — it's now always the same (pass all info, let useDrillDown decide):

```typescript
      onClick={(e) => {
        e.stopPropagation();
        if (obj.row != null && obj.col != null && onPlateClick) {
          onPlateClick(obj.row, obj.col, obj.id, obj.partType);
        }
      }}
```

- [ ] **Step 5: Update PlattenPart usage in the render section**

Replace the PlattenPart rendering block (lines 510–523) with:

```typescript
      <group name="platten">
        {plattenObjs.map(obj => (
          <PlattenPart
            key={obj.id}
            obj={obj}
            catOverrides={state.catOverrides}
            onPlateClick={onPlateClick}
            partColors={state.partColors}
            cellColors={state.cellColors}
          />
        ))}
      </group>
```

- [ ] **Step 6: Update handle SmartMesh onClick**

Replace the handle onClick (lines 560–562) with:

```typescript
              onClick={obj.row != null && obj.col != null && onMeshClick
                ? (e) => { e.stopPropagation(); onMeshClick(obj.row!, obj.col!); }
                : undefined}
```

(This is identical to the current code but uses `onMeshClick` instead of `onSelectModule`.)

- [ ] **Step 7: Update onPointerMissed on Canvas**

Replace the `onPointerMissed` handler (line 478–480) with:

```typescript
      onPointerMissed={() => {
        if (onMiss) onMiss();
      }}
```

- [ ] **Step 8: Update selection highlight rendering**

Replace the highlight section (lines 588–594) with:

```typescript
      {/* Grüner Highlight-Rahmen — je nach Drill-Down-Ebene */}
      {selectedCell && drillLevel !== 'platte' && (
        <SelectionHighlight objects={objects} row={selectedCell.row} col={selectedCell.col} />
      )}
      {selectedPlateId && drillLevel === 'platte' && (
        <PlateHighlight objects={objects} plateId={selectedPlateId} />
      )}
```

- [ ] **Step 9: Add CameraDrillZoom component**

Add this component after `CameraAutoFrame` (after line 80):

```typescript
// ── CameraDrillZoom — Auto-Zoom bei Drill-Down-Transition ────────────────────

function CameraDrillZoom({
  ccRef,
  drillLevel,
  selectedCell,
  selectedPlateId,
  objects,
  furnitureBounds,
}: {
  ccRef: React.MutableRefObject<CameraControlsImpl | null>;
  drillLevel: 'moebel' | 'element' | 'platte';
  selectedCell: { row: number; col: number } | null;
  selectedPlateId: string | null;
  objects: SceneObject[];
  furnitureBounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
}) {
  // Vorherige Ebene merken um Transitionen zu erkennen
  const prevLevel = useRef(drillLevel);
  const prevCell = useRef(selectedCell);

  useEffect(() => {
    const cc = ccRef.current;
    if (!cc) return;

    const levelChanged = prevLevel.current !== drillLevel;
    const cellChanged = prevCell.current?.row !== selectedCell?.row || prevCell.current?.col !== selectedCell?.col;
    prevLevel.current = drillLevel;
    prevCell.current = selectedCell;

    if (!levelChanged && !cellChanged) return;

    if (drillLevel === 'moebel') {
      // Zurück zur Gesamtansicht
      const box = new THREE.Box3(
        new THREE.Vector3(furnitureBounds.minX, furnitureBounds.minY, furnitureBounds.minZ),
        new THREE.Vector3(furnitureBounds.maxX, furnitureBounds.maxY, furnitureBounds.maxZ),
      );
      const pad = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * 0.6;
      cc.fitToBox(box, true, { paddingLeft: pad, paddingRight: pad, paddingTop: pad, paddingBottom: pad });
    } else if (drillLevel === 'element' && selectedCell) {
      // Zoom auf selektiertes Element
      const matched = objects.filter(o => o.row === selectedCell.row && o.col === selectedCell.col);
      if (matched.length === 0) return;
      const box = new THREE.Box3();
      for (const obj of matched) {
        const hw = obj.size[0] / 2, hh = obj.size[1] / 2, hd = obj.size[2] / 2;
        box.expandByPoint(new THREE.Vector3(obj.position[0] - hw, obj.position[1] - hh, obj.position[2] - hd));
        box.expandByPoint(new THREE.Vector3(obj.position[0] + hw, obj.position[1] + hh, obj.position[2] + hd));
      }
      const pad = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * 0.4;
      cc.fitToBox(box, true, { paddingLeft: pad, paddingRight: pad, paddingTop: pad, paddingBottom: pad });
    } else if (drillLevel === 'platte' && selectedPlateId) {
      // Zoom auf selektierte Platte
      const obj = objects.find(o => o.id === selectedPlateId);
      if (!obj) return;
      const hw = obj.size[0] / 2, hh = obj.size[1] / 2, hd = obj.size[2] / 2;
      const box = new THREE.Box3(
        new THREE.Vector3(obj.position[0] - hw, obj.position[1] - hh, obj.position[2] - hd),
        new THREE.Vector3(obj.position[0] + hw, obj.position[1] + hh, obj.position[2] + hd),
      );
      const pad = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * 0.3;
      cc.fitToBox(box, true, { paddingLeft: pad, paddingRight: pad, paddingTop: pad, paddingBottom: pad });
    }
  }, [ccRef, drillLevel, selectedCell, selectedPlateId, objects, furnitureBounds]);

  return null;
}
```

- [ ] **Step 10: Add CameraDrillZoom to the Canvas render tree**

Add after `CameraAutoFrame` (line 620), before the closing `</Canvas>`:

```typescript
      <CameraDrillZoom
        ccRef={ccRef}
        drillLevel={drillLevel}
        selectedCell={selectedCell ?? null}
        selectedPlateId={selectedPlateId ?? null}
        objects={objects}
        furnitureBounds={{ minX: boxMinX, minY: boxMinY, minZ: boxMinZ, maxX: boxMaxX, maxY: boxMaxY, maxZ: boxMaxZ }}
      />
```

- [ ] **Step 11: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 12: Commit**

```bash
git add src/features/preview3d/Preview3D.tsx
git commit -m "3D Konfig: Preview3D auf Drill-Down-API + CameraDrillZoom umstellen"
```

---

### Task 4: Create placeholder sidebar panels

**Files:**
- Create: `src/features/configurator/SidebarMoebel.tsx`
- Create: `src/features/configurator/SidebarElement.tsx`
- Create: `src/features/configurator/SidebarPlatte.tsx`

These are minimal stubs showing the level name. Real content is a follow-up plan.

- [ ] **Step 1: Create SidebarMoebel.tsx**

```typescript
'use client';

import type { ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { FOOTERS, MATERIALS, MAT_BY_V } from '@/core/constants';

const MAT_ALL = MATERIALS.filter(m => m.v !== 'none');

interface Props {
  state: ConfigState;
  actions: ConfigActions;
}

export default function SidebarMoebel({ state, actions }: Props) {
  const matObj = MAT_BY_V[state.surface];

  return (
    <div style={{ padding: '20px 20px 0' }}>

      {/* ── OBERFLÄCHE ── */}
      <Section label="Oberfläche">
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
          {MAT_ALL.map(m => (
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
        {matObj ? (
          <p style={{ fontSize: 9, color: '#A8A49C', marginTop: 8 }}>{matObj.l} · {matObj.pg}</p>
        ) : (
          <p style={{ fontSize: 9, color: '#C8C4BC', marginTop: 8 }}>Keine Oberfläche gewählt</p>
        )}
      </Section>

      <Divider />

      {/* ── TIEFE ── */}
      <Section label="Tiefe">
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {[360, 580].map(d => (
            <button
              key={d}
              onClick={() => actions.setDepth(d)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                background: state.depth === d ? '#171614' : '#F2EFE9',
                color: state.depth === d ? '#FAFAF8' : '#6A6660',
                fontSize: 11, cursor: 'pointer', transition: 'all 0.14s ease',
                fontWeight: state.depth === d ? 500 : 400,
              }}
            >{d} mm</button>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── SEITEN + RÜCKEN ── */}
      <Section label="Seiten / Rücken">
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {(['outer', 'inner', 'back'] as const).map(k => (
            <button
              key={k}
              onClick={() => actions.toggleOpt(k)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, border: 'none',
                background: state.opts[k] ? '#171614' : '#F2EFE9',
                color: state.opts[k] ? '#FAFAF8' : '#6A6660',
                fontSize: 11, cursor: 'pointer', transition: 'all 0.14s ease',
                fontWeight: state.opts[k] ? 500 : 400,
              }}
            >{k === 'outer' ? 'Außen' : k === 'inner' ? 'Innen' : 'Rücken'}</button>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── FÜSSE ── */}
      <Section label="Füße / Rollen">
        <select
          value={state.footer}
          onChange={e => actions.setFooter(e.target.value)}
          style={{ ...SELECT_STYLE, marginTop: 10 }}
        >
          {FOOTERS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
        </select>
      </Section>
    </div>
  );
}

// ── Hilfskomponenten (identisch zu ConfiguratorShell) ────────────────────────

function Section({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: 4 }}>
      <span style={{
        fontFamily: 'var(--font-sans)', fontWeight: 600,
        fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase',
        color: '#C0BCB6', display: 'block',
      }}>{label}</span>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: '#EDEAE5', margin: '16px 0' }} />;
}

const CHIP: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '50%',
  border: 'none', cursor: 'pointer', flexShrink: 0,
  padding: 0, outline: 'none',
  transition: 'transform 0.14s ease, box-shadow 0.14s ease',
};

const SELECT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
  background: '#F2EFE9', border: '1px solid #E2DFD9',
  color: '#36342F', borderRadius: 8,
  padding: '6px 10px', cursor: 'pointer',
  width: '100%', height: 34, outline: 'none',
};
```

- [ ] **Step 2: Create SidebarElement.tsx**

```typescript
'use client';

import type { ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { CELL_TYPES, HANDLES, MATERIALS } from '@/core/constants';
import { getAvailableFrontTypes } from '@/core/validation';

const MAT_ALL = MATERIALS.filter(m => m.v !== 'none');

interface Props {
  state: ConfigState;
  actions: ConfigActions;
  row: number;
  col: number;
}

export default function SidebarElement({ state, actions, row, col }: Props) {
  const cell = state.grid[row]?.[col];
  if (!cell) return null;

  const w = state.cols[col];
  const h = state.rows[row];
  const availableTypes = getAvailableFrontTypes(w, h);
  const cellColorKey = `${row}_${col}`;
  const currentCellColor = state.cellColors[cellColorKey];

  return (
    <div style={{ padding: '20px 20px 0' }}>

      {/* ── ELEMENT-INFO ── */}
      <div style={{
        background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
        padding: '10px 12px', marginBottom: 16,
      }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontWeight: 600,
          fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#166534',
        }}>
          Element R{row + 1} · C{col + 1}
        </span>
        <p style={{ fontSize: 11, color: '#15803D', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
          {w}×{h} mm · Tiefe {state.depth} mm
        </p>
      </div>

      {/* ── FRONTTYP ── */}
      <Section label="Front">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {CELL_TYPES.filter(ct => ct.v === 'O' || availableTypes.includes(ct.v)).map(ct => (
            <button
              key={ct.v}
              onClick={() => actions.setType(row, col, ct.v)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: cell.type === ct.v ? '#171614' : '#F2EFE9',
                color: cell.type === ct.v ? '#FAFAF8' : '#6A6660',
                fontSize: 11, cursor: 'pointer', transition: 'all 0.14s ease',
                fontWeight: cell.type === ct.v ? 500 : 400,
              }}
            >{ct.l}</button>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── FACHBÖDEN ── */}
      <Section label="Fachböden">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <button
            onClick={() => actions.setShelves(row, col, cell.shelves - 1)}
            disabled={cell.shelves <= 0}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: '#F2EFE9', color: '#6A6660', fontSize: 16, cursor: 'pointer',
              opacity: cell.shelves <= 0 ? 0.3 : 1,
            }}
          >−</button>
          <span style={{ fontSize: 18, fontWeight: 500, color: '#171614', minWidth: 24, textAlign: 'center' }}>
            {cell.shelves}
          </span>
          <button
            onClick={() => actions.setShelves(row, col, cell.shelves + 1)}
            disabled={cell.shelves >= 5}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: '#F2EFE9', color: '#6A6660', fontSize: 16, cursor: 'pointer',
              opacity: cell.shelves >= 5 ? 0.3 : 1,
            }}
          >+</button>
        </div>
      </Section>

      <Divider />

      {/* ── ELEMENTFARBE ── */}
      <Section label="Elementfarbe">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {/* Reset-Button */}
          <button
            onClick={() => actions.clearCellColor(row, col)}
            title="Global (zurücksetzen)"
            style={{
              ...CHIP,
              background: '#E4E0D9',
              boxShadow: !currentCellColor
                ? '0 0 0 2.5px #fff, 0 0 0 4.5px #171614'
                : '0 0 0 1px rgba(0,0,0,0.13)',
              transform: !currentCellColor ? 'scale(1.1)' : 'scale(1)',
              fontSize: 10, color: '#9a9690',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >↺</button>
          {MAT_ALL.map(m => (
            <button
              key={m.v}
              onClick={() => actions.setCellColor(row, col, m.hex)}
              title={`${m.l} (${m.pg})`}
              style={{
                ...CHIP,
                background: m.grad ?? m.hex,
                boxShadow: currentCellColor === m.hex
                  ? '0 0 0 2.5px #fff, 0 0 0 4.5px #171614'
                  : '0 0 0 1px rgba(0,0,0,0.13)',
                transform: currentCellColor === m.hex ? 'scale(1.1)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── GRIFF (global) ── */}
      <Section label="Griff (global)">
        <select
          value={state.handle}
          onChange={e => actions.setHandle(e.target.value)}
          style={{ ...SELECT_STYLE, marginTop: 10 }}
        >
          {HANDLES.map(h => <option key={h.v} value={h.v}>{h.l}</option>)}
        </select>
      </Section>
    </div>
  );
}

// ── Hilfskomponenten ─────────────────────────────────────────────────────────

function Section({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: 4 }}>
      <span style={{
        fontFamily: 'var(--font-sans)', fontWeight: 600,
        fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase',
        color: '#C0BCB6', display: 'block',
      }}>{label}</span>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: '#EDEAE5', margin: '16px 0' }} />;
}

const CHIP: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '50%',
  border: 'none', cursor: 'pointer', flexShrink: 0,
  padding: 0, outline: 'none',
  transition: 'transform 0.14s ease, box-shadow 0.14s ease',
};

const SELECT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
  background: '#F2EFE9', border: '1px solid #E2DFD9',
  color: '#36342F', borderRadius: 8,
  padding: '6px 10px', cursor: 'pointer',
  width: '100%', height: 34, outline: 'none',
};
```

- [ ] **Step 3: Create SidebarPlatte.tsx**

```typescript
'use client';

import type { ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { MATERIALS } from '@/core/constants';

const MAT_ALL = MATERIALS.filter(m => m.v !== 'none');

const PART_LABELS: Record<string, string> = {
  seite_l: 'Seite links', seite_r: 'Seite rechts',
  boden: 'Boden', deckel: 'Deckel', ruecken: 'Rückwand',
  zwischenboden: 'Zwischenboden', zwischenwand: 'Zwischenwand', front: 'Front',
};

// Strukturplatten die einen Kabeldurchlass haben können (keine Fronten)
const CABLE_ELIGIBLE = new Set(['boden', 'deckel', 'ruecken', 'seite_l', 'seite_r', 'zwischenboden', 'zwischenwand']);

interface Props {
  state: ConfigState;
  actions: ConfigActions;
  plateId: string;
  plateType: string;
}

export default function SidebarPlatte({ state, actions, plateId, plateType }: Props) {
  const currentColor = state.partColors[plateId];
  const hasCableHole = state.cableHoles[plateId] ?? false;
  const canHaveCable = CABLE_ELIGIBLE.has(plateType);

  return (
    <div style={{ padding: '20px 20px 0' }}>

      {/* ── PLATTEN-INFO ── */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
        padding: '10px 12px', marginBottom: 16,
      }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontWeight: 600,
          fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#1E40AF',
        }}>
          {PART_LABELS[plateType] ?? plateType}
        </span>
        <p style={{ fontSize: 10, color: '#3B82F6', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
          {plateId}
        </p>
      </div>

      {/* ── PLATTENFARBE ── */}
      <Section label="Plattenfarbe">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {/* Reset-Button */}
          <button
            onClick={() => actions.clearPartColor(plateId)}
            title="Element-/Globalfarbe (zurücksetzen)"
            style={{
              ...CHIP,
              background: '#E4E0D9',
              boxShadow: !currentColor
                ? '0 0 0 2.5px #fff, 0 0 0 4.5px #171614'
                : '0 0 0 1px rgba(0,0,0,0.13)',
              transform: !currentColor ? 'scale(1.1)' : 'scale(1)',
              fontSize: 10, color: '#9a9690',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >↺</button>
          {MAT_ALL.map(m => (
            <button
              key={m.v}
              onClick={() => actions.setPartColor(plateId, m.hex)}
              title={`${m.l} (${m.pg})`}
              style={{
                ...CHIP,
                background: m.grad ?? m.hex,
                boxShadow: currentColor === m.hex
                  ? '0 0 0 2.5px #fff, 0 0 0 4.5px #171614'
                  : '0 0 0 1px rgba(0,0,0,0.13)',
                transform: currentColor === m.hex ? 'scale(1.1)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </Section>

      {/* ── KABELDURCHLASS ── */}
      {canHaveCable && (
        <>
          <Divider />
          <Section label="Kabeldurchlass">
            <button
              onClick={() => actions.setCableHole(plateId, !hasCableHole)}
              style={{
                marginTop: 10, display: 'flex', alignItems: 'center', gap: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: 12, color: '#36342F',
                padding: 0,
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 4,
                border: `2px solid ${hasCableHole ? '#171614' : '#C0BCB6'}`,
                background: hasCableHole ? '#171614' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 12, fontWeight: 700,
                transition: 'all 0.14s ease',
              }}>
                {hasCableHole ? '✓' : ''}
              </span>
              80 × 60 mm, zentriert unten
            </button>
          </Section>
        </>
      )}
    </div>
  );
}

// ── Hilfskomponenten ─────────────────────────────────────────────────────────

function Section({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: 4 }}>
      <span style={{
        fontFamily: 'var(--font-sans)', fontWeight: 600,
        fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase',
        color: '#C0BCB6', display: 'block',
      }}>{label}</span>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: '#EDEAE5', margin: '16px 0' }} />;
}

const CHIP: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '50%',
  border: 'none', cursor: 'pointer', flexShrink: 0,
  padding: 0, outline: 'none',
  transition: 'transform 0.14s ease, box-shadow 0.14s ease',
};
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/features/configurator/SidebarMoebel.tsx src/features/configurator/SidebarElement.tsx src/features/configurator/SidebarPlatte.tsx
git commit -m "3D Konfig: Sidebar-Panels für Möbel/Element/Platte"
```

---

### Task 5: Wire everything together in ConfiguratorShell

**Files:**
- Modify: `src/features/configurator/ConfiguratorShell.tsx`

- [ ] **Step 1: Update imports**

Replace the import block (lines 1–11) with:

```typescript
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { AlignJustify, X } from 'lucide-react';
import { useConfigStore } from './useConfigStore';
import ConfigGrid from './ConfigGrid';
import BOMPanel from '@/features/bom/BOMPanel';
import { useDrillDown } from '@/features/preview3d/useDrillDown';
import type { ThreeCanvasHandle } from '@/features/preview3d/Preview3D';
import SidebarMoebel from './SidebarMoebel';
import SidebarElement from './SidebarElement';
import SidebarPlatte from './SidebarPlatte';

const Preview3D = dynamic(() => import('@/features/preview3d/Preview3D'), { ssr: false });
const Breadcrumb = dynamic(() => import('@/features/preview3d/Breadcrumb'), { ssr: false });
```

- [ ] **Step 2: Replace state management in ConfiguratorShell**

Replace the state declarations and handler functions (lines 23–47) with:

```typescript
export default function ConfiguratorShell() {
  const [state, actions] = useConfigStore();
  const [view, setView] = useState<'2d' | '3d'>('3d'); // 3D als Default
  const [drawerOpen, setDrawerOpen] = useState(false);
  const preview3DRef = useRef<ThreeCanvasHandle>(null);

  const [drill, drillActions] = useDrillDown();

  // Escape-Taste: eine Ebene hoch (nur im 3D-Modus)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== '3d') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        drillActions.goUp();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, drillActions]);
```

Remove: `selectedCell`, `interactionMode`, `selectedPlateId`, `selectedPlateType` useState hooks, `handleSelectPlate`, `handleSelectModule` callbacks. These are all replaced by `useDrillDown`.

- [ ] **Step 3: Remove the mode-toggle buttons**

Delete the entire block that renders the furniture/element/plate toggle buttons (lines 88–113):

```typescript
          {view === '3d' && (
            <div style={{
              position: 'absolute', top: 60, left: 16, zIndex: 10,
              ...
            }}>
              {(['furniture', 'element', 'plate'] as const).map(mode => (
                ...
              ))}
            </div>
          )}
```

- [ ] **Step 4: Update Preview3D props**

Replace the `<Preview3D>` usage (lines 114–123) with:

```typescript
          <Preview3D
            ref={preview3DRef}
            state={state}
            onPlateClick={drillActions.handlePlateClick}
            onMeshClick={drillActions.handleMeshClick}
            onMiss={drillActions.handleMiss}
            drillLevel={drill.level}
            selectedCell={drill.selectedCell}
            selectedPlateId={drill.selectedPlateId}
          />
```

- [ ] **Step 5: Add Breadcrumb overlay**

After the `Preview3D` component (inside the 3D container div), add:

```typescript
          {view === '3d' && (
            <Breadcrumb
              level={drill.level}
              selectedCell={drill.selectedCell}
              selectedPlateType={drill.selectedPlateType}
              onGoToLevel={drillActions.goToLevel}
            />
          )}
```

- [ ] **Step 6: Replace sidebar content with level-dependent panels**

Replace the entire sidebar scroll area (lines 207–390, the `<div style={{ flex: 1, padding: '20px 20px 0' }}>` block) with:

```typescript
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {view === '3d' ? (
            // 3D-Modus: Sidebar je nach Drill-Down-Ebene
            drill.level === 'platte' && drill.selectedPlateId && drill.selectedPlateType ? (
              <SidebarPlatte
                state={state}
                actions={actions}
                plateId={drill.selectedPlateId}
                plateType={drill.selectedPlateType}
              />
            ) : drill.level === 'element' && drill.selectedCell ? (
              <SidebarElement
                state={state}
                actions={actions}
                row={drill.selectedCell.row}
                col={drill.selectedCell.col}
              />
            ) : (
              <SidebarMoebel state={state} actions={actions} />
            )
          ) : (
            // 2D-Modus: Bestehende Sidebar-Inhalte als Fallback
            <SidebarMoebel state={state} actions={actions} />
          )}
        </div>
```

- [ ] **Step 7: Remove unused imports and constants**

Remove from imports (no longer needed in this file):
- `CELL_TYPES`, `FOOTERS`, `HANDLES`, `MATERIALS`, `MAT_BY_V` from `@/core/constants`
- The `MAT_ALL`, `PANEL_W` (keep if still used for sidebar width), `PART_LABELS` constants

Remove from the bottom of the file:
- `Section` function (moved to sidebar panels)
- `Divider` function (moved to sidebar panels)
- `CHIP` constant (moved to sidebar panels)
- `CHIP_SM` constant (unused)
- `SELECT_STYLE` constant (moved to sidebar panels)

Keep `PANEL_W = 264` if still referenced in the sidebar `<aside>` style.

- [ ] **Step 8: Clean up totalMM calculation**

The `totalMM` calculation (lines 50–66) is still needed for the header. Keep it as-is.

- [ ] **Step 9: Remove matObj and handleWarn**

Remove lines 68–70 (these were used by the old sidebar):

```typescript
  const matObj     = MAT_BY_V[state.surface];
  const hasFronts  = state.grid.some(row => row.some(c => c.type !== '' && c.type !== 'O'));
  const handleWarn = hasFronts && state.handle === 'none';
```

- [ ] **Step 10: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 11: Commit**

```bash
git add src/features/configurator/ConfiguratorShell.tsx
git commit -m "3D Konfig: Shell auf Drill-Down + Breadcrumb + Sidebar-Panels umstellen"
```

---

### Task 6: Visual verification and fine-tuning

**Files:**
- Possibly modify: `src/features/preview3d/Preview3D.tsx`, `src/features/preview3d/useDrillDown.ts`, `src/features/preview3d/Breadcrumb.tsx`

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Open: `http://localhost:3000`

- [ ] **Step 2: Verify drill-down flow**

1. App startet in 3D-Modus (nicht mehr 2D)
2. Klick auf ein Element → grüne Outline, Breadcrumb zeigt `Möbel`
3. Klick auf dasselbe Element nochmal → Kamera zoomt an Element heran, Sidebar wechselt zu Element-Panel (Fronttyp, Fachböden, etc.), Breadcrumb zeigt `Möbel › Element R1·C1`
4. Klick auf eine Platte im Element → Kamera zoomt an Platte, Sidebar wechselt zu Platten-Panel, Breadcrumb zeigt `Möbel › Element R1·C1 › Boden`
5. Klick ins Leere → eine Ebene hoch
6. Escape → eine Ebene hoch
7. Breadcrumb-Klick auf "Möbel" → zurück zur Gesamtansicht

- [ ] **Step 3: Verify sidebar panel switching**

1. Möbel-Ebene: Oberfläche, Tiefe, Seiten/Rücken, Füße sichtbar
2. Element-Ebene: Element-Info (grüne Box), Fronttyp, Fachböden, Elementfarbe, Griff sichtbar
3. Platten-Ebene: Platten-Info (blaue Box), Plattenfarbe, Kabeldurchlass sichtbar
4. Alle Aktionen funktionieren (Oberfläche wechseln, Fronttyp setzen, Fachböden ändern, Farbe setzen, etc.)

- [ ] **Step 4: Verify 2D fallback**

1. 2D/3D-Toggle unten links klicken → 2D-Grid erscheint
2. ConfigGrid funktioniert wie bisher
3. Zurück zu 3D → Änderungen aus 2D sind sichtbar

- [ ] **Step 5: Test edge cases**

1. Klick auf Element, dann anderes Element klicken → Selektion wechselt (bleibt in Möbel-Ebene)
2. Drill-Down auf Element, dann anderes Element klicken → wechselt Element (bleibt in Element-Ebene)
3. Leeres Grid (nur ein Element) → Drill-Down funktioniert trotzdem
4. Resize Browser → Layout bricht nicht

- [ ] **Step 6: Adjust auto-zoom padding if needed**

Falls die Kamera zu nah oder zu weit zoomt:
- `CameraDrillZoom` Möbel-Ebene: pad-Faktor `0.6` anpassen
- `CameraDrillZoom` Element-Ebene: pad-Faktor `0.4` anpassen
- `CameraDrillZoom` Platten-Ebene: pad-Faktor `0.3` anpassen

- [ ] **Step 7: Commit final adjustments**

```bash
git add -A
git commit -m "3D Konfig: Drill-Down Engine Feinschliff nach visueller Prüfung"
```

---

### Task 7: Full build verification

- [ ] **Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new errors (existing warnings acceptable)

- [ ] **Step 4: Final commit if build fixes were needed**

```bash
git add -A
git commit -m "3D Konfig: Build-Fixes nach vollständiger Verifikation"
```
