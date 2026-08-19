<?php
declare(strict_types=1);

namespace App\Support;

/**
 * Structured, file-based application log — one JSON object per line,
 * rotated daily (storage/logs/app-YYYY-MM-DD.log). Never throws: a logging
 * failure (disk full, permissions) must not break the request that
 * triggered it, so every write is best-effort.
 */
final class Logger
{
    public static function info(string $message, array $context = []): void
    {
        self::write('info', $message, $context);
    }

    public static function warning(string $message, array $context = []): void
    {
        self::write('warning', $message, $context);
    }

    public static function error(string $message, array $context = []): void
    {
        self::write('error', $message, $context);
    }

    private static function write(string $level, string $message, array $context): void
    {
        try {
            $directory = dirname(__DIR__, 2) . '/storage/logs';
            if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
                return;
            }
            $line = json_encode([
                'ts' => date(DATE_ATOM),
                'level' => $level,
                'message' => $message,
                'context' => $context,
                'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
                'uri' => $_SERVER['REQUEST_URI'] ?? null,
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($line === false) {
                return;
            }
            $file = $directory . '/app-' . date('Y-m-d') . '.log';
            file_put_contents($file, $line . PHP_EOL, FILE_APPEND | LOCK_EX);
        } catch (\Throwable) {
            // Logging must never be the reason a request fails.
        }
    }
}
