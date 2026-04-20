// TODO: Preview3D muss für Lightmodul 3D-Grid angepasst werden
'use client';

import { useMemo, useEffect, useRef, useCallback, useImperativeHandle, forwardRef, Suspense, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, CameraControls, Edges, Html } from '@react-three/drei';
import type CameraControlsImpl from 'camera-controls';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// THREE.Shape/Path/ExtrudeGeometry existieren zur Laufzeit, aber @types/three
// exportiert sie nicht direkt. Zugriff über runtime-Cast:
const ShapeCtor = (THREE as Record<string, unknown>).Shape as new () => {
  moveTo(x: number, y: number): void; lineTo(x: number, y: number): void;
  quadraticCurveTo(cpX: number, cpY: number, x: number, y: number): void;
  closePath(): void; holes: InstanceType<typeof PathCtor>[];
};
const PathCtor = (THREE as Record<string, unknown>).Path as new () => {
  moveTo(x: number, y: number): void; lineTo(x: number, y: number): void; closePath(): void;
};
const ExtrudeGeometryCtor = (THREE as Record<string, unknown>).ExtrudeGeometry as
  new (shape: unknown, options: { depth: number; bevelEnabled: boolean }) => THREE.BufferGeometry;
import type { ConfigState } from '@/core/types';
import { ELEMENT_SIZE_MM, MAT_BY_V, MATERIALS, MAX_COLS, MAX_ROWS, MAX_DEPTH } from '@/core/constants';
import { useModuleGeometry, type SceneObject } from './useModuleGeometry';
import SmartMesh from './SmartMesh';
import RemoveButton from './RemoveButton';

import ColumnRowLabels from './ColumnRowLabels';
import { getWoodTexture, getMDFTexture } from './useWoodTexture';
import DimensionOverlay from './DimensionOverlay';
import { Leva } from 'leva';
import { useMaterialDebugControls, SceneDebugApplicator, type DebugMatValues } from './MaterialDebugPanel';

const S = 0.01; // 1mm = 0.01 Three.js-Einheiten (identisch zu useModuleGeometry)

// ── Aktive Bounding Box — analog zu useModuleGeometry ────────────────────────

function getActiveBounds(state: ConfigState) {
  const numRows = state.rows.length, numCols = state.cols.length;
  let minR = numRows, maxR = -1, minC = numCols, maxC = -1;
  for (let r = 0; r < numRows; r++)
    for (let c = 0; c < numCols; c++)
      if (state.grid[r]?.[c]?.some(cell => cell.type !== '')) {
        if (r < minR) minR = r; if (r > maxR) maxR = r;
        if (c < minC) minC = c; if (c > maxC) maxC = c;
      }
  if (maxR < 0) { minR = 0; maxR = numRows - 1; minC = 0; maxC = numCols - 1; }

  const xOff   = state.cols.slice(0, minC).reduce((a, b) => a + b, 0);
  const yOff   = state.rows.slice(maxR + 1).reduce((a, b) => a + b, 0);
  const wAct   = state.cols.slice(minC, maxC + 1).reduce((a, b) => a + b, 0);
  const hAct   = state.rows.slice(minR, maxR + 1).reduce((a, b) => a + b, 0);
  return { xOff, yOff, wAct, hAct };
}

// ── RoomEnvironment — IBL für MeshStandardMaterial-Reflexionen ───────────────

function SceneEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const envTexture = pmrem.fromScene(new RoomEnvironment()).texture;
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = envTexture;
    return () => {
      envTexture.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

// ── CameraAutoFrame — fitToBox nach Möbel-Größenänderung ─────────────────────

function CameraAutoFrame({
  ccRef,
  minX, minY, minZ, maxX, maxY, maxZ,
}: {
  ccRef: React.MutableRefObject<CameraControlsImpl | null>;
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
}) {
  const firstRun = useRef(true);
  useEffect(() => {
    const cc = ccRef.current;
    if (!cc) return;
    const box = new THREE.Box3(
      new THREE.Vector3(minX, minY, minZ),
      new THREE.Vector3(maxX, maxY, maxZ),
    );
    // Erste Ausführung: sofort (keine Animation), danach sanfter Übergang
    // paddingLeft/Right/Top/Bottom für Abstand zum Rand (in Three.js-Einheiten)
    const pad = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * 0.6;
    cc.fitToBox(box, !firstRun.current, { paddingLeft: pad, paddingRight: pad, paddingTop: pad, paddingBottom: pad });
    firstRun.current = false;
  }, [ccRef, minX, minY, minZ, maxX, maxY, maxZ]);
  return null;
}

// ── SelectionHighlight — grüner Rahmen um das selektierte Modul ─────────────

function SelectionHighlight({
  objects,
  row,
  col,
}: {
  objects: SceneObject[];
  row: number;
  col: number;
}) {
  const box = useMemo(() => {
    const matched = objects.filter(o => o.row === row && o.col === col);
    if (matched.length === 0) return null;
    const b = new THREE.Box3();
    for (const obj of matched) {
      const halfW = obj.size[0] / 2, halfH = obj.size[1] / 2, halfD = obj.size[2] / 2;
      b.expandByPoint(new THREE.Vector3(obj.position[0] - halfW, obj.position[1] - halfH, obj.position[2] - halfD));
      b.expandByPoint(new THREE.Vector3(obj.position[0] + halfW, obj.position[1] + halfH, obj.position[2] + halfD));
    }
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    b.getSize(size);
    b.getCenter(center);
    return { size: [size.x, size.y, size.z] as [number, number, number], center };
  }, [objects, row, col]);

  if (!box) return null;

  return (
    <mesh position={[box.center.x, box.center.y, box.center.z]}>
      <boxGeometry args={box.size} />
      <meshBasicMaterial visible={false} />
      <Edges color="#4ade80" linewidth={2} />
    </mesh>
  );
}

// ── PlateHighlight — grüner Rahmen um eine einzeln selektierte Platte ────────

function PlateHighlight({
  objects,
  plateId,
}: {
  objects: SceneObject[];
  plateId: string;
}) {
  const obj = useMemo(
    () => objects.find(o => o.id === plateId),
    [objects, plateId],
  );
  if (!obj) return null;

  return (
    <mesh position={obj.position}>
      <boxGeometry args={obj.size} />
      <meshBasicMaterial visible={false} />
      <Edges color="#4ade80" linewidth={2} />
    </mesh>
  );
}

// ── PhantomElement — Ghost-Box für Grid-Erweiterung ──────────────────────────

function PhantomElement({ position, size, onClick }: {
  position: [number, number, number];
  size: [number, number, number];
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={position}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = ''; }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <boxGeometry args={size} />
        <meshBasicMaterial
          color="#888888"
          transparent
          opacity={hovered ? 0.15 : 0.0}
          depthWrite={false}
        />
      </mesh>
      {/* Wireframe edges — always visible but very subtle */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
        <lineBasicMaterial color={hovered ? '#666' : '#ccc'} transparent opacity={hovered ? 0.6 : 0.15} />
      </lineSegments>
      {/* "+" only on hover */}
      {hovered && (
        <Html center style={{ pointerEvents: 'none' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(23,22,20,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 20, fontWeight: 300,
            userSelect: 'none',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
          }}>+</div>
        </Html>
      )}
    </group>
  );
}

// ── Material-Parameter je Bauteiltyp ─────────────────────────────────────────
// Lack: roughness 0.72 — Farbe kommt 1:1 aus MATERIALS-Hex
// Holz: roughness 0.88, envMapIntensity 0.3 — wärmer, matter, mit Canvas-Maserung
// Profile: MeshPhysicalMaterial (eigene Komponente ProfilPart)
// Griffe: MeshStandardMaterial dunkelgrau

const PLATTEN_MAT = { roughness: 0.72, metalness: 0.0, envMapIntensity: 0.0 };




// ── Kabeldurchlass-Geometrie: Platte mit rechteckigem Loch ───────────────────

const CABLE_W = 120 * S; // 120mm Breite
const CABLE_H = 80 * S;  // 80mm Höhe
const CABLE_MARGIN = 10 * S; // 10mm Abstand vom Rand

function createPlateWithHole(w: number, h: number, d: number): THREE.BufferGeometry {
  // Dünnste Dimension = Plattendicke, die zwei größeren = sichtbare Fläche
  const min = Math.min(w, h, d);

  let faceW: number, faceH: number, thickness: number;
  let axis: 'y' | 'z' | 'x';

  if (Math.abs(h - min) < 0.0001) {
    // Boden/Deckel: dünn in Y, Fläche = XZ
    faceW = w; faceH = d; thickness = h; axis = 'y';
  } else if (Math.abs(d - min) < 0.0001) {
    // Rücken/Front: dünn in Z, Fläche = XY
    faceW = w; faceH = h; thickness = d; axis = 'z';
  } else {
    // Seite: dünn in X, Fläche = YZ
    faceW = d; faceH = h; thickness = w; axis = 'x';
  }

  // Äußerer Umriss der Plattenfläche
  const shape = new ShapeCtor();
  shape.moveTo(-faceW / 2, -faceH / 2);
  shape.lineTo(faceW / 2, -faceH / 2);
  shape.lineTo(faceW / 2, faceH / 2);
  shape.lineTo(-faceW / 2, faceH / 2);
  shape.closePath();

  // Loch-Position: Boden → hinterer Rand (Rückwand); Seite/Rücken → unterer Rand (bodennah)
  const hw = Math.min(CABLE_W, faceW * 0.8) / 2;
  const hh = Math.min(CABLE_H, faceH * 0.8) / 2;
  const holeCY = axis === 'y'
    ? faceH / 2 - CABLE_MARGIN - hh     // Boden: Loch zum hinteren Rand
    : -faceH / 2 + CABLE_MARGIN + hh;   // Seite/Rücken: Loch zum unteren Rand

  const hole = new PathCtor();
  hole.moveTo(-hw, holeCY - hh);
  hole.lineTo(hw, holeCY - hh);
  hole.lineTo(hw, holeCY + hh);
  hole.lineTo(-hw, holeCY + hh);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new ExtrudeGeometryCtor(shape, { depth: thickness, bevelEnabled: false });
  // ExtrudeGeometry extrudiert von z=0 nach z=depth → zentrieren
  geo.translate(0, 0, -thickness / 2);

  // Rotation: Shape liegt auf XY, muss zur richtigen Achse rotiert werden
  if (axis === 'y') geo.rotateX(-Math.PI / 2);
  else if (axis === 'x') geo.rotateY(Math.PI / 2);
  // axis === 'z' → keine Rotation nötig (XY ist korrekt)

  return geo;
}

/** Platte mit abgerundeten Ecken (nur Ecken der Fläche, nicht Kanten der Dicke) */
function createRoundedPlate(w: number, h: number, d: number, radius: number): THREE.BufferGeometry {
  // Dünnste Dimension = Plattendicke
  const min = Math.min(w, h, d);

  let faceW: number, faceH: number, thickness: number;
  let axis: 'y' | 'z' | 'x';

  if (Math.abs(h - min) < 0.0001) {
    faceW = w; faceH = d; thickness = h; axis = 'y';
  } else if (Math.abs(d - min) < 0.0001) {
    faceW = w; faceH = h; thickness = d; axis = 'z';
  } else {
    faceW = d; faceH = h; thickness = w; axis = 'x';
  }

  // Radius begrenzen (darf nicht größer als halbe Kantenlänge sein)
  const r = Math.min(radius, faceW / 2, faceH / 2);
  const hw = faceW / 2, hh = faceH / 2;

  const shape = new ShapeCtor();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const geo = new ExtrudeGeometryCtor(shape, { depth: thickness, bevelEnabled: false });
  geo.translate(0, 0, -thickness / 2);

  if (axis === 'y') geo.rotateX(-Math.PI / 2);
  else if (axis === 'x') geo.rotateY(Math.PI / 2);

  return geo;
}

// ── PlattenPart — Platten/Fronten mit catOverride-Farb-Reaktivität ──────────

function PlattenPart({
  obj,
  catOverrides,
  onPlateClick,
  partColors,
  cellColors,
  hasCableHole,
  debug,
}: {
  obj: SceneObject;
  catOverrides: Record<string, { anzahl?: number; oberflaeche?: string; kabel?: boolean }>;
  onPlateClick?: (row: number, col: number, plateId: string, partType: string) => void;
  partColors?: Record<string, string>;
  cellColors?: Record<string, string>;
  hasCableHole?: boolean;
  debug?: DebugMatValues;
}) {
  // Effektive Farbe: partColors > cellColors > catOverride > globale Surface-Farbe
  const effectiveHex = useMemo(() => {
    // Individuelle Plattenfarbe (flat: SceneObject.id → hex)
    if (partColors?.[obj.id]) {
      return partColors[obj.id];
    }
    // Element-Farbe (pro Zelle): nur wenn Platte einer Zelle zugeordnet ist
    if (obj.row != null && obj.col != null) {
      const cellHex = cellColors?.[`${obj.row}_${obj.col}`];
      if (cellHex) return cellHex;
    }
    // catOverride (BOM-Kategorie-Level)
    const override = obj.catKey ? catOverrides[obj.catKey] : undefined;
    if (override?.oberflaeche) {
      const matDef = MAT_BY_V[override.oberflaeche];
      if (matDef) return matDef.hex;
    }
    return obj.color;
  }, [obj.id, obj.row, obj.col, obj.catKey, obj.color, catOverrides, partColors, cellColors]);

  // Debug-Farb-Override: wenn im Panel eine Lack-Farbe geändert wurde, hier anwenden
  const debugHex = useMemo(() => {
    if (!debug) return effectiveHex;
    const overrides = debug.colorOverrides;
    if (!overrides || Object.keys(overrides).length === 0) return effectiveHex;
    const mat = MATERIALS.find(m => m.hex === effectiveHex);
    if (!mat) return effectiveHex;
    return overrides[mat.v] ?? effectiveHex;
  }, [effectiveHex, debug]);

  // Texturtyp ableiten: Holz, Alu oder keiner (Lack/Glas/MDF)
  const textureType = useMemo(() => {
    const mat = MATERIALS.find(m => m.textured && m.hex === effectiveHex);
    if (!mat) return null;
    const map: Record<string, string> = { ZEB: 'zebrano', NUS: 'nussbaum', EIC: 'eiche', ALG: 'alu' };
    return map[mat.v] ?? null;
  }, [effectiveHex]);

  // MDF-Erkennung: PG1-Kunstharz ohne eigene Textur → bekommt MDF-Strukturmaps
  // Prüfe gegen Original-Hex (effectiveHex), nicht debugHex
  const isMDF = useMemo(() => {
    if (textureType) return false;
    const mat = MATERIALS.find(m => m.hex === effectiveHex);
    return mat?.pg === 'PG1' && !mat.textured;
  }, [effectiveHex, textureType]);

  const isMetalTexture = textureType === 'alu';

  // Farbe: Holz/Alu → weiß (ColorMap trägt die Farbe), MDF/Lack → sRGB→Linear
  const effectiveColor = useMemo(() => {
    if (textureType) return '#ffffff';
    return new THREE.Color(debugHex).convertSRGBToLinear();
  }, [debugHex, textureType]);

  // PBR-Texturen für Holz/Alu (Color + Normal + Roughness + optional Metalness)
  const texMaps = useMemo(() => {
    if (!textureType) return null;
    return getWoodTexture(textureType);
  }, [textureType]);

  // MDF-Strukturtexturen (Normal + Roughness + AO) — nur für PG1-Kunstharz
  const mdfMaps = useMemo(() => {
    if (!isMDF) return null;
    return getMDFTexture();
  }, [isMDF]);

  // Materialwerte je nach Oberflächentyp — MDF-Werte kommen aus Debug-Panel wenn aktiv
  const roughness       = texMaps ? 1.0 : isMDF ? (debug?.mdf.roughness ?? 0.88) : PLATTEN_MAT.roughness;
  const metalness       = isMetalTexture ? 1.0 : 0.0;
  const envMapIntensity = texMaps ? (isMetalTexture ? 0.6 : 0.3) : 0.0;

  // Material-Key: erzwingt Shader-Rekompilierung bei Textur-Moduswechsel
  const matKey = textureType ?? (isMDF ? 'mdf' : 'solid');

  // Geometrie: Kabeldurchlass → ExtrudeGeometry, sonst je nach Textur
  // Holz/Alu (texturiert) → boxGeometry (korrekte UVs für Textur-Mapping)
  // MDF/Lack (nicht texturiert) → gerundete Ecken via ExtrudeGeometry
  const customGeometry = useMemo(() => {
    if (hasCableHole) {
      return createPlateWithHole(obj.size[0], obj.size[1], obj.size[2]);
    }
    if (!textureType) {
      // Nicht-texturierte Platten: 6mm Eckenverrundung
      return createRoundedPlate(obj.size[0], obj.size[1], obj.size[2], 6 * S);
    }
    return null; // Texturierte Platten: boxGeometry (korrekte UVs)
  }, [hasCableHole, obj.size, textureType]);

  return (
    <mesh
      position={obj.position}
      castShadow
      receiveShadow
      geometry={customGeometry ?? undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (obj.row != null && obj.col != null && onPlateClick) {
          onPlateClick(obj.row, obj.col, obj.id, obj.partType);
        }
      }}
    >
      {/* Texturierte Platten: boxGeometry für korrekte UV-Koordinaten */}
      {!customGeometry && <boxGeometry args={obj.size} />}
      <meshStandardMaterial
        key={matKey}
        color={effectiveColor}
        roughness={roughness}
        metalness={metalness}
        envMapIntensity={envMapIntensity}
        // Holz/Alu: volle PBR-Maps (Color, Normal, Roughness, Metalness)
        // MDF: nur dezente Normal+AO für Struktur, KEINE roughnessMap (verursacht Glanzflecken)
        map={texMaps?.colorMap ?? undefined}
        normalMap={texMaps?.normalMap ?? mdfMaps?.normalMap ?? undefined}
        normalScale={mdfMaps ? new THREE.Vector2(debug?.mdf.normalScale ?? 0.08, debug?.mdf.normalScale ?? 0.08) : undefined}
        roughnessMap={texMaps?.roughnessMap ?? undefined}
        metalnessMap={texMaps?.metalnessMap ?? undefined}
        aoMap={mdfMaps?.aoMap ?? undefined}
        aoMapIntensity={mdfMaps ? (debug?.mdf.aoMapIntensity ?? 0.3) : undefined}
      />
    </mesh>
  );
}

// ── ThreeCanvasHandle — exponiert captureScreenshot nach außen ────────────────

export interface ThreeCanvasHandle {
  captureScreenshot: (w?: number, h?: number) => Promise<string>;
  resetCamera: () => void;
}

/** Innere Komponente: lebt innerhalb des Canvas und hat Zugriff auf useThree().
 *  Positioniert die Kamera automatisch auf eine Frontansicht (leicht von rechts oben)
 *  bevor der Screenshot erstellt wird, und stellt die Kamera danach wieder her. */
function ScreenshotHelper({
  handleRef,
  ccRef,
  furnitureBounds,
}: {
  handleRef: React.MutableRefObject<ThreeCanvasHandle | null>;
  ccRef: React.MutableRefObject<CameraControlsImpl | null>;
  furnitureBounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
}) {
  const { gl, scene, camera } = useThree();

  const captureScreenshot = useCallback((
    _width = 1600,
    _height = 900,
  ): Promise<string> => {
    return new Promise((resolve) => {
      const cc = ccRef.current;

      // Kameraposition speichern
      const savedPos = camera.position.clone();
      const savedTarget = new THREE.Vector3();
      if (cc) cc.getTarget(savedTarget);

      // Möbel-BoundingBox aus vorberechneten Bounds (nicht scene.traverse!)
      const bbox = new THREE.Box3(
        new THREE.Vector3(furnitureBounds.minX, furnitureBounds.minY, furnitureBounds.minZ),
        new THREE.Vector3(furnitureBounds.maxX, furnitureBounds.maxY, furnitureBounds.maxZ),
      );
      if (!bbox.isEmpty()) {
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        // Kamera-Distanz: beide Achsen (horizontal + vertikal) berücksichtigen
        const aspect = 1600 / 900;
        const vFov = (45 * Math.PI) / 180; // vertikaler FOV
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
        // Distanz berechnet aus der engeren Achse (damit nichts abgeschnitten wird)
        const distH = (size.x / 2) / Math.tan(hFov / 2);
        const distV = (size.y / 2) / Math.tan(vFov / 2);
        const dist = Math.max(distH, distV) * 1.45; // 45% Rand für Profile + Füße
        // Leichte Draufsicht für erkennbare 3D-Optik
        const exportPos = new THREE.Vector3(
          center.x + dist * 0.08,
          center.y + dist * 0.35,
          center.z + dist * 0.95,
        );
        camera.position.copy(exportPos);
        camera.lookAt(center);
        camera.updateProjectionMatrix();
      }

      // Ghost Zones und Overlays beim Screenshot ausblenden
      const hiddenGroups: { obj: THREE.Object3D; vis: boolean }[] = [];
      scene.traverse((obj) => {
        if (obj.name === 'ghost-zones' || obj.name === 'cell-buttons' || obj.name === 'dim-labels' || obj.name === 'dimension-lines') {
          hiddenGroups.push({ obj, vis: obj.visible });
          obj.visible = false;
        }
      });

      // Render bei aktueller Canvas-Größe (kein Resize → kein Flackern)
      gl.render(scene, camera);
      const dataUrl = gl.domElement.toDataURL('image/png');

      // Ausgeblendete Gruppen wiederherstellen
      for (const h of hiddenGroups) h.obj.visible = h.vis;

      // Kameraposition wiederherstellen
      camera.position.copy(savedPos);
      if (cc) {
        cc.setLookAt(
          savedPos.x, savedPos.y, savedPos.z,
          savedTarget.x, savedTarget.y, savedTarget.z,
          false,
        );
      }
      gl.render(scene, camera);
      resolve(dataUrl);
    });
  }, [gl, scene, camera, ccRef, furnitureBounds]);

  // Exponiere captureScreenshot via Ref (resetCamera wird vom äußeren Preview3D via useImperativeHandle gesetzt)
  useEffect(() => {
    handleRef.current = { captureScreenshot, resetCamera: () => {} };
  }, [handleRef, captureScreenshot]);

  return null;
}

// ── CameraDrillZoom — Auto-Zoom bei Drill-Down-Transition ────────────────────

function CameraDrillZoom({
  ccRef,
  drillLevel,
  selectedCell,
  selectedPlateId,
  objects,
  furnitureBounds,
}: {
  ccRef: React.MutableRefObject<CameraControlsImpl | null>;
  drillLevel: 'moebel' | 'element' | 'platte';
  selectedCell: { row: number; col: number } | null;
  selectedPlateId: string | null;
  objects: SceneObject[];
  furnitureBounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
}) {
  const prevLevel = useRef(drillLevel);
  const prevCell = useRef(selectedCell);

  useEffect(() => {
    const cc = ccRef.current;
    if (!cc) return;

    const levelChanged = prevLevel.current !== drillLevel;
    const cellChanged = prevCell.current?.row !== selectedCell?.row || prevCell.current?.col !== selectedCell?.col;
    prevLevel.current = drillLevel;
    prevCell.current = selectedCell;

    if (!levelChanged && !cellChanged) return;

    if (drillLevel === 'moebel') {
      const box = new THREE.Box3(
        new THREE.Vector3(furnitureBounds.minX, furnitureBounds.minY, furnitureBounds.minZ),
        new THREE.Vector3(furnitureBounds.maxX, furnitureBounds.maxY, furnitureBounds.maxZ),
      );
      const pad = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * 0.6;
      cc.fitToBox(box, true, { paddingLeft: pad, paddingRight: pad, paddingTop: pad, paddingBottom: pad });
    } else if (drillLevel === 'element' && selectedCell) {
      const matched = objects.filter(o => o.row === selectedCell.row && o.col === selectedCell.col);
      if (matched.length === 0) return;
      const box = new THREE.Box3();
      for (const obj of matched) {
        const hw = obj.size[0] / 2, hh = obj.size[1] / 2, hd = obj.size[2] / 2;
        box.expandByPoint(new THREE.Vector3(obj.position[0] - hw, obj.position[1] - hh, obj.position[2] - hd));
        box.expandByPoint(new THREE.Vector3(obj.position[0] + hw, obj.position[1] + hh, obj.position[2] + hd));
      }
      const pad = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * 0.4;
      cc.fitToBox(box, true, { paddingLeft: pad, paddingRight: pad, paddingTop: pad, paddingBottom: pad });
    } else if (drillLevel === 'platte' && selectedPlateId) {
      const obj = objects.find(o => o.id === selectedPlateId);
      if (!obj) return;
      const hw = obj.size[0] / 2, hh = obj.size[1] / 2, hd = obj.size[2] / 2;
      const box = new THREE.Box3(
        new THREE.Vector3(obj.position[0] - hw, obj.position[1] - hh, obj.position[2] - hd),
        new THREE.Vector3(obj.position[0] + hw, obj.position[1] + hh, obj.position[2] + hd),
      );
      const pad = Math.max(box.max.x - box.min.x, box.max.y - box.min.y) * 0.3;
      cc.fitToBox(box, true, { paddingLeft: pad, paddingRight: pad, paddingTop: pad, paddingBottom: pad });
    }
  }, [ccRef, drillLevel, selectedCell, selectedPlateId, objects, furnitureBounds]);

  return null;
}

// ── Preview3D ─────────────────────────────────────────────────────────────────

interface Preview3DProps {
  state: ConfigState;
  cameraElevation?: number;
  /** Einheitlicher Klick-Handler: Platte geklickt (row, col, plateId, partType) */
  onPlateClick?: (row: number, col: number, plateId: string, partType: string) => void;
  /** Einheitlicher Klick-Handler: Mesh mit row/col geklickt (Griffe, Strukturteile) */
  onMeshClick?: (row: number, col: number) => void;
  /** Klick ins Leere */
  onMiss?: () => void;
  /** Drill-Down Level — steuert Highlight-Verhalten */
  drillLevel?: 'moebel' | 'element' | 'platte';
  selectedCell?: { row: number; col: number } | null;
  selectedPlateId?: string | null;
  /** Ghost Zone: Zelle hinzufuegen (row, col) — fuer interne leere Zellen */
  onGhostClick?: (row: number, col: number) => void;
  /** Grid erweitern und Zelle hinzufuegen (Rand-Ghost-Zones) */
  onExpandAndAdd?: (direction: 'left' | 'right' | 'top' | 'bottom' | 'depth', atIndex: number) => void;
  /** Element entfernen (row, col) */
  onRemoveElement?: (row: number, col: number) => void;
  /** Leere Zelle mit 'O' füllen (row, col) */
  onAddCell?: (row: number, col: number) => void;
  /** Spaltenbreite setzen */
  onSetCol?: (col: number, width: number) => void;
  /** Zeilenhöhe setzen */
  onSetRow?: (row: number, height: number) => void;
  /** Hintergrundfarbe des Canvas (für Light/Dark-Modus) */
  bgColor?: string;
  /** Außenmaß-Bemaßungslinien anzeigen */
  showDimensions?: boolean;
  /** Material-Debug-Panel anzeigen (?debug=true) */
  debugMode?: boolean;
}


const Preview3D = forwardRef<ThreeCanvasHandle, Preview3DProps>(function Preview3D({
  state,
  cameraElevation = 0.55,
  onPlateClick,
  onMeshClick,
  onMiss,
  drillLevel = 'moebel',
  selectedCell,
  selectedPlateId,
  onGhostClick,
  onExpandAndAdd,
  onRemoveElement,
  onAddCell,
  onSetCol,
  onSetRow,
  bgColor = '#F5F2ED',
  showDimensions = false,
  debugMode = false,
}, ref) {
  // Material-Debug: Leva-Controls registrieren (Panel nur bei debugMode sichtbar)
  const debugValues = useMaterialDebugControls();
  const dv = debugMode ? debugValues : undefined;
  // Stabiler Hash aus Grid-Typen — ändert sich nur bei echten Strukturänderungen
  const gridHash = useMemo(
    () => state.grid.map(row => row.map(colArr => colArr.map(c => c.type).join('.')).join(',')).join('|'),
    [state.grid],
  );

  // Kamera und Ziel auf aktive Bounding Box ausrichten — nicht auf das gesamte Grid
  const { xOff, yOff, wAct, hAct } = useMemo(
    () => getActiveBounds(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridHash, state.cols, state.rows],
  );

  // Außenmaße der aktiven Region in Three.js-Einheiten
  const outerW = wAct * S;
  const outerH = hAct * S;

  // Initiale Kameraposition (wird durch fitToBox überschrieben)
  const camDist = Math.max(outerW, outerH, state.depthLayers * ELEMENT_SIZE_MM * S) * 6.0;

  // Frontalansicht: Kamera vor dem Möbel (Z), leicht erhöht (Y), minimal seitlich (X)
  const camPos = useMemo<[number, number, number]>(
    () => [camDist * 0.15, camDist * cameraElevation, camDist * 1.3],
    [camDist, cameraElevation],
  );

  // Footer-Höhe berücksichtigen (Stellfuß 50mm + Nivellierschraube 15mm, Rolle 60mm)
  const footerExtent = state.footer.startsWith('stell') ? 70 // 50mm Profil + 15mm Nivellierschraube + 5mm Puffer
    : state.footer.startsWith('rolle') ? 65
    : state.footer === 'nivellierschraube' ? 20
    : 0;

  // Möbel-BoundingBox für fitToBox — in Three.js-Einheiten
  const boxMinX = (xOff - 15) * S;
  const boxMinY = (yOff - 20 - footerExtent) * S;
  const boxMinZ = -0.15;
  const boxMaxX = (xOff + wAct + 15) * S;
  const boxMaxY = (yOff + hAct + 15) * S;
  const boxMaxZ = (state.depthLayers * ELEMENT_SIZE_MM + 15 + 10) * S;

  const objects = useModuleGeometry(state);

  // ── Phantom Elements: Ghost-Boxen für Grid-Erweiterung ──
  interface PhantomPos {
    id: string;
    position: [number, number, number];
    size: [number, number, number];
    targetRow: number;
    targetCol: number;
    action: 'internal' | 'expandLeft' | 'expandRight' | 'expandTop' | 'depth';
  }

  const phantomElements = useMemo<PhantomPos[]>(() => {
    const phantoms: PhantomPos[] = [];
    const nR = state.rows.length;
    const nC = state.cols.length;
    const nD = state.depthLayers;

    const sEl = ELEMENT_SIZE_MM; // 600mm
    const totalW = nC * sEl;
    const totalD = nD * sEl;
    const xBase = -totalW / 2;    // Zentrierung X
    const yBase = 0;               // Boden
    const zBase = -totalD / 2;     // Zentrierung Z

    // Einheitliche Phantom-Box Größe: immer exakt 1 Element (600×600×Tiefe)
    const boxSide = sEl * S;       // 600mm in Three.js
    const boxDepth = totalD * S;   // Gesamte Möbeltiefe in Three.js

    const isActive = (r: number, c: number) =>
      r >= 0 && r < nR && c >= 0 && c < nC &&
      (state.grid[r]?.[c]?.some(cell => cell.type !== '') ?? false);

    // Support: Bodenzeile ODER aktives Element direkt darunter
    const hasSupport = (r: number) => {
      // Bodenzeile hat immer Support (egal welche Spalte)
      return r === nR - 1;
    };
    const hasSupportAt = (r: number, c: number) => {
      if (r === nR - 1) return true; // Bodenzeile
      return isActive(r + 1, c);     // Element darunter aktiv
    };

    // Position berechnen: Zellmitte in Three.js Koordinaten
    const pos = (r: number, c: number): [number, number, number] => [
      (xBase + (c + 0.5) * sEl) * S,
      (yBase + (nR - r - 0.5) * sEl) * S,
      (zBase + totalD / 2) * S,
    ];

    // ── 1. INTERNE leere Zellen ────────────────────────────────────────────
    for (let r = 0; r < nR; r++) {
      for (let c = 0; c < nC; c++) {
        if (isActive(r, c)) continue;
        if (!hasSupportAt(r, c)) continue;
        // Mindestens ein aktiver 4-Nachbar
        const hasNeighbor =
          isActive(r - 1, c) || isActive(r + 1, c) ||
          isActive(r, c - 1) || isActive(r, c + 1);
        if (!hasNeighbor) continue;

        phantoms.push({
          id: `ph_${r}_${c}`,
          position: pos(r, c),
          size: [boxSide, boxSide, boxDepth],
          targetRow: r, targetCol: c,
          action: 'internal',
        });
      }
    }

    // ── 2. RAND-Erweiterung: Links, Rechts, Oben ──────────────────────────
    // Für jede aktive Zelle am jeweiligen Rand prüfen
    if (nC < MAX_COLS) {
      for (let r = 0; r < nR; r++) {
        // LINKS: Zelle bei col=0 aktiv → Phantom bei col=-1
        if (isActive(r, 0) && hasSupportAt(r, 0)) {
          phantoms.push({
            id: `ph_left_${r}`,
            position: [(xBase - sEl / 2) * S, (yBase + (nR - r - 0.5) * sEl) * S, (zBase + totalD / 2) * S],
            size: [boxSide, boxSide, boxDepth],
            targetRow: r, targetCol: -1,
            action: 'expandLeft',
          });
        }
        // RECHTS: Zelle bei col=nC-1 aktiv → Phantom bei col=nC
        if (isActive(r, nC - 1) && hasSupportAt(r, nC - 1)) {
          phantoms.push({
            id: `ph_right_${r}`,
            position: [(xBase + totalW + sEl / 2) * S, (yBase + (nR - r - 0.5) * sEl) * S, (zBase + totalD / 2) * S],
            size: [boxSide, boxSide, boxDepth],
            targetRow: r, targetCol: nC,
            action: 'expandRight',
          });
        }
      }
    }

    // OBEN: Zelle bei row=0 aktiv → Phantom bei row=-1 (Support immer gegeben: darunter ist row=0)
    if (nR < MAX_ROWS) {
      for (let c = 0; c < nC; c++) {
        if (!isActive(0, c)) continue;
        phantoms.push({
          id: `ph_top_${c}`,
          position: [(xBase + (c + 0.5) * sEl) * S, (yBase + (nR + 0.5) * sEl) * S, (zBase + totalD / 2) * S],
          size: [boxSide, boxSide, boxDepth],
          targetRow: -1, targetCol: c,
          action: 'expandTop',
        });
      }
    }

    // ── 3. TIEFE: einzelne Phantome pro aktiver Zelle hinter dem Möbel ────
    if (nD < MAX_DEPTH) {
      for (let r = 0; r < nR; r++) {
        for (let c = 0; c < nC; c++) {
          if (!isActive(r, c)) continue;
          phantoms.push({
            id: `ph_depth_${r}_${c}`,
            position: [
              (xBase + (c + 0.5) * sEl) * S,
              (yBase + (nR - r - 0.5) * sEl) * S,
              (zBase + totalD + sEl / 2) * S,
            ],
            size: [boxSide, boxSide, boxSide], // 600×600×600 (eine Tiefenebene)
            targetRow: r, targetCol: c,
            action: 'depth',
          });
        }
      }
    }

    return phantoms;
  }, [state.grid, state.cols, state.rows, state.depthLayers]);

  // Phantom Element Klick-Handler
  const handlePhantomClick = useCallback((phantom: PhantomPos) => {
    if (phantom.action === 'internal') {
      onAddCell?.(phantom.targetRow, phantom.targetCol);
    } else if (phantom.action === 'expandLeft') {
      onExpandAndAdd?.('left', phantom.targetRow);
    } else if (phantom.action === 'expandRight') {
      onExpandAndAdd?.('right', phantom.targetRow);
    } else if (phantom.action === 'expandTop') {
      onExpandAndAdd?.('top', phantom.targetCol);
    } else if (phantom.action === 'depth') {
      onExpandAndAdd?.('depth', 0);
    }
  }, [onAddCell, onExpandAndAdd]);

  // ── Remove Buttons: auf allen aktiven Zellen (keine Schwerkraft-Einschraenkung) ──
  const cellButtons = useMemo(() => {
    const removes: { row: number; col: number; position: [number, number, number] }[] = [];
    const nR = state.rows.length;
    const nC = state.cols.length;
    const nD = state.depthLayers;
    const totalW = nC * ELEMENT_SIZE_MM;
    const totalD = nD * ELEMENT_SIZE_MM;
    const xBase = -totalW / 2;
    const yBase = 0;

    for (let r = 0; r < nR; r++) {
      for (let c = 0; c < nC; c++) {
        const isOccupied = state.grid[r]?.[c]?.some(cell => cell.type !== '') ?? false;
        if (!isOccupied) continue;

        // x Button oben-rechts an der Zelle, leicht vor dem Moebel (Z)
        removes.push({
          row: r, col: c,
          position: [
            (xBase + (c + 1) * ELEMENT_SIZE_MM) * S,
            (yBase + (nR - r) * ELEMENT_SIZE_MM) * S,
            (totalD + 20) * S,
          ],
        });
      }
    }
    return { removes };
  }, [state.grid, state.cols, state.rows, state.depthLayers]);

  // Szene-Objekte in Gruppen aufteilen: Platten, Profile, Griffe, GLB-Strukturteile
  const PLATTE_TYPES = new Set(['seite_l','seite_r','boden','deckel','ruecken','zwischenboden','zwischenwand','fachboden','front']);
  const plattenObjs = useMemo(
    () => objects.filter(o => PLATTE_TYPES.has(o.partType)),
    [objects], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const profilObjs = useMemo(
    () => objects.filter(o => o.partType === 'profil'),
    [objects],
  );
  const handleObjs = useMemo(
    () => objects.filter(o => o.partType === 'handle'),
    [objects],
  );
  // Würfel, Stellfüße und Rollen: immer als SmartMesh
  const strukturObjs = useMemo(
    () => objects.filter(o =>
      o.partType === 'wuerfel' || o.partType === 'eckverbinder' || o.partType === 'stellfuss' || o.partType === 'rolle'),
    [objects],
  );

  // Grundplatte: zentriert unter dem aktiven Möbel, Y-Unterkante = yOff * S - 5mm
  const groundY  = yOff * S - 0.065;
  const groundW  = outerW * 2.0;
  const groundD  = state.depthLayers * ELEMENT_SIZE_MM * S * 2.5;
  const groundCx = (xOff + wAct / 2) * S;
  const groundCz = state.depthLayers * ELEMENT_SIZE_MM / 2 * S;

  // Scale für ContactShadows: Fußabdruck des Möbels mal 2 (in Three.js-Einheiten)
  const shadowScale = Math.max(outerW, state.depthLayers * ELEMENT_SIZE_MM * S) * 2 + 1;

  // CameraControls-Ref für CameraAutoFrame
  const ccRef = useRef<CameraControlsImpl | null>(null);

  // Screenshot-Handle: ScreenshotHelper (innerhalb Canvas) schreibt hierher
  const screenshotRef = useRef<ThreeCanvasHandle | null>(null);
  useImperativeHandle(ref, () => ({
    captureScreenshot: (w?: number, h?: number) => {
      if (!screenshotRef.current) return Promise.resolve('');
      return screenshotRef.current.captureScreenshot(w, h);
    },
    resetCamera: () => {
      const cc = ccRef.current;
      if (!cc) return;
      const box = new THREE.Box3(
        new THREE.Vector3(boxMinX, boxMinY, boxMinZ),
        new THREE.Vector3(boxMaxX, boxMaxY, boxMaxZ),
      );
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      // Abstand so dass Möbel mit Padding reinpasst
      const dist = Math.max(size.x, size.y) * 1.4;
      // Frontalansicht: Kamera direkt vor dem Möbel (Z-Achse)
      cc.setLookAt(
        center.x, center.y, center.z + dist,
        center.x, center.y, center.z,
        true,
      );
    },
  }), [boxMinX, boxMinY, boxMinZ, boxMaxX, boxMaxY, boxMaxZ]);

  return (
  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <Leva hidden={!debugMode} collapsed={false} titleBar={{ position: { x: -340, y: 60 } }} />
    <Canvas
      flat
      camera={{ position: camPos, fov: 45 }}
      style={{ width: '100%', height: '100%' }}
      shadows="soft"
      onPointerMissed={() => {
        if (onMiss) onMiss();
      }}
    >
      <color attach="background" args={[bgColor]} />
      <ScreenshotHelper
        handleRef={screenshotRef}
        ccRef={ccRef}
        furnitureBounds={{ minX: boxMinX, minY: boxMinY, minZ: boxMinZ, maxX: boxMaxX, maxY: boxMaxY, maxZ: boxMaxZ }}
      />
      <SceneEnvironment />
      {debugMode && <SceneDebugApplicator debug={debugValues} />}
      {/* Beleuchtung: farbtreues Studiolicht — kein Tone Mapping (flat), neutralweiß */}
      <hemisphereLight args={['#ffffff', '#404040', dv?.scene.hemisphereIntensity ?? 0.5]} />
      <directionalLight
        color="#FFFFFF"
        intensity={dv?.scene.directionalIntensity ?? 0.7}
        position={[5, 10, 7]}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.1}
        shadow-camera-far={50}
        shadow-bias={-0.0015}
      />
      <directionalLight color="#FFFFFF" intensity={0.15} position={[-4, 8, -3]} />
      <directionalLight color="#FFFFFF" intensity={0.08} position={[0, 2, 10]} />

      {/* Änderung 3: CameraControls ersetzt OrbitControls — ermöglicht fitToBox */}
      <CameraControls ref={ccRef} makeDefault />

      {/* Platten-Meshes: Lack/Holz mit catOverride-Farbreaktivität */}
      <group name="platten">
        {plattenObjs.map(obj => (
          <PlattenPart
            key={obj.id}
            obj={obj}
            catOverrides={{}}
            onPlateClick={onPlateClick}
            partColors={{}}
            cellColors={{}}
            hasCableHole={false}
            debug={dv}
          />
        ))}
      </group>

      {/* Profile: Alu-Gerüst — SmartMesh mit GLB + non-uniform stretching */}
      <Suspense fallback={null}>
        <group name="profile">
          {profilObjs.map(obj => (
            <SmartMesh
              key={obj.id}
              glbPath={obj.glbFile}
              position={obj.position}
              size={obj.size}
              color={obj.color}
              roughness={obj.roughness ?? 0.18}
              metalness={obj.metalness ?? 0.85}
              envMapIntensity={0.9}
              preRotation={obj.preRotation}
              nonUniformScale={obj.nonUniformScale}
            />
          ))}
        </group>
      </Suspense>

      {/* Griffe: SmartMesh mit realen Maßen + differenziertem Finish */}
      <Suspense fallback={null}>
        <group name="handles">
          {handleObjs.map(obj => (
            <SmartMesh
              key={obj.id}
              glbPath={obj.glbFile}
              position={obj.position}
              size={obj.size}
              color={obj.color}
              roughness={obj.roughness ?? 0.20}
              metalness={obj.metalness ?? 0.80}
              envMapIntensity={0.9}
              preRotation={obj.preRotation}
              rotation={obj.rotation}
              onClick={obj.row != null && obj.col != null && onMeshClick
                ? (e) => { e.stopPropagation(); onMeshClick(obj.row!, obj.col!); }
                : undefined}
            />
          ))}
        </group>
      </Suspense>

      {/* Strukturteile: Eckverbinder (Würfel) + Stellfüße/Rollen als echte GLB-Modelle */}
      <Suspense fallback={null}>
        <group name="struktur">
          {strukturObjs.map(obj => (
            <SmartMesh
              key={obj.id}
              glbPath={obj.glbFile}
              position={obj.position}
              size={obj.size}
              color={obj.color}
              roughness={0.20}
              metalness={0.80}
              envMapIntensity={0.9}
              preRotation={obj.preRotation}
              nonUniformScale={obj.nonUniformScale}
            />
          ))}
        </group>
      </Suspense>

      {/* Grüner Highlight-Rahmen — je nach Drill-Down-Ebene */}
      {selectedCell && drillLevel !== 'platte' && (
        <SelectionHighlight objects={objects} row={selectedCell.row} col={selectedCell.col} />
      )}
      {selectedPlateId && drillLevel === 'platte' && (
        <PlateHighlight objects={objects} plateId={selectedPlateId} />
      )}

      {/* Phantom Elements — Ghost-Boxen fuer Grid-Erweiterung */}
      <group name="ghost-zones">
        {phantomElements.map(ph => (
          <PhantomElement
            key={ph.id}
            position={ph.position}
            size={ph.size}
            onClick={() => handlePhantomClick(ph)}
          />
        ))}
      </group>

      {/* Remove Buttons — immer sichtbar auf aktiven Zellen */}
      <group name="cell-buttons">
        {cellButtons.removes.map(rp => (
          <RemoveButton
            key={`rm_${rp.row}_${rp.col}`}
            position={rp.position}
            onClick={() => onRemoveElement?.(rp.row, rp.col)}
          />
        ))}
      </group>

      {/* Spaltenbreiten / Zeilenhöhen — nur bei aktiver Selektion */}
      <group name="dim-labels">
        {drillLevel === 'moebel' && selectedCell && onSetCol && onSetRow && (
          <ColumnRowLabels
            cols={state.cols}
            rows={state.rows}
            grid={state.grid.map(row => row.map(colArr => colArr[0] ?? { type: '' }))}
            depth={state.depthLayers * ELEMENT_SIZE_MM}
            onSetCol={onSetCol}
            onSetRow={onSetRow}
          />
        )}
      </group>

      {/* Änderung 1: Boden-Shadow via ContactShadows */}
      <ContactShadows
        position={[groundCx, groundY, groundCz]}
        opacity={0.35}
        scale={shadowScale}
        blur={2}
        far={outerH + 1}
      />

      {/* Shadow-Catcher: unsichtbare Fläche fängt Schatten auf */}
      <mesh
        position={[groundCx, groundY, groundCz]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[groundW, groundD]} />
        <meshStandardMaterial color={bgColor} transparent opacity={0.0} roughness={1.0} />
      </mesh>

      {/* Außenmaß-Bemaßungslinien — name für Screenshot-Ausblendung */}
      <group name="dimension-lines">
        {showDimensions && (
          <DimensionOverlay
            cols={state.cols}
            rows={state.rows}
            depth={state.depthLayers * ELEMENT_SIZE_MM}
            grid={state.grid.map(row => row.map(colArr => colArr[0] ?? { type: '' }))}
            footerHeight={
              state.footer.startsWith('stell') ? 60
              : state.footer.startsWith('rolle') ? 60
              : state.footer === 'nivellierschraube' ? 15
              : 0
            }
          />
        )}
      </group>

      {/* Auto-Framing — positioniert Kamera auf Möbel-BoundingBox */}
      <CameraAutoFrame
        ccRef={ccRef}
        minX={boxMinX} minY={boxMinY} minZ={boxMinZ}
        maxX={boxMaxX} maxY={boxMaxY} maxZ={boxMaxZ}
      />
      <CameraDrillZoom
        ccRef={ccRef}
        drillLevel={drillLevel}
        selectedCell={selectedCell ?? null}
        selectedPlateId={selectedPlateId ?? null}
        objects={objects}
        furnitureBounds={{ minX: boxMinX, minY: boxMinY, minZ: boxMinZ, maxX: boxMaxX, maxY: boxMaxY, maxZ: boxMaxZ }}
      />
    </Canvas>

    {/* Radiales CSS-Shadow-Overlay unter dem Möbel */}
    <div style={{
      position: 'absolute',
      bottom: '8%',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '60%',
      height: '40px',
      background: 'radial-gradient(ellipse, rgba(0,0,0,0.18) 0%, transparent 70%)',
      filter: 'blur(8px)',
      pointerEvents: 'none',
    }} />
  </div>
  );
});

export default Preview3D;