import { useMemo } from 'react';
import type { ConfigState } from '@/core/types';
import { ELEMENT_SIZE_MM, PROFILE_COLOR_BY_V, FRAME_GROUP_BY_V, BT_PROFILE_UPPER_MM, BT_PROFILE_LOWER_MM, CUBE_SIZE_MM } from '@/core/constants';

// ─── SceneObject Interface (abwärtskompatibel mit Preview3D) ──────────────────

export interface SceneObject {
  id: string;
  partType:
    | 'profil' | 'wuerfel' | 'front' | 'fachboden'
    | 'stellfuss' | 'rolle'
    | 'profil360' | 'profil213'
    // Lightmodul-Kompatibilitaets-Typen
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

  // ── Beratungstisch-Hilfsfunktionen ──────────────────────────────────────
  const BT_UP = BT_PROFILE_UPPER_MM;  // 360mm
  const BT_LO = BT_PROFILE_LOWER_MM;  // 213mm

  const isBTCell = (r: number, c: number, d: number): boolean => {
    if (r < 0 || r >= nR || c < 0 || c >= nC || d < 0 || d >= nD) return false;
    return grid[r]?.[c]?.[d]?.type === 'BT';
  };

  const btNodeActive = (rk: number, ck: number, dk: number): boolean => {
    for (let r2 = Math.max(0, rk - 1); r2 <= Math.min(nR - 1, rk); r2++)
      for (let c2 = Math.max(0, ck - 1); c2 <= Math.min(nC - 1, ck); c2++)
        for (let d2 = Math.max(0, dk - 1); d2 <= Math.min(nD - 1, dk); d2++)
          if (isBTCell(r2, c2, d2)) return true;
    return false;
  };

  // BT-Knoten-Reihe: BTs sitzen immer in der untersten Reihe (r = nR-1)
  const btRk = nR - 1;

  // Hilfsfunktion: naechste aktive Zelle zu einem Knoten (fuer Drill-Down-Klick)
  const nearestCell = (rk: number, ck: number, dk: number): { row: number; col: number; depth: number } | null => {
    for (let r = Math.max(0, rk - 1); r <= Math.min(nR - 1, rk); r++)
      for (let c = Math.max(0, ck - 1); c <= Math.min(nC - 1, ck); c++)
        for (let d = Math.max(0, dk - 1); d <= Math.min(nD - 1, dk); d++)
          if (isActive(r, c, d)) return { row: r, col: c, depth: d };
    return null;
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

        const nc = nearestCell(rk, ck, dk);
        objs.push({
          id:       `wuerfel_rk${rk}_ck${ck}_dk${dk}`,
          partType: 'wuerfel',
          position: [wx * s, wy * s, wz * s],
          size:     [C * s, C * s, C * s],
          color:    matColor,
          row:      nc?.row,
          col:      nc?.col,
          depth:    nc?.depth,
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

        const ncX = nearestCell(rk, ck, dk);
        objs.push({
          id:       `pB_${profIdx++}`,
          partType: 'profil',
          position: [wx * s, wy * s, wz * s],
          size:     [(S - C) * s, P * s, P * s], // Profil zwischen zwei Würfeln
          color:    matColor,
          row:      ncX?.row,
          col:      ncX?.col,
          depth:    ncX?.depth,
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

        // BT-Split: wo 360+Wuerfel+213 ein 600mm-Profil ersetzt
        if (rk === btRk && btNodeActive(btRk, ck, dk)) {
          let hasRegAbove = false;
          const btRow = nR - 1;
          if (btRow > 0) {
            for (let c2 = Math.max(0, ck - 1); c2 <= Math.min(nC - 1, ck); c2++)
              for (let d2 = Math.max(0, dk - 1); d2 <= Math.min(nD - 1, dk); d2++)
                if (isBTCell(btRow, c2, d2) && isActive(btRow - 1, c2, d2) && !isBTCell(btRow - 1, c2, d2))
                  hasRegAbove = true;
          }
          if (hasRegAbove) continue; // Skip — replaced by 360+213
        }

        const wx = xBase + ck * S;
        const wy = yBase + (nR - rk) * S - S / 2;
        const wz = zBase + dk * S;

        const ncY = nearestCell(rk, ck, dk);
        objs.push({
          id:       `pH_${profIdx++}`,
          partType: 'profil',
          position: [wx * s, wy * s, wz * s],
          size:     [P * s, (S - C) * s, P * s],
          color:    matColor,
          row:      ncY?.row,
          col:      ncY?.col,
          depth:    ncY?.depth,
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

        const ncZ = nearestCell(rk, ck, dk);
        objs.push({
          id:       `pT_${profIdx++}`,
          partType: 'profil',
          position: [wx * s, wy * s, wz * s],
          size:     [P * s, P * s, (S - C) * s],
          color:    matColor,
          row:      ncZ?.row,
          col:      ncZ?.col,
          depth:    ncZ?.depth,
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

        // Rahmenfarbe (Default-Grau, keine Produktgruppen-Zuordnung im Lightmodul)
        const grpColor = '#8090a0';
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
          // glbFile: '/models/stellfuss-m6.glb', // TODO: aktivieren wenn GLB vorliegt
          roughness: 0.6,
          metalness: 0.3,
        });
      }
    }
  }

  // ── Beratungstisch-Erhoehung ────────────────────────────────────────────
  for (let ck = 0; ck <= nC; ck++) {
    for (let dk = 0; dk <= nD; dk++) {
      if (!btNodeActive(btRk, ck, dk)) continue;

      const wx = xBase + ck * S;
      const wyBase2 = yBase + (nR - btRk) * S;
      const wz = zBase + dk * S;

      // Worktop-Zwischenwuerfel
      const wyWorktop = wyBase2 + BT_UP;
      objs.push({
        id:       `bt_wuerfel_ck${ck}_dk${dk}`,
        partType: 'wuerfel',
        position: [wx * s, wyWorktop * s, wz * s],
        size:     [C * s, C * s, C * s],
        color:    matColor,
        roughness: 0.3,
        metalness: 0.7,
      });

      // 360mm Vertikalprofil
      const prof360Y = wyBase2 + BT_UP / 2;
      objs.push({
        id:       `bt_p360_ck${ck}_dk${dk}`,
        partType: 'profil360',
        position: [wx * s, prof360Y * s, wz * s],
        size:     [P * s, (BT_UP - C) * s, P * s],
        color:    matColor,
        roughness: 0.2,
        metalness: 0.8,
      });

      // 213mm Anschlussprofil (nur wenn regulaeres Modul in derselben Spalte/Tiefe direkt ueber dem BT)
      {
        let hasRegularAbove = false;
        const btRow = nR - 1;
        if (btRow > 0) {
          for (let c2 = Math.max(0, ck - 1); c2 <= Math.min(nC - 1, ck); c2++)
            for (let d2 = Math.max(0, dk - 1); d2 <= Math.min(nD - 1, dk); d2++)
              if (isBTCell(btRow, c2, d2) && isActive(btRow - 1, c2, d2) && !isBTCell(btRow - 1, c2, d2))
                hasRegularAbove = true;
        }
        if (hasRegularAbove) {
          const wyUpper = yBase + (nR - btRk + 1) * S;
          const prof213Y = wyWorktop + (wyUpper - wyWorktop) / 2;
          objs.push({
            id:       `bt_p213_ck${ck}_dk${dk}`,
            partType: 'profil213',
            position: [wx * s, prof213Y * s, wz * s],
            size:     [P * s, (BT_LO - C) * s, P * s],
            color:    matColor,
            roughness: 0.2,
            metalness: 0.8,
          });
        }
      }
    }
  }

  // Worktop horizontale Profile (X-Richtung)
  for (let ck = 0; ck < nC; ck++) {
    for (let dk = 0; dk <= nD; dk++) {
      if (!btNodeActive(btRk, ck, dk) || !btNodeActive(btRk, ck + 1, dk)) continue;

      const wx = xBase + ck * S + S / 2;
      const wy = yBase + (nR - btRk) * S + BT_UP;
      const wz = zBase + dk * S;

      objs.push({
        id:       `bt_pX_ck${ck}_dk${dk}`,
        partType: 'profil',
        position: [wx * s, wy * s, wz * s],
        size:     [(S - C) * s, P * s, P * s],
        color:    matColor,
        roughness: 0.2,
        metalness: 0.8,
      });
    }
  }

  // Worktop horizontale Profile (Z-Richtung)
  for (let ck = 0; ck <= nC; ck++) {
    for (let dk = 0; dk < nD; dk++) {
      if (!btNodeActive(btRk, ck, dk) || !btNodeActive(btRk, ck, dk + 1)) continue;

      const wx = xBase + ck * S;
      const wy = yBase + (nR - btRk) * S + BT_UP;
      const wz = zBase + dk * S + S / 2;

      objs.push({
        id:       `bt_pZ_ck${ck}_dk${dk}`,
        partType: 'profil',
        position: [wx * s, wy * s, wz * s],
        size:     [P * s, P * s, (S - C) * s],
        color:    matColor,
        roughness: 0.2,
        metalness: 0.8,
      });
    }
  }

  // Worktop-Fachboden: 3 Ebenen pro BT-Zelle (unten, mitte, oben)
  for (let r = 0; r < nR; r++) {
    for (let c = 0; c < nC; c++) {
      for (let d = 0; d < nD; d++) {
        if (!isBTCell(r, c, d)) continue;

        const cellCenterX = xBase + (c + 0.5) * S;
        const cellCenterZ = zBase + (d + 0.5) * S;
        const shelfSize: [number, number, number] = [(S - P * 2) * s, 8 * s, (S - P * 2) * s];
        const shelfColor = '#C0B8A8';

        // Unterer Fachboden (Bodenniveau, Y = Unterkante Basiskubus)
        const yBottom = yBase + (nR - r - 1) * S;
        objs.push({
          id:       `bt_shelf_bot_r${r}_c${c}_d${d}`,
          partType: 'fachboden',
          position: [cellCenterX * s, yBottom * s, cellCenterZ * s],
          size:     shelfSize,
          color:    shelfColor,
          row: r, col: c, depth: d,
          roughness: 0.8, metalness: 0.0,
        });

        // Mittlerer Fachboden (Oberkante Basiskubus, Y = 600mm ueber Unterkante)
        const yMiddle = yBase + (nR - r) * S;
        objs.push({
          id:       `bt_shelf_mid_r${r}_c${c}_d${d}`,
          partType: 'fachboden',
          position: [cellCenterX * s, yMiddle * s, cellCenterZ * s],
          size:     shelfSize,
          color:    shelfColor,
          row: r, col: c, depth: d,
          roughness: 0.8, metalness: 0.0,
        });

        // Oberer Fachboden / Arbeitsplatte (Worktop-Niveau, Y = 960mm)
        const yTop = yBase + (nR - r) * S + BT_UP;
        objs.push({
          id:       `bt_shelf_top_r${r}_c${c}_d${d}`,
          partType: 'fachboden',
          position: [cellCenterX * s, yTop * s, cellCenterZ * s],
          size:     shelfSize,
          color:    shelfColor,
          row: r, col: c, depth: d,
          roughness: 0.8, metalness: 0.0,
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
