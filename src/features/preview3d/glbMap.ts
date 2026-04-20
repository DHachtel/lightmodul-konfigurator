/**
 * Statisches Mapping: Handle-Value (aus HANDLES[].v) → GLB-Dateipfad.
 * Wird von SmartMesh genutzt, um echte 3D-Modelle statt BoxGeometry zu laden.
 *
 * Konvention: Dateinamen in /public/models/ — Kleinbuchstaben, Umlaute ersetzt.
 * Handles ohne GLB (push, none, allungo) fallen automatisch auf BoxGeometry zurück.
 */

export const HANDLE_GLB_MAP: Record<string, string> = {
  luno:         '/models/griff_luno.glb',
  linea:        '/models/griff_linea.glb',
  rondo:        '/models/griff_rondo.glb',
  axio:         '/models/griff_axio.glb',
  axio_gross:   '/models/griff_axio_gross.glb',
  retrox:       '/models/griff_retrox.glb',
  reling:       '/models/griff_reling_klein.glb',
  reling_gross: '/models/griff_reling_gross.glb',
  uno:          '/models/griff_uno.glb',
  ombra:        '/models/griff_ombra.glb',
  solano:       '/models/griff_salone.glb',
  arcano:       '/models/griff_arcano.glb',
  bridge:       '/models/griff_bridge_klein.glb',
  bridge_gross: '/models/griff_bridge_gross.glb',
};

/** Zusätzliche Struktur-GLBs für spätere Integration */
export const STRUCTURE_GLB_MAP: Record<string, string> = {
  wuerfel:          '/models/wuerfel.glb',
  profil:           '/models/profil.glb',
  stellfuss:        '/models/profil.glb',           // Stellfuß = vertikales Profil (50mm)
  nivellierschraube: '/models/Nivellierschraube_30mm.glb',
  rolle:            '/models/rolle_60mm_perfekt.glb',
};
