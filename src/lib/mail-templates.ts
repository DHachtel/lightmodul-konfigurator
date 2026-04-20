// src/lib/mail-templates.ts

/** HTML-Escaping gegen XSS in E-Mail-Templates */
function esc(s: string | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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
  configSummary: string;
  adminUrl: string;
  orderId: string;
}

/** Bestätigungs-Mail an den Kunden */
export function customerConfirmationHtml(data: OrderMailData): { subject: string; html: string } {
  const address = esc([data.customerStreet, [data.customerZip, data.customerCity].filter(Boolean).join(' ')].filter(Boolean).join(', '));

  return {
    subject: `Ihre Anfrage ${esc(data.orderNr)} — Lightmodul Konfigurator`,
    html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, Arial, sans-serif; color: #1C1A17; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="font-size: 18px; margin-bottom: 4px;">Lightmodul Konfigurator</h2>
  <p style="color: #7A7670; font-size: 13px; margin-top: 0;">Ihre Anfrage wurde erfolgreich übermittelt.</p>
  <hr style="border: none; border-top: 1px solid #EEEBE4; margin: 20px 0;">

  <p>Guten Tag ${esc(data.customerName)},</p>
  <p>vielen Dank für Ihre Anfrage über den Lightmodul Konfigurator.</p>

  <table style="font-size: 14px; border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670; white-space: nowrap;">Auftragsnummer</td><td style="padding: 6px 0; font-weight: 600;">${esc(data.orderNr)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670; white-space: nowrap;">Möbel-ID</td><td style="padding: 6px 0; font-family: monospace;">${data.configCodes.join(', ')}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670; white-space: nowrap;">Konfiguration</td><td style="padding: 6px 0;">${esc(data.configSummary)}</td></tr>
    ${address ? `<tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Adresse</td><td style="padding: 6px 0;">${address}</td></tr>` : ''}
    ${data.note ? `<tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Ihr Kommentar</td><td style="padding: 6px 0;">${esc(data.note)}</td></tr>` : ''}
  </table>

  <p>Wir werden uns in Kürze bei Ihnen melden.</p>

  <hr style="border: none; border-top: 1px solid #EEEBE4; margin: 20px 0;">
  <p style="font-size: 12px; color: #7A7670;">
    Mit freundlichen Grüßen<br>
    Ihr Lightmodul-Team<br><br>
    MHZ Hachtel GmbH<br>
    info@artmodul.com
  </p>
</body></html>`,
  };
}

/** Benachrichtigungs-Mail an MHZ (info@artmodul.com) */
export function adminNotificationHtml(data: OrderMailData): { subject: string; html: string } {
  const address = esc([data.customerStreet, [data.customerZip, data.customerCity].filter(Boolean).join(' ')].filter(Boolean).join(', '));

  return {
    subject: `[Konfigurator] Neue Anfrage ${esc(data.orderNr)}`,
    html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, Arial, sans-serif; color: #1C1A17; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="font-size: 16px;">Neue Konfigurator-Anfrage</h2>

  <table style="font-size: 14px; border-collapse: collapse; width: 100%; margin: 16px 0;">
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670; width: 120px;">Auftragsnr.</td><td style="padding: 6px 0; font-weight: 600;">${esc(data.orderNr)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Kunde</td><td style="padding: 6px 0;">${esc(data.customerName)}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">E-Mail</td><td style="padding: 6px 0;"><a href="mailto:${esc(data.customerEmail)}">${esc(data.customerEmail)}</a></td></tr>
    ${data.customerPhone ? `<tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Telefon</td><td style="padding: 6px 0;">${esc(data.customerPhone)}</td></tr>` : ''}
    ${data.customerCompany ? `<tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Firma</td><td style="padding: 6px 0;">${esc(data.customerCompany)}</td></tr>` : ''}
    ${address ? `<tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Adresse</td><td style="padding: 6px 0;">${address}</td></tr>` : ''}
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Möbel-ID</td><td style="padding: 6px 0; font-family: monospace;">${data.configCodes.join(', ')}</td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Konfiguration</td><td style="padding: 6px 0;">${esc(data.configSummary)}</td></tr>
    ${data.note ? `<tr><td style="padding: 6px 12px 6px 0; color: #7A7670;">Kommentar</td><td style="padding: 6px 0;">${esc(data.note)}</td></tr>` : ''}
  </table>

  <p style="margin-top: 20px;">
    <a href="${esc(data.adminUrl)}/admin/orders/${esc(data.orderId)}" style="background: #1C1A17; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 13px;">Im Admin-Bereich ansehen</a>
  </p>
</body></html>`,
  };
}
