'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const [step, setStep] = useState(1)
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Shared fields
  const [firstName, setFirstName] = useState('')
  const [secondName, setSecondName] = useState('')
  const [surname, setSurname] = useState('')
  const [idNumber, setIdNumber] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Learner only fields
  const [provisionalExpiry, setProvisionalExpiry] = useState('')
  const [drivingClass, setDrivingClass] = useState('')
  const [licenceNumber, setLicenceNumber] = useState('')
  const [licenceCode, setLicenceCode] = useState('')
  const [licenceValidity, setLicenceValidity] = useState('')

  // Instructor only fields
  const [instructorLicenceNumber, setInstructorLicenceNumber] = useState('')
  const [instructorLicenceCode, setInstructorLicenceCode] = useState('')
  const [instructorLicenceValidity, setInstructorLicenceValidity] = useState('')
  const [drivingClasses, setDrivingClasses] = useState<string[]>([])

  const drivingClassOptions = [
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Provisional'
  ]

  function toggleDrivingClass(cls: string) {
    setDrivingClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validate password
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      setLoading(false)
      return
    }

    // Validate phone
    if (phone.length < 10) {
      setError('Please enter a valid phone number.')
      setLoading(false)
      return
    }

    // Create auth account
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Insert into users table
    const { error: dbError } = await supabase.from('users').insert({
      user_id: data.user.id,
      first_name: firstName,
      second_name: secondName,
      surname: surname,
      email: email,
      phone_number: phone,
      role: role,
      status: 'pending',
    })

    if (dbError) {
      setError('Failed to save your details. Please try again.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  // ── SUCCESS SCREEN ─────────────────────────────────────────────
  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1920&q=80')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0, 20, 60, 0.55)' }} />
        <div className="relative z-10 w-full mx-4" style={{ maxWidth: '420px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '24px',
            padding: '40px 36px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e3a8a, #f97316)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 style={{ color: 'white', fontSize: '22px', fontWeight: '800', marginBottom: '8px' }}>
              Registration Submitted!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>
              Your account is pending approval. The administrator will review your registration and notify you via email once approved.
            </p>
            <button
              onClick={() => router.push('/login')}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px',
                border: 'none', background: 'linear-gradient(135deg, #1e3a8a, #f97316)',
                color: 'white', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
              }}
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── BACKGROUND WRAPPER ─────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex items-center justify-center relative py-8"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1920&q=80')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0, 20, 60, 0.55)' }} />

      <div className="relative z-10 w-full mx-4" style={{ maxWidth: '480px' }}>
        <div style={{
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.25)',
          borderRadius: '24px',
          padding: '40px 36px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}>

          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #1e3a8a, #f97316)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '10px',
              boxShadow: '0 4px 20px rgba(249,115,22,0.4)',
            }}>
              <span style={{ color: 'white', fontSize: '22px', fontWeight: '800' }}>DT</span>
            </div>
            <h1 style={{ color: 'white', fontSize: '20px', fontWeight: '800' }}>Drive Today</h1>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px' }}>
              Driving School Management System
            </p>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 style={{ color: 'white', fontSize: '22px', fontWeight: '700', marginBottom: '4px' }}>
              Create Account
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px' }}>
              Fill in your details to register
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: step >= s
                    ? 'linear-gradient(135deg, #1e3a8a, #f97316)'
                    : 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '13px', fontWeight: '700',
                  flexShrink: 0,
                }}>
                  {step > s ? (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : s}
                </div>
                {s < 3 && (
                  <div style={{
                    flex: 1, height: '2px', margin: '0 6px',
                    background: step > s
                      ? 'linear-gradient(90deg, #1e3a8a, #f97316)'
                      : 'rgba(255,255,255,0.2)',
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Step Labels */}
          <div className="flex justify-between mb-6">
            {['Role', 'Personal Info', 'Account'].map((label, i) => (
              <span key={i} style={{
                color: step === i + 1 ? '#f97316' : 'rgba(255,255,255,0.5)',
                fontSize: '11px', fontWeight: step === i + 1 ? '700' : '400',
              }}>
                {label}
              </span>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.2)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: '10px', padding: '10px 14px',
              marginBottom: '16px', color: '#fca5a5', fontSize: '13px',
            }}>
              {error}
            </div>
          )}

          {/* ── STEP 1 — ROLE SELECTION ── */}
          {step === 1 && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '14px', marginBottom: '16px' }}>
                I am registering as a:
              </p>
              <div className="flex flex-col gap-3 mb-6">
                {['learner', 'instructor'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    style={{
                      padding: '16px',
                      borderRadius: '12px',
                      border: role === r
                        ? '2px solid #f97316'
                        : '1px solid rgba(255,255,255,0.25)',
                      background: role === r
                        ? 'rgba(249,115,22,0.15)'
                        : 'rgba(255,255,255,0.08)',
                      color: 'white',
                      fontSize: '15px',
                      fontWeight: role === r ? '700' : '400',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ fontWeight: '700', marginBottom: '4px', textTransform: 'capitalize' }}>
                      {r === 'learner' ? '🎓 Learner' : '🚗 Instructor'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                      {r === 'learner'
                        ? 'I want to learn how to drive'
                        : 'I am a qualified driving instructor'}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  if (!role) { setError('Please select a role to continue.'); return }
                  setError('')
                  setStep(2)
                }}
                style={{
                  width: '100%', padding: '14px', borderRadius: '12px',
                  border: 'none', background: 'linear-gradient(135deg, #1e3a8a, #f97316)',
                  color: 'white', fontSize: '15px', fontWeight: '700', cursor: 'pointer',
                }}
              >
                Continue
              </button>
            </div>
          )}

          {/* ── STEP 2 — PERSONAL INFO ── */}
          {step === 2 && (
            <form onSubmit={(e) => { e.preventDefault(); setError(''); setStep(3) }}>
              <div className="flex flex-col gap-3 mb-4">

                {/* First Name */}
                <input
                  type="text" value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required placeholder="First Name"
                  style={inputStyle}
                />

                {/* Second Name */}
                <input
                  type="text" value={secondName}
                  onChange={(e) => setSecondName(e.target.value)}
                  placeholder="Second Name (optional)"
                  style={inputStyle}
                />

                {/* Surname */}
                <input
                  type="text" value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  required placeholder="Surname"
                  style={inputStyle}
                />

                {/* ID Number */}
                <input
                  type="text" value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  required placeholder="ID Number"
                  style={inputStyle}
                />

                {/* Date of Birth */}
                <div>
                  <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                    Date of Birth
                  </label>
                  <input
                    type="date" value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    required style={inputStyle}
                  />
                </div>

                {/* Gender */}
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required style={inputStyle}
                >
                  <option value="" style={{ background: '#1e3a8a' }}>Select Gender</option>
                  <option value="Male" style={{ background: '#1e3a8a' }}>Male</option>
                  <option value="Female" style={{ background: '#1e3a8a' }}>Female</option>
                  <option value="Other" style={{ background: '#1e3a8a' }}>Other</option>
                </select>

                {/* Phone */}
                <input
                  type="tel" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required placeholder="Phone Number"
                  style={inputStyle}
                />

                {/* Address */}
                <input
                  type="text" value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required placeholder="Residential Address"
                  style={inputStyle}
                />

                {/* LEARNER OPTIONAL FIELDS */}
                {role === 'learner' && (
                  <>
                    <div style={{
                      borderTop: '1px solid rgba(255,255,255,0.15)',
                      paddingTop: '12px',
                      marginTop: '4px',
                    }}>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '10px' }}>
                        Optional — Licence Information
                      </p>
                      <div className="flex flex-col gap-3">
                        <div>
                          <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                            Provisional Licence Expiry Date
                          </label>
                          <input
                            type="date" value={provisionalExpiry}
                            onChange={(e) => setProvisionalExpiry(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <select
                          value={drivingClass}
                          onChange={(e) => setDrivingClass(e.target.value)}
                          style={inputStyle}
                        >
                          <option value="" style={{ background: '#1e3a8a' }}>Driving Class Required (optional)</option>
                          {drivingClassOptions.map(c => (
                            <option key={c} value={c} style={{ background: '#1e3a8a' }}>{c}</option>
                          ))}
                        </select>
                        <input
                          type="text" value={licenceNumber}
                          onChange={(e) => setLicenceNumber(e.target.value)}
                          placeholder="Licence Number (optional)"
                          style={inputStyle}
                        />
                        <input
                          type="text" value={licenceCode}
                          onChange={(e) => setLicenceCode(e.target.value)}
                          placeholder="Licence Code (optional)"
                          style={inputStyle}
                        />
                        <div>
                          <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                            Licence Validity (optional)
                          </label>
                          <input
                            type="date" value={licenceValidity}
                            onChange={(e) => setLicenceValidity(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* INSTRUCTOR FIELDS */}
                {role === 'instructor' && (
                  <>
                    <div style={{
                      borderTop: '1px solid rgba(255,255,255,0.15)',
                      paddingTop: '12px',
                      marginTop: '4px',
                    }}>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '10px' }}>
                        Licence Information
                      </p>
                      <div className="flex flex-col gap-3">
                        <input
                          type="text" value={instructorLicenceNumber}
                          onChange={(e) => setInstructorLicenceNumber(e.target.value)}
                          required placeholder="Licence Number"
                          style={inputStyle}
                        />
                        <input
                          type="text" value={instructorLicenceCode}
                          onChange={(e) => setInstructorLicenceCode(e.target.value)}
                          required placeholder="Licence Code"
                          style={inputStyle}
                        />
                        <div>
                          <label style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                            Licence Validity
                          </label>
                          <input
                            type="date" value={instructorLicenceValidity}
                            onChange={(e) => setInstructorLicenceValidity(e.target.value)}
                            required style={inputStyle}
                          />
                        </div>
                        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginBottom: '6px' }}>
                          Driving Classes You Can Teach:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {drivingClassOptions.map(cls => (
                            <button
                              key={cls}
                              type="button"
                              onClick={() => toggleDrivingClass(cls)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '20px',
                                border: drivingClasses.includes(cls)
                                  ? '2px solid #f97316'
                                  : '1px solid rgba(255,255,255,0.3)',
                                background: drivingClasses.includes(cls)
                                  ? 'rgba(249,115,22,0.2)'
                                  : 'rgba(255,255,255,0.08)',
                                color: 'white',
                                fontSize: '12px',
                                fontWeight: drivingClasses.includes(cls) ? '700' : '400',
                                cursor: 'pointer',
                              }}
                            >
                              {cls}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setError(''); setStep(1) }}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'transparent', color: 'white',
                    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 2, padding: '14px', borderRadius: '12px',
                    border: 'none', background: 'linear-gradient(135deg, #1e3a8a, #f97316)',
                    color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                  }}
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {/* ── STEP 3 — ACCOUNT SETUP ── */}
          {step === 3 && (
            <form onSubmit={handleSubmit}>
              <div className="flex flex-col gap-3 mb-4">

                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required placeholder="Email Address"
                  style={inputStyle}
                />

                <input
                  type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required placeholder="Password (min 8 characters)"
                  style={inputStyle}
                />

                <input
                  type="password" value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required placeholder="Confirm Password"
                  style={inputStyle}
                />

                {/* Password strength hint */}
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', lineHeight: '1.5' }}>
                  Password must be at least 8 characters and include an uppercase letter, a number and a special character.
                </p>

              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setError(''); setStep(2) }}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'transparent', color: 'white',
                    fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 2, padding: '14px', borderRadius: '12px',
                    border: 'none',
                    background: loading
                      ? 'rgba(255,255,255,0.2)'
                      : 'linear-gradient(135deg, #1e3a8a, #f97316)',
                    color: 'white', fontSize: '14px', fontWeight: '700',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}

          {/* Login Link */}
          <p style={{
            textAlign: 'center', color: 'rgba(255,255,255,0.7)',
            fontSize: '13px', marginTop: '20px',
          }}>
            Already have an account?{' '}
            <a href="/login" style={{ color: '#f97316', fontWeight: '700', textDecoration: 'none' }}>
              Login
            </a>
          </p>

        </div>
      </div>
    </div>
  )
}

// ── INPUT STYLE ─────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.3)',
  background: 'rgba(255,255,255,0.15)',
  color: 'white',
  fontSize: '14px',
  outline: 'none',
}