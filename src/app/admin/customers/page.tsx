'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Profile {
  id: string;
  email: string;
  role: string;
  company: string | null;
  contact_name: string | null;
  phone: string | null;
  discount_pct: number;
  created_at: string;
}

interface ApiResponse {
  profiles: Profile[];
  total: number;
  page: number;
  limit: number;
}

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  dealer:   { label: 'Händler',  className: 'bg-green-50 text-green-700' },
  customer: { label: 'Customer', className: 'bg-gray-100 text-gray-600' },
  admin:    { label: 'Admin',    className: 'bg-blue-50 text-blue-700' },
};

const ROLE_OPTIONS = [
  { value: '', label: 'Alle Rollen' },
  { value: 'dealer', label: 'Händler' },
  { value: 'customer', label: 'Customer' },
  { value: 'admin', label: 'Admin' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function CustomersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (role) params.set('role', role);
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/customers?${params}`);
      if (res.ok) {
        const data = await res.json() as ApiResponse;
        setProfiles(data.profiles);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [page, role, search]);

  useEffect(() => { void load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#1C1A17] mb-6">Kunden</h1>

      {/* Filter + Suche */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1">
          {ROLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setRole(opt.value); setPage(1); }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                role === opt.value
                  ? 'bg-[#1C1A17] text-white'
                  : 'bg-white text-[#7A7670] border border-[#E0DDD7] hover:bg-[#F0EDE7]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }}
          className="flex gap-2 ml-auto"
        >
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Firma, Name, E-Mail…"
            className="px-3 py-1.5 text-xs rounded-md border border-[#E0DDD7] bg-white w-56 focus:outline-none focus:ring-2 focus:ring-[#8A7050]/40"
          />
          <button
            type="submit"
            className="px-3 py-1.5 text-xs rounded-md bg-[#1C1A17] text-white hover:bg-[#3A3834]"
          >
            Suchen
          </button>
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
              className="px-2 py-1.5 text-xs text-[#7A7670] hover:text-[#1C1A17]"
            >
              Zurücksetzen
            </button>
          )}
        </form>
      </div>

      {/* Tabelle */}
      <div className="bg-white rounded-xl border border-[#EEEBE4] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#EEEBE4] bg-[#FAF9F7]">
              <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Firma</th>
              <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Ansprechpartner</th>
              <th className="text-left px-4 py-3 font-medium text-[#7A7670]">E-Mail</th>
              <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Rolle</th>
              <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Rabatt</th>
              <th className="text-left px-4 py-3 font-medium text-[#7A7670]">Registriert</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#A8A49C]">Laden…</td></tr>
            )}
            {!loading && profiles.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[#A8A49C]">Keine Kunden gefunden.</td></tr>
            )}
            {!loading && profiles.map(p => {
              const rc = ROLE_CONFIG[p.role] ?? ROLE_CONFIG.customer;
              return (
                <tr key={p.id} className="border-b border-[#EEEBE4] last:border-0 hover:bg-[#FAF9F7] transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${p.id}`} className="text-[#1C1A17] font-medium hover:underline">
                      {p.company || '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#4A4742]">{p.contact_name || '—'}</td>
                  <td className="px-4 py-3 text-[#4A4742]">{p.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${rc.className}`}>
                      {rc.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#4A4742]">
                    {p.role === 'dealer' ? `${Math.round(p.discount_pct * 100)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#A8A49C]">{formatDate(p.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginierung */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-[#7A7670]">
          <span>Seite {page} von {totalPages} ({total} Kunden)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded border border-[#E0DDD7] disabled:opacity-30 hover:bg-[#F0EDE7]"
            >
              Zurück
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-[#E0DDD7] disabled:opacity-30 hover:bg-[#F0EDE7]"
            >
              Weiter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
