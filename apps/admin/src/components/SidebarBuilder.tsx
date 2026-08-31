import React from 'react';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Mail, Megaphone, Newspaper, Trash2, Type } from 'lucide-react';

export type SidebarBlock = { id: string; type: string; props: Record<string, any> };

type ConfigFormProps = { props: Record<string, any>; onChange: (props: Record<string, any>) => void };

const fieldLabelClass = 'block text-xs font-semibold text-slate-600';
const fieldInputClass =
  'mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm focus:border-orange-600 focus:outline-none';

function LatestArticlesConfig({ props, onChange }: ConfigFormProps) {
  return (
    <div className="grid gap-2">
      <label className={fieldLabelClass}>
        Titre
        <input
          className={fieldInputClass}
          value={props.title ?? ''}
          onChange={(event) => onChange({ ...props, title: event.target.value })}
        />
      </label>
      <label className={fieldLabelClass}>
        Nombre d’articles
        <input
          type="number"
          min={1}
          max={8}
          className={fieldInputClass}
          value={props.count ?? 4}
          onChange={(event) => onChange({ ...props, count: Number(event.target.value) || 4 })}
        />
      </label>
    </div>
  );
}

function NewsletterConfig({ props, onChange }: ConfigFormProps) {
  return (
    <div className="grid gap-2">
      <label className={fieldLabelClass}>
        Titre
        <input
          className={fieldInputClass}
          value={props.title ?? ''}
          onChange={(event) => onChange({ ...props, title: event.target.value })}
        />
      </label>
      <label className={fieldLabelClass}>
        Description (optionnel)
        <textarea
          rows={2}
          className={fieldInputClass}
          value={props.description ?? ''}
          onChange={(event) => onChange({ ...props, description: event.target.value })}
        />
      </label>
    </div>
  );
}

function TextConfig({ props, onChange }: ConfigFormProps) {
  return (
    <div className="grid gap-2">
      <label className={fieldLabelClass}>
        Titre (optionnel)
        <input
          className={fieldInputClass}
          value={props.title ?? ''}
          onChange={(event) => onChange({ ...props, title: event.target.value })}
        />
      </label>
      <label className={fieldLabelClass}>
        Texte
        <textarea
          rows={3}
          className={fieldInputClass}
          value={props.text ?? ''}
          onChange={(event) => onChange({ ...props, text: event.target.value })}
        />
      </label>
    </div>
  );
}

/**
 * Every widget type the "Composants" sidebar builder can insert. Adding a
 * new one is: an entry here (icon/label/default props + optional config
 * form) plus a matching `case` in the PHP renderer, App\Support\SidebarBlocks
 * — no other change to the builder itself.
 */
const WIDGETS: {
  type: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  defaultProps: Record<string, any>;
  ConfigForm?: React.ComponentType<ConfigFormProps>;
}[] = [
  {
    type: 'latest_articles',
    label: 'Derniers articles',
    icon: Newspaper,
    defaultProps: { title: 'À lire aussi', count: 4 },
    ConfigForm: LatestArticlesConfig,
  },
  {
    type: 'newsletter',
    label: 'Newsletter',
    icon: Mail,
    defaultProps: { title: 'Restez informé', description: '' },
    ConfigForm: NewsletterConfig,
  },
  { type: 'ad', label: 'Publicité', icon: Megaphone, defaultProps: {} },
  {
    type: 'text',
    label: 'Texte libre',
    icon: Type,
    defaultProps: { title: '', text: '' },
    ConfigForm: TextConfig,
  },
];

function SortableWidget({
  block,
  onRemove,
  onConfigChange,
}: {
  block: SidebarBlock;
  onRemove: () => void;
  onConfigChange: (props: Record<string, any>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const widgetDef = WIDGETS.find((widget) => widget.type === block.type);
  const Icon = widgetDef?.icon ?? Type;

  return (
    <div ref={setNodeRef} style={style} className="min-w-0 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
          aria-label="Réorganiser ce widget"
        >
          <GripVertical size={16} />
        </button>
        <Icon size={16} className="shrink-0 text-slate-500" />
        <span className="flex-1 truncate text-sm font-semibold text-slate-900">
          {widgetDef?.label ?? block.type}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1.5 text-red-600 hover:bg-red-50"
          aria-label={`Retirer ${widgetDef?.label ?? 'ce widget'}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
      {widgetDef?.ConfigForm && (
        <div className="border-t border-slate-100 px-3 py-3">
          <widgetDef.ConfigForm props={block.props} onChange={onConfigChange} />
        </div>
      )}
    </div>
  );
}

export function SidebarBuilder({
  blocks,
  onChange,
}: {
  blocks: SidebarBlock[];
  onChange: (blocks: SidebarBlock[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const addWidget = (type: string) => {
    const widgetDef = WIDGETS.find((widget) => widget.type === type);
    if (!widgetDef) return;
    onChange([
      ...blocks,
      { id: crypto.randomUUID(), type, props: { ...widgetDef.defaultProps } },
    ]);
  };
  const removeWidget = (id: string) => onChange(blocks.filter((block) => block.id !== id));
  const updateProps = (id: string, props: Record<string, any>) =>
    onChange(blocks.map((block) => (block.id === id ? { ...block, props } : block)));
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((block) => block.id === active.id);
    const newIndex = blocks.findIndex((block) => block.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(blocks, oldIndex, newIndex));
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_200px]">
      <div>
        {blocks.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Ajoutez un widget depuis le panneau à droite pour construire une barre latérale
            personnalisée.
          </p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-2">
              {blocks.map((block) => (
                <SortableWidget
                  key={block.id}
                  block={block}
                  onRemove={() => removeWidget(block.id)}
                  onConfigChange={(props) => updateProps(block.id, props)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      <div className="grid content-start gap-2">
        <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">Ajouter un widget</p>
        {WIDGETS.map((widget) => (
          <button
            key={widget.type}
            type="button"
            onClick={() => addWidget(widget.type)}
            className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-800"
          >
            <widget.icon size={16} /> {widget.label}
          </button>
        ))}
      </div>
    </div>
  );
}
