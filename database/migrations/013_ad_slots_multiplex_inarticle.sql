INSERT INTO ad_slots (code, label, page_scope) VALUES
  ('home_multiplex', 'Accueil — annonce multiplex', 'home'),
  ('article_in_article', 'Article — annonce In-Article (shortcode [pub-in-article])', 'article')
ON DUPLICATE KEY UPDATE label = VALUES(label), page_scope = VALUES(page_scope);
