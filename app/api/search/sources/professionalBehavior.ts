/**
 * L2 — Semi-Public Professional Behavior Scraper (Master Source Table)
 *
 * Discovers and collects how people tied to a company behave publicly
 * when reputations are on the line but scripts are thinner.
 *
 * Categories (from L2 Master Source Table):
 *   A. Professional Social Networks (personal accounts)
 *   B. Microblogging & Short-Form Commentary
 *   C. Long-Form Writing by Humans (not company-owned)
 *   D. Podcasts, Interviews & Public Speaking
 *   E. Developer & Technical Professional Surfaces
 *   F. Hiring & Recruiting — Human-Authored
 *   G. Professional Communities (non-anonymous)
 *   H. Edge Cases
 *
 * LOCK RULE: Is a human speaking publicly, without company editorial
 *            control, in a professional context?  → Layer 2
 *
 * Data sources:
 *   • SerpAPI Google search — LinkedIn personal posts, Medium/Substack,
 *     podcast appearances, conference talks, farewell/layoff posts
 *   • GitHub API (free, no key) — issues, discussions, READMEs
 *   • Dev.to API (free) — engineering blog posts mentioning company
 *   • Google News (via SerpAPI) — interviews, conference talks
 */

// ════════════════════════════════════════════════════════════════════
// PUBLIC TYPES
// ════════════════════════════════════════════════════════════════════

export type L2SpeakerClass =
  | 'leader'
  | 'current-employee'
  | 'ex-employee'
  | 'recruiter'
  | 'partner'
  | 'outsider'
  | 'founder'
  | 'hiring-manager'

export type L2Proximity =
  | 'first-hand'
  | 'second-hand'
  | 'observational'
  | 'speculative'

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

export type L2Category =
  | 'A-professional-social'
  | 'B-microblogging'
  | 'C-long-form'
  | 'D-podcast-interview'
  | 'E-dev-technical'
  | 'F-hiring-recruiting'
  | 'G-professional-community'
  | 'H-edge-case'

export interface L2RawSignal {
  category: L2Category
  platform: string
  title: string
  snippet: string
  url: string
  author: string
  date: string
  speakerClass: L2SpeakerClass
  proximity: L2Proximity
  tone: L2Tone
  signalType: string   // e.g. "farewell-post", "thought-leadership", "podcast-appearance"
}

export interface L2DevSignal {
  platform: 'GitHub' | 'StackOverflow' | 'Dev.to' | 'Hashnode'
  type: 'issue' | 'discussion' | 'readme' | 'post-mortem' | 'blog-post' | 'answer'
  title: string
  snippet: string
  url: string
  author: string
  date: string
  reactions: number
  comments: number
}

export interface ProfessionalBehaviorResult {
  // All discovered signals
  signals: L2RawSignal[]

  // Category E: Dev & Technical
  devSignals: L2DevSignal[]

  // Aggregate stats
  platformBreakdown: Record<string, number>
  categoryBreakdown: Record<L2Category, number>
  toneBreakdown: Record<string, number>
  totalFound: number
  sourcesSearched: string[]
}

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ════════════════════════════════════════════════════════════════════
// SPEAKER CLASS INFERENCE
// ════════════════════════════════════════════════════════════════════

function inferSpeakerClass(text: string, title: string): L2SpeakerClass {
  const combined = `${title} ${text}`.toLowerCase()
  if (/\b(ceo|cto|cfo|coo|vp |vice president|chief|co-founder|founder|partner|managing director|head of|svp |evp )\b/i.test(combined)) return 'leader'
  if (/\b(recruiter|recruiting|talent acquisition|hiring manager)\b/i.test(combined)) return 'recruiter'
  if (/\b(former|ex-|previously at|used to work|my time at|left the company|after leaving)\b/i.test(combined)) return 'ex-employee'
  if (/\b(i work at|working at|currently at|joined|my role at|here at|our team at)\b/i.test(combined)) return 'current-employee'
  if (/\b(hiring|we.re hiring|open roles?|join our team|dm me for)\b/i.test(combined)) return 'hiring-manager'
  return 'outsider'
}

function inferTone(text: string): L2Tone {
  const lower = text.toLowerCase()
  if (/\b(proud|excited|thrilled|grateful|honored|blessed|amazing team|love working)\b/i.test(lower)) return 'celebratory'
  if (/\b(unfortunately|tough|difficult|lessons learned|mistake|failure|regret)\b/i.test(lower)) return 'reflective'
  if (/\b(concerned|worried|disappointed|frustrating|unacceptable)\b/i.test(lower)) return 'frustrated'
  if (/\b(defend|clarify|context|actually|misunderstood|let me explain)\b/i.test(lower)) return 'defensive'
  if (/\b(promoting|launching|announcing|introducing|check out our)\b/i.test(lower)) return 'promotional'
  if (/\b(real talk|honestly|truth is|authentic|transparent|my experience was)\b/i.test(lower)) return 'authentic'
  if (/\b(empathy|understanding|support|together|community|help)\b/i.test(lower)) return 'empathetic'
  return 'neutral'
}

function inferSignalType(text: string, title: string): string {
  const combined = `${title} ${text}`.toLowerCase()
  if (/farewell|goodbye|last day|moving on|leaving|departed|next chapter/i.test(combined)) return 'farewell-post'
  if (/laid off|layoff|restructur|let go|rif |reduction in force/i.test(combined)) return 'layoff-post'
  if (/open to work|looking for|job search|available for/i.test(combined)) return 'open-to-work'
  if (/we.re hiring|open roles?|join our team|dm me for/i.test(combined)) return 'hiring-post'
  if (/podcast|interview|episode|guest|spoke at|talked about/i.test(combined)) return 'podcast-appearance'
  if (/conference|talk|keynote|panel|summit|presentation|fireside/i.test(combined)) return 'conference-talk'
  if (/lessons? learned|what i learned|reflections?|retrospective/i.test(combined)) return 'lessons-learned'
  if (/apolog|sorry|take responsibility|my mistake/i.test(combined)) return 'public-apology'
  if (/thought leadership|opinion|perspective|take on|my view/i.test(combined)) return 'thought-leadership'
  if (/culture|values|team|workplace|how we work/i.test(combined)) return 'culture-signal'
  if (/resign|resignation|step down/i.test(combined)) return 'resignation-letter'
  if (/whistleblow|speak up|report concern/i.test(combined)) return 'whistleblower-statement'
  return 'general'
}

function inferCategory(platform: string, signalType: string): L2Category {
  if (platform === 'LinkedIn') return 'A-professional-social'
  if (['X/Twitter', 'Mastodon', 'Bluesky'].includes(platform)) return 'B-microblogging'
  if (['Medium', 'Substack', 'Dev.to', 'Hashnode', 'Ghost', 'Personal Blog'].includes(platform)) return 'C-long-form'
  if (['Podcast', 'YouTube Interview', 'Conference Talk'].includes(platform)) return 'D-podcast-interview'
  if (['GitHub', 'StackOverflow'].includes(platform)) return 'E-dev-technical'
  if (signalType === 'hiring-post' || signalType === 'open-to-work') return 'F-hiring-recruiting'
  if (['Indie Hackers', 'Product Hunt', 'Discord', 'Slack Community', 'LinkedIn Group'].includes(platform)) return 'G-professional-community'
  if (['farewell-post', 'layoff-post', 'public-apology', 'resignation-letter', 'whistleblower-statement', 'lessons-learned'].includes(signalType)) return 'H-edge-case'
  return 'A-professional-social'
}

// ════════════════════════════════════════════════════════════════════
// SEARCH (SerpAPI removed) — LinkedIn, Medium, Podcasts, Talks
// ════════════════════════════════════════════════════════════════════

async function serpSearch(
  _query: string,
  _numResults = 10,
): Promise<{ title: string; snippet: string; link: string; date?: string }[]> {
  return []
}

/**
 * Category A+F — LinkedIn personal posts (via Google)
 * We can't scrape LinkedIn directly, but SerpAPI picks up indexed posts.
 */
async function searchLinkedInSignals(companyName: string): Promise<L2RawSignal[]> {
  const signals: L2RawSignal[] = []
  const queries = [
    `site:linkedin.com/pulse "${companyName}" OR "working at ${companyName}"`,
    `site:linkedin.com/posts "${companyName}" farewell OR "last day" OR "moving on" OR layoff`,
    `site:linkedin.com/posts "${companyName}" "we're hiring" OR "open roles" OR "join our team"`,
    `site:linkedin.com/posts "${companyName}" culture OR values OR "my experience" OR leadership`,
    `site:linkedin.com/in "${companyName}" "open to work" OR "looking for" OR "#opentowork"`,
  ]

  const results = await Promise.allSettled(queries.map((q) => serpSearch(q, 8)))

  for (const settled of results) {
    if (settled.status !== 'fulfilled') continue
    for (const r of settled.value) {
      if (!r.link.includes('linkedin.com')) continue
      const signalType = inferSignalType(r.snippet, r.title)
      signals.push({
        category: signalType === 'hiring-post' ? 'F-hiring-recruiting' : 'A-professional-social',
        platform: 'LinkedIn',
        title: r.title,
        snippet: r.snippet,
        url: r.link,
        author: extractLinkedInAuthor(r.title, r.link),
        date: r.date || 'Recent',
        speakerClass: inferSpeakerClass(r.snippet, r.title),
        proximity: 'first-hand',
        tone: inferTone(r.snippet),
        signalType,
      })
    }
  }

  return deduplicateSignals(signals)
}

function extractLinkedInAuthor(title: string, url: string): string {
  // LinkedIn titles often have "Author Name on LinkedIn: ..."
  const match = title.match(/^(.+?)\s+(?:on LinkedIn|posted on|–)/i)
  if (match) return match[1].trim()
  // Try from URL: /in/firstname-lastname/
  const urlMatch = url.match(/linkedin\.com\/in\/([a-z0-9-]+)/i)
  if (urlMatch) return urlMatch[1].replace(/-/g, ' ')
  return 'LinkedIn User'
}

/**
 * Category B — X/Twitter, Mastodon, Bluesky signals
 */
async function searchMicrobloggingSignals(companyName: string): Promise<L2RawSignal[]> {
  const signals: L2RawSignal[] = []

  const queries = [
    `site:x.com OR site:twitter.com "${companyName}" "worked at" OR "used to work" OR culture OR layoff OR hiring`,
    `site:mastodon.social OR site:bsky.app "${companyName}" engineer OR developer OR culture`,
  ]

  const results = await Promise.allSettled(queries.map((q) => serpSearch(q, 8)))

  for (const settled of results) {
    if (settled.status !== 'fulfilled') continue
    for (const r of settled.value) {
      let platform = 'X/Twitter'
      if (r.link.includes('mastodon')) platform = 'Mastodon'
      if (r.link.includes('bsky.app')) platform = 'Bluesky'

      const signalType = inferSignalType(r.snippet, r.title)
      signals.push({
        category: 'B-microblogging',
        platform,
        title: r.title,
        snippet: r.snippet,
        url: r.link,
        author: r.title.split(/[-–—@]/)[0]?.trim() || 'User',
        date: r.date || 'Recent',
        speakerClass: inferSpeakerClass(r.snippet, r.title),
        proximity: 'first-hand',
        tone: inferTone(r.snippet),
        signalType,
      })
    }
  }

  return deduplicateSignals(signals)
}

/**
 * Category C — Medium, Substack, personal blogs
 */
async function searchLongFormSignals(companyName: string): Promise<L2RawSignal[]> {
  const signals: L2RawSignal[] = []

  const queries = [
    `site:medium.com "${companyName}" culture OR "my experience" OR engineering OR "working at" OR leadership`,
    `site:substack.com "${companyName}" OR "at ${companyName}" OR "left ${companyName}" OR "working at ${companyName}"`,
    `site:dev.to "${companyName}" culture OR engineering OR "how we" OR experience`,
    `site:hashnode.dev OR site:hashnode.com "${companyName}" engineering OR developer OR experience`,
  ]

  const results = await Promise.allSettled(queries.map((q) => serpSearch(q, 6)))

  for (const settled of results) {
    if (settled.status !== 'fulfilled') continue
    for (const r of settled.value) {
      let platform = 'Personal Blog'
      if (r.link.includes('medium.com')) platform = 'Medium'
      if (r.link.includes('substack.com')) platform = 'Substack'
      if (r.link.includes('dev.to')) platform = 'Dev.to'
      if (r.link.includes('hashnode')) platform = 'Hashnode'

      signals.push({
        category: 'C-long-form',
        platform,
        title: r.title,
        snippet: r.snippet,
        url: r.link,
        author: extractBlogAuthor(r.title, r.link, platform),
        date: r.date || 'Recent',
        speakerClass: inferSpeakerClass(r.snippet, r.title),
        proximity: 'first-hand',
        tone: inferTone(r.snippet),
        signalType: inferSignalType(r.snippet, r.title),
      })
    }
  }

  return deduplicateSignals(signals)
}

function extractBlogAuthor(title: string, url: string, platform: string): string {
  if (platform === 'Medium') {
    const match = url.match(/medium\.com\/@([a-z0-9._-]+)/i)
    if (match) return `@${match[1]}`
  }
  if (platform === 'Dev.to') {
    const match = url.match(/dev\.to\/([a-z0-9_-]+)\//i)
    if (match) return match[1]
  }
  // Fallback: try "by Author" pattern from title
  const byMatch = title.match(/(?:by|from)\s+(.+?)(?:\s*[-|–]|$)/i)
  if (byMatch) return byMatch[1].trim()
  return 'Author'
}

/**
 * Category D — Podcasts, interviews, conference talks, fireside chats
 */
async function searchPodcastInterviewSignals(companyName: string): Promise<L2RawSignal[]> {
  const signals: L2RawSignal[] = []

  const queries = [
    `"${companyName}" podcast interview CEO OR CTO OR founder -site:${companyName.toLowerCase().replace(/\s/g, '')}.com`,
    `"${companyName}" conference talk keynote panel -site:youtube.com -site:${companyName.toLowerCase().replace(/\s/g, '')}.com`,
    `"${companyName}" fireside chat OR "lessons learned" founder OR CEO OR CTO`,
  ]

  const results = await Promise.allSettled(queries.map((q) => serpSearch(q, 6)))

  for (const settled of results) {
    if (settled.status !== 'fulfilled') continue
    for (const r of settled.value) {
      let platform = 'Podcast'
      if (/conference|summit|talk|keynote|panel/i.test(r.title + r.snippet)) platform = 'Conference Talk'
      if (/youtube\.com/i.test(r.link)) platform = 'YouTube Interview'
      if (/fireside/i.test(r.title + r.snippet)) platform = 'Conference Talk'

      signals.push({
        category: 'D-podcast-interview',
        platform,
        title: r.title,
        snippet: r.snippet,
        url: r.link,
        author: r.title.split(/[-–—|:]/)[0]?.trim() || 'Speaker',
        date: r.date || 'Recent',
        speakerClass: inferSpeakerClass(r.snippet, r.title),
        proximity: 'first-hand',
        tone: inferTone(r.snippet),
        signalType: inferSignalType(r.snippet, r.title),
      })
    }
  }

  return deduplicateSignals(signals)
}

/**
 * Category E — GitHub issues, discussions, README "how we work" sections
 * Uses free GitHub Search API (no key needed, limited to 10 req/min unauthenticated)
 */
async function searchGitHubSignals(companyName: string): Promise<L2DevSignal[]> {
  const devSignals: L2DevSignal[] = []
  const headers: Record<string, string> = {
    'User-Agent': UA,
    Accept: 'application/vnd.github.v3+json',
  }
  // Add GitHub token if available
  const ghToken = process.env.GITHUB_TOKEN
  if (ghToken) headers.Authorization = `token ${ghToken}`

  // Search issues
  try {
    const q = encodeURIComponent(`"${companyName}" in:title,body is:issue`)
    const res = await fetch(
      `https://api.github.com/search/issues?q=${q}&sort=reactions&per_page=10`,
      { headers, signal: AbortSignal.timeout(10000) },
    )
    if (res.ok) {
      const data = await res.json()
      for (const item of (data.items || []).slice(0, 8)) {
        devSignals.push({
          platform: 'GitHub',
          type: 'issue',
          title: item.title || '',
          snippet: (item.body || '').substring(0, 500),
          url: item.html_url || '',
          author: item.user?.login || 'github-user',
          date: item.created_at ? new Date(item.created_at).toISOString().split('T')[0] : 'Recent',
          reactions: item.reactions?.total_count || 0,
          comments: item.comments || 0,
        })
      }
    }
  } catch { /* non-critical */ }

  // Search discussions (code search for company mentions in READMEs/docs)
  try {
    const q = encodeURIComponent(`"${companyName}" "how we work" OR "engineering culture" OR "our process" in:readme`)
    const res = await fetch(
      `https://api.github.com/search/code?q=${q}&per_page=5`,
      { headers, signal: AbortSignal.timeout(10000) },
    )
    if (res.ok) {
      const data = await res.json()
      for (const item of (data.items || []).slice(0, 5)) {
        devSignals.push({
          platform: 'GitHub',
          type: 'readme',
          title: `${item.repository?.full_name || 'Repo'}: ${item.name || 'README'}`,
          snippet: item.text_matches?.[0]?.fragment || `File: ${item.path}`,
          url: item.html_url || '',
          author: item.repository?.owner?.login || 'org',
          date: 'Recent',
          reactions: item.repository?.stargazers_count || 0,
          comments: 0,
        })
      }
    }
  } catch { /* non-critical */ }

  return devSignals
}

/**
 * Category E — Dev.to posts mentioning company (free API)
 */
async function searchDevToSignals(companyName: string): Promise<L2DevSignal[]> {
  const devSignals: L2DevSignal[] = []

  try {
    const res = await fetch(
      `https://dev.to/api/articles?tag=${encodeURIComponent(companyName.toLowerCase())}&per_page=10`,
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) },
    )
    if (res.ok) {
      const articles = await res.json()
      for (const a of (articles || []).slice(0, 8)) {
        devSignals.push({
          platform: 'Dev.to',
          type: 'blog-post',
          title: a.title || '',
          snippet: a.description || '',
          url: a.url || '',
          author: a.user?.username || 'dev-user',
          date: a.published_at ? new Date(a.published_at).toISOString().split('T')[0] : 'Recent',
          reactions: a.positive_reactions_count || 0,
          comments: a.comments_count || 0,
        })
      }
    }
  } catch { /* non-critical */ }

  // Also search by text if tag search was empty
  if (devSignals.length === 0) {
    try {
      const res = await fetch(
        `https://dev.to/api/articles?per_page=8&tag=career,culture,workplace&top=30`,
        { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) },
      )
      // We can't text-search Dev.to API, so we'll rely on SerpAPI for that
    } catch { /* non-critical */ }
  }

  return devSignals
}

/**
 * Category G — Professional communities: Indie Hackers, Product Hunt
 */
async function searchProfessionalCommunitySignals(companyName: string): Promise<L2RawSignal[]> {
  const signals: L2RawSignal[] = []

  const queries = [
    `site:indiehackers.com "${companyName}" OR "at ${companyName}"`,
    `site:producthunt.com "${companyName}" discussion OR review OR launch`,
  ]

  const results = await Promise.allSettled(queries.map((q) => serpSearch(q, 5)))

  for (const settled of results) {
    if (settled.status !== 'fulfilled') continue
    for (const r of settled.value) {
      let platform = 'Indie Hackers'
      if (r.link.includes('producthunt.com')) platform = 'Product Hunt'

      signals.push({
        category: 'G-professional-community',
        platform,
        title: r.title,
        snippet: r.snippet,
        url: r.link,
        author: r.title.split(/[-–—|]/)[0]?.trim() || 'Community Member',
        date: r.date || 'Recent',
        speakerClass: inferSpeakerClass(r.snippet, r.title),
        proximity: 'observational',
        tone: inferTone(r.snippet),
        signalType: inferSignalType(r.snippet, r.title),
      })
    }
  }

  return deduplicateSignals(signals)
}

/**
 * Category H — Edge cases: resignation letters, apologies, whistleblower, court testimony
 */
async function searchEdgeCaseSignals(companyName: string): Promise<L2RawSignal[]> {
  const signals: L2RawSignal[] = []

  const queries = [
    `"${companyName}" "resignation letter" OR "public apology" OR "lessons learned" OR "i'm leaving"`,
    `"${companyName}" whistleblower OR "court testimony" OR "open to work" site:linkedin.com`,
  ]

  const results = await Promise.allSettled(queries.map((q) => serpSearch(q, 5)))

  for (const settled of results) {
    if (settled.status !== 'fulfilled') continue
    for (const r of settled.value) {
      signals.push({
        category: 'H-edge-case',
        platform: inferPlatformFromUrl(r.link),
        title: r.title,
        snippet: r.snippet,
        url: r.link,
        author: r.title.split(/[-–—|]/)[0]?.trim() || 'Individual',
        date: r.date || 'Recent',
        speakerClass: inferSpeakerClass(r.snippet, r.title),
        proximity: 'first-hand',
        tone: inferTone(r.snippet),
        signalType: inferSignalType(r.snippet, r.title),
      })
    }
  }

  return deduplicateSignals(signals)
}

function inferPlatformFromUrl(url: string): string {
  if (url.includes('linkedin.com')) return 'LinkedIn'
  if (url.includes('twitter.com') || url.includes('x.com')) return 'X/Twitter'
  if (url.includes('medium.com')) return 'Medium'
  if (url.includes('substack.com')) return 'Substack'
  if (url.includes('dev.to')) return 'Dev.to'
  if (url.includes('github.com')) return 'GitHub'
  if (url.includes('youtube.com')) return 'YouTube Interview'
  if (url.includes('producthunt.com')) return 'Product Hunt'
  if (url.includes('indiehackers.com')) return 'Indie Hackers'
  if (url.includes('mastodon')) return 'Mastodon'
  if (url.includes('bsky.app')) return 'Bluesky'
  return 'Web'
}

function deduplicateSignals(signals: L2RawSignal[]): L2RawSignal[] {
  const seen = new Set<string>()
  return signals.filter((s) => {
    const key = s.url.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ════════════════════════════════════════════════════════════════════

export async function fetchProfessionalBehavior(
  companyName: string,
): Promise<ProfessionalBehaviorResult> {
  const sourcesSearched: string[] = []

  // Run ALL categories in parallel
  const [
    linkedInSignals,
    microbloggingSignals,
    longFormSignals,
    podcastSignals,
    gitHubDevSignals,
    devToDevSignals,
    communitySignals,
    edgeCaseSignals,
  ] = await Promise.allSettled([
    searchLinkedInSignals(companyName),
    searchMicrobloggingSignals(companyName),
    searchLongFormSignals(companyName),
    searchPodcastInterviewSignals(companyName),
    searchGitHubSignals(companyName),
    searchDevToSignals(companyName),
    searchProfessionalCommunitySignals(companyName),
    searchEdgeCaseSignals(companyName),
  ])

  // Collect all raw signals
  const allSignals: L2RawSignal[] = []
  const allDevSignals: L2DevSignal[] = []

  const addSignals = (settled: PromiseSettledResult<L2RawSignal[]>, source: string) => {
    sourcesSearched.push(source)
    if (settled.status === 'fulfilled') {
      allSignals.push(...settled.value)
    }
  }

  addSignals(linkedInSignals, 'LinkedIn (SerpAPI)')
  addSignals(microbloggingSignals, 'X/Twitter/Mastodon/Bluesky (SerpAPI)')
  addSignals(longFormSignals, 'Medium/Substack/Dev.to/Hashnode (SerpAPI)')
  addSignals(podcastSignals, 'Podcasts/Conferences (SerpAPI)')
  addSignals(communitySignals, 'Indie Hackers/Product Hunt (SerpAPI)')
  addSignals(edgeCaseSignals, 'Edge Cases (SerpAPI)')

  if (gitHubDevSignals.status === 'fulfilled') {
    allDevSignals.push(...gitHubDevSignals.value)
    sourcesSearched.push('GitHub API')
  }
  if (devToDevSignals.status === 'fulfilled') {
    allDevSignals.push(...devToDevSignals.value)
    sourcesSearched.push('Dev.to API')
  }

  // Build platform breakdown
  const platformBreakdown: Record<string, number> = {}
  for (const s of allSignals) {
    platformBreakdown[s.platform] = (platformBreakdown[s.platform] || 0) + 1
  }
  for (const d of allDevSignals) {
    platformBreakdown[d.platform] = (platformBreakdown[d.platform] || 0) + 1
  }

  // Build category breakdown
  const categoryBreakdown: Record<L2Category, number> = {
    'A-professional-social': 0,
    'B-microblogging': 0,
    'C-long-form': 0,
    'D-podcast-interview': 0,
    'E-dev-technical': 0,
    'F-hiring-recruiting': 0,
    'G-professional-community': 0,
    'H-edge-case': 0,
  }
  for (const s of allSignals) {
    categoryBreakdown[s.category]++
  }
  categoryBreakdown['E-dev-technical'] += allDevSignals.length

  // Build tone breakdown
  const toneBreakdown: Record<string, number> = {}
  for (const s of allSignals) {
    toneBreakdown[s.tone] = (toneBreakdown[s.tone] || 0) + 1
  }

  const totalFound = allSignals.length + allDevSignals.length

  console.log(
    `[ProfessionalBehavior] L2 scan complete: ${totalFound} signals found ` +
      `(${allSignals.length} general + ${allDevSignals.length} dev). ` +
      `Platforms: ${Object.entries(platformBreakdown).map(([k, v]) => `${k}:${v}`).join(', ')}`,
  )

  return {
    signals: allSignals,
    devSignals: allDevSignals,
    platformBreakdown,
    categoryBreakdown,
    toneBreakdown,
    totalFound,
    sourcesSearched,
  }
}
