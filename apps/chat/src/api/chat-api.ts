import type { ChatAnswerResult, IngestionStatus } from '../types';

interface ApiSuccess<T> {
  success: true;
  result?: T;
  index?: unknown;
}

interface ApiFailure {
  success: false;
  error?: string;
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function ensureSuccess<T>(response: Response): Promise<ApiSuccess<T>> {
  const payload = await readJson<ApiSuccess<T> | ApiFailure>(response);

  if (!response.ok || payload.success !== true) {
    throw new Error(
      (payload as ApiFailure).error || `Request failed with status ${response.status}.`
    );
  }

  return payload;
}

export async function fetchIngestionStatus(): Promise<IngestionStatus> {
  const response = await fetch('/api/ingestion/status');
  const payload = await ensureSuccess<IngestionStatus>(response);

  return payload as unknown as IngestionStatus;
}

export async function rebuildIngestionIndex(forceRebuild = true): Promise<void> {
  const response = await fetch('/api/ingestion/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forceRebuild }),
  });

  await ensureSuccess(response);
}

export async function askChatQuestion(
  question: string,
  forceRebuild = false
): Promise<ChatAnswerResult> {
  const response = await fetch('/api/chat/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, forceRebuild }),
  });
  const payload = await ensureSuccess<ChatAnswerResult>(response);

  if (!payload.result) {
    throw new Error('The server returned no answer payload.');
  }

  return payload.result;
}
