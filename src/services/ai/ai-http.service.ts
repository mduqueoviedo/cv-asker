const DEFAULT_RETRYABLE_STATUS_CODES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export interface AiApiRequestOptions {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  maxRetries: number;
  baseDelayMs: number;
  retryableStatusCodes?: Set<number>;
}

export class AiApiRequestError extends Error {
  public readonly status: number | null;
  public readonly attemptCount: number;

  constructor(message: string, options: { status?: number | null; attemptCount: number }) {
    super(message);
    this.name = 'AiApiRequestError';
    this.status = options.status ?? null;
    this.attemptCount = options.attemptCount;
  }
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function createAttemptDelay(baseDelayMs: number, attemptNumber: number): number {
  const exponentialDelay = baseDelayMs * 2 ** (attemptNumber - 1);
  const jitter = Math.floor(Math.random() * Math.max(1, Math.round(baseDelayMs * 0.35)));
  return exponentialDelay + jitter;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === 'AbortError') {
    return true;
  }

  return true;
}

async function runFetchAttempt(options: AiApiRequestOptions): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await fetch(options.url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchAiJsonWithRetry<T>(options: AiApiRequestOptions): Promise<T> {
  const retryableStatusCodes = options.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES;
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxRetries + 1; attempt += 1) {
    try {
      const response = await runFetchAttempt(options);

      if (response.ok) {
        return (await response.json()) as T;
      }

      const errorText = await response.text();
      const errorMessage = `AI API response status: ${response.status} - ${errorText}`;

      if (!retryableStatusCodes.has(response.status) || attempt > options.maxRetries) {
        throw new AiApiRequestError(errorMessage, {
          status: response.status,
          attemptCount: attempt,
        });
      }

      lastError = new AiApiRequestError(errorMessage, {
        status: response.status,
        attemptCount: attempt,
      });
    } catch (error) {
      if (error instanceof AiApiRequestError && attempt > options.maxRetries) {
        throw error;
      }

      if (!isRetryableNetworkError(error) || attempt > options.maxRetries) {
        if (error instanceof Error) {
          throw new AiApiRequestError(error.message, {
            attemptCount: attempt,
          });
        }

        throw new AiApiRequestError('Unknown AI API request failure.', {
          attemptCount: attempt,
        });
      }

      lastError = error;
    }

    const delayMs = createAttemptDelay(options.baseDelayMs, attempt);
    console.warn(
      `[AI API]: Attempt ${attempt} failed. Retrying in ${delayMs}ms.`
    );
    await sleep(delayMs);
  }

  if (lastError instanceof AiApiRequestError) {
    throw lastError;
  }

  if (lastError instanceof Error) {
    throw new AiApiRequestError(lastError.message, {
      attemptCount: options.maxRetries + 1,
    });
  }

  throw new AiApiRequestError('AI API request failed after exhausting retries.', {
    attemptCount: options.maxRetries + 1,
  });
}
