import { hasOpenRouterApiKey } from '../../../shared/config/env.js';
import {
  getDefaultRagAnswerModel,
  resumeGenerationConfig,
} from '../../../shared/config/resume-generation.js';
import type { ResumeRagAnswerResult, ResumeRagCandidateMatch } from '../../cv-ingestion/types/rag.js';
import { generateTextCompletion } from '../../../shared/ai/ai.service.js';
import { searchResumeRag } from '../../cv-ingestion/services/cv-search.service.js';

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
    answerTitle: 'Respuesta Lista',
    workingTitle: 'Procesando',
    errorTitle: 'Error',
    thinking: 'Pensando...',
    noQuestionYet: 'Todavía no se ha hecho ninguna pregunta.',
    topMatchesLabel: 'Mejores Perfiles',
    sourcesLabel: 'Fuentes',
    candidateLabel: 'Candidato',
    roleLabel: 'Rol',
    experienceLabel: 'Años estimados de experiencia',
    languagesLabel: 'Idiomas',
    skillsLabel: 'Competencias',
    citationLabel: 'Cita',
    noMatches: (question) =>
      `No he encontrado coincidencias claras para "${question}" en el conjunto actual de CVs.`,
    topMatches: (question) => `Mejores coincidencias para "${question}":`,
    rankingNote:
      'Estos resultados se han generado a partir del contenido extraído de los PDF y se han ordenado con recuperación híbrida.',
    answerInstruction:
      'Responde en español. Si la evidencia no es suficiente, indícalo con claridad.',
  },
};

function detectQuestionLanguage(question: string): ChatLanguage {
  if (/[áéíóúñü¿¡]/i.test(question)) {
    return 'es';
  }

  const normalizedQuestion = ` ${question.toLowerCase()} `;
  const spanishMatches = SPANISH_MARKERS.reduce((count, marker) => {
    return count + (normalizedQuestion.includes(marker) ? 1 : 0);
  }, 0);

  return spanishMatches >= 2 ? 'es' : 'en';
}

function getLocalizedCopy(language: ChatLanguage): LocalizedCopy {
  return LOCALIZED_COPY[language];
}

function buildCandidateContext(match: ResumeRagCandidateMatch, language: ChatLanguage): string {
  const copy = getLocalizedCopy(language);

  return [
    `${copy.candidateLabel}: ${match.fullName}`,
    `${copy.roleLabel}: ${match.primaryRole}`,
    `${copy.experienceLabel}: ${match.totalEstimatedExperienceYears}`,
    `${copy.languagesLabel}: ${match.languages.join(', ') || copy.unknown}`,
    `${copy.skillsLabel}: ${match.skills.join(', ') || copy.unknown}`,
    ...match.citations.map(
      (citation, index) =>
        `${copy.citationLabel} ${index + 1} [${citation.candidateId}:${citation.chunkId} | ${citation.sectionKind}]: ${citation.excerpt}`
    ),
  ].join('\n');
}

function createFallbackAnswer(
  question: string,
  matches: ResumeRagCandidateMatch[],
  language: ChatLanguage
): string {
  const copy = getLocalizedCopy(language);

  if (matches.length === 0) {
    return copy.noMatches(question);
  }

  const lines = matches.slice(0, 3).map((match, index) => {
    const topCitation = match.citations[0];
    const citationLabel = topCitation ? `[${topCitation.candidateId}:${topCitation.chunkId}]` : '';

    return `${index + 1}. ${match.fullName} - ${match.primaryRole} (${match.totalEstimatedExperienceYears}y est.) ${citationLabel}`.trim();
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
      answer: createFallbackAnswer(question, result.matches, responseLanguage),
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
      answer: createFallbackAnswer(question, result.matches, responseLanguage),
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
      answer: createFallbackAnswer(question, result.matches, responseLanguage),
      analysis: result.analysis,
      citations: result.citations,
      matches: result.matches,
      model: null,
    };
  }
}
