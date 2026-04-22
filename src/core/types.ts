// ─── Cell ────────────────────────────────────────────────────────────────────

/**
 * Lightmodul-Zelltypen:
 *   '' = leer (kein Gerüstelement)
 *   'O' = offenes Gerüstfeld (kein Einlegerahmen)
 *   'RF' = Einlegerahmen Standard
 *   'RL' = Einlegerahmen beleuchtet
 */
export type CellType = '' | 'O' | 'RF' | 'RL' | 'BT';

export interface Cell {
  type: CellType;
  /** Anzahl Fachböden in dieser Zelle (0–2) */
  shelves: number;
}

/**
 * Lightmodul-Grid ist dreidimensional:
 *   grid[row][col][depth]
 *
 * row   = Zeile (0 = oben)
 *   col   = Spalte (0 = links)
 *   depth = Tiefenebene (0 = vorne)
 */
export type Grid = Cell[][][];

// ─── Config ──────────────────────────────────────────────────────────────────

export interface ConfigOpts {
  /** Stellfüße einberechnen */
  footer: boolean;
  /** Fachböden global aktiviert (kann pro Zelle übersteuert werden) */
  shelves: boolean;
}

/**
 * Hauptzustand des Lightmodul-Konfigurators.
 * Wird als JSON in Supabase gespeichert.
 *
 * Das Rastermaß ist immer 600×600×600 mm (fix).
 * Die Anzahl der Elemente pro Achse ist variabel.
 */
export interface ConfigState {
  /** Anzahl Elemente in Breite (jedes = 600mm) — gespeichert als Array für Kompatibilität */
  cols: number[];      // immer [600, 600, …], Länge = Anzahl Spalten
  /** Anzahl Elemente in Höhe (jedes = 600mm) */
  rows: number[];      // immer [600, 600, …], Länge = Anzahl Zeilen
  /** Anzahl Tiefenebenen (Elemente in Z-Richtung) */
  depthLayers: number;
  /** 3D-Grid: grid[row][col][depth] */
  grid: Grid;
  /** Profilfarbe: PROFILE_COLORS[].v ('SW' oder 'WS') */
  profileColor: string;
  /** Fußtyp-Code: FOOTERS[].v */
  footer: string;
  opts: ConfigOpts;
  /** Produktrahmen-Zuordnung: faceId → true (bestueckt) */
  frames: Record<string, boolean>;
}

// ─── Preissystem ─────────────────────────────────────────────────────────────

export interface PriceLineItem {
  art_nr: string;
  bezeichnung: string;
  kategorie: string;
  qty: number;
  unit_price: number;
  total_price: number;
  dim_key?: string;
  pg?: string;
}

export interface PriceResponse {
  items: PriceLineItem[];
  subtotals: Record<string, number>;
  grand_total: number;
  currency: 'EUR' | 'CHF';
  price_type: 'UVP' | 'EK';
  active_discount_pct?: number;
  missing_items: string[];
}

// ─── Materials / Handles / Footers ───────────────────────────────────────────

export interface Material {
  v: string;
  l: string;
  pg: string;
  hex: string;
  border: string;
  textured: boolean;
  grad?: string;
}

export interface CellTypeOption {
  v: CellType;
  l: string;
}

export interface Footer {
  v: string;
  l: string;
  art_nr: string;
}

// ─── BOM ─────────────────────────────────────────────────────────────────────

/** Positionsbewusste Board-ID → Metadaten */
export interface BoardEntry {
  kategorie: string;
  isFront: boolean;
}

/**
 * Ergebnis von computeBOM() für das Lightmodul-System.
 * null wenn keine Zellen aktiv.
 */
export interface BOMResult {
  // ── Alu-Würfel ─────────────────────────────────────────────────────────────
  wuerfel: number;

  // ── Profile (Stückzahlen) ─────────────────────────────────────────────────
  /** Horizontale Profile (Breite) */
  profileX: number;
  /** Vertikale Profile (Höhe) */
  profileY: number;
  /** Tiefenprofile (Z-Richtung) */
  profileZ: number;
  /** Gesamt Profile */
  profileTotal: number;

  // ── Einlegerahmen ─────────────────────────────────────────────────────────
  /** Standard-Einlegerahmen (Typ RF) */
  framesStd: number;
  /** Beleuchtete Einlegerahmen (Typ RL) */
  framesLit: number;
  /** Gesamt Einlegerahmen */
  framesTotal: number;

  // ── Fachböden ─────────────────────────────────────────────────────────────
  shelves: number;

  // ── Beratungstisch ───────────────────────────────────────────────────────
  /** Anzahl 360mm-Vertikalprofile (Erhoehung) */
  profil360: number;
  /** Anzahl 213mm-Vertikalprofile (Regalanschluss) */
  profil213: number;
  /** Anzahl Beratungstisch-Arbeitsplatten (= Fachboden auf Worktop-Rahmen) */
  fachbodenBT: number;
  /** Anzahl Zwischenwuerfel am Worktop-Niveau */
  wuerfelBT: number;
  /** Horizontale Worktop-Profile (600mm, X-Richtung am BT-Niveau) */
  worktopProfileX: number;
  /** Horizontale Worktop-Profile (600mm, Z-Richtung am BT-Niveau) */
  worktopProfileZ: number;

  // ── Produktrahmen ────────────────────────────────────────────────────────
  /** Anzahl platzierter Produktrahmen */
  produktrahmen: number;

  // ── Stellfüße ─────────────────────────────────────────────────────────────
  footerQty: number;
  footer: string;

  // ── Hardware (Verbindungsmittel) ───────────────────────────────────────────
  /** Senkschrauben M4×8 für Würfel-Adapter */
  schraubenM4: number;
  /** Zylinderschrauben M6×40 für Verbindungen */
  schraubenM6: number;
  /** U-Scheiben D6,4 */
  scheiben: number;
  /** Einlegemuttern für Würfel-Adapter */
  einlegemuttern: number;

  // ── Aktive Bounding-Box ────────────────────────────────────────────────────
  /** Anzahl aktive Spalten */
  numCols: number;
  /** Anzahl aktive Zeilen */
  numRows: number;
  /** Anzahl Tiefenebenen */
  numDepth: number;
  /** Gesamtbreite mm */
  totalWidth: number;
  /** Gesamthöhe mm */
  totalHeight: number;
  /** Gesamttiefe mm */
  totalDepth: number;

  // ── Positionsbewusste Board-IDs ────────────────────────────────────────────
  boardMap: Record<string, BoardEntry>;

  // ── Validierungswarnungen ─────────────────────────────────────────────────
  warnings: string[];
}
