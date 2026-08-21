import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';
import { Select, type SelectOption } from './components/Select';

type DrawRound = {
  id: number;
  draw_date: string;
  draw_type: string;
  crs_cutoff: number;
  invitations_issued: number;
  created_at: string;
  updated_at: string;
};

const inputClass =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none';
const labelClass = 'block text-sm font-semibold text-slate-700';

/**
 * IRCC's Express Entry draw types as of 2026: the long-standing
 * program-specific rounds, plus the category-based rounds introduced in
 * 2023 (French, healthcare, STEM, trades, transport, agriculture,
 * education). Kept as a fixed list rather than free text so entries stay
 * consistent — update here if IRCC adds/retires a category.
 */
const DRAW_TYPES = [
  'Tous les programmes',
  'Travailleurs qualifiés (fédéral)',
  'Travailleurs de métiers spécialisés (fédéral)',
  'Catégorie de l’expérience canadienne',
  'Candidats des provinces',
  'Catégorie : connaissance du français',
  'Catégorie : professions de la santé',
  'Catégorie : STIM (sciences, technologie, ingénierie, mathématiques)',
  'Catégorie : métiers du bâtiment et de la construction',
  'Catégorie : transport',
  'Catégorie : agriculture et agroalimentaire',
  'Catégorie : éducation',
];
const DRAW_TYPE_OPTIONS: SelectOption<string>[] = DRAW_TYPES.map((type) => ({ value: type, label: type }));

function apiErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

export function DrawRounds() {
  const queryClient = useQueryClient();
  const drawRounds = useQuery({
    queryKey: ['admin-draw-rounds'],
    queryFn: async () => (await api.get<{ data: DrawRound[] }>('/admin/draw-rounds')).data.data,
  });
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(
    null,
  );
  const [editing, setEditing] = React.useState<DrawRound | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DrawRound | null>(null);
  const [form, setForm] = React.useState({
    draw_date: '',
    draw_type: '',
    crs_cutoff: '',
    invitations_issued: '',
  });

  const openNew = () => {
    setForm({ draw_date: '', draw_type: '', crs_cutoff: '', invitations_issued: '' });
    setEditing('new');
  };
  const openEdit = (round: DrawRound) => {
    setForm({
      draw_date: round.draw_date,
      draw_type: round.draw_type,
      crs_cutoff: String(round.crs_cutoff),
      invitations_issued: String(round.invitations_issued),
    });
    setEditing(round);
  };

  const payload = () => ({
    draw_date: form.draw_date,
    draw_type: form.draw_type,
    crs_cutoff: Number(form.crs_cutoff),
    invitations_issued: Number(form.invitations_issued),
  });

  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? api.post('/admin/draw-rounds', payload())
        : api.put(`/admin/draw-rounds/${(editing as DrawRound).id}`, payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-draw-rounds'] });
      setToast({ tone: 'success', message: editing === 'new' ? 'Tirage créé.' : 'Tirage mis à jour.' });
      setEditing(null);
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'enregistrer ce tirage.") }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/draw-rounds/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-draw-rounds'] });
      setDeleteTarget(null);
      setToast({ tone: 'success', message: 'Tirage supprimé.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de supprimer ce tirage.') }),
  });

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-orange-700">Immigration</p>
          <h2 className="text-3xl font-bold">Tirages Entrée express</h2>
          <p className="mt-1 text-sm text-slate-500">
            Rondes d’invitations SCG publiées par IRCC. À ajouter manuellement à chaque nouveau
            tirage — affichées sur le simulateur public pour comparer un score aux tirages récents.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800"
        >
          <Plus size={16} /> Nouveau tirage
        </button>
      </header>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        {drawRounds.isLoading && <p className="p-6 text-slate-500">Chargement…</p>}
        {drawRounds.isError && <p className="p-6 text-red-700">Impossible de charger les tirages.</p>}
        {drawRounds.data && drawRounds.data.length === 0 && (
          <p className="flex items-center gap-3 p-6 text-slate-500">
            <CalendarDays size={18} /> Aucun tirage enregistré pour le moment.
          </p>
        )}
        {drawRounds.data && drawRounds.data.length > 0 && (
          <div className="max-w-full overflow-x-auto p-6 contain-layout">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Type de tirage</th>
                  <th className="py-3 pr-4">Score minimal</th>
                  <th className="py-3 pr-4">Invitations</th>
                  <th className="py-3 pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {drawRounds.data.map((round) => (
                  <tr key={round.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 text-slate-700">
                      {new Date(round.draw_date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{round.draw_type}</td>
                    <td className="py-3 pr-4 font-bold text-orange-700 tabular-nums">{round.crs_cutoff}</td>
                    <td className="py-3 pr-4 text-slate-500 tabular-nums">{round.invitations_issued}</td>
                    <td className="py-3 pr-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(round)}
                          className="rounded p-2 text-slate-600 hover:bg-slate-100"
                          aria-label={`Modifier le tirage du ${round.draw_date}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(round)}
                          className="rounded p-2 text-red-700 hover:bg-red-50"
                          aria-label={`Supprimer le tirage du ${round.draw_date}`}
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
                {editing === 'new' ? 'Nouveau tirage' : 'Modifier le tirage'}
              </h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded p-1 hover:bg-slate-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <label className={`mt-5 ${labelClass}`}>
              Date du tirage
              <input
                required
                type="date"
                className={inputClass}
                value={form.draw_date}
                onChange={(event) => setForm({ ...form, draw_date: event.target.value })}
              />
            </label>
            {/* A <div>, not <label> — wrapping the custom Select's button in
                a <label> makes the browser forward every click inside it
                (including clicks on list options) to the button as an
                implicit second click, reopening the dropdown right after a
                selection. */}
            <div className={`mt-4 ${labelClass}`}>
              Type de tirage
              <div className="mt-1">
                <Select
                  value={form.draw_type || null}
                  onChange={(value) => setForm({ ...form, draw_type: value })}
                  options={DRAW_TYPE_OPTIONS}
                  placeholder="Choisir un type de tirage"
                  ariaLabel="Type de tirage"
                />
              </div>
            </div>
            <label className={`mt-4 ${labelClass}`}>
              Score minimal (SCG)
              <input
                required
                type="number"
                min={1}
                max={1200}
                className={inputClass}
                value={form.crs_cutoff}
                onChange={(event) => setForm({ ...form, crs_cutoff: event.target.value })}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Invitations émises
              <input
                required
                type="number"
                min={1}
                className={inputClass}
                value={form.invitations_issued}
                onChange={(event) => setForm({ ...form, invitations_issued: event.target.value })}
              />
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
            <h3 className="mt-2 text-xl font-extrabold">Supprimer ce tirage ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Le tirage du {deleteTarget && new Date(deleteTarget.draw_date).toLocaleDateString('fr-FR')} (
              {deleteTarget?.crs_cutoff} points) sera retiré du simulateur public.
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
