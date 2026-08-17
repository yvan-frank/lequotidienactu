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
            $sql = 'SELECT c.id, c.article_id, c.author_name, c.body, c.status, c.created_at, a.title AS article_title, a.slug AS article_slug, cat.slug AS category_slug FROM comments c INNER JOIN articles a ON a.id = c.article_id INNER JOIN categories cat ON cat.id = a.category_id';
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

    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException) { $this->error('Base de données indisponible.', 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
}
