'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Booking = {
  booking_id: string
  status: string
  learner_id: string
  slot_id: string
  instructor_id?: string
  cancellation_reason?: string
  lesson_slots?: { slot_date: string; slot_time: string }
  learner?: { first_name: string; surname: string; phone_number?: string; email?: string }
}

const supabase = createClient()

export default function InstructorLessonsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('upcoming')
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  const cancelReasons = ['No fuel', 'Vehicle service', 'Vehicle breakdown', 'Personal emergency', 'Other']

  const loadBookings = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }

    const { data } = await supabase
      .from('lesson_bookings')
      .select(`*, lesson_slots (slot_date, slot_time), learner:users!lesson_bookings_learner_id_fkey (first_name, surname, phone_number, email)`)
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false })

    setBookings(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() { if (!cancelled) await loadBookings() }
    init()
    return () => { cancelled = true }
  }, [loadBookings])

  async function markComplete() {
    if (!selectedBooking) return
    setCompleting(true); setError('')

    const { error: updateError } = await supabase
      .from('lesson_bookings').update({ status: 'completed' }).eq('booking_id', selectedBooking.booking_id)

    if (updateError) { setError('Failed to mark lesson as completed.'); setCompleting(false); return }

    await supabase.from('notifications').insert({
      recipient_id: selectedBooking.learner_id,
      message: `Your lesson on ${selectedBooking.lesson_slots?.slot_date} has been marked as completed. Check your progress page for feedback.`,
      type: 'lesson_reminder',
    })

    setSuccessMessage('Lesson marked as completed.')
    setTimeout(() => setSuccessMessage(''), 3000)
    setShowCompleteModal(false); setSelectedBooking(null); setCompleting(false)
    loadBookings()
  }

  async function cancelLesson() {
    if (!cancelReason.trim()) { setError('Please select or enter a cancellation reason.'); return }
    if (!selectedBooking) return
    setCancelling(true); setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: cancelError } = await supabase
      .from('lesson_bookings').update({ status: 'cancelled', cancellation_reason: cancelReason }).eq('booking_id', selectedBooking.booking_id)

    if (cancelError) { setError('Failed to cancel lesson.'); setCancelling(false); return }

    await supabase.from('lesson_slots').update({ status: 'available' }).eq('slot_id', selectedBooking.slot_id)

    await supabase.from('notifications').insert({
      recipient_id: selectedBooking.learner_id,
      message: `Your lesson on ${selectedBooking.lesson_slots?.slot_date} at ${selectedBooking.lesson_slots?.slot_time?.slice(0, 5)} has been cancelled by your instructor. Reason: ${cancelReason}`,
      type: 'cancellation',
    })

    const { data: adminData } = await supabase.from('users').select('user_id').eq('role', 'admin').single()
    if (adminData) {
      await supabase.from('notifications').insert({
        recipient_id: adminData.user_id,
        message: `Instructor cancelled a lesson on ${selectedBooking.lesson_slots?.slot_date}. Reason: ${cancelReason}`,
        type: 'cancellation',
      })
    }

    setSuccessMessage('Lesson cancelled successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    setShowCancelModal(false); setSelectedBooking(null); setCancelReason(''); setCancelling(false)
    loadBookings()
  }

  function statusBadge(status: string) {
    const styles: Record<string, { background: string; color: string }> = {
      scheduled: { background: '#dbeafe', color: '#1e40af' },
      completed: { background: '#d1fae5', color: '#065f46' },
      cancelled: { background: '#fee2e2', color: '#991b1b' },
    }
    return (
      <span style={{ ...(styles[status] ?? styles.scheduled), padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', textTransform: 'capitalize' as const }}>
        {status}
      </span>
    )
  }

  const today = new Date().toISOString().split('T')[0]
  const filteredBookings = bookings.filter(b => `${b.learner?.first_name} ${b.learner?.surname}`.toLowerCase().includes(search.toLowerCase()))
  const upcomingBookings = filteredBookings.filter(b => b.status === 'scheduled' && (b.lesson_slots?.slot_date ?? '') >= today)
  const todayBookings = filteredBookings.filter(b => b.status === 'scheduled' && b.lesson_slots?.slot_date === today)
  const pastBookings = filteredBookings.filter(b => b.status === 'completed' || b.status === 'cancelled' || (b.status === 'scheduled' && (b.lesson_slots?.slot_date ?? '') < today))

  function LessonCard({ booking, showActions }: { booking: Booking; showActions: boolean }) {
    return (
      <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${booking.status === 'completed' ? '#059669' : booking.status === 'cancelled' ? '#dc2626' : blue}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: lightBlue, borderRadius: '12px', padding: '12px 16px', textAlign: 'center', minWidth: '70px' }}>
            <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: blue }}>{booking.lesson_slots?.slot_date ? new Date(booking.lesson_slots.slot_date).getDate() : '--'}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{booking.lesson_slots?.slot_date ? new Date(booking.lesson_slots.slot_date).toLocaleDateString('en-GB', { month: 'short' }) : '--'}</p>
          </div>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '700', color: '#111827' }}>{booking.learner?.first_name} {booking.learner?.surname}</p>
            <p style={{ margin: '0 0 2px', fontSize: '12px', color: '#6b7280' }}>🕐 {booking.lesson_slots?.slot_time?.slice(0, 5)}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>📱 {booking.learner?.phone_number}</p>
            {booking.cancellation_reason && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#dc2626' }}>Reason: {booking.cancellation_reason}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {statusBadge(booking.status)}
          {showActions && booking.status === 'scheduled' && (
            <>
              <button onClick={() => { setSelectedBooking(booking); setShowCompleteModal(true); setError('') }} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#d1fae5', color: '#065f46', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>✓ Mark Complete</button>
              <button onClick={() => { setSelectedBooking(booking); setShowCancelModal(true); setCancelReason(''); setError('') }} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
            </>
          )}
          {booking.status === 'completed' && (
            <button onClick={() => router.push('/instructor/progress')} style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: lightBlue, color: blue, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Add Progress</button>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: lightBlue }}>
        <p style={{ color: blue, fontWeight: '600' }}>Loading Lessons...</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>
      {successMessage && <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#065f46', fontSize: '13px', fontWeight: '600' }}>✅ {successMessage}</div>}
      {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#991b1b', fontSize: '13px', fontWeight: '600' }}>❌ {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: "Today's Lessons", value: todayBookings.length,                              colour: blue },
          { label: 'Upcoming',        value: upcomingBookings.length,                           colour: orange },
          { label: 'Completed',       value: bookings.filter(b => b.status === 'completed').length, colour: '#059669' },
          { label: 'Cancelled',       value: bookings.filter(b => b.status === 'cancelled').length, colour: '#dc2626' },
        ].map((stat, i) => (
          <div key={i} style={{ background: 'white', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderTop: `3px solid ${stat.colour}` }}>
            <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: stat.colour }}>{stat.value}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <input type="text" placeholder="🔍 Search by learner name..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none' }} />
      </div>

      <div style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '12px', padding: '4px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: 'fit-content' }}>
        {[
          { id: 'today',    label: `📅 Today (${todayBookings.length})` },
          { id: 'upcoming', label: `⏰ Upcoming (${upcomingBookings.length})` },
          { id: 'history',  label: '📋 History' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeTab === tab.id ? `linear-gradient(135deg, ${blue}, ${orange})` : 'transparent', color: activeTab === tab.id ? 'white' : '#6b7280', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeTab === 'today' && (todayBookings.length === 0
          ? <div style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><p style={{ fontSize: '48px', marginBottom: '12px' }}>📅</p><p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: 0 }}>No lessons today</p></div>
          : todayBookings.map(b => <LessonCard key={b.booking_id} booking={b} showActions />)
        )}
        {activeTab === 'upcoming' && (upcomingBookings.length === 0
          ? <div style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><p style={{ fontSize: '48px', marginBottom: '12px' }}>⏰</p><p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: 0 }}>No upcoming lessons</p></div>
          : upcomingBookings.map(b => <LessonCard key={b.booking_id} booking={b} showActions />)
        )}
        {activeTab === 'history' && (pastBookings.length === 0
          ? <div style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}><p style={{ fontSize: '48px', marginBottom: '12px' }}>📋</p><p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: 0 }}>No lesson history yet</p></div>
          : pastBookings.map(b => <LessonCard key={b.booking_id} booking={b} showActions={false} />)
        )}
      </div>

      {/* Mark Complete Modal */}
      {showCompleteModal && selectedBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '400px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Mark Lesson Complete</h2>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 20px' }}>
              Confirm that the lesson with <strong>{selectedBooking.learner?.first_name} {selectedBooking.learner?.surname}</strong> on <strong>{selectedBooking.lesson_slots?.slot_date}</strong> at <strong>{selectedBooking.lesson_slots?.slot_time?.slice(0, 5)}</strong> has been completed.
            </p>
            <div style={{ background: lightBlue, borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
              <p style={{ margin: 0, fontSize: '12px', color: blue }}>💡 After marking as complete you can record progress and feedback for this learner on the Progress page.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowCompleteModal(false); setSelectedBooking(null) }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
              <button onClick={markComplete} disabled={completing} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: completing ? '#e5e7eb' : '#059669', color: completing ? '#9ca3af' : 'white', fontSize: '14px', fontWeight: '700', cursor: completing ? 'not-allowed' : 'pointer' }}>
                {completing ? 'Marking...' : '✓ Confirm Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '420px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Cancel Lesson</h2>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 20px' }}>
              {selectedBooking.lesson_slots?.slot_date} at {selectedBooking.lesson_slots?.slot_time?.slice(0, 5)} — {selectedBooking.learner?.first_name} {selectedBooking.learner?.surname}
            </p>
            {error && <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#991b1b', fontSize: '13px' }}>{error}</div>}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Reason for cancellation *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                {cancelReasons.map(reason => (
                  <button key={reason} type="button" onClick={() => setCancelReason(reason)}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: cancelReason === reason ? `2px solid ${blue}` : '1px solid #e5e7eb', background: cancelReason === reason ? lightBlue : 'white', color: cancelReason === reason ? blue : '#374151', fontSize: '13px', fontWeight: cancelReason === reason ? '700' : '400', cursor: 'pointer', textAlign: 'left' }}>
                    {reason}
                  </button>
                ))}
              </div>
              {cancelReason === 'Other' && (
                <textarea onChange={e => setCancelReason(e.target.value)} placeholder="Please specify your reason..." rows={2}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowCancelModal(false); setSelectedBooking(null); setCancelReason(''); setError('') }} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Go Back</button>
              <button onClick={cancelLesson} disabled={cancelling} style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: cancelling ? '#e5e7eb' : '#dc2626', color: cancelling ? '#9ca3af' : 'white', fontSize: '14px', fontWeight: '700', cursor: cancelling ? 'not-allowed' : 'pointer' }}>
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
