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

// ── Skeleton Loader ────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = '16px', r = '6px' }: { w?: string; h?: string; r?: string }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function LessonsPage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [approvedInstructors, setApprovedInstructors] = useState<{user_id: string, first_name: string, surname: string}[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('slots') // 'slots' or 'bookings'
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [successMessage, setSuccessMessage] = useState('')
  const [error, setError] = useState('')
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  
  // Selection state
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [assigning, setAssigning] = useState(false)

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

  // Design tokens
  const textDark = '#1e293b'
  const textMuted = '#64748b'
  const orange = '#e8731a'

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
      .order('slot_date', { ascending: false })

    const { data: bookingsData } = await supabase
      .from('lesson_bookings')
      .select(`
        *,
        learner:users!lesson_bookings_learner_id_fkey (first_name, surname, phone_number),
        instructor:users!lesson_bookings_instructor_id_fkey (first_name, surname),
        lesson_slots (slot_date, slot_time)
      `)
      .order('created_at', { ascending: false })

    const { data: instData } = await supabase
      .from('users')
      .select('user_id, first_name, surname')
      .eq('role', 'instructor')
      .eq('status', 'approved')

    setSlots(slotsData || [])
    setBookings(bookingsData || [])
    setApprovedInstructors(instData || [])
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
    if (!slotDate || (!bulkDates && !slotTime)) {
      setError('Please fill in all required fields.')
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
          if (!slotTime) {
            setError('Please select a time for the slots.')
            setCreatingSlot(false)
            return
          }
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

  async function assignInstructor(instructorId: string) {
    if (!selectedBooking) return
    setAssigning(true)
    setError('')

    const { error: assignError } = await supabase
      .from('lesson_bookings')
      .update({ instructor_id: instructorId })
      .eq('booking_id', selectedBooking.booking_id)

    if (assignError) {
      setError('Failed to assign instructor.')
      setAssigning(false)
      return
    }

    // Add notification to the new instructor
    await supabase.from('notifications').insert({
      recipient_id: instructorId,
      message: `You have been assigned a new lesson on ${selectedBooking.lesson_slots?.slot_date} at ${selectedBooking.lesson_slots?.slot_time?.slice(0, 5)}.`,
      type: 'assignment'
    })

    setSuccessMessage('Instructor assigned successfully.')
    setTimeout(() => setSuccessMessage(''), 3000)
    setShowAssignModal(false)
    setSelectedBooking(null)
    setAssigning(false)
    loadData()
  }

  function toggleDay(day: string) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  function statusBadge(status: string) {
    const styles: Record<string, { background: string; color: string; border: string }> = {
      available: { background: '#f0fdf4', color: '#16a34a', border: '#dcfce7' },
      booked: { background: '#eff6ff', color: '#2563eb', border: '#dbeafe' },
      blocked: { background: '#f8fafc', color: '#475569', border: '#f1f5f9' },
      scheduled: { background: '#eff6ff', color: '#2563eb', border: '#dbeafe' },
      completed: { background: '#f0fdf4', color: '#16a34a', border: '#dcfce7' },
      cancelled: { background: '#fef2f2', color: '#dc2626', border: '#fee2e2' },
    }
    const style = styles[status] || styles.available
    return (
      <span style={{
        background: style.background, color: style.color, border: `1px solid ${style.border}`,
        padding: '4px 10px', borderRadius: '12px', fontSize: '11px',
        fontWeight: '700', textTransform: 'capitalize',
      }}>
        {status}
      </span>
    )
  }

  // ─── Derived state ────────────────────────────────────────────────────────────

  // Compute actual status: If a slot has an active booking, force it to 'booked'
  const computedSlots = slots.map(slot => {
    const hasActiveBooking = bookings.some(b => b.slot_id === slot.slot_id && b.status !== 'cancelled')
    return {
      ...slot,
      actual_status: hasActiveBooking ? 'booked' : slot.status
    }
  })

  const filteredSlots = computedSlots.filter(s => {
    const matchesSearch = s.slot_date?.includes(search)
    const matchesFilter = filterStatus === 'all' || s.actual_status === filterStatus
    return matchesSearch && matchesFilter
  })

  const filteredBookings = bookings.filter(b => {
    const learnerName = `${b.learner?.first_name || ''} ${b.learner?.surname || ''}`.toLowerCase()
    const matchesSearch = learnerName.includes(search.toLowerCase())
    const matchesFilter = filterStatus === 'all' || b.status === filterStatus
    return matchesSearch && matchesFilter
  })

  const handleCardClick = (label: string) => {
    if (label === 'Total Slots') {
      setActiveTab('slots')
      setFilterStatus('all')
    } else if (label === 'Available Slots') {
      setActiveTab('slots')
      setFilterStatus('available')
    } else if (label === 'Booked Slots') {
      setActiveTab('slots')
      setFilterStatus('booked')
    } else if (label === 'Total Bookings') {
      setActiveTab('bookings')
      setFilterStatus('all')
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
      
      <div style={{ minHeight: '100%', padding: '0 0 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ color: textDark, fontSize: '22px', fontWeight: '800', margin: 0 }}>📅 Lesson Management</h1>
            <p style={{ color: textMuted, fontSize: '13px', margin: '4px 0 0', fontWeight: '500' }}>Create lesson slots and manage all bookings</p>
          </div>
        </div>

        {/* Success / Error Messages */}
        {successMessage && (
          <div style={{ background: '#f0fdf4', border: '1px solid #dcfce7', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#16a34a', fontSize: '13px', fontWeight: '600' }}>
            ✅ {successMessage}
          </div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', color: '#dc2626', fontSize: '13px', fontWeight: '600' }}>
            ❌ {error}
          </div>
        )}

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {loading ? (
             Array(4).fill(0).map((_, i) => (
               <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                 <Skeleton h="28px" w="40px" r="6px" />
                 <div style={{ marginTop: '8px' }}><Skeleton h="11px" w="70%" r="4px" /></div>
               </div>
             ))
          ) : (
            [
              { label: 'Total Slots', value: computedSlots.length, colour: '#1e293b' },
              { label: 'Available Slots', value: computedSlots.filter(s => s.actual_status === 'available').length, colour: '#10b981' },
              { label: 'Booked Slots', value: computedSlots.filter(s => s.actual_status === 'booked').length, colour: '#3b82f6' },
              { label: 'Total Bookings', value: bookings.length, colour: orange },
            ].map((stat, i) => (
              <div 
                key={i} 
                onClick={() => handleCardClick(stat.label)}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
                style={{
                  background: 'white', borderRadius: '10px', padding: '20px 22px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)', borderLeft: `3px solid ${stat.colour}`,
                  cursor: 'pointer', transition: 'transform 0.15s',
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '800', color: textDark, lineHeight: 1.1 }}>{stat.value}</p>
                <p style={{ margin: 0, fontSize: '11px', color: textMuted, fontWeight: '500' }}>{stat.label}</p>
              </div>
            ))
          )}
        </div>

        {/* Tabs and Create Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{
            display: 'flex', gap: '4px', background: 'white', borderRadius: '10px',
            padding: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', width: 'fit-content',
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
                  padding: '10px 20px', borderRadius: '8px', border: 'none',
                  background: activeTab === tab.id ? textDark : 'transparent',
                  color: activeTab === tab.id ? 'white' : textMuted,
                  fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'slots' && (
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '10px 18px', borderRadius: '8px', border: 'none',
                background: '#10b981', color: 'white', fontSize: '13px',
                fontWeight: '700', cursor: 'pointer',
              }}
            >
              + Create Slot
            </button>
          )}
        </div>

        {/* Search and Filter */}
        <div style={{
          background: 'white', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap',
        }}>
          <input
            type="text"
            placeholder={activeTab === 'slots' ? '🔍 Search by date (YYYY-MM-DD)...' : '🔍 Search by learner name...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
          />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(activeTab === 'slots' ? ['all', 'available', 'booked', 'blocked'] : ['all', 'scheduled', 'completed', 'cancelled']).map(f => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                style={{
                  padding: '8px 14px', borderRadius: '20px',
                  border: filterStatus === f ? 'none' : '1px solid #e2e8f0',
                  background: filterStatus === f ? textDark : 'white',
                  color: filterStatus === f ? 'white' : textMuted,
                  fontSize: '12px', fontWeight: filterStatus === f ? '700' : '500',
                  cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s',
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* ── SLOTS TAB ── */}
        {activeTab === 'slots' && (
          <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Date', 'Time', 'Status', 'Actions'].map((h, i) => (
                <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</p>
              ))}
            </div>

            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                  <Skeleton w="120px" h="14px" r="4px" />
                  <Skeleton w="60px" h="14px" r="4px" />
                  <Skeleton w="70px" h="22px" r="12px" />
                  <div style={{ display: 'flex', gap: '6px' }}><Skeleton w="50px" h="26px" r="6px" /><Skeleton w="50px" h="26px" r="6px" /></div>
                </div>
              ))
            ) : filteredSlots.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: '32px', marginBottom: '12px' }}>📅</p>
                <p style={{ color: textMuted, fontSize: '14px', fontWeight: '500' }}>No slots found matching criteria. Click;+ Create Slot; to add one.</p>
              </div>
            ) : (
              filteredSlots.map((slot) => (
                <div key={slot.slot_id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: textDark }}>
                    {new Date(slot.slot_date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  <p style={{ margin: 0, fontSize: '13px', color: textDark }}>{slot.slot_time?.slice(0, 5)}</p>
                  <div>{statusBadge(slot.actual_status)}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {slot.actual_status === 'available' && (
                      <>
                        <button
                          onClick={() => { setEditingSlot(slot); setEditDate(slot.slot_date); setEditTime(slot.slot_time); setError(''); setShowEditModal(true) }}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: textDark, fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteSlot(slot.slot_id)}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#dc2626', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
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
          <div style={{ background: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 1fr 1fr 1.5fr', padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Learner', 'Instructor', 'Date & Time', 'Status', 'Booked On', 'Actions'].map((h, i) => (
                <p key={i} style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</p>
              ))}
            </div>

            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 1fr 1fr 1.5fr', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                  <div><Skeleton w="100px" h="13px" r="4px" /><div style={{ marginTop: '5px' }}><Skeleton w="70px" h="10px" r="4px" /></div></div>
                  <Skeleton w="100px" h="13px" r="4px" />
                  <div><Skeleton w="90px" h="13px" r="4px" /><div style={{ marginTop: '5px' }}><Skeleton w="50px" h="10px" r="4px" /></div></div>
                  <Skeleton w="70px" h="22px" r="12px" />
                  <Skeleton w="60px" h="11px" r="4px" />
                  <div style={{ display: 'flex', gap: '6px' }}><Skeleton w="60px" h="26px" r="6px" /></div>
                </div>
              ))
            ) : filteredBookings.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: '32px', marginBottom: '12px' }}>📋</p>
                <p style={{ color: textMuted, fontSize: '14px', fontWeight: '500' }}>No bookings found matching criteria</p>
              </div>
            ) : (
              filteredBookings.map((booking) => (
                <div key={booking.booking_id} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 2fr 1fr 1fr 1.5fr', padding: '16px 20px', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: textDark }}>{booking.learner?.first_name} {booking.learner?.surname}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: textMuted }}>{booking.learner?.phone_number}</p>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: textDark }}>{booking.instructor ? `${booking.instructor.first_name} ${booking.instructor.surname}` : 'Unassigned'}</p>
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: textDark }}>
                      {booking.lesson_slots?.slot_date ? new Date(booking.lesson_slots.slot_date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }) : 'N/A'}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: textMuted }}>{booking.lesson_slots?.slot_time?.slice(0, 5)}</p>
                  </div>
                  <div>{statusBadge(booking.status)}</div>
                  <p style={{ margin: 0, fontSize: '11px', color: textMuted }}>{new Date(booking.created_at).toLocaleDateString()}</p>
                  <div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {booking.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => { setSelectedBooking(booking); setShowAssignModal(true) }}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #dbeafe', background: '#eff6ff', color: '#2563eb', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Assign
                          </button>
                          <button
                            onClick={() => { setSelectedBooking(booking); setShowCancelModal(true) }}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#dc2626', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── ASSIGN INSTRUCTOR MODAL ── */}
        {showAssignModal && selectedBooking && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '400px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ color: textDark, fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Assign Instructor</h2>
              <p style={{ color: textMuted, fontSize: '13px', margin: '0 0 20px' }}>
                Select an instructor for <strong>{selectedBooking.learner?.first_name} {selectedBooking.learner?.surname}</strong> on <strong>{selectedBooking.lesson_slots?.slot_date}</strong> at <strong>{selectedBooking.lesson_slots?.slot_time?.slice(0, 5)}</strong>.
              </p>

              {error && <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}

              <div style={{ overflowY: 'auto', flex: 1, marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {approvedInstructors.length === 0 ? (
                  <p style={{ fontSize: '13px', color: textMuted, textAlign: 'center', padding: '20px' }}>No approved instructors available.</p>
                ) : (
                  approvedInstructors.map(inst => (
                    <button
                      key={inst.user_id}
                      onClick={() => assignInstructor(inst.user_id)}
                      disabled={assigning}
                      style={{
                        padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white',
                        color: textDark, fontSize: '14px', fontWeight: '600', cursor: assigning ? 'not-allowed' : 'pointer',
                        textAlign: 'left', transition: 'all 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                      onMouseEnter={e => { if (!assigning) (e.currentTarget.style.background = '#f8fafc') }}
                      onMouseLeave={e => { if (!assigning) (e.currentTarget.style.background = 'white') }}
                    >
                      <span>{inst.first_name} {inst.surname}</span>
                      {selectedBooking.instructor_id === inst.user_id && <span style={{ fontSize: '11px', color: '#16a34a', background: '#f0fdf4', padding: '2px 8px', borderRadius: '10px' }}>Current</span>}
                    </button>
                  ))
                )}
              </div>

              <button
                onClick={() => { setShowAssignModal(false); setSelectedBooking(null); setError('') }}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── CREATE SLOT MODAL ── */}
        {showCreateModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '480px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
              <h2 style={{ color: textDark, fontSize: '18px', fontWeight: '800', margin: '0 0 20px' }}>Create Lesson Slot</h2>

              {error && <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}

              {/* Bulk toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', padding: '12px 16px', background: '#f1f5f9', borderRadius: '10px' }}>
                <div
                  onClick={() => setBulkDates(!bulkDates)}
                  style={{
                    width: '20px', height: '20px', borderRadius: '6px', border: '2px solid #cbd5e1',
                    background: bulkDates ? textDark : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}
                >
                  {bulkDates && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: textDark }}>Bulk Create</p>
                  <p style={{ margin: 0, fontSize: '11px', color: textMuted }}>Create slots across a date range for selected days</p>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>{bulkDates ? 'Start Date' : 'Date'}</label>
                <input type="date" value={slotDate} onChange={(e) => setSlotDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {bulkDates && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={slotDate || new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              )}

              {bulkDates && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Days of the Week</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {weekDays.map(day => (
                      <button
                        key={day} type="button" onClick={() => toggleDay(day)}
                        style={{ padding: '6px 12px', borderRadius: '20px', border: selectedDays.includes(day) ? 'none' : '1px solid #e2e8f0', background: selectedDays.includes(day) ? textDark : 'white', color: selectedDays.includes(day) ? 'white' : textMuted, fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Time</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {timeSlots.map(time => (
                    <button
                      key={time} type="button" onClick={() => setSlotTime(time + ':00')}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: slotTime === time + ':00' ? 'none' : '1px solid #e2e8f0', background: slotTime === time + ':00' ? textDark : 'white', color: slotTime === time + ':00' ? 'white' : textMuted, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setShowCreateModal(false); setSlotDate(''); setSlotTime(''); setEndDate(''); setSelectedDays([]); setBulkDates(false); setError('') }}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={createSlot} disabled={creatingSlot}
                  style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: creatingSlot ? '#cbd5e1' : '#10b981', color: 'white', fontSize: '14px', fontWeight: '700', cursor: creatingSlot ? 'not-allowed' : 'pointer' }}
                >
                  {creatingSlot ? 'Creating...' : bulkDates ? 'Create All Slots' : 'Create Slot'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── EDIT SLOT MODAL ── */}
        {showEditModal && editingSlot && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '480px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h2 style={{ color: textDark, fontSize: '18px', fontWeight: '800', margin: '0 0 20px' }}>Edit Lesson Slot</h2>
              
              {error && <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Date</label>
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Time</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {timeSlots.map(time => (
                    <button
                      key={time} type="button" onClick={() => setEditTime(time + ':00')}
                      style={{ padding: '8px 12px', borderRadius: '8px', border: editTime === time + ':00' ? 'none' : '1px solid #e2e8f0', background: editTime === time + ':00' ? textDark : 'white', color: editTime === time + ':00' ? 'white' : textMuted, fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setShowEditModal(false); setEditingSlot(null); setEditDate(''); setEditTime(''); setError('') }}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditSlot} disabled={savingEdit}
                  style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: savingEdit ? '#cbd5e1' : textDark, color: 'white', fontSize: '14px', fontWeight: '700', cursor: savingEdit ? 'not-allowed' : 'pointer' }}
                >
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CANCEL BOOKING MODAL ── */}
        {showCancelModal && selectedBooking && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '400px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
              <h2 style={{ color: textDark, fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Cancel Booking</h2>
              <p style={{ color: textMuted, fontSize: '13px', margin: '0 0 20px' }}>
                Cancelling lesson for <strong>{selectedBooking.learner?.first_name} {selectedBooking.learner?.surname}</strong> on <strong>{selectedBooking.lesson_slots?.slot_date}</strong> at <strong>{selectedBooking.lesson_slots?.slot_time?.slice(0, 5)}</strong>
              </p>

              {error && <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', color: '#dc2626', fontSize: '13px' }}>{error}</div>}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Cancellation Reason (required)</label>
                <textarea
                  value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Enter reason for cancellation..." rows={3}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => { setShowCancelModal(false); setSelectedBooking(null); setCancelReason(''); setError('') }}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Go Back
                </button>
                <button
                  onClick={cancelBooking} disabled={cancelling}
                  style={{ flex: 2, padding: '12px', borderRadius: '8px', border: 'none', background: cancelling ? '#cbd5e1' : '#dc2626', color: 'white', fontSize: '14px', fontWeight: '700', cursor: cancelling ? 'not-allowed' : 'pointer' }}
                >
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
