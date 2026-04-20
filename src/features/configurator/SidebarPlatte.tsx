'use client';

import type { ConfigState } from '@/core/types';
import type { ConfigActions } from './useConfigStore';

const PART_LABELS: Record<string, string> = {
  seite_l: 'Seite links', seite_r: 'Seite rechts',
  boden: 'Boden', deckel: 'Deckel', ruecken: 'Rueckwand',
  zwischenboden: 'Zwischenboden', zwischenwand: 'Zwischenwand', front: 'Front',
};

interface Props {
  state: ConfigState;
  actions: ConfigActions;
  plateId: string;
  plateType: string;
}

export default function SidebarPlatte({ state: _state, actions: _actions, plateId, plateType }: Props) {
  return (
    <div style={{ padding: '20px 20px 0' }}>

      {/* -- PLATTEN-INFO -- */}
      <div style={{
        background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
        padding: '10px 12px', marginBottom: 16,
      }}>
        <span style={{
          fontFamily: 'var(--font-sans)', fontWeight: 600,
          fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#1E40AF',
        }}>
          {PART_LABELS[plateType] ?? plateType}
        </span>
        <p style={{ fontSize: 10, color: '#3B82F6', marginTop: 2, fontFamily: 'var(--font-sans)' }}>
          {plateId}
        </p>
      </div>

      <p style={{ fontSize: 11, color: '#6A6660', fontFamily: 'var(--font-sans)' }}>
        Lightmodul-Platten haben keine individuellen Oberflaechen-Overrides.
      </p>
    </div>
  );
}
