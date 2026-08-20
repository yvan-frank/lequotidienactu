import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, GripVertical, Mail, Newspaper, Send, Trash2, UserX, X } from 'lucide-react';
import { api } from './api';
import { NewsletterArticlePicker, type NewsletterArticleSummary } from './components/NewsletterArticlePicker';
import { Toast } from './components/Toast';

type Subscriber = {
  id: number;
  email: string;
  status: 'pending' | 'active' | 'unsubscribed';
  created_at: string;
  confirmed_at: string | null;
};
type Meta = { pending: number; active: number; unsubscribed: number };

const statusLabels: Record<Subscriber['status'], string> = {
  pending: 'En attente',
  active: 'Actif',
  unsubscribed: 'Désinscrit',
};
const statusClasses: Record<Subscriber['status'], string> = {
  pending: 'bg-amber-100 text-amber-900',
  active: 'bg-emerald-100 text-emerald-900',
  unsubscribed: 'bg-slate-100 text-slate-600',
};

function apiErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

const inputClass =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none';
const labelClass = 'block text-sm font-semibold text-slate-700';

export function Newsletter() {
  const queryClient = useQueryClient();
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(
    null,
  );
  const [selectedSubscriberIds, setSelectedSubscriberIds] = React.useState<number[]>([]);
  const subscribers = useQuery({
    queryKey: ['admin-newsletter'],
    queryFn: async () =>
      (await api.get<{ data: Subscriber[]; meta: Meta }>('/admin/newsletter')).data,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/newsletter/${id}`),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-newsletter'] });
      setSelectedSubscriberIds((current) => current.filter((existing) => existing !== id));
      setToast({ tone: 'success', message: 'Abonné supprimé.' });
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible de supprimer cet abonné.") }),
  });

  const meta = subscribers.data?.meta;
  const activeSubscribers = React.useMemo(
    () => (subscribers.data?.data ?? []).filter((subscriber) => subscriber.status === 'active'),
    [subscribers.data],
  );
  const allActiveSelected =
    activeSubscribers.length > 0 && activeSubscribers.every((subscriber) => selectedSubscriberIds.includes(subscriber.id));

  const toggleSubscriber = (id: number) =>
    setSelectedSubscriberIds((current) =>
      current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id],
    );
  const toggleAllActive = () =>
    setSelectedSubscriberIds(allActiveSelected ? [] : activeSubscribers.map((subscriber) => subscriber.id));

  return (
    <>
      <header>
        <p className="text-sm font-semibold text-orange-700">Audience</p>
        <h2 className="text-3xl font-bold">Newsletter</h2>
        <p className="mt-1 text-sm text-slate-500">
          Abonnés confirmés (double opt-in) et envoi de campagnes.
        </p>
      </header>

      {meta && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
            <span className="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={20} />
            </span>
            <div>
              <p className="text-2xl font-extrabold">{meta.active}</p>
              <p className="text-xs font-semibold text-slate-500 uppercase">Actifs</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
            <span className="grid size-10 place-items-center rounded-lg bg-amber-50 text-amber-700">
              <Clock size={20} />
            </span>
            <div>
              <p className="text-2xl font-extrabold">{meta.pending}</p>
              <p className="text-xs font-semibold text-slate-500 uppercase">En attente</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-5">
            <span className="grid size-10 place-items-center rounded-lg bg-slate-100 text-slate-500">
              <UserX size={20} />
            </span>
            <div>
              <p className="text-2xl font-extrabold">{meta.unsubscribed}</p>
              <p className="text-xs font-semibold text-slate-500 uppercase">Désinscrits</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
            <p className="text-sm text-slate-600">
              {selectedSubscriberIds.length > 0
                ? `${selectedSubscriberIds.length} sélectionné(s) — la campagne ne sera envoyée qu'à eux.`
                : "Aucune sélection — la campagne sera envoyée à tous les abonnés actifs."}
            </p>
            {activeSubscribers.length > 0 && (
              <button
                type="button"
                onClick={toggleAllActive}
                className="shrink-0 text-xs font-semibold text-orange-700 hover:underline"
              >
                {allActiveSelected ? 'Tout désélectionner' : 'Tout sélectionner (actifs)'}
              </button>
            )}
          </div>
          {subscribers.isLoading && <p className="p-6 text-slate-500">Chargement…</p>}
          {subscribers.isError && <p className="p-6 text-red-700">Impossible de charger les abonnés.</p>}
          {subscribers.data && subscribers.data.data.length === 0 && (
            <p className="flex items-center gap-3 p-6 text-slate-500">
              <Mail size={18} /> Aucun abonné pour le moment.
            </p>
          )}
          {subscribers.data && subscribers.data.data.length > 0 && (
            <div className="max-h-[32rem] max-w-full overflow-x-auto overflow-y-auto p-6 contain-layout">
              <table className="w-full min-w-[460px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs tracking-wider text-slate-500 uppercase">
                  <tr>
                    <th className="py-3 pr-4">
                      <span className="sr-only">Sélectionner</span>
                    </th>
                    <th className="py-3 pr-4">E-mail</th>
                    <th className="py-3 pr-4">Statut</th>
                    <th className="py-3 pr-4">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.data.data.map((subscriber) => (
                    <tr key={subscriber.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-4">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 disabled:opacity-30"
                          disabled={subscriber.status !== 'active'}
                          checked={selectedSubscriberIds.includes(subscriber.id)}
                          onChange={() => toggleSubscriber(subscriber.id)}
                          aria-label={`Sélectionner ${subscriber.email}`}
                        />
                      </td>
                      <td className="py-3 pr-4 font-medium text-slate-900">{subscriber.email}</td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[subscriber.status]}`}>
                          {statusLabels[subscriber.status]}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          onClick={() => remove.mutate(subscriber.id)}
                          className="rounded p-2 text-red-700 hover:bg-red-50"
                          aria-label={`Supprimer ${subscriber.email}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <CampaignForm
          activeCount={meta?.active ?? 0}
          selectedSubscriberIds={selectedSubscriberIds}
          setToast={setToast}
        />
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}

function CampaignForm({
  activeCount,
  selectedSubscriberIds,
  setToast,
}: {
  activeCount: number;
  selectedSubscriberIds: number[];
  setToast: (toast: { message: string; tone: 'error' | 'success' } | null) => void;
}) {
  const [subject, setSubject] = React.useState('');
  const [intro, setIntro] = React.useState('');
  const [articles, setArticles] = React.useState<NewsletterArticleSummary[]>([]);
  const [featuredCount, setFeaturedCount] = React.useState(0);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const clampedFeaturedCount = Math.min(featuredCount, articles.length);

  const recipientCount = selectedSubscriberIds.length > 0 ? selectedSubscriberIds.length : activeCount;
  const recipientLabel =
    selectedSubscriberIds.length > 0 ? `${recipientCount} abonné(s) sélectionné(s)` : `${recipientCount} abonné(s) actif(s)`;

  const send = useMutation({
    mutationFn: () =>
      api.post<{ message: string }>('/admin/newsletter/send', {
        subject,
        intro,
        article_ids: articles.map((article) => article.id),
        subscriber_ids: selectedSubscriberIds,
        featured_count: clampedFeaturedCount,
      }),
    onSuccess: (response) => {
      setToast({ tone: 'success', message: response.data.message });
      setSubject('');
      setIntro('');
      setArticles([]);
      setFeaturedCount(0);
      setConfirmOpen(false);
    },
    onError: (error) => {
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'envoyer cette campagne.") });
      setConfirmOpen(false);
    },
  });

  const removeArticle = (id: number) => setArticles((current) => current.filter((article) => article.id !== id));
  const moveArticle = (index: number, direction: -1 | 1) => {
    setArticles((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const canSend = subject.trim() !== '' && articles.length > 0 && recipientCount > 0;

  return (
    <section className="h-fit rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-orange-50 text-orange-700">
          <Send size={18} />
        </span>
        <div>
          <h3 className="font-bold">Nouvelle campagne</h3>
          <p className="text-sm text-slate-500">Sera envoyée à {recipientLabel}.</p>
        </div>
      </div>
      <form
        className="mt-5 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setConfirmOpen(true);
        }}
      >
        <label className={labelClass}>
          Sujet
          <input
            required
            className={inputClass}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Les infos à ne pas manquer cette semaine"
          />
        </label>
        <label className={labelClass}>
          Message d'introduction (optionnel)
          <textarea
            rows={3}
            className={inputClass}
            value={intro}
            onChange={(event) => setIntro(event.target.value)}
            placeholder="Un mot avant les articles…"
          />
        </label>

        <div>
          <div className="flex items-center justify-between">
            <span className={labelClass}>Articles à inclure</span>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100"
            >
              <Newspaper size={13} /> Ajouter des articles
            </button>
          </div>
          {articles.length === 0 ? (
            <p className="mt-2 rounded border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
              Aucun article sélectionné.
            </p>
          ) : (
            <ul className="mt-2 grid gap-2">
              {articles.map((article, index) => (
                <li
                  key={article.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <GripVertical size={14} className="shrink-0 text-slate-300" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{article.title}</span>
                    <span className="text-xs text-slate-500">{article.category_name ?? 'Sans rubrique'}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                      index < clampedFeaturedCount ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {index < clampedFeaturedCount ? 'En avant' : 'Grille'}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveArticle(index, -1)}
                      className="rounded px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                      aria-label={`Monter ${article.title}`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={index === articles.length - 1}
                      onClick={() => moveArticle(index, 1)}
                      className="rounded px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                      aria-label={`Descendre ${article.title}`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeArticle(article.id)}
                      className="rounded p-1 text-red-600 hover:bg-red-100"
                      aria-label={`Retirer ${article.title}`}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {articles.length > 1 && (
            <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
              Articles « en avant » (cartes horizontales)
              <input
                type="number"
                min={0}
                max={articles.length}
                className="w-16 rounded border border-slate-300 px-2 py-1 text-sm focus:border-orange-600 focus:outline-none"
                value={clampedFeaturedCount}
                onChange={(event) => setFeaturedCount(Number(event.target.value))}
              />
              <span className="font-normal text-slate-400">sur {articles.length}</span>
            </label>
          )}
          <p className="mt-2 text-xs text-slate-400">
            Les articles « en avant » (les {clampedFeaturedCount || 0} premiers de la liste) s'affichent en
            grande carte horizontale ; le reste en grille 2 colonnes. Un seul article s'affiche toujours en
            pleine largeur. Un lien de désinscription est ajouté automatiquement en bas.
          </p>
        </div>

        <button
          disabled={!canSend}
          className="rounded bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Envoyer la campagne
        </button>
      </form>

      {pickerOpen && (
        <NewsletterArticlePicker
          alreadySelectedIds={articles.map((article) => article.id)}
          onClose={() => setPickerOpen(false)}
          onConfirm={(picked) => {
            setArticles((current) => [...current, ...picked]);
            setPickerOpen(false);
          }}
        />
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-bold tracking-widest text-orange-700 uppercase">Confirmation</p>
            <h3 className="mt-2 text-xl font-extrabold">Envoyer cette campagne ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              « {subject} » avec {articles.length} article{articles.length > 1 ? 's' : ''} sera envoyée à{' '}
              {recipientLabel}. Cette action est irréversible.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={send.isPending}
                onClick={() => setConfirmOpen(false)}
                className="rounded px-4 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                disabled={send.isPending}
                onClick={() => send.mutate()}
                className="rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
              >
                {send.isPending ? 'Envoi…' : 'Envoyer'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
