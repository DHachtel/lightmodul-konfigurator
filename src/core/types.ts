// ─── Cell ────────────────────────────────────────────────────────────────────

/**
 * Lightmodul-Zelltypen:
 *   '' = leer (kein Gerüstelement)
 *   'O' = offenes Gerüstfeld (kein Einlegerahmen)
 *   'RF' = Einlegerahmen Standard
 *   'RL' = Einlegerahmen beleuchtet
 */
export type CellType = '' | 'O' | 'RF' | 'RL';

export interface Cell {
  type: CellType;
  /** Produktgruppen-Code des Einlegerahmens (FRAME_GROUPS[].v), z.B. 'RO', 'IS' */
  frameGroup: string;
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
  /** Rückwand (hintere Tiefenebene) */
  backWall: boolean;
  // Kompatibilität mit Artmodul-Feldern (für generische Komponenten)
  outer: boolean;
  inner: boolean;
  back: boolean;
}

/** Individuelles Bauteil-Override (Session-only) */
export interface BomOverride {
  material: string;  // Profilfarbe: PROFILE_COLORS[].v
  color: string;     // Anzeigename
  kabel?: boolean;   // Kabeldurchlass (für zukünftige Erweiterung)
}

/** Kategorie-Level Override */
export interface BomCatOverride {
  anzahl: number;
  oberflaeche: string;
  kabel?: boolean;
  [key: string]: unknown;
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
  bomOverrides: Record<string, BomOverride>;
  cableHoles: Record<string, boolean>;
  catOverrides: Record<string, BomCatOverride>;
  /** Individuelle Bauteilfarben (visuell, kein BOM-Einfluss) */
  partColors: Record<string, string>;
  /** Element-Farben pro Zelle "r_c_d" → hex */
  cellColors: Record<string, string>;

  // ── Kompatibilitätsfelder für generische Komponenten ──────────────────────
  /** Alias für profileColor — generische Sidebar erwartet 'surface' */
  surface: string;
  /** Kein Griff bei Lightmodul — Leerstring */
  handle: string;
  /** Einzelne Tiefe in mm (immer 600 * depthLayers) — für Kompatibilität */
  depth: number;
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

/** Kein Griffsystem bei Lightmodul — Interface bleibt für generische Komponentenkompatibilität */
export interface Handle {
  v: string;
  l: string;
  lb: number | null;
}

export interface Footer {
  v: string;
  l: string;
  art_nr: string;
}

// ─── BOM ─────────────────────────────────────────────────────────────────────

/** Maps a dimension string (z.B. "600") to a quantity */
export type DimMap = Record<string, number>;

/** Positionsbewusste Board-ID → Metadaten */
export type BoardMap = Record<string, { kategorie: string; isFront: boolean }>;

/**
 * Ergebnis von computeBOM() für das Lightmodul-System.
 * null wenn keine Zellen aktiv.
 */
export interface BOMResult {
  // ── Alu-Würfel ─────────────────────────────────────────────────────────────
  wuerfel: number;

  // ── Profile (Längen-Keys in mm) ────────────────────────────────────────────
  /** Horizontale Profile (Breite) — key immer '600' */
  pB: DimMap;
  /** Vertikale Profile (Höhe) — key immer '600' */
  pH: DimMap;
  /** Tiefenprofile (Z-Richtung) — key immer '600' */
  pT: DimMap;
  pBt: number;
  pHt: number;
  pTt: number;
  pGes: number;

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

  // ── Einlegerahmen ─────────────────────────────────────────────────────────
  /** Standard-Einlegerahmen pro Produktgruppe — key: FRAME_GROUPS[].v */
  framesStd: Record<string, number>;
  framesStdTotal: number;
  /** Beleuchtete Einlegerahmen pro Produktgruppe */
  framesLit: Record<string, number>;
  framesLitTotal: number;
  framesGes: number;

  // ── Fachböden ─────────────────────────────────────────────────────────────
  fbMap: DimMap;
  fbT: number;

  // ── Stellfüße ─────────────────────────────────────────────────────────────
  footerQty: number;
  footer: string;
  footerObj: Footer | Record<string, never>;

  // ── Hardware (Verbindungsmittel) ───────────────────────────────────────────
  /** Senkschrauben M4×8 für Würfel-Adapter */
  schraubenM4: number;
  /** Zylinderschrauben M6×40 für Verbindungen */
  schraubenM6: number;
  /** U-Scheiben D6,4 */
  scheiben: number;
  /** Einlegemuttern für Würfel-Adapter */
  einlegemuttern: number;
  beschlGes: number;

  // ── Profil-Stoppfen ────────────────────────────────────────────────────────
  stoppfen: number;

  // ── Positionsbewusste Board-IDs ────────────────────────────────────────────
  boardMap: BoardMap;

  // ── Kategorie-Overrides (durchgereicht) ───────────────────────────────────
  catOverrides: Record<string, BomCatOverride>;
  partColors: Record<string, string>;
  colorSplits: Record<string, number>;

  // ── Validierungswarnungen ─────────────────────────────────────────────────
  warns: string[];

  // ── Kompatibilitätsfelder für generische Artmodul-Komponenten ────────────
  /** Alias für framesGes (generische BOMPanel erwartet frontGes) */
  frontGes: number;
  cableHolesQty: number;
  bomKabelQty: number;
  handle: string;
  handleObj: Handle | Record<string, never>;
  D: number;
  activeCols: number[];
  activeRows: number[];
  Bact: number;
  Hact: number;
  // Artmodul-spezifische Felder werden leer gehalten
  bStd: DimMap;
  bKl: DimMap;
  bStdT: number;
  bKlT: number;
  rMap: DimMap;
  rT: number;
  sAMap: DimMap;
  sAT: number;
  sAMapSY32: DimMap;
  sATsy: number;
  sIMap: DimMap;
  sIT: number;
  sIMapSY32: DimMap;
  sITsy: number;
  plattenGes: number;
  fMap: Record<string, DimMap>;
  nK: number;
  nS: number;
  nTR: number;
  nTL: number;
  nDT: number;
  totalSch: number;
  bolzen: number;
  klemm: number;
  scharn: number;
  kHalt: number;
  kDaem: number;
  schubF: number;
}
