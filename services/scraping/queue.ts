/**
 * Async Processing Queue
 *
 * Concurrency-controlled URL processing with retry logic.
 *
 * Phase 1 (now):  in-memory async queue (no Redis needed)
 * Phase 2 (later): BullMQ + Redis for production scale
 *
 * Features:
 *   - Configurable concurrency
 *   - Retry with exponential backoff
 *   - Progress tracking
 *   - Timeout per job
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface QueueJob<T> {
  id: string
  data: T
  retries: number
  maxRetries: number
  status: 'pending' | 'active' | 'completed' | 'failed'
  result?: unknown
  error?: string
}

export interface QueueOptions {
  concurrency: number
  maxRetries: number
  retryDelayMs: number
  timeoutMs: number
}

export interface QueueStats {
  total: number
  pending: number
  active: number
  completed: number
  failed: number
}

// ─── Default config ──────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: QueueOptions = {
  concurrency: 5,
  maxRetries: 2,
  retryDelayMs: 1000,
  timeoutMs: 30_000,
}

// ─── Queue implementation ────────────────────────────────────────────────────

export class AsyncQueue<T, R> {
  private jobs: QueueJob<T>[] = []
  private results: Map<string, R> = new Map()
  private options: QueueOptions
  private processor: (data: T) => Promise<R>
  private activeCount = 0

  constructor(
    processor: (data: T) => Promise<R>,
    options: Partial<QueueOptions> = {}
  ) {
    this.processor = processor
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /** Add a job to the queue */
  add(id: string, data: T): void {
    this.jobs.push({
      id,
      data,
      retries: 0,
      maxRetries: this.options.maxRetries,
      status: 'pending',
    })
  }

  /** Add multiple jobs */
  addBatch(items: { id: string; data: T }[]): void {
    for (const item of items) {
      this.add(item.id, item.data)
    }
  }

  /** Process all jobs and return results */
  async processAll(): Promise<Map<string, R>> {
    const pending = [...this.jobs]
    const processing: Promise<void>[] = []

    return new Promise((resolve) => {
      const tryNext = () => {
        while (this.activeCount < this.options.concurrency && pending.length > 0) {
          const job = pending.shift()!
          this.activeCount++
          job.status = 'active'

          const promise = this.processJob(job)
            .then(() => {
              this.activeCount--
              if (pending.length === 0 && this.activeCount === 0) {
                resolve(this.results)
              } else {
                tryNext()
              }
            })

          processing.push(promise)
        }

        // Handle case where queue is empty from the start
        if (pending.length === 0 && this.activeCount === 0) {
          resolve(this.results)
        }
      }

      tryNext()
    })
  }

  /** Process a single job with retry */
  private async processJob(job: QueueJob<T>): Promise<void> {
    try {
      const result = await this.withTimeout(
        this.processor(job.data),
        this.options.timeoutMs
      )
      job.status = 'completed'
      job.result = result
      this.results.set(job.id, result)
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      job.retries++

      if (job.retries <= job.maxRetries) {
        // Exponential backoff
        const delay = this.options.retryDelayMs * Math.pow(2, job.retries - 1)
        await sleep(delay)

        // Retry
        return this.processJob(job)
      }

      // Max retries exhausted
      job.status = 'failed'
      job.error = msg
    }
  }

  /** Wrap a promise with a timeout */
  private withTimeout<V>(promise: Promise<V>, ms: number): Promise<V> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), ms)
      promise
        .then(v => { clearTimeout(timer); resolve(v) })
        .catch(e => { clearTimeout(timer); reject(e) })
    })
  }

  /** Get queue statistics */
  getStats(): QueueStats {
    return {
      total: this.jobs.length,
      pending: this.jobs.filter(j => j.status === 'pending').length,
      active: this.jobs.filter(j => j.status === 'active').length,
      completed: this.jobs.filter(j => j.status === 'completed').length,
      failed: this.jobs.filter(j => j.status === 'failed').length,
    }
  }
}

// ─── Convenience function ────────────────────────────────────────────────────

/**
 * Process an array of items with concurrency control.
 * Simpler API than the full AsyncQueue class.
 */
export async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 5
): Promise<{ results: R[]; errors: string[] }> {
  const results: R[] = []
  const errors: string[] = []

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map(processor))

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value)
      } else {
        errors.push(r.reason?.message || String(r.reason))
      }
    }
  }

  return { results, errors }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
