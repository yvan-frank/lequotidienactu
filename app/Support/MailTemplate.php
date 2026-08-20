<?php
declare(strict_types=1);

namespace App\Support;

final class MailTemplate
{
    /**
     * Renders a branded HTML email digest: a heading, an optional intro
     * paragraph, then the selected articles as cards. The first
     * `$featuredCount` articles render as full-width horizontal cards
     * (image beside the text — a "top stories" strip), the rest as a
     * two-column vertical-card grid below. Real CSS grid/flexbox isn't
     * reliable across email clients, so both layouts use nested `<table>`s
     * with a media query to stack to one column on narrow screens,
     * degrading gracefully to a fixed layout on clients that ignore
     * `<style>` blocks, like desktop Outlook.
     *
     * @param array<int, array{title: string, excerpt: ?string, url: string, hero_image: string, category_name: string}> $articles
     */
    public static function renderDigest(string $heading, ?string $intro, array $articles, int $featuredCount, string $unsubscribeLink): string
    {
        $appName = htmlspecialchars($_ENV['APP_NAME'] ?? 'Le Quotidien Actu', ENT_QUOTES, 'UTF-8');
        $logoUrl = htmlspecialchars(Config::url('/assets/logo-header.png'), ENT_QUOTES, 'UTF-8');
        $headingSafe = htmlspecialchars($heading, ENT_QUOTES, 'UTF-8');
        $preheaderSafe = htmlspecialchars($intro !== null && $intro !== '' ? $intro : $heading, ENT_QUOTES, 'UTF-8');
        $unsubscribeSafe = htmlspecialchars($unsubscribeLink, ENT_QUOTES, 'UTF-8');
        $year = date('Y');

        $introHtml = $intro !== null && $intro !== ''
            ? '<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">' . nl2br(htmlspecialchars($intro, ENT_QUOTES, 'UTF-8')) . '</p>'
            : '';

        $featuredCount = max(0, min($featuredCount, count($articles)));
        $featured = array_slice($articles, 0, $featuredCount);
        $rest = array_slice($articles, $featuredCount);

        $featuredHtml = implode('', array_map(
            static fn (array $article): string => '<tr><td style="padding-bottom:16px;">' . self::renderDigestHorizontalCard($article) . '</td></tr>',
            $featured,
        ));
        $featuredHtml = $featuredHtml !== ''
            ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $featuredHtml . '</table>'
            : '';

        $cards = array_map(static fn (array $article): string => self::renderDigestCard($article), $rest);
        if (count($cards) === 0) {
            $gridHtml = '';
        } elseif (count($cards) === 1) {
            $gridHtml = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td>' . $cards[0] . '</td></tr></table>';
        } else {
            $rowsHtml = '';
            for ($i = 0; $i < count($cards); $i += 2) {
                $left = $cards[$i];
                $right = $cards[$i + 1] ?? '';
                $rowsHtml .= '<tr>'
                    . '<td class="lqa-col" width="48%" valign="top" style="padding-bottom:16px;">' . $left . '</td>'
                    . '<td class="lqa-gap" width="4%"></td>'
                    . '<td class="lqa-col" width="48%" valign="top" style="padding-bottom:16px;">' . $right . '</td>'
                    . '</tr>';
            }
            $gridHtml = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $rowsHtml . '</table>';
        }
        $gridSpacerHtml = $featuredHtml !== '' && $gridHtml !== '' ? '<div style="height:8px;line-height:8px;">&nbsp;</div>' : '';

        return <<<HTML
        <!doctype html>
        <html lang="fr">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>{$appName}</title>
        <style>
          @media (max-width:600px) {
            .lqa-col { display:block !important; width:100% !important; padding-bottom:16px !important; }
            .lqa-gap { display:none !important; }
            .lqa-h-img { display:block !important; width:100% !important; }
            .lqa-h-img img { width:100% !important; height:160px !important; border-radius:9px 9px 0 0 !important; }
            .lqa-h-text { display:block !important; width:100% !important; }
          }
        </style>
        </head>
        <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <span style="display:none;max-height:0;overflow:hidden;opacity:0;">{$preheaderSafe}</span>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" style="max-width:600px;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 24px;text-align:center;">
                    <img src="{$logoUrl}" alt="{$appName}" height="40" style="height:40px;width:auto;">
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 8px 16px;">
                    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:#0f172a;">{$headingSafe}</h1>
                    {$introHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 8px;">
                    {$featuredHtml}
                    {$gridSpacerHtml}
                    {$gridHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 8px 0;text-align:center;">
                    <p style="margin:0 0 6px;font-size:12px;color:#94a3b8;">&copy; {$year} {$appName}. Tous droits réservés.</p>
                    <p style="margin:0;font-size:12px;color:#94a3b8;"><a href="{$unsubscribeSafe}" style="color:#94a3b8;">Se désinscrire</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        </body>
        </html>
        HTML;
    }

    /**
     * @param array{title: string, excerpt: ?string, url: string, hero_image: string, category_name: string} $article
     */
    private static function renderDigestCard(array $article): string
    {
        $url = htmlspecialchars($article['url'], ENT_QUOTES, 'UTF-8');
        $title = htmlspecialchars($article['title'], ENT_QUOTES, 'UTF-8');
        $excerpt = htmlspecialchars((string) ($article['excerpt'] ?? ''), ENT_QUOTES, 'UTF-8');
        $image = htmlspecialchars($article['hero_image'], ENT_QUOTES, 'UTF-8');
        $category = htmlspecialchars($article['category_name'], ENT_QUOTES, 'UTF-8');
        $excerptHtml = $excerpt !== ''
            ? '<p style="margin:0;font-size:13px;line-height:1.55;color:#64748b;">' . $excerpt . '</p>'
            : '';

        return <<<HTML
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
          <tr>
            <td>
              <a href="{$url}" style="display:block;text-decoration:none;">
                <img src="{$image}" width="100%" alt="" style="display:block;width:100%;height:150px;object-fit:cover;border-radius:9px 9px 0 0;">
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.06em;color:#c2410c;text-transform:uppercase;">{$category}</p>
              <a href="{$url}" style="display:block;margin:0 0 6px;font-size:16px;line-height:1.35;font-weight:800;color:#0f172a;text-decoration:none;">{$title}</a>
              {$excerptHtml}
              <a href="{$url}" style="display:inline-block;margin-top:12px;font-size:13px;font-weight:700;color:#c2410c;text-decoration:none;">Lire l&rsquo;article &rarr;</a>
            </td>
          </tr>
        </table>
        HTML;
    }

    /**
     * The "featured" card style: image beside the text in a single
     * full-width row instead of stacked above it, for the articles put
     * forward at the top of a digest. Stacks to image-on-top on narrow
     * screens via the same `.lqa-col`/`.lqa-gap` classes the vertical grid
     * uses.
     *
     * @param array{title: string, excerpt: ?string, url: string, hero_image: string, category_name: string} $article
     */
    private static function renderDigestHorizontalCard(array $article): string
    {
        $url = htmlspecialchars($article['url'], ENT_QUOTES, 'UTF-8');
        $title = htmlspecialchars($article['title'], ENT_QUOTES, 'UTF-8');
        $excerpt = htmlspecialchars((string) ($article['excerpt'] ?? ''), ENT_QUOTES, 'UTF-8');
        $image = htmlspecialchars($article['hero_image'], ENT_QUOTES, 'UTF-8');
        $category = htmlspecialchars($article['category_name'], ENT_QUOTES, 'UTF-8');
        $excerptHtml = $excerpt !== ''
            ? '<p style="margin:0;font-size:13px;line-height:1.55;color:#64748b;">' . $excerpt . '</p>'
            : '';

        return <<<HTML
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;">
          <tr>
            <td class="lqa-h-img" width="160" valign="top" style="padding:0;">
              <a href="{$url}" style="display:block;text-decoration:none;">
                <img src="{$image}" width="160" alt="" style="display:block;width:160px;height:120px;object-fit:cover;border-radius:10px 0 0 10px;">
              </a>
            </td>
            <td class="lqa-h-text" valign="top" style="padding:14px 16px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.06em;color:#c2410c;text-transform:uppercase;">{$category}</p>
              <a href="{$url}" style="display:block;margin:0 0 6px;font-size:17px;line-height:1.35;font-weight:800;color:#0f172a;text-decoration:none;">{$title}</a>
              {$excerptHtml}
              <a href="{$url}" style="display:inline-block;margin-top:10px;font-size:13px;font-weight:700;color:#c2410c;text-decoration:none;">Lire l&rsquo;article &rarr;</a>
            </td>
          </tr>
        </table>
        HTML;
    }

    /**
     * Renders a branded HTML email shell around a heading, a list of
     * paragraphs (raw HTML allowed for inline emphasis), an optional
     * call-to-action button, and an optional smaller footnote.
     *
     * @param string[] $paragraphs
     * @param array{label: string, url: string}|null $button
     */
    public static function render(
        string $preheader,
        string $heading,
        array $paragraphs,
        ?array $button = null,
        ?string $footnote = null,
    ): string {
        $appName = htmlspecialchars($_ENV['APP_NAME'] ?? 'Le Quotidien Actu', ENT_QUOTES, 'UTF-8');
        $logoUrl = htmlspecialchars(Config::url('/assets/logo-header.png'), ENT_QUOTES, 'UTF-8');
        $preheaderSafe = htmlspecialchars($preheader, ENT_QUOTES, 'UTF-8');
        $headingSafe = htmlspecialchars($heading, ENT_QUOTES, 'UTF-8');
        $year = date('Y');

        $paragraphsHtml = '';
        foreach ($paragraphs as $paragraph) {
            $paragraphsHtml .= '<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">'
                . $paragraph . '</p>';
        }

        $buttonHtml = '';
        if ($button !== null) {
            $url = htmlspecialchars($button['url'], ENT_QUOTES, 'UTF-8');
            $label = htmlspecialchars($button['label'], ENT_QUOTES, 'UTF-8');
            $buttonHtml = <<<HTML
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="border-radius:8px;background:#c2410c;">
                  <a href="{$url}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">{$label}</a>
                </td>
              </tr>
            </table>
            HTML;
        }

        $footnoteHtml = $footnote !== null
            ? '<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#94a3b8;">' . $footnote . '</p>'
            : '';

        return <<<HTML
        <!doctype html>
        <html lang="fr">
        <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>{$appName}</title>
        </head>
        <body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <span style="display:none;max-height:0;overflow:hidden;opacity:0;">{$preheaderSafe}</span>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 24px;text-align:center;">
                    <img src="{$logoUrl}" alt="{$appName}" height="40" style="height:40px;width:auto;">
                  </td>
                </tr>
                <tr>
                  <td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
                    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;color:#0f172a;">{$headingSafe}</h1>
                    {$paragraphsHtml}
                    {$buttonHtml}
                    {$footnoteHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 8px 0;text-align:center;">
                    <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; {$year} {$appName}. Tous droits réservés.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        </body>
        </html>
        HTML;
    }
}
