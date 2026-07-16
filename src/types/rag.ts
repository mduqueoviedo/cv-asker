import type { ResumeDocumentLanguage, ResumeTemplateId } from './resume.js';

export type ResumeSourceType = 'generated-dataset' | 'ad-hoc-file';
export type ParsedResumeDocumentLanguage = ResumeDocumentLanguage | 'unknown';
export type ParsedResumeTemplateId = ResumeTemplateId | 'unknown';

export interface PdfExtractionMetadata {
  tool: 'pdftotext';
  extractedAt: string;
  preserveLayout: boolean;
}

export interface NormalizedTextStats {
  characterCount: number;
  wordCount: number;
  paragraphCount: number;
  lineCount: number;
}

export interface ExtractedResumeTextDocument {
  datasetId: string;
  sourceType: ResumeSourceType;
  candidateId: string;
  fullName: string;
  primaryRole: string;
  documentLanguage: ParsedResumeDocumentLanguage;
  template: ParsedResumeTemplateId;
  pdfFileName: string;
  pdfFilePath: string;
  extraction: PdfExtractionMetadata;
  rawText: string;
  normalizedText: string;
  stats: NormalizedTextStats;
}

export type ResumeSectionKind =
  | 'profile'
  | 'contact'
  | 'summary'
  | 'highlights'
  | 'core_technologies'
  | 'experience'
  | 'education'
  | 'languages'
  | 'certifications'
  | 'misc';

export interface ParsedResumeSection {
  id: string;
  datasetId: string;
  candidateId: string;
  kind: ResumeSectionKind;
  label: string;
  order: number;
  confidence: number;
  classificationSignals: string[];
  content: string;
  paragraphs: string[];
  sourceParagraphIndexes: number[];
  characterCount: number;
  wordCount: number;
}

export interface ResumeTextChunk {
  id: string;
  datasetId: string;
  candidateId: string;
  sectionId: string;
  sectionKind: ResumeSectionKind;
  sectionLabel: string;
  order: number;
  text: string;
  paragraphCount: number;
  sourceParagraphIndexes: number[];
  characterCount: number;
  wordCount: number;
}

export interface StructuredResumeExperienceEntry {
  id: string;
  datasetId: string;
  candidateId: string;
  role: string | null;
  organization: string | null;
  location: string | null;
  dateRange: string | null;
  description: string;
  associatedSkills: string[];
  sourceSectionIds: string[];
  confidence: number;
  rawText: string;
}

export interface StructuredResumeEducationEntry {
  id: string;
  datasetId: string;
  candidateId: string;
  degree: string | null;
  institution: string | null;
  location: string | null;
  dateRange: string | null;
  notes: string | null;
  sourceSectionIds: string[];
  confidence: number;
  rawText: string;
}

export interface StructuredResumeLanguageEntry {
  id: string;
  datasetId: string;
  candidateId: string;
  language: string;
  level: string | null;
  note: string | null;
  sourceSectionIds: string[];
  confidence: number;
  rawText: string;
}

export interface StructuredResumeCertificationEntry {
  id: string;
  datasetId: string;
  candidateId: string;
  title: string;
  issuer: string | null;
  dateText: string | null;
  sourceSectionIds: string[];
  confidence: number;
  rawText: string;
}

export interface StructuredResumeData {
  experience: StructuredResumeExperienceEntry[];
  education: StructuredResumeEducationEntry[];
  languages: StructuredResumeLanguageEntry[];
  certifications: StructuredResumeCertificationEntry[];
}

export interface ResumeRagDocumentArtifacts {
  document: ExtractedResumeTextDocument;
  sections: ParsedResumeSection[];
  chunks: ResumeTextChunk[];
  structuredData: StructuredResumeData;
}
