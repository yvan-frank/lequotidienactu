import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Code2,
  DollarSign,
  ExternalLink,
  Gauge,
  Mail,
  RotateCcw,
  Search,
  TrendingUp,
} from 'lucide-react';
import { api } from './api';
import { Toast } from './components/Toast';

type SeoSettings = { ga_measurement_id: string; gsc_verification: string; adsense_client: string };
type GeneralSettings = {
  tagline: string;
  contact_email: string;
  twitter_url: string;
  facebook_url: string;
  instagram_url: string;
  linkedin_url: string;
};
type RevenueSettings = { cpm: number; cpc: number };
type HeadCodeSettings = { head_html: string };
type RateLimitRow = {
  bucket: string;
  label: string;
  description: string;
  max_attempts: number;
  window_seconds: number;
  default_max_attempts: number;
  default_window_seconds: number;
  is_overridden: boolean;
};
type ToastState = { message: string; tone: 'error' | 'success' } | null;

const inputClass =
  'mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-orange-600 focus:outline-none';
const labelClass = 'block text-sm font-semibold text-slate-700';

function apiErrorMessage(error: any, fallback: string): string {
  return error?.response?.data?.message ?? fallback;
}

const TABS = [
  { id: 'general', label: 'Général', icon: Building2 },
  { id: 'seo', label: 'SEO & Analytics', icon: Search },
  { id: 'head-code', label: 'Code personnalisé', icon: Code2 },
  { id: 'rate-limits', label: 'Anti-abus', icon: Gauge },
  { id: 'mail', label: 'E-mail (SMTP)', icon: Mail },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function Settings() {
  const [activeTab, setActiveTab] = React.useState<TabId>('general');
  const [toast, setToast] = React.useState<ToastState>(null);

  return (
    <>
      <header>
        <p className="text-sm font-semibold text-orange-700">Paramètres</p>
        <h2 className="text-3xl font-bold">Réglages de la plateforme</h2>
        <p className="mt-1 text-sm text-slate-500">
          Configurez les intégrations et services techniques du site, par domaine.
        </p>
      </header>

      <div className="mt-6 inline-flex gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={active}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                active
                  ? 'bg-white text-orange-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {activeTab === 'general' && <GeneralPanel setToast={setToast} />}
        {activeTab === 'seo' && <SeoPanel setToast={setToast} />}
        {activeTab === 'head-code' && <HeadCodePanel setToast={setToast} />}
        {activeTab === 'rate-limits' && <RateLimitsPanel setToast={setToast} />}
        {activeTab === 'mail' && <MailPanel />}
      </div>

      {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}

function GeneralPanel({ setToast }: { setToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<GeneralSettings>({
    tagline: '',
    contact_email: '',
    twitter_url: '',
    facebook_url: '',
    instagram_url: '',
    linkedin_url: '',
  });
  const [loaded, setLoaded] = React.useState(false);
  const settings = useQuery({
    queryKey: ['admin-settings-general'],
    queryFn: async () => (await api.get<{ data: GeneralSettings }>('/admin/settings/general')).data.data,
  });
  React.useEffect(() => {
    if (settings.data && !loaded) {
      setForm(settings.data);
      setLoaded(true);
    }
  }, [settings.data, loaded]);
  const save = useMutation({
    mutationFn: () => api.put<{ data: GeneralSettings }>('/admin/settings/general', form),
    onSuccess: (response) => {
      queryClient.setQueryData(['admin-settings-general'], response.data.data);
      setToast({ tone: 'success', message: 'Paramètres généraux enregistrés.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'enregistrer ces paramètres.") }),
  });

  const [revenueForm, setRevenueForm] = React.useState<RevenueSettings>({ cpm: 0, cpc: 0 });
  const [revenueLoaded, setRevenueLoaded] = React.useState(false);
  const revenueSettings = useQuery({
    queryKey: ['admin-settings-revenue'],
    queryFn: async () => (await api.get<{ data: RevenueSettings }>('/admin/settings/revenue')).data.data,
  });
  React.useEffect(() => {
    if (revenueSettings.data && !revenueLoaded) {
      setRevenueForm(revenueSettings.data);
      setRevenueLoaded(true);
    }
  }, [revenueSettings.data, revenueLoaded]);
  const saveRevenue = useMutation({
    mutationFn: () => api.put<{ data: RevenueSettings }>('/admin/settings/revenue', revenueForm),
    onSuccess: (response) => {
      queryClient.setQueryData(['admin-settings-revenue'], response.data.data);
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      setToast({ tone: 'success', message: 'Estimation de revenus enregistrée.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'enregistrer ces paramètres.") }),
  });

  return (
    <div className="grid grid-cols-1 gap-6">
      {loaded && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="rounded-xl border border-slate-200 bg-white p-6"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-orange-50 text-orange-700">
              <Building2 size={20} />
            </span>
            <div>
              <h3 className="font-bold">Identité du média</h3>
              <p className="text-sm text-slate-500">
                Description, contact public et réseaux sociaux affichés sur le site.
              </p>
            </div>
          </div>
          <label className={`mt-5 ${labelClass}`}>
            Accroche (tagline)
            <input
              className={inputClass}
              placeholder="L’actualité Afrique francophone, France et diaspora."
              value={form.tagline}
              onChange={(event) => setForm({ ...form, tagline: event.target.value })}
            />
          </label>
          <label className={`mt-4 ${labelClass}`}>
            E-mail de contact public
            <input
              type="email"
              className={inputClass}
              placeholder="contact@exemple.fr"
              value={form.contact_email}
              onChange={(event) => setForm({ ...form, contact_email: event.target.value })}
            />
          </label>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              X (Twitter)
              <input
                type="url"
                className={inputClass}
                placeholder="https://x.com/..."
                value={form.twitter_url}
                onChange={(event) => setForm({ ...form, twitter_url: event.target.value })}
              />
            </label>
            <label className={labelClass}>
              Facebook
              <input
                type="url"
                className={inputClass}
                placeholder="https://facebook.com/..."
                value={form.facebook_url}
                onChange={(event) => setForm({ ...form, facebook_url: event.target.value })}
              />
            </label>
            <label className={labelClass}>
              Instagram
              <input
                type="url"
                className={inputClass}
                placeholder="https://instagram.com/..."
                value={form.instagram_url}
                onChange={(event) => setForm({ ...form, instagram_url: event.target.value })}
              />
            </label>
            <label className={labelClass}>
              LinkedIn
              <input
                type="url"
                className={inputClass}
                placeholder="https://linkedin.com/..."
                value={form.linkedin_url}
                onChange={(event) => setForm({ ...form, linkedin_url: event.target.value })}
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              disabled={save.isPending}
              className="rounded bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
            >
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      {revenueLoaded && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveRevenue.mutate();
          }}
          className="rounded-xl border border-slate-200 bg-white p-6"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-orange-50 text-orange-700">
              <TrendingUp size={20} />
            </span>
            <div>
              <h3 className="font-bold">Estimation des revenus publicitaires</h3>
              <p className="text-sm text-slate-500">
                Tarifs indicatifs utilisés pour estimer les revenus dans le tableau de bord, à partir
                des impressions et clics déjà comptabilisés.
              </p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              CPM estimé (€ pour 1000 impressions)
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={revenueForm.cpm}
                onChange={(event) => setRevenueForm({ ...revenueForm, cpm: Number(event.target.value) })}
              />
            </label>
            <label className={labelClass}>
              CPC estimé (€ par clic)
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
                value={revenueForm.cpc}
                onChange={(event) => setRevenueForm({ ...revenueForm, cpc: Number(event.target.value) })}
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Il s’agit d’une estimation basée sur des tarifs que vous renseignez — pas des revenus réels
            versés par vos régies publicitaires.
          </p>
          <div className="mt-5 flex justify-end">
            <button
              disabled={saveRevenue.isPending}
              className="rounded bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
            >
              {saveRevenue.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function SeoPanel({ setToast }: { setToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState<SeoSettings>({
    ga_measurement_id: '',
    gsc_verification: '',
    adsense_client: '',
  });
  const [loaded, setLoaded] = React.useState(false);

  const settings = useQuery({
    queryKey: ['admin-settings-seo'],
    queryFn: async () => (await api.get<{ data: SeoSettings }>('/admin/settings/seo')).data.data,
  });

  React.useEffect(() => {
    if (settings.data && !loaded) {
      setForm(settings.data);
      setLoaded(true);
    }
  }, [settings.data, loaded]);

  const save = useMutation({
    mutationFn: () => api.put<{ data: SeoSettings }>('/admin/settings/seo', form),
    onSuccess: (response) => {
      queryClient.setQueryData(['admin-settings-seo'], response.data.data);
      setToast({ tone: 'success', message: 'Paramètres SEO enregistrés.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'enregistrer ces paramètres.") }),
  });

  return (
    <>
      {settings.isLoading && <p className="rounded-xl bg-white p-6 text-slate-500">Chargement…</p>}
      {settings.isError && (
        <p className="rounded-xl bg-white p-6 text-red-700">Impossible de charger les paramètres.</p>
      )}
      {loaded && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="grid grid-cols-1 gap-6"
        >
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-orange-50 text-orange-700">
                <CheckCircle2 size={20} />
              </span>
              <div>
                <h3 className="font-bold">Google Analytics</h3>
                <p className="text-sm text-slate-500">
                  Identifiant de mesure GA4 (format <code className="rounded bg-slate-100 px-1">G-XXXXXXX</code>).
                </p>
              </div>
              {form.ga_measurement_id && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  Actif
                </span>
              )}
            </div>
            <label className={`mt-5 ${labelClass}`}>
              Identifiant de mesure
              <input
                className={inputClass}
                placeholder="G-XXXXXXX"
                value={form.ga_measurement_id}
                onChange={(event) => setForm({ ...form, ga_measurement_id: event.target.value })}
              />
            </label>
            <p className="mt-2 text-xs text-slate-400">
              Trouvable dans Google Analytics sous Administration → Flux de données. Laissez vide pour
              désactiver le suivi.
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-orange-50 text-orange-700">
                <Search size={20} />
              </span>
              <div>
                <h3 className="font-bold">Google Search Console</h3>
                <p className="text-sm text-slate-500">Balise de vérification de propriété du site.</p>
              </div>
              {form.gsc_verification && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  Actif
                </span>
              )}
            </div>
            <label className={`mt-5 ${labelClass}`}>
              Code de vérification
              <input
                className={inputClass}
                placeholder="abcdEFGH12345..."
                value={form.gsc_verification}
                onChange={(event) => setForm({ ...form, gsc_verification: event.target.value })}
              />
            </label>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              Dans Search Console, choisissez la méthode « balise HTML » et collez uniquement la
              valeur de l'attribut <code className="rounded bg-slate-100 px-1">content</code>.
              <a
                className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline"
                href="https://search.google.com/search-console"
                target="_blank"
                rel="noreferrer"
              >
                Ouvrir Search Console <ExternalLink size={12} />
              </a>
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-orange-50 text-orange-700">
                <DollarSign size={20} />
              </span>
              <div>
                <h3 className="font-bold">Google AdSense</h3>
                <p className="text-sm text-slate-500">
                  Identifiant éditeur, pour la vérification du site et les Auto ads.
                </p>
              </div>
              {form.adsense_client && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                  Actif
                </span>
              )}
            </div>
            <label className={`mt-5 ${labelClass}`}>
              Identifiant éditeur (client)
              <input
                className={inputClass}
                placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                value={form.adsense_client}
                onChange={(event) => setForm({ ...form, adsense_client: event.target.value })}
              />
            </label>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              Dans AdSense, sous Compte → Informations sur le compte. Insère la balise de
              vérification du site automatiquement sur toutes les pages. Laissez vide pour désactiver.
              <a
                className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline"
                href="https://adsense.google.com/"
                target="_blank"
                rel="noreferrer"
              >
                Ouvrir AdSense <ExternalLink size={12} />
              </a>
            </p>
          </section>

          <div className="flex justify-end">
            <button
              disabled={save.isPending}
              className="rounded bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
            >
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

const HEAD_CODE_MAX_LENGTH = 20000;

function HeadCodePanel({ setToast }: { setToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const [headHtml, setHeadHtml] = React.useState('');
  const [loaded, setLoaded] = React.useState(false);

  const settings = useQuery({
    queryKey: ['admin-settings-head-code'],
    queryFn: async () => (await api.get<{ data: HeadCodeSettings }>('/admin/settings/head-code')).data.data,
  });

  React.useEffect(() => {
    if (settings.data && !loaded) {
      setHeadHtml(settings.data.head_html);
      setLoaded(true);
    }
  }, [settings.data, loaded]);

  const save = useMutation({
    mutationFn: () => api.put<{ data: HeadCodeSettings }>('/admin/settings/head-code', { head_html: headHtml }),
    onSuccess: (response) => {
      queryClient.setQueryData(['admin-settings-head-code'], response.data.data);
      setToast({ tone: 'success', message: 'Code personnalisé enregistré.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'enregistrer ce code.") }),
  });

  return (
    <>
      {settings.isLoading && <p className="rounded-xl bg-white p-6 text-slate-500">Chargement…</p>}
      {settings.isError && (
        <p className="rounded-xl bg-white p-6 text-red-700">Impossible de charger les paramètres.</p>
      )}
      {loaded && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
          className="grid grid-cols-1 gap-6"
        >
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-orange-50 text-orange-700">
                <Code2 size={20} />
              </span>
              <div>
                <h3 className="font-bold">Balises &lt;head&gt; personnalisées</h3>
                <p className="text-sm text-slate-500">
                  Scripts, balises meta ou liens insérés tels quels juste avant{' '}
                  <code className="rounded bg-slate-100 px-1">&lt;/head&gt;</code> sur chaque page du
                  site public.
                </p>
              </div>
            </div>
            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Code HTML
              <textarea
                className="mt-1 min-h-56 w-full rounded border border-slate-300 px-3 py-2 font-mono text-xs focus:border-orange-600 focus:outline-none"
                placeholder={'<meta name="facebook-domain-verification" content="..." />\n<script>\n  // ...\n</script>'}
                value={headHtml}
                maxLength={HEAD_CODE_MAX_LENGTH}
                onChange={(event) => setHeadHtml(event.target.value)}
                spellCheck={false}
              />
            </label>
            <p className="mt-2 text-right text-xs text-slate-400">
              {headHtml.length.toLocaleString('fr-FR')} / {HEAD_CODE_MAX_LENGTH.toLocaleString('fr-FR')}
            </p>
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              Ce code s'exécute tel quel sur le site public, pour tous les visiteurs. Une erreur de
              syntaxe ou un script mal formé peut casser l'affichage des pages ou dégrader les
              performances. Ne collez que du code venant d'une source de confiance (Meta Pixel,
              vérification de domaine, etc.) — les scripts Analytics/AdSense/Search Console ont leur
              propre onglet dédié.
            </p>
          </section>

          <div className="flex justify-end">
            <button
              disabled={save.isPending}
              className="rounded bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
            >
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

function formatWindow(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600} h`;
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds} s`;
}

function RateLimitsPanel({ setToast }: { setToast: (toast: ToastState) => void }) {
  const queryClient = useQueryClient();
  const [meta, setMeta] = React.useState<RateLimitRow[]>([]);
  const [rows, setRows] = React.useState<Record<string, { max_attempts: number; window_seconds: number }>>({});
  const [loaded, setLoaded] = React.useState(false);

  const settings = useQuery({
    queryKey: ['admin-settings-rate-limits'],
    queryFn: async () => (await api.get<{ data: RateLimitRow[] }>('/admin/settings/rate-limits')).data.data,
  });

  React.useEffect(() => {
    if (settings.data && !loaded) {
      setMeta(settings.data);
      const initial: Record<string, { max_attempts: number; window_seconds: number }> = {};
      settings.data.forEach((row) => {
        initial[row.bucket] = { max_attempts: row.max_attempts, window_seconds: row.window_seconds };
      });
      setRows(initial);
      setLoaded(true);
    }
  }, [settings.data, loaded]);

  const save = useMutation({
    mutationFn: () => api.put('/admin/settings/rate-limits', { buckets: rows }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings-rate-limits'] });
      setToast({ tone: 'success', message: 'Limites de requêtes enregistrées.' });
    },
    onError: (error) =>
      setToast({ tone: 'error', message: apiErrorMessage(error, "Impossible d'enregistrer ces limites.") }),
  });

  const updateRow = (bucket: string, field: 'max_attempts' | 'window_seconds', value: number) => {
    setRows((current) => ({ ...current, [bucket]: { ...current[bucket], [field]: value } }));
  };

  const resetRow = (row: RateLimitRow) => {
    setRows((current) => ({
      ...current,
      [row.bucket]: { max_attempts: row.default_max_attempts, window_seconds: row.default_window_seconds },
    }));
  };

  return (
    <>
      {settings.isLoading && <p className="rounded-xl bg-white p-6 text-slate-500">Chargement…</p>}
      {settings.isError && (
        <p className="rounded-xl bg-white p-6 text-red-700">Impossible de charger les paramètres.</p>
      )}
      {loaded && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-orange-50 text-orange-700">
                <Gauge size={20} />
              </span>
              <div>
                <h3 className="font-bold">Limites anti-abus</h3>
                <p className="text-sm text-slate-500">
                  Nombre maximal de tentatives autorisées par adresse IP, sur une fenêtre glissante,
                  pour chaque action publique ou d'administration sensible.
                </p>
              </div>
            </div>

            <div className="mt-6 divide-y divide-slate-100">
              {meta.map((row) => {
                const current = rows[row.bucket] ?? {
                  max_attempts: row.max_attempts,
                  window_seconds: row.window_seconds,
                };
                const isDefault =
                  current.max_attempts === row.default_max_attempts &&
                  current.window_seconds === row.default_window_seconds;
                return (
                  <div
                    key={row.bucket}
                    className="grid grid-cols-1 gap-3 py-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-start sm:gap-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{row.label}</p>
                      <p className="text-xs text-slate-500">{row.description}</p>
                    </div>
                    <label className="text-xs font-semibold text-slate-600">
                      Tentatives
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        className={`${inputClass} w-24`}
                        value={current.max_attempts}
                        onChange={(event) =>
                          updateRow(row.bucket, 'max_attempts', Number(event.target.value))
                        }
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Fenêtre (secondes)
                      <input
                        type="number"
                        min={1}
                        max={604800}
                        className={`${inputClass} w-28`}
                        value={current.window_seconds}
                        onChange={(event) =>
                          updateRow(row.bucket, 'window_seconds', Number(event.target.value))
                        }
                      />
                      <span className="mt-1 block text-[11px] font-normal text-slate-400">
                        ≈ {formatWindow(current.window_seconds)}
                      </span>
                    </label>
                    <button
                      type="button"
                      disabled={isDefault}
                      onClick={() => resetRow(row)}
                      title="Revenir à la valeur par défaut"
                      className="mt-4 inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 sm:mt-5"
                    >
                      <RotateCcw size={13} /> Réinitialiser
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="mt-6 flex justify-end">
            <button
              disabled={save.isPending}
              className="rounded bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:opacity-50"
            >
              {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

function MailPanel() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-orange-50 text-orange-700">
          <Mail size={20} />
        </span>
        <div>
          <h3 className="font-bold">Test SMTP</h3>
          <p className="text-sm text-slate-500">
            Vérifie que l'envoi d'e-mails (réinitialisation de mot de passe, etc.) fonctionne. La
            configuration elle-même (hôte, port, identifiants) se fait dans le fichier{' '}
            <code className="rounded bg-slate-100 px-1">.env</code> du serveur.
          </p>
        </div>
      </div>
      <MailTestForm />
    </section>
  );
}

function MailTestForm() {
  const [to, setTo] = React.useState('');
  const test = useMutation({
    mutationFn: () => api.post<{ message: string }>('/admin/settings/mail/test', { to }),
  });

  return (
    <form
      className="mt-5 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        test.mutate();
      }}
    >
      <label className={`min-w-0 flex-1 ${labelClass}`}>
        Adresse de destination
        <input
          required
          type="email"
          className={inputClass}
          placeholder="vous@exemple.fr"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </label>
      <button
        disabled={test.isPending}
        className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {test.isPending ? 'Envoi…' : 'Envoyer un e-mail test'}
      </button>
      {test.isSuccess && (
        <p className="w-full text-sm font-semibold text-emerald-700">{test.data.data.message}</p>
      )}
      {test.isError && (
        <p className="w-full text-sm font-semibold text-red-700">
          {apiErrorMessage(test.error, "Échec de l'envoi.")}
        </p>
      )}
    </form>
  );
}
