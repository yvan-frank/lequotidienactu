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
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  ExternalLink,
  Eye,
  FilePlus2,
  Files as FilesIcon,
  FileText,
  HardDrive,
  Image as ImageIcon,
  LayoutDashboard,
  List,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Route as RouteIcon,
  ScrollText,
  Search,
  Send,
  Settings,
  SlidersHorizontal,
  Star,
  Table2,
  Tags,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { ArticleEditor } from './ArticleEditor';
import { Pages } from './Pages';
import { PageEditor } from './PageEditor';
import { Media } from './Media';
import { Ads } from './Ads';
import { Newsletter } from './Newsletter';
import { Taxonomy } from './Taxonomy';
import { Theme } from './Theme';
import { Users as UsersPage } from './Users';
import { Redirects } from './Redirects';
import { DrawRounds } from './DrawRounds';
import { Comments } from './Comments';
import { Listings } from './Listings';
import { Settings as SettingsPage } from './Settings';
import { ActivityLog } from './ActivityLog';
import { Backups } from './Backups';
import { api, setCsrfToken } from './api';
import { Toast } from './components/Toast';
import './styles.css';

let scrollIdleTimeout: number | undefined;
document.addEventListener(
  'scroll',
  () => {
    document.documentElement.classList.add('is-scrolling');
    window.clearTimeout(scrollIdleTimeout);
    scrollIdleTimeout = window.setTimeout(() => {
      document.documentElement.classList.remove('is-scrolling');
    }, 600);
  },
  { capture: true, passive: true },
);

type AdminUser = { id: number; name: string; email: string; role: 'admin' | 'editor' | 'author' };
type AdminSession = { authenticated: boolean; user: AdminUser | null; csrf_token: string | null };

const ForgotPassword = ({ onBack }: { onBack: () => void }) => {
  const [email, setEmail] = React.useState('');
  const forgot = useMutation({
    mutationFn: () => api.post<{ message: string }>('/admin/password/forgot', { email }),
  });

  if (forgot.isSuccess) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-100 p-6 text-slate-900">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-orange-700">Le Quotidien Actu</p>
          <h1 className="mt-2 text-2xl font-bold">Vérifiez votre boîte mail</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {forgot.data.data.message}
          </p>
          <button
            onClick={onBack}
            className="mt-6 w-full rounded bg-orange-700 px-4 py-3 font-semibold text-white hover:bg-orange-800"
          >
            Retour à la connexion
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 p-6 text-slate-900">
      <form
        className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          forgot.mutate();
        }}
      >
        <p className="text-sm font-semibold text-orange-700">Le Quotidien Actu</p>
        <h1 className="mt-2 text-2xl font-bold">Mot de passe oublié</h1>
        <p className="mt-3 text-sm text-slate-600">
          Indiquez votre adresse e-mail, nous vous enverrons un lien de réinitialisation.
        </p>
        <label className="mt-5 block text-sm font-semibold">
          E-mail
          <input
            required
            className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus
          />
        </label>
        <button
          disabled={forgot.isPending}
          className="mt-6 w-full rounded bg-orange-700 px-4 py-3 font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
        >
          {forgot.isPending ? 'Envoi…' : 'Envoyer le lien'}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 w-full rounded px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
        >
          Retour à la connexion
        </button>
      </form>
    </main>
  );
};

const ResetPassword = ({ token }: { token: string }) => {
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const mismatch = confirm.length > 0 && password !== confirm;
  const reset = useMutation({
    mutationFn: () => api.post<{ message: string }>('/admin/password/reset', { token, password }),
  });

  if (reset.isSuccess) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-100 p-6 text-slate-900">
        <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-orange-700">Le Quotidien Actu</p>
          <h1 className="mt-2 text-2xl font-bold">Mot de passe mis à jour</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{reset.data.data.message}</p>
          <a
            href="/u/admin"
            className="mt-6 block w-full rounded bg-orange-700 px-4 py-3 text-center font-semibold text-white hover:bg-orange-800"
          >
            Se connecter
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-stone-100 p-6 text-slate-900">
      <form
        className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (!mismatch) reset.mutate();
        }}
      >
        <p className="text-sm font-semibold text-orange-700">Le Quotidien Actu</p>
        <h1 className="mt-2 text-2xl font-bold">Choisir un nouveau mot de passe</h1>
        <label className="mt-5 block text-sm font-semibold">
          Nouveau mot de passe
          <input
            required
            minLength={8}
            className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />
          <span className="mt-1 block text-xs text-slate-400">8 caractères minimum</span>
        </label>
        <label className="mt-4 block text-sm font-semibold">
          Confirmer le mot de passe
          <input
            required
            className="mt-2 w-full rounded border border-slate-300 px-3 py-2"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          {mismatch && (
            <span className="mt-1 block text-xs text-red-600">Les mots de passe ne correspondent pas.</span>
          )}
        </label>
        {reset.isError && (
          <Toast
            message={(reset.error as any)?.response?.data?.message ?? 'Impossible de réinitialiser ce mot de passe.'}
            onClose={() => reset.reset()}
          />
        )}
        <button
          disabled={reset.isPending || mismatch || password === ''}
          className="mt-6 w-full rounded bg-orange-700 px-4 py-3 font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
        >
          {reset.isPending ? 'Mise à jour…' : 'Réinitialiser le mot de passe'}
        </button>
      </form>
    </main>
  );
};

const Login = () => {
  const [email, setEmail] = React.useState('admin@lequotidienactu.local');
  const [password, setPassword] = React.useState('');
  const [showForgot, setShowForgot] = React.useState(false);
  const login = useMutation({
    mutationFn: () => api.post<{ user: AdminUser; csrf_token: string }>('/admin/login', { email, password }),
    onSuccess: (response) => {
      setCsrfToken(response.data.csrf_token);
      window.location.assign(window.location.pathname + window.location.search);
    },
  });

  if (showForgot) return <ForgotPassword onBack={() => setShowForgot(false)} />;

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
        <button
          type="button"
          onClick={() => setShowForgot(true)}
          className="mt-2 text-sm font-semibold text-orange-700 hover:text-orange-800"
        >
          Mot de passe oublié ?
        </button>
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
const navGroups = [
  {
    label: null,
    items: [{ to: '/', label: 'Tableau de bord', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'Contenu',
    items: [
      { to: '/articles', label: 'Articles', icon: FileText, exact: false },
      { to: '/pages', label: 'Pages', icon: FilesIcon, exact: false },
      { to: '/media', label: 'Médiathèque', icon: ImageIcon, exact: false },
      { to: '/taxonomy', label: 'Rubriques & tags', icon: Tags, exact: false },
      { to: '/theme', label: 'Thème', icon: Palette, exact: false },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { to: '/comments', label: 'Commentaires', icon: MessageSquare, exact: false },
      { to: '/listings', label: 'Annonces', icon: Briefcase, exact: false },
      { to: '/newsletter', label: 'Newsletter', icon: Mail, exact: false },
      { to: '/ads', label: 'Publicité', icon: Megaphone, exact: false },
    ],
  },
  {
    label: 'Outils',
    items: [
      { to: '/redirects', label: 'Redirections', icon: RouteIcon, exact: false },
      { to: '/tirages', label: 'Tirages Entrée express', icon: CalendarDays, exact: false },
      { to: '/backups', label: 'Sauvegardes', icon: HardDrive, exact: false },
      { to: '/activity', label: 'Journal d’activité', icon: ScrollText, exact: false },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', label: 'Utilisateurs', icon: Users, exact: false },
      { to: '/settings', label: 'Paramètres', icon: Settings, exact: false },
    ],
  },
] as const;

function AccountMenu({ user, onLogout }: { user: AdminUser | null | undefined; onLogout: () => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
      >
        <CircleUserRound size={16} />
        <span className="hidden max-w-24 truncate sm:inline">{user?.name ?? 'Compte'}</span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="mt-0.5 text-xs text-slate-500 capitalize">{user?.role}</p>
          </div>
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm font-semibold text-orange-700 hover:bg-orange-50"
          >
            <LogOut size={14} /> Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

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
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  React.useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
    document.documentElement.style.setProperty(
      '--admin-sidebar-width',
      collapsed ? '76px' : '250px',
    );
  }, [collapsed]);
  React.useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  const resetToken = new URLSearchParams(window.location.search).get('token');
  if (window.location.pathname.startsWith('/u/admin/reset-password') && resetToken) {
    return <ResetPassword token={resetToken} />;
  }

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
        className={`hidden md:fixed md:inset-y-0 md:left-0 md:flex md:flex-col md:bg-slate-900 md:text-white md:transition-[width] md:duration-200 ${collapsed ? 'md:w-[76px]' : 'md:w-[250px]'}`}
      >
        <div
          className={`flex shrink-0 items-center py-6 ${collapsed ? 'justify-center px-3' : 'justify-between px-6'}`}
        >
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
        <nav className={`grid flex-1 content-start gap-2 overflow-y-auto pb-6 ${collapsed ? 'px-3' : 'px-6'}`}>
          {navGroups.map((group) => (
            <React.Fragment key={group.label ?? 'root'}>
              {group.label && !collapsed && (
                <p className="mt-3 px-3 text-[11px] font-bold tracking-widest text-slate-500 uppercase first:mt-0">
                  {group.label}
                </p>
              )}
              {group.items.map(({ to, label, icon: Icon, exact }) => (
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
            </React.Fragment>
          ))}
        </nav>
      </aside>

      <div
        className={`fixed inset-0 z-40 bg-slate-950/50 transition-opacity duration-200 md:hidden ${
          mobileNavOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col overflow-y-auto bg-slate-900 px-6 py-6 text-white transition-transform duration-200 md:hidden ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu d’administration"
      >
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-lg font-bold">Le Quotidien Actu</h1>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="rounded p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label="Fermer le menu"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="grid gap-2">
          {navGroups.map((group) => (
            <React.Fragment key={group.label ?? 'root'}>
              {group.label && (
                <p className="mt-3 px-3 text-[11px] font-bold tracking-widest text-slate-500 uppercase first:mt-0">
                  {group.label}
                </p>
              )}
              {group.items.map(({ to, label, icon: Icon, exact }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: Boolean(exact) }}
                  activeProps={{ className: 'bg-slate-800 text-white' }}
                  className="flex items-center gap-3 rounded px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <Icon size={18} className="shrink-0" />
                  {label}
                </Link>
              ))}
            </React.Fragment>
          ))}
        </nav>
      </aside>

      <div className={`min-h-screen md:transition-[margin] md:duration-200 ${collapsed ? 'md:ml-[76px]' : 'md:ml-[250px]'}`}>
        <header className="sticky top-0 z-30 flex h-11 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="rounded p-1.5 text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu size={16} />
            </button>
            <p className="truncate text-xs font-bold tracking-widest text-orange-700 uppercase">
              Administration
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              className="hidden rounded px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 sm:inline-flex sm:items-center sm:gap-1.5"
              href="/"
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={13} /> Voir le site
            </a>
            <Link
              className="inline-flex items-center gap-1.5 rounded bg-orange-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-orange-800"
              to="/articles/new"
            >
              <FilePlus2 size={13} /> Nouvel article
            </Link>
            <AccountMenu user={session.data.user} onLogout={() => logout.mutate()} />
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
type DashboardStats = {
  published_articles: number;
  active_subscribers: number;
  pending_comments: number;
  recent_articles: {
    id: number;
    title: string;
    status: string;
    updated_at: string;
    category_name: string | null;
  }[];
  total_views: number;
  popular_articles: {
    id: number;
    title: string;
    views_count: number;
    category_name: string | null;
  }[];
  revenue: {
    estimated_total: number;
    ad_impressions: number;
    ad_clicks: number;
    configured: boolean;
  };
};

const Dashboard = () => {
  const stats = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await api.get<{ data: DashboardStats }>('/admin/dashboard')).data.data,
  });

  return (
    <>
      <h2 className="text-3xl font-bold">Tableau de bord</h2>
      {stats.isLoading && <p className="mt-6 text-slate-500">Chargement…</p>}
      {stats.isError && <p className="mt-6 text-red-700">Impossible de charger les statistiques.</p>}
      {stats.data && (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link to="/articles" className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-orange-300 hover:shadow-md">
              <b className="block text-3xl">{stats.data.published_articles}</b>
              <span className="text-slate-500">Articles publiés</span>
            </Link>
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <b className="block text-3xl">{stats.data.total_views.toLocaleString('fr-FR')}</b>
              <span className="text-slate-500">Vues totales (articles)</span>
            </div>
            <Link to="/comments" className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-orange-300 hover:shadow-md">
              <b className="block text-3xl">{stats.data.pending_comments}</b>
              <span className="text-slate-500">Commentaires en attente</span>
            </Link>
            <Link to="/newsletter" className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-orange-300 hover:shadow-md">
              <b className="block text-3xl">{stats.data.active_subscribers}</b>
              <span className="text-slate-500">Abonnés newsletter</span>
            </Link>
          </div>

          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Revenus publicitaires estimés</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {stats.data.revenue.ad_impressions.toLocaleString('fr-FR')} impressions ·{' '}
                  {stats.data.revenue.ad_clicks.toLocaleString('fr-FR')} clics (cumulés)
                </p>
              </div>
              {stats.data.revenue.configured ? (
                <b className="text-3xl">
                  {stats.data.revenue.estimated_total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}
                </b>
              ) : (
                <Link to="/settings" className="text-sm font-semibold text-orange-700 hover:underline">
                  Configurer un CPM/CPC estimé →
                </Link>
              )}
            </div>
          </section>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <h3 className="border-b border-slate-100 px-6 py-4 font-bold">Articles récents</h3>
              {stats.data.recent_articles.length === 0 ? (
                <p className="p-6 text-slate-500">Aucun article pour le moment.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {stats.data.recent_articles.map((article) => (
                    <li key={article.id} className="flex items-center justify-between gap-4 px-6 py-3">
                      <div className="min-w-0">
                        <Link
                          to="/articles/$articleId"
                          params={{ articleId: String(article.id) }}
                          className="block truncate font-semibold text-slate-900 hover:text-orange-700"
                        >
                          {article.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {article.category_name ?? 'Sans rubrique'} · {formatDateTime(article.updated_at)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses[article.status] ?? 'bg-slate-100 text-slate-700'}`}
                      >
                        {statusLabels[article.status] ?? article.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <h3 className="border-b border-slate-100 px-6 py-4 font-bold">Articles populaires</h3>
              {stats.data.popular_articles.length === 0 ? (
                <p className="p-6 text-slate-500">Pas encore assez de vues pour établir un classement.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {stats.data.popular_articles.map((article) => (
                    <li key={article.id} className="flex items-center justify-between gap-4 px-6 py-3">
                      <div className="min-w-0">
                        <Link
                          to="/articles/$articleId"
                          params={{ articleId: String(article.id) }}
                          className="block truncate font-semibold text-slate-900 hover:text-orange-700"
                        >
                          {article.title}
                        </Link>
                        <p className="text-xs text-slate-500">{article.category_name ?? 'Sans rubrique'}</p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-slate-500">
                        {article.views_count.toLocaleString('fr-FR')} vues
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
};
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
  is_featured: number | boolean;
};
type ArticlesTaxonomy = {
  categories: { id: number; parent_id: number | null; name: string; slug: string }[];
  authors: { id: number; display_name: string }[];
};
type ArticlesMeta = { page: number; per_page: number; total: number; total_pages: number };
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
const emptyAdvancedFilters = {
  category_id: '',
  author_id: '',
  is_sponsored: '',
  is_featured: '',
  date_from: '',
  date_to: '',
};
const Articles = () => {
  const [filter, setFilter] = React.useState<(typeof articleFilters)[number][0]>('all');
  const [view, setView] = React.useState<'compact' | 'table'>('table');
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [showFilters, setShowFilters] = React.useState(false);
  const [advancedFilters, setAdvancedFilters] = React.useState(emptyAdvancedFilters);
  const [toast, setToast] = React.useState<{ message: string; tone: 'error' | 'success' } | null>(
    null,
  );
  const [activeMenu, setActiveMenu] = React.useState<ActionMenu | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Article | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const filtersRef = React.useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  React.useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(handle);
  }, [searchInput]);
  React.useEffect(() => {
    setPage(1);
  }, [filter, search, advancedFilters]);
  const taxonomy = useQuery({
    queryKey: ['taxonomy'],
    queryFn: async () => (await api.get<ArticlesTaxonomy>('/admin/taxonomy')).data,
  });
  const articles = useQuery({
    queryKey: ['admin-articles', filter, page, search, advancedFilters],
    queryFn: async () =>
      (
        await api.get<{ data: Article[]; meta: ArticlesMeta }>('/admin/articles', {
          params: {
            status: filter,
            page,
            q: search || undefined,
            category_id: advancedFilters.category_id || undefined,
            author_id: advancedFilters.author_id || undefined,
            is_sponsored: advancedFilters.is_sponsored || undefined,
            is_featured: advancedFilters.is_featured || undefined,
            date_from: advancedFilters.date_from || undefined,
            date_to: advancedFilters.date_to || undefined,
          },
        })
      ).data,
    placeholderData: (previous) => previous,
  });
  const activeAdvancedCount = Object.values(advancedFilters).filter((value) => value !== '').length;
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
  const toggleFeatured = useMutation({
    mutationFn: ({ id, featured }: { id: number; featured: boolean }) =>
      api.post(`/admin/articles/${id}/featured`, { is_featured: featured }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
      setToast({
        tone: 'success',
        message: variables.featured ? 'Article mis en avant.' : 'Article retiré de la mise en avant.',
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
  React.useEffect(() => {
    if (!showFilters) return;
    const closeOutside = (event: PointerEvent) => {
      if (!filtersRef.current?.contains(event.target as Node)) setShowFilters(false);
    };
    const closeEscape = (event: KeyboardEvent) => event.key === 'Escape' && setShowFilters(false);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [showFilters]);
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
            {articles.data?.meta.total ?? 0} élément(s) au total
          </p>
        </div>
        <Link
          className="inline-flex items-center gap-2 rounded bg-orange-700 px-4 py-2 font-semibold text-white hover:bg-orange-800"
          to="/articles/new"
        >
          <FilePlus2 size={17} /> Nouvel article
        </Link>
      </header>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Rechercher un titre ou un extrait…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
          />
        </div>
        <div className="relative shrink-0" ref={filtersRef}>
          <button
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              showFilters || activeAdvancedCount > 0
                ? 'border-orange-300 bg-orange-50 text-orange-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal size={16} /> Filtres avancés
            {activeAdvancedCount > 0 && (
              <span className="rounded-full bg-orange-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {activeAdvancedCount}
              </span>
            )}
          </button>
          {showFilters && (
            <div className="absolute top-full right-0 z-20 mt-2 grid w-[min(640px,calc(100vw-2rem))] grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            Rubrique
            <select
              value={advancedFilters.category_id}
              onChange={(event) =>
                setAdvancedFilters((current) => ({ ...current, category_id: event.target.value }))
              }
              className="rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
            >
              <option value="">Toutes</option>
              {taxonomy.data?.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            Auteur
            <select
              value={advancedFilters.author_id}
              onChange={(event) =>
                setAdvancedFilters((current) => ({ ...current, author_id: event.target.value }))
              }
              className="rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
            >
              <option value="">Tous</option>
              {taxonomy.data?.authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            Sponsorisé
            <select
              value={advancedFilters.is_sponsored}
              onChange={(event) =>
                setAdvancedFilters((current) => ({ ...current, is_sponsored: event.target.value }))
              }
              className="rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
            >
              <option value="">Indifférent</option>
              <option value="1">Oui</option>
              <option value="0">Non</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            Mis en avant
            <select
              value={advancedFilters.is_featured}
              onChange={(event) =>
                setAdvancedFilters((current) => ({ ...current, is_featured: event.target.value }))
              }
              className="rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
            >
              <option value="">Indifférent</option>
              <option value="1">Oui</option>
              <option value="0">Non</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            Créé depuis le
            <input
              type="date"
              value={advancedFilters.date_from}
              onChange={(event) =>
                setAdvancedFilters((current) => ({ ...current, date_from: event.target.value }))
              }
              className="rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            Jusqu'au
            <input
              type="date"
              value={advancedFilters.date_to}
              onChange={(event) =>
                setAdvancedFilters((current) => ({ ...current, date_to: event.target.value }))
              }
              className="rounded border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
            />
          </label>
              {activeAdvancedCount > 0 && (
                <button
                  onClick={() => setAdvancedFilters(emptyAdvancedFilters)}
                  className="self-end text-xs font-semibold text-orange-700 hover:underline sm:col-span-2 lg:col-span-3"
                >
                  Réinitialiser les filtres avancés
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div
          className="no-scrollbar flex max-w-full snap-x scroll-px-4 gap-2 overflow-x-auto scroll-smooth pb-1"
          role="tablist"
          aria-label="Filtrer les articles par statut"
        >
          {articleFilters.map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              onClick={(event) => {
                setFilter(value);
                event.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
              }}
              className={`shrink-0 snap-center rounded-full px-3 py-2 text-sm font-semibold transition ${filter === value ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'}`}
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
      {articles.data?.data.length === 0 && (
        <p className="mt-6 rounded-xl bg-white p-6 text-slate-500">
          Aucun article ne correspond à ces critères.
        </p>
      )}
      {articles.data &&
        articles.data.data.length > 0 &&
        (view === 'table' ? (
          <section className="mt-6 max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white contain-layout">
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
                {articles.data.data.map((article) => (
                  <tr
                    className="group border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    key={article.id}
                  >
                    <td className="max-w-md px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            toggleFeatured.mutate({ id: article.id, featured: !article.is_featured })
                          }
                          className={`rounded p-1 transition ${
                            Boolean(article.is_featured)
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-slate-300 hover:text-amber-500'
                          }`}
                          aria-label={
                            article.is_featured
                              ? `Retirer ${article.title} de la mise en avant`
                              : `Mettre ${article.title} en avant`
                          }
                          title={article.is_featured ? 'Mis en avant' : 'Mettre en avant'}
                        >
                          <Star size={16} fill={article.is_featured ? 'currentColor' : 'none'} />
                        </button>
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
          <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {articles.data.data.map((article) => (
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
                    <button
                      onClick={() =>
                        toggleFeatured.mutate({ id: article.id, featured: !article.is_featured })
                      }
                      className={`rounded p-1 transition ${
                        Boolean(article.is_featured)
                          ? 'text-amber-500 hover:text-amber-600'
                          : 'text-slate-300 hover:text-amber-500'
                      }`}
                      aria-label={
                        article.is_featured
                          ? `Retirer ${article.title} de la mise en avant`
                          : `Mettre ${article.title} en avant`
                      }
                      title={article.is_featured ? 'Mis en avant' : 'Mettre en avant'}
                    >
                      <Star size={16} fill={article.is_featured ? 'currentColor' : 'none'} />
                    </button>
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
      {articles.data && articles.data.meta.total_pages > 1 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Page {articles.data.meta.page} sur {articles.data.meta.total_pages} ·{' '}
            {articles.data.meta.total} article(s)
          </p>
          <div className="inline-flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={16} /> Précédent
            </button>
            <button
              disabled={page >= articles.data.meta.total_pages}
              onClick={() =>
                setPage((current) => Math.min(articles.data!.meta.total_pages, current + 1))
              }
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Suivant <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
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
const pagesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/pages',
  component: Pages,
});
const pageNewRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/pages/new',
  component: PageEditor,
});
const EditPage = () => {
  const { pageId } = useParams({ from: '/pages/$pageId' });
  return <PageEditor pageId={Number(pageId)} />;
};
const pageEditRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/pages/$pageId',
  component: EditPage,
});
const mediaRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/media',
  component: Media,
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
const themeRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/theme',
  component: Theme,
});
const redirectsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/redirects',
  component: Redirects,
});
const drawRoundsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/tirages',
  component: DrawRounds,
});
const commentsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/comments',
  component: Comments,
});
const listingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/listings',
  component: Listings,
});
const adsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/ads',
  component: Ads,
});
const newsletterRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/newsletter',
  component: Newsletter,
});
const usersRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/users',
  component: UsersPage,
});
const settingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});
const activityRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/activity',
  component: ActivityLog,
});
const backupsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/backups',
  component: Backups,
});
const router = createRouter({
  basepath: '/u/admin',
  routeTree: rootRoute.addChildren([
    indexRoute,
    articlesRoute,
    articleNewRoute,
    articleEditRoute,
    pagesRoute,
    pageNewRoute,
    pageEditRoute,
    mediaRoute,
    loginRoute,
    taxonomyRoute,
    themeRoute,
    redirectsRoute,
    drawRoundsRoute,
    commentsRoute,
    listingsRoute,
    adsRoute,
    newsletterRoute,
    usersRoute,
    settingsRoute,
    activityRoute,
    backupsRoute,
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
