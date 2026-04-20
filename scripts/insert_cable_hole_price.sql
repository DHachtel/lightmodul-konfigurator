-- Kabeldurchlass als eigenen Preiseintrag anlegen
-- art_nr 9001 ist bereits als CABLE_HOLE_ART_NR in constants.ts definiert
INSERT INTO article_prices (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm, pg1_eur, pg1_chf, pg2_eur, pg2_chf, pg3_eur, pg3_chf, pg4_eur, pg4_chf)
VALUES ('9001', 'Zubehör', 'Kabeldurchlass', 'Kabeldurchlass ⌀80mm', NULL, NULL, 22.00, 24.00, 22.00, 24.00, 22.00, 24.00, 22.00, 24.00)
ON CONFLICT (art_nr) DO UPDATE SET
  pg1_eur = 22.00, pg1_chf = 24.00,
  pg2_eur = 22.00, pg2_chf = 24.00,
  pg3_eur = 22.00, pg3_chf = 24.00,
  pg4_eur = 22.00, pg4_chf = 24.00;
