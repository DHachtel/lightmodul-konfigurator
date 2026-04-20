-- PG2 ↔ PG4 Spaltentausch in article_prices
-- Nach dem vorherigen PG2↔PG3-Tausch enthält pg2 jetzt Glas-Preise und pg4 Furnier-Preise.
-- Dieser Tausch bringt Furnier → pg2 und Glas → pg4 (korrekte Zuordnung).
ALTER TABLE article_prices ADD COLUMN IF NOT EXISTS _tmp_pg2_eur NUMERIC;
ALTER TABLE article_prices ADD COLUMN IF NOT EXISTS _tmp_pg2_chf NUMERIC;

UPDATE article_prices SET
  _tmp_pg2_eur = pg2_eur,
  _tmp_pg2_chf = pg2_chf;

UPDATE article_prices SET
  pg2_eur = pg4_eur,
  pg2_chf = pg4_chf,
  pg4_eur = _tmp_pg2_eur,
  pg4_chf = _tmp_pg2_chf;

ALTER TABLE article_prices DROP COLUMN _tmp_pg2_eur;
ALTER TABLE article_prices DROP COLUMN _tmp_pg2_chf;
