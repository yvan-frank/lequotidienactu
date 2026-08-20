<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\AuditLog;
use App\Support\Slug;
use PDO;
use PDOException;

final class AdminPageController
{
    private const STATUSES = ['draft', 'published'];

    /**
     * Slugs already served by hardcoded routes/controllers, plus reserved
     * path segments — a page created with one of these would never be
     * reachable, since Router matches those routes before the dynamic
     * page fallback.
     */
    private const RESERVED_SLUGS = [
        'mentions-legales', 'confidentialite', 'a-propos', 'contact', 'recherche',
        'afrique', 'france-diaspora', 'business', 'tech', 'sport', 'culture',
        'admin', 'api', 'u',
    ];

    public function index(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $status = $_GET['status'] ?? 'all';
            if ($status !== 'all' && !in_array($status, self::STATUSES, true)) {
                throw new \InvalidArgumentException('Filtre de statut invalide.');
            }
            $sql = 'SELECT id, title, slug, status, published_at, created_at, updated_at FROM pages';
            $statement = $pdo->prepare($status === 'all' ? $sql . ' ORDER BY updated_at DESC LIMIT 100' : $sql . ' WHERE status = :status ORDER BY updated_at DESC LIMIT 100');
            $statement->execute($status === 'all' ? [] : ['status' => $status]);
            return ['data' => $statement->fetchAll(PDO::FETCH_ASSOC)];
        });
    }

    public function create(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo): array {
            $data = $this->validate($this->input(), $pdo);
            $statement = $pdo->prepare('INSERT INTO pages (title, slug, body, status, published_at, meta_title, meta_description, robots) VALUES (:title, :slug, :body, :status, :published_at, :meta_title, :meta_description, :robots)');
            $statement->execute($data);
            $id = (int) $pdo->lastInsertId();
            AuditLog::record('page.create', 'page', $id, ['title' => $data['title'], 'status' => $data['status']]);
            return ['data' => ['id' => $id], 'message' => 'Page enregistrée.'];
        }, 201);
    }

    public function show(int $id): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo) use ($id): array {
            $statement = $pdo->prepare('SELECT * FROM pages WHERE id = :id LIMIT 1');
            $statement->execute(['id' => $id]);
            $page = $statement->fetch(PDO::FETCH_ASSOC);
            if (!$page) throw new \InvalidArgumentException('Page introuvable.');
            return ['data' => $page];
        });
    }

    public function update(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $exists = $pdo->prepare('SELECT 1 FROM pages WHERE id = :id');
            $exists->execute(['id' => $id]);
            if (!$exists->fetchColumn()) throw new \InvalidArgumentException('Page introuvable.');

            $data = $this->validate($this->input(), $pdo, $id);
            $data['id'] = $id;
            $statement = $pdo->prepare('UPDATE pages SET title = :title, slug = :slug, body = :body, status = :status, published_at = :published_at, meta_title = :meta_title, meta_description = :meta_description, robots = :robots WHERE id = :id');
            $statement->execute($data);
            AuditLog::record('page.update', 'page', $id, ['title' => $data['title']]);
            return ['data' => ['id' => $id], 'message' => 'Page mise à jour.'];
        });
    }

    public function delete(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $title = $pdo->prepare('SELECT title FROM pages WHERE id = :id');
            $title->execute(['id' => $id]);
            $pageTitle = $title->fetchColumn();
            $statement = $pdo->prepare('DELETE FROM pages WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Page introuvable.');
            AuditLog::record('page.delete', 'page', $id, ['title' => $pageTitle ?: null]);
            return ['message' => 'Page supprimée.'];
        });
    }

    private function validate(array $input, PDO $pdo, ?int $ignoreId = null): array
    {
        $title = trim((string) ($input['title'] ?? ''));
        $body = trim((string) ($input['body'] ?? ''));
        $status = $input['status'] ?? 'draft';
        if (!in_array($status, self::STATUSES, true)) {
            throw new \InvalidArgumentException('Statut de page invalide.');
        }
        if ($status === 'published' && ($title === '' || $body === '')) {
            throw new \InvalidArgumentException('Titre et contenu sont obligatoires pour publier une page.');
        }

        $slug = trim((string) ($input['slug'] ?? ''));
        if ($slug === '') {
            $slug = $title !== '' ? Slug::make($title) : 'page-' . bin2hex(random_bytes(4));
        } else {
            $slug = Slug::make($slug);
        }
        if ($slug === '') {
            throw new \InvalidArgumentException('Slug invalide.');
        }
        if (in_array($slug, self::RESERVED_SLUGS, true)) {
            throw new \InvalidArgumentException('Cette adresse est réservée par le site. Choisissez un autre slug.');
        }

        $statement = $pdo->prepare('SELECT id FROM pages WHERE slug = :slug LIMIT 1');
        $statement->execute(['slug' => $slug]);
        $existing = $statement->fetchColumn();
        if ($existing !== false && (int) $existing !== $ignoreId) {
            throw new \InvalidArgumentException('Ce slug est déjà utilisé par une autre page.');
        }

        $publishedAt = $input['published_at'] ?: null;
        if ($status === 'published' && !$publishedAt) {
            $publishedAt = date('Y-m-d H:i:s');
        }

        return [
            'title' => $title !== '' ? $title : 'Page sans titre',
            'slug' => $slug,
            'body' => $body,
            'status' => $status,
            'published_at' => $publishedAt,
            'meta_title' => trim((string) ($input['meta_title'] ?? '')) ?: null,
            'meta_description' => trim((string) ($input['meta_description'] ?? '')) ?: null,
            'robots' => $input['robots'] ?? 'index,follow',
        ];
    }

    private function input(): array { return json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR); }
    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException $e) { $this->error($e->getCode() === '23000' ? 'Ce slug est déjà utilisé par une autre page.' : 'Base de données indisponible. Exécutez les migrations et vérifiez .env.', $e->getCode() === '23000' ? 409 : 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
}
