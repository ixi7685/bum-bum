/**
 * Pipeline Orchestrator
 *
 * The main entry point for the 6-layer intelligence engine.
 *
 * Flow:
 *   1. Resolve company (name → aliases, languages)
 *   2. Check cache (skip expensive work if fresh data exists)
 *   3. Generate tight queries (about 8-10)
 *   4. Discover URLs (Serper search/news, cached)
 *   5. Scrape discovered URLs (fetch-based, concurrent)
 *   6. Classify content (URL rules + keyword heuristics)
 *   7. Gate content (filter noise, keep signals)
 *   8. Extract signals (AI-powered)
 *   9. Detect patterns (cross-signal, cross-layer)
 *   10. Cache results
 *
 * Designed to run alongside the existing source-specific fetchers.
 * Pipeline adds BREADTH (discovers new sources); existing fetchers add DEPTH.
 */

import { resolveCompany, ResolvedCompany } from './resolver'
import { generateQueries, getCoreQueries, LayerQuery } from './discovery/queries'
import { discoverUrls, DiscoveredUrl } from './discovery/serp'
import { scrapePage } from './scraping/scraper'
import { processWithConcurrency } from './scraping/queue'
import { classifyUrl, classifyContent, ClassifiedContent, LayerID } from './intelligence/classify'
import { filterContent } from './intelligence/gate'
import { extractSignalsBatch, ExtractedSignal } from './intelligence/signals'
import { detectPatterns, PatternAnalysis, DetectedPattern } from './intelligence/patterns'
import { getCache, setCache } from './cache/store'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PipelineResult {
  company: ResolvedCompany
  /** All extracted signals across L1-L6 */
  signals: ExtractedSignal[]
  /** Detected cross-signal patterns */
  patterns: PatternAnalysis
  /** Layer breakdown: how many signals per layer */
  layerBreakdown: Record<LayerID, number>
  /** Source stats */
  stats: PipelineStats
  /** Pre-formatted text summary for the AI prompt */
  promptSummary: string
  /** Whether this came from cache */
  fromCache: boolean
}

export interface PipelineStats {
  queriesRun: number
  urlsDiscovered: number
  urlsScraped: number
  contentPassed: number      // passed quality gate
  contentRejected: number    // failed quality gate
  signalsExtracted: number
  patternsDetected: number
  durationMs: number
  serperCallsEstimated: number
  serperCallsMade: number
  serperCacheHits: number
  acceptedSources: number
  gl: string
  hl: string
}

export interface PipelineOptions {
  /** Use only core (priority-1) queries for faster/cheaper runs */
  coreOnly?: boolean
  /** Max URLs to scrape (default: 20) */
  maxScrape?: number
  /** Skip AI signal extraction (use keyword fallback only) */
  skipAI?: boolean
  /** Force refresh, ignore cache */
  forceRefresh?: boolean
  /** Scraping concurrency (default: 5) */
  concurrency?: number
  /** Serper geographic market (default: us) */
  gl?: string
  /** Serper language (default: en) */
  hl?: string
}

// ─── Main pipeline ───────────────────────────────────────────────────────────

export async function runSearchPipeline(
  companyName: string,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const startTime = Date.now()
  const {
    coreOnly = false,
    maxScrape = 20,
    forceRefresh = false,
    concurrency = 5,
    gl = 'us',
    hl = 'en',
  } = options

  console.log(`[Pipeline] Starting for: ${companyName}`)

  // ── Step 1: Resolve company ──
  const company = resolveCompany(companyName)
  console.log(`[Pipeline] Resolved: ${company.normalizedName} (aliases: ${company.aliases.length}, langs: ${company.languages.join(',')})`)

  // ── Step 2: Check cache ──
  if (!forceRefresh) {
    const cached = getCache<PipelineResult>('pipeline', company.normalizedName)
    if (cached) {
      console.log(`[Pipeline] Cache hit for ${company.normalizedName}`)
      return { ...cached, fromCache: true }
    }
  }

  // ── Step 3: Generate queries ──
  const queries: LayerQuery[] = coreOnly
    ? getCoreQueries(company)
    : generateQueries(company)
  console.log(`[Pipeline] Generated ${queries.length} queries (${coreOnly ? 'core only' : 'full'})`)

  // ── Step 4: Discover URLs ──
  const discovery = await discoverUrls(company.normalizedName, queries, { gl, hl, maxQueries: 10 })
  const discoveredUrls = discovery.urls
  console.log(`[Pipeline] Discovered ${discoveredUrls.length} unique URLs`)

  // Prioritize high-value sources and maintain layer/domain diversity
  const prioritizedUrls = prioritizeUrls(discoveredUrls, maxScrape)
  console.log(`[Pipeline] Prioritized ${prioritizedUrls.length} URLs for scraping`)

  // ── Step 5: Scrape URLs ──
  const { results: scraped, errors: scrapeErrors } = await processWithConcurrency(
    prioritizedUrls,
    async (discovered: DiscoveredUrl) => {
      const content = await scrapePage(discovered.url)
      return { discovered, scraped: content }
    },
    concurrency
  )

  const successfulScrapes = scraped.filter(s => !s.scraped.error && s.scraped.text.length > 0)
  console.log(`[Pipeline] Scraped ${successfulScrapes.length}/${prioritizedUrls.length} URLs (${scrapeErrors.length} errors)`)

  // ── Step 6: Classify content ──
  const classified: ClassifiedContent[] = successfulScrapes.map(({ discovered, scraped: scrapedContent }) =>
    classifyContent(discovered, scrapedContent)
  )

  // ── Step 7: Quality gate ──
  const { passed, rejected } = filterContent(classified)
  console.log(`[Pipeline] Gate: ${passed.length} passed, ${rejected.length} rejected`)

  // ── Step 8: Extract signals ──
  const signals = await extractSignalsBatch(passed, company.normalizedName)
  console.log(`[Pipeline] Extracted ${signals.length} signals`)

  // ── Step 9: Detect patterns ──
  const patterns = detectPatterns(signals)
  console.log(`[Pipeline] Detected ${patterns.patterns.length} patterns`)

  // ── Build layer breakdown ──
  const layerBreakdown: Record<LayerID, number> = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0 }
  for (const sig of signals) {
    layerBreakdown[sig.layer]++
  }

  // ── Build prompt summary ──
  const promptSummary = buildPipelinePromptSummary(company, signals, patterns)

  // ── Build result ──
  const stats: PipelineStats = {
    queriesRun: queries.length,
    urlsDiscovered: discoveredUrls.length,
    urlsScraped: successfulScrapes.length,
    contentPassed: passed.length,
    contentRejected: rejected.length,
    signalsExtracted: signals.length,
    patternsDetected: patterns.patterns.length,
    durationMs: Date.now() - startTime,
    serperCallsEstimated: discovery.telemetry.plannedQueryCount,
    serperCallsMade: discovery.telemetry.apiCallsMade,
    serperCacheHits: discovery.telemetry.cacheHits,
    acceptedSources: passed.length,
    gl,
    hl,
  }

  const result: PipelineResult = {
    company,
    signals,
    patterns,
    layerBreakdown,
    stats,
    promptSummary,
    fromCache: false,
  }

  // ── Step 10: Cache ──
  setCache('pipeline', company.normalizedName, result)
  console.log(`[Pipeline] Complete in ${stats.durationMs}ms — ${signals.length} signals, ${patterns.patterns.length} patterns`)

  return result
}

// ─── URL prioritization ──────────────────────────────────────────────────────

function prioritizeUrls(urls: DiscoveredUrl[], maxCount: number): DiscoveredUrl[] {
  // Score each URL
  const scored = urls.map(u => {
    let score = 0

    // High-confidence sources get priority
    const classification = classifyUrl(u.url, u.layerHint)
    score += classification.confidence * 10

    // Position bonus (top results are more relevant)
    score += Math.max(0, 5 - u.position)

    // Source-value first: high > medium > low
    if (u.sourceValue === 'high') score += 12
    if (u.sourceValue === 'medium') score += 6

    // Add source classifier score from discovery stage
    score += u.sourceScore * 2

    // Layer diversity: ensure we get some from each layer
    const layerBonus: Record<string, number> = { L1: 1, L2: 2, L3: 3, L4: 3, L5: 2, L6: 3 }
    score += layerBonus[u.layerHint] || 1

    return { url: u, score }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Ensure layer diversity: at least 3 URLs per layer
  const selected: DiscoveredUrl[] = []
  const perLayer: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0 }
  const perDomain: Record<string, number> = {}
  const MIN_PER_LAYER = 3

  // First pass: guarantee minimum per layer
  for (const { url } of scored) {
    const layer = url.layerHint
    const domain = url.sourceDomain || 'unknown'
    if (perLayer[layer] < MIN_PER_LAYER && (perDomain[domain] || 0) < 2) {
      selected.push(url)
      perLayer[layer]++
      perDomain[domain] = (perDomain[domain] || 0) + 1
    }
    if (selected.length >= maxCount) break
  }

  // Second pass: fill remaining slots by score
  for (const { url } of scored) {
    if (selected.length >= maxCount) break
    const domain = url.sourceDomain || 'unknown'
    if (!selected.includes(url) && (perDomain[domain] || 0) < 2) {
      selected.push(url)
      perDomain[domain] = (perDomain[domain] || 0) + 1
    }
  }

  return selected
}

// ─── Prompt summary builder ──────────────────────────────────────────────────

function buildPipelinePromptSummary(
  company: ResolvedCompany,
  signals: ExtractedSignal[],
  patterns: PatternAnalysis
): string {
  const parts: string[] = []

  parts.push(`=== PIPELINE DISCOVERY RESULTS (${company.normalizedName}) ===`)
  parts.push(`Company: ${company.name} | Aliases: ${company.aliases.join(', ')}`)
  parts.push(`Languages: ${company.languages.join(', ')}${company.country ? ` | Country: ${company.country}` : ''}`)
  parts.push('')

  // Signal summary by layer
  const layers: LayerID[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']
  for (const layer of layers) {
    const layerSignals = signals.filter(s => s.layer === layer)
    if (layerSignals.length === 0) continue

    const layerNames: Record<LayerID, string> = {
      L1: 'Official Narrative', L2: 'Professional Behavior',
      L3: 'Employee Leakage', L4: 'Community Reality',
      L5: 'Client Fallout', L6: 'External Consequences',
    }

    parts.push(`--- ${layer}: ${layerNames[layer]} (${layerSignals.length} signals) ---`)

    for (const sig of layerSignals.slice(0, 15)) {
      parts.push(`  [${sig.type}] ${sig.title} (${sig.severity})`)
      if (sig.evidence) {
        parts.push(`    Evidence: "${sig.evidence.substring(0, 200)}"`)
      }
      parts.push(`    Source: ${sig.platform} — ${sig.source}`)
      if (sig.date) parts.push(`    Date: ${sig.date}`)
      if (sig.speaker) parts.push(`    Speaker: ${sig.speaker}`)
      parts.push('')
    }
  }

  // Patterns
  if (patterns.patterns.length > 0) {
    parts.push(`=== DETECTED PATTERNS (${patterns.patterns.length}) ===`)
    for (const pat of patterns.patterns.slice(0, 8)) {
      parts.push(`  [${pat.severity.toUpperCase()}] ${pat.name} (confidence: ${pat.confidence})`)
      parts.push(`    ${pat.description}`)
      parts.push(`    Layers: ${pat.layers.join(', ')} | Signals: ${pat.signalCount}`)
      parts.push(`    Implication: ${pat.implication}`)
      parts.push('')
    }
  }

  // Cross-layer confirmations
  if (patterns.crossLayerConfirmations.length > 0) {
    parts.push(`=== CROSS-LAYER CONFIRMATIONS ===`)
    for (const conf of patterns.crossLayerConfirmations) {
      parts.push(`  ✓ ${conf.finding} [${conf.layers.join('+')}] (${conf.confidence} confidence)`)
    }
    parts.push('')
  }

  // Narrative mismatches
  if (patterns.narrativeMismatches.length > 0) {
    parts.push(`=== NARRATIVE MISMATCHES ===`)
    for (const mm of patterns.narrativeMismatches) {
      parts.push(`  ⚠ L1 claims: "${mm.l1Claim}"`)
      parts.push(`    Reality (${mm.realityLayers.join('+')}): "${mm.realitySignal}"`)
      parts.push(`    Severity: ${mm.severity}`)
      parts.push('')
    }
  }

  return parts.join('\n')
}

// ─── Re-exports for convenience ──────────────────────────────────────────────

export type { ResolvedCompany } from './resolver'
export type { ExtractedSignal, SignalType, Severity } from './intelligence/signals'
export type { DetectedPattern, PatternAnalysis, PatternCategory } from './intelligence/patterns'
export type { LayerID } from './intelligence/classify'
