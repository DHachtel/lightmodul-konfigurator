'use client';

import { useState } from 'react';
import { Html, Edges } from '@react-three/drei';
import * as THREE from 'three';

/** Legacy-Typ fuer Abwaertskompatibilitaet */
export type GhostSide = 'left' | 'right' | 'top' | 'bottom';

interface GhostZoneProps {
  /** Eindeutiger Schluessel fuer React — wird nicht mehr fuer Logik benutzt */
  side?: GhostSide;
  row: number;
  col: number;
  position: [number, number, number];
  size: [number, number, number];
  onClick: (row: number, col: number) => void;
}

const GHOST_COLOR = new THREE.Color('#E8E5DF').convertSRGBToLinear();

export default function GhostZone({ row, col, position, size, onClick }: GhostZoneProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <group>
      <mesh
        position={position}
        onPointerEnter={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerLeave={() => setHovered(false)}
        onClick={(e) => { e.stopPropagation(); onClick(row, col); }}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={GHOST_COLOR}
          transparent
          opacity={hovered ? 0.25 : 0.08}
          roughness={1.0}
          depthWrite={false}
        />
        <Edges color={hovered ? '#B0ADA8' : '#D0CDC8'} linewidth={1} />
      </mesh>

      <Html
        position={position}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: hovered ? 'rgba(23,22,20,0.75)' : 'rgba(23,22,20,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s ease, transform 0.2s ease',
          transform: hovered ? 'scale(1.15)' : 'scale(1)',
          cursor: 'pointer',
        }}>
          <span style={{
            color: '#FAFAF8', fontSize: 18, fontWeight: 300, lineHeight: 1,
          }}>+</span>
        </div>
      </Html>
    </group>
  );
}
