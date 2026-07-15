import { Faker, en, en_GB, es } from '@faker-js/faker';
import type {
  ResumeDocumentLanguage,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeGrammaticalGender,
  ResumeLanguage,
} from '../../types/resume.js';
import type { ResumeGeneratedProfile, ResumeProfileDraft } from './resume-llm-text.service.js';

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

const CERTIFICATION_CATALOG = [
  'AWS Certified Developer',
  'Microsoft Azure Fundamentals',
  'Professional Scrum Master I',
  'Google Cloud Digital Leader',
  'Meta Front-End Developer Certificate',
  'MongoDB Associate Developer',
] as const;

const COMPANY_CATALOG = [
  'Northstar Labs',
  'Atlas Commerce',
  'Signal Forge',
  'Blue Harbor Cloud',
  'Nova Metrics',
  'Pixel Foundry',
  'Vector Health',
  'Orbit Systems',
] as const;

function createScopedFaker(language: ResumeDocumentLanguage, seed: number): Faker {
  const fakerInstance = new Faker({
    locale: language === 'es-ES' ? [es, en] : [en_GB, en],
  });
  fakerInstance.seed(seed);
  return fakerInstance;
}

function createSeedFromId(value: string): number {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash || 1;
}

function pickMany<T>(values: readonly T[], count: number, offset: number): T[] {
  const result: T[] = [];

  for (let index = 0; index < count; index += 1) {
    result.push(values[(offset + index) % values.length] as T);
  }

  return result;
}

function pickOne<T>(values: readonly T[], offset: number): T {
  return values[offset % values.length] as T;
}

function createSpokenLanguages(language: ResumeDocumentLanguage): ResumeLanguage[] {
  return language === 'es-ES'
    ? [
        { name: 'Espanol', level: 'Nativo' },
        { name: 'Ingles', level: 'C1' },
      ]
    : [
        { name: 'English', level: 'Native' },
        { name: 'Spanish', level: 'C1' },
      ];
}

function createEducation(
  fakerInstance: Faker,
  draft: ResumeProfileDraft
): ResumeEducationEntry[] {
  const language = draft.documentLanguage;
  const degreeCatalog = EDUCATION_CATALOG[language];
  const endYear = new Date().getFullYear() - Math.max(4, draft.totalExperienceYears);
  const startYear = endYear - 4;

  return [
    {
      degree: degreeCatalog[fakerInstance.number.int({ min: 0, max: degreeCatalog.length - 1 })],
      institution: fakerInstance.helpers.arrayElement([
        'Universidad Autonoma de Madrid',
        'Universitat Politecnica de Catalunya',
        'University of Manchester',
        'University of Leeds',
        'Universidad de Granada',
        'Kingston University',
      ]),
      location: draft.location,
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

function createBaseRole(
  draft: ResumeProfileDraft,
  fakerInstance: Faker
): string {
  if (draft.documentLanguage === 'es-ES') {
    const role = SPANISH_ROLE_CATALOG[
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
  const companyOffset = fakerInstance.number.int({ min: 0, max: COMPANY_CATALOG.length - 1 });
  const companyNames = pickMany(COMPANY_CATALOG, totalEntries, companyOffset);

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
  const seed = createSeedFromId(draft.id);
  const fakerInstance = createScopedFaker(draft.documentLanguage, seed);
  const baseRole = createBaseRole(draft, fakerInstance);
  const role = createRole(draft, baseRole);
  const technologyOffset = fakerInstance.number.int({ min: 0, max: TECHNOLOGY_CATALOG.length - 1 });
  const coreTechnologies = pickMany(TECHNOLOGY_CATALOG, 6, technologyOffset);
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
    spokenLanguages: createSpokenLanguages(draft.documentLanguage),
    education: createEducation(fakerInstance, draft),
    experience: createExperience(fakerInstance, draft, role, domain, coreTechnologies),
    highlights: createHighlights(draft.documentLanguage, role, coreTechnologies, specialty),
    certifications: pickMany(
      CERTIFICATION_CATALOG,
      fakerInstance.number.int({ min: 1, max: 2 }),
      fakerInstance.number.int({ min: 0, max: CERTIFICATION_CATALOG.length - 1 })
    ),
    includePortfolio: fakerInstance.datatype.boolean({
      probability:
        role.includes('Frontend') || role.includes('Producto') || role.includes('Product') ? 0.7 : 0.35,
    }),
  };
}
