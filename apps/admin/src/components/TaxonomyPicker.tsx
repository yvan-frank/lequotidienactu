import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { api } from '../api';

export type NamedItem = { id: number; name: string };
export type CategoryItem = NamedItem & { parent_id?: number | null };

function hierarchicalOrder(categories: CategoryItem[]): (CategoryItem & { depth: number })[] {
  const byParent = new Map<number, CategoryItem[]>();
  for (const category of categories) {
    const key = category.parent_id ?? 0;
    byParent.set(key, [...(byParent.get(key) ?? []), category]);
  }
  const result: (CategoryItem & { depth: number })[] = [];
  const visit = (parentId: number, depth: number) => {
    for (const category of byParent.get(parentId) ?? []) {
      result.push({ ...category, depth });
      visit(category.id, depth + 1);
    }
  };
  visit(0, 0);
  return result;
}

export function CategoryCombobox({
  categories,
  value,
  onChange,
}: {
  categories: CategoryItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const selected = categories.find((category) => String(category.id) === value) ?? null;
  const ordered = React.useMemo(() => hierarchicalOrder(categories), [categories]);

  React.useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, []);

  const create = useMutation({
    mutationFn: (name: string) => api.post<{ data: { id: number } }>('/admin/categories', { name }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
      onChange(String(response.data.data.id));
      setQuery('');
      setOpen(false);
    },
  });

  const trimmed = query.trim();
  const filtered = trimmed === ''
    ? ordered
    : categories
        .filter((category) => category.name.toLowerCase().includes(trimmed.toLowerCase()))
        .map((category) => ({ ...category, depth: 0 }));
  const exactMatch = categories.some(
    (category) => category.name.toLowerCase() === trimmed.toLowerCase(),
  );

  return (
    <div className="relative" ref={containerRef}>
      <input
        className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
        placeholder="Rechercher ou créer une rubrique"
        value={open ? query : (selected?.name ?? '')}
        onFocus={() => {
          setQuery(selected?.name ?? '');
          setOpen(true);
        }}
        onChange={(event) => setQuery(event.target.value)}
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded border border-slate-200 bg-white shadow-lg">
          {filtered.map((category) => (
            <button
              type="button"
              key={category.id}
              onClick={() => {
                onChange(String(category.id));
                setOpen(false);
                setQuery('');
              }}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-orange-50 ${
                String(category.id) === value ? 'bg-orange-50 font-semibold' : ''
              }`}
              style={{ paddingLeft: `${0.75 + category.depth * 1.25}rem` }}
            >
              {category.depth > 0 && <span className="mr-1 text-slate-300">↳</span>}
              {category.name}
            </button>
          ))}
          {filtered.length === 0 && trimmed === '' && (
            <p className="px-3 py-2 text-sm text-slate-400">Aucune rubrique.</p>
          )}
          {trimmed !== '' && !exactMatch && (
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate(trimmed)}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
            >
              <Plus size={14} /> Créer « {trimmed} »
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TagsInput({
  tags,
  selectedIds,
  onChange,
}: {
  tags: NamedItem[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOutside);
    return () => document.removeEventListener('mousedown', closeOutside);
  }, []);

  const create = useMutation({
    mutationFn: (name: string) => api.post<{ data: { id: number } }>('/admin/tags', { name }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['taxonomy'] });
      onChange([...selectedIds, response.data.data.id]);
      setQuery('');
    },
  });

  const selected = tags.filter((tag) => selectedIds.includes(tag.id));
  const trimmed = query.trim();
  const filtered = tags.filter(
    (tag) => !selectedIds.includes(tag.id) && tag.name.toLowerCase().includes(trimmed.toLowerCase()),
  );
  const exactMatch = tags.some((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());

  const addTag = (id: number) => {
    onChange([...selectedIds, id]);
    setQuery('');
  };
  const removeTag = (id: number) => onChange(selectedIds.filter((existing) => existing !== id));

  return (
    <div className="relative" ref={containerRef}>
      <div className="mt-2 flex flex-wrap gap-2 rounded border border-slate-300 p-2">
        {selected.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 py-1 pr-1.5 pl-3 text-sm font-semibold text-orange-800"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              className="touch-manipulation rounded-full p-2 hover:bg-orange-100"
              aria-label={`Retirer ${tag.name}`}
            >
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          className="min-w-[8rem] flex-1 px-1 py-1 text-sm outline-none"
          placeholder={selected.length === 0 ? 'Ajouter des tags…' : 'Ajouter…'}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (filtered[0]) addTag(filtered[0].id);
              else if (trimmed !== '' && !exactMatch) create.mutate(trimmed);
            }
            if (event.key === 'Backspace' && query === '' && selected.length > 0) {
              removeTag(selected[selected.length - 1].id);
            }
          }}
        />
      </div>
      {open && (trimmed !== '' || filtered.length > 0) && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded border border-slate-200 bg-white shadow-lg">
          {filtered.map((tag) => (
            <button
              type="button"
              key={tag.id}
              onClick={() => addTag(tag.id)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-orange-50"
            >
              {tag.name}
            </button>
          ))}
          {trimmed !== '' && !exactMatch && (
            <button
              type="button"
              disabled={create.isPending}
              onClick={() => create.mutate(trimmed)}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
            >
              <Plus size={14} /> Créer le tag « {trimmed} »
            </button>
          )}
        </div>
      )}
    </div>
  );
}
