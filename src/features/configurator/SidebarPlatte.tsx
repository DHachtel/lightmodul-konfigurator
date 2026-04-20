'use client';

import type { ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { MATERIALS, MAT_BY_V } from '@/core/constants';

const MAT_ALL = MATERIALS.filter(m => m.v !== 'none');

const PART_LABELS: Record<string, string> = {
  seite_l: 'Seite links', seite_r: 'Seite rechts',
  boden: 'Boden', deckel: 'Deckel', ruecken: 'Rückwand',
  zwischenboden: 'Zwischenboden', zwischenwand: 'Zwischenwand', front: 'Front',
};

const CABLE_ELIGIBLE = new Set(['boden', 'deckel', 'ruecken', 'seite_l', 'seite_r', 'zwischenboden', 'zwischenwand']);

interface Props {
  state: ConfigState;
  actions: ConfigActions;
  plateId: string;
  plateType: string;
}

export default function SidebarPlatte({ state, actions, plateId, plateType }: Props) {
  const currentColor = state.partColors[plateId];
  const globalMatHex = MAT_BY_V[state.surface]?.hex;
  const hasCableHole = state.cableHoles[plateId] ?? false;
  const canHaveCable = CABLE_ELIGIBLE.has(plateType);

  return (
    <div style={{ padding: '20px 20px 0' }}>

      {/* ── PLATTEN-INFO ── */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
        padding: '10px 12px', marginBottom: 16,
      }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontWeight: 600,
          fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#1E40AF',
        }}>
          {PART_LABELS[plateType] ?? plateType}
        </span>
        <p style={{ fontSize: 10, color: '#3B82F6', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
          {plateId}
        </p>
      </div>

      {/* ── PLATTENFARBE ── */}
      <Section label="Plattenfarbe">
        {currentColor && (
          <button
            onClick={() => actions.clearPartColor(plateId)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 9, color: '#A8A49C', marginTop: 4, marginBottom: 4 }}
          >↺ Auf Möbel-Oberfläche zurücksetzen</button>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: currentColor ? 4 : 10 }}>
          {MAT_ALL.map(m => {
            const isActive = currentColor
              ? currentColor === m.hex
              : globalMatHex === m.hex;
            return (
              <button
                key={m.v}
                onClick={() => actions.setPartColor(plateId, m.hex)}
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

      {canHaveCable && (
        <>
          <Divider />
          <Section label="Kabeldurchlass">
            <button
              onClick={() => actions.setCableHole(plateId, !hasCableHole)}
              style={{
                marginTop: 10, display: 'flex', alignItems: 'center', gap: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: 12, color: '#36342F',
                padding: 0,
              }}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 4,
                border: `2px solid ${hasCableHole ? '#171614' : '#C0BCB6'}`,
                background: hasCableHole ? '#171614' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 12, fontWeight: 700,
                transition: 'all 0.14s ease',
              }}>
                {hasCableHole ? '✓' : ''}
              </span>
              120 × 80 mm, zentriert unten
            </button>
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

const CHIP: React.CSSProperties = {
  width: 28, height: 28, borderRadius: '6px',
  border: 'none', cursor: 'pointer', flexShrink: 0,
  padding: 0, outline: 'none',
  transition: 'transform 0.14s ease, box-shadow 0.14s ease',
};
