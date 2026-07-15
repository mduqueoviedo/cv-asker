import { env, getImageGenerationApiKey } from '../../config/env.js';
import type { GeminiInteractionsResponse } from '../../types/gemini.js';
import { fetchAiJsonWithRetry } from './ai-http.service.js';
import type { GenerateImageInput, GeneratedImage } from './image-generation.service.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractInlineImage(
  value: unknown,
  fallbackMimeType: string,
  visited = new WeakSet<object>()
): { dataBase64: string; mimeType: string } | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = extractInlineImage(item, fallbackMimeType, visited);

      if (match) {
        return match;
      }
    }

    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (visited.has(value)) {
    return null;
  }

  visited.add(value);

  const data = typeof value.data === 'string' ? value.data.trim() : '';
  const mimeType =
    typeof value.mime_type === 'string'
      ? value.mime_type
      : typeof value.mimeType === 'string'
        ? value.mimeType
        : fallbackMimeType;
  const type = typeof value.type === 'string' ? value.type : '';

  if (data && (mimeType.startsWith('image/') || type === 'image')) {
    return {
      dataBase64: data,
      mimeType: mimeType.startsWith('image/') ? mimeType : fallbackMimeType,
    };
  }

  for (const child of Object.values(value)) {
    const match = extractInlineImage(child, fallbackMimeType, visited);

    if (match) {
      return match;
    }
  }

  return null;
}

function summarizeResponse(response: GeminiInteractionsResponse): string {
  try {
    return JSON.stringify(response).slice(0, 1200);
  } catch {
    return '[unserializable Gemini response]';
  }
}

export async function generateImageWithGemini(
  input: GenerateImageInput
): Promise<GeneratedImage> {
  const model = input.model ?? env.geminiImageModel;
  const mimeType = input.mimeType ?? 'image/jpeg';
  const requestStartedAt = Date.now();

  console.log(
    `[Gemini Image] Request started (model=${model}, promptChars=${input.prompt.length}, mimeType=${mimeType})`
  );

  const response = await fetchAiJsonWithRetry<GeminiInteractionsResponse>({
    url: env.geminiApiUrl,
    method: 'POST',
    headers: {
      'x-goog-api-key': getImageGenerationApiKey(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [{ type: 'text', text: input.prompt }],
      response_format: {
        type: 'image',
        mime_type: mimeType,
        aspect_ratio: input.aspectRatio ?? '4:5',
        image_size: input.imageSize ?? '1024px',
      },
    }),
    timeoutMs: env.aiRequestTimeoutMs,
    maxRetries: env.aiRequestMaxRetries,
    baseDelayMs: env.aiRequestBaseDelayMs,
  });

  const image = extractInlineImage(response.output_image ?? response, mimeType);

  if (!image) {
    throw new Error(
      `Gemini did not return an inline image payload for model "${model}". Response snippet: ${summarizeResponse(response)}`
    );
  }

  console.log(
    `[Gemini Image] Request completed (model=${model}, bytes=${Buffer.from(image.dataBase64, 'base64').length}, elapsedMs=${Date.now() - requestStartedAt})`
  );

  return {
    provider: 'gemini',
    model,
    prompt: input.prompt,
    mimeType: image.mimeType,
    dataBase64: image.dataBase64,
    dataUri: `data:${image.mimeType};base64,${image.dataBase64}`,
  };
}
