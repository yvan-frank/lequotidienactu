<?php
declare(strict_types=1);

namespace App\Support;

use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use PDO;
use PDOException;

/**
 * Sends Web Push notifications to browsers subscribed via /api/push/subscribe.
 * A subscription's `categories` column is a JSON array of category slugs the
 * reader opted into, or NULL to mean "every category". Failed/expired
 * subscriptions (410 Gone, 404) are pruned as they're encountered — readers
 * who uninstalled the browser or revoked permission stop being billed
 * against send batches without any manual cleanup.
 */
final class Push
{
    /**
     * Notifies every subscription opted into (or unrestricted for) the
     * given category. Called right after an article transitions into
     * "published", never on ordinary edits of an already-published one.
     */
    public static function notifyCategory(string $categorySlug, array $payload): void
    {
        try {
            $pdo = self::pdo();
            $rows = $pdo->query('SELECT id, endpoint, p256dh, auth_token, categories FROM push_subscriptions')->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException) {
            return;
        }

        $targets = array_filter($rows, static function (array $row) use ($categorySlug): bool {
            if ($row['categories'] === null) {
                return true;
            }
            $categories = json_decode((string) $row['categories'], true);
            return is_array($categories) && in_array($categorySlug, $categories, true);
        });

        if ($targets === []) {
            return;
        }

        self::send($targets, $payload);
    }

    /**
     * @param array<int, array{id: int, endpoint: string, p256dh: string, auth_token: string}> $subscriptions
     */
    private static function send(array $subscriptions, array $payload): void
    {
        $publicKey = $_ENV['VAPID_PUBLIC_KEY'] ?? '';
        $privateKey = $_ENV['VAPID_PRIVATE_KEY'] ?? '';
        if ($publicKey === '' || $privateKey === '') {
            return;
        }

        try {
            $webPush = new WebPush([
                'VAPID' => [
                    'subject' => $_ENV['VAPID_SUBJECT'] ?? ('mailto:' . ($_ENV['CONTACT_EMAIL'] ?? 'contact@example.com')),
                    'publicKey' => $publicKey,
                    'privateKey' => $privateKey,
                ],
            ]);
        } catch (\Throwable) {
            return;
        }

        $byId = [];
        foreach ($subscriptions as $row) {
            $byId[$row['endpoint']] = (int) $row['id'];
            $webPush->queueNotification(
                Subscription::create([
                    'endpoint' => $row['endpoint'],
                    'publicKey' => $row['p256dh'],
                    'authToken' => $row['auth_token'],
                ]),
                json_encode($payload, JSON_UNESCAPED_UNICODE)
            );
        }

        $expiredIds = [];
        foreach ($webPush->flush() as $report) {
            if ($report->isSuccess()) {
                continue;
            }
            $endpoint = $report->getRequest()->getUri()->__toString();
            if (in_array($report->getResponse()?->getStatusCode(), [404, 410], true) && isset($byId[$endpoint])) {
                $expiredIds[] = $byId[$endpoint];
            }
        }

        if ($expiredIds !== []) {
            self::pruneSubscriptions($expiredIds);
        }
    }

    private static function pruneSubscriptions(array $ids): void
    {
        try {
            $pdo = self::pdo();
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $pdo->prepare("DELETE FROM push_subscriptions WHERE id IN ($placeholders)")->execute($ids);
        } catch (PDOException) {
            // A subscription that lingers a bit longer than it should isn't worth failing anything over.
        }
    }

    private static function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }
}
