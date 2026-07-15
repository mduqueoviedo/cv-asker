import { env } from '../../config/env.js';
import { generateImageWithOpenRouter } from './openrouter-image.service.js';

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

export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  return generateImageWithOpenRouter({
    ...input,
    model: input.model ?? env.openRouterImageModel,
  });
}
