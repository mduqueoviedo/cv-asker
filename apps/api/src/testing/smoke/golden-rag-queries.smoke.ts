import assert from 'node:assert/strict';
import { answerResumeRagQuestion } from '../../modules/chat/services/chat-answer.service.js';
import { searchResumeRag } from '../../modules/cv-ingestion/services/cv-search.service.js';
import { normalizeSearchText } from '../../modules/cv-ingestion/services/local-vectorizer.service.js';
import type {
  ResumeRagCandidateMatch,
  ResumeRagCitation,
} from '../../modules/cv-ingestion/types/rag.js';
import type { ResumeRagSearchResult } from '../../modules/cv-ingestion/services/cv-search.service.js';

function normalizeEvidence(value: string): string {
  return normalizeSearchText(value).replace(/\s+/g, ' ').trim();
}

function buildMatchEvidence(result: ResumeRagSearchResult, match: ResumeRagCandidateMatch): string {
  const profile = result.index.candidates.find((candidate) => candidate.candidateId === match.candidateId);

  return normalizeEvidence(
    [
      match.fullName,
      match.primaryRole,
      ...(profile?.organizations ?? []),
      ...(profile?.skills ?? []),
      ...(profile?.languages ?? []),
      ...(match.citations.map((citation: ResumeRagCitation) => citation.excerpt) ?? []),
    ].join(' ')
  );
}

function includesTokenVariant(haystack: string, variants: string[]): boolean {
  return variants.some((variant) => haystack.includes(normalizeEvidence(variant)));
}

async function runChineseNegativeQuery() {
  process.env.OPENROUTER_API_KEY = '';
  const result = await answerResumeRagQuestion('Quién habla chino?', {
    forceRebuild: false,
  });

  assert.equal(result.responseLanguage, 'es');
  assert.equal(result.showMatches, false);
  assert.equal(result.matches.length, 0);
  assert.match(result.answer, /No he encontrado/i);
  assert.match(result.answer, /chino/i);
  console.log('[Golden RAG] OK negative-language-query');
}

async function runMarcosLookupQuery() {
  const result = await searchResumeRag('Tenemos algún Marcos en la lista?', {
    forceRebuild: false,
  });

  assert.ok(result.matches.length >= 1, 'Expected at least one Marcos match.');
  for (const match of result.matches) {
    assert.match(normalizeEvidence(match.fullName), /\bmarcos\b/);
  }

  console.log(
    `[Golden RAG] OK marcos-name-query matches=${result.matches
      .map((match) => match.candidateId)
      .join(', ')}`
  );
}

async function runExperianQuery() {
  const result = await searchResumeRag('alguien ha trabajado en Experian?', {
    forceRebuild: false,
  });

  assert.ok(result.matches.length >= 1, 'Expected at least one Experian match.');
  assert.ok(
    includesTokenVariant(buildMatchEvidence(result, result.matches[0]), ['Experian']),
    'Expected the top Experian match to contain Experian evidence.'
  );

  for (const match of result.matches) {
    assert.ok(
      includesTokenVariant(buildMatchEvidence(result, match), ['Experian']),
      `Unexpected non-Experian match: ${match.candidateId}`
    );
  }

  console.log(
    `[Golden RAG] OK experian-company-query matches=${result.matches
      .map((match) => match.candidateId)
      .join(', ')}`
  );
}

async function runWebScrapingQuery() {
  const result = await searchResumeRag('alguien ha trabajado en webscraping?', {
    forceRebuild: false,
  });

  assert.ok(result.matches.length >= 1, 'Expected at least one webscraping match.');

  for (const match of result.matches) {
    assert.ok(
      includesTokenVariant(buildMatchEvidence(result, match), [
        'webscraping',
        'web scraping',
        'web-scraping',
      ]),
      `Unexpected non-webscraping match: ${match.candidateId}`
    );
  }

  console.log(
    `[Golden RAG] OK webscraping-keyword-query matches=${result.matches
      .map((match) => match.candidateId)
      .join(', ')}`
  );
}

async function runCandidateExperienceConfirmationQuery() {
  process.env.OPENROUTER_API_KEY = '';
  const result = await answerResumeRagQuestion('Marcos Duque no tiene más de 10 años de experiencia?', {
    forceRebuild: false,
  });

  assert.equal(result.responseLanguage, 'es');
  assert.match(result.answer, /^No,/);
  assert.match(result.answer, /16 años/i);
  assert.doesNotMatch(result.answer, /\[[^\]]+:[^\]]+\]/);
  console.log('[Golden RAG] OK candidate-experience-confirmation-query');
}

async function runCandidateLanguageConfirmationQuery() {
  process.env.OPENROUTER_API_KEY = '';
  const result = await answerResumeRagQuestion('Marcos Duque no habla japonés?', {
    forceRebuild: false,
  });

  assert.equal(result.responseLanguage, 'es');
  assert.match(result.answer, /^No,/);
  assert.match(result.answer, /japonés/i);
  console.log('[Golden RAG] OK candidate-language-confirmation-query');
}

async function runFrontendFrenchQuery() {
  process.env.OPENROUTER_API_KEY = '';
  const result = await answerResumeRagQuestion('Tenemos algún frontend con francés?', {
    forceRebuild: false,
  });

  assert.equal(result.responseLanguage, 'es');
  assert.equal(result.matches.length, 1);
  assert.match(result.matches[0]?.fullName ?? '', /Alejandra Rocha Rivas/i);
  assert.match(result.answer, /Sí,/);
  console.log('[Golden RAG] OK frontend-french-query');
}

async function runBackendEnglishQuery() {
  const result = await searchResumeRag('Quién tiene experiencia backend y habla inglés?', {
    forceRebuild: false,
  });

  assert.ok(result.matches.length >= 1, 'Expected at least one backend + English match.');

  for (const match of result.matches) {
    const candidate = result.index.candidates.find((item) => item.candidateId === match.candidateId);
    const roleEvidence = normalizeEvidence(
      [candidate?.primaryRole ?? '', ...(candidate?.roles ?? [])].join(' ')
    );
    const languageEvidence = normalizeEvidence((candidate?.languages ?? []).join(' '));

    assert.match(roleEvidence, /\bbackend\b/);
    assert.match(languageEvidence, /\benglish\b|\bingles\b/);
  }

  console.log(
    `[Golden RAG] OK backend-english-query matches=${result.matches
      .map((match) => match.candidateId)
      .join(', ')}`
  );
}

async function runQaRoleQuery() {
  const result = await searchResumeRag('Quién tiene experiencia en QA?', {
    forceRebuild: false,
  });

  assert.ok(result.matches.length >= 3, 'Expected several QA matches.');

  for (const match of result.matches.slice(0, 3)) {
    const roleEvidence = normalizeEvidence([match.primaryRole].join(' '));
    assert.match(roleEvidence, /\bqa\b/);
  }

  console.log(
    `[Golden RAG] OK qa-role-query matches=${result.matches
      .map((match) => match.candidateId)
      .join(', ')}`
  );
}

async function runReactStackQuery() {
  const result = await searchResumeRag('Quién trabaja con React?', {
    forceRebuild: false,
  });

  assert.ok(result.matches.length >= 3, 'Expected several React matches.');
  assert.match(result.matches[0]?.fullName ?? '', /Luisa Perales Sandoval/i);

  for (const match of result.matches.slice(0, 3)) {
    const evidence = buildMatchEvidence(result, match);
    assert.ok(
      includesTokenVariant(evidence, ['React', 'ReactJS']),
      `Expected React evidence for ${match.candidateId}`
    );
  }

  console.log(
    `[Golden RAG] OK react-stack-query matches=${result.matches
      .map((match) => match.candidateId)
      .join(', ')}`
  );
}

async function runCloudDomainQuery() {
  const result = await searchResumeRag('Quién tiene experiencia en cloud?', {
    forceRebuild: false,
  });

  assert.ok(result.matches.length >= 1, 'Expected at least one cloud match.');
  assert.match(result.matches[0]?.fullName ?? '', /Nova Zboncak/i);
  assert.ok(
    includesTokenVariant(buildMatchEvidence(result, result.matches[0]), [
      'cloud',
      'aws',
      'gcp',
      'google cloud',
      'cloudflare',
    ]),
    'Expected the top cloud match to include cloud evidence.'
  );

  console.log(
    `[Golden RAG] OK cloud-domain-query matches=${result.matches
      .map((match) => match.candidateId)
      .join(', ')}`
  );
}

async function main() {
  await runChineseNegativeQuery();
  await runMarcosLookupQuery();
  await runExperianQuery();
  await runWebScrapingQuery();
  await runCandidateExperienceConfirmationQuery();
  await runCandidateLanguageConfirmationQuery();
  await runFrontendFrenchQuery();
  await runBackendEnglishQuery();
  await runQaRoleQuery();
  await runReactStackQuery();
  await runCloudDomainQuery();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Golden RAG] Failed: ${message}`);
  process.exitCode = 1;
});
