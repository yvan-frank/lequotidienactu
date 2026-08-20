import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';

type UserRole = 'admin' | 'editor' | 'author' | 'reader';
type AdminUser = { id: number; name: string; email: string; role: UserRole; created_at: string };

const inputClass =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none';
const labelClass = 'block text-sm font-semibold text-slate-700';

const roleLabels: Record<UserRole, string> = {
  admin: 'Administrateur',
  editor: 'Éditeur',
  author: 'Auteur',
  reader: 'Lecteur',
};
const roleClasses: Record<UserRole, string> = {
  admin: 'bg-orange-100 text-orange-900',
  editor: 'bg-blue-100 text-blue-900',
  author: 'bg-emerald-100 text-emerald-900',
  reader: 'bg-slate-100 text-slate-600',
};

function apiErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

export function Users() {
  const queryClient = useQueryClient();
  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get<{ data: AdminUser[] }>('/admin/users')).data.data,
  });
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(
    null,
  );
  const [editing, setEditing] = React.useState<AdminUser | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AdminUser | null>(null);
  const [form, setForm] = React.useState<{ name: string; email: string; role: UserRole }>({
    name: '',
    email: '',
    role: 'author',
  });

  const openNew = () => {
    setForm({ name: '', email: '', role: 'author' });
    setEditing('new');
  };
  const openEdit = (user: AdminUser) => {
    setForm({ name: user.name, email: user.email, role: user.role });
    setEditing(user);
  };

  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? api.post('/admin/users', form)
        : api.put(`/admin/users/${(editing as AdminUser).id}`, form),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setToast({ tone: 'success', message: response.data.message });
      setEditing(null);
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'enregistrer cet utilisateur.") }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteTarget(null);
      setToast({ tone: 'success', message: 'Utilisateur supprimé.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de supprimer cet utilisateur.') }),
  });

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-orange-700">Administration</p>
          <h2 className="text-3xl font-bold">Utilisateurs</h2>
          <p className="mt-1 text-sm text-slate-500">
            Invitez des membres de la rédaction et gérez leurs rôles.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800"
        >
          <Plus size={16} /> Inviter un utilisateur
        </button>
      </header>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        {users.isLoading && <p className="p-6 text-slate-500">Chargement…</p>}
        {users.isError && <p className="p-6 text-red-700">Impossible de charger les utilisateurs.</p>}
        {users.data && users.data.length === 0 && (
          <p className="flex items-center gap-3 p-6 text-slate-500">
            <UserRound size={18} /> Aucun utilisateur pour le moment.
          </p>
        )}
        {users.data && users.data.length > 0 && (
          <div className="max-w-full overflow-x-auto p-6 contain-layout">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="py-3 pr-4">Nom</th>
                  <th className="py-3 pr-4">E-mail</th>
                  <th className="py-3 pr-4">Rôle</th>
                  <th className="py-3 pr-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.data.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 font-semibold text-slate-900">{user.name}</td>
                    <td className="py-3 pr-4 text-slate-500">{user.email}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${roleClasses[user.role]}`}>
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(user)}
                          className="rounded p-2 text-slate-600 hover:bg-slate-100"
                          aria-label={`Modifier ${user.name}`}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="rounded p-2 text-red-700 hover:bg-red-50"
                          aria-label={`Supprimer ${user.name}`}
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
                {editing === 'new' ? 'Inviter un utilisateur' : "Modifier l'utilisateur"}
              </h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded p-1 hover:bg-slate-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            {editing === 'new' && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-orange-50 p-3 text-xs text-orange-800">
                <Mail size={14} className="mt-0.5 shrink-0" />
                Un e-mail sera envoyé à cette adresse avec un lien pour choisir son mot de passe et
                activer le compte.
              </p>
            )}
            <label className={`mt-5 ${labelClass}`}>
              Nom
              <input
                required
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              E-mail
              <input
                required
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Rôle
              <select
                className={inputClass}
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}
              >
                <option value="admin">Administrateur</option>
                <option value="editor">Éditeur</option>
                <option value="author">Auteur</option>
                <option value="reader">Lecteur</option>
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
                {save.isPending ? 'Enregistrement…' : editing === 'new' ? "Envoyer l'invitation" : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-bold tracking-widest text-red-700 uppercase">Suppression</p>
            <h3 className="mt-2 text-xl font-extrabold">Supprimer « {deleteTarget.name} » ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Cette personne perdra immédiatement l'accès à l'administration.
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
