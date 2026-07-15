import { env, getOpenRouterApiKey } from '../../config/env.js';
import type { GeneratedImage, GenerateImageInput } from './image-generation.service.js';
import { fetchAiJsonWithRetry } from './ai-http.service.js';

interface OpenRouterImageResponse {
  data?: Array<{
    b64_json?: string;
    media_type?: string;
  }>;
  usage?: {
    cost?: number;
  };
}

function resolveOutputFormat(mimeType: string): 'jpeg' | 'png' {
  return mimeType === 'image/png' ? 'png' : 'jpeg';
}

function createEmptyImagePayloadError(data: OpenRouterImageResponse, model: string): Error {
  return new Error(
    `OpenRouter returned an empty image payload for model "${model}". Response: ${JSON.stringify(data).slice(0, 1200)}`
  );
}

export async function generateImageWithOpenRouter(
  input: GenerateImageInput
): Promise<GeneratedImage> {
  const model = input.model ?? env.openRouterImageModel;
  const mimeType = input.mimeType ?? 'image/jpeg';
  const requestStartedAt = Date.now();

  console.log(
    `[OpenRouter Image] Request started (model=${model}, promptChars=${input.prompt.length}, mimeType=${mimeType})`
  );

  const data = await fetchAiJsonWithRetry<OpenRouterImageResponse>({
    url: env.openRouterImagesApiUrl,
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenRouterApiKey()}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': `http://localhost:${env.port}`,
      'X-Title': env.appTitle,
    },
    body: JSON.stringify({
      model,
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio ?? '4:5',
      size: input.imageSize ?? '768x960',
      quality: input.quality ?? 'low',
      output_format: resolveOutputFormat(mimeType),
      output_compression: input.outputCompression ?? 70,
    }),
    timeoutMs: env.aiRequestTimeoutMs,
    maxRetries: env.aiRequestMaxRetries,
    baseDelayMs: env.aiRequestBaseDelayMs,
  });

  const firstImage = data.data?.[0];
  const imageBase64 = firstImage?.b64_json?.trim() ?? '';

  if (!imageBase64) {
    throw createEmptyImagePayloadError(data, model);
  }

  const outputMimeType = firstImage?.media_type?.trim() || mimeType;

  console.log(
    `[OpenRouter Image] Request completed (model=${model}, bytes=${Buffer.from(imageBase64, 'base64').length}, cost=${data.usage?.cost ?? 'n/a'}, elapsedMs=${Date.now() - requestStartedAt})`
  );

  return {
    provider: 'openrouter',
    model,
    prompt: input.prompt,
    mimeType: outputMimeType,
    dataBase64: imageBase64,
    dataUri: `data:${outputMimeType};base64,${imageBase64}`,
  };
}
