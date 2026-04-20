'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

// ── Typen ────────────────────────────────────────────────────────────────────

export type Market = 'DE' | 'CH';
export type Currency = 'EUR' | 'CHF';

export interface MarketInfo {
  market: Market;
  currency: Currency;
  vatRate: number;
  currencySymbol: string;
}

interface MarketContextValue extends MarketInfo {
  setMarket: (m: Market) => void;
}

// ── Konstanten ───────────────────────────────────────────────────────────────

const MARKET_CONFIG: Record<Market, Omit<MarketInfo, 'market'>> = {
  DE: { currency: 'EUR', vatRate: 0.19, currencySymbol: '€' },
  CH: { currency: 'CHF', vatRate: 0.081, currencySymbol: 'CHF' },
};

// Cookie wird nicht mehr verwendet — Market kommt nur aus URL-Parameter

// ── Initiale Erkennung (Client-seitig aus Cookie oder Browser-Sprache) ──────

function detectInitialMarket(): Market {
  if (typeof window === 'undefined') return 'DE';

  // Nur URL-Parameter ?market=CH aktiviert den Schweizer Markt
  const urlParam = new URLSearchParams(window.location.search).get('market')?.toUpperCase();
  if (urlParam === 'CH') return 'CH';

  return 'DE';
}

// ── Zahlenformat ─────────────────────────────────────────────────────────────

/** Formatiert Preis marktgerecht: DE → 1.234,56  CH → 1'234.56 */
export function fmtPrice(value: number, market: Market): string {
  if (market === 'CH') {
    // Schweizer Format: 1'234.56
    return new Intl.NumberFormat('de-CH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  // DE: 1.234,56
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ── Context ──────────────────────────────────────────────────────────────────

const MarketContext = createContext<MarketContextValue>({
  market: 'DE',
  ...MARKET_CONFIG.DE,
  setMarket: () => {},
});

export function useMarket(): MarketContextValue {
  return useContext(MarketContext);
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function MarketProvider({ children }: { children: ReactNode }) {
  const [market, setMarketState] = useState<Market>('DE');

  // Client-seitig nach Hydration: Cookie auslesen (SSR kennt kein document)
  useEffect(() => {
    setMarketState(detectInitialMarket());
  }, []);

  const setMarket = useCallback((m: Market) => {
    setMarketState(m);
  }, []);

  const info = MARKET_CONFIG[market];

  return (
    <MarketContext.Provider value={{ market, ...info, setMarket }}>
      {children}
    </MarketContext.Provider>
  );
}
