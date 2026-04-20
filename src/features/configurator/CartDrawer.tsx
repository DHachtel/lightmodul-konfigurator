'use client';

import { useEffect, useState, useRef } from 'react';
import type { CartItem } from '@/lib/offerCart';

interface ThumbnailInfo {
  code: number;
  screenshot: string | null;
  summary: string;
  netPrice?: number;
}

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQty: (code: number, qty: number) => void;
  onRemove: (code: number) => void;
  onSubmitInquiry: () => void;
  onDownloadPdf: () => void;
  pdfLoading: boolean;
}

/** Preis formatieren */
function fmtPrice(v: number): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' \u20AC';
}

/** Slide-in Warenkorb-Panel von rechts */
export default function CartDrawer({
  open,
  onClose,
  items,
  onUpdateQty,
  onRemove,
  onSubmitInquiry,
  onDownloadPdf,
  pdfLoading,
}: CartDrawerProps) {
  const [thumbnails, setThumbnails] = useState<Map<number, ThumbnailInfo>>(new Map());
  const fetchedCodesRef = useRef<string>('');

  // Thumbnails laden wenn Drawer geöffnet wird
  useEffect(() => {
    if (!open || items.length === 0) return;
    const codes = items.map(i => i.code);
    const key = [...codes].sort().join(',');
    if (fetchedCodesRef.current === key) return;
    fetchedCodesRef.current = key;

    let cancelled = false;
    fetch(`/api/config/thumbnails?codes=${codes.join(',')}`)
      .then(res => {
        if (!res.ok) return [];
        return res.json() as Promise<ThumbnailInfo[]>;
      })
      .then(data => {
        if (cancelled || !data) return;
        setThumbnails(prev => {
          const next = new Map(prev);
          for (const item of data) next.set(item.code, item);
          return next;
        });
      })
      .catch(() => {
        // Fehler ignorieren — Thumbnails sind optional
      });
    return () => { cancelled = true; };
  }, [open, items]);

  // Escape-Taste schließt Drawer
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const totalPieces = items.reduce((sum, i) => sum + i.qty, 0);

  // Gesamtpreis berechnen
  const totalNet = items.reduce((sum, i) => {
    const price = thumbnails.get(i.code)?.netPrice ?? 0;
    return sum + price * i.qty;
  }, 0);

  const BTN_PRIMARY: React.CSSProperties = {
    width: '100%', padding: '10px 0', borderRadius: 6, border: 'none',
    background: '#8A7050', color: '#fff', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-sans)', letterSpacing: '.02em',
    transition: 'opacity 0.14s ease',
  };

  const BTN_SECONDARY: React.CSSProperties = {
    width: '100%', padding: '9px 0', borderRadius: 6,
    border: '1px solid #E8E5E0', background: '#fff',
    color: '#7A7670', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
    transition: 'border-color 0.14s ease',
  };

  const QTY_BTN: React.CSSProperties = {
    width: 24, height: 24, borderRadius: 4, border: '1px solid #E8E5E0',
    background: '#FAFAF8', color: '#1C1A17', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'var(--font-sans)', lineHeight: 1, padding: 0,
    transition: 'border-color 0.12s ease',
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 190,
          background: 'rgba(0,0,0,0.35)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 200,
          width: 380, maxWidth: '100vw',
          background: '#ffffff',
          borderLeft: '1px solid #E8E5E0',
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: open ? '-8px 0 40px rgba(0,0,0,0.12)' : 'none',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px', borderBottom: '1px solid #E8E5E0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h2 style={{
            margin: 0, fontSize: 15, fontWeight: 600, color: '#1C1A17',
            fontFamily: 'var(--font-sans)',
          }}>
            Warenkorb
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: '#7A7670',
              cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 6px',
            }}
          >
            &times;
          </button>
        </div>

        {/* Artikelliste */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {items.length === 0 && (
            <p style={{ color: '#A8A49C', fontSize: 12, fontFamily: 'var(--font-sans)', textAlign: 'center', marginTop: 40 }}>
              Warenkorb ist leer
            </p>
          )}

          {items.map(item => {
            const thumb = thumbnails.get(item.code);
            return (
              <div
                key={item.code}
                style={{
                  display: 'flex', gap: 12, padding: '12px 0',
                  borderBottom: '1px solid #F2EFE9',
                  alignItems: 'flex-start',
                }}
              >
                {/* Thumbnail */}
                <div style={{
                  width: 80, height: 45, borderRadius: 6, overflow: 'hidden',
                  background: '#F2EFE9', flexShrink: 0,
                }}>
                  {thumb?.screenshot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb.screenshot}
                      alt={`Möbel #${item.code}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#C8C4BC', fontSize: 10, fontFamily: 'var(--font-sans)',
                    }}>
                      —
                    </div>
                  )}
                </div>

                {/* Info + Steuerung */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: 12, fontWeight: 600,
                      color: '#1C1A17', fontVariantNumeric: 'tabular-nums',
                    }}>
                      #{item.code}
                    </span>
                    {/* Entfernen */}
                    <button
                      onClick={() => onRemove(item.code)}
                      title="Entfernen"
                      style={{
                        background: 'none', border: 'none', color: '#C8C4BC',
                        cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px',
                        transition: 'color 0.12s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#C0392B'; }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#C8C4BC'; }}
                    >
                      &times;
                    </button>
                  </div>

                  {thumb?.summary && (
                    <p style={{
                      margin: '2px 0 8px', fontSize: 10, color: '#7A7670',
                      fontFamily: 'var(--font-sans)', lineHeight: 1.4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {thumb.summary}
                    </p>
                  )}
                  {!thumb?.summary && (
                    <div style={{ height: 8 }} />
                  )}

                  {/* Mengen-Steuerung + Preis */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => onUpdateQty(item.code, item.qty - 1)}
                        style={QTY_BTN}
                      >
                        &minus;
                      </button>
                      <span style={{
                        fontSize: 12, fontWeight: 600, color: '#1C1A17',
                        fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-sans)',
                        minWidth: 20, textAlign: 'center',
                      }}>
                        {item.qty}
                      </span>
                      <button
                        onClick={() => onUpdateQty(item.code, item.qty + 1)}
                        style={QTY_BTN}
                      >
                        +
                      </button>
                    </div>
                    {/* Einzelpreis × Menge */}
                    {(thumb?.netPrice ?? 0) > 0 && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: '#1C1A17',
                        fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-sans)',
                      }}>
                        {fmtPrice((thumb?.netPrice ?? 0) * item.qty)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px 20px', borderTop: '1px solid #E8E5E0',
          background: '#FAFAF8', flexShrink: 0,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {items.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <p style={{
                margin: '0 0 4px', fontSize: 11, color: '#7A7670',
                fontFamily: 'var(--font-sans)', textAlign: 'center',
              }}>
                {items.length} {items.length === 1 ? 'Möbel' : 'Möbel'}, {totalPieces} {totalPieces === 1 ? 'Stück' : 'Stück'}
              </p>
              {totalNet > 0 && (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                  padding: '6px 0 2px', borderTop: '1px solid #E8E5E0', marginTop: 4,
                }}>
                  <span style={{ fontSize: 11, color: '#7A7670', fontFamily: 'var(--font-sans)' }}>
                    Netto gesamt
                  </span>
                  <span style={{
                    fontSize: 14, fontWeight: 700, color: '#1C1A17',
                    fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-sans)',
                  }}>
                    {fmtPrice(totalNet)}
                  </span>
                </div>
              )}
            </div>
          )}

          <button
            onClick={onSubmitInquiry}
            disabled={items.length === 0}
            style={{
              ...BTN_PRIMARY,
              opacity: items.length === 0 ? 0.4 : 1,
              cursor: items.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Anfrage senden
          </button>

          <button
            onClick={onDownloadPdf}
            disabled={items.length === 0 || pdfLoading}
            style={{
              ...BTN_SECONDARY,
              opacity: (items.length === 0 || pdfLoading) ? 0.4 : 1,
              cursor: (items.length === 0 || pdfLoading) ? 'not-allowed' : 'pointer',
            }}
          >
            {pdfLoading ? 'PDF wird erstellt...' : 'PDF erstellen'}
          </button>
        </div>
      </div>
    </>
  );
}
