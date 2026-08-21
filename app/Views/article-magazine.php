<?php
$categorySlug = $article['category'] ?? '';
$categoryName = $article['category_name'] ?? ucfirst($categorySlug);
$canonicalUrl = rtrim($_ENV['APP_URL'] ?? 'http://localhost:8000', '/') . '/' . $categorySlug . '/' . ($article['slug'] ?? '');
$authorInitial = mb_strtoupper(mb_substr($article['author'] ?? '?', 0, 1));
$showUpdated = !empty($article['updated_at_display']) && !empty($article['published_at']) && $article['updated_at_display'] !== $article['published_at'];
$articleBody = \App\Support\ArticleEmbeds::render($article['body'] ?? '<p>' . htmlspecialchars($article['excerpt'] ?? '') . '</p>');
?>
<div data-reading-progress class="fixed inset-x-0 top-0 z-50 -translate-y-full bg-white/95 backdrop-blur transition-transform duration-300" aria-hidden="true">
  <div class="mx-auto flex max-w-7xl items-center gap-3 px-5 py-2.5">
    <span class="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold tracking-widest text-brand-700 uppercase"><?= htmlspecialchars($categoryName) ?></span>
    <p class="truncate text-sm font-semibold text-slate-700"><?= htmlspecialchars($article['title']) ?></p>
  </div>
  <div class="h-1 w-full bg-slate-100">
    <div data-reading-progress-bar class="h-full bg-brand-600" style="width: 0%"></div>
  </div>
</div>

<?php if (!empty($isPreview)): ?>
  <div class="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Aperçu privé — cet article n’est pas encore visible publiquement.</div>
<?php endif; ?>

<nav class="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500" aria-label="Fil d’Ariane">
  <a class="hover:text-brand-600" href="/">Accueil</a>
  <span aria-hidden="true">/</span>
  <a class="hover:text-brand-600" href="/<?= htmlspecialchars($categorySlug) ?>"><?= htmlspecialchars($categoryName) ?></a>
  <span aria-hidden="true">/</span>
  <span class="truncate text-slate-400"><?= htmlspecialchars($article['title']) ?></span>
</nav>

<?php if (!empty($article['hero_image'])): ?>
  <figure class="relative mt-6 -mx-6 overflow-hidden md:mx-0 md:rounded-2xl">
    <img class="aspect-[4/3] w-full cursor-zoom-in object-cover md:aspect-[21/9]" data-lightbox src="<?= htmlspecialchars($article['hero_image']) ?>" alt="<?= htmlspecialchars($article['hero_alt'] ?? '') ?>" width="1600" height="686" fetchpriority="high">
    <div class="absolute inset-0 bg-linear-to-t from-slate-950/90 via-slate-950/20 to-transparent" aria-hidden="true"></div>
    <figcaption class="absolute inset-x-0 bottom-0 px-6 py-8 md:px-14 md:py-12">
      <div class="mx-auto max-w-3xl">
        <p class="flex flex-wrap items-center gap-2 text-xs font-bold tracking-widest text-white uppercase">
          <a class="hover:text-brand-200" href="/<?= htmlspecialchars($categorySlug) ?>"><?= htmlspecialchars($categoryName) ?></a>
          <?php if (!empty($article['is_sponsored'])): ?>
            <span class="rounded-full bg-amber-400/90 px-2.5 py-1 text-[11px] text-amber-950">Sponsorisé</span>
          <?php endif; ?>
        </p>
        <h1 class="mt-3 font-serif text-4xl leading-[1.1] font-extrabold text-balance text-white md:text-6xl"><?= htmlspecialchars($article['title']) ?></h1>
      </div>
    </figcaption>
  </figure>
<?php else: ?>
  <div class="mx-auto mt-8 max-w-3xl text-center">
    <p class="text-xs font-bold tracking-widest text-brand-600 uppercase"><a class="hover:text-brand-700" href="/<?= htmlspecialchars($categorySlug) ?>"><?= htmlspecialchars($categoryName) ?></a></p>
    <h1 class="mt-3 font-serif text-4xl leading-[1.1] font-extrabold text-balance md:text-6xl"><?= htmlspecialchars($article['title']) ?></h1>
  </div>
<?php endif; ?>

<div class="mx-auto grid max-w-3xl gap-10 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
<article class="min-w-0">
  <?php if (!empty($article['excerpt'])): ?>
    <p class="mt-8 text-center font-serif text-2xl leading-relaxed text-slate-600 italic"><?= htmlspecialchars($article['excerpt']) ?></p>
  <?php endif; ?>

  <div class="mt-8 flex flex-wrap items-center justify-between gap-4 border-y border-slate-200 py-4">
    <div class="flex items-center gap-3">
      <span class="grid size-11 shrink-0 place-items-center rounded-full bg-brand-50 text-base font-bold text-brand-700" aria-hidden="true"><?= htmlspecialchars($authorInitial) ?></span>
      <div class="text-sm">
        <p class="font-bold text-slate-900">
          <?php if (!empty($article['author_slug'])): ?>
            <a class="hover:text-brand-600" href="/auteurs/<?= htmlspecialchars($article['author_slug']) ?>"><?= htmlspecialchars($article['author']) ?></a>
          <?php else: ?>
            <?= htmlspecialchars($article['author']) ?>
          <?php endif; ?>
        </p>
        <p class="text-slate-500">
          Publié le <?= htmlspecialchars($article['published_at']) ?>
          <?php if ($showUpdated): ?> · Mis à jour le <?= htmlspecialchars($article['updated_at_display']) ?><?php endif; ?>
          <?php if (!empty($readingMinutes)): ?> · <?= (int) $readingMinutes ?> min de lecture<?php endif; ?>
        </p>
      </div>
    </div>
    <div class="flex items-center gap-1.5" data-share-widget data-url="<?= htmlspecialchars($canonicalUrl) ?>" aria-label="Partager l’article">
      <a class="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:border-brand-600 hover:text-brand-600" href="https://twitter.com/intent/tweet?url=<?= urlencode($canonicalUrl) ?>&text=<?= urlencode($article['title']) ?>" target="_blank" rel="noopener noreferrer" aria-label="Partager sur X"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-7.6 8.7L23.3 22h-7.1l-5.5-7.2L4.3 22H1.2l8.2-9.3L1 2h7.3l5 6.6L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z"/></svg></a>
      <a class="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:border-brand-600 hover:text-brand-600" href="https://www.facebook.com/sharer/sharer.php?u=<?= urlencode($canonicalUrl) ?>" target="_blank" rel="noopener noreferrer" aria-label="Partager sur Facebook"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.5l.4-3H13.5V8.5c0-.9.2-1.5 1.5-1.5h1.6V4.3C16.3 4.2 15.3 4 14.2 4c-2.3 0-3.9 1.4-3.9 4v2.5H7.8v3h2.5V21h3.2Z"/></svg></a>
      <a class="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:border-brand-600 hover:text-brand-600" href="https://www.linkedin.com/sharing/share-offsite/?url=<?= urlencode($canonicalUrl) ?>" target="_blank" rel="noopener noreferrer" aria-label="Partager sur LinkedIn"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3.25a1.95 1.95 0 1 0 0 3.9 1.95 1.95 0 0 0 0-3.9ZM20.44 20h-3.37v-6.06c0-1.44-.03-3.3-2.02-3.3-2.02 0-2.33 1.58-2.33 3.2V20H9.35V8.5h3.24v1.57h.05c.45-.85 1.55-1.75 3.2-1.75 3.42 0 4.6 2.25 4.6 5.17V20Z"/></svg></a>
      <a class="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:border-brand-600 hover:text-brand-600" href="https://wa.me/?text=<?= urlencode($article['title'] . ' ' . $canonicalUrl) ?>" target="_blank" rel="noopener noreferrer" aria-label="Partager sur WhatsApp"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.4A10 10 0 1 0 12 2Zm0 18.2a8.1 8.1 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8.9-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.5c.1-.1.1-.2.2-.4 0-.1 0-.3 0-.4-.1-.1-.6-1.5-.9-2-.2-.6-.4-.5-.6-.5h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-1 2.2c0 1.3.9 2.6 1.1 2.8.1.2 1.9 3 4.7 4.1.6.3 1.1.4 1.5.6.6.2 1.2.1 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2 0-.1-.2-.2-.4-.3Z"/></svg></a>
      <button type="button" class="grid size-9 place-items-center rounded-full border border-slate-200 text-slate-600 transition hover:border-brand-600 hover:text-brand-600" data-copy-link aria-label="Copier le lien"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg></button>
    </div>
  </div>

  <?php if (!empty($article['hero_credit'])): ?>
    <p class="mt-2 text-xs text-slate-400">© <?= htmlspecialchars($article['hero_credit']) ?></p>
  <?php endif; ?>

  <div data-reading-start class="prose prose-slate prose-lg mt-8 max-w-none font-serif leading-[1.85] text-slate-800 [&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:mr-3 [&>p:first-of-type]:first-letter:font-sans [&>p:first-of-type]:first-letter:text-7xl [&>p:first-of-type]:first-letter:leading-[0.85] [&>p:first-of-type]:first-letter:font-extrabold [&>p:first-of-type]:first-letter:text-brand-700 prose-headings:font-sans prose-headings:font-extrabold prose-blockquote:border-brand-600 prose-blockquote:font-serif prose-blockquote:text-2xl prose-blockquote:not-italic prose-a:text-brand-600 prose-img:rounded-xl">
<?= $articleBody ?>
  </div>

  <?php if (!empty($tags)): ?>
    <div class="mt-8 flex flex-wrap gap-2.5">
      <?php foreach ($tags as $tag): ?>
        <a class="touch-manipulation inline-flex items-center rounded-full bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-brand-50 hover:text-brand-700" href="/recherche?q=<?= urlencode($tag['name']) ?>">#<?= htmlspecialchars($tag['name']) ?></a>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>

  <div class="mt-8 flex items-center gap-3" data-island="reactions" data-article-id="<?= (int) ($article['id'] ?? 0) ?>"></div>

  <?php if (!$readerIsPremium): ?>
    <div class="my-10"><?= \App\Support\Ads::renderSlot('article_inline') ?></div>
  <?php endif; ?>

  <?php if (!empty($article['author_bio'])): ?>
    <section class="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-6">
      <span class="grid size-14 shrink-0 place-items-center rounded-full bg-brand-50 text-xl font-bold text-brand-700" aria-hidden="true"><?= htmlspecialchars($authorInitial) ?></span>
      <div class="min-w-0">
        <p class="text-xs font-bold tracking-widest text-slate-400 uppercase">À propos de l’auteur</p>
        <p class="mt-1 text-lg font-bold text-slate-900">
          <?php if (!empty($article['author_slug'])): ?>
            <a class="hover:text-brand-600" href="/auteurs/<?= htmlspecialchars($article['author_slug']) ?>"><?= htmlspecialchars($article['author']) ?></a>
          <?php else: ?>
            <?= htmlspecialchars($article['author']) ?>
          <?php endif; ?>
        </p>
        <?php if (!empty($article['author_job_title'])): ?>
          <p class="text-sm font-semibold text-slate-500"><?= htmlspecialchars($article['author_job_title']) ?></p>
        <?php endif; ?>
        <p class="mt-2 text-sm leading-relaxed text-slate-600"><?= htmlspecialchars($article['author_bio']) ?></p>
        <?php if (!empty($article['author_disclosure'])): ?>
          <div class="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p class="text-[11px] font-bold tracking-widest text-amber-800 uppercase">Transparence éditoriale</p>
            <p class="mt-1 text-sm leading-relaxed text-amber-900"><?= htmlspecialchars($article['author_disclosure']) ?></p>
          </div>
        <?php endif; ?>
      </div>
    </section>
  <?php endif; ?>

  <div class="mt-10" data-island="comments" data-article-id="<?= (int) ($article['id'] ?? 0) ?>"></div>

  <?php if (!empty($related)): ?>
    <section class="mt-14 border-t border-slate-200 pt-10">
      <h2 class="font-serif text-2xl font-extrabold tracking-tight">Articles associés</h2>
      <div class="mt-6 grid gap-5 md:grid-cols-3">
        <?php foreach ($related as $item): ?>
          <article class="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <?php if (!empty($item['hero_image'])): ?>
              <img class="h-36 w-full object-cover" src="<?= htmlspecialchars($item['hero_image']) ?>" alt="" width="640" height="360" loading="lazy">
            <?php endif; ?>
            <div class="p-5">
              <p class="text-xs font-bold tracking-widest text-brand-600 uppercase"><?= htmlspecialchars($item['category_name']) ?></p>
              <h3 class="mt-2 text-lg leading-snug font-bold"><a class="group-hover:text-brand-600" href="/<?= htmlspecialchars($item['category']) ?>/<?= htmlspecialchars($item['slug']) ?>"><?= htmlspecialchars($item['title']) ?></a></h3>
            </div>
          </article>
        <?php endforeach; ?>
      </div>
    </section>
  <?php endif; ?>

  <?php if (!empty($nextArticle)): ?>
    <section class="mt-10 border-t border-slate-200 pt-10">
      <p class="text-xs font-bold tracking-widest text-slate-400 uppercase">Continuer la lecture</p>
      <a class="mt-3 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-md" href="/<?= htmlspecialchars($nextArticle['category']) ?>/<?= htmlspecialchars($nextArticle['slug']) ?>">
        <div class="min-w-0">
          <p class="text-xs font-bold tracking-widest text-brand-600 uppercase"><?= htmlspecialchars($nextArticle['category_name']) ?></p>
          <h3 class="mt-2 truncate text-xl font-bold text-slate-900"><?= htmlspecialchars($nextArticle['title']) ?></h3>
        </div>
        <span class="shrink-0 text-2xl text-brand-600" aria-hidden="true">→</span>
      </a>
    </section>
  <?php endif; ?>
</article>

<aside class="space-y-6 lg:sticky lg:top-16">
  <?php if (!$readerIsPremium): ?>
    <div class="min-h-64"><?= \App\Support\Ads::renderSlot('article_sidebar', 'Publicité · 300 × 250') ?></div>
  <?php endif; ?>

  <?php if (!empty($sidebarArticles)): ?>
    <div class="rounded-xl border border-slate-200 bg-white p-5">
      <p class="text-xs font-bold tracking-widest text-slate-400 uppercase">À lire aussi</p>
      <div class="mt-4 divide-y divide-slate-100">
        <?php foreach ($sidebarArticles as $item): ?>
          <a class="group flex items-center gap-3 py-3 first:pt-0 last:pb-0" href="/<?= htmlspecialchars($item['category']) ?>/<?= htmlspecialchars($item['slug']) ?>">
            <?php if (!empty($item['hero_image'])): ?>
              <img class="size-14 shrink-0 rounded-lg object-cover" src="<?= htmlspecialchars($item['hero_image']) ?>" alt="" width="56" height="56" loading="lazy">
            <?php endif; ?>
            <div class="min-w-0">
              <p class="text-[11px] font-bold tracking-widest text-brand-600 uppercase"><?= htmlspecialchars($item['category_name']) ?></p>
              <h4 class="mt-1 line-clamp-2 text-sm leading-snug font-bold text-slate-900 group-hover:text-brand-600"><?= htmlspecialchars($item['title']) ?></h4>
            </div>
          </a>
        <?php endforeach; ?>
      </div>
    </div>
  <?php endif; ?>
</aside>
</div>
<script>
(() => {
  const button = document.querySelector('[data-copy-link]');
  const widget = document.querySelector('[data-share-widget]');
  if (!button || !widget) return;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(widget.dataset.url || window.location.href);
      const original = button.innerHTML;
      button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      window.setTimeout(() => { button.innerHTML = original; }, 1500);
    } catch {
      window.prompt('Copiez ce lien :', widget.dataset.url || window.location.href);
    }
  });
})();
</script>
