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
import {
  Columns2,
  GripVertical,
  Heading,
  HelpCircle,
  Image as ImageIcon,
  Megaphone,
  MousePointerClick,
  Quote,
  Trash2,
  Type,
} from 'lucide-react';
import { MediaPicker, type Media } from './MediaPicker';
import { RichTextEditor } from './RichTextEditor';

export type ContentBlock = { id: string; type: string; props: Record<string, any> };

const fieldLabelClass = 'block text-xs font-semibold text-slate-600';
const fieldInputClass =
  'mt-1 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm focus:border-orange-600 focus:outline-none';

function HeadingBlockEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (props: Record<string, any>) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[100px_1fr]">
      <label className={fieldLabelClass}>
        Niveau
        <select
          className={fieldInputClass}
          value={props.level ?? 2}
          onChange={(event) => onChange({ ...props, level: Number(event.target.value) })}
        >
          <option value={2}>Titre 2</option>
          <option value={3}>Titre 3</option>
        </select>
      </label>
      <label className={fieldLabelClass}>
        Texte
        <input
          className={fieldInputClass}
          value={props.text ?? ''}
          onChange={(event) => onChange({ ...props, text: event.target.value })}
          placeholder="Intitulé de la section…"
        />
      </label>
    </div>
  );
}

function TextBlockEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (props: Record<string, any>) => void;
}) {
  return <RichTextEditor value={props.html ?? ''} onChange={(html) => onChange({ ...props, html })} />;
}

function ImageBlockEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (props: Record<string, any>) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  return (
    <div className="grid gap-3">
      {props.url ? (
        <div className="relative overflow-hidden rounded-lg border border-slate-200">
          <img src={props.url} alt="" className="max-h-56 w-full object-cover" />
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="absolute right-2 bottom-2 rounded bg-slate-950/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-950"
          >
            Remplacer
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="grid place-items-center rounded-lg border-2 border-dashed border-slate-300 p-6 text-sm font-semibold text-slate-500 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-800"
        >
          Choisir une image
        </button>
      )}
      <label className={fieldLabelClass}>
        Texte alternatif
        <input
          className={fieldInputClass}
          value={props.alt ?? ''}
          onChange={(event) => onChange({ ...props, alt: event.target.value })}
          placeholder="Décrivez l’image pour les lecteurs"
        />
      </label>
      <label className={fieldLabelClass}>
        Légende (optionnel)
        <input
          className={fieldInputClass}
          value={props.caption ?? ''}
          onChange={(event) => onChange({ ...props, caption: event.target.value })}
        />
      </label>
      {pickerOpen && (
        <MediaPicker
          onClose={() => setPickerOpen(false)}
          onSelect={(media: Media) => {
            onChange({ ...props, url: media.url, media_id: media.id, alt: props.alt || media.alt_text || '' });
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function QuoteBlockEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (props: Record<string, any>) => void;
}) {
  return (
    <div className="grid gap-2">
      <label className={fieldLabelClass}>
        Citation
        <textarea
          rows={3}
          className={fieldInputClass}
          value={props.text ?? ''}
          onChange={(event) => onChange({ ...props, text: event.target.value })}
          placeholder="Le texte mis en avant…"
        />
      </label>
      <label className={fieldLabelClass}>
        Auteur / source (optionnel)
        <input
          className={fieldInputClass}
          value={props.author ?? ''}
          onChange={(event) => onChange({ ...props, author: event.target.value })}
        />
      </label>
    </div>
  );
}

type FaqItem = { question: string; answer: string };

function FaqBlockEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (props: Record<string, any>) => void;
}) {
  const items: FaqItem[] = Array.isArray(props.items) && props.items.length > 0 ? props.items : [{ question: '', answer: '' }];
  const updateItem = (index: number, patch: Partial<FaqItem>) =>
    onChange({ ...props, items: items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    onChange({ ...props, items: items.filter((_, i) => i !== index) });
  };
  const addItem = () => onChange({ ...props, items: [...items, { question: '', answer: '' }] });

  return (
    <div className="grid gap-2">
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="flex items-center gap-2">
            <input
              className={`${fieldInputClass} mt-0 font-semibold`}
              value={item.question}
              onChange={(event) => updateItem(index, { question: event.target.value })}
              placeholder={`Question ${index + 1}`}
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={items.length <= 1}
              className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label={`Retirer la question ${index + 1}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
          <textarea
            rows={2}
            className={fieldInputClass}
            value={item.answer}
            onChange={(event) => updateItem(index, { answer: event.target.value })}
            placeholder="Réponse…"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="inline-flex w-fit items-center gap-1.5 rounded px-2 py-1.5 text-sm font-semibold text-orange-700 hover:bg-orange-50"
      >
        + Ajouter une question
      </button>
    </div>
  );
}

const BUTTON_STYLES: { value: string; label: string }[] = [
  { value: 'solid', label: 'Plein' },
  { value: 'outline', label: 'Contour' },
  { value: 'soft', label: 'Doux' },
  { value: 'link', label: 'Lien' },
];

function ButtonBlockEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (props: Record<string, any>) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className={fieldLabelClass}>
        Texte du bouton
        <input
          className={fieldInputClass}
          value={props.text ?? ''}
          onChange={(event) => onChange({ ...props, text: event.target.value })}
          placeholder="Découvrir"
        />
      </label>
      <label className={fieldLabelClass}>
        Lien
        <input
          className={fieldInputClass}
          value={props.url ?? ''}
          onChange={(event) => onChange({ ...props, url: event.target.value })}
          placeholder="https://…"
        />
      </label>
      <label className={fieldLabelClass}>
        Style
        <select
          className={fieldInputClass}
          value={props.style ?? 'solid'}
          onChange={(event) => onChange({ ...props, style: event.target.value })}
        >
          {BUTTON_STYLES.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input
          type="checkbox"
          className="rounded border-slate-300"
          checked={Boolean(props.fullWidth)}
          onChange={(event) => onChange({ ...props, fullWidth: event.target.checked })}
        />
        Pleine largeur
      </label>
    </div>
  );
}

function AdBlockEditor() {
  return (
    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">
      Un emplacement publicitaire s’affichera automatiquement ici (masqué pour les lecteurs premium).
    </p>
  );
}

type ColumnData = { blocks: ContentBlock[] };

function ColumnsBlockEditor({
  props,
  onChange,
}: {
  props: Record<string, any>;
  onChange: (props: Record<string, any>) => void;
}) {
  const columns: ColumnData[] =
    Array.isArray(props.columns) && props.columns.length >= 2 ? props.columns : [{ blocks: [] }, { blocks: [] }];
  const setColumnBlocks = (index: number, blocks: ContentBlock[]) =>
    onChange({ ...props, columns: columns.map((column, i) => (i === index ? { blocks } : column)) });
  const setColumnCount = (count: number) => {
    const next = [...columns];
    while (next.length < count) next.push({ blocks: [] });
    onChange({ ...props, columns: next.slice(0, count) });
  };

  return (
    <div>
      <label className={`${fieldLabelClass} sm:w-40`}>
        Nombre de colonnes
        <select
          className={fieldInputClass}
          value={columns.length}
          onChange={(event) => setColumnCount(Number(event.target.value))}
        >
          <option value={2}>2 colonnes</option>
          <option value={3}>3 colonnes</option>
        </select>
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {columns.map((column, index) => (
          <div key={index} className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-2.5">
            <p className="mb-2 text-xs font-bold tracking-widest text-slate-400 uppercase">Colonne {index + 1}</p>
            <ContentBuilder
              blocks={column.blocks}
              onChange={(blocks) => setColumnBlocks(index, blocks)}
              excludeTypes={['columns']}
              compact
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Every block type the "Composants" content builder can insert. Adding a
 * new one is: an entry here (icon/label/default props/editor) plus a
 * matching `case` in the PHP renderer, App\Support\ContentBlocks — no
 * other change to the builder itself. Same pattern as SidebarBuilder.
 */
const BLOCKS: {
  type: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  defaultProps: Record<string, any>;
  Editor: React.ComponentType<{ props: Record<string, any>; onChange: (props: Record<string, any>) => void }>;
}[] = [
  { type: 'heading', label: 'Titre', icon: Heading, defaultProps: { level: 2, text: '' }, Editor: HeadingBlockEditor },
  { type: 'text', label: 'Texte', icon: Type, defaultProps: { html: '' }, Editor: TextBlockEditor },
  {
    type: 'image',
    label: 'Image',
    icon: ImageIcon,
    defaultProps: { url: '', media_id: null, alt: '', caption: '' },
    Editor: ImageBlockEditor,
  },
  { type: 'quote', label: 'Citation', icon: Quote, defaultProps: { text: '', author: '' }, Editor: QuoteBlockEditor },
  {
    type: 'faq',
    label: 'FAQ',
    icon: HelpCircle,
    defaultProps: { items: [{ question: '', answer: '' }] },
    Editor: FaqBlockEditor,
  },
  {
    type: 'button',
    label: 'Bouton',
    icon: MousePointerClick,
    defaultProps: { text: 'Découvrir', url: '', style: 'solid', fullWidth: false },
    Editor: ButtonBlockEditor,
  },
  { type: 'ad', label: 'Publicité', icon: Megaphone, defaultProps: {}, Editor: AdBlockEditor },
  {
    type: 'columns',
    label: 'Colonnes',
    icon: Columns2,
    defaultProps: { columns: [{ blocks: [] }, { blocks: [] }] },
    Editor: ColumnsBlockEditor,
  },
];

function SortableBlock({
  block,
  onRemove,
  onChange,
}: {
  block: ContentBlock;
  onRemove: () => void;
  onChange: (props: Record<string, any>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const blockDef = BLOCKS.find((candidate) => candidate.type === block.type);
  const Icon = blockDef?.icon ?? Type;

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-1 text-slate-400 hover:bg-slate-100 active:cursor-grabbing"
          aria-label="Réorganiser ce bloc"
        >
          <GripVertical size={16} />
        </button>
        <Icon size={15} className="shrink-0 text-slate-500" />
        <span className="flex-1 truncate text-xs font-bold tracking-widest text-slate-500 uppercase">
          {blockDef?.label ?? block.type}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1.5 text-red-600 hover:bg-red-50"
          aria-label={`Retirer ce bloc ${blockDef?.label ?? ''}`}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="p-3">
        {blockDef ? <blockDef.Editor props={block.props} onChange={onChange} /> : null}
      </div>
    </div>
  );
}

export function ContentBuilder({
  blocks,
  onChange,
  excludeTypes,
  compact,
}: {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  /** Block types hidden from this instance's palette — used by the Colonnes
   * block's nested builders to keep columns from containing more columns. */
  excludeTypes?: string[];
  /** Tighter spacing for a builder nested inside another block (Colonnes). */
  compact?: boolean;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const availableBlocks = excludeTypes ? BLOCKS.filter((block) => !excludeTypes.includes(block.type)) : BLOCKS;

  const addBlock = (type: string) => {
    const blockDef = BLOCKS.find((candidate) => candidate.type === type);
    if (!blockDef) return;
    onChange([...blocks, { id: crypto.randomUUID(), type, props: { ...blockDef.defaultProps } }]);
  };
  const removeBlock = (id: string) => onChange(blocks.filter((block) => block.id !== id));
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
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {!compact && <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Ajouter un bloc</span>}
        {availableBlocks.map((block) => (
          <button
            key={block.type}
            type="button"
            onClick={() => addBlock(block.type)}
            className={`inline-flex items-center gap-1.5 rounded border border-dashed border-slate-300 font-semibold text-slate-700 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-800 ${compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'}`}
          >
            <block.icon size={compact ? 12 : 14} /> {block.label}
          </button>
        ))}
      </div>
      {blocks.length === 0 && (
        <p className={`mt-3 rounded-lg border border-dashed border-slate-300 text-center text-slate-500 ${compact ? 'p-3 text-xs' : 'p-6 text-sm'}`}>
          {compact ? 'Ajoutez un bloc.' : 'Ajoutez un bloc ci-dessus pour commencer à construire l’article.'}
        </p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-3 grid gap-3">
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                onRemove={() => removeBlock(block.id)}
                onChange={(props) => updateProps(block.id, props)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
