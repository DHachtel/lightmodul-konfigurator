-- ═══════════════════════════════════════════════════════════════════════════
-- seed_article_prices.sql
-- Artmodul Konfigurator — Platzhalterpreise für article_prices-Tabelle
-- ───────────────────────────────────────────────────────────────────────────
-- Idempotent: ON CONFLICT (art_nr) DO UPDATE — beliebig oft ausführbar.
--
-- Spalten: art_nr | typ | kategorie | bezeichnung | breite_mm | tiefe_mm
--          pg1_eur | pg2_eur | pg3_eur | pg4_eur
--          pg1_chf | pg2_chf | pg3_chf | pg4_chf
--
-- Preisgruppen (Platten, material-abhängig):
--   pg1 = Kunstharz/MDF (Basispreis)
--   pg2 = Aluminium     × 1.40
--   pg3 = Glas          × 2.00
--   pg4 = Furnier       × 1.80
--   CHF = EUR × 1.08
--
-- Zubehör (Würfel, Profile, Griffe, Füße): immer PG1, pg2–pg4 = NULL.
--
-- ACHTUNG: art_nrs der Füße/Rollen MÜSSEN mit constants.ts übereinstimmen:
--   8080 = Stellfuß 50mm, 8051 = Rolle Parkett,
--   8050 = Rolle Teppich, 8081 = Nivellierschraube
-- ═══════════════════════════════════════════════════════════════════════════

-- Hilfsmakro-Kommentar für Platten-Zeilen:
-- Spaltenreihenfolge VALUES:
--   art_nr, typ, kat, bez, breite, tiefe,
--   pg1_eur,
--   pg2_eur (=ROUND(pg1*1.40,2)),
--   pg3_eur (=ROUND(pg1*2.00,2)),
--   pg4_eur (=ROUND(pg1*1.80,2)),
--   pg1_chf (=ROUND(pg1*1.08,2)),
--   pg2_chf (=ROUND(pg1*1.512,2)),
--   pg3_chf (=ROUND(pg1*2.16,2)),
--   pg4_chf (=ROUND(pg1*1.944,2))

-- ── 1. WÜRFEL ────────────────────────────────────────────────────────────────
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('WU-001', 'Zubehör', 'Würfel 30mm', 'Würfel 30mm', NULL, NULL,
   2.50, NULL, NULL, NULL, 2.70, NULL, NULL, NULL)
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 2. PROFILE (Zubehör — Länge in breite_mm, tiefe_mm = NULL) ──────────────
-- Alle möglichen Längen aus WIDTHS + HEIGHTS + DEPTHS:
-- 180, 360, 420, 580, 720, 780, 980, 1080, 1440, 1800
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('PR-180',  'Zubehör', 'Profil', 'Profil 30mm 180mm',  180,  NULL, 1.60, NULL, NULL, NULL, 1.73, NULL, NULL, NULL),
  ('PR-360',  'Zubehör', 'Profil', 'Profil 30mm 360mm',  360,  NULL, 2.50, NULL, NULL, NULL, 2.70, NULL, NULL, NULL),
  ('PR-420',  'Zubehör', 'Profil', 'Profil 30mm 420mm',  420,  NULL, 2.90, NULL, NULL, NULL, 3.13, NULL, NULL, NULL),
  ('PR-580',  'Zubehör', 'Profil', 'Profil 30mm 580mm',  580,  NULL, 3.60, NULL, NULL, NULL, 3.89, NULL, NULL, NULL),
  ('PR-720',  'Zubehör', 'Profil', 'Profil 30mm 720mm',  720,  NULL, 4.30, NULL, NULL, NULL, 4.64, NULL, NULL, NULL),
  ('PR-780',  'Zubehör', 'Profil', 'Profil 30mm 780mm',  780,  NULL, 4.60, NULL, NULL, NULL, 4.97, NULL, NULL, NULL),
  ('PR-980',  'Zubehör', 'Profil', 'Profil 30mm 980mm',  980,  NULL, 5.60, NULL, NULL, NULL, 6.05, NULL, NULL, NULL),
  ('PR-1080', 'Zubehör', 'Profil', 'Profil 30mm 1080mm', 1080, NULL, 6.10, NULL, NULL, NULL, 6.59, NULL, NULL, NULL),
  ('PR-1440', 'Zubehör', 'Profil', 'Profil 30mm 1440mm', 1440, NULL, 7.90, NULL, NULL, NULL, 8.53, NULL, NULL, NULL),
  ('PR-1800', 'Zubehör', 'Profil', 'Profil 30mm 1800mm', 1800, NULL, 9.60, NULL, NULL, NULL,10.37, NULL, NULL, NULL)
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 3. BÖDEN STANDARD (breite_mm=Spaltenbreite, tiefe_mm=Tiefe) ──────────────
-- WIDTHS × DEPTHS: 420,580,780,980 × 360,580
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('BO-420-360','Platte','Boden','Boden 420×360mm', 420,360,  6.00,ROUND(( 6.00*1.40)::numeric,2),ROUND(( 6.00*2.00)::numeric,2),ROUND(( 6.00*1.80)::numeric,2),ROUND(( 6.00*1.08)::numeric,2),ROUND(( 6.00*1.512)::numeric,2),ROUND(( 6.00*2.16)::numeric,2),ROUND(( 6.00*1.944)::numeric,2)),
  ('BO-420-580','Platte','Boden','Boden 420×580mm', 420,580, 10.00,ROUND((10.00*1.40)::numeric,2),ROUND((10.00*2.00)::numeric,2),ROUND((10.00*1.80)::numeric,2),ROUND((10.00*1.08)::numeric,2),ROUND((10.00*1.512)::numeric,2),ROUND((10.00*2.16)::numeric,2),ROUND((10.00*1.944)::numeric,2)),
  ('BO-580-360','Platte','Boden','Boden 580×360mm', 580,360,  8.50,ROUND(( 8.50*1.40)::numeric,2),ROUND(( 8.50*2.00)::numeric,2),ROUND(( 8.50*1.80)::numeric,2),ROUND(( 8.50*1.08)::numeric,2),ROUND(( 8.50*1.512)::numeric,2),ROUND(( 8.50*2.16)::numeric,2),ROUND(( 8.50*1.944)::numeric,2)),
  ('BO-580-580','Platte','Boden','Boden 580×580mm', 580,580, 13.50,ROUND((13.50*1.40)::numeric,2),ROUND((13.50*2.00)::numeric,2),ROUND((13.50*1.80)::numeric,2),ROUND((13.50*1.08)::numeric,2),ROUND((13.50*1.512)::numeric,2),ROUND((13.50*2.16)::numeric,2),ROUND((13.50*1.944)::numeric,2)),
  ('BO-780-360','Platte','Boden','Boden 780×360mm', 780,360, 11.00,ROUND((11.00*1.40)::numeric,2),ROUND((11.00*2.00)::numeric,2),ROUND((11.00*1.80)::numeric,2),ROUND((11.00*1.08)::numeric,2),ROUND((11.00*1.512)::numeric,2),ROUND((11.00*2.16)::numeric,2),ROUND((11.00*1.944)::numeric,2)),
  ('BO-780-580','Platte','Boden','Boden 780×580mm', 780,580, 18.00,ROUND((18.00*1.40)::numeric,2),ROUND((18.00*2.00)::numeric,2),ROUND((18.00*1.80)::numeric,2),ROUND((18.00*1.08)::numeric,2),ROUND((18.00*1.512)::numeric,2),ROUND((18.00*2.16)::numeric,2),ROUND((18.00*1.944)::numeric,2)),
  ('BO-980-360','Platte','Boden','Boden 980×360mm', 980,360, 14.00,ROUND((14.00*1.40)::numeric,2),ROUND((14.00*2.00)::numeric,2),ROUND((14.00*1.80)::numeric,2),ROUND((14.00*1.08)::numeric,2),ROUND((14.00*1.512)::numeric,2),ROUND((14.00*2.16)::numeric,2),ROUND((14.00*1.944)::numeric,2)),
  ('BO-980-580','Platte','Boden','Boden 980×580mm', 980,580, 23.00,ROUND((23.00*1.40)::numeric,2),ROUND((23.00*2.00)::numeric,2),ROUND((23.00*1.80)::numeric,2),ROUND((23.00*1.08)::numeric,2),ROUND((23.00*1.512)::numeric,2),ROUND((23.00*2.16)::numeric,2),ROUND((23.00*1.944)::numeric,2))
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 4. KLAPPENBÖDEN (gleiche Maße wie Böden) ─────────────────────────────────
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('KBO-420-360','Platte','Klappenboden','Klappenboden 420×360mm', 420,360,  6.00,ROUND(( 6.00*1.40)::numeric,2),ROUND(( 6.00*2.00)::numeric,2),ROUND(( 6.00*1.80)::numeric,2),ROUND(( 6.00*1.08)::numeric,2),ROUND(( 6.00*1.512)::numeric,2),ROUND(( 6.00*2.16)::numeric,2),ROUND(( 6.00*1.944)::numeric,2)),
  ('KBO-420-580','Platte','Klappenboden','Klappenboden 420×580mm', 420,580, 10.00,ROUND((10.00*1.40)::numeric,2),ROUND((10.00*2.00)::numeric,2),ROUND((10.00*1.80)::numeric,2),ROUND((10.00*1.08)::numeric,2),ROUND((10.00*1.512)::numeric,2),ROUND((10.00*2.16)::numeric,2),ROUND((10.00*1.944)::numeric,2)),
  ('KBO-580-360','Platte','Klappenboden','Klappenboden 580×360mm', 580,360,  8.50,ROUND(( 8.50*1.40)::numeric,2),ROUND(( 8.50*2.00)::numeric,2),ROUND(( 8.50*1.80)::numeric,2),ROUND(( 8.50*1.08)::numeric,2),ROUND(( 8.50*1.512)::numeric,2),ROUND(( 8.50*2.16)::numeric,2),ROUND(( 8.50*1.944)::numeric,2)),
  ('KBO-580-580','Platte','Klappenboden','Klappenboden 580×580mm', 580,580, 13.50,ROUND((13.50*1.40)::numeric,2),ROUND((13.50*2.00)::numeric,2),ROUND((13.50*1.80)::numeric,2),ROUND((13.50*1.08)::numeric,2),ROUND((13.50*1.512)::numeric,2),ROUND((13.50*2.16)::numeric,2),ROUND((13.50*1.944)::numeric,2)),
  ('KBO-780-360','Platte','Klappenboden','Klappenboden 780×360mm', 780,360, 11.00,ROUND((11.00*1.40)::numeric,2),ROUND((11.00*2.00)::numeric,2),ROUND((11.00*1.80)::numeric,2),ROUND((11.00*1.08)::numeric,2),ROUND((11.00*1.512)::numeric,2),ROUND((11.00*2.16)::numeric,2),ROUND((11.00*1.944)::numeric,2)),
  ('KBO-780-580','Platte','Klappenboden','Klappenboden 780×580mm', 780,580, 18.00,ROUND((18.00*1.40)::numeric,2),ROUND((18.00*2.00)::numeric,2),ROUND((18.00*1.80)::numeric,2),ROUND((18.00*1.08)::numeric,2),ROUND((18.00*1.512)::numeric,2),ROUND((18.00*2.16)::numeric,2),ROUND((18.00*1.944)::numeric,2)),
  ('KBO-980-360','Platte','Klappenboden','Klappenboden 980×360mm', 980,360, 14.00,ROUND((14.00*1.40)::numeric,2),ROUND((14.00*2.00)::numeric,2),ROUND((14.00*1.80)::numeric,2),ROUND((14.00*1.08)::numeric,2),ROUND((14.00*1.512)::numeric,2),ROUND((14.00*2.16)::numeric,2),ROUND((14.00*1.944)::numeric,2)),
  ('KBO-980-580','Platte','Klappenboden','Klappenboden 980×580mm', 980,580, 23.00,ROUND((23.00*1.40)::numeric,2),ROUND((23.00*2.00)::numeric,2),ROUND((23.00*1.80)::numeric,2),ROUND((23.00*1.08)::numeric,2),ROUND((23.00*1.512)::numeric,2),ROUND((23.00*2.16)::numeric,2),ROUND((23.00*1.944)::numeric,2))
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 5. FACHBÖDEN KLEIN (breite_mm=Spaltenbreite, tiefe_mm=Tiefe) ─────────────
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('FB-420-360','Platte','Fachboden klein','Fachboden 420×360mm', 420,360,  5.50,ROUND(( 5.50*1.40)::numeric,2),ROUND(( 5.50*2.00)::numeric,2),ROUND(( 5.50*1.80)::numeric,2),ROUND(( 5.50*1.08)::numeric,2),ROUND(( 5.50*1.512)::numeric,2),ROUND(( 5.50*2.16)::numeric,2),ROUND(( 5.50*1.944)::numeric,2)),
  ('FB-420-580','Platte','Fachboden klein','Fachboden 420×580mm', 420,580,  9.00,ROUND(( 9.00*1.40)::numeric,2),ROUND(( 9.00*2.00)::numeric,2),ROUND(( 9.00*1.80)::numeric,2),ROUND(( 9.00*1.08)::numeric,2),ROUND(( 9.00*1.512)::numeric,2),ROUND(( 9.00*2.16)::numeric,2),ROUND(( 9.00*1.944)::numeric,2)),
  ('FB-580-360','Platte','Fachboden klein','Fachboden 580×360mm', 580,360,  7.80,ROUND(( 7.80*1.40)::numeric,2),ROUND(( 7.80*2.00)::numeric,2),ROUND(( 7.80*1.80)::numeric,2),ROUND(( 7.80*1.08)::numeric,2),ROUND(( 7.80*1.512)::numeric,2),ROUND(( 7.80*2.16)::numeric,2),ROUND(( 7.80*1.944)::numeric,2)),
  ('FB-580-580','Platte','Fachboden klein','Fachboden 580×580mm', 580,580, 12.50,ROUND((12.50*1.40)::numeric,2),ROUND((12.50*2.00)::numeric,2),ROUND((12.50*1.80)::numeric,2),ROUND((12.50*1.08)::numeric,2),ROUND((12.50*1.512)::numeric,2),ROUND((12.50*2.16)::numeric,2),ROUND((12.50*1.944)::numeric,2)),
  ('FB-780-360','Platte','Fachboden klein','Fachboden 780×360mm', 780,360, 10.00,ROUND((10.00*1.40)::numeric,2),ROUND((10.00*2.00)::numeric,2),ROUND((10.00*1.80)::numeric,2),ROUND((10.00*1.08)::numeric,2),ROUND((10.00*1.512)::numeric,2),ROUND((10.00*2.16)::numeric,2),ROUND((10.00*1.944)::numeric,2)),
  ('FB-780-580','Platte','Fachboden klein','Fachboden 780×580mm', 780,580, 16.50,ROUND((16.50*1.40)::numeric,2),ROUND((16.50*2.00)::numeric,2),ROUND((16.50*1.80)::numeric,2),ROUND((16.50*1.08)::numeric,2),ROUND((16.50*1.512)::numeric,2),ROUND((16.50*2.16)::numeric,2),ROUND((16.50*1.944)::numeric,2)),
  ('FB-980-360','Platte','Fachboden klein','Fachboden 980×360mm', 980,360, 12.80,ROUND((12.80*1.40)::numeric,2),ROUND((12.80*2.00)::numeric,2),ROUND((12.80*1.80)::numeric,2),ROUND((12.80*1.08)::numeric,2),ROUND((12.80*1.512)::numeric,2),ROUND((12.80*2.16)::numeric,2),ROUND((12.80*1.944)::numeric,2)),
  ('FB-980-580','Platte','Fachboden klein','Fachboden 980×580mm', 980,580, 21.00,ROUND((21.00*1.40)::numeric,2),ROUND((21.00*2.00)::numeric,2),ROUND((21.00*1.80)::numeric,2),ROUND((21.00*1.08)::numeric,2),ROUND((21.00*1.512)::numeric,2),ROUND((21.00*2.16)::numeric,2),ROUND((21.00*1.944)::numeric,2))
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 6. RÜCKEN (breite_mm=Spaltenbreite, tiefe_mm=Zeilenhöhe) ─────────────────
-- WIDTHS × HEIGHTS: 420,580,780,980 × 180,360,580,720,1080,1440,1800
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('RK-420-180', 'Platte','Rücken','Rücken 420×180mm',  420, 180,  2.50,ROUND(( 2.50*1.40)::numeric,2),ROUND(( 2.50*2.00)::numeric,2),ROUND(( 2.50*1.80)::numeric,2),ROUND(( 2.50*1.08)::numeric,2),ROUND(( 2.50*1.512)::numeric,2),ROUND(( 2.50*2.16)::numeric,2),ROUND(( 2.50*1.944)::numeric,2)),
  ('RK-420-360', 'Platte','Rücken','Rücken 420×360mm',  420, 360,  5.50,ROUND(( 5.50*1.40)::numeric,2),ROUND(( 5.50*2.00)::numeric,2),ROUND(( 5.50*1.80)::numeric,2),ROUND(( 5.50*1.08)::numeric,2),ROUND(( 5.50*1.512)::numeric,2),ROUND(( 5.50*2.16)::numeric,2),ROUND(( 5.50*1.944)::numeric,2)),
  ('RK-420-580', 'Platte','Rücken','Rücken 420×580mm',  420, 580,  8.50,ROUND(( 8.50*1.40)::numeric,2),ROUND(( 8.50*2.00)::numeric,2),ROUND(( 8.50*1.80)::numeric,2),ROUND(( 8.50*1.08)::numeric,2),ROUND(( 8.50*1.512)::numeric,2),ROUND(( 8.50*2.16)::numeric,2),ROUND(( 8.50*1.944)::numeric,2)),
  ('RK-420-720', 'Platte','Rücken','Rücken 420×720mm',  420, 720, 10.50,ROUND((10.50*1.40)::numeric,2),ROUND((10.50*2.00)::numeric,2),ROUND((10.50*1.80)::numeric,2),ROUND((10.50*1.08)::numeric,2),ROUND((10.50*1.512)::numeric,2),ROUND((10.50*2.16)::numeric,2),ROUND((10.50*1.944)::numeric,2)),
  ('RK-420-1080','Platte','Rücken','Rücken 420×1080mm', 420,1080, 16.00,ROUND((16.00*1.40)::numeric,2),ROUND((16.00*2.00)::numeric,2),ROUND((16.00*1.80)::numeric,2),ROUND((16.00*1.08)::numeric,2),ROUND((16.00*1.512)::numeric,2),ROUND((16.00*2.16)::numeric,2),ROUND((16.00*1.944)::numeric,2)),
  ('RK-420-1440','Platte','Rücken','Rücken 420×1440mm', 420,1440, 21.00,ROUND((21.00*1.40)::numeric,2),ROUND((21.00*2.00)::numeric,2),ROUND((21.00*1.80)::numeric,2),ROUND((21.00*1.08)::numeric,2),ROUND((21.00*1.512)::numeric,2),ROUND((21.00*2.16)::numeric,2),ROUND((21.00*1.944)::numeric,2)),
  ('RK-420-1800','Platte','Rücken','Rücken 420×1800mm', 420,1800, 26.50,ROUND((26.50*1.40)::numeric,2),ROUND((26.50*2.00)::numeric,2),ROUND((26.50*1.80)::numeric,2),ROUND((26.50*1.08)::numeric,2),ROUND((26.50*1.512)::numeric,2),ROUND((26.50*2.16)::numeric,2),ROUND((26.50*1.944)::numeric,2)),
  ('RK-580-180', 'Platte','Rücken','Rücken 580×180mm',  580, 180,  3.50,ROUND(( 3.50*1.40)::numeric,2),ROUND(( 3.50*2.00)::numeric,2),ROUND(( 3.50*1.80)::numeric,2),ROUND(( 3.50*1.08)::numeric,2),ROUND(( 3.50*1.512)::numeric,2),ROUND(( 3.50*2.16)::numeric,2),ROUND(( 3.50*1.944)::numeric,2)),
  ('RK-580-360', 'Platte','Rücken','Rücken 580×360mm',  580, 360,  7.50,ROUND(( 7.50*1.40)::numeric,2),ROUND(( 7.50*2.00)::numeric,2),ROUND(( 7.50*1.80)::numeric,2),ROUND(( 7.50*1.08)::numeric,2),ROUND(( 7.50*1.512)::numeric,2),ROUND(( 7.50*2.16)::numeric,2),ROUND(( 7.50*1.944)::numeric,2)),
  ('RK-580-580', 'Platte','Rücken','Rücken 580×580mm',  580, 580, 12.00,ROUND((12.00*1.40)::numeric,2),ROUND((12.00*2.00)::numeric,2),ROUND((12.00*1.80)::numeric,2),ROUND((12.00*1.08)::numeric,2),ROUND((12.00*1.512)::numeric,2),ROUND((12.00*2.16)::numeric,2),ROUND((12.00*1.944)::numeric,2)),
  ('RK-580-720', 'Platte','Rücken','Rücken 580×720mm',  580, 720, 14.50,ROUND((14.50*1.40)::numeric,2),ROUND((14.50*2.00)::numeric,2),ROUND((14.50*1.80)::numeric,2),ROUND((14.50*1.08)::numeric,2),ROUND((14.50*1.512)::numeric,2),ROUND((14.50*2.16)::numeric,2),ROUND((14.50*1.944)::numeric,2)),
  ('RK-580-1080','Platte','Rücken','Rücken 580×1080mm', 580,1080, 22.00,ROUND((22.00*1.40)::numeric,2),ROUND((22.00*2.00)::numeric,2),ROUND((22.00*1.80)::numeric,2),ROUND((22.00*1.08)::numeric,2),ROUND((22.00*1.512)::numeric,2),ROUND((22.00*2.16)::numeric,2),ROUND((22.00*1.944)::numeric,2)),
  ('RK-580-1440','Platte','Rücken','Rücken 580×1440mm', 580,1440, 29.50,ROUND((29.50*1.40)::numeric,2),ROUND((29.50*2.00)::numeric,2),ROUND((29.50*1.80)::numeric,2),ROUND((29.50*1.08)::numeric,2),ROUND((29.50*1.512)::numeric,2),ROUND((29.50*2.16)::numeric,2),ROUND((29.50*1.944)::numeric,2)),
  ('RK-580-1800','Platte','Rücken','Rücken 580×1800mm', 580,1800, 36.50,ROUND((36.50*1.40)::numeric,2),ROUND((36.50*2.00)::numeric,2),ROUND((36.50*1.80)::numeric,2),ROUND((36.50*1.08)::numeric,2),ROUND((36.50*1.512)::numeric,2),ROUND((36.50*2.16)::numeric,2),ROUND((36.50*1.944)::numeric,2)),
  ('RK-780-180', 'Platte','Rücken','Rücken 780×180mm',  780, 180,  5.00,ROUND(( 5.00*1.40)::numeric,2),ROUND(( 5.00*2.00)::numeric,2),ROUND(( 5.00*1.80)::numeric,2),ROUND(( 5.00*1.08)::numeric,2),ROUND(( 5.00*1.512)::numeric,2),ROUND(( 5.00*2.16)::numeric,2),ROUND(( 5.00*1.944)::numeric,2)),
  ('RK-780-360', 'Platte','Rücken','Rücken 780×360mm',  780, 360, 10.00,ROUND((10.00*1.40)::numeric,2),ROUND((10.00*2.00)::numeric,2),ROUND((10.00*1.80)::numeric,2),ROUND((10.00*1.08)::numeric,2),ROUND((10.00*1.512)::numeric,2),ROUND((10.00*2.16)::numeric,2),ROUND((10.00*1.944)::numeric,2)),
  ('RK-780-580', 'Platte','Rücken','Rücken 780×580mm',  780, 580, 16.00,ROUND((16.00*1.40)::numeric,2),ROUND((16.00*2.00)::numeric,2),ROUND((16.00*1.80)::numeric,2),ROUND((16.00*1.08)::numeric,2),ROUND((16.00*1.512)::numeric,2),ROUND((16.00*2.16)::numeric,2),ROUND((16.00*1.944)::numeric,2)),
  ('RK-780-720', 'Platte','Rücken','Rücken 780×720mm',  780, 720, 19.50,ROUND((19.50*1.40)::numeric,2),ROUND((19.50*2.00)::numeric,2),ROUND((19.50*1.80)::numeric,2),ROUND((19.50*1.08)::numeric,2),ROUND((19.50*1.512)::numeric,2),ROUND((19.50*2.16)::numeric,2),ROUND((19.50*1.944)::numeric,2)),
  ('RK-780-1080','Platte','Rücken','Rücken 780×1080mm', 780,1080, 29.50,ROUND((29.50*1.40)::numeric,2),ROUND((29.50*2.00)::numeric,2),ROUND((29.50*1.80)::numeric,2),ROUND((29.50*1.08)::numeric,2),ROUND((29.50*1.512)::numeric,2),ROUND((29.50*2.16)::numeric,2),ROUND((29.50*1.944)::numeric,2)),
  ('RK-780-1440','Platte','Rücken','Rücken 780×1440mm', 780,1440, 39.50,ROUND((39.50*1.40)::numeric,2),ROUND((39.50*2.00)::numeric,2),ROUND((39.50*1.80)::numeric,2),ROUND((39.50*1.08)::numeric,2),ROUND((39.50*1.512)::numeric,2),ROUND((39.50*2.16)::numeric,2),ROUND((39.50*1.944)::numeric,2)),
  ('RK-780-1800','Platte','Rücken','Rücken 780×1800mm', 780,1800, 49.00,ROUND((49.00*1.40)::numeric,2),ROUND((49.00*2.00)::numeric,2),ROUND((49.00*1.80)::numeric,2),ROUND((49.00*1.08)::numeric,2),ROUND((49.00*1.512)::numeric,2),ROUND((49.00*2.16)::numeric,2),ROUND((49.00*1.944)::numeric,2)),
  ('RK-980-180', 'Platte','Rücken','Rücken 980×180mm',  980, 180,  6.00,ROUND(( 6.00*1.40)::numeric,2),ROUND(( 6.00*2.00)::numeric,2),ROUND(( 6.00*1.80)::numeric,2),ROUND(( 6.00*1.08)::numeric,2),ROUND(( 6.00*1.512)::numeric,2),ROUND(( 6.00*2.16)::numeric,2),ROUND(( 6.00*1.944)::numeric,2)),
  ('RK-980-360', 'Platte','Rücken','Rücken 980×360mm',  980, 360, 12.50,ROUND((12.50*1.40)::numeric,2),ROUND((12.50*2.00)::numeric,2),ROUND((12.50*1.80)::numeric,2),ROUND((12.50*1.08)::numeric,2),ROUND((12.50*1.512)::numeric,2),ROUND((12.50*2.16)::numeric,2),ROUND((12.50*1.944)::numeric,2)),
  ('RK-980-580', 'Platte','Rücken','Rücken 980×580mm',  980, 580, 20.00,ROUND((20.00*1.40)::numeric,2),ROUND((20.00*2.00)::numeric,2),ROUND((20.00*1.80)::numeric,2),ROUND((20.00*1.08)::numeric,2),ROUND((20.00*1.512)::numeric,2),ROUND((20.00*2.16)::numeric,2),ROUND((20.00*1.944)::numeric,2)),
  ('RK-980-720', 'Platte','Rücken','Rücken 980×720mm',  980, 720, 25.00,ROUND((25.00*1.40)::numeric,2),ROUND((25.00*2.00)::numeric,2),ROUND((25.00*1.80)::numeric,2),ROUND((25.00*1.08)::numeric,2),ROUND((25.00*1.512)::numeric,2),ROUND((25.00*2.16)::numeric,2),ROUND((25.00*1.944)::numeric,2)),
  ('RK-980-1080','Platte','Rücken','Rücken 980×1080mm', 980,1080, 37.00,ROUND((37.00*1.40)::numeric,2),ROUND((37.00*2.00)::numeric,2),ROUND((37.00*1.80)::numeric,2),ROUND((37.00*1.08)::numeric,2),ROUND((37.00*1.512)::numeric,2),ROUND((37.00*2.16)::numeric,2),ROUND((37.00*1.944)::numeric,2)),
  ('RK-980-1440','Platte','Rücken','Rücken 980×1440mm', 980,1440, 49.50,ROUND((49.50*1.40)::numeric,2),ROUND((49.50*2.00)::numeric,2),ROUND((49.50*1.80)::numeric,2),ROUND((49.50*1.08)::numeric,2),ROUND((49.50*1.512)::numeric,2),ROUND((49.50*2.16)::numeric,2),ROUND((49.50*1.944)::numeric,2)),
  ('RK-980-1800','Platte','Rücken','Rücken 980×1800mm', 980,1800, 62.00,ROUND((62.00*1.40)::numeric,2),ROUND((62.00*2.00)::numeric,2),ROUND((62.00*1.80)::numeric,2),ROUND((62.00*1.08)::numeric,2),ROUND((62.00*1.512)::numeric,2),ROUND((62.00*2.16)::numeric,2),ROUND((62.00*1.944)::numeric,2))
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 7. SEITE AUSSEN (breite_mm=Zeilenhöhe, tiefe_mm=Tiefe) ──────────────────
-- HEIGHTS × DEPTHS: 180,360,580,720,1080,1440,1800 × 360,580
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('SA-180-360', 'Platte','Seite außen','Seite außen 180×360mm',  180,360,  3.00,ROUND(( 3.00*1.40)::numeric,2),ROUND(( 3.00*2.00)::numeric,2),ROUND(( 3.00*1.80)::numeric,2),ROUND(( 3.00*1.08)::numeric,2),ROUND(( 3.00*1.512)::numeric,2),ROUND(( 3.00*2.16)::numeric,2),ROUND(( 3.00*1.944)::numeric,2)),
  ('SA-180-580', 'Platte','Seite außen','Seite außen 180×580mm',  180,580,  4.70,ROUND(( 4.70*1.40)::numeric,2),ROUND(( 4.70*2.00)::numeric,2),ROUND(( 4.70*1.80)::numeric,2),ROUND(( 4.70*1.08)::numeric,2),ROUND(( 4.70*1.512)::numeric,2),ROUND(( 4.70*2.16)::numeric,2),ROUND(( 4.70*1.944)::numeric,2)),
  ('SA-360-360', 'Platte','Seite außen','Seite außen 360×360mm',  360,360,  5.85,ROUND(( 5.85*1.40)::numeric,2),ROUND(( 5.85*2.00)::numeric,2),ROUND(( 5.85*1.80)::numeric,2),ROUND(( 5.85*1.08)::numeric,2),ROUND(( 5.85*1.512)::numeric,2),ROUND(( 5.85*2.16)::numeric,2),ROUND(( 5.85*1.944)::numeric,2)),
  ('SA-360-580', 'Platte','Seite außen','Seite außen 360×580mm',  360,580,  9.40,ROUND(( 9.40*1.40)::numeric,2),ROUND(( 9.40*2.00)::numeric,2),ROUND(( 9.40*1.80)::numeric,2),ROUND(( 9.40*1.08)::numeric,2),ROUND(( 9.40*1.512)::numeric,2),ROUND(( 9.40*2.16)::numeric,2),ROUND(( 9.40*1.944)::numeric,2)),
  ('SA-580-360', 'Platte','Seite außen','Seite außen 580×360mm',  580,360,  9.40,ROUND(( 9.40*1.40)::numeric,2),ROUND(( 9.40*2.00)::numeric,2),ROUND(( 9.40*1.80)::numeric,2),ROUND(( 9.40*1.08)::numeric,2),ROUND(( 9.40*1.512)::numeric,2),ROUND(( 9.40*2.16)::numeric,2),ROUND(( 9.40*1.944)::numeric,2)),
  ('SA-580-580', 'Platte','Seite außen','Seite außen 580×580mm',  580,580, 15.15,ROUND((15.15*1.40)::numeric,2),ROUND((15.15*2.00)::numeric,2),ROUND((15.15*1.80)::numeric,2),ROUND((15.15*1.08)::numeric,2),ROUND((15.15*1.512)::numeric,2),ROUND((15.15*2.16)::numeric,2),ROUND((15.15*1.944)::numeric,2)),
  ('SA-720-360', 'Platte','Seite außen','Seite außen 720×360mm',  720,360, 11.65,ROUND((11.65*1.40)::numeric,2),ROUND((11.65*2.00)::numeric,2),ROUND((11.65*1.80)::numeric,2),ROUND((11.65*1.08)::numeric,2),ROUND((11.65*1.512)::numeric,2),ROUND((11.65*2.16)::numeric,2),ROUND((11.65*1.944)::numeric,2)),
  ('SA-720-580', 'Platte','Seite außen','Seite außen 720×580mm',  720,580, 18.80,ROUND((18.80*1.40)::numeric,2),ROUND((18.80*2.00)::numeric,2),ROUND((18.80*1.80)::numeric,2),ROUND((18.80*1.08)::numeric,2),ROUND((18.80*1.512)::numeric,2),ROUND((18.80*2.16)::numeric,2),ROUND((18.80*1.944)::numeric,2)),
  ('SA-1080-360','Platte','Seite außen','Seite außen 1080×360mm',1080,360, 17.50,ROUND((17.50*1.40)::numeric,2),ROUND((17.50*2.00)::numeric,2),ROUND((17.50*1.80)::numeric,2),ROUND((17.50*1.08)::numeric,2),ROUND((17.50*1.512)::numeric,2),ROUND((17.50*2.16)::numeric,2),ROUND((17.50*1.944)::numeric,2)),
  ('SA-1080-580','Platte','Seite außen','Seite außen 1080×580mm',1080,580, 28.20,ROUND((28.20*1.40)::numeric,2),ROUND((28.20*2.00)::numeric,2),ROUND((28.20*1.80)::numeric,2),ROUND((28.20*1.08)::numeric,2),ROUND((28.20*1.512)::numeric,2),ROUND((28.20*2.16)::numeric,2),ROUND((28.20*1.944)::numeric,2)),
  ('SA-1440-360','Platte','Seite außen','Seite außen 1440×360mm',1440,360, 23.35,ROUND((23.35*1.40)::numeric,2),ROUND((23.35*2.00)::numeric,2),ROUND((23.35*1.80)::numeric,2),ROUND((23.35*1.08)::numeric,2),ROUND((23.35*1.512)::numeric,2),ROUND((23.35*2.16)::numeric,2),ROUND((23.35*1.944)::numeric,2)),
  ('SA-1440-580','Platte','Seite außen','Seite außen 1440×580mm',1440,580, 37.60,ROUND((37.60*1.40)::numeric,2),ROUND((37.60*2.00)::numeric,2),ROUND((37.60*1.80)::numeric,2),ROUND((37.60*1.08)::numeric,2),ROUND((37.60*1.512)::numeric,2),ROUND((37.60*2.16)::numeric,2),ROUND((37.60*1.944)::numeric,2)),
  ('SA-1800-360','Platte','Seite außen','Seite außen 1800×360mm',1800,360, 29.15,ROUND((29.15*1.40)::numeric,2),ROUND((29.15*2.00)::numeric,2),ROUND((29.15*1.80)::numeric,2),ROUND((29.15*1.08)::numeric,2),ROUND((29.15*1.512)::numeric,2),ROUND((29.15*2.16)::numeric,2),ROUND((29.15*1.944)::numeric,2)),
  ('SA-1800-580','Platte','Seite außen','Seite außen 1800×580mm',1800,580, 47.00,ROUND((47.00*1.40)::numeric,2),ROUND((47.00*2.00)::numeric,2),ROUND((47.00*1.80)::numeric,2),ROUND((47.00*1.08)::numeric,2),ROUND((47.00*1.512)::numeric,2),ROUND((47.00*2.16)::numeric,2),ROUND((47.00*1.944)::numeric,2))
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 8. SEITE AUSSEN SY32 (gleiche Maße + 2,00 Aufschlag) ────────────────────
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('SA32-180-360', 'Platte','Seite außen SY32','Seite außen SY32 180×360mm',  180,360,  5.00,ROUND(( 5.00*1.40)::numeric,2),ROUND(( 5.00*2.00)::numeric,2),ROUND(( 5.00*1.80)::numeric,2),ROUND(( 5.00*1.08)::numeric,2),ROUND(( 5.00*1.512)::numeric,2),ROUND(( 5.00*2.16)::numeric,2),ROUND(( 5.00*1.944)::numeric,2)),
  ('SA32-180-580', 'Platte','Seite außen SY32','Seite außen SY32 180×580mm',  180,580,  6.70,ROUND(( 6.70*1.40)::numeric,2),ROUND(( 6.70*2.00)::numeric,2),ROUND(( 6.70*1.80)::numeric,2),ROUND(( 6.70*1.08)::numeric,2),ROUND(( 6.70*1.512)::numeric,2),ROUND(( 6.70*2.16)::numeric,2),ROUND(( 6.70*1.944)::numeric,2)),
  ('SA32-360-360', 'Platte','Seite außen SY32','Seite außen SY32 360×360mm',  360,360,  7.85,ROUND(( 7.85*1.40)::numeric,2),ROUND(( 7.85*2.00)::numeric,2),ROUND(( 7.85*1.80)::numeric,2),ROUND(( 7.85*1.08)::numeric,2),ROUND(( 7.85*1.512)::numeric,2),ROUND(( 7.85*2.16)::numeric,2),ROUND(( 7.85*1.944)::numeric,2)),
  ('SA32-360-580', 'Platte','Seite außen SY32','Seite außen SY32 360×580mm',  360,580, 11.40,ROUND((11.40*1.40)::numeric,2),ROUND((11.40*2.00)::numeric,2),ROUND((11.40*1.80)::numeric,2),ROUND((11.40*1.08)::numeric,2),ROUND((11.40*1.512)::numeric,2),ROUND((11.40*2.16)::numeric,2),ROUND((11.40*1.944)::numeric,2)),
  ('SA32-580-360', 'Platte','Seite außen SY32','Seite außen SY32 580×360mm',  580,360, 11.40,ROUND((11.40*1.40)::numeric,2),ROUND((11.40*2.00)::numeric,2),ROUND((11.40*1.80)::numeric,2),ROUND((11.40*1.08)::numeric,2),ROUND((11.40*1.512)::numeric,2),ROUND((11.40*2.16)::numeric,2),ROUND((11.40*1.944)::numeric,2)),
  ('SA32-580-580', 'Platte','Seite außen SY32','Seite außen SY32 580×580mm',  580,580, 17.15,ROUND((17.15*1.40)::numeric,2),ROUND((17.15*2.00)::numeric,2),ROUND((17.15*1.80)::numeric,2),ROUND((17.15*1.08)::numeric,2),ROUND((17.15*1.512)::numeric,2),ROUND((17.15*2.16)::numeric,2),ROUND((17.15*1.944)::numeric,2)),
  ('SA32-720-360', 'Platte','Seite außen SY32','Seite außen SY32 720×360mm',  720,360, 13.65,ROUND((13.65*1.40)::numeric,2),ROUND((13.65*2.00)::numeric,2),ROUND((13.65*1.80)::numeric,2),ROUND((13.65*1.08)::numeric,2),ROUND((13.65*1.512)::numeric,2),ROUND((13.65*2.16)::numeric,2),ROUND((13.65*1.944)::numeric,2)),
  ('SA32-720-580', 'Platte','Seite außen SY32','Seite außen SY32 720×580mm',  720,580, 20.80,ROUND((20.80*1.40)::numeric,2),ROUND((20.80*2.00)::numeric,2),ROUND((20.80*1.80)::numeric,2),ROUND((20.80*1.08)::numeric,2),ROUND((20.80*1.512)::numeric,2),ROUND((20.80*2.16)::numeric,2),ROUND((20.80*1.944)::numeric,2)),
  ('SA32-1080-360','Platte','Seite außen SY32','Seite außen SY32 1080×360mm',1080,360, 19.50,ROUND((19.50*1.40)::numeric,2),ROUND((19.50*2.00)::numeric,2),ROUND((19.50*1.80)::numeric,2),ROUND((19.50*1.08)::numeric,2),ROUND((19.50*1.512)::numeric,2),ROUND((19.50*2.16)::numeric,2),ROUND((19.50*1.944)::numeric,2)),
  ('SA32-1080-580','Platte','Seite außen SY32','Seite außen SY32 1080×580mm',1080,580, 30.20,ROUND((30.20*1.40)::numeric,2),ROUND((30.20*2.00)::numeric,2),ROUND((30.20*1.80)::numeric,2),ROUND((30.20*1.08)::numeric,2),ROUND((30.20*1.512)::numeric,2),ROUND((30.20*2.16)::numeric,2),ROUND((30.20*1.944)::numeric,2)),
  ('SA32-1440-360','Platte','Seite außen SY32','Seite außen SY32 1440×360mm',1440,360, 25.35,ROUND((25.35*1.40)::numeric,2),ROUND((25.35*2.00)::numeric,2),ROUND((25.35*1.80)::numeric,2),ROUND((25.35*1.08)::numeric,2),ROUND((25.35*1.512)::numeric,2),ROUND((25.35*2.16)::numeric,2),ROUND((25.35*1.944)::numeric,2)),
  ('SA32-1440-580','Platte','Seite außen SY32','Seite außen SY32 1440×580mm',1440,580, 39.60,ROUND((39.60*1.40)::numeric,2),ROUND((39.60*2.00)::numeric,2),ROUND((39.60*1.80)::numeric,2),ROUND((39.60*1.08)::numeric,2),ROUND((39.60*1.512)::numeric,2),ROUND((39.60*2.16)::numeric,2),ROUND((39.60*1.944)::numeric,2)),
  ('SA32-1800-360','Platte','Seite außen SY32','Seite außen SY32 1800×360mm',1800,360, 31.15,ROUND((31.15*1.40)::numeric,2),ROUND((31.15*2.00)::numeric,2),ROUND((31.15*1.80)::numeric,2),ROUND((31.15*1.08)::numeric,2),ROUND((31.15*1.512)::numeric,2),ROUND((31.15*2.16)::numeric,2),ROUND((31.15*1.944)::numeric,2)),
  ('SA32-1800-580','Platte','Seite außen SY32','Seite außen SY32 1800×580mm',1800,580, 49.00,ROUND((49.00*1.40)::numeric,2),ROUND((49.00*2.00)::numeric,2),ROUND((49.00*1.80)::numeric,2),ROUND((49.00*1.08)::numeric,2),ROUND((49.00*1.512)::numeric,2),ROUND((49.00*2.16)::numeric,2),ROUND((49.00*1.944)::numeric,2))
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 9. SEITE INNEN (gleiche Maße wie Seite außen) ────────────────────────────
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('SI-180-360', 'Platte','Seite innen','Seite innen 180×360mm',  180,360,  3.00,ROUND(( 3.00*1.40)::numeric,2),ROUND(( 3.00*2.00)::numeric,2),ROUND(( 3.00*1.80)::numeric,2),ROUND(( 3.00*1.08)::numeric,2),ROUND(( 3.00*1.512)::numeric,2),ROUND(( 3.00*2.16)::numeric,2),ROUND(( 3.00*1.944)::numeric,2)),
  ('SI-180-580', 'Platte','Seite innen','Seite innen 180×580mm',  180,580,  4.70,ROUND(( 4.70*1.40)::numeric,2),ROUND(( 4.70*2.00)::numeric,2),ROUND(( 4.70*1.80)::numeric,2),ROUND(( 4.70*1.08)::numeric,2),ROUND(( 4.70*1.512)::numeric,2),ROUND(( 4.70*2.16)::numeric,2),ROUND(( 4.70*1.944)::numeric,2)),
  ('SI-360-360', 'Platte','Seite innen','Seite innen 360×360mm',  360,360,  5.85,ROUND(( 5.85*1.40)::numeric,2),ROUND(( 5.85*2.00)::numeric,2),ROUND(( 5.85*1.80)::numeric,2),ROUND(( 5.85*1.08)::numeric,2),ROUND(( 5.85*1.512)::numeric,2),ROUND(( 5.85*2.16)::numeric,2),ROUND(( 5.85*1.944)::numeric,2)),
  ('SI-360-580', 'Platte','Seite innen','Seite innen 360×580mm',  360,580,  9.40,ROUND(( 9.40*1.40)::numeric,2),ROUND(( 9.40*2.00)::numeric,2),ROUND(( 9.40*1.80)::numeric,2),ROUND(( 9.40*1.08)::numeric,2),ROUND(( 9.40*1.512)::numeric,2),ROUND(( 9.40*2.16)::numeric,2),ROUND(( 9.40*1.944)::numeric,2)),
  ('SI-580-360', 'Platte','Seite innen','Seite innen 580×360mm',  580,360,  9.40,ROUND(( 9.40*1.40)::numeric,2),ROUND(( 9.40*2.00)::numeric,2),ROUND(( 9.40*1.80)::numeric,2),ROUND(( 9.40*1.08)::numeric,2),ROUND(( 9.40*1.512)::numeric,2),ROUND(( 9.40*2.16)::numeric,2),ROUND(( 9.40*1.944)::numeric,2)),
  ('SI-580-580', 'Platte','Seite innen','Seite innen 580×580mm',  580,580, 15.15,ROUND((15.15*1.40)::numeric,2),ROUND((15.15*2.00)::numeric,2),ROUND((15.15*1.80)::numeric,2),ROUND((15.15*1.08)::numeric,2),ROUND((15.15*1.512)::numeric,2),ROUND((15.15*2.16)::numeric,2),ROUND((15.15*1.944)::numeric,2)),
  ('SI-720-360', 'Platte','Seite innen','Seite innen 720×360mm',  720,360, 11.65,ROUND((11.65*1.40)::numeric,2),ROUND((11.65*2.00)::numeric,2),ROUND((11.65*1.80)::numeric,2),ROUND((11.65*1.08)::numeric,2),ROUND((11.65*1.512)::numeric,2),ROUND((11.65*2.16)::numeric,2),ROUND((11.65*1.944)::numeric,2)),
  ('SI-720-580', 'Platte','Seite innen','Seite innen 720×580mm',  720,580, 18.80,ROUND((18.80*1.40)::numeric,2),ROUND((18.80*2.00)::numeric,2),ROUND((18.80*1.80)::numeric,2),ROUND((18.80*1.08)::numeric,2),ROUND((18.80*1.512)::numeric,2),ROUND((18.80*2.16)::numeric,2),ROUND((18.80*1.944)::numeric,2)),
  ('SI-1080-360','Platte','Seite innen','Seite innen 1080×360mm',1080,360, 17.50,ROUND((17.50*1.40)::numeric,2),ROUND((17.50*2.00)::numeric,2),ROUND((17.50*1.80)::numeric,2),ROUND((17.50*1.08)::numeric,2),ROUND((17.50*1.512)::numeric,2),ROUND((17.50*2.16)::numeric,2),ROUND((17.50*1.944)::numeric,2)),
  ('SI-1080-580','Platte','Seite innen','Seite innen 1080×580mm',1080,580, 28.20,ROUND((28.20*1.40)::numeric,2),ROUND((28.20*2.00)::numeric,2),ROUND((28.20*1.80)::numeric,2),ROUND((28.20*1.08)::numeric,2),ROUND((28.20*1.512)::numeric,2),ROUND((28.20*2.16)::numeric,2),ROUND((28.20*1.944)::numeric,2)),
  ('SI-1440-360','Platte','Seite innen','Seite innen 1440×360mm',1440,360, 23.35,ROUND((23.35*1.40)::numeric,2),ROUND((23.35*2.00)::numeric,2),ROUND((23.35*1.80)::numeric,2),ROUND((23.35*1.08)::numeric,2),ROUND((23.35*1.512)::numeric,2),ROUND((23.35*2.16)::numeric,2),ROUND((23.35*1.944)::numeric,2)),
  ('SI-1440-580','Platte','Seite innen','Seite innen 1440×580mm',1440,580, 37.60,ROUND((37.60*1.40)::numeric,2),ROUND((37.60*2.00)::numeric,2),ROUND((37.60*1.80)::numeric,2),ROUND((37.60*1.08)::numeric,2),ROUND((37.60*1.512)::numeric,2),ROUND((37.60*2.16)::numeric,2),ROUND((37.60*1.944)::numeric,2)),
  ('SI-1800-360','Platte','Seite innen','Seite innen 1800×360mm',1800,360, 29.15,ROUND((29.15*1.40)::numeric,2),ROUND((29.15*2.00)::numeric,2),ROUND((29.15*1.80)::numeric,2),ROUND((29.15*1.08)::numeric,2),ROUND((29.15*1.512)::numeric,2),ROUND((29.15*2.16)::numeric,2),ROUND((29.15*1.944)::numeric,2)),
  ('SI-1800-580','Platte','Seite innen','Seite innen 1800×580mm',1800,580, 47.00,ROUND((47.00*1.40)::numeric,2),ROUND((47.00*2.00)::numeric,2),ROUND((47.00*1.80)::numeric,2),ROUND((47.00*1.08)::numeric,2),ROUND((47.00*1.512)::numeric,2),ROUND((47.00*2.16)::numeric,2),ROUND((47.00*1.944)::numeric,2))
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 10. SEITE INNEN SY32 ─────────────────────────────────────────────────────
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('SI32-180-360', 'Platte','Seite innen SY32','Seite innen SY32 180×360mm',  180,360,  5.00,ROUND(( 5.00*1.40)::numeric,2),ROUND(( 5.00*2.00)::numeric,2),ROUND(( 5.00*1.80)::numeric,2),ROUND(( 5.00*1.08)::numeric,2),ROUND(( 5.00*1.512)::numeric,2),ROUND(( 5.00*2.16)::numeric,2),ROUND(( 5.00*1.944)::numeric,2)),
  ('SI32-180-580', 'Platte','Seite innen SY32','Seite innen SY32 180×580mm',  180,580,  6.70,ROUND(( 6.70*1.40)::numeric,2),ROUND(( 6.70*2.00)::numeric,2),ROUND(( 6.70*1.80)::numeric,2),ROUND(( 6.70*1.08)::numeric,2),ROUND(( 6.70*1.512)::numeric,2),ROUND(( 6.70*2.16)::numeric,2),ROUND(( 6.70*1.944)::numeric,2)),
  ('SI32-360-360', 'Platte','Seite innen SY32','Seite innen SY32 360×360mm',  360,360,  7.85,ROUND(( 7.85*1.40)::numeric,2),ROUND(( 7.85*2.00)::numeric,2),ROUND(( 7.85*1.80)::numeric,2),ROUND(( 7.85*1.08)::numeric,2),ROUND(( 7.85*1.512)::numeric,2),ROUND(( 7.85*2.16)::numeric,2),ROUND(( 7.85*1.944)::numeric,2)),
  ('SI32-360-580', 'Platte','Seite innen SY32','Seite innen SY32 360×580mm',  360,580, 11.40,ROUND((11.40*1.40)::numeric,2),ROUND((11.40*2.00)::numeric,2),ROUND((11.40*1.80)::numeric,2),ROUND((11.40*1.08)::numeric,2),ROUND((11.40*1.512)::numeric,2),ROUND((11.40*2.16)::numeric,2),ROUND((11.40*1.944)::numeric,2)),
  ('SI32-580-360', 'Platte','Seite innen SY32','Seite innen SY32 580×360mm',  580,360, 11.40,ROUND((11.40*1.40)::numeric,2),ROUND((11.40*2.00)::numeric,2),ROUND((11.40*1.80)::numeric,2),ROUND((11.40*1.08)::numeric,2),ROUND((11.40*1.512)::numeric,2),ROUND((11.40*2.16)::numeric,2),ROUND((11.40*1.944)::numeric,2)),
  ('SI32-580-580', 'Platte','Seite innen SY32','Seite innen SY32 580×580mm',  580,580, 17.15,ROUND((17.15*1.40)::numeric,2),ROUND((17.15*2.00)::numeric,2),ROUND((17.15*1.80)::numeric,2),ROUND((17.15*1.08)::numeric,2),ROUND((17.15*1.512)::numeric,2),ROUND((17.15*2.16)::numeric,2),ROUND((17.15*1.944)::numeric,2)),
  ('SI32-720-360', 'Platte','Seite innen SY32','Seite innen SY32 720×360mm',  720,360, 13.65,ROUND((13.65*1.40)::numeric,2),ROUND((13.65*2.00)::numeric,2),ROUND((13.65*1.80)::numeric,2),ROUND((13.65*1.08)::numeric,2),ROUND((13.65*1.512)::numeric,2),ROUND((13.65*2.16)::numeric,2),ROUND((13.65*1.944)::numeric,2)),
  ('SI32-720-580', 'Platte','Seite innen SY32','Seite innen SY32 720×580mm',  720,580, 20.80,ROUND((20.80*1.40)::numeric,2),ROUND((20.80*2.00)::numeric,2),ROUND((20.80*1.80)::numeric,2),ROUND((20.80*1.08)::numeric,2),ROUND((20.80*1.512)::numeric,2),ROUND((20.80*2.16)::numeric,2),ROUND((20.80*1.944)::numeric,2)),
  ('SI32-1080-360','Platte','Seite innen SY32','Seite innen SY32 1080×360mm',1080,360, 19.50,ROUND((19.50*1.40)::numeric,2),ROUND((19.50*2.00)::numeric,2),ROUND((19.50*1.80)::numeric,2),ROUND((19.50*1.08)::numeric,2),ROUND((19.50*1.512)::numeric,2),ROUND((19.50*2.16)::numeric,2),ROUND((19.50*1.944)::numeric,2)),
  ('SI32-1080-580','Platte','Seite innen SY32','Seite innen SY32 1080×580mm',1080,580, 30.20,ROUND((30.20*1.40)::numeric,2),ROUND((30.20*2.00)::numeric,2),ROUND((30.20*1.80)::numeric,2),ROUND((30.20*1.08)::numeric,2),ROUND((30.20*1.512)::numeric,2),ROUND((30.20*2.16)::numeric,2),ROUND((30.20*1.944)::numeric,2)),
  ('SI32-1440-360','Platte','Seite innen SY32','Seite innen SY32 1440×360mm',1440,360, 25.35,ROUND((25.35*1.40)::numeric,2),ROUND((25.35*2.00)::numeric,2),ROUND((25.35*1.80)::numeric,2),ROUND((25.35*1.08)::numeric,2),ROUND((25.35*1.512)::numeric,2),ROUND((25.35*2.16)::numeric,2),ROUND((25.35*1.944)::numeric,2)),
  ('SI32-1440-580','Platte','Seite innen SY32','Seite innen SY32 1440×580mm',1440,580, 39.60,ROUND((39.60*1.40)::numeric,2),ROUND((39.60*2.00)::numeric,2),ROUND((39.60*1.80)::numeric,2),ROUND((39.60*1.08)::numeric,2),ROUND((39.60*1.512)::numeric,2),ROUND((39.60*2.16)::numeric,2),ROUND((39.60*1.944)::numeric,2)),
  ('SI32-1800-360','Platte','Seite innen SY32','Seite innen SY32 1800×360mm',1800,360, 31.15,ROUND((31.15*1.40)::numeric,2),ROUND((31.15*2.00)::numeric,2),ROUND((31.15*1.80)::numeric,2),ROUND((31.15*1.08)::numeric,2),ROUND((31.15*1.512)::numeric,2),ROUND((31.15*2.16)::numeric,2),ROUND((31.15*1.944)::numeric,2)),
  ('SI32-1800-580','Platte','Seite innen SY32','Seite innen SY32 1800×580mm',1800,580, 49.00,ROUND((49.00*1.40)::numeric,2),ROUND((49.00*2.00)::numeric,2),ROUND((49.00*1.80)::numeric,2),ROUND((49.00*1.08)::numeric,2),ROUND((49.00*1.512)::numeric,2),ROUND((49.00*2.16)::numeric,2),ROUND((49.00*1.944)::numeric,2))
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 11. FRONTEN — KLAPPE (breite=Spaltenbreite, tiefe=Zeilenhöhe) ─────────────
-- Availability: WIDTHS × [180, 360]
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('KL-420-180','Platte','Klappe','Klappe 420×180mm', 420,180,  4.50,ROUND(( 4.50*1.40)::numeric,2),ROUND(( 4.50*2.00)::numeric,2),ROUND(( 4.50*1.80)::numeric,2),ROUND(( 4.50*1.08)::numeric,2),ROUND(( 4.50*1.512)::numeric,2),ROUND(( 4.50*2.16)::numeric,2),ROUND(( 4.50*1.944)::numeric,2)),
  ('KL-420-360','Platte','Klappe','Klappe 420×360mm', 420,360,  9.00,ROUND(( 9.00*1.40)::numeric,2),ROUND(( 9.00*2.00)::numeric,2),ROUND(( 9.00*1.80)::numeric,2),ROUND(( 9.00*1.08)::numeric,2),ROUND(( 9.00*1.512)::numeric,2),ROUND(( 9.00*2.16)::numeric,2),ROUND(( 9.00*1.944)::numeric,2)),
  ('KL-580-180','Platte','Klappe','Klappe 580×180mm', 580,180,  6.25,ROUND(( 6.25*1.40)::numeric,2),ROUND(( 6.25*2.00)::numeric,2),ROUND(( 6.25*1.80)::numeric,2),ROUND(( 6.25*1.08)::numeric,2),ROUND(( 6.25*1.512)::numeric,2),ROUND(( 6.25*2.16)::numeric,2),ROUND(( 6.25*1.944)::numeric,2)),
  ('KL-580-360','Platte','Klappe','Klappe 580×360mm', 580,360, 12.50,ROUND((12.50*1.40)::numeric,2),ROUND((12.50*2.00)::numeric,2),ROUND((12.50*1.80)::numeric,2),ROUND((12.50*1.08)::numeric,2),ROUND((12.50*1.512)::numeric,2),ROUND((12.50*2.16)::numeric,2),ROUND((12.50*1.944)::numeric,2)),
  ('KL-780-180','Platte','Klappe','Klappe 780×180mm', 780,180,  8.40,ROUND(( 8.40*1.40)::numeric,2),ROUND(( 8.40*2.00)::numeric,2),ROUND(( 8.40*1.80)::numeric,2),ROUND(( 8.40*1.08)::numeric,2),ROUND(( 8.40*1.512)::numeric,2),ROUND(( 8.40*2.16)::numeric,2),ROUND(( 8.40*1.944)::numeric,2)),
  ('KL-780-360','Platte','Klappe','Klappe 780×360mm', 780,360, 16.85,ROUND((16.85*1.40)::numeric,2),ROUND((16.85*2.00)::numeric,2),ROUND((16.85*1.80)::numeric,2),ROUND((16.85*1.08)::numeric,2),ROUND((16.85*1.512)::numeric,2),ROUND((16.85*2.16)::numeric,2),ROUND((16.85*1.944)::numeric,2)),
  ('KL-980-180','Platte','Klappe','Klappe 980×180mm', 980,180, 10.60,ROUND((10.60*1.40)::numeric,2),ROUND((10.60*2.00)::numeric,2),ROUND((10.60*1.80)::numeric,2),ROUND((10.60*1.08)::numeric,2),ROUND((10.60*1.512)::numeric,2),ROUND((10.60*2.16)::numeric,2),ROUND((10.60*1.944)::numeric,2)),
  ('KL-980-360','Platte','Klappe','Klappe 980×360mm', 980,360, 21.20,ROUND((21.20*1.40)::numeric,2),ROUND((21.20*2.00)::numeric,2),ROUND((21.20*1.80)::numeric,2),ROUND((21.20*1.08)::numeric,2),ROUND((21.20*1.512)::numeric,2),ROUND((21.20*2.16)::numeric,2),ROUND((21.20*1.944)::numeric,2))
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 12. FRONTEN — SCHUBLADE (gleiche Availability wie Klappe) ────────────────
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('SC-420-180','Platte','Schublade','Schublade 420×180mm', 420,180,  5.00,ROUND(( 5.00*1.40)::numeric,2),ROUND(( 5.00*2.00)::numeric,2),ROUND(( 5.00*1.80)::numeric,2),ROUND(( 5.00*1.08)::numeric,2),ROUND(( 5.00*1.512)::numeric,2),ROUND(( 5.00*2.16)::numeric,2),ROUND(( 5.00*1.944)::numeric,2)),
  ('SC-420-360','Platte','Schublade','Schublade 420×360mm', 420,360,  9.85,ROUND(( 9.85*1.40)::numeric,2),ROUND(( 9.85*2.00)::numeric,2),ROUND(( 9.85*1.80)::numeric,2),ROUND(( 9.85*1.08)::numeric,2),ROUND(( 9.85*1.512)::numeric,2),ROUND(( 9.85*2.16)::numeric,2),ROUND(( 9.85*1.944)::numeric,2)),
  ('SC-580-180','Platte','Schublade','Schublade 580×180mm', 580,180,  6.80,ROUND(( 6.80*1.40)::numeric,2),ROUND(( 6.80*2.00)::numeric,2),ROUND(( 6.80*1.80)::numeric,2),ROUND(( 6.80*1.08)::numeric,2),ROUND(( 6.80*1.512)::numeric,2),ROUND(( 6.80*2.16)::numeric,2),ROUND(( 6.80*1.944)::numeric,2)),
  ('SC-580-360','Platte','Schublade','Schublade 580×360mm', 580,360, 13.60,ROUND((13.60*1.40)::numeric,2),ROUND((13.60*2.00)::numeric,2),ROUND((13.60*1.80)::numeric,2),ROUND((13.60*1.08)::numeric,2),ROUND((13.60*1.512)::numeric,2),ROUND((13.60*2.16)::numeric,2),ROUND((13.60*1.944)::numeric,2)),
  ('SC-780-180','Platte','Schublade','Schublade 780×180mm', 780,180,  9.15,ROUND(( 9.15*1.40)::numeric,2),ROUND(( 9.15*2.00)::numeric,2),ROUND(( 9.15*1.80)::numeric,2),ROUND(( 9.15*1.08)::numeric,2),ROUND(( 9.15*1.512)::numeric,2),ROUND(( 9.15*2.16)::numeric,2),ROUND(( 9.15*1.944)::numeric,2)),
  ('SC-780-360','Platte','Schublade','Schublade 780×360mm', 780,360, 18.25,ROUND((18.25*1.40)::numeric,2),ROUND((18.25*2.00)::numeric,2),ROUND((18.25*1.80)::numeric,2),ROUND((18.25*1.08)::numeric,2),ROUND((18.25*1.512)::numeric,2),ROUND((18.25*2.16)::numeric,2),ROUND((18.25*1.944)::numeric,2)),
  ('SC-980-180','Platte','Schublade','Schublade 980×180mm', 980,180, 11.50,ROUND((11.50*1.40)::numeric,2),ROUND((11.50*2.00)::numeric,2),ROUND((11.50*1.80)::numeric,2),ROUND((11.50*1.08)::numeric,2),ROUND((11.50*1.512)::numeric,2),ROUND((11.50*2.16)::numeric,2),ROUND((11.50*1.944)::numeric,2)),
  ('SC-980-360','Platte','Schublade','Schublade 980×360mm', 980,360, 22.95,ROUND((22.95*1.40)::numeric,2),ROUND((22.95*2.00)::numeric,2),ROUND((22.95*1.80)::numeric,2),ROUND((22.95*1.08)::numeric,2),ROUND((22.95*1.512)::numeric,2),ROUND((22.95*2.16)::numeric,2),ROUND((22.95*1.944)::numeric,2))
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 13. FRONTEN — TÜR (TR+TL teilen sich diese Tabelle, breite=[420,580], höhe=[360,720,1080,1440,1800]) ──
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('TU-420-360', 'Platte','Tür','Tür 420×360mm',  420, 360,  9.85,ROUND(( 9.85*1.40)::numeric,2),ROUND(( 9.85*2.00)::numeric,2),ROUND(( 9.85*1.80)::numeric,2),ROUND(( 9.85*1.08)::numeric,2),ROUND(( 9.85*1.512)::numeric,2),ROUND(( 9.85*2.16)::numeric,2),ROUND(( 9.85*1.944)::numeric,2)),
  ('TU-420-720', 'Platte','Tür','Tür 420×720mm',  420, 720, 19.65,ROUND((19.65*1.40)::numeric,2),ROUND((19.65*2.00)::numeric,2),ROUND((19.65*1.80)::numeric,2),ROUND((19.65*1.08)::numeric,2),ROUND((19.65*1.512)::numeric,2),ROUND((19.65*2.16)::numeric,2),ROUND((19.65*1.944)::numeric,2)),
  ('TU-420-1080','Platte','Tür','Tür 420×1080mm', 420,1080, 29.50,ROUND((29.50*1.40)::numeric,2),ROUND((29.50*2.00)::numeric,2),ROUND((29.50*1.80)::numeric,2),ROUND((29.50*1.08)::numeric,2),ROUND((29.50*1.512)::numeric,2),ROUND((29.50*2.16)::numeric,2),ROUND((29.50*1.944)::numeric,2)),
  ('TU-420-1440','Platte','Tür','Tür 420×1440mm', 420,1440, 39.30,ROUND((39.30*1.40)::numeric,2),ROUND((39.30*2.00)::numeric,2),ROUND((39.30*1.80)::numeric,2),ROUND((39.30*1.08)::numeric,2),ROUND((39.30*1.512)::numeric,2),ROUND((39.30*2.16)::numeric,2),ROUND((39.30*1.944)::numeric,2)),
  ('TU-420-1800','Platte','Tür','Tür 420×1800mm', 420,1800, 49.15,ROUND((49.15*1.40)::numeric,2),ROUND((49.15*2.00)::numeric,2),ROUND((49.15*1.80)::numeric,2),ROUND((49.15*1.08)::numeric,2),ROUND((49.15*1.512)::numeric,2),ROUND((49.15*2.16)::numeric,2),ROUND((49.15*1.944)::numeric,2)),
  ('TU-580-360', 'Platte','Tür','Tür 580×360mm',  580, 360, 13.60,ROUND((13.60*1.40)::numeric,2),ROUND((13.60*2.00)::numeric,2),ROUND((13.60*1.80)::numeric,2),ROUND((13.60*1.08)::numeric,2),ROUND((13.60*1.512)::numeric,2),ROUND((13.60*2.16)::numeric,2),ROUND((13.60*1.944)::numeric,2)),
  ('TU-580-720', 'Platte','Tür','Tür 580×720mm',  580, 720, 27.15,ROUND((27.15*1.40)::numeric,2),ROUND((27.15*2.00)::numeric,2),ROUND((27.15*1.80)::numeric,2),ROUND((27.15*1.08)::numeric,2),ROUND((27.15*1.512)::numeric,2),ROUND((27.15*2.16)::numeric,2),ROUND((27.15*1.944)::numeric,2)),
  ('TU-580-1080','Platte','Tür','Tür 580×1080mm', 580,1080, 40.70,ROUND((40.70*1.40)::numeric,2),ROUND((40.70*2.00)::numeric,2),ROUND((40.70*1.80)::numeric,2),ROUND((40.70*1.08)::numeric,2),ROUND((40.70*1.512)::numeric,2),ROUND((40.70*2.16)::numeric,2),ROUND((40.70*1.944)::numeric,2)),
  ('TU-580-1440','Platte','Tür','Tür 580×1440mm', 580,1440, 54.30,ROUND((54.30*1.40)::numeric,2),ROUND((54.30*2.00)::numeric,2),ROUND((54.30*1.80)::numeric,2),ROUND((54.30*1.08)::numeric,2),ROUND((54.30*1.512)::numeric,2),ROUND((54.30*2.16)::numeric,2),ROUND((54.30*1.944)::numeric,2)),
  ('TU-580-1800','Platte','Tür','Tür 580×1800mm', 580,1800, 67.85,ROUND((67.85*1.40)::numeric,2),ROUND((67.85*2.00)::numeric,2),ROUND((67.85*1.80)::numeric,2),ROUND((67.85*1.08)::numeric,2),ROUND((67.85*1.512)::numeric,2),ROUND((67.85*2.16)::numeric,2),ROUND((67.85*1.944)::numeric,2))
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 14. FRONTEN — DOPPELTÜR (breite=[780,980], höhe=[360,720,1080,1440,1800]; 980×1800 ausgeschlossen) ──
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('DT-780-360', 'Platte','Doppeltür','Doppeltür 780×360mm',  780, 360, 18.25,ROUND((18.25*1.40)::numeric,2),ROUND((18.25*2.00)::numeric,2),ROUND((18.25*1.80)::numeric,2),ROUND((18.25*1.08)::numeric,2),ROUND((18.25*1.512)::numeric,2),ROUND((18.25*2.16)::numeric,2),ROUND((18.25*1.944)::numeric,2)),
  ('DT-780-720', 'Platte','Doppeltür','Doppeltür 780×720mm',  780, 720, 36.50,ROUND((36.50*1.40)::numeric,2),ROUND((36.50*2.00)::numeric,2),ROUND((36.50*1.80)::numeric,2),ROUND((36.50*1.08)::numeric,2),ROUND((36.50*1.512)::numeric,2),ROUND((36.50*2.16)::numeric,2),ROUND((36.50*1.944)::numeric,2)),
  ('DT-780-1080','Platte','Doppeltür','Doppeltür 780×1080mm', 780,1080, 54.75,ROUND((54.75*1.40)::numeric,2),ROUND((54.75*2.00)::numeric,2),ROUND((54.75*1.80)::numeric,2),ROUND((54.75*1.08)::numeric,2),ROUND((54.75*1.512)::numeric,2),ROUND((54.75*2.16)::numeric,2),ROUND((54.75*1.944)::numeric,2)),
  ('DT-780-1440','Platte','Doppeltür','Doppeltür 780×1440mm', 780,1440, 73.00,ROUND((73.00*1.40)::numeric,2),ROUND((73.00*2.00)::numeric,2),ROUND((73.00*1.80)::numeric,2),ROUND((73.00*1.08)::numeric,2),ROUND((73.00*1.512)::numeric,2),ROUND((73.00*2.16)::numeric,2),ROUND((73.00*1.944)::numeric,2)),
  ('DT-780-1800','Platte','Doppeltür','Doppeltür 780×1800mm', 780,1800, 91.25,ROUND((91.25*1.40)::numeric,2),ROUND((91.25*2.00)::numeric,2),ROUND((91.25*1.80)::numeric,2),ROUND((91.25*1.08)::numeric,2),ROUND((91.25*1.512)::numeric,2),ROUND((91.25*2.16)::numeric,2),ROUND((91.25*1.944)::numeric,2)),
  ('DT-980-360', 'Platte','Doppeltür','Doppeltür 980×360mm',  980, 360, 22.95,ROUND((22.95*1.40)::numeric,2),ROUND((22.95*2.00)::numeric,2),ROUND((22.95*1.80)::numeric,2),ROUND((22.95*1.08)::numeric,2),ROUND((22.95*1.512)::numeric,2),ROUND((22.95*2.16)::numeric,2),ROUND((22.95*1.944)::numeric,2)),
  ('DT-980-720', 'Platte','Doppeltür','Doppeltür 980×720mm',  980, 720, 45.85,ROUND((45.85*1.40)::numeric,2),ROUND((45.85*2.00)::numeric,2),ROUND((45.85*1.80)::numeric,2),ROUND((45.85*1.08)::numeric,2),ROUND((45.85*1.512)::numeric,2),ROUND((45.85*2.16)::numeric,2),ROUND((45.85*1.944)::numeric,2)),
  ('DT-980-1080','Platte','Doppeltür','Doppeltür 980×1080mm', 980,1080, 68.80,ROUND((68.80*1.40)::numeric,2),ROUND((68.80*2.00)::numeric,2),ROUND((68.80*1.80)::numeric,2),ROUND((68.80*1.08)::numeric,2),ROUND((68.80*1.512)::numeric,2),ROUND((68.80*2.16)::numeric,2),ROUND((68.80*1.944)::numeric,2)),
  ('DT-980-1440','Platte','Doppeltür','Doppeltür 980×1440mm', 980,1440, 91.75,ROUND((91.75*1.40)::numeric,2),ROUND((91.75*2.00)::numeric,2),ROUND((91.75*1.80)::numeric,2),ROUND((91.75*1.08)::numeric,2),ROUND((91.75*1.512)::numeric,2),ROUND((91.75*2.16)::numeric,2),ROUND((91.75*1.944)::numeric,2))
  -- 980×1800 fehlt absichtlich (excludedCombo laut FRONT_TYPE_AVAILABILITY)
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 15. GRIFFE (Lookup via bezeichnung-Match, keine Dimensionen) ─────────────
-- Bezeichnung muss exakt mit HANDLES[].l in constants.ts übereinstimmen (normalisiert).
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('GR-push',         'Zubehör','Griff','Push to open / Blanko', NULL,NULL,  2.50,NULL,NULL,NULL,  2.70,NULL,NULL,NULL),
  ('GR-luno',         'Zubehör','Griff','Luno',                  NULL,NULL,  4.50,NULL,NULL,NULL,  4.86,NULL,NULL,NULL),
  ('GR-linea',        'Zubehör','Griff','Linea',                 NULL,NULL,  6.00,NULL,NULL,NULL,  6.48,NULL,NULL,NULL),
  ('GR-rondo',        'Zubehör','Griff','Rondo',                 NULL,NULL,  5.00,NULL,NULL,NULL,  5.40,NULL,NULL,NULL),
  ('GR-axio',         'Zubehör','Griff','Axio',                  NULL,NULL,  5.50,NULL,NULL,NULL,  5.94,NULL,NULL,NULL),
  ('GR-axio-gross',   'Zubehör','Griff','Axio groß',             NULL,NULL,  7.00,NULL,NULL,NULL,  7.56,NULL,NULL,NULL),
  ('GR-retrox',       'Zubehör','Griff','Retrox',                NULL,NULL,  5.50,NULL,NULL,NULL,  5.94,NULL,NULL,NULL),
  ('GR-reling',       'Zubehör','Griff','Reling',                NULL,NULL,  6.00,NULL,NULL,NULL,  6.48,NULL,NULL,NULL),
  ('GR-reling-gross', 'Zubehör','Griff','Reling groß',           NULL,NULL,  8.00,NULL,NULL,NULL,  8.64,NULL,NULL,NULL),
  ('GR-uno',          'Zubehör','Griff','Uno',                   NULL,NULL,  5.00,NULL,NULL,NULL,  5.40,NULL,NULL,NULL),
  ('GR-ombra',        'Zubehör','Griff','Ombra',                 NULL,NULL,  6.50,NULL,NULL,NULL,  7.02,NULL,NULL,NULL),
  ('GR-solano',       'Zubehör','Griff','Solano',                NULL,NULL,  7.00,NULL,NULL,NULL,  7.56,NULL,NULL,NULL),
  ('GR-arcano',       'Zubehör','Griff','Arcano',                NULL,NULL,  8.50,NULL,NULL,NULL,  9.18,NULL,NULL,NULL),
  ('GR-bridge',       'Zubehör','Griff','Bridge',                NULL,NULL,  6.00,NULL,NULL,NULL,  6.48,NULL,NULL,NULL),
  ('GR-bridge-gross', 'Zubehör','Griff','Bridge groß',           NULL,NULL,  8.00,NULL,NULL,NULL,  8.64,NULL,NULL,NULL),
  ('GR-allungo',      'Zubehör','Griff','Allungo',               NULL,NULL,  9.00,NULL,NULL,NULL,  9.72,NULL,NULL,NULL)
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ── 16. FÜSSE / ROLLEN ───────────────────────────────────────────────────────
-- art_nr MUSS mit constants.ts übereinstimmen (Lookup via art_nr-Match):
--   8080 = Stellfuß 50mm   (FOOTERS[0])
--   8051 = Rolle Parkett   (FOOTERS[1])
--   8050 = Rolle Teppich   (FOOTERS[2])
--   8081 = Nivellierschraube (FOOTERS[3])
--
-- HINWEIS: Die Aufgabenstellung nennt andere Zuordnungen (8050=Stellfuß etc.)
-- als constants.ts — hier gilt constants.ts als Wahrheitsquelle.
INSERT INTO article_prices
  (art_nr, typ, kategorie, bezeichnung, breite_mm, tiefe_mm,
   pg1_eur, pg2_eur, pg3_eur, pg4_eur, pg1_chf, pg2_chf, pg3_chf, pg4_chf)
VALUES
  ('8080','Zubehör','Füße / Rollen','Stellfuß 50mm',    NULL,NULL, 1.50,NULL,NULL,NULL, 1.62,NULL,NULL,NULL),
  ('8051','Zubehör','Füße / Rollen','Rolle Parkett',     NULL,NULL, 3.50,NULL,NULL,NULL, 3.78,NULL,NULL,NULL),
  ('8050','Zubehör','Füße / Rollen','Rolle Teppich',     NULL,NULL, 3.50,NULL,NULL,NULL, 3.78,NULL,NULL,NULL),
  ('8081','Zubehör','Füße / Rollen','Nivellierschraube', NULL,NULL, 2.00,NULL,NULL,NULL, 2.16,NULL,NULL,NULL)
ON CONFLICT (art_nr) DO UPDATE SET
  typ=EXCLUDED.typ, kategorie=EXCLUDED.kategorie, bezeichnung=EXCLUDED.bezeichnung,
  breite_mm=EXCLUDED.breite_mm, tiefe_mm=EXCLUDED.tiefe_mm,
  pg1_eur=EXCLUDED.pg1_eur, pg2_eur=EXCLUDED.pg2_eur,
  pg3_eur=EXCLUDED.pg3_eur, pg4_eur=EXCLUDED.pg4_eur,
  pg1_chf=EXCLUDED.pg1_chf, pg2_chf=EXCLUDED.pg2_chf,
  pg3_chf=EXCLUDED.pg3_chf, pg4_chf=EXCLUDED.pg4_chf;

-- ═══════════════════════════════════════════════════════════════════════════
-- Zähler zur Verifikation nach dem Import:
-- ═══════════════════════════════════════════════════════════════════════════
-- SELECT kategorie, COUNT(*) AS n FROM article_prices GROUP BY kategorie ORDER BY kategorie;
-- Erwartete Ergebnisse:
--   Boden              8
--   Doppeltür          9
--   Fachboden klein    8
--   Füße / Rollen      4
--   Griff             16
--   Klappe             8
--   Klappenboden       8
--   Profil            10
--   Rücken            28
--   Schublade          8
--   Seite außen       14
--   Seite außen SY32  14
--   Seite innen       14
--   Seite innen SY32  14
--   Tür               10
--   Würfel 30mm        1
--   GESAMT           178
