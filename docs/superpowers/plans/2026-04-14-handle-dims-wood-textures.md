# Handle Dimensions, Surface Finishes & Realistic Wood Textures — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace uniform 80x12x8mm handle sizes with real GLB dimensions per handle type, add per-handle surface finishes (chrome/nickel/matte black/gold), and replace the generic sin-wave wood texture with Perlin-noise-based procedural textures for Zebrano, Nussbaum, and Eiche.

**Architecture:** Two independent changes to the 3D preview system. (1) A `HANDLE_DIMS` lookup map in `useModuleGeometry.ts` provides per-handle size + color + roughness + metalness, extending the `SceneObject` interface with optional `roughness`/`metalness` fields. Preview3D reads these from the object instead of using hardcoded values. (2) A new `useWoodTexture.ts` module with Perlin-noise-based procedural canvas textures replaces the inline sin-wave generator in Preview3D.

**Tech Stack:** TypeScript, Three.js (MeshStandardMaterial, CanvasTexture), React Three Fiber

**Spec:** `docs/superpowers/specs/2026-04-14-handle-dimensions-and-finishes-design.md`

---

### Task 1: Extend SceneObject interface + add HANDLE_DIMS map

**Files:**
- Modify: `src/features/preview3d/useModuleGeometry.ts:6-23` (SceneObject interface)
- Modify: `src/features/preview3d/useModuleGeometry.ts:30` (replace HANDLE_COLOR)

- [ ] **Step 1: Add roughness/metalness to SceneObject interface**

In `src/features/preview3d/useModuleGeometry.ts`, add two optional fields after line 22:

```typescript
export interface SceneObject {
  id: string;
  partType:
    | 'seite_l' | 'seite_r' | 'boden' | 'deckel' | 'ruecken'
    | 'zwischenboden' | 'zwischenwand'
    | 'front' | 'handle' | 'profil'
    | 'eckverbinder' | 'stellfuss' | 'rolle';
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  catKey?: string;
  row?: number;
  col?: number;
  partColorKey?: string;
  glbFile?: string;
  preRotation?: [number, number, number];
  nonUniformScale?: boolean;
  roughness?: number;   // NEW — PBR roughness (0..1), optional
  metalness?: number;   // NEW — PBR metalness (0..1), optional
}
```

- [ ] **Step 2: Replace HANDLE_COLOR with HANDLE_DIMS map**

Replace line 30 (`const HANDLE_COLOR = '#3a3835';`) with the full `HANDLE_DIMS` map. All dimensions are in mm (from GLB BBox analysis). Colors and PBR values per finish type from the Preisblatt.

```typescript
/** Reale Griffmaße (aus GLB BBox) + Oberflächen-Finish (aus Preisblatt) */
const HANDLE_DIMS: Record<string, {
  size: [number, number, number]; // [X, Y, Z] in mm — horizontal orientation
  color: string;                  // sRGB hex
  roughness: number;
  metalness: number;
}> = {
  // Verchromt/poliert
  luno:         { size: [40, 12, 40],      color: '#D4D7DC', roughness: 0.08, metalness: 0.95 },
  linea:        { size: [108, 27, 12],     color: '#D4D7DC', roughness: 0.08, metalness: 0.95 },
  rondo:        { size: [15, 24, 15],      color: '#D4D7DC', roughness: 0.08, metalness: 0.95 },
  axio:         { size: [42, 20, 9],       color: '#D4D7DC', roughness: 0.08, metalness: 0.95 },
  axio_gross:   { size: [141, 20, 9],      color: '#D4D7DC', roughness: 0.08, metalness: 0.95 },
  reling:       { size: [136, 35, 12],     color: '#D4D7DC', roughness: 0.08, metalness: 0.95 },
  reling_gross: { size: [168, 35, 12],     color: '#D4D7DC', roughness: 0.08, metalness: 0.95 },
  uno:          { size: [104, 25, 9],      color: '#D4D7DC', roughness: 0.08, metalness: 0.95 },
  arcano:       { size: [146, 28, 14],     color: '#D4D7DC', roughness: 0.08, metalness: 0.95 },
  bridge:       { size: [132, 25, 9],      color: '#D4D7DC', roughness: 0.08, metalness: 0.95 },
  bridge_gross: { size: [164, 25, 9],      color: '#D4D7DC', roughness: 0.08, metalness: 0.95 },
  allungo:      { size: [250, 25, 9],      color: '#D4D7DC', roughness: 0.08, metalness: 0.95 },
  // Vernickelt/poliert
  retrox:       { size: [80, 19, 50],      color: '#C8C0B8', roughness: 0.12, metalness: 0.90 },
  // Schwarz matt
  ombra:        { size: [114, 32, 9],      color: '#1A1A1A', roughness: 0.65, metalness: 0.15 },
  // Goldfarben gebürstet
  solano:       { size: [119, 29, 19],     color: '#C9A84C', roughness: 0.35, metalness: 0.80 },
};

// Fallback für unbekannte Griffe (bisherige Einheitsgröße)
const HANDLE_FALLBACK = { size: [80, 12, 8] as [number, number, number], color: '#707070', roughness: 0.20, metalness: 0.80 };
```

- [ ] **Step 3: Run tsc to verify interface change compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors (new fields are optional, no existing code breaks)

- [ ] **Step 4: Commit**

```bash
git add src/features/preview3d/useModuleGeometry.ts
git commit -m "3D: HANDLE_DIMS Map + SceneObject roughness/metalness"
```

---

### Task 2: Update handle geometry generation to use real dimensions

**Files:**
- Modify: `src/features/preview3d/useModuleGeometry.ts:224-287` (handle generation in the Fronten & Griffe loop)

- [ ] **Step 1: Replace the handle generation block**

Replace lines 224–287 (the entire handle section inside the front loop, starting at `// Griff je Fronttyp` through end of the `DT` else-if) with:

```typescript
        // Griff je Fronttyp — reale Maße aus HANDLE_DIMS
        if (state.handle && state.handle !== 'none' && state.handle !== 'push') {
          const handleGlb = HANDLE_GLB_MAP[state.handle];
          const dims = HANDLE_DIMS[state.handle] ?? HANDLE_FALLBACK;
          const [hW, hH, hD] = dims.size; // horizontal: Breite, Höhe, Tiefe (mm)
          const hRotH: [number, number, number] = [-Math.PI / 2, 0, 0];           // horizontal
          const hRotV: [number, number, number] = [-Math.PI / 2, 0, Math.PI / 2]; // vertikal

          if (typ === 'K') {
            // Klappe: horizontaler Griff oben (halbe Griffhöhe vom oberen Rand)
            objs.push({
              id: `handle_r${r}_c${c}`, partType: 'handle',
              position: [xCtr * s, (frontYTop - hH / 2) * s, handleZ * s],
              size: [hW * s, hH * s, hD * s],
              color: dims.color, roughness: dims.roughness, metalness: dims.metalness,
              row: r, col: c, glbFile: handleGlb, preRotation: hRotH,
            });
          } else if (typ === 'S') {
            // Schublade: horizontaler Griff in der Mitte
            objs.push({
              id: `handle_r${r}_c${c}`, partType: 'handle',
              position: [xCtr * s, yCtr * s, handleZ * s],
              size: [hW * s, hH * s, hD * s],
              color: dims.color, roughness: dims.roughness, metalness: dims.metalness,
              row: r, col: c, glbFile: handleGlb, preRotation: hRotH,
            });
          } else if (typ === 'TR') {
            // Tuer rechts: vertikaler Griff rechts (halbe Griffbreite vom Rand)
            objs.push({
              id: `handle_r${r}_c${c}`, partType: 'handle',
              position: [(xLeft + plateW - hH / 2) * s, yCtr * s, handleZ * s],
              size: [hH * s, hW * s, hD * s],
              color: dims.color, roughness: dims.roughness, metalness: dims.metalness,
              row: r, col: c, glbFile: handleGlb, preRotation: hRotV,
            });
          } else if (typ === 'TL') {
            // Tuer links: vertikaler Griff links (halbe Griffbreite vom Rand)
            objs.push({
              id: `handle_r${r}_c${c}`, partType: 'handle',
              position: [(xLeft + hH / 2) * s, yCtr * s, handleZ * s],
              size: [hH * s, hW * s, hD * s],
              color: dims.color, roughness: dims.roughness, metalness: dims.metalness,
              row: r, col: c, glbFile: handleGlb, preRotation: hRotV,
            });
          } else if (typ === 'DT') {
            // Doppeltuer: zwei vertikale Griffe (±Abstand vom Zentrum)
            const dtGap = hH / 2 + 10; // halbe Griffbreite + 10mm Luft zur Mitte
            objs.push({
              id: `handle_r${r}_c${c}_l`, partType: 'handle',
              position: [(xCtr - dtGap) * s, yCtr * s, handleZ * s],
              size: [hH * s, hW * s, hD * s],
              color: dims.color, roughness: dims.roughness, metalness: dims.metalness,
              row: r, col: c, glbFile: handleGlb, preRotation: hRotV,
            });
            objs.push({
              id: `handle_r${r}_c${c}_r`, partType: 'handle',
              position: [(xCtr + dtGap) * s, yCtr * s, handleZ * s],
              size: [hH * s, hW * s, hD * s],
              color: dims.color, roughness: dims.roughness, metalness: dims.metalness,
              row: r, col: c, glbFile: handleGlb, preRotation: hRotV,
            });
          }
        }
```

Key changes vs. old code:
- Sizes come from `HANDLE_DIMS[state.handle]` instead of hardcoded `80/12/8`
- Vertical handles swap X↔Y: `[hH, hW, hD]` instead of `[hW, hH, hD]`
- Position offsets use real dimensions (`hH/2` instead of `35`)
- Color, roughness, metalness from dims map
- Skips if handle is `none` or `push`
- DT gap based on actual handle width

- [ ] **Step 2: Run tsc to verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/useModuleGeometry.ts
git commit -m "3D: Griffe mit realen GLB-Dimensionen + Positionierung"
```

---

### Task 3: Update Preview3D handle rendering to use per-object material

**Files:**
- Modify: `src/features/preview3d/Preview3D.tsx:124-129` (remove old handle constants)
- Modify: `src/features/preview3d/Preview3D.tsx:200-227` (HandlePart component)
- Modify: `src/features/preview3d/Preview3D.tsx:448-468` (handle SmartMesh rendering)

- [ ] **Step 1: Remove old handle constants**

Delete these lines (124–129):

```typescript
const HANDLE_MAT  = { roughness: 0.20, metalness: 0.80, envMapIntensity: 0.9 };
const HANDLE_HEX  = '#707070';

// Profilfarbe: Alu-Silber, einmal berechnet (sRGB→Linear)
const PROFIL_COLOR = /* @__PURE__ */ new THREE.Color('#b8bec4').convertSRGBToLinear();
const HANDLE_COLOR_LINEAR = /* @__PURE__ */ new THREE.Color(HANDLE_HEX).convertSRGBToLinear();
```

Replace with just the PROFIL_COLOR (still needed):

```typescript
// Profilfarbe: Alu-Silber, einmal berechnet (sRGB→Linear)
const PROFIL_COLOR = /* @__PURE__ */ new THREE.Color('#b8bec4').convertSRGBToLinear();
```

- [ ] **Step 2: Delete the HandlePart component**

Delete the entire `HandlePart` component (lines 200–227). It's no longer used — handles are now rendered via SmartMesh which reads color/roughness/metalness from the SceneObject.

- [ ] **Step 3: Update handle SmartMesh rendering to use obj properties**

In the handle rendering section (around line 448–468), update the SmartMesh to read material from the object:

```tsx
      {/* Griffe: SmartMesh mit realen Maßen + differenziertem Finish */}
      <Suspense fallback={null}>
        <group name="handles">
          {handleObjs.map(obj => (
            <SmartMesh
              key={obj.id}
              glbPath={obj.glbFile}
              position={obj.position}
              size={obj.size}
              color={obj.color}
              roughness={obj.roughness ?? 0.20}
              metalness={obj.metalness ?? 0.80}
              envMapIntensity={0.9}
              preRotation={obj.preRotation}
              onClick={obj.row != null && obj.col != null && onSelectModule
                ? (e) => { e.stopPropagation(); onSelectModule(obj.row!, obj.col!); }
                : undefined}
            />
          ))}
        </group>
      </Suspense>
```

- [ ] **Step 4: Run tsc to verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/features/preview3d/Preview3D.tsx
git commit -m "3D: Griff-Rendering mit differenzierten Oberflächen"
```

---

### Task 4: Create useWoodTexture.ts with Perlin-noise procedural textures

**Files:**
- Create: `src/features/preview3d/useWoodTexture.ts`

- [ ] **Step 1: Create the complete useWoodTexture module**

Create `src/features/preview3d/useWoodTexture.ts`:

```typescript
/**
 * Prozedurale Holztexturen mit Perlin-Noise.
 * Erzeugt für Zebrano, Nussbaum und Eiche jeweils eine 512x512 CanvasTexture.
 * Gecacht: wird nur einmal pro Holzart generiert.
 */
import * as THREE from 'three';

// ── Perlin-Noise Infrastruktur ────────────────────────────────────────────────

// Deterministisches 256er Permutationsarray (Standard-Referenzimplementierung)
const P = new Uint8Array(512);
{
  const perm = [
    151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,
    142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,
    203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,
    74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,
    220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,
    132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,
    186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,
    59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,
    70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,
    178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,
    241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,
    176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,
    128,195,78,66,215,61,156,180,
  ];
  for (let i = 0; i < 256; i++) P[i] = P[i + 256] = perm[i];
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function perlin2d(x: number, y: number): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = P[P[xi] + yi];
  const ab = P[P[xi] + yi + 1];
  const ba = P[P[xi + 1] + yi];
  const bb = P[P[xi + 1] + yi + 1];
  return lerp(
    lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
    lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
    v,
  );
}

function fbm(x: number, y: number, octaves: number): number {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * perlin2d(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return val;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function lerpColor(
  c0: [number, number, number],
  c1: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * t),
    Math.round(c0[1] + (c1[1] - c0[1]) * t),
    Math.round(c0[2] + (c1[2] - c0[2]) * t),
  ];
}

// ── Holzart-spezifische Generatoren ───────────────────────────────────────────

type WoodType = 'zebrano' | 'nussbaum' | 'eiche';

function generateZebrano(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const cream: [number, number, number] = [218, 190, 130];
  const brown: [number, number, number] = [142, 100, 48];
  const stripes = 13;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      // Diagonale Achse mit minimalem fbm-Warp
      const warp = fbm(nx * 4, ny * 4, 3) * 0.03;
      const axis = (nx * 0.85 + ny * 0.15) + warp;
      // Streifenmuster mit smoothstep-Übergängen
      const stripe = (axis * stripes) % 1.0;
      const t = smoothstep(0.35, 0.5, stripe) - smoothstep(0.5, 0.65, stripe);
      const [r, g, b] = lerpColor(cream, brown, t);
      const idx = (y * size + x) * 4;
      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function generateNussbaum(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const dark: [number, number, number] = [48, 20, 12];
  const mid: [number, number, number] = [148, 82, 48];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      // Fließende organische Aderung via fbm-Warp
      const wX = fbm(nx * 2, ny * 0.5, 4) * 0.07;
      const wY = fbm(nx * 0.5 + 5.3, ny * 2, 4) * 0.04;
      const warped = perlin2d((nx + wX) * 6, (ny + wY) * 3);
      // Venen-Muster: schärfere Adern über smoothstep
      const vein = smoothstep(-0.1, 0.1, warped);
      const base = fbm(nx * 3 + 1.7, ny * 1.5 + 2.3, 5) * 0.5 + 0.5;
      const t = base * 0.6 + vein * 0.4;
      const [r, g, b] = lerpColor(dark, mid, Math.max(0, Math.min(1, t)));
      const idx = (y * size + x) * 4;
      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function generateEiche(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  const dark: [number, number, number] = [165, 128, 50];
  const light: [number, number, number] = [210, 172, 88];
  const fineFreq = 36;
  const fineAmp = 0.28;
  const bundleFreq = 11;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x / size;
      const ny = y / size;
      // Feine vertikale Faserbündel
      const fine = Math.sin(nx * fineFreq * Math.PI * 2 + perlin2d(nx * 8, ny * 2) * 2) * fineAmp;
      // Faserbündel-Gruppen
      const bundle = Math.sin(nx * bundleFreq * Math.PI * 2 + perlin2d(nx * 3, ny * 0.8) * 1.5) * 0.2;
      // Gelegentliche dunklere Jahresringe (horizontale Bänder)
      const ring = smoothstep(0.6, 0.8, Math.sin(ny * 5 * Math.PI + fbm(nx * 2, ny * 2, 3) * 3)) * 0.15;
      // Kombinieren
      const t = 0.5 + fine + bundle - ring + fbm(nx * 4, ny * 4, 4) * 0.1;
      const clamped = Math.max(0, Math.min(1, t));
      const [r, g, b] = lerpColor(dark, light, clamped);
      const idx = (y * size + x) * 4;
      data[idx] = r; data[idx + 1] = g; data[idx + 2] = b; data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

// ── Public API ────────────────────────────────────────────────────────────────

const GENERATORS: Record<WoodType, (size: number) => HTMLCanvasElement> = {
  zebrano: generateZebrano,
  nussbaum: generateNussbaum,
  eiche: generateEiche,
};

/**
 * Erzeugt ein HTMLCanvasElement mit der prozeduralen Holztextur.
 * Kann direkt als CanvasTexture-Source genutzt werden.
 */
export function generateWoodTexture(
  type: WoodType,
  size = 512,
): HTMLCanvasElement {
  return GENERATORS[type](size);
}

/** Cache: eine CanvasTexture pro Holzart */
const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Liefert eine gecachte THREE.CanvasTexture für die gegebene Holzart.
 * Gibt null zurück wenn `type` kein bekannter Holztyp ist.
 */
export function getWoodTexture(type: string): THREE.CanvasTexture | null {
  if (!(type in GENERATORS)) return null;

  const cached = textureCache.get(type);
  if (cached) return cached;

  const canvas = generateWoodTexture(type as WoodType);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  textureCache.set(type, texture);
  return texture;
}
```

- [ ] **Step 2: Run tsc to verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/preview3d/useWoodTexture.ts
git commit -m "3D: Perlin-Noise Holztexturen (Zebrano, Nussbaum, Eiche)"
```

---

### Task 5: Replace inline wood texture code in Preview3D with useWoodTexture

**Files:**
- Modify: `src/features/preview3d/Preview3D.tsx:131-182` (remove inline wood code)
- Modify: `src/features/preview3d/Preview3D.tsx:229-312` (PlattenPart component)

- [ ] **Step 1: Add import for getWoodTexture**

Add import at top of `Preview3D.tsx` (after the SmartMesh import, around line 12):

```typescript
import { getWoodTexture } from './useWoodTexture';
```

- [ ] **Step 2: Remove inline wood texture functions**

Delete the entire block from line 131 to 182:
- `isWoodSurface()` function (lines 131–136)
- `woodTextureCache` Map (line 142)
- `getOrCreateWoodTexture()` function (lines 144–182)

- [ ] **Step 3: Update PlattenPart to use woodType-based detection**

Replace the wood-related logic inside `PlattenPart` (lines ~262–291 in the current file). The component currently has:
- `isWood` detection via `isWoodSurface(effectiveHex)`
- `effectiveColor` white for wood, linear-converted for lacquer
- `woodMap` using `getOrCreateWoodTexture(effectiveHex)` with GRAIN_SCALE repeat
- `roughness`/`metalness`/`envMapIntensity` toggles

Replace with:

```typescript
  // Holzart aus dem effektiven Hex ableiten (ZEB/NUS/EIC → Holzart)
  const woodType = useMemo(() => {
    const mat = MATERIALS.find(m => m.textured && m.hex === effectiveHex);
    if (!mat) return null;
    if (mat.v === 'ZEB') return 'zebrano';
    if (mat.v === 'NUS') return 'nussbaum';
    if (mat.v === 'EIC') return 'eiche';
    return null;
  }, [effectiveHex]);

  // Farbe: Holz → weiß (Textur trägt die Farbe), Lack → sRGB→Linear
  const effectiveColor = useMemo(() => {
    if (woodType) return '#ffffff';
    return new THREE.Color(effectiveHex).convertSRGBToLinear();
  }, [effectiveHex, woodType]);

  // Prozedurale Holztextur aus useWoodTexture (gecacht)
  const woodMap = useMemo(() => {
    if (!woodType) return null;
    return getWoodTexture(woodType);
  }, [woodType]);

  // Materialwerte: pro Holzart differenziert, Lack unverändert
  const WOOD_ROUGHNESS: Record<string, number> = {
    zebrano: 0.25, nussbaum: 0.45, eiche: 0.65,
  };
  const roughness       = woodType ? (WOOD_ROUGHNESS[woodType] ?? 0.88) : PLATTEN_MAT.roughness;
  const metalness       = woodType ? 0.0 : PLATTEN_MAT.metalness;
  const envMapIntensity = woodType ? 0.3 : PLATTEN_MAT.envMapIntensity;
```

Note: The `WOOD_ROUGHNESS` map can stay inside the component — it's a tiny constant. Moving it to module scope is optional.

- [ ] **Step 4: Run tsc to verify**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/features/preview3d/Preview3D.tsx
git commit -m "3D: Inline-Holzmaserung durch useWoodTexture ersetzt"
```

---

### Task 6: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run ESLint**

Run: `npx eslint src/features/preview3d/useModuleGeometry.ts src/features/preview3d/Preview3D.tsx src/features/preview3d/useWoodTexture.ts`
Expected: No errors (warnings acceptable)

- [ ] **Step 3: Verify no stale references**

Grep for removed constants to confirm clean removal:

```bash
grep -rn "HANDLE_COLOR\|HANDLE_HEX\|HANDLE_MAT\|HANDLE_COLOR_LINEAR\|isWoodSurface\|getOrCreateWoodTexture\|woodTextureCache\|GRAIN_SCALE" src/features/preview3d/
```

Expected: No matches (all old references removed)

- [ ] **Step 4: Commit summary**

```bash
git add -A
git commit -m "3D: Griff-Dimensionen + Oberflächen + Holztexturen — Cleanup + Verification"
```
