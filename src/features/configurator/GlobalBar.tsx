'use client';

import type { ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { FOOTERS, PROFILE_COLORS } from '@/core/constants';

interface Props {
  state: ConfigState;
  actions: ConfigActions;
}

export default function GlobalBar({ state, actions }: Props) {
  return (
    <div style={BAR_STYLE}>

      {/* -- Profilfarbe -- */}
      <Group label="Profil">
        {PROFILE_COLORS.map(pc => (
          <button
            key={pc.v}
            onClick={() => actions.setProfileColor(pc.v)}
            style={{
              ...BTN_BASE,
              background: state.profileColor === pc.v ? '#171614' : 'transparent',
              borderColor: state.profileColor === pc.v ? '#171614' : '#D8D5CF',
              color: state.profileColor === pc.v ? '#FAFAF8' : '#6A6660',
            }}
          >
            {pc.l}
          </button>
        ))}
      </Group>

      <Sep />

      {/* -- Stellfuesse -- */}
      <Group label="Stellfuesse">
        <select
          value={state.footer}
          onChange={e => actions.setFooter(e.target.value)}
          style={SELECT_STYLE}
          className="border border-[#D8D5CF] outline-none focus:border-[#171614] transition-colors duration-150"
        >
          {FOOTERS.map(f => (
            <option key={f.v} value={f.v}>{f.l}</option>
          ))}
        </select>
      </Group>

    </div>
  );
}

// -- Hilfskomponenten --

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
      <span style={{
        fontFamily: 'var(--font-sans)', fontWeight: 500,
        fontSize: 8, letterSpacing: '.16em', textTransform: 'uppercase',
        color: '#B0ACA5',
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {children}
      </div>
    </div>
  );
}

function Sep() {
  return (
    <div style={{ width: 1, height: 36, background: '#E0DDD7', flexShrink: 0, alignSelf: 'center' }} />
  );
}

// -- Stil-Konstanten --

const BAR_STYLE: React.CSSProperties = {
  background: '#F5F2EE',
  borderBottom: '1px solid #E0DDD7',
  padding: '10px 28px',
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  flexShrink: 0,
  overflowX: 'auto',
};

const BTN_BASE: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 11,
  display: 'flex', alignItems: 'center', gap: 3,
  padding: '4px 10px', border: '1px solid',
  borderRadius: 3, cursor: 'pointer',
  transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
  whiteSpace: 'nowrap', outline: 'none',
};

const SELECT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
  background: 'transparent',
  color: '#36342F', borderRadius: 3,
  padding: '4px 8px', cursor: 'pointer',
  height: 30, minWidth: 160,
};
