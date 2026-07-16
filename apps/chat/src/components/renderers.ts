import { getCopy, type UiLanguage } from '../i18n/copy';
import type { CandidateMatch } from '../types';

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  textContent?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (typeof textContent === 'string') {
    element.textContent = textContent;
  }

  return element;
}

function formatYearsValue(years: number, language: UiLanguage): string {
  if (years < 1) {
    return language === 'es' ? 'menos de un año' : 'less than 1 year';
  }

  return String(Math.max(1, Math.round(years)));
}

function formatEstimatedExperience(years: number, language: UiLanguage): string {
  if (language === 'es') {
    return years < 1 ? 'Menos de un año de experiencia' : `${formatYearsValue(years, language)} años estimados`;
  }

  return years < 1
    ? 'Less than 1 year of experience'
    : `${formatYearsValue(years, language)} estimated years`;
}

export function renderMatches(
  container: HTMLElement,
  matches: CandidateMatch[],
  language: UiLanguage
) {
  const copy = getCopy(language);
  container.replaceChildren();

  if (matches.length === 0) {
    return;
  }

  container.appendChild(createElement('div', 'pill', copy.topMatches));

  for (const match of matches) {
    const card = createElement('article', 'match');
    const title = createElement('strong', undefined, match.fullName);
    const role = createElement(
      'div',
      'meta',
      `${match.primaryRole} · ${formatEstimatedExperience(
        match.totalEstimatedExperienceYears,
        language
      )}`
    );
    const languagesLine = createElement(
      'div',
      'meta',
      match.languages.length > 0 ? match.languages.join(', ') : '—'
    );

    card.append(title, role, languagesLine);
    container.appendChild(card);
  }
}
