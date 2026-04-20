-- ═══════════════════════════════════════════════════════════════════
-- 002_pricing.sql
-- Artmodul Configurator — Preissystem
-- ═══════════════════════════════════════════════════════════════════

-- ── Artikelpreise ─────────────────────────────────────────────────
CREATE TABLE article_prices (
  art_nr      TEXT PRIMARY KEY,
  typ         TEXT NOT NULL CHECK (typ IN ('Platte', 'Zubehör')),
  kategorie   TEXT NOT NULL,
  bezeichnung TEXT NOT NULL,
  breite_mm   INTEGER,
  tiefe_mm    INTEGER,
  pg1_eur     NUMERIC NOT NULL,
  pg2_eur     NUMERIC,
  pg3_eur     NUMERIC,
  pg4_eur     NUMERIC,
  pg1_chf     NUMERIC,
  pg2_chf     NUMERIC,
  pg3_chf     NUMERIC,
  pg4_chf     NUMERIC
);

ALTER TABLE article_prices ENABLE ROW LEVEL SECURITY;

-- Preise für alle lesbar (UVP ist öffentlich)
CREATE POLICY "Preise öffentlich lesbar" ON article_prices
  FOR SELECT USING (true);

-- Nur Admins dürfen Preise anlegen / ändern / löschen
CREATE POLICY "Nur Admin: Preise schreiben" ON article_prices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── Händlerrabatt zu profiles hinzufügen ──────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS discount_pct NUMERIC DEFAULT 0.30;

-- Trigger: Nur Admins dürfen discount_pct ändern
CREATE OR REPLACE FUNCTION protect_discount_pct()
RETURNS TRIGGER AS $$
BEGIN
  -- Änderung am Rabatt erlaubt nur für Admins
  IF NEW.discount_pct IS DISTINCT FROM OLD.discount_pct THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) THEN
      NEW.discount_pct := OLD.discount_pct;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER profiles_protect_discount_pct
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_discount_pct();

-- Admins dürfen alle Profile lesen (für Rabatt-Verwaltung)
CREATE POLICY "Admin: Alle Profile lesbar" ON profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
