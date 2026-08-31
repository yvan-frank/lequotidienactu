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

    /**
     * $depth guards against runaway recursion from a `columns` block whose
     * own columns contain another `columns` block — the builder's palette
     * never offers that nesting, but the JSON is free-form once it reaches
     * here, so a corrupt or hand-edited payload shouldn't be able to blow
     * the stack. One level of columns-in-columns is allowed; deeper than
     * that renders as nothing.
     */
    public static function render(array $blocks, int $depth = 0): string
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
                'quote' => self::renderQuote($props),
                'faq' => self::renderFaq($props),
                'button' => self::renderButton($props),
                'ad' => ArticleEmbeds::renderInArticleAd(),
                'columns' => $depth < 1 ? self::renderColumns($props, $depth) : '',
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
                'quote' => trim((string) ($props['text'] ?? '')) . ' ',
                'faq' => implode(' ', array_map(
                    static fn (array $item): string => trim((string) ($item['question'] ?? '')) . ' ' . trim((string) ($item['answer'] ?? '')),
                    is_array($props['items'] ?? null) ? $props['items'] : [],
                )) . ' ',
                'button' => trim((string) ($props['text'] ?? '')) . ' ',
                'columns' => implode(' ', array_map(
                    fn (array $column): string => self::toPlainText(is_array($column['blocks'] ?? null) ? $column['blocks'] : []),
                    is_array($props['columns'] ?? null) ? $props['columns'] : [],
                )) . ' ',
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

    private static function renderQuote(array $props): string
    {
        $text = trim((string) ($props['text'] ?? ''));
        if ($text === '') {
            return '';
        }
        $safeText = nl2br(htmlspecialchars($text, ENT_QUOTES, 'UTF-8'));
        $author = trim((string) ($props['author'] ?? ''));
        $footer = $author !== '' ? '<footer class="mt-2 text-sm font-semibold not-italic text-slate-500">— ' . htmlspecialchars($author, ENT_QUOTES, 'UTF-8') . '</footer>' : '';
        return '<blockquote>' . '<p>' . $safeText . '</p>' . $footer . '</blockquote>';
    }

    private static function renderFaq(array $props): string
    {
        $items = is_array($props['items'] ?? null) ? $props['items'] : [];
        return ArticleEmbeds::renderFaqItems($items);
    }

    private static function renderButton(array $props): string
    {
        return ArticleEmbeds::renderButton(
            (string) ($props['text'] ?? ''),
            (string) ($props['url'] ?? ''),
            (string) ($props['style'] ?? 'solid'),
            !empty($props['fullWidth']),
        );
    }

    private static function renderColumns(array $props, int $depth): string
    {
        $columns = is_array($props['columns'] ?? null) ? $props['columns'] : [];
        if ($columns === []) {
            return '';
        }
        $count = count($columns) === 3 ? 3 : 2;
        $cells = '';
        foreach ($columns as $column) {
            $blocks = is_array($column['blocks'] ?? null) ? $column['blocks'] : [];
            $cells .= '<div>' . self::render($blocks, $depth + 1) . '</div>';
        }
        return '<div class="my-6 grid gap-6 sm:grid-cols-' . $count . '">' . $cells . '</div>';
    }
}
