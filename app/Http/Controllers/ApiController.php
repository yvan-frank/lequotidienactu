<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Config;
use App\Support\Mailer;
use App\Support\MailTemplate;
use App\Support\RateLimiter;
use App\Support\RateLimits;
use App\Support\TooManyAttemptsException;
use PDO;
use PDOException;

final class ApiController
{
    private const REACTION_TYPES = ['like', 'love', 'clap', 'insightful'];

    /**
     * Backs InfiniteArticles on category and search-results pages — the
     * page's own PHP render supplies the first batch, this endpoint fetches
     * every batch after that. `category` accepts a comma-separated list of
     * slugs so a parent category page (which shows its own articles plus
     * its subcategories') can continue scrolling the same combined set.
     */
    public function articles(): void
    {
        $this->respond(function (PDO $pdo): array {
            $page = max(1, (int) ($_GET['page'] ?? 1));
            $perPage = 12;
            $offset = ($page - 1) * $perPage;
            $categorySlugs = array_values(array_filter(array_map('trim', explode(',', (string) ($_GET['category'] ?? '')))));
            $query = trim((string) ($_GET['q'] ?? ''));
            $authorSlug = trim((string) ($_GET['author'] ?? ''));

            [$searchMax, $searchWindow] = RateLimits::resolve('search');
            if ($query !== '' && (new RateLimiter($pdo))->tooManyAttempts('search', $searchMax, $searchWindow)) {
                throw new TooManyAttemptsException('Trop de recherches. Réessayez dans un instant.');
            }

            $sql = 'SELECT a.title, a.slug, a.excerpt, a.published_at, c.slug AS category, c.name AS category_name, COALESCE(m.path, "/assets/hero-placeholder.svg") AS hero_image FROM articles a INNER JOIN categories c ON c.id = a.category_id LEFT JOIN media m ON m.id = a.hero_media_id';
            $sql .= $authorSlug !== '' ? ' INNER JOIN authors au ON au.id = a.author_id' : '';
            $sql .= ' WHERE a.status = "published" AND a.published_at <= NOW()';
            $params = [];
            if ($authorSlug !== '') {
                $sql .= ' AND au.slug = :author';
                $params['author'] = $authorSlug;
            }
            if ($categorySlugs !== []) {
                $placeholders = [];
                foreach ($categorySlugs as $index => $categorySlug) {
                    $key = 'category' . $index;
                    $placeholders[] = ':' . $key;
                    $params[$key] = $categorySlug;
                }
                $sql .= ' AND c.slug IN (' . implode(',', $placeholders) . ')';
            }
            if ($query !== '') {
                $sql .= ' AND (a.title LIKE :q OR a.excerpt LIKE :q)';
                $params['q'] = '%' . $query . '%';
            }
            $sql .= ' ORDER BY a.published_at DESC LIMIT ' . ($perPage + 1) . ' OFFSET ' . $offset;
            $statement = $pdo->prepare($sql);
            $statement->execute($params);
            $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
            $hasMore = count($rows) > $perPage;
            $rows = array_map(static function (array $item): array {
                $item['published_at'] = (new \DateTimeImmutable($item['published_at']))->format('d/m/Y');
                return $item;
            }, array_slice($rows, 0, $perPage));

            return ['data' => $rows, 'meta' => ['page' => $page, 'per_page' => $perPage, 'has_more' => $hasMore]];
        });
    }

    public function search(): void
    {
        $this->respond(function (PDO $pdo): array {
            [$searchMax, $searchWindow] = RateLimits::resolve('search');
            if ((new RateLimiter($pdo))->tooManyAttempts('search', $searchMax, $searchWindow)) {
                throw new TooManyAttemptsException('Trop de recherches. Réessayez dans un instant.');
            }
            $query = trim((string) ($_GET['q'] ?? ''));
            if (mb_strlen($query) < 2) {
                return ['data' => [], 'query' => $query];
            }
            $statement = $pdo->prepare('SELECT a.title, a.slug, a.excerpt, c.slug AS category, c.name AS category_name, m.path AS hero_image FROM articles a INNER JOIN categories c ON c.id = a.category_id LEFT JOIN media m ON m.id = a.hero_media_id WHERE a.status = "published" AND a.published_at <= NOW() AND (a.title LIKE :q OR a.excerpt LIKE :q) ORDER BY a.published_at DESC LIMIT 8');
            $statement->execute(['q' => '%' . $query . '%']);
            return ['data' => $statement->fetchAll(PDO::FETCH_ASSOC), 'query' => $query];
        });
    }

    public function subscribe(): void
    {
        $this->respond(function (PDO $pdo): array {
            [$newsletterMax, $newsletterWindow] = RateLimits::resolve('newsletter');
            if ((new RateLimiter($pdo))->tooManyAttempts('newsletter', $newsletterMax, $newsletterWindow)) {
                throw new TooManyAttemptsException('Trop de tentatives. Réessayez dans quelques minutes.');
            }
            $input = $this->input();
            $email = filter_var(trim((string) ($input['email'] ?? '')), FILTER_VALIDATE_EMAIL);
            if (!$email) {
                throw new \InvalidArgumentException('Adresse e-mail invalide.');
            }

            $statement = $pdo->prepare('SELECT id, status, token FROM newsletter_subscribers WHERE email = :email LIMIT 1');
            $statement->execute(['email' => $email]);
            $subscriber = $statement->fetch(PDO::FETCH_ASSOC);
            $message = 'Merci ! Vérifiez votre boîte mail pour confirmer votre inscription.';

            if (!$subscriber) {
                $token = bin2hex(random_bytes(32));
                $pdo->prepare('INSERT INTO newsletter_subscribers (email, status, token) VALUES (:email, "pending", :token)')
                    ->execute(['email' => $email, 'token' => $token]);
                $this->sendConfirmationEmail($email, $token);
            } elseif ($subscriber['status'] === 'active') {
                $message = 'Cette adresse est déjà inscrite à la newsletter.';
            } else {
                // 'pending' (resend) or 'unsubscribed' (re-opt-in): always issue a
                // fresh token so an old leaked/expired link can't be reused.
                $token = bin2hex(random_bytes(32));
                $pdo->prepare('UPDATE newsletter_subscribers SET status = "pending", token = :token WHERE id = :id')
                    ->execute(['token' => $token, 'id' => $subscriber['id']]);
                $this->sendConfirmationEmail($email, $token);
            }

            return ['message' => $message];
        }, 201);
    }

    public function confirmNewsletter(): void
    {
        try {
            $token = (string) ($_GET['token'] ?? '');
            $pdo = $this->pdo();
            $statement = $pdo->prepare('SELECT id FROM newsletter_subscribers WHERE token = :token AND status = "pending" LIMIT 1');
            $statement->execute(['token' => $token]);
            $subscriber = $statement->fetch(PDO::FETCH_ASSOC);

            if ($subscriber) {
                $pdo->prepare('UPDATE newsletter_subscribers SET status = "active", confirmed_at = NOW() WHERE id = :id')
                    ->execute(['id' => $subscriber['id']]);
            }

            $this->renderNewsletterPage(
                $subscriber ? 'Inscription confirmée' : 'Lien invalide',
                $subscriber
                    ? 'Merci, votre inscription à la newsletter est confirmée !'
                    : 'Ce lien de confirmation est invalide ou a déjà été utilisé.'
            );
        } catch (PDOException) {
            $this->renderNewsletterPage('Indisponible', 'Base de données indisponible. Réessayez plus tard.');
        }
    }

    public function unsubscribeNewsletter(): void
    {
        try {
            $token = (string) ($_GET['token'] ?? '');
            $statement = $this->pdo()->prepare('UPDATE newsletter_subscribers SET status = "unsubscribed" WHERE token = :token');
            $statement->execute(['token' => $token]);

            $this->renderNewsletterPage(
                $statement->rowCount() > 0 ? 'Désinscription confirmée' : 'Lien invalide',
                $statement->rowCount() > 0
                    ? 'Vous ne recevrez plus la newsletter. Vous pouvez vous réinscrire à tout moment depuis le site.'
                    : 'Ce lien de désinscription est invalide.'
            );
        } catch (PDOException) {
            $this->renderNewsletterPage('Indisponible', 'Base de données indisponible. Réessayez plus tard.');
        }
    }

    /**
     * Redirect target for links inside a newsletter campaign — `a` is the
     * id of a newsletter_campaign_articles row (not the article itself,
     * so the same article can appear in several campaigns without clicks
     * bleeding together). Always redirects somewhere sensible even if the
     * click can't be counted (rate-limited or the link is stale), since a
     * reader clicking from their inbox should never see a bare error page.
     */
    public function newsletterClick(): void
    {
        $campaignArticleId = (int) ($_GET['a'] ?? 0);
        if ($campaignArticleId <= 0) {
            header('Location: ' . Config::url('/'));
            return;
        }

        try {
            $pdo = $this->pdo();
            $statement = $pdo->prepare('SELECT url FROM newsletter_campaign_articles WHERE id = :id');
            $statement->execute(['id' => $campaignArticleId]);
            $url = $statement->fetchColumn();
            if ($url === false) {
                header('Location: ' . Config::url('/'));
                return;
            }

            [$max, $window] = RateLimits::resolve('newsletter-click');
            if (!(new RateLimiter($pdo))->tooManyAttempts('newsletter-click', $max, $window)) {
                $pdo->prepare('UPDATE newsletter_campaign_articles SET clicks = clicks + 1 WHERE id = :id')->execute(['id' => $campaignArticleId]);
            }

            header('Location: ' . $url);
        } catch (PDOException) {
            header('Location: ' . Config::url('/'));
        }
    }

    private function sendConfirmationEmail(string $email, string $token): void
    {
        $appName = $_ENV['APP_NAME'] ?? 'Le Quotidien Actu';
        $link = Config::url('/api/newsletter/confirm') . '?token=' . urlencode($token);

        $html = MailTemplate::render(
            preheader: 'Confirmez votre inscription à la newsletter ' . $appName . '.',
            heading: 'Plus qu’une étape !',
            paragraphs: [
                'Merci de vous être inscrit(e) à la newsletter <strong>' . htmlspecialchars($appName, ENT_QUOTES, 'UTF-8') . '</strong>.',
                'Confirmez votre adresse e-mail en cliquant sur le bouton ci-dessous pour recevoir nos prochaines actualités.',
            ],
            button: ['label' => 'Confirmer mon inscription', 'url' => $link],
            footnote: 'Si vous n’êtes pas à l’origine de cette inscription, ignorez simplement cet e-mail : aucun compte ne sera créé.',
        );
        $text = "Bonjour,\n\nMerci de vous être inscrit(e) à la newsletter {$appName}.\n\n"
            . "Confirmez votre inscription en cliquant sur ce lien :\n{$link}\n\n"
            . "Si vous n’êtes pas à l’origine de cette inscription, ignorez cet e-mail.\n";

        Mailer::sendHtml($email, $email, 'Confirmez votre inscription — ' . $appName, $html, $text, null, 'NEWSLETTER');
    }

    private function renderNewsletterPage(string $title, string $message): void
    {
        $appName = htmlspecialchars($_ENV['APP_NAME'] ?? 'Le Quotidien Actu', ENT_QUOTES, 'UTF-8');
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'
            . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . ' — ' . $appName . '</title>'
            . '<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem}'
            . 'main{max-width:28rem;background:#fff;border:1px solid #e2e8f0;border-radius:1rem;padding:2rem;text-align:center}'
            . 'h1{font-size:1.35rem;margin:0 0 .75rem}p{color:#475569;line-height:1.5;margin:0 0 1.5rem}'
            . 'a{display:inline-block;background:#c2410c;color:#fff;text-decoration:none;font-weight:600;padding:.6rem 1.25rem;border-radius:.5rem}</style>'
            . '</head><body><main><h1>' . htmlspecialchars($title, ENT_QUOTES, 'UTF-8') . '</h1><p>'
            . htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . '</p><a href="/">Retour à l’accueil</a></main></body></html>';
    }

    public function reactions(int $articleId): void
    {
        $this->respond(function (PDO $pdo) use ($articleId): array {
            return ['data' => $this->reactionCounts($pdo, $articleId)];
        });
    }

    public function react(int $articleId): void
    {
        $this->respond(function (PDO $pdo) use ($articleId): array {
            [$reactionMax, $reactionWindow] = RateLimits::resolve('reaction');
            if ((new RateLimiter($pdo))->tooManyAttempts('reaction', $reactionMax, $reactionWindow)) {
                throw new TooManyAttemptsException('Trop de réactions envoyées. Réessayez dans quelques minutes.');
            }
            $input = $this->input();
            $type = trim((string) ($input['type'] ?? ''));
            if (!in_array($type, self::REACTION_TYPES, true)) {
                throw new \InvalidArgumentException('Type de réaction invalide.');
            }
            $this->assertPublished($pdo, $articleId);
            $statement = $pdo->prepare('INSERT INTO reactions (article_id, type) VALUES (:id, :type)');
            $statement->execute(['id' => $articleId, 'type' => $type]);
            return ['data' => $this->reactionCounts($pdo, $articleId)];
        }, 201);
    }

    public function comments(int $articleId): void
    {
        $this->respond(function (PDO $pdo) use ($articleId): array {
            $statement = $pdo->prepare('SELECT id, parent_id, author_name, body, created_at FROM comments WHERE article_id = :id AND status = "approved" ORDER BY created_at DESC');
            $statement->execute(['id' => $articleId]);
            return ['data' => $statement->fetchAll(PDO::FETCH_ASSOC)];
        });
    }

    public function postComment(int $articleId): void
    {
        $this->respond(function (PDO $pdo) use ($articleId): array {
            [$commentMax, $commentWindow] = RateLimits::resolve('comment');
            if ((new RateLimiter($pdo))->tooManyAttempts('comment', $commentMax, $commentWindow)) {
                throw new TooManyAttemptsException('Trop de commentaires envoyés. Réessayez dans quelques minutes.');
            }
            $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
            $blocked = $pdo->prepare('SELECT 1 FROM blocked_commenters WHERE ip_address = :ip LIMIT 1');
            $blocked->execute(['ip' => $ip]);
            if ($blocked->fetchColumn()) {
                throw new \InvalidArgumentException('Vous n’êtes plus autorisé(e) à publier de commentaires.');
            }
            $input = $this->input();
            $author = trim((string) ($input['author_name'] ?? ''));
            $body = trim((string) ($input['body'] ?? ''));
            if ($author === '' || $body === '') {
                throw new \InvalidArgumentException('Votre nom et votre commentaire sont obligatoires.');
            }
            if (mb_strlen($body) > 2000) {
                throw new \InvalidArgumentException('Commentaire trop long (2000 caractères maximum).');
            }
            $this->assertPublished($pdo, $articleId);
            $statement = $pdo->prepare('INSERT INTO comments (article_id, author_name, body, status, ip_address) VALUES (:id, :author, :body, "pending", :ip)');
            $statement->execute(['id' => $articleId, 'author' => mb_substr($author, 0, 120), 'body' => $body, 'ip' => $ip]);
            return ['message' => 'Merci ! Votre commentaire est en attente de modération.'];
        }, 201);
    }

    public function reportComment(int $commentId): void
    {
        $this->respond(function (PDO $pdo) use ($commentId): array {
            [$reportMax, $reportWindow] = RateLimits::resolve('comment-report');
            if ((new RateLimiter($pdo))->tooManyAttempts('comment-report', $reportMax, $reportWindow)) {
                throw new TooManyAttemptsException('Trop de signalements. Réessayez plus tard.');
            }
            $statement = $pdo->prepare('UPDATE comments SET reported_count = reported_count + 1 WHERE id = :id');
            $statement->execute(['id' => $commentId]);
            if ($statement->rowCount() === 0) {
                throw new \InvalidArgumentException('Commentaire introuvable.');
            }
            return ['message' => 'Merci, ce commentaire a été signalé à la modération.'];
        });
    }

    /**
     * Creates or updates a browser's push subscription (upsert by endpoint,
     * since re-subscribing after a permission/category change is the
     * common case, not a rare one). `categories` is a JSON array of slugs
     * to restrict to, or omitted/empty to receive every published article.
     */
    public function subscribePush(): void
    {
        $this->respond(function (PDO $pdo): array {
            [$max, $window] = RateLimits::resolve('push-subscribe');
            if ((new RateLimiter($pdo))->tooManyAttempts('push-subscribe', $max, $window)) {
                throw new TooManyAttemptsException('Trop de requêtes. Réessayez dans un instant.');
            }

            $input = $this->input();
            $endpoint = trim((string) ($input['endpoint'] ?? ''));
            $keys = (array) ($input['keys'] ?? []);
            $p256dh = trim((string) ($keys['p256dh'] ?? ''));
            $authToken = trim((string) ($keys['auth'] ?? ''));
            if ($endpoint === '' || $p256dh === '' || $authToken === '') {
                throw new \InvalidArgumentException('Abonnement push invalide.');
            }

            $categories = $input['categories'] ?? null;
            $categoriesJson = is_array($categories) && $categories !== []
                ? json_encode(array_values(array_unique(array_map('strval', $categories))), JSON_UNESCAPED_UNICODE)
                : null;

            $pdo->prepare(
                'INSERT INTO push_subscriptions (endpoint, p256dh, auth_token, categories) VALUES (:endpoint, :p256dh, :auth_token, :categories)
                 ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth_token = VALUES(auth_token), categories = VALUES(categories)'
            )->execute(['endpoint' => $endpoint, 'p256dh' => $p256dh, 'auth_token' => $authToken, 'categories' => $categoriesJson]);

            return ['message' => 'Notifications activées.'];
        }, 201);
    }

    public function unsubscribePush(): void
    {
        $this->respond(function (PDO $pdo): array {
            $endpoint = trim((string) ($this->input()['endpoint'] ?? ''));
            if ($endpoint === '') {
                throw new \InvalidArgumentException('Point de terminaison manquant.');
            }
            $pdo->prepare('DELETE FROM push_subscriptions WHERE endpoint = :endpoint')->execute(['endpoint' => $endpoint]);
            return ['message' => 'Notifications désactivées.'];
        });
    }

    public function adClick(int $adId): void
    {
        $this->respond(function (PDO $pdo) use ($adId): array {
            [$adClickMax, $adClickWindow] = RateLimits::resolve('ad-click');
            if ((new RateLimiter($pdo))->tooManyAttempts('ad-click', $adClickMax, $adClickWindow)) {
                throw new TooManyAttemptsException('Trop de requêtes. Réessayez dans un instant.');
            }
            $statement = $pdo->prepare('UPDATE advertisements SET clicks = clicks + 1 WHERE id = :id');
            $statement->execute(['id' => $adId]);
            return ['message' => 'ok'];
        });
    }

    private function reactionCounts(PDO $pdo, int $articleId): array
    {
        $statement = $pdo->prepare('SELECT type, COUNT(*) AS total FROM reactions WHERE article_id = :id GROUP BY type');
        $statement->execute(['id' => $articleId]);
        $counts = array_fill_keys(self::REACTION_TYPES, 0);
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $counts[$row['type']] = (int) $row['total'];
        }
        return $counts;
    }

    private function assertPublished(PDO $pdo, int $articleId): void
    {
        $statement = $pdo->prepare('SELECT 1 FROM articles WHERE id = :id AND status = "published"');
        $statement->execute(['id' => $articleId]);
        if (!$statement->fetchColumn()) {
            throw new \InvalidArgumentException('Article introuvable.');
        }
    }

    private function input(): array { return json_decode(file_get_contents('php://input') ?: '[]', true, 512, JSON_THROW_ON_ERROR) ?? []; }
    private function pdo(): PDO { return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]); }
    private function respond(callable $operation, int $success = 200): void { try { http_response_code($success); header('Content-Type: application/json; charset=utf-8'); echo json_encode($operation($this->pdo()), JSON_THROW_ON_ERROR); } catch (TooManyAttemptsException $e) { $this->error($e->getMessage(), 429); } catch (\InvalidArgumentException $e) { $this->error($e->getMessage(), 422); } catch (PDOException) { $this->error('Base de données indisponible.', 503); } catch (\Throwable $e) { $this->error($e->getMessage(), 500); } }
    private function error(string $message, int $status): void { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['message' => $message]); }
}
