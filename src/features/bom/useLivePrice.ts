'use client';

import { useState, useEffect, useRef } from 'react';
import type { ConfigState } from '@/core/types';
import type { PriceResponse } from '@/core/types';

/**
 * Live-Preisabfrage: debounced Fetch an /api/bom bei jeder Config-Änderung.
 * Gibt PriceResponse zurück (oder null während des Ladens).
 */
export function useLivePrice(state: ConfigState, currency: 'EUR' | 'CHF'): {
  pricing: PriceResponse | null;
  loading: boolean;
} {
  const [pricing, setPricing] = useState<PriceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prüfe ob mindestens eine Zelle belegt ist
  // Lightmodul: 3D-Grid grid[row][col][depth] — any cell across all depths
  const hasContent = state.grid.some(row => row.some(col => (col as unknown as { type: string }[] ).some(cell => cell.type !== '')));

  useEffect(() => {
    if (!hasContent) { setPricing(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/bom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: state, currency }),
        });
        if (res.ok) {
          setPricing(await res.json() as PriceResponse);
        } else {
          setPricing(null);
        }
      } catch {
        setPricing(null);
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, currency]);

  return { pricing, loading };
}
