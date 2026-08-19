<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\AuditLog;
use App\Support\Config;
use App\Support\Mailer;
use PDO;
use PDOException;

final class AdminNewsletterController
{
    public function index(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $counts = $pdo->query('SELECT status, COUNT(*) AS total FROM newsletter_subscribers GROUP BY status')->fetchAll(PDO::FETCH_KEY_PAIR);
            $subscribers = $pdo->query('SELECT id, email, status, created_at, confirmed_at FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 300')->fetchAll(PDO::FETCH_ASSOC);
            return [
                'data' => $subscribers,
                'meta' => [
                    'pending' => (int) ($counts['pending'] ?? 0),
                    'active' => (int) ($counts['active'] ?? 0),
                    'unsubscribed' => (int) ($counts['unsubscribed'] ?? 0),
                ],
            ];
        });
    }

    public function delete(int $id): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo) use ($id): array {
            $statement = $pdo->prepare('DELETE FROM newsletter_subscribers WHERE id = :id');
            $statement->execute(['id' => $id]);
            if ($statement->rowCount() === 0) throw new \InvalidArgumentException('Abonné introuvable.');
            AuditLog::record('newsletter.delete_subscriber', 'newsletter_subscriber', $id);
            return ['message' => 'Abonné supprimé.'];
        });
    }

    public function send(): void
    {
        AdminAuthController::requireStaff(['admin', 'editor']);
        $this->respond(function (PDO $pdo): array {
            $input = $this->input();
            $subject = trim((string) ($input['subject'] ?? ''));
            $body = trim((string) ($input['body'] ?? ''));
            if ($subject === '' || $body === '') {
                throw new \InvalidArgumentException('Le sujet et le contenu sont obligatoires.');
            }

            $recipients = $pdo->query('SELECT email, token FROM newsletter_subscribers WHERE status = "active"')->fetchAll(PDO::FETCH_ASSOC);
            $sent = 0;
            foreach ($recipients as $recipient) {
                $unsubscribeLink = Config::url('/api/newsletter/unsubscribe') . '?token=' . urlencode((string) $recipient['token']);
                $fullBody = $body . "\n\n---\nVous recevez cet e-mail car vous êtes inscrit(e) à la newsletter.\nSe désinscrire : {$unsubscribeLink}\n";
                if (Mailer::send($recipient['email'], $recipient['email'], $subject, $fullBody)['success']) {
                    $sent++;
                }
            }

            AuditLog::record('newsletter.send', null, null, ['subject' => $subject, 'sent' => $sent, 'total' => count($recipients)]);
            return ['message' => "Campagne envoyée à {$sent}/" . count($recipients) . ' abonné(s) actif(s).'];
        });
    }

    private function input(): array { return json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR); }
    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException) { $this->error('Base de données indisponible.', 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
}
