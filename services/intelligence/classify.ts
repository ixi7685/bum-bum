/**
 * Layer Classifier
 *
 * Assigns a 6-layer classification to each discovered URL / scraped content.
 *
 * Phase 1: Rule-based (URL pattern matching + keyword heuristics)
 * Phase 2: AI-refined (LLM for ambiguous cases)
 *
 * Layer definitions:
 *   L1 — Official Narrative (company-controlled)
 *   L2 — Professional Behavior (human-in-public, not anonymous)
 *   L3 — Employee Leakage (anonymous reviews, candidate experience)
 *   L4 — Community Reality (forums, Reddit, HN)
 *   L5 — Client Fallout (customer reviews, complaints)
 *   L6 — External Consequences (news, legal, financial events)
 */

import type { DiscoveredUrl } from '../discovery/serp'
import type { ScrapedContent } from '../scraping/scraper'

// ─── Types ───────────────────────────────────────────────────────────────────

export type LayerID = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6'

export interface ClassifiedContent {
  url: string
  title: string
  text: string
  snippet: string
  layer: LayerID
  confidence: number        // 0–1
  platform: string          // e.g. "glassdoor", "reddit", "linkedin"
  sourceType: string        // e.g. "review", "forum-post", "news-article"
  timestamp: string | null
}

// ─── URL-based classification (fast, first pass) ─────────────────────────────

interface UrlRule {
  pattern: RegExp
  layer: LayerID
  platform: string
  sourceType: string
  confidence: number
}

const URL_RULES: UrlRule[] = [
  // ── L3: Employee Review Platforms ──
  { pattern: /glassdoor\.\w+/i,            layer: 'L3', platform: 'Glassdoor',       sourceType: 'review',       confidence: 0.95 },
  { pattern: /indeed\.\w+\/cmp\//i,        layer: 'L3', platform: 'Indeed',          sourceType: 'review',       confidence: 0.90 },
  { pattern: /teamblind\.com|blind-app/i,   layer: 'L3', platform: 'Blind',           sourceType: 'review',       confidence: 0.95 },
  { pattern: /comparably\.com/i,            layer: 'L3', platform: 'Comparably',      sourceType: 'review',       confidence: 0.90 },
  { pattern: /kununu\.\w+/i,               layer: 'L3', platform: 'Kununu',          sourceType: 'review',       confidence: 0.90 },
  { pattern: /gowork\.pl/i,                layer: 'L3', platform: 'GoWork',          sourceType: 'review',       confidence: 0.90 },
  { pattern: /levels\.fyi/i,               layer: 'L3', platform: 'Levels.fyi',      sourceType: 'compensation', confidence: 0.85 },
  { pattern: /fishbowlapp\.com/i,          layer: 'L3', platform: 'Fishbowl',        sourceType: 'discussion',   confidence: 0.85 },
  { pattern: /thelayoff\.com/i,            layer: 'L3', platform: 'TheLayoff',       sourceType: 'discussion',   confidence: 0.85 },

  // ── L2: Professional / Semi-public ──
  { pattern: /linkedin\.com\/posts?\//i,     layer: 'L2', platform: 'LinkedIn',        sourceType: 'post',         confidence: 0.90 },
  { pattern: /linkedin\.com\/pulse\//i,      layer: 'L2', platform: 'LinkedIn Pulse',  sourceType: 'article',      confidence: 0.90 },
  { pattern: /linkedin\.com\/in\//i,         layer: 'L2', platform: 'LinkedIn',        sourceType: 'profile',      confidence: 0.70 },
  { pattern: /linkedin\.com\/company\//i,    layer: 'L1', platform: 'LinkedIn',        sourceType: 'company-page', confidence: 0.85 },
  { pattern: /medium\.com/i,                layer: 'L2', platform: 'Medium',          sourceType: 'article',      confidence: 0.75 },
  { pattern: /dev\.to/i,                    layer: 'L2', platform: 'Dev.to',          sourceType: 'article',      confidence: 0.75 },
  { pattern: /hashnode\.dev/i,              layer: 'L2', platform: 'Hashnode',        sourceType: 'article',      confidence: 0.75 },
  { pattern: /substack\.com/i,              layer: 'L2', platform: 'Substack',        sourceType: 'newsletter',   confidence: 0.75 },
  { pattern: /github\.com/i,               layer: 'L2', platform: 'GitHub',          sourceType: 'code',         confidence: 0.70 },

  // ── L4: Community / Forums ──
  { pattern: /reddit\.com\/r\//i,           layer: 'L4', platform: 'Reddit',          sourceType: 'forum-post',   confidence: 0.95 },
  { pattern: /news\.ycombinator\.com/i,     layer: 'L4', platform: 'Hacker News',     sourceType: 'forum-post',   confidence: 0.95 },
  { pattern: /quora\.com/i,                layer: 'L4', platform: 'Quora',           sourceType: 'qa',           confidence: 0.80 },
  { pattern: /stackoverflow\.com/i,        layer: 'L4', platform: 'StackOverflow',   sourceType: 'qa',           confidence: 0.70 },
  { pattern: /lobste\.rs/i,                layer: 'L4', platform: 'Lobsters',        sourceType: 'forum-post',   confidence: 0.85 },
  { pattern: /slashdot\.org/i,             layer: 'L4', platform: 'Slashdot',        sourceType: 'forum-post',   confidence: 0.80 },

  // ── L5: Client / Customer Reviews ──
  { pattern: /trustpilot\.com/i,           layer: 'L5', platform: 'Trustpilot',      sourceType: 'review',       confidence: 0.95 },
  { pattern: /g2\.com/i,                   layer: 'L5', platform: 'G2',              sourceType: 'review',       confidence: 0.90 },
  { pattern: /capterra\.com/i,             layer: 'L5', platform: 'Capterra',        sourceType: 'review',       confidence: 0.90 },
  { pattern: /trustradius\.com/i,          layer: 'L5', platform: 'TrustRadius',     sourceType: 'review',       confidence: 0.85 },
  { pattern: /getapp\.com/i,               layer: 'L5', platform: 'GetApp',          sourceType: 'review',       confidence: 0.85 },
  { pattern: /yelp\.com/i,                 layer: 'L5', platform: 'Yelp',            sourceType: 'review',       confidence: 0.90 },
  { pattern: /sitejabber\.com/i,           layer: 'L5', platform: 'SiteJabber',      sourceType: 'review',       confidence: 0.85 },
  { pattern: /consumeraffairs\.com/i,      layer: 'L5', platform: 'ConsumerAffairs', sourceType: 'review',       confidence: 0.85 },
  { pattern: /bbb\.org/i,                  layer: 'L5', platform: 'BBB',             sourceType: 'review',       confidence: 0.80 },

  // ── L6: News / External ──
  { pattern: /reuters\.com/i,              layer: 'L6', platform: 'Reuters',         sourceType: 'news',         confidence: 0.95 },
  { pattern: /bloomberg\.com/i,            layer: 'L6', platform: 'Bloomberg',       sourceType: 'news',         confidence: 0.95 },
  { pattern: /wsj\.com/i,                  layer: 'L6', platform: 'WSJ',             sourceType: 'news',         confidence: 0.95 },
  { pattern: /ft\.com/i,                   layer: 'L6', platform: 'Financial Times', sourceType: 'news',         confidence: 0.95 },
  { pattern: /techcrunch\.com/i,           layer: 'L6', platform: 'TechCrunch',      sourceType: 'news',         confidence: 0.90 },
  { pattern: /theverge\.com/i,             layer: 'L6', platform: 'The Verge',       sourceType: 'news',         confidence: 0.85 },
  { pattern: /arstechnica\.com/i,          layer: 'L6', platform: 'Ars Technica',    sourceType: 'news',         confidence: 0.85 },
  { pattern: /bbc\.co/i,                   layer: 'L6', platform: 'BBC',             sourceType: 'news',         confidence: 0.95 },
  { pattern: /nytimes\.com/i,              layer: 'L6', platform: 'NY Times',        sourceType: 'news',         confidence: 0.95 },
  { pattern: /theguardian\.com/i,          layer: 'L6', platform: 'The Guardian',    sourceType: 'news',         confidence: 0.90 },
  { pattern: /cnbc\.com/i,                 layer: 'L6', platform: 'CNBC',            sourceType: 'news',         confidence: 0.90 },
  { pattern: /sec\.gov/i,                  layer: 'L6', platform: 'SEC',             sourceType: 'filing',       confidence: 0.95 },
  { pattern: /layoffs\.fyi/i,              layer: 'L6', platform: 'Layoffs.fyi',     sourceType: 'tracker',      confidence: 0.95 },
  { pattern: /crunchbase\.com/i,           layer: 'L6', platform: 'Crunchbase',      sourceType: 'corporate',    confidence: 0.80 },
  { pattern: /wikipedia\.org/i,            layer: 'L6', platform: 'Wikipedia',       sourceType: 'encyclopedia', confidence: 0.80 },

  // ── L5: YouTube (often client/community) ──
  { pattern: /youtube\.com\/watch/i,       layer: 'L5', platform: 'YouTube',         sourceType: 'video',        confidence: 0.60 },
]

// ─── Main classification ─────────────────────────────────────────────────────

/**
 * Classify a discovered URL into an intelligence layer.
 * Uses URL pattern matching (fast) + optional content analysis.
 */
export function classifyUrl(url: string, layerHint?: string): {
  layer: LayerID
  platform: string
  sourceType: string
  confidence: number
} {
  // Try URL rules first
  for (const rule of URL_RULES) {
    if (rule.pattern.test(url)) {
      return {
        layer: rule.layer,
        platform: rule.platform,
        sourceType: rule.sourceType,
        confidence: rule.confidence,
      }
    }
  }

  // Fallback: use the layer hint from the query that discovered this URL
  if (layerHint && isValidLayer(layerHint)) {
    return {
      layer: layerHint as LayerID,
      platform: extractDomain(url),
      sourceType: 'webpage',
      confidence: 0.5,
    }
  }

  // Default: L1 (company content is the most common unclassified result)
  return {
    layer: 'L1',
    platform: extractDomain(url),
    sourceType: 'webpage',
    confidence: 0.3,
  }
}

/**
 * Full classification: URL + scraped content → ClassifiedContent
 */
export function classifyContent(
  discovered: DiscoveredUrl,
  scraped: ScrapedContent
): ClassifiedContent {
  const urlClass = classifyUrl(discovered.url, discovered.layerHint)

  // Content-based refinement (if URL classification confidence is low)
  if (urlClass.confidence < 0.7) {
    const contentLayer = classifyByContent(scraped.text, scraped.title)
    if (contentLayer.confidence > urlClass.confidence) {
      return {
        url: discovered.url,
        title: scraped.title || discovered.title,
        text: scraped.text,
        snippet: discovered.snippet,
        layer: contentLayer.layer,
        confidence: contentLayer.confidence,
        platform: urlClass.platform,
        sourceType: contentLayer.sourceType || urlClass.sourceType,
        timestamp: scraped.timestamp,
      }
    }
  }

  return {
    url: discovered.url,
    title: scraped.title || discovered.title,
    text: scraped.text,
    snippet: discovered.snippet,
    layer: urlClass.layer,
    confidence: urlClass.confidence,
    platform: urlClass.platform,
    sourceType: urlClass.sourceType,
    timestamp: scraped.timestamp,
  }
}

// ─── Content-based classification (keyword heuristics) ───────────────────────

interface ContentClassResult {
  layer: LayerID
  confidence: number
  sourceType?: string
}

const CONTENT_SIGNALS: { patterns: RegExp[]; layer: LayerID; weight: number; sourceType?: string }[] = [
  // L3 signals — employee language
  { patterns: [/worked?\s+(?:at|for|here)/i, /former?\s+employee/i, /I\s+(?:left|quit|resigned)/i, /management\s+(?:is|was)\s+(?:terrible|awful|toxic)/i],
    layer: 'L3', weight: 0.8, sourceType: 'review' },
  { patterns: [/interview\s+(?:process|experience)/i, /got\s+(?:an\s+)?offer/i, /rejected|ghosted/i],
    layer: 'L3', weight: 0.7, sourceType: 'interview-exp' },

  // L4 signals — community language
  { patterns: [/anyone\s+(?:work|worked)\s+(?:at|for)/i, /has\s+anyone/i, /what'?s?\s+it\s+like/i, /heard\s+(?:about|that)/i],
    layer: 'L4', weight: 0.75, sourceType: 'discussion' },

  // L5 signals — customer language
  { patterns: [/customer\s+service/i, /refund/i, /subscription\s+cancel/i, /product\s+(?:is|was)\s+(?:terrible|broken)/i],
    layer: 'L5', weight: 0.7, sourceType: 'complaint' },

  // L6 signals — news/events language
  { patterns: [/laid\s+off/i, /layoffs?/i, /(?:filed|settled)\s+(?:a\s+)?lawsuit/i, /SEC\s+filing/i, /bankruptcy/i],
    layer: 'L6', weight: 0.8, sourceType: 'news' },

  // L1 signals — corporate language
  { patterns: [/our\s+mission/i, /we\s+(?:are|believe)/i, /join\s+(?:our|the)\s+team/i, /company\s+values/i],
    layer: 'L1', weight: 0.6, sourceType: 'corporate' },
]

function classifyByContent(text: string, title: string): ContentClassResult {
  const combined = `${title} ${text}`.substring(0, 5000)  // only check first 5k chars
  const scores: Record<LayerID, number> = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0 }

  for (const signal of CONTENT_SIGNALS) {
    let matchCount = 0
    for (const pat of signal.patterns) {
      if (pat.test(combined)) matchCount++
    }
    if (matchCount > 0) {
      scores[signal.layer] += signal.weight * (matchCount / signal.patterns.length)
    }
  }

  // Find highest scoring layer
  let bestLayer: LayerID = 'L1'
  let bestScore = 0
  for (const [layer, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      bestLayer = layer as LayerID
    }
  }

  const sourceType = CONTENT_SIGNALS.find(s => s.layer === bestLayer)?.sourceType

  return {
    layer: bestLayer,
    confidence: Math.min(bestScore, 0.9),
    sourceType,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidLayer(s: string): s is LayerID {
  return ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'].includes(s)
}

function extractDomain(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace('www.', '')
  } catch {
    return 'unknown'
  }
}
