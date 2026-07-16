import type { ResumeRagAnswerIntent, ResumeRagQueryAnalysis } from '../types/rag.js';
import { normalizeSearchText, tokenizeSearchText } from './local-vectorizer.service.js';

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

export function analyzeResumeRagQuestion(question: string): ResumeRagQueryAnalysis {
  const normalizedQuestion = normalizeSearchText(question);

  return {
    originalQuestion: question,
    normalizedQuestion,
    intent: detectIntent(question),
    topK: detectTopK(question),
    searchTerms: tokenizeSearchText(question).slice(0, 24),
    filters: {
      languages: detectLanguages(normalizedQuestion),
      minExperienceYears: detectMinimumExperienceYears(question),
    },
  };
}
