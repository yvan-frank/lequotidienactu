<?php
declare(strict_types=1);

namespace App\Support;

final class MailTemplate
{
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
