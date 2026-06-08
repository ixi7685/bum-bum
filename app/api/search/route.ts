import { NextRequest, NextResponse } from 'next/server'
import { fetchAllRealData, RealDataBundle } from './sources/aggregator'
import { getUserBySession, saveCompanyForUser } from '../../../lib/userStore'
import { runSearchPipeline, PipelineResult } from '../../../services/pipeline'
import { wasReviewsFreeThrottled } from './sources/reviewsFree'
import { wasLinkedInFreeThrottled } from './sources/linkedinFree'
import { wasRedditRapidApiThrottled } from './sources/redditRapidApi'
import * as fs from 'fs'
import * as path from 'path'

const SERPER_COST_PER_1000_USD = 0.30
const REPORT_PRICE_USD = 7

export async function POST(request: NextRequest) {
  try {
    const { companyName, country, position, category, gl, hl } = await request.json()

    if (!companyName || !country || !position) {
      return NextResponse.json(
        { error: 'Company name, country, and position are required' },
        { status: 400 }
      )
    }

    const sessionToken = request.cookies.get('session')?.value
    const user = sessionToken ? getUserBySession(sessionToken) : null

    const slug = companyName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    if (user) saveCompanyForUser(user.id, companyName, slug)

    const openaiApiKey = process.env.OPENAI_API_KEY

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key is not configured' },
        { status: 500 }
      )
    }

    // =========================================================================
    // STEP 1: Fetch REAL data from YouTube, Reddit, Glassdoor, Blind, News
    // =========================================================================
    console.log(`[Search] Fetching real data for: ${companyName}`)
    const realData = await fetchAllRealData(companyName)

    const dataSummary = [
      `L1-Site: ${realData.companySite?.companyDomain || 'none'} (${realData.companySite?.surfacesFound || 0}/${realData.companySite?.surfacesScanned || 0} surfaces)`,
      `L1-Social: ${realData.companySite?.discoveredSocialAccounts.length || 0} accounts`,
      `L1-ATS: ${realData.companySite?.detectedATSPlatforms.length || 0} platforms`,
      `L2-Signals: ${realData.professionalBehavior?.totalFound || 0} (${realData.professionalBehavior?.sourcesSearched.length || 0} sources)`,
      `L2-LinkedIn(free): ${realData.linkedinFree?.totalFound || 0} signals`,
      `YouTube: ${realData.youtube.totalFound} videos`,
      `YT Comments: ${realData.youtubeComments.totalFound}`,
      `Reddit (key): ${realData.reddit.totalFound} posts`,
      `Reddit (RapidAPI): ${realData.redditRapidApi.totalFound} posts`,
      `Reddit (free): ${realData.redditFree.totalFound} posts`,
      `Hacker News: ${realData.hackerNews.totalFound} posts`,
      `Wikipedia: ${realData.wikipedia ? 'found' : 'none'}`,
      `Glassdoor: ${realData.glassdoor.totalFound} results`,
      `Blind: ${realData.blind.totalFound} posts`,
      `Indeed/Comp: ${realData.indeed.totalFound} results`,
      `Trustpilot: ${realData.trustpilot ? `${realData.trustpilot.overallRating}/5 (${realData.trustpilot.totalReviews} reviews)` : 'none'}`,
      `News: ${realData.news.totalFound} articles`,
      `Layoffs: ${realData.externalConsequences?.layoffs.length || 0}`,
      `Lawsuits: ${realData.externalConsequences?.lawsuits.length || 0}`,
    ].join(', ')
    console.log(`[Search] Real data collected: ${dataSummary}`)

    // =========================================================================
    // STEP 2: Run Serper-backed pipeline telemetry (non-blocking fallback)
    // =========================================================================
    let pipelineResult: PipelineResult | null = null
    try {
      pipelineResult = await runSearchPipeline(companyName, {
        coreOnly: true,
        maxScrape: 20,
        gl,
        hl,
      })
    } catch (pipelineError) {
      console.warn('[Search] Pipeline telemetry unavailable:', pipelineError)
    }

    // =========================================================================
    // STEP 3: Build AI prompt grounded in real evidence
    // =========================================================================
    const prompt = buildPrompt(companyName, realData, country, position, category)

    // =========================================================================
    // STEP 4: Call OpenAI with real data context
    // =========================================================================
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_completion_tokens: 24000,
        temperature: 0.5,
      }),
    })

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.json()
      console.error('OpenAI API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to get company information from OpenAI' },
        { status: 500 }
      )
    }

    const openaiData = await openaiResponse.json()
    let companyInfo = openaiData.choices[0]?.message?.content

    if (!companyInfo) {
      return NextResponse.json(
        { error: 'No response received from OpenAI' },
        { status: 500 }
      )
    }

    // =========================================================================
    // STEP 5: Post-process — inject real YouTube IDs and Reddit data
    // =========================================================================
    companyInfo = enrichWithRealData(companyInfo, realData)

    const telemetry = buildCostTelemetry(companyName, pipelineResult)
    const sourceStatus = buildSourceStatus(realData)

    // Auto-save as example for demo page
    try {
      const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      const examplesDir = path.join(process.cwd(), 'public', 'examples')
      if (!fs.existsSync(examplesDir)) fs.mkdirSync(examplesDir, { recursive: true })
      fs.writeFileSync(path.join(examplesDir, `${slug}.json`), companyInfo, 'utf-8')
    } catch { /* ignore save errors */ }

    return NextResponse.json({
      companyName,
      companyInfo,
      searchConfig: {
        gl: telemetry.gl,
        hl: telemetry.hl,
      },
      realDataStats: {
        companySite: realData.companySite?.companyDomain || null,
        l1SurfacesFound: realData.companySite?.surfacesFound || 0,
        l1SurfacesScanned: realData.companySite?.surfacesScanned || 0,
        l1SocialAccounts: realData.companySite?.discoveredSocialAccounts.length || 0,
        l1ATSPlatforms: realData.companySite?.detectedATSPlatforms.length || 0,
        l2Signals: realData.professionalBehavior?.totalFound || 0,
        l2Sources: realData.professionalBehavior?.sourcesSearched.length || 0,
        youtube: realData.youtube.totalFound,
        youtubeComments: realData.youtubeComments.totalFound,
        reddit: realData.reddit.totalFound,
        redditRapidApi: realData.redditRapidApi.totalFound,
        redditFree: realData.redditFree.totalFound,
        hackerNews: realData.hackerNews.totalFound,
        glassdoor: realData.glassdoor.totalFound,
        blind: realData.blind.totalFound,
        indeed: realData.indeed.totalFound,
        trustpilot: realData.trustpilot?.overallRating || null,
        news: realData.news.totalFound,
        layoffs: realData.externalConsequences?.layoffs.length || 0,
        lawsuits: realData.externalConsequences?.lawsuits.length || 0,
        externalRealitySignals: realData.externalReality?.totalFound || 0,
      },
      sourceStatus,
      costTelemetry: telemetry,
      success: true,
    })

  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function buildCostTelemetry(companyName: string, pipelineResult: PipelineResult | null) {
  const stats = pipelineResult?.stats
  const serperCallsEstimated = stats?.serperCallsEstimated ?? 10
  const serperCallsMade = stats?.serperCallsMade ?? 0
  const discoveredUrls = stats?.urlsDiscovered ?? 0
  const scrapedUrls = stats?.urlsScraped ?? 0
  const acceptedSources = stats?.acceptedSources ?? stats?.contentPassed ?? 0
  const serperCostUsd = Number(((serperCallsMade / 1000) * SERPER_COST_PER_1000_USD).toFixed(6))
  const estimatedMarginUsd = Number((REPORT_PRICE_USD - serperCostUsd).toFixed(6))

  return {
    company: companyName,
    reportPriceUsd: REPORT_PRICE_USD,
    gl: stats?.gl ?? 'us',
    hl: stats?.hl ?? 'en',
    serper: {
      callsEstimated: serperCallsEstimated,
      callsMade: serperCallsMade,
      cacheHits: stats?.serperCacheHits ?? 0,
      estimatedCostUsd: serperCostUsd,
      pricingAssumptionUsdPer1000: SERPER_COST_PER_1000_USD,
    },
    pipeline: {
      discoveredUrls,
      scrapedUrls,
      acceptedSources,
      targets: {
        searchesMax: 10,
        rawUrlsMax: 100,
        scrapedPagesMax: 20,
        usefulSourcesMin: 5,
        usefulSourcesMax: 10,
      },
    },
    economics: {
      estimatedMarginUsd,
      note: 'Margin includes Serper discovery estimate only; scraping/LLM infra costs are not included.',
    },
  }
}

type SourceStatus = 'has_data' | 'no_hits' | 'missing_key' | 'throttled'

function statusFromCount(
  count: number,
  needsKey: boolean,
  keyPresent: boolean,
  throttled: boolean = false
): SourceStatus {
  if (count > 0) return 'has_data'
  if (needsKey && !keyPresent) return 'missing_key'
  if (throttled) return 'throttled'
  return 'no_hits'
}

function buildSourceStatus(realData: RealDataBundle) {
  const hasYouTubeKey = Boolean(process.env.YOUTUBE_API_KEY)
  const hasRedditOAuth = Boolean(process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET)
  const hasRapidApi = Boolean(process.env.RAPIDAPI_KEY)
  const hasSerper = Boolean(process.env.SERPER_API_KEY)
  const reviewsFreeThrottled = wasReviewsFreeThrottled()
  const linkedInFreeThrottled = wasLinkedInFreeThrottled()
  const redditRapidApiThrottled = wasRedditRapidApiThrottled()

  return {
    l1CompanySite: statusFromCount(realData.companySite?.surfacesFound || 0, false, true),
    l2ProfessionalBehavior: statusFromCount(
      realData.professionalBehavior?.totalFound || 0,
      false,
      true,
      linkedInFreeThrottled
    ),
    youtube: statusFromCount(realData.youtube.totalFound, true, hasYouTubeKey),
    youtubeComments: statusFromCount(realData.youtubeComments.totalFound, true, hasYouTubeKey),
    redditOAuth: statusFromCount(realData.reddit.totalFound, true, hasRedditOAuth),
    redditRapidApi: statusFromCount(realData.redditRapidApi.totalFound, true, hasRapidApi, redditRapidApiThrottled),
    redditFree: statusFromCount(realData.redditFree.totalFound, false, true),
    hackerNews: statusFromCount(realData.hackerNews.totalFound, false, true),
    glassdoorBlindIndeedNews: statusFromCount(
      realData.glassdoor.totalFound + realData.blind.totalFound + realData.indeed.totalFound + realData.news.totalFound,
      true,
      hasSerper,
      reviewsFreeThrottled
    ),
    trustpilot: statusFromCount(realData.trustpilot ? 1 : 0, false, true),
    externalConsequences: statusFromCount(
      (realData.externalConsequences?.layoffs.length || 0) +
      (realData.externalConsequences?.lawsuits.length || 0) +
      (realData.externalConsequences?.leadershipChanges.length || 0) +
      (realData.externalConsequences?.fundingEvents.length || 0) +
      (realData.externalConsequences?.filings.length || 0),
      true,
      hasSerper
    ),
    externalReality: statusFromCount(realData.externalReality?.totalFound || 0, false, true),
  }
}

// =============================================================================
// PROMPT BUILDER
// =============================================================================

function buildPrompt(companyName: string, realData: RealDataBundle, country?: string, position?: string, category?: string): string {
  const hasRealData = realData.youtube.totalFound > 0 ||
    realData.youtubeComments.totalFound > 0 ||
    realData.reddit.totalFound > 0 ||
    realData.redditFree.totalFound > 0 ||
    realData.hackerNews.totalFound > 0 ||
    realData.glassdoor.totalFound > 0 ||
    realData.blind.totalFound > 0 ||
    realData.indeed.totalFound > 0 ||
    realData.news.totalFound > 0 ||
    realData.companySite?.companyDomain != null ||
    (realData.companySite?.surfacesFound ?? 0) > 0 ||
    (realData.professionalBehavior?.totalFound ?? 0) > 0 ||
    realData.trustpilot != null ||
    realData.externalConsequences != null

  return `You are an Employment Risk Intelligence analyst using a 6-LAYER FRAMEWORK. Your job is to help people understand employment risk by peeling back layers of information — from what the company claims (L1) down to what actually happened (L6).

THE 6-LAYER FRAMEWORK:
L1 — Official/Controlled Narrative (MASTER SOURCE TABLE):
  LOCK RULE: If the company can approve it, edit it, or delete it → Layer 1.
  Layer 1 is the company's self-authored reality. It is NOT truth. It is the control sample.
  Categories:
    A. Core Web Properties — main site, about, values, careers, culture, benefits, DEI/ESG, sustainability, blog, newsroom, press, case studies, testimonials, customer stories, partners, pricing, features, roadmap, status, trust/security, compliance
    B. Official Social Media — Brand account posts ONLY (LinkedIn, X, Facebook, Instagram, TikTok, YouTube, Threads, Telegram, Discord). Comments under brand posts ≠ L1.
    C. Official Media — Company YouTube videos, podcasts, webinars, demos, investor days, town halls
    D. Hiring Surfaces — Job postings on ATS platforms (Greenhouse, Lever, Workday, Ashby, etc.). The job posting = L1. The platform itself ≠ L1.
    E. Product Surfaces — Public docs, API docs, dev portals, changelogs, release notes, feature announcements, migration guides
    F. Investor/Financial — IR site, annual reports, quarterly updates, shareholder letters, pitch decks, crowdfunding, token whitepapers
    G. Legal/Compliance — ToS, privacy policy, cookie policy, refund policy, code of conduct, ethics policy, whistleblower policy, AML/KYC, regulatory disclosures, risk disclosures, user agreements, arbitration clauses
    H. Regional Variants — Local-language sites, country-specific careers, local policies, local social accounts (mismatch between EN vs local = high-risk signal)
    I. Edge Cases — "We're hiring" pages, restructuring pages, official apologies, clarification threads, CEO messages, founders' letters, sunsetting notices, outage explanations, trust center microsites
  NEVER L1: Employee personal posts (L2), comments under brand posts (L4), reviews (L3/L5), community discussions (L4), news articles (L6), analyst opinions (L6)
L2 — Semi-Public Professional Behavior (MASTER SOURCE TABLE):
  LOCK RULE: Is a human speaking publicly, without company editorial control, in a professional context? → Layer 2.
  Layer 2 is the “human-in-public” layer. It captures how people tied to a company behave when reputations are on the line but scripts are thinner.
  It is neither marketing nor anonymous truth — it is behavior under light pressure.
  Categories:
    A. Professional Social Networks (personal accounts ONLY) — LinkedIn personal posts, comments, reposts with text, celebration posts, hiring posts (personal), farewell posts, layoff posts, thought leadership posts. Company Pages on LinkedIn = L1, NOT L2.
    B. Microblogging & Short-Form — X/Twitter personal tweets, reply threads, quote tweets, long threads, tweet deletions. Mastodon personal posts, Bluesky personal posts.
    C. Long-Form Writing (not company-owned) — Medium personal blogs, Substack newsletters, personal self-hosted blogs, Dev.to posts, Hashnode posts, Ghost blogs.
    D. Podcasts, Interviews & Public Speaking — Podcast interviews (non-official channel), founder podcasts, employee podcast appearances, conference talks, panel discussions, fireside chats, YouTube interviews (non-official). If hosted on company channel → L1. If hosted elsewhere → L2.
    E. Developer & Technical Surfaces — GitHub issues (public), GitHub Discussions, README "how we work" sections, Stack Overflow answers (company context), RFC discussions, public incident post-mortems (human-authored). Code itself ≠ L2. Text describing decisions, tradeoffs, blame = L2.
    F. Hiring & Recruiting (human-authored) — Recruiter LinkedIn posts (personal), hiring manager posts, "we're hiring aggressively" posts, "DM me for roles" posts, recruiter comment replies. ATS job listings = L1. Recruiter behavior = L2.
    G. Professional Communities (non-anonymous) — LinkedIn Groups (public), Slack community posts (public archives), public Discord (professional servers), Indie Hacker posts, Product Hunt discussions (author replies). If identity is known and professional → L2. Anonymous → L4.
    H. Edge Cases — Public resignation letters, public apology posts, "lessons learned" posts, personal crisis explanations, whistleblower statements (named), court testimony excerpts (public), LinkedIn "open to work" signals.
  NEVER L2: Company website (L1), Company LinkedIn Page (L1), Glassdoor reviews (L3), Reddit threads (L4), Yelp reviews (L5), News articles (L6), Analyst reports (L6), Anonymous leaks (L4).
  If anonymous → L4. If official → L1. If experiential employment review → L3. If customer complaint → L5. If externally verified event → L6.
L3 — Employee & Candidate Leakage: What insiders say anonymously (Glassdoor, Blind, Indeed reviews)
L4 — Community & Peer Reality: What people say when no one from the company is in the room (Reddit, HN, forums)
L5 — Client/User Fallout: How the company treats people who depend on it (Trustpilot, app reviews, support)
L6 — External Consequences (Receipts): What actually happened in the real world (layoffs, lawsuits, regulatory, leadership changes)

KEY PRINCIPLE: Each layer gets progressively harder to fake. The gap between L1 and L3-L6 IS the story.

BRAND RULES (STRICT — NON-NEGOTIABLE):
- We are an intelligence layer, not a decision-maker.
- We are NOT a review site, NOT a rating platform, NOT an HR tool, NOT a drama platform.
- We surface how company patterns interact with different people — we do not tell anyone what to do.
- We do NOT publish single-review opinions, score companies universally, sell fear, or optimize for virality over accuracy.
- We do NOT pretend to have certainty where there isn't any. If data is thin or conflicted, say so explicitly.
- Tone: Human, not corporate. Clear, not clever. Calm, not alarmist. Honest about uncertainty.
- Language: Use "tends to", "has shown a pattern of", "varies by role and timing", "based on available data". Never use "expose", "truth", "guarantee", "best/worst", "toxic" without definition, "must", "always/never".
- The same company can be stable for one person and risky for another — personalization matters.
- Never say "avoid this company" or rank companies. Instead explain recurring patterns and trade-offs.
- If something sounds like HR, PR, or Glassdoor, rewrite it.

${hasRealData ? `
==========================================
REAL EVIDENCE COLLECTED FROM THE INTERNET
==========================================
The following data was scraped from real sources moments ago.
You MUST use this real data as the foundation of your analysis.
Do NOT invent quotes, video titles, or usernames — use what is provided below.
You may supplement with your training knowledge, but always prefer real data.

${realData.summary}

==========================================
END OF REAL DATA
==========================================
` : `
NOTE: No real-time data was available from APIs. Use your training knowledge about ${companyName} to generate the best possible analysis. Be transparent about this limitation in the dataQualityNote.
`}

CANDIDATE CONTEXT:
Analyze for someone who cares about:
- Stability and income predictability
- Work-life balance
- Real learning and growth
- Transparent, stable leadership
- Fair workload

PRIMARY SEARCH CONTEXT:
Company name: ${companyName}
Company country/region: ${country}
Candidate position: ${position}
${category ? `Company category/industry: ${category}` : ''}
${country || position || category ? `
IMPORTANT CONTEXT: ${country ? `This company operates in ${country}. Factor in regional labor laws, cultural norms, and local employment practices specific to ${country}. Search for region-specific signals, reviews, and regulatory context.` : ''} ${category ? `This is a ${category} company. Consider industry-specific risk patterns, typical employment practices, and sector-specific red flags for ${category} companies.` : ''}
${position ? `Evaluate the evidence through the lens of a candidate considering a ${position} role. Highlight risks, benefits, and warning signs that matter specifically for that position.` : ''}
` : ''}

YOUR TASK:
Generate a comprehensive 6-Layer Risk Profile as a JSON object.

CRITICAL — MAPPING REAL DATA TO LAYERS:
${realData.companySite?.companyDomain ? `- L1 MASTER SOURCE TABLE: Company domain found at ${realData.companySite.companyDomain}. ${realData.companySite.surfacesFound}/${realData.companySite.surfacesScanned} L1 surfaces scanned.
  Surfaces found: ${[
    realData.companySite.aboutPage ? 'About' : '',
    realData.companySite.careersPage ? 'Careers' : '',
    realData.companySite.pressPage ? 'Press/Newsroom' : '',
    realData.companySite.visionValuesPage ? 'Values' : '',
    realData.companySite.culturePage ? 'Culture' : '',
    realData.companySite.benefitsPage ? 'Benefits' : '',
    realData.companySite.deiEsgPage ? 'DEI/ESG' : '',
    realData.companySite.sustainabilityPage ? 'Sustainability' : '',
    realData.companySite.blogPage ? 'Blog' : '',
    realData.companySite.pricingPage ? 'Pricing' : '',
    realData.companySite.productFeaturesPage ? 'Product/Features' : '',
    realData.companySite.trustSecurityPage ? 'Trust/Security' : '',
    realData.companySite.compliancePage ? 'Compliance' : '',
    realData.companySite.investorRelationsPage ? 'Investor Relations' : '',
    realData.companySite.docsPage ? 'Docs' : '',
    realData.companySite.termsPage ? 'ToS' : '',
    realData.companySite.privacyPage ? 'Privacy Policy' : '',
    realData.companySite.refundPolicyPage ? 'Refund Policy' : '',
    realData.companySite.codeOfConductPage ? 'Code of Conduct' : '',
    realData.companySite.ethicsPolicyPage ? 'Ethics Policy' : '',
    realData.companySite.whistleblowerPage ? 'Whistleblower' : '',
  ].filter(Boolean).join(', ')}
  Social brand accounts discovered: ${realData.companySite.discoveredSocialAccounts.map(a => `${a.platform}:@${a.handle}`).join(', ') || 'none'}
  ATS platforms detected: ${realData.companySite.detectedATSPlatforms.map(a => a.platform).join(', ') || 'none'}
  Extract claimed values, benefits, culture keywords from ALL surfaces. COMPARE against L3-L6 data for mismatch detection.` : '- L1: Company website not found. Use your knowledge about their public branding.'}
${(realData.professionalBehavior?.totalFound ?? 0) > 0 ? `- L2 PROFESSIONAL BEHAVIOR: ${realData.professionalBehavior!.totalFound} signals found across ${realData.professionalBehavior!.sourcesSearched.length} sources.
  USE real L2 signals — these are humans speaking publicly without company editorial control.
  Category breakdown: ${Object.entries(realData.professionalBehavior!.categoryBreakdown).filter(([,v]) => v > 0).map(([k,v]) => `${k}(${v})`).join(', ') || 'mixed'}
  Platform breakdown: ${Object.entries(realData.professionalBehavior!.platformBreakdown).filter(([,v]) => v > 0).map(([k,v]) => `${k}(${v})`).join(', ') || 'mixed'}
  Tone breakdown: ${Object.entries(realData.professionalBehavior!.toneBreakdown).filter(([,v]: [string, number]) => v > 0).map(([k,v]: [string, number]) => `${k}(${v})`).join(', ') || 'mixed'}
  ${realData.professionalBehavior!.devSignals.length > 0 ? `Dev signals: ${realData.professionalBehavior!.devSignals.length} (GitHub issues, Dev.to posts, StackOverflow)` : ''}
  Map ALL L2 signals preserving original category, tone, speaker class. Include URLs.` : '- L2: No real professional behavior data found. Generate realistic L2 entries: LinkedIn personal posts, Medium articles, podcast appearances, GitHub issues, recruiter posts. Infer realistic speaker classes and tones.'}
${realData.youtube.totalFound > 0 ? `- YouTube: USE the real video titles, channel names, and YouTube IDs. Assign each to the most relevant layer (ex-employee videos → L3, customer complaints → L5, news → L6).` : '- YouTube: No real videos found. Generate realistic entries, omit youtubeId.'}
${realData.youtubeComments.totalFound > 0 ? `- YouTube Comments: ${realData.youtubeComments.totalFound} real comments found. Map to L5 (client/user signals).` : ''}
${realData.reddit.totalFound > 0 ? `- Reddit: USE real posts with URLs. Map to L4 (community reality).` : '- Reddit: No real posts found. Generate realistic L4 entries.'}
${realData.redditFree.totalFound > 0 ? `- Reddit (free): Additional ${realData.redditFree.totalFound} posts. Map to L4.` : ''}
${realData.hackerNews.totalFound > 0 ? `- Hacker News: ${realData.hackerNews.totalFound} discussions. Map to L4.` : '- Hacker News: No real discussions found.'}
${realData.glassdoor.totalFound > 0 ? `- Glassdoor: USE real reviews. Map to L3 (employee leakage).` : '- Glassdoor: No real results. Generate realistic L3 entries.'}
${realData.blind.totalFound > 0 ? `- Blind: USE real posts. Map to L3 (employee leakage).` : '- Blind: No real posts. Generate realistic L3 entries.'}
${realData.indeed.totalFound > 0 ? `- Indeed/Comparably: ${realData.indeed.totalFound} reviews. Map to L3.` : ''}
${realData.trustpilot ? `- Trustpilot: ${realData.trustpilot.overallRating}/5 from ${realData.trustpilot.totalReviews} reviews. Map to L5 (client fallout).` : ''}
${realData.news.totalFound > 0 ? `- News: USE real headlines. Map to L6 (external consequences).` : '- News: No real articles found.'}
${realData.externalConsequences?.layoffs.length ? `- LAYOFFS: ${realData.externalConsequences.layoffs.length} events found. Map to L6.` : ''}
${realData.externalConsequences?.lawsuits.length ? `- LAWSUITS: ${realData.externalConsequences.lawsuits.length} legal issues. Map to L6.` : ''}
${realData.externalConsequences?.leadershipChanges.length ? `- LEADERSHIP CHANGES: ${realData.externalConsequences.leadershipChanges.length} changes. Map to L6.` : ''}

IMPORTANT: Every review, discussion, and complaint MUST include a "url" field with the real link.

OUTPUT FORMAT (STRICT JSON — 6-LAYER STRUCTURE):
Return ONLY valid JSON, no markdown, no explanation. The JSON must match this structure:

{
  "companyName": "actual company name",
  "candidate": {
    "generation": "",
    "ageRange": "",
    "focus": ["relevant focus areas"]
  },
  "verdict": {
    "type": "green|yellow|red",
    "emoji": "emoji",
    "title": "verdict title",
    "oneLiner": "personalized summary — this is about risk FOR THIS PERSON",
    "riskLevel": "risk level",
    "bullets": ["key findings — factual, not alarmist. NEVER use L1/L2/L3/L4/L5/L6 codes here. Use plain language like 'employee reviews', 'community discussions', 'public records'"],
    "layerConfidence": [
      { "layer": "L1", "label": "Official Narrative", "score": 0-100 },
      { "layer": "L2", "label": "Professional Behavior", "score": 0-100 },
      { "layer": "L3", "label": "Employee Leakage", "score": 0-100 },
      { "layer": "L4", "label": "Community Reality", "score": 0-100 },
      { "layer": "L5", "label": "Client Fallout", "score": 0-100 },
      { "layer": "L6", "label": "External Consequences", "score": 0-100 }
    ]
  },
  "layerOverviews": [
    {
      "id": "L1",
      "name": "Official Narrative",
      "subtitle": "What they want you to believe",
      "icon": "🏢",
      "riskLevel": "low|medium|high|critical",
      "keyFinding": "one-line summary of this layer",
      "sourceCount": 0,
      "confidence": 0-100
    }
  ],
  "l1": {
    "companyDomain": "domain or null",
    "missionStatement": "their mission or null",
    "coreWebProperties": {
      "mainWebsite": { "url": "url", "title": "title", "headings": [], "textPreview": "preview", "keyPhrases": [], "lastScraped": "ISO", "found": true } ,
      "aboutPage": null,
      "visionValuesPage": null,
      "careersPage": null,
      "culturePage": null,
      "benefitsPage": null,
      "deiEsgPage": null,
      "sustainabilityPage": null,
      "blogPage": null,
      "newsroomPage": null,
      "pressReleasesPage": null,
      "mediaKitPage": null,
      "caseStudiesPage": null,
      "testimonialsPage": null,
      "customerStoriesPage": null,
      "partnersPage": null,
      "pricingPage": null,
      "productFeaturesPage": null,
      "roadmapPage": null,
      "statusPage": null,
      "trustSecurityPage": null,
      "compliancePage": null
    },
    "socialBrandAccounts": [{ "platform": "LinkedIn", "handle": "@company", "url": "url", "tone": "promotional", "found": true }],
    "mediaChannels": {
      "youtubeChannel": null,
      "companyPodcasts": [],
      "webinars": [],
      "productDemos": [],
      "investorDays": [],
      "recordedTownHalls": []
    },
    "hiringSurfaces": [{ "platform": "Greenhouse", "url": "url", "jobCount": 0, "detected": true }],
    "jobPostingsCount": 0,
    "productSurfaces": {
      "publicDocs": null, "apiDocs": null, "developerPortal": null,
      "publicChangelog": null, "releaseNotes": null, "featureAnnouncements": null, "migrationGuides": null
    },
    "investorSurfaces": {
      "investorRelationsPage": null, "annualReports": [], "quarterlyUpdates": [],
      "shareholderLetters": [], "pitchDecks": [], "crowdfundingPages": [], "tokenWhitepapers": []
    },
    "legalSurfaces": {
      "termsOfService": null, "privacyPolicy": null, "cookiePolicy": null, "refundPolicy": null,
      "codeOfConduct": null, "ethicsPolicy": null, "whistleblowerPolicy": null,
      "amlKycDisclosures": null, "regulatoryDisclosures": null, "riskDisclosures": null,
      "userAgreements": null, "arbitrationClauses": null
    },
    "regionalVariants": [],
    "edgeCases": [],
    "claimedValues": ["value1", "value2"],
    "benefitsClaims": ["benefit1"],
    "cultureKeywords": ["keyword1"],
    "careersHighlights": ["highlight1"],
    "changeDetection": [{ "what": "what changed", "when": "when", "significance": "low|medium|high" }],
    "surfacesScanned": 0,
    "surfacesFound": 0,
    "surfaceCoverage": 0,
    "summary": "L1 analysis — what the company's self-authored reality reveals and where gaps exist"
  },
  "l2": {
    "signals": [
      {
        "id": "unique-id",
        "category": "A-professional-social|B-microblogging|C-long-form|D-podcast-interview|E-dev-technical|F-hiring-recruiting|G-professional-community|H-edge-case",
        "platform": "LinkedIn|X/Twitter|Medium|Substack|Dev.to|GitHub|Podcast|Conference Talk|YouTube Interview|Indie Hackers|Product Hunt|Mastodon|Bluesky|Web",
        "speakerClass": "leader|current-employee|ex-employee|recruiter|partner|outsider|founder|hiring-manager",
        "proximity": "first-hand|second-hand|observational|speculative",
        "summary": "what was observed",
        "tone": "promotional|defensive|authentic|empathetic|silence|critical|celebratory|reflective|frustrated|neutral",
        "date": "YYYY-MM or date string",
        "url": "url if available",
        "author": "person name or handle",
        "signalType": "farewell-post|layoff-post|thought-leadership|hiring-post|culture-signal|podcast-appearance|conference-talk|lessons-learned|public-apology|resignation-letter|whistleblower-statement|open-to-work|general"
      }
    ],
    "devSignals": [
      {
        "platform": "GitHub|StackOverflow|Dev.to|Hashnode",
        "type": "issue|discussion|readme|post-mortem|blog-post|answer",
        "title": "title",
        "snippet": "text excerpt",
        "url": "url",
        "author": "author",
        "date": "date",
        "reactions": 0,
        "comments": 0
      }
    ],
    "behavioralPatterns": [{ "pattern": "pattern", "interpretation": "meaning", "risk": "low|medium|high" }],
    "cadenceAnalysis": "observation about posting frequency or null",
    "silenceEvents": ["notable silence"],
    "platformBreakdown": [{ "platform": "LinkedIn", "count": 0, "icon": "💼" }],
    "categoryBreakdown": [{ "category": "A-professional-social", "label": "Professional Social Networks", "count": 0 }],
    "toneBreakdown": [{ "tone": "promotional", "count": 0, "percentage": 0 }],
    "sourcesSearched": ["LinkedIn (SerpAPI)", "GitHub API"],
    "totalSignalsFound": 0,
    "signalsFound": 0,
    "summary": "L2 analysis summary — behavior under light pressure reveals..."
  },
  "l3": {
    "reviews": [
      {
        "id": "unique-id",
        "source": "Glassdoor|Blind|Indeed|Comparably",
        "sourceIcon": "🟢|🔵|💼",
        "speakerClass": "current-employee|ex-employee|candidate|contractor|intern",
        "proximity": "first-hand|near-first-hand|second-hand",
        "emotionalMode": "burnout|controlled-frustration|shock|defensive-positivity|gratitude|anger|neutral",
        "specificityScore": "high|medium|low",
        "quote": "USE REAL QUOTE",
        "role": "role if known",
        "location": "location if known",
        "date": "USE REAL DATE",
        "sentiment": "positive|negative|neutral|mixed",
        "theme": "topic category",
        "url": "USE REAL URL",
        "rating": null,
        "prosAndCons": { "pros": [], "cons": [] }
      }
    ],
    "emotionalModeBreakdown": [{ "mode": "burnout", "count": 0, "percentage": 0 }],
    "burstDetection": [{ "type": "Review Spike", "period": "when", "interpretation": "why" }],
    "repeatingPatterns": [{ "pattern": "pattern", "frequency": 0, "severity": "low|medium|high" }],
    "managementRiskSignals": ["signal1"],
    "summary": "L3 analysis summary"
  },
  "l4": {
    "discussions": [
      {
        "id": "unique-id",
        "platform": "Reddit|Hacker News",
        "platformIcon": "🟠|🟧",
        "threadTitle": "USE REAL THREAD TITLE",
        "quote": "USE REAL QUOTE",
        "author": "USE REAL USERNAME",
        "date": "USE REAL DATE",
        "upvotes": 0,
        "commentCount": 0,
        "sentiment": "positive|negative|neutral|mixed",
        "confirmationCount": 0,
        "conversationState": "single-vent|multiple-confirmations|cross-thread|structural-problem",
        "theme": "topic",
        "url": "USE REAL URL/PERMALINK — CRITICAL for trust",
        "replies": [{ "author": "name", "quote": "USE REAL REPLY", "sentiment": "neutral", "upvotes": 0 }]
      }
    ],
    "platformBreakdown": [{ "platform": "Reddit", "count": ${realData.reddit.totalFound + realData.redditFree.totalFound}, "icon": "🟠" }, { "platform": "Hacker News", "count": ${realData.hackerNews.totalFound}, "icon": "🟧" }],
    "sentimentSplit": { "positive": 0, "negative": 0, "neutral": 0 },
    "hotTopics": [{ "topic": "topic", "count": 0, "sentiment": "mixed" }],
    "earlyWarnings": ["warning"],
    "summary": "L4 analysis summary"
  },
  "l5": {
    "complaints": [
      {
        "id": "unique-id",
        "platform": "Trustpilot|App Store|G2",
        "platformIcon": "⭐",
        "speakerClass": "end-user|paying-customer|business-client|trial-user|former-customer",
        "issueCategory": "billing|support-failure|product-reliability|misrepresentation|contract-issues|data-privacy|access-issues",
        "quote": "USE REAL QUOTE",
        "author": "USE REAL USERNAME",
        "date": "USE REAL DATE",
        "sentiment": "positive|negative|neutral|mixed",
        "companyResponse": "no-response|template-response|defensive|empathetic-action|public-fix|null",
        "resolutionState": "resolved|acknowledged|ignored|repeated-unresolved",
        "rating": null,
        "url": "USE REAL URL"
      }
    ],
    "issueBreakdown": [{ "category": "billing", "count": 0, "trend": "increasing|stable|decreasing" }],
    "companyResponseAnalysis": [{ "type": "no-response", "count": 0, "percentage": 0 }],
    "overallRating": ${realData.trustpilot?.overallRating || 'null'},
    "totalReviews": ${realData.trustpilot?.totalReviews || 'null'},
    "floodPatterns": [{ "pattern": "pattern", "interpretation": "meaning" }],
    "summary": "L5 analysis summary"
  },
  "l6": {
    "events": [
      {
        "id": "unique-id",
        "category": "layoffs|legal-actions|regulatory|financial-distress|structural-changes|leadership-changes|compliance-failures|public-sanctions|government-actions",
        "icon": "emoji",
        "title": "USE REAL EVENT TITLE",
        "date": "USE REAL DATE",
        "severity": "low|medium|high|critical",
        "source": "USE REAL SOURCE",
        "sourceUrl": "url if available",
        "description": "factual description",
        "confirmationCount": 0,
        "jurisdiction": "if applicable",
        "outcome": "if known"
      }
    ],
    "categoryBreakdown": [{ "category": "layoffs", "count": 0, "icon": "🔴" }],
    "timelineAnalysis": "pattern analysis of events",
    "repeatOffender": false,
    "summary": "L6 analysis summary"
  },
  "narrativeMismatches": [
    {
      "id": "nm-id",
      "icon": "emoji",
      "companyClaims": "What L1 says (specific claim)",
      "realityShows": "What L3/L4/L5/L6 data reveals",
      "sourceLayers": ["L1", "L3"],
      "severity": "low|medium|high|critical",
      "evidence": "specific evidence supporting this mismatch"
    }
  ],
  "crossLayerInsights": [
    {
      "id": "ci-id",
      "title": "insight title",
      "description": "where multiple layers align, confidence is high",
      "supportingLayers": ["L3", "L4", "L6"],
      "confidence": "high|medium|low",
      "riskLevel": "low|medium|high|critical"
    }
  ],
  "patternTimeline": {
    "yearRange": "year range",
    "themes": [{ "name": "theme", "color": "#hex", "layer": "L3", "dataPoints": [{ "year": 2020, "intensity": 50 }] }],
    "events": [{ "year": 2024, "label": "event", "layer": "L6", "severity": "high" }]
  },
  "riskReward": [
    { "icon": "emoji", "label": "factor", "segments": [{ "color": "#hex", "width": 50 }] }
  ],
  "first90Days": {
    "weeks": [{ "id": "period-id", "label": "Period", "description": "what to expect" }],
    "burnoutLevel": "low|medium|high",
    "supportLevel": "low|medium|high"
  },
  "checklist": {
    "items": [{ "id": "item-id", "label": "action item", "checked": false, "sourceLayer": "L3" }],
    "redFlags": [{ "text": "specific concern", "sourceLayer": "L6" }]
  },
  "interviewQuestions": [
    { "id": "cat-id", "label": "Category", "questions": ["question"], "basedOnLayer": "L3" }
  ],
  "youtubeEvidence": {
    "totalVideosFound": ${realData.youtube.totalFound},
    "exEmployeeVideos": 0,
    "interviewExpVideos": 0,
    "dayInLifeVideos": 0,
    "videos": [
      {
        "id": "unique-id",
        "youtubeId": "USE REAL YOUTUBE ID",
        "title": "USE REAL VIDEO TITLE",
        "channel": "USE REAL CHANNEL NAME",
        "channelType": "ex-employee|current-employee|interviewer|career-coach|news|review",
        "publishDate": "USE REAL DATE",
        "viewCount": "USE REAL VIEW COUNT",
        "duration": "USE REAL DURATION",
        "keyTakeaways": ["takeaway"],
        "sentiment": "positive|negative|neutral|mixed",
        "credibilityScore": "high|medium|low",
        "topics": ["topic"],
        "quotableClip": "notable quote if available",
        "timestamps": [{ "time": "2:30", "label": "topic" }],
        "assignedLayer": "L3|L4|L5|L6"
      }
    ],
    "commonThemes": ["theme"],
    "overallSentiment": "mixed"
  },
  "interviewIntelligence": {
    "processLength": "duration",
    "totalStages": 0,
    "difficultyRating": 3,
    "offerRate": "rate",
    "ghostingRisk": "low|medium|high",
    "stages": [
      {
        "id": "stage-id",
        "stage": 1,
        "name": "Stage Name",
        "duration": "30-45 min",
        "type": "phone-screen|technical|behavioral|coding|onsite|panel",
        "icon": "emoji",
        "description": "what happens",
        "tips": ["tip"],
        "commonQuestions": ["question"],
        "difficulty": "easy|medium|hard",
        "interviewerRole": "who conducts"
      }
    ],
    "negotiationTips": ["tip"],
    "redFlagsInProcess": ["warning"],
    "insiderTips": ["tip"],
    "salaryRange": { "min": "amount", "max": "amount", "currency": "USD", "level": "level" },
    "timelineWarning": "any delays"
  },
  "evidenceSources": {
    "totalSources": 0,
    "highCredibilitySources": 0,
    "recentSources": 0,
    "sources": [
      {
        "id": "source-id",
        "type": "review-platform|social-media|news|layoff-tracker|company-site",
        "icon": "emoji",
        "title": "USE REAL TITLE",
        "source": "USE REAL SOURCE",
        "date": "USE REAL DATE",
        "credibility": "high|medium|low",
        "summary": "USE REAL SNIPPET",
        "relevance": "why this matters",
        "layer": "L1|L2|L3|L4|L5|L6"
      }
    ],
    "dataQualityNote": "L1 Master Source Table: ${realData.companySite?.surfacesFound || 0}/${realData.companySite?.surfacesScanned || 0} surfaces scanned${realData.companySite?.companyDomain ? ` at ${realData.companySite.companyDomain}` : ''}, ${realData.companySite?.discoveredSocialAccounts.length || 0} social brand accounts, ${realData.companySite?.detectedATSPlatforms.length || 0} ATS platforms. L2 Master Source Table: ${realData.professionalBehavior?.totalFound || 0} professional behavior signals across ${realData.professionalBehavior?.sourcesSearched.length || 0} sources. Other layers: ${realData.youtube.totalFound} YouTube videos, ${realData.youtubeComments.totalFound} YouTube comments, ${realData.reddit.totalFound + realData.redditFree.totalFound} Reddit posts, ${realData.hackerNews.totalFound} HN discussions, ${realData.glassdoor.totalFound} Glassdoor results, ${realData.blind.totalFound} Blind posts, ${realData.indeed.totalFound} Indeed/Comparably reviews, ${realData.trustpilot ? `Trustpilot ${realData.trustpilot.overallRating}/5 (${realData.trustpilot.totalReviews} reviews)` : 'no Trustpilot data'}, ${realData.news.totalFound} news articles, ${realData.externalConsequences?.layoffs.length || 0} layoff events, and ${realData.externalConsequences?.lawsuits.length || 0} legal records. ${!hasRealData ? 'Real-time API data was unavailable; analysis based on training knowledge.' : 'Analysis grounded in real-time data supplemented by training knowledge.'}",
    "layerCoverage": [
      { "layer": "L1", "name": "Official Narrative", "sourcesAvailable": 0, "confidence": 0 },
      { "layer": "L2", "name": "Professional Behavior", "sourcesAvailable": 0, "confidence": 0 },
      { "layer": "L3", "name": "Employee Leakage", "sourcesAvailable": 0, "confidence": 0 },
      { "layer": "L4", "name": "Community Reality", "sourcesAvailable": 0, "confidence": 0 },
      { "layer": "L5", "name": "Client Fallout", "sourcesAvailable": 0, "confidence": 0 },
      { "layer": "L6", "name": "External Consequences", "sourcesAvailable": 0, "confidence": 0 }
    ]
  }
}

NARRATIVE MISMATCH DETECTION (CRITICAL):
- Compare L1 claims against L3/L4/L5/L6 evidence
- Look for: claimed values vs employee experience, PR messaging vs reality, hiring signals vs layoff data
- L2 provides a UNIQUE middle ground — compare L1 official claims against what employees/leaders say in their own personal posts (L2), then verify with anonymous L3 data
- Example: L1 says "great work-life balance" + L2 LinkedIn posts show leaders posting at midnight + L3 reviews say "no boundaries" = narrative collapse

CROSS-LAYER INSIGHTS:
- When multiple independent layers agree on the same finding, confidence is HIGH
- L2 is the BRIDGE between L1 (company-controlled) and L3 (anonymous) — it shows what real people are willing to say with their NAME attached
- Example: L3 employees say "management doesn't listen" + L4 Reddit confirms + L6 shows CTO departure = structural management issue
- Example: L2 shows recruiter desperation ("DM me, we're hiring ASAP") + L6 layoffs + L3 "revolving door" reviews = retention crisis

CRITICAL REQUIREMENTS:
- USE THE REAL DATA PROVIDED ABOVE as your primary source
- Preserve real youtubeId, URLs, usernames, upvote counts
- Classify each real data point into the correct layer
- Detect narrative mismatches between L1 and deeper layers
- Be honest about data quality — if a layer has no data, set confidence to 0
- Return ONLY valid JSON`
}

// =============================================================================
// POST-PROCESSING — Ensure real data survives AI transformation
// =============================================================================

function enrichWithRealData(aiResponse: string, realData: RealDataBundle): string {
  try {
    const parsed = JSON.parse(aiResponse)

    // ── Ensure real YouTube video IDs are preserved ────────────────
    if (parsed.youtubeEvidence?.videos && realData.youtube.videos.length > 0) {
      const realVideoMap = new Map(
        realData.youtube.videos.map(v => [v.title.toLowerCase().substring(0, 30), v])
      )

      for (const video of parsed.youtubeEvidence.videos) {
        const titleKey = video.title?.toLowerCase().substring(0, 30)
        const realMatch = realVideoMap.get(titleKey)
        if (realMatch) {
          video.youtubeId = realMatch.youtubeId
          video.viewCount = realMatch.viewCount
          video.duration = realMatch.duration
          video.channel = realMatch.channel
          video.publishDate = realMatch.publishDate
        }
      }

      // Add any real videos the AI missed
      const aiVideoIds = new Set(
        parsed.youtubeEvidence.videos
          .filter((v: any) => v.youtubeId)
          .map((v: any) => v.youtubeId)
      )

      for (const realVideo of realData.youtube.videos) {
        if (!aiVideoIds.has(realVideo.youtubeId)) {
          parsed.youtubeEvidence.videos.push({
            id: realVideo.id,
            youtubeId: realVideo.youtubeId,
            title: realVideo.title,
            channel: realVideo.channel,
            channelType: realVideo.channelType,
            publishDate: realVideo.publishDate,
            viewCount: realVideo.viewCount,
            duration: realVideo.duration,
            keyTakeaways: [`Video about ${realData.companyName}`],
            sentiment: 'neutral',
            credibilityScore: realVideo.credibilityScore,
            topics: realVideo.topics,
            quotableClip: '',
            timestamps: [],
            assignedLayer: 'L4',
          })
        }
      }

      parsed.youtubeEvidence.totalVideosFound = parsed.youtubeEvidence.videos.length
    }

    // ── Ensure L4 discussions include all real Reddit + HN data ────
    if (!parsed.l4) parsed.l4 = { discussions: [], platformBreakdown: [], sentimentSplit: { positive: 0, negative: 0, neutral: 0 }, hotTopics: [], earlyWarnings: [], summary: '' }
    if (!parsed.l4.discussions) parsed.l4.discussions = []

    // Merge key-based + free Reddit posts
    const allRedditPosts = [
      ...realData.reddit.posts.map(p => ({
        title: p.title,
        upvotes: p.upvotes,
        commentCount: p.commentCount,
        date: p.date,
        url: p.permalink,
        quote: p.quote || p.title,
        author: p.author || 'Redditor',
        subreddit: p.subreddit,
      })),
      ...realData.redditFree.posts.map(p => ({
        title: p.title,
        upvotes: p.upvotes,
        commentCount: p.commentCount,
        date: p.date,
        url: p.permalink,
        quote: p.quote || p.title,
        author: p.author || 'Redditor',
        subreddit: p.subreddit,
      })),
    ]

    // Fix real Reddit URLs and upvotes in AI-generated L4 discussions
    const realRedditMap = new Map(
      allRedditPosts.map(p => [p.title.toLowerCase().substring(0, 30), p])
    )
    for (const disc of parsed.l4.discussions) {
      if (disc.platform === 'Reddit') {
        const titleKey = disc.threadTitle?.toLowerCase().substring(0, 30)
        const realMatch = titleKey ? realRedditMap.get(titleKey) : undefined
        if (realMatch) {
          disc.upvotes = realMatch.upvotes
          disc.commentCount = realMatch.commentCount
          disc.date = realMatch.date
          if (realMatch.url) disc.url = realMatch.url
        }
      }
    }

    // Inject Reddit posts the AI missed
    const existingRedditTitles = new Set(
      parsed.l4.discussions
        .filter((d: any) => d.platform === 'Reddit')
        .map((d: any) => d.threadTitle?.toLowerCase().substring(0, 30))
    )
    for (const post of allRedditPosts) {
      const key = post.title.toLowerCase().substring(0, 30)
      if (!existingRedditTitles.has(key) && post.url) {
        parsed.l4.discussions.push({
          id: `reddit-injected-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          platform: 'Reddit',
          platformIcon: '🟠',
          threadTitle: post.title,
          quote: post.quote,
          author: post.author,
          date: post.date,
          upvotes: post.upvotes,
          commentCount: post.commentCount,
          sentiment: 'neutral',
          confirmationCount: 0,
          conversationState: 'single-vent',
          theme: 'General',
          url: post.url,
        })
      }
    }

    // Inject HN posts the AI missed
    const existingHNUrls = new Set(
      parsed.l4.discussions
        .filter((d: any) => d.platform === 'Hacker News')
        .map((d: any) => d.url)
    )
    for (const hn of realData.hackerNews.posts) {
      if (!existingHNUrls.has(hn.hnUrl)) {
        parsed.l4.discussions.push({
          id: hn.id,
          platform: 'Hacker News',
          platformIcon: '🟧',
          threadTitle: hn.title,
          quote: hn.quote,
          author: hn.author,
          date: hn.date,
          upvotes: hn.points,
          commentCount: hn.commentCount,
          sentiment: 'neutral',
          confirmationCount: 0,
          conversationState: 'single-vent',
          theme: hn.tags[0] || 'General',
          url: hn.hnUrl,
        })
      }
    }

    // Update L4 platform breakdown
    const l4PlatformCounts: Record<string, { count: number; icon: string }> = {}
    for (const d of parsed.l4.discussions) {
      const p = d.platform || 'Unknown'
      if (!l4PlatformCounts[p]) l4PlatformCounts[p] = { count: 0, icon: d.platformIcon || '💬' }
      l4PlatformCounts[p].count++
    }
    parsed.l4.platformBreakdown = Object.entries(l4PlatformCounts).map(([platform, { count, icon }]) => ({
      platform, count, icon,
    }))

    // ── Ensure L5 complaints include Trustpilot + YouTube comments ──
    if (!parsed.l5) parsed.l5 = { complaints: [], issueBreakdown: [], companyResponseAnalysis: [], floodPatterns: [], summary: '' }
    if (!parsed.l5.complaints) parsed.l5.complaints = []

    // Inject YouTube comments as L5 signals
    if (realData.youtubeComments.comments.length > 0) {
      for (const ytc of realData.youtubeComments.comments) {
        parsed.l5.complaints.push({
          id: ytc.id,
          platform: 'YouTube',
          platformIcon: '📺',
          speakerClass: 'end-user',
          issueCategory: 'product-reliability',
          quote: ytc.text,
          author: ytc.author,
          date: ytc.publishedAt ? new Date(ytc.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'Recent',
          sentiment: 'neutral',
          companyResponse: null,
          resolutionState: 'ignored',
          url: `https://www.youtube.com/watch?v=${ytc.videoId}`,
        })
      }
    }

    // Inject Trustpilot reviews as L5 signals
    if (realData.trustpilot?.reviews.length) {
      const existingTrustpilotIds = new Set(
        parsed.l5.complaints
          .filter((c: any) => c.platform === 'Trustpilot')
          .map((c: any) => c.id)
      )
      for (const tpr of realData.trustpilot.reviews) {
        if (!existingTrustpilotIds.has(tpr.id)) {
          parsed.l5.complaints.push({
            id: tpr.id,
            platform: 'Trustpilot',
            platformIcon: '⭐',
            speakerClass: 'paying-customer',
            issueCategory: 'support-failure',
            quote: `${tpr.title ? tpr.title + ': ' : ''}${tpr.text}`,
            author: tpr.author,
            date: tpr.date,
            sentiment: tpr.rating >= 4 ? 'positive' : tpr.rating <= 2 ? 'negative' : 'neutral',
            companyResponse: 'no-response',
            resolutionState: 'ignored',
            rating: tpr.rating,
            url: `https://www.trustpilot.com/review/${realData.trustpilot!.companySlug}`,
          })
        }
      }

      // Update L5 overall rating
      if (!parsed.l5.overallRating && realData.trustpilot.overallRating) {
        parsed.l5.overallRating = realData.trustpilot.overallRating
      }
      if (!parsed.l5.totalReviews && realData.trustpilot.totalReviews) {
        parsed.l5.totalReviews = realData.trustpilot.totalReviews
      }
    }

    // ── Ensure L6 events include external consequences ──────────────
    if (!parsed.l6) parsed.l6 = { events: [], categoryBreakdown: [], timelineAnalysis: '', repeatOffender: false, summary: '' }
    if (!parsed.l6.events) parsed.l6.events = []

    if (realData.externalConsequences) {
      const existingEventTitles = new Set(
        parsed.l6.events.map((e: any) => e.title?.toLowerCase().substring(0, 30))
      )

      // Inject layoff events
      for (const layoff of realData.externalConsequences.layoffs) {
        const titleKey = layoff.context?.toLowerCase().substring(0, 30)
        if (!existingEventTitles.has(titleKey)) {
          parsed.l6.events.push({
            id: layoff.id || `layoff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            category: 'layoffs',
            icon: '🔴',
            title: `${layoff.company} layoff${layoff.headcount ? ` — ${layoff.headcount} affected` : ''}${layoff.percentage ? ` (${layoff.percentage})` : ''}`,
            date: layoff.date,
            severity: 'high',
            source: layoff.source || 'Public records',
            sourceUrl: layoff.sourceUrl,
            description: layoff.context || 'Layoff event',
            confirmationCount: 1,
          })
        }
      }

      // Inject lawsuit events
      for (const lawsuit of realData.externalConsequences.lawsuits) {
        const titleKey = lawsuit.title?.toLowerCase().substring(0, 30)
        if (!existingEventTitles.has(titleKey)) {
          parsed.l6.events.push({
            id: `lawsuit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            category: 'legal-actions',
            icon: '⚖️',
            title: lawsuit.title,
            date: lawsuit.date,
            severity: 'medium',
            source: 'Legal records',
            sourceUrl: lawsuit.url,
            description: lawsuit.snippet || lawsuit.title,
            confirmationCount: 1,
          })
        }
      }

      // Inject leadership changes
      for (const lc of realData.externalConsequences.leadershipChanges) {
        const eventTitle = `${lc.name} (${lc.role}): ${lc.event}`
        const titleKey = eventTitle.toLowerCase().substring(0, 30)
        if (!existingEventTitles.has(titleKey)) {
          parsed.l6.events.push({
            id: `leadership-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            category: 'leadership-changes',
            icon: '👤',
            title: eventTitle,
            date: lc.date,
            severity: 'medium',
            source: lc.source || 'Public records',
            description: `${lc.name}, ${lc.role} — ${lc.event}`,
            confirmationCount: 1,
          })
        }
      }

      // Update category breakdown
      const l6CatCounts: Record<string, { count: number; icon: string }> = {}
      for (const e of parsed.l6.events) {
        const cat = e.category || 'unknown'
        if (!l6CatCounts[cat]) l6CatCounts[cat] = { count: 0, icon: e.icon || '📌' }
        l6CatCounts[cat].count++
      }
      parsed.l6.categoryBreakdown = Object.entries(l6CatCounts).map(([category, { count, icon }]) => ({
        category, count, icon,
      }))

      // Detect repeat offender
      if (parsed.l6.events.filter((e: any) => e.category === 'layoffs').length >= 2) {
        parsed.l6.repeatOffender = true
      }
    }

    // ── Inject L1 company site data ─────────────────────────────────
    if (realData.companySite && parsed.l1) {
      if (!parsed.l1.companyDomain && realData.companySite.companyDomain) {
        parsed.l1.companyDomain = realData.companySite.companyDomain
      }
    }

    // ── Inject Wikipedia background into company name context ───────
    if (realData.wikipedia) {
      // Add Wikipedia data to evidence sources if not already there
      if (parsed.evidenceSources?.sources) {
        const hasWikipedia = parsed.evidenceSources.sources.some((s: any) =>
          s.source?.toLowerCase().includes('wikipedia')
        )
        if (!hasWikipedia) {
          parsed.evidenceSources.sources.push({
            id: 'wikipedia-bg',
            type: 'encyclopedia',
            icon: '📖',
            title: `Wikipedia: ${realData.companyName}`,
            source: 'Wikipedia',
            date: 'Current',
            credibility: 'medium',
            summary: realData.wikipedia.extract?.substring(0, 200) || 'Company background information.',
            relevance: 'Background context for understanding the company.',
            layer: 'L1',
          })
        }
      }
    }

    // ── Update evidence source counts ──────────────────────────────
    if (parsed.evidenceSources) {
      if (parsed.evidenceSources.sources) {
        parsed.evidenceSources.totalSources = parsed.evidenceSources.sources.length
        parsed.evidenceSources.highCredibilitySources = parsed.evidenceSources.sources.filter(
          (s: any) => s.credibility === 'high'
        ).length
      }

      // Update layer coverage
      if (parsed.evidenceSources.layerCoverage) {
        const layerSourceCounts: Record<string, number> = {}
        if (parsed.evidenceSources.sources) {
          for (const src of parsed.evidenceSources.sources) {
            const layer = src.layer || 'L1'
            layerSourceCounts[layer] = (layerSourceCounts[layer] || 0) + 1
          }
        }
        // Also count actual data points per layer
        layerSourceCounts['L3'] = (layerSourceCounts['L3'] || 0) + (parsed.l3?.reviews?.length || 0)
        layerSourceCounts['L4'] = (layerSourceCounts['L4'] || 0) + (parsed.l4?.discussions?.length || 0)
        layerSourceCounts['L5'] = (layerSourceCounts['L5'] || 0) + (parsed.l5?.complaints?.length || 0)
        layerSourceCounts['L6'] = (layerSourceCounts['L6'] || 0) + (parsed.l6?.events?.length || 0)

        for (const coverage of parsed.evidenceSources.layerCoverage) {
          if (layerSourceCounts[coverage.layer]) {
            coverage.sourcesAvailable = layerSourceCounts[coverage.layer]
          }
        }
      }
    }

    return JSON.stringify(parsed)
  } catch {
    return aiResponse
  }
}
