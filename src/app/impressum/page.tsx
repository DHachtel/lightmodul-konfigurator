export const metadata = {
  title: 'Impressum — Lightmodul Konfigurator',
};

export default function ImpressumPage() {
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px', fontFamily: '-apple-system, Arial, sans-serif', color: '#1C1A17', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Impressum</h1>
      <p style={{ fontSize: 13, color: '#7A7670', marginBottom: 32 }}>Angaben gemäß § 5 TMG</p>

      <Section title="Anbieter">
        <p>
          MHZ Hachtel GmbH & Co. KG<br />
          Sindelfinger Straße 21<br />
          70771 Leinfelden-Echterdingen<br />
          Deutschland
        </p>
      </Section>

      <Section title="Vertretungsberechtigte Geschäftsführer">
        <p>Marc Horn, Andreas Kopetschny</p>
      </Section>

      <Section title="Kontakt">
        <p>
          E-Mail: info@artmodul.com<br />
          Telefon: +49 (0) 711 / 975 119 00
        </p>
      </Section>

      <Section title="Handelsregister">
        <p>
          Registergericht: Amtsgericht Stuttgart<br />
          Registernummer: HRB 769054
        </p>
      </Section>

      <Section title="Umsatzsteuer-Identifikationsnummer">
        <p>DE 325046963</p>
      </Section>

      <Section title="Verantwortlich für den Inhalt gem. § 55 Abs. 2 RStV">
        <p>
          Marc Horn, Andreas Kopetschny<br />
          MHZ Hachtel GmbH &amp; Co. KG<br />
          Sindelfinger Straße 21<br />
          70771 Leinfelden-Echterdingen<br />
          Deutschland
        </p>
      </Section>

      <Section title="Streitschlichtung">
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
          <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" style={{ color: '#8A7050' }}>
            https://ec.europa.eu/consumers/odr/
          </a>
        </p>
        <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      </Section>

      <Section title="Haftung für Inhalte">
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.
          Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen
          oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        </p>
      </Section>

      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #E8E5E0', display: 'flex', gap: 24 }}>
        <a href="/datenschutz" style={{ fontSize: 13, color: '#8A7050' }}>Datenschutzerklärung</a>
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
