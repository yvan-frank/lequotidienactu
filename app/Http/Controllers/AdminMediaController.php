<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Slug;
use PDO;
use PDOException;

final class AdminMediaController
{
    private const MAX_BYTES = 8_000_000;

    public function index(): void
    {
        AdminAuthController::requireStaff();
        try {
            $rows = $this->pdo()->query('SELECT id, path AS url, mime_type, bytes, width, height, alt_text, credit, created_at FROM media WHERE mime_type LIKE "image/%" ORDER BY created_at DESC, id DESC LIMIT 120')->fetchAll(PDO::FETCH_ASSOC);
            $this->json(['data' => $rows]);
        } catch (PDOException) {
            $this->json(['message' => 'Base de données indisponible.'], 503);
        }
    }

    public function upload(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor', 'author']);
        $file = $_FILES['file'] ?? null;
        if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
            $this->json(['message' => 'Une image de couverture est requise.'], 422);
            return;
        }
        if ($file['size'] > self::MAX_BYTES) {
            $this->json(['message' => 'L’image ne doit pas dépasser 8 Mo.'], 422);
            return;
        }

        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']) ?: '';
        if (!str_starts_with($mime, 'image/')) {
            $this->json(['message' => 'Le fichier doit être une image.'], 422);
            return;
        }
        $size = getimagesize($file['tmp_name']);
        if ($size === false) {
            $this->json(['message' => 'Le fichier transmis n’est pas une image valide.'], 422);
            return;
        }

        $directory = dirname(__DIR__, 3) . '/public/uploads';
        if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
            $this->json(['message' => 'Le dossier de médias est indisponible.'], 500);
            return;
        }
        $extension = image_type_to_extension($size[2], false) ?: 'img';
        $altText = trim((string) ($_POST['alt_text'] ?? ''));
        $keywordSlug = $altText !== '' ? mb_substr(Slug::make($altText), 0, 60) : '';
        $filenamePrefix = $keywordSlug !== '' ? $keywordSlug : 'image';
        $filename = $filenamePrefix . '-' . bin2hex(random_bytes(4)) . '.' . $extension;
        if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $filename)) {
            $this->json(['message' => 'Impossible d’enregistrer cette image.'], 500);
            return;
        }

        try {
            $path = '/uploads/' . $filename;
            $pdo = $this->pdo();
            $statement = $pdo->prepare('INSERT INTO media (disk, path, mime_type, bytes, width, height, alt_text, credit) VALUES ("local", :path, :mime_type, :bytes, :width, :height, :alt_text, :credit)');
            $statement->execute(['path' => $path, 'mime_type' => $mime, 'bytes' => (int) $file['size'], 'width' => $size[0], 'height' => $size[1], 'alt_text' => trim((string) ($_POST['alt_text'] ?? '')) ?: null, 'credit' => trim((string) ($_POST['credit'] ?? '')) ?: null]);
            $this->json(['data' => ['id' => (int) $pdo->lastInsertId(), 'url' => $path, 'width' => $size[0], 'height' => $size[1]]], 201);
        } catch (PDOException) {
            @unlink($directory . '/' . $filename);
            $this->json(['message' => 'Base de données indisponible.'], 503);
        }
    }

    public function update(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor', 'author']);
        $input = json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR);
        $altText = trim((string) ($input['alt_text'] ?? '')) ?: null;
        $credit = trim((string) ($input['credit'] ?? '')) ?: null;
        try {
            $statement = $this->pdo()->prepare('UPDATE media SET alt_text = :alt_text, credit = :credit WHERE id = :id');
            $statement->execute(['alt_text' => $altText, 'credit' => $credit, 'id' => $id]);
            if ($statement->rowCount() === 0) {
                $exists = $this->pdo()->prepare('SELECT 1 FROM media WHERE id = :id');
                $exists->execute(['id' => $id]);
                if (!$exists->fetchColumn()) {
                    $this->json(['message' => 'Média introuvable.'], 404);
                    return;
                }
            }
            $this->json(['message' => 'Texte alternatif mis à jour.']);
        } catch (PDOException) {
            $this->json(['message' => 'Base de données indisponible.'], 503);
        }
    }

    private function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    private function json(array $data, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data);
    }
}
