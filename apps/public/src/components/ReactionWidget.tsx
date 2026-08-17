import { useEffect, useState, type ComponentType } from 'react';
import { Heart, Lightbulb, PartyPopper, ThumbsUp, type LucideProps } from 'lucide-react';
import { api } from '../api';

const REACTIONS: { type: string; icon: ComponentType<LucideProps>; label: string }[] = [
  { type: 'like', icon: ThumbsUp, label: 'J’aime' },
  { type: 'love', icon: Heart, label: 'Adore' },
  { type: 'clap', icon: PartyPopper, label: 'Bravo' },
  { type: 'insightful', icon: Lightbulb, label: 'Instructif' },
];

export function ReactionWidget({ articleId }: { articleId: number }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const storageKey = `lqa-reaction-${articleId}`;

  useEffect(() => {
    setPicked(window.localStorage.getItem(storageKey));
    api
      .get<{ data: Record<string, number> }>(`/articles/${articleId}/reactions`)
      .then((response) => setCounts(response.data.data))
      .catch(() => {});
  }, [articleId, storageKey]);

  const react = async (type: string) => {
    if (pending || picked) return;
    setPending(true);
    try {
      const response = await api.post<{ data: Record<string, number> }>(
        `/articles/${articleId}/reactions`,
        { type },
      );
      setCounts(response.data.data);
      setPicked(type);
      window.localStorage.setItem(storageKey, type);
    } catch {
      // silently ignore — reactions are a light-touch feature, no need to alarm the reader
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Réagir à l’article">
      {REACTIONS.map((reaction) => {
        const Icon = reaction.icon;
        return (
          <button
            key={reaction.type}
            type="button"
            disabled={pending || Boolean(picked)}
            onClick={() => react(reaction.type)}
            title={reaction.label}
            aria-pressed={picked === reaction.type}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed ${
              picked === reaction.type
                ? 'border-brand-600 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50'
            }`}
          >
            <Icon size={16} aria-hidden="true" />
            {counts[reaction.type] ?? 0}
          </button>
        );
      })}
    </div>
  );
}
