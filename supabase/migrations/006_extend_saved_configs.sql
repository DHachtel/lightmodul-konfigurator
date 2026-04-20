-- supabase/migrations/006_extend_saved_configs.sql

ALTER TABLE saved_configs
  ADD COLUMN IF NOT EXISTS bom_json JSONB;
