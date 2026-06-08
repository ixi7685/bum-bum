import { NextRequest, NextResponse } from 'next/server'
import { loginUser, sanitizeUser } from '../../../../lib/userStore'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const result = loginUser(email, password)

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }

    const response = NextResponse.json({
      user: sanitizeUser(result.user),
      success: true,
    })

    response.cookies.set('session', result.sessionToken, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
