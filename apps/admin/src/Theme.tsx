import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical, LayoutList } from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';
import { SectionCard } from './Taxonomy';

type Category = {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  articles_count: number;
};

type ToastState = { message: string; tone: 'error' | 'success' } | null;

function apiErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

function groupByParent(categories: Category[]): Map<number, Category[]> {
  const groups = new Map<number, Category[]>();
  for (const category of categories) {
    const key = category.parent_id ?? 0;
    const list = groups.get(key) ?? [];
    list.push(category);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }
  return groups;
}

function CategoryOrderGroup({
  parentId,
  categories,
  groups,
  depth,
  onMove,
  movingGroupKey,
}: {
  parentId: number | null;
  categories: Category[];
  groups: Map<number, Category[]>;
  depth: number;
  onMove: (parentId: number | null, orderedIds: number[]) => void;
  movingGroupKey: string | null;
}) {
  const [expanded, setExpanded] = React.useState<Set<number>>(new Set());
  const isMoving = movingGroupKey === String(parentId ?? 0);

  const move = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= categories.length) return;
    const reordered = [...categories];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    onMove(parentId, reordered.map((category) => category.id));
  };

  return (
    <ul className={depth > 0 ? 'mt-1.5 ml-6 grid gap-1.5 border-l border-slate-200 pl-4' : 'grid gap-1.5'}>
      {categories.map((category, index) => {
        const children = groups.get(category.id) ?? [];
        const isExpanded = expanded.has(category.id);
        return (
          <li key={category.id}>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <GripVertical size={16} className="shrink-0 text-slate-300" aria-hidden="true" />
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {children.length > 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((current) => {
                        const next = new Set(current);
                        next.has(category.id) ? next.delete(category.id) : next.add(category.id);
                        return next;
                      })
                    }
                    className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={isExpanded ? `Replier ${category.name}` : `Déplier ${category.name}`}
                  >
                    {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                ) : (
                  <span className="w-[19px] shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{category.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    /{category.slug}
                    {children.length > 0 &&
                      ` · ${children.length} sous-rubrique${children.length > 1 ? 's' : ''}`}
                    {depth === 0 && index === 6 && ' · premier élément du menu « Plus »'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0 || isMoving}
                  onClick={() => move(index, -1)}
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Monter ${category.name}`}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  disabled={index === categories.length - 1 || isMoving}
                  onClick={() => move(index, 1)}
                  className="rounded p-1.5 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Descendre ${category.name}`}
                >
                  <ArrowDown size={15} />
                </button>
              </div>
            </div>
            {isExpanded && children.length > 0 && (
              <CategoryOrderGroup
                parentId={category.id}
                categories={children}
                groups={groups}
                depth={depth + 1}
                onMove={onMove}
                movingGroupKey={movingGroupKey}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MenuPanel({ setToast }: { setToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const categories = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => (await api.get<{ data: Category[] }>('/admin/categories')).data.data,
  });
  const groups = React.useMemo(() => groupByParent(categories.data ?? []), [categories.data]);
  const topLevel = groups.get(0) ?? [];
  const [movingGroupKey, setMovingGroupKey] = React.useState<string | null>(null);

  const reorder = useMutation({
    mutationFn: ({ parentId, orderedIds }: { parentId: number | null; orderedIds: number[] }) =>
      api.put('/admin/categories/reorder', { parent_id: parentId, ordered_ids: orderedIds }),
    onMutate: ({ parentId }) => setMovingGroupKey(String(parentId ?? 0)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-categories'] }),
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de réorganiser le menu.') }),
    onSettled: () => setMovingGroupKey(null),
  });

  return (
    <SectionCard
      icon={<LayoutList size={20} />}
      title="Menu du site"
      description="Réorganisez l'ordre des rubriques dans l'en-tête public. Les 6 premières s'affichent directement ; les suivantes basculent dans un menu « Plus »."
    >
      {categories.isLoading && <p className="p-6 text-slate-500">Chargement…</p>}
      {categories.isError && <p className="p-6 text-red-700">Impossible de charger les rubriques.</p>}
      {!categories.isLoading && topLevel.length === 0 && (
        <p className="p-6 text-slate-500">Aucune rubrique pour le moment.</p>
      )}
      {topLevel.length > 0 && (
        <div className="p-6 pt-4">
          <CategoryOrderGroup
            parentId={null}
            categories={topLevel}
            groups={groups}
            depth={0}
            onMove={(parentId, orderedIds) => reorder.mutate({ parentId, orderedIds })}
            movingGroupKey={movingGroupKey}
          />
        </div>
      )}
    </SectionCard>
  );
}

export function Theme() {
  const [toast, setToast] = React.useState<ToastState>(null);
  const [tab, setTab] = React.useState<'menu'>('menu');

  return (
    <>
      <header>
        <p className="text-sm font-semibold text-orange-700">CMS</p>
        <h2 className="text-3xl font-bold">Thème</h2>
        <p className="mt-1 text-sm text-slate-500">Personnalisez l’apparence et la structure du site public.</p>
      </header>
      <div className="mt-6 flex gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab('menu')}
          className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
            tab === 'menu'
              ? 'border-orange-700 text-orange-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Menu
        </button>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6">{tab === 'menu' && <MenuPanel setToast={setToast} />}</div>
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
