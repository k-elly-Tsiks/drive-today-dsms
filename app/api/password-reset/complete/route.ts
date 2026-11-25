import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPasswordResetDatabaseError } from '@/lib/supabase/password-reset-errors'
import { checkResetCode } from '@/lib/supabase/password-reset-code'

type ClaimedPermission = {
  user_id: string
  email: string
  expires_at: string
  granted_by: string
  created_at: string
  code_hash: string
  failed_attempts: number
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid reset request.' }, { status: 400 })
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('email' in body) ||
    typeof body.email !== 'string' ||
    !('password' in body) ||
    typeof body.password !== 'string' ||
    !('code' in body) ||
    typeof body.code !== 'string'
  ) {
    return NextResponse.json({ error: 'Enter your email, reset code and new password.' }, { status: 400 })
  }

  const email = body.email.trim().toLowerCase()
  const password = body.password
  const code = body.code
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Your password must be at least 8 characters long.' },
      { status: 400 }
    )
  }

  let adminClient: ReturnType<typeof createAdminClient>
  try {
    adminClient = createAdminClient()
  } catch (error) {
    console.error('Password reset service is not configured:', error)
    return NextResponse.json(
      { error: 'Password reset is not configured. Contact the system administrator.' },
      { status: 503 }
    )
  }

  const check = await checkResetCode(adminClient, email, code)
  if (!check.ok) return check.response
  const permission = { user_id: check.userId }

  const { data: profile, error: profileError } = await adminClient
    .from('users')
    .select('email, role')
    .eq('user_id', permission.user_id)
    .maybeSingle()

  if (profileError || !profile || (profile.role !== 'learner' && profile.role !== 'instructor')) {
    console.error('Unable to validate password reset account:', profileError)
    return NextResponse.json({ error: 'Unable to validate the selected account.' }, { status: 500 })
  }
  if (profile.email?.trim().toLowerCase() !== email) {
    return NextResponse.json(
      { error: 'The approved account email has changed. Ask an administrator to approve it again.' },
      { status: 403 }
    )
  }

  const { data: authAccount, error: authAccountError } =
    await adminClient.auth.admin.getUserById(permission.user_id)
  if (authAccountError || authAccount.user?.email?.toLowerCase() !== email) {
    console.error('Unable to validate reset auth account:', authAccountError)
    return NextResponse.json(
      { error: 'The approved login email does not match this account.' },
      { status: 403 }
    )
  }

  const { data: claimedData, error: claimError } = await adminClient
    .from('password_reset_permissions')
    .delete()
    .eq('user_id', permission.user_id)
    .eq('email', email)
    .gt('expires_at', new Date().toISOString())
    .select('user_id, email, expires_at, granted_by, created_at, code_hash, failed_attempts')
    .maybeSingle()

  if (claimError) {
    console.error('Unable to claim password reset permission:', claimError)
    const databaseError = getPasswordResetDatabaseError(
      claimError,
      'Unable to complete password reset.'
    )
    return NextResponse.json({ error: databaseError.message }, { status: databaseError.status })
  }
  if (!claimedData) {
    return NextResponse.json(
      { error: 'This password reset permission was already used or has expired.' },
      { status: 403 }
    )
  }

  const claimed = claimedData as ClaimedPermission
  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    claimed.user_id,
    { password }
  )

  if (updateError) {
    console.error('Unable to update password for approved reset:', updateError)
    const { error: restoreError } = await adminClient
      .from('password_reset_permissions')
      .upsert(claimed, { onConflict: 'user_id' })

    if (restoreError) {
      console.error('Unable to restore the unused reset permission:', restoreError)
    }
    return NextResponse.json(
      { error: 'Unable to update your password. Please try again or contact the administrator.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
