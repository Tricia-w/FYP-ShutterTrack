import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import SkillRadarChart from './SkillRadarChart'
import ExpensePieChart from './ExpensesPie'
import styles from './Pages.module.css'

const SKILL_COLUMNS = [
  { name: 'Smash', column: 'smash' },
  { name: 'Defense', column: 'defense' },
  { name: 'Footwork', column: 'footwork' },
  { name: 'Drop shot', column: 'drop_shot' },
  { name: 'Net play', column: 'net_play' },
  { name: 'Serve', column: 'serve' },
]

const DEFAULT_SKILLS = SKILL_COLUMNS.map(skill => ({
  name: skill.name,
  val: 50,
  low: true,
}))

const EXPENSE_COLORS = ['#1A5FFF', '#00C48C', '#7C3AED', '#F59E0B', '#EF4444', '#8B5CF6']

const getGreeting = () => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const fmtDate = value => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const fmtDateLong = value => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const formatRMNoDecimal = value => `RM ${Math.round(Number(value) || 0)}`

const getInitials = name =>
  (name || '-')
    .trim()
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

const getOpponentName = match => {
  const type = match.match_type || 'Singles'

  if (type === 'Singles') {
    return match.opponent_name || '-'
  }

  return [match.opponent_name, match.opponent_name2].filter(Boolean).join(' & ') || match.opponent_name || '-'
}

const getScore = match => [match.score1, match.score2, match.score3].filter(Boolean).join(', ')

const getCurrentMonthRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

const getLastMonthRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const end = new Date(now.getFullYear(), now.getMonth(), 1)

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

const getMonthTitle = () => {
  const now = new Date()
  return now.toLocaleDateString('en-MY', {
    month: 'long',
    year: 'numeric',
  })
}

const getScheduleBadgeClass = type => {
  const lower = String(type || '').toLowerCase()

  if (lower.includes('competition')) return styles.badgeAmber
  if (lower.includes('friendly')) return styles.badgeGreen
  if (lower.includes('rest')) return styles.badgeGray
  if (lower.includes('recovery')) return styles.badgePurple
  if (lower.includes('training')) return styles.badgeBlue

  return styles.badgeBlue
}

const getNotificationIcon = type => {
  if (type === 'success') return '✅'
  if (type === 'warning') return '⚠️'
  if (type === 'danger') return '🔥'
  return '🔔'
}

const getNotificationBg = type => {
  if (type === 'success') return '#ECFDF5'
  if (type === 'warning') return '#FFFBEB'
  if (type === 'danger') return '#FEF2F2'
  return '#EFF6FF'
}

const getNotificationBorder = type => {
  if (type === 'success') return '#A7F3D0'
  if (type === 'warning') return '#FDE68A'
  if (type === 'danger') return '#FECACA'
  return '#BFDBFE'
}

const formatNotificationTime = value => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [setup, setSetup] = useState(null)
  const [matches, setMatches] = useState([])
  const [skills, setSkills] = useState(DEFAULT_SKILLS)
  const [expenses, setExpenses] = useState([])
  const [lastMonthExpenses, setLastMonthExpenses] = useState([])
  const [fitnessScore, setFitnessScore] = useState(50)
  const [schedule, setSchedule] = useState([])
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)

  const getCurrentAuthUser = useCallback(async () => {
    if (user?.id) return user

    const { data } = await supabase.auth.getUser()
    return data?.user || null
  }, [user])

  const fetchNotifications = useCallback(async () => {
    const authUser = await getCurrentAuthUser()
    if (!authUser) return

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .limit(8)

    if (error) {
      console.log('Fetch notifications error:', error)
      return
    }

    setNotifications(data || [])
  }, [getCurrentAuthUser])

  const markNotificationRead = async id => {
    const authUser = await getCurrentAuthUser()
    if (!authUser) return

    setNotifications(prev =>
      prev.map(item =>
        item.id === id ? { ...item, is_read: true } : item
      )
    )

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', authUser.id)

    if (error) {
      console.log('Mark notification read error:', error)
      fetchNotifications()
    }
  }

  const deleteNotification = async (e, id) => {
    e.stopPropagation()

    const authUser = await getCurrentAuthUser()
    if (!authUser) return

    setNotifications(prev => prev.filter(item => item.id !== id))

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('user_id', authUser.id)

    if (error) {
      console.log('Delete notification error:', error)
      fetchNotifications()
    }
  }

  const clearAllNotifications = async e => {
    e.stopPropagation()

    const authUser = await getCurrentAuthUser()
    if (!authUser) return

    setNotifications([])

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', authUser.id)

    if (error) {
      console.log('Clear notifications error:', error)
      fetchNotifications()
    }
  }

  const markAllNotificationsRead = async e => {
    e.stopPropagation()

    const authUser = await getCurrentAuthUser()
    if (!authUser) return

    setNotifications(prev =>
      prev.map(item => ({
        ...item,
        is_read: true,
      }))
    )

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', authUser.id)

    if (error) {
      console.log('Mark all notifications read error:', error)
      fetchNotifications()
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    const closeNotifications = e => {
      if (!(e.target instanceof Element)) return

      if (!e.target.closest('.dashboard-notification-wrap')) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('click', closeNotifications)

    return () => {
      document.removeEventListener('click', closeNotifications)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const loadDashboard = async () => {
      setLoading(true)

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()

        if (authError || !authData?.user) {
          setLoading(false)
          return
        }

        const authUser = authData.user
        const { start: monthStart, end: monthEnd } = getCurrentMonthRange()
        const { start: lastStart, end: lastEnd } = getLastMonthRange()
        const today = new Date().toISOString().slice(0, 10)

        const [
          appUserRes,
          profileRes,
          setupRes,
          expenseRes,
          lastExpenseRes,
          fitnessRes,
          scheduleRes,
          trainingScheduleRes,
        ] = await Promise.all([
          supabase
            .from('app_users')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle(),

          supabase
            .from('player_profiles')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle(),

          supabase
            .from('player_setup')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle(),

          supabase
            .from('expenses')
            .select('*')
            .eq('user_id', authUser.id)
            .gte('date', monthStart)
            .lt('date', monthEnd),

          supabase
            .from('expenses')
            .select('*')
            .eq('user_id', authUser.id)
            .gte('date', lastStart)
            .lt('date', lastEnd),

          supabase
            .from('fitness_tests')
            .select('*')
            .eq('user_id', authUser.id)
            .order('test_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1),

          supabase
            .from('player_schedule')
            .select('*')
            .eq('user_id', authUser.id)
            .gte('event_date', today)
            .order('event_date', { ascending: true })
            .order('event_time', { ascending: true }),

          supabase
            .from('fitness_training_logs')
            .select('*')
            .eq('user_id', authUser.id)
            .gte('training_date', today)
            .order('training_date', { ascending: true })
            .limit(10),
        ])

        if (appUserRes.error) throw appUserRes.error
        if (profileRes.error) throw profileRes.error
        if (setupRes.error) throw setupRes.error
        if (expenseRes.error) throw expenseRes.error
        if (lastExpenseRes.error) throw lastExpenseRes.error
        if (fitnessRes.error) throw fitnessRes.error
        if (scheduleRes.error) throw scheduleRes.error
        if (trainingScheduleRes.error) throw trainingScheduleRes.error

        let currentProfile = profileRes.data

        if (!currentProfile) {
          const { data: createdProfile, error: createProfileError } = await supabase
            .from('player_profiles')
            .insert({
              user_id: authUser.id,
              display_name: appUserRes.data?.full_name || authUser.email?.split('@')[0] || 'Player',
              info_source: 'Self-reported',
            })
            .select('*')
            .single()

          if (createProfileError) throw createProfileError

          currentProfile = createdProfile
        }

        let matchRows = []
        let rating = null

        if (currentProfile?.id) {
          const [matchesRes, ratingRes] = await Promise.all([
            supabase
              .from('player_matches')
              .select('*')
              .eq('player_id', currentProfile.id)
              .order('match_date', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(20),

            supabase
              .from('player_skill_ratings')
              .select('*')
              .eq('player_id', currentProfile.id)
              .maybeSingle(),
          ])

          if (matchesRes.error) throw matchesRes.error
          if (ratingRes.error) throw ratingRes.error

          matchRows = matchesRes.data || []
          rating = ratingRes.data
        }

        if (!mounted) return

        setProfile(
          currentProfile || {
            display_name: appUserRes.data?.full_name || authUser.email?.split('@')[0] || 'Player',
            club: 'No club',
            state: '',
          }
        )

        setSetup(setupRes.data || null)
        setMatches(matchRows)
        setExpenses(expenseRes.data || [])
        setLastMonthExpenses(lastExpenseRes.data || [])
        setFitnessScore(Number(fitnessRes.data?.[0]?.score ?? 50))

        const scheduleRows = (scheduleRes.data || []).map(item => ({
          id: `schedule-${item.id}`,
          date: item.event_date,
          time: item.event_time || '',
          title: item.title || item.schedule_type || 'Schedule',
          type: item.schedule_type || item.title || 'Schedule',
          location: item.location || '',
          source: 'schedule',
        }))

        const trainingRows = (trainingScheduleRes.data || []).map(item => ({
          id: `training-${item.id}`,
          date: item.training_date,
          time: item.start_time || item.training_time || '',
          title: item.activity || (item.intensity === 'Rest' ? 'Rest Day' : 'Training Log'),
          type: item.intensity === 'Rest' ? 'Rest Day' : 'Training Log',
          location: [item.duration, item.focus].filter(Boolean).join(' · '),
          source: 'training_log',
        }))

        const mergedSchedule = [...scheduleRows, ...trainingRows]
          .filter(item => item.date)
          .sort((a, b) => {
            const dateCompare = String(a.date).localeCompare(String(b.date))
            if (dateCompare !== 0) return dateCompare

            return String(a.time || '').localeCompare(String(b.time || ''))
          })
          .slice(0, 5)

        setSchedule(mergedSchedule)

        if (rating) {
          setSkills(
            SKILL_COLUMNS.map(skill => {
              const value = Number(rating[skill.column] ?? 50)

              return {
                name: skill.name,
                val: value,
                low: value < 75,
              }
            })
          )
        } else {
          setSkills(DEFAULT_SKILLS)
        }
      } catch (error) {
        console.error('Dashboard load error:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadDashboard()

    return () => {
      mounted = false
    }
  }, [user?.id])

  const name = (profile?.display_name || user?.name || user?.email?.split('@')[0] || 'Player').split(' ')[0]
  const weakness = setup?.biggest_weakness || setup?.weakness || profile?.weakness || 'Not set'
  const clubText = profile?.club || profile?.state || 'No club set'
  const unreadCount = notifications.filter(n => !n.is_read).length

  const stats = useMemo(() => {
    const wins = matches.filter(match => match.result === 'Win').length
    const losses = matches.filter(match => match.result === 'Loss').length
    const winRate = matches.length ? Math.round((wins / matches.length) * 100) : 0

    return {
      totalMatches: matches.length,
      wins,
      losses,
      winRate,
    }
  }, [matches])

  const currentMonthSpend = useMemo(
    () => expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [expenses]
  )

  const lastMonthSpend = useMemo(
    () => lastMonthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [lastMonthExpenses]
  )

  const spendDifference = currentMonthSpend - lastMonthSpend

  const expenseBreakdown = useMemo(() => {
    const grouped = expenses.reduce((acc, item) => {
      const category = item.category || 'Other'
      acc[category] = (acc[category] || 0) + Number(item.amount || 0)

      return acc
    }, {})

    const total = Object.values(grouped).reduce((sum, val) => sum + val, 0)

    return Object.entries(grouped).map(([label, val], index) => ({
      label,
      val,
      pct: total ? Math.round((val / total) * 100) : 0,
      color: EXPENSE_COLORS[index % EXPENSE_COLORS.length],
    }))
  }, [expenses])

  const weakestSkill = useMemo(() => {
    const sorted = [...skills].sort((a, b) => a.val - b.val)
    return sorted[0]
  }, [skills])

  return (
    <div style={{ opacity: loading ? 0.65 : 1, transition: 'opacity 160ms ease' }}>
      <div className={styles.pageHead}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div className={styles.pageTitle}>
              {getGreeting()}, {name} 👋
            </div>

            <div className={styles.pageSub}>
              {fmtDateLong(new Date().toISOString())} · {clubText}
            </div>
          </div>

          <div
            className="dashboard-notification-wrap"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              position: 'relative',
            }}
          >
            <button className={styles.btnPrimary} onClick={() => navigate('/performance')}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 1v12M1 7h12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Log Match
            </button>

            <button
              onClick={e => {
                e.stopPropagation()
                setShowNotifications(prev => !prev)
                fetchNotifications()
              }}
              style={{
                width: 46,
                height: 46,
                borderRadius: 14,
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                cursor: 'pointer',
                fontSize: 19,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
                position: 'relative',
              }}
              title="Notifications"
            >
              🔔

              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    background: '#EF4444',
                    color: '#FFFFFF',
                    borderRadius: 999,
                    minWidth: 19,
                    height: 19,
                    fontSize: 10,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 5px',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 56,
                  width: 360,
                  maxHeight: 430,
                  overflowY: 'auto',
                  background: '#FFFFFF',
                  border: '1px solid #EEF1F8',
                  borderRadius: 18,
                  boxShadow: '0 18px 45px rgba(13, 27, 62, 0.14)',
                  padding: 12,
                  zIndex: 999,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: '#0D1B3E',
                    }}
                  >
                    Notifications
                  </div>

                  {notifications.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <button
                        onClick={markAllNotificationsRead}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#1A5FFF',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 800,
                          padding: 0,
                        }}
                      >
                        Mark read
                      </button>

                      <button
                        onClick={clearAllNotifications}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: '#EF4444',
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 800,
                          padding: 0,
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div
                    style={{
                      fontSize: 13,
                      color: '#8892A4',
                      padding: 24,
                      textAlign: 'center',
                    }}
                  >
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      style={{
                        position: 'relative',
                        padding: '12px 40px 12px 12px',
                        borderRadius: 14,
                        cursor: 'pointer',
                        marginBottom: 10,
                        background: getNotificationBg(n.type),
                        border: `1px solid ${getNotificationBorder(n.type)}`,
                        opacity: n.is_read ? 0.68 : 1,
                      }}
                    >
                      <button
                        onClick={e => deleteNotification(e, n.id)}
                        style={{
                          position: 'absolute',
                          top: 9,
                          right: 9,
                          width: 24,
                          height: 24,
                          borderRadius: 8,
                          border: '1px solid rgba(239, 68, 68, 0.18)',
                          background: 'rgba(255, 255, 255, 0.8)',
                          color: '#EF4444',
                          cursor: 'pointer',
                          fontSize: 15,
                          fontWeight: 900,
                          lineHeight: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Delete notification"
                      >
                        ×
                      </button>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontSize: 16 }}>
                          {getNotificationIcon(n.type)}
                        </span>

                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: '#0D1B3E',
                            paddingRight: 4,
                          }}
                        >
                          {n.title}
                        </div>

                        {!n.is_read && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 999,
                              background: '#1A5FFF',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: 13,
                          color: '#64748B',
                          lineHeight: 1.5,
                        }}
                      >
                        {n.message}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: '#94A3B8',
                          marginTop: 8,
                        }}
                      >
                        {formatNotificationTime(n.created_at)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.tip}>
        <strong>Tip:</strong>{' '}
        {weakness !== 'Not set' ? (
          <>
            Your weakness is <strong style={{ color: '#1A5FFF' }}>{weakness}</strong>. Focus on
            targeted drills to improve this area.
          </>
        ) : weakestSkill ? (
          <>
            Your lowest skill is <strong style={{ color: '#1A5FFF' }}>{weakestSkill.name}</strong>.
            Consider adding drills for this area.
          </>
        ) : (
          'Complete your setup and skill ratings to get better tips.'
        )}
      </div>

      <div className={styles.g4} style={{ marginBottom: 16 }}>
        <div className={styles.metricHighlight}>
          <div className={styles.metricIcon} style={{ background: 'rgba(255,255,255,0.12)' }}>
            ⭐
          </div>

          <div className={styles.metricVal} style={{ color: '#fff' }}>
            {stats.totalMatches}
          </div>

          <div className={styles.metricLbl} style={{ color: 'rgba(255,255,255,0.6)' }}>
            Total matches
          </div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#E0FAF3' }}>
            ✓
          </div>

          <div className={styles.metricVal} style={{ color: '#00C48C' }}>
            {stats.winRate}%
          </div>

          <div className={styles.metricLbl}>Win rate</div>

          <div className={styles.deltaUp}>
            {stats.wins}W {stats.losses}L
          </div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#E8EFFE' }}>
            ◷
          </div>

          <div className={styles.metricVal} style={{ color: '#1A5FFF' }}>
            {fitnessScore}
          </div>

          <div className={styles.metricLbl}>Fitness score</div>

          <div className={fitnessScore >= 70 ? styles.deltaUp : styles.deltaDown}>
            {fitnessScore >= 70 ? 'Good condition' : 'Needs improvement'}
          </div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#FEF3C7' }}>
            ▭
          </div>

          <div className={styles.metricVal} style={{ color: '#F59E0B' }}>
            {formatRMNoDecimal(currentMonthSpend)}
          </div>

          <div className={styles.metricLbl}>Monthly spend</div>

          <div className={spendDifference <= 0 ? styles.deltaUp : styles.deltaDown}>
            {spendDifference === 0
              ? 'Same as last month'
              : `${spendDifference > 0 ? '↑' : '↓'} RM ${Math.abs(
                  Math.round(spendDifference)
                )} vs last month`}
          </div>
        </div>
      </div>

      <div className={styles.g2} style={{ marginBottom: 16 }}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Recent Matches</div>

          {matches.length === 0 ? (
            <div
              style={{
                padding: '26px 0',
                textAlign: 'center',
                color: '#8892A4',
                fontSize: 13,
              }}
            >
              No matches logged yet.
            </div>
          ) : (
            matches.slice(0, 3).map(match => {
              const opponent = getOpponentName(match)
              const win = match.result === 'Win'

              return (
                <div key={match.id} className={styles.listRow}>
                  <div className={styles.av}>
                    {getInitials(opponent)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {opponent}
                    </div>

                    <div style={{ fontSize: 11, color: '#8892A4' }}>
                      {match.match_type || 'Singles'} · {fmtDate(match.match_date)}
                    </div>
                  </div>

                  <span className={win ? styles.badgeGreen : styles.badgeRed}>
                    {match.result} {getScore(match)}
                  </span>
                </div>
              )
            })
          )}

          <div style={{ marginTop: 14 }}>
            <button className={styles.btnOutline} onClick={() => navigate('/performance')}>
              View all matches →
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Skill Overview</div>

          <div
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: 12,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: '#8892A4',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: '#1A5FFF',
                  display: 'inline-block',
                }}
              />
              Strong ≥75
            </span>

            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: '#8892A4',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: '#F59E0B',
                  display: 'inline-block',
                }}
              />
              Needs work
            </span>
          </div>

          <div className={styles.chartWrap}>
            <SkillRadarChart skills={skills} />
          </div>

          <div style={{ marginTop: 14 }}>
            <button className={styles.btnOutline} onClick={() => navigate('/performance')}>
              Update skills →
            </button>
          </div>
        </div>
      </div>

      <div className={styles.g2}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            Expense Breakdown — {getMonthTitle()}
          </div>

          {expenseBreakdown.length === 0 ? (
            <div
              style={{
                padding: '34px 0',
                textAlign: 'center',
                color: '#8892A4',
                fontSize: 13,
              }}
            >
              No expenses added this month.
            </div>
          ) : (
            <>
              <div className={styles.chartWrap}>
                <ExpensePieChart expenses={expenseBreakdown} />
              </div>

              <div style={{ marginTop: 14 }}>
                {expenseBreakdown.map(expense => (
                  <div key={expense.label} className={styles.expBarRow}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: expense.color,
                        }}
                      />

                      <span>{expense.label}</span>
                    </div>

                    <div style={{ fontWeight: 700 }}>
                      RM {Number(expense.val).toFixed(2)} · {expense.pct}%
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ marginTop: 14 }}>
            <button className={styles.btnOutline} onClick={() => navigate('/expenses')}>
              View expenses →
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Upcoming Schedule</div>

          {schedule.length === 0 ? (
            <div
              style={{
                padding: '34px 0',
                textAlign: 'center',
                color: '#8892A4',
                fontSize: 13,
              }}
            >
              No upcoming schedule yet.
            </div>
          ) : (
            schedule.map(item => {
              const date = new Date(`${item.date}T00:00:00`)
              const day = Number.isNaN(date.getTime()) ? '-' : date.getDate()

              const month = Number.isNaN(date.getTime())
                ? '-'
                : date.toLocaleDateString('en-MY', { month: 'short' }).toUpperCase()

              const type = item.type || item.title || 'Schedule'

              const time = item.time
                ? item.time.slice(0, 5)
                : item.source === 'training_log'
                  ? 'Training log'
                  : 'No time'

              const place =
                item.location ||
                (item.source === 'training_log' ? 'Completed training record' : 'No venue')

              return (
                <div key={item.id} className={styles.listRow}>
                  <div
                    style={{
                      width: 42,
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        color: '#1A5FFF',
                        fontSize: 22,
                        lineHeight: 1,
                      }}
                    >
                      {day}
                    </div>

                    <div
                      style={{
                        fontSize: 10,
                        color: '#8892A4',
                        fontWeight: 700,
                      }}
                    >
                      {month}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {type}
                    </div>

                    <div style={{ fontSize: 11, color: '#8892A4' }}>
                      {time} · {place}
                    </div>
                  </div>

                  <span className={getScheduleBadgeClass(type)}>
                    {type}
                  </span>
                </div>
              )
            })
          )}

          <div style={{ marginTop: 14 }}>
            <button className={styles.btnOutline} onClick={() => navigate('/fitness')}>
              View schedule →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}