import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../api';

export type ArticleSummary = {
  id: number;
  title: string;
  slug: string;
  status: string;
  category_name: string | null;
  category_slug: string | null;
};

type ArticlePickerProps = {
  onClose: () => void;
  onSelect: (article: ArticleSummary) => void;
  excludeId?: number | null;
};

export function ArticlePicker({ onClose, onSelect, excludeId }: ArticlePickerProps) {
  const [query, setQuery] = useState('');
  const articles = useQuery({
    queryKey: ['admin-articles', 'all'],
    queryFn: async () =>
      (await api.get<{ data: ArticleSummary[] }>('/admin/articles', { params: { status: 'all' } }))
        .data.data,
  });
  const filtered = useMemo(
    () =>
      (articles.data ?? [])
        .filter((article) => article.id !== excludeId)
        .filter((article) =>
          `${article.title} ${article.category_name ?? ''}`.toLowerCase().includes(query.toLowerCase()),
        ),
    [articles.data, query, excludeId],
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="article-picker-title"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <section className="flex max-h-[min(640px,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-bold tracking-widest text-orange-700 uppercase">
              À lire aussi
            </p>
            <h2 id="article-picker-title" className="mt-1 text-xl font-extrabold">
              Choisir un article
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
            placeholder="Rechercher un article par titre"
            autoFocus
          />
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {articles.isLoading && <p className="py-12 text-center text-slate-500">Chargement…</p>}
          {articles.isError && (
            <p className="py-12 text-center text-red-700">Impossible de charger les articles.</p>
          )}
          {!articles.isLoading && filtered.length === 0 && (
            <p className="py-12 text-center text-slate-500">Aucun article trouvé.</p>
          )}
          <ul className="grid gap-1.5">
            {filtered.map((article) => (
              <li key={article.id}>
                <button
                  type="button"
                  onClick={() => onSelect(article)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left hover:border-orange-400 hover:bg-orange-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-900">
                      {article.title}
                    </span>
                    <span className="text-xs text-slate-500">
                      {article.category_name ?? 'Sans rubrique'}
                    </span>
                  </span>
                  {article.status !== 'published' && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                      {article.status}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
