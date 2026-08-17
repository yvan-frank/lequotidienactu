<?php
declare(strict_types=1);

namespace App\Support;

final class Config
{
    public static function baseUrl(): string
    {
        return rtrim($_ENV['APP_URL'] ?? 'http://localhost:8000', '/');
    }

    public static function url(string $path = '/'): string
    {
        return self::baseUrl() . '/' . ltrim($path, '/');
    }
}
