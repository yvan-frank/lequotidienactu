INSERT INTO ad_slots (code, label, page_scope) VALUES
  ('home_banner', 'Accueil — bannière pleine largeur', 'home'),
  ('article_inline', 'Article — bannière dans le contenu', 'article'),
  ('article_sidebar', 'Article — encart latéral (300x250)', 'article')
ON DUPLICATE KEY UPDATE label = VALUES(label), page_scope = VALUES(page_scope);
