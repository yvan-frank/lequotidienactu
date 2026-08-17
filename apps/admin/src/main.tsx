import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Link,
  Outlet,
  RootRoute,
  Route,
  RouterProvider,
  createRouter,
  useParams,
} from '@tanstack/react-router';
import {
  Archive,
  ExternalLink,
  Eye,
  FilePlus2,
  FileText,
  LayoutDashboard,
  List,
  LogOut,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Route as RouteIcon,
  Send,
  Settings,
  Table2,
  Tags,
  Trash2,
  Users,
} from 'lucide-react';
import { ArticleEditor } from './ArticleEditor';
import { Ads } from './Ads';
import { Taxonomy } from './Taxonomy';
import { Redirects } from './Redirects';
import { Comments } from './Comments';
import { Settings as SettingsPage } from './Settings';
import { api, setCsrfToken } from './api';
import { Toast } from './components/Toast';
import './styles.css';

type AdminUser = { id: number; name: string; email: string; role: 'admin' | 'editor' | 'author' };
type AdminSession = { authenticated: boolean; user: AdminUser | null; csrf_token: string | null };

const Login = () => {
  const [email, setEmail] = React.useState('admin@lequotidienactu.local');
  const [password, setPassword] = React.useState('');
  const login = useMutation({
    mutationFn: () => api.post<{ user: AdminUser; csrf_token: string }>('/admin/login', { email, password }),
    onSuccess: (response) => {
      setCsrfToken(response.data.csrf_token);
      window.location.assign('/u/admin');
    },
  });

  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 p-6 text-slate-900">
      <form
        className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate();
        }}
      >
        <p className="text-sm font-semibold text-orange-700">Le Quotidien Actu</p>
        <h1 className="mt-2 text-3xl font-bold">Connexion à l’administration</h1>
        <label className="mt-7 block text-sm font-semibold">
          E-mail
          <input
            className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="mt-4 block text-sm font-semibold">
          Mot de passe
          <input
            className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />
        </label>
        {login.isError && (
          <Toast
            message="Identifiants invalides ou accès non autorisé."
            onClose={() => login.reset()}
          />
        )}
        <button
          disabled={login.isPending}
          className="mt-6 w-full rounded bg-orange-700 px-4 py-3 font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
        >
          Se connecter
        </button>
      </form>
    </main>
  );
};

const SIDEBAR_STORAGE_KEY = 'lqa-admin-sidebar-collapsed';
const navItems = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { to: '/articles', label: 'Articles', icon: FileText, exact: false },
  { to: '/taxonomy', label: 'Rubriques & tags', icon: Tags, exact: false },
  { to: '/redirects', label: 'Redirections', icon: RouteIcon, exact: false },
  { to: '/comments', label: 'Commentaires', icon: MessageSquare, exact: false },
  { to: '/ads', label: 'Publicité', icon: Megaphone, exact: false },
  { to: '/users', label: 'Utilisateurs', icon: Users, exact: false },
  { to: '/settings', label: 'Paramètres', icon: Settings, exact: false },
] as const;

const AdminGate = () => {
  const session = useQuery({
    queryKey: ['admin-session'],
    queryFn: async () => {
      const response = await api.get<AdminSession>('/admin/session');
      setCsrfToken(response.data.csrf_token);
      return response.data;
    },
    retry: false,
  });
  const logout = useMutation({
    mutationFn: () => api.post('/admin/logout'),
    onSuccess: () => {
      setCsrfToken(null);
      window.location.assign('/u/admin');
    },
  });
  const [collapsed, setCollapsed] = React.useState(
    () => window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1',
  );
  React.useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
    document.documentElement.style.setProperty(
      '--admin-sidebar-width',
      collapsed ? '76px' : '250px',
    );
  }, [collapsed]);

  if (session.isLoading)
    return (
      <main className="grid min-h-screen place-items-center bg-stone-100 font-semibold text-slate-600">
        Chargement de l’administration…
      </main>
    );
  if (!session.data?.authenticated) return <Login />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside
        className={`hidden md:fixed md:inset-y-0 md:left-0 md:flex md:flex-col md:overflow-y-auto md:bg-slate-900 md:py-6 md:text-white md:transition-[width] md:duration-200 ${collapsed ? 'md:w-[76px] md:px-3' : 'md:w-[250px] md:px-6'}`}
      >
        <div className={`mb-8 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && <h1 className="text-lg font-bold">Le Quotidien Actu</h1>}
          <button
            onClick={() => setCollapsed((current) => !current)}
            className="rounded p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label={collapsed ? 'Déplier le menu' : 'Replier le menu'}
            title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="grid gap-2">
          {navItems.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: Boolean(exact) }}
              activeProps={{ className: 'bg-slate-800 text-white' }}
              className={`flex items-center gap-3 rounded px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && label}
            </Link>
          ))}
        </nav>
        <div
          className={`mt-10 border-t border-slate-700 pt-5 text-sm text-slate-300 ${collapsed ? 'flex flex-col items-center' : ''}`}
        >
          {!collapsed && (
            <>
              <p className="font-semibold text-white">{session.data.user?.name}</p>
              <p className="mt-1 capitalize">{session.data.user?.role}</p>
            </>
          )}
          <button
            onClick={() => logout.mutate()}
            title="Se déconnecter"
            className={`mt-4 flex items-center gap-2 text-sm font-semibold text-orange-300 hover:text-orange-200 ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={16} /> {!collapsed && 'Se déconnecter'}
          </button>
        </div>
      </aside>
      <div className={`min-h-screen md:transition-[margin] md:duration-200 ${collapsed ? 'md:ml-[76px]' : 'md:ml-[250px]'}`}>
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-3 backdrop-blur md:px-12">
          <div>
            <p className="text-xs font-bold tracking-widest text-orange-700 uppercase">
              Administration
            </p>
            <p className="mt-1 text-sm text-slate-500">Gérez l’actualité en temps réel.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              className="hidden rounded px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 sm:inline-flex sm:items-center sm:gap-2"
              href="/"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} /> Voir le site
            </a>
            <Link
              className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-800"
              to="/articles/new"
            >
              <FilePlus2 size={17} /> Nouvel article
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl p-6 md:p-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
const Root = () => <AdminGate />;
const Dashboard = () => (
  <>
    <h2 className="text-3xl font-bold">Tableau de bord</h2>
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <b className="block text-3xl">0</b>
        <span className="text-slate-500">Articles publiés</span>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <b className="block text-3xl">0</b>
        <span className="text-slate-500">Lecteurs aujourd’hui</span>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <b className="block text-3xl">0</b>
        <span className="text-slate-500">Abonnés newsletter</span>
      </section>
    </div>
    <p className="mt-6 text-slate-600">
      Connectez cette vue aux endpoints `/api/admin/analytics` et `/api/admin/articles`.
    </p>
  </>
);
const Resource = ({ name }: { name: string }) => (
  <>
    <header className="flex items-center justify-between">
      <h2 className="text-3xl font-bold">{name}</h2>
      <button className="rounded bg-orange-700 px-4 py-2 font-semibold text-white hover:bg-orange-800">
        Créer
      </button>
    </header>
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      Liste à relier à l’API admin.
    </section>
  </>
);
type Article = {
  id: number;
  title: string;
  slug: string;
  status: string;
  category_name: string | null;
  category_slug: string | null;
  author_name: string | null;
  created_at: string;
  updated_at: string;
  is_sponsored: number | boolean;
};
const formatDateTime = (value: string) =>
  new Date(value.replace(' ', 'T')).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
const articleFilters = [
  ['all', 'Tous'],
  ['draft', 'Brouillons'],
  ['review', 'En relecture'],
  ['scheduled', 'Programmés'],
  ['published', 'Publiés'],
  ['archived', 'Archivés'],
] as const;
const statusLabels: Record<string, string> = {
  draft: 'Brouillon',
  review: 'Relecture',
  scheduled: 'Programmé',
  published: 'Publié',
  archived: 'Archivé',
};
const statusClasses: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  review: 'bg-amber-100 text-amber-900',
  scheduled: 'bg-blue-100 text-blue-900',
  published: 'bg-emerald-100 text-emerald-900',
  archived: 'bg-stone-200 text-stone-700',
};
type ActionMenu = { article: Article; x: number; y: number };
const ArticleActions = ({
  article,
  onOpen,
}: {
  article: Article;
  onOpen: (article: Article, rect: DOMRect) => void;
}) => (
  <button
    onClick={(event) => onOpen(article, event.currentTarget.getBoundingClientRect())}
    className="flex size-9 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
    aria-label={`Actions pour ${article.title}`}
  >
    <MoreHorizontal size={18} />
  </button>
);
const ActionsPopover = ({
  menu,
  pending,
  onClose,
  onTransition,
  onDelete,
  menuRef,
}: {
  menu: ActionMenu;
  pending: boolean;
  onClose: () => void;
  onTransition: (status: 'published' | 'archived') => void;
  onDelete: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
}) => {
  React.useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const margin = 8;
    const rect = el.getBoundingClientRect();
    let left = rect.left;
    let top = rect.top;
    if (rect.right > window.innerWidth - margin) {
      left -= rect.right - (window.innerWidth - margin);
    }
    if (left < margin) {
      left = margin;
    }
    if (rect.bottom > window.innerHeight - margin) {
      top -= rect.bottom - (window.innerHeight - margin);
    }
    if (top < margin) {
      top = margin;
    }
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [menu, menuRef]);

  return (
  <div
    ref={menuRef}
    className="fixed z-50 grid w-52 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
    style={{ left: menu.x, top: menu.y }}
  >
    <p className="truncate px-3 py-2 text-xs font-bold tracking-wide text-slate-400 uppercase">
      Actions
    </p>
    <Link
      onClick={onClose}
      className="flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold hover:bg-slate-100"
      to="/articles/$articleId"
      params={{ articleId: String(menu.article.id) }}
    >
      <Pencil size={16} /> Modifier
    </Link>
    {menu.article.status === 'published' && (
      <a
        onClick={onClose}
        className="flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold hover:bg-slate-100"
        href={`/${menu.article.category_slug}/${menu.article.slug}`}
        target="_blank"
        rel="noreferrer"
      >
        <Eye size={16} /> Voir sur le site
      </a>
    )}
    {menu.article.status !== 'published' && (
      <button
        disabled={pending}
        onClick={() => onTransition('published')}
        className="flex items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-50"
      >
        <Send size={16} /> Publier maintenant
      </button>
    )}
    {menu.article.status !== 'archived' && (
      <button
        disabled={pending}
        onClick={() => onTransition('archived')}
        className="flex items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold hover:bg-stone-100 disabled:opacity-50"
      >
        <Archive size={16} /> Archiver
      </button>
    )}
    <button
      onClick={onDelete}
      className="flex items-center gap-2 rounded px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
    >
      <Trash2 size={16} /> Supprimer
    </button>
  </div>
  );
};
const Articles = () => {
  const [filter, setFilter] = React.useState<(typeof articleFilters)[number][0]>('all');
  const [view, setView] = React.useState<'compact' | 'table'>('table');
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(
    null,
  );
  const [activeMenu, setActiveMenu] = React.useState<ActionMenu | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Article | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const articles = useQuery({
    queryKey: ['admin-articles', filter],
    queryFn: async () =>
      (await api.get<{ data: Article[] }>('/admin/articles', { params: { status: filter } })).data
        .data,
  });
  const transition = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'published' | 'archived' }) =>
      api.post(`/admin/articles/${id}/transition`, { status }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
      setToast({
        tone: 'success',
        message: variables.status === 'published' ? 'Article publié.' : 'Article archivé.',
      });
    },
    onError: (error: any) =>
      setToast({
        tone: 'error',
        message: error.response?.data?.message ?? 'Impossible de mettre à jour cet article.',
      }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/articles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
      setDeleteTarget(null);
      setToast({ tone: 'success', message: 'Article supprimé définitivement.' });
    },
    onError: (error: any) =>
      setToast({
        tone: 'error',
        message: error.response?.data?.message ?? 'Impossible de supprimer cet article.',
      }),
  });
  React.useEffect(() => {
    if (!activeMenu) return;
    const closeOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setActiveMenu(null);
    };
    const closeEscape = (event: KeyboardEvent) => event.key === 'Escape' && setActiveMenu(null);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [activeMenu]);
  const openActions = (article: Article, rect: DOMRect) => {
    setActiveMenu((current) =>
      current?.article.id === article.id
        ? null
        : { article, x: rect.right - 208, y: rect.bottom + 8 },
    );
  };
  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-orange-700">CMS</p>
          <h2 className="text-3xl font-bold">Articles</h2>
          <p className="mt-1 text-sm text-slate-500">
            {articles.data?.length ?? 0} élément(s) dans cette vue
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 font-semibold text-white hover:bg-orange-800"
          to="/articles/new"
        >
          <FilePlus2 size={17} /> Nouvel article
        </Link>
      </header>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex max-w-full gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Filtrer les articles par statut"
        >
          {articleFilters.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold transition ${filter === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            title="Vue tableau"
            aria-label="Vue tableau"
            onClick={() => setView('table')}
            className={`rounded p-2 ${view === 'table' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Table2 size={18} />
          </button>
          <button
            title="Vue compacte"
            aria-label="Vue compacte"
            onClick={() => setView('compact')}
            className={`rounded p-2 ${view === 'compact' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <List size={18} />
          </button>
        </div>
      </div>
      {articles.isLoading && (
        <p className="mt-6 rounded-xl bg-white p-6 text-slate-500">Chargement…</p>
      )}
      {articles.isError && (
        <p className="mt-6 rounded-xl bg-white p-6 text-red-700">
          Impossible de charger les articles.
        </p>
      )}
      {articles.data?.length === 0 && (
        <p className="mt-6 rounded-xl bg-white p-6 text-slate-500">Aucun article pour ce filtre.</p>
      )}
      {articles.data &&
        articles.data.length > 0 &&
        (view === 'table' ? (
          <section className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-[920px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs tracking-wider text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-4">Article</th>
                  <th className="px-5 py-4">Rubrique</th>
                  <th className="px-5 py-4">Statut</th>
                  <th className="px-5 py-4">Créé le</th>
                  <th className="px-5 py-4">Mis à jour</th>
                  <th className="px-5 py-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {articles.data.map((article) => (
                  <tr
                    className="group border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    key={article.id}
                  >
                    <td className="max-w-md px-5 py-4">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{article.title}</p>
                        {Boolean(article.is_sponsored) && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-800 uppercase">
                            Sponsorisé
                          </span>
                        )}
                        <Link
                          to="/articles/$articleId"
                          params={{ articleId: String(article.id) }}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-400 opacity-0 transition hover:bg-orange-50 hover:text-orange-700 group-hover:opacity-100"
                        >
                          <Pencil size={12} /> Modifier
                        </Link>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        Par {article.author_name ?? 'auteur non défini'}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {article.category_name ?? (
                        <span className="text-amber-600">Sans rubrique</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[article.status] ?? 'bg-slate-100 text-slate-700'}`}
                      >
                        {statusLabels[article.status] ?? article.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatDateTime(article.created_at)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatDateTime(article.updated_at)}
                    </td>
                    <td className="px-5 py-4">
                      <ArticleActions article={article} onOpen={openActions} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : (
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {articles.data.map((article) => (
              <article
                className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                key={article.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[article.status] ?? 'bg-slate-100 text-slate-700'}`}
                  >
                    {statusLabels[article.status] ?? article.status}
                  </span>
                  <div className="flex items-center gap-1">
                    <Link
                      to="/articles/$articleId"
                      params={{ articleId: String(article.id) }}
                      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold text-slate-400 opacity-0 transition hover:bg-orange-50 hover:text-orange-700 group-hover:opacity-100"
                    >
                      <Pencil size={12} /> Modifier
                    </Link>
                    <ArticleActions article={article} onOpen={openActions} />
                  </div>
                </div>
                <h3 className="mt-5 text-lg leading-snug font-bold">{article.title}</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {article.category_name ?? 'Sans rubrique'} · {article.author_name ?? 'Auteur non défini'}
                </p>
                <p className="mt-5 border-t border-slate-100 pt-4 text-xs font-medium text-slate-500">
                  Créé le {formatDateTime(article.created_at)}
                  <br />
                  Mis à jour le {formatDateTime(article.updated_at)}
                </p>
              </article>
            ))}
          </section>
        ))}
      {activeMenu && (
        <ActionsPopover
          menu={activeMenu}
          menuRef={menuRef}
          pending={transition.isPending}
          onClose={() => setActiveMenu(null)}
          onTransition={(status) => {
            const id = activeMenu.article.id;
            setActiveMenu(null);
            transition.mutate({ id, status });
          }}
          onDelete={() => {
            setDeleteTarget(activeMenu.article);
            setActiveMenu(null);
          }}
        />
      )}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-bold tracking-widest text-red-700 uppercase">
              Suppression définitive
            </p>
            <h3 className="mt-2 text-xl font-extrabold">Supprimer cet article ?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              « {deleteTarget.title} » sera retiré du site et ne pourra pas être restauré.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={remove.isPending}
                onClick={() => setDeleteTarget(null)}
                className="rounded px-4 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                disabled={remove.isPending}
                onClick={() => remove.mutate(deleteTarget.id)}
                className="rounded bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {remove.isPending ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </section>
        </div>
      )}
      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
};
const rootRoute = new RootRoute({ component: Root });
const indexRoute = new Route({ getParentRoute: () => rootRoute, path: '/', component: Dashboard });
const articlesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/articles',
  component: Articles,
});
const articleNewRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/articles/new',
  component: ArticleEditor,
});
const EditArticle = () => {
  const { articleId } = useParams({ from: '/articles/$articleId' });
  return <ArticleEditor articleId={Number(articleId)} />;
};
const articleEditRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/articles/$articleId',
  component: EditArticle,
});
const loginRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: () => null,
});
const taxonomyRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/taxonomy',
  component: Taxonomy,
});
const redirectsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/redirects',
  component: Redirects,
});
const commentsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/comments',
  component: Comments,
});
const adsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/ads',
  component: Ads,
});
const usersRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/users',
  component: () => <Resource name="Utilisateurs" />,
});
const settingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});
const router = createRouter({
  basepath: '/u/admin',
  routeTree: rootRoute.addChildren([
    indexRoute,
    articlesRoute,
    articleNewRoute,
    articleEditRoute,
    loginRoute,
    taxonomyRoute,
    redirectsRoute,
    commentsRoute,
    adsRoute,
    usersRoute,
    settingsRoute,
  ]),
});
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
