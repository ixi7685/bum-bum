/**
 * Reddit via RapidAPI (Reddit34)
 * 
 * Uses the Reddit34 unofficial API on RapidAPI — no Reddit OAuth needed.
 * Docs: https://rapidapi.com/socialminer/api/reddit34
 * 
 * Available endpoints we use:
 *   GET /getPostsBySubreddit        — Posts from a subreddit (sort: new|hot|top|rising)
 *   GET /getTopPostsBySubreddit     — Top posts from a subreddit (time: hour|day|week|month|year|all)
 *   GET /getPostComments            — Comments on a post (post_url, sort: top|best|new)
 * 
 * Strategy: No global search endpoint exists, so we fetch top/new posts
 * from work-related subreddits and filter for the company name client-side.
 */

import { RealRedditResult } from './reddit'
import { fetchWithRetry } from './httpRetry'

// ─── Config ──────────────────────────────────────────────────────────────────

const RAPIDAPI_HOST = 'reddit34.p.rapidapi.com'
const BASE_URL = `https://${RAPIDAPI_HOST}`
let redditRapidApiThrottled = false

export function wasRedditRapidApiThrottled(): boolean {
  return redditRapidApiThrottled
}

function getHeaders(): Record<string, string> {
  const key = process.env.RAPIDAPI_KEY
  if (!key) throw new Error('RAPIDAPI_KEY not set')
  return {
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key': key,
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface RapidApiPost {
  id: string
  title: string
  selftext?: string
  author: string
  score: number
  num_comments: number
  subreddit: string
  created_utc: number
  permalink: string
  url: string
  [key: string]: unknown
}

interface RapidApiComment {
  id: string
  author: string
  body: string
  score: number
  created_utc: number
  permalink?: string
  [key: string]: unknown
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function truncate(text: string, max = 300): string {
  const clean = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.substring(0, max)
  const sp = cut.lastIndexOf(' ')
  return cut.substring(0, sp > 0 ? sp : max) + '...'
}

function formatDate(utc: number): string {
  if (!utc) return 'Unknown'
  return new Date(utc * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
  })
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * Extract posts from Reddit34 response shape:
 *   { success: true, data: { cursor: "...", posts: [{ data: { ...fields } }] } }
 */
function extractPosts(json: unknown): RapidApiPost[] {
  if (!json || typeof json !== 'object') return []
  const root = json as Record<string, unknown>

  // Standard shape: { success, data: { posts: [{ data: { id, title, ... } }] } }
  if (root.data && typeof root.data === 'object') {
    const d = root.data as Record<string, unknown>

    // { data: { posts: [{ data: { id, title, ... } }] } }
    if (Array.isArray(d.posts)) {
      return d.posts
        .map((p: any) => (p.data ? p.data : p) as RapidApiPost)
        .filter((p: RapidApiPost) => p.id)
    }

    // { data: { children: [{ data: ... }] } } (raw Reddit listing)
    if (Array.isArray(d.children)) {
      return d.children
        .map((c: any) => (c.data ? c.data : c) as RapidApiPost)
        .filter((p: RapidApiPost) => p.id)
    }
  }

  // Fallback: data is an array directly
  if (Array.isArray(root.data)) {
    return (root.data as any[])
      .map((p: any) => (p.data ? p.data : p) as RapidApiPost)
      .filter((p: RapidApiPost) => p.id)
  }

  return []
}

/**
 * Extract comments from Reddit34 getPostComments response shape:
 *   { success: true, data: [ postListing, { data: { children: [{ kind: "t1", data: { body, ... } }] } } ] }
 */
function extractComments(json: unknown): RapidApiComment[] {
  if (!json || typeof json !== 'object') return []
  const root = json as Record<string, unknown>
  const data = root.data

  if (Array.isArray(data) && data.length >= 2) {
    // data[1] is the comments listing
    const commentListing = data[1] as Record<string, unknown>
    if (commentListing?.data && typeof commentListing.data === 'object') {
      const children = (commentListing.data as Record<string, unknown>).children
      if (Array.isArray(children)) {
        return children
          .filter((c: any) => c.kind === 't1' && c.data?.body && c.data.body !== '[removed]' && c.data.body !== '[deleted]')
          .map((c: any) => c.data as RapidApiComment)
      }
    }
  }

  return []
}

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * Fetch posts from a subreddit via /getPostsBySubreddit.
 * Params: subreddit (required), sort (new|hot|top|rising)
 */
async function fetchSubredditPosts(
  subreddit: string,
  sort: string = 'new',
): Promise<RapidApiPost[]> {
  const params = new URLSearchParams({ subreddit, sort })
  try {
    const { response: res, throttled } = await fetchWithRetry(`${BASE_URL}/getPostsBySubreddit?${params}`, {
      headers: getHeaders(),
    }, {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
    })

    if (throttled || res.status === 429) {
      redditRapidApiThrottled = true
    }

    if (!res.ok) {
      console.warn(`[RedditRapidAPI] getPostsBySubreddit(${subreddit}) ${res.status}`)
      return []
    }
    return extractPosts(await res.json())
  } catch (e) {
    console.error(`[RedditRapidAPI] getPostsBySubreddit(${subreddit}) error:`, e)
    return []
  }
}

/**
 * Fetch top posts from a subreddit via /getTopPostsBySubreddit.
 * Params: subreddit (required), time (hour|day|week|month|year|all)
 */
async function fetchTopSubredditPosts(
  subreddit: string,
  time: string = 'year',
): Promise<RapidApiPost[]> {
  const params = new URLSearchParams({ subreddit, time })
  try {
    const { response: res, throttled } = await fetchWithRetry(`${BASE_URL}/getTopPostsBySubreddit?${params}`, {
      headers: getHeaders(),
    }, {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
    })

    if (throttled || res.status === 429) {
      redditRapidApiThrottled = true
    }

    if (!res.ok) {
      console.warn(`[RedditRapidAPI] getTopPostsBySubreddit(${subreddit}) ${res.status}`)
      return []
    }
    return extractPosts(await res.json())
  } catch (e) {
    console.error(`[RedditRapidAPI] getTopPostsBySubreddit(${subreddit}) error:`, e)
    return []
  }
}

/**
 * Fetch comments for a post via /getPostComments.
 * Params: post_url (required — full Reddit URL), sort (top|best|new)
 */
async function fetchPostComments(
  permalink: string,
  sort: string = 'top',
): Promise<RapidApiComment[]> {
  // Build full URL from permalink
  const postUrl = permalink.startsWith('http')
    ? permalink
    : `https://www.reddit.com${permalink}`

  const params = new URLSearchParams({ post_url: postUrl, sort })
  try {
    const { response: res, throttled } = await fetchWithRetry(`${BASE_URL}/getPostComments?${params}`, {
      headers: getHeaders(),
    }, {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10000,
    })

    if (throttled || res.status === 429) {
      redditRapidApiThrottled = true
    }

    if (!res.ok) {
      console.warn(`[RedditRapidAPI] getPostComments ${res.status}`)
      return []
    }
    return extractComments(await res.json())
  } catch (e) {
    console.error('[RedditRapidAPI] getPostComments error:', e)
    return []
  }
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Work-related subreddits to scan for company mentions.
 */
const WORK_SUBREDDITS = [
  'cscareerquestions',
  'jobs',
  'experienceddevs',
  'antiwork',
  'workreform',
  'careerguidance',
  'recruitinghell',
  'overemployed',
  'sysadmin',
  'webdev',
  'programming',
  'technology',
]

/**
 * Fetch Reddit posts about a company using the Reddit34 RapidAPI.
 * 
 * Strategy (no global search endpoint available):
 *   1. Fetch new + top posts from work-related subreddits via RapidAPI
 *   2. Filter posts that mention the company name in title or body
 *   3. Also check r/{companyname} as a dedicated subreddit
 *   4. Fetch top comments for high-engagement matches
 * 
 * Returns data in the same RealRedditResult shape used by the rest of the app.
 */
export async function fetchRedditRapidApi(companyName: string): Promise<RealRedditResult[]> {
  redditRapidApiThrottled = false
  const apiKey = process.env.RAPIDAPI_KEY
  if (!apiKey) {
    console.warn('[RedditRapidAPI] RAPIDAPI_KEY not set — skipping')
    return []
  }

  console.log(`[RedditRapidAPI] Searching for "${companyName}" across ${WORK_SUBREDDITS.length} subreddits`)

  const companyLower = companyName.toLowerCase()
  // Build alternative match patterns (e.g. "Goldman Sachs" → "goldman" + "sachs")
  const companyWords = companyLower.split(/\s+/).filter(w => w.length > 2)

  function mentionsCompany(text: string): boolean {
    const lower = text.toLowerCase()
    // Exact match of the full name
    if (lower.includes(companyLower)) return true
    // All significant words appear
    if (companyWords.length > 1 && companyWords.every(w => lower.includes(w))) return true
    return false
  }

  // ── Step 1: Fetch from subreddits in parallel batches ──────────────────
  // Batch into groups of 4 to respect rate limits.
  const batchSize = 4
  const seenIds = new Set<string>()
  const allMatches: RapidApiPost[] = []

  for (let i = 0; i < WORK_SUBREDDITS.length; i += batchSize) {
    const batch = WORK_SUBREDDITS.slice(i, i + batchSize)
    const fetches = batch.flatMap(sub => [
      fetchSubredditPosts(sub, 'new'),
      fetchTopSubredditPosts(sub, 'year'),
    ])

    const results = await Promise.allSettled(fetches)

    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      for (const post of r.value) {
        if (!post.id || seenIds.has(post.id)) continue
        const text = `${post.title || ''} ${post.selftext || ''}`
        if (mentionsCompany(text)) {
          seenIds.add(post.id)
          allMatches.push(post)
        }
      }
    }

    // Rate limit pause between batches
    if (i + batchSize < WORK_SUBREDDITS.length) {
      await delay(300)
    }
  }

  // ── Step 1b: Also try company-specific subreddit (r/google, r/amazon, etc.) ──
  const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!WORK_SUBREDDITS.includes(companySlug)) {
    try {
      const [newPosts, topPosts] = await Promise.allSettled([
        fetchSubredditPosts(companySlug, 'new'),
        fetchTopSubredditPosts(companySlug, 'year'),
      ])

      for (const r of [newPosts, topPosts]) {
        if (r.status !== 'fulfilled') continue
        for (const post of r.value) {
          if (post.id && !seenIds.has(post.id)) {
            seenIds.add(post.id)
            allMatches.push(post)
          }
        }
      }
    } catch {
      // Subreddit may not exist — that's fine
    }
  }

  // Sort by score (highest engagement first)
  allMatches.sort((a, b) => (b.score || 0) - (a.score || 0))

  console.log(`[RedditRapidAPI] Found ${allMatches.length} posts mentioning "${companyName}"`)

  // ── Step 2: Fetch comments for top posts ───────────────────────────────
  const topPosts = allMatches.slice(0, 50)
  const output: RealRedditResult[] = []

  for (const post of topPosts) {
    let topReplies: RealRedditResult['topReplies'] = []

    // Fetch comments for posts with significant engagement
    if ((post.num_comments || 0) > 3 && (post.score || 0) > 5 && post.permalink) {
      try {
        const comments = await fetchPostComments(post.permalink, 'top')
        topReplies = comments
          .filter(c => c.body && c.author !== 'AutoModerator')
          .slice(0, 30)
          .map(c => ({
            author: c.author === '[deleted]' ? 'Anonymous' : (c.author || 'Anonymous'),
            quote: truncate(c.body, 600),
            upvotes: c.score || 0,
          }))
        await delay(200)
      } catch {
        // Comments are bonus — don't fail the whole pipeline
      }
    }

    const quote = post.selftext
      ? truncate(post.selftext, 300)
      : (post.title || '')

    const permalink = post.permalink
      ? (post.permalink.startsWith('http') ? post.permalink : `https://reddit.com${post.permalink}`)
      : ''

    output.push({
      id: `reddit-rapid-${post.id}`,
      source: 'reddit',
      sourceIcon: '🔴',
      subreddit: post.subreddit || '',
      author: post.author === '[deleted]' ? 'Anonymous Redditor' : (post.author || 'Anonymous'),
      date: formatDate(post.created_utc),
      title: post.title || '',
      quote,
      context: `r/${post.subreddit || 'unknown'} — ${post.title || ''}`,
      sentiment: 'neutral', // Will be enriched by AI
      upvotes: post.score || 0,
      commentCount: post.num_comments || 0,
      permalink,
      topReplies,
    })
  }

  console.log(`[RedditRapidAPI] Returning ${output.length} results with comments`)
  return output
}
