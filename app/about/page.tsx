'use client'

import styles from './about.module.scss'
import Footer from '../components/Footer'

const VALUES = [
  { icon: '🔍', title: 'Transparency', desc: 'We show our sources, our confidence levels, and our methodology — always.' },
  { icon: '🛡️', title: 'Privacy-first', desc: 'We never scrape private data. Only public, verifiable information feeds our reports.' },
  { icon: '⚡', title: 'Speed', desc: 'One search across all sources in seconds. No more tab-hopping through review sites.' },
  { icon: '🎯', title: 'Accuracy', desc: 'Multi-source cross-validation. We flag uncertainty instead of pretending we know everything.' },
]

const TIMELINE = [
  { year: '2024', event: 'Idea conceived — frustrated by opaque employer reviews scattered across the internet.' },
  { year: '2024', event: 'First prototype — aggregating Reddit, Glassdoor, and HackerNews into a single search.' },
  { year: '2025', event: 'Public beta — added risk scoring, confidence meters, and source-level breakdowns.' },
  { year: '2025', event: 'Pro launch — watchlists, alerts, and role-specific intelligence available.' },
]

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <span className={styles.label}>About</span>
          <h1 className={styles.title}>Employment risk intelligence,<br/>built in the open</h1>
          <p className={styles.subtitle}>
            We believe every job seeker and investor deserves the full picture — not just what
            companies choose to show. Why Risk aggregates public data into clear, actionable reports
            so you can make informed decisions.
          </p>
        </div>
      </section>

      <section className={styles.values}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>What we stand for</h2>
          <div className={styles.grid}>
            {VALUES.map((v, i) => (
              <div key={i} className={styles.valueCard}>
                <span className={styles.valueIcon}>{v.icon}</span>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.timeline}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Our journey</h2>
          <div className={styles.timelineList}>
            {TIMELINE.map((t, i) => (
              <div key={i} className={styles.timelineItem}>
                <span className={styles.year}>{t.year}</span>
                <div className={styles.line}><div className={styles.dot} /></div>
                <p className={styles.event}>{t.event}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={styles.container}>
          <h2 className={styles.ctaTitle}>Ready to try it?</h2>
          <p className={styles.ctaSubtitle}>Search any company — free snapshot included.</p>
          <a href="/" className={styles.ctaBtn}>Go to search</a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
