/**
 * L5 — Client / User Fallout: Trustpilot Reviews
 * 
 * Scrapes Trustpilot company page for consumer reviews.
 * Predicts how a company treats employees by how it treats customers.
 * NO API KEY NEEDED — uses public Trustpilot pages.
 */

export interface TrustpilotResult {
  companySlug: string | null
  overallRating: number | null
  totalReviews: number | null
  ratingDistribution: Record<string, number>  // "5": 45, "4": 20, etc.
  reviews: TrustpilotReview[]
  responseRate: string | null    // "Replies to X% of reviews"
  claimed: boolean               // Whether the company has claimed their page
}

export interface TrustpilotReview {
  id: string
  author: string
  rating: number
  date: string
  title: string
  text: string
  hasReply: boolean
  replyText?: string
  location?: string
  verified: boolean
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Discover the Trustpilot page for a company
 */
async function findTrustpilotSlug(companyName: string): Promise<string | null> {
  // Strategy 1: Try common slug patterns
  const slugGuesses = [
    companyName.toLowerCase().replace(/[^a-z0-9]+/g, ''),
    companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    `${companyName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
    `www.${companyName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
  ]

  for (const slug of slugGuesses) {
    try {
      const res = await fetch(`https://www.trustpilot.com/review/${slug}`, {
        method: 'HEAD',
        headers: { 'User-Agent': UA },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) return slug
    } catch {
      // continue
    }
  }

  // Strategy 2: Use SerpAPI to find the Trustpilot page
  const serpKey = process.env.SERPAPI_KEY
  if (serpKey) {
    try {
      const params = new URLSearchParams({
        engine: 'google',
        q: `site:trustpilot.com "${companyName}" reviews`,
        api_key: serpKey,
        num: '3',
      })
      const res = await fetch(`https://serpapi.com/search?${params}`)
      if (res.ok) {
        const data = await res.json()
        for (const result of data.organic_results || []) {
          const link = result.link || ''
          const slugMatch = link.match(/trustpilot\.com\/review\/([^/?#]+)/)
          if (slugMatch) return slugMatch[1]
        }
      }
    } catch { /* fall through */ }
  }

  return null
}

/**
 * Fetch and parse the Trustpilot company review page
 */
async function fetchTrustpilotPage(slug: string): Promise<TrustpilotResult | null> {
  try {
    const url = `https://www.trustpilot.com/review/${slug}`
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null

    const html = await res.text()
    return parseTrustpilotHtml(slug, html)
  } catch {
    return null
  }
}

/**
 * Parse Trustpilot HTML page (extracts from JSON-LD and HTML patterns)
 */
function parseTrustpilotHtml(slug: string, html: string): TrustpilotResult {
  const result: TrustpilotResult = {
    companySlug: slug,
    overallRating: null,
    totalReviews: null,
    ratingDistribution: {},
    reviews: [],
    responseRate: null,
    claimed: false,
  }

  // Try JSON-LD extraction first (most reliable)
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const jsonStr = block.replace(/<script[^>]*>|<\/script>/gi, '')
        const ld = JSON.parse(jsonStr)

        if (ld['@type'] === 'Organization' || ld['@type'] === 'LocalBusiness') {
          if (ld.aggregateRating) {
            result.overallRating = parseFloat(ld.aggregateRating.ratingValue) || null
            result.totalReviews = parseInt(ld.aggregateRating.reviewCount) || null
          }
        }

        // Extract individual reviews from JSON-LD
        if (Array.isArray(ld.review)) {
          for (let i = 0; i < Math.min(ld.review.length, 20); i++) {
            const r = ld.review[i]
            result.reviews.push({
              id: `tp-${i}`,
              author: r.author?.name || 'Anonymous',
              rating: parseInt(r.reviewRating?.ratingValue) || 3,
              date: r.datePublished || 'Recent',
              title: r.headline || r.name || '',
              text: typeof r.reviewBody === 'string' ? r.reviewBody.substring(0, 500) : '',
              hasReply: false,
              verified: false,
            })
          }
        }
      } catch {
        // invalid JSON-LD block, skip
      }
    }
  }

  // Fallback: extract overall rating from meta/text patterns
  if (!result.overallRating) {
    const ratingMatch = html.match(/TrustScore\s*(\d\.?\d?)/i) ||
      html.match(/(?:rated|rating)[^0-9]*(\d\.?\d?)\s*(?:out of|\/)\s*5/i)
    if (ratingMatch) {
      result.overallRating = parseFloat(ratingMatch[1])
    }
  }

  if (!result.totalReviews) {
    const countMatch = html.match(/([\d,]+)\s*(?:reviews?|total reviews)/i)
    if (countMatch) {
      result.totalReviews = parseInt(countMatch[1].replace(/,/g, ''))
    }
  }

  // Check if company has claimed their page
  if (html.includes('Claimed profile') || html.includes('claimed their Trustpilot')) {
    result.claimed = true
  }

  // Check response rate
  const responseMatch = html.match(/(?:replies to|responded to)\s*(\d+%)/i)
  if (responseMatch) {
    result.responseRate = responseMatch[1]
  }

  return result
}

/**
 * Main: Fetch Trustpilot reviews for a company — L5 signal
 */
export async function fetchTrustpilot(companyName: string): Promise<TrustpilotResult | null> {
  try {
    const slug = await findTrustpilotSlug(companyName)
    if (!slug) {
      console.warn(`[Trustpilot] No page found for: ${companyName}`)
      return null
    }

    const result = await fetchTrustpilotPage(slug)
    if (!result) {
      console.warn(`[Trustpilot] Could not parse page for slug: ${slug}`)
      return null
    }

    console.log(
      `[Trustpilot] Found: ${result.overallRating}/5 (${result.totalReviews} reviews) for ${slug}`
    )
    return result
  } catch (error) {
    console.error('[Trustpilot] Error:', error)
    return null
  }
}
