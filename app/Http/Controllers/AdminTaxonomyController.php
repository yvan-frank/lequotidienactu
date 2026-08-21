<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Seo\RedirectService;
use App\Support\AuditLog;
use App\Support\Slug;
use PDO;
use PDOException;

final class AdminTaxonomyController
{
    public function categories(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $rows = $pdo->query('SELECT c.id, c.parent_id, c.name, c.slug, c.description, c.position, (SELECT COUNT(*) FROM articles a WHERE a.category_id = c.id) AS articles_count FROM categories c ORDER BY c.position, c.name')->fetchAll(PDO::FETCH_ASSOC);
            return ['data' => $rows];
        });
    }

    public function createCategory(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo): array {
            $data = $this->validateCategory($this->input(), $pdo);
            $statement = $pdo->prepare('INSERT INTO categories (parent_id, name, slug, description, position) VALUES (:parent_id, :name, :slug, :description, :position)');
            $statement->execute($data);
            (new RedirectService())->reclaim("/{$data['slug']}");
            $newId = (int) $pdo->lastInsertId();
            AuditLog::record('category.create', 'category', $newId, ['name' => $data['name']]);
            return ['data' => ['id' => $newId], 'message' => 'Rubrique créée.'];
        }, 201);
    }

    public function updateCategory(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $before = $pdo->prepare('SELECT slug FROM categories WHERE id = :id');
            $before->execute(['id' => $id]);
            $previousSlug = $before->fetchColumn();
            if ($previousSlug === false) throw new \InvalidArgumentException('Rubrique introuvable.');

            $data = $this->validateCategory($this->input(), $pdo, $id);
            $data['id'] = $id;
            $statement = $pdo->prepare('UPDATE categories SET parent_id = :parent_id, name = :name, slug = :slug, description = :description, position = :position WHERE id = :id');
            $statement->execute($data);

            if ((string) $previousSlug !== $data['slug']) {
                $redirects = new RedirectService();
                $redirects->record("/{$previousSlug}", "/{$data['slug']}");

                $articles = $pdo->prepare("SELECT slug FROM articles WHERE category_id = :id AND status = 'published'");
                $articles->execute(['id' => $id]);
                foreach ($articles->fetchAll(PDO::FETCH_COLUMN) as $articleSlug) {
                    $redirects->record("/{$previousSlug}/{$articleSlug}", "/{$data['slug']}/{$articleSlug}");
                }
            }

            AuditLog::record('category.update', 'category', $id, ['name' => $data['name']]);
            return ['data' => ['id' => $id], 'message' => 'Rubrique mise à jour.'];
        });
    }

    public function deleteCategory(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $statement = $pdo->prepare('DELETE FROM categories WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Rubrique introuvable.');
            AuditLog::record('category.delete', 'category', $id);
            return ['message' => 'Rubrique supprimée.'];
        });
    }

    public function tags(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $rows = $pdo->query('SELECT t.id, t.name, t.slug, (SELECT COUNT(*) FROM article_tags at WHERE at.tag_id = t.id) AS articles_count FROM tags t ORDER BY t.name')->fetchAll(PDO::FETCH_ASSOC);
            return ['data' => $rows];
        });
    }

    public function createTag(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo): array {
            $data = $this->validateTag($this->input());
            $statement = $pdo->prepare('INSERT INTO tags (name, slug) VALUES (:name, :slug)');
            $statement->execute($data);
            $newId = (int) $pdo->lastInsertId();
            AuditLog::record('tag.create', 'tag', $newId, ['name' => $data['name']]);
            return ['data' => ['id' => $newId], 'message' => 'Tag créé.'];
        }, 201);
    }

    public function updateTag(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $data = $this->validateTag($this->input());
            $data['id'] = $id;
            $statement = $pdo->prepare('UPDATE tags SET name = :name, slug = :slug WHERE id = :id');
            $statement->execute($data);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM tags WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetchColumn()) throw new \InvalidArgumentException('Tag introuvable.');
            }
            AuditLog::record('tag.update', 'tag', $id, ['name' => $data['name']]);
            return ['data' => ['id' => $id], 'message' => 'Tag mis à jour.'];
        });
    }

    public function deleteTag(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $statement = $pdo->prepare('DELETE FROM tags WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Tag introuvable.');
            AuditLog::record('tag.delete', 'tag', $id);
            return ['message' => 'Tag supprimé.'];
        });
    }

    public function authors(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $rows = $pdo->query('SELECT au.id, au.user_id, au.display_name, au.job_title, au.slug, au.bio, au.disclosure, au.avatar_media_id, (SELECT COUNT(*) FROM articles a WHERE a.author_id = au.id) AS articles_count FROM authors au ORDER BY au.display_name')->fetchAll(PDO::FETCH_ASSOC);
            return ['data' => $rows];
        });
    }

    public function createAuthor(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo): array {
            $data = $this->validateAuthor($this->input(), $pdo);
            $statement = $pdo->prepare('INSERT INTO authors (user_id, display_name, job_title, slug, bio, disclosure, avatar_media_id) VALUES (:user_id, :display_name, :job_title, :slug, :bio, :disclosure, :avatar_media_id)');
            $statement->execute($data);
            $newId = (int) $pdo->lastInsertId();
            AuditLog::record('author.create', 'author', $newId, ['display_name' => $data['display_name']]);
            return ['data' => ['id' => $newId], 'message' => 'Auteur créé.'];
        }, 201);
    }

    public function updateAuthor(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $data = $this->validateAuthor($this->input(), $pdo);
            $data['id'] = $id;
            $statement = $pdo->prepare('UPDATE authors SET user_id = :user_id, display_name = :display_name, job_title = :job_title, slug = :slug, bio = :bio, disclosure = :disclosure, avatar_media_id = :avatar_media_id WHERE id = :id');
            $statement->execute($data);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM authors WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetchColumn()) throw new \InvalidArgumentException('Auteur introuvable.');
            }
            AuditLog::record('author.update', 'author', $id, ['display_name' => $data['display_name']]);
            return ['data' => ['id' => $id], 'message' => 'Auteur mis à jour.'];
        });
    }

    public function deleteAuthor(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $statement = $pdo->prepare('DELETE FROM authors WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Auteur introuvable.');
            AuditLog::record('author.delete', 'author', $id);
            return ['message' => 'Auteur supprimé.'];
        });
    }

    private function validateCategory(array $input, PDO $pdo, ?int $ignoreId = null): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Le nom de la rubrique est obligatoire.');
        }
        $parentId = !empty($input['parent_id']) ? (int) $input['parent_id'] : null;
        if ($parentId !== null && $parentId === $ignoreId) {
            throw new \InvalidArgumentException('Une rubrique ne peut pas être son propre parent.');
        }
        if ($parentId !== null) {
            $check = $pdo->prepare('SELECT 1 FROM categories WHERE id = :id');
            $check->execute(['id' => $parentId]);
            if (!$check->fetchColumn()) {
                throw new \InvalidArgumentException('Rubrique parente introuvable.');
            }
        }

        return [
            'parent_id' => $parentId,
            'name' => $name,
            'slug' => trim((string) ($input['slug'] ?? '')) ?: $this->slugify($name),
            'description' => trim((string) ($input['description'] ?? '')) ?: null,
            'position' => (int) ($input['position'] ?? 0),
        ];
    }

    private function validateTag(array $input): array
    {
        $name = trim((string) ($input['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Le nom du tag est obligatoire.');
        }

        return [
            'name' => $name,
            'slug' => trim((string) ($input['slug'] ?? '')) ?: $this->slugify($name),
        ];
    }

    private function validateAuthor(array $input, PDO $pdo): array
    {
        $name = trim((string) ($input['display_name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Le nom de l’auteur est obligatoire.');
        }
        $userId = !empty($input['user_id']) ? (int) $input['user_id'] : null;
        if ($userId !== null) {
            $check = $pdo->prepare('SELECT 1 FROM users WHERE id = :id');
            $check->execute(['id' => $userId]);
            if (!$check->fetchColumn()) {
                throw new \InvalidArgumentException('Compte utilisateur introuvable.');
            }
        }
        $avatarMediaId = !empty($input['avatar_media_id']) ? (int) $input['avatar_media_id'] : null;

        return [
            'user_id' => $userId,
            'display_name' => $name,
            'job_title' => trim((string) ($input['job_title'] ?? '')) ?: null,
            'slug' => trim((string) ($input['slug'] ?? '')) ?: $this->slugify($name),
            'bio' => trim((string) ($input['bio'] ?? '')) ?: null,
            'disclosure' => trim((string) ($input['disclosure'] ?? '')) ?: null,
            'avatar_media_id' => $avatarMediaId,
        ];
    }

    private function input(): array { return json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR); }
    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException $e) { $this->error($e->getCode() === '23000' ? 'Cette valeur est déjà utilisée ou encore référencée par des articles.' : 'Base de données indisponible. Exécutez les migrations et vérifiez .env.', $e->getCode() === '23000' ? 409 : 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
    private function slugify(string $value): string { return Slug::make($value); }
}
