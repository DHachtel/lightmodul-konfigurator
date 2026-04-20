# Handle Dimensions, Surface Finishes & Realistic Wood Textures

**Datum:** 2026-04-14
**Quelle:** `D:\33-Preisblatt_Griffe_v10.pdf` + GLB-BBox-Analyse

## Probleme

1. **Griffe:** Alle 14 Griff-Typen werden mit einer einheitlichen Einheitsgröße von `80x12x8 mm` gerendert und erhalten dieselbe Farbe (`#3a3835`) sowie identische Material-Parameter (`roughness: 0.20, metalness: 0.80`). Die realen Proportionen und Oberflächen gehen komplett verloren.

2. **Holztexturen:** Die aktuelle Holzmaserung in `Preview3D.tsx` (Zeilen 138–182) erzeugt nur dunkle Sinus-Linien über dem Grund-Hex-Wert — für alle drei Holzarten identisch. Keine Differenzierung zwischen Zebrano (Parallelstreifen), Nussbaum (fließende Aderung) und Eiche (Faserbündel).

## Lösung

1. **Griffe:** Native GLB-Dimensionen als Zielgröße verwenden. Pro Griff-Typ differenzierte Farbe und PBR-Parameter (roughness, metalness) basierend auf dem Preisblatt-Finish.

2. **Holztexturen:** Neues Modul `useWoodTexture.ts` mit Perlin-Noise-basierter prozeduraler Texturierung pro Holzart. Ersetzt die bestehende generische Canvas-Maserung.

## Ansatz

**Griffe — Ansatz A:** Zentrale `HANDLE_DIMS`-Map in `useModuleGeometry.ts`, die Size + Color + Material pro Handle-Key bündelt. SceneObject trägt alle Daten self-contained — Preview3D liest sie direkt aus.

**Holztexturen:** Eigenständiges Modul mit gecachten CanvasTextures, differenziert nach Holzart via Perlin-Noise + fbm.

## Datengrundlage

### GLB-BBox-Dimensionen (gemessen)

| Handle | GLB X (mm) | GLB Y (mm) | GLB Z (mm) | Preisblatt (B x H) |
|--------|-----------|-----------|-----------|-------------------|
| luno | 40.0 | 12.0 | 40.0 | 40mm (Ø) |
| linea | 107.9 | 27.0 | 11.9 | 108 x 27 |
| rondo | 15.0 | 24.0 | 15.0 | 15 x 24 |
| axio | 42.4 | 20.0 | 9.3 | 43 x 20 |
| axio_gross | 140.7 | 20.0 | 9.3 | 140 x 20 |
| retrox | 80.0 | 19.0 | 50.0 | 75 x 18 |
| reling | 136.0 | 35.0 | 12.0 | 136 x 35 |
| reling_gross | 168.0 | 35.0 | 12.0 | 168 x 35 |
| uno | 104.0 | 25.0 | 9.0 | 104 x 25 |
| ombra | 113.6 | 32.2 | 9.0 | 114 x 32 |
| solano | 118.6 | 29.0 | 18.8 | 118 x 29 |
| arcano | 146.0 | 28.0 | 14.0 | 146 x 28 |
| bridge | 132.0 | 25.0 | 8.5 | 132 x 25 |
| bridge_gross | 132.0 | 25.0 | 8.5 | 164 x 25 |

**Bekannte GLB-Probleme:**
- `bridge_gross.glb` ist eine Kopie von `bridge_klein.glb` (132mm statt 164mm). SmartMesh skaliert auf 164mm via size-Param.
- `retrox.glb` weicht vom Preisblatt ab (80x19x50 vs. 75x18). GLB-Werte beibehalten.

### Oberflächen-Finishes (aus Preisblatt)

| Finish | Griffe | Color (sRGB) | Roughness | Metalness |
|--------|--------|-------------|-----------|-----------|
| Verchromt/poliert | luno, linea, rondo, axio, axio_gross, reling, reling_gross, uno, arcano, bridge, bridge_gross, allungo | `#D4D7DC` | 0.08 | 0.95 |
| Vernickelt/poliert | retrox | `#C8C0B8` | 0.12 | 0.90 |
| Schwarz matt | ombra | `#1A1A1A` | 0.65 | 0.15 |
| Goldfarben gebürstet | solano | `#C9A84C` | 0.35 | 0.80 |

## Betroffene Dateien

### 1. `src/features/preview3d/useModuleGeometry.ts`

**Neue Konstante:** `HANDLE_DIMS` — Record<string, { size, color, roughness, metalness }>

**Griff-Erzeugung anpassen:**
- `HANDLE_DIMS[state.handle]` nachschlagen (Fallback auf bisherige Werte)
- Horizontale Griffe (K, S): `size` direkt verwenden
- Vertikale Griffe (TR, TL, DT): X und Y tauschen: `[size[1], size[0], size[2]]`
- `color`, `roughness`, `metalness` aus Map in SceneObject übernehmen

**Positionierung anpassen:**
- Klappe (K): Y = `frontYTop - size[1]/2` (halbe Griffhöhe vom oberen Rand)
- Tür rechts (TR): X = `xLeft + plateW - size[1]/2` (nach Rotation: Y-Dim wird horizontal)
- Tür links (TL): X = `xLeft + size[1]/2`
- Doppeltür (DT): Abstand basiert auf Griffbreite nach Rotation

**Entfernen:** `HANDLE_COLOR` Konstante

### 2. SceneObject-Interface (in useModuleGeometry.ts oder types.ts)

Zwei optionale Felder hinzufügen:
```typescript
roughness?: number;
metalness?: number;
```

### 3. `src/features/preview3d/Preview3D.tsx`

**Handle-Rendering:**
- `obj.roughness` / `obj.metalness` aus SceneObject lesen statt hardcoded
- `obj.color` direkt verwenden (kommt jetzt differenziert aus HANDLE_DIMS)
- `HANDLE_HEX` / `HANDLE_COLOR_LINEAR` Konstanten entfernen

```tsx
<SmartMesh
  roughness={obj.roughness ?? 0.20}
  metalness={obj.metalness ?? 0.80}
  color={obj.color}
  ...
/>
```

---

## Teil 2: Realistische Holztexturen

### Ist-Zustand

`Preview3D.tsx` enthält inline (Zeilen 131–182):
- `isWoodSurface(hex)` — prüft `textured`-Flag aus MATERIALS
- `getOrCreateWoodTexture(hex)` — generiert 256x256 Canvas mit 10 Sinus-Linien über Grund-Hex
- `woodTextureCache` — Map<string, CanvasTexture>, max 3 Einträge
- `PlattenPart` nutzt `woodMap` mit `GRAIN_SCALE = 2.5` und `repeat.set(...)` pro Platte
- Roughness Holz: pauschal 0.88, Metalness: 0.0

Hex-Zuordnung in `constants.ts`:
- `ZEB` (Zebrano): `#c8a860`
- `NUS` (Nussbaum): `#6a3820`
- `EIC` (Eiche): `#c09060`

### Neues Modul: `src/features/preview3d/useWoodTexture.ts`

**Exports:**

```typescript
// 1. Canvas-Generator pro Holzart
function generateWoodTexture(
  type: 'zebrano' | 'nussbaum' | 'eiche',
  size?: number, // default 512
): HTMLCanvasElement;

// 2. Gecachte THREE.CanvasTexture (oder null wenn kein Holz)
function getWoodTexture(type: string): THREE.CanvasTexture | null;
```

**Perlin-Noise Infrastruktur (modulintern):**
- 256er Permutationsarray (statisch, deterministisch)
- `fade(t)`, `lerp(a, b, t)`, `grad(hash, x, y)` Hilfsfunktionen
- `perlin2d(x, y)` → Wert im Bereich [-1, 1]
- `fbm(x, y, octaves)` — Fraktale Brownsche Bewegung, 4–5 Oktaven

**Holzart-spezifische Generierung:**

| Holzart | Technik | Farben (RGB) | Parameter |
|---------|---------|-------------|-----------|
| **Zebrano** | Diagonale Parallelstreifen, axis = `nx*0.85 + ny*0.15`, 13 Streifen, smoothstep-Übergänge, minimaler fbm-Warp | Cream `[218,190,130]` ↔ Braun `[142,100,48]` | 13 Streifen, fbm-Warp minimal |
| **Nussbaum** | Fließende organische Aderung via fbm-Warp (`wX = fbm(nx*2, ny*0.5, 4) * 0.07`), Venen-Muster | Schokolade `[48,20,12]` ↔ Mittelbraun `[148,82,48]` | fbm 4 Oktaven, starker Warp |
| **Eiche** | Feine vertikale Faserbündel (`fineFreq=36, fineAmp=0.28`), Bündel-Gruppen (`bundleFreq=11`), gelegentliche dunklere Jahresringe | Goldgelb `[165,128,50]` ↔ Hellgold `[210,172,88]` | fineFreq=36, bundleFreq=11 |

**Canvas-Größe:** 512x512 (default), doppelt so groß wie bisherige 256x256.

**Textur-Properties:**
- `wrapS` / `wrapT` = `RepeatWrapping`
- `repeat.set(1, 2)` — vertikale Streckung für natürlichere Maserungsrichtung
- `colorSpace` = `SRGBColorSpace`

**Cache:** `Map<string, THREE.CanvasTexture>`, gibt `null` zurück wenn `type` kein Holz ist.

### Änderungen in `Preview3D.tsx`

**Entfernen (inline-Holzlogik):**
- `isWoodSurface()` Funktion (Zeile 134–136)
- `woodTextureCache` Map (Zeile 142)
- `getOrCreateWoodTexture()` Funktion (Zeilen 144–182)

**Importieren:**
```typescript
import { getWoodTexture } from './useWoodTexture';
```

**PlattenPart anpassen:**

Holz-Erkennung: Statt `isWoodSurface(hex)` → Holzart aus MATERIALS-Value ableiten.

Mapping: `surface`-Wert → Holzart:
- `ZEB` → `'zebrano'`
- `NUS` → `'nussbaum'`
- `EIC` → `'eiche'`

```typescript
// Holzart aus dem effektiven Material-Hex ableiten
const woodType = useMemo(() => {
  const mat = MATERIALS.find(m => m.textured && m.hex === effectiveHex);
  if (!mat) return null;
  if (mat.v === 'ZEB') return 'zebrano';
  if (mat.v === 'NUS') return 'nussbaum';
  if (mat.v === 'EIC') return 'eiche';
  return null;
}, [effectiveHex]);

const woodMap = useMemo(() => {
  if (!woodType) return null;
  return getWoodTexture(woodType);
}, [woodType]);
```

**Roughness pro Holzart:**
- Zebrano: 0.25 (glatter Lack-Furnier)
- Nussbaum: 0.45 (seidenmatt)
- Eiche: 0.65 (offenporig, natürlich)
- Metalness: 0 für alle

Statt pauschaler `roughness = isWood ? 0.88 : ...`:
```typescript
const WOOD_ROUGHNESS: Record<string, number> = {
  zebrano: 0.25, nussbaum: 0.45, eiche: 0.65,
};
const roughness = woodType ? (WOOD_ROUGHNESS[woodType] ?? 0.88) : PLATTEN_MAT.roughness;
```

**Repeat-Logik:**
Die bisherige `GRAIN_SCALE`-basierte Repeat-Berechnung pro Platte entfällt — `getWoodTexture()` liefert die Textur bereits mit `repeat.set(1, 2)`. Falls die Plattengröße die Repeat-Werte beeinflussen soll, kann das in einer Folge-Iteration ergänzt werden.

---

## Nicht im Scope

- Kein neues GLB für bridge_gross (SmartMesh non-uniform-scale reicht)
- Keine Änderung an SmartMesh.tsx selbst
- Keine Änderung an BOM/Pricing-Logik
- Kein Push-to-open Griff (unsichtbar, kein Rendering nötig)
- Keine plattenseitenspezifische UV-Variation (alle Seiten einer Platte gleiche Textur)
