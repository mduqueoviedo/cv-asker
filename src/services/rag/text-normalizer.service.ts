import type { NormalizedTextStats } from '../../types/rag.js';

export interface NormalizedTextResult {
  text: string;
  stats: NormalizedTextStats;
}

function joinWrappedLines(text: string): string {
  return text.replace(/([^\s-])\n(?=[\p{Ll}\p{N}(])/gu, '$1 ');
}

function restoreHyphenatedWords(text: string): string {
  return text.replace(/([A-Za-zÀ-ÿ0-9])(?:-|\u00ad|\u2010|\u2011)\n([A-Za-zÀ-ÿ0-9])/g, '$1$2');
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\u00ad/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n');
}

function normalizeParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' ')
    )
    .filter(Boolean)
    .join('\n\n');
}

function createTextStats(text: string): NormalizedTextStats {
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      characterCount: 0,
      wordCount: 0,
      paragraphCount: 0,
      lineCount: 0,
    };
  }

  return {
    characterCount: trimmed.length,
    wordCount: trimmed.split(/\s+/).length,
    paragraphCount: trimmed.split(/\n{2,}/).length,
    lineCount: trimmed.split('\n').length,
  };
}

export function normalizeExtractedPdfText(text: string): NormalizedTextResult {
  const normalized = normalizeParagraphs(
    joinWrappedLines(restoreHyphenatedWords(normalizeWhitespace(text)))
  )
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    text: normalized,
    stats: createTextStats(normalized),
  };
}
