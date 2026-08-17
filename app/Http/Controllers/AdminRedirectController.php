<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Seo\RedirectService;
use PDO;
use PDOException;

final class AdminRedirectController
{
    public function index(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $rows = $pdo->query('SELECT id, source_path, destination_url, status_code, created_at, updated_at FROM redirects ORDER BY updated_at DESC LIMIT 200')->fetchAll(PDO::FETCH_ASSOC);
            return ['data' => $rows];
        });
    }

    public function create(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo): array {
            $data = $this->validate($this->input());
            $statement = $pdo->prepare('INSERT INTO redirects (source_path, destination_url, status_code) VALUES (:source_path, :destination_url, :status_code)');
            $statement->execute($data);
            return ['data' => ['id' => (int) $pdo->lastInsertId()], 'message' => 'Redirection créée.'];
        }, 201);
    }

    public function update(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $data = $this->validate($this->input());
            $data['id'] = $id;
            $statement = $pdo->prepare('UPDATE redirects SET source_path = :source_path, destination_url = :destination_url, status_code = :status_code WHERE id = :id');
            $statement->execute($data);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM redirects WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetchColumn()) throw new \InvalidArgumentException('Redirection introuvable.');
            }
            return ['data' => ['id' => $id], 'message' => 'Redirection mise à jour.'];
        });
    }

    public function delete(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $statement = $pdo->prepare('DELETE FROM redirects WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Redirection introuvable.');
            return ['message' => 'Redirection supprimée.'];
        });
    }

    private function validate(array $input): array
    {
        $source = $this->normalize((string) ($input['source_path'] ?? ''));
        $destination = trim((string) ($input['destination_url'] ?? ''));
        $status = (int) ($input['status_code'] ?? 301);
        if ($source === '' || $destination === '') {
            throw new \InvalidArgumentException('L’URL source et la destination sont obligatoires.');
        }
        if (!in_array($status, [301, 302, 307, 308], true)) {
            throw new \InvalidArgumentException('Code de statut invalide.');
        }
        $normalizedDestination = str_starts_with($destination, '/') ? $this->normalize($destination) : $destination;
        if ($source === $normalizedDestination) {
            throw new \InvalidArgumentException('La source et la destination ne peuvent pas être identiques.');
        }

        return ['source_path' => $source, 'destination_url' => $normalizedDestination, 'status_code' => $status];
    }

    private function normalize(string $path): string
    {
        $path = '/' . ltrim($path, '/');
        return rtrim($path, '/') ?: '/';
    }

    private function input(): array { return json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR); }
    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException $e) { $this->error($e->getCode() === '23000' ? 'Cette URL source est déjà redirigée.' : 'Base de données indisponible. Exécutez les migrations et vérifiez .env.', $e->getCode() === '23000' ? 409 : 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
}
