import { useQuery } from '@tanstack/react-query';
import { Database, Download, HardDrive, Image as ImageIcon } from 'lucide-react';
import { api } from './api';

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
  const backups = useQuery({
    queryKey: ['admin-backups'],
    queryFn: async () => (await api.get<{ data: BackupGroup[] }>('/admin/backups')).data.data,
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
          <table className="w-full min-w-[520px] text-left text-sm">
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
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
