/**
 * L3 — Employee & Candidate Leakage (EXHAUSTIVE Master Source Table)
 *
 * Layer 3 is where internal reality leaks.
 * It captures what it feels like to work inside the company or try to get in.
 * It is emotionally charged, noisy alone, and brutally accurate in patterns.
 *
 * QUALIFICATION TEST (LOCKED):
 *   1. Is the speaker describing lived employment or hiring experience?
 *   2. Is the content public and not company-controlled?
 *   If YES to both → Layer 3.
 *   Anonymous but experiential → still L3.
 *   Observational only → L4.  Professional behavior only → L2.
 *   Customer experience → L5.
 *
 * Categories (from L3 Master Source Table):
 *   A. Employer Review Platforms (Global Core)
 *   B. Regional & Country-Specific Employer Platforms
 *   C. Interview Experience–Specific Platforms
 *   D. Exit Narratives & "Why I Left" Content
 *   E. Anonymous / Semi-Anonymous Professional Communities
 *   F. Q&A / Forum Content (Upgraded to L3 when first-hand)
 *   G. Edge-Case but Valid Layer 3 Sources
 *
 * H. What NEVER belongs in Layer 3:
 *   - Company job descriptions → L1
 *   - Recruiter marketing posts → L2
 *   - Community rumors → L4
 *   - Yelp / Trustpilot → L5
 *   - News articles → L6
 *   - Analyst reports → L6
 *   - Anonymous non-work gossip → L4
 *
 * Data source: SerpAPI Google search (all platforms lack open APIs).
 */

// ════════════════════════════════════════════════════════════════════
// PUBLIC TYPES
// ════════════════════════════════════════════════════════════════════

export type L3SourceCategory =
  | 'A-employer-reviews'
  | 'B-regional-platforms'
  | 'C-interview-experience'
  | 'D-exit-narratives'
  | 'E-anonymous-communities'
  | 'F-qa-forums-firsthand'
  | 'G-edge-cases'

export type L3SpeakerClass =
  | 'current-employee'
  | 'ex-employee'
  | 'candidate'
  | 'contractor'
  | 'intern'
  | 'anonymous-employee'
  | 'union-member'
  | 'whistleblower'

export type L3Proximity =
  | 'first-hand'
  | 'near-first-hand'
  | 'second-hand'

export type L3EmotionalMode =
  | 'burnout'
  | 'controlled-frustration'
  | 'shock'
  | 'defensive-positivity'
  | 'gratitude'
  | 'anger'
  | 'neutral'
  | 'resignation'
  | 'relief'
  | 'bitterness'
  | 'hope'

export interface L3Signal {
  category: L3SourceCategory
  platform: string
  region: string                 // 'global' | 'DACH' | 'Japan' | 'Balkans' | etc.
  title: string
  snippet: string
  url: string
  author: string
  date: string
  speakerClass: L3SpeakerClass
  proximity: L3Proximity
  emotionalMode: L3EmotionalMode
  signalType: string             // e.g. 'review', 'interview-report', 'exit-essay', 'whistleblower-letter'
  rating?: number
  role?: string
  whatItLeaks: string            // Human-readable description of the intelligence signal
}

export interface EmployeeLeakageResult {
  signals: L3Signal[]
  categoryBreakdown: Record<L3SourceCategory, number>
  platformBreakdown: Record<string, number>
  regionBreakdown: Record<string, number>
  emotionalBreakdown: Record<string, number>
  totalFound: number
  sourcesSearched: string[]
}

// ════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ════════════════════════════════════════════════════════════════════
// INFERENCE HELPERS
// ════════════════════════════════════════════════════════════════════

function inferSpeakerClass(text: string, title: string): L3SpeakerClass {
  const combined = `${title} ${text}`.toLowerCase()
  if (/\b(whistleblow|speak up|report concern|exposed|unethical)\b/i.test(combined)) return 'whistleblower'
  if (/\b(union|collective|bargaining|organized labor|workers united)\b/i.test(combined)) return 'union-member'
  if (/\b(intern|internship|summer associate|co-?op student|placement)\b/i.test(combined)) return 'intern'
  if (/\b(contractor|contract worker|freelance|consultant at|staffing)\b/i.test(combined)) return 'contractor'
  if (/\b(interview|applied|application|hiring process|recruiter|offer letter|phone screen|onsite|assessment|rejected|ghosted)\b/i.test(combined)) return 'candidate'
  if (/\b(former|ex-|previously at|used to work|my time at|left the company|after leaving|i quit|i resigned|departed|why i left)\b/i.test(combined)) return 'ex-employee'
  if (/\b(currently|i work at|working at|here at|our team|my role at|still at)\b/i.test(combined)) return 'current-employee'
  return 'anonymous-employee'
}

function inferEmotionalMode(text: string): L3EmotionalMode {
  const lower = text.toLowerCase()
  if (/\b(burnout|burned out|exhausted|overworked|toxic|mental health|breakdown|sleep|anxiety|stress)\b/i.test(lower)) return 'burnout'
  if (/\b(angry|furious|outraged|disgusting|worst|terrible|trash|garbage|scam|fraud|illegal)\b/i.test(lower)) return 'anger'
  if (/\b(shocked|can.t believe|unbelievable|blindsided|sudden|overnight|out of nowhere)\b/i.test(lower)) return 'shock'
  if (/\b(great place|love it|amazing|best company|wouldn.t change|highly recommend|dream job|wonderful)\b/i.test(lower)) return 'defensive-positivity'
  if (/\b(grateful|thankful|appreciate|blessed|lucky|opportunity|learned a lot)\b/i.test(lower)) return 'gratitude'
  if (/\b(frustrated|disappointing|not what|expected|promised|misleading|underwhelm)\b/i.test(lower)) return 'controlled-frustration'
  if (/\b(finally left|relieved|glad i left|weight off|free from|escaped)\b/i.test(lower)) return 'relief'
  if (/\b(resign|resigned|stepping down|moved on|chapter closed|farewell)\b/i.test(lower)) return 'resignation'
  if (/\b(bitter|resentful|betrayed|used|exploited|taken advantage|discarded)\b/i.test(lower)) return 'bitterness'
  if (/\b(hope|improving|getting better|potential|optimistic|turnaround)\b/i.test(lower)) return 'hope'
  return 'neutral'
}

function inferProximity(text: string): L3Proximity {
  const lower = text.toLowerCase()
  if (/\b(i worked|i was|my experience|i personally|i interviewed|i applied|i saw|i quit|i left|my manager|my team|i joined)\b/i.test(lower)) return 'first-hand'
  if (/\b(my friend|my spouse|someone i know|colleague told|heard from inside|partner works)\b/i.test(lower)) return 'near-first-hand'
  return 'first-hand' // Default to first-hand for L3 (qualification test: lived experience)
}

function inferSignalType(text: string, title: string, category: L3SourceCategory): string {
  const combined = `${title} ${text}`.toLowerCase()

  if (category === 'C-interview-experience') {
    if (/ghost|no response|never heard/i.test(combined)) return 'ghosting-report'
    if (/leetcode|coding challenge|technical screen|algorithm/i.test(combined)) return 'technical-interview'
    if (/offer|compensation|salary|negotiate/i.test(combined)) return 'offer-experience'
    return 'interview-report'
  }
  if (category === 'D-exit-narratives') {
    if (/burnout|mental health|overwork/i.test(combined)) return 'burnout-exit'
    if (/leadership|management|ceo|cto|founder/i.test(combined)) return 'leadership-failure-exit'
    if (/culture|values|toxic/i.test(combined)) return 'culture-exit'
    if (/layoff|laid off|rif|restructur/i.test(combined)) return 'layoff-narrative'
    return 'exit-essay'
  }
  if (category === 'G-edge-cases') {
    if (/whistleblow|ethics|unethical|fraud/i.test(combined)) return 'whistleblower-letter'
    if (/lawsuit|sued|legal action|court|settlement/i.test(combined)) return 'employee-lawsuit-narrative'
    if (/labor complaint|labor board|nlrb|osha|eeoc/i.test(combined)) return 'labor-complaint'
    if (/union|collective|organize|bargain/i.test(combined)) return 'union-statement'
    if (/leaked|internal memo|internal email|slack leak|all-hands/i.test(combined)) return 'internal-memo-leak'
    if (/company response|employer response|official reply/i.test(combined)) return 'company-defensive-response'
    return 'edge-case-signal'
  }
  if (/review|rating|star|recommend/i.test(combined)) return 'employee-review'
  if (/culture|management|leadership/i.test(combined)) return 'culture-leak'
  if (/salary|pay|compensation|bonus/i.test(combined)) return 'compensation-leak'
  if (/layoff|fired|let go|rif/i.test(combined)) return 'layoff-signal'
  return 'general-leak'
}

function inferWhatItLeaks(platform: string, signalType: string, category: L3SourceCategory): string {
  const leakMap: Record<string, string> = {
    'Glassdoor': 'Culture, management, layoffs',
    'Indeed': 'Interviews, churn',
    'Blind': 'Raw internal truth',
    'Comparably': 'Pay & culture framing',
    'Kununu': 'DACH employee sentiment',
    'OpenWork': 'Japan-specific culture',
    'Joberty': 'Balkans tech truth',
    'HelloWork': 'France employer reality',
    'RateMyEmployer': 'Smaller market signals',
    'Vault': 'Consulting/finance culture',
    'Duunitori': 'Finland local honesty',
    'Oikotie': 'Finland hiring churn',
    'CV.ee': 'Estonia small-market leaks',
    'MeetFrank': 'Baltic candidate experience',
    'Pracuj.pl': 'Poland large market truth',
    'Profesia': 'CEE regional signals',
    '51Job': 'China local labor reality',
    'Zhaopin': 'Chinese employer truth',
    'AmbitionBox': 'India tech reality',
    'Naukri': 'India interview experience',
    'LeetCode': 'Engineering hiring reality',
    'Fishbowl': 'Consulting/legal truth',
    'Quora': 'Explicit work experience',
    'StackOverflow Meta': 'Work conditions',
  }

  if (leakMap[platform]) return leakMap[platform]

  const categoryLeakMap: Record<string, string> = {
    'C-interview-experience': 'Candidate experience & process chaos',
    'D-exit-narratives': 'Why people leave — structural decay signals',
    'E-anonymous-communities': 'Anonymous truth, needs pattern confirmation',
    'F-qa-forums-firsthand': 'First-hand employee experience (upgraded from L4)',
    'G-edge-cases': 'Internal ethics, escalation, raw truth',
  }

  return categoryLeakMap[category] || 'Internal reality leak'
}

// ════════════════════════════════════════════════════════════════════
// SEARCH (SerpAPI removed)
// ════════════════════════════════════════════════════════════════════

async function serpSearch(
  _query: string,
  _numResults = 10,
): Promise<{ title: string; snippet: string; link: string; date?: string }[]> {
  return []
}

/** Parse a rating out of a snippet (e.g. "3.8 out of 5", "4.2★") */
function extractRating(snippet: string): number | undefined {
  const m = snippet.match(/(\d\.?\d?)\s*(?:out of 5|★|stars?|\/5)/i)
  if (m) {
    const r = parseFloat(m[1])
    return r <= 5 ? r : undefined
  }
  return undefined
}

/** Build L3Signal from a raw SerpAPI result */
function toSignal(
  r: { title: string; snippet: string; link: string; date?: string },
  category: L3SourceCategory,
  platform: string,
  region: string,
  index: number,
): L3Signal {
  const signalType = inferSignalType(r.snippet, r.title, category)
  return {
    category,
    platform,
    region,
    title: cleanText(r.title),
    snippet: cleanText(r.snippet),
    url: r.link,
    author: `${platform} User`,
    date: r.date || 'Recent',
    speakerClass: inferSpeakerClass(r.snippet, r.title),
    proximity: inferProximity(r.snippet),
    emotionalMode: inferEmotionalMode(r.snippet),
    signalType,
    rating: extractRating(r.snippet),
    whatItLeaks: inferWhatItLeaks(platform, signalType, category),
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim()
}

function deduplicateSignals(signals: L3Signal[]): L3Signal[] {
  const seen = new Set<string>()
  return signals.filter((s) => {
    const key = s.url.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ════════════════════════════════════════════════════════════════════
// A. EMPLOYER REVIEW PLATFORMS (GLOBAL CORE)
//    Structured platforms explicitly designed for employee/candidate XP
// ════════════════════════════════════════════════════════════════════

async function searchGlobalEmployerReviews(companyName: string): Promise<L3Signal[]> {
  const signals: L3Signal[] = []
  const cn = companyName

  // Kununu — DACH employee sentiment
  // OpenWork — Japan-specific culture
  // Joberty — Balkans tech truth
  // HelloWork — France
  // RateMyEmployer — Smaller markets
  // Vault — Consulting/finance
  // (Glassdoor, Indeed, Blind, Comparably already covered in reviews.ts)
  const queries: { q: string; platform: string; region: string }[] = [
    { q: `site:kununu.com "${cn}" reviews`, platform: 'Kununu', region: 'DACH' },
    { q: `site:vorkers.com OR site:openwork.jp "${cn}" OR "${cn}"`, platform: 'OpenWork', region: 'Japan' },
    { q: `site:joberty.rs OR site:joberty.com "${cn}" reviews`, platform: 'Joberty', region: 'Balkans' },
    { q: `site:hellowork.com "${cn}" avis reviews employeur`, platform: 'HelloWork', region: 'France' },
    { q: `site:ratemyemployer.ca OR site:ratemyemployer.com "${cn}"`, platform: 'RateMyEmployer', region: 'Global' },
    { q: `site:vault.com "${cn}" reviews rankings employer`, platform: 'Vault', region: 'Global' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 6)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, region } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'A-employer-reviews', platform, region, signals.length))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// B. REGIONAL & COUNTRY-SPECIFIC EMPLOYER PLATFORMS
//    These matter more than global platforms in many countries.
// ════════════════════════════════════════════════════════════════════

async function searchRegionalPlatforms(companyName: string): Promise<L3Signal[]> {
  const signals: L3Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; region: string }[] = [
    // Finland
    { q: `site:duunitori.fi "${cn}" arvostelut reviews`, platform: 'Duunitori', region: 'Finland' },
    { q: `site:oikotie.fi "${cn}" työpaikat työnantaja`, platform: 'Oikotie', region: 'Finland' },
    // Estonia
    { q: `site:cv.ee "${cn}" reviews employer`, platform: 'CV.ee', region: 'Estonia' },
    // Baltics
    { q: `site:meetfrank.com "${cn}" reviews salary`, platform: 'MeetFrank', region: 'Baltics' },
    // Poland
    { q: `site:pracuj.pl "${cn}" opinie reviews pracodawca`, platform: 'Pracuj.pl', region: 'Poland' },
    // CEE
    { q: `site:profesia.sk OR site:profesia.cz "${cn}" reviews`, platform: 'Profesia', region: 'CEE' },
    // China
    { q: `site:51job.com "${cn}" reviews employer`, platform: '51Job', region: 'China' },
    { q: `site:zhaopin.com "${cn}" reviews employer`, platform: 'Zhaopin', region: 'China' },
    // India
    { q: `site:ambitionbox.com "${cn}" reviews salary culture`, platform: 'AmbitionBox', region: 'India' },
    { q: `site:naukri.com "${cn}" reviews interview experience`, platform: 'Naukri', region: 'India' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 5)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, region } = queries[i]
    for (const r of settled.value) {
      signals.push(toSignal(r, 'B-regional-platforms', platform, region, signals.length))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// C. INTERVIEW EXPERIENCE–SPECIFIC PLATFORMS
//    Pure candidate leakage — extremely predictive.
//    Upgrade to L3 only if first-hand experience is explicit.
// ════════════════════════════════════════════════════════════════════

async function searchInterviewExperience(companyName: string): Promise<L3Signal[]> {
  const signals: L3Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string }[] = [
    // Glassdoor interview section
    { q: `site:glassdoor.com "${cn}" interview questions experience process`, platform: 'Glassdoor Interviews' },
    // Indeed interview reviews
    { q: `site:indeed.com "${cn}" interview questions experience`, platform: 'Indeed Interviews' },
    // LeetCode Discuss — engineering hiring reality
    { q: `site:leetcode.com/discuss "${cn}" interview OR onsite OR phone screen OR OA`, platform: 'LeetCode' },
    // Reddit interview threads (first-hand)
    { q: `site:reddit.com "${cn}" interview experience "I applied" OR "I interviewed" OR "they ghosted" OR "offer"`, platform: 'Reddit Interviews' },
    // Personal "Interview at X" blog posts
    { q: `"interview at ${cn}" OR "my ${cn} interview" blog experience -site:glassdoor.com -site:indeed.com -site:reddit.com`, platform: 'Personal Blog (Interview)' },
    // University career forums
    { q: `"${cn}" interview experience site:reddit.com/r/cscareerquestions OR site:reddit.com/r/jobs OR site:reddit.com/r/recruitinghell OR site:levels.fyi`, platform: 'Career Forums' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 8)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'C-interview-experience', platform, 'Global', signals.length)
      // Force candidate speaker class for interview-specific platforms
      if (sig.speakerClass === 'anonymous-employee') sig.speakerClass = 'candidate'
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// D. EXIT NARRATIVES & "WHY I LEFT" CONTENT
//    Long-form, high-signal, emotionally honest.
//    If it describes lived work, it's L3 — even if posted on LinkedIn.
// ════════════════════════════════════════════════════════════════════

async function searchExitNarratives(companyName: string): Promise<L3Signal[]> {
  const signals: L3Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string }[] = [
    // Medium "Why I left X"
    { q: `site:medium.com "why i left ${cn}" OR "leaving ${cn}" OR "i quit ${cn}" OR "my time at ${cn}"`, platform: 'Medium (Exit)' },
    // Substack exit essays
    { q: `site:substack.com "why i left ${cn}" OR "leaving ${cn}" OR "quit ${cn}" OR "my experience at ${cn}"`, platform: 'Substack (Exit)' },
    // Personal blogs (employment exit)
    { q: `"why i left ${cn}" OR "i quit ${cn}" OR "leaving ${cn}" blog -site:medium.com -site:substack.com -site:linkedin.com`, platform: 'Personal Blog (Exit)' },
    // LinkedIn long-form exit posts
    { q: `site:linkedin.com "why i left ${cn}" OR "leaving ${cn}" OR "farewell ${cn}" OR "last day at ${cn}" OR "next chapter"`, platform: 'LinkedIn (Exit)' },
    // Public resignation letters
    { q: `"${cn}" "resignation letter" OR "public resignation" OR "I am resigning" OR "stepping down"`, platform: 'Public Resignation' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 6)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'D-exit-narratives', platform, 'Global', signals.length)
      // Exit narratives are almost always ex-employees
      if (sig.speakerClass === 'anonymous-employee') sig.speakerClass = 'ex-employee'
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// E. ANONYMOUS / SEMI-ANONYMOUS PROFESSIONAL COMMUNITIES
//    Strong truth, needs pattern confirmation.
//    Anonymous ≠ Layer 4 if the topic is employment experience.
// ════════════════════════════════════════════════════════════════════

async function searchAnonymousCommunities(companyName: string): Promise<L3Signal[]> {
  const signals: L3Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string; region: string }[] = [
    // Fishbowl — consulting / legal
    { q: `site:fishbowlapp.com "${cn}" OR "at ${cn}" work culture`, platform: 'Fishbowl', region: 'Global' },
    // TeamBlind country variants (already searching teamblind.com in reviews.ts,
    // but here we look for regional variants & deeper threads)
    { q: `site:teamblind.com "${cn}" culture OR layoff OR toxic OR compensation OR wlb`, platform: 'Blind (Deep)', region: 'Global' },
    // Tech-specific anonymous boards — Levels.fyi
    { q: `site:levels.fyi "${cn}" reviews OR compensation OR culture`, platform: 'Levels.fyi', region: 'Global' },
    // TheLayoff.com — anonymous layoff discussions
    { q: `site:thelayoff.com "${cn}"`, platform: 'TheLayoff', region: 'Global' },
    // Glassdoor forums (beyond simple reviews)
    { q: `site:glassdoor.com "${cn}" "company response" OR "employer response"`, platform: 'Glassdoor (Company Response)', region: 'Global' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 6)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform, region } = queries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'E-anonymous-communities', platform, region, signals.length)
      if (sig.speakerClass === 'anonymous-employee' || sig.speakerClass === 'current-employee') {
        sig.speakerClass = 'anonymous-employee'
      }
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// F. Q&A / FORUM CONTENT (UPGRADED TO L3 WHEN FIRST-HAND)
//    Default is L4. Upgrade to L3 only with explicit lived experience.
// ════════════════════════════════════════════════════════════════════

async function searchQAForumsFirstHand(companyName: string): Promise<L3Signal[]> {
  const signals: L3Signal[] = []
  const cn = companyName

  const queries: { q: string; platform: string }[] = [
    // Reddit — first-hand employee threads
    { q: `site:reddit.com "${cn}" "I worked" OR "I work at" OR "my experience" OR "i was laid off" OR "i quit" OR "i left"`, platform: 'Reddit (First-Hand)' },
    // Quora — explicit work experience
    { q: `site:quora.com "working at ${cn}" OR "work at ${cn}" OR "experience at ${cn}" OR "left ${cn}"`, platform: 'Quora' },
    // StackOverflow Meta — work conditions
    { q: `site:meta.stackoverflow.com OR site:meta.stackexchange.com "${cn}" working OR culture OR employees`, platform: 'StackOverflow Meta' },
    // Hacker News — "I worked there" comments
    { q: `site:news.ycombinator.com "${cn}" "I worked" OR "I work at" OR "my experience at" OR "was laid off from"`, platform: 'HN (First-Hand)' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 8)),
  )

  // First-hand filter: we only include results where the snippet
  // explicitly contains first-person employment language.
  const firstHandPattern = /\b(i work|i worked|my experience|i applied|i interviewed|i was|i quit|i left|i got|my team|my manager|i joined|they fired|they laid|i started|i resigned)\b/i

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { platform } = queries[i]
    for (const r of settled.value) {
      // Only upgrade to L3 if first-hand language detected
      if (!firstHandPattern.test(r.snippet) && !firstHandPattern.test(r.title)) continue
      signals.push(toSignal(r, 'F-qa-forums-firsthand', platform, 'Global', signals.length))
    }
  }

  return deduplicateSignals(signals)
}

// ════════════════════════════════════════════════════════════════════
// G. EDGE-CASE BUT VALID LAYER 3 SOURCES (PEOPLE MISS THESE)
// ════════════════════════════════════════════════════════════════════

async function searchEdgeCaseSources(companyName: string): Promise<L3Signal[]> {
  const signals: L3Signal[] = []
  const cn = companyName

  const queries: { q: string; signalType: string }[] = [
    // Public whistleblower letters — internal ethics
    { q: `"${cn}" whistleblower OR "ethics complaint" OR "unethical" OR "fraud" employee OR former`, signalType: 'whistleblower-letter' },
    // Public labor complaints (named) — escalation
    { q: `"${cn}" "labor complaint" OR "NLRB" OR "EEOC" OR "OSHA" OR "labor board" OR "wage theft" OR "unfair labor"`, signalType: 'labor-complaint' },
    // Lawsuit narratives by employees — pre-Layer 6 (employee-filed, not outcome)
    { q: `"${cn}" employee lawsuit OR "sued by employee" OR "discrimination suit" OR "wrongful termination" OR "class action" employee`, signalType: 'employee-lawsuit-narrative' },
    // Internal memo leaks (public) — raw truth
    { q: `"${cn}" "internal memo" OR "leaked email" OR "leaked slack" OR "all-hands" leaked OR internal email`, signalType: 'internal-memo-leak' },
    // Union statements (employment-focused) — collective reality
    { q: `"${cn}" union OR "workers union" OR "collective bargaining" OR "organized" OR "unionize" employees`, signalType: 'union-statement' },
    // Glassdoor "company response" text — defensive posture
    { q: `site:glassdoor.com "${cn}" "employer response" OR "employer's response" OR "thank you for your feedback"`, signalType: 'company-defensive-response' },
  ]

  const results = await Promise.allSettled(
    queries.map(({ q }) => serpSearch(q, 6)),
  )

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    if (settled.status !== 'fulfilled') continue
    const { signalType } = queries[i]
    for (const r of settled.value) {
      const sig = toSignal(r, 'G-edge-cases', inferEdgePlatform(r.link), 'Global', signals.length)
      sig.signalType = signalType
      sig.whatItLeaks = inferEdgeCaseLeakage(signalType)
      signals.push(sig)
    }
  }

  return deduplicateSignals(signals)
}

function inferEdgePlatform(url: string): string {
  if (url.includes('glassdoor')) return 'Glassdoor (Company Response)'
  if (url.includes('nlrb.gov')) return 'NLRB'
  if (url.includes('eeoc.gov')) return 'EEOC'
  if (url.includes('osha.gov')) return 'OSHA'
  if (url.includes('reddit.com')) return 'Reddit'
  if (url.includes('news.ycombinator')) return 'Hacker News'
  if (url.includes('medium.com')) return 'Medium'
  if (url.includes('substack.com')) return 'Substack'
  if (url.includes('linkedin.com')) return 'LinkedIn'
  if (url.includes('vice.com') || url.includes('theverge') || url.includes('techcrunch')) return 'Tech Media'
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return 'Web'
  }
}

function inferEdgeCaseLeakage(signalType: string): string {
  const map: Record<string, string> = {
    'whistleblower-letter': 'Internal ethics violations',
    'labor-complaint': 'Escalation — formal complaint filed',
    'employee-lawsuit-narrative': 'Pre-Layer 6 — employee legal action',
    'internal-memo-leak': 'Raw truth from inside',
    'union-statement': 'Collective reality — organized response',
    'company-defensive-response': 'Defensive posture — what they fear',
  }
  return map[signalType] || 'Edge-case internal reality'
}

// ════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ════════════════════════════════════════════════════════════════════

/**
 * Fetch ALL L3 Employee & Candidate Leakage signals.
 * Runs all 7 categories (A–G) in parallel.
 *
 * NOTE: This supplements reviews.ts (which covers Glassdoor, Blind,
 * Indeed, Comparably core results). This file adds the remaining
 * ~40+ sources from the L3 Master Source Table.
 */
export async function fetchEmployeeLeakage(
  companyName: string,
): Promise<EmployeeLeakageResult> {
  const sourcesSearched: string[] = []

  // Run ALL L3 categories in parallel
  const [
    globalReviews,
    regionalPlatforms,
    interviewExperience,
    exitNarratives,
    anonymousCommunities,
    qaForums,
    edgeCases,
  ] = await Promise.allSettled([
    searchGlobalEmployerReviews(companyName),
    searchRegionalPlatforms(companyName),
    searchInterviewExperience(companyName),
    searchExitNarratives(companyName),
    searchAnonymousCommunities(companyName),
    searchQAForumsFirstHand(companyName),
    searchEdgeCaseSources(companyName),
  ])

  const allSignals: L3Signal[] = []

  const collect = (settled: PromiseSettledResult<L3Signal[]>, source: string) => {
    sourcesSearched.push(source)
    if (settled.status === 'fulfilled') {
      allSignals.push(...settled.value)
    }
  }

  collect(globalReviews, 'Kununu/OpenWork/Joberty/HelloWork/RateMyEmployer/Vault (SerpAPI)')
  collect(regionalPlatforms, 'Duunitori/Oikotie/CV.ee/MeetFrank/Pracuj.pl/Profesia/51Job/Zhaopin/AmbitionBox/Naukri (SerpAPI)')
  collect(interviewExperience, 'Glassdoor-Interviews/Indeed-Interviews/LeetCode/Reddit-Interviews/Career-Blogs/Career-Forums (SerpAPI)')
  collect(exitNarratives, 'Medium-Exit/Substack-Exit/PersonalBlog-Exit/LinkedIn-Exit/PublicResignation (SerpAPI)')
  collect(anonymousCommunities, 'Fishbowl/Blind-Deep/Levels.fyi/TheLayoff/Glassdoor-CompanyResponse (SerpAPI)')
  collect(qaForums, 'Reddit-FirstHand/Quora/StackOverflowMeta/HN-FirstHand (SerpAPI)')
  collect(edgeCases, 'Whistleblower/NLRB/EEOC/EmployeeLawsuits/MemoLeaks/UnionStatements (SerpAPI)')

  // Deduplicate across all categories
  const dedupedSignals = deduplicateSignals(allSignals)

  // Build breakdowns
  const categoryBreakdown: Record<L3SourceCategory, number> = {
    'A-employer-reviews': 0,
    'B-regional-platforms': 0,
    'C-interview-experience': 0,
    'D-exit-narratives': 0,
    'E-anonymous-communities': 0,
    'F-qa-forums-firsthand': 0,
    'G-edge-cases': 0,
  }
  const platformBreakdown: Record<string, number> = {}
  const regionBreakdown: Record<string, number> = {}
  const emotionalBreakdown: Record<string, number> = {}

  for (const s of dedupedSignals) {
    categoryBreakdown[s.category] = (categoryBreakdown[s.category] || 0) + 1
    platformBreakdown[s.platform] = (platformBreakdown[s.platform] || 0) + 1
    regionBreakdown[s.region] = (regionBreakdown[s.region] || 0) + 1
    emotionalBreakdown[s.emotionalMode] = (emotionalBreakdown[s.emotionalMode] || 0) + 1
  }

  console.log(
    `[EmployeeLeakage] L3 scan complete: ${dedupedSignals.length} signals found across ${Object.keys(platformBreakdown).length} platforms. ` +
      `Categories: ${Object.entries(categoryBreakdown).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')}`,
  )

  return {
    signals: dedupedSignals,
    categoryBreakdown,
    platformBreakdown,
    regionBreakdown,
    emotionalBreakdown,
    totalFound: dedupedSignals.length,
    sourcesSearched,
  }
}
