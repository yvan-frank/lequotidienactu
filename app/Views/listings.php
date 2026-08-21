<header class="max-w-3xl py-8">
  <p class="text-xs font-bold tracking-widest text-brand-600 uppercase"><?= $listingType === 'job' ? 'Emploi' : 'Petites annonces' ?></p>
  <h1 class="mt-2 text-4xl font-extrabold tracking-tight md:text-6xl"><?= htmlspecialchars($listingHeading) ?></h1>
  <p class="mt-3 max-w-2xl text-slate-600">
    <?= $listingType === 'job'
      ? 'Offres d’emploi déposées par la communauté, vérifiées avant publication.'
      : 'Annonces déposées par la communauté, vérifiées avant publication.' ?>
  </p>
  <a class="mt-5 inline-flex items-center gap-2 rounded bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700" href="/annonces/deposer?type=<?= htmlspecialchars($listingType) ?>">
    Déposer <?= $listingType === 'job' ? 'une offre' : 'une annonce' ?>
  </a>
</header>

<?php if ($listings === []): ?>
  <p class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">Aucune annonce publiée pour le moment.</p>
<?php else: ?>
  <div class="grid gap-4 md:grid-cols-2">
    <?php foreach ($listings as $item): ?>
      <article class="overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <?php if (!empty($item['category'])): ?>
          <p class="text-xs font-bold tracking-widest text-brand-600 uppercase"><?= htmlspecialchars($item['category']) ?></p>
        <?php endif; ?>
        <h2 class="mt-2 text-xl font-bold">
          <a class="hover:text-brand-600" href="<?= htmlspecialchars($listingBasePath) ?>/<?= htmlspecialchars($item['slug']) ?>"><?= htmlspecialchars($item['title']) ?></a>
        </h2>
        <p class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
          <?php if (!empty($item['location'])): ?><span><?= htmlspecialchars($item['location']) ?></span><?php endif; ?>
          <?php if (!empty($item['price'])): ?><span class="font-semibold text-slate-700"><?= htmlspecialchars($item['price']) ?></span><?php endif; ?>
          <span><?= htmlspecialchars($item['created_at']) ?></span>
        </p>
      </article>
    <?php endforeach; ?>
  </div>
<?php endif; ?>
