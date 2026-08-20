import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { api } from './api';

type AuditEntry = {
  id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

const actionFilters = [
  ['', 'Toutes les actions'],
  ['article.', 'Articles'],
  ['category.', 'Rubriques'],
  ['tag.', 'Tags'],
  ['author.', 'Auteurs'],
  ['comment.', 'Commentaires'],
  ['user.', 'Utilisateurs'],
  ['ad.', 'Publicités'],
  ['redirect.', 'Redirections'],
  ['newsletter.', 'Newsletter'],
  ['settings.', 'Paramètres'],
  ['auth.', 'Connexions'],
] as const;

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    'article.create': 'Article créé',
    'article.update': 'Article modifié',
    'article.delete': 'Article supprimé',
    'article.transition': 'Statut d’article changé',
    'category.create': 'Rubrique créée',
    'category.update': 'Rubrique modifiée',
    'category.delete': 'Rubrique supprimée',
    'tag.create': 'Tag créé',
    'tag.update': 'Tag modifié',
    'tag.delete': 'Tag supprimé',
    'author.create': 'Auteur créé',
    'author.update': 'Auteur modifié',
    'author.delete': 'Auteur supprimé',
    'comment.moderate': 'Commentaire modéré',
    'comment.reply': 'Réponse publiée',
    'comment.delete': 'Commentaire supprimé',
    'comment.block': 'Auteur bloqué',
    'comment.unblock': 'Auteur débloqué',
    'user.invite': 'Utilisateur invité',
    'user.update': 'Utilisateur modifié',
    'user.delete': 'Utilisateur supprimé',
    'ad.create': 'Publicité créée',
    'ad.update': 'Publicité modifiée',
    'ad.delete': 'Publicité supprimée',
    'redirect.create': 'Redirection créée',
    'redirect.update': 'Redirection modifiée',
    'redirect.delete': 'Redirection supprimée',
    'newsletter.send': 'Campagne envoyée',
    'newsletter.delete_subscriber': 'Abonné supprimé',
    'settings.update': 'Paramètres modifiés',
    'auth.login': 'Connexion',
  };
  return labels[action] ?? action;
}

export function ActivityLog() {
  const [filter, setFilter] = React.useState<(typeof actionFilters)[number][0]>('');
  const logs = useQuery({
    queryKey: ['admin-audit-logs', filter],
    queryFn: async () =>
      (await api.get<{ data: AuditEntry[] }>('/admin/audit-logs', { params: { action: filter } })).data
        .data,
  });

  return (
    <>
      <header>
        <p className="text-sm font-semibold text-orange-700">Sécurité</p>
        <h2 className="text-3xl font-bold">Journal d’activité</h2>
        <p className="mt-1 text-sm text-slate-500">
          Historique des actions effectuées par les comptes administrateurs (200 dernières).
        </p>
      </header>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filtrer le journal">
        {actionFilters.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-3 py-2 text-sm font-semibold transition ${filter === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {logs.isLoading && <p className="mt-6 rounded-xl bg-white p-6 text-slate-500">Chargement…</p>}
      {logs.isError && (
        <p className="mt-6 rounded-xl bg-white p-6 text-red-700">
          Impossible de charger le journal d’activité.
        </p>
      )}
      {logs.data?.length === 0 && (
        <p className="mt-6 flex items-center gap-3 rounded-xl bg-white p-6 text-slate-500">
          <ScrollText size={18} /> Aucune action enregistrée pour ce filtre.
        </p>
      )}
      {logs.data && logs.data.length > 0 && (
        <section className="mt-6 max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white contain-layout">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wider text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Par</th>
                <th className="px-5 py-3">Détails</th>
                <th className="px-5 py-3">IP</th>
                <th className="px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.data.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-semibold text-slate-900">{actionLabel(entry.action)}</td>
                  <td className="px-5 py-3 text-slate-600">{entry.user_name ?? '—'}</td>
                  <td className="max-w-xs truncate px-5 py-3 text-slate-500">
                    {entry.details ? JSON.stringify(entry.details) : '—'}
                    {entry.entity_type && entry.entity_id ? ` (${entry.entity_type} #${entry.entity_id})` : ''}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-400">{entry.ip_address ?? '—'}</td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {new Date(entry.created_at).toLocaleString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
