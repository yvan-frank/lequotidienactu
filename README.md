# Le Quotidien Actu

Scaffold MVP d'une plateforme média : site public rendu par PHP (SEO), API REST PHP et back-office React isolé.

## Prérequis

- PHP 8.4+ en production (le scaffold reste compatible PHP 8.1 pour le développement local)
- MySQL 8+, Composer et Node.js 22+ avec pnpm

## Démarrer

1. Copier `.env.example` en `.env` et renseigner MySQL.
2. `composer install`
3. `composer migrate`
4. `composer serve`
5. Dans un second terminal : `pnpm install:admin`, puis `pnpm dev:admin`

Le site est disponible sur `http://localhost:8000` et l'administration sur l'URL affichée par Vite (par défaut `http://localhost:5173`).

Après compilation, l’administration est accessible via `http://localhost:8000/u/admin`.

### Administration

- Tableau de bord : `/u/admin`
- Articles : `/u/admin/articles`
- Nouvel article : `/u/admin/articles/new`
- Rubriques et tags : `/u/admin/taxonomy`
- Utilisateurs : `/u/admin/users`
- Paramètres : `/u/admin/settings`

Au premier démarrage local, le compte de démonstration est `admin@lequotidienactu.local` avec le mot de passe `ChangeMe!2026`. Changez ce mot de passe avant tout déploiement.

## Structure

- `app/Http` : router, contrôleurs publics et API.
- `app/Views` : templates SSR, avec des emplacements pour les îlots React.
- `apps/admin` : SPA React (TanStack Router/Query, Axios, TipTap).
- `database/migrations` : schéma éditorial, comptes, SEO, commentaires et publicité.
- `public` : unique document root; les bundles front seront exposés dans `public/assets` lors du build.

Les routes `/api/admin/*` utilisent une session HttpOnly et refusent les visiteurs non authentifiés. Les rôles `admin`, `editor` et `author` peuvent accéder au CMS ; les opérations de création et de transition sont vérifiées côté serveur. Ajoutez une protection CSRF avant d’exposer l’administration sur un domaine public.

## SEO

Le site expose `/robots.txt`, `/sitemap.xml` et `/sitemap-news.xml`. Les pages publiques injectent leurs balises canonical, Open Graph, Twitter Cards et leurs données structurées JSON-LD (`NewsArticle`, `BreadcrumbList`, `NewsMediaOrganization`).

Après `composer migrate`, les redirections permanentes sont administrables dans la table `redirects` : `source_path`, `destination_url` et `status_code` (301 par défaut).
