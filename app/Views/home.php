<?php
// Anything not consumed by "À la une" flows into "Dernières actualités",
// unless the catalog is so small everything is already featured — in that
// case fall back to showing the latest articles anyway rather than leaving
// the section empty.
$featuredIds = array_column($featured, 'id');
$remaining = array_values(array_filter($articles, static fn (array $item): bool => !in_array($item['id'], $featuredIds, true)));
$latest = $remaining !== [] ? array_slice($remaining, 0, 3) : array_slice($articles, 0, 3);
?>

<section class="border-b border-slate-200 pb-10 md:pb-14">
  <p class="text-xs font-bold tracking-[0.18em] text-brand-600 uppercase">À la une</p>
  <?php if ($featured === []): ?>
    <p class="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">Aucun article publié pour le moment.</p>
  <?php else: ?>
    <div class="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
      <div class="featured-swiper swiper relative w-full min-w-0 max-w-full overflow-hidden rounded-xl"><div class="swiper-wrapper"><?php foreach ($featured as $index => $item): ?><article class="swiper-slide group overflow-hidden rounded-xl bg-slate-950 text-white"><div class="flex min-h-80 flex-col justify-end bg-cover bg-center p-7 md:min-h-112 md:p-10" style="background-image:linear-gradient(to top,rgba(15,23,42,.94),rgba(15,23,42,.22)),url('<?= htmlspecialchars($item['hero_image']) ?>')"><p class="text-xs font-bold tracking-widest text-orange-200 uppercase"><?= htmlspecialchars($item['category_name']) ?></p><h1 class="mt-3 max-w-3xl break-words text-3xl leading-tight font-extrabold tracking-tight text-balance md:text-5xl"><a href="/<?= $item['category'] ?>/<?= $item['slug'] ?>" class="group-hover:text-orange-100"><?= htmlspecialchars($item['title']) ?></a></h1><p class="mt-4 max-w-2xl text-slate-200"><?= htmlspecialchars($item['excerpt']) ?></p><p class="mt-5 text-sm text-slate-300"><?= htmlspecialchars($item['published_at']) ?> · <?= $index + 1 ?>/<?= count($featured) ?></p></div></article><?php endforeach; ?></div><button class="featured-prev absolute top-1/2 left-3 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur transition hover:bg-white md:left-4" aria-label="Article précédent">←</button><button class="featured-next absolute top-1/2 right-3 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur transition hover:bg-white md:right-4" aria-label="Article suivant">→</button><div class="featured-pagination mt-4 text-center"></div></div>
      <aside class="min-w-0 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white"><?php foreach (array_slice($featured, 1, 3) as $item): ?><article class="p-5 transition hover:bg-stone-50"><p class="text-xs font-bold tracking-widest text-brand-600 uppercase"><?= htmlspecialchars($item['category_name']) ?></p><h2 class="mt-2 text-lg leading-snug font-bold"><a class="hover:text-brand-600" href="/<?= $item['category'] ?>/<?= $item['slug'] ?>"><?= htmlspecialchars($item['title']) ?></a></h2><p class="mt-2 text-sm text-slate-500"><?= htmlspecialchars($item['published_at']) ?></p></article><?php endforeach; ?></aside>
    </div>
  <?php endif; ?>
</section>

<section class="border-b border-slate-200 py-10 md:py-14"><div class="flex items-end justify-between gap-4"><h2 class="text-2xl font-extrabold tracking-tight">Dernières actualités</h2><a class="text-sm font-semibold text-brand-600 hover:text-brand-700" href="/recherche">Tout voir</a></div><div class="mt-6 grid gap-5 md:grid-cols-3"><?php foreach ($latest as $item): ?><article class="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><img class="h-36 w-full object-cover" src="<?= htmlspecialchars($item['hero_image']) ?>" alt="" width="640" height="360"><div class="p-5"><p class="text-xs font-bold tracking-widest text-brand-600 uppercase"><?= htmlspecialchars($item['category_name']) ?></p><h3 class="mt-2 text-xl leading-snug font-bold"><a class="group-hover:text-brand-600" href="/<?= $item['category'] ?>/<?= $item['slug'] ?>"><?= htmlspecialchars($item['title']) ?></a></h3><p class="mt-3 text-sm text-slate-600"><?= htmlspecialchars($item['excerpt']) ?></p></div></article><?php endforeach; ?></div></section>

<?php foreach ($categorySpotlights as $index => $spotlight): $main = $spotlight['main']; ?>
  <section class="border-b border-slate-200 py-10 md:py-14">
    <p class="text-xs font-bold tracking-[0.18em] text-brand-600 uppercase"><?= htmlspecialchars($spotlight['name']) ?></p>
    <div class="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)]">
      <article>
        <img class="h-52 w-full rounded-xl object-cover" src="<?= htmlspecialchars($main['hero_image'] ?? '') ?>" alt="" width="960" height="540">
        <h2 class="mt-4 text-3xl leading-tight font-extrabold"><a class="hover:text-brand-600" href="/<?= htmlspecialchars($main['category']) ?>/<?= htmlspecialchars($main['slug']) ?>"><?= htmlspecialchars($main['title']) ?></a></h2>
        <p class="mt-3 text-slate-600"><?= htmlspecialchars($main['excerpt'] ?? '') ?></p>
      </article>
      <?php if (!empty($spotlight['list'])): ?>
        <div class="divide-y divide-slate-200 border-y border-slate-200">
          <?php foreach ($spotlight['list'] as $item): ?>
            <article class="py-4">
              <h3 class="mt-1 text-lg font-bold"><a class="hover:text-brand-600" href="/<?= htmlspecialchars($item['category']) ?>/<?= htmlspecialchars($item['slug']) ?>"><?= htmlspecialchars($item['title']) ?></a></h3>
            </article>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
  </section>
  <?php if ($index === 0): ?>
    <div class="my-10"><?= \App\Support\Ads::renderSlot('home_banner') ?></div>
  <?php endif; ?>
<?php endforeach; ?>
<?php if ($categorySpotlights === []): ?>
  <div class="my-10"><?= \App\Support\Ads::renderSlot('home_banner') ?></div>
<?php endif; ?>
