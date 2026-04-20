'use client';

import type { ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { FOOTERS, PROFILE_COLORS } from '@/core/constants';

interface Props {
  state: ConfigState;
  actions: ConfigActions;
  pgAvail?: Record<string, boolean>;
}

export default function SidebarMoebel({ state, actions }: Props) {
  return (
    <div style={{ padding: '14px 16px 8px' }}>

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
