<?php
/**
 * Shared by article.php and article-magazine.php. Expects $article,
 * $readerIsPremium and $sidebarArticles already in scope (PHP `require`
 * shares the including file's local variables).
 */
$customSidebarBlocks = null;
if (($article['sidebar_mode'] ?? 'default') === 'custom' && !empty($article['sidebar_blocks_json'])) {
    $decoded = json_decode((string) $article['sidebar_blocks_json'], true);
    if (is_array($decoded) && $decoded !== []) {
        $customSidebarBlocks = $decoded;
    }
}
?>
<aside class="space-y-6 lg:sticky lg:top-16">
  <?php if ($customSidebarBlocks !== null): ?>
    <?= \App\Support\SidebarBlocks::render($customSidebarBlocks, $readerIsPremium, $article['id'] ?? null) ?>
  <?php else: ?>
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
  <?php endif; ?>
</aside>
