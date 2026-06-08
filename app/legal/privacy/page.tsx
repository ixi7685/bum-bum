import styles from '../legal.module.scss'
import Footer from '../../components/Footer'

export const metadata = {
  title: 'Privacy Policy — Why Risk',
}

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <span className={styles.label}>Legal</span>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.updated}>Last updated: February 2026</p>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.container}>
          <div className={styles.prose}>
            <h2>1. Information We Collect</h2>
            <p>
              When you use Why Risk, we may collect the following information:
            </p>
            <ul>
              <li><strong>Account data:</strong> Email address, name, and hashed password when you create an account.</li>
              <li><strong>Search data:</strong> Company names you search for, to deliver reports and improve our service.</li>
              <li><strong>Usage data:</strong> Pages visited, features used, and interaction patterns (anonymized).</li>
              <li><strong>Payment data:</strong> Processed securely by our payment provider. We never store full card numbers.</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul>
              <li>Generate and deliver employment risk reports.</li>
              <li>Send watchlist alerts and notifications you opt into.</li>
              <li>Improve report accuracy and platform features.</li>
              <li>Communicate service updates (you can opt out anytime).</li>
            </ul>

            <h2>3. Data Sources</h2>
            <p>
              Why Risk aggregates publicly available information from sources including Reddit,
              Glassdoor, HackerNews, YouTube, Wikipedia, and news outlets. We do not scrape
              private or restricted data. All sources are cited in our reports.
            </p>

            <h2>4. Data Sharing</h2>
            <p>
              We do not sell your personal data. We may share anonymized, aggregated analytics
              with partners. We will share information if legally required by a valid court order.
            </p>

            <h2>5. Data Retention</h2>
            <p>
              Account data is retained while your account is active. Search history is retained
              for 90 days. You can request full data deletion at any time by contacting
              privacy@whyrisk.com.
            </p>

            <h2>6. Cookies</h2>
            <p>
              We use essential cookies to maintain your session and preferences. We use analytics
              cookies (anonymized) to understand usage patterns. You can disable non-essential
              cookies in your browser settings.
            </p>

            <h2>7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal data.</li>
              <li>Correct inaccurate data.</li>
              <li>Request deletion of your data.</li>
              <li>Export your data in a machine-readable format.</li>
              <li>Withdraw consent at any time.</li>
            </ul>

            <h2>8. Contact</h2>
            <p>
              For privacy-related inquiries, contact us at{' '}
              <a href="mailto:privacy@whyrisk.com">privacy@whyrisk.com</a>.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
