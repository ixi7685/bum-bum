/**
 * Hacker News Algolia API — NO API KEY NEEDED
 * 
 * Endpoint: https://hn.algolia.com/api/v1/search
 * Completely free, no auth, no rate limit worries.
 * Great for tech company discussions, layoff news, culture debates.
 */

export interface HNResult {
  id: string
  source: 'hackernews'
  sourceIcon: string
  title: string
  author: string
  date: string
  points: number
  commentCount: number
  quote: string
  url: string
  hnUrl: string
  tags: string[]
}

/**
 * Search Hacker News via Algolia API
 */
async function searchHN(
  query: string,
  options: {
    tags?: string   // 'story' | 'comment' | 'ask_hn' | 'show_hn'
    numericFilters?: string
    hitsPerPage?: number
  } = {}
): Promise<any[]> {
  const { tags = 'story', hitsPerPage = 15 } = options

  const params = new URLSearchParams({
    query,
    tags,
    hitsPerPage: String(hitsPerPage),
  })

  if (options.numericFilters) {
    params.set('numericFilters', options.numericFilters)
  }

  try {
    const res = await fetch(`https://hn.algolia.com/api/v1/search?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.hits || []
  } catch {
    return []
  }
}

/**
 * Search HN comments (people discussing a company)
 */
async function searchHNComments(
  query: string,
  limit: number = 10
): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      query,
      tags: 'comment',
      hitsPerPage: String(limit),
    })

    const res = await fetch(`https://hn.algolia.com/api/v1/search?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.hits || []
  } catch {
    return []
  }
}

function formatDate(ts: number | string): string {
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

function truncate(text: string, max: number): string {
  if (!text) return ''
  const clean = text
    .replace(/<[^>]*>/g, '')  // strip HTML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (clean.length <= max) return clean
  const cut = clean.substring(0, max)
  const sp = cut.lastIndexOf(' ')
  return cut.substring(0, sp > 0 ? sp : max) + '...'
}

/**
 * Main: Fetch Hacker News stories + comments about a company — ZERO API KEYS
 */
export async function fetchHackerNews(companyName: string): Promise<HNResult[]> {
  try {
    // Search stories and comments in parallel
    const [stories, comments] = await Promise.all([
      searchHN(`"${companyName}"`, { tags: 'story', hitsPerPage: 12 }),
      searchHNComments(`"${companyName}"`, 10),
    ])

    const results: HNResult[] = []
    const seen = new Set<string>()

    // Process stories
    for (const hit of stories) {
      const id = hit.objectID || hit.story_id
      if (!id || seen.has(id)) continue
      seen.add(id)

      results.push({
        id: `hn-${id}`,
        source: 'hackernews',
        sourceIcon: '🟠',
        title: hit.title || 'Untitled',
        author: hit.author || 'Anonymous',
        date: formatDate(hit.created_at_i || hit.created_at || 0),
        points: hit.points || 0,
        commentCount: hit.num_comments || 0,
        quote: hit.title || '',
        url: hit.url || '',
        hnUrl: `https://news.ycombinator.com/item?id=${id}`,
        tags: extractTags(hit.title || '', hit.url || ''),
      })
    }

    // Process top comments (people's opinions)
    for (const hit of comments) {
      const id = hit.objectID
      if (!id || seen.has(id)) continue
      seen.add(id)

      results.push({
        id: `hn-comment-${id}`,
        source: 'hackernews',
        sourceIcon: '🟠',
        title: hit.story_title || 'HN Discussion',
        author: hit.author || 'Anonymous',
        date: formatDate(hit.created_at_i || hit.created_at || 0),
        points: hit.points || 0,
        commentCount: 0,
        quote: truncate(hit.comment_text || '', 350),
        url: '',
        hnUrl: `https://news.ycombinator.com/item?id=${hit.story_id || id}`,
        tags: extractTags(hit.story_title || '', hit.comment_text || ''),
      })
    }

    // Sort by points/engagement
    results.sort((a, b) => b.points - a.points)

    return results.slice(0, 15)
  } catch (error) {
    console.error('[HackerNews] Error:', error)
    return []
  }
}

function extractTags(title: string, text: string): string[] {
  const combined = `${title} ${text}`.toLowerCase()
  const tags: string[] = []
  const keywords: Record<string, string> = {
    'layoff': 'Layoffs', 'laid off': 'Layoffs', 'rif': 'Layoffs',
    'culture': 'Culture', 'toxic': 'Culture',
    'salary': 'Compensation', 'pay': 'Compensation', 'tc': 'Compensation', 'comp': 'Compensation',
    'interview': 'Interview', 'hiring': 'Hiring',
    'remote': 'Remote Work', 'rto': 'Return to Office', 'return to office': 'Return to Office',
    'burnout': 'Burnout', 'work-life': 'Work-Life Balance', 'wlb': 'Work-Life Balance',
    'lawsuit': 'Legal', 'sued': 'Legal',
    'ipo': 'IPO', 'stock': 'Stock/Equity',
    'ceo': 'Leadership', 'management': 'Management',
  }
  for (const [kw, tag] of Object.entries(keywords)) {
    if (combined.includes(kw) && !tags.includes(tag)) tags.push(tag)
  }
  return tags.length > 0 ? tags.slice(0, 4) : ['General']
}
