import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type PlanTier = 'starter' | 'pro' | 'business' | null

export interface SavedCompany {
  name: string
  slug: string
  searchedAt: string
}

export interface User {
  id: string
  email: string
  password: string // plain text for demo only!
  name: string
  plan: PlanTier
  paidAt: string | null
  searchesUsed: number
  searchLimit: number // -1 = unlimited
  savedCompanies: SavedCompany[]
  createdAt: string
}

interface DB {
  users: User[]
  sessions: Record<string, string> // sessionToken -> userId
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

const DATA_PATH = path.join(process.cwd(), 'data', 'users.json')

function readDB(): DB {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { users: [], sessions: {} }
  }
}

function writeDB(db: DB): void {
  const dir = path.dirname(DATA_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DATA_PATH, JSON.stringify(db, null, 2), 'utf-8')
}

function generateId(): string {
  return crypto.randomUUID()
}

function generateSession(): string {
  return crypto.randomBytes(32).toString('hex')
}

// ═══════════════════════════════════════════════════════════════════
// Plan config
// ═══════════════════════════════════════════════════════════════════

export const PLAN_CONFIG: Record<string, { price: number; label: string; searches: number }> = {
  starter: { price: 9, label: 'Starter — $9', searches: 5 },
  pro: { price: 29, label: 'Pro — $29/mo', searches: 50 },
  business: { price: 99, label: 'Business — $99/mo', searches: -1 },
}

// ═══════════════════════════════════════════════════════════════════
// Auth operations
// ═══════════════════════════════════════════════════════════════════

export function registerUser(email: string, password: string, name: string): { user: User; sessionToken: string } | { error: string } {
  const db = readDB()

  if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { error: 'Email already registered' }
  }

  const user: User = {
    id: generateId(),
    email: email.toLowerCase(),
    password,
    name,
    plan: null,
    paidAt: null,
    searchesUsed: 0,
    searchLimit: 0,
    savedCompanies: [],
    createdAt: new Date().toISOString(),
  }

  const sessionToken = generateSession()
  db.users.push(user)
  db.sessions[sessionToken] = user.id
  writeDB(db)

  return { user, sessionToken }
}

export function loginUser(email: string, password: string): { user: User; sessionToken: string } | { error: string } {
  const db = readDB()
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase())

  if (!user || user.password !== password) {
    return { error: 'Invalid email or password' }
  }

  const sessionToken = generateSession()
  db.sessions[sessionToken] = user.id
  writeDB(db)

  return { user, sessionToken }
}

export function getUserBySession(sessionToken: string): User | null {
  const db = readDB()
  const userId = db.sessions[sessionToken]
  if (!userId) return null
  return db.users.find(u => u.id === userId) || null
}

export function logoutSession(sessionToken: string): void {
  const db = readDB()
  delete db.sessions[sessionToken]
  writeDB(db)
}

// ═══════════════════════════════════════════════════════════════════
// Payment operations
// ═══════════════════════════════════════════════════════════════════

export function activatePlan(userId: string, plan: PlanTier): User | null {
  if (!plan || !PLAN_CONFIG[plan]) return null

  const db = readDB()
  const user = db.users.find(u => u.id === userId)
  if (!user) return null

  user.plan = plan
  user.paidAt = new Date().toISOString()
  user.searchLimit = PLAN_CONFIG[plan].searches
  user.searchesUsed = 0
  writeDB(db)

  return user
}

// ═══════════════════════════════════════════════════════════════════
// Company operations
// ═══════════════════════════════════════════════════════════════════

export function saveCompanyForUser(userId: string, companyName: string, slug: string): void {
  const db = readDB()
  const user = db.users.find(u => u.id === userId)
  if (!user) return

  // Don't duplicate
  if (!user.savedCompanies.find(c => c.slug === slug)) {
    user.savedCompanies.push({
      name: companyName,
      slug,
      searchedAt: new Date().toISOString(),
    })
    writeDB(db)
  }
}

export function incrementSearchCount(userId: string): boolean {
  const db = readDB()
  const user = db.users.find(u => u.id === userId)
  if (!user || !user.plan) return false

  // Unlimited
  if (user.searchLimit === -1) {
    user.searchesUsed++
    writeDB(db)
    return true
  }

  if (user.searchesUsed >= user.searchLimit) return false

  user.searchesUsed++
  writeDB(db)
  return true
}

export function getUserCompanies(userId: string): SavedCompany[] {
  const db = readDB()
  const user = db.users.find(u => u.id === userId)
  return user?.savedCompanies || []
}

// ═══════════════════════════════════════════════════════════════════
// Sanitize user for client (no password)
// ═══════════════════════════════════════════════════════════════════

export function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    paidAt: user.paidAt,
    searchesUsed: user.searchesUsed,
    searchLimit: user.searchLimit,
    savedCompanies: user.savedCompanies,
    createdAt: user.createdAt,
  }
}
