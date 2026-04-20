import { NextRequest, NextResponse } from 'next/server';
import { createServiceSupabaseClient } from '@/lib/supabase/server';
import { sendMail } from '@/lib/mail';
import { customerConfirmationHtml, adminNotificationHtml } from '@/lib/mail-templates';
import { OrderRequestSchema, formatZodError } from '@/core/schemas';

export async function POST(req: NextRequest) {
  // ── Request parsen & validieren ─────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ungueltiger Request-Body' }, { status: 400 });
  }

  const parsed = OrderRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const body = parsed.data;

  try {
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
      console.error('[/api/orders] DB-Fehler (order insert):', orderErr?.code, orderErr?.message);
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
      console.error('[/api/orders] DB-Fehler (items insert):', itemsErr?.code, itemsErr?.message);
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
    console.error('[/api/orders] Unerwarteter Fehler:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
