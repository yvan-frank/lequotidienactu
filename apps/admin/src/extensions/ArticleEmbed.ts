import { Node, mergeAttributes } from '@tiptap/core';

export type ArticleEmbedAttrs = {
  articleId: number;
  title: string;
  categorySlug: string | null;
  slug: string | null;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    articleEmbed: {
      insertArticleEmbed: (attrs: ArticleEmbedAttrs) => ReturnType;
    };
  }
}

/**
 * Renders as <div data-lire-aussi data-article-id="…" …></div> in the
 * stored HTML. The public site (App\Support\ArticleEmbeds) replaces that
 * placeholder with a live "À lire aussi" card at render time, looking the
 * target article up by id — so the link/title stay correct even if the
 * source article's slug or title changes after this was inserted.
 */
export const ArticleEmbed = Node.create({
  name: 'articleEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      articleId: {
        default: null,
        parseHTML: (element) => Number(element.getAttribute('data-article-id')) || null,
        renderHTML: (attributes) => ({ 'data-article-id': attributes.articleId }),
      },
      title: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-title') || '',
        renderHTML: (attributes) => ({ 'data-title': attributes.title }),
      },
      categorySlug: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-category'),
        renderHTML: (attributes) => ({ 'data-category': attributes.categorySlug }),
      },
      slug: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-slug'),
        renderHTML: (attributes) => ({ 'data-slug': attributes.slug }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-lire-aussi]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-lire-aussi': '' })];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-lire-aussi', '');
      dom.setAttribute('data-article-id', String(node.attrs.articleId ?? ''));
      dom.setAttribute('data-title', node.attrs.title ?? '');
      if (node.attrs.categorySlug) dom.setAttribute('data-category', node.attrs.categorySlug);
      if (node.attrs.slug) dom.setAttribute('data-slug', node.attrs.slug);
      dom.contentEditable = 'false';
      dom.className =
        'not-prose my-3 flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3';

      const label = document.createElement('span');
      label.className = 'shrink-0 rounded-full bg-orange-200 px-2 py-1 text-[10px] font-bold tracking-widest text-orange-800 uppercase';
      label.textContent = 'À lire aussi';

      const title = document.createElement('span');
      title.className = 'min-w-0 flex-1 truncate text-sm font-semibold text-slate-800';
      title.textContent = node.attrs.title || 'Article';

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'shrink-0 rounded p-1 text-orange-700 hover:bg-orange-200';
      remove.textContent = '✕';
      remove.setAttribute('aria-label', 'Retirer ce bloc « À lire aussi »');
      remove.addEventListener('click', () => {
        if (typeof getPos !== 'function') return;
        const pos = getPos();
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      });

      dom.append(label, title, remove);
      return { dom };
    };
  },

  addCommands() {
    return {
      insertArticleEmbed:
        (attrs: ArticleEmbedAttrs) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs }).run(),
    };
  },
});
