import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CandidateResume,
  GenerateResumeDatasetInput,
  GeneratedResumeArtifact,
  ResumeGenerationMode,
  ResumeDatasetManifest,
  ResumeEducationEntry,
  ResumeExperienceEntry,
} from '../../types/resume.js';
import { renderResumePdf } from './resume-pdf.service.js';
import { createStaticResumeSeedDataProvider } from './resume-seed-data.provider.js';

const DEFAULT_RESUME_COUNT = 28;
const MIN_RESUME_COUNT = 25;
const MAX_RESUME_COUNT = 30;
const OUTPUT_DIRECTORY = path.join(process.cwd(), 'storage', 'generated-resumes');
const PDF_DIRECTORY = path.join(OUTPUT_DIRECTORY, 'pdfs');
const METADATA_DIRECTORY = path.join(OUTPUT_DIRECTORY, 'metadata');
const MANIFEST_PATH = path.join(OUTPUT_DIRECTORY, 'manifest.json');
const resumeSeedDataProvider = createStaticResumeSeedDataProvider();

interface RoleArchetype {
  role: string;
  summaryFocus: string;
  technologies: string[];
  educationTracks: string[];
  certifications: string[];
  highlights: string[];
  companies: string[];
  jobTitles: string[];
  achievementTemplates: string[];
}

const ROLE_ARCHETYPES: RoleArchetype[] = [
  {
    role: 'Full Stack Developer',
    summaryFocus: 'customer-facing web platforms with strong product iteration loops',
    technologies: ['TypeScript', 'React', 'Next.js', 'Node.js', 'PostgreSQL', 'Redis', 'Docker', 'GraphQL', 'Jest', 'Tailwind CSS'],
    educationTracks: ['Computer Science', 'Software Engineering', 'Telematics Engineering'],
    certifications: ['AWS Certified Developer - Associate', 'Scrum.org Professional Scrum Master I'],
    highlights: ['Led end-to-end delivery for high-traffic SaaS features', 'Balances frontend polish with backend reliability', 'Comfortable mentoring junior engineers'],
    companies: ['Northstar Commerce', 'Velora Labs', 'CloudCart Systems', 'Atlas Hiring'],
    jobTitles: ['Junior Full Stack Developer', 'Full Stack Engineer', 'Senior Full Stack Developer'],
    achievementTemplates: ['Delivered modular product features across frontend and backend services', 'Reduced release friction by improving CI pipelines and test coverage', 'Partnered with design and product on roadmap delivery for B2B workflows'],
  },
  {
    role: 'Backend Engineer',
    summaryFocus: 'API platforms, data-intensive services, and resilient backend architecture',
    technologies: ['Node.js', 'TypeScript', 'Python', 'PostgreSQL', 'Kafka', 'Redis', 'Docker', 'Kubernetes', 'OpenAPI', 'Terraform'],
    educationTracks: ['Computer Science', 'Informatics Engineering', 'Mathematics'],
    certifications: ['AWS Certified Solutions Architect - Associate', 'HashiCorp Certified Terraform Associate'],
    highlights: ['Builds reliable distributed services', 'Strong focus on observability and performance tuning', 'Experienced with event-driven integrations'],
    companies: ['Quantive Systems', 'Signal Harbor', 'LedgerFox', 'BlueDelta Tech'],
    jobTitles: ['Backend Developer', 'Software Engineer', 'Senior Backend Engineer'],
    achievementTemplates: ['Scaled API throughput for core internal services with measurable latency gains', 'Designed data contracts and integrations for cross-team platform adoption', 'Improved system resilience through observability and incident follow-up work'],
  },
  {
    role: 'Frontend Engineer',
    summaryFocus: 'accessible interfaces, design systems, and high-quality product experiences',
    technologies: ['React', 'Next.js', 'TypeScript', 'Storybook', 'Tailwind CSS', 'Playwright', 'Cypress', 'Figma', 'GraphQL', 'Vite'],
    educationTracks: ['Multimedia Engineering', 'Computer Science', 'Human Computer Interaction'],
    certifications: ['Meta Front-End Developer Certificate', 'Deque University Accessibility Fundamentals'],
    highlights: ['Turns design direction into polished production UI', 'Advocates for accessibility and performance budgets', 'Builds reusable component systems'],
    companies: ['Mintloop Studio', 'Brightside Health', 'Orbit Experience', 'Acorn Travel Tech'],
    jobTitles: ['Frontend Developer', 'UI Engineer', 'Senior Frontend Engineer'],
    achievementTemplates: ['Implemented responsive product flows with strong accessibility baselines', 'Worked closely with designers to evolve and document shared UI patterns', 'Improved perceived performance and frontend quality through instrumentation and testing'],
  },
  {
    role: 'Data Engineer',
    summaryFocus: 'analytics platforms, clean data contracts, and trustworthy reporting pipelines',
    technologies: ['Python', 'SQL', 'dbt', 'Airflow', 'BigQuery', 'Snowflake', 'Kafka', 'Docker', 'Terraform', 'Looker'],
    educationTracks: ['Data Engineering', 'Statistics', 'Computer Science'],
    certifications: ['Google Cloud Professional Data Engineer', 'dbt Fundamentals Badge'],
    highlights: ['Designs stable pipelines for analytics consumers', 'Comfortable with ELT modeling and orchestration', 'Strong partner for business and product analytics'],
    companies: ['River Metrics', 'Lumen Retail', 'Vertex Insights', 'Nexa Mobility'],
    jobTitles: ['Analytics Engineer', 'Data Engineer', 'Senior Data Engineer'],
    achievementTemplates: ['Built data models and pipelines used by analytics and operations teams', 'Improved freshness and trust in reporting layers through validation rules', 'Partnered with stakeholders to define durable business metrics and data contracts'],
  },
  {
    role: 'DevOps Engineer',
    summaryFocus: 'cloud platforms, deployment automation, and operational excellence',
    technologies: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'GitHub Actions', 'Linux', 'Prometheus', 'Grafana', 'Helm', 'Argo CD'],
    educationTracks: ['Computer Engineering', 'Network Engineering', 'Software Engineering'],
    certifications: ['CKA: Certified Kubernetes Administrator', 'AWS Certified SysOps Administrator - Associate'],
    highlights: ['Improves deployment safety and platform visibility', 'Strong on infrastructure as code and runbooks', 'Supports engineering teams with pragmatic tooling'],
    companies: ['Helio Cloud', 'ScaleRiver', 'Nimbus Ops', 'Aperture Systems'],
    jobTitles: ['Platform Engineer', 'DevOps Engineer', 'Senior DevOps Engineer'],
    achievementTemplates: ['Automated infrastructure changes and deployment workflows across environments', 'Raised platform reliability through dashboards, alerts, and incident review actions', 'Reduced manual operations by standardizing cloud and CI/CD tooling'],
  },
  {
    role: 'Machine Learning Engineer',
    summaryFocus: 'production ML systems, feature pipelines, and applied AI products',
    technologies: ['Python', 'PyTorch', 'scikit-learn', 'FastAPI', 'Pandas', 'Docker', 'MLflow', 'PostgreSQL', 'AWS', 'LangChain'],
    educationTracks: ['Artificial Intelligence', 'Data Science', 'Computer Science'],
    certifications: ['AWS Certified Machine Learning - Specialty', 'DeepLearning.AI Machine Learning Engineering for Production'],
    highlights: ['Ships models as usable product capabilities', 'Bridges experimentation and production deployment', 'Works comfortably across data and software boundaries'],
    companies: ['Cortex Vision', 'NovaSignals', 'Aster Health AI', 'Predictive Forge'],
    jobTitles: ['ML Engineer', 'Applied Scientist', 'Senior Machine Learning Engineer'],
    achievementTemplates: ['Built feature pipelines and model-serving workflows for production use cases', 'Collaborated with product teams to turn ML prototypes into measurable capabilities', 'Improved model monitoring and iteration loops for applied AI systems'],
  },
  {
    role: 'QA Automation Engineer',
    summaryFocus: 'quality strategy, automation coverage, and release confidence',
    technologies: ['TypeScript', 'Playwright', 'Cypress', 'Postman', 'GitHub Actions', 'SQL', 'Docker', 'JMeter', 'REST APIs', 'TestRail'],
    educationTracks: ['Software Engineering', 'Computer Science', 'Information Systems'],
    certifications: ['ISTQB Certified Tester Foundation Level', 'Postman API Fundamentals Student Expert'],
    highlights: ['Builds automation where it creates release leverage', 'Comfortable testing APIs and UI flows', 'Partners closely with developers on prevention over detection'],
    companies: ['Verity Digital', 'Pulse MedTech', 'Beacon Commerce', 'Juniper Finance'],
    jobTitles: ['QA Engineer', 'Automation Test Engineer', 'Senior QA Automation Engineer'],
    achievementTemplates: ['Expanded automated regression coverage for critical user journeys', 'Improved release confidence through better test diagnostics and CI reporting', 'Collaborated with engineers to shift quality checks earlier in delivery'],
  },
  {
    role: 'Mobile Developer',
    summaryFocus: 'consumer mobile apps with solid performance and maintainable delivery cadence',
    technologies: ['React Native', 'TypeScript', 'Swift', 'Kotlin', 'Firebase', 'REST APIs', 'Redux', 'Expo', 'GraphQL', 'Detox'],
    educationTracks: ['Computer Science', 'Software Engineering', 'Mobile Computing'],
    certifications: ['Google Associate Android Developer', 'Meta React Native Specialization'],
    highlights: ['Delivers product features across iOS and Android', 'Strong on mobile UX quality and release workflows', 'Balances speed with maintainable architecture'],
    companies: ['Pocket Atlas', 'Tripbeam', 'Wellnest Mobile', 'PayLynx'],
    jobTitles: ['Mobile Developer', 'React Native Engineer', 'Senior Mobile Engineer'],
    achievementTemplates: ['Released mobile features with attention to app performance and reliability', 'Improved mobile delivery workflows and issue triage with analytics and crash reporting', 'Worked with backend and product teams on end-to-end feature launches'],
  },
];

function pickByIndex<T>(values: T[], index: number, offset = 0): T {
  return values[(index + offset) % values.length];
}

function takeSequential<T>(values: T[], startIndex: number, count: number): T[] {
  const safeCount = Math.min(values.length, count);
  return Array.from({ length: safeCount }, (_, offset) => pickByIndex(values, startIndex, offset));
}

function createSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatMonthYear(date: Date): string {
  const month = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `${month} ${date.getUTCFullYear()}`;
}

function subtractMonths(date: Date, months: number): Date {
  const updatedDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  updatedDate.setUTCMonth(updatedDate.getUTCMonth() - months);
  return updatedDate;
}

function clampResumeCount(value: number): number {
  if (!Number.isInteger(value)) {
    throw new Error('Resume count must be an integer.');
  }

  if (value < MIN_RESUME_COUNT || value > MAX_RESUME_COUNT) {
    throw new Error(`Resume count must stay between ${MIN_RESUME_COUNT} and ${MAX_RESUME_COUNT}.`);
  }

  return value;
}

function resolveGenerationMode(input: GenerateResumeDatasetInput): ResumeGenerationMode {
  if (input.mode) {
    if (input.mode !== 'replace' && input.mode !== 'append') {
      throw new Error('Resume generation mode must be either "replace" or "append".');
    }

    if (
      typeof input.cleanOutput === 'boolean' &&
      input.cleanOutput !== (input.mode === 'replace')
    ) {
      throw new Error('Do not send conflicting values for "mode" and "cleanOutput".');
    }

    return input.mode;
  }

  if (typeof input.cleanOutput === 'boolean') {
    return input.cleanOutput ? 'replace' : 'append';
  }

  return 'replace';
}

async function ensureOutputDirectories(mode: ResumeGenerationMode) {
  if (mode === 'replace') {
    await rm(OUTPUT_DIRECTORY, { recursive: true, force: true });
  }

  await mkdir(PDF_DIRECTORY, { recursive: true });
  await mkdir(METADATA_DIRECTORY, { recursive: true });
}

function createCandidateSummary(
  candidateName: string,
  role: RoleArchetype,
  totalExperienceYears: number,
  technologies: string[]
): string {
  return `${candidateName} is a ${role.role.toLowerCase()} with ${totalExperienceYears} years of experience delivering ${role.summaryFocus}. Works confidently with ${technologies.slice(0, 4).join(', ')}, and is known for balancing execution speed, collaboration, and maintainable technical decisions.`;
}

function createEducationEntries(
  index: number,
  candidateAge: number,
  role: RoleArchetype,
  candidateLocation: string
): ResumeEducationEntry[] {
  const endYear = new Date().getUTCFullYear() - Math.max(1, candidateAge - 22);
  const degree = pickByIndex(role.educationTracks, index);
  const entries: ResumeEducationEntry[] = [
    {
      degree: `BSc in ${degree}`,
      institution: resumeSeedDataProvider.pickUniversity(index),
      location: candidateLocation,
      startYear: endYear - 4,
      endYear,
    },
  ];

  if (candidateAge >= 29 && index % 3 === 0) {
    entries.push({
      degree: `MSc in ${pickByIndex(role.educationTracks, index, 1)}`,
      institution: resumeSeedDataProvider.pickUniversity(index, 1),
      location: resumeSeedDataProvider.pickLocation(index, 1),
      startYear: endYear + 1,
      endYear: endYear + 2,
    });
  }

  return entries;
}

function createExperienceEntries(
  index: number,
  role: RoleArchetype,
  totalExperienceYears: number
): ResumeExperienceEntry[] {
  const monthsOfExperience = totalExperienceYears * 12;
  const stageWeights = [0.42, 0.33, 0.25];
  const now = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const experiences: ResumeExperienceEntry[] = [];
  let currentEndDate = now;

  role.jobTitles.slice(0, 3).reverse().forEach((title, reverseIndex) => {
    const normalizedWeight = stageWeights[reverseIndex] ?? 0.25;
    const durationOffset = ((index + reverseIndex) % 3) * 2;
    const durationMonths = Math.max(12, Math.round(monthsOfExperience * normalizedWeight) + durationOffset);
    const startDate = subtractMonths(currentEndDate, durationMonths);
    const achievements = takeSequential(role.achievementTemplates, index + reverseIndex, 2);

    experiences.push({
      company: pickByIndex(role.companies, index, reverseIndex),
      title,
      startDate: formatMonthYear(startDate),
      endDate: reverseIndex === 0 ? 'Present' : formatMonthYear(currentEndDate),
      achievements,
    });

    currentEndDate = subtractMonths(startDate, 1 + ((index + reverseIndex) % 3));
  });

  return experiences;
}

function createTotalExperienceYears(index: number, age: number): number {
  const baselineExperience = 2 + ((index * 3) % 10);
  return Math.min(age - 21, baselineExperience);
}

function createTechnologies(index: number, role: RoleArchetype): string[] {
  return takeSequential(role.technologies, index, 8 + (index % 3));
}

function shouldIncludePortfolio(role: RoleArchetype): boolean {
  return (
    role.role === 'Frontend Engineer' ||
    role.role === 'Full Stack Developer' ||
    role.role === 'Mobile Developer'
  );
}

function createCandidate(index: number): CandidateResume {
  const role = pickByIndex(ROLE_ARCHETYPES, index);
  const personSeed = resumeSeedDataProvider.createPersonSeed(index);
  const technologies = createTechnologies(index, role);
  const totalExperienceYears = createTotalExperienceYears(index, personSeed.age);
  const slug = createSlug(personSeed.fullName);
  const id = `${slug}-${index + 1}`;

  return {
    id,
    fullName: personSeed.fullName,
    age: personSeed.age,
    primaryRole: role.role,
    location: personSeed.location,
    email: personSeed.email,
    phone: personSeed.phone,
    linkedinUrl: `linkedin.com/in/${slug}`,
    portfolioUrl: shouldIncludePortfolio(role) ? `portfolio.${slug}.example` : undefined,
    summary: createCandidateSummary(personSeed.fullName, role, totalExperienceYears, technologies),
    totalExperienceYears,
    coreTechnologies: technologies,
    spokenLanguages: personSeed.spokenLanguages,
    education: createEducationEntries(index, personSeed.age, role, personSeed.location),
    experience: createExperienceEntries(index, role, totalExperienceYears),
    highlights: takeSequential(role.highlights, index, 3),
    certifications: takeSequential(role.certifications, index, 2),
    photoPalette: personSeed.photoPalette,
  };
}

async function writeCandidateArtifacts(candidate: CandidateResume): Promise<GeneratedResumeArtifact> {
  const pdfFileName = `${candidate.id}.pdf`;
  const metadataFileName = `${candidate.id}.json`;
  const pdfFilePath = path.join(PDF_DIRECTORY, pdfFileName);
  const metadataFilePath = path.join(METADATA_DIRECTORY, metadataFileName);
  const pdfBuffer = renderResumePdf(candidate);

  await writeFile(pdfFilePath, pdfBuffer);
  await writeFile(metadataFilePath, JSON.stringify(candidate, null, 2));

  return {
    id: candidate.id,
    fullName: candidate.fullName,
    primaryRole: candidate.primaryRole,
    pdfFileName,
    pdfFilePath,
    metadataFileName,
    metadataFilePath,
  };
}

export async function generateResumeDataset(
  input: GenerateResumeDatasetInput = {}
): Promise<ResumeDatasetManifest> {
  const count = clampResumeCount(input.count ?? DEFAULT_RESUME_COUNT);
  const mode = resolveGenerationMode(input);
  const existingManifest = mode === 'append' ? await getResumeDatasetManifest() : null;
  const existingResumes = existingManifest?.resumes ?? [];
  const startIndex = existingResumes.length;

  await ensureOutputDirectories(mode);

  const candidates = Array.from({ length: count }, (_, index) => createCandidate(startIndex + index));
  const newResumes = await Promise.all(candidates.map((candidate) => writeCandidateArtifacts(candidate)));
  const resumes = mode === 'append' ? [...existingResumes, ...newResumes] : newResumes;
  const manifest: ResumeDatasetManifest = {
    datasetId: `generated-resume-dataset-${new Date().toISOString()}`,
    generatedAt: new Date().toISOString(),
    lastGenerationMode: mode,
    lastBatchCount: newResumes.length,
    outputDirectory: OUTPUT_DIRECTORY,
    pdfDirectory: PDF_DIRECTORY,
    metadataDirectory: METADATA_DIRECTORY,
    count: resumes.length,
    resumes,
  };

  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  return manifest;
}

export async function getResumeDatasetManifest(): Promise<ResumeDatasetManifest | null> {
  try {
    const [manifestStats, pdfDirectoryStats, metadataDirectoryStats] = await Promise.all([
      stat(MANIFEST_PATH),
      stat(PDF_DIRECTORY),
      stat(METADATA_DIRECTORY),
    ]);

    if (!manifestStats.isFile() || !pdfDirectoryStats.isDirectory() || !metadataDirectoryStats.isDirectory()) {
      return null;
    }

    const content = await readFile(MANIFEST_PATH, 'utf8');
    return JSON.parse(content) as ResumeDatasetManifest;
  } catch {
    return null;
  }
}

export async function getResumeDatasetStorageSnapshot() {
  const manifest = await getResumeDatasetManifest();

  if (!manifest) {
    return null;
  }

  const [pdfFiles, metadataFiles] = await Promise.all([
    readdir(PDF_DIRECTORY),
    readdir(METADATA_DIRECTORY),
  ]);

  return {
    manifest,
    pdfCount: pdfFiles.length,
    metadataCount: metadataFiles.length,
  };
}
