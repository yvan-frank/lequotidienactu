<?php
declare(strict_types=1);

/**
 * Restores a database dump (and optionally the media archive) produced by
 * database/backup.php.
 *
 * Usage:
 *   php database/restore.php <timestamp|latest> [--target-db=name] [--skip-media] [--yes]
 *
 * --target-db=name   Restore into a different database instead of the one
 *                     configured in .env — the safe way to test a backup
 *                     without touching production data. The database is
 *                     created if it doesn't exist.
 * --target-uploads-dir=path
 *                     Extract media into this directory instead of
 *                     public/uploads — pairs with --target-db to keep a
 *                     test restore fully isolated from live data.
 * --skip-media       Don't extract the uploads archive.
 * --yes              Skip the confirmation prompt (required when restoring
 *                     over the configured database, which overwrites it).
 */

$root = dirname(__DIR__);
$envFile = $root . '/.env';
$env = is_file($envFile) ? (parse_ini_file($envFile, false, INI_SCANNER_RAW) ?: []) : [];

$args = array_slice($argv, 1);
$positional = array_values(array_filter($args, static fn (string $a): bool => !str_starts_with($a, '--')));
$flags = array_filter($args, static fn (string $a): bool => str_starts_with($a, '--'));

$selector = $positional[0] ?? null;
if ($selector === null) {
    fwrite(STDERR, "Usage : php database/restore.php <timestamp|latest> [--target-db=name] [--skip-media] [--yes]\n");
    exit(1);
}

$targetDb = null;
$targetUploadsDir = null;
$skipMedia = false;
$assumeYes = false;
foreach ($flags as $flag) {
    if (str_starts_with($flag, '--target-db=')) {
        $targetDb = substr($flag, strlen('--target-db='));
    } elseif (str_starts_with($flag, '--target-uploads-dir=')) {
        $targetUploadsDir = substr($flag, strlen('--target-uploads-dir='));
    } elseif ($flag === '--skip-media') {
        $skipMedia = true;
    } elseif ($flag === '--yes') {
        $assumeYes = true;
    }
}

$dbHost = $env['DB_HOST'] ?? '127.0.0.1';
$dbPort = (string) ($env['DB_PORT'] ?? '3306');
$dbName = $targetDb ?? ($env['DB_DATABASE'] ?? '');
$dbUser = $env['DB_USERNAME'] ?? 'root';
$dbPass = $env['DB_PASSWORD'] ?? '';
$uploadsDir = $targetUploadsDir ?? ($root . '/public/uploads');
$backupDir = $root . '/backups';

if ($dbName === '') {
    fwrite(STDERR, "Aucune base cible : configurez DB_DATABASE dans .env ou passez --target-db=.\n");
    exit(1);
}

function findBinary(string $name): ?string
{
    $command = stripos(PHP_OS, 'WIN') === 0 ? "where {$name}" : "command -v {$name}";
    $output = trim((string) shell_exec($command));
    if ($output === '') {
        return null;
    }
    return trim(strtok($output, "\r\n"));
}

// --- Resolve which backup to use ---
if ($selector === 'latest') {
    $sqlCandidates = glob($backupDir . '/db-*.sql.gz');
    if ($sqlCandidates === false || $sqlCandidates === []) {
        fwrite(STDERR, "Aucune sauvegarde trouvée dans {$backupDir}.\n");
        exit(1);
    }
    rsort($sqlCandidates);
    $sqlFile = $sqlCandidates[0];
    $timestamp = str_replace(['db-', '.sql.gz'], '', basename($sqlFile));
} else {
    $timestamp = $selector;
    $sqlFile = $backupDir . "/db-{$timestamp}.sql.gz";
}

if (!is_file($sqlFile)) {
    fwrite(STDERR, "Fichier introuvable : {$sqlFile}\n");
    exit(1);
}
$mediaFile = $backupDir . "/uploads-{$timestamp}.tar.gz";

echo "Restauration de {$sqlFile} vers la base « {$dbName} » sur {$dbHost}:{$dbPort}.\n";
if (!$skipMedia && is_file($mediaFile)) {
    echo "Les médias seront restaurés depuis {$mediaFile} vers {$uploadsDir}.\n";
}
if (!$assumeYes) {
    echo "Ceci écrase le contenu actuel de la base « {$dbName} ». Continuer ? [o/N] ";
    $answer = trim((string) fgets(STDIN));
    if (strtolower($answer) !== 'o' && strtolower($answer) !== 'y') {
        echo "Annulé.\n";
        exit(0);
    }
}

$mysql = findBinary('mysql');
if ($mysql === null) {
    fwrite(STDERR, "mysql introuvable dans le PATH.\n");
    exit(1);
}

// --- Create the target database if it doesn't exist yet (only relevant for --target-db) ---
$createArgs = [$mysql, '--host=' . $dbHost, '--port=' . $dbPort, '--user=' . $dbUser, '-e', 'CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '``', $dbName) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'];
$processEnv = $dbPass !== '' ? array_merge($_ENV, ['MYSQL_PWD' => $dbPass]) : null;
$createProcess = proc_open($createArgs, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $createPipes, null, $processEnv);
if (is_resource($createProcess)) {
    fclose($createPipes[1]);
    $createError = stream_get_contents($createPipes[2]);
    fclose($createPipes[2]);
    $createExit = proc_close($createProcess);
    if ($createExit !== 0) {
        fwrite(STDERR, "Échec de la création de la base : {$createError}\n");
        exit(1);
    }
}

// --- Restore the SQL dump ---
$dump = gzdecode((string) file_get_contents($sqlFile));
if ($dump === false) {
    fwrite(STDERR, "Impossible de décompresser {$sqlFile}.\n");
    exit(1);
}

$restoreArgs = [$mysql, '--host=' . $dbHost, '--port=' . $dbPort, '--user=' . $dbUser, $dbName];
$descriptors = [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$process = proc_open($restoreArgs, $descriptors, $pipes, null, $processEnv);
if (!is_resource($process)) {
    fwrite(STDERR, "Impossible de lancer mysql.\n");
    exit(1);
}
fwrite($pipes[0], $dump);
fclose($pipes[0]);
$restoreOutput = stream_get_contents($pipes[1]);
$restoreError = stream_get_contents($pipes[2]);
fclose($pipes[1]);
fclose($pipes[2]);
$exitCode = proc_close($process);
if ($exitCode !== 0) {
    fwrite(STDERR, "Échec de la restauration (code {$exitCode}) : {$restoreError}\n");
    exit(1);
}
echo "Base de données restaurée avec succès dans « {$dbName} ».\n";

// --- Restore media ---
if (!$skipMedia && is_file($mediaFile)) {
    if (!is_dir($uploadsDir) && !mkdir($uploadsDir, 0775, true) && !is_dir($uploadsDir)) {
        fwrite(STDERR, "Impossible de créer {$uploadsDir}.\n");
        exit(1);
    }
    $archive = new PharData($mediaFile);
    $archive->extractTo($uploadsDir, null, true);
    echo "Médias restaurés dans {$uploadsDir}.\n";
}

echo "Restauration terminée.\n";
