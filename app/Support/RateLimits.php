<?php
declare(strict_types=1);

namespace App\Support;

/**
 * Central registry of rate-limited actions: the bucket key RateLimiter
 * stores hits under, human-facing metadata for the admin settings screen,
 * and the hardcoded fallback used whenever an admin hasn't overridden it
 * (or clears the override back to nothing).
 */
final class RateLimits
{
    public const DEFAULTS = [
        'admin-login' => ['label' => 'Connexion admin', 'description' => 'Tentatives de connexion au back-office.', 'max_attempts' => 5, 'window_seconds' => 900],
        'admin-forgot-password' => ['label' => 'Mot de passe oublié (admin)', 'description' => 'Demandes de réinitialisation de mot de passe depuis l’écran de connexion.', 'max_attempts' => 5, 'window_seconds' => 900],
        'admin-reset-password' => ['label' => 'Réinitialisation de mot de passe (admin)', 'description' => 'Tentatives de définition d’un nouveau mot de passe via le lien reçu par e-mail.', 'max_attempts' => 10, 'window_seconds' => 900],
        'admin-invite' => ['label' => 'Invitation d’utilisateurs', 'description' => 'Envois d’invitations à rejoindre le back-office.', 'max_attempts' => 10, 'window_seconds' => 900],
        'search' => ['label' => 'Recherche', 'description' => 'Requêtes de recherche publique (barre de recherche, page de résultats et défilement infini).', 'max_attempts' => 30, 'window_seconds' => 60],
        'newsletter' => ['label' => 'Inscription newsletter', 'description' => 'Inscriptions à la newsletter depuis le pied de page.', 'max_attempts' => 5, 'window_seconds' => 3600],
        'reaction' => ['label' => 'Réactions aux articles', 'description' => 'Réactions (like, love, clap, insightful) déposées sur les articles.', 'max_attempts' => 20, 'window_seconds' => 300],
        'comment' => ['label' => 'Publication de commentaires', 'description' => 'Nouveaux commentaires postés sur les articles.', 'max_attempts' => 5, 'window_seconds' => 600],
        'comment-report' => ['label' => 'Signalement de commentaires', 'description' => 'Signalements de commentaires envoyés par les visiteurs.', 'max_attempts' => 10, 'window_seconds' => 600],
        'ad-click' => ['label' => 'Clics publicitaires', 'description' => 'Clics enregistrés sur les encarts publicitaires.', 'max_attempts' => 30, 'window_seconds' => 60],
        'contact' => ['label' => 'Formulaire de contact', 'description' => 'Envois du formulaire de contact public.', 'max_attempts' => 5, 'window_seconds' => 600],
    ];

    /**
     * @return array{0: int, 1: int} [maxAttempts, windowSeconds] — an admin
     * override from settings if present and valid, else the bucket's default.
     */
    public static function resolve(string $bucket): array
    {
        $default = self::DEFAULTS[$bucket] ?? ['max_attempts' => 10, 'window_seconds' => 60];
        $configured = Settings::get('rate_limits', [])[$bucket] ?? null;
        if (!is_array($configured) || empty($configured['max_attempts']) || empty($configured['window_seconds'])) {
            return [(int) $default['max_attempts'], (int) $default['window_seconds']];
        }
        return [(int) $configured['max_attempts'], (int) $configured['window_seconds']];
    }
}
