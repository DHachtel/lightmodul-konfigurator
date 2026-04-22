# Sub-Projekt B: Produktrahmen-Konfigurationsebene — Design Spec

**Datum:** 2026-04-22
**Status:** Approved

---

## Zusammenfassung

Die zweite Konfigurationsebene "Produktrahmen" erlaubt es, den fertig konfigurierten Shop mit Produktrahmen zu versehen. In dieser Ebene ist das Raster des Shops fixiert (keine Grid-Aenderungen, keine Shadowboxen). Produktrahmen werden per Klick auf verfuegbare Flaechen platziert/entfernt.

---

## 1. Datenmodell

### Neue Felder in ConfigState

```typescript
/** Produktrahmen-Zuordnung: faceId → true (bestueckt) */
frames: Record<string, boolean>;
```

### faceId-Format

`face_r{R}_c{C}_d{D}_{side}` mit `side` ∈ `'front' | 'back' | 'left' | 'right'`

Beispiel: `face_r0_c1_d0_front` = Vorderseite des Wuerfels bei Reihe 0, Spalte 1, Tiefe 0.

### Verfuegbare Flaechen (Laufzeit-Berechnung)

Eine Flaeche ist **verfuegbar** wenn:
1. Die Zelle aktiv ist (type !== '')
2. Die Nachbarzelle in dieser Richtung **leer oder ausserhalb** des Grids ist
3. Kein Rechtwinkler-Konflikt: Wenn zwei Wuerfel im rechten Winkel zueinander stehen (L-Form-Ecke), ist die Innenseite der Ecke blockiert

### Rechtwinkler-Regel

Fuer eine Flaeche `face_r{R}_c{C}_d{D}_{side}`:
- `side = 'right'`: Blockiert wenn Zelle (R, C+1, D) leer UND Zelle (R, C, D+1) oder (R, C, D-1) aktiv UND Zelle (R, C+1, D+1) oder (R, C+1, D-1) aktiv (L-Ecke)
- Analog fuer alle 4 Seiten: Eine Aussenflaeche an einer L-Ecke ist blockiert wenn der Winkelraum zu eng fuer einen Rahmen ist

Vereinfachte Regel: Eine Flaeche ist blockiert wenn sie in einer 90°-Innenecke liegt — d.h. die Zelle hat sowohl in der Flaechenrichtung als auch orthogonal dazu einen aktiven Nachbarn, der die Ecke schliesst.

---

## 2. Flaechenberechnung

### Funktion: computeAvailableFaces(grid, nC, nD)

Pure Funktion, gibt `Set<string>` zurueck mit allen verfuegbaren faceIds.

Algorithmus:
```
Fuer jede aktive Zelle (r, c, d):
  Fuer jede Richtung (front, back, left, right):
    Nachbar = Zelle in dieser Richtung
    Wenn Nachbar leer oder ausserhalb:
      Pruefe Rechtwinkler-Konflikt:
        - Fuer 'front'/'back': pruefe links/rechts-Nachbarn
        - Fuer 'left'/'right': pruefe front/back-Nachbarn
        Wenn Ecke geschlossen → blockiert
      Wenn nicht blockiert: faceId zur Menge hinzufuegen
```

Rechtwinkler-Detail fuer `front` (d-1 Richtung):
- Links-Nachbar bei (r, c-1, d) aktiv UND (r, c-1, d-1) aktiv → linke Ecke blockiert die 'left' Seite der front-Flaeche, aber die front-Flaeche selbst bleibt verfuegbar SOFERN sie nicht in der Ecke eingeklemmt ist.

Tatsaechlich vereinfacht: Eine Flaeche an Position (r,c,d) Richtung `side` ist blockiert wenn:
- `side='front'`: Zelle (r,c,d-1) leer, ABER ein orthogonaler Nachbar hat eine Wand die diese Flaeche ueberlappt. Das passiert wenn z.B. (r,c-1,d) aktiv UND (r,c-1,d-1) aktiv — dann schliesst die rechte Wand von (r,c-1,d) die Ecke.

Fuer V1 vereinfachen wir: **Keine Rechtwinkler-Blockierung implementieren.** Die Regel wird spaeter hinzugefuegt wenn die physischen Rahmenmasze bekannt sind. Aktuell: jede Aussenflaeche ist verfuegbar.

---

## 3. Produktrahmen-Ebene (DrillLevel 'produktrahmen')

### Verhalten

Wenn `drill.level === 'produktrahmen'`:
- **Grid fixiert**: Keine Shadowboxen/Phantome anzeigen
- **Keine X-Buttons**: Elemente koennen nicht geloescht werden
- **Keine Grid-Aenderungen**: Alle Grid-Mutations-Actions deaktiviert
- **Basiselement-Selector** in Sidebar ausgeblendet

### Hover-Feedback

Verfuegbare Flaechen werden beim Hover dezent grau hervorgehoben:
- Unsichtbar im Normalzustand
- Bei Maus-Hover: halbtransparente graue Flaeche (`opacity: 0.15`, Farbe `#888888`)
- Flaechen mit platziertem Rahmen: immer sichtbar in Rahmenfarbe

### Klick-Interaktion

Klick auf eine verfuegbare Flaeche → Popover erscheint:
- **Wenn kein Rahmen**: Button "Produktrahmen hinzufuegen"
- **Wenn Rahmen vorhanden**: Button "Produktrahmen entfernen"
- Popover schliesst nach Aktion automatisch

---

## 4. 3D-Rendering

### Verfuegbare Flaechen (FaceMesh)

Fuer jede verfuegbare Flaeche ein flaches Quad (PlaneGeometry):
- Groesse: 550 × 550mm (600 minus 2×25mm Profil)
- Position: Zellzentrum + Offset in Flaechenrichtung (halbe Zellengroesse)
- Rotation: entsprechend der Richtung (front/back/left/right)
- Material: transparent, nur bei Hover sichtbar
- onClick: Toggle-Popover

### Platzierte Rahmen (FrameMesh)

Fuer jeden platzierten Rahmen (`frames[faceId] === true`):
- Gleiche Position/Rotation wie FaceMesh
- GLB-Modell: `/models/produktrahmen.glb` (vorbereitet, Fallback auf Box)
- Fallback-Groesse: 550 × 550 × 20mm Box
- Farbe: Profilfarbe (SW/WS) aus ConfigState

### Neue SceneObject partTypes

- `'face'` — verfuegbare Flaeche (hover-sensitiv, klickbar)
- `'produktrahmen'` — platzierter Rahmen

---

## 5. Sidebar (Produktrahmen-Ebene)

Neue Sidebar-Komponente `SidebarProduktrahmen`:

### Inhalt

1. **Flaechen-Zaehler**: "X von Y Flaechen bestueckt" (X = platzierte Rahmen, Y = verfuegbare Flaechen)
2. **Aktionen**:
   - "Alle bestuecken" — setzt alle verfuegbaren Flaechen auf Rahmen
   - "Alle entfernen" — entfernt alle Rahmen
3. **Zurueck-Button**: Wechselt zur Shop-Ebene

### Anzeige

Kompaktes Layout, gleicher Stil wie SidebarMoebel (Section-Labels, Button-Styling).

---

## 6. BOM-Integration

### Neue BOMResult-Felder

```typescript
/** Anzahl platzierter Produktrahmen */
produktrahmen: number;
```

### Zaehlung

`produktrahmen = Object.values(config.frames ?? {}).filter(Boolean).length`

### BOM-Panel

Neue Gruppe "Produktrahmen" (nur wenn produktrahmen > 0):
- BRow: "Produktrahmen LightModul" mit Menge und Preis-Lookup (Kategorie: `'Produktrahmen'`)

### XLS-Export

Neue Zeile in der Beratungstisch-Sektion (oder eigene Sektion):
- "Produktrahmen LightModul", Menge, Artikelnummer 696607xxx

---

## 7. State-Aenderungen

### Neue ConfigActions

```typescript
toggleFrame(faceId: string): void;   // Toggle Rahmen an/aus
setAllFrames(on: boolean): void;      // Alle verfuegbaren Flaechen setzen/entfernen
```

### frames in ConfigState

- Default: `{}` (leer)
- Wird mit ConfigState serialisiert/gespeichert
- Bei Grid-Aenderungen (in Shop-Ebene): `frames` wird bereinigt — faceIds die nicht mehr gueltig sind werden entfernt

---

## 8. Phantom/Shadowbox-Unterdrueckung

In der Produktrahmen-Ebene:
- `phantomElements` gibt leeres Array zurueck wenn `drillLevel === 'produktrahmen'`
- `cellButtons` (X-Buttons) ebenfalls leer
- Kein Basiselement-Selector in der Sidebar
