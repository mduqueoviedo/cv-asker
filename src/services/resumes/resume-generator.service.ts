import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env, hasImageGenerationApiKey } from '../../config/env.js';
import type {
  CandidateResume,
  GenerateResumeDatasetInput,
  GeneratedResumeArtifact,
  ResumeImageGenerationMetadata,
  ResumeDatasetManifest,
  ResumeDocumentLanguage,
  ResumeGenerationMode,
  StoredCandidateResume,
  ResumeTemplateId,
  ResumeTextGenerationMetadata,
} from '../../types/resume.js';
import { createFakerResumeSeedDataProvider } from './resume-faker-data.provider.js';
import { generateResumePhoto } from './resume-photo.service.js';
import {
  generateResumeProfiles,
  type ResumeGeneratedProfile,
  type ResumeProfileDraft,
} from './resume-llm-text.service.js';
import { createResumePdfRenderer } from './resume-renderer.service.js';

const DEFAULT_RESUME_COUNT = 28;
const MIN_RESUME_COUNT = 1;
const MAX_RESUME_COUNT = 30;
const OUTPUT_DIRECTORY = path.join(process.cwd(), 'storage', 'generated-resumes');
const PDF_DIRECTORY = path.join(OUTPUT_DIRECTORY, 'pdfs');
const PHOTO_DIRECTORY = path.join(OUTPUT_DIRECTORY, 'photos');
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
    | 'photo'
  > {
  grammaticalGender: ResumeProfileDraft['grammaticalGender'];
}

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

function resolveRequestedModels(input: GenerateResumeDatasetInput): string[] {
  if (Array.isArray(input.llmModels) && input.llmModels.length > 0) {
    return [...new Set(input.llmModels.map((model) => model.trim()).filter(Boolean))];
  }

  if (typeof input.llmModel === 'string' && input.llmModel.trim()) {
    return [input.llmModel.trim()];
  }

  return env.openRouterModels;
}

async function ensureOutputDirectories(mode: ResumeGenerationMode) {
  if (mode === 'replace') {
    await rm(OUTPUT_DIRECTORY, { recursive: true, force: true });
  }

  await rm(LEGACY_HTML_DIRECTORY, { recursive: true, force: true });
  await mkdir(PDF_DIRECTORY, { recursive: true });
  await mkdir(PHOTO_DIRECTORY, { recursive: true });
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
    grammaticalGender: personSeed.grammaticalGender,
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
    grammaticalGender: candidate.grammaticalGender,
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
    photo: {
      provider: '',
      mimeType: '',
      dataUri: '',
      prompt: '',
      model: '',
    },
  };
}

function getPhotoFileExtension(mimeType: string): string {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

async function writeCandidateArtifacts(
  candidate: CandidateResume,
  llmModel: string,
  template: ResumeTemplateId,
  pdfBuffer: Buffer
): Promise<GeneratedResumeArtifact> {
  const pdfFileName = `${candidate.id}.pdf`;
  const photoFileName = `${candidate.id}.${getPhotoFileExtension(candidate.photo.mimeType)}`;
  const metadataFileName = `${candidate.id}.json`;
  const pdfFilePath = path.join(PDF_DIRECTORY, pdfFileName);
  const photoFilePath = path.join(PHOTO_DIRECTORY, photoFileName);
  const metadataFilePath = path.join(METADATA_DIRECTORY, metadataFileName);
  const photoBase64Data = candidate.photo.dataUri.replace(/^data:[^;]+;base64,/, '');
  const metadata: StoredCandidateResume = {
    ...candidate,
    photo: {
      provider: candidate.photo.provider,
      mimeType: candidate.photo.mimeType,
      fileName: photoFileName,
      filePath: photoFilePath,
      prompt: candidate.photo.prompt,
      model: candidate.photo.model,
    },
  };

  await writeFile(pdfFilePath, pdfBuffer);
  await writeFile(photoFilePath, Buffer.from(photoBase64Data, 'base64'));
  await writeFile(metadataFilePath, JSON.stringify(metadata, null, 2));

  return {
    id: candidate.id,
    documentLanguage: candidate.documentLanguage,
    fullName: candidate.fullName,
    primaryRole: candidate.primaryRole,
    llmModel,
    template,
    pdfFileName,
    pdfFilePath,
    photoFileName,
    photoFilePath,
    metadataFileName,
    metadataFilePath,
  };
}

function createTextGenerationMetadata(
  models: string[],
  usedModels: string[],
  profiles: Iterable<ResumeGeneratedProfile>
): ResumeTextGenerationMetadata {
  let enrichedProfileCount = 0;
  let localProfileCount = 0;

  for (const profile of profiles) {
    if (profile.llmModel.startsWith('local/')) {
      localProfileCount += 1;
      continue;
    }

    enrichedProfileCount += 1;
  }

  return {
    strategy: 'faker-base-with-llm-enrichment',
    provider: 'openrouter',
    model: models[0],
    models,
    usedModels,
    batchSize: env.resumeTextBatchSize,
    enrichedProfileCount,
    localProfileCount,
  };
}

function createImageGenerationMetadata(count: number): ResumeImageGenerationMetadata {
  return {
    provider: env.imageGenerationProvider,
    model: env.imageGenerationModel,
    generatedPhotoCount: count,
  };
}

export async function generateResumeDataset(
  input: GenerateResumeDatasetInput = {}
): Promise<ResumeDatasetManifest> {
  if (!hasImageGenerationApiKey()) {
    throw new Error('Image generation credentials are required to generate realistic resume photos.');
  }

  const generationStartedAt = Date.now();
  const count = clampResumeCount(input.count ?? DEFAULT_RESUME_COUNT);
  const mode = resolveGenerationMode(input);
  const language = resolveDocumentLanguage(input);
  const template = resolveResumeTemplate(input);
  const llmModels = resolveRequestedModels(input);
  const existingManifest = mode === 'append' ? await getResumeDatasetManifest() : null;
  const existingResumes = existingManifest?.resumes ?? [];
  const startIndex = existingResumes.length;

  console.log(
    `[Resume Generator] Starting dataset generation: count=${count} mode=${mode} language=${language} template=${template} models=${llmModels.join(', ')}`
  );

  await ensureOutputDirectories(mode);
  console.log('[Resume Generator] Output directories ready.');

  const candidateDrafts = Array.from({ length: count }, (_, index) =>
    createCandidateDraft(startIndex + index, language)
  );
  console.log(`[Resume Generator] Created ${candidateDrafts.length} candidate seeds.`);
  const llmStartedAt = Date.now();
  const profiles = await generateResumeProfiles({
    drafts: candidateDrafts.map((candidate) => createProfileDraft(candidate)),
    models: llmModels,
    batchSize: env.resumeTextBatchSize,
  });
  console.log(
    `[Resume Generator] Resume text ready: ${profiles.size}/${candidateDrafts.length} (elapsedMs=${Date.now() - llmStartedAt}).`
  );
  const candidates = candidateDrafts.map((candidate) => {
    const profile = profiles.get(candidate.id);

    if (!profile) {
      throw new Error(`No profile was generated for candidate "${candidate.id}".`);
    }

    return applyProfileToCandidate(candidate, profile);
  });
  const candidatesWithPhotos: CandidateResume[] = [];
  const photoGenerationStartedAt = Date.now();

  for (const [candidateIndex, candidate] of candidates.entries()) {
    const photoStartedAt = Date.now();
    console.log(
      `[Resume Photos] Generating photo ${candidateIndex + 1}/${candidates.length} for ${candidate.id} using ${env.imageGenerationProvider}/${env.imageGenerationModel}`
    );
    const photo = await generateResumePhoto(candidate);
    candidatesWithPhotos.push({
      ...candidate,
      photo,
    });
    console.log(
      `[Resume Photos] Completed photo ${candidateIndex + 1}/${candidates.length} for ${candidate.id} (elapsedMs=${Date.now() - photoStartedAt})`
    );
  }

  console.log(
    `[Resume Photos] All photos generated (${candidatesWithPhotos.length}/${candidates.length}, elapsedMs=${Date.now() - photoGenerationStartedAt})`
  );

  const pdfRenderer = await createResumePdfRenderer();
  const newResumes: GeneratedResumeArtifact[] = [];
  const renderStartedAt = Date.now();

  try {
    for (const [candidateIndex, candidate] of candidatesWithPhotos.entries()) {
      const candidateRenderStartedAt = Date.now();
      console.log(
        `[Resume Renderer] Rendering PDF ${candidateIndex + 1}/${candidatesWithPhotos.length} for ${candidate.id}`
      );
      const pdfBuffer = await pdfRenderer.render(candidate, template);
      const profile = profiles.get(candidate.id);

      if (!profile) {
        throw new Error(`No profile metadata was retained for candidate "${candidate.id}".`);
      }

      const artifact = await writeCandidateArtifacts(candidate, profile.llmModel, template, pdfBuffer);
      newResumes.push(artifact);
      console.log(
        `[Resume Renderer] Stored PDF ${candidateIndex + 1}/${candidatesWithPhotos.length} at ${artifact.pdfFilePath} (elapsedMs=${Date.now() - candidateRenderStartedAt})`
      );
    }
  } finally {
    await pdfRenderer.close();
  }

  console.log(
    `[Resume Renderer] All PDFs rendered (${newResumes.length}/${candidatesWithPhotos.length}, elapsedMs=${Date.now() - renderStartedAt})`
  );

  const usedModels = [...new Set(newResumes.map((resume) => resume.llmModel))];
  const resumes = mode === 'append' ? [...existingResumes, ...newResumes] : newResumes;
  const manifest: ResumeDatasetManifest = {
    datasetId: `generated-resume-dataset-${new Date().toISOString()}`,
    generatedAt: new Date().toISOString(),
    lastGenerationMode: mode,
    lastBatchCount: newResumes.length,
    lastBatchLanguage: language,
    lastTemplate: template,
    lastTextGeneration: createTextGenerationMetadata(llmModels, usedModels, profiles.values()),
    lastImageGeneration: createImageGenerationMetadata(candidatesWithPhotos.length),
    outputDirectory: OUTPUT_DIRECTORY,
    pdfDirectory: PDF_DIRECTORY,
    photoDirectory: PHOTO_DIRECTORY,
    metadataDirectory: METADATA_DIRECTORY,
    count: resumes.length,
    resumes,
  };

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(
    `[Resume Generator] Dataset generation completed: batch=${newResumes.length} total=${manifest.count} elapsedMs=${Date.now() - generationStartedAt}`
  );

  return manifest;
}

export async function getResumeDatasetManifest(): Promise<ResumeDatasetManifest | null> {
  try {
    const [manifestStats, pdfDirectoryStats, photoDirectoryStats, metadataDirectoryStats] = await Promise.all([
      stat(MANIFEST_PATH),
      stat(PDF_DIRECTORY),
      stat(PHOTO_DIRECTORY),
      stat(METADATA_DIRECTORY),
    ]);

    if (
      !manifestStats.isFile() ||
      !pdfDirectoryStats.isDirectory() ||
      !photoDirectoryStats.isDirectory() ||
      !metadataDirectoryStats.isDirectory()
    ) {
      return null;
    }

    const content = await readFile(MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(content) as Partial<ResumeDatasetManifest>;
    const configuredModels =
      manifest.lastTextGeneration?.models && manifest.lastTextGeneration.models.length > 0
        ? manifest.lastTextGeneration.models
        : manifest.lastTextGeneration?.model
          ? [manifest.lastTextGeneration.model]
          : env.openRouterModels;
    const usedModels =
      manifest.lastTextGeneration?.usedModels && manifest.lastTextGeneration.usedModels.length > 0
        ? manifest.lastTextGeneration.usedModels
        : configuredModels;

    return {
      ...manifest,
      lastTemplate: manifest.lastTemplate ?? DEFAULT_RESUME_TEMPLATE,
      lastTextGeneration: manifest.lastTextGeneration
        ? {
            ...manifest.lastTextGeneration,
            models: configuredModels,
            usedModels,
            enrichedProfileCount: manifest.lastTextGeneration.enrichedProfileCount ?? 0,
            localProfileCount:
              manifest.lastTextGeneration.localProfileCount ??
              Math.max(0, (manifest.resumes?.length ?? 0) - (manifest.lastTextGeneration.enrichedProfileCount ?? 0)),
          }
        : createTextGenerationMetadata(env.openRouterModels, env.openRouterModels, []),
      lastImageGeneration: manifest.lastImageGeneration ?? createImageGenerationMetadata(0),
      photoDirectory: manifest.photoDirectory ?? PHOTO_DIRECTORY,
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

  const [pdfFiles, photoFiles, metadataFiles] = await Promise.all([
    readdir(PDF_DIRECTORY),
    readdir(PHOTO_DIRECTORY),
    readdir(METADATA_DIRECTORY),
  ]);

  return {
    manifest,
    pdfCount: pdfFiles.length,
    photoCount: photoFiles.length,
    metadataCount: metadataFiles.length,
  };
}
