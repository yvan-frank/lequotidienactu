ALTER TABLE readers
  ADD COLUMN stripe_customer_id VARCHAR(255) NULL AFTER followed_categories,
  ADD COLUMN stripe_subscription_id VARCHAR(255) NULL AFTER stripe_customer_id,
  ADD COLUMN premium_status ENUM('none', 'active', 'past_due', 'canceled') NOT NULL DEFAULT 'none' AFTER stripe_subscription_id,
  ADD COLUMN premium_current_period_end DATETIME NULL AFTER premium_status;
