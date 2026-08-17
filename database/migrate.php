<?php
declare(strict_types=1);
$env = is_file(__DIR__ . '/../.env') ? parse_ini_file(__DIR__ . '/../.env') : [];
$dsn = sprintf('mysql:host=%s;port=%s;charset=utf8mb4', $env['DB_HOST'] ?? '127.0.0.1', $env['DB_PORT'] ?? '3306');
$pdo = new PDO($dsn, $env['DB_USERNAME'] ?? 'root', $env['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '``', $env['DB_DATABASE'] ?? 'lequotidienactu') . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$pdo->exec('USE `' . str_replace('`', '``', $env['DB_DATABASE'] ?? 'lequotidienactu') . '`');
$pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (migration VARCHAR(190) PRIMARY KEY, applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)');

$applied = $pdo->query('SELECT migration FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN);
$applied = array_flip($applied);

$markApplied = $pdo->prepare('INSERT INTO schema_migrations (migration) VALUES (:migration)');
foreach (glob(__DIR__ . '/migrations/*.sql') as $migration) {
    $name = basename($migration);
    if (isset($applied[$name])) {
        continue;
    }
    $pdo->exec(file_get_contents($migration));
    $markApplied->execute(['migration' => $name]);
    echo 'Applied ' . $name . PHP_EOL;
}
