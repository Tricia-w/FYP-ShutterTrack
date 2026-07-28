import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import styles from '../Layout/Pages.module.css'

const NOTIFICATION_TABLE = 'notifications'
const NOTIFICATION_USER_COLUMN = 'user_id'

const initials = name =>
  String(name || 'Player')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

const formatNotificationTime = value => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function TrashIcon({ size = 15 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Avatar({
  name,
  size = 36,
  bg = 'var(--soft-blue, #E8EFFE)',
  color = '#1A5FFF',
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.33,
        fontWeight: 700,
        color,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  )
}

export function LevelBadge({ level }) {
  const map = {
    Advanced: { bg: 'var(--soft-blue, #E8EFFE)', color: '#1A5FFF' },
    Intermediate: { bg: 'var(--soft-green, #E0FAF3)', color: '#00976C' },
    Beginner: { bg: 'var(--soft-yellow, #FEF3C7)', color: '#92400E' },
  }

  const badge = map[level] || map.Beginner

  return (
    <span
      style={{
        background: badge.bg,
        color: badge.color,
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 20,
      }}
    >
      {level}
    </span>
  )
}

export function SkillBar({ label, val, color = '#1A5FFF' }) {
  const safeValue = Math.max(0, Math.min(100, Number(val) || 0))

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
        width: '100%',
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-muted, #8892A4)',
          width: 64,
          flexShrink: 0,
        }}
      >
        {label}
      </span>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: 5,
          background: 'var(--line, #EEF1F8)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${safeValue}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
          }}
        />
      </div>

      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text, #0D1B3E)',
          width: 28,
          flexShrink: 0,
          textAlign: 'right',
        }}
      >
        {safeValue}
      </span>
    </div>
  )
}

function CoachNotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError('')

    const { data, error: loadError } = await supabase
      .from(NOTIFICATION_TABLE)
      .select('*')
      .eq(NOTIFICATION_USER_COLUMN, user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (loadError) {
      console.error('Coach notification load error:', loadError)
      setError('Unable to load notifications.')
      setNotifications([])
    } else {
      setNotifications(data || [])
    }

    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!user?.id) return undefined

    const channel = supabase
      .channel(`coach-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: NOTIFICATION_TABLE,
          filter: `${NOTIFICATION_USER_COLUMN}=eq.${user.id}`,
        },
        () => loadNotifications()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, loadNotifications])

  useEffect(() => {
    const closeOutside = event => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [])

  const unreadCount = useMemo(
    () => notifications.filter(item => !item.is_read).length,
    [notifications]
  )

  const markAllRead = async () => {
    if (!user?.id || unreadCount === 0) return

    const { error: updateError } = await supabase
      .from(NOTIFICATION_TABLE)
      .update({ is_read: true })
      .eq(NOTIFICATION_USER_COLUMN, user.id)
      .eq('is_read', false)

    if (updateError) {
      console.error('Mark notifications read error:', updateError)
      return
    }

    setNotifications(current =>
      current.map(item => ({ ...item, is_read: true }))
    )
  }

  const markOneRead = async notification => {
    if (!notification?.id || notification.is_read) return

    const { error: updateError } = await supabase
      .from(NOTIFICATION_TABLE)
      .update({ is_read: true })
      .eq('id', notification.id)

    if (!updateError) {
      setNotifications(current =>
        current.map(item =>
          item.id === notification.id
            ? { ...item, is_read: true }
            : item
        )
      )
    }
  }

  const deleteOne = async (event, id) => {
    event.stopPropagation()

    const { error: deleteError } = await supabase
      .from(NOTIFICATION_TABLE)
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Delete notification error:', deleteError)
      return
    }

    setNotifications(current => current.filter(item => item.id !== id))
  }

  const clearAll = async () => {
    if (!user?.id || notifications.length === 0) return

    const { error: deleteError } = await supabase
      .from(NOTIFICATION_TABLE)
      .delete()
      .eq(NOTIFICATION_USER_COLUMN, user.id)

    if (deleteError) {
      console.error('Clear notifications error:', deleteError)
      return
    }

    setNotifications([])
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        overflow: 'visible',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label="Coach notifications"
        title="Notifications"
        style={{
          width: 46,
          height: 46,
          padding: 0,
          borderRadius: 12,
          border: '1px solid var(--line, #DCE3F0)',
          background: 'var(--card, #FFFFFF)',
          color: 'var(--text, #0D1B3E)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
          overflow: 'visible',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            lineHeight: 1,
            transform: 'translateY(1px)',
          }}
        >
          🔔
        </span>

        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
                top: -6,
              right: -6,
              minWidth: 20,
              height: 20,
              padding: '0 5px',
              borderRadius: 999,
              background: '#EF4444',
              color: '#FFFFFF',
              fontSize: 10,
              fontWeight: 800,
              lineHeight: '16px',
              textAlign: 'center',
              border: '2px solid var(--card, #FFFFFF)',
              boxSizing: 'border-box',
              zIndex: 20,
              pointerEvents: 'none',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            zIndex: 1000,
            top: 52,
            right: 0,
            width: 'min(360px, calc(100vw - 32px))',
            maxHeight: 480,
            overflow: 'hidden',
            background: 'var(--card, #FFFFFF)',
            border: '1px solid var(--line, #E6EAF2)',
            borderRadius: 14,
            boxShadow: '0 18px 50px rgba(13, 27, 62, 0.18)',
          }}
        >
          <div
            style={{
              padding: '14px 14px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              borderBottom: '1px solid var(--line, #E6EAF2)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--text, #0D1B3E)',
                }}
              >
                Notifications
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: 'var(--text-muted, #8892A4)',
                }}
              >
                {unreadCount} unread
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={markAllRead}
                disabled={unreadCount === 0}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: unreadCount ? '#1A5FFF' : 'var(--text-muted, #8892A4)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: unreadCount ? 'pointer' : 'default',
                }}
              >
                Mark all read
              </button>

              <button
                type="button"
                onClick={clearAll}
                disabled={notifications.length === 0}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: notifications.length ? '#DC2626' : 'var(--text-muted, #8892A4)',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: notifications.length ? 'pointer' : 'default',
                }}
              >
                Clear
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 405, overflowY: 'auto' }}>
            {loading ? (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-muted, #8892A4)',
                }}
              >
                Loading notifications...
              </div>
            ) : error ? (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  fontSize: 12,
                  color: '#DC2626',
                }}
              >
                {error}
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  padding: 28,
                  textAlign: 'center',
                  fontSize: 12,
                  color: 'var(--text-muted, #8892A4)',
                }}
              >
                No notifications yet.
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  role="button"
                  tabIndex={0}
                  onClick={async () => {
                    await markOneRead(notification)
                    setOpen(false)

                    if (notification.action_url) {
                      navigate(notification.action_url)
                    }
                  }}
                  onKeyDown={async event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      await markOneRead(notification)
                      setOpen(false)

                      if (notification.action_url) {
                        navigate(notification.action_url)
                      }
                    }
                  }}
                  style={{
                    padding: '12px 14px',
                    display: 'flex',
                    gap: 10,
                    borderBottom: '1px solid var(--line, #EEF1F8)',
                    background: notification.is_read
                      ? 'var(--card, #FFFFFF)'
                      : 'var(--notification-unread, #F2F6FF)',
                    cursor:
                      notification.action_url || !notification.is_read
                        ? 'pointer'
                        : 'default',
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      marginTop: 6,
                      background: notification.is_read
                        ? 'var(--line, #DCE2EC)'
                        : '#1A5FFF',
                      flexShrink: 0,
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: notification.is_read ? 700 : 800,
                        color: 'var(--text, #0D1B3E)',
                      }}
                    >
                      {notification.title || 'Notification'}
                    </div>

                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 11,
                        lineHeight: 1.5,
                        color: 'var(--text-muted, #8892A4)',
                      }}
                    >
                      {notification.message ||
                        notification.body ||
                        notification.description ||
                        ''}
                    </div>

                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 10,
                        color: 'var(--text-muted, #8892A4)',
                      }}
                    >
                      {formatNotificationTime(notification.created_at)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={event => deleteOne(event, notification.id)}
                    aria-label="Delete notification"
                    title="Delete"
                    style={{
                      width: 28,
                      height: 28,
                      border: 0,
                      borderRadius: 8,
                      background: 'transparent',
                      color: 'var(--text-muted, #8892A4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function CoachPageHeader({ title, subtitle, showActions = true }) {
  const navigate = useNavigate()

  return (
    <div className={styles.pageHead} style={{ overflow: 'visible' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className={styles.pageTitle}>{title}</div>
          <div className={styles.pageSub}>{subtitle}</div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            flexWrap: 'nowrap',
            overflow: 'visible',
            flexShrink: 0,
          }}
        >
          {showActions && (
            <>
              <button
                type="button"
                onClick={() => navigate('/coach/players?find=1')}
                style={{
                  height: 34,
                  minWidth: 104,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: '1px solid #B8C7E6',
                  background: 'var(--card, #FFFFFF)',
                  color: 'var(--text, #0D1B3E)',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Find player
              </button>

              <button
                type="button"
                onClick={() => navigate('/coach/sessions?add=1')}
                style={{
                  height: 34,
                  minWidth: 118,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: '1px solid #1A5FFF',
                  background: '#1A5FFF',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 10px rgba(26, 95, 255, 0.16)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    color: '#13E38C',
                    fontSize: 22,
                    fontWeight: 400,
                    lineHeight: 1,
                    marginTop: -1,
                  }}
                >
                  +
                </span>
                Add session
              </button>
            </>
          )}

          <CoachNotificationBell />
        </div>
      </div>
    </div>
  )
}

export function CoachStats({
  myPlayers = [],
  upcomingSessions = [],
  pastSessions = [],
  notes = [],
}) {
  const stats = [
    {
      label: 'My players',
      val: myPlayers.length,
      color: '#1A5FFF',
      bg: 'var(--soft-blue, #E8EFFE)',
    },
    {
      label: 'Upcoming sessions',
      val: upcomingSessions.length,
      color: '#00976C',
      bg: 'var(--soft-green, #E0FAF3)',
    },
    {
      label: 'Past sessions',
      val: pastSessions.length,
      color: '#F59E0B',
      bg: 'var(--soft-yellow, #FEF3C7)',
    },
    {
      label: 'Total notes',
      val: notes.length,
      color: '#7C3AED',
      bg: 'var(--soft-purple, #EDE9FE)',
    },
  ]

  return (
    <div className={styles.g4} style={{ marginBottom: 16 }}>
      {stats.map(stat => (
        <div key={stat.label} className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: stat.bg }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: stat.color,
              }}
            />
          </div>

          <div className={styles.metricVal} style={{ color: stat.color }}>
            {stat.val}
          </div>

          <div className={styles.metricLbl}>{stat.label}</div>
        </div>
      ))}
    </div>
  )
}