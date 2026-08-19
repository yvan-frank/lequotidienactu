import { Node, mergeAttributes } from '@tiptap/core';

export type FaqItem = { question: string; answer: string };

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    faqEmbed: {
      insertFaqEmbed: () => ReturnType;
    };
  }
}

function parseItems(raw: string | null): FaqItem[] {
  if (!raw) return [{ question: '', answer: '' }];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [{ question: '', answer: '' }];
  } catch {
    return [{ question: '', answer: '' }];
  }
}

/**
 * Renders as <div data-faq='[{"question":"…","answer":"…"}, …]'></div> in
 * the stored HTML. The public site (App\Support\ArticleEmbeds) replaces
 * that placeholder with an accordion (native <details>/<summary>, no JS
 * needed) plus FAQPage JSON-LD for rich search results.
 */
export const FaqEmbed = Node.create({
  name: 'faqEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      items: {
        default: [{ question: '', answer: '' }] as FaqItem[],
        parseHTML: (element) => parseItems(element.getAttribute('data-faq')),
        renderHTML: (attributes) => ({ 'data-faq': JSON.stringify(attributes.items ?? []) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-faq]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ({ editor, getPos, node: initialNode }) => {
      let node = initialNode;
      let items: FaqItem[] = node.attrs.items ?? [{ question: '', answer: '' }];
      let selfTriggeredUpdate = false;

      const commit = () => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos === null || pos === undefined) return;
        selfTriggeredUpdate = true;
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { items }));
      };

      const dom = document.createElement('div');
      dom.setAttribute('data-faq', JSON.stringify(items));
      dom.contentEditable = 'false';
      dom.className = 'not-prose my-4 rounded-xl border border-brand-200 bg-brand-50/40 p-4';

      const header = document.createElement('div');
      header.className = 'flex items-center justify-between gap-3';
      const label = document.createElement('span');
      label.className =
        'inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-bold tracking-widest text-white uppercase';
      label.textContent = 'FAQ';
      const removeBlock = document.createElement('button');
      removeBlock.type = 'button';
      removeBlock.className = 'rounded p-1 text-brand-700 hover:bg-brand-100';
      removeBlock.textContent = '✕';
      removeBlock.setAttribute('aria-label', 'Retirer ce bloc FAQ');
      removeBlock.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos === null || pos === undefined) return;
        editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      });
      header.append(label, removeBlock);

      const list = document.createElement('div');
      list.className = 'mt-3 grid gap-3';

      function renderList() {
        list.innerHTML = '';
        items.forEach((item, index) => {
          const row = document.createElement('div');
          row.className = 'rounded-lg border border-slate-200 bg-white p-3';

          const rowHeader = document.createElement('div');
          rowHeader.className = 'flex items-center gap-2';

          const questionInput = document.createElement('input');
          questionInput.type = 'text';
          questionInput.placeholder = `Question ${index + 1}`;
          questionInput.value = item.question;
          questionInput.className =
            'w-full min-w-0 flex-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm font-semibold focus:border-brand-600 focus:outline-none';
          questionInput.addEventListener('input', () => {
            items = items.map((current, i) => (i === index ? { ...current, question: questionInput.value } : current));
            commit();
          });

          const removeItem = document.createElement('button');
          removeItem.type = 'button';
          removeItem.className = 'shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600';
          removeItem.textContent = '✕';
          removeItem.setAttribute('aria-label', `Retirer la question ${index + 1}`);
          removeItem.addEventListener('click', () => {
            if (items.length <= 1) return;
            items = items.filter((_, i) => i !== index);
            commit();
            renderList();
          });

          rowHeader.append(questionInput, removeItem);

          const answerTextarea = document.createElement('textarea');
          answerTextarea.rows = 2;
          answerTextarea.placeholder = 'Réponse…';
          answerTextarea.value = item.answer;
          answerTextarea.className =
            'mt-2 w-full rounded border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-600 focus:outline-none';
          answerTextarea.addEventListener('input', () => {
            items = items.map((current, i) => (i === index ? { ...current, answer: answerTextarea.value } : current));
            commit();
          });

          row.append(rowHeader, answerTextarea);
          list.append(row);
        });
      }

      renderList();

      const addButton = document.createElement('button');
      addButton.type = 'button';
      addButton.className =
        'mt-3 inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-100';
      addButton.textContent = '+ Ajouter une question';
      addButton.addEventListener('click', () => {
        items = [...items, { question: '', answer: '' }];
        commit();
        renderList();
      });

      dom.append(header, list, addButton);

      return {
        dom,
        // Every keystroke commits a transaction that changes this node's own
        // attrs (there's no other way to persist the text). Without this,
        // Tiptap has no way to know the NodeView already reflects the new
        // value and destroys + recreates the whole DOM on every change,
        // which drops focus mid-keystroke and makes the block feel like it
        // "disappears" while typing.
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'faqEmbed') return false;
          node = updatedNode;
          if (selfTriggeredUpdate) {
            selfTriggeredUpdate = false;
            return true;
          }
          items = updatedNode.attrs.items ?? [{ question: '', answer: '' }];
          renderList();
          return true;
        },
        ignoreMutation: () => true,
      };
    };
  },

  addCommands() {
    return {
      insertFaqEmbed:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { items: [{ question: '', answer: '' }] } })
            .run(),
    };
  },
});
