'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { BookOpen, Calendar, CheckCircle, CreditCard, FileQuestion, TrendingUp } from 'lucide-react'
import { DTSkeleton } from '@/app/_components/ui/dt-skeleton'
import { DTStatCard } from '@/app/_components/ui/dt-stat-card'
import { FirstBookingDialog } from '@/app/learner/_components/first-booking-dialog'
import { invoicedTotal, lessonFeesTotal, paidTotal } from '@/lib/fees'


type LearnerProfile = {
  first_name: string
  surname: string
  slots_allocated?: number | null
  driving_class?: string | null
}

function firstBookingDismissedKey(learnerId: string) {
  return `learner-first-booking-dismissed:${learnerId}`
}

type Booking = {
  booking_id: string
  status: string
  lesson_slots?: { slot_date: string; slot_time: string } | null
  instructor?: { first_name: string; surname: string } | null
}

type Payment = { amount: number | string }
type LessonCharge = { status: string; lesson_fee: number | string | null }
type Invoice = { document_type?: string | null; total_amount: number | string }

const supabase = createClient()

const theme = {
  cardBg: '#ffffff',
  textMain: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
  tableHeaderBg: '#f8fafc',
  shimmerBg: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
  primaryOrange: '#ff5a00',
}

// (Skeleton moved to shared UI component)


function first<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null
  return Array.isArray(val) ? val[0] || null : val
}

export default function LearnerDashboard() {
  const [learner, setLearner] = useState<LearnerProfile | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [stats, setStats] = useState<{
    scheduledLessons: number
    completedLessons: number
    remainingSlots: number
    totalPaid: number | null
  }>({
    scheduledLessons: 0,
    completedLessons: 0,
    remainingSlots: 0,
    totalPaid: null,
  })
  const [balanceError, setBalanceError] = useState('')
  const [loading, setLoading] = useState(true)
  const [learnerId, setLearnerId] = useState('')
  const [showFirstBooking, setShowFirstBooking] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const router = useRouter()
  const routerRef = useRef(router)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      routerRef.current.push('/login')
      return
    }


    const [
      { data: profile },
      { data: lessonData },
      { data: paymentData, error: paymentError },
      { data: lessonChargeData, error: lessonChargeError },
      { data: invoiceData, error: invoiceError },
      { count: scheduledLessonsCount = 0 },
      { count: completedLessonsCount = 0 },
      { count: activeBookingCount = 0 },
    ] = await Promise.all([
      supabase.from('users').select('first_name, surname, slots_allocated, driving_class').eq('user_id', user.id).single(),
      supabase.from('lesson_bookings').select(`
        booking_id, status,
        lesson_slots (slot_date, slot_time),
        instructor:users!lesson_bookings_instructor_id_fkey (first_name, surname)
      `).eq('learner_id', user.id).order('created_at', { ascending: false }).limit(6),
      supabase.from('payments').select('amount').eq('learner_id', user.id),
      supabase.from('lesson_bookings').select('status, lesson_fee').eq('learner_id', user.id).neq('status', 'cancelled'),
      supabase.from('quotations').select('document_type, total_amount').eq('learner_id', user.id),
      supabase.from('lesson_bookings').select('booking_id', { count: 'exact', head: true }).eq('learner_id', user.id).eq('status', 'scheduled'),
      supabase.from('lesson_bookings').select('booking_id', { count: 'exact', head: true }).eq('learner_id', user.id).eq('status', 'completed'),
      supabase.from('lesson_bookings').select('booking_id', { count: 'exact', head: true }).eq('learner_id', user.id).neq('status', 'cancelled'),
    ])

    const lessons = (lessonData || []) as unknown as Booking[]

    const payments = (paymentData || []) as Payment[]
    const lessonCharges = (lessonChargeData || []) as LessonCharge[]
    const invoices = (invoiceData || []) as Invoice[]
    const balanceLoadError = paymentError || lessonChargeError || invoiceError
    const allocated = Number(profile?.slots_allocated) || 0

    const remainingSlots = Math.max(allocated - activeBookingCount, 0)

    setLearner(profile)
    setLearnerId(user.id)
    setBookings(lessons)
    setBalanceError(balanceLoadError ? `Could not calculate your balance: ${balanceLoadError.message}` : '')
    setStats({
      scheduledLessons: scheduledLessonsCount,
      completedLessons: completedLessonsCount,
      remainingSlots,
      totalPaid: balanceLoadError
        ? null
        : paidTotal(payments) - lessonFeesTotal(lessonCharges) - invoicedTotal(invoices),
    })

    // A learner who has never booked a lesson is on their first visit, so prompt
    // them to pick slots unless they chose "Later" earlier in this session.
    let dismissed = false
    try {
      dismissed = sessionStorage.getItem(firstBookingDismissedKey(user.id)) === 'true'
    } catch {
      dismissed = false
    }
    setShowFirstBooking(lessons.length === 0 && remainingSlots > 0 && !dismissed)
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await loadDashboard()
    }
    init()
    return () => { cancelled = true }
  }, [loadDashboard])

  function postponeFirstBooking() {
    try {
      sessionStorage.setItem(firstBookingDismissedKey(learnerId), 'true')
    } catch {
      // Without storage the prompt simply returns on the next visit.
    }
    setShowFirstBooking(false)
  }

  function handleFirstBooking(summary: string) {
    setShowFirstBooking(false)
    setSuccessMessage(`${summary} You can see your lessons under My Lessons.`)
    setTimeout(() => setSuccessMessage(''), 8000)
    void loadDashboard()
  }

  const statCards = [
    {
      label: 'Scheduled Lessons',
      value: stats.scheduledLessons.toLocaleString(),
      sub: 'Upcoming practical sessions',
      path: '/learner/lessons',
      icon: <Calendar size={18} color="#2563eb" />,
      badgeBg: '#eff6ff',
    },
    {
      label: 'Completed Lessons',
      value: stats.completedLessons.toLocaleString(),
      sub: 'Finished training slots',
      path: '/learner/progress',
      icon: <CheckCircle size={18} color="#059669" />,
      badgeBg: '#f0fdf4',
    },
    {
      label: 'Remaining Slots',
      value: stats.remainingSlots.toLocaleString(),
      sub: 'Available to book',
      path: '/learner/lessons',
      icon: <BookOpen size={18} color="#7c3aed" />,
      badgeBg: '#f5f3ff',
    },
    {
      label: 'Total Paid',
      value: stats.totalPaid === null
        ? 'Unavailable'
        : `${stats.totalPaid < 0 ? '-$' : '$'}${Math.abs(stats.totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      valueColor: stats.totalPaid !== null && stats.totalPaid < 0 ? '#dc2626' : undefined,
      sub: balanceError
        ? 'Balance unavailable'
        : stats.totalPaid !== null && stats.totalPaid < 0
          ? 'Amount owed after recorded payments'
          : 'Payments less lesson fees and invoices',
      path: '/learner/payments',
      icon: <CreditCard size={18} color={stats.totalPaid !== null && stats.totalPaid < 0 ? '#dc2626' : '#ff5a00'} />,
      badgeBg: stats.totalPaid !== null && stats.totalPaid < 0 ? '#fff1f2' : '#fff2eb',
    },
  ]

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      <div className="learner-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '700', color: theme.textMain, letterSpacing: '-0.4px' }}>
            Welcome back, {learner?.first_name || 'Learner'}!
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: theme.textMuted }}>
            Here is a summary review of your driving academy progress today.
          </p>
        </div>
      </div>

      {successMessage && (
        <div style={{ background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', color: '#065f46', fontSize: '13px', fontWeight: '600' }}>
          {successMessage}
        </div>
      )}

      {showFirstBooking && (
        <FirstBookingDialog
          learnerId={learnerId}
          learnerName={learner?.first_name || 'Learner'}
          drivingClass={learner?.driving_class}
          remainingSlots={stats.remainingSlots}
          onLater={postponeFirstBooking}
          onBooked={handleFirstBooking}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '20px', marginBottom: '32px' }}>
        {loading
          ? Array(4).fill(0).map((_, i) => (
              <div key={i} style={{ background: theme.cardBg, borderRadius: '16px', padding: '24px', border: `1px solid ${theme.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <DTSkeleton h="11px" w="80px" r="4px" />
                    <div style={{ marginTop: '8px' }}>
                      <DTSkeleton h="28px" w="60px" r="5px" />
                    </div>
                  </div>
                  <DTSkeleton w="40px" h="40px" r="10px" />
                </div>
                <DTSkeleton h="10px" w="50%" r="4px" />
              </div>
            ))
          : statCards.map((card, i) => (
              <DTStatCard
                key={i}
                label={card.label}
                value={card.value}
                valueColor={card.valueColor}
                sub={card.sub}
                badgeBg={card.badgeBg}
                icon={card.icon}
                onClick={() => router.push(card.path)}
              />
            ))}
      </div>

      {balanceError && (
        <p role="alert" style={{ color: '#b91c1c', fontSize: '13px', margin: '-20px 0 24px' }}>
          {balanceError}
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px' }}>
        <div style={{ background: theme.cardBg, borderRadius: '16px', padding: '24px', boxShadow: '0 4px 18px rgba(0,0,0,0.02)', border: `1px solid ${theme.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Calendar size={18} color="#2563eb" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: theme.textMain }}>Recent Lesson Activity</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr 160px 110px', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: theme.tableHeaderBg, marginBottom: '6px', border: `1px solid ${theme.border}` }}>
            {['Date', 'Instructor', 'Time', 'Status'].map(header => (
              <span key={header} style={{ fontSize: '11px', fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{header}</span>
            ))}
          </div>

          {loading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 160px 110px', gap: '12px', padding: '14px', borderBottom: `1px solid ${theme.border}` }}>
                {Array(4).fill(0).map((__, j) => <DTSkeleton key={j} h="13px" r="4px" />)}

              </div>
            ))
          ) : bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ margin: 0, color: theme.textMuted, fontSize: '13.5px' }}>No lesson activity is available yet.</p>
            </div>
          ) : bookings.map((booking, idx) => {
            const slot = first(booking.lesson_slots)
            const instructor = first(booking.instructor)
            return (
              <div key={booking.booking_id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 160px 110px', gap: '12px', padding: '14px', borderBottom: idx !== bookings.length - 1 ? `1px solid ${theme.border}` : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '600', color: theme.textMain }}>{slot?.slot_date || 'Pending'}</span>
                <span style={{ fontSize: '13.5px', color: theme.textMain }}>{instructor ? `${instructor.first_name} ${instructor.surname}` : 'Unassigned'}</span>
                <span style={{ fontSize: '13.5px', color: theme.textMain }}>{slot?.slot_time?.slice(0, 5) || '--:--'}</span>
                <span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: booking.status === 'completed' ? '#f0fdf4' : '#fff7ed', color: booking.status === 'completed' ? '#22c55e' : '#f97316', width: 'fit-content' }}>
                  {booking.status}
                </span>
              </div>
            )
          })}
        </div>

        <div style={{ background: theme.cardBg, borderRadius: '16px', padding: '24px', boxShadow: '0 4px 18px rgba(0,0,0,0.02)', border: `1px solid ${theme.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <FileQuestion size={18} color={theme.primaryOrange} />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: theme.textMain }}>Quick Actions</h3>
          </div>
          {[
            { label: 'Book a lesson', path: '/learner/lessons', icon: <Calendar size={16} /> },
            { label: 'Open materials', path: '/learner/materials', icon: <BookOpen size={16} /> },
            { label: 'Practice test', path: '/learner/practice', icon: <FileQuestion size={16} /> },
            { label: 'View progress', path: '/learner/progress', icon: <TrendingUp size={16} /> },
          ].map(action => (
            <button
              key={action.path}
              onClick={() => router.push(action.path)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMain, fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px', fontFamily: 'inherit', textAlign: 'left' }}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
