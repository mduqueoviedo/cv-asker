import type {
  ParsedResumeSection,
  ResumeRagDocumentArtifacts,
  StructuredResumeCertificationEntry,
  StructuredResumeData,
  StructuredResumeEducationEntry,
  StructuredResumeExperienceEntry,
  StructuredResumeLanguageEntry,
} from '../types/rag.js';

const MONTH_WORD_PATTERN =
  '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Ene|Abr|Ago|Dic|January|February|March|April|June|July|August|September|October|November|December)';
const MONTH_YEAR_PATTERN = `${MONTH_WORD_PATTERN}\\s+\\d{4}`;
const DATE_RANGE_PATTERN = `(?:${MONTH_YEAR_PATTERN}|\\d{4})\\s*(?:-|–|/)\\s*(?:${MONTH_YEAR_PATTERN}|\\d{4}|Present|Current|Actualidad)`;
const DATE_RANGE_REGEX = new RegExp(DATE_RANGE_PATTERN, 'i');
const LANGUAGE_ITEM_REGEX =
  /\b(English|Spanish|French|German|Dutch|Italian|Portuguese|Catalan|Galician|Basque|Japanese|Espanol|Español|Ingles|Ingl[ée]s|Frances|Franc[ée]s|Aleman|Alem[áa]n|Italiano|Portugues|Portugu[ée]s|Japones|Japon[eé]s)\b\s*:?\s*(Native|Nativo|Fluent|Basic|Intermediate|Advanced|Professional|Conversational|C2|C1|B2|B1|A2|A1)?(?:\s*\(([^)]+)\))?/gi;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripWrappingPunctuation(value: string): string {
  return value.replace(/^[\s:;,.|/\\-]+/, '').replace(/[\s:;,.|/\\-]+$/, '').trim();
}

function splitBulletItems(text: string): string[] {
  const normalized = text
    .replace(/[•▪◦·]/g, '\n• ')
    .split('\n')
    .map((item) => item.replace(/^•\s*/, '').trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : [normalizeWhitespace(text)];
}

function stripLeadingLabel(text: string, labels: string[]): string {
  const pattern = new RegExp(`^(?:${labels.join('|')})\\s*:?\\s*`, 'i');
  return text.replace(pattern, '').trim();
}

function extractDateRange(text: string): string | null {
  const match = text.match(DATE_RANGE_REGEX);
  return match ? normalizeWhitespace(match[0]) : null;
}

function extractDateRanges(text: string): string[] {
  return [...text.matchAll(new RegExp(DATE_RANGE_PATTERN, 'gi'))].map((match) =>
    normalizeWhitespace(match[0])
  );
}

function parseSkillsFromSection(section: ParsedResumeSection): string[] {
  const content = section.content.replace(
    /^(Technologies|Technical Skills|Skills|Tecnologias|Tecnologías|Habilidades)\s*:\s*/i,
    ''
  );

  return [
    ...new Set(
      content
        .split(/,|;|\n|·|\u2022/)
        .map((item) => stripWrappingPunctuation(normalizeWhitespace(item)))
        .filter((item) => item.length >= 2 && item.length <= 80)
    ),
  ];
}

function computeConfidence(parts: Array<boolean>): number {
  const hits = parts.filter(Boolean).length;
  return Math.round((hits / parts.length) * 1000) / 1000;
}

function sanitizeStructuredText(text: string): string {
  return normalizeWhitespace(
    text
      .replace(/[\u200B-\u200D\uFEFF]/g, ' ')
      .replace(/\b(?:EMAIL|E-MAIL)\s*:?\s*[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, ' ')
      .replace(/\b(?:PHONE|TEL[EÉ]FONO|TELEFONO|MOBILE)\s*:?\s*(?:\+\d[\d\s().-]{5,}\d)\b/gi, ' ')
      .replace(
        /\b(?:LINKEDIN|GITHUB|PORTFOLIO|WEB|WEBSITE)\s*:?\s*(?:https?:\/\/|www\.|linkedin\.com\/|github\.com\/)\S+/gi,
        ' '
      )
      .replace(/\bL\s*O\s*C\s*A\s*T\s*I\s*O\s*N\b/gi, ' ')
      .replace(/\b(?:LINKEDIN|PORTFOLIO|GITHUB|LOCATION)\b/gi, ' ')
  );
}

function stripLocationFromOrganization(value: string | null): {
  organization: string | null;
  location: string | null;
} {
  if (!value) {
    return {
      organization: null,
      location: null,
    };
  }

  const normalized = stripWrappingPunctuation(value);
  const locationMatch = normalized.match(/\(([^)]+)\)\s*$/);

  if (!locationMatch) {
    return {
      organization: normalized,
      location: null,
    };
  }

  return {
    organization: stripWrappingPunctuation(normalized.slice(0, locationMatch.index)),
    location: stripWrappingPunctuation(locationMatch[1] ?? ''),
  };
}

function parseExperienceHeader(text: string): {
  role: string | null;
  organization: string | null;
  location: string | null;
  dateRange: string | null;
  remainder: string;
} {
  const normalized = sanitizeStructuredText(text);
  const dateRanges = extractDateRanges(normalized);
  const dateRange = dateRanges.length > 0 ? dateRanges.join(' / ') : null;
  const primaryDateRange = dateRanges[0] ?? null;
  const [beforeDateRaw, afterDateRaw] = primaryDateRange
    ? normalized.split(primaryDateRange, 2)
    : [normalized, ''];
  const beforeDate = normalizeWhitespace(beforeDateRaw);
  const afterDate = stripWrappingPunctuation(
    normalizeWhitespace(afterDateRaw.replace(/^\/\s*/, '').replace(/^Tasks?\s*:\s*/i, ''))
  );

  const atPattern = /^(?<role>.+?)\s+at\s+(?<organization>.+?)(?:\s+\((?<location>[^)]+)\))?$/i;
  const atMatch = beforeDate.match(atPattern);

  if (atMatch?.groups) {
    const normalizedOrganization = stripLocationFromOrganization(atMatch.groups.organization);
    return {
      role: stripWrappingPunctuation(normalizeWhitespace(atMatch.groups.role)),
      organization: normalizedOrganization.organization,
      location: atMatch.groups.location
        ? normalizeWhitespace(atMatch.groups.location)
        : normalizedOrganization.location,
      dateRange,
      remainder: afterDate,
    };
  }

  const sentenceParts = beforeDate.split('.').map((part) => normalizeWhitespace(part)).filter(Boolean);
  const firstSentence = sentenceParts[0] ?? beforeDate;
  const ofMatch = firstSentence.match(/^(?<role>.+?)\s+(?:for|with)\s+(?<organization>.+)$/i);

  if (ofMatch?.groups) {
    const normalizedOrganization = stripLocationFromOrganization(ofMatch.groups.organization);
    return {
      role: stripWrappingPunctuation(normalizeWhitespace(ofMatch.groups.role)),
      organization: normalizedOrganization.organization,
      location: normalizedOrganization.location,
      dateRange,
      remainder: normalizeWhitespace([afterDate, beforeDate.slice(firstSentence.length)].join(' ')),
    };
  }

  const dashedMatch = beforeDate.match(/^(?<role>.+?)\s+[-–|]\s+(?<organization>.+)$/);

  if (dashedMatch?.groups) {
    const normalizedOrganization = stripLocationFromOrganization(dashedMatch.groups.organization);
    return {
      role: stripWrappingPunctuation(normalizeWhitespace(dashedMatch.groups.role)),
      organization: normalizedOrganization.organization,
      location: normalizedOrganization.location,
      dateRange,
      remainder: afterDate,
    };
  }

  const roleOnly = stripWrappingPunctuation(
    stripLeadingLabel(beforeDate, ['phone', 'telefono', 'teléfono', 'email', 'linkedin', 'portfolio'])
  );

  return {
    role: dateRange && roleOnly ? roleOnly : null,
    organization: null,
    location: null,
    dateRange,
    remainder: afterDate,
  };
}

function splitExperienceSection(section: ParsedResumeSection): string[] {
  const groups: string[][] = [];

  for (const paragraph of section.paragraphs) {
    const normalizedParagraph = normalizeWhitespace(paragraph);

    if (!normalizedParagraph) {
      continue;
    }

    const currentGroup = groups.at(-1);
    const startsNewEntry = currentGroup && extractDateRange(normalizedParagraph);

    if (!currentGroup || startsNewEntry) {
      groups.push([normalizedParagraph]);
      continue;
    }

    currentGroup.push(normalizedParagraph);
  }

  if (groups.length === 0) {
    return [section.content];
  }

  return groups.map((group) => group.join(' '));
}

function shouldSkipExperienceEntry(
  section: ParsedResumeSection,
  header: ReturnType<typeof parseExperienceHeader>,
  description: string
): boolean {
  if (!header.dateRange && section.classificationSignals.includes('years-of-experience')) {
    return true;
  }

  if (!header.dateRange && !section.classificationSignals.includes('experience-verb') && description.length < 80) {
    return true;
  }

  return (
    !header.dateRange &&
    !header.organization &&
    (section.classificationSignals.includes('years-of-experience') ||
      section.classificationSignals.includes('early-long-block') ||
      (section.order <= 2 && description.length > 140))
  );
}

function extractExperienceEntries(artifacts: ResumeRagDocumentArtifacts): StructuredResumeExperienceEntry[] {
  const entries: StructuredResumeExperienceEntry[] = [];
  const sections = artifacts.sections;

  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];

    if (section.kind !== 'experience') {
      continue;
    }

    const nextSection = sections[index + 1];
    const associatedSkills =
      nextSection?.kind === 'core_technologies' ? parseSkillsFromSection(nextSection) : [];
    const entryTexts = splitExperienceSection(section);

    for (const entryText of entryTexts) {
      const entryParagraphs = entryText
        .split(/\n{2,}/)
        .map((paragraph) => normalizeWhitespace(paragraph))
        .filter(Boolean);
      const header = parseExperienceHeader(entryParagraphs[0] ?? entryText);
      const descriptionParagraphs = entryParagraphs.slice(1);

      if (header.remainder) {
        descriptionParagraphs.unshift(header.remainder);
      }

      const description = stripWrappingPunctuation(
        descriptionParagraphs.length > 0 ? descriptionParagraphs.join(' ') : entryText
      );

      if (shouldSkipExperienceEntry(section, header, description)) {
        continue;
      }

      entries.push({
        id: `${section.candidateId}-experience-entry-${entries.length + 1}`,
        datasetId: section.datasetId,
        candidateId: section.candidateId,
        role: header.role,
        organization: header.organization,
        location: header.location,
        dateRange: header.dateRange,
        description,
        associatedSkills,
        sourceSectionIds:
          nextSection?.kind === 'core_technologies' ? [section.id, nextSection.id] : [section.id],
        confidence: computeConfidence([
          Boolean(header.role),
          Boolean(header.organization),
          Boolean(header.dateRange),
          description.length > 20,
        ]),
        rawText: entryText,
      });
    }
  }

  return entries;
}

function parseEducationItem(
  item: string,
  section: ParsedResumeSection,
  index: number
): StructuredResumeEducationEntry | null {
  const normalized = stripLeadingLabel(normalizeWhitespace(item), ['studies', 'education', 'formacion', 'formación']);
  const dateRanges = extractDateRanges(normalized);
  const dateRange = dateRanges.length > 0 ? dateRanges.join(' / ') : null;
  const withoutDate = dateRange ? normalizeWhitespace(normalized.replace(new RegExp(DATE_RANGE_PATTERN, 'gi'), ' ')) : normalized;

  if (!normalized || normalized.length < 8) {
    return null;
  }

  if (!withoutDate && !dateRange) {
    return null;
  }

  let degree: string | null = null;
  let institution: string | null = null;
  let location: string | null = null;
  let notes: string | null = null;
  const sentenceParts = withoutDate.split('.').map((part) => normalizeWhitespace(part)).filter(Boolean);

  if (sentenceParts.length >= 2) {
    degree = sentenceParts[0] ?? null;
    institution = sentenceParts[1] ?? null;
    notes = sentenceParts.slice(2).join('. ') || null;
  } else {
    const institutionMatch = withoutDate.match(
      /(?<institution>(?:[A-Z][A-Za-z&.-]+\s+){0,3}(?:University|Universidad|Universitat|College|School)\b.*)$/i
    );

    if (institutionMatch?.groups?.institution && institutionMatch.index !== undefined) {
      degree = normalizeWhitespace(withoutDate.slice(0, institutionMatch.index));
      institution = normalizeWhitespace(institutionMatch.groups.institution);
    } else {
      degree = withoutDate;
    }
  }

  if (institution) {
    const institutionLocationMatch = institution.match(/^(?<name>.+?)\s+(?<location>[A-Z][A-Z\s,.-]{4,})$/);

    if (institutionLocationMatch?.groups) {
      institution = normalizeWhitespace(institutionLocationMatch.groups.name);
      location = stripWrappingPunctuation(institutionLocationMatch.groups.location);
    }
  }

  if (!degree && !institution && dateRange) {
    return {
      id: `${section.candidateId}-education-entry-${index + 1}`,
      datasetId: section.datasetId,
      candidateId: section.candidateId,
      degree: null,
      institution: null,
      location: null,
      dateRange,
      notes: null,
      sourceSectionIds: [section.id],
      confidence: 0.333,
      rawText: normalized,
    };
  }

  return {
    id: `${section.candidateId}-education-entry-${index + 1}`,
    datasetId: section.datasetId,
    candidateId: section.candidateId,
    degree: degree ? stripWrappingPunctuation(degree) : null,
    institution: institution ? stripWrappingPunctuation(institution) : null,
    location,
    dateRange,
    notes,
    sourceSectionIds: [section.id],
    confidence: computeConfidence([
      Boolean(degree),
      Boolean(institution),
      Boolean(dateRange),
    ]),
    rawText: normalized,
  };
}

function extractEducationEntries(artifacts: ResumeRagDocumentArtifacts): StructuredResumeEducationEntry[] {
  const sections = artifacts.sections.filter((section) => section.kind === 'education');
  const entries: StructuredResumeEducationEntry[] = [];

  for (const section of sections) {
    const items = splitBulletItems(section.content);

    for (const item of items) {
      const parsed = parseEducationItem(item, section, entries.length);

      if (parsed) {
        entries.push(parsed);
      }
    }
  }

  return entries.reduce<StructuredResumeEducationEntry[]>((accumulator, entry) => {
    const previous = accumulator.at(-1);

    if (previous && !entry.degree && !entry.institution && entry.dateRange) {
      previous.dateRange = previous.dateRange
        ? `${previous.dateRange} / ${entry.dateRange}`
        : entry.dateRange;
      previous.confidence = Math.max(previous.confidence, entry.confidence);
      return accumulator;
    }

    if (
      previous &&
      !previous.dateRange &&
      entry.dateRange &&
      previous.institution === entry.institution &&
      previous.degree === entry.degree
    ) {
      previous.dateRange = entry.dateRange;
      previous.confidence = Math.max(previous.confidence, entry.confidence);
      return accumulator;
    }

    accumulator.push(entry);
    return accumulator;
  }, []);
}

function extractLanguageEntries(artifacts: ResumeRagDocumentArtifacts): StructuredResumeLanguageEntry[] {
  const entries: StructuredResumeLanguageEntry[] = [];

  for (const section of artifacts.sections.filter((item) => item.kind === 'languages')) {
    for (const match of section.content.matchAll(LANGUAGE_ITEM_REGEX)) {
      const language = normalizeWhitespace(match[1] ?? '');

      if (!language) {
        continue;
      }

      entries.push({
        id: `${section.candidateId}-language-entry-${entries.length + 1}`,
        datasetId: section.datasetId,
        candidateId: section.candidateId,
        language: stripWrappingPunctuation(language),
        level: match[2] ? normalizeWhitespace(match[2]) : null,
        note: match[3] ? normalizeWhitespace(match[3]) : null,
        sourceSectionIds: [section.id],
        confidence: computeConfidence([Boolean(language), Boolean(match[2])]),
        rawText: normalizeWhitespace(match[0]),
      });
    }
  }

  return entries;
}

function parseCertificationItem(
  item: string,
  section: ParsedResumeSection,
  index: number
): StructuredResumeCertificationEntry | null {
  const normalized = stripWrappingPunctuation(normalizeWhitespace(item));

  if (!normalized) {
    return null;
  }

  const dateText = extractDateRange(normalized);
  const withoutDate = dateText ? normalizeWhitespace(normalized.replace(dateText, ' ')) : normalized;
  const title = withoutDate.replace(/^[A-Za-z]+\s+\d{4}:\s*/i, '').trim();

  if (!title) {
    return null;
  }

  const issuerMatch = title.match(/\s+[-–]\s+(.+)$/);
  const issuer = issuerMatch ? normalizeWhitespace(issuerMatch[1]) : null;

  return {
    id: `${section.candidateId}-certification-entry-${index + 1}`,
    datasetId: section.datasetId,
    candidateId: section.candidateId,
    title: issuerMatch ? normalizeWhitespace(title.slice(0, issuerMatch.index)) : title,
    issuer,
    dateText,
    sourceSectionIds: [section.id],
    confidence: computeConfidence([Boolean(title), Boolean(dateText || issuer)]),
    rawText: normalized,
  };
}

function extractCertificationEntries(
  artifacts: ResumeRagDocumentArtifacts
): StructuredResumeCertificationEntry[] {
  const sections = artifacts.sections.filter((section) => section.kind === 'certifications');
  const entries: StructuredResumeCertificationEntry[] = [];

  for (const section of sections) {
    const items = splitBulletItems(section.content);

    for (const item of items) {
      const parsed = parseCertificationItem(item, section, entries.length);

      if (parsed) {
        entries.push(parsed);
      }
    }
  }

  return entries;
}

export function extractStructuredResumeData(
  artifacts: Omit<ResumeRagDocumentArtifacts, 'structuredData'>
): StructuredResumeData {
  return {
    experience: extractExperienceEntries(artifacts as ResumeRagDocumentArtifacts),
    education: extractEducationEntries(artifacts as ResumeRagDocumentArtifacts),
    languages: extractLanguageEntries(artifacts as ResumeRagDocumentArtifacts),
    certifications: extractCertificationEntries(artifacts as ResumeRagDocumentArtifacts),
  };
}
