import type { CellTypeOption, Footer, Material } from './types';

// ─── Festes Rastermaß ────────────────────────────────────────────────────────

/** Lightmodul hat ein einziges, fixes Elementmaß: 600 × 600 × 600 mm */
export const ELEMENT_SIZE_MM = 600;

// ─── Grid-Grenzen ────────────────────────────────────────────────────────────

/** Maximale Anzahl Elemente pro Achse */
export const MAX_COLS    = 8;   // Breite
export const MAX_ROWS    = 5;   // Höhe
export const MAX_DEPTH   = 4;   // Tiefe (Anzahl Elemente in Z-Richtung)

export const MIN_COLS  = 1;
export const MIN_ROWS  = 1;
export const MIN_DEPTH = 1;

// ─── Struktur-Maße (mm) ──────────────────────────────────────────────────────

/** Aluminium-Profil-Querschnitt 25 × 25 mm */
export const PROFILE_SIZE_MM = 25;

/** Alu-Würfel-Kantenlänge 27 mm */
export const CUBE_SIZE_MM = 27;

// ─── Hardware-Mengen pro Alu-Würfel (Montagereferenz) ────────────────────────

export const HW_M4_PER_CUBE = 4;
export const HW_MUTTERN_PER_CUBE = 4;
export const HW_M6_PER_CUBE = 2;
export const HW_SCHEIBEN_PER_CUBE = 2;

// ─── Profilfarben ─────────────────────────────────────────────────────────────

/**
 * Lightmodul hat nur zwei Profilfarben: Schwarz oder Weiß.
 * Wird in ConfigState als `profileColor` gespeichert.
 */
export const PROFILE_COLORS: Material[] = [
  { v: 'SW', l: 'Schwarz', pg: 'PG1', hex: '#1a1a1a', border: '#000000', textured: false },
  { v: 'WS', l: 'Weiß',    pg: 'PG1', hex: '#f0f0ee', border: '#d8d8d6', textured: false },
];

export const PROFILE_COLOR_BY_V: Record<string, Material> =
  Object.fromEntries(PROFILE_COLORS.map(m => [m.v, m]));

// ─── Zelltypen ───────────────────────────────────────────────────────────────

/**
 * '' = leer (kein Element / Lücke im Gerüst)
 * 'O' = offen (Gerüstfeld ohne Einlegerahmen)
 * 'RF' = Einlegerahmen Standard
 * 'RL' = Einlegerahmen beleuchtet
 */
export const CELL_TYPES: CellTypeOption[] = [
  { v: '',   l: '— leer'                  },
  { v: 'O',  l: 'Offen (kein Rahmen)'     },
  { v: 'RF', l: 'Einlegerahmen Standard'   },
  { v: 'RL', l: 'Einlegerahmen beleuchtet' },
];

// ─── Stellfüße ───────────────────────────────────────────────────────────────

export const FOOTERS: Footer[] = [
  { v: 'stell_m6', l: 'Stellfuß M6',     art_nr: '6962' },
  { v: 'rolle',    l: 'Rolle (optional)', art_nr: '9100' },
];

export const FOOTER_BY_V: Record<string, Footer> =
  Object.fromEntries(FOOTERS.map(f => [f.v, f]));

// ─── Zubehör / Komponenten ───────────────────────────────────────────────────

/** Fachboden 600×600 mm */
export const SHELF_ART_NR = '6964';

// ─── Preisgruppen-Darstellung ─────────────────────────────────────────────────

/** Lightmodul hat zunächst eine einzige Preisgruppe (PG1) */
export const PG_DOT: Record<string, string> = {
  PG1: '#4a7a9b',
  '—': 'transparent',
};
