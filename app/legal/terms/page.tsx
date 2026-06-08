import styles from '../legal.module.scss'
import Footer from '../../components/Footer'

export const metadata = {
  title: 'Terms of Service — Why Risk',
}

export default function TermsPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <span className={styles.label}>Legal</span>
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.updated}>Last updated: February 2026</p>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.container}>
          <div className={styles.prose}>
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing or using Why Risk ("the Service"), you agree to be bound by these Terms
              of Service. If you do not agree, do not use the Service.
            </p>

            <h2>2. Description of Service</h2>
            <p>
              Why Risk provides employment risk intelligence reports by aggregating publicly available
              data from various online sources. Reports are informational only and do not constitute
              professional advice.
            </p>

            <h2>3. Account Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials.
              You agree to notify us immediately of any unauthorized use.
            </p>

            <h2>4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any unlawful purpose.</li>
              <li>Attempt to reverse-engineer, scrape, or automated-extract data from the platform.</li>
              <li>Distribute reports in a way that violates the privacy of individuals.</li>
              <li>Use the Service to harass, defame, or harm any person or organization.</li>
            </ul>

            <h2>5. Intellectual Property</h2>
            <p>
              All content, design, and code of Why Risk are owned by or licensed to us. Reports
              generated for you are licensed for your personal or internal business use only.
            </p>

            <h2>6. Disclaimers</h2>
            <p>
              The Service is provided "as is" without warranties of any kind. We do not guarantee
              the accuracy, completeness, or timeliness of any report. Reports are generated from
              public data and may contain errors or omissions.
            </p>

            <h2>7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Why Risk shall not be liable for any indirect,
              incidental, or consequential damages arising from your use of the Service, including
              employment decisions made based on our reports.
            </p>

            <h2>8. Payments & Refunds</h2>
            <p>
              Single report purchases are non-refundable once the report has been generated.
              Subscription plans can be cancelled at any time; you retain access until the end of
              the billing period. Refund requests for subscriptions are handled on a case-by-case basis.
            </p>

            <h2>9. Modifications</h2>
            <p>
              We reserve the right to modify these Terms at any time. Material changes will be
              communicated via email or a prominent notice on the platform. Continued use after
              changes constitutes acceptance.
            </p>

            <h2>10. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the jurisdiction in which Why Risk operates,
              without regard to conflict-of-law principles.
            </p>

            <h2>11. Contact</h2>
            <p>
              For questions about these Terms, contact us at{' '}
              <a href="mailto:legal@whyrisk.com">legal@whyrisk.com</a>.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
