-- supabase/migrations/003_saved_configs.sql

CREATE TABLE saved_configs (
  config_code BIGINT PRIMARY KEY,
  config_json JSONB NOT NULL,
  screenshot  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE saved_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON saved_configs
  FOR SELECT USING (true);

CREATE POLICY "Public insert" ON saved_configs
  FOR INSERT WITH CHECK (true);
