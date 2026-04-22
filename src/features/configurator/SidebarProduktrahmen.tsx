'use client';

import { useMemo } from 'react';
import type { ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { computeAvailableFaces } from '@/core/faces';

interface Props {
  state: ConfigState;
  actions: ConfigActions;
}

export default function SidebarProduktrahmen({ state, actions }: Props) {
  const availableFaces = useMemo(
    () => computeAvailableFaces(state.grid, state.cols.length, state.depthLayers),
    [state.grid, state.cols.length, state.depthLayers],
  );

  const totalAvailable = availableFaces.size;
  const totalPlaced = Object.values(state.frames ?? {}).filter(Boolean).length;

  const allFaceIds = useMemo(() => Array.from(availableFaces), [availableFaces]);

  return (
    <div style={{ padding: '14px 16px 8px' }}>

      {/* -- INFO -- */}
      <Section label="Produktrahmen">
        <div style={{
          background: '#F0F4FF', border: '1px solid #BFDBFE', borderRadius: 8,
          padding: '12px 14px', marginTop: 8,
        }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1E40AF', lineHeight: 1 }}>
            {totalPlaced} <span style={{ fontSize: 14, fontWeight: 400, color: '#6B7280' }}>/ {totalAvailable}</span>
          </div>
          <div style={{
            fontSize: 9, fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase',
            color: '#93C5FD', marginTop: 4,
          }}>
            Flaechen bestueckt
          </div>
        </div>
      </Section>

      <Divider />

      {/* -- AKTIONEN -- */}
      <Section label="Aktionen">
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button
            onClick={() => actions.setAllFrames(allFaceIds, true)}
            disabled={totalPlaced === totalAvailable}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
              background: totalPlaced === totalAvailable ? '#E5E7EB' : '#171614',
              color: totalPlaced === totalAvailable ? '#9CA3AF' : '#FAFAF8',
              fontSize: 11, cursor: totalPlaced === totalAvailable ? 'default' : 'pointer',
              fontWeight: 500, transition: 'all 0.14s ease',
              fontFamily: 'var(--font-sans)',
            }}
          >Alle bestuecken</button>
          <button
            onClick={() => actions.setAllFrames(allFaceIds, false)}
            disabled={totalPlaced === 0}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
              background: totalPlaced === 0 ? '#E5E7EB' : '#F2EFE9',
              color: totalPlaced === 0 ? '#9CA3AF' : '#6A6660',
              fontSize: 11, cursor: totalPlaced === 0 ? 'default' : 'pointer',
              fontWeight: 400, transition: 'all 0.14s ease',
              fontFamily: 'var(--font-sans)',
            }}
          >Alle entfernen</button>
        </div>
      </Section>

      <Divider />

      {/* -- HINWEIS -- */}
      <p style={{
        fontSize: 9, color: '#A8A49C', lineHeight: 1.4,
        fontFamily: 'var(--font-sans)',
      }}>
        Klicke auf eine hervorgehobene Flaeche im 3D-Bereich, um einen Produktrahmen zu platzieren oder zu entfernen.
      </p>
    </div>
  );
}

function Section({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: 2 }}>
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
  return <div style={{ height: 1, background: '#EDEAE5', margin: '10px 0' }} />;
}
