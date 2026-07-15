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

function renderList(items: string[], className: string): string {
  return items.map((item) => `<li class="${className}">${escapeHtml(item)}</li>`).join('');
}

function renderExperienceItems(experiences: ResumeExperienceEntry[]): string {
  return experiences
    .map((entry) => {
      const achievements = renderList(entry.achievements, 'achievement-item');

      return `
        <article class="timeline-item">
          <div class="timeline-row">
            <div>
              <h3>${escapeHtml(entry.title)}</h3>
              <p class="timeline-company">${escapeHtml(entry.company)}</p>
            </div>
            <p class="timeline-date">${escapeHtml(entry.startDate)} - ${escapeHtml(entry.endDate)}</p>
          </div>
          <ul class="achievement-list">${achievements}</ul>
        </article>
      `;
    })
    .join('');
}

export function renderResumeHtml(
  candidate: CandidateResume,
  template: ResumeTemplateId = DEFAULT_TEMPLATE
): string {
  if (template !== DEFAULT_TEMPLATE) {
    throw new Error(`Resume template "${template}" is not supported.`);
  }

  const labels = HTML_LABELS[candidate.documentLanguage];
  const accent = formatRgb(candidate.photoPalette.accent);
  const background = formatRgb(candidate.photoPalette.background);
  const avatarDataUri = createAvatarDataUri(candidate);
  const technologies = candidate.coreTechnologies
    .map((technology) => `<li class="pill">${escapeHtml(technology)}</li>`)
    .join('');
  const languages = candidate.spokenLanguages
    .map(
      (language) =>
        `<li class="meta-list-item"><span>${escapeHtml(language.name)}</span><strong>${escapeHtml(language.level)}</strong></li>`
    )
    .join('');
  const education = candidate.education
    .map(
      (entry) => `
        <article class="education-item">
          <h3>${escapeHtml(entry.degree)}</h3>
          <p>${escapeHtml(entry.institution)}</p>
          <p class="muted">${escapeHtml(entry.location)} · ${entry.startYear} - ${entry.endYear}</p>
        </article>
      `
    )
    .join('');
  const certifications = renderList(candidate.certifications, 'meta-chip');
  const highlights = renderList(candidate.highlights, 'highlight-item');

  return `<!DOCTYPE html>
<html lang="${candidate.documentLanguage}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(candidate.fullName)} - ${escapeHtml(candidate.primaryRole)}</title>
    <style>
      :root {
        color-scheme: light;
        --paper: #fffaf2;
        --ink: #1f2937;
        --muted: #5b6473;
        --panel: rgba(255, 255, 255, 0.82);
        --line: rgba(31, 41, 55, 0.12);
        --accent: ${accent};
        --accent-soft: rgba(${candidate.photoPalette.accent[0]}, ${candidate.photoPalette.accent[1]}, ${candidate.photoPalette.accent[2]}, 0.14);
        --backdrop: ${background};
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background:
          radial-gradient(circle at top left, rgba(255, 255, 255, 0.86), transparent 34%),
          linear-gradient(135deg, var(--backdrop) 0%, #f8eee4 45%, #f4dcc8 100%);
        color: var(--ink);
      }

      .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 16mm;
      }

      .resume-shell {
        display: grid;
        grid-template-columns: 72mm minmax(0, 1fr);
        min-height: 265mm;
        border: 1px solid rgba(255, 255, 255, 0.48);
        border-radius: 28px;
        overflow: hidden;
        background: rgba(255, 251, 245, 0.74);
        box-shadow: 0 18px 45px rgba(52, 38, 20, 0.16);
        backdrop-filter: blur(14px);
      }

      .sidebar {
        padding: 14mm 10mm;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.08)),
          linear-gradient(180deg, ${background}, ${accent});
        color: #fffdf8;
      }

      .main {
        padding: 14mm 13mm;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0.88)),
          var(--paper);
      }

      .avatar {
        width: 100%;
        aspect-ratio: 6 / 7;
        border-radius: 24px;
        object-fit: cover;
        display: block;
        margin-bottom: 8mm;
        box-shadow: 0 12px 30px rgba(31, 41, 55, 0.25);
      }

      .name {
        margin: 0;
        font-size: 30px;
        line-height: 1.05;
        letter-spacing: -0.04em;
      }

      .role {
        margin: 2mm 0 0;
        font-size: 14px;
        line-height: 1.35;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        color: rgba(255, 253, 248, 0.78);
      }

      .section-kicker {
        margin: 0 0 3mm;
        font-size: 11px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        font-weight: 700;
      }

      .sidebar-section,
      .main-section {
        margin-top: 8mm;
      }

      .sidebar-section:first-of-type,
      .main-section:first-of-type {
        margin-top: 0;
      }

      .contact-list,
      .meta-list,
      .achievement-list,
      .highlight-list {
        padding: 0;
        margin: 0;
        list-style: none;
      }

      .contact-list li,
      .meta-list-item {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 2.5mm;
        font-size: 12px;
        line-height: 1.45;
      }

      .contact-list li span:first-child,
      .meta-label {
        color: rgba(255, 253, 248, 0.72);
      }

      .meta-list-item strong {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 3mm;
      }

      .stat-card {
        padding: 3.5mm;
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.14);
        border: 1px solid rgba(255, 255, 255, 0.16);
      }

      .stat-card strong {
        display: block;
        font-size: 20px;
        line-height: 1;
        margin-bottom: 1mm;
      }

      .stat-card span {
        display: block;
        font-size: 11px;
        color: rgba(255, 253, 248, 0.72);
      }

      .topline {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 7mm;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 0 14px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }

      .summary {
        margin: 0;
        font-size: 14px;
        line-height: 1.72;
        color: var(--muted);
      }

      .timeline-item,
      .education-item {
        margin-top: 5mm;
        padding-top: 5mm;
        border-top: 1px solid var(--line);
        page-break-inside: avoid;
      }

      .timeline-item:first-of-type,
      .education-item:first-of-type {
        margin-top: 0;
        padding-top: 0;
        border-top: 0;
      }

      .timeline-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: baseline;
      }

      h2,
      h3,
      p {
        margin: 0;
      }

      h2 {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        color: var(--accent);
      }

      h3 {
        font-size: 17px;
        line-height: 1.3;
      }

      .timeline-company,
      .muted,
      .timeline-date {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }

      .achievement-list,
      .highlight-list {
        margin-top: 3mm;
        display: grid;
        gap: 2.4mm;
      }

      .achievement-item,
      .highlight-item {
        position: relative;
        padding-left: 14px;
        font-size: 13px;
        line-height: 1.58;
        color: var(--ink);
      }

      .achievement-item::before,
      .highlight-item::before {
        content: "";
        position: absolute;
        top: 8px;
        left: 0;
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: var(--accent);
      }

      .pill-list,
      .chip-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 3mm 0 0;
        padding: 0;
        list-style: none;
      }

      .pill,
      .meta-chip {
        display: inline-flex;
        align-items: center;
        min-height: 30px;
        padding: 0 12px;
        border-radius: 999px;
        font-size: 12px;
        line-height: 1;
      }

      .pill {
        background: #ffffff;
        border: 1px solid rgba(31, 41, 55, 0.08);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
      }

      .meta-chip {
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.18);
      }

      @media print {
        body {
          background: #ffffff;
        }

        .page {
          width: auto;
          min-height: auto;
          padding: 0;
        }

        .resume-shell {
          border-radius: 0;
          box-shadow: none;
          border: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="page">
      <section class="resume-shell" data-template="${template}">
        <aside class="sidebar">
          <img class="avatar" src="${avatarDataUri}" alt="${escapeHtml(candidate.fullName)}" />
          <h1 class="name">${escapeHtml(candidate.fullName)}</h1>
          <p class="role">${escapeHtml(candidate.primaryRole)}</p>

          <section class="sidebar-section">
            <p class="section-kicker">${escapeHtml(labels.profile)}</p>
            <div class="stats-grid">
              <article class="stat-card">
                <strong>${candidate.age}</strong>
                <span>${escapeHtml(labels.age)}</span>
              </article>
              <article class="stat-card">
                <strong>${candidate.totalExperienceYears}</strong>
                <span>${escapeHtml(labels.experience)} ${escapeHtml(labels.experienceUnit)}</span>
              </article>
            </div>
          </section>

          <section class="sidebar-section">
            <p class="section-kicker">${escapeHtml(labels.contact)}</p>
            <ul class="contact-list">
              <li><span>${escapeHtml(labels.candidateId)}</span><strong>${escapeHtml(candidate.id)}</strong></li>
              <li><span>Email</span><strong>${escapeHtml(candidate.email)}</strong></li>
              <li><span>Phone</span><strong>${escapeHtml(candidate.phone)}</strong></li>
              <li><span>Location</span><strong>${escapeHtml(candidate.location)}</strong></li>
              <li><span>${escapeHtml(labels.linkedin)}</span><strong>${escapeHtml(candidate.linkedinUrl)}</strong></li>
              ${
                candidate.portfolioUrl
                  ? `<li><span>${escapeHtml(labels.portfolio)}</span><strong>${escapeHtml(candidate.portfolioUrl)}</strong></li>`
                  : ''
              }
            </ul>
          </section>

          <section class="sidebar-section">
            <p class="section-kicker">${escapeHtml(labels.languages)}</p>
            <ul class="meta-list">${languages}</ul>
          </section>

          <section class="sidebar-section">
            <p class="section-kicker">${escapeHtml(labels.certifications)}</p>
            <ul class="chip-list">${certifications}</ul>
          </section>
        </aside>

        <section class="main">
          <div class="topline">
            <div>
              <p class="section-kicker" style="color: var(--muted);">${escapeHtml(labels.professionalSummary)}</p>
              <h2>${escapeHtml(candidate.primaryRole)}</h2>
            </div>
            <span class="badge">${escapeHtml(template)}</span>
          </div>

          <section class="main-section">
            <p class="summary">${escapeHtml(candidate.summary)}</p>
          </section>

          <section class="main-section">
            <h2>${escapeHtml(labels.highlights)}</h2>
            <ul class="highlight-list">${highlights}</ul>
          </section>

          <section class="main-section">
            <h2>${escapeHtml(labels.coreTechnologies)}</h2>
            <ul class="pill-list">${technologies}</ul>
          </section>

          <section class="main-section">
            <h2>${escapeHtml(labels.workExperience)}</h2>
            ${renderExperienceItems(candidate.experience)}
          </section>

          <section class="main-section">
            <h2>${escapeHtml(labels.education)}</h2>
            ${education}
          </section>
        </section>
      </section>
    </main>
  </body>
</html>
`;
}
