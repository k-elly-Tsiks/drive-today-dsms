'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    let authResult
    try {
      authResult = await supabase.auth.signInWithPassword({
        email,
        password,
      })
    } catch (fetchError) {
      console.error('Supabase fetch error:', fetchError)
      setError(
        'Unable to reach Supabase. Please check your Supabase URL, internet connection, and restart the dev server.'
      )
      setLoading(false)
      return
    }

    const { data, error } = authResult
    console.log('AUTH RESULT:', data)
    console.log('AUTH ERROR:', error)

    if (error || !data?.user) {
      setError(
        error?.message ||
          'Invalid email or password. Please try again.'
      )
      setLoading(false)
      return
    }

    const { data: userRecord, error: userError } = await supabase
      .from('users')
      .select('role, status')
      .eq('user_id', data.user.id)
      .single()

console.log("AUTH USER ID:", data.user.id)
console.log("DB USER RECORD:", userRecord)
console.log("USER ERROR:", userError)

    if (userError ||!userRecord) {
      setError('Account not found. Please contact the administrator.')
      setLoading(false)
      return
    }

    if (userRecord.status === 'pending') {
      setError('Your account is pending approval. Please wait for the administrator.')
      setLoading(false)
      return
    }

    if (userRecord.status === 'suspended') {
      setError('Your account has been suspended. Please contact the administrator.')
      setLoading(false)
      return
    }

    if (userRecord.role === 'learner') router.push('/learner/dashboard')
    if (userRecord.role === 'instructor') router.push('/instructor/dashboard')
    if (userRecord.role === 'admin') router.push('/admin/dashboard')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1920&q=80')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 20, 60, 0.55)' }}
      />

      {/* Glass Card */}
      <div
        className="relative z-10 w-full mx-4"
        style={{ maxWidth: '420px' }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '24px',
            padding: '40px 36px',
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1e3a8a, #f97316)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                boxShadow: '0 4px 20px rgba(249, 115, 22, 0.4)',
              }}
            >
              <span
                style={{
                  color: 'white',
                  fontSize: '26px',
                  fontWeight: '800',
                  letterSpacing: '-1px',
                }}
              >
                DT
              </span>
            </div>
            <h1
              style={{
                color: 'white',
                fontSize: '22px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                marginBottom: '2px',
              }}
            >
              Drive Today
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
              Driving School Management System
            </p>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2
              style={{
                color: 'white',
                fontSize: '26px',
                fontWeight: '700',
                marginBottom: '4px',
              }}
            >
              Login
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px' }}>
              Welcome back, please login to your account
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px',
                padding: '10px 14px',
                marginBottom: '16px',
                color: '#fca5a5',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin}>

            {/* Email Field */}
            <div className="mb-4">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Email Address"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'white',
                    fontSize: '14px',
                  }}
                />
                {/* Email Icon */}
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
            </div>

            {/* Password Field */}
            <div className="mb-4">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                }}
              >
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Password"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'white',
                    fontSize: '14px',
                  }}
                />
                {/* Show/Hide Password Icon */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  {showPassword ? (
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center mb-6">
              <div
                onClick={() => setRememberMe(!rememberMe)}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '6px',
                  border: '2px solid rgba(255,255,255,0.5)',
                  background: rememberMe
                    ? 'linear-gradient(135deg, #1e3a8a, #f97316)'
                    : 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '10px',
                  flexShrink: 0,
                }}
              >
                {rememberMe && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span
                onClick={() => setRememberMe(!rememberMe)}
                style={{
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Remember me
              </span>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                background: loading
                  ? 'rgba(255,255,255,0.2)'
                  : 'linear-gradient(135deg, #1e3a8a, #f97316)',
                color: 'white',
                fontSize: '16px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 20px rgba(249, 115, 22, 0.35)',
                transition: 'all 0.2s ease',
                letterSpacing: '0.5px',
              }}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

          </form>

          {/* Sign Up Link */}
          <p
            style={{
              textAlign: 'center',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              marginTop: '24px',
            }}
          >
            Don&apos;t have an account?{' '}
            <a
              href="/signup"
              style={{
                color: '249,115,22',
                fontWeight: '700',
                textDecoration: 'none',
              }}
            >
              Sign Up
            </a>
          </p>

        </div>
      </div>
    </div>
            )
}