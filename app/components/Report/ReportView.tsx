'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ReportData,
  LayerOverview as LayerOverviewType,
  NarrativeMismatch as NarrativeMismatchType,
  CrossLayerInsight as CrossLayerInsightType,
  L3Review,
  L4Discussion,
  L5Complaint,
  L6Event,
  PatternTimeline as PatternTimelineType,
  RiskRewardItem,
  First90Days as First90DaysType,
  Checklist as ChecklistType,
  QuestionCategory,
  YouTubeEvidence as YouTubeEvidenceType,
  InterviewIntelligence as InterviewIntelligenceType,
  EvidenceSection,
  RiskLevel,
  LayerId,
} from './types'
import './Report.scss'

// ============================================================================
// LAYER COLORS & CONFIG
// ============================================================================
const LAYER_CONFIG: Record<LayerId, { color: string; bg: string; label: string; icon: string }> = {
  L1: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', label: 'Company Claims', icon: '🏢' },
  L2: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', label: 'Public Professional Signals', icon: '💼' },
  L3: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', label: 'Employee Voices', icon: '💬' },
  L4: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', label: 'Community Discussions', icon: '🌐' },
  L5: { color: '#ec4899', bg: 'rgba(236,72,153,0.08)', label: 'User Feedback', icon: '⚡' },
  L6: { color: '#1a1d23', bg: 'rgba(26,29,35,0.08)', label: 'Public Events', icon: '📰' },
}

function cleanPublicText(text: string): string {
  let result = text
    .replace(/\bL1\b/g, 'company claims')
    .replace(/\bL2\b/g, 'public professional signals')
    .replace(/\bL3\b/g, 'employee voices')
    .replace(/\bL4\b/g, 'community discussions')
    .replace(/\bL5\b/g, 'user feedback')
    .replace(/\bL6\b/g, 'public events')
    .replace(/6-layer intelligence report/gi, 'company risk report')
    .replace(/6-layer risk profile/gi, 'company risk profile')
    .replace(/\blayer\b/gi, 'source area')
  // Capitalize first letter of the string
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1)
  }
  return result
}

function riskClass(level: RiskLevel | string): string {
  if (level === 'critical') return 'risk--critical'
  if (level === 'high') return 'risk--high'
  if (level === 'medium') return 'risk--medium'
  return 'risk--low'
}

// ============================================================================
// COLLAPSIBLE SECTION WRAPPER
// ============================================================================
function CollapsibleSection({
  id,
  title,
  subtitle,
  defaultOpen = false,
  badge,
  children,
}: {
  id?: string
  title: string
  subtitle?: string
  defaultOpen?: boolean
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <div id={id} className={`collapsible ${isOpen ? 'collapsible--open' : ''}`}>
      <button className="collapsible__trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="collapsible__trigger-left">
          <span className={`collapsible__chevron ${isOpen ? 'collapsible__chevron--open' : ''}`}>›</span>
          <div>
            <span className="collapsible__title">{title}</span>
            {subtitle && <span className="collapsible__subtitle">{subtitle}</span>}
          </div>
        </div>
        {badge && <div className="collapsible__badge">{badge}</div>}
      </button>
      <div
        ref={contentRef}
        className="collapsible__content"
        style={{ display: isOpen ? 'block' : 'none' }}
      >
        <div className="collapsible__inner">{children}</div>
      </div>
    </div>
  )
}

// ============================================================================
// STICKY TABLE OF CONTENTS
// ============================================================================
function TableOfContents({ activeSection }: { activeSection: string }) {
  const sections = [
    { id: 'verdict', label: 'Verdict', icon: '🎯' },
    { id: 'decision', label: 'Decision Support', icon: '🧭' },
    { id: 'layers', label: 'Evidence Overview', icon: '📊' },
    { id: 'mismatches', label: 'Narrative vs Reality', icon: '🔍' },
    { id: 'insights', label: 'Cross-source', icon: '🔗' },
    { id: 'timeline', label: 'Patterns', icon: '📈' },
    { id: 'layer-L1', label: 'Company Claims', icon: '🏢' },
    { id: 'layer-L2', label: 'Public Signals', icon: '💼' },
    { id: 'layer-L3', label: 'Employee Voices', icon: '💬' },
    { id: 'layer-L4', label: 'Community', icon: '🌐' },
    { id: 'layer-L5', label: 'User Feedback', icon: '⚡' },
    { id: 'layer-L6', label: 'Public Events', icon: '📰' },
    { id: 'tradeoffs', label: 'Trade-offs', icon: '⚖️' },
    { id: 'actionable', label: 'Action Items', icon: '✅' },
    { id: 'final-verdict', label: 'Would We Join?', icon: '🧾' },
    { id: 'sources', label: 'Sources', icon: '📋' },
  ]

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className="toc">
      {sections.map((s) => (
        <button
          key={s.id}
          className={`toc__item ${activeSection === s.id ? 'toc__item--active' : ''}`}
          onClick={() => scrollTo(s.id)}
          title={s.label}
        >
          <span className="toc__icon">{s.icon}</span>
          <span className="toc__label">{s.label}</span>
        </button>
      ))}
    </nav>
  )
}

// ============================================================================
// VERDICT BANNER — Hero-sized, scannable verdict
// ============================================================================
function VerdictBanner({ verdict, companyName }: { verdict: ReportData['verdict']; companyName: string }) {
  const bgClass = verdict.type === 'green' ? 'verdict--green' :
                  verdict.type === 'yellow' ? 'verdict--yellow' : 'verdict--red'
  return (
    <div id="verdict" className={`verdict-banner ${bgClass}`}>
      <div className="verdict-banner__hero">
        <span className="verdict-banner__emoji">{verdict.emoji}</span>
        <div className="verdict-banner__headline">
          <h2 className="verdict-banner__title">{cleanPublicText(verdict.title)}</h2>
          <p className="verdict-banner__oneliner">{cleanPublicText(verdict.oneLiner)}</p>
        </div>
        <div className={`verdict-banner__risk-badge ${riskClass(verdict.riskLevel.toLowerCase())}`}>
          {verdict.riskLevel}
        </div>
      </div>
      <p className="verdict-banner__context">
        This assessment is adapted to your profile. The same company can be stable for one person and risky for another.
      </p>
      <div className="verdict-banner__key-points">
        {verdict.bullets.map((b, i) => (
          <div key={i} className="verdict-banner__point">
            <span className="verdict-banner__point-num">{i + 1}</span>
            <span>{cleanPublicText(b)}</span>
          </div>
        ))}
      </div>
      {/* Layer confidence indicators */}
      {verdict.layerConfidence && verdict.layerConfidence.length > 0 && (
        <div className="verdict-banner__layers">
          <span className="verdict-banner__layers-label">Data confidence by source area</span>
          <div className="verdict-banner__layers-grid">
            {verdict.layerConfidence.map((lc) => (
              <div key={lc.layer} className="layer-confidence">
                <span
                  className="layer-confidence__dot"
                  style={{ backgroundColor: LAYER_CONFIG[lc.layer]?.color }}
                />
                <span className="layer-confidence__label">{LAYER_CONFIG[lc.layer]?.label}</span>
                <div className="layer-confidence__bar">
                  <div
                    className="layer-confidence__fill"
                    style={{
                      width: `${lc.score}%`,
                      backgroundColor: LAYER_CONFIG[lc.layer]?.color,
                    }}
                  />
                </div>
                <span className="layer-confidence__pct">{lc.score}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

type DecisionRiskLabel = 'Very Low' | 'Low' | 'Medium' | 'Medium-High' | 'High' | 'Critical'

function riskToScore(risk: string): number {
  const v = risk.toLowerCase()
  if (v.includes('critical')) return 6
  if (v.includes('high')) return 5
  if (v.includes('medium') && v.includes('high')) return 4
  if (v.includes('medium')) return 3
  if (v.includes('low') && v.includes('very')) return 1
  if (v.includes('low')) return 2
  return 3
}

function scoreToRisk(score: number): DecisionRiskLabel {
  if (score >= 6) return 'Critical'
  if (score >= 5) return 'High'
  if (score >= 4) return 'Medium-High'
  if (score >= 3) return 'Medium'
  if (score >= 2) return 'Low'
  return 'Very Low'
}

function decisionRiskClass(label: DecisionRiskLabel): string {
  if (label === 'Critical') return 'risk--critical'
  if (label === 'High' || label === 'Medium-High') return 'risk--high'
  if (label === 'Medium') return 'risk--medium'
  return 'risk--low'
}

function deriveDominantRisk(risks: { area: string; score: number }[]): string {
  const top = [...risks].sort((a, b) => b.score - a.score)[0]
  if (!top) return 'mixed operational signals'
  return top.area.toLowerCase()
}

function DecisionSupportSection({ data }: { data: ReportData }) {
  const l2Score = riskToScore(data.layerOverviews.find(l => l.id === 'L2')?.riskLevel || 'medium')
  const l3Score = riskToScore(data.layerOverviews.find(l => l.id === 'L3')?.riskLevel || 'medium')
  const l4Score = riskToScore(data.layerOverviews.find(l => l.id === 'L4')?.riskLevel || 'medium')
  const l5Score = riskToScore(data.layerOverviews.find(l => l.id === 'L5')?.riskLevel || 'medium')
  const l6Score = riskToScore(data.layerOverviews.find(l => l.id === 'L6')?.riskLevel || 'medium')

  const areaRisks = [
    { area: 'Layoffs', score: Math.min(6, l6Score + (data.l6.events.length > 0 ? 1 : 0)) },
    { area: 'Burnout', score: Math.max(2, Math.round((l2Score + l3Score) / 2)) },
    { area: 'Toxic Culture', score: Math.max(1, Math.round((l3Score + l4Score - 1) / 2)) },
    { area: 'Compensation', score: Math.max(1, Math.round((l1Score(data) + l5Score - 3) / 2)) },
    { area: 'Learning & Growth', score: Math.max(1, Math.round((l2Score + 1) / 2)) },
    { area: 'Leadership Stability', score: Math.max(2, Math.round((l2Score + l6Score) / 2)) },
    { area: 'Work-Life Balance', score: Math.max(2, Math.round((l2Score + l3Score + l4Score) / 3)) },
  ]

  const dominantRisk = deriveDominantRisk(areaRisks)
  const overallRisk = data.verdict.riskLevel
  const company = data.companyName
  const stabilityLabel = scoreToRisk(Math.round((l3Score + l6Score + l2Score) / 3))

  return (
    <div id="decision" className="decision-support">
      <h3 className="section-title">Bottom Line</h3>
      <p className="decision-support__bottom-line">
        {company} remains a strong option for candidates optimizing for learning, compensation, and career capital.
        Compared to its historical reputation, the main risk is reduced predictability driven by restructuring pressure
        and changing performance expectations. If your priority is growth and brand leverage, this can still be a
        strong move. If your priority is maximum stability, evaluate team-level conditions before accepting.
      </p>

      <div className="decision-support__grid">
        <div className="decision-card">
          <h4>What "{overallRisk}" Actually Means</h4>
          <div className="risk-translation-table">
            <div className="risk-translation-table__head">
              <span>Area</span>
              <span>Risk</span>
            </div>
            {areaRisks.map((r) => (
              <div key={r.area} className="risk-translation-table__row">
                <span>{r.area}</span>
                <span className={`risk-chip ${decisionRiskClass(scoreToRisk(r.score))}`}>{scoreToRisk(r.score)}</span>
              </div>
            ))}
          </div>
          <p className="decision-card__note">
            Dominant risk driver: {dominantRisk}. Most downside signals point to organizational change and internal
            competition more than universally toxic culture.
          </p>
        </div>

        <div className="decision-card">
          <h4>Recommendation</h4>
          <div className="fit-list">
            <strong>Good fit if:</strong>
            <ul>
              <li>You prioritize learning and long-term career capital.</li>
              <li>You value strong resume signaling and mobility.</li>
              <li>You can operate in competitive, performance-driven teams.</li>
              <li>You are comfortable with periodic org changes.</li>
            </ul>
          </div>
          <div className="fit-list fit-list--caution">
            <strong>Think twice if:</strong>
            <ul>
              <li>You need maximum short-term job security.</li>
              <li>You require highly predictable workload cycles.</li>
              <li>You want low-ambiguity environments and stable org charts.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="decision-support__grid">
        <div className="decision-card">
          <h4>Relative Position</h4>
          <div className="risk-translation-table">
            <div className="risk-translation-table__head">
              <span>Company</span>
              <span>Stability</span>
            </div>
            <div className="risk-translation-table__row"><span>Microsoft</span><span>Higher</span></div>
            <div className="risk-translation-table__row"><span>{company}</span><span>{stabilityLabel}</span></div>
            <div className="risk-translation-table__row"><span>Meta</span><span>Medium</span></div>
            <div className="risk-translation-table__row"><span>Amazon</span><span>Lower</span></div>
            <div className="risk-translation-table__row"><span>Early-stage startup</span><span>Much Lower</span></div>
          </div>
        </div>

        <div className="decision-card">
          <h4>If You Receive an Offer</h4>
          <ul className="offer-questions">
            <li>Has this specific team been affected by layoffs in the last 12 months?</li>
            <li>What changed in team scope, leadership, or roadmap recently?</li>
            <li>How are performance and promotion calibrated on this team?</li>
            <li>What percentage of this team changed in the last year?</li>
            <li>What does success in the first 6 months actually look like?</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function l1Score(data: ReportData): number {
  const raw = data.l1.surfaceCoverage || 50
  if (raw >= 75) return 2
  if (raw >= 50) return 3
  return 4
}

function FinalVerdictSection({ data }: { data: ReportData }) {
  const risk = riskToScore(data.verdict.riskLevel)
  const decision = risk <= 2 ? 'YES' : risk <= 4 ? 'YES, WITH CONDITIONS' : 'ONLY IF TRADEOFFS FIT'
  const company = data.companyName

  return (
    <div id="final-verdict" className="final-verdict-card">
      <h3 className="section-title">Final Verdict</h3>
      <div className="final-verdict-card__headline">Would We Join? <span>{decision}</span></div>
      <p>
        {company} can still be a strong career accelerator for candidates who optimize for growth, brand, and
        long-term optionality. The main caution is stability risk from restructuring cycles and evolving performance
        expectations. Validate team-specific conditions before accepting if predictability matters most to you.
      </p>
    </div>
  )
}

// ============================================================================
// LAYER DASHBOARD (6 overview cards) — Quick-scan grid
// ============================================================================
function LayerDashboard({
  overviews,
  onLayerClick,
}: {
  overviews: LayerOverviewType[]
  onLayerClick: (id: LayerId) => void
}) {
  return (
    <div id="layers" className="layer-dashboard">
      <h3 className="section-title">Evidence Overview</h3>
      <p className="section-desc">Click any source area to jump to its details</p>
      <div className="layer-dashboard__grid">
        {overviews.map((lo) => {
          const cfg = LAYER_CONFIG[lo.id]
          return (
            <button
              key={lo.id}
              className="layer-card"
              style={{ borderLeftColor: cfg.color }}
              onClick={() => onLayerClick(lo.id)}
            >
              <div className="layer-card__top">
                <span className="layer-card__icon">{lo.icon}</span>
                <span className={`layer-card__risk ${riskClass(lo.riskLevel)}`}>
                  {lo.riskLevel}
                </span>
              </div>
              <h4 className="layer-card__name">{cfg.label}</h4>
              <p className="layer-card__finding">{cleanPublicText(lo.keyFinding)}</p>
              <div className="layer-card__footer">
                <span className="layer-card__sources">{lo.sourceCount} sources</span>
                <div className="layer-card__confidence-bar">
                  <div
                    className="layer-card__confidence-fill"
                    style={{ width: `${lo.confidence}%`, backgroundColor: cfg.color }}
                  />
                </div>
                <span className="layer-card__confidence-pct">{lo.confidence}%</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// NARRATIVE MISMATCH PANEL (L1 vs reality — the killer feature)
// ============================================================================
function NarrativeMismatchPanel({ mismatches }: { mismatches: NarrativeMismatchType[] }) {
  if (!mismatches || mismatches.length === 0) return null

  const criticalCount = mismatches.filter(m => m.severity === 'high' || m.severity === 'critical').length

  return (
    <div id="mismatches">
      <CollapsibleSection
        title="Narrative vs Reality"
        subtitle={`${mismatches.length} gaps found${criticalCount > 0 ? ` · ${criticalCount} critical` : ''}`}
        defaultOpen={true}
        badge={criticalCount > 0 ? <span className="badge badge--danger">{criticalCount} ⚠️</span> : undefined}
      >
      <div className="mismatch-panel__list">
        {mismatches.map((m) => (
          <div key={m.id} className={`mismatch-card mismatch-card--${m.severity}`}>
            <div className="mismatch-card__icon">{m.icon}</div>
            <div className="mismatch-card__content">
              <div className="mismatch-card__claim">
                <span className="mismatch-label mismatch-label--claim">They claim</span>
                <p>{cleanPublicText(m.companyClaims)}</p>
              </div>
              <div className="mismatch-card__arrow">↕</div>
              <div className="mismatch-card__reality">
                <span className="mismatch-label mismatch-label--reality">Evidence shows</span>
                <p>{cleanPublicText(m.realityShows)}</p>
              </div>
              <div className="mismatch-card__meta">
                <span className={`mismatch-severity ${riskClass(m.severity)}`}>
                  {m.severity} mismatch
                </span>
                <span className="mismatch-layers">
                  {m.sourceLayers.map((l) => (
                    <span
                      key={l}
                      className="mismatch-layer-tag"
                      style={{ backgroundColor: LAYER_CONFIG[l]?.bg, color: LAYER_CONFIG[l]?.color }}
                    >
                      {LAYER_CONFIG[l]?.label}
                    </span>
                  ))}
                </span>
              </div>
              <p className="mismatch-card__evidence">{cleanPublicText(m.evidence)}</p>
            </div>
          </div>
        ))}
      </div>
      </CollapsibleSection>
    </div>
  )
}

// ============================================================================
// CROSS-LAYER INSIGHTS
// ============================================================================
function CrossLayerInsights({ insights }: { insights: CrossLayerInsightType[] }) {
  if (!insights || insights.length === 0) return null

  return (
    <div id="insights">
      <CollapsibleSection
        title="Cross-source Insights"
        subtitle={`${insights.length} patterns where multiple source areas align`}
        defaultOpen={false}
      >
      <div className="cross-insights__list">
        {insights.map((ins) => (
          <div key={ins.id} className={`insight-card insight-card--${ins.confidence}`}>
            <div className="insight-card__header">
              <span className={`insight-card__risk ${riskClass(ins.riskLevel)}`}>
                {ins.riskLevel}
              </span>
              <span className={`insight-card__confidence`}>
                {ins.confidence} confidence
              </span>
            </div>
            <h4 className="insight-card__title">{cleanPublicText(ins.title)}</h4>
            <p className="insight-card__desc">{cleanPublicText(ins.description)}</p>
            <div className="insight-card__layers">
              {ins.supportingLayers.map((l) => (
                <span
                  key={l}
                  className="layer-tag"
                  style={{ backgroundColor: LAYER_CONFIG[l]?.bg, color: LAYER_CONFIG[l]?.color }}
                >
                  {LAYER_CONFIG[l]?.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      </CollapsibleSection>
    </div>
  )
}

// ============================================================================
// L1 SECTION — Official Narrative
// ============================================================================
function L1Section({ data }: { data: ReportData['l1'] }) {
  const corePages = data.coreWebProperties ? Object.entries(data.coreWebProperties).filter(([, v]) => v?.found) : []
  const hasSocial = data.socialBrandAccounts && data.socialBrandAccounts.length > 0
  const hasHiring = data.hiringSurfaces && data.hiringSurfaces.length > 0
  const hasLegal = data.legalSurfaces && Object.values(data.legalSurfaces).some(v => v?.found)

  return (
    <div className="layer-section layer-section--L1">
      <div className="layer-section__header" style={{ borderLeftColor: LAYER_CONFIG.L1.color }}>
        <span className="layer-section__tag" style={{ backgroundColor: LAYER_CONFIG.L1.bg, color: LAYER_CONFIG.L1.color }}>{LAYER_CONFIG.L1.icon}</span>
        <div>
          <h3 className="layer-section__title">Company Claims</h3>
          <p className="layer-section__desc">What the company wants you to believe</p>
        </div>
      </div>

      {/* Summary first — always visible */}
      <p className="layer-section__summary-top">{cleanPublicText(data.summary)}</p>

      {data.companyDomain && (
        <div className="l1-domain">🌐 {data.companyDomain}</div>
      )}

      {/* Surface coverage indicator */}
      {data.surfacesScanned > 0 && (
        <div className="l1-coverage">
          <div className="l1-coverage__bar">
            <div className="l1-coverage__fill" style={{ width: `${data.surfaceCoverage || 0}%` }} />
          </div>
          <span className="l1-coverage__text">
            {data.surfacesFound}/{data.surfacesScanned} surfaces found ({data.surfaceCoverage || 0}%)
          </span>
        </div>
      )}

      {data.missionStatement && (
        <blockquote className="l1-mission">&quot;{data.missionStatement}&quot;</blockquote>
      )}

      {data.claimedValues.length > 0 && (
        <div className="l1-values">
          <h4>Claimed Values</h4>
          <div className="tag-list">
            {data.claimedValues.map((v, i) => (
              <span key={i} className="tag tag--L1">{v}</span>
            ))}
          </div>
        </div>
      )}

      {data.benefitsClaims.length > 0 && (
        <div className="l1-benefits">
          <h4>Benefits Claims</h4>
          <ul>
            {data.benefitsClaims.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      )}

      {/* Detailed breakdown — collapsible */}
      {(corePages.length > 0 || hasSocial || hasHiring || hasLegal || data.cultureKeywords.length > 0) && (
        <CollapsibleSection title="Detailed Breakdown" subtitle={`${corePages.length} pages, ${data.socialBrandAccounts?.length || 0} social accounts`}>
          {corePages.length > 0 && (
            <div className="l1-surfaces">
              <h4>Core Web Properties Found</h4>
              <div className="tag-list">
                {corePages.map(([key]) => (
                  <span key={key} className="tag tag--L1">{key.replace(/Page$/, '').replace(/([A-Z])/g, ' $1').trim()}</span>
                ))}
              </div>
            </div>
          )}

          {data.cultureKeywords.length > 0 && (
            <div className="l1-culture">
              <h4>Culture Keywords Detected</h4>
              <div className="tag-list">
                {data.cultureKeywords.map((k, i) => (
                  <span key={i} className="tag tag--muted">{k}</span>
                ))}
              </div>
            </div>
          )}

          {hasSocial && (
            <div className="l1-social">
              <h4>Official Social Brand Accounts</h4>
              <div className="tag-list">
                {data.socialBrandAccounts.map((s, i) => (
                  <span key={i} className="tag tag--L1" title={s.tone}>
                    {s.platform}: @{s.handle}
                  </span>
                ))}
              </div>
            </div>
          )}

          {hasHiring && (
            <div className="l1-hiring">
              <h4>Hiring Surfaces Detected</h4>
              <div className="tag-list">
                {data.hiringSurfaces.map((h, i) => (
                  <span key={i} className="tag tag--muted">{h.platform}{h.jobCount > 0 ? ` (${h.jobCount} jobs)` : ''}</span>
                ))}
              </div>
            </div>
          )}

          {hasLegal && (
            <div className="l1-legal">
              <h4>Legal & Compliance Surfaces</h4>
              <div className="tag-list">
                {Object.entries(data.legalSurfaces).filter(([, v]) => v?.found).map(([key]) => (
                  <span key={key} className="tag tag--muted">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                ))}
              </div>
            </div>
          )}
        </CollapsibleSection>
      )}

      {data.changeDetection.length > 0 && (
        <div className="l1-changes">
          <h4>🔄 Changes Detected</h4>
          {data.changeDetection.map((c, i) => (
            <div key={i} className={`change-item change-item--${c.significance}`}>
              <span className="change-when">{c.when}</span>
              <span className="change-what">{c.what}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// L2 SECTION — Professional Behavior
// ============================================================================
function L2Section({ data }: { data: ReportData['l2'] }) {
  const [showAllSignals, setShowAllSignals] = useState(false)
  const [showAllDev, setShowAllDev] = useState(false)
  const hasData = data.signals.length > 0 || data.devSignals?.length > 0 || data.behavioralPatterns.length > 0
  const visibleSignals = showAllSignals ? data.signals : data.signals.slice(0, 5)
  const visibleDev = showAllDev ? (data.devSignals || []) : (data.devSignals || []).slice(0, 3)

  const toneEmojis: Record<string, string> = {
    promotional: '📢', defensive: '🛡️', authentic: '💚', empathetic: '🤝',
    silence: '🤫', critical: '⚠️', celebratory: '🎉', reflective: '🤔',
    frustrated: '😤', neutral: '➡️', farewell: '👋', desperate: '🆘',
    analytical: '🔬', whistleblower: '📣',
  }

  return (
    <div className="layer-section layer-section--L2">
      <div className="layer-section__header" style={{ borderLeftColor: LAYER_CONFIG.L2.color }}>
        <span className="layer-section__tag" style={{ backgroundColor: LAYER_CONFIG.L2.bg, color: LAYER_CONFIG.L2.color }}>{LAYER_CONFIG.L2.icon}</span>
        <div>
          <h3 className="layer-section__title">Professional Behavior</h3>
          <p className="layer-section__desc">How people behave when reputations are on the line</p>
        </div>
      </div>

      {/* Summary first */}
      <p className="layer-section__summary-top">{cleanPublicText(data.summary)}</p>

      {!hasData ? (
        <div className="layer-section__empty">
          <span className="empty-icon">🔒</span>
          <p>Limited data available for this layer.</p>
        </div>
      ) : (
        <>
          {/* Behavioral Patterns — most important, always visible */}
          {data.behavioralPatterns.length > 0 && (
            <div className="l2-patterns">
              <h4>Key Behavioral Patterns</h4>
              {data.behavioralPatterns.map((bp, i) => (
                <div key={i} className={`pattern-item pattern-item--${bp.risk}`}>
                  <strong>{bp.pattern}</strong>
                  <p>{bp.interpretation}</p>
                </div>
              ))}
            </div>
          )}

          {/* Tone Analysis — visual, compact */}
          {data.toneBreakdown && data.toneBreakdown.length > 0 && (
            <div className="l2-tone">
              <h4>Tone Analysis</h4>
              <div className="l2-tone__chart">
                {data.toneBreakdown.filter(t => t.count > 0).map((t, i) => (
                  <div key={i} className="l2-tone-bar">
                    <div className="l2-tone-bar__label">
                      <span>{toneEmojis[t.tone] || '🔸'}</span>
                      <span>{t.tone}</span>
                    </div>
                    <div className="l2-tone-bar__track">
                      <div className="l2-tone-bar__fill" style={{ width: `${Math.min(t.percentage, 100)}%` }}></div>
                    </div>
                    <span className="l2-tone-bar__pct">{t.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Silence Events */}
          {data.silenceEvents.length > 0 && (
            <div className="l2-silence">
              <h4>🤫 Silence Events</h4>
              <ul>
                {data.silenceEvents.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {/* Detailed Signals — collapsible */}
          {data.signals.length > 0 && (
            <CollapsibleSection title={`All Signals (${data.signals.length})`} subtitle="Individual data points from professional surfaces">
              {visibleSignals.map((sig, i) => (
                <div key={sig.id || i} className="signal-item">
                  <div className="signal-item__meta">
                    <span className="signal-platform">{sig.platform}</span>
                    {sig.tone && <span className={`signal-tone signal-tone--${sig.tone}`}>{toneEmojis[sig.tone as string] || '🔸'} {sig.tone}</span>}
                    {sig.date && <span className="signal-date">{sig.date}</span>}
                  </div>
                  {sig.author && <span className="signal-author">by {sig.author}</span>}
                  <p>{cleanPublicText(sig.summary)}</p>
                  {sig.url && <a href={sig.url} target="_blank" rel="noopener noreferrer" className="signal-url">View source ↗</a>}
                </div>
              ))}
              {data.signals.length > 5 && (
                <button className="show-more-btn" onClick={() => setShowAllSignals(!showAllSignals)}>
                  {showAllSignals ? 'Show less' : `Show all ${data.signals.length} signals`}
                </button>
              )}
            </CollapsibleSection>
          )}

          {/* Dev Signals — collapsible */}
          {(data.devSignals?.length ?? 0) > 0 && (
            <CollapsibleSection title={`Developer Signals (${data.devSignals!.length})`}>
              {visibleDev.map((ds, i) => (
                <div key={i} className="dev-signal-item">
                  <div className="dev-signal-item__header">
                    <span className="dev-signal-platform">{ds.platform}</span>
                    <span className="dev-signal-type">{ds.type}</span>
                    {ds.reactions > 0 && <span className="dev-signal-reactions">👍 {ds.reactions}</span>}
                  </div>
                  <strong className="dev-signal-title">
                    {ds.url ? <a href={ds.url} target="_blank" rel="noopener noreferrer">{ds.title}</a> : ds.title}
                  </strong>
                  <p className="dev-signal-snippet">{ds.snippet}</p>
                </div>
              ))}
              {(data.devSignals?.length ?? 0) > 3 && (
                <button className="show-more-btn" onClick={() => setShowAllDev(!showAllDev)}>
                  {showAllDev ? 'Show less' : `Show all ${data.devSignals!.length} dev signals`}
                </button>
              )}
            </CollapsibleSection>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================================
// L3 SECTION — Employee Leakage
// ============================================================================
function L3Section({ data }: { data: ReportData['l3'] }) {
  const [showAll, setShowAll] = useState(false)
  const [expandedReview, setExpandedReview] = useState<string | null>(null)
  const visibleReviews = showAll ? data.reviews : data.reviews.slice(0, 4)

  return (
    <div className="layer-section layer-section--L3">
      <div className="layer-section__header" style={{ borderLeftColor: LAYER_CONFIG.L3.color }}>
        <span className="layer-section__tag" style={{ backgroundColor: LAYER_CONFIG.L3.bg, color: LAYER_CONFIG.L3.color }}>{LAYER_CONFIG.L3.icon}</span>
        <div>
          <h3 className="layer-section__title">Employee &amp; Candidate Voices</h3>
          <p className="layer-section__desc">First-hand internal experience from people who were there</p>
        </div>
      </div>

      {/* Summary first */}
      <p className="layer-section__summary-top">{cleanPublicText(data.summary)}</p>

      {/* Repeating Patterns — most important */}
      {data.repeatingPatterns.length > 0 && (
        <div className="l3-patterns">
          <h4>Repeating Patterns</h4>
          {data.repeatingPatterns.map((rp, i) => (
            <div key={i} className={`pattern-item pattern-item--${rp.severity}`}>
              <strong>{rp.pattern}</strong>
              <span className="pattern-freq">Mentioned {rp.frequency}× across sources</span>
            </div>
          ))}
        </div>
      )}

      {/* Emotional Mode Breakdown — compact bar chart */}
      {data.emotionalModeBreakdown.length > 0 && (
        <div className="l3-emotions">
          <h4>Emotional Patterns</h4>
          <div className="emotion-bars">
            {data.emotionalModeBreakdown.map((em, i) => (
              <div key={i} className="emotion-bar">
                <span className="emotion-bar__label">{em.mode}</span>
                <div className="emotion-bar__track">
                  <div className="emotion-bar__fill" style={{ width: `${em.percentage}%` }} />
                </div>
                <span className="emotion-bar__pct">{em.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Management Risk Signals */}
      {data.managementRiskSignals.length > 0 && (
        <div className="l3-mgmt-risk">
          <h4>⚠️ Management Risk Signals</h4>
          <ul>
            {data.managementRiskSignals.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* Reviews — collapsible list */}
      {data.reviews.length > 0 && (
        <CollapsibleSection title={`Employee Voices (${data.reviews.length})`} subtitle="Click a review to expand">
          <div className="review-list">
            {visibleReviews.map((r: L3Review) => (
              <div
                key={r.id}
                className={`review-card review-card--${r.sentiment} ${expandedReview === r.id ? 'review-card--expanded' : ''}`}
                onClick={() => setExpandedReview(expandedReview === r.id ? null : r.id)}
              >
                <div className="review-card__header">
                  <span className="review-card__source">{r.sourceIcon} {r.source}</span>
                  {r.role && <span className="review-card__role">{r.role}</span>}
                  <span className="review-card__date">{r.date}</span>
                  {r.rating && <span className="review-card__rating">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>}
                </div>
                <blockquote className="review-card__quote">&quot;{r.quote}&quot;</blockquote>

                {expandedReview === r.id && r.prosAndCons && (
                  <div className="review-card__pros-cons">
                    <div className="pros">
                      <strong>✅ Pros:</strong>
                      <ul>{r.prosAndCons.pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
                    </div>
                    <div className="cons">
                      <strong>❌ Cons:</strong>
                      <ul>{r.prosAndCons.cons.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </div>
                  </div>
                )}

                <div className="review-card__footer">
                  <span className="review-card__theme">🏷️ {r.theme}</span>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="review-card__link" onClick={e => e.stopPropagation()}>
                      View original →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          {data.reviews.length > 4 && (
            <button className="show-more-btn" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show less' : `Show all ${data.reviews.length} reviews`}
            </button>
          )}
        </CollapsibleSection>
      )}
    </div>
  )
}

// ============================================================================
// L4 SECTION — Community Reality
// ============================================================================
function L4Section({ data }: { data: ReportData['l4'] }) {
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all')
  const [showReplies, setShowReplies] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  const filtered = data.discussions.filter((d) => {
    return filter === 'all' || d.sentiment === filter
  })
  const visible = showAll ? filtered : filtered.slice(0, 5)

  const toggleReplies = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const next = new Set(showReplies)
    next.has(id) ? next.delete(id) : next.add(id)
    setShowReplies(next)
  }

  return (
    <div className="layer-section layer-section--L4">
      <div className="layer-section__header" style={{ borderLeftColor: LAYER_CONFIG.L4.color }}>
        <span className="layer-section__tag" style={{ backgroundColor: LAYER_CONFIG.L4.bg, color: LAYER_CONFIG.L4.color }}>{LAYER_CONFIG.L4.icon}</span>
        <div>
          <h3 className="layer-section__title">Community &amp; Peer Reality</h3>
          <p className="layer-section__desc">What people say when no one from the company is in the room</p>
        </div>
      </div>

      {/* Summary first */}
      <p className="layer-section__summary-top">{cleanPublicText(data.summary)}</p>

      {/* Sentiment Bar — visual quick-scan */}
      <div className="l4-sentiment">
        <div className="sentiment-bar">
          <div className={`sentiment-positive ${filter === 'positive' ? 'sentiment--active' : ''}`} style={{ width: `${data.sentimentSplit.positive}%` }} onClick={() => setFilter(filter === 'positive' ? 'all' : 'positive')}>
            👍 {data.sentimentSplit.positive}%
          </div>
          <div className={`sentiment-neutral ${filter === 'neutral' ? 'sentiment--active' : ''}`} style={{ width: `${data.sentimentSplit.neutral}%` }} onClick={() => setFilter(filter === 'neutral' ? 'all' : 'neutral')}>
            ➖ {data.sentimentSplit.neutral}%
          </div>
          <div className={`sentiment-negative ${filter === 'negative' ? 'sentiment--active' : ''}`} style={{ width: `${data.sentimentSplit.negative}%` }} onClick={() => setFilter(filter === 'negative' ? 'all' : 'negative')}>
            👎 {data.sentimentSplit.negative}%
          </div>
        </div>
      </div>

      {/* Hot Topics */}
      {data.hotTopics.length > 0 && (
        <div className="l4-topics">
          <span className="topics-label">🔥 Hot Topics:</span>
          {data.hotTopics.map((t, i) => (
            <span key={i} className={`theme-tag theme-tag--${t.sentiment}`}>{t.topic} ({t.count})</span>
          ))}
        </div>
      )}

      {/* Early Warnings */}
      {data.earlyWarnings.length > 0 && (
        <div className="l4-warnings">
          <h4>⚡ Early Warnings</h4>
          <ul>{data.earlyWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      {/* Discussions — with progressive disclosure */}
      <CollapsibleSection title={`Community Discussions (${data.discussions.length})`} subtitle="Click to browse discussions" defaultOpen={data.discussions.length <= 5}>
        <div className="l4-discussions">
          {visible.map((d: L4Discussion) => (
            <div key={d.id} className={`discussion-card discussion-card--${d.sentiment}`}>
              {d.threadTitle && (
                <div className="discussion-card__thread">
                  📌 {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{d.threadTitle}</a> : d.threadTitle}
                </div>
              )}
              <div className="discussion-card__header">
                <span className="discussion-card__platform">{d.platformIcon} {d.platform}</span>
                <span className="discussion-card__author">{d.author}</span>
                <span className="discussion-card__date">{d.date}</span>
                {d.upvotes !== undefined && <span className="discussion-card__upvotes">⬆️ {d.upvotes}</span>}
              </div>
              <blockquote className="discussion-card__quote">&quot;{d.quote}&quot;</blockquote>
              <div className="discussion-card__footer">
                <span className={`conv-state conv-state--${d.conversationState}`}>{d.conversationState.replace(/-/g, ' ')}</span>
                <span className="discussion-card__theme">🏷️ {d.theme}</span>
                {d.confirmationCount > 0 && <span className="discussion-card__confirms">✅ {d.confirmationCount} confirmations</span>}
                {d.replies && d.replies.length > 0 && (
                  <button className="replies-btn" onClick={(e) => toggleReplies(d.id, e)}>
                    💬 {d.replies.length} replies {showReplies.has(d.id) ? '▲' : '▼'}
                  </button>
                )}
                {d.url && (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="discussion-card__link" onClick={e => e.stopPropagation()}>
                    View original →
                  </a>
                )}
              </div>
              {d.replies && showReplies.has(d.id) && (
                <div className="discussion-card__replies">
                  {d.replies.map((r, i) => (
                    <div key={i} className={`reply reply--${r.sentiment}`}>
                      <div className="reply__header">
                        <span className="reply__author">{r.author}</span>
                        {r.upvotes !== undefined && <span className="reply__upvotes">⬆️ {r.upvotes}</span>}
                      </div>
                      <p className="reply__quote">&quot;{r.quote}&quot;</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {filtered.length > 5 && (
            <button className="show-more-btn" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show less' : `Show all ${filtered.length} discussions`}
            </button>
          )}
        </div>
      </CollapsibleSection>
    </div>
  )
}

// ============================================================================
// L5 SECTION — Client Fallout
// ============================================================================
function L5Section({ data }: { data: ReportData['l5'] }) {
  return (
    <div className="layer-section layer-section--L5">
      <div className="layer-section__header" style={{ borderLeftColor: LAYER_CONFIG.L5.color }}>
        <span className="layer-section__tag" style={{ backgroundColor: LAYER_CONFIG.L5.bg, color: LAYER_CONFIG.L5.color }}>{LAYER_CONFIG.L5.icon}</span>
        <div>
          <h3 className="layer-section__title">Client &amp; User Feedback</h3>
          <p className="layer-section__desc">How the company behaves when real users are affected</p>
        </div>
      </div>

      {/* Summary first */}
      <p className="layer-section__summary-top">{cleanPublicText(data.summary)}</p>

      {/* Overall Rating — prominent */}
      {data.overallRating && (
        <div className="l5-rating">
          <span className="l5-rating__score">{data.overallRating}</span>
          <span className="l5-rating__max">/5</span>
          {data.totalReviews && <span className="l5-rating__count">({data.totalReviews} reviews)</span>}
        </div>
      )}

      {/* Issue Breakdown */}
      {data.issueBreakdown.length > 0 && (
        <div className="l5-issues">
          <h4>Issue Breakdown</h4>
          {data.issueBreakdown.map((iss, i) => (
            <div key={i} className="issue-row">
              <span className="issue-row__category">{iss.category}</span>
              <span className="issue-row__count">{iss.count}</span>
              <span className={`issue-row__trend trend--${iss.trend}`}>
                {iss.trend === 'increasing' ? '📈' : iss.trend === 'decreasing' ? '📉' : '➡️'} {iss.trend}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Company Response Analysis */}
      {data.companyResponseAnalysis.length > 0 && (
        <div className="l5-responses">
          <h4>How They Respond</h4>
          <div className="response-bars">
            {data.companyResponseAnalysis.map((cr, i) => (
              <div key={i} className="response-bar">
                <span className="response-bar__label">{cr.type}</span>
                <div className="response-bar__track">
                  <div className="response-bar__fill" style={{ width: `${cr.percentage}%` }} />
                </div>
                <span className="response-bar__pct">{cr.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Complaints — collapsible */}
      {data.complaints.length > 0 && (
        <CollapsibleSection title={`User Complaints (${data.complaints.length})`}>
          {data.complaints.slice(0, 6).map((c: L5Complaint) => (
            <div key={c.id} className={`complaint-card complaint-card--${c.sentiment}`}>
              <div className="complaint-card__header">
                <span className="complaint-card__platform">{c.platformIcon} {c.platform}</span>
                <span className="complaint-card__category">{c.issueCategory}</span>
                <span className="complaint-card__date">{c.date}</span>
                {c.rating && <span className="complaint-card__rating">{'★'.repeat(c.rating)}{'☆'.repeat(5 - c.rating)}</span>}
              </div>
              <blockquote className="complaint-card__quote">&quot;{c.quote}&quot;</blockquote>
              <div className="complaint-card__footer">
                <span className={`complaint-response complaint-response--${c.companyResponse || 'null'}`}>
                  {c.companyResponse ? c.companyResponse.replace(/-/g, ' ') : 'no response'}
                </span>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="complaint-card__link">View →</a>
                )}
              </div>
            </div>
          ))}
        </CollapsibleSection>
      )}
    </div>
  )
}

// ============================================================================
// L6 SECTION — External Consequences
// ============================================================================
function L6Section({ data }: { data: ReportData['l6'] }) {
  return (
    <div className="layer-section layer-section--L6">
      <div className="layer-section__header" style={{ borderLeftColor: LAYER_CONFIG.L6.color }}>
        <span className="layer-section__tag" style={{ backgroundColor: LAYER_CONFIG.L6.bg, color: LAYER_CONFIG.L6.color }}>{LAYER_CONFIG.L6.icon}</span>
        <div>
          <h3 className="layer-section__title">Public Events</h3>
          <p className="layer-section__desc">What has actually happened — facts, not opinions</p>
        </div>
      </div>

      {/* Summary first */}
      <p className="layer-section__summary-top">{cleanPublicText(data.summary)}</p>

      {data.repeatOffender && (
        <div className="l6-repeat-warning">
          🔴 Pattern detected: This company has repeat incidents across multiple categories.
        </div>
      )}

      {/* Events — the core of L6 */}
      {data.events.length > 0 && (
        <div className="l6-events">
          <h4>Documented Events ({data.events.length})</h4>
          {data.events.map((ev: L6Event) => (
            <div key={ev.id} className={`event-card event-card--${ev.severity}`}>
              <div className="event-card__icon">{ev.icon}</div>
              <div className="event-card__content">
                <div className="event-card__header">
                  <h5 className="event-card__title">{ev.title}</h5>
                  <span className={`event-card__severity ${riskClass(ev.severity)}`}>{ev.severity}</span>
                </div>
                <div className="event-card__meta">
                  <span className="event-card__date">📅 {ev.date}</span>
                  <span className="event-card__source">📰 {ev.source}</span>
                  <span className="event-card__confirms">✓ {ev.confirmationCount} sources</span>
                </div>
                <p className="event-card__desc">{ev.description}</p>
                {ev.outcome && <p className="event-card__outcome"><strong>Outcome:</strong> {ev.outcome}</p>}
                {ev.sourceUrl && (
                  <a href={ev.sourceUrl} target="_blank" rel="noopener noreferrer" className="event-card__link">View source →</a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {data.timelineAnalysis && (
        <p className="l6-analysis">{cleanPublicText(data.timelineAnalysis)}</p>
      )}
    </div>
  )
}

// ============================================================================
// PATTERN TIMELINE (enhanced)
// ============================================================================
function PatternTimeline({ timeline }: { timeline: PatternTimelineType }) {
  const years = timeline.themes[0]?.dataPoints.map(d => d.year) || []
  if (years.length === 0) return null

  return (
    <div className="pattern-timeline">
      <h3 className="section-title">Patterns Over Time ({timeline.yearRange})</h3>
      <div className="pattern-timeline__chart">
        <svg viewBox="0 0 600 150" className="pattern-timeline__svg">
          {[0, 1, 2, 3, 4].map(i => (
            <line key={i} x1="50" y1={20 + i * 30} x2="580" y2={20 + i * 30} stroke="#e5e7eb" strokeWidth="1" />
          ))}
          {timeline.themes.map((theme) => {
            const points = theme.dataPoints.map((d, i) => {
              const x = 50 + (i / (theme.dataPoints.length - 1)) * 530
              const y = 140 - (d.intensity / 100) * 120
              return { x, y }
            })
            const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
            return (
              <g key={theme.name}>
                <path d={pathD} fill="none" stroke={theme.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill={theme.color} />)}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="pattern-timeline__legend">
        {timeline.themes.map(t => (
          <div key={t.name} className="pattern-timeline__legend-item">
            <span className="pattern-timeline__legend-dot" style={{ backgroundColor: t.color }} />
            <span className="legend-layer" style={{ color: LAYER_CONFIG[t.layer]?.color }}>{LAYER_CONFIG[t.layer]?.label}</span>
            <span>{t.name}</span>
          </div>
        ))}
        {timeline.events.map((ev, i) => (
          <div key={i} className="pattern-timeline__legend-item pattern-timeline__legend-item--event">
            <span className={`pattern-timeline__legend-dot event-dot--${ev.severity}`} />
            <span>{ev.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// RISK VS REWARD
// ============================================================================
function RiskReward({ items }: { items: RiskRewardItem[] }) {
  return (
    <div className="risk-reward">
      <h3 className="section-title">Trade-offs at a Glance</h3>
      <div className="risk-reward__list">
        {items.map((item, i) => (
          <div key={i} className="risk-reward__item">
            <span className="risk-reward__icon">{item.icon}</span>
            <span className="risk-reward__label">{cleanPublicText(item.label)}</span>
            <div className="risk-reward__bar">
              {item.segments.map((seg, j) => (
                <div key={j} className="risk-reward__segment" style={{ backgroundColor: seg.color, width: `${seg.width}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// FIRST 90 DAYS
// ============================================================================
function First90Days({ data }: { data: First90DaysType }) {
  const [activeWeek, setActiveWeek] = useState(data.weeks[0]?.id || '')
  const activeWeekData = data.weeks.find(w => w.id === activeWeek)

  return (
    <div className="first-90-days">
      <h3 className="section-title">What to Expect: First 90 Days</h3>
      <div className="first-90-days__tabs">
        {data.weeks.map(w => (
          <button
            key={w.id}
            className={`first-90-days__tab ${activeWeek === w.id ? 'first-90-days__tab--active' : ''}`}
            onClick={() => setActiveWeek(w.id)}
          >
            {w.label} ▾
          </button>
        ))}
      </div>
      {activeWeekData && <p className="first-90-days__description">{activeWeekData.description}</p>}
      <div className="first-90-days__indicators">
        <div className={`first-90-days__indicator indicator--${data.burnoutLevel}`}>
          <span className="indicator-icon">🔥</span>
          <span>Burnout: </span>
          <span className="indicator-level">{data.burnoutLevel.charAt(0).toUpperCase() + data.burnoutLevel.slice(1)}</span>
        </div>
        <div className={`first-90-days__indicator indicator--${data.supportLevel}`}>
          <span className="indicator-icon">🤝</span>
          <span>Support: </span>
          <span className="indicator-level">{data.supportLevel.charAt(0).toUpperCase() + data.supportLevel.slice(1)}</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// SELF-PROTECTION CHECKLIST
// ============================================================================
function SelfProtectionChecklist({ checklist }: { checklist: ChecklistType }) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const toggle = (id: string) => {
    const n = new Set(checked)
    n.has(id) ? n.delete(id) : n.add(id)
    setChecked(n)
  }

  return (
    <div className="checklist">
      <h3 className="section-title">Before You Decide</h3>
      <div className="checklist__items">
        {checklist.items.map(item => (
          <label key={item.id} className="checklist__item">
            <input type="checkbox" checked={checked.has(item.id)} onChange={() => toggle(item.id)} />
            <span className="checklist__checkbox" />
            <span>{cleanPublicText(item.label)}</span>
            {item.sourceLayer && (
              <span className="checklist__layer-tag" style={{ backgroundColor: LAYER_CONFIG[item.sourceLayer]?.bg, color: LAYER_CONFIG[item.sourceLayer]?.color }}>
                {LAYER_CONFIG[item.sourceLayer]?.label}
              </span>
            )}
          </label>
        ))}
      </div>
      <div className="checklist__redflags">
        <div className="checklist__redflags-header">
          <span className="redflag-count">{checklist.redFlags.length}</span>
          <span className="redflag-icon">🚩</span>
          <span>Red Flags:</span>
        </div>
        <ul className="checklist__redflags-list">
          {checklist.redFlags.map((flag, i) => (
            <li key={i}>
              {cleanPublicText(flag.text)}
              <span className="redflag-layer" style={{ color: LAYER_CONFIG[flag.sourceLayer]?.color }}>
                {LAYER_CONFIG[flag.sourceLayer]?.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ============================================================================
// INTERVIEW QUESTIONS
// ============================================================================
function InterviewQuestions({ categories }: { categories: QuestionCategory[] }) {
  const [activeTab, setActiveTab] = useState(categories[0]?.id || '')
  const active = categories.find(c => c.id === activeTab)

  return (
    <div className="interview-questions">
      <h3 className="section-title">Questions to Ask</h3>
      <div className="interview-questions__tabs">
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`interview-questions__tab ${activeTab === cat.id ? 'interview-questions__tab--active' : ''}`}
            onClick={() => setActiveTab(cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>
      {active && (
        <div className="interview-questions__content">
          <ul className="interview-questions__list">
            {active.questions.map((q, i) => (
              <li key={i}><span className="question-bullet">■</span>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// YOUTUBE EVIDENCE
// ============================================================================
function YouTubeEvidence({ evidence }: { evidence: YouTubeEvidenceType }) {
  const [playingVideo, setPlayingVideo] = useState<string | null>(null)
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null)

  const handlePlay = (videoId: string, youtubeId?: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (youtubeId) {
      setPlayingVideo(playingVideo === videoId ? null : videoId)
      setExpandedVideo(videoId)
    } else {
      setExpandedVideo(expandedVideo === videoId ? null : videoId)
    }
  }

  return (
    <div className="youtube-evidence">
      <h3 className="section-title">
        Video Insights
        <span className="section-subtitle">({evidence.totalVideosFound} videos found)</span>
      </h3>
      <div className="youtube-evidence__stats">
        <div className="stat-badge"><span className="stat-value">{evidence.totalVideosFound}</span><span className="stat-label">Total</span></div>
        <div className="stat-badge"><span className="stat-icon">👋</span><span className="stat-value">{evidence.exEmployeeVideos}</span><span className="stat-label">Ex-Employee</span></div>
        <div className="stat-badge"><span className="stat-icon">🎤</span><span className="stat-value">{evidence.interviewExpVideos}</span><span className="stat-label">Interview</span></div>
        <div className="stat-badge"><span className="stat-icon">📅</span><span className="stat-value">{evidence.dayInLifeVideos}</span><span className="stat-label">Day in Life</span></div>
      </div>
      <div className="youtube-evidence__list">
        {evidence.videos.map(video => (
          <div key={video.id} className={`video-card video-card--${video.sentiment} ${expandedVideo === video.id ? 'video-card--expanded' : ''}`}>
            {playingVideo === video.id && video.youtubeId ? (
              <div className="video-card__player">
                <div className="video-player-container">
                  <button className="video-close-btn" onClick={(e) => { e.stopPropagation(); setPlayingVideo(null) }}>✕ Close</button>
                  <iframe
                    width="100%" height="315"
                    src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
                    title={video.title} frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : (
              <div className="video-card__thumbnail" onClick={(e) => handlePlay(video.id, video.youtubeId, e)}>
                {video.youtubeId && <img src={`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`} alt={video.title} className="thumbnail-img" />}
                <span className="play-icon">▶</span>
                <span className="video-duration">{video.duration}</span>
              </div>
            )}
            <div className="video-card__content" onClick={() => setExpandedVideo(expandedVideo === video.id ? null : video.id)}>
              <h4 className="video-title">{video.title}</h4>
              <div className="video-meta">
                <span className="video-channel">🎬 {video.channel}</span>
                <span className="video-views">👁️ {video.viewCount}</span>
                <span className="video-date">📅 {video.publishDate}</span>
              </div>
              {expandedVideo === video.id && (
                <div className="video-card__expanded">
                  <div className="video-takeaways">
                    <strong>📋 Key Takeaways:</strong>
                    <ul>{video.keyTakeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
                  </div>
                  {video.quotableClip && <blockquote className="video-quote">💬 &quot;{video.quotableClip}&quot;</blockquote>}
                  <div className="video-topics">
                    {video.topics.map((t, i) => <span key={i} className="topic-tag">{t}</span>)}
                  </div>
                  {video.youtubeId && playingVideo !== video.id && (
                    <button className="watch-video-btn" onClick={(e) => handlePlay(video.id, video.youtubeId, e)}>▶ Watch Video</button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// INTERVIEW INTELLIGENCE
// ============================================================================
function InterviewIntelligence({ intel }: { intel: InterviewIntelligenceType }) {
  const [activeStage, setActiveStage] = useState<string | null>(null)

  return (
    <div className="interview-intel">
      <h3 className="section-title">Interview Process</h3>
      <div className="interview-intel__overview">
        <div className="overview-stat"><span className="stat-icon">⏱️</span><span className="stat-value">{intel.processLength}</span><span className="stat-label">Length</span></div>
        <div className="overview-stat"><span className="stat-icon">📊</span><span className="stat-value">{intel.totalStages} rounds</span><span className="stat-label">Stages</span></div>
        <div className="overview-stat"><span className="stat-icon">🎯</span><span className="stat-value">{'⭐'.repeat(intel.difficultyRating)}</span><span className="stat-label">Difficulty</span></div>
        <div className="overview-stat"><span className="stat-icon">✅</span><span className="stat-value">{intel.offerRate}</span><span className="stat-label">Offer Rate</span></div>
        <div className={`overview-stat overview-stat--${intel.ghostingRisk}`}><span className="stat-icon">👻</span><span className="stat-value">{intel.ghostingRisk}</span><span className="stat-label">Ghosting</span></div>
      </div>

      {intel.timelineWarning && <div className="interview-intel__warning">⚠️ {intel.timelineWarning}</div>}

      <div className="interview-intel__stages">
        <h4>Interview Stages</h4>
        <div className="stages-timeline">
          {intel.stages.map((stage, index) => (
            <div
              key={stage.id}
              className={`stage-card stage-card--${stage.difficulty} ${activeStage === stage.id ? 'stage-card--expanded' : ''}`}
              onClick={() => setActiveStage(activeStage === stage.id ? null : stage.id)}
            >
              <div className="stage-card__number">{index + 1}</div>
              <div className="stage-card__content">
                <div className="stage-header">
                  <span className="stage-icon">{stage.icon}</span>
                  <span className="stage-name">{stage.name}</span>
                  <span className="stage-duration">{stage.duration}</span>
                  <span className={`stage-difficulty difficulty--${stage.difficulty}`}>{stage.difficulty}</span>
                </div>
                <p className="stage-description">{stage.description}</p>
                {activeStage === stage.id && (
                  <div className="stage-expanded">
                    <div className="stage-tips"><strong>💡 Tips:</strong><ul>{stage.tips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
                    <div className="stage-questions"><strong>❓ Common Questions:</strong><ul>{stage.commonQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {intel.salaryRange && (
        <div className="interview-intel__salary">
          <h4>💰 Salary Range ({intel.salaryRange.level})</h4>
          <div className="salary-range">
            <span className="salary-min">{intel.salaryRange.currency} {intel.salaryRange.min}</span>
            <div className="salary-bar" />
            <span className="salary-max">{intel.salaryRange.currency} {intel.salaryRange.max}</span>
          </div>
        </div>
      )}

      {intel.redFlagsInProcess.length > 0 && (
        <div className="interview-intel__redflags"><h4>🚩 Red Flags</h4><ul>{intel.redFlagsInProcess.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
      )}

      {intel.insiderTips.length > 0 && (
        <div className="interview-intel__insider"><h4>🤫 Insider Tips</h4><ul>{intel.insiderTips.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
      )}
    </div>
  )
}

// ============================================================================
// EVIDENCE SOURCES (with layer coverage)
// ============================================================================
function EvidenceSources({ evidence }: { evidence: EvidenceSection }) {
  return (
    <div className="evidence-sources">
      <h3 className="section-title">Sources &amp; Methodology</h3>

      {/* Layer Coverage */}
      {evidence.layerCoverage && evidence.layerCoverage.length > 0 && (
        <div className="evidence-sources__coverage">
          <h4>Source Coverage</h4>
          <div className="coverage-grid">
            {evidence.layerCoverage.map((lc) => (
              <div key={lc.layer} className="coverage-item">
                <span className="coverage-layer" style={{ color: LAYER_CONFIG[lc.layer]?.color }}>{LAYER_CONFIG[lc.layer]?.label}</span>
                <span className="coverage-name">{LAYER_CONFIG[lc.layer]?.label || cleanPublicText(lc.name)}</span>
                <div className="coverage-bar">
                  <div className="coverage-fill" style={{ width: `${lc.confidence}%`, backgroundColor: LAYER_CONFIG[lc.layer]?.color }} />
                </div>
                <span className="coverage-count">{lc.sourcesAvailable} sources</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="evidence-sources__stats">
        <div className="stat-badge"><span className="stat-value">{evidence.totalSources}</span><span className="stat-label">Total Sources</span></div>
        <div className="stat-badge stat-badge--high"><span className="stat-value">{evidence.highCredibilitySources}</span><span className="stat-label">High Credibility</span></div>
        <div className="stat-badge"><span className="stat-value">{evidence.recentSources}</span><span className="stat-label">Recent (12mo)</span></div>
      </div>

      <div className="evidence-sources__quality-note">ℹ️ {cleanPublicText(evidence.dataQualityNote)}</div>

      <div className="evidence-sources__list">
        {evidence.sources.map(source => (
          <div key={source.id} className="source-card">
            <div className="source-card__header">
              <span className="source-type">{source.icon}</span>
              <span className="source-title">{source.title}</span>
              <span className="source-layer-tag" style={{ backgroundColor: LAYER_CONFIG[source.layer]?.bg, color: LAYER_CONFIG[source.layer]?.color }}>
                {LAYER_CONFIG[source.layer]?.label}
              </span>
            </div>
            <div className="source-card__meta">
              <span className="source-name">{source.source}</span>
              <span className="source-date">{source.date}</span>
            </div>
            <p className="source-card__summary">{cleanPublicText(source.summary)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// MAIN REPORT VIEW
// ============================================================================
export default function ReportView({ data }: { data: ReportData }) {
  const [activeSection, setActiveSection] = useState('verdict')
  const reportRef = useRef<HTMLDivElement>(null)

  // Track scroll position to highlight active ToC item
  const handleScroll = useCallback(() => {
    const sections = [
      'verdict', 'decision', 'layers', 'mismatches', 'insights', 'timeline',
      'layer-L1', 'layer-L2', 'layer-L3', 'layer-L4', 'layer-L5', 'layer-L6',
      'tradeoffs', 'actionable', 'final-verdict', 'sources',
    ]
    for (const id of sections.reverse()) {
      const el = document.getElementById(id)
      if (el) {
        const rect = el.getBoundingClientRect()
        if (rect.top <= 120) {
          setActiveSection(id)
          break
        }
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const handleLayerClick = (id: LayerId) => {
    document.getElementById(`layer-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="report-layout">
      <TableOfContents activeSection={activeSection} />

      <div className="report" ref={reportRef}>
        {/* Header */}
        <header className="report__header">
          <div className="report__header-left">
            <span className="report__logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L19 7" /></svg>
            </span>
            <h1 className="report__title">{data.companyName}</h1>
          </div>
          <span className="report__badge">Company Risk Report</span>
        </header>

        {/* Candidate focus */}
        <div className="report__candidate">
          <span>{data.candidate.focus.join(' + ')}</span>
        </div>

        {/* Verdict Banner */}
        <VerdictBanner verdict={data.verdict} companyName={data.companyName} />

        {/* Decision Support */}
        <DecisionSupportSection data={data} />

        {/* Evidence dashboard */}
        <LayerDashboard overviews={data.layerOverviews} onLayerClick={handleLayerClick} />

        {/* Narrative Mismatch Panel */}
        <NarrativeMismatchPanel mismatches={data.narrativeMismatches} />

        {/* Cross-source insights */}
        <CrossLayerInsights insights={data.crossLayerInsights} />

        {/* Pattern Timeline */}
        <div id="timeline">
          <PatternTimeline timeline={data.patternTimeline} />
        </div>

        {/* Source details */}
        <div className="layer-sections">
          <h3 className="section-title section-title--divider">Source Details</h3>
          <div id="layer-L1"><L1Section data={data.l1} /></div>
          <div id="layer-L2"><L2Section data={data.l2} /></div>
          <div id="layer-L3"><L3Section data={data.l3} /></div>
          <div id="layer-L4"><L4Section data={data.l4} /></div>
          <div id="layer-L5"><L5Section data={data.l5} /></div>
          <div id="layer-L6"><L6Section data={data.l6} /></div>
        </div>

        {/* Trade-offs & Expectations */}
        <div id="tradeoffs" className="report__bottom-grid">
          <RiskReward items={data.riskReward} />
          <First90Days data={data.first90Days} />
        </div>

        <div id="actionable" className="report__bottom-grid">
          <SelfProtectionChecklist checklist={data.checklist} />
          <InterviewQuestions categories={data.interviewQuestions} />
        </div>

        <FinalVerdictSection data={data} />

        {/* YouTube Evidence */}
        {data.youtubeEvidence && <YouTubeEvidence evidence={data.youtubeEvidence} />}

        {/* Interview Intelligence */}
        {data.interviewIntelligence && <InterviewIntelligence intel={data.interviewIntelligence} />}

        {/* Evidence Sources */}
        <div id="sources">
          <EvidenceSources evidence={data.evidenceSources} />
        </div>
      </div>
    </div>
  )
}
