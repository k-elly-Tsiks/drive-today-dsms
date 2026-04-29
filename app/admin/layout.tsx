'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [adminName, setAdminName] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  // New Light Theme Colors
  const sidebarBg = '#e2e8f0'       // Light blue-gray for the sidebar
  const mainBg = '#f5f6fa'          // Lighter background for the main content
  const activeItemBg = '#cbd5e1'    // Darker block for the active menu item
  const textMuted = '#64748b'       // Muted gray text
  const textNormal = '#334155'      // Dark gray text
  const textActive = '#0f172a'      // Very dark text for active items
  const orange = '#e8731a'

  useEffect(() => {
    let isMounted = true
    async function loadAdmin() {
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
      if (isMounted) {
        setAdminName(`${data.first_name} ${data.surname}`)
        setLoading(false)
      }
    }
    loadAdmin()
    return () => { isMounted = false }
  }, [router, supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const menuSections = [
    {
      label: 'MAIN',
      items: [
        { id: 'dashboard',    label: 'Dashboard',    path: '/admin/dashboard'    },
        { id: 'learners',     label: 'Learners',     path: '/admin/learner'      },
        { id: 'instructors',  label: 'Instructors',  path: '/admin/instructor'   },
        { id: 'lessons',      label: 'Lessons',      path: '/admin/lessons'      },
      ],
    },
    {
      label: 'FINANCE',
      items: [
        { id: 'payments',  label: 'Payments',  path: '/admin/payments'  },
        { id: 'expenses',  label: 'Expenses',  path: '/admin/expenses'  },
        { id: 'reports',   label: 'Reports',   path: '/admin/reports'   },
      ],
    },
    {
      label: 'CONTENT',
      items: [
        { id: 'materials',  label: 'Materials',  path: '/admin/materials'     },
        { id: 'questions',  label: 'Questions',  path: '/admin/questions'     },
        { id: 'settings',   label: 'Settings',   path: '/admin/settings'      },
      ],
    },
  ]

  const allItems = menuSections.flatMap(s => s.items)
  const currentItem = allItems.find(m => pathname === m.path || pathname.startsWith(m.path + '/'))
  const pageTitle = currentItem?.label || 'Dashboard'
  const initials = adminName.split(' ').map(n => n.charAt(0).toUpperCase()).join('')
  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: mainBg }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '18px', fontWeight: '700', color: textNormal }}>
            DT
          </div>
          <p style={{ color: textMuted, fontWeight: '500', fontSize: '14px' }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: mainBg }}>

      {/* ── SIDEBAR ── */}
      <div style={{
        width: '220px', background: sidebarBg,
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0,
        zIndex: 100, overflowY: 'auto', overflowX: 'hidden',
        borderRight: '1px solid #cbd5e1', // Subtle border to separate from main content
      }}>

        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: `linear-gradient(135deg, #2a4a9e, ${orange})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '800', fontSize: '11px', flexShrink: 0,
          }}>
            DT
          </div>
          <div>
            <p style={{ color: textActive, fontWeight: '800', fontSize: '14px', margin: 0, lineHeight: 1.2 }}>Drive Today</p>
            <p style={{ color: textMuted, fontSize: '10px', margin: 0, fontWeight: '500' }}>Driving School</p>
          </div>
        </div>

        {/* Menu Sections */}
        <nav style={{ flex: 1, padding: '4px 12px' }}>
          {menuSections.map(section => (
            <div key={section.label} style={{ marginBottom: '18px' }}>
              <p style={{
                color: textMuted, fontSize: '10px', fontWeight: '700',
                letterSpacing: '1.2px', textTransform: 'uppercase',
                margin: '0 0 6px 8px',
              }}>
                {section.label}
              </p>
              {section.items.map(item => {
                const isActive = pathname === item.path || pathname.startsWith(item.path + '/')
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(item.path)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center',
                      gap: '10px', padding: '9px 12px', borderRadius: '8px',
                      border: 'none',
                      background: isActive ? activeItemBg : 'transparent',
                      color: isActive ? textActive : textNormal,
                      cursor: 'pointer', marginBottom: '2px',
                      textAlign: 'left', transition: 'all 0.15s ease',
                      fontSize: '13px', fontWeight: isActive ? '700' : '500',
                      fontFamily: 'inherit',
                    }}
                  >
                    {/* The orange dot span has been removed */}
                    {item.label}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User profile / logout */}
        <div
          onClick={handleLogout}
          title="Click to logout"
          style={{
            padding: '16px', borderTop: '1px solid #cbd5e1',
            display: 'flex', alignItems: 'center', gap: '10px',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%',
            background: `linear-gradient(135deg, #2a4a9e, ${orange})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: '700', fontSize: '11px', flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <p style={{ color: textActive, fontWeight: '700', fontSize: '12px', margin: 0, lineHeight: 1.2 }}>{adminName}</p>
            <p style={{ color: textMuted, fontSize: '10px', margin: 0, fontWeight: '500' }}>Administrator</p>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, marginLeft: '220px', display: 'flex', flexDirection: 'column' }}>

        {/* Topbar */}
        <div style={{
          background: 'white', padding: '16px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #eaecf0',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <h1 style={{ color: '#1a1a2e', fontSize: '20px', fontWeight: '800', margin: 0 }}>
            {pageTitle}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ color: '#64748b', fontSize: '13px', fontWeight: '600' }}>{dateStr}</span>
            <div
              onClick={() => router.push('/admin/notification')}
              style={{
                width: '34px', height: '34px', borderRadius: '50%',
                background: '#f1f5f9', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', fontSize: '15px',
              }}
            >
              🔔
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1, padding: '24px 28px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
