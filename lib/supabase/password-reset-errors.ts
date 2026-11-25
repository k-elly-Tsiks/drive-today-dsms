export function getPasswordResetDatabaseError(
  error: { code?: string },
  fallbackMessage: string
) {
  if (error.code === 'PGRST205' || error.code === '42P01') {
    return {
      status: 503,
      message:
        'Password reset is not set up in Supabase yet. Apply supabase/migrations/20261101000000_password_reset_permissions.sql in the Supabase SQL Editor, then try again.',
    }
  }

  return { status: 500, message: fallbackMessage }
}
