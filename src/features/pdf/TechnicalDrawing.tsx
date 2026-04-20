// @ts-nocheck
// TODO: Für Lightmodul neu schreiben — noch Artmodul-Layout
import React from 'react';
import { Svg, Rect, Line, Path, Circle, Text as SvgText, G } from '@react-pdf/renderer';
import type { ConfigState, CellType } from '@/core/types';

// ── Konstanten ────────────────────────────────────────────────────────────────

const PROFIL = 30;    // Profilbreite mm (= Würfel bündig, bestimmt Außenmaß)
const PLATE = PROFIL / 2; // Halbes Profil = Abstand Würfelzentrum → Außenkante
const CW = 480;       // SVG-Canvas Breite (fest)
const DRAW_W = 340;   // Zeichenfläche Breite
const DRAW_H = 240;   // Zeichenfläche Höhe (max)
const MARGIN_X = 70;  // Rand links (für Bemaßung)
const MARGIN_Y = 20;  // Rand oben

// ── Farben ────────────────────────────────────────────────────────────────────

const COL = {
  outline: '#1a1a1a',
  divider: '#666',
  profil: '#b0b8c0',
  front: '#e8e5e0',
  handle: '#888',
  dim: '#333',
  ext: '#aaa',
  text: '#555',
};

// ── Pfeilspitzen-Helfer ───────────────────────────────────────────────────────

function arrow(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return '';
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  const aL = 4, aW = 1.5;
  return [
    `M ${x2} ${y2}`,
    `L ${x2 - ux * aL + px * aW} ${y2 - uy * aL + py * aW}`,
    `L ${x2 - ux * aL - px * aW} ${y2 - uy * aL - py * aW}`,
    `Z`,
    `M ${x1} ${y1}`,
    `L ${x1 + ux * aL + px * aW} ${y1 + uy * aL + py * aW}`,
    `L ${x1 + ux * aL - px * aW} ${y1 + uy * aL - py * aW}`,
    `Z`,
  ].join(' ');
}

// Inline-Style-Helfer
const txtStyle = (sz: number, color = COL.dim) => ({ fontSize: sz, fill: color } as const);
const txtMid   = (sz: number, color = COL.dim) => ({ ...txtStyle(sz, color), textAnchor: 'middle' as const });

// ── Aktive Bounding Box ───────────────────────────────────────────────────────

function getActiveBounds(config: ConfigState) {
  const numRows = config.rows.length;
  const numCols = config.cols.length;
  let minR = numRows, maxR = -1, minC = numCols, maxC = -1;
  for (let r = 0; r < numRows; r++)
    for (let c = 0; c < numCols; c++)
      if (config.grid[r]?.[c]?.[0]?.type !== '') {
        if (r < minR) minR = r; if (r > maxR) maxR = r;
        if (c < minC) minC = c; if (c > maxC) maxC = c;
      }
  if (maxR < 0) { minR = 0; maxR = numRows - 1; minC = 0; maxC = numCols - 1; }
  return {
    minR, maxR, minC, maxC,
    cols: config.cols.slice(minC, maxC + 1),
    rows: config.rows.slice(minR, maxR + 1),
  };
}

// ── Front-Symbole ─────────────────────────────────────────────────────────────

function frontSymbol(
  type: CellType, x: number, y: number, w: number, h: number, s: number,
): React.ReactElement[] {
  const els: React.ReactElement[] = [];
  const key = `front_${x}_${y}`;
  const inset = 2 * s;
  const fx = x + inset, fy = y + inset;
  const fw = w - 2 * inset, fh = h - 2 * inset;

  if (type === 'K' || type === 'S' || type === 'TR' || type === 'TL' || type === 'DT') {
    els.push(
      <Rect key={`${key}_bg`} x={fx} y={fy} width={fw} height={fh}
        fill={COL.front} stroke={COL.divider} strokeWidth={0.4} />,
    );
  }

  const handleW = Math.min(fw * 0.3, 20 * s);
  const handleH = 1.5 * s;
  if (type === 'K') {
    els.push(
      <Line key={`${key}_h`}
        x1={fx + fw / 2 - handleW / 2} y1={fy + 4 * s}
        x2={fx + fw / 2 + handleW / 2} y2={fy + 4 * s}
        stroke={COL.handle} strokeWidth={handleH} />,
    );
  } else if (type === 'S') {
    els.push(
      <Line key={`${key}_h`}
        x1={fx + fw / 2 - handleW / 2} y1={fy + fh / 2}
        x2={fx + fw / 2 + handleW / 2} y2={fy + fh / 2}
        stroke={COL.handle} strokeWidth={handleH} />,
    );
  } else if (type === 'TR') {
    const vH = Math.min(fh * 0.25, 16 * s);
    els.push(
      <Line key={`${key}_h`}
        x1={fx + fw - 4 * s} y1={fy + fh / 2 - vH / 2}
        x2={fx + fw - 4 * s} y2={fy + fh / 2 + vH / 2}
        stroke={COL.handle} strokeWidth={handleH} />,
    );
  } else if (type === 'TL') {
    const vH = Math.min(fh * 0.25, 16 * s);
    els.push(
      <Line key={`${key}_h`}
        x1={fx + 4 * s} y1={fy + fh / 2 - vH / 2}
        x2={fx + 4 * s} y2={fy + fh / 2 + vH / 2}
        stroke={COL.handle} strokeWidth={handleH} />,
    );
  } else if (type === 'DT') {
    const vH = Math.min(fh * 0.25, 16 * s);
    els.push(
      <Line key={`${key}_m`}
        x1={fx + fw / 2} y1={fy} x2={fx + fw / 2} y2={fy + fh}
        stroke={COL.divider} strokeWidth={0.3} />,
      <Line key={`${key}_hl`}
        x1={fx + fw / 2 - 4 * s} y1={fy + fh / 2 - vH / 2}
        x2={fx + fw / 2 - 4 * s} y2={fy + fh / 2 + vH / 2}
        stroke={COL.handle} strokeWidth={handleH} />,
      <Line key={`${key}_hr`}
        x1={fx + fw / 2 + 4 * s} y1={fy + fh / 2 - vH / 2}
        x2={fx + fw / 2 + 4 * s} y2={fy + fh / 2 + vH / 2}
        stroke={COL.handle} strokeWidth={handleH} />,
    );
  }

  return els;
}

// ── TechnicalDrawingView ──────────────────────────────────────────────────────

export function TechnicalDrawingView({ config }: { config: ConfigState }) {
  const { minR, minC, cols: activeCols, rows: activeRows } = getActiveBounds(config);

  const totalW = activeCols.reduce((a, b) => a + b, 0);
  const totalH = activeRows.reduce((a, b) => a + b, 0);
  const outerW = totalW + 2 * PLATE;
  const outerH = totalH + 2 * PLATE;

  const scale = Math.min(DRAW_W / outerW, DRAW_H / outerH);
  const dwW   = outerW * scale;
  const dwH   = outerH * scale;

  const ox = MARGIN_X + (DRAW_W - dwW) / 2;
  const oy = MARGIN_Y + (DRAW_H - dwH) / 2;

  const plateP = PLATE * scale;
  const profilP = PROFIL * scale;
  const scaleRatio = Math.round(1 / scale);

  const dimYTotal = oy + dwH + 30;
  const dimYCols  = oy + dwH + 16;
  const dimXTotal = ox - 30;
  const dimXRows  = ox - 16;

  // Dynamische SVG-Höhe: unterkante des tiefsten Elements + Padding
  const contentBottom = dimYTotal + 12; // Gesamtbreite-Label + Padding
  const CH = Math.max(contentBottom + 4, oy + dwH + 50); // Minimum: Zeichnung + 50px für Bemaßung

  // ── Spalten- und Zeilen-Positionen berechnen ─────────────────────────────
  const colX: number[] = [];
  {
    let x = 0;
    colX.push(x);
    for (const w of activeCols) { x += w; colX.push(x); }
  }
  const rowY: number[] = [];
  {
    let y = 0;
    rowY.push(y);
    for (const h of activeRows) { y += h; rowY.push(y); }
  }

  // ── Profilecken ────────────────────────────────────────────────────────────
  const profilCorners: React.ReactElement[] = [];
  for (let ci = 0; ci <= activeCols.length; ci++) {
    for (let ri = 0; ri <= activeRows.length; ri++) {
      const px = ox + plateP + colX[ci] * scale - profilP / 2;
      const py = oy + plateP + rowY[ri] * scale - profilP / 2;
      profilCorners.push(
        <Rect key={`prof_${ci}_${ri}`}
          x={px} y={py} width={profilP} height={profilP}
          fill={COL.profil} stroke="#999" strokeWidth={0.3} rx={1} />,
      );
    }
  }

  // ── Zwischenwände ──────────────────────────────────────────────────────────
  const dividers: React.ReactElement[] = [];
  for (let ci = 1; ci < activeCols.length; ci++) {
    const xPt = ox + plateP + colX[ci] * scale;
    for (let ri = 0; ri < activeRows.length; ri++) {
      const yTop = oy + plateP + rowY[ri] * scale + profilP / 2;
      const yBot = oy + plateP + rowY[ri + 1] * scale - profilP / 2;
      dividers.push(
        <Line key={`div_v_${ci}_${ri}`}
          x1={xPt} y1={yTop} x2={xPt} y2={yBot}
          stroke={COL.divider} strokeWidth={0.6} />,
      );
    }
  }
  for (let ri = 1; ri < activeRows.length; ri++) {
    const yPt = oy + plateP + rowY[ri] * scale;
    for (let ci = 0; ci < activeCols.length; ci++) {
      const xL = ox + plateP + colX[ci] * scale + profilP / 2;
      const xR = ox + plateP + colX[ci + 1] * scale - profilP / 2;
      dividers.push(
        <Line key={`div_h_${ri}_${ci}`}
          x1={xL} y1={yPt} x2={xR} y2={yPt}
          stroke={COL.divider} strokeWidth={0.6} />,
      );
    }
  }

  // ── Front-Symbole pro Zelle ────────────────────────────────────────────────
  const fronts: React.ReactElement[] = [];
  for (let ri = 0; ri < activeRows.length; ri++) {
    for (let ci = 0; ci < activeCols.length; ci++) {
      const cell = config.grid[minR + ri]?.[minC + ci];
      if (!cell || cell.type === '' || cell.type === 'O') continue;
      const cellX = ox + plateP + colX[ci] * scale + profilP / 2;
      const cellY = oy + plateP + rowY[ri] * scale + profilP / 2;
      const cellW = activeCols[ci] * scale - profilP;
      const cellH = activeRows[ri] * scale - profilP;
      fronts.push(...frontSymbol(cell.type, cellX, cellY, cellW, cellH, scale));

      if (cell.shelves > 0) {
        for (let si = 1; si <= cell.shelves; si++) {
          const sy = cellY + (cellH * si) / (cell.shelves + 1);
          fronts.push(
            <Line key={`shelf_${ri}_${ci}_${si}`}
              x1={cellX + 2} y1={sy} x2={cellX + cellW - 2} y2={sy}
              stroke={COL.divider} strokeWidth={0.3} strokeDasharray="3,2" />,
          );
        }
      }
    }
  }

  // ── Spalten-Einzelmaße ─────────────────────────────────────────────────────
  const colDims: React.ReactElement[] = [];
  for (let i = 0; i < activeCols.length; i++) {
    const x0 = ox + plateP + colX[i] * scale;
    const x1 = ox + plateP + colX[i + 1] * scale;
    const xMid = (x0 + x1) / 2;
    if ((x1 - x0) >= 18) {
      colDims.push(
        <Line key={`cdl_${i}`} x1={x0} y1={dimYCols} x2={x1} y2={dimYCols}
          stroke={COL.dim} strokeWidth={0.5} />,
        <Path key={`cda_${i}`} d={arrow(x0, dimYCols, x1, dimYCols)}
          fill={COL.dim} stroke="none" />,
        <SvgText key={`cdt_${i}`} x={xMid} y={dimYCols - 2}
          style={txtMid(5.5)}>{`${activeCols[i]}`}</SvgText>,
      );
    }
  }

  // ── Zeilen-Einzelmaße ──────────────────────────────────────────────────────
  const rowDims: React.ReactElement[] = [];
  for (let i = 0; i < activeRows.length; i++) {
    const y0 = oy + plateP + rowY[i] * scale;
    const y1 = oy + plateP + rowY[i + 1] * scale;
    const yMid = (y0 + y1) / 2;
    if ((y1 - y0) >= 14) {
      rowDims.push(
        <Line key={`rdl_${i}`} x1={dimXRows} y1={y0} x2={dimXRows} y2={y1}
          stroke={COL.dim} strokeWidth={0.5} />,
        <Path key={`rda_${i}`} d={arrow(dimXRows, y0, dimXRows, y1)}
          fill={COL.dim} stroke="none" />,
        <G key={`rdt_${i}`} transform={`rotate(-90, ${dimXRows - 3}, ${yMid})`}>
          <SvgText x={dimXRows - 3} y={yMid + 2} style={txtMid(5.5)}>{`${activeRows[i]}`}</SvgText>
        </G>,
      );
    }
  }

  return (
    <Svg width={CW} height={CH} viewBox={`0 0 ${CW} ${CH}`}>

      {/* Außenkontur */}
      <Rect x={ox} y={oy} width={dwW} height={dwH}
        fill="none" stroke={COL.outline} strokeWidth={1.2} />
      <Rect x={ox + plateP} y={oy + plateP}
        width={dwW - 2 * plateP} height={dwH - 2 * plateP}
        fill="none" stroke={COL.outline} strokeWidth={0.4} />

      {profilCorners}
      {dividers}
      {fronts}

      {/* Spalten-Einzelmaße */}
      <Line x1={ox + plateP} y1={oy + dwH + 2} x2={ox + plateP} y2={dimYCols + 4}
        stroke={COL.ext} strokeWidth={0.3} />
      <Line x1={ox + dwW - plateP} y1={oy + dwH + 2} x2={ox + dwW - plateP} y2={dimYCols + 4}
        stroke={COL.ext} strokeWidth={0.3} />
      {colDims}

      {/* Gesamtbreite */}
      <Line x1={ox} y1={oy + dwH + 2} x2={ox} y2={dimYTotal + 4}
        stroke={COL.ext} strokeWidth={0.3} />
      <Line x1={ox + dwW} y1={oy + dwH + 2} x2={ox + dwW} y2={dimYTotal + 4}
        stroke={COL.ext} strokeWidth={0.3} />
      <Line x1={ox} y1={dimYTotal} x2={ox + dwW} y2={dimYTotal}
        stroke={COL.dim} strokeWidth={0.5} />
      <Path d={arrow(ox, dimYTotal, ox + dwW, dimYTotal)} fill={COL.dim} stroke="none" />
      <SvgText x={ox + dwW / 2} y={dimYTotal + 8} style={txtMid(6.5)}>{`${outerW} mm`}</SvgText>

      {/* Zeilen-Einzelmaße */}
      <Line x1={ox - 2} y1={oy + plateP} x2={dimXRows - 4} y2={oy + plateP}
        stroke={COL.ext} strokeWidth={0.3} />
      <Line x1={ox - 2} y1={oy + dwH - plateP} x2={dimXRows - 4} y2={oy + dwH - plateP}
        stroke={COL.ext} strokeWidth={0.3} />
      {rowDims}

      {/* Gesamthöhe */}
      <Line x1={ox - 2} y1={oy} x2={dimXTotal - 4} y2={oy}
        stroke={COL.ext} strokeWidth={0.3} />
      <Line x1={ox - 2} y1={oy + dwH} x2={dimXTotal - 4} y2={oy + dwH}
        stroke={COL.ext} strokeWidth={0.3} />
      <Line x1={dimXTotal} y1={oy} x2={dimXTotal} y2={oy + dwH}
        stroke={COL.dim} strokeWidth={0.5} />
      <Path d={arrow(dimXTotal, oy, dimXTotal, oy + dwH)} fill={COL.dim} stroke="none" />
      <G transform={`rotate(-90, ${dimXTotal - 8}, ${oy + dwH / 2})`}>
        <SvgText x={dimXTotal - 8} y={oy + dwH / 2 + 3} style={txtMid(6.5)}>{`${outerH} mm`}</SvgText>
      </G>

      {/* Tiefe (diagonal) */}
      <Line x1={ox + dwW + 6} y1={oy} x2={ox + dwW + 20} y2={oy - 12}
        stroke={COL.dim} strokeWidth={0.4} />
      <SvgText x={ox + dwW + 22} y={oy - 14} style={txtStyle(6.5)}>{`T: ${config.depth} mm`}</SvgText>

      {/* Maßstab — direkt unter der Gesamtbreite, rechts */}
      <SvgText x={ox + dwW} y={dimYTotal + 8} style={{ ...txtStyle(5, '#999'), textAnchor: 'start' as const }}>
        {`   Frontansicht · 1:${scaleRatio}`}
      </SvgText>

    </Svg>
  );
}
