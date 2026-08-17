INSERT IGNORE INTO users (id, name, email, password_hash, role) VALUES (1, 'Administrateur', 'admin@lequotidienactu.local', '$2y$10$MRAUFcdLcm8L5J2W6SLwseLCAwEy.AEbhRZtZ9ViqIcf0iTa8fsiS', 'admin');
INSERT IGNORE INTO authors (id, user_id, display_name, slug, bio) VALUES (1, 1, 'La rédaction', 'la-redaction', 'Rédaction de Le Quotidien Actu.');
UPDATE authors SET user_id = 1 WHERE id = 1 AND user_id IS NULL;
INSERT IGNORE INTO categories (name, slug, position) VALUES ('Afrique', 'afrique', 1), ('France & Diaspora', 'france-diaspora', 2), ('Business', 'business', 3), ('Tech', 'tech', 4), ('Sport', 'sport', 5), ('Culture', 'culture', 6);
