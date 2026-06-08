/**
 * AI Signal Extraction
 *
 * Takes classified, gated content and extracts structured employment signals.
 * Uses OpenAI (gpt-4.1-mini) to understand context and extract meaning.
 *
 * Each signal has:
 *   - type (what kind of signal)
 *   - severity (low / medium / high / critical)
 *   - layer (L1-L6)
 *   - evidence (the supporting text)
 *   - date (when, if detectable)
 */

import type { ClassifiedContent } from './classify'
import type { LayerID } from './classify'

// ─── Types ───────────────────────────────────────────────────────────────────

export type SignalType =
  | 'short-tenure'           // people leaving quickly
  | 'role-instability'       // roles reopened repeatedly
  | 'layoff-event'           // mass layoffs
  | 'hiring-surge'           // aggressive hiring
  | 'hiring-freeze'          // stopped hiring
  | 'management-issues'      // leadership / management complaints
  | 'work-life-imbalance'    // WLB problems
  | 'compensation-concerns'  // pay complaints
  | 'growth-stagnation'      // no career development
  | 'toxic-culture'          // cultural toxicity
  | 'positive-culture'       // healthy culture signals
  | 'innovation-signal'      // tech / innovation focus
  | 'legal-issues'           // lawsuits, regulatory
  | 'financial-distress'     // money problems
  | 'customer-complaints'    // product / service issues
  | 'pr-disconnect'          // L1 claims vs reality gap
  | 'transparency-signal'    // open communication
  | 'diversity-signal'       // DEI-related
  | 'remote-work-signal'     // WFH / hybrid policies
  | 'restructuring'          // org changes
  | 'ceo-change'             // leadership transition
  | 'acquisition-signal'     // M&A activity
  | 'general'                // unclassified

export type Severity = 'low' | 'medium' | 'high' | 'critical'

export interface ExtractedSignal {
  id: string
  type: SignalType
  severity: Severity
  layer: LayerID
  title: string             // short description
  evidence: string          // supporting text/quote
  source: string            // URL
  platform: string          // where it came from
  date: string | null       // when
  speaker: string | null    // who said it (if known)
  confidence: number        // 0–1
}

// ─── Main extraction (AI-powered) ────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are an employment signal extraction engine.

Given a piece of web content about a company, extract employment-related SIGNALS.

A signal is a discrete, factual observation that reveals something about what it's like to work at, apply to, or interact with this company.

For each signal, return:
- type: one of: short-tenure, role-instability, layoff-event, hiring-surge, hiring-freeze, management-issues, work-life-imbalance, compensation-concerns, growth-stagnation, toxic-culture, positive-culture, innovation-signal, legal-issues, financial-distress, customer-complaints, pr-disconnect, transparency-signal, diversity-signal, remote-work-signal, restructuring, ceo-change, acquisition-signal, general
- severity: low | medium | high | critical
- title: short (5-10 word) description
- evidence: the exact quote or paraphrase that supports this signal (max 200 chars)
- date: ISO date or "YYYY-MM" if detectable, null otherwise
- speaker: who said it (name, role, or "anonymous"), null if unknown

RULES:
- Extract ONLY signals backed by specific text. No guessing.
- One piece of content can have 0-10 signals.
- If the content is generic/SEO/boilerplate with no real signals, return empty array.
- Prefer specific over generic. "Management is bad" = weak. "3 directors left in 6 months" = strong.
- Severity guide:
  - low: minor concern, single instance
  - medium: notable pattern, repeated mention
  - high: structural issue, many affected
  - critical: legal, mass layoffs, safety

Return ONLY valid JSON: { "signals": [...] }
No explanation, no markdown.`

/**
 * Extract signals from a single piece of classified content using AI.
 */
export async function extractSignalsAI(
  content: ClassifiedContent,
  companyName: string
): Promise<ExtractedSignal[]> {
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    console.warn('[Signals] No OPENAI_API_KEY — falling back to keyword extraction')
    return extractSignalsKeyword(content, companyName)
  }

  try {
    // Truncate text to keep within token limits
    const textForAI = content.text.substring(0, 8000)

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          {
            role: 'user',
            content: `Company: ${companyName}\nSource: ${content.platform} (${content.url})\nLayer: ${content.layer}\n\nContent:\n${textForAI}`,
          },
        ],
        max_completion_tokens: 2000,
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      console.warn(`[Signals] OpenAI error: ${response.status}`)
      return extractSignalsKeyword(content, companyName)
    }

    const data = await response.json()
    const raw = data.choices?.[0]?.message?.content || '{"signals":[]}'

    // Parse AI response
    const parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''))
    const signals: ExtractedSignal[] = (parsed.signals || []).map((s: any, idx: number) => ({
      id: `sig-${content.layer}-${Date.now()}-${idx}`,
      type: s.type || 'general',
      severity: s.severity || 'medium',
      layer: content.layer,
      title: s.title || 'Signal detected',
      evidence: s.evidence || '',
      source: content.url,
      platform: content.platform,
      date: s.date || content.timestamp,
      speaker: s.speaker || null,
      confidence: content.confidence * 0.9,  // AI extraction adds slight uncertainty
    }))

    return signals
  } catch (error) {
    console.warn(`[Signals] AI extraction failed:`, error)
    return extractSignalsKeyword(content, companyName)
  }
}

/**
 * Extract signals from a batch of content.
 * Processes sequentially to respect API rate limits.
 */
export async function extractSignalsBatch(
  contents: ClassifiedContent[],
  companyName: string
): Promise<ExtractedSignal[]> {
  const allSignals: ExtractedSignal[] = []

  // Process in small batches to avoid rate limits
  const batchSize = 3
  for (let i = 0; i < contents.length; i += batchSize) {
    const batch = contents.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(c => extractSignalsAI(c, companyName))
    )

    for (const r of results) {
      if (r.status === 'fulfilled') {
        allSignals.push(...r.value)
      }
    }
  }

  console.log(`[Signals] Extracted ${allSignals.length} signals from ${contents.length} sources`)
  return allSignals
}

// ─── Keyword-based fallback (no AI needed) ───────────────────────────────────

interface KeywordRule {
  keywords: string[]
  type: SignalType
  severity: Severity
}

const KEYWORD_RULES: KeywordRule[] = [
  { keywords: ['laid off', 'layoff', 'layoffs', 'downsizing', 'reduction in force', 'RIF'],
    type: 'layoff-event', severity: 'high' },
  { keywords: ['toxic', 'hostile', 'abusive', 'harassment', 'bullying', 'discrimination'],
    type: 'toxic-culture', severity: 'high' },
  { keywords: ['lawsuit', 'sued', 'litigation', 'settlement', 'class action'],
    type: 'legal-issues', severity: 'high' },
  { keywords: ['bankruptcy', 'insolvent', 'debt default', 'going concern'],
    type: 'financial-distress', severity: 'critical' },
  { keywords: ['CEO resigned', 'CEO fired', 'CEO departure', 'CEO left', 'new CEO'],
    type: 'ceo-change', severity: 'medium' },
  { keywords: ['acquired', 'acquisition', 'merger', 'merged with', 'bought by'],
    type: 'acquisition-signal', severity: 'medium' },
  { keywords: ['overworked', 'no work-life', 'long hours', 'weekends', 'burnout', '60 hours', '70 hours'],
    type: 'work-life-imbalance', severity: 'medium' },
  { keywords: ['underpaid', 'low salary', 'below market', 'pay is terrible', 'compensation sucks'],
    type: 'compensation-concerns', severity: 'medium' },
  { keywords: ['no growth', 'no promotion', 'dead end', 'stagnant', 'no learning'],
    type: 'growth-stagnation', severity: 'medium' },
  { keywords: ['micromanage', 'micro-manage', 'terrible management', 'bad leadership', 'incompetent manager'],
    type: 'management-issues', severity: 'medium' },
  { keywords: ['great culture', 'love working', 'amazing team', 'best company', 'highly recommend'],
    type: 'positive-culture', severity: 'low' },
  { keywords: ['hiring', 'we\'re hiring', 'open positions', 'join our team', 'aggressive hiring'],
    type: 'hiring-surge', severity: 'low' },
  { keywords: ['hiring freeze', 'not hiring', 'paused hiring'],
    type: 'hiring-freeze', severity: 'medium' },
  { keywords: ['restructuring', 'reorganization', 'reorg', 'pivot'],
    type: 'restructuring', severity: 'medium' },
  { keywords: ['remote', 'work from home', 'WFH', 'hybrid', 'return to office', 'RTO'],
    type: 'remote-work-signal', severity: 'low' },
]

function extractSignalsKeyword(content: ClassifiedContent, _companyName: string): ExtractedSignal[] {
  const signals: ExtractedSignal[] = []
  const lower = content.text.toLowerCase()

  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      const idx = lower.indexOf(kw.toLowerCase())
      if (idx !== -1) {
        // Extract surrounding context as evidence
        const start = Math.max(0, idx - 50)
        const end = Math.min(content.text.length, idx + kw.length + 150)
        const evidence = content.text.substring(start, end).trim()

        signals.push({
          id: `sig-kw-${content.layer}-${Date.now()}-${signals.length}`,
          type: rule.type,
          severity: rule.severity,
          layer: content.layer,
          title: `${rule.type.replace(/-/g, ' ')} detected`,
          evidence,
          source: content.url,
          platform: content.platform,
          date: content.timestamp,
          speaker: null,
          confidence: content.confidence * 0.6, // keyword match = lower confidence
        })

        break // one match per rule per content
      }
    }
  }

  return signals
}
