'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Booking = {
  booking_id: string
  learner_id: string
  lesson_slots?: { slot_date: string; slot_time: string }
  learner?: { first_name: string; surname: string; user_id?: string }
}

type ProgressRecord = {
  progress_id: string
  booking_id: string
  recorded_at: string
  steering_rating: number
  parking_rating: number
  reversing_rating: number
  road_awareness_rating: number
  comments?: string
  learner?: { first_name: string; surname: string }
  booking?: { lesson_slots?: { slot_date: string; slot_time: string } }
}

const supabase = createClient()

export default function InstructorProgressPage() {
  const [completedBookings, setCompletedBookings] = useState<Booking[]>([])
  const [progressRecords, setProgressRecords] = useState<ProgressRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [saving, setSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('record')

  const [steeringRating, setSteeringRating] = useState(0)
  const [parkingRating, setParkingRating] = useState(0)
  const [reversingRating, setReversingRating] = useState(0)
  const [roadAwarenessRating, setRoadAwarenessRating] = useState(0)
  const [comments, setComments] = useState('')

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }

    const { data: bookingsData } = await supabase
      .from('lesson_bookings')
      .select(`*, lesson_slots (slot_date, slot_time), learner:users!lesson_bookings_learner_id_fkey (first_name, surname, user_id)`)
      .eq('instructor_id', user.id).eq('status', 'completed')
      .order('created_at', { ascending: false })

    const { data: progressData } = await supabase
      .from('progress_tracking')
      .select(`*, learner:users!progress_tracking_learner_id_fkey (first_name, surname), booking:lesson_bookings!progress_tracking_booking_id_fkey (lesson_slots (slot_date, slot_time))`)
      .eq('instructor_id', user.id)
      .order('recorded_at', { ascending: false })

    const progressBookingIds = new Set(progressData?.map(p => p.booking_id))
    const pendingBookings = bookingsData?.filter(b => !progressBookingIds.has(b.booking_id)) || []

    setCompletedBookings(pendingBookings)
    setProgressRecords(progressData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() { if (!cancelled) await loadData() }
    init()
    return () => { cancelled = true }
  }, [loadData])

  async function saveProgress() {
    if (!steeringRating || !parkingRating || !reversingRating || !roadAwarenessRating) {
      setError('Please rate all four skill areas.'); return
    }
    if (!comments.trim()) { setError('Please enter feedback comments.'); return }
    if (!selectedBooking) return

    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: insertError } = await supabase.from('progress_tracking').insert({
      booking_id: selectedBooking.booking_id,
      learner_id: selectedBooking.learner_id,
      instructor_id: user.id,
      steering_rating: steeringRating,
      parking_rating: parkingRating,
      reversing_rating: reversingRating,
      road_awareness_rating: roadAwarenessRating,
      comments,
    })

    if (insertError) { setError('Failed to save progress record.'); setSaving(false); return }

    await supabase.from('notifications').insert({
      recipient_id: selectedBooking.learner_id,
      message: `Your instructor has recorded progress for your lesson on ${selectedBooking.lesson_slots?.slot_date}. Check your progress page.`,
      type: 'lesson_reminder',
    })

    setSuccessMessage(`Progress recorded for ${selectedBooking.learner?.first_name} ${selectedBooking.learner?.surname}.`)
    setTimeout(() => setSuccessMessage(''), 3000)
    setShowModal(false); setSelectedBooking(null)
    setSteeringRating(0); setParkingRating(0); setReversingRating(0); setRoadAwarenessRating(0); setComments('')
    setSaving(false)
    loadData()
  }

  function avgRating(record: ProgressRecord) {
    const ratings = [record.steering_rating, record.parking_rating, record.reversing_rating, record.road_awareness_rating]
      .filter((r): r is number => r !== null && r !== undefined)
    if (!ratings.length) return 0
    return (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
  }

  function ratingColour(rating: number) {
    if (rating >= 4) return '#059669'
    if (rating >= 3) return orange
    return '#dc2626'
  }

  function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
    return (
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>{label}</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star} type="button" onClick={() => onChange(star)}
              style={{ width: '40px', height: '40px', borderRadius: '8px', border: 'none', background: star <= value ? `linear-gradient(135deg, ${blue}, ${orange})` : '#f3f4f6', color: star <= value ? 'white' : '#9ca3af', fontSize: '16px', cursor: 'pointer', fontWeight: '700', transition: 'all 0.15s ease' }}>
              {star}
            </button>
          ))}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>
          {value === 0 ? 'Not rated' : value === 1 ? 'Poor' : value === 2 ? 'Below Average' : value === 3 ? 'Average' : value === 4 ? 'Good' : 'Excellent'}
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: lightBlue }}>
        <p style={{ color: blue, fontWeight: '600' }}>Loading Progress...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>
      {successMessage && <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#065f46', fontSize: '13px', fontWeight: '600' }}>✅ {successMessage}</div>}

      <div style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '12px', padding: '4px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: 'fit-content' }}>
        {[
          { id: 'record',  label: `📝 Pending (${completedBookings.length})` },
          { id: 'history', label: `📋 Recorded (${progressRecords.length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeTab === tab.id ? `linear-gradient(135deg, ${blue}, ${orange})` : 'transparent', color: activeTab === tab.id ? 'white' : '#6b7280', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'record' && (
        completedBookings.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '48px', marginBottom: '12px' }}>✅</p>
            <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: '0 0 8px' }}>All progress recorded</p>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>You have recorded progress for all completed lessons</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {completedBookings.map(booking => (
              <div key={booking.booking_id} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${orange}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: lightBlue, display: 'flex', alignItems: 'center', justifyContent: 'center', color: blue, fontWeight: '800', fontSize: '16px' }}>
                    {booking.learner?.first_name?.charAt(0)}{booking.learner?.surname?.charAt(0)}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#111827' }}>{booking.learner?.first_name} {booking.learner?.surname}</p>
                    <p style={{ margin: '2px 0', fontSize: '12px', color: '#6b7280' }}>📅 {booking.lesson_slots?.slot_date ? new Date(booking.lesson_slots.slot_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>🕐 {booking.lesson_slots?.slot_time?.slice(0, 5)}</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedBooking(booking); setSteeringRating(0); setParkingRating(0); setReversingRating(0); setRoadAwarenessRating(0); setComments(''); setError(''); setShowModal(true) }}
                  style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${blue}, ${orange})`, color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                  📝 Record Progress
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'history' && (
        progressRecords.length === 0 ? (
          <div style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '48px', marginBottom: '12px' }}>📋</p>
            <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: 0 }}>No progress records yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {progressRecords.map(record => {
              const avg = Number(avgRating(record))
              return (
                <div key={record.progress_id} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${ratingColour(avg)}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#111827' }}>{record.learner?.first_name} {record.learner?.surname}</p>
                      <p style={{ margin: '2px 0', fontSize: '12px', color: '#6b7280' }}>
                        {record.booking?.lesson_slots?.slot_date ? new Date(record.booking.lesson_slots.slot_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'} at {record.booking?.lesson_slots?.slot_time?.slice(0, 5)}
                      </p>
                      {record.comments && <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#374151', lineHeight: '1.4' }}>💬 {record.comments.length > 100 ? record.comments.slice(0, 100) + '...' : record.comments}</p>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: ratingColour(avg) }}>{avg}/5</p>
                      <div>{Array.from({ length: 5 }, (_, i) => <span key={i} style={{ color: i < Math.round(avg) ? orange : '#e5e7eb', fontSize: '14px' }}>★</span>)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px' }}>
                    {[
                      { label: 'Steering', value: record.steering_rating },
                      { label: 'Parking',  value: record.parking_rating },
                      { label: 'Reversing', value: record.reversing_rating },
                      { label: 'Road',     value: record.road_awareness_rating },
                    ].map((skill, i) => (
                      <div key={i} style={{ background: lightBlue, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: ratingColour(skill.value) }}>{skill.value}</p>
                        <p style={{ margin: 0, fontSize: '10px', color: '#6b7280' }}>{skill.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Record Progress Modal */}
      {showModal && selectedBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '500px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 4px' }}>Record Progress</h2>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 20px' }}>{selectedBooking.learner?.first_name} {selectedBooking.learner?.surname} • {selectedBooking.lesson_slots?.slot_date}</p>
            {error && <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#991b1b', fontSize: '13px' }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <StarRating value={steeringRating}      onChange={setSteeringRating}      label="🎯 Steering" />
              <StarRating value={parkingRating}       onChange={setParkingRating}       label="🅿 Parking" />
              <StarRating value={reversingRating}     onChange={setReversingRating}     label="🔄 Reversing" />
              <StarRating value={roadAwarenessRating} onChange={setRoadAwarenessRating} label="👁 Road Awareness" />
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Feedback Comments *</label>
                <textarea value={comments} onChange={e => setComments(e.target.value)} placeholder="Describe the learner's performance, areas of improvement and strengths..." rows={4}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => { setShowModal(false); setSelectedBooking(null); setError('') }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveProgress} disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: saving ? '#e5e7eb' : `linear-gradient(135deg, ${blue}, ${orange})`, color: saving ? '#9ca3af' : 'white', fontSize: '14px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Progress'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
