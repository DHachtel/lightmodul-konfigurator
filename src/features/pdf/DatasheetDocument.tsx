// @ts-nocheck
// TODO: Für Lightmodul neu schreiben — noch Lightmodul-Layout
import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import type { BOMResult, ConfigState, DimMap } from '@/core/types';
import { HANDLE_BY_V, FOOTER_BY_V, MAT_BY_V } from '@/core/constants';
import { TechnicalDrawingView } from './TechnicalDrawing';

// Helvetica (built-in) — schlicht und klassisch, keine Font-Registrierung nötig

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#2A2A2A',
    backgroundColor: '#FAFAF8',
    paddingTop: 32,
    paddingBottom: 48,
    paddingHorizontal: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0DDD8',
  },
  logoRow: { flexDirection: 'row' },
  logoArt: { fontSize: 18, fontFamily: 'Helvetica', color: '#2A2A2A', letterSpacing: 3 },
  logoModul: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#2A2A2A', letterSpacing: 3 },
  headerRight: { alignItems: 'flex-end' },
  headerDate: { fontSize: 8, color: '#999' },
  headerId: { fontSize: 8, color: '#999', marginTop: 2 },

  // 3D-Rendering
  renderingWrap: {
    marginBottom: 12,
    borderRadius: 4,
    overflow: 'hidden',
  },
  renderingImage: {
    width: '100%',
    height: 220,
    objectFit: 'contain' as const,
  },

  // Mittlerer Bereich: Zeichnung + Kennzahlen untereinander
  midSection: {
    marginBottom: 8,
  },
  drawingWrap: {
    width: '100%',
    marginBottom: 6,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 8,
  },

  // Kennzahlen
  kpiLabel: { fontSize: 8, color: '#888' },
  kpiValue: { fontSize: 9, color: '#2A2A2A' },

  // Konfig-Zusammenfassung
  configRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F2F0EC',
    borderRadius: 4,
  },
  configItem: { fontSize: 8, color: '#555' },
  configValue: { color: '#2A2A2A' },

  // BOM-Tabelle
  bomTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#2A2A2A',
    marginBottom: 10,
  },
  bomTableHead: {
    flexDirection: 'row',
    borderBottomWidth: 0.8,
    borderBottomColor: '#2A2A2A',
    paddingBottom: 4,
    marginBottom: 2,
  },
  bomTableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
    borderBottomWidth: 0.3,
    borderBottomColor: '#E0DDD8',
  },
  bomColPos:   { width: 24, fontSize: 7, color: '#999' },
  bomColBez:   { flex: 1, fontSize: 7 },
  bomColQty:   { width: 40, fontSize: 7, textAlign: 'right' as const },
  bomHeadText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#666' },

  // Preisblock (Seite 2)
  priceBlock: {
    alignItems: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.8,
    borderTopColor: '#2A2A2A',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginBottom: 3,
  },
  priceLabel: { fontSize: 9, color: '#666', width: 80, textAlign: 'right' as const },
  priceValue: { fontSize: 9, color: '#2A2A2A', width: 80, textAlign: 'right' as const },
  priceGrossLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#2A2A2A', width: 80, textAlign: 'right' as const },
  priceGrossValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#2A2A2A', width: 80, textAlign: 'right' as const },
  priceMissing: { fontSize: 7, color: '#c05020', marginTop: 6, textAlign: 'right' as const },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.3,
    borderTopColor: '#E0DDD8',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#B0ADA8' },
  pageNum: { fontSize: 7, color: '#B0ADA8' },
});

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function getActiveDimensions(config: ConfigState) {
  const numRows = config.rows.length;
  const numCols = config.cols.length;
  let minR = numRows, maxR = -1, minC = numCols, maxC = -1;
  for (let r = 0; r < numRows; r++)
    for (let c = 0; c < numCols; c++)
      if (config.grid[r]?.[c]?.[0]?.type !== '') {
        if (r < minR) minR = r; if (r > maxR) maxR = r;
        if (c < minC) minC = c; if (c > maxC) maxC = c;
      }
  if (maxR < 0) { minR = 0; maxR = numRows - 1; minC = 0; maxC = numCols - 1; }
  const w = config.cols.slice(minC, maxC + 1).reduce((a, b) => a + b, 0);
  const h = config.rows.slice(minR, maxR + 1).reduce((a, b) => a + b, 0);
  const cells = config.grid.flat().filter(c => c.type !== '').length;
  return { totalW: w, totalH: h, activeCells: cells };
}

interface BomDisplayItem {
  bezeichnung: string;
  qty: number;
  dim_key?: string;
}

/** BOM-Zeilen aus BOMResult generieren */
function buildBomDisplayItems(bom: BOMResult, config: ConfigState): BomDisplayItem[] {
  const items: BomDisplayItem[] = [];

  // Würfel
  if (bom.wuerfel > 0)
    items.push({ bezeichnung: 'Würfel 30mm', qty: bom.wuerfel });

  // Profile (zusammengefasst nach Länge)
  const allProfiles: Record<string, number> = {};
  for (const [l, q] of Object.entries(bom.pB)) allProfiles[l] = (allProfiles[l] ?? 0) + q;
  for (const [l, q] of Object.entries(bom.pH)) allProfiles[l] = (allProfiles[l] ?? 0) + q;
  for (const [l, q] of Object.entries(bom.pT)) allProfiles[l] = (allProfiles[l] ?? 0) + q;
  for (const [len, qty] of Object.entries(allProfiles))
    items.push({ bezeichnung: `Profil 30mm ${len}mm`, qty, dim_key: len });

  // Platten-Helfer
  const addDimMap = (map: DimMap, label: string) => {
    for (const [dim, qty] of Object.entries(map))
      if (qty > 0) items.push({ bezeichnung: `${label} ${dim}mm`, qty, dim_key: dim });
  };

  addDimMap(bom.bStd, 'Boden');
  addDimMap(bom.bKl, 'Klappenboden');
  addDimMap(bom.rMap, 'Rücken');
  addDimMap(bom.sAMap, 'Seite außen');
  addDimMap(bom.sAMapSY32, 'Seite außen SY32');
  addDimMap(bom.sIMap, 'Seite innen');
  addDimMap(bom.sIMapSY32, 'Seite innen SY32');
  addDimMap(bom.fbMap, 'Fachboden');

  // Fronten — pro Typ × Dimension
  const frontLabels: Record<string, string> = { K: 'Klappe', S: 'Schublade', TR: 'Tür rechts', TL: 'Tür links', DT: 'Doppeltür' };
  for (const [typ, m] of Object.entries(bom.fMap) as [string, DimMap][]) {
    for (const [dim, qty] of Object.entries(m))
      if (qty > 0) items.push({ bezeichnung: `${frontLabels[typ] ?? typ} ${dim}mm`, qty, dim_key: dim });
  }

  // Griffe
  if (bom.frontGes > 0) {
    const hObj = HANDLE_BY_V[config.handle];
    items.push({ bezeichnung: `Griff ${hObj?.l ?? config.handle}`, qty: bom.frontGes });
  }

  // Beschläge
  if (bom.scharn > 0) items.push({ bezeichnung: 'Scharniere', qty: bom.scharn });
  if (bom.kHalt > 0) items.push({ bezeichnung: 'Klappenhalter', qty: bom.kHalt });
  if (bom.kDaem > 0) items.push({ bezeichnung: 'Klappendämpfer', qty: bom.kDaem });
  if (bom.schubF > 0) items.push({ bezeichnung: 'Schubkastenführung', qty: bom.schubF });

  // Füße/Rollen
  if (bom.footerQty > 0) {
    const fObj = FOOTER_BY_V[config.footer];
    items.push({ bezeichnung: fObj?.l ?? config.footer, qty: bom.footerQty });
  }

  // Kleinteile
  if (bom.bolzen > 0) items.push({ bezeichnung: 'Bolzen-Set (Sicherung + Gewinde + Maden + Verdrehsicherung)', qty: bom.bolzen });
  if (bom.klemm > 0) items.push({ bezeichnung: 'Klemmsterne', qty: bom.klemm });

  return items;
}

// ── Wiederverwendbare Komponenten ─────────────────────────────────────────────

function Header({ ts, moebelId }: { ts: string; moebelId?: string | null }) {
  return (
    <View style={S.header} fixed>
      <View style={S.logoRow}>
        <Text style={S.logoArt}>ART</Text>
        <Text style={S.logoModul}>MODUL</Text>
      </View>
      <View style={S.headerRight}>
        <Text style={S.headerDate}>{ts}</Text>
        {moebelId && <Text style={S.headerId}>Konfig. {moebelId}</Text>}
      </View>
    </View>
  );
}

function Footer({ ts }: { ts: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>Unverbindliche Konfiguration · MHZ Hachtel GmbH</Text>
      <Text style={S.footerText}>{ts}</Text>
    </View>
  );
}

// ── DatasheetDocument ─────────────────────────────────────────────────────────

interface Props {
  config: ConfigState;
  bom: BOMResult;
  grandTotal?: number;
  currency?: 'EUR' | 'CHF';
  screenshot3d?: string | null;
  moebelId?: string | null;
}

export function DatasheetDocument({ config, bom, grandTotal = 0, currency = 'EUR', screenshot3d, moebelId }: Props) {
  const matObj = MAT_BY_V[config.surface];
  const handleObj = HANDLE_BY_V[config.handle];
  const { totalW, totalH, activeCells } = getActiveDimensions(config);
  const ts = new Date().toLocaleDateString('de-DE');

  // Preis — immer anzeigen wenn > 0
  const sym = currency === 'CHF' ? 'CHF' : '€';
  const vatRate = currency === 'CHF' ? 0.081 : 0.19;
  const vatLabel = currency === 'CHF' ? '8,1 %' : '19 %';
  const netTotal = grandTotal;
  const vatAmount = netTotal * vatRate;
  const grossTotal = netTotal + vatAmount;

  // BOM-Zeilen direkt aus BOMResult (ohne Einzelpreise)
  const bomItems = buildBomDisplayItems(bom, config);

  return (
    <Document>
      {/* ════════════════════════════════════════════════════════════════════════
          SEITE 1 — Visualisierung + Maße + Konfiguration
          ════════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={S.page}>
        <Header ts={ts} moebelId={moebelId} />

        {/* ── 3D-Rendering (prominent) ── */}
        {screenshot3d && (
          <View style={S.renderingWrap}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Image src={screenshot3d as any} style={S.renderingImage} />
          </View>
        )}

        {/* ── Maßzeichnung ── */}
        <View style={S.midSection}>
          <View style={S.drawingWrap}>
            <TechnicalDrawingView config={config} />
          </View>

          {/* Kennzahlen als kompakte Zeile */}
          <View style={S.kpiRow}>
            {[
              { l: 'Breite', v: `${totalW + 30} mm` },
              { l: 'Höhe', v: `${totalH + 30} mm` },
              { l: 'Tiefe', v: `${config.depth} mm` },
              { l: 'Felder', v: `${activeCells}` },
              { l: 'Gewicht ca.', v: `~${Math.round(activeCells * 8)} kg` },
            ].map(k => (
              <View key={k.l} style={{ flex: 1 }}>
                <Text style={S.kpiValue}>{k.v}</Text>
                <Text style={S.kpiLabel}>{k.l}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Konfig-Zusammenfassung ── */}
        <View style={S.configRow}>
          <Text style={S.configItem}>
            Oberfläche: <Text style={S.configValue}>{matObj?.l ?? 'Keine'}</Text>
            {matObj?.pg ? ` · ${matObj.pg}` : ''}
          </Text>
          {handleObj && (
            <Text style={S.configItem}>
              Griff: <Text style={S.configValue}>{handleObj.l}</Text>
            </Text>
          )}
          <Text style={S.configItem}>
            Tiefe: <Text style={S.configValue}>{config.depth} mm</Text>
          </Text>
        </View>

        <Footer ts={ts} />
      </Page>

      {/* ════════════════════════════════════════════════════════════════════════
          SEITE 2 — Stückliste + Preise
          ════════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={S.page}>
        <Header ts={ts} moebelId={moebelId} />

        <Text style={S.bomTitle}>Stückliste</Text>

        {/* ── Tabellenkopf ── */}
        <View style={S.bomTableHead}>
          <Text style={[S.bomColPos, S.bomHeadText]}>Pos</Text>
          <Text style={[S.bomColBez, S.bomHeadText]}>Beschreibung</Text>
          <Text style={[S.bomColQty, S.bomHeadText]}>Menge</Text>
        </View>

        {/* ── Tabellenzeilen ── */}
        {bomItems.map((item, i) => (
          <View key={`${item.bezeichnung}-${item.dim_key ?? i}`} style={S.bomTableRow} wrap={false}>
            <Text style={S.bomColPos}>{i + 1}</Text>
            <Text style={S.bomColBez}>{item.bezeichnung}</Text>
            <Text style={S.bomColQty}>{item.qty}</Text>
          </View>
        ))}

        {/* ── Preisblock — immer sichtbar ── */}
        {netTotal > 0 && (
          <View style={S.priceBlock}>
            <View style={S.priceRow}>
              <Text style={S.priceLabel}>Netto</Text>
              <Text style={S.priceValue}>{fmt(netTotal)} {sym}</Text>
            </View>
            <View style={S.priceRow}>
              <Text style={S.priceLabel}>MwSt. {vatLabel}</Text>
              <Text style={S.priceValue}>{fmt(vatAmount)} {sym}</Text>
            </View>
            <View style={[S.priceRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: '#E0DDD8' }]}>
              <Text style={S.priceGrossLabel}>Brutto</Text>
              <Text style={S.priceGrossValue}>{fmt(grossTotal)} {sym}</Text>
            </View>
          </View>
        )}

        <Footer ts={ts} />
      </Page>
    </Document>
  );
}
