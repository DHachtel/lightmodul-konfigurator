# 3D-First Konfigurator — Design Spec

**Datum:** 2026-04-16

## Ziel

Die 2D-Konfiguration als führendes System durch eine vollwertige 3D-Konfiguration ersetzen. Der 3D-Canvas wird zum primären Konfigurations-Interface mit drei Interaktionsebenen (Möbel → Element → Platte), navigiert durch Drill-Down-Klicks. Die 2D-Grid bleibt als Fallback erhalten.

## Architektur-Prinzip

Kein neuer State — alle Aktionen nutzen die bestehenden `ConfigActions` aus `useConfigStore`. Die 3D-Sidebar ersetzt die Funktion von ConfigGrid + CellEditorPopover + GlobalBar, ohne diese Dateien zu löschen. Eine einzige Wahrheitsquelle (`useConfigStore`) — kein Sync-Problem zwischen 2D und 3D.

## Die drei Ebenen

### Ebene 1 — Möbel (Startansicht)

**Selektion:** Erster Klick auf ein Element selektiert es (grüne Outline).

**Sidebar-Inhalt:**
- Tiefe: 360 / 580 (Toggle oder Segmented Control)
- Oberfläche: Material-Swatches (gruppiert nach PG)
- Füße: Stellfuß 50/100 / Nivellierschraube / Rolle
- Optionen: Seiten außen, Seiten innen, Rücken (Toggles)

**3D-Canvas-Features:**
- Ghost Zones an allen Außenkanten (halbtransparente Erweiterungsflächen)
- ×-Buttons auf Elementen (dezenter Kreis oben rechts, nur bei Hover)

### Ebene 2 — Element (Drill-Down)

**Selektion:** Zweiter Klick auf ein bereits selektiertes Element → Drill-Down.

**Sidebar-Inhalt:**
- Fronttyp: Icon-Buttons (Offen / Klappe / Schublade / Tür R / Tür L / Doppeltür) — gefiltert nach Maß-Einschränkungen (`canPlace()`, Schwerkraft-Regel)
- Fachböden: Stepper (0–5)
- Elementfarbe: Material-Swatches (überschreibt globale Oberfläche für dieses Element via `cellColors`)
- Griffauswahl: Griff-Swatches (globale Einstellung via `handle`, gilt für alle Fronten)

**3D-Canvas-Features:**
- Auto-Zoom: Kamera fährt sanft an das Element heran
- Platten-Kanten des Elements visuell hervorgehoben (subtile Kanten)
- Ghost Zones verschwinden (kein Hinzufügen in dieser Ebene)

### Ebene 3 — Platte (Drill-Down)

**Selektion:** Klick auf eine spezifische Platte im Element-Modus.

**Sidebar-Inhalt:**
- Plattenfarbe: Material-Swatches (überschreibt Element- und globale Farbe via `partColors`)
- Kabeldurchlass: Toggle (nur bei Strukturplatten — Boden, Rücken, Seiten — nicht bei Fronten). Setzt `cableHoles[boardId]`. Standard-Position: zentriert unten, 80×60mm.

**3D-Canvas-Features:**
- Auto-Zoom auf die selektierte Platte
- Nur diese Platte highlighted

## Navigation

### Drill-Down
Wiederholtes Klicken navigiert tiefer: Möbel → Element → Platte. Der Kontext bestimmt die Aktion:
- Klick auf nicht-selektiertes Element → selektieren (Möbel-Ebene bleibt)
- Klick auf bereits selektiertes Element → Drill-Down in Element-Ebene
- Klick auf Platte im Element-Modus → Drill-Down in Platten-Ebene

### Zurück
- Klick ins Leere (Canvas-Hintergrund) → eine Ebene hoch
- `Escape`-Taste → eine Ebene hoch
- Breadcrumb-Klick → direkt zur gewählten Ebene springen

### Breadcrumb
Oben im Canvas als HTML-Overlay: `Möbel › Element R1/C2 › Boden`
- Jedes Segment klickbar zum Zurückspringen
- Zeigt dem Nutzer immer, auf welcher Ebene er sich befindet
- Verschwindet in der Möbel-Ebene (Startansicht, keine Breadcrumb nötig)

## Ghost Zones (Elemente hinzufügen)

**Visuelles Konzept:** Halbtransparente Flächen an den Außenkanten des Möbels. Zeigen ein "Geisterbild" des nächsten möglichen Elements — wie eine architektonische Vorschau, kein Software-Button.

**Verhalten:**
- Nur sichtbar in der Möbel-Ebene
- Hover → leichtes Aufleuchten + dezentes `+`-Icon
- Klick → Popover im Canvas mit Breite/Höhe-Auswahl
- Nach Bestätigung → Element wird sofort hinzugefügt
- Klick außerhalb des Popovers → schließen ohne Aktion

**Positionen:**
- Links: Ghost Zone für `addColLeft` (zeigt Breiten-Dropdown)
- Rechts: Ghost Zone für `addColRight` (zeigt Breiten-Dropdown)
- Oben: Ghost Zone für `addRowTop` (zeigt Höhen-Dropdown)
- Unten: keine Ghost Zone (Elemente werden nur oben angebaut, wie im bestehenden System)

**Popover-Inhalt:**
- Position rechts/links: Dropdown "Breite" (420 / 580 / 780 / 980 mm) + Bestätigen-Button
- Position oben: Dropdown "Höhe" (180 / 360 / 580 / 660 / 720 / 1080 / 1440 / 1800 mm) + Bestätigen-Button

**Optische Abgrenzung vom Wettbewerb:** Keine grellen Pfeile (Mycs/Tylko-Style). Stattdessen architektonische Ghost-Flächen die das nächste Modul andeuten. Dezent, warmweiß, passt zum Artmodul-CD.

## Elemente entfernen

- Dezenter ×-Kreis (weiß, Schatten) oben rechts am Element
- Nur sichtbar in der Möbel-Ebene bei Hover über das Element
- Klick → Element wird entfernt (nutzt bestehende Gravity-Logik und Grid-Resize)

## Auto-Zoom

- **Möbel → Element:** Kamera fährt in ~400ms (ease-out) auf das selektierte Element, so dass es ~60% des Canvas füllt
- **Element → Platte:** Kamera fährt näher an die spezifische Platte
- **Zurück (eine Ebene hoch):** Kamera fährt zurück auf die vorherige Position (gespeicherter Kamera-State pro Ebene)
- Nutzt die bestehende `CameraControls`-API (`fitToBox` / `setLookAt` mit Smooth-Transition)

## Live BOM

- `BOMPanel` bleibt als Drawer rechts (wie heute)
- BOM wird bei jeder Config-Änderung neu berechnet und live aktualisiert
- Kein Warten auf "Berechnen"-Klick
- Overrides (Platten-Farben, Kabeldurchlöcher) fließen korrekt in die Stückliste ein

## 2D-Fallback

- `ConfigGrid.tsx` und `CellEditorPopover.tsx` bleiben unangetastet
- 2D/3D-Toggle bleibt, aber 3D wird Default-Ansicht
- Beide Modi nutzen denselben `useConfigStore` — Änderungen in 2D sind sofort in 3D sichtbar und umgekehrt

## Dateistruktur

### Unverändert
- `src/features/configurator/useConfigStore.ts` — State und Actions
- `src/features/configurator/ConfigGrid.tsx` — 2D-Fallback
- `src/features/configurator/CellEditorPopover.tsx` — 2D-Fallback
- `src/features/configurator/GlobalBar.tsx` — 2D-Fallback
- `src/features/preview3d/useModuleGeometry.ts` — Geometrie-Erzeugung
- `src/features/preview3d/SmartMesh.tsx` — GLB-Loader
- `src/features/preview3d/useWoodTexture.ts` — Texturen
- `src/features/preview3d/glbMap.ts` — Asset-Registry
- `src/core/calc.ts` — BOM-Berechnung
- Alle API-Routen

### Geändert
- `src/features/preview3d/Preview3D.tsx` — Drill-Down-Logik, Auto-Zoom-Integration, Ghost Zones rendern, Breadcrumb einbinden, Mode-Toggle-Buttons entfernen
- `src/features/configurator/ConfiguratorShell.tsx` — 3D als Default, neue Sidebar-Panels einbinden, Mode-State durch Drill-Down-Hook ersetzen

### Neu

| Datei | Verantwortung |
|-------|---------------|
| `src/features/preview3d/GhostZone.tsx` | Transparente Erweiterungsflächen im 3D-Canvas + Hover-Effekt (`+`-Icon) |
| `src/features/preview3d/GhostZonePopover.tsx` | HTML-Overlay mit Breite/Höhe-Dropdown + Bestätigen-Button |
| `src/features/preview3d/RemoveButton.tsx` | ×-Overlay auf Elementen (HTML-Overlay, nur Möbel-Ebene, nur bei Hover) |
| `src/features/preview3d/Breadcrumb.tsx` | Ebenen-Navigation oben im Canvas (`Möbel › Element R1/C2 › Boden`) |
| `src/features/preview3d/useDrillDown.ts` | Drill-Down State-Maschine: aktuelle Ebene, selektiertes Element/Platte, Kamera-Targets, Navigation (hoch/runter) |
| `src/features/configurator/SidebarMoebel.tsx` | Sidebar-Panel Möbel-Ebene (Tiefe, Oberfläche, Füße, Seiten/Rücken) |
| `src/features/configurator/SidebarElement.tsx` | Sidebar-Panel Element-Ebene (Fronttyp, Fachböden, Elementfarbe, Griffauswahl) |
| `src/features/configurator/SidebarPlatte.tsx` | Sidebar-Panel Platten-Ebene (Plattenfarbe, Kabeldurchlass-Toggle) |

## Nicht im Scope

- Kabeldurchlass-Visualisierung als 3D-Aussparung im Modell (erfordert Geometrie-Änderung — separates Feature)
- Drag & Drop von Elementen
- Undo/Redo
- Mobile Touch-Gesten für Drill-Down
- Entfernung der 2D-Grid (erst wenn 3D-Konfigurator vollständig validiert)
