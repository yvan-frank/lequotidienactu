<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\AuditLog;
use PDO;
use PDOException;

final class AdminDrawRoundController
{
    public function index(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $rows = $pdo->query('SELECT id, draw_date, draw_type, crs_cutoff, invitations_issued, created_at, updated_at FROM draw_rounds ORDER BY draw_date DESC LIMIT 200')->fetchAll(PDO::FETCH_ASSOC);
            return ['data' => $rows];
        });
    }

    public function create(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo): array {
            $data = $this->validate($this->input());
            $statement = $pdo->prepare('INSERT INTO draw_rounds (draw_date, draw_type, crs_cutoff, invitations_issued) VALUES (:draw_date, :draw_type, :crs_cutoff, :invitations_issued)');
            $statement->execute($data);
            $newId = (int) $pdo->lastInsertId();
            AuditLog::record('draw_round.create', 'draw_round', $newId, ['draw_date' => $data['draw_date'], 'crs_cutoff' => $data['crs_cutoff']]);
            return ['data' => ['id' => $newId], 'message' => 'Tirage créé.'];
        }, 201);
    }

    public function update(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $data = $this->validate($this->input());
            $data['id'] = $id;
            $statement = $pdo->prepare('UPDATE draw_rounds SET draw_date = :draw_date, draw_type = :draw_type, crs_cutoff = :crs_cutoff, invitations_issued = :invitations_issued WHERE id = :id');
            $statement->execute($data);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM draw_rounds WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetchColumn()) throw new \InvalidArgumentException('Tirage introuvable.');
            }
            AuditLog::record('draw_round.update', 'draw_round', $id, ['draw_date' => $data['draw_date'], 'crs_cutoff' => $data['crs_cutoff']]);
            return ['data' => ['id' => $id], 'message' => 'Tirage mis à jour.'];
        });
    }

    public function delete(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $statement = $pdo->prepare('DELETE FROM draw_rounds WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Tirage introuvable.');
            AuditLog::record('draw_round.delete', 'draw_round', $id);
            return ['message' => 'Tirage supprimé.'];
        });
    }

    private function validate(array $input): array
    {
        $date = trim((string) ($input['draw_date'] ?? ''));
        $type = trim((string) ($input['draw_type'] ?? ''));
        $cutoff = (int) ($input['crs_cutoff'] ?? 0);
        $invitations = (int) ($input['invitations_issued'] ?? 0);

        if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new \InvalidArgumentException('La date du tirage est invalide.');
        }
        if ($type === '') {
            throw new \InvalidArgumentException('Le type de tirage est obligatoire.');
        }
        if ($cutoff <= 0 || $cutoff > 1200) {
            throw new \InvalidArgumentException('Le score minimal doit être compris entre 1 et 1200.');
        }
        if ($invitations <= 0) {
            throw new \InvalidArgumentException("Le nombre d'invitations doit être positif.");
        }

        return ['draw_date' => $date, 'draw_type' => $type, 'crs_cutoff' => $cutoff, 'invitations_issued' => $invitations];
    }

    private function input(): array { return json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR); }
    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException $e) { $this->error($e->getCode() === '23000' ? 'Un tirage existe déjà pour cette date et ce type.' : 'Base de données indisponible. Exécutez les migrations et vérifiez .env.', $e->getCode() === '23000' ? 409 : 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
}
