'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Login fehlgeschlagen');
        return;
      }

      router.push('/configurator');
      router.refresh();
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-36px)] flex items-center justify-center bg-[#F8F6F2] px-4">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="w-full max-w-[380px] bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-10">

        {/* Logo + Titel */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lightmodul-logo.png" alt="LIGHTMODUL" className="h-8 mb-6 opacity-80" />
        <h1 className="text-[22px] font-semibold text-[#1C1A17] mb-1 tracking-tight">Händler-Login</h1>
        <p className="text-[13px] text-[#7A7670] mb-8">Artmodul Konfigurator</p>

        {/* E-Mail */}
        <label className="block text-[11px] font-medium text-[#7A7670] uppercase tracking-widest mb-1.5">E-Mail</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 rounded-lg border border-[#E0DDD7] text-[14px] text-[#1C1A17] mb-5 focus:outline-none focus:ring-2 focus:ring-[#8A7050]/40 focus:border-[#8A7050] transition-colors bg-[#FAFAF8] placeholder:text-[#C8C4BC]"
          placeholder="name@firma.de"
          autoFocus
        />

        {/* Passwort */}
        <label className="block text-[11px] font-medium text-[#7A7670] uppercase tracking-widest mb-1.5">Passwort</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-3.5 py-2.5 rounded-lg border border-[#E0DDD7] text-[14px] text-[#1C1A17] mb-6 focus:outline-none focus:ring-2 focus:ring-[#8A7050]/40 focus:border-[#8A7050] transition-colors bg-[#FAFAF8] placeholder:text-[#C8C4BC]"
        />

        {error && (
          <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-[#1C1A17] text-white text-[14px] font-medium hover:bg-[#3A3834] disabled:opacity-40 transition-all cursor-pointer mb-5"
        >
          {loading ? 'Anmelden…' : 'Anmelden'}
        </button>

        <p className="text-[12px] text-center text-[#A8A49C]">
          Noch kein Konto?{' '}
          <Link href="/register" className="text-[#8A7050] hover:underline font-medium">
            Registrieren
          </Link>
        </p>
      </form>
    </div>
  );
}
