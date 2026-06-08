import { NextRequest, NextResponse } from 'next/server'
import { logoutSession } from '../../../../lib/userStore'

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session')?.value

    if (sessionToken) {
      logoutSession(sessionToken)
    }

    const response = NextResponse.json({ success: true })
    response.cookies.delete('session')
    return response
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
