<?php
declare(strict_types=1);

use App\Http\Router;

$envFile = __DIR__ . '/.env';
if (is_file($envFile)) {
    foreach (parse_ini_file($envFile, false, INI_SCANNER_RAW) ?: [] as $key => $value) {
        $_ENV[$key] = $value;
    }
}

require __DIR__ . '/vendor/autoload.php';

(new Router())->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $_SERVER['REQUEST_URI'] ?? '/');
