<?php
declare(strict_types=1);

namespace App\Support;

use PDO;

/**
 * Journal of admin actions — who did what, on which record, when. Reads
 * the acting user from $_SESSION['admin_user'] (set at login) so call
 * sites only need to name the action. Never throws: a failed audit write
 * must not block the action it's describing.
 */
final class AuditLog
{
    /**
     * @param array<string, mixed> $details
     */
    public static function record(string $action, ?string $entityType = null, ?int $entityId = null, array $details = []): void
    {
        try {
            $user = $_SESSION['admin_user'] ?? null;
            $statement = self::pdo()->prepare(
                'INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, ip_address)
                 VALUES (:user_id, :user_name, :action, :entity_type, :entity_id, :details, :ip_address)'
            );
            $statement->execute([
                'user_id' => $user['id'] ?? null,
                'user_name' => $user['name'] ?? null,
                'action' => $action,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'details' => $details === [] ? null : json_encode($details, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            ]);
        } catch (\Throwable $e) {
            Logger::error('AuditLog write failed', ['action' => $action, 'error' => $e->getMessage()]);
        }
    }

    private static function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }
}
