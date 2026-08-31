<?php
declare(strict_types=1);

namespace App\Support;

/**
 * Overlays the site logo, small and semi-transparent, centered on an
 * uploaded image — wired into AdminMediaController::compress() so it
 * applies automatically to every new upload, and reused by the media
 * library's "Appliquer le filigrane" bulk action for images uploaded
 * before this existed (see AdminMediaController::watermarkAll()).
 *
 * The source logo (public/assets/logo-header.png) is a flat export with
 * no alpha channel — solid white background — so instead of requiring a
 * separate transparent asset, this keys near-white pixels out to
 * transparent itself, leaving just the red/black mark.
 */
final class Watermark
{
    private const LOGO_PATH = __DIR__ . '/../../public/assets/logo-header.png';

    /** Watermark width as a fraction of the target image's width. */
    private const WIDTH_RATIO = 0.22;

    /** How visible the mark itself is once placed — kept low to stay discreet. */
    private const OPACITY_PERCENT = 12;

    /** Pixels this bright or brighter in the source logo are keyed to fully transparent. */
    private const WHITE_THRESHOLD = 220;

    public static function apply(\GdImage $image, int $width, int $height): void
    {
        if (!is_file(self::LOGO_PATH)) {
            return;
        }
        $source = @imagecreatefrompng(self::LOGO_PATH);
        if ($source === false) {
            return;
        }
        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);

        $targetWidth = max(1, (int) round($width * self::WIDTH_RATIO));
        $targetHeight = max(1, (int) round($sourceHeight * ($targetWidth / $sourceWidth)));
        // Re-fit by height instead if the logo's aspect ratio would otherwise
        // make it taller than the same share of the image's height (a
        // near-square target photo with a wide logo, for example).
        if ($targetHeight > $height * self::WIDTH_RATIO) {
            $targetHeight = max(1, (int) round($height * self::WIDTH_RATIO));
            $targetWidth = max(1, (int) round($sourceWidth * ($targetHeight / $sourceHeight)));
        }

        $resized = imagecreatetruecolor($targetWidth, $targetHeight);
        imagecopyresampled($resized, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $sourceWidth, $sourceHeight);
        imagedestroy($source);

        $keyed = self::keyWhiteToTransparent($resized, $targetWidth, $targetHeight);
        imagedestroy($resized);

        $x = (int) round(($width - $targetWidth) / 2);
        $y = (int) round(($height - $targetHeight) / 2);

        imagealphablending($image, true);
        imagecopy($image, $keyed, $x, $y, 0, 0, $targetWidth, $targetHeight);
        imagedestroy($keyed);
    }

    /**
     * Turns the logo's white background fully transparent and dials the
     * ink itself down to OPACITY_PERCENT, blending smoothly between the
     * two by brightness instead of a hard cutout — a binary keep/discard
     * would leave jagged, aliased edges at the small size this renders at.
     */
    private static function keyWhiteToTransparent(\GdImage $source, int $width, int $height): \GdImage
    {
        $keyed = imagecreatetruecolor($width, $height);
        imagealphablending($keyed, false);
        imagesavealpha($keyed, true);
        $inkAlpha = (int) round(127 * (1 - self::OPACITY_PERCENT / 100));

        for ($y = 0; $y < $height; $y++) {
            for ($x = 0; $x < $width; $x++) {
                $rgb = imagecolorat($source, $x, $y);
                $r = ($rgb >> 16) & 0xFF;
                $g = ($rgb >> 8) & 0xFF;
                $b = $rgb & 0xFF;
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
