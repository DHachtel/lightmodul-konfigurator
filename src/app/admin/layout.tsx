'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/orders', label: 'Aufträge' },
  { href: '/admin/customers', label: 'Kunden' },
  { href: '/admin/configurations', label: 'Konfigurationen' },
  { href: '/admin/prices', label: 'Preisliste' },
  { href: '/admin/articles', label: 'Artikelstamm' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // Login-Seite bekommt kein Layout
  if (pathname === '/admin/login') return <>{children}</>;

  const handleLogout = async () => {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  return (
    <div className="min-h-screen flex bg-[#F8F6F2]">
      {/* Sidebar */}
      <aside className="w-56 bg-[#1C1A17] text-white flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-white/10">
          <div className="text-xs tracking-widest text-[#C4AE8C] uppercase">Artmodul</div>
          <div className="text-sm font-semibold mt-0.5">Admin</div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map(item => {
            const active = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-5 py-2.5 text-xs tracking-wide transition-colors ${
                  active
                    ? 'bg-white/10 text-[#C4AE8C]'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => { void handleLogout(); }}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Abmelden
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
