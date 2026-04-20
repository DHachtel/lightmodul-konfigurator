'use client';

import React from 'react';
import type { Cell, CellType, ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { CELL_TYPES } from '@/core/constants';
import { maxShelves } from '@/core/validation';

interface Props {
  cell: Cell;
  row: number;
  col: number;
  state: ConfigState;
  actions: ConfigActions;
  onClose: () => void;
}

export default function CellEditorPopover({ cell, row, col, state, actions, onClose }: Props) {
  const max = maxShelves(state.rows[row]);

  return (
    <div
      style={{
        background: 'var(--color-paper, #f8f6f2)',
        border: '1px solid #d8d4cc',
        borderRadius: 4,
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        minWidth: 200,
        fontFamily: 'var(--font-sans)',
        fontSize: 10,
      }}
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
          Z{row + 1} / S{col + 1}
        </span>
        <button
          onMouseDown={e => { e.stopPropagation(); onClose(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: '#7a7670', padding: '0 2px', lineHeight: 1,
          }}
        >x</button>
      </div>

      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Zelltyp */}
        <div>
          <span style={{ fontSize: 8, color: '#a8a49c', textTransform: 'uppercase', letterSpacing: '.08em' }}>Typ</span>
          <select
            value={cell.type}
            onChange={e => actions.setType(row, col, e.target.value as CellType)}
            style={SEL_STYLE}
          >
            {CELL_TYPES.map(ct => (
              <option key={ct.v} value={ct.v}>{ct.l}</option>
            ))}
          </select>
        </div>

        {/* Fachboeden */}
        {cell.type !== '' && max > 0 && (
          <div>
            <span style={{ fontSize: 8, color: '#a8a49c', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Fachboeden (0–{max})
            </span>
            <input
              type="number"
              min={0}
              max={max}
              value={cell.shelves}
              onChange={e => actions.setShelves(row, col, Number(e.target.value))}
              style={{ ...SEL_STYLE, width: 60 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const SEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontFamily: 'var(--font-sans)',
  background: '#fff',
  border: '1px solid #d8d4cc',
  borderRadius: 4,
  padding: '4px 6px',
  color: '#3a3834',
  cursor: 'pointer',
  outline: 'none',
  width: '100%',
  marginTop: 3,
};
