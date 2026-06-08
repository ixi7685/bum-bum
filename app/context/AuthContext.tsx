'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

// ═══════════════════════════════════════════════════════════════════
// Types (client-safe — no password)
// ═══════════════════════════════════════════════════════════════════

export type PlanTier = 'starter' | 'pro' | 'business' | null

export interface SavedCompany {
  name: string
  slug: string
  searchedAt: string
}

export interface ClientUser {
  id: string
  email: string
  name: string
  plan: PlanTier
  paidAt: string | null
  searchesUsed: number
  searchLimit: number
  savedCompanies: SavedCompany[]
  createdAt: string
}

interface AuthContextValue {
  user: ClientUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  pay: (plan: string, card: { cardNumber: string; cardExpiry: string; cardCVC: string }) => Promise<{ success: boolean; message?: string; error?: string }>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me')
      const data = await res.json()
      setUser(data.user || null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (data.success) {
        setUser(data.user)
        return { success: true }
      }
      return { success: false, error: data.error || 'Login failed' }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }

  const register = async (email: string, password: string, name: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })
      const data = await res.json()
      if (data.success) {
        setUser(data.user)
        return { success: true }
      }
      return { success: false, error: data.error || 'Registration failed' }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch { /* ignore */ }
    setUser(null)
  }

  const pay = async (plan: string, card: { cardNumber: string; cardExpiry: string; cardCVC: string }) => {
    try {
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, ...card }),
      })
      const data = await res.json()
      if (data.success) {
        setUser(data.user)
        return { success: true, message: data.message }
      }
      return { success: false, error: data.error || 'Payment failed' }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, pay, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
