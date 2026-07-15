import type {
  ResumeDocumentLanguage,
  ResumeGenerationMode,
  ResumeTemplateId,
} from '../types/resume.js';

const SUPPORTED_RESUME_LANGUAGES = ['en', 'es-ES'] as const satisfies readonly ResumeDocumentLanguage[];
const SUPPORTED_RESUME_TEMPLATES = ['aurora-split'] as const satisfies readonly ResumeTemplateId[];
const DEFAULT_OPENROUTER_MODELS = [
  'google/gemini-2.5-flash-lite',
  'google/gemma-3-27b-it:free',
  'openai/gpt-oss-20b:free',
] as const;

export const resumeGenerationConfig = {
  defaults: {
    count: 3,
    mode: 'replace' as ResumeGenerationMode,
    language: 'es-ES' as ResumeDocumentLanguage,
    template: 'aurora-split' as ResumeTemplateId,
  },
  limits: {
    count: {
      min: 1,
      max: 30,
    },
  },
  textGeneration: {
    provider: 'openrouter' as const,
    strategy: 'faker-base-with-llm-enrichment' as const,
    batchSize: 2,
    completionMaxTokens: 600,
    defaultModels: DEFAULT_OPENROUTER_MODELS,
  },
  imageGeneration: {
    provider: 'openrouter' as const,
    model: 'google/gemini-2.5-flash-image',
    aspectRatio: '4:5',
    imageSize: '768x960',
    quality: 'low' as const,
    outputCompression: 70,
  },
  aiRequest: {
    timeoutMs: 20_000,
    maxRetries: 2,
    baseDelayMs: 600,
  },
  openRouter: {
    chatApiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    imagesApiUrl: 'https://openrouter.ai/api/v1/images',
  },
} as const;

export function getDefaultResumeLlmModels(): string[] {
  return [...resumeGenerationConfig.textGeneration.defaultModels];
}

export function getDefaultResumeLlmModel(): string {
  return resumeGenerationConfig.textGeneration.defaultModels[0];
}

export function isResumeDocumentLanguage(value: string): value is ResumeDocumentLanguage {
  return SUPPORTED_RESUME_LANGUAGES.includes(value as ResumeDocumentLanguage);
}

export function isResumeTemplateId(value: string): value is ResumeTemplateId {
  return SUPPORTED_RESUME_TEMPLATES.includes(value as ResumeTemplateId);
}
