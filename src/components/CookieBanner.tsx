'use client';

import { useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'lightmodul_cookie_ok';

export default function CookieBanner() {
  // Lazy-Initialisierung: Banner nur anzeigen wenn kein Cookie gesetzt ist.
  // Kein useEffect nötig — localStorage ist im Client-Kontext beim ersten Render verfügbar.
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !localStorage.getItem(STORAGE_KEY);
  });

  function accept() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#1C1A17] text-white px-4 py-3 flex items-center justify-between gap-4 text-xs shadow-lg">
      <p>
        Diese Seite verwendet ausschließlich technisch notwendige Cookies.{' '}
        <Link href="/datenschutz" className="underline hover:text-[#D4C5A9]">
          Mehr erfahren
        </Link>
      </p>
      <button
        onClick={accept}
        className="shrink-0 px-4 py-1.5 bg-white text-[#1C1A17] rounded font-medium hover:bg-[#F0EDE8] transition-colors"
      >
        Verstanden
      </button>
    </div>
  );
}
