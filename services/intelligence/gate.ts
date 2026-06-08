/**
 * Content Quality Gate
 *
 * Filters scraped content to keep only material with real employment signals.
 * Discards: SEO junk, boilerplate, generic info, error pages, paywalls.
 *
 * Phase 1: Rule-based heuristics (fast)
 * Phase 2: AI-assisted gating (for borderline cases)
 */

import type { ClassifiedContent } from './classify'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GateResult {
  passed: boolean
  reason: string        // why it was kept or discarded
  qualityScore: number  // 0–1
  signalDensity: number // how many signal keywords per 1000 chars
}

// ─── Config ──────────────────────────────────────────────────────────────────

const MIN_TEXT_LENGTH = 100          // chars — anything shorter is noise
const MAX_BOILERPLATE_RATIO = 0.6   // if >60% is boilerplate → discard
const MIN_SIGNAL_DENSITY = 0.5      // signals per 1000 chars

// ─── Main gate ───────────────────────────────────────────────────────────────

export function contentGate(content: ClassifiedContent): GateResult {
  const text = content.text
  const title = content.title

  // ── Quick discard checks ──

  // Too short
  if (text.length < MIN_TEXT_LENGTH) {
    return { passed: false, reason: 'too-short', qualityScore: 0, signalDensity: 0 }
  }

  // Error pages
  if (isErrorPage(text, title)) {
    return { passed: false, reason: 'error-page', qualityScore: 0, signalDensity: 0 }
  }

  // Paywall / login required
  if (isPaywall(text)) {
    return { passed: false, reason: 'paywall', qualityScore: 0.1, signalDensity: 0 }
  }

  // Cookie consent / GDPR only
  if (isCookieOnly(text)) {
    return { passed: false, reason: 'cookie-only', qualityScore: 0, signalDensity: 0 }
  }

  // ── Quality scoring ──

  const boilerplateRatio = measureBoilerplate(text)
  if (boilerplateRatio > MAX_BOILERPLATE_RATIO) {
    return { passed: false, reason: 'too-much-boilerplate', qualityScore: 0.2, signalDensity: 0 }
  }

  const density = measureSignalDensity(text)
  const qualityScore = calculateQualityScore(text, density, boilerplateRatio, content.confidence)

  // High-confidence platforms always pass (Glassdoor, Reddit, etc.)
  if (content.confidence >= 0.9) {
    return { passed: true, reason: 'high-confidence-source', qualityScore, signalDensity: density }
  }

  // Check signal density
  if (density < MIN_SIGNAL_DENSITY && qualityScore < 0.4) {
    return { passed: false, reason: 'low-signal-density', qualityScore, signalDensity: density }
  }

  return { passed: true, reason: 'passed', qualityScore, signalDensity: density }
}

/**
 * Filter a batch of classified content through the gate.
 * Returns only content that passes quality checks.
 */
export function filterContent(contents: ClassifiedContent[]): {
  passed: ClassifiedContent[]
  rejected: { content: ClassifiedContent; reason: string }[]
} {
  const passed: ClassifiedContent[] = []
  const rejected: { content: ClassifiedContent; reason: string }[] = []

  for (const content of contents) {
    const result = contentGate(content)
    if (result.passed) {
      passed.push(content)
    } else {
      rejected.push({ content, reason: result.reason })
    }
  }

  console.log(`[Gate] ${passed.length} passed, ${rejected.length} rejected out of ${contents.length}`)
  return { passed, rejected }
}

// ─── Heuristic checks ────────────────────────────────────────────────────────

function isErrorPage(text: string, title: string): boolean {
  const combined = `${title} ${text}`.toLowerCase()
  const errorPatterns = [
    /404\s*(?:not\s*found|page\s*not)/,
    /403\s*forbidden/,
    /500\s*(?:internal\s*)?server\s*error/,
    /page\s*(?:not|cannot\s*be)\s*found/,
    /access\s*denied/,
    /this\s*page\s*(?:doesn'?t|does\s*not)\s*exist/,
    /sorry.*unavailable/,
  ]
  return errorPatterns.some(p => p.test(combined))
}

function isPaywall(text: string): boolean {
  const lower = text.toLowerCase()
  const paywallSignals = [
    'subscribe to continue reading',
    'sign in to read',
    'create a free account',
    'premium content',
    'subscriber-only',
    'to read the full story',
    'this article is for members',
  ]
  const matches = paywallSignals.filter(s => lower.includes(s))
  // Only flag as paywall if text is short AND has paywall signals
  return matches.length >= 1 && text.length < 500
}

function isCookieOnly(text: string): boolean {
  const lower = text.toLowerCase()
  return text.length < 300 && (
    lower.includes('cookie') && lower.includes('accept') && !lower.includes('review')
  )
}

/** Estimate what fraction of text is boilerplate (nav, footer, legal, etc.) */
function measureBoilerplate(text: string): number {
  const boilerplatePatterns = [
    /copyright\s*©?\s*\d{4}/gi,
    /all\s*rights\s*reserved/gi,
    /terms\s*(?:of\s*)?(?:service|use)/gi,
    /privacy\s*policy/gi,
    /cookie\s*(?:policy|preferences|settings)/gi,
    /subscribe\s*(?:to\s*)?(?:our\s*)?newsletter/gi,
    /follow\s*us\s*on/gi,
    /sign\s*(?:up|in)\s*(?:for|to)/gi,
    /share\s*(?:this|on)\s*(?:twitter|facebook|linkedin)/gi,
    /related\s*(?:articles?|posts?)/gi,
    /comments?\s*\(\d+\)/gi,
    /load\s*more/gi,
  ]

  let boilerplateChars = 0
  for (const pat of boilerplatePatterns) {
    const matches = text.match(pat) || []
    for (const m of matches) {
      boilerplateChars += m.length + 50 // add surrounding context estimate
    }
  }

  return Math.min(boilerplateChars / text.length, 1)
}

// ─── Signal density ──────────────────────────────────────────────────────────

/** Employment-related signal keywords */
const SIGNAL_KEYWORDS = [
  // Work experience
  'work-life', 'overtime', 'burnout', 'workload', 'hours', 'remote', 'hybrid', 'office',
  'culture', 'toxic', 'inclusive', 'diversity', 'team',
  // Career
  'salary', 'compensation', 'raise', 'promotion', 'career', 'growth', 'learning',
  'stagnant', 'dead-end', 'opportunity',
  // Management
  'management', 'leadership', 'manager', 'CEO', 'CTO', 'director', 'VP',
  'micromanage', 'transparent', 'politics',
  // Stability
  'layoff', 'laid off', 'fired', 'restructuring', 'downsizing', 'hiring freeze',
  'turnover', 'attrition', 'retention',
  // Reviews
  'review', 'rating', 'recommend', 'pros', 'cons', 'experience',
  'interview', 'offer', 'rejected', 'ghosted',
  // Legal / financial
  'lawsuit', 'sued', 'SEC', 'investigation', 'bankruptcy', 'debt',
  'acquisition', 'merger', 'IPO', 'funding',
  // Sentiment
  'terrible', 'amazing', 'worst', 'best', 'love', 'hate', 'awful', 'great',
  'disappointing', 'excellent', 'avoid', 'recommend',
]

function measureSignalDensity(text: string): number {
  const lower = text.toLowerCase()
  let signalCount = 0

  for (const keyword of SIGNAL_KEYWORDS) {
    // Count occurrences
    let idx = 0
    while (true) {
      idx = lower.indexOf(keyword, idx)
      if (idx === -1) break
      signalCount++
      idx += keyword.length
    }
  }

  // Signals per 1000 characters
  return (signalCount / text.length) * 1000
}

// ─── Quality score ───────────────────────────────────────────────────────────

function calculateQualityScore(
  text: string,
  signalDensity: number,
  boilerplateRatio: number,
  sourceConfidence: number
): number {
  let score = 0

  // Text length bonus (longer = more content = more useful, up to a point)
  const lengthScore = Math.min(text.length / 5000, 1) * 0.2
  score += lengthScore

  // Signal density bonus
  score += Math.min(signalDensity / 5, 1) * 0.3

  // Low boilerplate bonus
  score += (1 - boilerplateRatio) * 0.2

  // Source confidence
  score += sourceConfidence * 0.3

  return Math.min(score, 1)
}
