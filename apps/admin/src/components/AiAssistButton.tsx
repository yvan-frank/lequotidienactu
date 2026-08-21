import React from 'react';
import { Check, Copy, Loader2, Sparkles, X } from 'lucide-react';
import { api } from '../api';

type AiTask = 'title' | 'excerpt' | 'meta_title' | 'meta_description' | 'proofread' | 'social';

type AiContext = {
  title: string;
  excerpt: string;
  body: string;
  category_name: string;
};

const SOCIAL_LABELS = ['X / Twitter', 'Facebook', 'LinkedIn'];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt('Copiez ce texte :', text);
        }
      }}
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copié' : 'Copier'}
    </button>
  );
}

/**
 * A small button that pops open a panel of AI-generated suggestions for one
 * field (title, excerpt, meta tags, proofreading, social copy). Nothing is
 * ever applied automatically — every suggestion needs an explicit click
 * from the editor to land in the article, matching the human-validation
 * requirement for this feature.
 */
export function AiAssistButton({
  task,
  label,
  context,
  onApply,
}: {
  task: AiTask;
  label: string;
  context: AiContext;
  onApply?: (suggestion: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const run = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<{ data: { suggestions: string[] } }>('/admin/ai/assist', {
        task,
        ...context,
      });
      setSuggestions(response.data.data.suggestions);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'L’assistant IA n’a pas pu répondre.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={panelRef} className="relative inline-block">
      <button
        type="button"
        onClick={run}
        className="inline-flex items-center gap-1.5 rounded border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100"
      >
        <Sparkles size={13} /> {label}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-96 max-w-[90vw] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-widest text-violet-700 uppercase">Assistant IA</p>
            <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fermer">
              <X size={14} />
            </button>
          </div>
          {loading && (
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              <Loader2 size={14} className="animate-spin" /> Génération en cours…
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          {!loading && !error && suggestions.length > 0 && (
            <div className="mt-3 grid max-h-96 gap-2 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <div key={index} className="rounded-lg border border-slate-200 p-3">
                  {task === 'social' && (
                    <p className="mb-1 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                      {SOCIAL_LABELS[index] ?? ''}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap text-slate-700">{suggestion}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {onApply && (
                      <button
                        type="button"
                        onClick={() => {
                          onApply(suggestion);
                          setOpen(false);
                        }}
                        className="rounded bg-violet-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-800"
                      >
                        Appliquer
                      </button>
                    )}
                    <CopyButton text={suggestion} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && (
            <button type="button" onClick={run} className="mt-3 text-xs font-semibold text-violet-700 hover:underline">
              Régénérer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
