<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use PDO;
use PDOException;

final class AdminCommentController
{
    private const STATUSES = ['pending', 'approved', 'rejected', 'spam'];

    public function index(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $status = $_GET['status'] ?? 'pending';
            if ($status !== 'all' && !in_array($status, self::STATUSES, true)) {
                throw new \InvalidArgumentException('Filtre de statut invalide.');
            }
            $sql = 'SELECT c.id, c.article_id, c.parent_id, c.author_name, c.body, c.status, c.created_at, c.ip_address, c.reported_count, a.title AS article_title, a.slug AS article_slug, cat.slug AS category_slug, p.author_name AS parent_author_name FROM comments c INNER JOIN articles a ON a.id = c.article_id INNER JOIN categories cat ON cat.id = a.category_id LEFT JOIN comments p ON p.id = c.parent_id';
            $statement = $pdo->prepare($status === 'all' ? $sql . ' ORDER BY c.created_at DESC LIMIT 100' : $sql . ' WHERE c.status = :status ORDER BY c.created_at DESC LIMIT 100');
            $statement->execute($status === 'all' ? [] : ['status' => $status]);
            return ['data' => $statement->fetchAll(PDO::FETCH_ASSOC)];
        });
    }

    public function update(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $input = json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR);
            $status = $input['status'] ?? '';
            if (!in_array($status, self::STATUSES, true)) {
                throw new \InvalidArgumentException('Statut invalide.');
            }
            $statement = $pdo->prepare('UPDATE comments SET status = :status WHERE id = :id');
            $statement->execute(['status' => $status, 'id' => $id]);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM comments WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetchColumn()) throw new \InvalidArgumentException('Commentaire introuvable.');
            }
            return ['message' => 'Commentaire mis à jour.'];
        });
    }

    public function reply(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor', 'author']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $input = json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR);
            $body = trim((string) ($input['body'] ?? ''));
            if ($body === '') {
                throw new \InvalidArgumentException('La réponse ne peut pas être vide.');
            }
            if (mb_strlen($body) > 2000) {
                throw new \InvalidArgumentException('Réponse trop longue (2000 caractères maximum).');
            }
            $parent = $pdo->prepare('SELECT article_id, parent_id FROM comments WHERE id = :id');
            $parent->execute(['id' => $id]);
            $row = $parent->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                throw new \InvalidArgumentException('Commentaire introuvable.');
            }
            if ($row['parent_id'] !== null) {
                throw new \InvalidArgumentException('Impossible de répondre à une réponse.');
            }
            $staffName = $_SESSION['admin_user']['name'] ?? 'La rédaction';
            $staffId = $_SESSION['admin_user']['id'] ?? null;
            $statement = $pdo->prepare('INSERT INTO comments (article_id, parent_id, user_id, author_name, body, status) VALUES (:article_id, :parent_id, :user_id, :author_name, :body, "approved")');
            $statement->execute([
                'article_id' => $row['article_id'],
                'parent_id' => $id,
                'user_id' => $staffId,
                'author_name' => $staffName,
                'body' => $body,
            ]);
            return ['message' => 'Réponse publiée.', 'data' => ['id' => (int) $pdo->lastInsertId()]];
        }, 201);
    }

    public function delete(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $statement = $pdo->prepare('DELETE FROM comments WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Commentaire introuvable.');
            return ['message' => 'Commentaire supprimé.'];
        });
    }

    public function block(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $comment = $pdo->prepare('SELECT ip_address FROM comments WHERE id = :id');
            $comment->execute(['id' => $id]);
            $ip = $comment->fetchColumn();
            if (!$ip) {
                throw new \InvalidArgumentException('Adresse IP inconnue pour ce commentaire — blocage impossible.');
            }
            $pdo->prepare('INSERT INTO blocked_commenters (ip_address, reason) VALUES (:ip, :reason) ON DUPLICATE KEY UPDATE reason = VALUES(reason)')
                ->execute(['ip' => $ip, 'reason' => 'Bloqué depuis un commentaire signalé']);
            $pdo->prepare('UPDATE comments SET status = "rejected" WHERE id = :id')->execute(['id' => $id]);
            return ['message' => 'Auteur bloqué : ses futurs commentaires seront refusés.'];
        });
    }

    public function blockedList(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            return ['data' => $pdo->query('SELECT id, ip_address, reason, created_at FROM blocked_commenters ORDER BY created_at DESC')->fetchAll(PDO::FETCH_ASSOC)];
        });
    }

    public function unblock(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $statement = $pdo->prepare('DELETE FROM blocked_commenters WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Blocage introuvable.');
            return ['message' => 'Adresse débloquée.'];
        });
    }

    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException) { $this->error('Base de données indisponible.', 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
}
