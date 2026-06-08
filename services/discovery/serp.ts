/**
 * Serper Discovery Layer
 *
 * Serper is only used to discover candidate URLs from Google-style SERP data.
 * It is not a scraper. Scraping and content extraction happens later.
 *
 * Strategy:
 * 1. Run tight search/news queries with num=10, gl=us, hl=en
 * 2. Cache every query result to control cost
 * 3. Deduplicate by URL/domain/article fingerprint before scraping
 * 4. Score source value and deprioritize low-value SEO pages
 */

import { LayerQuery } from './queries'
import { getCache, setCache } from '../cache/store'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DiscoveredUrl {
  url: string
  title: string
  snippet: string
  query: string
  layerHint: string
  position: number
  source: 'serper-search' | 'serper-news'
  sourceDomain: string
  sourceValue: 'high' | 'medium' | 'low'
  sourceScore: number
  dateFound: string
  lastChecked: string
}

// ─── Config ──────────────────────────────────────────────────────────────────

const RESULTS_PER_QUERY = 10
const SERPER_ENDPOINT_SEARCH = 'https://google.serper.dev/search'
const SERPER_ENDPOINT_NEWS = 'https://google.serper.dev/news'
const SERPER_CONCURRENCY = 4
const TIMEOUT_MS = 15_000
const DEFAULT_GL = 'us'
const DEFAULT_HL = 'en'
const MAX_RESULTS_BEFORE_DEDUP = 100
const MAX_RESULTS_AFTER_DEDUP = 100

interface SerperOrganicResult {
  title?: string
  link?: string
  snippet?: string
  position?: number
  date?: string
}

interface SerperNewsResult {
  title?: string
  link?: string
  snippet?: string
  date?: string
  source?: string
}

interface SerperResponse {
  organic?: SerperOrganicResult[]
  news?: SerperNewsResult[]
}

interface CachedDiscoveryResult {
  company_name: string
  query_used: string
  url: string
  title: string
  snippet: string
  source_domain: string
  date_found: string
  last_checked: string
  position: number
  layer_hint: string
  source: 'serper-search' | 'serper-news'
}

export interface DiscoveryOptions {
  gl?: string
  hl?: string
  maxQueries?: number
}

export interface DiscoveryTelemetry {
  plannedQueryCount: number
  executedQueryCount: number
  cacheHits: number
  apiCallsMade: number
  rawResults: number
  dedupedResults: number
  filteredResults: number
}

// ─── Main discovery function ─────────────────────────────────────────────────

export async function discoverUrls(
  companyName: string,
  queries: LayerQuery[],
  options: DiscoveryOptions = {}
): Promise<{ urls: DiscoveredUrl[]; telemetry: DiscoveryTelemetry }> {
  const serperApiKey = process.env.SERPER_API_KEY
  if (!serperApiKey) {
    console.warn('[Discovery] SERPER_API_KEY is missing; discovery skipped')
    return {
      urls: [],
      telemetry: {
        plannedQueryCount: 0,
        executedQueryCount: 0,
        cacheHits: 0,
        apiCallsMade: 0,
        rawResults: 0,
        dedupedResults: 0,
        filteredResults: 0,
      },
    }
  }

  const gl = normalizeGl(options.gl)
  const hl = normalizeHl(options.hl)
  const maxQueries = normalizeMaxQueries(options.maxQueries)

  const queryRuns = queries.slice(0, maxQueries).map(q => ({
    query: q,
    endpoint: q.layer === 'L6' ? SERPER_ENDPOINT_NEWS : SERPER_ENDPOINT_SEARCH,
  }))

  const allResults: DiscoveredUrl[] = []
  const telemetry: DiscoveryTelemetry = {
    plannedQueryCount: queryRuns.length,
    executedQueryCount: queryRuns.length,
    cacheHits: 0,
    apiCallsMade: 0,
    rawResults: 0,
    dedupedResults: 0,
    filteredResults: 0,
  }
  console.log(`[Discovery] Running ${queryRuns.length} Serper calls for ${companyName} (gl=${gl}, hl=${hl})`)

  for (let i = 0; i < queryRuns.length; i += SERPER_CONCURRENCY) {
    const batch = queryRuns.slice(i, i + SERPER_CONCURRENCY)
    const results = await Promise.allSettled(
      batch.map(({ query, endpoint }) => searchSerper(companyName, query, serperApiKey, endpoint, { gl, hl }))
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value.urls)
        telemetry.cacheHits += result.value.cacheHit ? 1 : 0
        telemetry.apiCallsMade += result.value.cacheHit ? 0 : 1
      }
    }
  }

  const boundedRawResults = allResults.slice(0, MAX_RESULTS_BEFORE_DEDUP)
  const deduped = dedupeDiscoveredUrls(boundedRawResults).slice(0, MAX_RESULTS_AFTER_DEDUP)
  const filtered = deduped.filter(item => item.sourceValue !== 'low')
  telemetry.rawResults = allResults.length
  telemetry.dedupedResults = deduped.length
  telemetry.filteredResults = filtered.length

  console.log(
    `[Discovery] Raw=${allResults.length}, dedup=${deduped.length}, filtered=${filtered.length} (company=${companyName})`
  )

  return { urls: filtered, telemetry }
}

// ─── Serper search ───────────────────────────────────────────────────────────

async function searchSerper(
  companyName: string,
  query: LayerQuery,
  apiKey: string,
  endpoint: string,
  locale: { gl: string; hl: string }
): Promise<{ urls: DiscoveredUrl[]; cacheHit: boolean }> {
  const cacheKey = buildQueryCacheKey(companyName, query, endpoint, locale)
  const cached = getCache<CachedDiscoveryResult[]>('discovery', cacheKey)
  if (cached && cached.length > 0) {
    return { urls: cached.map(item => toDiscoveredUrl(item)), cacheHit: true }
  }

  try {
    const body = {
      q: query.query,
      num: RESULTS_PER_QUERY,
      gl: locale.gl,
      hl: locale.hl,
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (!response.ok) {
      console.warn(`[Serper] ${response.status} for "${query.query}"`)
      return { urls: [], cacheHit: false }
    }

    const data = (await response.json()) as SerperResponse
    const now = new Date().toISOString()

    const normalized = normalizeSerperResults(data, query, endpoint, now)
    const cachePayload = normalized.map(item => ({
      company_name: companyName,
      query_used: item.query,
      url: item.url,
      title: item.title,
      snippet: item.snippet,
      source_domain: item.sourceDomain,
      date_found: item.dateFound,
      last_checked: item.lastChecked,
      position: item.position,
      layer_hint: item.layerHint,
      source: item.source,
    }))

    setCache('discovery', cacheKey, cachePayload)
    return { urls: normalized, cacheHit: false }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    if (!msg.includes('abort')) {
      console.warn(`[Serper] Error for "${query.query}": ${msg}`)
    }
    return { urls: [], cacheHit: false }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeSerperResults(
  data: SerperResponse,
  query: LayerQuery,
  endpoint: string,
  nowIso: string
): DiscoveredUrl[] {
  const source: DiscoveredUrl['source'] = endpoint === SERPER_ENDPOINT_NEWS ? 'serper-news' : 'serper-search'
  const output: DiscoveredUrl[] = []

  if (source === 'serper-news') {
    for (const [idx, item] of (data.news || []).entries()) {
      if (!item.link || !isUsefulUrl(item.link)) continue
      const sourceDomain = extractDomain(item.link)
      const sourceValue = classifySourceValue(item.link, item.title || '', item.snippet || '')
      output.push({
        url: item.link,
        title: item.title || '',
        snippet: item.snippet || '',
        query: query.query,
        layerHint: query.layer,
        position: idx + 1,
        source,
        sourceDomain,
        sourceValue: sourceValue.value,
        sourceScore: sourceValue.score,
        dateFound: item.date || nowIso,
        lastChecked: nowIso,
      })
    }
    return output
  }

  for (const [idx, item] of (data.organic || []).entries()) {
    if (!item.link || !isUsefulUrl(item.link)) continue
    const sourceDomain = extractDomain(item.link)
    const sourceValue = classifySourceValue(item.link, item.title || '', item.snippet || '')
    output.push({
      url: item.link,
      title: item.title || '',
      snippet: item.snippet || '',
      query: query.query,
      layerHint: query.layer,
      position: item.position ?? idx + 1,
      source,
      sourceDomain,
      sourceValue: sourceValue.value,
      sourceScore: sourceValue.score,
      dateFound: item.date || nowIso,
      lastChecked: nowIso,
    })
  }

  return output
}

function toDiscoveredUrl(item: CachedDiscoveryResult): DiscoveredUrl {
  const sourceValue = classifySourceValue(item.url, item.title, item.snippet)
  return {
    url: item.url,
    title: item.title,
    snippet: item.snippet,
    query: item.query_used,
    layerHint: item.layer_hint,
    position: item.position,
    source: item.source,
    sourceDomain: item.source_domain,
    sourceValue: sourceValue.value,
    sourceScore: sourceValue.score,
    dateFound: item.date_found,
    lastChecked: new Date().toISOString(),
  }
}

function buildQueryCacheKey(
  companyName: string,
  query: LayerQuery,
  endpoint: string,
  locale: { gl: string; hl: string }
): string {
  return [
    companyName.toLowerCase(),
    query.query.toLowerCase(),
    query.layer,
    locale.gl,
    locale.hl,
    endpoint.endsWith('/news') ? 'news' : 'search',
  ].join('|')
}

function normalizeGl(gl?: string): string {
  const clean = (gl || DEFAULT_GL).trim().toLowerCase()
  return /^[a-z]{2}$/.test(clean) ? clean : DEFAULT_GL
}

function normalizeHl(hl?: string): string {
  const clean = (hl || DEFAULT_HL).trim().toLowerCase()
  return /^[a-z]{2}$/.test(clean) ? clean : DEFAULT_HL
}

function normalizeMaxQueries(maxQueries?: number): number {
  if (!maxQueries || Number.isNaN(maxQueries)) return 10
  return Math.max(1, Math.min(10, Math.floor(maxQueries)))
}

function dedupeDiscoveredUrls(items: DiscoveredUrl[]): DiscoveredUrl[] {
  const uniqueByUrl = new Set<string>()
  const uniqueByArticle = new Set<string>()
  const domainCount = new Map<string, number>()
  const sorted = [...items].sort((a, b) => b.sourceScore - a.sourceScore)
  const deduped: DiscoveredUrl[] = []

  for (const item of sorted) {
    const normalized = normalizeUrl(item.url)
    const articleFp = articleFingerprint(item.url, item.title)
    const domain = item.sourceDomain
    const seenInDomain = domainCount.get(domain) || 0

    if (uniqueByUrl.has(normalized)) continue
    if (uniqueByArticle.has(articleFp)) continue
    if (seenInDomain >= 2) continue

    uniqueByUrl.add(normalized)
    uniqueByArticle.add(articleFp)
    domainCount.set(domain, seenInDomain + 1)
    deduped.push(item)
  }

  return deduped
}

function articleFingerprint(url: string, title: string): string {
  try {
    const u = new URL(url)
    const cleanedPath = u.pathname
      .toLowerCase()
      .replace(/\d{4,}/g, '')
      .replace(/[-_]+/g, '-')
      .replace(/\/+$/, '')
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
    return `${u.hostname.replace(/^www\./, '')}|${cleanedPath}|${cleanTitle}`
  } catch {
    return `${url.toLowerCase()}|${title.toLowerCase()}`
  }
}

/** Remove tracking params, fragments, trailing slashes for dedup */
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    // Remove common tracking params
    for (const p of ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'fbclid', 'gclid']) {
      u.searchParams.delete(p)
    }
    u.hash = ''
    let result = u.toString()
    if (result.endsWith('/')) result = result.slice(0, -1)
    return result.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

/** Filter out Google's own pages, ads, and other noise */
function isUsefulUrl(url: string): boolean {
  const blocked = [
    'google.com', 'gstatic.com', 'googleapis.com',
    'youtube.com/results', 'accounts.google',
    'translate.google', 'maps.google',
    'webcache.googleusercontent',
    'pinterest.com',
    '/top-',
    '/best-',
  ]
  const lower = url.toLowerCase()
  return !blocked.some(b => lower.includes(b)) && !isLowValuePattern(lower)
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return 'unknown'
  }
}

function classifySourceValue(
  url: string,
  title: string,
  snippet: string
): { value: 'high' | 'medium' | 'low'; score: number } {
  const hay = `${url} ${title} ${snippet}`.toLowerCase()

  const highSignals = [
    'reddit.com', 'glassdoor', 'indeed', 'blind', 'teamblind',
    'reuters', 'bloomberg', 'bbc.', 'nytimes', 'theguardian',
    'forum', 'news', 'careers', 'lawsuit', 'layoff',
  ]
  const mediumSignals = [
    'linkedin.com', 'company blog', 'blog.', 'job post',
    'comparably', 'ratings', 'reviews',
  ]

  if (highSignals.some(s => hay.includes(s))) {
    return { value: 'high', score: 3 }
  }

  if (mediumSignals.some(s => hay.includes(s))) {
    return { value: 'medium', score: 2 }
  }

  return { value: 'low', score: 1 }
}

function isLowValuePattern(lowerUrl: string): boolean {
  const lowValueSignals = [
    '/best-companies',
    '/top-companies',
    '/directory/',
    '/list/',
    '/rankings/',
    '/alternatives',
  ]

  return lowValueSignals.some(sig => lowerUrl.includes(sig))
}
