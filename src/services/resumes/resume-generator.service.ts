import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { randomInt } from 'node:crypto';
import path from 'node:path';
import { hasOpenRouterApiKey } from '../../config/env.js';
import {
  getDefaultResumeLlmModels,
  isResumeDocumentLanguage,
  isResumeTemplateId,
  resumeGenerationConfig,
  supportedResumeLanguages,
  supportedResumeTemplates,
} from '../../config/resume-generation.js';
import type {
  CandidateResume,
  GenerateResumeDatasetInput,
  GeneratedResumeArtifact,
  ResumeImageGenerationMetadata,
  ResumeDatasetManifest,
  ResumeDocumentLanguage,
  ResumeDocumentLanguageSelection,
  ResumeGenerationMode,
  ResumeTemplateId,
  ResumeTemplateSelection,
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

const OUTPUT_DIRECTORY = path.join(process.cwd(), 'storage', 'generated-resumes');
const PDF_DIRECTORY = path.join(OUTPUT_DIRECTORY, 'pdfs');
const MANIFEST_PATH = path.join(OUTPUT_DIRECTORY, 'manifest.json');
const LEGACY_HTML_DIRECTORY = path.join(OUTPUT_DIRECTORY, 'html');
const LEGACY_METADATA_DIRECTORY = path.join(OUTPUT_DIRECTORY, 'metadata');
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
  seed: number;
  grammaticalGender: ResumeProfileDraft['grammaticalGender'];
}

interface PlannedResumeDraft {
  draft: CandidateResumeDraft;
  template: ResumeTemplateId;
}

interface PlannedResumeCandidate {
  candidate: CandidateResume;
  template: ResumeTemplateId;
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

  const { min, max } = resumeGenerationConfig.limits.count;

  if (value < min || value > max) {
    throw new Error(`Resume count must stay between ${min} and ${max}.`);
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

  return resumeGenerationConfig.defaults.mode;
}

function resolveDocumentLanguageSelection(
  input: GenerateResumeDatasetInput
): ResumeDocumentLanguageSelection {
  const language = input.language ?? resumeGenerationConfig.defaults.language;

  if (language !== 'mixed' && !isResumeDocumentLanguage(language)) {
    throw new Error('Resume language must be either "en", "es-ES", or "mixed".');
  }

  return language;
}

function resolveResumeTemplateSelection(
  input: GenerateResumeDatasetInput
): ResumeTemplateSelection {
  const template = input.template ?? resumeGenerationConfig.defaults.template;

  if (template !== 'mixed' && !isResumeTemplateId(template)) {
    throw new Error(
      `Resume template must be one of: ${supportedResumeTemplates.join(', ')}, or "mixed".`
    );
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

  return getDefaultResumeLlmModels();
}

async function ensureOutputDirectories(mode: ResumeGenerationMode) {
  if (mode === 'replace') {
    await rm(OUTPUT_DIRECTORY, { recursive: true, force: true });
  }

  await rm(LEGACY_HTML_DIRECTORY, { recursive: true, force: true });
  await rm(LEGACY_METADATA_DIRECTORY, { recursive: true, force: true });
  await mkdir(PDF_DIRECTORY, { recursive: true });
}

function createTotalExperienceYears(index: number, age: number): number {
  const baselineExperience = 2 + ((index * 3) % 10);
  return Math.max(2, Math.min(age - 21, baselineExperience));
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffleInPlace<T>(values: T[], seed: number): T[] {
  const random = createSeededRandom(seed);

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  return values;
}

function createBalancedAssignments<T>(values: readonly T[], count: number, seed: number): T[] {
  const assignments = Array.from({ length: count }, (_, index) => values[index % values.length] as T);
  return shuffleInPlace(assignments, seed);
}

function resolveLanguageAssignments(
  count: number,
  selection: ResumeDocumentLanguageSelection,
  seed: number
): ResumeDocumentLanguage[] {
  if (selection === 'mixed') {
    return createBalancedAssignments(supportedResumeLanguages, count, seed);
  }

  return Array.from({ length: count }, () => selection);
}

function resolveTemplateAssignments(
  count: number,
  selection: ResumeTemplateSelection,
  seed: number
): ResumeTemplateId[] {
  if (selection === 'mixed') {
    return createBalancedAssignments(supportedResumeTemplates, count, seed ^ 0x9e3779b9);
  }

  return Array.from({ length: count }, () => selection);
}

function collectUsedValues<T extends string>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}

function createCandidateDraft(
  index: number,
  language: ResumeDocumentLanguage,
  variationSeed: number
): CandidateResumeDraft {
  const personSeed = resumeSeedDataProvider.createPersonSeed(index, language, variationSeed);
  const slug = createSlug(personSeed.fullName);
  const id = `${slug}-${index + 1}`;

  return {
    id,
    seed: personSeed.seed,
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
    seed: candidate.seed,
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
  const { seed: _seed, ...candidateWithoutSeed } = candidate;
  const slug = createSlug(candidate.fullName);

  return {
    ...candidateWithoutSeed,
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

async function writeCandidateArtifacts(
  candidate: CandidateResume,
  llmModel: string,
  template: ResumeTemplateId,
  pdfBuffer: Buffer
): Promise<GeneratedResumeArtifact> {
  const pdfFileName = `${candidate.id}.pdf`;
  const pdfFilePath = path.join(PDF_DIRECTORY, pdfFileName);

  await writeFile(pdfFilePath, pdfBuffer);

  return {
    id: candidate.id,
    documentLanguage: candidate.documentLanguage,
    fullName: candidate.fullName,
    primaryRole: candidate.primaryRole,
    llmModel,
    template,
    pdfFileName,
    pdfFilePath,
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
    strategy: resumeGenerationConfig.textGeneration.strategy,
    provider: resumeGenerationConfig.textGeneration.provider,
    model: models[0],
    models,
    usedModels,
    batchSize: resumeGenerationConfig.textGeneration.batchSize,
    enrichedProfileCount,
    localProfileCount,
  };
}

function createImageGenerationMetadata(count: number): ResumeImageGenerationMetadata {
  return {
    provider: resumeGenerationConfig.imageGeneration.provider,
    model: resumeGenerationConfig.imageGeneration.model,
    generatedPhotoCount: count,
  };
}

export async function generateResumeDataset(
  input: GenerateResumeDatasetInput = {}
): Promise<ResumeDatasetManifest> {
  if (!hasOpenRouterApiKey()) {
    throw new Error('Image generation credentials are required to generate realistic resume photos.');
  }

  const generationStartedAt = Date.now();
  const count = clampResumeCount(input.count ?? resumeGenerationConfig.defaults.count);
  const mode = resolveGenerationMode(input);
  const language = resolveDocumentLanguageSelection(input);
  const template = resolveResumeTemplateSelection(input);
  const llmModels = resolveRequestedModels(input);
  const existingManifest = mode === 'append' ? await getResumeDatasetManifest() : null;
  const existingResumes = existingManifest?.resumes ?? [];
  const startIndex = existingResumes.length;
  const variationSeed = randomInt(1, 2_147_483_647);
  const languageAssignments = resolveLanguageAssignments(count, language, variationSeed);
  const templateAssignments = resolveTemplateAssignments(count, template, variationSeed);

  console.log(
    `[Resume Generator] Starting dataset generation: count=${count} mode=${mode} language=${language} template=${template} models=${llmModels.join(', ')}`
  );

  await ensureOutputDirectories(mode);
  console.log('[Resume Generator] Output directories ready.');

  const plannedDrafts: PlannedResumeDraft[] = Array.from({ length: count }, (_, index) => ({
    draft: createCandidateDraft(startIndex + index, languageAssignments[index], variationSeed),
    template: templateAssignments[index],
  }));
  const candidateDrafts = plannedDrafts.map(({ draft }) => draft);
  console.log(
    `[Resume Generator] Created ${candidateDrafts.length} candidate seeds across languages=${collectUsedValues(languageAssignments).join(', ')} templates=${collectUsedValues(templateAssignments).join(', ')}.`
  );
  const llmStartedAt = Date.now();
  const profiles = await generateResumeProfiles({
    drafts: candidateDrafts.map((candidate) => createProfileDraft(candidate)),
    models: llmModels,
    batchSize: resumeGenerationConfig.textGeneration.batchSize,
  });
  console.log(
    `[Resume Generator] Resume text ready: ${profiles.size}/${candidateDrafts.length} (elapsedMs=${Date.now() - llmStartedAt}).`
  );
  const plannedCandidates: PlannedResumeCandidate[] = plannedDrafts.map(({ draft, template: assignedTemplate }) => {
    const profile = profiles.get(draft.id);

    if (!profile) {
      throw new Error(`No profile was generated for candidate "${draft.id}".`);
    }

    return {
      candidate: applyProfileToCandidate(draft, profile),
      template: assignedTemplate,
    };
  });
  const candidatesWithPhotos: PlannedResumeCandidate[] = [];
  const photoGenerationStartedAt = Date.now();

  for (const [candidateIndex, plannedCandidate] of plannedCandidates.entries()) {
    const { candidate, template: assignedTemplate } = plannedCandidate;
    const photoStartedAt = Date.now();
    console.log(
      `[Resume Photos] Generating photo ${candidateIndex + 1}/${plannedCandidates.length} for ${candidate.id} using ${resumeGenerationConfig.imageGeneration.provider}/${resumeGenerationConfig.imageGeneration.model}`
    );
    const photo = await generateResumePhoto(candidate);
    candidatesWithPhotos.push({
      candidate: {
        ...candidate,
        photo,
      },
      template: assignedTemplate,
    });
    console.log(
      `[Resume Photos] Completed photo ${candidateIndex + 1}/${plannedCandidates.length} for ${candidate.id} (elapsedMs=${Date.now() - photoStartedAt})`
    );
  }

  console.log(
    `[Resume Photos] All photos generated (${candidatesWithPhotos.length}/${plannedCandidates.length}, elapsedMs=${Date.now() - photoGenerationStartedAt})`
  );

  const pdfRenderer = await createResumePdfRenderer();
  const newResumes: GeneratedResumeArtifact[] = [];
  const renderStartedAt = Date.now();

  try {
    for (const [candidateIndex, plannedCandidate] of candidatesWithPhotos.entries()) {
      const { candidate, template: assignedTemplate } = plannedCandidate;
      const candidateRenderStartedAt = Date.now();
      console.log(
        `[Resume Renderer] Rendering PDF ${candidateIndex + 1}/${candidatesWithPhotos.length} for ${candidate.id}`
      );
      const pdfBuffer = await pdfRenderer.render(candidate, assignedTemplate);
      const profile = profiles.get(candidate.id);

      if (!profile) {
        throw new Error(`No generated profile was retained for candidate "${candidate.id}".`);
      }

      const artifact = await writeCandidateArtifacts(
        candidate,
        profile.llmModel,
        assignedTemplate,
        pdfBuffer
      );
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
    lastBatchLanguages: collectUsedValues(newResumes.map((resume) => resume.documentLanguage)),
    lastTemplate: template,
    lastBatchTemplates: collectUsedValues(newResumes.map((resume) => resume.template)),
    lastTextGeneration: createTextGenerationMetadata(llmModels, usedModels, profiles.values()),
    lastImageGeneration: createImageGenerationMetadata(candidatesWithPhotos.length),
    outputDirectory: OUTPUT_DIRECTORY,
    pdfDirectory: PDF_DIRECTORY,
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
    const [manifestStats, pdfDirectoryStats] = await Promise.all([stat(MANIFEST_PATH), stat(PDF_DIRECTORY)]);

    if (!manifestStats.isFile() || !pdfDirectoryStats.isDirectory()) {
      return null;
    }

    const content = await readFile(MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(content) as Partial<ResumeDatasetManifest>;
    const configuredModels =
      manifest.lastTextGeneration?.models && manifest.lastTextGeneration.models.length > 0
        ? manifest.lastTextGeneration.models
        : manifest.lastTextGeneration?.model
          ? [manifest.lastTextGeneration.model]
          : getDefaultResumeLlmModels();
    const usedModels =
      manifest.lastTextGeneration?.usedModels && manifest.lastTextGeneration.usedModels.length > 0
        ? manifest.lastTextGeneration.usedModels
        : configuredModels;

    const normalizedResumes = (manifest.resumes ?? []).map((resume) => {
      const { metadataFileName: _metadataFileName, metadataFilePath: _metadataFilePath, ...normalizedResume } =
        resume as Partial<GeneratedResumeArtifact> & {
          metadataFileName?: string;
          metadataFilePath?: string;
        };

      return {
        ...normalizedResume,
        template: normalizedResume.template ?? resumeGenerationConfig.defaults.template,
      } as GeneratedResumeArtifact;
    });

    const {
      metadataDirectory: _metadataDirectory,
      resumes: _legacyResumes,
      ...manifestWithoutLegacyMetadata
    } = manifest as Partial<ResumeDatasetManifest> & {
      metadataDirectory?: string;
    };

    return {
      ...manifestWithoutLegacyMetadata,
      lastTemplate: manifest.lastTemplate ?? resumeGenerationConfig.defaults.template,
      lastBatchLanguage: manifest.lastBatchLanguage ?? resumeGenerationConfig.defaults.language,
      lastBatchLanguages:
        manifest.lastBatchLanguages && manifest.lastBatchLanguages.length > 0
          ? manifest.lastBatchLanguages
          : collectUsedValues(
              normalizedResumes.map((resume) => resume.documentLanguage)
            ),
      lastBatchTemplates:
        manifest.lastBatchTemplates && manifest.lastBatchTemplates.length > 0
          ? manifest.lastBatchTemplates
          : collectUsedValues(normalizedResumes.map((resume) => resume.template)),
      lastTextGeneration: manifest.lastTextGeneration
        ? {
            ...manifest.lastTextGeneration,
            models: configuredModels,
            usedModels,
            enrichedProfileCount: manifest.lastTextGeneration.enrichedProfileCount ?? 0,
            localProfileCount:
              manifest.lastTextGeneration.localProfileCount ??
              Math.max(0, normalizedResumes.length - (manifest.lastTextGeneration.enrichedProfileCount ?? 0)),
          }
        : createTextGenerationMetadata(
            getDefaultResumeLlmModels(),
            getDefaultResumeLlmModels(),
            []
          ),
      lastImageGeneration: manifest.lastImageGeneration ?? createImageGenerationMetadata(0),
      count: manifest.count ?? normalizedResumes.length,
      resumes: normalizedResumes,
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

  const pdfFiles = await readdir(PDF_DIRECTORY);

  return {
    manifest,
    pdfCount: pdfFiles.length,
  };
}
