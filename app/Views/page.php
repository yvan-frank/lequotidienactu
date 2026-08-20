<header class="max-w-3xl py-8">
  <h1 class="mt-2 text-4xl font-extrabold tracking-tight md:text-6xl"><?= htmlspecialchars($cmsPage['title']) ?></h1>
</header>

<div class="prose prose-slate max-w-3xl pb-14 text-slate-700 prose-headings:font-sans prose-headings:font-extrabold prose-a:text-brand-600 prose-img:rounded-xl">
  <?= $cmsPage['body'] ?>
</div>
