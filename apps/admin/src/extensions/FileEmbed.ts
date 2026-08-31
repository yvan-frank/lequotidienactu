import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileEmbed: {
      insertFileEmbed: (attrs: { url: string; name: string; bytes: number }) => ReturnType;
    };
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} Mo`;
  return `${Math.round(bytes / 1_000)} Ko`;
}

/**
 * Renders as <div data-file-attachment data-file-url="…" data-file-name="…"
 * data-file-bytes="…"></div> in the stored HTML. The public site
 * (App\Support\ArticleEmbeds) replaces that placeholder with a downloadable
 * card linking straight to the file.
 */
export const FileEmbed = Node.create({
  name: 'fileEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-file-url') ?? '',
        renderHTML: (attributes) => ({ 'data-file-url': attributes.url ?? '' }),
      },
      name: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-file-name') ?? '',
        renderHTML: (attributes) => ({ 'data-file-name': attributes.name ?? '' }),
      },
      bytes: {
        default: 0,
        parseHTML: (element) => Number(element.getAttribute('data-file-bytes') ?? 0),
        renderHTML: (attributes) => ({ 'data-file-bytes': String(attributes.bytes ?? 0) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-file-attachment]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-file-attachment': '' })];
  },

  addNodeView() {
    return ({ editor, getPos, node }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-file-attachment', '');
      dom.contentEditable = 'false';
      dom.className =
        'not-prose my-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4';

      const icon = document.createElement('span');
      icon.className = 'grid size-10 shrink-0 place-items-center rounded-lg bg-slate-700 text-white';
      icon.textContent = '📎';
      icon.setAttribute('aria-hidden', 'true');

      const info = document.createElement('div');
      info.className = 'min-w-0 flex-1';
      const name = document.createElement('p');
      name.className = 'truncate font-bold text-slate-900';
      name.textContent = node.attrs.name || 'Document';
      const meta = document.createElement('p');
      meta.className = 'text-xs font-medium text-slate-500';
      const size = formatBytes(node.attrs.bytes);
      meta.textContent = size ? `Fichier joint · ${size}` : 'Fichier joint';
      info.append(name, meta);

      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900';
      removeButton.textContent = '✕';
      removeButton.setAttribute('aria-label', 'Retirer ce fichier');
      removeButton.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos === null || pos === undefined) return;
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      });

      dom.append(icon, info, removeButton);

      return {
        dom,
        ignoreMutation: () => true,
        stopEvent: (event) => (event.target as HTMLElement | null)?.tagName === 'BUTTON',
      };
    };
  },

  addCommands() {
    return {
      insertFileEmbed:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs })
            .run(),
    };
  },
});
