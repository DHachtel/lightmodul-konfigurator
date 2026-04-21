'use client';

import type { CellType, ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { FOOTERS, PROFILE_COLORS } from '@/core/constants';

interface Props {
  state: ConfigState;
  actions: ConfigActions;
  pgAvail?: Record<string, boolean>;
  placementType?: CellType;
  onPlacementTypeChange?: (t: 'O' | 'BT') => void;
}

// Mini-SVG-Vorschauen fuer die Basiselemente
function CubeIcon({ active }: { active: boolean }) {
  const stroke = active ? '#FAFAF8' : '#6A6660';
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      {/* Wuerfel-Wireframe */}
      <rect x="10" y="14" width="22" height="22" rx="1" stroke={stroke} strokeWidth="1.5" fill="none" />
      <line x1="32" y1="14" x2="38" y2="8" stroke={stroke} strokeWidth="1.5" />
      <line x1="10" y1="14" x2="16" y2="8" stroke={stroke} strokeWidth="1.5" />
      <line x1="16" y1="8" x2="38" y2="8" stroke={stroke} strokeWidth="1.5" />
      <line x1="38" y1="8" x2="38" y2="30" stroke={stroke} strokeWidth="1.5" />
      <line x1="32" y1="36" x2="38" y2="30" stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

function BeratungstischIcon({ active }: { active: boolean }) {
  const stroke = active ? '#FAFAF8' : '#6A6660';
  const accent = active ? '#9ECBFF' : '#7BA8D4';
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      {/* Basis-Wuerfel */}
      <rect x="10" y="24" width="22" height="16" rx="1" stroke={stroke} strokeWidth="1.5" fill="none" />
      {/* Erhoehung (360mm Profile) */}
      <line x1="12" y1="24" x2="12" y2="14" stroke={accent} strokeWidth="2" />
      <line x1="30" y1="24" x2="30" y2="14" stroke={accent} strokeWidth="2" />
      {/* Worktop-Rahmen */}
      <rect x="10" y="12" width="22" height="4" rx="1" stroke={accent} strokeWidth="1.5" fill="none" />
      {/* Arbeitsplatte */}
      <line x1="12" y1="13" x2="30" y2="13" stroke={accent} strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

export default function SidebarMoebel({ state, actions, placementType = 'O', onPlacementTypeChange }: Props) {
  return (
    <div style={{ padding: '14px 16px 8px' }}>

      {/* -- BASISELEMENT -- */}
      <Section label="Basiselement">
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {([
            { v: 'O' as const, l: 'Wuerfel', Icon: CubeIcon },
            { v: 'BT' as const, l: 'Beratungstisch', Icon: BeratungstischIcon },
          ]).map(({ v, l, Icon }) => {
            const isActive = placementType === v;
            return (
              <button
                key={v}
                onClick={() => onPlacementTypeChange?.(v)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', v);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 4, padding: '10px 6px 8px', borderRadius: 10,
                  border: isActive ? '2px solid #171614' : '2px solid transparent',
                  background: isActive ? '#171614' : '#F2EFE9',
                  color: isActive ? '#FAFAF8' : '#6A6660',
                  fontSize: 10, fontWeight: isActive ? 500 : 400,
                  cursor: 'grab', transition: 'all 0.14s ease',
                  userSelect: 'none',
                }}
              >
                <Icon active={isActive} />
                {l}
              </button>
            );
          })}
        </div>
        <p style={{
          fontSize: 9, color: '#A8A49C', marginTop: 6, lineHeight: 1.4,
          fontFamily: 'var(--font-sans)',
        }}>
          Klicke auf + im 3D-Bereich, um das gewaehlte Element zu platzieren.
        </p>
      </Section>

      <Divider />

      {/* -- PROFILFARBE -- */}
      <Section label="Profilfarbe">
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {PROFILE_COLORS.map(pc => (
            <button
              key={pc.v}
              onClick={() => actions.setProfileColor(pc.v)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
                background: state.profileColor === pc.v ? '#171614' : '#F2EFE9',
                color: state.profileColor === pc.v ? '#FAFAF8' : '#6A6660',
                fontSize: 11, cursor: 'pointer', transition: 'all 0.14s ease',
                fontWeight: state.profileColor === pc.v ? 500 : 400,
              }}
            >{pc.l}</button>
          ))}
        </div>
      </Section>

      <Divider />

      {/* -- STELLFUESSE -- */}
      <Section label="Stellfuesse">
        <select
          value={state.footer}
          onChange={e => actions.setFooter(e.target.value)}
          style={{ ...SELECT_STYLE, marginTop: 6 }}
        >
          {FOOTERS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
        </select>
      </Section>

      <Divider />

      {/* -- FACHBOEDEN-TOGGLE -- */}
      <Section label="Fachboeden">
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button
            onClick={() => {
              // Toggle opts.shelves -- need to work via available action
              // Not directly available as toggleOpt, so we keep this read-only info
            }}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
              background: state.opts.shelves ? '#171614' : '#F2EFE9',
              color: state.opts.shelves ? '#FAFAF8' : '#6A6660',
              fontSize: 11, cursor: 'pointer', transition: 'all 0.14s ease',
              fontWeight: state.opts.shelves ? 500 : 400,
            }}
          >
            {state.opts.shelves ? 'Aktiv' : 'Aus'}
          </button>
        </div>
      </Section>
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

const SELECT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
  background: '#F2EFE9', border: '1px solid #E2DFD9',
  color: '#36342F', borderRadius: 8,
  padding: '6px 10px', cursor: 'pointer',
  width: '100%', height: 34, outline: 'none',
};
