import { NextRequest, NextResponse } from 'next/server'
import { registerUser, sanitizeUser } from '../../../../lib/userStore'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 })
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 })
    }

    const result = registerUser(email, password, name)

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }

    const response = NextResponse.json({
      user: sanitizeUser(result.user),
      success: true,
    })

    // Set session cookie
    response.cookies.set('session', result.sessionToken, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      sameSite: 'lax',
    })

    return response
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
