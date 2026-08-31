<?php
declare(strict_types=1);

namespace App\Support;

/**
 * Renders the main article body when an article uses the "Composants"
 * builder (articles.content_mode = 'builder') instead of the classic
 * Tiptap editor. Same one-render-method-per-type dispatch as SidebarBlocks
 * and ArticleEmbeds — a new block type is a `case` here plus a registry
 * entry in ContentBuilder.tsx, nothing else.
 *
 * Block shape: [{ "type": "heading", "props": { ... } }, ...].
 */
final class ContentBlocks
{
    /**
     * Picks the right body source for one article row — its builder blocks
     * if it uses the "Composants" mode and has any, otherwise the classic
     * editor's HTML `body` (or the excerpt as a last-resort fallback).
     * Shared by article.php and article-magazine.php.
     */
    public static function renderArticleBody(array $article): string
    {
        if (($article['content_mode'] ?? 'classic') === 'builder' && !empty($article['content_blocks_json'])) {
            $decoded = json_decode((string) $article['content_blocks_json'], true);
            if (is_array($decoded) && $decoded !== []) {
                return self::render($decoded);
            }
        }
        return ArticleEmbeds::render($article['body'] ?? '<p>' . htmlspecialchars($article['excerpt'] ?? '') . '</p>');
    }

    public static function render(array $blocks): string
    {
        $html = '';
        foreach ($blocks as $block) {
            if (!is_array($block) || !isset($block['type'])) {
                continue;
            }
            $props = is_array($block['props'] ?? null) ? $block['props'] : [];
            $html .= match ($block['type']) {
                'heading' => self::renderHeading($props),
                'text' => self::renderText($props),
                'image' => self::renderImage($props),
                default => '',
            };
        }
        return $html;
    }

    /**
     * Extracts a plain-text approximation of the article body from its
     * blocks — used where the classic editor's HTML `body` would normally
     * be measured: word count / reading time, and the SEO keyword-density
     * checks in the admin.
     */
    public static function toPlainText(array $blocks): string
    {
        $text = '';
        foreach ($blocks as $block) {
            if (!is_array($block) || !isset($block['type'])) {
                continue;
            }
            $props = is_array($block['props'] ?? null) ? $block['props'] : [];
            $text .= match ($block['type']) {
                'heading' => trim((string) ($props['text'] ?? '')) . ' ',
                'text' => strip_tags((string) ($props['html'] ?? '')) . ' ',
                'image' => trim((string) ($props['alt'] ?? '')) . ' ',
                default => '',
            };
        }
        return trim($text);
    }

    private static function renderHeading(array $props): string
    {
        $text = trim((string) ($props['text'] ?? ''));
        if ($text === '') {
            return '';
        }
        $level = (int) ($props['level'] ?? 2) === 3 ? 3 : 2;
        return '<h' . $level . '>' . htmlspecialchars($text, ENT_QUOTES, 'UTF-8') . '</h' . $level . '>';
    }

    /**
     * The block's `html` comes from the same RichTextEditor instance used
     * inline elsewhere in the admin, so it can already contain the file
     * attachment / highlight / alignment markup those extensions emit —
     * routing it through ArticleEmbeds::render() keeps that working here
     * exactly like it does for the classic editor's body.
     */
    private static function renderText(array $props): string
    {
        $html = trim((string) ($props['html'] ?? ''));
        if ($html === '' || $html === '<p></p>') {
            return '';
        }
        return ArticleEmbeds::render($html);
    }

    private static function renderImage(array $props): string
    {
        $url = trim((string) ($props['url'] ?? ''));
        if ($url === '') {
            return '';
        }
        $alt = trim((string) ($props['alt'] ?? ''));
        $caption = trim((string) ($props['caption'] ?? ''));
        $safeUrl = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
        $safeAlt = htmlspecialchars($alt, ENT_QUOTES, 'UTF-8');

        $figure = '<img src="' . $safeUrl . '" alt="' . $safeAlt . '" loading="lazy">';
        if ($caption !== '') {
            $figure = '<figure>' . $figure . '<figcaption>' . htmlspecialchars($caption, ENT_QUOTES, 'UTF-8') . '</figcaption></figure>';
        }
        return $figure;
    }
}
