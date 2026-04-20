# Brainstorming-Prompt: Lightmodul Konfigurator — Vollständiger Projekt-Scope

## Kontext für Claude Code

Du arbeitest am **Lightmodul Konfigurator** — einem webbasierten B2B-Konfigurator für das Lightmodul-System der MHZ Hachtel GmbH. Das Projekt wurde als Fork des Artmodul-Konfigurators gestartet und läuft auf Next.js 16, TypeScript (strict), Tailwind CSS v4, Supabase und Three.js/React Three Fiber.

Der aktuelle Stand: Das Grundgerüst steht (Routing, Auth-Middleware, Supabase-Schema, 3D-Preview-Basis, BOM-Pipeline), aber nahezu alle Produktlogik, UI-Komponenten und Berechnungen spiegeln noch das Artmodul-System wider und müssen vollständig auf Lightmodul umgebaut werden.

---

## Das Produkt: Was ist Lightmodul?

Lightmodul ist ein **modulares Aluminium-Profil-Regalsystem** der MHZ Hachtel GmbH.

**Kernprinzip:**
- Das System basiert auf einem fixen Elementraster: **600 × 600 × 600 mm** pro Zelle
- Alu-Profile (25 × 25 mm) bilden das Gerüst
- Alu-Würfel (27 mm Kantenlänge) verbinden die Profile an den Kreuzungspunkten
- Das gesamte Gerüst kann in **Schwarz** oder **Weiß** geliefert werden

**Grid-Grenzen:**
- Breite: 1–8 Elemente (MAX_COLS = 8)
- Höhe: 1–5 Elemente (MAX_ROWS = 5)
- Tiefe: 1–4 Elemente (MAX_DEPTH = 4) ← NEU gegenüber Artmodul (war 2D)

**Zellentypen pro Gerüstfeld:**
- `''` = leer (Feld bleibt offen / ist Teil des Gerüsts, kein Einlegerahmen)
- `'O'` = offen (strukturell vorhanden, aber ohne Rahmen)
- `'RF'` = Einlegerahmen Standard
- `'RL'` = Einlegerahmen beleuchtet (mit integrierter LED)

**Einlegerahmen (Produktgruppen):**
In jeden Rahmen kann ein MHZ-Produkt eingesetzt werden — z.B.:
- Rollladen
- Raffstore
- Insektenschutz
- Sichtschutz
- (weitere Produktgruppen aus Supabase)

Pro Zelle mit Rahmen wählt der Händler eine Produktgruppe. Die genauen Artikelnummern und Preise kommen aus Supabase (`article_prices`).

**Stellfüße:**
- Stellfuß M6 (Art.-Nr. 6962)
- Rolle optional (Art.-Nr. 9100)

---

## Was ist bereits vorhanden (Basis aus Artmodul-Fork)?

- `src/core/constants.ts` — Lightmodul-Konstanten (ELEMENT_SIZE_MM, PROFILE_COLORS, CELL_TYPES, FOOTERS, FrameGroup-Interface)
- `src/core/types.ts` — Basis-Typen (müssen auf Lightmodul-Datenmodell angepasst werden)
- `src/core/calc.ts` — BOM-Berechnung (noch Artmodul-Logik, muss komplett neu)
- `src/core/validation.ts` — Validierung (muss angepasst werden)
- `src/features/preview3d/` — 3D-Vorschau auf Basis React Three Fiber (Artmodul-Geometrie, muss auf Lightmodul-Geometrie umgebaut werden)
- `src/features/configurator/` — Grid-UI, GlobalBar, Shell (Artmodul-Logik)
- `src/features/bom/BOMPanel.tsx` — Stücklisten-Anzeige
- `src/features/pdf/` — PDF-Export (Datenblatt, Angebot)
- `src/app/api/` — API-Routen (bom, pdf, datasheet, orders, offer)
- `supabase/migrations/` — vollständiges DB-Schema (profiles, article_prices, saved_configs, offers, orders)
- Middleware mit HTTP Basic Auth + Rate Limiting + Admin-Schutz
- Auth-Flow (Login, Händler-Registrierung, Admin-Freigabe)
- Admin-Panel (Basis)

---

## Was muss gebaut / umgebaut werden?

### 1. Kerndatenmodell (`src/core/types.ts`)
Das `ConfigState`-Interface muss auf Lightmodul angepasst werden:
- `cols`, `rows`, `depth` als Elementanzahl (nicht mm)
- `grid: Cell[][][]` — dreidimensional (rows × cols × depth)
- `profileColor: 'SW' | 'WS'`
- `footer: string`
- Pro Zelle: `type`, optional `frameGroup` (Produktgruppe), optional `frameProduct` (spezifischer Artikel)
- Keine `surface`, `handle`, `bomOverrides`, `catOverrides` wie bei Artmodul

### 2. BOM-Berechnung (`src/core/calc.ts`)
Komplett neu auf Basis der Lightmodul-Stückliste:
- Anzahl Profile (nach Länge: 600 mm je Richtung, Überschneidungen korrekt berechnen)
- Anzahl Würfel (Kreuzungspunkte im 3D-Gitter)
- Anzahl Einlegerahmen (RF und RL separat)
- Stellfüße / Rollen
- Pro Rahmen: Produktgruppe und Artikel (aus Supabase)
- Referenz-Wahrheitsquelle: `reference/lightmodul_stueckliste.html` (muss noch erstellt werden)

### 3. Konfigurator-UI
- Grid-Darstellung auf 3D-Raster ausweiten (Tiefe konfigurierbar)
- Zell-Editor: Typ wählen (leer / offen / RF / RL), Produktgruppe zuweisen
- GlobalBar: Profilfarbe, Tiefe, Stellfuß
- Keine Breiten-/Höhenwahl mehr (alles 600 mm fix)

### 4. 3D-Vorschau (`src/features/preview3d/`)
- `useModuleGeometry.ts` komplett neu für Lightmodul:
  - Alu-Profile als Zylinder/Box-Geometrien entlang X/Y/Z
  - Würfel an allen Kreuzungspunkten
  - Einlegerahmen als flache Platten in jeder Zelle
  - Profilfarbe (schwarz/weiß) korrekt rendern
  - 3D-Tiefe sichtbar machen (isometrische oder perspektivische Ansicht)
- Lightmodul-eigene GLB-Assets: `public/models/profil.glb`, `wuerfel.glb`, `rahmen_standard.glb`, `rahmen_beleuchtet.glb` (müssen erstellt oder geliefert werden)

### 5. PDF-Dokumente (`src/features/pdf/`)
- `DatasheetDocument`: Lightmodul-Datenblatt mit 3D-Screenshot, Maßzeichnung, Stückliste
- `OfferDocument`: Angebot für Händler
- Branding: Lightmodul / MHZ Hachtel GmbH

### 6. API-Routen
- `/api/bom` — Lightmodul-BOM-Berechnung + Preise aus Supabase
- `/api/datasheet` — Datenblatt-PDF
- `/api/pdf` — Angebots-PDF (nur dealer/admin)
- `/api/orders` — Bestellungen (Auftragsnummer-Präfix: `LM-YYYY-NNNN`)

### 7. Preissystem
- `article_prices`-Tabelle für Lightmodul-Artikel befüllen (Profil, Würfel, Rahmen RF, Rahmen RL, Stellfuß, Rolle)
- `scripts/import-prices.py` für Lightmodul-Artikelschema anpassen
- EUR und CHF Preisspalten

### 8. Auth & Händler-Workflow
- Händler-Registrierung mit manueller Admin-Freigabe (bereits im Schema)
- EK-Preise für Händler (mit `discount_pct` aus `profiles`)
- UVP für Admin, keine Preise für Customer

### 9. Admin-Panel
- Händlerverwaltung (Freigabe, Rabatt)
- Artikel-/Preispflege
- Bestellübersicht

### 10. Sonstiges
- Logo: `public/lightmodul-logo.png` ersetzen (echtes Lightmodul-Logo, ~200×60px, PNG mit Transparenz)
- `CLAUDE.md` auf Lightmodul-Stand bringen
- `README.md` neu schreiben
- Impressum / Datenschutz auf MHZ Hachtel GmbH anpassen

---

## Offene Fragen / Brainstorming-Aufgabe

Analysiere den aktuellen Code vollständig und erarbeite:

1. **Priorisierte Roadmap** — Was muss zuerst, was kann warten? Schlage Phasen vor (z.B. Phase 1: Datenmodell + BOM-Logik, Phase 2: UI, Phase 3: 3D, Phase 4: PDF, Phase 5: Admin)

2. **Datenmmodell-Vorschlag** — Wie soll `ConfigState` für Lightmodul genau aussehen? Wie modellieren wir das 3D-Raster sauber in TypeScript? Was muss in `types.ts` rein?

3. **BOM-Algorithmus** — Wie berechnen wir Profile, Würfel und Rahmen korrekt aus einem 3D-Gitter? Welche Kantenfälle gibt es (Überschneidungen, Außenkanten vs. Innenkanten)?

4. **3D-Geometrie** — Welche Geometrie-Strategie ist sinnvoll für die Echtzeit-Vorschau? Procedural (Three.js Primitiven) oder GLB-Assets? Was ist realistisch ohne externe 3D-Modelle?

5. **Was kann wiederverwendet werden?** — Welche Teile des Artmodul-Codes (Auth, PDF-Pipeline, API-Struktur, Admin-Panel) lassen sich direkt übernehmen, was muss komplett neu?

6. **Risiken & Blocker** — Was sind die kritischen Unbekannten? (z.B. fehlende GLB-Assets, unklares Preisschema, fehlende Produktgruppen-Daten)

Sei konkret, strukturiert und praxisorientiert. Ziel ist ein klares Bild davon, was in den nächsten Wochen in welcher Reihenfolge zu tun ist.
