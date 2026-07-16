import type { ResumeRagAnswerIntent, ResumeRagQueryAnalysis } from '../types/rag.js';
import { normalizeSearchText, tokenizeSearchText } from './local-vectorizer.service.js';

const SUPPORTED_LANGUAGE_NAMES = [
  'english',
  'spanish',
  'french',
  'german',
  'dutch',
  'italian',
  'portuguese',
  'catalan',
  'galician',
  'basque',
  'japanese',
  'espanol',
  'español',
  'ingles',
  'ingles',
  'frances',
  'francés',
  'aleman',
  'aleman',
  'italiano',
  'portugues',
  'portugués',
  'japones',
  'japones',
];

function detectIntent(question: string): ResumeRagAnswerIntent {
  if (/\b(how many|cu[aá]nt[oa]s?|count|numero de)\b/i.test(question)) {
    return 'count';
  }

  if (/\b(list|show|which|who|find|lista|muestra|que candidatos|que perfiles)\b/i.test(question)) {
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
  return SUPPORTED_LANGUAGE_NAMES.filter((language) =>
    normalizedQuestion.includes(normalizeSearchText(language))
  );
}

function detectMinimumExperienceYears(question: string): number | null {
  const match = question.match(/\b(\d{1,2})\+?\s*(?:years?|a[nn]os?)\b/i);
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
