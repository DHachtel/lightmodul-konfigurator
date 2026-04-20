# Anfrage-Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Endkunden können eine Anfrage mit vollständigen Kontaktdaten + DSGVO-Einwilligung absenden. Browser-Bestätigung + E-Mail an Kunde + E-Mail an MHZ.

**Architecture:** Bestehendes Anfrage-Modal in ConfiguratorShell erweitern (Adressfelder + DSGVO-Checkbox). API-Route `/api/orders` um neue Felder + Mailversand erweitern. Nodemailer für SMTP, graceful fallback wenn SMTP nicht konfiguriert. Datenschutzseite als statische Next.js-Page.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL), Nodemailer (SMTP), TypeScript strict

---

## File Structure

### Neue Dateien

| Datei | Verantwortung |
|-------|---------------|
| `supabase/migrations/006_order_address_fields.sql` | ALTER TABLE: Adressfelder + DSGVO-Timestamp |
| `src/lib/mail.ts` | SMTP-Transport + `sendMail()` Hilfsfunktion (graceful fallback) |
| `src/lib/mail-templates.ts` | HTML-Templates: Kundenbestätigung + Admin-Benachrichtigung |
| `src/app/datenschutz/page.tsx` | Statische Datenschutzerklärung |

### Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/app/api/orders/route.ts` | Neue Felder + DSGVO-Validierung + Mailversand |
| `src/features/configurator/ConfiguratorShell.tsx` | Modal erweitern: Adressfelder + DSGVO + Erfolgsanzeige |
| `src/app/admin/orders/[id]/page.tsx` | Neue Felder anzeigen (Telefon, Firma, Adresse, DSGVO) |
| `src/app/api/admin/orders/[id]/route.ts` | Neue Felder im SELECT |

---

### Task 1: DB-Migration — Adressfelder + DSGVO

**Files:**
- Create: `supabase/migrations/006_order_address_fields.sql`

- [ ] **Step 1: SQL-Migration erstellen**

```sql
-- supabase/migrations/006_order_address_fields.sql
-- Erweitert orders um Kontakt-/Adressfelder und DSGVO-Einwilligung

ALTER TABLE orders ADD COLUMN customer_phone TEXT;
ALTER TABLE orders ADD COLUMN customer_company TEXT;
ALTER TABLE orders ADD COLUMN customer_street TEXT;
ALTER TABLE orders ADD COLUMN customer_zip TEXT;
ALTER TABLE orders ADD COLUMN customer_city TEXT;
ALTER TABLE orders ADD COLUMN gdpr_consent_at TIMESTAMPTZ;
```

- [ ] **Step 2: Migration in Supabase ausführen**

Im Supabase Dashboard → SQL Editor → die Migration einfügen und ausführen.
Alternativ: `npx supabase db push` falls Supabase CLI konfiguriert.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/006_order_address_fields.sql
git commit -m "DB: Adressfelder + DSGVO-Timestamp für orders-Tabelle"
```

---

### Task 2: Nodemailer installieren + Mail-Hilfsfunktion

**Files:**
- Create: `src/lib/mail.ts`

- [ ] **Step 1: Nodemailer installieren**

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

- [ ] **Step 2: Mail-Hilfsfunktion erstellen**

```typescript
// src/lib/mail.ts
import nodemailer from 'nodemailer';

/** Prüft ob SMTP konfiguriert ist */
export function isMailConfigured(): boolean {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

/** Erstellt einen SMTP-Transport (nur aufrufen wenn isMailConfigured() === true) */
function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sendet eine E-Mail via SMTP.
 * Gibt true bei Erfolg zurück, false wenn SMTP nicht konfiguriert oder Fehler.
 * Wirft KEINE Exceptions — Anfrage soll auch ohne Mail gespeichert werden.
 */
export async function sendMail(opts: MailOptions): Promise<boolean> {
  if (!isMailConfigured()) return false;
  try {
    const transport = createTransport();
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return true;
  } catch (err) {
    console.error('[Mail] Versand fehlgeschlagen:', err);
    return false;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/mail.ts package.json package-lock.json
git commit -m "Feature: Nodemailer SMTP-Hilfsfunktion mit graceful Fallback"
```

---

### Task 3: E-Mail-Templates

**Files:**
- Create: `src/lib/mail-templates.ts`

- [ ] **Step 1: Templates erstellen**

```typescript
// src/lib/mail-templates.ts

interface OrderMailData {
  orderNr: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerCompany?: string;
  customerStreet?: string;
  customerZip?: string;
  customerCity?: string;
  note?: string;
  configCodes: number[];
  configSummary: string; // z.B. "2×3, 1160 × 1110 × 390 mm, Schwarz"
  adminUrl: string;
  orderId: string;
}

/** Bestätigungs-Mail an den Kunden */
export function customerConfirmationHtml(data: OrderMailData): { subject: string; html: string } {
  const address = [data.customerStreet, [data.customerZip, data.customerCity].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  return {
    subject: `Ihre Anfrage ${data.orderNr} — Artmodul Konfigurator`,
    html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, Arial, sans-serif; color: #1C1A17; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="font-size: 18px; margin-bottom: 4px;">Artmodul Konfigurator</h2>
  <p style="color: #7A7670; font-size: 13px; margin-top: 0;">Ihre Anfrage wurde erfolgreich übermittelt.</p>
  <hr style="border: none; border-top: 1px solid #EEEBE4; margin: 20px 0;">

  <p>Guten Tag ${data.customerName},</p>
  <p>vielen Dank für Ihre Anfrage über den Artmodul Konfigurator.</p>

  <table style="font-size: 14px; border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670; white-space: nowrap;">Auftragsnummer</td><td style="padding: 6px 0; font-weight: 600;">${data.orderNr}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670; white-space: nowrap;">Möbel-ID</td><td style="padding: 6px 0; font-family: monospace;">${data.configCodes.join(', ')}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670; white-space: nowrap;">Konfiguration</td><td style="padding: 6px 0;">${data.configSummary}</td></tr>
    ${address ? `<tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Adresse</td><td style="padding: 6px 0;">${address}</td></tr>` : ''}
    ${data.note ? `<tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Ihr Kommentar</td><td style="padding: 6px 0;">${data.note}</td></tr>` : ''}
  </table>

  <p>Wir werden uns in Kürze bei Ihnen melden.</p>

  <hr style="border: none; border-top: 1px solid #EEEBE4; margin: 20px 0;">
  <p style="font-size: 12px; color: #7A7670;">
    Mit freundlichen Grüßen<br>
    Ihr Artmodul-Team<br><br>
    MHZ Hachtel GmbH<br>
    info@artmodul.com
  </p>
</body></html>`,
  };
}

/** Benachrichtigungs-Mail an MHZ (info@artmodul.com) */
export function adminNotificationHtml(data: OrderMailData): { subject: string; html: string } {
  const address = [data.customerStreet, [data.customerZip, data.customerCity].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  return {
    subject: `[Konfigurator] Neue Anfrage ${data.orderNr}`,
    html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, Arial, sans-serif; color: #1C1A17; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="font-size: 16px;">Neue Konfigurator-Anfrage</h2>

  <table style="font-size: 14px; border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670; width: 120px;">Auftragsnr.</td><td style="padding: 6px 0; font-weight: 600;">${data.orderNr}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Kunde</td><td style="padding: 6px 0;">${data.customerName}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">E-Mail</td><td style="padding: 6px 0;"><a href="mailto:${data.customerEmail}">${data.customerEmail}</a></td></tr>
    ${data.customerPhone ? `<tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Telefon</td><td style="padding: 6px 0;">${data.customerPhone}</td></tr>` : ''}
    ${data.customerCompany ? `<tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Firma</td><td style="padding: 6px 0;">${data.customerCompany}</td></tr>` : ''}
    ${address ? `<tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Adresse</td><td style="padding: 6px 0;">${address}</td></tr>` : ''}
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Möbel-ID</td><td style="padding: 6px 0; font-family: monospace;">${data.configCodes.join(', ')}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Konfiguration</td><td style="padding: 6px 0;">${data.configSummary}</td></tr>
    ${data.note ? `<tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Kommentar</td><td style="padding: 6px 0;">${data.note}</td></tr>` : ''}
  </table>

  <p style="margin-top: 20px;">
    <a href="${data.adminUrl}/admin/orders/${data.orderId}" style="background: #1C1A17; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 13px;">Im Admin-Bereich ansehen</a>
  </p>
</body></html>`,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/mail-templates.ts
git commit -m "Feature: E-Mail-Templates für Kundenbestätigung + Admin-Benachrichtigung"
```

---

### Task 4: API-Route `/api/orders` erweitern

**Files:**
- Modify: `src/app/api/orders/route.ts`

- [ ] **Step 1: Route um neue Felder + DSGVO-Validierung + Mailversand erweitern**

Ersetze den gesamten Inhalt von `src/app/api/orders/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { sendMail } from '@/lib/mail';
import { customerConfirmationHtml, adminNotificationHtml } from '@/lib/mail-templates';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      configCodes: number[];
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      customerCompany?: string;
      customerStreet?: string;
      customerZip?: string;
      customerCity?: string;
      note?: string;
      currency?: string;
      gdprConsent?: boolean;
      configSummary?: string;
    };

    // Validierung
    if (!body.configCodes || body.configCodes.length === 0) {
      return NextResponse.json({ error: 'Keine Konfigurationen angegeben' }, { status: 400 });
    }
    if (!body.customerName?.trim()) {
      return NextResponse.json({ error: 'Name ist erforderlich' }, { status: 400 });
    }
    if (!body.customerEmail?.trim()) {
      return NextResponse.json({ error: 'E-Mail ist erforderlich' }, { status: 400 });
    }
    if (!body.gdprConsent) {
      return NextResponse.json({ error: 'Datenschutz-Einwilligung erforderlich' }, { status: 400 });
    }

    const sb = createServiceSupabaseClient();

    // Order erstellen (order_nr wird per DB-Trigger generiert)
    const { data: order, error: orderErr } = await sb
      .from('orders')
      .insert({
        order_nr: '', // Trigger überschreibt
        status: 'submitted',
        customer_name: body.customerName.trim(),
        customer_email: body.customerEmail.trim(),
        customer_phone: body.customerPhone?.trim() || null,
        customer_company: body.customerCompany?.trim() || null,
        customer_street: body.customerStreet?.trim() || null,
        customer_zip: body.customerZip?.trim() || null,
        customer_city: body.customerCity?.trim() || null,
        note: body.note?.trim() || null,
        gdpr_consent_at: new Date().toISOString(),
      })
      .select('id, order_nr')
      .single();

    if (orderErr || !order) {
      console.error('Order error:', orderErr);
      return NextResponse.json({ error: 'Auftrag konnte nicht erstellt werden' }, { status: 500 });
    }

    // Positionen einfügen
    const items = body.configCodes.map(code => ({
      order_id: order.id,
      config_code: code,
      quantity: 1,
      currency: body.currency ?? 'EUR',
    }));

    const { error: itemsErr } = await sb.from('order_items').insert(items);
    if (itemsErr) {
      console.error('Items error:', itemsErr);
      return NextResponse.json({ error: 'Positionen konnten nicht gespeichert werden' }, { status: 500 });
    }

    // E-Mails senden (non-blocking — Fehler verhindert nicht die Antwort)
    const mailData = {
      orderNr: order.order_nr,
      orderId: order.id,
      customerName: body.customerName.trim(),
      customerEmail: body.customerEmail.trim(),
      customerPhone: body.customerPhone?.trim(),
      customerCompany: body.customerCompany?.trim(),
      customerStreet: body.customerStreet?.trim(),
      customerZip: body.customerZip?.trim(),
      customerCity: body.customerCity?.trim(),
      note: body.note?.trim(),
      configCodes: body.configCodes,
      configSummary: body.configSummary ?? `Möbel ${body.configCodes.join(', ')}`,
      adminUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    };

    // Bestätigung an Kunden
    const customerMail = customerConfirmationHtml(mailData);
    const customerSent = await sendMail({
      to: mailData.customerEmail,
      subject: customerMail.subject,
      html: customerMail.html,
    });

    // Benachrichtigung an MHZ
    const adminMail = adminNotificationHtml(mailData);
    const adminSent = await sendMail({
      to: 'info@artmodul.com',
      subject: adminMail.subject,
      html: adminMail.html,
    });

    return NextResponse.json({
      orderNr: order.order_nr,
      mailSent: customerSent && adminSent,
    });
  } catch (e) {
    console.error('Order error:', e);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
```

- [ ] **Step 2: tsc prüfen**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/orders/route.ts
git commit -m "Feature: Orders API mit Adressfeldern + DSGVO + E-Mail-Versand"
```

---

### Task 5: Anfrage-Modal in ConfiguratorShell erweitern

**Files:**
- Modify: `src/features/configurator/ConfiguratorShell.tsx`

- [ ] **Step 1: State-Variablen für neue Felder hinzufügen**

Finde den Block mit `orderName`, `orderEmail`, `orderNote` (ca. Zeile 98-103) und ersetze durch:

```typescript
  // ── Anfrage senden ──
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderName, setOrderName] = useState('');
  const [orderEmail, setOrderEmail] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderCompany, setOrderCompany] = useState('');
  const [orderStreet, setOrderStreet] = useState('');
  const [orderZip, setOrderZip] = useState('');
  const [orderCity, setOrderCity] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [orderGdpr, setOrderGdpr] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState('');
  const [orderMailSent, setOrderMailSent] = useState(false);
```

- [ ] **Step 2: handleOrderSubmit erweitern**

Ersetze die bestehende `handleOrderSubmit`-Funktion (ca. Zeile 117-144):

```typescript
  const handleOrderSubmit = useCallback(async () => {
    if (!actions.moebelId) return;
    if (!orderName.trim() || !orderEmail.trim()) {
      alert('Name und E-Mail sind Pflichtfelder.');
      return;
    }
    if (!orderGdpr) {
      alert('Bitte stimmen Sie der Datenschutzerklärung zu.');
      return;
    }
    setOrderLoading(true);
    try {
      // Konfigurations-Zusammenfassung für E-Mail
      const totalW = state.cols.reduce((a, b) => a + b, 0) + 30;
      const totalH = state.rows.reduce((a, b) => a + b, 0) + 30;
      const configSummary = `${state.cols.length}×${state.rows.length}, ${totalW} × ${totalH} × ${state.depth + 30} mm`;

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configCodes: [actions.moebelId],
          customerName: orderName,
          customerEmail: orderEmail,
          customerPhone: orderPhone || undefined,
          customerCompany: orderCompany || undefined,
          customerStreet: orderStreet || undefined,
          customerZip: orderZip || undefined,
          customerCity: orderCity || undefined,
          note: orderNote || undefined,
          currency,
          gdprConsent: true,
          configSummary,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        alert(err.error ?? 'Anfrage fehlgeschlagen');
        return;
      }
      const data = await res.json() as { orderNr: string; mailSent?: boolean };
      setOrderSuccess(data.orderNr);
      setOrderMailSent(data.mailSent ?? false);
      setShowOrderModal(false);
      // Felder zurücksetzen
      setOrderName(''); setOrderEmail(''); setOrderPhone('');
      setOrderCompany(''); setOrderStreet(''); setOrderZip('');
      setOrderCity(''); setOrderNote(''); setOrderGdpr(false);
    } catch {
      alert('Anfrage fehlgeschlagen');
    } finally {
      setOrderLoading(false);
    }
  }, [actions.moebelId, orderName, orderEmail, orderPhone, orderCompany, orderStreet, orderZip, orderCity, orderNote, orderGdpr, currency, state.cols, state.rows, state.depth]);
```

- [ ] **Step 3: Modal-JSX erweitern**

Finde das bestehende Anfrage-Modal im JSX (suche nach `showOrderModal`) und ersetze es mit dem erweiterten Formular. Das neue Modal enthält:
- Möbel-Info (ID + Maße) oben fest angezeigt
- Name*, E-Mail*, Telefon, Firma
- Straße, PLZ + Ort (in einer Zeile)
- Kommentar (textarea)
- DSGVO-Checkbox mit Link zu `/datenschutz`
- Absenden-Button (disabled wenn Pflichtfelder fehlen)

Suche den Modal-Block und ersetze ihn. Der exakte Code hängt vom bestehenden Modal-Layout ab — passe das Styling an den bestehenden ConfiguratorShell-Stil an (Tailwind, gleiche Farbwerte wie die anderen Modals).

- [ ] **Step 4: Erfolgsanzeige nach Absenden anpassen**

Finde die Stelle wo `orderSuccess` angezeigt wird und erweitere sie:

```tsx
{orderSuccess && (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,0,0.3)',
  }}
  onClick={() => setOrderSuccess('')}
  >
    <div
      style={{
        background: '#fff', borderRadius: 12, padding: '32px 40px',
        maxWidth: 420, textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1A17', marginBottom: 4 }}>
        Anfrage erfolgreich gesendet
      </div>
      <div style={{ fontSize: 22, fontFamily: 'monospace', fontWeight: 700, color: '#8A7050', margin: '12px 0' }}>
        {orderSuccess}
      </div>
      <div style={{ fontSize: 13, color: '#7A7670', marginBottom: 16 }}>
        {orderMailSent
          ? 'Eine Bestätigungs-E-Mail wurde an Sie gesendet.'
          : 'Ihre Anfrage wurde gespeichert.'}
      </div>
      <button
        onClick={() => setOrderSuccess('')}
        style={{
          padding: '8px 24px', borderRadius: 8, border: 'none',
          background: '#1C1A17', color: '#fff', fontSize: 13, cursor: 'pointer',
        }}
      >
        Schließen
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 5: tsc + eslint prüfen**

```bash
npx tsc --noEmit
npx eslint src/features/configurator/ConfiguratorShell.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/features/configurator/ConfiguratorShell.tsx
git commit -m "Feature: Anfrage-Modal mit Adressfeldern + DSGVO-Checkbox + Erfolgsanzeige"
```

---

### Task 6: Datenschutzseite

**Files:**
- Create: `src/app/datenschutz/page.tsx`

- [ ] **Step 1: Datenschutzseite erstellen**

```tsx
// src/app/datenschutz/page.tsx

export const metadata = {
  title: 'Datenschutzerklärung — Artmodul Konfigurator',
};

export default function DatenschutzPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', fontFamily: '-apple-system, Arial, sans-serif', color: '#1C1A17', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Datenschutzerklärung</h1>
      <p style={{ fontSize: 13, color: '#7A7670', marginBottom: 32 }}>Artmodul Konfigurator — MHZ Hachtel GmbH</p>

      <Section title="1. Verantwortlicher">
        <p>MHZ Hachtel GmbH<br />
        Horber Straße 2<br />
        72221 Haiterbach-Beihingen<br />
        E-Mail: info@artmodul.com</p>
      </Section>

      <Section title="2. Zweck der Datenverarbeitung">
        <p>Wir verarbeiten Ihre personenbezogenen Daten ausschließlich zur Bearbeitung Ihrer Anfrage über den Artmodul Konfigurator. Dies umfasst:</p>
        <ul>
          <li>Entgegennahme und Speicherung Ihrer Kontaktdaten und Möbelkonfiguration</li>
          <li>Zusendung einer Bestätigungs-E-Mail</li>
          <li>Kontaktaufnahme zur Bearbeitung Ihrer Anfrage</li>
        </ul>
      </Section>

      <Section title="3. Rechtsgrundlage">
        <p>Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung) sowie Ihrer Einwilligung gemäß Art. 6 Abs. 1 lit. a DSGVO.</p>
      </Section>

      <Section title="4. Erhobene Daten">
        <p>Im Rahmen der Anfrage werden folgende Daten erhoben:</p>
        <ul>
          <li>Name, E-Mail-Adresse</li>
          <li>Telefonnummer, Firma (optional)</li>
          <li>Anschrift (optional)</li>
          <li>Möbelkonfiguration (Maße, Oberflächen, Stückliste)</li>
          <li>Freitext-Kommentar (optional)</li>
          <li>Zeitpunkt der Datenschutz-Einwilligung</li>
        </ul>
      </Section>

      <Section title="5. Speicherdauer">
        <p>Ihre Daten werden für die Dauer der Geschäftsbeziehung und darüber hinaus gemäß den gesetzlichen Aufbewahrungsfristen (bis zu 10 Jahre nach HGB/AO) gespeichert.</p>
      </Section>

      <Section title="6. Empfänger der Daten">
        <p>Ihre Daten werden nicht an Dritte weitergegeben, außer:</p>
        <ul>
          <li>Hosting: Vercel Inc. (Webseite) und Supabase Inc. (Datenbank) — jeweils auf Basis von Standardvertragsklauseln bzw. EU-Serverstandort</li>
          <li>E-Mail-Versand über den Mailserver der MHZ Hachtel GmbH</li>
        </ul>
      </Section>

      <Section title="7. Ihre Rechte">
        <p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Kontaktieren Sie uns dazu unter info@artmodul.com.</p>
        <p>Sie haben das Recht, Ihre Einwilligung jederzeit zu widerrufen. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt davon unberührt.</p>
        <p>Sie haben das Recht, sich bei einer Aufsichtsbehörde zu beschweren.</p>
      </Section>

      <Section title="8. Cookies und Tracking">
        <p>Der Artmodul Konfigurator verwendet keine Tracking-Cookies und keine Analyse-Tools. Es werden ausschließlich technisch notwendige Cookies verwendet (Session-Management).</p>
      </Section>

      <p style={{ fontSize: 12, color: '#B0ABA5', marginTop: 40 }}>Stand: April 2026</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
      <div style={{ fontSize: 14 }}>{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: tsc prüfen**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/datenschutz/page.tsx
git commit -m "Feature: Datenschutzerklärung Seite (/datenschutz)"
```

---

### Task 7: Admin-Auftragsdetail erweitern

**Files:**
- Modify: `src/app/admin/orders/[id]/page.tsx`
- Modify: `src/app/api/admin/orders/[id]/route.ts`

- [ ] **Step 1: API-Route — neue Felder im SELECT**

In `src/app/api/admin/orders/[id]/route.ts`: prüfe dass der SELECT-Query alle Spalten der orders-Tabelle zurückgibt (inkl. `customer_phone`, `customer_company`, `customer_street`, `customer_zip`, `customer_city`, `gdpr_consent_at`). Falls der Query `select('*')` nutzt, ist nichts zu tun. Falls einzelne Spalten selektiert werden, die neuen hinzufügen.

- [ ] **Step 2: Order-Interface erweitern**

In `src/app/admin/orders/[id]/page.tsx`, erweitere das `Order`-Interface:

```typescript
interface Order {
  id: string;
  order_nr: string;
  status: OrderStatus;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  customer_street: string | null;
  customer_zip: string | null;
  customer_city: string | null;
  gdpr_consent_at: string | null;
  created_at: string;
  status_changed_at: string | null;
  note: string | null;
  order_items: OrderItem[];
}
```

- [ ] **Step 3: Kundendaten-Karte erweitern**

Ersetze den bestehenden Kundendaten-Block (ca. Zeile 188-198) durch:

```tsx
        <div className="bg-white rounded-xl border border-[#EEEBE4] p-5">
          <h2 className="text-xs font-medium text-[#7A7670] uppercase tracking-wide mb-3">Kunde</h2>
          <div className="space-y-1.5 text-sm">
            <div className="font-medium text-[#1C1A17]">
              {order.customer_name ?? <span className="text-[#7A7670] font-normal">Kein Name</span>}
            </div>
            <div className="text-[#7A7670]">{order.customer_email ?? '—'}</div>
            {order.customer_phone && <div className="text-[#7A7670]">Tel: {order.customer_phone}</div>}
            {order.customer_company && <div className="text-[#3A3834]">{order.customer_company}</div>}
            {(order.customer_street || order.customer_zip || order.customer_city) && (
              <div className="text-[#7A7670] text-xs mt-2">
                {order.customer_street && <>{order.customer_street}<br /></>}
                {[order.customer_zip, order.customer_city].filter(Boolean).join(' ')}
              </div>
            )}
            {order.gdpr_consent_at && (
              <div className="text-xs text-green-600 mt-2">
                DSGVO-Einwilligung: {formatDateTime(order.gdpr_consent_at)}
              </div>
            )}
          </div>
        </div>
```

- [ ] **Step 4: tsc + eslint prüfen**

```bash
npx tsc --noEmit
npx eslint src/app/admin/orders/[id]/page.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/orders/[id]/page.tsx src/app/api/admin/orders/[id]/route.ts
git commit -m "Feature: Admin-Auftragsdetail zeigt Adresse + DSGVO-Einwilligung"
```

---

### Task 8: Env-Vars vorbereiten + Abschluss

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: SMTP-Platzhalter in .env.local eintragen**

```env
# SMTP — E-Mail-Versand (optional, ohne → kein Mailversand)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=info@artmodul.com
# SMTP_PASSWORD=xxx
# SMTP_FROM=info@artmodul.com
```

Auskommentiert, damit der Konfigurator auch ohne SMTP funktioniert.

- [ ] **Step 2: Gesamttest**

```bash
npx tsc --noEmit
npx eslint src/
```

- [ ] **Step 3: Push**

```bash
git push
```
