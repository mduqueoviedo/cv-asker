import { env, getOpenRouterApiKey } from '../config/env.js';
import { resumeGenerationConfig } from '../config/resume-generation.js';
import { fetchAiJsonWithRetry } from './ai-http.service.js';

export interface GenerateImageInput {
  prompt: string;
  model?: string;
  mimeType?: 'image/jpeg' | 'image/png';
  aspectRatio?: string;
  imageSize?: string;
  quality?: 'auto' | 'low' | 'medium' | 'high';
  outputCompression?: number;
}

export interface GeneratedImage {
  provider: string;
  model: string;
  prompt: string;
  mimeType: string;
  dataBase64: string;
  dataUri: string;
}

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
  const model = input.model ?? resumeGenerationConfig.imageGeneration.model;
  const mimeType = input.mimeType ?? 'image/jpeg';
  const requestStartedAt = Date.now();

  console.log(
    `[OpenRouter Image] Request started (model=${model}, promptChars=${input.prompt.length}, mimeType=${mimeType})`
  );

  const data = await fetchAiJsonWithRetry<OpenRouterImageResponse>({
    url: resumeGenerationConfig.openRouter.imagesApiUrl,
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
      aspect_ratio: input.aspectRatio ?? resumeGenerationConfig.imageGeneration.aspectRatio,
      size: input.imageSize ?? resumeGenerationConfig.imageGeneration.imageSize,
      quality: input.quality ?? resumeGenerationConfig.imageGeneration.quality,
      output_format: resolveOutputFormat(mimeType),
      output_compression:
        input.outputCompression ?? resumeGenerationConfig.imageGeneration.outputCompression,
    }),
    timeoutMs: resumeGenerationConfig.aiRequest.timeoutMs,
    maxRetries: resumeGenerationConfig.aiRequest.maxRetries,
    baseDelayMs: resumeGenerationConfig.aiRequest.baseDelayMs,
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
