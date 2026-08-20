import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, Mail, Send, Trash2, UserX } from 'lucide-react';
import { api } from './api';
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
  const subscribers = useQuery({
    queryKey: ['admin-newsletter'],
    queryFn: async () =>
      (await api.get<{ data: Subscriber[]; meta: Meta }>('/admin/newsletter')).data,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/newsletter/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-newsletter'] });
      setToast({ tone: 'success', message: 'Abonné supprimé.' });
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible de supprimer cet abonné.") }),
  });

  const meta = subscribers.data?.meta;

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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          {subscribers.isLoading && <p className="p-6 text-slate-500">Chargement…</p>}
          {subscribers.isError && <p className="p-6 text-red-700">Impossible de charger les abonnés.</p>}
          {subscribers.data && subscribers.data.data.length === 0 && (
            <p className="flex items-center gap-3 p-6 text-slate-500">
              <Mail size={18} /> Aucun abonné pour le moment.
            </p>
          )}
          {subscribers.data && subscribers.data.data.length > 0 && (
            <div className="max-h-[32rem] max-w-full overflow-x-auto overflow-y-auto p-6 contain-layout">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="border-b border-slate-200 text-xs tracking-wider text-slate-500 uppercase">
                  <tr>
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

        <CampaignForm activeCount={meta?.active ?? 0} setToast={setToast} />
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}

function CampaignForm({
  activeCount,
  setToast,
}: {
  activeCount: number;
  setToast: (toast: { message: string; tone: 'error' | 'success' } | null) => void;
}) {
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const send = useMutation({
    mutationFn: () => api.post<{ message: string }>('/admin/newsletter/send', { subject, body }),
    onSuccess: (response) => {
      setToast({ tone: 'success', message: response.data.message });
      setSubject('');
      setBody('');
      setConfirmOpen(false);
    },
    onError: (error) => {
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'envoyer cette campagne.") });
      setConfirmOpen(false);
    },
  });

  return (
    <section className="h-fit rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-orange-50 text-orange-700">
          <Send size={18} />
        </span>
        <div>
          <h3 className="font-bold">Nouvelle campagne</h3>
          <p className="text-sm text-slate-500">Envoyée aux {activeCount} abonné(s) actif(s).</p>
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
          />
        </label>
        <label className={labelClass}>
          Contenu (texte brut)
          <textarea
            required
            rows={8}
            className={inputClass}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <span className="mt-1 block text-xs text-slate-400">
            Un lien de désinscription est ajouté automatiquement en bas de l'e-mail.
          </span>
        </label>
        <button
          disabled={activeCount === 0}
          className="rounded bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Envoyer la campagne
        </button>
      </form>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-bold tracking-widest text-orange-700 uppercase">Confirmation</p>
            <h3 className="mt-2 text-xl font-extrabold">Envoyer cette campagne ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              « {subject} » sera envoyée à {activeCount} abonné(s) actif(s). Cette action est
              irréversible.
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
