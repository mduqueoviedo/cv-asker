import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resumeGenerationConfig } from '../../config/resume-generation.js';
import type {
  ResumeRagCandidateProfile,
  ResumeRagDatasetSource,
  ResumeRagDocumentArtifacts,
  ResumeRagIndex,
  ResumeRagIndexedChunk,
} from '../../types/rag.js';
import { getResumeDatasetManifest } from '../resumes/resume-generator.service.js';
import {
  collectTopKeywords,
  createHashedEmbedding,
  getDefaultEmbeddingDimensions,
  normalizeSearchText,
} from './local-vectorizer.service.js';
import {
  extractResumeDatasetText,
  extractResumePdfDirectory,
} from './resume-pdf-text.service.js';

const RAG_INDEX_DIRECTORY = path.join(process.cwd(), 'storage', 'rag', 'index');

const MONTH_INDEX = new Map<string, number>([
  ['jan', 0],
  ['january', 0],
  ['ene', 0],
  ['enero', 0],
  ['feb', 1],
  ['february', 1],
  ['febrero', 1],
  ['mar', 2],
  ['march', 2],
  ['marzo', 2],
  ['apr', 3],
  ['april', 3],
  ['abr', 3],
  ['abril', 3],
  ['may', 4],
  ['mayo', 4],
  ['jun', 5],
  ['june', 5],
  ['junio', 5],
  ['jul', 6],
  ['july', 6],
  ['julio', 6],
  ['aug', 7],
  ['august', 7],
  ['ago', 7],
  ['agosto', 7],
  ['sep', 8],
  ['sept', 8],
  ['september', 8],
  ['septiembre', 8],
  ['oct', 9],
  ['october', 9],
  ['octubre', 9],
  ['nov', 10],
  ['november', 10],
  ['noviembre', 10],
  ['dec', 11],
  ['december', 11],
  ['dic', 11],
  ['diciembre', 11],
]);

interface ParsedMonthPoint {
  year: number;
  month: number;
}

interface RagDatasetSnapshot {
  source: ResumeRagDatasetSource;
  datasetId: string;
  count: number;
  location: string;
}

export interface BuildResumeRagIndexOptions {
  forceRebuild?: boolean;
  source?: ResumeRagDatasetSource;
}

function resolveIndexFilePath(source: ResumeRagDatasetSource): string {
  return path.join(RAG_INDEX_DIRECTORY, `${source}-resume-rag-index.json`);
}

function roundScore(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function splitFacetList(value: string): string[] {
  return value
    .split(/,|;|\n|·|\u2022/)
    .map((item) => item.trim().replace(/^[.:/-]+|[.:/-]+$/g, '').trim())
    .filter((item) => item.length >= 2 && item.length <= 120);
}

function uniqueNormalizedValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value) {
      continue;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      continue;
    }

    const normalized = normalizeSearchText(trimmed);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(trimmed);
  }

  return result;
}

function parseMonthPoint(value: string, defaultMonth: 'start' | 'end'): ParsedMonthPoint | null {
  const normalized = normalizeSearchText(value);

  if (/(present|current|actualidad)/.test(normalized)) {
    const today = new Date();
    return {
      year: today.getUTCFullYear(),
      month: today.getUTCMonth(),
    };
  }

  const yearMatch = normalized.match(/\b(19|20)\d{2}\b/);

  if (!yearMatch) {
    return null;
  }

  const year = Number(yearMatch[0]);
  const monthToken = normalized
    .split(' ')
    .find((token) => token !== yearMatch[0] && MONTH_INDEX.has(token));

  return {
    year,
    month: monthToken ? (MONTH_INDEX.get(monthToken) ?? 0) : defaultMonth === 'start' ? 0 : 11,
  };
}

function parseDateRangeIntoMonths(value: string | null): Set<number> {
  const months = new Set<number>();

  if (!value) {
    return months;
  }

  for (const segment of value.split(/\s+\/\s+/)) {
    const [left, right] = segment.split(/\s*-\s*|\s*–\s*/).map((item) => item.trim());

    if (!left || !right) {
      continue;
    }

    const start = parseMonthPoint(left, 'start');
    const end = parseMonthPoint(right, 'end');

    if (!start || !end) {
      continue;
    }

    let cursor = start.year * 12 + start.month;
    const finish = end.year * 12 + end.month;

    while (cursor <= finish) {
      months.add(cursor);
      cursor += 1;
    }
  }

  return months;
}

function estimateExperienceYears(artifacts: ResumeRagDocumentArtifacts): number {
  const coveredMonths = new Set<number>();

  for (const entry of artifacts.structuredData.experience) {
    for (const monthValue of parseDateRangeIntoMonths(entry.dateRange)) {
      coveredMonths.add(monthValue);
    }
  }

  return roundScore(coveredMonths.size / 12);
}

function buildCandidateSummary(artifacts: ResumeRagDocumentArtifacts): string {
  const summarySections = artifacts.sections
    .filter((section) => ['summary', 'highlights', 'profile'].includes(section.kind))
    .map((section) => section.content.trim());
  const education = artifacts.structuredData.education
    .map((entry) => [entry.degree, entry.institution].filter(Boolean).join(' - '))
    .filter(Boolean);

  return [
    artifacts.document.fullName,
    artifacts.document.primaryRole,
    ...summarySections,
    ...education,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildCandidateProfile(artifacts: ResumeRagDocumentArtifacts): ResumeRagCandidateProfile {
  const skills = uniqueNormalizedValues([
    ...artifacts.structuredData.experience.flatMap((entry) => entry.associatedSkills),
    ...artifacts.sections
      .filter((section) => section.kind === 'core_technologies')
      .flatMap((section) => splitFacetList(section.content)),
  ]);
  const languages = uniqueNormalizedValues(
    artifacts.structuredData.languages.map((entry) =>
      entry.level ? `${entry.language} ${entry.level}` : entry.language
    )
  );

  return {
    candidateId: artifacts.document.candidateId,
    datasetId: artifacts.document.datasetId,
    fullName: artifacts.document.fullName,
    primaryRole: artifacts.document.primaryRole,
    documentLanguage: artifacts.document.documentLanguage,
    pdfFileName: artifacts.document.pdfFileName,
    pdfFilePath: artifacts.document.pdfFilePath,
    totalEstimatedExperienceYears: estimateExperienceYears(artifacts),
    roles: uniqueNormalizedValues([
      artifacts.document.primaryRole,
      ...artifacts.structuredData.experience.map((entry) => entry.role),
    ]),
    organizations: uniqueNormalizedValues(
      artifacts.structuredData.experience.map((entry) => entry.organization)
    ),
    skills,
    languages,
    education: uniqueNormalizedValues(
      artifacts.structuredData.education.map((entry) =>
        [entry.degree, entry.institution].filter(Boolean).join(' - ')
      )
    ),
    certifications: uniqueNormalizedValues(
      artifacts.structuredData.certifications.map((entry) =>
        [entry.title, entry.issuer].filter(Boolean).join(' - ')
      )
    ),
    summary: buildCandidateSummary(artifacts),
  };
}

function buildIndexedChunk(
  artifacts: ResumeRagDocumentArtifacts,
  candidateProfile: ResumeRagCandidateProfile
): ResumeRagIndexedChunk[] {
  return artifacts.chunks.map((chunk) => {
    const indexedText = [
      candidateProfile.fullName,
      candidateProfile.primaryRole,
      chunk.sectionLabel,
      chunk.text,
    ].join('\n');

    return {
      id: chunk.id,
      datasetId: chunk.datasetId,
      candidateId: chunk.candidateId,
      fullName: candidateProfile.fullName,
      primaryRole: candidateProfile.primaryRole,
      pdfFileName: candidateProfile.pdfFileName,
      pdfFilePath: candidateProfile.pdfFilePath,
      sectionId: chunk.sectionId,
      sectionKind: chunk.sectionKind,
      sectionLabel: chunk.sectionLabel,
      order: chunk.order,
      text: chunk.text,
      keywords: collectTopKeywords(indexedText),
      embedding: createHashedEmbedding(indexedText),
      characterCount: chunk.characterCount,
      wordCount: chunk.wordCount,
    };
  });
}

async function ensureIndexDirectory() {
  await mkdir(RAG_INDEX_DIRECTORY, { recursive: true });
}

async function getGeneratedDatasetSnapshot(): Promise<RagDatasetSnapshot | null> {
  const manifest = await getResumeDatasetManifest();

  if (!manifest) {
    return null;
  }

  return {
    source: 'generated',
    datasetId: manifest.datasetId,
    count: manifest.count,
    location: manifest.pdfDirectory,
  };
}

async function getImportedDatasetSnapshot(): Promise<RagDatasetSnapshot | null> {
  const directoryPath = resumeGenerationConfig.rag.sources.importedPdfDirectory;

  try {
    const directoryStats = await stat(directoryPath);

    if (!directoryStats.isDirectory()) {
      return null;
    }

    const fileNames = (await readdir(directoryPath))
      .filter((fileName) => fileName.toLowerCase().endsWith('.pdf'))
      .sort((left, right) => left.localeCompare(right));

    if (fileNames.length === 0) {
      return null;
    }

    const signature = createHash('sha1');

    for (const fileName of fileNames) {
      const fileStats = await stat(path.join(directoryPath, fileName));
      signature.update(`${fileName}:${fileStats.size}:${fileStats.mtimeMs};`);
    }

    return {
      source: 'imported',
      datasetId: `imported-resume-dataset-${signature.digest('hex').slice(0, 12)}`,
      count: fileNames.length,
      location: directoryPath,
    };
  } catch {
    return null;
  }
}

async function getRagDatasetSnapshot(
  source: ResumeRagDatasetSource
): Promise<RagDatasetSnapshot | null> {
  if (source === 'imported') {
    return getImportedDatasetSnapshot();
  }

  return getGeneratedDatasetSnapshot();
}

export async function detectPreferredResumeRagSource(
  source?: ResumeRagDatasetSource
): Promise<ResumeRagDatasetSource> {
  if (source) {
    return source;
  }

  const importedSnapshot = await getImportedDatasetSnapshot();

  if (importedSnapshot) {
    return 'imported';
  }

  return 'generated';
}

export async function loadResumeRagIndex(
  source: ResumeRagDatasetSource = 'generated'
): Promise<ResumeRagIndex | null> {
  try {
    const content = await readFile(resolveIndexFilePath(source), 'utf8');
    return JSON.parse(content) as ResumeRagIndex;
  } catch {
    return null;
  }
}

export async function buildResumeRagIndex(
  options: BuildResumeRagIndexOptions = {}
): Promise<ResumeRagIndex> {
  const source = await detectPreferredResumeRagSource(options.source);
  const snapshot = await getRagDatasetSnapshot(source);

  if (!snapshot) {
    throw new Error(
      source === 'imported'
        ? `No imported PDF dataset was found at ${resumeGenerationConfig.rag.sources.importedPdfDirectory}.`
        : 'No generated resume dataset was found on disk.'
    );
  }

  const existingIndex = await loadResumeRagIndex(source);

  if (!options.forceRebuild && existingIndex?.datasetId === snapshot.datasetId) {
    return existingIndex;
  }

  const extractionResult =
    source === 'imported'
      ? await extractResumePdfDirectory(snapshot.location, {
          datasetId: snapshot.datasetId,
          candidateIdPrefix: 'imported',
          persistArtifacts: true,
          preserveLayout: true,
        })
      : await extractResumeDatasetText({
          persistArtifacts: true,
          preserveLayout: true,
        });
  const candidates = extractionResult.documents.map((artifact) => buildCandidateProfile(artifact));
  const candidateById = new Map(candidates.map((candidate) => [candidate.candidateId, candidate]));
  const chunks = extractionResult.documents.flatMap((artifact) =>
    buildIndexedChunk(
      artifact,
      candidateById.get(artifact.document.candidateId) ?? buildCandidateProfile(artifact)
    )
  );
  const index: ResumeRagIndex = {
    source,
    datasetId: extractionResult.datasetId,
    builtAt: new Date().toISOString(),
    embeddingDimensions: getDefaultEmbeddingDimensions(),
    documentCount: extractionResult.documents.length,
    candidateCount: candidates.length,
    chunkCount: chunks.length,
    candidates,
    chunks,
  };

  await ensureIndexDirectory();
  await writeFile(resolveIndexFilePath(source), JSON.stringify(index, null, 2));

  return index;
}

export async function ensureResumeRagIndex(
  options: BuildResumeRagIndexOptions = {}
): Promise<ResumeRagIndex> {
  const source = await detectPreferredResumeRagSource(options.source);
  const snapshot = await getRagDatasetSnapshot(source);

  if (!snapshot) {
    throw new Error(
      source === 'imported'
        ? `No imported PDF dataset was found at ${resumeGenerationConfig.rag.sources.importedPdfDirectory}.`
        : 'No generated resume dataset was found on disk.'
    );
  }

  const existingIndex = await loadResumeRagIndex(source);

  if (
    existingIndex &&
    existingIndex.datasetId === snapshot.datasetId &&
    !options.forceRebuild
  ) {
    return existingIndex;
  }

  return buildResumeRagIndex({
    ...options,
    source,
  });
}

export async function getResumeRagStatus(source?: ResumeRagDatasetSource) {
  const resolvedSource = await detectPreferredResumeRagSource(source);
  const [snapshot, index] = await Promise.all([
    getRagDatasetSnapshot(resolvedSource),
    loadResumeRagIndex(resolvedSource),
  ]);

  return {
    source: resolvedSource,
    hasDataset: Boolean(snapshot),
    datasetId: snapshot?.datasetId ?? null,
    datasetCount: snapshot?.count ?? 0,
    datasetLocation: snapshot?.location ?? null,
    indexBuilt: Boolean(index),
    indexDatasetId: index?.datasetId ?? null,
    indexBuiltAt: index?.builtAt ?? null,
    candidateCount: index?.candidateCount ?? 0,
    chunkCount: index?.chunkCount ?? 0,
    stale: Boolean(snapshot && index && snapshot.datasetId !== index.datasetId),
    indexFilePath: resolveIndexFilePath(resolvedSource),
    importedPdfDirectory: resumeGenerationConfig.rag.sources.importedPdfDirectory,
  };
}
