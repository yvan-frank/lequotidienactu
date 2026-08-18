<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Mailer;
use App\Support\Settings;
use PDOException;

final class AdminSettingsController
{
    private const SEO_DEFAULTS = ['ga_measurement_id' => '', 'gsc_verification' => '', 'adsense_client' => ''];

    public function seo(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (): array {
            return ['data' => Settings::get('seo', self::SEO_DEFAULTS)];
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
            return ['data' => $data, 'message' => 'Paramètres SEO enregistrés.'];
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
