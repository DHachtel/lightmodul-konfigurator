/**
 * PBR-Oberflächentexturen — lädt statische Color/Normal/Roughness/Metalness-Maps.
 * Gecacht: wird nur einmal pro Oberflächentyp geladen.
 */
import * as THREE from 'three';

export interface PBRTextureMaps {
  colorMap: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  metalnessMap?: THREE.Texture;
}

// Legacy-Export für Abwärtskompatibilität
export type WoodTextureMaps = PBRTextureMaps;

type SurfaceType = 'zebrano' | 'nussbaum' | 'eiche' | 'alu';

interface SurfacePaths {
  color: string;
  normal: string;
  roughness: string;
  metalness?: string;
}

const SURFACE_PATHS: Record<SurfaceType, SurfacePaths> = {
  zebrano: {
    color:     '/textures/wood/zebrano_color.jpg',
    normal:    '/textures/wood/zebrano_normal.jpg',
    roughness: '/textures/wood/zebrano_roughness.jpg',
  },
  nussbaum: {
    color:     '/textures/wood/nussbaum_color.jpg',
    normal:    '/textures/wood/nussbaum_normal.jpg',
    roughness: '/textures/wood/nussbaum_roughness.jpg',
  },
  eiche: {
    color:     '/textures/wood/eiche_color.jpg',
    normal:    '/textures/wood/eiche_normal.jpg',
    roughness: '/textures/wood/eiche_roughness.jpg',
  },
  alu: {
    color:     '/textures/metal/alu_color.jpg',
    normal:    '/textures/metal/alu_normal.jpg',
    roughness: '/textures/metal/alu_roughness.jpg',
    metalness: '/textures/metal/alu_metalness.jpg',
  },
};

const loader = new THREE.TextureLoader();
const cache = new Map<string, PBRTextureMaps>();

function loadTex(path: string, srgb: boolean, repeatX = 1, repeatY = 2): THREE.Texture {
  const tex = loader.load(path);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

/**
 * Liefert gecachte PBR-Texturmaps für den gegebenen Oberflächentyp.
 * Gibt null zurück wenn `type` kein bekannter Typ ist.
 */
export function getWoodTexture(type: string): PBRTextureMaps | null {
  if (!(type in SURFACE_PATHS)) return null;

  const cached = cache.get(type);
  if (cached) return cached;

  const paths = SURFACE_PATHS[type as SurfaceType];
  const maps: PBRTextureMaps = {
    colorMap:     loadTex(paths.color, true),
    normalMap:    loadTex(paths.normal, false),
    roughnessMap: loadTex(paths.roughness, false),
    ...(paths.metalness ? { metalnessMap: loadTex(paths.metalness, false) } : {}),
  };
  cache.set(type, maps);
  return maps;
}

// ── MDF-Strukturtexturen (Normal + Roughness + AO) für Kunstharz-Farben ─────

export interface MDFTextureMaps {
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
  aoMap: THREE.Texture;
}

let mdfCache: MDFTextureMaps | null = null;

/**
 * Liefert gecachte MDF-Strukturmaps (Normal, Roughness, AO).
 * Wird für alle PG1-Kunstharz-Oberflächen verwendet — Farbe kommt separat.
 */
export function getMDFTexture(): MDFTextureMaps {
  if (mdfCache) return mdfCache;
  // TILING: repeat.set(2, 2) — ggf. anpassen nach erstem Test
  mdfCache = {
    normalMap:    loadTex('/textures/mdf_normal.png', false, 2, 2),
    roughnessMap: loadTex('/textures/mdf_roughness.png', false, 2, 2),
    aoMap:        loadTex('/textures/mdf_ao.png', false, 2, 2),
  };
  return mdfCache;
}
