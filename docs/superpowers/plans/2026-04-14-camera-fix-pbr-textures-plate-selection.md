# Camera Fix, PBR Wood Textures & Plate Color Selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the camera zoom bug on sidebar changes, replace procedural wood textures with real PBR texture maps, and replace the 6-group FÜLLUNG swatch panel with single-plate click-to-color in 3D.

**Architecture:** Three independent fixes. (1) Stabilize `getActiveBounds` useMemo dependency with a grid-type hash string. (2) Downscale real PBR JPGs to 1024px, rewrite `useWoodTexture.ts` to load them via TextureLoader, update PlattenPart to use color+normal+roughness maps. (3) Add a Farbe/Modul toggle, extend PlattenPart with per-plate onClick, add single-plate highlight, replace FÜLLUNG section with a single swatch row, and flatten `partColors` to use SceneObject IDs.

**Tech Stack:** TypeScript, Three.js (TextureLoader, MeshStandardMaterial), React Three Fiber, Next.js, Python (PIL for texture downscaling)

**Spec:** `docs/superpowers/specs/2026-04-14-camera-fix-pbr-textures-plate-selection-design.md`

---

### Task 1: Fix camera zoom bug — stabilize getActiveBounds dependency

**Files:**
- Modify: `src/features/preview3d/Preview3D.tsx:245-250`

- [ ] **Step 1: Add gridHash useMemo before getActiveBounds**

In `Preview3D` component (after line 244, before the `getActiveBounds` useMemo), add a stable hash and update the dependency:

```typescript
  // Stabiler Hash aus Grid-Typen — ändert sich nur bei echten Strukturänderungen
  const gridHash = useMemo(
    () => state.grid.map(row => row.map(c => c.type).join(',')).join('|'),
    [state.grid],
  );

  // Kamera und Ziel auf aktive Bounding Box ausrichten — nicht auf das gesamte Grid
  const { xOff, yOff, wAct, hAct } = useMemo(
    () => getActiveBounds(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridHash, state.cols, state.rows],
  );
```

This replaces the existing lines 245-250. The key change: dependency is now `gridHash` (a string that only changes when cell types change) instead of `state.grid` (a reference that changes on every state update).

- [ ] **Step 2: Run tsc to verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/Preview3D.tsx
git commit -m "3D: Kamera-Zoom-Bug behoben — gridHash statt state.grid als Dependency"
```

---

### Task 2: Downscale PBR texture JPGs to 1024px and copy to public/

**Files:**
- Create: `public/textures/wood/zebrano_color.jpg`
- Create: `public/textures/wood/zebrano_normal.jpg`
- Create: `public/textures/wood/zebrano_roughness.jpg`
- Create: `public/textures/wood/nussbaum_color.jpg`
- Create: `public/textures/wood/nussbaum_normal.jpg`
- Create: `public/textures/wood/nussbaum_roughness.jpg`
- Create: `public/textures/wood/eiche_color.jpg`
- Create: `public/textures/wood/eiche_normal.jpg`
- Create: `public/textures/wood/eiche_roughness.jpg`

- [ ] **Step 1: Create output directory**

```bash
mkdir -p public/textures/wood
```

- [ ] **Step 2: Run Python script to downscale all textures**

```python
from PIL import Image
import os

base = r"Holzoberflächen"
mapping = [
    ("Zebrano",  "Wood014", "zebrano"),
    ("Nussbaum", "Wood067", "nussbaum"),
    ("Eiche",    "Wood049", "eiche"),
]
suffixes = [
    ("_2K-JPG_Color.jpg",     "_color.jpg"),
    ("_2K-JPG_NormalGL.jpg",  "_normal.jpg"),
    ("_2K-JPG_Roughness.jpg", "_roughness.jpg"),
]
out = "public/textures/wood"

for folder, prefix, name in mapping:
    for src_suffix, dst_suffix in suffixes:
        src = os.path.join(base, folder, prefix + src_suffix)
        dst = os.path.join(out, name + dst_suffix)
        img = Image.open(src)
        img = img.resize((1024, 1024), Image.LANCZOS)
        img.save(dst, "JPEG", quality=85)
        size_kb = os.path.getsize(dst) // 1024
        print(f"{dst} — {size_kb}KB")
```

Run: `python -c "...the above..."`
Expected: 9 files created in `public/textures/wood/`, each 50-300KB.

- [ ] **Step 3: Verify files exist**

```bash
ls -la public/textures/wood/
```

Expected: 9 JPG files.

- [ ] **Step 4: Commit**

```bash
git add public/textures/wood/
git commit -m "3D: PBR-Holztexturen (1024px) — Zebrano, Nussbaum, Eiche"
```

---

### Task 3: Rewrite useWoodTexture.ts to load PBR texture maps

**Files:**
- Rewrite: `src/features/preview3d/useWoodTexture.ts`

- [ ] **Step 1: Replace entire file with TextureLoader-based implementation**

```typescript
/**
 * PBR-Holztexturen — lädt statische Color/Normal/Roughness-Maps.
 * Gecacht: wird nur einmal pro Holzart geladen.
 */
import * as THREE from 'three';

export interface WoodTextureMaps {
  colorMap: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

type WoodType = 'zebrano' | 'nussbaum' | 'eiche';

const WOOD_PATHS: Record<WoodType, { color: string; normal: string; roughness: string }> = {
  zebrano: {
    color:     '/textures/wood/zebrano_color.jpg',
    normal:    '/textures/wood/zebrano_normal.jpg',
    roughness: '/textures/wood/zebrano_roughness.jpg',
  },
  nussbaum: {
    color:     '/textures/wood/nussbaum_color.jpg',
    normal:    '/textures/wood/nussbaum_normal.jpg',
    roughness: '/textures/wood/nussbaum_roughness.jpg',
  },
  eiche: {
    color:     '/textures/wood/eiche_color.jpg',
    normal:    '/textures/wood/eiche_normal.jpg',
    roughness: '/textures/wood/eiche_roughness.jpg',
  },
};

const loader = new THREE.TextureLoader();
const cache = new Map<string, WoodTextureMaps>();

function loadTex(path: string, srgb: boolean): THREE.Texture {
  const tex = loader.load(path);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  return tex;
}

/**
 * Liefert gecachte PBR-Texturmaps für die gegebene Holzart.
 * Gibt null zurück wenn `type` kein bekannter Holztyp ist.
 */
export function getWoodTexture(type: string): WoodTextureMaps | null {
  if (!(type in WOOD_PATHS)) return null;

  const cached = cache.get(type);
  if (cached) return cached;

  const paths = WOOD_PATHS[type as WoodType];
  const maps: WoodTextureMaps = {
    colorMap:     loadTex(paths.color, true),
    normalMap:    loadTex(paths.normal, false),
    roughnessMap: loadTex(paths.roughness, false),
  };
  cache.set(type, maps);
  return maps;
}
```

- [ ] **Step 2: Run tsc to verify**

Run: `npx tsc --noEmit`
Expected: Errors in Preview3D.tsx because `getWoodTexture` return type changed (was `THREE.CanvasTexture | null`, now `WoodTextureMaps | null`). These will be fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/useWoodTexture.ts
git commit -m "3D: useWoodTexture auf PBR-TextureLoader umgeschrieben"
```

---

### Task 4: Update PlattenPart to use PBR texture maps

**Files:**
- Modify: `src/features/preview3d/Preview3D.tsx:145-227` (PlattenPart component)

- [ ] **Step 1: Update PlattenPart wood texture usage**

Replace the woodMap/roughness section (lines ~194-224) in PlattenPart. The `woodType` detection (lines 178-186) stays unchanged. Replace from `// Prozedurale Holztextur` through the end of the return JSX:

```typescript
  // PBR-Holztexturen (Color + Normal + Roughness Maps)
  const woodMaps = useMemo(() => {
    if (!woodType) return null;
    return getWoodTexture(woodType);
  }, [woodType]);

  // Materialwerte: Holz nutzt PBR-Maps, Lack bleibt flat
  const roughness       = woodMaps ? 1.0 : PLATTEN_MAT.roughness;
  const metalness       = 0.0;
  const envMapIntensity = woodMaps ? 0.3 : PLATTEN_MAT.envMapIntensity;

  return (
    <mesh
      position={obj.position}
      castShadow
      receiveShadow
      onClick={obj.row != null && obj.col != null && onSelect
        ? (e) => { e.stopPropagation(); onSelect(obj.row!, obj.col!); }
        : undefined}
    >
      <boxGeometry args={obj.size} />
      <meshStandardMaterial
        color={effectiveColor}
        roughness={roughness}
        metalness={metalness}
        envMapIntensity={envMapIntensity}
        map={woodMaps?.colorMap ?? null}
        normalMap={woodMaps?.normalMap ?? null}
        roughnessMap={woodMaps?.roughnessMap ?? null}
      />
    </mesh>
  );
```

Also remove the now-unused `WOOD_ROUGHNESS` map (was defined inside the component).

- [ ] **Step 2: Run tsc to verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/Preview3D.tsx
git commit -m "3D: PlattenPart nutzt PBR-Texturmaps (Color + Normal + Roughness)"
```

---

### Task 5: Flatten partColors schema (SceneObject.id → hex)

**Files:**
- Modify: `src/core/types.ts:53-55` (partColors type)
- Modify: `src/features/configurator/useConfigStore.ts:58-60,164-178` (actions)

- [ ] **Step 1: Change partColors type in types.ts**

In `src/core/types.ts`, change the partColors field from nested to flat:

```typescript
  /** Individuelle Bauteilfarben — rein visuell, kein BOM-Einfluss.
   *  Schlüssel: SceneObject.id (z.B. "ruecken_r0_c0"), Wert: hex */
  partColors: Record<string, string>;
```

Also update in `BOMResult` if it references `partColors` — change to same flat type.

- [ ] **Step 2: Update useConfigStore actions**

In `src/features/configurator/useConfigStore.ts`, simplify the three partColor actions:

Replace the `ConfigActions` interface methods (lines 58-60):

```typescript
  setPartColor(plateId: string, hex: string): void;
  clearPartColor(plateId: string): void;
  clearAllPartColors(): void;
```

Replace the action implementations (lines 164-178):

```typescript
    setPartColor: (plateId, hex) => update(s => ({
      ...s, partColors: { ...s.partColors, [plateId]: hex },
    })),

    clearPartColor: (plateId) => update(s => {
      const pc = { ...s.partColors };
      delete pc[plateId];
      return { ...s, partColors: pc };
    }),

    clearAllPartColors: () => update(s => ({
      ...s, partColors: {},
    })),
```

Remove old `clearModuleColors` action.

- [ ] **Step 3: Update PlattenPart effectiveHex lookup in Preview3D**

In `PlattenPart` (Preview3D.tsx), update the `effectiveHex` useMemo to use the flat partColors:

```typescript
  const effectiveHex = useMemo(() => {
    // Individuelle Plattenfarbe (flat: SceneObject.id → hex)
    if (partColors?.[obj.id]) {
      return partColors[obj.id];
    }
    // catOverride (BOM-Kategorie-Level)
    const override = obj.catKey ? catOverrides[obj.catKey] : undefined;
    if (override?.oberflaeche) {
      const matDef = MAT_BY_V[override.oberflaeche];
      if (matDef) return matDef.hex;
    }
    return obj.color;
  }, [obj.id, obj.catKey, obj.color, catOverrides, partColors]);
```

Update `PlattenPart` props type: change `partColors` from `Record<string, Record<string, string>>` to `Record<string, string>`.

- [ ] **Step 4: Run tsc — fix remaining type errors**

Run: `npx tsc --noEmit`
Expected: Errors in ConfiguratorShell.tsx (FÜLLUNG section uses old API). These will be replaced in Task 7, but for now fix the compilation by commenting out or stubbing the FÜLLUNG section temporarily.

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/features/configurator/useConfigStore.ts src/features/preview3d/Preview3D.tsx
git commit -m "3D: partColors flat Schema (SceneObject.id → hex)"
```

---

### Task 6: Add plate selection mode to Preview3D

**Files:**
- Modify: `src/features/preview3d/Preview3D.tsx`

- [ ] **Step 1: Add onSelectPlate callback and selectedPlateId prop**

Update Preview3D props (around line 231):

```typescript
export default function Preview3D({
  state,
  cameraElevation = 0.55,
  onSelectModule,
  selectedCell,
  onSelectPlate,
  selectedPlateId,
  interactionMode = 'module',
}: {
  state: ConfigState;
  cameraElevation?: number;
  onSelectModule?: (row: number, col: number) => void;
  selectedCell?: { row: number; col: number } | null;
  onSelectPlate?: (plateId: string, partType: string) => void;
  selectedPlateId?: string | null;
  interactionMode?: 'module' | 'color';
}) {
```

- [ ] **Step 2: Update PlattenPart to support plate selection mode**

Add `onSelectPlate` and `interactionMode` props to PlattenPart:

```typescript
function PlattenPart({
  obj,
  catOverrides,
  onSelect,
  partColors,
  onSelectPlate,
  interactionMode,
}: {
  obj: SceneObject;
  catOverrides: Record<string, BomCatOverride>;
  onSelect?: (row: number, col: number) => void;
  partColors?: Record<string, string>;
  onSelectPlate?: (plateId: string, partType: string) => void;
  interactionMode?: 'module' | 'color';
}) {
```

Update the onClick handler in PlattenPart's mesh:

```typescript
      onClick={(e) => {
        e.stopPropagation();
        if (interactionMode === 'color' && onSelectPlate) {
          onSelectPlate(obj.id, obj.partType);
        } else if (obj.row != null && obj.col != null && onSelect) {
          onSelect(obj.row, obj.col);
        }
      }}
```

- [ ] **Step 3: Add PlateHighlight component**

Add after SelectionHighlight (around line 116):

```typescript
function PlateHighlight({
  objects,
  plateId,
}: {
  objects: SceneObject[];
  plateId: string;
}) {
  const obj = useMemo(
    () => objects.find(o => o.id === plateId),
    [objects, plateId],
  );
  if (!obj) return null;

  return (
    <mesh position={obj.position}>
      <boxGeometry args={obj.size} />
      <meshBasicMaterial visible={false} />
      <Edges color="#4ade80" linewidth={2} />
    </mesh>
  );
}
```

- [ ] **Step 4: Update JSX to pass new props and render plate highlight**

In the platten group rendering:

```tsx
      <group name="platten">
        {plattenObjs.map(obj => (
          <PlattenPart
            key={obj.id}
            obj={obj}
            catOverrides={state.catOverrides}
            onSelect={onSelectModule}
            partColors={state.partColors}
            onSelectPlate={onSelectPlate}
            interactionMode={interactionMode}
          />
        ))}
      </group>
```

Add plate highlight next to module highlight:

```tsx
      {selectedCell && interactionMode === 'module' && (
        <SelectionHighlight objects={objects} row={selectedCell.row} col={selectedCell.col} />
      )}
      {selectedPlateId && interactionMode === 'color' && (
        <PlateHighlight objects={objects} plateId={selectedPlateId} />
      )}
```

Update `onPointerMissed` to handle both modes:

```tsx
      onPointerMissed={() => {
        if (interactionMode === 'color' && onSelectPlate) onSelectPlate('', '');
        else if (onSelectModule) onSelectModule(-1, -1);
      }}
```

- [ ] **Step 5: Run tsc to verify**

Run: `npx tsc --noEmit`
Expected: 0 errors (ConfiguratorShell doesn't pass the new props yet — they're optional)

- [ ] **Step 6: Commit**

```bash
git add src/features/preview3d/Preview3D.tsx
git commit -m "3D: Platten-Einzelselektion (Farbmodus) + PlateHighlight"
```

---

### Task 7: Update ConfiguratorShell — mode toggle + single plate color picker

**Files:**
- Modify: `src/features/configurator/ConfiguratorShell.tsx`

- [ ] **Step 1: Add interaction mode state and plate selection state**

In ConfiguratorShell, add state variables (near the existing selectedCell state):

```typescript
  const [interactionMode, setInteractionMode] = useState<'module' | 'color'>('module');
  const [selectedPlateId, setSelectedPlateId] = useState<string | null>(null);
  const [selectedPlateType, setSelectedPlateType] = useState<string | null>(null);
```

Add plate selection handler:

```typescript
  const handleSelectPlate = useCallback((plateId: string, partType: string) => {
    if (!plateId) {
      setSelectedPlateId(null);
      setSelectedPlateType(null);
    } else {
      setSelectedPlateId(plateId);
      setSelectedPlateType(partType);
    }
  }, []);
```

- [ ] **Step 2: Add mode toggle button above 3D canvas**

Find the 3D view container (the div wrapping Preview3D) and add a toggle:

```tsx
{view === '3d' && (
  <div style={{ display: 'flex', gap: 8, padding: '4px 8px' }}>
    <button
      onClick={() => { setInteractionMode('module'); setSelectedPlateId(null); }}
      style={{
        padding: '4px 12px', borderRadius: 4, fontSize: 13,
        background: interactionMode === 'module' ? '#4ade80' : '#e5e5e5',
        color: interactionMode === 'module' ? '#000' : '#666',
        border: 'none', cursor: 'pointer',
      }}
    >
      Modul
    </button>
    <button
      onClick={() => { setInteractionMode('color'); if (onSelectModule) onSelectModule(-1, -1); }}
      style={{
        padding: '4px 12px', borderRadius: 4, fontSize: 13,
        background: interactionMode === 'color' ? '#4ade80' : '#e5e5e5',
        color: interactionMode === 'color' ? '#000' : '#666',
        border: 'none', cursor: 'pointer',
      }}
    >
      Farbe
    </button>
  </div>
)}
```

Note: Adapt variable names to match existing code patterns (the `onSelectModule` reference should be the existing selectedCell setter — check ConfiguratorShell for the exact variable name).

- [ ] **Step 3: Pass new props to Preview3D**

```tsx
<Preview3D
  state={state}
  onSelectModule={handleSelectModule}
  selectedCell={selectedCell}
  onSelectPlate={handleSelectPlate}
  selectedPlateId={selectedPlateId}
  interactionMode={interactionMode}
/>
```

- [ ] **Step 4: Replace FÜLLUNG section with single-plate color picker**

Remove the entire FÜLLUNG section (lines ~139-241 in ConfiguratorShell). Replace with:

```tsx
{view === '3d' && interactionMode === 'color' && selectedPlateId && (
  <section style={{ padding: '12px 0' }}>
    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
      {PART_LABELS[selectedPlateType ?? ''] ?? selectedPlateType}
    </h4>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {MATERIALS.filter(m => m.v !== 'none').map(m => {
        const active = state.partColors[selectedPlateId] === m.hex;
        return (
          <button
            key={m.v}
            title={m.l}
            onClick={() => actions.setPartColor(selectedPlateId, m.hex)}
            style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: m.hex, cursor: 'pointer',
              boxShadow: active
                ? '0 0 0 2px #fff, 0 0 0 5.5px #4ade80'
                : '0 0 0 1px rgba(0,0,0,0.15)',
              transform: active ? 'scale(1.15)' : 'scale(1)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          />
        );
      })}
    </div>
    {state.partColors[selectedPlateId] && (
      <button
        onClick={() => actions.clearPartColor(selectedPlateId)}
        style={{
          marginTop: 8, fontSize: 12, color: '#888',
          background: 'none', border: 'none', cursor: 'pointer',
          textDecoration: 'underline',
        }}
      >
        Zurücksetzen
      </button>
    )}
  </section>
)}
```

Add the label map near the top of ConfiguratorShell:

```typescript
const PART_LABELS: Record<string, string> = {
  seite_l: 'Seite links', seite_r: 'Seite rechts',
  boden: 'Boden', deckel: 'Deckel', ruecken: 'Rückwand',
  zwischenboden: 'Zwischenboden', zwischenwand: 'Zwischenwand', front: 'Front',
};
```

- [ ] **Step 5: Run tsc to verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/features/configurator/ConfiguratorShell.tsx
git commit -m "3D: Modus-Toggle (Modul/Farbe) + Einzelplatten-Farbpicker"
```

---

### Task 8: Final verification and cleanup

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Grep for stale references**

```bash
grep -rn "isWoodSurface\|getOrCreateWoodTexture\|woodTextureCache\|GRAIN_SCALE\|WOOD_ROUGHNESS\|generateWoodTexture\|clearModuleColors\|bauteilKey" src/
```

Expected: No matches in production code (may appear in spec/plan docs).

- [ ] **Step 3: Verify texture files are accessible**

```bash
ls -la public/textures/wood/
```

Expected: 9 JPG files, all 50-300KB.

- [ ] **Step 4: Commit if any cleanup was needed**

```bash
git add -A
git commit -m "3D: Cleanup + Verification nach Camera/PBR/Plattenfarben-Änderungen"
```
