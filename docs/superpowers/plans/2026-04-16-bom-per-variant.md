# BOM Per-Variant Line Items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each unique combination of (board category, dimension, effective surface, cable hole) becomes a separate BOM line item — in the UI, in XLS export, and in pricing.

**Architecture:** New pure function `computeBoardVariants(config)` in `src/core/variants.ts` iterates over all cells, enumerates every board (mirroring computeBOM's counting logic), resolves the effective surface per board (partColors → cellColors → global), checks cable holes, and groups into `BoardVariant[]`. This replaces the old DimMap-based display. computeBOM() itself stays unchanged for structural totals (hardware, profiles). BOMPanel, API route, and XLS export all consume the new variants array.

**Tech Stack:** TypeScript (pure functions, no React deps in core)

**Spec:** User requirement: "Jede Platte in jeder Farbe muss in der BOM als eigene Zeile auftauchen."

---

### Task 1: Create BoardVariant type and computeBoardVariants()

**Files:**
- Create: `src/core/variants.ts`

- [ ] **Step 1: Create the variants module**

```typescript
/**
 * Board-Varianten: Aufschlüsselung der BOM nach effektiver Oberfläche + Kabeldurchlass.
 * Jede einzigartige Kombination (Kategorie, Dimension, Oberfläche, Kabel) = eine BOM-Zeile.
 */

import type { ConfigState, CellType } from './types';
import { MATERIALS, MAT_BY_V } from './constants';

export interface BoardVariant {
  /** BOM-Kategorie für Preislookup: 'Boden', 'Klappenboden', 'Rücken', etc. */
  kategorie: string;
  /** Anzeige-Label: 'Boden', 'Klappenboden', 'Rücken', 'Seite außen', etc. */
  label: string;
  /** Dimension: '580×360' */
  dim: string;
  /** MATERIALS[].v — effektiver Oberflächen-Code */
  surfaceCode: string;
  /** MATERIALS[].l — Anzeigename der Oberfläche */
  surfaceLabel: string;
  /** Preisgruppe: 'PG1', 'PG2', 'PG3', 'PG4' */
  pg: string;
  /** Menge */
  qty: number;
  /** Kabeldurchlass vorhanden */
  hasCable: boolean;
}

// ── ID-Mapping: SceneObject-IDs (partColors) ↔ BoardMap-IDs (cableHoles) ─────

/** SceneObject-ID für partColors-Lookup */
function sceneId(partType: string, r: number, c: number): string {
  return `${partType}_r${r}_c${c}`;
}

/** BoardMap-ID für cableHoles-Lookup */
function boardId(boardType: string, r: number, c: number): string {
  return `${boardType}_r${r}_c${c}`;
}

// ── Oberflächen-Auflösung ────────────────────────────────────────────────────

interface ResolvedSurface {
  code: string;    // MATERIALS[].v
  label: string;   // MATERIALS[].l
  pg: string;      // 'PG1'...'PG4'
}

/** Findet Material anhand Hex-Farbe */
function matByHex(hex: string): ResolvedSurface | null {
  const mat = MATERIALS.find(m => m.hex === hex);
  if (!mat) return null;
  return { code: mat.v, label: mat.l, pg: mat.pg };
}

/** Löst die effektive Oberfläche eines Boards auf: partColors → cellColors → global */
function resolveSurface(
  sceneObjId: string,
  row: number, col: number,
  config: ConfigState,
): ResolvedSurface {
  // Priorität 1: individuelle Plattenfarbe
  const partHex = config.partColors[sceneObjId];
  if (partHex) {
    const m = matByHex(partHex);
    if (m) return m;
  }

  // Priorität 2: Element-Farbe (pro Zelle)
  const cellHex = config.cellColors[`${row}_${col}`];
  if (cellHex) {
    const m = matByHex(cellHex);
    if (m) return m;
  }

  // Priorität 3: globale Oberfläche
  const mat = MAT_BY_V[config.surface];
  if (mat) return { code: mat.v, label: mat.l, pg: mat.pg };

  return { code: 'none', label: 'Keine', pg: 'PG1' };
}

// ── Hilfsfunktion ────────────────────────────────────────────────────────────

function occ(grid: ConfigState['grid'], r: number, c: number): boolean {
  return (grid[r]?.[c]?.type ?? '') !== '';
}

// ── Hauptfunktion ────────────────────────────────────────────────────────────

/**
 * Berechnet Board-Varianten: jede einzigartige Kombination von
 * (Kategorie, Dimension, Oberfläche, Kabeldurchlass) wird eine BOM-Zeile.
 *
 * Die Board-Zählung spiegelt exakt die Logik in computeBOM() wider.
 */
export function computeBoardVariants(config: ConfigState): BoardVariant[] {
  const { cols: CW, rows: RH, depth: D, grid, opts } = config;
  const B = CW.length, H = RH.length;
  const cableHoles = config.cableHoles ?? {};

  // Akkumulator: "kategorie|dim|surfaceCode|cable" → BoardVariant
  const acc: Record<string, BoardVariant> = {};

  function add(
    kategorie: string,
    label: string,
    dim: string,
    surface: ResolvedSurface,
    cable: boolean,
    count: number = 1,
  ) {
    const key = `${kategorie}|${dim}|${surface.code}|${cable ? '1' : '0'}`;
    if (!acc[key]) {
      acc[key] = { kategorie, label, dim, surfaceCode: surface.code, surfaceLabel: surface.label, pg: surface.pg, qty: 0, hasCable: cable };
    }
    acc[key].qty += count;
  }

  // ── Böden (horizontale Grenzen, identisch mit computeBOM pB/bStd-Logik) ────
  // Jede aktive horizontale Grenze (rb) pro Spalte = 1 Bodenplatte
  for (let c = 0; c < B; c++) {
    for (let rb = 0; rb <= H; rb++) {
      const above = occ(grid, rb - 1, c);
      const below = occ(grid, rb, c);
      if (!above && !below) continue;

      const dim = `${CW[c]}×${D}`;

      // Board-Zuordnung: Boden gehört zur Zelle darunter (rb) oder darüber (rb-1)
      // Für Farbe/Kabel: nehme die Zelle die den Boden „besitzt"
      const ownerR = below ? rb : rb - 1;
      const ownerC = c;

      // Klappenboden-Erkennung: wenn die Zelle darunter eine Klappe ist
      const isKlappenboden = below && grid[rb]?.[c]?.type === 'K';
      const kat = isKlappenboden ? 'Klappenboden' : 'Boden';
      const lbl = isKlappenboden ? 'Klappenboden' : 'Boden';

      // SceneObject-ID für partColors
      const partType = rb === 0 ? 'deckel' : rb === H ? 'boden' : 'zwischenboden';
      const sid = sceneId(partType, ownerR, ownerC);
      const surface = resolveSurface(sid, ownerR, ownerC, config);

      // cableHoles-ID
      const btype = rb === 0 ? 'top' : 'bottom';
      const bid = boardId(btype, ownerR, ownerC);
      const cable = !!cableHoles[bid];

      add(kat, lbl, dim, surface, cable);
    }
  }

  // ── Rücken ─────────────────────────────────────────────────────────────────
  if (opts.back) {
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < B; c++) {
        if (!occ(grid, r, c)) continue;
        const dim = `${CW[c]}×${RH[r]}`;
        const sid = sceneId('ruecken', r, c);
        const surface = resolveSurface(sid, r, c, config);
        const cable = !!cableHoles[boardId('back', r, c)];
        add('Rücken', 'Rücken', dim, surface, cable);
      }
    }
  }

  // ── Seiten außen (2 pro aktive Zeile) ──────────────────────────────────────
  if (opts.outer) {
    for (let r = 0; r < H; r++) {
      if (!CW.some((_, c) => occ(grid, r, c))) continue;
      const hasShelves = CW.some((_, c) => (grid[r][c]?.shelves ?? 0) > 0);
      const kat = hasShelves ? 'Seite außen SY32' : 'Seite außen';
      const dim = `${RH[r]}×${D}`;

      // Linke Außenseite
      const minC = CW.findIndex((_, c) => occ(grid, r, c));
      const sidL = sceneId('seite_l', r, minC);
      const surfL = resolveSurface(sidL, r, minC, config);
      const cableL = !!cableHoles[boardId('side_l', r, minC)];
      add(kat, kat, dim, surfL, cableL);

      // Rechte Außenseite
      let maxC = 0;
      for (let c = B - 1; c >= 0; c--) { if (occ(grid, r, c)) { maxC = c; break; } }
      const sidR = sceneId('seite_r', r, maxC);
      const surfR = resolveSurface(sidR, r, maxC, config);
      const cableR = !!cableHoles[boardId('side_r', r, maxC)];
      add(kat, kat, dim, surfR, cableR);
    }
  }

  // ── Seiten innen (Zwischenwände) ───────────────────────────────────────────
  if (opts.inner) {
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < B - 1; c++) {
        if (!occ(grid, r, c) || !occ(grid, r, c + 1)) continue;
        const hasShelves = (grid[r][c]?.shelves ?? 0) > 0 || (grid[r][c + 1]?.shelves ?? 0) > 0;
        const kat = hasShelves ? 'Seite innen SY32' : 'Seite innen';
        const dim = `${RH[r]}×${D}`;
        // Zwischenwand gehört kanonisch zur rechten Seite der linken Zelle
        const sid = sceneId('zwischenwand', r, c);
        const surface = resolveSurface(sid, r, c, config);
        const cable = !!cableHoles[boardId('side_r', r, c)];
        add(kat, kat, dim, surface, cable);
      }
    }
  }

  // ── Fachböden ──────────────────────────────────────────────────────────────
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < B; c++) {
      if (!occ(grid, r, c)) continue;
      const sh = grid[r][c].shelves ?? 0;
      if (sh <= 0) continue;
      const dim = `${CW[c]}×${D}`;
      // Fachböden haben keine individuelle partColor (kein SceneObject)
      const surface = resolveSurface('', r, c, config);
      add('Fachboden klein', 'Fachboden', dim, surface, false, sh);
    }
  }

  // ── Fronten ────────────────────────────────────────────────────────────────
  const frontKat: Record<string, string> = {
    K: 'Klappe', S: 'Schublade', TR: 'Tür', TL: 'Tür', DT: 'Doppeltür',
  };
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < B; c++) {
      const t = grid[r][c].type;
      if (t === '' || t === 'O') continue;
      const kat = frontKat[t] ?? t;
      const dim = `${CW[c]}×${RH[r]}`;
      const bl = t === 'DT' ? 2 : 1; // Doppeltür = 2 Blätter
      const sid = sceneId('front', r, c);
      const surface = resolveSurface(sid, r, c, config);
      const cable = false; // Fronten haben keinen Kabeldurchlass
      add(kat, kat, dim, surface, cable, bl);
    }
  }

  return Object.values(acc);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/core/variants.ts
git commit -m "BOM: computeBoardVariants() — Platten nach Oberfläche + Kabel aufschlüsseln"
```

---

### Task 2: Update BOMPanel to display board variants

**Files:**
- Modify: `src/features/bom/BOMPanel.tsx`

The BOMPanel currently iterates over DimMaps (bStd, bKl, rMap, etc.) to display board rows. Replace the board section with a loop over `computeBoardVariants()` output.

- [ ] **Step 1: Read current BOMPanel.tsx**

Read the file to understand the current display logic. Key things to change:
- Import `computeBoardVariants` from `@/core/variants`
- Call `computeBoardVariants(state)` alongside the existing `computeBOM(state)`
- Replace the DimMap iteration for boards/fronts with a grouped loop over `BoardVariant[]`
- Keep profile, hardware, footer sections unchanged (they don't have surface variants)

- [ ] **Step 2: Add import and compute variants**

Add import:
```typescript
import { computeBoardVariants } from '@/core/variants';
```

In the component, add alongside the existing `bom` memo:
```typescript
const boardVariants = useMemo(
  () => computeBoardVariants(state),
  [state],
);
```

- [ ] **Step 3: Replace board display section**

Replace the DimMap iteration for boards (bStd, bKl, rMap, sAMap, etc.) and fronts (fMap) with:

```typescript
{/* ── Platten + Fronten: per Variante (Oberfläche + Kabel) ── */}
{boardVariants.map((v, i) => (
  <div key={`${v.kategorie}|${v.dim}|${v.surfaceCode}|${v.hasCable ? '1' : '0'}`}
    style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0',
      borderBottom: '1px solid #F0EDE8', fontSize: 11 }}>
    <div style={{ flex: 1 }}>
      <span style={{ color: '#36342F' }}>{v.label} {v.dim}mm</span>
      <span style={{ color: '#A8A49C', marginLeft: 6 }}>{v.surfaceLabel}</span>
      {v.hasCable && <span style={{ color: '#3B82F6', marginLeft: 4 }}>⊡ Kabel</span>}
    </div>
    <span style={{ color: '#36342F', fontWeight: 500, minWidth: 30, textAlign: 'right' }}>{v.qty}×</span>
  </div>
))}
```

Keep the existing sections for: Würfel, Profile, Griffe, Beschläge, Füße (these don't have surface variants).

- [ ] **Step 4: Verify TypeScript compiles and test visually**

Run: `npx tsc --noEmit`
Run: `npm run dev` — check BOM drawer shows per-variant rows

- [ ] **Step 5: Commit**

```bash
git add src/features/bom/BOMPanel.tsx
git commit -m "BOM: Panel zeigt Platten per Oberfläche + Kabeldurchlass aufgeschlüsselt"
```

---

### Task 3: Update API route to price per variant

**Files:**
- Modify: `src/app/api/bom/route.ts`

The API route currently prices boards by DimMap dimension. Change it to use `computeBoardVariants()` for board/front pricing — each variant gets its own PG-based price lookup.

- [ ] **Step 1: Read current API route**

Read the file. Key changes:
- Import `computeBoardVariants`
- Replace the DimMap iteration (bStd, bKl, rMap, sAMap, sIMap, fbMap, fMap) with a loop over variants
- Each variant has its own `pg` → use that for price lookup
- Keep Würfel, Profile, Griffe, Füße sections unchanged

- [ ] **Step 2: Add import**

```typescript
import { computeBoardVariants } from '@/core/variants';
```

- [ ] **Step 3: Compute variants and replace board pricing**

After `const bom = computeBOM(config)`, add:
```typescript
const variants = computeBoardVariants(config);
```

Replace the entire board/front pricing section (the DimMap loops for bStd, bKl, rMap, sAMap, sAMapSY32, sIMap, sIMapSY32, fbMap, fMap — lines ~284-362) with:

```typescript
  // ── Platten + Fronten — per Variante (Oberfläche + Kabel) ─────────────────
  for (const v of variants) {
    const [b, t] = parseDim(v.dim);
    const row = lookup(priceMap, v.kategorie, b, t);
    if (!row) {
      if (v.qty > 0) missingItems.push(`${v.label} ${v.dim}mm (${v.qty}×)`);
      continue;
    }

    const up = unitPrice(row, v.pg, currency);
    if (up === null) {
      missingItems.push(`${v.label} ${v.dim}mm — kein Preis in ${v.pg}/${currency}`);
      continue;
    }

    const finalUp = priceType === 'EK' ? up * (1 - discountPct) : up;
    const label = `${v.label} ${v.dim}mm`;
    const surfaceSuffix = v.surfaceLabel !== 'Keine' ? ` · ${v.surfaceLabel}` : '';
    const cableSuffix = v.hasCable ? ' · Kabeldurchlass' : '';

    items.push({
      art_nr: row.art_nr,
      bezeichnung: `${label}${surfaceSuffix}${cableSuffix}`,
      kategorie: v.kategorie,
      qty: v.qty,
      unit_price: Math.round(finalUp * 100) / 100,
      total_price: Math.round(finalUp * v.qty * 100) / 100,
      dim_key: v.dim,
    });
  }
```

Also remove the now-unused `boardPg()` function and `catOverrideRemaining` tracking (the variant already resolves the correct PG).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/app/api/bom/route.ts
git commit -m "BOM API: Preisberechnung per Oberflächen-Variante statt per Dimension"
```

---

### Task 4: Update XLS export to use variants

**Files:**
- Modify: `src/features/bom/exportXLS.ts`

The XLS export currently uses `rCatSplit()` to generate board rows from DimMaps with optional catOverride splits. Replace with variant-based rows.

- [ ] **Step 1: Read current exportXLS.ts**

Read the file. Key changes to `buildBOMRowsExtended()`:
- Accept `BoardVariant[]` as a new parameter
- Replace the DimMap loops (bStd, bKl, rMap, sAMap, etc.) and `rCatSplit()` calls with a loop over variants
- Each variant becomes one XLS row with its own surface label and cable flag
- Keep profile, hardware, footer sections unchanged

- [ ] **Step 2: Update function signature**

Add import:
```typescript
import type { BoardVariant } from '@/core/variants';
```

Add `variants: BoardVariant[]` parameter to `buildBOMRowsExtended()`.

- [ ] **Step 3: Replace board/front rows with variant rows**

Replace the DimMap loops and `rCatSplit` calls for boards and fronts with:

```typescript
  // ── Platten + Fronten — eine Zeile pro Variante (Oberfläche + Kabel) ──────
  for (const v of variants) {
    const [laenge, breite] = splitDim(v.dim);
    const surfLabel = v.surfaceLabel !== 'Keine' ? v.surfaceLabel : globalSurfColor;
    const row = [
      artNr(v.kategorie, v.dim),
      moebelId ?? '—',
      v.kategorie === 'Klappe' || v.kategorie === 'Schublade' || v.kategorie === 'Tür' || v.kategorie === 'Doppeltür' ? 'Fronten' : 'Platten',
      v.label,
      laenge,
      breite,
      String(v.qty),
      surfLabel,
    ];
    if (hasKabelData) row.push(v.hasCable ? 'Ja' : '—');
    if (v.surfaceLabel !== globalSurfColor && v.surfaceLabel !== 'Keine') {
      overrideRows.add(rows.length);
    }
    rows.push(row);
  }
```

Remove the `rCatSplit()` function (no longer needed).

- [ ] **Step 4: Update BOMPanel to pass variants to buildBOMRowsExtended()**

In BOMPanel.tsx, where `buildBOMRowsExtended()` is called for XLS export, add the `boardVariants` argument.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/features/bom/exportXLS.ts src/features/bom/BOMPanel.tsx
git commit -m "BOM XLS: Export mit per-Variante Zeilen (Oberfläche + Kabel pro Platte)"
```

---

### Task 5: Build verification and visual test

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Visual test**

Run: `npm run dev`

Test scenario:
1. Konfiguriere ein 2×2 Möbel mit globaler Oberfläche "Kunstharz weiß"
2. Drill-Down auf ein Element → setze Elementfarbe auf "Nussbaum"
3. Drill-Down auf eine einzelne Platte → setze Plattenfarbe auf "Eiche"
4. Setze einen Kabeldurchlass auf einer Bodenplatte
5. Öffne die Stückliste (Drawer)

Erwartetes Ergebnis:
- Boden-Zeilen aufgeteilt: z.B. "Boden 580×360mm · Kunstharz weiß: 4×", "Boden 580×360mm · Nussbaum: 1×", "Boden 580×360mm · Eiche · Kabel: 1×"
- Rücken-Zeilen analog aufgeteilt
- Preise pro Variante korrekt (PG1 für Kunstharz, PG3 für Nussbaum, PG3 für Eiche)
- XLS-Export enthält separate Zeilen pro Variante

- [ ] **Step 4: Commit if fixes needed**

```bash
git add -A
git commit -m "BOM per-Variante: Feinschliff nach visueller Prüfung"
```
