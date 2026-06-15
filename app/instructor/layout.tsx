'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { 
  LayoutDashboard, Calendar, TrendingUp, Bell, UserSquare2, LogOut, Sun, Moon 
} from 'lucide-react'

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isSidebarHovered, setIsSidebarHovered] = useState(false)
  const [profile, setProfile] = useState({ name: '', role: '' })
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('users').select('first_name, surname, role').eq('user_id', user.id).single()
      if (data) setProfile({ name: `${data.first_name} ${data.surname}`, role: data.role || 'Instructor' })
      setLoading(false)
    }
    loadData()
  }, [router, supabase])

  const theme = {
    background: isDarkMode ? '#1a1f2c' : '#f4f5f7',
    topbarBg: isDarkMode ? '#222836' : '#ffffff',
    textMain: isDarkMode ? '#f1f5f9' : '#1e293b',
    sidebarBg: '#0b1329',
    primaryAccent: '#ff5a00',
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', path: '/instructor/dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'lessons', label: 'My Lessons', path: '/instructor/lessons', icon: <Calendar size={18} /> },
    { id: 'progress', label: 'Progress', path: '/instructor/progress', icon: <TrendingUp size={18} /> },
    { id: 'notifications', label: 'Notifications', path: '/instructor/notifications', icon: <Bell size={18} /> },
    { id: 'profile', label: 'Profile', path: '/instructor/profile', icon: <UserSquare2 size={18} /> },
  ]

  if (loading) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.background, color: theme.textMain }}>
      {/* Sidebar */}
      <div 
        onMouseEnter={() => setIsSidebarHovered(true)} onMouseLeave={() => setIsSidebarHovered(false)}
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

        {/* Sidebar Footer - Updated to match image_502b99.png */}
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
        <header style={{ background: theme.topbarBg, padding: '0 32px', height: '68px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>{menuItems.find(i => i.path === pathname)?.label || 'Dashboard'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', color: '#64748b' }}>
            <span style={{ fontSize: '14px' }}>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <div onClick={() => setIsDarkMode(!isDarkMode)} style={{ cursor: 'pointer' }}>{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</div>
            <Bell size={20} />
          </div>
        </header>
        <main style={{ padding: '32px' }}>{children}</main>
      </div>
    </div>
  )
}