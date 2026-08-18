<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Config;
use App\Support\Mailer;
use App\Support\RateLimiter;
use PDO;
use PDOException;

final class AdminUserController
{
    private const ROLES = ['admin', 'editor', 'author', 'reader'];

    public function index(): void
    {
        AdminAuthController::requireStaff(['admin']);
        $this->respond(function (PDO $pdo): array {
            $rows = $pdo->query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC')->fetchAll(PDO::FETCH_ASSOC);
            return ['data' => $rows];
        });
    }

    public function invite(): void
    {
        AdminAuthController::requireStaff(['admin']);
        $this->respond(function (PDO $pdo): array {
            if ((new RateLimiter($pdo))->tooManyAttempts('admin-invite', 10, 900)) {
                throw new \InvalidArgumentException('Trop d’invitations envoyées. Réessayez dans quelques minutes.');
            }

            $input = $this->input();
            $name = trim((string) ($input['name'] ?? ''));
            $email = filter_var(trim((string) ($input['email'] ?? '')), FILTER_VALIDATE_EMAIL);
            $role = (string) ($input['role'] ?? '');

            if ($name === '' || !$email || !in_array($role, self::ROLES, true)) {
                throw new \InvalidArgumentException('Nom, e-mail valide et rôle sont obligatoires.');
            }

            $existing = $pdo->prepare('SELECT 1 FROM users WHERE email = :email');
            $existing->execute(['email' => $email]);
            if ($existing->fetchColumn()) {
                throw new \InvalidArgumentException('Un compte existe déjà avec cette adresse e-mail.');
            }

            // No one can log in with this hash — the invitee sets their own
            // password via the emailed link, reusing the password-reset flow.
            $unusableHash = password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT);
            $pdo->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (:name, :email, :hash, :role)')
                ->execute(['name' => $name, 'email' => $email, 'hash' => $unusableHash, 'role' => $role]);
            $userId = (int) $pdo->lastInsertId();

            $token = bin2hex(random_bytes(32));
            $pdo->prepare('INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (:user_id, :token_hash, :expires_at)')
                ->execute(['user_id' => $userId, 'token_hash' => hash('sha256', $token), 'expires_at' => date('Y-m-d H:i:s', time() + 86400)]);

            $this->sendInviteEmail($email, $name, $token);

            return ['data' => ['id' => $userId], 'message' => 'Invitation envoyée à ' . $email . '.'];
        }, 201);
    }

    public function update(int $id): void
    {
        AdminAuthController::requireStaff(['admin']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $input = $this->input();
            $name = trim((string) ($input['name'] ?? ''));
            $email = filter_var(trim((string) ($input['email'] ?? '')), FILTER_VALIDATE_EMAIL);
            $role = (string) ($input['role'] ?? '');

            if ($name === '' || !$email || !in_array($role, self::ROLES, true)) {
                throw new \InvalidArgumentException('Nom, e-mail valide et rôle sont obligatoires.');
            }

            $current = $_SESSION['admin_user'] ?? null;
            if ($current && $current['id'] === $id && $role !== 'admin') {
                throw new \InvalidArgumentException('Vous ne pouvez pas retirer votre propre rôle administrateur.');
            }

            $statement = $pdo->prepare('UPDATE users SET name = :name, email = :email, role = :role WHERE id = :id');
            $statement->execute(['name' => $name, 'email' => $email, 'role' => $role, 'id' => $id]);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM users WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetchColumn()) throw new \InvalidArgumentException('Utilisateur introuvable.');
            }

            return ['data' => ['id' => $id], 'message' => 'Utilisateur mis à jour.'];
        });
    }

    public function delete(int $id): void
    {
        AdminAuthController::requireStaff(['admin']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $current = $_SESSION['admin_user'] ?? null;
            if ($current && $current['id'] === $id) {
                throw new \InvalidArgumentException('Vous ne pouvez pas supprimer votre propre compte.');
            }

            $statement = $pdo->prepare('DELETE FROM users WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Utilisateur introuvable.');

            return ['message' => 'Utilisateur supprimé.'];
        });
    }

    private function sendInviteEmail(string $to, string $name, string $token): void
    {
        $link = Config::url('/u/admin/reset-password') . '?token=' . urlencode($token);
        $appName = $_ENV['APP_NAME'] ?? 'Le Quotidien Actu';

        $subject = 'Invitation à rejoindre l’administration — ' . $appName;
        $body = "Bonjour {$name},\n\n"
            . "Un compte administrateur vient d’être créé pour vous sur {$appName}.\n\n"
            . "Cliquez sur le lien suivant pour choisir votre mot de passe et activer votre compte (valable 24 heures) :\n{$link}\n\n"
            . "Si vous ne vous attendiez pas à cette invitation, ignorez simplement cet e-mail.\n";

        Mailer::send($to, $name, $subject, $body);
    }

    private function input(): array { return json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR); }
    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException $e) { $this->error($e->getCode() === '23000' ? 'Cette adresse e-mail est déjà utilisée.' : 'Base de données indisponible.', $e->getCode() === '23000' ? 409 : 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
}
