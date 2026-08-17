<?php
declare(strict_types=1);

namespace App\Support;

use PDO;
use PDOException;

final class Settings
{
    /** @var array<string, array> */
    private static array $cache = [];

    public static function get(string $key, array $default = []): array
    {
        if (array_key_exists($key, self::$cache)) {
            return self::$cache[$key];
        }

        try {
            $statement = self::pdo()->prepare('SELECT `value` FROM settings WHERE `key` = :key');
            $statement->execute(['key' => $key]);
            $raw = $statement->fetchColumn();
            $result = $raw !== false ? ((json_decode((string) $raw, true) ?: []) + $default) : $default;
        } catch (PDOException) {
            $result = $default;
        }

        return self::$cache[$key] = $result;
    }

    public static function set(string $key, array $value): void
    {
        $statement = self::pdo()->prepare('INSERT INTO settings (`key`, `value`) VALUES (:key, :value) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)');
        $statement->execute(['key' => $key, 'value' => json_encode($value, JSON_THROW_ON_ERROR)]);
        self::$cache[$key] = $value;
    }

    private static function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }
}
