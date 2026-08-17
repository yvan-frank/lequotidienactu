<?php
declare(strict_types=1);

namespace App\Support;

use PDO;
use PDOException;

final class Categories
{
    /**
     * Returns the full category tree: top-level categories, each carrying
     * its direct children under a `children` key.
     */
    public static function tree(): array
    {
        try {
            $rows = self::pdo()
                ->query('SELECT id, parent_id, name, slug, description FROM categories ORDER BY position, name')
                ->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException) {
            return [];
        }

        $byParent = [];
        foreach ($rows as $row) {
            $parentId = $row['parent_id'] !== null ? (int) $row['parent_id'] : 0;
            $byParent[$parentId][] = $row;
        }

        $build = static function (int $parentId) use (&$build, $byParent): array {
            $children = $byParent[$parentId] ?? [];
            return array_map(static function (array $row) use ($build): array {
                $row['children'] = $build((int) $row['id']);
                return $row;
            }, $children);
        };

        return $build(0);
    }

    /**
     * Most recent published article in this category or one of its direct
     * children, used to feature a pick in the header mega-menu.
     */
    public static function latestArticle(int $categoryId): ?array
    {
        try {
            $pdo = self::pdo();
            $ids = [$categoryId];
            $children = $pdo->prepare('SELECT id FROM categories WHERE parent_id = :id');
            $children->execute(['id' => $categoryId]);
            foreach ($children->fetchAll(PDO::FETCH_COLUMN) as $childId) {
                $ids[] = (int) $childId;
            }

            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $statement = $pdo->prepare("SELECT a.title, a.slug, c.slug AS category_slug FROM articles a INNER JOIN categories c ON c.id = a.category_id WHERE a.category_id IN ($placeholders) AND a.status = 'published' AND a.published_at <= NOW() ORDER BY a.published_at DESC LIMIT 1");
            $statement->execute($ids);
            $row = $statement->fetch(PDO::FETCH_ASSOC);
            return $row ?: null;
        } catch (PDOException) {
            return null;
        }
    }

    private static function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }
}
