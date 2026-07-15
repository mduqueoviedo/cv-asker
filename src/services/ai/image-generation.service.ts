import { env } from '../../config/env.js';
import { generateImageWithGemini } from './gemini-image.service.js';

export interface GenerateImageInput {
  prompt: string;
  model?: string;
  mimeType?: 'image/jpeg' | 'image/png';
  aspectRatio?: string;
  imageSize?: string;
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
  switch (env.imageGenerationProvider) {
    case 'gemini':
      return generateImageWithGemini({
        ...input,
        model: input.model ?? env.imageGenerationModel,
      });
  }
}
