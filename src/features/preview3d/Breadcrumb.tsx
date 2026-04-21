'use client';

import type { DrillLevel } from './useDrillDown';

interface BreadcrumbProps {
  level: DrillLevel;
  selectedCell: { row: number; col: number } | null;
  onGoToLevel: (level: DrillLevel) => void;
}

type NavItem = {
  label: string;
  level: DrillLevel;
  active: boolean;
  reachable: boolean;
};

export default function Breadcrumb({ level, selectedCell, onGoToLevel }: BreadcrumbProps) {
  const elementLabel = selectedCell
    ? `R${selectedCell.row + 1}/C${selectedCell.col + 1}`
    : 'Produktrahmen';

  const items: NavItem[] = [
    { label: 'Shop', level: 'shop' as DrillLevel, active: level === 'shop', reachable: true },
    { label: elementLabel, level: 'produktrahmen' as DrillLevel, active: level === 'produktrahmen', reachable: !!selectedCell },
  ];

  return (
    <div style={{
      position: 'absolute',
      top: 68,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 0,
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderRadius: 8,
      padding: '6px 14px',
      fontFamily: 'var(--font-sans)',
      fontSize: 13,
      boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
    }}>
      {items.map((item, i) => (
        <span key={item.level} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && (
            <span style={{
              margin: '0 8px',
              color: '#C0BCB6',
              fontSize: 10,
            }}>&rsaquo;</span>
          )}
          <button
            onClick={() => item.reachable && !item.active && onGoToLevel(item.level)}
            disabled={item.active || !item.reachable}
            style={{
              background: 'none',
              border: 'none',
              padding: '2px 4px',
              cursor: item.active || !item.reachable ? 'default' : 'pointer',
              color: item.active
                ? '#171614'
                : item.reachable
                  ? 'rgba(23,22,20,0.5)'
                  : 'rgba(23,22,20,0.25)',
              fontWeight: item.active ? 600 : 400,
              fontSize: 13,
              fontFamily: 'inherit',
              letterSpacing: '.02em',
              borderBottom: item.active ? '2px solid #171614' : '2px solid transparent',
              borderRadius: 0,
              paddingBottom: 2,
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={(e) => {
              if (item.reachable && !item.active) e.currentTarget.style.color = '#171614';
            }}
            onMouseLeave={(e) => {
              if (item.reachable && !item.active) e.currentTarget.style.color = 'rgba(23,22,20,0.5)';
            }}
          >
            {item.label}
          </button>
        </span>
      ))}
    </div>
  );
}
