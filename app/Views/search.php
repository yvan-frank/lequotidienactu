<header class="max-w-3xl py-8">
  <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Recherche</p>
  <h1 class="mt-2 text-4xl font-extrabold tracking-tight md:text-6xl">
    <?= $searchQuery !== '' ? '« ' . htmlspecialchars($searchQuery) . ' »' : 'Rechercher un article' ?>
  </h1>
  <form class="mt-6 flex max-w-xl gap-2" action="/recherche" method="get">
    <label class="sr-only" for="search-query">Votre recherche</label>
    <input class="min-w-0 w-full flex-1 rounded border border-slate-300 px-4 py-2.5 text-base" id="search-query" type="search" name="q" value="<?= htmlspecialchars($searchQuery) ?>" placeholder="Rechercher un article…" autofocus>
    <button class="shrink-0 rounded bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">Rechercher</button>
  </form>
</header>
<?php if ($searchQuery === ''): ?>
  <p class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">Saisissez un mot-clé pour lancer la recherche.</p>
<?php elseif (!empty($searchRateLimited)): ?>
  <p class="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-8 text-amber-800">Trop de recherches en peu de temps. Réessayez dans un instant.</p>
<?php elseif ($articles === []): ?>
  <p class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">Aucun article ne correspond à « <?= htmlspecialchars($searchQuery) ?> ».</p>
<?php else: ?>
  <p class="mb-6 text-sm text-slate-500"><?= count($articles) ?> résultat<?= count($articles) > 1 ? 's' : '' ?></p>
  <div class="grid gap-4 md:grid-cols-2">
    <?php foreach ($articles as $item): ?>
      <article class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <?php if (!empty($item['hero_image'])): ?>
          <img class="h-40 w-full object-cover" src="<?= htmlspecialchars($item['hero_image']) ?>" alt="" width="640" height="360">
        <?php endif; ?>
        <div class="p-6">
          <p class="text-xs font-bold tracking-widest text-brand-600 uppercase"><?= htmlspecialchars($item['category_name']) ?></p>
          <h2 class="mt-2 text-xl font-bold"><a class="hover:text-brand-600" href="/<?= htmlspecialchars($item['category']) ?>/<?= htmlspecialchars($item['slug']) ?>"><?= htmlspecialchars($item['title']) ?></a></h2>
          <p class="mt-2 text-slate-600"><?= htmlspecialchars($item['excerpt']) ?></p>
        </div>
      </article>
    <?php endforeach; ?>
  </div>
  <div
    data-island="infinite-articles"
    data-query="<?= htmlspecialchars($searchQuery) ?>"
    data-page="1"
    data-has-more="<?= $hasMoreArticles ? '1' : '0' ?>"
  ></div>
<?php endif; ?>
