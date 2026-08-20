<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\AuditLog;

/**
 * Read-only view onto the backups produced by database/backup.php
 * (cron-run, dumps the DB + archives public/uploads into /backups). This
 * controller never writes a backup itself — it only lists and streams the
 * files already on disk.
 */
final class AdminBackupController
{
    private const FILENAME_PATTERN = '/^(db|uploads)-(\d{4}-\d{2}-\d{2}_\d{6})\.(sql\.gz|tar\.gz)$/';

    public function index(): void
    {
        AdminAuthController::requireStaff(['admin']);
        $dir = self::backupDir();
        $files = is_dir($dir) ? glob($dir . '/{db,uploads}-*.{sql.gz,tar.gz}', GLOB_BRACE) : [];

        $groups = [];
        foreach ($files ?: [] as $path) {
            $name = basename($path);
            if (!preg_match(self::FILENAME_PATTERN, $name, $m)) {
                continue;
            }
            [, $type, $timestamp] = $m;
            $groups[$timestamp][$type] = [
                'filename' => $name,
                'bytes' => (int) filesize($path),
                'created_at' => date('Y-m-d H:i:s', (int) filemtime($path)),
            ];
        }
        krsort($groups);

        $data = [];
        foreach ($groups as $timestamp => $group) {
            $data[] = [
                'timestamp' => $timestamp,
                'database' => $group['db'] ?? null,
                'uploads' => $group['uploads'] ?? null,
            ];
        }

        $this->json(['data' => $data]);
    }

    public function download(string $filename): void
    {
        AdminAuthController::requireStaff(['admin']);

        if (!preg_match(self::FILENAME_PATTERN, $filename)) {
            $this->notFound();
            return;
        }

        $dir = self::backupDir();
        $realDir = realpath($dir);
        $realPath = realpath($dir . '/' . $filename);
        if ($realDir === false || $realPath === false || !str_starts_with($realPath, $realDir . DIRECTORY_SEPARATOR) || !is_file($realPath)) {
            $this->notFound();
            return;
        }

        AuditLog::record('backup.download', 'backup', null, ['filename' => $filename]);

        header('Content-Type: application/gzip');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . (string) filesize($realPath));
        header('X-Content-Type-Options: nosniff');
        readfile($realPath);
    }

    /**
     * Deletes both files of a backup pair (database dump + uploads archive)
     * sharing the same timestamp — a backup row in the admin table always
     * represents that pair, so there is no single-file delete.
     */
    public function delete(string $timestamp): void
    {
        AdminAuthController::requireStaff(['admin']);

        if (!preg_match('/^\d{4}-\d{2}-\d{2}_\d{6}$/', $timestamp)) {
            $this->notFound();
            return;
        }

        $dir = self::backupDir();
        $realDir = realpath($dir);
        if ($realDir === false) {
            $this->notFound();
            return;
        }

        $deleted = [];
        foreach (['db-' . $timestamp . '.sql.gz', 'uploads-' . $timestamp . '.tar.gz'] as $filename) {
            $realPath = realpath($dir . '/' . $filename);
            if ($realPath !== false && str_starts_with($realPath, $realDir . DIRECTORY_SEPARATOR) && is_file($realPath) && unlink($realPath)) {
                $deleted[] = $filename;
            }
        }

        if ($deleted === []) {
            $this->notFound();
            return;
        }

        AuditLog::record('backup.delete', 'backup', null, ['timestamp' => $timestamp, 'files' => $deleted]);
        $this->json(['message' => 'Sauvegarde supprimée.']);
    }

    private static function backupDir(): string
    {
        return dirname(__DIR__, 3) . '/backups';
    }

    private function notFound(): void
    {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['message' => 'Fichier de sauvegarde introuvable.']);
    }

    private function json(array $data): void
    {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_THROW_ON_ERROR);
    }
}
