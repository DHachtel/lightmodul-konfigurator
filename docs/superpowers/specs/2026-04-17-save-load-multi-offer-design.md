# Design: Save/Load + Multi-Möbel-Angebot

Datum: 2026-04-17

---

## Übersicht

Zwei zusammenhängende Features:

1. **Save/Load** — Konfigurationen mit 8-stelliger numerischer ID in Supabase speichern und laden. Public, kein Login nötig. Ladbar per Eingabefeld und URL-Parameter.
2. **Multi-Möbel-Angebot** — Mehrere gespeicherte Konfigurationen sammeln (localStorage), gemeinsames Angebots-PDF exportieren (Deckblatt + Detailseiten). Hybrid-Persistenz: Angebots-ID wird erst beim PDF-Export erzeugt und serverseitig gespeichert.

---

## Feature 1: Save/Load

### Datenbank

Neue Tabelle `saved_configs` (neben bestehender `configurations`, die für Phase 4 Auth reserviert bleibt):

```sql
CREATE TABLE saved_configs (
  config_code BIGINT PRIMARY KEY,
  config_json JSONB NOT NULL,
  screenshot  TEXT,                          -- PNG-DataURL (optional, für Multi-Möbel-PDF)
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE saved_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"  ON saved_configs FOR SELECT USING (true);
CREATE POLICY "Public insert" ON saved_configs FOR INSERT WITH CHECK (true);
-- Kein UPDATE, kein DELETE — immutable
```

### API-Routen

#### `POST /api/config/save` (public)

- **Body:** `{ config: ConfigState, screenshot?: string }`
- **Logik:**
  1. 8-stellige ID generieren: `Math.floor(10000000 + Math.random() * 90000000)`
  2. INSERT in `saved_configs` mit anon-Client
  3. Bei Kollision (unique violation): retry (max 3 Versuche)
- **Response:** `{ code: number }` oder `500` bei Fehler
- **Validierung:** `config` muss ein Objekt mit `cols`, `rows`, `grid` sein (Minimalcheck)

#### `GET /api/config/load?code=24912234` (public)

- **Logik:** SELECT `config_json` aus `saved_configs` WHERE `config_code` = code
- **Response:** `{ config: ConfigState }` oder `404`
- **Validierung:** `code` muss 8-stellige Zahl sein

### State-Änderungen (`useConfigStore`)

- `commitBOM()` generiert **keine** lokale `moebelId` mehr
- Neue Action: `setMoebelId(id: number)` — setzt die vom Server zurückgegebene ID
- `moebelId`-Typ ändert sich von `string | null` zu `number | null`

### UI-Änderungen

#### Speichern (ConfiguratorShell)

Bestehender `handleCommit()`-Flow wird erweitert:
1. `actions.commitBOM(bom)` — wie bisher (ohne ID-Generierung)
2. `preview3DRef.current.captureScreenshot(1600, 900)` — Screenshot capturen
3. `POST /api/config/save` mit `{ config: state, screenshot }`
4. `actions.setMoebelId(response.code)` — Server-ID setzen
5. Bei Fehler: Toast "Speichern fehlgeschlagen", lokaler Commit bleibt erhalten

#### Laden — Eingabefeld (BOMPanel)

- Textfeld + "Laden"-Button neben der Möbel-ID-Anzeige
- Input: 8-stellige Zahl
- `GET /api/config/load?code=...` → Response in Store laden
- Alle Felder des geladenen `ConfigState` via bestehende Actions setzen (oder neuer `loadConfig(config: ConfigState)` Action die den gesamten State ersetzt)
- Fehlerbehandlung: "Code nicht gefunden" Toast bei 404

#### Laden — URL-Parameter (ConfiguratorShell)

- Beim Mount: `searchParams.get('config')` prüfen
- Falls vorhanden: `GET /api/config/load` → Config in Store laden
- URL wird nach erfolgreichem Laden bereinigt (kein Reload-Loop)
- Fehler: Ignorieren, normaler leerer Konfigurator

### Neue Action: `loadConfig(config: ConfigState)`

Ersetzt den gesamten State auf einen Schlag (statt einzelne Setter aufzurufen):
- Setzt `cols`, `rows`, `depth`, `grid`, `surface`, `handle`, `footer`, `opts`, `bomOverrides`, `cableHoles`, `catOverrides`
- Invalidiert `committedBOM` und `moebelId` (geladene Config ist noch nicht "committed")

---

## Feature 2: Multi-Möbel-Angebot

### Warenkorb (Client-Side)

**localStorage-Key:** `artmodul_offer_items`
**Format:** `number[]` — Array von Möbel-IDs (config_codes)

Hilfsfunktionen (in neuem Utility-Modul `src/lib/offerCart.ts`):
- `getOfferItems(): number[]`
- `addOfferItem(code: number): void`
- `removeOfferItem(code: number): void`
- `clearOfferItems(): void`
- `getOfferCount(): number`

### Datenbank

Neue Tabelle `offers`:

```sql
CREATE TABLE offers (
  offer_code   BIGINT PRIMARY KEY,
  config_codes BIGINT[] NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read"  ON offers FOR SELECT USING (true);
CREATE POLICY "Public insert" ON offers FOR INSERT WITH CHECK (true);
-- Kein UPDATE, kein DELETE — immutable
```

### API-Route

#### `POST /api/offer/multi` (public)

- **Body:** `{ codes: number[], currency?: 'EUR' | 'CHF' }`
- **Logik:**
  1. Alle Configs aus `saved_configs` laden (WHERE `config_code = ANY($1)`)
  2. Pro Config: `computeBOM()` + Preislookup (rollenbasiert — Auth-Header prüfen)
  3. Angebots-ID generieren (8-stellig, gleiche Logik wie config_code)
  4. INSERT in `offers`-Tabelle
  5. PDF rendern: `MultiOfferDocument` (neues Component)
  6. Response: PDF-Buffer + Header `X-Offer-Code: <id>`
- **Dateiname:** `Artmodul_Angebot_<offer_code>_<DD-MM-YYYY>.pdf`

### PDF-Struktur: `MultiOfferDocument`

Neue Komponente `src/features/pdf/MultiOfferDocument.tsx`:

**Seite 1 — Deckblatt:**
- Logo + Titel "Angebot"
- Angebots-ID + Datum
- Übersichtstabelle:
  | Pos. | Möbel-ID | Maße (B×H×T) | Beschreibung | Einzelpreis* |
  |------|----------|--------------|--------------|-------------|
  | 1    | 24912234 | 1580×1440×360 | 2×3 Regal, Eiche natur | 1.234,00 € |
  | 2    | 58301947 | 980×720×580  | 1×2 Sideboard, Weiß | 567,00 € |
- Gesamtsumme netto / MwSt / brutto (nur Dealer/Admin)
- *Preisspalte nur für Dealer/Admin sichtbar

**Folgeseiten — je Möbel eine Detailseite:**
- Aufbau analog `DatasheetDocument`:
  - 3D-Screenshot (aus `saved_configs.screenshot`)
  - Maßzeichnung (`TechnicalDrawingView`)
  - Kennzahl-Grid (Breite, Höhe, Tiefe, Fächer, Gewicht)
  - BOM-Tabelle
  - Einzelpreis (nur Dealer/Admin)

### UI-Elemente

#### "Zum Angebot hinzufügen"-Button

- Erscheint nach erfolgreichem Speichern, neben der Möbel-ID-Anzeige
- Klick: `addOfferItem(moebelId)` + visuelles Feedback (Toast "Zum Angebot hinzugefügt")
- Wenn die ID bereits im Warenkorb ist: Button deaktiviert, Label "Im Angebot ✓"

#### Angebots-Badge (Toolbar)

- Kleiner Zähler in der ConfiguratorShell-Toolbar: "Angebot (3)"
- Nur sichtbar wenn `getOfferCount() > 0`
- Klick öffnet Dropdown/Panel:
  - Liste: je Eintrag Möbel-ID + "×"-Button zum Entfernen
  - "PDF erstellen"-Button (ruft `/api/offer/multi` auf)
  - "Leeren"-Button
- Beim PDF-Export: Loading-State, dann Download

#### 3D-Screenshots im Multi-PDF

- Screenshots werden beim Speichern mitpersistiert (`saved_configs.screenshot`)
- `/api/offer/multi` liest die Screenshots aus der DB — kein Canvas nötig beim Export
- Falls kein Screenshot vorhanden: Platzhalter-Bereich im PDF

### Rollenbasierte Preisanzeige

Die bestehende Logik aus `/api/bom` wird wiederverwendet:
- Unauthentifiziert / Customer: Preisspalte im Deckblatt ausgeblendet, Detailseiten ohne Preisblock
- Dealer: EK-Preise mit `discount_pct`
- Admin: UVP-Preise

---

## Kommerzielle Härtung (Post-MVP)

Die folgenden Maßnahmen sind für den produktiven Betrieb nötig, werden aber bewusst nicht im MVP implementiert. Sie werden in Phase 4 oder als eigenes Härtungs-Ticket umgesetzt.

### Screenshot-Storage

**Problem:** Base64-PNG als TEXT-Spalte = 500KB–2MB pro Zeile. Bei 10.000 Configs = 5–20 GB.

**Lösung:** Screenshots in Supabase Storage (Bucket `config-screenshots`) speichern. Nur die URL in `saved_configs.screenshot_url` (statt DataURL). Upload in `/api/config/save`, Download in `/api/offer/multi`.

### User-Zuordnung (nach Auth)

**Problem:** Anonyme Configs lassen sich nicht einem User zuordnen.

**Lösung:** `saved_configs` bekommt optionales `user_id UUID REFERENCES auth.users`. Nullable — anonyme Configs bleiben möglich. Nach Login: "Meine Konfigurationen anzeigen" und "Claim" bestehender anonymer Configs per Code-Eingabe.

### TTL / Cleanup

**Problem:** Tabelle wächst endlos.

**Lösung:**
- `expires_at TIMESTAMPTZ` — Default 90 Tage nach `created_at` für anonyme Configs
- Eingeloggte User: `expires_at = NULL` (unbegrenzt)
- Supabase Cron-Job (pg_cron) oder Edge Function: tägliches `DELETE FROM saved_configs WHERE expires_at < now()`
- Gleiches Prinzip für `offers`-Tabelle

### Rate Limiting

**Problem:** Public INSERT ohne Schutz — Spam möglich.

**Lösung:** In `/api/config/save` und `/api/offer/multi`:
- IP-basiertes Rate Limiting: max 20 Saves pro IP pro Stunde
- Implementierung via Supabase Edge Function oder einfacher In-Memory-Counter in der API-Route (reicht für moderate Last)

### Payload-Validierung

**Problem:** Beliebig großes JSON möglich.

**Lösung:**
- `config_json` max 50 KB validieren in `/api/config/save`
- `screenshot` max 3 MB validieren (bzw. nach Storage-Migration: Upload-Limit im Bucket)
- Strukturvalidierung: `config` muss `cols`, `rows`, `grid`, `depth` enthalten

### Update-Policy

**Problem:** Immutable — User muss bei jeder Änderung neu speichern.

**Lösung (nach Auth):** Eingeloggte User dürfen eigene Configs updaten:
```sql
CREATE POLICY "Owner update" ON saved_configs
  FOR UPDATE USING (user_id = auth.uid());
```
Anonyme Configs bleiben immutable.

---

## Betroffene Dateien

### Neu
- `supabase/migrations/XXX_saved_configs.sql`
- `supabase/migrations/XXX_offers.sql`
- `src/app/api/config/save/route.ts`
- `src/app/api/config/load/route.ts`
- `src/app/api/offer/multi/route.ts`
- `src/features/pdf/MultiOfferDocument.tsx`
- `src/lib/offerCart.ts`

### Geändert
- `src/features/configurator/useConfigStore.ts` — `setMoebelId()`, `loadConfig()`, `moebelId`-Typ
- `src/features/configurator/ConfiguratorShell.tsx` — Save-Flow, URL-Parameter, Angebots-Badge, "Zum Angebot"-Button
- `src/features/bom/BOMPanel.tsx` — Lade-Eingabefeld, "Zum Angebot"-Button
- `src/core/types.ts` — ggf. `moebelId: number | null`

### Unverändert
- `src/features/pdf/DatasheetDocument.tsx` — bleibt für Einzel-Datenblatt
- `src/features/pdf/OfferDocument.tsx` — bleibt für bestehenden Dealer-PDF-Export
- `configurations`-Tabelle — bleibt für Phase 4 Auth
- `/api/datasheet/route.ts` — unverändert
