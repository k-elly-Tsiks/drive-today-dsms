'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Star } from 'lucide-react'
import { feedbackMessage } from '@/app/instructor/_lib/feedback-message'


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

type ProgressDraft = {
  booking_id: string
  steering_rating: number
  parking_rating: number
  reversing_rating: number
  road_awareness_rating: number
  comments: string
}

function isProgressDraft(value: unknown): value is ProgressDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as Record<string, unknown>
  const validRating = (rating: unknown) =>
    typeof rating === 'number' && Number.isInteger(rating) && rating >= 0 && rating <= 5

  return typeof draft.booking_id === 'string'
    && validRating(draft.steering_rating)
    && validRating(draft.parking_rating)
    && validRating(draft.reversing_rating)
    && validRating(draft.road_awareness_rating)
    && typeof draft.comments === 'string'
}

const supabase = createClient()

function Skeleton({ w = '100%', h = '14px', r = '6px' }: { w?: string; h?: string; r?: string }) {
  return (
    <div style={{
      width: w,
      height: h,
      borderRadius: r,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-shimmer 1.5s infinite linear',
    }} />
  )
}

function StarRating({
  value,
  onChange,
  label,
  blue,
  orange,
}: {
  value: number
  onChange: (v: number) => void
  label: string
  blue: string
  orange: string
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '8px' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              border: 'none',
              background: star <= value ? `linear-gradient(135deg, ${blue}, ${orange})` : '#f3f4f6',
              color: star <= value ? 'white' : '#9ca3af',
              fontSize: '16px',
              cursor: 'pointer',
              fontWeight: '700',
              transition: 'all 0.15s ease',
            }}
          >
            {star}
          </button>
        ))}
      </div>
      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>
        {value === 0
          ? 'Not rated'
          : value === 1
            ? 'Poor'
            : value === 2
              ? 'Below Average'
              : value === 3
                ? 'Average'
                : value === 4
                  ? 'Good'
                  : 'Excellent'}
      </p>
    </div>
  )
}

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
  const [draftStorageKey, setDraftStorageKey] = useState('')
  const [draftStorageReady, setDraftStorageReady] = useState(false)

  const [steeringRating, setSteeringRating] = useState(0)
  const [parkingRating, setParkingRating] = useState(0)
  const [reversingRating, setReversingRating] = useState(0)
  const [roadAwarenessRating, setRoadAwarenessRating] = useState(0)
  const [comments, setComments] = useState('')

  const blue = '#1e293b'
  const orange = '#ff5a00'
  const lightBlue = '#fff2eb'

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.assign('/login'); return }

    const { data: bookingsData, error: bookingsError } = await supabase
      .from('lesson_bookings')
      .select(`*, lesson_slots (slot_date, slot_time), learner:users!lesson_bookings_learner_id_fkey (first_name, surname, user_id)`)
      .eq('instructor_id', user.id).eq('status', 'completed')
      .order('created_at', { ascending: false })

    const { data: progressData, error: progressError } = await supabase
      .from('progress_tracking')
      .select(`*, learner:users!progress_tracking_learner_id_fkey (first_name, surname), booking:lesson_bookings!progress_tracking_booking_id_fkey (lesson_slots (slot_date, slot_time))`)
      .eq('instructor_id', user.id)
      .order('recorded_at', { ascending: false })

    const loadError = bookingsError || progressError
    if (loadError) {
      setError(`Could not load progress records: ${loadError.message}`)
      setLoading(false)
      return
    }

    const progressBookingIds = new Set(
      progressData?.map((p: { booking_id: string }) => p.booking_id)
    )
    const pendingBookings = bookingsData?.filter(
      (b: { booking_id: string }) => !progressBookingIds.has(b.booking_id)
    ) || []

    setCompletedBookings(pendingBookings)
    setProgressRecords(progressData || [])
    setError('')

    const storageKey = `instructor-progress-draft:${user.id}`
    setDraftStorageKey(storageKey)
    try {
      const savedDraft = sessionStorage.getItem(storageKey)
      if (savedDraft) {
        const parsedDraft: unknown = JSON.parse(savedDraft)
        if (isProgressDraft(parsedDraft)) {
          const draftBooking = pendingBookings.find((booking: Booking) => booking.booking_id === parsedDraft.booking_id)
          if (draftBooking) {
            setSelectedBooking(draftBooking)
            setSteeringRating(parsedDraft.steering_rating)
            setParkingRating(parsedDraft.parking_rating)
            setReversingRating(parsedDraft.reversing_rating)
            setRoadAwarenessRating(parsedDraft.road_awareness_rating)
            setComments(parsedDraft.comments)
            setShowModal(true)
          }
        }
      }
    } catch {
      setError('Could not restore the unsaved progress draft from this browser session.')
    }
    setDraftStorageReady(true)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() { if (!cancelled) await loadData() }
    init()
    return () => { cancelled = true }
  }, [loadData])

  function updateProgressDraft(updates: Partial<Omit<ProgressDraft, 'booking_id'>>) {
    if (!selectedBooking) return
    const draft: ProgressDraft = {
      booking_id: selectedBooking.booking_id,
      steering_rating: updates.steering_rating ?? steeringRating,
      parking_rating: updates.parking_rating ?? parkingRating,
      reversing_rating: updates.reversing_rating ?? reversingRating,
      road_awareness_rating: updates.road_awareness_rating ?? roadAwarenessRating,
      comments: updates.comments ?? comments,
    }

    setSteeringRating(draft.steering_rating)
    setParkingRating(draft.parking_rating)
    setReversingRating(draft.reversing_rating)
    setRoadAwarenessRating(draft.road_awareness_rating)
    setComments(draft.comments)

    if (!draftStorageReady || !draftStorageKey) return
    try {
      sessionStorage.setItem(draftStorageKey, JSON.stringify(draft))
    } catch {
      setError('Could not save the unsaved progress draft in this browser session.')
    }
  }

  function beginProgressDraft(booking: Booking) {
    setSelectedBooking(booking)
    setSteeringRating(0)
    setParkingRating(0)
    setReversingRating(0)
    setRoadAwarenessRating(0)
    setComments('')
    setError('')
    setShowModal(true)

    if (!draftStorageReady || !draftStorageKey) return
    try {
      sessionStorage.setItem(draftStorageKey, JSON.stringify({
        booking_id: booking.booking_id,
        steering_rating: 0,
        parking_rating: 0,
        reversing_rating: 0,
        road_awareness_rating: 0,
        comments: '',
      } satisfies ProgressDraft))
    } catch {
      setError('Could not save the selected progress record in this browser session.')
    }
  }

  async function saveProgress() {
    if (!steeringRating || !parkingRating || !reversingRating || !roadAwarenessRating) {
      setError('Please rate all four skill areas.'); return
    }
    if (!comments.trim()) { setError('Please enter feedback comments.'); return }
    if (!selectedBooking) return

    setSaving(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Your session expired. Sign in again before saving this progress record.')
      setSaving(false)
      return
    }

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

    if (insertError) { setError(`Failed to save progress record: ${insertError.message}`); setSaving(false); return }

    if (draftStorageKey) {
      try {
        sessionStorage.removeItem(draftStorageKey)
      } catch {
        setError('Progress was saved, but its local draft could not be cleared.')
      }
    }

    await supabase.from('notifications').insert({
      recipient_id: selectedBooking.learner_id,
      message: feedbackMessage({
        lessonDate: selectedBooking.lesson_slots?.slot_date,
        steering: steeringRating,
        parking: parkingRating,
        reversing: reversingRating,
        roadAwareness: roadAwarenessRating,
        comments,
      }),
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



  if (loading) {

    return (
      <div className="instructor-page instructor-progress" style={{ minHeight: '100vh', background: '#f4f5f7', padding: '24px' }}>
        <style>{`@keyframes skeleton-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
        <div className="instructor-tabs" style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '12px', padding: '4px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: 'fit-content' }}>
          <Skeleton w="148px" h="40px" r="10px" />
          <Skeleton w="152px" h="40px" r="10px" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="instructor-card" style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${orange}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                <Skeleton w="48px" h="48px" r="50%" />
                <div style={{ flex: 1 }}>
                  <Skeleton w="180px" h="15px" r="4px" />
                  <div style={{ marginTop: '8px' }}><Skeleton w="260px" h="12px" r="4px" /></div>
                  <div style={{ marginTop: '8px' }}><Skeleton w="90px" h="12px" r="4px" /></div>
                </div>
              </div>
              <Skeleton w="140px" h="40px" r="10px" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="instructor-page instructor-progress" style={{ minHeight: '100vh', background: '#f4f5f7', padding: '24px' }}>
      {successMessage && (

        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#065f46', fontSize: '13px', fontWeight: '600' }}>
          <CheckCircle2 size={16} color="#22c55e" style={{ marginRight: 6, verticalAlign: 'middle' }} />
          {successMessage}
        </div>
      )}
      {error && (
        <div role="alert" style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#991b1b', fontSize: '13px', fontWeight: '600' }}>
          {error}
        </div>
      )}


      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px', width: 'fit-content' }}>
        <div className="instructor-tabs" style={{ display: 'flex', background: '#f3f4f6', padding: '4px', borderRadius: '12px', border: '1px solid #e5e7eb', width: 'fit-content' }}>
          {[
            { id: 'record', label: `Record (${completedBookings.length})` },
            { id: 'history', label: `History (${progressRecords.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === tab.id ? 'white' : 'transparent',
                color: activeTab === tab.id ? '#f97316' : '#4b5563',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: activeTab === tab.id ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'record' && (
        error.startsWith('Could not load progress records:') ? null : completedBookings.length === 0 ? (
          <div className="instructor-empty" style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
              <CheckCircle2 size={44} color={orange} />
            </div>
            <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: '0 0 8px' }}>All progress recorded</p>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>You have recorded progress for all completed lessons</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {completedBookings.map(booking => (
              <div key={booking.booking_id} className="instructor-card" style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${orange}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
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
                <button className="instructor-primary-button" onClick={() => beginProgressDraft(booking)}
                  style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: orange, color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                  📝 Record Progress
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {activeTab === 'history' && (
        error.startsWith('Could not load progress records:') ? null : progressRecords.length === 0 ? (
          <div className="instructor-empty" style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '48px', marginBottom: '12px' }}>📋</p>
            <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: 0 }}>No progress records yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {progressRecords.map(record => {
              const avg = Number(avgRating(record))
              return (
                <div key={record.progress_id} className="instructor-card" style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${ratingColour(avg)}` }}>
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
<div>{Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          size={14}
                          fill={i < Math.round(avg) ? orange : 'transparent'}
                          color={i < Math.round(avg) ? orange : '#e5e7eb'}
                        />
                      ))}</div>
                    </div>
                  </div>
                  <div className="instructor-history-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '12px' }}>
                    {([
                      { label: 'Steering', value: record.steering_rating },
                      { label: 'Parking', value: record.parking_rating },
                      { label: 'Reversing', value: record.reversing_rating },
                      { label: 'Road', value: record.road_awareness_rating },
                    ] as const).map((skill) => (
                      <div
                        key={skill.label}
                        style={{
                          background: '#ffffff',
                          borderRadius: 12,
                          padding: 12,
                          border: `1px solid #e2e8f0`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            background: lightBlue,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 900, color: ratingColour(skill.value) }}>{skill.value}</span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>
                            {skill.label}
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 10, color: '#6b7280', fontWeight: 700, lineHeight: 1.2 }}>
                            Rating
                          </p>
                        </div>
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
          <div className="instructor-card" style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '500px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 4px' }}>Record Progress</h2>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 20px' }}>{selectedBooking.learner?.first_name} {selectedBooking.learner?.surname} • {selectedBooking.lesson_slots?.slot_date}</p>
            {error && <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#991b1b', fontSize: '13px' }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <StarRating value={steeringRating}      onChange={value => updateProgressDraft({ steering_rating: value })}      label="🎯 Steering" blue={blue} orange={orange} />
              <StarRating value={parkingRating}       onChange={value => updateProgressDraft({ parking_rating: value })}       label="🅿 Parking" blue={blue} orange={orange} />
              <StarRating value={reversingRating}     onChange={value => updateProgressDraft({ reversing_rating: value })}     label="🔄 Reversing" blue={blue} orange={orange} />
              <StarRating value={roadAwarenessRating} onChange={value => updateProgressDraft({ road_awareness_rating: value })} label="👁 Road Awareness" blue={blue} orange={orange} />
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Feedback Comments *</label>
                <textarea className="instructor-field" value={comments} onChange={e => updateProgressDraft({ comments: e.target.value })} placeholder="Describe the learner's performance, areas of improvement and strengths..." rows={4}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button onClick={() => { setShowModal(false); setSelectedBooking(null); setError('') }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button className="instructor-primary-button" onClick={saveProgress} disabled={saving} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: saving ? '#e5e7eb' : `linear-gradient(135deg, ${blue}, ${orange})`, color: saving ? '#9ca3af' : 'white', fontSize: '14px', fontWeight: '700', cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : 'Save Progress'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
