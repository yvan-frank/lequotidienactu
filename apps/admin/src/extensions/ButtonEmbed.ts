import { Node, mergeAttributes } from '@tiptap/core';

export type ButtonStyle = 'solid' | 'outline' | 'soft' | 'link';

const STYLES: { value: ButtonStyle; label: string }[] = [
  { value: 'solid', label: 'Plein' },
  { value: 'outline', label: 'Contour' },
  { value: 'soft', label: 'Doux' },
  { value: 'link', label: 'Lien' },
];

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    buttonEmbed: {
      insertButtonEmbed: () => ReturnType;
    };
  }
}

/**
 * Same isolation trick as FaqEmbed: without stopping propagation, a
 * keystroke inside these inputs is read by ProseMirror as "replace the
 * selected atom node with this character" and wipes the block.
 */
function isolateFromEditor(element: HTMLElement): void {
  ['keydown', 'keypress', 'keyup', 'beforeinput'].forEach((type) => {
    element.addEventListener(type, (event) => event.stopPropagation());
  });
}

function previewClasses(style: ButtonStyle): string {
  switch (style) {
    case 'outline':
      return 'border-2 border-orange-700 text-orange-800 bg-white';
    case 'soft':
      return 'border border-orange-100 bg-orange-50 text-orange-800';
    case 'link':
      return 'text-orange-800 underline underline-offset-4 px-0 py-0';
    case 'solid':
    default:
      return 'bg-orange-700 text-white border border-transparent';
  }
}

/**
 * Renders as <div data-cta-button data-cta-text="…" data-cta-url="…"
 * data-cta-style="solid|outline|soft|link"></div> in the stored HTML. The
 * public site (App\Support\ArticleEmbeds) replaces that placeholder with a
 * styled <a> tag matching one of the four configurable button styles.
 */
export const ButtonEmbed = Node.create({
  name: 'buttonEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      text: {
        default: 'Découvrir',
        parseHTML: (element) => element.getAttribute('data-cta-text') ?? 'Découvrir',
        renderHTML: (attributes) => ({ 'data-cta-text': attributes.text ?? '' }),
      },
      url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-cta-url') ?? '',
        renderHTML: (attributes) => ({ 'data-cta-url': attributes.url ?? '' }),
      },
      style: {
        default: 'solid' as ButtonStyle,
        parseHTML: (element) =>
          (element.getAttribute('data-cta-style') as ButtonStyle) ?? 'solid',
        renderHTML: (attributes) => ({ 'data-cta-style': attributes.style ?? 'solid' }),
      },
      fullWidth: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-cta-full') === '1',
        renderHTML: (attributes) => ({ 'data-cta-full': attributes.fullWidth ? '1' : '0' }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-cta-button]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-cta-button': '' })];
  },

  addNodeView() {
    return ({ editor, getPos, node: initialNode }) => {
      let node = initialNode;
      let selfTriggeredUpdate = false;

      const commit = (attrs: { text?: string; url?: string; style?: ButtonStyle; fullWidth?: boolean }) => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos === null || pos === undefined) return;
        selfTriggeredUpdate = true;
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attrs }),
        );
      };

      const dom = document.createElement('div');
      dom.setAttribute('data-cta-button', '');
      dom.contentEditable = 'false';
      dom.className = 'not-prose my-4 rounded-xl border border-orange-200 bg-orange-50/60 p-4';

      const header = document.createElement('div');
      header.className = 'flex items-center justify-between gap-3';
      const label = document.createElement('span');
      label.className =
        'inline-flex items-center gap-1.5 rounded-full bg-orange-700 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white uppercase';
      label.textContent = 'Bouton';
      const removeBlock = document.createElement('button');
      removeBlock.type = 'button';
      removeBlock.className = 'rounded p-1 text-orange-800 hover:bg-orange-100';
      removeBlock.textContent = '✕';
      removeBlock.setAttribute('aria-label', 'Retirer ce bouton');
      removeBlock.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos === null || pos === undefined) return;
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      });
      header.append(label, removeBlock);

      const fields = document.createElement('div');
      fields.className = 'mt-3 grid gap-2 sm:grid-cols-2';

      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.placeholder = 'Texte du bouton';
      textInput.value = node.attrs.text ?? '';
      textInput.className =
        'w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-semibold focus:border-orange-700 focus:outline-none';
      isolateFromEditor(textInput);

      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.placeholder = 'https://…';
      urlInput.value = node.attrs.url ?? '';
      urlInput.className =
        'w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-orange-700 focus:outline-none';
      isolateFromEditor(urlInput);

      fields.append(textInput, urlInput);

      const swatches = document.createElement('div');
      swatches.className = 'mt-3 flex flex-wrap items-center gap-1.5';

      // A <span>, not <a> — the editor's global ".ProseMirror a" link
      // styling (red, underlined) would otherwise override these utility
      // classes regardless of style, since it's a hand-authored rule with
      // higher specificity than a single Tailwind class.
      const preview = document.createElement('span');
      preview.setAttribute('aria-hidden', 'true');
      preview.className =
        'pointer-events-none mt-3 inline-flex w-fit items-center rounded-full px-5 py-2.5 text-sm font-bold transition';

      const swatchButtons: HTMLButtonElement[] = [];
      STYLES.forEach(({ value, label: styleLabel }) => {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.textContent = styleLabel;
        swatch.dataset.style = value;
        swatch.className = 'rounded-full border px-3 py-1 text-xs font-semibold transition';
        swatch.addEventListener('click', () => {
          commit({ style: value });
          renderPreview();
          highlightSwatch();
        });
        swatchButtons.push(swatch);
        swatches.append(swatch);
      });

      const separator = document.createElement('span');
      separator.className = 'mx-0.5 h-4 w-px bg-orange-200';
      separator.setAttribute('aria-hidden', 'true');

      const widthToggle = document.createElement('button');
      widthToggle.type = 'button';
      widthToggle.className = 'rounded-full border px-3 py-1 text-xs font-semibold transition';
      widthToggle.addEventListener('click', () => {
        commit({ fullWidth: !node.attrs.fullWidth });
        renderPreview();
        highlightWidthToggle();
      });
      swatches.append(separator, widthToggle);

      function highlightSwatch() {
        const current: ButtonStyle = node.attrs.style ?? 'solid';
        swatchButtons.forEach((button) => {
          const isActive = button.dataset.style === current;
          button.className = `rounded-full border px-3 py-1 text-xs font-semibold transition ${
            isActive
              ? 'border-orange-700 bg-orange-700 text-white'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
          }`;
        });
      }

      function highlightWidthToggle() {
        const isFull = Boolean(node.attrs.fullWidth);
        widthToggle.textContent = isFull ? '↔ Pleine largeur' : '↔ Largeur auto';
        widthToggle.className = `rounded-full border px-3 py-1 text-xs font-semibold transition ${
          isFull
            ? 'border-orange-700 bg-orange-700 text-white'
            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
        }`;
      }

      function renderPreview() {
        const current: ButtonStyle = node.attrs.style ?? 'solid';
        const isFull = Boolean(node.attrs.fullWidth);
        const widthClasses = isFull ? 'w-full justify-center text-center' : 'w-fit';
        preview.className = `pointer-events-none mt-3 flex items-center rounded-full px-5 py-2.5 text-sm font-bold transition ${widthClasses} ${previewClasses(current)}`;
        preview.textContent = (node.attrs.text ?? '').trim() || 'Texte du bouton';
      }

      textInput.addEventListener('input', () => {
        commit({ text: textInput.value });
        renderPreview();
      });
      urlInput.addEventListener('input', () => {
        commit({ url: urlInput.value });
      });

      renderPreview();
      highlightSwatch();
      highlightWidthToggle();

      dom.append(header, fields, swatches, preview);

      return {
        dom,
        // See FaqEmbed for why this manual reconciliation is required: every
        // keystroke commits a transaction that changes this node's own
        // attrs, so Tiptap must be told the NodeView already reflects it or
        // it tears down and rebuilds the DOM mid-keystroke.
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'buttonEmbed') return false;
          node = updatedNode;
          if (selfTriggeredUpdate) {
            selfTriggeredUpdate = false;
            return true;
          }
          textInput.value = node.attrs.text ?? '';
          urlInput.value = node.attrs.url ?? '';
          renderPreview();
          highlightSwatch();
          highlightWidthToggle();
          return true;
        },
        ignoreMutation: () => true,
        stopEvent: (event) => {
          const target = event.target as HTMLElement | null;
          return !!target && ['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName);
        },
      };
    };
  },

  addCommands() {
    return {
      insertButtonEmbed:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { text: 'Découvrir', url: '', style: 'solid', fullWidth: false },
            })
            .run(),
    };
  },
});
