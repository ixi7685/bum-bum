'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import './AuthModal.scss'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'signin' | 'signup'
  /** Pre-select a plan when opened from pricing page */
  preselectedPlan?: string | null
}

type FlowStep = 'signin' | 'signup' | 'pick-plan' | 'payment' | 'success'

const PLANS = [
  {
    id: 'starter',
    emoji: '🔍',
    name: 'Starter',
    price: '$9',
    period: 'one-time',
    desc: '5 company searches',
    features: ['Full risk assessment', '3-year timeline', 'PDF export'],
  },
  {
    id: 'pro',
    emoji: '🚀',
    name: 'Pro',
    price: '$29',
    period: '/month',
    desc: '50 searches per month',
    features: ['Everything in Starter', 'Watchlist (10 companies)', 'Weekly alerts'],
    highlight: true,
  },
  {
    id: 'business',
    emoji: '🏢',
    name: 'Business',
    price: '$99',
    period: '/month',
    desc: 'Unlimited searches',
    features: ['Everything in Pro', 'API access', 'Team seats (10)', 'Priority support'],
  },
]

export default function AuthModal({ isOpen, onClose, initialMode = 'signup', preselectedPlan = null }: AuthModalProps) {
  const { user, login, register, pay } = useAuth()

  // Form state
  const [step, setStep] = useState<FlowStep>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Plan + payment state
  const [selectedPlan, setSelectedPlan] = useState<string>(preselectedPlan || '')
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242')
  const [cardExpiry, setCardExpiry] = useState('12/28')
  const [cardCVC, setCardCVC] = useState('123')
  const [successMsg, setSuccessMsg] = useState('')

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setError('')
      setLoading(false)
      setSuccessMsg('')

      if (user && !user.plan) {
        setStep('pick-plan')
      } else if (user && user.plan) {
        onClose()
        return
      } else {
        setStep(initialMode === 'signin' ? 'signin' : 'signup')
      }

      if (preselectedPlan) {
        setSelectedPlan(preselectedPlan)
        if (user && !user.plan) {
          setStep('payment')
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode, preselectedPlan])

  if (!isOpen) return null

  // ─── Handlers ────────────────────────────────────────────────────

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('All fields are required')
      return
    }
    setLoading(true)
    setError('')
    const result = await register(email, password, name)
    setLoading(false)
    if (result.success) {
      setStep('pick-plan')
    } else {
      setError(result.error || 'Registration failed')
    }
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required')
      return
    }
    setLoading(true)
    setError('')
    const result = await login(email, password)
    setLoading(false)
    if (result.success) {
      // After login, the context will update user. We check plan.
      // The user we just logged in as — if no plan, go pick plan
      setStep('pick-plan')
    } else {
      setError(result.error || 'Login failed')
    }
  }

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId)
    setStep('payment')
  }

  const handlePayment = async () => {
    if (!selectedPlan) {
      setError('Please select a plan')
      return
    }
    setLoading(true)
    setError('')
    const result = await pay(selectedPlan, {
      cardNumber: cardNumber.replace(/\s/g, ''),
      cardExpiry,
      cardCVC,
    })
    setLoading(false)
    if (result.success) {
      setSuccessMsg(result.message || 'Payment successful!')
      setStep('success')
    } else {
      setError(result.error || 'Payment failed')
    }
  }

  // ─── Render Helpers ──────────────────────────────────────────────

  const renderSignUp = () => (
    <div className="auth-step">
      <span className="auth-step__emoji">👋</span>
      <h2 className="auth-step__title">Create your account</h2>
      <p className="auth-step__subtitle">Get started with company intelligence.</p>

      {error && <div className="auth-error">{error}</div>}

      <div className="auth-input-group">
        <label className="auth-input-label">Full Name</label>
        <input
          type="text"
          className="auth-input"
          placeholder="John Doe"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRegister()}
        />
      </div>

      <div className="auth-input-group">
        <label className="auth-input-label">Email</label>
        <input
          type="email"
          className="auth-input"
          placeholder="you@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRegister()}
        />
      </div>

      <div className="auth-input-group">
        <label className="auth-input-label">Password</label>
        <input
          type="password"
          className="auth-input"
          placeholder="Create a password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRegister()}
        />
      </div>

      <button className="auth-btn" disabled={loading} onClick={handleRegister}>
        {loading ? '⏳ Creating…' : 'Create account →'}
      </button>

      <div className="auth-signin__toggle">
        Already have an account?{' '}
        <button onClick={() => { setStep('signin'); setError('') }}>Sign in</button>
      </div>
    </div>
  )

  const renderSignIn = () => (
    <div className="auth-step">
      <span className="auth-step__emoji">👋</span>
      <h2 className="auth-step__title">Welcome back!</h2>
      <p className="auth-step__subtitle">Sign in to continue.</p>

      {error && <div className="auth-error">{error}</div>}

      <div className="auth-input-group">
        <label className="auth-input-label">Email</label>
        <input
          type="email"
          className="auth-input"
          placeholder="you@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
      </div>

      <div className="auth-input-group">
        <label className="auth-input-label">Password</label>
        <input
          type="password"
          className="auth-input"
          placeholder="Your password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
        />
      </div>

      <button className="auth-btn" disabled={loading} onClick={handleLogin}>
        {loading ? '⏳ Signing in…' : 'Sign in →'}
      </button>

      <div className="auth-signin__toggle">
        {"Don't have an account? "}
        <button onClick={() => { setStep('signup'); setError('') }}>Sign up</button>
      </div>
    </div>
  )

  const renderPickPlan = () => (
    <div className="auth-step">
      <span className="auth-step__emoji">💳</span>
      <h2 className="auth-step__title">Choose your plan</h2>
      <p className="auth-step__subtitle">Pick a plan to start searching companies.</p>

      <div className="auth-plans">
        {PLANS.map(plan => (
          <button
            key={plan.id}
            className={`auth-plan-card ${plan.highlight ? 'auth-plan-card--highlight' : ''}`}
            onClick={() => handleSelectPlan(plan.id)}
          >
            {plan.highlight && <span className="auth-plan-badge">Popular</span>}
            <div className="auth-plan-header">
              <span className="auth-plan-emoji">{plan.emoji}</span>
              <div>
                <p className="auth-plan-name">{plan.name}</p>
                <p className="auth-plan-desc">{plan.desc}</p>
              </div>
            </div>
            <div className="auth-plan-price">
              <span className="auth-plan-amount">{plan.price}</span>
              <span className="auth-plan-period">{plan.period}</span>
            </div>
            <ul className="auth-plan-features">
              {plan.features.map((f, i) => (
                <li key={i}>✓ {f}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  )

  const renderPayment = () => {
    const plan = PLANS.find(p => p.id === selectedPlan)
    return (
      <div className="auth-step">
        <span className="auth-step__emoji">🔒</span>
        <h2 className="auth-step__title">Payment</h2>
        <p className="auth-step__subtitle">
          {plan ? `${plan.name} — ${plan.price} ${plan.period}` : 'Complete your purchase'}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-payment-demo-notice">
          💡 Demo mode — use the pre-filled card details
        </div>

        <div className="auth-input-group">
          <label className="auth-input-label">Card Number</label>
          <input
            type="text"
            className="auth-input"
            placeholder="4242 4242 4242 4242"
            value={cardNumber}
            onChange={e => setCardNumber(e.target.value)}
          />
        </div>

        <div className="auth-input-row">
          <div className="auth-input-group">
            <label className="auth-input-label">Expiry</label>
            <input
              type="text"
              className="auth-input"
              placeholder="MM/YY"
              value={cardExpiry}
              onChange={e => setCardExpiry(e.target.value)}
            />
          </div>
          <div className="auth-input-group">
            <label className="auth-input-label">CVC</label>
            <input
              type="text"
              className="auth-input"
              placeholder="123"
              value={cardCVC}
              onChange={e => setCardCVC(e.target.value)}
            />
          </div>
        </div>

        <button className="auth-btn" disabled={loading} onClick={handlePayment}>
          {loading ? '⏳ Processing…' : `Pay ${plan?.price || ''} →`}
        </button>

        <button
          className="auth-btn auth-btn--text"
          onClick={() => setStep('pick-plan')}
        >
          ← Change plan
        </button>
      </div>
    )
  }

  const renderSuccess = () => (
    <div className="auth-complete">
      <span className="auth-complete__emoji">✅</span>
      <h2 className="auth-complete__title">You&apos;re all set!</h2>
      <p className="auth-complete__desc">{successMsg || 'Your plan is active. Start searching companies.'}</p>
      <button className="auth-btn" onClick={onClose}>
        Start searching →
      </button>
    </div>
  )

  const renderStep = () => {
    switch (step) {
      case 'signup': return renderSignUp()
      case 'signin': return renderSignIn()
      case 'pick-plan': return renderPickPlan()
      case 'payment': return renderPayment()
      case 'success': return renderSuccess()
      default: return renderSignUp()
    }
  }

  const showBack = step === 'payment'

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <div className="auth-modal__header">
          {showBack ? (
            <button className="auth-modal__back" onClick={() => setStep('pick-plan')}>←</button>
          ) : (
            <div style={{ width: 36 }} />
          )}
          <div style={{ flex: 1 }} />
          <button className="auth-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="auth-modal__content">
          {renderStep()}
        </div>
      </div>
    </div>
  )
}
