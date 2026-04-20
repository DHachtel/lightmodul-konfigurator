# Design: Platten buendig in Profile + Stellfuesse/Rollen

**Datum:** 2026-04-14
**Datei:** `src/features/preview3d/useModuleGeometry.ts`

---

## Ziel

Die 3D-Darstellung des Moebels so korrigieren, dass:
1. Alle Platten buendig in die Aluminium-Profile eingefasst sind (kein sichtbarer Rand)
2. Plattendicke von 19mm auf 16mm korrigiert wird
3. Platten eine leichte Kantenrundung erhalten
4. Stellfuesse zentral in die unteren Wuerfel eingesteckt werden (nicht versetzt)
5. Rollen (Parkett/Teppich) nach gleicher Logik dargestellt werden (schwarz)

---

## Konstruktionskonstanten

| Konstante | Wert | Bedeutung |
|-----------|------|-----------|
| `t` | 16 | Plattendicke in mm (bisher 19) |
| `NUT` | 4 | Nuttiefe pro Seite in mm |
| `PLATE_RADIUS` | 2 | Kantenrundung in mm (Annaeherung) |
| `pd` | 30 | Profil-Aussendurchmesser mm (unveraendert) |
| `pd_i` | 2 | Innenprofil-Streifen mm (unveraendert) |
| `hw` | 15 | Halber Wuerfel mm (unveraendert) |

### Achsmass-Beziehungen

- **Achsmass** = Distanz Wuerfelmitte zu Wuerfelmitte (Werte aus `cols[]`, `rows[]`, `depth`)
- **Profillaenge** = Achsmass - 30mm (je 15mm Wuerfel pro Seite)
- **Plattenmass** = Achsmass - 8mm (je 4mm Nut pro Seite)

---

## Plattenpositionierung

Alle Platten werden zentriert zwischen den Wuerfelmitten positioniert. Die Plattenraender enden 4mm innerhalb des Profils und sind von aussen nicht sichtbar.

### Positionsformeln

Gegeben: Wuerfelmitte_links (`wmL`), Wuerfelmitte_rechts (`wmR`), Wuerfelmitte_unten (`wmB`), Wuerfelmitte_oben (`wmT`), Tiefe-Achsmass (`D`).

| Platte | Breite | Hoehe | Tiefe | Position X | Position Y | Position Z |
|--------|--------|-------|-------|------------|------------|------------|
| Seitenwand | t (16) | Achsmass_V - 8 | Achsmass_T - 8 | wmL bzw. wmR | Mitte(wmB, wmT) | D/2 |
| Boden/Deckel | Achsmass_H - 8 | t (16) | Achsmass_T - 8 | Mitte(wmL, wmR) | wmB bzw. wmT | D/2 |
| Rueckwand | Achsmass_H - 8 | Achsmass_V - 8 | t (16) | Mitte(wmL, wmR) | Mitte(wmB, wmT) | NUT + t/2 |
| Front | Achsmass_H - 8 | Achsmass_V - 8 | t (16) | Mitte(wmL, wmR) | Mitte(wmB, wmT) | D - NUT - t/2 |
| Zwischenwand | t (16) | Achsmass_V - 8 | Achsmass_T - 8 | Wuerfelmitte_x | Mitte(wmB, wmT) | D/2 |
| Zwischenboden | Achsmass_H - 8 | t (16) | Achsmass_T - 8 | Mitte(wmL, wmR) | Wuerfelmitte_y | D/2 |

### Fronten

Fronten sind identisch dimensioniert wie Rueckwaende. Der einzige Unterschied: Fronten erhalten einen Griff (bestehende Griff-Logik bleibt unveraendert, nur Z-Position wird an neue Front-Z angepasst).

---

## Kantenrundung

Alle Platten (Seiten, Boeden, Rueckwaende, Fronten) erhalten `RoundedBoxGeometry` statt `BoxGeometry`:
- Radius: 2mm (Annaeherung, exakte Profilform nicht sichtbar von aussen)
- Alle 4 Laengskanten gerundet
- Sichtbare Auswirkung minimal, da Kanten groesstenteils im Profil verborgen

### Implementierung

Three.js bietet kein natives `RoundedBoxGeometry`. Optionen:
1. `@react-three/drei` exportiert `RoundedBox` — bereits als Dependency vorhanden
2. Eigene Implementierung mit `ExtrudeGeometry` + `Shape` mit `absarc`

Empfehlung: `RoundedBox` aus drei verwenden (bereits installiert).

---

## Stellfuesse und Rollen

### Positionierung (gilt fuer beide)

Stellfuesse/Rollen werden an **allen unteren Wuerfeln** platziert:
- Jeder Wuerfel an der untersten Zeile hat vorne und hinten je einen Wuerfel
- Pro Spalte: 2 Wuerfel (vorne + hinten)
- Bei N Spalten: (N+1) Profilecken * 2 (vorne + hinten) = untere Wuerfel

Position: Der Bolzen sitzt zentral im Wuerfel.
- X = Wuerfelmitte_x (Profilecke)
- Y = Wuerfelmitte_y - hw (Unterkante Wuerfel)
- Z = Wuerfelmitte_z (vorne: D + hw, hinten: -hw)

Die GLB-Modelle werden mit dem Bolzen nach oben geladen und unterhalb des Wuerfels positioniert.

### Stellfuesse

- GLB: `/models/stellfuss_30mm.glb` (bereits vorhanden)
- Farbe: CHROME (Aluminium)
- Aktiv wenn `footer.startsWith('stell')`

### Rollen

- GLB: `/models/rolle_60mm_perfekt.glb` (bereits vorhanden)
- Farbe: Schwarz (`#1a1a1a`)
- Aktiv wenn `footer.startsWith('rolle')`

### Aenderung gegenueber aktuellem Code

Aktuell: 4 Stellfuesse nur an den aeussersten Ecken, versetzt positioniert.
Neu: Stellfuesse/Rollen an allen unteren Wuerfeln, zentral eingesteckt.

---

## Nicht betroffen

- Profil- und Wuerfel-Positionierung/-Dimensionen (bereits korrekt)
- Griff-Modelle und -Auswahl
- Farbsystem (catKeys, partColorKeys, partColors)
- SmartMesh-Rendering-Pipeline
- BOM-Berechnungen (`src/core/calc.ts`)
- Alle anderen Features (PDF, Preise, Auth)

---

## Zusammenfassung der Aenderungen

1. **Konstante `t`**: 19 -> 16
2. **Neue Konstanten**: `NUT = 4`, `PLATE_RADIUS = 2`
3. **Plattenpositionierung**: Komplett neue Berechnung basierend auf Wuerfelmitten und Achsmass
4. **Plattengeometrie**: `BoxGeometry` -> `RoundedBox` (aus drei)
5. **Stellfuesse**: Repositionierung zentral in Wuerfel, an allen unteren Wuerfeln
6. **Rollen**: Neu implementiert nach gleicher Logik wie Stellfuesse, schwarz
