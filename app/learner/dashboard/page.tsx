'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

const supabase = createClient()

export default function LearnerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [learnerName, setLearnerName] = useState('')
  const [learnerInitials, setLearnerInitials] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)

  const router = useRouter()
  const routerRef = useRef(router)
  const pathname = usePathname()

  const blue = '#1e3a8a'
  const orange = '#f97316'

  // ─── Auth + data ─────────────────────────────────────────────────────────────

  const loadLearner = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }

    const { data } = await supabase
      .from('users')
      .select('first_name, surname, role, status')
      .eq('user_id', user.id)
      .single()

    if (!data || data.role !== 'learner') {
      routerRef.current.push('/login')
      return
    }

    if (data.status !== 'approved') {
      routerRef.current.push('/login')
      return
    }

    setLearnerName(`${data.first_name} ${data.surname}`)
    setLearnerInitials(`${data.first_name.charAt(0)}${data.surname.charAt(0)}`)

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', user.id)
      .eq('is_read', false)

    setUnreadCount(count || 0)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await loadLearner()
    }
    init()
    return () => { cancelled = true }
  }, [loadLearner])

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // ─── Menu ─────────────────────────────────────────────────────────────────────

  const menuItems = [
    { id: 'dashboard',     label: 'Dashboard',          icon: '🏠', path: '/learner/dashboard' },
    { id: 'lessons',       label: 'My Lessons',          icon: '📅', path: '/learner/lessons' },
    { id: 'progress',      label: 'My Progress',         icon: '📈', path: '/learner/progress' },
    { id: 'payments',      label: 'Payments',            icon: '💰', path: '/learner/payments' },
    { id: 'materials',     label: 'Learning Materials',  icon: '📚', path: '/learner/materials' },
    { id: 'practice',      label: 'Practice Tests',      icon: '❓', path: '/learner/practice' },
    { id: 'notifications', label: 'Notifications',       icon: '🔔', path: '/learner/notification' },
    { id: 'profile',       label: 'My Profile',          icon: '👤', path: '/learner/profile' },
  ]

  const currentItem = menuItems.find(m => pathname.startsWith(m.path))
  const pageTitle = currentItem?.label || 'Dashboard'

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f0f4ff' }}>

      {/* ── SIDEBAR ── */}
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
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${blue}, ${orange})`,
            border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '800', fontSize: '14px', flexShrink: 0,
          }}>DT</div>
          {sidebarOpen && (
            <div>
              <p style={{ color: 'white', fontWeight: '700', fontSize: '14px', margin: 0 }}>
                Drive Today
              </p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', margin: 0 }}>
                Learner Portal
              </p>
            </div>
          )}
        </div>

        {/* Menu Items */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.path)
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.path)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  gap: '12px', padding: '10px 12px', borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
                  cursor: 'pointer', marginBottom: '4px',
                  textAlign: 'left', transition: 'all 0.2s ease',
                  borderLeft: isActive ? `3px solid ${orange}` : '3px solid transparent',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && (
                  <span style={{
                    fontSize: '13px',
                    fontWeight: isActive ? '700' : '400',
                    flex: 1,
                  }}>
                    {item.label}
                  </span>
                )}
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span style={{
                    background: '#dc2626', color: 'white',
                    borderRadius: '10px', padding: '1px 6px',
                    fontSize: '10px', fontWeight: '700', flexShrink: 0,
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Logout */}
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
            {sidebarOpen && (
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Logout</span>
            )}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{
        flex: 1,
        marginLeft: sidebarOpen ? '240px' : '70px',
        transition: 'margin-left 0.3s ease',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Top Bar */}
        <div style={{
          background: 'white', padding: '16px 24px',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #e5e7eb',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: '#e8f0fe', border: 'none',
              borderRadius: '8px', padding: '8px 10px',
              cursor: 'pointer', fontSize: '16px',
            }}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>

          <h1 style={{ color: blue, fontSize: '18px', fontWeight: '700', margin: 0 }}>
            {pageTitle}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: blue }}>
                {learnerName}
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>Learner</p>
            </div>
            <div style={{
              width: '38px', height: '38px', borderRadius: '50%',
              background: `linear-gradient(135deg, ${blue}, ${orange})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: '700', fontSize: '14px',
            }}>
              {learnerInitials}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1 }}>
          {children}
        </div>

      </div>
    </div>
  )
}
