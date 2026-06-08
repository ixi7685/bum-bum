/**
 * L6 — External Consequences: Layoff Tracker + Company Registry signals
 * 
 * Sources:
 *   - layoffs/news/funding/legal via Serper
 *   - SEC EDGAR for US public companies (free API)
 * 
 * Provides hard evidence: layoff events, funding rounds, leadership changes.
 */

export interface LayoffEvent {
  id: string
  company: string
  date: string
  headcount: number | null    // number of people laid off
  percentage: string | null   // "10%" of workforce
  source: string
  sourceUrl: string
  context: string             // brief description of the event
}

export interface CompanyFiling {
  id: string
  type: string                // '10-K' | '10-Q' | '8-K' | etc
  title: string
  date: string
  url: string
  summary: string
}

export interface ExternalConsequencesResult {
  layoffs: LayoffEvent[]
  filings: CompanyFiling[]
  fundingEvents: { date: string; round: string; amount: string; source: string }[]
  leadershipChanges: { name: string; role: string; event: string; date: string; source: string }[]
  lawsuits: { title: string; date: string; snippet: string; url: string }[]
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

async function serperSearch(
  query: string,
  apiKey: string,
  endpoint: 'search' | 'news' = 'search',
  num: number = 10
): Promise<SerperOrganicResult[]> {
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
      body: JSON.stringify({ q: query, num, gl: 'us', hl: 'en' }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []

    const data = await res.json() as SerperResponse
    return endpoint === 'news' ? (data.news || []) : (data.organic || [])
  } catch {
    return []
  }
}

/**
 * Search for layoff events.
 */
async function searchLayoffs(companyName: string, apiKey: string): Promise<LayoffEvent[]> {
  const rows = await serperSearch(`"${companyName}" layoffs OR restructuring OR workforce reduction`, apiKey, 'news', 8)
  return rows.map((r, i) => ({
    id: `layoff-${i}`,
    company: companyName,
    date: r.date || 'Recent',
    headcount: null,
    percentage: null,
    source: r.source || extractDomain(r.link || ''),
    sourceUrl: r.link || '',
    context: cleanText(r.snippet || r.title || ''),
  })).filter(r => r.sourceUrl)
}

/**
 * Search for leadership changes.
 */
async function searchLeadershipChanges(
  companyName: string,
  apiKey: string
): Promise<ExternalConsequencesResult['leadershipChanges']> {
  const rows = await serperSearch(`"${companyName}" CEO OR CFO OR leadership change OR resigned`, apiKey, 'news', 8)
  return rows.map((r) => ({
    name: 'Unknown',
    role: 'Leadership',
    event: cleanText(r.title || r.snippet || 'Leadership change reported'),
    date: r.date || 'Recent',
    source: r.link || '',
  })).filter(r => r.source)
}

/**
 * Search for lawsuits / legal issues.
 */
async function searchLawsuits(
  companyName: string,
  apiKey: string
): Promise<ExternalConsequencesResult['lawsuits']> {
  const rows = await serperSearch(`"${companyName}" lawsuit OR legal complaint OR settlement`, apiKey, 'news', 8)
  return rows.map((r) => ({
    title: cleanText(r.title || 'Legal event'),
    date: r.date || 'Recent',
    snippet: cleanText(r.snippet || ''),
    url: r.link || '',
  })).filter(r => r.url)
}

/**
 * Search for funding events.
 */
async function searchFunding(
  companyName: string,
  apiKey: string
): Promise<ExternalConsequencesResult['fundingEvents']> {
  const rows = await serperSearch(`"${companyName}" funding OR raised OR valuation OR investment`, apiKey, 'news', 8)
  return rows.map((r) => ({
    date: r.date || 'Recent',
    round: 'Reported Event',
    amount: 'Undisclosed',
    source: r.link || '',
  })).filter(r => r.source)
}

/**
 * Fetch SEC EDGAR filings for US public companies (free, no key)
 */
async function fetchSECFilings(companyName: string): Promise<CompanyFiling[]> {
  try {
    // Search EDGAR full-text search API
    const params = new URLSearchParams({
      q: companyName,
      dateRange: 'custom',
      startdt: '2023-01-01',
      enddt: new Date().toISOString().split('T')[0],
      forms: '10-K,10-Q,8-K',
    })

    const res = await fetch(
      `https://efts.sec.gov/LATEST/search-index?${params}`,
      {
        headers: {
          'User-Agent': 'WhyRisk/1.0 research@whyrisk.app',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(8000),
      }
    )

    if (!res.ok) return []
    const data = await res.json()
    const hits = data.hits?.hits || []

    return hits.slice(0, 5).map((h: any, i: number) => ({
      id: `sec-${i}`,
      type: h._source?.forms || 'Filing',
      title: h._source?.entity_name || companyName,
      date: h._source?.file_date || 'Recent',
      url: h._source?.file_url || `https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(companyName)}&CIK=&type=&dateb=&owner=include&count=10&search_text=&action=getcompany`,
      summary: h._source?.display_names?.join(', ') || 'SEC Filing',
    }))
  } catch {
    return []
  }
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') }
  catch { return 'Unknown' }
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/[""]/g, '"').replace(/['']/g, "'").trim()
}

/**
 * Main: Fetch all L6 external consequence data
 */
export async function fetchExternalConsequences(
  companyName: string
): Promise<ExternalConsequencesResult> {
  const empty: ExternalConsequencesResult = {
    layoffs: [],
    filings: [],
    fundingEvents: [],
    leadershipChanges: [],
    lawsuits: [],
  }

  const apiKey = process.env.SERPER_API_KEY

  try {
    // SEC filings don't need an API key — always run
    const filingsPromise = fetchSECFilings(companyName)

    if (!apiKey) {
      console.warn('[ExternalConsequences] SERPER_API_KEY not set, skipping layoff/leadership search')
      empty.filings = await filingsPromise
      return empty
    }

    // Run all SerpAPI searches in parallel
    const [layoffs, leadershipChanges, lawsuits, fundingEvents, filings] = await Promise.all([
      searchLayoffs(companyName, apiKey),
      searchLeadershipChanges(companyName, apiKey),
      searchLawsuits(companyName, apiKey),
      searchFunding(companyName, apiKey),
      filingsPromise,
    ])

    return { layoffs, filings, fundingEvents, leadershipChanges, lawsuits }
  } catch (error) {
    console.error('[ExternalConsequences] Error:', error)
    return empty
  }
}
