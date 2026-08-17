import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, MousePointerClick, Megaphone, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';

type AdSlot = { id: number; code: string; label: string; page_scope: string };
type Ad = {
  id: number;
  ad_slot_id: number;
  slot_code: string;
  slot_label: string;
  name: string;
  content_html: string;
  starts_at: string | null;
  ends_at: string | null;
  impressions: number;
  clicks: number;
};

const inputClass =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none';
const labelClass = 'block text-sm font-semibold text-slate-700';

function apiErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

function isActive(ad: Ad): boolean {
  const now = new Date();
  if (ad.starts_at && new Date(ad.starts_at.replace(' ', 'T')) > now) return false;
  if (ad.ends_at && new Date(ad.ends_at.replace(' ', 'T')) < now) return false;
  return true;
}

function toDatetimeLocal(value: string | null): string {
  return value ? value.slice(0, 16).replace(' ', 'T') : '';
}

export function Ads() {
  const queryClient = useQueryClient();
  const slots = useQuery({
    queryKey: ['admin-ad-slots'],
    queryFn: async () => (await api.get<{ data: AdSlot[] }>('/admin/ad-slots')).data.data,
  });
  const ads = useQuery({
    queryKey: ['admin-ads'],
    queryFn: async () => (await api.get<{ data: Ad[] }>('/admin/ads')).data.data,
  });
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(
    null,
  );
  const [editing, setEditing] = React.useState<Ad | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Ad | null>(null);
  const [form, setForm] = React.useState({
    ad_slot_id: '',
    name: '',
    content_html: '',
    starts_at: '',
    ends_at: '',
  });

  const openNew = () => {
    setForm({
      ad_slot_id: slots.data?.[0] ? String(slots.data[0].id) : '',
      name: '',
      content_html: '',
      starts_at: '',
      ends_at: '',
    });
    setEditing('new');
  };
  const openEdit = (ad: Ad) => {
    setForm({
      ad_slot_id: String(ad.ad_slot_id),
      name: ad.name,
      content_html: ad.content_html,
      starts_at: toDatetimeLocal(ad.starts_at),
      ends_at: toDatetimeLocal(ad.ends_at),
    });
    setEditing(ad);
  };

  const payload = () => ({
    ad_slot_id: Number(form.ad_slot_id),
    name: form.name,
    content_html: form.content_html,
    starts_at: form.starts_at || null,
    ends_at: form.ends_at || null,
  });

  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? api.post('/admin/ads', payload())
        : api.put(`/admin/ads/${(editing as Ad).id}`, payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ads'] });
      setToast({ tone: 'success', message: editing === 'new' ? 'Publicité créée.' : 'Publicité mise à jour.' });
      setEditing(null);
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'enregistrer cette publicité.") }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/ads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ads'] });
      setDeleteTarget(null);
      setToast({ tone: 'success', message: 'Publicité supprimée.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de supprimer cette publicité.') }),
  });

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-orange-700">Monétisation</p>
          <h2 className="text-3xl font-bold">Publicité</h2>
          <p className="mt-1 text-sm text-slate-500">
            Gérez les créations publicitaires diffusées sur les emplacements du site public.
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={!slots.data || slots.data.length === 0}
          className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={16} /> Nouvelle publicité
        </button>
      </header>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        {ads.isLoading && <p className="p-6 text-slate-500">Chargement…</p>}
        {ads.isError && <p className="p-6 text-red-700">Impossible de charger les publicités.</p>}
        {ads.data && ads.data.length === 0 && (
          <p className="flex items-center gap-3 p-6 text-slate-500">
            <Megaphone size={18} /> Aucune publicité pour le moment. Les emplacements affichent un
            encart de réserve tant qu’aucune campagne active n’est configurée.
          </p>
        )}
        {ads.data && ads.data.length > 0 && (
          <div className="overflow-x-auto p-6">
            <table className="w-full min-w-[840px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="py-3 pr-4">Campagne</th>
                  <th className="py-3 pr-4">Emplacement</th>
                  <th className="py-3 pr-4">Statut</th>
                  <th className="py-3 pr-4">Impressions</th>
                  <th className="py-3 pr-4">Clics</th>
                  <th className="py-3 pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ads.data.map((ad) => (
                  <tr key={ad.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 font-semibold text-slate-900">{ad.name}</td>
                    <td className="py-3 pr-4 text-slate-500">{ad.slot_label}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          isActive(ad) ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isActive(ad) ? 'Active' : 'Planifiée / expirée'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Eye size={14} className="text-slate-400" /> {ad.impressions}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <MousePointerClick size={14} className="text-slate-400" /> {ad.clicks}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(ad)}
                          className="rounded p-2 text-slate-600 hover:bg-slate-100"
                          aria-label={`Modifier la publicité ${ad.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(ad)}
                          className="rounded p-2 text-red-700 hover:bg-red-50"
                          aria-label={`Supprimer la publicité ${ad.name}`}
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
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold">
                {editing === 'new' ? 'Nouvelle publicité' : 'Modifier la publicité'}
              </h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded p-1 hover:bg-slate-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <label className={`mt-5 ${labelClass}`}>
              Nom de la campagne
              <input
                required
                className={inputClass}
                placeholder="ex. Annonceur X — août 2026"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Emplacement
              <select
                required
                className={inputClass}
                value={form.ad_slot_id}
                onChange={(event) => setForm({ ...form, ad_slot_id: event.target.value })}
              >
                {slots.data?.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Contenu HTML
              <textarea
                required
                rows={5}
                className={`${inputClass} font-mono text-xs`}
                placeholder='<a href="https://annonceur.example"><img src="https://..." alt="..."></a>'
                value={form.content_html}
                onChange={(event) => setForm({ ...form, content_html: event.target.value })}
              />
              <span className="mt-1 block text-xs text-slate-400">
                Code HTML libre (image + lien, iframe, etc.). Les clics sont comptabilisés
                automatiquement quel que soit le contenu.
              </span>
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Début de diffusion
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.starts_at}
                  onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
                />
                <span className="mt-1 block text-xs text-slate-400">Vide = immédiat</span>
              </label>
              <label className={labelClass}>
                Fin de diffusion
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={form.ends_at}
                  onChange={(event) => setForm({ ...form, ends_at: event.target.value })}
                />
                <span className="mt-1 block text-xs text-slate-400">Vide = sans expiration</span>
              </label>
            </div>
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
            <h3 className="mt-2 text-xl font-extrabold">Supprimer cette publicité ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              « {deleteTarget.name} » ne sera plus diffusée sur « {deleteTarget.slot_label} ».
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
