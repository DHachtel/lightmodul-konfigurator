'use client';

import { useState } from 'react';
import { Html } from '@react-three/drei';

interface RemoveButtonProps {
  position: [number, number, number];
  onClick: () => void;
}

/** ×-Button zum Entfernen eines Elements — nur am selektierten Element, rot bei Hover */
export default function RemoveButton({ position, onClick }: RemoveButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <Html position={position} center style={{ pointerEvents: 'auto' }}>
      <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onMouseEnter={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
        onMouseLeave={() => { setHovered(false); document.body.style.cursor = ''; }}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: hovered ? '#EF4444' : 'rgba(120,120,120,0.7)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700, cursor: 'pointer',
          transition: 'all 0.15s ease',
          boxShadow: hovered ? '0 0 12px rgba(239,68,68,0.5)' : '0 1px 4px rgba(0,0,0,0.3)',
        }}
      >×</div>
    </Html>
  );
}
