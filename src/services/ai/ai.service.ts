import { env, getOpenRouterApiKey } from '../../config/env.js';
import { fetchAiJsonWithRetry } from './ai-http.service.js';
import type {
  OpenRouterChatCompletionResponse,
  OpenRouterMessage,
} from '../../types/openrouter.js';

export interface GenerateTextCompletionInput {
  prompt: string;
  systemInstruction?: string;
}

export async function generateTextCompletion(
  input: GenerateTextCompletionInput
): Promise<string> {
  const messages: OpenRouterMessage[] = [
    ...(input.systemInstruction
      ? [{ role: 'system' as const, content: input.systemInstruction }]
      : []),
    { role: 'user', content: input.prompt },
  ];

  const data = await fetchAiJsonWithRetry<OpenRouterChatCompletionResponse>({
    url: env.openRouterApiUrl,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenRouterApiKey()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': `http://localhost:${env.port}`,
      'X-Title': env.appTitle,
    },
    body: JSON.stringify({
      model: env.openRouterModel,
      messages,
    }),
    timeoutMs: env.aiRequestTimeoutMs,
    maxRetries: env.aiRequestMaxRetries,
    baseDelayMs: env.aiRequestBaseDelayMs,
  });
  const completionText = data.choices?.[0]?.message?.content?.trim();

  if (!completionText) {
    throw new Error('OpenRouter returned an empty completion payload.');
  }

  return completionText;
}
