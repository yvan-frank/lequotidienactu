<?php
declare(strict_types=1);

namespace App\Support;

use PDO;
use PDOException;

final class Ads
{
    public static function renderSlot(string $code, string $placeholderLabel = 'Publicité'): string
    {
        try {
            $statement = self::pdo()->prepare(
                'SELECT a.id, a.content_html FROM advertisements a
                 INNER JOIN ad_slots s ON s.id = a.ad_slot_id
                 WHERE s.code = :code
                   AND (a.starts_at IS NULL OR a.starts_at <= NOW())
                   AND (a.ends_at IS NULL OR a.ends_at >= NOW())
                 ORDER BY RAND() LIMIT 1'
            );
            $statement->execute(['code' => $code]);
            $ad = $statement->fetch(PDO::FETCH_ASSOC);
        } catch (PDOException) {
            $ad = false;
        }

        if (!$ad) {
            return '<aside class="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-100 text-xs font-bold tracking-[0.2em] text-slate-500 uppercase" aria-label="Publicité">'
                . htmlspecialchars($placeholderLabel) . '</aside>';
        }

        try {
            self::pdo()->prepare('UPDATE advertisements SET impressions = impressions + 1 WHERE id = :id')
                ->execute(['id' => $ad['id']]);
        } catch (PDOException) {
            // A missed impression count is not worth failing the page render for.
        }

        return '<div class="ad-slot" data-ad-id="' . (int) $ad['id'] . '">' . $ad['content_html'] . '</div>';
    }

    private static function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }
}
