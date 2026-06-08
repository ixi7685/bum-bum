'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import ReportView from '../components/Report/ReportView'
import { ReportData } from '../components/Report/types'

function ReportContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const companyName = searchParams.get('company')
  const country = searchParams.get('country')
  const position = searchParams.get('position')
  const category = searchParams.get('category') || ''
  
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!companyName || !country || !position) {
      router.push('/')
      return
    }

    const fetchReport = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ companyName, country, position, category }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch report')
        }

        // Try to parse JSON from the response
        let parsedReport: ReportData
        try {
          // The API returns companyInfo as a string, try to parse it as JSON
          parsedReport = JSON.parse(data.companyInfo)
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
      }
    }

    fetchReport()
  }, [companyName, country, position, category, router])

  if (isLoading) {
    return (
      <div className="report-loading">
        <div className="report-loading__spinner"></div>
        <h2>Analyzing {companyName}...</h2>
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
            background: #f9fafb;
          }
          .report-loading__spinner {
            width: 48px;
            height: 48px;
            border: 4px solid #e5e7eb;
            border-top-color: #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .report-loading h2 {
            font-size: 1.25rem;
            color: #1f2937;
            margin: 0;
          }
          .report-loading p {
            font-size: 0.875rem;
            color: #6b7280;
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
            color: #9ca3af;
            background: #f3f4f6;
            padding: 0.25rem 0.75rem;
            border-radius: 100px;
            animation: fadeInOut 2s ease-in-out infinite;
          }
          .report-loading__steps span:nth-child(2) { animation-delay: 0.3s; }
          .report-loading__steps span:nth-child(3) { animation-delay: 0.6s; }
          .report-loading__steps span:nth-child(4) { animation-delay: 0.9s; }
          .report-loading__steps span:nth-child(5) { animation-delay: 1.2s; }
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

  if (error && !reportData) {
    return (
      <div className="report-error">
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={() => router.push('/')}>Try Again</button>
        <style jsx>{`
          .report-error {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            background: #f9fafb;
          }
          .report-error h2 {
            font-size: 1.25rem;
            color: #ef4444;
          }
          .report-error button {
            padding: 0.75rem 1.5rem;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          }
        `}</style>
      </div>
    )
  }

  if (!reportData) {
    return null
  }

  return <ReportView data={reportData} />
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#f9fafb'
      }}>
        <p>Loading...</p>
      </div>
    }>
      <ReportContent />
    </Suspense>
  )
}
