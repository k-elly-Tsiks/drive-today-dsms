import { createHash, randomInt, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { type createAdminClient } from '@/lib/supabase/admin'
import { getPasswordResetDatabaseError } from '@/lib/supabase/password-reset-errors'

// No 0/O or 1/I/L, so a code read aloud or copied by hand is not mistyped.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 8
export const MAX_RESET_CODE_ATTEMPTS = 5

export function generateResetCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return `${code.slice(0, 4)}-${code.slice(4)}`
}

function normalizeResetCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function hashResetCode(code: string): string {
  return createHash('sha256').update(normalizeResetCode(code)).digest('hex')
}

function codeMatches(storedHash: string, code: string): boolean {
  const expected = Buffer.from(storedHash, 'hex')
  const actual = Buffer.from(hashResetCode(code), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

type CodeCheck =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }

// Confirms an unexpired approval exists for the email and that the code is
// right. Wrong codes are counted, and the approval is withdrawn once the limit
// is reached so the code cannot be guessed.
export async function checkResetCode(
  adminClient: ReturnType<typeof createAdminClient>,
  email: string,
  code: string
): Promise<CodeCheck> {
  const { data: permission, error } = await adminClient
    .from('password_reset_permissions')
    .select('user_id, code_hash, failed_attempts')
    .eq('email', email)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error) {
    console.error('Unable to load password reset permission:', error)
    const databaseError = getPasswordResetDatabaseError(error, 'Unable to check reset permission.')
    return { ok: false, response: NextResponse.json({ error: databaseError.message }, { status: databaseError.status }) }
  }

  const denied = NextResponse.json(
    { error: 'That email and reset code do not match an approved password reset.' },
    { status: 403 }
  )
  if (!permission?.code_hash || permission.failed_attempts >= MAX_RESET_CODE_ATTEMPTS) {
    return { ok: false, response: denied }
  }

  if (!codeMatches(permission.code_hash, code)) {
    const attempts = permission.failed_attempts + 1
    const { error: countError } = attempts >= MAX_RESET_CODE_ATTEMPTS
      ? await adminClient.from('password_reset_permissions').delete().eq('user_id', permission.user_id)
      : await adminClient
          .from('password_reset_permissions')
          .update({ failed_attempts: attempts })
          .eq('user_id', permission.user_id)
    if (countError) console.error('Unable to record failed reset code attempt:', countError)

    return {
      ok: false,
      response: attempts >= MAX_RESET_CODE_ATTEMPTS
        ? NextResponse.json(
            { error: 'Too many incorrect codes. Ask an administrator to approve the reset again.' },
            { status: 403 }
          )
        : denied,
    }
  }

  return { ok: true, userId: permission.user_id }
}
