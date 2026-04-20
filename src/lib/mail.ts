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
    // Nur Fehlercode/-typ loggen — keine Empfängeradresse oder Mail-Inhalt
    console.error('[Mail] Versand fehlgeschlagen:', err instanceof Error ? err.message : 'Unbekannter Fehler');
    return false;
  }
}
