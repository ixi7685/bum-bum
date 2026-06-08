'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import ReportView from '../../components/Report/ReportView'
import { ReportData } from '../../components/Report/types'
import Footer from '../../components/Footer'

export default function DemoReportPage() {
  const searchParams = useSearchParams()
  const company = searchParams.get('company') || 'meta'
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadExample = async () => {
      try {
        const slug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        const res = await fetch(`/examples/${slug}.json`)
        if (!res.ok) throw new Error('Example report not available. Run a search first to generate it.')
        const data: ReportData = await res.json()
        setReportData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load example')
      } finally {
        setIsLoading(false)
      }
    }
    loadExample()
  }, [company])

  if (isLoading) {
    return (
      <div className="report-loading">
        <div className="report-loading__spinner" />
        <h2>Loading example report…</h2>
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
          @keyframes spin { to { transform: rotate(360deg); } }
          .report-loading h2 {
            font-size: 1.25rem;
            color: #1a1d23;
            margin: 0;
          }
        `}</style>
      </div>
    )
  }

  if (error || !reportData) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '64px' }}>
        <h2>Example report unavailable</h2>
        <p>{error}</p>
        <a href="/">← Back to search</a>
      </div>
    )
  }

  return (
    <>
      <ReportView data={reportData} />
      <Footer />
    </>
  )
}
