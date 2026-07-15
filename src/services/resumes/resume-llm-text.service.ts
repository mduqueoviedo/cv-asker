import { generateTextCompletion } from '../ai/ai.service.js';
import type {
  ResumeDocumentLanguage,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeLanguage,
} from '../../types/resume.js';

export interface ResumeProfileDraft {
  id: string;
  documentLanguage: ResumeDocumentLanguage;
  fullName: string;
  age: number;
  location: string;
  totalExperienceYears: number;
}

export interface ResumeGeneratedProfile {
  id: string;
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
  model: string;
  batchSize: number;
}

interface LlmResumeProfileItem {
  id: string;
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

interface LlmResumeProfilePayload {
  candidates: LlmResumeProfileItem[];
}

function chunkArray<T>(values: T[], size: number): T[][];
function chunkArray<T>(values: T[], size: number): Array<T[]> {
  const chunks: Array<T[]> = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function getLocaleInstruction(language: ResumeDocumentLanguage): string {
  return language === 'es-ES'
    ? 'Write all resume content in professional Spanish from Spain.'
    : 'Write all resume content in professional English.';
}

function extractJsonPayload(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith('```')) {
    const withoutFenceStart = trimmed.replace(/^```(?:json)?\s*/i, '');
    return withoutFenceStart.replace(/\s*```$/, '');
  }

  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');

  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');

  if (objectStart >= 0 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  throw new Error('Model response did not contain a JSON payload.');
}

function parseProfilePayload(text: string): LlmResumeProfilePayload {
  const parsed = JSON.parse(extractJsonPayload(text)) as unknown;

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('candidates' in parsed) ||
    !Array.isArray((parsed as { candidates?: unknown }).candidates)
  ) {
    throw new Error('Model response did not match the expected JSON object schema.');
  }

  return parsed as LlmResumeProfilePayload;
}

function assertNonEmptyString(value: unknown, fieldName: string, candidateId: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Model response returned an invalid ${fieldName} for candidate "${candidateId}".`);
  }

  return value.trim();
}

function validateLanguages(value: unknown, candidateId: string): ResumeLanguage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Model response must return at least one spoken language for candidate "${candidateId}".`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(
        `Model response returned an invalid spoken language at index ${index} for candidate "${candidateId}".`
      );
    }

    const language = entry as { name?: unknown; level?: unknown };

    return {
      name: assertNonEmptyString(language.name, `spoken language name at index ${index}`, candidateId),
      level: assertNonEmptyString(language.level, `spoken language level at index ${index}`, candidateId),
    };
  });
}

function validateEducation(value: unknown, candidateId: string): ResumeEducationEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Model response must return at least one education entry for candidate "${candidateId}".`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(
        `Model response returned an invalid education entry at index ${index} for candidate "${candidateId}".`
      );
    }

    const education = entry as {
      degree?: unknown;
      institution?: unknown;
      location?: unknown;
      startYear?: unknown;
      endYear?: unknown;
    };

    if (
      !Number.isInteger(education.startYear) ||
      !Number.isInteger(education.endYear) ||
      (education.startYear as number) > (education.endYear as number)
    ) {
      throw new Error(
        `Model response returned invalid education years at index ${index} for candidate "${candidateId}".`
      );
    }

    return {
      degree: assertNonEmptyString(education.degree, `education degree at index ${index}`, candidateId),
      institution: assertNonEmptyString(
        education.institution,
        `education institution at index ${index}`,
        candidateId
      ),
      location: assertNonEmptyString(education.location, `education location at index ${index}`, candidateId),
      startYear: education.startYear as number,
      endYear: education.endYear as number,
    };
  });
}

function validateExperience(value: unknown, candidateId: string): ResumeExperienceEntry[] {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error(`Model response must return at least two experience entries for candidate "${candidateId}".`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(
        `Model response returned an invalid experience entry at index ${index} for candidate "${candidateId}".`
      );
    }

    const experience = entry as {
      company?: unknown;
      title?: unknown;
      startDate?: unknown;
      endDate?: unknown;
      achievements?: unknown;
    };

    if (!Array.isArray(experience.achievements) || experience.achievements.length !== 2) {
      throw new Error(
        `Model response must return exactly two achievements for experience ${index + 1} of candidate "${candidateId}".`
      );
    }

    return {
      company: assertNonEmptyString(experience.company, `experience company at index ${index}`, candidateId),
      title: assertNonEmptyString(experience.title, `experience title at index ${index}`, candidateId),
      startDate: assertNonEmptyString(experience.startDate, `experience startDate at index ${index}`, candidateId),
      endDate: assertNonEmptyString(experience.endDate, `experience endDate at index ${index}`, candidateId),
      achievements: experience.achievements.map((achievement, achievementIndex) =>
        assertNonEmptyString(
          achievement,
          `experience achievement ${achievementIndex + 1} at index ${index}`,
          candidateId
        )
      ),
    };
  });
}

function validateStringList(
  value: unknown,
  fieldName: string,
  candidateId: string,
  minItems: number
): string[] {
  if (!Array.isArray(value) || value.length < minItems) {
    throw new Error(
      `Model response must return at least ${minItems} ${fieldName} item(s) for candidate "${candidateId}".`
    );
  }

  return value.map((entry, index) =>
    assertNonEmptyString(entry, `${fieldName} item at index ${index}`, candidateId)
  );
}

function validateProfileItem(
  item: LlmResumeProfileItem,
  draft: ResumeProfileDraft
): ResumeGeneratedProfile {
  if (item.id !== draft.id) {
    throw new Error(`Model response returned candidate id "${item.id}" but expected "${draft.id}".`);
  }

  if (typeof item.includePortfolio !== 'boolean') {
    throw new Error(`Model response returned an invalid includePortfolio flag for candidate "${draft.id}".`);
  }

  return {
    id: draft.id,
    primaryRole: assertNonEmptyString(item.primaryRole, 'primaryRole', draft.id),
    summary: assertNonEmptyString(item.summary, 'summary', draft.id),
    coreTechnologies: validateStringList(item.coreTechnologies, 'coreTechnologies', draft.id, 5),
    spokenLanguages: validateLanguages(item.spokenLanguages, draft.id),
    education: validateEducation(item.education, draft.id),
    experience: validateExperience(item.experience, draft.id),
    highlights: validateStringList(item.highlights, 'highlights', draft.id, 3).slice(0, 3),
    certifications: Array.isArray(item.certifications)
      ? item.certifications.map((certification, index) =>
          assertNonEmptyString(certification, `certification at index ${index}`, draft.id)
        )
      : [],
    includePortfolio: item.includePortfolio,
  };
}

function createPrompt(batch: ResumeProfileDraft[]): string {
  const language = batch[0]?.documentLanguage ?? 'en';

  return [
    'Generate complete synthetic technology resume profiles for each candidate below.',
    getLocaleInstruction(language),
    'Return raw JSON only. Do not wrap it in Markdown fences.',
    'You may invent professional details that are not in the input, but they must remain realistic and internally consistent.',
    'Every candidate must feel different from the others in role, career path, stack, education, and certifications.',
    'Use the provided age, location, and totalExperienceYears as hard constraints.',
    'Use exactly 3 highlights and exactly 2 achievements per experience entry.',
    'Use 2 to 4 work experience entries per candidate.',
    'Use 1 or 2 education entries per candidate.',
    'Use 5 to 10 core technologies per candidate.',
    'Set includePortfolio to true only when a public portfolio is plausible for that profile.',
    'Format experience dates as "Mon YYYY" / "Present" in English or localized equivalents in Spanish.',
    'Use this exact schema:',
    '{ "candidates": [ { "id": "string", "primaryRole": "string", "summary": "string", "coreTechnologies": ["string"], "spokenLanguages": [{ "name": "string", "level": "string" }], "education": [{ "degree": "string", "institution": "string", "location": "string", "startYear": 2018, "endYear": 2022 }], "experience": [{ "company": "string", "title": "string", "startDate": "string", "endDate": "string", "achievements": ["string", "string"] }], "highlights": ["string", "string", "string"], "certifications": ["string"], "includePortfolio": true } ] }',
    '',
    JSON.stringify(
      {
        candidates: batch,
      },
      null,
      2
    ),
  ].join('\n');
}

export async function generateResumeProfiles(
  input: GenerateResumeProfilesInput
): Promise<Map<string, ResumeGeneratedProfile>> {
  const profiles = new Map<string, ResumeGeneratedProfile>();

  for (const batch of chunkArray(input.drafts, input.batchSize)) {
    const response = await generateTextCompletion({
      model: input.model,
      systemInstruction:
        'You are a senior resume writer producing structured JSON for synthetic but realistic technology resumes.',
      prompt: createPrompt(batch),
    });
    const payload = parseProfilePayload(response);

    if (payload.candidates.length !== batch.length) {
      throw new Error(
        `Model returned ${payload.candidates.length} candidates but ${batch.length} were requested.`
      );
    }

    batch.forEach((draft, index) => {
      const candidate = payload.candidates[index];
      profiles.set(draft.id, validateProfileItem(candidate, draft));
    });
  }

  return profiles;
}
