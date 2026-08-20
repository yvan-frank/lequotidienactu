import type { Editor } from '@tiptap/react';
import { FileText, Newspaper, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api';

type ContentSuggestion = {
  type: 'article' | 'page';
  title: string;
  url: string;
  status: string;
};

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const closeEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [onClose]);
  return ref;
}

/**
 * Keeps the popover glued to `anchorElement` (a link clicked in the editor
 * content) as the page scrolls or resizes, instead of the one-shot position
 * computed at open time drifting away from the link underneath it.
 */
function useAnchoredPosition(
  anchorElement: HTMLElement | null | undefined,
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchorElement) {
      setPosition(null);
      return;
    }
    let raf = 0;
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = anchorElement.getBoundingClientRect();
      const margin = 8;
      let left = rect.left;
      let top = rect.bottom + margin;
      if (left + el.offsetWidth > window.innerWidth - margin) {
        left = window.innerWidth - margin - el.offsetWidth;
      }
      if (left < margin) left = margin;
      if (top + el.offsetHeight > window.innerHeight - margin) {
        top = rect.top - el.offsetHeight - margin;
      }
      setPosition({ top, left });
    };
    const onScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [anchorElement, containerRef]);

  return position;
}

export function LinkPopover({
  editor,
  onClose,
  anchorElement,
}: {
  editor: Editor | null;
  onClose: () => void;
  /** When set, the popover tracks this element (e.g. a link clicked in the
   * editor content) instead of hanging below the toolbar button. */
  anchorElement?: HTMLAnchorElement | null;
}) {
  const existingHref = (editor?.getAttributes('link').href as string | undefined) ?? '';
  const existingTarget = editor?.getAttributes('link').target as string | undefined;
  const [url, setUrl] = useState(existingHref);
  const [newTab, setNewTab] = useState(existingTarget === '_blank');
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const containerRef = useClickOutside(onClose);
  const inputRef = useRef<HTMLInputElement>(null);
  const position = useAnchoredPosition(anchorElement, containerRef);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const trimmed = url.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      api
        .get<{ data: ContentSuggestion[] }>('/admin/content-search', { params: { q: trimmed } })
        .then((response) => {
          if (!cancelled) setSuggestions(response.data.data);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [url]);

  const apply = () => {
    const trimmed = url.trim();
    if (trimmed === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor
        ?.chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: trimmed, target: newTab ? '_blank' : null })
        .run();
    }
    onClose();
  };

  const showSuggestions = suggestionsOpen && suggestions.length > 0;

  return (
    <div
      ref={containerRef}
      className={
        anchorElement
          ? 'z-40 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl'
          : 'absolute top-full left-0 z-30 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl'
      }
      style={
        anchorElement
          ? {
              position: 'fixed',
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              visibility: position ? 'visible' : 'hidden',
            }
          : undefined
      }
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          apply();
        }
      }}
    >
      <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">
        {existingHref ? 'Modifier le lien' : 'Insérer un lien'}
      </p>
      <label className="relative mt-3 block text-sm font-semibold text-slate-700">
        Adresse (URL) ou titre d’un article/page
        <input
          ref={inputRef}
          className="mt-1.5 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          onFocus={() => setSuggestionsOpen(true)}
          placeholder="https://exemple.fr/page ou un titre…"
          autoComplete="off"
        />
        {showSuggestions && (
          <div className="absolute top-full left-0 z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
            {suggestions.map((suggestion) => (
              <button
                key={`${suggestion.type}-${suggestion.url}`}
                type="button"
                onClick={() => {
                  setUrl(suggestion.url);
                  setSuggestions([]);
                  setSuggestionsOpen(false);
                  inputRef.current?.focus();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-orange-50"
              >
                {suggestion.type === 'article' ? (
                  <Newspaper size={14} className="shrink-0 text-slate-400" />
                ) : (
                  <FileText size={14} className="shrink-0 text-slate-400" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{suggestion.title}</span>
                  <span className="block truncate text-xs text-slate-500">{suggestion.url}</span>
                </span>
                {suggestion.status !== 'published' && (
                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                    {suggestion.status}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          className="rounded border-slate-300"
          checked={newTab}
          onChange={(event) => setNewTab(event.target.checked)}
        />
        Ouvrir dans un nouvel onglet
      </label>
      <div className="mt-4 flex items-center justify-between gap-2">
        {existingHref ? (
          <button
            type="button"
            onClick={() => {
              editor?.chain().focus().extendMarkRange('link').unsetLink().run();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} /> Retirer le lien
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={apply}
            className="rounded bg-orange-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-800"
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
