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
    private const JPEG_QUALITY = 82;
    private const WEBP_QUALITY = 82;
    private const PNG_COMPRESSION = 6;

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

    /**
     * Retroactively compresses every already-stored image through the same
     * GD pipeline as new uploads — for images stored before GD was enabled,
     * or before this endpoint existed. Skips anything GD can't decode (or a
     * file already missing from disk) rather than failing the whole batch.
     */
    public function compressExisting(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        if (!extension_loaded('gd')) {
            $this->json(['message' => 'L’extension GD n’est pas disponible sur ce serveur.'], 503);
            return;
        }

        $pdo = $this->pdo();
        $rows = $pdo->query('SELECT id, path, mime_type, bytes FROM media WHERE mime_type LIKE "image/%"')->fetchAll(PDO::FETCH_ASSOC);
        $publicRoot = dirname(__DIR__, 3) . '/public';
        $update = $pdo->prepare('UPDATE media SET bytes = :bytes, width = :width, height = :height WHERE id = :id');

        $compressed = 0;
        $skipped = 0;
        $bytesBefore = 0;
        $bytesAfter = 0;

        foreach ($rows as $row) {
            $absolute = $publicRoot . $row['path'];
            $originalBytes = (int) $row['bytes'];
            $size = is_file($absolute) ? @getimagesize($absolute) : false;
            if ($size === false) {
                $skipped++;
                continue;
            }
            $result = $this->compress($absolute, $absolute, $row['mime_type'], $size[0], $size[1]);
            if ($result === null) {
                $skipped++;
                continue;
            }
            [$width, $height] = $result;
            // filesize() caches by path; without clearing it here it would still
            // report the pre-compression size we just overwrote on disk.
            clearstatcache(true, $absolute);
            $newBytes = @filesize($absolute) ?: $originalBytes;
            $update->execute(['bytes' => $newBytes, 'width' => $width, 'height' => $height, 'id' => $row['id']]);
            $compressed++;
            $bytesBefore += $originalBytes;
            $bytesAfter += $newBytes;
        }

        $this->json(['data' => [
            'compressed' => $compressed,
            'skipped' => $skipped,
            'bytes_before' => $bytesBefore,
            'bytes_after' => $bytesAfter,
            'bytes_saved' => max(0, $bytesBefore - $bytesAfter),
        ]]);
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
        $destination = $directory . '/' . $filename;

        $compressed = $this->compress($file['tmp_name'], $destination, $mime, $size[0], $size[1]);
        if ($compressed !== null) {
            [$finalWidth, $finalHeight] = $compressed;
        } elseif (move_uploaded_file($file['tmp_name'], $destination)) {
            [$finalWidth, $finalHeight] = [$size[0], $size[1]];
        } else {
            $this->json(['message' => 'Impossible d’enregistrer cette image.'], 500);
            return;
        }

        try {
            $path = '/uploads/' . $filename;
            $bytes = @filesize($destination) ?: (int) $file['size'];
            $pdo = $this->pdo();
            $statement = $pdo->prepare('INSERT INTO media (disk, path, mime_type, bytes, width, height, alt_text, credit) VALUES ("local", :path, :mime_type, :bytes, :width, :height, :alt_text, :credit)');
            $statement->execute(['path' => $path, 'mime_type' => $mime, 'bytes' => $bytes, 'width' => $finalWidth, 'height' => $finalHeight, 'alt_text' => trim((string) ($_POST['alt_text'] ?? '')) ?: null, 'credit' => trim((string) ($_POST['credit'] ?? '')) ?: null]);
            $this->json(['data' => ['id' => (int) $pdo->lastInsertId(), 'url' => $path, 'width' => $finalWidth, 'height' => $finalHeight]], 201);
        } catch (PDOException) {
            @unlink($destination);
            $this->json(['message' => 'Base de données indisponible.'], 503);
        }
    }

    /**
     * Resizes down to MAX_DIMENSION and re-encodes at a lossy quality to
     * shrink file size, writing straight to $destination. Returns null (and
     * leaves $destination untouched) whenever GD or the source format isn't
     * supported, so the caller falls back to a plain move_uploaded_file —
     * compression is a nice-to-have, never a reason to fail an upload.
     *
     * @return array{0: int, 1: int}|null [width, height] actually written
     */
    private function compress(string $tmpPath, string $destination, string $mime, int $width, int $height): ?array
    {
        if (!extension_loaded('gd')) {
            return null;
        }

        $image = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($tmpPath),
            'image/png' => @imagecreatefrompng($tmpPath),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($tmpPath) : false,
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
            if ($mime === 'image/png' || $mime === 'image/webp') {
                imagealphablending($resized, false);
                imagesavealpha($resized, true);
            }
            imagecopyresampled($resized, $image, 0, 0, 0, 0, $targetWidth, $targetHeight, $width, $height);
            imagedestroy($image);
            $image = $resized;
            $width = $targetWidth;
            $height = $targetHeight;
        }

        $saved = match ($mime) {
            'image/jpeg' => imagejpeg($image, $destination, self::JPEG_QUALITY),
            'image/png' => imagepng($image, $destination, self::PNG_COMPRESSION),
            'image/webp' => function_exists('imagewebp') ? imagewebp($image, $destination, self::WEBP_QUALITY) : false,
            default => false,
        };
        imagedestroy($image);

        return $saved ? [$width, $height] : null;
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
