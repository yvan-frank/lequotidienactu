<?php
declare(strict_types=1);

namespace App\Support;

use PDO;
use PDOException;

final class RateLimiter
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    /**
     * Records an attempt and reports whether the caller has exceeded the
     * allowed number of attempts for this bucket within the time window.
     * Fails open (never blocks) if the rate_limits table is unavailable,
     * so a missing migration never takes the site down.
     */
    public function tooManyAttempts(string $bucket, int $maxAttempts, int $windowSeconds): bool
    {
        $ip = $this->clientIp();
        try {
            $cutoff = date('Y-m-d H:i:s', time() - $windowSeconds);
            $prune = $this->pdo->prepare('DELETE FROM rate_limits WHERE bucket = :bucket AND ip_address = :ip AND created_at < :cutoff');
            $prune->execute(['bucket' => $bucket, 'ip' => $ip, 'cutoff' => $cutoff]);

            $count = $this->pdo->prepare('SELECT COUNT(*) FROM rate_limits WHERE bucket = :bucket AND ip_address = :ip');
            $count->execute(['bucket' => $bucket, 'ip' => $ip]);
            if ((int) $count->fetchColumn() >= $maxAttempts) {
                return true;
            }

            $hit = $this->pdo->prepare('INSERT INTO rate_limits (bucket, ip_address) VALUES (:bucket, :ip)');
            $hit->execute(['bucket' => $bucket, 'ip' => $ip]);
            return false;
        } catch (PDOException) {
            return false;
        }
    }

    private function clientIp(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    }
}
