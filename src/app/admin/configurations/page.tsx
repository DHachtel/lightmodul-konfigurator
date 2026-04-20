'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// Konfigurationsübersicht-Eintrag
interface ConfigSummary {
  config_code: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  depth: number;
  surface: string;
  created_at: string;
}

interface ApiResponse {
  configs: ConfigSummary[];
  total: number;
  page: number;
  limit: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function AdminConfigurationsPage() {
  const [configs, setConfigs] = useState<ConfigSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('q', search);

    try {
      const res = await fetch(`/api/admin/configurations?${params.toString()}`);
      const data: ApiResponse = await res.json();
      setConfigs(data.configs ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // Fehler ignorieren
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  // Suche auslösen
  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  // Suche zurücksetzen
  function handleClear() {
    setSearchInput('');
    setSearch('');
    setPage(1);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#1C1A17]">Konfigurationen</h1>

        {/* Suchfeld */}
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Möbel-ID suchen…"
            className="text-sm border border-[#EEEBE4] rounded-lg px-3 py-2 text-[#3A3834] bg-white focus:outline-none focus:ring-2 focus:ring-[#8A7050]/30 w-44"
          />
          <button
            type="submit"
            className="px-3 py-2 text-sm bg-[#8A7050] text-white rounded-lg hover:bg-[#7A6040] transition-colors"
          >
            Suchen
          </button>
          {search && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 text-sm border border-[#EEEBE4] rounded-lg text-[#7A7670] hover:bg-[#FAF9F7] transition-colors"
            >
              ✕
            </button>
          )}
        </form>
      </div>

      <div className="bg-white rounded-xl border border-[#EEEBE4] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#7A7670] text-sm">Lädt…</div>
        ) : configs.length === 0 ? (
          <div className="p-8 text-center text-[#7A7670] text-sm">
            {search ? `Keine Konfiguration mit ID „${search}" gefunden.` : 'Noch keine Konfigurationen gespeichert.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#EEEBE4] bg-[#FAF9F7]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Möbel-ID</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Raster</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Maße (mm)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Oberfläche</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Erstellt</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Export</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((cfg, i) => (
                <tr
                  key={cfg.config_code}
                  className={`border-b border-[#EEEBE4] hover:bg-[#FAF9F7] transition-colors ${i === configs.length - 1 ? 'border-b-0' : ''}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/configurations/${cfg.config_code}`}
                      className="font-mono text-[#8A7050] hover:underline font-medium"
                    >
                      {cfg.config_code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#3A3834]">
                    {cfg.cols} × {cfg.rows}
                  </td>
                  <td className="px-4 py-3 text-[#3A3834]">
                    {cfg.width} × {cfg.height} × {cfg.depth}
                  </td>
                  <td className="px-4 py-3 text-[#7A7670]">
                    {cfg.surface}
                  </td>
                  <td className="px-4 py-3 text-[#7A7670]">
                    {formatDate(cfg.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/admin/configurations/${cfg.config_code}/xlsx`}
                      className="text-xs text-[#8A7050] hover:underline"
                    >
                      XLS
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Seitennavigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-[#7A7670]">
            {total} Konfiguration{total !== 1 ? 'en' : ''} gesamt
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-[#EEEBE4] text-[#3A3834] disabled:opacity-40 hover:bg-[#FAF9F7] transition-colors"
            >
              ←
            </button>
            <span className="text-sm text-[#7A7670]">
              Seite {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-[#EEEBE4] text-[#3A3834] disabled:opacity-40 hover:bg-[#FAF9F7] transition-colors"
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
