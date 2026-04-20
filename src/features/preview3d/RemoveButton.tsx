'use client';

import { Html } from '@react-three/drei';

interface RemoveButtonProps {
  position: [number, number, number];
  onClick: () => void;
}

/** ×-Button zum Entfernen eines Elements — immer sichtbar, wird rot bei Hover */
export default function RemoveButton({ position, onClick }: RemoveButtonProps) {
  return (
    <Html position={position} center style={{ pointerEvents: 'auto' }}>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'rgba(23,22,20,0.45)',
          border: '1.5px solid rgba(255,255,255,0.25)',
          color: '#FAFAF8', fontSize: 13, fontWeight: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, lineHeight: 1,
          backdropFilter: 'blur(4px)',
          transition: 'background 0.14s ease, transform 0.14s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(180,40,30,0.85)';
          e.currentTarget.style.transform = 'scale(1.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(23,22,20,0.45)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        ×
      </button>
    </Html>
  );
}
