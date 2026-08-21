import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Languages,
  RotateCcw,
  Sparkles,
  User,
  Users,
  XCircle,
  type LucideProps,
} from 'lucide-react';
import {
  calculateCrsScore,
  CLB_LEVELS,
  EDUCATION_LABELS,
  type Ability,
  type CanadianExpYears,
  type ClbScores,
  type CrsInput,
  type EducationLevel,
  type ForeignExpYears,
  type LanguageTag,
} from '../lib/crsScore';
import { Select, type SelectOption } from './Select';
import { Toast } from './Toast';
import { api } from '../api';

type DrawRound = {
  draw_date: string;
  draw_type: string;
  crs_cutoff: number;
  invitations_issued: number;
};

const ABILITY_LABELS: Record<Ability, string> = {
  listening: 'Compréhension orale',
  speaking: 'Expression orale',
  reading: 'Compréhension écrite',
  writing: 'Expression écrite',
};

const EDUCATION_OPTIONS: SelectOption<EducationLevel>[] = Object.entries(EDUCATION_LABELS).map(
  ([value, label]) => ({ value: value as EducationLevel, label }),
);

const CLB_OPTIONS: SelectOption<number>[] = CLB_LEVELS.map((clb) => ({
  value: clb,
  label: `NCLC ${clb}${clb === 10 ? '+' : ''}`,
}));

const AGE_OPTIONS: SelectOption<number>[] = [
  ...Array.from({ length: 44 }, (_, i) => ({ value: i + 1, label: `${i + 1} an${i + 1 > 1 ? 's' : ''}` })),
  { value: 45, label: '45 ans ou plus' },
];

const FAMILY_OPTIONS: SelectOption<'0' | '1'>[] = [
  { value: '0', label: 'Célibataire, ou conjoint qui n’immigre pas avec moi' },
  { value: '1', label: 'Conjoint ou partenaire qui immigre avec moi' },
];

const LANGUAGE_TAG_OPTIONS: SelectOption<LanguageTag>[] = [
  { value: 'french', label: 'Le français' },
  { value: 'english', label: 'L’anglais' },
  { value: 'other', label: 'Autre' },
];

const WORK_EXP_OPTIONS: SelectOption<CanadianExpYears>[] = [
  { value: 0, label: 'Aucune' },
  { value: 1, label: '1 an' },
  { value: 2, label: '2 ans' },
  { value: 3, label: '3 ans' },
  { value: 4, label: '4 ans' },
  { value: 5, label: '5 ans ou plus' },
];

const FOREIGN_EXP_OPTIONS: SelectOption<ForeignExpYears>[] = [
  { value: 0, label: 'Aucune' },
  { value: 1, label: '1 à 2 ans' },
  { value: 3, label: '3 ans ou plus' },
];

type CanadianStudy = 'none' | 'one_or_two_years' | 'three_years_plus';
const CANADIAN_STUDY_OPTIONS: SelectOption<CanadianStudy>[] = [
  { value: 'none', label: 'Aucune' },
  { value: 'one_or_two_years', label: 'Programme de 1 à 2 ans (+15)' },
  { value: 'three_years_plus', label: 'Programme de 3 ans ou plus (+30)' },
];

const ABILITIES: Ability[] = ['listening', 'speaking', 'reading', 'writing'];
const emptyClb: ClbScores = { listening: null, speaking: null, reading: null, writing: null };

type Accent = 'sky' | 'violet' | 'amber' | 'rose' | 'emerald';

const ACCENTS: Record<Accent, { bar: string; chip: string; dot: string }> = {
  sky: { bar: 'border-sky-400', chip: 'bg-sky-100 text-sky-600', dot: 'bg-sky-500' },
  violet: { bar: 'border-violet-400', chip: 'bg-violet-100 text-violet-600', dot: 'bg-violet-500' },
  amber: { bar: 'border-amber-400', chip: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
  rose: { bar: 'border-rose-400', chip: 'bg-rose-100 text-rose-600', dot: 'bg-rose-500' },
  emerald: { bar: 'border-emerald-400', chip: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-500' },
};

function Card({
  title,
  icon: Icon,
  accent,
  children,
}: {
  title: string;
  icon: ComponentType<LucideProps>;
  accent: Accent;
  children: React.ReactNode;
}) {
  const colors = ACCENTS[accent];
  return (
    <section className={`rounded-xl border border-l-4 border-slate-200 bg-white p-5 sm:p-6 ${colors.bar}`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${colors.chip}`}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  // A <div>, not <label> — wrapping the custom Select's button in a <label>
  // makes the browser forward every click inside it (including clicks on
  // list options) to the button as an implicit second click, reopening the
  // dropdown right after a selection.
  return (
    <div className="grid gap-1.5 text-sm font-semibold text-slate-700">
      {label}
      {children}
    </div>
  );
}

function LanguageAbilities({
  scores,
  onChange,
}: {
  scores: ClbScores;
  onChange: (scores: ClbScores) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ABILITIES.map((ability) => (
        <div key={ability} className="grid gap-1 text-xs font-semibold text-slate-500">
          {ABILITY_LABELS[ability]}
          <Select
            ariaLabel={ABILITY_LABELS[ability]}
            value={scores[ability]}
            onChange={(clb) => onChange({ ...scores, [ability]: clb })}
            options={CLB_OPTIONS}
            placeholder="NCLC ?"
          />
        </div>
      ))}
    </div>
  );
}

export function CrsCalculator() {
  const [age, setAge] = useState<number | null>(null);
  const [hasSpouse, setHasSpouse] = useState<boolean | null>(null);
  const [education, setEducation] = useState<EducationLevel | null>(null);
  const [canadianExpYears, setCanadianExpYears] = useState<CanadianExpYears | null>(null);
  const [foreignExpYears, setForeignExpYears] = useState<ForeignExpYears | null>(null);
  const [hasCertificateOfQualification, setHasCertificateOfQualification] = useState(false);
  const [language1, setLanguage1] = useState<ClbScores>(emptyClb);
  const [language1Tag, setLanguage1Tag] = useState<LanguageTag | null>(null);
  const [hasLanguage2, setHasLanguage2] = useState(false);
  const [language2, setLanguage2] = useState<ClbScores>(emptyClb);
  const [language2Tag, setLanguage2Tag] = useState<LanguageTag | null>(null);
  const [hasProvincialNomination, setHasProvincialNomination] = useState(false);
  const [hasSiblingInCanada, setHasSiblingInCanada] = useState(false);
  const [canadianStudy, setCanadianStudy] = useState<CanadianStudy>('none');
  const [spouseEducation, setSpouseEducation] = useState<EducationLevel | null>(null);
  const [spouseLanguage, setSpouseLanguage] = useState<ClbScores>(emptyClb);
  const [spouseCanadianExpYears, setSpouseCanadianExpYears] = useState<CanadianExpYears | null>(null);
  const [drawRounds, setDrawRounds] = useState<DrawRound[]>([]);

  useEffect(() => {
    api
      .get<{ data: DrawRound[] }>('/draw-rounds')
      .then((response) => setDrawRounds(response.data.data))
      .catch(() => {});
  }, []);

  const reset = () => {
    setAge(null);
    setHasSpouse(null);
    setEducation(null);
    setCanadianExpYears(null);
    setForeignExpYears(null);
    setHasCertificateOfQualification(false);
    setLanguage1(emptyClb);
    setLanguage1Tag(null);
    setHasLanguage2(false);
    setLanguage2(emptyClb);
    setLanguage2Tag(null);
    setHasProvincialNomination(false);
    setHasSiblingInCanada(false);
    setCanadianStudy('none');
    setSpouseEducation(null);
    setSpouseLanguage(emptyClb);
    setSpouseCanadianExpYears(null);
  };

  const language1Complete = language1Tag !== null && ABILITIES.every((ability) => language1[ability] !== null);
  const language2Complete = !hasLanguage2 || (language2Tag !== null && ABILITIES.every((ability) => language2[ability] !== null));
  const spouseComplete =
    !hasSpouse ||
    (spouseEducation !== null &&
      spouseCanadianExpYears !== null &&
      ABILITIES.every((ability) => spouseLanguage[ability] !== null));
  const isComplete =
    age !== null &&
    hasSpouse !== null &&
    education !== null &&
    canadianExpYears !== null &&
    foreignExpYears !== null &&
    language1Complete &&
    language2Complete &&
    spouseComplete;

  const [showCompletionToast, setShowCompletionToast] = useState(false);
  const wasCompleteRef = useRef(false);
  useEffect(() => {
    if (isComplete && !wasCompleteRef.current) setShowCompletionToast(true);
    wasCompleteRef.current = isComplete;
  }, [isComplete]);

  const input: CrsInput = {
    age,
    hasSpouse,
    education,
    canadianExpYears,
    foreignExpYears,
    hasCertificateOfQualification,
    language1,
    language1Tag,
    hasLanguage2,
    language2,
    language2Tag,
    hasProvincialNomination,
    hasSiblingInCanada,
    canadianStudy,
    spouseEducation,
    spouseLanguage,
    spouseCanadianExpYears,
  };

  const score = useMemo(() => calculateCrsScore(input), [JSON.stringify(input)]);

  return (
    <>
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-5 lg:order-1">
        <Card title="Profil" icon={User} accent="sky">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Âge">
              <Select value={age} onChange={setAge} options={AGE_OPTIONS} placeholder="Sélectionner…" />
            </Field>
            <Field label="Situation familiale">
              <Select
                value={hasSpouse === null ? null : hasSpouse ? '1' : '0'}
                onChange={(value) => setHasSpouse(value === '1')}
                options={FAMILY_OPTIONS}
                placeholder="Sélectionner…"
              />
            </Field>
          </div>
          <Field label="Niveau de scolarité le plus élevé">
            <Select value={education} onChange={setEducation} options={EDUCATION_OPTIONS} placeholder="Sélectionner…" />
          </Field>
        </Card>

        <Card title="Langue 1 (test le plus favorable)" icon={Languages} accent="violet">
          <Field label="Cette langue est">
            <Select value={language1Tag} onChange={setLanguage1Tag} options={LANGUAGE_TAG_OPTIONS} placeholder="Sélectionner…" />
          </Field>
          <LanguageAbilities scores={language1} onChange={setLanguage1} />
          <p className="text-xs text-slate-500">
            Niveaux NCLC (Niveaux de compétence linguistique canadiens) équivalents à votre résultat IELTS,
            TEF Canada ou TCF Canada.
          </p>
        </Card>

        <Card title="Langue 2 (facultatif)" icon={Languages} accent="violet">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={hasLanguage2}
              onChange={(event) => setHasLanguage2(event.target.checked)}
            />
            J’ai passé un test dans une deuxième langue officielle
          </label>
          {hasLanguage2 && (
            <>
              <Field label="Cette langue est">
                <Select value={language2Tag} onChange={setLanguage2Tag} options={LANGUAGE_TAG_OPTIONS} placeholder="Sélectionner…" />
              </Field>
              <LanguageAbilities scores={language2} onChange={setLanguage2} />
            </>
          )}
        </Card>

        <Card title="Expérience professionnelle" icon={Briefcase} accent="amber">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expérience de travail qualifiée au Canada">
              <Select value={canadianExpYears} onChange={setCanadianExpYears} options={WORK_EXP_OPTIONS} placeholder="Sélectionner…" />
            </Field>
            <Field label="Expérience de travail qualifiée à l’étranger">
              <Select value={foreignExpYears} onChange={setForeignExpYears} options={FOREIGN_EXP_OPTIONS} placeholder="Sélectionner…" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={hasCertificateOfQualification}
              onChange={(event) => setHasCertificateOfQualification(event.target.checked)}
            />
            Je détiens un certificat de qualification d’un métier délivré par une province ou un territoire
          </label>
        </Card>

        {hasSpouse && (
          <Card title="Conjoint ou partenaire de fait" icon={Users} accent="rose">
            <Field label="Niveau de scolarité du conjoint">
              <Select value={spouseEducation} onChange={setSpouseEducation} options={EDUCATION_OPTIONS} placeholder="Sélectionner…" />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-slate-700">Langue officielle du conjoint</p>
              <LanguageAbilities scores={spouseLanguage} onChange={setSpouseLanguage} />
            </div>
            <Field label="Expérience de travail qualifiée du conjoint au Canada">
              <Select value={spouseCanadianExpYears} onChange={setSpouseCanadianExpYears} options={WORK_EXP_OPTIONS} placeholder="Sélectionner…" />
            </Field>
          </Card>
        )}

        <Card title="Points supplémentaires" icon={Sparkles} accent="emerald">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={hasProvincialNomination}
              onChange={(event) => setHasProvincialNomination(event.target.checked)}
            />
            Je détiens un certificat de désignation d’une province ou d’un territoire (+600)
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={hasSiblingInCanada}
              onChange={(event) => setHasSiblingInCanada(event.target.checked)}
            />
            J’ai un frère ou une sœur au Canada, citoyen ou résident permanent (+15)
          </label>
          <Field label="Études postsecondaires suivies au Canada">
            <Select value={canadianStudy} onChange={setCanadianStudy} options={CANADIAN_STUDY_OPTIONS} />
          </Field>
          <p className="text-xs text-slate-500">
            Les points pour une offre d’emploi arrangée ne sont plus attribués par IRCC depuis le 25 mars
            2025 — ils ne sont donc pas comptés ici.
          </p>
        </Card>
      </div>

      <div className="lg:order-2">
        {/* top offset clears the shrunk site header (3.5rem min-height +
            border + a few px of breathing room, see header[data-scrolled]
            in public.css) — the header shrinks after just 40px of scroll
            (public.js), so by the time this sidebar is stickying it's
            effectively always in that compact state. */}
        <div className="sticky top-16 grid gap-4">
          <div className="rounded-xl bg-brand-600 p-6 text-center text-white">
            <p className="text-xs font-bold tracking-widest uppercase opacity-80">Votre score estimé</p>
            <p className="mt-2 text-5xl font-extrabold tabular-nums">{score.total}</p>
            <p className="mt-1 text-sm opacity-80">sur 1 200 points</p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <RotateCcw size={15} aria-hidden="true" /> Réinitialiser le formulaire
          </button>
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
            <p className="font-bold text-slate-900">Détail du score</p>
            <dl className="mt-3 grid gap-2">
              <ScoreRow accent="sky" label="Capital humain (âge, études, langues, expérience)" value={score.coreHumanCapital} />
              {hasSpouse && <ScoreRow accent="rose" label="Facteurs du conjoint" value={score.spouseFactors} />}
              <ScoreRow accent="amber" label="Transférabilité des compétences" value={score.skillTransferability} />
              <ScoreRow accent="emerald" label="Points supplémentaires" value={score.additional} />
            </dl>
          </div>
          {drawRounds.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
              <p className="flex items-center gap-2 font-bold text-slate-900">
                <CalendarDays size={16} className="text-slate-400" aria-hidden="true" />
                Derniers tirages
              </p>
              <ul className="mt-3 grid gap-3">
                {drawRounds.map((round) => {
                  const qualifies = score.total >= round.crs_cutoff;
                  return (
                    <li key={`${round.draw_date}-${round.draw_type}`} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-700">
                          {new Date(round.draw_date).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="truncate text-xs text-slate-500">{round.draw_type}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="font-bold text-slate-900 tabular-nums">{round.crs_cutoff}</span>
                        {qualifies ? (
                          <CheckCircle2 size={15} className="text-emerald-600" aria-label="Score suffisant" />
                        ) : (
                          <XCircle size={15} className="text-slate-300" aria-label="Score insuffisant" />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <p className="text-xs leading-relaxed text-slate-500">
            Estimation basée sur la grille publique du Système de classement global (SCG) d’IRCC. Barème
            indicatif pouvant différer légèrement du calcul officiel — vérifiez toujours votre score exact
            depuis votre profil Entrée express.
          </p>
        </div>
      </div>
    </div>
    {showCompletionToast && (
      <Toast
        tone="success"
        message="Formulaire complet — voici votre score final estimé !"
        onClose={() => setShowCompletionToast(false)}
      />
    )}
    </>
  );
}

function ScoreRow({ label, value, accent }: { label: string; value: number; accent: Accent }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex items-center gap-2 text-slate-600">
        <span className={`size-1.5 shrink-0 rounded-full ${ACCENTS[accent].dot}`} aria-hidden="true" />
        {label}
      </dt>
      <dd className="shrink-0 font-bold text-slate-900 tabular-nums">{value}</dd>
    </div>
  );
}
