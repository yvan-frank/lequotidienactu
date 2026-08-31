import { EditorContent, useEditor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import TiptapTable from '@tiptap/extension-table';
import TiptapTableRow from '@tiptap/extension-table-row';
import TiptapTableHeader from '@tiptap/extension-table-header';
import TiptapTableCell from '@tiptap/extension-table-cell';
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Columns3,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Undo2,
} from 'lucide-react';
import { LinkPopover } from './LinkPopover';
import { MediaPicker, type Media } from './MediaPicker';
import { FilePicker, type UploadedFile } from './FilePicker';
import { FileEmbed } from '../extensions/FileEmbed';

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

export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkClickAnchor, setLinkClickAnchor] = useState<HTMLAnchorElement | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      TiptapImage,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
      TiptapTable.configure({ resizable: true }),
      TiptapTableRow,
      TiptapTableHeader,
      TiptapTableCell,
      FileEmbed,
    ],
    content: value,
    editorProps: {
      handleClick: (view, pos, event) => {
        const link = (event.target as HTMLElement).closest('a');
        if (link) {
          const { state } = view;
          view.dispatch(state.tr.setSelection(TextSelection.near(state.doc.resolve(pos))));
          setLinkClickAnchor(link);
        } else {
          setLinkClickAnchor(null);
        }
        return false;
      },
    },
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
        <ToolbarButton label="Surbrillance" active={editor?.isActive('highlight')} onClick={() => editor?.chain().focus().toggleHighlight().run()}>
          <Highlighter size={16} />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
        <ToolbarButton label="Aligner à gauche" active={editor?.isActive({ textAlign: 'left' })} onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
          <AlignLeft size={16} />
        </ToolbarButton>
        <ToolbarButton label="Centrer" active={editor?.isActive({ textAlign: 'center' })} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
          <AlignCenter size={16} />
        </ToolbarButton>
        <ToolbarButton label="Aligner à droite" active={editor?.isActive({ textAlign: 'right' })} onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
          <AlignRight size={16} />
        </ToolbarButton>
        <ToolbarButton label="Justifier" active={editor?.isActive({ textAlign: 'justify' })} onClick={() => editor?.chain().focus().setTextAlign('justify').run()}>
          <AlignJustify size={16} />
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
        <ToolbarButton label="Insérer un fichier (PDF, document…)" onClick={() => setFilePickerOpen(true)}>
          <Paperclip size={16} />
        </ToolbarButton>
        <ToolbarButton
          label="Insérer un tableau"
          active={editor?.isActive('table')}
          onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon size={16} />
        </ToolbarButton>
        {editor?.isActive('table') && (
          <>
            <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
            <ToolbarButton label="Ajouter une ligne" onClick={() => editor?.chain().focus().addRowAfter().run()}>
              <Rows3 size={16} />
            </ToolbarButton>
            <ToolbarButton label="Ajouter une colonne" onClick={() => editor?.chain().focus().addColumnAfter().run()}>
              <Columns3 size={16} />
            </ToolbarButton>
            <ToolbarButton label="Supprimer la ligne" onClick={() => editor?.chain().focus().deleteRow().run()}>
              <Trash2 size={16} />
            </ToolbarButton>
            <ToolbarButton label="Supprimer le tableau" onClick={() => editor?.chain().focus().deleteTable().run()}>
              <Trash2 size={16} className="text-red-600" />
            </ToolbarButton>
          </>
        )}
      </div>
      <div className="rounded-b-lg border border-slate-200 bg-white px-4 py-3">
        <EditorContent
          editor={editor}
          className="prose prose-slate max-w-none focus:outline-none [&_.ProseMirror]:min-h-[320px] [&_.ProseMirror]:focus:outline-none"
        />
      </div>
      {linkClickAnchor && (
        <LinkPopover
          editor={editor}
          anchorElement={linkClickAnchor}
          onClose={() => setLinkClickAnchor(null)}
        />
      )}
      {mediaPickerOpen && (
        <MediaPicker
          onClose={() => setMediaPickerOpen(false)}
          onSelect={(media: Media) => {
            editor?.chain().focus().setImage({ src: media.url, alt: media.alt_text ?? '' }).run();
            setMediaPickerOpen(false);
          }}
        />
      )}
      {filePickerOpen && (
        <FilePicker
          onClose={() => setFilePickerOpen(false)}
          onSelect={(file: UploadedFile) => {
            editor?.chain().focus().insertFileEmbed(file).run();
            setFilePickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
