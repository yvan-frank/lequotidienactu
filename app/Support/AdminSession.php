<?php
declare(strict_types=1);

namespace App\Support;

/**
 * Peeks at the admin session (cookie name `lqa_admin`, set by
 * AdminAuthController) from public-site code, without disturbing whatever
 * session is already active for the current request — the reader session
 * (`lqa_reader`, article.php's premium-status check) uses a different
 * cookie name, and PHP only keeps one named session live in $_SESSION at a
 * time. If one is already open, this closes it, opens the admin session
 * just long enough to read `admin_user`, then reopens the original.
 */
final class AdminSession
{
    private const COOKIE_NAME = 'lqa_admin';

    /** @return array{id: int, name: string, email: string, role: string}|null */
    public static function current(): ?array
    {
        if (!isset($_COOKIE[self::COOKIE_NAME])) {
            return null;
        }

        $activeName = session_status() === PHP_SESSION_ACTIVE ? session_name() : null;
        if ($activeName === self::COOKIE_NAME) {
            return $_SESSION['admin_user'] ?? null;
        }

        // session_id() is a single global value that otherwise carries over
        // between session_start() calls under a different session_name() —
        // without pinning it explicitly to each cookie's own value here,
        // the second session_start() below silently reopens whichever
        // session was already active instead of the admin one.
        $activeId = $activeName !== null ? session_id() : null;
        if ($activeName !== null) {
            session_write_close();
        }

        session_name(self::COOKIE_NAME);
        session_id($_COOKIE[self::COOKIE_NAME]);
        session_start();
        $adminUser = $_SESSION['admin_user'] ?? null;
        session_write_close();

        if ($activeName !== null && $activeId !== null && $activeId !== '') {
            session_name($activeName);
            session_id($activeId);
            session_start();
        }

        return $adminUser;
    }
}
