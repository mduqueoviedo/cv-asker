import { hasOpenRouterApiKey } from '../../../shared/config/env.js';
import {
  getDefaultRagAnswerModel,
  resumeGenerationConfig,
} from '../../../shared/config/resume-generation.js';
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
  'quien',
  'quienes',
  'que',
  'cual',
  'cuales',
  'como',
  'donde',
  'habla',
  'hablan',
  'idioma',
  'idiomas',
  'candidato',
  'candidatos',
  'perfil',
  'perfiles',
  'experiencia',
  'anos',
  'ano',
  'tiene',
  'tienen',
  'busco',
  'quiero',
  'dame',
  'encuentra',
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

function detectQuestionLanguage(question: string): ChatLanguage {
  if (/[áéíóúñü¿¡]/i.test(question)) {
    return 'es';
  }

  const normalizedQuestion = ` ${normalizeSearchText(question)} `;
  const spanishMatches = SPANISH_MARKERS.reduce((count, marker) => {
    return count + (normalizedQuestion.includes(marker) ? 1 : 0);
  }, 0);
  const spanishTokenMatches = tokenizeSearchText(question).reduce((count, token) => {
    return count + (SPANISH_SIGNAL_TOKENS.has(token) ? 1 : 0);
  }, 0);

  return spanishMatches >= 2 || spanishTokenMatches >= 2 ? 'es' : 'en';
}

function getLocalizedCopy(language: ChatLanguage): LocalizedCopy {
  return LOCALIZED_COPY[language];
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
        `${copy.citationLabel} ${index + 1} [${citation.candidateId}:${citation.chunkId} | ${citation.sectionKind}]: ${citation.excerpt}`
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

function createNaturalNoMatchesAnswer(
  question: string,
  analysis: ResumeRagQueryAnalysis,
  language: ChatLanguage
): string {
  const copy = getLocalizedCopy(language);

  if (analysis.filters.languages.length > 0) {
    const languageList = formatLanguageList(analysis.filters.languages, language);

    return language === 'es'
      ? `No he encontrado ningún candidato que indique ${languageList} entre sus idiomas en los CVs disponibles.`
      : `I could not find any candidates who list ${languageList} among their languages in the available resumes.`;
  }

  return copy.noMatches(question);
}

function createFallbackAnswer(
  question: string,
  matches: ResumeRagCandidateMatch[],
  analysis: ResumeRagQueryAnalysis,
  language: ChatLanguage
): string {
  if (matches.length === 0) {
    return createNaturalNoMatchesAnswer(question, analysis, language);
  }

  const copy = getLocalizedCopy(language);
  const lines = matches.slice(0, 3).map((match, index) => {
    const topCitation = match.citations[0];
    const citationLabel = topCitation ? `[${topCitation.candidateId}:${topCitation.chunkId}]` : '';
    const experienceLabel =
      language === 'es'
        ? match.totalEstimatedExperienceYears < 1
          ? 'menos de un año de experiencia'
          : `${formatYearsValue(match.totalEstimatedExperienceYears, language)} años estimados`
        : match.totalEstimatedExperienceYears < 1
          ? 'less than 1 year of experience'
          : `${formatYearsValue(match.totalEstimatedExperienceYears, language)} estimated years`;

    return `${index + 1}. ${match.fullName} - ${match.primaryRole} (${experienceLabel}) ${citationLabel}`.trim();
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
  const model = getDefaultRagAnswerModel();
  const copy = getLocalizedCopy(language);
  const context = matches
    .slice(0, resumeGenerationConfig.rag.answering.topMatchesForAnswer)
    .map((match) => buildCandidateContext(match, language))
    .join('\n\n---\n\n');
  const answer = await generateTextCompletion({
    model,
    maxTokens: resumeGenerationConfig.rag.answering.maxTokens,
    systemInstruction:
      'You are CV Asker. Answer only from the provided resume evidence. Be concise, practical, and explicit about uncertainty. The source CVs may be in different languages. Cite claims inline using the provided citation labels exactly as written.',
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
    answer,
    model,
  };
}

export async function answerResumeRagQuestion(
  question: string,
  options: { forceRebuild?: boolean } = {}
): Promise<ResumeRagAnswerResult> {
  const responseLanguage = detectQuestionLanguage(question);
  const result = await searchResumeRag(question, options);

  if (result.matches.length === 0) {
    return {
      source: result.index.source,
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
      responseLanguage,
      answer: createFallbackAnswer(question, result.matches, result.analysis, responseLanguage),
      analysis: result.analysis,
      citations: [],
      matches: [],
      model: null,
    };
  }

  if (!hasOpenRouterApiKey()) {
    return {
      source: result.index.source,
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
      responseLanguage,
      answer: createFallbackAnswer(question, result.matches, result.analysis, responseLanguage),
      analysis: result.analysis,
      citations: result.citations,
      matches: result.matches,
      model: null,
    };
  }

  try {
    const completion = await generateGroundedAnswer(question, result.matches, responseLanguage);

    return {
      source: result.index.source,
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
      responseLanguage,
      answer: completion.answer,
      analysis: result.analysis,
      citations: result.citations,
      matches: result.matches,
      model: completion.model,
    };
  } catch (error) {
    console.warn(
      `[RAG Answer] Falling back to deterministic answer after LLM failure: ${
        error instanceof Error ? error.message : String(error)
      }`
    );

    return {
      source: result.index.source,
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
      responseLanguage,
      answer: createFallbackAnswer(question, result.matches, result.analysis, responseLanguage),
      analysis: result.analysis,
      citations: result.citations,
      matches: result.matches,
      model: null,
    };
  }
}
