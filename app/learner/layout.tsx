'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { 
  LayoutDashboard, Calendar, TrendingUp, Bell, UserSquare2, LogOut, Sun, Moon, BookOpen, HelpCircle, CreditCard
} from 'lucide-react'

type Notification = {
  notification_id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
  recipient_id: string
}

export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isSidebarHovered, setIsSidebarHovered] = useState(false)
  const [profile, setProfile] = useState({ name: '', role: '' })
  
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false)
  const [isNotifClosing, setIsNotifClosing] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notifLoading, setNotifLoading] = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications])
  const drawerCloseTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (drawerCloseTimerRef.current) window.clearTimeout(drawerCloseTimerRef.current)
    }
  }, [])

  const loadNotifications = useMemo(() => {
    return async () => {
      setNotifLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setNotifications([])
          return
        }

        const { data } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', user.id)
          .order('created_at', { ascending: false })

        setNotifications((data || []) as Notification[])
      } finally {
        setNotifLoading(false)
      }
    }
  }, [supabase])

  useEffect(() => {
    if (!isNotifDrawerOpen) return
    loadNotifications()
  }, [isNotifDrawerOpen, loadNotifications])

  function requestCloseDrawer() {
    if (!isNotifDrawerOpen || isNotifClosing) return
    setIsNotifClosing(true)
    if (drawerCloseTimerRef.current) window.clearTimeout(drawerCloseTimerRef.current)
    drawerCloseTimerRef.current = window.setTimeout(() => {
      setIsNotifDrawerOpen(false)
      setIsNotifClosing(false)
    }, 260)
  }

  async function dismissNotification(id: string) {
    await supabase.from('notifications').delete().eq('notification_id', id)
    setNotifications(prev => prev.filter(n => n.notification_id !== id))
  }

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('users').select('first_name, surname, role').eq('user_id', user.id).single()
      if (data) setProfile({ name: `${data.first_name} ${data.surname}`, role: data.role || 'Learner' })
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  const theme = {
    background: isDarkMode ? '#1a1f2c' : '#f4f5f7',
    topbarBg: isDarkMode ? '#222836' : '#ffffff',
    textMain: isDarkMode ? '#f1f5f9' : '#1e293b',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#2d3545' : '#e2e8f0',
    sidebarBg: '#0b1329',
    primaryAccent: '#ff5a00',
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/learner/dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'payments', label: 'Payments', path: '/learner/payments', icon: <CreditCard size={18} /> },
    { id: 'lessons', label: 'My Lessons', path: '/learner/lessons', icon: <Calendar size={18} /> },
    { id: 'progress', label: 'Progress', path: '/learner/progress', icon: <TrendingUp size={18} /> },
    { id: 'notifications', label: 'Notifications', path: '/learner/notifications', icon: <Bell size={18} /> },
    { id: 'materials', label: 'Materials', path: '/learner/materials', icon: <BookOpen size={18} /> },
    { id: 'questions', label: 'Practice', path: '/learner/practice', icon: <HelpCircle size={18} /> },
    { id: 'profile', label: 'Profile', path: '/learner/profile', icon: <UserSquare2 size={18} /> },
  ]

  const topbarIconBtn: React.CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'transparent',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.15s',
    color: theme.textMain,
  }

  if (loading) return null

  return (
    <>
      {/* Notification Drawer Overlay (Learner) */}
      <div
        aria-hidden={!isNotifDrawerOpen}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          pointerEvents: isNotifDrawerOpen ? 'auto' : 'none',
        }}
      >
        {/* Background dim */}
        <div
          onClick={requestCloseDrawer}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15,23,42,0.55)',
            opacity: isNotifDrawerOpen && !isNotifClosing ? 1 : 0,
            transition: 'opacity 260ms ease',
          }}
        />

        {/* Drawer */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            height: '100%',
            width: '360px',
            maxWidth: '85vw',
            background: theme.topbarBg,
            borderRight: `1px solid ${theme.border}`,
            boxShadow: '8px 0 24px rgba(0,0,0,0.18)',
            transform: isNotifDrawerOpen && !isNotifClosing ? 'translateX(0%)' : 'translateX(105%)',
            transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              height: 68,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: theme.textMain, display: 'flex', gap: 8, alignItems: 'center' }}>
                <Bell size={18} />
                Notifications
                {unreadCount > 0 && (
                  <span style={{ background: '#dc2626', color: 'white', borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 800 }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: theme.textMuted }}> </div>
            </div>

            <button
              type="button"
              onClick={requestCloseDrawer}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'transparent',
                border: `1px solid ${theme.border}`,
                cursor: 'pointer',
                color: theme.textMain,
                fontWeight: 800,
              }}
              aria-label="Close notifications"
              title="Close"
            >
              ✕
            </button>
          </div>

          <div style={{ padding: 16, overflowY: 'auto' }}>
            {notifLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ background: theme.topbarBg, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16 }}>
                    <div style={{ height: 14, width: '40%', background: '#e5e7eb', borderRadius: 6 }} />
                    <div style={{ height: 10, width: '85%', background: '#e5e7eb', borderRadius: 6, marginTop: 10 }} />
                    <div style={{ height: 10, width: '70%', background: '#e5e7eb', borderRadius: 6, marginTop: 8 }} />
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '60px 8px', textAlign: 'center', color: theme.textMuted }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}> </div>
                <div style={{ fontWeight: 800, color: theme.textMain }}>No notifications</div>
                <div>You&apos;re all caught up</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {notifications.map(n => (
                  <div
                    key={n.notification_id}
                    style={{
                      borderRadius: 14,
                      padding: 14,
                      border: `1px solid ${n.is_read ? theme.border : '#ffedd5'}`,
                      background: n.is_read ? theme.topbarBg : '#fff7ed',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                   
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontWeight: 900, color: theme.textMain, fontSize: 13, lineHeight: 1.3, textTransform: 'capitalize' }}>
                          {n.type?.replace(/_/g, ' ') || 'Notification'}
                          {!n.is_read && (
                            <span style={{ marginLeft: 8, background: '#dc2626', color: 'white', borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 900 }}>
                              NEW
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: theme.textMuted, flexShrink: 0 }}>
                          {new Date(n.created_at).toLocaleString(undefined, { month: 'short', day: '2-digit' })}
                        </div>
                      </div>

                      <div style={{ marginTop: 6, fontSize: 13, color: theme.textMain, opacity: 0.95, lineHeight: 1.45 }}>
                        {n.message}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => dismissNotification(n.notification_id)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 10,
                        border: `1px solid ${theme.border}`,
                        background: 'transparent',
                        cursor: 'pointer',
                        color: theme.textMain,
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                      aria-label="Dismiss notification"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', minHeight: '100vh', background: theme.background, color: theme.textMain }}>
        {/* Sidebar */}
        <div 
          onMouseEnter={() => setIsSidebarHovered(true)} 
          onMouseLeave={() => setIsSidebarHovered(false)}
          style={{ width: isSidebarHovered ? 240 : 68, background: theme.sidebarBg, transition: 'width 0.25s', position: 'fixed', top: 0, bottom: 0, zIndex: 100, display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ padding: '24px 16px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: theme.primaryAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800' }}>DT</div>
          </div>
          
          <nav style={{ padding: '0 8px', flex: 1 }}>
            {menuItems.map(item => (
              <button key={item.id} onClick={() => router.push(item.path)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '11px', borderRadius: '12px', border: 'none', background: pathname === item.path ? theme.primaryAccent : 'transparent', color: pathname === item.path ? 'white' : '#8fa0c2', cursor: 'pointer', marginBottom: '4px' }}>
                {item.icon}
                {isSidebarHovered && item.label}
              </button>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div style={{ padding: '16px' }}>
            <div style={{ 
              background: '#131b2e', 
              padding: '12px', 
              borderRadius: '16px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              border: '1px solid #1e293b'
            }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff5a00', fontWeight: 'bold', border: '1px solid #334155' }}>
                {profile.name.split(' ').map(n => n[0]).join('')}
              </div>
              
              {isSidebarHovered && (
                <>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#ffffff', whiteSpace: 'nowrap' }}>{profile.name}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{profile.role}</div>
                  </div>
                  <button onClick={() => { supabase.auth.signOut(); router.push('/login') }} style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer' }}>
                    <LogOut size={20} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, marginLeft: 68 }}>
          <header style={{ background: theme.topbarBg, padding: '0 32px', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}` }}>
            <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>{menuItems.find(i => i.path === pathname)?.label || 'Dashboard'}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '13px', color: theme.textMuted, fontWeight: '500' }}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                style={topbarIconBtn}
                onMouseEnter={e => { e.currentTarget.style.background = isDarkMode ? '#2d3545' : '#f1f5f9' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNotifClosing(false)
                  setIsNotifDrawerOpen(true)
                }}
                style={{
                  ...topbarIconBtn,
                  position: 'relative',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isDarkMode ? '#2d3545' : '#f1f5f9' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      minWidth: '18px',
                      height: '18px',
                      padding: '0 5px',
                      borderRadius: '999px',
                      background: '#dc2626',
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid ' + (isDarkMode ? '#222836' : '#ffffff'),
                      boxSizing: 'content-box',
                      lineHeight: 1,
                    }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </header>
          <main style={{ padding: '32px' }}>{children}</main>
        </div>
      </div>
    </>
  )
}
