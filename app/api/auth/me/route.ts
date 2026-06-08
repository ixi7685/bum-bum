import { NextRequest, NextResponse } from 'next/server'
import { getUserBySession, sanitizeUser } from '../../../../lib/userStore'

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ user: null })
    }

    const user = getUserBySession(sessionToken)

    if (!user) {
      const response = NextResponse.json({ user: null })
      response.cookies.delete('session')
      return response
    }

    return NextResponse.json({ user: sanitizeUser(user) })
  } catch {
    return NextResponse.json({ user: null })
  }
}
