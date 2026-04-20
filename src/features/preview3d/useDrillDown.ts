'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// ── Typen ────────────────────────────────────────────────────────────────────

export type DrillLevel = 'moebel' | 'element' | 'platte';

export interface DrillState {
  level: DrillLevel;
  /** Selektiertes Element (Möbel- und Element-Ebene) */
  selectedCell: { row: number; col: number } | null;
  /** Selektierte Platte (Platten-Ebene) */
  selectedPlateId: string | null;
  selectedPlateType: string | null;
}

export interface DrillActions {
  /** Einheitlicher Klick-Handler für Platten (PlattenPart) */
  handlePlateClick: (row: number, col: number, plateId: string, partType: string) => void;
  /** Einheitlicher Klick-Handler für Griffe/Strukturteile (SmartMesh mit row/col) */
  handleMeshClick: (row: number, col: number) => void;
  /** Klick ins Leere (Canvas-Hintergrund) */
  handleMiss: () => void;
  /** Breadcrumb-Navigation: direkt zu einer Ebene springen */
  goToLevel: (level: DrillLevel) => void;
  /** Escape-Taste: eine Ebene hoch */
  goUp: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDrillDown(): [DrillState, DrillActions] {
  const [state, setState] = useState<DrillState>({
    level: 'moebel',
    selectedCell: null,
    selectedPlateId: null,
    selectedPlateType: null,
  });

  // Ref für stabile Callback-Referenzen (vermeidet Re-Render-Kaskaden)
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  const handlePlateClick = useCallback((row: number, col: number, plateId: string, partType: string) => {
    const s = stateRef.current;

    if (s.level === 'moebel') {
      if (s.selectedCell && s.selectedCell.row === row && s.selectedCell.col === col) {
        // Bereits selektiert → Drill-Down in Element-Ebene
        setState({
          level: 'element',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      } else {
        // Neues Element selektieren (bleibe in Möbel-Ebene)
        setState({
          level: 'moebel',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      }
    } else if (s.level === 'element') {
      if (s.selectedCell && s.selectedCell.row === row && s.selectedCell.col === col) {
        // Platte im selektierten Element → Drill-Down
        setState({
          level: 'platte',
          selectedCell: { row, col },
          selectedPlateId: plateId,
          selectedPlateType: partType,
        });
      } else {
        // Anderes Element geklickt → wechsle Element (bleibe in Element-Ebene)
        setState({
          level: 'element',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      }
    } else {
      // Platten-Ebene: Klick auf andere Platte im selben Element → wechsle Platte
      if (s.selectedCell && s.selectedCell.row === row && s.selectedCell.col === col) {
        setState({
          ...s,
          selectedPlateId: plateId,
          selectedPlateType: partType,
        });
      } else {
        // Andere Zelle → zurück zur Element-Ebene mit neuem Element
        setState({
          level: 'element',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      }
    }
  }, []);

  const handleMeshClick = useCallback((row: number, col: number) => {
    const s = stateRef.current;

    if (s.level === 'moebel') {
      if (s.selectedCell && s.selectedCell.row === row && s.selectedCell.col === col) {
        setState({
          level: 'element',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      } else {
        setState({
          level: 'moebel',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      }
    } else if (s.level === 'element') {
      if (!(s.selectedCell && s.selectedCell.row === row && s.selectedCell.col === col)) {
        setState({
          level: 'element',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      }
    } else {
      if (!(s.selectedCell && s.selectedCell.row === row && s.selectedCell.col === col)) {
        setState({
          level: 'element',
          selectedCell: { row, col },
          selectedPlateId: null,
          selectedPlateType: null,
        });
      }
    }
  }, []);

  const handleMiss = useCallback(() => {
    // Klick ins Leere → direkt auf sauberen Zustand (alle Overlays aus)
    setState({
      level: 'moebel',
      selectedCell: null,
      selectedPlateId: null,
      selectedPlateType: null,
    });
  }, []);

  const goToLevel = useCallback((level: DrillLevel) => {
    const s = stateRef.current;
    if (level === 'moebel') {
      setState({
        level: 'moebel',
        selectedCell: s.selectedCell,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    } else if (level === 'element') {
      setState({
        level: 'element',
        selectedCell: s.selectedCell,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    }
  }, []);

  const goUp = useCallback(() => {
    const s = stateRef.current;
    if (s.level === 'platte') {
      setState({
        level: 'element',
        selectedCell: s.selectedCell,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    } else if (s.level === 'element') {
      setState({
        level: 'moebel',
        selectedCell: s.selectedCell,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    } else {
      setState({
        level: 'moebel',
        selectedCell: null,
        selectedPlateId: null,
        selectedPlateType: null,
      });
    }
  }, []);

  return [state, { handlePlateClick, handleMeshClick, handleMiss, goToLevel, goUp }];
}
