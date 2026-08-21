<?php
declare(strict_types=1);

namespace App\Support;

use PDO;
use PDOException;

final class ScheduledPublisher
{
    /**
     * Flips due 'scheduled' articles to 'published'. Nothing else does this
     * automatically — without it, a scheduled article stays invisible
     * forever once its publish date passes. Cheap no-op when nothing is due
     * (indexed on status + published_at), so it's safe to call on every request.
     */
    public static function run(): void
    {
        try {
            $pdo = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            $due = $pdo->query(
                'SELECT a.id, a.title, a.excerpt, a.slug, c.slug AS category_slug, c.name AS category_name, COALESCE(m.path, NULL) AS hero_image
                 FROM articles a
                 INNER JOIN categories c ON c.id = a.category_id
                 LEFT JOIN media m ON m.id = a.hero_media_id
                 WHERE a.status = "scheduled" AND a.published_at <= NOW()'
            )->fetchAll(PDO::FETCH_ASSOC);
            if ($due === []) {
                return;
            }

            $pdo->exec('UPDATE articles SET status = "published" WHERE status = "scheduled" AND published_at <= NOW()');

            foreach ($due as $article) {
                Push::notifyCategory($article['category_slug'], [
                    'title' => $article['category_name'] . ' — ' . $article['title'],
                    'body' => $article['excerpt'] ?? '',
                    'url' => Config::url('/' . $article['category_slug'] . '/' . $article['slug']),
                    'icon' => $article['hero_image'] ? Config::url($article['hero_image']) : Config::url('/assets/logo-header.png'),
                ]);
            }
        } catch (PDOException) {
            // Not worth failing the request over; the next request (or the cron script) will catch up.
        }
    }
}
