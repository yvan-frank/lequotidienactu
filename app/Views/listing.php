<?php
$isJob = $listing['type'] === 'job';
?>
<div class="mx-auto max-w-3xl py-8">
  <nav class="flex items-center gap-1.5 text-xs font-medium text-slate-500" aria-label="Fil d’Ariane">
    <a class="hover:text-brand-600" href="/">Accueil</a>
    <span aria-hidden="true">/</span>
    <a class="hover:text-brand-600" href="<?= htmlspecialchars($listingBasePath) ?>"><?= $isJob ? 'Emploi' : 'Petites annonces' ?></a>
  </nav>

  <?php if (!empty($listing['category'])): ?>
    <p class="mt-5 text-xs font-bold tracking-widest text-brand-600 uppercase"><?= htmlspecialchars($listing['category']) ?></p>
  <?php endif; ?>
  <h1 class="mt-2 text-3xl font-extrabold tracking-tight md:text-5xl"><?= htmlspecialchars($listing['title']) ?></h1>
  <p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
    <?php if (!empty($listing['location'])): ?><span><?= htmlspecialchars($listing['location']) ?></span><?php endif; ?>
    <?php if (!empty($listing['price'])): ?><span class="font-semibold text-slate-700"><?= htmlspecialchars($listing['price']) ?></span><?php endif; ?>
    <span>Publiée le <?= (new DateTimeImmutable($listing['created_at']))->format('d/m/Y') ?></span>
  </p>

  <div class="prose prose-slate mt-8 max-w-none whitespace-pre-line text-slate-700"><?= nl2br(htmlspecialchars($listing['description'])) ?></div>

  <div class="mt-10 rounded-xl border border-slate-200 bg-white p-6">
    <p class="text-xs font-bold tracking-widest text-slate-400 uppercase">Contact</p>
    <div class="mt-3 grid gap-1.5 text-sm text-slate-700">
      <?php if (!empty($listing['contact_name'])): ?><p><?= htmlspecialchars($listing['contact_name']) ?></p><?php endif; ?>
      <?php if (!empty($listing['contact_email'])): ?>
        <p><a class="font-semibold text-brand-600 hover:text-brand-700" href="mailto:<?= htmlspecialchars($listing['contact_email']) ?>"><?= htmlspecialchars($listing['contact_email']) ?></a></p>
      <?php endif; ?>
      <?php if (!empty($listing['contact_phone'])): ?><p><?= htmlspecialchars($listing['contact_phone']) ?></p><?php endif; ?>
      <?php if (empty($listing['contact_name']) && empty($listing['contact_email']) && empty($listing['contact_phone'])): ?>
        <p class="text-slate-500">Aucun contact renseigné pour cette annonce.</p>
      <?php endif; ?>
    </div>
  </div>
</div>
