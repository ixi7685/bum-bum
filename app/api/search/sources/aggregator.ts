/**
 * Data Aggregation Layer
 * 
 * Calls all real data sources across 6 intelligence layers:
 *   L1 — Company website (about, careers, values)
 *   L2 — Professional behavior (LinkedIn personal, Medium, GitHub, podcasts)
 *   L3 — Employee reviews (Glassdoor, Blind, Indeed, Comparably)
 *   L4 — Community (Reddit, Hacker News)
 *   L5 — Client fallout (YouTube videos + comments, Trustpilot)
 *   L6 — External consequences (layoffs, filings, lawsuits, funding)
 *   Background — Wikipedia
 * 
 * All tiers run in parallel. Free sources are always available;
 * key-based sources activate when their env vars are set.
 */

import { fetchYouTubeVideos, fetchYouTubeComments, RealYouTubeVideo, YouTubeComment } from './youtube'
import { fetchRedditPosts, RealRedditResult } from './reddit'
import { fetchRedditRapidApi } from './redditRapidApi'
import { fetchReviews, ReviewSearchResults, RealReviewResult } from './reviews'
import { fetchRedditFree, FreeRedditResult } from './redditFree'
import { fetchHackerNews, HNResult } from './hackerNews'
import { fetchWikipedia, WikiResult } from './wikipedia'
import { fetchCompanySite, CompanySiteResult, PageContent } from './companySite'
import { fetchTrustpilot, TrustpilotResult } from './trustpilot'
import { fetchExternalConsequences, ExternalConsequencesResult } from './externalConsequences'
import { fetchProfessionalBehavior, ProfessionalBehaviorResult } from './professionalBehavior'
import { fetchEmployeeLeakage, EmployeeLeakageResult } from './employeeLeakage'
import { fetchCommunityReality, CommunityRealityResult } from './communityReality'
import { fetchClientFallout, ClientFalloutResult } from './clientFallout'
import { fetchExternalReality, ExternalRealityResult } from './externalReality'
import { fetchReviewsFree } from './reviewsFree'
import { fetchLinkedInFree, LinkedInFreeResult } from './linkedinFree'

export interface RealDataBundle {
  companyName: string
  // L1 — Official Narrative
  companySite: CompanySiteResult | null
  // L2 — Professional Behavior
  professionalBehavior: ProfessionalBehaviorResult | null
  linkedinFree: LinkedInFreeResult | null
  // L3 — Employee Leakage
  glassdoor: { results: RealReviewResult[]; totalFound: number }
  blind: { results: RealReviewResult[]; totalFound: number }
  indeed: { results: RealReviewResult[]; totalFound: number }
  employeeLeakage: EmployeeLeakageResult | null
  // L4 — Community & Peer Reality
  reddit: { posts: RealRedditResult[]; totalFound: number }
  redditRapidApi: { posts: RealRedditResult[]; totalFound: number }
  redditFree: { posts: FreeRedditResult[]; totalFound: number }
  hackerNews: { posts: HNResult[]; totalFound: number }
  communityReality: CommunityRealityResult | null
  // L5 — Client / User Fallout
  youtube: { videos: RealYouTubeVideo[]; totalFound: number }
  youtubeComments: { comments: YouTubeComment[]; totalFound: number }
  trustpilot: TrustpilotResult | null
  clientFallout: ClientFalloutResult | null
  news: { results: RealReviewResult[]; totalFound: number }
  // L6 — External Consequences
  externalConsequences: ExternalConsequencesResult | null
  externalReality: ExternalRealityResult | null
  // Background
  wikipedia: WikiResult | null
  // Combined prompt text
  summary: string
}

/**
 * Format YouTube videos into a text summary for the AI prompt
 */
function formatYouTubeForPrompt(videos: RealYouTubeVideo[]): string {
  if (videos.length === 0) return 'No YouTube videos found.'

  let text = `=== REAL YOUTUBE VIDEOS FOUND (${videos.length}) ===\n`
  for (const v of videos) {
    text += `\n[Video] "${v.title}"
  - Channel: ${v.channel} (${v.channelType})
  - YouTube ID: ${v.youtubeId}
  - Views: ${v.viewCount} | Duration: ${v.duration}
  - Published: ${v.publishDate}
  - Topics: ${v.topics.join(', ')}
  - Description preview: ${v.description.substring(0, 200)}...\n`
  }
  return text
}

/**
 * Format Reddit posts into a text summary for the AI prompt
 */
function formatRedditForPrompt(posts: RealRedditResult[]): string {
  if (posts.length === 0) return 'No Reddit posts found.'

  let text = `=== REAL REDDIT POSTS FOUND (${posts.length}) ===\n`
  for (const p of posts) {
    text += `\n[Reddit - r/${p.subreddit}] "${p.title}"
  - Author: ${p.author} | Upvotes: ${p.upvotes} | Comments: ${p.commentCount}
  - Date: ${p.date}
  - Content: "${p.quote}"
  - URL: ${p.permalink}\n`

    if (p.topReplies.length > 0) {
      text += `  - Top replies:\n`
      for (const r of p.topReplies) {
        text += `    • ${r.author} (${r.upvotes} upvotes): "${r.quote}"\n`
      }
    }
  }
  return text
}

/**
 * Format Glassdoor results into a text summary for the AI prompt
 */
function formatGlassdoorForPrompt(results: RealReviewResult[]): string {
  if (results.length === 0) return 'No Glassdoor reviews found.'

  let text = `=== REAL GLASSDOOR RESULTS FOUND (${results.length}) ===\n`
  for (const r of results) {
    text += `\n[Glassdoor] "${r.title}"
  - Rating: ${r.rating ? `${r.rating}/5` : 'N/A'} | Role: ${r.role || 'N/A'}
  - Date: ${r.date}
  - Snippet: "${r.snippet}"
  - URL: ${r.url}\n`
  }
  return text
}

/**
 * Format Blind results into a text summary for the AI prompt
 */
function formatBlindForPrompt(results: RealReviewResult[]): string {
  if (results.length === 0) return 'No Blind posts found.'

  let text = `=== REAL BLIND POSTS FOUND (${results.length}) ===\n`
  for (const r of results) {
    text += `\n[Blind] "${r.title}"
  - Date: ${r.date}
  - Snippet: "${r.snippet}"
  - URL: ${r.url}\n`
  }
  return text
}

/**
 * Format news results into a text summary for the AI prompt
 */
function formatNewsForPrompt(results: RealReviewResult[]): string {
  if (results.length === 0) return 'No news articles found.'

  let text = `=== REAL NEWS ARTICLES FOUND (${results.length}) ===\n`
  for (const r of results) {
    text += `\n[News - ${r.source}] "${r.title}"
  - Date: ${r.date}
  - Snippet: "${r.snippet}"
  - URL: ${r.url}\n`
  }
  return text
}

/**
 * Format free Reddit results (no-key source) into a text summary
 */
function formatFreeRedditForPrompt(posts: FreeRedditResult[]): string {
  if (posts.length === 0) return ''

  let text = `=== REDDIT PUBLIC POSTS — NO KEY (${posts.length}) ===\n`
  for (const p of posts) {
    text += `\n[Reddit Free - r/${p.subreddit}] "${p.title}"
  - Author: ${p.author} | Upvotes: ${p.upvotes} | Comments: ${p.commentCount}
  - Date: ${p.date}
  - Content: "${p.quote}"
  - URL: ${p.permalink}\n`

    if (p.topReplies && p.topReplies.length > 0) {
      text += `  - Top replies:\n`
      for (const r of p.topReplies) {
        text += `    • ${r.author} (${r.upvotes} upvotes): "${r.quote}"\n`
      }
    }
  }
  return text
}

/**
 * Format Hacker News results into a text summary for the AI prompt
 */
function formatHackerNewsForPrompt(posts: HNResult[]): string {
  if (posts.length === 0) return ''

  let text = `=== HACKER NEWS DISCUSSIONS FOUND (${posts.length}) ===\n`
  for (const p of posts) {
    text += `\n[HN${p.tags.length ? ' — ' + p.tags.join(', ') : ''}] "${p.title}"
  - Author: ${p.author} | Points: ${p.points} | Comments: ${p.commentCount}
  - Date: ${p.date}
  - Quote: "${p.quote}"
  - HN URL: ${p.hnUrl}\n`
  }
  return text
}

/**
 * Format Wikipedia data into a text summary for the AI prompt
 */
function formatWikipediaForPrompt(wiki: WikiResult | null): string {
  if (!wiki) return ''

  let text = `=== WIKIPEDIA COMPANY PROFILE ===\n`
  text += `Title: ${wiki.title}\n`
  if (wiki.description) text += `Description: ${wiki.description}\n`
  text += `Summary: ${wiki.extract}\n`
  if (wiki.keyFacts.length > 0) {
    text += `Key Facts:\n`
    for (const fact of wiki.keyFacts) {
      text += `  • ${fact}\n`
    }
  }
  text += `Source: ${wiki.url}\n`
  return text
}

/**
 * Format L1 — Company website data for hypocrisy detection
 * Covers ALL Master Source Table categories:
 *   A. Core Web Properties | B. Social Brand Accounts | C. Media Channels
 *   D. Hiring Surfaces | E. Product Surfaces | F. Investor Surfaces
 *   G. Legal Surfaces
 */
function formatCompanySiteForPrompt(site: CompanySiteResult | null): string {
  if (!site || !site.companyDomain) return ''

  let text = `=== L1 — OFFICIAL COMPANY NARRATIVE (${site.companyDomain}) ===\n`
  text += `(MASTER SOURCE TABLE — If the company can approve, edit, or delete it → Layer 1)\n`
  text += `(Use this to detect mismatches between what the company claims and what employees report)\n`
  text += `Coverage: ${site.surfacesFound}/${site.surfacesScanned} surfaces scanned\n\n`

  // Helper to format a single page surface
  const fmtPage = (label: string, page: PageContent | null, maxText = 2000) => {
    if (!page) return ''
    let s = `[${label}] ${page.url}\n`
    if (page.title) s += `  Title: ${page.title}\n`
    if (page.headings.length > 0) s += `  Headings: ${page.headings.slice(0, 15).join(' | ')}\n`
    s += `  Content: ${page.text.substring(0, maxText)}\n`
    if (page.keyPhrases.length > 0) s += `  Key claims: ${page.keyPhrases.slice(0, 12).join(' | ')}\n`
    return s + '\n'
  }

  // ── Category A: Core Web Properties ──
  text += '--- Category A: Core Company-Owned Web Properties ---\n'
  text += fmtPage('About / Mission Page', site.aboutPage, 3000)
  text += fmtPage('Careers Page', site.careersPage, 3000)
  text += fmtPage('Vision / Values Page', site.visionValuesPage, 2500)
  text += fmtPage('Culture / Life Page', site.culturePage, 2500)
  text += fmtPage('Benefits Page', site.benefitsPage, 2500)
  text += fmtPage('DEI / ESG Page', site.deiEsgPage, 2000)
  text += fmtPage('Sustainability Page', site.sustainabilityPage, 2000)
  text += fmtPage('Blog', site.blogPage, 1500)
  text += fmtPage('Newsroom / Press', site.pressPage, 2000)
  text += fmtPage('Case Studies', site.caseStudiesPage, 1500)
  text += fmtPage('Testimonials', site.testimonialsPage, 1500)
  text += fmtPage('Customer Stories', site.customerStoriesPage, 1500)
  text += fmtPage('Partners', site.partnersPage, 1500)
  text += fmtPage('Pricing', site.pricingPage, 1500)
  text += fmtPage('Product / Features', site.productFeaturesPage, 1500)
  text += fmtPage('Roadmap', site.roadmapPage, 1200)
  text += fmtPage('Status Page', site.statusPage, 800)
  text += fmtPage('Trust / Security', site.trustSecurityPage, 2000)
  text += fmtPage('Compliance', site.compliancePage, 2000)

  // ── Category E: Product Surfaces ──
  if (site.docsPage || site.apiDocsPage || site.developerPortalPage || site.changelogPage || site.releaseNotesPage) {
    text += '--- Category E: Official Product Surfaces ---\n'
    text += fmtPage('Documentation', site.docsPage, 1200)
    text += fmtPage('API Docs', site.apiDocsPage, 1200)
    text += fmtPage('Developer Portal', site.developerPortalPage, 1200)
    text += fmtPage('Changelog', site.changelogPage, 1200)
    text += fmtPage('Release Notes', site.releaseNotesPage, 1200)
  }

  // ── Category F: Investor Surfaces ──
  if (site.investorRelationsPage) {
    text += '--- Category F: Investor / Financial Messaging ---\n'
    text += fmtPage('Investor Relations', site.investorRelationsPage)
  }

  // ── Category G: Legal Surfaces ──
  const hasLegal = site.termsPage || site.privacyPage || site.cookiePolicyPage ||
    site.refundPolicyPage || site.codeOfConductPage || site.ethicsPolicyPage || site.whistleblowerPage
  if (hasLegal) {
    text += '--- Category G: Legal, Compliance & Risk Messaging ---\n'
    text += fmtPage('Terms of Service', site.termsPage, 1500)
    text += fmtPage('Privacy Policy', site.privacyPage, 1500)
    text += fmtPage('Cookie Policy', site.cookiePolicyPage, 800)
    text += fmtPage('Refund / Cancellation Policy', site.refundPolicyPage, 1200)
    text += fmtPage('Code of Conduct', site.codeOfConductPage, 1200)
    text += fmtPage('Ethics Policy', site.ethicsPolicyPage, 1200)
    text += fmtPage('Whistleblower Policy', site.whistleblowerPage, 1200)
  }

  // ── Category B: Social Brand Accounts ──
  if (site.discoveredSocialAccounts.length > 0) {
    text += '--- Category B: Official Social Media Brand Accounts ---\n'
    for (const acc of site.discoveredSocialAccounts) {
      text += `  • ${acc.platform}: @${acc.handle} — ${acc.url}\n`
    }
    text += '(Note: company brand account = L1. Comments under it ≠ L1)\n\n'
  }

  // ── Category D: ATS / Hiring Platforms ──
  if (site.detectedATSPlatforms.length > 0) {
    text += '--- Category D: Hiring & Talent Surfaces ---\n'
    for (const ats of site.detectedATSPlatforms) {
      text += `  • ${ats.platform}: ${ats.url}\n`
    }
    text += '(Note: the job posting is L1. The platform itself is NOT.)\n\n'
  }

  // ── Aggregated Intelligence ──
  if (site.claimedValues.length > 0) {
    text += `CLAIMED VALUES & PROMISES (extracted from all L1 surfaces):\n`
    for (const v of site.claimedValues) {
      text += `  • "${v}"\n`
    }
    text += '\n'
  }

  if (site.benefitsClaims.length > 0) {
    text += `BENEFITS CLAIMS:\n`
    for (const b of site.benefitsClaims) {
      text += `  • "${b}"\n`
    }
    text += '\n'
  }

  if (site.cultureKeywords.length > 0) {
    text += `CULTURE KEYWORDS DETECTED: ${site.cultureKeywords.join(', ')}\n`
  }

  if (site.jobPostings.length > 0) {
    text += `JOB POSTINGS FOUND (${site.jobPostings.length}):\n`
    for (const j of site.jobPostings.slice(0, 10)) {
      text += `  • ${j.title} — ${j.location}\n`
    }
  }

  return text
}

/**
 * Format YouTube comments for the AI prompt
 */
function formatYouTubeCommentsForPrompt(comments: YouTubeComment[]): string {
  if (comments.length === 0) return ''

  let text = `=== YOUTUBE COMMENTS FOUND (${comments.length}) ===\n`
  text += `(Direct user feedback — L5 Client/User Fallout signal)\n\n`
  for (const c of comments) {
    text += `[YT Comment] by ${c.author} (${c.likeCount} likes, ${c.replyCount} replies)\n`
    text += `  Date: ${c.publishedAt}\n`
    text += `  Text: "${c.text}"\n`
    if (c.topReplies.length > 0) {
      for (const r of c.topReplies) {
        text += `    ↳ ${r.author} (${r.likeCount} likes): "${r.text}"\n`
      }
    }
    text += '\n'
  }
  return text
}

/**
 * Format Trustpilot data for the AI prompt
 */
function formatTrustpilotForPrompt(tp: TrustpilotResult | null): string {
  if (!tp) return ''

  let text = `=== TRUSTPILOT REVIEWS (${tp.companySlug}) ===\n`
  text += `(L5 — How the company treats customers predicts how it treats staff)\n\n`
  text += `Overall Rating: ${tp.overallRating ? `${tp.overallRating}/5` : 'N/A'}\n`
  text += `Total Reviews: ${tp.totalReviews || 'Unknown'}\n`
  if (tp.responseRate) text += `Response Rate: ${tp.responseRate}\n`
  text += `Claimed Profile: ${tp.claimed ? 'Yes' : 'No'}\n\n`

  if (tp.reviews.length > 0) {
    text += `RECENT REVIEWS:\n`
    for (const r of tp.reviews) {
      text += `  [${r.rating}/5] "${r.title}"\n`
      text += `    by ${r.author} — ${r.date}\n`
      text += `    "${r.text.substring(0, 300)}"\n`
      if (r.hasReply && r.replyText) {
        text += `    ↳ Company reply: "${r.replyText.substring(0, 200)}"\n`
      }
      text += '\n'
    }
  }

  return text
}

/**
 * Format Indeed/Comparably results for the AI prompt
 */
function formatIndeedForPrompt(results: RealReviewResult[]): string {
  if (results.length === 0) return ''

  let text = `=== INDEED + COMPARABLY REVIEWS FOUND (${results.length}) ===\n`
  for (const r of results) {
    text += `\n[${r.source}] "${r.title}"\n`
    text += `  Rating: ${r.rating ? `${r.rating}/5` : 'N/A'} | Role: ${r.role || 'N/A'}\n`
    text += `  Date: ${r.date}\n`
    text += `  Snippet: "${r.snippet}"\n`
    text += `  URL: ${r.url}\n`
  }
  return text
}

/**
 * Format L3 — Employee & Candidate Leakage (expanded master source table).
 * Covers categories A-G: global reviews, regional platforms, interview XP,
 * exit narratives, anonymous communities, first-hand Q&A, edge cases.
 */
function formatEmployeeLeakageForPrompt(el: EmployeeLeakageResult | null): string {
  if (!el || el.totalFound === 0) return ''

  const catLabels: Record<string, string> = {
    'A-employer-reviews': 'A. Global Employer Reviews (Kununu, OpenWork, Joberty, HelloWork, RateMyEmployer, Vault)',
    'B-regional-platforms': 'B. Regional Platforms (Duunitori, Oikotie, CV.ee, MeetFrank, Pracuj.pl, Profesia, 51Job, Zhaopin, AmbitionBox, Naukri)',
    'C-interview-experience': 'C. Interview Experience (Glassdoor-Interviews, Indeed-Interviews, LeetCode, Reddit, Blogs, Career Forums)',
    'D-exit-narratives': 'D. Exit Narratives ("Why I Left", Resignation Letters)',
    'E-anonymous-communities': 'E. Anonymous Communities (Fishbowl, Blind Deep, Levels.fyi, TheLayoff)',
    'F-qa-forums-firsthand': 'F. Q&A / Forums — First-Hand Only (Reddit, Quora, SO Meta, HN)',
    'G-edge-cases': 'G. Edge Cases (Whistleblower, Labor Complaints, Lawsuits, Memo Leaks, Union Statements)',
  }

  let text = `=== L3 — EMPLOYEE & CANDIDATE LEAKAGE — EXPANDED (${el.totalFound} signals) ===\n`
  text += `(Master Source Table: internal reality leaks — what it feels like to work inside or try to get in)\n`
  text += `Sources searched: ${el.sourcesSearched.join(', ')}\n\n`

  // Category breakdown
  const activeCats = Object.entries(el.categoryBreakdown).filter(([, v]) => v > 0)
  if (activeCats.length > 0) {
    text += 'L3 Category Coverage:\n'
    for (const [cat, count] of activeCats) {
      text += `  ${catLabels[cat] || cat}: ${count} signals\n`
    }
    text += '\n'
  }

  // Region breakdown (key for regional platforms)
  const activeRegions = Object.entries(el.regionBreakdown).filter(([, v]) => v > 0)
  if (activeRegions.length > 1) {
    text += 'Regional Coverage: '
    text += activeRegions.map(([r, c]) => `${r}(${c})`).join(', ')
    text += '\n\n'
  }

  // Emotional mode breakdown (pattern detection)
  const activeEmotions = Object.entries(el.emotionalBreakdown)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
  if (activeEmotions.length > 0) {
    text += 'Emotional Mode Distribution: '
    text += activeEmotions.map(([e, c]) => `${e}(${c})`).join(', ')
    text += '\n\n'
  }

  // All signals grouped by category
  for (const [cat, label] of Object.entries(catLabels)) {
    const catSignals = el.signals.filter(s => s.category === cat)
    if (catSignals.length === 0) continue

    text += `--- ${label} ---\n`
    for (const sig of catSignals.slice(0, 15)) {
      text += `[L3 ${sig.platform}${sig.region !== 'Global' ? ` (${sig.region})` : ''}] ${sig.signalType}\n`
      text += `  Speaker: ${sig.speakerClass} | Emotional: ${sig.emotionalMode} | Proximity: ${sig.proximity}\n`
      text += `  Title: "${sig.title}"\n`
      text += `  Snippet: "${sig.snippet.substring(0, 400)}"\n`
      if (sig.rating) text += `  Rating: ${sig.rating}/5\n`
      if (sig.role) text += `  Role: ${sig.role}\n`
      text += `  What it leaks: ${sig.whatItLeaks}\n`
      text += `  Date: ${sig.date}\n`
      if (sig.url) text += `  URL: ${sig.url}\n`
      text += '\n'
    }
  }

  return text
}

/**
 * Format L4 — Community & Peer Reality (expanded master source table).
 * Covers categories A-H: public discussion, social threads, video comments,
 * forums, public chat, Q&A/complaint, regional communities, edge cases.
 */
function formatCommunityRealityForPrompt(cr: CommunityRealityResult | null): string {
  if (!cr || cr.totalFound === 0) return ''

  const catLabels: Record<string, string> = {
    'A-public-discussion': 'A. Public Discussion (Quora, StackOverflow, Slashdot, Lobsters)',
    'B-social-threads': 'B. Social Media Threads (X, Threads, TikTok, Instagram, Facebook, Mastodon, Bluesky)',
    'C-video-comments': 'C. Video Comments (YouTube Community, TikTok, Twitch, Vimeo)',
    'D-forums': 'D. Forums — Long Memory (Industry, Tech, Startup, Finance, Gaming, Crypto)',
    'E-public-chat': 'E. Public Chat (Discord, Telegram, Matrix)',
    'F-qa-complaint': 'F. Q&A & Complaint Boards (Consumer Advice, Scam Reports, Legal Advice)',
    'G-regional-communities': 'G. Regional Communities (V2EX, Zhihu, 2ch/5ch, PTT, Ekşi, Pikabu, HWZone)',
    'H-edge-cases': 'H. Edge Cases (News Comments, GitHub User Issues, Memes, Screenshots)',
  }

  let text = `=== L4 — COMMUNITY & PEER REALITY — EXPANDED (${cr.totalFound} signals) ===\n`
  text += `(Collective perception in motion. One comment = nothing. Recurring conversation = everything.)\n`
  text += `Sources searched: ${cr.sourcesSearched.join(', ')}\n\n`

  // Category breakdown
  const activeCats = Object.entries(cr.categoryBreakdown).filter(([, v]) => v > 0)
  if (activeCats.length > 0) {
    text += 'L4 Category Coverage:\n'
    for (const [cat, count] of activeCats) {
      text += `  ${catLabels[cat] || cat}: ${count} signals\n`
    }
    text += '\n'
  }

  // Signal strength breakdown (noise vs chorus)
  const strengths = Object.entries(cr.signalStrengthBreakdown)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
  if (strengths.length > 0) {
    text += 'Signal Strength Distribution: '
    text += strengths.map(([s, c]) => `${s}(${c})`).join(', ')
    text += '\n\n'
  }

  // Region breakdown
  const activeRegions = Object.entries(cr.regionBreakdown).filter(([, v]) => v > 0)
  if (activeRegions.length > 1) {
    text += 'Regional Coverage: '
    text += activeRegions.map(([r, c]) => `${r}(${c})`).join(', ')
    text += '\n\n'
  }

  // All signals grouped by category
  for (const [cat, label] of Object.entries(catLabels)) {
    const catSignals = cr.signals.filter(s => s.category === cat)
    if (catSignals.length === 0) continue

    text += `--- ${label} ---\n`
    for (const sig of catSignals.slice(0, 12)) {
      text += `[L4 ${sig.platform}${sig.region !== 'Global' ? ` (${sig.region})` : ''}] ${sig.signalType}\n`
      text += `  Strength: ${sig.signalStrength} | Engagement: ${sig.engagement}\n`
      text += `  Title: "${sig.title}"\n`
      text += `  Snippet: "${sig.snippet.substring(0, 400)}"\n`
      text += `  What it reveals: ${sig.whatItReveals}\n`
      text += `  Date: ${sig.date}\n`
      if (sig.url) text += `  URL: ${sig.url}\n`
      text += '\n'
    }
  }

  return text
}

/**
 * Format L5 — Client / User Fallout (expanded master source table).
 * Covers categories A-I: consumer reviews, B2B/SaaS, app stores,
 * social support, video fallout, support forums, scam boards,
 * regional platforms, edge cases.
 */
function formatClientFalloutForPrompt(cf: ClientFalloutResult | null): string {
  if (!cf || cf.totalFound === 0) return ''

  const catLabels: Record<string, string> = {
    'A-consumer-reviews': 'A. Consumer Reviews (Yelp, Google, Facebook, SiteJabber, ConsumerAffairs, PissedConsumer)',
    'B-b2b-saas': 'B. B2B / SaaS Reviews (G2, Capterra, GetApp, TrustRadius, Software Advice)',
    'C-app-marketplaces': 'C. App Marketplaces (App Store, Google Play, Huawei, Samsung)',
    'D-social-support': 'D. Social Support & Complaints (X, Instagram, Facebook, LinkedIn)',
    'E-video-fallout': 'E. Video & Influencer Fallout (YouTube, TikTok, Twitch)',
    'F-support-forums': 'F. Support Forums & Bug Trackers',
    'G-complaint-scam': 'G. Complaint & Scam Boards (ScamAdviser, Ripoff Report, Consumer Protection)',
    'H-regional-consumer': 'H. Regional Consumer Platforms (EU, LATAM, RU, CZ, SG)',
    'I-edge-cases': 'I. Edge Cases (Reddit/Quora customers, chargebacks, app review replies)',
  }

  let text = `=== L5 — CLIENT / USER FALLOUT — EXPANDED (${cf.totalFound} signals) ===\n`
  text += `(Where promises meet reality. How the company behaves when users are affected & money is involved.)\n`
  text += `Sources searched: ${cf.sourcesSearched.join(', ')}\n\n`

  // Category breakdown
  const activeCats = Object.entries(cf.categoryBreakdown).filter(([, v]) => v > 0)
  if (activeCats.length > 0) {
    text += 'L5 Category Coverage:\n'
    for (const [cat, count] of activeCats) {
      text += `  ${catLabels[cat] || cat}: ${count} signals\n`
    }
    text += '\n'
  }

  // Issue breakdown (what kinds of failures)
  const activeIssues = Object.entries(cf.issueBreakdown)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
  if (activeIssues.length > 0) {
    text += 'Issue Distribution: '
    text += activeIssues.map(([i, c]) => `${i}(${c})`).join(', ')
    text += '\n\n'
  }

  // Company response pattern (critical signal)
  const activeResponses = Object.entries(cf.responseBreakdown)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
  if (activeResponses.length > 0) {
    text += 'Company Response Pattern: '
    text += activeResponses.map(([r, c]) => `${r}(${c})`).join(', ')
    text += '\n(⚠ Silence or template replies = risk multiplier)\n\n'
  }

  // Region breakdown
  const activeRegions = Object.entries(cf.regionBreakdown).filter(([, v]) => v > 0)
  if (activeRegions.length > 1) {
    text += 'Regional Coverage: '
    text += activeRegions.map(([r, c]) => `${r}(${c})`).join(', ')
    text += '\n\n'
  }

  // All signals grouped by category
  for (const [cat, label] of Object.entries(catLabels)) {
    const catSignals = cf.signals.filter(s => s.category === cat)
    if (catSignals.length === 0) continue

    text += `--- ${label} ---\n`
    for (const sig of catSignals.slice(0, 12)) {
      text += `[L5 ${sig.platform}${sig.region !== 'Global' ? ` (${sig.region})` : ''}] ${sig.signalType}\n`
      text += `  Speaker: ${sig.speakerClass} | Issue: ${sig.issueCategory} | Response: ${sig.companyResponse} | Resolution: ${sig.resolutionState}\n`
      text += `  Title: "${sig.title}"\n`
      text += `  Snippet: "${sig.snippet.substring(0, 400)}"\n`
      if (sig.rating) text += `  Rating: ${sig.rating}/5\n`
      text += `  What it reveals: ${sig.whatItReveals}\n`
      text += `  Date: ${sig.date}\n`
      if (sig.url) text += `  URL: ${sig.url}\n`
      text += '\n'
    }
  }

  return text
}

/**
 * Format L6 — External consequences data
 */
function formatExternalConsequencesForPrompt(ec: ExternalConsequencesResult | null): string {
  if (!ec) return ''

  const parts: string[] = []

  if (ec.layoffs.length > 0) {
    let text = `=== LAYOFF EVENTS FOUND (${ec.layoffs.length}) ===\n`
    text += `(L6 — External Consequences / Hard Evidence)\n\n`
    for (const e of ec.layoffs) {
      text += `[Layoff] ${e.date}\n`
      if (e.headcount) text += `  Headcount: ${e.headcount} affected\n`
      if (e.percentage) text += `  Percentage: ${e.percentage} of workforce\n`
      text += `  Source: ${e.source}\n`
      text += `  Context: "${e.context}"\n`
      text += `  URL: ${e.sourceUrl}\n\n`
    }
    parts.push(text)
  }

  if (ec.leadershipChanges.length > 0) {
    let text = `=== LEADERSHIP CHANGES FOUND (${ec.leadershipChanges.length}) ===\n`
    for (const c of ec.leadershipChanges) {
      text += `  [${c.event}] ${c.role} — ${c.date}\n`
      text += `  Source: ${c.source}\n\n`
    }
    parts.push(text)
  }

  if (ec.lawsuits.length > 0) {
    let text = `=== LAWSUITS / LEGAL ISSUES FOUND (${ec.lawsuits.length}) ===\n`
    for (const l of ec.lawsuits) {
      text += `  "${l.title}" — ${l.date}\n`
      text += `  ${l.snippet}\n`
      text += `  URL: ${l.url}\n\n`
    }
    parts.push(text)
  }

  if (ec.fundingEvents.length > 0) {
    let text = `=== FUNDING EVENTS (${ec.fundingEvents.length}) ===\n`
    for (const f of ec.fundingEvents) {
      text += `  ${f.round}: ${f.amount} — ${f.date}\n`
      text += `  Source: ${f.source}\n\n`
    }
    parts.push(text)
  }

  if (ec.filings.length > 0) {
    let text = `=== SEC FILINGS (${ec.filings.length}) ===\n`
    for (const f of ec.filings) {
      text += `  [${f.type}] ${f.title} — ${f.date}\n`
      text += `  URL: ${f.url}\n\n`
    }
    parts.push(text)
  }

  return parts.join('\n')
}

/**
 * Format L6 — External Reality, Notarized (expanded master source table).
 * Covers categories A-J: layoffs, legal, regulatory, financial distress,
 * corporate registry, breaches/sanctions, leadership, journalism,
 * government blacklists, edge cases.
 */
function formatExternalRealityForPrompt(er: ExternalRealityResult | null): string {
  if (!er || er.totalFound === 0) return ''

  const catLabels: Record<string, string> = {
    'A-layoffs': 'A. Layoffs & Workforce Reductions (WARN Act, Labor Offices, Union, Hiring Freezes)',
    'B-legal-actions': 'B. Legal Actions (Civil, Criminal, Labor Courts, Class Actions, Settlements, Verdicts)',
    'C-regulatory': 'C. Regulatory & Government Actions (SEC, FCA, GDPR, Antitrust, Consumer Protection, AML)',
    'D-financial-distress': 'D. Financial Distress (Bankruptcy, Insolvency, Debt Default, Going Concern, Credit Downgrade)',
    'E-corporate-registry': 'E. Corporate Registry (Business Registries, Shareholders, Directors, Dissolutions, M&A)',
    'F-breaches-sanctions': 'F. Data Breaches & Sanctions (Breach Disclosures, Sanctions Lists, Government Advisories)',
    'G-leadership-governance': 'G. Leadership & Governance Shocks (CEO/CFO Departures, Board, Forced Removals, Interim, Founder Exits)',
    'H-investigative-journalism': 'H. Investigative Journalism (Reuters, FT, AP, Bloomberg, WSJ)',
    'I-government-blacklists': 'I. Government Blacklists & Bans (Trade, App Store, Banking, Export, Procurement)',
    'J-edge-cases': 'J. Edge Cases (Auditor Reports, EU Infringement, International Sanctions, Court Settlements, Gazettes)',
  }

  let text = `=== L6 — EXTERNAL REALITY, NOTARIZED — EXPANDED (${er.totalFound} signals) ===\n`
  text += `(Reality, notarized. What actually happened when institutions, laws, markets, or governments intervened.)\n`
  text += `Sources searched: ${er.sourcesSearched.join(', ')}\n\n`

  // Severity breakdown (critical intelligence)
  const activeSeverity = Object.entries(er.severityBreakdown)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => {
      const order = ['terminal', 'critical', 'serious', 'warning', 'informational']
      return order.indexOf(a) - order.indexOf(b)
    })
  if (activeSeverity.length > 0) {
    text += '⚠ SEVERITY DISTRIBUTION: '
    text += activeSeverity.map(([s, c]) => `${s.toUpperCase()}(${c})`).join(', ')
    text += '\n\n'
  }

  // Category breakdown
  const activeCats = Object.entries(er.categoryBreakdown).filter(([, v]) => v > 0)
  if (activeCats.length > 0) {
    text += 'L6 Category Coverage:\n'
    for (const [cat, count] of activeCats) {
      text += `  ${catLabels[cat] || cat}: ${count} signals\n`
    }
    text += '\n'
  }

  // All signals grouped by category
  for (const [cat, label] of Object.entries(catLabels)) {
    const catSignals = er.signals.filter(s => s.category === cat)
    if (catSignals.length === 0) continue

    text += `--- ${label} ---\n`
    for (const sig of catSignals.slice(0, 12)) {
      text += `[L6 ${sig.platform}] ${sig.signalType} — SEVERITY: ${sig.severity.toUpperCase()}\n`
      text += `  Status: ${sig.status} | Citable: ${sig.canBeCitedIndependently ? 'yes' : 'no'}\n`
      if (sig.authority) text += `  Authority: ${sig.authority}\n`
      if (sig.jurisdiction) text += `  Jurisdiction: ${sig.jurisdiction}\n`
      if (sig.amount) text += `  Amount/Impact: ${sig.amount}\n`
      text += `  Title: "${sig.title}"\n`
      text += `  Snippet: "${sig.snippet.substring(0, 400)}"\n`
      text += `  What it proves: ${sig.whatItProves}\n`
      text += `  Date: ${sig.date}\n`
      if (sig.url) text += `  URL: ${sig.url}\n`
      text += '\n'
    }
  }

  return text
}

/**
 * Format L2 — Professional behavior signals for AI prompt.
 * Covers all Master Source Table categories A-H.
 */
function formatProfessionalBehaviorForPrompt(pb: ProfessionalBehaviorResult | null): string {
  if (!pb || pb.totalFound === 0) return ''

  let text = `=== L2 — PROFESSIONAL BEHAVIOR SIGNALS (${pb.totalFound} found) ===\n`
  text += `(Human-in-public layer: how people tied to the company behave when reputations are on the line)\n`
  text += `Sources searched: ${pb.sourcesSearched.join(', ')}\n\n`

  // Category breakdown
  const catLabels: Record<string, string> = {
    'A-professional-social': 'A. Professional Social Networks',
    'B-microblogging': 'B. Microblogging & Short-Form',
    'C-long-form': 'C. Long-Form Writing',
    'D-podcast-interview': 'D. Podcasts & Interviews',
    'E-dev-technical': 'E. Developer & Technical',
    'F-hiring-recruiting': 'F. Hiring & Recruiting',
    'G-professional-community': 'G. Professional Communities',
    'H-edge-case': 'H. Edge Cases',
  }
  const activeCats = Object.entries(pb.categoryBreakdown).filter(([, v]) => v > 0)
  if (activeCats.length > 0) {
    text += 'Category Coverage:\n'
    for (const [cat, count] of activeCats) {
      text += `  ${catLabels[cat] || cat}: ${count} signals\n`
    }
    text += '\n'
  }

  // Platform breakdown
  if (Object.keys(pb.platformBreakdown).length > 0) {
    text += 'Platform Breakdown: '
    text += Object.entries(pb.platformBreakdown).map(([p, c]) => `${p}(${c})`).join(', ')
    text += '\n\n'
  }

  // General signals (Categories A-D, F-H)
  for (const sig of pb.signals.slice(0, 25)) {
    text += `[L2 ${sig.category}] ${sig.platform} — ${sig.signalType || 'signal'}\n`
    text += `  Speaker: ${sig.speakerClass} | Tone: ${sig.tone} | Proximity: ${sig.proximity}\n`
    text += `  Title: "${sig.title}"\n`
    text += `  Snippet: "${sig.snippet.substring(0, 400)}"\n`
    if (sig.author) text += `  Author: ${sig.author}\n`
    text += `  Date: ${sig.date}\n`
    if (sig.url) text += `  URL: ${sig.url}\n`
    text += '\n'
  }

  // Dev signals (Category E)
  if (pb.devSignals.length > 0) {
    text += '--- Category E: Developer & Technical Professional Surfaces ---\n'
    for (const dev of pb.devSignals.slice(0, 15)) {
      text += `[L2-Dev] ${dev.platform} — ${dev.type}\n`
      text += `  Title: "${dev.title}"\n`
      text += `  Snippet: "${dev.snippet.substring(0, 400)}"\n`
      text += `  Author: ${dev.author} | Reactions: ${dev.reactions} | Comments: ${dev.comments}\n`
      text += `  Date: ${dev.date}\n`
      if (dev.url) text += `  URL: ${dev.url}\n`
      text += '\n'
    }
  }

  return text
}

/**
 * Format free LinkedIn signals for the AI prompt (L2 — Professional Behavior).
 * These come from Google scraping LinkedIn posts/articles about the company.
 */
function formatLinkedInFreeForPrompt(li: LinkedInFreeResult | null): string {
  if (!li || li.totalFound === 0) return ''

  let text = `=== L2 — LINKEDIN SIGNALS (FREE — ${li.totalFound} found) ===\n`
  text += `(Google-scraped LinkedIn posts, articles, and profiles mentioning the company)\n`
  text += `Sources searched: ${li.sourcesSearched.join(', ')}\n\n`

  for (const sig of li.signals.slice(0, 30)) {
    text += `[L2 ${sig.category}] ${sig.platform} — ${sig.signalType || 'signal'}\n`
    text += `  Speaker: ${sig.speakerClass} | Tone: ${sig.tone} | Proximity: ${sig.proximity}\n`
    text += `  Title: "${sig.title}"\n`
    text += `  Snippet: "${sig.snippet.substring(0, 400)}"\n`
    if (sig.author) text += `  Author: ${sig.author}\n`
    text += `  Date: ${sig.date}\n`
    if (sig.url) text += `  URL: ${sig.url}\n`
    text += '\n'
  }

  return text
}

/**
 * Main entry: Fetch all real data about a company and bundle it.
 * 
 * All layers run in parallel. Any source that fails is silently
 * skipped — the report still generates from whatever data is available.
 */
export async function fetchAllRealData(companyName: string): Promise<RealDataBundle> {
  // Run ALL data sources in parallel across all 6 layers
  const [
    youtube,
    reddit,
    redditRapidApiData,
    reviewData,
    redditFreeData,
    hackerNewsData,
    wikipediaData,
    companySiteData,
    trustpilotData,
    externalData,
    profBehaviorData,
    employeeLeakageData,
    communityRealityData,
    clientFalloutData,
    externalRealityData,
    reviewsFreeData,
    linkedinFreeData,
  ] = await Promise.allSettled([
    // L5 — YouTube videos
    fetchYouTubeVideos(companyName),
    // L4 — Reddit (OAuth)
    fetchRedditPosts(companyName),
    // L4 — Reddit (RapidAPI — Reddit34, no OAuth needed)
    fetchRedditRapidApi(companyName),
    // L3 — Employee reviews (Glassdoor, Blind, Indeed, Comparably, News)
    fetchReviews(companyName),
    // L4 — Reddit (free)
    fetchRedditFree(companyName),
    // L4 — Hacker News
    fetchHackerNews(companyName),
    // Background
    fetchWikipedia(companyName),
    // L1 — Company website
    fetchCompanySite(companyName),
    // L5 — Trustpilot
    fetchTrustpilot(companyName),
    // L6 — External consequences
    fetchExternalConsequences(companyName),
    // L2 — Professional behavior
    fetchProfessionalBehavior(companyName),
    // L3 — Employee & Candidate Leakage (expanded master source table)
    fetchEmployeeLeakage(companyName),
    // L4 — Community & Peer Reality (expanded master source table)
    fetchCommunityReality(companyName),
    // L5 — Client / User Fallout (expanded master source table)
    fetchClientFallout(companyName),
    // L6 — External Reality (expanded master source table)
    fetchExternalReality(companyName),
    // L3 — Reviews (free Google scrape — no SerpAPI key needed)
    fetchReviewsFree(companyName),
    // L2 — LinkedIn signals (free Google scrape — no API key needed)
    fetchLinkedInFree(companyName),
  ])

  const youtubeVideos = youtube.status === 'fulfilled' ? youtube.value : []
  const redditOAuthPosts = reddit.status === 'fulfilled' ? reddit.value : []
  const redditRapidPosts = redditRapidApiData.status === 'fulfilled' ? redditRapidApiData.value : []

  // Merge Reddit sources: RapidAPI (primary) + OAuth (fallback), deduplicated by title
  const seenRedditTitles = new Set<string>()
  const redditPosts: RealRedditResult[] = []
  for (const post of [...redditRapidPosts, ...redditOAuthPosts]) {
    const key = post.title?.toLowerCase().trim()
    if (key && !seenRedditTitles.has(key)) {
      seenRedditTitles.add(key)
      redditPosts.push(post)
    }
  }

  let reviews: ReviewSearchResults = reviewData.status === 'fulfilled'
    ? reviewData.value
    : { glassdoorResults: [], blindResults: [], indeedResults: [], newsResults: [] }
  const freeRedditPosts = redditFreeData.status === 'fulfilled' ? redditFreeData.value : []
  const hnPosts = hackerNewsData.status === 'fulfilled' ? hackerNewsData.value : []
  const wiki = wikipediaData.status === 'fulfilled' ? wikipediaData.value : null
  const companySite = companySiteData.status === 'fulfilled' ? companySiteData.value : null
  const trustpilot = trustpilotData.status === 'fulfilled' ? trustpilotData.value : null
  const externalConsequences = externalData.status === 'fulfilled' ? externalData.value : null
  const professionalBehavior = profBehaviorData.status === 'fulfilled' ? profBehaviorData.value : null
  const employeeLeakage = employeeLeakageData.status === 'fulfilled' ? employeeLeakageData.value : null
  const communityReality = communityRealityData.status === 'fulfilled' ? communityRealityData.value : null
  const clientFallout = clientFalloutData.status === 'fulfilled' ? clientFalloutData.value : null
  const externalReality = externalRealityData.status === 'fulfilled' ? externalRealityData.value : null
  const linkedinFree = linkedinFreeData.status === 'fulfilled' ? linkedinFreeData.value : null

  // Merge free review results into SerpAPI reviews (deduplicate by URL)
  const freeReviews: ReviewSearchResults = reviewsFreeData.status === 'fulfilled'
    ? reviewsFreeData.value
    : { glassdoorResults: [], blindResults: [], indeedResults: [], newsResults: [] }

  const seenReviewUrls = new Set<string>()
  const mergeReviews = (serpResults: RealReviewResult[], freeResults: RealReviewResult[]): RealReviewResult[] => {
    const merged: RealReviewResult[] = []
    for (const r of [...serpResults, ...freeResults]) {
      const key = r.url?.toLowerCase().trim()
      if (key && !seenReviewUrls.has(key)) {
        seenReviewUrls.add(key)
        merged.push(r)
      } else if (!key) {
        merged.push(r) // keep results without URLs
      }
    }
    return merged
  }
  reviews.glassdoorResults = mergeReviews(reviews.glassdoorResults, freeReviews.glassdoorResults)
  reviews.blindResults = mergeReviews(reviews.blindResults, freeReviews.blindResults)
  reviews.indeedResults = mergeReviews(reviews.indeedResults, freeReviews.indeedResults)
  reviews.newsResults = mergeReviews(reviews.newsResults, freeReviews.newsResults)

  // Fetch YouTube comments after we have video IDs (sequential, same API key)
  let ytComments: YouTubeComment[] = []
  if (youtubeVideos.length > 0) {
    try {
      ytComments = await fetchYouTubeComments(
        companyName,
        youtubeVideos.map(v => v.youtubeId)
      )
    } catch {
      // Comments are bonus — don't fail the whole pipeline
    }
  }

  // Build the text summary for the AI prompt
  const parts = [
    formatCompanySiteForPrompt(companySite),
    formatProfessionalBehaviorForPrompt(professionalBehavior),
    formatLinkedInFreeForPrompt(linkedinFree),
    formatWikipediaForPrompt(wiki),
    formatYouTubeForPrompt(youtubeVideos),
    formatYouTubeCommentsForPrompt(ytComments),
    formatRedditForPrompt(redditPosts),
    formatFreeRedditForPrompt(freeRedditPosts),
    formatHackerNewsForPrompt(hnPosts),
    formatCommunityRealityForPrompt(communityReality),
    formatGlassdoorForPrompt(reviews.glassdoorResults),
    formatBlindForPrompt(reviews.blindResults),
    formatIndeedForPrompt(reviews.indeedResults),
    formatEmployeeLeakageForPrompt(employeeLeakage),
    formatTrustpilotForPrompt(trustpilot),
    formatClientFalloutForPrompt(clientFallout),
    formatNewsForPrompt(reviews.newsResults),
    formatExternalConsequencesForPrompt(externalConsequences),
    formatExternalRealityForPrompt(externalReality),
  ].filter(Boolean)

  const summary = parts.join('\n\n')

  return {
    companyName,
    companySite,
    professionalBehavior,
    linkedinFree,
    youtube: { videos: youtubeVideos, totalFound: youtubeVideos.length },
    youtubeComments: { comments: ytComments, totalFound: ytComments.length },
    reddit: { posts: redditPosts, totalFound: redditPosts.length },
    redditRapidApi: { posts: redditRapidPosts, totalFound: redditRapidPosts.length },
    redditFree: { posts: freeRedditPosts, totalFound: freeRedditPosts.length },
    hackerNews: { posts: hnPosts, totalFound: hnPosts.length },
    communityReality,
    wikipedia: wiki,
    glassdoor: { results: reviews.glassdoorResults, totalFound: reviews.glassdoorResults.length },
    blind: { results: reviews.blindResults, totalFound: reviews.blindResults.length },
    indeed: { results: reviews.indeedResults, totalFound: reviews.indeedResults.length },
    employeeLeakage,
    trustpilot,
    clientFallout,
    news: { results: reviews.newsResults, totalFound: reviews.newsResults.length },
    externalConsequences,
    externalReality,
    summary,
  }
}
