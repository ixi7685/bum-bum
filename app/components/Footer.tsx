import styles from './Footer.module.scss'

const LINK_GROUPS = [
  {
    title: 'Discover',
    links: [
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/legal/privacy' },
      { label: 'Terms', href: '/legal/terms' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {/* Link columns */}
        <div className={styles.linksGrid}>
          {LINK_GROUPS.map((group) => (
            <div key={group.title} className={styles.linkCol}>
              <h4 className={styles.colTitle}>{group.title}</h4>
              {group.links.map((link) => (
                <a key={link.label} href={link.href} className={styles.colLink}>
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className={styles.disclaimer}>
          Why Risk is an intelligence layer, not a decision-maker. Reports are generated from
          publicly available information and should not be considered legal or financial advice.
          Results may not reflect complete or current information. Use reports as one input among
          many when making employment decisions. All trademarks belong to their respective owners.
        </p>

        {/* Bottom bar */}
        <div className={styles.bottom}>
          <span className={styles.copy}>© {new Date().getFullYear()} Why Risk. All rights reserved.</span>
        </div>
      </div>
    </footer>
  )
}
