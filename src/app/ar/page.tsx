import { Suspense } from 'react';
import ARViewer from './ARViewer';

export const metadata = {
  title: 'AR-Vorschau — Lightmodul Konfigurator',
};

export default function ARPage() {
  return (
    <Suspense fallback={
      <div style={{
        width: '100vw', height: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: '#F5F2ED', fontFamily: '-apple-system, Arial, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1A17', marginBottom: 8 }}>
            Lightmodul AR
          </div>
          <div style={{ fontSize: 12, color: '#7A7670' }}>Lade Konfiguration…</div>
        </div>
      </div>
    }>
      <ARViewer />
    </Suspense>
  );
}
