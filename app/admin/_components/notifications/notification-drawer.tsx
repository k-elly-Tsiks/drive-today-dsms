'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, CheckCircle, XCircle, Ban, CreditCard, Calendar, Clock, FileText, X } from 'lucide-react'

type AdminNotification = {

  notification_id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
  recipient_id: string
}

const supabase = createClient()

function getTypeTitle(type: string) {
  const map: Record<string, string> = {
    approval: 'Approval',
    rejection: 'Rejection',
    cancellation: 'Cancellation',
    payment: 'Payment',
    slot_allocation: 'Slot List',
    quotation: 'Quotation',
    lesson_reminder: 'Lesson Reminder',
  }
  return map[type] || 'Notification'
}

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
    approval: '#059669',
    rejection: '#dc2626',
    cancellation: '#d97706',
    payment: '#7c3aed',
    slot_allocation: '#2563eb',
    quotation: '#0891b2',
    lesson_reminder: '#ff5a00',
  }
  return colours[type] || '#6b7280'
}

export default function NotificationDrawer({
  open,
  onClose,
  initiallyUnreadCount = 0,
}: {
  open: boolean
  onClose: () => void
  initiallyUnreadCount?: number
}) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(initiallyUnreadCount)
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    const update = () => setIsDarkMode(document.documentElement.classList.contains('dark'))
    update()
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const theme = useMemo(
    () => ({
      background: isDarkMode ? '#1a1f2c' : '#f4f5f7',
      cardBg: isDarkMode ? '#222836' : '#ffffff',
      border: isDarkMode ? '#2d3545' : '#e2e8f0',
      textMain: isDarkMode ? '#f1f5f9' : '#1e293b',
      textMuted: isDarkMode ? '#94a3b8' : '#64748b',
      primaryAccent: '#ff5a00',
      danger: '#dc2626',
    }),
    [isDarkMode]
  )

  useEffect(() => {
    if (!open) return

    let cancelled = false
    async function load() {
      setLoading(true)
      setClosing(false)
      const { data } = await supabase.auth.getUser()
      const userId = data.user?.id
      if (!userId) {
        setNotifications([])
        setUnreadCount(0)
        setLoading(false)
        return
      }

      const { data: list } = await supabase
        .from('notifications')
        .select('notification_id,type,message,is_read,created_at,recipient_id')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })

      if (cancelled) return
      const items = (list || []) as AdminNotification[]
      setNotifications(items)
      setUnreadCount(items.filter((n) => !n.is_read).length)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open])



  function closeWithAnimation() {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 260)
  }

  async function dismiss(notificationId: string) {
    // optimistic
    setNotifications((prev) => {
      const target = prev.find((n) => n.notification_id === notificationId)
      const next = prev.filter((n) => n.notification_id !== notificationId)
      if (target && !target.is_read) setUnreadCount((c) => Math.max(0, c - 1))
      return next
    })

    await supabase.from('notifications').delete().eq('notification_id', notificationId)
  }

  if (!open) return null

  return (
    <div
      onClick={closeWithAnimation}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.35)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-start',
      }}
      aria-hidden={!open}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: '95vw',
          height: '100vh',
          background: theme.cardBg,
          borderRight: `1px solid ${theme.border}`,
          boxShadow: '8px 0 32px rgba(15, 23, 42, 0.18)',
          transform: closing ? 'translateX(-105%)' : 'translateX(0%)',
          transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
          display: 'flex',
          flexDirection: 'column',
        }}
        role="dialog"
        aria-label="Notifications"
      >
        <div
          style={{
            padding: '18px 20px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: theme.primaryAccent, display: 'flex', alignItems: 'center' }}>
              <Bell size={18} />
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: theme.textMain }}>Notifications</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: theme.textMuted }}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={closeWithAnimation}
            style={{
              border: `1px solid ${theme.border}`,
              background: 'transparent',
              color: theme.textMuted,
              width: 34,
              height: 34,
              borderRadius: 10,
              cursor: 'pointer',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Close notifications panel"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {loading ? (
            <div style={{ padding: '28px 8px', color: theme.textMuted, fontWeight: 700 }}>Loading…</div>
          ) : notifications.length === 0 ? (
            <div
              style={{
                padding: '40px 16px',
                textAlign: 'center',
                borderRadius: 14,
                border: `1px dashed ${theme.border}`,
                color: theme.textMuted,
                fontWeight: 700,
              }}
            >
              No notifications
            </div>
          ) : (
            notifications.map((n) => {
              const typeColour = getTypeColour(n.type)
              return (
                <div
                  key={n.notification_id}
                  style={{
                    background: n.is_read ? (isDarkMode ? '#1a1f2c' : '#ffffff') : isDarkMode ? '#1f2937' : '#f0f4ff',
                    border: `1px solid ${theme.border}`,
                    borderLeft: `4px solid ${n.is_read ? theme.border : theme.primaryAccent}`,
                    borderRadius: 12,
                    padding: '12px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            background: `${typeColour}1a`,
                            color: typeColour,
                            padding: '3px 8px',
                            borderRadius: 999,
                            fontSize: 9.5,
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {getTypeIcon(n.type)}
                          {getTypeTitle(n.type)}
                        </span>
                        {!n.is_read && (
                          <span
                            style={{
                              background: theme.primaryAccent,
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: 6,
                              fontSize: 8.5,
                              fontWeight: 900,
                              letterSpacing: '0.2px',
                            }}
                          >
                            NEW
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 13.5, fontWeight: 800, color: theme.textMain, lineHeight: 1.35, marginTop: 2 }}>
                        {n.type?.replace('_', ' ') || 'Notification'}
                      </div>

                      <div style={{ fontSize: 12.8, fontWeight: 650, color: theme.textMain, lineHeight: 1.45 }}>
                        {n.message}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => dismiss(n.notification_id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: theme.primaryAccent,
                        cursor: 'pointer',
                        fontWeight: 900,
                        padding: 6,
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Dismiss"
                      aria-label="Dismiss notification"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

