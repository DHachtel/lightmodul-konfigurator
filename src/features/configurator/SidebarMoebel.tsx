'use client';

import type { ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { FOOTERS, HANDLES, MATERIALS, MAT_BY_V } from '@/core/constants';

// PG-Gruppen: PG3 (Alu) und PG4 (Glas) zusammen auf einer Zeile
const PG_GROUPS: Array<{ label: string; pgs: string[] }> = [
  { label: 'PG1 — MDF',             pgs: ['PG1'] },
  { label: 'PG2 — Furnier',         pgs: ['PG2'] },
  { label: 'PG3/4 — Alu & Glas',   pgs: ['PG3', 'PG4'] },
];

interface Props {
  state: ConfigState;
  actions: ConfigActions;
  pgAvail?: Record<string, boolean>;
}

export default function SidebarMoebel({ state, actions, pgAvail }: Props) {
  const matObj = MAT_BY_V[state.surface];

  // PG-Verfügbarkeit: pg-Key aus Material-Objekt ableiten (PG1→pg1, PG2→pg2, …)
  const isPgAvail = (pg: string): boolean => {
    const key = pg.toLowerCase().replace(' ', '');
    return pgAvail?.[key] !== false;
  };

  return (
    <div style={{ padding: '14px 16px 8px' }}>

      {/* ── OBERFLÄCHE ── */}
      <Section label="Oberfläche">
        {PG_GROUPS.map(group => {
          const mats = MATERIALS.filter(m => group.pgs.includes(m.pg));
          if (mats.length === 0) return null;
          const groupAvail = group.pgs.some(pg => isPgAvail(pg));
          return (
            <div key={group.label} style={{ marginTop: 8, opacity: groupAvail ? 1 : 0.35 }}>
              <span style={{ fontSize: 9, color: '#A8A49C', fontWeight: 500 }}>
                {group.label}
                {!groupAvail && <span style={{ color: '#C87040', marginLeft: 4 }}>— nicht verfügbar</span>}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                {mats.map(m => {
                  const avail = isPgAvail(m.pg);
                  return (
                    <button
                      key={m.v}
                      onClick={() => { if (avail) actions.setSurface(m.v); }}
                      disabled={!avail}
                      title={avail ? `${m.l} (${m.pg})` : `${m.l} — für diese Konfiguration nicht verfügbar`}
                      style={{
                        ...CHIP,
                        background: m.grad ?? m.hex,
                        boxShadow: state.surface === m.v
                          ? '0 0 0 2.5px #fff, 0 0 0 4.5px #171614'
                          : '0 0 0 1px rgba(0,0,0,0.13)',
                        transform: state.surface === m.v ? 'scale(1.1)' : 'scale(1)',
                        cursor: avail ? 'pointer' : 'not-allowed',
                        filter: avail ? 'none' : 'grayscale(0.8)',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}

        {matObj ? (
          <p style={{ fontSize: 9, color: '#A8A49C', marginTop: 6 }}>{matObj.l} · {matObj.pg}</p>
        ) : (
          <p style={{ fontSize: 9, color: '#C8C4BC', marginTop: 6 }}>Keine Oberfläche gewählt</p>
        )}
      </Section>

      <Divider />

      {/* ── TIEFE ── */}
      <Section label="Tiefe">
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {[360, 580].map(d => (
            <button
              key={d}
              onClick={() => actions.setDepth(d)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
                background: state.depth === d ? '#171614' : '#F2EFE9',
                color: state.depth === d ? '#FAFAF8' : '#6A6660',
                fontSize: 11, cursor: 'pointer', transition: 'all 0.14s ease',
                fontWeight: state.depth === d ? 500 : 400,
              }}
            >{d} mm</button>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── SEITEN + RÜCKEN ── */}
      <Section label="Seiten / Rücken">
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {(['outer', 'inner', 'back'] as const).map(k => (
            <button
              key={k}
              onClick={() => actions.toggleOpt(k)}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 8, border: 'none',
                background: state.opts[k] ? '#171614' : '#F2EFE9',
                color: state.opts[k] ? '#FAFAF8' : '#6A6660',
                fontSize: 11, cursor: 'pointer', transition: 'all 0.14s ease',
                fontWeight: state.opts[k] ? 500 : 400,
              }}
            >{k === 'outer' ? 'Außen' : k === 'inner' ? 'Innen' : 'Rücken'}</button>
          ))}
        </div>
      </Section>

      <Divider />

      {/* ── GRIFF + FÜSSE in einer kompakteren Anordnung ── */}
      <Section label="Griff">
        <select
          value={state.handle}
          onChange={e => actions.setHandle(e.target.value)}
          style={{ ...SELECT_STYLE, marginTop: 6 }}
        >
          {HANDLES.map(h => <option key={h.v} value={h.v}>{h.l}</option>)}
        </select>
      </Section>

      <Divider />

      <Section label="Füße / Rollen">
        <select
          value={state.footer}
          onChange={e => actions.setFooter(e.target.value)}
          style={{ ...SELECT_STYLE, marginTop: 6 }}
        >
          {FOOTERS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
        </select>
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
