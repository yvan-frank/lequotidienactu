import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Plus,
  Tags as TagsIcon,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';

type Category = {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  position: number;
  articles_count: number;
};
type Tag = { id: number; name: string; slug: string; articles_count: number };
type Author = {
  id: number;
  user_id: number | null;
  display_name: string;
  slug: string;
  bio: string | null;
  avatar_media_id: number | null;
  articles_count: number;
};

type ToastState = { message: string; tone: 'error' | 'success' } | null;

function apiErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

const emptyToFilled = (value: string | null | undefined) => value ?? '';

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
        <span className="flex size-10 items-center justify-center rounded-lg bg-orange-50 text-orange-700">
          {icon}
        </span>
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function ConfirmDelete({
  title,
  description,
  pending,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
      role="dialog"
      aria-modal="true"
    >
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <p className="text-sm font-bold tracking-widest text-red-700 uppercase">Suppression</p>
        <h3 className="mt-2 text-xl font-extrabold">{title}</h3>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            disabled={pending}
            onClick={onCancel}
            className="rounded px-4 py-2 text-sm font-semibold hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            disabled={pending}
            onClick={onConfirm}
            className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
          >
            {pending ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </section>
    </div>
  );
}

const inputClass =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none';
const labelClass = 'block text-sm font-semibold text-slate-700';

type HierarchyCategory = Category & { depth: number; hasChildren: boolean; parentIds: number[] };

function orderedByHierarchy(categories: Category[]): HierarchyCategory[] {
  const byParent = new Map<number, Category[]>();
  for (const category of categories) {
    const key = category.parent_id ?? 0;
    byParent.set(key, [...(byParent.get(key) ?? []), category]);
  }
  const result: HierarchyCategory[] = [];
  const visit = (parentId: number, depth: number, parentIds: number[]) => {
    for (const category of byParent.get(parentId) ?? []) {
      result.push({
        ...category,
        depth,
        hasChildren: (byParent.get(category.id) ?? []).length > 0,
        parentIds,
      });
      visit(category.id, depth + 1, [...parentIds, category.id]);
    }
  };
  visit(0, 0, []);
  return result;
}

function CategoriesPanel({ setToast }: { setToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const categories = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => (await api.get<{ data: Category[] }>('/admin/categories')).data.data,
  });
  const hierarchy = React.useMemo(
    () => orderedByHierarchy(categories.data ?? []),
    [categories.data],
  );
  const [collapsed, setCollapsed] = React.useState<Set<number>>(new Set());
  const toggleCollapsed = (id: number) => {
    setCollapsed((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const visibleHierarchy = React.useMemo(
    () => hierarchy.filter((category) => !category.parentIds.some((id) => collapsed.has(id))),
    [hierarchy, collapsed],
  );
  const [editing, setEditing] = React.useState<Category | 'new' | null>(null);
  const parentOptions = React.useMemo(() => {
    if (editing === 'new' || editing === null) return hierarchy;
    const excluded = new Set<number>([editing.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const category of hierarchy) {
        if (category.parent_id !== null && excluded.has(category.parent_id) && !excluded.has(category.id)) {
          excluded.add(category.id);
          grew = true;
        }
      }
    }
    return hierarchy.filter((category) => !excluded.has(category.id));
  }, [hierarchy, editing]);
  const [deleteTarget, setDeleteTarget] = React.useState<Category | null>(null);
  const [form, setForm] = React.useState({
    name: '',
    slug: '',
    description: '',
    position: '0',
    parent_id: '',
  });

  const openNew = (parentId?: number) => {
    setForm({ name: '', slug: '', description: '', position: '0', parent_id: parentId ? String(parentId) : '' });
    setEditing('new');
  };
  const openEdit = (category: Category) => {
    setForm({
      name: category.name,
      slug: category.slug,
      description: emptyToFilled(category.description),
      position: String(category.position),
      parent_id: category.parent_id ? String(category.parent_id) : '',
    });
    setEditing(category);
  };

  const payload = () => ({
    name: form.name,
    slug: form.slug,
    description: form.description,
    position: Number(form.position) || 0,
    parent_id: form.parent_id ? Number(form.parent_id) : null,
  });

  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? api.post('/admin/categories', payload())
        : api.put(`/admin/categories/${(editing as Category).id}`, payload()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setToast({ tone: 'success', message: editing === 'new' ? 'Rubrique créée.' : 'Rubrique mise à jour.' });
      setEditing(null);
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'enregistrer cette rubrique.") }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      setDeleteTarget(null);
      setToast({ tone: 'success', message: 'Rubrique supprimée.' });
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de supprimer cette rubrique.') }),
  });

  return (
    <SectionCard
      icon={<TagsIcon size={20} />}
      title="Rubriques"
      description="Organisez les verticales éditoriales du site."
    >
      <div className="flex justify-end px-6 pt-5">
        <button
          onClick={() => openNew()}
          className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800"
        >
          <Plus size={16} /> Nouvelle rubrique
        </button>
      </div>
      {categories.isLoading && <p className="p-6 text-slate-500">Chargement…</p>}
      {categories.isError && <p className="p-6 text-red-700">Impossible de charger les rubriques.</p>}
      {categories.data && categories.data.length === 0 && (
        <p className="p-6 text-slate-500">Aucune rubrique pour le moment.</p>
      )}
      {categories.data && categories.data.length > 0 && (
        <div className="max-w-full overflow-x-auto p-6 pt-4 contain-layout">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs tracking-wider text-slate-500 uppercase">
              <tr>
                <th className="py-3 pr-4">Nom</th>
                <th className="py-3 pr-4">Slug</th>
                <th className="py-3 pr-4">Position</th>
                <th className="py-3 pr-4">Articles</th>
                <th className="py-3 pr-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleHierarchy.map((category) => (
                <tr key={category.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-4 font-semibold text-slate-900">
                    <span style={{ paddingLeft: `${category.depth * 1.25}rem` }} className="inline-flex items-center gap-1.5">
                      {category.hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleCollapsed(category.id)}
                          className="-ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={collapsed.has(category.id) ? `Déplier ${category.name}` : `Replier ${category.name}`}
                        >
                          {collapsed.has(category.id) ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                        </button>
                      ) : (
                        category.depth > 0 && <span className="text-slate-300" aria-hidden="true">↳</span>
                      )}
                      {category.name}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-500">{category.slug}</td>
                  <td className="py-3 pr-4 text-slate-500">{category.position}</td>
                  <td className="py-3 pr-4 text-slate-500">{category.articles_count}</td>
                  <td className="py-3 pr-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openNew(category.id)}
                        className="rounded p-2 text-slate-600 hover:bg-slate-100"
                        aria-label={`Ajouter une sous-rubrique à ${category.name}`}
                        title="Ajouter une sous-rubrique"
                      >
                        <Plus size={16} />
                      </button>
                      <button
                        onClick={() => openEdit(category)}
                        className="rounded p-2 text-slate-600 hover:bg-slate-100"
                        aria-label={`Modifier ${category.name}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(category)}
                        className="rounded p-2 text-red-700 hover:bg-red-50"
                        aria-label={`Supprimer ${category.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <form
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold">
                {editing === 'new' ? 'Nouvelle rubrique' : 'Modifier la rubrique'}
              </h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded p-1 hover:bg-slate-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <label className={`mt-5 ${labelClass}`}>
              Nom
              <input
                required
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Slug (optionnel, généré depuis le nom sinon)
              <input
                className={inputClass}
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Description
              <textarea
                className={inputClass}
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <label className={labelClass}>
                Position
                <input
                  type="number"
                  className={inputClass}
                  value={form.position}
                  onChange={(event) => setForm({ ...form, position: event.target.value })}
                />
              </label>
              <label className={labelClass}>
                Rubrique parente
                <select
                  className={inputClass}
                  value={form.parent_id}
                  onChange={(event) => setForm({ ...form, parent_id: event.target.value })}
                >
                  <option value="">Aucune (rubrique principale)</option>
                  {parentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {'—'.repeat(option.depth)} {option.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="rounded px-4 py-2 text-sm font-semibold hover:bg-slate-100">
                Annuler
              </button>
              <button
                disabled={save.isPending}
                className="rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
              >
                {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <ConfirmDelete
          title={`Supprimer « ${deleteTarget.name} » ?`}
          description="Cette rubrique ne pourra pas être supprimée si des articles y sont encore rattachés."
          pending={remove.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => remove.mutate(deleteTarget.id)}
        />
      )}
    </SectionCard>
  );
}

function TagsPanel({ setToast }: { setToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const tags = useQuery({
    queryKey: ['admin-tags'],
    queryFn: async () => (await api.get<{ data: Tag[] }>('/admin/tags')).data.data,
  });
  const [editing, setEditing] = React.useState<Tag | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Tag | null>(null);
  const [form, setForm] = React.useState({ name: '', slug: '' });
  const [quickAdd, setQuickAdd] = React.useState('');

  const openNew = () => {
    setForm({ name: '', slug: '' });
    setEditing('new');
  };
  const openEdit = (tag: Tag) => {
    setForm({ name: tag.name, slug: tag.slug });
    setEditing(tag);
  };

  const save = useMutation({
    mutationFn: () =>
      editing === 'new' ? api.post('/admin/tags', form) : api.put(`/admin/tags/${(editing as Tag).id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
      setToast({ tone: 'success', message: editing === 'new' ? 'Tag créé.' : 'Tag mis à jour.' });
      setEditing(null);
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'enregistrer ce tag.") }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
      setDeleteTarget(null);
      setToast({ tone: 'success', message: 'Tag supprimé.' });
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de supprimer ce tag.') }),
  });
  const quickCreate = useMutation({
    mutationFn: () => api.post('/admin/tags', { name: quickAdd, slug: '' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-tags'] });
      setQuickAdd('');
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'ajouter ce tag.") }),
  });

  return (
    <SectionCard icon={<TagsIcon size={20} />} title="Tags" description="Taxonomie fine pour affiner la recherche.">
      <div className="flex flex-wrap items-center justify-end gap-2 px-6 pt-5">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (quickAdd.trim() !== '') quickCreate.mutate();
          }}
        >
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none"
            placeholder="Ajout rapide : nom du tag"
            value={quickAdd}
            onChange={(event) => setQuickAdd(event.target.value)}
          />
          <button
            disabled={quickAdd.trim() === '' || quickCreate.isPending}
            className="inline-flex items-center gap-1.5 rounded border border-orange-700 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Ajouter rapidement ce tag"
          >
            <Plus size={16} />
          </button>
        </form>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800"
        >
          <Plus size={16} /> Nouveau tag
        </button>
      </div>
      {tags.isLoading && <p className="p-6 text-slate-500">Chargement…</p>}
      {tags.isError && <p className="p-6 text-red-700">Impossible de charger les tags.</p>}
      {tags.data && tags.data.length === 0 && <p className="p-6 text-slate-500">Aucun tag pour le moment.</p>}
      {tags.data && tags.data.length > 0 && (
        <div className="flex flex-wrap gap-3 p-6 pt-4">
          {tags.data.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1 pl-3 text-sm font-semibold text-slate-700"
            >
              {tag.name}
              <span className="text-xs font-normal text-slate-400">({tag.articles_count})</span>
              <button
                type="button"
                onClick={() => openEdit(tag)}
                className="touch-manipulation rounded-full p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                aria-label={`Modifier ${tag.name}`}
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(tag)}
                className="touch-manipulation rounded-full p-2 text-red-600 hover:bg-red-50"
                aria-label={`Supprimer ${tag.name}`}
              >
                <Trash2 size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <form
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold">{editing === 'new' ? 'Nouveau tag' : 'Modifier le tag'}</h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded p-1 hover:bg-slate-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <label className={`mt-5 ${labelClass}`}>
              Nom
              <input
                required
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Slug (optionnel)
              <input
                className={inputClass}
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="rounded px-4 py-2 text-sm font-semibold hover:bg-slate-100">
                Annuler
              </button>
              <button
                disabled={save.isPending}
                className="rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
              >
                {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <ConfirmDelete
          title={`Supprimer « ${deleteTarget.name} » ?`}
          description="Ce tag sera retiré des articles qui l'utilisent."
          pending={remove.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => remove.mutate(deleteTarget.id)}
        />
      )}
    </SectionCard>
  );
}

function AuthorsPanel({ setToast }: { setToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const authors = useQuery({
    queryKey: ['admin-authors'],
    queryFn: async () => (await api.get<{ data: Author[] }>('/admin/authors')).data.data,
  });
  const [editing, setEditing] = React.useState<Author | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Author | null>(null);
  const [form, setForm] = React.useState({ display_name: '', slug: '', bio: '' });

  const openNew = () => {
    setForm({ display_name: '', slug: '', bio: '' });
    setEditing('new');
  };
  const openEdit = (author: Author) => {
    setForm({ display_name: author.display_name, slug: author.slug, bio: emptyToFilled(author.bio) });
    setEditing(author);
  };

  const save = useMutation({
    mutationFn: () =>
      editing === 'new'
        ? api.post('/admin/authors', form)
        : api.put(`/admin/authors/${(editing as Author).id}`, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-authors'] });
      setToast({ tone: 'success', message: editing === 'new' ? 'Auteur créé.' : 'Auteur mis à jour.' });
      setEditing(null);
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'enregistrer cet auteur.") }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/authors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-authors'] });
      setDeleteTarget(null);
      setToast({ tone: 'success', message: 'Auteur supprimé.' });
    },
    onError: (error) => setToast({ tone: 'error', message: apiErrorMessage(error, 'Impossible de supprimer cet auteur.') }),
  });

  return (
    <SectionCard icon={<UserRound size={20} />} title="Auteurs" description="Profils éditoriaux affichés sur les articles.">
      <div className="flex justify-end px-6 pt-5">
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800"
        >
          <Plus size={16} /> Nouvel auteur
        </button>
      </div>
      {authors.isLoading && <p className="p-6 text-slate-500">Chargement…</p>}
      {authors.isError && <p className="p-6 text-red-700">Impossible de charger les auteurs.</p>}
      {authors.data && authors.data.length === 0 && <p className="p-6 text-slate-500">Aucun auteur pour le moment.</p>}
      {authors.data && authors.data.length > 0 && (
        <div className="max-w-full overflow-x-auto p-6 pt-4 contain-layout">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs tracking-wider text-slate-500 uppercase">
              <tr>
                <th className="py-3 pr-4">Nom</th>
                <th className="py-3 pr-4">Slug</th>
                <th className="py-3 pr-4">Articles</th>
                <th className="py-3 pr-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {authors.data.map((author) => (
                <tr key={author.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-4 font-semibold text-slate-900">{author.display_name}</td>
                  <td className="py-3 pr-4 text-slate-500">{author.slug}</td>
                  <td className="py-3 pr-4 text-slate-500">{author.articles_count}</td>
                  <td className="py-3 pr-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openEdit(author)}
                        className="rounded p-2 text-slate-600 hover:bg-slate-100"
                        aria-label={`Modifier ${author.display_name}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(author)}
                        className="rounded p-2 text-red-700 hover:bg-red-50"
                        aria-label={`Supprimer ${author.display_name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <form
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold">{editing === 'new' ? 'Nouvel auteur' : "Modifier l'auteur"}</h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded p-1 hover:bg-slate-100" aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <label className={`mt-5 ${labelClass}`}>
              Nom affiché
              <input
                required
                className={inputClass}
                value={form.display_name}
                onChange={(event) => setForm({ ...form, display_name: event.target.value })}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Slug (optionnel)
              <input
                className={inputClass}
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
              />
            </label>
            <label className={`mt-4 ${labelClass}`}>
              Biographie
              <textarea
                className={inputClass}
                rows={3}
                value={form.bio}
                onChange={(event) => setForm({ ...form, bio: event.target.value })}
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditing(null)} className="rounded px-4 py-2 text-sm font-semibold hover:bg-slate-100">
                Annuler
              </button>
              <button
                disabled={save.isPending}
                className="rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
              >
                {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
      {deleteTarget && (
        <ConfirmDelete
          title={`Supprimer « ${deleteTarget.display_name} » ?`}
          description="Cet auteur ne pourra pas être supprimé si des articles lui sont encore rattachés."
          pending={remove.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => remove.mutate(deleteTarget.id)}
        />
      )}
    </SectionCard>
  );
}

export function Taxonomy() {
  const [toast, setToast] = React.useState<ToastState>(null);
  return (
    <>
      <header>
        <p className="text-sm font-semibold text-orange-700">CMS</p>
        <h2 className="text-3xl font-bold">Rubriques, tags & auteurs</h2>
        <p className="mt-1 text-sm text-slate-500">Structurez la taxonomie éditoriale du site.</p>
      </header>
      <div className="mt-6 grid grid-cols-1 gap-6">
        <CategoriesPanel setToast={setToast} />
        <TagsPanel setToast={setToast} />
        <AuthorsPanel setToast={setToast} />
      </div>
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
