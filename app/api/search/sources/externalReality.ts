/**
 * L6 — External Reality, Notarized (EXHAUSTIVE Master Source Table)
 *
 * Layer 6 is reality, notarized.
 * It records what actually happened to a company when institutions,
 * laws, markets, or governments intervened.
 * It is the anchor that keeps every other layer honest.
 *
 * QUALIFICATION TEST (LOCKED):
 *   1. Is the event verified by an external authority or record?
 *   2. Does it have legal, financial, regulatory, or structural impact?
 *   3. Is it not authored by the company or users?
 *   4. Can it be cited independently?
 *   If YES to all four → Layer 6.
 *   If experiential → L3 / L5.
 *   If conversational → L4.
 *   If narrative → L1.
 *   If behavioral → L2.
 *
 * Categories (from L6 Master Source Table):
 *   A. Layoffs, Workforce Reductions & Hiring Freezes
 *   B. Legal Actions (Courts & Lawsuits)
 *   C. Regulatory & Government Actions
 *   D. Financial Distress & Insolvency Signals
 *   E. Corporate Registry & Ownership Changes
 *   F. Data Breaches, Security Incidents & Sanctions
 *   G. Leadership & Governance Shocks
 *   H. Reputable Journalism & Investigative Reporting
 *   I. Government Blacklists, Bans & Restrictions
 *   J. Edge-Case but Valid Layer 6 Sources
 *
 * K. What NEVER belongs in Layer 6:
 *   - Rumors → L4
 *   - Reviews → L3 / L5
 *   - Social backlash → L4
 *   - Company PR → L1
 *   - Employee posts → L2
 *   - Analyst opinions → L2 or excluded
 *
 * NOTE: externalConsequences.ts already covers layoff search, leadership
 *       changes, lawsuits, funding, and SEC filings. This file adds
 *       the remaining ~50+ surfaces from the L6 Master Source Table.
 *
 * Important distinctions tracked:
 *   - "Filed" ≠ "guilty"
 *   - "Ruled" ≠ "alleged"
 *   - Multiple rounds = escalating severity, not duplicates
 *   - Calm succession ≠ crisis exit
 *   - Opinion pieces ≠ Layer 6. Reported facts with sources = Layer 6.
 */

// ════════════════════════════════════════════════════════════════════
// PUBLIC TYPES
// ════════════════════════════════════════════════════════════════════

export type L6SourceCategory =
  | 'A-layoffs'
  | 'B-legal-actions'
  | 'C-regulatory'
  | 'D-financial-distress'
  | 'E-corporate-registry'
  | 'F-breaches-sanctions'
  | 'G-leadership-governance'
  | 'H-investigative-journalism'
  | 'I-government-blacklists'
  | 'J-edge-cases'

export type L6Severity =
  | 'informational'    // Noted but low impact
  | 'warning'          // Elevated risk
  | 'serious'          // Material impact
  | 'critical'         // Existential or structural threat
  | 'terminal'         // Company viability in question

export type L6Status =
  | 'filed'            // Legal: case opened
  | 'pending'          // Under investigation / review
  | 'confirmed'        // Verified by authority
  | 'settled'          // Resolved with cost
  | 'ruled'            // Court or regulator ruled
  | 'ongoing'          // In progress
  | 'historical'       // Past event, context matters

export interface L6Signal {
  category: L6SourceCategory
  platform: string           // Source authority or publication
  region: string
  title: string
  snippet: string
  url: string
  date: string
  severity: L6Severity
  status: L6Status
  signalType: string         // e.g. 'regulatory-fine', 'bankruptcy-filing', 'breach-disclosure'
  whatItProves: string        // Human-readable consequence
  jurisdiction?: string      // Legal/regulatory jurisdiction
  authority?: string         // Which body acted (SEC, FCA, GDPR DPA, etc.)
  amount?: string            // Fine amount, settlement, headcount, etc.
  canBeCitedIndependently: boolean
}

export interface ExternalRealityResult {
  signals: L6Signal[]
  categoryBreakdown: Record<L6SourceCategory, number>
  platformBreakdown: Record<string, number>
  regionBreakdown: Record<string, number>
  severityBreakdown: Record<string, number>
  totalFound: number
  sourcesSearched: string[]
}

// ════════════════════════════════════════════════════════════════════
// INFERENCE HELPERS
// ════════════════════════════════════════════════════════════════════

function inferSeverity(text: string, category: L6SourceCategory): L6Severity {
  const lower = text.toLowerCase()

  // Terminal signals
  if (/\b(bankrupt|insolvency|insolvent|dissolved|liquidat|wind.?up|cease.?operat)\b/i.test(lower)) return 'terminal'
  if (/\b(fraud|criminal|indicted|prison|debarr|blacklist|banned)\b/i.test(lower)) return 'terminal'

  // Critical signals
  if (/\b(class action|massive fine|\$\d+\s*billion|billion.?dollar|sanctions?|embargo|license revok)\b/i.test(lower)) return 'critical'
  if (/\b(data breach|million.?records|gdpr fine|\$\d{3,}\s*million)\b/i.test(lower)) return 'critical'
  if (category === 'D-financial-distress') return 'critical'

  // Serious signals
  if (/\b(lawsuit|sued|settlement|fine|penalty|violation|enforcement|investigation|warning letter)\b/i.test(lower)) return 'serious'
  if (/\b(layoff|restructur|workforce reduction|job cut|let go|eliminate|downgrade)\b/i.test(lower)) return 'serious'
  if (/\b(resign|step.?down|fired|ousted|forced out|departed)\b/i.test(lower)) return 'serious'

  // Warning
  if (/\b(investigation|inquiry|probe|review|audit|concern|risk)\b/i.test(lower)) return 'warning'

  return 'informational'
}

function inferStatus(text: string): L6Status {
  const lower = text.toLowerCase()
  if (/\b(ruled|verdict|guilty|found liable|convicted|ordered to pay|judgment)\b/i.test(lower)) return 'ruled'
  if (/\b(settled|settlement|agreed to pay|consent decree|resolved)\b/i.test(lower)) return 'settled'
  if (/\b(confirmed|verified|disclosed|announced|admitted)\b/i.test(lower)) return 'confirmed'
  if (/\b(filed|alleges?|accused|charged|complaint filed|initiated|launched)\b/i.test(lower)) return 'filed'
  if (/\b(investigating|under review|probe|inquiry|pending|ongoing|examining)\b/i.test(lower)) return 'pending'
  if (/\b(2019|2020|2021|2022|previously|former|past|ago)\b/i.test(lower)) return 'historical'
  return 'confirmed'
}

function inferSignalType(text: string, title: string, category: L6SourceCategory): string {
  const combined = `${title} ${text}`.toLowerCase()

  const typeMap: [RegExp, string][] = [
    // A - Layoffs
    [/warn act|warn notice/i, 'warn-act-filing'],
    [/hiring freeze/i, 'hiring-freeze'],
    [/workforce reduction|layoff|laid off|job cut/i, 'workforce-reduction'],
    // B - Legal
    [/class action/i, 'class-action'],
    [/criminal/i, 'criminal-case'],
    [/labor court|employment tribunal/i, 'labor-court-decision'],
    [/settlement|settled/i, 'settlement'],
    [/verdict|judgment/i, 'court-verdict'],
    [/lawsuit|sued|civil/i, 'civil-lawsuit'],
    // C - Regulatory
    [/gdpr|data protection|privacy fine/i, 'gdpr-action'],
    [/sec |securities|exchange commission/i, 'sec-action'],
    [/fca |financial conduct/i, 'fca-action'],
    [/fin-fsa|finanssivalvonta/i, 'finfsa-action'],
    [/antitrust|competition|monopoly/i, 'antitrust-action'],
    [/consumer protection|ftc|federal trade/i, 'consumer-protection-action'],
    [/license revok|permit cancel/i, 'license-revocation'],
    [/aml|money launder|kyc/i, 'aml-enforcement'],
    [/regulatory fine|penalty|sanction/i, 'regulatory-fine'],
    // D - Financial
    [/bankrupt|insolvency/i, 'bankruptcy-filing'],
    [/going concern/i, 'going-concern-warning'],
    [/debt restructur/i, 'debt-restructuring'],
    [/missed.*payment|default/i, 'missed-payment'],
    [/credit.*downgrad|downgrad.*credit/i, 'credit-downgrade'],
    [/audit.*qualify|qualified opinion/i, 'audit-qualification'],
    // E - Registry
    [/dissolution|dissolved|struck off/i, 'company-dissolution'],
    [/merger|acquisition|acquired/i, 'merger-acquisition'],
    [/spin.?off|divest/i, 'spinoff-divestment'],
    [/shareholder.*change|ownership.*change/i, 'ownership-change'],
    [/director.*change|officer.*change/i, 'director-change'],
    // F - Breaches
    [/data breach|breach|hacked|compromised/i, 'data-breach'],
    [/sanction.?list|sanctioned/i, 'sanctions-listing'],
    [/security incident/i, 'security-incident'],
    // G - Leadership
    [/ceo.*resign|ceo.*step|ceo.*depart|ceo.*fired|ceo.*ousted/i, 'ceo-departure'],
    [/cfo.*resign|cfo.*step|cfo.*depart/i, 'cfo-departure'],
    [/board.*resign|board.*conflict/i, 'board-resignation'],
    [/founder.*exit|founder.*left|founder.*depart/i, 'founder-exit'],
    [/interim|acting.*ceo|acting.*cfo/i, 'interim-leadership'],
    // H - Journalism
    [/investigat.*report|exposé|reveal/i, 'investigative-report'],
    [/reuters|financial times|associated press|ap news/i, 'reputable-journalism'],
    // I - Blacklists
    [/trade ban|export restrict/i, 'trade-ban'],
    [/app.?store.*remov|banned from/i, 'app-store-removal'],
    [/banking.*terminat|bank.*cut|unbanked/i, 'banking-termination'],
    [/procurement.*ban|debarr/i, 'procurement-ban'],
  ]

  for (const [re, type] of typeMap) {
    if (re.test(combined)) return type
  }
  return 'external-event'
}

function inferWhatItProves(signalType: string, category: L6SourceCategory): string {
  const proveMap: Record<string, string> = {
    'warn-act-filing': 'Mandatory disclosure — workforce contraction',
    'hiring-freeze': 'Growth halted — cost pressure',
    'workforce-reduction': 'Structural change confirmed',
    'class-action': 'Systemic harm alleged',
    'criminal-case': 'Severe risk — criminal exposure',
    'labor-court-decision': 'Employment violation confirmed',
    'settlement': 'Cost of failure — paid to resolve',
    'court-verdict': 'Confirmed wrongdoing',
    'civil-lawsuit': 'Filed case — track status & outcome',
    'gdpr-action': 'Privacy violation — regulatory consequence',
    'sec-action': 'Securities compliance failure',
    'fca-action': 'Financial conduct breach',
    'finfsa-action': 'Finnish financial supervision action',
    'antitrust-action': 'Market abuse / competition violation',
    'consumer-protection-action': 'User harm confirmed by authority',
    'license-revocation': 'Right to operate revoked',
    'aml-enforcement': 'Financial crime risk confirmed',
    'regulatory-fine': 'Compliance failure — financial penalty',
    'bankruptcy-filing': 'Existential threat — structural failure',
    'going-concern-warning': 'Auditor questions survival',
    'debt-restructuring': 'Financial stress confirmed',
    'missed-payment': 'Liquidity crisis',
    'credit-downgrade': 'External risk assessment downgrade',
    'audit-qualification': 'Financial integrity questioned',
    'company-dissolution': 'End of life — entity terminated',
    'merger-acquisition': 'Strategic pivot — identity shift',
    'spinoff-divestment': 'Retrenchment — shedding parts',
    'ownership-change': 'Control shift — governance impact',
    'director-change': 'Leadership instability',
    'data-breach': 'Security failure — trust collapse moment',
    'sanctions-listing': 'Restricted operations — geopolitical risk',
    'security-incident': 'Operational security failure',
    'ceo-departure': 'Strategic instability — top leadership exit',
    'cfo-departure': 'Financial leadership gap',
    'board-resignation': 'Governance conflict signal',
    'founder-exit': 'Identity shift — founding vision departed',
    'interim-leadership': 'Uncertainty — no permanent leader',
    'investigative-report': 'Fact-based external exposure',
    'reputable-journalism': 'Verified reporting — canonical source',
    'trade-ban': 'Market exclusion — government action',
    'app-store-removal': 'Distribution loss — platform ban',
    'banking-termination': 'Fintech death spiral — lost banking partner',
    'procurement-ban': 'Trust collapse — public sector exclusion',
  }
  return proveMap[signalType] || 'External consequence verified'
}

function extractAmount(text: string): string | undefined {
  const match = text.match(/\$[\d,.]+\s*(?:million|billion|M|B|k)?/i) ||
    text.match(/€[\d,.]+\s*(?:million|billion|M|B)?/i) ||
    text.match(/£[\d,.]+\s*(?:million|billion|M|B)?/i) ||
    text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:employees|workers|people|jobs|staff)/i)
  return match ? match[0] : undefined
}

function inferJurisdiction(text: string, url: string): string | undefined {
  const lower = `${text} ${url}`.toLowerCase()
  if (/\bsec\b|edgar|securities.*exchange/i.test(lower)) return 'US (SEC)'
  if (/\bfca\b|financial conduct/i.test(lower)) return 'UK (FCA)'
  if (/\bgdpr\b|data protection authority/i.test(lower)) return 'EU (GDPR)'
  if (/\bftc\b|federal trade/i.test(lower)) return 'US (FTC)'
  if (/\bfin-fsa\b|finanssivalvonta/i.test(lower)) return 'Finland (FIN-FSA)'
  if (/\bfinma\b/i.test(lower)) return 'Switzerland (FINMA)'
  if (/\bbafin\b/i.test(lower)) return 'Germany (BaFin)'
  if (/\bamf\b/i.test(lower)) return 'France (AMF)'
  if (/\bconsob\b/i.test(lower)) return 'Italy (CONSOB)'
  if (/\bdoj\b|department of justice/i.test(lower)) return 'US (DOJ)'
  if (/\bnlrb\b/i.test(lower)) return 'US (NLRB)'
  if (/\beeoc\b/i.test(lower)) return 'US (EEOC)'
  if (/\bosha\b/i.test(lower)) return 'US (OSHA)'
  return undefined
}

function inferAuthority(text: string): string | undefined {
  const authorities: [RegExp, string][] = [
    [/\bSEC\b|securities.?exchange/i, 'SEC'],
    [/\bFCA\b|financial conduct/i, 'FCA'],
    [/\bFTC\b|federal trade/i, 'FTC'],
    [/\bDOJ\b|department of justice/i, 'DOJ'],
    [/\bGDPR\b|data protection auth/i, 'GDPR DPA'],
    [/\bNLRB\b/i, 'NLRB'],
    [/\bEEOC\b/i, 'EEOC'],
    [/\bOSHA\b/i, 'OSHA'],
    [/\bFDA\b/i, 'FDA'],
    [/\bEPA\b/i, 'EPA'],
    [/\bECB\b/i, 'ECB'],
    [/\bFIN-FSA\b|finanssivalvonta/i, 'FIN-FSA'],
    [/\bBaFin\b/i, 'BaFin'],
    [/\bFINMA\b/i, 'FINMA'],
    [/European Commission/i, 'European Commission'],
    [/attorney general/i, 'State AG'],
  ]
  for (const [re, name] of authorities) {
    if (re.test(text)) return name
  }
  return undefined
}

// ════════════════════════════════════════════════════════════════════
// SEARCH (SerpAPI removed)
// ════════════════════════════════════════════════════════════════════

async function serpSearch(
  _query: string,
  _numResults = 10,
): Promise<{ title: string; snippet: string; link: string; date?: string }[]> {
  return []
}

// ════════════════════════════════════════════════════════════════════
// SIGNAL BUILDER & HELPERS
// ════════════════════════════════════════════════════════════════════

function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim()
}

function toSignal(
  r: { title: string; snippet: string; link: string; date?: string },
  category: L6SourceCategory,
  platform: string,
  region: string,
): L6Signal {
  const text = `${r.title} ${r.snippet}`
  const signalType = inferSignalType(r.snippet, r.title, category)
  return {
    category,
    platform,
    region,
    title: cleanText(r.title),
    snippet: cleanText(r.snippet),
    url: r.link,
    date: r.date || 'Recent',
    severity: inferSeverity(text, category),
    status: inferStatus(text),
    signalType,
    whatItProves: inferWhatItProves(signalType, category),
    jurisdiction: inferJurisdiction(text, r.link),
    authority: inferAuthority(text),
    amount: extractAmount(text),
    canBeCitedIndependently: true,
  }
}

function deduplicateSignals(signals: L6Signal[]): L6Signal[] {
  const seen = new Set<string>()
  return signals.filter((s) => {
    const key = s.url.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ════════════════════════════════════════════════════════════════════
// A. LAYOFFS, WORKFORCE REDUCTIONS & HIRING FREEZES
//    (Supplementing externalConsequences.ts which does basic layoff search)
//    Multiple rounds = escalating severity, not duplicates.
// ════════════════════════════════════════════════════════════════════

async function searchLayoffsExpanded(companyName: string): Promise<L6Signal[]> {
  const signals: L6Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string }[] = [
    // WARN Act filings (US mandatory disclosure)
    { q: `"${cn}" "WARN Act" OR "WARN notice" OR "WARN filing" layoff`, platform: 'WARN Act (US)' },
    // Government labor offices
    { q: `"${cn}" "department of labor" OR "employment office" OR "labour ministry" workforce reduction`, platform: 'Government Labor Office' },
    // Union announcements regarding layoffs
    { q: `"${cn}" union announcement OR "collective bargaining" layoff OR restructuring OR "job losses"`, platform: 'Union Announcement' },
    // Layoffs.fyi data
    { q: `site:layoffs.fyi "${cn}"`, platform: 'Layoffs.fyi' },
    // Hiring freeze signals
    { q: `"${cn}" "hiring freeze" OR "paused hiring" OR "stopped recruiting" OR "not hiring"`, platform: 'Hiring Freeze Signal' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'A-layoffs', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// B. LEGAL ACTIONS (COURTS & LAWSUITS)
//    Allegations are tracked; outcomes are decisive.
//    "Filed" ≠ "guilty". "Ruled" ≠ "alleged".
//    (Supplementing externalConsequences.ts basic lawsuit search)
// ════════════════════════════════════════════════════════════════════

async function searchLegalActions(companyName: string): Promise<L6Signal[]> {
  const signals: L6Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string }[] = [
    // Civil court dockets
    { q: `"${cn}" civil court OR "district court" OR "superior court" case filing`, platform: 'Civil Court' },
    // Criminal court records
    { q: `"${cn}" criminal charges OR indictment OR "grand jury" OR "criminal investigation"`, platform: 'Criminal Court' },
    // Labor court decisions
    { q: `"${cn}" "labor court" OR "employment tribunal" OR "labor board" ruling OR decision`, platform: 'Labor Court' },
    // Class action filings — systemic harm
    { q: `"${cn}" "class action" filed OR certified OR settlement`, platform: 'Class Action' },
    // Settlements (public) — cost of failure
    { q: `"${cn}" settlement agreed OR "settled for" OR "consent decree" OR "paid to settle"`, platform: 'Settlement Record' },
    // Judgments & verdicts — confirmed wrongdoing
    { q: `"${cn}" verdict OR judgment OR "found liable" OR "guilty" OR "ordered to pay"`, platform: 'Court Verdict' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'B-legal-actions', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// C. REGULATORY & GOVERNMENT ACTIONS (CRITICAL)
//    Where fintech, health, and data companies live or die.
// ════════════════════════════════════════════════════════════════════

async function searchRegulatoryActions(companyName: string): Promise<L6Signal[]> {
  const signals: L6Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; region: string }[] = [
    // Financial regulators (SEC, FCA, FIN-FSA, etc.)
    { q: `"${cn}" SEC OR FCA OR "financial regulator" OR FINMA fine OR investigation OR enforcement`, platform: 'Financial Regulator', region: 'Global' },
    // Data protection authorities (GDPR)
    { q: `"${cn}" GDPR OR "data protection" OR "privacy fine" OR "DPA" enforcement OR violation`, platform: 'Data Protection Authority', region: 'EU' },
    // Competition authorities
    { q: `"${cn}" antitrust OR "competition authority" OR monopoly OR "market abuse" OR "unfair competition"`, platform: 'Competition Authority', region: 'Global' },
    // Consumer protection agencies
    { q: `"${cn}" FTC OR "consumer protection" OR "consumer bureau" OR CFPB enforcement OR complaint`, platform: 'Consumer Protection Agency', region: 'Global' },
    // Licensing bodies
    { q: `"${cn}" "license revoked" OR "license suspended" OR "permit cancelled" OR "authorization withdrawn"`, platform: 'Licensing Body', region: 'Global' },
    // AML / KYC enforcement
    { q: `"${cn}" AML OR "money laundering" OR KYC OR "financial crime" OR FinCEN enforcement`, platform: 'AML/KYC Enforcement', region: 'Global' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, region } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'C-regulatory', platform, region))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// D. FINANCIAL DISTRESS & INSOLVENCY SIGNALS
//    Money problems don't lie. These override all narrative layers.
// ════════════════════════════════════════════════════════════════════

async function searchFinancialDistress(companyName: string): Promise<L6Signal[]> {
  const signals: L6Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string }[] = [
    // Bankruptcy filings — existential threat
    { q: `"${cn}" bankruptcy OR "chapter 11" OR "chapter 7" OR insolvency filed`, platform: 'Bankruptcy Filing' },
    // Insolvency registries
    { q: `"${cn}" insolvency OR "insolvent" OR "court-appointed administrator" OR receiver`, platform: 'Insolvency Registry' },
    // Missed bond / debt payments — liquidity crisis
    { q: `"${cn}" "missed payment" OR default OR "debt restructuring" OR "bond default" OR "credit facility"`, platform: 'Debt Signal' },
    // Auditor "going concern" warnings — survival risk
    { q: `"${cn}" "going concern" OR "qualified opinion" OR "material uncertainty" auditor`, platform: 'Auditor Warning' },
    // Credit rating downgrades
    { q: `"${cn}" "credit downgrade" OR "rating downgrade" OR "negative outlook" Moody's OR S&P OR Fitch`, platform: 'Credit Rating Agency' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'D-financial-distress', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// E. CORPORATE REGISTRY & OWNERSHIP CHANGES
//    Authoritative, boring, and extremely important.
//    Registry data is ground truth.
// ════════════════════════════════════════════════════════════════════

async function searchCorporateRegistry(companyName: string): Promise<L6Signal[]> {
  const signals: L6Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; region: string }[] = [
    // National business registries
    { q: `"${cn}" "business registry" OR "company register" OR "companies house" OR "registered agent" status`, platform: 'Business Registry', region: 'Global' },
    // Shareholder changes — control shifts
    { q: `"${cn}" "shareholder change" OR "ownership change" OR "stake acquired" OR "controlling interest"`, platform: 'Shareholder Record', region: 'Global' },
    // Director / officer changes — leadership instability
    { q: `"${cn}" "director appointed" OR "director resigned" OR "officer change" OR "board change" filing`, platform: 'Director Filing', region: 'Global' },
    // Company dissolutions — end of life
    { q: `"${cn}" dissolved OR dissolution OR "struck off" OR "wound up" OR "deregistered"`, platform: 'Dissolution Record', region: 'Global' },
    // Mergers & acquisitions — strategic pivot
    { q: `"${cn}" merger OR acquisition OR acquired OR "taken over" OR "buyout"`, platform: 'M&A Record', region: 'Global' },
    // Spin-offs & divestments — retrenchment
    { q: `"${cn}" "spin off" OR divest OR divestiture OR "sold division" OR "sold unit"`, platform: 'Divestment Record', region: 'Global' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 4)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, region } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'E-corporate-registry', platform, region))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// F. DATA BREACHES, SECURITY INCIDENTS & SANCTIONS
//    Trust collapse moments.
//    A breach is Layer 6 even if the company spins it.
// ════════════════════════════════════════════════════════════════════

async function searchBreachesAndSanctions(companyName: string): Promise<L6Signal[]> {
  const signals: L6Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string }[] = [
    // Official breach notifications
    { q: `"${cn}" "data breach" OR "security breach" OR "breach notification" OR "compromised" OR "exposed"`, platform: 'Breach Disclosure' },
    // Regulatory breach notices
    { q: `"${cn}" "breach notice" OR "enforcement notice" OR "penalty notice" data OR privacy OR security`, platform: 'Regulatory Breach Notice' },
    // Public incident disclosures — accountability
    { q: `"${cn}" "security incident" OR "incident report" OR "post-mortem" outage OR breach`, platform: 'Incident Disclosure' },
    // Sanctions lists — restricted operations
    { q: `"${cn}" sanctions OR "sanctions list" OR "restricted entity" OR OFAC OR "entity list"`, platform: 'Sanctions List' },
    // Government advisories — elevated risk
    { q: `"${cn}" "government advisory" OR "security advisory" OR CISA OR "national security" warning`, platform: 'Government Advisory' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'F-breaches-sanctions', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// G. LEADERSHIP & GOVERNANCE SHOCKS
//    People leaving under pressure matter.
//    Context matters: calm succession ≠ crisis exit.
//    (Supplements externalConsequences.ts basic leadership search)
// ════════════════════════════════════════════════════════════════════

async function searchLeadershipGovernance(companyName: string): Promise<L6Signal[]> {
  const signals: L6Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string }[] = [
    // CEO/CFO resignation filings — strategic instability
    { q: `"${cn}" CEO OR CFO resigned OR "steps down" OR "stepping down" OR ousted OR fired OR "forced out"`, platform: 'Leadership Filing' },
    // Board resignations — governance conflict
    { q: `"${cn}" board member OR director resigned OR "governance" conflict OR dispute`, platform: 'Board Filing' },
    // Forced removals — crisis
    { q: `"${cn}" executive "forced out" OR removed OR terminated OR "fired" OR "ousted"`, platform: 'Forced Removal' },
    // Interim leadership — uncertainty
    { q: `"${cn}" "interim CEO" OR "acting CEO" OR "interim CFO" OR "temporary leadership"`, platform: 'Interim Leadership' },
    // Founder exits — identity shift
    { q: `"${cn}" founder left OR departed OR "stepped away" OR "no longer" OR exit`, platform: 'Founder Exit' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'G-leadership-governance', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// H. REPUTABLE JOURNALISM & INVESTIGATIVE REPORTING
//    Journalism becomes Layer 6 only when it reports facts, not opinions.
//    Opinion pieces ≠ Layer 6. Reported facts with sources = Layer 6.
// ════════════════════════════════════════════════════════════════════

async function searchInvestigativeJournalism(companyName: string): Promise<L6Signal[]> {
  const signals: L6Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string }[] = [
    // Reuters — canonical
    { q: `site:reuters.com "${cn}" investigation OR lawsuit OR fine OR layoff OR breach`, platform: 'Reuters' },
    // Financial Times — business authority
    { q: `site:ft.com "${cn}" investigation OR regulation OR fine OR lawsuit`, platform: 'Financial Times' },
    // Associated Press — factual
    { q: `site:apnews.com "${cn}" investigation OR lawsuit OR fine OR breach`, platform: 'Associated Press' },
    // Bloomberg
    { q: `site:bloomberg.com "${cn}" investigation OR lawsuit OR fine OR regulatory OR layoff`, platform: 'Bloomberg' },
    // Wall Street Journal
    { q: `site:wsj.com "${cn}" investigation OR lawsuit OR fine OR regulatory`, platform: 'Wall Street Journal' },
    // Local investigative outlets — regional truth
    { q: `"${cn}" investigation OR exposé OR investigative report -site:reddit.com -site:twitter.com -opinion -editorial`, platform: 'Investigative Outlet' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      // Filter out opinion pieces — only fact-based reporting
      const combined = `${r.title} ${r.snippet}`.toLowerCase()
      if (/\b(opinion|editorial|op-?ed|commentary|column|analysis|my take)\b/i.test(combined)) continue
      signals.push(toSignal(r, 'H-investigative-journalism', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// I. GOVERNMENT BLACKLISTS, BANS & RESTRICTIONS
//    Hard stop signals. These override all softer layers.
// ════════════════════════════════════════════════════════════════════

async function searchGovernmentBlacklists(companyName: string): Promise<L6Signal[]> {
  const signals: L6Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string }[] = [
    // Trade bans — market exclusion
    { q: `"${cn}" "trade ban" OR "export ban" OR "entity list" OR "restricted entity" OR embargo`, platform: 'Trade Ban' },
    // App store removals (official, not user-side)
    { q: `"${cn}" app removed OR banned OR "pulled from" "app store" OR "play store" official government`, platform: 'App Store Removal (Official)' },
    // Banking partner termination — fintech death spiral
    { q: `"${cn}" "banking partner" terminated OR "bank account closed" OR "unbanked" OR "de-risked" OR "payment processor" dropped`, platform: 'Banking Termination' },
    // Export restrictions
    { q: `"${cn}" "export restriction" OR "export control" OR "restricted technology" OR "dual use"`, platform: 'Export Restriction' },
    // Public procurement bans — trust collapse
    { q: `"${cn}" "procurement ban" OR "debarment" OR "suspended from" government contract OR "public tender"`, platform: 'Procurement Ban' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 4)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'I-government-blacklists', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// J. EDGE-CASE BUT VALID LAYER 6 SOURCES
// ════════════════════════════════════════════════════════════════════

async function searchEdgeCaseSources(companyName: string): Promise<L6Signal[]> {
  const signals: L6Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; proves: string }[] = [
    // Auditor reports — financial integrity
    { q: `"${cn}" auditor report OR "audit opinion" OR "material weakness" OR "internal control"`, platform: 'Auditor Report', proves: 'Financial integrity assessment' },
    // EU infringement procedures — regulatory escalation
    { q: `"${cn}" "infringement procedure" OR "EU investigation" OR "European Commission" enforcement`, platform: 'EU Infringement', proves: 'Regulatory escalation at EU level' },
    // International sanctions — geopolitical risk
    { q: `"${cn}" "international sanctions" OR "UN sanctions" OR "EU sanctions" OR "US sanctions"`, platform: 'International Sanctions', proves: 'Geopolitical risk confirmed' },
    // Court-approved settlements — legal admission
    { q: `"${cn}" "court-approved" settlement OR "consent order" OR "plea agreement"`, platform: 'Court-Approved Settlement', proves: 'Legal admission — paid to resolve' },
    // Government fines published in gazettes — authoritative
    { q: `"${cn}" "official gazette" OR "federal register" fine OR penalty OR enforcement`, platform: 'Official Gazette', proves: 'Authoritative government record' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 4)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, proves } = queries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'J-edge-cases', platform, 'Global')
      sig.whatItProves = proves
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ════════════════════════════════════════════════════════════════════

/**
 * Fetch ALL L6 External Reality signals.
 * Runs all 10 categories (A–J) in parallel.
 *
 * NOTE: This supplements externalConsequences.ts which covers
 * basic layoff, leadership, lawsuit, funding, and SEC filing searches.
 * This file adds the remaining ~60+ surfaces from the L6 Master Source Table.
 */
export async function fetchExternalReality(
  companyName: string,
): Promise<ExternalRealityResult> {
  const sourcesSearched: string[] = []

  // Run ALL L6 categories in parallel
  const [
    layoffsExpanded,
    legalActions,
    regulatoryActions,
    financialDistress,
    corporateRegistry,
    breachesSanctions,
    leadershipGovernance,
    investigativeJournalism,
    governmentBlacklists,
    edgeCases,
  ] = await Promise.allSettled([
    searchLayoffsExpanded(companyName),
    searchLegalActions(companyName),
    searchRegulatoryActions(companyName),
    searchFinancialDistress(companyName),
    searchCorporateRegistry(companyName),
    searchBreachesAndSanctions(companyName),
    searchLeadershipGovernance(companyName),
    searchInvestigativeJournalism(companyName),
    searchGovernmentBlacklists(companyName),
    searchEdgeCaseSources(companyName),
  ])

  const allSignals: L6Signal[] = []

  const collect = (settled: PromiseSettledResult<L6Signal[]>, source: string) => {
    sourcesSearched.push(source)
    if (settled.status === 'fulfilled') {
      allSignals.push(...settled.value)
    }
  }

  collect(layoffsExpanded, 'WARN-Act/LaborOffice/Union/Layoffs.fyi/HiringFreeze (SerpAPI)')
  collect(legalActions, 'CivilCourt/CriminalCourt/LaborCourt/ClassAction/Settlements/Verdicts (SerpAPI)')
  collect(regulatoryActions, 'SEC/FCA/GDPR-DPA/Competition/ConsumerProtection/AML-KYC (SerpAPI)')
  collect(financialDistress, 'Bankruptcy/Insolvency/DebtDefault/GoingConcern/CreditDowngrade (SerpAPI)')
  collect(corporateRegistry, 'BusinessRegistry/Shareholders/Directors/Dissolutions/M&A/Divestments (SerpAPI)')
  collect(breachesSanctions, 'BreachDisclosure/RegulatoryNotice/IncidentReport/SanctionsList/GovAdvisory (SerpAPI)')
  collect(leadershipGovernance, 'CEO-CFO-Departure/BoardResignation/ForcedRemoval/InterimLeadership/FounderExit (SerpAPI)')
  collect(investigativeJournalism, 'Reuters/FT/AP/Bloomberg/WSJ/InvestigativeOutlets (SerpAPI)')
  collect(governmentBlacklists, 'TradeBan/AppStoreRemoval/BankingTermination/ExportRestriction/ProcurementBan (SerpAPI)')
  collect(edgeCases, 'AuditorReport/EU-Infringement/IntlSanctions/CourtSettlement/OfficialGazette (SerpAPI)')

  // Deduplicate across all categories
  const dedupedSignals = deduplicateSignals(allSignals)

  // Build breakdowns
  const categoryBreakdown: Record<L6SourceCategory, number> = {
    'A-layoffs': 0,
    'B-legal-actions': 0,
    'C-regulatory': 0,
    'D-financial-distress': 0,
    'E-corporate-registry': 0,
    'F-breaches-sanctions': 0,
    'G-leadership-governance': 0,
    'H-investigative-journalism': 0,
    'I-government-blacklists': 0,
    'J-edge-cases': 0,
  }
  const platformBreakdown: Record<string, number> = {}
  const regionBreakdown: Record<string, number> = {}
  const severityBreakdown: Record<string, number> = {}

  for (const s of dedupedSignals) {
    categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + 1
    platformBreakdown[s.platform] = (platformBreakdown[s.platform] || 0) + 1
    regionBreakdown[s.region] = (regionBreakdown[s.region] || 0) + 1
    severityBreakdown[s.severity] = (severityBreakdown[s.severity] || 0) + 1
  }

  console.log(
    `[ExternalReality] L6 scan complete: ${dedupedSignals.length} signals across ${Object.keys(platformBreakdown).length} platforms. ` +
      `Severity: ${Object.entries(severityBreakdown).map(([k, v]) => `${k}:${v}`).join(', ')}`,
  )

  return {
    signals: dedupedSignals,
    categoryBreakdown,
    platformBreakdown,
    regionBreakdown,
    severityBreakdown,
    totalFound: dedupedSignals.length,
    sourcesSearched,
  }
}
