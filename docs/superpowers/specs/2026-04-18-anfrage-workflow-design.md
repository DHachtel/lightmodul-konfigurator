# Anfrage-Workflow: Konfiguration → Kontaktformular → Bestätigung

**Datum:** 2026-04-18
**Status:** Approved

## Ziel

Endkunden können nach dem Konfigurieren eine Anfrage mit Kontaktdaten absenden, die sich auf ein konkretes Möbel bezieht. Bestätigung im Browser + E-Mail an Kunde + E-Mail an MHZ.

## Zwei Nutzergruppen

1. **Endkunde** (kein Login): konfiguriert → speichert → schickt Anfrage mit Kontaktdaten
2. **Händler** (mit Login, spätere Phase): eigener Bestellflow — wird hier NICHT implementiert

## Endkunden-Flow

```
Konfigurieren → Speichern (Möbel-ID) → "Anfrage senden" → Formular
    ↓
Browser: Bestätigung + Auftragsnr. + PDF-Download
E-Mail an Kunde: Zusammenfassung
E-Mail an info@artmodul.com: Neue Anfrage
```

## Anfrage-Formular

Erweitert das bestehende Anfrage-Modal in ConfiguratorShell.

### Felder

| Feld | Pflicht | Typ |
|------|---------|-----|
| Name | ja | text |
| E-Mail | ja | email |
| Telefon | nein | tel |
| Firma | nein | text |
| Straße | nein | text |
| PLZ | nein | text |
| Ort | nein | text |
| Kommentar zum Möbel | nein | textarea |
| DSGVO-Checkbox | ja | checkbox → Link `/datenschutz` |

### Bezug zum Möbel

- Formular ist immer an die aktuelle Möbel-ID gebunden
- Möbel-ID, Konfigurationsübersicht (Maße, Oberfläche) werden automatisch mitgeschickt
- Kein freischwebendes Kontaktformular — immer kontextbezogen

## Datenbank-Änderungen

Bestehende `orders`-Tabelle um Adressfelder erweitern:

```sql
ALTER TABLE orders ADD COLUMN customer_phone TEXT;
ALTER TABLE orders ADD COLUMN customer_company TEXT;
ALTER TABLE orders ADD COLUMN customer_street TEXT;
ALTER TABLE orders ADD COLUMN customer_zip TEXT;
ALTER TABLE orders ADD COLUMN customer_city TEXT;
ALTER TABLE orders ADD COLUMN gdpr_consent_at TIMESTAMPTZ; -- Zeitpunkt der Einwilligung
```

## API-Änderungen

### `POST /api/orders` erweitern

Request-Body (zusätzlich zu bestehenden Feldern):
```json
{
  "customerPhone": "0711 123456",
  "customerCompany": "Musterfirma GmbH",
  "customerStreet": "Musterstr. 1",
  "customerZip": "70173",
  "customerCity": "Stuttgart",
  "gdprConsent": true
}
```

Validierung:
- `customerName` und `customerEmail` sind Pflicht
- `gdprConsent` muss `true` sein, sonst 400
- `gdprConsent` wird als Timestamp (`gdpr_consent_at = NOW()`) gespeichert

### `POST /api/mail/order-confirmation` (neu)

Wird von `/api/orders` nach erfolgreichem Speichern aufgerufen.

- Sendet 2 Mails via Nodemailer/SMTP:
  1. **An Kunde:** Bestätigung mit Auftragsnr., Möbel-Übersicht, "Wir melden uns"
  2. **An info@artmodul.com:** Neue Anfrage mit allen Kundendaten + Link zum Admin

- SMTP-Config via Env-Vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- Wenn SMTP nicht konfiguriert: Mail wird übersprungen (kein Fehler), Anfrage wird trotzdem gespeichert
- Absender: `info@artmodul.com` (bzw. `SMTP_FROM` Env-Var)

## E-Mail-Templates

### Bestätigung an Kunde

```
Betreff: Ihre Anfrage AM-2026-0001 — Artmodul Konfigurator

Guten Tag {Name},

vielen Dank für Ihre Anfrage über den Artmodul Konfigurator.

Ihre Auftragsnummer: AM-2026-0001
Möbel-ID: 12345678
Konfiguration: 2×3, 1160 × 1110 × 390 mm, Schwarz (MDF)

Wir werden uns in Kürze bei Ihnen melden.

Mit freundlichen Grüßen
Ihr Artmodul-Team

MHZ Hachtel GmbH
info@artmodul.com
```

### Benachrichtigung an MHZ

```
Betreff: [Konfigurator] Neue Anfrage AM-2026-0001

Neue Anfrage über den Artmodul Konfigurator:

Kunde: Max Mustermann
E-Mail: max@example.com
Telefon: 0711 123456
Firma: Musterfirma GmbH
Adresse: Musterstr. 1, 70173 Stuttgart

Möbel-ID: 12345678
Kommentar: Bitte in Eiche statt Schwarz — geht das?

→ Im Admin-Bereich ansehen: {ADMIN_URL}/admin/orders/{id}
```

## DSGVO

### Datenschutzseite `/datenschutz`

Statische Next.js-Seite mit:
- Verantwortlicher (MHZ Hachtel GmbH, Kontaktdaten)
- Zweck der Datenverarbeitung (Bearbeitung der Konfigurator-Anfrage)
- Rechtsgrundlage (Art. 6 Abs. 1 lit. b DSGVO — Vertragsanbahnung)
- Speicherdauer (Dauer der Geschäftsbeziehung + gesetzliche Aufbewahrungsfrist)
- Rechte der Betroffenen (Auskunft, Löschung, Berichtigung, Widerspruch)
- Hosting-Info (Vercel, Supabase — Standort EU prüfen)
- Kein Tracking, keine Cookies außer technisch notwendigen

### Einwilligung

- Pflicht-Checkbox: "Ich habe die [Datenschutzerklärung](/datenschutz) gelesen und stimme der Verarbeitung meiner Daten zur Bearbeitung meiner Anfrage zu."
- Zeitpunkt wird als `gdpr_consent_at` in der DB gespeichert
- Ohne Checkbox kein Absenden möglich

## Admin-Ansicht

Bestehende `/admin/orders/[id]`-Seite erweitern:
- Neue Felder anzeigen (Telefon, Firma, Adresse)
- DSGVO-Einwilligung mit Timestamp anzeigen
- Status-Workflow bleibt: submitted → confirmed → completed → cancelled

## Frontend-Änderungen

### ConfiguratorShell — Anfrage-Modal erweitern

Bestehendes Modal (Name, Email, Nachricht) erweitern um:
- Telefon, Firma, Straße, PLZ, Ort
- DSGVO-Checkbox
- Möbel-Bezug (Möbel-ID + Kurzübersicht) fest angezeigt
- Validierung: Name, Email, DSGVO-Checkbox Pflicht

### Erfolgsanzeige nach Absenden

- Auftragsnummer prominent anzeigen
- "Bestätigungs-E-Mail wurde gesendet" (oder "E-Mail-Versand nicht verfügbar" wenn SMTP fehlt)
- Optional: PDF-Download der Anfrage-Zusammenfassung

## Technische Umsetzung

### Neue Dependency

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

### Neue Dateien

| Datei | Zweck |
|-------|-------|
| `src/lib/mail.ts` | SMTP-Client + sendMail-Hilfsfunktion |
| `src/lib/mail-templates.ts` | HTML-Templates für Bestätigung + Admin-Benachrichtigung |
| `src/app/datenschutz/page.tsx` | Datenschutzerklärung (statische Seite) |
| `supabase/migrations/006_order_address_fields.sql` | ALTER TABLE für neue Spalten |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/app/api/orders/route.ts` | Neue Felder entgegennehmen + speichern + Mail senden |
| `src/features/configurator/ConfiguratorShell.tsx` | Formular erweitern |
| `src/app/admin/orders/[id]/page.tsx` | Neue Felder anzeigen |
| `src/core/types.ts` | OrderRequest-Typ erweitern |

### Env-Vars (`.env.local`)

```env
# SMTP — E-Mail-Versand (optional, ohne → kein Mailversand)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=info@artmodul.com
SMTP_PASSWORD=xxx
SMTP_FROM=info@artmodul.com
```

## Nicht im Scope

- Händler-Login / Händler-Bestellflow (Phase 4.1)
- Online-Bezahlung
- SAP-Anbindung
- Tracking-Seite für Kunden (ggf. später)
- Automatische Auftragsbestätigung (MHZ meldet sich manuell)
