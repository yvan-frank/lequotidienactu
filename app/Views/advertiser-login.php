<div class="mx-auto max-w-sm py-16">
  <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Espace annonceurs</p>
  <h1 class="mt-2 text-3xl font-extrabold tracking-tight">Connexion</h1>
  <p class="mt-3 text-sm text-slate-600">
    Accédez aux statistiques de vos campagnes publicitaires. Les accès sont créés par notre équipe —
    contactez-nous si vous n’en avez pas encore.
  </p>

  <?php if ($loginError === '1'): ?>
    <p class="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      Identifiants invalides. Réessayez ou contactez-nous.
    </p>
  <?php endif; ?>

  <form class="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-6" method="post" action="/annonceurs/connexion">
    <label class="text-sm font-semibold text-slate-700">
      E-mail
      <input required type="email" name="email" class="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm">
    </label>
    <label class="text-sm font-semibold text-slate-700">
      Mot de passe
      <input required type="password" name="password" class="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm">
    </label>
    <button class="mt-1 rounded bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
      Se connecter
    </button>
  </form>
</div>
