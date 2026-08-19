<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Settings;
use PDO;
use PDOException;

final class AdminDashboardController
{
    public function stats(): void
    {
        AdminAuthController::requireStaff();
        try {
            $pdo = $this->pdo();
            $publishedArticles = (int) $pdo->query('SELECT COUNT(*) FROM articles WHERE status = "published"')->fetchColumn();
            $activeSubscribers = (int) $pdo->query('SELECT COUNT(*) FROM newsletter_subscribers WHERE status = "active"')->fetchColumn();
            $pendingComments = (int) $pdo->query('SELECT COUNT(*) FROM comments WHERE status = "pending"')->fetchColumn();
            $recentArticles = $pdo->query(
                'SELECT a.id, a.title, a.status, a.updated_at, c.name AS category_name
                 FROM articles a LEFT JOIN categories c ON c.id = a.category_id
                 ORDER BY a.updated_at DESC LIMIT 5'
            )->fetchAll(PDO::FETCH_ASSOC);
            $totalViews = (int) $pdo->query('SELECT COALESCE(SUM(views_count), 0) FROM articles')->fetchColumn();
            $popularArticles = $pdo->query(
                'SELECT a.id, a.title, a.views_count, c.name AS category_name
                 FROM articles a LEFT JOIN categories c ON c.id = a.category_id
                 WHERE a.status = "published" AND a.views_count > 0
                 ORDER BY a.views_count DESC LIMIT 5'
            )->fetchAll(PDO::FETCH_ASSOC);

            $adTotals = $pdo->query('SELECT COALESCE(SUM(impressions), 0) AS impressions, COALESCE(SUM(clicks), 0) AS clicks FROM advertisements')->fetch(PDO::FETCH_ASSOC);
            $revenueSettings = Settings::get('revenue', ['cpm' => 0, 'cpc' => 0]);
            $cpm = (float) ($revenueSettings['cpm'] ?? 0);
            $cpc = (float) ($revenueSettings['cpc'] ?? 0);
            $estimatedRevenue = round((((int) $adTotals['impressions']) / 1000) * $cpm + ((int) $adTotals['clicks']) * $cpc, 2);

            http_response_code(200);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode([
                'data' => [
                    'published_articles' => $publishedArticles,
                    'active_subscribers' => $activeSubscribers,
                    'pending_comments' => $pendingComments,
                    'recent_articles' => $recentArticles,
                    'total_views' => $totalViews,
                    'popular_articles' => $popularArticles,
                    'revenue' => [
                        'estimated_total' => $estimatedRevenue,
                        'ad_impressions' => (int) $adTotals['impressions'],
                        'ad_clicks' => (int) $adTotals['clicks'],
                        'configured' => $cpm > 0 || $cpc > 0,
                    ],
                ],
            ], JSON_THROW_ON_ERROR);
        } catch (PDOException) {
            http_response_code(503);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['message' => 'Base de données indisponible.']);
        }
    }

    private function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }
}
