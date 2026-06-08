'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import styles from './Header.module.scss'
import AuthModal from './AuthModal'

const NAV_ITEMS = [
  {
    label: 'Product',
    dropdown: [
      { label: 'Watchlist', href: '/pricing' },
      { label: 'Alerts', href: '/pricing' },
      { label: 'How it works', href: '/about' },
    ],
  },
  { label: 'Business', href: '/pricing' },
  { label: 'Company', href: '/about' },
]

export default function Header() {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const [scrolled, setScrolled] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const dropdownTimeout = useRef<NodeJS.Timeout | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  // Close user dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleDropdownEnter = useCallback((label: string) => {
    if (dropdownTimeout.current) clearTimeout(dropdownTimeout.current)
    setActiveDropdown(label)
  }, [])

  const handleDropdownLeave = useCallback(() => {
    dropdownTimeout.current = setTimeout(() => setActiveDropdown(null), 120)
  }, [])

  const openAuth = (mode: 'signin' | 'signup') => {
    setAuthMode(mode)
    setAuthOpen(true)
    setMobileOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    setUserMenuOpen(false)
  }

  const planLabel = user?.plan
    ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1)
    : null

  return (
    <>
      <header className={`${styles.header} ${scrolled ? styles.scrolled : ''}`}>
        <div className={styles.container}>
          {/* Logo */}
          <a href="/" className={styles.logo}>
            <img src="/whyrisk.png" alt="Why Risk" width={96} height={96} style={{ borderRadius: 8 }} />
          </a>

          {/* Desktop Nav */}
          <nav className={styles.nav}>
            {NAV_ITEMS.map((item) =>
              item.dropdown ? (
                <div
                  key={item.label}
                  className={styles.navItemWrap}
                  onMouseEnter={() => handleDropdownEnter(item.label)}
                  onMouseLeave={handleDropdownLeave}
                >
                  <button className={styles.navLink}>
                    {item.label}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {activeDropdown === item.label && (
                    <div className={styles.dropdown}>
                      {item.dropdown.map((sub) => (
                        <a key={sub.label} href={sub.href} className={styles.dropdownItem}>
                          {sub.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <a key={item.label} href={item.href} className={styles.navLink}>
                  {item.label}
                </a>
              )
            )}
          </nav>

          {/* Right Actions */}
          <div className={styles.actions}>
            <a href="/report/demo" className={styles.demoBtn}>Example report</a>
            <span className={styles.lang}>EN</span>

            {user ? (
              <div className={styles.userArea} ref={userMenuRef}>
                <button
                  className={styles.userBtn}
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                >
                  <span className={styles.userAvatar}>
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.userName}>{user.name.split(' ')[0]}</span>
                  {planLabel && (
                    <span className={styles.userPlanBadge}>{planLabel}</span>
                  )}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {userMenuOpen && (
                  <div className={styles.userDropdown}>
                    <div className={styles.userDropdownHeader}>
                      <p className={styles.userDropdownName}>{user.name}</p>
                      <p className={styles.userDropdownEmail}>{user.email}</p>
                      {user.plan && (
                        <p className={styles.userDropdownPlan}>
                          {planLabel} plan · {user.searchLimit === -1 ? '∞' : `${user.searchesUsed}/${user.searchLimit}`} searches
                        </p>
                      )}
                    </div>
                    <div className={styles.userDropdownDivider} />
                    {user.savedCompanies && user.savedCompanies.length > 0 && (
                      <>
                        <p className={styles.userDropdownLabel}>Recent searches</p>
                        {user.savedCompanies.slice(-5).reverse().map((c) => (
                          <a
                            key={c.slug}
                            href={`/report/${c.slug}?company=${encodeURIComponent(c.name)}`}
                            className={styles.userDropdownItem}
                            onClick={() => setUserMenuOpen(false)}
                          >
                            🏢 {c.name}
                          </a>
                        ))}
                        <div className={styles.userDropdownDivider} />
                      </>
                    )}
                    {!user.plan && (
                      <button
                        className={styles.userDropdownUpgrade}
                        onClick={() => { setUserMenuOpen(false); openAuth('signup') }}
                      >
                        ⚡ Choose a plan
                      </button>
                    )}
                    <button className={styles.userDropdownLogout} onClick={handleLogout}>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button className={styles.loginBtn} onClick={() => openAuth('signin')}>
                  Log in
                </button>
                <button className={styles.signupBtn} onClick={() => openAuth('signup')}>
                  Sign up
                </button>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            className={styles.burger}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span className={`${styles.burgerLines} ${mobileOpen ? styles.open : ''}`}>
              <span /><span /><span />
            </span>
          </button>
        </div>
      </header>

      {/* Mobile Slide Panel */}
      {mobileOpen && <div className={styles.overlay} onClick={() => setMobileOpen(false)} />}
      <div className={`${styles.mobilePanel} ${mobileOpen ? styles.mobilePanelOpen : ''}`}>
        <nav className={styles.mobileNav}>
          {NAV_ITEMS.map((item) => (
            <div key={item.label}>
              {item.dropdown ? (
                <>
                  <span className={styles.mobileLabel}>{item.label}</span>
                  {item.dropdown.map((sub) => (
                    <a key={sub.label} href={sub.href} className={styles.mobileLink} onClick={() => setMobileOpen(false)}>
                      {sub.label}
                    </a>
                  ))}
                </>
              ) : (
                <a href={item.href} className={styles.mobileLink} onClick={() => setMobileOpen(false)}>
                  {item.label}
                </a>
              )}
            </div>
          ))}
        </nav>
        <div className={styles.mobileCta}>
          {user ? (
            <>
              <span className={styles.mobileUserInfo}>
                👤 {user.name} {planLabel && `(${planLabel})`}
              </span>
              <button className={styles.mobileLogin} onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <button className={styles.mobileLogin} onClick={() => openAuth('signin')}>Log in</button>
              <button className={styles.mobileSignup} onClick={() => openAuth('signup')}>Sign up</button>
            </>
          )}
        </div>
      </div>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </>
  )
}
