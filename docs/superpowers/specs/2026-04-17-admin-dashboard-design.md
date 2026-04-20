# Design: Admin-Dashboard + Auftragsworkflow

Datum: 2026-04-17

---

## Übersicht

Admin-Dashboard als Route-Gruppe im bestehenden Next.js-Konfigurator. Umfasst: Auftragsmanagement, Konfigurationsübersicht mit Excel-Download, Preispflege, Artikelstamm, Dashboard-Kennzahlen. Dazu Konfigurator-Erweiterungen (Speichern nach Supabase, Anfrage absenden) und ein Login-Placeholder für Fachhändler.

---

## 1. Zugangsschutz

Separate Basic-Auth-Ebene in `middleware.ts` für `/admin/*` und `/api/admin/*`.

- Env-Vars: `ADMIN_USER` + `ADMIN_PASSWORD`
- Bestehender Beta-Schutz bleibt als äußere Schicht
- Wer `/admin` aufruft, muss beide Credentials kennen (erst Beta, dann Admin)
- Fail-Safe: `ADMIN_PASSWORD` nicht gesetzt → 503

### Middleware-Logik (Pseudocode)

```
1. Alle Requests: Beta-Basic-Auth prüfen (bestehend)
2. Requests auf /admin/* oder /api/admin/*:
   - Zweiten Authorization-Header prüfen (Admin-Credentials)
   - Problem: HTTP erlaubt nur einen Authorization-Header
   - Lösung: Admin-Auth über Cookie oder Custom-Header
```

**Konkreter Ansatz:** Admin-Login-Seite unter `/admin/login`. Dort Admin-User/Passwort eingeben → setzt HttpOnly-Cookie `admin_session` (signiert mit Secret). Middleware prüft Cookie für `/admin/*`-Routen. Kein Supabase Auth, kein JWT — nur ein signiertes Cookie.

---

## 2. Datenmodell

### Tabelle `configurations`

| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `config_code` | TEXT UNIQUE NOT NULL | 6-stellige Möbel-ID |
| `config_json` | JSONB NOT NULL | Vollständiger ConfigState |
| `bom_json` | JSONB NOT NULL | committedBOM-Snapshot |
| `xlsx_blob` | BYTEA | Generiertes Excel als Binary |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

RLS: SELECT + INSERT für anon. Kein UPDATE/DELETE öffentlich.
Index auf `config_code`.

### Tabelle `orders`

| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `order_nr` | TEXT UNIQUE NOT NULL | Fortlaufend: `AM-YYYY-NNNN` |
| `status` | TEXT NOT NULL | `draft` → `submitted` → `confirmed` → `completed` → `cancelled` |
| `status_changed_at` | TIMESTAMPTZ | Letzte Statusänderung |
| `customer_name` | TEXT | Freitext |
| `customer_email` | TEXT | Für Kontakt |
| `note` | TEXT | Interne Admin-Notizen |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |

RLS: INSERT für anon (Kunden können Anfragen senden). SELECT/UPDATE/DELETE nur via service_role.

### Tabelle `order_items`

| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `order_id` | UUID FK → orders | ON DELETE CASCADE |
| `configuration_id` | UUID FK → configurations | |
| `quantity` | INTEGER NOT NULL | DEFAULT 1 |
| `unit_price` | NUMERIC | Preis zum Bestellzeitpunkt |
| `currency` | TEXT NOT NULL | `EUR` oder `CHF` |

RLS: INSERT für anon (zusammen mit Order). SELECT nur via service_role.

### Auftragsnummer-Generierung

SQL-Sequenz oder Trigger:
```sql
CREATE OR REPLACE FUNCTION generate_order_nr()
RETURNS TRIGGER AS $$
DECLARE next_nr INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_nr FROM 9) AS INTEGER)), 0) + 1
  INTO next_nr FROM orders
  WHERE order_nr LIKE 'AM-' || TO_CHAR(NOW(), 'YYYY') || '-%';
  NEW.order_nr := 'AM-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(next_nr::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 3. Admin-Seiten

### Layout

`src/app/admin/layout.tsx` — eigenes Layout mit Sidebar-Navigation (links). Schlicht, Tailwind. Kein Dashboard-Framework.

Sidebar-Links:
- Dashboard (mit Kennzahlen-Icons)
- Aufträge (mit Badge: offene Anzahl)
- Konfigurationen
- Preisliste
- Artikelstamm

### `/admin` — Dashboard

Kennzahlen-Kacheln (Server Component, Daten via `/api/admin/stats`):
- Aufträge gesamt
- Offene Aufträge (status = draft | submitted)
- Konfigurationen diese Woche
- Konfigurationen diesen Monat
- Umsatz confirmed + completed (EUR)

### `/admin/orders` — Aufträge

Tabelle mit Spalten: Auftragsnr., Status (farbige Badge), Kunde, Positionen, Erstellt, Letzte Änderung.
Filter: Status-Dropdown, Datumsbereich.
Klick → `/admin/orders/[id]`:
- Kundendaten (Name, E-Mail)
- Positionen (Möbel-ID, Maße, Preis, Link zur Konfiguration)
- Status-Dropdown zum Ändern (PATCH)
- Notizfeld (editierbar)
- Zeitstrahl: wann welcher Status gesetzt wurde

### `/admin/configurations` — Konfigurationen

Tabelle: Möbel-ID, Maße (B×H×T berechnet aus cols/rows/depth), Oberfläche, Erstellt.
Klick → Detailansicht:
- 2D-Vorschau (TechnicalDrawing als SVG oder bestehende Grid-Darstellung)
- BOM-Tabelle (aus bom_json)
- Button: "Excel herunterladen" (xlsx_blob)

### `/admin/prices` — Preisliste

Tabelle `article_prices` als durchsuchbares, editierbares Grid.
Spalten: Artikelnr., Typ, Kategorie, Bezeichnung, PG1 EUR/CHF, PG2 EUR/CHF, PG3 EUR/CHF, PG4 EUR/CHF.
Inline-Bearbeitung: Klick auf Preiszelle → Input → Speichern (PATCH).
Suche: Freitext über Artikelnr. + Bezeichnung.

### `/admin/articles` — Artikelstamm

Tabelle: Artikelnr., Typ, Kategorie, Bezeichnung, Breite, Tiefe.
"Neuer Artikel"-Button → Formular (Modal oder eigene Seite).
Klick auf Zeile → Bearbeiten.

---

## 4. API-Routen

### Admin-Routen (`/api/admin/*`)

Alle nutzen `createServiceSupabaseClient()`. Middleware prüft Admin-Cookie.

| Route | Methode | Zweck |
|---|---|---|
| `/api/admin/stats` | GET | Dashboard-Kennzahlen |
| `/api/admin/orders` | GET | Aufträge (Filter: status, dateFrom, dateTo, Pagination) |
| `/api/admin/orders/[id]` | GET | Einzelauftrag mit Items + Konfigurationen |
| `/api/admin/orders/[id]` | PATCH | Status ändern, Notiz bearbeiten |
| `/api/admin/configurations` | GET | Konfigurationen (paginiert, sortierbar) |
| `/api/admin/configurations/[id]/xlsx` | GET | Excel-Download aus xlsx_blob |
| `/api/admin/prices` | GET | Preisliste (paginiert, durchsuchbar) |
| `/api/admin/prices/[art_nr]` | PATCH | Einzelpreis inline bearbeiten |
| `/api/admin/articles` | GET | Artikelstamm |
| `/api/admin/articles` | POST | Neuer Artikel |
| `/api/admin/articles/[art_nr]` | PATCH | Artikel bearbeiten |

### Public-Routen

| Route | Methode | Zweck |
|---|---|---|
| `/api/config/save` | POST | Konfiguration + BOM + Excel nach Supabase |
| `/api/config/load` | GET | Konfiguration laden per `?code=XXXXXX` |
| `/api/orders` | POST | Anfrage absenden (Order mit Status `draft`) |

### Admin-Login

| Route | Methode | Zweck |
|---|---|---|
| `/api/admin/auth/login` | POST | Admin-Credentials prüfen, signiertes Cookie setzen |
| `/api/admin/auth/logout` | POST | Cookie löschen |

---

## 5. Konfigurator-Erweiterungen

### Speichern → Supabase

Bestehender "Speichern"-Button wird erweitert:
1. `commitBOM()` (lokal, wie bisher)
2. Excel generieren — `exportXLS` wird refactored: neue interne Funktion `generateXLSBlob()` gibt einen Blob/Buffer zurück, `exportXLS()` ruft diese auf und triggert den Download. Für Supabase-Speicherung wird nur `generateXLSBlob()` genutzt.
3. `POST /api/config/save` mit `{ code: moebelId, config: ConfigState, bom: BOMResult, xlsx: base64 }`
4. Erfolg → Toast "Gespeichert — Möbel-ID: XXXXXX"
5. Fehler → Toast "Speichern fehlgeschlagen"

### Anfrage senden

Neuer Button: "Anfrage senden" — sichtbar wenn `committedBOM` existiert.

1. Modal: Name (Pflicht), E-Mail (optional), Nachricht (optional)
2. `POST /api/orders` mit `{ configurationIds: [id], customerName, customerEmail, note }`
3. Erstellt Order mit Status `submitted`, verknüpft über `order_items` (`draft` ist für admin-erstellte Aufträge reserviert)
4. Erfolg → Toast "Anfrage gesendet — AM-2026-NNNN"

### Konfiguration laden

Textfeld + Button im Header oder neben Möbel-ID-Anzeige:
- GET `/api/config/load?code=XXXXXX`
- Lädt ConfigState in den Store
- Fehler: "Code nicht gefunden"

---

## 6. Login-Placeholder

`/login`-Seite als reine UI-Shell:
- E-Mail + Passwort-Felder (visuell fertig)
- Button zeigt Toast: "Händler-Login kommt bald"
- Link im Konfigurator-Header: "Händler-Login"
- Kein Supabase Auth, kein Session-Management
- Layout vorbereitet für spätere Erweiterung (Register, Passwort vergessen)

---

## 7. Nicht im Scope

- Echtes Auth-System (Phase 4)
- E-Mail-Benachrichtigungen bei Statuswechsel
- Rollen/Berechtigungen über Basic Auth + Admin-Cookie hinaus
- PDF-Export aus Admin (nutzt bestehende Konfigurator-PDFs)
- Echtzeit-Updates (WebSocket/Realtime)
