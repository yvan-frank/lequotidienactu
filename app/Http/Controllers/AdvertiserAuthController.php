<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\RateLimiter;
use App\Support\RateLimits;
use PDO;
use PDOException;

/**
 * A view-only stats portal for advertisers — they never create or edit ad
 * creatives themselves (that stays staff-only in the admin), they just log
 * in to see how their own campaigns are performing. Accounts are created
 * by staff from the admin (AdminAdsController::createAdvertiser), not via
 * public self-registration, matching how paid advertising relationships
 * actually get set up.
 */
final class AdvertiserAuthController
{
    public function loginPage(): void
    {
        $title = 'Espace annonceurs - Le Quotidien Actu';
        $page = 'advertiser-login';
        $loginError = (string) ($_GET['erreur'] ?? '');
        require __DIR__ . '/../../Views/layout.php';
    }

    public function login(): void
    {
        $this->startSession();
        $email = filter_var(trim((string) ($_POST['email'] ?? '')), FILTER_VALIDATE_EMAIL);
        $password = (string) ($_POST['password'] ?? '');

        $redirectToError = static function (): void {
            header('Location: /annonceurs/connexion?erreur=1');
        };

        if (!$email || $password === '') {
            $redirectToError();
            return;
        }

        try {
            $pdo = $this->pdo();
            [$max, $window] = RateLimits::resolve('advertiser-login');
            if ((new RateLimiter($pdo))->tooManyAttempts('advertiser-login', $max, $window)) {
                $redirectToError();
                return;
            }

            $statement = $pdo->prepare('SELECT id, name, email, password_hash FROM advertisers WHERE email = :email LIMIT 1');
            $statement->execute(['email' => $email]);
            $advertiser = $statement->fetch(PDO::FETCH_ASSOC);

            if (!$advertiser || !password_verify($password, $advertiser['password_hash'])) {
                $redirectToError();
                return;
            }

            session_regenerate_id(true);
            $_SESSION['advertiser'] = ['id' => (int) $advertiser['id'], 'name' => $advertiser['name'], 'email' => $advertiser['email']];
            header('Location: /annonceurs/tableau-de-bord');
        } catch (PDOException) {
            $redirectToError();
        }
    }

    public function logout(): void
    {
        $this->startSession();
        $_SESSION = [];
        session_destroy();
        header('Location: /annonceurs/connexion');
    }

    public function dashboard(): void
    {
        $this->startSession();
        $advertiser = $_SESSION['advertiser'] ?? null;
        if (!$advertiser) {
            header('Location: /annonceurs/connexion');
            return;
        }

        $title = 'Tableau de bord annonceur - Le Quotidien Actu';
        $page = 'advertiser-dashboard';
        $campaigns = $this->campaignsFor((int) $advertiser['id']);
        require __DIR__ . '/../../Views/layout.php';
    }

    private function campaignsFor(int $advertiserId): array
    {
        try {
            $statement = $this->pdo()->prepare(
                'SELECT a.name, s.label AS slot_label, a.starts_at, a.ends_at, a.impressions, a.clicks
                 FROM advertisements a INNER JOIN ad_slots s ON s.id = a.ad_slot_id
                 WHERE a.advertiser_id = :advertiser_id
                 ORDER BY a.id DESC'
            );
            $statement->execute(['advertiser_id' => $advertiserId]);
            return $statement->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException) {
            return [];
        }
    }

    private function startSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_name('lqa_advertiser');
            session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
            session_start();
        }
    }

    private function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }
}
