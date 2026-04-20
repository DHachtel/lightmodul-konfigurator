"""
import-prices.py
----------------
Liest das Sheet "Konfigurator_Export" aus Verkaufspreise_aktiv.xlsx
und importiert alle Preise per UPSERT in die Supabase-Tabelle article_prices.

Voraussetzungen:
    pip install pandas openpyxl requests

Konfiguration:
    SUPABASE_URL und SUPABASE_KEY entweder als Umgebungsvariablen setzen
    oder direkt in die Konstanten unten eintragen.

Aufruf:
    python import-prices.py
    python import-prices.py --dry-run     (nur anzeigen, nichts schreiben)
"""

import sys
import os
import json
import argparse
import requests
import pandas as pd

# ── Konfiguration ─────────────────────────────────────────────────────────────
EXCEL_FILE  = "Verkaufspreise_aktiv.xlsx"
SHEET_NAME  = "Konfigurator_Export"
TABLE_NAME  = "article_prices"

SUPABASE_URL = os.getenv("SUPABASE_URL", "")   # z.B. https://xxxx.supabase.co
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")   # Service-Role-Key (nicht anon!)
# ──────────────────────────────────────────────────────────────────────────────

# Spaltenmapping Excel → Datenbank
COLUMN_MAP = {
    "art_nr":           "art_nr",
    "typ":              "typ",
    "kategorie":        "kategorie",
    "bezeichnung":      "bezeichnung",
    "breite_mm":        "breite_mm",
    "tiefe_mm":         "tiefe_mm",
    "pg1_mdf_eur":      "pg1_eur",
    "pg2_furnier_eur":  "pg2_eur",
    "pg3_alu_eur":      "pg3_eur",
    "pg4_glas_eur":     "pg4_eur",
    "pg1_mdf_chf":      "pg1_chf",
    "pg2_furnier_chf":  "pg2_chf",
    "pg3_alu_chf":      "pg3_chf",
    "pg4_glas_chf":     "pg4_chf",
}


def load_excel(path: str) -> pd.DataFrame:
    print(f"📂  Lese '{path}' → Sheet '{SHEET_NAME}' …")
    df = pd.read_excel(path, sheet_name=SHEET_NAME, header=0)

    # Nur relevante Spalten behalten und umbenennen
    df = df[list(COLUMN_MAP.keys())].rename(columns=COLUMN_MAP)

    # art_nr als String (führende Nullen erhalten)
    df["art_nr"] = df["art_nr"].astype(str).str.strip()

    # Leere Zeilen entfernen
    df = df[df["art_nr"].str.len() > 0]

    # NaN → None (damit Supabase NULL schreibt, nicht "NaN")
    df = df.where(pd.notna(df), None)

    # Numerische Spalten sicherstellen
    num_cols = ["breite_mm", "tiefe_mm",
                "pg1_eur", "pg2_eur", "pg3_eur", "pg4_eur",
                "pg1_chf", "pg2_chf", "pg3_chf", "pg4_chf"]
    for col in num_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        df[col] = df[col].where(pd.notna(df[col]), None)

    print(f"✅  {len(df)} Artikel geladen.")
    return df


def upsert_to_supabase(df: pd.DataFrame, dry_run: bool):
    if dry_run:
        print("\n🔍  DRY-RUN — erste 5 Datensätze die geschrieben würden:")
        print(df.head().to_string())
        print(f"\n→ Gesamt: {len(df)} Zeilen (nichts wurde geschrieben)")
        return

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("\n❌  SUPABASE_URL oder SUPABASE_KEY fehlt!")
        print("    Zeilen 30–31 im Script ausfüllen.")
        sys.exit(1)

    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{TABLE_NAME}"
    headers = {
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "resolution=merge-duplicates,return=minimal",
    }

    records = df.to_dict(orient="records")
    batch_size = 50
    total = len(records)
    errors = []

    print(f"⬆️   Importiere {total} Artikel in '{TABLE_NAME}' …")

    for i in range(0, total, batch_size):
        batch = records[i:i + batch_size]
        try:
            resp = requests.post(url, headers=headers, data=json.dumps(batch, default=str))
            resp.raise_for_status()
            done = min(i + batch_size, total)
            print(f"    {done}/{total} ✓")
        except Exception as e:
            errors.append((i, str(e)))
            print(f"    ⚠️  Fehler bei Batch {i}–{i+batch_size}: {e}")

    if errors:
        print(f"\n⚠️  Import abgeschlossen mit {len(errors)} Fehler(n).")
    else:
        print(f"\n✅  Import erfolgreich — {total} Artikel aktualisiert.")


def main():
    parser = argparse.ArgumentParser(description="Preise aus Excel → Supabase importieren")
    parser.add_argument("--dry-run", action="store_true",
                        help="Nur anzeigen, nichts in die DB schreiben")
    parser.add_argument("--file", default=EXCEL_FILE,
                        help=f"Excel-Datei (Standard: {EXCEL_FILE})")
    args = parser.parse_args()

    # Excel-Datei relativ zum Script suchen
    script_dir = os.path.dirname(os.path.abspath(__file__))
    excel_path = os.path.join(script_dir, args.file)

    if not os.path.exists(excel_path):
        print(f"❌  Datei nicht gefunden: {excel_path}")
        sys.exit(1)

    df = load_excel(excel_path)
    upsert_to_supabase(df, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
