'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { computeModuleGeometry } from '@/features/preview3d/useModuleGeometry';
import type { SceneObject } from '@/features/preview3d/useModuleGeometry';
import type { ConfigState } from '@/core/types';
import { MAT_BY_V } from '@/core/constants';

// ── Zustandstypen ────────────────────────────────────────────────────────────
type ViewerState = 'loading' | 'building' | 'ready' | 'error';

// ── sRGB-Hex zu linearer Farbe (Three.js erwartet linear) ────────────────────
function hexToLinearColor(hex: string): THREE.Color {
  const color = new THREE.Color(hex);
  // convertSRGBToLinear ist deprecated in neueren Three.js —
  // stattdessen ColorManagement nutzen oder manuell konvertieren
  color.r = Math.pow(color.r, 2.2);
  color.g = Math.pow(color.g, 2.2);
  color.b = Math.pow(color.b, 2.2);
  return color;
}

// ── GLB-Loader: einzelne Datei laden ─────────────────────────────────────────
async function loadGLB(loader: GLTFLoader, url: string): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    // Absolute URL noetig fuer AR-Seite (nicht relativ)
    const absUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
    loader.load(absUrl, (gltf: { scene: THREE.Group }) => resolve(gltf.scene), undefined, reject);
  });
}

// ── GLB-Modell auf Zielgroesse skalieren (analog SmartMesh) ──────────────────
function fitModelToSize(
  model: THREE.Group,
  targetSize: [number, number, number],
  preRotation?: [number, number, number],
  nonUniform?: boolean,
): THREE.Group {
  const clone = model.clone(true);
  if (preRotation) clone.rotation.set(...preRotation);

  const box = new THREE.Box3().setFromObject(clone);
  const modelSize = new THREE.Vector3();
  box.getSize(modelSize);

  const sx = modelSize.x > 0 ? targetSize[0] / modelSize.x : 1;
  const sy = modelSize.y > 0 ? targetSize[1] / modelSize.y : 1;
  const sz = modelSize.z > 0 ? targetSize[2] / modelSize.z : 1;

  const scale: [number, number, number] = nonUniform
    ? [sx, sy, sz]
    : (() => { const u = Math.min(sx, sy, sz); return [u, u, u] as [number, number, number]; })();

  const center = new THREE.Vector3();
  box.getCenter(center);

  const wrapper = new THREE.Group();
  const scaleGroup = new THREE.Group();
  scaleGroup.scale.set(...scale);

  const centerGroup = new THREE.Group();
  centerGroup.position.set(-center.x, -center.y, -center.z);
  centerGroup.add(clone);
  scaleGroup.add(centerGroup);
  wrapper.add(scaleGroup);

  return wrapper;
}

// ── Material auf alle Meshes in einer Gruppe anwenden ────────────────────────
function applyMaterial(
  group: THREE.Group,
  color: THREE.Color,
  metalness: number,
  roughness: number,
): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.material = new THREE.MeshStandardMaterial({
        color,
        metalness,
        roughness,
      });
    }
  });
}

// Lightmodul hat keine individuellen Farb-Overrides — immer obj.color verwenden
function resolveColor(obj: SceneObject, _config: ConfigState): string {
  return obj.color;
}

// ── Neutrale HDR-Environment-Map fuer metallische Reflexionen ─────────────────
function createStudioEnvironment(): THREE.Texture {
  const size = 256;
  const data = new Float32Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const ny = y / size;              // 0 = unten, 1 = oben
      const nx = x / size;

      // Vertikaler Gradient: warm unten (Boden), hell oben (Himmel)
      const base = 0.15 + ny * 0.6;

      // Horizontale Lichtstreifen fuer Reflexionskonturen
      const stripe1 = Math.exp(-Math.pow((nx - 0.3) * 8, 2)) * 0.5;
      const stripe2 = Math.exp(-Math.pow((nx - 0.7) * 8, 2)) * 0.4;

      // Helle Decke oben
      const ceiling = ny > 0.85 ? (ny - 0.85) * 6.0 : 0;

      const r = base + stripe1 + stripe2 + ceiling;
      const g = base + stripe1 * 0.9 + stripe2 * 0.9 + ceiling;
      const b = base + stripe1 * 0.85 + stripe2 * 0.85 + ceiling * 0.9;

      data[i]     = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 1;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

// ── Szene aus SceneObjects bauen (async wegen GLB-Laden) ─────────────────────
async function buildSceneAsync(objects: SceneObject[], config: ConfigState): Promise<THREE.Scene> {
  const scene = new THREE.Scene();

  // Environment-Map fuer realistische Metallreflexionen
  const envMap = createStudioEnvironment();
  scene.environment = envMap;

  // Beleuchtung: Hauptlicht + Fuelllicht + Kantenlicht
  scene.add(new THREE.AmbientLight(0xffffff, 0.4));
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  // Fuelllicht von links-unten fuer weichere Schatten
  const fillLight = new THREE.DirectionalLight(0xd4cfca, 0.4);
  fillLight.position.set(-4, 2, -3);
  scene.add(fillLight);

  // Kantenlicht von hinten fuer Konturen
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
  rimLight.position.set(0, 5, -8);
  scene.add(rimLight);

  const loader = new GLTFLoader();
  const glbCache = new Map<string, THREE.Group>();

  // Alle benoetigten GLBs parallel vorladen
  const uniqueGlbPaths = [...new Set(objects.filter(o => o.glbFile).map(o => o.glbFile!))];
  await Promise.all(uniqueGlbPaths.map(async (path) => {
    try {
      const model = await loadGLB(loader, path);
      glbCache.set(path, model);
    } catch (err) {
      console.warn(`[AR] GLB nicht geladen: ${path}`, err);
    }
  }));

  // Skalierung: Three.js-Einheiten → Meter fuer model-viewer
  const wrapper = new THREE.Group();
  wrapper.scale.setScalar(0.1);

  for (const obj of objects) {
    // Profil-/Metall-Teile: Chrome-Look; Platten: seidenmatt
    const isMetallic = ['profil', 'eckverbinder', 'handle', 'stellfuss', 'rolle'].includes(obj.partType);
    const resolvedHex = resolveColor(obj, config);
    // Chrome-Teile: leicht abgedunkelte Farbe damit Reflexionen sichtbar werden
    const color = isMetallic
      ? hexToLinearColor(resolvedHex).multiplyScalar(0.7)
      : hexToLinearColor(resolvedHex);
    const metalness = obj.metalness ?? (isMetallic ? 0.95 : 0.0);
    const roughness = obj.roughness ?? (isMetallic ? 0.12 : 0.72);

    const makeMaterial = () => new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      envMap,
      envMapIntensity: isMetallic ? 1.5 : 0.3,
    });

    if (obj.glbFile && glbCache.has(obj.glbFile)) {
      // Echtes GLB-Modell verwenden
      const model = glbCache.get(obj.glbFile)!.clone(true);
      const fitted = fitModelToSize(model, obj.size, obj.preRotation, obj.nonUniformScale);
      fitted.position.set(...obj.position);
      if (obj.rotation) fitted.rotation.set(...obj.rotation);
      // Material direkt zuweisen statt applyMaterial (nutzt envMap)
      fitted.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = makeMaterial();
        }
      });
      wrapper.add(fitted);
    } else {
      // BoxGeometry Fallback (Platten, Fronten, fehlende GLBs)
      const geometry = new THREE.BoxGeometry(...obj.size);
      const mesh = new THREE.Mesh(geometry, makeMaterial());
      mesh.position.set(...obj.position);
      if (obj.rotation) mesh.rotation.set(...obj.rotation);
      wrapper.add(mesh);
    }
  }

  scene.add(wrapper);
  return scene;
}

// ── GLB-Export ────────────────────────────────────────────────────────────────
async function exportToGLB(scene: THREE.Scene): Promise<Blob> {
  const exporter = new GLTFExporter();

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result: ArrayBuffer | object) => {
        if (result instanceof ArrayBuffer) {
          resolve(new Blob([result], { type: 'model/gltf-binary' }));
        } else {
          const json = JSON.stringify(result);
          resolve(new Blob([json], { type: 'model/gltf+json' }));
        }
      },
      (error: unknown) => reject(error),
      { binary: true },
    );
  });
}

// ── Hauptkomponente ──────────────────────────────────────────────────────────
export default function ARViewer() {
  const searchParams = useSearchParams();
  const configCode = searchParams.get('config');

  const [state, setState] = useState<ViewerState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  // Aufraumen: Blob-URL freigeben bei Unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  // Konfiguration laden und GLB erzeugen
  const buildGLB = useCallback(async (code: string) => {
    try {
      setState('loading');

      // Konfiguration vom Server laden
      const res = await fetch(`/api/config/load?code=${encodeURIComponent(code)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data: { config: ConfigState } = await res.json();
      const config = data.config;

      setState('building');

      // 3D-Geometrie berechnen (pure Funktion, kein Hook)
      const sceneObjects = computeModuleGeometry(config);

      if (sceneObjects.length === 0) {
        throw new Error('Keine Moebelelemente in der Konfiguration gefunden.');
      }

      // Three.js-Szene bauen (laedt GLB-Modelle) und als GLB exportieren
      const scene = await buildSceneAsync(sceneObjects, config);
      const blob = await exportToGLB(scene);

      // Alte Blob-URL freigeben
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }

      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setGlbUrl(url);
      setState('ready');

      // Szene aufraeumen (WebGL-Ressourcen freigeben)
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          if (Array.isArray(node.material)) {
            node.material.forEach((m: THREE.Material) => m.dispose());
          } else {
            node.material.dispose();
          }
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setErrorMsg(msg);
      setState('error');
    }
  }, []);

  useEffect(() => {
    if (!configCode) {
      setErrorMsg('Kein Konfigurationscode angegeben. Bitte ?config=XXXXXXXX in der URL verwenden.');
      setState('error');
      return;
    }
    void buildGLB(configCode);
  }, [configCode, buildGLB]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Fehlerzustand
  if (state === 'error') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>!</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1A17', marginBottom: 8 }}>
            Fehler
          </div>
          <div style={{ fontSize: 13, color: '#7A7670', lineHeight: 1.5 }}>
            {errorMsg}
          </div>
          <Link href="/" style={linkStyle}>
            Zum Konfigurator
          </Link>
        </div>
      </div>
    );
  }

  // Lade- / Build-Zustand
  if (state === 'loading' || state === 'building') {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1A17', marginBottom: 8 }}>
            Lightmodul AR
          </div>
          <div style={{ fontSize: 13, color: '#7A7670' }}>
            {state === 'loading' ? 'Lade Konfiguration…' : '3D-Modell wird erstellt…'}
          </div>
        </div>
      </div>
    );
  }

  // Bereit: model-viewer anzeigen
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#F5F2ED' }}>
      {/* model-viewer CDN laden */}
      <Script
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
        type="module"
        onReady={() => setScriptReady(true)}
      />

      {/* Header-Overlay */}
      <div style={headerStyle}>
        <Link href="/" style={{ textDecoration: 'none', color: '#1C1A17' }}>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.03em' }}>
            LIGHTMODUL
          </span>
        </Link>
        <span style={{ fontSize: 12, color: '#7A7670' }}>AR-Vorschau</span>
      </div>

      {/* model-viewer — wird erst nach Script-Load gerendert */}
      {glbUrl && scriptReady && (
        <model-viewer
          src={glbUrl}
          ar
          ar-modes="webxr scene-viewer quick-look"
          camera-controls
          auto-rotate
          shadow-intensity="1"
          environment-image="neutral"
          exposure="1.1"
          touch-action="pan-y"
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#F5F2ED',
          }}
        >
          {/* Benutzerdefinierter AR-Button */}
          <button
            slot="ar-button"
            style={arButtonStyle}
          >
            In AR ansehen
          </button>
        </model-viewer>
      )}

      {/* Fallback waehrend model-viewer laedt */}
      {glbUrl && !scriptReady && (
        <div style={{ ...containerStyle, position: 'absolute', top: 0, left: 0 }}>
          <div style={{ fontSize: 13, color: '#7A7670' }}>AR-Viewer wird geladen…</div>
        </div>
      )}
    </div>
  );
}

// ── Styles (Inline, da nur diese Seite sie nutzt) ────────────────────────────

const containerStyle: React.CSSProperties = {
  width: '100vw',
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#F5F2ED',
  fontFamily: '-apple-system, BlinkMacSystemFont, Arial, sans-serif',
};

const cardStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '32px 24px',
};

const linkStyle: React.CSSProperties = {
  display: 'inline-block',
  marginTop: 20,
  fontSize: 13,
  color: '#1C1A17',
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
};

const headerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  background: 'rgba(245, 242, 237, 0.85)',
  backdropFilter: 'blur(8px)',
};

const arButtonStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 24,
  left: '50%',
  transform: 'translateX(-50%)',
  padding: '12px 28px',
  fontSize: 14,
  fontWeight: 600,
  color: '#fff',
  background: '#1C1A17',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
