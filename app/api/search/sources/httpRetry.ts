export interface RetryFetchResult {
  response: Response
  attempts: number
  throttled: boolean
}

export interface RetryFetchOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  retryOn5xx?: boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null

  const seconds = Number(value)
  if (!Number.isNaN(seconds) && Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000)
  }

  const asDate = Date.parse(value)
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now())
  }

  return null
}

function nextBackoffDelay(baseDelayMs: number, attempt: number, maxDelayMs: number): number {
  const exp = Math.min(maxDelayMs, baseDelayMs * (2 ** Math.max(0, attempt - 1)))
  const jitter = Math.floor(Math.random() * Math.max(100, Math.floor(exp * 0.2)))
  return Math.min(maxDelayMs, exp + jitter)
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: RetryFetchOptions = {}
): Promise<RetryFetchResult> {
  const {
    maxAttempts = 3,
    baseDelayMs = 800,
    maxDelayMs = 10_000,
    retryOn5xx = true,
  } = options

  let lastError: unknown
  let throttled = false

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(input, init)

      const is429 = response.status === 429
      const is5xx = response.status >= 500 && response.status <= 599
      const shouldRetry = is429 || (retryOn5xx && is5xx)

      if (!shouldRetry || attempt >= maxAttempts) {
        return { response, attempts: attempt, throttled }
      }

      if (is429) {
        throttled = true
      }

      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'))
      const waitMs = retryAfterMs ?? nextBackoffDelay(baseDelayMs, attempt, maxDelayMs)
      await sleep(waitMs)
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts) break
      const waitMs = nextBackoffDelay(baseDelayMs, attempt, maxDelayMs)
      await sleep(waitMs)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('fetchWithRetry failed after retries')
}
