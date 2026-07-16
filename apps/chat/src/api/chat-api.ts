import type { ChatAnswerResult, IngestionStatus } from '../types';

interface ApiSuccess {
  success: true;
}

interface ApiFailure {
  success: false;
  error?: string;
}

async function ensureSuccess<T extends ApiSuccess>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | ApiFailure;

  if (!response.ok || payload.success !== true) {
    throw new Error(
      (payload as ApiFailure).error || `Request failed with status ${response.status}.`
    );
  }

  return payload;
}

export async function fetchIngestionStatus(): Promise<IngestionStatus> {
  const response = await fetch('/api/ingestion/status');
  const payload = await ensureSuccess<ApiSuccess & IngestionStatus>(response);
  const { success: _success, ...status } = payload;

  return status;
}

export async function rebuildIngestionIndex(forceRebuild = true): Promise<void> {
  const response = await fetch('/api/ingestion/index', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forceRebuild }),
  });

  await ensureSuccess<ApiSuccess & { index: unknown }>(response);
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
  const payload = await ensureSuccess<ApiSuccess & { result?: ChatAnswerResult }>(response);

  if (!payload.result) {
    throw new Error('The server returned no answer payload.');
  }

  return payload.result;
}
