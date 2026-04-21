# Sub-Projekt A: Bugfixes & Anpassungen — Design Spec

**Datum:** 2026-04-21
**Status:** Approved

---

## 1. BT-Fachboden (3 Stueck statt 1)

Jeder Beratungstisch bekommt 3 Fachboeden:

| Ebene | Y-Position | Beschreibung |
|-------|-----------|--------------|
| Unten | Unterkante Basiskubus (Stellfuss-Hoehe) | Bodenfach |
| Mitte | 600mm (Oberkante Basiskubus) | Zwischenfach |
| Oben | 960mm (Worktop-Niveau) | Arbeitsplatte |

### Aenderungen

- `useModuleGeometry.ts`: 3 Fachboden-Objekte pro BT-Zelle rendern (unten, mitte, oben)
- `calc.ts`: `fachbodenBT = Anzahl BT-Zellen * 3`
- BOM-Panel und XLS-Export passen sich automatisch an (Menge x3)

---

## 2. U-Form / Innenhof ermoeglichen

Leere Zellen innerhalb des Grids duerfen bestehen bleiben. Konfigurationen mit Luecken (U-Form, L-Form, Innenhof) sind erlaubt.

### Ursache

- `addDepthFront` kopiert Zelltypen der letzten Tiefenebene auf die neue — muss leere Zellen erzeugen statt zu kopieren
- Alle Phantom-Aktionen muessen `setCellType3D` / `expandAndActivate3D` (einzelzell-genau) verwenden
- `trimEmptyEdges` greift korrekt nur an komplett leeren Raendern — keine Aenderung noetig

### Fix

- `addDepthFront`: Neue Tiefenebene immer mit leeren Zellen (`newCell()`) statt Kopie der letzten Ebene
- Pruefen dass kein Code-Pfad `setType` (alle Depth-Layer) statt `setCellType3D` (einzeln) fuer Phantom-Platzierung nutzt

---

## 3. Gravity-Logik vollstaendig

Aktuell wird Schwerkraft nur beim Platzieren geprueft. Beim Entfernen bleiben schwebende Elemente zurueck.

### Regel

Eine Zelle bei (r, c, d) braucht Support bei (r+1, c, d), ausser sie ist in der untersten Reihe (r = nR-1). Kein horizontaler Support — seitlich angrenzende Wuerfel halten nicht.

### Fix

- Beim Entfernen einer Zelle (`setCellType3D` mit `''`, `setType` mit `''`): alle Zellen pruefen die auf der entfernten Zelle aufbauen
- Zellen ohne Support werden automatisch kaskadierend entfernt (von unten nach oben)
- Gilt fuer alle Achsen und Positionen im Grid

---

## 4. Stellfuss GLB

- STP-Quelle: `Lightmodul Zeichnungen/Files/Shop Step/2022-11-28_Stellfuss M6 fuer Shop_696207000.stp`
- Muss extern zu GLB konvertiert werden (STP → Blender/FreeCAD → GLB export)
- GLB-Asset: `public/models/stellfuss-m6.glb`
- `useModuleGeometry.ts`: Stellfuss-Objekte erhalten `glbFile: '/models/stellfuss-m6.glb'`
- `Preview3D.tsx`: SmartMesh laedt GLB ueber bestehenden `glbPath`-Mechanismus
- Bis GLB vorliegt: Fallback auf aktuelle Box-Geometrie bleibt bestehen

---

## 5. Verbessertes Loeschen (X-Button)

Aktuelles Problem: X-Buttons erscheinen an allen Elementen gleichzeitig, sind klein und schwer zu treffen, es ist unklar welches Element geloescht wird.

### Neues Verhalten

- X-Button erscheint **nur am aktuell selektierten Element** (nicht an allen)
- Positioniert im **Zentrum des Wuerfels**
- **Groesserer Klickbereich**: mindestens 32px Durchmesser
- **Hover-Feedback**: Element wird rot eingefaerbt als Loesch-Vorschau
- Nach Loeschen: Gravity-Kaskade greift automatisch (siehe Sektion 3)
- Alle bisherigen X-Buttons an nicht-selektierten Elementen entfallen

---

## 6. Ebenen-Umbenennung

3 Ebenen werden zu 2 Ebenen:

| Alt | Neu | Aenderung |
|-----|-----|-----------|
| Moebel | **Shop** | Umbenennung |
| Element | **Produktrahmen** | Umbenennung, wird in Sub-Projekt B ausgebaut |
| Platte | — | Entfaellt komplett |

### Technische Aenderungen

- `DrillLevel`-Typ: `'moebel' | 'element' | 'platte'` → `'shop' | 'produktrahmen'`
- Breadcrumb: 2 Eintraege statt 3
- `SidebarPlatte` wird nicht mehr gerendert
- Alle Referenzen in `useDrillDown.ts`, `ConfiguratorShell.tsx`, `Breadcrumb.tsx`, `Preview3D.tsx` aktualisieren
- Drill-Down-Logik: Klick auf Element fuehrt direkt zu 'produktrahmen' (kein Zwischenschritt)
