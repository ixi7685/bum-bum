/**
 * Wikipedia REST API — NO API KEY NEEDED
 * 
 * Endpoint: https://en.wikipedia.org/api/rest_v1/page/summary/{title}
 * Completely free, no auth. Provides company background, history, 
 * controversies, founding info, and key facts.
 */

export interface WikiResult {
  title: string
  extract: string
  description: string | null
  thumbnail: string | null
  url: string
  founded: string | null
  headquarters: string | null
  employeeCount: string | null
  industry: string | null
  keyFacts: string[]
}

/**
 * Get Wikipedia summary for a company
 */
async function getWikiSummary(companyName: string): Promise<any | null> {
  try {
    // Try the company name directly first
    const variants = [
      companyName,
      `${companyName} (company)`,
      `${companyName} Inc.`,
      `${companyName} Corporation`,
    ]

    for (const variant of variants) {
      const encoded = encodeURIComponent(variant.replace(/ /g, '_'))
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
        {
          headers: {
            'User-Agent': 'WhyRisk/1.0 (employment risk intelligence)',
          },
        }
      )

      if (res.ok) {
        const data = await res.json()
        // Only accept real articles, not disambiguation pages
        if (data.type === 'standard' && data.extract) {
          return data
        }
      }
    }

    // Fallback: search Wikipedia
    return await searchWiki(companyName)
  } catch {
    return null
  }
}

/**
 * Search Wikipedia when direct lookup fails
 */
async function searchWiki(query: string): Promise<any | null> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: `${query} company`,
      format: 'json',
      origin: '*',
      srlimit: '3',
    })

    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?${params}`,
      {
        headers: {
          'User-Agent': 'WhyRisk/1.0 (employment research tool)',
        },
      }
    )

    if (!res.ok) return null
    const data = await res.json()
    const results = data.query?.search || []

    if (results.length === 0) return null

    // Get the summary for the first result
    const title = encodeURIComponent(results[0].title.replace(/ /g, '_'))
    const summaryRes = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
      {
        headers: {
          'User-Agent': 'WhyRisk/1.0 (employment research tool)',
        },
      }
    )

    if (!summaryRes.ok) return null
    const summaryData = await summaryRes.json()
    return summaryData.type === 'standard' ? summaryData : null
  } catch {
    return null
  }
}

/**
 * Get full article sections for more detail (infobox extraction)
 */
async function getWikiInfobox(title: string): Promise<Record<string, string>> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, '_'))
    const params = new URLSearchParams({
      action: 'query',
      titles: title,
      prop: 'revisions',
      rvprop: 'content',
      rvsection: '0',
      format: 'json',
      origin: '*',
    })

    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?${params}`,
      {
        headers: {
          'User-Agent': 'WhyRisk/1.0 (employment research tool)',
        },
      }
    )

    if (!res.ok) return {}
    const data = await res.json()
    const pages = data.query?.pages || {}
    const page = Object.values(pages)[0] as any
    const content = page?.revisions?.[0]?.['*'] || ''

    return parseInfobox(content)
  } catch {
    return {}
  }
}

/**
 * Parse key fields from Wikipedia infobox wikitext
 */
function parseInfobox(wikitext: string): Record<string, string> {
  const result: Record<string, string> = {}
  const fields = [
    'founded', 'foundation', 'headquarters', 'hq_location', 'location',
    'num_employees', 'employees', 'industry', 'revenue', 'type',
    'key_people', 'founder', 'ceo', 'area_served',
  ]

  for (const field of fields) {
    const regex = new RegExp(`\\|\\s*${field}\\s*=\\s*(.+?)(?:\\n|\\|)`, 'i')
    const match = wikitext.match(regex)
    if (match) {
      // Clean wikitext markup
      const clean = match[1]
        .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_, a, b) => b || a)
        .replace(/\{\{[^}]+\}\}/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim()
      if (clean) result[field] = clean
    }
  }

  return result
}

/**
 * Main: Fetch Wikipedia data for a company — ZERO API KEYS
 */
export async function fetchWikipedia(companyName: string): Promise<WikiResult | null> {
  try {
    const summary = await getWikiSummary(companyName)
    if (!summary) return null

    // Try to get structured infobox data
    const infobox = await getWikiInfobox(summary.title)

    const keyFacts: string[] = []

    // Founded
    const founded = infobox.founded || infobox.foundation || null
    if (founded) keyFacts.push(`Founded: ${founded}`)

    // HQ
    const hq = infobox.headquarters || infobox.hq_location || infobox.location || null
    if (hq) keyFacts.push(`Headquarters: ${hq}`)

    // Employees
    const employees = infobox.num_employees || infobox.employees || null
    if (employees) keyFacts.push(`Employees: ${employees}`)

    // Industry
    const industry = infobox.industry || null
    if (industry) keyFacts.push(`Industry: ${industry}`)

    // Revenue
    if (infobox.revenue) keyFacts.push(`Revenue: ${infobox.revenue}`)

    // Founder/CEO
    if (infobox.founder) keyFacts.push(`Founder: ${infobox.founder}`)
    if (infobox.ceo) keyFacts.push(`CEO: ${infobox.ceo}`)
    if (infobox.key_people) keyFacts.push(`Key people: ${infobox.key_people}`)

    return {
      title: summary.title,
      extract: summary.extract || '',
      description: summary.description || null,
      thumbnail: summary.thumbnail?.source || null,
      url: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(summary.title)}`,
      founded,
      headquarters: hq,
      employeeCount: employees,
      industry,
      keyFacts,
    }
  } catch (error) {
    console.error('[Wikipedia] Error:', error)
    return null
  }
}
