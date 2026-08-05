import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'
import { CoachPageHeader } from './CoachShared'

const SESSION_TYPES = [
  'Footwork Drills',
  'Smash Training',
  'Defense Drills',
  'Match Practice',
  'Net Play',
  'Fitness & Conditioning',
  'Strategy Session',
]

const emptyForm = () => ({
  date: '',
  startTime: '',
  endTime: '',
  duration: '',
  venue: '',
  type: SESSION_TYPES[0],
  players: [],
  notes: '',
  playerFocus: {},
})

const formatTime = value => {
  if (!value) return ''
  return String(value).slice(0, 5)
}

const parseDurationMinutes = value => {
  const text = String(value || '').toLowerCase().trim()
  if (!text) return 0

  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*h/)
  const minuteMatch = text.match(/(\d+)\s*(?:min|m)\b/)

  const hours = hourMatch ? Number(hourMatch[1]) : 0
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0

  if (hourMatch || minuteMatch) {
    return Math.round(hours * 60 + minutes)
  }

  const numeric = Number(
    text.match(/\d+(?:\.\d+)?/)?.[0] || 0
  )

  return Number.isFinite(numeric) ? numeric : 0
}

const calculateEndTime = (startTime, durationValue) => {
  const durationMinutes =
    parseDurationMinutes(durationValue)

  if (!startTime || durationMinutes <= 0) return ''

  const [hour, minute] = String(startTime)
    .slice(0, 5)
    .split(':')
    .map(Number)

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return ''
  }

  const totalMinutes =
    (hour * 60 + minute + durationMinutes) %
    (24 * 60)

  const endHour = Math.floor(totalMinutes / 60)
  const endMinute = totalMinutes % 60

  return `${String(endHour).padStart(2, '0')}:${String(
    endMinute
  ).padStart(2, '0')}`
}

const calculateDuration = (start, end) => {
  if (!start || !end) return ''

  const [startHour, startMinute] = String(start)
    .split(':')
    .map(Number)
  const [endHour, endMinute] = String(end)
    .split(':')
    .map(Number)

  if (
    [startHour, startMinute, endHour, endMinute].some(
      Number.isNaN
    )
  ) {
    return ''
  }

  let totalMinutes =
    endHour * 60 +
    endMinute -
    (startHour * 60 + startMinute)

  if (totalMinutes < 0) totalMinutes += 24 * 60

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours && minutes) return `${hours}h ${minutes}min`
  if (hours) return `${hours}h`
  return `${minutes}min`
}

function SessionIcon({
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

  if (type === 'students') {
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

  if (type === 'completed') {
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

  if (type === 'places') {
    return (
      <svg {...props}>
        <path
          d="M4 17 9 12l3 3 7-8"
          stroke={color}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 7h4v4"
          stroke={color}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return null
}


export default function CoachSessions() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [students, setStudents] = useState([])
  const [sessions, setSessions] = useState([])
  const [showAddSession, setShowAddSession] = useState(false)
  const [sessionForm, setSessionForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const showLoader = useLoadingDelay(loading, 350)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [error, setError] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState('')

  const loadData = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError('')

    try {
      const [relationshipRes, sessionRes] = await Promise.all([
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
              player_focus,
              attendance_status,
              completed_at
            )
          `)
          .eq('coach_user_id', user.id)
          .order('session_date', { ascending: true })
          .order('start_time', { ascending: true }),
      ])

      if (relationshipRes.error) throw relationshipRes.error
      if (sessionRes.error) throw sessionRes.error

      const playerUserIds = [
        ...new Set(
          (relationshipRes.data || [])
            .map(row => row.player_user_id)
            .filter(Boolean)
        ),
      ]

      let profileRows = []

      if (playerUserIds.length > 0) {
        const { data, error: profileError } = await supabase
          .from('player_profiles')
          .select('id, user_id, display_name, club, profile_photo_url')
          .in('user_id', playerUserIds)
          .order('display_name', { ascending: true })

        if (profileError) throw profileError
        profileRows = data || []
      }

      setStudents(
        profileRows.map(profile => ({
          id: profile.user_id,
          profileId: profile.id,
          name: profile.display_name || 'Unnamed player',
          club: profile.club || 'No club',
          avatarUrl: profile.profile_photo_url || '',
        }))
      )

      setSessions(sessionRes.data || [])
    } catch (loadError) {
      console.error('Coach sessions load error:', loadError)
      setError(loadError.message || 'Unable to load training sessions.')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setSessionForm(current => ({
        ...current,
        date: current.date || selectedDate || '',
      }))
      setShowAddSession(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, selectedDate, setSearchParams])

  const studentMap = useMemo(
    () => new Map(students.map(student => [String(student.id), student])),
    [students]
  )

  const upcomingSessions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)

    return sessions.filter(session => {
      const assignments =
        session.coach_training_session_players || []

      const allFinalised =
        assignments.length > 0 &&
        assignments.every(assignment =>
          ['completed', 'absent'].includes(
            assignment.attendance_status
          )
        )

      return session.session_date >= today && !allFinalised
    })
  }, [sessions])

  const completedSessions = useMemo(() => {
    return [...sessions]
      .filter(session => {
        const assignments =
          session.coach_training_session_players || []

        return (
          assignments.length > 0 &&
          assignments.every(assignment =>
            ['completed', 'absent'].includes(
              assignment.attendance_status
            )
          )
        )
      })
      .sort((a, b) =>
        b.session_date.localeCompare(a.session_date)
      )
  }, [sessions])

  const pastSessions = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)

    return [...sessions]
      .filter(session => {
        const assignments =
          session.coach_training_session_players || []

        const allFinalised =
          assignments.length > 0 &&
          assignments.every(assignment =>
            ['completed', 'absent'].includes(
              assignment.attendance_status
            )
          )

        return session.session_date < today && !allFinalised
      })
      .sort((a, b) =>
        b.session_date.localeCompare(a.session_date)
      )
  }, [sessions])

  const toggleSessionPlayer = playerId => {
    setSessionForm(current => {
      const selected = current.players.includes(playerId)

      const nextFocus = { ...current.playerFocus }
      if (selected) delete nextFocus[playerId]

      return {
        ...current,
        players: selected
          ? current.players.filter(id => id !== playerId)
          : [...current.players, playerId],
        playerFocus: nextFocus,
      }
    })
  }

  const selectAllStudents = () => {
    setSessionForm(current => ({
      ...current,
      players: students.map(student => student.id),
    }))
  }

  const clearStudents = () => {
    setSessionForm(current => ({
      ...current,
      players: [],
      playerFocus: {},
    }))
  }

  const handleSave = async () => {
    if (saving) return

    if (
      !sessionForm.date ||
      !sessionForm.startTime ||
      !sessionForm.endTime ||
      !sessionForm.venue.trim() ||
      sessionForm.players.length === 0
    ) {
      setError(
        'Choose a date, start time, end time, venue, and at least one student.'
      )
      return
    }

    setSaving(true)
    setError('')

    try {
      const { data: session, error: sessionError } = await supabase
        .from('coach_training_sessions')
        .insert({
          coach_user_id: user.id,
          session_date: sessionForm.date,
          start_time: sessionForm.startTime,
          end_time: sessionForm.endTime || null,
          venue: sessionForm.venue.trim(),
          session_type: sessionForm.type,
          group_notes: sessionForm.notes.trim() || null,
        })
        .select('*')
        .single()

      if (sessionError) throw sessionError

      const assignments = sessionForm.players.map(playerUserId => ({
        session_id: session.id,
        player_user_id: playerUserId,
        player_focus:
          sessionForm.playerFocus[playerUserId]?.trim() || null,
        attendance_status: 'scheduled',
        completed_at: null,
      }))

      const { error: assignmentError } = await supabase
        .from('coach_training_session_players')
        .insert(assignments)

      if (assignmentError) {
        await supabase
          .from('coach_training_sessions')
          .delete()
          .eq('id', session.id)
        throw assignmentError
      }

      setSessionForm(emptyForm())
      setShowAddSession(false)
      await loadData()
    } catch (saveError) {
      console.error('Save training session error:', saveError)
      setError(saveError.message || 'Unable to save training session.')
    } finally {
      setSaving(false)
    }
  }

  const updatePlayerAttendance = async (
    session,
    assignment,
    nextStatus
  ) => {
    if (saving || !session?.id || !assignment?.id) return

    setSaving(true)
    setError('')

    try {
      const completedAt =
        nextStatus === 'completed'
          ? new Date().toISOString()
          : null

      const { error: attendanceError } = await supabase
        .from('coach_training_session_players')
        .update({
          attendance_status: nextStatus,
          completed_at: completedAt,
        })
        .eq('id', assignment.id)
        .eq('session_id', session.id)

      if (attendanceError) throw attendanceError

      if (nextStatus === 'completed') {
        const duration = calculateDuration(
          session.start_time,
          session.end_time
        )

        const playerName =
          studentMap.get(
            String(assignment.player_user_id)
          )?.name || 'Player'

        const notes = [
          `Coach session: ${session.session_type}`,
          session.venue ? `Venue: ${session.venue}` : '',
          session.group_notes || '',
          assignment.player_focus
            ? `Individual focus: ${assignment.player_focus}`
            : '',
        ]
          .filter(Boolean)
          .join('\n')

        const trainingLogPayload = {
          user_id: assignment.player_user_id,
          coach_session_id: session.id,
          training_date: session.session_date,
          start_time: session.start_time,
          end_time: session.end_time,
          activity: session.session_type,
          duration,
          intensity: 'Medium',
          focus:
            assignment.player_focus ||
            session.session_type,
          notes,
          updated_at: new Date().toISOString(),
        }

        const { data: existingLog, error: existingLogError } =
          await supabase
            .from('fitness_training_logs')
            .select('id')
            .eq('user_id', assignment.player_user_id)
            .eq('coach_session_id', session.id)
            .maybeSingle()

        if (existingLogError) {
          throw new Error(
            `${playerName}: ${existingLogError.message}`
          )
        }

        const logQuery = existingLog?.id
          ? supabase
              .from('fitness_training_logs')
              .update(trainingLogPayload)
              .eq('id', existingLog.id)
          : supabase
              .from('fitness_training_logs')
              .insert(trainingLogPayload)

        const { error: logError } = await logQuery

        if (logError) {
          throw new Error(
            `${playerName}: ${logError.message}`
          )
        }

        const { error: scheduleDeleteError } = await supabase
          .from('player_schedule')
          .delete()
          .eq('user_id', assignment.player_user_id)
          .eq('coach_session_id', session.id)

        if (scheduleDeleteError) {
          console.error(
            'Unable to remove completed player schedule:',
            scheduleDeleteError
          )
        }
      }

      if (nextStatus === 'absent') {
        const { error: logDeleteError } = await supabase
          .from('fitness_training_logs')
          .delete()
          .eq('user_id', assignment.player_user_id)
          .eq('coach_session_id', session.id)

        if (logDeleteError) {
          console.error(
            'Unable to remove player training log:',
            logDeleteError
          )
        }

        const { error: scheduleDeleteError } = await supabase
          .from('player_schedule')
          .delete()
          .eq('user_id', assignment.player_user_id)
          .eq('coach_session_id', session.id)

        if (scheduleDeleteError) {
          console.error(
            'Unable to remove absent player schedule:',
            scheduleDeleteError
          )
        }
      }

      await loadData()
    } catch (attendanceError) {
      console.error(
        'Update player attendance error:',
        attendanceError
      )
      setError(
        attendanceError.message ||
          'Unable to update attendance.'
      )
    } finally {
      setSaving(false)
    }
  }

  const requestDeleteSession = session => {
    setDeleteTarget(session)
    setError('')
  }

  const confirmDeleteSession = async () => {
    if (!deleteTarget?.id || deleting) return

    setDeleting(true)
    setError('')

    const [
      scheduleDeleteResult,
      trainingLogDeleteResult,
    ] = await Promise.all([
      supabase
        .from('player_schedule')
        .delete()
        .eq('coach_session_id', deleteTarget.id),

      supabase
        .from('fitness_training_logs')
        .delete()
        .eq('coach_session_id', deleteTarget.id),
    ])

    if (scheduleDeleteResult.error) {
      console.error(
        'Unable to remove linked player schedules:',
        scheduleDeleteResult.error
      )
    }

    if (trainingLogDeleteResult.error) {
      console.error(
        'Unable to remove linked training logs:',
        trainingLogDeleteResult.error
      )
    }

    const { error: deleteError } = await supabase
      .from('coach_training_sessions')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('coach_user_id', user.id)

    if (deleteError) {
      setError(deleteError.message)
      setDeleting(false)
      return
    }

    setDeleteTarget(null)
    setDeleting(false)
    await loadData()
  }

  const monthTitle = calendarMonth.toLocaleDateString('en-MY', {
    month: 'long',
    year: 'numeric',
  })

  const calendarCells = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const leading = firstDay.getDay()
    const cells = []

    for (let index = 0; index < leading; index += 1) {
      cells.push(null)
    }

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(year, month, day)
      const value = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-')

      cells.push({
        day,
        value,
        sessions: sessions.filter(session => session.session_date === value),
      })
    }

    while (cells.length % 7 !== 0) {
      cells.push(null)
    }

    return cells
  }, [calendarMonth, sessions])

  const selectedDaySessions = useMemo(
    () =>
      selectedDate
        ? sessions.filter(session => session.session_date === selectedDate)
        : [],
    [selectedDate, sessions]
  )

  const moveMonth = amount => {
    setCalendarMonth(current =>
      new Date(current.getFullYear(), current.getMonth() + amount, 1)
    )
    setSelectedDate('')
  }

  const renderSession = (session, fallbackStatus) => {
    const assignments =
      session.coach_training_session_players || []

    const completedCount = assignments.filter(
      assignment =>
        assignment.attendance_status === 'completed'
    ).length

    const absentCount = assignments.filter(
      assignment =>
        assignment.attendance_status === 'absent'
    ).length

    const allFinalised =
      assignments.length > 0 &&
      completedCount + absentCount === assignments.length

    const status = allFinalised
      ? 'Completed'
      : fallbackStatus

    return (
      <div
        key={session.id}
        className={styles.listRow}
        style={{
          alignItems: 'flex-start',
          paddingTop: 12,
          paddingBottom: 12,
          opacity: status === 'Completed' ? 0.74 : 1,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background:
              status === 'Completed'
                ? 'var(--soft, #F3F4F6)'
                : 'color-mix(in srgb, #1A5FFF 14%, var(--card, #FFFFFF))',
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
              color:
                status === 'Completed'
                  ? 'var(--text-muted, #6B7280)'
                  : '#1A5FFF',
            }}
          >
            {new Date(`${session.session_date}T00:00:00`).getDate()}
          </div>

          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color:
                status === 'Completed'
                  ? 'var(--text-muted, #6B7280)'
                  : '#1A5FFF',
              textTransform: 'uppercase',
            }}
          >
            {new Date(`${session.session_date}T00:00:00`).toLocaleDateString(
              'en-MY',
              { month: 'short' }
            )}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--text, #0D1B3E)',
            }}
          >
            {session.session_type}
          </div>

          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted, #8892A4)',
              marginTop: 2,
            }}
          >
            {session.venue} · {formatTime(session.start_time)}
            {session.end_time
              ? ` – ${formatTime(session.end_time)}`
              : ''}
          </div>

          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted, #8892A4)',
              marginTop: 5,
            }}
          >
            {assignments
              .map(assignment =>
                studentMap.get(String(assignment.player_user_id))?.name
              )
              .filter(Boolean)
              .join(', ')}
          </div>

          {session.group_notes && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted, #6B7280)',
                marginTop: 5,
                fontStyle: 'italic',
              }}
            >
              {session.group_notes}
            </div>
          )}

          {assignments.length > 0 && (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
              }}
            >
              {assignments.map(item => {
                const player =
                  studentMap.get(
                    String(item.player_user_id)
                  )

                const attendance =
                  item.attendance_status || 'scheduled'

                const attendanceColor =
                  attendance === 'completed'
                    ? '#10B981'
                    : attendance === 'absent'
                      ? '#EF4444'
                      : '#1A5FFF'

                const attendanceBackground =
                  attendance === 'completed'
                    ? '#DDF8EF'
                    : attendance === 'absent'
                      ? '#FEE2E2'
                      : '#E8EFFE'

                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 9px',
                      borderRadius: 10,
                      background:
                        'var(--soft, #F6F8FF)',
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color:
                            'var(--text, #0D1B3E)',
                        }}
                      >
                        {player?.name || 'Player'}
                      </div>

                      {item.player_focus && (
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 10,
                            color:
                              'var(--text-muted, #8892A4)',
                          }}
                        >
                          {item.player_focus}
                        </div>
                      )}
                    </div>

                    <span
                      style={{
                        borderRadius: 999,
                        padding: '3px 8px',
                        background:
                          attendanceBackground,
                        color: attendanceColor,
                        fontSize: 9,
                        fontWeight: 800,
                        textTransform: 'capitalize',
                      }}
                    >
                      {attendance === 'completed'
                        ? 'Completed'
                        : attendance === 'absent'
                          ? 'Absent'
                          : 'Scheduled'}
                    </span>

                    {attendance !== 'completed' && (
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        disabled={saving}
                        onClick={() =>
                          updatePlayerAttendance(
                            session,
                            item,
                            'completed'
                          )
                        }
                        style={{
                          padding: '6px 9px',
                          fontSize: 10,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Mark complete
                      </button>
                    )}

                    {attendance !== 'absent' && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          updatePlayerAttendance(
                            session,
                            item,
                            'absent'
                          )
                        }
                        style={{
                          border:
                            '1px solid #FCA5A5',
                          borderRadius: 8,
                          background: '#FEF2F2',
                          color: '#DC2626',
                          padding: '6px 9px',
                          fontSize: 10,
                          fontWeight: 800,
                          cursor: saving
                            ? 'wait'
                            : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Absent
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              background:
                status === 'Completed'
                  ? 'var(--soft, #F3F4F6)'
                  : 'color-mix(in srgb, #00C48C 14%, var(--card, #FFFFFF))',
              color:
                status === 'Completed'
                  ? 'var(--text-muted, #6B7280)'
                  : '#00976C',
              fontSize: 9,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 20,
            }}
          >
            {status}
          </span>

          <button
            type="button"
            className={styles.btnIconRed}
            onClick={() => requestDeleteSession(session)}
            title="Delete session"
          >
            <svg
              width="15"
              height="15"
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
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <CoachPageHeader
        title="Training Sessions"
        subtitle="Schedule individual or group sessions for your accepted students"
      />

      <div className={styles.g4} style={{ marginBottom: 16 }}>
        {[
          {
            label: 'My students',
            value: students.length,
            color: '#1A5FFF',
            background: '#E8EFFE',
            icon: 'students',
          },
          {
            label: 'Upcoming sessions',
            value: upcomingSessions.length,
            color: '#00976C',
            background: '#DDF8EF',
            icon: 'upcoming',
          },
          {
            label: 'Completed sessions',
            value: completedSessions.length,
            color: '#F59E0B',
            background: '#FEF3C7',
            icon: 'completed',
          },
          {
            label: 'Assigned places',
            value: sessions.reduce(
              (sum, session) =>
                sum +
                (session
                  .coach_training_session_players
                  ?.length || 0),
              0
            ),
            color: '#7C3AED',
            background: '#EDE9FE',
            icon: 'places',
          },
        ].map(item => (
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
              <SessionIcon
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

      {error && (
        <div
          className={styles.card}
          style={{
            marginBottom: 10,
            padding: 14,
            color: '#B91C1C',
            background:
              'color-mix(in srgb, #EF4444 9%, var(--card, #FFFFFF))',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        showLoader ? (
          <div className={styles.card}>
            <Loader text="Loading training sessions..." />
          </div>
        ) : null
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={styles.card}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 16,
                marginBottom: 10,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div className={styles.cardTitle}>Training calendar</div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted, #8892A4)',
                    marginTop: 3,
                  }}
                >
                  View all individual and group training sessions by date
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginLeft: 'auto',
                }}
              >
                <button
                  type="button"
                  onClick={() => moveMonth(-1)}
                  aria-label="Previous month"
                  style={{
                    width: 32,
                    height: 32,
                    padding: 0,
                    borderRadius: 10,
                    border: '1px solid var(--line, #D7DEEA)',
                    background: 'var(--card, #FFFFFF)',
                    color: 'var(--text, #0D1B3E)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    lineHeight: 1,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  ‹
                </button>

                <div
                  style={{
                    width: 125,
                    textAlign: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'var(--text, #0D1B3E)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {monthTitle}
                </div>

                <button
                  type="button"
                  onClick={() => moveMonth(1)}
                  aria-label="Next month"
                  style={{
                    width: 32,
                    height: 32,
                    padding: 0,
                    borderRadius: 10,
                    border: '1px solid var(--line, #D7DEEA)',
                    background: 'var(--card, #FFFFFF)',
                    color: 'var(--text, #0D1B3E)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    lineHeight: 1,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  ›
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: 6,
                marginBottom: 6,
              }}
            >
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div
                  key={day}
                  style={{
                    textAlign: 'center',
                    fontSize: 9,
                    fontWeight: 800,
                    color: 'var(--text-muted, #8892A4)',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: 6,
              }}
            >
              {calendarCells.map((cell, index) => {
                if (!cell) {
                  return (
                    <div
                      key={`empty-${index}`}
                      style={{ minHeight: 58 }}
                    />
                  )
                }

                const isSelected = selectedDate === cell.value
                const isToday =
                  cell.value === new Date().toISOString().slice(0, 10)

                return (
                  <button
                    key={cell.value}
                    type="button"
                    onClick={() => {
                      setSelectedDate(cell.value)
                      setSessionForm(current => ({
                        ...current,
                        date: cell.value,
                      }))
                    }}
                    style={{
                      minHeight: 58,
                      borderRadius: 14,
                      border: isSelected
                        ? '2px solid #1A5FFF'
                        : isToday
                          ? '1px solid #1A5FFF'
                          : '1px solid var(--line, #E6EAF2)',
                      background: isSelected
                        ? 'color-mix(in srgb, #1A5FFF 10%, var(--card, #FFFFFF))'
                        : 'var(--card, #FFFFFF)',
                      padding: 7,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: isToday
                          ? '#1A5FFF'
                          : 'var(--text, #0D1B3E)',
                      }}
                    >
                      {cell.day}
                    </div>

                    {cell.sessions.slice(0, 2).map(session => (
                      <div
                        key={session.id}
                        style={{
                          fontSize: 10,
                          lineHeight: 1.3,
                          borderRadius: 8,
                          padding: '3px 5px',
                          background:
                            'color-mix(in srgb, #1A5FFF 12%, var(--card, #FFFFFF))',
                          color: '#1A5FFF',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={`${session.session_type} · ${formatTime(
                          session.start_time
                        )}`}
                      >
                        {formatTime(session.start_time)} {session.session_type}
                      </div>
                    ))}

                    {cell.sessions.length > 2 && (
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-muted, #8892A4)',
                          fontWeight: 700,
                        }}
                      >
                        +{cell.sessions.length - 2} more
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {selectedDate && (
              <div
                style={{
                  marginTop: 12,
                  paddingTop: 10,
                  borderTop: '1px solid var(--line, #EEF1F8)',
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--text, #0D1B3E)',
                    marginBottom: 8,
                  }}
                >
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString(
                    'en-MY',
                    {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    }
                  )}
                </div>

                {selectedDaySessions.length === 0 ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted, #8892A4)',
                    }}
                  >
                    No training sessions on this date.
                  </div>
                ) : (
                  selectedDaySessions.map(session =>
                    renderSession(
                      session,
                      session.session_date <
                        new Date().toISOString().slice(0, 10)
                        ? 'Awaiting completion'
                        : 'Upcoming'
                    )
                  )
                )}
              </div>
            )}
          </div>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Upcoming sessions</div>
            {upcomingSessions.length === 0 ? (
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted, #8892A4)',
                  textAlign: 'center',
                  padding: '20px 0',
                }}
              >
                No upcoming sessions.
              </div>
            ) : (
              upcomingSessions.map(session =>
                renderSession(session, 'Upcoming')
              )
            )}
          </div>

          {pastSessions.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>
                Awaiting completion
              </div>

              <div
                style={{
                  marginBottom: 10,
                  fontSize: 11,
                  color:
                    'var(--text-muted, #8892A4)',
                }}
              >
                Mark each assigned player as completed or absent.
              </div>

              {pastSessions.map(session =>
                renderSession(
                  session,
                  'Awaiting completion'
                )
              )}
            </div>
          )}

          {completedSessions.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>
                Completed sessions
              </div>

              {completedSessions.map(session =>
                renderSession(
                  session,
                  'Completed'
                )
              )}
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-session-title"
          onClick={event => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteTarget(null)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 440 }}
          >
            <div className={styles.modalHead}>
              <div>
                <div
                  id="delete-session-title"
                  className={styles.modalTitle}
                >
                  Delete training session?
                </div>
                <div
                  style={{
                    marginTop: 5,
                    fontSize: 12,
                    color: 'var(--text-muted, #8892A4)',
                  }}
                >
                  This removes the session for every assigned student.
                </div>
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                aria-label="Close delete confirmation"
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                padding: 14,
                borderRadius: 14,
                background:
                  'color-mix(in srgb, #EF4444 8%, var(--card, #FFFFFF))',
                border:
                  '1px solid color-mix(in srgb, #EF4444 25%, var(--line, #EEF1F8))',
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background:
                    'color-mix(in srgb, #EF4444 14%, var(--card, #FFFFFF))',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  width="18"
                  height="18"
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
              </div>

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'var(--text, #0D1B3E)',
                  }}
                >
                  {deleteTarget.session_type}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    lineHeight: 1.6,
                    color: 'var(--text-muted, #8892A4)',
                  }}
                >
                  {deleteTarget.venue} · {formatTime(deleteTarget.start_time)}
                  {deleteTarget.end_time
                    ? ` – ${formatTime(deleteTarget.end_time)}`
                    : ''}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmDeleteSession}
                disabled={deleting}
                style={{
                  border: 'none',
                  borderRadius: 10,
                  padding: '9px 16px',
                  background: '#DC2626',
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: deleting ? 'wait' : 'pointer',
                  opacity: deleting ? 0.65 : 1,
                }}
              >
                {deleting ? 'Deleting...' : 'Delete session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddSession && (
        <div
          className={styles.modalOverlay}
          onClick={event =>
            event.target === event.currentTarget &&
            setShowAddSession(false)
          }
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Add training session
              </div>
              <button
                className={styles.modalClose}
                onClick={() => setShowAddSession(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Date</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={sessionForm.date}
                  onChange={event =>
                    setSessionForm(current => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Start time</label>
                <input
                  className={styles.formInput}
                  type="time"
                  value={sessionForm.startTime}
                  onChange={event => {
                    const nextStartTime = event.target.value

                    setSessionForm(current => ({
                      ...current,
                      startTime: nextStartTime,
                      endTime: current.duration
                        ? calculateEndTime(
                            nextStartTime,
                            current.duration
                          )
                        : current.endTime,
                    }))
                  }}
                />
              </div>
            </div>

            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>End time</label>
                <input
                  className={styles.formInput}
                  type="time"
                  value={sessionForm.endTime}
                  onChange={event => {
                    const nextEndTime = event.target.value

                    setSessionForm(current => ({
                      ...current,
                      endTime: nextEndTime,
                      duration: current.startTime
                        ? calculateDuration(
                            current.startTime,
                            nextEndTime
                          )
                        : current.duration,
                    }))
                  }}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Session type</label>
                <select
                  className={styles.formSelect}
                  value={sessionForm.type}
                  onChange={event =>
                    setSessionForm(current => ({
                      ...current,
                      type: event.target.value,
                    }))
                  }
                >
                  {SESSION_TYPES.map(type => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Duration
              </label>

              <input
                className={styles.formInput}
                value={
                  sessionForm.duration ||
                  calculateDuration(
                    sessionForm.startTime,
                    sessionForm.endTime
                  )
                }
                onChange={event => {
                  const nextDuration = event.target.value

                  setSessionForm(current => ({
                    ...current,
                    duration: nextDuration,
                    endTime: calculateEndTime(
                      current.startTime,
                      nextDuration
                    ),
                  }))
                }}
                placeholder="e.g. 2h, 1h 30min or 45min"
              />

              <div
                style={{
                  marginTop: 5,
                  fontSize: 10,
                  color: 'var(--text-muted, #8892A4)',
                }}
              >
                Entering a duration automatically sets the end time.
                Changing the end time recalculates the duration.
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Venue</label>
              <input
                className={styles.formInput}
                placeholder="e.g. Dewan Sukan USM"
                value={sessionForm.venue}
                onChange={event =>
                  setSessionForm(current => ({
                    ...current,
                    venue: event.target.value,
                  }))
                }
              />
            </div>

            <div className={styles.formRow}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <label
                  className={styles.formLabel}
                  style={{ marginBottom: 0 }}
                >
                  Students attending
                </label>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className={styles.btnOutline}
                    style={{ padding: '5px 10px', fontSize: 11 }}
                    onClick={selectAllStudents}
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className={styles.btnOutline}
                    style={{ padding: '5px 10px', fontSize: 11 }}
                    onClick={clearStudents}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {students.map(student => {
                  const selected = sessionForm.players.includes(student.id)

                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => toggleSessionPlayer(student.id)}
                      style={{
                        border: selected
                          ? '1px solid #1A5FFF'
                          : '1px solid var(--line, #EEF1F8)',
                        padding: '6px 12px',
                        borderRadius: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: selected
                          ? '#1A5FFF'
                          : 'var(--soft, #EEF1F8)',
                        color: selected
                          ? '#FFFFFF'
                          : 'var(--text-muted, #8892A4)',
                      }}
                    >
                      {student.name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Group training plan optional
              </label>
              <textarea
                className={styles.formTextarea}
                rows={3}
                placeholder="Plan shared by everyone in this session"
                value={sessionForm.notes}
                onChange={event =>
                  setSessionForm(current => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
              />
            </div>

            {sessionForm.players.length > 0 && (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  Individual focus optional
                </label>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {sessionForm.players.map(playerId => {
                    const student = studentMap.get(String(playerId))

                    return (
                      <div
                        key={playerId}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '130px minmax(0, 1fr)',
                          gap: 10,
                          alignItems: 'center',
                        }}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--text, #0D1B3E)',
                          }}
                        >
                          {student?.name || 'Player'}
                        </div>

                        <input
                          className={styles.formInput}
                          placeholder="e.g. Focus on defensive footwork"
                          value={sessionForm.playerFocus[playerId] || ''}
                          onChange={event =>
                            setSessionForm(current => ({
                              ...current,
                              playerFocus: {
                                ...current.playerFocus,
                                [playerId]: event.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
                marginTop: 12,
              }}
            >
              <button
                className={styles.btnOutline}
                onClick={() => setShowAddSession(false)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className={styles.btnPrimary}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}