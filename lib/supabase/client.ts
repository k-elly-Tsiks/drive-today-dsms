import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables. Define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
  )
}

const supabaseClient: ReturnType<typeof createBrowserClient> | null =
  supabaseUrl && supabaseAnonKey
    ? createBrowserClient(supabaseUrl, supabaseAnonKey)
    : null

export function createClient(): ReturnType<typeof createBrowserClient> | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null; // Ensure createClient also returns null if env vars are missing
  }

  return supabaseClient
}