import { NextRequest, NextResponse } from 'next/server'
import { getUserBySession, activatePlan, sanitizeUser, PLAN_CONFIG } from '../../../lib/userStore'
import type { PlanTier } from '../../../lib/userStore'

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get('session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = getUserBySession(sessionToken)
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { plan, cardNumber, cardExpiry, cardCVC } = await request.json()

    if (!plan || !PLAN_CONFIG[plan]) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 })
    }

    // Demo validation — just check fields are present
    if (!cardNumber || !cardExpiry || !cardCVC) {
      return NextResponse.json({ error: 'Payment details required' }, { status: 400 })
    }

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 800))

    const updatedUser = activatePlan(user.id, plan as PlanTier)

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to activate plan' }, { status: 500 })
    }

    return NextResponse.json({
      user: sanitizeUser(updatedUser),
      success: true,
      message: `${PLAN_CONFIG[plan].label} activated! You have ${PLAN_CONFIG[plan].searches === -1 ? 'unlimited' : PLAN_CONFIG[plan].searches} searches.`,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
