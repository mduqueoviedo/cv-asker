import { env, getOpenRouterApiKey } from '../../config/env.js';
import { fetchAiJsonWithRetry } from './ai-http.service.js';
import type {
  OpenRouterChatCompletionResponse,
  OpenRouterMessageContentPart,
  OpenRouterMessage,
  OpenRouterPlugin,
  OpenRouterProviderPreferences,
  OpenRouterResponseFormat,
} from '../../types/openrouter.js';

export interface GenerateTextCompletionInput {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  maxTokens?: number;
  responseFormat?: OpenRouterResponseFormat;
  plugins?: OpenRouterPlugin[];
  provider?: OpenRouterProviderPreferences;
  assistantPrefill?: string;
}

function extractMessageContent(
  content: string | OpenRouterMessageContentPart[] | undefined
): string {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .filter((part) => !part?.type || part.type === 'text')
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }

  return '';
}

function createEmptyPayloadError(
  data: OpenRouterChatCompletionResponse,
  model: string
): Error {
  const firstChoice = data.choices?.[0];
  const details = firstChoice
    ? JSON.stringify(
        {
          finish_reason: firstChoice.finish_reason,
          text: firstChoice.text,
          message: firstChoice.message,
        },
        null,
        2
      )
    : 'No choices were returned.';

  return new Error(
    `OpenRouter returned an empty completion payload for model "${model}". First choice: ${details}`
  );
}

export async function generateTextCompletion(
  input: GenerateTextCompletionInput
): Promise<string> {
  const model = input.model ?? env.openRouterModel;
  const requestStartedAt = Date.now();
  const messages: OpenRouterMessage[] = [
    ...(input.systemInstruction
      ? [{ role: 'system' as const, content: input.systemInstruction }]
      : []),
    { role: 'user', content: input.prompt },
    ...(input.assistantPrefill
      ? [{ role: 'assistant' as const, content: input.assistantPrefill }]
      : []),
  ];

  console.log(
    `[AI Completion] Request started (model=${model}, messages=${messages.length}, promptChars=${input.prompt.length})`
  );

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
      model,
      messages,
      max_tokens: input.maxTokens ?? env.aiCompletionMaxTokens,
      response_format: input.responseFormat,
      plugins: input.plugins,
      provider: input.provider,
    }),
    timeoutMs: env.aiRequestTimeoutMs,
    maxRetries: env.aiRequestMaxRetries,
    baseDelayMs: env.aiRequestBaseDelayMs,
  });
  const firstChoice = data.choices?.[0];
  const completionText =
    extractMessageContent(firstChoice?.message?.content) ||
    firstChoice?.message?.reasoning?.trim() ||
    firstChoice?.text?.trim() ||
    '';

  if (!completionText) {
    throw createEmptyPayloadError(data, model);
  }

  console.log(
    `[AI Completion] Request completed (model=${model}, outputChars=${completionText.length}, elapsedMs=${Date.now() - requestStartedAt})`
  );

  return completionText;
}
