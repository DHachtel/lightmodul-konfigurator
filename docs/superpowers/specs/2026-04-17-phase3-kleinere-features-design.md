# Design: Phase 3 — Kleinere Features

Datum: 2026-04-17

---

## Übersicht

7 unabhängige Features für den Konfigurator:

1. **Raster 10×10** — MAX_COLS von 8 auf 10 erhöhen
2. **Kabeldurchlass-Preis** — 22€ / 24 CHF pro Stück als eigener Preiseintrag
3. **PG2 ↔ PG3 Tausch** — Alu wird PG3, Glas wird PG2 (constants + DB)
4. **Sidebar PG-Gruppierung** — Materialien nach Preisgruppe gruppiert anzeigen
5. **Navigator zentriert** — Breadcrumb zentriert, größer, alle Ebenen immer sichtbar
6. **Fokus = Frontalansicht** — Fokus-Button setzt Kamera frontal + Drill-Down auf Möbel-Ebene
7. **Doppel-Schublade (S2)** — Neuer CellType für 2×180mm Schubladen in 360er Zelle

---

## Feature 1: Raster 10×10

### Änderung

`src/core/constants.ts` Zeile 17:
```typescript
// ALT:
export const MAX_COLS = 8;
// NEU:
export const MAX_COLS = 10;
```

Keine weiteren Änderungen nötig — Auto-Resize, Grid-Operationen und Ghost Zones nutzen bereits `MAX_COLS`.

---

## Feature 2: Kabeldurchlass-Preis

### Datenbank

Neuer Eintrag in `article_prices` (Supabase SQL):
```sql
INSERT INTO article_prices (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm, pg1_eur, pg1_chf, pg2_eur, pg2_chf, pg3_eur, pg3_chf, pg4_eur, pg4_chf)
VALUES ('9001', 'Zubehör', 'Kabeldurchlass', 'Kabeldurchlass ⌀80mm', NULL, NULL, 22.00, 24.00, 22.00, 24.00, 22.00, 24.00, 22.00, 24.00);
```

Alle PG-Spalten gleich — Kabeldurchlass ist materialunabhängig.

### API-Route

In `src/app/api/bom/route.ts`: Nach der bestehenden BOM-Preisberechnung die Kabeldurchlässe zählen und als eigene `PriceLineItem` anhängen:

- Anzahl: `Object.values(config.cableHoles).filter(Boolean).length`
- Preis aus `article_prices` WHERE `art_nr = '9001'`
- Kategorie: `'Kabeldurchlass'`
- `dim_key`: `'⌀80mm'`

---

## Feature 3: PG2 ↔ PG3 Tausch

### constants.ts

In der `MATERIALS`-Array die `pg`-Felder tauschen:
- `ALG` (Alu glatt): `pg: 'PG2'` → `pg: 'PG3'`
- `FLG` (Klarglas): `pg: 'PG3'` → `pg: 'PG2'`
- `VSG` (Milchglas): `pg: 'PG3'` → `pg: 'PG2'`

### Supabase-Datenbank

Python-Skript `scripts/swap_pg2_pg3.py`:
1. Verbindet sich mit Supabase via `SUPABASE_SERVICE_ROLE_KEY`
2. Für jede Zeile in `article_prices`: tauscht `pg2_eur ↔ pg3_eur` und `pg2_chf ↔ pg3_chf`
3. Upsert zurück in die DB
4. Logging: zeigt vorher/nachher für Stichprobe

Alternativ direkt als SQL:
```sql
UPDATE article_prices SET
  pg2_eur = pg3_eur, pg3_eur = pg2_eur,
  pg2_chf = pg3_chf, pg3_chf = pg2_chf;
```

### Verkaufspreise_02.xlsx

Hinweis: Die Excel-Quelldatei muss ebenfalls manuell angepasst werden (Spalten PG2 ↔ PG3 tauschen), damit ein zukünftiger Re-Import konsistent bleibt.

---

## Feature 4: Sidebar PG-Gruppierung

### Änderung in SidebarMoebel.tsx

Statt alle MATERIALS als flache Liste: gruppiert nach PG anzeigen.

Gruppierung:
```
PG1 — Kunstharz
■ ■ ■ ■ ■ ■ ■ ■ ■

PG2 — Glas
■ ■

PG3 — Aluminium
■

PG4 — Furnier
■ ■ ■
```

Pro Gruppe:
- Überschrift: fontSize 9, color `#A8A49C`, fontWeight 500, marginTop 10
- Format: `"PG1 — Kunstharz"`
- Chips darunter im bestehenden Flex-Layout

Gruppierungslogik:
```typescript
const PG_ORDER = ['PG1', 'PG2', 'PG3', 'PG4'];
const PG_LABELS: Record<string, string> = {
  PG1: 'Kunstharz', PG2: 'Glas', PG3: 'Aluminium', PG4: 'Furnier',
};
```
(Labels nach PG-Tausch)

---

## Feature 5: Navigator zentriert

### Änderung in Breadcrumb.tsx

**Position:** Zentriert horizontal:
```typescript
position: 'absolute',
top: 68,
left: '50%',
transform: 'translateX(-50%)',
zIndex: 10,
```

**Größe:** fontSize 13 (statt 11).

**Immer sichtbar:** Die `if (level === 'moebel' && !selectedCell) return null;`-Bedingung entfernen.

**Struktur:** Alle drei Ebenen immer anzeigen:
```
Möbel  ›  Element  ›  Platte
```

**Styling pro Ebene:**
- **Aktive Ebene:** color `#171614`, fontWeight 600, borderBottom `2px solid #171614`, paddingBottom 2
- **Erreichbare inaktive:** opacity 0.5, cursor pointer, klickbar → `onGoToLevel(level)`
- **Nicht erreichbare:** opacity 0.25, cursor default, nicht klickbar

**Erreichbarkeitslogik:**
- `moebel`: immer erreichbar
- `element`: erreichbar wenn `selectedCell !== null` (ein Element wurde schon mal selektiert)
- `platte`: erreichbar wenn `selectedPlateType !== null` (eine Platte wurde schon mal selektiert)

**Glasiger Stil beibehalten:** `background: rgba(255,255,255,0.88)`, `backdrop-filter: blur(8px)`, `borderRadius: 8`.

---

## Feature 6: Fokus = Frontalansicht + Drill-Down-Reset

### Änderung in Preview3D.tsx — resetCamera

Statt `fitToBox` (behält Kamerawinkel):

```typescript
resetCamera: () => {
  const cc = ccRef.current;
  if (!cc) return;
  const box = new THREE.Box3(
    new THREE.Vector3(boxMinX, boxMinY, boxMinZ),
    new THREE.Vector3(boxMaxX, boxMaxY, boxMaxZ),
  );
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  // Abstand so dass Möbel mit Padding reinpasst
  const maxDim = Math.max(size.x, size.y);
  const dist = maxDim * 1.4;
  // Frontalansicht: Kamera direkt vor dem Möbel (Z-Achse)
  cc.setLookAt(
    center.x, center.y, center.z + dist,  // Kameraposition
    center.x, center.y, center.z,          // Target
    true,                                    // animate
  );
},
```

### Änderung in ConfiguratorShell.tsx — Fokus-Button

Den bestehenden Fokus-Button erweitern:
```typescript
onClick={() => {
  preview3DRef.current?.resetCamera();
  drillActions.goToLevel('moebel');
}}
```

---

## Feature 7: Doppel-Schublade (S2)

### types.ts

CellType erweitern:
```typescript
export type CellType = '' | 'O' | 'K' | 'S' | 'S2' | 'TR' | 'TL' | 'DT';
```

### constants.ts

`CELL_TYPES`-Array erweitern:
```typescript
{ v: 'S2', l: '2× Schublade', icon: '▤' }
```

`FRONT_TYPE_AVAILABILITY` erweitern:
```typescript
S2: { widths: [420, 580, 780, 980], heights: [360] },
```
Nur Höhe 360 erlaubt (2×180mm Fronten).

### calc.ts

Im BOM-Zählblock: S2 zählt als 2 Schubladen-Fronten mit halber Höhe:
```typescript
else if (d.type === 'S2') {
  // 2 Schubladen à halbe Zellhöhe
  const frontH = Math.round(h / 2);
  addFront('front_S', w, frontH, 2);
  totalSch += 2;
}
```

Die `addFront`-Hilfsfunktion muss ggf. ergänzt werden (aktuell werden Fronten direkt in DimMaps geschrieben). Die bestehende S-Logik als Vorlage nutzen, aber mit `qty: 2` und `h/2` als Höhe.

### validation.ts

`getAvailableFrontTypes`: S2 erscheint nur wenn Breite in [420,580,780,980] und Höhe = 360.

`canPlace`: S2 braucht dieselben Seitenwand-Checks wie S.

### useModuleGeometry.ts

Im Front-Rendering-Block: Wenn `type === 'S2'`, zwei Schubladen-Fronten rendern:
- Erste Front: y-Position = Zellen-Unterkante + halbe Fronthöhe
- Zweite Front: y-Position = Zellen-Unterkante + 1.5× Fronthöhe
- Beide mit Griff (gleiche Logik wie S, nur y-Offset)

### SidebarElement.tsx

S2 als Option in der Fronttyp-Auswahl hinzufügen. Icon: `▤` oder doppeltes Schubladen-Symbol. Nur anzeigen wenn `getAvailableFrontTypes` S2 enthält.

---

## Betroffene Dateien

| Feature | Dateien |
|---------|---------|
| 1. Raster 10×10 | `constants.ts` |
| 2. Kabeldurchlass-Preis | `article_prices` (SQL), `bom/route.ts` |
| 3. PG-Tausch | `constants.ts`, `scripts/swap_pg2_pg3.py` (neu), SQL |
| 4. PG-Gruppierung | `SidebarMoebel.tsx` |
| 5. Navigator | `Breadcrumb.tsx` |
| 6. Fokus frontal | `Preview3D.tsx`, `ConfiguratorShell.tsx` |
| 7. Doppel-Schublade | `types.ts`, `constants.ts`, `calc.ts`, `validation.ts`, `useModuleGeometry.ts`, `SidebarElement.tsx` |
