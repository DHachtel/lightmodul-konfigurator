'use client';

import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { WIDTHS, HEIGHTS } from '@/core/constants';

const S = 0.01; // 1mm → Three.js-Einheiten

interface DimensionPickerProps {
  row: number;
  col: number;
  cols: number[];
  rows: number[];
  onSetCol: (col: number, width: number) => void;
  onSetRow: (row: number, height: number) => void;
}

/**
 * Zeigt Breite/Höhe-Auswahl direkt am Element in der 3D-Szene:
 * - Breite: horizontale Pill-Leiste oberhalb des Elements
 * - Höhe: vertikale Pill-Leiste links neben dem Element
 */
export default function DimensionPicker({ row, col, cols, rows, onSetCol, onSetRow }: DimensionPickerProps) {
  const currentW = cols[col];
  const currentH = rows[row];

  // Position berechnen: Zentrum des Elements in Three.js-Einheiten
  const positions = useMemo(() => {
    const xLeft = cols.slice(0, col).reduce((a, b) => a + b, 0);
    const yBottom = rows.slice(row + 1).reduce((a, b) => a + b, 0);
    const w = cols[col];
    const h = rows[row];

    return {
      // Breite: mittig oben über dem Element
      widthPos: [(xLeft + w / 2) * S, (yBottom + h + 15) * S, 0] as [number, number, number],
      // Höhe: links neben dem Element, vertikal mittig
      heightPos: [(xLeft - 15) * S, (yBottom + h / 2) * S, 0] as [number, number, number],
    };
  }, [col, row, cols, rows]);

  return (
    <>
      {/* ── Breite (horizontal, oberhalb) ── */}
      <Html position={positions.widthPos} center style={{ pointerEvents: 'auto' }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex', gap: 3, padding: 3,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 6,
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          }}
        >
          {WIDTHS.map(w => (
            <button
              key={w}
              onClick={() => onSetCol(col, w)}
              style={{
                padding: '3px 7px', borderRadius: 4, border: 'none',
                background: currentW === w ? '#171614' : 'transparent',
                color: currentW === w ? '#FAFAF8' : '#8A8680',
                fontSize: 9, fontWeight: currentW === w ? 600 : 400,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                transition: 'all 0.12s ease',
              }}
            >{w}</button>
          ))}
        </div>
      </Html>

      {/* ── Höhe (vertikal, links) ── */}
      <Html position={positions.heightPos} center style={{ pointerEvents: 'auto' }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex', flexDirection: 'column', gap: 3, padding: 3,
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 6,
            boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          }}
        >
          {HEIGHTS.map(h => (
            <button
              key={h}
              onClick={() => onSetRow(row, h)}
              style={{
                padding: '3px 7px', borderRadius: 4, border: 'none',
                background: currentH === h ? '#171614' : 'transparent',
                color: currentH === h ? '#FAFAF8' : '#8A8680',
                fontSize: 9, fontWeight: currentH === h ? 600 : 400,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                transition: 'all 0.12s ease',
              }}
            >{h}</button>
          ))}
        </div>
      </Html>
    </>
  );
}
