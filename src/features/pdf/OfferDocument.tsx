// TODO: Für Lightmodul neu schreiben — noch Lightmodul-Layout
import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Rect,
  G,
  StyleSheet,
} from '@react-pdf/renderer';
import type { BOMResult, ConfigState, PriceResponse } from '@/core/types';
import { FOOTER_BY_V, HANDLE_BY_V, MAT_BY_V } from '@/core/constants';

// ── Farbgebung Zelltypen ───────────────────────────────────────────────────────

const CELL_FILL: Record<string, string> = {
  '':   '#f0ede6',
  'O':  '#e8e5df',
  'K':  '#c8dff4',
  'S':  '#c8f4d8',
  'TR': '#f4c8e4',
  'TL': '#f4c8e4',
  'DT': '#f4d8c8',
};

const CELL_STROKE = '#b8b4ac';

// ── Kategoriereihenfolge für Preistabelle ─────────────────────────────────────

const KAT_ORDER = [
  'Würfel 30mm', 'Profil',
  'Boden', 'Klappenboden', 'Rücken',
  'Seite außen', 'Seite außen SY32', 'Seite innen', 'Seite innen SY32',
  'Fachboden klein',
  'Klappe', 'Schublade', 'Tür', 'Doppeltür',
  'Griff', 'Füße / Rollen',
];

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#1c1a17',
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#c4ae8c',
  },
  logoBox: {
    width: 80,
    height: 36,
    border: '1pt solid #dddad3',
    backgroundColor: '#f8f6f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 7,
    color: '#a8a49c',
    fontFamily: 'Helvetica',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  docTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    color: '#1c1a17',
    letterSpacing: 0.5,
  },
  docMeta: {
    fontSize: 7,
    color: '#7a7670',
    marginTop: 3,
  },

  // Abschnitt-Titel
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#a8a49c',
    marginBottom: 6,
    marginTop: 14,
  },

  // Konfigurations-Zusammenfassung
  configRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  configKV: {
    flexDirection: 'row',
    gap: 4,
  },
  configKey: {
    fontSize: 7,
    color: '#a8a49c',
    fontFamily: 'Helvetica',
  },
  configVal: {
    fontSize: 7,
    color: '#3a3834',
    fontFamily: 'Helvetica-Bold',
  },

  // Preistabelle
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#eeebe4',
    borderWidth: 1,
    borderColor: '#dddad3',
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 2,
  },
  tableRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#dddad3',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  tableRowAlt: {
    backgroundColor: '#f8f6f2',
  },
  colNr: { width: 22, fontSize: 7 },
  colBez: { flex: 1, fontSize: 7 },
  colQty: { width: 28, textAlign: 'right', fontSize: 7 },
  colEP: { width: 50, textAlign: 'right', fontSize: 7 },
  colGP: { width: 54, textAlign: 'right', fontSize: 7 },
  colHeader: {
    color: '#7a7670',
    fontFamily: 'Helvetica-Bold',
    fontSize: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Zusammenfassung (Preisblock)
  summaryBox: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#dddad3',
    paddingTop: 8,
    alignItems: 'flex-end',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 2,
  },
  summaryLabel: {
    width: 130,
    textAlign: 'right',
    fontSize: 8,
    color: '#7a7670',
  },
  summaryValue: {
    width: 70,
    textAlign: 'right',
    fontSize: 8,
    color: '#3a3834',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1.5,
    borderTopColor: '#c4ae8c',
  },
  totalLabel: {
    width: 130,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#1c1a17',
  },
  totalValue: {
    width: 70,
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#1c1a17',
  },

  // Footer
  pageFooter: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#dddad3',
    paddingTop: 6,
  },
  footerText: {
    fontSize: 6,
    color: '#a8a49c',
  },
});

// ── Formatierung ──────────────────────────────────────────────────────────────

function fmtEuro(v: number, sym: string): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v) + '\u202f' + sym;
}

function fmtDate(): string {
  return new Date().toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

// ── 2D-Gitter SVG ─────────────────────────────────────────────────────────────

interface GridSVGProps {
  config: ConfigState;
  bom: BOMResult;
  width: number;   // SVG canvas width in pt
  height: number;  // SVG canvas height in pt
}

function GridSVG({ config, bom, width, height }: GridSVGProps) {
  const { cols: CW, rows: RH, grid } = config;

  // Lightmodul: gesamtes Grid verwenden
  const minR = 0;
  const minC = 0;

  const totalW = CW.reduce((a: number, b: number) => a + b, 0);
  const totalH = RH.reduce((a: number, b: number) => a + b, 0);

  const pad = 4;
  const scaleX = (width  - 2 * pad) / totalW;
  const scaleY = (height - 2 * pad) / totalH;
  const scale  = Math.min(scaleX, scaleY);

  const gW = totalW * scale;
  const gH = totalH * scale;
  const offX = pad + (width  - 2 * pad - gW) / 2;
  const offY = pad + (height - 2 * pad - gH) / 2;

  // Kumulierte x/y-Positionen für die aktiven Zeilen/Spalten
  const xs: number[] = [offX];
  for (let c = minC; c < CW.length; c++) {
    xs.push(xs[xs.length - 1] + CW[c] * scale);
  }
  const ys: number[] = [offY];
  for (let r = minR; r < RH.length; r++) {
    ys.push(ys[ys.length - 1] + RH[r] * scale);
  }

  const cells: React.ReactNode[] = [];
  for (let r = minR; r < RH.length; r++) {
    const ri = r - minR;
    for (let c = minC; c < CW.length; c++) {
      const ci = c - minC;
      const cellArr = grid[r]?.[c];
      const type = cellArr?.[0]?.type ?? '';
      cells.push(
        <Rect
          key={`c_${r}_${c}`}
          x={xs[ci]}
          y={ys[ri]}
          width={xs[ci + 1] - xs[ci]}
          height={ys[ri + 1] - ys[ri]}
          fill={CELL_FILL[type] ?? CELL_FILL['']}
          stroke={CELL_STROKE}
          strokeWidth={0.5}
        />,
      );
    }
  }

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Hintergrund */}
      <Rect x={0} y={0} width={width} height={height} fill="#f8f6f2" />
      {/* Zellen */}
      <G>{cells}</G>
    </Svg>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

interface OfferDocumentProps {
  config: ConfigState;
  pricing: PriceResponse;
  bom: BOMResult;
}

export function OfferDocument({ config, pricing, bom }: OfferDocumentProps) {
  const csym = pricing.currency === 'CHF' ? 'CHF' : '€';
  const matObj: { l: string; pg: string } | null = null;
  const handleObj: { l: string } | null = null;
  const footerObj = FOOTER_BY_V[config.footer];

  const totalW = bom.totalWidth;
  const totalH = bom.totalHeight;
  const metaDim = `${totalW}x${totalH}x${bom.totalDepth} mm`;

  // Preis-Items nach Kategorie-Reihenfolge sortieren
  const sortedItems = [...pricing.items].sort((a, b) => {
    const ia = KAT_ORDER.indexOf(a.kategorie);
    const ib = KAT_ORDER.indexOf(b.kategorie);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  // Bruttopreis ohne Rabatt (für Rabattzeile)
  const uvpTotal = pricing.price_type === 'EK' && pricing.active_discount_pct
    ? Math.round(pricing.grand_total / (1 - pricing.active_discount_pct) * 100) / 100
    : null;

  const discountAmt = uvpTotal !== null
    ? Math.round((uvpTotal - pricing.grand_total) * 100) / 100
    : null;

  return (
    <Document
      title="Lightmodul Angebot"
      author="MHZ Hachtel GmbH"
      creator="Lightmodul Konfigurator"
    >
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.headerRow}>
          <View style={S.logoBox}>
            <Text style={S.logoText}>LOGO PLATZHALTER</Text>
          </View>
          <View style={S.headerRight}>
            <Text style={S.docTitle}>Angebot</Text>
            <Text style={S.docMeta}>
              Lightmodul · MHZ Hachtel GmbH{'\n'}
              {fmtDate()}
            </Text>
          </View>
        </View>

        {/* ── Konfiguration ── */}
        <Text style={S.sectionTitle}>Konfiguration</Text>
        <View style={S.configRow}>
          <View style={S.configKV}>
            <Text style={S.configKey}>Außenmaß:</Text>
            <Text style={S.configVal}>{metaDim}</Text>
          </View>
          {matObj && (
            <View style={S.configKV}>
              <Text style={S.configKey}>Oberfläche:</Text>
              <Text style={S.configVal}>{matObj.l} ({matObj.pg})</Text>
            </View>
          )}
          {handleObj && (
            <View style={S.configKV}>
              <Text style={S.configKey}>Griff:</Text>
              <Text style={S.configVal}>{handleObj.l}</Text>
            </View>
          )}
          {footerObj && (
            <View style={S.configKV}>
              <Text style={S.configKey}>Füße / Rollen:</Text>
              <Text style={S.configVal}>{footerObj.l}</Text>
            </View>
          )}
        </View>

        {/* ── 2D Grid Vorschau ── */}
        <Text style={S.sectionTitle}>Frontansicht</Text>
        <GridSVG config={config} bom={bom} width={180} height={110} />

        {/* ── Stückliste / Preistabelle ── */}
        <Text style={S.sectionTitle}>Stückliste &amp; Preise</Text>

        {/* Tabellenkopf */}
        <View style={S.tableHeader}>
          <Text style={[S.colNr,  S.colHeader]}>Pos</Text>
          <Text style={[S.colBez, S.colHeader]}>Bezeichnung</Text>
          <Text style={[S.colQty, S.colHeader]}>Menge</Text>
          <Text style={[S.colEP,  S.colHeader]}>EP excl. MwSt.</Text>
          <Text style={[S.colGP,  S.colHeader]}>GP excl. MwSt.</Text>
        </View>

        {/* Tabellenzeilen */}
        {sortedItems.map((item, idx) => (
          <View
            key={`${item.kategorie}_${item.dim_key ?? ''}_${idx}`}
            style={[S.tableRow, idx % 2 === 1 ? S.tableRowAlt : {}]}
            wrap={false}
          >
            <Text style={S.colNr}>{idx + 1}</Text>
            <Text style={S.colBez}>
              {item.bezeichnung}
              {item.dim_key ? `\n  ${item.dim_key} mm` : ''}
            </Text>
            <Text style={S.colQty}>{item.qty}</Text>
            <Text style={S.colEP}>{fmtEuro(item.unit_price, csym)}</Text>
            <Text style={S.colGP}>{fmtEuro(item.total_price, csym)}</Text>
          </View>
        ))}

        {/* ── Preiszusammenfassung ── */}
        <View style={S.summaryBox}>
          {/* UVP-Zeile (nur bei EK-Preisen) */}
          {uvpTotal !== null && (
            <View style={S.summaryRow}>
              <Text style={S.summaryLabel}>Listenpreis (UVP excl. MwSt.)</Text>
              <Text style={S.summaryValue}>{fmtEuro(uvpTotal, csym)}</Text>
            </View>
          )}
          {/* Rabatt-Zeile */}
          {discountAmt !== null && pricing.active_discount_pct !== undefined && (
            <View style={S.summaryRow}>
              <Text style={S.summaryLabel}>
                Händlerrabatt {Math.round(pricing.active_discount_pct * 100)}%
              </Text>
              <Text style={S.summaryValue}>- {fmtEuro(discountAmt, csym)}</Text>
            </View>
          )}
          {/* Gesamtpreis */}
          <View style={S.totalRow}>
            <Text style={S.totalLabel}>
              {pricing.price_type === 'EK' ? 'Ihr EK excl. MwSt.' : 'UVP excl. MwSt.'}
            </Text>
            <Text style={S.totalValue}>{fmtEuro(pricing.grand_total, csym)}</Text>
          </View>
        </View>

        {/* Hinweis auf nicht preisbewertete Positionen */}
        {pricing.missing_items.length > 0 && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 6, color: '#c04a3a' }}>
              Nicht preisbewertet: {pricing.missing_items.join(', ')}
            </Text>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={S.pageFooter} fixed>
          <Text style={S.footerText}>MHZ Hachtel GmbH · Lightmodul Konfigurator</Text>
          <Text
            style={S.footerText}
            render={({ pageNumber, totalPages }) =>
              `Seite ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
