export type UiLanguage = 'en' | 'es';

export interface UiCopy {
  eyebrow: string;
  languageLabel: string;
  sidebarDescription: string;
  sourceLabel: string;
  statusLabel: string;
  cvCountLabel: string;
  localPdfs: string;
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
  working: string;
  error: string;
  thinking: string;
  noQuestionYet: string;
  topMatches: string;
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
    localPdfs: 'Local PDFs',
    noCvs: 'No CVs found',
    readyStatus: 'Ready',
    preparingStatus: 'Preparing',
    refreshingStatus: 'Refreshing',
    unavailableStatus: 'Unavailable',
    statusHint: 'Place PDFs in `storage/resumes/pdfs` and reindex to update the chat dataset.',
    refreshButton: 'Refresh CVs',
    composerPill: 'Ask about the CVs',
    placeholder:
      'Example: Which candidates speak German and have more than 4 years of experience with backend systems?',
    composerHint: 'Press Enter to send. Use Shift+Enter for a new line.',
    askButton: 'Ask',
    resultPill: 'Answer',
    idleTitle: 'Ready',
    working: 'Working',
    error: 'Error',
    thinking: 'Thinking...',
    noQuestionYet: 'No question asked yet.',
    topMatches: 'Best fitting CVs',
    requestFailed: 'The search could not be completed.',
  },
  es: {
    eyebrow: 'Explorar CVs',
    languageLabel: 'Interfaz',
    sidebarDescription:
      'Haz preguntas sobre los CVs disponibles. La aplicación utiliza tus PDFs automáticamente cuando están disponibles.',
    sourceLabel: 'Fuente',
    statusLabel: 'Estado',
    cvCountLabel: 'CVs cargados',
    localPdfs: 'PDFs locales',
    noCvs: 'No hay CVs disponibles',
    readyStatus: 'Listo',
    preparingStatus: 'Preparando índice',
    refreshingStatus: 'Actualizando índice',
    unavailableStatus: 'Sin datos',
    statusHint: 'Coloca PDFs en `storage/resumes/pdfs` y reindexa para actualizar el conjunto del chat.',
    refreshButton: 'Reindexar CVs',
    composerPill: 'Pregunta sobre los CVs',
    placeholder:
      'Ejemplo: ¿Qué candidatos hablan alemán y tienen más de 4 años de experiencia en sistemas backend?',
    composerHint: 'Pulsa Enter para enviar. Usa Shift+Enter para una nueva línea.',
    askButton: 'Consultar',
    resultPill: 'Respuesta',
    idleTitle: 'Listo para buscar',
    working: 'Procesando',
    error: 'Error',
    thinking: 'Pensando...',
    noQuestionYet: 'Todavía no se ha hecho ninguna pregunta.',
    topMatches: 'Perfiles más afines',
    requestFailed: 'No se pudo completar la consulta.',
  },
};

export function getCopy(language: UiLanguage): UiCopy {
  return copyByLanguage[language] ?? copyByLanguage.en;
}
