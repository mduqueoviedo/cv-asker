import type {
  CandidateResume,
  ResumeDocumentLanguage,
  ResumeExperienceEntry,
  ResumeTemplateId,
} from '../../types/resume.js';

interface ResumeHtmlLabels {
  contact: string;
  profile: string;
  age: string;
  experience: string;
  experienceUnit: string;
  highlights: string;
  certifications: string;
  professionalSummary: string;
  workExperience: string;
  coreTechnologies: string;
  education: string;
  languages: string;
  candidateId: string;
  portfolio: string;
  linkedin: string;
  location: string;
  email: string;
  phone: string;
}

interface RenderResumeHtmlOptions {
  styles: string;
  template?: ResumeTemplateId;
}

const DEFAULT_TEMPLATE: ResumeTemplateId = 'aurora-split';

const HTML_LABELS: Record<ResumeDocumentLanguage, ResumeHtmlLabels> = {
  en: {
    contact: 'Contact',
    profile: 'Profile',
    age: 'Age',
    experience: 'Experience',
    experienceUnit: 'years',
    highlights: 'Highlights',
    certifications: 'Certifications',
    professionalSummary: 'Professional Summary',
    workExperience: 'Work Experience',
    coreTechnologies: 'Core Technologies',
    education: 'Education',
    languages: 'Languages',
    candidateId: 'Candidate ID',
    portfolio: 'Portfolio',
    linkedin: 'LinkedIn',
    location: 'Location',
    email: 'Email',
    phone: 'Phone',
  },
  'es-ES': {
    contact: 'Contacto',
    profile: 'Perfil',
    age: 'Edad',
    experience: 'Experiencia',
    experienceUnit: 'años',
    highlights: 'Puntos clave',
    certifications: 'Certificaciones',
    professionalSummary: 'Resumen profesional',
    workExperience: 'Experiencia profesional',
    coreTechnologies: 'Tecnologias principales',
    education: 'Formacion',
    languages: 'Idiomas',
    candidateId: 'ID de candidato',
    portfolio: 'Portfolio',
    linkedin: 'LinkedIn',
    location: 'Ubicacion',
    email: 'Email',
    phone: 'Telefono',
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRgb(color: [number, number, number]): string {
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

function createAvatarDataUri(candidate: CandidateResume): string {
  const { photoPalette } = candidate;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 280" role="img" aria-label="${escapeHtml(candidate.fullName)}">
      <defs>
        <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${formatRgb(photoPalette.background)}" />
          <stop offset="100%" stop-color="${formatRgb(photoPalette.accent)}" />
        </linearGradient>
      </defs>
      <rect width="240" height="280" rx="32" fill="url(#bg)" />
      <circle cx="120" cy="98" r="54" fill="${formatRgb(photoPalette.skin)}" />
      <path d="M68 92c8-39 35-62 63-62 33 0 59 23 66 61-10-10-28-17-49-17-35 0-61 8-80 18Z" fill="${formatRgb(photoPalette.hair)}" />
      <rect x="58" y="158" width="124" height="96" rx="38" fill="${formatRgb(photoPalette.jacket)}" />
      <path d="M95 162h50l17 92H78l17-92Z" fill="${formatRgb(photoPalette.shirt)}" />
      <circle cx="102" cy="95" r="5" fill="#1f2937" />
      <circle cx="141" cy="95" r="5" fill="#1f2937" />
      <path d="M103 122c10 8 24 8 34 0" fill="none" stroke="#7c2d12" stroke-linecap="round" stroke-width="4" />
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function renderExperienceItems(experiences: ResumeExperienceEntry[]): string {
  return experiences
    .map((entry) => {
      const achievements = entry.achievements
        .map((item) => `<li class="achievement-item">${escapeHtml(item)}</li>`)
        .join('');

      return `
        <article class="timeline-item">
          <div class="timeline-row">
            <div>
              <h3 class="item-title">${escapeHtml(entry.title)}</h3>
              <p class="item-subtitle">${escapeHtml(entry.company)}</p>
            </div>
            <p class="item-meta">${escapeHtml(entry.startDate)} - ${escapeHtml(entry.endDate)}</p>
          </div>
          <ul class="achievement-list">${achievements}</ul>
        </article>
      `;
    })
    .join('');
}

export function renderResumeHtml(
  candidate: CandidateResume,
  options: RenderResumeHtmlOptions
): string {
  const template = options.template ?? DEFAULT_TEMPLATE;

  if (template !== DEFAULT_TEMPLATE) {
    throw new Error(`Resume template "${template}" is not supported.`);
  }

  const labels = HTML_LABELS[candidate.documentLanguage];
  const avatarDataUri = createAvatarDataUri(candidate);
  const technologies = candidate.coreTechnologies
    .map((technology) => `<li class="token token-surface">${escapeHtml(technology)}</li>`)
    .join('');
  const languages = candidate.spokenLanguages
    .map(
      (language) => `
        <li class="meta-row">
          <span>${escapeHtml(language.name)}</span>
          <strong>${escapeHtml(language.level)}</strong>
        </li>
      `
    )
    .join('');
  const education = candidate.education
    .map(
      (entry) => `
        <article class="education-item">
          <h3 class="item-title">${escapeHtml(entry.degree)}</h3>
          <p class="item-subtitle">${escapeHtml(entry.institution)}</p>
          <p class="item-meta">${escapeHtml(entry.location)} · ${entry.startYear} - ${entry.endYear}</p>
        </article>
      `
    )
    .join('');
  const certifications = candidate.certifications
    .map((item) => `<li class="token token-sidebar">${escapeHtml(item)}</li>`)
    .join('');
  const highlights = candidate.highlights
    .map((item) => `<li class="highlight-item">${escapeHtml(item)}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="${candidate.documentLanguage}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(candidate.fullName)} - ${escapeHtml(candidate.primaryRole)}</title>
    <style>${options.styles}</style>
  </head>
  <body>
    <main
      class="resume-page"
      data-template="${template}"
      style="--resume-accent: ${formatRgb(candidate.photoPalette.accent)}; --resume-accent-soft: rgba(${candidate.photoPalette.accent[0]}, ${candidate.photoPalette.accent[1]}, ${candidate.photoPalette.accent[2]}, 0.16); --resume-background: ${formatRgb(candidate.photoPalette.background)};"
    >
      <div class="page-noise page-noise-top"></div>
      <div class="page-noise page-noise-bottom"></div>

      <section class="resume-shell">
        <aside class="resume-sidebar">
          <div class="identity-block">
            <img class="avatar" src="${avatarDataUri}" alt="${escapeHtml(candidate.fullName)}" />
            <div class="identity-copy">
              <p class="eyebrow eyebrow-inverse">${escapeHtml(labels.profile)}</p>
              <h1 class="candidate-name">${escapeHtml(candidate.fullName)}</h1>
              <p class="candidate-role">${escapeHtml(candidate.primaryRole)}</p>
            </div>
          </div>

          <section class="sidebar-panel">
            <p class="eyebrow eyebrow-inverse">${escapeHtml(labels.contact)}</p>
            <ul class="contact-list">
              <li class="meta-row"><span>${escapeHtml(labels.candidateId)}</span><strong>${escapeHtml(candidate.id)}</strong></li>
              <li class="meta-row"><span>${escapeHtml(labels.email)}</span><strong>${escapeHtml(candidate.email)}</strong></li>
              <li class="meta-row"><span>${escapeHtml(labels.phone)}</span><strong>${escapeHtml(candidate.phone)}</strong></li>
              <li class="meta-row"><span>${escapeHtml(labels.location)}</span><strong>${escapeHtml(candidate.location)}</strong></li>
              <li class="meta-row"><span>${escapeHtml(labels.linkedin)}</span><strong>${escapeHtml(candidate.linkedinUrl)}</strong></li>
              ${
                candidate.portfolioUrl
                  ? `<li class="meta-row"><span>${escapeHtml(labels.portfolio)}</span><strong>${escapeHtml(candidate.portfolioUrl)}</strong></li>`
                  : ''
              }
            </ul>
          </section>

          <section class="sidebar-panel">
            <p class="eyebrow eyebrow-inverse">${escapeHtml(labels.profile)}</p>
            <div class="stats-grid">
              <article class="stat-card">
                <span>${escapeHtml(labels.age)}</span>
                <strong>${candidate.age}</strong>
              </article>
              <article class="stat-card">
                <span>${escapeHtml(labels.experience)}</span>
                <strong>${candidate.totalExperienceYears} ${escapeHtml(labels.experienceUnit)}</strong>
              </article>
            </div>
          </section>

          <section class="sidebar-panel">
            <p class="eyebrow eyebrow-inverse">${escapeHtml(labels.languages)}</p>
            <ul class="meta-list">${languages}</ul>
          </section>

          <section class="sidebar-panel">
            <p class="eyebrow eyebrow-inverse">${escapeHtml(labels.certifications)}</p>
            <ul class="token-list">${certifications}</ul>
          </section>
        </aside>

        <section class="resume-main">
          <header class="hero-panel">
            <div class="hero-copy">
              <p class="eyebrow">${escapeHtml(labels.professionalSummary)}</p>
              <h2 class="hero-title">${escapeHtml(candidate.primaryRole)}</h2>
              <p class="hero-summary">${escapeHtml(candidate.summary)}</p>
            </div>
            <span class="template-badge">${escapeHtml(template)}</span>
          </header>

          <section class="content-section">
            <h2 class="section-title">${escapeHtml(labels.highlights)}</h2>
            <ul class="highlight-list">${highlights}</ul>
          </section>

          <section class="content-section">
            <h2 class="section-title">${escapeHtml(labels.coreTechnologies)}</h2>
            <ul class="token-list token-list-main">${technologies}</ul>
          </section>

          <section class="content-section">
            <h2 class="section-title">${escapeHtml(labels.workExperience)}</h2>
            <div class="timeline-list">${renderExperienceItems(candidate.experience)}</div>
          </section>

          <section class="content-section">
            <h2 class="section-title">${escapeHtml(labels.education)}</h2>
            <div class="education-list">${education}</div>
          </section>
        </section>
      </section>
    </main>
  </body>
</html>`;
}
