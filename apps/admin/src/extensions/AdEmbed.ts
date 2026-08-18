import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    adEmbed: {
      insertAdEmbed: () => ReturnType;
    };
  }
}

/**
 * Renders as <div data-ad-in-article></div> in the stored HTML. The public
 * site (App\Support\ArticleEmbeds) replaces that placeholder with the
 * "article_in_article" ad slot at render time — editors can drop as many of
 * these as they like anywhere in the body.
 */
export const AdEmbed = Node.create({
  name: 'adEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-ad-in-article]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-ad-in-article': '' })];
  },

  addNodeView() {
    return ({ editor, getPos, node }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-ad-in-article', '');
      dom.contentEditable = 'false';
      dom.className =
        'not-prose my-3 flex items-center gap-3 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 px-4 py-3';

      const label = document.createElement('span');
      label.className = 'shrink-0 rounded-full bg-emerald-200 px-2 py-1 text-[10px] font-bold tracking-widest text-emerald-800 uppercase';
      label.textContent = 'Annonce In-Article';

      const hint = document.createElement('span');
      hint.className = 'min-w-0 flex-1 truncate text-sm font-semibold text-slate-600';
      hint.textContent = 'Emplacement publicitaire — remplacé par une annonce AdSense sur le site';

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'shrink-0 rounded p-1 text-emerald-700 hover:bg-emerald-200';
      remove.textContent = '✕';
      remove.setAttribute('aria-label', 'Retirer cette annonce In-Article');
      remove.addEventListener('click', () => {
        if (typeof getPos !== 'function') return;
        const pos = getPos();
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      });

      dom.append(label, hint, remove);
      return { dom };
    };
  },

  addCommands() {
    return {
      insertAdEmbed:
        () =>
        ({ chain }) =>
          chain().insertContent({ type: this.name }).run(),
    };
  },
});
