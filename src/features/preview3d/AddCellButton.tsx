'use client';

import { Html } from '@react-three/drei';

interface AddCellButtonProps {
  /** 3D-Position: Zentrum der leeren Zelle */
  position: [number, number, number];
  onClick: () => void;
}

/** +-Button zum Hinzufügen eines Elements in einer leeren Zelle */
export default function AddCellButton({ position, onClick }: AddCellButtonProps) {
  return (
    <Html position={position} center style={{ pointerEvents: 'auto' }}>
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(23,22,20,0.30)',
          border: '1.5px dashed rgba(23,22,20,0.25)',
          color: '#FAFAF8', fontSize: 16, fontWeight: 300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, lineHeight: 1,
          transition: 'background 0.14s ease, transform 0.14s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(23,22,20,0.65)';
          e.currentTarget.style.transform = 'scale(1.15)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(23,22,20,0.30)';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        +
      </button>
    </Html>
  );
}
