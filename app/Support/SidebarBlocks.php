<?php
declare(strict_types=1);

namespace App\Support;

use PDO;
use PDOException;

/**
 * Renders a per-article custom sidebar built from configurable widgets in
 * the admin's drag-and-drop builder (Theme > ... first consumer:
 * ArticleEditor's "Composants" mode). Mirrors ArticleEmbeds' one-render-
 * method-per-type pattern so new widget types stay a single new `case`
 * plus a private render method — no changes to the dispatch itself.
 *
 * Block shape: [{ "type": "latest_articles", "props": { ... } }, ...].
 */
final class SidebarBlocks
{
    public static function render(array $blocks, bool $readerIsPremium, ?int $excludeArticleId = null): string
    {
        $html = '';
        foreach ($blocks as $block) {
            if (!is_array($block) || !isset($block['type'])) {
                continue;
            }
            $props = is_array($block['props'] ?? null) ? $block['props'] : [];
            $html .= match ($block['type']) {
                'ad' => self::renderAd($readerIsPremium),
                'latest_articles' => self::renderLatestArticles($props, $excludeArticleId),
                'newsletter' => self::renderNewsletter($props),
                'text' => self::renderText($props),
                default => '',
            };
        }
        return $html;
    }

    private static function renderAd(bool $readerIsPremium): string
    {
        if ($readerIsPremium) {
            return '';
        }
        return '<div class="min-h-64">' . Ads::renderSlot('article_sidebar', 'Publicité · 300 × 250') . '</div>';
    }

    private static function renderLatestArticles(array $props, ?int $excludeArticleId): string
    {
        $title = trim((string) ($props['title'] ?? 'À lire aussi'));
        $count = max(1, min(8, (int) ($props['count'] ?? 4)));

        try {
            $pdo = new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            $sql = 'SELECT a.title, a.slug, c.slug AS category, c.name AS category_name, COALESCE(m.path, "/assets/hero-placeholder.svg") AS hero_image
                    FROM articles a INNER JOIN categories c ON c.id = a.category_id LEFT JOIN media m ON m.id = a.hero_media_id
                    WHERE a.status = "published" AND a.published_at <= NOW()' . ($excludeArticleId !== null ? ' AND a.id != :excludeId' : '') . '
                    ORDER BY a.published_at DESC LIMIT ' . $count;
            $statement = $pdo->prepare($sql);
            if ($excludeArticleId !== null) {
                $statement->bindValue('excludeId', $excludeArticleId, PDO::PARAM_INT);
            }
            $statement->execute();
            $items = $statement->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException) {
            return '';
        }
        if ($items === []) {
            return '';
        }

        $rows = '';
        foreach ($items as $item) {
            $rows .= '<a class="group flex items-center gap-3 py-3 first:pt-0 last:pb-0" href="/' . htmlspecialchars((string) $item['category'], ENT_QUOTES, 'UTF-8') . '/' . htmlspecialchars((string) $item['slug'], ENT_QUOTES, 'UTF-8') . '">'
                . '<img class="size-14 shrink-0 rounded-lg object-cover" src="' . htmlspecialchars((string) $item['hero_image'], ENT_QUOTES, 'UTF-8') . '" alt="" width="56" height="56" loading="lazy">'
                . '<div class="min-w-0"><p class="text-[11px] font-bold tracking-widest text-brand-600 uppercase">' . htmlspecialchars((string) $item['category_name'], ENT_QUOTES, 'UTF-8') . '</p>'
                . '<h4 class="mt-1 line-clamp-2 text-sm leading-snug font-bold text-slate-900 group-hover:text-brand-600">' . htmlspecialchars((string) $item['title'], ENT_QUOTES, 'UTF-8') . '</h4></div>'
                . '</a>';
        }

        return '<div class="rounded-xl border border-slate-200 bg-white p-5">'
            . '<p class="text-xs font-bold tracking-widest text-slate-400 uppercase">' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</p>'
            . '<div class="mt-4 divide-y divide-slate-100">' . $rows . '</div>'
            . '</div>';
    }

    /**
     * Reuses the exact `data-island="newsletter"` markup/behavior from the
     * footer form (public.js wires every element matching that selector,
     * not just the footer's), just re-skinned for a boxed sidebar card.
     */
    private static function renderNewsletter(array $props): string
    {
        $title = trim((string) ($props['title'] ?? 'Restez informé'));
        $description = trim((string) ($props['description'] ?? ''));
        $inputId = 'newsletter-email-' . substr(md5(uniqid('', true)), 0, 8);

        return '<div class="rounded-xl border border-slate-200 bg-white p-5">'
            . '<p class="text-xs font-bold tracking-widest text-slate-400 uppercase">' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</p>'
            . ($description !== '' ? '<p class="mt-2 text-sm leading-relaxed text-slate-600">' . htmlspecialchars($description, ENT_QUOTES, 'UTF-8') . '</p>' : '')
            . '<form class="mt-4 grid gap-2" data-island="newsletter">'
            . '<input class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none disabled:opacity-60" id="' . $inputId . '" type="email" name="email" placeholder="vous@exemple.fr" required>'
            . '<button type="submit" data-newsletter-submit class="inline-flex items-center justify-center gap-2 rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">'
            . '<svg data-newsletter-spinner class="hidden size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4Z"/></svg>'
            . '<span data-newsletter-label>S’inscrire</span></button>'
            . '<p data-newsletter-message class="hidden text-sm" role="status" aria-live="polite"></p>'
            . '</form></div>';
    }

    private static function renderText(array $props): string
    {
        $title = trim((string) ($props['title'] ?? ''));
        $text = trim((string) ($props['text'] ?? ''));
        if ($text === '') {
            return '';
        }

        return '<div class="rounded-xl border border-slate-200 bg-white p-5">'
            . ($title !== '' ? '<p class="text-xs font-bold tracking-widest text-slate-400 uppercase">' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</p>' : '')
            . '<p class="' . ($title !== '' ? 'mt-3 ' : '') . 'text-sm leading-relaxed text-slate-600">' . nl2br(htmlspecialchars($text, ENT_QUOTES, 'UTF-8')) . '</p>'
            . '</div>';
    }
}
