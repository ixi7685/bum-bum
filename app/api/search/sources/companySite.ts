/**
 * L1 — Official Narrative Scraper (Master Source Table)
 *
 * Exhaustive scraper that discovers and fetches ALL company-controlled
 * web surfaces across Categories A–G of the Master Source Table.
 *
 * Key design decisions:
 * - Real browser User-Agent (avoids bot blocking on most sites)
 * - Parallel page probing — all surfaces + all path variants at once
 * - Retry logic with backoff on transient errors
 * - Rich HTML extraction (meta descriptions, paragraphs, lists, headings)
 * - Higher text limits (6 000 chars / page) for richer AI context
 * - 20+ regex claim-extraction patterns covering culture, benefits, legal, ESG
 * - SerpAPI fallback for domain discovery AND content enrichment
 * - Homepage content extraction for social / claim / culture discovery
 */

// ════════════════════════════════════════════════════════════════════
// PUBLIC TYPES (keep stable — imported by aggregator, types, route)
// ════════════════════════════════════════════════════════════════════

export interface PageContent {
  url: string
  title: string
  headings: string[]
  text: string
  keyPhrases: string[]
}

export interface JobPosting {
  title: string
  location: string
  snippet: string
  url: string
}

export interface DiscoveredSocialAccount {
  platform: string
  url: string
  handle: string
}

export interface DetectedATSPlatform {
  platform: string
  url: string
  jobCount: number
}

export interface CompanySiteResult {
  companyDomain: string | null

  // ── Category A: Core Company-Owned Web Properties ──────────────
  aboutPage: PageContent | null
  careersPage: PageContent | null
  pressPage: PageContent | null
  visionValuesPage: PageContent | null
  culturePage: PageContent | null
  benefitsPage: PageContent | null
  deiEsgPage: PageContent | null
  sustainabilityPage: PageContent | null
  blogPage: PageContent | null
  caseStudiesPage: PageContent | null
  testimonialsPage: PageContent | null
  customerStoriesPage: PageContent | null
  partnersPage: PageContent | null
  pricingPage: PageContent | null
  productFeaturesPage: PageContent | null
  roadmapPage: PageContent | null
  statusPage: PageContent | null
  trustSecurityPage: PageContent | null
  compliancePage: PageContent | null

  // ── Category E: Product Surfaces ───────────────────────────────
  docsPage: PageContent | null
  apiDocsPage: PageContent | null
  developerPortalPage: PageContent | null
  changelogPage: PageContent | null
  releaseNotesPage: PageContent | null

  // ── Category F: Investor Surfaces ──────────────────────────────
  investorRelationsPage: PageContent | null

  // ── Category G: Legal Surfaces ─────────────────────────────────
  termsPage: PageContent | null
  privacyPage: PageContent | null
  cookiePolicyPage: PageContent | null
  refundPolicyPage: PageContent | null
  codeOfConductPage: PageContent | null
  ethicsPolicyPage: PageContent | null
  whistleblowerPage: PageContent | null

  // ── Category B: Social Media Brand Accounts ────────────────────
  discoveredSocialAccounts: DiscoveredSocialAccount[]

  // ── Category D: ATS / Hiring Platforms ─────────────────────────
  detectedATSPlatforms: DetectedATSPlatform[]

  // ── Extracted Intelligence ─────────────────────────────────────
  claimedValues: string[]
  benefitsClaims: string[]
  cultureKeywords: string[]
  jobPostings: JobPosting[]

  // ── Coverage Stats ─────────────────────────────────────────────
  surfacesScanned: number
  surfacesFound: number

  lastUpdated: string
}

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

/** Real Chrome-on-Windows User-Agent — avoids bot blocking */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** Standard browser-like request headers */
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': UA,
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
}

/** All L1 page surface definitions: [result-key, path-alternatives] */
const L1_SURFACE_PATHS: Record<string, string[]> = {
  // ── Category A: Core Web Properties ──
  aboutPage:             ['/about', '/about-us', '/company', '/who-we-are', '/our-story'],
  careersPage:           ['/careers', '/jobs', '/join-us', '/work-with-us', '/careers/openings', '/join'],
  pressPage:             ['/press', '/newsroom', '/news', '/media', '/press-releases'],
  visionValuesPage:      ['/values', '/our-values', '/mission', '/vision', '/principles', '/mission-and-values'],
  culturePage:           ['/culture', '/life-at', '/working-here', '/our-culture', '/life'],
  benefitsPage:          ['/benefits', '/perks', '/total-rewards', '/compensation', '/benefits-and-perks'],
  deiEsgPage:            ['/diversity', '/dei', '/inclusion', '/esg', '/belonging', '/equity', '/diversity-equity-inclusion', '/social-responsibility'],
  sustainabilityPage:    ['/sustainability', '/environment', '/environmental', '/impact', '/csr', '/corporate-responsibility'],
  blogPage:              ['/blog', '/insights', '/articles', '/resources/blog', '/thought-leadership'],
  caseStudiesPage:       ['/case-studies', '/success-stories', '/customer-success', '/portfolio', '/work'],
  testimonialsPage:      ['/testimonials', '/reviews', '/what-clients-say', '/customer-reviews'],
  customerStoriesPage:   ['/customers', '/customer-stories', '/our-customers', '/clients'],
  partnersPage:          ['/partners', '/partner-program', '/alliances', '/ecosystem', '/integrations'],
  pricingPage:           ['/pricing', '/plans', '/packages', '/pricing-plans'],
  productFeaturesPage:   ['/features', '/product', '/platform', '/solutions', '/capabilities'],
  roadmapPage:           ['/roadmap', '/whats-new', '/upcoming', '/product-roadmap'],
  statusPage:            ['/status', '/system-status', '/uptime'],
  trustSecurityPage:     ['/trust', '/security', '/trust-center', '/security-center', '/trust-and-safety'],
  compliancePage:        ['/compliance', '/certifications', '/regulations', '/governance'],

  // ── Category E: Product Surfaces ──
  docsPage:              ['/docs', '/documentation', '/help', '/support/docs', '/knowledge-base'],
  apiDocsPage:           ['/api', '/api-docs', '/developers/api', '/api-reference'],
  developerPortalPage:   ['/developers', '/developer', '/dev', '/developer-portal'],
  changelogPage:         ['/changelog', '/updates', '/release-notes', '/whats-new'],
  releaseNotesPage:      ['/releases', '/release-notes', '/version-history'],

  // ── Category F: Investor Surfaces ──
  investorRelationsPage: ['/investors', '/investor-relations', '/ir', '/shareholders', '/financial'],

  // ── Category G: Legal Surfaces ──
  termsPage:             ['/terms', '/terms-of-service', '/tos', '/terms-and-conditions', '/legal/terms'],
  privacyPage:           ['/privacy', '/privacy-policy', '/legal/privacy', '/data-privacy'],
  cookiePolicyPage:      ['/cookie-policy', '/cookies', '/legal/cookies'],
  refundPolicyPage:      ['/refund', '/refund-policy', '/cancellation', '/returns', '/money-back'],
  codeOfConductPage:     ['/code-of-conduct', '/conduct', '/community-guidelines', '/guidelines'],
  ethicsPolicyPage:      ['/ethics', '/ethics-policy', '/business-ethics', '/integrity'],
  whistleblowerPage:     ['/whistleblower', '/speak-up', '/ethics-hotline', '/report-concern'],
}

/** Social media platform URL patterns for discovery */
const SOCIAL_PLATFORM_PATTERNS: { platform: string; patterns: RegExp[] }[] = [
  { platform: 'LinkedIn',  patterns: [/linkedin\.com\/company\/[^\s"'<>]+/gi] },
  { platform: 'X/Twitter', patterns: [/(?:twitter|x)\.com\/[^\s"'<>]+/gi] },
  { platform: 'Facebook',  patterns: [/facebook\.com\/[^\s"'<>]+/gi] },
  { platform: 'Instagram', patterns: [/instagram\.com\/[^\s"'<>]+/gi] },
  { platform: 'TikTok',    patterns: [/tiktok\.com\/@[^\s"'<>]+/gi] },
  { platform: 'YouTube',   patterns: [/youtube\.com\/(?:c\/|channel\/|@)[^\s"'<>]+/gi] },
  { platform: 'Threads',   patterns: [/threads\.net\/@[^\s"'<>]+/gi] },
  { platform: 'Discord',   patterns: [/discord\.(?:gg|com)\/[^\s"'<>]+/gi] },
  { platform: 'Telegram',  patterns: [/t\.me\/[^\s"'<>]+/gi] },
  { platform: 'GitHub',    patterns: [/github\.com\/[^\s"'<>]+/gi] },
]

/** Known ATS / hiring platform domains */
const ATS_PLATFORM_PATTERNS: { platform: string; pattern: RegExp }[] = [
  { platform: 'Greenhouse',       pattern: /boards\.greenhouse\.io\/[^\s"'<>]+/gi },
  { platform: 'Lever',            pattern: /jobs\.lever\.co\/[^\s"'<>]+/gi },
  { platform: 'Workday',          pattern: /[\w-]+\.wd\d*\.myworkdayjobs\.com/gi },
  { platform: 'Ashby',            pattern: /jobs\.ashbyhq\.com\/[^\s"'<>]+/gi },
  { platform: 'SmartRecruiters',  pattern: /jobs\.smartrecruiters\.com\/[^\s"'<>]+/gi },
  { platform: 'BambooHR',         pattern: /[\w-]+\.bamboohr\.com\/(?:jobs|careers)/gi },
  { platform: 'Recruitee',        pattern: /[\w-]+\.recruitee\.com/gi },
  { platform: 'SAP SuccessFactors', pattern: /[\w-]+\.successfactors\.com/gi },
  { platform: 'iCIMS',            pattern: /careers-[\w-]+\.icims\.com/gi },
  { platform: 'Jobvite',          pattern: /jobs\.jobvite\.com\/[^\s"'<>]+/gi },
]

// ════════════════════════════════════════════════════════════════════
// DOMAIN DISCOVERY
// ════════════════════════════════════════════════════════════════════

async function discoverDomain(companyName: string): Promise<string | null> {
  const normalised = companyName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const withHyphens = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const guesses = [
    `https://www.${normalised}.com`,
    `https://${normalised}.com`,
    ...(withHyphens !== normalised
      ? [`https://www.${withHyphens}.com`, `https://${withHyphens}.com`]
      : []),
    `https://${normalised}.io`,
    `https://${normalised}.co`,
    `https://${normalised}.org`,
    `https://${normalised}.dev`,
    `https://${normalised}.ai`,
    `https://${normalised}.app`,
    `https://${normalised}.tech`,
    `https://${normalised}.net`,
  ]

  // Probe ALL domain guesses in parallel (fast!)
  const results = await Promise.allSettled(
    guesses.map(async (url) => {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': UA },
        redirect: 'follow',
        signal: AbortSignal.timeout(6000),
      })
      if (res.ok) return new URL(res.url).origin
      throw new Error('not ok')
    }),
  )

  // Return the first successful result
  for (const r of results) {
    if (r.status === 'fulfilled') return r.value
  }

  // No domain found via probing
  return null
}

// ════════════════════════════════════════════════════════════════════
// HTML FETCHING & PARSING
// ════════════════════════════════════════════════════════════════════

/**
 * Fetch a single URL with retry logic and browser-like headers.
 * Returns null for non-HTML responses and on failure.
 */
async function fetchPageContent(url: string): Promise<PageContent | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: BROWSER_HEADERS,
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        // Retry once on 429 (rate-limit)
        if (attempt === 0 && res.status === 429) {
          await new Promise((r) => setTimeout(r, 1000))
          continue
        }
        return null
      }
      // Skip non-HTML (PDFs, images, etc.)
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('text/html') && !ct.includes('application/xhtml')) {
        return null
      }
      const html = await res.text()
      return parseHtml(url, html)
    } catch {
      // Retry once on network error
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 500))
        continue
      }
      return null
    }
  }
  return null
}

/**
 * Fetch raw HTML body only (used for homepage link discovery).
 */
async function fetchRawHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

/**
 * Parse raw HTML into structured PageContent.
 *
 * Extracts: title, meta descriptions, headings (h1-h4), paragraphs,
 * list items, and strips HTML to plain text.  Keeps up to 6 000 chars.
 */
function parseHtml(url: string, html: string): PageContent {
  // ── Meta descriptions (rich SEO summaries) ──
  const metaDescMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
  const metaDesc = metaDescMatch ? cleanHtml(metaDescMatch[1]) : ''

  const ogDescMatch = html.match(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
  )
  const ogDesc = ogDescMatch ? cleanHtml(ogDescMatch[1]) : ''

  // ── Title ──
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? cleanHtml(titleMatch[1]) : ''

  // ── Headings (h1–h4) ──
  const headings: string[] = []
  const hRegex = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi
  let m: RegExpExecArray | null
  while ((m = hRegex.exec(html)) !== null) {
    const h = cleanHtml(m[1])
    if (h.length > 2 && h.length < 300) headings.push(h)
  }

  // ── List items (benefits, values, feature lists) ──
  const listItems: string[] = []
  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi
  while ((m = liRegex.exec(html)) !== null) {
    const li = cleanHtml(m[1])
    if (li.length > 8 && li.length < 300) listItems.push(li)
  }

  // ── Paragraphs ──
  const paragraphs: string[] = []
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi
  while ((m = pRegex.exec(html)) !== null) {
    const p = cleanHtml(m[1])
    if (p.length > 15) paragraphs.push(p)
  }

  // ── Strip to plain text ──
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Prepend meta descriptions so the AI always sees them
  const metaPrefix = [metaDesc, ogDesc].filter(Boolean).join(' | ')
  if (metaPrefix) {
    text = `[Meta] ${metaPrefix} | ${text}`
  }

  // ── Append structured paragraph & list content ──
  // This captures content that may have been lost in generic strip
  const structuredExtra: string[] = []
  for (const p of paragraphs.slice(0, 40)) {
    if (p.length > 30 && !text.includes(p.substring(0, 50))) {
      structuredExtra.push(p)
    }
  }
  for (const li of listItems.slice(0, 30)) {
    if (!text.includes(li.substring(0, 30))) {
      structuredExtra.push(`• ${li}`)
    }
  }
  if (structuredExtra.length > 0) {
    text += ' [Structured] ' + structuredExtra.join(' | ')
  }

  // Keep 6 000 chars — significantly more context for claim extraction
  const truncated = text.length > 6000 ? text.substring(0, 6000) + '…' : text

  // Extract key claims
  const keyPhrases = extractClaims(truncated, headings, listItems)

  return {
    url,
    title,
    headings: headings.slice(0, 30),
    text: truncated,
    keyPhrases,
  }
}

function cleanHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ════════════════════════════════════════════════════════════════════
// CLAIM EXTRACTION — 20+ pattern families
// ════════════════════════════════════════════════════════════════════

function extractClaims(
  text: string,
  headings: string[],
  listItems: string[] = [],
): string[] {
  const claims: string[] = []
  const patterns: RegExp[] = [
    // ── Company identity ──
    /we (?:believe|value|are committed|strive|prioritize|foster|encourage|support|celebrate|champion|invest|empower|create|build|deliver|provide|enable|ensure|embrace|promote)\b[^.!?]{5,180}[.!?]/gi,
    /our (?:mission|vision|values|culture|team|people|commitment|goal|purpose|promise|approach|philosophy|way|belief|focus|priority|pledge)\b[^.!?]{5,180}[.!?]/gi,
    /(?:at|here at)\s+\w[\w\s]{0,30},?\s+(?:we|our)\b[^.!?]{10,200}[.!?]/gi,

    // ── Culture & workplace ──
    /(?:diversity|inclusion|equity|belonging|work-life|wellness|growth|innovation|transparency|integrity|excellence|accountability|trust|respect|empathy|compassion)\b[^.!?]{5,180}[.!?]/gi,
    /(?:competitive|generous|unlimited|flexible|world-class|industry-leading|best-in-class|comprehensive)\s+(?:salary|compensation|benefits|PTO|vacation|perks|packages?|offerings?)\b[^.!?]{5,180}[.!?]/gi,
    /(?:award-winning|top-rated|certified|recognized|ranked|named)\b[^.!?]{5,180}[.!?]/gi,
    /(?:great place to work|best workplace|employer of choice|top employer|happiest employees)\b[^.!?]{5,180}[.!?]/gi,

    // ── Legal / compliance ──
    /we (?:protect|respect|safeguard|take seriously|comply|adhere|maintain|uphold)\b[^.!?]{5,180}[.!?]/gi,
    /(?:GDPR|SOC 2|ISO 27001|HIPAA|PCI|FedRAMP|CCPA|COPPA|SOX)\b[^.!?]{5,200}[.!?]/gi,

    // ── ESG / sustainability ──
    /(?:carbon neutral|net zero|renewable|sustainable|ESG|social impact|environmental|climate|green|responsible)\b[^.!?]{5,200}[.!?]/gi,
    /(?:community|giving back|volunteer|philanthropy|foundation|donate|social good)\b[^.!?]{5,180}[.!?]/gi,

    // ── Investor / financial / scale ──
    /(?:revenue|growth|ARR|funding|series [A-Z]|IPO|profitable|EBITDA|customer base|million|billion)\b[^.!?]{5,200}[.!?]/gi,
    /(?:founded|established|since|started)\s+(?:in\s+)?\d{4}\b[^.!?]{5,120}[.!?]/gi,
    /(?:trusted by|used by|loved by|powering|serving|helping)\s+(?:\d+[\w\s]*|millions?|thousands?|leading|major|enterprise|global)\b[^.!?]{5,200}[.!?]/gi,
    /(?:enterprise|startup|scale-up|Fortune \d+|Inc\. \d+|Forbes)\b[^.!?]{5,180}[.!?]/gi,

    // ── Benefits & perks ──
    /(?:we offer|you(?:'ll| will) (?:get|receive|enjoy)|what we offer|benefits include|perks include|our benefits|our perks|total rewards)\b[^.!?]{10,300}[.!?]/gi,
    /(?:health|dental|vision|401k|equity|stock|RSU|ESPP|bonus|stipend|allowance|reimbursement|insurance|coverage)\b[^.!?]{5,180}[.!?]/gi,
    /(?:parental|maternity|paternity|family)\s+(?:leave|time|benefits)\b[^.!?]{5,180}[.!?]/gi,
    /(?:remote|hybrid|flexible|work from|WFH|home office)\b[^.!?]{5,120}[.!?]/gi,
    /(?:learning|development|training|education|tuition|conference|professional growth)\b[^.!?]{5,180}[.!?]/gi,
    /(?:free\s+(?:lunch|food|snacks|drinks|meals|coffee)|catered|gym|fitness)\b[^.!?]{5,150}[.!?]/gi,

    // ── Product & trust ──
    /(?:uptime|SLA|availability|data protection|encryption|zero trust|security first)\b[^.!?]{5,200}[.!?]/gi,

    // ── Catch-all strong claims ──
    /(?:we are|we have|we're)\s+(?:the|a)\s+(?:leading|top|premier|fastest|largest|most|only|first)\b[^.!?]{5,180}[.!?]/gi,
  ]

  for (const rx of patterns) {
    let m: RegExpExecArray | null
    while ((m = rx.exec(text)) !== null) {
      const claim = m[0].trim()
      if (claim.length > 15 && !claims.includes(claim)) {
        claims.push(claim)
      }
    }
  }

  // Headings that look like value-loaded statements
  const headingRx =
    /value|mission|culture|principle|commit|believe|pillar|ethic|trust|security|privacy|sustain|divers|inclusion|benefit|perk|wellness|team|people|community|innovat|growth|career|leader|integrit|purpose|impact|belong|equit/i
  for (const h of headings) {
    if (headingRx.test(h)) claims.push(`[Heading] ${h}`)
  }

  // List items that look like values / benefits
  const listRx =
    /health|dental|vision|401k|equity|stock|PTO|vacation|remote|flexible|learning|training|wellness|parental|diversity|inclusion|transparency|innovation|integrity|trust|respect|unlimited|sabbatical|stipend|gym|snack|meal|insurance/i
  for (const li of listItems) {
    if (listRx.test(li)) claims.push(`[List] ${li}`)
  }

  return claims.slice(0, 40)
}

// ════════════════════════════════════════════════════════════════════
// JOB POSTING EXTRACTION
// ════════════════════════════════════════════════════════════════════

function extractJobPostings(
  careersText: string,
  baseUrl: string,
): JobPosting[] {
  const postings: JobPosting[] = []
  const lines = careersText.split(/\n|(?<=[.!?])\s+/)

  for (const line of lines) {
    const clean = line.trim()
    if (
      clean.length > 10 &&
      clean.length < 120 &&
      /engineer|designer|manager|analyst|developer|lead|director|coordinator|specialist|architect|scientist|recruiter|head of|vp |vice president|product|marketing|sales|operations|finance|legal|compliance|data|machine learning|ai |ml |devops|sre |security|platform|mobile|frontend|backend|full.?stack/i.test(
        clean,
      )
    ) {
      postings.push({
        title: clean,
        location: 'See listing',
        snippet: '',
        url: baseUrl,
      })
    }
  }

  return postings.slice(0, 15)
}

// ════════════════════════════════════════════════════════════════════
// CULTURE KEYWORD EXTRACTION — 70+ keywords
// ════════════════════════════════════════════════════════════════════

function extractCultureKeywords(text: string): string[] {
  const keywords = new Set<string>()
  const kw = [
    // Classic values
    'innovation', 'integrity', 'diversity', 'inclusion', 'equity',
    'transparency', 'collaboration', 'excellence', 'accountability',
    'sustainability', 'agile', 'customer-first', 'empowerment',
    'meritocracy', 'flat hierarchy', 'open door', 'fast-paced',
    'family', 'ownership', 'passion', 'hustle', 'disrupt',
    // Work style
    'work-life balance', 'flexible', 'remote', 'hybrid',
    'unlimited PTO', 'wellness', 'mental health',
    'people-first', 'mission-driven', 'data-driven',
    'psychological safety', 'growth mindset', 'servant leadership',
    'radical candor', 'fail fast', 'move fast',
    'trust', 'autonomy', 'impact', 'purpose',
    // Team & culture
    'respect', 'empathy', 'learning', 'development', 'teamwork',
    'results-oriented', 'entrepreneurial', 'customer obsessed',
    'bias for action', 'high performance', 'no ego', 'humility',
    'curiosity', 'resilience', 'scrappy', 'bootstrapped',
    'open source', 'community', 'giving back', 'volunteer',
    'ethical', 'responsible', 'inclusive', 'belonging',
    'safe space', 'one team', 'cross-functional',
    'async', 'distributed', 'global',
    // Perks & benefits keywords
    'dog-friendly', 'pet-friendly', 'snacks', 'catered meals',
    'unlimited vacation', 'sabbatical', 'workation',
    'stock options', 'RSU', 'ESPP', '401k match',
    'professional development', 'conference budget', 'learning budget',
    'health insurance', 'dental', 'vision', 'life insurance',
    'parental leave', 'fertility', 'adoption', 'childcare',
    'commuter benefits', 'gym membership', 'wellness stipend',
  ]

  const lower = text.toLowerCase()
  for (const k of kw) {
    if (lower.includes(k.toLowerCase())) keywords.add(k)
  }
  return Array.from(keywords)
}

// ════════════════════════════════════════════════════════════════════
// BENEFITS CLAIM EXTRACTION — 10+ pattern families
// ════════════════════════════════════════════════════════════════════

function extractBenefitsClaims(text: string): string[] {
  const claims: string[] = []
  const patterns = [
    /(?:we offer|benefits include|perks|what we offer|you'll get|you will receive|our benefits|our perks|total rewards)[^.!?]{10,300}[.!?]/gi,
    /(?:unlimited|generous|competitive|comprehensive|industry-leading)\s+(?:PTO|vacation|benefits|healthcare|dental|vision|401k|equity|stock|RSU)[^.!?]{5,200}[.!?]/gi,
    /(?:parental leave|maternity|paternity|family leave|sabbatical|learning budget|education|tuition)[^.!?]{5,200}[.!?]/gi,
    /(?:home office|remote work|work from|WFH|stipend|allowance|wellness|gym|fitness)[^.!?]{5,200}[.!?]/gi,
    /(?:health\s+(?:insurance|coverage|care)|medical|dental|vision|life insurance|disability|FSA|HSA)[^.!?]{5,200}[.!?]/gi,
    /(?:stock|equity|RSU|ESPP|options|shares|vesting)[^.!?]{5,200}[.!?]/gi,
    /(?:bonus|incentive|commission|profit sharing|performance)[^.!?]{5,200}[.!?]/gi,
    /\d+\s+(?:days?|weeks?)\s+(?:of\s+)?(?:PTO|vacation|holiday|leave|off)[^.!?]{5,150}[.!?]/gi,
    /(?:free\s+(?:lunch|food|snacks|drinks|meals|coffee|breakfast))[^.!?]{5,150}[.!?]/gi,
    /(?:pet|dog|cat)\s*(?:friendly|insurance|policy)[^.!?]{5,100}[.!?]/gi,
    /(?:commuter|transit|parking)\s+(?:benefits?|reimbursement|allowance|stipend)[^.!?]{5,150}[.!?]/gi,
  ]
  for (const rx of patterns) {
    let m: RegExpExecArray | null
    while ((m = rx.exec(text)) !== null) {
      const claim = m[0].trim()
      if (!claims.includes(claim)) claims.push(claim)
    }
  }
  return claims.slice(0, 25)
}

// ════════════════════════════════════════════════════════════════════
// SOCIAL MEDIA DISCOVERY
// ════════════════════════════════════════════════════════════════════

function discoverSocialAccounts(
  htmlBodies: string[],
): DiscoveredSocialAccount[] {
  const seen = new Set<string>()
  const accounts: DiscoveredSocialAccount[] = []
  const combinedHtml = htmlBodies.join(' ')

  for (const { platform, patterns } of SOCIAL_PLATFORM_PATTERNS) {
    for (const rx of patterns) {
      let m: RegExpExecArray | null
      while ((m = rx.exec(combinedHtml)) !== null) {
        const rawUrl = m[0].replace(/['"<>]+$/, '')
        const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
        const key = `${platform}:${fullUrl.toLowerCase()}`
        if (!seen.has(key)) {
          seen.add(key)
          const parts = fullUrl.split('/')
          const handle =
            parts[parts.length - 1] || parts[parts.length - 2] || ''
          accounts.push({
            platform,
            url: fullUrl,
            handle: handle.replace('@', ''),
          })
        }
      }
    }
  }

  return accounts
}

// ════════════════════════════════════════════════════════════════════
// ATS PLATFORM DETECTION
// ════════════════════════════════════════════════════════════════════

function detectATSPlatforms(htmlBodies: string[]): DetectedATSPlatform[] {
  const detected: DetectedATSPlatform[] = []
  const seen = new Set<string>()
  const combinedHtml = htmlBodies.join(' ')

  for (const { platform, pattern } of ATS_PLATFORM_PATTERNS) {
    let m: RegExpExecArray | null
    while ((m = pattern.exec(combinedHtml)) !== null) {
      const rawUrl = m[0].replace(/['"<>]+$/, '')
      const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`
      if (!seen.has(platform)) {
        seen.add(platform)
        detected.push({ platform, url: fullUrl, jobCount: 0 })
      }
    }
  }

  return detected
}

// ════════════════════════════════════════════════════════════════════
// PAGE FINDER — parallel path probing, returns richest result
// ════════════════════════════════════════════════════════════════════

async function findPage(
  domain: string,
  paths: string[],
): Promise<PageContent | null> {
  // Fire all paths in parallel — pick the one with the most content
  const results = await Promise.allSettled(
    paths.map((path) => fetchPageContent(`${domain}${path}`)),
  )

  let best: PageContent | null = null
  let bestLen = 0

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value && r.value.text.length > 50) {
      if (r.value.text.length > bestLen) {
        best = r.value
        bestLen = r.value.text.length
      }
    }
  }

  return best
}

// ════════════════════════════════════════════════════════════════════
// CONTENT ENRICHMENT (SerpAPI removed)
// ════════════════════════════════════════════════════════════════════

/**
 * SerpAPI enrichment removed. Returns empty results.
 */
async function enrichFromSearch(
  _companyName: string,
  _domain: string,
): Promise<{ extraText: string; extraClaims: string[] }> {
  return { extraText: '', extraClaims: [] }
}

// ════════════════════════════════════════════════════════════════════
// MAIN EXPORT — EXHAUSTIVE L1 SCRAPER
// ════════════════════════════════════════════════════════════════════

export async function fetchCompanySite(
  companyName: string,
): Promise<CompanySiteResult> {
  const empty: CompanySiteResult = {
    companyDomain: null,
    // Cat A
    aboutPage: null, careersPage: null, pressPage: null,
    visionValuesPage: null, culturePage: null, benefitsPage: null,
    deiEsgPage: null, sustainabilityPage: null, blogPage: null,
    caseStudiesPage: null, testimonialsPage: null, customerStoriesPage: null,
    partnersPage: null, pricingPage: null, productFeaturesPage: null,
    roadmapPage: null, statusPage: null, trustSecurityPage: null,
    compliancePage: null,
    // Cat E
    docsPage: null, apiDocsPage: null, developerPortalPage: null,
    changelogPage: null, releaseNotesPage: null,
    // Cat F
    investorRelationsPage: null,
    // Cat G
    termsPage: null, privacyPage: null, cookiePolicyPage: null,
    refundPolicyPage: null, codeOfConductPage: null, ethicsPolicyPage: null,
    whistleblowerPage: null,
    // Cat B & D
    discoveredSocialAccounts: [],
    detectedATSPlatforms: [],
    // Extracted
    claimedValues: [],
    benefitsClaims: [],
    cultureKeywords: [],
    jobPostings: [],
    // Stats
    surfacesScanned: 0,
    surfacesFound: 0,
    lastUpdated: new Date().toISOString(),
  }

  try {
    const domain = await discoverDomain(companyName)
    if (!domain) {
      console.warn(
        `[CompanySite] Could not discover domain for: ${companyName}`,
      )
      return empty
    }

    empty.companyDomain = domain

    // ── Fetch ALL L1 surfaces in ONE parallel batch ──────────────
    const surfaceKeys = Object.keys(L1_SURFACE_PATHS) as (keyof typeof L1_SURFACE_PATHS)[]
    const totalSurfaces = surfaceKeys.length
    empty.surfacesScanned = totalSurfaces

    const allPromises = surfaceKeys.map(async (key) => {
      const paths = L1_SURFACE_PATHS[key]
      if (!paths) return { key, result: null }
      const result = await findPage(domain, paths)
      return { key, result }
    })

    // Also fetch the homepage in parallel
    const homepagePromise = fetchRawHtml(domain)

    // Wait for everything at once
    const [surfaceResults, homepageHtml] = await Promise.all([
      Promise.allSettled(allPromises),
      homepagePromise,
    ])

    // Collect raw HTML bodies for social / ATS discovery
    const rawHtmlBodies: string[] = []
    if (homepageHtml) rawHtmlBodies.push(homepageHtml)

    for (const settled of surfaceResults) {
      if (settled.status === 'fulfilled' && settled.value.result) {
        const { key, result } = settled.value
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(empty as any)[key] = result
        rawHtmlBodies.push(result.text)
        empty.surfacesFound++
      }
    }

    // ── Parse homepage as a bonus about-like surface if about is missing ──
    if (!empty.aboutPage && homepageHtml) {
      const homepage = parseHtml(domain, homepageHtml)
      if (homepage.text.length > 100) {
        empty.aboutPage = homepage
        empty.surfacesFound++
      }
    }

    // ── Discover social media brand accounts from all collected HTML ──
    empty.discoveredSocialAccounts = discoverSocialAccounts(rawHtmlBodies)

    // ── Detect ATS / hiring platforms ────────────────────────────
    empty.detectedATSPlatforms = detectATSPlatforms(rawHtmlBodies)

    // ── Extract intelligence from all collected text ─────────────
    const allText = rawHtmlBodies.join(' ')
    empty.cultureKeywords = extractCultureKeywords(allText)

    // Collect claims from all pages
    const allClaims: string[] = []
    for (const key of surfaceKeys) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const page = (empty as any)[key] as PageContent | null
      if (page?.keyPhrases) {
        allClaims.push(...page.keyPhrases)
      }
    }

    // ── SerpAPI enrichment when direct scraping is sparse ────────
    if (empty.surfacesFound < 5) {
      console.log(
        `[CompanySite] Only ${empty.surfacesFound} surfaces found — enriching via SerpAPI`,
      )
      const enrichment = await enrichFromSearch(companyName, domain)
      if (enrichment.extraClaims.length > 0) {
        allClaims.push(...enrichment.extraClaims)
        // Also feed enrichment text into culture + benefits extraction
        const enrichedCulture = extractCultureKeywords(enrichment.extraText)
        for (const k of enrichedCulture) empty.cultureKeywords.push(k)
        empty.cultureKeywords = [...new Set(empty.cultureKeywords)]

        const enrichedBenefits = extractBenefitsClaims(enrichment.extraText)
        empty.benefitsClaims.push(...enrichedBenefits)
      }
    }

    empty.claimedValues = [...new Set(allClaims)].slice(0, 40)

    // Extract benefits from all culture-related pages
    const benefitsText = [
      empty.careersPage?.text || '',
      empty.benefitsPage?.text || '',
      empty.culturePage?.text || '',
      empty.visionValuesPage?.text || '',
      empty.aboutPage?.text || '',
    ].join(' ')
    const directBenefits = extractBenefitsClaims(benefitsText)
    empty.benefitsClaims = [
      ...new Set([...empty.benefitsClaims, ...directBenefits]),
    ].slice(0, 25)

    // Extract job postings
    if (empty.careersPage) {
      empty.jobPostings = extractJobPostings(
        empty.careersPage.text,
        empty.careersPage.url,
      )
    }

    console.log(
      `[CompanySite] L1 scan complete: ${empty.surfacesFound}/${empty.surfacesScanned} surfaces, ` +
        `${empty.claimedValues.length} claims, ${empty.cultureKeywords.length} culture kw, ` +
        `${empty.benefitsClaims.length} benefits, ${empty.discoveredSocialAccounts.length} social, ` +
        `${empty.detectedATSPlatforms.length} ATS`,
    )

    return empty
  } catch (error) {
    console.error('[CompanySite] Error:', error)
    return empty
  }
}
