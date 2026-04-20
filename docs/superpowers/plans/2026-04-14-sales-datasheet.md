# Verkaufs-Datenblatt (1-Seite) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `DatasheetDocument.tsx` from a 2-page technical datasheet into a 1-page A4 sales document — large 3D rendering, technical drawing, config summary, and Netto/Brutto price only (no BOM/Einzelpreise).

**Architecture:** Single-file rewrite. Register Roboto font via `@react-pdf/renderer` Font.register (Google Fonts CDN). Replace all styles for the 1-page layout. Remove BOM table, `buildBomDisplayItems`, and page 2 entirely. Keep `getActiveDimensions` and `TechnicalDrawingView` import. Simplify Props (remove `bom` dependency for display, keep for weight estimate).

**Tech Stack:** TypeScript, @react-pdf/renderer (Document, Page, View, Text, Image, Font, StyleSheet)

**Spec:** `docs/superpowers/specs/2026-04-14-sales-datasheet-design.md`

---

### Task 1: Register Roboto font

**Files:**
- Modify: `src/features/pdf/DatasheetDocument.tsx:1-15`

- [ ] **Step 1: Add Font import and register Roboto Light + Regular**

At the top of `DatasheetDocument.tsx`, add `Font` to the import and register Roboto variants before the stylesheet:

```typescript
import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Font,
  StyleSheet,
} from '@react-pdf/renderer';
import type { BOMResult, ConfigState } from '@/core/types';
import { HANDLE_BY_V, MAT_BY_V } from '@/core/constants';
import { TechnicalDrawingView } from './TechnicalDrawing';

// Roboto via Google Fonts CDN
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbGmT.ttf', fontWeight: 300 },
    { src: 'https://fonts.gstatic.com/s/roboto/v47/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbVqT.ttf', fontWeight: 400 },
  ],
});
```

Note: `FOOTER_BY_V` import is removed (no BOM display), `DimMap` type import is removed (no longer needed).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors (unused imports from removal will be fixed in Task 2)

- [ ] **Step 3: Commit**

```bash
git add src/features/pdf/DatasheetDocument.tsx
git commit -m "PDF: Roboto-Font für Verkaufs-Datenblatt registrieren"
```

---

### Task 2: Replace stylesheet with 1-page sales layout

**Files:**
- Modify: `src/features/pdf/DatasheetDocument.tsx` — replace the entire `S = StyleSheet.create(...)` block

- [ ] **Step 1: Replace the stylesheet**

Remove the existing `S = StyleSheet.create({...})` block (lines 18–148) and replace with:

```typescript
const S = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    fontWeight: 300,
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
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0DDD8',
  },
  logoRow: { flexDirection: 'row' },
  logoArt: { fontSize: 18, fontWeight: 300, color: '#2A2A2A', letterSpacing: 3 },
  logoModul: { fontSize: 18, fontWeight: 400, color: '#2A2A2A', letterSpacing: 3 },
  headerRight: { alignItems: 'flex-end' },
  headerDate: { fontSize: 8, color: '#999' },
  headerId: { fontSize: 8, color: '#999', marginTop: 2 },

  // 3D-Rendering — ~45% der Seite
  renderingWrap: {
    marginBottom: 12,
    borderRadius: 4,
    overflow: 'hidden',
  },
  renderingImage: {
    width: '100%',
    height: 310,
    objectFit: 'contain' as const,
  },

  // Mittlerer Bereich: Zeichnung + Kennzahlen nebeneinander
  midSection: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 16,
  },
  drawingWrap: {
    flex: 3,
  },
  kpiCol: {
    flex: 2,
    justifyContent: 'center',
    gap: 6,
  },
  kpiItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    borderBottomWidth: 0.3,
    borderBottomColor: '#E0DDD8',
  },
  kpiLabel: { fontSize: 8, color: '#888' },
  kpiValue: { fontSize: 9, color: '#2A2A2A', fontWeight: 400 },

  // Konfig-Zusammenfassung
  configRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F2F0EC',
    borderRadius: 4,
  },
  configItem: { fontSize: 8, color: '#555' },
  configValue: { fontWeight: 400, color: '#2A2A2A' },

  // Preisblock — rechts unten, prominent
  priceBlock: {
    alignItems: 'flex-end',
    marginTop: 'auto' as const,
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
  priceGrossLabel: { fontSize: 13, fontWeight: 400, color: '#2A2A2A', width: 80, textAlign: 'right' as const },
  priceGrossValue: { fontSize: 13, fontWeight: 400, color: '#2A2A2A', width: 80, textAlign: 'right' as const },

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
```

Key changes vs. old stylesheet:
- `fontFamily: 'Roboto'` + `fontWeight: 300` (Light) as body default
- `fontWeight: 400` (Regular) replaces `Helvetica-Bold` for emphasis
- `renderingImage.height: 310` (was 220) — ~45% of usable page height
- `midSection` is now `flexDirection: 'row'` (drawing + KPIs side-by-side, not stacked)
- New `kpiCol` + `kpiItem` for vertical KPI list beside drawing
- Removed all BOM-table styles (`bomTitle`, `bomTableHead`, `bomTableRow`, `bomCol*`, `bomHeadText`)
- `priceGross*` fontSize bumped to 13 for prominence
- Removed `pageNum` style (single page, no page numbers)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/features/pdf/DatasheetDocument.tsx
git commit -m "PDF: Stylesheet auf 1-Seite Verkaufs-Layout umstellen"
```

---

### Task 3: Remove BOM helpers and simplify component

**Files:**
- Modify: `src/features/pdf/DatasheetDocument.tsx` — remove `BomDisplayItem`, `buildBomDisplayItems`, update Props, rewrite JSX

- [ ] **Step 1: Remove BOM-related code**

Delete the following blocks entirely:
- `interface BomDisplayItem` (lines 173–177)
- `function buildBomDisplayItems(...)` (lines 180–240)

- [ ] **Step 2: Simplify Props interface**

Replace the existing `Props` interface with:

```typescript
interface Props {
  config: ConfigState;
  bom: BOMResult;
  grandTotal?: number;
  currency?: 'EUR' | 'CHF';
  screenshot3d?: string | null;
  moebelId?: string | null;
}
```

This stays the same — `bom` is still needed for the weight estimate (`activeCells * 8`). The `BOMResult` type is kept for backward-compatibility with the API route that passes it.

- [ ] **Step 3: Rewrite the DatasheetDocument component body**

Replace the entire `DatasheetDocument` function with:

```typescript
export function DatasheetDocument({ config, bom, grandTotal = 0, currency = 'EUR', screenshot3d, moebelId }: Props) {
  const matObj = MAT_BY_V[config.surface];
  const handleObj = HANDLE_BY_V[config.handle];
  const { totalW, totalH, activeCells } = getActiveDimensions(config);
  const ts = new Date().toLocaleDateString('de-DE');

  const sym = currency === 'CHF' ? 'CHF' : '€';
  const vatRate = currency === 'CHF' ? 0.081 : 0.19;
  const vatLabel = currency === 'CHF' ? '8,1 %' : '19 %';
  const netTotal = grandTotal;
  const grossTotal = netTotal + netTotal * vatRate;

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <Header ts={ts} moebelId={moebelId} />

        {/* ── 3D-Rendering (prominent, ~45% der Seite) ── */}
        {screenshot3d && (
          <View style={S.renderingWrap}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Image src={screenshot3d as any} style={S.renderingImage} />
          </View>
        )}

        {/* ── Maßzeichnung + Kennzahlen nebeneinander ── */}
        <View style={S.midSection}>
          <View style={S.drawingWrap}>
            <TechnicalDrawingView config={config} />
          </View>

          <View style={S.kpiCol}>
            {[
              { l: 'Breite', v: `${totalW + 30} mm` },
              { l: 'Höhe', v: `${totalH + 30} mm` },
              { l: 'Tiefe', v: `${config.depth} mm` },
              { l: 'Felder', v: `${activeCells}` },
              { l: 'Gewicht ca.', v: `~${Math.round(activeCells * 8)} kg` },
            ].map(k => (
              <View key={k.l} style={S.kpiItem}>
                <Text style={S.kpiLabel}>{k.l}</Text>
                <Text style={S.kpiValue}>{k.v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Konfig-Zusammenfassung ── */}
        <View style={S.configRow}>
          <Text style={S.configItem}>
            Oberfläche: <Text style={S.configValue}>{matObj?.l ?? 'Keine'}</Text>
          </Text>
          {handleObj && config.handle !== 'none' && (
            <Text style={S.configItem}>
              Griff: <Text style={S.configValue}>{handleObj.l}</Text>
            </Text>
          )}
          <Text style={S.configItem}>
            Tiefe: <Text style={S.configValue}>{config.depth} mm</Text>
          </Text>
        </View>

        {/* ── Preisblock — Netto + Brutto ── */}
        {netTotal > 0 && (
          <View style={S.priceBlock}>
            <View style={S.priceRow}>
              <Text style={S.priceLabel}>Netto</Text>
              <Text style={S.priceValue}>{fmt(netTotal)} {sym}</Text>
            </View>
            <View style={[S.priceRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: '#E0DDD8' }]}>
              <Text style={S.priceGrossLabel}>Brutto inkl. {vatLabel}</Text>
              <Text style={S.priceGrossValue}>{fmt(grossTotal)} {sym}</Text>
            </View>
          </View>
        )}

        <Footer ts={ts} />
      </Page>
    </Document>
  );
}
```

Key changes vs. old component:
- Single `<Page>` — no page 2
- No `bomItems` / BOM table rendering
- Price block simplified: Netto + Brutto only (no separate MwSt line — folded into "Brutto inkl. 19%")
- KPIs rendered in `kpiCol` beside drawing (side-by-side layout)
- `bom` param is still accepted but only used indirectly via `activeCells` for weight estimate

- [ ] **Step 4: Remove unused imports**

In the import block at the top, ensure these are removed if no longer used:
- `FOOTER_BY_V` from `@/core/constants` (was used in `buildBomDisplayItems`)
- `DimMap` from `@/core/types` (was used in `BomDisplayItem` / `addDimMap`)

The imports should now be:

```typescript
import type { BOMResult, ConfigState } from '@/core/types';
import { HANDLE_BY_V, MAT_BY_V } from '@/core/constants';
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/features/pdf/DatasheetDocument.tsx
git commit -m "PDF: Verkaufs-Datenblatt auf 1 Seite ohne Stückliste"
```

---

### Task 4: Visual verification and fine-tuning

**Files:**
- Modify: `src/features/pdf/DatasheetDocument.tsx` (style tweaks only)

- [ ] **Step 1: Start dev server and generate a test PDF**

Run: `npm run dev`

In the browser: configure a furniture piece (e.g. 2×2, 580mm depth, MDF weiß, Klappe + Schublade), commit BOM, click "Datenblatt" export.

- [ ] **Step 2: Check layout against spec**

Verify in the downloaded PDF:
1. **Header:** "ART" light + "MODUL" regular, date + Möbel-ID right-aligned
2. **3D-Rendering:** Large image, roughly upper half of page
3. **Drawing + KPIs:** Side by side, drawing left, KPI list right
4. **Config summary:** Gray bar with Oberfläche, Griff, Tiefe
5. **Price block:** Netto + Brutto at bottom-right, Brutto is larger/bolder
6. **Footer:** "Unverbindliche Konfiguration · MHZ Hachtel GmbH"
7. **Single page** — no page 2
8. **Font:** Roboto Light for body, Roboto Regular for emphasis text

- [ ] **Step 3: Adjust spacing if needed**

If the 3D image is too tall/short, adjust `renderingImage.height` (currently 310). Target: image fills ~45% of usable area (A4 usable ≈ 750pt, so ~340pt max).

If KPIs are cramped, adjust `kpiCol.gap` or `midSection.gap`.

If price block overlaps footer, reduce `renderingImage.height` or `midSection` margins.

- [ ] **Step 4: Test without price (customer role)**

Generate a datasheet without `grandTotal` (or `grandTotal = 0`). Verify:
- Price block is hidden
- Layout doesn't break (no empty space where price was)

- [ ] **Step 5: Test without 3D screenshot**

Generate a datasheet without `screenshot3d`. Verify:
- 3D section is absent
- Drawing + KPIs + config + price fill the page reasonably

- [ ] **Step 6: Commit final adjustments**

```bash
git add src/features/pdf/DatasheetDocument.tsx
git commit -m "PDF: Verkaufs-Datenblatt Layout-Feinschliff nach visueller Prüfung"
```

---

### Task 5: Verify API route compatibility

**Files:**
- Read only: `src/app/api/datasheet/route.ts`

- [ ] **Step 1: Read the datasheet API route**

Read `src/app/api/datasheet/route.ts` and verify it passes all props that `DatasheetDocument` expects:
- `config` ✓
- `bom` ✓
- `grandTotal` ✓
- `currency` ✓
- `screenshot3d` ✓
- `moebelId` ✓

No API route changes should be needed — the component signature is backward-compatible (same Props interface, `bom` still accepted).

- [ ] **Step 2: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit (only if build revealed issues to fix)**

```bash
git add src/features/pdf/DatasheetDocument.tsx
git commit -m "PDF: Verkaufs-Datenblatt Build-Kompatibilität sicherstellen"
```
