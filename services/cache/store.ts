/**
 * File-Based Cache
 *
 * Caches pipeline results to avoid re-scraping / re-processing.
 *
 * Phase 1 (now):  file-based JSON cache in .cache/ directory
 * Phase 2 (later): Redis or PostgreSQL for production
 *
 * Features:
 *   - TTL-based expiry (default 24h)
 *   - Company-keyed storage
 *   - Separate caches for discovery, scraping, signals, reports
 */

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  key: string
  data: T
  createdAt: string    // ISO timestamp
  expiresAt: string    // ISO timestamp
  version: number      // schema version for invalidation
}

export type CacheNamespace =
  | 'discovery'    // SerpAPI / Google search results
  | 'scrape'       // scraped page content
  | 'signals'      // extracted signals
  | 'patterns'     // detected patterns
  | 'report'       // final generated report
  | 'pipeline'     // full pipeline result

// ─── Config ──────────────────────────────────────────────────────────────────

const CACHE_DIR = path.join(process.cwd(), '.cache')
const CACHE_VERSION = 1

/** Default TTL per namespace (in hours) */
const DEFAULT_TTL: Record<CacheNamespace, number> = {
  discovery: 24,     // search results change slowly
  scrape: 72,        // page content is semi-stable
  signals: 24,       // signals depend on fresh scrapes
  patterns: 24,      // patterns depend on fresh signals
  report: 12,        // reports should be relatively fresh
  pipeline: 6,       // full pipeline results expire quickly
}

// ─── Ensure cache directory exists ───────────────────────────────────────────

function ensureCacheDir(namespace: CacheNamespace): string {
  const dir = path.join(CACHE_DIR, namespace)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// ─── Key hashing ─────────────────────────────────────────────────────────────

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex').substring(0, 16)
}

function getCachePath(namespace: CacheNamespace, key: string): string {
  const dir = ensureCacheDir(namespace)
  return path.join(dir, `${hashKey(key)}.json`)
}

// ─── Core operations ─────────────────────────────────────────────────────────

/**
 * Get a cached value. Returns null if not found or expired.
 */
export function getCache<T>(namespace: CacheNamespace, key: string): T | null {
  const filePath = getCachePath(namespace, key)

  try {
    if (!fs.existsSync(filePath)) return null

    const raw = fs.readFileSync(filePath, 'utf-8')
    const entry: CacheEntry<T> = JSON.parse(raw)

    // Check version
    if (entry.version !== CACHE_VERSION) {
      fs.unlinkSync(filePath)
      return null
    }

    // Check expiry
    if (new Date(entry.expiresAt) < new Date()) {
      fs.unlinkSync(filePath)
      return null
    }

    return entry.data
  } catch {
    // Corrupted cache file — delete it
    try { fs.unlinkSync(filePath) } catch { /* ignore */ }
    return null
  }
}

/**
 * Set a cached value with TTL.
 */
export function setCache<T>(
  namespace: CacheNamespace,
  key: string,
  data: T,
  ttlHours?: number
): void {
  const filePath = getCachePath(namespace, key)
  const ttl = ttlHours ?? DEFAULT_TTL[namespace]

  const now = new Date()
  const expires = new Date(now.getTime() + ttl * 60 * 60 * 1000)

  const entry: CacheEntry<T> = {
    key,
    data,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    version: CACHE_VERSION,
  }

  try {
    ensureCacheDir(namespace)
    fs.writeFileSync(filePath, JSON.stringify(entry), 'utf-8')
  } catch (error) {
    console.warn(`[Cache] Failed to write ${namespace}/${key}:`, error)
  }
}

/**
 * Check if a key exists and is not expired.
 */
export function hasCache(namespace: CacheNamespace, key: string): boolean {
  return getCache(namespace, key) !== null
}

/**
 * Delete a specific cache entry.
 */
export function deleteCache(namespace: CacheNamespace, key: string): void {
  const filePath = getCachePath(namespace, key)
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch { /* ignore */ }
}

/**
 * Clear all entries in a namespace.
 */
export function clearNamespace(namespace: CacheNamespace): number {
  const dir = path.join(CACHE_DIR, namespace)
  let count = 0

  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(dir, file))
          count++
        }
      }
    }
  } catch { /* ignore */ }

  return count
}

/**
 * Clear ALL cache.
 */
export function clearAllCache(): number {
  let total = 0
  const namespaces: CacheNamespace[] = ['discovery', 'scrape', 'signals', 'patterns', 'report', 'pipeline']
  for (const ns of namespaces) {
    total += clearNamespace(ns)
  }
  return total
}

/**
 * Get cache stats.
 */
export function getCacheStats(): {
  namespaces: Record<CacheNamespace, { count: number; sizeBytes: number }>
  totalEntries: number
  totalSizeBytes: number
} {
  const namespaces: CacheNamespace[] = ['discovery', 'scrape', 'signals', 'patterns', 'report', 'pipeline']
  const stats: Record<string, { count: number; sizeBytes: number }> = {}
  let totalEntries = 0
  let totalSizeBytes = 0

  for (const ns of namespaces) {
    const dir = path.join(CACHE_DIR, ns)
    let count = 0
    let size = 0

    try {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          if (file.endsWith('.json')) {
            count++
            const stat = fs.statSync(path.join(dir, file))
            size += stat.size
          }
        }
      }
    } catch { /* ignore */ }

    stats[ns] = { count, sizeBytes: size }
    totalEntries += count
    totalSizeBytes += size
  }

  return {
    namespaces: stats as Record<CacheNamespace, { count: number; sizeBytes: number }>,
    totalEntries,
    totalSizeBytes,
  }
}
