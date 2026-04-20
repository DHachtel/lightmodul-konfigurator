# Camera Fix, PBR Wood Textures & Plate Color Selection

**Datum:** 2026-04-14

## Probleme

1. **Kamera-Zoom-Bug:** Bei jeder Seitenleisten-Änderung (Oberfläche, Griff, Footer) zoomt die 3D-Kamera ins Profilkreuz. Ursache: `getActiveBounds` useMemo wird durch `state.grid`-Referenzänderung invalidiert, obwohl sich der Grid-Inhalt nicht ändert.

2. **Holztexturen:** Die prozeduralen Perlin-Noise-Texturen (`useWoodTexture.ts`) sehen unrealistisch aus (Camouflage-Muster statt Holz). Echte PBR-Textursets liegen vor.

3. **Platten-Farbauswahl:** Die "FÜLLUNG"-Sektion zeigt 6 × 15 = 90 Farbkreise. Stattdessen soll eine Platte in 3D angeklickt und über einen einzigen Farbpicker eingefärbt werden.

## Fix 1: Kamera-Zoom-Bug

**Ursache:** `useConfigStore.update()` erzeugt mit `{ ...s }` ein neues State-Objekt. `state.grid` ist damit bei jeder Config-Änderung eine neue Array-Referenz — auch wenn sich der Grid-Inhalt nicht geändert hat. Das useMemo in Preview3D (`[state.grid, state.cols, state.rows]`) invalidiert, `getActiveBounds` wird neu berechnet (mit identischem Ergebnis), und `CameraAutoFrame.fitToBox` feuert.

**Fix:** Stabile Dependency für `getActiveBounds` useMemo. Einen String-Hash aus den Grid-Typen ableiten:

```typescript
const gridHash = useMemo(
  () => state.grid.map(row => row.map(c => c.type).join(',')).join('|'),
  [state.grid],
);
```

Dann `getActiveBounds` mit `[gridHash, state.cols, state.rows]` als Dependency statt `[state.grid, ...]`. Da `state.cols` und `state.rows` nur bei tatsächlichen Größenänderungen neue Arrays sind, feuert `fitToBox` nur noch bei echten Strukturänderungen.

**Betroffene Datei:** `src/features/preview3d/Preview3D.tsx` — `getActiveBounds` useMemo (Zeile ~246-249)

## Fix 2: Echte PBR-Holztexturen

### Textur-Pipeline

Quelle: `Holzoberflächen/` im Projektstamm (2K-JPG PBR-Sets von ambientCG o.ä.)

| Holzart | Quellverzeichnis | Color | NormalGL | Roughness |
|---------|-----------------|-------|----------|-----------|
| Zebrano | `Holzoberflächen/Zebrano/` | `Wood014_2K-JPG_Color.jpg` | `Wood014_2K-JPG_NormalGL.jpg` | `Wood014_2K-JPG_Roughness.jpg` |
| Nussbaum | `Holzoberflächen/Nussbaum/` | `Wood067_2K-JPG_Color.jpg` | `Wood067_2K-JPG_NormalGL.jpg` | `Wood067_2K-JPG_Roughness.jpg` |
| Eiche | `Holzoberflächen/Eiche/` | `Wood049_2K-JPG_Color.jpg` | `Wood049_2K-JPG_NormalGL.jpg` | `Wood049_2K-JPG_Roughness.jpg` |

**Konvertierung:** 2K → 1024x1024, JPG Qualität 85%. Displacement-Maps werden nicht verwendet (flache Möbelplatten).

**Zielstruktur:**
```
public/textures/wood/
  zebrano_color.jpg       (~80-120KB)
  zebrano_normal.jpg      (~150-200KB)
  zebrano_roughness.jpg   (~60-100KB)
  nussbaum_color.jpg
  nussbaum_normal.jpg
  nussbaum_roughness.jpg
  eiche_color.jpg
  eiche_normal.jpg
  eiche_roughness.jpg
```

### useWoodTexture.ts — Komplett umschreiben

Statt prozeduraler Canvas-Generierung: Statische JPGs per `THREE.TextureLoader` laden und cachen.

**Neues Interface:**
```typescript
interface WoodTextureMaps {
  colorMap: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

function getWoodTexture(type: string): WoodTextureMaps | null;
```

- Gibt `null` zurück wenn `type` kein bekannter Holztyp ist
- Cache: `Map<string, WoodTextureMaps>`
- Alle Texturen: `wrapS/wrapT = RepeatWrapping`, `repeat.set(1, 2)`, `colorSpace = SRGBColorSpace` (nur Color-Map, Normal/Roughness bleiben linear)
- `generateWoodTexture()` Export entfällt komplett (kein Canvas mehr)

### Preview3D PlattenPart — Anpassung

```typescript
// Statt:
const woodMap = useMemo(() => {
  if (!woodType) return null;
  return getWoodTexture(woodType);
}, [woodType]);

// Wird:
const woodMaps = useMemo(() => {
  if (!woodType) return null;
  return getWoodTexture(woodType); // { colorMap, normalMap, roughnessMap }
}, [woodType]);
```

Material:
```tsx
<meshStandardMaterial
  color={effectiveColor}
  roughness={woodMaps ? 1.0 : PLATTEN_MAT.roughness}
  metalness={0.0}
  envMapIntensity={woodMaps ? 0.3 : PLATTEN_MAT.envMapIntensity}
  map={woodMaps?.colorMap}
  normalMap={woodMaps?.normalMap}
  roughnessMap={woodMaps?.roughnessMap}
/>
```

Wenn `roughnessMap` vorhanden: `roughness = 1.0` (Map steuert), sonst Flat-Value aus `PLATTEN_MAT`.

### Aufräumen

- `generateWoodTexture` Export entfernen
- Perlin-Noise Code komplett entfernen (fade, lerp, grad, perlin2d, fbm, smoothstep, lerpColor, generateZebrano, generateNussbaum, generateEiche)
- `WOOD_ROUGHNESS` Map in Preview3D entfernen (Roughness kommt aus Map)

## Fix 3: Platten-Einzelauswahl mit Farbpicker

### Modus-Konzept

Zwei Modi in der 3D-Ansicht, umschaltbar per Toggle-Button über dem Canvas:

| Modus | Klick-Verhalten | Seitenleiste |
|-------|----------------|--------------|
| **Modul** (default) | Klick auf Modul → `selectedCell` (row/col) → CellEditorPopover | Typ, Böden, Kabel |
| **Farbe** | Klick auf Platte → `selectedPlate` (SceneObject.id) → Einzelplatten-Highlight | Ein Farbpicker (MATERIALS-Swatches) |

### Raycasting-Erweiterung

Aktuell liefert der Klick `row/col` zurück. Für den Farbmodus brauchen wir die **SceneObject.id** der getroffenen Platte.

**Ansatz:** Jedes Platten-Mesh bekommt `userData.sceneObjectId = obj.id` und `userData.partType = obj.partType`. Der Raycaster liest `userData` aus dem getroffenen Mesh.

Im Farbmodus: Nur Platten-Meshes (partType in PLATTE_TYPES) sind klickbar. Profile, Griffe, Eckverbinder werden ignoriert.

### Selection-Highlight

- **Modulmodus:** Grüne BBox um alle Teile des Moduls (wie bisher)
- **Farbmodus:** Grüne Edges um **eine einzelne Platte** (die angeklickte)

### Farbpicker in der Seitenleiste

Wenn `selectedPlate` gesetzt:
- Label: Plattenart + Position (z.B. "Rückwand R0/C0")
- Eine Reihe MATERIALS-Swatches (die gleichen wie bei "OBERFLÄCHE")
- Klick auf Swatch → `partColors[sceneObjectId] = hex`
- Farbänderung ist **rein visuell** — kein BOM-Effekt

### partColors Key-Schema

Aktuell: `partColors[modulKey][partColorKey]` (z.B. `partColors['r0c0']['front']`).

**Neu:** `partColors[sceneObjectId]` direkt als flat Map (z.B. `partColors['ruecken_r0_c0'] = '#1c1a17'`). Die SceneObject-ID ist eindeutig und stabil.

**Migration:** Das bestehende `partColors`-Schema in `useConfigStore` muss angepasst werden. Statt `Record<string, Record<string, string>>` wird es `Record<string, string>` (flach: sceneObjectId → hex).

### FÜLLUNG-Sektion entfernen

Die gesamte "FÜLLUNG"-Sektion mit den 6 Swatch-Gruppen (Rückwand, Seite links, Seite rechts, Deckel, Boden, Front) wird entfernt. Ersetzt durch den Einzelplatten-Farbpicker im Farbmodus.

### Betroffene Dateien

- `src/features/preview3d/Preview3D.tsx` — Modus-Toggle, Raycasting, Highlight
- `src/features/configurator/ConfiguratorShell.tsx` — Modus-State, Farbpicker-UI
- `src/features/configurator/useConfigStore.ts` — `partColors` Schema-Änderung
- Ggf. `src/features/configurator/` — FÜLLUNG-Sektion entfernen

## Nicht im Scope

- BOM-Auswirkung der 3D-Farbänderungen (nächster Entwicklungsschritt)
- Displacement-Maps für Holz (kein visueller Mehrwert bei flachen Platten)
- Textur-Tiling pro Plattengröße (feste repeat.set(1,2) reicht vorerst)
