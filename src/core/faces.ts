import type { Grid } from './types';

/**
 * Berechnet alle verfuegbaren Flaechen fuer Produktrahmen.
 * Eine Flaeche ist verfuegbar wenn:
 * 1. Die Zelle aktiv ist
 * 2. Die Nachbarzelle in dieser Richtung leer oder ausserhalb des Grids ist
 *
 * faceId-Format: face_r{R}_c{C}_d{D}_{side}
 * side: 'front' | 'back' | 'left' | 'right'
 */
export function computeAvailableFaces(grid: Grid, nC: number, nD: number): Set<string> {
  const faces = new Set<string>();
  const nR = grid.length;

  const isActive = (r: number, c: number, d: number): boolean => {
    if (r < 0 || r >= nR || c < 0 || c >= nC || d < 0 || d >= nD) return false;
    return (grid[r]?.[c]?.[d]?.type ?? '') !== '';
  };

  for (let r = 0; r < nR; r++) {
    for (let c = 0; c < nC; c++) {
      for (let d = 0; d < nD; d++) {
        if (!isActive(r, c, d)) continue;

        // Front (d-1 Richtung, zeigt zum Betrachter)
        if (!isActive(r, c, d - 1)) {
          faces.add(`face_r${r}_c${c}_d${d}_front`);
        }
        // Back (d+1 Richtung)
        if (!isActive(r, c, d + 1)) {
          faces.add(`face_r${r}_c${c}_d${d}_back`);
        }
        // Left (c-1 Richtung)
        if (!isActive(r, c - 1, d)) {
          faces.add(`face_r${r}_c${c}_d${d}_left`);
        }
        // Right (c+1 Richtung)
        if (!isActive(r, c + 1, d)) {
          faces.add(`face_r${r}_c${c}_d${d}_right`);
        }
      }
    }
  }

  return faces;
}

/** Parst eine faceId in ihre Bestandteile */
export function parseFaceId(faceId: string): { r: number; c: number; d: number; side: string } | null {
  const m = faceId.match(/^face_r(\d+)_c(\d+)_d(\d+)_(front|back|left|right)$/);
  if (!m) return null;
  return { r: parseInt(m[1]), c: parseInt(m[2]), d: parseInt(m[3]), side: m[4] };
}
