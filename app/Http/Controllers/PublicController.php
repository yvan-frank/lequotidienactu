<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Seo\SeoManager;
use App\Support\Categories;
use App\Support\Config;
use App\Support\Mailer;
use App\Support\MailTemplate;
use App\Support\RateLimiter;
use App\Support\RateLimits;
use App\Support\Settings;
use App\Support\TooManyAttemptsException;
use PDO;
use PDOException;

final class PublicController
{
    private const CATEGORIES = ['afrique', 'france-diaspora', 'business', 'tech', 'sport', 'culture'];
    private const CONTACT_EMAIL_FALLBACK = 'yvanzangue@gmail.com';

    public function home(): void
    {
        $title = 'Le Quotidien Actu - L’actualité qui compte';
        $page = 'home';
        $articles = $this->publishedArticles();
        $featured = $this->featuredArticles($articles, 5);
        $categorySpotlights = $this->categorySpotlights();
        $reader = $this->currentReader();
        $forYouArticles = ($reader && !empty($reader['followed_categories']))
            ? $this->publishedArticles($this->expandCategorySlugs($reader['followed_categories']), null, false, 6)
            : [];
        $seo = (new SeoManager())->forHome();
        require __DIR__ . '/../../Views/layout.php';
    }

    /**
     * Reads the reader session (distinct cookie/session name from the admin
     * one) without forcing every page to pay for it — only home() actually
     * needs it server-side, to build the "Pour vous" section before first
     * paint. The header's account widget itself is client-rendered and
     * hits /api/account/session directly, so it doesn't depend on this.
     */
    /**
     * The category picker only offers top-level rubriques, but articles are
     * usually filed under a subcategory (e.g. "Cameroun" under "Afrique") —
     * so a followed top-level slug needs to pull in its children's slugs
     * too, or "Pour vous" would stay empty for most readers.
     */
    private function expandCategorySlugs(array $slugs): array
    {
        $expanded = $slugs;
        foreach (Categories::tree() as $category) {
            if (in_array($category['slug'], $slugs, true)) {
                foreach ($category['children'] ?? [] as $child) {
                    $expanded[] = $child['slug'];
                }
            }
        }
        return array_values(array_unique($expanded));
    }

    private function currentReader(): ?array
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_name('lqa_reader');
            session_start();
        }
        return $_SESSION['reader'] ?? null;
    }

    /**
     * Editor-picked articles (starred in the admin article list) first,
     * padded with the most recent ones if fewer than $limit were picked.
     */
    private function featuredArticles(array $articles, int $limit): array
    {
        $featured = array_values(array_filter($articles, static fn (array $item): bool => !empty($item['is_featured'])));
        if (count($featured) >= $limit) {
            return array_slice($featured, 0, $limit);
        }

        $featuredIds = array_column($featured, 'id');
        $padding = array_values(array_filter($articles, static fn (array $item): bool => !in_array($item['id'], $featuredIds, true)));
        return array_slice(array_merge($featured, $padding), 0, $limit);
    }

    /**
     * One spotlight per top-level category that actually has published
     * content — replaces the old hardcoded Afrique/Business/Tech sections
     * so every rubrique gets a homepage presence once it has articles.
     */
    private function categorySpotlights(): array
    {
        $spotlights = [];
        foreach (Categories::tree() as $category) {
            $items = Categories::spotlight((int) $category['id'], 4);
            if ($items === []) {
                continue;
            }
            $spotlights[] = [
                'name' => $category['name'],
                'slug' => $category['slug'],
                'main' => $items[0],
                'list' => array_slice($items, 1, 3),
            ];
        }
        return $spotlights;
    }

    public function category(string $slug): void
    {
        $categoryRow = $this->findCategoryBySlug($slug);
        $categoryName = $categoryRow['name'] ?? ucfirst($slug);
        $title = $categoryName . ' - Le Quotidien Actu';
        $page = 'category';
        $category = $slug;
        $categoryDetails = $categoryRow;
        $parentCategory = $categoryRow && $categoryRow['parent_id'] !== null
            ? $this->findCategoryById((int) $categoryRow['parent_id'])
            : null;
        $subcategories = $categoryRow ? $this->childrenOf((int) $categoryRow['id']) : [];
        $categorySlugs = $categoryRow
            ? array_merge([$slug], array_column($subcategories, 'slug'))
            : $slug;
        $perPage = 12;
        $articlesPlusOne = $this->publishedArticles($categorySlugs, null, false, $perPage + 1);
        $hasMoreArticles = count($articlesPlusOne) > $perPage;
        $articles = array_slice($articlesPlusOne, 0, $perPage);
        $infiniteScrollCategory = implode(',', (array) $categorySlugs);
        $seo = (new SeoManager())->forCategory($categoryName, $slug);
        require __DIR__ . '/../../Views/layout.php';
    }

    public function article(string $category, string $slug): void
    {
        $title = 'Un titre d’article optimisé pour le référencement';
        $article = $this->findArticle($category, $slug);
        if ($article === null) {
            throw new \LogicException('Article introuvable.');
        }
        $page = ($article['layout'] ?? 'standard') === 'magazine' ? 'article-magazine' : 'article';
        $isPreview = ($article['status'] ?? 'published') !== 'published'
            || ($article['published_at_raw'] ?? '1970-01-01') > date('Y-m-d H:i:s');
        if ($isPreview) {
            header('X-Robots-Tag: noindex, nofollow');
        } elseif (isset($article['id'])) {
            $this->recordView((int) $article['id']);
        }
        $wordCount = str_word_count(strip_tags($article['body'] ?? ''));
        $readingMinutes = max(1, (int) ceil($wordCount / 200));
        $tags = $this->articleTags($article['id'] ?? null);
        $related = $this->relatedArticles($article);
        $nextArticle = $this->nextArticle($article);
        $sidebarArticles = $this->latestArticles($article['id'] ?? null, 4);
        $seo = (new SeoManager())->forArticle($article);
        require __DIR__ . '/../../Views/layout.php';
    }

    public function search(): void
    {
        $searchQuery = trim((string) ($_GET['q'] ?? ''));
        $title = ($searchQuery !== '' ? '« ' . $searchQuery . ' » - ' : '') . 'Recherche - Le Quotidien Actu';
        $page = 'search';
        [$searchMax, $searchWindow] = RateLimits::resolve('search');
        $searchRateLimited = $searchQuery !== '' && (new RateLimiter($this->pdo()))->tooManyAttempts('search', $searchMax, $searchWindow);
        $perPage = 12;
        $articlesPlusOne = ($searchQuery !== '' && !$searchRateLimited) ? $this->searchArticles($searchQuery, $perPage + 1) : [];
        $hasMoreArticles = count($articlesPlusOne) > $perPage;
        $articles = array_slice($articlesPlusOne, 0, $perPage);
        $seo = (new SeoManager())->forSearch();
        require __DIR__ . '/../../Views/layout.php';
    }

    public function mentionsLegales(): void
    {
        $title = 'Mentions légales - Le Quotidien Actu';
        $page = 'mentions-legales';
        $seo = (new SeoManager())->forStaticPage('Mentions légales', 'Mentions légales de Le Quotidien Actu : éditeur, hébergeur et directeur de la publication.', '/mentions-legales');
        require __DIR__ . '/../../Views/layout.php';
    }

    public function confidentialite(): void
    {
        $title = 'Politique de confidentialité - Le Quotidien Actu';
        $page = 'confidentialite';
        $seo = (new SeoManager())->forStaticPage('Politique de confidentialité', 'Comment Le Quotidien Actu collecte, utilise et protège vos données personnelles.', '/confidentialite');
        require __DIR__ . '/../../Views/layout.php';
    }

    public function aPropos(): void
    {
        $title = 'À propos - Le Quotidien Actu';
        $page = 'a-propos';
        $seo = (new SeoManager())->forStaticPage('À propos', 'Qui sommes-nous : la ligne éditoriale de Le Quotidien Actu.', '/a-propos');
        require __DIR__ . '/../../Views/layout.php';
    }

    public function pageExists(string $slug): bool
    {
        try {
            $statement = $this->pdo()->prepare("SELECT 1 FROM pages WHERE slug = :slug AND status = 'published' LIMIT 1");
            $statement->execute(['slug' => $slug]);
            return (bool) $statement->fetchColumn();
        } catch (PDOException) {
            return false;
        }
    }

    public function page(string $slug): void
    {
        $statement = $this->pdo()->prepare("SELECT * FROM pages WHERE slug = :slug AND status = 'published' LIMIT 1");
        $statement->execute(['slug' => $slug]);
        $cmsPage = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$cmsPage) {
            throw new \LogicException('Page introuvable.');
        }
        $title = $cmsPage['title'] . ' - Le Quotidien Actu';
        $page = 'page';
        $seo = (new SeoManager())->forPage($cmsPage);
        require __DIR__ . '/../../Views/layout.php';
    }

    public function authorExists(string $slug): bool
    {
        try {
            $statement = $this->pdo()->prepare('SELECT 1 FROM authors WHERE slug = :slug LIMIT 1');
            $statement->execute(['slug' => $slug]);
            return (bool) $statement->fetchColumn();
        } catch (PDOException) {
            return false;
        }
    }

    public function authorPage(string $slug): void
    {
        $statement = $this->pdo()->prepare('SELECT au.id, au.display_name, au.job_title, au.slug, au.bio, au.disclosure, COALESCE(m.path, null) AS avatar FROM authors au LEFT JOIN media m ON m.id = au.avatar_media_id WHERE au.slug = :slug LIMIT 1');
        $statement->execute(['slug' => $slug]);
        $authorRow = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$authorRow) {
            throw new \LogicException('Auteur introuvable.');
        }
        $title = $authorRow['display_name'] . ' - Le Quotidien Actu';
        $page = 'author';
        $authorProfile = $authorRow;
        $perPage = 12;
        $articlesPlusOne = $this->authorArticles($slug, $perPage + 1);
        $hasMoreArticles = count($articlesPlusOne) > $perPage;
        $articles = array_slice($articlesPlusOne, 0, $perPage);
        $seo = (new SeoManager())->forStaticPage(
            $authorRow['display_name'],
            $authorRow['bio'] ?? ('Articles publiés par ' . $authorRow['display_name'] . ' sur Le Quotidien Actu.'),
            '/auteurs/' . $slug,
        );
        require __DIR__ . '/../../Views/layout.php';
    }

    private function authorArticles(string $authorSlug, int $limit): array
    {
        try {
            $sql = 'SELECT a.title, a.slug, a.excerpt, a.published_at, c.slug AS category, c.name AS category_name, COALESCE(m.path, "/assets/hero-placeholder.svg") AS hero_image FROM articles a INNER JOIN categories c ON c.id = a.category_id INNER JOIN authors au ON au.id = a.author_id LEFT JOIN media m ON m.id = a.hero_media_id WHERE au.slug = :slug AND a.status = "published" AND a.published_at <= NOW() ORDER BY a.published_at DESC LIMIT ' . max(1, $limit);
            $statement = $this->pdo()->prepare($sql);
            $statement->execute(['slug' => $authorSlug]);
            return array_map(static function (array $article): array {
                $article['published_at'] = (new \DateTimeImmutable($article['published_at']))->format('d/m/Y');
                return $article;
            }, $statement->fetchAll(PDO::FETCH_ASSOC));
        } catch (PDOException) {
            return [];
        }
    }

    private const JOB_CATEGORIES = ['CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance'];
    private const CLASSIFIED_CATEGORIES = ['Immobilier', 'Véhicules', 'Multimédia & Électronique', 'Mode & Vêtements', 'Maison & Jardin', 'Services', 'Autres'];

    public function jobs(): void
    {
        $this->listingsIndex('job', 'Offres d’emploi', self::JOB_CATEGORIES, '/emploi');
    }

    public function classifieds(): void
    {
        $this->listingsIndex('classified', 'Petites annonces', self::CLASSIFIED_CATEGORIES, '/petites-annonces');
    }

    private function listingsIndex(string $type, string $heading, array $categories, string $basePath): void
    {
        $title = $heading . ' - Le Quotidien Actu';
        $page = 'listings';
        $listingType = $type;
        $listingHeading = $heading;
        $listingCategories = $categories;
        $listingBasePath = $basePath;
        $listings = $this->publishedListings($type);
        $seo = (new SeoManager())->forStaticPage($heading, $heading . ' publiées par les lecteurs de Le Quotidien Actu.', $basePath);
        require __DIR__ . '/../../Views/layout.php';
    }

    public function jobExists(string $slug): bool
    {
        return $this->listingExists('job', $slug);
    }

    public function classifiedExists(string $slug): bool
    {
        return $this->listingExists('classified', $slug);
    }

    private function listingExists(string $type, string $slug): bool
    {
        try {
            $statement = $this->pdo()->prepare('SELECT 1 FROM listings WHERE type = :type AND slug = :slug AND status = "approved" AND (expires_at IS NULL OR expires_at >= CURDATE()) LIMIT 1');
            $statement->execute(['type' => $type, 'slug' => $slug]);
            return (bool) $statement->fetchColumn();
        } catch (PDOException) {
            return false;
        }
    }

    public function jobDetail(string $slug): void
    {
        $this->listingDetail('job', $slug, '/emploi');
    }

    public function classifiedDetail(string $slug): void
    {
        $this->listingDetail('classified', $slug, '/petites-annonces');
    }

    private function listingDetail(string $type, string $slug, string $basePath): void
    {
        $statement = $this->pdo()->prepare('SELECT * FROM listings WHERE type = :type AND slug = :slug AND status = "approved" AND (expires_at IS NULL OR expires_at >= CURDATE()) LIMIT 1');
        $statement->execute(['type' => $type, 'slug' => $slug]);
        $listingRow = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$listingRow) {
            throw new \LogicException('Annonce introuvable.');
        }
        $title = $listingRow['title'] . ' - Le Quotidien Actu';
        $page = 'listing';
        $listing = $listingRow;
        $listingBasePath = $basePath;
        $seo = (new SeoManager())->forStaticPage($listingRow['title'], mb_substr(strip_tags($listingRow['description']), 0, 160), $basePath . '/' . $slug);
        require __DIR__ . '/../../Views/layout.php';
    }

    public function listingSubmitForm(): void
    {
        $title = 'Déposer une annonce - Le Quotidien Actu';
        $page = 'listing-submit';
        $listingType = trim((string) ($_GET['type'] ?? 'classified')) === 'job' ? 'job' : 'classified';
        $listingCategories = $listingType === 'job' ? self::JOB_CATEGORIES : self::CLASSIFIED_CATEGORIES;
        $listingCategoriesByType = ['job' => self::JOB_CATEGORIES, 'classified' => self::CLASSIFIED_CATEGORIES];
        $submitStatus = (string) ($_GET['statut'] ?? '');
        $seo = (new SeoManager())->forStaticPage('Déposer une annonce', 'Publiez une offre d’emploi ou une petite annonce sur Le Quotidien Actu.', '/annonces/deposer');
        require __DIR__ . '/../../Views/layout.php';
    }

    private function publishedListings(string $type): array
    {
        try {
            $statement = $this->pdo()->prepare('SELECT id, category, title, slug, location, price, created_at FROM listings WHERE type = :type AND status = "approved" AND (expires_at IS NULL OR expires_at >= CURDATE()) ORDER BY created_at DESC LIMIT 100');
            $statement->execute(['type' => $type]);
            return array_map(static function (array $row): array {
                $row['created_at'] = (new \DateTimeImmutable($row['created_at']))->format('d/m/Y');
                return $row;
            }, $statement->fetchAll(PDO::FETCH_ASSOC));
        } catch (PDOException) {
            return [];
        }
    }

    public function contact(): void
    {
        $title = 'Contact - Le Quotidien Actu';
        $page = 'contact';
        $contactStatus = (string) ($_GET['statut'] ?? '');
        $seo = (new SeoManager())->forStaticPage('Contact', 'Contactez la rédaction de Le Quotidien Actu.', '/contact');
        require __DIR__ . '/../../Views/layout.php';
    }

    public function submitContact(): void
    {
        try {
            $pdo = $this->pdo();
            [$contactMax, $contactWindow] = RateLimits::resolve('contact');
            if ((new RateLimiter($pdo))->tooManyAttempts('contact', $contactMax, $contactWindow)) {
                throw new TooManyAttemptsException('Trop de tentatives. Réessayez plus tard.');
            }

            // Honeypot: a hidden field real visitors never fill in; bots that
            // auto-fill every field trip it and get silently no-opped as "sent".
            if (trim((string) ($_POST['site_web'] ?? '')) !== '') {
                header('Location: ' . Config::url('/contact?statut=envoye'));
                return;
            }

            $name = trim((string) ($_POST['nom'] ?? ''));
            $email = filter_var(trim((string) ($_POST['email'] ?? '')), FILTER_VALIDATE_EMAIL);
            $message = trim((string) ($_POST['message'] ?? ''));
            if ($name === '' || !$email || $message === '') {
                throw new \InvalidArgumentException('Merci de renseigner votre nom, un e-mail valide et un message.');
            }

            $appName = $_ENV['APP_NAME'] ?? 'Le Quotidien Actu';
            $safeName = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
            $safeEmail = htmlspecialchars($email, ENT_QUOTES, 'UTF-8');
            $safeMessage = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));
            $html = MailTemplate::render(
                preheader: 'Nouveau message via le formulaire de contact.',
                heading: 'Nouveau message de contact',
                paragraphs: [
                    "<strong>Nom :</strong> {$safeName}",
                    "<strong>E-mail :</strong> {$safeEmail}",
                    "<strong>Message :</strong><br>{$safeMessage}",
                ],
            );
            $text = "Nouveau message via le formulaire de contact de {$appName}\n\n"
                . "Nom : {$name}\nE-mail : {$email}\n\nMessage :\n{$message}\n";
            $recipient = Settings::get('general', ['contact_email' => ''])['contact_email'] ?: self::CONTACT_EMAIL_FALLBACK;
            Mailer::sendHtml($recipient, $recipient, 'Contact site — ' . $name, $html, $text, ['email' => $email, 'name' => $name]);

            header('Location: ' . Config::url('/contact?statut=envoye'));
        } catch (TooManyAttemptsException) {
            header('Location: ' . Config::url('/contact?statut=limite'));
        } catch (\InvalidArgumentException) {
            header('Location: ' . Config::url('/contact?statut=invalide'));
        } catch (PDOException) {
            header('Location: ' . Config::url('/contact?statut=erreur'));
        }
    }

    private function searchArticles(string $query, int $limit = 20, int $offset = 0): array
    {
        try {
            $statement = $this->pdo()->prepare('SELECT a.title, a.slug, a.excerpt, a.published_at, c.slug AS category, c.name AS category_name, COALESCE(m.path, "/assets/hero-placeholder.svg") AS hero_image FROM articles a INNER JOIN categories c ON c.id = a.category_id LEFT JOIN media m ON m.id = a.hero_media_id WHERE a.status = "published" AND a.published_at <= NOW() AND (a.title LIKE :q OR a.excerpt LIKE :q) ORDER BY a.published_at DESC LIMIT ' . max(1, $limit) . ' OFFSET ' . max(0, $offset));
            $statement->execute(['q' => '%' . $query . '%']);
            return array_map(static function (array $item): array {
                $item['published_at'] = (new \DateTimeImmutable($item['published_at']))->format('d/m/Y');
                return $item;
            }, $statement->fetchAll(PDO::FETCH_ASSOC));
        } catch (PDOException) {
            return [];
        }
    }

    public function categoryExists(string $slug): bool
    {
        if (in_array($slug, self::CATEGORIES, true)) {
            return true;
        }
        try {
            $statement = $this->pdo()->prepare('SELECT 1 FROM categories WHERE slug = :slug LIMIT 1');
            $statement->execute(['slug' => $slug]);
            return (bool) $statement->fetchColumn();
        } catch (PDOException) {
            return false;
        }
    }

    public function articleExists(string $category, string $slug): bool
    {
        return $this->findArticle($category, $slug) !== null;
    }

    private function findArticle(string $category, string $slug): ?array
    {
        $preview = isset($_GET['preview']) && $this->isPreviewAuthorized();
        foreach ($this->publishedArticles($category, $slug, $preview) as $article) {
            return $article;
        }
        if (!$preview) {
            foreach ($this->demoArticles() as $article) {
                if ($article['category'] === $category && $article['slug'] === $slug) {
                    return $article;
                }
            }
        }

        return null;
    }

    private function isPreviewAuthorized(): bool
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_name('lqa_admin');
            session_start();
        }

        return isset($_SESSION['admin_user']);
    }

    private function publishedArticles(string|array|null $category = null, ?string $slug = null, bool $includeUnpublished = false, int $limit = 30, int $offset = 0): array
    {
        try {
            if (is_array($category) && $category === []) {
                return [];
            }
            $sql = 'SELECT a.id, a.category_id, a.title, a.slug, a.excerpt, a.body, a.status, a.layout, a.published_at, a.updated_at, a.meta_title, a.meta_description, a.canonical_url, a.robots, a.is_sponsored, a.is_featured, c.slug AS category, c.name AS category_name, au.display_name AS author, au.slug AS author_slug, au.job_title AS author_job_title, au.bio AS author_bio, au.disclosure AS author_disclosure, COALESCE(m.path, "/assets/hero-placeholder.svg") AS hero_image, m.credit AS hero_credit, m.alt_text AS hero_alt FROM articles a INNER JOIN categories c ON c.id = a.category_id INNER JOIN authors au ON au.id = a.author_id LEFT JOIN media m ON m.id = a.hero_media_id WHERE 1 = 1';
            $params = [];
            if (is_array($category)) {
                $placeholders = [];
                foreach (array_values($category) as $index => $categorySlug) {
                    $key = 'category' . $index;
                    $placeholders[] = ':' . $key;
                    $params[$key] = $categorySlug;
                }
                $sql .= ' AND c.slug IN (' . implode(',', $placeholders) . ')';
            } elseif ($category !== null) {
                $sql .= ' AND c.slug = :category';
                $params['category'] = $category;
            }
            if (!$includeUnpublished) {
                $sql .= ' AND a.status = "published" AND a.published_at <= NOW()';
            }
            if ($slug !== null) {
                $sql .= ' AND a.slug = :slug';
                $params['slug'] = $slug;
            }
            $sql .= ' ORDER BY a.published_at DESC LIMIT ' . max(1, $limit) . ' OFFSET ' . max(0, $offset);
            $statement = $this->pdo()->prepare($sql);
            $statement->execute($params);
            return array_map(static function (array $article): array {
                $date = $article['published_at'] ? new \DateTimeImmutable($article['published_at']) : new \DateTimeImmutable();
                $updated = new \DateTimeImmutable($article['updated_at']);
                return [
                    ...$article,
                    'published_at_raw' => $article['published_at'],
                    'published_at' => $date->format('d/m/Y'),
                    'published_at_iso' => $date->format(DATE_ATOM),
                    'updated_at_display' => $updated->format('d/m/Y'),
                    'updated_at_iso' => $updated->format(DATE_ATOM),
                ];
            }, $statement->fetchAll(PDO::FETCH_ASSOC));
        } catch (PDOException) {
            return [];
        }
    }

    /**
     * A missed or double-counted view is not worth failing the page render
     * for, so this stays fire-and-forget like the ad impression counter.
     */
    private function recordView(int $articleId): void
    {
        try {
            $this->pdo()->prepare('UPDATE articles SET views_count = views_count + 1 WHERE id = :id')
                ->execute(['id' => $articleId]);
        } catch (PDOException) {
            // Ignore — view counts are a nice-to-have, not critical.
        }
    }

    private function findCategoryBySlug(string $slug): ?array
    {
        try {
            $statement = $this->pdo()->prepare('SELECT id, parent_id, name, slug, description FROM categories WHERE slug = :slug LIMIT 1');
            $statement->execute(['slug' => $slug]);
            $row = $statement->fetch(PDO::FETCH_ASSOC);
            return $row ?: null;
        } catch (PDOException) {
            return null;
        }
    }

    private function findCategoryById(int $id): ?array
    {
        try {
            $statement = $this->pdo()->prepare('SELECT id, parent_id, name, slug, description FROM categories WHERE id = :id LIMIT 1');
            $statement->execute(['id' => $id]);
            $row = $statement->fetch(PDO::FETCH_ASSOC);
            return $row ?: null;
        } catch (PDOException) {
            return null;
        }
    }

    private function childrenOf(int $categoryId): array
    {
        try {
            $statement = $this->pdo()->prepare('SELECT id, name, slug FROM categories WHERE parent_id = :id ORDER BY position, name');
            $statement->execute(['id' => $categoryId]);
            return $statement->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException) {
            return [];
        }
    }

    private function articleTags(?int $articleId): array
    {
        if ($articleId === null) {
            return [];
        }
        try {
            $statement = $this->pdo()->prepare('SELECT t.name, t.slug FROM tags t INNER JOIN article_tags at ON at.tag_id = t.id WHERE at.article_id = :id ORDER BY t.name');
            $statement->execute(['id' => $articleId]);
            return $statement->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException) {
            return [];
        }
    }

    /**
     * Ranks candidates by a simple relevance score instead of pure recency:
     * shared tags count for the most (a real topical match), same category
     * counts for a little, and article popularity (view count) breaks ties
     * among otherwise-equal candidates — so a well-read piece surfaces
     * ahead of an obscure one on the same subject. The candidate pool isn't
     * restricted to the current category, so a strongly tag-matching
     * article from elsewhere on the site can still surface.
     */
    private function relatedArticles(array $article): array
    {
        if (!isset($article['id'], $article['category_id'])) {
            return [];
        }
        try {
            $statement = $this->pdo()->prepare(
                'SELECT a.title, a.slug, a.excerpt, a.published_at, c.slug AS category, c.name AS category_name, COALESCE(m.path, "/assets/hero-placeholder.svg") AS hero_image,
                    (SELECT COUNT(*) FROM article_tags cur INNER JOIN article_tags other ON other.tag_id = cur.tag_id WHERE cur.article_id = :id AND other.article_id = a.id) AS shared_tags
                 FROM articles a
                 INNER JOIN categories c ON c.id = a.category_id
                 LEFT JOIN media m ON m.id = a.hero_media_id
                 WHERE a.id != :id AND a.status = "published" AND a.published_at <= NOW()
                 ORDER BY (
                     (SELECT COUNT(*) FROM article_tags cur INNER JOIN article_tags other ON other.tag_id = cur.tag_id WHERE cur.article_id = :id AND other.article_id = a.id) * 3
                     + (a.category_id = :category_id)
                 ) DESC, a.views_count DESC, a.published_at DESC
                 LIMIT 3'
            );
            $statement->execute(['category_id' => $article['category_id'], 'id' => $article['id']]);
            return array_map(static function (array $item): array {
                unset($item['shared_tags']);
                $item['published_at'] = (new \DateTimeImmutable($item['published_at']))->format('d/m/Y');
                return $item;
            }, $statement->fetchAll(PDO::FETCH_ASSOC));
        } catch (PDOException) {
            return [];
        }
    }

    private function nextArticle(array $article): ?array
    {
        if (!isset($article['id'], $article['category_id'], $article['published_at_raw'])) {
            return null;
        }
        try {
            $statement = $this->pdo()->prepare('SELECT a.title, a.slug, a.excerpt, c.slug AS category, c.name AS category_name, COALESCE(m.path, "/assets/hero-placeholder.svg") AS hero_image FROM articles a INNER JOIN categories c ON c.id = a.category_id LEFT JOIN media m ON m.id = a.hero_media_id WHERE a.category_id = :category_id AND a.id != :id AND a.status = "published" AND a.published_at <= NOW() AND a.published_at < :published_at ORDER BY a.published_at DESC LIMIT 1');
            $statement->execute([
                'category_id' => $article['category_id'],
                'id' => $article['id'],
                'published_at' => $article['published_at_raw'],
            ]);
            $next = $statement->fetch(PDO::FETCH_ASSOC);
            return $next ?: null;
        } catch (PDOException) {
            return null;
        }
    }

    private function latestArticles(?int $excludeId, int $limit): array
    {
        try {
            $sql = 'SELECT a.title, a.slug, a.published_at, c.slug AS category, c.name AS category_name, COALESCE(m.path, "/assets/hero-placeholder.svg") AS hero_image FROM articles a INNER JOIN categories c ON c.id = a.category_id LEFT JOIN media m ON m.id = a.hero_media_id WHERE a.status = "published" AND a.published_at <= NOW()';
            $params = [];
            if ($excludeId !== null) {
                $sql .= ' AND a.id != :id';
                $params['id'] = $excludeId;
            }
            $sql .= ' ORDER BY a.published_at DESC LIMIT ' . max(1, $limit);
            $statement = $this->pdo()->prepare($sql);
            $statement->execute($params);
            return array_map(static function (array $item): array {
                $item['published_at'] = (new \DateTimeImmutable($item['published_at']))->format('d/m/Y');
                return $item;
            }, $statement->fetchAll(PDO::FETCH_ASSOC));
        } catch (PDOException) {
            return [];
        }
    }

    private function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }

    private function demoArticles(): array
    {
        return [
            [
                'title' => 'Construire un média numérique au service de ses lecteurs',
                'slug' => 'construire-un-media-numerique',
                'category' => 'tech',
                'excerpt' => 'Les sujets qui façonnent l’Afrique francophone, la France et sa diaspora.',
                'published_at' => '17 août 2026',
                'published_at_iso' => '2026-08-17T06:00:00+02:00',
                'updated_at_iso' => '2026-08-17T06:00:00+02:00',
                'author' => 'La rédaction',
            ],
            [
                'title' => 'Les initiatives qui transforment l’économie africaine',
                'slug' => 'initiatives-economie-africaine',
                'category' => 'business',
                'excerpt' => 'Entreprises, startups et idées à suivre.',
                'published_at' => '17 août 2026',
                'published_at_iso' => '2026-08-17T07:00:00+02:00',
                'updated_at_iso' => '2026-08-17T07:00:00+02:00',
                'author' => 'La rédaction',
            ],
            [
                'title' => 'France et diaspora : les démarches qui changent cette rentrée',
                'slug' => 'france-diaspora-demarches-rentree',
                'category' => 'france-diaspora',
                'excerpt' => 'Vie pratique, études et emploi : les informations essentielles à connaître.',
                'published_at' => '16 août 2026',
                'published_at_iso' => '2026-08-16T12:00:00+02:00',
                'updated_at_iso' => '2026-08-16T12:00:00+02:00',
                'author' => 'La rédaction',
            ],
            [
                'title' => 'Sport : les rendez-vous à suivre cette semaine',
                'slug' => 'sport-rendez-vous-semaine',
                'category' => 'sport',
                'excerpt' => 'Le calendrier des compétitions et les résultats attendus.',
                'published_at' => '16 août 2026',
                'published_at_iso' => '2026-08-16T09:00:00+02:00',
                'updated_at_iso' => '2026-08-16T09:00:00+02:00',
                'author' => 'La rédaction',
            ],
            [
                'title' => 'Afrique : une nouvelle dynamique pour les entrepreneurs',
                'slug' => 'afrique-dynamique-entrepreneurs',
                'category' => 'afrique',
                'excerpt' => 'Portraits, initiatives locales et nouvelles opportunités sur le continent.',
                'published_at' => '15 août 2026',
                'published_at_iso' => '2026-08-15T11:00:00+02:00',
                'updated_at_iso' => '2026-08-15T11:00:00+02:00',
                'author' => 'La rédaction',
            ],
            [
                'title' => 'Business : les secteurs qui attirent les investissements',
                'slug' => 'business-secteurs-investissements',
                'category' => 'business',
                'excerpt' => 'Décryptage des tendances économiques à surveiller.',
                'published_at' => '15 août 2026',
                'published_at_iso' => '2026-08-15T08:00:00+02:00',
                'updated_at_iso' => '2026-08-15T08:00:00+02:00',
                'author' => 'La rédaction',
            ],
            [
                'title' => 'Tech : les usages de l’IA qui se démocratisent',
                'slug' => 'tech-usages-ia-democratisent',
                'category' => 'tech',
                'excerpt' => 'Innovation, outils et nouveaux usages du numérique au quotidien.',
                'published_at' => '14 août 2026',
                'published_at_iso' => '2026-08-14T10:00:00+02:00',
                'updated_at_iso' => '2026-08-14T10:00:00+02:00',
                'author' => 'La rédaction',
            ],
            [
                'title' => 'Culture : les artistes qui font rayonner la scène francophone',
                'slug' => 'culture-artistes-scene-francophone',
                'category' => 'culture',
                'excerpt' => 'Musique, cinéma et tendances : les voix qui marquent leur époque.',
                'published_at' => '14 août 2026',
                'published_at_iso' => '2026-08-14T08:00:00+02:00',
                'updated_at_iso' => '2026-08-14T08:00:00+02:00',
                'author' => 'La rédaction',
            ],
        ];
    }
}
