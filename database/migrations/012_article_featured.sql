ALTER TABLE articles
  ADD COLUMN is_featured TINYINT(1) NOT NULL DEFAULT 0 AFTER is_sponsored;
