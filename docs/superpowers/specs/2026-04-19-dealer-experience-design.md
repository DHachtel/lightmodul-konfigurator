# Dealer-Erlebnis im Konfigurator

**Datum:** 2026-04-19
**Ziel:** Eingeloggte Händler im Konfigurator erkennen und rollenbasierte Features (Preise, Angebots-PDF, User-Menu) freischalten. Konfigurator bleibt offen für alle — Login schaltet nur Dealer-Features frei.

---

## Scope

**Im Scope:**
1. Session-Check beim App-Start (Supabase → Profil → Rolle)
2. User-Menu im Header (Pill mit Rolle/Email/Rabatt/Logout)
3. Preisanzeige im BOM-Panel (EK + UVP Summen, Marge — nur Dealer/Admin)
4. Role-based PDF-Export (Angebots-PDF nur Dealer/Admin)

**Nicht im Scope:** Dealer-Portal (/dealer), Mobile, Logging, SEO, Einzelpreise pro Artikel.

---

## 1. UserContext

**Neue Datei:** `src/contexts/UserContext.tsx`

React Context mit Provider, der on-mount:
1. Supabase-Client aufruft: `supabase.auth.getUser()`
2. Bei vorhandener Session: `profiles`-Tabelle abfragen (role, discount_pct, company)
3. State bereitstellen:

```typescript
interface UserInfo {
  id: string;
  email: string;
  role: 'customer' | 'dealer' | 'admin';
  discountPct: number;
  company: string | null;
}

interface UserContextValue {
  user: UserInfo | null;
  loading: boolean;
  logout: () => Promise<void>;
}
```

- `logout()` ruft `/api/auth/logout` auf, setzt `user` auf `null`, ruft `router.refresh()`
- Provider wird in `ConfiguratorShell` eingebunden (wraps den gesamten Return)
- Kein Polling, kein Refresh-Interval — einmaliger Check beim Mount
- `loading` ist `true` bis der Check abgeschlossen ist (verhindert Flicker)

---

## 2. User-Menu im Header

**Position:** Rechts oben im ConfiguratorShell-Header, ersetzt den bestehenden "Händler-Login"-Link.

**Nicht eingeloggt (user === null, loading === false):**
```
[ Händler-Login → ]
```
Wie bisher — Link zu `/login`.

**Eingeloggt (Dealer):**
```
[ 🟢 Händler · max@firma.de · 30% · Logout ]
```

**Eingeloggt (Admin):**
```
[ 🔵 Admin · admin@artmodul.com · Logout ]
```

**Eingeloggt (Customer):**
```
[ max@example.com · Logout ]
```

- Pill-Style: `bg-white/80 backdrop-blur rounded-full px-3 py-1 text-[11px]`
- Rolle als farbiger Dot (Dealer grün, Admin blau)
- E-Mail gekürzt auf max 20 Zeichen + Ellipsis
- Rabatt-Prozent nur bei Dealer sichtbar
- Logout als Klick-Button innerhalb des Pills
- Während `loading === true`: kein Menu anzeigen (verhindert Flicker zwischen Login-Link und Pill)

---

## 3. Preisanzeige im BOM-Panel

**Preise werden nur als Gesamtsummen angezeigt — keine Einzelpreise pro Artikel.**

### Nicht eingeloggt / Customer (role !== 'dealer' && role !== 'admin'):
- BOM-Tabelle: Pos, Bezeichnung, Menge — kein Preisblock
- Kein Summenblock
- Hinweis-Text: "Preise sind für registrierte Händler sichtbar."

### Dealer:
- BOM-Tabelle: Pos, Bezeichnung, Menge (keine Preisspalte)
- Summenblock unterhalb:

```
Ihr EK netto:          812,40 €
UVP netto:           1.160,60 €
Ihre Marge:            348,20 € (30%)
────────────────────────────────
EK brutto (inkl. 19%): 967,76 €
```

- EK = `pricing.grand_total` (API liefert bereits rabattierten Preis bei Dealer)
- UVP = `pricing.grand_total / (1 - active_discount_pct)` (Rückrechnung aus EK + Rabatt)
- Marge = UVP − EK, Prozent = `active_discount_pct * 100`
- Brutto = EK * (1 + MwSt-Satz)
- MwSt-Satz: EUR → 19%, CHF → 8,1%

### Admin:
- Summenblock:

```
UVP netto:           1.160,60 €
EK netto (30%):        812,40 €
────────────────────────────────
UVP brutto (inkl. 19%): 1.381,11 €
```

- Admin sieht UVP als Hauptpreis (API liefert `price_type: 'UVP'`)
- EK als Referenz: `/api/bom` müsste für Admin optional auch den EK liefern, ODER Frontend rechnet `UVP * (1 - 0.30)` mit einem Standard-Rabatt
- **Entscheidung:** Admin sieht nur UVP-Summe + Brutto. Kein EK-Vergleich (Admin ist kein Händler, braucht keine Marge). Vereinfacht die Logik.

### Admin (vereinfacht):

```
UVP netto:            1.160,60 €
UVP brutto (inkl. 19%): 1.381,11 €
```

---

## 4. Role-based PDF-Export

### Buttons im Header / BOM-Panel:

| Button | Guest/Customer | Dealer | Admin |
|--------|---------------|--------|-------|
| "Datenblatt" (Datasheet-PDF) | sichtbar, ohne Preise | sichtbar, mit EK+UVP Summen | sichtbar, mit UVP |
| "Angebot als PDF" (Multi-Offer) | ausgeblendet | sichtbar | sichtbar |
| XLS-Export | sichtbar (nur Mengen) | sichtbar (nur Mengen) | sichtbar (nur Mengen) |
| "Anfrage senden" | sichtbar | sichtbar | sichtbar |

### Datasheet-PDF Preisblock:

- Datasheet ruft `/api/datasheet` auf mit `includePrice: true/false`
- `includePrice: true` nur wenn `role === 'dealer' || role === 'admin'`
- API prüft serverseitig nochmal die Rolle (Defense in Depth)

### Angebots-PDF:

- Button ruft `/api/offer/multi` auf (wie bisher via CartDrawer)
- API prüft Rolle serverseitig — gibt 403 wenn nicht Dealer/Admin
- Frontend blendet Button nur ein wenn `role === 'dealer' || role === 'admin'`

---

## Betroffene Dateien

| Aktion | Datei | Beschreibung |
|--------|-------|-------------|
| Create | `src/contexts/UserContext.tsx` | UserContext + Provider + useUser Hook |
| Modify | `src/features/configurator/ConfiguratorShell.tsx` | Provider einbinden, Login-Link → User-Pill, PDF-Buttons role-aware |
| Modify | `src/features/bom/BOMPanel.tsx` | Summenblock role-aware (EK+UVP für Dealer, UVP für Admin, nichts für Guest) |
| Modify | `src/features/configurator/CartDrawer.tsx` | "Angebot als PDF"-Button role-aware |

**Keine API-Änderungen nötig** — alle Routen haben bereits serverseitige Rollen-Checks.

---

## Datenfluss

```
App Mount
  → Supabase getUser()
  → profiles.select('role, discount_pct, company')
  → UserContext.user = { email, role, discountPct, company }

BOM-Panel render
  → if (user.role === 'dealer')
      → zeige EK + UVP Summen + Marge
  → if (user.role === 'admin')
      → zeige UVP Summe + Brutto
  → else
      → kein Preisblock

PDF-Button render
  → "Angebot als PDF" visible = (role === 'dealer' || role === 'admin')
  → "Datenblatt" includePrice = (role === 'dealer' || role === 'admin')
```

---

## Edge Cases

- **Session abgelaufen:** Supabase gibt null zurück → User-Menu zeigt Login-Link, Preise ausgeblendet
- **Profil fehlt (race condition):** User existiert in auth.users aber nicht in profiles → behandeln als Customer (role = 'customer', discountPct = 0)
- **discount_pct = 0 bei Dealer:** Marge-Zeile zeigt 0% — kein Crash, aber ungewöhnlich (Admin muss Rabatt setzen)
- **Loading-State:** Während UserContext lädt → kein User-Menu, keine Preise (kein Flicker)
