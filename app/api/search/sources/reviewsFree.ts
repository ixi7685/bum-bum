/**
 * Free Glassdoor / Blind / Indeed / News Review Search — NO API KEY NEEDED
 *
 * Scrapes Google search results directly (no SerpAPI required).
 * Falls back gracefully if Google blocks — results are bonus data.
 *
 * Uses the same RealReviewResult / ReviewSearchResults types as reviews.ts
 * so it plugs in seamlessly.
 */

import { RealReviewResult, ReviewSearchResults } from './reviews'
import { fetchWithRetry } from './httpRetry'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
let reviewsFreeThrottled = false

export function wasReviewsFreeThrottled(): boolean {
  return reviewsFreeThrottled
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')        // strip HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return 'Unknown'
  }
}

// ─── Google scraper ──────────────────────────────────────────────────────────

interface GoogleResult {
  title: string
  snippet: string
  link: string
  date: string
}

/**
 * Scrape Google search results directly.
 * Returns parsed organic results. If Google blocks (429/captcha), returns [].
 */
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
      reviewsFreeThrottled = true
    }

    if (!res.ok) {
      console.warn(`[ReviewsFree] Google returned ${res.status}`)
      return []
    }

    const html = await res.text()

    // Check for captcha/block
    if (html.includes('detected unusual traffic') || html.includes('captcha')) {
      console.warn('[ReviewsFree] Google captcha detected')
      reviewsFreeThrottled = true
      return []
    }

    return parseGoogleHtml(html)
  } catch (e) {
    console.error('[ReviewsFree] Google search error:', e)
    return []
  }
}

/**
 * Parse organic results from raw Google HTML.
 * Google's HTML structure changes, so we use multiple fallback patterns.
 */
function parseGoogleHtml(html: string): GoogleResult[] {
  const results: GoogleResult[] = []

  // Pattern 1: Extract from <a href="/url?q=..." > blocks with <h3> titles
  // and nearby <span> snippets
  const linkPattern = /<a[^>]+href="\/url\?q=([^"&]+)[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g
  const snippetPattern = /<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>/g
  // Also try data-sncf pattern
  const altSnippetPattern = /<span[^>]*class="[^"]*aCOpRe[^"]*"[^>]*>([\s\S]*?)<\/span>/g

  // Collect all snippets
  const snippets: string[] = []
  let sm
  while ((sm = snippetPattern.exec(html)) !== null) {
    snippets.push(cleanText(sm[1]))
  }
  // Fallback snippets
  let altIdx = 0
  while ((sm = altSnippetPattern.exec(html)) !== null) {
    if (snippets.length <= altIdx) snippets.push(cleanText(sm[1]))
    altIdx++
  }

  // Collect links + titles
  let match
  let idx = 0
  while ((match = linkPattern.exec(html)) !== null) {
    const link = decodeURIComponent(match[1])
    const title = cleanText(match[2])

    // Skip Google's own pages
    if (link.includes('google.com/') && !link.includes('maps')) continue
    if (!link.startsWith('http')) continue

    results.push({
      title,
      snippet: snippets[idx] || '',
      link,
      date: 'Recent',
    })
    idx++
  }

  // Fallback Pattern 2: simpler <a href="http..."><h3>
  if (results.length === 0) {
    const simplePattern = /<a\s+href="(https?:\/\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/g
    let si = 0
    while ((match = simplePattern.exec(html)) !== null) {
      const link = match[1]
      const title = cleanText(match[2])
      if (link.includes('google.com')) continue

      results.push({
        title,
        snippet: snippets[si] || '',
        link,
        date: 'Recent',
      })
      si++
    }
  }

  return results
}

// ─── Parsers (match reviews.ts shapes) ───────────────────────────────────────

function parseGlassdoorResult(r: GoogleResult, i: number): RealReviewResult | null {
  if (!r.link.includes('glassdoor')) return null

  let rating: number | undefined
  const ratingMatch = r.snippet.match(/(\d\.?\d?)\s*(?:out of 5|★|stars?|\/5)/i)
  if (ratingMatch) {
    rating = parseFloat(ratingMatch[1])
    if (rating > 5) rating = undefined
  }

  let role: string | undefined
  const roleMatch = r.title.match(/(?:Review|Reviews)\s*[-–—]\s*(.+?)(?:\s*[-–—]|\s*\||$)/i)
  if (roleMatch) role = roleMatch[1].trim()

  return {
    id: `glassdoor-free-${i}`,
    source: 'glassdoor',
    sourceIcon: '🚪',
    title: r.title,
    snippet: r.snippet,
    url: r.link,
    date: r.date || 'Recent',
    rating,
    author: 'Glassdoor Employee',
    role,
  }
}

function parseBlindResult(r: GoogleResult, i: number): RealReviewResult | null {
  if (!r.link.includes('teamblind.com') && !r.link.includes('blind')) return null

  return {
    id: `blind-free-${i}`,
    source: 'blind',
    sourceIcon: '👁️',
    title: r.title,
    snippet: r.snippet,
    url: r.link,
    date: r.date || 'Recent',
    author: 'Anonymous (Blind)',
  }
}

function parseIndeedResult(r: GoogleResult, i: number): RealReviewResult | null {
  if (!r.link.includes('indeed.com') && !r.link.includes('comparably.com')) return null

  let rating: number | undefined
  const ratingMatch = r.snippet.match(/(\d\.?\d?)\s*(?:out of 5|★|stars?|\/5|rating)/i)
  if (ratingMatch) {
    rating = parseFloat(ratingMatch[1])
    if (rating > 5) rating = undefined
  }

  const source = r.link.includes('comparably') ? 'comparably' : 'indeed'

  return {
    id: `${source}-free-${i}`,
    source,
    sourceIcon: source === 'comparably' ? '📊' : '💼',
    title: r.title,
    snippet: r.snippet,
    url: r.link,
    date: r.date || 'Recent',
    rating,
    author: `${source === 'comparably' ? 'Comparably' : 'Indeed'} Employee`,
  }
}

function parseNewsResult(r: GoogleResult, i: number): RealReviewResult | null {
  return {
    id: `news-free-${i}`,
    source: extractDomain(r.link),
    sourceIcon: '📰',
    title: r.title,
    snippet: r.snippet,
    url: r.link,
    date: r.date || 'Recent',
    author: extractDomain(r.link),
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Fetch reviews from Glassdoor, Blind, Indeed, Comparably, and news
 * using FREE Google search (no SerpAPI key needed).
 *
 * Runs 5 staggered searches with ~1s delays to avoid Google blocks.
 */
export async function fetchReviewsFree(companyName: string): Promise<ReviewSearchResults> {
  console.log(`[ReviewsFree] Searching for: ${companyName}`)
  reviewsFreeThrottled = false

  try {
    // Stagger searches to avoid Google blocking
    const glassdoorRaw = await googleSearch(
      `site:glassdoor.com "${companyName}" reviews employee`, 15
    )
    await delay(1200)

    const blindRaw = await googleSearch(
      `site:teamblind.com "${companyName}"`, 10
    )
    await delay(1200)

    const indeedRaw = await googleSearch(
      `site:indeed.com OR site:comparably.com "${companyName}" reviews employee culture salary`, 12
    )
    await delay(1200)

    const newsRaw = await googleSearch(
      `"${companyName}" employee culture workplace layoffs news 2024 2025 2026`, 10
    )

    const glassdoorResults = glassdoorRaw
      .map((r, i) => parseGlassdoorResult(r, i))
      .filter((r): r is RealReviewResult => r !== null)

    const blindResults = blindRaw
      .map((r, i) => parseBlindResult(r, i))
      .filter((r): r is RealReviewResult => r !== null)

    const indeedResults = indeedRaw
      .map((r, i) => parseIndeedResult(r, i))
      .filter((r): r is RealReviewResult => r !== null)

    const newsResults = newsRaw
      .map((r, i) => parseNewsResult(r, i))
      .filter((r): r is RealReviewResult => r !== null)

    console.log(`[ReviewsFree] Found: Glassdoor=${glassdoorResults.length}, Blind=${blindResults.length}, Indeed=${indeedResults.length}, News=${newsResults.length}`)

    return { glassdoorResults, blindResults, indeedResults, newsResults }
  } catch (error) {
    console.error('[ReviewsFree] Error:', error)
    return { glassdoorResults: [], blindResults: [], indeedResults: [], newsResults: [] }
  }
}
