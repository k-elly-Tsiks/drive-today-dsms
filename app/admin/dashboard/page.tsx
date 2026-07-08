'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Users, UserCheck, Calendar, DollarSign, BarChart3, Clock, Check, } from 'lucide-react'

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

interface InstructorLoad { name: string; count: number; capacity: number; isLowest: boolean }

const supabase = createClient()

export default function AdminDashboard() {
  const [adminName, setAdminName] = useState('')
  const [stats, setStats] = useState({
    totalLearners: 0, newThisWeek: 0,
    todaysLessons: 0, todaysRemaining: 0,
    totalRevenue: 0, totalPaymentsCount: 0, pendingApprovals: 0, totalInstructors: 0,
  })
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [todaysBookings, setTodaysBookings] = useState<Booking[]>([])
  const [instructorWorkload, setInstructorWorkload] = useState<InstructorLoad[]>([])
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)

  const [approvingUser, setApprovingUser] = useState<PendingUser | null>(null)
  const [confirmApproveInstructor, setConfirmApproveInstructor] = useState<PendingUser | null>(null)
  const [decliningUser, setDecliningUser] = useState<PendingUser | null>(null)
  const [slotCount, setSlotCount] = useState('')
  const [approving, setApproving] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [modalError, setModalError] = useState('')

  const router = useRouter()

  // Sync state with HTML class selector for component themes
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    checkTheme()
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Option 2 Dynamic Theme Token Mapping
  const theme = {
    cardBg: isDarkMode ? '#222836' : '#ffffff',
    textMain: isDarkMode ? '#f1f5f9' : '#1e293b',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#2d3545' : '#e2e8f0',
    tableHeaderBg: isDarkMode ? '#1a1f2c' : '#f8fafc',
    shimmerBg: isDarkMode ? 'linear-gradient(90deg,#222836 25%,#2d3545 50%,#222836 75%)' : 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
    primaryOrange: '#ff5a00',
  }

  function Skeleton({ w = '100%', h = '14px', r = '6px' }: { w?: string; h?: string; r?: string }) {
    return (
      <div style={{
        width: w, height: h, borderRadius: r,
        background: theme.shimmerBg,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s infinite',
      }} />
    )
  }

  function first<T>(val: T | T[] | null): T | null {
    if (!val) return null
    if (Array.isArray(val)) return val[0] || null
    return val
  }

  function getLessonStatus(slotTime: string, bookingStatus: string): 'Completed' | 'In Progress' | 'Scheduled' {
    if (bookingStatus === 'completed' || bookingStatus === 'cancelled') return 'Completed'
    const now = new Date()
    const [h, m] = slotTime.slice(0, 5).split(':').map(Number)
    const start = new Date(); start.setHours(h, m, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    if (now >= end) return 'Completed'
    if (now >= start && now < end) return 'In Progress'
    return 'Scheduled'
  }

  const statusStyles: Record<string, { bg: string; color: string }> = {
    'Scheduled': { bg: isDarkMode ? 'rgba(37,99,235,0.15)' : '#eff6ff', color: '#3b82f6' },
    'In Progress': { bg: isDarkMode ? 'rgba(234,88,12,0.15)' : '#fff7ed', color: '#f97316' },
    'Completed': { bg: isDarkMode ? 'rgba(22,163,74,0.15)' : '#f0fdf4', color: '#22c55e' },
  }

  function getWeekStart() {
    const d = new Date(); const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(new Date().setDate(diff)).toISOString().split('T')[0]
  }
  function getWeekEnd() {
    const d = new Date(); const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? 0 : 7)
    return new Date(new Date().setDate(diff)).toISOString().split('T')[0]
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: userData } = await supabase
      .from('users').select('first_name, surname').eq('user_id', user.id).single()
    if (userData) setAdminName(`${userData.first_name} ${userData.surname}`)

    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [
      { count: learnersCount },
      { count: newCount },
      { data: todayBookings },
      { data: paymentsData },
      { count: pendingCount },
      { data: pendingList },
      { data: weekBookings },
      { count: instructorsCount },
      allInstructorsResponse,
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'learner').eq('status', 'approved'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'learner').eq('status', 'approved').gte('created_at', weekAgo),
      supabase.from('lesson_bookings').select(`
        booking_id, status, learner_id, instructor_id,
        lesson_slots!inner (slot_date, slot_time),
        learner:users!lesson_bookings_learner_id_fkey (first_name, surname),
        instructor:users!lesson_bookings_instructor_id_fkey (first_name, surname)
      `).eq('lesson_slots.slot_date', today).in('status', ['scheduled', 'completed']).limit(10),
      supabase.from('payments').select('amount'),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('users').select('user_id, first_name, surname, role, created_at').eq('status', 'pending').order('created_at', { ascending: false }).limit(4),
      supabase.from('lesson_bookings').select(`
        instructor_id,
        instructor:users!lesson_bookings_instructor_id_fkey (first_name, surname),
        lesson_slots!inner (slot_date)
      `).gte('lesson_slots.slot_date', getWeekStart()).lte('lesson_slots.slot_date', getWeekEnd()).in('status', ['scheduled', 'completed']),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'instructor'),
      supabase.from('users').select('user_id, first_name, surname, workload_capacity').eq('role', 'instructor').eq('status', 'approved'),
    ])

    const totalRevenue = paymentsData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
    const remaining = todayBookings?.filter(b => b.status === 'scheduled').length || 0

    const loadMap: Record<string, { name: string; count: number; capacity: number }> = {}
    if (allInstructorsResponse?.data) {
      const activeInstructorsList = allInstructorsResponse.data
      activeInstructorsList.forEach((inst) => {
        loadMap[inst.user_id] = {
          name: `${inst.first_name} ${inst.surname}`,
          count: 0,
          capacity: inst.workload_capacity || 10
        }
      })
    }

    weekBookings?.forEach(b => {
      if (!b.instructor_id) return
      if (loadMap[b.instructor_id]) {
        loadMap[b.instructor_id].count++
      }
    })

    const loadArr = Object.values(loadMap).sort((a, b) => b.count - a.count)
    const minCount = loadArr.length > 0 ? Math.min(...loadArr.map(l => l.count)) : 0

    setStats({
      totalLearners: learnersCount || 0,
      newThisWeek: newCount || 0,
      todaysLessons: todayBookings?.length || 0,
      todaysRemaining: remaining,
      totalRevenue: totalRevenue,
      totalPaymentsCount: paymentsData?.length || 0,
      pendingApprovals: pendingCount || 0,
      totalInstructors: instructorsCount || 0,
    })
    setPendingUsers(pendingList || [])
    setTodaysBookings(todayBookings || [])
    setInstructorWorkload(loadArr.map(l => ({ ...l, isLowest: l.count === minCount })))
    setLoading(false)
  }, [router])

  useEffect(() => {
    let cancelled = false
    async function init() { if (!cancelled) await loadData() }
    init()
    return () => { cancelled = true; }
  }, [loadData])

  async function confirmApprove() {
    if (!approvingUser) return
    const n = parseInt(slotCount)
    if (!slotCount || isNaN(n) || n < 1) { setModalError('Please enter a valid number of slots (minimum 1).'); return }
    setApproving(true); setModalError('')
    await supabase.from('users').update({ status: 'approved', allowed_slots: n, slots_allocated: n }).eq('user_id', approvingUser.user_id)
    await supabase.from('notifications').insert({
      recipient_id: approvingUser.user_id,
      message: `Your registration has been approved! You have been allocated ${n} lesson slot${n > 1 ? 's' : ''}. Please log in to select your preferred slots.`,
      type: 'approval',
    })
    setApprovingUser(null); setSlotCount(''); setApproving(false); loadData()
  }

  async function confirmApproveInstructorAction() {
    if (!confirmApproveInstructor) return
    setApproving(true)
    await supabase.from('users').update({ status: 'approved' }).eq('user_id', confirmApproveInstructor.user_id)
    await supabase.from('notifications').insert({
      recipient_id: confirmApproveInstructor.user_id,
      message: `Your instructor registration has been approved! You can now log in and set up your teaching classes.`,
      type: 'approval',
    })
    setConfirmApproveInstructor(null); setApproving(false); loadData()
  }

  async function confirmDecline() {
    if (!decliningUser) return
    setDeclining(true)
    await supabase.from('users').update({ status: 'rejected' }).eq('user_id', decliningUser.user_id)
    await supabase.from('notifications').insert({
      recipient_id: decliningUser.user_id,
      message: `Your registration request has been declined. Please contact support or the administrator for details.`,
      type: 'decline',
    })
    setDecliningUser(null); setDeclining(false); loadData()
  }

  function handleApproveClick(user: PendingUser) {
    if (user.role === 'learner') {
      setApprovingUser(user)
      setSlotCount('')
    } else {
      setConfirmApproveInstructor(user)
    }
  }

  function handleDeclineClick(user: PendingUser) {
    setDecliningUser(user)
  }

  const avatarColors = ['#ff5a00', '#2563eb', '#059669', '#7c3aed', '#0891b2']
  const maxWorkload = instructorWorkload.length > 0 ? Math.max(...instructorWorkload.map(i => i.count), 1) : 1

  // Option 2 Minimal Style Configurations for metric blocks
  const statCards = [
    {
      label: 'Total Learners', value: stats.totalLearners.toLocaleString(),
      sub: `+${stats.newThisWeek} new this week`, path: '/admin/learner',
      icon: <Users size={18} color="#2563eb" />,
      badgeBg: isDarkMode ? 'rgba(37,99,235,0.15)' : '#eff6ff'
    },
    {
      label: 'Total Instructors', value: stats.totalInstructors.toLocaleString(),
      sub: `Active work roster`, path: '/admin/instructor',
      icon: <UserCheck size={18} color="#7c3aed" />,
      badgeBg: isDarkMode ? 'rgba(124,58,237,0.15)' : '#f5f3ff'
    },
    {
      label: 'Lessons Today', value: stats.todaysLessons.toLocaleString(),
      sub: `${stats.todaysRemaining} pending slots`, path: '/admin/lessons',
      icon: <Calendar size={18} color="#059669" />,
      badgeBg: isDarkMode ? 'rgba(5,150,105,0.15)' : '#f0fdf4'
    },
    {
      label: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString()}`,
      sub: `${stats.totalPaymentsCount} completions`, path: '/admin/payments',
      icon: <DollarSign size={18} color="#ff5a00" />,
      badgeBg: isDarkMode ? 'rgba(255,90,0,0.12)' : '#fff2eb'
    },
  ]

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>

      {/* ── APPROVE MODAL (Dynamic Themes Built-in) ── */}
      {approvingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '420px', margin: '16px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={20} color="#22c55e" strokeWidth={2.5} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: theme.textMain }}>Assign Lesson Slots</h2>
                <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>Approving {approvingUser.first_name} {approvingUser.surname}</p>
              </div>
            </div>
            {modalError && (
              <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: '10px' }}>{modalError}</p>
            )}
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: theme.textMuted, marginBottom: '8px' }}>Number of lesson slots</label>
            <input
              type="number" min={1} value={slotCount}
              onChange={e => setSlotCount(e.target.value)}
              placeholder="e.g. 10" autoFocus
              style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: `1.5px solid ${theme.border}`, background: isDarkMode ? '#1a1f2c' : '#ffffff', color: theme.textMain, fontSize: '16px', fontWeight: '600', outline: 'none', marginBottom: '24px', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setApprovingUser(null); setSlotCount(''); setModalError('') }}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}
              >Cancel</button>
              <button
                onClick={confirmApprove} disabled={approving}
                style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: approving ? theme.textMuted : '#22c55e', color: 'white', fontSize: '13px', fontWeight: '700', cursor: approving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >{approving ? 'Approving...' : 'Confirm & Approve'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── APPROVE INSTRUCTOR MODAL ── */}
      {confirmApproveInstructor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '420px', margin: '16px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(22,163,74,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={20} color="#22c55e" strokeWidth={2.5} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: theme.textMain }}>Approve Instructor</h2>
                <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>Approving {confirmApproveInstructor.first_name} {confirmApproveInstructor.surname}</p>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: theme.textMain, marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to approve this instructors registration? They will be granted active teaching access.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setConfirmApproveInstructor(null)}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}
              >Cancel</button>
              <button
                onClick={confirmApproveInstructorAction} disabled={approving}
                style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: approving ? theme.textMuted : '#22c55e', color: 'white', fontSize: '13px', fontWeight: '700', cursor: approving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >{approving ? 'Approving...' : 'Confirm Approval'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── DECLINE MODAL ── */}
      {decliningUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,15,30,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '20px', padding: '32px', width: '100%', maxWidth: '420px', margin: '16px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '20px', color: '#dc2626', fontWeight: 'bold' }}>✕</span>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: theme.textMain }}>Decline Registration</h2>
                <p style={{ margin: 0, fontSize: '12px', color: theme.textMuted }}>Declining {decliningUser.first_name} {decliningUser.surname}</p>
              </div>
            </div>
            <p style={{ fontSize: '14px', color: theme.textMain, marginBottom: '24px', lineHeight: '1.5' }}>
              Are you sure you want to decline this registration request? The profile will be marked as rejected.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setDecliningUser(null)}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}
              >Cancel</button>
              <button
                onClick={confirmDecline} disabled={declining}
                style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: declining ? theme.textMuted : '#dc2626', color: 'white', fontSize: '13px', fontWeight: '700', cursor: declining ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >{declining ? 'Declining...' : 'Confirm & Decline'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOP SECTION: WELCOME & QUICK ACTION ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '700', color: theme.textMain, letterSpacing: '-0.4px' }}>
            Welcome back, {adminName.split(' ')[0] || 'Admin'}!
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: theme.textMuted }}>
            Here is a summary review of your driving academy operations today.
          </p>
        </div>
        {/* Dynamic primary brand orange option 2 action key */}

      </div>

      {/* ── OPTION 2 SOFT MINIMAL KPI CARDS (Centered texts & Soft icon badges) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '20px', marginBottom: '32px' }}>
        {loading
          ? Array(4).fill(0).map((_, i) => (
            <div key={i} style={{ background: theme.cardBg, borderRadius: '16px', padding: '24px', border: `1px solid ${theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div><Skeleton h="11px" w="80px" r="4px" /><div style={{ marginTop: '8px' }}><Skeleton h="28px" w="60px" r="5px" /></div></div>
                <Skeleton w="40px" h="40px" r="10px" />
              </div>
              <Skeleton h="10px" w="50%" r="4px" />
            </div>
          ))
          : statCards.map((card, i) => (
            <div
              key={i}
              onClick={() => router.push(card.path)}
              style={{
                background: theme.cardBg,
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 18px rgba(0,0,0,0.02)',
                border: `1px solid ${theme.border}`,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'border-color 0.15s ease'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = theme.primaryOrange }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = theme.border }}
            >
              <div>
                <p style={{ margin: '0 0 4px', fontSize: '12.5px', color: theme.textMuted, fontWeight: '500' }}>{card.label}</p>
                <p style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: '700', color: theme.textMain, letterSpacing: '-0.5px' }}>{card.value}</p>
                <p style={{ margin: 0, fontSize: '11.5px', color: theme.textMuted }}>{card.sub}</p>
              </div>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: card.badgeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {card.icon}
              </div>
            </div>
          ))
        }
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px', marginBottom: '20px' }}>

        {/* ── INSTRUCTOR WORKLOAD ── */}
        <div style={{ background: theme.cardBg, borderRadius: '16px', padding: '24px', boxShadow: '0 4px 18px rgba(0,0,0,0.02)', border: `1px solid ${theme.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BarChart3 size={18} color={theme.primaryOrange} />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: theme.textMain }}>Instructor Workload This Week</h3>
            </div>
          </div>

          {loading
            ? Array(3).fill(0).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <Skeleton w="130px" h="13px" r="4px" />
                <div style={{ flex: 1 }}><Skeleton h="10px" r="5px" /></div>
                <Skeleton w="20px" h="13px" r="4px" />
              </div>
            ))
            : instructorWorkload.length === 0
              ? <p style={{ color: theme.textMuted, fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>No instructor schedules verified this week</p>
              : instructorWorkload.map((inst, i) => {
                const pct = Math.min((inst.count / inst.capacity) * 100, 100)
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                    <div style={{ minWidth: '150px' }}>
                      <div style={{ fontSize: '13.5px', color: theme.textMain, fontWeight: '600' }}>{inst.name}</div>
                      <div style={{ fontSize: '11px', color: theme.textMuted }}>Capacity: {inst.capacity}h/week</div>
                    </div>
                    <div style={{ flex: 1, height: '12px', background: isDarkMode ? '#1a1f2c' : '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: '6px', background: inst.count >= inst.capacity ? '#dc2626' : inst.count > 0 ? theme.primaryOrange : '#94a3b8', transition: 'width 0.5s ease' }} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: theme.textMain, minWidth: '60px', textAlign: 'right' }}>{inst.count} / {inst.capacity}h</span>
                  </div>
                )
              })
          }
        </div>

        {/* ── PENDING APPROVALS ── */}
        <div style={{ background: theme.cardBg, borderRadius: '16px', padding: '24px', boxShadow: '0 4px 18px rgba(0,0,0,0.02)', border: `1px solid ${theme.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={18} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: theme.textMain }}>Pending Approvals</h3>
            </div>
            {stats.pendingApprovals > 0 && (
              <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>{stats.pendingApprovals} review</span>
            )}
          </div>

          {loading
            ? Array(3).fill(0).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Skeleton w="36px" h="36px" r="50%" />
                  <div><Skeleton h="13px" w="110px" r="4px" /><div style={{ marginTop: '5px' }}><Skeleton h="11px" w="70px" r="4px" /></div></div>
                </div>
                <Skeleton w="66px" h="28px" r="8px" />
              </div>
            ))
            : pendingUsers.length === 0
              ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <p style={{ margin: 0, color: theme.textMuted, fontSize: '13px', fontWeight: '500' }}>All clear! No profiles awaiting registration approval.</p>
                </div>
              )
              : pendingUsers.map((user, idx) => {
                const timeDiff = new Date().getTime() - new Date(user.created_at).getTime()
                const hours = Math.floor(timeDiff / 3600000)
                const timeAgo = hours < 1 ? 'Just now' : hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
                return (
                  <div key={user.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: idx !== pendingUsers.length - 1 ? `1px solid ${theme.border}` : 'none', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: avatarColors[idx % avatarColors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '12px', flexShrink: 0 }}>
                        {user.first_name.charAt(0)}{user.surname.charAt(0)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: theme.textMain }}>{user.first_name} {user.surname}</p>
                        <p style={{ margin: 0, fontSize: '11px', color: theme.textMuted }}>
                          Submitted {timeAgo} • <span style={{ textTransform: 'capitalize', fontWeight: '600', color: user.role === 'instructor' ? '#7c3aed' : '#2563eb' }}>{user.role}</span>
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handleApproveClick(user)}
                        style={{ padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#22c55e', color: '#ffffff', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}
                      >Approve</button>
                      <button
                        onClick={() => handleDeclineClick(user)}
                        style={{ padding: '6px 12px', borderRadius: '8px', border: `1.5px solid ${theme.border}`, background: 'transparent', color: '#dc2626', fontSize: '12px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' }}
                      >Decline</button>
                    </div>
                  </div>
                )
              })
          }
        </div>
      </div>

      {/* ── TODAY'S SCHEDULE ── */}
      <div style={{ background: theme.cardBg, borderRadius: '16px', padding: '24px', boxShadow: '0 4px 18px rgba(0,0,0,0.02)', border: `1px solid ${theme.border}`, marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} color="#2563eb" />
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: theme.textMain }}>Today&apos;s Training Slots</h3>
          </div>
        </div>

        {/* Responsive Flex/Grid Schedule Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 180px 180px 120px', gap: '12px', padding: '10px 14px', borderRadius: '10px', background: theme.tableHeaderBg, marginBottom: '6px', border: `1px solid ${theme.border}` }}>
          {['Time Windows', 'Lesson Objective', 'Assigned Instructor', 'Enrolled Learner', 'Status State'].map((h, i) => (
            <span key={i} style={{ fontSize: '11px', fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{h}</span>
          ))}
        </div>

        {loading
          ? Array(3).fill(0).map((_, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 180px 180px 120px', gap: '12px', padding: '14px', borderBottom: `1px solid ${theme.border}`, alignItems: 'center' }}>
              {Array(5).fill(0).map((_, j) => <Skeleton key={j} h="13px" r="4px" />)}
            </div>
          ))
          : todaysBookings.length === 0
            ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ margin: 0, color: theme.textMuted, fontSize: '13.5px' }}>No field lessons are scheduled on the timeline today.</p>
              </div>
            )
            : todaysBookings.map((booking, idx) => {
              const slot = first(booking.lesson_slots)
              const learner = first(booking.learner)
              const instructor = first(booking.instructor)
              const time = slot?.slot_time?.slice(0, 5) || '--:--'
              const endTime = slot?.slot_time
                ? (() => {
                  const [h, m] = slot.slot_time.slice(0, 5).split(':').map(Number)
                  const end = new Date(); end.setHours(h + 1, m)
                  return `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
                })()
                : '--:--'
              const status = getLessonStatus(slot?.slot_time || '00:00', booking.status)
              const sc = statusStyles[status]
              return (
                <div key={booking.booking_id} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 180px 180px 120px', gap: '12px', padding: '14px', borderBottom: idx !== todaysBookings.length - 1 ? `1px solid ${theme.border}` : 'none', alignItems: 'center' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: '600', color: theme.textMain }}>{time} – {endTime}</span>
                  <span style={{ fontSize: '13.5px', color: theme.textMain, fontWeight: '500' }}>Practical Driving Lesson</span>
                  <span style={{ fontSize: '13.5px', color: theme.textMain }}>{instructor ? `${instructor.first_name} ${instructor.surname}` : 'Unassigned'}</span>
                  <span style={{ fontSize: '13.5px', color: theme.textMain }}>{learner ? `${learner.first_name} ${learner.surname}` : 'Unknown'}</span>
                  <span style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', background: sc.bg, color: sc.color, width: 'fit-content', letterSpacing: '0.2px' }}>
                    {status}
                  </span>
                </div>
              )
            })
        }
      </div>
    </>
  )
}