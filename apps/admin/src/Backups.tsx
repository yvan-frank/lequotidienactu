import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Database, Download, HardDrive, Image as ImageIcon, Trash2 } from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';

type BackupFile = { filename: string; bytes: number; created_at: string };
type BackupGroup = { timestamp: string; database: BackupFile | null; uploads: BackupFile | null };

const formatBytes = (bytes: number) =>
  bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} Mo` : `${Math.round(bytes / 1000)} Ko`;

function formatTimestamp(timestamp: string): string {
  const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!match) return timestamp;
  const [, year, month, day, hour, minute] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:00`).toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function FileCell({ file }: { file: BackupFile | null }) {
  if (!file) {
    return <span className="text-sm text-slate-400">—</span>;
  }
  return (
    <a
      href={`/api/admin/backups/${encodeURIComponent(file.filename)}`}
      className="inline-flex items-center gap-2 rounded border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700"
    >
      <Download size={14} />
      {formatBytes(file.bytes)}
    </a>
  );
}

export function Backups() {
  const queryClient = useQueryClient();
  const [confirmTimestamp, setConfirmTimestamp] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const backups = useQuery({
    queryKey: ['admin-backups'],
    queryFn: async () => (await api.get<{ data: BackupGroup[] }>('/admin/backups')).data.data,
  });
  const remove = useMutation({
    mutationFn: (timestamp: string) => api.delete(`/admin/backups/${encodeURIComponent(timestamp)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-backups'] });
      setToast({ tone: 'success', message: 'Sauvegarde supprimée.' });
      setConfirmTimestamp(null);
    },
    onError: (error: any) => {
      setToast({
        tone: 'error',
        message: error?.response?.data?.message ?? 'Impossible de supprimer cette sauvegarde.',
      });
      setConfirmTimestamp(null);
    },
  });

  return (
    <>
      <header>
        <p className="text-sm font-semibold text-orange-700">Sécurité</p>
        <h2 className="text-3xl font-bold">Sauvegardes</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sauvegardes de la base de données et des médias, générées automatiquement par la tâche
          planifiée du serveur.
        </p>
      </header>

      {backups.isLoading && <p className="mt-6 rounded-xl bg-white p-6 text-slate-500">Chargement…</p>}
      {backups.isError && (
        <p className="mt-6 rounded-xl bg-white p-6 text-red-700">Impossible de charger les sauvegardes.</p>
      )}
      {backups.data?.length === 0 && (
        <p className="mt-6 flex items-center gap-3 rounded-xl bg-white p-6 text-slate-500">
          <HardDrive size={18} /> Aucune sauvegarde disponible pour le moment.
        </p>
      )}
      {backups.data && backups.data.length > 0 && (
        <section className="mt-6 max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white contain-layout">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wider text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <Database size={13} /> Base de données
                  </span>
                </th>
                <th className="px-5 py-3">
                  <span className="inline-flex items-center gap-1.5">
                    <ImageIcon size={13} /> Médias
                  </span>
                </th>
                <th className="px-5 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {backups.data.map((group) => (
                <tr key={group.timestamp} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-semibold text-slate-900">{formatTimestamp(group.timestamp)}</td>
                  <td className="px-5 py-3">
                    <FileCell file={group.database} />
                  </td>
                  <td className="px-5 py-3">
                    <FileCell file={group.uploads} />
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => setConfirmTimestamp(group.timestamp)}
                      className="rounded p-2 text-red-700 hover:bg-red-50"
                      aria-label={`Supprimer la sauvegarde du ${formatTimestamp(group.timestamp)}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {confirmTimestamp && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-bold tracking-widest text-red-700 uppercase">Confirmation</p>
            <h3 className="mt-2 text-xl font-extrabold">Supprimer cette sauvegarde ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              La sauvegarde du {formatTimestamp(confirmTimestamp)} (base de données et médias) sera supprimée
              définitivement du serveur. Cette action est irréversible.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={remove.isPending}
                onClick={() => setConfirmTimestamp(null)}
                className="rounded px-4 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                disabled={remove.isPending}
                onClick={() => remove.mutate(confirmTimestamp)}
                className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {remove.isPending ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
