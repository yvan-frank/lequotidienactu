import { createRoot } from 'react-dom/client';
import { StrictMode, type ComponentType } from 'react';
import { SearchModal } from './components/SearchModal';
import { ReactionWidget } from './components/ReactionWidget';
import { CommentsWidget } from './components/CommentsWidget';
import { InfiniteArticles } from './components/InfiniteArticles';

function mount<P extends object>(
  selector: string,
  Component: ComponentType<P>,
  getProps: (el: HTMLElement) => P = () => ({}) as P,
) {
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    createRoot(el).render(
      <StrictMode>
        <Component {...getProps(el)} />
      </StrictMode>,
    );
  });
}

mount('[data-island="search-trigger"]', SearchModal);
mount('[data-island="reactions"]', ReactionWidget, (el) => ({
  articleId: Number(el.dataset.articleId),
}));
mount('[data-island="comments"]', CommentsWidget, (el) => ({
  articleId: Number(el.dataset.articleId),
}));
mount('[data-island="infinite-articles"]', InfiniteArticles, (el) => ({
  category: el.dataset.category || undefined,
  query: el.dataset.query || undefined,
  author: el.dataset.author || undefined,
  currentCategory: el.dataset.currentCategory || undefined,
  page: Number(el.dataset.page) || 1,
  hasMore: el.dataset.hasMore === '1',
}));
