import type { BOMResult, BomCatOverride, Cell, ConfigState, DimMap, Footer } from './types';
import { ELEMENT_SIZE_MM, FOOTER_BY_V } from './constants';

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function addDim(map: DimMap, key: string, qty: number): void {
  map[key] = (map[key] ?? 0) + qty;
}

function sumMap(map: DimMap): number {
  return Object.values(map).reduce((a, b) => a + b, 0);
}

/** Gibt true zurück, wenn die Zelle ein Teil des Gerüsts ist (nicht leer) */
function isActive(cell: Cell): boolean {
  return cell.type !== '';
}

// ─── Hauptfunktion ────────────────────────────────────────────────────────────

/**
 * computeBOM(config) → BOMResult | null
 *
 * Berechnet die vollständige Stückliste für eine Lightmodul-Konfiguration.
 * Gibt null zurück wenn keine Zellen aktiv sind.
 *
 * Systemlogik Lightmodul:
 *   - Festes Rastermaß: 600 × 600 × 600 mm
 *   - Profile 25×25mm Alu, Länge immer 600mm
 *   - Alu-Würfel 27mm an jedem Knotenpunkt des aktiven Gerüsts
 *   - 3D-Grid: grid[row][col][depth]
 *
 * Profil-Zähllogik:
 *   Ein Profil wird zwischen zwei Knoten platziert, wenn beide Knoten aktiv sind.
 *   Ein Knoten ist aktiv wenn mindestens eine angrenzende Zelle aktiv ist.
 */
export function computeBOM(config: ConfigState): BOMResult | null {
  const { cols, rows, depthLayers, grid, footer, opts, catOverrides, partColors } = config;
  const nC = cols.length;
  const nR = rows.length;
  const nD = depthLayers;

  // Prüfe ob mindestens eine Zelle aktiv ist
  let hasActive = false;
  for (let r = 0; r < nR && !hasActive; r++)
    for (let c = 0; c < nC && !hasActive; c++)
      for (let d = 0; d < nD && !hasActive; d++)
        if (isActive(grid[r]?.[c]?.[d] ?? { type: '', frameGroup: '', shelves: 0 })) hasActive = true;

  if (!hasActive) return null;

  // ── Würfel-Knoten-Matrix aufbauen ─────────────────────────────────────────
  //
  // Ein Knoten (rk, ck, dk) ist aktiv wenn mindestens eine der bis zu 8
  // angrenzenden Zellen aktiv ist.
  // Knoten-Koordinaten: rk ∈ [0..nR], ck ∈ [0..nC], dk ∈ [0..nD]
  // Zelle (r,c,d) liegt zwischen Knoten (r,c,d) und (r+1,c+1,d+1)

  const nodeActive = (rk: number, ck: number, dk: number): boolean => {
    const rMin = Math.max(0, rk - 1);
    const rMax = Math.min(nR - 1, rk);
    const cMin = Math.max(0, ck - 1);
    const cMax = Math.min(nC - 1, ck);
    const dMin = Math.max(0, dk - 1);
    const dMax = Math.min(nD - 1, dk);
    for (let r = rMin; r <= rMax; r++)
      for (let c = cMin; c <= cMax; c++)
        for (let d = dMin; d <= dMax; d++)
          if (isActive(grid[r]?.[c]?.[d] ?? { type: '', frameGroup: '', shelves: 0 })) return true;
    return false;
  };

  // ── Würfel zählen ──────────────────────────────────────────────────────────
  let wuerfel = 0;
  for (let rk = 0; rk <= nR; rk++)
    for (let ck = 0; ck <= nC; ck++)
      for (let dk = 0; dk <= nD; dk++)
        if (nodeActive(rk, ck, dk)) wuerfel++;

  // ── Profile zählen ────────────────────────────────────────────────────────
  const S = ELEMENT_SIZE_MM; // 600mm
  const pB: DimMap = {};  // horizontal (X/Breite)
  const pH: DimMap = {};  // vertikal (Y/Höhe)
  const pT: DimMap = {};  // Tiefe (Z)

  // Horizontale Profile: verbinden Knoten (rk, ck, dk)↔(rk, ck+1, dk)
  for (let rk = 0; rk <= nR; rk++)
    for (let ck = 0; ck < nC; ck++)
      for (let dk = 0; dk <= nD; dk++)
        if (nodeActive(rk, ck, dk) && nodeActive(rk, ck + 1, dk))
          addDim(pB, String(S), 1);

  // Vertikale Profile: verbinden Knoten (rk, ck, dk)↔(rk+1, ck, dk)
  for (let rk = 0; rk < nR; rk++)
    for (let ck = 0; ck <= nC; ck++)
      for (let dk = 0; dk <= nD; dk++)
        if (nodeActive(rk, ck, dk) && nodeActive(rk + 1, ck, dk))
          addDim(pH, String(S), 1);

  // Tiefenprofile: verbinden Knoten (rk, ck, dk)↔(rk, ck, dk+1)
  for (let rk = 0; rk <= nR; rk++)
    for (let ck = 0; ck <= nC; ck++)
      for (let dk = 0; dk < nD; dk++)
        if (nodeActive(rk, ck, dk) && nodeActive(rk, ck, dk + 1))
          addDim(pT, String(S), 1);

  const pBt = sumMap(pB);
  const pHt = sumMap(pH);
  const pTt = sumMap(pT);
  const pGes = pBt + pHt + pTt;

  // ── Stoppfen (Profilenden-Stopfen) ────────────────────────────────────────
  // Vereinfachte Näherung: 4 Stopfen pro Würfel an den Außenkanten
  // Exaktere Berechnung: Anzahl Profilenden ohne Nachbar-Würfel
  const stoppfen = wuerfel * 4;

  // ── Einlegerahmen ─────────────────────────────────────────────────────────
  const framesStd: Record<string, number> = {};
  const framesLit: Record<string, number> = {};
  let framesStdTotal = 0;
  let framesLitTotal = 0;

  for (let r = 0; r < nR; r++) {
    for (let c = 0; c < nC; c++) {
      for (let d = 0; d < nD; d++) {
        const cell = grid[r]?.[c]?.[d] ?? { type: '', frameGroup: '', shelves: 0 };
        if (cell.type === 'RF') {
          const grp = cell.frameGroup || 'XX';
          framesStd[grp] = (framesStd[grp] ?? 0) + 1;
          framesStdTotal++;
        } else if (cell.type === 'RL') {
          const grp = cell.frameGroup || 'XX';
          framesLit[grp] = (framesLit[grp] ?? 0) + 1;
          framesLitTotal++;
        }
      }
    }
  }

  const framesGes = framesStdTotal + framesLitTotal;

  // ── Fachböden ──────────────────────────────────────────────────────────────
  const fbMap: DimMap = {};
  let fbT = 0;

  for (let r = 0; r < nR; r++)
    for (let c = 0; c < nC; c++)
      for (let d = 0; d < nD; d++) {
        const cell = grid[r]?.[c]?.[d] ?? { type: '', frameGroup: '', shelves: 0 };
        if (cell.type !== '' && cell.shelves > 0) {
          addDim(fbMap, `${S}×${S}`, cell.shelves);
          fbT += cell.shelves;
        }
      }

  // ── Stellfüße ─────────────────────────────────────────────────────────────
  // Anzahl Stellfüße = aktive Knoten an der untersten Reihe (rk = nR)
  let footerQty = 0;
  if (opts.footer !== false) {
    for (let ck = 0; ck <= nC; ck++)
      for (let dk = 0; dk <= nD; dk++)
        if (nodeActive(nR, ck, dk)) footerQty++;
  }
  const footerObj: Footer | Record<string, never> = FOOTER_BY_V[footer] ?? {};

  // ── Verbindungshardware ────────────────────────────────────────────────────
  // Pro Würfel: Adapter-Kit
  //   4 × Senkschrauben M4×8 (für Würfel-Adapter-Montage)
  //   4 × Einlegemuttern für Adapter
  //   2 × Zylinderschrauben M6×40 (Profilverbindung)
  //   2 × U-Scheiben D6,4
  const schraubenM4    = wuerfel * 4;
  const einlegemuttern = wuerfel * 4;
  const schraubenM6    = wuerfel * 2;
  const scheiben       = schraubenM6;
  const beschlGes      = schraubenM4 + einlegemuttern + schraubenM6 + scheiben;

  // ── Board-Map ─────────────────────────────────────────────────────────────
  const boardMap: BOMResult['boardMap'] = {};
  for (let r = 0; r < nR; r++)
    for (let c = 0; c < nC; c++)
      for (let d = 0; d < nD; d++) {
        const cell = grid[r]?.[c]?.[d] ?? { type: '', frameGroup: '', shelves: 0 };
        if (cell.type !== '') {
          boardMap[`frame_r${r}_c${c}_d${d}`] = {
            kategorie: 'einlegerahmen',
            isFront: d === 0,
          };
        }
      }

  // ── Validierungswarnungen ─────────────────────────────────────────────────
  const warns: string[] = [];
  if (nC > 8) warns.push(`Maximalbreite überschritten (max. 8 Elemente, aktuell ${nC})`);
  if (nR > 5) warns.push(`Maximalhöhe überschritten (max. 5 Elemente, aktuell ${nR})`);
  if (nD > 4) warns.push(`Maximale Tiefe überschritten (max. 4 Ebenen, aktuell ${nD})`);

  // ── Rückgabe ──────────────────────────────────────────────────────────────
  const emptyDimMap: DimMap = {};
  const resolvedCatOverrides: Record<string, BomCatOverride> = catOverrides ?? {};

  return {
    wuerfel,
    pB, pH, pT,
    pBt, pHt, pTt, pGes,
    numCols: nC, numRows: nR, numDepth: nD,
    totalWidth:  nC * S, totalHeight: nR * S, totalDepth: nD * S,
    framesStd, framesStdTotal, framesLit, framesLitTotal, framesGes,
    fbMap, fbT,
    footerQty, footer, footerObj,
    schraubenM4, schraubenM6, scheiben, einlegemuttern, beschlGes,
    stoppfen,
    boardMap,
    catOverrides: resolvedCatOverrides,
    partColors:   partColors ?? {},
    colorSplits:  {},
    warns,
    // Kompatibilitäts-Aliases
    frontGes:      framesGes,
    cableHolesQty: 0,
    bomKabelQty:   0,
    handle:        '',
    handleObj:     {},
    D:             nD * S,
    activeCols:    cols,
    activeRows:    rows,
    Bact:          nC * S,
    Hact:          nR * S,
    bStd: emptyDimMap, bKl: emptyDimMap, bStdT: 0, bKlT: 0,
    rMap: emptyDimMap, rT: 0,
    sAMap: emptyDimMap, sAT: 0, sAMapSY32: emptyDimMap, sATsy: 0,
    sIMap: emptyDimMap, sIT: 0, sIMapSY32: emptyDimMap, sITsy: 0,
    plattenGes: 0,
    fMap: {}, nK: 0, nS: 0, nTR: 0, nTL: 0, nDT: 0, totalSch: 0,
    bolzen: 0, klemm: 0, scharn: 0, kHalt: 0, kDaem: 0, schubF: 0,
  };
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Erstellt eine leere Zelle */
export function emptyCell(): Cell {
  return { type: '', frameGroup: '', shelves: 0 };
}

/** Erstellt ein leeres 3D-Grid mit den angegebenen Dimensionen */
export function createEmptyGrid(
  nR: number,
  nC: number,
  nD: number,
): import('./types').Grid {
  return Array.from({ length: nR }, () =>
    Array.from({ length: nC }, () =>
      Array.from({ length: nD }, emptyCell),
    ),
  );
}
