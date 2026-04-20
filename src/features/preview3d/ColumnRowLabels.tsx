'use client';

import { useState, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { WIDTHS, HEIGHTS } from '@/core/constants';

const S = 0.01;

interface Props {
  cols: number[];
  rows: number[];
  grid: { type: string }[][];
  depth: number;
  onSetCol: (col: number, width: number) => void;
  onSetRow: (row: number, height: number) => void;
}

/**
 * Spaltenbreiten (oben) und Zeilenhöhen (links) als Hover-Dropdowns
 * in der 3D-Szene — sichtbar auf Möbel-Ebene.
 */
export default function ColumnRowLabels({ cols, rows, grid, depth, onSetCol, onSetRow }: Props) {
  // Aktive Range ermitteln
  const { minR, maxR, minC, maxC } = useMemo(() => {
    let minR = rows.length, maxR = -1, minC = cols.length, maxC = -1;
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < cols.length; c++)
        if (grid[r]?.[c]?.type !== '' && grid[r]?.[c]?.type !== undefined) {
          if (r < minR) minR = r; if (r > maxR) maxR = r;
          if (c < minC) minC = c; if (c > maxC) maxC = c;
        }
    if (maxR < 0) { minR = 0; maxR = 0; minC = 0; maxC = 0; }
    return { minR, maxR, minC, maxC };
  }, [grid, rows.length, cols.length]);

  const activeYTop = useMemo(() => {
    const yBot = rows.slice(maxR + 1).reduce((a, b) => a + b, 0);
    const hAct = rows.slice(minR, maxR + 1).reduce((a, b) => a + b, 0);
    return yBot + hAct;
  }, [rows, minR, maxR]);

  const activeXLeft = useMemo(
    () => cols.slice(0, minC).reduce((a, b) => a + b, 0),
    [cols, minC],
  );

  return (
    <>
      {/* Spaltenbreiten — oben über jeder aktiven Spalte */}
      {cols.map((w, c) => {
        if (c < minC || c > maxC) return null;
        const xLeft = cols.slice(0, c).reduce((a, b) => a + b, 0);
        const xCenter = xLeft + w / 2;
        const yPos = activeYTop + 40; // 40mm über dem Möbel
        return (
          <HoverDropdown
            key={`col_${c}`}
            position={[xCenter * S, yPos * S, (depth / 2) * S]}
            currentValue={w}
            options={WIDTHS}
            onSelect={(val) => onSetCol(c, val)}
            direction="horizontal"
          />
        );
      })}

      {/* Zeilenhöhen — links neben jeder aktiven Zeile */}
      {rows.map((h, r) => {
        if (r < minR || r > maxR) return null;
        const yBottom = rows.slice(r + 1).reduce((a, b) => a + b, 0);
        const yCenter = yBottom + h / 2;
        const xPos = activeXLeft - 40; // 40mm links vom Möbel
        return (
          <HoverDropdown
            key={`row_${r}`}
            position={[xPos * S, yCenter * S, (depth / 2) * S]}
            currentValue={h}
            options={HEIGHTS}
            onSelect={(val) => onSetRow(r, val)}
            direction="vertical"
          />
        );
      })}
    </>
  );
}

// ── Hover-Dropdown: zeigt Wert, öffnet bei Hover ────────────────────────────

function HoverDropdown({
  position,
  currentValue,
  options,
  onSelect,
  direction,
}: {
  position: [number, number, number];
  currentValue: number;
  options: number[];
  onSelect: (val: number) => void;
  direction: 'horizontal' | 'vertical';
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verzögertes Schließen — gibt Zeit um zum Dropdown zu navigieren
  function scheduleClose() {
    closeTimer.current = setTimeout(() => setOpen(false), 250);
  }
  function cancelClose() {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }

  return (
    <Html position={position} center style={{ pointerEvents: 'auto' }}>
      <div
        onMouseEnter={() => { cancelClose(); setOpen(true); }}
        onMouseLeave={scheduleClose}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative', display: 'inline-block',
          // Größerer Hover-Bereich: unsichtbares Padding um das Label
          padding: 8, margin: -8,
        }}
      >
        {/* Label: aktueller Wert */}
        <div style={{
          padding: '4px 12px', borderRadius: 5,
          background: open ? 'rgba(23,22,20,0.85)' : 'rgba(23,22,20,0.45)',
          color: '#FAFAF8', fontSize: 10, fontWeight: 500,
          fontFamily: 'var(--font-sans)', cursor: 'pointer',
          whiteSpace: 'nowrap', textAlign: 'center',
          transition: 'background 0.14s ease',
        }}>
          {currentValue}
        </div>

        {/* Dropdown — kein Gap zum Label (marginTop/marginRight = 0) */}
        {open && (
          <div style={{
            position: 'absolute',
            ...(direction === 'horizontal'
              ? { top: '100%', left: '50%', transform: 'translateX(-50%)', paddingTop: 2 }
              : { right: '100%', top: '50%', transform: 'translateY(-50%)', paddingRight: 2 }),
          }}>
            <div style={{
              display: 'flex',
              flexDirection: direction === 'horizontal' ? 'row' : 'column',
              gap: 2, padding: 4,
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
              borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              zIndex: 100,
            }}>
              {options.map(val => (
                <button
                  key={val}
                  onClick={() => { onSelect(val); setOpen(false); }}
                  style={{
                    padding: '4px 8px', borderRadius: 4, border: 'none',
                    background: currentValue === val ? '#171614' : 'transparent',
                    color: currentValue === val ? '#FAFAF8' : '#6A6660',
                    fontSize: 10, fontWeight: currentValue === val ? 600 : 400,
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.12s ease',
                  }}
                >{val}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Html>
  );
}
