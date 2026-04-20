'use client';

import { useState, useCallback } from 'react';
import type { BOMResult, Cell, CellType, ConfigState, Grid } from '@/core/types';
import { CELL_TYPES, MAX_COLS, MAX_ROWS, MAX_DEPTH, ELEMENT_SIZE_MM } from '@/core/constants';
import { canPlace, maxShelves } from '@/core/validation';
import { createEmptyGrid, emptyCell } from '@/core/calc';

// ── Standardwerte ────────────────────────────────────────────────────────────

const PAD_COL_W = ELEMENT_SIZE_MM;
const PAD_ROW_H = ELEMENT_SIZE_MM;

function newCell(): Cell {
  return { type: '', shelves: 0 };
}

/** Baut ein neues 3D-Grid aus einem bestehenden (oder leerem) Grid */
function buildGrid3D(nR: number, nC: number, nD: number, existing?: Grid): Grid {
  return Array.from({ length: nR }, (_, r) =>
    Array.from({ length: nC }, (_, c) =>
      Array.from({ length: nD }, (_, d) =>
        existing?.[r]?.[c]?.[d] ?? newCell()
      )
    )
  );
}

const DEFAULT: ConfigState = {
  cols:         [ELEMENT_SIZE_MM],
  rows:         [ELEMENT_SIZE_MM],
  depthLayers:  1,
  grid:         [[[{ type: 'O', shelves: 0 }]]],
  profileColor: 'SW',
  footer:       'stell_m6',
  opts:         { footer: true, shelves: false },
};

// ── Typen ────────────────────────────────────────────────────────────────────

export interface ConfigActions {
  setFooter(v: string): void;
  setType(r: number, c: number, t: CellType): void;
  setShelves(r: number, c: number, n: number): void;
  setCol(c: number, w: number): void;
  setRow(r: number, h: number): void;
  setDepthLayers(d: number): void;
  setProfileColor(v: string): void;
  addColLeft(): void;
  removeColLeft(): void;
  addColRight(): void;
  removeColRight(): void;
  addRowTop(): void;
  removeRowTop(): void;
  addDepthFront(): void;
  removeDepthFront(): void;
  // Ghost-Zone-Aktionen
  addFilledColLeft(): void;
  addFilledColRight(): void;
  addFilledRowTop(): void;
  // Fehler-State
  gravityError: string | null;
  clearGravityError(): void;
  frontTypeWarning: string | null;
  clearFrontTypeWarning(): void;
  // Commit
  committedBOM: BOMResult | null;
  moebelId: number | null;
  commitBOM(bom: BOMResult): void;
  setMoebelId(id: number): void;
  loadConfig(config: ConfigState, restoredMoebelId?: number): void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useConfigStore(): [ConfigState, ConfigActions, () => void] {
  const [state, setState] = useState<ConfigState>(() => DEFAULT);
  const [gravityError, setGravityError] = useState<string | null>(null);
  const [frontTypeWarning, setFrontTypeWarning] = useState<string | null>(null);
  const [committedBOM, setCommittedBOM] = useState<BOMResult | null>(null);
  const [moebelId, setMoebelIdState] = useState<number | null>(null);

  const update = useCallback((fn: (s: ConfigState) => ConfigState) => {
    setState(s => fn(s));
    setCommittedBOM(null);
    setMoebelIdState(null);
  }, []);

  const actions: ConfigActions = {

    // ── Globale Parameter ─────────────────────────────────────────────────
    setProfileColor: (v) => update(s => ({ ...s, profileColor: v })),

    setFooter: (v) => update(s => ({ ...s, footer: v })),

    // ── Zelltyp setzen ───────────────────────────────────────────────────
    setType: (r, c, t) => {
      setGravityError(null);
      update(s => {
        const grid: Grid = s.grid.map((rowArr, ri) =>
          rowArr.map((colArr, ci) => {
            if (ri !== r || ci !== c) return [...colArr];
            return colArr.map((cell) => {
              const max = maxShelves(s.rows[r]);
              const shelves = Math.min(cell.shelves, max);
              return { type: t, shelves };
            });
          })
        );
        return { ...s, grid };
      });
    },

    // ── Fachböden setzen ─────────────────────────────────────────────────
    setShelves: (r, c, n) => update(s => {
      const max = maxShelves(s.rows[r]);
      const clamped = Math.max(0, Math.min(max, n));
      const grid: Grid = s.grid.map((rowArr, ri) =>
        rowArr.map((colArr, ci) => {
          if (ri !== r || ci !== c) return [...colArr];
          return colArr.map(cell => ({ ...cell, shelves: clamped }));
        })
      );
      return { ...s, grid };
    }),

    // ── Spalten / Zeilen ─────────────────────────────────────────────────
    setCol: (c, w) => update(s => {
      const cols = [...s.cols]; cols[c] = w;
      return { ...s, cols };
    }),

    setRow: (r, h) => update(s => {
      const rows = [...s.rows]; rows[r] = h;
      return { ...s, rows };
    }),

    // ── Tiefenebenen ─────────────────────────────────────────────────────
    setDepthLayers: (d) => update(s => {
      const nD = Math.max(1, Math.min(MAX_DEPTH, d));
      const grid = buildGrid3D(s.rows.length, s.cols.length, nD, s.grid);
      return { ...s, depthLayers: nD, grid };
    }),

    // ── Spalten/Zeilen hinzufügen/entfernen ───────────────────────────────
    addColLeft: () => update(s => {
      if (s.cols.length >= MAX_COLS) return s;
      const nD = s.depthLayers;
      const cols = [PAD_COL_W, ...s.cols];
      const grid: Grid = s.grid.map(rowArr => [
        Array.from({ length: nD }, newCell),
        ...rowArr,
      ]);
      return { ...s, cols, grid };
    }),

    removeColLeft: () => update(s => {
      if (s.cols.length <= 1) return s;
      return { ...s, cols: s.cols.slice(1), grid: s.grid.map(rowArr => rowArr.slice(1)) };
    }),

    addColRight: () => update(s => {
      if (s.cols.length >= MAX_COLS) return s;
      const nD = s.depthLayers;
      const cols = [...s.cols, PAD_COL_W];
      const grid: Grid = s.grid.map(rowArr => [
        ...rowArr,
        Array.from({ length: nD }, newCell),
      ]);
      return { ...s, cols, grid };
    }),

    removeColRight: () => update(s => {
      if (s.cols.length <= 1) return s;
      return { ...s, cols: s.cols.slice(0, -1), grid: s.grid.map(rowArr => rowArr.slice(0, -1)) };
    }),

    addRowTop: () => update(s => {
      if (s.rows.length >= MAX_ROWS) return s;
      const nD = s.depthLayers;
      const newRow: Cell[][] = Array.from({ length: s.cols.length }, () =>
        Array.from({ length: nD }, newCell)
      );
      return { ...s, rows: [PAD_ROW_H, ...s.rows], grid: [newRow, ...s.grid] };
    }),

    removeRowTop: () => update(s => {
      if (s.rows.length <= 1) return s;
      return { ...s, rows: s.rows.slice(1), grid: s.grid.slice(1) };
    }),

    addDepthFront: () => update(s => {
      if (s.depthLayers >= MAX_DEPTH) return s;
      const nD = s.depthLayers + 1;
      const grid: Grid = s.grid.map(rowArr =>
        rowArr.map(colArr => [...colArr, newCell()])
      );
      return { ...s, depthLayers: nD, grid };
    }),

    removeDepthFront: () => update(s => {
      if (s.depthLayers <= 1) return s;
      const nD = s.depthLayers - 1;
      const grid: Grid = s.grid.map(rowArr =>
        rowArr.map(colArr => colArr.slice(0, nD))
      );
      return { ...s, depthLayers: nD, grid };
    }),

    // ── Ghost-Zone-Aktionen ───────────────────────────────────────────────
    addFilledColLeft: () => update(s => {
      if (s.cols.length >= MAX_COLS) return s;
      const nD = s.depthLayers;
      const cols = [PAD_COL_W, ...s.cols];
      const grid: Grid = s.grid.map((rowArr) => {
        const hasActive = rowArr.some(colArr => colArr.some(cell => cell.type !== ''));
        const filledCol: Cell[] = Array.from({ length: nD }, () => ({
          type: hasActive ? 'O' as CellType : '' as CellType,
          shelves: 0,
        }));
        return [filledCol, ...rowArr];
      });
      return { ...s, cols, grid };
    }),

    addFilledColRight: () => update(s => {
      if (s.cols.length >= MAX_COLS) return s;
      const nD = s.depthLayers;
      const cols = [...s.cols, PAD_COL_W];
      const grid: Grid = s.grid.map((rowArr) => {
        const hasActive = rowArr.some(colArr => colArr.some(cell => cell.type !== ''));
        const filledCol: Cell[] = Array.from({ length: nD }, () => ({
          type: hasActive ? 'O' as CellType : '' as CellType,
          shelves: 0,
        }));
        return [...rowArr, filledCol];
      });
      return { ...s, cols, grid };
    }),

    addFilledRowTop: () => update(s => {
      if (s.rows.length >= MAX_ROWS) return s;
      const nD = s.depthLayers;
      const newRow: Cell[][] = Array.from({ length: s.cols.length }, (_, c) => {
        const hasActive = s.grid.some(rowArr => rowArr[c]?.some(cell => cell.type !== ''));
        return Array.from({ length: nD }, () => ({
          type: hasActive ? 'O' as CellType : '' as CellType,
          shelves: 0,
        }));
      });
      return { ...s, rows: [PAD_ROW_H, ...s.rows], grid: [newRow, ...s.grid] };
    }),

    // ── Fehler-State ──────────────────────────────────────────────────────
    gravityError,
    clearGravityError: () => setGravityError(null),
    frontTypeWarning,
    clearFrontTypeWarning: () => setFrontTypeWarning(null),

    // ── Commit ────────────────────────────────────────────────────────────
    committedBOM,
    moebelId,
    commitBOM: (bom: BOMResult) => { setCommittedBOM(bom); },
    setMoebelId: (id: number) => { setMoebelIdState(id); },
    loadConfig: (config: ConfigState, restoredMoebelId?: number) => {
      setState(config);
      setCommittedBOM(null);
      setMoebelIdState(restoredMoebelId ?? null);
      setGravityError(null);
      setFrontTypeWarning(null);
    },
  };

  const resetConfig = useCallback(() => {
    setState(DEFAULT);
    setGravityError(null);
    setFrontTypeWarning(null);
    setCommittedBOM(null);
    setMoebelIdState(null);
  }, []);

  return [state, actions, resetConfig];
}
