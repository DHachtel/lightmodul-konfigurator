# Kundenverwaltung im Admin-Bereich

**Datum:** 2026-04-19
**Ziel:** Admin kann alle registrierten Nutzer verwalten — Stammdaten pflegen, Rolle/Rabatt setzen, Kunden durchsuchen. Ersetzt die bisherige minimale Händlerverwaltung.

---

## Scope

**Im Scope:**
1. DB-Migration: Profilfelder erweitern (Ansprechpartner, Adresse, Telefon, Notizen)
2. Admin-Sidebar: "Kunden"-Link ergänzen
3. Kundenliste `/admin/customers` (paginiert, filterbar, suchbar)
4. Kunden-Detailseite `/admin/customers/[id]` (Formular mit allen Feldern)
5. API-Routen für CRUD
6. Bisherige `/admin/dealers` durch `/admin/customers` ersetzen

**Nicht im Scope:** Händler-Self-Service, verknüpfte Aufträge in Detailseite, Kunden-Import/Export.

---

## 1. DB-Migration — `profiles` erweitern

Neue Spalten in `profiles` (alle nullable):

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS zip TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'DE';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notes TEXT;
```

Migration-Datei: `supabase/migrations/008_profile_fields.sql`

Muss im Supabase SQL-Editor ausgeführt werden (kein lokales CLI-Setup).

---

## 2. Admin-Sidebar — "Kunden" ergänzen

In `src/app/admin/layout.tsx` neuer Menüpunkt zwischen "Aufträge" und "Konfigurationen":

```
Dashboard
Aufträge
Kunden          ← NEU
Konfigurationen
Preisliste
Artikelstamm
```

Link: `/admin/customers`

---

## 3. Kundenliste `/admin/customers`

**Neue Datei:** `src/app/admin/customers/page.tsx`

### Tabelle

| Firma | Ansprechpartner | E-Mail | Rolle | Rabatt | Registriert |
|---|---|---|---|---|---|

- Rolle als farbiger Badge (Händler grün, Customer grau, Admin blau)
- Rabatt nur bei Dealer angezeigt (z.B. "30%")
- Klick auf Zeile → `/admin/customers/[id]`

### Filter + Suche

- Rollenfilter oben: Alle / Händler / Customer (Buttons, wie Status-Filter bei Aufträgen)
- Suchfeld: durchsucht Firma, Ansprechpartner, E-Mail (serverseitig, ILIKE)
- Paginierung: 20 pro Seite

### API

`GET /api/admin/customers?page=1&limit=20&role=dealer&search=firma`

Response:
```typescript
{
  profiles: Array<{
    id: string;
    email: string;
    role: string;
    company: string | null;
    contact_name: string | null;
    phone: string | null;
    street: string | null;
    zip: string | null;
    city: string | null;
    country: string | null;
    discount_pct: number;
    approved_at: string | null;
    created_at: string;
    notes: string | null;
  }>;
  total: number;
}
```

E-Mail kommt aus `supabase.auth.admin.listUsers()` (wie bisher in `/api/admin/dealers`).

---

## 4. Kunden-Detailseite `/admin/customers/[id]`

**Neue Datei:** `src/app/admin/customers/[id]/page.tsx`

### Layout

Formular in Sektionen, ähnlich dem Stil der bestehenden Admin-Detailseiten:

**Sektion "Konto":**
- E-Mail — read-only (aus auth)
- Rolle — Dropdown (`customer` / `dealer` / `admin`)
- Rabatt — Eingabefeld (0–100%), nur sichtbar wenn Rolle = `dealer`
- Registriert am — read-only, formatiert
- Freigeschaltet am — read-only, nur bei Dealer

**Sektion "Stammdaten":**
- Firma — Text-Input
- Ansprechpartner — Text-Input
- Telefon — Text-Input
- Straße — Text-Input
- PLZ + Ort — zwei Inputs nebeneinander (PLZ schmal, Ort breit)
- Land — Text-Input (Default: DE)

**Sektion "Intern":**
- Notizen — Textarea (3 Zeilen)

**Footer:**
- "Speichern"-Button (primär, schwarz)
- Erfolgsmeldung nach Speichern ("Änderungen gespeichert")

### Rollenlogik beim Speichern

- Rolle von `customer` → `dealer`: setzt `approved_at = NOW()`, `discount_pct` auf eingegebenen Wert (Default 30%)
- Rolle von `dealer` → `customer`: setzt `approved_at = NULL`, `discount_pct = 0`
- Rabatt-Änderung: nur `discount_pct` updaten

### API

`GET /api/admin/customers/[id]` — einzelnes Profil + E-Mail aus auth

`PATCH /api/admin/customers/[id]` — Body:
```typescript
{
  role?: 'customer' | 'dealer' | 'admin';
  discount_pct?: number;
  company?: string;
  contact_name?: string;
  phone?: string;
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
  notes?: string;
}
```

Setzt `approved_at` automatisch wenn `role` auf `dealer` wechselt.

---

## 5. Aufräumen

- `src/app/admin/dealers/page.tsx` — löschen (ersetzt durch `/admin/customers`)
- `src/app/api/admin/dealers/route.ts` — löschen
- `src/app/api/admin/dealers/[id]/route.ts` — löschen
- Sidebar-Link "Dealers" entfernen (falls vorhanden)

---

## Betroffene Dateien

| Aktion | Datei | Beschreibung |
|--------|-------|-------------|
| Create | `supabase/migrations/008_profile_fields.sql` | Neue Spalten |
| Create | `src/app/admin/customers/page.tsx` | Kundenliste |
| Create | `src/app/admin/customers/[id]/page.tsx` | Kunden-Detail |
| Create | `src/app/api/admin/customers/route.ts` | GET Liste |
| Create | `src/app/api/admin/customers/[id]/route.ts` | GET + PATCH Einzelkunde |
| Modify | `src/app/admin/layout.tsx` | Sidebar: "Kunden" Link |
| Delete | `src/app/admin/dealers/page.tsx` | Ersetzt durch customers |
| Delete | `src/app/api/admin/dealers/route.ts` | Ersetzt durch customers |
| Delete | `src/app/api/admin/dealers/[id]/route.ts` | Ersetzt durch customers |

---

## Edge Cases

- **Profil ohne auth-User:** Sollte nicht vorkommen (Trigger erstellt Profil bei Registrierung). Falls doch: Zeile in Liste zeigen mit "E-Mail unbekannt".
- **Admin ändert eigene Rolle:** Erlaubt — kein Self-Lock-Out-Schutz nötig (Admin-Login ist separates HTTP Basic Auth).
- **discount_pct bei Customer:** Wird auf 0 gesetzt, Feld in Detailseite ausgeblendet wenn Rolle ≠ dealer.
- **Leere Suche:** Zeigt alle Kunden (kein Filter).
