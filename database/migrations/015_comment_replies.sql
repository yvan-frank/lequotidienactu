ALTER TABLE comments
  ADD COLUMN parent_id BIGINT UNSIGNED NULL AFTER article_id,
  ADD INDEX(parent_id),
  ADD FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;
