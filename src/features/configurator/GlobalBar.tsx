'use client';

import type { ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { FOOTERS, HANDLES, MATERIALS, MAT_BY_V } from '@/core/constants';

// ── Material-Gruppen (identisch mit Prototyp) ─────────────────────────────────
const MAT_GROUPS = [
  { label: 'KH',      items: MATERIALS.filter(m => m.pg === 'PG1') },
  { label: 'Furnier', items: MATERIALS.filter(m => m.pg === 'PG4') },
  { label: 'Alu',     items: MATERIALS.filter(m => m.pg === 'PG2') },
  { label: 'Glas',    items: MATERIALS.filter(m => m.pg === 'PG3') },
];

const PG_BADGE: Record<string, React.CSSProperties> = {
  PG1: { background: '#F5F2EA', borderColor: '#D8D0BC', color: '#5C5040' },
  PG2: { background: '#ECF0F6', borderColor: '#C0CCD8', color: '#3C4C58' },
  PG3: { background: '#EEF5EE', borderColor: '#B8D0BC', color: '#3A5040' },
  PG4: { background: '#F5EEE8', borderColor: '#D4C0B0', color: '#584840' },
};

interface Props {
  state: ConfigState;
  actions: ConfigActions;
}

export default function GlobalBar({ state, actions }: Props) {
  const matObj     = MAT_BY_V[state.surface];
  const pgBadge    = matObj?.pg ?? '—';
  return (
    <div style={BAR_STYLE}>

      {/* ── Tiefe ── */}
      <Group label="Tiefe">
        {[360, 580].map(d => (
          <button
            key={d}
            onClick={() => actions.setDepth(d)}
            style={{
              ...BTN_BASE,
              background: state.depth === d ? '#171614' : 'transparent',
              borderColor: state.depth === d ? '#171614' : '#D8D5CF',
              color: state.depth === d ? '#FAFAF8' : '#6A6660',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{d}</span>
            <span style={{ fontSize: 9, opacity: 0.6 }}>mm</span>
          </button>
        ))}
      </Group>

      <Sep />

      {/* ── Oberfläche ── */}
      <Group label="Oberfläche">
        {/* Kein-Swatch */}
        <button
          onClick={() => actions.setSurface('none')}
          title="— keine Oberfläche"
          style={{
            ...SWATCH_BASE,
            background: '#e8e5de',
            borderColor: state.surface === 'none' ? '#171614' : 'transparent',
            boxShadow: state.surface === 'none' ? '0 0 0 2px #FAFAF8, 0 0 0 3px #171614' : 'none',
            color: '#9a9690', fontSize: 12, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>

        <div style={{ width: 1, height: 18, background: '#D8D5CF', margin: '0 4px', flexShrink: 0 }} />

        {/* Material-Gruppen */}
        {MAT_GROUPS.map((grp, gi) => (
          <div key={grp.label} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {grp.items.map(m => {
              const active = state.surface === m.v;
              return (
                <button
                  key={m.v}
                  onClick={() => actions.setSurface(m.v)}
                  title={`${m.l} (${m.pg})`}
                  style={{
                    ...SWATCH_BASE,
                    background: m.grad ?? m.hex,
                    borderColor: active ? '#171614' : 'transparent',
                    boxShadow: active ? '0 0 0 2px #FAFAF8, 0 0 0 3px #171614' : 'none',
                    transform: active ? 'scale(1.1)' : 'scale(1)',
                  }}
                />
              );
            })}
            {gi < MAT_GROUPS.length - 1 && (
              <div style={{ width: 1, height: 18, background: '#D8D5CF', margin: '0 3px', flexShrink: 0 }} />
            )}
          </div>
        ))}

        {/* Badge + Name */}
        <span style={{
          fontSize: 9, padding: '2px 6px', borderRadius: 2,
          border: '1px solid', marginLeft: 6, flexShrink: 0, fontWeight: 500,
          ...(PG_BADGE[pgBadge] ?? { background: '#F0EDE7', borderColor: '#E0DDD7', color: '#787470' }),
          whiteSpace: 'nowrap',
        }}>
          {pgBadge}
        </span>
        {matObj && matObj.pg !== '—' && (
          <span style={{ fontSize: 10, color: '#4A4844', minWidth: 80, whiteSpace: 'nowrap' }}>
            {matObj.l}
          </span>
        )}
      </Group>

      <Sep />

      {/* ── Seiten ── */}
      <Group label="Seiten">
        {(['outer', 'inner'] as const).map(k => (
          <button
            key={k}
            onClick={() => actions.toggleOpt(k)}
            style={{
              ...BTN_BASE,
              background: state.opts[k] ? '#171614' : 'transparent',
              borderColor: state.opts[k] ? '#171614' : '#D8D5CF',
              color: state.opts[k] ? '#FAFAF8' : '#6A6660',
            }}
          >
            {k === 'outer' ? 'Außen' : 'Innen'}
          </button>
        ))}
      </Group>

      <Sep />

      {/* ── Griff ── */}
      <Group label="Griff">
        <select
          value={state.handle}
          onChange={e => actions.setHandle(e.target.value)}
          style={SELECT_STYLE}
          className="border border-[#D8D5CF] outline-none focus:border-[#171614] transition-colors duration-150"
        >
          {HANDLES.map(h => (
            <option key={h.v} value={h.v}>{h.l}</option>
          ))}
        </select>
      </Group>

      <Sep />

      {/* ── Füße / Rollen ── */}
      <Group label="Füße">
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

// ── Hilfskomponenten ──────────────────────────────────────────────────────────

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

// ── Stil-Konstanten ────────────────────────────────────────────────────────────

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

// Basis für Toggle-Buttons (Tiefe, Seiten)
const BTN_BASE: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontWeight: 400, fontSize: 11,
  display: 'flex', alignItems: 'center', gap: 3,
  padding: '4px 10px', border: '1px solid',
  borderRadius: 3, cursor: 'pointer',
  transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
  whiteSpace: 'nowrap', outline: 'none',
};

const SWATCH_BASE: React.CSSProperties = {
  width: 24, height: 24, borderRadius: 3,
  borderWidth: '2px', borderStyle: 'solid',
  cursor: 'pointer', flexShrink: 0,
  transition: 'transform .12s ease, box-shadow .12s ease, border-color .15s ease',
  padding: 0, outline: 'none',
};

const SELECT_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
  background: 'transparent',
  color: '#36342F', borderRadius: 3,
  padding: '4px 8px', cursor: 'pointer',
  height: 30, minWidth: 160,
};
