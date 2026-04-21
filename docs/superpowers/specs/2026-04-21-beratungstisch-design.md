# Beratungstisch (Consultation Table) — Design Spec

**Datum:** 2026-04-21
**Status:** Approved
**Ansatz:** A — Neuer CellType `'BT'` mit Zonen-Logik

---

## Zusammenfassung

Der Beratungstisch ist ein Standardmodul im Lightmodul-System, bestehend aus einem 600x600x600-Basiskubus mit einer Profil-Erhöhung und Arbeitsplatte. Er kann singulär stehen oder im Verbund mit dem regulären Shopsystem erweitert werden.

### Aufbau (von unten nach oben)

1. **Ebene 0:** Standard-600x600x600-Kubus, identisch zu `'O'`-Zelle
2. **Erhöhung:** 360mm-Vertikalprofil ab Oberkante Basiskubus
3. **Zwischenwuerfel:** Am oberen Ende des 360mm-Profils (~960mm Hoehe)
4. **Regalanschluss:** 213mm-Vertikalprofil vom Zwischenwuerfel zum naechsten Grid-Knoten (nur wo oben ein aktives Modul angrenzt)
5. **Worktop-Rahmen:** Horizontale 600mm-Profile verbinden die Zwischenwuerfel
6. **Arbeitsplatte:** Standard-Fachboden 600x600 auf dem Worktop-Rahmen

### Profil-Ersetzungsregel

Ein 600mm-Vertikalprofil am Regalanschluss wird ersetzt durch:
**360mm-Profil + Wuerfel + 213mm-Profil = 600mm**

An freistehenden Seiten (kein Regal darueber) enden die 360mm-Profile am Worktop-Wuerfel ohne 213mm-Fortsetzung.

---

## 1. Datenmodell

### Neuer CellType

```typescript
type CellType = '' | 'O' | 'RF' | 'RL' | 'BT';
```

### Semantik im Grid

- Eine `'BT'`-Zelle bei `grid[r][c][d]` belegt implizit auch `grid[r-1][c][d]` (eine Reihe hoeher, da r-1 = oben)
- Die Zelle darueber wird automatisch als `''` gesetzt und gegen Bearbeitung gesperrt
- Falls keine Reihe darueber existiert: `addRowTop()` wird automatisch ausgeloest

### Keine ConfigState-Erweiterung noetig

Der `'BT'`-Typ im bestehenden `grid[][][]` reicht aus. Die Blockierung wird in Validierung und UI gehandhabt, nicht im State.

### BOM-relevante Bauteile pro BT-Zelle

| Bauteil | Beschreibung |
|---------|-------------|
| Fachboden 600x600 | Arbeitsplatte (1 pro BT-Zelle) |
| Profil 360mm | Vertikale Erhoehung (je Vertikalkante, Sharing-Logik) |
| Profil 213mm | Regalanschluss (nur wo oben aktives Modul angrenzt) |
| Zwischenwuerfel | Am Worktop-Niveau (Sharing wie regulaere Wuerfel) |
| Basis-Bauteile | Wie `'O'`-Zelle (Standard-Profile, Wuerfel, Fuesse) |

---

## 2. Validierung & Grid-Regeln

### Platzierungsregeln fuer `'BT'`

- Nur in der untersten aktiven Reihe (Ebene 0)
- Muss am Rand des Grids stehen (min. eine freie Seite: links, rechts, vorne, hinten)
- Zelle direkt darueber (r-1) muss leer sein oder wird automatisch geleert
- BT zaehlt nicht als tragfaehig — keine Module auf der Sperrzone

### Automatische Grid-Erweiterung

- BT in oberster Reihe → `addRowTop()` automatisch
- BT entfernt → Sperrung aufheben → `trimEmptyEdges`

### Phantom-Erweiterung

- BT erzeugt Phantome horizontal und in Tiefenrichtung, nicht nach oben
- Phantom neben BT erzeugt einen weiteren BT (nicht regulaeres Modul)

### canPlace()-Erweiterung

- `canPlace(r, c, d, 'BT')` prueft: unterste Reihe, Rand, Zelle darueber frei
- `canPlace(r, c, d, 'O'|'RF'|'RL')` blockiert wenn Zelle von BT darunter gesperrt

---

## 3. 3D-Geometrie

### Basis (Ebene 0)

Identisch zu `'O'`-Zelle: Standard-Wuerfel, 600mm-Profile, Stellfuesse/Rollen.

### Erhoehung (ab Oberkante Basiskubus)

Pro Vertikalkante des BT:

1. **360mm-Profil** nach oben ab Oberkanten-Wuerfel
2. **Zwischenwuerfel** am oberen Ende (~960mm Hoehe)
3. **213mm-Profil** weiter nach oben — nur wo aktives Modul im Grid darueber existiert

### Worktop-Rahmen

- Horizontale 600mm-Profile verbinden Zwischenwuerfel (X- und Z-Richtung)
- Shared zwischen benachbarten BT-Zellen

### Fachboden

Standard-Fachboden 600x600 auf dem Worktop-Rahmen.

### Profilfarbe

Alle Sonderprofile (360mm, 213mm) uebernehmen die globale `profileColor` (SW/WS).

### Neue SceneObject-partTypes

- `'profil360'` — 360mm Vertikalprofil
- `'profil213'` — 213mm Vertikalprofil
- Zwischenwuerfel nutzen bestehenden `'wuerfel'`-partType

---

## 4. BOM-Berechnung

### Neue BOMResult-Felder

```typescript
interface BOMResult {
  // ... bestehende Felder ...
  profil360: number;    // Anzahl 360mm-Profile
  profil213: number;    // Anzahl 213mm-Profile
  fachbodenBT: number;  // Anzahl BT-Arbeitsplatten (= Anzahl BT-Zellen)
  wuerfelBT: number;    // Anzahl Zwischenwuerfel am Worktop-Niveau
}
```

### Zaehllogik pro BT-Zelle

| Bauteil | Menge | Bedingung |
|---------|-------|-----------|
| Profil 360mm | je Vertikalkante (nicht geshared) | immer |
| Profil 213mm | je Vertikalkante | nur wo oben aktives Modul angrenzt |
| Zwischenwuerfel | je Ecke (Sharing wie regulaere Wuerfel) | immer |
| Fachboden BT | 1 | immer |

### Hardware pro Zwischenwuerfel

Gleiche Ratio wie regulaere Wuerfel: 4x M4, 2x M6, 2x Scheiben, 4x Einlegemuttern.

### Bestehende Zaehler

`wuerfel`, `profileX/Y/Z`, `footerQty`, Schrauben etc. zaehlen die Basis-Ebene des BT wie eine normale `'O'`-Zelle.

### Artikelnummern

Eigene Artikelnummern fuer Profil 360mm, Profil 213mm und Fachboden BT — werden spaeter in `article_prices` eingepflegt. Bis dahin: Mengen in BOM sichtbar, Preise zeigen "—".

---

## 5. UI & Interaktion

### Zelltyp-Auswahl

- `'BT'` als neue Option in `getAvailableCellTypes()` (nur wenn `canPlace()` true)
- Label: "Beratungstisch"
- Eigene visuelle Kennzeichnung im ConfigGrid

### Gesperrte Zelle darueber

- Sperrsymbol oder ausgegraut
- Nicht interagierbar (kein Click-Handler, kein Popover)

### Phantom-Buttons

- Phantome neben BT: links, rechts, vorne, hinten (kein oben)
- Klick erzeugt direkt einen neuen BT

### Entfernen

- BT auf `''` setzen → Sperrung aufheben → `trimEmptyEdges`

### BOM-Panel

- Neue Zeilen: Profil 360mm, Profil 213mm, Fachboden BT, Zwischenwuerfel
- Gruppierung unter "Beratungstisch" als eigene Kategorie
- Preise: "—" bis Artikelnummern vorhanden

---

## Erweiterungsszenarien

### Mehrere BT nebeneinander

Profile und Wuerfel werden geshared (gleiche Logik wie regulaere Module). Jeder BT bekommt seinen eigenen Fachboden.

### L-Form

BT-Zellen in Spalten- und Tiefenrichtung. Sharing an gemeinsamen Kanten. Validierung prueft Rand-Bedingung pro Zelle.

### Standalone (ohne Regal)

Keine 213mm-Profile noetig. Nur Basiskubus + 360mm-Erhoehung + Worktop-Rahmen + Fachboden.

### Basiskubus-Typ

Aktuell offen (TBD) — spaeter koennte der Basiskubus auch RF/RL-Einlagen erhalten.
