'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Profile {
  id: string;
  email: string;
  role: string;
  company: string | null;
  contact_name: string | null;
  phone: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  discount_pct: number;
  approved_at: string | null;
  created_at: string;
  notes: string | null;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Formular-State
  const [role, setRole] = useState('customer');
  const [discountPct, setDiscountPct] = useState(30);
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('DE');
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/customers/${id}`);
      if (!res.ok) { router.push('/admin/customers'); return; }
      const data = await res.json() as { profile: Profile };
      const p = data.profile;
      setProfile(p);
      setRole(p.role);
      setDiscountPct(Math.round(p.discount_pct * 100));
      setCompany(p.company ?? '');
      setContactName(p.contact_name ?? '');
      setPhone(p.phone ?? '');
      setStreet(p.street ?? '');
      setZip(p.zip ?? '');
      setCity(p.city ?? '');
      setCountry(p.country ?? 'DE');
      setNotes(p.notes ?? '');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          discount_pct: discountPct / 100,
          company,
          contact_name: contactName,
          phone,
          street,
          zip,
          city,
          country,
          notes,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-[#A8A49C]">Laden…</div>;
  }

  if (!profile) {
    return <div className="text-sm text-[#A8A49C]">Kunde nicht gefunden.</div>;
  }

  const INPUT = 'w-full px-3.5 py-2.5 rounded-lg border border-[#E0DDD7] text-[13px] text-[#1C1A17] bg-[#FAFAF8] focus:outline-none focus:ring-2 focus:ring-[#8A7050]/40 focus:border-[#8A7050] transition-colors';
  const LABEL = 'block text-[11px] font-medium text-[#7A7670] uppercase tracking-widest mb-1.5';

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/admin/customers')}
          className="text-xs text-[#7A7670] hover:text-[#1C1A17]"
        >
          ← Kunden
        </button>
        <h1 className="text-xl font-semibold text-[#1C1A17]">
          {profile.company || profile.email}
        </h1>
      </div>

      {/* Sektion: Konto */}
      <section className="bg-white rounded-xl border border-[#EEEBE4] p-6 mb-4">
        <h2 className="text-xs font-medium text-[#A8A49C] uppercase tracking-widest mb-4">Konto</h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className={LABEL}>E-Mail</label>
            <div className="px-3.5 py-2.5 rounded-lg bg-[#F0EDE7] text-[13px] text-[#7A7670]">
              {profile.email}
            </div>
          </div>
          <div>
            <label className={LABEL}>Rolle</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className={INPUT}
            >
              <option value="customer">Customer</option>
              <option value="dealer">Händler</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {role === 'dealer' && (
          <div className="mb-4">
            <label className={LABEL}>Rabatt (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={discountPct}
              onChange={e => setDiscountPct(parseInt(e.target.value) || 0)}
              className={`${INPUT} w-32`}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-[12px] text-[#A8A49C]">
          <div>Registriert: {formatDate(profile.created_at)}</div>
          {profile.approved_at && <div>Freigeschaltet: {formatDate(profile.approved_at)}</div>}
        </div>
      </section>

      {/* Sektion: Stammdaten */}
      <section className="bg-white rounded-xl border border-[#EEEBE4] p-6 mb-4">
        <h2 className="text-xs font-medium text-[#A8A49C] uppercase tracking-widest mb-4">Stammdaten</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>Firma</label>
            <input type="text" value={company} onChange={e => setCompany(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Ansprechpartner</label>
            <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Telefon</label>
            <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>Straße</label>
            <input type="text" value={street} onChange={e => setStreet(e.target.value)} className={INPUT} />
          </div>
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <div>
              <label className={LABEL}>PLZ</label>
              <input type="text" value={zip} onChange={e => setZip(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Ort</label>
              <input type="text" value={city} onChange={e => setCity(e.target.value)} className={INPUT} />
            </div>
          </div>
          <div>
            <label className={LABEL}>Land</label>
            <input type="text" value={country} onChange={e => setCountry(e.target.value)} className={INPUT} />
          </div>
        </div>
      </section>

      {/* Sektion: Intern */}
      <section className="bg-white rounded-xl border border-[#EEEBE4] p-6 mb-6">
        <h2 className="text-xs font-medium text-[#A8A49C] uppercase tracking-widest mb-4">Intern</h2>
        <label className={LABEL}>Notizen</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className={`${INPUT} resize-y`}
          placeholder="Interne Notizen…"
        />
      </section>

      {/* Footer */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { void handleSave(); }}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg bg-[#1C1A17] text-white text-[13px] font-medium hover:bg-[#3A3834] disabled:opacity-40 transition-colors"
        >
          {saving ? 'Speichern…' : 'Speichern'}
        </button>
        {saved && (
          <span className="text-[13px] text-green-700 font-medium">
            Änderungen gespeichert
          </span>
        )}
      </div>
    </div>
  );
}
