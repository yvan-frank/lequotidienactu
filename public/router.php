<?php
declare(strict_types=1);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$adminAssetPrefix = '/u/admin/assets/';
if (str_starts_with($path, $adminAssetPrefix)) {
    $asset = __DIR__ . '/admin/assets/' . substr($path, strlen($adminAssetPrefix));
    if (is_file($asset)) {
        $extension = strtolower(pathinfo($asset, PATHINFO_EXTENSION));
        $types = ['css' => 'text/css', 'js' => 'text/javascript', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'webp' => 'image/webp', 'woff2' => 'font/woff2'];
        header('Content-Type: ' . ($types[$extension] ?? mime_content_type($asset) ?: 'application/octet-stream'));
        readfile($asset);
        exit;
    }
}

$file = __DIR__ . $path;
if ($path !== '/' && is_file($file)) {
    return false;
}

require dirname(__DIR__) . '/bootstrap.php';
