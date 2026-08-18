<?php
declare(strict_types=1);

namespace App\Support;

use PDO;
use PDOException;

final class ArticleEmbeds
{
    /**
     * Replaces <div data-lire-aussi ...></div> placeholders — inserted
     * manually by editors via the "À lire aussi" button in the article
     * editor — with a live-rendered card. The target article is looked up
     * by id at render time, so the card always reflects its current
     * title/slug even if that changes after the embed was inserted.
     */
    public static function render(string $bodyHtml): string
    {
        $rendered = preg_replace_callback(
            '/<div\b[^>]*\bdata-lire-aussi\b[^>]*><\/div>/i',
            static function (array $matches): string {
                if (!preg_match('/data-article-id="(\d+)"/', $matches[0], $idMatch)) {
                    return '';
                }
                return self::renderCard((int) $idMatch[1]);
            },
            $bodyHtml
        );
        $rendered = $rendered ?? $bodyHtml;

        $rendered = preg_replace_callback(
            '/<div\b[^>]*\bdata-ad-in-article\b[^>]*><\/div>|<p[^>]*>\s*\[pub-in-article\]\s*<\/p>|\[pub-in-article\]/i',
            static fn (): string => self::renderInArticleAd(),
            $rendered
        );

        return $rendered ?? $bodyHtml;
    }

    /**
     * Replaces "In-Article Ad" placeholders — inserted via the toolbar
     * button in the article editor (<div data-ad-in-article></div>), or
     * typed manually as the [pub-in-article] shortcode — with the
     * "article_in_article" ad slot. Can appear multiple times; each
     * occurrence renders its own ad.
     */
    private static function renderInArticleAd(): string
    {
        return '<div class="not-prose my-8">' . Ads::renderSlot('article_in_article', 'Publicité') . '</div>';
    }

    private static function renderCard(int $articleId): string
    {
        try {
            $pdo = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            $statement = $pdo->prepare(
                'SELECT a.title, a.slug, c.slug AS category, m.path AS hero_image
                 FROM articles a
                 INNER JOIN categories c ON c.id = a.category_id
                 LEFT JOIN media m ON m.id = a.hero_media_id
                 WHERE a.id = :id AND a.status = "published" AND a.published_at <= NOW()
                 LIMIT 1'
            );
            $statement->execute(['id' => $articleId]);
            $article = $statement->fetch(PDO::FETCH_ASSOC);
            if (!$article) {
                return '';
            }

            $href = '/' . htmlspecialchars((string) $article['category'], ENT_QUOTES, 'UTF-8') . '/' . htmlspecialchars((string) $article['slug'], ENT_QUOTES, 'UTF-8');
            $image = !empty($article['hero_image'])
                ? '<img class="size-16 shrink-0 rounded-lg object-cover" src="' . htmlspecialchars((string) $article['hero_image'], ENT_QUOTES, 'UTF-8') . '" alt="" width="64" height="64">'
                : '';

            return '<aside class="not-prose my-8 flex items-center gap-4 rounded-xl border border-slate-200 bg-brand-50 p-4">'
                . $image
                . '<div class="min-w-0"><p class="text-xs font-bold tracking-widest text-brand-600 uppercase">À lire aussi</p>'
                . '<a class="mt-1 block font-bold text-slate-900 hover:text-brand-700" href="' . $href . '">' . htmlspecialchars((string) $article['title'], ENT_QUOTES, 'UTF-8') . '</a></div>'
                . '</aside>';
        } catch (PDOException) {
            return '';
        }
    }
}
