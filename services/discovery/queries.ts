/**
 * Query Generator — Focused Search Strategy
 *
 * Generates exactly 10 targeted search queries.
 * Each query fetches one page (top 10 results), so total calls = 10.
 *
 * This replaces the previous 50+ query strategy that burned 200+ API calls.
 */

import { ResolvedCompany } from '../resolver'

// ─── Types ───────────────────────────────────────────────────────────────────

export type LayerID = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6'

export interface LayerQuery {
  query: string
  layer: LayerID
  priority: 1 | 2 | 3
  language: string
  category: string
  /** Number of SERP pages to fetch (default: 1, each page = 10 results) */
  pages: number
}

// ─── Main generator ──────────────────────────────────────────────────────────

export function generateQueries(company: ResolvedCompany): LayerQuery[] {
  const n = company.normalizedName
  const queries: LayerQuery[] = []

  // 1. Employee reviews
  queries.push({
    query: `"${n}" employee reviews`,
    layer: 'L3', priority: 1, language: 'en', category: 'employee-reviews', pages: 1,
  })

  // 2. Interview process
  queries.push({
    query: `"${n}" interview process`,
    layer: 'L3', priority: 1, language: 'en', category: 'interview', pages: 1,
  })

  // 3. Reddit discussions
  queries.push({
    query: `"${n}" reddit`,
    layer: 'L4', priority: 1, language: 'en', category: 'reddit', pages: 1,
  })

  // 4. Layoffs
  queries.push({
    query: `"${n}" layoffs`,
    layer: 'L6', priority: 1, language: 'en', category: 'layoffs', pages: 1,
  })

  // 5. Workplace culture
  queries.push({
    query: `"${n}" workplace culture`,
    layer: 'L3', priority: 1, language: 'en', category: 'toxic-signals', pages: 1,
  })

  // 6. Salary
  queries.push({
    query: `"${n}" salary`,
    layer: 'L3', priority: 1, language: 'en', category: 'salary', pages: 1,
  })

  // 7. Leadership
  queries.push({
    query: `"${n}" leadership`,
    layer: 'L6', priority: 1, language: 'en', category: 'leadership', pages: 1,
  })

  // 8. Complaints
  queries.push({
    query: `"${n}" complaints`,
    layer: 'L5', priority: 1, language: 'en', category: 'complaints', pages: 1,
  })

  // 9. Hiring trends
  queries.push({
    query: `"${n}" hiring`,
    layer: 'L2', priority: 1, language: 'en', category: 'hiring', pages: 1,
  })

  // 10. Glassdoor or Indeed
  queries.push({
    query: `"${n}" Glassdoor OR Indeed`,
    layer: 'L3', priority: 1, language: 'en', category: 'glassdoor-indeed', pages: 1,
  })

  return queries
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/** Get only priority-1 queries (for rate-limited / low-budget runs) — now returns all since we only have 10 */
export function getCoreQueries(company: ResolvedCompany): LayerQuery[] {
  return generateQueries(company)
}

/** Get queries for a specific layer */
export function getLayerQueries(company: ResolvedCompany, layer: LayerID): LayerQuery[] {
  return generateQueries(company).filter(q => q.layer === layer)
}
