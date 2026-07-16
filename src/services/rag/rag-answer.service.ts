import { hasOpenRouterApiKey } from '../../config/env.js';
import {
  getDefaultRagAnswerModel,
  resumeGenerationConfig,
} from '../../config/resume-generation.js';
import type { ResumeRagAnswerResult, ResumeRagCandidateMatch } from '../../types/rag.js';
import { generateTextCompletion } from '../ai/ai.service.js';
import { searchResumeRag } from './rag-retrieval.service.js';

function buildCandidateContext(match: ResumeRagCandidateMatch): string {
  return [
    `Candidate: ${match.fullName}`,
    `Role: ${match.primaryRole}`,
    `Estimated experience years: ${match.totalEstimatedExperienceYears}`,
    `Languages: ${match.languages.join(', ') || 'Unknown'}`,
    `Skills: ${match.skills.join(', ') || 'Unknown'}`,
    ...match.citations.map(
      (citation, index) =>
        `Citation ${index + 1} [${citation.candidateId}:${citation.chunkId} | ${citation.sectionKind}]: ${citation.excerpt}`
    ),
  ].join('\n');
}

function createFallbackAnswer(
  question: string,
  matches: ResumeRagCandidateMatch[]
): string {
  if (matches.length === 0) {
    return `No strong matches were found for "${question}" in the current resume dataset.`;
  }

  const lines = matches.slice(0, 3).map((match, index) => {
    const topCitation = match.citations[0];
    const citationLabel = topCitation ? `[${topCitation.candidateId}:${topCitation.chunkId}]` : '';

    return `${index + 1}. ${match.fullName} - ${match.primaryRole} (${match.totalEstimatedExperienceYears}y est.) ${citationLabel}`.trim();
  });

  return [
    `Top matches for "${question}":`,
    ...lines,
    '',
    'These results were generated from the parsed PDF content and ranked with hybrid retrieval.',
  ].join('\n');
}

async function generateGroundedAnswer(
  question: string,
  matches: ResumeRagCandidateMatch[]
): Promise<{ answer: string; model: string }> {
  const model = getDefaultRagAnswerModel();
  const context = matches
    .slice(0, resumeGenerationConfig.rag.answering.topMatchesForAnswer)
    .map((match) => buildCandidateContext(match))
    .join('\n\n---\n\n');
  const answer = await generateTextCompletion({
    model,
    maxTokens: resumeGenerationConfig.rag.answering.maxTokens,
    systemInstruction:
      'You are CV Asker. Answer only from the provided resume evidence. Be concise, practical, and explicit about uncertainty. Cite claims inline using the provided citation labels exactly as written.',
    prompt: [
      `Question:\n${question}`,
      '',
      'Resume evidence:',
      context,
      '',
      'Write the answer in English. If the evidence is insufficient, say so clearly.',
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
  const result = await searchResumeRag(question, options);

  if (result.matches.length === 0) {
    return {
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
      answer: createFallbackAnswer(question, result.matches),
      analysis: result.analysis,
      citations: [],
      matches: [],
      model: null,
    };
  }

  if (!hasOpenRouterApiKey()) {
    return {
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
      answer: createFallbackAnswer(question, result.matches),
      analysis: result.analysis,
      citations: result.citations,
      matches: result.matches,
      model: null,
    };
  }

  try {
    const completion = await generateGroundedAnswer(question, result.matches);

    return {
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
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
      datasetId: result.index.datasetId,
      builtAt: result.index.builtAt,
      question,
      answer: createFallbackAnswer(question, result.matches),
      analysis: result.analysis,
      citations: result.citations,
      matches: result.matches,
      model: null,
    };
  }
}
