'use client';

import { useState } from 'react';
import { Html } from '@react-three/drei';

interface RemoveButtonProps {
  position: [number, number, number];
  onClick: () => void;
}

/** X-Button zum Entfernen — immer sichtbar, bei Hover gross + rot */
export default function RemoveButton({ position, onClick }: RemoveButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <Html position={position} center style={{ pointerEvents: 'none' }}>
      {/* Grosser unsichtbarer Klickbereich (48px) */}
      <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onMouseEnter={() => { setHovered(true); document.body.style.cursor = 'pointer'; }}
        onMouseLeave={() => { setHovered(false); document.body.style.cursor = ''; }}
        style={{
          pointerEvents: 'auto',
          width: 48, height: 48,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {/* Sichtbarer Kern */}
        <div style={{
          width: hovered ? 30 : 22,
          height: hovered ? 30 : 22,
          borderRadius: '50%',
          background: hovered ? '#EF4444' : 'rgba(100,100,100,0.5)',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: hovered ? 16 : 12,
          fontWeight: 700,
          transition: 'all 0.15s ease',
          boxShadow: hovered
            ? '0 0 12px rgba(239,68,68,0.5)'
            : '0 1px 3px rgba(0,0,0,0.25)',
        }}>×</div>
      </div>
    </Html>
  );
}
