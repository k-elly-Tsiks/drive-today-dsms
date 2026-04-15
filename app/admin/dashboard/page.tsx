'use client'

import { useState, useEffect, useCallback } from 'react'
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
  lesson_slots: { slot_date: string; slot_time: string }[] | null
  learner: { first_name: string; surname: string }[] | null
  instructor: { first_name: string; surname: string }[] | null
}

export default function AdminDashboard() {
  const [adminName, setAdminName] = useState('')
  const [stats, setStats] = useState({
    totalLearners: 0,
    totalInstructors: 0,
    pendingApprovals: 0,
    todaysLessons: 0,
    totalRevenue: 0,
    totalExpenses: 0,
  })
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [todaysBookings, setTodaysBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [activeMenu, setActiveMenu] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const loadDashboardData = useCallback(async () => {
    setLoading(true)

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Get admin name
    const { data: adminData } = await supabase
      .from('users')
      .select('first_name, surname')
      .eq('user_id', user.id)
      .single()

    if (adminData) setAdminName(`${adminData.first_name} ${adminData.surname}`)

    // Get total learners
    const { count: learnersCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'learner')
      .eq('status', 'approved')

    // Get total instructors
    const { count: instructorsCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'instructor')
      .eq('status', 'approved')

    // Get pending approvals
    const { count: pendingCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')

    // Get today's lessons
    const today = new Date().toISOString().split('T')[0]
    const { count: todaysCount } = await supabase
      .from('lesson_bookings')
      .select('*, lesson_slots!inner(*)', { count: 'exact', head: true })
      .eq('lesson_slots.slot_date', today)
      .eq('status', 'scheduled')

    // Get total revenue
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('amount')

    const totalRevenue = paymentsData?.reduce((sum, p) => sum + Number(p.amount), 0) || 0

    // Get total expenses
    const { data: expensesData } = await supabase
      .from('expenses')
      .select('amount')

    const totalExpenses = expensesData?.reduce((sum, e) => sum + Number(e.amount), 0) || 0

    // Get pending users list
    const { data: pendingList } = await supabase
      .from('users')
      .select('user_id, first_name, surname, role, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5)

    // Get today's bookings
    const { data: bookingsList } = await supabase
      .from('lesson_bookings')
      .select(`
        booking_id,
        status,
        lesson_slots (slot_date, slot_time),
        learner:users!lesson_bookings_learner_id_fkey (first_name, surname),
        instructor:users!lesson_bookings_instructor_id_fkey (first_name, surname)
      `)
      .eq('status', 'scheduled')
      .limit(5)

    setStats({
      totalLearners: learnersCount || 0,
      totalInstructors: instructorsCount || 0,
      pendingApprovals: pendingCount || 0,
      todaysLessons: todaysCount || 0,
      totalRevenue,
      totalExpenses,
    })

    setPendingUsers(pendingList || [])
    setTodaysBookings(bookingsList || [])
    setLoading(false)
  }, [router, supabase])

  useEffect(() => {
    let isMounted = true

    const fetchData = async () => {
      if (isMounted) {
        await loadDashboardData()
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [loadDashboardData])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function approveUser(userId: string) {
    await supabase
      .from('users')
      .update({ status: 'approved' })
      .eq('user_id', userId)

    // Send notification
    await supabase.from('notifications').insert({
      recipient_id: userId,
      message: 'Your registration has been approved. You can now log in to the system.',
      type: 'approval',
    })

    loadDashboardData()
  }

  async function rejectUser(userId: string) {
    await supabase
      .from('users')
      .update({ status: 'rejected' })
      .eq('user_id', userId)

    await supabase.from('notifications').insert({
      recipient_id: userId,
      message: 'Your registration has been rejected. Please contact the administrator for more information.',
      type: 'rejection',
    })

    loadDashboardData()
  }

  // ── COLOURS ──────────────────────────────────────────────────
  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  // ── SIDEBAR MENU ITEMS ────────────────────────────────────────
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', path: '/admin/dashboard' },
    { id: 'learners', label: 'Learners', icon: '🎓', path: '/admin/learner' },
    { id: 'instructors', label: 'Instructors', icon: '🚗', path:'/admin/instructor' },
    { id: 'lessons', label: 'Lessons', icon: '📅', path: '/admin/lessons'},
    { id: 'payments', label: 'Payments', icon: '💰', path: '/admin/payments' },
    { id: 'expenses', label: 'Expenses', icon: '🧾', path: '/admin/expenses' },
    { id: 'reports', label: 'Financial Reports', icon: '📊', path: '/admin/reports' },
    { id: 'materials', label: 'Learning Materials', icon: '📚', path: '/admin/materials' },
    { id: 'questions', label: 'Practice Questions', icon: '❓', path: '/admin/questions' },
    { id: 'progress', label: 'Progress', icon: '📈', path: '/admin/progress'},
    { id: 'notifications', label: 'Notifications', icon: '🔔', path: '/admin/notification' },
    { id: 'settings', label: 'Settings', icon: '⚙️', path: '/admin/settings' },
  ]

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
          <p style={{ color: blue, fontWeight: '600' }}>Loading Dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f4ff' }}>

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <div style={{
        width: sidebarOpen ? '240px' : '70px',
        background: blue,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        flexShrink: 0,
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        zIndex: 100,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}>

        {/* Sidebar Header */}
        <div style={{
          padding: '20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${blue}, ${orange})`,
            border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '800', fontSize: '14px',
            flexShrink: 0,
          }}>DT</div>
          {sidebarOpen && (
            <div>
              <p style={{ color: 'white', fontWeight: '700', fontSize: '14px', margin: 0 }}>
                Drive Today
              </p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', margin: 0 }}>
                Admin Panel
              </p>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveMenu(item.id)
                  if (item.path) router.push(item.path)
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeMenu === item.id
                    ? 'rgba(255,255,255,0.15)'
                    : 'transparent',
                  color: activeMenu === item.id ? 'white' : 'rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  borderLeft: activeMenu === item.id
                    ? `3px solid ${orange}`
                    : '3px solid transparent',
                }}
              >
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && (
                  <span style={{ fontSize: '13px', fontWeight: activeMenu === item.id ? '700' : '400' }}>
                    {item.label}
                  </span>
                )}
              </button>
            ))}
        </nav>

        {/* Logout Button */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              gap: '12px', padding: '10px 12px', borderRadius: '10px',
              border: 'none', background: 'rgba(239,68,68,0.2)',
              color: '#fca5a5', cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '18px' }}>🚪</span>
            {sidebarOpen && <span style={{ fontSize: '13px', fontWeight: '600' }}>Logout</span>}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <div style={{
        flex: 1,
        marginLeft: sidebarOpen ? '240px' : '70px',
        transition: 'margin-left 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Top Bar */}
        <div style={{
          background: 'white',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e5e7eb',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}>
          {/* Toggle Sidebar Button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: lightBlue, border: 'none',
              borderRadius: '8px', padding: '8px 10px',
              cursor: 'pointer', fontSize: '16px',
            }}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>

          {/* Page Title */}
          <h1 style={{ color: blue, fontSize: '18px', fontWeight: '700', margin: 0 }}>
            {menuItems.find(m => m.id === activeMenu)?.label}
          </h1>

          {/* Admin Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: blue }}>
                {adminName}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Administrator</p>
            </div>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: `linear-gradient(135deg, ${blue}, ${orange})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: '700', fontSize: '14px',
            }}>
              {adminName.charAt(0)}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ padding: '24px', flex: 1 }}>

          {/* ── DASHBOARD HOME ── */}
          {activeMenu === 'dashboard' && (
            <div>

              {/* Welcome Banner */}
              <div style={{
                background: `linear-gradient(135deg, ${blue}, #2d4fa3)`,
                borderRadius: '16px',
                padding: '24px 28px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '800', margin: '0 0 4px' }}>
                    Welcome back, {adminName.split(' ')[0]} 👋
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', margin: 0 }}>
                    Here is what is happening at Drive Today today
                  </p>
                </div>
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '28px',
                }}>🚗</div>
              </div>

              {/* Stats Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}>
                {[
                  { label: 'Total Learners', value: stats.totalLearners, icon: '🎓', colour: blue, path: '/admin/learner' },
                  { label: 'Total Instructors', value: stats.totalInstructors, icon: '🚗', colour: '#0891b2' , path: '/admin/instructor' },
                  { label: 'Pending Approvals', value: stats.pendingApprovals, icon: '⏳', colour: '#d97706', path: '/admin/notification' },
                  { label: "Today's Lessons", value: stats.todaysLessons, icon: '📅', colour: '#059669', path: '/admin/lessons' },
                  { label: 'Total Revenue', value: `$${stats.totalRevenue.toFixed(2)}`, icon: '💰', colour: '#7c3aed', path: '/admin/payments'},
                  { label: 'Net Profit', value: `$${(stats.totalRevenue - stats.totalExpenses).toFixed(2)}`, icon: '📊', colour: orange, path: '/admin/reports'},
                ].map((stat, i) => (
                  <div key={i} onClick={() => router.push(stat.path)}
                  style={{
                    background: 'white',
                    borderRadius: '14px',
                    padding: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    borderTop: `4px solid ${stat.colour}`,
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
                          {stat.label}
                        </p>
                        <p style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: stat.colour }}>
                          {stat.value}
                        </p>
                      </div>
                      <span style={{ fontSize: '28px' }}>{stat.icon}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Two Panels */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}>

          {/* Pending Approvals Panel */}
          <div style={{
            background: 'white', borderRadius: '14px',
            padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: blue, fontSize: '15px', fontWeight: '700', margin: 0 }}>
                ⏳ Pending Approvals
              </h3>
              <button
                onClick={() => router.push('/admin/learners')}
                style={{
                  background: 'none', border: 'none',
                  color: orange, fontSize: '12px',
                  fontWeight: '700', cursor: 'pointer',
                }}
              >
                View all →
              </button>
              </div>
                  {pendingUsers.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                      No pending approvals
                    </p>
                  ) : (
                    pendingUsers.map((user) => (
                      <div key={user.user_id} style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 0',
                        borderBottom: '1px solid #f3f4f6',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: lightBlue, display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                            color: blue, fontWeight: '700', fontSize: '14px',
                          }}>
                            {user.first_name.charAt(0)}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                              {user.first_name} {user.surname}
                            </p>
                            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280', textTransform: 'capitalize' }}>
                              {user.role}
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => approveUser(user.user_id)}
                            style={{
                              padding: '5px 10px', borderRadius: '6px',
                              border: 'none', background: '#d1fae5',
                              color: '#065f46', fontSize: '11px',
                              fontWeight: '700', cursor: 'pointer',
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => rejectUser(user.user_id)}
                            style={{
                              padding: '5px 10px', borderRadius: '6px',
                              border: 'none', background: '#fee2e2',
                              color: '#991b1b', fontSize: '11px',
                              fontWeight: '700', cursor: 'pointer',
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                      )}
                </div>
    
                    {/* Today's Lessons Panel */}
                <div style={{
                  background: 'white', borderRadius: '14px',
                  padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ color: blue, fontSize: '15px', fontWeight: '700', margin: '0 0 16px' }}>
                    📅 Today&apos;s Lessons
                  </h3>
                  <button
              onClick={() => router.push('/admin/lessons')}
              style={{
                background: 'none', border: 'none',
                color: orange, fontSize: '12px',
                fontWeight: '700', cursor: 'pointer',
              }}
            >
              View all →
            </button>
          </div>
                  {todaysBookings.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                      No lessons scheduled for today
                    </p>
                  ) : (
                    todaysBookings.map((booking) => (
                      <div key={booking.booking_id} style={{
                        padding: '10px 0',
                        borderBottom: '1px solid #f3f4f6',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                              {booking.learner?.[0]?.first_name} {booking.learner?.[0]?.surname}
                            </p>
                            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
                              Instructor: {booking.instructor?.[0]?.first_name} {booking.instructor?.[0]?.surname}
                            </p>
                          </div>
                          <div style={{
                            background: lightBlue, borderRadius: '8px',
                            padding: '4px 10px', textAlign: 'center',
                          }}>
                            <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: blue }}>
                              {booking.lesson_slots?.[0]?.slot_time?.slice(0, 5)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>
          )
          }
        </div>
      </div>
    </div>
  )
}

