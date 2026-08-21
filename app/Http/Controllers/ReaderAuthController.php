<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\RateLimiter;
use App\Support\RateLimits;
use PDO;
use PDOException;

/**
 * Public reader accounts — separate from the staff `users` table entirely.
 * Session is stored under its own cookie name (`lqa_reader`) so it never
 * collides with an admin session in the same browser (e.g. a staff member
 * previewing the site while also logged into the admin).
 */
final class ReaderAuthController
{
    public function session(): void
    {
        $this->startSession();
        $this->json(['authenticated' => isset($_SESSION['reader']), 'reader' => $_SESSION['reader'] ?? null]);
    }

    public function register(): void
    {
        $this->startSession();
        $input = $this->input();
        $name = trim((string) ($input['name'] ?? ''));
        $email = filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL);
        $password = (string) ($input['password'] ?? '');

        if ($name === '' || !$email || mb_strlen($password) < 8) {
            $this->json(['message' => 'Nom, e-mail valide et mot de passe (8 caractères minimum) requis.'], 422);
            return;
        }

        try {
            $pdo = $this->pdo();
            [$max, $window] = RateLimits::resolve('reader-register');
            if ((new RateLimiter($pdo))->tooManyAttempts('reader-register', $max, $window)) {
                $this->json(['message' => 'Trop de tentatives. Réessayez dans quelques minutes.'], 429);
                return;
            }

            $exists = $pdo->prepare('SELECT 1 FROM readers WHERE email = :email LIMIT 1');
            $exists->execute(['email' => $email]);
            if ($exists->fetchColumn()) {
                $this->json(['message' => 'Un compte existe déjà avec cette adresse e-mail.'], 422);
                return;
            }

            $pdo->prepare('INSERT INTO readers (name, email, password_hash) VALUES (:name, :email, :hash)')
                ->execute(['name' => mb_substr($name, 0, 150), 'email' => $email, 'hash' => password_hash($password, PASSWORD_DEFAULT)]);
            $readerId = (int) $pdo->lastInsertId();

            session_regenerate_id(true);
            $_SESSION['reader'] = ['id' => $readerId, 'name' => $name, 'email' => $email, 'followed_categories' => null];
            $this->json(['reader' => $_SESSION['reader']], 201);
        } catch (PDOException) {
            $this->json(['message' => 'Base de données indisponible.'], 503);
        }
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
            $pdo = $this->pdo();
            [$max, $window] = RateLimits::resolve('reader-login');
            if ((new RateLimiter($pdo))->tooManyAttempts('reader-login', $max, $window)) {
                $this->json(['message' => 'Trop de tentatives de connexion. Réessayez dans quelques minutes.'], 429);
                return;
            }

            $statement = $pdo->prepare('SELECT id, name, email, password_hash, followed_categories FROM readers WHERE email = :email LIMIT 1');
            $statement->execute(['email' => $email]);
            $reader = $statement->fetch(PDO::FETCH_ASSOC);

            if (!$reader || !password_verify($password, $reader['password_hash'])) {
                $this->json(['message' => 'Identifiants invalides.'], 401);
                return;
            }

            session_regenerate_id(true);
            $_SESSION['reader'] = [
                'id' => (int) $reader['id'],
                'name' => $reader['name'],
                'email' => $reader['email'],
                'followed_categories' => $reader['followed_categories'] ? json_decode((string) $reader['followed_categories'], true) : null,
            ];
            $this->json(['reader' => $_SESSION['reader']]);
        } catch (PDOException) {
            $this->json(['message' => 'Base de données indisponible.'], 503);
        }
    }

    public function logout(): void
    {
        $this->startSession();
        $_SESSION = [];
        session_destroy();
        $this->json(['message' => 'Déconnecté.']);
    }

    public function updatePreferences(): void
    {
        $this->startSession();
        $reader = $_SESSION['reader'] ?? null;
        if (!$reader) {
            $this->json(['message' => 'Connectez-vous pour modifier vos préférences.'], 401);
            return;
        }

        $input = $this->input();
        $categories = $input['categories'] ?? null;
        $categoriesJson = is_array($categories) && $categories !== []
            ? json_encode(array_values(array_unique(array_map('strval', $categories))), JSON_UNESCAPED_UNICODE)
            : null;

        try {
            $this->pdo()->prepare('UPDATE readers SET followed_categories = :categories WHERE id = :id')
                ->execute(['categories' => $categoriesJson, 'id' => $reader['id']]);
            $_SESSION['reader']['followed_categories'] = $categoriesJson ? json_decode($categoriesJson, true) : null;
            $this->json(['reader' => $_SESSION['reader']]);
        } catch (PDOException) {
            $this->json(['message' => 'Base de données indisponible.'], 503);
        }
    }

    private function startSession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_name('lqa_reader');
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
