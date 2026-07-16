import { getCopy, type UiLanguage } from '../i18n/copy';
import type { CandidateMatch, Citation } from '../types';

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
      `${match.primaryRole} · ${match.totalEstimatedExperienceYears}y ${copy.estimatedYears}`
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

export function renderCitations(
  container: HTMLElement,
  citations: Citation[],
  language: UiLanguage
) {
  const copy = getCopy(language);
  container.replaceChildren();

  if (citations.length === 0) {
    return;
  }

  container.appendChild(createElement('div', 'pill', copy.sources));

  for (const citation of citations) {
    const card = createElement('article', 'citation');
    const title = createElement('strong', undefined, citation.fullName);
    const fileName = createElement('div', 'meta', citation.pdfFileName);
    const excerpt = createElement('div', 'meta', citation.excerpt);

    card.append(title, fileName, excerpt);
    container.appendChild(card);
  }
}
