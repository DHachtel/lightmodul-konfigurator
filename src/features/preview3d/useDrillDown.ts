'use client';

import { useState, useCallback } from 'react';

export type DrillLevel = 'shop' | 'produktrahmen';

export interface DrillState {
  level: DrillLevel;
  selectedCell: { row: number; col: number } | null;
}

export interface DrillActions {
  handleMeshClick: (row: number, col: number) => void;
  handlePlateClick: (row: number, col: number, plateId: string, partType: string) => void;
  handleMiss: () => void;
  goToLevel: (level: DrillLevel) => void;
  goUp: () => void;
}

export function useDrillDown(): [DrillState, DrillActions] {
  const [level, setLevel] = useState<DrillLevel>('shop');
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);

  const handleMeshClick = useCallback((row: number, col: number) => {
    // Im Shop-Modus: Klick selektiert Zelle (fuer X-Button), kein automatischer Ebenen-Wechsel
    // Produktrahmen-Ebene wird ueber Breadcrumb-Button gewechselt
    setSelectedCell({ row, col });
  }, []);

  // handlePlateClick delegates to handleMeshClick (plates also select the cell)
  const handlePlateClick = useCallback((row: number, col: number, _plateId: string, _partType: string) => {
    handleMeshClick(row, col);
  }, [handleMeshClick]);

  const handleMiss = useCallback(() => {
    setLevel('shop');
    setSelectedCell(null);
  }, []);

  const goToLevel = useCallback((l: DrillLevel) => {
    setLevel(l);
    setSelectedCell(null); // Selektion bei jedem Ebenen-Wechsel zuruecksetzen
  }, []);

  const goUp = useCallback(() => {
    if (level === 'produktrahmen') {
      setLevel('shop');
      setSelectedCell(null);
    }
  }, [level]);

  return [{ level, selectedCell }, { handleMeshClick, handlePlateClick, handleMiss, goToLevel, goUp }];
}
