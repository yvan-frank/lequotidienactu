<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\AuditLog;
use PDO;
use PDOException;

final class AdminAdsController
{
    public function slots(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $rows = $pdo->query('SELECT id, code, label, page_scope FROM ad_slots ORDER BY page_scope, label')->fetchAll(PDO::FETCH_ASSOC);
            return ['data' => $rows];
        });
    }

    public function index(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $rows = $pdo->query(
                'SELECT a.id, a.ad_slot_id, s.code AS slot_code, s.label AS slot_label, a.name, a.content_html, a.starts_at, a.ends_at, a.impressions, a.clicks
                 FROM advertisements a INNER JOIN ad_slots s ON s.id = a.ad_slot_id
                 ORDER BY a.id DESC'
            )->fetchAll(PDO::FETCH_ASSOC);
            return ['data' => $rows];
        });
    }

    public function create(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo): array {
            $data = $this->validate($this->input(), $pdo);
            $statement = $pdo->prepare('INSERT INTO advertisements (ad_slot_id, name, content_html, starts_at, ends_at) VALUES (:ad_slot_id, :name, :content_html, :starts_at, :ends_at)');
            $statement->execute($data);
            $newId = (int) $pdo->lastInsertId();
            AuditLog::record('ad.create', 'advertisement', $newId, ['name' => $data['name']]);
            return ['data' => ['id' => $newId], 'message' => 'Publicité créée.'];
        }, 201);
    }

    public function update(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $data = $this->validate($this->input(), $pdo);
            $data['id'] = $id;
            $statement = $pdo->prepare('UPDATE advertisements SET ad_slot_id = :ad_slot_id, name = :name, content_html = :content_html, starts_at = :starts_at, ends_at = :ends_at WHERE id = :id');
            $statement->execute($data);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM advertisements WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetchColumn()) throw new \InvalidArgumentException('Publicité introuvable.');
            }
            AuditLog::record('ad.update', 'advertisement', $id, ['name' => $data['name']]);
            return ['data' => ['id' => $id], 'message' => 'Publicité mise à jour.'];
        });
    }

    public function delete(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $statement = $pdo->prepare('DELETE FROM advertisements WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Publicité introuvable.');
            AuditLog::record('ad.delete', 'advertisement', $id);
            return ['message' => 'Publicité supprimée.'];
        });
    }

    private function validate(array $input, PDO $pdo): array
    {
        $adSlotId = (int) ($input['ad_slot_id'] ?? 0);
        $name = trim((string) ($input['name'] ?? ''));
        $contentHtml = trim((string) ($input['content_html'] ?? ''));
        if ($adSlotId <= 0 || $name === '' || $contentHtml === '') {
            throw new \InvalidArgumentException('L’emplacement, le nom et le contenu sont obligatoires.');
        }
        $slotExists = $pdo->prepare('SELECT 1 FROM ad_slots WHERE id = :id');
        $slotExists->execute(['id' => $adSlotId]);
        if (!$slotExists->fetchColumn()) {
            throw new \InvalidArgumentException('Emplacement publicitaire invalide.');
        }
        $startsAt = trim((string) ($input['starts_at'] ?? '')) ?: null;
        $endsAt = trim((string) ($input['ends_at'] ?? '')) ?: null;
        if ($startsAt !== null && $endsAt !== null && $startsAt > $endsAt) {
            throw new \InvalidArgumentException('La date de fin doit être postérieure à la date de début.');
        }

        return [
            'ad_slot_id' => $adSlotId,
            'name' => mb_substr($name, 0, 150),
            'content_html' => $contentHtml,
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
        ];
    }

    private function input(): array { return json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR); }
    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException $e) { $this->error('Base de données indisponible. Exécutez les migrations et vérifiez .env.', 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
}
