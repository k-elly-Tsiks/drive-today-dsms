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

function Skeleton({ w = '100%', h = '14px', r = '6px' }: { w?: string; h?: string; r?: string }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-shimmer 1.5s infinite linear',
      }}
    />
  )
}

const supabase = createClient()

export default function LearnerLessonsPage() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'book' | 'history'>('upcoming')
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

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e293b'
  const orange = '#ff5a00'
  const lightBlue = '#fff2eb'

  useEffect(() => {
    if (typeof window === 'undefined') return

    const styleId = 'skeleton-shimmer-styles'
    if (document.getElementById(styleId)) return

    const style = document.createElement('style')
    style.id = styleId
    style.innerHTML = `
      @keyframes skeleton-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `
    document.head.appendChild(style)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      routerRef.current.push('/login')
      return
    }

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
    return () => {
      cancelled = true
    }
  }, [loadData])

  const scheduledCount = bookings.filter(b => b.status === 'scheduled').length
  const slotsAllocated = learner?.slots_allocated || 0
  const remainingSlots = Math.max(0, slotsAllocated - scheduledCount)

  const today = new Date().toISOString().split('T')[0]
  const upcomingBookings = bookings.filter(b => b.status === 'scheduled' && (b.lesson_slots?.slot_date ?? '') >= today)
  const pastBookings = bookings.filter(
    b =>
      b.status === 'completed' ||
      b.status === 'cancelled' ||
      (b.status === 'scheduled' && (b.lesson_slots?.slot_date ?? '') < today),
  )

  function toggleSlot(slotId: string) {
    setSelectedSlots(prev => {
      if (prev.includes(slotId)) return prev.filter(s => s !== slotId)
      if (prev.length >= remainingSlots) return prev
      return [...prev, slotId]
    })
  }

  async function confirmBooking() {
    if (selectedSlots.length === 0) {
      setError('Please select at least one slot.')
      return
    }

    setConfirming(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: instructors } = await supabase
      .from('users')
      .select('user_id')
      .eq('role', 'instructor')
      .eq('status', 'approved')

    if (!instructors || instructors.length === 0) {
      setError('No instructors available. Please contact the administrator.')
      setConfirming(false)
      return
    }

    const { data: allBookings } = await supabase
      .from('lesson_bookings')
      .select('instructor_id')
      .eq('status', 'scheduled')

    const workloadMap: Record<string, number> = {}
    instructors.forEach(i => {
      workloadMap[i.user_id] = 0
    })

    allBookings?.forEach(b => {
      if (b.instructor_id && workloadMap[b.instructor_id] !== undefined) {
        workloadMap[b.instructor_id]++
      }
    })

    const assignedInstructor = Object.entries(workloadMap).sort(([, a], [, b]) => a - b)[0]?.[0]
    if (!assignedInstructor) {
      setError('No instructors available. Please contact the administrator.')
      setConfirming(false)
      return
    }

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
      setConfirming(false)
      return
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
    if (!cancelReason.trim()) {
      setError('Please enter a cancellation reason.')
      return
    }
    if (!selectedBooking) return

    const slotDate = selectedBooking.lesson_slots?.slot_date
    const slotTime = selectedBooking.lesson_slots?.slot_time

    if (slotDate && slotTime) {
      const hoursUntilLesson = (new Date(`${slotDate}T${slotTime}`).getTime() - new Date().getTime()) / (1000 * 60 * 60)
      if (hoursUntilLesson < 3) {
        setError('Cancellation is not allowed within 3 hours of the lesson start time.')
        return
      }
    }

    setCancelling(true)
    setError('')

    const { error: cancelError } = await supabase
      .from('lesson_bookings')
      .update({ status: 'cancelled', cancellation_reason: cancelReason })
      .eq('booking_id', selectedBooking.booking_id)

    if (cancelError) {
      setError('Failed to cancel lesson.')
      setCancelling(false)
      return
    }

    await supabase
      .from('lesson_slots')
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

    setShowCancelModal(false)
    setSelectedBooking(null)
    setCancelReason('')
    setCancelling(false)
    loadData()
  }

  function statusBadge(status: string) {
    const styles: Record<string, { background: string; color: string }> = {
      scheduled: { background: '#dbeafe', color: '#1e40af' },
      completed: { background: '#d1fae5', color: '#065f46' },
      cancelled: { background: '#fee2e2', color: '#991b1b' },
    }

    return (
      <span
        style={{
          ...(styles[status] ?? styles.scheduled),
          padding: '3px 10px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: '700',
          textTransform: 'capitalize' as const,
        }}
      >
        {status}
      </span>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f7', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>📅 My Lessons</h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>View and manage your lesson bookings</p>
        </div>
        <button
          onClick={() => router.push('/learner/dashboard')}
          style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: blue, color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
        >
          ← Dashboard
        </button>
      </div>

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

      <div
        style={{
          background: blue,
          borderRadius: '14px',
          padding: '20px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '13px', margin: '0 0 4px' }}>Lesson Slot Allocation</p>
          {loading ? (
            <div style={{ marginTop: '6px' }}>
              <Skeleton w="120px" h="20px" r="4px" />
            </div>
          ) : (
            <p style={{ color: 'white', fontSize: '20px', fontWeight: '800', margin: 0 }}>
              {scheduledCount} of {slotsAllocated} slots used
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          {[
            { label: 'Allocated', value: slotsAllocated, colour: 'rgba(255,255,255,0.9)' },
            { label: 'Booked', value: scheduledCount, colour: orange },
            { label: 'Remaining', value: remainingSlots, colour: '#6ee7b7' },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              {loading ? (
                <div style={{ marginBottom: '4px' }}>
                  <Skeleton w="30px" h="22px" r="4px" />
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: item.colour }}>{item.value}</p>
              )}
              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '4px', background: 'white', borderRadius: '12px', padding: '4px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: 'fit-content' }}>
        {([
          { id: 'upcoming', label: '📅 Upcoming' },
          { id: 'book', label: '➕ Book Slots' },
          { id: 'history', label: '📋 History' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setError('')
              setSelectedSlots([])
            }}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === tab.id ? `linear-gradient(135deg, ${blue}, ${orange})` : 'transparent',
              color: activeTab === tab.id ? 'white' : '#6b7280',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              style={{
                background: 'white',
                borderRadius: '14px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                <div style={{ width: '70px', height: '54px', borderRadius: '12px', background: '#f1f5f9', padding: '6px' }}>
                  <Skeleton w="100%" h="100%" r="8px" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <Skeleton w="40%" h="16px" r="4px" />
                  <Skeleton w="25%" h="12px" r="4px" />
                </div>
              </div>
              <Skeleton w="80px" h="36px" r="8px" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {activeTab === 'upcoming' && (
            <div>
              {upcomingBookings.length === 0 ? (
                <div style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <p style={{ fontSize: '48px', marginBottom: '12px' }}>📅</p>
                  <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: '0 0 8px' }}>No upcoming lessons</p>
                  <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 20px' }}>
                    {remainingSlots > 0 ? `You have ${remainingSlots} slot(s) remaining to book` : 'All your allocated slots have been used'}
                  </p>
                  {remainingSlots > 0 && (
                    <button
                      onClick={() => setActiveTab('book')}
                      style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: orange, color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Book Lessons Now
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {upcomingBookings.map(booking => (
                    <div key={booking.booking_id} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${blue}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ background: lightBlue, borderRadius: '12px', padding: '12px 16px', textAlign: 'center', minWidth: '70px' }}>
                          <p style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: blue }}>{booking.lesson_slots?.slot_date ? new Date(booking.lesson_slots.slot_date).getDate() : '--'}</p>
                          <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{booking.lesson_slots?.slot_date ? new Date(booking.lesson_slots.slot_date).toLocaleDateString('en-GB', { month: 'short' }) : '--'}</p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: '700', color: '#111827' }}>{booking.instructor ? `${booking.instructor.first_name} ${booking.instructor.surname}` : 'Unassigned Instructor'}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>{booking.lesson_slots?.slot_time ? booking.lesson_slots.slot_time.slice(0, 5) : '--:--'}</p>
                          {booking.instructor?.phone_number && (
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9ca3af' }}>📞 {booking.instructor.phone_number}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedBooking(booking)
                          setShowCancelModal(true)
                        }}
                        style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #fee2e2', background: '#fff5f5', color: '#dc2626', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Cancel Booking
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'book' && (
            <div>
              {remainingSlots <= 0 ? (
                <div style={{ background: 'white', borderRadius: '14px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <p style={{ fontSize: '40px', marginBottom: '8px' }}>⚠️</p>
                  <p style={{ color: '#374151', fontSize: '15px', fontWeight: '600', margin: 0 }}>No slot allocations remaining. Please contact administration.</p>
                </div>
              ) : (
                <div>
                  <div style={{ background: 'white', borderRadius: '14px', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#4b5563', fontWeight: '600' }}>
                      Selected slots: <span style={{ color: orange, fontWeight: '800' }}>{selectedSlots.length}</span> of {remainingSlots} allowed slots
                    </p>

                    {selectedSlots.length > 0 ? (
                      <button
                        onClick={confirmBooking}
                        disabled={confirming}
                        style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: orange, color: 'white', fontSize: '13px', fontWeight: '700', cursor: confirming ? 'not-allowed' : 'pointer' }}
                      >
                        {confirming ? 'Booking...' : 'Confirm Bookings'}
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>

                  <div style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <p style={{ margin: '0 0 12px', fontWeight: '800', color: blue }}>Available slots</p>
                    {availableSlots.length === 0 ? (
                      <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>No available slots at the moment.</p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                        {availableSlots.map(slot => {
                          const isSelected = selectedSlots.includes(slot.slot_id)
                          return (
                            <button
                              key={slot.slot_id}
                              onClick={() => toggleSlot(slot.slot_id)}
                              type="button"
                              style={{
                                textAlign: 'left',
                                padding: '14px',
                                borderRadius: '14px',
                                border: `1px solid ${isSelected ? orange : '#e5e7eb'}`,
                                background: isSelected ? 'rgba(255,90,0,0.08)' : '#fafafa',
                                cursor: 'pointer',
                              }}
                              disabled={!isSelected && selectedSlots.length >= remainingSlots}
                            >
                              <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#111827' }}>
                                {new Date(slot.slot_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                              </p>
                              <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#6b7280' }}>
                                🕐 {slot.slot_time.slice(0, 5)}
                              </p>
                              <div style={{ marginTop: '10px' }}>{isSelected ? statusBadge('scheduled') : <span />}</div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {pastBookings.length === 0 ? (
                <div style={{ background: 'white', borderRadius: '14px', padding: '60px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <p style={{ fontSize: '48px', marginBottom: '12px' }}>📋</p>
                  <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: 0 }}>No lesson history yet</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pastBookings.map(booking => (
                    <div key={booking.booking_id} style={{ background: 'white', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${booking.status === 'cancelled' ? '#dc2626' : '#059669'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: '800', color: '#111827' }}>Lesson</p>
                          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#6b7280' }}>
                            {booking.lesson_slots?.slot_date ? new Date(booking.lesson_slots.slot_date).toLocaleDateString('en-GB') : 'N/A'}{' '}
                            at {booking.lesson_slots?.slot_time ? booking.lesson_slots.slot_time.slice(0, 5) : '--:--'}
                          </p>
                        </div>
                        <div>{statusBadge(booking.status)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showCancelModal && selectedBooking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '400px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Cancel Lesson</h2>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 8px' }}>
              {selectedBooking.lesson_slots?.slot_date
                ? new Date(selectedBooking.lesson_slots.slot_date).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                : ''}{' '}
              at {selectedBooking.lesson_slots?.slot_time?.slice(0, 5)}
            </p>

            <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', border: '1px solid #fde68a' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#92400e' }}>⚠️ Cancellations are only allowed more than 3 hours before the lesson start time.</p>
            </div>

            {error && (
              <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#991b1b', fontSize: '13px' }}>{error}</div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Cancellation Reason *</label>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Please enter your reason for cancelling..."
                rows={3}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'inherit' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setSelectedBooking(null)
                  setCancelReason('')
                  setError('')
                }}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
              >
                Go Back
              </button>

              <button
                onClick={cancelLesson}
                disabled={cancelling}
                style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: cancelling ? '#e5e7eb' : '#dc2626', color: cancelling ? '#9ca3af' : 'white', fontSize: '14px', fontWeight: '700', cursor: cancelling ? 'not-allowed' : 'pointer' }}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

