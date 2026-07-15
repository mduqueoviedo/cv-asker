export interface ResumeLanguage {
  name: string;
  level: string;
}

export type ResumeDocumentLanguage = 'en' | 'es-ES';
export type ResumeTemplateId = 'aurora-split' | 'paper-compact';
export type ResumeDocumentLanguageSelection = ResumeDocumentLanguage | 'mixed';
export type ResumeTemplateSelection = ResumeTemplateId | 'mixed';
export type ResumeGrammaticalGender = 'feminine' | 'masculine';

export interface ResumeEducationEntry {
  degree: string;
  institution: string;
  location: string;
  startYear: number;
  endYear: number;
}

export interface ResumeExperienceEntry {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  achievements: string[];
}

export interface ResumePhotoPalette {
  background: [number, number, number];
  accent: [number, number, number];
  skin: [number, number, number];
  hair: [number, number, number];
  jacket: [number, number, number];
  shirt: [number, number, number];
}

export interface ResumePhotoAsset {
  provider: string;
  mimeType: string;
  dataUri: string;
  prompt: string;
  model: string;
}

export interface StoredResumePhotoAsset {
  provider: string;
  mimeType: string;
  prompt: string;
  model: string;
}

export interface CandidateResume {
  id: string;
  documentLanguage: ResumeDocumentLanguage;
  grammaticalGender: ResumeGrammaticalGender;
  fullName: string;
  age: number;
  primaryRole: string;
  location: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  portfolioUrl?: string;
  summary: string;
  totalExperienceYears: number;
  coreTechnologies: string[];
  spokenLanguages: ResumeLanguage[];
  education: ResumeEducationEntry[];
  experience: ResumeExperienceEntry[];
  highlights: string[];
  certifications: string[];
  photoPalette: ResumePhotoPalette;
  photo: ResumePhotoAsset;
}

export interface StoredCandidateResume extends Omit<CandidateResume, 'photo'> {
  template: ResumeTemplateId;
  photo: StoredResumePhotoAsset;
}

export interface GeneratedResumeArtifact {
  id: string;
  documentLanguage: ResumeDocumentLanguage;
  fullName: string;
  primaryRole: string;
  llmModel: string;
  template: ResumeTemplateId;
  pdfFileName: string;
  pdfFilePath: string;
  metadataFileName: string;
  metadataFilePath: string;
}

export type ResumeGenerationMode = 'replace' | 'append';

export interface GenerateResumeDatasetInput {
  count?: number;
  mode?: ResumeGenerationMode;
  cleanOutput?: boolean;
  language?: ResumeDocumentLanguageSelection;
  llmModel?: string;
  llmModels?: string[];
  template?: ResumeTemplateSelection;
}

export interface ResumeTextGenerationMetadata {
  strategy: 'faker-base-with-llm-enrichment';
  provider: 'openrouter';
  model: string;
  models: string[];
  usedModels: string[];
  batchSize: number;
  enrichedProfileCount: number;
  localProfileCount: number;
}

export interface ResumeImageGenerationMetadata {
  provider: string;
  model: string;
  generatedPhotoCount: number;
}

export interface ResumeDatasetManifest {
  datasetId: string;
  generatedAt: string;
  lastGenerationMode: ResumeGenerationMode;
  lastBatchCount: number;
  lastBatchLanguage: ResumeDocumentLanguageSelection;
  lastBatchLanguages: ResumeDocumentLanguage[];
  lastTemplate: ResumeTemplateSelection;
  lastBatchTemplates: ResumeTemplateId[];
  lastTextGeneration: ResumeTextGenerationMetadata;
  lastImageGeneration: ResumeImageGenerationMetadata;
  outputDirectory: string;
  pdfDirectory: string;
  metadataDirectory: string;
  count: number;
  resumes: GeneratedResumeArtifact[];
}
