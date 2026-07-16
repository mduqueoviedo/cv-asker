import type {
  ResumeRagAnswerIntent,
  ResumeRagQueryAnalysis,
  ResumeRagQueryKind,
  ResumeRagResultScope,
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
    /\b(list|show|which|who|find|all|lista|muestra|dame|todos?|todas?|qu[eé] candidatos|qu[eé] perfiles)\b/i.test(
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

  return Number.NaN;
}

function detectResultScope(
  question: string,
  normalizedQuestion: string,
  intent: ResumeRagAnswerIntent
): ResumeRagResultScope {
  if (
    /\b(all|todos?|todas?)\b/i.test(question) &&
    /\b(cvs?|curriculums?|curricula|resumes?|candidates?|candidatos?|profiles?|perfiles?)\b/i.test(
      normalizedQuestion
    )
  ) {
    return 'catalog';
  }

  if (
    intent === 'list' &&
    /\b(cvs?|curriculums?|curricula|resumes?|candidates?|candidatos?|profiles?|perfiles?)\b/i.test(
      normalizedQuestion
    ) &&
    !/\b(english|ingles|ingl[eé]s|spanish|espanol|español|french|frances|franc[eé]s|german|aleman|alem[aá]n|react|java|python|backend|frontend|qa|devops)\b/i.test(
      normalizedQuestion
    )
  ) {
    return 'catalog';
  }

  return 'matching';
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
    /\b(speak|speaks|spoken|language|languages|habla|hablan|hable|hablen|idioma|idiomas)\b/i.test(question)
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
    /\b(?:looking for|searching for|need|need a|need an|candidate|candidates|profile|profiles|busco|buscando|necesito|candidato|candidatos|perfil|perfiles)\b/i.test(
      question
    ) &&
    /\b(?:with|con)\b/i.test(question)
  ) {
    return 'keyword_lookup';
  }

  if (
    searchTerms.length > 0 &&
    (searchTerms.length <= 3 ||
      /\b(any|someone|somebody|who|which|find|show|hay|alguien|quien|quién|tenemos|muestra|busca|busco|buscando|looking|searching)\b/i.test(
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
  const intent = detectIntent(question);
  const parsedTopK = detectTopK(question);

  return {
    originalQuestion: question,
    normalizedQuestion,
    intent,
    queryKind: detectQueryKind(question, normalizedQuestion, searchTerms, detectedLanguages),
    resultScope: detectResultScope(question, normalizedQuestion, intent),
    topK: Number.isInteger(parsedTopK) && parsedTopK > 0 ? parsedTopK : null,
    searchTerms,
    concepts,
    filters: {
      languages: detectedLanguages,
      minExperienceYears: detectMinimumExperienceYears(question),
    },
  };
}
