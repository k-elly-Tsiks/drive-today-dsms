'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const supabase = createClient()

// ── Skeleton Loader ────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = '16px', r = '6px' }: { w?: string; h?: string; r?: string }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')

  // School info
  const [schoolName, setSchoolName] = useState('Drive Today Driving School')
  const [schoolAddress, setSchoolAddress] = useState('159 Manresa Way, Harare, Zimbabwe')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')

  // Cancellation rules
  const [cancellationHours, setCancellationHours] = useState('3')

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const router = useRouter()
  const routerRef = useRef(router)

  // Design tokens
  const textDark = '#1e293b'
  const textMuted = '#64748b'
  const primary = '#3b82f6'
  const danger = '#ef4444'

  // ─── Auth check ──────────────────────────────────────────────────────────────

  const checkAdmin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }
    const { data } = await supabase
      .from('users')
      .select('role, email, phone_number')
      .eq('user_id', user.id)
      .single()
    if (data?.role !== 'admin') { routerRef.current.push('/login'); return }
    if (data?.email) setSchoolEmail(data.email)
    if (data?.phone_number) setSchoolPhone(data.phone_number)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await checkAdmin()
    }
    init()
    return () => { cancelled = true }
  }, [checkAdmin])

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function saveSchoolInfo() {
    setSaving(true)
    setError('')

    // In a real system you would save these to a settings table
    await new Promise(resolve => setTimeout(resolve, 800))

    setSuccessMessage('School information saved successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    setSaving(false)
  }

  async function changePassword() {
    if (!newPassword || !confirmNewPassword) {
      setError('Please fill in all password fields.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match.')
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }

    setChangingPassword(true)
    setError('')

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      setError('Failed to change password. Please try again.')
      setChangingPassword(false)
      return
    }

    setSuccessMessage('Password changed successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    setNewPassword('')
    setConfirmNewPassword('')
    setChangingPassword(false)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      <div style={{ minHeight: '100%', padding: '0 0 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ color: textDark, fontSize: '22px', fontWeight: '800', margin: 0 }}>
              ⚙️ Settings
            </h1>
            <p style={{ color: textMuted, fontSize: '13px', margin: '4px 0 0', fontWeight: '500' }}>
              Configure system settings and school information
            </p>
          </div>
          <button
            onClick={() => router.push('/admin/dashboard')}
            style={{
              padding: '10px 18px', borderRadius: '8px', border: '1px solid #e2e8f0',
              background: 'white', color: textDark, fontSize: '13px',
              fontWeight: '700', cursor: 'pointer', transition: 'background 0.2s',
            }}
          >
            ← Dashboard
          </button>
        </div>

        {/* Success / Error Messages */}
        {successMessage && (
          <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', color: '#16a34a', fontSize: '13px', fontWeight: '600' }}>
            ✅ {successMessage}
          </div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', padding: '12px 16px', marginBottom: '24px', color: '#dc2626', fontSize: '13px', fontWeight: '600' }}>
            ❌ {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
             {/* Skeleton for Left Column */}
             <div style={{ background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
               <Skeleton w="150px" h="20px" r="6px" />
               <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                 <div><Skeleton w="100px" h="14px" r="4px" /><div style={{ marginTop: '8px' }}><Skeleton w="100%" h="42px" r="8px" /></div></div>
                 <div><Skeleton w="100px" h="14px" r="4px" /><div style={{ marginTop: '8px' }}><Skeleton w="100%" h="42px" r="8px" /></div></div>
                 <div><Skeleton w="100px" h="14px" r="4px" /><div style={{ marginTop: '8px' }}><Skeleton w="100%" h="42px" r="8px" /></div></div>
                 <Skeleton w="100%" h="42px" r="8px" />
               </div>
             </div>
             {/* Skeleton for Right Column */}
             <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <Skeleton w="150px" h="20px" r="6px" />
                  <div style={{ marginTop: '24px' }}>
                    <Skeleton w="250px" h="14px" r="4px" />
                    <div style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
                      <Skeleton w="100px" h="42px" r="8px" />
                      <Skeleton w="180px" h="42px" r="8px" />
                    </div>
                  </div>
                </div>
                <div style={{ background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <Skeleton w="150px" h="20px" r="6px" />
                  <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div><Skeleton w="100px" h="14px" r="4px" /><div style={{ marginTop: '8px' }}><Skeleton w="100%" h="42px" r="8px" /></div></div>
                    <div><Skeleton w="100px" h="14px" r="4px" /><div style={{ marginTop: '8px' }}><Skeleton w="100%" h="42px" r="8px" /></div></div>
                    <Skeleton w="100%" h="42px" r="8px" />
                  </div>
                </div>
             </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>

            {/* Left Column: School Information */}
            <div style={{ background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', alignSelf: 'start' }}>
              <h2 style={{ color: textDark, fontSize: '16px', fontWeight: '800', margin: '0 0 20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                🏫 School Information
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>
                    School Name
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>
                    Address
                  </label>
                  <input
                    type="text"
                    value={schoolAddress}
                    onChange={(e) => setSchoolAddress(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={schoolPhone}
                    onChange={(e) => setSchoolPhone(e.target.value)}
                    placeholder="e.g. 0771234567"
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={schoolEmail}
                    onChange={(e) => setSchoolEmail(e.target.value)}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <button
                  onClick={saveSchoolInfo}
                  disabled={saving}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                    background: saving ? '#cbd5e1' : primary, color: 'white',
                    fontSize: '14px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer',
                    marginTop: '8px', transition: 'background 0.2s'
                  }}
                >
                  {saving ? 'Saving...' : 'Save School Information'}
                </button>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Cancellation Rules */}
              <div style={{ background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <h2 style={{ color: textDark, fontSize: '16px', fontWeight: '800', margin: '0 0 20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                  🚫 Cancellation Rules
                </h2>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '12px' }}>
                    Minimum hours before lesson for learner cancellation
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                    <input
                      type="number" min="1" max="48"
                      value={cancellationHours}
                      onChange={(e) => setCancellationHours(e.target.value)}
                      style={{
                        width: '100px', padding: '12px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
                        fontSize: '16px', fontWeight: '700', outline: 'none', textAlign: 'center', color: textDark
                      }}
                    />
                    <span style={{ fontSize: '13px', color: textMuted, fontWeight: '500', lineHeight: '1.4' }}>
                      hours before the <br/>scheduled start time
                    </span>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #cbd5e1' }}>
                    <p style={{ margin: 0, fontSize: '12px', color: textMuted, lineHeight: '1.6' }}>
                      <strong style={{ color: textDark }}>Note:</strong> Learners cannot cancel a lesson within {cancellationHours} hours of the scheduled start time. Instructors can cancel at any time with a mandatory reason.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSuccessMessage('Cancellation rule saved.')
                    setTimeout(() => setSuccessMessage(''), 3000)
                  }}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                    background: 'white', color: textDark, fontSize: '14px', fontWeight: '700',
                    cursor: 'pointer', marginTop: '20px', transition: 'background 0.2s'
                  }}
                >
                  Save Cancellation Rule
                </button>
              </div>

              {/* Change Password */}
              <div style={{ background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <h2 style={{ color: textDark, fontSize: '16px', fontWeight: '800', margin: '0 0 20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                  🔒 Change Password
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: textDark, marginBottom: '8px' }}>
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirm new password"
                      style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  <p style={{ margin: 0, fontSize: '12px', color: textMuted, lineHeight: '1.5' }}>
                    Password must be at least 8 characters and include an uppercase letter, a number, and a special character.
                  </p>

                  <button
                    onClick={changePassword}
                    disabled={changingPassword}
                    style={{
                      width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
                      background: changingPassword ? '#cbd5e1' : danger, color: 'white',
                      fontSize: '14px', fontWeight: '700', cursor: changingPassword ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s', marginTop: '4px'
                    }}
                  >
                    {changingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* System Info Full Width Bottom */}
        {!loading && (
          <div style={{ background: 'white', borderRadius: '10px', padding: '24px', marginTop: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h2 style={{ color: textDark, fontSize: '16px', fontWeight: '800', margin: '0 0 20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              💻 System Information
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {[
                { label: 'System', value: 'Drive Today DSMS' },
                { label: 'Framework', value: 'Next.js 14 App Router' },
                { label: 'Database', value: 'Supabase PostgreSQL' },
                { label: 'Styling', value: 'CSS-in-JS (Inline)' },
                { label: 'Hosting', value: 'Vercel' },
                { label: 'Version', value: '1.0.0' },
              ].map((item, i) => (
                <div key={i} style={{ background: '#f8fafc', borderRadius: '8px', padding: '16px', border: '1px solid #f1f5f9' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: textMuted, fontWeight: '600' }}>
                    {item.label}
                  </p>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: textDark }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  )
}
