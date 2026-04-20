/** Eintraege eines Record<string, number> alphabetisch nach Schluessel sortieren */
export function sortEntries(m: Record<string, number>): [string, number][] {
  return (Object.entries(m) as [string, number][]).sort(([a], [b]) => a.localeCompare(b));
}

/** Hex-Farbe um `amount` (0-1) abdunkeln */
export function darkenHex(hex: string, amount = 0.15): string {
  const c = hex.replace('#', '');
  if (c.length !== 6) return hex;
  const r = Math.round(parseInt(c.slice(0, 2), 16) * (1 - amount));
  const g = Math.round(parseInt(c.slice(2, 4), 16) * (1 - amount));
  const b = Math.round(parseInt(c.slice(4, 6), 16) * (1 - amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
