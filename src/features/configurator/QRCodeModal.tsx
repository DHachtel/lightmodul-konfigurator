'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeModalProps {
  moebelId: number;
  onClose: () => void;
}

export default function QRCodeModal({ moebelId, onClose }: QRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const arUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/ar?config=${moebelId}`
    : `/ar?config=${moebelId}`;

  useEffect(() => {
    if (canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, arUrl, {
        width: 256,
        margin: 2,
        color: { dark: '#1C1A17', light: '#FFFFFF' },
      });
    }
  }, [arUrl]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16, padding: '32px 36px',
          maxWidth: 340, width: '100%', textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 16,
            background: 'none', border: 'none', fontSize: 20,
            color: '#999', cursor: 'pointer',
          }}
        >×</button>

        <div style={{ fontSize: 14, fontWeight: 600, color: '#1C1A17', marginBottom: 4 }}>
          AR-Vorschau
        </div>
        <div style={{ fontSize: 11, color: '#7A7670', marginBottom: 16 }}>
          Möbel #{String(moebelId).padStart(8, '0')}
        </div>

        <canvas ref={canvasRef} style={{ margin: '0 auto', display: 'block', borderRadius: 8 }} />

        <div style={{ fontSize: 11, color: '#7A7670', marginTop: 16, lineHeight: 1.6 }}>
          QR-Code mit dem Handy scannen.<br />
          Das Möbel wird mit korrekten Maßen<br />
          in Ihrem Raum angezeigt.
        </div>

        <button
          onClick={() => { void navigator.clipboard.writeText(arUrl); }}
          style={{
            marginTop: 12, padding: '6px 16px', borderRadius: 6,
            border: '1px solid #E8E5E0', background: '#FAFAF8',
            fontSize: 10, color: '#7A7670', cursor: 'pointer',
          }}
        >
          Link kopieren
        </button>
      </div>
    </div>
  );
}
