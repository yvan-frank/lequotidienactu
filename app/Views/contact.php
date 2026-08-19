<?php
$contactMessages = [
  'envoye' => ['tone' => 'success', 'text' => 'Merci, votre message a bien été envoyé. Nous vous répondrons dès que possible.'],
  'invalide' => ['tone' => 'error', 'text' => 'Merci de renseigner votre nom, un e-mail valide et un message.'],
  'limite' => ['tone' => 'error', 'text' => 'Trop de tentatives. Réessayez dans quelques minutes.'],
  'erreur' => ['tone' => 'error', 'text' => 'Une erreur est survenue. Réessayez plus tard.'],
];
$contactFlash = $contactMessages[$contactStatus] ?? null;
?>
<header class="max-w-3xl py-8">
  <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Contact</p>
  <h1 class="mt-2 text-4xl font-extrabold tracking-tight md:text-6xl">Contactez la rédaction</h1>
  <p class="mt-4 max-w-xl text-slate-600">
    Une question, une suggestion, un signalement à faire ? Écrivez-nous, nous vous répondrons dès que
    possible.
  </p>
</header>

<div class="max-w-xl pb-14">
  <?php if ($contactFlash): ?>
    <p class="mb-6 rounded-lg border p-4 text-sm font-semibold <?= $contactFlash['tone'] === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800' ?>">
      <?= htmlspecialchars($contactFlash['text']) ?>
    </p>
  <?php endif; ?>

  <form class="grid grid-cols-1 gap-4" action="/contact" method="post">
    <div class="hidden" aria-hidden="true">
      <label for="site_web">Laissez ce champ vide</label>
      <input type="text" id="site_web" name="site_web" tabindex="-1" autocomplete="off">
    </div>
    <label class="text-sm font-semibold text-slate-700">
      Nom
      <input required class="mt-1 w-full rounded border border-slate-300 px-3 py-2.5" type="text" name="nom" placeholder="Votre nom">
    </label>
    <label class="text-sm font-semibold text-slate-700">
      E-mail
      <input required class="mt-1 w-full rounded border border-slate-300 px-3 py-2.5" type="email" name="email" placeholder="vous@exemple.fr">
    </label>
    <label class="text-sm font-semibold text-slate-700">
      Message
      <textarea required class="mt-1 w-full rounded border border-slate-300 px-3 py-2.5" name="message" rows="6" placeholder="Votre message"></textarea>
    </label>
    <button class="mt-2 justify-self-start rounded bg-brand-600 px-5 py-2.5 font-semibold text-white hover:bg-brand-700">Envoyer</button>
  </form>
</div>
