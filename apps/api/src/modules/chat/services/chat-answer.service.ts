import { hasOpenRouterApiKey } from '../../../shared/config/env.js';
import { resumeGenerationConfig } from '../../../shared/config/resume-generation.js';
import type {
  ResumeRagAnswerResult,
  ResumeRagCandidateMatch,
  ResumeRagQueryAnalysis,
} from '../../cv-ingestion/types/rag.js';
import { generateTextCompletion } from '../../../shared/ai/ai.service.js';
import { searchResumeRag } from '../../cv-ingestion/services/cv-search.service.js';
import { normalizeSearchText, tokenizeSearchText } from '../../cv-ingestion/services/local-vectorizer.service.js';

type ChatLanguage = 'en' | 'es';

interface LocalizedCopy {
  unknown: string;
  answerTitle: string;
  workingTitle: string;
  errorTitle: string;
  thinking: string;
  noQuestionYet: string;
  topMatchesLabel: string;
  sourcesLabel: string;
  candidateLabel: string;
  roleLabel: string;
  experienceLabel: string;
  languagesLabel: string;
  skillsLabel: string;
  citationLabel: string;
  noMatches(question: string): string;
  topMatches(question: string): string;
  rankingNote: string;
  answerInstruction: string;
}

const SPANISH_MARKERS = [
  ' que ',
  ' con ',
  ' para ',
  ' experiencia ',
  ' idiomas ',
  ' busco ',
  ' quiero ',
  ' tiene ',
  ' tienen ',
  ' perfil ',
  ' perfiles ',
  ' anos ',
  ' años ',
  ' candidato ',
  ' candidatos ',
  ' encuentra ',
  ' dame ',
  ' cuales ',
  ' cuáles ',
];

const SPANISH_SIGNAL_TOKENS = new Set([
  'alguien',
  'algun',
  'alguna',
  'algunos',
  'algunas',
  'ano',
  'quien',
  'quienes',
  'que',
  'cual',
  'cuales',
  'como',
  'donde',
  'en',
  'ha',
  'habla',
  'hablan',
  'idioma',
  'idiomas',
  'candidato',
  'candidatos',
  'experiencia',
  'perfil',
  'perfiles',
  'anos',
  'ano',
  'tiene',
  'tienen',
  'trabaja',
  'trabajado',
  'trabajar',
  'busco',
  'quiero',
  'dame',
  'encuentra',
  'tenemos',
  'hay',
]);

const LOCALIZED_COPY: Record<ChatLanguage, LocalizedCopy> = {
  en: {
    unknown: 'Unknown',
    answerTitle: 'Answer Ready',
    workingTitle: 'Working',
    errorTitle: 'Error',
    thinking: 'Thinking...',
    noQuestionYet: 'No question asked yet.',
    topMatchesLabel: 'Top Matches',
    sourcesLabel: 'Sources',
    candidateLabel: 'Candidate',
    roleLabel: 'Role',
    experienceLabel: 'Estimated experience years',
    languagesLabel: 'Languages',
    skillsLabel: 'Skills',
    citationLabel: 'Citation',
    noMatches: (question) =>
      `No strong matches were found for "${question}" in the current resume dataset.`,
    topMatches: (question) => `Top matches for "${question}":`,
    rankingNote:
      'These results were generated from the parsed PDF content and ranked with hybrid retrieval.',
    answerInstruction: 'Answer in English. If the evidence is insufficient, say so clearly.',
  },
  es: {
    unknown: 'Desconocido',
    answerTitle: 'Respuesta lista',
    workingTitle: 'Procesando',
    errorTitle: 'Error',
    thinking: 'Pensando...',
    noQuestionYet: 'Todavía no se ha hecho ninguna pregunta.',
    topMatchesLabel: 'Perfiles más afines',
    sourcesLabel: 'Fragmentos de apoyo',
    candidateLabel: 'Candidato',
    roleLabel: 'Rol',
    experienceLabel: 'Experiencia estimada',
    languagesLabel: 'Idiomas',
    skillsLabel: 'Habilidades',
    citationLabel: 'Cita',
    noMatches: (question) =>
      `No he encontrado perfiles claramente relevantes para "${question}" en el conjunto actual de CVs.`,
    topMatches: (question) => `Perfiles más afines para "${question}":`,
    rankingNote:
      'Estos resultados se han generado a partir del contenido extraído de los PDF y se han ordenado mediante recuperación híbrida.',
    answerInstruction:
      'Responde en español. Si la evidencia no basta, dilo con claridad.',
  },
};

const NEGATIVE_ANSWER_PATTERNS = {
  en: /\b(i cannot determine|i could not find|i couldn't find|no candidates?|no matching|no strong matches|not enough evidence|none of the available resumes|the resumes do not indicate)\b/i,
  es: /\b(no he encontrado|no encuentro|no puedo determinar|no hay candidatos|no hay perfiles|la evidencia no basta|los cvs no indican)\b/i,
} satisfies Record<ChatLanguage, RegExp>;

const QUERY_META_TOKENS = new Set([
  'alguien',
  'alguna',
  'alguno',
  'algunos',
  'algunas',
  'any',
  'candidate',
  'candidates',
  'company',
  'companies',
  'con',
  'cual',
  'cuales',
  'donde',
  'empresa',
  'empresas',
  'experience',
  'experiencia',
  'find',
  'habla',
  'hablan',
  'hay',
  'idioma',
  'idiomas',
  'language',
  'languages',
  'lista',
  'list',
  'muestra',
  'perfil',
  'perfiles',
  'quien',
  'quienes',
  'role',
  'roles',
  'show',
  'skill',
  'skills',
  'speak',
  'speaks',
  'stack',
  'technology',
  'technologies',
  'tenemos',
  'tool',
  'tools',
  'worked',
  'working',
]);

const LANGUAGE_MATCH_ALIASES = {
  english: ['english', 'ingles', 'inglés'],
  spanish: ['spanish', 'espanol', 'español'],
  french: ['french', 'frances', 'francés'],
  german: ['german', 'aleman', 'alemán'],
  dutch: ['dutch', 'neerlandes', 'neerlandés', 'holandes', 'holandés'],
  italian: ['italian', 'italiano'],
  portuguese: ['portuguese', 'portugues', 'portugués'],
  catalan: ['catalan', 'català', 'catalán'],
  galician: ['galician', 'gallego'],
  basque: ['basque', 'euskera', 'vasco'],
  japanese: ['japanese', 'japones', 'japonés'],
  chinese: ['chinese', 'chino', 'mandarin', 'mandarín'],
} satisfies Record<string, string[]>;

function detectQuestionLanguage(question: string): ChatLanguage {
  if (/[áéíóúñü¿¡]/i.test(question)) {
    return 'es';
  }

  const normalizedQuestion = ` ${normalizeSearchText(question)} `;
  const rawNormalizedTokens = normalizeSearchText(question)
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean);
  const spanishMatches = SPANISH_MARKERS.reduce((count, marker) => {
    return count + (normalizedQuestion.includes(marker) ? 1 : 0);
  }, 0);
  const spanishTokenMatches = rawNormalizedTokens.reduce((count, token) => {
    return count + (SPANISH_SIGNAL_TOKENS.has(token) ? 1 : 0);
  }, 0);

  return spanishMatches >= 2 || spanishTokenMatches >= 2 ? 'es' : 'en';
}

function getLocalizedCopy(language: ChatLanguage): LocalizedCopy {
  return LOCALIZED_COPY[language];
}

function shouldShowMatches(
  answer: string,
  matches: ResumeRagCandidateMatch[],
  language: ChatLanguage
): boolean {
  if (matches.length === 0) {
    return false;
  }

  return !NEGATIVE_ANSWER_PATTERNS[language].test(answer);
}

function formatYearsValue(years: number, language: ChatLanguage): string {
  if (years < 1) {
    return language === 'es' ? 'menos de un año' : 'less than 1 year';
  }

  return String(Math.max(1, Math.round(years)));
}

function buildCandidateContext(match: ResumeRagCandidateMatch, language: ChatLanguage): string {
  const copy = getLocalizedCopy(language);

  return [
    `${copy.candidateLabel}: ${match.fullName}`,
    `${copy.roleLabel}: ${match.primaryRole}`,
    `${copy.experienceLabel}: ${formatYearsValue(match.totalEstimatedExperienceYears, language)}`,
    `${copy.languagesLabel}: ${match.languages.join(', ') || copy.unknown}`,
    `${copy.skillsLabel}: ${match.skills.join(', ') || copy.unknown}`,
    ...match.citations.map(
      (citation, index) =>
        `${copy.citationLabel} ${index + 1} (${citation.sectionKind}): ${citation.excerpt}`
    ),
  ].join('\n');
}

function localizeLanguageName(languageName: string, language: ChatLanguage): string {
  const normalized = normalizeSearchText(languageName);

  if (language === 'es') {
    switch (normalized) {
      case 'english':
        return 'inglés';
      case 'spanish':
        return 'español';
      case 'french':
        return 'francés';
      case 'german':
        return 'alemán';
      case 'dutch':
        return 'neerlandés';
      case 'italian':
        return 'italiano';
      case 'portuguese':
        return 'portugués';
      case 'catalan':
        return 'catalán';
      case 'galician':
        return 'gallego';
      case 'basque':
        return 'euskera';
      case 'japanese':
        return 'japonés';
      case 'chinese':
        return 'chino';
      default:
        return languageName;
    }
  }

  return languageName;
}

function formatLanguageList(languages: string[], language: ChatLanguage): string {
  const localizedLanguages = languages.map((item) => localizeLanguageName(item, language));

  if (languages.length === 0) {
    return language === 'es' ? 'ese idioma' : 'that language';
  }

  if (localizedLanguages.length === 1) {
    return localizedLanguages[0];
  }

  if (localizedLanguages.length === 2) {
    return language === 'es'
      ? `${localizedLanguages[0]} y ${localizedLanguages[1]}`
      : `${localizedLanguages[0]} and ${localizedLanguages[1]}`;
  }

  const leadingItems = localizedLanguages.slice(0, -1).join(', ');
  const lastItem = localizedLanguages.at(-1);

  return language === 'es'
    ? `${leadingItems} y ${lastItem}`
    : `${leadingItems}, and ${lastItem}`;
}

function formatQuestionFocus(analysis: ResumeRagQueryAnalysis): string | null {
  const focusTerms = analysis.searchTerms.filter((term) => !QUERY_META_TOKENS.has(term)).slice(0, 4);

  if (focusTerms.length === 0) {
    return null;
  }

  return focusTerms.join(' ');
}

function stripInlineCitationLabels(answer: string): string {
  return answer
    .replace(/\s*\[[^\[\]\n:]+:[^\[\]\n]+\]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function questionMentionsCandidate(question: string, candidateName: string): boolean {
  const questionTokens = new Set(tokenizeSearchText(question));
  const candidateNameTokens = tokenizeSearchText(candidateName).filter((token) => token.length >= 3);
  const overlap = candidateNameTokens.filter((token) => questionTokens.has(token)).length;
  const minimumOverlap = Math.min(2, candidateNameTokens.length);

  return minimumOverlap > 0 && overlap >= minimumOverlap;
}

function detectQuestionPredicateNegation(
  normalizedQuestion: string,
  language: ChatLanguage
): boolean {
  if (language === 'es') {
    return /\bno\s+(?:tiene|habla|ha|trabaja|sabe|indica)\b/.test(normalizedQuestion);
  }

  return /\b(?:does not|doesn't|is not|isn't|has not|hasn't|have not|haven't)\b/.test(
    normalizedQuestion
  );
}

function evaluateExperienceComparison(
  years: number,
  threshold: number,
  normalizedQuestion: string
): boolean | null {
  if (/\b(mas de|more than|over)\b/.test(normalizedQuestion)) {
    return years > threshold;
  }

  if (/\b(al menos|at least|minimum|minimo|mínimo)\b/.test(normalizedQuestion)) {
    return years >= threshold;
  }

  if (/\b(menos de|less than|under)\b/.test(normalizedQuestion)) {
    return years < threshold;
  }

  if (/\b(no mas de|no más de|como maximo|como máximo|at most)\b/.test(normalizedQuestion)) {
    return years <= threshold;
  }

  if (/\b(?:anos|años|years?)\b/.test(normalizedQuestion)) {
    return years >= threshold;
  }

  return null;
}

function candidateMatchesRequestedLanguages(
  match: ResumeRagCandidateMatch,
  analysis: ResumeRagQueryAnalysis
): boolean {
  const candidateLanguageCorpus = normalizeSearchText(match.languages.join(' '));

  return analysis.filters.languages.every((language) => {
    const aliases = LANGUAGE_MATCH_ALIASES[language as keyof typeof LANGUAGE_MATCH_ALIASES] ?? [
      language,
    ];

    return aliases.some((alias) => candidateLanguageCorpus.includes(normalizeSearchText(alias)));
  });
}

function createBooleanExperienceAnswer(
  match: ResumeRagCandidateMatch,
  analysis: ResumeRagQueryAnalysis,
  language: ChatLanguage
): string | null {
  if (analysis.filters.minExperienceYears === null) {
    return null;
  }

  if (!/\b(experience|years?|experiencia|anos|años)\b/i.test(analysis.originalQuestion)) {
    return null;
  }

  const comparisonTruth = evaluateExperienceComparison(
    match.totalEstimatedExperienceYears,
    analysis.filters.minExperienceYears,
    analysis.normalizedQuestion
  );

  if (comparisonTruth === null) {
    return null;
  }

  const isNegatedQuestion = detectQuestionPredicateNegation(analysis.normalizedQuestion, language);
  const propositionTruth = isNegatedQuestion ? !comparisonTruth : comparisonTruth;
  const roundedYears = formatYearsValue(match.totalEstimatedExperienceYears, language);
  const threshold = analysis.filters.minExperienceYears;

  if (language === 'es') {
    if (comparisonTruth) {
      return propositionTruth
        ? `Sí, ${match.fullName} tiene una experiencia estimada de ${roundedYears} años, así que supera los ${threshold} años.`
        : `No, ${match.fullName} tiene una experiencia estimada de ${roundedYears} años, así que sí supera los ${threshold} años.`;
    }

    return propositionTruth
      ? `Sí, ${match.fullName} tiene una experiencia estimada de ${roundedYears} años, así que no supera los ${threshold} años.`
      : `No, ${match.fullName} tiene una experiencia estimada de ${roundedYears} años, así que no supera los ${threshold} años.`;
  }

  if (comparisonTruth) {
    return propositionTruth
      ? `Yes, ${match.fullName} has an estimated ${roundedYears} years of experience, so that is above ${threshold} years.`
      : `No, ${match.fullName} has an estimated ${roundedYears} years of experience, so that is above ${threshold} years.`;
  }

  return propositionTruth
    ? `Yes, ${match.fullName} has an estimated ${roundedYears} years of experience, so that does not exceed ${threshold} years.`
    : `No, ${match.fullName} has an estimated ${roundedYears} years of experience, so that does not exceed ${threshold} years.`;
}

function createBooleanLanguageAnswer(
  match: ResumeRagCandidateMatch,
  analysis: ResumeRagQueryAnalysis,
  language: ChatLanguage
): string | null {
  if (
    analysis.filters.languages.length === 0 ||
    !/\b(speak|speaks|language|languages|habla|hablan|idioma|idiomas|sabe)\b/i.test(
      analysis.originalQuestion
    )
  ) {
    return null;
  }

  const hasLanguages = candidateMatchesRequestedLanguages(match, analysis);
  const isNegatedQuestion = detectQuestionPredicateNegation(analysis.normalizedQuestion, language);
  const propositionTruth = isNegatedQuestion ? !hasLanguages : hasLanguages;
  const languageList = formatLanguageList(analysis.filters.languages, language);

  if (language === 'es') {
    if (hasLanguages) {
      return propositionTruth
        ? `Sí, ${match.fullName} indica ${languageList} entre sus idiomas en el CV.`
        : `No, ${match.fullName} sí indica ${languageList} entre sus idiomas en el CV.`;
    }

    return propositionTruth
      ? `Sí, en el CV de ${match.fullName} no aparece ${languageList} entre sus idiomas.`
      : `No, en el CV de ${match.fullName} no aparece ${languageList} entre sus idiomas.`;
  }

  if (hasLanguages) {
    return propositionTruth
      ? `Yes, ${match.fullName} lists ${languageList} among their languages in the resume.`
      : `No, ${match.fullName} does list ${languageList} among their languages in the resume.`;
  }

  return propositionTruth
    ? `Yes, ${languageList} does not appear among ${match.fullName}'s listed languages in the resume.`
    : `No, ${languageList} does not appear among ${match.fullName}'s listed languages in the resume.`;
}

function createCandidateSpecificBooleanAnswer(
  question: string,
  matches: ResumeRagCandidateMatch[],
  analysis: ResumeRagQueryAnalysis,
  language: ChatLanguage
): string | null {
  if (matches.length !== 1) {
    return null;
  }

  const [match] = matches;

  if (!questionMentionsCandidate(question, match.fullName)) {
    return null;
  }

  return (
    createBooleanExperienceAnswer(match, analysis, language) ??
    createBooleanLanguageAnswer(match, analysis, language)
  );
}

function createNaturalNoMatchesAnswer(
  question: string,
  analysis: ResumeRagQueryAnalysis,
  language: ChatLanguage
): string {
  const copy = getLocalizedCopy(language);
  const questionFocus = formatQuestionFocus(analysis);

  if (analysis.filters.languages.length > 0) {
    const languageList = formatLanguageList(analysis.filters.languages, language);

    return language === 'es'
      ? `No he encontrado ningún candidato que indique ${languageList} entre sus idiomas en los CVs disponibles.`
      : `I could not find any candidates who list ${languageList} among their languages in the available resumes.`;
  }

  if (analysis.queryKind === 'organization_lookup' && questionFocus) {
    return language === 'es'
      ? `No he encontrado ningún perfil que mencione ${questionFocus} en su experiencia laboral dentro de los CVs disponibles.`
      : `I could not find any profiles that mention ${questionFocus} in their work experience within the available resumes.`;
  }

  if (['skill_lookup', 'keyword_lookup'].includes(analysis.queryKind) && questionFocus) {
    return language === 'es'
      ? `No he encontrado perfiles que mencionen claramente ${questionFocus} en los CVs disponibles.`
      : `I could not find profiles that clearly mention ${questionFocus} in the available resumes.`;
  }

  return copy.noMatches(question);
}

function createFallbackAnswer(
  question: string,
  matches: ResumeRagCandidateMatch[],
  analysis: ResumeRagQueryAnalysis,
  language: ChatLanguage
): string {
  const candidateSpecificBooleanAnswer = createCandidateSpecificBooleanAnswer(
    question,
    matches,
    analysis,
    language
  );

  if (candidateSpecificBooleanAnswer) {
    return candidateSpecificBooleanAnswer;
  }

  if (matches.length === 0) {
    return createNaturalNoMatchesAnswer(question, analysis, language);
  }

  if (language === 'es' && /\b(tenemos|hay)\b.*\b(algun|alguna|alguno|algunos|algunas)\b/i.test(normalizeSearchText(question))) {
    if (matches.length === 1) {
      return `Sí, tenemos a ${matches[0].fullName} en la lista.`;
    }

    const candidateNames = matches.slice(0, 3).map((match) => match.fullName).join(', ');
    return `Sí, hay varios perfiles que encajan con esa búsqueda: ${candidateNames}.`;
  }

  if (language === 'en' && /\b(do we have|is there|are there|any)\b/i.test(question)) {
    if (matches.length === 1) {
      return `Yes, ${matches[0].fullName} is in the list.`;
    }

    const candidateNames = matches.slice(0, 3).map((match) => match.fullName).join(', ');
    return `Yes, there are multiple profiles that match that search: ${candidateNames}.`;
  }

  const copy = getLocalizedCopy(language);
  const lines = matches.slice(0, 3).map((match, index) => {
    const experienceLabel =
      language === 'es'
        ? match.totalEstimatedExperienceYears < 1
          ? 'menos de un año de experiencia'
          : `${formatYearsValue(match.totalEstimatedExperienceYears, language)} años estimados`
        : match.totalEstimatedExperienceYears < 1
          ? 'less than 1 year of experience'
          : `${formatYearsValue(match.totalEstimatedExperienceYears, language)} estimated years`;

    return `${index + 1}. ${match.fullName} - ${match.primaryRole} (${experienceLabel})`;
  });

  const summary = [copy.topMatches(question), ...lines];

  if (matches.length > 0) {
    summary.push('', copy.rankingNote);
  }

  return summary.join('\n');
}

async function generateGroundedAnswer(
  question: string,
  matches: ResumeRagCandidateMatch[],
  language: ChatLanguage
): Promise<{ answer: string; model: string }> {
  const model = resumeGenerationConfig.rag.answering.defaultModel;
  const copy = getLocalizedCopy(language);
  const context = matches
    .slice(0, resumeGenerationConfig.rag.answering.topMatchesForAnswer)
    .map((match) => buildCandidateContext(match, language))
    .join('\n\n---\n\n');
  const answer = await generateTextCompletion({
    model,
    maxTokens: resumeGenerationConfig.rag.answering.maxTokens,
    systemInstruction:
      'You are CV Asker. Answer only from the provided resume evidence. Be concise, practical, and explicit about uncertainty. The source CVs may be in different languages. Do not include internal chunk identifiers, bracketed references, or raw citation labels in the final answer.',
    prompt: [
      `Question:\n${question}`,
      '',
      'Resume evidence:',
      context,
      '',
      copy.answerInstruction,
    ].join('\n'),
  });

  return {
    answer: stripInlineCitationLabels(answer),
    model,
  };
}

export async function answerResumeRagQuestion(
  question: string,
  options: { forceRebuild?: boolean } = {}
): Promise<ResumeRagAnswerResult> {
  const responseLanguage = detectQuestionLanguage(question);
  const result = await searchResumeRag(question, options);
  const deterministicCandidateAnswer = createCandidateSpecificBooleanAnswer(
    question,
    result.matches,
    result.analysis,
    responseLanguage
  );

  if (result.matches.length === 0) {
    const answer = createFallbackAnswer(question, result.matches, result.analysis, responseLanguage);

    return {
      source: result.index.source,
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
      responseLanguage,
      answer,
      showMatches: false,
      analysis: result.analysis,
      citations: [],
      matches: [],
      model: null,
    };
  }

  if (deterministicCandidateAnswer) {
    const showMatches = shouldShowMatches(
      deterministicCandidateAnswer,
      result.matches,
      responseLanguage
    );

    return {
      source: result.index.source,
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
      responseLanguage,
      answer: deterministicCandidateAnswer,
      showMatches,
      analysis: result.analysis,
      citations: result.citations,
      matches: showMatches ? result.matches : [],
      model: null,
    };
  }

  if (!hasOpenRouterApiKey()) {
    const answer = createFallbackAnswer(question, result.matches, result.analysis, responseLanguage);
    const showMatches = shouldShowMatches(answer, result.matches, responseLanguage);

    return {
      source: result.index.source,
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
      responseLanguage,
      answer,
      showMatches,
      analysis: result.analysis,
      citations: result.citations,
      matches: showMatches ? result.matches : [],
      model: null,
    };
  }

  try {
    const completion = await generateGroundedAnswer(question, result.matches, responseLanguage);
    const showMatches = shouldShowMatches(completion.answer, result.matches, responseLanguage);

    return {
      source: result.index.source,
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
      responseLanguage,
      answer: completion.answer,
      showMatches,
      analysis: result.analysis,
      citations: result.citations,
      matches: showMatches ? result.matches : [],
      model: completion.model,
    };
  } catch (error) {
    console.warn(
      `[RAG Answer] Falling back to deterministic answer after LLM failure: ${
        error instanceof Error ? error.message : String(error)
      }`
    );

    const answer = createFallbackAnswer(question, result.matches, result.analysis, responseLanguage);
    const showMatches = shouldShowMatches(answer, result.matches, responseLanguage);

    return {
      source: result.index.source,
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
      responseLanguage,
      answer,
      showMatches,
      analysis: result.analysis,
      citations: result.citations,
      matches: showMatches ? result.matches : [],
      model: null,
    };
  }
}
