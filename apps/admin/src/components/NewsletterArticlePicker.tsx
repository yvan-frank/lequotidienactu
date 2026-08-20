import { useQuery } from '@tanstack/react-query';
import { Check, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../api';

export type NewsletterArticleSummary = {
  id: number;
  title: string;
  category_name: string | null;
  published_at: string | null;
};

type NewsletterArticlePickerProps = {
  onClose: () => void;
  onConfirm: (articles: NewsletterArticleSummary[]) => void;
  alreadySelectedIds: number[];
};

export function NewsletterArticlePicker({ onClose, onConfirm, alreadySelectedIds }: NewsletterArticlePickerProps) {
  const [query, setQuery] = useState('');
  const [pickedIds, setPickedIds] = useState<number[]>([]);
  const articles = useQuery({
    queryKey: ['admin-articles', 'published'],
    queryFn: async () =>
      (await api.get<{ data: NewsletterArticleSummary[] }>('/admin/articles', { params: { status: 'published' } }))
        .data.data,
  });
  const filtered = useMemo(
    () =>
      (articles.data ?? [])
        .filter((article) => !alreadySelectedIds.includes(article.id))
        .filter((article) =>
          `${article.title} ${article.category_name ?? ''}`.toLowerCase().includes(query.toLowerCase()),
        ),
    [articles.data, query, alreadySelectedIds],
  );
  const toggle = (id: number) =>
    setPickedIds((current) => (current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id]));

  const confirm = () => {
    const byId = new Map((articles.data ?? []).map((article) => [article.id, article]));
    const picked = pickedIds.map((id) => byId.get(id)).filter((article): article is NewsletterArticleSummary => Boolean(article));
    onConfirm(picked);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="newsletter-article-picker-title"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <section className="flex max-h-[min(640px,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-bold tracking-widest text-orange-700 uppercase">Newsletter</p>
            <h2 id="newsletter-article-picker-title" className="mt-1 text-xl font-extrabold">
              Ajouter des articles
            </h2>
          </div>
          <button
            className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </header>
        <label className="relative block px-6 pt-4">
          <Search className="absolute top-1/2 left-9 -translate-y-1/2 text-slate-400" size={16} />
          <input
            className="w-full rounded-lg border border-slate-300 py-2.5 pr-3 pl-10"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un article publié par titre"
            autoFocus
          />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {articles.isLoading && <p className="py-12 text-center text-slate-500">Chargement…</p>}
          {articles.isError && (
            <p className="py-12 text-center text-red-700">Impossible de charger les articles.</p>
          )}
          {!articles.isLoading && filtered.length === 0 && (
            <p className="py-12 text-center text-slate-500">Aucun article publié trouvé.</p>
          )}
          <ul className="grid gap-1.5">
            {filtered.map((article) => {
              const picked = pickedIds.includes(article.id);
              return (
                <li key={article.id}>
                  <button
                    type="button"
                    onClick={() => toggle(article.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left ${
                      picked ? 'border-orange-400 bg-orange-50' : 'border-slate-200 hover:border-orange-300 hover:bg-orange-50/50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-900">{article.title}</span>
                      <span className="text-xs text-slate-500">{article.category_name ?? 'Sans rubrique'}</span>
                    </span>
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                        picked ? 'border-orange-600 bg-orange-600 text-white' : 'border-slate-300 text-transparent'
                      }`}
                    >
                      <Check size={14} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">
            {pickedIds.length} article{pickedIds.length > 1 ? 's' : ''} sélectionné{pickedIds.length > 1 ? 's' : ''}
          </p>
          <button
            type="button"
            disabled={pickedIds.length === 0}
            onClick={confirm}
            className="rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ajouter à la campagne
          </button>
        </div>
      </section>
    </div>
  );
}
