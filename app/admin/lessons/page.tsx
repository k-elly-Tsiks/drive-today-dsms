'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Slot = {
  slot_id: string
  slot_date: string
  slot_time: string
  status: 'available' | 'booked' | 'blocked'
}

type Booking = {
  booking_id: string
  status: 'scheduled' | 'completed' | 'cancelled'
  created_at: string
  slot_id: string
  learner_id: string
  instructor_id?: string
  lesson_slots?: {
    slot_date: string
    slot_time: string
  }
  learner?: {
    first_name: string
    surname: string
    phone_number: string
  }
  instructor?: {
    first_name: string
    surname: string
  }
}

const supabase = createClient()

export default function LessonsPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('slots')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Create slot form
  const [slotDate, setSlotDate] = useState('')
  const [slotTime, setSlotTime] = useState('')
  const [creatingSlot, setCreatingSlot] = useState(false)
  const [bulkDates, setBulkDates] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>([])

  // Edit slot form
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const timeSlots = [
    '07:00', '08:00', '09:00', '10:00', '11:00',
    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  ]

  // ─── Auth + data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)

    const { data: slotsData } = await supabase
      .from('lesson_slots')
      .select('*')

    const { data: bookingsData } = await supabase
      .from('lesson_bookings')
      .select(`
        *,
        learner:users!lesson_bookings_learner_id_fkey (first_name, surname, phone_number),
        instructor:users!lesson_bookings_instructor_id_fkey (first_name, surname),
        lesson_slots (slot_date, slot_time)
      `)

    setSlots(slotsData || [])
    setBookings(bookingsData || [])
    setLoading(false)
  }, [])

  const checkAdmin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (data?.role !== 'admin') { routerRef.current.push('/login'); return }
    await loadData()
  }, [loadData])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await checkAdmin()
    }
    init()
    return () => { cancelled = true }
  }, [checkAdmin])

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function createSlot() {
    if (!slotDate || !slotTime) {
      setError('Please select both a date and time.')
      return
    }

    setCreatingSlot(true)
    setError('')

    if (bulkDates) {
      if (!endDate) {
        setError('Please select an end date for bulk creation.')
        setCreatingSlot(false)
        return
      }
      if (selectedDays.length === 0) {
        setError('Please select at least one day of the week.')
        setCreatingSlot(false)
        return
      }

      const start = new Date(slotDate)
      const end = new Date(endDate)
      const slotsToCreate = []

      const dayMap: Record<string, number> = {
        Monday: 1, Tuesday: 2, Wednesday: 3,
        Thursday: 4, Friday: 5, Saturday: 6,
      }

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayName = Object.keys(dayMap).find(k => dayMap[k] === d.getDay())
        if (dayName && selectedDays.includes(dayName)) {
          slotsToCreate.push({
            slot_date: d.toISOString().split('T')[0],
            slot_time: slotTime,
            status: 'available',
          })
        }
      }

      if (slotsToCreate.length === 0) {
        setError('No matching dates found for the selected days in that range.')
        setCreatingSlot(false)
        return
      }

      const { error: insertError } = await supabase
        .from('lesson_slots')
        .insert(slotsToCreate)

      if (insertError) {
        setError('Failed to create slots.')
        setCreatingSlot(false)
        return
      }

      setSuccessMessage(`${slotsToCreate.length} slots created successfully.`)

    } else {
      const { error: insertError } = await supabase
        .from('lesson_slots')
        .insert({ slot_date: slotDate, slot_time: slotTime, status: 'available' })

      if (insertError) {
        setError('Failed to create slot. It may already exist.')
        setCreatingSlot(false)
        return
      }

      setSuccessMessage('Lesson slot created successfully.')
    }

    setTimeout(() => setSuccessMessage(''), 3000)
    setShowCreateModal(false)
    setSlotDate('')
    setSlotTime('')
    setEndDate('')
    setSelectedDays([])
    setBulkDates(false)
    setCreatingSlot(false)
    loadData()
  }

  async function saveEditSlot() {
    if (!editingSlot || !editDate || !editTime) {
      setError('Please select both a date and time.')
      return
    }

    setSavingEdit(true)
    setError('')

    const { error: updateError } = await supabase
      .from('lesson_slots')
      .update({ slot_date: editDate, slot_time: editTime })
      .eq('slot_id', editingSlot.slot_id)

    if (updateError) {
      setError('Failed to update slot.')
      setSavingEdit(false)
      return
    }

    setSuccessMessage('Slot updated successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    setShowEditModal(false)
    setEditingSlot(null)
    setEditDate('')
    setEditTime('')
    setSavingEdit(false)
    loadData()
  }

  async function deleteSlot(slotId: string) {
    const { error: deleteError } = await supabase
      .from('lesson_slots')
      .delete()
      .eq('slot_id', slotId)

    if (deleteError) {
      setError('Cannot delete a slot that has bookings.')
      setTimeout(() => setError(''), 3000)
      return
    }

    setSuccessMessage('Slot deleted.')
    setTimeout(() => setSuccessMessage(''), 3000)
    loadData()
  }

  async function cancelBooking() {
    if (!cancelReason.trim()) {
      setError('Please enter a cancellation reason.')
      return
    }
    if (!selectedBooking) return

    setCancelling(true)
    setError('')

    const { error: cancelError } = await supabase
      .from('lesson_bookings')
      .update({ status: 'cancelled', cancellation_reason: cancelReason })
      .eq('booking_id', selectedBooking.booking_id)

    if (cancelError) {
      setError('Failed to cancel booking.')
      setCancelling(false)
      return
    }

    await supabase
      .from('lesson_slots')
      .update({ status: 'available' })
      .eq('slot_id', selectedBooking.slot_id)

    await supabase.from('notifications').insert({
      recipient_id: selectedBooking.learner_id,
      message: `Your lesson on ${selectedBooking.lesson_slots?.slot_date} at ${selectedBooking.lesson_slots?.slot_time?.slice(0, 5)} has been cancelled. Reason: ${cancelReason}`,
      type: 'cancellation',
    })

    if (selectedBooking.instructor_id) {
      await supabase.from('notifications').insert({
        recipient_id: selectedBooking.instructor_id,
        message: `A lesson on ${selectedBooking.lesson_slots?.slot_date} at ${selectedBooking.lesson_slots?.slot_time?.slice(0, 5)} has been cancelled by the administrator.`,
        type: 'cancellation',
      })
    }

    setSuccessMessage('Booking cancelled successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    setShowCancelModal(false)
    setSelectedBooking(null)
    setCancelReason('')
    setCancelling(false)
    loadData()
  }

  function toggleDay(day: string) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  function statusBadge(status: string) {
    const styles: Record<string, { background: string; color: string }> = {
      available: { background: '#d1fae5', color: '#065f46' },
      booked: { background: '#dbeafe', color: '#1e40af' },
      blocked: { background: '#f3f4f6', color: '#374151' },
      scheduled: { background: '#dbeafe', color: '#1e40af' },
      completed: { background: '#d1fae5', color: '#065f46' },
      cancelled: { background: '#fee2e2', color: '#991b1b' },
    }
    return (
      <span style={{
        ...styles[status] || styles.available,
        padding: '3px 10px', borderRadius: '20px',
        fontSize: '11px', fontWeight: '700',
        textTransform: 'capitalize' as const,
      }}>
        {status}
      </span>
    )
  }

  // ─── Derived state ────────────────────────────────────────────────────────────

  const filteredSlots = slots.filter(s => {
    const matchesSearch = s.slot_date?.includes(search)
    const matchesFilter = filterStatus === 'all' || s.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const filteredBookings = bookings.filter(b => {
    const learnerName = `${b.learner?.first_name} ${b.learner?.surname}`.toLowerCase()
    const matchesSearch = learnerName.includes(search.toLowerCase())
    const matchesFilter = filterStatus === 'all' || b.status === filterStatus
    return matchesSearch && matchesFilter
  })

  // ─── Loading state ────────────────────────────────────────────────────────────

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
          <p style={{ color: blue, fontWeight: '600' }}>Loading Lessons...</p>
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: '24px',
      }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>
            📅 Lesson Management
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>
            Create lesson slots and manage all bookings
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '10px 18px', borderRadius: '10px',
              border: 'none',
              background: `linear-gradient(135deg, ${blue}, ${orange})`,
              color: 'white', fontSize: '13px',
              fontWeight: '600', cursor: 'pointer',
            }}
          >
            + Create Slot
          </button>
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
      </div>

      {/* Success Message */}
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

      {/* Error Message */}
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

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px', marginBottom: '24px',
      }}>
        {[
          { label: 'Total Slots', value: slots.length, colour: blue },
          { label: 'Available', value: slots.filter(s => s.status === 'available').length, colour: '#059669' },
          { label: 'Booked', value: slots.filter(s => s.status === 'booked').length, colour: '#2563eb' },
          { label: 'Total Bookings', value: bookings.length, colour: orange },
          { label: 'Scheduled', value: bookings.filter(b => b.status === 'scheduled').length, colour: '#7c3aed' },
          { label: 'Completed', value: bookings.filter(b => b.status === 'completed').length, colour: '#059669' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'white', borderRadius: '12px',
            padding: '16px', textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            borderTop: `3px solid ${stat.colour}`,
          }}>
            <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: stat.colour }}>
              {stat.value}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px',
        background: 'white', borderRadius: '12px',
        padding: '4px', marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        width: 'fit-content',
      }}>
        {[
          { id: 'slots', label: '🗓 Lesson Slots' },
          { id: 'bookings', label: '📋 All Bookings' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id)
              setSearch('')
              setFilterStatus('all')
            }}
            style={{
              padding: '10px 20px', borderRadius: '10px',
              border: 'none',
              background: activeTab === tab.id
                ? `linear-gradient(135deg, ${blue}, ${orange})`
                : 'transparent',
              color: activeTab === tab.id ? 'white' : '#6b7280',
              fontSize: '13px', fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Filter */}
      <div style={{
        background: 'white', borderRadius: '14px',
        padding: '16px 20px', marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', gap: '12px', alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <input
          type="text"
          placeholder={activeTab === 'slots'
            ? '🔍 Search by date (e.g. 2026-04-01)...'
            : '🔍 Search by learner name...'
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '200px',
            padding: '10px 14px', borderRadius: '10px',
            border: '1px solid #e5e7eb',
            fontSize: '13px', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(activeTab === 'slots'
            ? ['all', 'available', 'booked', 'blocked']
            : ['all', 'scheduled', 'completed', 'cancelled']
          ).map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              style={{
                padding: '8px 14px', borderRadius: '20px',
                border: filterStatus === f ? 'none' : '1px solid #e5e7eb',
                background: filterStatus === f
                  ? `linear-gradient(135deg, ${blue}, ${orange})`
                  : 'white',
                color: filterStatus === f ? 'white' : '#6b7280',
                fontSize: '12px', fontWeight: filterStatus === f ? '700' : '400',
                cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── SLOTS TAB ── */}
      {activeTab === 'slots' && (
        <div style={{
          background: 'white', borderRadius: '14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 1fr 1fr',
            padding: '12px 20px',
            background: lightBlue,
            borderBottom: '1px solid #e5e7eb',
          }}>
            {['Date', 'Time', 'Status', 'Actions'].map((h, i) => (
              <p key={i} style={{
                margin: 0, fontSize: '11px',
                fontWeight: '700', color: blue,
                textTransform: 'uppercase',
              }}>
                {h}
              </p>
            ))}
          </div>

          {filteredSlots.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>📅</p>
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>
                No slots found. Click &quot;+ Create Slot&quot; to add one.
              </p>
            </div>
          ) : (
            filteredSlots.map((slot, index) => (
              <div
                key={slot.slot_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 2fr 1fr 1fr',
                  padding: '14px 20px',
                  borderBottom: '1px solid #f3f4f6',
                  background: index % 2 === 0 ? 'white' : '#fafafa',
                  alignItems: 'center',
                }}
              >
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                  {new Date(slot.slot_date).toLocaleDateString('en-GB', {
                    weekday: 'long', year: 'numeric',
                    month: 'long', day: 'numeric',
                  })}
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>
                  {slot.slot_time?.slice(0, 5)}
                </p>
                <div>{statusBadge(slot.status)}</div>

                {/* ── Edit + Delete buttons ── */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {slot.status === 'available' && (
                    <>
                      <button
                        onClick={() => {
                          setEditingSlot(slot)
                          setEditDate(slot.slot_date)
                          setEditTime(slot.slot_time)
                          setError('')
                          setShowEditModal(true)
                        }}
                        style={{
                          padding: '5px 10px', borderRadius: '6px',
                          border: 'none', background: '#dbeafe',
                          color: '#1e40af', fontSize: '11px',
                          fontWeight: '700', cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteSlot(slot.slot_id)}
                        style={{
                          padding: '5px 10px', borderRadius: '6px',
                          border: 'none', background: '#fee2e2',
                          color: '#991b1b', fontSize: '11px',
                          fontWeight: '700', cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── BOOKINGS TAB ── */}
      {activeTab === 'bookings' && (
        <div style={{
          background: 'white', borderRadius: '14px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 2fr 1fr 1fr 1fr',
            padding: '12px 20px',
            background: lightBlue,
            borderBottom: '1px solid #e5e7eb',
          }}>
            {['Learner', 'Instructor', 'Date & Time', 'Status', 'Booked On', 'Actions'].map((h, i) => (
              <p key={i} style={{
                margin: 0, fontSize: '11px',
                fontWeight: '700', color: blue,
                textTransform: 'uppercase',
              }}>
                {h}
              </p>
            ))}
          </div>

          {filteredBookings.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '32px', marginBottom: '8px' }}>📋</p>
              <p style={{ color: '#9ca3af', fontSize: '14px' }}>No bookings found</p>
            </div>
          ) : (
            filteredBookings.map((booking, index) => (
              <div
                key={booking.booking_id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 2fr 2fr 1fr 1fr 1fr',
                  padding: '14px 20px',
                  borderBottom: '1px solid #f3f4f6',
                  background: index % 2 === 0 ? 'white' : '#fafafa',
                  alignItems: 'center',
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                    {booking.learner?.first_name} {booking.learner?.surname}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                    {booking.learner?.phone_number}
                  </p>
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>
                  {booking.instructor?.first_name} {booking.instructor?.surname}
                </p>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                    {booking.lesson_slots?.slot_date
                      ? new Date(booking.lesson_slots.slot_date).toLocaleDateString('en-GB', {
                        weekday: 'short', month: 'short', day: 'numeric',
                      })
                      : 'N/A'}
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                    {booking.lesson_slots?.slot_time?.slice(0, 5)}
                  </p>
                </div>
                <div>{statusBadge(booking.status)}</div>
                <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af' }}>
                  {new Date(booking.created_at).toLocaleDateString()}
                </p>
                <div>
                  {booking.status === 'scheduled' && (
                    <button
                      onClick={() => {
                        setSelectedBooking(booking)
                        setShowCancelModal(true)
                      }}
                      style={{
                        padding: '5px 10px', borderRadius: '6px',
                        border: 'none', background: '#fee2e2',
                        color: '#991b1b', fontSize: '11px',
                        fontWeight: '700', cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── CREATE SLOT MODAL ── */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '20px',
            padding: '32px', width: '100%',
            maxWidth: '480px', margin: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 20px' }}>
              Create Lesson Slot
            </h2>

            {error && (
              <div style={{
                background: '#fee2e2', borderRadius: '8px',
                padding: '10px 14px', marginBottom: '16px',
                color: '#991b1b', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            {/* Bulk toggle */}
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: '10px', marginBottom: '20px',
              padding: '12px 16px', background: lightBlue,
              borderRadius: '10px',
            }}>
              <div
                onClick={() => setBulkDates(!bulkDates)}
                style={{
                  width: '20px', height: '20px', borderRadius: '6px',
                  border: '2px solid rgba(30,58,138,0.5)',
                  background: bulkDates
                    ? `linear-gradient(135deg, ${blue}, ${orange})`
                    : 'white',
                  cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                {bulkDates && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: blue }}>Bulk Create</p>
                <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                  Create slots across a date range for selected days
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: '600', color: '#374151', marginBottom: '6px',
              }}>
                {bulkDates ? 'Start Date' : 'Date'}
              </label>
              <input
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%', padding: '10px 14px',
                  borderRadius: '10px', border: '1px solid #e5e7eb',
                  fontSize: '13px', outline: 'none',
                }}
              />
            </div>

            {bulkDates && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '600', color: '#374151', marginBottom: '6px',
                }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={slotDate || new Date().toISOString().split('T')[0]}
                  style={{
                    width: '100%', padding: '10px 14px',
                    borderRadius: '10px', border: '1px solid #e5e7eb',
                    fontSize: '13px', outline: 'none',
                  }}
                />
              </div>
            )}

            {bulkDates && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block', fontSize: '13px',
                  fontWeight: '600', color: '#374151', marginBottom: '8px',
                }}>
                  Days of the Week
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {weekDays.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      style={{
                        padding: '6px 12px', borderRadius: '20px',
                        border: selectedDays.includes(day) ? 'none' : '1px solid #e5e7eb',
                        background: selectedDays.includes(day)
                          ? `linear-gradient(135deg, ${blue}, ${orange})`
                          : 'white',
                        color: selectedDays.includes(day) ? 'white' : '#6b7280',
                        fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                      }}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: '600', color: '#374151', marginBottom: '8px',
              }}>
                Time
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {timeSlots.map(time => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setSlotTime(time + ':00')}
                    style={{
                      padding: '8px 12px', borderRadius: '8px',
                      border: slotTime === time + ':00' ? 'none' : '1px solid #e5e7eb',
                      background: slotTime === time + ':00'
                        ? `linear-gradient(135deg, ${blue}, ${orange})`
                        : 'white',
                      color: slotTime === time + ':00' ? 'white' : '#6b7280',
                      fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    }}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setSlotDate('')
                  setSlotTime('')
                  setEndDate('')
                  setSelectedDays([])
                  setBulkDates(false)
                  setError('')
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: '1px solid #e5e7eb', background: 'white',
                  color: '#374151', fontSize: '14px',
                  fontWeight: '600', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={createSlot}
                disabled={creatingSlot}
                style={{
                  flex: 2, padding: '12px', borderRadius: '10px',
                  border: 'none',
                  background: creatingSlot ? '#e5e7eb' : `linear-gradient(135deg, ${blue}, ${orange})`,
                  color: creatingSlot ? '#9ca3af' : 'white',
                  fontSize: '14px', fontWeight: '700',
                  cursor: creatingSlot ? 'not-allowed' : 'pointer',
                }}
              >
                {creatingSlot ? 'Creating...' : bulkDates ? 'Create All Slots' : 'Create Slot'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT SLOT MODAL ── */}
      {showEditModal && editingSlot && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '20px',
            padding: '32px', width: '100%',
            maxWidth: '480px', margin: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 20px' }}>
              Edit Lesson Slot
            </h2>

            {error && (
              <div style={{
                background: '#fee2e2', borderRadius: '8px',
                padding: '10px 14px', marginBottom: '16px',
                color: '#991b1b', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: '600', color: '#374151', marginBottom: '6px',
              }}>
                Date
              </label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                style={{
                  width: '100%', padding: '10px 14px',
                  borderRadius: '10px', border: '1px solid #e5e7eb',
                  fontSize: '13px', outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: '600', color: '#374151', marginBottom: '8px',
              }}>
                Time
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {timeSlots.map(time => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setEditTime(time + ':00')}
                    style={{
                      padding: '8px 12px', borderRadius: '8px',
                      border: editTime === time + ':00' ? 'none' : '1px solid #e5e7eb',
                      background: editTime === time + ':00'
                        ? `linear-gradient(135deg, ${blue}, ${orange})`
                        : 'white',
                      color: editTime === time + ':00' ? 'white' : '#6b7280',
                      fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    }}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingSlot(null)
                  setEditDate('')
                  setEditTime('')
                  setError('')
                }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: '1px solid #e5e7eb', background: 'white',
                  color: '#374151', fontSize: '14px',
                  fontWeight: '600', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveEditSlot}
                disabled={savingEdit}
                style={{
                  flex: 2, padding: '12px', borderRadius: '10px',
                  border: 'none',
                  background: savingEdit ? '#e5e7eb' : `linear-gradient(135deg, ${blue}, ${orange})`,
                  color: savingEdit ? '#9ca3af' : 'white',
                  fontSize: '14px', fontWeight: '700',
                  cursor: savingEdit ? 'not-allowed' : 'pointer',
                }}
              >
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CANCEL BOOKING MODAL ── */}
      {showCancelModal && selectedBooking && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'white', borderRadius: '20px',
            padding: '32px', width: '100%',
            maxWidth: '400px', margin: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h2 style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>
              Cancel Booking
            </h2>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 20px' }}>
              Cancelling lesson for <strong>
                {selectedBooking.learner?.first_name} {selectedBooking.learner?.surname}
              </strong> on <strong>
                {selectedBooking.lesson_slots?.slot_date}
              </strong> at <strong>
                {selectedBooking.lesson_slots?.slot_time?.slice(0, 5)}
              </strong>
            </p>

            {error && (
              <div style={{
                background: '#fee2e2', borderRadius: '8px',
                padding: '10px 14px', marginBottom: '16px',
                color: '#991b1b', fontSize: '13px',
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block', fontSize: '13px',
                fontWeight: '600', color: '#374151', marginBottom: '6px',
              }}>
                Cancellation Reason (required)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 14px',
                  borderRadius: '10px', border: '1px solid #e5e7eb',
                  fontSize: '13px', outline: 'none',
                  resize: 'none', fontFamily: 'inherit',
                }}
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
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: '1px solid #e5e7eb', background: 'white',
                  color: '#374151', fontSize: '14px',
                  fontWeight: '600', cursor: 'pointer',
                }}
              >
                Go Back
              </button>
              <button
                onClick={cancelBooking}
                disabled={cancelling}
                style={{
                  flex: 2, padding: '12px', borderRadius: '10px',
                  border: 'none',
                  background: cancelling ? '#e5e7eb' : '#dc2626',
                  color: cancelling ? '#9ca3af' : 'white',
                  fontSize: '14px', fontWeight: '700',
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                }}
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
