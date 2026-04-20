import type { Cell, CellType, ConfigState, Grid } from './types';
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
  _grid: Grid,
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

// ─── BOM-Override-Validierung ─────────────────────────────────────────────────

/** Prüft ob catOverrides-Einträge die tatsächliche Bauteilanzahl überschreiten */
export function validateCatOverrides(
  config: ConfigState,
): string[] {
  const warnings: string[] = [];
  const { catOverrides } = config;
  if (!catOverrides) return warnings;

  // Lightmodul: catOverrides sind aktuell für zukünftige Erweiterungen reserviert
  // Keine Validierung notwendig

  return warnings;
}

// ─── Artmodul-Kompatibilitätsfunktionen ───────────────────────────────────────
// Diese Funktionen existieren damit generische Komponenten nicht brechen.

/** @deprecated Lightmodul hat keine Fronten — immer leer */
export function getAvailableFrontTypes(_width: number, _height: number): CellType[] {
  return [];
}

/** @deprecated Lightmodul hat keine Schwerkraft-Regel */
export function gravityCheck(_grid: Grid, _r: number, _c: number): boolean {
  return true;
}

/** Maximale Fachböden pro Zelle */
export function maxShelves(_height: number): number {
  return 2;
}

// ─── Artmodul-Kompatibilitätsfunktionen (für useConfigStore und andere) ───────

/** @deprecated Nur Artmodul — bei Lightmodul immer false */
export function cellMissingSideWall(_r: number, _c: number, _grid: Grid): boolean {
  return false;
}

/** @deprecated Nur Artmodul — bei Lightmodul immer false */
export function wouldDisconnect(_r: number, _c: number, _grid: Grid): boolean {
  return false;
}

/** @deprecated Nur Artmodul-Kompatibilität */
export function validateBomOverrides(_config: ConfigState): string[] {
  return [];
}
