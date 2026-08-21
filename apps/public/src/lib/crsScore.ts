/**
 * Comprehensive Ranking System (CRS) point calculator — the grille SCG
 * (Système de Classement Global) used by Immigration, Réfugiés et
 * Citoyenneté Canada (IRCC) to rank Entrée express profiles.
 *
 * Values are sourced from IRCC's published CRS grid and cross-checked
 * against the officially-stated section maximums (500 pts without spouse,
 * 460 pts with spouse for core human capital + spouse factors combined,
 * 100 pts skill transferability cap, 600 pts provincial nomination, etc.).
 * IRCC updates this grid occasionally (e.g. arranged employment points
 * were reduced to 0 as of March 25, 2025) — treat this as an estimation
 * tool, not an official score.
 */

export type EducationLevel =
  | 'less_than_secondary'
  | 'secondary'
  | 'one_year'
  | 'two_year'
  | 'three_year_plus'
  | 'two_or_more_credentials'
  | 'masters'
  | 'doctorate';

export type Ability = 'listening' | 'speaking' | 'reading' | 'writing';
export type ClbScores = Record<Ability, number>;
export type LanguageTag = 'french' | 'english' | 'other';
export type CanadianExpYears = 0 | 1 | 2 | 3 | 4 | 5;
export type ForeignExpYears = 0 | 1 | 3;

export interface CrsInput {
  age: number;
  hasSpouse: boolean;
  education: EducationLevel;
  canadianExpYears: CanadianExpYears;
  foreignExpYears: ForeignExpYears;
  hasCertificateOfQualification: boolean;
  language1: ClbScores;
  language1Tag: LanguageTag;
  hasLanguage2: boolean;
  language2: ClbScores;
  language2Tag: LanguageTag;
  hasProvincialNomination: boolean;
  hasSiblingInCanada: boolean;
  canadianStudy: 'none' | 'one_or_two_years' | 'three_years_plus';
  spouseEducation: EducationLevel;
  spouseLanguage: ClbScores;
  spouseCanadianExpYears: CanadianExpYears;
}

export interface CrsBreakdown {
  age: number;
  education: number;
  firstLanguage: number;
  secondLanguage: number;
  canadianExperience: number;
  frenchBonus: number;
  coreHumanCapital: number;
  spouseEducation: number;
  spouseLanguage: number;
  spouseCanadianExperience: number;
  spouseFactors: number;
  skillTransferability: number;
  additional: number;
  total: number;
}

const ABILITIES: Ability[] = ['listening', 'speaking', 'reading', 'writing'];

function minAbility(scores: ClbScores): number {
  return Math.min(...ABILITIES.map((ability) => scores[ability] ?? 0));
}

function sumAbilities(scores: ClbScores, perAbility: (clb: number) => number): number {
  return ABILITIES.reduce((total, ability) => total + perAbility(scores[ability] ?? 0), 0);
}

function ageScore(age: number, hasSpouse: boolean): number {
  if (age <= 17 || age >= 45) return 0;
  if (age >= 20 && age <= 29) return hasSpouse ? 100 : 110;
  const withSpouse: Record<number, number> = {
    18: 90, 19: 95, 30: 95, 31: 90, 32: 85, 33: 80, 34: 75, 35: 70,
    36: 65, 37: 60, 38: 55, 39: 50, 40: 45, 41: 35, 42: 25, 43: 15, 44: 5,
  };
  const single: Record<number, number> = {
    18: 99, 19: 105, 30: 105, 31: 99, 32: 94, 33: 88, 34: 83, 35: 77,
    36: 72, 37: 66, 38: 61, 39: 55, 40: 50, 41: 39, 42: 28, 43: 17, 44: 6,
  };
  return (hasSpouse ? withSpouse : single)[age] ?? 0;
}

const EDUCATION_POINTS: Record<EducationLevel, { withSpouse: number; single: number }> = {
  less_than_secondary: { withSpouse: 0, single: 0 },
  secondary: { withSpouse: 28, single: 30 },
  one_year: { withSpouse: 84, single: 90 },
  two_year: { withSpouse: 91, single: 98 },
  three_year_plus: { withSpouse: 112, single: 120 },
  two_or_more_credentials: { withSpouse: 119, single: 128 },
  masters: { withSpouse: 126, single: 135 },
  doctorate: { withSpouse: 140, single: 150 },
};

const SPOUSE_EDUCATION_POINTS: Record<EducationLevel, number> = {
  less_than_secondary: 0,
  secondary: 2,
  one_year: 6,
  two_year: 7,
  three_year_plus: 8,
  two_or_more_credentials: 9,
  masters: 10,
  doctorate: 10,
};

function firstLanguageAbilityPoints(clb: number, hasSpouse: boolean): number {
  if (clb < 4) return 0;
  if (clb <= 5) return 6;
  if (clb === 6) return hasSpouse ? 8 : 9;
  if (clb === 7) return hasSpouse ? 16 : 17;
  if (clb === 8) return hasSpouse ? 22 : 23;
  if (clb === 9) return hasSpouse ? 29 : 31;
  return hasSpouse ? 32 : 34;
}

function secondLanguageAbilityPoints(clb: number): number {
  if (clb < 5) return 0;
  if (clb <= 6) return 1;
  if (clb <= 8) return 3;
  return 6;
}

function spouseLanguageAbilityPoints(clb: number): number {
  if (clb < 5) return 0;
  if (clb <= 6) return 1;
  if (clb <= 8) return 3;
  return 5;
}

const CANADIAN_EXP_POINTS: Record<CanadianExpYears, { withSpouse: number; single: number }> = {
  0: { withSpouse: 0, single: 0 },
  1: { withSpouse: 35, single: 40 },
  2: { withSpouse: 46, single: 53 },
  3: { withSpouse: 56, single: 64 },
  4: { withSpouse: 63, single: 72 },
  5: { withSpouse: 70, single: 80 },
};

const SPOUSE_CANADIAN_EXP_POINTS: Record<CanadianExpYears, number> = {
  0: 0, 1: 5, 2: 4, 3: 8, 4: 9, 5: 10,
};

function frenchBonus(language1: ClbScores, language1Tag: LanguageTag, language2: ClbScores, language2Tag: LanguageTag): number {
  const frenchScores = language1Tag === 'french' ? language1 : language2Tag === 'french' ? language2 : null;
  const englishScores = language1Tag === 'english' ? language1 : language2Tag === 'english' ? language2 : null;
  if (!frenchScores || minAbility(frenchScores) < 7) return 0;
  if (englishScores && minAbility(englishScores) >= 5) return 50;
  return 25;
}

const HIGHER_EDUCATION: EducationLevel[] = ['one_year', 'two_year', 'three_year_plus', 'two_or_more_credentials', 'masters', 'doctorate'];
const TOP_EDUCATION: EducationLevel[] = ['two_or_more_credentials', 'masters', 'doctorate'];

function educationLanguageTransfer(education: EducationLevel, minClb: number): number {
  if (!HIGHER_EDUCATION.includes(education) || minClb < 7) return 0;
  const top = TOP_EDUCATION.includes(education);
  if (minClb >= 9) return top ? 50 : 25;
  return top ? 25 : 13;
}

function educationExperienceTransfer(education: EducationLevel, canadianYears: number): number {
  if (!HIGHER_EDUCATION.includes(education) || canadianYears < 1) return 0;
  const top = TOP_EDUCATION.includes(education);
  if (canadianYears >= 2) return top ? 50 : 25;
  return top ? 25 : 13;
}

function foreignExperienceLanguageTransfer(foreignYears: ForeignExpYears, minClb: number): number {
  if (foreignYears < 1 || minClb < 7) return 0;
  const long = foreignYears >= 3;
  if (minClb >= 9) return long ? 50 : 25;
  return long ? 25 : 13;
}

function foreignExperienceCanadianTransfer(foreignYears: ForeignExpYears, canadianYears: number): number {
  if (foreignYears < 1 || canadianYears < 1) return 0;
  const long = foreignYears >= 3;
  if (canadianYears >= 2) return long ? 50 : 25;
  return long ? 25 : 13;
}

function certificateTransfer(hasCertificate: boolean, minClb: number): number {
  if (!hasCertificate || minClb < 5) return 0;
  return minClb >= 7 ? 50 : 25;
}

export function calculateCrsScore(input: CrsInput): CrsBreakdown {
  const { hasSpouse } = input;
  const minClb1 = minAbility(input.language1);

  const age = ageScore(input.age, hasSpouse);
  const education = EDUCATION_POINTS[input.education][hasSpouse ? 'withSpouse' : 'single'];
  const firstLanguage = sumAbilities(input.language1, (clb) => firstLanguageAbilityPoints(clb, hasSpouse));
  const secondLanguage = input.hasLanguage2 ? sumAbilities(input.language2, secondLanguageAbilityPoints) : 0;
  const canadianExperience = CANADIAN_EXP_POINTS[input.canadianExpYears][hasSpouse ? 'withSpouse' : 'single'];
  const frenchBonusPoints = frenchBonus(input.language1, input.language1Tag, input.language2, input.hasLanguage2 ? input.language2Tag : 'other');

  const coreHumanCapital = age + education + firstLanguage + secondLanguage + canadianExperience;

  let spouseEducation = 0;
  let spouseLanguage = 0;
  let spouseCanadianExperience = 0;
  if (hasSpouse) {
    spouseEducation = SPOUSE_EDUCATION_POINTS[input.spouseEducation];
    spouseLanguage = sumAbilities(input.spouseLanguage, spouseLanguageAbilityPoints);
    spouseCanadianExperience = SPOUSE_CANADIAN_EXP_POINTS[input.spouseCanadianExpYears];
  }
  const spouseFactors = spouseEducation + spouseLanguage + spouseCanadianExperience;

  const educationGroup = Math.min(
    50,
    educationLanguageTransfer(input.education, minClb1) + educationExperienceTransfer(input.education, input.canadianExpYears),
  );
  const foreignExpGroup = Math.min(
    50,
    foreignExperienceLanguageTransfer(input.foreignExpYears, minClb1) + foreignExperienceCanadianTransfer(input.foreignExpYears, input.canadianExpYears),
  );
  const certificateGroup = certificateTransfer(input.hasCertificateOfQualification, minClb1);
  const skillTransferability = Math.min(100, educationGroup + foreignExpGroup + certificateGroup);

  let additional = frenchBonusPoints;
  if (input.hasProvincialNomination) additional += 600;
  if (input.hasSiblingInCanada) additional += 15;
  if (input.canadianStudy === 'one_or_two_years') additional += 15;
  if (input.canadianStudy === 'three_years_plus') additional += 30;

  const total = coreHumanCapital + spouseFactors + skillTransferability + additional;

  return {
    age,
    education,
    firstLanguage,
    secondLanguage,
    canadianExperience,
    frenchBonus: frenchBonusPoints,
    coreHumanCapital,
    spouseEducation,
    spouseLanguage,
    spouseCanadianExperience,
    spouseFactors,
    skillTransferability,
    additional,
    total,
  };
}

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  less_than_secondary: 'Aucun diplôme secondaire',
  secondary: 'Diplôme d’études secondaires',
  one_year: 'Diplôme postsecondaire d’1 an',
  two_year: 'Diplôme postsecondaire de 2 ans',
  three_year_plus: 'Diplôme postsecondaire de 3 ans ou plus / licence',
  two_or_more_credentials: '2 diplômes postsecondaires ou plus (dont un de 3 ans+)',
  masters: 'Maîtrise ou diplôme professionnel reconnu',
  doctorate: 'Doctorat (Ph. D.)',
};

export const CLB_LEVELS = [4, 5, 6, 7, 8, 9, 10];
