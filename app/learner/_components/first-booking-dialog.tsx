'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Clock4 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DTSkeleton } from '@/app/_components/ui/dt-skeleton'
import { bookLessonSlots, describeBooking, formatMoney, getMyLessonPrice } from '@/app/learner/_lib/book-lesson-slots'

type Slot = {
  slot_id: string
  slot_date: string
  slot_time: string
}

type FirstBookingDialogProps = {
  learnerName: string
  remainingSlots: number
  onLater: () => void
  onBooked: (summary: string) => void
}

const supabase = createClient()

const blue = '#1e293b'
const orange = '#ff5a00'

export function FirstBookingDialog({
  learnerName,
  remainingSlots,
  onLater,
  onBooked,
}: FirstBookingDialogProps) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [lessonPrice, setLessonPrice] = useState<number | null>(null)
  const [selectedSlots, setSelectedSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  const loadSlots = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, '0')).join('-')
    const currentTime = now.toTimeString().slice(0, 5)

    const [{ data, error: slotsError }, price] = await Promise.all([
      supabase
        .from('lesson_slots')
        .select('slot_id, slot_date, slot_time')
        .eq('status', 'available')
        .or(`slot_date.gt.${today},and(slot_date.eq.${today},slot_time.gte.${currentTime})`)
        .order('slot_date', { ascending: true })
        .order('slot_time', { ascending: true })
        .limit(60),
      getMyLessonPrice(),
    ])
    setLessonPrice(price)

    if (slotsError) {
      setError(`Could not load available slots: ${slotsError.message}`)
    } else {
      const loadedSlots = (data || []) as Slot[]
      const availableIds = new Set(loadedSlots.map(slot => slot.slot_id))
      setSlots(loadedSlots)
      setSelectedSlots(prev => prev.filter(slotId => availableIds.has(slotId)))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const run = async () => {
      await loadSlots()
    }
    void run()
  }, [loadSlots])

  function toggleSlot(slotId: string) {
    setSelectedSlots(prev => {
      if (prev.includes(slotId)) return prev.filter(id => id !== slotId)
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

    const result = await bookLessonSlots(selectedSlots)
    if (!result.ok) {
      setError(result.message)
      if (result.slotTaken) await loadSlots()
      setConfirming(false)
      return
    }

    setConfirming(false)
    onBooked(describeBooking(result))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-booking-title"
        style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '640px', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <CalendarDays size={20} color={orange} />
          <h2 id="first-booking-title" style={{ color: blue, fontSize: '18px', fontWeight: '800', margin: 0 }}>
            Welcome, {learnerName}! Choose your lesson slots
          </h2>
        </div>
        <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 16px' }}>
          You have <b style={{ color: orange }}>{remainingSlots}</b> slot(s) to book. Pick the dates and times that suit you, and an instructor for your class will be assigned automatically.
          {lessonPrice !== null && <> Each lesson costs <b>{formatMoney(lessonPrice)}</b>.</>}
        </p>

        {error && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px', color: '#991b1b', fontSize: '13px', fontWeight: '600' }}>
            {error}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, marginBottom: '16px' }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
              {Array.from({ length: 6 }).map((_, i) => <DTSkeleton key={i} h="64px" r="14px" />)}
            </div>
          ) : slots.length === 0 ? (
            <p style={{ margin: 0, padding: '24px 0', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
              No slots are available right now. You can book later from My Lessons.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
              {slots.map(slot => {
                const isSelected = selectedSlots.includes(slot.slot_id)
                return (
                  <button
                    key={slot.slot_id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleSlot(slot.slot_id)}
                    disabled={!isSelected && selectedSlots.length >= remainingSlots}
                    style={{
                      textAlign: 'left',
                      padding: '12px',
                      borderRadius: '14px',
                      border: `1px solid ${isSelected ? orange : '#e5e7eb'}`,
                      background: isSelected ? 'rgba(255,90,0,0.08)' : '#fafafa',
                      cursor: !isSelected && selectedSlots.length >= remainingSlots ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#111827' }}>
                      {new Date(slot.slot_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock4 size={14} /> {slot.slot_time.slice(0, 5)}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ margin: 0, fontSize: '13px', color: '#4b5563', fontWeight: '600' }}>
              Selected: <span style={{ color: orange, fontWeight: '800' }}>{selectedSlots.length}</span> of {remainingSlots}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4b5563', fontWeight: '600' }}>
              {lessonPrice === null
                ? 'Fee to be confirmed by the administrator'
                : <>Total fee: <span style={{ color: blue, fontWeight: '800' }}>{formatMoney(selectedSlots.length * lessonPrice)}</span></>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onLater}
              disabled={confirming}
              style={{ padding: '10px 18px', borderRadius: '10px', border: '1px solid #e5e7eb', background: 'white', color: '#374151', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Later
            </button>
            <button
              type="button"
              onClick={confirmBooking}
              disabled={confirming || selectedSlots.length === 0}
              style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: orange, color: 'white', fontSize: '13px', fontWeight: '700', cursor: confirming || selectedSlots.length === 0 ? 'not-allowed' : 'pointer', opacity: selectedSlots.length === 0 ? 0.6 : 1, fontFamily: 'inherit' }}
            >
              {confirming ? 'Booking...' : 'Confirm Bookings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
