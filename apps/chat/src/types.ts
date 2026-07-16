export interface IngestionStatus {
  source?: 'local';
  hasDataset?: boolean;
  indexBuilt?: boolean;
  candidateCount?: number;
}

export interface Citation {
  candidateId: string;
  chunkId: string;
  fullName: string;
  pdfFileName: string;
  excerpt: string;
  sectionKind: string;
}

export interface CandidateMatch {
  candidateId: string;
  fullName: string;
  primaryRole: string;
  totalEstimatedExperienceYears: number;
  languages: string[];
  skills: string[];
  resumeUrl?: string;
  citations: Citation[];
}

export interface ChatAnswerResult {
  answer: string;
  showMatches: boolean;
  matches: CandidateMatch[];
  citations: Citation[];
}
