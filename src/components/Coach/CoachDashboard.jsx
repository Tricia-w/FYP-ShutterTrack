import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'
import { Avatar, CoachPageHeader } from './CoachShared'

const PERFORMANCE_FIELDS = ['smash', 'defense', 'footwork', 'drop_shot', 'net_play', 'serve']
const FITNESS_FIELDS = ['stamina', 'speed', 'strength', 'flexibility', 'recovery']

const SKILL_LABELS = {
  smash: 'Smash',
  defense: 'Defense',
  footwork: 'Footwork',
  drop_shot: 'Drop shot',
  net_play: 'Net play',
  serve: 'Serve',
  stamina: 'Stamina',
  speed: 'Speed',
  strength: 'Strength',
  flexibility: 'Flexibility',
  recovery: 'Recovery',
}

const averageValues = (row, fields) => {
  const values = fields
    .map(field => Number(row?.[field]))
    .filter(Number.isFinite)

  return values.length
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0
}

const formatDate = value => {
  if (!value) return '-'

  return new Date(`${value}T00:00:00`).toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const formatTime = value => (value ? String(value).slice(0, 5) : '')

function DashboardIcon({
  type,
  color = 'currentColor',
  size = 18,
}) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  }

  if (type === 'players') {
    return (
      <svg {...props}>
        <circle
          cx="9"
          cy="8"
          r="3"
          stroke={color}
          strokeWidth="1.8"
        />
        <circle
          cx="17"
          cy="9"
          r="2.5"
          stroke={color}
          strokeWidth="1.8"
        />
        <path
          d="M3.5 19c.6-3.2 2.5-5 5.5-5s4.9 1.8 5.5 5"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M14 15c2.8 0 4.7 1.4 5.5 4"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'upcoming') {
    return (
      <svg {...props}>
        <circle
          cx="12"
          cy="12"
          r="8"
          stroke={color}
          strokeWidth="1.8"
        />
        <path
          d="M12 8v4l3 2"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'past') {
    return (
      <svg {...props}>
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke={color}
          strokeWidth="1.8"
        />
        <path
          d="m8 12.5 2.5 2.5L16 9.5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'notes') {
    return (
      <svg {...props}>
        <path
          d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5Z"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M14 3.5V8h4"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9 12h6M9 16h5"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return null
}

function CoachDashboardStats({
  myPlayers = [],
  upcomingSessions = [],
  pastSessions = [],
  notes = [],
}) {
  const stats = [
    {
      label: 'My players',
      value: myPlayers.length,
      color: '#1A5FFF',
      background: '#E8EFFE',
      icon: 'players',
    },
    {
      label: 'Upcoming sessions',
      value: upcomingSessions.length,
      color: '#00976C',
      background: '#DDF8EF',
      icon: 'upcoming',
    },
    {
      label: 'Past sessions',
      value: pastSessions.length,
      color: '#F59E0B',
      background: '#FEF3C7',
      icon: 'past',
    },
    {
      label: 'Total notes',
      value: notes.length,
      color: '#7C3AED',
      background: '#EDE9FE',
      icon: 'notes',
    },
  ]

  return (
    <div className={styles.g4} style={{ marginBottom: 16 }}>
      {stats.map(item => (
        <div key={item.label} className={styles.metric}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: item.background,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <DashboardIcon
              type={item.icon}
              color={item.color}
              size={18}
            />
          </div>

          <div
            className={styles.metricVal}
            style={{
              color: item.color,
              WebkitTextFillColor: item.color,
            }}
          >
            {item.value}
          </div>

          <div className={styles.metricLbl}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CoachDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [students, setStudents] = useState([])
  const [sessions, setSessions] = useState([])
  const [progressRows, setProgressRows] = useState([])
  const [assessments, setAssessments] = useState([])
  const [loading, setLoading] = useState(true)
  const showLoader = useLoadingDelay(loading, 350)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError('')

    try {
      const [
        relationshipRes,
        sessionRes,
        progressRes,
        assessmentRes,
      ] = await Promise.all([
        supabase
          .from('coach_player_relationships')
          .select('player_user_id')
          .eq('coach_user_id', user.id)
          .eq('status', 'accepted'),

        supabase
          .from('coach_training_sessions')
          .select(`
            *,
            coach_training_session_players (
              id,
              player_user_id,
              player_focus
            )
          `)
          .eq('coach_user_id', user.id)
          .order('session_date', { ascending: true })
          .order('start_time', { ascending: true }),

        supabase
          .from('coach_player_progress')
          .select('*')
          .eq('coach_user_id', user.id)
          .order('updated_at', { ascending: false }),

        supabase
          .from('coach_player_assessments')
          .select('*')
          .eq('coach_user_id', user.id)
          .order('updated_at', { ascending: false }),
      ])

      if (relationshipRes.error) {
        console.error('Relationship load error:', relationshipRes.error)
      }

      if (sessionRes.error) {
        console.error('Session load error:', sessionRes.error)
      }

      if (progressRes.error) {
        console.error('Progress load error:', progressRes.error)
      }

      if (assessmentRes.error) {
        console.error('Assessment load error:', assessmentRes.error)
      }

      const playerUserIds = [
        ...new Set(
          (relationshipRes.error ? [] : relationshipRes.data || [])
            .map(row => row.player_user_id)
            .filter(Boolean)
        ),
      ]

      let profiles = []
      let ratings = []

      if (playerUserIds.length) {
        const profileRes = await supabase
          .from('player_profiles')
          .select('*')
          .in('user_id', playerUserIds)
          .order('display_name', { ascending: true })

        if (profileRes.error) {
          console.error(
            'Coach dashboard profile load error:',
            profileRes.error
          )
        } else {
          profiles = profileRes.data || []
        }

        const profileIds = profiles.map(profile => profile.id)

        if (profileIds.length) {
          const ratingRes = await supabase
            .from('player_skill_ratings')
            .select('*')
            .in('player_id', profileIds)

          if (ratingRes.error) {
            console.error('Player rating load error:', ratingRes.error)
          } else {
            ratings = ratingRes.data || []
          }
        }
      }

      const ratingMap = new Map(
        ratings.map(rating => [String(rating.player_id), rating])
      )

      setStudents(
        profiles.map(profile => ({
          id: profile.user_id,
          profileId: profile.id,
          name: profile.display_name || 'Unnamed player',
          club:
            profile.club ||
            profile.state ||
            profile.location ||
            'No club',
          category:
            profile.player_category ||
            profile.category ||
            profile.level ||
            'Category not set',
          avatarUrl:
            profile.profile_photo_url ||
            profile.avatar_url ||
            profile.photo_url ||
            '',
          rating: ratingMap.get(String(profile.id)) || null,
        }))
      )

      setSessions(sessionRes.error ? [] : sessionRes.data || [])
      setProgressRows(progressRes.error ? [] : progressRes.data || [])
      setAssessments(assessmentRes.error ? [] : assessmentRes.data || [])

      const failedSections = [
        relationshipRes.error ? 'players' : null,
        sessionRes.error ? 'sessions' : null,
        progressRes.error ? 'progress' : null,
        assessmentRes.error ? 'assessments' : null,
      ].filter(Boolean)

      if (failedSections.length > 0) {
        setError(
          `Some dashboard sections could not load: ${failedSections.join(
            ', '
          )}. Check the browser console for the exact Supabase error.`
        )
      }
    } catch (loadError) {
      console.error('Coach dashboard load error:', loadError)
      setError(loadError.message || 'Unable to load coach dashboard.')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const today = new Date().toISOString().slice(0, 10)

  const upcomingSessions = useMemo(
    () => sessions.filter(session => session.session_date >= today),
    [sessions, today]
  )

  const pastSessions = useMemo(
    () =>
      [...sessions]
        .filter(session => session.session_date < today)
        .sort((a, b) => b.session_date.localeCompare(a.session_date)),
    [sessions, today]
  )

  const studentMap = useMemo(
    () => new Map(students.map(student => [String(student.id), student])),
    [students]
  )

  const assessmentMap = useMemo(
    () =>
      new Map(
        assessments.map(assessment => [
          String(assessment.player_user_id),
          assessment,
        ])
      ),
    [assessments]
  )

  const progressMap = useMemo(
    () =>
      new Map(
        progressRows.map(progress => [
          String(progress.player_user_id),
          progress,
        ])
      ),
    [progressRows]
  )

  const playerOverview = useMemo(
    () =>
      students.map(student => {
        const coachAssessment =
          assessmentMap.get(String(student.id)) || null

        const performanceAverage = coachAssessment
          ? averageValues(coachAssessment, PERFORMANCE_FIELDS)
          : averageValues(student.rating, PERFORMANCE_FIELDS)

        const fitnessAverage = coachAssessment
          ? averageValues(coachAssessment, FITNESS_FIELDS)
          : 0

        return {
          ...student,
          overallAverage:
            performanceAverage && fitnessAverage
              ? Math.round((performanceAverage + fitnessAverage) / 2)
              : performanceAverage || fitnessAverage || 0,
        }
      }),
    [students, assessmentMap]
  )

  const recentNotes = useMemo(
    () =>
      progressRows
        .filter(
          row =>
            row.coach_comment ||
            row.focus_area ||
            row.progress_status
        )
        .slice(0, 3),
    [progressRows]
  )

  const teamFocus = useMemo(
    () =>
      students.map(student => {
        const source =
          assessmentMap.get(String(student.id)) ||
          student.rating ||
          {}

        const available = [
          ...PERFORMANCE_FIELDS,
          ...FITNESS_FIELDS,
        ].filter(field => Number.isFinite(Number(source[field])))

        if (!available.length) {
          return {
            ...student,
            weakestLabel: 'No assessment yet',
            weakestValue: null,
          }
        }

        const weakestField = [...available].sort(
          (a, b) => Number(source[a]) - Number(source[b])
        )[0]

        return {
          ...student,
          weakestLabel: SKILL_LABELS[weakestField],
          weakestValue: Number(source[weakestField]),
        }
      }),
    [students, assessmentMap]
  )

  if (loading && !showLoader) {
    return null
  }

  if (showLoader) {
    return (
      <div className={styles.card}>
        <Loader text="Loading coach dashboard..." />
      </div>
    )
  }

  return (
    <div>
      <CoachPageHeader
        title="Coach Dashboard"
        subtitle="Manage your players, sessions and track progress"
      />

      <CoachDashboardStats
        myPlayers={students}
        upcomingSessions={upcomingSessions}
        pastSessions={pastSessions}
        notes={progressRows}
      />

      {error && (
        <div
          className={styles.card}
          style={{
            marginBottom: 16,
            padding: 14,
            color: '#B91C1C',
          }}
        >
          {error}
        </div>
      )}

      <div className={styles.g2}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>My players overview</div>

          {playerOverview.length === 0 ? (
            <div
              style={{
                padding: '20px 0',
                fontSize: 13,
                color: 'var(--text-muted, #8892A4)',
              }}
            >
              No accepted students yet.
            </div>
          ) : (
            playerOverview.map(player => (
              <div
                key={player.id}
                className={styles.listRow}
                role="button"
                tabIndex={0}
                onClick={() =>
                  navigate(`/coach/players?player=${player.id}`)
                }
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    navigate(`/coach/players?player=${player.id}`)
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <Avatar name={player.name} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--text, #0D1B3E)',
                    }}
                  >
                    {player.name}
                  </div>

                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 11,
                      color: 'var(--text-muted, #8892A4)',
                    }}
                  >
                    {player.club} · {player.category}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted, #8892A4)',
                    }}
                  >
                    Avg
                  </div>

                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color:
                        player.overallAverage >= 75
                          ? '#00976C'
                          : '#1A5FFF',
                    }}
                  >
                    {player.overallAverage || '-'}
                  </div>
                </div>
              </div>
            ))
          )}

          <button
            className={styles.btnOutline}
            style={{ marginTop: 12 }}
            onClick={() => navigate('/coach/players')}
          >
            View all players →
          </button>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Upcoming sessions</div>

          {upcomingSessions.length === 0 ? (
            <div
              style={{
                padding: '20px 0',
                fontSize: 13,
                color: 'var(--text-muted, #8892A4)',
              }}
            >
              No upcoming sessions.
            </div>
          ) : (
            upcomingSessions.slice(0, 3).map(session => {
              const assignedPlayers =
                session.coach_training_session_players || []

              return (
                <div
                  key={session.id}
                  className={styles.listRow}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    navigate(`/coach/sessions?session=${session.id}`)
                  }
                  onKeyDown={event => {
                    if (
                      event.key === 'Enter' ||
                      event.key === ' '
                    ) {
                      navigate(
                        `/coach/sessions?session=${session.id}`
                      )
                    }
                  }}
                  style={{
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: '#E8EFFE',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: '#1A5FFF',
                        lineHeight: 1,
                      }}
                    >
                      {new Date(
                        `${session.session_date}T00:00:00`
                      ).getDate()}
                    </div>

                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: '#1A5FFF',
                        textTransform: 'uppercase',
                      }}
                    >
                      {new Date(
                        `${session.session_date}T00:00:00`
                      ).toLocaleDateString('en-MY', {
                        month: 'short',
                      })}
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text, #0D1B3E)',
                      }}
                    >
                      {session.session_type}
                    </div>

                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 12,
                        color: 'var(--text-muted, #8892A4)',
                      }}
                    >
                      {session.venue} ·{' '}
                      {formatTime(session.start_time)}
                      {session.end_time
                        ? ` – ${formatTime(session.end_time)}`
                        : ''}
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 11,
                        color: 'var(--text-muted, #8892A4)',
                      }}
                    >
                      {assignedPlayers
                        .map(
                          assignment =>
                            studentMap.get(
                              String(assignment.player_user_id)
                            )?.name
                        )
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          <button
            className={styles.btnOutline}
            style={{ marginTop: 12 }}
            onClick={() => navigate('/coach/sessions')}
          >
            View sessions →
          </button>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Recent coach notes</div>

          {recentNotes.length === 0 ? (
            <div
              style={{
                padding: '20px 0',
                fontSize: 13,
                color: 'var(--text-muted, #8892A4)',
              }}
            >
              No progress notes yet.
            </div>
          ) : (
            recentNotes.map(note => {
              const player = studentMap.get(
                String(note.player_user_id)
              )

              const noteText =
                note.coach_comment ||
                note.focus_area ||
                note.progress_status

              return (
                <div
                  key={note.id}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    navigate(
                      `/coach/progress?player=${note.player_user_id}`
                    )
                  }
                  onKeyDown={event => {
                    if (
                      event.key === 'Enter' ||
                      event.key === ' '
                    ) {
                      navigate(
                        `/coach/progress?player=${note.player_user_id}`
                      )
                    }
                  }}
                  style={{
                    padding: '10px 12px',
                    background: '#F7F9FF',
                    borderRadius: 10,
                    marginBottom: 8,
                    borderLeft: '3px solid #1A5FFF',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      marginBottom: 4,
                      fontSize: 11,
                      color: 'var(--text-muted, #8892A4)',
                    }}
                  >
                    {player?.name || 'Player'} ·{' '}
                    {formatDate(
                      note.updated_at?.slice(0, 10) ||
                        note.created_at?.slice(0, 10)
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text, #0D1B3E)',
                      lineHeight: 1.6,
                    }}
                  >
                    {noteText}
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Team focus</div>

          {teamFocus.length === 0 ? (
            <div
              style={{
                padding: '20px 0',
                fontSize: 13,
                color: 'var(--text-muted, #8892A4)',
              }}
            >
              No student assessment data yet.
            </div>
          ) : (
            teamFocus.map(player => {
              const progress = progressMap.get(String(player.id))

              return (
                <div
                  key={player.id}
                  className={styles.listRow}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    navigate(`/coach/progress?player=${player.id}`)
                  }
                  onKeyDown={event => {
                    if (
                      event.key === 'Enter' ||
                      event.key === ' '
                    ) {
                      navigate(
                        `/coach/progress?player=${player.id}`
                      )
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <Avatar name={player.name} size={32} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text, #0D1B3E)',
                      }}
                    >
                      {player.name}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted, #8892A4)',
                      }}
                    >
                      {progress?.focus_area ? (
                        <>
                          Focus:{' '}
                          <strong>{progress.focus_area}</strong>
                        </>
                      ) : (
                        <>
                          Needs work:{' '}
                          <strong>{player.weakestLabel}</strong>
                          {player.weakestValue !== null
                            ? ` (${player.weakestValue})`
                            : ''}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}

          <button
            className={styles.btnOutline}
            style={{ marginTop: 12 }}
            onClick={() => navigate('/coach/progress')}
          >
            View progress →
          </button>
        </div>
      </div>
    </div>
  )
}