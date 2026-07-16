export type UiLanguage = 'en' | 'es';

export interface UiCopy {
  eyebrow: string;
  languageLabel: string;
  sidebarDescription: string;
  sourceLabel: string;
  statusLabel: string;
  cvCountLabel: string;
  yourPdfs: string;
  demoPdfs: string;
  noCvs: string;
  readyStatus: string;
  preparingStatus: string;
  refreshingStatus: string;
  unavailableStatus: string;
  statusHint: string;
  refreshButton: string;
  composerPill: string;
  placeholder: string;
  composerHint: string;
  askButton: string;
  resultPill: string;
  idleTitle: string;
  answerReady: string;
  working: string;
  error: string;
  thinking: string;
  noQuestionYet: string;
  topMatches: string;
  sources: string;
  estimatedYears: string;
  requestFailed: string;
}

export const copyByLanguage: Record<UiLanguage, UiCopy> = {
  en: {
    eyebrow: 'Search CVs',
    languageLabel: 'UI',
    sidebarDescription:
      'Ask about the CVs that are currently loaded. The app uses your PDFs automatically when they are available.',
    sourceLabel: 'CV source',
    statusLabel: 'Status',
    cvCountLabel: 'CVs loaded',
    yourPdfs: 'Your PDFs',
    demoPdfs: 'Demo PDFs',
    noCvs: 'No CVs found',
    readyStatus: 'Ready',
    preparingStatus: 'Preparing',
    refreshingStatus: 'Refreshing',
    unavailableStatus: 'Unavailable',
    statusHint: 'Place PDFs in `storage/imported-resumes/pdfs` to use your own CVs.',
    refreshButton: 'Refresh CVs',
    composerPill: 'Ask the dataset',
    placeholder:
      'Example: Which candidates speak German and have more than 4 years of experience with backend systems?',
    composerHint: 'Press Enter to send. Use Shift+Enter for a new line.',
    askButton: 'Ask',
    resultPill: 'Answer',
    idleTitle: 'Ready',
    answerReady: 'Answer Ready',
    working: 'Working',
    error: 'Error',
    thinking: 'Thinking...',
    noQuestionYet: 'No question asked yet.',
    topMatches: 'Best fitting CVs',
    sources: 'Relevant snippets',
    estimatedYears: 'estimated',
    requestFailed: 'The search could not be completed.',
  },
  es: {
    eyebrow: 'Buscar CVs',
    languageLabel: 'Interfaz',
    sidebarDescription:
      'Haz preguntas sobre los CVs cargados en este momento. La aplicacion usa tus PDFs automaticamente cuando estan disponibles.',
    sourceLabel: 'Origen',
    statusLabel: 'Estado',
    cvCountLabel: 'CVs cargados',
    yourPdfs: 'Tus PDFs',
    demoPdfs: 'PDFs de demo',
    noCvs: 'No se han encontrado CVs',
    readyStatus: 'Lista',
    preparingStatus: 'Preparando',
    refreshingStatus: 'Actualizando',
    unavailableStatus: 'No disponible',
    statusHint: 'Coloca PDFs en `storage/imported-resumes/pdfs` para usar tus propios CVs.',
    refreshButton: 'Actualizar CVs',
    composerPill: 'Pregunta al dataset',
    placeholder:
      'Ejemplo: Que candidatos hablan aleman y tienen mas de 4 anos de experiencia en sistemas backend?',
    composerHint: 'Pulsa Enter para enviar. Usa Shift+Enter para una nueva linea.',
    askButton: 'Preguntar',
    resultPill: 'Respuesta',
    idleTitle: 'Lista',
    answerReady: 'Respuesta Lista',
    working: 'Procesando',
    error: 'Error',
    thinking: 'Pensando...',
    noQuestionYet: 'Todavia no se ha hecho ninguna pregunta.',
    topMatches: 'CVs que mejor encajan',
    sources: 'Fragmentos relevantes',
    estimatedYears: 'estimados',
    requestFailed: 'No se pudo completar la busqueda.',
  },
};

export function getCopy(language: UiLanguage): UiCopy {
  return copyByLanguage[language] ?? copyByLanguage.en;
}
