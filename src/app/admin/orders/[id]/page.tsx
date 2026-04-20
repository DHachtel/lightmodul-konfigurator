'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';

// Bestellstatus-Typen
type OrderStatus = 'draft' | 'submitted' | 'confirmed' | 'completed' | 'cancelled';

interface OrderItem {
  id: string;
  config_code: string;
  quantity: number;
  unit_price: number;
  currency: string;
}

interface Order {
  id: string;
  order_nr: string;
  status: OrderStatus;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  customer_street: string | null;
  customer_zip: string | null;
  customer_city: string | null;
  gdpr_consent_at: string | null;
  created_at: string;
  status_changed_at: string | null;
  note: string | null;
  order_items: OrderItem[];
}

// Status-Optionen für Dropdown
const STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: 'draft',     label: 'Entwurf' },
  { value: 'submitted', label: 'Eingegangen' },
  { value: 'confirmed', label: 'Bestätigt' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'cancelled', label: 'Storniert' },
];

const STATUS_BADGE: Record<OrderStatus, string> = {
  draft:     'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-green-50 text-green-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-600',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatPrice(amount: number, currency: string) {
  return amount.toLocaleString('de-DE', { style: 'currency', currency });
}

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusValue, setStatusValue] = useState<OrderStatus>('draft');
  const [noteValue, setNoteValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [noteMsg, setNoteMsg] = useState('');

  useEffect(() => {
    fetch(`/api/admin/orders/${id}`)
      .then(r => r.json())
      .then((data: Order) => {
        setOrder(data);
        setStatusValue(data.status);
        setNoteValue(data.note ?? '');
      })
      .catch(() => {/* Fehler ignorieren */})
      .finally(() => setLoading(false));
  }, [id]);

  // Status speichern
  async function handleStatusSave() {
    if (!order) return;
    setSaving(true);
    setStatusMsg('');
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusValue }),
      });
      if (res.ok) {
        setOrder(prev => prev ? { ...prev, status: statusValue, status_changed_at: new Date().toISOString() } : prev);
        setStatusMsg('Status gespeichert.');
      } else {
        setStatusMsg('Fehler beim Speichern.');
      }
    } catch {
      setStatusMsg('Fehler beim Speichern.');
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMsg(''), 3000);
    }
  }

  // Notiz speichern
  async function handleNoteSave() {
    setSavingNote(true);
    setNoteMsg('');
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteValue }),
      });
      if (res.ok) {
        setNoteMsg('Notiz gespeichert.');
      } else {
        setNoteMsg('Fehler beim Speichern.');
      }
    } catch {
      setNoteMsg('Fehler beim Speichern.');
    } finally {
      setSavingNote(false);
      setTimeout(() => setNoteMsg(''), 3000);
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-[#7A7670] text-sm">Lädt…</div>;
  }

  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#7A7670] text-sm mb-4">Auftrag nicht gefunden.</p>
        <Link href="/admin/orders" className="text-[#8A7050] hover:underline text-sm">← Zurück zur Übersicht</Link>
      </div>
    );
  }

  const badgeClass = STATUS_BADGE[order.status] ?? STATUS_BADGE.draft;

  return (
    <div className="max-w-3xl">
      {/* Zurück-Link */}
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-[#7A7670] hover:text-[#8A7050] mb-5 transition-colors">
        ← Zurück zur Übersicht
      </Link>

      {/* Kopfzeile */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold text-[#1C1A17] font-mono">{order.order_nr}</h1>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
          {STATUS_OPTIONS.find(o => o.value === order.status)?.label ?? order.status}
        </span>
      </div>

      {/* Status ändern */}
      <div className="bg-white rounded-xl border border-[#EEEBE4] p-5 mb-4">
        <h2 className="text-sm font-medium text-[#1C1A17] mb-3">Status ändern</h2>
        <div className="flex items-center gap-3">
          <select
            value={statusValue}
            onChange={e => setStatusValue(e.target.value as OrderStatus)}
            className="text-sm border border-[#EEEBE4] rounded-lg px-3 py-2 text-[#3A3834] bg-white focus:outline-none focus:ring-2 focus:ring-[#8A7050]/30 flex-1 max-w-xs"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={handleStatusSave}
            disabled={saving || statusValue === order.status}
            className="px-4 py-2 text-sm bg-[#8A7050] text-white rounded-lg hover:bg-[#7A6040] disabled:opacity-40 transition-colors"
          >
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
          {statusMsg && (
            <span className="text-xs text-[#7A7670]">{statusMsg}</span>
          )}
        </div>
      </div>

      {/* Zwei Karten: Kunde + Zeitstrahl */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Kundendaten */}
        <div className="bg-white rounded-xl border border-[#EEEBE4] p-5">
          <h2 className="text-xs font-medium text-[#7A7670] uppercase tracking-wide mb-3">Kunde</h2>
          <div className="space-y-1.5 text-sm">
            <div className="font-medium text-[#1C1A17]">
              {order.customer_name ?? <span className="text-[#7A7670] font-normal">Kein Name</span>}
            </div>
            <div className="text-[#7A7670]">{order.customer_email ?? '—'}</div>
            {order.customer_phone && <div className="text-[#7A7670]">Tel: {order.customer_phone}</div>}
            {order.customer_company && <div className="text-[#3A3834]">{order.customer_company}</div>}
            {(order.customer_street || order.customer_zip || order.customer_city) && (
              <div className="text-[#7A7670] text-xs mt-2">
                {order.customer_street && <>{order.customer_street}<br /></>}
                {[order.customer_zip, order.customer_city].filter(Boolean).join(' ')}
              </div>
            )}
            {order.gdpr_consent_at && (
              <div className="text-xs text-green-600 mt-2">
                DSGVO-Einwilligung: {formatDateTime(order.gdpr_consent_at)}
              </div>
            )}
          </div>
        </div>

        {/* Zeitstrahl */}
        <div className="bg-white rounded-xl border border-[#EEEBE4] p-5">
          <h2 className="text-xs font-medium text-[#7A7670] uppercase tracking-wide mb-3">Zeitstrahl</h2>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-[#7A7670]">Erstellt</div>
              <div className="text-sm text-[#3A3834]">{formatDateTime(order.created_at)}</div>
            </div>
            {order.status_changed_at && (
              <div>
                <div className="text-xs text-[#7A7670]">Status geändert</div>
                <div className="text-sm text-[#3A3834]">{formatDateTime(order.status_changed_at)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Positionen */}
      <div className="bg-white rounded-xl border border-[#EEEBE4] mb-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EEEBE4]">
          <h2 className="text-sm font-medium text-[#1C1A17]">
            Positionen ({order.order_items?.length ?? 0})
          </h2>
        </div>
        {!order.order_items || order.order_items.length === 0 ? (
          <div className="p-5 text-sm text-[#7A7670]">Keine Positionen vorhanden.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAF9F7] border-b border-[#EEEBE4]">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Möbel-ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Menge</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Preis</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Währung</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Stückliste</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map((item, i) => (
                <tr
                  key={item.id}
                  className={`border-b border-[#EEEBE4] hover:bg-[#FAF9F7] transition-colors ${i === order.order_items.length - 1 ? 'border-b-0' : ''}`}
                >
                  <td className="px-4 py-3">
                    {item.config_code ? (
                      <Link
                        href={`/admin/configurations/${item.config_code}`}
                        className="font-mono text-[#8A7050] hover:underline text-xs"
                      >
                        {item.config_code}
                      </Link>
                    ) : (
                      <span className="text-[#7A7670]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#3A3834]">{item.quantity}</td>
                  <td className="px-4 py-3 text-[#3A3834]">
                    {item.unit_price != null ? formatPrice(item.unit_price, item.currency ?? 'EUR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-[#7A7670]">{item.currency ?? '—'}</td>
                  <td className="px-4 py-3">
                    {item.config_code && (
                      <a
                        href={`/api/admin/configurations/${item.config_code}/xlsx`}
                        className="text-xs text-[#8A7050] hover:underline"
                      >
                        XLS ↓
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Notiz */}
      <div className="bg-white rounded-xl border border-[#EEEBE4] p-5">
        <h2 className="text-sm font-medium text-[#1C1A17] mb-3">Notiz</h2>
        <textarea
          value={noteValue}
          onChange={e => setNoteValue(e.target.value)}
          rows={4}
          placeholder="Interne Notiz zum Auftrag…"
          className="w-full text-sm border border-[#EEEBE4] rounded-lg px-3 py-2 text-[#3A3834] placeholder-[#B0ABA5] focus:outline-none focus:ring-2 focus:ring-[#8A7050]/30 resize-none"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleNoteSave}
            disabled={savingNote}
            className="px-4 py-2 text-sm bg-[#8A7050] text-white rounded-lg hover:bg-[#7A6040] disabled:opacity-40 transition-colors"
          >
            {savingNote ? 'Speichert…' : 'Notiz speichern'}
          </button>
          {noteMsg && (
            <span className="text-xs text-[#7A7670]">{noteMsg}</span>
          )}
        </div>
      </div>

      {/* DSGVO: Kundendaten anonymisieren */}
      {order.customer_name && (
        <div className="bg-white rounded-xl border border-red-100 p-5 mt-4">
          <h2 className="text-sm font-medium text-red-600 mb-2">DSGVO — Kundendaten löschen</h2>
          <p className="text-xs text-[#7A7670] mb-3">
            Anonymisiert alle personenbezogenen Daten (Name, E-Mail, Telefon, Adresse, Notiz).
            Der Auftrag und die Stückliste bleiben erhalten.
          </p>
          <button
            onClick={async () => {
              if (!confirm('Kundendaten unwiderruflich anonymisieren? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
              try {
                const res = await fetch(`/api/admin/orders/${id}`, { method: 'DELETE' });
                if (res.ok) {
                  setOrder(prev => prev ? {
                    ...prev,
                    customer_name: null,
                    customer_email: null,
                    customer_phone: null,
                    customer_company: null,
                    customer_street: null,
                    customer_zip: null,
                    customer_city: null,
                    note: null,
                    gdpr_consent_at: null,
                  } : prev);
                  setNoteValue('');
                } else {
                  alert('Fehler beim Anonymisieren.');
                }
              } catch {
                alert('Fehler beim Anonymisieren.');
              }
            }}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Kundendaten anonymisieren
          </button>
        </div>
      )}
    </div>
  );
}
