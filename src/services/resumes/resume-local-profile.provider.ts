import { Faker, en, en_GB, es } from '@faker-js/faker';
import type {
  ResumeDocumentLanguage,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeGrammaticalGender,
  ResumeLanguage,
} from '../../types/resume.js';
import type { ResumeGeneratedProfile, ResumeProfileDraft } from './resume-llm-text.service.js';

interface EducationInstitutionOption {
  institution: string;
  location: string;
}

interface OptionalLanguageOption {
  name: string;
  levels: string[];
}

const ENGLISH_ROLE_CATALOG = [
  'Frontend Engineer',
  'Full Stack Developer',
  'Backend Engineer',
  'Data Engineer',
  'QA Automation Engineer',
  'Platform Engineer',
  'Product Engineer',
  'DevOps Engineer',
] as const;

const SPANISH_ROLE_CATALOG = [
  {
    feminine: 'Ingeniera Frontend',
    masculine: 'Ingeniero Frontend',
  },
  {
    feminine: 'Desarrolladora Full Stack',
    masculine: 'Desarrollador Full Stack',
  },
  {
    feminine: 'Ingeniera Backend',
    masculine: 'Ingeniero Backend',
  },
  {
    feminine: 'Ingeniera de Datos',
    masculine: 'Ingeniero de Datos',
  },
  {
    feminine: 'Ingeniera QA Automation',
    masculine: 'Ingeniero QA Automation',
  },
  {
    feminine: 'Ingeniera de Plataforma',
    masculine: 'Ingeniero de Plataforma',
  },
  {
    feminine: 'Ingeniera de Producto',
    masculine: 'Ingeniero de Producto',
  },
  {
    feminine: 'Ingeniera DevOps',
    masculine: 'Ingeniero DevOps',
  },
] as const;

const DOMAIN_CATALOG = {
  en: [
    'B2B SaaS products',
    'self-service ecommerce journeys',
    'internal workflow platforms',
    'data-heavy operational dashboards',
    'developer tooling',
    'cloud operations platforms',
  ],
  'es-ES': [
    'productos SaaS B2B',
    'experiencias ecommerce de autoservicio',
    'plataformas internas de operaciones',
    'dashboards de datos para negocio',
    'herramientas para equipos de desarrollo',
    'plataformas de operaciones cloud',
  ],
} as const;

const SPECIALTY_CATALOG = {
  en: [
    'accessible user experiences',
    'stable delivery pipelines',
    'well-structured product systems',
    'cross-team technical alignment',
    'pragmatic quality practices',
    'maintainable service architecture',
  ],
  'es-ES': [
    'experiencias de usuario accesibles',
    'pipelines de entrega estables',
    'sistemas de producto bien estructurados',
    'alineamiento tecnico entre equipos',
    'practicas de calidad pragmaticas',
    'arquitecturas mantenibles de servicios',
  ],
} as const;

const TECHNOLOGY_CATALOG = [
  'TypeScript',
  'JavaScript',
  'React',
  'Next.js',
  'Node.js',
  'Express',
  'PostgreSQL',
  'MongoDB',
  'Docker',
  'Kubernetes',
  'AWS',
  'GitHub Actions',
  'Playwright',
  'Cypress',
  'Python',
  'FastAPI',
  'GraphQL',
  'Redis',
  'Tailwind CSS',
  'Terraform',
] as const;

const EDUCATION_CATALOG = {
  en: [
    'BSc in Computer Science',
    'BSc in Software Engineering',
    'MSc in Data Engineering',
    'BEng in Telecommunications Engineering',
  ],
  'es-ES': [
    'Grado en Ingenieria Informatica',
    'Grado en Desarrollo de Software',
    'Master en Ingenieria de Datos',
    'Grado en Ingenieria de Telecomunicaciones',
  ],
} as const;

const EDUCATION_INSTITUTION_CATALOG: Record<
  ResumeDocumentLanguage,
  readonly EducationInstitutionOption[]
> = {
  en: [
    { institution: 'University of Manchester', location: 'Manchester, United Kingdom' },
    { institution: 'University of Leeds', location: 'Leeds, United Kingdom' },
    { institution: 'Kingston University', location: 'London, United Kingdom' },
    { institution: 'University College Dublin', location: 'Dublin, Ireland' },
    { institution: 'University of Amsterdam', location: 'Amsterdam, Netherlands' },
    { institution: 'Technical University of Berlin', location: 'Berlin, Germany' },
  ],
  'es-ES': [
    { institution: 'Universidad Autonoma de Madrid', location: 'Madrid, Spain' },
    { institution: 'Universitat Politecnica de Catalunya', location: 'Barcelona, Spain' },
    { institution: 'Universidad de Granada', location: 'Granada, Spain' },
    { institution: 'Universidad de Valencia', location: 'Valencia, Spain' },
    { institution: 'Universidad de Sevilla', location: 'Sevilla, Spain' },
    { institution: 'Universidad de La Laguna', location: 'San Cristobal de La Laguna, Spain' },
  ],
} as const;

const CERTIFICATION_CATALOG = [
  'AWS Certified Developer',
  'Microsoft Azure Fundamentals',
  'Professional Scrum Master I',
  'Google Cloud Digital Leader',
  'Meta Front-End Developer Certificate',
  'MongoDB Associate Developer',
  'Terraform Associate',
  'CKAD',
  'ICAg Accessibility for Web Designers',
  'Databricks Data Engineer Associate',
] as const;

const COMPANY_PREFIX_CATALOG = [
  'Northstar',
  'Atlas',
  'Signal',
  'Blue Harbor',
  'Nova',
  'Pixel',
  'Vector',
  'Orbit',
  'Summit',
  'Lattice',
  'Brightpath',
  'Riverstone',
  'Granite',
  'Aster',
  'Cedar',
  'Skyline',
  'Vertex',
  'Maple',
] as const;

const COMPANY_SUFFIX_CATALOG = [
  'Labs',
  'Systems',
  'Cloud',
  'Commerce',
  'Analytics',
  'Works',
  'Platform',
  'Dynamics',
  'Software',
  'Digital',
  'Collective',
  'Data',
  'Studios',
] as const;

const OPTIONAL_LANGUAGE_CATALOG: Record<
  ResumeDocumentLanguage,
  readonly OptionalLanguageOption[]
> = {
  en: [
    { name: 'Spanish', levels: ['B1', 'B2', 'C1'] },
    { name: 'French', levels: ['B1', 'B2', 'C1'] },
    { name: 'German', levels: ['B1', 'B2'] },
    { name: 'Dutch', levels: ['B1', 'B2'] },
    { name: 'Portuguese', levels: ['B1', 'B2'] },
    { name: 'Italian', levels: ['B1', 'B2'] },
  ],
  'es-ES': [
    { name: 'Ingles', levels: ['B2', 'C1', 'C2'] },
    { name: 'Frances', levels: ['B1', 'B2', 'C1'] },
    { name: 'Aleman', levels: ['B1', 'B2'] },
    { name: 'Italiano', levels: ['B1', 'B2'] },
    { name: 'Portugues', levels: ['B1', 'B2'] },
    { name: 'Catalan', levels: ['B2', 'C1'] },
  ],
} as const;

function createScopedFaker(language: ResumeDocumentLanguage, seed: number): Faker {
  const fakerInstance = new Faker({
    locale: language === 'es-ES' ? [es, en] : [en_GB, en],
  });
  fakerInstance.seed(seed);
  return fakerInstance;
}

function pickOne<T>(values: readonly T[], offset: number): T {
  return values[offset % values.length] as T;
}

function pickRandomSubset<T>(fakerInstance: Faker, values: readonly T[], count: number): T[] {
  return fakerInstance.helpers.arrayElements([...values], count);
}

function createSpokenLanguages(
  fakerInstance: Faker,
  language: ResumeDocumentLanguage
): ResumeLanguage[] {
  if (language === 'es-ES') {
    const englishLevel = fakerInstance.helpers.arrayElement(['B2', 'C1', 'C2']);
    const optionalCount = fakerInstance.number.int({ min: 0, max: 2 });
    const optionalLanguages = pickRandomSubset(
      fakerInstance,
      OPTIONAL_LANGUAGE_CATALOG['es-ES'].filter((entry) => entry.name !== 'Ingles'),
      optionalCount
    ).map((entry) => ({
      name: entry.name,
      level: fakerInstance.helpers.arrayElement([...entry.levels]),
    }));

    return [
      { name: 'Espanol', level: 'Nativo' },
      { name: 'Ingles', level: englishLevel },
      ...optionalLanguages,
    ];
  }

  const primaryForeignLanguage = fakerInstance.helpers.arrayElement(OPTIONAL_LANGUAGE_CATALOG.en);
  const extraCandidates = OPTIONAL_LANGUAGE_CATALOG.en.filter(
    (entry) => entry.name !== primaryForeignLanguage.name
  );
  const optionalCount = fakerInstance.number.int({ min: 0, max: 1 });
  const optionalLanguages = pickRandomSubset(fakerInstance, extraCandidates, optionalCount).map(
    (entry) => ({
      name: entry.name,
      level: fakerInstance.helpers.arrayElement([...entry.levels]),
    })
  );

  return [
    { name: 'English', level: 'Native' },
    {
      name: primaryForeignLanguage.name,
      level: fakerInstance.helpers.arrayElement([...primaryForeignLanguage.levels]),
    },
    ...optionalLanguages,
  ];
}

function createEducation(
  fakerInstance: Faker,
  draft: ResumeProfileDraft
): ResumeEducationEntry[] {
  const language = draft.documentLanguage;
  const degreeCatalog = EDUCATION_CATALOG[language];
  const institutionCatalog = EDUCATION_INSTITUTION_CATALOG[language];
  const endYear = new Date().getFullYear() - Math.max(4, draft.totalExperienceYears);
  const startYear = endYear - 4;
  const institution = fakerInstance.helpers.arrayElement(institutionCatalog);

  return [
    {
      degree: degreeCatalog[fakerInstance.number.int({ min: 0, max: degreeCatalog.length - 1 })],
      institution: institution.institution,
      location: institution.location,
      startYear,
      endYear,
    },
  ];
}

function createRole(draft: ResumeProfileDraft, baseRole: string): string {
  if (draft.totalExperienceYears < 7) {
    return baseRole;
  }

  if (draft.documentLanguage === 'es-ES') {
    if (baseRole.includes('Senior')) {
      return baseRole;
    }

    return `${baseRole} Senior`;
  }

  if (baseRole.startsWith('Senior ')) {
    return baseRole;
  }

  return `Senior ${baseRole}`;
}

function createBaseRole(draft: ResumeProfileDraft, fakerInstance: Faker): string {
  if (draft.documentLanguage === 'es-ES') {
    const role =
      SPANISH_ROLE_CATALOG[
        fakerInstance.number.int({ min: 0, max: SPANISH_ROLE_CATALOG.length - 1 })
      ];

    return draft.grammaticalGender === 'feminine' ? role.feminine : role.masculine;
  }

  return ENGLISH_ROLE_CATALOG[
    fakerInstance.number.int({ min: 0, max: ENGLISH_ROLE_CATALOG.length - 1 })
  ];
}

function createSoftwareTitle(gender: ResumeGrammaticalGender): string {
  return gender === 'feminine' ? 'Desarrolladora de Software' : 'Desarrollador de Software';
}

function createPlatformTitle(gender: ResumeGrammaticalGender): string {
  return gender === 'feminine' ? 'Ingeniera de Software' : 'Ingeniero de Software';
}

function createExperienceTitle(
  draft: ResumeProfileDraft,
  role: string,
  index: number,
  totalEntries: number
): string {
  if (index === totalEntries - 1) {
    return role;
  }

  if (draft.documentLanguage === 'es-ES') {
    if (role.includes('Senior')) {
      return role.replace(' Senior', '');
    }

    if (role.includes('de Plataforma')) {
      return createPlatformTitle(draft.grammaticalGender);
    }

    if (role.includes('de Datos')) {
      return 'Analista de Datos';
    }

    return createSoftwareTitle(draft.grammaticalGender);
  }

  if (role.startsWith('Senior ')) {
    return role.replace('Senior ', '');
  }

  if (role.includes('Platform')) {
    return 'Software Engineer';
  }

  if (role.includes('Data')) {
    return 'Data Analyst';
  }

  return 'Software Developer';
}

function createExperienceAchievements(
  language: ResumeDocumentLanguage,
  role: string,
  domain: string,
  technologies: string[],
  index: number
): string[] {
  const primaryTechnology = technologies[index % technologies.length];
  const secondaryTechnology = technologies[(index + 2) % technologies.length];

  if (language === 'es-ES') {
    return [
      `Impulso mejoras en ${domain} usando ${primaryTechnology} y ${secondaryTechnology}, con foco en calidad tecnica y entrega continua.`,
      `Colaboro con producto y diseno para simplificar decisiones, reducir incidencias y dar continuidad al trabajo de ${role.toLowerCase()}.`,
    ];
  }

  return [
    `Shipped improvements for ${domain} using ${primaryTechnology} and ${secondaryTechnology}, with strong attention to engineering quality and steady delivery.`,
    `Partnered with product and design to simplify decisions, reduce incidents, and keep the ${role.toLowerCase()} roadmap moving.`,
  ];
}

function createCompanyNames(fakerInstance: Faker, count: number): string[] {
  const companies = new Set<string>();

  while (companies.size < count) {
    const prefix = fakerInstance.helpers.arrayElement(COMPANY_PREFIX_CATALOG);
    const suffix = fakerInstance.helpers.arrayElement(COMPANY_SUFFIX_CATALOG);
    companies.add(`${prefix} ${suffix}`);
  }

  return [...companies];
}

function createExperience(
  fakerInstance: Faker,
  draft: ResumeProfileDraft,
  role: string,
  domain: string,
  technologies: string[]
): ResumeExperienceEntry[] {
  const language = draft.documentLanguage;
  const totalEntries = draft.totalExperienceYears >= 7 ? 3 : 2;
  const currentYear = new Date().getFullYear();
  const experiences: ResumeExperienceEntry[] = [];
  const companyNames = createCompanyNames(fakerInstance, totalEntries);

  for (let index = 0; index < totalEntries; index += 1) {
    const yearsAgoEnd = (totalEntries - index - 1) * 2;
    const endYear = index === totalEntries - 1 ? null : currentYear - yearsAgoEnd;
    const startYear =
      index === totalEntries - 1
        ? currentYear - Math.min(draft.totalExperienceYears, 3)
        : currentYear - yearsAgoEnd - 2;

    experiences.push({
      company: companyNames[index],
      title: createExperienceTitle(draft, role, index, totalEntries),
      startDate: language === 'es-ES' ? `Ene ${startYear}` : `Jan ${startYear}`,
      endDate:
        endYear === null
          ? language === 'es-ES'
            ? 'Actualidad'
            : 'Present'
          : language === 'es-ES'
            ? `Dic ${endYear}`
            : `Dec ${endYear}`,
      achievements: createExperienceAchievements(
        language,
        role,
        domain,
        technologies,
        index
      ),
    });
  }

  return experiences;
}

function createSummary(
  language: ResumeDocumentLanguage,
  role: string,
  technologies: string[],
  totalExperienceYears: number,
  domain: string,
  specialty: string
): string {
  if (language === 'es-ES') {
    return `${role} con ${totalExperienceYears} anos de experiencia construyendo ${domain} con ${technologies.slice(0, 3).join(', ')}. Destaca por ${specialty}, buena comunicacion cross-functional y una ejecucion fiable en entornos de producto.`;
  }

  return `${role} with ${totalExperienceYears} years of experience building ${domain} with ${technologies.slice(0, 3).join(', ')}. Known for ${specialty}, cross-functional collaboration, and reliable execution in product-driven teams.`;
}

function createHighlights(
  language: ResumeDocumentLanguage,
  role: string,
  technologies: string[],
  specialty: string
): string[] {
  return language === 'es-ES'
    ? [
        `Aporta criterio de producto y ejecucion tecnica como ${role.toLowerCase()}.`,
        `Trabaja con ${technologies.slice(0, 2).join(' y ')} sin perder foco en simplicidad y calidad.`,
        `Refuerza ${specialty} en equipos cross-functional y ciclos de entrega rapidos.`,
      ]
    : [
        `Brings product judgment in addition to technical execution as a ${role.toLowerCase()}.`,
        `Uses ${technologies.slice(0, 2).join(' and ')} while keeping quality and simplicity in view.`,
        `Strengthens ${specialty} across cross-functional teams and fast delivery cycles.`,
      ];
}

export function createLocalResumeProfile(draft: ResumeProfileDraft): ResumeGeneratedProfile {
  const fakerInstance = createScopedFaker(draft.documentLanguage, draft.seed);
  const baseRole = createBaseRole(draft, fakerInstance);
  const role = createRole(draft, baseRole);
  const coreTechnologies = pickRandomSubset(fakerInstance, TECHNOLOGY_CATALOG, 6);
  const domain = pickOne(
    DOMAIN_CATALOG[draft.documentLanguage],
    fakerInstance.number.int({ min: 0, max: DOMAIN_CATALOG[draft.documentLanguage].length - 1 })
  );
  const specialty = pickOne(
    SPECIALTY_CATALOG[draft.documentLanguage],
    fakerInstance.number.int({
      min: 0,
      max: SPECIALTY_CATALOG[draft.documentLanguage].length - 1,
    })
  );

  return {
    id: draft.id,
    llmModel: 'local/base-profile',
    primaryRole: role,
    summary: createSummary(
      draft.documentLanguage,
      role,
      coreTechnologies,
      draft.totalExperienceYears,
      domain,
      specialty
    ),
    coreTechnologies,
    spokenLanguages: createSpokenLanguages(fakerInstance, draft.documentLanguage),
    education: createEducation(fakerInstance, draft),
    experience: createExperience(fakerInstance, draft, role, domain, coreTechnologies),
    highlights: createHighlights(draft.documentLanguage, role, coreTechnologies, specialty),
    certifications: pickRandomSubset(
      fakerInstance,
      CERTIFICATION_CATALOG,
      fakerInstance.number.int({ min: 1, max: 3 })
    ),
    includePortfolio: fakerInstance.datatype.boolean({
      probability:
        role.includes('Frontend') || role.includes('Producto') || role.includes('Product') ? 0.7 : 0.35,
    }),
  };
}
