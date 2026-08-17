<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Config;
use App\Support\Mailer;
use App\Support\RateLimiter;
use PDO;
use PDOException;

final class AdminAuthController
{
    private const STAFF_ROLES = ['admin', 'editor', 'author'];

    public function session(): void
    {
        $this->startSession();
        if (isset($_SESSION['admin_user'])) {
            $this->ensureCsrfToken();
        }
        $this->json([
            'authenticated' => isset($_SESSION['admin_user']),
            'user' => $_SESSION['admin_user'] ?? null,
            'csrf_token' => $_SESSION['csrf_token'] ?? null,
        ]);
    }

    public function login(): void
    {
        $this->startSession();
        $input = $this->input();
        $email = filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL);
        $password = (string) ($input['password'] ?? '');

        if (!$email || $password === '') {
            $this->json(['message' => 'Adresse e-mail et mot de passe requis.'], 422);
            return;
        }

        try {
            if ((new RateLimiter($this->pdo()))->tooManyAttempts('admin-login', 5, 900)) {
                $this->json(['message' => 'Trop de tentatives de connexion. Réessayez dans quelques minutes.'], 429);
                return;
            }

            $statement = $this->pdo()->prepare('SELECT id, name, email, password_hash, role FROM users WHERE email = :email LIMIT 1');
            $statement->execute(['email' => $email]);
            $user = $statement->fetch(PDO::FETCH_ASSOC);

            if (!$user || !password_verify($password, $user['password_hash']) || !in_array($user['role'], self::STAFF_ROLES, true)) {
                $this->json(['message' => 'Identifiants invalides ou accès non autorisé.'], 401);
                return;
            }

            session_regenerate_id(true);
            $_SESSION['admin_user'] = ['id' => (int) $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $user['role']];
            $this->ensureCsrfToken(true);
            $this->json(['user' => $_SESSION['admin_user'], 'csrf_token' => $_SESSION['csrf_token']]);
        } catch (PDOException) {
            $this->json(['message' => 'Base de données indisponible.'], 503);
        }
    }

    public function forgotPassword(): void
    {
        $this->startSession();
        $input = $this->input();
        $email = filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL);
        $generic = ['message' => 'Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d’être envoyé.'];

        if (!$email) {
            $this->json($generic);
            return;
        }

        try {
            $pdo = $this->pdo();
            if ((new RateLimiter($pdo))->tooManyAttempts('admin-forgot-password', 5, 900)) {
                $this->json(['message' => 'Trop de tentatives. Réessayez dans quelques minutes.'], 429);
                return;
            }

            $statement = $pdo->prepare('SELECT id, name, email, role FROM users WHERE email = :email LIMIT 1');
            $statement->execute(['email' => $email]);
            $user = $statement->fetch(PDO::FETCH_ASSOC);

            if ($user && in_array($user['role'], self::STAFF_ROLES, true)) {
                $token = bin2hex(random_bytes(32));
                $tokenHash = hash('sha256', $token);
                $expiresAt = date('Y-m-d H:i:s', time() + 3600);

                $pdo->prepare('DELETE FROM password_resets WHERE user_id = :user_id')->execute(['user_id' => $user['id']]);
                $pdo->prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, :expires_at)')
                    ->execute(['user_id' => $user['id'], 'token_hash' => $tokenHash, 'expires_at' => $expiresAt]);

                $this->sendResetEmail($user['email'], $user['name'], $token);
            }

            $this->json($generic);
        } catch (PDOException) {
            $this->json(['message' => 'Base de données indisponible.'], 503);
        }
    }

    public function resetPassword(): void
    {
        $this->startSession();
        $input = $this->input();
        $token = (string) ($input['token'] ?? '');
        $password = (string) ($input['password'] ?? '');

        if ($token === '' || mb_strlen($password) < 8) {
            $this->json(['message' => 'Le mot de passe doit contenir au moins 8 caractères.'], 422);
            return;
        }

        try {
            $pdo = $this->pdo();
            if ((new RateLimiter($pdo))->tooManyAttempts('admin-reset-password', 10, 900)) {
                $this->json(['message' => 'Trop de tentatives. Réessayez dans quelques minutes.'], 429);
                return;
            }

            $tokenHash = hash('sha256', $token);
            $statement = $pdo->prepare('SELECT id, user_id, expires_at FROM password_resets WHERE token_hash = :token_hash LIMIT 1');
            $statement->execute(['token_hash' => $tokenHash]);
            $reset = $statement->fetch(PDO::FETCH_ASSOC);

            if (!$reset || $reset['expires_at'] < date('Y-m-d H:i:s')) {
                $this->json(['message' => 'Ce lien de réinitialisation est invalide ou a expiré.'], 422);
                return;
            }

            $pdo->prepare('UPDATE users SET password_hash = :hash WHERE id = :id')
                ->execute(['hash' => password_hash($password, PASSWORD_DEFAULT), 'id' => $reset['user_id']]);
            $pdo->prepare('DELETE FROM password_resets WHERE user_id = :user_id')->execute(['user_id' => $reset['user_id']]);

            $this->json(['message' => 'Mot de passe mis à jour. Vous pouvez maintenant vous connecter.']);
        } catch (PDOException) {
            $this->json(['message' => 'Base de données indisponible.'], 503);
        }
    }

    private function sendResetEmail(string $to, string $name, string $token): void
    {
        $link = Config::url('/u/admin/reset-password') . '?token=' . urlencode($token);
        $appName = $_ENV['APP_NAME'] ?? 'Le Quotidien Actu';

        $subject = 'Réinitialisation de votre mot de passe — ' . $appName;
        $body = "Bonjour {$name},\n\n"
            . "Une demande de réinitialisation de mot de passe a été effectuée pour votre compte administrateur {$appName}.\n\n"
            . "Cliquez sur le lien suivant pour choisir un nouveau mot de passe (valable 1 heure) :\n{$link}\n\n"
            . "Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet e-mail.\n";

        Mailer::send($to, $name, $subject, $body);
    }

    public function logout(): void
    {
        $this->startSession();
        $_SESSION = [];
        session_destroy();
        $this->json(['message' => 'Session fermée.']);
    }

    public static function requireStaff(array $roles = self::STAFF_ROLES): void
    {
        self::startSession();
        $user = $_SESSION['admin_user'] ?? null;
        if (!$user || !in_array($user['role'] ?? '', $roles, true)) {
            self::reject(401, 'Authentification administrateur requise.');
        }

        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if ($method !== 'GET' && $method !== 'HEAD') {
            $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
            if ($token === '' || empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
                self::reject(419, 'Session expirée ou jeton de sécurité invalide. Rechargez la page.');
            }
        }
    }

    private static function reject(int $status, string $message): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['message' => $message]);
        exit;
    }

    private function ensureCsrfToken(bool $regenerate = false): void
    {
        if ($regenerate || empty($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
    }

    private static function startSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_name('lqa_admin');
            session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off']);
            session_start();
        }
    }

    private function input(): array
    {
        return json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];
    }

    private function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    private function json(array $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data);
    }
}
