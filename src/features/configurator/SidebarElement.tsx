'use client';

import type { ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { CELL_TYPES, ELEMENT_SIZE_MM } from '@/core/constants';
import { getAvailableCellTypes, isBTBlocked } from '@/core/validation';

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

  // Durch BT darunter gesperrte Zelle
  if (isBTBlocked(state.grid, row, col, 0)) {
    return (
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{
          background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8,
          padding: '10px 12px', marginBottom: 16,
        }}>
          <span style={{
            fontFamily: 'var(--font-sans)', fontWeight: 600,
            fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#92400E',
          }}>
            Gesperrt
          </span>
          <p style={{ fontSize: 11, color: '#B45309', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
            Diese Position ist durch den Beratungstisch darunter belegt.
          </p>
        </div>
      </div>
    );
  }

  const w = state.cols[col];
  const h = state.rows[row];
  const availableTypes = getAvailableCellTypes(row, col, 0, state.grid, state.cols.length, state.depthLayers);
  const totalDepth = state.depthLayers * ELEMENT_SIZE_MM;

  return (
    <div style={{ padding: '20px 20px 0' }}>

      {/* -- ELEMENT-INFO -- */}
      <div style={{
        background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
        padding: '10px 12px', marginBottom: 16,
      }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontWeight: 600,
          fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#166534',
        }}>
          Element R{row + 1} / C{col + 1}
        </span>
        <p style={{ fontSize: 11, color: '#15803D', marginTop: 4, fontFamily: 'var(--font-sans)' }}>
          {w} x {h} mm, Tiefe {totalDepth} mm
        </p>
      </div>

      {/* -- FRONTTYP -- */}
      <Section label="Typ">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {CELL_TYPES.filter(ct => ct.v === '' || ct.v === 'O' || availableTypes.includes(ct.v)).map(ct => (
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

      {cell.type !== 'BT' && (
        <>
          <Divider />

          {/* -- FACHBOEDEN -- */}
          <Section label="Fachboeden">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <button
                onClick={() => actions.setShelves(row, col, cell.shelves - 1)}
                disabled={cell.shelves <= 0}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: '#F2EFE9', color: '#6A6660', fontSize: 16, cursor: 'pointer',
                  opacity: cell.shelves <= 0 ? 0.3 : 1,
                }}
              >-</button>
              <span style={{ fontSize: 18, fontWeight: 500, color: '#171614', minWidth: 24, textAlign: 'center' }}>
                {cell.shelves}
              </span>
              <button
                onClick={() => actions.setShelves(row, col, cell.shelves + 1)}
                disabled={cell.shelves >= 2}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  background: '#F2EFE9', color: '#6A6660', fontSize: 16, cursor: 'pointer',
                  opacity: cell.shelves >= 2 ? 0.3 : 1,
                }}
              >+</button>
            </div>
          </Section>
        </>
      )}
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
