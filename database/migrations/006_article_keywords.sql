ALTER TABLE articles
  ADD COLUMN primary_keyword VARCHAR(190) NULL AFTER robots,
  ADD COLUMN secondary_keywords VARCHAR(500) NULL AFTER primary_keyword;
