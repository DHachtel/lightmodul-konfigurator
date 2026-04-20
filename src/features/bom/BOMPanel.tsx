// @ts-nocheck — Artmodul-Legacydatei, wird in Phase 1 auf Lightmodul umgebaut
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { BomCatOverride, BOMResult, ConfigState, DimMap } from '@/core/types';
// renderOffscreenSnapshot entfernt — Canvas-Screenshot via captureScreenshot-Prop
import { computeBOM } from '@/core/calc';
import { CABLE_HOLE_ART_NR, FOOTER_BY_V, MAT_BY_V, MATERIALS } from '@/core/constants';
import { buildBOMRowsExtended, downloadXLSXExtended } from '@/features/bom/exportXLS';
import { validateCatOverrides } from '@/core/validation';
import { sortEntries } from '@/lib/utils';
import type { PriceLineItem, PriceResponse } from '@/core/types';
import { useUser } from '@/contexts/UserContext';
import { useMarket, fmtPrice } from '@/contexts/MarketContext';
import type { Market } from '@/contexts/MarketContext';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface Props {
  state: ConfigState;
  setCatOverride: (catKey: string, override: BomCatOverride) => void;
  clearCatOverride: (catKey: string) => void;
  committedBOM: BOMResult | null;
  moebelId: number | null;
  onCommit: (bom: BOMResult) => void;
  captureScreenshot?: () => Promise<string>;
}

type PriceInfo = { unit: number; total: number };

// ── Modul-Hilfsfunktionen ─────────────────────────────────────────────────────

function fmtP(v: number, sym: string, market: Market = 'DE'): string {
  return fmtPrice(v, market) + '\u202f' + sym;
}

function sumDimMap(m: DimMap): number {
  return Object.values(m).reduce((a, b) => a + b, 0);
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function BOMPanel({ state, setCatOverride, clearCatOverride, committedBOM, moebelId, onCommit, captureScreenshot }: Props) {

  const bom = useMemo(() => computeBOM(state), [state]);
  const [openCat,    setOpenCat]    = useState<string | null>(null);
  const [editAnzahl, setEditAnzahl] = useState<string>('');    // X — leer = kein Override
  const [editSurf,   setEditSurf]   = useState<string>('');    // Oberflächen-Code, leer = kein Override
  const [editKabel,  setEditKabel]  = useState<boolean>(false);
  const { market, currency, currencySymbol: csymGlobal } = useMarket();
  const [pricing,    setPricing]    = useState<PriceResponse | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mat    = state.surface;
  const matObj = MAT_BY_V[mat];
  const pg     = matObj?.pg ?? '—';

  // Y-Werte pro Kategorie aus computeBOM
  const catY = useMemo<Record<string, number>>(() => {
    if (!bom) return {};
    const y: Record<string, number> = {
      boden:             bom.bStdT,
      klappenboden:      bom.bKlT,
      ruecken:           bom.rT,
      seite_aussen:      bom.sAT,
      seite_aussen_sy32: bom.sATsy,
      seite_innen:       bom.sIT,
      seite_innen_sy32:  bom.sITsy,
      fachboden:         bom.fbT,
    };
    for (const [typ, m] of Object.entries(bom.fMap)) {
      y[`front_${typ}`] = sumDimMap(m);
    }
    return y;
  }, [bom]);

  // Dev-Modus: catOverride X > Y prüfen
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !bom) return;
    const warnings = validateCatOverrides(state);
    if (warnings.length > 0) console.warn('[BOMPanel] catOverride-Validierung:', warnings);
  }, [state.catOverrides, catY, bom]);

  // Preis-Lookup aufbauen sobald Pricing-Daten vorliegen
  // Key: "kategorie|dim_key|pg" — pg differenziert Varianten mit verschiedener Oberfläche
  const priceLookup = useMemo(() => {
    if (!pricing) return null;
    const map = new Map<string, PriceLineItem>();
    for (const item of pricing.items) {
      const key = `${item.kategorie}|${item.dim_key ?? ''}|${item.pg ?? ''}`;
      map.set(key, item);
    }
    return map;
  }, [pricing]);

  // Währungssymbol — nur wenn Preise geladen
  const csym: string | undefined =
    priceLookup !== null ? csymGlobal : undefined;

  // Preisinfo für eine BOM-Zeile ermitteln
  function pr(kat: string, dimKey: string | undefined, qty: number, pg?: string): PriceInfo | null {
    if (!priceLookup) return null;
    const item = priceLookup.get(`${kat}|${dimKey ?? ''}|${pg ?? ''}`);
    if (!item) return null;
    const up = item.unit_price;
    return { unit: up, total: Math.round(up * qty * 100) / 100 };
  }

  // Gruppensumme aus pricing.subtotals
  function subtl(...kats: string[]): number | undefined {
    if (!pricing) return undefined;
    return kats.reduce((s, k) => s + (pricing.subtotals[k] ?? 0), 0);
  }

  // Profilgruppen-Summe direkt aus priceLookup
  function profileST(pMap: Record<string, number>): number | null | undefined {
    if (!priceLookup) return undefined;
    let sum = 0;
    for (const [len, qty] of Object.entries(pMap)) {
      const item = priceLookup.get(`Profil|${len}`);
      if (!item) return null;
      sum += item.unit_price * qty;
    }
    return Math.round(sum * 100) / 100;
  }

  // Edit-Panel öffnen für eine Kategorie
  function openCatEdit(catKey: string): void {
    const existing = state.catOverrides[catKey];

    setOpenCat(catKey);
    setEditAnzahl(existing ? String(existing.anzahl) : '');
    setEditSurf(existing?.oberflaeche ?? '');
    setEditKabel(existing?.kabel ?? false);
  }

  function closeCatEdit(): void {
    setOpenCat(null);
    setEditAnzahl('');
    setEditSurf('');
    setEditKabel(false);
  }

  function saveCatOverride(): void {
    if (!openCat) return;
    const y = catY[openCat] ?? 0;
    const x = Math.min(Math.max(1, parseInt(editAnzahl) || 1), y);
    setCatOverride(openCat, { anzahl: x, oberflaeche: editSurf, kabel: editKabel });
    closeCatEdit();
  }

  function clearCatEdit(catKey: string): void {
    clearCatOverride(catKey);
    closeCatEdit();
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
    // Bevorzugt committedBOM, Fallback auf Live-BOM für manuelle Prüfung
    const exportBom = committedBOM ?? bom;
    if (!exportBom) { alert('Keine Stückliste vorhanden.'); return; }
    try {
      const ts = new Date().toLocaleDateString('de-DE').replace(/\./g, '-');
      const { rows, overrideRows } = buildBOMRowsExtended(
        exportBom, mat, matObj, state.bomOverrides, exportBom.catOverrides, boardVariants,
        pricing?.items ?? null,
        moebelId?.toString() ?? undefined,
      );
      await downloadXLSXExtended(rows, overrideRows, `Lightmodul_Stueckliste_${moebelId?.toString() ?? ts}.xlsx`);
    } catch (e) {
      alert('Fehler beim Export: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [committedBOM, bom, moebelId, mat, matObj, state.bomOverrides, boardVariants, pricing]);

  // ── Datenblatt-Export State ───────────────────────────────────────────────
  const [datasheetLoading, setDatasheetLoading] = useState(false);

  // Datenblatt-Export: Offscreen-Render → API → PDF-Download
  async function handleDatasheetExport(): Promise<void> {
    setDatasheetLoading(true);
    try {
      // Screenshot vom Live-Canvas (mit GLB-Modellen, Environment, etc.)
      const screenshot3d = captureScreenshot ? await captureScreenshot() : '';

      const res = await fetch('/api/datasheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: state,
          screenshot3d,
          currency,
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
  // Merken ob mindestens einmal gespeichert wurde, um Dirty-Dot nach Änderungen anzuzeigen
  const hasSavedOnceRef = useRef(false);
  const isDirty = hasSavedOnceRef.current && committedBOM === null && !!bom;

  function handleCommit(): void {
    if (!bom) return;
    hasSavedOnceRef.current = true;
    onCommit(bom);
  }

  // Möbel-ID in Zwischenablage kopieren
  function copyMoebelId(): void {
    if (!moebelId) return;
    void navigator.clipboard.writeText(String(moebelId));
  }

  const handlePdfExport = useCallback(async () => {
    if (!bom || !pricing) { alert('Stückliste und Preise müssen geladen sein.'); return; }
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

      // Speichern-unter-Dialog (Chrome/Edge); Fallback auf anchor-Download (Firefox)
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
          // Fallback bei unerwarteten Fehlern
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('PDF-Fehler: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setPdfLoading(false);
    }
  }, [bom, pricing, state]);

  // ── Kein aktives Feld ──────────────────────────────────────────────────────
  if (!bom) {
    return (
      <div style={SIDE_STYLE}>
        <div style={{ padding: '16px 22px 14px', borderBottom: '1px solid #E0DDD7', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: 17, color: '#171614', letterSpacing: '.04em' }}>Stückliste</div>
          <div style={{ fontSize: 10, color: '#A8A49C', marginTop: 4 }}>—</div>
        </div>
        <div style={SCROLL_STYLE}>
          <InfoBox>Alle Felder sind leer — bitte mindestens ein Feld definieren.</InfoBox>
        </div>
      </div>
    );
  }

  const kleinteile = bom.bolzen * 4 + bom.klemm;
  const metaStr = `${bom.Bact}×${bom.Hact} · `
    + `${bom.activeCols.reduce((a, b) => a + b, 0) + 30}×`
    + `${bom.activeRows.reduce((a, b) => a + b, 0) + 30}×`
    + `${bom.D + 30}mm Außenmaß`
    + (mat !== 'none' ? ` · ${mat} (${pg})` : '');

  // Inline-Edit-Panel für eine Kategorie
  function CatEditPanel({ catKey }: { catKey: string }) {
    const y = catY[catKey] ?? 0;
    const xNum = editAnzahl === '' ? null : parseInt(editAnzahl);
    const xValid = xNum !== null && !isNaN(xNum) && xNum >= 1 && xNum <= y;
    const canSave = xValid && editSurf !== '';

    return (
      <div style={{
        padding: '10px 12px', border: '1px solid #E0DDD7', borderTop: 'none',
        background: '#F5F3EE', display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontSize: 9, color: '#A8A49C', textTransform: 'uppercase', letterSpacing: '.1em' }}>
          Abweichende Oberfläche
        </div>

        {/* X / Y Felder */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <div style={{ fontSize: 9, color: '#A8A49C', letterSpacing: '.06em' }}>Anzahl (X)</div>
            <input
              type="number"
              min={1}
              max={y}
              value={editAnzahl}
              placeholder="—"
              onChange={e => {
                const v = e.target.value;
                if (v === '') { setEditAnzahl(''); return; }
                const n = parseInt(v);
                if (!isNaN(n)) setEditAnzahl(String(Math.min(Math.max(1, n), y)));
              }}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                background: '#FAFAF8', border: '1px solid #E0DDD7', color: '#36342F',
                borderRadius: 0, padding: '3px 6px', outline: 'none', width: '100%',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <div style={{ fontSize: 9, color: '#A8A49C', letterSpacing: '.06em' }}>Gesamt (Y)</div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              background: '#ECEAE5', border: '1px solid #E0DDD7', color: '#A8A49C',
              padding: '3px 6px', userSelect: 'none',
            }}>
              {y}
            </div>
          </div>
        </div>

        {/* Oberflächen-Dropdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 9, color: '#A8A49C', letterSpacing: '.06em' }}>Abweichende Oberfläche</div>
          <select
            value={editSurf}
            onChange={e => setEditSurf(e.target.value)}
            disabled={!xValid}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              background: '#FAFAF8', border: '1px solid #E0DDD7', color: '#36342F',
              borderRadius: 0, padding: '3px 4px', outline: 'none',
              width: '100%',
              cursor: xValid ? 'pointer' : 'not-allowed',
              opacity: xValid ? 1 : 0.45,
            }}
          >
            <option value="">— Bitte wählen</option>
            {MATERIALS.filter(m => m.v !== 'none').map(m => (
              <option key={m.v} value={m.v}>{m.l} · {m.pg}</option>
            ))}
          </select>
        </div>

        {/* Kabel-Checkbox */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: xValid ? '#36342F' : '#A8A49C',
          cursor: xValid ? 'pointer' : 'not-allowed',
        }}>
          <input
            type="checkbox"
            checked={editKabel}
            onChange={e => setEditKabel(e.target.checked)}
            disabled={!xValid}
            style={{ cursor: xValid ? 'pointer' : 'not-allowed', accentColor: '#36342F' }}
          />
          Kabeldurchlass ⌀ 80mm (X Bauteile)
        </label>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 5 }}>
          <button
            onClick={saveCatOverride}
            disabled={!canSave}
            style={{ ...EDIT_OK_BTN, opacity: canSave ? 1 : 0.45, cursor: canSave ? 'pointer' : 'not-allowed' }}
          >
            Übernehmen
          </button>
          <button onClick={() => clearCatEdit(catKey)} style={EDIT_CLR_BTN}>Zurücksetzen</button>
        </div>

        {/* Info: wie die Split-Logik wirkt */}
        {canSave && xNum !== null && xNum < y && (
          <div style={{ fontSize: 9, color: '#787470', lineHeight: 1.5 }}>
            → {xNum} Stk: {MAT_BY_V[editSurf]?.l ?? editSurf}
            <br />→ {y - xNum} Stk: {matObj?.l ?? mat} (Standard)
          </div>
        )}
        {canSave && xNum === y && (
          <div style={{ fontSize: 9, color: '#787470', lineHeight: 1.5 }}>
            → alle {y} Stk: {MAT_BY_V[editSurf]?.l ?? editSurf}
          </div>
        )}
      </div>
    );
  }

  // Varianten-Zeilen: eine BOM-Zeile pro (Kategorie × Dimension × Oberfläche × Kabel)
  function VariantRows({ kategorien }: { kategorien: string[] }) {
    const filtered = boardVariants.filter(v => kategorien.includes(v.kategorie));
    if (filtered.length === 0) return null;
    return (
      <>
        {filtered.map(v => {
          const dimLabel = `${v.dim}mm`;
          const surfNote = v.surfaceLabel !== (matObj?.l ?? '') ? v.surfaceLabel : '';
          return (
            <BRow
              key={`${v.kategorie}|${v.dim}|${v.surfaceCode}|${v.hasCable ? '1' : '0'}`}
              name={
                <>
                  {v.label} <Hl>{dimLabel}</Hl>
                  {surfNote && <span style={{ fontSize: 9, background: '#F0EAD6', padding: '0 4px', borderRadius: 1, color: '#7A5A20', marginLeft: 4 }}>✦ {surfNote}</span>}
                  {v.hasCable && <span style={{ fontSize: 9, color: '#3B82F6', marginLeft: 4 }}>⊡ Kabel</span>}
                </>
              }
              sub=""
              qty={v.qty}
              csym={csym}
              pi={pr(v.kategorie, v.dim, v.qty, v.pg)}
            />
          );
        })}
      </>
    );
  }

  return (
    <div style={SIDE_STYLE}>

      {/* ── Header ── */}
      <div style={{ padding: '16px 22px 14px', borderBottom: '1px solid #E0DDD7', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 300, fontSize: 17, letterSpacing: '.04em', color: '#171614' }}>
            Stückliste
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {/* Speichern-Button */}
            <button
              onClick={handleCommit}
              disabled={!bom}
              title={!bom ? 'Keine Felder definiert' : isDirty ? 'Ungespeicherte Änderungen — erneut speichern' : 'Konfiguration speichern und Möbel-ID generieren'}
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
              {isDirty && (
                <span style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 5, height: 5, borderRadius: '50%', background: '#D4A520',
                }} />
              )}
              ✓ Speichern
            </button>
            {/* PDF-Export (Datenblatt) — nur für eingeloggte Nutzer */}
            {(pricing?.price_type === 'EK' || pricing?.price_type === 'UVP') && (
              <button
                onClick={handleDatasheetExport}
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
                {datasheetLoading ? '…' : '↓ PDF'}
              </button>
            )}
          </div>
        </div>
        <div style={{ fontSize: 10, color: '#A8A49C', marginTop: 4, lineHeight: 1.6 }}>{metaStr}</div>
        {/* XLS-Export + Möbel-ID Badge */}
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => { void handleExport(); }}
            disabled={!bom}
            title="XLS-Stückliste herunterladen"
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              padding: '2px 6px', borderRadius: 1,
              cursor: bom ? 'pointer' : 'not-allowed',
              border: '1px solid #E0DDD7', background: 'transparent',
              color: bom ? '#787470' : '#C8C4BC',
              whiteSpace: 'nowrap', letterSpacing: '.04em',
            }}
          >
            ↓ XLS
          </button>
          {moebelId && (
            <>
              <span style={{ fontSize: 9, color: '#A8A49C', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                Möbel-ID
              </span>
              <button
                onClick={copyMoebelId}
                title="Möbel-ID kopieren"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
                  padding: '2px 8px', borderRadius: 1, cursor: 'pointer',
                  border: '1px solid #C8C4BC', background: '#F0EDE7',
                  color: '#171614', letterSpacing: '.06em',
                }}
              >
                {String(moebelId)}
              </button>
              <span style={{ fontSize: 9, color: '#C8C4BC' }}>↗ kopieren</span>
            </>
          )}
        </div>
      </div>

      {/* ── Scroll ── */}
      <div style={SCROLL_STYLE}>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-2 mb-[14px]">
          {[
            { id: 'wuerfel',    v: bom.wuerfel,    l: 'Würfel'    },
            { id: 'profile',    v: bom.pGes,       l: 'Profile'   },
            { id: 'platten',    v: bom.plattenGes, l: 'Platten'   },
            { id: 'fronten',    v: bom.frontGes,   l: 'Fronten'   },
            { id: 'beschlaege', v: bom.beschlGes,  l: 'Beschläge' },
            { id: 'fuesse',     v: bom.footerQty,  l: 'Füße'      },
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
        {bom.warns.map((w, i) => (
          <div key={i} style={WARN_STYLE}>
            <span>⚠</span>{w}
          </div>
        ))}

        {/* ── BOM-Gruppen ── */}

        <Group title="Würfel" total={bom.wuerfel} csym={csym}>
          <BRow name="Würfel 30mm" sub="" qty={bom.wuerfel} csym={csym}
            pi={pr('Würfel 30mm', undefined, bom.wuerfel)} />
        </Group>

        <Group title="Profile — Breite" total={bom.pBt} csym={csym}>
          {sortEntries(bom.pB).map(([l, q]) => (
            <BRow key={l} name={<><Hl>L={l}mm</Hl></>} sub="" qty={q} csym={csym}
              pi={pr('Profil', l, q)} />
          ))}
          <BRow name="Summe" sub="" qty={bom.pBt} csym={csym} subtotal={profileST(bom.pB)} />
        </Group>

        <Group title="Profile — Höhe" total={bom.pHt} csym={csym}>
          {sortEntries(bom.pH).map(([l, q]) => (
            <BRow key={l} name={<><Hl>L={l}mm</Hl></>} sub="" qty={q} csym={csym}
              pi={pr('Profil', l, q)} />
          ))}
          <BRow name="Summe" sub="" qty={bom.pHt} csym={csym} subtotal={profileST(bom.pH)} />
        </Group>

        <Group title="Profile — Tiefe" total={bom.pTt} csym={csym}>
          <BRow name={<><Hl>L={bom.D}mm</Hl></>} sub="" qty={bom.pTt} csym={csym}
            pi={pr('Profil', String(bom.D), bom.pTt)} />
        </Group>

        <Group title="Böden Standard" total={bom.bStdT} csym={csym} catKey="boden"
          catOverride={state.catOverrides['boden']}
          onEditOpen={() => openCatEdit('boden')} onEditClose={closeCatEdit}
          isCatEditOpen={openCat === 'boden'}>
          {openCat === 'boden' && <CatEditPanel catKey="boden" />}
          <VariantRows kategorien={['Boden']} />
          <BRow name="Gesamt" sub="" qty={bom.bStdT} csym={csym} subtotal={subtl('Boden')} />
        </Group>

        {bom.bKlT > 0 && (
          <Group title="Klappenböden" total={bom.bKlT} csym={csym} catKey="klappenboden"
            catOverride={state.catOverrides['klappenboden']}
            onEditOpen={() => openCatEdit('klappenboden')} onEditClose={closeCatEdit}
            isCatEditOpen={openCat === 'klappenboden'}>
            {openCat === 'klappenboden' && <CatEditPanel catKey="klappenboden" />}
            <VariantRows kategorien={['Klappenboden']} />
            <BRow name="Gesamt" sub="" qty={bom.bKlT} csym={csym} subtotal={subtl('Klappenboden')} />
          </Group>
        )}

        <Group title="Rücken" total={bom.rT} csym={csym} catKey="ruecken"
          catOverride={state.catOverrides['ruecken']}
          onEditOpen={() => openCatEdit('ruecken')} onEditClose={closeCatEdit}
          isCatEditOpen={openCat === 'ruecken'}>
          {openCat === 'ruecken' && <CatEditPanel catKey="ruecken" />}
          <VariantRows kategorien={['Rücken']} />
          <BRow name="Gesamt" sub="" qty={bom.rT} csym={csym} subtotal={subtl('Rücken')} />
        </Group>

        {state.opts.outer && bom.sAT > 0 && (
          <Group title="Seiten außen" total={bom.sAT} csym={csym} catKey="seite_aussen"
            catOverride={state.catOverrides['seite_aussen']}
            onEditOpen={() => openCatEdit('seite_aussen')} onEditClose={closeCatEdit}
            isCatEditOpen={openCat === 'seite_aussen'}>
            {openCat === 'seite_aussen' && <CatEditPanel catKey="seite_aussen" />}
            <VariantRows kategorien={['Seite außen']} />
            <BRow name="Gesamt" sub="" qty={bom.sAT} csym={csym} subtotal={subtl('Seite außen')} />
          </Group>
        )}

        {state.opts.outer && bom.sATsy > 0 && (
          <Group title="Seiten außen SY32" total={bom.sATsy} csym={csym} catKey="seite_aussen_sy32"
            catOverride={state.catOverrides['seite_aussen_sy32']}
            onEditOpen={() => openCatEdit('seite_aussen_sy32')} onEditClose={closeCatEdit}
            isCatEditOpen={openCat === 'seite_aussen_sy32'}>
            {openCat === 'seite_aussen_sy32' && <CatEditPanel catKey="seite_aussen_sy32" />}
            <VariantRows kategorien={['Seite außen SY32']} />
            <BRow name="Gesamt" sub="" qty={bom.sATsy} csym={csym} subtotal={subtl('Seite außen SY32')} />
          </Group>
        )}

        {state.opts.inner && (
          <Group title="Seiten innen" total={bom.sIT + bom.sITsy} csym={csym}>
            <VariantRows kategorien={['Seite innen', 'Seite innen SY32']} />
            <BRow name="Gesamt" sub="" qty={bom.sIT + bom.sITsy} csym={csym} subtotal={subtl('Seite innen', 'Seite innen SY32')} />
          </Group>
        )}

        {bom.fbT > 0 && (
          <Group title="Fachböden" total={bom.fbT} csym={csym} catKey="fachboden"
            catOverride={state.catOverrides['fachboden']}
            onEditOpen={() => openCatEdit('fachboden')} onEditClose={closeCatEdit}
            isCatEditOpen={openCat === 'fachboden'}>
            {openCat === 'fachboden' && <CatEditPanel catKey="fachboden" />}
            <VariantRows kategorien={['Fachboden klein']} />
            <BRow name="Gesamt" sub="" qty={bom.fbT} csym={csym} subtotal={subtl('Fachboden klein')} />
          </Group>
        )}

        <Group title="Fronten" total={bom.frontGes} csym={csym}>
          {bom.frontGes === 0 && <BRow name="—" sub="Keine Frontelemente konfiguriert" qty={0} csym={csym} />}
          <VariantRows kategorien={['Klappe', 'Schublade', 'Tür', 'Doppeltür']} />
          <BRow name="Gesamt" sub="" qty={bom.frontGes} csym={csym} subtotal={subtl('Klappe', 'Schublade', 'Tür', 'Doppeltür')} />
        </Group>

        {bom.frontGes > 0 && (
          <Group title="Griffe" total={bom.frontGes} csym={csym}>
            <BRow
              name={bom.handleObj.l ?? state.handle}
              sub={bom.handleObj.lb ? `${bom.handleObj.lb}mm Lochbohrung` : 'kein Loch'}
              qty={bom.frontGes}
              csym={csym}
              pi={pr('Griff', undefined, bom.frontGes)}
            />
          </Group>
        )}

        <Group title="Verbindungskleinteile" total={kleinteile} csym={csym}>
          <BRow name="Sicherungsbolzen" sub="" qty={bom.bolzen} csym={csym} pi={null} />
          <BRow name="Gewindebolzen"    sub="" qty={bom.bolzen} csym={csym} pi={null} />
          <BRow name="Madenschraube"    sub="" qty={bom.bolzen} csym={csym} pi={null} />
          <BRow name="Verdrehsicherung" sub="" qty={bom.bolzen} csym={csym} pi={null} />
          <BRow name="Klemmsterne"      sub="" qty={bom.klemm}  csym={csym} pi={null} />
        </Group>

        <Group title="Beschläge" total={bom.beschlGes} csym={csym}>
          <BRow name="Scharniere"         sub="" qty={bom.scharn}  csym={csym} pi={null} />
          <BRow name="Klappenhalter"      sub="" qty={bom.kHalt}   csym={csym} pi={null} />
          <BRow name="Klappendämpfer"     sub="" qty={bom.kDaem}   csym={csym} pi={null} />
          <BRow name="Schubkastenführung" sub="" qty={bom.schubF}  csym={csym} pi={null} />
        </Group>

        {(bom.cableHolesQty + bom.bomKabelQty) > 0 && (
          <Group title="Kabeldurchlässe" total={bom.cableHolesQty + bom.bomKabelQty} csym={csym}>
            {bom.cableHolesQty > 0 && (
              <BRow
                name={<>Kabeldurchlass <Hl>Art. {CABLE_HOLE_ART_NR}</Hl></>}
                sub="Bohrung ⌀ 80mm · Felder-Editor"
                qty={bom.cableHolesQty}
                csym={csym}
                pi={pr('Kabeldurchlass', undefined, bom.cableHolesQty)}
              />
            )}
            {bom.bomKabelQty > 0 && (
              <BRow
                name={<>Kabeldurchlass <Hl>Art. {CABLE_HOLE_ART_NR}</Hl></>}
                sub="Bohrung ⌀ 80mm · Bauteil-Override"
                qty={bom.bomKabelQty}
                csym={csym}
                pi={pr('Kabeldurchlass', undefined, bom.bomKabelQty)}
              />
            )}
          </Group>
        )}

        <Group title="Füsse / Rollen" total={bom.footerQty} csym={csym}>
          <BRow
            name={FOOTER_BY_V[state.footer]?.l ?? state.footer}
            sub={`2 × (${bom.Bact} Sp. + 1)`}
            qty={bom.footerQty}
            csym={csym}
            pi={pr('Füße / Rollen', undefined, bom.footerQty)}
          />
          <BRow name="Gesamt" sub="" qty={bom.footerQty} csym={csym} subtotal={subtl('Füße / Rollen')} />
        </Group>

        {/* ── Preisberechnung ── */}
        <PriceSection
          pricing={pricing}
          loading={priceLoading}
        />

        {/* Preise werden immer im Datenblatt angezeigt (Netto/MwSt/Brutto) */}

      </div>

    </div>
  );
}

// ── Hilfskomponenten ──────────────────────────────────────────────────────────

function Group({ title, total, csym, catKey, catOverride, onEditOpen, onEditClose, isCatEditOpen, children }: {
  title: string;
  total?: number;
  csym?: string;
  catKey?: string;
  catOverride?: BomCatOverride;
  onEditOpen?: () => void;
  onEditClose?: () => void;
  isCatEditOpen?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(true);
  const isEditable = !!catKey;

  // Spalten-Vorlage für Kopfzeile
  const hdrCols = csym ? '1fr 22px 54px 54px' : undefined;
  const hdrLabel = csym === 'CHF' ? 'CHF' : '€';

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
          }}>▶</span>
          {title}
          {catOverride && (
            <span style={{ background: '#F0EAD6', padding: '0 5px', borderRadius: 1, color: '#7A5A20', fontSize: 8 }}>
              ✦ {catOverride.anzahl}/{total}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {collapsed && total !== undefined && (
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 300, color: '#171614' }}>
              {total}
            </span>
          )}
          {isEditable && (
            <button
              onClick={e => { e.stopPropagation(); if (isCatEditOpen) { onEditClose?.(); } else { onEditOpen?.(); } }}
              title="Abweichende Oberfläche konfigurieren"
              style={{
                ...EDIT_BTN_BASE,
                background: isCatEditOpen ? '#F0EDE7' : 'transparent',
                color: isCatEditOpen ? '#787470' : '#C8C4BC',
              }}
            >✎</button>
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
              <span style={{ textAlign: 'right' }}>{hdrLabel}/Stück</span>
              <span style={{ textAlign: 'right' }}>Gesamt</span>
            </div>
          )}
          {children}
        </>
      )}
    </div>
  );
}

// ── BRow — read-only BOM-Zeile ─────────────────────────────────────────────────

function BRow({ name, sub, qty, csym, pi, subtotal }: {
  name: React.ReactNode;
  sub: string;
  qty: number;
  csym?: string;
  pi?: PriceInfo | null;
  subtotal?: number | null;
}) {
  const { market } = useMarket();
  const isSummary = subtotal !== undefined;
  const showPrice = csym !== undefined;
  const cols = showPrice ? '1fr 22px 54px 54px' : '1fr auto';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols, gap: showPrice ? 4 : 6,
      padding: '5px 10px', border: '1px solid #E0DDD7', borderTop: 'none',
      alignItems: 'center',
      background: isSummary ? '#EEE9E3' : '#FAFAF8',
      opacity: qty === 0 && !isSummary ? 0.3 : 1,
    }}>
      <div>
        <div style={{ fontSize: 11, color: '#36342F', lineHeight: 1.4, fontWeight: isSummary ? 500 : 400 }}>
          {name}
        </div>
        {sub && <div style={{ fontSize: 10, color: '#787470', marginTop: 1 }}>{sub}</div>}
      </div>
      {isSummary ? (
        <span />
      ) : (
        <span style={{
          fontFamily: 'var(--font-sans)',
          fontSize: qty === 0 ? 11 : 16,
          fontWeight: qty === 0 ? 300 : 400,
          color: qty === 0 ? '#A8A49C' : '#171614',
          textAlign: 'right', whiteSpace: 'nowrap',
        }}>
          {qty}
        </span>
      )}
      {showPrice && (
        <>
          <span style={PRICE_CELL}>
            {!isSummary && (pi === undefined ? '' : pi === null ? '–' : fmtP(pi.unit, csym, market))}
          </span>
          <span style={{ ...PRICE_CELL, fontWeight: isSummary ? 600 : 400 }}>
            {isSummary
              ? (subtotal === null ? '–' : fmtP(subtotal, csym, market))
              : (pi === undefined ? '' : pi === null ? '–' : fmtP(pi.total, csym, market))}
          </span>
        </>
      )}
    </div>
  );
}

function Hl({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#787470' }}>{children}</span>;
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '6px 10px', background: '#F0EDE7', border: '1px solid #E0DDD7', borderRadius: 1, marginBottom: 10, fontSize: 10, color: '#787470' }}>
      {children}
    </div>
  );
}

// ── PriceSection ──────────────────────────────────────────────────────────────

function PriceSection({
  pricing,
  loading,
}: {
  pricing: PriceResponse | null;
  loading: boolean;
}) {
  const { user } = useUser();
  const { market, vatRate, currencySymbol } = useMarket();

  const fmt = (v: number) => fmtPrice(v, market);

  // Dealer/Admin sehen zusätzlich EK + Marge
  const isDealer = user?.role === 'dealer';

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #E0DDD7', paddingTop: 12 }}>
      {/* Kopfzeile */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.14em', color: '#A8A49C' }}>
          Preisindikation
        </div>
        <div style={{ fontSize: 9, color: '#A8A49C', fontFamily: 'var(--font-mono)' }}>
          {currencySymbol}
        </div>
      </div>

      {loading && (
        <div style={{ fontSize: 10, color: '#A8A49C', fontFamily: 'var(--font-mono)', padding: '6px 0' }}>
          Preis wird berechnet …
        </div>
      )}

      {!loading && !pricing && (
        <div style={{ fontSize: 10, color: '#A8A49C', padding: '4px 0' }}>
          —
        </div>
      )}

      {!loading && pricing && (
        <>
          <div style={{
            padding: '10px 12px',
            background: '#F5F3EE',
            border: '1px solid #E0DDD7',
            borderRadius: 1, marginBottom: 6,
          }}>
            {isDealer && pricing.price_type === 'EK' ? (
              /* ── Dealer: EK + UVP + Marge ── */
              <>
                {/* EK Netto (Hauptpreis) */}
                <div style={{ fontSize: 9, color: '#A8A49C', marginBottom: 2 }}>
                  Ihr EK netto
                </div>
                <div style={{ fontSize: 24, fontWeight: 500, color: '#171614', lineHeight: 1 }}>
                  {fmt(pricing.grand_total)}&thinsp;{currencySymbol}
                </div>

                {/* UVP + Marge */}
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

                {/* EK Brutto */}
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #E0DDD7' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 500, color: '#171614' }}>
                    <span>EK brutto (inkl. {market === 'CH' ? '8,1' : '19'}&thinsp;%)</span>
                    <span>{fmt(pricing.grand_total * (1 + vatRate))}&thinsp;{currencySymbol}</span>
                  </div>
                </div>
              </>
            ) : (
              /* ── Alle anderen (Guest, Customer, Admin): UVP ── */
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
                  <div style={{ fontSize: 9, color: '#A8A49C', marginTop: 3 }}>
                    UVP excl. MwSt.
                  </div>
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

// ── Stil-Konstanten ───────────────────────────────────────────────────────────

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

const EDIT_BTN_BASE: React.CSSProperties = {
  width: 18, height: 18, borderRadius: 0,
  border: '1px solid #E0DDD7', fontSize: 10, lineHeight: 1,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'var(--font-mono)', padding: 0, flexShrink: 0,
};

const EDIT_OK_BTN: React.CSSProperties = {
  flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10,
  padding: '3px 0', borderRadius: 0, cursor: 'pointer',
  border: '1px solid #E0DDD7', background: '#F5F3EE', color: '#36342F',
};

const EDIT_CLR_BTN: React.CSSProperties = {
  flex: 1, fontFamily: 'var(--font-mono)', fontSize: 10,
  padding: '3px 0', borderRadius: 0, cursor: 'pointer',
  border: '1px solid #E0DDD7', background: 'transparent', color: '#787470',
};

const PRICE_CELL: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  color: '#787470',
  textAlign: 'right',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};
