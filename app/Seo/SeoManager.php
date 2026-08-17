<?php
declare(strict_types=1);

namespace App\Seo;

use App\Support\Config;

final class SeoManager
{
    public function forHome(): array
    {
        $title = 'Le Quotidien Actu - L’actualité qui compte';
        $description = 'Actualités Afrique francophone, France et diaspora : Business, Tech, Emploi, Sport et Culture.';

        return $this->document($title, $description, '/', 'website', [
            $this->organization(),
            [
                '@context' => 'https://schema.org',
                '@type' => 'WebSite',
                'name' => 'Le Quotidien Actu',
                'url' => Config::url(),
                'inLanguage' => 'fr-FR',
                'potentialAction' => [
                    '@type' => 'SearchAction',
                    'target' => Config::url('/recherche?q={search_term_string}'),
                    'query-input' => 'required name=search_term_string',
                ],
            ],
        ]);
    }

    public function forCategory(string $name, string $slug): array
    {
        $title = ucfirst($name) . ' - Le Quotidien Actu';
        $path = '/' . $slug;
        $description = 'Toutes les actualités ' . ucfirst($name) . ' sélectionnées par la rédaction de Le Quotidien Actu.';

        return $this->document($title, $description, $path, 'website', [
            $this->breadcrumbs([
                ['name' => 'Accueil', 'path' => '/'],
                ['name' => ucfirst($name), 'path' => $path],
            ]),
        ]);
    }

    public function forArticle(array $article): array
    {
        $path = '/' . $article['category'] . '/' . $article['slug'];
        $title = ($article['meta_title'] ?? null) ?: $article['title'] . ' - Le Quotidien Actu';
        $description = ($article['meta_description'] ?? null) ?: $article['excerpt'];
        $publishedAt = $article['published_at_iso'] ?? date(DATE_ATOM);
        $updatedAt = $article['updated_at_iso'] ?? $publishedAt;

        return $this->document($title, $description, $path, 'article', [
            $this->breadcrumbs([
                ['name' => 'Accueil', 'path' => '/'],
                ['name' => ucfirst($article['category']), 'path' => '/' . $article['category']],
                ['name' => $article['title'], 'path' => $path],
            ]),
            [
                '@context' => 'https://schema.org',
                '@type' => 'NewsArticle',
                'headline' => $article['title'],
                'description' => $description,
                'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => Config::url($path)],
                'datePublished' => $publishedAt,
                'dateModified' => $updatedAt,
                'author' => ['@type' => 'Person', 'name' => $article['author']],
                'publisher' => $this->organization(),
                'image' => [Config::url('/assets/favicon-512.png')],
                'inLanguage' => 'fr-FR',
            ],
        ]);
    }

    public function forSearch(): array
    {
        return $this->document('Recherche - Le Quotidien Actu', 'Recherchez les actualités de Le Quotidien Actu.', '/recherche', 'website', []);
    }

    private function document(string $title, string $description, string $path, string $type, array $jsonLd): array
    {
        return [
            'title' => $title,
            'description' => $description,
            'canonical' => Config::url($path),
            'robots' => 'index,follow,max-image-preview:large',
            'og_type' => $type,
            'og_image' => Config::url('/assets/favicon-512.png'),
            'json_ld' => $jsonLd,
        ];
    }

    private function organization(): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'NewsMediaOrganization',
            'name' => 'Le Quotidien Actu',
            'url' => Config::url(),
            'logo' => Config::url('/assets/logo-header.png'),
        ];
    }

    private function breadcrumbs(array $items): array
    {
        return [
            '@context' => 'https://schema.org',
            '@type' => 'BreadcrumbList',
            'itemListElement' => array_map(
                static fn (array $item, int $position): array => [
                    '@type' => 'ListItem',
                    'position' => $position + 1,
                    'name' => $item['name'],
                    'item' => Config::url($item['path']),
                ],
                $items,
                array_keys($items),
            ),
        ];
    }
}
