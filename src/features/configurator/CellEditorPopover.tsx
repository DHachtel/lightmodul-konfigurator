'use client';

import React from 'react';
import type { BoardMap, Cell, ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { MATERIALS } from '@/core/constants';

// ── Typen ──────────────────────────────────────────────────────────────────────

interface Props {
  cell: Cell;
  row: number;
  col: number;
  state: ConfigState;
  actions: ConfigActions;
  boardMap: BoardMap;
  onClose: () => void;
}

interface BoardEntry {
  id: string;
  label: string;
  isFront: boolean;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

/** Leitet alle Bauteile einer Zelle aus Position und Typ ab. */
function getBoardsForCell(cell: Cell, row: number, col: number): BoardEntry[] {
  const boards: BoardEntry[] = [
    { id: `bottom_r${row}_c${col}`, label: 'Boden',       isFront: false },
    { id: `top_r${row}_c${col}`,    label: 'Deckel',      isFront: false },
    { id: `back_r${row}_c${col}`,   label: 'Rücken',      isFront: false },
    // Linke Wand: kanonische ID = side_r der linken Nachbarzelle (oder eigene side_l bei c=0)
    {
      id:    col > 0 ? `side_r_r${row}_c${col - 1}` : `side_l_r${row}_c${col}`,
      label: 'Seite links',
      isFront: false,
    },
    { id: `side_r_r${row}_c${col}`, label: 'Seite rechts', isFront: false },
  ];

  if (cell.type !== 'O') {
    const frontLabels: Record<string, string> = {
      K: 'Klappe', S: 'Schublade', TR: 'Tür rechts', TL: 'Tür links', DT: 'Doppeltür',
    };
    boards.push({
      id:    `front_r${row}_c${col}`,
      label: frontLabels[cell.type] ?? 'Front',
      isFront: true,
    });
  }

  return boards;
}

// ── Stile ──────────────────────────────────────────────────────────────────────

const SEL_STYLE: React.CSSProperties = {
  fontSize: 9,
  fontFamily: 'var(--font-sans)',
  background: '#fff',
  border: '1px solid #d8d4cc',
  borderRadius: 2,
  padding: '2px 3px',
  color: '#3a3834',
  cursor: 'pointer',
  outline: 'none',
  width: '100%',
};

// ── Komponente ─────────────────────────────────────────────────────────────────

export default function CellEditorPopover({ cell, row, col, state, actions, onClose }: Props) {
  const boards = getBoardsForCell(cell, row, col);

  return (
    <div
      style={{
        background: 'var(--color-paper, #f8f6f2)',
        border: '1px solid #d8d4cc',
        borderRadius: 4,
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        minWidth: 228,
        fontFamily: 'var(--font-sans)',
        fontSize: 10,
      }}
      // Klick im Popover schließt nicht (kein Bubbling zum Backdrop)
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{
        padding: '6px 10px',
        borderBottom: '1px solid #e0ddd7',
        background: '#f0edea',
        borderRadius: '4px 4px 0 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#7a7670' }}>
          Z{row + 1} / S{col + 1} — Bauteile
        </span>
        <button
          onMouseDown={e => { e.stopPropagation(); onClose(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: '#7a7670', padding: '0 2px', lineHeight: 1,
          }}
        >×</button>
      </div>

      {/* Spalten-Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '72px 1fr 42px',
        gap: 5,
        padding: '5px 10px 3px',
        borderBottom: '1px solid #eceae6',
      }}>
        <span style={{ fontSize: 8, color: '#a8a49c', textTransform: 'uppercase', letterSpacing: '.08em' }}>Bauteil</span>
        <span style={{ fontSize: 8, color: '#a8a49c', textTransform: 'uppercase', letterSpacing: '.08em' }}>Oberfläche</span>
        <span style={{ fontSize: 8, color: '#a8a49c', textTransform: 'uppercase', letterSpacing: '.08em', textAlign: 'center' }}>Kabel</span>
      </div>

      {/* Board-Zeilen */}
      <div style={{ padding: '4px 0 6px' }}>
        {boards.map(board => {
          const override = state.bomOverrides[board.id];
          const hasCable = !board.isFront && (state.cableHoles[board.id] ?? false);

          return (
            <div key={board.id} style={{
              display: 'grid',
              gridTemplateColumns: '72px 1fr 42px',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
            }}>
              {/* Label */}
              <span style={{
                fontSize: 9,
                color: override ? '#5c4a34' : '#6a6560',
                fontWeight: override ? 500 : 400,
              }}>
                {board.label}
                {override && <span style={{ fontSize: 7, color: '#8a7050', marginLeft: 3 }}>●</span>}
              </span>

              {/* Oberflächen-Dropdown */}
              <select
                value={override?.material ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  if (!v) {
                    actions.clearBomOverrideByBoard(board.id);
                  } else {
                    const mat = MATERIALS.find(m => m.v === v);
                    actions.setBomOverrideByBoard(board.id, v, mat?.l ?? v);
                  }
                }}
                style={SEL_STYLE}
              >
                <option value="">— Standard</option>
                {MATERIALS.filter(m => m.v !== 'none').map(m => (
                  <option key={m.v} value={m.v}>{m.l} ({m.pg})</option>
                ))}
              </select>

              {/* Kabeldurchlass (nur Strukturplatten) */}
              {!board.isFront ? (
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 3, cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={hasCable}
                    onChange={e => actions.setCableHole(board.id, e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: 'var(--color-primary, #8a7050)', margin: 0 }}
                  />
                </label>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
