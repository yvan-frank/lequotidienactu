<?php $privacyContactEmail = $generalSettings['contact_email'] !== '' ? $generalSettings['contact_email'] : 'yvanzangue@gmail.com'; ?>
<header class="max-w-3xl py-8">
  <p class="text-xs font-bold tracking-widest text-brand-600 uppercase">Vos données</p>
  <h1 class="mt-2 text-4xl font-extrabold tracking-tight md:text-6xl">Politique de confidentialité</h1>
</header>

<div class="prose prose-slate max-w-3xl pb-14 text-slate-700 prose-headings:font-sans prose-headings:font-extrabold prose-a:text-brand-600">
  <p>
    Cette politique explique quelles données Le Quotidien Actu collecte, pourquoi, et comment vous
    pouvez exercer vos droits, conformément au Règlement général sur la protection des données
    (RGPD).
  </p>

  <h2>Responsable de traitement</h2>
  <p>
    Yvan Zangue, éditeur du site — contact : <a href="mailto:<?= htmlspecialchars($privacyContactEmail) ?>"><?= htmlspecialchars($privacyContactEmail) ?></a>
  </p>

  <h2>Données collectées</h2>
  <ul>
    <li>
      <strong>Cookies techniques</strong> (session, sécurité des formulaires) : nécessaires au
      fonctionnement du site, toujours actifs, aucun consentement requis.
    </li>
    <li>
      <strong>Mesure d’audience</strong> (Google Analytics) : pages visitées, provenance, durée de
      visite — activée uniquement après votre consentement.
    </li>
    <li>
      <strong>Publicité</strong> (Google AdSense) : cookies publicitaires permettant d’afficher des
      annonces, personnalisées uniquement après votre consentement.
    </li>
    <li>
      <strong>Newsletter</strong> : votre adresse e-mail, si vous vous inscrivez volontairement, avec
      confirmation par e-mail (double opt-in). Vous pouvez vous désinscrire à tout moment via le lien
      présent dans chaque envoi.
    </li>
    <li>
      <strong>Commentaires</strong> : nom et contenu du commentaire que vous renseignez, soumis à
      modération avant publication. Votre adresse IP est également conservée, uniquement à des fins
      de lutte contre les abus (spam, harcèlement) et pour permettre de bloquer un auteur en cas de
      besoin.
    </li>
    <li>
      <strong>Formulaire de contact</strong> : nom, e-mail et message que vous nous transmettez
      volontairement.
    </li>
  </ul>

  <h2>Base légale et durée de conservation</h2>
  <p>
    Les cookies de mesure d’audience et de publicité reposent sur votre consentement, valable au
    maximum 13 mois — vous pouvez le retirer à tout moment via « Gérer les cookies » en pied de page.
    Les données de newsletter sont conservées jusqu’à votre désinscription. Les messages de contact
    sont conservés le temps nécessaire au traitement de votre demande.
  </p>

  <h2>Destinataires des données</h2>
  <p>
    Certaines données (mesure d’audience, publicité) sont transmises à Google (Google Analytics,
    Google AdSense), susceptible de les traiter en dehors de l’Union européenne dans le cadre de
    clauses contractuelles types garantissant un niveau de protection adéquat.
  </p>

  <h2>Vos droits</h2>
  <p>
    Conformément au RGPD, vous disposez d’un droit d’accès, de rectification, d’effacement,
    d’opposition et de portabilité sur vos données personnelles. Pour l’exercer, écrivez à
    <a href="mailto:<?= htmlspecialchars($privacyContactEmail) ?>"><?= htmlspecialchars($privacyContactEmail) ?></a> ou utilisez notre
    <a href="/contact">formulaire de contact</a>. Vous pouvez également introduire une réclamation
    auprès de la CNIL (3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07 —
    <a href="https://www.cnil.fr" target="_blank" rel="noreferrer">www.cnil.fr</a>).
  </p>

  <h2>Gestion des cookies</h2>
  <p>
    Vous pouvez modifier votre choix concernant les cookies à tout moment via le lien
    « Gérer les cookies » disponible en bas de chaque page du site.
  </p>
</div>
