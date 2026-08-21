import React from 'react';
import { createPortal } from 'react-dom';
import { CircleUser, Loader2, X } from 'lucide-react';
import { api } from '../api';

type Reader = { id: number; name: string; email: string; followed_categories: string[] | null };
type Category = { slug: string; name: string };

function apiErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

export function AccountWidget({ categories }: { categories: Category[] }) {
  const [reader, setReader] = React.useState<Reader | null | undefined>(undefined);
  const [open, setOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [mode, setMode] = React.useState<'login' | 'register' | 'preferences'>('login');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    api
      .get<{ authenticated: boolean; reader: Reader | null }>('/account/session')
      .then((response) => setReader(response.data.reader))
      .catch(() => setReader(null));
  }, []);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  const openModal = (initialMode: 'login' | 'register' | 'preferences') => {
    setMode(initialMode);
    setError(null);
    setName('');
    setPassword('');
    if (initialMode === 'preferences') {
      setSelectedCategories(reader?.followed_categories ?? categories.map((category) => category.slug));
    }
    setOpen(true);
    setMenuOpen(false);
  };

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint = mode === 'login' ? '/account/login' : '/account/register';
      const payload = mode === 'login' ? { email, password } : { name, email, password };
      const response = await api.post<{ reader: Reader }>(endpoint, payload);
      setReader(response.data.reader);
      setOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err, mode === 'login' ? 'Connexion impossible.' : 'Inscription impossible.'));
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.put<{ reader: Reader }>('/account/preferences', { categories: selectedCategories });
      setReader(response.data.reader);
      setOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err, 'Impossible d’enregistrer vos préférences.'));
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setMenuOpen(false);
    try {
      await api.post('/account/logout');
    } finally {
      setReader(null);
    }
  };

  const toggleCategory = (slug: string) => {
    setSelectedCategories((current) =>
      current.includes(slug) ? current.filter((value) => value !== slug) : [...current, slug],
    );
  };

  if (reader === undefined) {
    return <div className="size-9" aria-hidden="true" />;
  }

  return (
    <div className="relative">
      {reader ? (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="flex items-center gap-2 rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:border-brand-600 hover:text-brand-600"
          >
            <CircleUser size={16} aria-hidden="true" />
            <span className="hidden max-w-24 truncate sm:inline">{reader.name}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
              <p className="truncate px-3 py-2 text-xs text-slate-500">{reader.email}</p>
              <button
                type="button"
                onClick={() => openModal('preferences')}
                className="block w-full rounded px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Mes rubriques suivies
              </button>
              <button
                type="button"
                onClick={logout}
                className="block w-full rounded px-3 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => openModal('login')}
          className="flex items-center gap-2 rounded border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:border-brand-600 hover:text-brand-600"
        >
          <CircleUser size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Connexion</span>
        </button>
      )}

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/50 p-4 pt-[10vh] backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Compte lecteur"
            onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
          >
            <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <p className="font-bold text-slate-900">
                  {mode === 'preferences' ? 'Mes rubriques suivies' : mode === 'login' ? 'Connexion' : 'Créer un compte'}
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer"
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              {mode !== 'preferences' && (
                <>
                  <div className="flex border-b border-slate-200">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className={`flex-1 border-b-2 px-4 py-2.5 text-sm font-semibold ${mode === 'login' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}
                    >
                      Connexion
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('register')}
                      className={`flex-1 border-b-2 px-4 py-2.5 text-sm font-semibold ${mode === 'register' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500'}`}
                    >
                      Inscription
                    </button>
                  </div>
                  <form onSubmit={submitAuth} className="grid gap-3 p-5">
                    {mode === 'register' && (
                      <label className="text-sm font-semibold text-slate-700">
                        Nom
                        <input
                          required
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                        />
                      </label>
                    )}
                    <label className="text-sm font-semibold text-slate-700">
                      E-mail
                      <input
                        required
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Mot de passe
                      <input
                        required
                        type="password"
                        minLength={8}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                    {error && <p className="text-sm text-red-700">{error}</p>}
                    <button
                      disabled={loading}
                      className="mt-1 flex items-center justify-center gap-2 rounded bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      {loading && <Loader2 size={14} className="animate-spin" />}
                      {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
                    </button>
                  </form>
                </>
              )}

              {mode === 'preferences' && (
                <div className="p-5">
                  <p className="text-sm text-slate-500">
                    Choisissez les rubriques à mettre en avant dans votre section « Pour vous » sur l’accueil.
                  </p>
                  <div className="mt-3 grid max-h-56 gap-1.5 overflow-y-auto">
                    {categories.map((category) => (
                      <label key={category.slug} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(category.slug)}
                          onChange={() => toggleCategory(category.slug)}
                        />
                        {category.name}
                      </label>
                    ))}
                  </div>
                  {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
                  <button
                    disabled={loading}
                    onClick={savePreferences}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    Enregistrer
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
