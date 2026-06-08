'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import ReportView from '../../components/Report/ReportView'
import { ReportData } from '../../components/Report/types'
import Footer from '../../components/Footer'

export default function ReportSlugPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const { refreshUser } = useAuth()
  const slug = params.slug as string
  const companyName =
    searchParams.get('company') ||
    slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const country = searchParams.get('country') || ''
  const position = searchParams.get('position') || ''
  const category = searchParams.get('category') || ''

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!companyName) {
      setError('Company name is required. Please start a new search.')
      setIsLoading(false)
      return
    }

    if (!country || !position) {
      setError('Country and position are required. Please start a new search and fill in all required fields.')
      setIsLoading(false)
      return
    }

    const fetchReport = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName, country, position, category }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch report')
        }

        try {
          const parsedReport: ReportData = JSON.parse(data.companyInfo)
          setReportData(parsedReport)
        } catch {
          console.error('Failed to parse API response as JSON')
          setError('Failed to parse company data. Please try again.')
        }
      } catch (err) {
        console.error('Error fetching report:', err)
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
        // Refresh user to update saved companies when signed in.
        refreshUser()
      }
    }

    fetchReport()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyName, country, position, category])

  // ── Loading state ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="report-loading">
        <div className="report-loading__spinner" />
        <h2>Analyzing {companyName}…</h2>
        <p>Building your company risk report</p>
        <div className="report-loading__steps">
          <span>Company profile</span>
          <span>Public signals</span>
          <span>Employee voices</span>
          <span>Community discussions</span>
          <span>User feedback</span>
          <span>Public events</span>
        </div>
        <style jsx>{`
          .report-loading {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            padding-top: 64px;
            background: #f9fafb;
          }
          .report-loading__spinner {
            width: 48px;
            height: 48px;
            border: 4px solid #e5e7eb;
            border-top-color: #2563eb;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .report-loading h2 {
            font-size: 1.25rem;
            color: #1a1d23;
            margin: 0;
          }
          .report-loading p {
            font-size: 0.875rem;
            color: #5a6170;
            margin: 0;
          }
          .report-loading__steps {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            justify-content: center;
            margin-top: 0.5rem;
          }
          .report-loading__steps span {
            font-size: 0.75rem;
            color: #8a919e;
            background: #ebedf1;
            padding: 0.25rem 0.75rem;
            border-radius: 100px;
            animation: fadeInOut 2s ease-in-out infinite;
          }
          .report-loading__steps span:nth-child(2) { animation-delay: 0.3s; }
          .report-loading__steps span:nth-child(3) { animation-delay: 0.6s; }
          .report-loading__steps span:nth-child(4) { animation-delay: 0.9s; }
          .report-loading__steps span:nth-child(5) { animation-delay: 1.2s; }
          .report-loading__steps span:nth-child(6) { animation-delay: 1.5s; }
          .report-loading__steps span:nth-child(7) { animation-delay: 1.8s; }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes fadeInOut {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────────
  if (error && !reportData) {
    return (
      <div className="report-error">
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={() => { window.location.href = '/' }}>Start New Search</button>
        <a href="/" className="report-error__home">← Back to search</a>
        <style jsx>{`
          .report-error {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            padding-top: 64px;
            background: #f9fafb;
          }
          .report-error h2 {
            font-size: 1.25rem;
            color: #e53e3e;
            margin: 0;
          }
          .report-error p {
            font-size: 0.875rem;
            color: #5a6170;
            margin: 0;
            max-width: 400px;
            text-align: center;
          }
          .report-error button {
            padding: 0.75rem 1.5rem;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 0.875rem;
          }
          .report-error button:hover { background: #1d4ed8; }
          .report-error__home {
            font-size: 0.875rem;
            color: #5a6170;
          }
          .report-error__home:hover { color: #1a1d23; }
        `}</style>
      </div>
    )
  }

  if (!reportData) return null

  // ── Full report ──────────────────────────────────────────────────
  return (
    <div style={{ paddingTop: '64px', background: '#f9fafb', minHeight: '100vh' }}>
      <ReportView data={reportData} />
      <Footer />
    </div>
  )
}
