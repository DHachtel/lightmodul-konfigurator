# Ghost Zones + Remove Buttons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add transparent "ghost zone" expansion areas at furniture edges (left/right/top) with dimension popovers, and × remove buttons on each element — both visible only in Möbel-Ebene.

**Architecture:** Ghost zones are Three.js meshes (transparent boxes) with drei `Html` overlays for "+" and popovers. Remove buttons use drei `Html` positioned at each element's top-right. Both are rendered inside the `<Canvas>` in Preview3D. ConfiguratorShell provides callbacks that map ghost zone/remove actions to existing `ConfigActions` (addColLeft/Right, addRowTop, setType).

**Tech Stack:** TypeScript, React Three Fiber, @react-three/drei (Html, Edges), Three.js

**Spec:** `docs/superpowers/specs/2026-04-16-3d-first-configurator-design.md`

---

### Task 1: Create GhostZone component

**Files:**
- Create: `src/features/preview3d/GhostZone.tsx`

This component renders a single transparent box at a furniture edge with a "+" overlay.

- [ ] **Step 1: Create the GhostZone component**

```typescript
'use client';

import { useState, useMemo } from 'react';
import { Html, Edges } from '@react-three/drei';
import * as THREE from 'three';

export type GhostSide = 'left' | 'right' | 'top';

interface GhostZoneProps {
  side: GhostSide;
  /** Position des Zentrums in Three.js-Einheiten */
  position: [number, number, number];
  /** Größe in Three.js-Einheiten [w, h, d] */
  size: [number, number, number];
  onClick: (side: GhostSide) => void;
}

// Warmweiß-Farbe passend zum Artmodul-CD
const GHOST_COLOR = new THREE.Color('#E8E5DF').convertSRGBToLinear();

export default function GhostZone({ side, position, size, onClick }: GhostZoneProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <group>
      <mesh
        position={position}
        onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerLeave={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); onClick(side); }}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={GHOST_COLOR}
          transparent
          opacity={hovered ? 0.25 : 0.08}
          roughness={1.0}
          depthWrite={false}
        />
        <Edges color={hovered ? '#B0ADA8' : '#D0CDC8'} linewidth={1} />
      </mesh>

      {/* "+" Icon als HTML-Overlay im Zentrum der Ghost Zone */}
      <Html
        position={position}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: hovered ? 'rgba(23,22,20,0.75)' : 'rgba(23,22,20,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s ease, transform 0.2s ease',
          transform: hovered ? 'scale(1.15)' : 'scale(1)',
          cursor: 'pointer',
        }}>
          <span style={{
            color: '#FAFAF8', fontSize: 18, fontWeight: 300, lineHeight: 1,
          }}>+</span>
        </div>
      </Html>
    </group>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/GhostZone.tsx
git commit -m "3D Konfig: GhostZone-Komponente (transparente Erweiterungsfläche)"
```

---

### Task 2: Create GhostZonePopover component

**Files:**
- Create: `src/features/preview3d/GhostZonePopover.tsx`

HTML popover rendered via drei's `Html` inside the Canvas. Shows dimension dropdown + confirm button.

- [ ] **Step 1: Create the popover component**

```typescript
'use client';

import { useState } from 'react';
import { Html } from '@react-three/drei';
import type { GhostSide } from './GhostZone';

const WIDTHS = [420, 580, 780, 980];
const HEIGHTS = [180, 360, 580, 660, 720, 1080, 1440, 1800];

interface GhostZonePopoverProps {
  side: GhostSide;
  /** 3D-Position der Ghost Zone (Popover erscheint dort) */
  position: [number, number, number];
  onConfirm: (side: GhostSide, dimension: number) => void;
  onCancel: () => void;
}

export default function GhostZonePopover({ side, position, onConfirm, onCancel }: GhostZonePopoverProps) {
  const isColumn = side === 'left' || side === 'right';
  const options = isColumn ? WIDTHS : HEIGHTS;
  const defaultVal = isColumn ? 580 : 360;
  const [selected, setSelected] = useState(defaultVal);

  return (
    <Html position={position} center style={{ pointerEvents: 'auto' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FAFAF8',
          borderRadius: 10,
          padding: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          border: '1px solid #E8E5E0',
          minWidth: 160,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <p style={{
          fontSize: 9, fontWeight: 600, letterSpacing: '.18em',
          textTransform: 'uppercase', color: '#C0BCB6', marginBottom: 10,
        }}>
          {isColumn ? 'Spaltenbreite' : 'Zeilenhöhe'}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {options.map(d => (
            <button
              key={d}
              onClick={() => setSelected(d)}
              style={{
                padding: '5px 10px', borderRadius: 6, border: 'none',
                background: selected === d ? '#171614' : '#F2EFE9',
                color: selected === d ? '#FAFAF8' : '#6A6660',
                fontSize: 11, cursor: 'pointer',
                fontWeight: selected === d ? 500 : 400,
                transition: 'all 0.14s ease',
              }}
            >
              {d} mm
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #E2DFD9',
              background: 'transparent', color: '#6A6660', fontSize: 11,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Abbrechen
          </button>
          <button
            onClick={() => onConfirm(side, selected)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
              background: '#171614', color: '#FAFAF8', fontSize: 11,
              cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit',
            }}
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </Html>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/GhostZonePopover.tsx
git commit -m "3D Konfig: GhostZonePopover (Maßauswahl beim Erweitern)"
```

---

### Task 3: Create RemoveButton component

**Files:**
- Create: `src/features/preview3d/RemoveButton.tsx`

× button rendered via drei's `Html` at the top-right of an element.

- [ ] **Step 1: Create the remove button component**

```typescript
'use client';

import { Html } from '@react-three/drei';

interface RemoveButtonProps {
  /** 3D-Position: obere rechte Ecke des Elements */
  position: [number, number, number];
  visible: boolean;
  onClick: () => void;
}

export default function RemoveButton({ position, visible, onClick }: RemoveButtonProps) {
  if (!visible) return null;

  return (
    <Html position={position} center style={{ pointerEvents: 'auto' }}>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(23,22,20,0.72)',
          border: '1.5px solid rgba(255,255,255,0.3)',
          color: '#FAFAF8', fontSize: 12, fontWeight: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, lineHeight: 1,
          backdropFilter: 'blur(4px)',
          transition: 'background 0.14s ease, transform 0.14s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(180,40,30,0.85)';
          e.currentTarget.style.transform = 'scale(1.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(23,22,20,0.72)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        ×
      </button>
    </Html>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/RemoveButton.tsx
git commit -m "3D Konfig: RemoveButton-Komponente (×-Overlay auf Elementen)"
```

---

### Task 4: Integrate Ghost Zones and Remove Buttons in Preview3D

**Files:**
- Modify: `src/features/preview3d/Preview3D.tsx`

Add ghost zones at furniture edges and remove buttons on each element. Both only visible when `drillLevel === 'moebel'`.

- [ ] **Step 1: Add imports**

Add to the import section at the top of Preview3D.tsx:

```typescript
import { MAX_COLS, MAX_ROWS } from '@/core/constants';
import GhostZone from './GhostZone';
import type { GhostSide } from './GhostZone';
import GhostZonePopover from './GhostZonePopover';
import RemoveButton from './RemoveButton';
```

Also add `Html` to the drei import:

```typescript
import { ContactShadows, CameraControls, Edges, Html } from '@react-three/drei';
```

And add `useState` to the React import:

```typescript
import { useMemo, useEffect, useRef, useCallback, useImperativeHandle, forwardRef, Suspense, useState } from 'react';
```

- [ ] **Step 2: Add ghost zone and remove callbacks to Preview3DProps**

Add these props to the `Preview3DProps` interface:

```typescript
interface Preview3DProps {
  state: ConfigState;
  cameraElevation?: number;
  onPlateClick?: (row: number, col: number, plateId: string, partType: string) => void;
  onMeshClick?: (row: number, col: number) => void;
  onMiss?: () => void;
  drillLevel?: 'moebel' | 'element' | 'platte';
  selectedCell?: { row: number; col: number } | null;
  selectedPlateId?: string | null;
  /** Ghost Zone: Spalte/Zeile hinzufügen */
  onGhostConfirm?: (side: GhostSide, dimension: number) => void;
  /** Element entfernen (row, col) */
  onRemoveElement?: (row: number, col: number) => void;
}
```

Update the destructuring:

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
  onGhostConfirm,
  onRemoveElement,
}, ref) {
```

- [ ] **Step 3: Add ghost zone position computation and popover state**

Add after the `objects` variable (after line 492), before the object group filters:

```typescript
  // ── Ghost Zones: Positionen berechnen ──
  // Aktive Spalten/Zeilen-Indizes ermitteln
  const activeRange = useMemo(() => {
    const numRows = state.rows.length, numCols = state.cols.length;
    let minR = numRows, maxR = -1, minC = numCols, maxC = -1;
    for (let r = 0; r < numRows; r++)
      for (let c = 0; c < numCols; c++)
        if (state.grid[r][c].type !== '') {
          if (r < minR) minR = r; if (r > maxR) maxR = r;
          if (c < minC) minC = c; if (c > maxC) maxC = c;
        }
    if (maxR < 0) { minR = 0; maxR = 0; minC = 0; maxC = 0; }
    return { minR, maxR, minC, maxC };
  }, [state.grid, state.rows.length, state.cols.length]);

  const ghostZones = useMemo(() => {
    const S = 0.01;
    const zones: { side: GhostSide; position: [number, number, number]; size: [number, number, number] }[] = [];
    const { minR, maxR, minC, maxC } = activeRange;
    const depth = state.depth * S;
    const depthCenter = depth / 2;

    // Vertikale Mitte + Höhe der aktiven Region
    const activeYBottom = state.rows.slice(maxR + 1).reduce((a, b) => a + b, 0) * S;
    const activeH = state.rows.slice(minR, maxR + 1).reduce((a, b) => a + b, 0) * S;
    const activeYCenter = activeYBottom + activeH / 2;

    // Horizontale Mitte + Breite der aktiven Region
    const activeXLeft = state.cols.slice(0, minC).reduce((a, b) => a + b, 0) * S;
    const activeW = state.cols.slice(minC, maxC + 1).reduce((a, b) => a + b, 0) * S;
    const activeXCenter = activeXLeft + activeW / 2;

    // Ghost-Breite/-Höhe: Default-Spalte/Zeile
    const ghostColW = 580 * S; // 5.8 Three.js-Einheiten
    const ghostRowH = 360 * S;

    // Links (nur wenn MAX_COLS nicht erreicht)
    if (state.cols.length < MAX_COLS) {
      zones.push({
        side: 'left',
        position: [activeXLeft - ghostColW / 2 - 0.01, activeYCenter, depthCenter],
        size: [ghostColW, activeH, depth],
      });
    }

    // Rechts
    if (state.cols.length < MAX_COLS) {
      zones.push({
        side: 'right',
        position: [activeXLeft + activeW + ghostColW / 2 + 0.01, activeYCenter, depthCenter],
        size: [ghostColW, activeH, depth],
      });
    }

    // Oben
    if (state.rows.length < MAX_ROWS) {
      zones.push({
        side: 'top',
        position: [activeXCenter, activeYBottom + activeH + ghostRowH / 2 + 0.01, depthCenter],
        size: [activeW, ghostRowH, depth],
      });
    }

    return zones;
  }, [activeRange, state.cols, state.rows, state.depth]);

  // Popover-State: welche Ghost Zone zeigt den Dimension-Picker
  const [activeGhost, setActiveGhost] = useState<{ side: GhostSide; position: [number, number, number] } | null>(null);

  const handleGhostClick = useCallback((side: GhostSide) => {
    const zone = ghostZones.find(z => z.side === side);
    if (zone) setActiveGhost({ side, position: zone.position });
  }, [ghostZones]);

  const handleGhostConfirm = useCallback((side: GhostSide, dimension: number) => {
    setActiveGhost(null);
    if (onGhostConfirm) onGhostConfirm(side, dimension);
  }, [onGhostConfirm]);

  const handleGhostCancel = useCallback(() => {
    setActiveGhost(null);
  }, []);

  // ── Remove Buttons: Position pro aktivem Element ──
  const removePositions = useMemo(() => {
    const S = 0.01;
    const positions: { row: number; col: number; position: [number, number, number] }[] = [];
    const { minR, maxR, minC, maxC } = activeRange;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (state.grid[r]?.[c]?.type === '') continue;
        // Obere rechte Ecke des Elements berechnen
        const xLeft = state.cols.slice(0, c).reduce((a, b) => a + b, 0);
        const yBottom = state.rows.slice(r + 1).reduce((a, b) => a + b, 0);
        const w = state.cols[c];
        const h = state.rows[r];
        // Position: rechts oben, leicht vor dem Möbel (Z)
        positions.push({
          row: r, col: c,
          position: [(xLeft + w) * S, (yBottom + h) * S, (state.depth + 20) * S],
        });
      }
    }
    return positions;
  }, [activeRange, state.grid, state.cols, state.rows, state.depth]);

  // Hovered-Element für Remove-Button-Sichtbarkeit
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
```

- [ ] **Step 4: Update onPointerMissed to close popover**

Replace the `onPointerMissed` handler:

```typescript
      onPointerMissed={() => {
        if (activeGhost) { setActiveGhost(null); return; }
        if (onMiss) onMiss();
      }}
```

- [ ] **Step 5: Add hover tracking to PlattenPart**

Add `onHoverCell` prop to `PlattenPart`:

In the PlattenPart function signature, add:
```typescript
  onHoverCell?: (cellKey: string | null) => void;
```

In the PlattenPart mesh, add pointer handlers:
```typescript
      onPointerEnter={(e) => {
        e.stopPropagation();
        if (obj.row != null && obj.col != null && onHoverCell) {
          onHoverCell(`${obj.row}_${obj.col}`);
        }
      }}
      onPointerLeave={() => {
        if (onHoverCell) onHoverCell(null);
      }}
```

Update PlattenPart usage in the render section to pass `onHoverCell`:
```typescript
          <PlattenPart
            key={obj.id}
            obj={obj}
            catOverrides={state.catOverrides}
            onPlateClick={onPlateClick}
            partColors={state.partColors}
            cellColors={state.cellColors}
            onHoverCell={drillLevel === 'moebel' ? setHoveredCell : undefined}
          />
```

- [ ] **Step 6: Render Ghost Zones and Remove Buttons in Canvas**

Add after the selection highlight section (after line 656), before the ContactShadows:

```typescript
      {/* Ghost Zones — nur in Möbel-Ebene sichtbar */}
      {drillLevel === 'moebel' && !activeGhost && ghostZones.map(zone => (
        <GhostZone
          key={zone.side}
          side={zone.side}
          position={zone.position}
          size={zone.size}
          onClick={handleGhostClick}
        />
      ))}

      {/* Ghost Zone Popover — Maßauswahl */}
      {drillLevel === 'moebel' && activeGhost && (
        <GhostZonePopover
          side={activeGhost.side}
          position={activeGhost.position}
          onConfirm={handleGhostConfirm}
          onCancel={handleGhostCancel}
        />
      )}

      {/* Remove Buttons — × auf jedem Element, nur in Möbel-Ebene bei Hover */}
      {drillLevel === 'moebel' && removePositions.map(rp => (
        <RemoveButton
          key={`rm_${rp.row}_${rp.col}`}
          position={rp.position}
          visible={hoveredCell === `${rp.row}_${rp.col}`}
          onClick={() => onRemoveElement?.(rp.row, rp.col)}
        />
      ))}
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add src/features/preview3d/Preview3D.tsx
git commit -m "3D Konfig: Ghost Zones + Remove Buttons in Preview3D integrieren"
```

---

### Task 5: Wire callbacks in ConfiguratorShell

**Files:**
- Modify: `src/features/configurator/ConfiguratorShell.tsx`

Connect ghost zone and remove callbacks to existing ConfigActions.

- [ ] **Step 1: Add imports**

Add to ConfiguratorShell.tsx imports:

```typescript
import { useCallback } from 'react';
import type { GhostSide } from '@/features/preview3d/GhostZone';
```

Update the React import to include `useCallback`:
```typescript
import { useState, useRef, useEffect, useCallback } from 'react';
```

- [ ] **Step 2: Add ghost zone confirm handler**

Add after the `useDrillDown()` hook call and the Escape handler:

```typescript
  // ── Ghost Zone: Spalte/Zeile mit gewählter Dimension hinzufügen ──
  const handleGhostConfirm = useCallback((side: GhostSide, dimension: number) => {
    if (side === 'left') {
      actions.addColLeft();
      // Neue Spalte ist jetzt Index 0 — Breite setzen
      actions.setCol(0, dimension);
      // Alle aktiven Zeilen in der neuen Spalte mit 'O' füllen
      for (let r = 0; r < state.rows.length; r++) {
        // Prüfe ob rechts daneben ein aktives Element ist (dann auch links füllen)
        if (state.grid[r]?.[1]?.type && state.grid[r][1].type !== '') {
          actions.setType(r, 0, 'O');
        }
      }
    } else if (side === 'right') {
      actions.addColRight();
      const newColIdx = state.cols.length; // nach addColRight ist die neue Spalte am Ende
      actions.setCol(newColIdx, dimension);
      for (let r = 0; r < state.rows.length; r++) {
        if (state.grid[r]?.[newColIdx - 1]?.type && state.grid[r][newColIdx - 1].type !== '') {
          actions.setType(r, newColIdx, 'O');
        }
      }
    } else if (side === 'top') {
      actions.addRowTop();
      // Neue Zeile ist jetzt Index 0 — Höhe setzen
      actions.setRow(0, dimension);
      // Alle aktiven Spalten in der neuen Zeile mit 'O' füllen
      for (let c = 0; c < state.cols.length; c++) {
        // Prüfe ob darunter ein aktives Element ist
        if (state.grid[1]?.[c]?.type && state.grid[1][c].type !== '') {
          actions.setType(0, c, 'O');
        }
      }
    }
  }, [actions, state.grid, state.cols.length, state.rows.length]);

  // ── Element entfernen: Zelle auf leer setzen ──
  const handleRemoveElement = useCallback((row: number, col: number) => {
    actions.setType(row, col, '');
  }, [actions]);
```

- [ ] **Step 3: Pass callbacks to Preview3D**

Update the Preview3D usage:

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
            onGhostConfirm={handleGhostConfirm}
            onRemoveElement={handleRemoveElement}
          />
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/features/configurator/ConfiguratorShell.tsx
git commit -m "3D Konfig: Ghost Zone + Remove Callbacks in ConfiguratorShell verdrahten"
```

---

### Task 6: Visual verification and build

**Files:**
- Possibly modify: any of the above for fine-tuning

- [ ] **Step 1: Start dev server and test ghost zones**

Run: `npm run dev`
Open: `http://localhost:3000/configurator`

Verify:
1. Ghost zones appear as translucent boxes at left, right, top of furniture
2. Hover → zones brighten, "+" icon scales up
3. Click → popover with dimension buttons appears
4. Select dimension + "Hinzufügen" → new column/row added with correct width/height
5. "Abbrechen" → popover closes, nothing happens
6. Click empty canvas → popover closes

- [ ] **Step 2: Test remove buttons**

Verify:
1. Hover over an element → × appears at top-right corner
2. Click × → element is removed (if no element above — gravity rule)
3. If gravity blocks removal → element stays (gravityError is set in useConfigStore)
4. × disappears when not hovering

- [ ] **Step 3: Test drill-down interaction**

Verify ghost zones and remove buttons:
1. Only visible in Möbel-Ebene
2. Drill-down to Element-Ebene → ghost zones and × disappear
3. Go back to Möbel-Ebene → they reappear

- [ ] **Step 4: Test edge cases**

1. Add columns until MAX_COLS (8) → ghost zones for left/right disappear
2. Add rows until MAX_ROWS (10) → ghost zone for top disappears
3. Single element → remove button works, results in empty grid
4. Column with multiple stacked elements → can only remove topmost (gravity)

- [ ] **Step 5: Run full build**

Run: `npx tsc --noEmit && npm run build`
Expected: 0 TypeScript errors, build succeeds

- [ ] **Step 6: Commit adjustments**

```bash
git add -A
git commit -m "3D Konfig: Ghost Zones + Remove Buttons Feinschliff"
```
