import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Images, Search, Upload, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { Toast } from './Toast';

export type Media = {
  id: number;
  url: string;
  mime_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  created_at: string;
};

type MediaPickerProps = {
  onClose: () => void;
  onSelect: (media: Media) => void;
  selectedId?: number;
};

const MAX_BYTES = 8_000_000;

export function MediaPicker({ onClose, onSelect, selectedId }: MediaPickerProps) {
  const [tab, setTab] = useState<'upload' | 'library'>('upload');
  const [altText, setAltText] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const media = useQuery({
    queryKey: ['media-library'],
    queryFn: async () => (await api.get<{ data: Media[] }>('/admin/media')).data.data,
    enabled: tab === 'library',
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_BYTES) throw new Error('Cette image dépasse la limite de 8 Mo.');
      if (!file.type.startsWith('image/')) throw new Error('Sélectionnez un fichier image valide.');
      const payload = new FormData();
      payload.append('file', file);
      payload.append('alt_text', altText);
      return (await api.post<{ data: Media }>('/admin/media', payload)).data.data;
    },
    onSuccess: (uploaded) => {
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
      onSelect(uploaded);
    },
    onError: (reason: any) =>
      setError(
        reason.response?.data?.message ?? reason.message ?? 'Impossible de téléverser cette image.',
      ),
  });
  const filtered = useMemo(
    () =>
      (media.data ?? []).filter((item) =>
        `${item.alt_text ?? ''} ${item.mime_type}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [media.data, query],
  );
  const selectFile = (file?: File) => file && upload.mutate(file);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-picker-title"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <section className="flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-bold tracking-widest text-orange-700 uppercase">
              Contenu visuel
            </p>
            <h2 id="media-picker-title" className="mt-1 text-2xl font-extrabold">
              Ajouter une image
            </h2>
          </div>
          <button
            className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={21} />
          </button>
        </header>
        <div className="flex gap-1 border-b border-slate-200 px-6">
          <button
            className={`inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-semibold ${tab === 'upload' ? 'border-orange-700 text-orange-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            onClick={() => setTab('upload')}
          >
            <Upload size={17} /> Téléverser
          </button>
          <button
            className={`inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-semibold ${tab === 'library' ? 'border-orange-700 text-orange-700' : 'border-transparent text-slate-500 hover:text-slate-900'}`}
            onClick={() => setTab('library')}
          >
            <Images size={17} /> Médiathèque
          </button>
        </div>
        {tab === 'upload' ? (
          <div className="grid grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-[1.15fr_.85fr]">
            <button
              type="button"
              className="grid min-h-72 place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-orange-500 hover:bg-orange-50"
              onClick={() => input.current?.click()}
              onDrop={(event) => {
                event.preventDefault();
                selectFile(event.dataTransfer.files[0]);
              }}
              onDragOver={(event) => event.preventDefault()}
            >
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-full bg-orange-100 text-orange-700">
                  <ImagePlus size={26} />
                </span>
                <p className="mt-4 font-bold">Déposez votre image ici</p>
                <p className="mt-2 text-sm text-slate-500">
                  ou cliquez pour parcourir vos fichiers
                </p>
              </div>
            </button>
            <div className="rounded-xl border border-slate-200 p-5">
              <h3 className="font-bold">Informations image</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Tous les formats image pris en charge par le navigateur. Taille maximale : 8 Mo.
              </p>
              <label className="mt-6 block text-sm font-semibold">
                Texte alternatif
                <input
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                  value={altText}
                  onChange={(event) => setAltText(event.target.value)}
                  placeholder="Décrivez l’image pour les lecteurs"
                />
              </label>
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                Ce texte est utilisé pour l’accessibilité et le référencement.
              </p>
            </div>
            <input
              ref={input}
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <label className="relative block">
              <Search
                className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                className="w-full rounded-lg border border-slate-300 py-2.5 pr-3 pl-10"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher par description ou format"
              />
            </label>
            {media.isLoading && (
              <p className="py-12 text-center text-slate-500">Chargement de la médiathèque…</p>
            )}
            {media.isError && (
              <p className="py-12 text-center text-red-700">Impossible de charger les médias.</p>
            )}
            {!media.isLoading && filtered.length === 0 && (
              <p className="py-12 text-center text-slate-500">Aucune image trouvée.</p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`group overflow-hidden rounded-xl border text-left transition ${selectedId === item.id ? 'border-orange-600 ring-2 ring-orange-200' : 'border-slate-200 hover:border-orange-400 hover:shadow-md'}`}
                >
                  <img
                    className="aspect-square w-full bg-slate-100 object-cover"
                    src={item.url}
                    width={item.width ?? 320}
                    height={item.height ?? 320}
                    alt={item.alt_text ?? ''}
                  />
                  <span className="block truncate px-3 py-2 text-xs font-medium text-slate-600">
                    {item.alt_text || item.mime_type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      {error && <Toast message={error} onClose={() => setError('')} />}
      {upload.isPending && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/20">
          <p className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white">
            Téléversement en cours…
          </p>
        </div>
      )}
    </div>
  );
}
