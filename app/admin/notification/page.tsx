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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [markingAll, setMarkingAll] = useState(false)

  const router = useRouter()
  const routerRef = useRef(router)

  const blue = '#1e3a8a'
  const orange = '#f97316'
  const lightBlue = '#e8f0fe'

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
      approval: '#059669',
      rejection: '#dc2626',
      cancellation: '#d97706',
      payment: '#7c3aed',
      slot_allocation: blue,
      quotation: '#0891b2',
      lesson_reminder: orange,
    }
    return colours[type] || '#6b7280'
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

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: lightBlue,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: `linear-gradient(135deg, ${blue}, ${orange})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '24px', fontWeight: '800', color: 'white',
          }}>DT</div>
        <p style={{ color: blue, fontWeight: '600' }}>Loading Notifications...</p>
      </div>
      </div>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4ff', padding: '24px' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px', flexWrap: 'wrap', gap: '12px',
      }}>
        <div>
          <h1 style={{ color: blue, fontSize: '22px', fontWeight: '800', margin: 0 }}>
            🔔 Notifications
            {unreadCount > 0 && (
              <span style={{
                background: '#dc2626', color: 'white',
                borderRadius: '20px', padding: '2px 8px',
                fontSize: '13px', fontWeight: '700',
                marginLeft: '10px',
              }}>
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>
            All system notifications across all users
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              disabled={markingAll}
              style={{
                padding: '10px 18px', borderRadius: '10px',
                border: `2px solid ${blue}`,
                background: 'white', color: blue,
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
              padding: '10px 18px', borderRadius: '10px',
              border: 'none', background: blue,
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
        gap: '12px', marginBottom: '24px',
      }}>
        {[
          { label: 'Total', value: notifications.length, colour: blue },
          { label: 'Unread', value: unreadCount, colour: '#dc2626' },
          { label: 'Read', value: notifications.length - unreadCount, colour: '#059669' },
          {
            label: 'Today', colour: orange,
            value: notifications.filter(n => {
              const today = new Date().toISOString().split('T')[0]
              return n.created_at?.startsWith(today)
            }).length,
          },
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'white', borderRadius: '12px',
            padding: '16px', textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            borderTop: `3px solid ${stat.colour}`,
          }}>
            <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: '800', color: stat.colour }}>
              {stat.value}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Search and Filter */}
      <div style={{
        background: 'white', borderRadius: '14px',
        padding: '16px 20px', marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
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
            padding: '10px 14px', borderRadius: '10px',
            border: '1px solid #e5e7eb',
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
                border: filter === t.id ? 'none' : '1px solid #e5e7eb',
                background: filter === t.id
                  ? `linear-gradient(135deg, ${blue}, ${orange})`
                  : 'white',
                color: filter === t.id ? 'white' : '#6b7280',
                fontSize: '12px',
                fontWeight: filter === t.id ? '700' : '400',
                cursor: 'pointer',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredNotifications.length === 0 ? (
          <div style={{
            background: 'white', borderRadius: '14px',
            padding: '60px', textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <p style={{ fontSize: '48px', marginBottom: '12px' }}>🔔</p>
            <p style={{ color: '#374151', fontSize: '16px', fontWeight: '600', margin: '0 0 4px' }}>
              No notifications found
            </p>
            <p style={{ color: '#9ca3af', fontSize: '13px', margin: 0 }}>
              Notifications will appear here when system events occur
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.notification_id}
              style={{
                background: notification.is_read ? 'white' : '#f0f4ff',
                borderRadius: '12px',
                padding: '16px 20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: notification.is_read
                  ? '1px solid #f3f4f6'
                  : `1px solid ${lightBlue}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
              }}
            >
              {/* Type icon */}
              <div style={{
                width: '42px', height: '42px',
                borderRadius: '50%',
                background: `${getTypeColour(notification.type)}20`,
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
                  marginBottom: '4px',
                }}>
                  <div>
                    <span style={{
                      background: `${getTypeColour(notification.type)}20`,
                      color: getTypeColour(notification.type),
                      padding: '2px 8px', borderRadius: '10px',
                      fontSize: '10px', fontWeight: '700',
                      textTransform: 'uppercase',
                      marginRight: '6px',
                    }}>
                      {notification.type?.replace('_', ' ')}
                    </span>
                    {!notification.is_read && (
                      <span style={{
                        background: '#dc2626', color: 'white',
                        padding: '2px 6px', borderRadius: '10px',
                        fontSize: '10px', fontWeight: '700',
                      }}>
                        NEW
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>
                    {timeAgo(notification.created_at)}
                  </span>
                </div>

                {/* Recipient */}
                <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#6b7280' }}>
                  To: <strong>{notification.recipient?.first_name} {notification.recipient?.surname}</strong>
                  <span style={{
                    background: '#f3f4f6', color: '#374151',
                    padding: '1px 6px', borderRadius: '8px',
                    fontSize: '10px', marginLeft: '6px',
                    textTransform: 'capitalize',
                  }}>
                    {notification.recipient?.role}
                  </span>
                </p>

                {/* Message */}
                <p style={{
                  margin: 0, fontSize: '13px',
                  color: '#374151', lineHeight: '1.5',
                }}>
                  {notification.message}
                </p>
              </div>

              {/* Actions */}
              <div style={{
                display: 'flex', flexDirection: 'column',
                gap: '6px', flexShrink: 0,
              }}>
                {!notification.is_read && (
                  <button
                    onClick={() => markAsRead(notification.notification_id)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px',
                      border: 'none', background: '#d1fae5',
                      color: '#065f46', fontSize: '11px',
                      fontWeight: '700', cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={() => deleteNotification(notification.notification_id)}
                  style={{
                    padding: '5px 10px', borderRadius: '6px',
                    border: 'none', background: '#fee2e2',
                    color: '#991b1b', fontSize: '11px',
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
  )
}
