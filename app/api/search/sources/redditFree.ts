/**
 * Reddit Public JSON API — NO API KEY NEEDED
 * 
 * Reddit exposes .json endpoints for any public page.
 * No auth, no keys, no tokens.
 * Rate limit: ~10 req/min unauthenticated. We stay well under that.
 */

export interface FreeRedditResult {
  id: string
  source: 'reddit'
  sourceIcon: string
  subreddit: string
  author: string
  date: string
  title: string
  quote: string
  context: string
  upvotes: number
  commentCount: number
  permalink: string
  topReplies: {
    author: string
    quote: string
    upvotes: number
  }[]
}

const UA = 'WhyRisk/1.0 (employment risk intelligence)'

/**
 * Search Reddit via public .json endpoint
 */
async function searchRedditFree(
  query: string,
  options: {
    subreddit?: string
    sort?: string
    time?: string
    limit?: number
  } = {}
): Promise<any[]> {
  const { subreddit, sort = 'relevance', time = 'year', limit = 10 } = options

  const base = subreddit
    ? `https://www.reddit.com/r/${subreddit}/search.json`
    : 'https://www.reddit.com/search.json'

  const params = new URLSearchParams({
    q: query,
    sort,
    t: time,
    limit: String(limit),
    restrict_sr: subreddit ? 'true' : 'false',
    type: 'link',
  })

  try {
    const res = await fetch(`${base}?${params}`, {
      headers: { 'User-Agent': UA },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.data?.children || []).map((c: any) => c.data)
  } catch {
    return []
  }
}

/**
 * Get top comments from a post via public .json
 */
async function getCommentsFree(
  permalink: string,
  limit: number = 30
): Promise<FreeRedditResult['topReplies']> {
  try {
    const url = `https://www.reddit.com${permalink}.json?limit=${limit}&sort=top&depth=3`
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!res.ok) return []
    const data = await res.json()
    return (data[1]?.data?.children || [])
      .filter((c: any) => c.kind === 't1' && c.data.body)
      .slice(0, limit)
      .map((c: any) => ({
        author: c.data.author === '[deleted]' ? 'Anonymous' : c.data.author,
        quote: truncate(c.data.body, 600),
        upvotes: c.data.score || 0,
      }))
  } catch {
    return []
  }
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.substring(0, max)
  const sp = cut.lastIndexOf(' ')
  return cut.substring(0, sp > 0 ? sp : max) + '...'
}

function formatDate(utc: number): string {
  return new Date(utc * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Main: Fetch Reddit posts about a company — ZERO API KEYS
 */
export async function fetchRedditFree(companyName: string): Promise<FreeRedditResult[]> {
  const searches = [
    { query: `"${companyName}" work experience`, subreddit: 'cscareerquestions', limit: 15 },
    { query: `"${companyName}"`, subreddit: 'jobs', limit: 10 },
    { query: `"${companyName}" interview OR culture OR salary`, limit: 15 },
    { query: `working at "${companyName}"`, subreddit: 'experienceddevs', limit: 10 },
    { query: `"${companyName}" toxic OR layoff OR fired OR quit`, limit: 10 },
    { query: `"${companyName}" management OR leadership OR review`, subreddit: 'careerguidance', limit: 10 },
    { query: `"${companyName}"`, subreddit: 'recruitinghell', limit: 10 },
    { query: `"${companyName}"`, subreddit: 'antiwork', limit: 10 },
  ]

  try {
    const all: any[] = []
    const seen = new Set<string>()

    for (const s of searches) {
      const posts = await searchRedditFree(s.query, {
        subreddit: s.subreddit,
        sort: 'relevance',
        time: 'all',
        limit: s.limit,
      })
      for (const p of posts) {
        if (p.id && !seen.has(p.id)) {
          seen.add(p.id)
          all.push(p)
        }
      }
      await delay(700)
    }

    all.sort((a, b) => (b.score || 0) - (a.score || 0))

    const results: FreeRedditResult[] = []
    for (const post of all.slice(0, 50)) {
      let topReplies: FreeRedditResult['topReplies'] = []
      if (post.num_comments > 3 && post.score > 5 && post.permalink) {
        topReplies = await getCommentsFree(post.permalink, 30)
        await delay(700)
      }

      results.push({
        id: `reddit-free-${post.id}`,
        source: 'reddit',
        sourceIcon: '🔴',
        subreddit: post.subreddit || '',
        author: post.author === '[deleted]' ? 'Anonymous Redditor' : (post.author || 'Anonymous'),
        date: formatDate(post.created_utc || 0),
        title: post.title || '',
        quote: post.selftext ? truncate(post.selftext, 350) : (post.title || ''),
        context: `r/${post.subreddit || 'unknown'}`,
        upvotes: post.score || 0,
        commentCount: post.num_comments || 0,
        permalink: post.permalink ? `https://reddit.com${post.permalink}` : '',
        topReplies,
      })
    }

    return results
  } catch (error) {
    console.error('[RedditFree] Error:', error)
    return []
  }
}
