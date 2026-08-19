<?php
declare(strict_types=1);

/**
 * Dumps the MySQL database and archives public/uploads into backups/,
 * both gzip-compressed and timestamped, then prunes anything older than
 * BACKUP_RETENTION_DAYS (default 14). Meant to run daily via cron:
 *
 *   0 3 * * * php /path/to/app/database/backup.php >> /path/to/app/storage/logs/backup.log 2>&1
 *
 * Uses proc_open with an argument array (never a shell string) so nothing
 * here is vulnerable to shell injection, and passes the DB password via
 * the MYSQL_PWD environment variable instead of a CLI flag so it never
 * shows up in `ps`/process listings.
 */

$root = dirname(__DIR__);
$envFile = $root . '/.env';
$env = is_file($envFile) ? (parse_ini_file($envFile, false, INI_SCANNER_RAW) ?: []) : [];

$dbHost = $env['DB_HOST'] ?? '127.0.0.1';
$dbPort = (string) ($env['DB_PORT'] ?? '3306');
$dbName = $env['DB_DATABASE'] ?? '';
$dbUser = $env['DB_USERNAME'] ?? 'root';
$dbPass = $env['DB_PASSWORD'] ?? '';
$retentionDays = (int) ($env['BACKUP_RETENTION_DAYS'] ?? 14);
$uploadsDir = $root . '/public/uploads';

if ($dbName === '') {
    fwrite(STDERR, "DB_DATABASE manquant dans .env — impossible de sauvegarder.\n");
    exit(1);
}

$backupDir = $root . '/backups';
if (!is_dir($backupDir) && !mkdir($backupDir, 0770, true) && !is_dir($backupDir)) {
    fwrite(STDERR, "Impossible de créer {$backupDir}.\n");
    exit(1);
}

$timestamp = date('Y-m-d_His');

function findBinary(string $name): ?string
{
    $command = stripos(PHP_OS, 'WIN') === 0 ? "where {$name}" : "command -v {$name}";
    $output = trim((string) shell_exec($command));
    if ($output === '') {
        return null;
    }
    return trim(strtok($output, "\r\n"));
}

// --- 1) Database dump ---
$mysqldump = findBinary('mysqldump');
if ($mysqldump === null) {
    fwrite(STDERR, "mysqldump introuvable dans le PATH.\n");
    exit(1);
}

$dumpArgs = [
    $mysqldump,
    '--host=' . $dbHost,
    '--port=' . $dbPort,
    '--user=' . $dbUser,
    '--single-transaction',
    '--quick',
    '--routines',
    '--triggers',
    $dbName,
];
$processEnv = $dbPass !== '' ? array_merge($_ENV, ['MYSQL_PWD' => $dbPass]) : null;
$descriptors = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];
$process = proc_open($dumpArgs, $descriptors, $pipes, null, $processEnv);
if (!is_resource($process)) {
    fwrite(STDERR, "Impossible de lancer mysqldump.\n");
    exit(1);
}
$dump = stream_get_contents($pipes[1]);
$dumpError = stream_get_contents($pipes[2]);
fclose($pipes[1]);
fclose($pipes[2]);
$exitCode = proc_close($process);
if ($exitCode !== 0 || $dump === false || $dump === '') {
    fwrite(STDERR, "Échec de mysqldump (code {$exitCode}) : {$dumpError}\n");
    exit(1);
}

$sqlFile = $backupDir . "/db-{$timestamp}.sql.gz";
file_put_contents($sqlFile, gzencode($dump, 9));
echo "Base de données sauvegardée : {$sqlFile} (" . formatBytes((int) filesize($sqlFile)) . ")\n";

// --- 2) Media archive ---
if (is_dir($uploadsDir) && (new FilesystemIterator($uploadsDir))->valid()) {
    $tarPath = $backupDir . "/uploads-{$timestamp}.tar";
    if (is_file($tarPath)) {
        unlink($tarPath);
    }
    $archive = new PharData($tarPath);
    $archive->buildFromDirectory($uploadsDir);
    $gzPath = $tarPath . '.gz';
    if (is_file($gzPath)) {
        unlink($gzPath);
    }
    $archive->compress(Phar::GZ);
    unset($archive);
    unlink($tarPath);
    echo "Médias sauvegardés : {$gzPath} (" . formatBytes((int) filesize($gzPath)) . ")\n";
} else {
    echo "Aucun média à sauvegarder (public/uploads vide ou absent).\n";
}

// --- 3) Prune old backups ---
$cutoff = time() - $retentionDays * 86400;
$pruned = 0;
foreach (glob($backupDir . '/{db,uploads}-*.{sql.gz,tar.gz}', GLOB_BRACE) as $file) {
    if (filemtime($file) < $cutoff) {
        unlink($file);
        $pruned++;
    }
}
if ($pruned > 0) {
    echo "{$pruned} ancienne(s) sauvegarde(s) supprimée(s) (> {$retentionDays} jours).\n";
}

function formatBytes(int $bytes): string
{
    $units = ['o', 'Ko', 'Mo', 'Go'];
    $i = 0;
    $value = (float) $bytes;
    while ($value >= 1024 && $i < count($units) - 1) {
        $value /= 1024;
        $i++;
    }
    return round($value, 1) . ' ' . $units[$i];
}
