<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use PDO;
use PDOException;

/**
 * Backs the internal-link search in the editor's link popover — lets an
 * editor type a title fragment and pick an article or page instead of
 * hand-typing its URL.
 */
final class AdminContentSearchController
{
    public function search(): void
    {
        AdminAuthController::requireStaff();
        $query = trim((string) ($_GET['q'] ?? ''));
        if (mb_strlen($query) < 2) {
            $this->json(['data' => []]);
            return;
        }

        try {
            $pdo = $this->pdo();
            $like = '%' . $query . '%';

            $articles = $pdo->prepare('SELECT a.title, a.status, CONCAT("/", c.slug, "/", a.slug) AS url FROM articles a INNER JOIN categories c ON c.id = a.category_id WHERE a.title LIKE :q ORDER BY a.updated_at DESC LIMIT 6');
            $articles->execute(['q' => $like]);
            $articleRows = array_map(
                static fn (array $row): array => ['type' => 'article', ...$row],
                $articles->fetchAll(PDO::FETCH_ASSOC),
            );

            $pages = $pdo->prepare('SELECT title, status, CONCAT("/", slug) AS url FROM pages WHERE title LIKE :q ORDER BY updated_at DESC LIMIT 6');
            $pages->execute(['q' => $like]);
            $pageRows = array_map(
                static fn (array $row): array => ['type' => 'page', ...$row],
                $pages->fetchAll(PDO::FETCH_ASSOC),
            );

            $this->json(['data' => array_slice([...$articleRows, ...$pageRows], 0, 8)]);
        } catch (PDOException) {
            $this->json(['data' => []]);
        }
    }

    private function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    private function json(array $data): void
    {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data);
    }
}
