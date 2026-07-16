import type {
  ResumeRagAnswerIntent,
  ResumeRagQueryAnalysis,
  ResumeRagQueryConcepts,
  ResumeRagQueryKind,
  ResumeRagResultScope,
} from '../types/rag.js';
import { generateTextCompletion } from '../../../shared/ai/ai.service.js';
import { hasOpenRouterApiKey } from '../../../shared/config/env.js';
import { resumeGenerationConfig } from '../../../shared/config/resume-generation.js';
import { normalizeSearchText, tokenizeSearchText } from './local-vectorizer.service.js';
import {
  extractResumeRagQueryConcepts,
  listResumeRagConceptCanonicals,
  normalizeResumeRagConceptValues,
} from './resume-query-concepts.service.js';

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

const QUERY_INTENTS = ['list', 'count', 'summary'] as const satisfies readonly ResumeRagAnswerIntent[];
const QUERY_KINDS = [
  'generic',
  'language_lookup',
  'organization_lookup',
  'skill_lookup',
  'keyword_lookup',
] as const satisfies readonly ResumeRagQueryKind[];
const RESULT_SCOPES = ['matching', 'catalog'] as const satisfies readonly ResumeRagResultScope[];
const LANGUAGE_ALIASES_BY_NORMALIZED_VALUE = new Map(
  Object.entries(LANGUAGE_ALIASES).flatMap(([canonical, aliases]) =>
    [canonical, ...aliases].map((value) => [normalizeSearchText(value), canonical] as const)
  )
);

interface LlmResumeRagQueryAnalysis {
  intent?: ResumeRagAnswerIntent | null;
  queryKind?: ResumeRagQueryKind | null;
  resultScope?: ResumeRagResultScope | null;
  topK?: number | null;
  filters?: {
    languages?: string[];
    minExperienceYears?: number | null;
  };
  concepts?: {
    technologies?: string[];
    domains?: string[];
    roles?: string[];
  };
}

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

function normalizeTopK(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    return null;
  }

  return Math.min(value, 10);
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

function normalizeLanguages(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalizedLanguages: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }

    const canonicalLanguage = LANGUAGE_ALIASES_BY_NORMALIZED_VALUE.get(normalizeSearchText(value));

    if (!canonicalLanguage || seen.has(canonicalLanguage)) {
      continue;
    }

    seen.add(canonicalLanguage);
    normalizedLanguages.push(canonicalLanguage);
  }

  return normalizedLanguages;
}

function detectMinimumExperienceYears(question: string): number | null {
  const match = question.match(/\b(\d{1,2})\+?\s*(?:years?|a(?:ñ|n)o?s?)\b/i);
  const parsed = match ? Number(match[1]) : Number.NaN;

  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }

  return null;
}

function normalizeMinimumExperienceYears(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
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

function createBaseAnalysis(question: string): ResumeRagQueryAnalysis {
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

function normalizeIntent(value: unknown): ResumeRagAnswerIntent | null {
  return typeof value === 'string' && QUERY_INTENTS.includes(value as ResumeRagAnswerIntent)
    ? (value as ResumeRagAnswerIntent)
    : null;
}

function normalizeQueryKind(value: unknown): ResumeRagQueryKind | null {
  return typeof value === 'string' && QUERY_KINDS.includes(value as ResumeRagQueryKind)
    ? (value as ResumeRagQueryKind)
    : null;
}

function normalizeResultScope(value: unknown): ResumeRagResultScope | null {
  return typeof value === 'string' && RESULT_SCOPES.includes(value as ResumeRagResultScope)
    ? (value as ResumeRagResultScope)
    : null;
}

function mergeOrderedValues(primary: string[], secondary: string[]): string[] {
  return [...new Set([...primary, ...secondary])];
}

function normalizeConcepts(
  concepts: LlmResumeRagQueryAnalysis['concepts']
): ResumeRagQueryConcepts {
  return {
    technologies: normalizeResumeRagConceptValues(concepts?.technologies ?? [], 'technologies'),
    domains: normalizeResumeRagConceptValues(concepts?.domains ?? [], 'domains'),
    roles: normalizeResumeRagConceptValues(concepts?.roles ?? [], 'roles'),
  };
}

function mergeIntent(
  baseAnalysis: ResumeRagQueryAnalysis,
  llmAnalysis: LlmResumeRagQueryAnalysis
): ResumeRagAnswerIntent {
  const normalizedIntent = normalizeIntent(llmAnalysis.intent);

  if (!normalizedIntent) {
    return baseAnalysis.intent;
  }

  return baseAnalysis.intent === 'summary' ? normalizedIntent : baseAnalysis.intent;
}

function mergeQueryKind(
  baseAnalysis: ResumeRagQueryAnalysis,
  llmAnalysis: LlmResumeRagQueryAnalysis
): ResumeRagQueryKind {
  const normalizedQueryKind = normalizeQueryKind(llmAnalysis.queryKind);

  if (!normalizedQueryKind) {
    return baseAnalysis.queryKind;
  }

  if (baseAnalysis.queryKind === 'generic') {
    return normalizedQueryKind;
  }

  if (baseAnalysis.queryKind === 'keyword_lookup' && normalizedQueryKind !== 'generic') {
    return normalizedQueryKind;
  }

  return baseAnalysis.queryKind;
}

function mergeResultScope(
  baseAnalysis: ResumeRagQueryAnalysis,
  llmAnalysis: LlmResumeRagQueryAnalysis,
  mergedIntent: ResumeRagAnswerIntent,
  mergedFilters: ResumeRagQueryAnalysis['filters'],
  mergedConcepts: ResumeRagQueryConcepts
): ResumeRagResultScope {
  const normalizedResultScope = normalizeResultScope(llmAnalysis.resultScope);

  if (baseAnalysis.resultScope === 'catalog') {
    return 'catalog';
  }

  if (normalizedResultScope !== 'catalog') {
    return baseAnalysis.resultScope;
  }

  const hasStructuredConstraints =
    mergedFilters.languages.length > 0 ||
    mergedFilters.minExperienceYears !== null ||
    mergedConcepts.technologies.length > 0 ||
    mergedConcepts.domains.length > 0 ||
    mergedConcepts.roles.length > 0;

  if (hasStructuredConstraints) {
    return 'matching';
  }

  return mergedIntent === 'list' ? 'catalog' : baseAnalysis.resultScope;
}

function sanitizeLlmQueryAnalysisPayload(
  value: unknown
): LlmResumeRagQueryAnalysis | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const filters =
    payload.filters && typeof payload.filters === 'object' && !Array.isArray(payload.filters)
      ? (payload.filters as Record<string, unknown>)
      : null;
  const concepts =
    payload.concepts && typeof payload.concepts === 'object' && !Array.isArray(payload.concepts)
      ? (payload.concepts as Record<string, unknown>)
      : null;

  return {
    intent: normalizeIntent(payload.intent),
    queryKind: normalizeQueryKind(payload.queryKind),
    resultScope: normalizeResultScope(payload.resultScope),
    topK: normalizeTopK(payload.topK),
    filters: {
      languages: normalizeLanguages(
        Array.isArray(filters?.languages)
          ? filters.languages.filter((entry): entry is string => typeof entry === 'string')
          : undefined
      ),
      minExperienceYears: normalizeMinimumExperienceYears(filters?.minExperienceYears),
    },
    concepts: {
      technologies: Array.isArray(concepts?.technologies)
        ? concepts.technologies.filter((entry): entry is string => typeof entry === 'string')
        : [],
      domains: Array.isArray(concepts?.domains)
        ? concepts.domains.filter((entry): entry is string => typeof entry === 'string')
        : [],
      roles: Array.isArray(concepts?.roles)
        ? concepts.roles.filter((entry): entry is string => typeof entry === 'string')
        : [],
    },
  };
}

function parseJsonObject(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    const firstBraceIndex = value.indexOf('{');
    const lastBraceIndex = value.lastIndexOf('}');

    if (firstBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
      return null;
    }

    try {
      return JSON.parse(value.slice(firstBraceIndex, lastBraceIndex + 1));
    } catch {
      return null;
    }
  }
}

async function parseResumeRagQuestionWithLlm(
  question: string
): Promise<LlmResumeRagQueryAnalysis | null> {
  if (!hasOpenRouterApiKey()) {
    return null;
  }

  try {
    const completion = await generateTextCompletion({
      model: resumeGenerationConfig.rag.queryParsing.defaultModel,
      maxTokens: resumeGenerationConfig.rag.queryParsing.maxTokens,
      responseFormat: {
        type: 'json_object',
      },
      systemInstruction: [
        'You normalize resume-search questions into compact JSON for a hybrid local retrieval system.',
        'Be conservative and do not guess missing filters.',
        'Return only valid JSON.',
        'Use null or empty arrays when unsure.',
        'Use canonical language names in English when possible.',
        'Use canonical concept identifiers when possible.',
      ].join(' '),
      prompt: [
        'Return a JSON object with this shape:',
        '{',
        '  "intent": "list" | "count" | "summary" | null,',
        '  "queryKind": "generic" | "language_lookup" | "organization_lookup" | "skill_lookup" | "keyword_lookup" | null,',
        '  "resultScope": "matching" | "catalog" | null,',
        '  "topK": number | null,',
        '  "filters": {',
        `    "languages": [${Object.keys(LANGUAGE_ALIASES).join(', ')}],`,
        '    "minExperienceYears": number | null',
        '  },',
        '  "concepts": {',
        `    "technologies": [${listResumeRagConceptCanonicals('technologies').join(', ')}],`,
        `    "domains": [${listResumeRagConceptCanonicals('domains').join(', ')}],`,
        `    "roles": [${listResumeRagConceptCanonicals('roles').join(', ')}]`,
        '  }',
        '}',
        '',
        'Rules:',
        '- Set "catalog" only when the user is asking for the overall CV catalog rather than filtered matches.',
        '- Preserve organization_lookup for employer/company questions.',
        '- Preserve language_lookup for language-specific questions.',
        '- Use topK only when the user explicitly asks for top, best, or a number of results.',
        '- If a question mentions multiple constraints, capture them all in filters and concepts.',
        '',
        `Question: ${question}`,
      ].join('\n'),
    });
    const parsedPayload = parseJsonObject(completion);
    return sanitizeLlmQueryAnalysisPayload(parsedPayload);
  } catch (error) {
    console.warn(
      `[RAG Query Analysis] Falling back to heuristic parsing after LLM failure: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

function mergeResumeRagQuestionAnalyses(
  baseAnalysis: ResumeRagQueryAnalysis,
  llmAnalysis: LlmResumeRagQueryAnalysis | null
): ResumeRagQueryAnalysis {
  if (!llmAnalysis) {
    return baseAnalysis;
  }

  const normalizedLlmConcepts = normalizeConcepts(llmAnalysis.concepts);
  const mergedConcepts = {
    technologies: mergeOrderedValues(
      baseAnalysis.concepts.technologies,
      normalizedLlmConcepts.technologies
    ),
    domains: mergeOrderedValues(baseAnalysis.concepts.domains, normalizedLlmConcepts.domains),
    roles: mergeOrderedValues(baseAnalysis.concepts.roles, normalizedLlmConcepts.roles),
  };
  const mergedFilters = {
    languages: mergeOrderedValues(
      baseAnalysis.filters.languages,
      normalizeLanguages(llmAnalysis.filters?.languages)
    ),
    minExperienceYears:
      baseAnalysis.filters.minExperienceYears ??
      normalizeMinimumExperienceYears(llmAnalysis.filters?.minExperienceYears),
  };
  const mergedIntent = mergeIntent(baseAnalysis, llmAnalysis);

  return {
    ...baseAnalysis,
    intent: mergedIntent,
    queryKind: mergeQueryKind(baseAnalysis, llmAnalysis),
    resultScope: mergeResultScope(
      baseAnalysis,
      llmAnalysis,
      mergedIntent,
      mergedFilters,
      mergedConcepts
    ),
    topK: baseAnalysis.topK ?? normalizeTopK(llmAnalysis.topK),
    concepts: mergedConcepts,
    filters: mergedFilters,
  };
}

export async function analyzeResumeRagQuestion(question: string): Promise<ResumeRagQueryAnalysis> {
  const baseAnalysis = createBaseAnalysis(question);
  const llmAnalysis = await parseResumeRagQuestionWithLlm(question);

  return mergeResumeRagQuestionAnalyses(baseAnalysis, llmAnalysis);
}
