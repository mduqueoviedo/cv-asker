import type {
  ResumeRagAnswerIntent,
  ResumeRagQueryAnalysis,
  ResumeRagQueryKind,
} from '../types/rag.js';
import { normalizeSearchText, tokenizeSearchText } from './local-vectorizer.service.js';
import { extractResumeRagQueryConcepts } from './resume-query-concepts.service.js';

const LANGUAGE_ALIASES = {
  english: ['english', 'ingles', 'inglés'],
  spanish: ['spanish', 'espanol', 'español'],
  french: ['french', 'frances', 'francés'],
  german: ['german', 'aleman', 'alemán'],
  dutch: ['dutch', 'neerlandes', 'neerlandés', 'holandes', 'holandés'],
  italian: ['italian', 'italiano'],
  portuguese: ['portuguese', 'portugues', 'portugués'],
  catalan: ['catalan', 'català', 'catalán', 'catalan'],
  galician: ['galician', 'gallego'],
  basque: ['basque', 'euskera', 'vasco'],
  japanese: ['japanese', 'japones', 'japonés'],
  chinese: ['chinese', 'chino', 'china', 'mandarin', 'mandarín'],
} satisfies Record<string, string[]>;

function detectIntent(question: string): ResumeRagAnswerIntent {
  if (/\b(how many|cu[aá]nt[oa]s?|count|n[uú]mero de)\b/i.test(question)) {
    return 'count';
  }

  if (
    /\b(list|show|which|who|find|lista|muestra|qu[eé] candidatos|qu[eé] perfiles)\b/i.test(
      question
    )
  ) {
    return 'list';
  }

  return 'summary';
}

function detectTopK(question: string): number {
  const match = question.match(/\b(?:top|best|mejores?)\s+(\d{1,2})\b/i);
  const parsed = match ? Number(match[1]) : Number.NaN;

  if (Number.isInteger(parsed) && parsed > 0) {
    return Math.min(parsed, 10);
  }

  return 5;
}

function detectLanguages(normalizedQuestion: string): string[] {
  return Object.entries(LANGUAGE_ALIASES)
    .filter(([, aliases]) =>
      aliases.some((alias) => normalizedQuestion.includes(normalizeSearchText(alias)))
    )
    .map(([canonicalLanguage]) => canonicalLanguage);
}

function detectMinimumExperienceYears(question: string): number | null {
  const match = question.match(/\b(\d{1,2})\+?\s*(?:years?|a(?:ñ|n)o?s?)\b/i);
  const parsed = match ? Number(match[1]) : Number.NaN;

  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }

  return null;
}

function detectQueryKind(
  question: string,
  normalizedQuestion: string,
  searchTerms: string[],
  detectedLanguages: string[]
): ResumeRagQueryKind {
  if (
    detectedLanguages.length > 0 &&
    /\b(speak|speaks|spoken|language|languages|habla|hablan|idioma|idiomas)\b/i.test(question)
  ) {
    return 'language_lookup';
  }

  if (
    /\b(worked at|worked for|company|companies|employer|employers|organization|organisation|trabajado en|trabajo en|empresa|empresas|empleador|empleadores|pasado por)\b/i.test(
      question
    )
  ) {
    return 'organization_lookup';
  }

  if (
    /\b(skill|skills|technology|technologies|stack|tool|tools|framework|frameworks|experience with|experience in|worked on|works with|uses|use|knows|knowing|herramienta|herramientas|habilidad|habilidades|tecnologia|tecnologias|frameworks?|experiencia con|experiencia en|trabajado con|trabaja con|trabajan con|usa|utiliza|maneja|conoce)\b/i.test(
      question
    )
  ) {
    return 'skill_lookup';
  }

  if (
    searchTerms.length > 0 &&
    (searchTerms.length <= 3 ||
      /\b(any|someone|somebody|who|which|find|show|hay|alguien|quien|quién|tenemos|muestra|busca)\b/i.test(
        normalizedQuestion
      ))
  ) {
    return 'keyword_lookup';
  }

  return 'generic';
}

export function analyzeResumeRagQuestion(question: string): ResumeRagQueryAnalysis {
  const normalizedQuestion = normalizeSearchText(question);
  const searchTerms = tokenizeSearchText(question).slice(0, 24);
  const detectedLanguages = detectLanguages(normalizedQuestion);
  const concepts = extractResumeRagQueryConcepts(question);

  return {
    originalQuestion: question,
    normalizedQuestion,
    intent: detectIntent(question),
    queryKind: detectQueryKind(question, normalizedQuestion, searchTerms, detectedLanguages),
    topK: detectTopK(question),
    searchTerms,
    concepts,
    filters: {
      languages: detectedLanguages,
      minExperienceYears: detectMinimumExperienceYears(question),
    },
  };
}
