<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\AuditLog;
use App\Support\Config;
use App\Support\Mailer;
use App\Support\MailTemplate;
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
            $intro = trim((string) ($input['intro'] ?? ''));
            $articleIds = array_values(array_unique(array_map('intval', (array) ($input['article_ids'] ?? []))));
            $subscriberIds = array_values(array_unique(array_map('intval', (array) ($input['subscriber_ids'] ?? []))));
            $featuredCount = max(0, (int) ($input['featured_count'] ?? 0));
            $layout = ($input['layout'] ?? 'cards') === 'list' ? 'list' : 'cards';

            if ($subject === '') {
                throw new \InvalidArgumentException('Le sujet est obligatoire.');
            }
            if ($articleIds === []) {
                throw new \InvalidArgumentException('Sélectionnez au moins un article à inclure.');
            }

            $articles = $this->publishedArticlesByIds($pdo, $articleIds);
            if ($articles === []) {
                throw new \InvalidArgumentException('Les articles sélectionnés sont introuvables ou non publiés.');
            }

            if ($subscriberIds !== []) {
                $placeholders = implode(',', array_fill(0, count($subscriberIds), '?'));
                $statement = $pdo->prepare("SELECT email, token FROM newsletter_subscribers WHERE status = 'active' AND id IN ($placeholders)");
                $statement->execute($subscriberIds);
            } else {
                $statement = $pdo->query('SELECT email, token FROM newsletter_subscribers WHERE status = "active"');
            }
            $recipients = $statement->fetchAll(PDO::FETCH_ASSOC);
            if ($recipients === []) {
                throw new \InvalidArgumentException('Aucun destinataire actif ne correspond à cette sélection.');
            }

            // A campaign row gives this send an identity to key click tracking
            // on; newsletter_campaign_articles snapshots each article's title
            // and real URL (so the report still makes sense if the article is
            // later edited or deleted) and gets its own row id, which becomes
            // the `a` param every tracked link redirects through.
            $pdo->prepare('INSERT INTO newsletter_campaigns (subject, intro, featured_count, recipients_count) VALUES (:subject, :intro, :featured_count, :recipients_count)')
                ->execute(['subject' => $subject, 'intro' => $intro !== '' ? $intro : null, 'featured_count' => $featuredCount, 'recipients_count' => count($recipients)]);
            $campaignId = (int) $pdo->lastInsertId();

            $insertArticle = $pdo->prepare('INSERT INTO newsletter_campaign_articles (campaign_id, article_id, position, title, url) VALUES (:campaign_id, :article_id, :position, :title, :url)');
            $trackedArticles = [];
            foreach (array_values($articles) as $position => $article) {
                $insertArticle->execute([
                    'campaign_id' => $campaignId,
                    'article_id' => $article['id'],
                    'position' => $position,
                    'title' => $article['title'],
                    'url' => $article['url'],
                ]);
                $trackedArticles[] = [
                    ...$article,
                    'url' => Config::url('/api/newsletter/click') . '?a=' . (int) $pdo->lastInsertId(),
                ];
            }

            $sent = 0;
            foreach ($recipients as $recipient) {
                $unsubscribeLink = Config::url('/api/newsletter/unsubscribe') . '?token=' . urlencode((string) $recipient['token']);
                $html = $layout === 'list'
                    ? MailTemplate::renderListDigest($subject, $intro !== '' ? $intro : null, $trackedArticles, $unsubscribeLink)
                    : MailTemplate::renderDigest($subject, $intro !== '' ? $intro : null, $trackedArticles, $featuredCount, $unsubscribeLink);
                $text = $this->renderPlainText($subject, $intro, $trackedArticles, $unsubscribeLink);
                if (Mailer::sendHtml($recipient['email'], $recipient['email'], $subject, $html, $text, null, 'NEWSLETTER')['success']) {
                    $sent++;
                }
            }

            $pdo->prepare('UPDATE newsletter_campaigns SET sent_count = :sent WHERE id = :id')->execute(['sent' => $sent, 'id' => $campaignId]);

            AuditLog::record('newsletter.send', 'newsletter_campaign', $campaignId, [
                'subject' => $subject,
                'article_ids' => array_column($articles, 'id'),
                'audience' => $subscriberIds !== [] ? 'selection' : 'all_active',
                'sent' => $sent,
                'total' => count($recipients),
            ]);
            return ['message' => "Campagne envoyée à {$sent}/" . count($recipients) . ' destinataire(s).'];
        });
    }

    public function campaigns(): void
    {
        AdminAuthController::requireStaff();
        $this->respond(function (PDO $pdo): array {
            $campaigns = $pdo->query('SELECT id, subject, sent_at, recipients_count, sent_count FROM newsletter_campaigns ORDER BY sent_at DESC LIMIT 100')->fetchAll(PDO::FETCH_ASSOC);
            if ($campaigns === []) {
                return ['data' => []];
            }

            $ids = array_column($campaigns, 'id');
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $statement = $pdo->prepare("SELECT campaign_id, title, url, clicks FROM newsletter_campaign_articles WHERE campaign_id IN ($placeholders) ORDER BY position ASC");
            $statement->execute($ids);
            $articlesByCampaign = [];
            foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $articlesByCampaign[(int) $row['campaign_id']][] = [
                    'title' => $row['title'],
                    'url' => $row['url'],
                    'clicks' => (int) $row['clicks'],
                ];
            }

            $data = [];
            foreach ($campaigns as $campaign) {
                $campaignId = (int) $campaign['id'];
                $campaignArticles = $articlesByCampaign[$campaignId] ?? [];
                $data[] = [
                    'id' => $campaignId,
                    'subject' => $campaign['subject'],
                    'sent_at' => $campaign['sent_at'],
                    'recipients_count' => (int) $campaign['recipients_count'],
                    'sent_count' => (int) $campaign['sent_count'],
                    'total_clicks' => array_sum(array_column($campaignArticles, 'clicks')),
                    'articles' => $campaignArticles,
                ];
            }
            return ['data' => $data];
        });
    }

    /**
     * Fetches published articles by id, ready to embed in a campaign, in
     * the same order the admin selected them (not insertion/id order).
     *
     * @param int[] $articleIds
     * @return array<int, array{id: int, title: string, excerpt: ?string, url: string, hero_image: string, category_name: string}>
     */
    private function publishedArticlesByIds(PDO $pdo, array $articleIds): array
    {
        $placeholders = implode(',', array_fill(0, count($articleIds), '?'));
        $statement = $pdo->prepare(
            "SELECT a.id, a.title, a.excerpt, a.slug, c.slug AS category_slug, c.name AS category_name, COALESCE(m.path, '/assets/hero-placeholder.svg') AS hero_image
             FROM articles a
             INNER JOIN categories c ON c.id = a.category_id
             LEFT JOIN media m ON m.id = a.hero_media_id
             WHERE a.id IN ($placeholders) AND a.status = 'published'"
        );
        $statement->execute($articleIds);
        $byId = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $byId[(int) $row['id']] = [
                'id' => (int) $row['id'],
                'title' => $row['title'],
                'excerpt' => $row['excerpt'],
                'url' => Config::url('/' . $row['category_slug'] . '/' . $row['slug']),
                'hero_image' => Config::url($row['hero_image']),
                'category_name' => $row['category_name'],
            ];
        }

        $ordered = [];
        foreach ($articleIds as $id) {
            if (isset($byId[$id])) {
                $ordered[] = $byId[$id];
            }
        }
        return $ordered;
    }

    /**
     * @param array<int, array{title: string, url: string}> $articles
     */
    private function renderPlainText(string $subject, string $intro, array $articles, string $unsubscribeLink): string
    {
        $lines = [$subject, ''];
        if ($intro !== '') {
            $lines[] = $intro;
            $lines[] = '';
        }
        foreach ($articles as $article) {
            $lines[] = '- ' . $article['title'] . ' : ' . $article['url'];
        }
        $lines[] = '';
        $lines[] = '---';
        $lines[] = 'Vous recevez cet e-mail car vous êtes inscrit(e) à la newsletter.';
        $lines[] = 'Se désinscrire : ' . $unsubscribeLink;
        return implode("\n", $lines);
    }

    private function input(): array { return json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR); }
    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException) { $this->error('Base de données indisponible.', 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
}
