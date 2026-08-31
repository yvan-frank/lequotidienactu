<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Seo\RedirectService;
use App\Support\AuditLog;
use App\Support\Config;
use App\Support\Push;
use App\Support\Slug;
use PDO;
use PDOException;

final class AdminArticleController
{
    private const STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived'];

    public function index(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $status = $_GET['status'] ?? 'all';
            if ($status !== 'all' && !in_array($status, self::STATUSES, true)) {
                throw new \InvalidArgumentException('Filtre de statut invalide.');
            }
            $search = trim((string) ($_GET['q'] ?? ''));
            $categoryId = isset($_GET['category_id']) && $_GET['category_id'] !== '' ? (int) $_GET['category_id'] : null;
            $authorId = isset($_GET['author_id']) && $_GET['author_id'] !== '' ? (int) $_GET['author_id'] : null;
            $sponsored = $_GET['is_sponsored'] ?? '';
            $featured = $_GET['is_featured'] ?? '';
            $dateFrom = trim((string) ($_GET['date_from'] ?? ''));
            $dateTo = trim((string) ($_GET['date_to'] ?? ''));
            $page = max(1, (int) ($_GET['page'] ?? 1));
            $perPage = 10;

            $conditions = [];
            $params = [];
            if ($status !== 'all') {
                $conditions[] = 'a.status = :status';
                $params['status'] = $status;
            }
            if ($search !== '') {
                $conditions[] = '(a.title LIKE :search OR a.excerpt LIKE :search)';
                $params['search'] = '%' . $search . '%';
            }
            if ($categoryId !== null) {
                $conditions[] = 'a.category_id = :category_id';
                $params['category_id'] = $categoryId;
            }
            if ($authorId !== null) {
                $conditions[] = 'a.author_id = :author_id';
                $params['author_id'] = $authorId;
            }
            if ($sponsored === '1' || $sponsored === '0') {
                $conditions[] = 'a.is_sponsored = :is_sponsored';
                $params['is_sponsored'] = (int) $sponsored;
            }
            if ($featured === '1' || $featured === '0') {
                $conditions[] = 'a.is_featured = :is_featured';
                $params['is_featured'] = (int) $featured;
            }
            if ($dateFrom !== '') {
                $conditions[] = 'a.created_at >= :date_from';
                $params['date_from'] = $dateFrom . ' 00:00:00';
            }
            if ($dateTo !== '') {
                $conditions[] = 'a.created_at <= :date_to';
                $params['date_to'] = $dateTo . ' 23:59:59';
            }

            $where = $conditions === [] ? '' : ' WHERE ' . implode(' AND ', $conditions);

            $countStatement = $pdo->prepare('SELECT COUNT(*) FROM articles a' . $where);
            $countStatement->execute($params);
            $total = (int) $countStatement->fetchColumn();
            $totalPages = max(1, (int) ceil($total / $perPage));
            $page = min($page, $totalPages);
            $offset = ($page - 1) * $perPage;

            $sql = 'SELECT a.id, a.title, a.slug, a.status, a.published_at, a.created_at, a.updated_at, a.is_sponsored, a.is_featured, c.name AS category_name, c.slug AS category_slug, au.display_name AS author_name FROM articles a LEFT JOIN categories c ON c.id = a.category_id LEFT JOIN authors au ON au.id = a.author_id'
                . $where . ' ORDER BY a.updated_at DESC LIMIT :limit OFFSET :offset';
            $statement = $pdo->prepare($sql);
            foreach ($params as $key => $value) {
                $statement->bindValue(':' . $key, $value);
            }
            $statement->bindValue(':limit', $perPage, PDO::PARAM_INT);
            $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
            $statement->execute();
            $rows = $statement->fetchAll(PDO::FETCH_ASSOC);

            return [
                'data' => $rows,
                'meta' => [
                    'page' => $page,
                    'per_page' => $perPage,
                    'total' => $total,
                    'total_pages' => $totalPages,
                ],
            ];
        });
    }

    public function taxonomy(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            return [
                'categories' => $pdo->query('SELECT id, parent_id, name, slug FROM categories ORDER BY position, name')->fetchAll(PDO::FETCH_ASSOC),
                'authors' => $pdo->query('SELECT id, display_name FROM authors ORDER BY display_name')->fetchAll(PDO::FETCH_ASSOC),
                'tags' => $pdo->query('SELECT id, name, slug FROM tags ORDER BY name')->fetchAll(PDO::FETCH_ASSOC),
            ];
        });
    }

    public function create(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor', 'author']);
        $this->respond(function (PDO $pdo): array {
            $input = $this->input();
            $data = $this->validate($input);
            $tagIds = $this->validateTagIds($input, $pdo);
            if ($data['hero_media_id'] !== null) {
                $media = $pdo->prepare('SELECT id FROM media WHERE id = :id AND mime_type LIKE "image/%"');
                $media->execute(['id' => $data['hero_media_id']]);
                if (!$media->fetchColumn()) {
                    throw new \InvalidArgumentException('L’image de couverture sélectionnée est introuvable.');
                }
            }
            $statement = $pdo->prepare('INSERT INTO articles (category_id, author_id, hero_media_id, title, slug, excerpt, body, status, published_at, meta_title, meta_description, canonical_url, robots, primary_keyword, secondary_keywords, is_sponsored, layout, sidebar_mode, sidebar_blocks_json, content_mode, content_blocks_json) VALUES (:category_id, :author_id, :hero_media_id, :title, :slug, :excerpt, :body, :status, :published_at, :meta_title, :meta_description, :canonical_url, :robots, :primary_keyword, :secondary_keywords, :is_sponsored, :layout, :sidebar_mode, :sidebar_blocks_json, :content_mode, :content_blocks_json)');
            $statement->execute($data);
            $id = (int) $pdo->lastInsertId();
            $this->syncTags($pdo, $id, $tagIds);
            $categorySlug = $this->categorySlug($pdo, $data['category_id']);
            if ($categorySlug !== null) {
                (new RedirectService())->reclaim("/{$categorySlug}/{$data['slug']}");
            }
            AuditLog::record('article.create', 'article', $id, ['title' => $data['title'], 'status' => $data['status']]);
            if ($data['status'] === 'published') {
                $this->notifyPublished($pdo, $id);
            }
            return ['data' => ['id' => $id], 'message' => 'Article enregistré.'];
        }, 201);
    }

    public function transition(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor', 'author']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $input = $this->input();
            $status = $input['status'] ?? '';
            if (!in_array($status, self::STATUSES, true)) {
                throw new \InvalidArgumentException('Statut éditorial invalide.');
            }
            $current = $pdo->prepare('SELECT status, title, body, category_id, author_id, content_mode, content_blocks_json FROM articles WHERE id = :id');
            $current->execute(['id' => $id]);
            $row = $current->fetch(PDO::FETCH_ASSOC);
            if (!$row) throw new \InvalidArgumentException('Article introuvable.');
            $previousStatus = $row['status'];
            if (in_array($status, ['published', 'scheduled'], true)) {
                $hasContent = $row['content_mode'] === 'builder'
                    ? !empty($row['content_blocks_json'])
                    : trim((string) $row['body']) !== '';
                if (trim((string) $row['title']) === '' || !$hasContent || $row['category_id'] === null || $row['author_id'] === null) {
                    throw new \InvalidArgumentException('Complétez le titre, le contenu, la rubrique et l’auteur avant de publier ou programmer.');
                }
            }
            $publishedAt = $status === 'published' ? date('Y-m-d H:i:s') : ($input['published_at'] ?? null);
            if ($status === 'scheduled' && !$publishedAt) {
                throw new \InvalidArgumentException('Une date de programmation est requise.');
            }
            $statement = $pdo->prepare('UPDATE articles SET status = :status, published_at = :published_at WHERE id = :id');
            $statement->execute(['status' => $status, 'published_at' => $publishedAt, 'id' => $id]);
            AuditLog::record('article.transition', 'article', $id, ['status' => $status]);
            if ($status === 'published' && $previousStatus !== 'published') {
                $this->notifyPublished($pdo, $id);
            }
            return ['message' => 'Workflow mis à jour.'];
        });
    }

    public function toggleFeatured(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $input = $this->input();
            $featured = !empty($input['is_featured']) ? 1 : 0;
            $statement = $pdo->prepare('UPDATE articles SET is_featured = :featured WHERE id = :id');
            $statement->execute(['featured' => $featured, 'id' => $id]);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM articles WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetchColumn()) throw new \InvalidArgumentException('Article introuvable.');
            }
            return ['message' => $featured ? 'Article mis en avant.' : 'Article retiré de la mise en avant.'];
        });
    }

    public function show(int $id): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo) use ($id): array {
            $statement = $pdo->prepare('SELECT a.*, m.path AS hero_url, m.width AS hero_width, m.height AS hero_height, m.alt_text AS hero_alt_text, m.mime_type AS hero_mime_type, m.bytes AS hero_bytes, m.created_at AS hero_created_at FROM articles a LEFT JOIN media m ON m.id = a.hero_media_id WHERE a.id = :id LIMIT 1');
            $statement->execute(['id' => $id]);
            $article = $statement->fetch(PDO::FETCH_ASSOC);
            if (!$article) throw new \InvalidArgumentException('Article introuvable.');
            $tags = $pdo->prepare('SELECT tag_id FROM article_tags WHERE article_id = :id');
            $tags->execute(['id' => $id]);
            $article['tag_ids'] = array_map('intval', $tags->fetchAll(PDO::FETCH_COLUMN));
            return ['data' => $article];
        });
    }

    public function update(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor', 'author']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $before = $pdo->prepare('SELECT a.slug, a.status, c.slug AS category_slug FROM articles a LEFT JOIN categories c ON c.id = a.category_id WHERE a.id = :id LIMIT 1');
            $before->execute(['id' => $id]);
            $previous = $before->fetch(PDO::FETCH_ASSOC);
            if (!$previous) throw new \InvalidArgumentException('Article introuvable.');

            $input = $this->input();
            $data = $this->validate($input);
            $tagIds = $this->validateTagIds($input, $pdo);
            if ($data['hero_media_id'] !== null) {
                $media = $pdo->prepare('SELECT id FROM media WHERE id = :id AND mime_type LIKE "image/%"');
                $media->execute(['id' => $data['hero_media_id']]);
                if (!$media->fetchColumn()) throw new \InvalidArgumentException('L’image de couverture sélectionnée est introuvable.');
            }
            $data['id'] = $id;
            $statement = $pdo->prepare('UPDATE articles SET category_id = :category_id, author_id = :author_id, hero_media_id = :hero_media_id, title = :title, slug = :slug, excerpt = :excerpt, body = :body, status = :status, published_at = :published_at, meta_title = :meta_title, meta_description = :meta_description, canonical_url = :canonical_url, robots = :robots, primary_keyword = :primary_keyword, secondary_keywords = :secondary_keywords, is_sponsored = :is_sponsored, layout = :layout, sidebar_mode = :sidebar_mode, sidebar_blocks_json = :sidebar_blocks_json, content_mode = :content_mode, content_blocks_json = :content_blocks_json WHERE id = :id');
            $statement->execute($data);
            if ($statement->rowCount() === 0) {
                $exists = $pdo->prepare('SELECT 1 FROM articles WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetchColumn()) throw new \InvalidArgumentException('Article introuvable.');
            }
            $this->syncTags($pdo, $id, $tagIds);

            $newCategorySlug = $this->categorySlug($pdo, $data['category_id']);
            if ($newCategorySlug !== null) {
                $newPath = "/{$newCategorySlug}/{$data['slug']}";
                $redirects = new RedirectService();
                if ($previous['status'] === 'published' && $previous['category_slug'] !== null) {
                    $oldPath = "/{$previous['category_slug']}/{$previous['slug']}";
                    if ($oldPath !== $newPath) {
                        $redirects->record($oldPath, $newPath);
                    } else {
                        $redirects->reclaim($newPath);
                    }
                } else {
                    $redirects->reclaim($newPath);
                }
            }

            AuditLog::record('article.update', 'article', $id, ['title' => $data['title']]);
            if ($data['status'] === 'published' && $previous['status'] !== 'published') {
                $this->notifyPublished($pdo, $id);
            }
            return ['data' => ['id' => $id], 'message' => 'Article mis à jour.'];
        });
    }

    public function delete(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $before = $pdo->prepare('SELECT a.title, a.slug, a.status, c.slug AS category_slug FROM articles a LEFT JOIN categories c ON c.id = a.category_id WHERE a.id = :id');
            $before->execute(['id' => $id]);
            $article = $before->fetch(PDO::FETCH_ASSOC);
            $statement = $pdo->prepare('DELETE FROM articles WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Article introuvable.');
            AuditLog::record('article.delete', 'article', $id, ['title' => $article['title'] ?? null]);

            // A deleted article that was live sends readers and search
            // engines to its category instead of a dead end — otherwise
            // stale links/search results 404 until the index catches up.
            if ($article && $article['status'] === 'published' && $article['category_slug'] !== null) {
                (new RedirectService())->record("/{$article['category_slug']}/{$article['slug']}", "/{$article['category_slug']}");
            }

            return ['message' => 'Article supprimé.'];
        });
    }

    /**
     * Fires a push notification to readers subscribed to this article's
     * category. Only ever called right after a status transitions INTO
     * "published" — never on ordinary edits of an already-published
     * article, which would otherwise re-notify readers on every typo fix.
     */
    private function notifyPublished(PDO $pdo, int $articleId): void
    {
        $statement = $pdo->prepare(
            'SELECT a.title, a.excerpt, a.slug, c.slug AS category_slug, c.name AS category_name, COALESCE(m.path, NULL) AS hero_image
             FROM articles a
             INNER JOIN categories c ON c.id = a.category_id
             LEFT JOIN media m ON m.id = a.hero_media_id
             WHERE a.id = :id LIMIT 1'
        );
        $statement->execute(['id' => $articleId]);
        $article = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$article) {
            return;
        }

        Push::notifyCategory($article['category_slug'], [
            'title' => $article['category_name'] . ' — ' . $article['title'],
            'body' => $article['excerpt'] ?? '',
            'url' => Config::url('/' . $article['category_slug'] . '/' . $article['slug']),
            'icon' => $article['hero_image'] ? Config::url($article['hero_image']) : Config::url('/assets/logo-header.png'),
        ]);
    }

    private function validate(array $input): array
    {
        $title = trim((string) ($input['title'] ?? ''));
        $body = trim((string) ($input['body'] ?? ''));
        $status = $input['status'] ?? 'draft';
        if (!in_array($status, self::STATUSES, true)) {
            throw new \InvalidArgumentException('Statut éditorial invalide.');
        }

        $categoryId = !empty($input['category_id']) ? (int) $input['category_id'] : null;
        $authorId = !empty($input['author_id']) ? (int) $input['author_id'] : null;
        $heroMediaId = !empty($input['hero_media_id']) ? (int) $input['hero_media_id'] : null;

        $contentMode = ($input['content_mode'] ?? 'classic') === 'builder' ? 'builder' : 'classic';
        $contentBlocksJson = $this->validateContentBlocks($input['content_blocks'] ?? null);
        $hasContent = $contentMode === 'builder' ? $contentBlocksJson !== null : $body !== '';

        $requiresComplete = in_array($status, ['published', 'scheduled'], true);
        if ($requiresComplete && ($title === '' || !$hasContent || $categoryId === null || $authorId === null)) {
            throw new \InvalidArgumentException('Titre, contenu, rubrique et auteur sont obligatoires pour publier ou programmer un article.');
        }

        $slug = trim((string) ($input['slug'] ?? ''));
        if ($slug === '') {
            $slug = $title !== '' ? $this->slugify($title) : 'brouillon-' . bin2hex(random_bytes(4));
        }
        $publishedAt = $input['published_at'] ?: null;
        if ($status === 'scheduled' && !$publishedAt) {
            throw new \InvalidArgumentException('Une date de programmation est requise.');
        }
        if ($status === 'published' && !$publishedAt) {
            $publishedAt = date('Y-m-d H:i:s');
        }

        return [
            'category_id' => $categoryId, 'author_id' => $authorId, 'hero_media_id' => $heroMediaId,
            'title' => $title !== '' ? $title : 'Brouillon sans titre', 'slug' => $slug, 'excerpt' => trim((string) ($input['excerpt'] ?? '')),
            'body' => $body, 'status' => $status, 'published_at' => $publishedAt,
            'meta_title' => trim((string) ($input['meta_title'] ?? '')) ?: null,
            'meta_description' => trim((string) ($input['meta_description'] ?? '')) ?: null,
            'canonical_url' => trim((string) ($input['canonical_url'] ?? '')) ?: null,
            'robots' => $input['robots'] ?? 'index,follow',
            'primary_keyword' => trim((string) ($input['primary_keyword'] ?? '')) ?: null,
            'secondary_keywords' => trim((string) ($input['secondary_keywords'] ?? '')) ?: null,
            'is_sponsored' => !empty($input['is_sponsored']) ? 1 : 0,
            'layout' => ($input['layout'] ?? 'standard') === 'magazine' ? 'magazine' : 'standard',
            'sidebar_mode' => ($input['sidebar_mode'] ?? 'default') === 'custom' ? 'custom' : 'default',
            'sidebar_blocks_json' => $this->validateSidebarBlocks($input['sidebar_blocks'] ?? null),
            'content_mode' => $contentMode,
            'content_blocks_json' => $contentBlocksJson,
        ];
    }

    /**
     * Same shape/guard as validateSidebarBlocks — see ContentBlocks for the
     * per-`type` rendering (and PublicController for the plain-text
     * extraction used for word count / reading time / SEO checks).
     */
    private function validateContentBlocks(mixed $blocks): ?string
    {
        if (!is_array($blocks) || $blocks === []) {
            return null;
        }
        foreach ($blocks as $block) {
            if (!is_array($block) || !isset($block['type']) || !is_string($block['type'])) {
                throw new \InvalidArgumentException('Bloc de contenu invalide.');
            }
        }
        return json_encode(array_values($blocks), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    /**
     * Accepts the builder's array of { type, props } widget instances as-is
     * (rendering validates/ignores unknown `type`s — see SidebarBlocks) and
     * just guards against a malformed payload before it's stored as JSON.
     */
    private function validateSidebarBlocks(mixed $blocks): ?string
    {
        if (!is_array($blocks) || $blocks === []) {
            return null;
        }
        foreach ($blocks as $block) {
            if (!is_array($block) || !isset($block['type']) || !is_string($block['type'])) {
                throw new \InvalidArgumentException('Bloc de barre latérale invalide.');
            }
        }
        return json_encode(array_values($blocks), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    private function validateTagIds(array $input, PDO $pdo): array
    {
        $ids = array_unique(array_map('intval', (array) ($input['tag_ids'] ?? [])));
        if ($ids === []) {
            return [];
        }
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $statement = $pdo->prepare("SELECT id FROM tags WHERE id IN ($placeholders)");
        $statement->execute(array_values($ids));
        $found = array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
        if (count($found) !== count($ids)) {
            throw new \InvalidArgumentException('Un ou plusieurs tags sélectionnés sont introuvables.');
        }
        return $found;
    }

    private function syncTags(PDO $pdo, int $articleId, array $tagIds): void
    {
        $pdo->prepare('DELETE FROM article_tags WHERE article_id = :id')->execute(['id' => $articleId]);
        if ($tagIds === []) {
            return;
        }
        $statement = $pdo->prepare('INSERT INTO article_tags (article_id, tag_id) VALUES (:article_id, :tag_id)');
        foreach ($tagIds as $tagId) {
            $statement->execute(['article_id' => $articleId, 'tag_id' => $tagId]);
        }
    }

    private function categorySlug(PDO $pdo, ?int $categoryId): ?string
    {
        if ($categoryId === null) {
            return null;
        }
        $statement = $pdo->prepare('SELECT slug FROM categories WHERE id = :id');
        $statement->execute(['id' => $categoryId]);
        $slug = $statement->fetchColumn();
        return $slug === false ? null : (string) $slug;
    }

    private function input(): array { return json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR); }
    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException $e) { $this->error($e->getCode() === '23000' ? 'Ce slug est déjà utilisé dans cette rubrique. Modifiez l’URL de l’article.' : 'Base de données indisponible. Exécutez les migrations et vérifiez .env.', $e->getCode() === '23000' ? 409 : 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
    private function slugify(string $value): string { return Slug::make($value); }
}
