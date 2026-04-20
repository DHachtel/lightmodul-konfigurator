import type { DimMap } from '@/core/types';

/** Einträge einer DimMap alphabetisch nach Schlüssel sortieren */
export function sortEntries(m: DimMap): [string, number][] {
  return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
}

/** Hex-Farbe um `amount` (0–1) abdunkeln */
export function darkenHex(hex: string, amount = 0.15): string {
  const c = hex.replace('#', '');
  if (c.length !== 6) return hex;
  const r = Math.round(parseInt(c.slice(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(c.slice(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(c.slice(4, 6), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
