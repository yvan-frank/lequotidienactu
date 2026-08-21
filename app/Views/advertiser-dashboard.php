<div class="py-8">
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Espace annonceurs</p>
      <h1 class="mt-2 text-3xl font-extrabold tracking-tight">Tableau de bord</h1>
      <p class="mt-1 text-sm text-slate-600">Bonjour <?= htmlspecialchars($_SESSION['advertiser']['name']) ?>.</p>
    </div>
    <form method="post" action="/annonceurs/deconnexion">
      <button class="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
        Se déconnecter
      </button>
    </form>
  </div>

  <?php if ($campaigns === []): ?>
    <p class="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
      Aucune campagne associée à votre compte pour le moment.
    </p>
  <?php else: ?>
    <div class="mt-8 max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table class="w-full min-w-[720px] text-left text-sm">
        <thead class="border-b border-slate-200 bg-slate-50 text-xs tracking-wider text-slate-500 uppercase">
          <tr>
            <th class="px-5 py-3">Campagne</th>
            <th class="px-5 py-3">Emplacement</th>
            <th class="px-5 py-3">Période</th>
            <th class="px-5 py-3">Impressions</th>
            <th class="px-5 py-3">Clics</th>
            <th class="px-5 py-3">CTR</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($campaigns as $campaign): ?>
            <tr class="border-b border-slate-100 last:border-0">
              <td class="px-5 py-3 font-semibold text-slate-900"><?= htmlspecialchars($campaign['name']) ?></td>
              <td class="px-5 py-3 text-slate-500"><?= htmlspecialchars($campaign['slot_label']) ?></td>
              <td class="px-5 py-3 text-slate-500">
                <?= $campaign['starts_at'] ? htmlspecialchars((new DateTimeImmutable($campaign['starts_at']))->format('d/m/Y')) : '—' ?>
                –
                <?= $campaign['ends_at'] ? htmlspecialchars((new DateTimeImmutable($campaign['ends_at']))->format('d/m/Y')) : 'en cours' ?>
              </td>
              <td class="px-5 py-3 text-slate-500"><?= (int) $campaign['impressions'] ?></td>
              <td class="px-5 py-3 text-slate-500"><?= (int) $campaign['clicks'] ?></td>
              <td class="px-5 py-3 font-semibold text-slate-700">
                <?= $campaign['impressions'] > 0 ? number_format($campaign['clicks'] / $campaign['impressions'] * 100, 2) . ' %' : '—' ?>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  <?php endif; ?>
</div>
