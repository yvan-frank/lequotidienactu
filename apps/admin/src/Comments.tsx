import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, Flag, MessageSquare, Reply, ShieldAlert, Trash2, X } from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';

type Comment = {
  id: number;
  article_id: number;
  parent_id: number | null;
  parent_author_name: string | null;
  author_name: string;
  body: string;
  status: 'pending' | 'approved' | 'rejected' | 'spam';
  created_at: string;
  article_title: string;
  article_slug: string;
  category_slug: string;
  ip_address: string | null;
  reported_count: number;
};

type BlockedCommenter = { id: number; ip_address: string; reason: string | null; created_at: string };

const filters = [
  ['pending', 'En attente'],
  ['approved', 'Approuvés'],
  ['rejected', 'Rejetés'],
  ['spam', 'Indésirables'],
  ['all', 'Tous'],
] as const;

function apiErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

export function Comments() {
  const [filter, setFilter] = React.useState<(typeof filters)[number][0]>('pending');
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = React.useState<Comment | null>(null);
  const [replyingTo, setReplyingTo] = React.useState<number | null>(null);
  const [replyText, setReplyText] = React.useState('');
  const queryClient = useQueryClient();
  const comments = useQuery({
    queryKey: ['admin-comments', filter],
    queryFn: async () =>
      (await api.get<{ data: Comment[] }>('/admin/comments', { params: { status: filter } })).data
        .data,
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: Comment['status'] }) =>
      api.put(`/admin/comments/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
      setToast({ tone: 'success', message: 'Commentaire mis à jour.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible de mettre à jour ce commentaire.") }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/comments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
      setDeleteTarget(null);
      setToast({ tone: 'success', message: 'Commentaire supprimé.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de supprimer ce commentaire.') }),
  });
  const block = useMutation({
    mutationFn: (id: number) => api.post(`/admin/comments/${id}/block`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-blocked-commenters'] });
      setToast({ tone: 'success', message: 'Auteur bloqué.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible de bloquer cet auteur.") }),
  });
  const reply = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      api.post(`/admin/comments/${id}/reply`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-comments'] });
      setReplyingTo(null);
      setReplyText('');
      setToast({ tone: 'success', message: 'Réponse publiée.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible de publier cette réponse.") }),
  });
  const blockedList = useQuery({
    queryKey: ['admin-blocked-commenters'],
    queryFn: async () =>
      (await api.get<{ data: BlockedCommenter[] }>('/admin/blocked-commenters')).data.data,
  });
  const unblock = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/blocked-commenters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blocked-commenters'] });
      setToast({ tone: 'success', message: 'Adresse débloquée.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de débloquer cette adresse.') }),
  });

  return (
    <>
      <header>
        <p className="text-sm font-semibold text-orange-700">Modération</p>
        <h2 className="text-3xl font-bold">Commentaires</h2>
        <p className="mt-1 text-sm text-slate-500">
          Les commentaires publics sont soumis en attente puis publiés après validation.
        </p>
      </header>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filtrer les commentaires">
        {filters.map(([value, label]) => (
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
      {comments.isLoading && (
        <p className="mt-6 rounded-xl bg-white p-6 text-slate-500">Chargement…</p>
      )}
      {comments.isError && (
        <p className="mt-6 rounded-xl bg-white p-6 text-red-700">
          Impossible de charger les commentaires.
        </p>
      )}
      {comments.data?.length === 0 && (
        <p className="mt-6 flex items-center gap-3 rounded-xl bg-white p-6 text-slate-500">
          <MessageSquare size={18} /> Aucun commentaire pour ce filtre.
        </p>
      )}
      {comments.data && comments.data.length > 0 && (
        <ul className="mt-6 grid gap-3">
          {comments.data.map((comment) => (
            <li
              key={comment.id}
              className={`rounded-xl border bg-white p-5 ${comment.parent_id ? 'ml-6 border-orange-200 bg-orange-50/40' : 'border-slate-200'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-900">{comment.author_name}</p>
                    {comment.parent_id && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700">
                        <Reply size={11} /> Réponse à {comment.parent_author_name ?? 'un commentaire'}
                      </span>
                    )}
                    {comment.reported_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                        <Flag size={11} /> Signalé {comment.reported_count > 1 ? `× ${comment.reported_count}` : ''}
                      </span>
                    )}
                  </div>
                  <a
                    className="mt-0.5 block truncate text-xs font-semibold text-orange-700 hover:underline"
                    href={`/${comment.category_slug}/${comment.article_slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Sur : {comment.article_title}
                  </a>
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {new Date(comment.created_at).toLocaleString('fr-FR')}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">{comment.body}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {comment.status !== 'approved' && (
                  <button
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: comment.id, status: 'approved' })}
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <Check size={14} /> Approuver
                  </button>
                )}
                {comment.status !== 'rejected' && (
                  <button
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: comment.id, status: 'rejected' })}
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <X size={14} /> Rejeter
                  </button>
                )}
                {comment.status !== 'spam' && (
                  <button
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: comment.id, status: 'spam' })}
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                  >
                    <ShieldAlert size={14} /> Indésirable
                  </button>
                )}
                {comment.ip_address && (
                  <button
                    disabled={block.isPending}
                    onClick={() => {
                      if (window.confirm(`Bloquer ${comment.author_name} (${comment.ip_address}) ? Ses futurs commentaires seront automatiquement refusés.`)) {
                        block.mutate(comment.id);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Ban size={14} /> Bloquer l’auteur
                  </button>
                )}
                {!comment.parent_id && (
                  <button
                    onClick={() => {
                      setReplyingTo(replyingTo === comment.id ? null : comment.id);
                      setReplyText('');
                    }}
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-50"
                  >
                    <Reply size={14} /> Répondre
                  </button>
                )}
                <button
                  onClick={() => setDeleteTarget(comment)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 size={14} /> Supprimer
                </button>
              </div>
              {replyingTo === comment.id && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (replyText.trim()) reply.mutate({ id: comment.id, body: replyText.trim() });
                  }}
                  className="mt-4 rounded-lg border border-orange-200 bg-orange-50/60 p-3"
                >
                  <textarea
                    autoFocus
                    required
                    rows={3}
                    maxLength={2000}
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    placeholder="Votre réponse, visible publiquement…"
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="rounded px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Annuler
                    </button>
                    <button
                      disabled={reply.isPending}
                      className="rounded bg-orange-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
                    >
                      {reply.isPending ? 'Publication…' : 'Publier la réponse'}
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {blockedList.data && blockedList.data.length > 0 && (
        <section className="mt-8 rounded-xl border border-slate-200 bg-white">
          <h3 className="border-b border-slate-100 px-6 py-4 font-bold">Auteurs bloqués</h3>
          <ul className="divide-y divide-slate-100">
            {blockedList.data.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold text-slate-900">{entry.ip_address}</p>
                  <p className="text-xs text-slate-500">
                    {entry.reason ?? 'Bloqué manuellement'} · {new Date(entry.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <button
                  disabled={unblock.isPending}
                  onClick={() => unblock.mutate(entry.id)}
                  className="shrink-0 rounded px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  Débloquer
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-bold tracking-widest text-red-700 uppercase">Suppression</p>
            <h3 className="mt-2 text-xl font-extrabold">Supprimer ce commentaire ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              De « {deleteTarget.author_name} » sur « {deleteTarget.article_title} ».
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
