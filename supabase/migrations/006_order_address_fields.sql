-- supabase/migrations/006_order_address_fields.sql
-- Erweitert orders um Kontakt-/Adressfelder und DSGVO-Einwilligung

ALTER TABLE orders ADD COLUMN customer_phone TEXT;
ALTER TABLE orders ADD COLUMN customer_company TEXT;
ALTER TABLE orders ADD COLUMN customer_street TEXT;
ALTER TABLE orders ADD COLUMN customer_zip TEXT;
ALTER TABLE orders ADD COLUMN customer_city TEXT;
ALTER TABLE orders ADD COLUMN gdpr_consent_at TIMESTAMPTZ;
