<?php
declare(strict_types=1);

namespace App\Seo;

use PDO;
use PDOException;

final class RedirectService
{
    public function destinationFor(string $path): ?array
    {
        try {
            $statement = $this->pdo()->prepare('SELECT destination_url, status_code FROM redirects WHERE source_path = :path LIMIT 1');
            $statement->execute(['path' => $path]);
            $redirect = $statement->fetch(PDO::FETCH_ASSOC);

            return $redirect ?: null;
        } catch (PDOException) {
            return null;
        }
    }

    /**
     * Records that $old now redirects to $new, keeping the redirect graph
     * clean: no chains (A -> B -> C becomes A -> C and B -> C), no loops,
     * and no redirect left shadowing a URL that is now live content.
     */
    public function record(string $old, string $new): void
    {
        $old = $this->normalize($old);
        $new = $this->normalize($new);
        if ($old === $new || $old === '' || $new === '') {
            return;
        }

        try {
            $pdo = $this->pdo();
            $finalDestination = $this->resolveFinalDestination($pdo, $new);

            // Collapse chains: anything that used to point at $old now points straight to the final destination.
            $repoint = $pdo->prepare('UPDATE redirects SET destination_url = :destination WHERE destination_url = :old');
            $repoint->execute(['destination' => $finalDestination, 'old' => $old]);

            // The old path becomes a fresh redirect to the resolved destination.
            $upsert = $pdo->prepare('INSERT INTO redirects (source_path, destination_url, status_code) VALUES (:source, :destination, 301) ON DUPLICATE KEY UPDATE destination_url = VALUES(destination_url), status_code = 301');
            $upsert->execute(['source' => $old, 'destination' => $finalDestination]);

            // The new path is live content now; it can no longer also be a redirect source.
            $this->reclaimWith($pdo, $finalDestination);
        } catch (PDOException) {
            // Best-effort: a missing redirects table or DB hiccup should never block a save.
        }
    }

    /**
     * Deletes any redirect that would shadow $path, so freshly (re)published
     * content is always reachable even if an older redirect used to occupy that URL.
     */
    public function reclaim(string $path): void
    {
        try {
            $this->reclaimWith($this->pdo(), $this->normalize($path));
        } catch (PDOException) {
        }
    }

    private function reclaimWith(PDO $pdo, string $path): void
    {
        if ($path === '') {
            return;
        }
        $statement = $pdo->prepare('DELETE FROM redirects WHERE source_path = :path');
        $statement->execute(['path' => $path]);
    }

    private function resolveFinalDestination(PDO $pdo, string $path, int $depth = 0): string
    {
        if ($depth > 10) {
            return $path;
        }
        $statement = $pdo->prepare('SELECT destination_url FROM redirects WHERE source_path = :path LIMIT 1');
        $statement->execute(['path' => $path]);
        $next = $statement->fetchColumn();
        if ($next === false || $next === $path) {
            return $path;
        }

        return $this->resolveFinalDestination($pdo, (string) $next, $depth + 1);
    }

    private function normalize(string $path): string
    {
        $path = '/' . ltrim($path, '/');
        return rtrim($path, '/') ?: '/';
    }

    private function pdo(): PDO
    {
        $database = $_ENV['DB_DATABASE'] ?? '';
        if ($database === '') {
            throw new PDOException('Base de données non configurée.');
        }
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $_ENV['DB_HOST'] ?? '127.0.0.1',
            $_ENV['DB_PORT'] ?? '3306',
            $database,
        );

        return new PDO($dsn, $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }
}
