<div class="mx-auto max-w-2xl py-8">
  <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Annonces</p>
  <h1 class="mt-2 text-3xl font-extrabold tracking-tight md:text-5xl">Déposer une annonce</h1>
  <p class="mt-3 text-slate-600">
    Votre annonce sera relue par la rédaction avant publication. Vous recevrez une confirmation par e-mail une fois validée.
  </p>

  <form class="mt-8 grid gap-5 rounded-xl border border-slate-200 bg-white p-6" data-island="listing-form" data-categories-by-type="<?= htmlspecialchars(json_encode($listingCategoriesByType, JSON_UNESCAPED_UNICODE), ENT_QUOTES, 'UTF-8') ?>">
    <label class="text-sm font-semibold">
      Type d’annonce
      <select class="mt-2 w-full rounded border border-slate-300 px-3 py-2" name="type" data-listing-type>
        <option value="classified" <?= $listingType === 'classified' ? 'selected' : '' ?>>Petite annonce</option>
        <option value="job" <?= $listingType === 'job' ? 'selected' : '' ?>>Offre d’emploi</option>
      </select>
    </label>
    <label class="text-sm font-semibold">
      Catégorie
      <select class="mt-2 w-full rounded border border-slate-300 px-3 py-2" name="category" data-listing-category>
        <?php foreach ($listingCategories as $category): ?>
          <option value="<?= htmlspecialchars($category) ?>"><?= htmlspecialchars($category) ?></option>
        <?php endforeach; ?>
      </select>
    </label>
    <label class="text-sm font-semibold">
      Titre
      <input required class="mt-2 w-full rounded border border-slate-300 px-3 py-2" name="title" maxlength="255" placeholder="Ex. Développeur web junior, Appartement 2 pièces à louer…">
    </label>
    <label class="text-sm font-semibold">
      Description
      <textarea required class="mt-2 w-full rounded border border-slate-300 px-3 py-2" name="description" rows="6" maxlength="4000"></textarea>
    </label>
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="text-sm font-semibold">
        Localisation (optionnel)
        <input class="mt-2 w-full rounded border border-slate-300 px-3 py-2" name="location" placeholder="Ex. Yaoundé, Douala…">
      </label>
      <label class="text-sm font-semibold">
        Prix / rémunération (optionnel)
        <input class="mt-2 w-full rounded border border-slate-300 px-3 py-2" name="price" placeholder="Ex. 250 000 FCFA, À négocier…">
      </label>
    </div>
    <div class="border-t border-slate-200 pt-5">
      <p class="text-xs font-bold tracking-widest text-slate-400 uppercase">Contact à afficher sur l’annonce</p>
      <div class="mt-3 grid gap-4 sm:grid-cols-2">
        <label class="text-sm font-semibold">
          Nom (optionnel)
          <input class="mt-2 w-full rounded border border-slate-300 px-3 py-2" name="contact_name">
        </label>
        <label class="text-sm font-semibold">
          Téléphone (optionnel)
          <input class="mt-2 w-full rounded border border-slate-300 px-3 py-2" name="contact_phone">
        </label>
      </div>
      <label class="mt-4 block text-sm font-semibold">
        E-mail de contact (optionnel, affiché publiquement si renseigné)
        <input type="email" class="mt-2 w-full rounded border border-slate-300 px-3 py-2" name="contact_email">
      </label>
    </div>
    <div class="border-t border-slate-200 pt-5">
      <p class="text-xs font-bold tracking-widest text-slate-400 uppercase">Vos coordonnées (non publiées, pour la modération)</p>
      <div class="mt-3 grid gap-4 sm:grid-cols-2">
        <label class="text-sm font-semibold">
          Votre nom
          <input required class="mt-2 w-full rounded border border-slate-300 px-3 py-2" name="poster_name">
        </label>
        <label class="text-sm font-semibold">
          Votre e-mail
          <input required type="email" class="mt-2 w-full rounded border border-slate-300 px-3 py-2" name="poster_email">
        </label>
      </div>
    </div>
    <button type="submit" data-listing-submit class="rounded bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">
      Envoyer l’annonce
    </button>
    <p data-listing-message class="hidden text-sm" role="status" aria-live="polite"></p>
  </form>
</div>
