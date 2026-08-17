<?php
declare(strict_types=1);

namespace App\Http\Controllers;

use App\Support\Config;
use PDO;
use PDOException;

final class SeoController
{
    public function robots(): void
    {
        header('Content-Type: text/plain; charset=utf-8');
        echo "User-agent: *\nAllow: /\nDisallow: /api/admin/\nDisallow: /admin/\n\nSitemap: " . Config::url('/sitemap.xml') . "\nSitemap: " . Config::url('/sitemap-news.xml') . "\n";
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
        $urls = ['/' => date(DATE_ATOM)];
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
