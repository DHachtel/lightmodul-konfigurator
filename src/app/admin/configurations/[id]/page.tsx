// @ts-nocheck — Artmodul-Legacydatei, wird in Phase 1 auf Lightmodul umgebaut
'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { ConfigState, BOMResult } from '@/core/types';

// Vollständiger Datensatz aus der Datenbank
interface SavedConfig {
  config_code: number;
  config_json: ConfigState;
  bom_json: BOMResult | null;
  screenshot: string | null;
  created_at: string;
}

// KPI-Karte
interface KpiCard {
  label: string;
  value: string;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}


export default function AdminConfigDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [config, setConfig] = useState<SavedConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/configurations/${id}`)
      .then(r => r.json())
      .then((data: SavedConfig) => setConfig(data))
      .catch(() => {/* Fehler ignorieren */})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-[#7A7670] text-sm">Lädt…</div>;
  }

  if (!config) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#7A7670] text-sm mb-4">Konfiguration nicht gefunden.</p>
        <Link href="/admin/configurations" className="text-[#8A7050] hover:underline text-sm">
          ← Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  const c = config.config_json;
  const bom = config.bom_json;

  // Maße berechnen (Profil-Rahmen: +30mm je Dimension)
  const width = (c.cols ?? []).reduce((a, b) => a + b, 0) + 30;
  const height = (c.rows ?? []).reduce((a, b) => a + b, 0) + 30;
  const depth = (c.depth ?? 0) + 30;

  // BOM-Summen aus DimMaps berechnen
  const totalPlatten = bom
    ? bom.plattenGes
    : 0;
  const totalProfile = bom
    ? bom.pGes
    : 0;
  const totalFronten = bom
    ? bom.frontGes
    : 0;
  const totalBeschlaege = bom
    ? bom.beschlGes
    : 0;
  const totalFuesse = bom
    ? bom.footerQty
    : 0;
  const totalWuerfel = bom
    ? bom.wuerfel
    : 0;

  // KPI-Karten
  const kpis: KpiCard[] = [
    { label: 'Raster', value: `${c.cols?.length ?? 0} × ${c.rows?.length ?? 0}` },
    { label: 'Maße (mm)', value: `${width} × ${height} × ${depth}` },
    { label: 'Oberfläche', value: c.surface ?? '—' },
    { label: 'Tiefe', value: `${depth} mm` },
  ];

  // BOM-Übersicht
  const bomKpis: Array<{ label: string; value: number | string }> = [
    { label: 'Würfel', value: totalWuerfel },
    { label: 'Platten', value: totalPlatten },
    { label: 'Profile', value: totalProfile },
    { label: 'Fronten', value: totalFronten },
    { label: 'Beschläge', value: totalBeschlaege },
    { label: 'Füße', value: totalFuesse },
  ];

  return (
    <div className="max-w-3xl">
      {/* Zurück-Link */}
      <Link
        href="/admin/configurations"
        className="inline-flex items-center gap-1 text-sm text-[#7A7670] hover:text-[#8A7050] mb-5 transition-colors"
      >
        ← Zurück zur Übersicht
      </Link>

      {/* Kopfzeile */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <h1 className="text-xl font-semibold text-[#1C1A17] font-mono">{config.config_code}</h1>
        <span className="text-sm text-[#7A7670]">{formatDateTime(config.created_at)}</span>
        <div className="flex items-center gap-3 ml-auto">
          <a
            href={`/api/admin/configurations/${config.config_code}/xlsx`}
            className="px-3 py-1.5 text-sm border border-[#EEEBE4] rounded-lg text-[#3A3834] hover:bg-[#FAF9F7] transition-colors"
          >
            XLS herunterladen
          </a>
          <a
            href={`/?config=${config.config_code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm bg-[#8A7050] text-white rounded-lg hover:bg-[#7A6040] transition-colors"
          >
            Im Konfigurator öffnen ↗
          </a>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {kpis.map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-[#EEEBE4] p-4">
            <div className="text-xs text-[#7A7670] mb-1">{kpi.label}</div>
            <div className="text-sm font-semibold text-[#1C1A17]">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Screenshot (falls vorhanden) */}
      {config.screenshot && (
        <div className="bg-white rounded-xl border border-[#EEEBE4] p-4 mb-6">
          <div className="text-xs font-medium text-[#7A7670] uppercase tracking-wide mb-3">3D-Vorschau</div>
          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-[#FAF9F7]">
            <Image
              src={config.screenshot}
              alt={`3D-Vorschau Möbel ${config.config_code}`}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        </div>
      )}

      {/* BOM-Übersicht */}
      <div className="bg-white rounded-xl border border-[#EEEBE4] p-5">
        <div className="text-xs font-medium text-[#7A7670] uppercase tracking-wide mb-4">Stückliste (Zusammenfassung)</div>
        {bom ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {bomKpis.map(item => (
              <div key={item.label} className="text-center">
                <div className="text-2xl font-semibold text-[#1C1A17]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {item.value}
                </div>
                <div className="text-xs text-[#7A7670] mt-0.5">{item.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-[#7A7670]">Keine BOM-Daten gespeichert.</div>
        )}
      </div>
    </div>
  );
}
