import { env } from '../../config/env.js';
import type { CandidateResume, ResumePhotoAsset } from '../../types/resume.js';
import { generateImage } from '../ai/image-generation.service.js';

const CREATIVE_VARIANTS = [
  'navy blazer',
  'charcoal suit',
  'light linen blazer',
  'clean tech hoodie under a blazer',
  'copper dyed hair',
  'blue streaked hair',
  'silver dyed hair',
  'patterned tie',
  'bold glasses',
  'monochrome outfit',
] as const;

function createStableIndex(value: string, length: number): number {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash % length;
}

function createPhotoPrompt(candidate: CandidateResume): string {
  const genderToken = candidate.grammaticalGender === 'feminine' ? 'woman' : 'man';
  const creativeVariant = CREATIVE_VARIANTS[createStableIndex(candidate.id, CREATIVE_VARIANTS.length)];

  return [
    'Photorealistic headshot, fictional resume candidate.',
    `${candidate.age}yo ${genderToken}, ${candidate.primaryRole}, ${candidate.location}.`,
    `Chest-up, eye contact, soft light, neutral background, ${creativeVariant}.`,
    'One adult, realistic skin, no text, no logo, no watermark, no extra limbs.',
  ].join(' ');
}

export async function generateResumePhoto(candidate: CandidateResume): Promise<ResumePhotoAsset> {
  const prompt = createPhotoPrompt(candidate);
  const image = await generateImage({
    prompt,
    model: env.imageGenerationModel,
    mimeType: 'image/jpeg',
    aspectRatio: '4:5',
    imageSize: '1024px',
  });

  return {
    provider: image.provider,
    mimeType: image.mimeType,
    dataUri: image.dataUri,
    prompt: image.prompt,
    model: image.model,
  };
}
