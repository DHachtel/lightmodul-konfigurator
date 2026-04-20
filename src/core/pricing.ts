// ── Preissystem-Typen ─────────────────────────────────────────────────────────
// Geteilt zwischen API-Route (Server) und BOMPanel (Client).
// KEIN Import von Server-Only-Modulen in dieser Datei.

export interface PriceLineItem {
  art_nr: string;
  bezeichnung: string;
  kategorie: string;
  qty: number;
  unit_price: number;
  total_price: number;
  /** BOM-Dimensionsschlüssel zur Zuordnung in BOMPanel (z.B. "420" für Profil-Länge, "420×360" für Platten) */
  dim_key?: string;
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
