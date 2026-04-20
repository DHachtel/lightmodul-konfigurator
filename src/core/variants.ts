/**
 * Board-Varianten für Lightmodul.
 * Artmodul hatte komplexe Oberflächen-Splits pro Platte.
 * Lightmodul hat nur Profilfarbe (schwarz/weiß) — keine Varianten nötig.
 * Diese Datei existiert für API-Kompatibilität.
 */

import type { ConfigState } from './types';

export interface BoardVariant {
  kategorie: string;
  dim:       string;
  surface:   string;
  pg:        string;
  qty:       number;
  kabel:     boolean;
  // Kompatibilitätsfelder für BOMPanel, exportXLS, API
  label:       string;
  surfaceLabel: string;
  surfaceCode: string;
  hasCable:    boolean;
}

/**
 * computeBoardVariants — gibt für Lightmodul eine leere Liste zurück.
 * Die Stückliste wird direkt über computeBOM() berechnet.
 */
export function computeBoardVariants(_config: ConfigState): BoardVariant[] {
  return [];
}
