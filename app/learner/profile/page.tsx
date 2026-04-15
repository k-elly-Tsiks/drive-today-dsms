'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type LearnerProfile = {
  user_id: string
  first_name: string
  second_name?: string
  surname: string
  email: string
  id_number?: string
  date_of_birth?: string
  gender?: string
  phone_number?: string
  address?: string
  provisional_expiry?: string
  licence_number?: string
  licence_code?: string
  licence_validity?: string
  driving_class?: string
  slots_allocated?: number
}

type Instructor = {
  first_name: string
  surname: string
  phone_number?: string
  driving_classes_taught?: string
}

const supabase = createClient()

export default function LearnerProfilePage() {
  const [learner, setLearner] = useState<LearnerProfile | null>(null)
  const [instructor, setInstructor] = useState<Instructor | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')

  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [provisionalExpiry, setProvisionalExpiry] = useState('')
  const [licenceNumber, setLicenceNumber] = useState('')
  const [licenceCode, setLicenceCode] = useState('')
  const [licenceValidity, setLicenceValidity] = useState('')
  const [drivingClass, setDrivingClass] = useState('')

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  // ─── Auth + data ─────────────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }

    const { data: learnerData } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user.id)
      .single()

    setLearner(learnerData)

    if (learnerData) {
      setPhone(learnerData.phone_number || '')
      setAddress(learnerData.address || '')
      setProvisionalExpiry(learnerData.provisional_expiry || '')
      setLicenceNumber(learnerData.licence_number || '')
      setLicenceCode(learnerData.licence_code || '')
      setLicenceValidity(learnerData.licence_validity || '')
      setDrivingClass(learnerData.driving_class || '')
    }

    const { data: bookingData } = await supabase
      .from('lesson_bookings')
      .select(`
        instructor:users!lesson_bookings_instructor_id_fkey (
          first_name, surname, phone_number, driving_classes_taught
        )
      `)
      .eq('learner_id', user.id)
      .eq('status', 'scheduled')
      .limit(1)
      .single()

    if (bookingData?.instructor) {
     setInstructor(bookingData.instructor?.[0] ?? null)
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await loadProfile()
    }
    init()
    return () => { cancelled = true }
  }, [loadProfile])

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function saveProfile() {
    if (!phone) { setError('Phone number is required.'); return }

    setSaving(true); setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: updateError } = await supabase
      .from('users')
      .update({
        phone_number: phone,
        address,
        provisional_expiry: provisionalExpiry || null,
        licence_number: licenceNumber || null,
        licence_code: licenceCode || null,
        licence_validity: licenceValidity || null,
        driving_class: drivingClass || null,
      })
      .eq('user_id', user.id)

    if (updateError) { setError('Failed to update profile.'); setSaving(false); return }

    setSuccessMessage('Profile updated successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    setEditing(false); setSaving(false)
    loadProfile()
  }

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: lightBlue }}>
        <p style={{ color: blue, fontWeight: '600' }}>Loading Profile...</p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>👤 My Profile</h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>View and update your personal information</p>
        </div>
        <button
          onClick={() => router.push('/learner/dashboard')}
          style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: blue, color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
        >
          ← Dashboard
        </button>
      </div>

      {/* Success / Error */}
      {successMessage && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#065f46', fontSize: '13px', fontWeight: '600' }}>
          ✅ {successMessage}
        </div>
      )}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#991b1b', fontSize: '13px', fontWeight: '600' }}>
          ❌ {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

        {/* Profile card */}
        <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          {/* Avatar */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: `linear-gradient(135deg, ${blue}, ${orange})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '28px', fontWeight: '800', color: 'white' }}>
              {learner?.first_name?.charAt(0)}{learner?.surname?.charAt(0)}
            </div>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 4px' }}>
              {learner?.first_name} {learner?.second_name} {learner?.surname}
            </h2>
            <span style={{ background: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
              ✅ Approved Learner
            </span>
          </div>

          {/* Personal details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ color: blue, fontSize: '13px', fontWeight: '700', margin: 0, paddingBottom: '8px', borderBottom: '1px solid #f3f4f6' }}>
              Personal Information
            </h3>

            {[
              { label: 'ID Number',    value: learner?.id_number,     icon: '🪪' },
              { label: 'Date of Birth', value: learner?.date_of_birth ? new Date(learner.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null, icon: '🎂' },
              { label: 'Gender',       value: learner?.gender,        icon: '👤' },
              { label: 'Email',        value: learner?.email,         icon: '📧' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '16px', flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>{item.label}</p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#374151' }}>{item.value || '—'}</p>
                </div>
              </div>
            ))}

            {/* Editable fields */}
            {editing ? (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Phone Number *</label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>Residential Address</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} />
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '16px' }}>📱</span>
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>Phone Number</p>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#374151' }}>{learner?.phone_number || '—'}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '16px' }}>🏠</span>
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>Address</p>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#374151' }}>{learner?.address || '—'}</p>
                  </div>
                </div>
              </>
            )}

            {editing ? (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => { setEditing(false); setError('') }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveProfile} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: saving ? '#e5e7eb' : `linear-gradient(135deg, ${blue}, ${orange})`, color: saving ? '#9ca3af' : 'white', fontSize: '13px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `2px solid ${blue}`, background: 'white', color: blue, fontSize: '13px', fontWeight: '700', cursor: 'pointer', marginTop: '8px' }}>
                ✏️ Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Licence information */}
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ color: blue, fontSize: '14px', fontWeight: '700', margin: '0 0 16px', paddingBottom: '8px', borderBottom: '1px solid #f3f4f6' }}>
              🚗 Licence Information
            </h3>

            {editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Driving Class',              input: <select value={drivingClass} onChange={e => setDrivingClass(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }}><option value="">Select...</option>{['Provisional', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'].map(c => <option key={c} value={c}>{c}</option>)}</select> },
                  { label: 'Provisional Licence Expiry', input: <input type="date" value={provisionalExpiry} onChange={e => setProvisionalExpiry(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} /> },
                  { label: 'Licence Number',             input: <input type="text" value={licenceNumber} onChange={e => setLicenceNumber(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} /> },
                  { label: 'Licence Code',               input: <input type="text" value={licenceCode} onChange={e => setLicenceCode(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} /> },
                  { label: 'Licence Validity',           input: <input type="date" value={licenceValidity} onChange={e => setLicenceValidity(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} /> },
                ].map((field, i) => (
                  <div key={i}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>{field.label}</label>
                    {field.input}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Driving Class',      value: learner?.driving_class },
                  { label: 'Provisional Expiry', value: learner?.provisional_expiry ? new Date(learner.provisional_expiry).toLocaleDateString('en-GB') : null },
                  { label: 'Licence Number',     value: learner?.licence_number },
                  { label: 'Licence Code',       value: learner?.licence_code },
                  { label: 'Licence Validity',   value: learner?.licence_validity ? new Date(learner.licence_validity).toLocaleDateString('en-GB') : null },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none' }}>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{item.label}</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: item.value ? '#374151' : '#9ca3af' }}>{item.value || 'Not provided'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned instructor */}
          <div style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ color: blue, fontSize: '14px', fontWeight: '700', margin: '0 0 16px', paddingBottom: '8px', borderBottom: '1px solid #f3f4f6' }}>
              👨‍🏫 Assigned Instructor
            </h3>
            {instructor ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: `linear-gradient(135deg, ${blue}, ${orange})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '18px', flexShrink: 0 }}>
                  {instructor.first_name?.charAt(0)}{instructor.surname?.charAt(0)}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#111827' }}>{instructor.first_name} {instructor.surname}</p>
                  <p style={{ margin: '2px 0', fontSize: '12px', color: '#6b7280' }}>📱 {instructor.phone_number}</p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>🚗 {instructor.driving_classes_taught || 'All classes'}</p>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontSize: '32px', margin: '0 0 8px' }}>👨‍🏫</p>
                <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>No instructor assigned yet. Book a lesson to get assigned an instructor.</p>
              </div>
            )}
          </div>

          {/* Lesson allocation */}
          <div style={{ background: `linear-gradient(135deg, ${blue}, #2d4fa3)`, borderRadius: '14px', padding: '20px' }}>
            <h3 style={{ color: 'white', fontSize: '14px', fontWeight: '700', margin: '0 0 16px' }}>📅 Lesson Allocation</h3>
            <p style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: 'white' }}>{learner?.slots_allocated || 0}</p>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Slots Allocated</p>
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.65)' }}>
              Contact the administrator to request additional lesson slots.
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}
