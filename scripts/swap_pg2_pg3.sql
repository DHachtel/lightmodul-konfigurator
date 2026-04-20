-- PG2 ↔ PG3 Spaltentausch in article_prices
-- Temporäre Spalten nutzen, um atomaren Tausch sicherzustellen
ALTER TABLE article_prices ADD COLUMN IF NOT EXISTS _tmp_pg2_eur NUMERIC;
ALTER TABLE article_prices ADD COLUMN IF NOT EXISTS _tmp_pg2_chf NUMERIC;

UPDATE article_prices SET
  _tmp_pg2_eur = pg2_eur,
  _tmp_pg2_chf = pg2_chf;

UPDATE article_prices SET
  pg2_eur = pg3_eur,
  pg2_chf = pg3_chf,
  pg3_eur = _tmp_pg2_eur,
  pg3_chf = _tmp_pg2_chf;

ALTER TABLE article_prices DROP COLUMN _tmp_pg2_eur;
ALTER TABLE article_prices DROP COLUMN _tmp_pg2_chf;
