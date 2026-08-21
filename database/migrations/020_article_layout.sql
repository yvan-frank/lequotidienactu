ALTER TABLE articles
  ADD COLUMN layout ENUM('standard', 'magazine') NOT NULL DEFAULT 'standard' AFTER status;
