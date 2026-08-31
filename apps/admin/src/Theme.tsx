import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GripVertical,
  ImageIcon,
  LayoutList,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Upload,
} from 'lucide-react';
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

type WatermarkSettings = {
  enabled: boolean;
  image_path: string | null;
  width_percent: number;
  opacity_percent: number;
  position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  default_image_url: string;
};

const POSITIONS: { value: WatermarkSettings['position']; label: string }[] = [
  { value: 'center', label: 'Centre' },
  { value: 'top-left', label: 'Haut gauche' },
  { value: 'top-right', label: 'Haut droite' },
  { value: 'bottom-left', label: 'Bas gauche' },
  { value: 'bottom-right', label: 'Bas droite' },
];

const positionStyle = (position: WatermarkSettings['position']): React.CSSProperties => {
  const margin = '4%';
  switch (position) {
    case 'top-left':
      return { top: margin, left: margin };
    case 'top-right':
      return { top: margin, right: margin };
    case 'bottom-left':
      return { bottom: margin, left: margin };
    case 'bottom-right':
      return { bottom: margin, right: margin };
    default:
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
  }
};

function WatermarkPanel({ setToast }: { setToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['admin-watermark'],
    queryFn: async () => (await api.get<{ data: WatermarkSettings }>('/admin/settings/watermark')).data.data,
  });
  const [form, setForm] = React.useState<Pick<WatermarkSettings, 'enabled' | 'width_percent' | 'opacity_percent' | 'position'> | null>(
    null,
  );
  const imageInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!settingsQuery.data) return;
    setForm({
      enabled: settingsQuery.data.enabled,
      width_percent: settingsQuery.data.width_percent,
      opacity_percent: settingsQuery.data.opacity_percent,
      position: settingsQuery.data.position,
    });
  }, [settingsQuery.data]);

  const save = useMutation({
    mutationFn: (patch: typeof form) => api.put('/admin/settings/watermark', patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-watermark'] });
      setToast({ tone: 'success', message: 'Filigrane enregistré.' });
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible d’enregistrer le filigrane.') }),
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      const payload = new FormData();
      payload.append('file', file);
      return (await api.post<{ data: WatermarkSettings }>('/admin/settings/watermark/image', payload)).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-watermark'] });
      setToast({ tone: 'success', message: 'Image de filigrane mise à jour.' });
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de changer l’image.') }),
  });

  const resetImage = useMutation({
    mutationFn: () => api.delete('/admin/settings/watermark/image'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-watermark'] });
      setToast({ tone: 'success', message: 'Logo par défaut restauré.' });
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de réinitialiser l’image.') }),
  });

  const applyToAll = useMutation({
    mutationFn: async () =>
      (await api.post<{ data: { processed: number; failed: number }; message: string }>('/admin/media/watermark-all'))
        .data,
    onSuccess: (result) => setToast({ tone: 'success', message: result.message }),
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible d’appliquer le filigrane.') }),
  });

  if (settingsQuery.isLoading || !form) {
    return (
      <SectionCard icon={<ImageIcon size={20} />} title="Filigrane" description="Protégez vos images avec votre logo.">
        <p className="p-6 text-slate-500">Chargement…</p>
      </SectionCard>
    );
  }

  const imageUrl = settingsQuery.data?.image_path ?? settingsQuery.data?.default_image_url ?? '';
  const hasCustomImage = Boolean(settingsQuery.data?.image_path);

  return (
    <SectionCard
      icon={<ImageIcon size={20} />}
      title="Filigrane"
      description="Appliqué automatiquement à chaque image téléversée sur le site."
    >
      <div className="grid grid-cols-1 gap-6 p-6 pt-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-5">
          <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              className="size-4 rounded border-slate-300"
              checked={form.enabled}
              onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
            />
            Activer le filigrane sur les nouvelles images
          </label>

          <div>
            <p className="text-sm font-semibold text-slate-700">Image du filigrane</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="grid size-16 shrink-0 place-items-center rounded-lg border border-slate-200 bg-[repeating-conic-gradient(#e5e7eb_0_25%,white_0_50%)] bg-[length:12px_12px] p-2">
                {imageUrl && <img src={imageUrl} alt="Filigrane actuel" className="max-h-full max-w-full object-contain" />}
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  disabled={uploadImage.isPending}
                  onClick={() => imageInput.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploadImage.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  Changer l’image
                </button>
                {hasCustomImage && (
                  <button
                    type="button"
                    disabled={resetImage.isPending}
                    onClick={() => resetImage.mutate()}
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <RotateCcw size={13} />
                    Revenir au logo par défaut
                  </button>
                )}
              </div>
              <input
                ref={imageInput}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadImage.mutate(file);
                  event.target.value = '';
                }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              PNG, JPEG ou WebP, 4 Mo max. Un fond blanc uni est automatiquement rendu transparent ; un fichier déjà
              transparent est utilisé tel quel.
            </p>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Taille — {form.width_percent}% de la largeur de l’image
            <input
              type="range"
              min={5}
              max={50}
              value={form.width_percent}
              onChange={(event) => setForm({ ...form, width_percent: Number(event.target.value) })}
              className="mt-2 w-full accent-orange-700"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Opacité — {form.opacity_percent}%
            <input
              type="range"
              min={1}
              max={100}
              value={form.opacity_percent}
              onChange={(event) => setForm({ ...form, opacity_percent: Number(event.target.value) })}
              className="mt-2 w-full accent-orange-700"
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Position
            <select
              className="mt-2 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none"
              value={form.position}
              onChange={(event) => setForm({ ...form, position: event.target.value as WatermarkSettings['position'] })}
            >
              {POSITIONS.map((position) => (
                <option key={position.value} value={position.value}>
                  {position.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate(form)}
              className="rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
            >
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              disabled={applyToAll.isPending}
              onClick={() => applyToAll.mutate()}
              title="Applique le filigrane actuel aux images qui ne l’ont pas encore"
              className="inline-flex items-center gap-2 rounded border border-orange-300 px-4 py-2 text-sm font-semibold text-orange-800 hover:bg-orange-50 disabled:opacity-50"
            >
              {applyToAll.isPending ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Appliquer à toutes les images existantes
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">Aperçu</p>
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            <img src="/assets/hero-placeholder.svg" alt="" className="size-full object-cover" />
            {form.enabled && imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="absolute"
                style={{
                  width: `${form.width_percent}%`,
                  opacity: form.opacity_percent / 100,
                  mixBlendMode: 'multiply',
                  ...positionStyle(form.position),
                }}
              />
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Aperçu approximatif — le rendu final dépend de la photo utilisée.
          </p>
        </div>
      </div>
    </SectionCard>
  );
}

const THEME_TABS: { value: 'menu' | 'watermark'; label: string }[] = [
  { value: 'menu', label: 'Menu' },
  { value: 'watermark', label: 'Filigrane' },
];

export function Theme() {
  const [toast, setToast] = React.useState<ToastState>(null);
  const [tab, setTab] = React.useState<'menu' | 'watermark'>('menu');

  return (
    <>
      <header>
        <p className="text-sm font-semibold text-orange-700">CMS</p>
        <h2 className="text-3xl font-bold">Thème</h2>
        <p className="mt-1 text-sm text-slate-500">Personnalisez l’apparence et la structure du site public.</p>
      </header>
      <div className="mt-6 flex gap-1 border-b border-slate-200">
        {THEME_TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              tab === item.value
                ? 'border-orange-700 text-orange-700'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6">
        {tab === 'menu' && <MenuPanel setToast={setToast} />}
        {tab === 'watermark' && <WatermarkPanel setToast={setToast} />}
      </div>
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
