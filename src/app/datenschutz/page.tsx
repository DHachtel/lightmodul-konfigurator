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
        Sindelfinger Straße 21<br />
        70771 Leinfelden-Echterdingen<br />
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
        <p>Der Artmodul Konfigurator verwendet keine Tracking-Cookies und keine Analyse-Tools. Es werden ausschließlich technisch notwendige Cookies verwendet:</p>
        <ul>
          <li><strong>Supabase Auth Session (sb-*)</strong> — Authentifizierung (Session-Management nach Login)</li>
          <li><strong>Admin-Session (admin_session)</strong> — Zugang zum internen Admin-Bereich</li>
          <li><strong>Cookie-Hinweis (artmodul_cookie_ok)</strong> — Speichert die Bestätigung des Cookie-Hinweisbanner (localStorage)</li>
        </ul>
        <p>Für technisch notwendige Cookies ist gemäß Art. 5 Abs. 3 ePrivacy-Richtlinie keine Einwilligung erforderlich.</p>
      </Section>

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #E8E5E0', display: 'flex', gap: 24 }}>
        <a href="/impressum" style={{ fontSize: 13, color: '#8A7050' }}>Impressum</a>
      </div>

      <p style={{ fontSize: 12, color: '#B0ABA5', marginTop: 24 }}>Stand: April 2026</p>
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
