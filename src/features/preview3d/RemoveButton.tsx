'use client';

import { useState } from 'react';
import { Html } from '@react-three/drei';

interface RemoveButtonProps {
  position: [number, number, number];
  onClick: () => void;
}

/** X-Button zum Entfernen — klein + transparent, bei Hover gross + rot */
export default function RemoveButton({ position, onClick }: RemoveButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <Html position={position} center style={{ pointerEvents: 'auto' }}>
      <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onMouseEnter={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
        onMouseLeave={() => { setHovered(false); document.body.style.cursor = ''; }}
        style={{
          width: hovered ? 28 : 18,
          height: hovered ? 28 : 18,
          borderRadius: '50%',
          background: hovered ? '#EF4444' : 'rgba(140,140,140,0.35)',
          color: hovered ? '#fff' : 'rgba(255,255,255,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: hovered ? 15 : 10,
          fontWeight: 700, cursor: 'pointer',
          transition: 'all 0.18s ease',
          boxShadow: hovered ? '0 0 10px rgba(239,68,68,0.4)' : 'none',
        }}
      >{hovered ? '×' : '×'}</div>
    </Html>
  );
}
