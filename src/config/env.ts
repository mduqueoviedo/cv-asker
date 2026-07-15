import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_PORT = 3000;

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
export const env = {
  appTitle: 'CV Asker',
  port: parsePort(process.env.PORT),
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
