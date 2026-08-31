import { useMutation } from '@tanstack/react-query';
import { FileUp, Paperclip, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { api } from '../api';
import { Toast } from './Toast';

export type UploadedFile = { url: string; name: string; bytes: number };

type FilePickerProps = {
  onClose: () => void;
  onSelect: (file: UploadedFile) => void;
};

const MAX_BYTES = 20_000_000;

export function FilePicker({ onClose, onSelect }: FilePickerProps) {
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > MAX_BYTES) throw new Error('Ce fichier dépasse la limite de 20 Mo.');
      const payload = new FormData();
      payload.append('file', file);
      payload.append('name', file.name.replace(/\.[^.]+$/, ''));
      return (await api.post<{ data: UploadedFile }>('/admin/documents', payload)).data.data;
    },
    onSuccess: (uploaded) => onSelect(uploaded),
    onError: (reason: any) =>
      setError(
        reason.response?.data?.message ?? reason.message ?? 'Impossible de téléverser ce fichier.',
      ),
  });
  const selectFile = (file?: File) => file && upload.mutate(file);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="file-picker-title"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <section className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-bold tracking-widest text-orange-700 uppercase">
              Pièce jointe
            </p>
            <h2 id="file-picker-title" className="mt-1 text-2xl font-extrabold">
              Ajouter un fichier
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
        <div className="p-6">
          <button
            type="button"
            className="grid min-h-52 w-full place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-orange-500 hover:bg-orange-50"
            onClick={() => input.current?.click()}
            onDrop={(event) => {
              event.preventDefault();
              selectFile(event.dataTransfer.files[0]);
            }}
            onDragOver={(event) => event.preventDefault()}
          >
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-orange-100 text-orange-700">
                <FileUp size={26} />
              </span>
              <p className="mt-4 font-bold">Déposez votre fichier ici</p>
              <p className="mt-2 text-sm text-slate-500">ou cliquez pour parcourir vos fichiers</p>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <Paperclip size={13} />
                PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT — 20 Mo max
              </p>
            </div>
          </button>
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.csv,.txt"
            onChange={(event) => selectFile(event.target.files?.[0])}
          />
        </div>
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
