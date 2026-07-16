const DEFAULT_EMBEDDING_DIMENSIONS = 256;

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'con',
  'de',
  'del',
  'el',
  'en',
  'for',
  'from',
  'how',
  'in',
  'is',
  'la',
  'las',
  'los',
  'of',
  'on',
  'or',
  'para',
  'por',
  'que',
  'se',
  'the',
  'to',
  'un',
  'una',
  'what',
  'which',
  'who',
  'with',
  'y',
]);

function hashToken(token: string): number {
  let hash = 2166136261;

  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9+#./-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeSearchText(value: string): string[] {
  return normalizeSearchText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

export function collectTopKeywords(value: string, limit = 8): string[] {
  const frequencies = new Map<string, number>();

  for (const token of tokenizeSearchText(value)) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }

  return [...frequencies.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return right[0].length - left[0].length;
    })
    .slice(0, limit)
    .map(([token]) => token);
}

export function createHashedEmbedding(
  value: string,
  dimensions = DEFAULT_EMBEDDING_DIMENSIONS
): number[] {
  const embedding = new Array<number>(dimensions).fill(0);
  const tokens = tokenizeSearchText(value);

  if (tokens.length === 0) {
    return embedding;
  }

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % dimensions;
    const sign = ((hash >>> 1) & 1) === 0 ? 1 : -1;
    const weight = Math.min(3, Math.max(1, token.length / 5));
    embedding[index] += sign * weight;
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, item) => sum + item ** 2, 0));

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return embedding;
  }

  return embedding.map((valueItem) => Math.round((valueItem / magnitude) * 1_000_000) / 1_000_000);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  let score = 0;

  for (let index = 0; index < left.length; index += 1) {
    score += left[index] * right[index];
  }

  return score;
}

export function getDefaultEmbeddingDimensions(): number {
  return DEFAULT_EMBEDDING_DIMENSIONS;
}
