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
    if (level === 'shop') {
      if (selectedCell?.row === row && selectedCell?.col === col) {
        setLevel('produktrahmen');
      } else {
        setSelectedCell({ row, col });
      }
    } else {
      setSelectedCell({ row, col });
    }
  }, [level, selectedCell]);

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
    if (l === 'shop') setSelectedCell(null);
  }, []);

  const goUp = useCallback(() => {
    if (level === 'produktrahmen') {
      setLevel('shop');
      setSelectedCell(null);
    }
  }, [level]);

  return [{ level, selectedCell }, { handleMeshClick, handlePlateClick, handleMiss, goToLevel, goUp }];
}
