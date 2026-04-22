import type { BOMResult, Cell, CellType, ConfigState } from './types';

/** Dimensionsmap: Schlüssel = Maßbezeichnung, Wert = Menge */
type DimMap = Record<string, number>;
import { ELEMENT_SIZE_MM, HW_M4_PER_CUBE, HW_MUTTERN_PER_CUBE, HW_M6_PER_CUBE, HW_SCHEIBEN_PER_CUBE } from './constants';

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
  const { cols, rows, depthLayers, grid, footer, opts } = config;
  const nC = cols.length;
  const nR = rows.length;
  const nD = depthLayers;

  // Prüfe ob mindestens eine Zelle aktiv ist
  let hasActive = false;
  for (let r = 0; r < nR && !hasActive; r++)
    for (let c = 0; c < nC && !hasActive; c++)
      for (let d = 0; d < nD && !hasActive; d++)
        if (isActive(grid[r]?.[c]?.[d] ?? { type: '' as CellType, shelves: 0 })) hasActive = true;

  if (!hasActive) return null;

  // ── Würfel-Knoten-Matrix aufbauen ─────────────────────────────────────────
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
          if (isActive(grid[r]?.[c]?.[d] ?? { type: '' as CellType, shelves: 0 })) return true;
    return false;
  };

  // ── Würfel zählen ──────────────────────────────────────────────────────────
  let wuerfel = 0;
  for (let rk = 0; rk <= nR; rk++)
    for (let ck = 0; ck <= nC; ck++)
      for (let dk = 0; dk <= nD; dk++)
        if (nodeActive(rk, ck, dk)) wuerfel++;

  // ── Profile zählen ────────────────────────────────────────────────────────
  const S = ELEMENT_SIZE_MM;
  const pB: DimMap = {};  // horizontal (X/Breite)
  const pH: DimMap = {};  // vertikal (Y/Höhe)
  const pT: DimMap = {};  // Tiefe (Z)

  // BT-Hilfsfunktion (wird auch in der Profil-Schleife benoetigt)
  const isBTEarly = (r: number, c: number, d: number): boolean =>
    (grid[r]?.[c]?.[d]?.type ?? '') === 'BT';
  const btRk = nR - 1; // BT sitzt immer in der untersten Reihe

  // Horizontale Profile: verbinden Knoten (rk, ck, dk)↔(rk, ck+1, dk)
  for (let rk = 0; rk <= nR; rk++)
    for (let ck = 0; ck < nC; ck++)
      for (let dk = 0; dk <= nD; dk++)
        if (nodeActive(rk, ck, dk) && nodeActive(rk, ck + 1, dk))
          addDim(pB, String(S), 1);

  // Vertikale Profile: verbinden Knoten (rk, ck, dk)↔(rk+1, ck, dk)
  for (let rk = 0; rk < nR; rk++)
    for (let ck = 0; ck <= nC; ck++)
      for (let dk = 0; dk <= nD; dk++) {
        if (!nodeActive(rk, ck, dk) || !nodeActive(rk + 1, ck, dk)) continue;

        // BT-Split: wo 360+Wuerfel+213 ein 600mm-Profil ersetzt
        if (rk === btRk) {
          let hasBTAdj = false;
          for (let c2 = Math.max(0, ck - 1); c2 <= Math.min(nC - 1, ck); c2++)
            for (let d2 = Math.max(0, dk - 1); d2 <= Math.min(nD - 1, dk); d2++)
              if (isBTEarly(btRk, c2, d2)) hasBTAdj = true;

          if (hasBTAdj) {
            // Nur skippen wenn ein BT-Nachbar ein regulaeres Modul in derselben Spalte/Tiefe direkt darueber hat
            let hasRegAbove = false;
            if (btRk > 0) {
              for (let c2 = Math.max(0, ck - 1); c2 <= Math.min(nC - 1, ck); c2++)
                for (let d2 = Math.max(0, dk - 1); d2 <= Math.min(nD - 1, dk); d2++)
                  if (isBTEarly(btRk, c2, d2) && isActive(grid[btRk - 1]?.[c2]?.[d2] ?? { type: '' as CellType, shelves: 0 }) && !isBTEarly(btRk - 1, c2, d2))
                    hasRegAbove = true;
            }
            if (hasRegAbove) continue; // Skip — ersetzt durch 360+213
          }
        }

        addDim(pH, String(S), 1);
      }

  // Tiefenprofile: verbinden Knoten (rk, ck, dk)↔(rk, ck, dk+1)
  for (let rk = 0; rk <= nR; rk++)
    for (let ck = 0; ck <= nC; ck++)
      for (let dk = 0; dk < nD; dk++)
        if (nodeActive(rk, ck, dk) && nodeActive(rk, ck, dk + 1))
          addDim(pT, String(S), 1);

  const profileX = sumMap(pB);
  const profileY = sumMap(pH);
  const profileZ = sumMap(pT);
  const profileTotal = profileX + profileY + profileZ;

  // ── Einlegerahmen ─────────────────────────────────────────────────────────
  let framesStd = 0;
  let framesLit = 0;

  for (let r = 0; r < nR; r++)
    for (let c = 0; c < nC; c++)
      for (let d = 0; d < nD; d++) {
        const cell = grid[r]?.[c]?.[d] ?? { type: '' as CellType, shelves: 0 };
        if (cell.type === 'RF') framesStd++;
        else if (cell.type === 'RL') framesLit++;
      }

  const framesTotal = framesStd + framesLit;

  // ── Beratungstisch-Bauteile ─────────────────────────────────────────────
  let fachbodenBT = 0;
  let profil360 = 0;
  let profil213 = 0;
  let wuerfelBT = 0;
  let worktopProfileX = 0;
  let worktopProfileZ = 0;

  const isBT = (r: number, c: number, d: number): boolean =>
    (grid[r]?.[c]?.[d]?.type ?? '') === 'BT';

  // Zaehle BT-Zellen
  for (let r = 0; r < nR; r++)
    for (let c = 0; c < nC; c++)
      for (let d = 0; d < nD; d++) {
        if (!isBT(r, c, d)) continue;
        fachbodenBT += 3;
      }

  if (fachbodenBT > 0) {
    // Worktop-Knoten: aktiv wenn mind. eine angrenzende Zelle BT ist
    const btNodeActive = (rk: number, ck: number, dk: number): boolean => {
      for (let r2 = Math.max(0, rk - 1); r2 <= Math.min(nR - 1, rk); r2++)
        for (let c2 = Math.max(0, ck - 1); c2 <= Math.min(nC - 1, ck); c2++)
          for (let d2 = Math.max(0, dk - 1); d2 <= Math.min(nD - 1, dk); d2++)
            if (isBT(r2, c2, d2)) return true;
      return false;
    };

    // Zwischenwuerfel (Worktop-Niveau)
    for (let rk = 0; rk <= nR; rk++)
      for (let ck = 0; ck <= nC; ck++)
        for (let dk = 0; dk <= nD; dk++)
          if (btNodeActive(rk, ck, dk)) wuerfelBT++;

    // Worktop horizontale Profile X-Richtung
    for (let rk = 0; rk <= nR; rk++)
      for (let ck = 0; ck < nC; ck++)
        for (let dk = 0; dk <= nD; dk++)
          if (btNodeActive(rk, ck, dk) && btNodeActive(rk, ck + 1, dk))
            worktopProfileX++;

    // Worktop horizontale Profile Z-Richtung
    for (let rk = 0; rk <= nR; rk++)
      for (let ck = 0; ck <= nC; ck++)
        for (let dk = 0; dk < nD; dk++)
          if (btNodeActive(rk, ck, dk) && btNodeActive(rk, ck, dk + 1))
            worktopProfileZ++;

    // 360mm-Profile: je BT-Worktop-Knoten der auch ein Basis-Knoten ist
    for (let rk = 0; rk <= nR; rk++)
      for (let ck = 0; ck <= nC; ck++)
        for (let dk = 0; dk <= nD; dk++)
          if (btNodeActive(rk, ck, dk) && nodeActive(rk, ck, dk))
            profil360++;

    // 213mm-Profile: nur wo ein BT-Nachbar ein regulaeres Modul in derselben Spalte/Tiefe direkt darueber hat
    const btRow = nR - 1;
    for (let rk = 0; rk <= nR; rk++)
      for (let ck = 0; ck <= nC; ck++)
        for (let dk = 0; dk <= nD; dk++) {
          if (!btNodeActive(rk, ck, dk)) continue;
          let hasRegularAbove = false;
          if (btRow > 0) {
            for (let c2 = Math.max(0, ck - 1); c2 <= Math.min(nC - 1, ck); c2++)
              for (let d2 = Math.max(0, dk - 1); d2 <= Math.min(nD - 1, dk); d2++)
                if (isBT(btRow, c2, d2) && isActive(grid[btRow - 1]?.[c2]?.[d2] ?? { type: '' as CellType, shelves: 0 }) && !isBT(btRow - 1, c2, d2))
                  hasRegularAbove = true;
          }
          if (hasRegularAbove) profil213++;
        }
  }

  // ── Fachböden ──────────────────────────────────────────────────────────────
  let shelves = 0;
  for (let r = 0; r < nR; r++)
    for (let c = 0; c < nC; c++)
      for (let d = 0; d < nD; d++) {
        const cell = grid[r]?.[c]?.[d] ?? { type: '' as CellType, shelves: 0 };
        if (cell.type !== '' && cell.shelves > 0) {
          shelves += cell.shelves;
        }
      }

  // ── Stellfüße ─────────────────────────────────────────────────────────────
  let footerQty = 0;
  if (opts.footer !== false) {
    for (let ck = 0; ck <= nC; ck++)
      for (let dk = 0; dk <= nD; dk++)
        if (nodeActive(nR, ck, dk)) footerQty++;
  }

  // ── Board-Map ─────────────────────────────────────────────────────────────
  const boardMap: BOMResult['boardMap'] = {};
  for (let r = 0; r < nR; r++)
    for (let c = 0; c < nC; c++)
      for (let d = 0; d < nD; d++) {
        const cell = grid[r]?.[c]?.[d] ?? { type: '' as CellType, shelves: 0 };
        if (cell.type !== '') {
          boardMap[`frame_r${r}_c${c}_d${d}`] = {
            kategorie: 'einlegerahmen',
            isFront: d === 0,
          };
        }
      }

  // ── Produktrahmen ────────────────────────────────────────────────────
  const produktrahmen = Object.values(config.frames ?? {}).filter(Boolean).length;

  // ── Validierungswarnungen ─────────────────────────────────────────────────
  const warnings: string[] = [];
  if (nC > 8) warnings.push(`Maximalbreite überschritten (max. 8 Elemente, aktuell ${nC})`);
  if (nR > 5) warnings.push(`Maximalhöhe überschritten (max. 5 Elemente, aktuell ${nR})`);
  if (nD > 4) warnings.push(`Maximale Tiefe überschritten (max. 4 Ebenen, aktuell ${nD})`);

  // ── Rückgabe ──────────────────────────────────────────────────────────────
  return {
    wuerfel,
    profileX, profileY, profileZ, profileTotal,
    framesStd, framesLit, framesTotal,
    shelves,
    profil360, profil213, fachbodenBT, wuerfelBT,
    worktopProfileX, worktopProfileZ,
    produktrahmen,
    footerQty, footer,
    schraubenM4: (wuerfel + wuerfelBT) * HW_M4_PER_CUBE,
    schraubenM6: (wuerfel + wuerfelBT) * HW_M6_PER_CUBE,
    scheiben: (wuerfel + wuerfelBT) * HW_SCHEIBEN_PER_CUBE,
    einlegemuttern: (wuerfel + wuerfelBT) * HW_MUTTERN_PER_CUBE,
    numCols: nC, numRows: nR, numDepth: nD,
    totalWidth: nC * S, totalHeight: nR * S, totalDepth: nD * S,
    boardMap,
    warnings,
  };
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Erstellt eine leere Zelle */
export function emptyCell(): Cell {
  return { type: '' as CellType, shelves: 0 };
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
