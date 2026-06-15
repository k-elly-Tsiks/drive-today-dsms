'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import { 
  LayoutDashboard, 
  Users, 
  UserSquare2, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  BarChart3, 
  BookOpen, 
  HelpCircle, 
  Settings, 
  LogOut, 
  Bell, 
  Sun, 
  Moon,
} from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [adminName, setAdminName] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isSidebarHovered, setIsSidebarHovered] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const SIDEBAR_EXPANDED = 240
  const SIDEBAR_COLLAPSED = 68

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

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

  const menuSections = [
    {
      items: [
        { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={18} /> },
        { id: 'learners', label: 'Learners', path: '/admin/learner', icon: <Users size={18} /> },
        { id: 'instructors', label: 'Instructors', path: '/admin/instructor', icon: <UserSquare2 size={18} /> },
        { id: 'lessons', label: 'Lessons', path: '/admin/lessons', icon: <Calendar size={18} /> },
      ],
    },
    {
      label: 'Finance',
      items: [
        { id: 'payments', label: 'Payments', path: '/admin/payments', icon: <CreditCard size={18} /> },
        { id: 'expenses', label: 'Expenses', path: '/admin/expenses', icon: <DollarSign size={18} /> },
        { id: 'reports', label: 'Reports', path: '/admin/reports', icon: <BarChart3 size={18} /> },
      ],
    },
    {
      label: 'Content',
      items: [
        { id: 'materials', label: 'Materials', path: '/admin/materials', icon: <BookOpen size={18} /> },
        { id: 'questions', label: 'Questions', path: '/admin/questions', icon: <HelpCircle size={18} /> },
        { id: 'questions', label: 'Settings', path: '/admin/settings', icon: <Settings size={18} /> },
      ],
    },
  ]

  const allItems = menuSections.flatMap(s => s.items)
  const currentItem = allItems.find(m => pathname === m.path || pathname.startsWith(m.path + '/'))
  const pageTitle = currentItem?.label || 'Dashboard'
  const initials = adminName.split(' ').map(n => n.charAt(0).toUpperCase()).join('')
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  })

  // The sidebar visually expands on hover, but the layout's dynamic baseline stays fixed at collapsed width
  const visualSidebarWidth = isSidebarHovered ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED
  const isSidebarCollapsed = !isSidebarHovered

  // Shared topbar icon button style
  const topbarIconBtn: React.CSSProperties = {
    width: '36px', height: '36px', borderRadius: '10px',
    background: 'transparent', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.15s',
    color: theme.textMain,
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.background }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: theme.primaryAccent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', fontSize: '16px', fontWeight: '800',
            color: 'white', boxShadow: '0 8px 24px rgba(255,90,0,0.25)',
          }}>
            DT
          </div>
          <p style={{ color: theme.textMuted, fontWeight: '600', fontSize: '13px' }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.background, color: theme.textMain, fontFamily: "'Geist', 'Inter', sans-serif", transition: 'background 0.2s ease' }}>

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
          top: 0, left: 0, bottom: 0,
          zIndex: 100,
          overflowY: 'hidden',
          overflowX: 'hidden',
          borderRight: `1px solid ${isDarkMode ? '#1a2333' : '#141d31'}`,
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >

        {/* Logo / Collapsed Icon */}
        <div style={{ padding: '24px 16px 20px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          {isSidebarCollapsed ? (
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: theme.primaryAccent,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: '800', color: 'white',
            }}>
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

        {/* Menu Navigation Links */}
        <nav style={{ padding: `0 ${isSidebarCollapsed ? '8px' : '14px'} 0`, marginBottom: 'auto', transition: 'padding 0.25s ease' }}>
          {menuSections.map((section, si) => (
            <div key={si} style={{ marginBottom: '16px' }}>
              {section.label && !isSidebarCollapsed && (
                <p style={{ color: '#445375', fontSize: '10px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', margin: '0 0 8px 12px' }}>
                  {section.label}
                </p>
              )}
              {section.label && isSidebarCollapsed && (
                <div style={{ height: '1px', background: '#1a2744', margin: '8px 4px 12px' }} />
              )}
              {section.items.map(item => {
                const isActive = pathname === item.path || pathname.startsWith(item.path + '/')
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
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        ;(e.currentTarget as HTMLButtonElement).style.background = '#141f38'
                        ;(e.currentTarget as HTMLButtonElement).style.color = '#ffffff'
                      }
                    }}
                    onMouseLeave={e => {
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
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* ── ADMIN PROFILE COMPONENT ── */}
        <div style={{ padding: `4px ${isSidebarCollapsed ? '8px' : '14px'} 24px`, flexShrink: 0, transition: 'padding 0.25s ease' }}>
          {isSidebarCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: '#1d273e', border: '2px solid #283554',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', fontWeight: '700', fontSize: '12px',
              }}>
                {initials}
              </div>
              <button
                onClick={handleLogout}
                title="Logout"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                <LogOut size={16} color="#ef4444" />
              </button>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px',
              background: '#111a36',
              borderRadius: '14px',
              border: '1px solid #1c2744'
            }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: '#1d273e', border: '2px solid #283554',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', fontWeight: '700', fontSize: '12px', flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#ffffff', fontWeight: '600', fontSize: '13px', margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {adminName}
                </p>
                <p style={{ color: '#5b6b8c', fontSize: '11px', margin: 0, fontWeight: '500' }}>Admin</p>
              </div>
              <button
                onClick={handleLogout}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                title="Logout"
              >
                <LogOut size={16} color="#ef4444" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT CANVAS ── */}
      {/* Keeps marginLeft pinned to SIDEBAR_COLLAPSED so main dashboard layouts won't shift when you hover */}
      <div style={{ flex: 1, marginLeft: `${SIDEBAR_COLLAPSED}px`, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header Topbar */}
        <div style={{
          background: theme.topbarBg,
          padding: '0 32px',
          height: '68px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${theme.border}`,
          position: 'sticky', top: 0, zIndex: 50,
          transition: 'background 0.2s ease, border-color 0.2s ease',
        }}>
          <div>
            <h1 style={{ color: theme.textMain, fontSize: '20px', fontWeight: '700', margin: 0, letterSpacing: '-0.2px' }}>
              {pageTitle}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ color: theme.textMuted, fontSize: '13px', fontWeight: '500' }}>
              {dateStr}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              style={topbarIconBtn}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = isDarkMode ? '#2d3545' : '#f1f5f9' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Notifications */}
            <button
              onClick={() => router.push('/admin/notification')}
              style={{ ...topbarIconBtn, position: 'relative' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = isDarkMode ? '#2d3545' : '#f1f5f9' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              title="Notifications"
            >
              <Bell size={18} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '32px' }}>
          {children}
        </div>
      </div>
    </div>
  )
}