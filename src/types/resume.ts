export interface ResumeLanguage {
  name: string;
  level: string;
}

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

export interface CandidateResume {
  id: string;
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
}

export interface GeneratedResumeArtifact {
  id: string;
  fullName: string;
  primaryRole: string;
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
}

export interface ResumeDatasetManifest {
  datasetId: string;
  generatedAt: string;
  lastGenerationMode: ResumeGenerationMode;
  lastBatchCount: number;
  outputDirectory: string;
  pdfDirectory: string;
  metadataDirectory: string;
  count: number;
  resumes: GeneratedResumeArtifact[];
}
