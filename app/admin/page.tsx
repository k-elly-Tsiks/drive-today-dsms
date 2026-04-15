'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [adminName, setAdminName] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

  useEffect(() => {
    let isMounted = true

    async function loadAdmin(isMounted: boolean) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('users')
        .select('first_name, surname, role')
        .eq('user_id', user.id)
        .single()

      if (!data || data.role !== 'admin') {
        router.push('/login')
        return
      }

      return { isMounted, data }
    }

    loadAdmin(true).then((result) => {
      if (isMounted && result?.data) {
        setAdminName(`${result.data.first_name} ${result.data.surname}`)
      }
    })

    return () => {
      isMounted = false
    }
  }, [router, supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠', path: '/admin/dashboard' },
    { id: 'learners', label: 'Learners', icon: '🎓', path: '/admin/learners' },
    { id: 'instructors', label: 'Instructors', icon: '🚗', path: '/admin/instructors' },
    { id: 'lessons', label: 'Lessons', icon: '📅', path: '/admin/lessons' },
    { id: 'payments', label: 'Payments', icon: '💰', path: '/admin/payments' },
    { id: 'expenses', label: 'Expenses', icon: '🧾', path: '/admin/expenses' },
    { id: 'reports', label: 'Financial Reports', icon: '📊', path: '/admin/reports' },
    { id: 'materials', label: 'Learning Materials', icon: '📚', path: '/admin/materials' },
    { id: 'questions', label: 'Practice Questions', icon: '❓', path: '/admin/questions' },
    { id: 'progress', label: 'Progress', icon: '📈', path: '/admin/progress' },
    { id: 'notifications', label: 'Notifications', icon: '🔔', path: '/admin/notifications' },
    { id: 'settings', label: 'Settings', icon: '⚙️', path: '/admin/settings' },
  ]

  // Get current page title
  const currentItem = menuItems.find(m => pathname.startsWith(m.path))
  const pageTitle = currentItem?.label || 'Dashboard'

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
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.path)
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.path)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive
                    ? 'rgba(255,255,255,0.15)'
                    : 'transparent',
                  color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  textAlign: 'left',
                  transition: 'all 0.2s ease',
                  borderLeft: isActive
                    ? `3px solid ${orange}`
                    : '3px solid transparent',
                }}
              >
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                {sidebarOpen && (
                  <span style={{
                    fontSize: '13px',
                    fontWeight: isActive ? '700' : '400',
                  }}>
                    {item.label}
                  </span>
                )}
              </button>
            )
          })}
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
            {sidebarOpen && (
              <span style={{ fontSize: '13px', fontWeight: '600' }}>Logout</span>
            )}
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
            {pageTitle}
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
        <div style={{ flex: 1 }}>
          {children}
        </div>

      </div>
    </div>
  )
}