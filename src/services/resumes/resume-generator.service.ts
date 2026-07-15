import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import type {
  CandidateResume,
  GenerateResumeDatasetInput,
  GeneratedResumeArtifact,
  ResumeDatasetManifest,
  ResumeDocumentLanguage,
  ResumeGenerationMode,
  ResumeTemplateId,
  ResumeTextGenerationMetadata,
} from '../../types/resume.js';
import { createFakerResumeSeedDataProvider } from './resume-faker-data.provider.js';
import {
  generateResumeProfiles,
  type ResumeGeneratedProfile,
  type ResumeProfileDraft,
} from './resume-llm-text.service.js';
import { createResumePdfRenderer } from './resume-renderer.service.js';

const DEFAULT_RESUME_COUNT = 28;
const MIN_RESUME_COUNT = 25;
const MAX_RESUME_COUNT = 30;
const OUTPUT_DIRECTORY = path.join(process.cwd(), 'storage', 'generated-resumes');
const PDF_DIRECTORY = path.join(OUTPUT_DIRECTORY, 'pdfs');
const METADATA_DIRECTORY = path.join(OUTPUT_DIRECTORY, 'metadata');
const MANIFEST_PATH = path.join(OUTPUT_DIRECTORY, 'manifest.json');
const LEGACY_HTML_DIRECTORY = path.join(OUTPUT_DIRECTORY, 'html');
const DEFAULT_RESUME_TEMPLATE: ResumeTemplateId = 'aurora-split';
const resumeSeedDataProvider = createFakerResumeSeedDataProvider();

interface CandidateResumeDraft
  extends Omit<
    CandidateResume,
    | 'primaryRole'
    | 'summary'
    | 'coreTechnologies'
    | 'spokenLanguages'
    | 'education'
    | 'experience'
    | 'highlights'
    | 'certifications'
    | 'portfolioUrl'
  > {}

function createSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function clampResumeCount(value: number): number {
  if (!Number.isInteger(value)) {
    throw new Error('Resume count must be an integer.');
  }

  if (value < MIN_RESUME_COUNT || value > MAX_RESUME_COUNT) {
    throw new Error(`Resume count must stay between ${MIN_RESUME_COUNT} and ${MAX_RESUME_COUNT}.`);
  }

  return value;
}

function resolveGenerationMode(input: GenerateResumeDatasetInput): ResumeGenerationMode {
  if (input.mode) {
    if (input.mode !== 'replace' && input.mode !== 'append') {
      throw new Error('Resume generation mode must be either "replace" or "append".');
    }

    if (
      typeof input.cleanOutput === 'boolean' &&
      input.cleanOutput !== (input.mode === 'replace')
    ) {
      throw new Error('Do not send conflicting values for "mode" and "cleanOutput".');
    }

    return input.mode;
  }

  if (typeof input.cleanOutput === 'boolean') {
    return input.cleanOutput ? 'replace' : 'append';
  }

  return 'replace';
}

function resolveDocumentLanguage(input: GenerateResumeDatasetInput): ResumeDocumentLanguage {
  const language = input.language ?? env.defaultResumeLanguage;

  if (language !== 'en' && language !== 'es-ES') {
    throw new Error('Resume language must be either "en" or "es-ES".');
  }

  return language;
}

function resolveResumeTemplate(input: GenerateResumeDatasetInput): ResumeTemplateId {
  const template = input.template ?? DEFAULT_RESUME_TEMPLATE;

  if (template !== DEFAULT_RESUME_TEMPLATE) {
    throw new Error(`Resume template must be "${DEFAULT_RESUME_TEMPLATE}".`);
  }

  return template;
}

async function ensureOutputDirectories(mode: ResumeGenerationMode) {
  if (mode === 'replace') {
    await rm(OUTPUT_DIRECTORY, { recursive: true, force: true });
  }

  await rm(LEGACY_HTML_DIRECTORY, { recursive: true, force: true });
  await mkdir(PDF_DIRECTORY, { recursive: true });
  await mkdir(METADATA_DIRECTORY, { recursive: true });
}

function createTotalExperienceYears(index: number, age: number): number {
  const baselineExperience = 2 + ((index * 3) % 10);
  return Math.max(2, Math.min(age - 21, baselineExperience));
}

function createCandidateDraft(
  index: number,
  language: ResumeDocumentLanguage
): CandidateResumeDraft {
  const personSeed = resumeSeedDataProvider.createPersonSeed(index, language);
  const slug = createSlug(personSeed.fullName);
  const id = `${slug}-${index + 1}`;

  return {
    id,
    documentLanguage: language,
    fullName: personSeed.fullName,
    age: personSeed.age,
    location: personSeed.location,
    email: personSeed.email,
    phone: personSeed.phone,
    linkedinUrl: `linkedin.com/in/${slug}`,
    totalExperienceYears: createTotalExperienceYears(index, personSeed.age),
    photoPalette: personSeed.photoPalette,
  };
}

function createProfileDraft(candidate: CandidateResumeDraft): ResumeProfileDraft {
  return {
    id: candidate.id,
    documentLanguage: candidate.documentLanguage,
    fullName: candidate.fullName,
    age: candidate.age,
    location: candidate.location,
    totalExperienceYears: candidate.totalExperienceYears,
  };
}

function applyProfileToCandidate(
  candidate: CandidateResumeDraft,
  profile: ResumeGeneratedProfile
): CandidateResume {
  const slug = createSlug(candidate.fullName);

  return {
    ...candidate,
    primaryRole: profile.primaryRole,
    portfolioUrl: profile.includePortfolio ? `${slug}.portfolio.example` : undefined,
    summary: profile.summary,
    coreTechnologies: profile.coreTechnologies,
    spokenLanguages: profile.spokenLanguages,
    education: profile.education,
    experience: profile.experience,
    highlights: profile.highlights,
    certifications: profile.certifications,
  };
}

async function writeCandidateArtifacts(
  candidate: CandidateResume,
  llmModel: string,
  template: ResumeTemplateId,
  pdfBuffer: Buffer
): Promise<GeneratedResumeArtifact> {
  const pdfFileName = `${candidate.id}.pdf`;
  const metadataFileName = `${candidate.id}.json`;
  const pdfFilePath = path.join(PDF_DIRECTORY, pdfFileName);
  const metadataFilePath = path.join(METADATA_DIRECTORY, metadataFileName);

  await writeFile(pdfFilePath, pdfBuffer);
  await writeFile(metadataFilePath, JSON.stringify(candidate, null, 2));

  return {
    id: candidate.id,
    documentLanguage: candidate.documentLanguage,
    fullName: candidate.fullName,
    primaryRole: candidate.primaryRole,
    llmModel,
    template,
    pdfFileName,
    pdfFilePath,
    metadataFileName,
    metadataFilePath,
  };
}

function createTextGenerationMetadata(model: string): ResumeTextGenerationMetadata {
  return {
    strategy: 'faker-plus-llm',
    provider: 'openrouter',
    model,
    batchSize: env.resumeTextBatchSize,
  };
}

export async function generateResumeDataset(
  input: GenerateResumeDatasetInput = {}
): Promise<ResumeDatasetManifest> {
  const count = clampResumeCount(input.count ?? DEFAULT_RESUME_COUNT);
  const mode = resolveGenerationMode(input);
  const language = resolveDocumentLanguage(input);
  const template = resolveResumeTemplate(input);
  const llmModel = input.llmModel ?? env.openRouterModel;
  const existingManifest = mode === 'append' ? await getResumeDatasetManifest() : null;
  const existingResumes = existingManifest?.resumes ?? [];
  const startIndex = existingResumes.length;

  await ensureOutputDirectories(mode);

  const candidateDrafts = Array.from({ length: count }, (_, index) =>
    createCandidateDraft(startIndex + index, language)
  );
  const profiles = await generateResumeProfiles({
    drafts: candidateDrafts.map((candidate) => createProfileDraft(candidate)),
    model: llmModel,
    batchSize: env.resumeTextBatchSize,
  });
  const candidates = candidateDrafts.map((candidate) => {
    const profile = profiles.get(candidate.id);

    if (!profile) {
      throw new Error(`No profile was generated for candidate "${candidate.id}".`);
    }

    return applyProfileToCandidate(candidate, profile);
  });
  const pdfRenderer = await createResumePdfRenderer();
  const newResumes: GeneratedResumeArtifact[] = [];

  try {
    for (const candidate of candidates) {
      const pdfBuffer = await pdfRenderer.render(candidate, template);
      const artifact = await writeCandidateArtifacts(candidate, llmModel, template, pdfBuffer);
      newResumes.push(artifact);
    }
  } finally {
    await pdfRenderer.close();
  }

  const resumes = mode === 'append' ? [...existingResumes, ...newResumes] : newResumes;
  const manifest: ResumeDatasetManifest = {
    datasetId: `generated-resume-dataset-${new Date().toISOString()}`,
    generatedAt: new Date().toISOString(),
    lastGenerationMode: mode,
    lastBatchCount: newResumes.length,
    lastBatchLanguage: language,
    lastTemplate: template,
    lastTextGeneration: createTextGenerationMetadata(llmModel),
    outputDirectory: OUTPUT_DIRECTORY,
    pdfDirectory: PDF_DIRECTORY,
    metadataDirectory: METADATA_DIRECTORY,
    count: resumes.length,
    resumes,
  };

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  return manifest;
}

export async function getResumeDatasetManifest(): Promise<ResumeDatasetManifest | null> {
  try {
    const [manifestStats, pdfDirectoryStats, metadataDirectoryStats] = await Promise.all([
      stat(MANIFEST_PATH),
      stat(PDF_DIRECTORY),
      stat(METADATA_DIRECTORY),
    ]);

    if (
      !manifestStats.isFile() ||
      !pdfDirectoryStats.isDirectory() ||
      !metadataDirectoryStats.isDirectory()
    ) {
      return null;
    }

    const content = await readFile(MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(content) as Partial<ResumeDatasetManifest>;

    return {
      ...manifest,
      lastTemplate: manifest.lastTemplate ?? DEFAULT_RESUME_TEMPLATE,
      resumes: (manifest.resumes ?? []).map((resume) => ({
        ...resume,
        template: resume.template ?? DEFAULT_RESUME_TEMPLATE,
      })),
    } as ResumeDatasetManifest;
  } catch {
    return null;
  }
}

export async function getResumeDatasetStorageSnapshot() {
  const manifest = await getResumeDatasetManifest();

  if (!manifest) {
    return null;
  }

  const [pdfFiles, metadataFiles] = await Promise.all([
    readdir(PDF_DIRECTORY),
    readdir(METADATA_DIRECTORY),
  ]);

  return {
    manifest,
    pdfCount: pdfFiles.length,
    metadataCount: metadataFiles.length,
  };
}
