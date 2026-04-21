import type { CellType, Grid } from './types';
import { MAX_COLS, MAX_ROWS, MAX_DEPTH, MIN_COLS, MIN_ROWS, MIN_DEPTH } from './constants';

// ─── Zell-Validierung ─────────────────────────────────────────────────────────

/**
 * Prueft ob Position (r, c, d) von einem Beratungstisch darunter gesperrt ist.
 * Ein BT bei (r+1, c, d) sperrt (r, c, d).
 */
export function isBTBlocked(grid: Grid, r: number, c: number, d: number): boolean {
  const cellBelow = grid[r + 1]?.[c]?.[d];
  return cellBelow?.type === 'BT';
}

/**
 * Prueft ob eine Zelle am Rand des aktiven Grids liegt.
 * "Am Rand" = mindestens eine Nachbarposition (links, rechts, vorne, hinten)
 * ist leer oder ausserhalb des Grids.
 */
export function isEdgeCell(grid: Grid, r: number, c: number, d: number, nC: number, nD: number): boolean {
  // Links
  if (c === 0 || (grid[r]?.[c - 1]?.[d]?.type ?? '') === '') return true;
  // Rechts
  if (c === nC - 1 || (grid[r]?.[c + 1]?.[d]?.type ?? '') === '') return true;
  // Vorne
  if (d === 0 || (grid[r]?.[c]?.[d - 1]?.type ?? '') === '') return true;
  // Hinten
  if (d === nD - 1 || (grid[r]?.[c]?.[d + 1]?.type ?? '') === '') return true;
  return false;
}

/**
 * Gibt zurück ob ein Zelltyp für die gegebene Position gültig ist.
 */
export function canPlace(
  r: number,
  c: number,
  d: number,
  type: CellType,
  grid?: Grid,
  nC?: number,
  nD?: number,
): boolean {
  // Nicht-BT: gesperrt wenn BT darunter
  if (type !== '' && type !== 'BT' && grid && isBTBlocked(grid, r, c, d)) {
    return false;
  }
  // BT-Regeln
  if (type === 'BT' && grid && nC !== undefined && nD !== undefined) {
    const nR = grid.length;
    // Nur unterste Reihe
    if (r !== nR - 1) return false;
    // Muss am Rand stehen
    if (!isEdgeCell(grid, r, c, d, nC, nD)) return false;
    // Zelle darueber muss frei sein (oder Grid wird erweitert)
    if (r > 0) {
      const above = grid[r - 1]?.[c]?.[d];
      if (above && above.type !== '' && above.type !== 'BT') return false;
    }
  }
  return true;
}

/**
 * Gibt alle erlaubten Zelltypen für eine Position zurück.
 */
export function getAvailableCellTypes(
  r?: number,
  c?: number,
  d?: number,
  grid?: Grid,
  nC?: number,
  nD?: number,
): CellType[] {
  const base: CellType[] = ['', 'O', 'RF', 'RL'];
  // BT nur wenn Position gueltig
  if (grid && r !== undefined && c !== undefined && d !== undefined && nC !== undefined && nD !== undefined) {
    if (isBTBlocked(grid, r, c, d)) {
      return []; // Gesperrte Zelle — kein Typ erlaubt
    }
    if (canPlace(r, c, d, 'BT', grid, nC, nD)) {
      base.push('BT');
    }
  }
  return base;
}

// ─── Grid-Grenzen ─────────────────────────────────────────────────────────────

export function canAddCol(cols: number[]): boolean {
  return cols.length < MAX_COLS;
}

export function canRemoveCol(cols: number[]): boolean {
  return cols.length > MIN_COLS;
}

export function canAddRow(rows: number[]): boolean {
  return rows.length < MAX_ROWS;
}

export function canRemoveRow(rows: number[]): boolean {
  return rows.length > MIN_ROWS;
}

export function canAddDepth(depthLayers: number): boolean {
  return depthLayers < MAX_DEPTH;
}

export function canRemoveDepth(depthLayers: number): boolean {
  return depthLayers > MIN_DEPTH;
}

/** Maximale Fachböden pro Zelle */
export function maxShelves(_height: number): number {
  return 2;
}
