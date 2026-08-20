import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { FilePlus2, Pencil, Trash2 } from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';

type Status = 'draft' | 'published';
type CmsPage = {
  id: number;
  title: string;
  slug: string;
  status: Status;
  published_at: string | null;
  updated_at: string;
};

const statusLabel: Record<Status, string> = { draft: 'Brouillon', published: 'Publiée' };
const statusClass: Record<Status, string> = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-emerald-100 text-emerald-700',
};

export function Pages() {
  const queryClient = useQueryClient();
  const pages = useQuery({
    queryKey: ['admin-pages'],
    queryFn: async () => (await api.get<{ data: CmsPage[] }>('/admin/pages')).data.data,
  });
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CmsPage | null>(null);

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/pages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      setDeleteTarget(null);
      setToast({ tone: 'success', message: 'Page supprimée.' });
    },
    onError: (error: any) =>
      setToast({ tone: 'error', message: error.response?.data?.message ?? 'Impossible de supprimer cette page.' }),
  });

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-orange-700">CMS</p>
          <h2 className="text-3xl font-bold">Pages</h2>
          <p className="mt-1 text-sm text-slate-500">
            Pages de contenu libre (partenaires, à propos, etc.). Les 4 pages légales du site restent
            gérées séparément.
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 font-semibold text-white hover:bg-orange-800"
          to="/pages/new"
        >
          <FilePlus2 size={17} /> Nouvelle page
        </Link>
      </header>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        {pages.isLoading && <p className="p-6 text-slate-500">Chargement…</p>}
        {pages.isError && <p className="p-6 text-red-700">Impossible de charger les pages.</p>}
        {pages.data && pages.data.length === 0 && (
          <p className="p-6 text-slate-500">Aucune page pour le moment.</p>
        )}
        {pages.data && pages.data.length > 0 && (
          <div className="max-w-full overflow-x-auto p-6 contain-layout">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="py-3 pr-4">Page</th>
                  <th className="py-3 pr-4">Statut</th>
                  <th className="py-3 pr-4">Mise à jour</th>
                  <th className="py-3 pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pages.data.map((page) => (
                  <tr key={page.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-900">{page.title}</p>
                      <p className="font-mono text-xs text-slate-500">/{page.slug}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[page.status]}`}>
                        {statusLabel[page.status]}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      {new Date(page.updated_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          to="/pages/$pageId"
                          params={{ pageId: String(page.id) }}
                          className="rounded p-2 text-slate-600 hover:bg-slate-100"
                          aria-label={`Modifier la page ${page.title}`}
                        >
                          <Pencil size={16} />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(page)}
                          className="rounded p-2 text-red-700 hover:bg-red-50"
                          aria-label={`Supprimer la page ${page.title}`}
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-bold tracking-widest text-red-700 uppercase">Suppression</p>
            <h3 className="mt-2 text-xl font-extrabold">Supprimer cette page ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              « {deleteTarget.title} » ne sera plus accessible à l’adresse /{deleteTarget.slug}.
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
