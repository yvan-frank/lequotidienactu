<?php
declare(strict_types=1);

namespace App\Http;

use App\Http\Controllers\ApiController;
use App\Http\Controllers\AdminAdsController;
use App\Http\Controllers\AdminArticleController;
use App\Http\Controllers\AdminAuditLogController;
use App\Http\Controllers\AdminAuthController;
use App\Http\Controllers\AdminCommentController;
use App\Http\Controllers\AdminDashboardController;
use App\Http\Controllers\AdminMediaController;
use App\Http\Controllers\AdminNewsletterController;
use App\Http\Controllers\AdminPageController;
use App\Http\Controllers\AdminRedirectController;
use App\Http\Controllers\AdminSettingsController;
use App\Http\Controllers\AdminTaxonomyController;
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\PublicController;
use App\Http\Controllers\SeoController;
use App\Seo\RedirectService;
use App\Support\ScheduledPublisher;

final class Router
{
    public function dispatch(string $method, string $uri): void
    {
        $path = rtrim(parse_url($uri, PHP_URL_PATH) ?: '/', '/') ?: '/';
        if ($method === 'GET' && !str_starts_with($path, '/u/admin')) {
            ScheduledPublisher::run();
        }
        $public = new PublicController();
        $api = new ApiController();
        $adminArticles = new AdminArticleController();
        $adminPages = new AdminPageController();
        $adminAuth = new AdminAuthController();
        $adminMedia = new AdminMediaController();
        $adminTaxonomy = new AdminTaxonomyController();
        $adminRedirects = new AdminRedirectController();
        $adminComments = new AdminCommentController();
        $adminDashboard = new AdminDashboardController();
        $adminAuditLog = new AdminAuditLogController();
        $adminSettings = new AdminSettingsController();
        $adminAds = new AdminAdsController();
        $adminUsers = new AdminUserController();
        $adminNewsletter = new AdminNewsletterController();
        $seo = new SeoController();

        if ($method === 'GET' && ($path === '/u/admin' || str_starts_with($path, '/u/admin/'))) {
            $this->admin();
            return;
        }

        $redirect = (new RedirectService())->destinationFor($path);
        if ($redirect !== null) {
            http_response_code((int) $redirect['status_code']);
            header('Location: ' . $redirect['destination_url']);
            return;
        }

        if ($method === 'GET' && $path === '/robots.txt') {
            $seo->robots();
            return;
        }
        if ($method === 'GET' && $path === '/llms.txt') {
            $seo->llmsTxt();
            return;
        }
        if ($method === 'GET' && $path === '/feed.xml') {
            $seo->rss();
            return;
        }
        if ($method === 'GET' && $path === '/sitemap.xml') {
            $seo->sitemap();
            return;
        }
        if ($method === 'GET' && $path === '/sitemap-news.xml') {
            $seo->newsSitemap();
            return;
        }
        if ($method === 'GET' && $path === '/sitemap-pages.xml') {
            $seo->pagesSitemap();
            return;
        }
        if ($method === 'GET' && $path === '/sitemap-categories.xml') {
            $seo->categoriesSitemap();
            return;
        }
        if ($method === 'GET' && $path === '/sitemap-articles.xml') {
            $seo->articlesSitemap();
            return;
        }

        if ($method === 'GET' && $path === '/api/articles') {
            $api->articles();
            return;
        }
        if ($method === 'GET' && $path === '/api/admin/session') { $adminAuth->session(); return; }
        if ($method === 'POST' && $path === '/api/admin/login') { $adminAuth->login(); return; }
        if ($method === 'POST' && $path === '/api/admin/logout') { $adminAuth->logout(); return; }
        if ($method === 'POST' && $path === '/api/admin/password/forgot') { $adminAuth->forgotPassword(); return; }
        if ($method === 'POST' && $path === '/api/admin/password/reset') { $adminAuth->resetPassword(); return; }
        if ($method === 'GET' && $path === '/api/admin/media') { $adminMedia->index(); return; }
        if ($method === 'POST' && $path === '/api/admin/media') { $adminMedia->upload(); return; }
        if ($method === 'POST' && $path === '/api/admin/media/compress-existing') { $adminMedia->compressExisting(); return; }
        if ($method === 'PUT' && preg_match('#^/api/admin/media/(\d+)$#', $path, $m)) { $adminMedia->update((int) $m[1]); return; }
        if ($method === 'DELETE' && preg_match('#^/api/admin/media/(\d+)$#', $path, $m)) { $adminMedia->delete((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/api/admin/articles') { $adminArticles->index(); return; }
        if ($method === 'GET' && $path === '/api/admin/taxonomy') { $adminArticles->taxonomy(); return; }
        if ($method === 'POST' && $path === '/api/admin/articles') { $adminArticles->create(); return; }
        if ($method === 'GET' && preg_match('#^/api/admin/articles/(\d+)$#', $path, $m)) { $adminArticles->show((int) $m[1]); return; }
        if ($method === 'PUT' && preg_match('#^/api/admin/articles/(\d+)$#', $path, $m)) { $adminArticles->update((int) $m[1]); return; }
        if ($method === 'DELETE' && preg_match('#^/api/admin/articles/(\d+)$#', $path, $m)) { $adminArticles->delete((int) $m[1]); return; }
        if ($method === 'POST' && preg_match('#^/api/admin/articles/(\d+)/transition$#', $path, $m)) { $adminArticles->transition((int) $m[1]); return; }
        if ($method === 'POST' && preg_match('#^/api/admin/articles/(\d+)/featured$#', $path, $m)) { $adminArticles->toggleFeatured((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/api/admin/pages') { $adminPages->index(); return; }
        if ($method === 'POST' && $path === '/api/admin/pages') { $adminPages->create(); return; }
        if ($method === 'GET' && preg_match('#^/api/admin/pages/(\d+)$#', $path, $m)) { $adminPages->show((int) $m[1]); return; }
        if ($method === 'PUT' && preg_match('#^/api/admin/pages/(\d+)$#', $path, $m)) { $adminPages->update((int) $m[1]); return; }
        if ($method === 'DELETE' && preg_match('#^/api/admin/pages/(\d+)$#', $path, $m)) { $adminPages->delete((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/api/admin/categories') { $adminTaxonomy->categories(); return; }
        if ($method === 'POST' && $path === '/api/admin/categories') { $adminTaxonomy->createCategory(); return; }
        if ($method === 'PUT' && preg_match('#^/api/admin/categories/(\d+)$#', $path, $m)) { $adminTaxonomy->updateCategory((int) $m[1]); return; }
        if ($method === 'DELETE' && preg_match('#^/api/admin/categories/(\d+)$#', $path, $m)) { $adminTaxonomy->deleteCategory((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/api/admin/tags') { $adminTaxonomy->tags(); return; }
        if ($method === 'POST' && $path === '/api/admin/tags') { $adminTaxonomy->createTag(); return; }
        if ($method === 'PUT' && preg_match('#^/api/admin/tags/(\d+)$#', $path, $m)) { $adminTaxonomy->updateTag((int) $m[1]); return; }
        if ($method === 'DELETE' && preg_match('#^/api/admin/tags/(\d+)$#', $path, $m)) { $adminTaxonomy->deleteTag((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/api/admin/authors') { $adminTaxonomy->authors(); return; }
        if ($method === 'POST' && $path === '/api/admin/authors') { $adminTaxonomy->createAuthor(); return; }
        if ($method === 'PUT' && preg_match('#^/api/admin/authors/(\d+)$#', $path, $m)) { $adminTaxonomy->updateAuthor((int) $m[1]); return; }
        if ($method === 'DELETE' && preg_match('#^/api/admin/authors/(\d+)$#', $path, $m)) { $adminTaxonomy->deleteAuthor((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/api/admin/redirects') { $adminRedirects->index(); return; }
        if ($method === 'POST' && $path === '/api/admin/redirects') { $adminRedirects->create(); return; }
        if ($method === 'PUT' && preg_match('#^/api/admin/redirects/(\d+)$#', $path, $m)) { $adminRedirects->update((int) $m[1]); return; }
        if ($method === 'DELETE' && preg_match('#^/api/admin/redirects/(\d+)$#', $path, $m)) { $adminRedirects->delete((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/api/admin/dashboard') { $adminDashboard->stats(); return; }
        if ($method === 'GET' && $path === '/api/admin/audit-logs') { $adminAuditLog->index(); return; }
        if ($method === 'GET' && $path === '/api/admin/comments') { $adminComments->index(); return; }
        if ($method === 'PUT' && preg_match('#^/api/admin/comments/(\d+)$#', $path, $m)) { $adminComments->update((int) $m[1]); return; }
        if ($method === 'DELETE' && preg_match('#^/api/admin/comments/(\d+)$#', $path, $m)) { $adminComments->delete((int) $m[1]); return; }
        if ($method === 'POST' && preg_match('#^/api/admin/comments/(\d+)/block$#', $path, $m)) { $adminComments->block((int) $m[1]); return; }
        if ($method === 'POST' && preg_match('#^/api/admin/comments/(\d+)/reply$#', $path, $m)) { $adminComments->reply((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/api/admin/blocked-commenters') { $adminComments->blockedList(); return; }
        if ($method === 'DELETE' && preg_match('#^/api/admin/blocked-commenters/(\d+)$#', $path, $m)) { $adminComments->unblock((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/api/admin/users') { $adminUsers->index(); return; }
        if ($method === 'POST' && $path === '/api/admin/users') { $adminUsers->invite(); return; }
        if ($method === 'PUT' && preg_match('#^/api/admin/users/(\d+)$#', $path, $m)) { $adminUsers->update((int) $m[1]); return; }
        if ($method === 'DELETE' && preg_match('#^/api/admin/users/(\d+)$#', $path, $m)) { $adminUsers->delete((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/api/admin/newsletter') { $adminNewsletter->index(); return; }
        if ($method === 'POST' && $path === '/api/admin/newsletter/send') { $adminNewsletter->send(); return; }
        if ($method === 'DELETE' && preg_match('#^/api/admin/newsletter/(\d+)$#', $path, $m)) { $adminNewsletter->delete((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/api/admin/settings/seo') { $adminSettings->seo(); return; }
        if ($method === 'PUT' && $path === '/api/admin/settings/seo') { $adminSettings->updateSeo(); return; }
        if ($method === 'POST' && $path === '/api/admin/settings/mail/test') { $adminSettings->testMail(); return; }
        if ($method === 'GET' && $path === '/api/admin/settings/general') { $adminSettings->general(); return; }
        if ($method === 'PUT' && $path === '/api/admin/settings/general') { $adminSettings->updateGeneral(); return; }
        if ($method === 'GET' && $path === '/api/admin/settings/revenue') { $adminSettings->revenue(); return; }
        if ($method === 'PUT' && $path === '/api/admin/settings/revenue') { $adminSettings->updateRevenue(); return; }
        if ($method === 'GET' && $path === '/api/admin/settings/head-code') { $adminSettings->headCode(); return; }
        if ($method === 'PUT' && $path === '/api/admin/settings/head-code') { $adminSettings->updateHeadCode(); return; }
        if ($method === 'GET' && $path === '/api/admin/ad-slots') { $adminAds->slots(); return; }
        if ($method === 'GET' && $path === '/api/admin/ads') { $adminAds->index(); return; }
        if ($method === 'POST' && $path === '/api/admin/ads') { $adminAds->create(); return; }
        if ($method === 'PUT' && preg_match('#^/api/admin/ads/(\d+)$#', $path, $m)) { $adminAds->update((int) $m[1]); return; }
        if ($method === 'DELETE' && preg_match('#^/api/admin/ads/(\d+)$#', $path, $m)) { $adminAds->delete((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/api/search') {
            $api->search();
            return;
        }
        if ($method === 'POST' && $path === '/api/newsletter/subscribe') {
            $api->subscribe();
            return;
        }
        if ($method === 'GET' && $path === '/api/newsletter/confirm') { $api->confirmNewsletter(); return; }
        if ($method === 'GET' && $path === '/api/newsletter/unsubscribe') { $api->unsubscribeNewsletter(); return; }
        if ($method === 'GET' && preg_match('#^/api/articles/(\d+)/reactions$#', $path, $m)) { $api->reactions((int) $m[1]); return; }
        if ($method === 'POST' && preg_match('#^/api/articles/(\d+)/reactions$#', $path, $m)) { $api->react((int) $m[1]); return; }
        if ($method === 'GET' && preg_match('#^/api/articles/(\d+)/comments$#', $path, $m)) { $api->comments((int) $m[1]); return; }
        if ($method === 'POST' && preg_match('#^/api/articles/(\d+)/comments$#', $path, $m)) { $api->postComment((int) $m[1]); return; }
        if ($method === 'POST' && preg_match('#^/api/comments/(\d+)/report$#', $path, $m)) { $api->reportComment((int) $m[1]); return; }
        if ($method === 'POST' && preg_match('#^/api/ads/(\d+)/click$#', $path, $m)) { $api->adClick((int) $m[1]); return; }
        if ($method === 'GET' && $path === '/') {
            $public->home();
            return;
        }
        if ($method === 'GET' && $path === '/recherche') {
            $public->search();
            return;
        }
        if ($method === 'GET' && $path === '/mentions-legales') { $public->mentionsLegales(); return; }
        if ($method === 'GET' && $path === '/confidentialite') { $public->confidentialite(); return; }
        if ($method === 'GET' && $path === '/a-propos') { $public->aPropos(); return; }
        if ($method === 'GET' && $path === '/contact') { $public->contact(); return; }
        if ($method === 'POST' && $path === '/contact') { $public->submitContact(); return; }
        if ($method === 'GET' && preg_match('#^/([a-z0-9-]+)$#', $path, $m)) {
            if ($public->categoryExists($m[1])) {
                $public->category($m[1]);
                return;
            }

            if ($public->pageExists($m[1])) {
                $public->page($m[1]);
                return;
            }

            $this->notFound();
            return;
        }
        if ($method === 'GET' && preg_match('#^/([a-z0-9-]+)/([a-z0-9-]+)$#', $path, $m)) {
            if ($public->articleExists($m[1], $m[2])) {
                $public->article($m[1], $m[2]);
                return;
            }

            $this->notFound();
            return;
        }

        $this->notFound();
    }

    private function notFound(): void
    {
        http_response_code(404);
        $title = 'Page introuvable';
        $page = '404';
        require __DIR__ . '/../Views/layout.php';
    }

    private function admin(): void
    {
        $index = dirname(__DIR__, 2) . '/public/admin/index.html';
        if (!is_file($index)) {
            http_response_code(503);
            echo 'Le back-office doit être compilé : pnpm build:admin';
            return;
        }

        header('Content-Type: text/html; charset=utf-8');
        readfile($index);
    }
}
