/**
 * Glassdoor / Company Review Search via Serper
 * Since Glassdoor has no public API, we use Serper Google endpoints
 * for discovery and parse snippets from returned result objects.
 */

export interface RealReviewResult {
  id: string
  source: string      // 'glassdoor' | 'blind' | 'indeed' | 'comparably'
  sourceIcon: string
  title: string
  snippet: string
  url: string
  date: string
  rating?: number
  author: string
  role?: string
  location?: string
  prosAndCons?: { pros: string[]; cons: string[] }
}

export interface ReviewSearchResults {
  glassdoorResults: RealReviewResult[]
  blindResults: RealReviewResult[]
  indeedResults: RealReviewResult[]
  newsResults: RealReviewResult[]
}

interface SerperOrganicResult {
  title?: string
  link?: string
  snippet?: string
  date?: string
  source?: string
}

interface SerperResponse {
  organic?: SerperOrganicResult[]
  news?: SerperOrganicResult[]
}

/**
 * Search via Serper discovery API.
 */
async function serpSearch(
  query: string,
  apiKey: string,
  num: number = 10,
  endpoint: 'search' | 'news' = 'search'
): Promise<any[]> {
  const url = endpoint === 'news'
    ? 'https://google.serper.dev/news'
    : 'https://google.serper.dev/search'

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        q: query,
        num,
        gl: 'us',
        hl: 'en',
      }),
      signal: AbortSignal.timeout(12000),
    })

    if (!res.ok) {
      console.warn(`[Reviews] Serper ${endpoint} returned ${res.status}`)
      return []
    }

    const data = await res.json() as SerperResponse
    if (endpoint === 'news') return data.news || []
    return data.organic || []
  } catch (error) {
    console.error('[Reviews] Serper search error:', error)
    return []
  }
}

/**
 * Parse Glassdoor-style review snippets from search results
 */
function parseGlassdoorResult(result: any, index: number): RealReviewResult | null {
  const title = result.title || ''
  const snippet = result.snippet || ''
  const link = result.link || ''
  const date = result.date || ''

  // Skip non-review pages
  if (!link.includes('glassdoor') && !title.toLowerCase().includes('review')) {
    return null
  }

  // Try to extract rating from snippet
  let rating: number | undefined
  const ratingMatch = snippet.match(/(\d\.?\d?)\s*(?:out of 5|★|stars?|\/5)/i)
  if (ratingMatch) {
    rating = parseFloat(ratingMatch[1])
    if (rating > 5) rating = undefined
  }

  // Try to extract role from title
  let role: string | undefined
  const roleMatch = title.match(/(?:Review|Reviews)\s*[-–—]\s*(.+?)(?:\s*[-–—]|\s*\||$)/i)
  if (roleMatch) role = roleMatch[1].trim()

  return {
    id: `glassdoor-${index}`,
    source: 'glassdoor',
    sourceIcon: '🚪',
    title: cleanText(title),
    snippet: cleanText(snippet),
    url: link,
    date: date || 'Recent',
    rating,
    author: 'Glassdoor Employee',
    role,
  }
}

/**
 * Parse Blind results
 */
function parseBlindResult(result: any, index: number): RealReviewResult | null {
  const title = result.title || ''
  const snippet = result.snippet || ''
  const link = result.link || ''

  if (!link.includes('teamblind.com') && !link.includes('blind')) {
    return null
  }

  return {
    id: `blind-${index}`,
    source: 'blind',
    sourceIcon: '👁️',
    title: cleanText(title),
    snippet: cleanText(snippet),
    url: link,
    date: result.date || 'Recent',
    author: 'Anonymous (Blind)',
  }
}

/**
 * Parse news article results
 */
function parseNewsResult(result: any, index: number): RealReviewResult | null {
  const title = result.title || ''
  const snippet = result.snippet || ''
  const link = result.link || ''
  const source = result.source || ''

  return {
    id: `news-${index}`,
    source: source || extractDomain(link),
    sourceIcon: '📰',
    title: cleanText(title),
    snippet: cleanText(snippet),
    url: link,
    date: result.date || 'Recent',
    author: source || 'News Source',
  }
}

/**
 * Parse Indeed review snippets from search results
 */
function parseIndeedResult(result: any, index: number): RealReviewResult | null {
  const title = result.title || ''
  const snippet = result.snippet || ''
  const link = result.link || ''

  if (!link.includes('indeed.com') && !title.toLowerCase().includes('indeed')) {
    return null
  }

  let rating: number | undefined
  const ratingMatch = snippet.match(/(\d\.?\d?)\s*(?:out of 5|★|stars?|\/5)/i)
  if (ratingMatch) {
    rating = parseFloat(ratingMatch[1])
    if (rating > 5) rating = undefined
  }

  let role: string | undefined
  const roleMatch = title.match(/(?:Review|Reviews)\s*[-–—]\s*(.+?)(?:\s*[-–—]|\s*\||$)/i)
  if (roleMatch) role = roleMatch[1].trim()

  return {
    id: `indeed-${index}`,
    source: 'indeed',
    sourceIcon: '💼',
    title: cleanText(title),
    snippet: cleanText(snippet),
    url: link,
    date: result.date || 'Recent',
    rating,
    author: 'Indeed Employee',
    role,
  }
}

/**
 * Parse Comparably review snippets from search results
 */
function parseComparablyResult(result: any, index: number): RealReviewResult | null {
  const title = result.title || ''
  const snippet = result.snippet || ''
  const link = result.link || ''

  if (!link.includes('comparably.com') && !title.toLowerCase().includes('comparably')) {
    return null
  }

  let rating: number | undefined
  const ratingMatch = snippet.match(/(\d\.?\d?)\s*(?:out of 5|\/5|rating)/i)
  if (ratingMatch) {
    rating = parseFloat(ratingMatch[1])
    if (rating > 5) rating = undefined
  }

  return {
    id: `comparably-${index}`,
    source: 'comparably',
    sourceIcon: '📊',
    title: cleanText(title),
    snippet: cleanText(snippet),
    url: link,
    date: result.date || 'Recent',
    rating,
    author: 'Comparably User',
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return 'Unknown'
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim()
}

/**
 * Main entry: Fetch real reviews from Glassdoor, Blind, Indeed, Comparably, and news
 */
export async function fetchReviews(companyName: string): Promise<ReviewSearchResults> {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    console.warn('SERPER_API_KEY not set, skipping review search')
    return { glassdoorResults: [], blindResults: [], indeedResults: [], newsResults: [] }
  }

  try {
    // Run searches in parallel
    const [glassdoorRaw, blindRaw, indeedRaw, comparablyRaw, newsRaw] = await Promise.all([
      serpSearch(`site:glassdoor.com "${companyName}" reviews employee`, apiKey, 10),
      serpSearch(`site:teamblind.com "${companyName}"`, apiKey, 8),
      serpSearch(`site:indeed.com "${companyName}" reviews employee`, apiKey, 8),
      serpSearch(`site:comparably.com "${companyName}" reviews culture salary`, apiKey, 5),
      serpSearch(`"${companyName}" layoffs lawsuits leadership funding`, apiKey, 8, 'news'),
    ])

    const glassdoorResults = glassdoorRaw
      .map((r, i) => parseGlassdoorResult(r, i))
      .filter((r): r is RealReviewResult => r !== null)

    const blindResults = blindRaw
      .map((r, i) => parseBlindResult(r, i))
      .filter((r): r is RealReviewResult => r !== null)

    const indeedResults = indeedRaw
      .map((r, i) => parseIndeedResult(r, i))
      .filter((r): r is RealReviewResult => r !== null)

    // Merge Comparably into Indeed bucket (both are L3 review platforms)
    const comparablyResults = comparablyRaw
      .map((r, i) => parseComparablyResult(r, i))
      .filter((r): r is RealReviewResult => r !== null)

    const newsResults = newsRaw
      .map((r, i) => parseNewsResult(r, i))
      .filter((r): r is RealReviewResult => r !== null)

    return {
      glassdoorResults,
      blindResults,
      indeedResults: [...indeedResults, ...comparablyResults],
      newsResults,
    }
  } catch (error) {
    console.error('Review search error:', error)
    return { glassdoorResults: [], blindResults: [], indeedResults: [], newsResults: [] }
  }
}
