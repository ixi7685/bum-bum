import { NextRequest, NextResponse } from 'next/server'
import { getUserBySession, getUserCompanies } from '../../../lib/userStore'

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserBySession(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const companies = getUserCompanies(user.id)

    return NextResponse.json({ companies })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
