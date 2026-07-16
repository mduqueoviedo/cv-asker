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
import {
  conceptIsPresentInText,
  countMatchedConcepts,
  getResumeRagConceptAliases,
  getRelatedRoleConceptsForQuery,
} from './resume-query-concepts.service.js';

const LANGUAGE_FILTER_ALIASES = {
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
  chinese: ['chinese', 'chino', 'china', 'mandarin', 'mandarín'],
} satisfies Record<string, string[]>;

interface ScoredChunk {
  chunk: ResumeRagIndexedChunk;
  profile: ResumeRagCandidateProfile;
  score: number;
}

const GENERIC_NAME_QUERY_TERMS = new Set([
  'algun',
  'alguna',
  'alguno',
  'algunos',
  'algunas',
  'tenemos',
  'hay',
  'lista',
  'list',
  'candidate',
  'candidates',
  'candidato',
  'candidatos',
  'perfil',
  'perfiles',
  'resume',
  'resumen',
  'summarize',
  'show',
  'find',
  'who',
  'quien',
  'quienes',
  'there',
  'have',
  'has',
  'our',
  'some',
]);

const GENERIC_QUERY_TERMS = new Set([
  ...GENERIC_NAME_QUERY_TERMS,
  'any',
  'candidate',
  'candidates',
  'company',
  'companies',
  'experience',
  'experiencia',
  'ha',
  'habla',
  'hablan',
  'llamada',
  'llamadas',
  'llamado',
  'llamados',
  'mas',
  'more',
  'named',
  'called',
  'than',
  'tiene',
  'tienen',
  'idioma',
  'idiomas',
  'language',
  'languages',
  'menciona',
  'mention',
  'mentions',
  'organization',
  'organizacion',
  'organización',
  'organizations',
  'organisations',
  'role',
  'roles',
  'skill',
  'skills',
  'speak',
  'speaks',
  'stack',
  'technology',
  'technologies',
  'tool',
  'tools',
  'trabajo',
  'worked',
  'working',
  'years',
  'year',
  'anos',
  'ano',
]);

const ROLE_QUERY_TOKENS = new Set([
  'backend',
  'frontend',
  'fullstack',
  'full-stack',
  'qa',
  'devops',
  'platform',
  'data',
]);

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

function buildRoleCorpus(profile: ResumeRagCandidateProfile): string {
  return normalizeSearchText([profile.primaryRole, ...profile.roles].join(' '));
}

function extractQueryRoleTokens(analysis: ResumeRagQueryAnalysis): string[] {
  const roleTokens = new Set<string>();

  for (const token of analysis.searchTerms) {
    if (ROLE_QUERY_TOKENS.has(token)) {
      roleTokens.add(token);
    }
  }

  if (/\bfull stack\b/i.test(analysis.originalQuestion)) {
    roleTokens.add('fullstack');
  }

  return [...roleTokens];
}

function selectRarestMatchingTokens(
  queryTokens: string[],
  candidateTokenSets: Array<{ candidateId: string; tokens: Set<string> }>
): string[] {
  const matchingTokens = queryTokens
    .map((token) => ({
      token,
      candidateIds: candidateTokenSets
        .filter((candidate) => candidate.tokens.has(token))
        .map((candidate) => candidate.candidateId),
    }))
    .filter((entry) => entry.candidateIds.length > 0);

  if (matchingTokens.length === 0) {
    return [];
  }

  const minimumCandidateCount = Math.min(...matchingTokens.map((entry) => entry.candidateIds.length));

  return matchingTokens
    .filter((entry) => entry.candidateIds.length === minimumCandidateCount)
    .map((entry) => entry.token);
}

function extractNameConstraintTokens(
  question: string,
  candidates: ResumeRagCandidateProfile[]
): string[] {
  const candidateNameTokenSets = candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    tokens: new Set(tokenizeSearchText(candidate.fullName)),
  }));
  const queryTokens = tokenizeSearchText(question).filter(
    (token) => token.length >= 3 && !GENERIC_NAME_QUERY_TERMS.has(token)
  );

  return selectRarestMatchingTokens(queryTokens, candidateNameTokenSets);
}

function matchesNameConstraint(
  profile: ResumeRagCandidateProfile,
  nameConstraintTokens: string[]
): boolean {
  if (nameConstraintTokens.length === 0) {
    return true;
  }

  const nameTokens = new Set(tokenizeSearchText(profile.fullName));
  return nameConstraintTokens.every((token) => nameTokens.has(token));
}

function extractOrganizationConstraintTokens(
  analysis: ResumeRagQueryAnalysis,
  candidates: ResumeRagCandidateProfile[]
): string[] {
  if (analysis.queryKind !== 'organization_lookup') {
    return [];
  }

  const candidateOrganizationTokenSets = candidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    tokens: new Set(tokenizeSearchText(candidate.organizations.join(' '))),
  }));
  const queryTokens = analysis.searchTerms.filter(
    (token) => token.length >= 3 && !GENERIC_QUERY_TERMS.has(token)
  );

  return selectRarestMatchingTokens(queryTokens, candidateOrganizationTokenSets);
}

function buildCandidateSearchTokenSets(
  candidates: ResumeRagCandidateProfile[],
  chunks: ResumeRagIndexedChunk[]
): Map<string, Set<string>> {
  const chunkTokensByCandidate = new Map<string, string[]>();

  for (const chunk of chunks) {
    const collected = chunkTokensByCandidate.get(chunk.candidateId) ?? [];
    collected.push(chunk.text, chunk.keywords.join(' '));
    chunkTokensByCandidate.set(chunk.candidateId, collected);
  }

  return new Map(
    candidates.map((candidate) => {
      const combinedText = [
        buildSearchCorpus(candidate),
        ...(chunkTokensByCandidate.get(candidate.candidateId) ?? []),
      ].join(' ');

      return [candidate.candidateId, new Set(tokenizeSearchText(combinedText))];
    })
  );
}

function buildCandidateSearchCorpora(
  candidates: ResumeRagCandidateProfile[],
  chunks: ResumeRagIndexedChunk[]
): Map<string, string> {
  const chunkTextsByCandidate = new Map<string, string[]>();

  for (const chunk of chunks) {
    const collected = chunkTextsByCandidate.get(chunk.candidateId) ?? [];
    collected.push(chunk.text, chunk.keywords.join(' '));
    chunkTextsByCandidate.set(chunk.candidateId, collected);
  }

  return new Map(
    candidates.map((candidate) => {
      const combinedText = [
        buildSearchCorpus(candidate),
        ...(chunkTextsByCandidate.get(candidate.candidateId) ?? []),
      ].join(' ');

      return [candidate.candidateId, normalizeSearchText(combinedText)];
    })
  );
}

function extractRequiredTermConstraintTokens(
  analysis: ResumeRagQueryAnalysis,
  candidateSearchTokenSets: Map<string, Set<string>>,
  excludedTokens: Set<string>
): string[] {
  if (
    !['organization_lookup', 'skill_lookup', 'keyword_lookup', 'language_lookup'].includes(
      analysis.queryKind
    )
  ) {
    return [];
  }

  const queryTokens = analysis.searchTerms.filter(
    (token) =>
      token.length >= 3 &&
      !GENERIC_QUERY_TERMS.has(token) &&
      !excludedTokens.has(token) &&
      !(analysis.filters.minExperienceYears !== null && /^\d+$/.test(token))
  );
  const matchingTokens = queryTokens
    .map((token) => ({
      token,
      candidateIds: [...candidateSearchTokenSets.entries()]
        .filter(([, candidateTokens]) => candidateTokens.has(token))
        .map(([candidateId]) => candidateId),
    }))
    .filter((entry) => entry.candidateIds.length > 0);

  if (matchingTokens.length === 0) {
    return [];
  }

  const rareThreshold = Math.max(1, Math.ceil(candidateSearchTokenSets.size * 0.15));
  const relaxedThreshold = Math.max(1, Math.ceil(candidateSearchTokenSets.size * 0.35));
  const rareTokens = matchingTokens.filter((entry) => entry.candidateIds.length <= rareThreshold);
  const relaxedTokens = matchingTokens.filter(
    (entry) => entry.candidateIds.length <= relaxedThreshold
  );
  const constrainedPool = rareTokens.length > 0 ? rareTokens : relaxedTokens;
  const selectedPool = constrainedPool.length > 0 ? constrainedPool : matchingTokens;
  const minimumCandidateCount = Math.min(
    ...selectedPool.map((entry) => entry.candidateIds.length)
  );

  return selectedPool
    .filter((entry) => entry.candidateIds.length === minimumCandidateCount)
    .map((entry) => entry.token);
}

function matchesTokenConstraint(candidateTokens: Set<string>, constraintTokens: string[]): boolean {
  if (constraintTokens.length === 0) {
    return true;
  }

  return constraintTokens.every((token) => candidateTokens.has(token));
}

function matchesConceptConstraints(
  candidateCorpus: string,
  roleCorpus: string,
  analysis: ResumeRagQueryAnalysis
): boolean {
  const technologyMatches = analysis.concepts.technologies.every((concept) =>
    conceptIsPresentInText(concept, candidateCorpus)
  );
  const domainMatches = analysis.concepts.domains.every((concept) =>
    conceptIsPresentInText(concept, candidateCorpus)
  );
  const roleMatches = analysis.concepts.roles.every((concept) =>
    conceptIsPresentInText(concept, roleCorpus)
  );

  return technologyMatches && domainMatches && roleMatches;
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

  return analysis.filters.languages.every((language) => {
    const aliases = LANGUAGE_FILTER_ALIASES[language as keyof typeof LANGUAGE_FILTER_ALIASES] ?? [
      language,
    ];

    return aliases.some((alias) =>
      candidateLanguageCorpus.includes(normalizeSearchText(alias))
    );
  });
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
  if (analysis.queryKind === 'organization_lookup' && chunk.sectionKind === 'experience') {
    return 1;
  }

  if (
    analysis.queryKind === 'skill_lookup' &&
    ['core_technologies', 'experience', 'summary'].includes(chunk.sectionKind)
  ) {
    return chunk.sectionKind === 'core_technologies' ? 1 : 0.7;
  }

  if (
    analysis.concepts.domains.length > 0 &&
    ['experience', 'summary', 'highlights'].includes(chunk.sectionKind)
  ) {
    return chunk.sectionKind === 'experience' ? 0.9 : 0.6;
  }

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

function computeConstraintBoost(
  chunk: ResumeRagIndexedChunk,
  organizationConstraintTokens: string[],
  requiredTermConstraintTokens: string[]
): number {
  const constraintTokens = [...organizationConstraintTokens, ...requiredTermConstraintTokens];

  if (constraintTokens.length === 0) {
    return 0;
  }

  const chunkTokens = new Set(tokenizeSearchText([chunk.text, chunk.keywords.join(' ')].join(' ')));
  const matchedTokens = constraintTokens.filter((token) => chunkTokens.has(token)).length;

  return matchedTokens / constraintTokens.length;
}

function computeOrganizationConstraintBoost(
  chunk: ResumeRagIndexedChunk,
  organizationConstraintTokens: string[]
): number {
  if (organizationConstraintTokens.length === 0) {
    return 0;
  }

  const chunkTokens = new Set(tokenizeSearchText([chunk.text, chunk.keywords.join(' ')].join(' ')));
  const matchedTokens = organizationConstraintTokens.filter((token) => chunkTokens.has(token)).length;

  return matchedTokens / organizationConstraintTokens.length;
}

function computeRoleMatchBoost(
  profile: ResumeRagCandidateProfile,
  queryRoleTokens: string[]
): number {
  if (queryRoleTokens.length === 0) {
    return 0;
  }

  const roleCorpus = new Set(
    tokenizeSearchText([profile.primaryRole, ...profile.roles].join(' '))
  );
  let matchedTokens = 0;

  for (const token of queryRoleTokens) {
    if (roleCorpus.has(token)) {
      matchedTokens += 1;
    }
  }

  if (matchedTokens === 0) {
    return -0.15;
  }

  return matchedTokens / queryRoleTokens.length;
}

function computeDerivedRoleAffinityBoost(
  analysis: ResumeRagQueryAnalysis,
  roleCorpus: string
): number {
  if (analysis.concepts.roles.length > 0) {
    return 0;
  }

  const relatedRoles = getRelatedRoleConceptsForQuery(analysis.concepts);

  if (relatedRoles.length === 0) {
    return 0;
  }

  const matchedIndex = relatedRoles.findIndex((roleConcept) =>
    conceptIsPresentInText(roleConcept, roleCorpus)
  );

  if (matchedIndex === -1) {
    return -0.4;
  }

  return Math.max(0.4, 1 - matchedIndex * 0.15);
}

function computeConceptBoost(
  analysis: ResumeRagQueryAnalysis,
  profileCorpus: string,
  roleCorpus: string,
  chunk: ResumeRagIndexedChunk
): number {
  const normalizedChunkText = normalizeSearchText([chunk.text, chunk.keywords.join(' ')].join(' '));
  const conceptGroups = [
    {
      concepts: analysis.concepts.technologies,
      profileText: profileCorpus,
      chunkText: normalizedChunkText,
    },
    {
      concepts: analysis.concepts.domains,
      profileText: profileCorpus,
      chunkText: normalizedChunkText,
    },
    {
      concepts: analysis.concepts.roles,
      profileText: roleCorpus,
      chunkText: roleCorpus,
    },
  ].filter((group) => group.concepts.length > 0);

  if (conceptGroups.length === 0) {
    return 0;
  }

  let score = 0;

  for (const group of conceptGroups) {
    const profileMatches = countMatchedConcepts(group.concepts, group.profileText);
    const chunkMatches = countMatchedConcepts(group.concepts, group.chunkText);
    score += Math.max(profileMatches / group.concepts.length, chunkMatches / group.concepts.length);
  }

  return score / conceptGroups.length;
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
  const nameConstraintTokens = extractNameConstraintTokens(question, index.candidates);
  const organizationConstraintTokens = extractOrganizationConstraintTokens(analysis, index.candidates);
  const candidateSearchTokenSets = buildCandidateSearchTokenSets(index.candidates, index.chunks);
  const candidateSearchCorpora = buildCandidateSearchCorpora(index.candidates, index.chunks);
  const queryRoleTokens = extractQueryRoleTokens(analysis);
  const excludedConstraintTokens = new Set([
    ...nameConstraintTokens,
    ...organizationConstraintTokens,
    ...analysis.filters.languages,
    ...analysis.concepts.technologies.flatMap((concept) => getResumeRagConceptAliases(concept)),
    ...analysis.concepts.domains.flatMap((concept) => getResumeRagConceptAliases(concept)),
    ...analysis.concepts.roles.flatMap((concept) => getResumeRagConceptAliases(concept)),
    ...analysis.filters.languages.flatMap(
      (language) => LANGUAGE_FILTER_ALIASES[language as keyof typeof LANGUAGE_FILTER_ALIASES] ?? [language]
    ),
  ]);
  const requiredTermConstraintTokens = extractRequiredTermConstraintTokens(
    analysis,
    candidateSearchTokenSets,
    excludedConstraintTokens
  );
  const queryText =
    analysis.searchTerms.length > 0 ? analysis.searchTerms.join(' ') : analysis.normalizedQuestion;
  const queryEmbedding = createHashedEmbedding(queryText, index.embeddingDimensions);
  const scoredChunks = index.chunks
    .map((chunk) => {
      const profile = candidateProfiles.get(chunk.candidateId);
      const candidateSearchTokens = candidateSearchTokenSets.get(chunk.candidateId);
      const candidateSearchCorpus = candidateSearchCorpora.get(chunk.candidateId);
      const candidateRoleCorpus = profile ? buildRoleCorpus(profile) : null;

      if (
        !profile ||
        !candidateSearchTokens ||
        !candidateSearchCorpus ||
        !candidateRoleCorpus ||
        !candidateMatchesFilters(profile, analysis) ||
        !matchesNameConstraint(profile, nameConstraintTokens) ||
        !matchesTokenConstraint(
          new Set(tokenizeSearchText(profile.organizations.join(' '))),
          organizationConstraintTokens
        ) ||
        !matchesTokenConstraint(candidateSearchTokens, requiredTermConstraintTokens) ||
        !matchesConceptConstraints(candidateSearchCorpus, candidateRoleCorpus, analysis)
      ) {
        return null;
      }

      const chunkCorpus = [chunk.text, chunk.keywords.join(' ')].join(' ');
      const lexicalOverlap = computeLexicalOverlap(analysis.searchTerms, chunkCorpus);
      const profileOverlap = computeLexicalOverlap(analysis.searchTerms, buildSearchCorpus(profile));
      const vectorScore = cosineSimilarity(queryEmbedding, chunk.embedding);
      const facetScore = computeFacetScore(analysis.searchTerms, profile, chunk);
      const sectionBoost = computeSectionBoost(analysis, chunk);
      const constraintBoost = computeConstraintBoost(
        chunk,
        organizationConstraintTokens,
        requiredTermConstraintTokens
      );
      const organizationConstraintBoost = computeOrganizationConstraintBoost(
        chunk,
        organizationConstraintTokens
      );
      const roleBoost = computeRoleMatchBoost(profile, queryRoleTokens);
      const derivedRoleAffinityBoost = computeDerivedRoleAffinityBoost(
        analysis,
        candidateRoleCorpus
      );
      const conceptBoost = computeConceptBoost(
        analysis,
        candidateSearchCorpus,
        candidateRoleCorpus,
        chunk
      );
      const score =
        vectorScore * 0.36 +
        lexicalOverlap * 0.16 +
        profileOverlap * 0.12 +
        facetScore * 0.1 +
        sectionBoost * 0.05 +
        constraintBoost * 0.1 +
        organizationConstraintBoost * 0.22 +
        roleBoost * 0.06 +
        conceptBoost * 0.15 +
        derivedRoleAffinityBoost * 0.18;

      if (
        score <= 0 &&
        !(analysis.queryKind === 'organization_lookup' && organizationConstraintBoost > 0) &&
        analysis.searchTerms.length > 0
      ) {
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
