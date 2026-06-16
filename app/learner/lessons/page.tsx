'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Slot = {
  slot_id: string
  slot_date: string
  slot_time: string
  status: string
}


type Booking = {
  booking_id: string
  status: string
  slot_id: string
  instructor_id?: string
  cancellation_reason?: string
  lesson_slots?: { slot_date: string; slot_time: string }
  instructor?: { first_name: string; surname: string; phone_number?: string }
}

type LearnerProfile = {
  user_id: string
  first_name: string
  surname: string
  slots_allocated?: number
}

const supabase = createClient()

export default function LearnerLessonsPage() {
  const [activeTab, setActiveTab] = useState('upcoming')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([])
  const [learner, setLearner] = useState<LearnerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(false)

  const router = useRouter()
  const routerRef = useRef(router)

  // Sync theme state with layout
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    checkTheme()
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  const theme = {
    cardBg: isDarkMode ? '#222836' : '#ffffff',
    textMain: isDarkMode ? '#f1f5f9' : '#1e293b',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#2d3545' : '#e2e8f0',
    hoverBg: isDarkMode ? '#1e2433' : '#f8fafc',
    inputBg: isDarkMode ? '#1e2433' : '#ffffff',
  }

  // ─── Auth + data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }

    const { data: learnerData } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', user.id)
      .single()

    setLearner(learnerData)

    const { data: bookingsData } = await supabase
      .from('lesson_bookings')
      .select(`
        *,
        lesson_slots (slot_date, slot_time),
        instructor:users!lesson_bookings_instructor_id_fkey (
          first_name, surname, phone_number
        )
      `)
      .eq('learner_id', user.id)
      .order('created_at', { ascending: false })

    setBookings(bookingsData || [])

    const { data: slotsData } = await supabase
      .from('lesson_slots')
      .select('*')
      .eq('status', 'available')
      .gte('slot_date', new Date().toISOString().split('T')[0])
      .order('slot_date', { ascending: true })
      .order('slot_time', { ascending: true })

    setAvailableSlots(slotsData || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await loadData()
    }
    init()
    return () => { cancelled = true }
  }, [loadData])

  // ─── Derived state ────────────────────────────────────────────────────────────

  const scheduledCount = bookings.filter(b => b.status === 'scheduled').length
  const slotsAllocated = learner?.slots_allocated || 0
  const remainingSlots = Math.max(0, slotsAllocated - scheduledCount)

  const today = new Date().toISOString().split('T')[0]
  const upcomingBookings = bookings.filter(b =>
    b.status === 'scheduled' && (b.lesson_slots?.slot_date ?? '') >= today
  )
  const pastBookings = bookings.filter(b =>
    b.status === 'completed' ||
    b.status === 'cancelled' ||
    (b.status === 'scheduled' && (b.lesson_slots?.slot_date ?? '') < today)
  )

  // ─── Actions ─────────────────────────────────────────────────────────────────

  function toggleSlot(slotId: string) {
    setSelectedSlots(prev => {
      if (prev.includes(slotId)) return prev.filter(s => s !== slotId)
      if (prev.length >= remainingSlots) return prev
      return [...prev, slotId]
    })
  }

  async function confirmBooking() {
    if (selectedSlots.length === 0) { setError('Please select at least one slot.'); return }

    setConfirming(true); setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: instructors } = await supabase
      .from('users')
      .select('user_id')
      .eq('role', 'instructor')
      .eq('status', 'approved')

    if (!instructors || instructors.length === 0) {
      setError('No instructors available. Please contact the administrator.')
      setConfirming(false); return
    }

    const { data: allBookings } = await supabase
      .from('lesson_bookings')
      .select('instructor_id')
      .eq('status', 'scheduled')

    const workloadMap: Record<string, number> = {}
    instructors.forEach(i => { workloadMap[i.user_id] = 0 })
    allBookings?.forEach(b => {
      if (b.instructor_id && workloadMap[b.instructor_id] !== undefined) {
        workloadMap[b.instructor_id]++
      }
    })

    const assignedInstructor = Object.entries(workloadMap)
      .sort(([, a], [, b]) => a - b)[0][0]

    const bookingsToInsert = selectedSlots.map(slotId => ({
      learner_id: user.id,
      instructor_id: assignedInstructor,
      slot_id: slotId,
      status: 'scheduled',
    }))

    const { error: bookingError } = await supabase
      .from('lesson_bookings')
      .insert(bookingsToInsert)

    if (bookingError) {
      setError('Failed to book lessons. Please try again.')
      setConfirming(false); return
    }

    for (const slotId of selectedSlots) {
      await supabase.from('lesson_slots').update({ status: 'booked' }).eq('slot_id', slotId)
    }

    await supabase.from('notifications').insert({
      recipient_id: user.id,
      message: `Your ${selectedSlots.length} lesson slot(s) have been confirmed and an instructor has been assigned.`,
      type: 'lesson_reminder',
    })

    await supabase.from('notifications').insert({
      recipient_id: assignedInstructor,
      message: `You have been assigned ${selectedSlots.length} new lesson(s).`,
      type: 'lesson_reminder',
    })

    setSuccessMessage(`${selectedSlots.length} lesson(s) booked successfully!`)
    setTimeout(() => setSuccessMessage(''), 4000)
    setSelectedSlots([])
    setActiveTab('upcoming')
    setConfirming(false)
    loadData()
  }

  async function cancelLesson() {
    if (!cancelReason.trim()) { setError('Please enter a cancellation reason.'); return }
    if (!selectedBooking) return

    const slotDate = selectedBooking.lesson_slots?.slot_date
    const slotTime = selectedBooking.lesson_slots?.slot_time
    if (slotDate && slotTime) {
      const hoursUntilLesson =
        (new Date(`${slotDate}T${slotTime}`).getTime() - new Date().getTime()) / (1000 * 60 * 60)
      if (hoursUntilLesson < 3) {
        setError('Cancellation is not allowed within 3 hours of the lesson start time.')
        return
      }
    }

    setCancelling(true); setError('')

    const { error: cancelError } = await supabase
      .from('lesson_bookings')
      .update({ status: 'cancelled', cancellation_reason: cancelReason })
      .eq('booking_id', selectedBooking.booking_id)

    if (cancelError) { setError('Failed to cancel lesson.'); setCancelling(false); return }

    await supabase.from('lesson_slots')
      .update({ status: 'available' })
      .eq('slot_id', selectedBooking.slot_id)

    if (selectedBooking.instructor_id) {
      await supabase.from('notifications').insert({
        recipient_id: selectedBooking.instructor_id,
        message: `A learner has cancelled their lesson on ${slotDate} at ${slotTime?.slice(0, 5)}. Reason: ${cancelReason}`,
        type: 'cancellation',
      })
    }

    setSuccessMessage('Lesson cancelled successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    setShowCancelModal(false); setSelectedBooking(null); setCancelReason(''); setCancelling(false)
    loadData()
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function statusBadge(status: string) {
    const styles: Record<string, { background: string; color: string }> = {
      scheduled: { background: '#dbeafe', color: '#1e40af' },
      completed: { background: '#d1fae5', color: '#065f46' },
      cancelled: { background: '#fee2e2', color: '#991b1b' },
    }
    return (
      <span style={{
        ...(styles[status] ?? styles.scheduled),
        padding: '3px 10px', borderRadius: '20px',
        fontSize: '11px', fontWeight: '700',
        textTransform: 'capitalize' as const,
      }}>
        {status}
      </span>
    )
  }

  // ─── Loading state ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.textMain, fontWeight: '600' }}>Loading Lessons...</p>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', color: theme.textMain }}>

      {/* Subpage description */}
      <div style={{ marginBottom: '4px' }}>
        <p style={{ color: theme.textMuted, fontSize: '14px', margin: 0 }}>View and manage your lesson bookings</p>
      </div>

      {/* Success / Error */}
      {successMessage && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '10px', padding: '12px 16px', color: '#065f46', fontSize: '13px', fontWeight: '600' }}>
          ✅ {successMessage}
        </div>
      )}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px 16px', color: '#991b1b', fontSize: '13px', fontWeight: '600' }}>
          ❌ {error}
        </div>
      )}

      {/* Slot allocation summary */}
      <div style={{
        background: `linear-gradient(135deg, ${blue}, #2d4fa3)`,
        borderRadius: '14px', padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', margin: '0 0 4px' }}>Lesson Slot Allocation</p>
          <p style={{ color: 'white', fontSize: '20px', fontWeight: '800', margin: 0 }}>
            {scheduledCount} of {slotsAllocated} slots used
          </p>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[
            { label: 'Allocated', value: slotsAllocated, colour: 'rgba(255,255,255,0.9)' },
            { label: 'Booked', value: scheduledCount, colour: orange },
            { label: 'Remaining', value: remainingSlots, colour: '#6ee7b7' },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: item.colour }}>{item.value}</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: theme.cardBg, borderRadius: '12px', padding: '4px', marginBottom: '16px', border: `1px solid ${theme.border}`, width: 'fit-content' }}>
        {[
          { id: 'upcoming', label: '📅 Upcoming' },
          { id: 'book', label: '➕ Book Slots' },
          { id: 'history', label: '📋 History' },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setError(''); setSelectedSlots([]) }}
            style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: activeTab === tab.id ? `linear-gradient(135deg, ${blue}, ${orange})` : 'transparent', color: activeTab === tab.id ? 'white' : theme.textMuted, fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── UPCOMING TAB ── */}
      {activeTab === 'upcoming' && (
        <div>
          {upcomingBookings.length === 0 ? (
            <div style={{ background: theme.cardBg, borderRadius: '14px', padding: '60px', textAlign: 'center', border: `1px solid ${theme.border}` }}>
              <p style={{ fontSize: '48px', marginBottom: '12px' }}>📅</p>
              <p style={{ color: theme.textMain, fontSize: '16px', fontWeight: '600', margin: '0 0 8px' }}>No upcoming lessons</p>
              <p style={{ color: theme.textMuted, fontSize: '13px', margin: '0 0 20px' }}>
                {remainingSlots > 0 ? `You have ${remainingSlots} slot(s) remaining to book` : 'All your allocated slots have been used'}
              </p>
              {remainingSlots > 0 && (
                <button onClick={() => setActiveTab('book')} style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: `linear-gradient(135deg, ${blue}, ${orange})`, color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                  Book Lessons Now
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {upcomingBookings.map(booking => (
                <div key={booking.booking_id} style={{ background: theme.cardBg, borderRadius: '14px', padding: '20px', border: `1px solid ${theme.border}`, borderLeft: `4px solid ${blue}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: isDarkMode ? '#1e2433' : lightBlue, borderRadius: '12px', padding: '12px 16px', textAlign: 'center', minWidth: '70px', border: isDarkMode ? `1px solid ${theme.border}` : 'none' }}>
                      <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: isDarkMode ? orange : blue }}>
                        {booking.lesson_slots?.slot_date ? new Date(booking.lesson_slots.slot_date).getDate() : '--'}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: theme.textMuted }}>
                        {booking.lesson_slots?.slot_date ? new Date(booking.lesson_slots.slot_date).toLocaleDateString('en-GB', { month: 'short' }) : '--'}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '700', color: theme.textMain }}>
                        {booking.lesson_slots?.slot_date ? new Date(booking.lesson_slots.slot_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                      </p>
                      <p style={{ margin: '0 0 4px', fontSize: '13px', color: theme.textMuted }}>🕐 {booking.lesson_slots?.slot_time?.slice(0, 5)}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>👤 Instructor: {booking.instructor?.first_name} {booking.instructor?.surname}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {statusBadge(booking.status)}
                    <button onClick={() => { setSelectedBooking(booking); setShowCancelModal(true); setError('') }}
                      style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#fee2e2', color: '#991b1b', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BOOK SLOTS TAB ── */}
      {activeTab === 'book' && (
        <div>
          {remainingSlots === 0 ? (
            <div style={{ background: theme.cardBg, borderRadius: '14px', padding: '40px', textAlign: 'center', border: `1px solid ${theme.border}` }}>
              <p style={{ fontSize: '48px', marginBottom: '12px' }}>✅</p>
              <p style={{ color: theme.textMain, fontSize: '16px', fontWeight: '600', margin: '0 0 8px' }}>All slots used</p>
              <p style={{ color: theme.textMuted, fontSize: '13px', margin: 0 }}>You have used all your allocated lesson slots. Please contact the administrator to request more.</p>
            </div>
          ) : (
            <>
              <div style={{ background: isDarkMode ? 'rgba(253,230,138,0.1)' : '#fffbeb', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', border: `1px solid ${isDarkMode ? 'rgba(253,230,138,0.2)' : '#fde68a'}` }}>
                <p style={{ margin: 0, fontSize: '13px', color: isDarkMode ? '#fde68a' : '#92400e', lineHeight: '1.5' }}>
                  💡 You can select up to <strong>{remainingSlots}</strong> slot(s). Click a slot to select it. Click again to deselect.
                </p>
              </div>

              {selectedSlots.length > 0 && (
                <div style={{ background: '#d1fae5', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '13px', color: '#065f46', fontWeight: '600' }}>
                    {selectedSlots.length} of {remainingSlots} slot(s) selected
                  </p>
                  <button onClick={confirmBooking} disabled={confirming}
                    style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: confirming ? '#e5e7eb' : `linear-gradient(135deg, ${blue}, ${orange})`, color: confirming ? '#9ca3af' : 'white', fontSize: '13px', fontWeight: '700', cursor: confirming ? 'not-allowed' : 'pointer' }}>
                    {confirming ? 'Booking...' : 'Confirm Booking'}
                  </button>
                </div>
              )}

              {availableSlots.length === 0 ? (
                <div style={{ background: theme.cardBg, borderRadius: '14px', padding: '40px', textAlign: 'center', border: `1px solid ${theme.border}` }}>
                  <p style={{ fontSize: '32px', marginBottom: '8px' }}>📅</p>
                  <p style={{ color: theme.textMuted, fontSize: '14px' }}>No available slots at the moment. Please check back later or contact the administrator.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                  {availableSlots.map(slot => {
                    const isSelected = selectedSlots.includes(slot.slot_id)
                    const isDisabled = !isSelected && selectedSlots.length >= remainingSlots
                    return (
                      <div key={slot.slot_id} onClick={() => !isDisabled && toggleSlot(slot.slot_id)}
                        style={{ background: isDisabled ? (isDarkMode ? '#1a2333' : '#f9fafb') : isSelected ? '#f0fdf4' : theme.cardBg, borderRadius: '12px', padding: '16px', border: isSelected ? '2px solid #059669' : `1px solid ${theme.border}`, cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled ? 0.5 : 1, transition: 'all 0.2s ease' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: isDisabled ? theme.textMuted : theme.textMain }}>
                              {new Date(slot.slot_date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '20px', fontWeight: '800', color: isDisabled ? theme.textMuted : (isDarkMode ? orange : blue) }}>
                              {slot.slot_time?.slice(0, 5)}
                            </p>
                          </div>
                          {isSelected && (
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <span style={{ background: isSelected ? '#d1fae5' : (isDarkMode ? '#1e2433' : '#f3f4f6'), color: isSelected ? '#065f46' : theme.textMuted, padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>
                          {isSelected ? '✓ Selected' : 'Available'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div>
          {pastBookings.length === 0 ? (
            <div style={{ background: theme.cardBg, borderRadius: '14px', padding: '60px', textAlign: 'center', border: `1px solid ${theme.border}` }}>
              <p style={{ fontSize: '48px', marginBottom: '12px' }}>📋</p>
              <p style={{ color: theme.textMain, fontSize: '16px', fontWeight: '600', margin: 0 }}>No lesson history yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {pastBookings.map(booking => (
                <div key={booking.booking_id} style={{ background: theme.cardBg, borderRadius: '12px', padding: '16px 20px', border: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', borderLeft: `4px solid ${booking.status === 'completed' ? '#059669' : '#dc2626'}` }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: '700', color: theme.textMain }}>
                      {booking.lesson_slots?.slot_date ? new Date(booking.lesson_slots.slot_date).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                    </p>
                    <p style={{ margin: '0 0 2px', fontSize: '12px', color: theme.textMuted }}>🕐 {booking.lesson_slots?.slot_time?.slice(0, 5)}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>👤 {booking.instructor?.first_name} {booking.instructor?.surname}</p>
                    {booking.cancellation_reason && (
                      <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#dc2626' }}>Reason: {booking.cancellation_reason}</p>
                    )}
                  </div>
                  {statusBadge(booking.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CANCEL MODAL ── */}
      {showCancelModal && selectedBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: theme.cardBg, borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '400px', margin: '16px', border: `1px solid ${theme.border}`, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ color: isDarkMode ? orange : blue, fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Cancel Lesson</h2>
            <p style={{ color: theme.textMuted, fontSize: '13px', margin: '0 0 8px' }}>
              {selectedBooking.lesson_slots?.slot_date ? new Date(selectedBooking.lesson_slots.slot_date).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''} at {selectedBooking.lesson_slots?.slot_time?.slice(0, 5)}
            </p>
            <div style={{ background: isDarkMode ? 'rgba(253,230,138,0.1)' : '#fffbeb', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', border: `1px solid ${isDarkMode ? 'rgba(253,230,138,0.3)' : '#fde68a'}` }}>
              <p style={{ margin: 0, fontSize: '12px', color: isDarkMode ? '#fde68a' : '#92400e' }}>⚠️ Cancellations are only allowed more than 3 hours before the lesson start time.</p>
            </div>
            {error && (
              <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#991b1b', fontSize: '13px' }}>{error}</div>
            )}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: theme.textMain, marginBottom: '6px' }}>Cancellation Reason *</label>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Please enter your reason for cancelling..." rows={3}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.textMain, fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit' }} />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setShowCancelModal(false); setSelectedBooking(null); setCancelReason(''); setError('') }}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: theme.cardBg, color: theme.textMain, fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                Go Back
              </button>
              <button onClick={cancelLesson} disabled={cancelling}
                style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: cancelling ? '#e5e7eb' : '#dc2626', color: cancelling ? '#9ca3af' : 'white', fontSize: '14px', fontWeight: '700', cursor: cancelling ? 'not-allowed' : 'pointer' }}>
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
