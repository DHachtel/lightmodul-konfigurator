/**
 * XLS-Export -- Lightmodul-Stueckliste
 * Spaltenreihenfolge: Materialnr | Moebel ID | Gruppe | Bauteil | Anzahl [| Stueckpreis | Gesamtpreis]
 */

import type { BOMResult, PriceLineItem } from '@/core/types';

// -- Gemeinsame Hilfsfunktionen --

function xmlEsc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

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

// -- Erweiterte BOM-Zeilen --

export function buildBOMRowsExtended(
  bom: BOMResult,
  priceItems?: PriceLineItem[] | null,
  moebelId?: string,
): { rows: string[][]; overrideRows: Set<number> } {

  const rows: string[][] = [];
  const overrideRows = new Set<number>();

  // Preis-Lookup
  const priceMap = new Map<string, { art_nr: string; unit_price: number }>();
  if (priceItems) {
    for (const item of priceItems) {
      const key = `${item.kategorie}|${item.dim_key ?? ''}`;
      priceMap.set(key, { art_nr: item.art_nr, unit_price: item.unit_price });
    }
  }
  const hasPrice = priceMap.size > 0;

  // Header
  const header = ['Materialnr', 'Moebel ID', 'Gruppe', 'Bauteil', 'Anzahl'];
  if (hasPrice) header.push('Stueckpreis', 'Gesamtpreis');
  rows.push(header);

  function lookup(kat: string, dimKey?: string): { art_nr: string; unit_price: number } | undefined {
    return priceMap.get(`${kat}|${dimKey ?? ''}`) ?? undefined;
  }

  function addRow(gruppe: string, bauteil: string, qty: number, kat: string, dimKey?: string): void {
    if (qty <= 0) return;
    const item = lookup(kat, dimKey);
    const row = [item?.art_nr ?? '', moebelId ?? '-', gruppe, bauteil, String(qty)];
    if (hasPrice) {
      const up = item?.unit_price;
      row.push(up != null ? String(Math.round(up * 100) / 100) : '');
      row.push(up != null ? String(Math.round(up * qty * 100) / 100) : '');
    }
    rows.push(row);
  }

  // -- Wuerfel --
  addRow('Wuerfel', 'Alu-Wuerfel 27mm', bom.wuerfel, 'Wuerfel');

  // -- Profile --
  addRow('Profile', 'Profil X (Breite)', bom.profileX, 'Profil', '600');
  addRow('Profile', 'Profil Y (Hoehe)', bom.profileY, 'Profil', '600');
  addRow('Profile', 'Profil Z (Tiefe)', bom.profileZ, 'Profil', '600');

  // -- Einlegerahmen --
  addRow('Einlegerahmen', 'Rahmen Standard (RF)', bom.framesStd, 'Einlegerahmen', 'RF');
  addRow('Einlegerahmen', 'Rahmen beleuchtet (RL)', bom.framesLit, 'Einlegerahmen', 'RL');

  // -- Fachboeden --
  addRow('Fachboeden', 'Fachboden', bom.shelves, 'Fachboden');
  addRow('Fachboeden', 'Profil mit Steg 600mm', bom.profilMitSteg, 'ProfilMitSteg', '600');

  // -- Hardware --
  addRow('Hardware', 'Senkschrauben M4x8', bom.schraubenM4, 'Hardware', 'M4');
  addRow('Hardware', 'Zylinderschrauben M6x40', bom.schraubenM6, 'Hardware', 'M6');
  addRow('Hardware', 'U-Scheiben D6,4', bom.scheiben, 'Hardware', 'Scheiben');
  addRow('Hardware', 'Einlegemuttern', bom.einlegemuttern, 'Hardware', 'Muttern');

  // -- Stellfuesse --
  addRow('Stellfuesse', bom.footer, bom.footerQty, 'Stellfuesse');

  // -- Beratungstisch --
  if (bom.fachbodenBT > 0) {
    addRow('Beratungstisch', 'Arbeitsplatte', bom.fachbodenBT, 'BT_Fachboden');
    addRow('Beratungstisch', 'Profil 360mm', bom.profil360, 'BT_Profil', '360');
    if (bom.profil213 > 0) {
      addRow('Beratungstisch', 'Profil 213mm', bom.profil213, 'BT_Profil', '213');
    }
    addRow('Beratungstisch', 'Worktop-Profile X 600mm', bom.worktopProfileX, 'BT_Profil', '600');
    addRow('Beratungstisch', 'Worktop-Profile Z 600mm', bom.worktopProfileZ, 'BT_Profil', '600');
    addRow('Beratungstisch', 'Zwischenwuerfel', bom.wuerfelBT, 'BT_Wuerfel');
  }

  // -- Produktrahmen --
  if (bom.produktrahmen > 0) {
    addRow('Produktrahmen', 'Produktrahmen LightModul', bom.produktrahmen, 'Produktrahmen');
  }

  // -- Summenzeile --
  if (hasPrice) {
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
      overrideRows.add(rows.length);
      rows.push(sumRow);
    }
  }

  return { rows, overrideRows };
}

// -- XLSX-Bytes erzeugen --

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

  const xfDefs = fontKeys.map((k, i) => {
    const fi = fillKeys.indexOf(k) + 2;
    return `<xf numFmtId="0" fontId="${i}" fillId="${fi}" borderId="0" xfId="0" applyFill="1" applyFont="1"/>`;
  }).join('')
  + fontKeys.map((k, i) => {
    const fi = fillKeys.indexOf(k) + 2;
    return `<xf numFmtId="165" fontId="${i}" fillId="${fi}" borderId="0" xfId="0" applyFill="1" applyFont="1" applyNumberFormat="1"/>`;
  }).join('');
  const xfCount = fontKeys.length * 2;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
${numFmtXml}
<fonts count="${fontKeys.length}">${fontDefs}</fonts>
${fillDefs}
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfCount}">${xfDefs}</cellXfs>
</styleSheet>`;

  const colCount    = rows[0]?.length ?? 5;
  const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const colLetters  = Array.from({ length: colCount }, (_, i) => COL_LETTERS[i]);
  const BASE_WIDTHS = [18, 12, 16, 30, 10, 14, 14];
  const colWidths   = Array.from({ length: colCount }, (_, i) => BASE_WIDTHS[i] ?? 12);

  const ANZAHL_COL = 4;
  const numericCols = new Set([ANZAHL_COL]);
  const hdr = rows[0] ?? [];
  const stueckpreisIdx = hdr.indexOf('Stueckpreis');
  const gesamtpreisIdx = hdr.indexOf('Gesamtpreis');
  if (stueckpreisIdx >= 0) numericCols.add(stueckpreisIdx);
  if (gesamtpreisIdx >= 0) numericCols.add(gesamtpreisIdx);

  let sheetRows = '';
  rows.forEach((row, ri) => {
    const rtype = ri === 0 ? 'hdr' : (overrideRows.has(ri) ? 'override' : 'data');
    const xfIdx = fontKeys.indexOf(rtype);
    sheetRows += `<row r="${ri + 1}" ht="15" customHeight="1">`;
    colLetters.forEach((col, ci) => {
      const val  = row[ci] ?? '';
      const addr = col + (ri + 1);
      const isPriceCol = ci === stueckpreisIdx || ci === gesamtpreisIdx;
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
<sheets><sheet name="Stueckliste" sheetId="1" r:id="rId1"/></sheets>
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

// -- Erweiterter XLS-Download (Browser-Wrapper) --

export async function downloadXLSXExtended(
  rows: string[][],
  overrideRows: Set<number>,
  filename: string,
): Promise<void> {
  const zip = generateXLSXBytes(rows, overrideRows);
  const blob = new Blob(
    [new Uint8Array(zip) as BlobPart],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  );

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
      if ((e as DOMException).name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// -- Minimaler ZIP-Builder (stored, kein DEFLATE) --

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
      0x50, 0x4B, 0x03, 0x04,
      20, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), 0, 0,
      ...nameBytes, ...data,
    ]);
    parts.push(local);

    const central = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02,
      20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length),
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ...u32(offset), ...nameBytes,
    ]);
    centralDir.push(central);
    offset += local.length;
  }

  const centralSize = centralDir.reduce((a, b) => a + b.length, 0);
  const eocd = new Uint8Array([
    0x50, 0x4B, 0x05, 0x06,
    0, 0, 0, 0,
    ...u16(centralDir.length), ...u16(centralDir.length),
    ...u32(centralSize), ...u32(offset),
    0, 0,
  ]);

  const totalLen = parts.reduce((a, b) => a + b.length, 0) + centralSize + eocd.length;
  const result   = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of [...parts, ...centralDir, eocd]) { result.set(p, pos); pos += p.length; }
  return result;
}
