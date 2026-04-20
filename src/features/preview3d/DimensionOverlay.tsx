'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';

const S = 0.01; // 1mm = 0.01 Three.js units
const PROF = 30; // Profil-Würfel-Überstand in mm

const RULER_COLOR = '#8A8680';
const TICK_LEN = 8 * S;  // 8mm tick marks
const GAP = 25 * S;      // 25mm gap from furniture to first ruler
const GAP2 = 55 * S;     // 55mm gap for total dimension bracket

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 8,
  fontWeight: 500,
  color: '#6A6660',
  background: 'rgba(255,255,255,0.85)',
  padding: '1px 4px',
  borderRadius: 3,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
};

const TOTAL_LABEL_STYLE: React.CSSProperties = {
  ...LABEL_STYLE,
  fontSize: 9,
  fontWeight: 600,
  color: '#4A4640',
};

interface DimensionOverlayProps {
  cols: number[];
  rows: number[];
  depth: number;
  grid: { type: string }[][];
  /** Footer-Höhe in mm (Stellfuß+Nivellier=60, Rolle=60, Nivellierschraube=15, sonst 0) */
  footerHeight: number;
}

export default function DimensionOverlay({ cols, rows, depth, grid, footerHeight }: DimensionOverlayProps) {
  const { xOff, yOff, wAct, hAct, minC, maxC, minR, maxR } = useMemo(() => {
    const numRows = rows.length, numCols = cols.length;
    let mnR = numRows, mxR = -1, mnC = numCols, mxC = -1;
    for (let r = 0; r < numRows; r++)
      for (let c = 0; c < numCols; c++)
        if (grid[r][c].type !== '') {
          if (r < mnR) mnR = r; if (r > mxR) mxR = r;
          if (c < mnC) mnC = c; if (c > mxC) mxC = c;
        }
    if (mxR < 0) { mnR = 0; mxR = numRows - 1; mnC = 0; mxC = numCols - 1; }
    const xO = cols.slice(0, mnC).reduce((a, b) => a + b, 0);
    const yO = rows.slice(mxR + 1).reduce((a, b) => a + b, 0);
    const w = cols.slice(mnC, mxC + 1).reduce((a, b) => a + b, 0);
    const h = rows.slice(mnR, mxR + 1).reduce((a, b) => a + b, 0);
    return { xOff: xO, yOff: yO, wAct: w, hAct: h, minC: mnC, maxC: mxC, minR: mnR, maxR: mxR };
  }, [cols, rows, grid]);

  // Außenmaß = Achsmaß + 30mm (15mm Profilüberstand pro Seite)
  const outerW = wAct + PROF;
  const outerH = footerHeight + hAct + PROF; // vom Boden (inkl. Fuß) bis Oberkante
  const outerD = depth + PROF;

  // Möbel-Außenkanten in Three.js-Koordinaten (Profil ragt 15mm über Achse hinaus)
  const halfProf = PROF / 2; // 15mm
  const leftX = (xOff - halfProf) * S;
  const rightX = (xOff + wAct + halfProf) * S;
  const bottomY = (yOff - halfProf - footerHeight) * S; // Boden inkl. Fuß
  const topY = (yOff + hAct + halfProf) * S;
  const frontZ = (depth + halfProf + 5) * S; // leicht vor dem Möbel

  const fmt = (mm: number) => `${(mm / 10).toFixed(1)}`;

  // ── Horizontale Spalten-Ticks (Positionen der Spaltenränder innerhalb der aktiven Region)
  const colTicks: number[] = [];
  {
    let x = xOff;
    for (let i = minC; i <= maxC; i++) {
      colTicks.push(x * S);
      x += cols[i];
    }
    colTicks.push(x * S); // rechter Rand der letzten Spalte
  }

  // ── Vertikale Zeilen-Ticks (Positionen der Zeilenränder)
  const rowTicks: number[] = [];
  {
    let y = yOff;
    for (let i = maxR; i >= minR; i--) {
      rowTicks.push(y * S);
      y += rows[i];
    }
    rowTicks.push(y * S); // oberer Rand der obersten Zeile
  }

  const activeCols = cols.slice(minC, maxC + 1);
  const activeRows = rows.slice(minR, maxR + 1).slice().reverse(); // bottom to top

  // THREE wird nur für den Import benötigt (Line erwartet Vector3-kompatible Punkte)
  void THREE;

  return (
    <>
      {/* ══════════════════════════════════════════
          HORIZONTALER METERSTAB (unten)
          ══════════════════════════════════════════ */}

      {/* Hauptlinie — Spaltenbereich */}
      <Line
        points={[[colTicks[0], bottomY - GAP, frontZ], [colTicks[colTicks.length - 1], bottomY - GAP, frontZ]]}
        color={RULER_COLOR}
        lineWidth={1}
      />

      {/* Ticks an Spaltenrändern */}
      {colTicks.map((x, i) => (
        <Line
          key={`ct_${i}`}
          points={[[x, bottomY - GAP - TICK_LEN / 2, frontZ], [x, bottomY - GAP + TICK_LEN / 2, frontZ]]}
          color={RULER_COLOR}
          lineWidth={1}
        />
      ))}

      {/* Spaltenbreiten-Labels */}
      {activeCols.map((w, i) => {
        const cx = (colTicks[i] + colTicks[i + 1]) / 2;
        return (
          <Html key={`cl_${i}`} position={[cx, bottomY - GAP, frontZ]} center style={LABEL_STYLE}>
            {fmt(w)}
          </Html>
        );
      })}

      {/* Gesamtbreite — Bracket darunter */}
      <Line
        points={[[leftX, bottomY - GAP2, frontZ], [rightX, bottomY - GAP2, frontZ]]}
        color={RULER_COLOR}
        lineWidth={1.5}
      />
      <Line
        points={[[leftX, bottomY - GAP2 - TICK_LEN / 2, frontZ], [leftX, bottomY - GAP2 + TICK_LEN / 2, frontZ]]}
        color={RULER_COLOR}
        lineWidth={1.5}
      />
      <Line
        points={[[rightX, bottomY - GAP2 - TICK_LEN / 2, frontZ], [rightX, bottomY - GAP2 + TICK_LEN / 2, frontZ]]}
        color={RULER_COLOR}
        lineWidth={1.5}
      />
      <Html position={[(leftX + rightX) / 2, bottomY - GAP2, frontZ]} center style={TOTAL_LABEL_STYLE}>
        {`${fmt(outerW)} cm`}
      </Html>

      {/* ══════════════════════════════════════════
          VERTIKALER METERSTAB (rechts)
          ══════════════════════════════════════════ */}

      {/* Hauptlinie — Zeilenbereich */}
      <Line
        points={[[rightX + GAP, rowTicks[0], frontZ], [rightX + GAP, rowTicks[rowTicks.length - 1], frontZ]]}
        color={RULER_COLOR}
        lineWidth={1}
      />

      {/* Ticks an Zeilenrändern */}
      {rowTicks.map((y, i) => (
        <Line
          key={`rt_${i}`}
          points={[[rightX + GAP - TICK_LEN / 2, y, frontZ], [rightX + GAP + TICK_LEN / 2, y, frontZ]]}
          color={RULER_COLOR}
          lineWidth={1}
        />
      ))}

      {/* Zeilenhöhen-Labels */}
      {activeRows.map((h, i) => {
        const cy = (rowTicks[i] + rowTicks[i + 1]) / 2;
        return (
          <Html key={`rl_${i}`} position={[rightX + GAP, cy, frontZ]} center style={LABEL_STYLE}>
            {fmt(h)}
          </Html>
        );
      })}

      {/* Gesamthöhe — Bracket rechts davon */}
      <Line
        points={[[rightX + GAP2, bottomY, frontZ], [rightX + GAP2, topY, frontZ]]}
        color={RULER_COLOR}
        lineWidth={1.5}
      />
      <Line
        points={[[rightX + GAP2 - TICK_LEN / 2, bottomY, frontZ], [rightX + GAP2 + TICK_LEN / 2, bottomY, frontZ]]}
        color={RULER_COLOR}
        lineWidth={1.5}
      />
      <Line
        points={[[rightX + GAP2 - TICK_LEN / 2, topY, frontZ], [rightX + GAP2 + TICK_LEN / 2, topY, frontZ]]}
        color={RULER_COLOR}
        lineWidth={1.5}
      />
      <Html position={[rightX + GAP2, (bottomY + topY) / 2, frontZ]} center style={TOTAL_LABEL_STYLE}>
        {`${fmt(outerH)} cm`}
      </Html>

      {/* ══════════════════════════════════════════
          TIEFE — Linie entlang Z-Achse (unten rechts)
          ══════════════════════════════════════════ */}
      {(() => {
        const dY = bottomY - GAP;       // gleiche Höhe wie horizontaler Meterstab
        const dX = rightX + GAP;         // gleiche X wie vertikaler Meterstab
        const zFront = (depth + halfProf) * S;
        const zBack = -halfProf * S;
        return (
          <>
            {/* Hauptlinie — Tiefe entlang Z */}
            <Line
              points={[[dX, dY, zFront], [dX, dY, zBack]]}
              color={RULER_COLOR}
              lineWidth={1.5}
            />
            {/* Tick vorne */}
            <Line
              points={[[dX - TICK_LEN / 2, dY, zFront], [dX + TICK_LEN / 2, dY, zFront]]}
              color={RULER_COLOR}
              lineWidth={1.5}
            />
            {/* Tick hinten */}
            <Line
              points={[[dX - TICK_LEN / 2, dY, zBack], [dX + TICK_LEN / 2, dY, zBack]]}
              color={RULER_COLOR}
              lineWidth={1.5}
            />
            {/* Label Mitte */}
            <Html position={[dX, dY, (zFront + zBack) / 2]} center style={TOTAL_LABEL_STYLE}>
              {`${fmt(outerD)} cm`}
            </Html>
          </>
        );
      })()}
    </>
  );
}
