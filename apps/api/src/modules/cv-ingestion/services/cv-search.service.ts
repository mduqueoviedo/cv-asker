import type {
  ResumeRagCandidateMatch,
  ResumeRagCandidateProfile,
  ResumeRagCitation,
  ResumeRagIndex,
  ResumeRagIndexedChunk,
  ResumeRagQueryAnalysis,
} from '../types/rag.js';
import { cosineSimilarity, createHashedEmbedding, normalizeSearchText, tokenizeSearchText } from './local-vectorizer.service.js';
import { ensureResumeRagIndex } from './cv-ingestion-index.service.js';
import { analyzeResumeRagQuestion } from './search-query-analyzer.service.js';

interface ScoredChunk {
  chunk: ResumeRagIndexedChunk;
  profile: ResumeRagCandidateProfile;
  score: number;
}

export interface ResumeRagSearchResult {
  index: ResumeRagIndex;
  analysis: ResumeRagQueryAnalysis;
  matches: ResumeRagCandidateMatch[];
  citations: ResumeRagCitation[];
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function buildSearchCorpus(profile: ResumeRagCandidateProfile): string {
  return [
    profile.fullName,
    profile.primaryRole,
    profile.summary,
    ...profile.roles,
    ...profile.organizations,
    ...profile.skills,
    ...profile.languages,
    ...profile.education,
    ...profile.certifications,
  ].join(' ');
}

function candidateMatchesFilters(
  profile: ResumeRagCandidateProfile,
  analysis: ResumeRagQueryAnalysis
): boolean {
  if (
    analysis.filters.minExperienceYears !== null &&
    profile.totalEstimatedExperienceYears < analysis.filters.minExperienceYears
  ) {
    return false;
  }

  if (analysis.filters.languages.length === 0) {
    return true;
  }

  const candidateLanguageCorpus = normalizeSearchText(profile.languages.join(' '));

  return analysis.filters.languages.every((language) =>
    candidateLanguageCorpus.includes(normalizeSearchText(language))
  );
}

function computeLexicalOverlap(queryTerms: string[], text: string): number {
  if (queryTerms.length === 0) {
    return 0;
  }

  const corpus = new Set(tokenizeSearchText(text));
  let matched = 0;

  for (const term of queryTerms) {
    if (corpus.has(term)) {
      matched += 1;
    }
  }

  return matched / queryTerms.length;
}

function computeFacetScore(
  queryTerms: string[],
  profile: ResumeRagCandidateProfile,
  chunk: ResumeRagIndexedChunk
): number {
  if (queryTerms.length === 0) {
    return 0;
  }

  const profileCorpus = normalizeSearchText(buildSearchCorpus(profile));
  const chunkKeywordCorpus = normalizeSearchText(chunk.keywords.join(' '));
  let matched = 0;

  for (const term of queryTerms) {
    if (profileCorpus.includes(term) || chunkKeywordCorpus.includes(term)) {
      matched += 1;
    }
  }

  return matched / queryTerms.length;
}

function computeSectionBoost(
  analysis: ResumeRagQueryAnalysis,
  chunk: ResumeRagIndexedChunk
): number {
  if (analysis.filters.languages.length > 0 && chunk.sectionKind === 'languages') {
    return 1;
  }

  if (
    /\b(certificat|certification|certificate|scrum|aws|azure|google cloud)\b/i.test(
      analysis.originalQuestion
    ) &&
    chunk.sectionKind === 'certifications'
  ) {
    return 1;
  }

  if (
    /\b(education|degree|university|studies|formacion|formación)\b/i.test(
      analysis.originalQuestion
    ) &&
    chunk.sectionKind === 'education'
  ) {
    return 1;
  }

  if (/\b(skill|skills|technology|technologies|stack|tool|herramienta|habilidad)\b/i.test(analysis.originalQuestion) &&
    chunk.sectionKind === 'core_technologies') {
    return 1;
  }

  return chunk.sectionKind === 'experience' ? 0.4 : 0;
}

function createCitation(
  chunk: ResumeRagIndexedChunk,
  score: number
): ResumeRagCitation {
  const compactText = chunk.text.replace(/\s+/g, ' ').trim();

  return {
    chunkId: chunk.id,
    candidateId: chunk.candidateId,
    fullName: chunk.fullName,
    primaryRole: chunk.primaryRole,
    pdfFileName: chunk.pdfFileName,
    pdfFilePath: chunk.pdfFilePath,
    sectionKind: chunk.sectionKind,
    excerpt:
      compactText.length <= 220 ? compactText : `${compactText.slice(0, 217).trimEnd()}...`,
    score: roundScore(score),
  };
}

function aggregateCandidateMatches(
  scoredChunks: ScoredChunk[],
  analysis: ResumeRagQueryAnalysis
): ResumeRagCandidateMatch[] {
  const matchesByCandidate = new Map<string, ScoredChunk[]>();

  for (const scoredChunk of scoredChunks) {
    const collection = matchesByCandidate.get(scoredChunk.chunk.candidateId) ?? [];
    collection.push(scoredChunk);
    matchesByCandidate.set(scoredChunk.chunk.candidateId, collection);
  }

  return [...matchesByCandidate.values()]
    .map((candidateChunks) => {
      const [bestChunk] = candidateChunks;
      const profile = bestChunk.profile;
      const topChunks = candidateChunks.slice(0, 3);
      const score =
        topChunks.reduce((sum, item, index) => sum + item.score / (index + 1), 0) /
        Math.max(1, topChunks.length);

      return {
        candidateId: profile.candidateId,
        fullName: profile.fullName,
        primaryRole: profile.primaryRole,
        pdfFileName: profile.pdfFileName,
        pdfFilePath: profile.pdfFilePath,
        score: roundScore(score),
        totalEstimatedExperienceYears: profile.totalEstimatedExperienceYears,
        languages: profile.languages,
        skills: profile.skills.slice(0, 12),
        citations: topChunks.map((item) => createCitation(item.chunk, item.score)),
      } satisfies ResumeRagCandidateMatch;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, analysis.topK);
}

function deduplicateCitations(citations: ResumeRagCitation[]): ResumeRagCitation[] {
  const seen = new Set<string>();
  const result: ResumeRagCitation[] = [];

  for (const citation of citations) {
    if (seen.has(citation.chunkId)) {
      continue;
    }

    seen.add(citation.chunkId);
    result.push(citation);
  }

  return result;
}

export async function searchResumeRag(
  question: string,
  options: { forceRebuild?: boolean } = {}
): Promise<ResumeRagSearchResult> {
  const index = await ensureResumeRagIndex({ forceRebuild: options.forceRebuild });
  const analysis = analyzeResumeRagQuestion(question);
  const candidateProfiles = new Map(
    index.candidates.map((candidate) => [candidate.candidateId, candidate])
  );
  const queryText =
    analysis.searchTerms.length > 0 ? analysis.searchTerms.join(' ') : analysis.normalizedQuestion;
  const queryEmbedding = createHashedEmbedding(queryText, index.embeddingDimensions);
  const scoredChunks = index.chunks
    .map((chunk) => {
      const profile = candidateProfiles.get(chunk.candidateId);

      if (!profile || !candidateMatchesFilters(profile, analysis)) {
        return null;
      }

      const chunkCorpus = [chunk.text, chunk.keywords.join(' ')].join(' ');
      const lexicalOverlap = computeLexicalOverlap(analysis.searchTerms, chunkCorpus);
      const profileOverlap = computeLexicalOverlap(analysis.searchTerms, buildSearchCorpus(profile));
      const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding);
      const facetScore = computeFacetScore(analysis.searchTerms, profile, chunk);
      const sectionBoost = computeSectionBoost(analysis, chunk);
      const score =
        vectorScore * 0.5 +
        lexicalOverlap * 0.2 +
        profileOverlap * 0.15 +
        facetScore * 0.1 +
        sectionBoost * 0.05;

      if (score <= 0 && analysis.searchTerms.length > 0) {
        return null;
      }

      return {
        chunk,
        profile,
        score: roundScore(score),
      } satisfies ScoredChunk;
    })
    .filter((item): item is ScoredChunk => item !== null)
    .sort((left, right) => right.score - left.score)
    .slice(0, 16);
  const matches = aggregateCandidateMatches(scoredChunks, analysis);
  const citations = deduplicateCitations(matches.flatMap((match) => match.citations)).slice(0, 8);

  return {
    index,
    analysis,
    matches,
    citations,
  };
}
