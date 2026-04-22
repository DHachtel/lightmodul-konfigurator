'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { BOMResult, ConfigState } from '@/core/types';
import { computeBOM } from '@/core/calc';
import { FOOTER_BY_V } from '@/core/constants';
import { buildBOMRowsExtended, downloadXLSXExtended } from '@/features/bom/exportXLS';
import type { PriceLineItem, PriceResponse } from '@/core/types';
import { useUser } from '@/contexts/UserContext';
import { useMarket, fmtPrice } from '@/contexts/MarketContext';
import type { Market } from '@/contexts/MarketContext';

// -- Typen --

interface Props {
  state: ConfigState;
  committedBOM: BOMResult | null;
  moebelId: number | null;
  onCommit: (bom: BOMResult) => void;
  captureScreenshot?: () => Promise<string>;
}

type PriceInfo = { unit: number; total: number };

// -- Hilfsfunktionen --

function fmtP(v: number, sym: string, market: Market = 'DE'): string {
  return fmtPrice(v, market) + '\u202f' + sym;
}

// -- Hauptkomponente --

export default function BOMPanel({ state, committedBOM, moebelId, onCommit, captureScreenshot }: Props) {

  const bom = useMemo(() => computeBOM(state), [state]);
  const { market, currency, currencySymbol: csymGlobal } = useMarket();
  const [pricing, setPricing] = useState<PriceResponse | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preis-Lookup
  const priceLookup = useMemo(() => {
    if (!pricing) return null;
    const map = new Map<string, PriceLineItem>();
    for (const item of pricing.items) {
      const key = `${item.kategorie}|${item.dim_key ?? ''}|${item.pg ?? ''}`;
      map.set(key, item);
    }
    return map;
  }, [pricing]);

  const csym: string | undefined = priceLookup !== null ? csymGlobal : undefined;

  function pr(kat: string, dimKey: string | undefined, qty: number): PriceInfo | null {
    if (!priceLookup) return null;
    const item = priceLookup.get(`${kat}|${dimKey ?? ''}|`);
    if (!item) return null;
    return { unit: item.unit_price, total: Math.round(item.unit_price * qty * 100) / 100 };
  }

  // Preis-Fetch mit 600ms Debounce
  useEffect(() => {
    if (!bom) { setPricing(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPriceLoading(true);
      try {
        const res = await fetch('/api/bom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: state, currency }),
        });
        if (res.ok) {
          setPricing(await res.json() as PriceResponse);
        } else {
          setPricing(null);
        }
      } catch {
        setPricing(null);
      } finally {
        setPriceLoading(false);
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, currency]);

  const handleExport = useCallback(async () => {
    const exportBom = committedBOM ?? bom;
    if (!exportBom) { alert('Keine Stueckliste vorhanden.'); return; }
    try {
      const ts = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
      const { rows, overrideRows } = buildBOMRowsExtended(
        exportBom,
        pricing?.items ?? null,
        moebelId?.toString() ?? undefined,
      );
      await downloadXLSXExtended(rows, overrideRows, `Lightmodul_Stueckliste_${moebelId?.toString() ?? ts}.xlsx`);
    } catch (e) {
      alert('Fehler beim Export: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [committedBOM, bom, moebelId, pricing]);

  // Datenblatt-Export
  const [datasheetLoading, setDatasheetLoading] = useState(false);
  async function handleDatasheetExport(): Promise<void> {
    setDatasheetLoading(true);
    try {
      const screenshot3d = captureScreenshot ? await captureScreenshot() : '';
      const res = await fetch('/api/datasheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: state, screenshot3d, currency,
          moebelId: moebelId !== null ? String(moebelId) : null,
          grandTotal: pricing?.grand_total ?? 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        alert('Datenblatt-Fehler: ' + (err.error ?? res.statusText));
        return;
      }
      const blob = await res.blob();
      const ts = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
      const filename = `Lightmodul_Datenblatt_${ts}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Datenblatt-Fehler: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDatasheetLoading(false);
    }
  }

  const [pdfLoading, setPdfLoading] = useState(false);
  const hasSavedOnceRef = useRef(false);
  const isDirty = hasSavedOnceRef.current && committedBOM === null && !!bom;

  function handleCommit(): void {
    if (!bom) return;
    hasSavedOnceRef.current = true;
    onCommit(bom);
  }

  function copyMoebelId(): void {
    if (!moebelId) return;
    void navigator.clipboard.writeText(String(moebelId));
  }

  const handlePdfExport = useCallback(async () => {
    if (!bom || !pricing) { alert('Stueckliste und Preise muessen geladen sein.'); return; }
    setPdfLoading(true);
    try {
      const res = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: state, pricing }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        alert('PDF-Fehler: ' + (err.error ?? res.statusText));
        return;
      }
      const blob = await res.blob();
      const ts = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
      const filename = `Lightmodul_Angebot_${ts}.pdf`;

      if (typeof window.showSaveFilePicker === 'function') {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'PDF-Datei', accept: { 'application/pdf': ['.pdf'] } }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (e) {
          if ((e as DOMException).name === 'AbortError') return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('PDF-Fehler: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPdfLoading(false);
    }
  }, [bom, pricing, state]);

  // Kein aktives Feld
  if (!bom) {
    return (
      <div style={SIDE_STYLE}>
        <div style={{ padding: '16px 22px 14px', borderBottom: '1px solid #E0DDD7', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: 17, color: '#171614', letterSpacing: '.04em' }}>Stueckliste</div>
          <div style={{ fontSize: 10, color: '#A8A49C', marginTop: 4 }}>--</div>
        </div>
        <div style={SCROLL_STYLE}>
          <InfoBox>Alle Felder sind leer -- bitte mindestens ein Feld definieren.</InfoBox>
        </div>
      </div>
    );
  }

  const metaStr = `${bom.numCols}x${bom.numRows}x${bom.numDepth} `
    + `${bom.totalWidth}x${bom.totalHeight}x${bom.totalDepth}mm`;

  // Suppress unused var warning for pdfLoading (used in future PDF button)
  void pdfLoading;
  void handlePdfExport;

  return (
    <div style={SIDE_STYLE}>

      {/* -- Header -- */}
      <div style={{ padding: '16px 22px 14px', borderBottom: '1px solid #E0DDD7', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: 17, letterSpacing: '.04em', color: '#171614' }}>
            Stueckliste
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            <button
              onClick={handleCommit}
              disabled={!bom}
              title={isDirty ? 'Ungespeicherte Aenderungen' : 'Konfiguration speichern'}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                padding: '4px 12px', borderRadius: 0,
                cursor: bom ? 'pointer' : 'not-allowed',
                border: `1px solid ${isDirty ? '#D4A520' : '#E0DDD7'}`,
                background: isDirty ? '#FFFBEE' : 'transparent',
                color: isDirty ? '#A07010' : bom ? '#787470' : '#C8C4BC',
                whiteSpace: 'nowrap', letterSpacing: '.04em', position: 'relative',
              }}
            >
              Speichern
            </button>
            <button
              onClick={() => { void handleDatasheetExport(); }}
              disabled={!bom || datasheetLoading}
              title="Konfigurationsdatenblatt als PDF exportieren"
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                padding: '4px 12px', borderRadius: 0,
                cursor: (!bom || datasheetLoading) ? 'not-allowed' : 'pointer',
                border: '1px solid #E0DDD7', background: datasheetLoading ? '#F0EDE7' : 'transparent',
                color: (!bom || datasheetLoading) ? '#A8A49C' : '#787470',
                whiteSpace: 'nowrap', letterSpacing: '.04em',
              }}
            >
              {datasheetLoading ? '...' : 'PDF'}
            </button>
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#A8A49C', marginTop: 4, lineHeight: 1.6 }}>{metaStr}</div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => { void handleExport(); }}
            disabled={!bom}
            title="XLS-Stueckliste herunterladen"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              padding: '2px 6px', borderRadius: 1,
              cursor: bom ? 'pointer' : 'not-allowed',
              border: '1px solid #E0DDD7', background: 'transparent',
              color: bom ? '#787470' : '#C8C4BC',
              whiteSpace: 'nowrap', letterSpacing: '.04em',
            }}
          >
            XLS
          </button>
          {moebelId && (
            <>
              <span style={{ fontSize: 9, color: '#A8A49C', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                Moebel-ID
              </span>
              <button
                onClick={copyMoebelId}
                title="Moebel-ID kopieren"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
                  padding: '2px 8px', borderRadius: 1, cursor: 'pointer',
                  border: '1px solid #C8C4BC', background: '#F0EDE7',
                  color: '#171614', letterSpacing: '.06em',
                }}
              >
                {String(moebelId)}
              </button>
            </>
          )}
        </div>
      </div>

      {/* -- Scroll -- */}
      <div style={SCROLL_STYLE}>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-2 mb-[14px]">
          {[
            { id: 'wuerfel',  v: bom.wuerfel,      l: 'Wuerfel'        },
            { id: 'profile',  v: bom.profileTotal,  l: 'Profile'        },
            { id: 'frames',   v: bom.framesTotal,   l: 'Einlegerahmen'  },
            { id: 'shelves',  v: bom.shelves,       l: 'Fachboeden'     },
            { id: 'fuesse',   v: bom.footerQty,     l: 'Stellfuesse'    },
            { id: 'hardware', v: bom.schraubenM4 + bom.schraubenM6 + bom.scheiben + bom.einlegemuttern, l: 'Hardware' },
            ...(bom.fachbodenBT > 0 ? [{ id: 'bt', v: bom.fachbodenBT, l: 'Beratungstische' }] : []),
          ].map(c => (
            <div key={c.id} className="border border-gray-100 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow duration-200 text-center">
              <span className="text-3xl font-bold tracking-tight text-gray-900 block leading-none">
                {c.v}
              </span>
              <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-gray-400 mt-1">
                {c.l}
              </div>
            </div>
          ))}
        </div>

        {/* Warnungen */}
        {bom.warnings.map((w, i) => (
          <div key={i} style={WARN_STYLE}>
            <span>!</span>{w}
          </div>
        ))}

        {/* -- BOM-Gruppen -- */}

        <Group title="Alu-Wuerfel" total={bom.wuerfel} csym={csym}>
          <BRow name="Wuerfel 27mm" sub="" qty={bom.wuerfel} csym={csym}
            pi={pr('Wuerfel', undefined, bom.wuerfel)} />
        </Group>

        <Group title="Profile Breite (X)" total={bom.profileX} csym={csym}>
          <BRow name="Profil 600mm" sub="" qty={bom.profileX} csym={csym}
            pi={pr('Profil', '600', bom.profileX)} />
        </Group>

        <Group title="Profile Hoehe (Y)" total={bom.profileY} csym={csym}>
          <BRow name="Profil 600mm" sub="" qty={bom.profileY} csym={csym}
            pi={pr('Profil', '600', bom.profileY)} />
        </Group>

        <Group title="Profile Tiefe (Z)" total={bom.profileZ} csym={csym}>
          <BRow name="Profil 600mm" sub="" qty={bom.profileZ} csym={csym}
            pi={pr('Profil', '600', bom.profileZ)} />
        </Group>

        {bom.framesStd > 0 && (
          <Group title="Einlegerahmen Standard" total={bom.framesStd} csym={csym}>
            <BRow name="Rahmen RF" sub="" qty={bom.framesStd} csym={csym}
              pi={pr('Einlegerahmen', 'RF', bom.framesStd)} />
          </Group>
        )}

        {bom.framesLit > 0 && (
          <Group title="Einlegerahmen beleuchtet" total={bom.framesLit} csym={csym}>
            <BRow name="Rahmen RL" sub="" qty={bom.framesLit} csym={csym}
              pi={pr('Einlegerahmen', 'RL', bom.framesLit)} />
          </Group>
        )}

        {bom.shelves > 0 && (
          <Group title="Fachboeden" total={bom.shelves + bom.profilMitSteg} csym={csym}>
            <BRow name="Fachboden" sub="" qty={bom.shelves} csym={csym}
              pi={pr('Fachboden', undefined, bom.shelves)} />
            <BRow name="Profil mit Steg 600mm" sub="Auflage vorne + hinten" qty={bom.profilMitSteg} csym={csym}
              pi={pr('ProfilMitSteg', '600', bom.profilMitSteg)} />
          </Group>
        )}

        <Group title="Hardware" total={bom.schraubenM4 + bom.schraubenM6 + bom.scheiben + bom.einlegemuttern} csym={csym}>
          <BRow name="Senkschrauben M4x8" sub="" qty={bom.schraubenM4} csym={csym} pi={null} />
          <BRow name="Zylinderschrauben M6x40" sub="" qty={bom.schraubenM6} csym={csym} pi={null} />
          <BRow name="U-Scheiben D6,4" sub="" qty={bom.scheiben} csym={csym} pi={null} />
          <BRow name="Einlegemuttern" sub="" qty={bom.einlegemuttern} csym={csym} pi={null} />
        </Group>

        <Group title="Stellfuesse" total={bom.footerQty} csym={csym}>
          <BRow
            name={FOOTER_BY_V[state.footer]?.l ?? state.footer}
            sub=""
            qty={bom.footerQty}
            csym={csym}
            pi={pr('Stellfuesse', undefined, bom.footerQty)}
          />
        </Group>

        {bom.fachbodenBT > 0 && (
          <Group title="Beratungstisch" total={bom.fachbodenBT + bom.profil360 + bom.profil213 + bom.wuerfelBT + bom.worktopProfileX + bom.worktopProfileZ} csym={csym}>
            <BRow name="Arbeitsplatte (Fachboden)" sub="" qty={bom.fachbodenBT} csym={csym}
              pi={pr('BT_Fachboden', undefined, bom.fachbodenBT)} />
            <BRow name="Profil 360mm" sub="" qty={bom.profil360} csym={csym}
              pi={pr('BT_Profil', '360', bom.profil360)} />
            {bom.profil213 > 0 && (
              <BRow name="Profil 213mm" sub="" qty={bom.profil213} csym={csym}
                pi={pr('BT_Profil', '213', bom.profil213)} />
            )}
            <BRow name="Worktop-Profile X" sub="600mm" qty={bom.worktopProfileX} csym={csym}
              pi={pr('BT_Profil', '600', bom.worktopProfileX)} />
            <BRow name="Worktop-Profile Z" sub="600mm" qty={bom.worktopProfileZ} csym={csym}
              pi={pr('BT_Profil', '600', bom.worktopProfileZ)} />
            <BRow name="Zwischenwuerfel" sub="" qty={bom.wuerfelBT} csym={csym}
              pi={pr('BT_Wuerfel', undefined, bom.wuerfelBT)} />
          </Group>
        )}

        {bom.produktrahmen > 0 && (
          <Group title="Produktrahmen" total={bom.produktrahmen} csym={csym}>
            <BRow name="Produktrahmen LightModul" sub="" qty={bom.produktrahmen} csym={csym}
              pi={pr('Produktrahmen', undefined, bom.produktrahmen)} />
          </Group>
        )}

        {/* -- Preisberechnung -- */}
        <PriceSection pricing={pricing} loading={priceLoading} />

      </div>
    </div>
  );
}

// -- Hilfskomponenten --

function Group({ title, total, csym, children }: {
  title: string;
  total?: number;
  csym?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const hdrCols = csym ? '1fr 22px 54px 54px' : undefined;
  const hdrLabel = csym === 'CHF' ? 'CHF' : 'EUR';

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        className="hover:bg-gray-50 border-b border-gray-100"
        style={{
          fontSize: 9, textTransform: 'uppercase', letterSpacing: '.12em',
          color: '#A8A49C', padding: '5px 10px', background: '#F0EDE7',
          border: '1px solid #E0DDD7',
          borderRadius: collapsed ? 1 : '1px 1px 0 0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div
          onClick={() => setCollapsed(c => !c)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, cursor: 'pointer', userSelect: 'none' }}
        >
          <span style={{
            display: 'inline-block', fontSize: 6, lineHeight: 1,
            transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)',
            transition: 'transform 0.12s ease',
          }}>&#9654;</span>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {collapsed && total !== undefined && (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 300, color: '#171614' }}>
              {total}
            </span>
          )}
        </div>
      </div>
      {!collapsed && (
        <>
          {hdrCols && (
            <div style={{
              display: 'grid', gridTemplateColumns: hdrCols, gap: 4,
              padding: '3px 10px', border: '1px solid #E0DDD7', borderTop: 'none',
              background: '#EEE9E3',
              fontSize: 8, letterSpacing: '.08em', textTransform: 'uppercase',
              color: '#A8A49C',
            }}>
              <span>Bezeichnung</span>
              <span style={{ textAlign: 'right' }}>Menge</span>
              <span style={{ textAlign: 'right' }}>{hdrLabel}/Stk</span>
              <span style={{ textAlign: 'right' }}>Gesamt</span>
            </div>
          )}
          {children}
        </>
      )}
    </div>
  );
}

function BRow({ name, sub, qty, csym, pi }: {
  name: React.ReactNode;
  sub: string;
  qty: number;
  csym?: string;
  pi?: PriceInfo | null;
}) {
  const { market } = useMarket();
  const showPrice = csym !== undefined;
  const cols = showPrice ? '1fr 22px 54px 54px' : '1fr auto';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols, gap: showPrice ? 4 : 6,
      padding: '5px 10px', border: '1px solid #E0DDD7', borderTop: 'none',
      alignItems: 'center', background: '#FAFAF8',
      opacity: qty === 0 ? 0.3 : 1,
    }}>
      <div>
        <div style={{ fontSize: 11, color: '#36342F', lineHeight: 1.4 }}>{name}</div>
        {sub && <div style={{ fontSize: 10, color: '#787470', marginTop: 1 }}>{sub}</div>}
      </div>
      <span style={{
        fontFamily: 'var(--font-sans)',
        fontSize: qty === 0 ? 11 : 16,
        fontWeight: qty === 0 ? 300 : 400,
        color: qty === 0 ? '#A8A49C' : '#171614',
        textAlign: 'right', whiteSpace: 'nowrap',
      }}>
        {qty}
      </span>
      {showPrice && (
        <>
          <span style={PRICE_CELL}>
            {pi === undefined ? '' : pi === null ? '-' : fmtP(pi.unit, csym, market)}
          </span>
          <span style={PRICE_CELL}>
            {pi === undefined ? '' : pi === null ? '-' : fmtP(pi.total, csym, market)}
          </span>
        </>
      )}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '6px 10px', background: '#F0EDE7', border: '1px solid #E0DDD7', borderRadius: 1, marginBottom: 10, fontSize: 10, color: '#787470' }}>
      {children}
    </div>
  );
}

// -- PriceSection --

function PriceSection({ pricing, loading }: { pricing: PriceResponse | null; loading: boolean }) {
  const { user } = useUser();
  const { market, vatRate, currencySymbol } = useMarket();
  const fmt = (v: number) => fmtPrice(v, market);
  const isDealer = user?.role === 'dealer';

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #E0DDD7', paddingTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.14em', color: '#A8A49C' }}>
          Preisindikation
        </div>
        <div style={{ fontSize: 9, color: '#A8A49C', fontFamily: 'var(--font-mono)' }}>{currencySymbol}</div>
      </div>

      {loading && (
        <div style={{ fontSize: 10, color: '#A8A49C', fontFamily: 'var(--font-mono)', padding: '6px 0' }}>
          Preis wird berechnet ...
        </div>
      )}

      {!loading && !pricing && (
        <div style={{ fontSize: 10, color: '#A8A49C', padding: '4px 0' }}>--</div>
      )}

      {!loading && pricing && (
        <>
          <div style={{
            padding: '10px 12px', background: '#F5F3EE',
            border: '1px solid #E0DDD7', borderRadius: 1, marginBottom: 6,
          }}>
            {isDealer && pricing.price_type === 'EK' ? (
              <>
                <div style={{ fontSize: 9, color: '#A8A49C', marginBottom: 2 }}>Ihr EK netto</div>
                <div style={{ fontSize: 24, fontWeight: 500, color: '#171614', lineHeight: 1 }}>
                  {fmt(pricing.grand_total)}&thinsp;{currencySymbol}
                </div>
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #E0DDD7' }}>
                  {(() => {
                    const disc = pricing.active_discount_pct ?? 0;
                    const uvp = disc > 0 ? pricing.grand_total / (1 - disc) : pricing.grand_total;
                    const marge = uvp - pricing.grand_total;
                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4A4742', marginBottom: 3 }}>
                          <span>UVP netto</span>
                          <span>{fmt(uvp)}&thinsp;{currencySymbol}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#4A8C50', marginBottom: 3 }}>
                          <span>Ihre Marge ({Math.round(disc * 100)}%)</span>
                          <span>{fmt(marge)}&thinsp;{currencySymbol}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E0DDD7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, color: '#171614' }}>
                    <span>EK brutto (inkl. {market === 'CH' ? '8,1' : '19'}&thinsp;%)</span>
                    <span>{fmt(pricing.grand_total * (1 + vatRate))}&thinsp;{currencySymbol}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 24, fontWeight: 500, color: '#171614', lineHeight: 1 }}>
                  {fmt(pricing.grand_total * (1 + vatRate))}&thinsp;{currencySymbol}
                </div>
                <div style={{ fontSize: 9, color: '#A8A49C', marginTop: 4 }}>
                  inkl. MwSt. ({market === 'CH' ? '8,1' : '19'}&thinsp;%)
                </div>
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E0DDD7' }}>
                  <div style={{ fontSize: 15, fontWeight: 300, color: '#4A4742', lineHeight: 1 }}>
                    {fmt(pricing.grand_total)}&thinsp;{currencySymbol}
                  </div>
                  <div style={{ fontSize: 9, color: '#A8A49C', marginTop: 3 }}>UVP excl. MwSt.</div>
                </div>
              </>
            )}
          </div>

          {pricing.missing_items.length > 0 && (
            <div style={{
              padding: '5px 10px', background: '#FBF8EE', border: '1px solid #DDD4B0',
              borderRadius: 1, fontSize: 9, color: '#6A5A30', marginBottom: 4,
            }}>
              <span style={{ fontWeight: 500 }}>Nicht preisbewertet:</span>{' '}
              {pricing.missing_items.slice(0, 3).join(', ')}
              {pricing.missing_items.length > 3 && ` +${pricing.missing_items.length - 3} weitere`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// -- Stil-Konstanten --

const SIDE_STYLE: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#FAFAF8',
};

const SCROLL_STYLE: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '14px 20px',
};

const WARN_STYLE: React.CSSProperties = {
  padding: '5px 10px', background: '#FBF8EE', border: '1px solid #DDD4B0',
  borderRadius: 1, marginBottom: 5, fontSize: 10, color: '#6A5A30',
  display: 'flex', gap: 6,
};

const PRICE_CELL: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: '#787470',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};
