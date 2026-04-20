import type { Metadata } from 'next';
import { Cormorant_Garamond, Jost, DM_Mono } from 'next/font/google';
import './globals.css';
import CookieBanner from '@/components/CookieBanner';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-serif',
  display: 'swap',
});

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-sans',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'LIGHTMODUL — Konfigurator',
  description: 'Präsentationssystem-Konfigurator für das Lightmodul-System von MHZ Hachtel GmbH',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${cormorant.variable} ${jost.variable} ${dmMono.variable}`}>
      <body>
        {children}
        <footer className="w-full h-9 shrink-0 border-t border-[#DDDAD3] bg-[#F8F6F2] px-4 flex items-center justify-between text-[10px] text-[#7A7670]">
          <span>&copy; {new Date().getFullYear()} MHZ Hachtel GmbH</span>
          <div className="flex gap-4">
            <a href="/impressum" className="hover:text-[#8A7050] hover:underline">Impressum</a>
            <a href="/datenschutz" className="hover:text-[#8A7050] hover:underline">Datenschutz</a>
          </div>
        </footer>
        <CookieBanner />
      </body>
    </html>
  );
}
