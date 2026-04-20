'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Login fehlgeschlagen');
        return;
      }
      router.push('/admin');
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F6F2]">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-lg font-semibold text-[#1C1A17] mb-1">Admin-Zugang</h1>
        <p className="text-xs text-[#7A7670] mb-6">Artmodul Konfigurator</p>

        <label className="block text-xs font-medium text-[#3A3834] mb-1">Benutzer</label>
        <input
          type="text"
          value={user}
          onChange={e => setUser(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#DDDAD3] text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
          autoFocus
        />

        <label className="block text-xs font-medium text-[#3A3834] mb-1">Passwort</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[#DDDAD3] text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-[#8A7050]"
        />

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg bg-[#1C1A17] text-white text-sm font-medium hover:bg-[#3A3834] disabled:opacity-50 transition-colors"
        >
          {loading ? 'Anmelden...' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
}
