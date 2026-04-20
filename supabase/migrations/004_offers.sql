-- supabase/migrations/004_offers.sql

CREATE TABLE offers (
  offer_code   BIGINT PRIMARY KEY,
  config_codes BIGINT[] NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON offers
  FOR SELECT USING (true);

CREATE POLICY "Public insert" ON offers
  FOR INSERT WITH CHECK (true);
