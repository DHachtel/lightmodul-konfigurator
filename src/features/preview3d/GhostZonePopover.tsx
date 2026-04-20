'use client';

import { useState } from 'react';
import { Html } from '@react-three/drei';
import type { GhostSide } from './GhostZone';

const WIDTHS = [420, 580, 780, 980];
const HEIGHTS = [180, 360, 580, 660, 720, 1080, 1440, 1800];

interface GhostZonePopoverProps {
  side: GhostSide;
  position: [number, number, number];
  onConfirm: (side: GhostSide, dimension: number) => void;
  onCancel: () => void;
}

export default function GhostZonePopover({ side, position, onConfirm, onCancel }: GhostZonePopoverProps) {
  const isColumn = side === 'left' || side === 'right';
  const options = isColumn ? WIDTHS : HEIGHTS;
  const defaultVal = isColumn ? 580 : 360;
  const [selected, setSelected] = useState(defaultVal);

  return (
    <Html position={position} center style={{ pointerEvents: 'auto' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FAFAF8',
          borderRadius: 10,
          padding: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          border: '1px solid #E8E5E0',
          minWidth: 160,
          fontFamily: 'var(--font-sans)',
        }}
      >
        <p style={{
          fontSize: 9, fontWeight: 600, letterSpacing: '.18em',
          textTransform: 'uppercase', color: '#C0BCB6', marginBottom: 10,
        }}>
          {isColumn ? 'Spaltenbreite' : 'Zeilenhöhe'}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {options.map(d => (
            <button
              key={d}
              onClick={() => setSelected(d)}
              style={{
                padding: '5px 10px', borderRadius: 6, border: 'none',
                background: selected === d ? '#171614' : '#F2EFE9',
                color: selected === d ? '#FAFAF8' : '#6A6660',
                fontSize: 11, cursor: 'pointer',
                fontWeight: selected === d ? 500 : 400,
                transition: 'all 0.14s ease',
              }}
            >
              {d} mm
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #E2DFD9',
              background: 'transparent', color: '#6A6660', fontSize: 11,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Abbrechen
          </button>
          <button
            onClick={() => onConfirm(side, selected)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
              background: '#171614', color: '#FAFAF8', fontSize: 11,
              cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit',
            }}
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </Html>
  );
}
