import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPasswordResetDatabaseError } from '@/lib/supabase/password-reset-errors'

export async function POST(request: Request) {
  let email: unknown

  try {
    const body: unknown = await request.json()
    email = typeof body === 'object' && body !== null && 'email' in body
      ? body.email
      : null
  } catch {
    return NextResponse.json({ error: 'Enter the email address for your account.' }, { status: 400 })
  }

  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json(
      { error: 'Enter a valid email address.' },
      { status: 400 }
    )
  }

  try {
    const normalizedEmail = email.trim().toLowerCase()
    const adminClient = createAdminClient()
    const { data, error } = await adminClient
      .from('password_reset_permissions')
      .select('user_id')
      .eq('email', normalizedEmail)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (error) {
      console.error('Unable to verify password reset permission:', error)
      const databaseError = getPasswordResetDatabaseError(
        error,
        'Unable to check reset permission. Please try again later.'
      )
      return NextResponse.json(
        { error: databaseError.message },
        { status: databaseError.status }
      )
    }

    return NextResponse.json({ allowed: Boolean(data) })
  } catch (error) {
    console.error('Password reset permission verification failed:', error)
    return NextResponse.json(
      { error: 'Password reset is not configured. Contact the system administrator.' },
      { status: 503 }
    )
  }
}
