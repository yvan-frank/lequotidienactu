import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  Briefcase,
  Building2,
  CalendarDays,
  GraduationCap,
  Languages,
  MapPin,
  RotateCcw,
  User,
  Users,
  type LucideProps,
} from 'lucide-react';
import {
  calculateArrimaScore,
  EDUCATION_LABELS,
  FRENCH_LEVELS,
  MONTHS_OPTIONS_5,
  MONTHS_OPTIONS_6,
  type Ability,
  type ArrimaInput,
  type EducationLevel,
  type FrenchScores,
  type JobOfferLocation,
  type LaborDiagnosis,
  type MonthsBucket5,
  type MonthsBucket6,
  type RelativeInQuebec,
} from '../lib/arrimaScore';
import { Select, type SelectOption } from './Select';
import { Toast } from './Toast';

const ABILITY_LABELS: Record<Ability, string> = {
  listening: 'Compréhension orale',
  speaking: 'Production orale',
  reading: 'Compréhension écrite',
  writing: 'Production écrite',
};
const ABILITIES: Ability[] = ['listening', 'speaking', 'reading', 'writing'];
const emptyFrench: FrenchScores = { listening: null, speaking: null, reading: null, writing: null };

const FRENCH_OPTIONS: SelectOption<number>[] = FRENCH_LEVELS.map((level) => ({
  value: level,
  label: `Niveau ${level}`,
}));

const EDUCATION_OPTIONS: SelectOption<EducationLevel>[] = Object.entries(EDUCATION_LABELS).map(
  ([value, label]) => ({ value: value as EducationLevel, label }),
);

const AGE_OPTIONS: SelectOption<number>[] = [
  ...Array.from({ length: 44 }, (_, i) => ({ value: i + 1, label: `${i + 1} an${i + 1 > 1 ? 's' : ''}` })),
  { value: 45, label: '45 ans ou plus' },
];

const FAMILY_OPTIONS: SelectOption<'0' | '1'>[] = [
  { value: '0', label: 'Célibataire, ou conjoint qui n’immigre pas avec moi' },
  { value: '1', label: 'Conjoint ou partenaire qui immigre avec moi' },
];

const MONTHS5_OPTIONS: SelectOption<MonthsBucket5>[] = MONTHS_OPTIONS_5;
const MONTHS6_OPTIONS: SelectOption<MonthsBucket6>[] = MONTHS_OPTIONS_6;

const LABOR_DIAGNOSIS_OPTIONS: SelectOption<LaborDiagnosis>[] = [
  { value: 'balanced', label: 'En équilibre / sans diagnostic' },
  { value: 'slight_shortage', label: 'Léger déficit de main-d’œuvre' },
  { value: 'shortage', label: 'Déficit de main-d’œuvre' },
];

const JOB_OFFER_OPTIONS: SelectOption<JobOfferLocation>[] = [
  { value: 'none', label: 'Aucune offre validée' },
  { value: 'inside_cmm', label: 'Dans la Communauté métropolitaine de Montréal (CMM)' },
  { value: 'outside_cmm', label: 'À l’extérieur de la CMM' },
];

const RELATIVE_OPTIONS: SelectOption<RelativeInQuebec>[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'principal', label: 'Lié(e) à moi (époux, enfant, parent, frère, sœur, grand-parent)' },
  { value: 'spouse', label: 'Lié(e) à mon conjoint' },
];

type Accent = 'sky' | 'violet' | 'amber' | 'rose' | 'emerald' | 'indigo';
const ACCENTS: Record<Accent, { bar: string; chip: string; dot: string }> = {
  sky: { bar: 'border-sky-400', chip: 'bg-sky-100 text-sky-600', dot: 'bg-sky-500' },
  violet: { bar: 'border-violet-400', chip: 'bg-violet-100 text-violet-600', dot: 'bg-violet-500' },
  amber: { bar: 'border-amber-400', chip: 'bg-amber-100 text-amber-600', dot: 'bg-amber-500' },
  rose: { bar: 'border-rose-400', chip: 'bg-rose-100 text-rose-600', dot: 'bg-rose-500' },
  emerald: { bar: 'border-emerald-400', chip: 'bg-emerald-100 text-emerald-600', dot: 'bg-emerald-500' },
  indigo: { bar: 'border-indigo-400', chip: 'bg-indigo-100 text-indigo-600', dot: 'bg-indigo-500' },
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
    <section className={`rounded-xl border border-l-4 border-slate-200 bg-white p-2 sm:p-6 ${colors.bar}`}>
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
  // A <div>, not <label> — see Select.tsx: wrapping its button in a <label>
  // forwards every click inside it to the button as an implicit second
  // click, reopening the dropdown right after a selection.
  return (
    <div className="grid gap-1.5 text-sm font-semibold text-slate-700">
      {label}
      {children}
    </div>
  );
}

function FrenchAbilities({ scores, onChange }: { scores: FrenchScores; onChange: (scores: FrenchScores) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ABILITIES.map((ability) => (
        <div key={ability} className="grid gap-1 text-xs font-semibold text-slate-500">
          {ABILITY_LABELS[ability]}
          <Select
            ariaLabel={ABILITY_LABELS[ability]}
            value={scores[ability]}
            onChange={(level) => onChange({ ...scores, [ability]: level })}
            options={FRENCH_OPTIONS}
            placeholder="Niveau ?"
          />
        </div>
      ))}
    </div>
  );
}

export function ArrimaCalculator() {
  const [hasSpouse, setHasSpouse] = useState<boolean | null>(null);
  const [age, setAge] = useState<number | null>(null);
  const [french, setFrench] = useState<FrenchScores>(emptyFrench);
  const [education, setEducation] = useState<EducationLevel | null>(null);
  const [hasQuebecDiploma, setHasQuebecDiploma] = useState(false);
  const [generalExpMonths, setGeneralExpMonths] = useState<MonthsBucket5 | null>(null);
  const [laborDiagnosis, setLaborDiagnosis] = useState<LaborDiagnosis | null>(null);
  const [principalOccupationExpMonths, setPrincipalOccupationExpMonths] = useState<MonthsBucket5 | null>(null);
  const [quebecExpMonths, setQuebecExpMonths] = useState<MonthsBucket5 | null>(null);
  const [residenceOutsideCmmMonths, setResidenceOutsideCmmMonths] = useState<MonthsBucket6 | null>(null);
  const [workOutsideCmmMonths, setWorkOutsideCmmMonths] = useState<MonthsBucket6 | null>(null);
  const [studyOutsideCmmMonths, setStudyOutsideCmmMonths] = useState<MonthsBucket6 | null>(null);
  const [jobOffer, setJobOffer] = useState<JobOfferLocation>('none');
  const [hasProfessionalRecognition, setHasProfessionalRecognition] = useState(false);
  const [studyNoDiplomaMonths, setStudyNoDiplomaMonths] = useState<MonthsBucket6 | null>(null);
  const [studyNoDiplomaOngoing, setStudyNoDiplomaOngoing] = useState(false);
  const [relativeInQuebec, setRelativeInQuebec] = useState<RelativeInQuebec>('none');
  const [spouseFrench, setSpouseFrench] = useState<FrenchScores>(emptyFrench);
  const [spouseAge, setSpouseAge] = useState<number | null>(null);
  const [spouseEducation, setSpouseEducation] = useState<EducationLevel | null>(null);
  const [spouseHasQuebecDiploma, setSpouseHasQuebecDiploma] = useState(false);
  const [spouseQuebecExpMonths, setSpouseQuebecExpMonths] = useState<MonthsBucket6 | null>(null);

  const reset = () => {
    setHasSpouse(null);
    setAge(null);
    setFrench(emptyFrench);
    setEducation(null);
    setHasQuebecDiploma(false);
    setGeneralExpMonths(null);
    setLaborDiagnosis(null);
    setPrincipalOccupationExpMonths(null);
    setQuebecExpMonths(null);
    setResidenceOutsideCmmMonths(null);
    setWorkOutsideCmmMonths(null);
    setStudyOutsideCmmMonths(null);
    setJobOffer('none');
    setHasProfessionalRecognition(false);
    setStudyNoDiplomaMonths(null);
    setStudyNoDiplomaOngoing(false);
    setRelativeInQuebec('none');
    setSpouseFrench(emptyFrench);
    setSpouseAge(null);
    setSpouseEducation(null);
    setSpouseHasQuebecDiploma(false);
    setSpouseQuebecExpMonths(null);
  };

  const frenchComplete = ABILITIES.every((ability) => french[ability] !== null);
  const spouseComplete =
    !hasSpouse ||
    (spouseAge !== null &&
      spouseEducation !== null &&
      spouseQuebecExpMonths !== null &&
      ABILITIES.every((ability) => spouseFrench[ability] !== null));
  const isComplete =
    hasSpouse !== null &&
    age !== null &&
    frenchComplete &&
    education !== null &&
    generalExpMonths !== null &&
    quebecExpMonths !== null &&
    residenceOutsideCmmMonths !== null &&
    workOutsideCmmMonths !== null &&
    studyOutsideCmmMonths !== null &&
    studyNoDiplomaMonths !== null &&
    spouseComplete;

  const [showCompletionToast, setShowCompletionToast] = useState(false);
  const wasCompleteRef = useRef(false);
  useEffect(() => {
    if (isComplete && !wasCompleteRef.current) setShowCompletionToast(true);
    wasCompleteRef.current = isComplete;
  }, [isComplete]);

  const input: ArrimaInput = {
    hasSpouse,
    age,
    french,
    education,
    hasQuebecDiploma,
    generalExpMonths,
    laborDiagnosis,
    principalOccupationExpMonths,
    quebecExpMonths,
    residenceOutsideCmmMonths,
    workOutsideCmmMonths,
    studyOutsideCmmMonths,
    jobOffer,
    hasProfessionalRecognition,
    studyNoDiplomaMonths,
    studyNoDiplomaOngoing,
    relativeInQuebec,
    spouseFrench,
    spouseAge,
    spouseEducation,
    spouseHasQuebecDiploma,
    spouseQuebecExpMonths,
  };

  const score = useMemo(() => calculateArrimaScore(input), [JSON.stringify(input)]);

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
          </Card>

          <Card title="Connaissance du français" icon={Languages} accent="violet">
            <FrenchAbilities scores={french} onChange={setFrench} />
            <p className="text-xs text-slate-500">
              Niveaux selon l’Échelle québécoise des niveaux de compétence en français (1 à 12),
              équivalents à votre résultat au TCF-Québec, TEF Canada, DELF/DALF ou test reconnu. Le PSTQ
              n’attribue actuellement aucun point à l’anglais.
            </p>
          </Card>

          <Card title="Études" icon={GraduationCap} accent="amber">
            <Field label="Niveau de scolarité le plus élevé">
              <Select value={education} onChange={setEducation} options={EDUCATION_OPTIONS} placeholder="Sélectionner…" />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={hasQuebecDiploma}
                onChange={(event) => setHasQuebecDiploma(event.target.checked)}
              />
              Ce diplôme a été obtenu au Québec
            </label>
          </Card>

          <Card title="Expérience de travail" icon={Briefcase} accent="rose">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Expérience de travail totale (5 dernières années)">
                <Select value={generalExpMonths} onChange={setGeneralExpMonths} options={MONTHS5_OPTIONS} placeholder="Sélectionner…" />
              </Field>
              <Field label="Expérience de travail au Québec">
                <Select value={quebecExpMonths} onChange={setQuebecExpMonths} options={MONTHS5_OPTIONS} placeholder="Sélectionner…" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Diagnostic de main-d’œuvre de votre profession principale">
                <Select value={laborDiagnosis} onChange={setLaborDiagnosis} options={LABOR_DIAGNOSIS_OPTIONS} placeholder="Sélectionner…" />
              </Field>
              <Field label="Expérience dans cette profession">
                <Select value={principalOccupationExpMonths} onChange={setPrincipalOccupationExpMonths} options={MONTHS5_OPTIONS} placeholder="Sélectionner…" />
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              Le diagnostic de votre profession se vérifie sur la liste officielle des diagnostics de
              main-d’œuvre d’IMT en ligne (516 professions). Sans diagnostic connu, choisissez « en
              équilibre ».
            </p>
          </Card>

          <Card title="Séjour hors de la région de Montréal (CMM)" icon={MapPin} accent="emerald">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Durée de résidence hors CMM">
                <Select value={residenceOutsideCmmMonths} onChange={setResidenceOutsideCmmMonths} options={MONTHS6_OPTIONS} placeholder="Sélectionner…" />
              </Field>
              <Field label="Durée de travail hors CMM">
                <Select value={workOutsideCmmMonths} onChange={setWorkOutsideCmmMonths} options={MONTHS6_OPTIONS} placeholder="Sélectionner…" />
              </Field>
              <Field label="Durée d’études hors CMM">
                <Select value={studyOutsideCmmMonths} onChange={setStudyOutsideCmmMonths} options={MONTHS6_OPTIONS} placeholder="Sélectionner…" />
              </Field>
            </div>
          </Card>

          <Card title="Emploi et reconnaissance professionnelle" icon={Building2} accent="indigo">
            <Field label="Offre d’emploi validée dans votre profession principale">
              <Select value={jobOffer} onChange={setJobOffer} options={JOB_OFFER_OPTIONS} />
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={hasProfessionalRecognition}
                onChange={(event) => setHasProfessionalRecognition(event.target.checked)}
              />
              J’ai une autorisation d’exercer, ou une reconnaissance partielle/complète de mon diplôme,
              par un ordre professionnel du Québec
            </label>
          </Card>

          <Card title="Séjour d’études et famille au Québec" icon={CalendarDays} accent="sky">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Durée d’un séjour d’études SANS diplôme obtenu au Québec">
                <Select value={studyNoDiplomaMonths} onChange={setStudyNoDiplomaMonths} options={MONTHS6_OPTIONS} placeholder="Sélectionner…" />
              </Field>
              <Field label="Ce séjour est">
                <Select
                  value={studyNoDiplomaOngoing ? 'ongoing' : 'done'}
                  onChange={(value) => setStudyNoDiplomaOngoing(value === 'ongoing')}
                  options={[
                    { value: 'done', label: 'Terminé' },
                    { value: 'ongoing', label: 'En cours' },
                  ]}
                />
              </Field>
            </div>
            <Field label="Membre de votre famille établi au Québec (18 ans ou plus, résident permanent ou citoyen)">
              <Select value={relativeInQuebec} onChange={setRelativeInQuebec} options={RELATIVE_OPTIONS} />
            </Field>
          </Card>

          {hasSpouse && (
            <Card title="Conjoint ou partenaire de fait" icon={Users} accent="violet">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Âge du conjoint">
                  <Select value={spouseAge} onChange={setSpouseAge} options={AGE_OPTIONS} placeholder="Sélectionner…" />
                </Field>
                <Field label="Niveau de scolarité du conjoint">
                  <Select value={spouseEducation} onChange={setSpouseEducation} options={EDUCATION_OPTIONS} placeholder="Sélectionner…" />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={spouseHasQuebecDiploma}
                  onChange={(event) => setSpouseHasQuebecDiploma(event.target.checked)}
                />
                Ce diplôme a été obtenu au Québec
              </label>
              <div>
                <p className="mb-1.5 text-sm font-semibold text-slate-700">Connaissance du français du conjoint</p>
                <FrenchAbilities scores={spouseFrench} onChange={setSpouseFrench} />
              </div>
              <Field label="Expérience de travail du conjoint au Québec">
                <Select value={spouseQuebecExpMonths} onChange={setSpouseQuebecExpMonths} options={MONTHS6_OPTIONS} placeholder="Sélectionner…" />
              </Field>
            </Card>
          )}
        </div>

        <div className="lg:order-2">
          {/* top offset clears the shrunk site header — see the CRS
              calculator (CrsCalculator.tsx) for the full explanation. */}
          <div className="sticky top-16 grid gap-4">
            <div className="rounded-xl bg-brand-600 p-6 text-center text-white">
              <p className="text-xs font-bold tracking-widest uppercase opacity-80">Votre score estimé</p>
              <p className="mt-2 text-5xl font-extrabold tabular-nums">{score.total}</p>
              <p className="mt-1 text-sm opacity-80">sur 1 400 points</p>
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
                <ScoreRow accent="sky" label="Capital humain (français, âge, expérience, études)" value={score.humanCapital} />
                <ScoreRow accent="amber" label="Besoins du Québec et priorités" value={score.quebecNeeds} />
                <ScoreRow accent="emerald" label="Facteurs d’adaptation" value={score.adaptation} />
              </dl>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Estimation basée sur la grille de pondération du Programme de sélection des travailleurs
              qualifiés (PSTQ), arrêté ministériel du 20 juin 2025. Barème indicatif pouvant différer du
              calcul officiel via Arrima — vérifiez toujours votre pointage exact dans votre déclaration
              d’intérêt.
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
