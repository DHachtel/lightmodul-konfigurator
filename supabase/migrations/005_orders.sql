-- supabase/migrations/005_orders.sql

-- Auftrags-Tabelle
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_nr         TEXT UNIQUE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'submitted'
                     CHECK (status IN ('draft','submitted','confirmed','completed','cancelled')),
  status_changed_at TIMESTAMPTZ DEFAULT now(),
  customer_name    TEXT,
  customer_email   TEXT,
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert" ON orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service select" ON orders
  FOR SELECT USING (false);

-- Auftragsnummer-Trigger
CREATE OR REPLACE FUNCTION generate_order_nr()
RETURNS TRIGGER AS $$
DECLARE
  yr TEXT;
  next_nr INTEGER;
BEGIN
  yr := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_nr FROM 9) AS INTEGER)), 0) + 1
    INTO next_nr
    FROM orders
    WHERE order_nr LIKE 'AM-' || yr || '-%';
  NEW.order_nr := 'AM-' || yr || '-' || LPAD(next_nr::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_nr
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_nr IS NULL OR NEW.order_nr = '')
  EXECUTE FUNCTION generate_order_nr();

-- Auftrags-Positionen
CREATE TABLE order_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  config_code      BIGINT NOT NULL REFERENCES saved_configs(config_code),
  quantity         INTEGER NOT NULL DEFAULT 1,
  unit_price       NUMERIC,
  currency         TEXT NOT NULL DEFAULT 'EUR'
                     CHECK (currency IN ('EUR','CHF'))
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public insert" ON order_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service select" ON order_items
  FOR SELECT USING (false);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
