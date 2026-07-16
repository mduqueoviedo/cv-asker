import { hasOpenRouterApiKey } from '../../../shared/config/env.js';
import { resumeGenerationConfig } from '../../../shared/config/resume-generation.js';
import { generateTextCompletion } from '../../../shared/ai/ai.service.js';
import type {
  ResumeDocumentLanguage,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeGrammaticalGender,
  ResumeLanguage,
} from '../types/resume.js';
import { createLocalResumeProfile } from './resume-local-profile.provider.js';

export interface ResumeProfileDraft {
  id: string;
  seed: number;
  documentLanguage: ResumeDocumentLanguage;
  fullName: string;
  grammaticalGender: ResumeGrammaticalGender;
  age: number;
  location: string;
  totalExperienceYears: number;
}

export interface ResumeGeneratedProfile {
  id: string;
  llmModel: string;
  primaryRole: string;
  summary: string;
  coreTechnologies: string[];
  spokenLanguages: ResumeLanguage[];
  education: ResumeEducationEntry[];
  experience: ResumeExperienceEntry[];
  highlights: string[];
  certifications: string[];
  includePortfolio: boolean;
}

interface GenerateResumeProfilesInput {
  drafts: ResumeProfileDraft[];
  models: string[];
  batchSize: number;
}

interface LlmResumeNarrativeItem {
  id: string;
  summary: string;
  highlights: string[];
}

interface LlmResumeNarrativePayload {
  candidates: LlmResumeNarrativeItem[];
}

const JSON_RESPONSE_HEALING_PLUGIN = { id: 'response-healing' } as const;

function chunkArray<T>(values: T[], size: number): Array<T[]> {
  const chunks: Array<T[]> = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function groupDraftsByLanguage(
  drafts: ResumeProfileDraft[]
): Array<{ language: ResumeDocumentLanguage; drafts: ResumeProfileDraft[] }> {
  const grouped = new Map<ResumeDocumentLanguage, ResumeProfileDraft[]>();

  for (const draft of drafts) {
    const current = grouped.get(draft.documentLanguage);

    if (current) {
      current.push(draft);
      continue;
    }

    grouped.set(draft.documentLanguage, [draft]);
  }

  return [...grouped.entries()].map(([language, groupedDrafts]) => ({
    language,
    drafts: groupedDrafts,
  }));
}

function getLocaleInstruction(language: ResumeDocumentLanguage): string {
  return language === 'es-ES'
    ? 'Write all generated text in professional Spanish from Spain.'
    : 'Write all generated text in professional English.';
}

function extractJsonPayload(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith('```')) {
    const withoutFenceStart = trimmed.replace(/^```(?:json)?\s*/i, '');
    return withoutFenceStart.replace(/\s*```$/, '');
  }

  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');

  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  throw new Error('Model response did not contain a JSON payload.');
}

function parseNarrativePayload(text: string): LlmResumeNarrativePayload {
  const jsonPayload = extractJsonPayload(text);
  const normalizedPayload = jsonPayload.replace(/,\s*([}\]])/g, '$1');
  const parsed = JSON.parse(normalizedPayload) as unknown;

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('candidates' in parsed) ||
    !Array.isArray((parsed as { candidates?: unknown }).candidates)
  ) {
    throw new Error('Model response did not match the expected JSON object schema.');
  }

  return parsed as LlmResumeNarrativePayload;
}

function assertNonEmptyString(value: unknown, fieldName: string, candidateId: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Model response returned an invalid ${fieldName} for candidate "${candidateId}".`);
  }

  return value.trim();
}

function validateHighlights(value: unknown, candidateId: string): string[] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`Model response must return exactly 3 highlights for candidate "${candidateId}".`);
  }

  return value.map((entry, index) =>
    assertNonEmptyString(entry, `highlight ${index + 1}`, candidateId)
  );
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function createPrompt(
  batch: Array<{ draft: ResumeProfileDraft; profile: ResumeGeneratedProfile }>
): string {
  const language = batch[0]?.draft.documentLanguage ?? 'en';
  const grammarInstruction =
    language === 'es-ES'
      ? 'Respect grammatical gender agreement in Spanish. If the provided primaryRole is feminine, keep the summary and highlights feminine. If it is masculine, keep them masculine.'
      : 'Keep the summary and highlights aligned with the provided role wording and tone.';

  return [
    'Improve the professional voice for these synthetic resumes.',
    getLocaleInstruction(language),
    'Return valid JSON only. Do not wrap the response in Markdown fences.',
    'For each candidate, write one professional summary of 30 to 55 words and exactly 3 concise highlights.',
    'Keep the role, seniority, location, and technologies coherent with the input.',
    grammarInstruction,
    'Do not invent employers, certifications, or technologies that contradict the input.',
    'Avoid filler, repeated openings, and exaggerated claims.',
    'The response must be a single JSON object with a top-level "candidates" array.',
    '',
    JSON.stringify(
      {
        candidates: batch.map(({ draft, profile }) => ({
          id: draft.id,
          documentLanguage: draft.documentLanguage,
          grammaticalGender: draft.grammaticalGender,
          location: draft.location,
          totalExperienceYears: draft.totalExperienceYears,
          primaryRole: profile.primaryRole,
          coreTechnologies: profile.coreTechnologies.slice(0, 5),
          currentCompany: profile.experience.at(-1)?.company,
        })),
      },
      null,
      2
    ),
  ].join('\n');
}

function createResumeNarrativeResponseSchema(candidateCount: number) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['candidates'],
    properties: {
      candidates: {
        type: 'array',
        minItems: candidateCount,
        maxItems: candidateCount,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'summary', 'highlights'],
          properties: {
            id: {
              type: 'string',
            },
            summary: {
              type: 'string',
              minLength: 40,
              maxLength: 360,
            },
            highlights: {
              type: 'array',
              minItems: 3,
              maxItems: 3,
              items: {
                type: 'string',
                minLength: 12,
                maxLength: 120,
              },
            },
          },
        },
      },
    },
  };
}

function mergeNarrativeIntoProfile(
  profile: ResumeGeneratedProfile,
  narrative: LlmResumeNarrativeItem,
  llmModel: string
): ResumeGeneratedProfile {
  return {
    ...profile,
    llmModel,
    summary: assertNonEmptyString(narrative.summary, 'summary', profile.id),
    highlights: validateHighlights(narrative.highlights, profile.id),
  };
}

function createBaseProfiles(drafts: ResumeProfileDraft[]): Map<string, ResumeGeneratedProfile> {
  return new Map(
    drafts.map((draft) => [draft.id, createLocalResumeProfile(draft)] satisfies [string, ResumeGeneratedProfile])
  );
}

async function tryEnrichBatch(
  batch: Array<{ draft: ResumeProfileDraft; profile: ResumeGeneratedProfile }>,
  models: string[],
  batchLabel: string
): Promise<Map<string, ResumeGeneratedProfile> | null> {
  const responseSchema = createResumeNarrativeResponseSchema(batch.length);
  let lastError: unknown = null;

  for (const [modelIndex, model] of models.entries()) {
    try {
      console.log(
        `[Resume LLM] ${batchLabel} model attempt ${modelIndex + 1}/${models.length} using ${model}`
      );

      const response = await generateTextCompletion({
        model,
        systemInstruction:
          'You enrich synthetic resumes with concise, realistic recruiter-friendly copy. Preserve grammatical agreement with the provided role and candidate context. Always return JSON only.',
        prompt: createPrompt(batch),
        maxTokens: Math.min(
          resumeGenerationConfig.textGeneration.completionMaxTokens,
          Math.max(240, batch.length * 220)
        ),
        responseFormat: {
          type: 'json_schema',
          json_schema: {
            name: 'resume_narratives',
            strict: true,
            schema: responseSchema,
          },
        },
        plugins: [JSON_RESPONSE_HEALING_PLUGIN],
        provider: {
          require_parameters: true,
        },
      });

      const payload = parseNarrativePayload(response);

      if (payload.candidates.length !== batch.length) {
        throw new Error(
          `Model response returned ${payload.candidates.length} candidate narratives but expected ${batch.length}.`
        );
      }

      const narrativeById = new Map(payload.candidates.map((item) => [item.id, item]));
      const enrichedProfiles = new Map<string, ResumeGeneratedProfile>();

      for (const entry of batch) {
        const narrative = narrativeById.get(entry.draft.id);

        if (!narrative) {
          throw new Error(`Model response did not include candidate "${entry.draft.id}".`);
        }

        enrichedProfiles.set(
          entry.draft.id,
          mergeNarrativeIntoProfile(entry.profile, narrative, model)
        );
      }

      console.log(`[Resume LLM] ${batchLabel} succeeded with ${model}`);
      return enrichedProfiles;
    } catch (error) {
      lastError = error;
      console.warn(
        `[Resume LLM] ${batchLabel} failed with ${model}: ${describeError(error)}`
      );
    }
  }

  console.warn(
    `[Resume LLM] ${batchLabel} exhausted configured models. Keeping local profiles. Last error: ${describeError(lastError)}`
  );
  return null;
}

export async function generateResumeProfiles(
  input: GenerateResumeProfilesInput
): Promise<Map<string, ResumeGeneratedProfile>> {
  const profiles = createBaseProfiles(input.drafts);

  if (input.models.length === 0) {
    console.warn('[Resume LLM] No models configured. Using local resume profiles only.');
    return profiles;
  }

  if (!hasOpenRouterApiKey()) {
    console.warn('[Resume LLM] OPENROUTER_API_KEY is missing. Using local resume profiles only.');
    return profiles;
  }

  const draftGroups = groupDraftsByLanguage(input.drafts);

  for (const [groupIndex, group] of draftGroups.entries()) {
    const batches = chunkArray(group.drafts, Math.max(1, input.batchSize));

    for (const [batchIndex, batchDrafts] of batches.entries()) {
      const batchStart = batchIndex * Math.max(1, input.batchSize) + 1;
      const batchEnd = batchStart + batchDrafts.length - 1;
      const batchStartedAt = Date.now();
      const batchLabel = `Batch ${groupIndex + 1}.${batchIndex + 1}/${draftGroups.length}.${batches.length} (${group.language})`;

      console.log(
        `[Resume LLM] ${batchLabel} started (${batchStart}-${batchEnd} of ${group.drafts.length} for ${group.language})`
      );

      const batch = batchDrafts.map((draft) => {
        const profile = profiles.get(draft.id);

        if (!profile) {
          throw new Error(`No base profile was created for candidate "${draft.id}".`);
        }

        return { draft, profile };
      });

      const enrichedBatch = await tryEnrichBatch(batch, input.models, batchLabel);

      if (enrichedBatch) {
        for (const [candidateId, profile] of enrichedBatch) {
          profiles.set(candidateId, profile);
        }
      } else if (batch.length > 1) {
        console.log(
          `[Resume LLM] ${batchLabel} retrying candidate-by-candidate before settling on local copy.`
        );

        for (const entry of batch) {
          const enrichedSingle = await tryEnrichBatch(
            [entry],
            input.models,
            `${batchLabel} candidate ${entry.draft.id}`
          );

          if (!enrichedSingle) {
            continue;
          }

          const profile = enrichedSingle.get(entry.draft.id);

          if (profile) {
            profiles.set(entry.draft.id, profile);
          }
        }
      }

      console.log(
        `[Resume LLM] ${batchLabel} completed (elapsedMs=${Date.now() - batchStartedAt})`
      );
    }
  }

  return profiles;
}
