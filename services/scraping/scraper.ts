/**
 * URL Scraper — Fetch & Extract Page Content
 *
 * Phase 1 (now):  fetch + HTML text extraction (no browser needed)
 * Phase 2 (later): Playwright for JS-rendered pages
 *
 * Handles:
 *   - Standard HTML pages → text extraction
 *   - JSON APIs → raw JSON
 *   - Timeouts & error recovery
 *   - Content size limits
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScrapedContent {
  url: string
  title: string
  text: string
  metaDescription: string
  timestamp: string | null
  contentLength: number
  statusCode: number
  error: string | null
}

// ─── Config ──────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 20_000
const MAX_BODY_BYTES = 2_000_000   // 2 MB max download
const MAX_TEXT_CHARS = 50_000      // 50k chars max extracted text
const MIN_TEXT_CHARS = 50          // below this = useless page

// ─── Main scraper ────────────────────────────────────────────────────────────

export async function scrapePage(url: string): Promise<ScrapedContent> {
  const empty: ScrapedContent = {
    url,
    title: '',
    text: '',
    metaDescription: '',
    timestamp: null,
    contentLength: 0,
    statusCode: 0,
    error: null,
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',  // no compression for simpler handling
      },
      redirect: 'follow',
      signal: controller.signal,
    })
    clearTimeout(timer)

    empty.statusCode = response.status

    if (!response.ok) {
      empty.error = `HTTP ${response.status}`
      return empty
    }

    const contentType = response.headers.get('content-type') || ''

    // JSON response (API endpoints)
    if (contentType.includes('application/json')) {
      const json = await response.text()
      return {
        ...empty,
        text: json.substring(0, MAX_TEXT_CHARS),
        contentLength: json.length,
      }
    }

    // HTML response
    if (contentType.includes('text/html') || contentType.includes('text/plain')) {
      const html = await readLimitedBody(response, MAX_BODY_BYTES)
      const title = extractTitle(html)
      const meta = extractMetaDescription(html)
      const timestamp = extractTimestamp(html)
      const text = extractMainText(html)

      return {
        url,
        title,
        text: text.substring(0, MAX_TEXT_CHARS),
        metaDescription: meta,
        timestamp,
        contentLength: text.length,
        statusCode: response.status,
        error: text.length < MIN_TEXT_CHARS ? 'too-little-content' : null,
      }
    }

    // Other content types (PDF, images, etc.) — skip
    empty.error = `unsupported-content-type: ${contentType}`
    return empty
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return { ...empty, error: msg.includes('abort') ? 'timeout' : msg }
  }
}

// ─── Batch scraper with concurrency ──────────────────────────────────────────

export async function scrapePages(
  urls: string[],
  concurrency = 5
): Promise<ScrapedContent[]> {
  const results: ScrapedContent[] = []

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency)
    const batchResults = await Promise.allSettled(batch.map(u => scrapePage(u)))

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value)
      }
    }
  }

  return results
}

// ─── HTML extraction helpers ─────────────────────────────────────────────────

/** Read response body up to a byte limit */
async function readLimitedBody(response: Response, maxBytes: number): Promise<string> {
  // If body is available as text, just read it
  const text = await response.text()
  return text.substring(0, maxBytes)
}

/** Extract <title> from HTML */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match ? decodeHtmlEntities(match[1].trim()) : ''
}

/** Extract meta description */
function extractMetaDescription(html: string): string {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)
    || html.match(/<meta[^>]+content=["']([^"']*)[^>]+name=["']description["']/i)
  return match ? decodeHtmlEntities(match[1].trim()) : ''
}

/** Try to extract a publication date from HTML */
function extractTimestamp(html: string): string | null {
  // Common meta tags for dates
  const datePatterns = [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)/i,
    /<time[^>]+datetime=["']([^"']+)/i,
  ]

  for (const pat of datePatterns) {
    const match = html.match(pat)
    if (match) return match[1].trim()
  }

  return null
}

/** Extract main text content from HTML, removing scripts/styles/nav */
function extractMainText(html: string): string {
  let text = html

  // Remove scripts, styles, SVGs, head, nav, footer, aside
  const removePatterns = [
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /<style[^>]*>[\s\S]*?<\/style>/gi,
    /<svg[^>]*>[\s\S]*?<\/svg>/gi,
    /<head[^>]*>[\s\S]*?<\/head>/gi,
    /<nav[^>]*>[\s\S]*?<\/nav>/gi,
    /<footer[^>]*>[\s\S]*?<\/footer>/gi,
    /<aside[^>]*>[\s\S]*?<\/aside>/gi,
    /<header[^>]*>[\s\S]*?<\/header>/gi,
    /<!--[\s\S]*?-->/g,
  ]

  for (const pat of removePatterns) {
    text = text.replace(pat, ' ')
  }

  // Try to find <main> or <article> content first (most relevant)
  const mainMatch = text.match(/<(?:main|article)[^>]*>([\s\S]*?)<\/(?:main|article)>/i)
  if (mainMatch && mainMatch[1].length > 200) {
    text = mainMatch[1]
  }

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode HTML entities
  text = decodeHtmlEntities(text)

  // Normalize whitespace
  text = text
    .replace(/[\t\r]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ {2,}/g, ' ')
    .trim()

  return text
}

/** Decode common HTML entities */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
}
