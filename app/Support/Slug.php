<?php
declare(strict_types=1);

namespace App\Support;

final class Slug
{
    private const TRANSLIT_MAP = [
        'à' => 'a', 'â' => 'a', 'ä' => 'a', 'á' => 'a', 'ã' => 'a', 'å' => 'a',
        'ç' => 'c',
        'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e',
        'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i',
        'ñ' => 'n',
        'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'ö' => 'o', 'õ' => 'o',
        'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u',
        'ý' => 'y', 'ÿ' => 'y',
        'œ' => 'oe', 'æ' => 'ae',
        'ß' => 'ss',
    ];

    /**
     * Builds a URL-safe slug from a title/name. Uses a manual transliteration
     * map instead of iconv('...//TRANSLIT') because that behaves differently
     * across platforms/locales (it can insert stray apostrophes for accented
     * letters, e.g. "é" -> "e'"), which corrupted slugs like "Sénégal".
     */
    public static function make(string $value): string
    {
        $value = mb_strtolower($value, 'UTF-8');
        $value = strtr($value, self::TRANSLIT_MAP);
        $value = (string) preg_replace('/[^a-z0-9]+/', '-', $value);
        return trim($value, '-');
    }
}
