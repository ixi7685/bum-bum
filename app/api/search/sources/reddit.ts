/**
 * Reddit API - Real post/comment search for company intelligence
 * Searches r/cscareerquestions, r/jobs, r/experienceddevs, company-specific subreddits
 */

export interface RedditPost {
  id: string
  subreddit: string
  title: string
  selftext: string
  author: string
  score: number
  numComments: number
  createdUtc: number
  permalink: string
  url: string
}

export interface RedditComment {
  id: string
  author: string
  body: string
  score: number
  createdUtc: number
  permalink: string
  replies: RedditComment[]
}

export interface RealRedditResult {
  id: string
  source: 'reddit'
  sourceIcon: string
  subreddit: string
  author: string
  date: string
  title: string
  quote: string
  context: string
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  upvotes: number
  commentCount: number
  permalink: string
  topReplies: {
    author: string
    quote: string
    upvotes: number
  }[]
}

/**
 * Get a Reddit access token using client credentials (app-only auth)
 */
async function getRedditToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID
  const clientSecret = process.env.REDDIT_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.warn('REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET not set')
    return null
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'WhyRisk/1.0',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    console.error('Reddit auth failed:', res.status)
    return null
  }

  const data = await res.json()
  return data.access_token || null
}

/**
 * Search Reddit posts using the search API
 */
async function searchRedditPosts(
  query: string,
  token: string,
  options: {
    subreddit?: string
    sort?: 'relevance' | 'hot' | 'top' | 'new' | 'comments'
    time?: 'all' | 'year' | 'month' | 'week'
    limit?: number
  } = {}
): Promise<RedditPost[]> {
  const {
    subreddit,
    sort = 'relevance',
    time = 'all',
    limit = 10,
  } = options

  const base = subreddit
    ? `https://oauth.reddit.com/r/${subreddit}/search`
    : 'https://oauth.reddit.com/search'

  const params = new URLSearchParams({
    q: query,
    sort,
    t: time,
    limit: String(limit),
    restrict_sr: subreddit ? 'true' : 'false',
    type: 'link',
  })

  const res = await fetch(`${base}?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'WhyRisk/1.0',
    },
  })

  if (!res.ok) {
    console.error('Reddit search error:', res.status)
    return []
  }

  const data = await res.json()
  return (data.data?.children || []).map((child: any) => {
    const d = child.data
    return {
      id: d.id,
      subreddit: d.subreddit,
      title: d.title,
      selftext: d.selftext || '',
      author: d.author || '[deleted]',
      score: d.score || 0,
      numComments: d.num_comments || 0,
      createdUtc: d.created_utc,
      permalink: `https://reddit.com${d.permalink}`,
      url: d.url,
    }
  })
}

/**
 * Get top comments from a post
 */
async function getPostComments(
  permalink: string,
  token: string,
  limit: number = 30
): Promise<RedditComment[]> {
  // Convert full permalink to API URL
  const path = permalink.replace('https://reddit.com', '')
  const url = `https://oauth.reddit.com${path}?limit=${limit}&sort=top&depth=3`

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'WhyRisk/1.0',
    },
  })

  if (!res.ok) return []

  const data = await res.json()
  // Comments are in the second listing
  const commentListing = data[1]?.data?.children || []

  return commentListing
    .filter((c: any) => c.kind === 't1')
    .slice(0, limit)
    .map((c: any) => ({
      id: c.data.id,
      author: c.data.author || '[deleted]',
      body: c.data.body || '',
      score: c.data.score || 0,
      createdUtc: c.data.created_utc,
      permalink: `https://reddit.com${c.data.permalink || ''}`,
      replies: [],
    }))
}

/**
 * Format a Unix timestamp to a readable date
 */
function formatDate(utc: number): string {
  return new Date(utc * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  })
}

/**
 * Truncate text to max length, preserving word boundaries
 */
function truncate(text: string, maxLen: number = 300): string {
  if (text.length <= maxLen) return text
  const truncated = text.substring(0, maxLen)
  const lastSpace = truncated.lastIndexOf(' ')
  return truncated.substring(0, lastSpace > 0 ? lastSpace : maxLen) + '...'
}

/**
 * Main entry: Fetch real Reddit posts about a company
 */
export async function fetchRedditPosts(companyName: string): Promise<RealRedditResult[]> {
  const token = await getRedditToken()
  if (!token) return []

  // Search relevant subreddits
  const searches = [
    { query: `"${companyName}" work experience`, subreddit: 'cscareerquestions', sort: 'relevance' as const, limit: 15 },
    { query: `"${companyName}" review`, subreddit: 'jobs', sort: 'relevance' as const, limit: 10 },
    { query: `"${companyName}" employee`, subreddit: 'experienceddevs', sort: 'relevance' as const, limit: 10 },
    { query: `working at "${companyName}"`, sort: 'relevance' as const, limit: 15 },
    { query: `"${companyName}" interview`, subreddit: 'cscareerquestions', sort: 'relevance' as const, limit: 10 },
    { query: `"${companyName}" culture toxic OR great OR amazing OR terrible`, sort: 'relevance' as const, limit: 10 },
    { query: `"${companyName}" layoff OR fired OR quit OR resign`, sort: 'relevance' as const, limit: 10 },
    { query: `"${companyName}" management OR leadership`, subreddit: 'careerguidance', sort: 'relevance' as const, limit: 10 },
    { query: `"${companyName}"`, subreddit: 'recruitinghell', sort: 'relevance' as const, limit: 10 },
    { query: `"${companyName}"`, subreddit: 'antiwork', sort: 'relevance' as const, limit: 10 },
  ]

  try {
    const allPosts: RedditPost[] = []
    const seenIds = new Set<string>()

    for (const search of searches) {
      const posts = await searchRedditPosts(search.query, token, {
        subreddit: search.subreddit,
        sort: search.sort,
        time: 'all',
        limit: search.limit,
      })

      for (const p of posts) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id)
          allPosts.push(p)
        }
      }

      // Small delay between requests to respect rate limits
      await new Promise(r => setTimeout(r, 200))
    }

    // Sort by score (most upvoted first)
    allPosts.sort((a, b) => b.score - a.score)

    // Get top comments for the best posts
    const topPosts = allPosts.slice(0, 50)
    const results: RealRedditResult[] = []

    for (const post of topPosts) {
      let topReplies: RealRedditResult['topReplies'] = []

      // Only fetch comments for posts with significant engagement
      if (post.numComments > 3 && post.score > 5) {
        const comments = await getPostComments(post.permalink, token, 30)
        topReplies = comments.map(c => ({
          author: c.author === '[deleted]' ? 'Anonymous' : c.author,
          quote: truncate(c.body, 600),
          upvotes: c.score,
        }))
        await new Promise(r => setTimeout(r, 150))
      }

      // Use the post body or title as the quote
      const quote = post.selftext
        ? truncate(post.selftext, 300)
        : post.title

      results.push({
        id: `reddit-${post.id}`,
        source: 'reddit',
        sourceIcon: '🔴',
        subreddit: post.subreddit,
        author: post.author === '[deleted]' ? 'Anonymous Redditor' : post.author,
        date: formatDate(post.createdUtc),
        title: post.title,
        quote,
        context: `r/${post.subreddit} — ${post.title}`,
        sentiment: 'neutral', // Will be enriched by AI
        upvotes: post.score,
        commentCount: post.numComments,
        permalink: post.permalink,
        topReplies,
      })
    }

    return results
  } catch (error) {
    console.error('Reddit fetch error:', error)
    return []
  }
}
