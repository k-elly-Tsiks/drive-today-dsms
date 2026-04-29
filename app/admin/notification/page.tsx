'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Notification = {
  notification_id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
  recipient_id: string
  recipient?: {
    first_name: string
    surname: string
    role: string
  }
}

const supabase = createClient()

// ── Skeleton Loader (Matching AdminDashboard) ────────────
function Skeleton({ w = '100%', h = '14px', r = '6px' }: { w?: string; h?: string; r?: string }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }} />
  )
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [markingAll, setMarkingAll] = useState(false)

  const router = useRouter()
  const routerRef = useRef(router)

  // Design tokens aligned with AdminDashboard
  const textDark = '#1e293b'
  const textBody = '#64748b'
  const textMuted = '#94a3b8'
  const orange = '#e8731a'
  const danger = '#ef4444'
  const success = '#10b981'
  const primary = '#3b82f6'

  const notificationTypes = [
    { id: 'all', label: 'All', icon: '🔔' },
    { id: 'approval', label: 'Approvals', icon: '✅' },
    { id: 'rejection', label: 'Rejections', icon: '❌' },
    { id: 'cancellation', label: 'Cancellations', icon: '🚫' },
    { id: 'payment', label: 'Payments', icon: '💰' },
    { id: 'slot_allocation', label: 'Slot Allocation', icon: '📅' },
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
  }, [])

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
  }, [loadNotifications])

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
    const icons: Record<string, string> = {
      approval: '✅',
      rejection: '❌',
      cancellation: '🚫',
      payment: '💰',
      slot_allocation: '📅',
      quotation: '📋',
      lesson_reminder: '⏰',
    }
    return icons[type] || '🔔'
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
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`
    return date.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
      `}</style>
      
      <div style={{ minHeight: '100%', padding: '0 0 24px' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px', flexWrap: 'wrap', gap: '12px',
        }}>
          <div>
            <h1 style={{ color: textDark, fontSize: '22px', fontWeight: '800', margin: 0 }}>
              🔔 Notifications
              {!loading && unreadCount > 0 && (
                <span style={{
                  background: danger, color: 'white',
                  borderRadius: '20px', padding: '2px 8px',
                  fontSize: '13px', fontWeight: '700',
                  marginLeft: '10px',
                }}>
                  {unreadCount} unread
                </span>
              )}
            </h1>
            <p style={{ color: textBody, fontSize: '13px', margin: '4px 0 0' }}>
              All system notifications across all users
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {!loading && unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                disabled={markingAll}
                style={{
                  padding: '10px 18px', borderRadius: '8px',
                  border: `1px solid ${textBody}`,
                  background: 'white', color: textDark,
                  fontSize: '13px', fontWeight: '600',
                  cursor: markingAll ? 'not-allowed' : 'pointer',
                }}
              >
                {markingAll ? 'Marking...' : '✓ Mark all as read'}
              </button>
            )}
            <button
              onClick={() => router.push('/admin/dashboard')}
              style={{
                padding: '10px 18px', borderRadius: '8px',
                border: 'none', background: primary,
                color: 'white', fontSize: '13px',
                fontWeight: '600', cursor: 'pointer',
              }}
            >
              ← Dashboard
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '16px', marginBottom: '24px',
        }}>
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><Skeleton w="30px" h="28px" r="4px" /></div>
                <div style={{ display: 'flex', justifyContent: 'center' }}><Skeleton w="50px" h="11px" r="4px" /></div>
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
                background: 'white', borderRadius: '10px',
                padding: '20px', textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                borderTop: `3px solid ${stat.colour}`,
              }}>
                <p style={{ margin: '0 0 6px', fontSize: '28px', fontWeight: '800', color: stat.colour, lineHeight: 1.1 }}>
                  {stat.value}
                </p>
                <p style={{ margin: 0, fontSize: '11px', color: textMuted, fontWeight: '600', textTransform: 'uppercase' }}>
                  {stat.label}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Search and Filter */}
        <div style={{
          background: 'white', borderRadius: '10px',
          padding: '16px 20px', marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex', gap: '12px',
          alignItems: 'center', flexWrap: 'wrap',
        }}>
          <input
            type="text"
            placeholder="🔍 Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, minWidth: '200px',
              padding: '10px 14px', borderRadius: '8px',
              border: '1px solid #e2e8f0',
              fontSize: '13px', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {notificationTypes.map(t => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                style={{
                  padding: '8px 14px', borderRadius: '20px',
                  border: filter === t.id ? 'none' : '1px solid #e2e8f0',
                  background: filter === t.id ? textDark : 'white',
                  color: filter === t.id ? 'white' : textBody,
                  fontSize: '12px',
                  fontWeight: filter === t.id ? '700' : '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notifications List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <Skeleton w="42px" h="42px" r="50%" />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <Skeleton w="80px" h="14px" r="10px" />
                    <Skeleton w="60px" h="11px" r="4px" />
                  </div>
                  <div style={{ marginBottom: '8px' }}><Skeleton w="180px" h="12px" r="4px" /></div>
                  <Skeleton w="100%" h="13px" r="4px" />
                  <div style={{ marginTop: '6px' }}><Skeleton w="70%" h="13px" r="4px" /></div>
                </div>
              </div>
            ))
          ) : filteredNotifications.length === 0 ? (
            <div style={{
              background: 'white', borderRadius: '10px',
              padding: '60px', textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}>
              <p style={{ fontSize: '48px', marginBottom: '12px' }}>🔔</p>
              <p style={{ color: textDark, fontSize: '16px', fontWeight: '700', margin: '0 0 4px' }}>
                No notifications found
              </p>
              <p style={{ color: textBody, fontSize: '13px', margin: 0 }}>
                Notifications will appear here when system events occur
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <div
                key={notification.notification_id}
                style={{
                  background: notification.is_read ? 'white' : '#f8fafc',
                  borderRadius: '10px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  borderLeft: notification.is_read ? '3px solid transparent' : `3px solid ${primary}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                }}
              >
                {/* Type icon */}
                <div style={{
                  width: '42px', height: '42px',
                  borderRadius: '50%',
                  background: `${getTypeColour(notification.type)}15`,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '18px',
                  flexShrink: 0,
                }}>
                  {getTypeIcon(notification.type)}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: '8px',
                    marginBottom: '6px',
                  }}>
                    <div>
                      <span style={{
                        background: `${getTypeColour(notification.type)}15`,
                        color: getTypeColour(notification.type),
                        padding: '3px 8px', borderRadius: '10px',
                        fontSize: '10px', fontWeight: '800',
                        textTransform: 'uppercase',
                        marginRight: '6px',
                        letterSpacing: '0.5px'
                      }}>
                        {notification.type?.replace('_', ' ')}
                      </span>
                      {!notification.is_read && (
                        <span style={{
                          background: danger, color: 'white',
                          padding: '3px 8px', borderRadius: '10px',
                          fontSize: '10px', fontWeight: '800',
                          letterSpacing: '0.5px'
                        }}>
                          NEW
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', color: textMuted, fontWeight: '600', flexShrink: 0 }}>
                      {timeAgo(notification.created_at)}
                    </span>
                  </div>

                  {/* Recipient */}
                  <p style={{ margin: '0 0 6px', fontSize: '12px', color: textBody, fontWeight: '500' }}>
                    To: <strong style={{ color: textDark }}>{notification.recipient?.first_name} {notification.recipient?.surname}</strong>
                    <span style={{
                      background: '#e2e8f0', color: textDark,
                      padding: '2px 8px', borderRadius: '8px',
                      fontSize: '10px', marginLeft: '8px',
                      textTransform: 'capitalize',
                      fontWeight: '600'
                    }}>
                      {notification.recipient?.role}
                    </span>
                  </p>

                  {/* Message */}
                  <p style={{
                    margin: 0, fontSize: '14px',
                    color: textDark, lineHeight: '1.5',
                    fontWeight: notification.is_read ? '500' : '600'
                  }}>
                    {notification.message}
                  </p>
                </div>

                {/* Actions */}
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  gap: '8px', flexShrink: 0,
                }}>
                  {!notification.is_read && (
                    <button
                      onClick={() => markAsRead(notification.notification_id)}
                      style={{
                        padding: '6px 12px', borderRadius: '6px',
                        border: 'none', background: '#dcfce7',
                        color: '#16a34a', fontSize: '11px',
                        fontWeight: '700', cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Mark Read
                    </button>
                  )}
                  <button
                    onClick={() => deleteNotification(notification.notification_id)}
                    style={{
                      padding: '6px 12px', borderRadius: '6px',
                      border: 'none', background: '#fee2e2',
                      color: danger, fontSize: '11px',
                      fontWeight: '700', cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </>
  )
}
