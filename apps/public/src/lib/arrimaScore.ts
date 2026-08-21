/**
 * Points calculator for Québec's Programme de sélection des travailleurs
 * qualifiés (PSTQ) — the grille de pondération behind Arrima's expression
 * of interest ranking. Distinct from and unrelated to the federal CRS
 * (crsScore.ts): different factors, different scales, and a candidate can
 * be assessed under both in parallel since Québec runs its own selection
 * separate from Entrée express.
 *
 * Values sourced from the ministère de l'Immigration, de la Francisation
 * et de l'Intégration's "Document explicatif de l'arrêté ministériel du
 * 20 juin 2025 et de l'erratum publié le 9 juillet 2025" (mis à jour le
 * 26 juin 2026) — the current official weighting document for the PSTQ,
 * cross-checked against the stated section maximums (520 + 700 + 180 =
 * 1400 total). IRCC-style caveat applies here too: Québec revises this
 * grid periodically — treat this as an estimation tool, not an official
 * score. English is not currently scored at all under the PSTQ.
 */

export type Ability = 'listening' | 'speaking' | 'reading' | 'writing';
export type FrenchScores = Record<Ability, number | null>;

export type EducationLevel =
  | 'secondary_general'
  | 'secondary_vocational_short'
  | 'secondary_vocational_long'
  | 'secondary_vocational_long_abroad'
  | 'postsecondary_general_2y'
  | 'postsecondary_technical_short'
  | 'postsecondary_technical_short_abroad'
  | 'postsecondary_technical_3y'
  | 'university_undergrad_1y'
  | 'university_undergrad_2y'
  | 'university_undergrad_3_4y'
  | 'university_undergrad_5y_plus'
  | 'university_grad_1y'
  | 'university_grad_2y_plus'
  | 'university_medical_specialization'
  | 'university_doctorate';

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  secondary_general: 'Secondaire général complété',
  secondary_vocational_short: 'Secondaire professionnel 600 à 899 h (diplôme du Québec)',
  secondary_vocational_long: 'Secondaire professionnel 900 h ou plus (diplôme du Québec)',
  secondary_vocational_long_abroad: 'Secondaire professionnel 1 an ou plus à temps plein (diplôme hors Québec)',
  postsecondary_general_2y: 'Postsecondaire général 2 ans à temps plein',
  postsecondary_technical_short: 'Postsecondaire technique 900 h ou plus (diplôme du Québec)',
  postsecondary_technical_short_abroad: 'Postsecondaire technique 1 ou 2 ans à temps plein (diplôme hors Québec)',
  postsecondary_technical_3y: 'Postsecondaire technique 3 ans à temps plein',
  university_undergrad_1y: 'Universitaire 1er cycle 1 an à temps plein',
  university_undergrad_2y: 'Universitaire 1er cycle 2 ans à temps plein',
  university_undergrad_3_4y: 'Universitaire 1er cycle 3 ou 4 ans à temps plein',
  university_undergrad_5y_plus: 'Universitaire 1er cycle 5 ans ou plus à temps plein',
  university_grad_1y: 'Universitaire 2e cycle 1 an à temps plein',
  university_grad_2y_plus: 'Universitaire 2e cycle 2 ans ou plus à temps plein',
  university_medical_specialization: 'Universitaire — spécialisation médicale 2 ans ou plus',
  university_doctorate: 'Universitaire 3e cycle (doctorat)',
};

// "…hors Québec" tiers can never score points on the Diplôme du Québec
// table by definition — excluded there via QUEBEC_DIPLOMA_POINTS lookup
// returning 0 for any key it doesn't list.
const EDUCATION_POINTS: Record<EducationLevel, { single: number; withSpouse: number }> = {
  secondary_general: { single: 13, withSpouse: 11 },
  secondary_vocational_short: { single: 13, withSpouse: 11 },
  secondary_vocational_long: { single: 26, withSpouse: 22 },
  secondary_vocational_long_abroad: { single: 26, withSpouse: 22 },
  postsecondary_general_2y: { single: 39, withSpouse: 33 },
  postsecondary_technical_short: { single: 52, withSpouse: 44 },
  postsecondary_technical_short_abroad: { single: 52, withSpouse: 44 },
  postsecondary_technical_3y: { single: 78, withSpouse: 66 },
  university_undergrad_1y: { single: 78, withSpouse: 66 },
  university_undergrad_2y: { single: 91, withSpouse: 77 },
  university_undergrad_3_4y: { single: 104, withSpouse: 88 },
  university_undergrad_5y_plus: { single: 110, withSpouse: 93 },
  university_grad_1y: { single: 110, withSpouse: 93 },
  university_grad_2y_plus: { single: 117, withSpouse: 99 },
  university_medical_specialization: { single: 130, withSpouse: 110 },
  university_doctorate: { single: 130, withSpouse: 110 },
};

const QUEBEC_DIPLOMA_POINTS: Partial<Record<EducationLevel, number>> = {
  secondary_general: 20,
  secondary_vocational_short: 20,
  secondary_vocational_long: 40,
  postsecondary_general_2y: 60,
  postsecondary_technical_short: 80,
  postsecondary_technical_3y: 120,
  university_undergrad_1y: 120,
  university_undergrad_2y: 140,
  university_undergrad_3_4y: 160,
  university_undergrad_5y_plus: 170,
  university_grad_1y: 170,
  university_grad_2y_plus: 180,
  university_medical_specialization: 200,
  university_doctorate: 200,
};

const SPOUSE_EDUCATION_POINTS: Record<EducationLevel, number> = {
  secondary_general: 2,
  secondary_vocational_short: 2,
  secondary_vocational_long: 4,
  secondary_vocational_long_abroad: 4,
  postsecondary_general_2y: 6,
  postsecondary_technical_short: 8,
  postsecondary_technical_short_abroad: 8,
  postsecondary_technical_3y: 12,
  university_undergrad_1y: 12,
  university_undergrad_2y: 14,
  university_undergrad_3_4y: 16,
  university_undergrad_5y_plus: 17,
  university_grad_1y: 17,
  university_grad_2y_plus: 18,
  university_medical_specialization: 20,
  university_doctorate: 20,
};

const SPOUSE_QUEBEC_DIPLOMA_POINTS: Partial<Record<EducationLevel, number>> = {
  secondary_general: 3,
  secondary_vocational_short: 3,
  secondary_vocational_long: 6,
  postsecondary_general_2y: 9,
  postsecondary_technical_short: 12,
  postsecondary_technical_3y: 18,
  university_undergrad_1y: 18,
  university_undergrad_2y: 21,
  university_undergrad_3_4y: 24,
  university_undergrad_5y_plus: 25,
  university_grad_1y: 25,
  university_grad_2y_plus: 27,
  university_medical_specialization: 30,
  university_doctorate: 30,
};

// Two different month-bucketing schemes are used across the grid: most
// factors split at 12/24/36/48 months, but several (outside-CMM
// residence/work/study, spouse Québec experience, study-without-diploma)
// carry an extra split at 6 months. Mixing them up under one bucket type
// would silently misprice those factors, so they're kept distinct.
export type MonthsBucket5 = 0 | 12 | 24 | 36 | 48;
export type MonthsBucket6 = 0 | 6 | 12 | 24 | 36 | 48;
export type LaborDiagnosis = 'balanced' | 'slight_shortage' | 'shortage';
export type JobOfferLocation = 'none' | 'outside_cmm' | 'inside_cmm';
export type RelativeInQuebec = 'none' | 'principal' | 'spouse';

export interface ArrimaInput {
  hasSpouse: boolean | null;
  age: number | null;
  french: FrenchScores;
  education: EducationLevel | null;
  hasQuebecDiploma: boolean;
  generalExpMonths: MonthsBucket5 | null;
  laborDiagnosis: LaborDiagnosis | null;
  principalOccupationExpMonths: MonthsBucket5 | null;
  quebecExpMonths: MonthsBucket5 | null;
  residenceOutsideCmmMonths: MonthsBucket6 | null;
  workOutsideCmmMonths: MonthsBucket6 | null;
  studyOutsideCmmMonths: MonthsBucket6 | null;
  jobOffer: JobOfferLocation;
  hasProfessionalRecognition: boolean;
  studyNoDiplomaMonths: MonthsBucket6 | null;
  studyNoDiplomaOngoing: boolean;
  relativeInQuebec: RelativeInQuebec;
  spouseFrench: FrenchScores;
  spouseAge: number | null;
  spouseEducation: EducationLevel | null;
  spouseHasQuebecDiploma: boolean;
  spouseQuebecExpMonths: MonthsBucket6 | null;
}

export interface ArrimaBreakdown {
  french: number;
  age: number;
  experience: number;
  education: number;
  humanCapital: number;
  laborDiagnosis: number;
  quebecDiploma: number;
  quebecExperience: number;
  outsideCmm: number;
  jobOffer: number;
  professionalRecognition: number;
  quebecNeeds: number;
  studyNoDiploma: number;
  relative: number;
  spouseFactors: number;
  adaptation: number;
  total: number;
}

const ABILITIES: Ability[] = ['listening', 'speaking', 'reading', 'writing'];

function sumAbilities(scores: FrenchScores, perAbility: (level: number) => number): number {
  return ABILITIES.reduce((total, ability) => total + perAbility(scores[ability] ?? 0), 0);
}

function frenchAbilityPoints(level: number, hasSpouse: boolean): number {
  if (level < 5) return 0;
  if (level <= 6) return hasSpouse ? 30 : 38;
  if (level <= 8) return hasSpouse ? 35 : 44;
  return hasSpouse ? 40 : 50;
}

function spouseFrenchAbilityPoints(level: number): number {
  if (level < 4) return 0;
  if (level === 4) return 4;
  if (level <= 6) return 6;
  if (level <= 8) return 8;
  return 10;
}

function ageScore(age: number, hasSpouse: boolean): number {
  if (age < 18 || age >= 45) return 0;
  if (age <= 19) return hasSpouse ? 90 : 110;
  if (age <= 30) return hasSpouse ? 100 : 120;
  const single: Record<number, number> = {
    31: 110, 32: 100, 33: 90, 34: 80, 35: 75, 36: 70, 37: 65, 38: 60,
    39: 55, 40: 50, 41: 40, 42: 30, 43: 20, 44: 10,
  };
  const withSpouse: Record<number, number> = {
    31: 95, 32: 90, 33: 81, 34: 72, 35: 68, 36: 63, 37: 59, 38: 54,
    39: 50, 40: 45, 41: 36, 42: 27, 43: 18, 44: 9,
  };
  return (hasSpouse ? withSpouse : single)[age] ?? 0;
}

function spouseAgeScore(age: number): number {
  if (age < 16 || age >= 45) return 0;
  if (age <= 19) return 18;
  if (age <= 30) return 20;
  const table: Record<number, number> = {
    31: 18, 32: 17, 33: 16, 34: 15, 35: 14, 36: 12, 37: 10, 38: 8,
    39: 7, 40: 6, 41: 5, 42: 4, 43: 3, 44: 2,
  };
  return table[age] ?? 0;
}

function monthsIndex5(months: MonthsBucket5): 0 | 1 | 2 | 3 | 4 {
  if (months < 12) return 0;
  if (months < 24) return 1;
  if (months < 36) return 2;
  if (months < 48) return 3;
  return 4;
}

function bucketPoints5(months: MonthsBucket5, tiers: [number, number, number, number, number]): number {
  return tiers[monthsIndex5(months)];
}

function monthsIndex6(months: MonthsBucket6): 0 | 1 | 2 | 3 | 4 | 5 {
  if (months < 6) return 0;
  if (months < 12) return 1;
  if (months < 24) return 2;
  if (months < 36) return 3;
  if (months < 48) return 4;
  return 5;
}

function bucketPoints6(months: MonthsBucket6, tiers: [number, number, number, number, number, number]): number {
  return tiers[monthsIndex6(months)];
}

function experiencePoints(months: MonthsBucket5, hasSpouse: boolean): number {
  return bucketPoints5(months, hasSpouse ? [0, 15, 30, 35, 50] : [0, 20, 40, 50, 70]);
}

function laborDiagnosisPoints(diagnosis: LaborDiagnosis | null, months: MonthsBucket5): number {
  if (!diagnosis || months < 12) return 0;
  const tiers: Record<LaborDiagnosis, [number, number, number, number, number]> = {
    balanced: [0, 5, 10, 15, 25],
    slight_shortage: [0, 70, 80, 90, 100],
    shortage: [0, 90, 100, 110, 120],
  };
  return bucketPoints5(months, tiers[diagnosis]);
}

function quebecExperiencePoints(months: MonthsBucket5): number {
  return bucketPoints5(months, [0, 40, 80, 120, 160]);
}

function residenceOutsideCmmPoints(months: MonthsBucket6): number {
  return bucketPoints6(months, [0, 6, 16, 24, 32, 40]);
}

function workOutsideCmmPoints(months: MonthsBucket6): number {
  return bucketPoints6(months, [0, 9, 24, 36, 48, 60]);
}

function studyOutsideCmmPoints(months: MonthsBucket6): number {
  return bucketPoints6(months, [0, 3, 8, 12, 16, 20]);
}

function studyNoDiplomaPoints(months: MonthsBucket6, ongoing: boolean): number {
  return bucketPoints6(months, ongoing ? [0, 5, 12, 18, 24, 30] : [0, 1, 3, 5, 8, 10]);
}

function spouseQuebecExperiencePoints(months: MonthsBucket6): number {
  return bucketPoints6(months, [0, 5, 10, 15, 23, 30]);
}

export function calculateArrimaScore(input: ArrimaInput): ArrimaBreakdown {
  const hasSpouse = input.hasSpouse === true;

  const french = sumAbilities(input.french, (level) => frenchAbilityPoints(level, hasSpouse));
  const age = ageScore(input.age ?? 0, hasSpouse);
  const experience = experiencePoints(input.generalExpMonths ?? 0, hasSpouse);
  const education = input.education
    ? EDUCATION_POINTS[input.education][hasSpouse ? 'withSpouse' : 'single']
    : 0;
  const humanCapital = french + age + experience + education;

  const laborDiagnosisPts = laborDiagnosisPoints(input.laborDiagnosis, input.principalOccupationExpMonths ?? 0);
  const quebecDiploma =
    input.hasQuebecDiploma && input.education ? (QUEBEC_DIPLOMA_POINTS[input.education] ?? 0) : 0;
  const quebecExperience = quebecExperiencePoints(input.quebecExpMonths ?? 0);
  const outsideCmm =
    residenceOutsideCmmPoints(input.residenceOutsideCmmMonths ?? 0) +
    workOutsideCmmPoints(input.workOutsideCmmMonths ?? 0) +
    studyOutsideCmmPoints(input.studyOutsideCmmMonths ?? 0);
  const jobOffer = input.jobOffer === 'outside_cmm' ? 50 : input.jobOffer === 'inside_cmm' ? 30 : 0;
  const professionalRecognition = input.hasProfessionalRecognition ? 50 : 0;
  const quebecNeeds = laborDiagnosisPts + quebecDiploma + quebecExperience + outsideCmm + jobOffer + professionalRecognition;

  const studyNoDiploma = studyNoDiplomaPoints(input.studyNoDiplomaMonths ?? 0, input.studyNoDiplomaOngoing);
  const relative = input.relativeInQuebec === 'principal' ? 10 : input.relativeInQuebec === 'spouse' ? 5 : 0;

  let spouseFactors = 0;
  if (hasSpouse) {
    const spouseFrench = sumAbilities(input.spouseFrench, spouseFrenchAbilityPoints);
    const spouseAge = spouseAgeScore(input.spouseAge ?? 0);
    const spouseExp = spouseQuebecExperiencePoints(input.spouseQuebecExpMonths ?? 0);
    const spouseEducationPts = input.spouseEducation ? SPOUSE_EDUCATION_POINTS[input.spouseEducation] : 0;
    const spouseQuebecDiploma =
      input.spouseHasQuebecDiploma && input.spouseEducation
        ? (SPOUSE_QUEBEC_DIPLOMA_POINTS[input.spouseEducation] ?? 0)
        : 0;
    spouseFactors = spouseFrench + spouseAge + spouseExp + spouseEducationPts + spouseQuebecDiploma;
  }
  const adaptation = studyNoDiploma + relative + spouseFactors;

  const total = humanCapital + quebecNeeds + adaptation;

  return {
    french,
    age,
    experience,
    education,
    humanCapital,
    laborDiagnosis: laborDiagnosisPts,
    quebecDiploma,
    quebecExperience,
    outsideCmm,
    jobOffer,
    professionalRecognition,
    quebecNeeds,
    studyNoDiploma,
    relative,
    spouseFactors,
    adaptation,
    total,
  };
}

export const FRENCH_LEVELS = Array.from({ length: 12 }, (_, i) => i + 1);
export const MONTHS_OPTIONS_5: { value: MonthsBucket5; label: string }[] = [
  { value: 0, label: 'Moins de 12 mois' },
  { value: 12, label: '12 à 23 mois' },
  { value: 24, label: '24 à 35 mois' },
  { value: 36, label: '36 à 47 mois' },
  { value: 48, label: '48 mois ou plus' },
];
export const MONTHS_OPTIONS_6: { value: MonthsBucket6; label: string }[] = [
  { value: 0, label: '0 à 5 mois' },
  { value: 6, label: '6 à 11 mois' },
  { value: 12, label: '12 à 23 mois' },
  { value: 24, label: '24 à 35 mois' },
  { value: 36, label: '36 à 47 mois' },
  { value: 48, label: '48 mois ou plus' },
];
