const DEFAULT_EMBEDDING_DIMENSIONS = 256;

const STOPWORDS = new Set([
  'a',
  'alguien',
  'alguna',
  'algunas',
  'alguno',
  'algunos',
  'an',
  'and',
  'are',
  'as',
  'at',
  'been',
  'be',
  'by',
  'candidate',
  'candidates',
  'candidato',
  'candidata',
  'candidatos',
  'candidatas',
  'company',
  'companies',
  'con',
  'de',
  'de',
  'del',
  'do',
  'does',
  'el',
  'en',
  'empresa',
  'empresas',
  'experience',
  'experiencia',
  'es',
  'for',
  'from',
  'ha',
  'habla',
  'hablan',
  'han',
  'have',
  'has',
  'how',
  'idioma',
  'idiomas',
  'in',
  'is',
  'la',
  'las',
  'language',
  'languages',
  'list',
  'lista',
  'los',
  'of',
  'on',
  'or',
  'para',
  'por',
  'profile',
  'profiles',
  'que',
  'someone',
  'somebody',
  'se',
  'speak',
  'speaks',
  'the',
  'trabaja',
  'trabajado',
  'trabajados',
  'trabajador',
  'trabajadores',
  'trabajan',
  'trabajar',
  'to',
  'un',
  'una',
  'worked',
  'working',
  'works',
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
  const uniqueTokens: string[] = [];
  const seen = new Set<string>();

  for (const rawToken of normalizeSearchText(value).split(' ')) {
    const token = rawToken.trim();

    if (!token || STOPWORDS.has(token)) {
      continue;
    }

    const variants = new Set<string>([token]);

    if (/[-/]/.test(token)) {
      for (const part of token.split(/[-/]+/)) {
        if (part.length >= 2) {
          variants.add(part);
        }
      }

      const collapsed = token.replace(/[-/]+/g, '');

      if (collapsed.length >= 2) {
        variants.add(collapsed);
      }
    }

    for (const variant of variants) {
      if (variant.length < 2 || STOPWORDS.has(variant) || seen.has(variant)) {
        continue;
      }

      seen.add(variant);
      uniqueTokens.push(variant);
    }
  }

  return uniqueTokens;
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
