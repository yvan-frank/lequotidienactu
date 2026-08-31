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
        // Only the top-level call needs to know where headings will land —
        // a heading nested inside a `columns` block (depth > 0) doesn't get
        // a Sommaire anchor; keeping that scan single-level keeps it cheap
        // and avoids collecting IDs for headings whose position on the page
        // (which column, which order) a linear sommaire can't represent
        // sensibly anyway.
        $headingSlugs = $depth === 0 ? self::collectHeadingSlugs($blocks) : [];
        $headingIndex = 0;

        $html = '';
        foreach ($blocks as $block) {
            if (!is_array($block) || !isset($block['type'])) {
                continue;
            }
            $props = is_array($block['props'] ?? null) ? $block['props'] : [];
            $html .= match ($block['type']) {
                'heading' => self::renderHeading($props, $headingSlugs[$headingIndex++] ?? null),
                'text' => self::renderText($props),
                'image' => self::renderImage($props),
                'quote' => self::renderQuote($props),
                'faq' => self::renderFaq($props),
                'button' => self::renderButton($props),
                'ad' => ArticleEmbeds::renderInArticleAd(),
                'columns' => $depth < 1 ? self::renderColumns($props, $depth) : '',
                'divider' => '<hr class="my-8 border-slate-200">',
                'video' => self::renderVideo($props),
                'article' => self::renderArticleCard($props),
                'table' => self::renderTable($props),
                'callout' => self::renderCallout($props),
                'toc' => self::renderToc($headingSlugs, $props),
                default => '',
            };
        }
        return $html;
    }

    /**
     * @return array<int, array{text: string, level: int, slug: string}|null>
     *   One entry per heading block, in document order — null for a heading
     *   left empty so far (nothing to link to yet).
     */
    private static function collectHeadingSlugs(array $blocks): array
    {
        $seen = [];
        $result = [];
        foreach ($blocks as $block) {
            if (!is_array($block) || ($block['type'] ?? null) !== 'heading') {
                continue;
            }
            $text = trim((string) ($block['props']['text'] ?? ''));
            if ($text === '') {
                $result[] = null;
                continue;
            }
            $base = Slug::make($text) ?: 'section';
            $slug = $base;
            $suffix = 2;
            while (isset($seen[$slug])) {
                $slug = $base . '-' . $suffix++;
            }
            $seen[$slug] = true;
            $result[] = ['text' => $text, 'level' => (int) ($block['props']['level'] ?? 2) === 3 ? 3 : 2, 'slug' => $slug];
        }
        return $result;
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
                'article' => trim((string) ($props['title'] ?? '')) . ' ',
                'table' => implode(' ', array_map(
                    static fn (mixed $row): string => is_array($row) ? implode(' ', array_map('strval', $row)) : '',
                    is_array($props['rows'] ?? null) ? $props['rows'] : [],
                )) . ' ',
                'callout' => trim((string) ($props['title'] ?? '')) . ' ' . trim((string) ($props['text'] ?? '')) . ' ',
                default => '',
            };
        }
        return trim($text);
    }

    /**
     * $slugInfo, when present, is this heading's precomputed entry from
     * collectHeadingSlugs() — same text, so this never derives its own id
     * and risks drifting out of sync with what a `toc` block linked to.
     */
    private static function renderHeading(array $props, ?array $slugInfo = null): string
    {
        $text = trim((string) ($props['text'] ?? ''));
        if ($text === '') {
            return '';
        }
        $level = (int) ($props['level'] ?? 2) === 3 ? 3 : 2;
        $idAttr = $slugInfo !== null
            ? ' id="' . htmlspecialchars($slugInfo['slug'], ENT_QUOTES, 'UTF-8') . '" style="scroll-margin-top:6rem"'
            : '';
        return '<h' . $level . $idAttr . '>' . htmlspecialchars($text, ENT_QUOTES, 'UTF-8') . '</h' . $level . '>';
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

    /**
     * Accepts a YouTube or Vimeo watch/share URL (typed or pasted straight
     * from the browser address bar) and embeds it responsively. Anything
     * else — a host we don't recognize — renders nothing rather than risk
     * embedding an arbitrary iframe.
     */
    private static function renderVideo(array $props): string
    {
        $url = trim((string) ($props['url'] ?? ''));
        if ($url === '') {
            return '';
        }
        $embedUrl = self::toEmbedUrl($url);
        if ($embedUrl === null) {
            return '';
        }
        $safeUrl = htmlspecialchars($embedUrl, ENT_QUOTES, 'UTF-8');
        return '<div class="not-prose my-6 aspect-video overflow-hidden rounded-xl bg-slate-950">'
            . '<iframe class="size-full" src="' . $safeUrl . '" title="Vidéo intégrée" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>'
            . '</div>';
    }

    private static function toEmbedUrl(string $url): ?string
    {
        if (preg_match('#youtu\.be/([\w-]{6,})#', $url, $match)
            || preg_match('#youtube\.com/(?:watch\?v=|embed/|shorts/)([\w-]{6,})#', $url, $match)
        ) {
            return 'https://www.youtube-nocookie.com/embed/' . $match[1];
        }
        if (preg_match('#vimeo\.com/(?:video/)?(\d+)#', $url, $match)) {
            return 'https://player.vimeo.com/video/' . $match[1];
        }
        return null;
    }

    /**
     * The block only stores the target article's id — its title/link
     * always reflect the current state of that article, same guarantee as
     * the classic editor's "À lire aussi" embed.
     */
    private static function renderArticleCard(array $props): string
    {
        $articleId = (int) ($props['articleId'] ?? 0);
        if ($articleId <= 0) {
            return '';
        }
        return ArticleEmbeds::renderCard($articleId);
    }

    /**
     * Renders as a plain <table>, styled the same way as a table pasted or
     * typed directly into the classic Tiptap editor (they share the exact
     * same markup shape — this is just Tiptap's own table output, hand-
     * assembled from the builder's row/column grid instead).
     */
    private static function renderTable(array $props): string
    {
        $rows = is_array($props['rows'] ?? null) ? array_values($props['rows']) : [];
        if ($rows === []) {
            return '';
        }
        $headerRow = $props['headerRow'] ?? true;

        $renderRow = static function (mixed $row, string $cellTag): string {
            if (!is_array($row)) {
                return '';
            }
            $cells = '';
            foreach ($row as $cell) {
                $cells .= '<' . $cellTag . '>' . nl2br(htmlspecialchars((string) $cell, ENT_QUOTES, 'UTF-8')) . '</' . $cellTag . '>';
            }
            return $cells === '' ? '' : '<tr>' . $cells . '</tr>';
        };

        $theadHtml = '';
        if ($headerRow) {
            $headRow = array_shift($rows);
            $headHtml = $renderRow($headRow, 'th');
            if ($headHtml !== '') {
                $theadHtml = '<thead>' . $headHtml . '</thead>';
            }
        }

        $bodyHtml = '';
        foreach ($rows as $row) {
            $bodyHtml .= $renderRow($row, 'td');
        }

        if ($theadHtml === '' && $bodyHtml === '') {
            return '';
        }
        return '<table>' . $theadHtml . '<tbody>' . $bodyHtml . '</tbody></table>';
    }

    /**
     * "Encadré" — a callout box in one of three tones. Matches the boxed
     * "à retenir / erreurs à éviter / rappel important" panels already
     * common in this site's hand-designed article hero images, as an
     * actual reusable block instead of a picture.
     */
    private static function renderCallout(array $props): string
    {
        $text = trim((string) ($props['text'] ?? ''));
        if ($text === '') {
            return '';
        }
        $variant = in_array($props['variant'] ?? 'info', ['info', 'tip', 'warning'], true) ? $props['variant'] : 'info';
        $style = [
            'info' => ['bg' => 'bg-sky-50', 'border' => 'border-sky-200', 'text' => 'text-sky-900', 'accent' => 'text-sky-600'],
            'tip' => ['bg' => 'bg-emerald-50', 'border' => 'border-emerald-200', 'text' => 'text-emerald-900', 'accent' => 'text-emerald-600'],
            'warning' => ['bg' => 'bg-amber-50', 'border' => 'border-amber-200', 'text' => 'text-amber-900', 'accent' => 'text-amber-600'],
        ][$variant];

        $title = trim((string) ($props['title'] ?? ''));
        $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        $safeText = nl2br(htmlspecialchars($text, ENT_QUOTES, 'UTF-8'));

        return '<div class="not-prose my-6 flex gap-3 rounded-xl border ' . $style['border'] . ' ' . $style['bg'] . ' p-4">'
            . '<span class="mt-0.5 shrink-0 ' . $style['accent'] . '">' . self::calloutIcon($variant) . '</span>'
            . '<div class="min-w-0 ' . $style['text'] . '">'
            . ($safeTitle !== '' ? '<p class="font-bold">' . $safeTitle . '</p>' : '')
            . '<p class="' . ($safeTitle !== '' ? 'mt-1 ' : '') . 'text-sm leading-relaxed">' . $safeText . '</p>'
            . '</div></div>';
    }

    private static function calloutIcon(string $variant): string
    {
        return match ($variant) {
            'tip' => '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5A5 5 0 1 0 5.5 9c0 1.5.5 2 1.5 3s1.3 1.5 1.5 2"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
            'warning' => '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
            default => '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
        };
    }

    /**
     * "Sommaire" — links to every heading already collected by
     * collectHeadingSlugs() for this render() call. Renders nothing if the
     * article has no headings yet, rather than an empty, confusing box.
     */
    private static function renderToc(array $headingSlugs, array $props): string
    {
        $items = array_values(array_filter($headingSlugs));
        if ($items === []) {
            return '';
        }
        $title = trim((string) ($props['title'] ?? '')) ?: 'Sommaire';

        $rows = '';
        foreach ($items as $heading) {
            $indentClass = $heading['level'] === 3 ? ' pl-4' : '';
            $rows .= '<li class="' . ltrim($indentClass) . '"><a class="text-slate-700 hover:text-brand-700 hover:underline" href="#' . htmlspecialchars($heading['slug'], ENT_QUOTES, 'UTF-8') . '">' . htmlspecialchars($heading['text'], ENT_QUOTES, 'UTF-8') . '</a></li>';
        }

        return '<nav class="not-prose my-6 rounded-xl border border-slate-200 bg-slate-50 p-5" aria-label="Sommaire">'
            . '<p class="text-xs font-bold tracking-widest text-slate-500 uppercase">' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</p>'
            . '<ul class="mt-3 grid gap-1.5 text-sm">' . $rows . '</ul>'
            . '</nav>';
    }
}
