ALTER TABLE articles
    ADD COLUMN sidebar_mode ENUM('default', 'custom') NOT NULL DEFAULT 'default' AFTER layout,
    ADD COLUMN sidebar_blocks_json LONGTEXT NULL AFTER sidebar_mode;
