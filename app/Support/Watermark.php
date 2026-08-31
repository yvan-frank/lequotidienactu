<?php
declare(strict_types=1);

namespace App\Support;

/**
 * Overlays a mark image, small and semi-transparent, on an uploaded
 * image — wired into AdminMediaController::compress() so it applies
 * automatically to every new upload, and reused by the media library's
 * "Appliquer le filigrane" bulk action for images uploaded before it was
 * enabled. Fully configurable from the admin (Thème > Filigrane) via the
 * `watermark` Settings entry.
 */
final class Watermark
{
    private const DEFAULT_LOGO_PATH = __DIR__ . '/../../public/assets/logo-header.png';

    public const DEFAULTS = [
        'enabled' => true,
        'image_path' => null,
        /** Watermark width as a percent of the target image's width (5-50). */
        'width_percent' => 22,
        /** How visible the mark itself is once placed (1-100). */
        'opacity_percent' => 12,
        /** center | top-left | top-right | bottom-left | bottom-right */
        'position' => 'center',
    ];

    /** Pixels this bright or brighter in a non-transparent source are keyed to fully transparent. */
    private const WHITE_THRESHOLD = 220;

    public static function apply(\GdImage $image, int $width, int $height): void
    {
        $settings = self::settings();
        if (!$settings['enabled']) {
            return;
        }

        $sourcePath = self::resolveSourcePath($settings['image_path']);
        if ($sourcePath === null || !is_file($sourcePath)) {
            return;
        }
        $source = self::loadImage($sourcePath);
        if ($source === null) {
            return;
        }
        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);

        $widthRatio = max(5, min(50, (int) $settings['width_percent'])) / 100;
        $opacityPercent = max(1, min(100, (int) $settings['opacity_percent']));

        $targetWidth = max(1, (int) round($width * $widthRatio));
        $targetHeight = max(1, (int) round($sourceHeight * ($targetWidth / $sourceWidth)));
        if ($targetHeight > $height * $widthRatio) {
            $targetHeight = max(1, (int) round($height * $widthRatio));
            $targetWidth = max(1, (int) round($sourceWidth * ($targetHeight / $sourceHeight)));
        }

        $resized = imagecreatetruecolor($targetWidth, $targetHeight);
        imagealphablending($resized, false);
        imagesavealpha($resized, true);
        $transparent = imagecolorallocatealpha($resized, 0, 0, 0, 127);
        imagefill($resized, 0, 0, $transparent);
        imagealphablending($resized, true);
        imagecopyresampled($resized, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $sourceWidth, $sourceHeight);
        imagedestroy($source);

        $prepared = self::hasRealAlpha($resized, $targetWidth, $targetHeight)
            ? self::scaleAlpha($resized, $targetWidth, $targetHeight, $opacityPercent)
            : self::keyWhiteToTransparent($resized, $targetWidth, $targetHeight, $opacityPercent);
        imagedestroy($resized);

        [$x, $y] = self::position($settings['position'], $width, $height, $targetWidth, $targetHeight);

        imagealphablending($image, true);
        imagecopy($image, $prepared, $x, $y, 0, 0, $targetWidth, $targetHeight);
        imagedestroy($prepared);
    }

    /** @return array{enabled: bool, image_path: string|null, width_percent: int, opacity_percent: int, position: string} */
    public static function settings(): array
    {
        return array_merge(self::DEFAULTS, Settings::get('watermark', self::DEFAULTS));
    }

    /** Absolute filesystem path to whichever image currently renders the watermark. */
    public static function currentImagePath(): string
    {
        return self::resolveSourcePath(self::settings()['image_path']) ?? self::DEFAULT_LOGO_PATH;
    }

    private static function resolveSourcePath(?string $imagePath): ?string
    {
        if ($imagePath === null || $imagePath === '') {
            return self::DEFAULT_LOGO_PATH;
        }
        return dirname(__DIR__, 2) . '/public' . $imagePath;
    }

    private static function loadImage(string $path): ?\GdImage
    {
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($path) ?: '';
        $image = match ($mime) {
            'image/png' => @imagecreatefrompng($path),
            'image/webp' => function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($path) : false,
            'image/jpeg' => @imagecreatefromjpeg($path),
            default => false,
        };
        return $image !== false ? $image : null;
    }

    private static function position(string $position, int $imageWidth, int $imageHeight, int $markWidth, int $markHeight): array
    {
        $margin = max(8, (int) round(min($imageWidth, $imageHeight) * 0.03));
        return match ($position) {
            'top-left' => [$margin, $margin],
            'top-right' => [$imageWidth - $markWidth - $margin, $margin],
            'bottom-left' => [$margin, $imageHeight - $markHeight - $margin],
            'bottom-right' => [$imageWidth - $markWidth - $margin, $imageHeight - $markHeight - $margin],
            default => [(int) round(($imageWidth - $markWidth) / 2), (int) round(($imageHeight - $markHeight) / 2)],
        };
    }

    /** True if a meaningful share of sampled pixels are neither fully opaque nor fully transparent-free — i.e. this source already has real transparency to respect, e.g. a properly exported watermark PNG. */
    private static function hasRealAlpha(\GdImage $image, int $width, int $height): bool
    {
        $samples = 0;
        $transparentish = 0;
        for ($y = 0; $y < $height; $y += max(1, intdiv($height, 20))) {
            for ($x = 0; $x < $width; $x += max(1, intdiv($width, 20))) {
                $rgba = imagecolorat($image, $x, $y);
                $alpha = ($rgba >> 24) & 0x7F;
                $samples++;
                if ($alpha > 10) {
                    $transparentish++;
                }
            }
        }
        return $samples > 0 && ($transparentish / $samples) > 0.05;
    }

    /** Source already has usable transparency (a proper watermark asset) — just dial its existing alpha down to the configured opacity. */
    private static function scaleAlpha(\GdImage $source, int $width, int $height, int $opacityPercent): \GdImage
    {
        $out = imagecreatetruecolor($width, $height);
        imagealphablending($out, false);
        imagesavealpha($out, true);
        $factor = $opacityPercent / 100;

        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $rgba = imagecolorat($source, $x, $y);
                $alpha = ($rgba >> 24) & 0x7F;
                $r = ($rgba >> 16) & 0xFF;
                $g = ($rgba >> 8) & 0xFF;
                $b = $rgba & 0xFF;
                $opacity = (1 - $alpha / 127) * $factor;
                $newAlpha = (int) round(127 * (1 - $opacity));
                imagesetpixel($out, $x, $y, imagecolorallocatealpha($out, $r, $g, $b, max(0, min(127, $newAlpha))));
            }
        }

        return $out;
    }

    /**
     * Turns a flat (no real transparency) source's white background fully
     * transparent and dials the ink itself down to opacityPercent, blending
     * smoothly between the two by brightness instead of a hard cutout — a
     * binary keep/discard would leave jagged, aliased edges at the small
     * size this renders at.
     */
    private static function keyWhiteToTransparent(\GdImage $source, int $width, int $height, int $opacityPercent): \GdImage
    {
        $keyed = imagecreatetruecolor($width, $height);
        imagealphablending($keyed, false);
        imagesavealpha($keyed, true);
        $inkAlpha = (int) round(127 * (1 - $opacityPercent / 100));

        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $rgba = imagecolorat($source, $x, $y);
                $srcAlpha = ($rgba >> 24) & 0x7F;
                $r = ($rgba >> 16) & 0xFF;
                $g = ($rgba >> 8) & 0xFF;
                $b = $rgba & 0xFF;
                if ($srcAlpha >= 100) {
                    imagesetpixel($keyed, $x, $y, imagecolorallocatealpha($keyed, $r, $g, $b, 127));
                    continue;
                }
                $brightness = ($r + $g + $b) / 3;
                if ($brightness >= self::WHITE_THRESHOLD) {
                    $alpha = 127;
                } else {
                    $t = $brightness / self::WHITE_THRESHOLD;
                    $alpha = (int) round($inkAlpha + $t * (127 - $inkAlpha));
                }
                imagesetpixel($keyed, $x, $y, imagecolorallocatealpha($keyed, $r, $g, $b, $alpha));
            }
        }

        return $keyed;
    }
}
