'use client';

import { useCallback, useEffect, useState } from 'react';

// Typdefinition für einen Artikel
interface Article {
  art_nr: string;
  typ: string | null;
  kategorie: string | null;
  bezeichnung: string | null;
  breite_mm: number | null;
  tiefe_mm: number | null;
}

// Felder die inline editierbar sind
type EditableField = 'typ' | 'kategorie' | 'bezeichnung';

// Zustand für aktive Inline-Bearbeitung
interface EditState {
  art_nr: string;
  field: EditableField;
  value: string;
}

// Formular-Zustand für neuen Artikel
interface NewArticleForm {
  art_nr: string;
  typ: string;
  kategorie: string;
  bezeichnung: string;
  breite_mm: string;
  tiefe_mm: string;
}

const EMPTY_FORM: NewArticleForm = {
  art_nr: '',
  typ: '',
  kategorie: '',
  bezeichnung: '',
  breite_mm: '',
  tiefe_mm: '',
};

export default function ArticlesPage() {
  const [rows, setRows] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Neue-Artikel-Formular
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewArticleForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // Inline-Edit
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / 30));

  // Artikel laden
  const fetchArticles = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/articles?${params}`);
      const json = await res.json() as { articles: Article[]; total: number };
      setRows(json.articles ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchArticles(page, search);
  }, [fetchArticles, page, search]);

  // Suche auslösen
  const handleSearch = () => {
    setPage(1);
    setSearch(searchInput);
  };

  // Neuen Artikel speichern
  const handleCreate = async () => {
    if (!form.art_nr.trim()) {
      setFormError('Art.Nr. ist erforderlich.');
      return;
    }
    setFormError('');
    setFormSaving(true);
    try {
      const res = await fetch('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          art_nr: form.art_nr.trim(),
          typ: form.typ.trim() || null,
          kategorie: form.kategorie.trim() || null,
          bezeichnung: form.bezeichnung.trim() || null,
          breite_mm: form.breite_mm ? Number(form.breite_mm) : null,
          tiefe_mm: form.tiefe_mm ? Number(form.tiefe_mm) : null,
        }),
      });
      const json = await res.json() as { article?: Article; error?: string };
      if (!res.ok) {
        setFormError(json.error ?? 'Fehler beim Speichern.');
        return;
      }
      if (json.article) {
        setRows(prev => [json.article!, ...prev]);
        setTotal(t => t + 1);
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
    } finally {
      setFormSaving(false);
    }
  };

  // Inline-Edit starten
  const startEdit = (article: Article, field: EditableField) => {
    setEditState({
      art_nr: article.art_nr,
      field,
      value: article[field] ?? '',
    });
  };

  // Inline-Edit speichern
  const commitEdit = async () => {
    if (!editState || editSaving) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/articles/${encodeURIComponent(editState.art_nr)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editState.field]: editState.value }),
      });
      if (res.ok) {
        const json = await res.json() as { article: Article };
        setRows(prev => prev.map(r => r.art_nr === editState.art_nr ? { ...r, ...json.article } : r));
      }
    } finally {
      setEditSaving(false);
      setEditState(null);
    }
  };

  const isEditing = (art_nr: string, field: EditableField) =>
    editState?.art_nr === art_nr && editState.field === field;

  const renderEditableCell = (article: Article, field: EditableField) => {
    if (isEditing(article.art_nr, field)) {
      return (
        <input
          autoFocus
          type="text"
          value={editState!.value}
          onChange={e => setEditState(s => s ? { ...s, value: e.target.value } : null)}
          onBlur={() => { void commitEdit(); }}
          onKeyDown={e => {
            if (e.key === 'Enter') { void commitEdit(); }
            if (e.key === 'Escape') { setEditState(null); }
          }}
          disabled={editSaving}
          className="w-full rounded border border-[#8A7050] px-2 py-0.5 text-xs text-[#1C1A17] focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
        />
      );
    }
    return (
      <span
        className="cursor-pointer text-xs text-[#3A3834] hover:text-[#8A7050] px-1 py-0.5 rounded hover:bg-[#F8F6F2]"
        onClick={() => startEdit(article, field)}
      >
        {article[field] ?? <span className="text-[#7A7670]">–</span>}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#1C1A17]">Artikelstamm</h1>
        <button
          onClick={() => { setShowForm(v => !v); setFormError(''); setForm(EMPTY_FORM); }}
          className="bg-[#1C1A17] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#3A3834] transition-colors"
        >
          {showForm ? 'Abbrechen' : 'Neuer Artikel'}
        </button>
      </div>

      {/* Neuer-Artikel-Formular */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#EEEBE4] p-5 mb-5">
          <h2 className="text-sm font-semibold text-[#1C1A17] mb-4">Neuer Artikel</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {([
              { field: 'art_nr', label: 'Art.Nr. *', type: 'text' },
              { field: 'typ', label: 'Typ', type: 'text' },
              { field: 'kategorie', label: 'Kategorie', type: 'text' },
              { field: 'bezeichnung', label: 'Bezeichnung', type: 'text' },
              { field: 'breite_mm', label: 'Breite (mm)', type: 'number' },
              { field: 'tiefe_mm', label: 'Tiefe (mm)', type: 'number' },
            ] as { field: keyof NewArticleForm; label: string; type: string }[]).map(({ field, label, type }) => (
              <div key={field}>
                <label className="block text-xs text-[#7A7670] mb-1">{label}</label>
                <input
                  type={type}
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full rounded-lg border border-[#DDDAD3] px-3 py-2 text-sm text-[#1C1A17] focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
                />
              </div>
            ))}
          </div>
          {formError && (
            <p className="mt-2 text-xs text-red-600">{formError}</p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => { void handleCreate(); }}
              disabled={formSaving}
              className="bg-[#1C1A17] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#3A3834] disabled:opacity-50 transition-colors"
            >
              {formSaving ? 'Speichern …' : 'Speichern'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(''); }}
              className="text-sm px-4 py-2 rounded-lg border border-[#DDDAD3] text-[#3A3834] hover:bg-[#F8F6F2] transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Suchleiste */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
          placeholder="Art.Nr., Bezeichnung oder Kategorie …"
          className="flex-1 max-w-sm rounded-lg border border-[#DDDAD3] bg-white px-3 py-2 text-sm text-[#1C1A17] placeholder:text-[#7A7670] focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
        />
        <button
          onClick={handleSearch}
          className="bg-[#1C1A17] text-white text-sm px-4 py-2 rounded-lg hover:bg-[#3A3834] transition-colors"
        >
          Suchen
        </button>
      </div>

      {/* Artikeltabelle */}
      <div className="bg-white rounded-xl border border-[#EEEBE4] overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-[#F8F6F2] border-b border-[#EEEBE4]">
              <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] whitespace-nowrap">Art.Nr.</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] whitespace-nowrap">Typ</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] whitespace-nowrap">Kategorie</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] min-w-[180px]">Bezeichnung</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#7A7670] whitespace-nowrap">Breite</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-[#7A7670] whitespace-nowrap">Tiefe</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#7A7670] text-sm">
                  Laden …
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#7A7670] text-sm">
                  Keine Artikel gefunden.
                </td>
              </tr>
            )}
            {!loading && rows.map(article => (
              <tr key={article.art_nr} className="hover:bg-[#FAFAF8] border-b border-[#EEEBE4] last:border-0">
                <td className="px-4 py-2.5 font-mono text-xs text-[#1C1A17] whitespace-nowrap">
                  {article.art_nr}
                </td>
                <td className="px-4 py-2.5">
                  {renderEditableCell(article, 'typ')}
                </td>
                <td className="px-4 py-2.5">
                  {renderEditableCell(article, 'kategorie')}
                </td>
                <td className="px-4 py-2.5">
                  {renderEditableCell(article, 'bezeichnung')}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-[#3A3834] tabular-nums">
                  {article.breite_mm != null ? `${article.breite_mm} mm` : <span className="text-[#7A7670]">–</span>}
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-[#3A3834] tabular-nums">
                  {article.tiefe_mm != null ? `${article.tiefe_mm} mm` : <span className="text-[#7A7670]">–</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => startEdit(article, 'bezeichnung')}
                    className="text-xs text-[#8A7050] hover:text-[#1C1A17] transition-colors"
                  >
                    Bearbeiten
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-[#7A7670]">
            {total} Artikel · Seite {page} / {totalPages}
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
