import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'
import {
  Avatar,
  CoachPageHeader,
  LevelBadge,
} from './CoachShared'

const DEFAULT_SCORE = 50

const PERFORMANCE_COLORS = {
  Smash: '#2563EB',
  Defense: '#14B8A6',
  Footwork: '#8B5CF6',
  'Drop shot': '#F59E0B',
  'Net play': '#EC4899',
  Serve: '#06B6D4',
}

const FITNESS_COLORS = {
  Stamina: '#10B981',
  Speed: '#2563EB',
  Strength: '#8B5CF6',
  Flexibility: '#F59E0B',
  Recovery: '#06B6D4',
}

const getMetricColor = (label, value, group = 'performance') => {
  const palette =
    group === 'fitness' ? FITNESS_COLORS : PERFORMANCE_COLORS
  const base = palette[label] || '#2563EB'
  const score = Math.max(0, Math.min(100, Number(value) || 0))
  const strength = Math.round(40 + score * 0.5)

  return `color-mix(
    in srgb,
    ${base} ${strength}%,
    var(--card, #FFFFFF)
  )`
}

const PERFORMANCE_FIELDS = [
  { key: 'smash', label: 'Smash' },
  { key: 'defense', label: 'Defense' },
  { key: 'footwork', label: 'Footwork' },
  { key: 'dropShot', label: 'Drop shot' },
  { key: 'netPlay', label: 'Net play' },
  { key: 'serve', label: 'Serve' },
]

const FITNESS_FIELDS = [
  { key: 'stamina', label: 'Stamina' },
  { key: 'speed', label: 'Speed' },
  { key: 'strength', label: 'Strength' },
  { key: 'flexibility', label: 'Flexibility' },
  { key: 'recovery', label: 'Recovery' },
]

const clamp = value =>
  Math.max(0, Math.min(100, Number(value) || 0))

const parseMinutes = value => {
  const match = String(value || '').match(/\d+/)
  return match ? Number(match[0]) : 0
}

const getThisWeekDates = () => {
  const today = new Date()
  const day = today.getDay()

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - day + index)
    return date.toISOString().split('T')[0]
  })
}

const averageValues = values => {
  const numbers = values.map(Number).filter(Number.isFinite)
  if (!numbers.length) return 0
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length)
}

function calculateFitnessIndicators({
  tests,
  trainingLogs,
  recoveryLogs,
  injuries,
}) {
  const sortedTests = [...tests].sort((a, b) => {
    const dateCompare = String(b.test_date || '').localeCompare(
      String(a.test_date || '')
    )

    if (dateCompare !== 0) return dateCompare

    return String(b.created_at || '').localeCompare(
      String(a.created_at || '')
    )
  })

  const latestScore = indicator => {
    const row = sortedTests.find(item => item.indicator === indicator)
    return row ? clamp(row.score) : null
  }

  const sortedRecovery = [...recoveryLogs].sort((a, b) => {
    const dateCompare = String(a.log_date || '').localeCompare(
      String(b.log_date || '')
    )

    if (dateCompare !== 0) return dateCompare

    return String(a.created_at || '').localeCompare(
      String(b.created_at || '')
    )
  })

  const latestRecovery = sortedRecovery.at(-1) || null

  const weeklyDates = getThisWeekDates()
  const weeklyMinutes = trainingLogs
    .filter(log => weeklyDates.includes(String(log.training_date || '').slice(0, 10)))
    .reduce((sum, log) => sum + parseMinutes(log.duration), 0)

  const activeInjuries = injuries.filter(
    injury => injury.status !== 'Recovered'
  ).length

  const recoveryBase = latestRecovery
    ? clamp(
        100 -
          Number(latestRecovery.fatigue_level || 0) * 8 -
          Number(latestRecovery.soreness_level || 0) * 5 +
          Math.min(8, Number(latestRecovery.sleep_hours || 0)) -
          activeInjuries * 5
      )
    : DEFAULT_SCORE

  return {
    stamina: Math.round(
      latestScore('Stamina') ??
        (trainingLogs.length
          ? clamp(DEFAULT_SCORE + Math.min(22, weeklyMinutes / 25))
          : DEFAULT_SCORE)
    ),
    speed: Math.round(latestScore('Speed') ?? DEFAULT_SCORE),
    strength: Math.round(latestScore('Strength') ?? DEFAULT_SCORE),
    flexibility: Math.round(latestScore('Flexibility') ?? DEFAULT_SCORE),
    recovery: Math.round(recoveryBase),
  }
}

function formatDate(value) {
  if (!value) return 'Not set'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function ComparisonSkillRow({
  label,
  studentValue,
  coachValue,
  color,
}) {
  const studentScore = clamp(studentValue ?? DEFAULT_SCORE)
  const hasCoachValue =
    coachValue !== null &&
    coachValue !== undefined &&
    Number.isFinite(Number(coachValue))
  const coachScore = hasCoachValue
    ? clamp(coachValue)
    : studentScore
  const hasChange = hasCoachValue && coachScore !== studentScore

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '68px minmax(0, 1fr) 44px',
        gap: 8,
        width: '100%',
        minWidth: 0,
        alignItems: 'center',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted, #8892A4)',
        }}
      >
        {label}
      </div>

      <div
        style={{
          position: 'relative',
          minWidth: 0,
          height: 7,
          borderRadius: 999,
          background: 'var(--line, #EEF1F8)',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            width: `${studentScore}%`,
            height: '100%',
            borderRadius: 999,
            background: color(studentScore),
          }}
        />

        {hasChange && (
          <>
            <div
              title={`Coach assessment: ${coachScore}`}
              style={{
                position: 'absolute',
                left: `calc(${coachScore}% - 1px)`,
                top: -5,
                width: 2,
                height: 17,
                borderRadius: 999,
                background: '#7C3AED',
                boxShadow:
                  '0 0 0 2px color-mix(in srgb, #7C3AED 16%, var(--card, #FFFFFF))',
              }}
            />

            <div
              style={{
                position: 'absolute',
                left: `clamp(0px, calc(${coachScore}% - 21px), calc(100% - 42px))`,
                top: -23,
                minWidth: 42,
                textAlign: 'center',
                fontSize: 8,
                fontWeight: 800,
                color: '#7C3AED',
                background:
                  'color-mix(in srgb, #7C3AED 12%, var(--card, #FFFFFF))',
                borderRadius: 999,
                padding: '2px 5px',
                whiteSpace: 'nowrap',
              }}
            >
              Coach {coachScore}
            </div>
          </>
        )}
      </div>

      <div
        style={{
          textAlign: 'center',
          fontSize: 10,
          fontWeight: 800,
          whiteSpace: 'nowrap',
          color: 'var(--text, #0D1B3E)',
          paddingRight: 0,
          minWidth: 0,
        }}
      >
        {studentScore}
      </div>
    </div>
  )
}



function ProgressMetricIcon({
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

  if (type === 'performance') {
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

  if (type === 'fitness') {
    return (
      <svg {...props}>
        <path
          d="M5 12h2l2-5 3 10 2-5h5"
          stroke={color}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 4h16v16H4z"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.65"
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

export default function CoachProgress() {
  const { user } = useAuth()

  const [students, setStudents] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  const [loading, setLoading] = useState(true)
  const showLoader = useLoadingDelay(loading, 350)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({
    progress_status: 'On track',
    focus_area: '',
    performance_comment: '',
    fitness_comment: '',
    next_review_date: '',
    smash: 50,
    defense: 50,
    footwork: 50,
    drop_shot: 50,
    net_play: 50,
    serve: 50,
    stamina: 50,
    speed: 50,
    strength: 50,
    flexibility: 50,
    recovery: 50,
  })

  const loadProgress = useCallback(async () => {
    if (!user?.id) {
      setStudents([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const { data: relationships, error: relationshipError } = await supabase
        .from('coach_player_relationships')
        .select('player_user_id')
        .eq('coach_user_id', user.id)
        .eq('status', 'accepted')

      if (relationshipError) throw relationshipError

      const studentUserIds = [
        ...new Set(
          (relationships || [])
            .map(row => row.player_user_id)
            .filter(Boolean)
        ),
      ]

      if (studentUserIds.length === 0) {
        setStudents([])
        setSelectedId(null)
        return
      }

      const [
        profilesResult,
        trainingResult,
        testsResult,
        recoveryResult,
        injuriesResult,
        progressResult,
        assessmentResult,
      ] = await Promise.all([
        supabase
          .from('player_profiles')
          .select('*')
          .in('user_id', studentUserIds)
          .order('display_name', { ascending: true }),

        supabase
          .from('fitness_training_logs')
          .select('*')
          .in('user_id', studentUserIds),

        supabase
          .from('fitness_tests')
          .select('*')
          .in('user_id', studentUserIds),

        supabase
          .from('fitness_recovery_logs')
          .select('*')
          .in('user_id', studentUserIds),

        supabase
          .from('fitness_injuries')
          .select('*')
          .in('user_id', studentUserIds),

        supabase
          .from('coach_player_progress')
          .select('*')
          .eq('coach_user_id', user.id)
          .in('player_user_id', studentUserIds),

        supabase
          .from('coach_player_assessments')
          .select('*')
          .eq('coach_user_id', user.id)
          .in('player_user_id', studentUserIds),
      ])

      const firstError = [
        profilesResult.error,
        trainingResult.error,
        testsResult.error,
        recoveryResult.error,
        injuriesResult.error,
        progressResult.error,
      ].find(Boolean)

      if (firstError) throw firstError

      const profileRows = profilesResult.data || []
      const profileIds = profileRows.map(profile => profile.id).filter(Boolean)

      const { data: skillRows, error: skillError } = profileIds.length
        ? await supabase
            .from('player_skill_ratings')
            .select('*')
            .in('player_id', profileIds)
        : { data: [], error: null }

      if (skillError) throw skillError

      const skillsByProfileId = new Map(
        (skillRows || []).map(row => [String(row.player_id), row])
      )

      const progressByUserId = new Map(
        (progressResult.data || []).map(row => [
          String(row.player_user_id),
          row,
        ])
      )

      if (assessmentResult.error) {
        console.error('Coach assessment load error:', assessmentResult.error)
      }

      const assessmentByUserId = new Map(
        (assessmentResult.error ? [] : assessmentResult.data || []).map(row => [
          String(row.player_user_id),
          row,
        ])
      )

      const groupedByUserId = rows => {
        const map = new Map()

        ;(rows || []).forEach(row => {
          const key = String(row.user_id)
          const current = map.get(key) || []
          current.push(row)
          map.set(key, current)
        })

        return map
      }

      const trainingByUserId = groupedByUserId(trainingResult.data)
      const testsByUserId = groupedByUserId(testsResult.data)
      const recoveryByUserId = groupedByUserId(recoveryResult.data)
      const injuriesByUserId = groupedByUserId(injuriesResult.data)

      const normalizedStudents = profileRows.map(profile => {
        const userId = String(profile.user_id)
        const skillRow = skillsByProfileId.get(String(profile.id)) || {}

        const performance = {
          smash: Number(skillRow.smash ?? DEFAULT_SCORE),
          defense: Number(skillRow.defense ?? DEFAULT_SCORE),
          footwork: Number(skillRow.footwork ?? DEFAULT_SCORE),
          dropShot: Number(skillRow.drop_shot ?? DEFAULT_SCORE),
          netPlay: Number(skillRow.net_play ?? DEFAULT_SCORE),
          serve: Number(skillRow.serve ?? DEFAULT_SCORE),
        }

        const fitness = calculateFitnessIndicators({
          tests: testsByUserId.get(userId) || [],
          trainingLogs: trainingByUserId.get(userId) || [],
          recoveryLogs: recoveryByUserId.get(userId) || [],
          injuries: injuriesByUserId.get(userId) || [],
        })

        return {
          id: profile.user_id,
          profileId: profile.id,
          name: profile.display_name || 'Unnamed player',
          level:
            profile.playing_level ||
            profile.level ||
            profile.player_category ||
            profile.category ||
            'Not specified',
          club: profile.club || 'No club',
          state: profile.state || profile.location || '',
          performance,
          fitness,
          performanceAverage: averageValues(Object.values(performance)),
          fitnessAverage: averageValues(Object.values(fitness)),
          progress: progressByUserId.get(userId) || null,
          assessment: assessmentByUserId.get(userId) || null,
        }
      })

      setStudents(normalizedStudents)
      setSelectedId(current =>
        normalizedStudents.some(student => student.id === current)
          ? current
          : normalizedStudents[0]?.id || null
      )
    } catch (loadError) {
      console.error('Coach progress load error:', loadError)
      setError(
        loadError.message ||
          'Unable to load student progress from the database.'
      )
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadProgress()
  }, [loadProgress])

  const selectedStudent = useMemo(
    () => students.find(student => student.id === selectedId) || null,
    [students, selectedId]
  )

  const totalNotes = useMemo(
    () =>
      students.filter(student =>
        String(student.progress?.coach_comment || '').trim()
      ).length,
    [students]
  )

  const openEditor = student => {
    setSelectedId(student.id)
    setForm({
      progress_status: student.progress?.progress_status || 'On track',
      focus_area: student.progress?.focus_area || '',
      performance_comment:
        student.assessment?.performance_comment ||
        student.progress?.coach_comment ||
        '',
      fitness_comment:
        student.assessment?.fitness_comment || '',
      next_review_date: student.progress?.next_review_date || '',
      smash: Number(student.assessment?.smash ?? student.performance.smash),
      defense: Number(student.assessment?.defense ?? student.performance.defense),
      footwork: Number(student.assessment?.footwork ?? student.performance.footwork),
      drop_shot: Number(student.assessment?.drop_shot ?? student.performance.dropShot),
      net_play: Number(student.assessment?.net_play ?? student.performance.netPlay),
      serve: Number(student.assessment?.serve ?? student.performance.serve),
      stamina: Number(student.assessment?.stamina ?? student.fitness.stamina),
      speed: Number(student.assessment?.speed ?? student.fitness.speed),
      strength: Number(student.assessment?.strength ?? student.fitness.strength),
      flexibility: Number(student.assessment?.flexibility ?? student.fitness.flexibility),
      recovery: Number(student.assessment?.recovery ?? student.fitness.recovery),
    })
    setEditOpen(true)
    setError('')
    setSuccess('')
  }

  const saveProgress = async () => {
    if (!user?.id || !selectedStudent || saving) return

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const progressPayload = {
        coach_user_id: user.id,
        player_user_id: selectedStudent.id,
        progress_status: form.progress_status,
        focus_area: form.focus_area.trim() || null,
        coach_comment: null,
        next_review_date: form.next_review_date || null,
        updated_at: new Date().toISOString(),
      }

      const assessmentPayload = {
        coach_user_id: user.id,
        player_user_id: selectedStudent.id,
        smash: Number(form.smash),
        defense: Number(form.defense),
        footwork: Number(form.footwork),
        drop_shot: Number(form.drop_shot),
        net_play: Number(form.net_play),
        serve: Number(form.serve),
        stamina: Number(form.stamina),
        speed: Number(form.speed),
        strength: Number(form.strength),
        flexibility: Number(form.flexibility),
        recovery: Number(form.recovery),
        performance_comment: form.performance_comment.trim() || null,
        fitness_comment: form.fitness_comment.trim() || null,
        updated_at: new Date().toISOString(),
      }

      const [progressSave, assessmentSave] = await Promise.all([
        supabase
          .from('coach_player_progress')
          .upsert(progressPayload, {
            onConflict: 'coach_user_id,player_user_id',
          })
          .select('*')
          .single(),

        supabase
          .from('coach_player_assessments')
          .upsert(assessmentPayload, {
            onConflict: 'coach_user_id,player_user_id',
          })
          .select('*')
          .single(),
      ])

      if (progressSave.error) throw progressSave.error
      if (assessmentSave.error) throw assessmentSave.error

      setStudents(current =>
        current.map(student =>
          student.id === selectedStudent.id
            ? {
                ...student,
                progress: progressSave.data,
                assessment: assessmentSave.data,
              }
            : student
        )
      )

      setEditOpen(false)
      setSuccess(`${selectedStudent.name}'s progress was updated.`)
    } catch (saveError) {
      console.error('Save coach progress error:', saveError)
      setError(saveError.message || 'Unable to save progress.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <CoachPageHeader
        title="Player Progress"
        subtitle="View synced performance and fitness data for your accepted students"
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
            label: 'Performance avg',
            value: students.length
              ? averageValues(
                  students.map(student => student.performanceAverage)
                )
              : 0,
            color: '#00A878',
            background: '#E0FAF3',
            icon: 'performance',
          },
          {
            label: 'Fitness avg',
            value: students.length
              ? averageValues(
                  students.map(student => student.fitnessAverage)
                )
              : 0,
            color: '#F59E0B',
            background: '#FEF3C7',
            icon: 'fitness',
          },
          {
            label: 'Progress notes',
            value: totalNotes,
            color: '#7C3AED',
            background: '#EDE9FE',
            icon: 'notes',
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
              <ProgressMetricIcon
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
            marginBottom: 14,
            padding: 14,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className={styles.card}
          style={{
            marginBottom: 14,
            padding: 14,
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#047857',
          }}
        >
          {success}
        </div>
      )}

      {loading ? (
        showLoader ? (
          <div className={styles.card}>
            <Loader text="Loading accepted students..." />
          </div>
        ) : null
      ) : students.length === 0 ? (
        <div
          className={styles.card}
          style={{
            padding: 40,
            textAlign: 'center',
            color: '#8892A4',
          }}
        >
          No accepted students yet. Only students with an accepted coach
          relationship appear here.
        </div>
      ) : (
        <div className={styles.g2}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {students.map(student => (
              <div
                key={student.id}
                onClick={() => setSelectedId(student.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  background:
                    selectedId === student.id ? '#E8EFFE' : '#FFFFFF',
                  border:
                    selectedId === student.id
                      ? '2px solid #1A5FFF'
                      : '1.5px solid #EEF1F8',
                }}
              >
                <Avatar name={student.name} size={38} />

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: '#0D1B3E',
                    }}
                  >
                    {student.name}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: '#8892A4',
                      marginTop: 2,
                    }}
                  >
                    {student.club}
                    {student.state ? ` • ${student.state}` : ''}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 5,
                      marginTop: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <LevelBadge level={student.level} />

                    {student.progress?.progress_status && (
                      <span className={styles.badgeGreen}>
                        {student.progress.progress_status}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#8892A4' }}>
                    Performance
                  </div>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 900,
                      color: '#1A5FFF',
                    }}
                  >
                    {student.performanceAverage}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedStudent && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div className={styles.card}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <Avatar name={selectedStudent.name} size={44} />

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: 'var(--text, #0D1B3E)',
                      }}
                    >
                      {selectedStudent.name}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted, #8892A4)',
                      }}
                    >
                      {selectedStudent.club}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => openEditor(selectedStudent)}
                  >
                    Edit progress
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
                    Performance skills
                  </div>

                  {selectedStudent.assessment && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#7C3AED',
                        background:
                          'color-mix(in srgb, #7C3AED 13%, var(--card, #FFFFFF))',
                        borderRadius: 999,
                        padding: '4px 9px',
                      }}
                    >
                      Coach changes shown below
                    </span>
                  )}
                </div>

                {PERFORMANCE_FIELDS.map(field => {
                  const dbKey =
                    field.key === 'dropShot'
                      ? 'drop_shot'
                      : field.key === 'netPlay'
                        ? 'net_play'
                        : field.key

                  return (
                    <ComparisonSkillRow
                      key={field.key}
                      label={field.label}
                      studentValue={selectedStudent.performance[field.key]}
                      coachValue={selectedStudent.assessment?.[dbKey]}
                      color={value =>
                        getMetricColor(
                          field.label,
                          value,
                          'performance'
                        )
                      }
                    />
                  )
                })}

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: 'var(--text-muted, #8892A4)',
                  }}
                >
                  A purple marker shows the coach rating only when it is different.
                </div>
              </div>

              <div className={styles.card}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
                    Fitness indicators
                  </div>

                  {selectedStudent.assessment && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#7C3AED',
                        background:
                          'color-mix(in srgb, #7C3AED 13%, var(--card, #FFFFFF))',
                        borderRadius: 999,
                        padding: '4px 9px',
                      }}
                    >
                      Coach changes shown below
                    </span>
                  )}
                </div>

                {FITNESS_FIELDS.map(field => (
                  <ComparisonSkillRow
                    key={field.key}
                    label={field.label}
                    studentValue={selectedStudent.fitness[field.key]}
                    coachValue={selectedStudent.assessment?.[field.key]}
                    color={value =>
                      getMetricColor(field.label, value, 'fitness')
                    }
                  />
                ))}

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: 'var(--text-muted, #8892A4)',
                  }}
                >
                  Fitness values come from the player record. A purple marker
                  shows the coach rating only when it is different.
                </div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardTitle}>
                  Coach progress record
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Status</span>
                  <span className={styles.statVal}>
                    {selectedStudent.progress?.progress_status || 'Not reviewed'}
                  </span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Focus area</span>
                  <span className={styles.statVal}>
                    {selectedStudent.progress?.focus_area || 'Not set'}
                  </span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Next review</span>
                  <span className={styles.statVal}>
                    {formatDate(
                      selectedStudent.progress?.next_review_date
                    )}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: 12,
                    padding: 12,
                    background: 'var(--soft, #F7F9FF)',
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#1A5FFF',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      marginBottom: 6,
                    }}
                  >
                    Performance feedback
                  </div>

                  <div
                    style={{
                      color: 'var(--text, #0D1B3E)',
                      fontSize: 13,
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedStudent.assessment?.performance_comment ||
                      'No performance feedback yet.'}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    padding: 12,
                    background: 'var(--soft, #F7F9FF)',
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#7C3AED',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      marginBottom: 6,
                    }}
                  >
                    Fitness feedback
                  </div>

                  <div
                    style={{
                      color: 'var(--text, #0D1B3E)',
                      fontSize: 13,
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedStudent.assessment?.fitness_comment ||
                      'No fitness feedback yet.'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {editOpen && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={event =>
            event.target === event.currentTarget && setEditOpen(false)
          }
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Update {selectedStudent.name}
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setEditOpen(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Progress status</label>
              <select
                className={styles.formSelect}
                value={form.progress_status}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    progress_status: event.target.value,
                  }))
                }
              >
                <option>On track</option>
                <option>Improving</option>
                <option>Needs attention</option>
                <option>Injured / recovering</option>
              </select>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Focus area</label>
              <input
                className={styles.formInput}
                placeholder="e.g. Footwork, recovery, match consistency"
                value={form.focus_area}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    focus_area: event.target.value,
                  }))
                }
              />
            </div>

            <div className={styles.cardTitle} style={{ marginTop: 8 }}>
              Coach performance assessment
            </div>

            {[
              ['smash', 'Smash'],
              ['defense', 'Defense'],
              ['footwork', 'Footwork'],
              ['drop_shot', 'Drop shot'],
              ['net_play', 'Net play'],
              ['serve', 'Serve'],
            ].map(([key, label]) => (
              <div key={key} className={styles.formRow}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <label className={styles.formLabel} style={{ marginBottom: 0 }}>
                    {label}
                  </label>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>
                    {form[key]}
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={form[key]}
                  style={{ width: '100%', accentColor: '#00A878' }}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      [key]: Number(event.target.value),
                    }))
                  }
                />
              </div>
            ))}

            <div className={styles.cardTitle} style={{ marginTop: 12 }}>
              Coach fitness assessment
            </div>

            {[
              ['stamina', 'Stamina'],
              ['speed', 'Speed'],
              ['strength', 'Strength'],
              ['flexibility', 'Flexibility'],
              ['recovery', 'Recovery'],
            ].map(([key, label]) => (
              <div key={key} className={styles.formRow}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <label className={styles.formLabel} style={{ marginBottom: 0 }}>
                    {label}
                  </label>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>
                    {form[key]}
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={form[key]}
                  style={{ width: '100%', accentColor: '#7C3AED' }}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      [key]: Number(event.target.value),
                    }))
                  }
                />
              </div>
            ))}

            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Performance feedback
              </label>
              <textarea
                className={styles.formTextarea}
                rows={4}
                placeholder="Write feedback about the student's badminton skills and match performance."
                value={form.performance_comment}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    performance_comment: event.target.value,
                  }))
                }
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Fitness feedback
              </label>
              <textarea
                className={styles.formTextarea}
                rows={4}
                placeholder="Write feedback about fitness, recovery, stamina, strength or conditioning."
                value={form.fitness_comment}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    fitness_comment: event.target.value,
                  }))
                }
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Next review date</label>
              <input
                className={styles.formInput}
                type="date"
                value={form.next_review_date}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    next_review_date: event.target.value,
                  }))
                }
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 10,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                onClick={saveProgress}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save progress'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}