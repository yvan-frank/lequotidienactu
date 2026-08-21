import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Check, ClipboardList, Trash2, X } from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';

type Listing = {
  id: number;
  type: 'job' | 'classified';
  category: string | null;
  title: string;
  slug: string;
  location: string | null;
  price: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  poster_name: string;
  poster_email: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expires_at: string | null;
  created_at: string;
};

const statusFilters = [
  ['pending', 'En attente'],
  ['approved', 'Approuvées'],
  ['rejected', 'Rejetées'],
  ['expired', 'Expirées'],
  ['all', 'Toutes'],
] as const;

const typeFilters = [
  ['all', 'Tous types'],
  ['job', 'Offres d’emploi'],
  ['classified', 'Petites annonces'],
] as const;

function apiErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

export function Listings() {
  const [statusFilter, setStatusFilter] = React.useState<(typeof statusFilters)[number][0]>('pending');
  const [typeFilter, setTypeFilter] = React.useState<(typeof typeFilters)[number][0]>('all');
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Listing | null>(null);
  const queryClient = useQueryClient();

  const listings = useQuery({
    queryKey: ['admin-listings', statusFilter, typeFilter],
    queryFn: async () =>
      (
        await api.get<{ data: Listing[] }>('/admin/listings', {
          params: { status: statusFilter, type: typeFilter },
        })
      ).data.data,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Listing['status'] }) =>
      api.put(`/admin/listings/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      setToast({ tone: 'success', message: 'Annonce mise à jour.' });
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible de mettre à jour cette annonce.") }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/listings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-listings'] });
      setDeleteTarget(null);
      setToast({ tone: 'success', message: 'Annonce supprimée.' });
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de supprimer cette annonce.') }),
  });

  return (
    <>
      <header>
        <p className="text-sm font-semibold text-orange-700">Modération</p>
        <h2 className="text-3xl font-bold">Annonces</h2>
        <p className="mt-1 text-sm text-slate-500">
          Offres d’emploi et petites annonces déposées par les visiteurs, en attente de validation.
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer par statut">
          {statusFilters.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={statusFilter === value}
              onClick={() => setStatusFilter(value)}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${statusFilter === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as (typeof typeFilters)[number][0])}
        >
          {typeFilters.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {listings.isLoading && <p className="mt-6 rounded-xl bg-white p-6 text-slate-500">Chargement…</p>}
      {listings.isError && <p className="mt-6 rounded-xl bg-white p-6 text-red-700">Impossible de charger les annonces.</p>}
      {listings.data?.length === 0 && (
        <p className="mt-6 flex items-center gap-3 rounded-xl bg-white p-6 text-slate-500">
          <ClipboardList size={18} /> Aucune annonce pour ce filtre.
        </p>
      )}
      {listings.data && listings.data.length > 0 && (
        <ul className="mt-6 grid gap-3">
          {listings.data.map((listing) => (
            <li key={listing.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 uppercase">
                      <Briefcase size={11} /> {listing.type === 'job' ? 'Emploi' : 'Petite annonce'}
                    </span>
                    {listing.category && (
                      <span className="text-xs font-semibold text-orange-700">{listing.category}</span>
                    )}
                  </div>
                  <p className="mt-1 font-bold text-slate-900">{listing.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {listing.location && <>{listing.location} · </>}
                    {listing.price && <>{listing.price} · </>}
                    Déposée par {listing.poster_name} ({listing.poster_email})
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(listing.created_at).toLocaleString('fr-FR')}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {listing.status !== 'approved' && (
                  <button
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: listing.id, status: 'approved' })}
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <Check size={14} /> Approuver
                  </button>
                )}
                {listing.status !== 'rejected' && (
                  <button
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: listing.id, status: 'rejected' })}
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <X size={14} /> Rejeter
                  </button>
                )}
                <button
                  onClick={() => setDeleteTarget(listing)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-bold tracking-widest text-red-700 uppercase">Suppression</p>
            <h3 className="mt-2 text-xl font-extrabold">Supprimer cette annonce ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">« {deleteTarget.title} »</p>
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
