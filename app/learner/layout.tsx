'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import {
  LayoutDashboard,
  Calendar,
  TrendingUp,
  Bell,
  UserSquare2,
  LogOut,
  Sun,
  Moon,
  CreditCard,
  BookOpen,
  HelpCircle,
} from 'lucide-react'

export default function LearnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])

  const [learnerName, setLearnerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isSidebarHovered, setIsSidebarHovered] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const SIDEBAR_EXPANDED = 240
  const SIDEBAR_COLLAPSED = 68
  const visualSidebarWidth = isSidebarHovered ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED
  const isSidebarCollapsed = !isSidebarHovered

  const theme = {
    background: isDarkMode ? '#1a1f2c' : '#f4f5f7',
    cardBg: isDarkMode ? '#222836' : '#ffffff',
    topbarBg: isDarkMode ? '#222836' : '#ffffff',
    textMain: isDarkMode ? '#f1f5f9' : '#1e293b',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#2d3545' : '#e2e8f0',
    sidebarBg: '#0b1329',
    primaryAccent: '#ff5a00',
  }

  const menuSections = useMemo(
    () => [
      {
        items: [
          { id: 'dashboard', label: 'Dashboard', path: '/learner/dashboard', icon: <LayoutDashboard size={18} /> },
          { id: 'lessons', label: 'My Lessons', path: '/learner/lessons', icon: <Calendar size={18} /> },
          { id: 'progress', label: 'My Progress', path: '/learner/progress', icon: <TrendingUp size={18} /> },
        ],
      },
      {
        items: [
          { id: 'payments', label: 'Payments', path: '/learner/payments', icon: <CreditCard size={18} /> },
          { id: 'materials', label: 'Learning Materials', path: '/learner/materials', icon: <BookOpen size={18} /> },
          { id: 'practice', label: 'Practice Tests', path: '/learner/practice', icon: <HelpCircle size={18} /> },
        ],
      },
      {
        items: [
          { id: 'notifications', label: 'Notifications', path: '/learner/notification', icon: <Bell size={18} /> },
          { id: 'profile', label: 'My Profile', path: '/learner/profile', icon: <UserSquare2 size={18} /> },
        ],
      },
    ],
    [],
  )

  const allItems = menuSections.flatMap((s) => s.items)
  const currentItem = allItems.find((m) => pathname === m.path || pathname?.startsWith(m.path + '/'))
  const pageTitle = currentItem?.label || 'Dashboard'

  const initials = learnerName
    .split(' ')
    .filter(Boolean)
    .map((n) => n.charAt(0).toUpperCase())
    .join('')

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [isDarkMode])

  useEffect(() => {
    let mounted = true

    async function loadLearner() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('users')
        .select('first_name, surname, role, status')
        .eq('user_id', user.id)
        .single()

      if (!data || data.role !== 'learner' || data.status !== 'approved') {
        router.push('/login')
        return
      }

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('is_read', false)

      if (!mounted) return
      setLearnerName(`${data.first_name} ${data.surname}`)
      setUnreadCount(count || 0)
      setLoading(false)
    }

    loadLearner()
    return () => {
      mounted = false
    }
  }, [router, supabase])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

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

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: theme.background,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: theme.primaryAccent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              fontSize: '16px',
              fontWeight: '800',
              color: 'white',
              boxShadow: '0 8px 24px rgba(255,90,0,0.25)',
            }}
          >
            DT
          </div>
          <p style={{ color: theme.textMuted, fontWeight: '600', fontSize: '13px' }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: theme.background,
        color: theme.textMain,
        fontFamily: "'Geist', 'Inter', sans-serif",
        transition: 'background 0.2s ease',
      }}
    >
      {/* ── SIDEBAR ── */}
      <div
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        style={{
          width: `${visualSidebarWidth}px`,
          background: theme.sidebarBg,
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 100,
          overflowY: 'hidden',
          overflowX: 'hidden',
          borderRight: `1px solid ${isDarkMode ? '#1a2333' : '#141d31'}`,
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{ padding: '24px 16px 20px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          {isSidebarCollapsed ? (
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: theme.primaryAccent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: '800',
                color: 'white',
              }}
            >
              DT
            </div>
          ) : (
            <div style={{ position: 'relative', width: '180px', height: '60px' }}>
              <Image
                src="/images/drivetodaylogo.png"
                alt="Drive Today Driving School Logo"
                fill
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          )}
        </div>

        <nav style={{ padding: `0 ${isSidebarCollapsed ? '8px' : '14px'} 0`, marginBottom: 'auto', transition: 'padding 0.25s ease' }}>
          {menuSections.map((section, si) => (
            <div key={si} style={{ marginBottom: '16px' }}>
              {section.items.map((item) => {
                const isActive = pathname === item.path || pathname?.startsWith(item.path + '/')
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(item.path)}
                    title={isSidebarCollapsed ? item.label : undefined}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                      gap: '12px',
                      padding: isSidebarCollapsed ? '11px 0' : '11px 12px',
                      borderRadius: '12px',
                      border: 'none',
                      background: isActive ? theme.primaryAccent : 'transparent',
                      color: isActive ? 'white' : '#8fa0c2',
                      cursor: 'pointer',
                      marginBottom: '4px',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      fontSize: '13.5px',
                      fontWeight: isActive ? '600' : '500',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        ;(e.currentTarget as HTMLButtonElement).style.background = '#141f38'
                        ;(e.currentTarget as HTMLButtonElement).style.color = '#ffffff'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                        ;(e.currentTarget as HTMLButtonElement).style.color = '#8fa0c2'
                      }
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.8, flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    {!isSidebarCollapsed && item.label}
                    {item.id === 'notifications' && unreadCount > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          right: isSidebarCollapsed ? 8 : 12,
                          top: 10,
                          background: '#dc2626',
                          color: 'white',
                          borderRadius: '10px',
                          padding: '1px 6px',
                          fontSize: '10px',
                          fontWeight: '700',
                        }}
                      >
                        {unreadCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: `4px ${isSidebarCollapsed ? '8px' : '14px'} 24px`, flexShrink: 0, transition: 'padding 0.25s ease' }}>
          {isSidebarCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#1d273e',
                  border: '2px solid #283554',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '12px',
                }}
              >
                {initials}
              </div>
              <button onClick={handleLogout} title="Logout" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                <LogOut size={16} color="#ef4444" />
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px',
                background: '#111a36',
                borderRadius: '14px',
                border: '1px solid #1c2744',
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#1d273e',
                  border: '2px solid #283554',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '12px',
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#ffffff', fontWeight: '600', fontSize: '13px', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {learnerName}
                </p>
                <p style={{ color: '#5b6b8c', fontSize: '11px', margin: 0, fontWeight: '500' }}>Learner</p>
              </div>
              <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }} title="Logout">
                <LogOut size={16} color="#ef4444" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT CANVAS ── */}
      <div style={{ flex: 1, marginLeft: `${SIDEBAR_COLLAPSED}px`, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          style={{
            background: theme.topbarBg,
            padding: '0 32px',
            height: '68px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${theme.border}`,
            position: 'sticky',
            top: 0,
            zIndex: 50,
            transition: 'background 0.2s ease, border-color 0.2s ease',
          }}
        >
          <div>
            <h1 style={{ color: theme.textMain, fontSize: '20px', fontWeight: '700', margin: 0, letterSpacing: '-0.2px' }}>{pageTitle}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ color: theme.textMuted, fontSize: '13px', fontWeight: '500' }}>{dateStr}</div>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              style={topbarIconBtn}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = isDarkMode ? '#2d3545' : '#f1f5f9'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              onClick={() => router.push('/learner/notification')}
              style={{ ...topbarIconBtn, position: 'relative' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = isDarkMode ? '#2d3545' : '#f1f5f9'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
              title="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    background: '#dc2626',
                    color: 'white',
                    borderRadius: '20px',
                    padding: '2px 6px',
                    fontSize: '10px',
                    fontWeight: '800',
                    border: '2px solid ' + (isDarkMode ? '#222836' : '#ffffff'),
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '32px' }}>{children}</div>
      </div>
    </div>
  )
}

