'use client';

import { useEffect } from 'react';
import { useControls, button } from 'leva';
import { useThree } from '@react-three/fiber';
import { MATERIALS } from '@/core/constants';

// ── Defaults ────────────────────────────────────────────────────────────────

const MDF_DEFAULTS = { roughness: 0.88, normalScale: 0.08, aoMapIntensity: 0.3 };
const SCENE_DEFAULTS = { toneMappingExposure: 1.0, hemisphereIntensity: 0.5, directionalIntensity: 0.7 };

// Lack-Farben: Original-Hex aus MATERIALS als Default-Map
const LACK_MATERIALS = MATERIALS.filter(m => m.pg === 'PG1' && !m.textured && m.v !== 'none');
const LACK_DEFAULTS: Record<string, string> = {};
for (const m of LACK_MATERIALS) LACK_DEFAULTS[m.v] = m.hex;

export interface DebugMatValues {
  /** Farb-Overrides: materialKey (z.B. 'KHS') → hex */
  colorOverrides: Record<string, string>;
  mdf: typeof MDF_DEFAULTS;
  scene: typeof SCENE_DEFAULTS;
}

/**
 * Hook: registriert Leva-Controls und gibt die aktuellen Werte zurück.
 * Farben werden live am Möbel angewendet.
 */
export function useMaterialDebugControls(): DebugMatValues {
  // Farb-Picker pro Lack-Farbe — Schema dynamisch aus MATERIALS
  const colorSchema: Record<string, unknown> = {};
  for (const m of LACK_MATERIALS) {
    colorSchema[`${m.l} (${m.v})`] = m.hex;
  }
  const colorValues = useControls('Lack-Farben', colorSchema);

  // Farb-Map zurückbauen: "Schwarz (KHS)" → KHS → neuer Hex
  const colorOverrides: Record<string, string> = {};
  for (const m of LACK_MATERIALS) {
    const key = `${m.l} (${m.v})`;
    const val = colorValues[key as keyof typeof colorValues] as string;
    if (val && val !== m.hex) {
      colorOverrides[m.v] = val;
    }
  }

  const mdfValues = useControls('MDF (Kunstharz)', {
    roughness: { value: MDF_DEFAULTS.roughness, min: 0, max: 1, step: 0.01 },
    normalScale: { value: MDF_DEFAULTS.normalScale, min: 0, max: 0.5, step: 0.01 },
    aoMapIntensity: { value: MDF_DEFAULTS.aoMapIntensity, min: 0, max: 1, step: 0.05 },
  });

  const sceneValues = useControls('Szene', {
    toneMappingExposure: { value: SCENE_DEFAULTS.toneMappingExposure, min: 0, max: 3, step: 0.1 },
    hemisphereIntensity: { value: SCENE_DEFAULTS.hemisphereIntensity, min: 0, max: 2, step: 0.05 },
    directionalIntensity: { value: SCENE_DEFAULTS.directionalIntensity, min: 0, max: 2, step: 0.05 },
  });

  useControls('Export', {
    'Log JSON': button(() => {
      const output = {
        farbOverrides: colorOverrides,
        mdf: mdfValues,
        scene: sceneValues,
        hinweis: 'Nur abweichende Farben werden geloggt. Defaults bleiben in MATERIALS.',
      };
      console.log('%c🎨 Material-Kalibrierung', 'font-size:14px;font-weight:bold', '\n' + JSON.stringify(output, null, 2));
    }),
  });

  return { colorOverrides, mdf: mdfValues, scene: sceneValues };
}

/**
 * Komponente: wendet toneMappingExposure auf den WebGL-Renderer an.
 * Muss innerhalb <Canvas> gerendert werden.
 */
export function SceneDebugApplicator({ debug }: { debug: DebugMatValues }) {
  const gl = useThree(s => s.gl);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    gl.toneMappingExposure = debug.scene.toneMappingExposure;
  }, [gl, debug.scene.toneMappingExposure]);
  return null;
}
