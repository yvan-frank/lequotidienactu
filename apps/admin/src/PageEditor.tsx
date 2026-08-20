import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { api } from './api';
import { RichTextEditor } from './components/RichTextEditor';
import { Toast } from './components/Toast';

type Status = 'draft' | 'published';
type StoredPage = {
  id: number;
  title: string;
  slug: string;
  body: string;
  status: Status;
  meta_title: string | null;
  meta_description: string | null;
  robots: string;
};

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const inputClass =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none';
const labelClass = 'block text-sm font-semibold text-slate-700';

export function PageEditor({ pageId = null }: { pageId?: number | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<Status>('draft');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [robots, setRobots] = useState('index,follow');

  const existing = useQuery({
    queryKey: ['admin-page', pageId],
    queryFn: async () => (await api.get<{ data: StoredPage }>(`/admin/pages/${pageId}`)).data.data,
    enabled: pageId !== null,
  });

  useEffect(() => {
    if (!existing.data) return;
    setTitle(existing.data.title);
    setSlug(existing.data.slug);
    setSlugTouched(true);
    setBody(existing.data.body);
    setStatus(existing.data.status);
    setMetaTitle(existing.data.meta_title ?? '');
    setMetaDescription(existing.data.meta_description ?? '');
    setRobots(existing.data.robots);
  }, [existing.data]);

  const payload = () => ({
    title,
    slug,
    body,
    status,
    meta_title: metaTitle,
    meta_description: metaDescription,
    robots,
  });

  const save = useMutation({
    mutationFn: () =>
      pageId === null ? api.post('/admin/pages', payload()) : api.put(`/admin/pages/${pageId}`, payload()),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pages'] });
      setToast({ tone: 'success', message: pageId === null ? 'Page créée.' : 'Page mise à jour.' });
      if (pageId === null) {
        const newId = (response.data as { data: { id: number } }).data.id;
        navigate({ to: '/pages/$pageId', params: { pageId: String(newId) } });
      }
    },
    onError: (error: any) =>
      setToast({ tone: 'error', message: error.response?.data?.message ?? "Impossible d'enregistrer cette page." }),
  });

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-orange-700">CMS</p>
          <h2 className="text-3xl font-bold">{pageId === null ? 'Nouvelle page' : 'Modifier la page'}</h2>
        </div>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
        >
          {save.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer
        </button>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <label className={labelClass}>
            Titre
            <input
              className={inputClass}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
              placeholder="Qui sommes-nous"
            />
          </label>
          <label className={`mt-4 ${labelClass}`}>
            Adresse (slug)
            <div className="mt-1 flex items-center gap-1 text-sm text-slate-500">
              <span>/</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                placeholder="qui-sommes-nous"
              />
            </div>
          </label>
          <div className="mt-4">
            <span className={labelClass}>Contenu</span>
            <RichTextEditor value={body} onChange={setBody} />
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <span className={labelClass}>Statut</span>
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as Status)}>
              <option value="draft">Brouillon</option>
              <option value="published">Publiée</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-semibold text-slate-700">Référencement (SEO)</p>
            <label className={`mt-4 ${labelClass}`}>
              Titre méta
              <input
                className={inputClass}
                value={metaTitle}
                onChange={(event) => setMetaTitle(event.target.value)}
                placeholder={title ? `${title} - Le Quotidien Actu` : ''}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Description méta
              <textarea
                className={`${inputClass} min-h-24`}
                value={metaDescription}
                onChange={(event) => setMetaDescription(event.target.value)}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Robots
              <select className={inputClass} value={robots} onChange={(event) => setRobots(event.target.value)}>
                <option value="index,follow">index, follow</option>
                <option value="noindex,follow">noindex, follow</option>
                <option value="noindex,nofollow">noindex, nofollow</option>
              </select>
            </label>
          </div>
        </section>
      </div>
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
