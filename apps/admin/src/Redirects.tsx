import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Pencil, Plus, Route, Trash2, X } from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';

type Redirect = {
  id: number;
  source_path: string;
  destination_url: string;
  status_code: number;
  created_at: string;
  updated_at: string;
};

const inputClass =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none';
const labelClass = 'block text-sm font-semibold text-slate-700';

function apiErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

export function Redirects() {
  const queryClient = useQueryClient();
  const redirects = useQuery({
    queryKey: ['admin-redirects'],
    queryFn: async () => (await api.get<{ data: Redirect[] }>('/admin/redirects')).data.data,
  });
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(
    null,
  );
  const [editing, setEditing] = React.useState<Redirect | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Redirect | null>(null);
  const [form, setForm] = React.useState({ source_path: '', destination_url: '', status_code: '301' });

  const openNew = () => {
    setForm({ source_path: '', destination_url: '', status_code: '301' });
    setEditing('new');
  };
  const openEdit = (redirect: Redirect) => {
    setForm({
      source_path: redirect.source_path,
      destination_url: redirect.destination_url,
      status_code: String(redirect.status_code),
    });
    setEditing(redirect);
  };

  const payload = () => ({
    source_path: form.source_path,
    destination_url: form.destination_url,
    status_code: Number(form.status_code),
  });

  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? api.post('/admin/redirects', payload())
        : api.put(`/admin/redirects/${(editing as Redirect).id}`, payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-redirects'] });
      setToast({ tone: 'success', message: editing === 'new' ? 'Redirection créée.' : 'Redirection mise à jour.' });
      setEditing(null);
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'enregistrer cette redirection.") }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/redirects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-redirects'] });
      setDeleteTarget(null);
      setToast({ tone: 'success', message: 'Redirection supprimée.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de supprimer cette redirection.') }),
  });

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-orange-700">SEO</p>
          <h2 className="text-3xl font-bold">Redirections</h2>
          <p className="mt-1 text-sm text-slate-500">
            Créées automatiquement quand un slug d’article ou de rubrique change. Ajoutez-en une
            manuellement pour migrer d’anciennes URLs.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800"
        >
          <Plus size={16} /> Nouvelle redirection
        </button>
      </header>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        {redirects.isLoading && <p className="p-6 text-slate-500">Chargement…</p>}
        {redirects.isError && <p className="p-6 text-red-700">Impossible de charger les redirections.</p>}
        {redirects.data && redirects.data.length === 0 && (
          <p className="flex items-center gap-3 p-6 text-slate-500">
            <Route size={18} /> Aucune redirection pour le moment.
          </p>
        )}
        {redirects.data && redirects.data.length > 0 && (
          <div className="overflow-x-auto p-6">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="py-3 pr-4">Source</th>
                  <th className="py-3 pr-4">Destination</th>
                  <th className="py-3 pr-4">Code</th>
                  <th className="py-3 pr-4">Mise à jour</th>
                  <th className="py-3 pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {redirects.data.map((redirect) => (
                  <tr key={redirect.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-2 font-mono text-xs text-slate-700">
                        {redirect.source_path}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-2 font-mono text-xs text-emerald-700">
                        <ArrowRight size={13} className="shrink-0 text-slate-400" />
                        {redirect.destination_url}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-500">{redirect.status_code}</td>
                    <td className="py-3 pr-4 text-slate-500">
                      {new Date(redirect.updated_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(redirect)}
                          className="rounded p-2 text-slate-600 hover:bg-slate-100"
                          aria-label={`Modifier la redirection ${redirect.source_path}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(redirect)}
                          className="rounded p-2 text-red-700 hover:bg-red-50"
                          aria-label={`Supprimer la redirection ${redirect.source_path}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <form
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold">
                {editing === 'new' ? 'Nouvelle redirection' : 'Modifier la redirection'}
              </h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded p-1 hover:bg-slate-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <label className={`mt-5 ${labelClass}`}>
              URL source
              <input
                required
                className={inputClass}
                placeholder="/ancienne-rubrique/ancien-slug"
                value={form.source_path}
                onChange={(event) => setForm({ ...form, source_path: event.target.value })}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Destination
              <input
                required
                className={inputClass}
                placeholder="/nouvelle-rubrique/nouveau-slug"
                value={form.destination_url}
                onChange={(event) => setForm({ ...form, destination_url: event.target.value })}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Code de statut
              <select
                className={inputClass}
                value={form.status_code}
                onChange={(event) => setForm({ ...form, status_code: event.target.value })}
              >
                <option value="301">301 — Redirection permanente</option>
                <option value="302">302 — Redirection temporaire</option>
                <option value="307">307 — Temporaire (méthode conservée)</option>
                <option value="308">308 — Permanente (méthode conservée)</option>
              </select>
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="rounded px-4 py-2 text-sm font-semibold hover:bg-slate-100">
                Annuler
              </button>
              <button
                disabled={save.isPending}
                className="rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
              >
                {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-bold tracking-widest text-red-700 uppercase">Suppression</p>
            <h3 className="mt-2 text-xl font-extrabold">Supprimer cette redirection ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              « {deleteTarget.source_path} » ne redirigera plus vers « {deleteTarget.destination_url} ».
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={remove.isPending}
                onClick={() => setDeleteTarget(null)}
                className="rounded px-4 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                disabled={remove.isPending}
                onClick={() => remove.mutate(deleteTarget.id)}
                className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {remove.isPending ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </section>
        </div>
      )}
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
