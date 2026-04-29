'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

const supabase = createClient()

const C = {
  sidebar: '#1e2a4a',
  orange: '#c97230',
  pageBg: '#f5f6fa',
  textSec: '#8490a5',
}

type MenuSection = { title: string; items: { id: string; label: string; path: string }[] }

const sections: MenuSection[] = [
  {
    title: 'MAIN',
    items: [
      { id: 'dashboard', label: 'Dashboard', path: '/learner/dashboard' },
      { id: 'lessons', label: 'My lessons', path: '/learner/lessons' },
      { id: 'progress', label: 'Progress', path: '/learner/progress' },
      { id: 'payments', label: 'Payments', path: '/learner/payments' },
    ],
  },
  {
    title: 'LEARN',
    items: [
      { id: 'materials', label: 'Materials', path: '/learner/materials' },
      { id: 'practice', label: 'Practice tests', path: '/learner/practice' },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { id: 'notifications', label: 'Notifications', path: '/learner/notification' },
      { id: 'profile', label: 'My profile', path: '/learner/profile' },
    ],
  },
]

export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  const [learnerName, setLearnerName] = useState('')
  const [learnerInitials, setLearnerInitials] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)

  const router = useRouter()
  const routerRef = useRef(router)
  const pathname = usePathname()

  const loadLearner = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }

    const { data } = await supabase
      .from('users')
      .select('first_name, surname, role, status')
      .eq('user_id', user.id)
      .single()

    if (!data || data.role !== 'learner') { routerRef.current.push('/login'); return }
    if (data.status !== 'approved') { routerRef.current.push('/login'); return }

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
    async function init() { if (!cancelled) await loadLearner() }
    init()
    return () => { cancelled = true }
  }, [loadLearner])

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  const currentItem = sections.flatMap(s => s.items).find(m => pathname.startsWith(m.path))
  const pageTitle = currentItem?.label || 'My dashboard'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.pageBg }}>

      {/* ── SIDEBAR ── */}
      <div style={{
        width: 180, background: C.sidebar,
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
        overflowY: 'auto', overflowX: 'hidden',
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 18px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `linear-gradient(135deg, ${C.sidebar}, ${C.orange})`,
            border: '2px solid rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0,
          }}>DT</div>
          <div>
            <p style={{ color: 'white', fontWeight: 600, fontSize: 14, margin: 0 }}>Drive Today</p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, margin: 0 }}>Driving School</p>
          </div>
        </div>

        {/* Menu sections */}
        <nav style={{ flex: 1, padding: '8px 14px' }}>
          {sections.map(section => (
            <div key={section.title} style={{ marginBottom: 16 }}>
              <p style={{
                fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
                letterSpacing: '1.2px', margin: '0 0 8px 4px', textTransform: 'uppercase',
              }}>{section.title}</p>
              {section.items.map(item => {
                const isActive = pathname.startsWith(item.path)
                return (
                  <button key={item.id} onClick={() => router.push(item.path)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 4px', border: 'none', borderRadius: 6,
                      background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left', marginBottom: 2,
                      position: 'relative',
                    }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: isActive ? C.orange : 'transparent',
                    }} />
                    <span style={{
                      fontSize: 13, color: isActive ? '#fff' : 'rgba(255,255,255,0.55)',
                      fontWeight: isActive ? 600 : 400, flex: 1,
                    }}>{item.label}</span>
                    {item.id === 'notifications' && unreadCount > 0 && (
                      <span style={{
                        background: '#dc2626', color: 'white', borderRadius: 10,
                        padding: '1px 6px', fontSize: 10, fontWeight: 700, flexShrink: 0,
                      }}>{unreadCount}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User info at bottom */}
        <div style={{
          padding: '16px 14px', borderTop: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: `linear-gradient(135deg, #3b5998, ${C.orange})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 11, fontWeight: 600, flexShrink: 0,
          }}>{learnerInitials}</div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {learnerName}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>Learner</p>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, marginLeft: 180, display: 'flex', flexDirection: 'column' }}>

        {/* Top bar */}
        <div style={{
          background: 'white', padding: '14px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #e8ecf0',
          position: 'sticky', top: 0, zIndex: 50,
        }}>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: C.sidebar }}>
            {pageTitle === 'Dashboard' ? 'My dashboard' : pageTitle}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 13, color: C.textSec }}>{dateStr}</span>
            <span style={{ fontSize: 18, cursor: 'pointer' }}>🔔</span>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, padding: '24px 28px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
