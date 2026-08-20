import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';

type MediaItem = {
  id: number;
  url: string;
  mime_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  credit: string | null;
  created_at: string;
};

const MAX_BYTES = 8_000_000;

const formatBytes = (bytes: number) =>
  bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} Mo` : `${Math.round(bytes / 1000)} Ko`;

const inputClass =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none';

function MediaCard({
  item,
  onSave,
  onDelete,
  saving,
}: {
  item: MediaItem;
  onSave: (patch: { alt_text: string; credit: string }) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  const [altText, setAltText] = React.useState(item.alt_text ?? '');
  const [credit, setCredit] = React.useState(item.credit ?? '');
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const dirty = altText !== (item.alt_text ?? '') || credit !== (item.credit ?? '');

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <img
        className="aspect-video w-full bg-slate-100 object-cover"
        src={item.url}
        width={item.width ?? 320}
        height={item.height ?? 180}
        alt={item.alt_text ?? ''}
        loading="lazy"
      />
      <div className="p-4">
        <p className="text-xs font-mono text-slate-500">
          {item.width && item.height ? `${item.width}×${item.height} · ` : ''}
          {formatBytes(item.bytes)} · {item.mime_type.replace('image/', '')}
        </p>
        <label className="mt-3 block text-xs font-semibold text-slate-700">
          Texte alternatif
          <input
            className={inputClass}
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            placeholder="Décrivez l'image"
          />
        </label>
        <label className="mt-2 block text-xs font-semibold text-slate-700">
          Crédit
          <input
            className={inputClass}
            value={credit}
            onChange={(event) => setCredit(event.target.value)}
            placeholder="Photo : ..."
          />
        </label>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => onSave({ alt_text: altText, credit })}
            className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">Supprimer ?</span>
              <button
                type="button"
                onClick={onDelete}
                className="rounded bg-red-700 px-2 py-1 font-semibold text-white hover:bg-red-800"
              >
                Oui
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100"
              >
                Non
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded p-1.5 text-red-700 hover:bg-red-50"
              aria-label={`Supprimer ${item.alt_text || 'cette image'}`}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Media() {
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState('');
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const [compressResult, setCompressResult] = React.useState<{
    compressed: number;
    skipped: number;
    bytes_saved: number;
  } | null>(null);
  const [savingId, setSavingId] = React.useState<number | null>(null);
  const input = React.useRef<HTMLInputElement>(null);

  const media = useQuery({
    queryKey: ['media-library'],
    queryFn: async () => (await api.get<{ data: MediaItem[] }>('/admin/media')).data.data,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_BYTES) throw new Error('Cette image dépasse la limite de 8 Mo.');
      if (!file.type.startsWith('image/')) throw new Error('Sélectionnez un fichier image valide.');
      const payload = new FormData();
      payload.append('file', file);
      return (await api.post<{ data: MediaItem }>('/admin/media', payload)).data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
      setToast({ tone: 'success', message: 'Image téléversée.' });
    },
    onError: (error: any) =>
      setToast({ tone: 'error', message: error.response?.data?.message ?? error.message ?? 'Impossible de téléverser cette image.' }),
  });

  const save = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { alt_text: string; credit: string } }) =>
      api.put(`/admin/media/${id}`, patch),
    onMutate: ({ id }) => setSavingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
      setToast({ tone: 'success', message: 'Image mise à jour.' });
    },
    onError: (error: any) =>
      setToast({ tone: 'error', message: error.response?.data?.message ?? 'Impossible de mettre à jour cette image.' }),
    onSettled: () => setSavingId(null),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/media/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
      setToast({ tone: 'success', message: 'Image supprimée.' });
    },
    onError: (error: any) =>
      setToast({ tone: 'error', message: error.response?.data?.message ?? 'Impossible de supprimer cette image.' }),
  });

  const compressExisting = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ data: { compressed: number; skipped: number; bytes_saved: number } }>(
          '/admin/media/compress-existing',
        )
      ).data.data,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
      setCompressResult(result);
    },
    onError: (error: any) =>
      setToast({ tone: 'error', message: error.response?.data?.message ?? 'Impossible de compresser les images existantes.' }),
  });

  const filtered = React.useMemo(
    () =>
      (media.data ?? []).filter((item) =>
        `${item.alt_text ?? ''} ${item.credit ?? ''} ${item.mime_type}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [media.data, query],
  );

  const totalBytes = React.useMemo(() => (media.data ?? []).reduce((sum, item) => sum + item.bytes, 0), [media.data]);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-orange-700">CMS</p>
          <h2 className="text-3xl font-bold">Médiathèque</h2>
          <p className="mt-1 text-sm text-slate-500">
            {media.data?.length ?? 0} image(s) · {formatBytes(totalBytes)} au total
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={compressExisting.isPending}
            onClick={() => {
              setCompressResult(null);
              compressExisting.mutate();
            }}
            title="Recompresse toutes les images de la médiathèque avec le pipeline actuel"
            className="inline-flex items-center gap-2 rounded border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
          >
            {compressExisting.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Compresser les images existantes
          </button>
          <button
            type="button"
            disabled={upload.isPending}
            onClick={() => input.current?.click()}
            className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
          >
            {upload.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            Téléverser
          </button>
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) upload.mutate(file);
              event.target.value = '';
            }}
          />
        </div>
      </header>

      {compressResult && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          {compressResult.compressed} image(s) compressée(s), {formatBytes(compressResult.bytes_saved)} économisés
          {compressResult.skipped > 0 ? ` (${compressResult.skipped} ignorée(s))` : ''}.
        </p>
      )}

      <div
        className="mt-6 grid min-h-40 place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-orange-500 hover:bg-orange-50"
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (file) upload.mutate(file);
        }}
        onDragOver={(event) => event.preventDefault()}
      >
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-orange-100 text-orange-700">
            <ImagePlus size={22} />
          </span>
          <p className="mt-3 text-sm font-semibold text-slate-700">Déposez une image ici, ou cliquez sur Téléverser</p>
          <p className="mt-1 text-xs text-slate-500">Taille maximale : 8 Mo</p>
        </div>
      </div>

      <label className="relative mt-6 block max-w-md">
        <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={18} />
        <input
          className="w-full rounded-lg border border-slate-300 py-2.5 pr-3 pl-10 text-sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher par description, crédit ou format"
        />
      </label>

      {media.isLoading && <p className="mt-6 rounded-xl bg-white p-6 text-slate-500">Chargement…</p>}
      {media.isError && <p className="mt-6 rounded-xl bg-white p-6 text-red-700">Impossible de charger la médiathèque.</p>}
      {media.data && filtered.length === 0 && (
        <p className="mt-6 rounded-xl bg-white p-6 text-slate-500">Aucune image trouvée.</p>
      )}

      {filtered.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              saving={savingId === item.id}
              onSave={(patch) => save.mutate({ id: item.id, patch })}
              onDelete={() => remove.mutate(item.id)}
            />
          ))}
        </div>
      )}
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
