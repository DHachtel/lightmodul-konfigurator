// @ts-nocheck — Artmodul-Legacydatei, wird in Phase 1 auf Lightmodul umgebaut
'use client';

import React, { useMemo } from 'react';
import type { CellType, ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';
import { WIDTHS, HEIGHTS, CELL_TYPES, MAT_BY_V, FRAME_GROUP_BY_V } from '@/core/constants';
import { canPlace, maxShelves } from '@/core/validation';

// ── Skalierung ────────────────────────────────────────────────────────────────
const SCALE     = 0.35;
const PROF_MM   = 25;  // Lightmodul: 25mm Profile
const COL_HDR_H = 26;
const ROW_LBL_W = 56;

// ── Gitter-Knotenpositionen ───────────────────────────────────────────────────

function nodeX(cols: number[]): number[] {
  const r = [0];
  for (const w of cols) r.push(r[r.length - 1] + PROF_MM + w);
  return r;
}

function nodeY(rows: number[]): number[] {
  const r = [0];
  for (const h of rows) r.push(r[r.length - 1] + PROF_MM + h);
  return r;
}

// ── Zellfarbe ─────────────────────────────────────────────────────────────────

function cellBackground(type: CellType, profileColor: string): React.CSSProperties {
  if (type === '') {
    return { background: 'var(--paper, #f8f6f2)', border: '1px dashed #c0bcb4' };
  }
  const mat = MAT_BY_V[profileColor];
  const base = mat ? mat.hex : '#e0e0e0';
  if (type === 'RF' || type === 'RL') {
    const lit = type === 'RL' ? 'rgba(255,240,180,0.18)' : 'transparent';
    return {
      background: `${lit}, rgba(255,255,255,0.08), ${base}`,
      border: `1px solid ${mat?.border ?? '#ccc'}`,
      boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.10)',
    };
  }
  return {
    background: `rgba(255,255,255,0.06), ${base}`,
    border: `1px solid ${mat?.border ?? '#ccc'}`,
    boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.08)',
  };
}

// ── Rahmen-Typ-Anzeige ────────────────────────────────────────────────────────

function FrameIndicator({ type, frameGroup }: { type: CellType; frameGroup: string }) {
  if (type !== 'RF' && type !== 'RL') return null;
  const grp = FRAME_GROUP_BY_V[frameGroup];
  return (
    <div style={{
      position: 'absolute', inset: '15%',
      border: '2px solid rgba(255,255,255,0.4)',
      borderRadius: 2,
      background: grp ? `${grp.hex}44` : 'rgba(255,255,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      {type === 'RL' && (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffe080', boxShadow: '0 0 6px #ffd700' }} />
      )}
    </div>
  );
}

// ── Stile ─────────────────────────────────────────────────────────────────────

const HDR_SELECT: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: 9,
  background: '#fff', border: '1px solid #dddad3', color: '#3a3834',
  borderRadius: 2, padding: '1px 2px', cursor: 'pointer', outline: 'none',
  textAlign: 'center', width: 50,
};

const CELL_SELECT: React.CSSProperties = {
  fontFamily: 'var(--font-sans)', fontSize: 9,
  background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(0,0,0,0.20)',
  color: '#3a3834', borderRadius: 2, padding: '1px 2px',
  cursor: 'pointer', outline: 'none', width: 76,
  position: 'relative', zIndex: 2,
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props { state: ConfigState; actions: ConfigActions; }

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function ConfigGrid({ state, actions }: Props) {
  const { cols, rows, profileColor } = state;
  // Lightmodul: profileColor ist das surface-Äquivalent
  const surface = profileColor ?? state.surface ?? 'SW';
  const C = cols.length;
  const R = rows.length;

  const nX = useMemo(() => nodeX(cols), [cols]);
  const nY = useMemo(() => nodeY(rows), [rows]);

  const profileBg = MAT_BY_V[surface]?.hex ?? '#c8c8c8';

  const totalW   = (nX[C] + PROF_MM) * SCALE;
  const totalH   = (nY[R] + PROF_MM) * SCALE;
  const totalWmm = nX[C] + PROF_MM;
  const totalHmm = nY[R] + PROF_MM;

  // Lightmodul: 2D-Grid zeigt immer die vordere Tiefenebene (d=0)
  // grid ist Cell[][][], wir arbeiten mit grid[r][c][0]

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-end',
      paddingBottom: '10vh',
      paddingRight: 264,
      overflow: 'hidden',
    }}>

      {/* Tiefenebenen-Anzeige */}
      {state.depthLayers > 1 && (
        <div style={{
          marginBottom: 8, padding: '5px 10px',
          background: '#e8f0fe', border: '1px solid #b8c8f8',
          borderRadius: 4, color: '#1a4090',
          fontFamily: 'var(--font-mono)', fontSize: 10,
        }}>
          Ansicht: Vorderseite (Ebene 1 von {state.depthLayers}) — weitere Ebenen im 3D-Viewer
        </div>
      )}

      {/* Warnungen */}
      {actions.gravityError && (
        <div style={{
          marginBottom: 12, padding: '7px 12px',
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 4, color: '#dc2626',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>⚑</span>
          <span style={{ flex: 1 }}>{actions.gravityError}</span>
          <button onClick={actions.clearGravityError}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Grid-Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${ROW_LBL_W}px ${totalW}px`,
        gridTemplateRows:    `${COL_HDR_H}px ${totalH}px`,
        flexShrink: 0,
      }}>

        {/* Spaltenbreiten-Selects */}
        <div style={{ gridColumn: 2, gridRow: 1, position: 'relative' }}>
          {cols.map((w, c) => {
            const cx = ((nX[c] + PROF_MM + w / 2) / totalWmm) * 100;
            return (
              <div key={c} style={{
                position: 'absolute', left: `${cx}%`, top: '50%',
                transform: 'translate(-50%, -50%)',
              }}>
                <select value={w} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => actions.setCol(c, +e.target.value)} style={HDR_SELECT}>
                  {WIDTHS.map((v: number) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            );
          })}
        </div>

        {/* Zeilenhöhen-Selects */}
        <div style={{ gridColumn: 1, gridRow: 2, position: 'relative' }}>
          {rows.map((h, r) => {
            const cy = ((nY[r] + PROF_MM + h / 2) / totalHmm) * 100;
            return (
              <div key={r} style={{
                position: 'absolute', right: 4, top: `${cy}%`,
                transform: 'translateY(-50%)',
              }}>
                <select value={h} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => actions.setRow(r, +e.target.value)} style={HDR_SELECT}>
                  {HEIGHTS.map((v: number) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            );
          })}
        </div>

        {/* Gitter — zeigt Vordere Tiefenebene (d=0) */}
        <div style={{
          gridColumn: 2, gridRow: 2, position: 'relative',
          background: profileBg,
          boxShadow: '0 4px 14px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.14)',
        }}>
          {rows.map((_h, r) =>
            cols.map((w, c) => {
              // Lightmodul: 3D-Grid, wir zeigen immer Tiefenebene 0
              const cell = state.grid[r]?.[c]?.[0] ?? { type: '' as CellType, frameGroup: '', shelves: 0 };
              const h = rows[r];

              const left   = `${((nX[c] + PROF_MM) / totalWmm) * 100}%`;
              const top    = `${((nY[r] + PROF_MM) / totalHmm) * 100}%`;
              const width  = `${(w / totalWmm) * 100}%`;
              const height = `${(h / totalHmm) * 100}%`;

              const isActive = cell.type !== '';

              const bg = cellBackground(cell.type, surface);

              return (
                <div
                  key={`cell-${r}-${c}`}
                  style={{
                    position: 'absolute', left, top, width, height,
                    boxSizing: 'border-box',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                    transition: 'background 0.2s ease',
                    ...bg,
                  }}
                >
                  {isActive && <FrameIndicator type={cell.type} frameGroup={cell.frameGroup} />}
                  {isActive && cell.shelves > 0 && Array.from({ length: cell.shelves }, (_, i) => (
                    <div key={i} style={{
                      position: 'absolute', left: '5%', right: '5%',
                      top: `${(i + 1) / (cell.shelves + 1) * 100}%`,
                      height: 1, background: 'rgba(255,255,255,0.4)', pointerEvents: 'none',
                    }} />
                  ))}
                  <select
                    value={cell.type}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                      actions.setType(r, c, e.target.value as CellType)
                    }
                    style={CELL_SELECT}
                  >
                    {CELL_TYPES.map(({ v, l }) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {isActive && (
                    <ShelfStepper
                      shelves={cell.shelves}
                      max={maxShelves(h)}
                      onDec={() => actions.setShelves(r, c, cell.shelves - 1)}
                      onInc={() => actions.setShelves(r, c, cell.shelves + 1)}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}

// ── Fachboden-Stepper ─────────────────────────────────────────────────────────

const SHELF_BTN_STYLE: React.CSSProperties = {
  width: 14, height: 14, borderRadius: 2,
  border: '1px solid rgba(0,0,0,0.20)',
  color: '#5c4a34', fontSize: 11, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'var(--font-mono)', padding: 0, flexShrink: 0,
  transition: 'opacity 0.15s, background 0.15s',
};

function ShelfStepper({ shelves, max, onDec, onInc }: {
  shelves: number;
  max: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', bottom: 2, left: 0, right: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
    }}>
      <button
        onClick={e => { e.stopPropagation(); onDec(); }}
        disabled={shelves === 0}
        style={{ ...SHELF_BTN_STYLE, opacity: shelves === 0 ? 0.3 : 1, cursor: shelves === 0 ? 'default' : 'pointer', background: 'rgba(255,255,255,0.8)' }}
      >−</button>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#5c4a34', minWidth: 10, textAlign: 'center' }}>
        {shelves}
      </span>
      <button
        onClick={e => { e.stopPropagation(); onInc(); }}
        disabled={shelves >= max}
        style={{ ...SHELF_BTN_STYLE, opacity: shelves >= max ? 0.3 : 1, cursor: shelves >= max ? 'default' : 'pointer', background: 'rgba(255,255,255,0.8)' }}
      >+</button>
    </div>
  );
}
