import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getResumeDatasetManifest } from '../../cv-generation/services/resume-generator.service.js';
import { resumeGenerationConfig } from '../../../shared/config/resume-generation.js';
import { ragStorageDirectory } from '../../../shared/config/paths.js';
import type {
  ExtractedResumeTextDocument,
  ResumeRagDocumentArtifacts,
} from '../types/rag.js';
import type {
  ResumeDocumentLanguage,
  ResumeTemplateId,
} from '../../cv-generation/types/resume.js';
import { extractPdfText } from './pdf-text-extractor.service.js';
import { chunkResumeSections } from './resume-chunker.service.js';
import { parseResumeSections } from './resume-section-parser.service.js';
import { extractStructuredResumeData } from './resume-structured-data.service.js';
import { normalizeExtractedPdfText } from './text-normalizer.service.js';

const RAG_OUTPUT_DIRECTORY = ragStorageDirectory;
const EXTRACTED_TEXT_DIRECTORY = path.join(RAG_OUTPUT_DIRECTORY, 'extracted-text');
const SECTIONS_DIRECTORY = path.join(RAG_OUTPUT_DIRECTORY, 'sections');
const CHUNKS_DIRECTORY = path.join(RAG_OUTPUT_DIRECTORY, 'chunks');
const STRUCTURED_DIRECTORY = path.join(RAG_OUTPUT_DIRECTORY, 'structured');

export interface ExtractResumeDatasetTextOptions {
  persistArtifacts?: boolean;
  preserveLayout?: boolean;
}

export interface ExtractSingleResumePdfOptions extends ExtractResumeDatasetTextOptions {
  candidateId?: string;
  fullName?: string;
  primaryRole?: string;
  datasetId?: string;
  candidateIdPrefix?: string;
  documentLanguage?: ResumeDocumentLanguage;
  template?: ResumeTemplateId;
  sourceType?: ExtractedResumeTextDocument['sourceType'];
}

export interface KnownResumePdfMetadata {
  candidateId: string;
  fullName: string;
  primaryRole: string;
  documentLanguage: ResumeDocumentLanguage;
  template: ResumeTemplateId;
}

export interface ExtractResumePdfDirectoryOptions extends ExtractResumeDatasetTextOptions {
  datasetId: string;
  candidateIdPrefix?: string;
  knownResumesByFileName?: Map<string, KnownResumePdfMetadata>;
}

function createSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createFallbackFullName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferFullNameFromRawText(rawText: string): string | null {
  const firstMeaningfulLine = rawText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstMeaningfulLine) {
    return null;
  }

  if (
    firstMeaningfulLine.length > 80 ||
    /@|https?:\/\/|www\.|\+?\d/.test(firstMeaningfulLine) ||
    /(summary|experience|education|skills|certifications|languages|contact)/i.test(
      firstMeaningfulLine
    )
  ) {
    return null;
  }

  return firstMeaningfulLine;
}

async function ensureRagDirectories() {
  await Promise.all([
    mkdir(EXTRACTED_TEXT_DIRECTORY, { recursive: true }),
    mkdir(SECTIONS_DIRECTORY, { recursive: true }),
    mkdir(CHUNKS_DIRECTORY, { recursive: true }),
    mkdir(STRUCTURED_DIRECTORY, { recursive: true }),
  ]);
}

async function writeExtractedResumeArtifact(document: ExtractedResumeTextDocument) {
  await ensureRagDirectories();

  const outputPath = path.join(EXTRACTED_TEXT_DIRECTORY, `${document.candidateId}.json`);
  await writeFile(outputPath, JSON.stringify(document, null, 2));

  return outputPath;
}

async function writeResumeSectionArtifacts(artifacts: ResumeRagDocumentArtifacts) {
  await ensureRagDirectories();

  const sectionsPath = path.join(SECTIONS_DIRECTORY, `${artifacts.document.candidateId}.json`);
  const chunksPath = path.join(CHUNKS_DIRECTORY, `${artifacts.document.candidateId}.json`);
  const structuredPath = path.join(STRUCTURED_DIRECTORY, `${artifacts.document.candidateId}.json`);

  await Promise.all([
    writeFile(sectionsPath, JSON.stringify(artifacts.sections, null, 2)),
    writeFile(chunksPath, JSON.stringify(artifacts.chunks, null, 2)),
    writeFile(structuredPath, JSON.stringify(artifacts.structuredData, null, 2)),
  ]);
}

export async function extractResumeDatasetText(
  options: ExtractResumeDatasetTextOptions = {}
): Promise<{
  datasetId: string;
  documents: ResumeRagDocumentArtifacts[];
  artifactDirectory: string | null;
}> {
  const manifest = await getResumeDatasetManifest();

  const knownResumesByFileName = new Map(
    (manifest?.resumes ?? []).map((resume) => [
      resume.pdfFileName,
      {
        candidateId: resume.id,
        fullName: resume.fullName,
        primaryRole: resume.primaryRole,
        documentLanguage: resume.documentLanguage,
        template: resume.template,
      } satisfies KnownResumePdfMetadata,
    ])
  );
  const result = await extractResumePdfDirectory(resumeGenerationConfig.rag.sources.pdfDirectory, {
    datasetId: manifest?.datasetId ?? `local-resume-dataset-${Date.now()}`,
    candidateIdPrefix: 'resume',
    knownResumesByFileName,
    persistArtifacts: options.persistArtifacts,
    preserveLayout: options.preserveLayout,
  });

  return {
    datasetId: result.datasetId,
    documents: result.documents,
    artifactDirectory: result.artifactDirectory,
  };
}

export async function extractSingleResumePdf(
  pdfFilePath: string,
  options: ExtractSingleResumePdfOptions = {}
): Promise<ResumeRagDocumentArtifacts> {
  const pdfFileName = path.basename(pdfFilePath);
  const rawText = await extractPdfText(pdfFilePath, {
    preserveLayout: options.preserveLayout,
  });
  const fallbackFullName =
    options.fullName ?? inferFullNameFromRawText(rawText) ?? createFallbackFullName(pdfFileName);
  const candidateId =
    options.candidateId ??
    `${options.candidateIdPrefix ? `${options.candidateIdPrefix}-` : ''}${createSlug(fallbackFullName)}`;
  const normalized = normalizeExtractedPdfText(rawText);
  const document: ExtractedResumeTextDocument = {
    datasetId: options.datasetId ?? `ad-hoc-resume-${candidateId}`,
    sourceType: options.sourceType ?? (options.datasetId ? 'imported-folder' : 'ad-hoc-file'),
    candidateId,
    fullName: fallbackFullName,
    primaryRole: options.primaryRole ?? 'Unknown role',
    documentLanguage: options.documentLanguage ?? 'unknown',
    template: options.template ?? 'unknown',
    pdfFileName,
    pdfFilePath,
    extraction: {
      tool: 'pdftotext',
      extractedAt: new Date().toISOString(),
      preserveLayout: options.preserveLayout ?? true,
    },
    rawText,
    normalizedText: normalized.text,
    stats: normalized.stats,
  };
  const sections = parseResumeSections(document);
  const chunks = chunkResumeSections(sections);
  const structuredData = extractStructuredResumeData({
    document,
    sections,
    chunks,
  });
  const artifacts: ResumeRagDocumentArtifacts = {
    document,
    sections,
    chunks,
    structuredData,
  };

  if (options.persistArtifacts) {
    await writeExtractedResumeArtifact(document);
    await writeResumeSectionArtifacts(artifacts);
  }

  return artifacts;
}

export async function extractResumePdfDirectory(
  directoryPath: string,
  options: ExtractResumePdfDirectoryOptions
): Promise<{
  datasetId: string;
  documents: ResumeRagDocumentArtifacts[];
  artifactDirectory: string | null;
}> {
  const fileNames = (await readdir(directoryPath))
    .filter((fileName) => fileName.toLowerCase().endsWith('.pdf'))
    .sort((left, right) => left.localeCompare(right));

  if (fileNames.length === 0) {
    throw new Error(`No PDF files were found in ${directoryPath}.`);
  }

  const documents: ResumeRagDocumentArtifacts[] = [];

  for (const fileName of fileNames) {
    const pdfFilePath = path.join(directoryPath, fileName);
    const knownResume = options.knownResumesByFileName?.get(fileName);
    const artifact = await extractSingleResumePdf(pdfFilePath, {
      persistArtifacts: options.persistArtifacts,
      preserveLayout: options.preserveLayout,
      datasetId: options.datasetId,
      candidateIdPrefix: knownResume ? undefined : options.candidateIdPrefix,
      candidateId: knownResume?.candidateId,
      fullName: knownResume?.fullName,
      primaryRole: knownResume?.primaryRole,
      documentLanguage: knownResume?.documentLanguage,
      template: knownResume?.template,
      sourceType: knownResume ? 'generated-dataset' : 'imported-folder',
    });
    documents.push(artifact);
  }

  return {
    datasetId: options.datasetId,
    documents,
    artifactDirectory: options.persistArtifacts ? EXTRACTED_TEXT_DIRECTORY : null,
  };
}
