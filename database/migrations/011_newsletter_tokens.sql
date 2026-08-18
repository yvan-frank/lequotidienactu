ALTER TABLE newsletter_subscribers
  ADD COLUMN token CHAR(64) NULL UNIQUE AFTER status,
  ADD COLUMN confirmed_at DATETIME NULL AFTER token;
