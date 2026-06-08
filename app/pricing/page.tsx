'use client'

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import styles from './pricing.module.scss'
import Footer from '../components/Footer'
import AuthModal from '../components/AuthModal'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$9',
    period: 'one-time',
    features: [
      '5 company searches',
      'Full risk assessment',
      'Timeline analysis (3 years)',
      'Sentiment breakdown by source',
      'Key signals & evidence',
      'PDF export',
    ],
    cta: 'Get Starter',
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/month',
    features: [
      '50 searches per month',
      'Everything in Starter',
      'Watchlist — up to 10 companies',
      'Weekly email alerts',
      'Role-specific breakdowns',
      'Priority data refresh',
    ],
    cta: 'Start Pro',
    highlight: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$99',
    period: '/month',
    features: [
      'Unlimited searches',
      'Everything in Pro',
      'API access',
      'Team seats (up to 10)',
      'Custom integrations',
      'Dedicated account manager',
      'SLA & priority support',
    ],
    cta: 'Go Business',
    highlight: false,
  },
]

export default function PricingPage() {
  const { user } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)

  const handlePlanClick = (planId: string) => {
    setSelectedPlan(planId)
    setAuthOpen(true)
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <span className={styles.label}>Pricing</span>
          <h1 className={styles.title}>Simple, transparent pricing</h1>
          <p className={styles.subtitle}>
            Start with a single report. Upgrade when you need ongoing intelligence.
          </p>
          {user && user.plan && (
            <p className={styles.currentPlan}>
              ✅ You&apos;re on the <strong>{user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}</strong> plan · {user.searchLimit === -1 ? 'Unlimited' : `${user.searchesUsed}/${user.searchLimit}`} searches
            </p>
          )}
        </div>
      </section>

      <section className={styles.plans}>
        <div className={styles.container}>
          <div className={styles.grid}>
            {PLANS.map((plan) => {
              const isCurrentPlan = user?.plan === plan.id
              return (
                <div key={plan.id} className={`${styles.card} ${plan.highlight ? styles.cardHighlight : ''} ${isCurrentPlan ? styles.cardCurrent : ''}`}>
                  {plan.highlight && <span className={styles.recommended}>Recommended</span>}
                  {isCurrentPlan && <span className={styles.currentBadge}>Current plan</span>}
                  <h2 className={styles.planName}>{plan.name}</h2>
                  <div className={styles.priceRow}>
                    <span className={styles.price}>{plan.price}</span>
                    <span className={styles.period}>{plan.period}</span>
                  </div>
                  <ul className={styles.features}>
                    {plan.features.map((f, j) => (
                      <li key={j}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <button
                    className={plan.highlight ? styles.ctaPrimary : styles.ctaGhost}
                    onClick={() => handlePlanClick(plan.id)}
                    disabled={isCurrentPlan}
                  >
                    {isCurrentPlan ? '✓ Active' : plan.cta}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className={styles.faq}>
        <div className={styles.container}>
          <h2 className={styles.faqTitle}>Frequently asked questions</h2>
          <div className={styles.faqGrid}>
            {[
              { q: 'Can I try before I buy?', a: 'Yes. You can search from the homepage without an account. Sign up if you want saved searches and account features.' },
              { q: 'What sources do you use?', a: 'Reddit, Glassdoor, Blind, HackerNews, YouTube, Wikipedia, and major news outlets. All public data.' },
              { q: 'Do reports update automatically?', a: 'Pro and Business plans include automatic weekly data refreshes and alert notifications.' },
              { q: 'Can I cancel anytime?', a: 'Yes. No long-term contracts. Cancel your subscription from account settings at any time.' },
            ].map((item, i) => (
              <div key={i} className={styles.faqItem}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode="signup"
        preselectedPlan={selectedPlan}
      />
    </div>
  )
}
