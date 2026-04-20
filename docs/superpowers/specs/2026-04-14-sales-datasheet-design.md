# Artmodul Verkaufs-Datenblatt

**Datum:** 2026-04-14

## Ziel

Bestehendes technisches Datenblatt in ein elegantes Verkaufsdokument umwandeln.
1 Seite A4, Artmodul CD, prominentes 3D-Rendering, Maßzeichnung, nur Netto/Brutto-Preis.

## Layout (1 Seite A4 Hochformat)

- **Header:** ARTMODUL Logo-Text (links), Datum + Möbel-ID (rechts)
- **3D-Rendering:** ~45% der Seite, großes Bild, leicht von rechts oben
- **Maßzeichnung + Kennzahlen:** nebeneinander, ~25%
- **Konfig-Zusammenfassung:** Oberfläche, Griff, Tiefe (1-2 Zeilen)
- **Preisblock:** Netto + Brutto (inkl. MwSt), prominent rechts
- **Footer:** "Unverbindliche Konfiguration · MHZ Hachtel GmbH"

## Stil

- Schrift: Roboto Light (body), Roboto Regular (Überschriften)
- Hintergrund: #FAFAF8 (warmweiß)
- Textfarbe: #2A2A2A (dunkelgrau)
- Akzentlinien: #E0DDD8 (hellgrau)
- Logo: "ART" light + "MODUL" bold (Text, kein Bild)
- Keine Stückliste, keine Einzelpreise
- Preis nur Netto + Brutto (MwSt DE 19% / CH 8.1%)

## Betroffene Datei

`src/features/pdf/DatasheetDocument.tsx` — kompletter Rewrite

## Nicht im Scope

- API-Route Änderungen (bestehender /api/datasheet bleibt)
- Logo als Bilddatei (Text-Rendering reicht)
- Stückliste / Einzelpreise
