'use client';

import { useState, useCallback } from 'react';
import type { BOMResult, Cell, CellType, ConfigState, Grid } from '@/core/types';
import { MAX_COLS, MAX_ROWS, MAX_DEPTH, ELEMENT_SIZE_MM } from '@/core/constants';
import { maxShelves, isBTBlocked } from '@/core/validation';

// ── Standardwerte ────────────────────────────────────────────────────────────

const PAD_COL_W = ELEMENT_SIZE_MM;
const PAD_ROW_H = ELEMENT_SIZE_MM;

function newCell(): Cell {
  return { type: '', shelves: 0 };
}

/** Entfernt komplett leere Rand-Spalten, -Zeilen und -Tiefenebenen (aber nie die letzte) */
function trimEmptyEdges(s: ConfigState): ConfigState {
  let { cols, rows, grid, depthLayers } = s;

  const isRowEmpty = (r: number) =>
    grid[r].every(colArr => colArr.every(cell => cell.type === ''));
  const isColEmpty = (c: number) =>
    grid.every(rowArr => rowArr[c].every(cell => cell.type === ''));
  const isDepthEmpty = (d: number) =>
    grid.every(rowArr => rowArr.every(colArr => colArr[d]?.type === ''));

  // Leere Zeilen oben entfernen
  while (rows.length > 1 && isRowEmpty(0)) {
    rows = rows.slice(1);
    grid = grid.slice(1);
  }
  // Leere Zeilen unten entfernen
  while (rows.length > 1 && isRowEmpty(grid.length - 1)) {
    rows = rows.slice(0, -1);
    grid = grid.slice(0, -1);
  }
  // Leere Spalten links entfernen
  while (cols.length > 1 && isColEmpty(0)) {
    cols = cols.slice(1);
    grid = grid.map(rowArr => rowArr.slice(1));
  }
  // Leere Spalten rechts entfernen
  while (cols.length > 1 && isColEmpty(grid[0].length - 1)) {
    cols = cols.slice(0, -1);
    grid = grid.map(rowArr => rowArr.slice(0, -1));
  }
  // Leere Tiefenebenen vorne (d=0) entfernen
  while (depthLayers > 1 && isDepthEmpty(0)) {
    depthLayers -= 1;
    grid = grid.map(rowArr => rowArr.map(colArr => colArr.slice(1)));
  }
  // Leere Tiefenebenen hinten (d=nD-1) entfernen
  while (depthLayers > 1 && isDepthEmpty(depthLayers - 1)) {
    depthLayers -= 1;
    grid = grid.map(rowArr => rowArr.map(colArr => colArr.slice(0, -1)));
  }

  if (cols === s.cols && rows === s.rows && depthLayers === s.depthLayers) return s;
  return { ...s, cols, rows, depthLayers, grid };
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
  addFilledRowBottom(): void;
  /** Grid erweitern + exakt 1 Zelle aktivieren (atomar) */
  expandAndActivateCell(direction: 'left' | 'right' | 'top', atIndex: number): void;
  /** Setzt exakt 1 Zelle bei (r, c, d) — true 3D */
  setCellType3D(r: number, c: number, d: number, t: CellType): void;
  /** Grid erweitern + 1 Zelle bei (targetR, targetC, targetD) aktivieren */
  expandAndActivate3D(targetR: number, targetC: number, targetD: number): void;
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

        let next = { ...s, grid };

        // Nach Entfernen (type='') automatisch leere Raender aufraeumen
        return t === '' ? trimEmptyEdges(next) : next;
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
      // Neue Tiefenzelle: Typ der letzten Tiefenzelle kopieren (nicht leer)
      const grid: Grid = s.grid.map(rowArr =>
        rowArr.map(colArr => {
          const last = colArr[colArr.length - 1];
          return [...colArr, { type: last?.type ?? '', shelves: 0 }];
        })
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

    addFilledRowBottom: () => update(s => {
      if (s.rows.length >= MAX_ROWS) return s;
      const nD = s.depthLayers;
      const newRow: Cell[][] = Array.from({ length: s.cols.length }, (_, c) => {
        // Unterste Zeile aktiv? Dann neue Zelle auch aktiv
        const lastRow = s.grid[s.grid.length - 1];
        const hasActive = lastRow?.[c]?.some(cell => cell.type !== '') ?? false;
        return Array.from({ length: nD }, () => ({
          type: hasActive ? 'O' as CellType : '' as CellType,
          shelves: 0,
        }));
      });
      return { ...s, rows: [...s.rows, PAD_ROW_H], grid: [...s.grid, newRow] };
    }),

    // ── Atomar: Grid erweitern + exakt 1 Zelle aktivieren + aufräumen ─────
    expandAndActivateCell: (direction, atIndex) => update(s => {
      const nD = s.depthLayers;

      let next = { ...s };

      if (direction === 'left') {
        if (s.cols.length >= MAX_COLS) return s;
        const cols = [PAD_COL_W, ...s.cols];
        const grid: Grid = s.grid.map((rowArr, ri) => {
          const cell: Cell = ri === atIndex
            ? { type: 'O' as CellType, shelves: 0 }
            : newCell();
          return [Array.from({ length: nD }, () => ({ ...cell })), ...rowArr];
        });
        next = { ...next, cols, grid };
      } else if (direction === 'right') {
        if (s.cols.length >= MAX_COLS) return s;
        const cols = [...s.cols, PAD_COL_W];
        const grid: Grid = s.grid.map((rowArr, ri) => {
          const cell: Cell = ri === atIndex
            ? { type: 'O' as CellType, shelves: 0 }
            : newCell();
          return [...rowArr, Array.from({ length: nD }, () => ({ ...cell }))];
        });
        next = { ...next, cols, grid };
      } else if (direction === 'top') {
        if (s.rows.length >= MAX_ROWS) return s;
        const newRow: Cell[][] = Array.from({ length: s.cols.length }, (_, ci) => {
          const cell: Cell = ci === atIndex
            ? { type: 'O' as CellType, shelves: 0 }
            : newCell();
          return Array.from({ length: nD }, () => ({ ...cell }));
        });
        next = { ...next, rows: [PAD_ROW_H, ...s.rows], grid: [newRow, ...s.grid] };
      } else {
        return s;
      }

      // Aufräumen: komplett leere Randspalten/-zeilen entfernen
      next = trimEmptyEdges(next);
      return next;
    }),

    // ── True 3D Zellaktionen ──────────────────────────────────────────────
    setCellType3D: (r, c, d, t) => {
      setGravityError(null);
      update(s => {
        const grid: Grid = s.grid.map((rowArr, ri) =>
          rowArr.map((colArr, ci) =>
            colArr.map((cell, di) => {
              if (ri !== r || ci !== c || di !== d) return cell;
              return { type: t, shelves: cell.shelves };
            })
          )
        );
        const next = { ...s, grid };
        return t === '' ? trimEmptyEdges(next) : next;
      });
    },

    expandAndActivate3D: (targetR, targetC, targetD) => {
      setGravityError(null);
      update(s => {
        let { cols, rows, depthLayers, grid } = s;
        let r = targetR, c = targetC, d = targetD;

        // Expand wenn Ziel außerhalb der Grenzen
        if (r < 0) {
          if (rows.length >= MAX_ROWS) return s;
          rows = [PAD_ROW_H, ...rows];
          const nD = depthLayers;
          const newRow: Cell[][] = Array.from({ length: cols.length }, () =>
            Array.from({ length: nD }, newCell)
          );
          grid = [newRow, ...grid];
          r = 0;
        }
        if (c < 0) {
          if (cols.length >= MAX_COLS) return s;
          cols = [PAD_COL_W, ...cols];
          grid = grid.map(rowArr => [
            Array.from({ length: depthLayers }, newCell),
            ...rowArr,
          ]);
          c = 0;
        }
        if (c >= cols.length) {
          if (cols.length >= MAX_COLS) return s;
          cols = [...cols, PAD_COL_W];
          grid = grid.map(rowArr => [
            ...rowArr,
            Array.from({ length: depthLayers }, newCell),
          ]);
        }
        if (d < 0) {
          if (depthLayers >= MAX_DEPTH) return s;
          depthLayers = depthLayers + 1;
          grid = grid.map(rowArr =>
            rowArr.map(colArr => [newCell(), ...colArr])
          );
          d = 0;
        }
        if (d >= depthLayers) {
          if (depthLayers >= MAX_DEPTH) return s;
          depthLayers = depthLayers + 1;
          grid = grid.map(rowArr =>
            rowArr.map(colArr => [...colArr, newCell()])
          );
        }

        // Schwerkraft-Prüfung: Bodenzeile oder aktive Zelle direkt darunter
        const nR = rows.length;
        const isBottom = r === nR - 1;
        const hasCellBelow = r + 1 < nR &&
          (grid[r + 1]?.[c]?.[d]?.type ?? '') !== '';
        if (!isBottom && !hasCellBelow) {
          // Gravity verletzt — nicht aktivieren, Grid-Änderungen rückgängig
          return s;
        }

        // BT-Sperrung: nicht aktivieren wenn BT darunter
        if (r + 1 < rows.length && (grid[r + 1]?.[c]?.[d]?.type ?? '') === 'BT') {
          return s;
        }

        // BT-Propagation: wenn ein Nachbar auf gleicher Reihe ein BT ist,
        // wird die neue Zelle ebenfalls ein BT (statt 'O')
        let activationType: CellType = 'O';
        const nR2 = rows.length;
        if (r === nR2 - 1) {
          const neighbors = [
            grid[r]?.[c - 1]?.[d],
            grid[r]?.[c + 1]?.[d],
            grid[r]?.[c]?.[d - 1],
            grid[r]?.[c]?.[d + 1],
          ];
          if (neighbors.some(n => n?.type === 'BT')) {
            activationType = 'BT';
          }
        }

        // Zielzelle aktivieren
        grid = grid.map((rowArr, ri) =>
          rowArr.map((colArr, ci) =>
            colArr.map((cell, di) => {
              if (ri !== r || ci !== c || di !== d) return cell;
              return { type: activationType, shelves: 0 };
            })
          )
        );

        let next = { ...s, cols, rows, depthLayers, grid };
        next = trimEmptyEdges(next);
        return next;
      });
    },

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
