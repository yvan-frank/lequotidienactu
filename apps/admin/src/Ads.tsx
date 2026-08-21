import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Eye, MousePointerClick, Megaphone, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';

type AdSlot = { id: number; code: string; label: string; page_scope: string };
type Advertiser = { id: number; name: string; email: string; created_at: string; ads_count: number };
type Ad = {
  id: number;
  ad_slot_id: number;
  slot_code: string;
  slot_label: string;
  advertiser_id: number | null;
  advertiser_name: string | null;
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
  const advertisers = useQuery({
    queryKey: ['admin-advertisers'],
    queryFn: async () => (await api.get<{ data: Advertiser[] }>('/admin/advertisers')).data.data,
  });
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(
    null,
  );
  const [editing, setEditing] = React.useState<Ad | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Ad | null>(null);
  const [advertiserPanelOpen, setAdvertiserPanelOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    ad_slot_id: '',
    advertiser_id: '',
    name: '',
    content_html: '',
    starts_at: '',
    ends_at: '',
  });

  const openNew = () => {
    setForm({
      ad_slot_id: slots.data?.[0] ? String(slots.data[0].id) : '',
      advertiser_id: '',
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
      advertiser_id: ad.advertiser_id ? String(ad.advertiser_id) : '',
      name: ad.name,
      content_html: ad.content_html,
      starts_at: toDatetimeLocal(ad.starts_at),
      ends_at: toDatetimeLocal(ad.ends_at),
    });
    setEditing(ad);
  };

  const payload = () => ({
    ad_slot_id: Number(form.ad_slot_id),
    advertiser_id: form.advertiser_id ? Number(form.advertiser_id) : null,
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
  const [newAdvertiser, setNewAdvertiser] = React.useState({ name: '', email: '', password: '' });
  const createAdvertiser = useMutation({
    mutationFn: () => api.post('/admin/advertisers', newAdvertiser),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-advertisers'] });
      setNewAdvertiser({ name: '', email: '', password: '' });
      setToast({ tone: 'success', message: 'Annonceur créé.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible de créer cet annonceur.") }),
  });
  const removeAdvertiser = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/advertisers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-advertisers'] });
      setToast({ tone: 'success', message: 'Annonceur supprimé.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible de supprimer cet annonceur.") }),
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdvertiserPanelOpen(true)}
            className="inline-flex items-center gap-2 rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Building2 size={16} /> Annonceurs
          </button>
          <button
            onClick={openNew}
            disabled={!slots.data || slots.data.length === 0}
            className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} /> Nouvelle publicité
          </button>
        </div>
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
          <div className="max-w-full overflow-x-auto p-6 contain-layout">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="py-3 pr-4">Campagne</th>
                  <th className="py-3 pr-4">Annonceur</th>
                  <th className="py-3 pr-4">Emplacement</th>
                  <th className="py-3 pr-4">Statut</th>
                  <th className="py-3 pr-4">Impressions</th>
                  <th className="py-3 pr-4">Clics</th>
                  <th className="py-3 pr-4">CTR</th>
                  <th className="py-3 pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ads.data.map((ad) => (
                  <tr key={ad.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 font-semibold text-slate-900">{ad.name}</td>
                    <td className="py-3 pr-4 text-slate-500">{ad.advertiser_name ?? '—'}</td>
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
                    <td className="py-3 pr-4 font-semibold text-slate-700">
                      {ad.impressions > 0 ? `${((ad.clicks / ad.impressions) * 100).toFixed(2)} %` : '—'}
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
              Annonceur (optionnel)
              <select
                className={inputClass}
                value={form.advertiser_id}
                onChange={(event) => setForm({ ...form, advertiser_id: event.target.value })}
              >
                <option value="">Aucun</option>
                {advertisers.data?.map((advertiser) => (
                  <option key={advertiser.id} value={advertiser.id}>
                    {advertiser.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-400">
                Donne accès aux statistiques de cette campagne depuis l’espace annonceurs.
              </span>
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
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
      {advertiserPanelOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-extrabold">Annonceurs</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Créez un accès pour qu’un annonceur consulte les statistiques de ses campagnes sur{' '}
                  <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/annonceurs/connexion</code>.
                </p>
              </div>
              <button type="button" onClick={() => setAdvertiserPanelOpen(false)} className="rounded p-1 hover:bg-slate-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <form
              className="mt-5 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-3"
              onSubmit={(event) => {
                event.preventDefault();
                createAdvertiser.mutate();
              }}
            >
              <input
                required
                placeholder="Nom"
                className={inputClass + ' mt-0'}
                value={newAdvertiser.name}
                onChange={(event) => setNewAdvertiser({ ...newAdvertiser, name: event.target.value })}
              />
              <input
                required
                type="email"
                placeholder="E-mail"
                className={inputClass + ' mt-0'}
                value={newAdvertiser.email}
                onChange={(event) => setNewAdvertiser({ ...newAdvertiser, email: event.target.value })}
              />
              <input
                required
                type="password"
                minLength={8}
                placeholder="Mot de passe"
                className={inputClass + ' mt-0'}
                value={newAdvertiser.password}
                onChange={(event) => setNewAdvertiser({ ...newAdvertiser, password: event.target.value })}
              />
              <button
                disabled={createAdvertiser.isPending}
                className="sm:col-span-3 rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
              >
                {createAdvertiser.isPending ? 'Création…' : 'Créer l’accès'}
              </button>
            </form>

            <div className="mt-5 max-h-64 overflow-y-auto">
              {advertisers.isLoading && <p className="text-sm text-slate-500">Chargement…</p>}
              {advertisers.data?.length === 0 && <p className="text-sm text-slate-500">Aucun annonceur pour le moment.</p>}
              {advertisers.data?.map((advertiser) => (
                <div key={advertiser.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2.5 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{advertiser.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {advertiser.email} · {advertiser.ads_count} campagne{advertiser.ads_count > 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm(`Supprimer l’accès de « ${advertiser.name} » ? Ses campagnes existantes ne sont pas supprimées, juste détachées.`)) {
                        removeAdvertiser.mutate(advertiser.id);
                      }
                    }}
                    className="shrink-0 rounded p-2 text-red-700 hover:bg-red-50"
                    aria-label={`Supprimer l’annonceur ${advertiser.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
