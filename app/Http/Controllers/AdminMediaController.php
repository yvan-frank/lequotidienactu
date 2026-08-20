<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\AuditLog;
use App\Support\Slug;
use PDO;
use PDOException;

final class AdminMediaController
{
    private const MAX_BYTES = 8_000_000;
    private const MAX_DIMENSION = 1920;
    private const WEBP_QUALITY = 72;
    private const JPEG_QUALITY = 78;
    private const PNG_COMPRESSION = 9;

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
        $altText = trim((string) ($_POST['alt_text'] ?? ''));
        $keywordSlug = $altText !== '' ? mb_substr(Slug::make($altText), 0, 60) : '';
        $filenamePrefix = $keywordSlug !== '' ? $keywordSlug : 'image';
        $filenameBase = $filenamePrefix . '-' . bin2hex(random_bytes(4));

        $compressed = $this->compress($file['tmp_name'], $mime, $size[0], $size[1], $directory, $filenameBase);
        if ($compressed !== null) {
            $path = $compressed['path'];
            $finalMime = $compressed['mime_type'];
            $finalWidth = $compressed['width'];
            $finalHeight = $compressed['height'];
            $bytes = $compressed['bytes'];
        } else {
            $extension = image_type_to_extension($size[2], false) ?: 'img';
            $path = '/uploads/' . $filenameBase . '.' . $extension;
            $destination = $directory . '/' . $filenameBase . '.' . $extension;
            if (!move_uploaded_file($file['tmp_name'], $destination)) {
                $this->json(['message' => 'Impossible d’enregistrer cette image.'], 500);
                return;
            }
            $finalMime = $mime;
            $finalWidth = $size[0];
            $finalHeight = $size[1];
            $bytes = @filesize($destination) ?: (int) $file['size'];
        }

        try {
            $pdo = $this->pdo();
            $statement = $pdo->prepare('INSERT INTO media (disk, path, mime_type, bytes, width, height, alt_text, credit) VALUES ("local", :path, :mime_type, :bytes, :width, :height, :alt_text, :credit)');
            $statement->execute(['path' => $path, 'mime_type' => $finalMime, 'bytes' => $bytes, 'width' => $finalWidth, 'height' => $finalHeight, 'alt_text' => $altText ?: null, 'credit' => trim((string) ($_POST['credit'] ?? '')) ?: null]);
            $this->json(['data' => ['id' => (int) $pdo->lastInsertId(), 'url' => $path, 'width' => $finalWidth, 'height' => $finalHeight]], 201);
        } catch (PDOException) {
            @unlink(dirname(__DIR__, 3) . '/public' . $path);
            $this->json(['message' => 'Base de données indisponible.'], 503);
        }
    }

    /**
     * Recompresses one already-stored image in place, through the same
     * WebP-first pipeline as new uploads — for images uploaded before GD
     * was enabled, before this endpoint existed, or that simply deserve a
     * second pass (e.g. a lossless PNG that only shrinks a little).
     */
    public function compressOne(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        if (!extension_loaded('gd')) {
            $this->json(['message' => 'L’extension GD n’est pas disponible sur ce serveur.'], 503);
            return;
        }

        $pdo = $this->pdo();
        $statement = $pdo->prepare('SELECT path, mime_type, bytes FROM media WHERE id = :id');
        $statement->execute(['id' => $id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            $this->json(['message' => 'Média introuvable.'], 404);
            return;
        }

        $publicRoot = dirname(__DIR__, 3) . '/public';
        $absolute = $publicRoot . $row['path'];
        $size = is_file($absolute) ? @getimagesize($absolute) : false;
        if ($size === false) {
            $this->json(['message' => 'Le fichier de cette image est introuvable sur le serveur.'], 404);
            return;
        }

        $directory = dirname($absolute);
        $filenameBase = pathinfo($row['path'], PATHINFO_FILENAME);
        $result = $this->compress($absolute, $row['mime_type'], $size[0], $size[1], $directory, $filenameBase);
        if ($result === null) {
            $this->json(['message' => 'Impossible de compresser cette image.'], 500);
            return;
        }

        $originalBytes = (int) $row['bytes'];
        if ($result['path'] !== $row['path'] && is_file($absolute)) {
            @unlink($absolute);
        }

        $update = $pdo->prepare('UPDATE media SET path = :path, mime_type = :mime_type, bytes = :bytes, width = :width, height = :height WHERE id = :id');
        $update->execute(['path' => $result['path'], 'mime_type' => $result['mime_type'], 'bytes' => $result['bytes'], 'width' => $result['width'], 'height' => $result['height'], 'id' => $id]);

        $this->json(['data' => [
            'id' => $id,
            'url' => $result['path'],
            'mime_type' => $result['mime_type'],
            'width' => $result['width'],
            'height' => $result['height'],
            'bytes_before' => $originalBytes,
            'bytes_after' => $result['bytes'],
            'bytes_saved' => max(0, $originalBytes - $result['bytes']),
        ], 'message' => 'Image compressée.']);
    }

    /**
     * Resizes down to MAX_DIMENSION and re-encodes as lossy WebP — the
     * single biggest win over the source format, since a lossless PNG of a
     * photo barely shrinks no matter how hard it's squeezed, while WebP at
     * this quality is routinely 3-5x smaller than the same shot as PNG and
     * meaningfully smaller than an equivalent JPEG. Falls back to
     * re-encoding in the original format if WebP isn't available, and to
     * null (caller keeps the untouched upload) if GD or the source format
     * isn't supported at all — compression is a nice-to-have, never a
     * reason to fail an upload.
     *
     * @return array{path: string, mime_type: string, width: int, height: int, bytes: int}|null
     */
    private function compress(string $sourcePath, string $mimeType, int $width, int $height, string $directory, string $filenameBase): ?array
    {
        if (!extension_loaded('gd')) {
            return null;
        }

        $image = match ($mimeType) {
            'image/jpeg' => @imagecreatefromjpeg($sourcePath),
            'image/png' => @imagecreatefrompng($sourcePath),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($sourcePath) : false,
            default => false,
        };
        if ($image === false) {
            return null;
        }

        if ($width > self::MAX_DIMENSION || $height > self::MAX_DIMENSION) {
            $ratio = min(self::MAX_DIMENSION / $width, self::MAX_DIMENSION / $height);
            $targetWidth = max(1, (int) round($width * $ratio));
            $targetHeight = max(1, (int) round($height * $ratio));
            $resized = imagecreatetruecolor($targetWidth, $targetHeight);
            imagealphablending($resized, false);
            imagesavealpha($resized, true);
            imagecopyresampled($resized, $image, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
            imagedestroy($image);
            $image = $resized;
            $width = $targetWidth;
            $height = $targetHeight;
        }

        $useWebp = function_exists('imagewebp');
        $extension = $useWebp ? 'webp' : ($mimeType === 'image/png' ? 'png' : 'jpg');
        $outMime = $useWebp ? 'image/webp' : ($mimeType === 'image/png' ? 'image/png' : 'image/jpeg');
        $destination = $directory . '/' . $filenameBase . '.' . $extension;

        if ($useWebp) {
            imagealphablending($image, false);
            imagesavealpha($image, true);
            $saved = imagewebp($image, $destination, self::WEBP_QUALITY);
        } elseif ($mimeType === 'image/png') {
            $saved = imagepng($image, $destination, self::PNG_COMPRESSION);
        } else {
            $saved = imagejpeg($image, $destination, self::JPEG_QUALITY);
        }
        imagedestroy($image);
        if (!$saved) {
            return null;
        }

        clearstatcache(true, $destination);
        return [
            'path' => '/uploads/' . $filenameBase . '.' . $extension,
            'mime_type' => $outMime,
            'width' => $width,
            'height' => $height,
            'bytes' => filesize($destination) ?: 0,
        ];
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

    public function delete(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        try {
            $pdo = $this->pdo();
            $statement = $pdo->prepare('SELECT path FROM media WHERE id = :id');
            $statement->execute(['id' => $id]);
            $path = $statement->fetchColumn();
            if ($path === false) {
                $this->json(['message' => 'Média introuvable.'], 404);
                return;
            }
            $pdo->prepare('DELETE FROM media WHERE id = :id')->execute(['id' => $id]);
            $absolute = dirname(__DIR__, 3) . '/public' . $path;
            if (is_file($absolute)) {
                @unlink($absolute);
            }
            AuditLog::record('media.delete', 'media', $id);
            $this->json(['message' => 'Média supprimé.']);
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
