# Design: 9 Konfigurator-Verbesserungen

Datum: 2026-04-16

---

## 1. Stellfuß mit Nivellierschraube

**Aktuell:** Stellfuß (`stell50`) wird als vertikales Profil-Stück (50mm) gerendert, ohne Nivellierschraube.

**Änderung:** Beim Footer-Typ `stell50` wird zusätzlich das `Nivellierschraube_30mm.glb` an jeder Fußposition geladen und bündig in die Unterseite des Stellfuß-Profils eingesetzt. Nur die Auflageplatte der Schraube ist sichtbar (identische Versenkungs-Logik wie standalone Nivellierschraube, aber Y-Referenz = Unterkante Stellfuß statt Unterkante Würfel).

**Betroffene Datei:** `src/features/preview3d/useModuleGeometry.ts` (Zeilen 522–529)

**Implementierung:**
- Im `isStell`-Block: Nach dem Stellfuß-Profil einen zweiten SceneObject-Eintrag erzeugen
- GLB: `STRUCTURE_GLB_MAP['nivellierschraube']`
- Rotation: `[-Math.PI / 2, 0, 0]` (Bolzen nach oben)
- Y-Position: `(wuerfelBottom - footerH) * s` — Mitte auf Stellfuß-Unterkante, sodass obere Hälfte im Profil versenkt ist
- ID-Schema: `nivellier_f_{ci}` / `nivellier_b_{ci}`

---

## 2. "Kein Griff" entfernen, Default = Bridge

**Aktuell:** `HANDLES[0]` = `{ v: 'none', l: '— kein Griff', lb: null }`. Default in `useConfigStore`: `handle: 'none'`.

**Änderung:**
- `constants.ts`: Eintrag `{ v: 'none' }` aus `HANDLES` entfernen
- `useConfigStore.ts`: Initial-State `handle: 'bridge'`
- `SidebarMoebel.tsx`: `handleWarn`-Logik entfernen (kein `none` mehr möglich)
- `BOMPanel.tsx`: Fallback-Zeile `state.handle === 'none'` entfernen
- `useModuleGeometry.ts`: Guard `handle === 'none'` → Skip-Logik entfernen (Griff wird immer gerendert)

**Betroffene Dateien:**
- `src/core/constants.ts`
- `src/features/configurator/useConfigStore.ts`
- `src/features/configurator/SidebarMoebel.tsx`
- `src/features/bom/BOMPanel.tsx`
- `src/features/preview3d/useModuleGeometry.ts`

---

## 3. Griff-Preislogik prüfen

**Aktuell:** Handle-Preis wird via `normalizeLabel(bezeichnung)` in `article_prices` gesucht (Kategorie = 'Griff'). Jeder Griff hat potenziell einen eigenen Preis.

**Prüfpunkte:**
- Supabase `article_prices`: Hat jeder der 17 Griffe (nach Entfernung von `none`) einen eigenen Eintrag?
- Normalisierung: Matcht `normalizeLabel('Axio groß')` korrekt auf den DB-Eintrag?
- BOMPanel: Zeigt `pr('Griff', ...)` den individuellen Preis, nicht einen Pauschalpreis?
- Falls Einträge fehlen: `scripts/import-prices.py` oder manuelles Seed-SQL ergänzen

**Betroffene Dateien:**
- `src/app/api/bom/route.ts` (Zeilen 253–264)
- `src/app/api/price/route.ts`
- `scripts/import-prices.py` (falls Seed-Anpassung nötig)

---

## 4. Farbauswahl-Icons: rund → quadratisch mit abgerundeten Ecken

**Aktuell:** `CHIP`-Style in `SidebarMoebel.tsx` (Zeile 160): `borderRadius: '50%'` → runde Kreise (28×28px).

**Änderung:** `borderRadius: '50%'` → `borderRadius: '6px'`

Betrifft drei identische `CHIP`-Definitionen:
- `src/features/configurator/SidebarMoebel.tsx` (Zeile 160)
- `src/features/configurator/SidebarElement.tsx`
- `src/features/configurator/SidebarPlatte.tsx`

Größe, Doppelring-Selection, Scale-Animation bleiben identisch.

---

## 5. Fronten entfernen bei fehlenden Seitenwänden

**Aktuell:** `toggleOpt('outer'/'inner')` ändert nur `opts`, Fronten bleiben unberührt.

**Änderung:** Nach jedem `toggleOpt`-Aufruf wird eine Validierung ausgeführt, die betroffene Zellen auf `'O'` setzt.

**Logik — eine Zelle `[r, c]` braucht Seitenwände für Fronten wenn:**
- Linke Wand fehlt: `c === 0 && !opts.outer` ODER `c > 0 && grid[r][c-1].type === '' && !opts.inner`
- Rechte Wand fehlt: `c === cols.length - 1 && !opts.outer` ODER `c < cols.length - 1 && grid[r][c+1].type === '' && !opts.inner`

Wenn mindestens eine Seitenwand fehlt UND `cell.type` ist K/S/TR/TL/DT → auf `'O'` setzen.

**Betroffene Datei:** `src/features/configurator/useConfigStore.ts` — `toggleOpt`-Funktion erweitern

**Hinweis:** Auch bei `setType` prüfen: Wenn der Nutzer versucht, eine Front auf eine Zelle ohne Seitenwände zu setzen → blockieren und nur `'O'` oder `''` erlauben. Dafür `getAvailableFrontTypes` oder eine neue Validierung in `validation.ts` erweitern.

---

## 6. Grid-Konnektivitätsprüfung

**Aktuell:** Zellen können frei entfernt werden (×-Button), auch wenn dadurch das Möbel in getrennte Teile zerfällt.

**Änderung:** Vor dem Entfernen einer Zelle (Setzen auf `''`) wird geprüft, ob die verbleibenden belegten Zellen zusammenhängend bleiben (4-Nachbarschaft: oben, unten, links, rechts).

**Algorithmus:**
1. Kopie des Grids erstellen, Zielzelle auf `''` setzen
2. Erste belegte Zelle finden → BFS/Flood-Fill (4-Nachbarschaft)
3. Wenn nicht alle belegten Zellen erreicht → Entfernung blockieren
4. Warnung anzeigen: "Element kann nicht entfernt werden — Möbel würde geteilt"

**Betroffene Dateien:**
- `src/core/validation.ts` — neue Funktion `wouldDisconnect(grid, row, col): boolean`
- `src/features/configurator/useConfigStore.ts` — `setType` prüft vor `''`-Setzung
- `src/features/preview3d/Preview3D.tsx` — ×-Button deaktivieren/verstecken wenn Entfernung ungültig

---

## 7. Farbkorrektur Orange, Zinkgelb, Rubinrot

**Referenzbilder vs. aktuelle Hex-Werte:**

| Farbe | Aktuell (constants.ts) | Referenz (MDF/*.jpg) | Abweichung |
|-------|------------------------|----------------------|------------|
| Orange | `#e07020` | `#ec7720` | zu dunkel, zu wenig Sättigung |
| Zinkgelb | `#d8c800` | `#f9e900` | **stark** zu dunkel — Senf statt leuchtendes Gelb |
| Rubinrot | `#8c0a2e` | `#84002a` | leicht zu hell/rötlich |

**Rendering-Pipeline-Kompensation:**
Three.js konvertiert sRGB-Hex → Linear (Gamma 2.2). Die Beleuchtung (DirectionalLight + AmbientLight) hellt/verändert zusätzlich. Daher müssen die Hex-Werte so gewählt werden, dass das **gerenderte Ergebnis im Canvas** den Referenzbildern entspricht.

**Ansatz:**
1. Hex-Werte initial auf Referenzwerte setzen
2. Dev-Server starten, visuell im 3D-Canvas vergleichen
3. Falls Rendering die Farben verändert: Hex-Werte iterativ anpassen (Pre-Compensation)
4. Auch `border`-Werte proportional anpassen

**Betroffene Datei:** `src/core/constants.ts` — MATERIALS-Array (Einträge KHOR, KHZG, KHRR)

---

## 8. Fokus-Button (Sidebar links)

**Platzierung:** Unter dem "Neu"-Button in der linken oberen Ecke (`position: fixed, top: ~148px, left: 16px`).

**Funktion:** Klick ruft `cameraControls.fitToBox()` auf — zentriert und rahmt das gesamte Möbel ein (gleiche Logik wie `CameraAutoFrame`).

**Implementierung:**
- `ConfiguratorShell.tsx`: Neuer Button unterhalb "Neu"
- Icon: `Focus` oder `Crosshair` aus lucide-react
- Gleicher Button-Stil wie "Neu" (glassmorphism, 10px Font, etc.)
- Preview3D ref braucht eine neue Methode `resetCamera()` oder der bestehende `fitToBox`-Trigger wird exponiert
- `Preview3D.tsx`: `ThreeCanvasHandle` erweitern um `resetCamera(): void`

**Betroffene Dateien:**
- `src/features/configurator/ConfiguratorShell.tsx`
- `src/features/preview3d/Preview3D.tsx` (Handle erweitern)

---

## 9. Außenmaße-Button + 3D-Bemaßungslinien

**Platzierung:** Unter dem Fokus-Button (`top: ~188px, left: 16px`). Toggle-Button.

**Funktion:** Blendet Bemaßungslinien im 3D-Canvas ein/aus:
- **Gesamtbreite** — horizontale Linie unterhalb des Möbels mit Pfeilen + Label "Außenmaß X cm"
- **Gesamthöhe** — vertikale Linie rechts neben dem Möbel + Label
- **Gesamttiefe** — diagonale Linie vorne unten + Label
- **Spaltenbreiten** — individuelle horizontale Abschnitte unter dem Möbel
- **Zeilenhöhen** — individuelle vertikale Abschnitte rechts

**Rendering:** Als eigene Three.js Group (`name: 'dimension-lines'`), wird bei Screenshots ausgeblendet (analog zu `ghost-zones` und `dim-labels`).

**Bemaßungsstil (eigene Optik):**
- Dünne Linien (1px) in `#6A6660` (Artmodul-Grau)
- Endpfeile als kleine Striche (Serifs)
- Labels als `<Html>`-Overlays (drei/drei) mit `font-size: 10px`, weißer Hintergrund mit leichtem Schatten
- Maßangaben in cm (z.B. "152.9 cm"), eine Dezimalstelle

**State:** Neues Boolean `showDimensions` in ConfiguratorShell (useState), wird an Preview3D als Prop weitergereicht.

**Betroffene Dateien:**
- `src/features/configurator/ConfiguratorShell.tsx` — Button + State
- `src/features/preview3d/Preview3D.tsx` — Prop `showDimensions`, Rendern der Dimension-Group
- Neue Komponente: `src/features/preview3d/DimensionLines.tsx` — Three.js Lines + Html-Labels

---

## Implementierungsreihenfolge

1. **Farb-Chips quadratisch** (Punkt 4) — trivial, sofort
2. **"Kein Griff" entfernen** (Punkt 2) — einfach, keine Abhängigkeiten
3. **Farbkorrektur** (Punkt 7) — unabhängig, visuell
4. **Griff-Preislogik** (Punkt 3) — Prüfung, ggf. DB-Fix
5. **Stellfuß + Nivellierschraube** (Punkt 1) — 3D-Geometrie
6. **Fronten bei fehlenden Wänden** (Punkt 5) — Validierungslogik
7. **Grid-Konnektivität** (Punkt 6) — Algorithmus + UI-Feedback
8. **Fokus-Button** (Punkt 8) — UI + Camera-API
9. **Außenmaße-Button** (Punkt 9) — aufwändigste Änderung, eigene Komponente
