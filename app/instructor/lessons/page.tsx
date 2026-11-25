'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { feedbackMessage } from '@/app/instructor/_lib/feedback-message'
import { 
  Layers, CalendarCheck, CheckCircle2, AlertCircle, 
  MoreVertical, Clock, Star, Save, X, Phone, Mail 
} from 'lucide-react'

// --- TypeScript Definitions ---
type Booking = {
  booking_id: string
  status: 'scheduled' | 'completed' | 'cancelled'
  learner_id: string
  slot_id: string
  instructor_id?: string
  cancellation_reason?: string
  lesson_slots?: { slot_date: string; slot_time: string }
  learner?: { first_name: string; surname: string; phone_number?: string; email?: string }
}

type PerformanceDraft = {
  booking_id: string
  steering_rating: number
  parking_rating: number
  reversing_rating: number
  road_awareness_rating: number
  comments: string
}

function isRating(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
}

function isPerformanceDraft(value: unknown): value is PerformanceDraft {
  if (typeof value !== 'object' || value === null) return false
  const draft = value as Record<string, unknown>
  return typeof draft.booking_id === 'string'
    && isRating(draft.steering_rating)
    && isRating(draft.parking_rating)
    && isRating(draft.reversing_rating)
    && isRating(draft.road_awareness_rating)
    && typeof draft.comments === 'string'
}

const supabase = createClient()

// --- Skeleton Components ---
const SkeletonPulse = () => (
  <style>{`
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }
    .skeleton-item {
      animation: pulse 1.5s ease-in-out infinite;
      background-color: #e5e7eb;
    }
  `}</style>
)

const SkeletonStat = () => (
  <div className="instructor-card" style={{ background: 'white', borderRadius: '16px', padding: '20px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ flex: 1 }}>
      <div className="skeleton-item" style={{ height: '13px', width: '60px', borderRadius: '4px', marginBottom: '8px' }} />
      <div className="skeleton-item" style={{ height: '24px', width: '40px', borderRadius: '4px' }} />
    </div>
    <div className="skeleton-item" style={{ height: '40px', width: '40px', borderRadius: '10px' }} />
  </div>
)

const SkeletonLesson = () => (
  <div className="instructor-card" style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
      <div style={{ display: 'flex', gap: '20px' }}>
        <div className="skeleton-item" style={{ height: '16px', width: '100px', borderRadius: '4px' }} />
        <div className="skeleton-item" style={{ height: '16px', width: '80px', borderRadius: '4px' }} />
      </div>
      <div>
        <div className="skeleton-item" style={{ height: '20px', width: '200px', borderRadius: '4px', marginBottom: '8px' }} />
        <div style={{ display: 'flex', gap: '15px' }}>
          <div className="skeleton-item" style={{ height: '14px', width: '120px', borderRadius: '4px' }} />
          <div className="skeleton-item" style={{ height: '14px', width: '150px', borderRadius: '4px' }} />
        </div>
      </div>
    </div>
    <div className="skeleton-item" style={{ height: '24px', width: '80px', borderRadius: '20px' }} />
  </div>
)

export default function InstructorLessonsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Today')
  const [search, setSearch] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  
  const [confirmingComplete, setConfirmingComplete] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showProgressSheet, setShowProgressSheet] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  const [steeringRating, setSteeringRating] = useState<number>(5)
  const [parkingRating, setParkingRating] = useState<number>(5)
  const [reversingRating, setReversingRating] = useState<number>(5)
  const [roadAwarenessRating, setRoadAwarenessRating] = useState<number>(5)
  const [performanceNotes, setPerformanceNotes] = useState<string>('')

  const [savingProgress, setSavingProgress] = useState(false)
  const [performanceDraftKey, setPerformanceDraftKey] = useState('')
  const [performanceDraftReady, setPerformanceDraftReady] = useState(false)

  const [cancelReasonOption, setCancelReasonOption] = useState<string>('')
  const [cancelOtherDetails, setCancelOtherDetails] = useState('')
  
  const [message, setMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const router = useRouter()

  const loadBookings = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data, error } = await supabase
      .from('lesson_bookings')
      .select(`booking_id, learner_id, slot_id, status, cancellation_reason, lesson_slots (slot_date, slot_time), learner:users!lesson_bookings_learner_id_fkey (first_name, surname, phone_number, email)`)
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      setActionError(`Could not load lessons: ${error.message}`)
    } else if (data) {
      const loadedBookings = data as Booking[]
      setBookings(loadedBookings)
      setActionError('')

      const draftKey = `instructor-performance-draft:${user.id}`
      setPerformanceDraftKey(draftKey)
      try {
        const savedDraft = sessionStorage.getItem(draftKey)
        if (savedDraft) {
          const parsedDraft: unknown = JSON.parse(savedDraft)
          if (isPerformanceDraft(parsedDraft)) {
            const draftBooking = loadedBookings.find(booking =>
              booking.booking_id === parsedDraft.booking_id && booking.status === 'completed'
            )
            if (draftBooking) {
              setSelectedBooking(draftBooking)
              setSteeringRating(parsedDraft.steering_rating)
              setParkingRating(parsedDraft.parking_rating)
              setReversingRating(parsedDraft.reversing_rating)
              setRoadAwarenessRating(parsedDraft.road_awareness_rating)
              setPerformanceNotes(parsedDraft.comments)
              setShowProgressSheet(true)
            }
          }
        }
      } catch {
        setActionError('Could not restore the unsaved performance draft from this browser session.')
      }
      setPerformanceDraftReady(true)
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    // load bookings on mount
    const run = async () => {
      await loadBookings()
    }
    void run()
  }, [loadBookings])

  function updatePerformanceDraft(updates: Partial<Omit<PerformanceDraft, 'booking_id'>>) {
    if (!selectedBooking) return
    const draft: PerformanceDraft = {
      booking_id: selectedBooking.booking_id,
      steering_rating: updates.steering_rating ?? steeringRating,
      parking_rating: updates.parking_rating ?? parkingRating,
      reversing_rating: updates.reversing_rating ?? reversingRating,
      road_awareness_rating: updates.road_awareness_rating ?? roadAwarenessRating,
      comments: updates.comments ?? performanceNotes,
    }

    setSteeringRating(draft.steering_rating)
    setParkingRating(draft.parking_rating)
    setReversingRating(draft.reversing_rating)
    setRoadAwarenessRating(draft.road_awareness_rating)
    setPerformanceNotes(draft.comments)

    if (!performanceDraftReady || !performanceDraftKey) return
    try {
      sessionStorage.setItem(performanceDraftKey, JSON.stringify(draft))
    } catch {
      setActionError('Could not save the unsaved performance draft in this browser session.')
    }
  }



  // --- ACTIONS ---
  async function markLessonComplete() {
    if (!selectedBooking) return
    setActionError('')
    // The database function checks ownership and returns the saved status, so a
    // completion that was not persisted can never look successful here.
    const { data: savedStatus, error } = await supabase.rpc('complete_lesson_booking', {
      p_booking_id: selectedBooking.booking_id,
    })

    if (error?.code === 'PGRST202') {
      setActionError(
        'Lesson completion is not set up in Supabase yet. Apply supabase/migrations/20261125000000_complete_lesson_booking.sql in the Supabase SQL Editor, then try again.'
      )
    } else if (!error && savedStatus !== 'completed') {
      setActionError('The lesson could not be saved as completed. Please reload and try again.')
    } else if (!error) {
      setBookings(prev => prev.map(b => b.booking_id === selectedBooking.booking_id ? { ...b, status: 'completed' } : b))
      setSelectedBooking({ ...selectedBooking, status: 'completed' })
      updatePerformanceDraft({})
      setConfirmingComplete(false)
      setShowProgressSheet(true)
    } else {
      setActionError(`Could not mark lesson complete: ${error.message}`)
    }
  }

  async function savePerformanceRecord() {
    if (!selectedBooking) return
    setSavingProgress(true)
    setActionError('')


    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setActionError('Your session expired. Sign in again before saving this performance record.')
      setSavingProgress(false)
      return
    }

    // Persist into the same table/shape used by the instructor progress page.
    const { error } = await supabase
      .from('progress_tracking')
      .insert({
        booking_id: selectedBooking.booking_id,
        learner_id: selectedBooking.learner_id,
        instructor_id: user.id,
        steering_rating: steeringRating,
        parking_rating: parkingRating,
        reversing_rating: reversingRating,
        road_awareness_rating: roadAwarenessRating,
        comments: performanceNotes,
      })

    if (!error) {
      await supabase.from('notifications').insert({
        recipient_id: selectedBooking.learner_id,
        message: feedbackMessage({
          lessonDate: selectedBooking.lesson_slots?.slot_date,
          steering: steeringRating,
          parking: parkingRating,
          reversing: reversingRating,
          roadAwareness: roadAwarenessRating,
          comments: performanceNotes,
        }),
        type: 'lesson_reminder',
      })

      if (performanceDraftKey) {
        try {
          sessionStorage.removeItem(performanceDraftKey)
        } catch {
          setActionError('Performance was saved, but its local draft could not be cleared.')
        }
      }

      setMessage(`Performance saved for ${selectedBooking.learner?.first_name}`)
      setShowProgressSheet(false)
      setPerformanceNotes('')
      setSteeringRating(5)
      setParkingRating(5)
      setReversingRating(5)
      setRoadAwarenessRating(5)


      // Ensure completed/cancelled lessons stay visible after reload.
      setActiveTab('History')
      setSelectedBooking(null)
      setTimeout(() => setMessage(null), 3500)

      await loadBookings()
    } else {
      setActionError(`Could not save performance: ${error.message}`)
    }

    setSavingProgress(false)
  }

  async function cancelLesson() {
    if (!selectedBooking) return
    const reason = cancelReasonOption === 'Other' ? cancelOtherDetails : cancelReasonOption
    const { data: cancelled, error } = await supabase
      .from('lesson_bookings')
      .update({ status: 'cancelled', cancellation_reason: reason })
      .eq('booking_id', selectedBooking.booking_id)
      .select('booking_id')
      .maybeSingle()

    if (!error && !cancelled) {
      setActionError('The cancellation was not saved. The database did not allow this change.')
    } else if (!error) {
      setBookings(prev => prev.map(b => b.booking_id === selectedBooking.booking_id ? { ...b, status: 'cancelled' } : b))
      setShowCancelDialog(false)
      setMessage('Lesson marked as cancelled.')
      setTimeout(() => setMessage(null), 3500)
    } else {
      setActionError(`Could not cancel lesson: ${error.message}`)
    }
  }

  // --- FILTERING ---

  // NOTE: ESLint react/no-unescaped-entities flags apostrophes in JSX text.
  // We keep user-facing text free of raw apostrophes.
  const todayStr = new Date().toISOString().split('T')[0]


  const todayBookings = bookings.filter(b => b.lesson_slots?.slot_date === todayStr)
  const upcomingBookings = bookings.filter(b => b.lesson_slots?.slot_date && b.lesson_slots.slot_date > todayStr)
  const historyBookings = bookings.filter(b => b.status !== 'scheduled' || (b.lesson_slots?.slot_date && b.lesson_slots.slot_date < todayStr))

  const getActiveList = () => {
    if (activeTab === 'Today') return todayBookings
    if (activeTab === 'Upcoming') return upcomingBookings
    return historyBookings
  }

  const displayList = getActiveList().filter(b => 
    `${b.learner?.first_name} ${b.learner?.surname}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="instructor-page instructor-lessons" style={{ minHeight: '100vh', background: '#f4f5f7', padding: '24px', fontFamily: 'sans-serif' }}>
      <SkeletonPulse />
      
      <div className="instructor-page-header" style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#111827', margin: '0 0 5px' }}>Lessons Management</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>Configure scheduling and manage active bookings</p>
      </div>

      {/* STAT CARDS */}
      <div className="instructor-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {loading ? (
          <>
            <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
          </>
        ) : (
          [
            { label: 'Todays', value: todayBookings.length, icon: CalendarCheck, tab: 'Today' },
            { label: 'Upcoming', value: upcomingBookings.length, icon: Layers, tab: 'Upcoming' },
            { label: 'Completed', value: bookings.filter(b => b.status === 'completed').length, icon: CheckCircle2, tab: 'History' },
            { label: 'Cancelled', value: bookings.filter(b => b.status === 'cancelled').length, icon: AlertCircle, tab: 'History' },
          ].map((stat, i) => {
            return (
              <div
                className="instructor-card"
                key={i}
                onClick={() => setActiveTab(stat.tab)}
                style={{
                  background: 'white', borderRadius: '16px', padding: '20px',
                  border: '1px solid #e5e7eb',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                  transition: 'transform 0.1s ease'
                }}
              >
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#6b7280' }}>{stat.label}</p>
                  <p style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#111827' }}>{stat.value}</p>
                </div>
                <div style={{ background: '#f9fafb', padding: '10px', borderRadius: '10px' }}>
                  <stat.icon size={20} color="#f97316" />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Navigation and Search */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
        <div className="instructor-tabs" style={{ display: 'flex', background: '#f3f4f6', padding: '4px', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          {['Today', 'Upcoming', 'History'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px',
              background: activeTab === tab ? 'white' : 'transparent', color: activeTab === tab ? '#f97316' : '#4b5563',
              boxShadow: activeTab === tab ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
            }}>{tab}</button>
          ))}
        </div>
        <input className="instructor-field" type="text" placeholder="Search learner..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid #e5e7eb', outline: 'none' }} />
      </div>

      {message && <div style={{ background: '#fffbeb', border: '1px solid #fb923c', color: '#9a3412', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontWeight: '700' }}>{message}</div>}
      {actionError && <div role="alert" style={{ background: '#fee2e2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', fontWeight: '700' }}>{actionError}</div>}

      {/* LESSON LIST */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {loading ? (
          <>
            <SkeletonLesson />
            <SkeletonLesson />
            <SkeletonLesson />
          </>
        ) : actionError.startsWith('Could not load lessons:') ? null : displayList.length === 0 ? (
          <div className="instructor-empty" style={{ textAlign: 'center', padding: '40px', background: 'white', borderRadius: '16px', color: '#6b7280' }}>No lessons found.</div>
        ) : (
          displayList.map((b) => (
            <div key={b.booking_id} className="instructor-card" style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '700', color: '#111827' }}>
                    <CalendarCheck size={16} color="#f97316" /> {b.lesson_slots?.slot_date}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '700', color: '#4b5563' }}>
                    <Clock size={16} color="#6b7280" /> {b.lesson_slots?.slot_time?.slice(0, 5)}
                  </div>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: '800' }}>{b.learner?.first_name} {b.learner?.surname}</h3>
                  <div style={{ display: 'flex', gap: '15px', color: '#6b7280', fontSize: '13px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={14}/> {b.learner?.phone_number}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={14}/> {b.learner?.email}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ 
                  fontSize: '11px', fontWeight: '800', padding: '5px 12px', borderRadius: '20px', textTransform: 'uppercase',
                  background: b.status === 'scheduled' ? '#e0f2fe' : b.status === 'completed' ? '#dcfce7' : '#fee2e2',
                  color: b.status === 'scheduled' ? '#0369a1' : b.status === 'completed' ? '#15803d' : '#b91c1c'
                }}>{b.status}</span>

                {b.status === 'scheduled' && (
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setOpenMenuId(openMenuId === b.booking_id ? null : b.booking_id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px' }}>
                      <MoreVertical size={20} color="#9ca3af" />
                    </button>
                    {openMenuId === b.booking_id && (
                      <div style={{ position: 'absolute', right: 0, top: '30px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 10px 15px rgba(0,0,0,0.1)', zIndex: 10, width: '180px', overflow: 'hidden' }}>
                        <button onClick={() => { setSelectedBooking(b); setConfirmingComplete(true); setOpenMenuId(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700', color: '#059669', fontSize: '13px' }}>
                          <CheckCircle2 size={16}/> Complete
                        </button>
                        <button onClick={() => { setSelectedBooking(b); setShowCancelDialog(true); setOpenMenuId(null); }} style={{ width: '100%', padding: '12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700', color: '#dc2626', fontSize: '13px' }}>
                          <AlertCircle size={16}/> Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* PERFORMANCE RECORDING SHEET */}
      {showProgressSheet && selectedBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'flex-end', zIndex: 2000 }}>
          <div className="instructor-card" style={{ width: '100%', maxWidth: '450px', background: 'white', height: '100%', padding: '30px', boxShadow: '-5px 0 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '900' }}>Record Performance</h2>
              <button onClick={() => setShowProgressSheet(false)} style={{ border: 'none', background: '#f3f4f6', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}><X size={20}/></button>
            </div>
      <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '30px' }}>Recording learner performance for <b>{selectedBooking.learner?.first_name}</b> on {selectedBooking.lesson_slots?.slot_date}.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '30px' }}>
              <div>
                <label style={{ fontWeight: '800', fontSize: '13px', marginBottom: '10px', display: 'block', textTransform: 'uppercase' }}>🎯 Steering</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={30} onClick={() => updatePerformanceDraft({ steering_rating: s })} fill={steeringRating >= s ? "#f97316" : "none"} color={steeringRating >= s ? "#f97316" : "#d1d5db"} style={{ cursor: 'pointer' }} />
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: '800', fontSize: '13px', marginBottom: '10px', display: 'block', textTransform: 'uppercase' }}>🅿 Parking</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={30} onClick={() => updatePerformanceDraft({ parking_rating: s })} fill={parkingRating >= s ? "#f97316" : "none"} color={parkingRating >= s ? "#f97316" : "#d1d5db"} style={{ cursor: 'pointer' }} />
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: '800', fontSize: '13px', marginBottom: '10px', display: 'block', textTransform: 'uppercase' }}>🔄 Reversing</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={30} onClick={() => updatePerformanceDraft({ reversing_rating: s })} fill={reversingRating >= s ? "#f97316" : "none"} color={reversingRating >= s ? "#f97316" : "#d1d5db"} style={{ cursor: 'pointer' }} />
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: '800', fontSize: '13px', marginBottom: '10px', display: 'block', textTransform: 'uppercase' }}>👁 Road</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} size={30} onClick={() => updatePerformanceDraft({ road_awareness_rating: s })} fill={roadAwarenessRating >= s ? "#f97316" : "none"} color={roadAwarenessRating >= s ? "#f97316" : "#d1d5db"} style={{ cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
            </div>

            <label style={{ fontWeight: '800', fontSize: '13px', marginBottom: '10px', display: 'block', textTransform: 'uppercase' }}>Lesson Notes</label>
            <textarea className="instructor-field"
              value={performanceNotes} onChange={e => updatePerformanceDraft({ comments: e.target.value })}
              placeholder="Enter details about what was covered, learner strengths, and areas for improvement..."
              style={{ flex: 1, width: '100%', padding: '15px', borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '15px', outline: 'none', resize: 'none', marginBottom: '20px' }}
            />
            <button className="instructor-primary-button" onClick={savePerformanceRecord} disabled={savingProgress} style={{
              background: '#f97316', color: 'white', border: 'none', padding: '16px', borderRadius: '14px', fontWeight: '900',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
            }}>
              <Save size={20}/> {savingProgress ? 'Saving...' : 'Save Performance to File'}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      {confirmingComplete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="instructor-card" style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: '900' }}>Confirm Complete</h3>
<p style={{ color: '#6b7280', margin: '0 0 20px' }}>Mark this lesson as complete? You can then record the learner progress notes.</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setConfirmingComplete(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', fontWeight: '700' }}>Back</button>
              <button onClick={markLessonComplete} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#059669', color: 'white', fontWeight: '700' }}>Complete</button>
            </div>
          </div>
        </div>
      )}

      {showCancelDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="instructor-card" style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '900' }}>Cancel Lesson</h3>
            <select className="instructor-field" value={cancelReasonOption} onChange={e => setCancelReasonOption(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '15px' }}>
              <option value="">-- Select reason --</option>
              <option value="No fuel">No fuel</option>
              <option value="Vehicle breakdown">Vehicle breakdown</option>
              <option value="Personal emergency">Personal emergency</option>
              <option value="Other">Other</option>
            </select>
            {cancelReasonOption === 'Other' && <input className="instructor-field" placeholder="Details..." value={cancelOtherDetails} onChange={e => setCancelOtherDetails(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e5e7eb', marginBottom: '15px' }} />}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowCancelDialog(false)} style={{ flex: 1, padding: '12px', border: '1px solid #e5e7eb', borderRadius: '12px' }}>Back</button>
              <button onClick={cancelLesson} style={{ flex: 1, padding: '12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700' }}>Confirm Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}