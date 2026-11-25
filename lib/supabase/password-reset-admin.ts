import { createClient as createSessionClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function authorizePasswordResetAdmin() {
  const sessionClient = await createSessionClient()
  const { data: { user }, error: authError } = await sessionClient.auth.getUser()

  if (authError || !user) {
    return { authorized: false as const, status: 401, message: 'Please sign in as an administrator.' }
  }

  const adminClient = createAdminClient()
  const { data: profile, error: profileError } = await adminClient
    .from('users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('Unable to verify password reset administrator:', profileError)
    return { authorized: false as const, status: 500, message: 'Unable to verify administrator access.' }
  }

  if (profile?.role !== 'admin') {
    return { authorized: false as const, status: 403, message: 'Administrator access is required.' }
  }

  return { authorized: true as const, user, adminClient }
}
