// @ts-nocheck — Artmodul-Legacydatei, wird in Phase 1 auf Lightmodul umgebaut
import { useMemo } from 'react';
import type { ConfigState } from '@/core/types';
import { ELEMENT_SIZE_MM, PROFILE_COLOR_BY_V, FRAME_GROUP_BY_V } from '@/core/constants';

// ─── SceneObject Interface (abwärtskompatibel mit Preview3D) ──────────────────

export interface SceneObject {
  id: string;
  partType:
    | 'profil' | 'wuerfel' | 'front' | 'fachboden'
    | 'stellfuss' | 'rolle'
    // Lightmodul-Kompatibilitäts-Typen (nicht genutzt, aber Interface bleibt stabil)
    | 'seite_l' | 'seite_r' | 'boden' | 'deckel' | 'ruecken'
    | 'zwischenboden' | 'zwischenwand' | 'eckverbinder' | 'handle';
  position: [number, number, number]; // Three.js-Einheiten (1mm = 0.01)
  size:     [number, number, number]; // [width, height, depth]
  color:    string;                   // hex
  catKey?:       string;
  row?:          number;
  col?:          number;
  depth?:        number;
  partColorKey?: string;
  glbFile?:      string;
  preRotation?:  [number, number, number];
  rotation?:     [number, number, number];
  nonUniformScale?: boolean;
  roughness?: number;
  metalness?: number;
}

// ─── Geometrie-Konstanten ─────────────────────────────────────────────────────

const s  = 0.01;                 // 1mm → Three.js-Einheit
const S  = ELEMENT_SIZE_MM;     // 600mm Elementgröße
const P  = 25;                  // Profil-Außenmaß 25mm
const C  = 27;                  // Würfelgröße 27mm
const hp = P / 2;               // halbes Profil
const hc = C / 2;               // halber Würfel
const PROFILE_ALU   = '#b8c0c8'; // Aluminium-Hellsilber
const WUERFEL_COLOR = '#9fa8b0';  // Alu-Würfel etwas dunkler

// ─── Hauptfunktion ────────────────────────────────────────────────────────────

/**
 * computeModuleGeometry(state) → SceneObject[]
 *
 * Konvertiert den ConfigState in eine Liste von 3D-Szenenobjekten.
 *
 * Koordinatensystem (Three.js):
 *   X = Breite (rechts positiv)
 *   Y = Höhe   (oben positiv)
 *   Z = Tiefe  (vorne positiv, entgegen Kamerablickrichtung)
 *
 * Das Möbel wird zentriert um den Ursprung aufgebaut.
 * Zelle (0,0,0) = oben-links-vorne.
 */
export function computeModuleGeometry(state: ConfigState): SceneObject[] {
  const { cols, rows, depthLayers, grid, profileColor } = state;
  const nC = cols.length;
  const nR = rows.length;
  const nD = depthLayers;

  const objs: SceneObject[] = [];

  // Profil- und Würfelfarbe aus Konfiguration
  const matColor = PROFILE_COLOR_BY_V[profileColor]?.hex ?? PROFILE_ALU;

  // Gesamtmaße
  const totalW = nC * S;
  const totalH = nR * S;
  const totalD = nD * S;

  // Offset damit das Möbel zentriert bei Y=0 (Boden) und X,Z=0 steht
  const xBase = -totalW / 2;
  const yBase = 0;
  const zBase = -totalD / 2;

  // ── Hilfsfunktion: aktive Zelle ────────────────────────────────────────────
  const isActive = (r: number, c: number, d: number): boolean => {
    if (r < 0 || r >= nR || c < 0 || c >= nC || d < 0 || d >= nD) return false;
    return (grid[r]?.[c]?.[d]?.type ?? '') !== '';
  };

  // Knoten aktiv wenn mindestens eine angrenzende Zelle aktiv
  const nodeActive = (rk: number, ck: number, dk: number): boolean => {
    for (let r = Math.max(0, rk - 1); r <= Math.min(nR - 1, rk); r++)
      for (let c = Math.max(0, ck - 1); c <= Math.min(nC - 1, ck); c++)
        for (let d = Math.max(0, dk - 1); d <= Math.min(nD - 1, dk); d++)
          if (isActive(r, c, d)) return true;
    return false;
  };

  // ── Würfel (an jedem aktiven Knoten) ──────────────────────────────────────
  for (let rk = 0; rk <= nR; rk++) {
    for (let ck = 0; ck <= nC; ck++) {
      for (let dk = 0; dk <= nD; dk++) {
        if (!nodeActive(rk, ck, dk)) continue;

        // Würfelposition: Knoten (ck, rk, dk) → World-Koordinaten
        // X: xBase + ck * S, Y: yBase + (nR - rk) * S, Z: zBase + dk * S
        const wx = xBase + ck * S;
        const wy = yBase + (nR - rk) * S;
        const wz = zBase + dk * S;

        objs.push({
          id:       `wuerfel_rk${rk}_ck${ck}_dk${dk}`,
          partType: 'wuerfel',
          position: [wx * s, wy * s, wz * s],
          size:     [C * s, C * s, C * s],
          color:    WUERFEL_COLOR,
          roughness: 0.3,
          metalness: 0.7,
        });
      }
    }
  }

  // ── Horizontale Profile (X-Richtung, Breite) ──────────────────────────────
  let profIdx = 0;
  for (let rk = 0; rk <= nR; rk++) {
    for (let ck = 0; ck < nC; ck++) {
      for (let dk = 0; dk <= nD; dk++) {
        if (!nodeActive(rk, ck, dk) || !nodeActive(rk, ck + 1, dk)) continue;

        const wx = xBase + ck * S + S / 2;
        const wy = yBase + (nR - rk) * S;
        const wz = zBase + dk * S;

        objs.push({
          id:       `pB_${profIdx++}`,
          partType: 'profil',
          position: [wx * s, wy * s, wz * s],
          size:     [(S - C) * s, P * s, P * s], // Profil zwischen zwei Würfeln
          color:    matColor,
          roughness: 0.2,
          metalness: 0.8,
        });
      }
    }
  }

  // ── Vertikale Profile (Y-Richtung, Höhe) ──────────────────────────────────
  for (let rk = 0; rk < nR; rk++) {
    for (let ck = 0; ck <= nC; ck++) {
      for (let dk = 0; dk <= nD; dk++) {
        if (!nodeActive(rk, ck, dk) || !nodeActive(rk + 1, ck, dk)) continue;

        const wx = xBase + ck * S;
        const wy = yBase + (nR - rk) * S - S / 2;
        const wz = zBase + dk * S;

        objs.push({
          id:       `pH_${profIdx++}`,
          partType: 'profil',
          position: [wx * s, wy * s, wz * s],
          size:     [P * s, (S - C) * s, P * s],
          color:    matColor,
          roughness: 0.2,
          metalness: 0.8,
        });
      }
    }
  }

  // ── Tiefenprofile (Z-Richtung) ─────────────────────────────────────────────
  for (let rk = 0; rk <= nR; rk++) {
    for (let ck = 0; ck <= nC; ck++) {
      for (let dk = 0; dk < nD; dk++) {
        if (!nodeActive(rk, ck, dk) || !nodeActive(rk, ck, dk + 1)) continue;

        const wx = xBase + ck * S;
        const wy = yBase + (nR - rk) * S;
        const wz = zBase + dk * S + S / 2;

        objs.push({
          id:       `pT_${profIdx++}`,
          partType: 'profil',
          position: [wx * s, wy * s, wz * s],
          size:     [P * s, P * s, (S - C) * s],
          color:    matColor,
          roughness: 0.2,
          metalness: 0.8,
        });
      }
    }
  }

  // ── Einlegerahmen (in aktiven Zellen mit RF/RL) ────────────────────────────
  for (let r = 0; r < nR; r++) {
    for (let c = 0; c < nC; c++) {
      for (let d = 0; d < nD; d++) {
        const cell = grid[r]?.[c]?.[d];
        if (!cell || (cell.type !== 'RF' && cell.type !== 'RL')) continue;

        // Einlegerahmen nur auf der vorderen Fläche der Zelle (d = 0)
        // oder auf der hinteren Fläche (d = nD - 1) für volle Tiefendarstellung
        // Darstellung: flache Box als Rahmen-Füllung
        const frameDepth = 20; // mm Rahmentiefe für Visualisierung
        const margin     = 30; // mm Abstand zum Profil

        const cellCenterX = xBase + (c + 0.5) * S;
        const cellCenterY = yBase + (nR - r - 0.5) * S;
        const cellFrontZ  = zBase + d * S + frameDepth / 2;

        // Rahmenfarbe aus Produktgruppe
        const grpColor = FRAME_GROUP_BY_V[cell.frameGroup]?.hex ?? '#8090a0';
        // Beleuchtete Rahmen etwas heller
        const frameColor = cell.type === 'RL'
          ? lightenHex(grpColor, 40)
          : grpColor;

        objs.push({
          id:       `frame_r${r}_c${c}_d${d}`,
          partType: 'front',
          position: [cellCenterX * s, cellCenterY * s, cellFrontZ * s],
          size:     [(S - P * 2 - margin) * s, (S - P * 2 - margin) * s, frameDepth * s],
          color:    frameColor,
          row:      r,
          col:      c,
          depth:    d,
          roughness: cell.type === 'RL' ? 0.05 : 0.7,
          metalness: cell.type === 'RL' ? 0.1  : 0.0,
        });
      }
    }
  }

  // ── Stellfüße ─────────────────────────────────────────────────────────────
  if (state.opts?.footer !== false) {
    for (let ck = 0; ck <= nC; ck++) {
      for (let dk = 0; dk <= nD; dk++) {
        if (!nodeActive(nR, ck, dk)) continue;

        const wx = xBase + ck * S;
        const wz = zBase + dk * S;

        objs.push({
          id:       `foot_ck${ck}_dk${dk}`,
          partType: 'stellfuss',
          position: [wx * s, -25 * s, wz * s],
          size:     [20 * s, 50 * s, 20 * s],
          color:    '#707070',
          roughness: 0.6,
          metalness: 0.3,
        });
      }
    }
  }

  return objs;
}

// ─── React Hook ───────────────────────────────────────────────────────────────

export function useModuleGeometry(state: ConfigState): SceneObject[] {
  return useMemo(() => computeModuleGeometry(state), [state]);
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Hellt eine Hex-Farbe um `amount` auf */
function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
