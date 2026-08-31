ALTER TABLE articles
    ADD COLUMN content_mode ENUM('classic', 'builder') NOT NULL DEFAULT 'classic' AFTER sidebar_blocks_json,
    ADD COLUMN content_blocks_json LONGTEXT NULL AFTER content_mode;
