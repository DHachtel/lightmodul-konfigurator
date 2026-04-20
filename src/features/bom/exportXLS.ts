/**
 * XLS-Export — Zielformat Muster-Stückliste
 * Spaltenreihenfolge: Materialnr | Möbel ID | Gruppe | Bauteil | Länge | Breite | Anzahl | Oberfläche / Farbe [| Kabel]
 */

import type { BomCatOverride, BomOverride, BOMResult, Material, PriceLineItem } from '@/core/types';
// BoardVariant entfernt — Lightmodul hat keine Board-Varianten

// ── Gemeinsame Hilfsfunktionen ────────────────────────────────────────────────

function xmlEsc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Erstellt eine neue Shared-Strings-Tabelle für eine XLSX-Datei */
function makeSi(): { si: (v: string) => number; strs: string[] } {
  const strs: string[] = [];
  const strIdx: Record<string, number> = {};
  return {
    si(v: string): number {
      const s = String(v);
      if (strIdx[s] === undefined) { strIdx[s] = strs.length; strs.push(s); }
      return strIdx[s];
    },
    strs,
  };
}

/** Zerlegt eine Abmessungsangabe in [Länge, Breite].
 *  "30×30×30mm" → ["30","30"], "580 mm" → ["580","—"], "—" → ["—","—"]
 */
function splitDim(abm: string): [string, string] {
  if (abm === '—') return ['—', '—'];
  const mCross = abm.match(/^(\d+)[×x](\d+)/);
  if (mCross) return [mCross[1], mCross[2]];
  const mNum = abm.match(/^(\d+)/);
  if (mNum) return [mNum[1], '—'];
  return ['—', '—'];
}

// ── Erweiterte BOM-Zeilen mit neuem Spaltenformat ─────────────────────────────

/**
 * Baut die Zeilen für den XLS-Export auf.
 * priceItems: PriceLineItem[] aus der API-Antwort (optional)
 */
export function buildBOMRowsExtended(
  bom: BOMResult,
  globalSurface: string,
  globalMatObj: Material | undefined,
  overrides: Record<string, BomOverride>,
  catOverrides: Record<string, BomCatOverride> = {},
  variants: BoardVariant[] = [],
  priceItems?: PriceLineItem[] | null,
  moebelId?: string,
): { rows: string[][]; overrideRows: Set<number> } {

  // Kabel-Spalte nur wenn mindestens ein Override oder eine Variante kabel=true hat
  const hasKabelData =
    Object.values(overrides).some(ov => ov.kabel === true) ||
    Object.values(catOverrides).some(ov => ov.kabel === true) ||
    variants.some(v => v.hasCable);

  const rows: string[][] = [];
  const overrideRows = new Set<number>();

  // Preis-Lookup intern aus Array aufbauen (Key inkl. PG für Oberflächen-Differenzierung)
  const priceMap = new Map<string, { art_nr: string; unit_price: number }>();
  if (priceItems) {
    for (const item of priceItems) {
      const key = `${item.kategorie}|${item.dim_key ?? ''}|${item.pg ?? ''}`;
      priceMap.set(key, { art_nr: item.art_nr, unit_price: item.unit_price });
    }
  }
  const hasPrice = priceMap.size > 0;

  // Header — Kabel-Spalte optional, Preisspalten optional
  const header = ['Materialnr', 'Möbel ID', 'Gruppe', 'Bauteil', 'Länge', 'Breite', 'Anzahl', 'Oberfläche / Farbe'];
  if (hasKabelData) header.push('Kabel');
  if (hasPrice) header.push('Stückpreis', 'Gesamtpreis');
  rows.push(header);

  /** Preis-Lookup-Eintrag ermitteln */
  function lookupItem(kat: string, dimKey: string = '', pg: string = ''): { art_nr: string; unit_price: number } | undefined {
    return priceMap.get(`${kat}|${dimKey}|${pg}`) ?? undefined;
  }

  /** Nicht-editierbare Zeile ohne Oberfläche (Würfel, Profile, Griffe, etc.) */
  function rStatic(g: string, b: string, abm: string, q: number, kat: string, dimKey?: string): void {
    const [laenge, breite] = splitDim(abm);
    const item = lookupItem(kat, dimKey ?? '');
    const row = [item?.art_nr ?? '', moebelId ?? '—', g, b, laenge, breite, String(q), '—'];
    if (hasKabelData) row.push('—');
    if (hasPrice) {
      const up = item?.unit_price;
      row.push(up != null ? String(Math.round(up * 100) / 100) : '');
      row.push(up != null ? String(Math.round(up * q * 100) / 100) : '');
    }
    rows.push(row);
  }

  // ── Würfel + Profile ──────────────────────────────────────────────────────
  rStatic('Würfel',  'Würfel 30mm',  '30×30×30mm', bom.wuerfel, 'Würfel 30mm');
  Object.entries(bom.pB).sort((a, b) => +a[0] - +b[0])
    .forEach(([l, q]) => rStatic('Profile', 'Profil Breite', l + ' mm', q, 'Profil', l));
  Object.entries(bom.pH).sort((a, b) => +a[0] - +b[0])
    .forEach(([l, q]) => rStatic('Profile', 'Profil Höhe',   l + ' mm', q, 'Profil', l));
  rStatic('Profile', 'Profil Tiefe', bom.D + ' mm', bom.pTt, 'Profil', String(bom.D));

  // ── Platten + Fronten — eine Zeile pro Variante (Oberfläche + Kabel) ──────
  const globalSurfLabel = globalSurface === 'none' ? '—' : (globalMatObj?.l ?? globalSurface);

  for (const v of variants) {
    const [laenge, breite] = splitDim(v.dim);
    const surfLabel = v.surfaceLabel !== 'Keine' ? v.surfaceLabel : globalSurfLabel;
    const gruppe = ['Klappe', 'Schublade', 'Tür', 'Doppeltür'].includes(v.kategorie) ? 'Fronten' : 'Platten';
    const item = lookupItem(v.kategorie, v.dim, v.pg);
    const row = [
      item?.art_nr ?? '',
      moebelId ?? '—',
      gruppe,
      v.label,
      laenge,
      breite,
      String(v.qty),
      surfLabel,
    ];
    if (hasKabelData) row.push(v.hasCable ? 'Ja' : '—');
    if (hasPrice) {
      const up = item?.unit_price;
      row.push(up != null ? String(Math.round(up * 100) / 100) : '');
      row.push(up != null ? String(Math.round(up * v.qty * 100) / 100) : '');
    }
    // Abweichende Oberfläche farblich hervorheben
    if (surfLabel !== globalSurfLabel) {
      overrideRows.add(rows.length);
    }
    rows.push(row);
  }

  // ── Griffe, Beschläge, Kleinteile ────────────────────────────────────────
  if (bom.frontGes > 0) {
    const hObj  = bom.handleObj;
    const hName = ('l' in hObj ? hObj.l : undefined) ?? bom.handle;
    rStatic('Griffe',     hName,                '—', bom.frontGes, 'Griff');
  }
  rStatic('Kleinteile', 'Sicherungsbolzen',  '—', bom.bolzen, '');
  rStatic('Kleinteile', 'Gewindebolzen',     '—', bom.bolzen, '');
  rStatic('Kleinteile', 'Madenschraube',     '—', bom.bolzen, '');
  rStatic('Kleinteile', 'Verdrehsicherung',  '—', bom.bolzen, '');
  rStatic('Kleinteile', 'Klemmsterne',       '—', bom.klemm,  '');
  if (bom.scharn > 0) rStatic('Beschläge', 'Scharniere',         '—', bom.scharn, '');
  if (bom.kHalt  > 0) rStatic('Beschläge', 'Klappenhalter',      '—', bom.kHalt,  '');
  if (bom.kDaem  > 0) rStatic('Beschläge', 'Klappendämpfer',     '—', bom.kDaem,  '');
  if (bom.schubF > 0) rStatic('Beschläge', 'Schubkastenführung', '—', bom.schubF, '');
  if (bom.footerQty > 0) rStatic('Füße / Rollen', bom.footer, '—', bom.footerQty, 'Füße / Rollen');

  // ── Summenzeile ─────────────────────────────────────────────────────────────
  if (hasPrice) {
    // Gesamtpreis-Spalte summieren (letzte Spalte in jeder Datenzeile)
    const gesamtCol = header.indexOf('Gesamtpreis');
    if (gesamtCol >= 0) {
      let total = 0;
      for (let i = 1; i < rows.length; i++) {
        const val = rows[i][gesamtCol];
        if (val && !isNaN(Number(val))) total += Number(val);
      }
      total = Math.round(total * 100) / 100;
      const sumRow = Array.from({ length: header.length }, () => '');
      sumRow[gesamtCol - 1] = 'Summe netto';
      sumRow[gesamtCol] = String(total);
      overrideRows.add(rows.length); // Summenzeile hervorheben
      rows.push(sumRow);
    }
  }

  return { rows, overrideRows };
}

// ── XLSX-Bytes erzeugen (server- und browserseitig nutzbar) ──────────────────

export function generateXLSXBytes(
  rows: string[][],
  overrideRows: Set<number>,
): Uint8Array {
  const { si, strs } = makeSi();

  const fills: Record<string, string> = {
    hdr:      'FFE8E4DC',
    data:     'FFFFFFFF',
    override: 'FFFFF3C0',
  };
  const fonts: Record<string, { bold: boolean; color: string; sz: number }> = {
    hdr:      { bold: true,  color: 'FF333333', sz: 10 },
    data:     { bold: false, color: 'FF3A3834', sz: 10 },
    override: { bold: false, color: 'FF3A3834', sz: 10 },
  };

  const numFmtXml = '<numFmts count="2"><numFmt numFmtId="164" formatCode="General"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts>';
  const fontKeys  = Object.keys(fonts);
  const fillKeys  = Object.keys(fills);

  const fontDefs = Object.values(fonts).map(f =>
    `<font><sz val="${f.sz}"/><color rgb="${f.color}"/><name val="Arial"/>${f.bold ? '<b/>' : ''}</font>`
  ).join('');

  const fillDefs =
    '<fills count="' + (fillKeys.length + 2) + '">'
    + '<fill><patternFill patternType="none"/></fill>'
    + '<fill><patternFill patternType="gray125"/></fill>'
    + Object.values(fills).map(c =>
        `<fill><patternFill patternType="solid"><fgColor rgb="${c}"/></patternFill></fill>`
      ).join('')
    + '</fills>';

  // xf 0–2: Standard (hdr/data/override), xf 3–5: Preisformat (hdr/data/override)
  const xfDefs = fontKeys.map((k, i) => {
    const fi = fillKeys.indexOf(k) + 2;
    return `<xf numFmtId="0" fontId="${i}" fillId="${fi}" borderId="0" xfId="0" applyFill="1" applyFont="1"/>`;
  }).join('')
  + fontKeys.map((k, i) => {
    const fi = fillKeys.indexOf(k) + 2;
    return `<xf numFmtId="165" fontId="${i}" fillId="${fi}" borderId="0" xfId="0" applyFill="1" applyFont="1" applyNumberFormat="1"/>`;
  }).join('');
  const xfCount = fontKeys.length * 2; // Standard + Preisformat

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${numFmtXml}
<fonts count="${fontKeys.length}">${fontDefs}</fonts>
${fillDefs}
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfCount}">${xfDefs}</cellXfs>
</styleSheet>`;

  // Spaltenanzahl dynamisch (8 Basis + opt. Kabel + opt. Stückpreis/Gesamtpreis)
  const colCount    = rows[0]?.length ?? 8;
  const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const colLetters  = Array.from({ length: colCount }, (_, i) => COL_LETTERS[i]);
  //                   Materialnr MöbelID Gruppe Bauteil Länge Breite Anzahl Oberfl. (Kabel) (Stückpr.) (Gesamt)
  const BASE_WIDTHS = [18,        12,     16,    26,     10,   10,    10,    24,      10,     14,        14];
  const colWidths   = Array.from({ length: colCount }, (_, i) => BASE_WIDTHS[i] ?? 12);

  // Spalten die als Zahlen gerendert werden (0-basiert)
  const ANZAHL_COL = 6;
  const numericCols = new Set([ANZAHL_COL]);
  // Preis-Spalten ermitteln: die letzten zwei Spalten wenn Header "Stückpreis" / "Gesamtpreis" enthält
  const hdr = rows[0] ?? [];
  const stückpreisIdx = hdr.indexOf('Stückpreis');
  const gesamtpreisIdx = hdr.indexOf('Gesamtpreis');
  if (stückpreisIdx >= 0) numericCols.add(stückpreisIdx);
  if (gesamtpreisIdx >= 0) numericCols.add(gesamtpreisIdx);

  let sheetRows = '';
  rows.forEach((row, ri) => {
    const rtype = ri === 0 ? 'hdr' : (overrideRows.has(ri) ? 'override' : 'data');
    const xfIdx = fontKeys.indexOf(rtype);
    sheetRows += `<row r="${ri + 1}" ht="15" customHeight="1">`;
    colLetters.forEach((col, ci) => {
      const val  = row[ci] ?? '';
      const addr = col + (ri + 1);
      // Preisspalten: Zahlenformat #,##0.00 (xf-Offset = fontKeys.length)
      const isPriceCol = ci === stückpreisIdx || ci === gesamtpreisIdx;
      const cellXf = isPriceCol && ri > 0 ? xfIdx + fontKeys.length : xfIdx;
      if (numericCols.has(ci) && ri > 0 && val !== '' && !isNaN(Number(val))) {
        sheetRows += `<c r="${addr}" s="${cellXf}" t="n"><v>${val}</v></c>`;
      } else if (val === '') {
        sheetRows += `<c r="${addr}" s="${xfIdx}"/>`;
      } else {
        sheetRows += `<c r="${addr}" s="${xfIdx}" t="s"><v>${si(val)}</v></c>`;
      }
    });
    sheetRows += '</row>';
  });

  const colDefs = colWidths.map((w, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`
  ).join('');

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols>${colDefs}</cols>
<sheetData>${sheetRows}</sheetData>
</worksheet>`;

  const sstXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strs.length}" uniqueCount="${strs.length}">
${strs.map(s => `<si><t xml:space="preserve">${xmlEsc(s)}</t></si>`).join('')}
</sst>`;

  const wbXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Stückliste" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const files: Record<string, string> = {
    '[Content_Types].xml':        contentTypes,
    '_rels/.rels':                rootRels,
    'xl/workbook.xml':            wbXml,
    'xl/_rels/workbook.xml.rels': wbRels,
    'xl/worksheets/sheet1.xml':   sheetXml,
    'xl/sharedStrings.xml':       sstXml,
    'xl/styles.xml':              stylesXml,
  };

  return buildZip(files);
}

// ── Erweiterter XLS-Download (Browser-Wrapper um generateXLSXBytes) ─────────

export async function downloadXLSXExtended(
  rows: string[][],
  overrideRows: Set<number>,
  filename: string,
): Promise<void> {
  const zip = generateXLSXBytes(rows, overrideRows);
  const blob = new Blob(
    [zip.buffer as ArrayBuffer],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  );

  // Speichern-unter-Dialog (Chrome/Edge); Fallback auf anchor-Download (Firefox)
  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Excel-Datei',
          accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return; // Nutzer hat abgebrochen
      // Fallback bei unerwarteten Fehlern
    }
  }

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Minimaler ZIP-Builder (stored, kein DEFLATE) ──────────────────────────────

interface CrcFn {
  (data: Uint8Array): number;
  t?: Uint32Array;
}

function buildZip(files: Record<string, string>): Uint8Array {
  const enc      = new TextEncoder();
  const parts: Uint8Array[]     = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  function u16(n: number): number[] { return [n & 0xff, (n >> 8) & 0xff]; }
  function u32(n: number): number[] { return [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]; }

  const crc32: CrcFn = (data: Uint8Array): number => {
    let crc = 0xFFFFFFFF;
    const table = crc32.t ?? (crc32.t = (() => {
      const t = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c;
      }
      return t;
    })());
    for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };

  for (const [name, content] of Object.entries(files)) {
    const data      = enc.encode(content);
    const nameBytes = enc.encode(name);
    const crc       = crc32(data);
    const size      = data.length;

    const local = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04,  // local file header sig
      20, 0,                    // version needed
      0, 0,                     // flags
      0, 0,                     // compression (stored)
      0, 0, 0, 0,               // mod time/date
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      0, 0,                     // extra field length
      ...nameBytes,
      ...data,
    ]);
    parts.push(local);

    const central = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02,  // central dir sig
      20, 0,                    // version made by
      20, 0,                    // version needed
      0, 0,                     // flags
      0, 0,                     // compression
      0, 0, 0, 0,               // mod time/date
      ...u32(crc),
      ...u32(size),
      ...u32(size),
      ...u16(nameBytes.length),
      0, 0,                     // extra
      0, 0,                     // comment
      0, 0,                     // disk start
      0, 0,                     // internal attr
      0, 0, 0, 0,               // external attr
      ...u32(offset),
      ...nameBytes,
    ]);
    centralDir.push(central);
    offset += local.length;
  }

  const centralSize = centralDir.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06,  // end of central dir sig
    0, 0,                     // disk number
    0, 0,                     // disk with central dir
    ...u16(centralDir.length),
    ...u16(centralDir.length),
    ...u32(centralSize),
    ...u32(offset),
    0, 0,                     // comment length
  ]);

  const totalLen = parts.reduce((a, b) => a + b.length, 0) + centralSize + eocd.length;
  const result   = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of [...parts, ...centralDir, eocd]) { result.set(p, pos); pos += p.length; }
  return result;
}
