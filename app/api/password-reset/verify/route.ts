import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkResetCode } from '@/lib/supabase/password-reset-code'

export async function POST(request: Request) {
  let email: unknown
  let code: unknown

  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null) {
      email = 'email' in body ? body.email : null
      code = 'code' in body ? body.code : null
    }
  } catch {
    return NextResponse.json({ error: 'Enter the email address for your account.' }, { status: 400 })
  }

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json(
      { error: 'Enter a valid email address.' },
      { status: 400 }
    )
  }
  if (typeof code !== 'string' || !code.trim()) {
    return NextResponse.json(
      { error: 'Enter the reset code the administrator gave you.' },
      { status: 400 }
    )
  }

  try {
    const adminClient = createAdminClient()
    const check = await checkResetCode(adminClient, email.trim().toLowerCase(), code)
    if (!check.ok) return check.response

    return NextResponse.json({ allowed: true })
  } catch (error) {
    console.error('Password reset permission verification failed:', error)
    return NextResponse.json(
      { error: 'Password reset is not configured. Contact the system administrator.' },
      { status: 503 }
    )
  }
}
