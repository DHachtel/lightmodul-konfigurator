#!/usr/bin/env python3
"""
import-prices.py — Preisliste aus Excel in Supabase importieren

Liest das Blatt 'Konfigurator_Export' aus der Verkaufspreise*.xlsx und
schreibt alle Zeilen via Supabase REST-API in die Tabelle article_prices.

Nutzung:
  python scripts/import-prices.py [pfad/zur/datei.xlsx]

Standardpfad falls kein Argument: Verkaufspreise_02.xlsx im Projektstamm.

Umgebungsvariablen (oder .env.local lesen):
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Re-runnable: Bei Konflikt (gleiche art_nr) wird der Datensatz aktualisiert.

Spalten-Mapping (über Header-Zeile, reihenfolge-unabhängig):
  art_nr / Art_Nr           → art_nr
  typ / Typ                 → typ
  kategorie / Kategorie     → kategorie
  bezeichnung / Bezeichnung → bezeichnung
  breite_mm / Breite_mm     → breite_mm
  tiefe_mm / Tiefe_mm       → tiefe_mm
  pg1_mdf_eur               → pg1_eur
  pg2_furnier_eur           → pg2_eur
  pg3_alu_eur               → pg3_eur
  pg4_glas_eur              → pg4_eur
  pg1_mdf_chf               → pg1_chf
  pg2_furnier_chf           → pg2_chf
  pg3_alu_chf               → pg3_chf
  pg4_glas_chf              → pg4_chf
  warnung                   (übersprungen)
"""

import sys
import os
import json
import zipfile
import xml.etree.ElementTree as ET
import urllib.request
import urllib.parse
import re

# ── Konfiguration ─────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DEFAULT_XLSX = os.path.join(PROJECT_DIR, "Verkaufspreise_02.xlsx")
SHEET_NAME = "Konfigurator_Export"

# ── .env.local lesen ──────────────────────────────────────────────────────────

def load_env(path: str) -> dict[str, str]:
    env: dict[str, str] = {}
    if not os.path.exists(path):
        return env
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

_env = load_env(os.path.join(PROJECT_DIR, ".env.local"))
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or _env.get("NEXT_PUBLIC_SUPABASE_URL", "")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or _env.get("SUPABASE_SERVICE_ROLE_KEY", "")

# ── Excel-Parser ──────────────────────────────────────────────────────────────

NS = {"x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}

def col_idx(ref: str) -> int:
    """Spalten-Buchstabe(n) → 0-basierter Index (A→0, B→1, AA→26, …)."""
    letters = "".join(c for c in ref if c.isalpha())
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - ord("A") + 1)
    return n - 1

def parse_xlsx(path: str, sheet_name: str) -> list[dict[str, str]]:
    """
    Gibt Zeilen des gesuchten Sheets als Liste von Dicts zurück.
    Keys sind die normalisierten Spaltennamen aus der Header-Zeile (lowercase).
    Damit ist das Mapping reihenfolge-unabhängig und robust gegen künftige
    Umstrukturierungen der Excel-Datei.
    """
    with zipfile.ZipFile(path) as z:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
        shared = [t.text or "" for t in ss.findall(".//x:t", NS)]

        sheet_rels = {r.get("Id"): r.get("Target", "") for r in rels.findall("r:Relationship", REL_NS)}
        target: str | None = None
        for s in wb.findall(".//x:sheet", NS):
            if s.get("name") == sheet_name:
                rid = s.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id", "")
                target = sheet_rels.get(rid)
                break

        if not target:
            raise ValueError(f"Blatt '{sheet_name}' nicht gefunden.")

        ws = ET.fromstring(z.read(f"xl/{target}"))

        def cell_val(c: ET.Element) -> str:
            t = c.get("t", "")
            v = c.find("x:v", NS)
            if v is None:
                return ""
            if t == "s":
                return shared[int(v.text or "0")]
            return (v.text or "").strip()

        all_rows: list[dict[int, str]] = []
        for row_el in ws.findall(".//x:row", NS):
            row: dict[int, str] = {}
            for c in row_el.findall("x:c", NS):
                ci = col_idx(c.get("r", "A"))
                row[ci] = cell_val(c)
            all_rows.append(row)

        if not all_rows:
            return []

        # Erste Zeile = Header → Index-zu-Name-Map aufbauen
        header_row = all_rows[0]
        idx_to_name: dict[int, str] = {
            idx: val.strip().lower() for idx, val in header_row.items() if val.strip()
        }

        # Datenzeilen mit benannten Spalten zurückgeben
        result: list[dict[str, str]] = []
        for raw in all_rows[1:]:
            named: dict[str, str] = {}
            for idx, val in raw.items():
                name = idx_to_name.get(idx)
                if name:
                    named[name] = val
            result.append(named)
        return result

# ── Zeilen in article_prices-Datensätze umwandeln ─────────────────────────────

def parse_int(v: str) -> int | None:
    try:
        return int(v)
    except (ValueError, TypeError):
        return None

def parse_num(v: str) -> float | None:
    if not v or not v.strip():
        return None
    try:
        return float(v.replace(",", "."))
    except (ValueError, TypeError):
        return None

def profile_length_from_bezeichnung(bez: str) -> int | None:
    """Extrahiert Länge aus Profilbezeichnung, z.B. 'Profil 30mm 420' → 420."""
    m = re.search(r"(\d+)$", bez.strip())
    if m:
        return int(m.group(1))
    return None

def row_to_record(raw: dict[str, str]) -> dict | None:
    """
    Mappt eine Excel-Zeile (benannte Spalten aus Header-Zeile) auf ein
    article_prices-Objekt. Gibt None zurück wenn Zeile übersprungen werden soll.

    Erwartet lowercase Spaltennamen; reihenfolge-unabhängig.
    Unterstützte Varianten (Verkaufspreise_02 und dummy):
      art_nr / Art_Nr, typ / Typ, pg1_mdf_eur, pg2_alu_eur, pg3_furnier_eur,
      pg4_glas_eur, pg1_mdf_chf, pg2_alu_chf, pg3_furnier_chf, pg4_glas_chf
    """
    art_nr = raw.get("art_nr", "").strip()
    typ = raw.get("typ", "").strip()
    kategorie = raw.get("kategorie", "").strip()
    bezeichnung = raw.get("bezeichnung", "").strip()

    # Leere Zeile oder ungültiger Typ → überspringen
    if not art_nr or typ not in ("Platte", "Zubehör"):
        return None

    # Würfel: Kategorie aus Bezeichnung ableiten (falls leer)
    if not kategorie and bezeichnung:
        kategorie = bezeichnung

    # Würfel: Excel-Kategorie 'Würfel' auf 'Würfel 30mm' normalisieren (route.ts-Lookup)
    if kategorie == "Würfel":
        kategorie = "Würfel 30mm"

    pg1_eur = parse_num(raw.get("pg1_mdf_eur", ""))
    if pg1_eur is None:
        return None  # Kein Pflichtpreis → überspringen

    breite_mm = parse_int(raw.get("breite_mm", ""))
    tiefe_mm = parse_int(raw.get("tiefe_mm", ""))

    # Profile: Länge aus Bezeichnung extrahieren und in breite_mm speichern
    if kategorie == "Profil" and breite_mm is None:
        breite_mm = profile_length_from_bezeichnung(bezeichnung)

    return {
        "art_nr": art_nr,
        "typ": typ,
        "kategorie": kategorie,
        "bezeichnung": bezeichnung,
        "breite_mm": breite_mm,
        "tiefe_mm": tiefe_mm,
        "pg1_eur": pg1_eur,
        "pg2_eur": parse_num(raw.get("pg2_furnier_eur", "")),
        "pg3_eur": parse_num(raw.get("pg3_alu_eur", "")),
        "pg4_eur": parse_num(raw.get("pg4_glas_eur", "")),
        "pg1_chf": parse_num(raw.get("pg1_mdf_chf", "")),
        "pg2_chf": parse_num(raw.get("pg2_furnier_chf", "")),
        "pg3_chf": parse_num(raw.get("pg3_alu_chf", "")),
        "pg4_chf": parse_num(raw.get("pg4_glas_chf", "")),
    }

# ── Supabase-Upsert ───────────────────────────────────────────────────────────

def supabase_upsert(records: list[dict]) -> tuple[int, int, int]:
    """
    Schreibt Datensätze via REST-API in article_prices.
    Gibt (inserted, updated, skipped) zurück — Supabase gibt bei Upsert
    keine genaue Unterscheidung; wir approximieren es.
    """
    if not SUPABASE_URL or not SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nicht gesetzt.\n"
            "Bitte .env.local prüfen oder Umgebungsvariablen setzen."
        )

    url = f"{SUPABASE_URL}/rest/v1/article_prices"
    headers = {
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }

    # In Batches von 50 schreiben
    batch_size = 50
    inserted = 0
    updated = 0
    skipped = 0

    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        body = json.dumps(batch).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                inserted += len(result)
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            print(f"  HTTP {e.code}: {error_body}")
            skipped += len(batch)

    return inserted, updated, skipped

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    xlsx_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_XLSX

    if not os.path.exists(xlsx_path):
        print(f"Fehler: Datei nicht gefunden: {xlsx_path}")
        sys.exit(1)

    print(f"Lese Excel: {xlsx_path}")
    print(f"Blatt: {SHEET_NAME}")
    raw_rows = parse_xlsx(xlsx_path, SHEET_NAME)
    print(f"Rohdaten: {len(raw_rows)} Zeilen gelesen")

    records = []
    skipped_parse = 0
    for r in raw_rows:
        rec = row_to_record(r)
        if rec:
            records.append(rec)
        else:
            skipped_parse += 1

    print(f"Verarbeitbar: {len(records)} Datensätze ({skipped_parse} übersprungen)")

    print(f"\nSchreibe in Supabase ({SUPABASE_URL}) …")
    inserted, updated, skipped = supabase_upsert(records)

    print(f"\nErgebnis:")
    print(f"  Geschrieben:    {inserted}")
    print(f"  Übersprungen:   {skipped}")
    print("Fertig.")

if __name__ == "__main__":
    main()
