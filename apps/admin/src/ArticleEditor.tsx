import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import TiptapTextStyle from '@tiptap/extension-text-style';
import TiptapColor from '@tiptap/extension-color';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  Bold,
  CheckCircle2,
  Circle,
  Eye,
  Heading2,
  Heading3,
  HelpCircle,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Maximize2,
  Megaphone,
  Minimize2,
  Newspaper,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import { api } from './api';
import { ArticlePicker, type ArticleSummary } from './components/ArticlePicker';
import { LinkPopover } from './components/LinkPopover';
import { MediaPicker, type Media } from './components/MediaPicker';
import { Toast } from './components/Toast';
import { CategoryCombobox, TagsInput } from './components/TaxonomyPicker';
import { ArticleEmbed } from './extensions/ArticleEmbed';
import { AdEmbed } from './extensions/AdEmbed';
import { FaqEmbed } from './extensions/FaqEmbed';

type Taxonomy = {
  categories: { id: number; parent_id: number | null; name: string; slug: string }[];
  authors: { id: number; display_name: string }[];
  tags: { id: number; name: string }[];
};
type Status = 'draft' | 'review' | 'scheduled' | 'published' | 'archived';
type StoredArticle = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  category_id: number | null;
  author_id: number | null;
  status: Status;
  published_at: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  robots: string;
  primary_keyword: string | null;
  secondary_keywords: string | null;
  hero_media_id: number | null;
  hero_url: string | null;
  hero_width: number | null;
  hero_height: number | null;
  hero_alt_text: string | null;
  hero_mime_type: string | null;
  hero_bytes: number | null;
  hero_created_at: string | null;
  is_sponsored: number | boolean;
  tag_ids: number[];
};
const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const normalizeForSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const containsKeyword = (haystack: string, keyword: string) =>
  keyword.trim() !== '' && normalizeForSearch(haystack).includes(normalizeForSearch(keyword.trim()));

function KeywordCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex min-w-0 items-center gap-2 ${ok ? 'text-emerald-700' : 'text-slate-400'}`}>
      {ok ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      {label}
    </li>
  );
}

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

const TEXT_COLORS = [
  { label: 'Ardoise', value: '#0f172a' },
  { label: 'Rouge', value: '#dc2626' },
  { label: 'Orange', value: '#c2410c' },
  { label: 'Ambre', value: '#b45309' },
  { label: 'Émeraude', value: '#15803d' },
  { label: 'Bleu', value: '#1d4ed8' },
  { label: 'Violet', value: '#7e22ce' },
  { label: 'Rose', value: '#be185d' },
];

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

function ColorPopover({ editor, onClose }: { editor: Editor | null; onClose: () => void }) {
  const containerRef = useClickOutside(onClose);
  return (
    <div
      ref={containerRef}
      className="absolute top-full right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
    >
      <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">
        Couleur du texte
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <button
          type="button"
          title="Par défaut"
          onClick={() => {
            editor?.chain().focus().unsetColor().run();
            onClose();
          }}
          className="grid size-9 place-items-center rounded-full border border-slate-300 bg-white text-slate-400 hover:border-slate-400"
        >
          <span className="text-xs">✕</span>
        </button>
        {TEXT_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            title={color.label}
            onClick={() => {
              editor?.chain().focus().setColor(color.value).run();
              onClose();
            }}
            className="size-9 rounded-full border border-black/10 transition hover:scale-110"
            style={{ backgroundColor: color.value }}
          />
        ))}
      </div>
    </div>
  );
}

function EditorToolbar({
  editor,
  onInsertImage,
  onInsertArticleEmbed,
}: {
  editor: Editor | null;
  onInsertImage: () => void;
  onInsertArticleEmbed: () => void;
}) {
  const onInsertAdEmbed = () => editor?.chain().focus().insertAdEmbed().run();
  const onInsertFaqEmbed = () => editor?.chain().focus().insertFaqEmbed().run();
  const [linkOpen, setLinkOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-slate-200 bg-slate-50 p-2">
      <ToolbarButton
        label="Annuler"
        disabled={!editor?.can().undo()}
        onClick={() => editor?.chain().focus().undo().run()}
      >
        <Undo2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Rétablir"
        disabled={!editor?.can().redo()}
        onClick={() => editor?.chain().focus().redo().run()}
      >
        <Redo2 size={16} />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
      <ToolbarButton
        label="Gras"
        active={editor?.isActive('bold')}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Italique"
        active={editor?.isActive('italic')}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Barré"
        active={editor?.isActive('strike')}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={16} />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
      <ToolbarButton
        label="Titre 2"
        active={editor?.isActive('heading', { level: 2 })}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Titre 3"
        active={editor?.isActive('heading', { level: 3 })}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={16} />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
      <ToolbarButton
        label="Liste à puces"
        active={editor?.isActive('bulletList')}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Liste numérotée"
        active={editor?.isActive('orderedList')}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={16} />
      </ToolbarButton>
      <ToolbarButton
        label="Citation"
        active={editor?.isActive('blockquote')}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={16} />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
      <div className="relative">
        <ToolbarButton
          label="Lien"
          active={editor?.isActive('link')}
          onClick={() => setLinkOpen((current) => !current)}
        >
          <Link2 size={16} />
        </ToolbarButton>
        {linkOpen && <LinkPopover editor={editor} onClose={() => setLinkOpen(false)} />}
      </div>
      <ToolbarButton label="Insérer une image" onClick={onInsertImage}>
        <ImageIcon size={16} />
      </ToolbarButton>
      <ToolbarButton label="À lire aussi" onClick={onInsertArticleEmbed}>
        <Newspaper size={16} />
      </ToolbarButton>
      <ToolbarButton label="Annonce In-Article" onClick={onInsertAdEmbed}>
        <Megaphone size={16} />
      </ToolbarButton>
      <ToolbarButton label="Bloc FAQ" onClick={onInsertFaqEmbed}>
        <HelpCircle size={16} />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
      <div className="relative ml-auto">
        <ToolbarButton label="Couleur du texte" onClick={() => setColorOpen((current) => !current)}>
          <Palette size={16} />
        </ToolbarButton>
        {colorOpen && <ColorPopover editor={editor} onClose={() => setColorOpen(false)} />}
      </div>
    </div>
  );
}

export function ArticleEditor({ articleId = null }: { articleId?: number | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createdId, setCreatedId] = useState<number | null>(null);
  const effectiveArticleId = articleId ?? createdId;
  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    category_id: '',
    author_id: '',
    body: '',
    meta_title: '',
    meta_description: '',
    canonical_url: '',
    robots: 'index,follow',
    primary_keyword: '',
    secondary_keywords: '',
    published_at: '',
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<'error' | 'success'>('success');
  const [heroMedia, setHeroMedia] = useState<Media | null>(null);
  const [heroAlt, setHeroAlt] = useState('');
  const [isSponsored, setIsSponsored] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [bodyImagePickerOpen, setBodyImagePickerOpen] = useState(false);
  const [articlePickerOpen, setArticlePickerOpen] = useState(false);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [contentExpanded, setContentExpanded] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const expandContent = () => {
    setContentExpanded(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setContentVisible(true)));
  };
  const collapseContent = () => {
    setContentVisible(false);
    window.setTimeout(() => setContentExpanded(false), 250);
  };
  const markDirty = () => setIsDirty(true);
  const [linkClickAnchor, setLinkClickAnchor] = useState<HTMLAnchorElement | null>(null);
  const taxonomy = useQuery({
    queryKey: ['taxonomy'],
    queryFn: async () => (await api.get<Taxonomy>('/admin/taxonomy')).data,
  });
  const existingArticle = useQuery({
    queryKey: ['admin-article', articleId],
    queryFn: async () =>
      (await api.get<{ data: StoredArticle }>(`/admin/articles/${articleId}`)).data.data,
    enabled: articleId !== null,
  });
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer' },
      }),
      TiptapImage,
      TiptapTextStyle,
      TiptapColor,
      ArticleEmbed,
      AdEmbed,
      FaqEmbed,
    ],
    content: '',
    editorProps: {
      attributes: {
        class:
          'editor-content min-h-72 rounded-b-lg border border-slate-200 bg-white p-4 outline-none max-w-none text-slate-800',
      },
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
    onUpdate: ({ editor }) => {
      setForm((current) => ({ ...current, body: editor.getHTML() }));
      markDirty();
    },
  });
  useEffect(() => {
    const article = existingArticle.data;
    if (!article) return;
    setForm({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt ?? '',
      category_id: article.category_id !== null ? String(article.category_id) : '',
      author_id: article.author_id !== null ? String(article.author_id) : '',
      body: article.body,
      meta_title: article.meta_title ?? '',
      meta_description: article.meta_description ?? '',
      canonical_url: article.canonical_url ?? '',
      robots: article.robots,
      primary_keyword: article.primary_keyword ?? '',
      secondary_keywords: article.secondary_keywords ?? '',
      published_at: article.published_at ? article.published_at.slice(0, 16).replace(' ', 'T') : '',
    });
    setSlugEdited(true);
    setTagIds(article.tag_ids ?? []);
    setHeroAlt(article.hero_alt_text ?? '');
    setIsSponsored(Boolean(article.is_sponsored));
    setHeroMedia(
      article.hero_media_id && article.hero_url
        ? {
            id: article.hero_media_id,
            url: article.hero_url,
            width: article.hero_width,
            height: article.hero_height,
            alt_text: article.hero_alt_text,
            mime_type: article.hero_mime_type ?? 'image/*',
            bytes: article.hero_bytes ?? 0,
            created_at: article.hero_created_at ?? '',
          }
        : null,
    );
    editor?.commands.setContent(article.body, false);
    setIsDirty(false);
  }, [editor, existingArticle.data]);
  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);
  const save = useMutation({
    mutationFn: async (status: Status) => ({
      response: await (effectiveArticleId
        ? api.put(`/admin/articles/${effectiveArticleId}`, {
            ...form,
            status,
            hero_media_id: heroMedia?.id ?? null,
            category_id: form.category_id ? Number(form.category_id) : null,
            author_id: form.author_id ? Number(form.author_id) : null,
            tag_ids: tagIds,
            is_sponsored: isSponsored,
          })
        : api.post('/admin/articles', {
            ...form,
            status,
            hero_media_id: heroMedia?.id ?? null,
            category_id: form.category_id ? Number(form.category_id) : null,
            author_id: form.author_id ? Number(form.author_id) : null,
            tag_ids: tagIds,
            is_sponsored: isSponsored,
          })),
      status,
      wasCreate: !effectiveArticleId,
    }),
    onSuccess: ({ response, status, wasCreate }) => {
      setNoticeTone('success');
      setNotice(
        `Article #${response.data.data.id} ${wasCreate ? 'enregistré' : 'mis à jour'} comme ${statusLabel(status)}.`,
      );
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
      if (wasCreate) {
        const newId = response.data.data.id;
        setCreatedId(newId);
        if (!articleId) {
          window.setTimeout(() => {
            navigate({ to: '/articles/$articleId', params: { articleId: String(newId) }, replace: true });
          }, 700);
        }
      }
    },
    onError: (error: any) => {
      setNoticeTone('error');
      setNotice(error.response?.data?.message ?? 'Impossible d’enregistrer l’article.');
    },
  });
  const updateHeroAlt = useMutation({
    mutationFn: (payload: { mediaId: number; altText: string }) =>
      api.put(`/admin/media/${payload.mediaId}`, { alt_text: payload.altText }),
    onError: () => {
      setNoticeTone('error');
      setNotice('Impossible d’enregistrer le texte alternatif de l’image.');
    },
  });
  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    markDirty();
  };
  const onTitle = (title: string) => {
    setForm((current) => ({
      ...current,
      title,
      slug: slugEdited ? current.slug : slugify(title),
      meta_title: current.meta_title || title,
    }));
    markDirty();
  };
  const onExcerpt = (excerpt: string) => {
    setForm((current) => ({
      ...current,
      excerpt,
      meta_description: current.meta_description || excerpt.slice(0, 160),
    }));
    markDirty();
  };
  const requestSave = (status: Status) => {
    if (status === 'published' || status === 'scheduled') {
      const missing: string[] = [];
      if (!form.title.trim()) missing.push('le titre');
      if (!form.body.trim()) missing.push('le contenu');
      if (!form.category_id) missing.push('la rubrique');
      if (!form.author_id) missing.push('l’auteur');
      if (missing.length > 0) {
        setNoticeTone('error');
        setNotice(`Complétez ${missing.join(', ')} avant de publier ou programmer cet article.`);
        return;
      }
    }
    save.mutate(status);
  };
  const saveShortcutRef = useRef<() => void>(() => {});
  saveShortcutRef.current = () => requestSave(existingArticle.data?.status ?? 'draft');
  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveShortcutRef.current();
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, []);
  const heroPreviewUrl = heroMedia
    ? new URL(heroMedia.url, window.location.origin).toString()
    : null;

  const currentCategorySlug = taxonomy.data?.categories.find(
    (category) => String(category.id) === form.category_id,
  )?.slug;
  const previousCategorySlug = existingArticle.data
    ? taxonomy.data?.categories.find((category) => category.id === existingArticle.data!.category_id)
        ?.slug
    : undefined;
  const willRedirect = Boolean(
    articleId !== null &&
      existingArticle.data?.status === 'published' &&
      previousCategorySlug &&
      currentCategorySlug &&
      form.slug &&
      (previousCategorySlug !== currentCategorySlug || existingArticle.data.slug !== form.slug),
  );
  const oldPath =
    existingArticle.data && previousCategorySlug
      ? `/${previousCategorySlug}/${existingArticle.data.slug}`
      : '';
  const newPath = currentCategorySlug ? `/${currentCategorySlug}/${form.slug}` : '';
  const previewUrl =
    effectiveArticleId !== null && currentCategorySlug && form.slug
      ? `${window.location.origin}/${currentCategorySlug}/${form.slug}?preview=1`
      : null;

  if (articleId !== null && existingArticle.isLoading) {
    return (
      <div className="mx-auto max-w-6xl p-16 text-center text-slate-500">
        Chargement de l’article…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-orange-700">
            CMS / {articleId ? 'Modifier un article' : 'Nouvel article'}
          </p>
          <h2 className="mt-1 text-3xl font-bold">
            {articleId ? 'Modifier l’article' : 'Créer un article'}
          </h2>
        </div>
        <Link
          className="rounded border border-slate-300 px-4 py-2 font-semibold"
          to="/articles"
          onClick={(event) => {
            if (isDirty && !window.confirm('Des modifications non enregistrées seront perdues. Continuer ?')) {
              event.preventDefault();
            }
          }}
        >
          Retour aux articles
        </Link>
      </header>
      {notice && <Toast message={notice} tone={noticeTone} onClose={() => setNotice('')} />}
      {willRedirect && (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            Enregistrer ce changement créera automatiquement une redirection 301 depuis{' '}
            <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
              {oldPath}
            </code>
            vers
            <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">
              {newPath}
            </code>
            .
          </p>
        </div>
      )}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-6">
          <details open className="rounded-lg border border-slate-200 bg-white p-6">
            <summary className="cursor-pointer font-semibold">Titre & aperçu</summary>
            <div className="mt-5 grid grid-cols-1 gap-4">
              <label className="min-w-0 text-sm font-semibold">
                Titre
                <input
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                  value={form.title}
                  onChange={(event) => onTitle(event.target.value)}
                  placeholder="Un titre précis et utile"
                />
              </label>
              <label className="min-w-0 text-sm font-semibold">
                Slug
                <input
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                  value={form.slug}
                  onChange={(event) => {
                    setSlugEdited(true);
                    update('slug', slugify(event.target.value));
                  }}
                  placeholder="url-de-l-article"
                />
              </label>
              <label className="min-w-0 text-sm font-semibold">
                Chapô
                <textarea
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                  rows={3}
                  value={form.excerpt}
                  onChange={(event) => onExcerpt(event.target.value)}
                />
              </label>
            </div>
          </details>
          {!contentExpanded && (
            <details open className="rounded-lg border border-slate-200 bg-white p-6">
              <summary className="cursor-pointer font-semibold">Contenu</summary>
              <div className="mt-4">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={expandContent}
                    className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    title="Agrandir pour utiliser tout l’espace disponible"
                  >
                    <Maximize2 size={14} /> Agrandir
                  </button>
                </div>
                <EditorToolbar
                  editor={editor}
                  onInsertImage={() => setBodyImagePickerOpen(true)}
                  onInsertArticleEmbed={() => setArticlePickerOpen(true)}
                />
                <EditorContent editor={editor} />
              </div>
            </details>
          )}
          <details className="rounded-lg border border-slate-200 bg-white p-6">
            <summary className="cursor-pointer font-semibold">SEO & distribution</summary>
            <div className="mt-5 grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="min-w-0 text-sm font-semibold">
                  Mot-clé principal
                  <input
                    className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                    placeholder="ex. campus france cameroun"
                    value={form.primary_keyword}
                    onChange={(event) => update('primary_keyword', event.target.value)}
                  />
                </label>
                <label className="min-w-0 text-sm font-semibold">
                  Mots-clés secondaires
                  <input
                    className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                    placeholder="séparés par des virgules"
                    value={form.secondary_keywords}
                    onChange={(event) => update('secondary_keywords', event.target.value)}
                  />
                </label>
              </div>
              {form.primary_keyword.trim() !== '' && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    Présence du mot-clé principal
                  </p>
                  <ul className="mt-2 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                    <KeywordCheck
                      ok={containsKeyword(form.title, form.primary_keyword)}
                      label="Dans le titre"
                    />
                    <KeywordCheck
                      ok={containsKeyword(form.meta_title || form.title, form.primary_keyword)}
                      label="Dans le meta title"
                    />
                    <KeywordCheck
                      ok={containsKeyword(form.meta_description, form.primary_keyword)}
                      label="Dans la meta description"
                    />
                    <KeywordCheck
                      ok={containsKeyword(form.slug, form.primary_keyword)}
                      label="Dans l’URL"
                    />
                    <KeywordCheck
                      ok={containsKeyword(form.excerpt, form.primary_keyword)}
                      label="Dans le chapô"
                    />
                    <KeywordCheck
                      ok={containsKeyword(form.body, form.primary_keyword)}
                      label="Dans le contenu"
                    />
                  </ul>
                </div>
              )}
              <label className="text-sm font-semibold">
                Meta title
                <input
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                  value={form.meta_title}
                  onChange={(event) => update('meta_title', event.target.value)}
                />
                <span
                  className={`mt-1 block text-xs ${(form.meta_title || form.title).length > 60 ? 'text-amber-600' : 'text-slate-400'}`}
                >
                  {(form.meta_title || form.title).length}/60 caractères recommandés
                </span>
              </label>
              <label className="text-sm font-semibold">
                Meta description
                <textarea
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                  rows={3}
                  maxLength={320}
                  value={form.meta_description}
                  onChange={(event) => update('meta_description', event.target.value)}
                />
                <span
                  className={`mt-1 block text-xs ${form.meta_description.length > 155 ? 'text-amber-600' : 'text-slate-400'}`}
                >
                  {form.meta_description.length}/320 (155 recommandés)
                </span>
              </label>
              <label className="text-sm font-semibold">
                Indexation
                <select
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                  value={form.robots}
                  onChange={(event) => update('robots', event.target.value)}
                >
                  <option value="index,follow">Indexer et suivre les liens (par défaut)</option>
                  <option value="noindex,follow">Ne pas indexer, mais suivre les liens</option>
                  <option value="noindex,nofollow">Ne pas indexer ni suivre les liens</option>
                </select>
                <span className="mt-1 block text-xs text-slate-400">
                  Contrôle la balise robots envoyée aux moteurs de recherche pour cet article.
                </span>
              </label>
              <label className="text-sm font-semibold">
                Canonical
                <input
                  className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                  type="url"
                  value={form.canonical_url}
                  onChange={(event) => update('canonical_url', event.target.value)}
                />
              </label>
              <div>
                <p className="text-sm font-semibold">Aperçu Google</p>
                <div className="mt-2 flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-600">
                      {window.location.origin}/{currentCategorySlug ?? 'rubrique'}/
                      {form.slug || 'slug-article'}
                    </p>
                    <p className="mt-1 truncate text-lg text-[#1a0dab]">
                      {(form.meta_title || form.title || 'Titre de l’article').slice(0, 70)}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                      {(form.meta_description || form.excerpt || 'Description de l’article…').slice(
                        0,
                        160,
                      )}
                    </p>
                  </div>
                  {heroPreviewUrl ? (
                    <img
                      src={heroPreviewUrl}
                      alt=""
                      className="size-20 shrink-0 rounded-lg object-cover"
                      width={80}
                      height={80}
                    />
                  ) : (
                    <div className="grid size-20 shrink-0 place-items-center rounded-lg bg-slate-200 text-[10px] font-semibold text-slate-400">
                      Image
                    </div>
                  )}
                </div>
              </div>
            </div>
          </details>
        </section>
        <aside className="space-y-5 lg:sticky lg:top-6 lg:h-fit lg:self-start">
          <details open className="rounded-lg border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer font-bold">Image de couverture</summary>
            <p className="mt-2 text-sm text-slate-500">
              Choisissez une image existante ou téléversez-en une nouvelle. Facultatif — une image
              par défaut est utilisée si vous n’en choisissez pas.
            </p>
            {heroMedia && heroPreviewUrl ? (
              <img
                className="mt-4 aspect-video w-full rounded object-cover"
                src={heroPreviewUrl}
                width={heroMedia.width ?? 640}
                height={heroMedia.height ?? 360}
                alt={heroAlt || 'Aperçu de l’image de couverture'}
                onError={() => {
                  setNoticeTone('error');
                  setNotice(
                    'L’aperçu de cette image est indisponible. Sélectionnez une autre image.',
                  );
                }}
              />
            ) : (
              <div className="mt-4 grid aspect-video place-items-center rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                Aucune image de couverture sélectionnée.
              </div>
            )}
            <label className="mt-4 block text-sm font-semibold">
              Texte alternatif
              <input
                className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                value={heroAlt}
                onChange={(event) => {
                  setHeroAlt(event.target.value);
                  markDirty();
                }}
                onBlur={(event) => {
                  if (heroMedia) {
                    updateHeroAlt.mutate({ mediaId: heroMedia.id, altText: event.target.value });
                  }
                }}
                placeholder="Décrivez l’image"
              />
            </label>
            <button
              type="button"
              className="mt-4 w-full rounded border border-dashed border-slate-400 p-3 text-center text-sm font-semibold hover:bg-slate-50"
              onClick={() => setMediaPickerOpen(true)}
            >
              {heroMedia ? 'Remplacer l’image' : 'Ajouter une image'}
            </button>
          </details>
          <details open className="rounded-lg border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer font-bold">Rubrique & tags</summary>
            <p className="mt-2 text-sm text-slate-500">
              Classez l’article. Tapez un nom inexistant pour le créer à la volée, sans quitter
              cette page.
            </p>
            <label className="mt-4 block text-sm font-semibold">
              Rubrique <span className="text-orange-700">*</span>
              <CategoryCombobox
                categories={taxonomy.data?.categories ?? []}
                value={form.category_id}
                onChange={(id) => update('category_id', id)}
              />
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Tags
              <TagsInput
                tags={taxonomy.data?.tags ?? []}
                selectedIds={tagIds}
                onChange={(ids) => {
                  setTagIds(ids);
                  markDirty();
                }}
              />
            </label>
          </details>
          <details open className="rounded-lg border border-slate-200 bg-white p-5">
            <summary className="cursor-pointer font-bold">Publication</summary>
            <label className="mt-4 block text-sm font-semibold">
              Auteur
              <select
                className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                value={form.author_id}
                onChange={(event) => update('author_id', event.target.value)}
              >
                <option value="">Choisir</option>
                {taxonomy.data?.authors.map((author) => (
                  <option key={author.id} value={author.id}>
                    {author.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-4 block text-sm font-semibold">
              Programmer
              <input
                className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
                type="datetime-local"
                value={form.published_at}
                onChange={(event) => update('published_at', event.target.value)}
              />
            </label>
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={isSponsored}
                onChange={(event) => {
                  setIsSponsored(event.target.checked);
                  markDirty();
                }}
              />
              Article sponsorisé
            </label>
            {isSponsored && (
              <p className="mt-1.5 text-xs text-slate-500">
                Un badge « Sponsorisé » sera affiché publiquement à côté de la rubrique.
              </p>
            )}
          </details>
        </aside>
      </div>
      <div className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
          {save.isPending ? (
            <>
              <Loader2 className="animate-spin" size={16} /> Enregistrement…
            </>
          ) : isDirty ? (
            <>
              <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" /> Modifications
              non enregistrées
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" /> Tout est
              enregistré
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!previewUrl}
            title={
              previewUrl ? undefined : 'Enregistrez d’abord l’article pour activer l’aperçu.'
            }
            onClick={() => previewUrl && window.open(previewUrl, '_blank', 'noopener')}
            className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eye size={16} /> Prévisualiser
          </button>
          <button
            disabled={save.isPending}
            onClick={() => requestSave('draft')}
            className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Brouillon
          </button>
          <button
            disabled={save.isPending}
            onClick={() => requestSave('review')}
            className="rounded bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-200"
          >
            Relecture
          </button>
          <button
            disabled={save.isPending}
            onClick={() => requestSave('scheduled')}
            className="rounded bg-blue-100 px-3 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-200"
          >
            Programmer
          </button>
          <button
            disabled={save.isPending}
            onClick={() => requestSave('published')}
            className="rounded bg-orange-700 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-800"
          >
            Publier
          </button>
        </div>
      </div>
      {contentExpanded && (
        <div
          className={`fixed z-40 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl transition-all duration-[250ms] ease-out ${
            contentVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
          style={{
            top: 'var(--admin-header-height, 2.75rem)',
            left: 'var(--admin-sidebar-width, 250px)',
            right: 0,
            bottom: 0,
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Édition du contenu en plein écran"
        >
          <div className="flex items-center justify-between border-b border-slate-200 p-6 pb-4">
            <p className="text-sm font-semibold">Contenu</p>
            <button
              type="button"
              onClick={collapseContent}
              className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title="Réduire pour retrouver la barre latérale"
            >
              <Minimize2 size={14} /> Réduire
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
            <EditorToolbar
              editor={editor}
              onInsertImage={() => setBodyImagePickerOpen(true)}
              onInsertArticleEmbed={() => setArticlePickerOpen(true)}
            />
            <div className="editor-fullscreen min-h-0 flex-1 overflow-y-auto">
              <EditorContent editor={editor} className="h-full" />
            </div>
          </div>
        </div>
      )}
      {linkClickAnchor && (
        <LinkPopover
          editor={editor}
          anchorElement={linkClickAnchor}
          onClose={() => setLinkClickAnchor(null)}
        />
      )}
      {mediaPickerOpen && (
        <MediaPicker
          selectedId={heroMedia?.id}
          onClose={() => setMediaPickerOpen(false)}
          onSelect={(media) => {
            setHeroMedia(media);
            setHeroAlt(media.alt_text ?? '');
            setMediaPickerOpen(false);
            markDirty();
            setNoticeTone('success');
            setNotice('Image de couverture sélectionnée.');
          }}
        />
      )}
      {bodyImagePickerOpen && (
        <MediaPicker
          onClose={() => setBodyImagePickerOpen(false)}
          onSelect={(media) => {
            editor?.chain().focus().setImage({ src: media.url, alt: media.alt_text ?? '' }).run();
            setBodyImagePickerOpen(false);
          }}
        />
      )}
      {articlePickerOpen && (
        <ArticlePicker
          excludeId={effectiveArticleId}
          onClose={() => setArticlePickerOpen(false)}
          onSelect={(article: ArticleSummary) => {
            editor
              ?.chain()
              .focus()
              .insertArticleEmbed({
                articleId: article.id,
                title: article.title,
                categorySlug: article.category_slug,
                slug: article.slug,
              })
              .run();
            setArticlePickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
function statusLabel(status: Status) {
  return (
    {
      draft: 'brouillon',
      review: 'relecture',
      scheduled: 'programmé',
      published: 'publié',
      archived: 'archivé',
    } as Record<Status, string>
  )[status];
}
