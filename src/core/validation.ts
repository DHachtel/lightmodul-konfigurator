import type { CellType, Grid } from './types';
import { MAX_COLS, MAX_ROWS, MAX_DEPTH, MIN_COLS, MIN_ROWS, MIN_DEPTH } from './constants';

// ─── Zell-Validierung ─────────────────────────────────────────────────────────

/**
 * Gibt zurück ob ein Zelltyp für die gegebene Position gültig ist.
 * Lightmodul hat keine komplexen Einschränkungen — alle Typen sind überall erlaubt.
 */
export function canPlace(
  _r: number,
  _c: number,
  _d: number,
  _type: CellType,
): boolean {
  return true;
}

/**
 * Gibt alle erlaubten Zelltypen für eine Position zurück.
 * Alle Typen sind bei Lightmodul immer erlaubt.
 */
export function getAvailableCellTypes(): CellType[] {
  return ['', 'O', 'RF', 'RL'];
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
