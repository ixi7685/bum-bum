/**
 * L4 — Community & Peer Reality (EXHAUSTIVE Master Source Table)
 *
 * Layer 4 is collective perception in motion.
 * It is messy, fast, and brutally predictive.
 * One comment means nothing. A recurring conversation means everything.
 *
 * QUALIFICATION TEST (LOCKED):
 *   1. Are people talking to each other, not the company?
 *   2. Is the space public and non-professional?
 *   3. Can consensus form over time?
 *   If YES to all three → Layer 4.
 *   If professional identity dominates → L2.
 *   If lived employment experience → L3.
 *   If customer transaction → L5.
 *   If verified event → L6.
 *
 * Categories (from L4 Master Source Table):
 *   A. Large-Scale Public Discussion Platforms (Global Core)
 *   B. Social Media Threads & Replies (Non-Official)
 *   C. Video Comment Ecosystems
 *   D. Forums (The Long-Memory Layer)
 *   E. Public Chat & Pseudo-Private Communities
 *   F. Q&A, Complaint & Advice Boards (Non-Transactional)
 *   G. Country- & Language-Specific Community Platforms
 *   H. Edge-Case but Valid Layer 4 Sources
 *
 * I. What NEVER belongs in Layer 4:
 *   - Company posts → L1
 *   - Employee professional posts → L2
 *   - Glassdoor reviews → L3
 *   - Yelp / Trustpilot → L5
 *   - News reporting → L6
 *   - Court rulings → L6
 *   - Private groups → Excluded
 *
 * Data sources: SerpAPI, StackExchange API (free), HN Algolia (free),
 *               Reddit .json (free). Most platforms have no API — SerpAPI
 *               picks them up via Google indexing.
 *
 * NOTE: This supplements reddit.ts, redditFree.ts and hackerNews.ts
 * which cover the core Reddit & HN pipelines. This file adds the
 * remaining ~50+ sources from the L4 Master Source Table.
 */

// ════════════════════════════════════════════════════════════════════
// PUBLIC TYPES
// ════════════════════════════════════════════════════════════════════

export type L4SourceCategory =
  | 'A-public-discussion'
  | 'B-social-threads'
  | 'C-video-comments'
  | 'D-forums'
  | 'E-public-chat'
  | 'F-qa-complaint'
  | 'G-regional-communities'
  | 'H-edge-cases'

export type L4ConversationState =
  | 'single-vent'              // One person complaining — low weight
  | 'multiple-confirmations'   // Several people agree — medium weight
  | 'cross-thread'             // Same topic across threads — high weight
  | 'structural-problem'       // Recurring pattern over time — critical weight

export type L4SignalStrength =
  | 'noise'         // Single comment, no engagement
  | 'whisper'       // Low engagement but specific
  | 'murmur'        // Moderate engagement, some confirmation
  | 'chorus'        // High engagement, consensus forming
  | 'roar'          // Viral / widespread agreement

export interface L4Signal {
  category: L4SourceCategory
  platform: string
  region: string             // 'global' | 'China' | 'Japan' | 'Turkey' | etc.
  title: string
  snippet: string
  url: string
  author: string
  date: string
  signalType: string         // e.g. 'consensus-warning', 'backlash-thread', 'scam-report'
  signalStrength: L4SignalStrength
  whatItReveals: string      // Human-readable intelligence
  engagement: number         // Upvotes, likes, replies — whatever the platform provides
  confirmationCount: number  // How many voices echo the same point
}

export interface CommunityRealityResult {
  signals: L4Signal[]
  categoryBreakdown: Record<L4SourceCategory, number>
  platformBreakdown: Record<string, number>
  regionBreakdown: Record<string, number>
  signalStrengthBreakdown: Record<string, number>
  totalFound: number
  sourcesSearched: string[]
}

// ════════════════════════════════════════════════════════════════════
// INFERENCE HELPERS
// ════════════════════════════════════════════════════════════════════

function inferSignalStrength(
  snippet: string,
  engagement: number,
): L4SignalStrength {
  // "anyone else?" pattern = strong L4
  const echoPatterns = /\b(anyone else|same here|can confirm|me too|happened to me|not just me|everyone knows|it.s true)\b/i
  const hasEcho = echoPatterns.test(snippet)

  if (engagement > 200 || hasEcho) return 'chorus'
  if (engagement > 50) return 'murmur'
  if (engagement > 10) return 'whisper'
  if (engagement > 0) return 'noise'
  return 'noise'
}

function inferSignalType(text: string, title: string, category: L4SourceCategory): string {
  const combined = `${title} ${text}`.toLowerCase()

  if (/\b(scam|fraud|ponzi|fake|steal|stolen|rug ?pull)\b/i.test(combined)) return 'scam-report'
  if (/\b(anyone else|same here|can confirm|me too|not just me)\b/i.test(combined)) return 'consensus-pattern'
  if (/\b(warning|be careful|stay away|avoid|don.t use|don.t trust|beware)\b/i.test(combined)) return 'crowd-warning'
  if (/\b(outage|down|broken|not working|error|crash|bug)\b/i.test(combined)) return 'reliability-complaint'
  if (/\b(layoff|laid off|fired|rif|restructur|cut)\b/i.test(combined)) return 'layoff-chatter'
  if (/\b(toxic|hostile|terrible culture|worst company)\b/i.test(combined)) return 'culture-critique'
  if (/\b(is .+ legit|legit or scam|worth it|should i)\b/i.test(combined)) return 'legitimacy-question'
  if (/\b(meme|lol|lmao|rofl|clown|joke)\b/i.test(combined)) return 'meme-signal'
  if (/\b(comparison|vs|versus|alternative|better than|competitor)\b/i.test(combined)) return 'peer-comparison'
  if (/\b(backlash|outrage|cancel|boycott|protest)\b/i.test(combined)) return 'backlash-thread'
  if (/\b(support|help|issue|problem|can.t|unable)\b/i.test(combined)) return 'support-frustration'
  return 'general-discussion'
}

function inferWhatItReveals(platform: string, signalType: string): string {
  const platformMap: Record<string, string> = {
    'Quora': 'Public perception',
    'StackOverflow': 'Dev-side issues',
    'Slashdot': 'Legacy tech chatter',
    'Lobsters': 'Niche engineering truth',
    'V2EX': 'Chinese tech community perception',
    'Zhihu': 'Chinese intellectual discourse',
    '2ch/5ch': 'Japanese anonymous crowd truth',
    'PTT': 'Taiwan public discussion',
    'Ekşi Sözlük': 'Turkish crowd perception',
    'Pikabu': 'Russian community sentiment',
    'HWZone': 'Singapore tech sentiment',
  }
  if (platformMap[platform]) return platformMap[platform]

  const signalMap: Record<string, string> = {
    'scam-report': 'Trust collapse signal',
    'consensus-pattern': 'Crowd confirmation — high weight',
    'crowd-warning': 'Peer warning — reputation floor',
    'reliability-complaint': 'Product/service reliability issue',
    'layoff-chatter': 'Workforce instability signal',
    'culture-critique': 'Cultural perception from outside',
    'legitimacy-question': 'Reputation floor — "is it legit?"',
    'meme-signal': 'Cultural penetration — company as meme',
    'peer-comparison': 'Market positioning in crowd mind',
    'backlash-thread': 'Real-time backlash / viral distrust',
    'support-frustration': 'Support quality signal',
  }
  return signalMap[signalType] || 'Community perception signal'
}

function extractEngagement(snippet: string): number {
  // Try to pull numbers from snippet context
  const match = snippet.match(/(\d+)\s*(?:upvote|point|like|reply|replies|comment|vote)/i)
  return match ? parseInt(match[1], 10) : 0
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
// STACKEXCHANGE API (FREE, NO KEY NEEDED)
// ════════════════════════════════════════════════════════════════════

interface SEQuestion {
  title: string
  link: string
  score: number
  answer_count: number
  creation_date: number
  owner?: { display_name?: string }
  body_markdown?: string
}

async function searchStackExchange(
  companyName: string,
  site = 'stackoverflow',
  pageSize = 8,
): Promise<SEQuestion[]> {
  try {
    const params = new URLSearchParams({
      order: 'desc',
      sort: 'relevance',
      intitle: companyName,
      site,
      pagesize: String(pageSize),
      filter: 'withbody',
    })
    const res = await fetch(
      `https://api.stackexchange.com/2.3/search/advanced?${params}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.items || []) as SEQuestion[]
  } catch {
    return []
  }
}

// ════════════════════════════════════════════════════════════════════
// SIGNAL BUILDER HELPER
// ════════════════════════════════════════════════════════════════════

function cleanText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')     // strip HTML
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
  category: L4SourceCategory,
  platform: string,
  region: string,
): L4Signal {
  const engagement = extractEngagement(r.snippet)
  const signalType = inferSignalType(r.snippet, r.title, category)
  return {
    category,
    platform,
    region,
    title: cleanText(r.title),
    snippet: cleanText(r.snippet),
    url: r.link,
    author: `${platform} User`,
    date: r.date || 'Recent',
    signalType,
    signalStrength: inferSignalStrength(r.snippet, engagement),
    whatItReveals: inferWhatItReveals(platform, signalType),
    engagement,
    confirmationCount: 0,
  }
}

function deduplicateSignals(signals: L4Signal[]): L4Signal[] {
  const seen = new Set<string>()
  return signals.filter((s) => {
    const key = s.url.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ════════════════════════════════════════════════════════════════════
// A. LARGE-SCALE PUBLIC DISCUSSION PLATFORMS (GLOBAL CORE)
//    Pattern engines, not truth sources.
//    Weight comes from repetition and confirmation.
//    (Reddit & HN already covered in dedicated files — this adds the rest)
// ════════════════════════════════════════════════════════════════════

async function searchPublicDiscussionPlatforms(companyName: string): Promise<L4Signal[]> {
  const signals: L4Signal[] = []
  const cn = companyName

  // StackOverflow — via native API (free, no key)
  try {
    const soQuestions = await searchStackExchange(cn, 'stackoverflow', 8)
    for (const q of soQuestions) {
      signals.push({
        category: 'A-public-discussion',
        platform: 'StackOverflow',
        region: 'Global',
        title: cleanText(q.title),
        snippet: cleanText((q.body_markdown || '').substring(0, 500)),
        url: q.link,
        author: q.owner?.display_name || 'SO User',
        date: q.creation_date
          ? new Date(q.creation_date * 1000).toISOString().split('T')[0]
          : 'Recent',
        signalType: inferSignalType(q.body_markdown || '', q.title, 'A-public-discussion'),
        signalStrength: inferSignalStrength(q.body_markdown || '', q.score),
        whatItReveals: 'Dev-side issues',
        engagement: q.score,
        confirmationCount: q.answer_count,
      })
    }
  } catch { /* non-critical */ }

  // Quora, Slashdot, Lobsters — via SerpAPI
  const serpQueries: { q: string; platform: string; reveals: string }[] = [
    { q: `site:quora.com "${cn}" OR "at ${cn}" OR "about ${cn}"`, platform: 'Quora', reveals: 'Public perception' },
    { q: `site:slashdot.org "${cn}"`, platform: 'Slashdot', reveals: 'Legacy tech chatter' },
    { q: `site:lobste.rs "${cn}"`, platform: 'Lobsters', reveals: 'Niche engineering truth' },
  ]

  const results = await Promise.allSettled(
    serpQueries.map(({ q }) => serpSearch(q, 6)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, reveals } = serpQueries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'A-public-discussion', platform, 'Global')
      sig.whatItReveals = reveals
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// B. SOCIAL MEDIA THREADS & REPLIES (NON-OFFICIAL)
//    Rule: Replies, threads, quote posts ≠ Layer 2 unless clearly
//    professional & personal. Default = Layer 4.
// ════════════════════════════════════════════════════════════════════

async function searchSocialMediaThreads(companyName: string): Promise<L4Signal[]> {
  const signals: L4Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; reveals: string }[] = [
    // X reply threads — real-time backlash
    { q: `site:x.com OR site:twitter.com "${cn}" replies OR thread -from:${cn.replace(/\s/g, '')}`, platform: 'X/Twitter Threads', reveals: 'Real-time backlash' },
    // Threads (Meta) replies
    { q: `site:threads.net "${cn}"`, platform: 'Threads (Meta)', reveals: 'Cultural sentiment' },
    // TikTok comment threads — youth reaction
    { q: `site:tiktok.com "${cn}" comments OR reaction`, platform: 'TikTok Comments', reveals: 'Youth reaction / fast trend detection' },
    // Instagram comment threads
    { q: `site:instagram.com "${cn}" comments OR "not sponsored"`, platform: 'Instagram Comments', reveals: 'Brand reality check' },
    // Facebook public post comments
    { q: `site:facebook.com "${cn}" comments OR discussion -"${cn}" page`, platform: 'Facebook Comments', reveals: 'Legacy audience sentiment' },
    // Mastodon federated threads
    { q: `site:mastodon.social OR site:mastodon.online "${cn}"`, platform: 'Mastodon Threads', reveals: 'Tech ethics chatter' },
    // Bluesky threads
    { q: `site:bsky.app "${cn}" thread OR discussion`, platform: 'Bluesky Threads', reveals: 'Early Gen-Z signals' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, reveals } = queries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'B-social-threads', platform, 'Global')
      sig.whatItReveals = reveals
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// C. VIDEO COMMENT ECOSYSTEMS (HUGELY UNDERRATED)
//    Comments here are low effort, high honesty.
//    If users say "anyone else?" → strong L4 signal.
//    (YouTube comments already fetched in youtube.ts for L5, but here
//     we search for community-style video commentary threads)
// ════════════════════════════════════════════════════════════════════

async function searchVideoCommentEcosystems(companyName: string): Promise<L4Signal[]> {
  const signals: L4Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; reveals: string }[] = [
    // YouTube community discussions (non-official channel content)
    { q: `site:youtube.com "${cn}" review OR rant OR scam OR truth OR honest -"${cn}" channel`, platform: 'YouTube (Community)', reveals: 'Payment & support leaks' },
    // TikTok commentary
    { q: `site:tiktok.com "${cn}" storytime OR "my experience" OR rant OR review`, platform: 'TikTok (Stories)', reveals: 'Fast trend detection' },
    // Twitch chat logs (public clips/VODs)
    { q: `site:twitch.tv "${cn}" clip OR vod OR reaction`, platform: 'Twitch (Public)', reveals: 'Live reaction signal' },
    // Vimeo comments (niche industries)
    { q: `site:vimeo.com "${cn}" discussion OR comment`, platform: 'Vimeo', reveals: 'Niche industry discussion' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, reveals } = queries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'C-video-comments', platform, 'Global')
      sig.whatItReveals = reveals
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// D. FORUMS (THE LONG-MEMORY LAYER)
//    Forums remember what social media forgets.
//    Forum age > comment count.
// ════════════════════════════════════════════════════════════════════

async function searchForums(companyName: string): Promise<L4Signal[]> {
  const signals: L4Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; reveals: string }[] = [
    // Industry-specific forums — high context
    { q: `"${cn}" forum discussion review -site:reddit.com -site:glassdoor.com -site:indeed.com -site:trustpilot.com`, platform: 'Industry Forum', reveals: 'High-context community memory' },
    // Tech product forums — feature truth
    { q: `"${cn}" forum bug OR feature OR issue OR support -site:reddit.com -site:stackoverflow.com`, platform: 'Tech Product Forum', reveals: 'Feature truth / product reality' },
    // Startup communities — funding & churn
    { q: `site:indiehackers.com OR site:startupschool.org "${cn}" discussion OR review OR experience`, platform: 'Startup Community', reveals: 'Funding & churn signals' },
    // Finance / fintech boards — trust issues
    { q: `"${cn}" forum fintech OR finance OR trust OR scam site:bogleheads.org OR site:mrmoneymustache.com OR site:biggerpockets.com`, platform: 'Finance Forum', reveals: 'Trust issues / financial reality' },
    // Gaming forums (if company is game-related) — youth sentiment
    { q: `"${cn}" site:resetera.com OR site:neogaf.com OR site:gamefaqs.com`, platform: 'Gaming Forum', reveals: 'Youth sentiment / gamer crowd' },
    // Crypto forums — scam detection
    { q: `"${cn}" site:bitcointalk.org OR "crypto forum" OR "defi forum"`, platform: 'Crypto Forum', reveals: 'Scam detection / crypto trust' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, reveals } = queries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'D-forums', platform, 'Global')
      sig.whatItReveals = reveals
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// E. PUBLIC CHAT & PSEUDO-PRIVATE COMMUNITIES (LIMITED)
//    Only include if publicly readable.
//    NEVER: private Discords, invite-only Slack, WhatsApp groups.
// ════════════════════════════════════════════════════════════════════

async function searchPublicChatCommunities(companyName: string): Promise<L4Signal[]> {
  const signals: L4Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; reveals: string }[] = [
    // Discord public servers (indexed messages)
    { q: `site:discord.com "${cn}" OR site:discordapp.com "${cn}"`, platform: 'Discord (Public)', reveals: 'Supplemental community signal' },
    // Telegram public channels
    { q: `site:t.me "${cn}" channel OR group`, platform: 'Telegram (Public)', reveals: 'Region-specific community signal' },
    // Matrix public rooms
    { q: `site:matrix.to "${cn}" OR "matrix.org" "${cn}" room`, platform: 'Matrix (Public)', reveals: 'Privacy-focused user sentiment' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 4)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, reveals } = queries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'E-public-chat', platform, 'Global')
      sig.whatItReveals = reveals
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// F. Q&A, COMPLAINT & ADVICE BOARDS (NON-TRANSACTIONAL)
//    If it's advice or warning, not a review → Layer 4.
//    If payment + resolution → Layer 5.
//    If discussion + warning → Layer 4.
// ════════════════════════════════════════════════════════════════════

async function searchQAComplaintBoards(companyName: string): Promise<L4Signal[]> {
  const signals: L4Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; reveals: string }[] = [
    // Consumer advice forums — warning signals
    { q: `"${cn}" consumer advice OR consumer warning forum -site:trustpilot.com -site:bbb.org`, platform: 'Consumer Advice Forum', reveals: 'Warning signals — pre-complaint' },
    // Scam-report boards — trust collapse
    { q: `"${cn}" scam OR fraud OR "is it legit" site:scamadviser.com OR site:ripoffreport.com OR site:sitejabber.com`, platform: 'Scam Report Board', reveals: 'Trust collapse / reputation floor' },
    // "Is X legit?" threads — reputation floor
    { q: `"is ${cn} legit" OR "is ${cn} a scam" OR "should I trust ${cn}" OR "${cn} safe to use"`, platform: '"Is It Legit?" Threads', reveals: 'Reputation floor signal' },
    // Legal advice forums — early escalation
    { q: `"${cn}" legal advice OR "can I sue" OR "my rights" OR "unfair" forum -site:reddit.com`, platform: 'Legal Advice Forum', reveals: 'Early escalation signal' },
    // Reddit-specific legal & advice threads
    { q: `site:reddit.com/r/legaladvice OR site:reddit.com/r/personalfinance "${cn}"`, platform: 'Reddit Legal/Finance', reveals: 'Escalation from crowd to action' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, reveals } = queries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'F-qa-complaint', platform, 'Global')
      sig.whatItReveals = reveals
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// G. COUNTRY- & LANGUAGE-SPECIFIC COMMUNITY PLATFORMS
//    This is where non-US truth lives.
//    Local language ≠ lower signal. Often it's higher.
// ════════════════════════════════════════════════════════════════════

async function searchRegionalCommunities(companyName: string): Promise<L4Signal[]> {
  const signals: L4Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; region: string; reveals: string }[] = [
    // V2EX — China
    { q: `site:v2ex.com "${cn}"`, platform: 'V2EX', region: 'China', reveals: 'Chinese tech community perception' },
    // Zhihu — China
    { q: `site:zhihu.com "${cn}"`, platform: 'Zhihu', region: 'China', reveals: 'Chinese intellectual discourse' },
    // 2ch / 5ch — Japan
    { q: `site:5ch.net OR site:2ch.sc "${cn}"`, platform: '2ch/5ch', region: 'Japan', reveals: 'Japanese anonymous crowd truth' },
    // PTT — Taiwan
    { q: `site:ptt.cc "${cn}"`, platform: 'PTT', region: 'Taiwan', reveals: 'Taiwan public discussion' },
    // Ekşi Sözlük — Turkey
    { q: `site:eksisozluk.com "${cn}"`, platform: 'Ekşi Sözlük', region: 'Turkey', reveals: 'Turkish crowd perception' },
    // Pikabu — Russia
    { q: `site:pikabu.ru "${cn}"`, platform: 'Pikabu', region: 'Russia', reveals: 'Russian community sentiment' },
    // HWZone — Singapore
    { q: `site:hwzone.co.il OR site:hardwarezone.com.sg "${cn}"`, platform: 'HWZone', region: 'Singapore', reveals: 'Singapore tech sentiment' },
    // Reddit country subs — global local threads
    { q: `site:reddit.com/r/de OR site:reddit.com/r/france OR site:reddit.com/r/india OR site:reddit.com/r/japan "${cn}"`, platform: 'Reddit Country Subs', region: 'Multi-Region', reveals: 'Local-language community reality' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 4)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, region, reveals } = queries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'G-regional-communities', platform, region)
      sig.whatItReveals = reveals
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// H. EDGE-CASE BUT VALID LAYER 4 SOURCES
// ════════════════════════════════════════════════════════════════════

async function searchEdgeCaseSources(companyName: string): Promise<L4Signal[]> {
  const signals: L4Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; reveals: string }[] = [
    // Comment sections on news sites — crowd reaction
    { q: `"${cn}" comments "what do you think" OR discussion site:arstechnica.com OR site:theverge.com OR site:techcrunch.com`, platform: 'News Comment Section', reveals: 'Crowd reaction to events' },
    // GitHub issues by non-employees — user frustration
    { q: `site:github.com "${cn}" issue OR bug OR broken -org:${cn.replace(/\s/g, '').toLowerCase()}`, platform: 'GitHub Issues (Users)', reveals: 'User frustration / product issues' },
    // Product comparison comments — peer warning
    { q: `"${cn}" vs OR "compared to" OR alternative OR competitor discussion comments`, platform: 'Product Comparison', reveals: 'Peer warning / positioning' },
    // YouTube livestream chats (public) — live honesty
    { q: `site:youtube.com "${cn}" livestream OR "live chat" OR reaction`, platform: 'YouTube Livestream', reveals: 'Live honesty / unfiltered reaction' },
    // Meme threads referencing company — cultural penetration
    { q: `"${cn}" meme OR "starter pack" OR "nobody:" site:reddit.com OR site:twitter.com OR site:x.com`, platform: 'Meme Threads', reveals: 'Cultural penetration — company as meme' },
    // Screenshot-based discussions — viral distrust
    { q: `"${cn}" screenshot OR "look at this" OR exposed OR receipts`, platform: 'Screenshot Discussions', reveals: 'Viral distrust / evidence-based crowd' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, reveals } = queries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'H-edge-cases', platform, 'Global')
      sig.whatItReveals = reveals
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ════════════════════════════════════════════════════════════════════

/**
 * Fetch ALL L4 Community & Peer Reality signals.
 * Runs all 8 categories (A–H) in parallel.
 *
 * NOTE: This supplements reddit.ts, redditFree.ts and hackerNews.ts
 * which cover the core Reddit & HN pipelines. This file adds the
 * remaining ~50+ surfaces from the L4 Master Source Table.
 */
export async function fetchCommunityReality(
  companyName: string,
): Promise<CommunityRealityResult> {
  const sourcesSearched: string[] = []

  // Run ALL L4 categories in parallel
  const [
    publicDiscussion,
    socialThreads,
    videoComments,
    forums,
    publicChat,
    qaComplaint,
    regionalCommunities,
    edgeCases,
  ] = await Promise.allSettled([
    searchPublicDiscussionPlatforms(companyName),
    searchSocialMediaThreads(companyName),
    searchVideoCommentEcosystems(companyName),
    searchForums(companyName),
    searchPublicChatCommunities(companyName),
    searchQAComplaintBoards(companyName),
    searchRegionalCommunities(companyName),
    searchEdgeCaseSources(companyName),
  ])

  const allSignals: L4Signal[] = []

  const collect = (settled: PromiseSettledResult<L4Signal[]>, source: string) => {
    sourcesSearched.push(source)
    if (settled.status === 'fulfilled') {
      allSignals.push(...settled.value)
    }
  }

  collect(publicDiscussion, 'Quora/StackOverflow/Slashdot/Lobsters (API+SerpAPI)')
  collect(socialThreads, 'X-Threads/Threads/TikTok/Instagram/Facebook/Mastodon/Bluesky (SerpAPI)')
  collect(videoComments, 'YouTube-Community/TikTok-Stories/Twitch/Vimeo (SerpAPI)')
  collect(forums, 'IndustryForums/TechForums/StartupCommunities/FinanceBoards/GamingForums/CryptoForums (SerpAPI)')
  collect(publicChat, 'Discord-Public/Telegram-Public/Matrix-Public (SerpAPI)')
  collect(qaComplaint, 'ConsumerAdvice/ScamBoards/IsItLegit/LegalAdvice (SerpAPI)')
  collect(regionalCommunities, 'V2EX/Zhihu/2ch-5ch/PTT/EkşiSözlük/Pikabu/HWZone/RedditCountrySubs (SerpAPI)')
  collect(edgeCases, 'NewsComments/GitHubUserIssues/ProductComparisons/YTLivestream/Memes/Screenshots (SerpAPI)')

  // Deduplicate across all categories
  const dedupedSignals = deduplicateSignals(allSignals)

  // Build breakdowns
  const categoryBreakdown: Record<L4SourceCategory, number> = {
    'A-public-discussion': 0,
    'B-social-threads': 0,
    'C-video-comments': 0,
    'D-forums': 0,
    'E-public-chat': 0,
    'F-qa-complaint': 0,
    'G-regional-communities': 0,
    'H-edge-cases': 0,
  }
  const platformBreakdown: Record<string, number> = {}
  const regionBreakdown: Record<string, number> = {}
  const signalStrengthBreakdown: Record<string, number> = {}

  for (const s of dedupedSignals) {
    categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + 1
    platformBreakdown[s.platform] = (platformBreakdown[s.platform] || 0) + 1
    regionBreakdown[s.region] = (regionBreakdown[s.region] || 0) + 1
    signalStrengthBreakdown[s.signalStrength] = (signalStrengthBreakdown[s.signalStrength] || 0) + 1
  }

  console.log(
    `[CommunityReality] L4 scan complete: ${dedupedSignals.length} signals across ${Object.keys(platformBreakdown).length} platforms. ` +
      `Categories: ${Object.entries(categoryBreakdown).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')}`,
  )

  return {
    signals: dedupedSignals,
    categoryBreakdown,
    platformBreakdown,
    regionBreakdown,
    signalStrengthBreakdown,
    totalFound: dedupedSignals.length,
    sourcesSearched,
  }
}
