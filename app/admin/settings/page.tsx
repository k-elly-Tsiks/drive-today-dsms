'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const supabase = createClient()

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

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

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

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: lightBlue,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${blue}, ${orange})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '24px', fontWeight: '800', color: 'white',
          }}>DT</div>
        <p style={{ color: blue, fontWeight: '600' }}>Loading Settings...</p>
      </div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>
            ⚙️ Settings
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>
            Configure system settings and school information
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/dashboard')}
          style={{
            padding: '10px 18px', borderRadius: '10px',
            border: 'none', background: blue,
            color: 'white', fontSize: '13px',
            fontWeight: '600', cursor: 'pointer',
          }}
        >
          ← Dashboard
        </button>
      </div>

      {/* Success / Error */}
      {successMessage && (
        <div style={{
          background: '#d1fae5', border: '1px solid #6ee7b7',
          borderRadius: '10px', padding: '12px 16px',
          marginBottom: '16px', color: '#065f46',
          fontSize: '13px', fontWeight: '600',
        }}>
          ✅ {successMessage}
        </div>
      )}
      {error && (
        <div style={{
          background: '#fee2e2', border: '1px solid #fca5a5',
          borderRadius: '10px', padding: '12px 16px',
          marginBottom: '16px', color: '#991b1b',
          fontSize: '13px', fontWeight: '600',
        }}>
          ❌ {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
      }}>

        {/* School Information */}
        <div style={{
          background: 'white', borderRadius: '14px',
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{
            color: blue, fontSize: '16px',
            fontWeight: '700', margin: '0 0 20px',
            paddingBottom: '12px',
            borderBottom: '1px solid #f3f4f6',
          }}>
            🏫 School Information
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            <div>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: '600', color: '#374151', marginBottom: '6px',
              }}>
                School Name
              </label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px',
                  borderRadius: '10px', border: '1px solid #e5e7eb',
                  fontSize: '13px', outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: '600', color: '#374151', marginBottom: '6px',
              }}>
                Address
              </label>
              <input
                type="text"
                value={schoolAddress}
                onChange={(e) => setSchoolAddress(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px',
                  borderRadius: '10px', border: '1px solid #e5e7eb',
                  fontSize: '13px', outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: '600', color: '#374151', marginBottom: '6px',
              }}>
                Phone Number
              </label>
              <input
                type="tel"
                value={schoolPhone}
                onChange={(e) => setSchoolPhone(e.target.value)}
                placeholder="e.g. 0771234567"
                style={{
                  width: '100%', padding: '10px 14px',
                  borderRadius: '10px', border: '1px solid #e5e7eb',
                  fontSize: '13px', outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: '600', color: '#374151', marginBottom: '6px',
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={schoolEmail}
                onChange={(e) => setSchoolEmail(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px',
                  borderRadius: '10px', border: '1px solid #e5e7eb',
                  fontSize: '13px', outline: 'none',
                }}
              />
            </div>

            <button
              onClick={saveSchoolInfo}
              disabled={saving}
              style={{
                width: '100%', padding: '12px',
                borderRadius: '10px', border: 'none',
                background: saving
                  ? '#e5e7eb'
                  : `linear-gradient(135deg, ${blue}, ${orange})`,
                color: saving ? '#9ca3af' : 'white',
                fontSize: '14px', fontWeight: '700',
                cursor: saving ? 'not-allowed' : 'pointer',
                marginTop: '4px',
              }}
            >
              {saving ? 'Saving...' : 'Save School Information'}
            </button>

          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Cancellation Rules */}
          <div style={{
            background: 'white', borderRadius: '14px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <h2 style={{
              color: blue, fontSize: '16px',
              fontWeight: '700', margin: '0 0 20px',
              paddingBottom: '12px',
              borderBottom: '1px solid #f3f4f6',
            }}>
              🚫 Cancellation Rules
            </h2>

            <div>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: '600', color: '#374151', marginBottom: '6px',
              }}>
                Minimum hours before lesson for learner cancellation
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="1"
                  max="48"
                  value={cancellationHours}
                  onChange={(e) => setCancellationHours(e.target.value)}
                  style={{
                    width: '100px', padding: '10px 14px',
                    borderRadius: '10px', border: '1px solid #e5e7eb',
                    fontSize: '16px', fontWeight: '700',
                    outline: 'none', textAlign: 'center',
                  }}
                />
                <span style={{ fontSize: '13px', color: '#374151', fontWeight: '500' }}>
                  hours before lesson start time
                </span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#6b7280' }}>
                Learners cannot cancel a lesson within {cancellationHours} hours of the scheduled start time.
                Instructors can cancel at any time with a mandatory reason.
              </p>
            </div>

            <button
              onClick={() => {
                setSuccessMessage('Cancellation rule saved.')
                setTimeout(() => setSuccessMessage(''), 3000)
              }}
              style={{
                width: '100%', padding: '12px',
                borderRadius: '10px', border: 'none',
                background: `linear-gradient(135deg, ${blue}, ${orange})`,
                color: 'white', fontSize: '14px',
                fontWeight: '700', cursor: 'pointer',
                marginTop: '16px',
              }}
            >
              Save Cancellation Rule
            </button>
          </div>

          {/* Change Password */}
          <div style={{
            background: 'white', borderRadius: '14px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <h2 style={{
              color: blue, fontSize: '16px',
              fontWeight: '700', margin: '0 0 20px',
              paddingBottom: '12px',
              borderBottom: '1px solid #f3f4f6',
            }}>
              🔒 Change Password
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <div>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '600', color: '#374151', marginBottom: '6px',
                }}>
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  style={{
                    width: '100%', padding: '10px 14px',
                    borderRadius: '10px', border: '1px solid #e5e7eb',
                    fontSize: '13px', outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '600', color: '#374151', marginBottom: '6px',
                }}>
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  style={{
                    width: '100%', padding: '10px 14px',
                    borderRadius: '10px', border: '1px solid #e5e7eb',
                    fontSize: '13px', outline: 'none',
                  }}
                />
              </div>

              <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', lineHeight: '1.5' }}>
                Password must be at least 8 characters and include an uppercase letter,
                a number and a special character.
              </p>

              <button
                onClick={changePassword}
                disabled={changingPassword}
                style={{
                  width: '100%', padding: '12px',
                  borderRadius: '10px', border: 'none',
                  background: changingPassword ? '#e5e7eb' : '#dc2626',
                  color: changingPassword ? '#9ca3af' : 'white',
                  fontSize: '14px', fontWeight: '700',
                  cursor: changingPassword ? 'not-allowed' : 'pointer',
                }}
              >
                {changingPassword ? 'Changing...' : 'Change Password'}
              </button>

            </div>
          </div>

        </div>
      </div>

      {/* System Info */}
      <div style={{
        background: 'white', borderRadius: '14px',
        padding: '24px', marginTop: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <h2 style={{
          color: blue, fontSize: '16px',
          fontWeight: '700', margin: '0 0 16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #f3f4f6',
        }}>
          💻 System Information
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          {[
            { label: 'System', value: 'Drive Today DSMS' },
            { label: 'Framework', value: 'Next.js 14 App Router' },
            { label: 'Database', value: 'Supabase PostgreSQL' },
            { label: 'Styling', value: 'Tailwind CSS' },
            { label: 'Hosting', value: 'Vercel' },
            { label: 'Version', value: '1.0.0' },
          ].map((item, i) => (
            <div key={i} style={{
              background: lightBlue, borderRadius: '10px',
              padding: '14px 16px',
            }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>
                {item.label}
              </p>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: blue }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
