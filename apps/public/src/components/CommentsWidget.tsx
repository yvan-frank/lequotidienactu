import { useEffect, useState, type FormEvent } from 'react';
import { Flag, MessageCircle, Reply } from 'lucide-react';
import { api } from '../api';

type Comment = { id: number; parent_id: number | null; author_name: string; body: string; created_at: string };

export function CommentsWidget({ articleId }: { articleId: number }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [reportedIds, setReportedIds] = useState<number[]>([]);

  const report = async (commentId: number) => {
    if (reportedIds.includes(commentId)) return;
    setReportedIds((current) => [...current, commentId]);
    try {
      await api.post(`/comments/${commentId}/report`, {});
    } catch {
      // Non-critical — the button already reflects "reported" either way.
    }
  };

  useEffect(() => {
    api
      .get<{ data: Comment[] }>(`/articles/${articleId}/comments`)
      .then((response) => setComments(response.data.data))
      .finally(() => setLoading(false));
  }, [articleId]);

  const topLevel = comments.filter((comment) => !comment.parent_id);
  const repliesByParent = comments.reduce<Record<number, Comment[]>>((acc, comment) => {
    if (comment.parent_id) {
      acc[comment.parent_id] = [...(acc[comment.parent_id] ?? []), comment];
    }
    return acc;
  }, {});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !body.trim()) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await api.post<{ message: string }>(`/articles/${articleId}/comments`, {
        author_name: name.trim(),
        body: body.trim(),
      });
      setNotice({ tone: 'success', message: response.data.message });
      setName('');
      setBody('');
    } catch (error: any) {
      setNotice({
        tone: 'error',
        message: error.response?.data?.message ?? 'Impossible d’envoyer votre commentaire.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section>
      <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <MessageCircle size={22} className="text-brand-600" aria-hidden="true" />
        Commentaires {comments.length > 0 && `(${comments.length})`}
      </h2>
      <form onSubmit={submit} className="mt-5 rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-semibold text-slate-700">
          Votre nom
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
            className="mt-1.5 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Jean Dupont"
          />
        </label>
        <label className="mt-3 block text-sm font-semibold text-slate-700">
          Commentaire
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            rows={3}
            maxLength={2000}
            className="mt-1.5 w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Votre avis sur cet article…"
          />
        </label>
        {notice && (
          <p
            className={`mt-3 text-sm font-medium ${notice.tone === 'success' ? 'text-emerald-700' : 'text-red-700'}`}
          >
            {notice.message}
          </p>
        )}
        <button
          disabled={submitting}
          className="mt-4 rounded bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {submitting ? 'Envoi…' : 'Publier le commentaire'}
        </button>
      </form>
      {loading && <p className="mt-5 text-sm text-slate-500">Chargement des commentaires…</p>}
      {!loading && comments.length === 0 && (
        <p className="mt-5 text-sm text-slate-500">Soyez le premier à commenter cet article.</p>
      )}
      {comments.length > 0 && (
        <ul className="mt-5 grid gap-4">
          {topLevel.map((comment) => (
            <li key={comment.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-slate-900">{comment.author_name}</p>
                <span className="text-xs text-slate-400">
                  {new Date(comment.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{comment.body}</p>
              <button
                type="button"
                onClick={() => report(comment.id)}
                disabled={reportedIds.includes(comment.id)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-600 disabled:cursor-default disabled:text-red-600"
              >
                <Flag size={12} />
                {reportedIds.includes(comment.id) ? 'Signalé' : 'Signaler'}
              </button>
              {(repliesByParent[comment.id] ?? []).length > 0 && (
                <ul className="mt-4 grid gap-3 border-l-2 border-brand-100 pl-4">
                  {repliesByParent[comment.id].map((reply) => (
                    <li key={reply.id} className="rounded-lg bg-brand-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700">
                          <Reply size={13} /> {reply.author_name}
                        </p>
                        <span className="text-xs text-slate-400">
                          {new Date(reply.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{reply.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
