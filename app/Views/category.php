<header class="max-w-3xl py-8">
  <?php if (!empty($parentCategory)): ?>
    <nav class="flex items-center gap-1.5 text-xs font-medium text-slate-500" aria-label="Fil d’Ariane">
      <a class="hover:text-brand-600" href="/">Accueil</a>
      <span aria-hidden="true">/</span>
      <a class="hover:text-brand-600" href="/<?= htmlspecialchars($parentCategory['slug']) ?>"><?= htmlspecialchars($parentCategory['name']) ?></a>
    </nav>
  <?php endif; ?>
  <p class="mt-3 text-xs font-bold tracking-widest text-brand-600 uppercase">Rubrique</p>
  <h1 class="mt-2 text-4xl font-extrabold tracking-tight md:text-6xl"><?= htmlspecialchars($categoryDetails['name'] ?? ucfirst($category)) ?></h1>
  <?php if (!empty($categoryDetails['description'])): ?>
    <p class="mt-3 max-w-2xl text-slate-600"><?= htmlspecialchars($categoryDetails['description']) ?></p>
  <?php endif; ?>
  <?php if (!empty($subcategories)): ?>
    <div class="mt-5 flex flex-wrap gap-2.5">
      <?php foreach ($subcategories as $sub): ?>
        <a class="touch-manipulation inline-flex items-center rounded-full border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:border-brand-600 hover:text-brand-600" href="/<?= htmlspecialchars($sub['slug']) ?>"><?= htmlspecialchars($sub['name']) ?></a>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</header>
<?php if ($articles === []): ?>
  <p class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">Aucun article publié dans cette rubrique pour le moment.</p>
<?php else: ?>
  <div class="grid gap-4 md:grid-cols-2">
    <?php foreach ($articles as $index => $item): ?>
      <article class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <?php if (!empty($item['hero_image'])): ?>
          <img class="h-40 w-full object-cover" src="<?= htmlspecialchars($item['hero_image']) ?>" alt="" width="640" height="360" <?= $index === 0 ? 'fetchpriority="high"' : 'loading="lazy"' ?>>
        <?php endif; ?>
        <div class="p-6">
          <?php if ($item['category'] !== $category): ?>
            <p class="text-xs font-bold tracking-widest text-brand-600 uppercase"><?= htmlspecialchars($item['category_name']) ?></p>
          <?php endif; ?>
          <h2 class="mt-2 text-xl font-bold"><a class="hover:text-brand-600" href="/<?= htmlspecialchars($item['category']) ?>/<?= htmlspecialchars($item['slug']) ?>"><?= htmlspecialchars($item['title']) ?></a></h2>
          <p class="mt-2 text-slate-600"><?= htmlspecialchars($item['excerpt']) ?></p>
        </div>
      </article>
    <?php endforeach; ?>
  </div>
  <div
    data-island="infinite-articles"
    data-category="<?= htmlspecialchars($infiniteScrollCategory) ?>"
    data-current-category="<?= htmlspecialchars($category) ?>"
    data-page="1"
    data-has-more="<?= $hasMoreArticles ? '1' : '0' ?>"
  ></div>
<?php endif; ?>
