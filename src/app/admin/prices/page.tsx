'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Typdefinition für eine Preiszeile
interface PriceRow {
  art_nr: string;
  bezeichnung: string | null;
  pg1_mdf_eur: number | null;
  pg1_mdf_chf: number | null;
  pg2_eur: number | null;
  pg2_chf: number | null;
  pg3_eur: number | null;
  pg3_chf: number | null;
  pg4_eur: number | null;
  pg4_chf: number | null;
}

// Spalten-Definition für Preis-Felder
const PRICE_COLS: { key: keyof PriceRow; label: string }[] = [
  { key: 'pg1_mdf_eur', label: 'PG1 EUR' },
  { key: 'pg1_mdf_chf', label: 'PG1 CHF' },
  { key: 'pg2_eur', label: 'PG2 EUR' },
  { key: 'pg2_chf', label: 'PG2 CHF' },
  { key: 'pg3_eur', label: 'PG3 EUR' },
  { key: 'pg3_chf', label: 'PG3 CHF' },
  { key: 'pg4_eur', label: 'PG4 EUR' },
  { key: 'pg4_chf', label: 'PG4 CHF' },
];

// Aktiver Bearbeitungs-Key: "art_nr::spaltenkey"
type EditKey = `${string}::${string}`;

export default function PricesPage() {
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Inline-Edit-Zustand
  const [editKey, setEditKey] = useState<EditKey | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.max(1, Math.ceil(total / 30));

  // Daten laden
  const fetchPrices = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/prices?${params}`);
      const json = await res.json() as { prices: PriceRow[]; total: number };
      setRows(json.prices ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrices(page, search);
  }, [fetchPrices, page, search]);

  // Fokus auf Inline-Input setzen sobald editKey gesetzt
  useEffect(() => {
    if (editKey) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editKey]);

  // Bearbeitung starten
  const startEdit = (artNr: string, col: keyof PriceRow, current: number | null) => {
    setEditKey(`${artNr}::${col}` as EditKey);
    setEditValue(current != null ? String(current) : '');
  };

  // Speichern via PATCH
  const commitEdit = async () => {
    if (!editKey || saving) return;
    const [artNr, col] = editKey.split('::');
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/prices/${encodeURIComponent(artNr)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [col]: editValue }),
      });
      if (res.ok) {
        const json = await res.json() as { price: PriceRow };
        setRows(prev => prev.map(r => r.art_nr === artNr ? { ...r, ...json.price } : r));
      }
    } finally {
      setSaving(false);
      setEditKey(null);
    }
  };

  // Suche auslösen
  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  const formatVal = (v: number | null) =>
    v != null ? v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1C1A17] mb-6">Preisliste</h1>

      {/* Suchleiste */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          placeholder="Art.Nr. oder Bezeichnung …"
          className="flex-1 max-w-sm rounded-lg border border-[#DDDAD3] bg-white px-3 py-2 text-sm text-[#1C1A17] placeholder:text-[#7A7670] focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
        />
        <button
          onClick={handleSearch}
          className="bg-[#1C1A17] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#3A3834] transition-colors"
        >
          Suchen
        </button>
      </div>

      {/* Tabelle mit horizontalem Scroll */}
      <div className="bg-white rounded-xl border border-[#EEEBE4] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#F8F6F2]">
                {/* Sticky Art.Nr.-Spalte */}
                <th className="sticky left-0 z-10 bg-[#F8F6F2] text-left px-4 py-3 text-xs font-medium text-[#7A7670] whitespace-nowrap border-b border-[#EEEBE4] border-r">
                  Art.Nr.
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] whitespace-nowrap border-b border-[#EEEBE4] min-w-[200px]">
                  Bezeichnung
                </th>
                {PRICE_COLS.map(c => (
                  <th
                    key={c.key}
                    className="text-right px-4 py-3 text-xs font-medium text-[#7A7670] whitespace-nowrap border-b border-[#EEEBE4] min-w-[90px]"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={2 + PRICE_COLS.length} className="px-4 py-8 text-center text-[#7A7670] text-sm">
                    Laden …
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={2 + PRICE_COLS.length} className="px-4 py-8 text-center text-[#7A7670] text-sm">
                    Keine Einträge gefunden.
                  </td>
                </tr>
              )}
              {!loading && rows.map(row => (
                <tr key={row.art_nr} className="hover:bg-[#FAFAF8] border-b border-[#EEEBE4] last:border-0">
                  {/* Sticky Art.Nr. */}
                  <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-mono text-xs text-[#1C1A17] whitespace-nowrap border-r border-[#EEEBE4]" style={{ backgroundColor: 'inherit' }}>
                    {row.art_nr}
                  </td>
                  <td className="px-4 py-2.5 text-[#3A3834] text-xs">
                    {row.bezeichnung ?? <span className="text-[#7A7670]">–</span>}
                  </td>
                  {PRICE_COLS.map(c => {
                    const ek = `${row.art_nr}::${c.key}` as EditKey;
                    const isEditing = editKey === ek;
                    return (
                      <td
                        key={c.key}
                        className="px-2 py-1.5 text-right tabular-nums"
                        onClick={() => !isEditing && startEdit(row.art_nr, c.key, row[c.key] as number | null)}
                      >
                        {isEditing ? (
                          <input
                            ref={inputRef}
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={() => { void commitEdit(); }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') { void commitEdit(); }
                              if (e.key === 'Escape') { setEditKey(null); }
                            }}
                            disabled={saving}
                            className="w-24 text-right rounded border border-[#8A7050] px-1.5 py-0.5 text-xs text-[#1C1A17] focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
                          />
                        ) : (
                          <span className="cursor-pointer text-xs text-[#3A3834] hover:text-[#8A7050] px-1.5 py-0.5 rounded hover:bg-[#F8F6F2]">
                            {formatVal(row[c.key] as number | null)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-[#7A7670]">
            {total} Einträge · Seite {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-[#DDDAD3] text-[#3A3834] disabled:opacity-40 hover:bg-[#F8F6F2] transition-colors"
            >
              Zurück
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-[#DDDAD3] text-[#3A3834] disabled:opacity-40 hover:bg-[#F8F6F2] transition-colors"
            >
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
