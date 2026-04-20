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
import type { BOMResult, ConfigState } from '@/core/types';
import { HANDLE_BY_V, FOOTER_BY_V, MAT_BY_V } from '@/core/constants';
import { TechnicalDrawingView } from './TechnicalDrawing';

// Helvetica (built-in) — schlicht und klassisch, keine Font-Registrierung nötig

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface OfferItem {
  configCode: number;
  config: ConfigState;
  bom: BOMResult;
  screenshot: string | null;
  netPrice: number; // 0 wenn kein Preis (Customer)
  arQrDataUrl?: string; // QR-Code Data-URL für AR-Vorschau
}

interface MultiOfferDocumentProps {
  items: OfferItem[];
  offerCode: number;
  currency: 'EUR' | 'CHF';
  showPrices: boolean; // false für Customer
}

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

  // Seitentitel
  pageTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#2A2A2A',
    marginBottom: 6,
  },
  pageSubtitle: {
    fontSize: 10,
    color: '#666',
    marginBottom: 20,
  },

  // Deckblatt-Tabelle
  coverTable: {
    marginBottom: 20,
  },
  coverTableHead: {
    flexDirection: 'row',
    borderBottomWidth: 0.8,
    borderBottomColor: '#2A2A2A',
    paddingBottom: 4,
    marginBottom: 2,
  },
  coverTableRow: {
    paddingVertical: 6,
    paddingBottom: 8,
    borderBottomWidth: 0.3,
    borderBottomColor: '#E0DDD8',
  },
  coverMainRow: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  coverDetailRow: {
    flexDirection: 'row',
    paddingLeft: 28, // eingerückt unter Pos
  },
  coverColPos: { width: 28, fontSize: 8, color: '#999' },
  coverColId: { width: 72, fontSize: 8 },
  coverColDim: { width: 90, fontSize: 8 },
  coverColBez: { flex: 1, fontSize: 8 },
  coverColPrice: { width: 72, fontSize: 8, textAlign: 'right' as const },
  coverHeadText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#666' },
  coverDetailText: { fontSize: 7, color: '#888', flex: 1 },

  // Summenblock (Deckblatt)
  sumBlock: {
    alignItems: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 0.8,
    borderTopColor: '#2A2A2A',
  },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginBottom: 3,
  },
  sumLabel: { fontSize: 9, color: '#666', width: 80, textAlign: 'right' as const },
  sumValue: { fontSize: 9, color: '#2A2A2A', width: 80, textAlign: 'right' as const },
  sumGrossLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#2A2A2A', width: 80, textAlign: 'right' as const },
  sumGrossValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#2A2A2A', width: 80, textAlign: 'right' as const },
  validityText: { fontSize: 8, color: '#888', marginTop: 12 },

  // 3D-Rendering (Visualisierungsseite)
  renderingWrap: {
    marginBottom: 12,
    borderRadius: 4,
    overflow: 'hidden',
  },
  renderingImage: {
    width: '100%',
    height: 280,
    objectFit: 'contain' as const,
  },

  // Maßzeichnung + Kennzahlen
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
  kpiLabel: { fontSize: 8, color: '#888' },
  kpiValue: { fontSize: 9, color: '#2A2A2A' },

  // BOM-Tabelle (Stücklistenseite)
  bomTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#2A2A2A',
    marginBottom: 10,
    marginTop: 8,
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
  bomColPos: { width: 24, fontSize: 7, color: '#999' },
  bomColBez: { flex: 1, fontSize: 7 },
  bomColQty: { width: 40, fontSize: 7, textAlign: 'right' as const },
  bomHeadText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#666' },

  // Preisblock (Stücklistenseite)
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
});

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

/** Zahl als deutsches Währungsformat formatieren */
function fmt(v: number, sym: string): string {
  return (
    new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v) +
    ' ' +
    sym
  );
}

/** Aktive Abmessungen und Feldanzahl aus ConfigState berechnen */
function getActiveDimensions(config: ConfigState) {
  const numRows = config.rows.length;
  const numCols = config.cols.length;
  let minR = numRows, maxR = -1, minC = numCols, maxC = -1;
  for (let r = 0; r < numRows; r++)
    for (let c = 0; c < numCols; c++)
      if (config.grid[r]?.[c]?.[0]?.type !== '') {
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
  if (maxR < 0) {
    minR = 0; maxR = numRows - 1; minC = 0; maxC = numCols - 1;
  }
  const w = config.cols.slice(minC, maxC + 1).reduce((a, b) => a + b, 0);
  const h = config.rows.slice(minR, maxR + 1).reduce((a, b) => a + b, 0);
  const cells = config.grid.flat().filter(c => c.type !== '').length;
  return { totalW: w, totalH: h, activeCells: cells };
}

/** Kurzbeschreibung des Möbels z.B. "Schwarz · 360 mm Tiefe" */
function describeMoebel(config: ConfigState): string {
  const matObj = MAT_BY_V[config.surface];
  const parts: string[] = [];
  if (matObj?.l) parts.push(matObj.l);
  parts.push(`${config.depth} mm Tiefe`);
  return parts.join(' · ');
}

/** Individuelle Oberflächen-Anpassungen auflisten */
function describeOverrides(config: ConfigState): string[] {
  const lines: string[] = [];

  // catOverrides: Kategorie-Level (z.B. "Fronten Klappe: Eiche")
  const catLabels: Record<string, string> = {
    boden: 'Böden', klappenboden: 'Klappenböden', ruecken: 'Rückwände',
    seite_aussen: 'Seiten außen', seite_innen: 'Seiten innen',
    fachboden: 'Fachböden', front_K: 'Klappen', front_S: 'Schubladen',
    front_TR: 'Türen R', front_TL: 'Türen L', front_DT: 'Doppeltüren',
  };
  for (const [key, ov] of Object.entries(config.catOverrides ?? {})) {
    if (ov?.oberflaeche) {
      const mat = MAT_BY_V[ov.oberflaeche];
      const label = catLabels[key] ?? key;
      if (mat) lines.push(`${label}: ${mat.l}`);
    }
  }

  // bomOverrides: Einzelteil-Level (z.B. "Front R0/C0: Eiche")
  for (const [boardId, ov] of Object.entries(config.bomOverrides ?? {})) {
    if (ov?.material) {
      const mat = MAT_BY_V[ov.material];
      if (mat) lines.push(`${boardId}: ${mat.l}`);
    }
  }

  // Kabeldurchlässe mit Position
  for (const [boardId, active] of Object.entries(config.cableHoles ?? {})) {
    if (active) lines.push(`Kabeldurchlass: ${boardId}`);
  }

  return lines;
}

/** Fronten zählen und als Text zusammenfassen */
function describeFronts(config: ConfigState): string {
  const counts: Record<string, number> = {};
  for (const row of config.grid) {
    for (const cell of row) {
      if (cell.type && cell.type !== 'O') {
        const label = { K: 'Klappe', S: 'Schublade', S2: '2× Schublade', TR: 'Tür R', TL: 'Tür L', DT: 'Doppeltür' }[cell.type] ?? cell.type;
        counts[label] = (counts[label] ?? 0) + 1;
      }
    }
  }
  return Object.entries(counts).map(([k, v]) => `${v}\u00D7 ${k}`).join(', ') || 'Alle offen';
}


/** Datum + N Tage als deutsches Datum formatieren */
function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('de-DE');
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

  // Profile — zusammengefasst nach Länge
  const allProfiles: Record<string, number> = {};
  for (const [l, q] of Object.entries(bom.pB)) allProfiles[l] = (allProfiles[l] ?? 0) + q;
  for (const [l, q] of Object.entries(bom.pH)) allProfiles[l] = (allProfiles[l] ?? 0) + q;
  for (const [l, q] of Object.entries(bom.pT)) allProfiles[l] = (allProfiles[l] ?? 0) + q;
  for (const [len, qty] of Object.entries(allProfiles))
    items.push({ bezeichnung: `Profil 30mm ${len}mm`, qty, dim_key: len });

  // Platten-Helfer
  const addDimMap = (map: Record<string, number>, label: string) => {
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
  const frontLabels: Record<string, string> = {
    K: 'Klappe',
    S: 'Schublade',
    TR: 'Tür rechts',
    TL: 'Tür links',
    DT: 'Doppeltür',
  };
  for (const [typ, m] of Object.entries(bom.fMap) as [string, Record<string, number>][]) {
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
  if (bom.bolzen > 0)
    items.push({ bezeichnung: 'Bolzen-Set (Sicherung + Gewinde + Maden + Verdrehsicherung)', qty: bom.bolzen });
  if (bom.klemm > 0) items.push({ bezeichnung: 'Klemmsterne', qty: bom.klemm });

  return items;
}

// ── Wiederverwendbare Komponenten ─────────────────────────────────────────────

function DocHeader({ ts, offerCode }: { ts: string; offerCode: number }) {
  return (
    <View style={S.header} fixed>
      <View style={S.logoRow}>
        <Text style={S.logoArt}>ART</Text>
        <Text style={S.logoModul}>MODUL</Text>
      </View>
      <View style={S.headerRight}>
        <Text style={S.headerDate}>{ts}</Text>
        <Text style={S.headerId}>Angebot {offerCode}</Text>
      </View>
    </View>
  );
}

function DocFooter({ ts }: { ts: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>LIGHTMODUL by MHZ · MHZ Hachtel GmbH</Text>
      <Text style={S.footerText}>{ts}</Text>
    </View>
  );
}

// ── Deckblatt ─────────────────────────────────────────────────────────────────

function CoverPage({
  items,
  offerCode,
  currency,
  showPrices,
  ts,
}: {
  items: OfferItem[];
  offerCode: number;
  currency: 'EUR' | 'CHF';
  showPrices: boolean;
  ts: string;
}) {
  const sym = currency === 'CHF' ? 'CHF' : '\u20AC';
  const vatRate = currency === 'CHF' ? 0.081 : 0.19;
  const vatLabel = currency === 'CHF' ? '8,1 %' : '19 %';
  const netTotal = items.reduce((s, it) => s + it.netPrice, 0);
  const vatAmount = netTotal * vatRate;
  const grossTotal = netTotal + vatAmount;

  return (
    <Page size="A4" style={S.page}>
      <DocHeader ts={ts} offerCode={offerCode} />

      <Text style={S.pageTitle}>Angebot</Text>
      <Text style={S.pageSubtitle}>
        {items.length} {items.length === 1 ? 'Möbel' : 'Möbel'} · {ts}
      </Text>

      {/* Übersichtstabelle */}
      <View style={S.coverTable}>
        {/* Tabellenkopf */}
        <View style={S.coverTableHead}>
          <Text style={[S.coverColPos, S.coverHeadText]}>Pos</Text>
          <Text style={[S.coverColId, S.coverHeadText]}>Möbel-ID</Text>
          <Text style={[S.coverColDim, S.coverHeadText]}>Maße (B×H×T)</Text>
          <Text style={[S.coverColBez, S.coverHeadText]}>Beschreibung</Text>
          {showPrices && (
            <Text style={[S.coverColPrice, S.coverHeadText]}>Netto</Text>
          )}
        </View>

        {/* Tabellenzeilen — mehrzeilig mit Details */}
        {items.map((item, idx) => {
          const { totalW, totalH } = getActiveDimensions(item.config);
          const breite = totalW + 30;
          const hoehe = totalH + 30;
          const tiefe = item.config.depth;
          const dimStr = `${breite}\u00D7${hoehe}\u00D7${tiefe}`;

          const matObj = MAT_BY_V[item.config.surface];
          const handleObj = HANDLE_BY_V[item.config.handle];
          const footerObj = FOOTER_BY_V[item.config.footer];
          const fronts = describeFronts(item.config);
          const overrides = describeOverrides(item.config);

          // Fachböden zählen
          const totalShelves = item.config.grid.reduce(
            (sum, row) => sum + row.reduce((s, cell) => s + (cell.shelves ?? 0), 0), 0,
          );
          // Kabeldurchlässe zählen
          const totalCables = Object.values(item.config.cableHoles ?? {}).filter(Boolean).length;

          // Detail-Zeilen zusammenstellen
          const detailParts: string[] = [];
          detailParts.push(`Fronten: ${fronts}`);
          if (handleObj) detailParts.push(`Griff: ${handleObj.l}`);
          if (footerObj) detailParts.push(`Füße: ${footerObj.l}`);
          if (totalShelves > 0) detailParts.push(`Fachböden: ${totalShelves}`);
          if (totalCables > 0) detailParts.push(`Kabeldurchlässe: ${totalCables}`);
          // Individuelle Anpassungen (Overrides)
          for (const line of overrides) detailParts.push(line);

          return (
            <View key={item.configCode} style={S.coverTableRow} wrap={false}>
              {/* Hauptzeile */}
              <View style={S.coverMainRow}>
                <Text style={S.coverColPos}>{idx + 1}</Text>
                <Text style={S.coverColId}>#{String(item.configCode).padStart(8, '0')}</Text>
                <Text style={S.coverColDim}>{dimStr} mm</Text>
                <Text style={S.coverColBez}>{matObj?.l ?? 'Keine Oberfläche'}</Text>
                {showPrices && (
                  <Text style={S.coverColPrice}>
                    {item.netPrice > 0 ? fmt(item.netPrice, sym) : 'auf Anfrage'}
                  </Text>
                )}
              </View>
              {/* Detailzeilen */}
              {detailParts.map((detail, di) => (
                <View key={di} style={S.coverDetailRow}>
                  <Text style={S.coverDetailText}>{detail}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>

      {/* Summenblock */}
      {showPrices && netTotal > 0 && (
        <View style={S.sumBlock}>
          <View style={S.sumRow}>
            <Text style={S.sumLabel}>Netto</Text>
            <Text style={S.sumValue}>{fmt(netTotal, sym)}</Text>
          </View>
          <View style={S.sumRow}>
            <Text style={S.sumLabel}>MwSt. {vatLabel}</Text>
            <Text style={S.sumValue}>{fmt(vatAmount, sym)}</Text>
          </View>
          <View
            style={[
              S.sumRow,
              { marginTop: 4, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: '#E0DDD8' },
            ]}
          >
            <Text style={S.sumGrossLabel}>Brutto</Text>
            <Text style={S.sumGrossValue}>{fmt(grossTotal, sym)}</Text>
          </View>
        </View>
      )}

      {/* Gültigkeitsdatum */}
      {showPrices && (
        <Text style={S.validityText}>
          Angebot gültig bis {addDays(30)}
        </Text>
      )}

      <DocFooter ts={ts} />
    </Page>
  );
}

// ── Visualisierungsseite (pro Möbel) ────────────────────────────────────────

function VisualPage({
  item,
  pos,
  offerCode,
  ts,
}: {
  item: OfferItem;
  pos: number;
  offerCode: number;
  ts: string;
}) {
  const matObj = MAT_BY_V[item.config.surface];
  const { totalW, totalH, activeCells } = getActiveDimensions(item.config);
  const moebelIdStr = `#${String(item.configCode).padStart(8, '0')}`;

  return (
    <Page size="A4" style={S.page}>
      <DocHeader ts={ts} offerCode={offerCode} />

      {/* Seitentitel */}
      <Text style={S.pageTitle}>
        Pos. {pos} — Möbel {moebelIdStr}
      </Text>
      <Text style={[S.pageSubtitle, { marginBottom: 12 }]}>
        {describeMoebel(item.config)}
      </Text>

      {/* 3D-Screenshot */}
      {item.screenshot && (
        <View style={S.renderingWrap}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Image src={item.screenshot as any} style={S.renderingImage} />
        </View>
      )}

      {/* Maßzeichnung + Kennzahlen */}
      <View style={S.midSection}>
        <View style={S.drawingWrap}>
          <TechnicalDrawingView config={item.config} />
        </View>

        {/* Kennzahlen-Zeile + AR QR-Code */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={[S.kpiRow, { flex: 1 }]}>
            {[
              { l: 'Breite', v: `${totalW + 30} mm` },
              { l: 'Höhe', v: `${totalH + 30} mm` },
              { l: 'Tiefe', v: `${item.config.depth} mm` },
              { l: 'Felder', v: `${activeCells}` },
              { l: 'Oberfläche', v: matObj?.l ?? 'Keine' },
            ].map(k => (
              <View key={k.l} style={{ flex: 1 }}>
                <Text style={S.kpiValue}>{k.v}</Text>
                <Text style={S.kpiLabel}>{k.l}</Text>
              </View>
            ))}
          </View>

          {/* AR QR-Code */}
          {item.arQrDataUrl && (
            <View style={{ alignItems: 'center', width: 72 }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              <Image src={item.arQrDataUrl as any} style={{ width: 56, height: 56 }} />
              <Text style={{ fontSize: 6, color: '#999', marginTop: 3, textAlign: 'center' }}>AR-Vorschau</Text>
            </View>
          )}
        </View>
      </View>

      <DocFooter ts={ts} />
    </Page>
  );
}

// ── Stücklistenseite (pro Möbel) ────────────────────────────────────────────

function BomPage({
  item,
  pos,
  offerCode,
  currency,
  showPrices,
  ts,
}: {
  item: OfferItem;
  pos: number;
  offerCode: number;
  currency: 'EUR' | 'CHF';
  showPrices: boolean;
  ts: string;
}) {
  const sym = currency === 'CHF' ? 'CHF' : '\u20AC';
  const vatRate = currency === 'CHF' ? 0.081 : 0.19;
  const vatLabel = currency === 'CHF' ? '8,1 %' : '19 %';
  const vatAmount = item.netPrice * vatRate;
  const grossPrice = item.netPrice + vatAmount;

  const bomItems = buildBomDisplayItems(item.bom, item.config);
  const moebelIdStr = `#${String(item.configCode).padStart(8, '0')}`;

  return (
    <Page size="A4" style={S.page}>
      <DocHeader ts={ts} offerCode={offerCode} />

      {/* Seitentitel */}
      <Text style={S.pageTitle}>
        Pos. {pos} — Stückliste {moebelIdStr}
      </Text>
      <Text style={[S.pageSubtitle, { marginBottom: 12 }]}>
        {describeMoebel(item.config)}
      </Text>

      {/* BOM-Tabelle */}
      <Text style={S.bomTitle}>Stückliste</Text>

      <View style={S.bomTableHead}>
        <Text style={[S.bomColPos, S.bomHeadText]}>Pos</Text>
        <Text style={[S.bomColBez, S.bomHeadText]}>Beschreibung</Text>
        <Text style={[S.bomColQty, S.bomHeadText]}>Menge</Text>
      </View>

      {bomItems.map((bi, i) => (
        <View
          key={`${bi.bezeichnung}-${bi.dim_key ?? i}`}
          style={S.bomTableRow}
          wrap={false}
        >
          <Text style={S.bomColPos}>{i + 1}</Text>
          <Text style={S.bomColBez}>{bi.bezeichnung}</Text>
          <Text style={S.bomColQty}>{bi.qty}</Text>
        </View>
      ))}

      {/* Preisblock */}
      {showPrices && item.netPrice > 0 && (
        <View style={S.priceBlock}>
          <View style={S.priceRow}>
            <Text style={S.priceLabel}>Netto</Text>
            <Text style={S.priceValue}>{fmt(item.netPrice, sym)}</Text>
          </View>
          <View style={S.priceRow}>
            <Text style={S.priceLabel}>MwSt. {vatLabel}</Text>
            <Text style={S.priceValue}>{fmt(vatAmount, sym)}</Text>
          </View>
          <View
            style={[
              S.priceRow,
              { marginTop: 4, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: '#E0DDD8' },
            ]}
          >
            <Text style={S.priceGrossLabel}>Brutto</Text>
            <Text style={S.priceGrossValue}>{fmt(grossPrice, sym)}</Text>
          </View>
        </View>
      )}

      {/* Fallback wenn Preis 0 */}
      {showPrices && item.netPrice === 0 && (
        <View style={S.priceBlock}>
          <View style={S.priceRow}>
            <Text style={S.priceLabel}>Gesamtpreis</Text>
            <Text style={S.priceValue}>auf Anfrage</Text>
          </View>
        </View>
      )}

      <DocFooter ts={ts} />
    </Page>
  );
}

// ── MultiOfferDocument ────────────────────────────────────────────────────────

export function MultiOfferDocument({
  items,
  offerCode,
  currency,
  showPrices,
}: MultiOfferDocumentProps) {
  const ts = new Date().toLocaleDateString('de-DE');

  return (
    <Document>
      {/* Deckblatt */}
      <CoverPage
        items={items}
        offerCode={offerCode}
        currency={currency}
        showPrices={showPrices}
        ts={ts}
      />

      {/* Detailseiten — zwei pro Möbel (Visualisierung + Stückliste) */}
      {items.map((item, idx) => (
        <React.Fragment key={item.configCode}>
          <VisualPage
            item={item}
            pos={idx + 1}
            offerCode={offerCode}
            ts={ts}
          />
          <BomPage
            item={item}
            pos={idx + 1}
            offerCode={offerCode}
            currency={currency}
            showPrices={showPrices}
            ts={ts}
          />
        </React.Fragment>
      ))}
    </Document>
  );
}
