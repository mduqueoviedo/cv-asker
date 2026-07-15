import dotenv from 'dotenv';
import type { ResumeDocumentLanguage } from '../types/resume.js';

dotenv.config();

const DEFAULT_PORT = 3000;
const DEFAULT_OPENROUTER_MODELS = [
  'google/gemini-2.5-flash-lite',
  'google/gemma-3-27b-it:free',
  'openai/gpt-oss-20b:free',
] as const;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_AI_REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_AI_REQUEST_MAX_RETRIES = 2;
const DEFAULT_AI_REQUEST_BASE_DELAY_MS = 600;
const DEFAULT_AI_COMPLETION_MAX_TOKENS = 600;
const DEFAULT_RESUME_TEXT_BATCH_SIZE = 2;
const DEFAULT_RESUME_LANGUAGE: ResumeDocumentLanguage = 'en';

function parsePort(value: string | undefined): number {
  if (!value) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number(value);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error('PORT must be a positive integer.');
  }

  return parsedPort;
}

function parsePositiveInteger(
  value: string | undefined,
  defaultValue: number,
  variableName: string
): number {
  if (!value) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${variableName} must be a positive integer.`);
  }

  return parsedValue;
}

function parseNonEmptyStringList(value: string, variableName: string): string[] {
  const values = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (values.length === 0) {
    throw new Error(`${variableName} must include at least one model id.`);
  }

  return [...new Set(values)];
}

function resolveOpenRouterModels(): string[] {
  if (process.env.OPENROUTER_MODELS) {
    return parseNonEmptyStringList(process.env.OPENROUTER_MODELS, 'OPENROUTER_MODELS');
  }

  if (process.env.OPENROUTER_MODEL?.trim()) {
    return [process.env.OPENROUTER_MODEL.trim()];
  }

  return [...DEFAULT_OPENROUTER_MODELS];
}

const openRouterModels = resolveOpenRouterModels();

function parseResumeDocumentLanguage(
  value: string | undefined,
  defaultValue: ResumeDocumentLanguage,
  variableName: string
): ResumeDocumentLanguage {
  if (!value) {
    return defaultValue;
  }

  if (value !== 'en' && value !== 'es-ES') {
    throw new Error(`${variableName} must be either "en" or "es-ES".`);
  }

  return value;
}

export const env = {
  appTitle: 'CV Asker',
  port: parsePort(process.env.PORT),
  openRouterApiUrl: OPENROUTER_API_URL,
  openRouterModels,
  openRouterModel: openRouterModels[0],
  aiRequestTimeoutMs: parsePositiveInteger(
    process.env.AI_REQUEST_TIMEOUT_MS,
    DEFAULT_AI_REQUEST_TIMEOUT_MS,
    'AI_REQUEST_TIMEOUT_MS'
  ),
  aiRequestMaxRetries: parsePositiveInteger(
    process.env.AI_REQUEST_MAX_RETRIES,
    DEFAULT_AI_REQUEST_MAX_RETRIES,
    'AI_REQUEST_MAX_RETRIES'
  ),
  aiRequestBaseDelayMs: parsePositiveInteger(
    process.env.AI_REQUEST_BASE_DELAY_MS,
    DEFAULT_AI_REQUEST_BASE_DELAY_MS,
    'AI_REQUEST_BASE_DELAY_MS'
  ),
  aiCompletionMaxTokens: parsePositiveInteger(
    process.env.AI_COMPLETION_MAX_TOKENS,
    DEFAULT_AI_COMPLETION_MAX_TOKENS,
    'AI_COMPLETION_MAX_TOKENS'
  ),
  resumeTextBatchSize: parsePositiveInteger(
    process.env.RESUME_TEXT_BATCH_SIZE,
    DEFAULT_RESUME_TEXT_BATCH_SIZE,
    'RESUME_TEXT_BATCH_SIZE'
  ),
  defaultResumeLanguage: parseResumeDocumentLanguage(
    process.env.RESUME_DEFAULT_LANGUAGE,
    DEFAULT_RESUME_LANGUAGE,
    'RESUME_DEFAULT_LANGUAGE'
  ),
};

export function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required to call OpenRouter.');
  }

  return apiKey;
}

export function hasOpenRouterApiKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}
