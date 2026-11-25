'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { 
  Bell, 
  CheckCircle, 
  XCircle, 
  Ban, 
  CreditCard, 
  Calendar, 
  Clock, 
  FileText,
  Search,
  Trash2,
  Check,
  CheckCheck,
  X,
} from 'lucide-react'

import { type Notification } from '../types'


export default function NotificationsPage() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  const router = useRouter()
  const routerRef = useRef(router)

  // Sync state with HTML class selector for component dark/light theme
  useEffect(() => {
    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    checkTheme()
    const observer = new MutationObserver(checkTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Dynamic Theme Colors consistent with AdminDashboard
  const theme = {
    cardBg: isDarkMode ? '#222836' : '#ffffff',
    textMain: isDarkMode ? '#f1f5f9' : '#1e293b',
    textMuted: isDarkMode ? '#94a3b8' : '#64748b',
    border: isDarkMode ? '#2d3545' : '#e2e8f0',
    tableHeaderBg: isDarkMode ? '#1a1f2c' : '#f8fafc',
    shimmerBg: isDarkMode ? 'linear-gradient(90deg,#222836 25%,#2d3545 50%,#222836 75%)' : 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
    primaryOrange: '#ff5a00',
  }

  const textDark = theme.textMain
  const textBody = theme.textMuted
  const textMuted = isDarkMode ? '#64748b' : '#94a3b8'
  const orange = theme.primaryOrange
  const danger = '#ef4444'
  const success = '#10b981'
  const primary = '#3b82f6'

  // Icon mappings for the dynamic headers
  const notificationTypes = [
    { id: 'all', label: 'All', icon: <Bell size={13} /> },
    { id: 'approval', label: 'Approvals', icon: <CheckCircle size={13} /> },
    { id: 'rejection', label: 'Rejections', icon: <XCircle size={13} /> },
    { id: 'cancellation', label: 'Cancellations', icon: <Ban size={13} /> },
    { id: 'payment', label: 'Payments', icon: <CreditCard size={13} /> },
    { id: 'slot_allocation', label: 'Slot List', icon: <Calendar size={13} /> },
  ]

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select(`
        *,
        recipient:users!notifications_recipient_id_fkey (
          first_name, surname, role
        )
      `)
      .order('created_at', { ascending: false })

    setNotifications(data || [])
    setLoading(false)
  }, [supabase])

  const checkAdmin = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { routerRef.current.push('/login'); return }
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (data?.role !== 'admin') { routerRef.current.push('/login'); return }
    await loadNotifications()
  }, [supabase, loadNotifications])

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!cancelled) await checkAdmin()
    }
    init()
    return () => { cancelled = true }
  }, [checkAdmin])

  async function markAsRead(notificationId: string) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('notification_id', notificationId)

    setNotifications(prev =>
      prev.map(n =>
        n.notification_id === notificationId ? { ...n, is_read: true } : n
      )
    )
  }

  async function markAllAsRead() {
    setMarkingAll(true)
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setMarkingAll(false)
  }

  async function deleteNotification(notificationId: string) {
    await supabase
      .from('notifications')
      .delete()
      .eq('notification_id', notificationId)

    setNotifications(prev =>
      prev.filter(n => n.notification_id !== notificationId)
    )
  }

  // ─── Derived state ───────────────────────────────────────────────────────────

  const filteredNotifications = notifications.filter(n => {
    const recipientName = `${n.recipient?.first_name} ${n.recipient?.surname}`.toLowerCase()
    const matchesSearch =
      n.message?.toLowerCase().includes(search.toLowerCase()) ||
      recipientName.includes(search.toLowerCase())
    const matchesFilter = filter === 'all' || n.type === filter
    return matchesSearch && matchesFilter
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  // ─── Helper functions ────────────────────────────────────────────────────────

  function getTypeIcon(type: string) {
    const size = 16
    const icons: Record<string, React.ReactNode> = {
      approval: <CheckCircle size={size} />,
      rejection: <XCircle size={size} />,
      cancellation: <Ban size={size} />,
      payment: <CreditCard size={size} />,
      slot_allocation: <Calendar size={size} />,
      quotation: <FileText size={size} />,
      lesson_reminder: <Clock size={size} />,
    }
    return icons[type] || <Bell size={size} />
  }

  function getTypeColour(type: string) {
    const colours: Record<string, string> = {
      approval: success,
      rejection: danger,
      cancellation: orange,
      payment: '#8b5cf6',
      slot_allocation: primary,
      quotation: '#06b6d4',
      lesson_reminder: orange,
    }
    return colours[type] || textBody
  }

  function timeAgo(dateString: string) {
    const now = new Date()
    const date = new Date(dateString)
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)} min`
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)} d ago`
    return date.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short'
    })
  }

  // Skeleton shimmer placeholder inside side panel
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

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        .drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.25);
          backdrop-filter: blur(4px);
          display: flex;
          justify-content: flex-end;
          z-index: 500;
          animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .drawer-panel {
          width: 460px;
          max-width: 100%;
          height: 100vh;
          background: ${theme.cardBg};
          border-left: 1px solid ${theme.border};
          box-shadow: -8px 0 32px rgba(15, 23, 42, 0.08);
          display: flex;
          flex-direction: column;
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .panel-scroll::-webkit-scrollbar {
          width: 5px;
        }
        .panel-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .panel-scroll::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? '#3b4252' : '#cbd5e1'};
          border-radius: 4px;
        }
        .panel-scroll::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? '#4c566a' : '#94a3b8'};
        }
        .type-pill {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease-in-out;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
        }
        .action-icon-btn {
          padding: 6px;
          border-radius: 8px;
          border: 1px solid ${theme.border};
          background: transparent;
          color: ${theme.textMuted};
          cursor: pointer;
          transition: all 0.1s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .action-icon-btn:hover {
          background: ${isDarkMode ? '#1a1f2c' : '#f8fafc'};
          color: ${theme.textMain};
          border-color: ${theme.primaryOrange};
        }
      `}</style>
      
      {/* Outer Clickable Overlay Backdrop (clicking left closes and returns to dashboard) */}
      <div className="drawer-overlay" onClick={() => router.push('/admin/dashboard')}>
        
        {/* Right-aligned floating drawer content (stops event bubbling so you can interact within drawer) */}
        <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
          
          {/* Top Bar Header */}
          <div style={{
            padding: '24px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ color: textDark, fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bell size={18} color={orange} />
                  Alerts Control
                </h2>
                {!loading && unreadCount > 0 && (
                  <span style={{
                    background: danger,
                    color: 'white',
                    borderRadius: '20px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: '800',
                  }}>
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p style={{ color: textBody, fontSize: '11.5px', margin: '4px 0 0', fontWeight: '500' }}>
                Manage operational and registration triggers
              </p>
            </div>
            
            {/* Close / Dashboard Button */}
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="action-icon-btn"
              style={{ padding: '8px' }}
              title="Return to Dashboard"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable Panel Area */}
          <div className="panel-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            
            {/* Horizontal Segmented Counter Badges (Compact 2x2 design) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px',
              marginBottom: '20px',
            }}>
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} style={{ background: isDarkMode ? '#1a1f2c' : '#f8fafc', border: `1px solid ${theme.border}`, borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}><Skeleton w="24px" h="18px" r="4px" /></div>
                    <Skeleton w="30px" h="8px" r="3px" />
                  </div>
                ))
              ) : (
                [
                  { label: 'Total', value: notifications.length, colour: primary },
                  { label: 'Unread', value: unreadCount, colour: danger },
                  { label: 'Read', value: notifications.length - unreadCount, colour: success },
                  {
                    label: 'Today', colour: orange,
                    value: notifications.filter(n => {
                      const today = new Date().toISOString().split('T')[0]
                      return n.created_at?.startsWith(today)
                    }).length,
                  },
                ].map((stat, i) => (
                  <div key={i} style={{
                    background: isDarkMode ? '#1a1f2c' : '#f8fafc',
                    borderRadius: '10px',
                    padding: '10px 6px',
                    textAlign: 'center',
                    border: `1px solid ${theme.border}`,
                    borderTop: `2.5px solid ${stat.colour}`,
                  }}>
                    <p style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: '800', color: stat.colour, lineHeight: 1 }}>
                      {stat.value}
                    </p>
                    <p style={{ margin: 0, fontSize: '9px', color: textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                      {stat.label}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Quick Filter actions under stats */}
            {!loading && unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={markingAll}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${isDarkMode ? '#3b4252' : '#cbd5e1'}`,
                  background: isDarkMode ? '#222836' : '#ffffff',
                  color: textDark,
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: markingAll ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginBottom: '16px',
                  transition: 'all 0.1s'
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = orange }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = isDarkMode ? '#3b4252' : '#cbd5e1' }}
              >
                <CheckCheck size={14} color={success} />
                {markingAll ? 'Marking all...' : 'Mark all messages as read'}
              </button>
            )}

            {/* Compact Search Box bar */}
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: textMuted, display: 'flex' }}>
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Search alerts or recipients..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 34px',
                  borderRadius: '10px',
                  border: `1px solid ${theme.border}`,
                  background: isDarkMode ? '#1a1f2c' : '#ffffff',
                  color: textDark,
                  fontSize: '12.5px',
                  fontWeight: '500',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Small Horizontal Filter Pills Scroll (Lucide Integrated) */}
            <div style={{ 
              display: 'flex', 
              gap: '6px', 
              overflowX: 'auto', 
              paddingBottom: '12px', 
              marginBottom: '16px',
              borderBottom: `1px solid ${theme.border}`
            }} className="panel-scroll">
              {notificationTypes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setFilter(t.id)}
                  className="type-pill"
                  style={{
                    border: filter === t.id ? 'none' : `1px solid ${theme.border}`,
                    background: filter === t.id ? textDark : (isDarkMode ? '#1a1f2c' : '#ffffff'),
                    color: filter === t.id ? (isDarkMode ? '#0f172a' : '#ffffff') : textBody,
                  }}
                >
                  <span style={{ display: 'flex', opacity: filter === t.id ? 1 : 0.7 }}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {/* List Body */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} style={{ background: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px' }}>
                    <Skeleton w="32px" h="32px" r="50%" />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <Skeleton w="60px" h="10px" r="3px" />
                        <Skeleton w="40px" h="8px" r="3px" />
                      </div>
                      <Skeleton w="100%" h="12px" r="4px" />
                      <div style={{ marginTop: '5px' }}><Skeleton w="80%" h="12px" r="4px" /></div>
                    </div>
                  </div>
                ))
              ) : filteredNotifications.length === 0 ? (
                <div style={{
                  background: isDarkMode ? '#1a1f2c' : '#f8fafc',
                  border: `1px dashed ${theme.border}`,
                  borderRadius: '12px',
                  padding: '40px 16px',
                  textAlign: 'center',
                }}>
                  <Bell size={24} style={{ color: textMuted, margin: '0 auto 8px', opacity: 0.6 }} />
                  <p style={{ color: textDark, fontSize: '13.5px', fontWeight: '700', margin: '0 0 4px' }}>
                    All quiet here
                  </p>
                  <p style={{ color: textMuted, fontSize: '11px', margin: 0, fontWeight: '500' }}>
                    No alerts found on the active checklist
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notification) => {
                  const typeColour = getTypeColour(notification.type)
                  return (
                    <div
                      key={notification.notification_id}
                      style={{
                        background: notification.is_read 
                          ? (isDarkMode ? '#1a1f2c' : '#ffffff') 
                          : (isDarkMode ? '#222836' : '#fffbfa'),
                        borderRadius: '12px',
                        padding: '14px 16px',
                        border: `1px solid ${theme.border}`,
                        borderLeft: `4px solid ${notification.is_read ? typeColour : orange}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        transition: 'transform 0.1s ease',
                      }}
                    >
                      {/* Badge / Timestamp row */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            background: `${typeColour}15`,
                            color: typeColour,
                            padding: '3px 8px',
                            borderRadius: '20px',
                            fontSize: '9.5px',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            {getTypeIcon(notification.type)}
                            {notification.type?.replace('_', ' ')}
                          </span>
                          {!notification.is_read && (
                            <span style={{
                              background: orange,
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              fontSize: '8.5px',
                              fontWeight: '900',
                              letterSpacing: '0.2px'
                            }}>
                              NEW
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '10.5px', color: textMuted, fontWeight: '600' }}>
                          {timeAgo(notification.created_at)}
                        </span>
                      </div>

                      {/* Recipient Account Details spacing */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: textBody, fontWeight: '600' }}>
                        <span>To student:</span>
                        <strong style={{ color: textDark }}>
                          {notification.recipient?.first_name} {notification.recipient?.surname}
                        </strong>
                        <span style={{
                          background: isDarkMode ? '#10141d' : '#f1f5f9',
                          color: textBody,
                          padding: '1.5px 6px',
                          borderRadius: '6px',
                          fontSize: '9px',
                          textTransform: 'capitalize',
                          fontWeight: '800'
                        }}>
                          {notification.recipient?.role}
                        </span>
                      </div>

                      {/* Notification Message Text */}
                      <p style={{
                        margin: '2px 0 6px 0',
                        fontSize: '12.5px',
                        color: textDark,
                        lineHeight: '1.45',
                        fontWeight: notification.is_read ? '500' : '600'
                      }}>
                        {notification.message}
                      </p>

                      {/* Actions Footer block */}
                      <div style={{
                        display: 'flex',
                        gap: '6px',
                        justifyContent: 'flex-end',
                        borderTop: `1px solid ${theme.border}`,
                        paddingTop: '8px',
                        marginTop: '4px'
                      }}>
                        {!notification.is_read && (
                          <button
                            onClick={() => markAsRead(notification.notification_id)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              background: isDarkMode ? 'rgba(34,197,94,0.12)' : '#dcfce7',
                              color: '#16a34a',
                              fontSize: '10.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Check size={12} />
                            Mark Read
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.notification_id)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            background: isDarkMode ? 'rgba(239,68,68,0.12)' : '#fee2e2',
                            color: danger,
                            fontSize: '10.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>

                    </div>
                  )
                })
              )}
            </div>

          </div>

          {/* Dedicated Compact Drawer Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${theme.border}`,
            background: isDarkMode ? '#1a1f2c' : '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '10px',
            fontWeight: '700',
            color: textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            <span>System Auditor Center</span>
            <span>Real-time Log</span>
          </div>

        </div>
      </div>
    </>
  )
}