<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\AuditLog;
use App\Support\Mailer;
use App\Support\RateLimits;
use App\Support\Settings;
use PDOException;

final class AdminSettingsController
{
    private const SEO_DEFAULTS = ['ga_measurement_id' => '', 'gsc_verification' => '', 'adsense_client' => ''];
    private const GENERAL_DEFAULTS = [
        'tagline' => '',
        'contact_email' => '',
        'twitter_url' => '',
        'facebook_url' => '',
        'instagram_url' => '',
        'linkedin_url' => '',
    ];
    private const REVENUE_DEFAULTS = ['cpm' => 0, 'cpc' => 0];
    private const HEAD_CODE_DEFAULTS = ['head_html' => ''];
    private const HEAD_CODE_MAX_LENGTH = 20000;

    public function seo(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (): array {
            return ['data' => Settings::get('seo', self::SEO_DEFAULTS)];
        });
    }

    public function general(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (): array {
            return ['data' => Settings::get('general', self::GENERAL_DEFAULTS)];
        });
    }

    public function updateGeneral(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (): array {
            $input = json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR);
            $tagline = trim((string) ($input['tagline'] ?? ''));
            $contactEmail = trim((string) ($input['contact_email'] ?? ''));
            if ($contactEmail !== '' && !filter_var($contactEmail, FILTER_VALIDATE_EMAIL)) {
                throw new \InvalidArgumentException('Adresse e-mail de contact invalide.');
            }
            $urls = [];
            foreach (['twitter_url', 'facebook_url', 'instagram_url', 'linkedin_url'] as $field) {
                $value = trim((string) ($input[$field] ?? ''));
                if ($value !== '' && !filter_var($value, FILTER_VALIDATE_URL)) {
                    throw new \InvalidArgumentException('Une des URL de réseau social est invalide.');
                }
                $urls[$field] = $value;
            }

            $data = ['tagline' => $tagline, 'contact_email' => $contactEmail, ...$urls];
            Settings::set('general', $data);
            AuditLog::record('settings.update', 'settings', null, ['group' => 'general']);
            return ['data' => $data, 'message' => 'Paramètres généraux enregistrés.'];
        });
    }

    public function revenue(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (): array {
            return ['data' => Settings::get('revenue', self::REVENUE_DEFAULTS)];
        });
    }

    public function updateRevenue(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (): array {
            $input = json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR);
            $cpm = (float) ($input['cpm'] ?? 0);
            $cpc = (float) ($input['cpc'] ?? 0);
            if ($cpm < 0 || $cpc < 0) {
                throw new \InvalidArgumentException('Les valeurs doivent être positives.');
            }

            $data = ['cpm' => $cpm, 'cpc' => $cpc];
            Settings::set('revenue', $data);
            AuditLog::record('settings.update', 'settings', null, ['group' => 'revenue']);
            return ['data' => $data, 'message' => 'Paramètres de revenus enregistrés.'];
        });
    }

    public function updateSeo(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (): array {
            $input = json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR);
            $gaId = trim((string) ($input['ga_measurement_id'] ?? ''));
            $gscCode = trim((string) ($input['gsc_verification'] ?? ''));
            $adsenseClient = trim((string) ($input['adsense_client'] ?? ''));

            if ($gaId !== '' && !preg_match('/^(G|UA|GT)-[A-Za-z0-9-]+$/', $gaId)) {
                throw new \InvalidArgumentException('Identifiant Google Analytics invalide (format attendu : G-XXXXXXX).');
            }
            if (mb_strlen($gscCode) > 255) {
                throw new \InvalidArgumentException('Code de vérification Google Search Console trop long.');
            }
            if ($adsenseClient !== '' && !preg_match('/^ca-pub-\d{10,20}$/', $adsenseClient)) {
                throw new \InvalidArgumentException('Identifiant AdSense invalide (format attendu : ca-pub-XXXXXXXXXXXXXXXX).');
            }

            $data = ['ga_measurement_id' => $gaId, 'gsc_verification' => $gscCode, 'adsense_client' => $adsenseClient];
            Settings::set('seo', $data);
            AuditLog::record('settings.update', 'settings', null, ['group' => 'seo']);
            return ['data' => $data, 'message' => 'Paramètres SEO enregistrés.'];
        });
    }

    public function rateLimits(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (): array {
            $overrides = Settings::get('rate_limits', []);
            $data = [];
            foreach (RateLimits::DEFAULTS as $bucket => $meta) {
                $override = $overrides[$bucket] ?? null;
                $isOverridden = is_array($override) && !empty($override['max_attempts']) && !empty($override['window_seconds']);
                $data[] = [
                    'bucket' => $bucket,
                    'label' => $meta['label'],
                    'description' => $meta['description'],
                    'max_attempts' => $isOverridden ? (int) $override['max_attempts'] : $meta['max_attempts'],
                    'window_seconds' => $isOverridden ? (int) $override['window_seconds'] : $meta['window_seconds'],
                    'default_max_attempts' => $meta['max_attempts'],
                    'default_window_seconds' => $meta['window_seconds'],
                    'is_overridden' => $isOverridden,
                ];
            }
            return ['data' => $data];
        });
    }

    public function updateRateLimits(): void
    {
        AdminAuthController::requireStaff(['admin']);
        $this->respond(function (): array {
            $input = json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR);
            $buckets = is_array($input['buckets'] ?? null) ? $input['buckets'] : [];
            $overrides = [];
            foreach ($buckets as $bucket => $values) {
                if (!array_key_exists($bucket, RateLimits::DEFAULTS) || !is_array($values)) {
                    continue;
                }
                $maxAttempts = (int) ($values['max_attempts'] ?? 0);
                $windowSeconds = (int) ($values['window_seconds'] ?? 0);
                if ($maxAttempts < 1 || $maxAttempts > 100000) {
                    throw new \InvalidArgumentException(RateLimits::DEFAULTS[$bucket]['label'] . ' : le nombre de tentatives doit être compris entre 1 et 100 000.');
                }
                if ($windowSeconds < 1 || $windowSeconds > 604800) {
                    throw new \InvalidArgumentException(RateLimits::DEFAULTS[$bucket]['label'] . ' : la fenêtre doit être comprise entre 1 seconde et 7 jours (604 800 s).');
                }
                $default = RateLimits::DEFAULTS[$bucket];
                if ($maxAttempts === $default['max_attempts'] && $windowSeconds === $default['window_seconds']) {
                    continue; // matches the default — no need to store an override for it
                }
                $overrides[$bucket] = ['max_attempts' => $maxAttempts, 'window_seconds' => $windowSeconds];
            }

            Settings::set('rate_limits', $overrides);
            AuditLog::record('settings.update', 'settings', null, ['group' => 'rate_limits']);
            return ['message' => 'Limites de requêtes enregistrées.'];
        });
    }

    public function headCode(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (): array {
            return ['data' => Settings::get('head_code', self::HEAD_CODE_DEFAULTS)];
        });
    }

    public function updateHeadCode(): void
    {
        AdminAuthController::requireStaff(['admin']);
        $this->respond(function (): array {
            $input = json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR);
            $headHtml = trim((string) ($input['head_html'] ?? ''));
            if (mb_strlen($headHtml) > self::HEAD_CODE_MAX_LENGTH) {
                throw new \InvalidArgumentException('Le code dépasse la taille maximale autorisée (' . self::HEAD_CODE_MAX_LENGTH . ' caractères).');
            }

            $data = ['head_html' => $headHtml];
            Settings::set('head_code', $data);
            AuditLog::record('settings.update', 'settings', null, ['group' => 'head_code']);
            return ['data' => $data, 'message' => 'Code personnalisé enregistré.'];
        });
    }

    public function testMail(): void
    {
        AdminAuthController::requireStaff(['admin']);
        $this->respond(function (): array {
            $input = json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR);
            $to = filter_var(trim((string) ($input['to'] ?? '')), FILTER_VALIDATE_EMAIL);
            if (!$to) {
                throw new \InvalidArgumentException('Adresse e-mail de destination invalide.');
            }

            $appName = $_ENV['APP_NAME'] ?? 'Le Quotidien Actu';
            $result = Mailer::send(
                $to,
                $to,
                'Test SMTP — ' . $appName,
                "Ceci est un e-mail de test envoyé depuis l’administration de {$appName}.\n\nSi vous le recevez, la configuration SMTP fonctionne correctement.\n"
            );

            if (!$result['success']) {
                throw new \RuntimeException($result['error'] ?? 'Échec de l’envoi, raison inconnue.');
            }

            return ['message' => 'E-mail de test envoyé à ' . $to . '.'];
        });
    }

    private function respond(callable $operation, int $success = 200): void
    {
        try {
            http_response_code($success);
            header('Content-Type: application/json; charset=utf-8');
            echo json_encode($operation(), JSON_THROW_ON_ERROR);
        } catch (\InvalidArgumentException $e) {
            $this->error($e->getMessage(), 422);
        } catch (PDOException) {
            $this->error('Base de données indisponible.', 503);
        } catch (\Throwable $e) {
            $this->error($e->getMessage(), 500);
        }
    }

    private function error(string $message, int $status): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['message' => $message]);
    }
}
