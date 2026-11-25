import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Each portal only admits its own role, and only once the administrator has
// approved the account. Row-level security and database triggers remain the
// real enforcement; this keeps unapproved accounts out of the pages.
const PORTAL_ROLES: Record<string, string> = {
  '/admin': 'admin',
  '/instructor': 'instructor',
  '/learner': 'learner',
}

const BLOCKED_STATUSES = new Set(['pending', 'suspended', 'rejected'])

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })

        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  const portal = Object.keys(PORTAL_ROLES).find(prefix =>
    request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`)
  )
  if (!portal) return response

  if (!user) return redirectToLogin(request, response)

  const { data: profile } = await supabase
    .from('users')
    .select('role, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) return redirectToLogin(request, response, 'missing')
  if (BLOCKED_STATUSES.has(profile.status)) return redirectToLogin(request, response, profile.status)
  if (profile.role !== 'admin' && profile.status !== 'approved') return redirectToLogin(request, response, 'pending')

  if (profile.role !== PORTAL_ROLES[portal]) {
    const ownPortal = Object.keys(PORTAL_ROLES).find(prefix => PORTAL_ROLES[prefix] === profile.role)
    return ownPortal
      ? redirectTo(request, response, `${ownPortal}/dashboard`)
      : redirectToLogin(request, response, 'missing')
  }

  return response
}

function redirectToLogin(request: NextRequest, response: NextResponse, reason?: string) {
  return redirectTo(request, response, reason ? `/login?account=${reason}` : '/login')
}

// Carries over any refreshed session cookies so the redirect does not sign the
// user out by accident.
function redirectTo(request: NextRequest, response: NextResponse, path: string) {
  const redirect = NextResponse.redirect(new URL(path, request.url))
  response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
  return redirect
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
