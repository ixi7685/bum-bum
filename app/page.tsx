'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './context/AuthContext'
import styles from './page.module.scss'
import Footer from './components/Footer'
import AuthModal from './components/AuthModal'

// ═══════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════

const REALITY_NOTES = [
  {
    title: 'Live search only',
    body: 'Reports are generated when you search, using the company, country, and position you provide.',
  },
  {
    title: 'Public signals',
    body: 'The report looks for available public evidence across company pages, reviews, communities, news, and professional signals.',
  },
  {
    title: 'No fake certainty',
    body: 'Results can be incomplete when sources are limited, so the report should be read as evidence, not a guarantee.',
  },
]

const TRACKS = [
  { label: 'Leadership Behavior', icon: 'leadership' },
  { label: 'Layoff Patterns', icon: 'layoff' },
  { label: 'Payment Issues', icon: 'payment' },
  { label: 'Employee Churn', icon: 'churn' },
  { label: 'Public Sentiment', icon: 'sentiment' },
  { label: 'Structural Instability', icon: 'instability' },
] as const

const COUNTRIES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cabo Verde',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czechia',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe',
] as const

const POSITIONS = [
  'Software Engineer',
  'Frontend Engineer',
  'Backend Engineer',
  'Full Stack Engineer',
  'Mobile Engineer',
  'DevOps Engineer',
  'Data Engineer',
  'Data Analyst',
  'Data Scientist',
  'Machine Learning Engineer',
  'QA Engineer',
  'Security Engineer',
  'Product Manager',
  'Project Manager',
  'Program Manager',
  'UX Designer',
  'UI Designer',
  'Product Designer',
  'UX Researcher',
  'Graphic Designer',
  'Marketing Manager',
  'Growth Manager',
  'Content Marketer',
  'SEO Specialist',
  'Social Media Manager',
  'Sales Representative',
  'Account Executive',
  'Account Manager',
  'Customer Success Manager',
  'Customer Support Specialist',
  'Business Analyst',
  'Operations Manager',
  'Finance Analyst',
  'Accountant',
  'HR Specialist',
  'Recruiter',
  'Legal Counsel',
  'Consultant',
  'Business Development Manager',
  'Executive Assistant',
  'Team Lead',
  'Engineering Manager',
  'Director',
  'Intern',
  'Other',
] as const

// ═══════════════════════════════════════════════════════════════════
// TRACK ICONS
// ═══════════════════════════════════════════════════════════════════

function TrackIcon({ type }: { type: string }) {
  const common = {
    viewBox: '0 0 64 64',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  switch (type) {
    case 'leadership':
      return (
        <svg {...common}>
          <circle cx="24" cy="18" r="7" />
          <path d="M10 48c0-7.732 6.268-14 14-14s14 6.268 14 14" />
          <circle cx="46" cy="22" r="4" />
          <path d="M42 18l3-4m8 4l-3-4" />
        </svg>
      )
    case 'layoff':
      return (
        <svg {...common}>
          <rect x="14" y="8" width="28" height="40" rx="3" />
          <path d="M22 20h12M22 28h8" />
          <path d="M30 34l-8 8" strokeWidth={2.5} />
          <path d="M22 34l8 8" strokeWidth={2.5} />
        </svg>
      )
    case 'payment':
      return (
        <svg {...common}>
          <rect x="8" y="16" width="40" height="28" rx="4" />
          <path d="M8 26h40" />
          <rect x="14" y="32" width="10" height="5" rx="1" />
        </svg>
      )
    case 'churn':
      return (
        <svg {...common}>
          <circle cx="22" cy="20" r="6" />
          <circle cx="42" cy="20" r="6" />
          <path d="M12 48c0-5.523 4.477-10 10-10s10 4.477 10 10" />
          <path d="M32 48c0-5.523 4.477-10 10-10s10 4.477 10 10" />
        </svg>
      )
    case 'sentiment':
      return (
        <svg {...common}>
          <path d="M10 12h28a4 4 0 014 4v16a4 4 0 01-4 4H22l-8 8v-8h-4a4 4 0 01-4-4V16a4 4 0 014-4z" />
          <circle cx="19" cy="24" r="2" fill="currentColor" stroke="none" />
          <circle cx="28" cy="24" r="2" fill="currentColor" stroke="none" />
          <circle cx="37" cy="24" r="2" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'instability':
      return (
        <svg {...common}>
          <path d="M8 52h48" />
          <path d="M18 52V26l14-14 14 14v26" />
          <rect x="26" y="38" width="8" height="14" />
          <rect x="22" y="28" width="6" height="6" />
          <rect x="34" y="28" width="6" height="6" />
          <path d="M12 18l4-4M52 18l-4-4" strokeWidth={1.5} />
        </svg>
      )
    default:
      return null
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function Home() {
  const router = useRouter()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('')
  const [position, setPosition] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const canAnalyze = Boolean(query.trim() && country.trim() && position.trim())

  const doSearch = () => {
    if (!canAnalyze) return

    setLoading(true)
    const slug = query
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    const params = new URLSearchParams({ company: query.trim() })
    params.set('country', country.trim())
    params.set('position', position.trim())
    if (category.trim()) params.set('category', category.trim())
    setTimeout(() => {
      router.push(`/report/${slug}?${params.toString()}`)
    }, 400)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    doSearch()
  }

  return (
    <div className={styles.page}>

      {/* ═══ 1. HERO ═══════════════════════════════════════════ */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <form onSubmit={handleSubmit} className={styles.searchBar}>
            <svg className={styles.searchIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Enter company name, then select country and position below"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
            />
          </form>

          <div className={styles.questionnaire}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="country">Country</label>
              <select
                id="country"
                className={styles.fieldInput}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
              >
                <option value="">Select country...</option>
                {COUNTRIES.map((countryName) => (
                  <option key={countryName} value={countryName}>{countryName}</option>
                ))}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="position">Position</label>
              <select
                id="position"
                className={styles.fieldInput}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                required
              >
                <option value="">Select position...</option>
                {POSITIONS.map((positionName) => (
                  <option key={positionName} value={positionName}>{positionName}</option>
                ))}
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor="category">Company category</label>
              <select
                id="category"
                className={styles.fieldInput}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select category…</option>
                <option value="tech">Tech / Software</option>
                <option value="finance">Finance / Banking</option>
                <option value="consulting">Consulting</option>
                <option value="healthcare">Healthcare</option>
                <option value="manufacturing">Manufacturing</option>
                <option value="retail">Retail / E-commerce</option>
                <option value="telecom">Telecom</option>
                <option value="energy">Energy / Utilities</option>
                <option value="media">Media / Entertainment</option>
                <option value="education">Education</option>
                <option value="government">Government / Public Sector</option>
                <option value="nonprofit">Nonprofit / NGO</option>
                <option value="startup">Startup</option>
                <option value="agency">Agency / Services</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Auth status hint */}
          {!user && (
            <p className={styles.authHint}>
              Search without an account, or <button className={styles.authHintLink} onClick={() => setAuthOpen(true)}>sign up</button> to save searches.
            </p>
          )}
          {user && !user.plan && (
            <p className={styles.authHint}>
              Signed in. You can search now, and reports will be saved to your account.
            </p>
          )}
          {user && user.plan && (
            <p className={styles.searchQuota}>
              ✅ {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} plan · {user.searchLimit === -1 ? 'Unlimited' : `${user.searchesUsed}/${user.searchLimit}`} searches
            </p>
          )}

          <h1 className={styles.heroH1}>See patterns. Not promises.</h1>

          <button
            type="button"
            className={styles.analyzeBtn}
            onClick={doSearch}
            disabled={loading || !canAnalyze}
          >
            {loading ? <span className={styles.spinner} /> : 'Analyze →'}
          </button>

          <a href="/about" className={styles.howLink}>How it works</a>
        </div>
      </section>

      {/* ═══ 2. STATS STRIP ════════════════════════════════════ */}
      <section className={styles.statsStrip}>
        <div className={styles.statsInner}>
          <div className={styles.statsRow}>
            <span className={styles.statLeft}>
              <strong>New product</strong> with live company reports.
            </span>
            <span className={styles.statRight}>
              <strong>No inflated counters</strong> or paid placement claims.
            </span>
          </div>
          <div className={styles.statsDivider} />
          <p className={styles.trustLine}>
            Reports are generated from available sources when you search.
          </p>
        </div>
      </section>

      {/* ═══ 3. REALITY NOTES ══════════════════════════════════ */}
      <section className={styles.testimonials}>
        <div className={styles.testimonialsInner}>
          <div className={styles.testimonialGrid}>
            {REALITY_NOTES.map((note) => (
              <div key={note.title} className={styles.testimonialCard}>
                <h3 className={styles.noteTitle}>{note.title}</h3>
                <p className={styles.testimonialQuote}>{note.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 4. WHAT WE TRACK ═════════════════════════════════ */}
      <section className={styles.tracks}>
        <div className={styles.tracksInner}>
          <h2 className={styles.tracksH2}>What We Track</h2>
          <div className={styles.tracksGrid}>
            {TRACKS.map((t) => (
              <div key={t.label} className={styles.trackCard}>
                <div className={styles.trackIcon}>
                  <TrackIcon type={t.icon} />
                </div>
                <span className={styles.trackLabel}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 5. TAGLINE ═══════════════════════════════════════ */}
      <section className={styles.tagline}>
        <div className={styles.taglineInner}>
          <p className={styles.taglineText}>
            Companies optimize for image. We optimize for <strong>patterns</strong>.
          </p>
        </div>
      </section>

      {/* ═══ 6. SEARCH CONTEXT ════════════════════════════════ */}
      <section className={styles.socialProof}>
        <div className={styles.socialProofInner}>
          <p className={styles.socialProofLabel}>Every report starts with:</p>
          <div className={styles.logoStrip}>
            <span className={styles.logoText}>Company</span>
            <span className={styles.logoText}>Country</span>
            <span className={styles.logoText}>Position</span>
            <span className={styles.logoText}>Available sources</span>
          </div>
        </div>
      </section>

      {/* ═══ 8. BOTTOM CTA ════════════════════════════════════ */}
      <section className={styles.bottomCta}>
        <div className={styles.bottomCtaInner}>
          <h2 className={styles.bottomCtaH2}>Before you sign. Search.</h2>
          <button
            className={styles.analyzeBtn}
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' })
              setTimeout(() => {
                const input = document.querySelector<HTMLInputElement>(
                  'input[placeholder*="Enter company name"]'
                )
                input?.focus()
              }, 600)
            }}
          >
            Analyze a company &gt;
          </button>
        </div>
      </section>

      {/* ═══ 9. FOOTER ════════════════════════════════════════ */}
      <Footer />

      {/* Auth / Payment modal */}
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode="signup" />
    </div>
  )
}
