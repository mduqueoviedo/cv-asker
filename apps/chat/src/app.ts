import { askChatQuestion, fetchIngestionStatus, rebuildIngestionIndex } from './api/chat-api';
import { renderMatches } from './components/renderers';
import { getCopy, type UiLanguage } from './i18n/copy';
import type { ChatAnswerResult, IngestionStatus } from './types';

interface ChatDom {
  uiLanguageSelect: HTMLSelectElement;
  eyebrowLabel: HTMLElement;
  languageLabel: HTMLElement;
  sidebarDescription: HTMLElement;
  sourceLabel: HTMLElement;
  statusLabel: HTMLElement;
  cvCountLabel: HTMLElement;
  statusHint: HTMLElement;
  composerPill: HTMLElement;
  questionInput: HTMLTextAreaElement;
  composerHint: HTMLElement;
  askButton: HTMLButtonElement;
  reindexButton: HTMLButtonElement;
  resultPill: HTMLElement;
  resultTitle: HTMLElement;
  answerOutput: HTMLElement;
  matchesNode: HTMLElement;
  sourceState: HTMLElement;
  readinessState: HTMLElement;
  candidateCount: HTMLElement;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing DOM node with id "${id}".`);
  }

  return element as T;
}

function getInitialLanguage(): UiLanguage {
  const storedLanguage = localStorage.getItem('cv-asker-ui-language');

  if (storedLanguage === 'es' || storedLanguage === 'en') {
    return storedLanguage;
  }

  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

function describeSource(status: IngestionStatus, language: UiLanguage): string {
  const copy = getCopy(language);

  if (!status.hasDataset) {
    return copy.noCvs;
  }

  return copy.localPdfs;
}

function describeReadiness(
  status: IngestionStatus,
  language: UiLanguage,
  isRefreshing = false
): string {
  const copy = getCopy(language);

  if (isRefreshing) {
    return copy.refreshingStatus;
  }

  if (!status.hasDataset) {
    return copy.unavailableStatus;
  }

  return status.indexBuilt ? copy.readyStatus : copy.preparingStatus;
}

export function createChatApp() {
  const dom: ChatDom = {
    uiLanguageSelect: getElement('uiLanguage'),
    eyebrowLabel: getElement('eyebrowLabel'),
    languageLabel: getElement('languageLabel'),
    sidebarDescription: getElement('sidebarDescription'),
    sourceLabel: getElement('sourceLabel'),
    statusLabel: getElement('statusLabel'),
    cvCountLabel: getElement('cvCountLabel'),
    statusHint: getElement('statusHint'),
    composerPill: getElement('composerPill'),
    questionInput: getElement('questionInput'),
    composerHint: getElement('composerHint'),
    askButton: getElement('askButton'),
    reindexButton: getElement('reindexButton'),
    resultPill: getElement('resultPill'),
    resultTitle: getElement('resultTitle'),
    answerOutput: getElement('answerOutput'),
    matchesNode: getElement('matches'),
    sourceState: getElement('sourceState'),
    readinessState: getElement('readinessState'),
    candidateCount: getElement('candidateCount'),
  };

  let currentLanguage = getInitialLanguage();
  let lastResult: ChatAnswerResult | null = null;

  function applyLanguage(language: UiLanguage) {
    currentLanguage = language;
    localStorage.setItem('cv-asker-ui-language', currentLanguage);
    document.documentElement.lang = currentLanguage;

    const copy = getCopy(currentLanguage);
    dom.eyebrowLabel.textContent = copy.eyebrow;
    dom.languageLabel.textContent = copy.languageLabel;
    dom.sidebarDescription.textContent = copy.sidebarDescription;
    dom.sourceLabel.textContent = copy.sourceLabel;
    dom.statusLabel.textContent = copy.statusLabel;
    dom.cvCountLabel.textContent = copy.cvCountLabel;
    dom.statusHint.textContent = copy.statusHint;
    dom.composerPill.textContent = copy.composerPill;
    dom.questionInput.placeholder = copy.placeholder;
    dom.composerHint.textContent = copy.composerHint;
    dom.askButton.textContent = copy.askButton;
    dom.reindexButton.textContent = copy.refreshButton;
    dom.resultPill.textContent = copy.resultPill;
    dom.uiLanguageSelect.value = currentLanguage;

    if (dom.answerOutput.classList.contains('empty')) {
      dom.answerOutput.textContent = copy.noQuestionYet;
    }

    if (lastResult) {
      dom.resultTitle.textContent = copy.answerReady;
      renderMatches(dom.matchesNode, lastResult.matches ?? [], currentLanguage);
    } else {
      dom.resultTitle.textContent = copy.idleTitle;
    }
  }

  async function loadStatus() {
    const status = await fetchIngestionStatus();
    const copy = getCopy(currentLanguage);

    dom.sourceState.textContent = describeSource(status, currentLanguage);
    dom.readinessState.textContent = describeReadiness(status, currentLanguage);
    dom.candidateCount.textContent = String(status.candidateCount ?? 0);

    if (!status.hasDataset) {
      dom.resultTitle.textContent = copy.idleTitle;
    }
  }

  async function askQuestion(forceRebuild = false) {
    const question = dom.questionInput.value.trim();

    if (!question || dom.askButton.disabled) {
      return;
    }

    const copy = getCopy(currentLanguage);
    dom.askButton.disabled = true;
    dom.answerOutput.textContent = copy.thinking;
    dom.answerOutput.classList.remove('empty');
    dom.resultTitle.textContent = copy.working;

    try {
      lastResult = await askChatQuestion(question, forceRebuild);
      dom.resultTitle.textContent = copy.answerReady;
      dom.answerOutput.textContent = lastResult.answer;
      renderMatches(dom.matchesNode, lastResult.matches ?? [], currentLanguage);
      await loadStatus();
    } catch (error) {
      dom.resultTitle.textContent = copy.error;
      dom.answerOutput.textContent = error instanceof Error ? error.message : copy.requestFailed;
    } finally {
      dom.askButton.disabled = false;
    }
  }

  async function refreshDataset() {
    dom.reindexButton.disabled = true;
    dom.readinessState.textContent = describeReadiness(
      { hasDataset: true },
      currentLanguage,
      true
    );

    try {
      await rebuildIngestionIndex(true);
      await loadStatus();
    } finally {
      dom.reindexButton.disabled = false;
    }
  }

  async function mount() {
    applyLanguage(currentLanguage);

    dom.askButton.addEventListener('click', () => {
      void askQuestion(false);
    });
    dom.reindexButton.addEventListener('click', () => {
      void refreshDataset();
    });
    dom.uiLanguageSelect.addEventListener('change', () => {
      applyLanguage(dom.uiLanguageSelect.value === 'es' ? 'es' : 'en');
      void loadStatus().catch(() => {
        const copy = getCopy(currentLanguage);
        dom.sourceState.textContent = copy.unavailableStatus;
        dom.readinessState.textContent = copy.unavailableStatus;
      });
    });
    dom.questionInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void askQuestion(false);
      }
    });

    try {
      await loadStatus();
    } catch {
      const copy = getCopy(currentLanguage);
      dom.sourceState.textContent = copy.unavailableStatus;
      dom.readinessState.textContent = copy.unavailableStatus;
    }
  }

  return { mount };
}
