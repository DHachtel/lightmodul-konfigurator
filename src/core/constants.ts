import type { CellTypeOption, Footer, Material } from './types';

// ─── Festes Rastermaß ────────────────────────────────────────────────────────

/** Lightmodul hat ein einziges, fixes Elementmaß: 600 × 600 × 600 mm */
export const ELEMENT_SIZE_MM = 600;

/** @deprecated Kompatibilitätsexport — Lightmodul hat festes Rastermaß */
export const WIDTHS  = [ELEMENT_SIZE_MM];
export const HEIGHTS = [ELEMENT_SIZE_MM];

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

// ─── Einlegerahmen-Produktgruppen ────────────────────────────────────────────

/**
 * Jede Produktgruppe steht für eine MHZ-Produktkategorie
 * (z.B. Rollladen, Raffstore, Insektenschutz…).
 * Im Konfigurator wählt der Händler pro Zelle eine Gruppe aus.
 * Artikelnummern und Beschreibungen werden aus Supabase geladen.
 */
export interface FrameGroup {
  v: string;  // interner Code
  l: string;  // Anzeigename
  /** Farb-Hex für die Darstellung der Rahmengruppe im 3D-Vorschau */
  hex: string;
}

export const FRAME_GROUPS: FrameGroup[] = [
  { v: 'RO',  l: 'Rollladen',       hex: '#7090b0' },
  { v: 'RA',  l: 'Raffstore',        hex: '#b08040' },
  { v: 'IS',  l: 'Insektenschutz',   hex: '#60a060' },
  { v: 'SS',  l: 'Sichtschutz',      hex: '#a06090' },
  { v: 'SO',  l: 'Sonnenschutz',     hex: '#c0a040' },
  { v: 'PL',  l: 'Plissee',          hex: '#7080a0' },
  { v: 'FP',  l: 'Flächenvorhang',   hex: '#8090c0' },
  { v: 'DU',  l: 'Duette',           hex: '#7088b8' },
];

export const FRAME_GROUP_BY_V: Record<string, FrameGroup> =
  Object.fromEntries(FRAME_GROUPS.map(g => [g.v, g]));

// ─── Zubehör / Komponenten ───────────────────────────────────────────────────

/** Fachboden 600×600 mm */
export const SHELF_ART_NR = '6964';

/** Wandhalterung */
export const WALL_MOUNT_ART_NR = '9200';

/** Kabelkanal / Stromzugangspunkt */
export const CABLE_DUCT_ART_NR = '9300';

// ─── Preisgruppen-Darstellung ─────────────────────────────────────────────────

/** Lightmodul hat zunächst eine einzige Preisgruppe (PG1) */
export const PG_DOT: Record<string, string> = {
  PG1: '#4a7a9b',
  '—': 'transparent',
};

// ─── Für Kompatibilität mit generischen Komponenten ──────────────────────────

/**
 * Dummy MATERIALS-Export, damit generische Komponenten (BOMPanel, Sidebar)
 * die Profilfarben als "Materialauswahl" behandeln können.
 */
export const MATERIALS: Material[] = PROFILE_COLORS;
export const MAT_BY_V: Record<string, Material> = PROFILE_COLOR_BY_V;

/** Kein Griff-System bei Lightmodul */
export const HANDLES: { v: string; l: string; lb: number | null }[] = [];
export const HANDLE_BY_V: Record<string, { v: string; l: string; lb: number | null }> = {};

/** Kein Kabeldurchlass-Bohrungssystem (anders als Artmodul) */
export const CABLE_HOLE_ART_NR = '';
