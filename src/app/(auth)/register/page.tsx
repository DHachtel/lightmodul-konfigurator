'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createClient();

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { company: company.trim() || undefined },
        },
      });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('Diese E-Mail ist bereits registriert.');
        } else {
          setError(signUpError.message);
        }
        return;
      }

      setSuccess(true);
    } catch {
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-[calc(100vh-36px)] flex items-center justify-center bg-[#F8F6F2] px-4">
        <div className="w-full max-w-[380px] bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-10 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#F0EDE7] flex items-center justify-center text-xl">
            &#9993;
          </div>
          <h1 className="text-lg font-semibold text-[#1C1A17] mb-2">
            Bestätigung gesendet
          </h1>
          <p className="text-[13px] text-[#7A7670] mb-6 leading-relaxed">
            Bitte prüfen Sie Ihre E-Mail und klicken Sie auf den Bestätigungslink.
          </p>
          <Link
            href="/login"
            className="text-[13px] text-[#8A7050] hover:underline font-medium"
          >
            Zurück zum Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-36px)] flex items-center justify-center bg-[#F8F6F2] px-4">
      <form onSubmit={(e) => { void handleSubmit(e); }} className="w-full max-w-[380px] bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-10">

        {/* Logo + Titel */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lightmodul-logo.png" alt="LIGHTMODUL" className="h-8 mb-6 opacity-80" />
        <h1 className="text-[22px] font-semibold text-[#1C1A17] mb-1 tracking-tight">Registrierung</h1>
        <p className="text-[13px] text-[#7A7670] mb-8">Händler-Zugang beantragen</p>

        {/* Firma */}
        <label className="block text-[11px] font-medium text-[#7A7670] uppercase tracking-widest mb-1.5">Firma</label>
        <input
          type="text"
          value={company}
          onChange={e => setCompany(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-[#E0DDD7] text-[14px] text-[#1C1A17] mb-5 focus:outline-none focus:ring-2 focus:ring-[#8A7050]/40 focus:border-[#8A7050] transition-colors bg-[#FAFAF8] placeholder:text-[#C8C4BC]"
          placeholder="Optional"
        />

        {/* E-Mail */}
        <label className="block text-[11px] font-medium text-[#7A7670] uppercase tracking-widest mb-1.5">E-Mail</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 rounded-lg border border-[#E0DDD7] text-[14px] text-[#1C1A17] mb-5 focus:outline-none focus:ring-2 focus:ring-[#8A7050]/40 focus:border-[#8A7050] transition-colors bg-[#FAFAF8] placeholder:text-[#C8C4BC]"
          placeholder="name@firma.de"
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
          placeholder="Mind. 6 Zeichen"
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
          {loading ? 'Wird erstellt…' : 'Konto erstellen'}
        </button>

        <p className="text-[12px] text-center text-[#A8A49C]">
          Bereits registriert?{' '}
          <Link href="/login" className="text-[#8A7050] hover:underline font-medium">
            Anmelden
          </Link>
        </p>
      </form>
    </div>
  );
}
