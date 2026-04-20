'use client';

import { useEffect, useState } from 'react';

interface Stats {
  ordersTotal: number;
  ordersOpen: number;
  configsWeek: number;
  configsMonth: number;
  totalRevenue: number;
}

const TILES = [
  { key: 'ordersTotal' as const, label: 'Aufträge gesamt', fmt: (n: number) => String(n) },
  { key: 'ordersOpen' as const, label: 'Offene Aufträge', fmt: (n: number) => String(n) },
  { key: 'configsWeek' as const, label: 'Konfigurationen (7 Tage)', fmt: (n: number) => String(n) },
  { key: 'configsMonth' as const, label: 'Konfigurationen (30 Tage)', fmt: (n: number) => String(n) },
  { key: 'totalRevenue' as const, label: 'Umsatz (bestätigt)', fmt: (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => r.json())
      .then((d: Stats) => setStats(d))
      .catch(() => {/* ignore */});
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1C1A17] mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {TILES.map(tile => (
          <div key={tile.key} className="bg-white rounded-xl p-5 shadow-sm border border-[#EEEBE4]">
            <div className="text-xs text-[#7A7670] mb-1">{tile.label}</div>
            <div className="text-2xl font-semibold text-[#1C1A17]" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {stats ? tile.fmt(stats[tile.key]) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
