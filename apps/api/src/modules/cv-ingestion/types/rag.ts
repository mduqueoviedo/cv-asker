import type { ResumeDocumentLanguage, ResumeTemplateId } from '../../cv-generation/types/resume.js';

export type ResumeSourceType = 'generated-dataset' | 'ad-hoc-file' | 'imported-folder';
export type ResumeRagDatasetSource = 'local';
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

export interface ResumeRagCandidateProfile {
  candidateId: string;
  datasetId: string;
  fullName: string;
  primaryRole: string;
  documentLanguage: ParsedResumeDocumentLanguage;
  pdfFileName: string;
  pdfFilePath: string;
  totalEstimatedExperienceYears: number;
  roles: string[];
  organizations: string[];
  skills: string[];
  languages: string[];
  education: string[];
  certifications: string[];
  summary: string;
}

export interface ResumeRagIndexedChunk {
  id: string;
  datasetId: string;
  candidateId: string;
  fullName: string;
  primaryRole: string;
  pdfFileName: string;
  pdfFilePath: string;
  sectionId: string;
  sectionKind: ResumeSectionKind;
  sectionLabel: string;
  order: number;
  text: string;
  keywords: string[];
  embedding: number[];
  characterCount: number;
  wordCount: number;
}

export interface ResumeRagIndex {
  source: ResumeRagDatasetSource;
  datasetId: string;
  builtAt: string;
  embeddingDimensions: number;
  documentCount: number;
  candidateCount: number;
  chunkCount: number;
  candidates: ResumeRagCandidateProfile[];
  chunks: ResumeRagIndexedChunk[];
}

export type ResumeRagAnswerIntent = 'list' | 'count' | 'summary';

export interface ResumeRagQueryFilters {
  languages: string[];
  minExperienceYears: number | null;
}

export interface ResumeRagQueryAnalysis {
  originalQuestion: string;
  normalizedQuestion: string;
  intent: ResumeRagAnswerIntent;
  topK: number;
  searchTerms: string[];
  filters: ResumeRagQueryFilters;
}

export interface ResumeRagCitation {
  chunkId: string;
  candidateId: string;
  fullName: string;
  primaryRole: string;
  pdfFileName: string;
  pdfFilePath: string;
  sectionKind: ResumeSectionKind;
  excerpt: string;
  score: number;
}

export interface ResumeRagCandidateMatch {
  candidateId: string;
  fullName: string;
  primaryRole: string;
  pdfFileName: string;
  pdfFilePath: string;
  score: number;
  totalEstimatedExperienceYears: number;
  languages: string[];
  skills: string[];
  citations: ResumeRagCitation[];
}

export interface ResumeRagAnswerResult {
  source: ResumeRagDatasetSource;
  datasetId: string;
  builtAt: string;
  question: string;
  responseLanguage: 'en' | 'es';
  answer: string;
  analysis: ResumeRagQueryAnalysis;
  citations: ResumeRagCitation[];
  matches: ResumeRagCandidateMatch[];
  model: string | null;
}
