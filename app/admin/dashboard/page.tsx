'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface PendingUser {
  user_id: string
  first_name: string
  surname: string
  role: string
  created_at: string
}

interface Booking {
  booking_id: string
  status: string
  learner_id: string
  instructor_id: string | null
  lesson_slots: { slot_date: string; slot_time: string } | { slot_date: string; slot_time: string }[] | null
  learner: { first_name: string; surname: string } | { first_name: string; surname: string }[] | null
  instructor: { first_name: string; surname: string } | { first_name: string; surname: string }[] | null
}

interface InstructorLoad { name: string; count: number; isLowest: boolean }

const supabase = createClient()

function Skeleton({ w = '100%', h = '14px', r = '6px' }: { w?: string; h?: string; r?: string }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalLearners: 0, newThisWeek: 0,
    todaysLessons: 0, todaysRemaining: 0,
    monthRevenue: 0, monthPayments: 0, pendingApprovals: 0,
  })
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [todaysBookings, setTodaysBookings] = useState<Booking[]>([])
  const [instructorWorkload, setInstructorWorkload] = useState<InstructorLoad[]>([])
  const [loading, setLoading] = useState(true)

  // Approve modal state
  const [approvingUser, setApprovingUser] = useState<PendingUser | null>(null)
  const [slotCount, setSlotCount] = useState('')
  const [approving, setApproving] = useState(false)
  const [modalError, setModalError] = useState('')

  const router = useRouter()
  const routerRef = useRef(router)
  const orange = '#e8731a'

  function first(val: unknown): Record<string, string> | null {
    if (!val) return null
    if (Array.isArray(val)) return val[0] || null
    return val as Record<string, string>
  }

  function getLessonStatus(slotTime: string, bookingStatus: string): 'Done' | 'Now' | 'Upcoming' {
    if (bookingStatus === 'completed' || bookingStatus === 'cancelled') return 'Done'
    const now = new Date()
    const [h, m] = slotTime.slice(0, 5).split(':').map(Number)
    const start = new Date()
    start.setHours(h, m, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    if (now >= end) return 'Done'
    if (now >= start && now < end) return 'Now'
    return 'Upcoming'
  }

  const statusColors = {
    Done:     { bg: '#dcfce7', color: '#16a34a' },
    Now:      { bg: '#dbeafe', color: '#2563eb' },
    Upcoming: { bg: '#fff7ed', color: '#ea580c' },
  }

  function getWeekStart() {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(new Date().setDate(diff)).toISOString().split('T')[0]
  }
  function getWeekEnd() {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? 0 : 7)
    return new Date(new Date().setDate(diff)).toISOString().split('T')[0]
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }

    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const [
      { count: learnersCount },
      { count: newCount },
      { data: todayBookings },
      { data: paymentsData },
      { count: pendingCount },
      { data: pendingList },
      { data: weekBookings },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'learner').eq('status', 'approved'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'learner').eq('status', 'approved').gte('created_at', weekAgo),
      supabase.from('lesson_bookings').select(`
        booking_id, status, learner_id, instructor_id,
        lesson_slots!inner (slot_date, slot_time),
        learner:users!lesson_bookings_learner_id_fkey (first_name, surname),
        instructor:users!lesson_bookings_instructor_id_fkey (first_name, surname)
      `).eq('lesson_slots.slot_date', today).in('status', ['scheduled', 'completed']).limit(10),
      supabase.from('payments').select('amount').gte('created_at', monthStart),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('users').select('user_id, first_name, surname, role, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      supabase.from('lesson_bookings').select(`
        instructor_id,
        instructor:users!lesson_bookings_instructor_id_fkey (first_name, surname),
        lesson_slots!inner (slot_date)
      `).gte('lesson_slots.slot_date', getWeekStart()).lte('lesson_slots.slot_date', getWeekEnd()).in('status', ['scheduled', 'completed']),
    ])

    const monthRevenue = paymentsData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    const remaining = todayBookings?.filter(b => b.status === 'scheduled').length || 0

    const loadMap: Record<string, { name: string; count: number }> = {}
    weekBookings?.forEach(b => {
      if (!b.instructor_id) return
      const inst = first(b.instructor)
      if (!inst) return
      if (!loadMap[b.instructor_id]) loadMap[b.instructor_id] = { name: `${inst.first_name} ${inst.surname}`, count: 0 }
      loadMap[b.instructor_id].count++
    })
    const loadArr = Object.values(loadMap).sort((a, b) => b.count - a.count)
    const minCount = loadArr.length > 0 ? Math.min(...loadArr.map(l => l.count)) : 0

    setStats({ totalLearners: learnersCount || 0, newThisWeek: newCount || 0, todaysLessons: todayBookings?.length || 0, todaysRemaining: remaining, monthRevenue, monthPayments: paymentsData?.length || 0, pendingApprovals: pendingCount || 0 })
    setPendingUsers(pendingList || [])
    setTodaysBookings(todayBookings || [])
    setInstructorWorkload(loadArr.map(l => ({ ...l, isLowest: l.count === minCount })))
    setLoading(false)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() { if (!cancelled) await loadData() }
    init()
    return () => { cancelled = true }
  }, [loadData])

  // ── Confirm approve with slots ──────────────────────────────
  async function confirmApprove() {
    if (!approvingUser) return
    const n = parseInt(slotCount)
    if (!slotCount || isNaN(n) || n < 1) {
      setModalError('Please enter a valid number of slots (minimum 1).')
      return
    }
    setApproving(true)
    setModalError('')
    await supabase
      .from('users')
      .update({ status: 'approved', allowed_slots: n })
      .eq('user_id', approvingUser.user_id)
    await supabase.from('notifications').insert({
      recipient_id: approvingUser.user_id,
      message: `Your registration has been approved! You have been allocated ${n} lesson slot${n > 1 ? 's' : ''}. Please log in to select your preferred slots.`,
      type: 'approval',
    })
    setApprovingUser(null)
    setSlotCount('')
    setApproving(false)
    loadData()
  }

  async function rejectUser(userId: string) {
    await supabase.from('users').update({ status: 'rejected' }).eq('user_id', userId)
    await supabase.from('notifications').insert({
      recipient_id: userId,
      message: 'Your registration has been rejected. Please contact the administrator.',
      type: 'rejection',
    })
    loadData()
  }

  const avatarColors = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2']
  const monthName = new Date().toLocaleString('en-GB', { month: 'short' })
  const maxWorkload = instructorWorkload.length > 0 ? Math.max(...instructorWorkload.map(i => i.count)) : 1

  const statCards = [
    { label: 'active learners',       value: stats.totalLearners,                     sub: `+${stats.newThisWeek} this week`,                       accent: '#10b981', path: '/admin/learner'   },
    { label: 'lessons today',         value: stats.todaysLessons,                     sub: `${stats.todaysRemaining} remaining`,                    accent: '#3b82f6', path: '/admin/lessons'   },
    { label: `revenue (${monthName})`,value: `$${stats.monthRevenue.toLocaleString()}`,sub: `${stats.monthPayments} payments`,                      accent: '#f59e0b', path: '/admin/payments'  },
    { label: 'pending approvals',     value: stats.pendingApprovals,                  sub: stats.pendingApprovals > 0 ? 'action needed' : 'all clear', accent: '#ef4444', path: '/admin/learner' },
  ]

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      {/* ── APPROVE MODAL ── */}
      {approvingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: 'white', borderRadius: '14px', padding: '32px', width: '100%', maxWidth: '420px', margin: '16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: '700', color: '#1e293b' }}>
              Assign Lesson Slots
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b' }}>
              Approving <strong>{approvingUser.first_name} {approvingUser.surname}</strong> ({approvingUser.role}).
              How many lesson slots should they be allowed to select?
            </p>

            {modalError && (
              <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#dc2626', background: '#fee2e2', padding: '8px 12px', borderRadius: '8px' }}>
                {modalError}
              </p>
            )}

            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
              Number of slots
            </label>
            <input
              type="number"
              min={1}
              value={slotCount}
              onChange={e => setSlotCount(e.target.value)}
              placeholder="e.g. 10"
              autoFocus
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0', fontSize: '16px', fontWeight: '600', outline: 'none', marginBottom: '20px', boxSizing: 'border-box' }}
            />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => { setApprovingUser(null); setSlotCount(''); setModalError('') }}
                style={{ flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmApprove}
                disabled={approving}
                style={{ flex: 2, padding: '11px', borderRadius: '8px', border: 'none', background: approving ? '#94a3b8' : '#16a34a', color: 'white', fontSize: '13px', fontWeight: '700', cursor: approving ? 'not-allowed' : 'pointer' }}
              >
                {approving ? 'Approving...' : 'Confirm & Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        {/* ── STAT CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '24px' }}>
          {loading
            ? Array(4).fill(0).map((_, i) => (
                <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '20px 22px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <Skeleton h="11px" w="55%" r="4px" />
                  <div style={{ margin: '10px 0 8px' }}><Skeleton h="30px" w="45%" r="5px" /></div>
                  <Skeleton h="11px" w="65%" r="4px" />
                </div>
              ))
            : statCards.map((card, i) => (
                <div
                  key={i}
                  onClick={() => router.push(card.path)}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 16px rgba(0,0,0,0.10)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                  style={{ background: 'white', borderRadius: '10px', padding: '20px 22px', borderLeft: `3px solid ${card.accent}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                >
                  <p style={{ margin: '0 0 6px', fontSize: '11px', color: '#94a3b8', fontWeight: '500', textTransform: 'lowercase' }}>{card.label}</p>
                  <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '800', color: '#1e293b', lineHeight: 1.1 }}>{card.value}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: card.accent, fontWeight: '500' }}>{card.sub}</p>
                </div>
              ))
          }
        </div>

        {/* ── TWO PANELS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>

          {/* TODAY'S LESSONS */}
          <div style={{ background: 'white', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Today&apos;s Lessons</h3>
              <button onClick={() => router.push('/admin/lessons')} style={{ background: 'none', border: 'none', color: orange, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>View all →</button>
            </div>

            {loading
              ? Array(4).fill(0).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <Skeleton w="36px" h="13px" r="4px" />
                    <div style={{ flex: 1 }}>
                      <Skeleton h="13px" r="4px" />
                      <div style={{ marginTop: '5px' }}><Skeleton h="11px" w="55%" r="4px" /></div>
                    </div>
                    <Skeleton w="58px" h="22px" r="12px" />
                  </div>
                ))
              : todaysBookings.length === 0
                ? <p style={{ color: '#cbd5e1', fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>No lessons scheduled for today</p>
                : todaysBookings.map(booking => {
                    const slot = first(booking.lesson_slots)
                    const learner = first(booking.learner)
                    const instructor = first(booking.instructor)
                    const time = slot?.slot_time?.slice(0, 5) || '--:--'
                    const status = getLessonStatus(slot?.slot_time || '00:00', booking.status)
                    const sc = statusColors[status]
                    return (
                      <div key={booking.booking_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8', minWidth: '40px' }}>{time}</span>
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{learner?.first_name} {learner?.surname}</p>
                            <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{instructor ? `${instructor.first_name} ${instructor.surname}` : 'Unassigned'}</p>
                          </div>
                        </div>
                        <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: sc.bg, color: sc.color }}>{status}</span>
                      </div>
                    )
                  })
            }
          </div>

          {/* PENDING REGISTRATIONS */}
          <div style={{ background: 'white', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Pending Registrations</h3>

            {loading
              ? Array(3).fill(0).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Skeleton w="34px" h="34px" r="50%" />
                      <div>
                        <Skeleton h="13px" w="110px" r="4px" />
                        <div style={{ marginTop: '5px' }}><Skeleton h="11px" w="60px" r="4px" /></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Skeleton w="62px" h="28px" r="6px" />
                      <Skeleton w="50px" h="28px" r="6px" />
                    </div>
                  </div>
                ))
              : pendingUsers.length === 0
                ? <p style={{ color: '#cbd5e1', fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>No pending registrations</p>
                : pendingUsers.map((user, idx) => (
                    <div key={user.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: avatarColors[idx % avatarColors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '12px', flexShrink: 0 }}>
                          {user.first_name.charAt(0)}{user.surname.charAt(0)}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{user.first_name} {user.surname}</p>
                          <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8', textTransform: 'capitalize' }}>{user.role}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => { setApprovingUser(user); setModalError('') }}
                          style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #dcfce7', background: '#f0fdf4', color: '#16a34a', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => rejectUser(user.user_id)}
                          style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fff5f5', color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
            }
          </div>
        </div>

        {/* ── INSTRUCTOR WORKLOAD ── */}
        <div style={{ background: 'white', borderRadius: '10px', padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <h3 style={{ margin: 0, fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Instructor Workload This Week</h3>
            <button onClick={() => router.push('/admin/instructor')} style={{ background: 'none', border: 'none', color: orange, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>View all →</button>
          </div>

          {loading
            ? Array(3).fill(0).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <Skeleton w="130px" h="13px" r="4px" />
                  <div style={{ flex: 1 }}><Skeleton h="8px" r="4px" /></div>
                  <Skeleton w="20px" h="13px" r="4px" />
                </div>
              ))
            : instructorWorkload.length === 0
              ? <p style={{ color: '#cbd5e1', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>No instructor data this week</p>
              : instructorWorkload.map((inst, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', minWidth: '140px' }}>{inst.name}</span>
                    <div style={{ flex: 1, height: '8px', background: '#f1f5f9', borderRadius: '4px' }}>
                      <div style={{ width: `${(inst.count / maxWorkload) * 100}%`, height: '100%', borderRadius: '4px', background: inst.isLowest ? orange : '#1e293b', transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: inst.isLowest ? orange : '#1e293b', minWidth: '24px', textAlign: 'right' }}>{inst.count}</span>
                  </div>
                ))
          }
          {!loading && instructorWorkload.length > 0 && (
            <p style={{ margin: '14px 0 0', fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
              <span style={{ display: 'inline-block', width: '12px', height: '4px', background: orange, borderRadius: '2px', marginRight: '6px', verticalAlign: 'middle' }} />
              Orange bar = auto-assigned next new learner
            </p>
          )}
        </div>
      </div>
    </>
  )
}
