<?php
/** @var string $title */
$currentPath = rtrim(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/', '/') ?: '/';
$seoSettings = \App\Support\Settings::get('seo', ['ga_measurement_id' => '', 'gsc_verification' => '', 'adsense_client' => '']);
$generalSettings = \App\Support\Settings::get('general', [
    'tagline' => '',
    'contact_email' => '',
    'twitter_url' => '',
    'facebook_url' => '',
    'instagram_url' => '',
    'linkedin_url' => '',
]);
$categoryTree = \App\Support\Categories::tree();
if ($categoryTree === []) {
    $categoryTree = array_map(
        static fn (string $slug, string $name): array => ['id' => 0, 'slug' => $slug, 'name' => $name, 'children' => []],
        ['afrique', 'france-diaspora', 'business', 'tech', 'sport', 'culture'],
        ['Afrique', 'France & Diaspora', 'Business', 'Tech', 'Sport', 'Culture'],
    );
}
?>
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#c2410c">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;family=Source+Serif+4:ital,wght@0,400;0,500;1,500&amp;display=swap" rel="stylesheet">
  <title><?= htmlspecialchars($seo['title'] ?? $title ?? 'Le Quotidien Actu') ?></title>
  <meta name="description" content="<?= htmlspecialchars($seo['description'] ?? 'Actualités Afrique francophone, France et diaspora.') ?>">
  <meta name="robots" content="<?= htmlspecialchars($seo['robots'] ?? 'noindex,nofollow') ?>">
  <link rel="canonical" href="<?= htmlspecialchars($seo['canonical'] ?? ($_ENV['APP_URL'] ?? 'http://localhost:8000')) ?>">
  <link rel="alternate" type="application/rss+xml" title="<?= htmlspecialchars($_ENV['APP_NAME'] ?? 'Le Quotidien Actu') ?>" href="/feed.xml">
  <meta property="og:type" content="<?= htmlspecialchars($seo['og_type'] ?? 'website') ?>">
  <meta property="og:title" content="<?= htmlspecialchars($seo['title'] ?? $title ?? '') ?>">
  <meta property="og:description" content="<?= htmlspecialchars($seo['description'] ?? '') ?>">
  <meta property="og:url" content="<?= htmlspecialchars($seo['canonical'] ?? '') ?>">
  <meta property="og:image" content="<?= htmlspecialchars($seo['og_image'] ?? '') ?>">
  <meta property="og:site_name" content="Le Quotidien Actu">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="<?= htmlspecialchars($seo['title'] ?? $title ?? '') ?>">
  <meta name="twitter:description" content="<?= htmlspecialchars($seo['description'] ?? '') ?>">
  <meta name="twitter:image" content="<?= htmlspecialchars($seo['og_image'] ?? '') ?>">
  <link rel="icon" href="/assets/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" href="/assets/favicon-512.png">
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
  <link rel="stylesheet" href="/assets/public.css">
  <link rel="stylesheet" href="/vendor/swiper/swiper-bundle.min.css">
  <?php foreach ($seo['json_ld'] ?? [] as $schema): ?>
    <script type="application/ld+json"><?= json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) ?></script>
  <?php endforeach; ?>
  <?php if (!empty($seoSettings['gsc_verification'])): ?>
    <meta name="google-site-verification" content="<?= htmlspecialchars($seoSettings['gsc_verification']) ?>">
  <?php endif; ?>
  <?php $needsConsent = (!empty($seoSettings['ga_measurement_id']) || !empty($seoSettings['adsense_client'])) && empty($isPreview); ?>
  <?php if ($needsConsent): ?>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      gtag('consent', 'default', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied',
        wait_for_update: 500,
      });
    </script>
  <?php endif; ?>
  <?php if (!empty($seoSettings['ga_measurement_id']) && empty($isPreview)): ?>
    <script async src="https://www.googletagmanager.com/gtag/js?id=<?= htmlspecialchars($seoSettings['ga_measurement_id']) ?>"></script>
    <script>
      gtag('js', new Date());
      gtag('config', '<?= htmlspecialchars($seoSettings['ga_measurement_id'], ENT_QUOTES) ?>');
    </script>
  <?php endif; ?>
  <?php if (!empty($seoSettings['adsense_client']) && empty($isPreview)): ?>
    <meta name="google-adsense-account" content="<?= htmlspecialchars($seoSettings['adsense_client']) ?>">
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<?= htmlspecialchars($seoSettings['adsense_client']) ?>" crossorigin="anonymous"></script>
  <?php endif; ?>
</head>
<body class="overflow-x-hidden bg-stone-50 font-sans text-slate-900 antialiased">
  <header data-site-header class="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur transition-all duration-300">
    <div data-site-header-inner class="site-header-inner mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-6 py-3 transition-[min-height] duration-300">
      <a class="flex shrink-0 items-center" href="/" aria-label="Le Quotidien Actu - accueil"><img class="site-logo h-14 w-auto max-w-44 object-contain object-left transition-[height] duration-300" src="/assets/logo-header.png" alt="Le Quotidien Actu" width="1482" height="720"></a>
      <nav class="hidden items-center gap-1 text-sm font-medium lg:flex" aria-label="Rubriques">
      <?php foreach ($categoryTree as $navItem): ?>
        <?php
        $slug = $navItem['slug'];
        $children = $navItem['children'] ?? [];
        $childSlugs = array_column($children, 'slug');
        $currentFirstSegment = explode('/', trim($currentPath, '/'))[0] ?? '';
        $isActive = $currentFirstSegment === $slug || in_array($currentFirstSegment, $childSlugs, true);
        $megaMenuFeatured = $navItem['id'] ? \App\Support\Categories::latestArticle((int) $navItem['id']) : null;
        ?>
        <details class="group" data-mega-menu>
          <summary class="relative z-30 flex cursor-pointer list-none items-center gap-1.5 rounded px-2.5 py-2 leading-none transition marker:hidden hover:bg-stone-100 hover:text-brand-600 focus:outline-none focus-visible:text-brand-700 group-open:rounded-t-md group-open:rounded-b-none group-open:border group-open:border-b-stone-50 group-open:border-slate-200 group-open:bg-stone-50 group-open:px-4 group-open:font-semibold group-open:text-brand-700 after:absolute after:top-full after:right-0 after:left-0 after:hidden after:h-6 after:bg-stone-50 group-open:after:block <?= $isActive ? 'bg-stone-50 font-semibold text-brand-700' : 'text-slate-700' ?>"><span><?= htmlspecialchars($navItem['name']) ?></span><svg class="mt-px size-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" /></svg></summary>
          <div class="mega-panel absolute top-full left-0 z-20 hidden w-full overflow-y-auto border-b border-slate-200 bg-stone-50 group-open:block">
            <div class="mx-auto grid max-w-7xl grid-cols-[minmax(220px,0.8fr)_minmax(280px,1.2fr)] gap-12 px-6 py-8">
              <section class="border-r border-slate-200 pr-8"><p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Explorer <?= htmlspecialchars($navItem['name']) ?></p><p class="mt-3 max-w-xs text-sm leading-relaxed text-slate-600">Retrouvez les sujets et les analyses sélectionnés par la rédaction.</p><a class="mt-6 inline-flex rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700" href="/<?= htmlspecialchars($slug) ?>">Toute la rubrique</a></section>
              <div class="grid content-start gap-8 sm:grid-cols-[1fr_1.1fr]">
                <section>
                  <p class="text-xs font-bold tracking-widest text-slate-500 uppercase">Sous-rubriques</p>
                  <?php if ($children === []): ?>
                    <p class="mt-3 text-sm text-slate-500">Pas encore de sous-rubriques.</p>
                  <?php else: ?>
                    <ul class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
                      <?php foreach ($children as $child): ?>
                        <li><a class="block rounded px-2 py-1.5 text-sm text-slate-600 hover:bg-stone-100 hover:text-brand-600" href="/<?= htmlspecialchars($child['slug']) ?>"><?= htmlspecialchars($child['name']) ?></a></li>
                      <?php endforeach; ?>
                    </ul>
                  <?php endif; ?>
                </section>
                <?php if ($megaMenuFeatured !== null): ?>
                  <article class="rounded-lg bg-slate-950 p-6 text-white">
                    <p class="text-xs font-bold tracking-widest text-orange-200 uppercase">Article à la une</p>
                    <h2 class="mt-3 text-xl leading-snug font-bold"><a class="hover:text-orange-200" href="/<?= htmlspecialchars($megaMenuFeatured['category_slug']) ?>/<?= htmlspecialchars($megaMenuFeatured['slug']) ?>"><?= htmlspecialchars($megaMenuFeatured['title']) ?></a></h2>
                    <p class="mt-5 text-sm text-slate-300">Lire l’analyse de la rédaction →</p>
                  </article>
                <?php endif; ?>
              </div>
            </div>
          </div>
        </details>
      <?php endforeach; ?>
      </nav>
      <div class="flex items-center gap-2">
        <div data-island="search-trigger"></div>
        <button class="rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold md:hidden" data-mobile-menu-trigger aria-label="Ouvrir le menu" aria-expanded="false">Menu</button>
      </div>
    </div>
  </header>
  <div data-mega-backdrop aria-hidden="true"></div>
  <div data-mobile-menu class="fixed inset-y-0 right-0 z-50 w-full max-w-xs translate-x-full overflow-y-auto bg-white shadow-2xl transition-transform duration-300 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
    <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
      <p class="text-lg font-bold">Menu</p>
      <button data-mobile-menu-close class="rounded p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer le menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>
    <nav class="p-2" aria-label="Rubriques (mobile)">
      <?php foreach ($categoryTree as $navItem): ?>
        <?php $mobileChildren = $navItem['children'] ?? []; ?>
        <?php if ($mobileChildren === []): ?>
          <a class="block rounded px-3 py-3 font-semibold text-slate-700 hover:bg-slate-100" href="/<?= htmlspecialchars($navItem['slug']) ?>"><?= htmlspecialchars($navItem['name']) ?></a>
        <?php else: ?>
          <details class="group">
            <summary class="flex cursor-pointer list-none items-center justify-between rounded px-3 py-3 font-semibold text-slate-700 marker:hidden hover:bg-slate-100">
              <?= htmlspecialchars($navItem['name']) ?>
              <svg class="size-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </summary>
            <div class="grid gap-0.5 pb-2 pl-3">
              <a class="block rounded px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50" href="/<?= htmlspecialchars($navItem['slug']) ?>">Toute la rubrique</a>
              <?php foreach ($mobileChildren as $child): ?>
                <a class="block rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-brand-600" href="/<?= htmlspecialchars($child['slug']) ?>"><?= htmlspecialchars($child['name']) ?></a>
              <?php endforeach; ?>
            </div>
          </details>
        <?php endif; ?>
      <?php endforeach; ?>
      <a class="mt-2 block rounded px-3 py-3 font-semibold text-slate-700 hover:bg-slate-100" href="/recherche">Recherche</a>
    </nav>
  </div>
  <div data-lightbox-overlay role="dialog" aria-modal="true" aria-label="Image en grand">
    <button type="button" data-lightbox-close aria-label="Fermer">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
    <figure>
      <img data-lightbox-image alt="">
      <figcaption data-lightbox-caption class="is-empty"></figcaption>
    </figure>
  </div>
  <main class="mx-auto max-w-7xl px-6 py-10"><?php require __DIR__ . '/' . ($page ?? '404') . '.php'; ?></main>
  <footer class="w-full bg-slate-950 text-slate-300">
    <div class="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-[1.3fr_2fr] lg:grid-cols-[1.3fr_2.2fr_1fr]">
      <div class="max-w-sm">
        <a class="inline-flex items-center" href="/" aria-label="Le Quotidien Actu - accueil">
          <img class="h-10 w-auto max-w-40 object-contain object-left" src="/assets/logo-header.png" alt="Le Quotidien Actu" width="1482" height="720">
        </a>
        <p class="mt-4 text-sm leading-relaxed text-slate-400">
          <?= htmlspecialchars($generalSettings['tagline'] !== '' ? $generalSettings['tagline'] : 'L’actualité Afrique francophone, France et diaspora : décryptée, vérifiée, sans détour.') ?>
        </p>
        <?php
        $socialLinks = array_filter([
            'X (Twitter)' => $generalSettings['twitter_url'],
            'Facebook' => $generalSettings['facebook_url'],
            'Instagram' => $generalSettings['instagram_url'],
            'LinkedIn' => $generalSettings['linkedin_url'],
        ]);
        ?>
        <?php if ($socialLinks !== []): ?>
          <div class="mt-4 flex items-center gap-3">
            <?php foreach ($socialLinks as $label => $url): ?>
              <a class="text-sm font-semibold text-slate-400 hover:text-white" href="<?= htmlspecialchars($url) ?>" target="_blank" rel="noopener noreferrer"><?= htmlspecialchars($label) ?></a>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
        <form class="mt-6 grid gap-2" data-island="newsletter">
          <label class="text-xs font-bold tracking-widest text-slate-400 uppercase" for="newsletter-email">Newsletter</label>
          <div class="flex gap-2">
            <input class="min-w-0 flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-brand-600 focus:outline-none" id="newsletter-email" type="email" name="email" placeholder="vous@exemple.fr" required>
            <button class="shrink-0 rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">S’inscrire</button>
          </div>
        </form>
      </div>

      <nav class="grid grid-cols-2 gap-8 sm:grid-cols-3" aria-label="Rubriques (pied de page)">
        <?php foreach ($categoryTree as $navItem): ?>
          <div>
            <a class="text-xs font-bold tracking-widest text-white uppercase hover:text-brand-400" href="/<?= htmlspecialchars($navItem['slug']) ?>"><?= htmlspecialchars($navItem['name']) ?></a>
            <?php if (!empty($navItem['children'])): ?>
              <ul class="mt-3 grid gap-2">
                <?php foreach (array_slice($navItem['children'], 0, 5) as $child): ?>
                  <li><a class="text-sm text-slate-400 hover:text-white" href="/<?= htmlspecialchars($child['slug']) ?>"><?= htmlspecialchars($child['name']) ?></a></li>
                <?php endforeach; ?>
              </ul>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
      </nav>

      <div>
        <p class="text-xs font-bold tracking-widest text-white uppercase">Ressources</p>
        <ul class="mt-3 grid gap-2 text-sm">
          <li><a class="text-slate-400 hover:text-white" href="/recherche">Recherche</a></li>
          <li><a class="text-slate-400 hover:text-white" href="/feed.xml">Flux RSS</a></li>
          <li><a class="text-slate-400 hover:text-white" href="/sitemap.xml">Plan du site</a></li>
          <li><a class="text-slate-400 hover:text-white" href="/a-propos">À propos</a></li>
          <li><a class="text-slate-400 hover:text-white" href="/contact">Contact</a></li>
          <li><a class="text-slate-400 hover:text-white" href="/mentions-legales">Mentions légales</a></li>
          <li><a class="text-slate-400 hover:text-white" href="/confidentialite">Politique de confidentialité</a></li>
        </ul>
      </div>
    </div>

    <div class="border-t border-slate-800">
      <div class="mx-auto flex max-w-7xl flex-col gap-2 px-6 py-5 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
        <p>© <?= date('Y') ?> Le Quotidien Actu. Tous droits réservés.</p>
        <div class="flex items-center gap-4">
          <?php if ($needsConsent): ?>
            <button type="button" data-consent-open class="text-slate-500 hover:text-white">Gérer les cookies</button>
          <?php endif; ?>
          <p>Conçu pour l’actualité Afrique, France & diaspora.</p>
        </div>
      </div>
    </div>
  </footer>
  <script type="module" src="/assets/public.js"></script>
  <script type="module" src="/assets/islands.js"></script>
  <?php if ($needsConsent): ?>
    <div id="cookie-consent-scrim" data-consent-scrim class="hidden"></div>
    <div id="cookie-consent" class="fixed inset-x-0 bottom-0 z-50 hidden h-[50vh] overflow-y-auto border-t border-slate-200 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]" role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title">
      <div class="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-4 p-6 text-center sm:p-8">
        <p id="cookie-consent-title" class="text-xl font-bold text-slate-900">Respect de votre vie privée</p>
        <p class="text-sm text-slate-600">
          Nous utilisons des cookies pour mesurer notre audience et afficher des publicités personnalisées. Accédez au site gratuitement en les acceptant, ou optez pour un accès sans suivi ni publicité. Vous pouvez modifier votre choix à tout moment via « Gérer les cookies » en pied de page.
        </p>
        <div class="mt-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button type="button" data-consent-pay class="px-5 py-2.5 text-sm font-semibold text-red-600 hover:text-red-700">Sans accepter 1€</button>
          <button type="button" data-consent-accept class="rounded bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Tout accepter</button>
        </div>
      </div>
    </div>
    <script src="/assets/consent.js" defer></script>
  <?php endif; ?>
</body>
</html>
