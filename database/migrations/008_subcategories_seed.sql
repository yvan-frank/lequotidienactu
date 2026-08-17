-- Seed the subcategories created interactively in the admin panel (not
-- captured by 003_cms_seed.sql, which only creates the 6 top-level categories).
-- Safe to re-run: matched by the unique slug, skipped if already present.

INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'afrique' LIMIT 1), 'Cameroun', 'cameroun', 1;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'afrique' LIMIT 1), 'Afrique centrale', 'afrique-centrale', 2;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'afrique' LIMIT 1), 'Côte d\'Ivoire', 'cote-d-ivoire', 3;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'afrique' LIMIT 1), 'Sénégal', 'senegal', 4;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'afrique' LIMIT 1), 'Actualité régionale', 'actualite-regionale', 5;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'france-diaspora' LIMIT 1), 'Vie pratique', 'vie-pratique', 1;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'france-diaspora' LIMIT 1), 'Immigration', 'immigration', 2;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'france-diaspora' LIMIT 1), 'Études', 'etudes', 3;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'france-diaspora' LIMIT 1), 'Emploi', 'emploi', 4;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'france-diaspora' LIMIT 1), 'Société', 'societe', 5;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'business' LIMIT 1), 'Économie', 'economie', 1;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'business' LIMIT 1), 'Entreprises', 'entreprises', 2;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'business' LIMIT 1), 'Startups', 'startups', 3;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'business' LIMIT 1), 'Fintech', 'fintech', 4;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'business' LIMIT 1), 'Entrepreneuriat', 'entrepreneuriat', 5;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'tech' LIMIT 1), 'IA', 'ia', 1;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'tech' LIMIT 1), 'Numérique', 'numerique', 2;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'tech' LIMIT 1), 'Applications', 'applications', 3;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'tech' LIMIT 1), 'Cybersécurité', 'cybersecurite', 4;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'tech' LIMIT 1), 'Réseaux sociaux', 'reseaux-sociaux', 5;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'sport' LIMIT 1), 'Football africain', 'football-africain', 1;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'sport' LIMIT 1), 'Compétitions internationales', 'competitions-internationales', 2;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'culture' LIMIT 1), 'Musique', 'musique', 1;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'culture' LIMIT 1), 'Cinéma', 'cinema', 2;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'culture' LIMIT 1), 'Tendances', 'tendances', 3;
INSERT IGNORE INTO categories (parent_id, name, slug, position)
SELECT (SELECT id FROM categories WHERE slug = 'culture' LIMIT 1), 'Personnalités', 'personnalites', 4;
