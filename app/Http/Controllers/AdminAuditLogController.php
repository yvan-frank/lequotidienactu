<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use PDO;
use PDOException;

final class AdminAuditLogController
{
    public function index(): void
    {
        AdminAuthController::requireStaff(['admin']);
        try {
            $pdo = $this->pdo();
            $action = trim((string) ($_GET['action'] ?? ''));
            $sql = 'SELECT id, user_id, user_name, action, entity_type, entity_id, details, ip_address, created_at FROM audit_logs';
            $params = [];
            if ($action !== '') {
                $sql .= ' WHERE action LIKE :action';
                $params['action'] = $action . '%';
            }
            $sql .= ' ORDER BY created_at DESC LIMIT 200';
            $statement = $pdo->prepare($sql);
            $statement->execute($params);
            $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as &$row) {
                $row['details'] = $row['details'] !== null ? json_decode((string) $row['details'], true) : null;
            }
            unset($row);

            http_response_code(200);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode(['data' => $rows], JSON_THROW_ON_ERROR);
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
