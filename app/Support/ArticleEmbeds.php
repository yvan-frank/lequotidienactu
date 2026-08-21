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
        $rendered = $rendered ?? $bodyHtml;

        $rendered = preg_replace_callback(
            '/<div\b[^>]*\bdata-faq="([^"]*)"[^>]*><\/div>/i',
            static function (array $matches): string {
                return self::renderFaq(html_entity_decode($matches[1], ENT_QUOTES, 'UTF-8'));
            },
            $rendered
        );
        $rendered = $rendered ?? $bodyHtml;

        $rendered = preg_replace_callback(
            '/<div\b[^>]*\bdata-cta-button\b[^>]*><\/div>/i',
            static function (array $matches): string {
                $text = self::extractAttribute($matches[0], 'data-cta-text');
                $url = self::extractAttribute($matches[0], 'data-cta-url');
                $style = self::extractAttribute($matches[0], 'data-cta-style');
                $fullWidth = self::extractAttribute($matches[0], 'data-cta-full') === '1';
                return self::renderButton($text, $url, $style, $fullWidth);
            },
            $rendered
        );

        return $rendered ?? $bodyHtml;
    }

    private static function extractAttribute(string $tag, string $name): string
    {
        if (!preg_match('/' . preg_quote($name, '/') . '="([^"]*)"/', $tag, $match)) {
            return '';
        }
        return html_entity_decode($match[1], ENT_QUOTES, 'UTF-8');
    }

    /**
     * Replaces the CTA button block inserted via the editor toolbar
     * (<div data-cta-button data-cta-text="…" data-cta-url="…"
     * data-cta-style="solid|outline|soft|link" data-cta-full="0|1"></div>)
     * with a plain <a> tag in one of four configurable, dependency-free
     * styles, optionally stretched to the full content width.
     */
    private static function renderButton(string $text, string $url, string $style, bool $fullWidth): string
    {
        $text = trim($text);
        $url = trim($url);
        if ($text === '' || $url === '') {
            return '';
        }

        $classesByStyle = [
            'solid' => 'bg-brand-600 text-white border border-transparent hover:bg-brand-700',
            'outline' => 'border-2 border-brand-600 text-brand-700 bg-white hover:bg-brand-50',
            'soft' => 'border border-transparent bg-brand-50 text-brand-700 hover:bg-brand-600/10',
            'link' => 'text-brand-700 underline underline-offset-4 hover:text-brand-600 px-0 py-0',
        ];
        $classes = $classesByStyle[$style] ?? $classesByStyle['solid'];
        $widthClasses = $fullWidth ? 'w-full justify-center text-center' : 'w-fit';

        $safeText = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
        $safeUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
        $external = preg_match('#^https?://#i', $url) === 1;
        $relAttr = $external ? ' rel="noopener noreferrer" target="_blank"' : '';

        return '<p class="not-prose my-6"><a class="flex items-center rounded-full px-6 py-3 text-sm font-bold transition ' . $widthClasses . ' ' . $classes . '" href="' . $safeUrl . '"' . $relAttr . '>' . $safeText . '</a></p>';
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

    /**
     * Replaces the FAQ block inserted via the editor toolbar
     * (<div data-faq='[{"question":"…","answer":"…"}, …]'></div>) with a
     * dependency-free accordion — native <details>/<summary>, no JS — plus
     * FAQPage structured data so eligible pages can earn rich results.
     */
    private static function renderFaq(string $json): string
    {
        $items = json_decode($json, true);
        if (!is_array($items) || $items === []) {
            return '';
        }

        $rows = '';
        $jsonLdItems = [];
        foreach ($items as $item) {
            $question = trim((string) ($item['question'] ?? ''));
            $answer = trim((string) ($item['answer'] ?? ''));
            if ($question === '' || $answer === '') {
                continue;
            }
            $safeQuestion = htmlspecialchars($question, ENT_QUOTES, 'UTF-8');
            $safeAnswer = htmlspecialchars($answer, ENT_QUOTES, 'UTF-8');
            $rows .= '<details class="group px-4 py-3 open:pb-4">'
                . '<summary class="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900 marker:content-none">'
                . '<span>' . $safeQuestion . '</span>'
                . '<span class="grid size-6 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 transition-transform duration-200 group-open:rotate-45" aria-hidden="true">+</span>'
                . '</summary>'
                . '<p class="mt-2 text-sm leading-relaxed text-slate-600">' . nl2br($safeAnswer) . '</p>'
                . '</details>';
            $jsonLdItems[] = [
                '@type' => 'Question',
                'name' => $question,
                'acceptedAnswer' => ['@type' => 'Answer', 'text' => $answer],
            ];
        }

        if ($rows === '') {
            return '';
        }

        $jsonLd = json_encode([
            '@context' => 'https://schema.org',
            '@type' => 'FAQPage',
            'mainEntity' => $jsonLdItems,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);

        return '<div class="not-prose my-8 overflow-hidden rounded-xl border border-slate-200 bg-white">'
            . '<p class="border-b border-slate-100 px-4 py-3 text-xs font-bold tracking-widest text-brand-600 uppercase">Questions fréquentes</p>'
            . '<div class="divide-y divide-slate-100">' . $rows . '</div>'
            . '</div>'
            . '<script type="application/ld+json">' . $jsonLd . '</script>';
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
