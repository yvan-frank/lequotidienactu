import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

type ArticleItem = {
  title: string;
  slug: string;
  excerpt: string | null;
  category: string;
  category_name: string;
  hero_image: string;
};

export function InfiniteArticles({
  category,
  query,
  author,
  currentCategory,
  page,
  hasMore: initialHasMore,
}: {
  /** Comma-separated category slugs to restrict to (category pages). */
  category?: string;
  /** Search query to restrict to (search-results page). */
  query?: string;
  /** Author slug to restrict to (author pages). */
  author?: string;
  /** Current category slug — hides the redundant category badge on its own cards, same as the server-rendered grid. */
  currentCategory?: string;
  /** Page already rendered server-side; the island starts fetching from the next one. */
  page: number;
  hasMore: boolean;
}) {
  const [items, setItems] = useState<ArticleItem[]>([]);
  const [currentPage, setCurrentPage] = useState(page);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // IntersectionObserver callbacks can fire again before a state update from
  // the previous call has committed; a ref-based guard (synchronous, unlike
  // state) is what actually prevents two overlapping requests for the same
  // next page.
  const loadingRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setError(false);
    try {
      const nextPage = currentPage + 1;
      const response = await api.get<{ data: ArticleItem[]; meta: { has_more: boolean } }>('/articles', {
        params: { page: nextPage, category, q: query, author },
      });
      setItems((current) => [...current, ...response.data.data]);
      setHasMore(response.data.meta.has_more);
      setCurrentPage(nextPage);
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, category, query, author]);

  useEffect(() => {
    if (!hasMore || error) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, error]);

  if (items.length === 0 && !hasMore) return null;

  return (
    <>
      {items.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <article
              key={`${item.category}/${item.slug}`}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
            >
              {item.hero_image && (
                <img
                  className="h-40 w-full object-cover"
                  src={item.hero_image}
                  alt=""
                  width={640}
                  height={360}
                  loading="lazy"
                />
              )}
              <div className="p-6">
                {item.category !== currentCategory && (
                  <p className="text-xs font-bold tracking-widest text-brand-600 uppercase">
                    {item.category_name}
                  </p>
                )}
                <h2 className="mt-2 text-xl font-bold">
                  <a className="hover:text-brand-600" href={`/${item.category}/${item.slug}`}>
                    {item.title}
                  </a>
                </h2>
                {item.excerpt && <p className="mt-2 text-slate-600">{item.excerpt}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
      {hasMore && !error && (
        <div ref={sentinelRef} className="mt-8 flex justify-center py-4">
          {loading && (
            <Loader2 size={22} className="animate-spin text-slate-400" aria-label="Chargement d’articles supplémentaires" />
          )}
        </div>
      )}
      {error && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Réessayer de charger plus d’articles
          </button>
        </div>
      )}
    </>
  );
}
