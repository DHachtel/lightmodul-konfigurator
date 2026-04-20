'use client';

import { useState, useRef, useEffect, useCallback, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { RotateCcw, Download, FileText, Save, Focus, Ruler } from 'lucide-react';
import { getOfferItems, addOfferItem, getOfferCount, removeOfferItem, setItemQty } from '@/lib/offerCart';
import type { CartItem } from '@/lib/offerCart';
import CartDrawer from './CartDrawer';
import QRCodeModal from './QRCodeModal';
import { useConfigStore } from './useConfigStore';
import { useDrillDown } from '@/features/preview3d/useDrillDown';
import { useLivePrice } from '@/features/bom/useLivePrice';
import { computeBOM } from '@/core/calc';
import { ELEMENT_SIZE_MM } from '@/core/constants';
import { buildBOMRowsExtended, downloadXLSXExtended } from '@/features/bom/exportXLS';
import type { ThreeCanvasHandle } from '@/features/preview3d/Preview3D';
import type { ConfigState } from '@/core/types';
// GhostSide nicht mehr benötigt — Ghost Zones arbeiten jetzt zellbasiert
import SidebarMoebel from './SidebarMoebel';
import SidebarElement from './SidebarElement';
import SidebarPlatte from './SidebarPlatte';

/** Gesamttiefe in mm (Rastermaß × Ebenen + Profil-Überhang) */
function totalDepthMM(state: ConfigState): number {
  return state.depthLayers * ELEMENT_SIZE_MM + 30;
}
import { UserProvider, useUser } from '@/contexts/UserContext';
import { MarketProvider } from '@/contexts/MarketContext';

const Preview3D = dynamic(() => import('@/features/preview3d/Preview3D'), { ssr: false });
const Breadcrumb = dynamic(() => import('@/features/preview3d/Breadcrumb'), { ssr: false });

const PANEL_W = 264;
const BG_LIGHT = '#F5F2ED';
const BG_DARK  = '#2A2825';

import { useMarket, fmtPrice as fmtPriceCtx } from '@/contexts/MarketContext';

// Gemeinsame Basis-Styles für die drei Toolbar-Buttons (Neu / Fokus / Maße)
const TOOLBAR_BTN: React.CSSProperties = {
  position: 'fixed',
  left: 16,
  zIndex: 40,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(255,255,255,0.88)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  borderRadius: 8,
  padding: '6px 14px',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-sans)',
  fontSize: 10,
  fontWeight: 500,
  color: '#6A6660',
  letterSpacing: '.04em',
  boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
  transition: 'all 0.14s ease',
  minWidth: 72,
};

function ConfiguratorShellInner() {
  const [state, actions, resetConfig] = useConfigStore();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showDimensions, setShowDimensions] = useState(false);
  const preview3DRef = useRef<ThreeCanvasHandle>(null);
  const { market, currency, vatRate, currencySymbol: csym, setMarket } = useMarket();

  const [drill, drillActions] = useDrillDown();
  const { pricing, loading: priceLoading } = useLivePrice(state, currency);

  const { user } = useUser();
  // Preise für alle Nutzer sichtbar — EK/UVP-Unterscheidung erfolgt serverseitig
  const canSeePrice = true;

  const bom = useMemo(() => computeBOM(state), [state]);

  // pgAvail placeholder — Lightmodul hat keine Oberflächenwahl
  const pgAvail: Record<string, boolean> = { pg1: true };

  // Escape-Taste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') { e.preventDefault(); drillActions.goUp(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drillActions]);

  // Ghost Zone: Grid-Erweiterung bei Rand-Ghost-Zones — nur 1 Zelle hinzufügen
  const handleExpandAndAdd = useCallback((direction: 'left' | 'right' | 'top' | 'bottom' | 'depth', atIndex: number) => {
    if (direction === 'left') {
      // Leere Spalte links einfügen, dann Zelle bei atIndex (=row) aktivieren
      actions.addColLeft();
      // Nach addColLeft ist die neue Spalte bei col=0, row=atIndex
      // setTimeout weil setState batched — setType muss nach dem Grid-Update laufen
      setTimeout(() => actions.setType(atIndex, 0, 'O'), 0);
    } else if (direction === 'right') {
      actions.addColRight();
      const newCol = state.cols.length; // nach addColRight ist das der neue Index
      setTimeout(() => actions.setType(atIndex, newCol, 'O'), 0);
    } else if (direction === 'top') {
      actions.addRowTop();
      // Nach addRowTop ist die neue Zeile bei row=0, col=atIndex
      setTimeout(() => actions.setType(0, atIndex, 'O'), 0);
    } else if (direction === 'depth') {
      actions.addDepthFront();
    }
  }, [actions, state.cols.length]);

  const handleRemoveElement = useCallback((row: number, col: number) => {
    actions.setType(row, col, '');
  }, [actions]);

  const handleAddCell = useCallback((row: number, col: number) => {
    actions.setType(row, col, 'O');
  }, [actions]);

  // ── Anfrage senden ──
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderName, setOrderName] = useState('');
  const [orderEmail, setOrderEmail] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderCompany, setOrderCompany] = useState('');
  const [orderStreet, setOrderStreet] = useState('');
  const [orderZip, setOrderZip] = useState('');
  const [orderCity, setOrderCity] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [orderGdpr, setOrderGdpr] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState('');
  const [orderMailSent, setOrderMailSent] = useState(false);

  // ── Angebots-Warenkorb ──
  const [offerCount, setOfferCount] = useState(0);
  const [offerItems, setOfferItems] = useState<CartItem[]>([]);
  const [offerLoading, setOfferLoading] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // localStorage beim Mount lesen
  useEffect(() => {
    setOfferCount(getOfferCount());
    setOfferItems(getOfferItems());
  }, []);

  const handleOrderSubmit = useCallback(async () => {
    if (!actions.moebelId) return;
    if (!orderName.trim() || !orderEmail.trim()) {
      alert('Name und E-Mail sind Pflichtfelder.');
      return;
    }
    if (!orderGdpr) {
      alert('Bitte stimmen Sie der Datenschutzerklärung zu.');
      return;
    }
    setOrderLoading(true);
    try {
      // Konfigurations-Zusammenfassung für E-Mail
      const totalW = state.cols.reduce((a, b) => a + b, 0) + 30;
      const totalH = state.rows.reduce((a, b) => a + b, 0) + 30;
      const configSummary = `${state.cols.length}×${state.rows.length}, ${totalW} × ${totalH} × ${totalDepthMM(state)} mm`;

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configCodes: offerItems.length > 0
            ? offerItems.flatMap(item => Array(item.qty).fill(item.code) as number[])
            : [actions.moebelId],
          customerName: orderName,
          customerEmail: orderEmail,
          customerPhone: orderPhone || undefined,
          customerCompany: orderCompany || undefined,
          customerStreet: orderStreet || undefined,
          customerZip: orderZip || undefined,
          customerCity: orderCity || undefined,
          note: orderNote || undefined,
          currency,
          gdprConsent: true,
          configSummary,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        alert(err.error ?? 'Anfrage fehlgeschlagen');
        return;
      }
      const data = await res.json() as { orderNr: string; mailSent?: boolean };
      setOrderSuccess(data.orderNr);
      setOrderMailSent(data.mailSent ?? false);
      setShowOrderModal(false);
      // Felder zurücksetzen
      setOrderName(''); setOrderEmail(''); setOrderPhone('');
      setOrderCompany(''); setOrderStreet(''); setOrderZip('');
      setOrderCity(''); setOrderNote(''); setOrderGdpr(false);
    } catch {
      alert('Anfrage fehlgeschlagen');
    } finally {
      setOrderLoading(false);
    }
  }, [actions.moebelId, orderName, orderEmail, orderPhone, orderCompany, orderStreet, orderZip, orderCity, orderNote, orderGdpr, currency, state.cols, state.rows, state.depthLayers, offerItems]);

  // ── Speichern ──
  const [saveLoading, setSaveLoading] = useState(false);

  const handleCommit = useCallback(async () => {
    if (!bom) return;
    setSaveLoading(true);
    try {
      actions.commitBOM(bom);
      const screenshot = preview3DRef.current
        ? await preview3DRef.current.captureScreenshot(1600, 900)
        : undefined;
      const res = await fetch('/api/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: state, screenshot, bom }),
      });
      if (!res.ok) throw new Error('Save failed');
      const { code } = await res.json() as { code: number };
      actions.setMoebelId(code);
    } catch {
      alert('Speichern fehlgeschlagen');
    } finally {
      setSaveLoading(false);
    }
  }, [bom, actions, state]);

  // ── URL-Parameter: Konfiguration beim Mount laden ──
  const searchParams = useSearchParams();
  const debugMode = searchParams.get('debug') === 'true';
  const router = useRouter();

  // Markt aus URL-Parameter übernehmen (?market=CH)
  useEffect(() => {
    const mp = searchParams.get('market')?.toUpperCase();
    if (mp === 'CH' || mp === 'DE') setMarket(mp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const configCode = searchParams.get('config');
    if (!configCode || !/^\d{8}$/.test(configCode)) return;

    fetch(`/api/config/load?code=${configCode}`)
      .then(res => {
        if (!res.ok) return;
        return res.json();
      })
      .then((data: { config?: unknown } | undefined) => {
        if (data?.config) {
          actions.loadConfig(data.config as ConfigState, Number(configCode));
          router.replace('/', { scroll: false });
        }
      })
      .catch(() => {
        // Fehler ignorieren
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lade-Eingabe ──
  const [loadCode, setLoadCode] = useState('');
  const [loadError, setLoadError] = useState('');

  const handleLoad = useCallback(async () => {
    if (!/^\d{8}$/.test(loadCode)) {
      setLoadError('8-stellige Zahl eingeben');
      return;
    }
    try {
      const res = await fetch(`/api/config/load?code=${loadCode}`);
      if (!res.ok) { setLoadError('Nicht gefunden'); return; }
      const data = await res.json() as { config?: unknown };
      if (data?.config) {
        actions.loadConfig(data.config as ConfigState, Number(loadCode));
        setLoadCode('');
        setLoadError('');
      }
    } catch {
      setLoadError('Ladefehler');
    }
  }, [loadCode, actions]);

  // ── XLS-Export — bevorzugt committedBOM, Fallback auf Live-BOM ──
  const handleXlsExport = useCallback(async () => {
    const exportBom = actions.committedBOM ?? bom;
    if (!exportBom) { alert('Keine Stückliste vorhanden.'); return; }
    const ts = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
    const { rows, overrideRows } = buildBOMRowsExtended(
      exportBom,
      pricing?.items ?? null,
      actions.moebelId !== null ? String(actions.moebelId) : undefined,
    );
    await downloadXLSXExtended(rows, overrideRows, `Lightmodul_Stueckliste_${actions.moebelId !== null ? String(actions.moebelId) : ts}.xlsx`);
  }, [actions.committedBOM, actions.moebelId, bom, pricing]);

  // ── Datenblatt-Export ──
  const [datasheetLoading, setDatasheetLoading] = useState(false);
  const handleDatasheet = useCallback(async () => {
    setDatasheetLoading(true);
    try {
      const screenshot3d = preview3DRef.current ? await preview3DRef.current.captureScreenshot(1600, 900) : '';
      const res = await fetch('/api/datasheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: state, screenshot3d, currency,
          moebelId: actions.moebelId,
          grandTotal: pricing?.grand_total ?? 0,
          includePrice: canSeePrice,
        }),
      });
      if (!res.ok) { alert('Datenblatt-Fehler'); return; }
      const blob = await res.blob();
      const ts = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Lightmodul_Datenblatt_${ts}.pdf`;
      a.click();
    } catch (e) {
      alert('Fehler: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDatasheetLoading(false);
    }
  }, [state, currency, actions.moebelId, pricing?.grand_total, canSeePrice]);

  // ── PDF-Download ──
  const handlePdfDownload = useCallback(async () => {
    const codes = offerItems.length > 0
      ? offerItems.map(i => i.code)
      : actions.moebelId ? [actions.moebelId] : [];
    if (codes.length === 0) return;
    setOfferLoading(true);
    try {
      const res = await fetch('/api/offer/multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configCodes: codes, currency }),
      });
      if (!res.ok) { alert('PDF-Fehler'); return; }
      const blob = await res.blob();
      const oc = res.headers.get('X-Offer-Code') ?? 'angebot';
      const ts = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Lightmodul_Angebot_${oc}_${ts}.pdf`;
      a.click();
    } catch { alert('Exportfehler'); }
    finally { setOfferLoading(false); }
  }, [offerItems, actions.moebelId, currency]);

  // Aktive Möbelmaße
  const totalMM = (() => {
    const numRows = state.rows.length, numCols = state.cols.length;
    let minR = numRows, maxR = -1, minC = numCols, maxC = -1;
    for (let r = 0; r < numRows; r++)
      for (let c = 0; c < numCols; c++)
        if (state.grid[r]?.[c]?.[0]?.type ?? "" !== '') {
          if (r < minR) minR = r; if (r > maxR) maxR = r;
          if (c < minC) minC = c; if (c > maxC) maxC = c;
        }
    if (maxR < 0) return { w: state.cols.reduce((a, b) => a + b, 0), h: state.rows.reduce((a, b) => a + b, 0), aC: numCols, aR: numRows };
    return {
      w: state.cols.slice(minC, maxC + 1).reduce((a, b) => a + b, 0),
      h: state.rows.slice(minR, maxR + 1).reduce((a, b) => a + b, 0),
      aC: maxC - minC + 1,
      aR: maxR - minR + 1,
    };
  })();

  const netTotal = pricing?.grand_total ?? 0;
  const grossTotal = netTotal + netTotal * vatRate;

  const BTN: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 12px', borderRadius: 6, border: 'none',
    fontSize: 10, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'var(--font-sans)', letterSpacing: '.04em',
    transition: 'opacity 0.14s ease',
  };

  return (
    <UserProvider>
    <div style={{ width: '100vw', height: 'calc(100vh - 36px)', overflow: 'hidden', position: 'relative', background: theme === 'dark' ? BG_DARK : BG_LIGHT, transition: 'background 0.4s ease' }}>

      {/* ════════════════════════════════════════
          CANVAS
          ════════════════════════════════════════ */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Preview3D
          ref={preview3DRef}
          state={state}
          bgColor={theme === 'dark' ? BG_DARK : BG_LIGHT}
          onPlateClick={drillActions.handlePlateClick}
          onMeshClick={drillActions.handleMeshClick}
          onMiss={drillActions.handleMiss}
          drillLevel={drill.level}
          selectedCell={drill.selectedCell}
          selectedPlateId={drill.selectedPlateId}
          onGhostClick={handleAddCell}
          onExpandAndAdd={handleExpandAndAdd}
          onRemoveElement={handleRemoveElement}
          onAddCell={handleAddCell}
          onSetCol={actions.setCol}
          onSetRow={actions.setRow}
          showDimensions={showDimensions}
          debugMode={debugMode}
        />
        <Breadcrumb
          level={drill.level}
          selectedCell={drill.selectedCell}
          selectedPlateType={drill.selectedPlateType}
          onGoToLevel={drillActions.goToLevel}
        />
      </div>

      {/* ════════════════════════════════════════
          HEADER — Logo zentriert, Maße + Buttons symmetrisch
          ════════════════════════════════════════ */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 60, zIndex: 50,
        display: 'flex', alignItems: 'center', padding: '0 24px',
        background: 'rgba(23,22,20,0.88)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Links: Maße + Möbel laden + Händler-Login */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.14)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
            {totalMM.aC}×{totalMM.aR} · {totalMM.w + 30} × {totalMM.h + 30} × {totalDepthMM(state)} mm
          </span>
          {/* Möbel laden per ID */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="text"
              value={loadCode}
              onChange={e => { setLoadCode(e.target.value.replace(/\D/g, '').slice(0, 8)); setLoadError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { void handleLoad(); } }}
              placeholder="#Möbel-ID"
              style={{
                width: 80, padding: '4px 8px', fontSize: 11, fontFamily: 'monospace',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6, color: 'rgba(255,255,255,0.8)', outline: 'none',
                borderColor: loadError ? '#e05050' : 'rgba(255,255,255,0.15)',
              }}
              title={loadError || 'Gespeicherte Konfiguration laden (8-stellige ID)'}
            />
            <button
              onClick={() => { void handleLoad(); }}
              disabled={loadCode.length !== 8}
              title="Konfiguration laden"
              style={{
                ...BTN,
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.65)',
                opacity: loadCode.length !== 8 ? 0.3 : 1,
                padding: '4px 10px',
              }}
            >
              <Download size={12} strokeWidth={2} />
            </button>
          </div>
          <UserPill />
        </div>

        {/* Mitte: Logo */}
        <a href="https://www.mhz.de" target="_blank" rel="noopener noreferrer"
          style={{ position: 'absolute', left: '50%', bottom: 12, transform: 'translateX(-50%)', display: 'flex', alignItems: 'flex-end', textDecoration: 'none' }}>
          <span style={{ fontSize: 22, fontWeight: 300, letterSpacing: '0.04em', color: '#fff' }}>
            <span style={{ color: '#ccc' }}>MHZ</span>
            {' '}
            <span style={{ color: '#2dd4bf' }}>L</span>
            <span style={{ color: '#ccc' }}>ight</span>
            <span style={{ color: '#ef4444' }}>M</span>
            <span style={{ color: '#ccc' }}>odul</span>
          </span>
        </a>

        {/* Rechts: Aktions-Buttons */}
        <div style={{ display: 'flex', gap: 6, flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
          <button
            onClick={() => { void handleCommit(); }}
            disabled={!bom || saveLoading}
            title="Konfiguration speichern"
            style={{
              ...BTN,
              background: 'rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.85)',
              opacity: !bom || saveLoading ? 0.3 : 1,
            }}
          >
            <Save size={12} strokeWidth={2} />
            {saveLoading ? '...' : 'Speichern'}
          </button>

          {actions.moebelId && (
            <button
              onClick={() => { void navigator.clipboard.writeText(String(actions.moebelId)); }}
              title="Möbel-ID kopieren"
              style={{
                ...BTN,
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.65)',
                fontSize: 11,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              #{actions.moebelId}
            </button>
          )}

          {/* XLS-Export — immer aktiv wenn BOM vorhanden */}
          <button
            onClick={() => { void handleXlsExport(); }}
            disabled={!bom}
            title="XLS-Stückliste herunterladen"
            style={{
              ...BTN,
              background: 'rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.65)',
              opacity: !bom ? 0.3 : 1,
              padding: '4px 8px',
            }}
          >
            <Download size={12} strokeWidth={2} />
            <span style={{ fontSize: 9, letterSpacing: '.04em' }}>XLS</span>
          </button>

          {/* In den Warenkorb */}
          {actions.moebelId && (
            <button
              onClick={() => {
                addOfferItem(actions.moebelId!);
                setOfferCount(getOfferCount());
                setOfferItems(getOfferItems());
              }}
              title="In den Warenkorb"
              style={{
                ...BTN,
                background: 'rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.85)',
              }}
            >
              + Warenkorb
            </button>
          )}

          {/* Warenkorb öffnen */}
          {offerCount > 0 && (
            <button
              onClick={() => setCartOpen(true)}
              style={{
                ...BTN,
                background: 'rgba(138,112,80,0.3)',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              Warenkorb ({offerCount})
            </button>
          )}

          {/* Anfrage senden (ohne Warenkorb — nur aktuelles Möbel) */}
          {actions.moebelId && offerCount === 0 && (
            <button
              onClick={() => setShowOrderModal(true)}
              title="Anfrage senden"
              style={{
                ...BTN,
                background: 'rgba(138,112,80,0.3)',
                color: 'rgba(255,255,255,0.9)',
              }}
            >
              Anfrage senden
            </button>
          )}

          {/* Angebots-PDF — nur Dealer/Admin */}
          {actions.moebelId && canSeePrice && (
            <button
              onClick={handlePdfDownload}
              disabled={offerLoading}
              title="Angebot als PDF"
              style={{
                ...BTN,
                background: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.65)',
                padding: '4px 8px',
              }}
            >
              <FileText size={12} strokeWidth={2} />
              <span style={{ fontSize: 9, letterSpacing: '.04em' }}>Angebot</span>
            </button>
          )}
        </div>
      </header>

      {/* ════════════════════════════════════════
          ANFRAGE-MODAL
          ════════════════════════════════════════ */}
      {showOrderModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowOrderModal(false); }}
        >
          <div style={{
            background: '#F5F2ED', borderRadius: 12,
            boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
            padding: '28px 28px 24px', width: 460, maxWidth: '100%',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            {/* Modal-Header mit Möbel-Info */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#1C1A17', fontFamily: 'var(--font-sans)' }}>
                Anfrage senden
              </h3>
              {offerItems.length > 1 ? (
                <div style={{ fontSize: 11, color: '#7A7670', fontFamily: 'var(--font-sans)' }}>
                  <strong style={{ color: '#1C1A17' }}>{offerItems.length} Möbel</strong> in dieser Anfrage:
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {offerItems.map(item => (
                      <span key={item.code} style={{
                        fontVariantNumeric: 'tabular-nums', color: '#1C1A17',
                        background: '#EEEBE4', borderRadius: 4, padding: '2px 6px', fontSize: 10,
                      }}>
                        #{item.code}{item.qty > 1 ? ` ×${item.qty}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#7A7670', fontFamily: 'var(--font-sans)' }}>
                  Möbel-ID <strong style={{ fontVariantNumeric: 'tabular-nums', color: '#1C1A17' }}>#{actions.moebelId}</strong>
                  {' · '}
                  {state.cols.length}×{state.rows.length},&nbsp;
                  {state.cols.reduce((a, b) => a + b, 0) + 30} × {state.rows.reduce((a, b) => a + b, 0) + 30} × {totalDepthMM(state)} mm
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {/* Name + E-Mail (Pflichtfelder) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#7A7670', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 4 }}>
                    Name <span style={{ color: '#C0392B' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={orderName}
                    onChange={(e) => setOrderName(e.target.value)}
                    placeholder="Vor- und Nachname"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '8px 10px', borderRadius: 6,
                      border: '1px solid #EEEBE4', fontSize: 12,
                      fontFamily: 'var(--font-sans)', color: '#1C1A17',
                      background: '#fff', outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#7A7670', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 4 }}>
                    E-Mail <span style={{ color: '#C0392B' }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={orderEmail}
                    onChange={(e) => setOrderEmail(e.target.value)}
                    placeholder="ihre@email.de"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '8px 10px', borderRadius: 6,
                      border: '1px solid #EEEBE4', fontSize: 12,
                      fontFamily: 'var(--font-sans)', color: '#1C1A17',
                      background: '#fff', outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Telefon + Firma (optional) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#7A7670', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 4 }}>
                    Telefon <span style={{ color: '#A8A49C', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={orderPhone}
                    onChange={(e) => setOrderPhone(e.target.value)}
                    placeholder="+49 123 456789"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '8px 10px', borderRadius: 6,
                      border: '1px solid #EEEBE4', fontSize: 12,
                      fontFamily: 'var(--font-sans)', color: '#1C1A17',
                      background: '#fff', outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#7A7670', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 4 }}>
                    Firma <span style={{ color: '#A8A49C', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={orderCompany}
                    onChange={(e) => setOrderCompany(e.target.value)}
                    placeholder="Firmenname"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '8px 10px', borderRadius: 6,
                      border: '1px solid #EEEBE4', fontSize: 12,
                      fontFamily: 'var(--font-sans)', color: '#1C1A17',
                      background: '#fff', outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Adresse (optional) */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#7A7670', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 4 }}>
                  Straße &amp; Hausnummer <span style={{ color: '#A8A49C', fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={orderStreet}
                  onChange={(e) => setOrderStreet(e.target.value)}
                  placeholder="Musterstraße 12"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '8px 10px', borderRadius: 6,
                    border: '1px solid #EEEBE4', fontSize: 12,
                    fontFamily: 'var(--font-sans)', color: '#1C1A17',
                    background: '#fff', outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 11 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#7A7670', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 4 }}>
                    PLZ
                  </label>
                  <input
                    type="text"
                    value={orderZip}
                    onChange={(e) => setOrderZip(e.target.value)}
                    placeholder="12345"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '8px 10px', borderRadius: 6,
                      border: '1px solid #EEEBE4', fontSize: 12,
                      fontFamily: 'var(--font-sans)', color: '#1C1A17',
                      background: '#fff', outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 500, color: '#7A7670', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 4 }}>
                    Ort
                  </label>
                  <input
                    type="text"
                    value={orderCity}
                    onChange={(e) => setOrderCity(e.target.value)}
                    placeholder="Musterstadt"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '8px 10px', borderRadius: 6,
                      border: '1px solid #EEEBE4', fontSize: 12,
                      fontFamily: 'var(--font-sans)', color: '#1C1A17',
                      background: '#fff', outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Kommentar (optional) */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 500, color: '#7A7670', fontFamily: 'var(--font-sans)', display: 'block', marginBottom: 4 }}>
                  Kommentar <span style={{ color: '#A8A49C', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Anmerkungen zur Konfiguration, Lieferwunsch etc."
                  rows={3}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '8px 10px', borderRadius: 6,
                    border: '1px solid #EEEBE4', fontSize: 12,
                    fontFamily: 'var(--font-sans)', color: '#1C1A17',
                    background: '#fff', outline: 'none', resize: 'vertical',
                  }}
                />
              </div>

              {/* DSGVO-Checkbox */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={orderGdpr}
                  onChange={(e) => setOrderGdpr(e.target.checked)}
                  style={{ marginTop: 2, accentColor: '#8A7050', flexShrink: 0 }}
                />
                <span style={{ fontSize: 11, color: '#7A7670', fontFamily: 'var(--font-sans)', lineHeight: 1.5 }}>
                  Ich habe die{' '}
                  <a
                    href="/datenschutz"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#8A7050', textDecoration: 'underline' }}
                  >
                    Datenschutzerklärung
                  </a>
                  {' '}gelesen und stimme der Verarbeitung meiner Daten zur Bearbeitung meiner Anfrage zu.{' '}
                  <span style={{ color: '#C0392B' }}>*</span>
                </span>
              </label>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowOrderModal(false)}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: '1px solid #EEEBE4',
                  background: '#fff', color: '#7A7670', fontSize: 12, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={() => { void handleOrderSubmit(); }}
                disabled={!orderName.trim() || !orderEmail.trim() || !orderGdpr || orderLoading}
                style={{
                  padding: '8px 18px', borderRadius: 6, border: 'none',
                  background: (!orderName.trim() || !orderEmail.trim() || !orderGdpr || orderLoading)
                    ? 'rgba(138,112,80,0.3)'
                    : '#8A7050',
                  color: '#fff', fontSize: 12, fontWeight: 600,
                  cursor: (!orderName.trim() || !orderEmail.trim() || !orderGdpr || orderLoading) ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  opacity: (!orderName.trim() || !orderEmail.trim() || !orderGdpr || orderLoading) ? 0.6 : 1,
                  transition: 'background 0.14s ease, opacity 0.14s ease',
                }}
              >
                {orderLoading ? 'Wird gesendet...' : 'Anfrage absenden'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          ANFRAGE-ERFOLG-TOAST
          ════════════════════════════════════════ */}
      {orderSuccess && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 200,
          background: '#1C1A17', color: '#FAFAF8',
          borderRadius: 12, padding: '16px 20px',
          boxShadow: '0 4px 28px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column', gap: 8,
          fontFamily: 'var(--font-sans)',
          maxWidth: 340, minWidth: 280,
        }}>
          {/* Header-Zeile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Häkchen-Icon */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(80,180,120,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#6BD89A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#FAFAF8' }}>
                Anfrage erfolgreich gesendet
              </span>
            </div>
            <button
              onClick={() => setOrderSuccess('')}
              style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)',
                cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>

          {/* Bestellnummer */}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
            Anfrage-Nr.{' '}
            <strong style={{ fontVariantNumeric: 'tabular-nums', color: '#FAFAF8', fontSize: 13 }}>
              {orderSuccess}
            </strong>
          </div>

          {/* E-Mail-Status */}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
            {orderMailSent
              ? 'Eine Bestätigungs-E-Mail wurde versendet.'
              : 'Ihre Anfrage wurde gespeichert. Wir melden uns in Kürze.'}
          </div>

          {/* Schließen-Button */}
          <button
            onClick={() => setOrderSuccess('')}
            style={{
              marginTop: 4, alignSelf: 'flex-end',
              padding: '5px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.18)',
              background: 'transparent', color: 'rgba(255,255,255,0.7)',
              fontSize: 11, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', transition: 'border-color 0.12s ease',
            }}
          >
            Schließen
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════
          NEU BUTTON — oben links
          ════════════════════════════════════════ */}
      <button
        onClick={() => { if (confirm('Konfiguration zurücksetzen?')) { resetConfig(); drillActions.goToLevel('moebel'); } }}
        style={{ ...TOOLBAR_BTN, top: 108 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#171614'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#6A6660'; }}
      >
        <RotateCcw size={12} strokeWidth={2} />
        Neu
      </button>

      {/* ════════════════════════════════════════
          FOKUS BUTTON — oben links
          ════════════════════════════════════════ */}
      <button
        onClick={() => {
          preview3DRef.current?.resetCamera();
          drillActions.goToLevel('moebel');
        }}
        style={{ ...TOOLBAR_BTN, top: 146 }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#171614'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#6A6660'; }}
      >
        <Focus size={12} strokeWidth={2} />
        Fokus
      </button>

      {/* ════════════════════════════════════════
          MAßE BUTTON — oben links
          ════════════════════════════════════════ */}
      <button
        onClick={() => setShowDimensions(d => !d)}
        style={{
          ...TOOLBAR_BTN,
          top: 184,
          background: showDimensions ? '#171614' : 'rgba(255,255,255,0.88)',
          color: showDimensions ? '#FAFAF8' : '#6A6660',
        }}
        onMouseEnter={(e) => { if (!showDimensions) e.currentTarget.style.color = '#171614'; }}
        onMouseLeave={(e) => { if (!showDimensions) e.currentTarget.style.color = '#6A6660'; }}
      >
        <Ruler size={12} strokeWidth={2} />
        Maße
      </button>

      {/* ════════════════════════════════════════
          AR-VORSCHAU BUTTON — oben links, unter Maße (immer sichtbar)
          ════════════════════════════════════════ */}
      <button
        onClick={() => { if (actions.moebelId) setShowQR(true); }}
        disabled={!actions.moebelId}
        title={actions.moebelId ? 'AR-Vorschau — Möbel im Raum platzieren' : 'Möbel zuerst speichern, um AR-Vorschau zu nutzen'}
        style={{
          ...TOOLBAR_BTN,
          top: 242,
          background: actions.moebelId ? 'rgba(138,112,80,0.15)' : 'rgba(200,196,188,0.5)',
          color: actions.moebelId ? '#8A7050' : '#B0ABA5',
          border: actions.moebelId ? '1px solid rgba(138,112,80,0.3)' : '1px solid rgba(200,196,188,0.4)',
          cursor: actions.moebelId ? 'pointer' : 'not-allowed',
          opacity: actions.moebelId ? 1 : 0.6,
        }}
        onMouseEnter={(e) => { if (actions.moebelId) e.currentTarget.style.background = 'rgba(138,112,80,0.25)'; }}
        onMouseLeave={(e) => { if (actions.moebelId) e.currentTarget.style.background = 'rgba(138,112,80,0.15)'; }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="8" height="8" rx="1" />
          <rect x="14" y="2" width="8" height="8" rx="1" />
          <rect x="2" y="14" width="8" height="8" rx="1" />
          <path d="M14 14h2v2h-2zm4 0h2v2h-2zm-4 4h2v2h-2zm4 4h2v-2h-2zm0-4h2v2h-2z" fill="currentColor" stroke="none" />
        </svg>
        AR
      </button>

      {/* ════════════════════════════════════════
          LIGHT / DARK TOGGLE — unten links
          ════════════════════════════════════════ */}
      <div style={{
        position: 'fixed', bottom: 24, left: 24, zIndex: 40,
        display: 'flex',
        background: theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(23,22,20,0.82)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        borderRadius: 99, padding: 3, gap: 2,
        boxShadow: '0 4px 20px rgba(0,0,0,0.22)',
        transition: 'background 0.3s ease',
      }}>
        {(['light', 'dark'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            style={{
              fontFamily: 'var(--font-sans)', fontWeight: 500,
              fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase',
              padding: '7px 18px', borderRadius: 99, border: 'none',
              background: theme === t ? (t === 'dark' ? '#3A3835' : '#FAFAF8') : 'transparent',
              color: theme === t ? (t === 'dark' ? '#E8E5E0' : '#171614') : (theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.45)'),
              cursor: 'pointer', transition: 'background 0.14s ease, color 0.14s ease',
            }}
          >
            {t === 'light' ? '☀' : '☾'}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════
          RECHTE SIDEBAR — Konfiguration
          ════════════════════════════════════════ */}
      <aside style={{
        position: 'fixed', top: 60, right: 0, bottom: 0, zIndex: 40,
        width: PANEL_W,
        background: '#ffffff',
        borderLeft: '1px solid #E8E5E0',
        display: 'flex', flexDirection: 'column',
        overflowX: 'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {drill.level === 'platte' && drill.selectedPlateId && drill.selectedPlateType ? (
            <SidebarPlatte state={state} actions={actions} plateId={drill.selectedPlateId} plateType={drill.selectedPlateType} />
          ) : drill.level === 'element' && drill.selectedCell ? (
            <SidebarElement state={state} actions={actions} row={drill.selectedCell.row} col={drill.selectedCell.col} />
          ) : (
            <SidebarMoebel state={state} actions={actions} pgAvail={pgAvail} />
          )}
        </div>

        {/* ── Preis-Block: Netto / MwSt / Brutto — unten in der Sidebar ── */}
        <div style={{
          padding: '12px 20px 16px', borderTop: '1px solid #E8E5E0',
          background: '#FAFAF8', flexShrink: 0,
        }}>
          {priceLoading && (
            <span style={{ fontSize: 10, color: '#A8A49C' }}>Berechne...</span>
          )}

          {!priceLoading && netTotal > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8A8680' }}>
                <span>Netto</span>
                <span>{fmtPriceCtx(netTotal, market)}&thinsp;{csym}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8A8680' }}>
                <span>MwSt. {market === 'CH' ? '8,1%' : '19%'}</span>
                <span>{fmtPriceCtx(netTotal * vatRate, market)}&thinsp;{csym}</span>
              </div>
              <div style={{ height: 1, background: '#E8E5E0', margin: '2px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, color: '#171614' }}>
                <span>Brutto</span>
                <span>{fmtPriceCtx(grossTotal, market)}&thinsp;{csym}</span>
              </div>
            </div>
          )}

          {!priceLoading && netTotal === 0 && pricing && (
            <span style={{ fontSize: 10, color: '#C8C4BC' }}>Kein Preis verfügbar</span>
          )}
        </div>
      </aside>

      {/* ════════════════════════════════════════
          WARENKORB DRAWER
          ════════════════════════════════════════ */}
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={offerItems}
        onUpdateQty={(code, qty) => {
          setItemQty(code, qty);
          setOfferCount(getOfferCount());
          setOfferItems(getOfferItems());
        }}
        onRemove={(code) => {
          removeOfferItem(code);
          setOfferCount(getOfferCount());
          setOfferItems(getOfferItems());
        }}
        onSubmitInquiry={() => {
          setCartOpen(false);
          setShowOrderModal(true);
        }}
        onDownloadPdf={handlePdfDownload}
        pdfLoading={offerLoading}
      />

      {/* ════════════════════════════════════════
          QR-CODE MODAL (AR-Vorschau)
          ════════════════════════════════════════ */}
      {showQR && actions.moebelId && (
        <QRCodeModal moebelId={actions.moebelId} onClose={() => setShowQR(false)} />
      )}

    </div>
    </UserProvider>
  );
}

function UserPill() {
  const { user, loading, logout } = useUser();

  if (loading) return null;

  if (!user) {
    return (
      <a
        href="/login"
        style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', whiteSpace: 'nowrap' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
      >
        Händler-Login
      </a>
    );
  }

  const dotColor = user.role === 'dealer' ? '#4ADE80' : user.role === 'admin' ? '#60A5FA' : '#9CA3AF';
  const roleLabel = user.role === 'dealer' ? 'Händler' : user.role === 'admin' ? 'Admin' : null;
  const emailShort = user.email.length > 20 ? user.email.slice(0, 18) + '\u2026' : user.email;
  const discountLabel = user.role === 'dealer' && user.discountPct > 0
    ? `${Math.round(user.discountPct * 100)}%`
    : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      borderRadius: 20, padding: '3px 12px',
      fontSize: 10, color: 'rgba(255,255,255,0.75)', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
      {roleLabel && <span style={{ fontWeight: 500 }}>{roleLabel}</span>}
      <span style={{ color: 'rgba(255,255,255,0.5)' }}>{emailShort}</span>
      {discountLabel && <span style={{ color: 'rgba(255,255,255,0.5)' }}>&middot;&nbsp;{discountLabel}</span>}
      <button
        onClick={() => { void logout(); }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)', fontSize: 10, padding: 0,
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
      >
        Logout
      </button>
    </div>
  );
}

export default function ConfiguratorShell() {
  return (
    <MarketProvider>
    <Suspense fallback={null}>
      <ConfiguratorShellInner />
    </Suspense>
    </MarketProvider>
  );
}
