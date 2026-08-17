import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Search, X } from 'lucide-react';
import { api } from '../api';

type Result = {
  title: string;
  slug: string;
  excerpt: string | null;
  category: string;
  category_name: string;
  hero_image: string | null;
};

export function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = '';
      setQuery('');
      setResults([]);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    const onKeydown = (event: KeyboardEvent) => {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  }, []);

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const response = await api.get<{ data: Result[] }>('/search', { params: { q: trimmed } });
        setResults(response.data.data);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-brand-600 hover:text-brand-600"
        aria-label="Rechercher"
      >
        <Search size={16} aria-hidden="true" />
        <span className="hidden sm:inline">Rechercher</span>
      </button>
      {open &&
        createPortal(
          <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/50 p-4 pt-[10vh] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Recherche"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
              <Search size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un article…"
                className="w-full text-base outline-none placeholder:text-slate-400"
              />
              {loading && (
                <Loader2 size={16} className="shrink-0 animate-spin text-slate-400" aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {query.trim().length >= 2 && !loading && results.length === 0 && (
                <p className="p-6 text-center text-sm text-slate-500">
                  Aucun résultat pour « {query} ».
                </p>
              )}
              {query.trim().length < 2 && (
                <p className="p-6 text-center text-sm text-slate-400">
                  Tapez au moins 2 caractères pour lancer la recherche.
                </p>
              )}
              {results.map((result) => (
                <a
                  key={`${result.category}/${result.slug}`}
                  href={`/${result.category}/${result.slug}`}
                  className="flex items-center gap-3 border-b border-slate-100 p-4 last:border-0 hover:bg-slate-50"
                >
                  {result.hero_image && (
                    <img
                      src={result.hero_image}
                      alt=""
                      className="size-12 shrink-0 rounded-lg object-cover"
                      width={48}
                      height={48}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold tracking-widest text-brand-600 uppercase">
                      {result.category_name}
                    </p>
                    <p className="truncate text-sm font-bold text-slate-900">{result.title}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
          </div>,
          document.body,
        )}
    </>
  );
}
