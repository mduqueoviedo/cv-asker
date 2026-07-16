import type {
  ExtractedResumeTextDocument,
  ParsedResumeSection,
  ResumeSectionKind,
} from '../../types/rag.js';

interface SectionDefinition {
  kind: ResumeSectionKind;
  label: string;
  aliases: string[];
}

interface HeadingMatch {
  kind: ResumeSectionKind;
  label: string;
  start: number;
  end: number;
  aliasLength: number;
}

interface SearchMap {
  canonicalText: string;
  indexMap: number[];
}

interface RawBlockCandidate {
  text: string;
  sourceParagraphIndexes: number[];
  headingHints: ResumeSectionKind[];
}

interface ClassifiedBlock {
  kind: ResumeSectionKind;
  label: string;
  confidence: number;
  signals: string[];
  text: string;
  sourceParagraphIndexes: number[];
}

const SECTION_DEFINITIONS: SectionDefinition[] = [
  {
    kind: 'summary',
    label: 'Professional Summary',
    aliases: ['PROFESSIONALSUMMARY', 'SUMMARY', 'RESUMENPROFESIONAL', 'RESUMEN'],
  },
  {
    kind: 'highlights',
    label: 'Highlights',
    aliases: ['HIGHLIGHTS', 'KEYHIGHLIGHTS', 'PUNTOSCLAVE', 'LOGROSDESTACADOS'],
  },
  {
    kind: 'core_technologies',
    label: 'Core Technologies',
    aliases: ['CORETECHNOLOGIES', 'TECHNICALSKILLS', 'TECHNOLOGIES', 'SKILLS', 'TECHSTACK', 'TECNOLOGIASPRINCIPALES', 'TECNOLOGIAS', 'HABILIDADES'],
  },
  {
    kind: 'profile',
    label: 'Profile',
    aliases: ['PROFILE', 'PERFIL', 'ABOUTME', 'SOBREMI'],
  },
  {
    kind: 'contact',
    label: 'Contact',
    aliases: ['CONTACT', 'CONTACTINFO', 'CONTACTO', 'DATOSDECONTACTO'],
  },
  {
    kind: 'experience',
    label: 'Work Experience',
    aliases: ['WORKINGEXPERIENCE', 'WORKEXPERIENCE', 'EXPERIENCE', 'EMPLOYMENTHISTORY', 'PROFESSIONALEXPERIENCE', 'EXPERIENCIAPROFESIONAL', 'EXPERIENCIA'],
  },
  {
    kind: 'education',
    label: 'Education',
    aliases: ['EDUCATION', 'ACADEMICBACKGROUND', 'FORMACION', 'FORMACIONACADEMICA'],
  },
  {
    kind: 'languages',
    label: 'Languages',
    aliases: ['LANGUAGES', 'IDIOMAS', 'LANGUAGEPROFICIENCY'],
  },
  {
    kind: 'certifications',
    label: 'Certifications',
    aliases: ['CERTIFICATIONS', 'CERTIFICATES', 'CERTIFICACIONES', 'ACREDITACIONES'],
  },
];

const SECTION_LABELS = new Map(
  SECTION_DEFINITIONS.map((definition) => [definition.kind, definition.label])
);

const MONTH_PATTERN =
  '(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC|ENE|ABR|AGO|DIC|JANUARY|FEBRUARY|MARCH|APRIL|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER|ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)';
const DATE_RANGE_REGEX = new RegExp(
  `\\b(?:${MONTH_PATTERN})\\s+\\d{4}\\s*[-\\u2013]\\s*(?:${MONTH_PATTERN}\\s+\\d{4}|PRESENT|CURRENT|ACTUALIDAD)\\b|\\b\\d{4}\\s*[-\\u2013]\\s*(?:\\d{4}|PRESENT|CURRENT|ACTUALIDAD)\\b`,
  'i'
);
const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_REGEX = /(?:\+\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?){2,}\d{2,4}/;
const URL_REGEX = /\b(?:https?:\/\/|www\.|linkedin\.com\/|github\.com\/|portfolio\.)\S+/i;
const LANGUAGE_ENTRY_REGEX =
  /\b(English|Spanish|French|German|Dutch|Italian|Portuguese|Catalan|Galician|Basque|Japanese|Espanol|Español|Ingles|Ingl[ée]s|Frances|Franc[ée]s|Aleman|Alem[áa]n|Italiano|Portugues|Portugu[ée]s|Catalan|Catal[áa]n|Japones|Japon[eé]s)\b\s*:?\s*(Native|Nativo|Fluent|Basic|Intermediate|Advanced|Professional|Conversational|C2|C1|B2|B1|A2|A1)(?:\s*\([^)]*\))?/gi;

const CONTACT_LABEL_REGEX = /\b(?:EMAIL|E-MAIL|PHONE|TELEFONO|TEL[EÉ]FONO|MOBILE|LINKEDIN|GITHUB|PORTFOLIO|LOCATION|UBICACION|UBICACIÓN|ADDRESS)\b/i;
const EDUCATION_KEYWORD_REGEX =
  /\b(?:BSC|BA|BS|MSC|MS|MA|PHD|MBA|BENG|MENG|DEGREE|GRADO|MASTER|M[ÁA]STER|LICENCIATURA|INGENIERIA|INGENIER[IÍ]A|UNIVERSITY|UNIVERSIDAD|UNIVERSITAT|COLLEGE|SCHOOL)\b/i;
const CERTIFICATION_KEYWORD_REGEX =
  /\b(?:CERTIFIED|CERTIFICATION|CERTIFICATE|CERTIFICACION|CERTIFICACIÓN|SCRUM|FUNDAMENTALS|AWS CERTIFIED|AZURE CERTIFIED|GOOGLE CLOUD CERTIFIED|PMI)\b/i;
const EXPERIENCE_VERB_REGEX =
  /\b(?:built|delivered|led|managed|improved|developed|implemented|designed|partnered|contributed|created|automated|optimized|supported|served|operated|handled|coordinated|assisted|trained|sold|maintained|supervised|prepared|fabricated|machined|trabajo|trabaj[oó]|impulso|participo|particip[oó]|desarrollo|desarroll[oó]|lidero|lider[oó]|mejoro|mejor[oó]|implemento|implement[oó]|contribuyo|contribuy[oó]|atendi[oó]|oper[oó]|manej[oó]|gestion[oó]|vend[ií]o|supervis[oó]|prepar[oó]|fabric[oó]|mecaniz[oó])\b/i;
const YEARS_OF_EXPERIENCE_REGEX =
  /\b(?:\d+\+?\s+years?\s+of\s+experience|\d+\s+a[nñ]os?\s+de\s+experiencia|over\s+\d+\s+years?)\b/i;
const ROLE_AT_COMPANY_REGEX =
  /\b(?:engineer|developer|manager|administrator|analyst|architect|consultant|designer|lead|director|specialist|devops|frontend|backend|full-stack|full stack|cashier|operator|assistant|clerk|machinist|welder|driver|cook|server|barista|nurse|teacher|technician|mechanic|laborer)\b[\w\s/,&()-]{0,80}\bat\b/i;
const GENERIC_ROLE_AT_COMPANY_REGEX =
  /(?:^|[.\n]\s*|•\s*)(?:[A-ZÀ-Ý][\w/&(),.-]+(?:\s+[A-ZÀ-Ý][\w/&(),.-]+){0,6})\s+at\s+[A-ZÀ-Ý0-9]/;
const TECHNOLOGIES_LABEL_REGEX = /\b(?:Technologies|Technology Stack|Tech Stack|Technical Skills|Skills|Tecnologias|Tecnologías|Habilidades)\s*:/i;

const TECH_TERMS = [
  'aws',
  'azure',
  'gcp',
  'google cloud',
  'kubernetes',
  'docker',
  'terraform',
  'python',
  'javascript',
  'typescript',
  'react',
  'node',
  'node.js',
  'next.js',
  'express',
  'postgresql',
  'mongodb',
  'redis',
  'graphql',
  'sql',
  'java',
  'c#',
  'php',
  'go',
  'rust',
  'cypress',
  'playwright',
  'github actions',
  'gitlab ci',
  'linux',
  'kafka',
];

function createSearchMap(value: string): SearchMap {
  let canonicalText = '';
  const indexMap: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const normalizedCharacter = value[index]
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    for (const character of normalizedCharacter) {
      if (!/[A-Z0-9]/.test(character)) {
        continue;
      }

      canonicalText += character;
      indexMap.push(index);
    }
  }

  return {
    canonicalText,
    indexMap,
  };
}

function isLikelyHeadingSpan(value: string, start: number, end: number): boolean {
  const span = value.slice(start, end);
  const letters = span.match(/[A-Za-zÀ-ÿ]/g) ?? [];

  if (letters.length === 0) {
    return false;
  }

  const uppercaseLetters = span.match(/[A-ZÀ-ß]/g) ?? [];
  const uppercaseRatio = uppercaseLetters.length / letters.length;

  if (uppercaseRatio >= 0.7) {
    return true;
  }

  return (
    start <= 2 &&
    span.trim().length <= 40 &&
    /^[A-ZÀ-Ý][A-Za-zÀ-ÿ]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ]+){0,4}$/.test(span.trim())
  );
}

function deduplicateHeadingMatches(matches: HeadingMatch[]): HeadingMatch[] {
  const sorted = [...matches].sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }

    return right.aliasLength - left.aliasLength;
  });
  const deduplicated: HeadingMatch[] = [];

  for (const match of sorted) {
    const lastMatch = deduplicated.at(-1);

    if (!lastMatch || match.start >= lastMatch.end) {
      deduplicated.push(match);
      continue;
    }

    if (match.aliasLength > lastMatch.aliasLength) {
      deduplicated[deduplicated.length - 1] = match;
    }
  }

  return deduplicated;
}

function findHeadingMatches(paragraph: string): HeadingMatch[] {
  const searchMap = createSearchMap(paragraph);
  const matches: HeadingMatch[] = [];

  for (const definition of SECTION_DEFINITIONS) {
    for (const alias of definition.aliases) {
      let fromIndex = 0;

      while (fromIndex < searchMap.canonicalText.length) {
        const canonicalIndex = searchMap.canonicalText.indexOf(alias, fromIndex);

        if (canonicalIndex === -1) {
          break;
        }

        const canonicalEnd = canonicalIndex + alias.length;
        const start = searchMap.indexMap[canonicalIndex] ?? 0;
        const end = (searchMap.indexMap[canonicalEnd - 1] ?? start) + 1;

        if (isLikelyHeadingSpan(paragraph, start, end)) {
          matches.push({
            kind: definition.kind,
            label: definition.label,
            start,
            end,
            aliasLength: alias.length,
          });
        }

        fromIndex = canonicalIndex + alias.length;
      }
    }
  }

  return deduplicateHeadingMatches(matches);
}

function splitParagraphIntoBlocks(paragraph: string, paragraphIndex: number): RawBlockCandidate[] {
  const headingMatches = findHeadingMatches(paragraph);

  if (headingMatches.length === 0) {
    return [
      {
        text: paragraph,
        sourceParagraphIndexes: [paragraphIndex],
        headingHints: [],
      },
    ];
  }

  const blocks: RawBlockCandidate[] = [];
  let pendingHeadingHints: ResumeSectionKind[] = [];
  const prefix = paragraph.slice(0, headingMatches[0].start).trim();

  if (prefix) {
    blocks.push({
      text: prefix,
      sourceParagraphIndexes: [paragraphIndex],
      headingHints: [],
    });
  }

  for (const [matchIndex, match] of headingMatches.entries()) {
    const nextMatch = headingMatches[matchIndex + 1];
    const contentStart = match.end;
    const contentEnd = nextMatch ? nextMatch.start : paragraph.length;
    const content = paragraph.slice(contentStart, contentEnd).trim();
    const headingHints = [...new Set([...pendingHeadingHints, match.kind])];

    if (content) {
      blocks.push({
        text: content,
        sourceParagraphIndexes: [paragraphIndex],
        headingHints,
      });
      pendingHeadingHints = [];
      continue;
    }

    pendingHeadingHints = headingHints;
  }

  return blocks;
}

function normalizeSegmentWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractLanguageEntries(text: string): string[] {
  return [...text.matchAll(LANGUAGE_ENTRY_REGEX)]
    .map((match) => normalizeSegmentWhitespace(match[0]))
    .filter(Boolean);
}

function splitMixedLanguageBlock(block: RawBlockCandidate): RawBlockCandidate[] {
  const languageEntries = extractLanguageEntries(block.text);

  if (languageEntries.length < 2) {
    return [block];
  }

  const textWithoutLanguages = normalizeSegmentWhitespace(
    block.text.replace(LANGUAGE_ENTRY_REGEX, ' ')
  );

  if (!textWithoutLanguages || textWithoutLanguages.length < 20) {
    return [
      {
        ...block,
        text: languageEntries.join('\n'),
        headingHints: ['languages'],
      },
    ];
  }

  return [
    {
      ...block,
      text: textWithoutLanguages,
      headingHints: [...new Set(block.headingHints.filter((kind) => kind !== 'languages'))],
    },
    {
      ...block,
      text: languageEntries.join('\n'),
      headingHints: ['languages'],
    },
  ];
}

function splitCertificationExperienceBlock(block: RawBlockCandidate): RawBlockCandidate[] {
  if (!CERTIFICATION_KEYWORD_REGEX.test(block.text) || !DATE_RANGE_REGEX.test(block.text)) {
    return [block];
  }

  const dateMatch = block.text.match(DATE_RANGE_REGEX);

  if (!dateMatch || dateMatch.index === undefined || dateMatch.index < 35) {
    return [block];
  }

  let splitIndex = dateMatch.index;
  const windowStart = Math.max(0, splitIndex - 50);
  const precedingSlice = block.text.slice(windowStart, splitIndex);
  const roleStart = precedingSlice.search(/[A-ZÀ-Ý][A-Za-zÀ-ÿ/&,-]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ/&,-]+){0,4}\s*$/);

  if (roleStart >= 0) {
    splitIndex = windowStart + roleStart;
  }

  const before = normalizeSegmentWhitespace(block.text.slice(0, splitIndex));
  const after = normalizeSegmentWhitespace(block.text.slice(splitIndex));

  if (!before || !after) {
    return [block];
  }

  return [
    {
      ...block,
      text: before,
      headingHints: ['certifications'],
    },
    {
      ...block,
      text: after,
      headingHints: ['experience'],
    },
  ];
}

function splitTechnologiesBlock(block: RawBlockCandidate): RawBlockCandidate[] {
  const match = block.text.match(TECHNOLOGIES_LABEL_REGEX);

  if (!match || match.index === undefined) {
    return [block];
  }

  const before = normalizeSegmentWhitespace(block.text.slice(0, match.index));
  const after = normalizeSegmentWhitespace(block.text.slice(match.index));

  if (!before || !after) {
    return [block];
  }

  return [
    {
      ...block,
      text: before,
      headingHints: [...new Set(block.headingHints.filter((kind) => kind !== 'core_technologies'))],
    },
    {
      ...block,
      text: after,
      headingHints: ['core_technologies'],
    },
  ];
}

function carryForwardDanglingHeadingBlocks(blocks: RawBlockCandidate[]): RawBlockCandidate[] {
  const normalizedBlocks: RawBlockCandidate[] = [];
  let pendingHeadingHints: ResumeSectionKind[] = [];

  for (const block of blocks) {
    const normalizedText = normalizeSegmentWhitespace(block.text);
    const isDanglingHeading =
      block.headingHints.length > 0 &&
      normalizedText.length > 0 &&
      normalizedText.length <= 24 &&
      /^[A-ZÀ-Ý][A-Za-zÀ-ÿ]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ]+){0,3}$/.test(normalizedText);

    if (isDanglingHeading) {
      pendingHeadingHints = [...new Set([...pendingHeadingHints, ...block.headingHints])];
      continue;
    }

    normalizedBlocks.push({
      ...block,
      headingHints: [...new Set([...pendingHeadingHints, ...block.headingHints])],
    });
    pendingHeadingHints = [];
  }

  return normalizedBlocks;
}

function refineRawBlocks(blocks: RawBlockCandidate[]): RawBlockCandidate[] {
  return carryForwardDanglingHeadingBlocks(
    blocks
      .flatMap((block) => splitCertificationExperienceBlock(block))
      .flatMap((block) => splitTechnologiesBlock(block))
      .flatMap((block) => splitMixedLanguageBlock(block))
  );
}

function countUniqueTechTerms(text: string): number {
  const lowercaseText = text.toLowerCase();
  return TECH_TERMS.filter((term) => lowercaseText.includes(term.toLowerCase())).length;
}

function countWordMatches(text: string, regex: RegExp): number {
  return [...text.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`))]
    .length;
}

function looksLikeHighlightBlock(text: string): boolean {
  const compactText = normalizeSegmentWhitespace(text);
  return compactText.length > 20 && compactText.length < 160 && EXPERIENCE_VERB_REGEX.test(compactText);
}

function scoreBlock(
  block: RawBlockCandidate,
  document: ExtractedResumeTextDocument
): {
  kind: ResumeSectionKind;
  confidence: number;
  signals: string[];
} {
  const scores = new Map<ResumeSectionKind, number>();
  const signals: string[] = [];
  const text = block.text;
  const lowercaseText = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  function addScore(kind: ResumeSectionKind, value: number, signal: string) {
    scores.set(kind, (scores.get(kind) ?? 0) + value);
    signals.push(signal);
  }

  for (const headingHint of block.headingHints) {
    addScore(headingHint, 6, `heading:${headingHint}`);
  }

  if (EMAIL_REGEX.test(text)) {
    addScore('contact', 7, 'email');
  }

  if (PHONE_REGEX.test(text)) {
    addScore('contact', 5, 'phone');
  }

  if (URL_REGEX.test(text) || /(linkedin|github|portfolio)/i.test(text)) {
    const explicitProfileLink = /(linkedin|github|portfolio)/i.test(text);

    if (explicitProfileLink || (!DATE_RANGE_REGEX.test(text) && wordCount <= 24)) {
      addScore('contact', explicitProfileLink ? 4 : 2, 'url');
    }
  }

  if (CONTACT_LABEL_REGEX.test(text)) {
    addScore('contact', 3, 'contact-label');
  }

  if (DATE_RANGE_REGEX.test(text)) {
    addScore('experience', 6, 'date-range');
  }

  if (ROLE_AT_COMPANY_REGEX.test(text) && (DATE_RANGE_REGEX.test(text) || wordCount <= 20)) {
    addScore('experience', 7, 'role-at-company');
  } else if (
    GENERIC_ROLE_AT_COMPANY_REGEX.test(text) &&
    (DATE_RANGE_REGEX.test(text) || wordCount <= 20)
  ) {
    addScore('experience', 4, 'generic-role-at-company');
  }

  if (EXPERIENCE_VERB_REGEX.test(text) && wordCount >= 8) {
    addScore('experience', 3, 'experience-verb');
  }

  if (EDUCATION_KEYWORD_REGEX.test(text)) {
    addScore('education', 6, 'education-keyword');
  }

  if (/(university|universidad|universitat|college|school|faculty|instituto)/i.test(text)) {
    addScore('education', 4, 'education-institution');
  }

  const languageEntryCount = extractLanguageEntries(text).length;

  if (languageEntryCount > 0) {
    addScore('languages', Math.min(6, languageEntryCount * 2), 'language-level');
  }

  if (CERTIFICATION_KEYWORD_REGEX.test(text)) {
    addScore('certifications', 5, 'certification-keyword');
  }

  const techCount = countUniqueTechTerms(text);

  if (techCount >= 3) {
    addScore('core_technologies', 5, 'tech-density');
  } else if (techCount >= 2 && wordCount <= 30) {
    addScore('core_technologies', 3, 'tech-shortlist');
  }

  if (TECHNOLOGIES_LABEL_REGEX.test(text)) {
    addScore('core_technologies', 7, 'technologies-label');
  }

  if (looksLikeHighlightBlock(text)) {
    addScore('highlights', 2, 'highlight-shape');
  }

  if (YEARS_OF_EXPERIENCE_REGEX.test(text)) {
    addScore('summary', 3, 'years-of-experience');
    addScore('experience', 1, 'experience-years');
  }

  if (
    block.sourceParagraphIndexes.some((index) => index <= 1) &&
    wordCount >= 24 &&
    !DATE_RANGE_REGEX.test(text)
  ) {
    addScore('summary', 4, 'early-long-block');
  }

  if (lowercaseText.includes(document.fullName.toLowerCase())) {
    addScore('profile', 4, 'candidate-name');
  }

  if (lowercaseText.includes(document.primaryRole.toLowerCase())) {
    addScore('profile', 3, 'primary-role');
    addScore('summary', 1, 'role-mention');
  }

  if (/(age|edad|experience|experiencia)/i.test(text) && wordCount <= 35) {
    addScore('profile', 3, 'profile-stats');
  }

  const rankedScores = [...scores.entries()].sort((left, right) => right[1] - left[1]);

  if (rankedScores.length === 0) {
    return {
      kind: 'misc',
      confidence: 0,
      signals: [],
    };
  }

  const [topKind, topScore] = rankedScores[0];
  const totalScore = rankedScores.reduce((sum, [, score]) => sum + score, 0);
  const confidence = totalScore > 0 ? topScore / totalScore : 0;

  if (topScore < 3 && block.headingHints.length === 0) {
    return {
      kind: 'misc',
      confidence,
      signals,
    };
  }

  return {
    kind: topKind,
    confidence,
    signals,
  };
}

function classifyBlocks(
  blocks: RawBlockCandidate[],
  document: ExtractedResumeTextDocument
): ClassifiedBlock[] {
  return blocks
    .map((block) => {
      const trimmedText = block.text.trim();

      if (!trimmedText) {
        return null;
      }

      const classification = scoreBlock(block, document);
      return {
        kind: classification.kind,
        label: SECTION_LABELS.get(classification.kind) ?? 'Misc',
        confidence: classification.confidence,
        signals: [...new Set(classification.signals)],
        text: trimmedText,
        sourceParagraphIndexes: block.sourceParagraphIndexes,
      } satisfies ClassifiedBlock;
    })
    .filter((block): block is ClassifiedBlock => block !== null);
}

function mergeClassifiedBlocks(
  datasetId: string,
  candidateId: string,
  blocks: ClassifiedBlock[]
): ParsedResumeSection[] {
  const sections: ParsedResumeSection[] = [];

  for (const block of blocks) {
    const previous = sections.at(-1);
    const shouldMergeIntoPrevious =
      previous &&
      (previous.kind === block.kind ||
        block.kind === 'misc' ||
        (block.kind === 'profile' &&
          previous.kind === 'experience' &&
          block.signals.some((signal) => signal === 'date-range' || signal === 'experience-verb')));

    if (shouldMergeIntoPrevious && previous) {
      previous.paragraphs.push(block.text);
      previous.sourceParagraphIndexes = [
        ...new Set([...previous.sourceParagraphIndexes, ...block.sourceParagraphIndexes]),
      ];
      previous.classificationSignals = [
        ...new Set([...previous.classificationSignals, ...block.signals]),
      ];
      previous.confidence =
        Math.round(((previous.confidence + block.confidence) / 2) * 1000) / 1000;
      previous.content = previous.paragraphs.join('\n\n').trim();
      previous.characterCount = previous.content.length;
      previous.wordCount = previous.content.split(/\s+/).filter(Boolean).length;
      continue;
    }

    sections.push({
      id: `${candidateId}-${block.kind}-${sections.length + 1}`,
      datasetId,
      candidateId,
      kind: block.kind,
      label: block.label,
      order: sections.length + 1,
      confidence: Math.round(block.confidence * 1000) / 1000,
      classificationSignals: [...block.signals],
      content: block.text,
      paragraphs: [block.text],
      sourceParagraphIndexes: [...new Set(block.sourceParagraphIndexes)],
      characterCount: block.text.length,
      wordCount: block.text.split(/\s+/).filter(Boolean).length,
    });
  }

  return sections.filter((section) => section.content.trim().length > 0);
}

export function parseResumeSections(document: ExtractedResumeTextDocument): ParsedResumeSection[] {
  const paragraphs = document.normalizedText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const rawBlocks = paragraphs.flatMap((paragraph, paragraphIndex) =>
    splitParagraphIntoBlocks(paragraph, paragraphIndex)
  );
  const refinedBlocks = refineRawBlocks(rawBlocks);
  const classifiedBlocks = classifyBlocks(refinedBlocks, document);
  return mergeClassifiedBlocks(document.datasetId, document.candidateId, classifiedBlocks);
}
