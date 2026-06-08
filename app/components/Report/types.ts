// ============================================================================
// 6-LAYER INTELLIGENCE REPORT TYPES
// Based on the Layer Framework Specification
//
// OLD TYPES preserved in types.old.ts
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type Sentiment = 'positive' | 'negative' | 'neutral' | 'mixed'
export type VerdictType = 'green' | 'yellow' | 'red'
export type LayerId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6'

// ── Candidate Info ─────────────────────────────────────────────────
export interface CandidateInfo {
  generation: string
  ageRange: string
  focus: string[]
}

// ── Verdict (Cross-Layer) ──────────────────────────────────────────
export interface Verdict {
  type: VerdictType
  emoji: string
  title: string
  oneLiner: string
  riskLevel: string
  bullets: string[]
  layerConfidence: { layer: LayerId; label: string; score: number }[]
}

// ── Layer Overview Card ────────────────────────────────────────────
export interface LayerOverview {
  id: LayerId
  name: string
  subtitle: string
  icon: string
  riskLevel: RiskLevel
  keyFinding: string
  sourceCount: number
  confidence: number
}

// ============================================================================
// L1 — OFFICIAL / CONTROLLED NARRATIVE (MASTER SOURCE TABLE)
//
// LOCK RULE: If the company can approve it, edit it, or delete it → Layer 1.
// Layer 1 is the company's self-authored reality.
// It is NOT truth. It is the control sample against which every other layer
// is measured.
// ============================================================================

/** A scraped page surface from the company's own web properties */
export interface L1PageSurface {
  url: string
  title: string
  headings: string[]
  textPreview: string        // Truncated content
  keyPhrases: string[]       // Extracted claims/promises
  lastScraped: string        // ISO timestamp
  found: boolean
}

/** Category A — Core Company-Owned Web Properties */
export interface L1CoreWebProperties {
  mainWebsite: L1PageSurface | null
  aboutPage: L1PageSurface | null          // Self-definition
  visionValuesPage: L1PageSurface | null   // Claimed ethics
  careersPage: L1PageSurface | null        // Employee promise
  culturePage: L1PageSurface | null        // Employer branding ("Life at X")
  benefitsPage: L1PageSurface | null       // Compensation narrative
  deiEsgPage: L1PageSurface | null         // Social positioning
  sustainabilityPage: L1PageSurface | null // Long-term intent
  blogPage: L1PageSurface | null           // Narrative control
  newsroomPage: L1PageSurface | null       // Official announcements / PR posture
  pressReleasesPage: L1PageSurface | null  // PR posture
  mediaKitPage: L1PageSurface | null       // External framing
  caseStudiesPage: L1PageSurface | null    // Curated success
  testimonialsPage: L1PageSurface | null   // Selective validation
  customerStoriesPage: L1PageSurface | null // Controlled proof
  partnersPage: L1PageSurface | null       // Alliance signaling
  pricingPage: L1PageSurface | null        // Value framing
  productFeaturesPage: L1PageSurface | null // Capability claims
  roadmapPage: L1PageSurface | null        // Forward promises
  statusPage: L1PageSurface | null         // Operational transparency
  trustSecurityPage: L1PageSurface | null  // Risk reassurance
  compliancePage: L1PageSurface | null     // Regulatory posture
}

/** Category B — Official Social Media Brand Accounts */
export interface L1SocialBrandAccount {
  platform: string   // LinkedIn, X, Facebook, Instagram, TikTok, YouTube, Threads, Weibo, WeChat, LINE, VK, Telegram, Discord
  handle: string
  url: string
  tone: string       // Observed messaging tone
  found: boolean
}

/** Category C — Official Video, Audio & Media Channels */
export interface L1MediaChannels {
  youtubeChannel: { url: string; tone: string } | null
  companyPodcasts: { name: string; url: string; positioning: string }[]
  webinars: string[]          // Detected webinar/event pages
  productDemos: string[]      // Capability claims
  investorDays: string[]      // Published recordings
  recordedTownHalls: string[] // Controlled transparency
}

/** Category D — Hiring & Talent Surfaces (OFFICIAL postings only) */
export interface L1HiringSurface {
  platform: string   // Internal ATS, Greenhouse, Lever, Workday, SAP SuccessFactors, BambooHR, Recruitee, SmartRecruiters, Ashby, Careers microsite
  url: string
  jobCount: number
  detected: boolean
}

/** Category E — Official Market & Product Surfaces */
export interface L1ProductSurfaces {
  publicDocs: L1PageSurface | null      // Capability claims
  apiDocs: L1PageSurface | null         // Dev promise
  developerPortal: L1PageSurface | null // Ecosystem strategy
  publicChangelog: L1PageSurface | null  // Transparency
  releaseNotes: L1PageSurface | null     // Stability signaling
  featureAnnouncements: L1PageSurface | null // Direction
  migrationGuides: L1PageSurface | null  // Technical maturity
}

/** Category F — Investor, Financial & Corporate Messaging */
export interface L1InvestorSurfaces {
  investorRelationsPage: L1PageSurface | null  // Financial story
  annualReports: string[]                       // Long-term narrative
  quarterlyUpdates: string[]                    // Performance framing
  shareholderLetters: string[]                  // Leadership voice
  pitchDecks: string[]                          // Vision packaging
  crowdfundingPages: string[]                   // Public pitch
  tokenWhitepapers: string[]                    // Crypto narrative
}

/** Category G — Legal, Compliance & Risk Messaging */
export interface L1LegalSurfaces {
  termsOfService: L1PageSurface | null     // Legal reality
  privacyPolicy: L1PageSurface | null      // Data posture
  cookiePolicy: L1PageSurface | null       // Tracking posture
  refundPolicy: L1PageSurface | null       // User ethics
  codeOfConduct: L1PageSurface | null      // Internal rules
  ethicsPolicy: L1PageSurface | null       // Moral claims
  whistleblowerPolicy: L1PageSurface | null // Damage control readiness
  amlKycDisclosures: L1PageSurface | null  // Fintech integrity
  regulatoryDisclosures: L1PageSurface | null // Compliance
  riskDisclosures: L1PageSurface | null    // Honesty
  userAgreements: L1PageSurface | null     // Power balance
  arbitrationClauses: L1PageSurface | null // Dispute stance
}

/** Category H — Regional & Language Variants (mismatch = high-risk signal) */
export interface L1RegionalVariant {
  region: string
  language: string
  surface: string      // e.g. "Local careers page", "Local policy page"
  url: string
  mismatchDetected: boolean
  mismatchDescription: string | null
}

/** Category I — Edge Cases (often forgotten but still L1) */
export interface L1EdgeCase {
  surface: string      // "We're hiring" landing, restructuring page, apology post, CEO message, etc.
  url: string
  what: string         // What it signals
  detected: boolean
}

/** Full L1 Official Narrative — exhaustive per Master Source Table */
export interface L1OfficialNarrative {
  // ── Identity & Domain ──────────────────────────────────────────
  companyDomain: string | null
  missionStatement: string | null

  // ── Category A: Core Web Properties ────────────────────────────
  coreWebProperties: L1CoreWebProperties

  // ── Category B: Social Brand Accounts ──────────────────────────
  socialBrandAccounts: L1SocialBrandAccount[]

  // ── Category C: Media Channels ─────────────────────────────────
  mediaChannels: L1MediaChannels

  // ── Category D: Hiring Surfaces ────────────────────────────────
  hiringSurfaces: L1HiringSurface[]
  jobPostingsCount: number

  // ── Category E: Product Surfaces ───────────────────────────────
  productSurfaces: L1ProductSurfaces

  // ── Category F: Investor Surfaces ──────────────────────────────
  investorSurfaces: L1InvestorSurfaces

  // ── Category G: Legal Surfaces ─────────────────────────────────
  legalSurfaces: L1LegalSurfaces

  // ── Category H: Regional Variants ──────────────────────────────
  regionalVariants: L1RegionalVariant[]

  // ── Category I: Edge Cases ─────────────────────────────────────
  edgeCases: L1EdgeCase[]

  // ── Aggregated Extraction (from all surfaces above) ────────────
  claimedValues: string[]
  benefitsClaims: string[]
  cultureKeywords: string[]
  careersHighlights: string[]

  // ── Change Detection ───────────────────────────────────────────
  changeDetection: { what: string; when: string; significance: RiskLevel }[]

  // ── Surface Coverage Stats ─────────────────────────────────────
  surfacesScanned: number
  surfacesFound: number
  surfaceCoverage: number   // 0-100 percentage

  // ── Summary ────────────────────────────────────────────────────
  summary: string
}

// ============================================================================
// L2 — SEMI-PUBLIC PROFESSIONAL BEHAVIOR (MASTER SOURCE TABLE)
//
// LOCK RULE: Is a human speaking publicly, without company editorial
//            control, in a professional context?  → Layer 2
// Layer 2 is the "human-in-public" layer. It captures how people tied
// to a company behave when reputations are on the line but scripts are
// thinner. It is neither marketing nor anonymous truth — it is
// behavior under light pressure.
// ============================================================================

/** Speaker classification for L2 */
export type L2SpeakerClass =
  | 'leader'
  | 'current-employee'
  | 'ex-employee'
  | 'recruiter'
  | 'partner'
  | 'outsider'
  | 'founder'
  | 'hiring-manager'

/** Tone of an L2 signal */
export type L2Tone =
  | 'promotional'
  | 'defensive'
  | 'authentic'
  | 'empathetic'
  | 'silence'
  | 'critical'
  | 'celebratory'
  | 'reflective'
  | 'frustrated'
  | 'neutral'

/** L2 Master Source Table category identifiers */
export type L2Category =
  | 'A-professional-social'     // LinkedIn personal posts/comments/reposts
  | 'B-microblogging'           // X/Twitter, Mastodon, Bluesky
  | 'C-long-form'               // Medium, Substack, Dev.to, personal blogs
  | 'D-podcast-interview'       // Podcast appearances, conference talks, panels
  | 'E-dev-technical'           // GitHub issues/discussions, StackOverflow, READMEs
  | 'F-hiring-recruiting'       // Recruiter/hiring manager personal posts
  | 'G-professional-community'  // LinkedIn Groups, Indie Hackers, Product Hunt
  | 'H-edge-case'               // Farewell posts, resignations, whistleblower, apologies

/** An individual L2 signal — behaviour observation from any L2 source */
export interface L2Signal {
  id?: string
  category: L2Category
  platform: string
  speakerClass: L2SpeakerClass
  proximity: 'first-hand' | 'second-hand' | 'observational' | 'speculative'
  summary: string
  tone: L2Tone | string
  date: string
  url?: string
  author?: string
  signalType?: string    // e.g. "farewell-post", "thought-leadership", "layoff-post"
}

/** Category E — Developer & Technical signals (GitHub, StackOverflow, Dev.to) */
export interface L2DevSignal {
  platform: string
  type: 'issue' | 'discussion' | 'readme' | 'post-mortem' | 'blog-post' | 'answer'
  title: string
  snippet: string
  url: string
  author: string
  date: string
  reactions: number
  comments: number
}

/** Full L2 — exhaustive per Master Source Table Categories A-H */
export interface L2ProfessionalBehavior {
  // ── All signals across Categories A-H ──────────────────────────
  signals: L2Signal[]

  // ── Category E: Developer & Technical Signals ──────────────────
  devSignals: L2DevSignal[]

  // ── Aggregated Analysis ────────────────────────────────────────
  behavioralPatterns: { pattern: string; interpretation: string; risk: RiskLevel }[]
  cadenceAnalysis: string | null
  silenceEvents: string[]

  // ── Platform & Category Breakdown ──────────────────────────────
  platformBreakdown: { platform: string; count: number; icon: string }[]
  categoryBreakdown: { category: L2Category; label: string; count: number }[]
  toneBreakdown: { tone: string; count: number; percentage: number }[]

  // ── Coverage Stats ─────────────────────────────────────────────
  sourcesSearched: string[]
  totalSignalsFound: number
  signalsFound: number

  // ── Summary ────────────────────────────────────────────────────
  summary: string
}

// ============================================================================
// L3 — EMPLOYEE & CANDIDATE LEAKAGE
// ============================================================================

export interface L3Review {
  id: string
  source: string
  sourceIcon: string
  speakerClass: 'current-employee' | 'ex-employee' | 'candidate' | 'contractor' | 'intern'
  proximity: 'first-hand' | 'near-first-hand' | 'second-hand'
  emotionalMode: 'burnout' | 'controlled-frustration' | 'shock' | 'defensive-positivity' | 'gratitude' | 'anger' | 'neutral'
  specificityScore: 'high' | 'medium' | 'low'
  quote: string
  role?: string
  location?: string
  date: string
  sentiment: Sentiment
  theme: string
  url?: string
  rating?: number
  prosAndCons?: { pros: string[]; cons: string[] }
}

export interface L3EmployeeLeakage {
  reviews: L3Review[]
  emotionalModeBreakdown: { mode: string; count: number; percentage: number }[]
  burstDetection: { type: string; period: string; interpretation: string }[]
  repeatingPatterns: { pattern: string; frequency: number; severity: RiskLevel }[]
  managementRiskSignals: string[]
  summary: string
}

// ============================================================================
// L4 — COMMUNITY & PEER REALITY
// ============================================================================

export interface L4Discussion {
  id: string
  platform: string
  platformIcon: string
  threadTitle: string
  quote: string
  author: string
  date: string
  upvotes?: number
  commentCount?: number
  sentiment: Sentiment
  confirmationCount: number
  conversationState: 'single-vent' | 'multiple-confirmations' | 'cross-thread' | 'structural-problem'
  theme: string
  url?: string
  replies?: { author: string; quote: string; sentiment: Sentiment; upvotes?: number }[]
}

export interface L4CommunityReality {
  discussions: L4Discussion[]
  platformBreakdown: { platform: string; count: number; icon: string }[]
  sentimentSplit: { positive: number; negative: number; neutral: number }
  hotTopics: { topic: string; count: number; sentiment: Sentiment }[]
  earlyWarnings: string[]
  summary: string
}

// ============================================================================
// L5 — CLIENT / USER FALLOUT
// ============================================================================

export interface L5Complaint {
  id: string
  platform: string
  platformIcon: string
  speakerClass: 'end-user' | 'paying-customer' | 'business-client' | 'trial-user' | 'former-customer'
  issueCategory: 'billing' | 'support-failure' | 'product-reliability' | 'misrepresentation' | 'contract-issues' | 'data-privacy' | 'access-issues'
  quote: string
  author: string
  date: string
  sentiment: Sentiment
  companyResponse: 'no-response' | 'template-response' | 'defensive' | 'empathetic-action' | 'public-fix' | null
  resolutionState: 'resolved' | 'acknowledged' | 'ignored' | 'repeated-unresolved'
  rating?: number
  url?: string
}

export interface L5ClientFallout {
  complaints: L5Complaint[]
  issueBreakdown: { category: string; count: number; trend: 'increasing' | 'stable' | 'decreasing' }[]
  companyResponseAnalysis: { type: string; count: number; percentage: number }[]
  overallRating?: number
  totalReviews?: number
  floodPatterns: { pattern: string; interpretation: string }[]
  summary: string
}

// ============================================================================
// L6 — EXTERNAL CONSEQUENCES (RECEIPTS)
// ============================================================================

export interface L6Event {
  id: string
  category: 'layoffs' | 'legal-actions' | 'regulatory' | 'financial-distress' | 'structural-changes' | 'leadership-changes' | 'compliance-failures' | 'public-sanctions' | 'government-actions'
  icon: string
  title: string
  date: string
  severity: RiskLevel
  source: string
  sourceUrl?: string
  description: string
  confirmationCount: number
  jurisdiction?: string
  outcome?: string
}

export interface L6ExternalConsequences {
  events: L6Event[]
  categoryBreakdown: { category: string; count: number; icon: string }[]
  timelineAnalysis: string
  repeatOffender: boolean
  summary: string
}

// ============================================================================
// CROSS-LAYER ANALYSIS
// ============================================================================

export interface NarrativeMismatch {
  id: string
  icon: string
  companyClaims: string
  realityShows: string
  sourceLayers: LayerId[]
  severity: RiskLevel
  evidence: string
}

export interface CrossLayerInsight {
  id: string
  title: string
  description: string
  supportingLayers: LayerId[]
  confidence: 'high' | 'medium' | 'low'
  riskLevel: RiskLevel
}

// ============================================================================
// PATTERN TIMELINE
// ============================================================================

export interface TimelineTheme {
  name: string
  color: string
  layer: LayerId
  dataPoints: { year: number; intensity: number }[]
}

export interface TimelineEvent {
  year: number
  label: string
  layer: LayerId
  severity: RiskLevel
}

export interface PatternTimeline {
  yearRange: string
  themes: TimelineTheme[]
  events: TimelineEvent[]
}

// ============================================================================
// ACTION ITEMS
// ============================================================================

export interface RiskRewardItem {
  icon: string
  label: string
  segments: { color: string; width: number }[]
}

export interface First90Days {
  weeks: { id: string; label: string; description: string }[]
  burnoutLevel: RiskLevel
  supportLevel: RiskLevel
}

export interface ChecklistItem {
  id: string
  label: string
  checked: boolean
  sourceLayer?: LayerId
}

export interface RedFlag {
  text: string
  sourceLayer: LayerId
}

export interface Checklist {
  items: ChecklistItem[]
  redFlags: RedFlag[]
}

export interface QuestionCategory {
  id: string
  label: string
  questions: string[]
  basedOnLayer?: LayerId
}

// ============================================================================
// INTERVIEW INTELLIGENCE
// ============================================================================

export interface InterviewStage {
  id: string
  stage: number
  name: string
  duration: string
  type: string
  icon: string
  description: string
  tips: string[]
  commonQuestions: string[]
  difficulty: 'easy' | 'medium' | 'hard'
  interviewerRole?: string
}

export interface InterviewIntelligence {
  processLength: string
  totalStages: number
  difficultyRating: number
  offerRate: string
  ghostingRisk: RiskLevel
  stages: InterviewStage[]
  negotiationTips: string[]
  redFlagsInProcess: string[]
  insiderTips: string[]
  salaryRange?: { min: string; max: string; currency: string; level: string }
  timelineWarning?: string
}

// ============================================================================
// YOUTUBE EVIDENCE
// ============================================================================

export interface YouTubeVideo {
  id: string
  youtubeId?: string
  title: string
  channel: string
  channelType: 'ex-employee' | 'current-employee' | 'interviewer' | 'career-coach' | 'news' | 'review'
  publishDate: string
  viewCount: string
  duration: string
  keyTakeaways: string[]
  sentiment: Sentiment
  credibilityScore: 'high' | 'medium' | 'low'
  topics: string[]
  quotableClip?: string
  timestamps?: { time: string; label: string }[]
  assignedLayer?: LayerId
}

export interface YouTubeEvidence {
  totalVideosFound: number
  exEmployeeVideos: number
  interviewExpVideos: number
  dayInLifeVideos: number
  videos: YouTubeVideo[]
  commonThemes: string[]
  overallSentiment: Sentiment
}

// ============================================================================
// DATA QUALITY & SOURCES
// ============================================================================

export interface EvidenceSource {
  id: string
  type: string
  icon: string
  title: string
  source: string
  date: string
  credibility: 'high' | 'medium' | 'low'
  summary: string
  relevance: string
  layer: LayerId
  url?: string
}

export interface EvidenceSection {
  totalSources: number
  highCredibilitySources: number
  recentSources: number
  sources: EvidenceSource[]
  dataQualityNote: string
  layerCoverage: { layer: LayerId; name: string; sourcesAvailable: number; confidence: number }[]
}

// ============================================================================
// FULL 6-LAYER REPORT DATA
// ============================================================================

export interface ReportData {
  companyName: string
  companyLogo?: string
  candidate: CandidateInfo

  verdict: Verdict
  layerOverviews: LayerOverview[]

  l1: L1OfficialNarrative
  l2: L2ProfessionalBehavior
  l3: L3EmployeeLeakage
  l4: L4CommunityReality
  l5: L5ClientFallout
  l6: L6ExternalConsequences

  narrativeMismatches: NarrativeMismatch[]
  crossLayerInsights: CrossLayerInsight[]

  patternTimeline: PatternTimeline
  riskReward: RiskRewardItem[]

  first90Days: First90Days
  checklist: Checklist
  interviewQuestions: QuestionCategory[]

  youtubeEvidence?: YouTubeEvidence
  interviewIntelligence?: InterviewIntelligence
  evidenceSources: EvidenceSection
}
