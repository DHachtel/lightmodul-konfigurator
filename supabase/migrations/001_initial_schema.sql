-- ═══════════════════════════════════════════════════════════════════
-- 001_initial_schema.sql
-- Artmodul Configurator — Initiales Datenbankschema
-- ═══════════════════════════════════════════════════════════════════

-- ── Nutzerprofile (ergänzt Supabase Auth) ────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer', 'dealer', 'admin')),
  company     TEXT,
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eigenes Profil lesbar" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Eigenes Profil änderbar" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ── Konfigurationen ──────────────────────────────────────────────
CREATE TABLE configurations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Unbenannte Konfiguration',
  state       JSONB NOT NULL,        -- ConfigState als JSON
  bom_cache   JSONB,                 -- Gecachte BOM-Berechnung
  share_token TEXT UNIQUE,           -- Für Share-Link (Phase 4)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eigene Konfigurationen" ON configurations
  FOR ALL USING (auth.uid() = user_id);

-- ── Händler-Anträge ──────────────────────────────────────────────
CREATE TABLE dealer_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company      TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  message      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE dealer_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eigener Antrag lesbar" ON dealer_applications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Antrag erstellen" ON dealer_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Trigger: updated_at automatisch setzen ───────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER configurations_updated_at
  BEFORE UPDATE ON configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
