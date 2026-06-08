/**
 * Pattern Detection Engine
 *
 * Combines individual signals into higher-order patterns.
 * A pattern = multiple signals from different sources pointing at the same conclusion.
 *
 * This is the PRODUCT — the thing that makes raw data into intelligence.
 *
 * Example patterns:
 *   L2 short tenure + L1 job reopened + L4 complaints → role_instability
 *   L3 burnout reviews + L4 reddit WLB complaints + L2 farewell posts → overwork_culture
 *   L1 "great culture" + L3 "toxic" + L4 "avoid" → narrative_collapse
 */

import type { ExtractedSignal, SignalType, Severity } from './signals'
import type { LayerID } from './classify'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DetectedPattern {
  id: string
  name: string
  description: string
  confidence: 'low' | 'medium' | 'medium-high' | 'high'
  severity: Severity
  layers: LayerID[]             // which layers contribute
  signalIds: string[]           // IDs of contributing signals
  signalCount: number
  category: PatternCategory
  implication: string           // what this means for a candidate
}

export type PatternCategory =
  | 'stability'        // job security, tenure
  | 'culture'          // work environment
  | 'leadership'       // management quality
  | 'compensation'     // pay and benefits
  | 'growth'           // career development
  | 'work-life'        // balance
  | 'trust'            // narrative vs reality
  | 'legal-risk'       // legal / compliance
  | 'financial-risk'   // company financial health
  | 'customer-impact'  // how they treat customers

export interface PatternAnalysis {
  patterns: DetectedPattern[]
  topRisks: DetectedPattern[]
  topStrengths: DetectedPattern[]
  crossLayerConfirmations: CrossLayerConfirmation[]
  narrativeMismatches: NarrativeMismatch[]
}

export interface CrossLayerConfirmation {
  finding: string
  layers: LayerID[]
  signalCount: number
  confidence: 'medium' | 'high'
}

export interface NarrativeMismatch {
  l1Claim: string
  realitySignal: string
  realityLayers: LayerID[]
  severity: Severity
}

// ─── Pattern definitions ─────────────────────────────────────────────────────

interface PatternRule {
  name: string
  description: string
  category: PatternCategory
  implication: string
  /** Signal types that contribute to this pattern */
  triggerSignals: SignalType[]
  /** Minimum number of contributing signals to detect */
  minSignals: number
  /** Bonus if signals come from multiple layers */
  crossLayerBonus: boolean
  /** Base severity if pattern is detected */
  baseSeverity: Severity
}

const PATTERN_RULES: PatternRule[] = [
  // ── Stability patterns ──
  {
    name: 'role-instability',
    description: 'Roles are reopened or refilled frequently, suggesting high turnover in specific positions',
    category: 'stability',
    implication: 'The role you\'re applying for may have retention issues. Ask about team tenure and why the position is open.',
    triggerSignals: ['short-tenure', 'role-instability', 'hiring-surge', 'restructuring'],
    minSignals: 2,
    crossLayerBonus: true,
    baseSeverity: 'medium',
  },
  {
    name: 'mass-layoff-pattern',
    description: 'Multiple layoff events or widespread reports of workforce reductions',
    category: 'stability',
    implication: 'Job security may be lower than average. Check if your department/team was affected.',
    triggerSignals: ['layoff-event', 'restructuring', 'hiring-freeze', 'financial-distress'],
    minSignals: 2,
    crossLayerBonus: true,
    baseSeverity: 'high',
  },

  // ── Culture patterns ──
  {
    name: 'toxic-culture-pattern',
    description: 'Multiple independent sources report toxic, hostile, or dysfunctional culture',
    category: 'culture',
    implication: 'Culture issues are structural, not isolated. Varies by team, but the pattern is widespread.',
    triggerSignals: ['toxic-culture', 'management-issues', 'work-life-imbalance'],
    minSignals: 3,
    crossLayerBonus: true,
    baseSeverity: 'high',
  },
  {
    name: 'healthy-culture-signal',
    description: 'Consistent positive signals about culture across multiple sources',
    category: 'culture',
    implication: 'Culture appears genuinely healthy based on multiple independent confirmations.',
    triggerSignals: ['positive-culture', 'transparency-signal', 'diversity-signal'],
    minSignals: 3,
    crossLayerBonus: true,
    baseSeverity: 'low',
  },

  // ── Leadership patterns ──
  {
    name: 'leadership-crisis',
    description: 'CEO/leadership changes combined with management complaints and restructuring',
    category: 'leadership',
    implication: 'Company is in transition. Direction may be uncertain. Expect changes in strategy and priorities.',
    triggerSignals: ['ceo-change', 'management-issues', 'restructuring'],
    minSignals: 2,
    crossLayerBonus: true,
    baseSeverity: 'high',
  },

  // ── Work-life patterns ──
  {
    name: 'overwork-culture',
    description: 'Consistent reports of long hours, burnout, and poor work-life balance',
    category: 'work-life',
    implication: 'Work-life balance is likely a challenge. Ask about on-call, weekend work, and average hours.',
    triggerSignals: ['work-life-imbalance', 'toxic-culture'],
    minSignals: 2,
    crossLayerBonus: true,
    baseSeverity: 'medium',
  },

  // ── Trust patterns ──
  {
    name: 'narrative-collapse',
    description: 'Large gap between what company claims (L1) and what employees/community report (L3-L6)',
    category: 'trust',
    implication: 'The company\'s public image doesn\'t match internal reality. Trust your deeper-layer findings.',
    triggerSignals: ['pr-disconnect', 'toxic-culture', 'management-issues', 'layoff-event'],
    minSignals: 2,
    crossLayerBonus: true,
    baseSeverity: 'high',
  },

  // ── Compensation patterns ──
  {
    name: 'compensation-gap',
    description: 'Reports of below-market pay, lack of raises, or compensation dissatisfaction',
    category: 'compensation',
    implication: 'Compensation may not be competitive. Research market rates and negotiate firmly.',
    triggerSignals: ['compensation-concerns', 'growth-stagnation'],
    minSignals: 2,
    crossLayerBonus: false,
    baseSeverity: 'medium',
  },

  // ── Growth patterns ──
  {
    name: 'career-dead-end',
    description: 'Multiple signals suggesting limited career growth and development opportunities',
    category: 'growth',
    implication: 'Career growth may plateau quickly. Ask about L&D budget, promotion timeline, and internal mobility.',
    triggerSignals: ['growth-stagnation', 'compensation-concerns'],
    minSignals: 2,
    crossLayerBonus: false,
    baseSeverity: 'medium',
  },

  // ── Legal/Financial risk ──
  {
    name: 'legal-risk-pattern',
    description: 'Active lawsuits, regulatory issues, or compliance failures',
    category: 'legal-risk',
    implication: 'Legal risks may affect company stability or reputation. Research specific cases.',
    triggerSignals: ['legal-issues', 'financial-distress'],
    minSignals: 1,
    crossLayerBonus: true,
    baseSeverity: 'high',
  },
  {
    name: 'financial-instability',
    description: 'Signs of financial distress including funding problems, debt, or revenue decline',
    category: 'financial-risk',
    implication: 'Financial stability may be at risk. Consider runway, profitability, and recent funding.',
    triggerSignals: ['financial-distress', 'layoff-event', 'restructuring'],
    minSignals: 2,
    crossLayerBonus: true,
    baseSeverity: 'critical',
  },

  // ── Customer impact ──
  {
    name: 'customer-exodus',
    description: 'Widespread customer complaints suggesting product or service decline',
    category: 'customer-impact',
    implication: 'How a company treats customers predicts how it treats employees. Watch for similar patterns internally.',
    triggerSignals: ['customer-complaints', 'pr-disconnect'],
    minSignals: 2,
    crossLayerBonus: false,
    baseSeverity: 'medium',
  },

  // ── M&A ──
  {
    name: 'acquisition-disruption',
    description: 'Recent or ongoing M&A activity with associated restructuring',
    category: 'stability',
    implication: 'Acquisitions create uncertainty: role overlaps, culture clashes, strategic pivots.',
    triggerSignals: ['acquisition-signal', 'restructuring', 'ceo-change', 'layoff-event'],
    minSignals: 2,
    crossLayerBonus: true,
    baseSeverity: 'medium',
  },
]

// ─── Main pattern detection ──────────────────────────────────────────────────

export function detectPatterns(signals: ExtractedSignal[]): PatternAnalysis {
  const patterns: DetectedPattern[] = []

  // Build a lookup: signal type → signals
  const signalsByType = new Map<SignalType, ExtractedSignal[]>()
  for (const sig of signals) {
    const existing = signalsByType.get(sig.type) || []
    existing.push(sig)
    signalsByType.set(sig.type, existing)
  }

  // Check each pattern rule
  for (const rule of PATTERN_RULES) {
    const matchingSignals: ExtractedSignal[] = []

    for (const triggerType of rule.triggerSignals) {
      const found = signalsByType.get(triggerType) || []
      matchingSignals.push(...found)
    }

    if (matchingSignals.length < rule.minSignals) continue

    // Calculate confidence
    const uniqueLayers = new Set(matchingSignals.map(s => s.layer))
    let confidence: DetectedPattern['confidence'] = 'low'

    if (matchingSignals.length >= rule.minSignals * 2 && uniqueLayers.size >= 3) {
      confidence = 'high'
    } else if (matchingSignals.length >= rule.minSignals * 1.5 || (rule.crossLayerBonus && uniqueLayers.size >= 2)) {
      confidence = 'medium-high'
    } else if (matchingSignals.length >= rule.minSignals) {
      confidence = 'medium'
    }

    // Severity escalation with more signals
    let severity = rule.baseSeverity
    if (matchingSignals.length >= rule.minSignals * 3) {
      severity = escalateSeverity(severity)
    }

    patterns.push({
      id: `pat-${rule.name}-${Date.now()}`,
      name: rule.name,
      description: rule.description,
      confidence,
      severity,
      layers: [...uniqueLayers],
      signalIds: matchingSignals.map(s => s.id),
      signalCount: matchingSignals.length,
      category: rule.category,
      implication: rule.implication,
    })
  }

  // Detect cross-layer confirmations
  const crossLayerConfirmations = detectCrossLayerConfirmations(signals)

  // Detect narrative mismatches (L1 vs L3-L6)
  const narrativeMismatches = detectNarrativeMismatches(signals)

  // Sort patterns by severity
  const severityOrder: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 }
  patterns.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity])

  // Split into risks and strengths
  const topRisks = patterns.filter(p =>
    p.severity === 'high' || p.severity === 'critical' ||
    (p.severity === 'medium' && p.confidence !== 'low')
  ).slice(0, 5)

  const topStrengths = patterns.filter(p =>
    p.category === 'culture' && p.name.includes('healthy') ||
    p.name.includes('positive')
  ).slice(0, 3)

  console.log(`[Patterns] Detected ${patterns.length} patterns, ${crossLayerConfirmations.length} cross-layer, ${narrativeMismatches.length} mismatches`)

  return {
    patterns,
    topRisks,
    topStrengths,
    crossLayerConfirmations,
    narrativeMismatches,
  }
}

// ─── Cross-layer confirmations ───────────────────────────────────────────────

function detectCrossLayerConfirmations(signals: ExtractedSignal[]): CrossLayerConfirmation[] {
  const confirmations: CrossLayerConfirmation[] = []

  // Group signals by type
  const byType = new Map<SignalType, ExtractedSignal[]>()
  for (const s of signals) {
    const existing = byType.get(s.type) || []
    existing.push(s)
    byType.set(s.type, existing)
  }

  // Find types with signals from 2+ layers
  for (const [type, sigs] of byType) {
    const layers = [...new Set(sigs.map(s => s.layer))]
    if (layers.length >= 2) {
      confirmations.push({
        finding: `"${type.replace(/-/g, ' ')}" confirmed across ${layers.length} independent layers`,
        layers: layers as LayerID[],
        signalCount: sigs.length,
        confidence: layers.length >= 3 ? 'high' : 'medium',
      })
    }
  }

  return confirmations
}

// ─── Narrative mismatches ────────────────────────────────────────────────────

function detectNarrativeMismatches(signals: ExtractedSignal[]): NarrativeMismatch[] {
  const mismatches: NarrativeMismatch[] = []

  const l1Signals = signals.filter(s => s.layer === 'L1')
  const deepSignals = signals.filter(s => ['L3', 'L4', 'L5', 'L6'].includes(s.layer))

  // Check for positive L1 + negative deeper layers
  const l1Positive = l1Signals.filter(s =>
    s.type === 'positive-culture' || s.type === 'hiring-surge' || s.type === 'transparency-signal'
  )

  const deepNegative = deepSignals.filter(s =>
    s.type === 'toxic-culture' || s.type === 'management-issues' ||
    s.type === 'work-life-imbalance' || s.type === 'layoff-event' ||
    s.type === 'compensation-concerns'
  )

  if (l1Positive.length > 0 && deepNegative.length >= 2) {
    const deepLayers = [...new Set(deepNegative.map(s => s.layer))] as LayerID[]
    mismatches.push({
      l1Claim: l1Positive[0]?.evidence || 'Positive culture claims on company website',
      realitySignal: deepNegative.map(s => s.title).slice(0, 3).join('; '),
      realityLayers: deepLayers,
      severity: deepNegative.length >= 4 ? 'critical' : deepNegative.length >= 3 ? 'high' : 'medium',
    })
  }

  return mismatches
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escalateSeverity(current: Severity): Severity {
  const levels: Severity[] = ['low', 'medium', 'high', 'critical']
  const idx = levels.indexOf(current)
  return idx < levels.length - 1 ? levels[idx + 1] : current
}
