// @ts-nocheck — Artmodul-Legacydatei, wird in Phase 1 auf Lightmodul umgebaut
'use client';

import type { ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { CELL_TYPES, HANDLES, MATERIALS, MAT_BY_V } from '@/core/constants';
import { getAvailableCellTypes } from '@/core/validation';

const MAT_ALL = MATERIALS.filter(m => m.v !== 'none');

interface Props {
  state: ConfigState;
  actions: ConfigActions;
  row: number;
  col: number;
}

export default function SidebarElement({ state, actions, row, col }: Props) {
  // Lightmodul: 3D-Grid — SidebarElement arbeitet immer mit Tiefenebene 0
  const cell = state.grid[row]?.[col]?.[0];
  if (!cell) return null;

  const w = state.cols[col];
  const h = state.rows[row];
  const availableTypes = getAvailableCellTypes();
  const cellColorKey = `${row}_${col}_0`;
  const currentCellColor = state.cellColors[cellColorKey];
  const globalMatHex = MAT_BY_V[state.profileColor ?? state.surface]?.hex;

  return (
    <div style={{ padding: '20px 20px 0' }}>

      {/* ── ELEMENT-INFO ── */}
      <div style={{
        background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
        padding: '10px 12px', marginBottom: 16,
      }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontWeight: 600,
          fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#166534',
        }}>
          Element R{row + 1} · C{col + 1}
        </span>
        <p style={{ fontSize: 11, color: '#15803D', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
          {w}×{h} mm · Tiefe {state.depth} mm
        </p>
      </div>

      {/* Breite/Höhe: direkt in der 3D-Ansicht am Element (DimensionPicker) */}

      {/* ── FRONTTYP ── */}
      <Section label="Front">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {CELL_TYPES.filter(ct => ct.v === 'O' || availableTypes.includes(ct.v)).map(ct => (
            <button
              key={ct.v}
              onClick={() => actions.setType(row, col, ct.v)}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: cell.type === ct.v ? '#171614' : '#F2EFE9',
                color: cell.type === ct.v ? '#FAFAF8' : '#6A6660',
                fontSize: 11, cursor: 'pointer', transition: 'all 0.14s ease',
                fontWeight: cell.type === ct.v ? 500 : 400,
              }}
            >{ct.l}</button>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── FACHBÖDEN ── */}
      <Section label="Fachböden">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <button
            onClick={() => actions.setShelves(row, col, cell.shelves - 1)}
            disabled={cell.shelves <= 0}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: '#F2EFE9', color: '#6A6660', fontSize: 16, cursor: 'pointer',
              opacity: cell.shelves <= 0 ? 0.3 : 1,
            }}
          >−</button>
          <span style={{ fontSize: 18, fontWeight: 500, color: '#171614', minWidth: 24, textAlign: 'center' }}>
            {cell.shelves}
          </span>
          <button
            onClick={() => actions.setShelves(row, col, cell.shelves + 1)}
            disabled={cell.shelves >= 5}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: '#F2EFE9', color: '#6A6660', fontSize: 16, cursor: 'pointer',
              opacity: cell.shelves >= 5 ? 0.3 : 1,
            }}
          >+</button>
        </div>
      </Section>

      <Divider />

      {/* ── ELEMENTFARBE ── */}
      <Section label="Elementfarbe">
        {/* Aktive Farbe (geerbt von Möbel-Ebene oder individuell überschrieben) */}
        {currentCellColor && (
          <button
            onClick={() => actions.clearCellColor(row, col)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 9, color: '#A8A49C', marginTop: 4, marginBottom: 4 }}
          >↺ Auf Möbel-Oberfläche zurücksetzen</button>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: currentCellColor ? 4 : 10 }}>
          {MAT_ALL.map(m => {
            // Aktiv wenn individuell gesetzt ODER globale Möbel-Oberfläche übereinstimmt
            const isActive = currentCellColor
              ? currentCellColor === m.hex
              : globalMatHex === m.hex;
            return (
              <button
                key={m.v}
                onClick={() => actions.setCellColor(row, col, m.hex)}
                title={`${m.l} (${m.pg})`}
                style={{
                  ...CHIP,
                  background: m.grad ?? m.hex,
                  boxShadow: isActive
                    ? '0 0 0 2.5px #fff, 0 0 0 4.5px #171614'
                    : '0 0 0 1px rgba(0,0,0,0.13)',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                }}
              />
            );
          })}
        </div>
      </Section>

      <Divider />

      {/* ── GRIFF (global) ── */}
      <Section label="Griff (global)">
        <select
          value={state.handle}
          onChange={e => actions.setHandle(e.target.value)}
          style={{ ...SELECT_STYLE, marginTop: 10 }}
        >
          {HANDLES.map(h => <option key={h.v} value={h.v}>{h.l}</option>)}
        </select>
      </Section>
    </div>
  );
}

function Section({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: 4 }}>
      <span style={{
        fontFamily: 'var(--font-sans)', fontWeight: 600,
        fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase',
        color: '#C0BCB6', display: 'block',
      }}>{label}</span>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: '#EDEAE5', margin: '16px 0' }} />;
}

const CHIP: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '6px',
  border: 'none', cursor: 'pointer', flexShrink: 0,
  padding: 0, outline: 'none',
  transition: 'transform 0.14s ease, box-shadow 0.14s ease',
};

const SELECT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
  background: '#F2EFE9', border: '1px solid #E2DFD9',
  color: '#36342F', borderRadius: 8,
  padding: '6px 10px', cursor: 'pointer',
  width: '100%', height: 34, outline: 'none',
};
