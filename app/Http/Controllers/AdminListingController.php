<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\AuditLog;
use PDO;
use PDOException;

/**
 * Moderation for public job/classified submissions (mirrors
 * AdminCommentController's pending → approved/rejected workflow): anyone
 * can submit via the public form, nothing is visible on the site until
 * staff approves it here.
 */
final class AdminListingController
{
    private const STATUSES = ['pending', 'approved', 'rejected', 'expired'];

    public function index(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $status = $_GET['status'] ?? 'pending';
            $type = $_GET['type'] ?? 'all';
            if ($status !== 'all' && !in_array($status, self::STATUSES, true)) {
                throw new \InvalidArgumentException('Filtre de statut invalide.');
            }
            if (!in_array($type, ['all', 'job', 'classified'], true)) {
                throw new \InvalidArgumentException('Filtre de type invalide.');
            }

            $sql = 'SELECT id, type, category, title, slug, location, price, contact_name, contact_email, contact_phone, poster_name, poster_email, status, expires_at, created_at FROM listings WHERE 1 = 1';
            $params = [];
            if ($status !== 'all') {
                $sql .= ' AND status = :status';
                $params['status'] = $status;
            }
            if ($type !== 'all') {
                $sql .= ' AND type = :type';
                $params['type'] = $type;
            }
            $sql .= ' ORDER BY created_at DESC LIMIT 200';
            $statement = $pdo->prepare($sql);
            $statement->execute($params);
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
            $staffId = $_SESSION['admin_user']['id'] ?? null;
            $statement = $pdo->prepare('UPDATE listings SET status = :status, reviewed_by = :reviewed_by WHERE id = :id');
            $statement->execute(['status' => $status, 'reviewed_by' => $staffId, 'id' => $id]);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM listings WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetchColumn()) throw new \InvalidArgumentException('Annonce introuvable.');
            }
            AuditLog::record('listing.moderate', 'listing', $id, ['status' => $status]);
            return ['message' => 'Annonce mise à jour.'];
        });
    }

    public function delete(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $statement = $pdo->prepare('DELETE FROM listings WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Annonce introuvable.');
            AuditLog::record('listing.delete', 'listing', $id);
            return ['message' => 'Annonce supprimée.'];
        });
    }

    private function respond(callable $operation, int $success = 200): void
    {
        try {
            http_response_code($success);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR);
        } catch (\InvalidArgumentException $e) {
            $this->error($e->getMessage(), 422);
        } catch (PDOException) {
            $this->error('Base de données indisponible.', 503);
        } catch (\Throwable $e) {
            $this->error($e->getMessage(), 500);
        }
    }

    private function error(string $message, int $status): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['message' => $message]);
    }

    private function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }
}
