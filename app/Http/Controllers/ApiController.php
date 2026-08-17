<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\RateLimiter;
use App\Support\TooManyAttemptsException;
use PDO;
use PDOException;

final class ApiController
{
    private const REACTION_TYPES = ['like', 'love', 'clap', 'insightful'];

    public function articles(): void
    {
        $this->respond(function (PDO $pdo): array {
            $page = max(1, (int) ($_GET['page'] ?? 1));
            $perPage = 12;
            $offset = ($page - 1) * $perPage;
            $statement = $pdo->prepare('SELECT a.id, a.title, a.slug, a.excerpt, c.slug AS category, c.name AS category_name, m.path AS hero_image FROM articles a INNER JOIN categories c ON c.id = a.category_id LEFT JOIN media m ON m.id = a.hero_media_id WHERE a.status = "published" AND a.published_at <= NOW() ORDER BY a.published_at DESC LIMIT :limit OFFSET :offset');
            $statement->bindValue(':limit', $perPage, PDO::PARAM_INT);
            $statement->bindValue(':offset', $offset, PDO::PARAM_INT);
            $statement->execute();
            return ['data' => $statement->fetchAll(PDO::FETCH_ASSOC), 'meta' => ['page' => $page, 'per_page' => $perPage]];
        });
    }

    public function search(): void
    {
        $this->respond(function (PDO $pdo): array {
            $query = trim((string) ($_GET['q'] ?? ''));
            if (mb_strlen($query) < 2) {
                return ['data' => [], 'query' => $query];
            }
            $statement = $pdo->prepare('SELECT a.title, a.slug, a.excerpt, c.slug AS category, c.name AS category_name, m.path AS hero_image FROM articles a INNER JOIN categories c ON c.id = a.category_id LEFT JOIN media m ON m.id = a.hero_media_id WHERE a.status = "published" AND a.published_at <= NOW() AND (a.title LIKE :q OR a.excerpt LIKE :q) ORDER BY a.published_at DESC LIMIT 8');
            $statement->execute(['q' => '%' . $query . '%']);
            return ['data' => $statement->fetchAll(PDO::FETCH_ASSOC), 'query' => $query];
        });
    }

    public function subscribe(): void
    {
        $this->respond(function (PDO $pdo): array {
            if ((new RateLimiter($pdo))->tooManyAttempts('newsletter', 5, 3600)) {
                throw new TooManyAttemptsException('Trop de tentatives. Réessayez dans quelques minutes.');
            }
            $input = $this->input();
            $email = filter_var(trim((string) ($input['email'] ?? '')), FILTER_VALIDATE_EMAIL);
            if (!$email) {
                throw new \InvalidArgumentException('Adresse e-mail invalide.');
            }
            $statement = $pdo->prepare('INSERT INTO newsletter_subscribers (email, status) VALUES (:email, "pending") ON DUPLICATE KEY UPDATE email = email');
            $statement->execute(['email' => $email]);
            return ['message' => 'Merci ! Vérifiez votre boîte mail pour confirmer votre inscription.'];
        }, 201);
    }

    public function reactions(int $articleId): void
    {
        $this->respond(function (PDO $pdo) use ($articleId): array {
            return ['data' => $this->reactionCounts($pdo, $articleId)];
        });
    }

    public function react(int $articleId): void
    {
        $this->respond(function (PDO $pdo) use ($articleId): array {
            if ((new RateLimiter($pdo))->tooManyAttempts('reaction', 20, 300)) {
                throw new TooManyAttemptsException('Trop de réactions envoyées. Réessayez dans quelques minutes.');
            }
            $input = $this->input();
            $type = trim((string) ($input['type'] ?? ''));
            if (!in_array($type, self::REACTION_TYPES, true)) {
                throw new \InvalidArgumentException('Type de réaction invalide.');
            }
            $this->assertPublished($pdo, $articleId);
            $statement = $pdo->prepare('INSERT INTO reactions (article_id, type) VALUES (:id, :type)');
            $statement->execute(['id' => $articleId, 'type' => $type]);
            return ['data' => $this->reactionCounts($pdo, $articleId)];
        }, 201);
    }

    public function comments(int $articleId): void
    {
        $this->respond(function (PDO $pdo) use ($articleId): array {
            $statement = $pdo->prepare('SELECT id, author_name, body, created_at FROM comments WHERE article_id = :id AND status = "approved" ORDER BY created_at DESC');
            $statement->execute(['id' => $articleId]);
            return ['data' => $statement->fetchAll(PDO::FETCH_ASSOC)];
        });
    }

    public function postComment(int $articleId): void
    {
        $this->respond(function (PDO $pdo) use ($articleId): array {
            if ((new RateLimiter($pdo))->tooManyAttempts('comment', 5, 600)) {
                throw new TooManyAttemptsException('Trop de commentaires envoyés. Réessayez dans quelques minutes.');
            }
            $input = $this->input();
            $author = trim((string) ($input['author_name'] ?? ''));
            $body = trim((string) ($input['body'] ?? ''));
            if ($author === '' || $body === '') {
                throw new \InvalidArgumentException('Votre nom et votre commentaire sont obligatoires.');
            }
            if (mb_strlen($body) > 2000) {
                throw new \InvalidArgumentException('Commentaire trop long (2000 caractères maximum).');
            }
            $this->assertPublished($pdo, $articleId);
            $statement = $pdo->prepare('INSERT INTO comments (article_id, author_name, body, status) VALUES (:id, :author, :body, "pending")');
            $statement->execute(['id' => $articleId, 'author' => mb_substr($author, 0, 120), 'body' => $body]);
            return ['message' => 'Merci ! Votre commentaire est en attente de modération.'];
        }, 201);
    }

    public function adClick(int $adId): void
    {
        $this->respond(function (PDO $pdo) use ($adId): array {
            if ((new RateLimiter($pdo))->tooManyAttempts('ad-click', 30, 60)) {
                throw new TooManyAttemptsException('Trop de requêtes. Réessayez dans un instant.');
            }
            $statement = $pdo->prepare('UPDATE advertisements SET clicks = clicks + 1 WHERE id = :id');
            $statement->execute(['id' => $adId]);
            return ['message' => 'ok'];
        });
    }

    private function reactionCounts(PDO $pdo, int $articleId): array
    {
        $statement = $pdo->prepare('SELECT type, COUNT(*) AS total FROM reactions WHERE article_id = :id GROUP BY type');
        $statement->execute(['id' => $articleId]);
        $counts = array_fill_keys(self::REACTION_TYPES, 0);
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $counts[$row['type']] = (int) $row['total'];
        }
        return $counts;
    }

    private function assertPublished(PDO $pdo, int $articleId): void
    {
        $statement = $pdo->prepare('SELECT 1 FROM articles WHERE id = :id AND status = "published"');
        $statement->execute(['id' => $articleId]);
        if (!$statement->fetchColumn()) {
            throw new \InvalidArgumentException('Article introuvable.');
        }
    }

    private function input(): array { return json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR) ?? []; }
    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (TooManyAttemptsException $e) { $this->error($e->getMessage(), 429); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException) { $this->error('Base de données indisponible.', 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
}
