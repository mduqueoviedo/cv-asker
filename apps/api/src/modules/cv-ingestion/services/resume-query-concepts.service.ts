import type { ResumeRagQueryConcepts } from '../types/rag.js';
import { normalizeSearchText } from './local-vectorizer.service.js';

interface ConceptDefinition {
  canonical: string;
  kind: keyof ResumeRagQueryConcepts;
  aliases: string[];
  relatedRoles?: string[];
}

const CONCEPT_DEFINITIONS: ConceptDefinition[] = [
  {
    canonical: 'react',
    kind: 'technologies',
    aliases: ['react', 'reactjs'],
    relatedRoles: ['frontend', 'fullstack', 'backend'],
  },
  {
    canonical: 'nodejs',
    kind: 'technologies',
    aliases: ['node.js', 'nodejs'],
    relatedRoles: ['backend', 'fullstack', 'platform', 'devops'],
  },
  {
    canonical: 'typescript',
    kind: 'technologies',
    aliases: ['typescript'],
  },
  {
    canonical: 'graphql',
    kind: 'technologies',
    aliases: ['graphql'],
    relatedRoles: ['backend', 'fullstack', 'frontend', 'platform', 'data'],
  },
  {
    canonical: 'ruby_on_rails',
    kind: 'technologies',
    aliases: ['ruby on rails', 'rails'],
    relatedRoles: ['backend', 'fullstack'],
  },
  {
    canonical: 'angular',
    kind: 'technologies',
    aliases: ['angular', 'angularjs'],
    relatedRoles: ['frontend', 'fullstack'],
  },
  {
    canonical: 'nextjs',
    kind: 'technologies',
    aliases: ['next.js', 'nextjs'],
    relatedRoles: ['frontend', 'fullstack', 'backend'],
  },
  {
    canonical: 'fastapi',
    kind: 'technologies',
    aliases: ['fastapi'],
    relatedRoles: ['backend', 'platform', 'fullstack'],
  },
  {
    canonical: 'express',
    kind: 'technologies',
    aliases: ['express'],
    relatedRoles: ['backend', 'fullstack'],
  },
  {
    canonical: 'playwright',
    kind: 'technologies',
    aliases: ['playwright'],
  },
  {
    canonical: 'docker',
    kind: 'technologies',
    aliases: ['docker'],
  },
  {
    canonical: 'terraform',
    kind: 'technologies',
    aliases: ['terraform'],
  },
  {
    canonical: 'backend',
    kind: 'roles',
    aliases: ['backend', 'back-end', 'api', 'apis', 'server-side'],
  },
  {
    canonical: 'frontend',
    kind: 'roles',
    aliases: ['frontend', 'front-end', 'ui', 'interfaces de usuario'],
  },
  {
    canonical: 'fullstack',
    kind: 'roles',
    aliases: ['full stack', 'full-stack', 'fullstack'],
  },
  {
    canonical: 'qa',
    kind: 'roles',
    aliases: ['qa', 'quality assurance', 'automation testing', 'test automation', 'pruebas'],
  },
  {
    canonical: 'devops',
    kind: 'roles',
    aliases: ['devops', 'ci/cd', 'infrastructure as code', 'infraestructura como codigo', 'infraestructura como código'],
  },
  {
    canonical: 'platform',
    kind: 'roles',
    aliases: ['platform engineer', 'plataforma', 'platform'],
  },
  {
    canonical: 'data',
    kind: 'roles',
    aliases: ['data engineer', 'ingeniera de datos', 'ingeniero de datos', 'data'],
  },
  {
    canonical: 'microservices',
    kind: 'domains',
    aliases: ['microservices', 'microservicios', 'service-oriented architecture'],
    relatedRoles: ['backend', 'platform', 'devops', 'fullstack'],
  },
  {
    canonical: 'ecommerce',
    kind: 'domains',
    aliases: ['e-commerce', 'ecommerce', 'commerce', 'autoservicio', 'self-service ecommerce'],
    relatedRoles: ['frontend', 'fullstack', 'qa', 'backend'],
  },
  {
    canonical: 'cloud',
    kind: 'domains',
    aliases: ['cloud', 'aws', 'gcp', 'google cloud', 'azure', 'cloudflare'],
    relatedRoles: ['devops', 'platform', 'backend', 'fullstack', 'data'],
  },
  {
    canonical: 'fintech',
    kind: 'domains',
    aliases: ['fintech'],
    relatedRoles: ['backend', 'fullstack', 'data'],
  },
  {
    canonical: 'scraping',
    kind: 'domains',
    aliases: ['webscraping', 'web scraping', 'web-scraping', 'scraping'],
    relatedRoles: ['backend', 'fullstack', 'data'],
  },
  {
    canonical: 'poker',
    kind: 'domains',
    aliases: ['poker', 'casino'],
    relatedRoles: ['frontend', 'fullstack', 'backend'],
  },
];

const CONCEPT_DEFINITIONS_BY_CANONICAL = new Map(
  CONCEPT_DEFINITIONS.map((definition) => [definition.canonical, definition])
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizedAliasEqualsValue(alias: string, normalizedValue: string): boolean {
  return normalizeSearchText(alias) === normalizedValue;
}

function normalizedTextContainsAlias(normalizedText: string, alias: string): boolean {
  const normalizedAlias = normalizeSearchText(alias);

  if (!normalizedAlias) {
    return false;
  }

  const escapedAlias = escapeRegExp(normalizedAlias).replace(/\s+/g, '\\s+');
  return new RegExp(`(?:^|\\s)${escapedAlias}(?:$|\\s)`).test(normalizedText);
}

function createEmptyConcepts(): ResumeRagQueryConcepts {
  return {
    technologies: [],
    domains: [],
    roles: [],
  };
}

function addConcept(
  concepts: ResumeRagQueryConcepts,
  kind: keyof ResumeRagQueryConcepts,
  canonical: string
) {
  if (!concepts[kind].includes(canonical)) {
    concepts[kind].push(canonical);
  }
}

export function extractResumeRagQueryConcepts(question: string): ResumeRagQueryConcepts {
  const normalizedQuestion = normalizeSearchText(question);
  const concepts = createEmptyConcepts();

  for (const definition of CONCEPT_DEFINITIONS) {
    const matchesDefinition = definition.aliases.some((alias) =>
      normalizedTextContainsAlias(normalizedQuestion, alias)
    );

    if (matchesDefinition) {
      addConcept(concepts, definition.kind, definition.canonical);
    }
  }

  return concepts;
}

export function listResumeRagConceptCanonicals(
  kind?: keyof ResumeRagQueryConcepts
): string[] {
  return CONCEPT_DEFINITIONS.filter((definition) => !kind || definition.kind === kind).map(
    (definition) => definition.canonical
  );
}

export function normalizeResumeRagConceptValue(
  value: string,
  kind?: keyof ResumeRagQueryConcepts
): string | null {
  const normalizedValue = normalizeSearchText(value).trim();

  if (!normalizedValue) {
    return null;
  }

  const directMatch = CONCEPT_DEFINITIONS_BY_CANONICAL.get(normalizedValue);

  if (directMatch && (!kind || directMatch.kind === kind)) {
    return directMatch.canonical;
  }

  for (const definition of CONCEPT_DEFINITIONS) {
    if (kind && definition.kind !== kind) {
      continue;
    }

    if (
      normalizedAliasEqualsValue(definition.canonical, normalizedValue) ||
      definition.aliases.some((alias) => normalizedAliasEqualsValue(alias, normalizedValue))
    ) {
      return definition.canonical;
    }
  }

  return null;
}

export function normalizeResumeRagConceptValues(
  values: string[],
  kind: keyof ResumeRagQueryConcepts
): string[] {
  const normalizedValues: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeResumeRagConceptValue(value, kind);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    normalizedValues.push(normalized);
  }

  return normalizedValues;
}

export function getResumeRagConceptAliases(canonical: string): string[] {
  const definition = CONCEPT_DEFINITIONS_BY_CANONICAL.get(canonical);
  return definition ? [...definition.aliases] : [canonical];
}

export function getRelatedRoleConceptsForQuery(
  concepts: ResumeRagQueryConcepts
): string[] {
  const orderedRoleConcepts: string[] = [];
  const seen = new Set<string>();

  for (const concept of [...concepts.technologies, ...concepts.domains]) {
    const relatedRoles = CONCEPT_DEFINITIONS_BY_CANONICAL.get(concept)?.relatedRoles ?? [];

    for (const relatedRole of relatedRoles) {
      if (seen.has(relatedRole)) {
        continue;
      }

      seen.add(relatedRole);
      orderedRoleConcepts.push(relatedRole);
    }
  }

  return orderedRoleConcepts;
}

export function conceptIsPresentInText(canonical: string, normalizedText: string): boolean {
  return getResumeRagConceptAliases(canonical).some((alias) =>
    normalizedTextContainsAlias(normalizedText, alias)
  );
}

export function countMatchedConcepts(
  concepts: string[],
  normalizedText: string
): number {
  let matched = 0;

  for (const canonical of concepts) {
    if (conceptIsPresentInText(canonical, normalizedText)) {
      matched += 1;
    }
  }

  return matched;
}
