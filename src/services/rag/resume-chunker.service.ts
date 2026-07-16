import type { ParsedResumeSection, ResumeTextChunk } from '../../types/rag.js';

export interface ChunkResumeSectionsOptions {
  maxCharactersPerChunk?: number;
}

const DEFAULT_MAX_CHARACTERS_PER_CHUNK = 420;

function createChunkText(paragraphs: string[]): string {
  return paragraphs.join('\n\n').trim();
}

function createChunk(
  section: ParsedResumeSection,
  order: number,
  paragraphs: string[],
  sourceParagraphIndexes: number[]
): ResumeTextChunk {
  const text = createChunkText(paragraphs);

  return {
    id: `${section.candidateId}-${section.kind}-chunk-${order}`,
    datasetId: section.datasetId,
    candidateId: section.candidateId,
    sectionId: section.id,
    sectionKind: section.kind,
    sectionLabel: section.label,
    order,
    text,
    paragraphCount: paragraphs.length,
    sourceParagraphIndexes,
    characterCount: text.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}

export function chunkResumeSections(
  sections: ParsedResumeSection[],
  options: ChunkResumeSectionsOptions = {}
): ResumeTextChunk[] {
  const maxCharactersPerChunk =
    options.maxCharactersPerChunk ?? DEFAULT_MAX_CHARACTERS_PER_CHUNK;
  const chunks: ResumeTextChunk[] = [];

  for (const section of sections) {
    let currentParagraphs: string[] = [];
    let currentIndexes: number[] = [];
    let chunkOrder = 1;

    for (const [paragraphIndex, paragraph] of section.paragraphs.entries()) {
      const sourceParagraphIndex = section.sourceParagraphIndexes[paragraphIndex] ?? paragraphIndex;
      const candidateParagraphs = [...currentParagraphs, paragraph];
      const candidateText = createChunkText(candidateParagraphs);

      if (currentParagraphs.length > 0 && candidateText.length > maxCharactersPerChunk) {
        chunks.push(createChunk(section, chunkOrder, currentParagraphs, currentIndexes));
        chunkOrder += 1;
        currentParagraphs = [paragraph];
        currentIndexes = [sourceParagraphIndex];
        continue;
      }

      currentParagraphs = candidateParagraphs;
      currentIndexes = [...currentIndexes, sourceParagraphIndex];

      if (currentParagraphs.length === 1 && candidateText.length > maxCharactersPerChunk) {
        chunks.push(createChunk(section, chunkOrder, currentParagraphs, currentIndexes));
        chunkOrder += 1;
        currentParagraphs = [];
        currentIndexes = [];
      }
    }

    if (currentParagraphs.length > 0) {
      chunks.push(createChunk(section, chunkOrder, currentParagraphs, currentIndexes));
    }
  }

  return chunks;
}
