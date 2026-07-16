import type {
  ResumeDocumentLanguage,
  ResumeDocumentLanguageSelection,
  ResumeGenerationMode,
  ResumeTemplateId,
  ResumeTemplateSelection,
} from '../types/resume.js';

export const supportedResumeLanguages = [
  'en',
  'es-ES',
] as const satisfies readonly ResumeDocumentLanguage[];
export const supportedResumeTemplates = [
  'aurora-split',
  'paper-compact',
] as const satisfies readonly ResumeTemplateId[];
const DEFAULT_OPENROUTER_MODELS = [
  'google/gemini-2.5-flash-lite',
  'google/gemma-3-27b-it:free',
  'openai/gpt-oss-20b:free',
] as const;
const DEFAULT_RAG_ANSWER_MODEL = 'google/gemini-2.5-flash';

export const resumeGenerationConfig = {
  defaults: {
    count: 5,
    mode: 'replace' as ResumeGenerationMode,
    language: 'mixed' as ResumeDocumentLanguageSelection,
    template: 'mixed' as ResumeTemplateSelection,
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
  rag: {
    answering: {
      defaultModel: DEFAULT_RAG_ANSWER_MODEL,
      maxTokens: 500,
      topMatchesForAnswer: 4,
    },
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

export function getDefaultRagAnswerModel(): string {
  return resumeGenerationConfig.rag.answering.defaultModel;
}

export function isResumeDocumentLanguage(value: string): value is ResumeDocumentLanguage {
  return supportedResumeLanguages.includes(value as ResumeDocumentLanguage);
}

export function isResumeTemplateId(value: string): value is ResumeTemplateId {
  return supportedResumeTemplates.includes(value as ResumeTemplateId);
}
