import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Trash2,
  Undo2,
} from 'lucide-react';
import { MediaPicker, type Media } from './MediaPicker';

function ToolbarButton({
  active,
  disabled,
  label,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`rounded p-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'bg-slate-900 text-white hover:bg-slate-900' : 'text-slate-700 hover:bg-white'
      }`}
    >
      {children}
    </button>
  );
}

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const closeOutside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const closeEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('mousedown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('mousedown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [onClose]);
  return ref;
}

function LinkPopover({ editor, onClose }: { editor: Editor | null; onClose: () => void }) {
  const existingHref = (editor?.getAttributes('link').href as string | undefined) ?? '';
  const [url, setUrl] = useState(existingHref);
  const containerRef = useClickOutside(onClose);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const apply = () => {
    const trimmed = url.trim();
    if (trimmed === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run();
    }
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-full left-0 z-30 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          apply();
        }
      }}
    >
      <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">
        {existingHref ? 'Modifier le lien' : 'Insérer un lien'}
      </p>
      <label className="mt-3 block text-sm font-semibold text-slate-700">
        Adresse (URL)
        <input
          ref={inputRef}
          className="mt-1.5 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://exemple.fr/page"
        />
      </label>
      <div className="mt-4 flex items-center justify-between gap-2">
        {existingHref ? (
          <button
            type="button"
            onClick={() => {
              editor?.chain().focus().extendMarkRange('link').unsetLink().run();
              onClose();
            }}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} /> Retirer le lien
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
            Annuler
          </button>
          <button type="button" onClick={apply} className="rounded bg-orange-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-800">
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, TiptapLink.configure({ openOnClick: false }), TiptapImage],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
    // Only resync when the parent explicitly replaces the value (e.g. loading a record).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return (
    <div>
      <div className="mt-2 flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-slate-200 bg-slate-50 p-2">
        <ToolbarButton label="Annuler" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Rétablir" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>
          <Redo2 size={16} />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
        <ToolbarButton label="Gras" active={editor?.isActive('bold')} onClick={() => editor?.chain().focus().toggleBold().run()}>
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton label="Italique" active={editor?.isActive('italic')} onClick={() => editor?.chain().focus().toggleItalic().run()}>
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton label="Barré" active={editor?.isActive('strike')} onClick={() => editor?.chain().focus().toggleStrike().run()}>
          <Strikethrough size={16} />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
        <ToolbarButton label="Titre 2" active={editor?.isActive('heading', { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton label="Titre 3" active={editor?.isActive('heading', { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={16} />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
        <ToolbarButton label="Liste à puces" active={editor?.isActive('bulletList')} onClick={() => editor?.chain().focus().toggleBulletList().run()}>
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton label="Liste numérotée" active={editor?.isActive('orderedList')} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton label="Citation" active={editor?.isActive('blockquote')} onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
          <Quote size={16} />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
        <div className="relative">
          <ToolbarButton label="Lien" active={editor?.isActive('link')} onClick={() => setLinkOpen((current) => !current)}>
            <Link2 size={16} />
          </ToolbarButton>
          {linkOpen && <LinkPopover editor={editor} onClose={() => setLinkOpen(false)} />}
        </div>
        <ToolbarButton label="Insérer une image" onClick={() => setMediaPickerOpen(true)}>
          <ImageIcon size={16} />
        </ToolbarButton>
      </div>
      <div className="rounded-b-lg border border-slate-200 bg-white px-4 py-3">
        <EditorContent
          editor={editor}
          className="prose prose-slate max-w-none focus:outline-none [&_.ProseMirror]:min-h-[320px] [&_.ProseMirror]:focus:outline-none"
        />
      </div>
      {mediaPickerOpen && (
        <MediaPicker
          onClose={() => setMediaPickerOpen(false)}
          onSelect={(media: Media) => {
            editor?.chain().focus().setImage({ src: media.url, alt: media.alt_text ?? '' }).run();
            setMediaPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
