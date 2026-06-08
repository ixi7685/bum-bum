/**
 * L5 — Client / User Fallout (EXHAUSTIVE Master Source Table)
 *
 * Layer 5 is where promises meet reality.
 * It exposes how a company behaves when users are affected, money is
 * involved, and support is tested.
 * It is noisy alone and devastating in patterns.
 *
 * QUALIFICATION TEST (LOCKED):
 *   1. Did the person use or pay for the product/service?
 *   2. Are they describing what happened after that?
 *   3. Is the content public and user-authored?
 *   If YES to all three → Layer 5.
 *   If employee context → L3.
 *   If peer discussion without usage → L4.
 *   If official response → L1 (as metadata only).
 *   If verified external action → L6.
 *
 * Categories (from L5 Master Source Table):
 *   A. Consumer Review Platforms (Global Core)
 *   B. B2B & SaaS Review Platforms
 *   C. App Marketplaces (Critical for Fintech & Consumer)
 *   D. Social Support & Complaint Surfaces
 *   E. Video & Influencer Fallout
 *   F. Product-Owned Community & Support Forums
 *   G. Complaint & Scam-Focused Boards
 *   H. Regional / Non-US Consumer Platforms
 *   I. Edge-Case but Valid Layer 5 Sources
 *
 * J. What NEVER belongs in Layer 5:
 *   - Company marketing claims → L1
 *   - Employee experiences → L3
 *   - Community rumors → L4
 *   - News articles → L6
 *   - Court rulings → L6
 *   - Analyst reports → L6
 *   - Pre-purchase opinions → L4
 *
 * NOTE: Trustpilot is already covered in trustpilot.ts.
 *       YouTube videos+comments are already covered in youtube.ts.
 *       This file adds the remaining ~50+ surfaces.
 *
 * ⚠ Star ratings are metadata only. Text + resolution behavior matter.
 * ⚠ Company replies are behavior signals, not narrative.
 * ⚠ Silence or templated replies = risk multiplier.
 */

// ════════════════════════════════════════════════════════════════════
// PUBLIC TYPES
// ════════════════════════════════════════════════════════════════════

export type L5SourceCategory =
  | 'A-consumer-reviews'
  | 'B-b2b-saas'
  | 'C-app-marketplaces'
  | 'D-social-support'
  | 'E-video-fallout'
  | 'F-support-forums'
  | 'G-complaint-scam'
  | 'H-regional-consumer'
  | 'I-edge-cases'

export type L5SpeakerClass =
  | 'end-user'
  | 'paying-customer'
  | 'business-client'
  | 'trial-user'
  | 'former-customer'
  | 'influencer-reviewer'

export type L5IssueCategory =
  | 'billing'
  | 'support-failure'
  | 'product-reliability'
  | 'misrepresentation'
  | 'contract-issues'
  | 'data-privacy'
  | 'access-issues'
  | 'implementation-pain'
  | 'refund-dispute'
  | 'account-freeze'
  | 'service-degradation'
  | 'scam-suspicion'

export type L5CompanyResponseType =
  | 'no-response'
  | 'template-response'
  | 'defensive'
  | 'empathetic-action'
  | 'public-fix'
  | 'silence'

export interface L5Signal {
  category: L5SourceCategory
  platform: string
  region: string
  title: string
  snippet: string
  url: string
  author: string
  date: string
  speakerClass: L5SpeakerClass
  issueCategory: L5IssueCategory
  companyResponse: L5CompanyResponseType
  signalType: string            // e.g. 'refund-complaint', 'scam-report', 'app-crash'
  whatItReveals: string         // Human-readable intelligence
  rating?: number
  resolutionState: 'resolved' | 'acknowledged' | 'ignored' | 'repeated-unresolved'
}

export interface ClientFalloutResult {
  signals: L5Signal[]
  categoryBreakdown: Record<L5SourceCategory, number>
  platformBreakdown: Record<string, number>
  regionBreakdown: Record<string, number>
  issueBreakdown: Record<string, number>
  responseBreakdown: Record<string, number>
  totalFound: number
  sourcesSearched: string[]
}

// ════════════════════════════════════════════════════════════════════
// INFERENCE HELPERS
// ════════════════════════════════════════════════════════════════════

function inferSpeakerClass(text: string): L5SpeakerClass {
  const lower = text.toLowerCase()
  if (/\b(subscriber|subscription|premium|pro plan|enterprise|annual|monthly plan)\b/i.test(lower)) return 'paying-customer'
  if (/\b(business|our company|our team|we use|we bought|implementation|onboarding|deployed)\b/i.test(lower)) return 'business-client'
  if (/\b(free trial|trial period|demo|testing|trying out|signed up)\b/i.test(lower)) return 'trial-user'
  if (/\b(used to use|cancelled|switched|migrated away|left|former|stopped using|unsubscribed)\b/i.test(lower)) return 'former-customer'
  if (/\b(review|honest review|full review|my review|testing|hands-on)\b/i.test(lower) && /\b(channel|video|content|followers|audience)\b/i.test(lower)) return 'influencer-reviewer'
  return 'end-user'
}

function inferIssueCategory(text: string): L5IssueCategory {
  const lower = text.toLowerCase()
  if (/\b(charg|bill|invoice|payment|refund|money back|overcharg|double charg|hidden fee|auto.?renew)\b/i.test(lower)) return 'billing'
  if (/\b(refund|money back|chargeback|dispute|won.t refund)\b/i.test(lower)) return 'refund-dispute'
  if (/\b(support|customer service|helpdesk|ticket|response time|no response|waiting|days? later|weeks? later)\b/i.test(lower)) return 'support-failure'
  if (/\b(crash|bug|error|broken|glitch|freeze|not working|down|outage|500|404)\b/i.test(lower)) return 'product-reliability'
  if (/\b(mislead|false|advertis|promised|not as|doesn.t match|bait.?and.?switch|deceptive)\b/i.test(lower)) return 'misrepresentation'
  if (/\b(contract|lock.?in|cancellation|early termination|fine print|tos|terms)\b/i.test(lower)) return 'contract-issues'
  if (/\b(data|privacy|breach|leaked|personal info|gdpr|hack|security)\b/i.test(lower)) return 'data-privacy'
  if (/\b(locked out|account (ban|suspend|frozen|disabled|deactivated)|can.t access|blocked)\b/i.test(lower)) return 'account-freeze'
  if (/\b(implement|integration|setup|onboard|migration|deploy|config)\b/i.test(lower)) return 'implementation-pain'
  if (/\b(scam|fraud|ponzi|steal|stolen|fake|rug.?pull|pyramid)\b/i.test(lower)) return 'scam-suspicion'
  if (/\b(slow|degrad|worse|downgrad|quality|used to be|worse than)\b/i.test(lower)) return 'service-degradation'
  return 'support-failure'
}

function inferCompanyResponse(text: string): L5CompanyResponseType {
  const lower = text.toLowerCase()
  if (/\b(no response|no reply|never responded|didn.t respond|silence|radio silence|ignored|ghosted)\b/i.test(lower)) return 'no-response'
  if (/\b(copy.?paste|template|generic|automated|bot|canned response|same reply)\b/i.test(lower)) return 'template-response'
  if (/\b(blame|your fault|user error|not our problem|denied|rejected|pushed back)\b/i.test(lower)) return 'defensive'
  if (/\b(resolved|fixed|refunded|apologized|made it right|compensated|credited)\b/i.test(lower)) return 'empathetic-action'
  if (/\b(update|patch|fix released|we.ve addressed|deployed a fix|rolled back)\b/i.test(lower)) return 'public-fix'
  return 'silence'
}

function inferResolutionState(text: string): L5Signal['resolutionState'] {
  const lower = text.toLowerCase()
  if (/\b(resolved|fixed|refunded|sorted|made it right|working now)\b/i.test(lower)) return 'resolved'
  if (/\b(acknowledged|looking into|investigating|aware|working on)\b/i.test(lower)) return 'acknowledged'
  if (/\b(still|months? later|years? later|ongoing|same issue|keeps happening|third time|again)\b/i.test(lower)) return 'repeated-unresolved'
  return 'ignored'
}

function inferSignalType(text: string, title: string, category: L5SourceCategory): string {
  const combined = `${title} ${text}`.toLowerCase()

  if (category === 'C-app-marketplaces') {
    if (/crash|freeze|hang|unresponsive/i.test(combined)) return 'app-crash'
    if (/update|after update|new version|latest/i.test(combined)) return 'post-update-complaint'
    if (/ban|removed|suspended|blocked/i.test(combined)) return 'account-ban'
    return 'app-complaint'
  }
  if (category === 'G-complaint-scam') {
    if (/scam|fraud|ponzi|fake/i.test(combined)) return 'scam-report'
    if (/ripoff|rip.off|stolen/i.test(combined)) return 'ripoff-report'
    return 'escalated-complaint'
  }
  if (/refund/i.test(combined)) return 'refund-complaint'
  if (/cancel/i.test(combined)) return 'cancellation-complaint'
  if (/support|customer service/i.test(combined)) return 'support-failure'
  if (/chargeback/i.test(combined)) return 'chargeback-signal'
  if (/billing|charge|payment/i.test(combined)) return 'billing-complaint'
  if (/crash|bug|broken/i.test(combined)) return 'product-failure'
  if (/data|privacy|breach/i.test(combined)) return 'privacy-complaint'
  if (/this is why i left|switched|moved to/i.test(combined)) return 'customer-exit'
  return 'general-complaint'
}

function inferWhatItReveals(platform: string, category: L5SourceCategory): string {
  const platformMap: Record<string, string> = {
    'Yelp': 'Service failure patterns',
    'Google Reviews': 'Local operations reality',
    'Facebook Reviews': 'Legacy customer base complaints',
    'SiteJabber': 'Scam detection signals',
    'ConsumerAffairs': 'Long-term unresolved issues',
    'PissedConsumer': 'Escalated anger — worst-case experience',
    'G2': 'Implementation pain & enterprise truth',
    'Capterra': 'Mid-market truth',
    'GetApp': 'SMB experience',
    'TrustRadius': 'Enterprise issues',
    'Software Advice': 'Buyer regret signals',
    'Apple App Store': 'Stability, bans, app trust',
    'Google Play': 'Bugs, update failures',
    'Huawei AppGallery': 'Non-Google market exposure',
    'Samsung Galaxy Store': 'OEM exposure',
    'ScamAdviser': 'Fraud suspicion',
    'Ripoff Report': 'Extreme escalation',
    'Otzovik': 'Russian/Eastern EU consumer reality',
    'Reklamace.cz': 'Czech consumer complaints',
  }
  if (platformMap[platform]) return platformMap[platform]

  const catMap: Record<string, string> = {
    'D-social-support': 'Public escalation — support failed privately',
    'E-video-fallout': 'Long-form failure explanation — viral distrust',
    'F-support-forums': 'Backlog visibility & engineering debt',
    'G-complaint-scam': 'Trust collapse — early L6 predictor',
    'H-regional-consumer': 'Non-US consumer reality',
    'I-edge-cases': 'Usage-based complaint upgraded from L4',
  }
  return catMap[category] || 'Client fallout signal'
}

/** Extract a rating from a snippet */
function extractRating(snippet: string): number | undefined {
  const m = snippet.match(/(\d\.?\d?)\s*(?:out of 5|★|stars?|\/5)/i)
  if (m) {
    const r = parseFloat(m[1])
    return r <= 5 ? r : undefined
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
// SIGNAL BUILDER HELPER
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
  category: L5SourceCategory,
  platform: string,
  region: string,
): L5Signal {
  const text = `${r.title} ${r.snippet}`
  return {
    category,
    platform,
    region,
    title: cleanText(r.title),
    snippet: cleanText(r.snippet),
    url: r.link,
    author: `${platform} User`,
    date: r.date || 'Recent',
    speakerClass: inferSpeakerClass(text),
    issueCategory: inferIssueCategory(text),
    companyResponse: inferCompanyResponse(r.snippet),
    signalType: inferSignalType(r.snippet, r.title, category),
    whatItReveals: inferWhatItReveals(platform, category),
    rating: extractRating(r.snippet),
    resolutionState: inferResolutionState(r.snippet),
  }
}

function deduplicateSignals(signals: L5Signal[]): L5Signal[] {
  const seen = new Set<string>()
  return signals.filter((s) => {
    const key = s.url.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ════════════════════════════════════════════════════════════════════
// A. CONSUMER REVIEW PLATFORMS (GLOBAL CORE)
//    Structured platforms for post-transaction experience.
//    (Trustpilot already in trustpilot.ts — adding the rest)
// ════════════════════════════════════════════════════════════════════

async function searchConsumerReviewPlatforms(companyName: string): Promise<L5Signal[]> {
  const signals: L5Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; reveals: string }[] = [
    // Yelp — service failure
    { q: `site:yelp.com "${cn}" reviews`, platform: 'Yelp', reveals: 'Service failure patterns' },
    // Google Reviews (via SerpAPI's Google Maps)
    { q: `"${cn}" "google review" OR "google reviews" complaint OR terrible OR worst OR scam`, platform: 'Google Reviews', reveals: 'Local operations reality' },
    // Facebook Reviews
    { q: `site:facebook.com "${cn}" reviews OR recommend OR "not recommend"`, platform: 'Facebook Reviews', reveals: 'Legacy customer base complaints' },
    // SiteJabber — scam detection
    { q: `site:sitejabber.com "${cn}" reviews`, platform: 'SiteJabber', reveals: 'Scam detection signals' },
    // ConsumerAffairs — long-term issues
    { q: `site:consumeraffairs.com "${cn}" reviews complaints`, platform: 'ConsumerAffairs', reveals: 'Long-term unresolved issues' },
    // PissedConsumer — escalated anger
    { q: `site:pissedconsumer.com "${cn}"`, platform: 'PissedConsumer', reveals: 'Escalated anger — worst-case experience' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 6)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'A-consumer-reviews', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// B. B2B & SAAS REVIEW PLATFORMS
//    Clients reporting operational dependency failures.
//    B2B reviews skew positive → silence is also a signal.
// ════════════════════════════════════════════════════════════════════

async function searchB2BSaaSReviews(companyName: string): Promise<L5Signal[]> {
  const signals: L5Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; reveals: string }[] = [
    // G2 — implementation pain
    { q: `site:g2.com "${cn}" reviews`, platform: 'G2', reveals: 'Implementation pain & enterprise truth' },
    // Capterra — mid-market truth
    { q: `site:capterra.com "${cn}" reviews`, platform: 'Capterra', reveals: 'Mid-market truth' },
    // GetApp — SMB experience
    { q: `site:getapp.com "${cn}" reviews`, platform: 'GetApp', reveals: 'SMB experience' },
    // TrustRadius — enterprise issues
    { q: `site:trustradius.com "${cn}" reviews`, platform: 'TrustRadius', reveals: 'Enterprise issues' },
    // Software Advice — buyer regret
    { q: `site:softwareadvice.com "${cn}" reviews`, platform: 'Software Advice', reveals: 'Buyer regret signals' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'B-b2b-saas', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// C. APP MARKETPLACES (CRITICAL FOR FINTECH & CONSUMER)
//    Where failures show up immediately.
//    Correlation between app update → complaint spike is key.
// ════════════════════════════════════════════════════════════════════

async function searchAppMarketplaces(companyName: string): Promise<L5Signal[]> {
  const signals: L5Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; reveals: string }[] = [
    // Apple App Store
    { q: `site:apps.apple.com "${cn}" OR "${cn}" app reviews`, platform: 'Apple App Store', reveals: 'Stability, bans, app trust' },
    // Google Play
    { q: `site:play.google.com "${cn}" app reviews`, platform: 'Google Play', reveals: 'Bugs, update failures' },
    // Huawei AppGallery
    { q: `site:appgallery.huawei.com "${cn}" OR "${cn}" huawei app`, platform: 'Huawei AppGallery', reveals: 'Non-Google market exposure' },
    // Samsung Galaxy Store
    { q: `"${cn}" samsung galaxy store app review`, platform: 'Samsung Galaxy Store', reveals: 'OEM exposure' },
    // Generic app store complaint search
    { q: `"${cn}" app "1 star" OR "worst app" OR "doesn't work" OR "crashes" OR "won't open" reviews`, platform: 'App Store (Generic)', reveals: 'Cross-platform app failures' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'C-app-marketplaces', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// D. SOCIAL SUPPORT & COMPLAINT SURFACES
//    Where users go when support fails privately.
//    Silence or templated replies = risk multiplier.
// ════════════════════════════════════════════════════════════════════

async function searchSocialSupportComplaints(companyName: string): Promise<L5Signal[]> {
  const signals: L5Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; reveals: string }[] = [
    // X replies to brand — public escalation
    { q: `site:x.com OR site:twitter.com "@${cn.replace(/\s/g, '')}" complaint OR issue OR "not working" OR "terrible" OR refund`, platform: 'X (Brand Replies)', reveals: 'Public escalation — support failed privately' },
    // Instagram complaints
    { q: `site:instagram.com "${cn}" complaint OR "never again" OR scam OR disappointed`, platform: 'Instagram (Complaints)', reveals: 'Brand pressure from customers' },
    // Facebook Page comments — legacy complaints
    { q: `site:facebook.com "${cn}" complaint OR "customer service" OR refund OR scam`, platform: 'Facebook (Complaints)', reveals: 'Legacy customer complaints' },
    // LinkedIn customer comments — B2B fallout
    { q: `site:linkedin.com "${cn}" customer OR client complaint OR disappointed OR "switched to"`, platform: 'LinkedIn (Customer)', reveals: 'B2B fallout visible to prospects' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'D-social-support', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// E. VIDEO & INFLUENCER FALLOUT (UNDERRATED)
//    Users explain issues in detail.
//    If users say "this is why I left" → strong L5.
//    (YouTube comments already in youtube.ts — adding complaint
//     videos, TikTok, Twitch)
// ════════════════════════════════════════════════════════════════════

async function searchVideoFallout(companyName: string): Promise<L5Signal[]> {
  const signals: L5Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; reveals: string }[] = [
    // YouTube complaint videos — long-form failure
    { q: `site:youtube.com "${cn}" complaint OR scam OR "honest review" OR "why I left" OR "don't use" OR "the truth about"`, platform: 'YouTube (Complaints)', reveals: 'Long-form failure — account freezes, refunds' },
    // TikTok complaint videos — viral distrust
    { q: `site:tiktok.com "${cn}" scam OR complaint OR "storytime" OR "worst experience" OR "never again"`, platform: 'TikTok (Complaints)', reveals: 'Viral distrust — fast trend' },
    // Twitch streams (complaints) — live failure
    { q: `site:twitch.tv "${cn}" complaint OR issue OR broken`, platform: 'Twitch (Complaints)', reveals: 'Live failure streaming' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'E-video-fallout', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// F. PRODUCT-OWNED COMMUNITY & SUPPORT FORUMS
//    Still Layer 5 because experience is user-authored.
//    Company replies are behavior signals, not narrative.
// ════════════════════════════════════════════════════════════════════

async function searchSupportForums(companyName: string): Promise<L5Signal[]> {
  const signals: L5Signal[] = []
  const cn = companyName
  const slug = cn.toLowerCase().replace(/[^a-z0-9]+/g, '')

  const queries: { q: string; platform: string; reveals: string }[] = [
    // Official support forums — backlog visibility
    { q: `"${cn}" support forum OR community forum bug OR issue OR complaint -site:reddit.com -site:stackoverflow.com`, platform: 'Support Forum', reveals: 'Backlog visibility — support debt' },
    // Product community boards — feature pain
    { q: `"${cn}" community OR feedback board OR "feature request" OR "wish list" frustrated OR disappointed OR broken`, platform: 'Community Board', reveals: 'Feature pain — product gaps' },
    // GitHub issues (users) — product reliability
    { q: `site:github.com/${slug} issue bug OR crash OR broken OR "doesn't work"`, platform: 'GitHub Issues (Users)', reveals: 'Product reliability — open bugs' },
    // Public bug trackers — engineering debt
    { q: `"${cn}" bug tracker OR jira OR "known issues" OR "status page" outage OR incident`, platform: 'Bug Tracker', reveals: 'Engineering debt visibility' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'F-support-forums', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// G. COMPLAINT & SCAM-FOCUSED BOARDS
//    Where trust has already collapsed.
//    High noise, but early Layer 6 predictor.
// ════════════════════════════════════════════════════════════════════

async function searchComplaintScamBoards(companyName: string): Promise<L5Signal[]> {
  const signals: L5Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; reveals: string }[] = [
    // ScamAdviser — fraud suspicion
    { q: `site:scamadviser.com "${cn}"`, platform: 'ScamAdviser', reveals: 'Fraud suspicion' },
    // Scamwatch (regional, government-adjacent)
    { q: `"${cn}" scamwatch OR "consumer protection" OR "trading standards" complaint`, platform: 'Scamwatch (Regional)', reveals: 'Government-adjacent complaint' },
    // Ripoff Report — extreme escalation
    { q: `site:ripoffreport.com "${cn}"`, platform: 'Ripoff Report', reveals: 'Extreme escalation' },
    // Local consumer protection boards — legal precursor
    { q: `"${cn}" "consumer protection" OR "better business bureau" OR BBB complaint OR "attorney general"`, platform: 'Consumer Protection', reveals: 'Legal precursor — formal complaint' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'G-complaint-scam', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// H. REGIONAL / NON-US CONSUMER PLATFORMS
//    These matter more than US platforms locally.
//    Language mismatch ≠ low signal. Often it's higher.
// ════════════════════════════════════════════════════════════════════

async function searchRegionalConsumerPlatforms(companyName: string): Promise<L5Signal[]> {
  const signals: L5Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; region: string }[] = [
    // Trustpilot local domains (EU)
    { q: `site:trustpilot.de OR site:trustpilot.fr OR site:trustpilot.nl OR site:trustpilot.it "${cn}"`, platform: 'Trustpilot (EU Local)', region: 'EU' },
    // Páginas Amarillas reviews (ES/LATAM)
    { q: `site:paginasamarillas.es OR site:paginasamarillas.com "${cn}" opiniones`, platform: 'Páginas Amarillas', region: 'ES/LATAM' },
    // Otzovik (RU/Eastern EU)
    { q: `site:otzovik.com "${cn}"`, platform: 'Otzovik', region: 'RU/Eastern EU' },
    // Reklamace.cz (CZ)
    { q: `site:reklamace.cz "${cn}"`, platform: 'Reklamace.cz', region: 'CZ' },
    // Complaint Singapore (SG)
    { q: `"${cn}" complaint singapore OR "consumer association"`, platform: 'Complaint Singapore', region: 'SG' },
    // Local consumer forums (global)
    { q: `"${cn}" consumer forum OR complaint review local -site:reddit.com -site:trustpilot.com -site:yelp.com`, platform: 'Local Consumer Forum', region: 'Multi-Region' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 4)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, region } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'H-regional-consumer', platform, region))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// I. EDGE-CASE BUT VALID LAYER 5 SOURCES
//    Upgrade from L4 → L5 only if actual usage/payment is explicit.
// ════════════════════════════════════════════════════════════════════

async function searchEdgeCaseSources(companyName: string): Promise<L5Signal[]> {
  const signals: L5Signal[] = []
  const cn = companyName

  // First-hand usage language to filter L4 → L5 upgrade
  const usagePattern = /\b(i (paid|bought|subscribed|purchased|used|signed up)|my account|my subscription|my order|charged me|billed me|they charged|refund|chargeback|money back)\b/i

  const queries: { q: string; platform: string; reveals: string }[] = [
    // Reddit first-hand customer complaints — usage-based
    { q: `site:reddit.com "${cn}" "I paid" OR "they charged" OR "my account" OR "refund" OR "my order" OR "cancelled"`, platform: 'Reddit (Customer)', reveals: 'Usage-based customer complaint' },
    // Quora "my experience with X" — transactional
    { q: `site:quora.com "my experience with ${cn}" OR "I used ${cn}" OR "I paid ${cn}"`, platform: 'Quora (Customer)', reveals: 'Transactional experience' },
    // Comment sections under review articles — peer confirmation
    { q: `"${cn}" review article comments customer experience complaint -site:reddit.com`, platform: 'Review Article Comments', reveals: 'Peer confirmation under reviews' },
    // App review replies by company — accountability signal
    { q: `"${cn}" app "developer response" OR "company response" OR "reply from" review`, platform: 'App Review Replies', reveals: 'Accountability — company reply behavior' },
    // Chargeback discussion threads — financial stress
    { q: `"${cn}" chargeback OR "disputed charge" OR "credit card" dispute OR "bank reversed"`, platform: 'Chargeback Threads', reveals: 'Financial stress — payment trust broken' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      // Only upgrade to L5 if usage/payment language is detected
      if (!usagePattern.test(r.snippet) && !usagePattern.test(r.title)) continue
      signals.push(toSignal(r, 'I-edge-cases', platform, 'Global'))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ════════════════════════════════════════════════════════════════════

/**
 * Fetch ALL L5 Client / User Fallout signals.
 * Runs all 9 categories (A–I) in parallel.
 *
 * NOTE: This supplements trustpilot.ts (Trustpilot reviews)
 * and youtube.ts (YouTube videos + comments). This file adds
 * the remaining ~50+ surfaces from the L5 Master Source Table.
 */
export async function fetchClientFallout(
  companyName: string,
): Promise<ClientFalloutResult> {
  const sourcesSearched: string[] = []

  // Run ALL L5 categories in parallel
  const [
    consumerReviews,
    b2bSaas,
    appMarketplaces,
    socialSupport,
    videoFallout,
    supportForums,
    complaintScam,
    regionalConsumer,
    edgeCases,
  ] = await Promise.allSettled([
    searchConsumerReviewPlatforms(companyName),
    searchB2BSaaSReviews(companyName),
    searchAppMarketplaces(companyName),
    searchSocialSupportComplaints(companyName),
    searchVideoFallout(companyName),
    searchSupportForums(companyName),
    searchComplaintScamBoards(companyName),
    searchRegionalConsumerPlatforms(companyName),
    searchEdgeCaseSources(companyName),
  ])

  const allSignals: L5Signal[] = []

  const collect = (settled: PromiseSettledResult<L5Signal[]>, source: string) => {
    sourcesSearched.push(source)
    if (settled.status === 'fulfilled') {
      allSignals.push(...settled.value)
    }
  }

  collect(consumerReviews, 'Yelp/GoogleReviews/Facebook/SiteJabber/ConsumerAffairs/PissedConsumer (SerpAPI)')
  collect(b2bSaas, 'G2/Capterra/GetApp/TrustRadius/SoftwareAdvice (SerpAPI)')
  collect(appMarketplaces, 'AppStore/GooglePlay/Huawei/Samsung (SerpAPI)')
  collect(socialSupport, 'X-Brand/Instagram/Facebook/LinkedIn-Customer (SerpAPI)')
  collect(videoFallout, 'YouTube-Complaints/TikTok-Complaints/Twitch (SerpAPI)')
  collect(supportForums, 'SupportForum/CommunityBoard/GitHubIssues/BugTracker (SerpAPI)')
  collect(complaintScam, 'ScamAdviser/Scamwatch/RipoffReport/ConsumerProtection (SerpAPI)')
  collect(regionalConsumer, 'Trustpilot-EU/PáginasAmarillas/Otzovik/Reklamace/ComplaintSG (SerpAPI)')
  collect(edgeCases, 'Reddit-Customer/Quora-Customer/ReviewComments/AppReplies/Chargebacks (SerpAPI)')

  // Deduplicate across all categories
  const dedupedSignals = deduplicateSignals(allSignals)

  // Build breakdowns
  const categoryBreakdown: Record<L5SourceCategory, number> = {
    'A-consumer-reviews': 0,
    'B-b2b-saas': 0,
    'C-app-marketplaces': 0,
    'D-social-support': 0,
    'E-video-fallout': 0,
    'F-support-forums': 0,
    'G-complaint-scam': 0,
    'H-regional-consumer': 0,
    'I-edge-cases': 0,
  }
  const platformBreakdown: Record<string, number> = {}
  const regionBreakdown: Record<string, number> = {}
  const issueBreakdown: Record<string, number> = {}
  const responseBreakdown: Record<string, number> = {}

  for (const s of dedupedSignals) {
    categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + 1
    platformBreakdown[s.platform] = (platformBreakdown[s.platform] || 0) + 1
    regionBreakdown[s.region] = (regionBreakdown[s.region] || 0) + 1
    issueBreakdown[s.issueCategory] = (issueBreakdown[s.issueCategory] || 0) + 1
    responseBreakdown[s.companyResponse] = (responseBreakdown[s.companyResponse] || 0) + 1
  }

  console.log(
    `[ClientFallout] L5 scan complete: ${dedupedSignals.length} signals across ${Object.keys(platformBreakdown).length} platforms. ` +
      `Categories: ${Object.entries(categoryBreakdown).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')}`,
  )

  return {
    signals: dedupedSignals,
    categoryBreakdown,
    platformBreakdown,
    regionBreakdown,
    issueBreakdown,
    responseBreakdown,
    totalFound: dedupedSignals.length,
    sourcesSearched,
  }
}
