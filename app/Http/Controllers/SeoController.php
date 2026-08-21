<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Config;
use App\Support\Settings;
use PDO;
use PDOException;

final class SeoController
{
    public function robots(): void
    {
        header('Content-Type: text/plain; charset=utf-8');
        echo "User-agent: *\nAllow: /\nDisallow: /api/admin/\nDisallow: /admin/\n\nSitemap: " . Config::url('/sitemap.xml') . "\nSitemap: " . Config::url('/sitemap-news.xml') . "\n\n# LLM-oriented site index (https://llmstxt.org/): " . Config::url('/llms.txt') . "\n";
    }

    /**
     * llms.txt (https://llmstxt.org/) — a curated, Markdown index of the
     * site for AI systems/LLM crawlers, generated fresh from the database
     * on every request so it never drifts from what's actually published.
     */
    public function llmsTxt(): void
    {
        $appName = $_ENV['APP_NAME'] ?? 'Le Quotidien Actu';
        $general = Settings::get('general', ['tagline' => '']);
        $tagline = trim((string) ($general['tagline'] ?? '')) !== ''
            ? $general['tagline']
            : 'L’actualité Afrique francophone, France et diaspora : décryptée, vérifiée, sans détour.';

        $lines = [
            '# ' . $appName,
            '',
            '> ' . $tagline,
            '',
            $appName . ' est un média d’actualité francophone couvrant l’Afrique, la France et sa diaspora : immigration, business, tech, sport et culture. Le contenu ci-dessous est généré automatiquement à partir des articles réellement publiés.',
            '',
        ];

        try {
            $pdo = $this->pdo();

            $categories = $pdo->query('SELECT name, slug FROM categories WHERE parent_id IS NULL ORDER BY position, name')->fetchAll(PDO::FETCH_ASSOC);
            if ($categories !== []) {
                $lines[] = '## Rubriques';
                foreach ($categories as $category) {
                    $lines[] = '- [' . $category['name'] . '](' . Config::url('/' . $category['slug']) . ')';
                }
                $lines[] = '';
            }

            $articles = $pdo->query(
                'SELECT a.title, a.excerpt, a.slug, c.slug AS category
                 FROM articles a INNER JOIN categories c ON c.id = a.category_id
                 WHERE a.status = "published" AND a.published_at <= NOW()
                 ORDER BY a.published_at DESC LIMIT 30'
            )->fetchAll(PDO::FETCH_ASSOC);
            if ($articles !== []) {
                $lines[] = '## Articles récents';
                foreach ($articles as $article) {
                    $link = Config::url('/' . $article['category'] . '/' . $article['slug']);
                    $excerpt = trim((string) $article['excerpt']);
                    $lines[] = '- [' . $article['title'] . '](' . $link . ')' . ($excerpt !== '' ? ': ' . $excerpt : '');
                }
                $lines[] = '';
            }
        } catch (PDOException) {
            // Still ship a minimal, valid llms.txt below even without a DB.
        }

        $lines[] = '## Pages';
        $lines[] = '- [À propos](' . Config::url('/a-propos') . ')';
        $lines[] = '- [Contact](' . Config::url('/contact') . ')';
        $lines[] = '- [Flux RSS](' . Config::url('/feed.xml') . ')';
        $lines[] = '- [Mentions légales](' . Config::url('/mentions-legales') . ')';
        $lines[] = '- [Politique de confidentialité](' . Config::url('/confidentialite') . ')';

        header('Content-Type: text/markdown; charset=utf-8');
        echo implode("\n", $lines) . "\n";
    }

    public function rss(): void
    {
        $appName = $_ENV['APP_NAME'] ?? 'Le Quotidien Actu';
        $items = '';

        try {
            $statement = $this->pdo()->query(
                'SELECT a.title, a.slug, a.excerpt, a.published_at, c.slug AS category, c.name AS category_name, au.display_name AS author
                 FROM articles a
                 INNER JOIN categories c ON c.id = a.category_id
                 INNER JOIN authors au ON au.id = a.author_id
                 WHERE a.status = "published" AND a.published_at <= NOW()
                 ORDER BY a.published_at DESC LIMIT 30'
            );
            foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $article) {
                $link = Config::url('/' . $article['category'] . '/' . $article['slug']);
                $pubDate = (new \DateTimeImmutable($article['published_at']))->format(DATE_RSS);
                $items .= '<item>'
                    . '<title>' . $this->escape($article['title']) . '</title>'
                    . '<link>' . $this->escape($link) . '</link>'
                    . '<guid isPermaLink="true">' . $this->escape($link) . '</guid>'
                    . '<pubDate>' . $pubDate . '</pubDate>'
                    . '<author>' . $this->escape($article['author']) . '</author>'
                    . '<category>' . $this->escape($article['category_name']) . '</category>'
                    . '<description>' . $this->escape((string) $article['excerpt']) . '</description>'
                    . '</item>';
            }
        } catch (PDOException) {
            // An empty feed is still a valid feed; nothing published yet or DB unavailable.
        }

        header('Content-Type: application/rss+xml; charset=utf-8');
        echo '<?xml version="1.0" encoding="UTF-8"?>'
            . '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">'
            . '<channel>'
            . '<title>' . $this->escape($appName) . '</title>'
            . '<link>' . $this->escape(Config::url('/')) . '</link>'
            . '<atom:link href="' . $this->escape(Config::url('/feed.xml')) . '" rel="self" type="application/rss+xml"/>'
            . '<description>' . $this->escape('Les derniers articles de ' . $appName) . '</description>'
            . '<language>fr</language>'
            . $items
            . '</channel></rss>';
    }

    /**
     * Sitemap index: points search engines (and human visitors, styled via
     * sitemap.xsl) to the per-content-type sitemaps below.
     */
    public function sitemap(): void
    {
        $entries = [
            '/sitemap-pages.xml' => date(DATE_ATOM),
            '/sitemap-categories.xml' => date(DATE_ATOM),
            '/sitemap-articles.xml' => date(DATE_ATOM),
        ];

        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<?xml-stylesheet type="text/xsl" href="' . $this->escape(Config::url('/sitemap.xsl')) . '"?>' . "\n";
        $xml .= '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        foreach ($entries as $path => $lastModified) {
            $xml .= '<sitemap><loc>' . $this->escape(Config::url($path)) . '</loc><lastmod>' . $lastModified . '</lastmod></sitemap>';
        }
        $xml .= '</sitemapindex>';

        $this->xml($xml);
    }

    /**
     * Static/informational pages: home, search, and any editorial page that
     * isn't a category or an article.
     */
    public function pagesSitemap(): void
    {
        $urls = [
            '/' => date(DATE_ATOM),
            '/a-propos' => date(DATE_ATOM),
            '/contact' => date(DATE_ATOM),
            '/mentions-legales' => date(DATE_ATOM),
            '/confidentialite' => date(DATE_ATOM),
            '/simulateur-entree-express' => date(DATE_ATOM),
            '/simulateur-arrima' => date(DATE_ATOM),
        ];
        try {
            $rows = $this->pdo()
                ->query("SELECT slug, updated_at FROM pages WHERE status = 'published'")
                ->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException) {
            $rows = [];
        }
        foreach ($rows as $row) {
            $urls['/' . $row['slug']] = date(DATE_ATOM, strtotime((string) $row['updated_at']));
        }
        $this->xml($this->urlSet($urls));
    }

    public function categoriesSitemap(): void
    {
        $urls = [];
        try {
            $slugs = $this->pdo()
                ->query('SELECT slug FROM categories ORDER BY position, name')
                ->fetchAll(PDO::FETCH_COLUMN);
        } catch (PDOException) {
            $slugs = [];
        }
        // The categories table has no timestamp columns, so every entry
        // shares the current build time rather than a genuine last-modified date.
        foreach ($slugs as $slug) {
            $urls['/' . $slug] = date(DATE_ATOM);
        }
        $this->xml($this->urlSet($urls));
    }

    public function articlesSitemap(): void
    {
        $urls = [];
        try {
            $statement = $this->pdo()->query('SELECT c.slug AS category, a.slug, a.updated_at FROM articles a INNER JOIN categories c ON c.id = a.category_id WHERE a.status = "published" AND a.published_at <= NOW() ORDER BY a.published_at DESC LIMIT 5000');
            foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $path = '/' . $row['category'] . '/' . $row['slug'];
                $urls[$path] = (new \DateTimeImmutable($row['updated_at']))->format(DATE_ATOM);
            }
        } catch (PDOException) {
            // An empty sitemap is valid; nothing published yet or DB unavailable.
        }
        $this->xml($this->urlSet($urls));
    }

    public function newsSitemap(): void
    {
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<?xml-stylesheet type="text/xsl" href="' . $this->escape(Config::url('/sitemap.xsl')) . '"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">';

        try {
            $cutoff = date('Y-m-d H:i:s', time() - 2 * 86400);
            $statement = $this->pdo()->prepare('SELECT c.slug AS category, a.slug, a.title, a.published_at FROM articles a INNER JOIN categories c ON c.id = a.category_id WHERE a.status = "published" AND a.published_at <= NOW() AND a.published_at >= :cutoff ORDER BY a.published_at DESC LIMIT 1000');
            $statement->execute(['cutoff' => $cutoff]);
            foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $path = '/' . $row['category'] . '/' . $row['slug'];
                $publishedAt = (new \DateTimeImmutable($row['published_at']))->format(DATE_ATOM);
                $xml .= '<url><loc>' . $this->escape(Config::url($path)) . '</loc><news:news><news:publication><news:name>Le Quotidien Actu</news:name><news:language>fr</news:language></news:publication><news:publication_date>' . $publishedAt . '</news:publication_date><news:title>' . $this->escape($row['title']) . '</news:title></news:news></url>';
            }
        } catch (PDOException) {
            // An empty news sitemap is valid; nothing recent to report.
        }

        $this->xml($xml . '</urlset>');
    }

    private function urlSet(array $urls): string
    {
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<?xml-stylesheet type="text/xsl" href="' . $this->escape(Config::url('/sitemap.xsl')) . '"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
        foreach ($urls as $path => $lastModified) {
            $xml .= '<url><loc>' . $this->escape(Config::url($path)) . '</loc><lastmod>' . $lastModified . '</lastmod></url>';
        }
        return $xml . '</urlset>';
    }

    private function xml(string $xml): void
    {
        header('Content-Type: application/xml; charset=utf-8');
        echo $xml;
    }

    private function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    }

    private function pdo(): PDO
    {
        return new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $_ENV['DB_HOST'] ?? '127.0.0.1', $_ENV['DB_PORT'] ?? '3306', $_ENV['DB_DATABASE'] ?? ''), $_ENV['DB_USERNAME'] ?? 'root', $_ENV['DB_PASSWORD'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    }
}
