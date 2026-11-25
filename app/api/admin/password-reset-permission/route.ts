import { NextResponse } from 'next/server'
import { authorizePasswordResetAdmin } from '@/lib/supabase/password-reset-admin'
import { getPasswordResetDatabaseError } from '@/lib/supabase/password-reset-errors'

export async function GET(request: Request) {
  try {
    const authorization = await authorizePasswordResetAdmin()
    if (!authorization.authorized) {
      return NextResponse.json(
        { error: authorization.message },
        { status: authorization.status }
      )
    }

    const userId = new URL(request.url).searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'Select an account.' }, { status: 400 })
    }

    const { data, error } = await authorization.adminClient
      .from('password_reset_permissions')
      .select('expires_at')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    if (error) {
      console.error('Unable to load password reset permission:', error)
      const databaseError = getPasswordResetDatabaseError(error, 'Unable to load reset permission.')
      return NextResponse.json({ error: databaseError.message }, { status: databaseError.status })
    }

    return NextResponse.json({ allowed: Boolean(data), expiresAt: data?.expires_at ?? null })
  } catch (error) {
    console.error('Password reset permission lookup failed:', error)
    return NextResponse.json(
      { error: 'Password reset is not configured. Contact the system administrator.' },
      { status: 503 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const authorization = await authorizePasswordResetAdmin()
    if (!authorization.authorized) {
      return NextResponse.json(
        { error: authorization.message },
        { status: authorization.status }
      )
    }

    const body: unknown = await request.json()
    if (
      typeof body !== 'object' ||
      body === null ||
      !('userId' in body) ||
      typeof body.userId !== 'string' ||
      !('allowed' in body) ||
      typeof body.allowed !== 'boolean'
    ) {
      return NextResponse.json({ error: 'Invalid reset permission request.' }, { status: 400 })
    }

    const { userId, allowed } = body
    const { data: profile, error: profileError } = await authorization.adminClient
      .from('users')
      .select('email, role')
      .eq('user_id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('Unable to load password reset target:', profileError)
      return NextResponse.json({ error: 'Unable to load selected account.' }, { status: 500 })
    }
    if (!profile || (profile.role !== 'learner' && profile.role !== 'instructor')) {
      return NextResponse.json({ error: 'Select a learner or instructor account.' }, { status: 400 })
    }

    if (!allowed) {
      const { error } = await authorization.adminClient
        .from('password_reset_permissions')
        .delete()
        .eq('user_id', userId)

      if (error) {
        console.error('Unable to revoke password reset permission:', error)
        const databaseError = getPasswordResetDatabaseError(error, 'Unable to revoke reset permission.')
        return NextResponse.json({ error: databaseError.message }, { status: databaseError.status })
      }

      return NextResponse.json({ allowed: false })
    }

    const email = profile.email?.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'The selected account does not have a valid email address.' },
        { status: 400 }
      )
    }

    const { data: authUser, error: authUserError } =
      await authorization.adminClient.auth.admin.getUserById(userId)
    if (authUserError || !authUser.user?.email || authUser.user.email.toLowerCase() !== email) {
      console.error('Selected account email does not match its authentication account:', authUserError)
      return NextResponse.json(
        { error: 'The selected account email does not match its login email.' },
        { status: 400 }
      )
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { error: grantError } = await authorization.adminClient
      .from('password_reset_permissions')
      .upsert(
        {
          user_id: userId,
          email,
          expires_at: expiresAt,
          granted_by: authorization.user.id,
        },
        { onConflict: 'user_id' }
      )

    if (grantError) {
      console.error('Unable to allow password reset:', grantError)
      const databaseError = getPasswordResetDatabaseError(
        grantError,
        'Unable to allow password reset.'
      )
      return NextResponse.json(
        { error: databaseError.message },
        { status: databaseError.status }
      )
    }

    return NextResponse.json({ allowed: true, expiresAt })
  } catch (error) {
    console.error('Password reset permission update failed:', error)
    return NextResponse.json(
      { error: 'Password reset is not configured. Contact the system administrator.' },
      { status: 503 }
    )
  }
}
