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

class AiApiRequestError extends Error {
  public readonly status: number | null;
  public readonly attemptCount: number;
  public readonly retryAfterMs: number | null;

  constructor(
    message: string,
    options: { status?: number | null; attemptCount: number; retryAfterMs?: number | null }
  ) {
    super(message);
    this.name = 'AiApiRequestError';
    this.status = options.status ?? null;
    this.attemptCount = options.attemptCount;
    this.retryAfterMs = options.retryAfterMs ?? null;
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

function parseRateLimitResetHeader(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  if (parsed > 1_000_000_000_000) {
    return Math.max(0, parsed - Date.now());
  }

  if (parsed > 10_000_000_000) {
    return Math.max(0, parsed * 1000 - Date.now());
  }

  return parsed * 1000;
}

function resolveRetryDelayMs(
  response: Response | null,
  baseDelayMs: number,
  attempt: number,
  error?: AiApiRequestError
): number {
  const retryAfterHeader = response?.headers.get('retry-after');
  const rateLimitResetHeader = response?.headers.get('x-ratelimit-reset');

  if (retryAfterHeader) {
    const retryAfterSeconds = Number(retryAfterHeader);

    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.ceil(retryAfterSeconds * 1000);
    }
  }

  const resetDelayMs = parseRateLimitResetHeader(rateLimitResetHeader ?? null);

  if (typeof resetDelayMs === 'number' && resetDelayMs > 0) {
    return resetDelayMs + 250;
  }

  if (typeof error?.retryAfterMs === 'number' && error.retryAfterMs > 0) {
    return error.retryAfterMs;
  }

  return createAttemptDelay(baseDelayMs, attempt);
}

export async function fetchAiJsonWithRetry<T>(options: AiApiRequestOptions): Promise<T> {
  const retryableStatusCodes = options.retryableStatusCodes ?? DEFAULT_RETRYABLE_STATUS_CODES;
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxRetries + 1; attempt += 1) {
    const attemptStartedAt = Date.now();

    console.log(
      `[AI API] Attempt ${attempt}/${options.maxRetries + 1} started (${options.method ?? 'GET'} ${options.url}, timeoutMs=${options.timeoutMs})`
    );

    try {
      const response = await runFetchAttempt(options);

      if (response.ok) {
        const payload = (await response.json()) as T;
        console.log(
          `[AI API] Attempt ${attempt}/${options.maxRetries + 1} succeeded (status=${response.status}, elapsedMs=${Date.now() - attemptStartedAt})`
        );
        return payload;
      }

      const errorText = await response.text();
      const errorMessage = `AI API response status: ${response.status} - ${errorText}`;
      const retryAfterMs = resolveRetryDelayMs(response, options.baseDelayMs, attempt);

      if (!retryableStatusCodes.has(response.status) || attempt > options.maxRetries) {
        throw new AiApiRequestError(errorMessage, {
          status: response.status,
          attemptCount: attempt,
          retryAfterMs,
        });
      }

      lastError = new AiApiRequestError(errorMessage, {
        status: response.status,
        attemptCount: attempt,
        retryAfterMs,
      });
    } catch (error) {
      if (error instanceof AiApiRequestError && attempt > options.maxRetries) {
        throw error;
      }

      if (!isRetryableNetworkError(error) || attempt > options.maxRetries) {
        if (error instanceof Error) {
          throw new AiApiRequestError(error.message, {
            attemptCount: attempt,
            retryAfterMs:
              error instanceof AiApiRequestError ? error.retryAfterMs : null,
          });
        }

        throw new AiApiRequestError('Unknown AI API request failure.', {
          attemptCount: attempt,
        });
      }

      lastError = error;
    }

    const delayMs =
      lastError instanceof AiApiRequestError
        ? resolveRetryDelayMs(null, options.baseDelayMs, attempt, lastError)
        : createAttemptDelay(options.baseDelayMs, attempt);
    console.warn(
      `[AI API] Attempt ${attempt}/${options.maxRetries + 1} failed after ${Date.now() - attemptStartedAt}ms. Retrying in ${delayMs}ms.`
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
