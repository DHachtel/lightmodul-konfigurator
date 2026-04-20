'use client';

import { useEffect, useState, useCallback } from 'react';
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
  created_at: string;
  order_items: OrderItem[];
}

interface ApiResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
}

// Status-Anzeige-Konfiguration
const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  draft:     { label: 'Entwurf',       className: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'Eingegangen',   className: 'bg-blue-50 text-blue-700' },
  confirmed: { label: 'Bestätigt',     className: 'bg-green-50 text-green-700' },
  completed: { label: 'Abgeschlossen', className: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Storniert',     className: 'bg-red-50 text-red-600' },
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '',          label: 'Alle Status' },
  { value: 'draft',     label: 'Entwurf' },
  { value: 'submitted', label: 'Eingegangen' },
  { value: 'confirmed', label: 'Bestätigt' },
  { value: 'completed', label: 'Abgeschlossen' },
  { value: 'cancelled', label: 'Storniert' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter) params.set('status', statusFilter);

    try {
      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data: ApiResponse = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } catch {
      // Fehler ignorieren
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  // Bei Filter-Änderung zurück zur ersten Seite
  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-[#1C1A17]">Aufträge</h1>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={e => handleStatusChange(e.target.value)}
            className="text-sm border border-[#EEEBE4] rounded-lg px-3 py-2 text-[#3A3834] bg-white focus:outline-none focus:ring-2 focus:ring-[#8A7050]/30"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#EEEBE4] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[#7A7670] text-sm">Lädt…</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-[#7A7670] text-sm">Keine Aufträge gefunden.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#EEEBE4] bg-[#FAF9F7]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Auftragsnr.</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Kunde</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Positionen</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[#7A7670] uppercase tracking-wide">Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, i) => {
                const statusCfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.draft;
                return (
                  <tr
                    key={order.id}
                    className={`border-b border-[#EEEBE4] hover:bg-[#FAF9F7] transition-colors ${i === orders.length - 1 ? 'border-b-0' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-[#8A7050] hover:underline font-medium"
                      >
                        {order.order_nr}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#3A3834]">
                      {order.customer_name ?? <span className="text-[#7A7670]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-[#3A3834]">
                      {order.order_items?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-[#7A7670]">
                      {formatDate(order.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Seitennavigation */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-[#7A7670]">
            {total} Auftrag{total !== 1 ? 'e' : ''} gesamt
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
