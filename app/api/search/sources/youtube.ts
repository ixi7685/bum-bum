/**
 * YouTube Data API v3 - Real video search for company intelligence
 * Searches for ex-employee stories, interview experiences, day-in-life content
 */

interface YouTubeSearchResult {
  videoId: string
  title: string
  channelTitle: string
  description: string
  publishedAt: string
  thumbnailUrl: string
}

interface YouTubeVideoDetails {
  videoId: string
  title: string
  channelTitle: string
  description: string
  publishedAt: string
  thumbnailUrl: string
  viewCount: string
  likeCount: string
  commentCount: string
  duration: string
}

export interface RealYouTubeVideo {
  id: string
  youtubeId: string
  title: string
  channel: string
  channelType: 'ex-employee' | 'current-employee' | 'interviewer' | 'career-coach' | 'news' | 'review'
  publishDate: string
  viewCount: string
  duration: string
  description: string
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  credibilityScore: 'high' | 'medium' | 'low'
  topics: string[]
  thumbnailUrl: string
}

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3'

/**
 * Search YouTube for videos about a company
 */
async function searchVideos(
  query: string,
  apiKey: string,
  maxResults: number = 10
): Promise<YouTubeSearchResult[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    maxResults: String(maxResults),
    order: 'relevance',
    relevanceLanguage: 'en',
    key: apiKey,
  })

  const res = await fetch(`${YOUTUBE_API_BASE}/search?${params}`)
  if (!res.ok) {
    console.error('YouTube search API error:', res.status, await res.text())
    return []
  }

  const data = await res.json()
  return (data.items || []).map((item: any) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    description: item.snippet.description,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
  }))
}

/**
 * Get detailed video stats (views, likes, duration)
 */
async function getVideoDetails(
  videoIds: string[],
  apiKey: string
): Promise<Map<string, Partial<YouTubeVideoDetails>>> {
  if (videoIds.length === 0) return new Map()

  const params = new URLSearchParams({
    part: 'statistics,contentDetails',
    id: videoIds.join(','),
    key: apiKey,
  })

  const res = await fetch(`${YOUTUBE_API_BASE}/videos?${params}`)
  if (!res.ok) {
    console.error('YouTube videos API error:', res.status)
    return new Map()
  }

  const data = await res.json()
  const map = new Map<string, Partial<YouTubeVideoDetails>>()

  for (const item of data.items || []) {
    map.set(item.id, {
      viewCount: item.statistics?.viewCount || '0',
      likeCount: item.statistics?.likeCount || '0',
      commentCount: item.statistics?.commentCount || '0',
      duration: parseDuration(item.contentDetails?.duration || ''),
    })
  }

  return map
}

/**
 * Parse ISO 8601 duration (PT1H2M3S) to human-readable (1:02:03)
 */
function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return '0:00'

  const hours = parseInt(match[1] || '0')
  const minutes = parseInt(match[2] || '0')
  const seconds = parseInt(match[3] || '0')

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * Format view count to human-readable (e.g., 1.2M, 450K)
 */
function formatViewCount(count: string): string {
  const num = parseInt(count)
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`
  return String(num)
}

/**
 * Detect channel type from title and description
 */
function detectChannelType(
  title: string,
  description: string
): RealYouTubeVideo['channelType'] {
  const text = `${title} ${description}`.toLowerCase()
  if (text.includes('why i left') || text.includes('i quit') || text.includes('ex-') || text.includes('former')) {
    return 'ex-employee'
  }
  if (text.includes('day in') || text.includes('day at') || text.includes('work at') || text.includes('what it\'s like')) {
    return 'current-employee'
  }
  if (text.includes('interview') || text.includes('hiring') || text.includes('got the offer') || text.includes('rejected')) {
    return 'interviewer'
  }
  if (text.includes('news') || text.includes('layoff') || text.includes('report') || text.includes('analysis')) {
    return 'news'
  }
  if (text.includes('review') || text.includes('should you') || text.includes('worth it')) {
    return 'review'
  }
  return 'career-coach'
}

/**
 * Extract topics from title and description
 */
function extractTopics(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase()
  const topics: string[] = []

  const topicKeywords: Record<string, string> = {
    'salary': 'Compensation',
    'pay': 'Compensation',
    'compensation': 'Compensation',
    'tc': 'Total Comp',
    'interview': 'Interview Process',
    'hiring': 'Hiring',
    'culture': 'Company Culture',
    'work-life': 'Work-Life Balance',
    'wlb': 'Work-Life Balance',
    'burnout': 'Burnout',
    'layoff': 'Layoffs',
    'fired': 'Layoffs',
    'remote': 'Remote Work',
    'rto': 'Return to Office',
    'return to office': 'Return to Office',
    'promotion': 'Career Growth',
    'growth': 'Career Growth',
    'management': 'Management',
    'manager': 'Management',
    'toxic': 'Toxic Culture',
    'benefits': 'Benefits',
    'stock': 'Stock/Equity',
    'equity': 'Stock/Equity',
    'rsu': 'Stock/Equity',
    'pip': 'Performance Management',
    'review': 'Performance Reviews',
    'onboarding': 'Onboarding',
    'intern': 'Internship',
  }

  for (const [keyword, topic] of Object.entries(topicKeywords)) {
    if (text.includes(keyword) && !topics.includes(topic)) {
      topics.push(topic)
    }
  }

  return topics.length > 0 ? topics.slice(0, 5) : ['General']
}

/**
 * Main entry: Fetch real YouTube videos about a company
 */
export async function fetchYouTubeVideos(companyName: string): Promise<RealYouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    console.warn('YOUTUBE_API_KEY not set, skipping YouTube data')
    return []
  }

  // Run multiple search queries for broader coverage
  const queries = [
    `"${companyName}" employee experience review`,
    `"${companyName}" interview process`,
    `why I left "${companyName}"`,
    `day in the life "${companyName}"`,
  ]

  try {
    const allResults: YouTubeSearchResult[] = []
    const seenIds = new Set<string>()

    // Run searches sequentially to respect rate limits
    for (const query of queries) {
      const results = await searchVideos(query, apiKey, 5)
      for (const r of results) {
        if (!seenIds.has(r.videoId)) {
          seenIds.add(r.videoId)
          allResults.push(r)
        }
      }
    }

    if (allResults.length === 0) return []

    // Get video details (views, duration)
    const videoIds = allResults.map(r => r.videoId)
    const details = await getVideoDetails(videoIds, apiKey)

    // Build final results
    const videos: RealYouTubeVideo[] = allResults.map((r, i) => {
      const d = details.get(r.videoId)
      return {
        id: `yt-${i}`,
        youtubeId: r.videoId,
        title: decodeHtmlEntities(r.title),
        channel: decodeHtmlEntities(r.channelTitle),
        channelType: detectChannelType(r.title, r.description),
        publishDate: new Date(r.publishedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
        }),
        viewCount: formatViewCount(d?.viewCount || '0'),
        duration: d?.duration || '0:00',
        description: r.description,
        sentiment: 'neutral', // Will be enriched by AI
        credibilityScore: 'medium',
        topics: extractTopics(r.title, r.description),
        thumbnailUrl: r.thumbnailUrl,
      }
    })

    return videos.slice(0, 12)
  } catch (error) {
    console.error('YouTube fetch error:', error)
    return []
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

// =============================================================================
// YouTube Comments — L5 Client/User Fallout signal
// Uses the same YOUTUBE_API_KEY (commentThreads endpoint)
// =============================================================================

export interface YouTubeComment {
  id: string
  videoId: string
  videoTitle: string
  author: string
  text: string
  likeCount: number
  publishedAt: string
  replyCount: number
  topReplies: { author: string; text: string; likeCount: number }[]
}

/**
 * Fetch top-level comment threads for a single video
 */
async function fetchVideoComments(
  videoId: string,
  apiKey: string,
  maxResults: number = 20
): Promise<any[]> {
  const params = new URLSearchParams({
    part: 'snippet,replies',
    videoId,
    maxResults: String(maxResults),
    order: 'relevance',
    textFormat: 'plainText',
    key: apiKey,
  })

  try {
    const res = await fetch(`${YOUTUBE_API_BASE}/commentThreads?${params}`)
    if (!res.ok) {
      // Comments might be disabled
      if (res.status === 403) return []
      console.error('YouTube commentThreads error:', res.status)
      return []
    }
    const data = await res.json()
    return data.items || []
  } catch {
    return []
  }
}

/**
 * Main entry: Fetch YouTube comments about a company across its top videos.
 * Re-uses the same YOUTUBE_API_KEY — no additional credentials needed.
 */
export async function fetchYouTubeComments(
  companyName: string,
  videoIds?: string[]
): Promise<YouTubeComment[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return []

  // If no videoIds supplied, search for relevant videos first
  let ids = videoIds || []
  if (ids.length === 0) {
    const searchResults = await searchVideos(
      `"${companyName}" review OR experience OR interview`,
      apiKey,
      5
    )
    ids = searchResults.map(r => r.videoId)
  }

  if (ids.length === 0) return []

  const comments: YouTubeComment[] = []
  const seen = new Set<string>()

  // Fetch comments from up to 5 videos (quota-friendly)
  for (const vid of ids.slice(0, 5)) {
    const threads = await fetchVideoComments(vid, apiKey, 15)

    for (const thread of threads) {
      const top = thread.snippet?.topLevelComment?.snippet
      if (!top?.textDisplay) continue

      const id = thread.snippet?.topLevelComment?.id || `ytc-${Date.now()}`
      if (seen.has(id)) continue
      seen.add(id)

      // Only keep comments that mention the company (context gating)
      const text = top.textDisplay as string
      const mentionsCompany =
        text.toLowerCase().includes(companyName.toLowerCase()) ||
        text.length > 80 // Long comments on company videos are usually relevant

      if (!mentionsCompany) continue

      const topReplies: YouTubeComment['topReplies'] = []
      if (thread.replies?.comments) {
        for (const reply of thread.replies.comments.slice(0, 3)) {
          const rs = reply.snippet
          if (rs?.textDisplay) {
            topReplies.push({
              author: rs.authorDisplayName || 'Anonymous',
              text: truncateText(rs.textDisplay, 300),
              likeCount: rs.likeCount || 0,
            })
          }
        }
      }

      comments.push({
        id,
        videoId: vid,
        videoTitle: '', // Will be enriched later
        author: top.authorDisplayName || 'Anonymous',
        text: truncateText(text, 500),
        likeCount: top.likeCount || 0,
        publishedAt: top.publishedAt || '',
        replyCount: thread.snippet?.totalReplyCount || 0,
        topReplies,
      })
    }
  }

  // Sort by engagement
  comments.sort((a, b) => b.likeCount - a.likeCount)
  return comments.slice(0, 30)
}

function truncateText(text: string, max: number): string {
  const clean = text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.substring(0, max)
  const sp = cut.lastIndexOf(' ')
  return cut.substring(0, sp > 0 ? sp : max) + '...'
}
