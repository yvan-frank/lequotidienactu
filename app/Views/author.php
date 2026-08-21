<?php
$authorInitial = mb_strtoupper(mb_substr($authorProfile['display_name'] ?? '?', 0, 1));
?>
<header class="max-w-3xl py-8">
  <nav class="flex items-center gap-1.5 text-xs font-medium text-slate-500" aria-label="Fil d’Ariane">
    <a class="hover:text-brand-600" href="/">Accueil</a>
    <span aria-hidden="true">/</span>
    <span class="truncate text-slate-400">Auteurs</span>
  </nav>
  <div class="mt-5 flex items-start gap-4">
    <?php if (!empty($authorProfile['avatar'])): ?>
      <img class="size-16 shrink-0 rounded-full object-cover" src="<?= htmlspecialchars($authorProfile['avatar']) ?>" alt="" width="64" height="64">
    <?php else: ?>
      <span class="grid size-16 shrink-0 place-items-center rounded-full bg-brand-50 text-2xl font-bold text-brand-700" aria-hidden="true"><?= htmlspecialchars($authorInitial) ?></span>
    <?php endif; ?>
    <div class="min-w-0">
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Auteur</p>
      <h1 class="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl"><?= htmlspecialchars($authorProfile['display_name']) ?></h1>
      <?php if (!empty($authorProfile['job_title'])): ?>
        <p class="mt-1 text-sm font-semibold text-slate-500"><?= htmlspecialchars($authorProfile['job_title']) ?></p>
      <?php endif; ?>
    </div>
  </div>
  <?php if (!empty($authorProfile['bio'])): ?>
    <p class="mt-5 max-w-2xl text-slate-600"><?= nl2br(htmlspecialchars($authorProfile['bio'])) ?></p>
  <?php endif; ?>
  <?php if (!empty($authorProfile['disclosure'])): ?>
    <div class="mt-5 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p class="text-xs font-bold tracking-widest text-amber-800 uppercase">Transparence éditoriale</p>
      <p class="mt-1.5 text-sm leading-relaxed text-amber-900"><?= nl2br(htmlspecialchars($authorProfile['disclosure'])) ?></p>
    </div>
  <?php endif; ?>
</header>
<?php if ($articles === []): ?>
  <p class="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">Aucun article publié par cet auteur pour le moment.</p>
<?php else: ?>
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
    data-author="<?= htmlspecialchars($authorProfile['slug']) ?>"
    data-page="1"
    data-has-more="<?= $hasMoreArticles ? '1' : '0' ?>"
  ></div>
<?php endif; ?>
