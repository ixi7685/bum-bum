/**
 * Free LinkedIn Signal Search — NO API KEY NEEDED
 *
 * Scrapes Google search results for LinkedIn posts/articles about a company.
 * Covers L2 Professional Behavior categories:
 *   A — LinkedIn personal posts (farewell, culture, experience)
 *   C — LinkedIn Pulse articles (long-form)
 *   F — Recruiter/hiring posts
 *   H — Open to Work signals, whistleblower, edge cases
 *
 * Uses the same types as professionalBehavior.ts so it plugs in directly.
 */

import type {
  L2RawSignal,
  L2SpeakerClass,
  L2Tone,
  L2Category,
} from './professionalBehavior'
import { fetchWithRetry } from './httpRetry'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
let linkedInFreeThrottled = false

export function wasLinkedInFreeThrottled(): boolean {
  return linkedInFreeThrottled
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Google scraper ──────────────────────────────────────────────────────────

interface GoogleResult {
  title: string
  snippet: string
  link: string
  date: string
}

async function googleSearch(query: string, num: number = 10): Promise<GoogleResult[]> {
  const params = new URLSearchParams({
    q: query,
    num: String(num),
    hl: 'en',
    gl: 'us',
  })

  try {
    const { response: res, throttled } = await fetchWithRetry(`https://www.google.com/search?${params}`, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    }, {
      maxAttempts: 3,
      baseDelayMs: 900,
      maxDelayMs: 9000,
    })

    if (throttled || res.status === 429) {
      linkedInFreeThrottled = true
    }

    if (!res.ok) {
      console.warn(`[LinkedInFree] Google returned ${res.status}`)
      return []
    }

    const html = await res.text()
    if (html.includes('detected unusual traffic') || html.includes('captcha')) {
      console.warn('[LinkedInFree] Google captcha detected')
      linkedInFreeThrottled = true
      return []
    }

    return parseGoogleHtml(html)
  } catch (e) {
    console.error('[LinkedInFree] Google search error:', e)
    return []
  }
}

function parseGoogleHtml(html: string): GoogleResult[] {
  const results: GoogleResult[] = []

  // Extract snippets
  const snippetPattern = /<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/g
  const altSnippetPattern = /<span[^>]*class="[^"]*aCOpRe[^"]*"[^>]*>([\s\S]*?)<\/span>/g
  const snippets: string[] = []
  let sm
  while ((sm = snippetPattern.exec(html)) !== null) snippets.push(cleanText(sm[1]))
  let ai = 0
  while ((sm = altSnippetPattern.exec(html)) !== null) {
    if (snippets.length <= ai) snippets.push(cleanText(sm[1]))
    ai++
  }

  // Extract links + titles
  const linkPattern = /<a[^>]+href="\/url\?q=([^"&]+)[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g
  let match
  let idx = 0
  while ((match = linkPattern.exec(html)) !== null) {
    const link = decodeURIComponent(match[1])
    const title = cleanText(match[2])
    if (link.includes('google.com/') || !link.startsWith('http')) continue
    results.push({ title, snippet: snippets[idx] || '', link, date: 'Recent' })
    idx++
  }

  // Fallback
  if (results.length === 0) {
    const simplePattern = /<a\s+href="(https?:\/\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g
    let si = 0
    while ((match = simplePattern.exec(html)) !== null) {
      const link = match[1]
      const title = cleanText(match[2])
      if (link.includes('google.com')) continue
      results.push({ title, snippet: snippets[si] || '', link, date: 'Recent' })
      si++
    }
  }

  return results
}

// ─── Signal classification ───────────────────────────────────────────────────

function inferSpeakerClass(text: string): L2SpeakerClass {
  const t = text.toLowerCase()
  if (/ceo|cto|cfo|founder|co-founder|chief|president|vp\b|vice president/i.test(t)) return 'leader'
  if (/recruiter|talent|hiring manager/i.test(t)) return 'recruiter'
  if (/former|ex-|left|departed|used to work|previously at/i.test(t)) return 'ex-employee'
  if (/work at|working at|engineer at|developer at|currently at|our team/i.test(t)) return 'current-employee'
  return 'outsider'
}

function inferTone(text: string): L2Tone {
  const t = text.toLowerCase()
  if (/excited|thrilled|grateful|amazing|love|proud|honored/i.test(t)) return 'celebratory'
  if (/farewell|goodbye|last day|bittersweet|moving on|next chapter/i.test(t)) return 'reflective'
  if (/toxic|terrible|worst|disappointed|frustrated|angry|disgusted/i.test(t)) return 'frustrated'
  if (/we're hiring|join us|open roles|looking for/i.test(t)) return 'promotional'
  if (/defend|clarify|respond|misunderstand/i.test(t)) return 'defensive'
  if (/learned|insight|reflection|honest/i.test(t)) return 'authentic'
  return 'neutral'
}

function inferCategory(link: string, text: string): L2Category {
  const t = text.toLowerCase()
  if (/hiring|recruiter|"we're hiring"|open roles|job/i.test(t)) return 'F-hiring-recruiting'
  if (/farewell|last day|goodbye|resignation|whistleblow|open to work/i.test(t)) return 'H-edge-case'
  if (link.includes('linkedin.com/pulse') || link.includes('linkedin.com/article')) return 'C-long-form'
  return 'A-professional-social'
}

function inferSignalType(text: string): string {
  const t = text.toLowerCase()
  if (/farewell|last day|goodbye|leaving|moving on/i.test(t)) return 'farewell-post'
  if (/layoff|laid off|restructur|downsiz/i.test(t)) return 'layoff-signal'
  if (/hiring|"we're hiring"|open roles|join/i.test(t)) return 'hiring-post'
  if (/open to work|#opentowork|looking for/i.test(t)) return 'open-to-work'
  if (/culture|values|experience|working at/i.test(t)) return 'culture-post'
  if (/promote|milestone|anniversary/i.test(t)) return 'celebration'
  return 'professional-post'
}

function extractLinkedInAuthor(title: string, url: string): string {
  const match = title.match(/^(.+?)\s+(?:on LinkedIn|posted on|–|—|-)/i)
  if (match) return match[1].trim()
  const urlMatch = url.match(/linkedin\.com\/in\/([a-z0-9-]+)/i)
  if (urlMatch) return urlMatch[1].replace(/-/g, ' ')
  return 'LinkedIn User'
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface LinkedInFreeResult {
  signals: L2RawSignal[]
  totalFound: number
  sourcesSearched: string[]
}

/**
 * Fetch LinkedIn signals about a company using FREE Google search.
 * Targets LinkedIn posts, articles, and profiles that mention the company.
 */
export async function fetchLinkedInFree(companyName: string): Promise<LinkedInFreeResult> {
  console.log(`[LinkedInFree] Searching for: ${companyName}`)
  linkedInFreeThrottled = false

  const queries = [
    // A — Personal posts about culture/experience
    { q: `site:linkedin.com/posts "${companyName}" culture OR experience OR "working at" OR review`, label: 'LinkedIn Posts (Culture)' },
    // A — Farewell / departure posts
    { q: `site:linkedin.com/posts "${companyName}" farewell OR "last day" OR "moving on" OR layoff OR "next chapter"`, label: 'LinkedIn Posts (Farewell)' },
    // C — Pulse / long-form articles
    { q: `site:linkedin.com/pulse "${companyName}" OR "working at ${companyName}" OR "my experience at ${companyName}"`, label: 'LinkedIn Pulse Articles' },
    // F — Hiring/recruiter posts
    { q: `site:linkedin.com/posts "${companyName}" "we're hiring" OR "open roles" OR "join our team" OR recruiting`, label: 'LinkedIn Posts (Hiring)' },
    // H — Open to Work signals
    { q: `site:linkedin.com "${companyName}" "open to work" OR "#opentowork" OR "looking for opportunities"`, label: 'LinkedIn (Open to Work)' },
    // General company mentions
    { q: `site:linkedin.com "${companyName}" employee OR engineer OR review OR toxic OR amazing`, label: 'LinkedIn (General)' },
  ]

  const allSignals: L2RawSignal[] = []
  const seenUrls = new Set<string>()
  const sourcesSearched: string[] = []

  for (const { q, label } of queries) {
    try {
      const results = await googleSearch(q, 10)
      sourcesSearched.push(label)

      for (const r of results) {
        if (!r.link.includes('linkedin.com')) continue
        if (seenUrls.has(r.link)) continue
        seenUrls.add(r.link)

        const combined = `${r.title} ${r.snippet}`
        allSignals.push({
          category: inferCategory(r.link, combined),
          platform: 'LinkedIn',
          title: r.title,
          snippet: r.snippet,
          url: r.link,
          author: extractLinkedInAuthor(r.title, r.link),
          date: r.date || 'Recent',
          speakerClass: inferSpeakerClass(combined),
          proximity: 'first-hand',
          tone: inferTone(combined),
          signalType: inferSignalType(combined),
        })
      }
    } catch {
      // Non-critical, continue
    }

    // Stagger to avoid Google blocks
    await delay(1200)
  }

  console.log(`[LinkedInFree] Found ${allSignals.length} LinkedIn signals`)

  return {
    signals: allSignals,
    totalFound: allSignals.length,
    sourcesSearched,
  }
}
