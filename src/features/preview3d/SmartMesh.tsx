'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * SmartMesh — Lädt ein GLB-Modell und skaliert es auf die Zielgröße.
 * Fallback auf BoxGeometry wenn kein GLB-Pfad angegeben oder Laden fehlschlägt.
 *
 * Skalierung: Das GLB-Modell wird so skaliert, dass seine BoundingBox
 * in die übergebene `size` passt (uniform scale, nicht verzerrt).
 */

interface SmartMeshProps {
  glbPath: string | undefined;
  position: [number, number, number];
  size: [number, number, number];
  color: string | THREE.Color;
  rotation?: [number, number, number];
  preRotation?: [number, number, number];  // auf GLB-Clone angewandt VOR BBox-Berechnung
  nonUniformScale?: boolean;               // wenn true: [sx, sy, sz] statt uniform
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

/** Innere Komponente: Rendert das GLB-Modell */
function GLBModel({
  glbPath,
  position,
  size,
  rotation,
  preRotation,
  nonUniformScale,
  color,
  roughness = 0.20,
  metalness = 0.80,
  envMapIntensity = 0.9,
  castShadow = true,
  receiveShadow = true,
  onClick,
}: SmartMeshProps & { glbPath: string }) {
  const { scene } = useGLTF(glbPath);
  const groupRef = useRef<THREE.Group>(null);

  // Klone die Szene + optional preRotation anwenden VOR BBox-Berechnung
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    if (preRotation) clone.rotation.set(...preRotation);
    return clone;
  }, [scene, preRotation?.[0], preRotation?.[1], preRotation?.[2]]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lokale BoundingBox — einmalig aus dem Clone berechnet (noch nicht im Scene Graph).
  // WICHTIG: setFromObject() liefert die Welt-BBox inkl. Parent-Transforms.
  // Nach dem ersten Commit ist der Clone im Scene Graph → erneutes setFromObject()
  // würde die bereits skalierte Größe zurückgeben → Feedback-Loop (Scale ≈ 1 → GLB-Nativgröße).
  const localModelSize = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const ms = new THREE.Vector3();
    box.getSize(ms);
    return ms;
  }, [clonedScene]);

  // Skalierung: Zielgröße / lokale Modellgröße
  const scale = useMemo(() => {
    const sx = localModelSize.x > 0 ? size[0] / localModelSize.x : 1;
    const sy = localModelSize.y > 0 ? size[1] / localModelSize.y : 1;
    const sz = localModelSize.z > 0 ? size[2] / localModelSize.z : 1;

    if (nonUniformScale) return [sx, sy, sz] as [number, number, number];
    const u = Math.min(sx, sy, sz);
    return [u, u, u] as [number, number, number];
  }, [localModelSize, size, nonUniformScale]);

  // Material auf alle Meshes im GLB anwenden
  useEffect(() => {
    const colorValue = color instanceof THREE.Color ? color : new THREE.Color(color).convertSRGBToLinear();
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: colorValue,
          roughness,
          metalness,
          envMapIntensity,
        });
        child.castShadow = castShadow;
        child.receiveShadow = receiveShadow;
      }
    });
  }, [clonedScene, color, roughness, metalness, envMapIntensity, castShadow, receiveShadow]);

  // Zentrierung: Modell-Mittelpunkt auf [0,0,0] verschieben (aus gecachter lokaler BBox)
  const centerOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return [-center.x, -center.y, -center.z] as [number, number, number];
  }, [clonedScene]); // Stabil: hängt nur vom Clone ab, nicht von size/scale

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onClick={onClick}
    >
      <group scale={scale}>
        <group position={centerOffset}>
          <primitive object={clonedScene} />
        </group>
      </group>
    </group>
  );
}

/** Fallback: BoxGeometry mit gleichem Material */
function BoxFallback({
  position,
  size,
  rotation,
  color,
  roughness = 0.20,
  metalness = 0.80,
  envMapIntensity = 0.9,
  castShadow = true,
  receiveShadow = true,
  onClick,
}: Omit<SmartMeshProps, 'glbPath'>) {
  const effectiveColor = useMemo(() => {
    if (color instanceof THREE.Color) return color;
    return new THREE.Color(color).convertSRGBToLinear();
  }, [color]);

  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      onClick={onClick}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={effectiveColor}
        roughness={roughness}
        metalness={metalness}
        envMapIntensity={envMapIntensity}
      />
    </mesh>
  );
}

/**
 * SmartMesh — Rendert GLB-Modell oder BoxGeometry-Fallback.
 * Wenn `glbPath` undefined/null ist, wird sofort BoxGeometry genutzt.
 * Wenn das GLB-Laden fehlschlägt, greift der Suspense-ErrorBoundary.
 */
export default function SmartMesh(props: SmartMeshProps) {
  if (!props.glbPath) {
    return <BoxFallback {...props} />;
  }

  return <GLBModel {...props} glbPath={props.glbPath} />;
}
