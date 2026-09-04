import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'
import { Avatar, CoachPageHeader, LevelBadge } from './CoachShared'
import CoachNotificationBell from '../Notifications/CoachNotificationBell'

const DEFAULT_SCORE = 50

const ACTION_PLAN_META_PREFIX = '__SHUTTLETRACK_ACTION_PLAN__:'

const SCHEDULE_META_PREFIX = '__SHUTTLETRACK_TRAINING__:'

function decodeScheduleNotes(value) {
  const raw = String(value || '')

  if (!raw.startsWith(SCHEDULE_META_PREFIX)) {
    return {
      notes: raw,
      endTime: '',
      focus: '',
      activity: '',
      matchType: '',
      status: 'scheduled',
    }
  }

  try {
    const parsed = JSON.parse(
      raw.slice(SCHEDULE_META_PREFIX.length)
    )

    return {
      notes: parsed?.notes || '',
      endTime: parsed?.endTime || '',
      focus: parsed?.focus || '',
      activity: parsed?.activity || '',
      matchType: parsed?.matchType || '',
      status: parsed?.status || 'scheduled',
    }
  } catch {
    return {
      notes: raw,
      endTime: '',
      focus: '',
      activity: '',
      matchType: '',
      status: 'scheduled',
    }
  }
}

function mapTaggedUpcomingMatch(row) {
  const meta = decodeScheduleNotes(row?.notes)

  return {
    id: row?.id,
    playerUserId: row?.user_id || '',
    date: row?.event_date || '',
    startTime: row?.event_time || '',
    endTime: meta.endTime || '',
    scheduleType:
      row?.schedule_type || 'Friendly Match',
    title:
      row?.title ||
      meta.activity ||
      row?.schedule_type ||
      'Upcoming match',
    matchType:
      meta.matchType || 'Singles',
    venue: row?.location || '',
    notes: meta.notes || '',
    status: meta.status || 'scheduled',
  }
}

function decodeActionPlans(value) {
  const raw = String(value || '')

  const empty = {
    performance: '',
    performanceDeadline: '',
    performanceCompletion: 0,
    fitness: '',
    fitnessDeadline: '',
    fitnessCompletion: 0,
  }

  if (!raw.startsWith(ACTION_PLAN_META_PREFIX)) {
    return empty
  }

  try {
    const parsed = JSON.parse(
      raw.slice(ACTION_PLAN_META_PREFIX.length)
    )

    /*
     * Backward compatibility:
     * Old saved format:
     * {
     *   performance: "text",
     *   fitness: "text"
     * }
     *
     * New format:
     * {
     *   performance: {
     *     text: "...",
     *     deadline: "2026-09-30",
     *     completionRate: 50
     *   },
     *   fitness: {
     *     text: "...",
     *     deadline: "2026-10-15",
     *     completionRate: 25
     *   }
     * }
     */
    const performanceValue =
      parsed?.performance

    const fitnessValue =
      parsed?.fitness

    const performanceIsObject =
      performanceValue &&
      typeof performanceValue === 'object' &&
      !Array.isArray(performanceValue)

    const fitnessIsObject =
      fitnessValue &&
      typeof fitnessValue === 'object' &&
      !Array.isArray(fitnessValue)

    return {
      performance:
        performanceIsObject
          ? performanceValue.text || ''
          : performanceValue || '',

      performanceDeadline:
        performanceIsObject
          ? performanceValue.deadline || ''
          : '',

      performanceCompletion:
        performanceIsObject
          ? clamp(
              performanceValue.completionRate
            )
          : 0,

      fitness:
        fitnessIsObject
          ? fitnessValue.text || ''
          : fitnessValue || '',

      fitnessDeadline:
        fitnessIsObject
          ? fitnessValue.deadline || ''
          : '',

      fitnessCompletion:
        fitnessIsObject
          ? clamp(
              fitnessValue.completionRate
            )
          : 0,
    }
  } catch {
    return empty
  }
}

function encodeActionPlans({
  performance = '',
  performanceDeadline = '',
  performanceCompletion = 0,
  fitness = '',
  fitnessDeadline = '',
  fitnessCompletion = 0,
}) {
  const cleanPerformance =
    String(performance || '').trim()

  const cleanFitness =
    String(fitness || '').trim()

  const cleanPerformanceDeadline =
    String(
      performanceDeadline || ''
    ).trim()

  const cleanFitnessDeadline =
    String(
      fitnessDeadline || ''
    ).trim()

  const cleanPerformanceCompletion =
    clamp(performanceCompletion)

  const cleanFitnessCompletion =
    clamp(fitnessCompletion)

  const hasPerformance =
    Boolean(
      cleanPerformance ||
      cleanPerformanceDeadline ||
      cleanPerformanceCompletion
    )

  const hasFitness =
    Boolean(
      cleanFitness ||
      cleanFitnessDeadline ||
      cleanFitnessCompletion
    )

  if (!hasPerformance && !hasFitness) {
    return null
  }

  return `${ACTION_PLAN_META_PREFIX}${JSON.stringify({
    performance: {
      text: cleanPerformance,
      deadline:
        cleanPerformanceDeadline,
      completionRate:
        cleanPerformanceCompletion,
    },
    fitness: {
      text: cleanFitness,
      deadline:
        cleanFitnessDeadline,
      completionRate:
        cleanFitnessCompletion,
    },
  })}`
}

const PERFORMANCE_COLORS = {
  Smash: '#2563EB',
  Defense: '#14B8A6',
  Footwork: '#8B5CF6',
  'Drop shot': '#F59E0B',
  'Net play': '#EC4899',
  Serve: '#06B6D4',
}

const FITNESS_COLORS = {
  Endurance: '#10B981',
  Speed: '#2563EB',
  Strength: '#8B5CF6',
  Agility: '#F59E0B',
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
  { key: 'endurance', label: 'Endurance' },
  { key: 'speed', label: 'Speed' },
  { key: 'strength', label: 'Strength' },
  { key: 'agility', label: 'Agility' },
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
  return Math.round(
    numbers.reduce((sum, value) => sum + value, 0) / numbers.length
  )
}

const hasMeaningfulProgressNote = student => {
  const actionPlans = decodeActionPlans(
    student.progress?.coach_comment
  )

  return Boolean(
    String(actionPlans.performance || '').trim() ||
    String(actionPlans.fitness || '').trim() ||
    String(student.progress?.focus_area || '').trim() ||
    String(student.progress?.progress_status || '').trim() ||
    String(student.progress?.injury_recommendation || '').trim() ||
    String(student.assessment?.performance_comment || '').trim() ||
    String(student.assessment?.fitness_comment || '').trim()
  )
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
    .filter(log =>
      weeklyDates.includes(
        String(log.training_date || '').slice(0, 10)
      )
    )
    .reduce(
      (sum, log) => sum + parseMinutes(log.duration),
      0
    )

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
    endurance: Math.round(
      latestScore('Endurance') ??
        (trainingLogs.length
          ? clamp(DEFAULT_SCORE + Math.min(22, weeklyMinutes / 25))
          : DEFAULT_SCORE)
    ),
    speed: Math.round(latestScore('Speed') ?? DEFAULT_SCORE),
    strength: Math.round(latestScore('Strength') ?? DEFAULT_SCORE),
    agility: Math.round(
      latestScore('Agility') ?? DEFAULT_SCORE
    ),
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

const getMatchOpponent = match => {
  const names = [
    match?.opponent_name,
    match?.opponent_name2,
  ].filter(Boolean)

  return names.length
    ? names.join(' & ')
    : 'Unknown opponent'
}

const getMatchScore = match =>
  [match?.score1, match?.score2, match?.score3]
    .filter(Boolean)
    .join(', ')

const mapPlayerMatch = (row, coachNote = null) => ({
  id: row.id,
  playerId: row.player_id,
  date: row.match_date,
  type: row.match_type || 'Singles',
  opponentName: row.opponent_name || '',
  opponentName2: row.opponent_name2 || '',
  opponent: getMatchOpponent(row),
  partnerName: row.partner_name || '',
  score1: row.score1 || '',
  score2: row.score2 || '',
  score3: row.score3 || '',
  score: getMatchScore(row),
  result: row.result || '',
  playerNotes: row.notes || '',
  videoUrl: row.video_url || '',
  videoFileName: row.video_file_name || '',
  createdAt: row.created_at || '',
  updatedAt: row.updated_at || '',
  coachNote: coachNote?.note || '',
  coachNoteId: coachNote?.id || null,
})

const INJURY_META_PREFIX = '__SHUTTLETRACK_INJURY__:'

function decodeInjuryNotes(value) {
  const raw = String(value || '')

  if (!raw.startsWith(INJURY_META_PREFIX)) {
    return {
      notes: raw,
      bodyX: null,
      bodyY: null,
      severity: 'Mild',
      imagePath: '',
    }
  }

  try {
    const parsed = JSON.parse(
      raw.slice(INJURY_META_PREFIX.length)
    )

    return {
      notes: parsed?.notes || '',
      bodyX:
        parsed?.bodyX !== null &&
        parsed?.bodyX !== undefined &&
        parsed?.bodyX !== '' &&
        Number.isFinite(Number(parsed.bodyX))
          ? Number(parsed.bodyX)
          : null,
      bodyY:
        parsed?.bodyY !== null &&
        parsed?.bodyY !== undefined &&
        parsed?.bodyY !== '' &&
        Number.isFinite(Number(parsed.bodyY))
          ? Number(parsed.bodyY)
          : null,
      severity:
        ['Mild', 'Moderate', 'Severe'].includes(
          parsed?.severity
        )
          ? parsed.severity
          : 'Mild',
      imagePath: parsed?.imagePath || '',
    }
  } catch {
    return {
      notes: raw,
      bodyX: null,
      bodyY: null,
      severity: 'Mild',
      imagePath: '',
    }
  }
}

const INJURY_IMAGE_BUCKET = 'injury-images'

function getInjuryImageUrl(imagePath) {
  if (!imagePath) return ''

  const { data } = supabase.storage
    .from(INJURY_IMAGE_BUCKET)
    .getPublicUrl(imagePath)

  return data?.publicUrl || ''
}

function getInjurySeverityColor(severity) {
  const normalized = String(severity || '').toLowerCase()

  if (normalized === 'severe') return '#EF4444'
  if (normalized === 'moderate') return '#F59E0B'
  return '#10B981'
}

function normalizeInjury(row) {
  const meta = decodeInjuryNotes(row?.notes)
  const status = row?.status || 'Monitoring'

  const severity =
    ['Mild', 'Moderate', 'Severe'].includes(row?.severity)
      ? row.severity
      : meta.severity || 'Mild'

  const imagePath =
    row?.image_path ||
    meta.imagePath ||
    ''

  return {
    id: row?.id,
    name: row?.injury_description || 'Unnamed injury',
    date: row?.injury_date || '',
    status,
    severity,
    notes: meta.notes,
    bodyX: meta.bodyX,
    bodyY: meta.bodyY,
    imagePath,
    imageUrl: getInjuryImageUrl(imagePath),
    createdAt: row?.created_at || '',
    updatedAt: row?.updated_at || '',
    isActive:
      String(status).toLowerCase() !== 'recovered',
  }
}

function getInjuryStatusColor(status) {
  const normalized = String(status || '').toLowerCase()

  if (normalized === 'recovered') return '#10B981'
  if (normalized === 'recovering') return '#F59E0B'
  return '#EF4444'
}

function getFallbackInjuryPoint(name = '') {
  const lower = String(name || '').toLowerCase().trim()
  const isLeft = /\bleft\b/.test(lower)
  const isRight = /\bright\b/.test(lower)
  const sideX = isLeft ? 50 : isRight ? 70 : 60

  if (
    lower.includes('head') ||
    lower.includes('forehead')
  ) {
    return { cx: 60, cy: 16 }
  }
  if (lower.includes('neck')) {
    return { cx: sideX, cy: 31 }
  }
  if (lower.includes('shoulder')) {
    return {
      cx: isLeft ? 42 : isRight ? 78 : 60,
      cy: 43,
    }
  }
  if (
    lower.includes('upper chest') ||
    lower.includes('chest') ||
    lower.includes('pectoral')
  ) {
    return {
      cx: isLeft ? 52 : isRight ? 68 : 60,
      cy: 50,
    }
  }
  if (
    lower.includes('upper arm') ||
    lower.includes('bicep') ||
    lower.includes('tricep') ||
    (lower.includes('arm') &&
      !lower.includes('forearm'))
  ) {
    return {
      cx: isLeft ? 37 : isRight ? 83 : 60,
      cy: 63,
    }
  }
  if (lower.includes('elbow')) {
    return {
      cx: isLeft ? 31 : isRight ? 89 : 60,
      cy: 78,
    }
  }
  if (lower.includes('forearm')) {
    return {
      cx: isLeft ? 29 : isRight ? 91 : 60,
      cy: 88,
    }
  }
  if (
    lower.includes('wrist') ||
    lower.includes('hand') ||
    lower.includes('palm') ||
    lower.includes('finger')
  ) {
    return {
      cx: isLeft ? 27 : isRight ? 93 : 60,
      cy: 98,
    }
  }
  if (
    lower.includes('rib') ||
    lower.includes('ribs')
  ) {
    return {
      cx: isLeft ? 51 : isRight ? 69 : 60,
      cy: 67,
    }
  }
  if (
    lower.includes('waist') ||
    lower.includes('abdomen') ||
    lower.includes('stomach')
  ) {
    return { cx: sideX, cy: 86 }
  }
  if (lower.includes('back')) {
    return {
      cx: sideX,
      cy: lower.includes('lower') ? 86 : 66,
    }
  }
  if (
    lower.includes('hip') ||
    lower.includes('groin')
  ) {
    return { cx: sideX, cy: 94 }
  }
  if (
    lower.includes('thigh') ||
    lower.includes('hamstring') ||
    lower.includes('quadricep') ||
    lower.includes('quad')
  ) {
    return { cx: sideX, cy: 106 }
  }
  if (lower.includes('knee')) {
    return { cx: sideX, cy: 122 }
  }
  if (
    lower.includes('calf') ||
    lower.includes('shin') ||
    lower.includes('lower leg')
  ) {
    return { cx: sideX, cy: 140 }
  }
  if (lower.includes('ankle')) {
    return { cx: sideX, cy: 153 }
  }
  if (
    lower.includes('foot') ||
    lower.includes('heel') ||
    lower.includes('toe')
  ) {
    return { cx: sideX, cy: 160 }
  }

  return { cx: 60, cy: 90 }
}

function InjuryBodyMap({ injuries = [] }) {
  const visibleInjuries = injuries
    .filter(Boolean)
    .slice(0, 8)

  return (
    <div
      style={{
        width: 180,
        minWidth: 180,
        height: 240,
        padding: 12,
        boxSizing: 'border-box',
        borderRadius: 14,
        border:
          '1px solid var(--line, #E2E8F0)',
        background: 'var(--card, #FFFFFF)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        viewBox="0 0 120 170"
        width="132"
        height="188"
        role="img"
        aria-label="Student injury location body map"
        style={{
          display: 'block',
          overflow: 'visible',
        }}
      >
        <image
          href="/humanbody.png"
          x="18"
          y="0"
          width="84"
          height="170"
          preserveAspectRatio="xMidYMid meet"
          pointerEvents="none"
        />

        {visibleInjuries.map((injury, index) => {
          const hasSavedPoint =
            injury.bodyX !== null &&
            injury.bodyX !== undefined &&
            injury.bodyY !== null &&
            injury.bodyY !== undefined &&
            Number.isFinite(Number(injury.bodyX)) &&
            Number.isFinite(Number(injury.bodyY))

          const point = hasSavedPoint
            ? {
                cx: Number(injury.bodyX),
                cy: Number(injury.bodyY),
              }
            : getFallbackInjuryPoint(injury.name)

          const markerColor =
            getInjuryStatusColor(injury.status)

          return (
            <g
              key={`${injury.id || injury.name}-${index}`}
            >
              <circle
                cx={point.cx}
                cy={point.cy}
                r="8"
                fill="var(--card, #FFFFFF)"
                opacity="0.98"
              />
              <circle
                cx={point.cx}
                cy={point.cy}
                r="5"
                fill={markerColor}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ComparisonSkillRow({
  label,
  studentValue,
  coachValue,
  color,
}) {
  const studentScore =
    clamp(studentValue ?? DEFAULT_SCORE)

  const hasCoachValue =
    coachValue !== null &&
    coachValue !== undefined &&
    Number.isFinite(Number(coachValue))

  const coachScore = hasCoachValue
    ? clamp(coachValue)
    : studentScore

  const hasChange =
    hasCoachValue &&
    coachScore !== studentScore

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          '68px minmax(0, 1fr) 44px',
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
          color:
            'var(--text-muted, #8892A4)',
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
          background:
            'var(--line, #EEF1F8)',
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
                left:
                  `calc(${coachScore}% - 1px)`,
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
                left:
                  `clamp(0px, calc(${coachScore}% - 21px), calc(100% - 42px))`,
                top: -23,
                minWidth: 42,
                textAlign: 'center',
                fontSize: 8,
                fontWeight: 700,
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
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          color:
            'var(--text, #0D1B3E)',
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

const getPlayerInitials = name => {
  const value = String(name || '-').trim()
  if (!value) return '-'

  const words = value
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase()
  }

  return `${words[0][0]}${words[words.length - 1][0]}`
    .toUpperCase()
}

function MatchPlayerSuggestions({
  items,
  onSelect,
}) {
  if (!items.length) return null

  return (
    <div
      style={{
        border:
          '1px solid var(--line, #EEF1F8)',
        borderRadius: 10,
        background:
          'var(--card, #FFFFFF)',
        marginTop: 6,
        overflow: 'hidden',
        boxShadow:
          '0 10px 25px rgba(15, 23, 42, 0.08)',
      }}
    >
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          style={{
            width: '100%',
            border: 'none',
            background:
              'var(--card, #FFFFFF)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            textAlign: 'left',
            color:
              'var(--text, #0D1B3E)',
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 700,
              background: '#E8EFFE',
              color: '#1A5FFF',
              border:
                '1px solid #D8E4FF',
            }}
          >
            {getPlayerInitials(
              item.display_name
            )}
          </span>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color:
                  'var(--text, #0D1B3E)',
              }}
            >
              {item.display_name}
            </div>
          </div>

          <span
            style={{
              fontSize: 11,
              color:
                'var(--text-muted, #8892A4)',
              marginLeft: 'auto',
              flexShrink: 0,
            }}
          >
            {item.source}
          </span>
        </button>
      ))}
    </div>
  )
}

function AssessmentSlider({
  label,
  value,
  accentColor,
  onChange,
}) {
  return (
    <div className={styles.formRow}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <label
          className={styles.formLabel}
          style={{ marginBottom: 0 }}
        >
          {label}
        </label>

        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {value}
        </span>
      </div>

      <input
        type="range"
        min="0"
        max="100"
        value={value}
        style={{
          width: '100%',
          accentColor,
        }}
        onChange={event =>
          onChange(
            Number(event.target.value)
          )
        }
      />
    </div>
  )
}

function ActionPlanProgress({
  deadline,
  completion,
  accentColor = '#1A5FFF',
}) {
  const value =
    clamp(completion)

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop:
          '1px solid var(--line, #EEF1F8)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 7,
          fontSize: 11,
          color:
            'var(--text-muted, #8892A4)',
        }}
      >
        <span>
          Deadline:{' '}
          <strong
            style={{
              fontWeight: 700,
              color:
                'var(--text, #0D1B3E)',
            }}
          >
            {deadline
              ? formatDate(deadline)
              : 'Not set'}
          </strong>
        </span>

        <span
          style={{
            fontWeight: 700,
            color: accentColor,
          }}
        >
          {value}% complete
        </span>
      </div>

      <div
        style={{
          height: 7,
          borderRadius: 999,
          background:
            'var(--line, #EEF1F8)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            borderRadius: 999,
            background: accentColor,
            transition:
              'width 180ms ease',
          }}
        />
      </div>
    </div>
  )
}

export default function CoachProgress() {
  const { user } = useAuth()

  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1600
  )

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', handleResize)
    handleResize()

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const progressSingleColumn = viewportWidth <= 900
  const progressCompact = viewportWidth <= 1350

  const [students, setStudents] = useState([])
  const [selectedId, setSelectedId] = useState(null)

  const [loading, setLoading] = useState(true)
  const showLoader = useLoadingDelay(loading, 350)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [editOpen, setEditOpen] = useState(false)

  const [matchModalOpen, setMatchModalOpen] =
    useState(false)
  const [matchDetailOpen, setMatchDetailOpen] =
    useState(false)
  const [matchNoteOpen, setMatchNoteOpen] =
    useState(false)
  const [allMatchesOpen, setAllMatchesOpen] =
    useState(false)
  const [allInjuriesOpen, setAllInjuriesOpen] =
    useState(false)

  const [selectedMatch, setSelectedMatch] =
    useState(null)
  const [selectedInjury, setSelectedInjury] =
    useState(null)
  const [injuryDetailOpen, setInjuryDetailOpen] =
    useState(false)

  const [matchNote, setMatchNote] = useState('')
  const [savingMatch, setSavingMatch] =
    useState(false)
  const [savingMatchNote, setSavingMatchNote] =
    useState(false)

  const [matchForm, setMatchForm] = useState({
    date: new Date()
      .toISOString()
      .split('T')[0],
    type: 'Singles',
    opponent: '',
    opponentUserId: null,
    opponent2: '',
    opponentUserId2: null,
    partnerName: '',
    partnerUserId: null,
    score1: '',
    score2: '',
    score3: '',
    result: 'Win',
    notes: '',
  })

  const [
    partnerSuggestions,
    setPartnerSuggestions,
  ] = useState([])

  const [
    opponent1Suggestions,
    setOpponent1Suggestions,
  ] = useState([])

  const [
    opponent2Suggestions,
    setOpponent2Suggestions,
  ] = useState([])

  const [
    recommendationOpen,
    setRecommendationOpen,
  ] = useState(false)

  const [
    injuryRecommendation,
    setInjuryRecommendation,
  ] = useState('')

  const [
    savingRecommendation,
    setSavingRecommendation,
  ] = useState(false)

  const [form, setForm] = useState({
    progress_status: 'On track',
    focus_area: '',
    performance_comment: '',
    performance_action_plan: '',
    performance_action_deadline: '',
    performance_action_completion: 0,
    fitness_comment: '',
    fitness_action_plan: '',
    fitness_action_deadline: '',
    fitness_action_completion: 0,
    next_review_date: '',
    smash: 50,
    defense: 50,
    footwork: 50,
    drop_shot: 50,
    net_play: 50,
    serve: 50,
    endurance: 50,
    speed: 50,
    strength: 50,
    agility: 50,
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
      const {
        data: relationships,
        error: relationshipError,
      } = await supabase
        .from(
          'coach_player_relationships'
        )
        .select('player_user_id')
        .eq('coach_user_id', user.id)
        .eq('status', 'accepted')

      if (relationshipError) {
        throw relationshipError
      }

      const studentUserIds = [
        ...new Set(
          (relationships || [])
            .map(
              row => row.player_user_id
            )
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
        taggedScheduleResult,
      ] = await Promise.all([
        supabase
          .from('player_profiles')
          .select('*')
          .in(
            'user_id',
            studentUserIds
          )
          .order('display_name', {
            ascending: true,
          }),

        supabase
          .from('fitness_training_logs')
          .select('*')
          .in(
            'user_id',
            studentUserIds
          ),

        supabase
          .from('fitness_tests')
          .select('*')
          .in(
            'user_id',
            studentUserIds
          ),

        supabase
          .from(
            'fitness_recovery_logs'
          )
          .select('*')
          .in(
            'user_id',
            studentUserIds
          ),

        supabase
          .from('fitness_injuries')
          .select('*')
          .in(
            'user_id',
            studentUserIds
          ),

        supabase
          .from(
            'coach_player_progress'
          )
          .select('*')
          .eq(
            'coach_user_id',
            user.id
          )
          .in(
            'player_user_id',
            studentUserIds
          ),

        supabase
          .from(
            'coach_player_assessments'
          )
          .select('*')
          .eq(
            'coach_user_id',
            user.id
          )
          .in(
            'player_user_id',
            studentUserIds
          ),

        supabase
          .from('player_schedule')
          .select('*')
          .eq(
            'tagged_coach_user_id',
            user.id
          )
          .in(
            'user_id',
            studentUserIds
          )
          .in(
            'schedule_type',
            ['Competition', 'Friendly Match']
          )
          .gte(
            'event_date',
            new Date()
              .toISOString()
              .slice(0, 10)
          )
          .order('event_date', {
            ascending: true,
          })
          .order('event_time', {
            ascending: true,
          }),
      ])

      const firstError = [
        profilesResult.error,
        trainingResult.error,
        testsResult.error,
        recoveryResult.error,
        injuriesResult.error,
        progressResult.error,
        taggedScheduleResult.error,
      ].find(Boolean)

      if (firstError) {
        throw firstError
      }

      const profileRows =
        profilesResult.data || []

      const profileIds = profileRows
        .map(profile => profile.id)
        .filter(Boolean)

      const [skillResult, matchResult] =
        profileIds.length
          ? await Promise.all([
              supabase
                .from(
                  'player_skill_ratings'
                )
                .select('*')
                .in(
                  'player_id',
                  profileIds
                ),

              supabase
                .from('player_matches')
                .select('*')
                .in(
                  'player_id',
                  profileIds
                )
                .order('match_date', {
                  ascending: false,
                })
                .order('created_at', {
                  ascending: false,
                }),
            ])
          : [
              {
                data: [],
                error: null,
              },
              {
                data: [],
                error: null,
              },
            ]

      if (skillResult.error) {
        throw skillResult.error
      }

      if (matchResult.error) {
        throw matchResult.error
      }

      const skillRows =
        skillResult.data || []

      const matchRows =
        matchResult.data || []

      const matchIds = matchRows
        .map(row => row.id)
        .filter(Boolean)

      let coachNoteRows = []

      if (matchIds.length > 0) {
        const {
          data: noteRows,
          error: noteError,
        } = await supabase
          .from('coach_match_notes')
          .select('*')
          .eq(
            'coach_user_id',
            user.id
          )
          .in('match_id', matchIds)

        if (noteError) {
          console.error(
            'Coach match notes load error:',
            noteError
          )
        } else {
          coachNoteRows =
            noteRows || []
        }
      }

      const coachNoteByMatchId =
        new Map(
          coachNoteRows.map(row => [
            String(row.match_id),
            row,
          ])
        )

      const matchesByProfileId =
        new Map()

      matchRows.forEach(row => {
        const key = String(
          row.player_id
        )

        const current =
          matchesByProfileId.get(key) ||
          []

        current.push(
          mapPlayerMatch(
            row,
            coachNoteByMatchId.get(
              String(row.id)
            ) || null
          )
        )

        matchesByProfileId.set(
          key,
          current
        )
      })

      const skillsByProfileId =
        new Map(
          skillRows.map(row => [
            String(row.player_id),
            row,
          ])
        )

      const progressByUserId =
        new Map(
          (
            progressResult.data || []
          ).map(row => [
            String(
              row.player_user_id
            ),
            row,
          ])
        )

      if (assessmentResult.error) {
        console.error(
          'Coach assessment load error:',
          assessmentResult.error
        )
      }

      const assessmentByUserId =
        new Map(
          (
            assessmentResult.error
              ? []
              : assessmentResult.data ||
                []
          ).map(row => [
            String(
              row.player_user_id
            ),
            row,
          ])
        )

      const groupedByUserId = rows => {
        const map = new Map()

        ;(rows || []).forEach(row => {
          const key = String(
            row.user_id
          )
          const current =
            map.get(key) || []
          current.push(row)
          map.set(key, current)
        })

        return map
      }

      const trainingByUserId =
        groupedByUserId(
          trainingResult.data
        )

      const testsByUserId =
        groupedByUserId(
          testsResult.data
        )

      const recoveryByUserId =
        groupedByUserId(
          recoveryResult.data
        )

      const injuriesByUserId =
        groupedByUserId(
          injuriesResult.data
        )

      const taggedUpcomingByUserId =
        new Map()

      ;(
        taggedScheduleResult.data ||
        []
      ).forEach(row => {
        const mapped =
          mapTaggedUpcomingMatch(row)

        if (
          mapped.status !==
          'scheduled'
        ) {
          return
        }

        const key = String(
          row.user_id || ''
        )

        if (!key) return

        const current =
          taggedUpcomingByUserId.get(
            key
          ) || []

        current.push(mapped)

        taggedUpcomingByUserId.set(
          key,
          current
        )
      })

      const normalizedStudents =
        profileRows.map(profile => {
          const userId = String(
            profile.user_id
          )

          const skillRow =
            skillsByProfileId.get(
              String(profile.id)
            ) || {}

          const performance = {
            smash: Number(
              skillRow.smash ??
                DEFAULT_SCORE
            ),
            defense: Number(
              skillRow.defense ??
                DEFAULT_SCORE
            ),
            footwork: Number(
              skillRow.footwork ??
                DEFAULT_SCORE
            ),
            dropShot: Number(
              skillRow.drop_shot ??
                DEFAULT_SCORE
            ),
            netPlay: Number(
              skillRow.net_play ??
                DEFAULT_SCORE
            ),
            serve: Number(
              skillRow.serve ??
                DEFAULT_SCORE
            ),
          }

          const injuryRows =
            injuriesByUserId.get(
              userId
            ) || []

          const fitness =
            calculateFitnessIndicators({
              tests:
                testsByUserId.get(
                  userId
                ) || [],
              trainingLogs:
                trainingByUserId.get(
                  userId
                ) || [],
              recoveryLogs:
                recoveryByUserId.get(
                  userId
                ) || [],
              injuries: injuryRows,
            })

          const normalizedInjuries =
            injuryRows
              .map(normalizeInjury)
              .sort((a, b) => {
                if (
                  a.isActive !==
                  b.isActive
                ) {
                  return a.isActive
                    ? -1
                    : 1
                }

                const dateCompare =
                  String(
                    b.date || ''
                  ).localeCompare(
                    String(
                      a.date || ''
                    )
                  )

                if (
                  dateCompare !== 0
                ) {
                  return dateCompare
                }

                return String(
                  b.createdAt || ''
                ).localeCompare(
                  String(
                    a.createdAt || ''
                  )
                )
              })

          const activeInjuryCount =
            normalizedInjuries.filter(
              injury =>
                injury.isActive
            ).length

          return {
            id: profile.user_id,
            profileId: profile.id,
            name:
              profile.display_name ||
              'Unnamed player',
            level:
              profile.playing_level ||
              profile.level ||
              profile.player_category ||
              profile.category ||
              'Not specified',
            club:
              profile.club ||
              'No club',
            state:
              profile.state ||
              profile.location ||
              '',
            performance,
            fitness,
            injuries:
              normalizedInjuries,
            activeInjuryCount,
            performanceAverage:
              averageValues(
                Object.values(
                  performance
                )
              ),
            fitnessAverage:
              averageValues(
                Object.values(
                  fitness
                )
              ),
            matches:
              matchesByProfileId.get(
                String(profile.id)
              ) || [],
            upcomingMatches:
              taggedUpcomingByUserId.get(
                userId
              ) || [],
            progress:
              progressByUserId.get(
                userId
              ) || null,
            assessment:
              assessmentByUserId.get(
                userId
              ) || null,
          }
        })

      setStudents(
        normalizedStudents
      )

      setSelectedId(current =>
        normalizedStudents.some(
          student =>
            student.id === current
        )
          ? current
          : normalizedStudents[0]
              ?.id || null
      )

      try {
        const today =
          new Date()
            .toISOString()
            .slice(0, 10)

        const todayStart =
          `${today}T00:00:00.000Z`

        const {
          data: reminderSettings,
          error:
            reminderSettingsError,
        } = await supabase
          .from('user_settings')
          .select(
            'coach_progress_reminder'
          )
          .eq('user_id', user.id)
          .maybeSingle()

        if (
          reminderSettingsError
        ) {
          console.error(
            'Load progress reminder setting error:',
            reminderSettingsError
          )
        }

        const remindersEnabled =
          reminderSettings
            ?.coach_progress_reminder !==
          false

        if (remindersEnabled) {
          const dueStudents =
            normalizedStudents.filter(
              student => {
                const reviewDate =
                  String(
                    student.progress
                      ?.next_review_date ||
                      ''
                  ).slice(0, 10)

                return (
                  reviewDate &&
                  reviewDate <= today
                )
              }
            )

          if (
            dueStudents.length > 0
          ) {
            const {
              data:
                existingReminders,
              error:
                existingReminderError,
            } = await supabase
              .from('notifications')
              .select(
                'id, message'
              )
              .eq(
                'user_id',
                user.id
              )
              .eq(
                'source_type',
                'coach_progress_reminder'
              )
              .gte(
                'created_at',
                todayStart
              )

            if (
              existingReminderError
            ) {
              console.error(
                'Load existing progress reminders error:',
                existingReminderError
              )
            } else {
              const existingMessages =
                new Set(
                  (
                    existingReminders ||
                    []
                  ).map(item =>
                    String(
                      item.message ||
                        ''
                    )
                  )
                )

              const remindersToInsert =
                dueStudents
                  .map(student => {
                    const reviewDate =
                      String(
                        student.progress
                          ?.next_review_date ||
                          ''
                      ).slice(
                        0,
                        10
                      )

                    const message =
                      reviewDate <
                      today
                        ? `${student.name}'s progress review was due on ${formatDate(
                            reviewDate
                          )}.`
                        : `${student.name}'s progress review is due today.`

                    return {
                      user_id:
                        user.id,
                      title:
                        'Player progress review reminder',
                      message,
                      type: 'warning',
                      source_type:
                        'coach_progress_reminder',
                      action_url:
                        '/coach/progress',
                      is_read: false,
                    }
                  })
                  .filter(
                    reminder =>
                      !existingMessages.has(
                        reminder.message
                      )
                  )

              if (
                remindersToInsert.length >
                0
              ) {
                const {
                  error:
                    reminderInsertError,
                } =
                  await supabase
                    .from(
                      'notifications'
                    )
                    .insert(
                      remindersToInsert
                    )

                if (
                  reminderInsertError
                ) {
                  console.error(
                    'Create progress reminders error:',
                    reminderInsertError
                  )
                }
              }
            }
          }
        }
      } catch (reminderError) {
        console.error(
          'Progress reminder generation error:',
          reminderError
        )
      }
    } catch (loadError) {
      console.error(
        'Coach progress load error:',
        loadError
      )

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
    () =>
      students.find(
        student =>
          student.id === selectedId
      ) || null,
    [students, selectedId]
  )

  const selectedActionPlans =
    useMemo(
      () =>
        decodeActionPlans(
          selectedStudent
            ?.progress
            ?.coach_comment
        ),
      [
        selectedStudent
          ?.progress
          ?.coach_comment,
      ]
    )

  const searchMatchPlayers =
    useCallback(
      async (keyword, setter) => {
        const term = String(
          keyword || ''
        ).trim()

        if (term.length < 2) {
          setter([])
          return
        }

        try {
          const [
            registeredRes,
            publicRes,
          ] = await Promise.all([
            supabase
              .from(
                'player_profiles'
              )
              .select(
                'id, user_id, display_name, profile_photo_url'
              )
              .ilike(
                'display_name',
                `%${term}%`
              )
              .limit(6),

            supabase
              .from(
                'public_players'
              )
              .select('id, name')
              .ilike(
                'name',
                `%${term}%`
              )
              .limit(6),
          ])

          if (
            registeredRes.error
          ) {
            console.error(
              'Registered player search error:',
              registeredRes.error
            )
          }

          if (publicRes.error) {
            console.error(
              'Public player search error:',
              publicRes.error
            )
          }

          const registeredPlayers =
            (
              registeredRes.data ||
              []
            )
              .filter(
                player =>
                  String(
                    player.user_id ||
                      ''
                  ) !==
                  String(
                    selectedStudent?.id ||
                      ''
                  )
              )
              .map(player => ({
                id:
                  `registered-${player.id}`,
                profileId:
                  player.id,
                user_id:
                  player.user_id,
                display_name:
                  player.display_name,
                profile_photo_url:
                  player.profile_photo_url ||
                  '',
                source:
                  'Account',
              }))

          const publicPlayers =
            (
              publicRes.data || []
            ).map(player => ({
              id:
                `public-${player.id}`,
              publicId:
                player.id,
              user_id: null,
              display_name:
                player.name,
              profile_photo_url:
                '',
              source:
                'Public player',
            }))

          const seen = new Set()

          const merged = [
            ...registeredPlayers,
            ...publicPlayers,
          ]
            .filter(player => {
              const key = String(
                player.display_name ||
                  ''
              )
                .trim()
                .toLowerCase()

              if (
                !key ||
                seen.has(key)
              ) {
                return false
              }

              seen.add(key)
              return true
            })
            .slice(0, 8)

          setter(merged)
        } catch (searchError) {
          console.error(
            'Match player search error:',
            searchError
          )
          setter([])
        }
      },
      [selectedStudent?.id]
    )

  useEffect(() => {
    const timer = setTimeout(
      () =>
        searchMatchPlayers(
          matchForm.partnerName,
          setPartnerSuggestions
        ),
      250
    )

    return () => clearTimeout(timer)
  }, [
    matchForm.partnerName,
    searchMatchPlayers,
  ])

  useEffect(() => {
    const timer = setTimeout(
      () =>
        searchMatchPlayers(
          matchForm.opponent,
          setOpponent1Suggestions
        ),
      250
    )

    return () => clearTimeout(timer)
  }, [
    matchForm.opponent,
    searchMatchPlayers,
  ])

  useEffect(() => {
    const timer = setTimeout(
      () =>
        searchMatchPlayers(
          matchForm.opponent2,
          setOpponent2Suggestions
        ),
      250
    )

    return () => clearTimeout(timer)
  }, [
    matchForm.opponent2,
    searchMatchPlayers,
  ])

  const selectMatchPlayer = (
    field,
    player
  ) => {
    if (field === 'partner') {
      setMatchForm(current => ({
        ...current,
        partnerName:
          player.display_name,
        partnerUserId:
          player.user_id,
      }))
      setPartnerSuggestions([])
      return
    }

    if (field === 'opponent1') {
      setMatchForm(current => ({
        ...current,
        opponent:
          player.display_name,
        opponentUserId:
          player.user_id,
      }))
      setOpponent1Suggestions([])
      return
    }

    if (field === 'opponent2') {
      setMatchForm(current => ({
        ...current,
        opponent2:
          player.display_name,
        opponentUserId2:
          player.user_id,
      }))
      setOpponent2Suggestions([])
    }
  }

  const totalNotes = useMemo(
    () =>
      students.filter(
        hasMeaningfulProgressNote
      ).length,
    [students]
  )

  const resetMatchForm = () => {
    setMatchForm({
      date: new Date()
        .toISOString()
        .split('T')[0],
      type: 'Singles',
      opponent: '',
      opponentUserId: null,
      opponent2: '',
      opponentUserId2: null,
      partnerName: '',
      partnerUserId: null,
      score1: '',
      score2: '',
      score3: '',
      result: 'Win',
      notes: '',
    })

    setPartnerSuggestions([])
    setOpponent1Suggestions([])
    setOpponent2Suggestions([])
  }

  const openAddMatch = () => {
    resetMatchForm()
    setMatchModalOpen(true)
    setError('')
    setSuccess('')
  }

  const saveMatch = async () => {
    if (
      !user?.id ||
      !selectedStudent ||
      savingMatch
    ) {
      return
    }

    if (
      !matchForm.opponent.trim()
    ) {
      alert(
        'Please enter the opponent name.'
      )
      return
    }

    if (
      !matchForm.score1.trim()
    ) {
      alert(
        'Please enter at least Set 1 score.'
      )
      return
    }

    const isSingles =
      matchForm.type === 'Singles'

    if (
      !isSingles &&
      !matchForm.opponent2.trim()
    ) {
      alert(
        'Please enter Opponent 2 for doubles.'
      )
      return
    }

    setSavingMatch(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        player_id:
          selectedStudent.profileId,
        match_type:
          matchForm.type,
        match_date:
          matchForm.date,
        partner_name: isSingles
          ? null
          : matchForm.partnerName.trim() ||
            null,
        partner_user_id: isSingles
          ? null
          : matchForm.partnerUserId,
        opponent_name:
          matchForm.opponent.trim(),
        opponent_user_id:
          matchForm.opponentUserId,
        opponent_name2: isSingles
          ? null
          : matchForm.opponent2.trim() ||
            null,
        opponent_user_id2:
          isSingles
            ? null
            : matchForm.opponentUserId2,
        score1:
          matchForm.score1.trim(),
        score2:
          matchForm.score2.trim() ||
          null,
        score3:
          matchForm.score3.trim() ||
          null,
        result:
          matchForm.result,
        notes:
          matchForm.notes.trim() ||
          null,
        updated_at:
          new Date().toISOString(),
      }

      const {
        data,
        error: saveError,
      } = await supabase
        .from('player_matches')
        .insert(payload)
        .select('*')
        .single()

      if (saveError) {
        throw saveError
      }

      const newMatch =
        mapPlayerMatch(data)

      setStudents(current =>
        current.map(student =>
          student.id ===
          selectedStudent.id
            ? {
                ...student,
                matches: [
                  newMatch,
                  ...(student.matches ||
                    []),
                ],
              }
            : student
        )
      )

      setMatchModalOpen(false)
      resetMatchForm()

      setSuccess(
        `Match record added for ${selectedStudent.name}.`
      )
    } catch (saveError) {
      console.error(
        'Save coach match error:',
        saveError
      )

      setError(
        saveError.message ||
          'Unable to add the match record.'
      )
    } finally {
      setSavingMatch(false)
    }
  }

  const openMatchDetail = match => {
    setSelectedMatch(match)
    setMatchDetailOpen(true)
    setError('')
    setSuccess('')
  }

  const openInjuryDetail =
    injury => {
      setSelectedInjury(injury)
      setInjuryDetailOpen(true)
      setError('')
      setSuccess('')
    }

  const closeInjuryDetail = () => {
    setInjuryDetailOpen(false)
    setSelectedInjury(null)
  }

  const closeMatchDetail = () => {
    setMatchDetailOpen(false)
    setSelectedMatch(null)
  }

  const openMatchNote = match => {
    setSelectedMatch(match)
    setMatchNote(
      match.coachNote || ''
    )
    setMatchNoteOpen(true)
    setError('')
    setSuccess('')
  }

  const closeMatchNote = () => {
    if (savingMatchNote) return

    setMatchNoteOpen(false)
    setSelectedMatch(null)
    setMatchNote('')
  }

  const saveMatchNote = async () => {
    if (
      !user?.id ||
      !selectedStudent ||
      !selectedMatch ||
      savingMatchNote
    ) {
      return
    }

    if (!matchNote.trim()) {
      alert(
        'Please enter a coach note.'
      )
      return
    }

    setSavingMatchNote(true)
    setError('')
    setSuccess('')

    try {
      const now =
        new Date().toISOString()

      const {
        data,
        error: saveError,
      } = await supabase
        .from('coach_match_notes')
        .upsert(
          {
            match_id:
              selectedMatch.id,
            coach_user_id:
              user.id,
            player_user_id:
              selectedStudent.id,
            note:
              matchNote.trim(),
            updated_at: now,
          },
          {
            onConflict:
              'match_id,coach_user_id',
          }
        )
        .select('*')
        .single()

      if (saveError) {
        throw saveError
      }

      setStudents(current =>
        current.map(student =>
          student.id ===
          selectedStudent.id
            ? {
                ...student,
                matches: (
                  student.matches ||
                  []
                ).map(match =>
                  match.id ===
                  selectedMatch.id
                    ? {
                        ...match,
                        coachNote:
                          data.note ||
                          '',
                        coachNoteId:
                          data.id,
                      }
                    : match
                ),
              }
            : student
        )
      )

      setMatchNoteOpen(false)

      setSelectedMatch(current =>
        current
          ? {
              ...current,
              coachNote:
                data.note || '',
              coachNoteId:
                data.id,
            }
          : current
      )

      setMatchNote('')

      setSuccess(
        `Coach match note saved for ${selectedStudent.name}.`
      )
    } catch (saveError) {
      console.error(
        'Save coach match note error:',
        saveError
      )

      setError(
        saveError.message ||
          'Unable to save the coach match note.'
      )
    } finally {
      setSavingMatchNote(false)
    }
  }

  const openEditor = student => {
    const actionPlans =
      decodeActionPlans(
        student.progress
          ?.coach_comment
      )

    setSelectedId(student.id)

    setForm({
      progress_status:
        student.progress
          ?.progress_status ||
        'On track',

      focus_area:
        student.progress
          ?.focus_area || '',

      performance_comment:
        student.assessment
          ?.performance_comment ||
        '',

      performance_action_plan:
        actionPlans.performance ||
        '',

      performance_action_deadline:
        actionPlans.performanceDeadline ||
        '',

      performance_action_completion:
        actionPlans.performanceCompletion ||
        0,

      fitness_comment:
        student.assessment
          ?.fitness_comment ||
        '',

      fitness_action_plan:
        actionPlans.fitness || '',

      fitness_action_deadline:
        actionPlans.fitnessDeadline ||
        '',

      fitness_action_completion:
        actionPlans.fitnessCompletion ||
        0,

      next_review_date:
        student.progress
          ?.next_review_date ||
        '',

      smash: Number(
        student.assessment?.smash ??
          student.performance.smash
      ),

      defense: Number(
        student.assessment
          ?.defense ??
          student.performance.defense
      ),

      footwork: Number(
        student.assessment
          ?.footwork ??
          student.performance
            .footwork
      ),

      drop_shot: Number(
        student.assessment
          ?.drop_shot ??
          student.performance
            .dropShot
      ),

      net_play: Number(
        student.assessment
          ?.net_play ??
          student.performance
            .netPlay
      ),

      serve: Number(
        student.assessment?.serve ??
          student.performance.serve
      ),

      endurance: Number(
        student.assessment
          ?.endurance ??
          student.fitness.endurance
      ),

      speed: Number(
        student.assessment?.speed ??
          student.fitness.speed
      ),

      strength: Number(
        student.assessment
          ?.strength ??
          student.fitness.strength
      ),

      agility: Number(
        student.assessment
          ?.agility ??
          student.fitness
            .agility
      ),

      recovery: Number(
        student.assessment
          ?.recovery ??
          student.fitness.recovery
      ),
    })

    setEditOpen(true)
    setError('')
    setSuccess('')
  }

  const openRecommendationEditor =
    student => {
      setSelectedId(student.id)

      setInjuryRecommendation(
        student.progress
          ?.injury_recommendation ||
          ''
      )

      setRecommendationOpen(true)
      setError('')
      setSuccess('')
    }

  const saveInjuryRecommendation =
    async () => {
      if (
        !user?.id ||
        !selectedStudent ||
        savingRecommendation
      ) {
        return
      }

      setSavingRecommendation(true)
      setError('')
      setSuccess('')

      try {
        const now =
          new Date().toISOString()

        const {
          data,
          error: saveError,
        } = await supabase
          .from(
            'coach_player_progress'
          )
          .upsert(
            {
              coach_user_id:
                user.id,
              player_user_id:
                selectedStudent.id,
              injury_recommendation:
                injuryRecommendation.trim() ||
                null,
              updated_at: now,
            },
            {
              onConflict:
                'coach_user_id,player_user_id',
            }
          )
          .select('*')
          .single()

        if (saveError) {
          throw saveError
        }

        setStudents(current =>
          current.map(student =>
            student.id ===
            selectedStudent.id
              ? {
                  ...student,
                  progress: {
                    ...(student.progress ||
                      {}),
                    ...data,
                  },
                }
              : student
          )
        )

        setRecommendationOpen(
          false
        )

        setSuccess(
          injuryRecommendation.trim()
            ? `${selectedStudent.name}'s injury recommendation was saved.`
            : `${selectedStudent.name}'s injury recommendation was removed.`
        )
      } catch (saveError) {
        console.error(
          'Save injury recommendation error:',
          saveError
        )

        setError(
          saveError.message ||
            'Unable to save the injury recommendation.'
        )
      } finally {
        setSavingRecommendation(
          false
        )
      }
    }

  const saveProgress = async () => {
    if (
      !user?.id ||
      !selectedStudent ||
      saving
    ) {
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const progressPayload = {
        coach_user_id: user.id,
        player_user_id:
          selectedStudent.id,
        progress_status:
          form.progress_status,
        focus_area:
          form.focus_area.trim() ||
          null,
        coach_comment:
          encodeActionPlans({
            performance:
              form.performance_action_plan,
            performanceDeadline:
              form.performance_action_deadline,
            performanceCompletion:
              form.performance_action_completion,
            fitness:
              form.fitness_action_plan,
            fitnessDeadline:
              form.fitness_action_deadline,
            fitnessCompletion:
              form.fitness_action_completion,
          }),
        next_review_date:
          form.next_review_date ||
          null,
        updated_at:
          new Date().toISOString(),
      }

      const assessmentPayload = {
        coach_user_id: user.id,
        player_user_id:
          selectedStudent.id,
        smash: Number(
          form.smash
        ),
        defense: Number(
          form.defense
        ),
        footwork: Number(
          form.footwork
        ),
        drop_shot: Number(
          form.drop_shot
        ),
        net_play: Number(
          form.net_play
        ),
        serve: Number(
          form.serve
        ),
        endurance: Number(
          form.endurance
        ),
        speed: Number(
          form.speed
        ),
        strength: Number(
          form.strength
        ),
        agility: Number(
          form.agility
        ),
        recovery: Number(
          form.recovery
        ),
        performance_comment:
          form.performance_comment.trim() ||
          null,
        fitness_comment:
          form.fitness_comment.trim() ||
          null,
        updated_at:
          new Date().toISOString(),
      }

      const [
        progressSave,
        assessmentSave,
      ] = await Promise.all([
        supabase
          .from(
            'coach_player_progress'
          )
          .upsert(
            progressPayload,
            {
              onConflict:
                'coach_user_id,player_user_id',
            }
          )
          .select('*')
          .single(),

        supabase
          .from(
            'coach_player_assessments'
          )
          .upsert(
            assessmentPayload,
            {
              onConflict:
                'coach_user_id,player_user_id',
            }
          )
          .select('*')
          .single(),
      ])

      if (progressSave.error) {
        throw progressSave.error
      }

      if (assessmentSave.error) {
        throw assessmentSave.error
      }

      setStudents(current =>
        current.map(student =>
          student.id ===
          selectedStudent.id
            ? {
                ...student,
                progress:
                  progressSave.data,
                assessment:
                  assessmentSave.data,
              }
            : student
        )
      )

      setEditOpen(false)

      setSuccess(
        `${selectedStudent.name}'s progress was updated.`
      )
    } catch (saveError) {
      console.error(
        'Save coach progress error:',
        saveError
      )

      setError(
        saveError.message ||
          'Unable to save progress.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.progressPage}>
      <CoachPageHeader
        title="Player Progress"
        subtitle="View synced performance and fitness data for your accepted students"
        rightAction={
          <CoachNotificationBell
            supabase={supabase}
            mode="progress"
            title="Progress notifications"
          />
        }
      />

      <div
        className={styles.g4}
        style={{
          marginBottom: 16,
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: 12,
          width: '100%',
          minWidth: 0,
        }}
      >
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
              ? averageValues(students.map(student => student.performanceAverage))
              : 0,
            color: '#00A878',
            background: '#E0FAF3',
            icon: 'performance',
          },
          {
            label: 'Fitness avg',
            value: students.length
              ? averageValues(students.map(student => student.fitnessAverage))
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
        <div
          className={styles.g2}
          style={{
            display: 'grid',
            gridTemplateColumns: progressSingleColumn
              ? 'minmax(0, 1fr)'
              : progressCompact
                ? 'minmax(220px, 0.72fr) minmax(0, 1.28fr)'
                : 'minmax(220px, 0.72fr) minmax(0, 1.15fr) minmax(0, 1.2fr)',
            gap: 12,
            alignItems: 'start',
            width: '100%',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minWidth: 0,
              width: '100%',
            }}
          >
            {students.map(student => (
              <div
                key={student.id}
                onClick={() => setSelectedId(student.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: progressCompact
                    ? '38px minmax(0, 1fr)'
                    : '38px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  minWidth: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                  background:
                    selectedId === student.id ? '#E8EFFE' : '#FFFFFF',
                  border:
                    selectedId === student.id
                      ? '2px solid #1A5FFF'
                      : '1.5px solid #EEF1F8',
                }}
              >
                <Avatar name={student.name} size={38} />

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
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

                    {student.activeInjuryCount > 0 && (
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: '#FEF2F2',
                          color: '#DC2626',
                          fontSize: 11,
                          fontWeight: 600,
                          lineHeight: '1.2',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        {student.activeInjuryCount}{' '}
                        Active Injur
                        {student.activeInjuryCount === 1 ? 'y' : 'ies'}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    textAlign: progressCompact ? 'left' : 'right',
                    gridColumn: progressCompact ? '2 / 3' : 'auto',
                    display: progressCompact ? 'flex' : 'block',
                    alignItems: progressCompact ? 'center' : 'initial',
                    gap: progressCompact ? 6 : 0,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: '#8892A4',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Performance
                  </div>
                  <div
                    style={{
                      fontSize: progressCompact ? 14 : 16,
                      fontWeight: 700,
                      color: '#1A5FFF',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {student.performanceAverage}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedStudent && (
            <>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  minWidth: 0,
                  width: '100%',
                  height: '100%',
                }}
              >
                <div
                  className={styles.card}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
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
                          fontWeight: 700,
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
                      {selectedStudent.progress || selectedStudent.assessment
                        ? 'Update progress'
                        : 'Add progress'}
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      marginBottom: 24,
                    }}
                  >
                    <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
                      Performance skills
                    </div>

                    {selectedStudent.assessment && (
                      <span
                        style={{
                          fontSize: 11,
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
                          getMetricColor(field.label, value, 'performance')
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

                <div
                  className={styles.card}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      marginBottom: 24,
                    }}
                  >
                    <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
                      Fitness indicators
                    </div>

                    {selectedStudent.assessment && (
                      <span
                        style={{
                          fontSize: 11,
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
                      {formatDate(selectedStudent.progress?.next_review_date)}
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
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#1A5FFF',
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        marginBottom: 6,
                      }}
                    >
                      Performance feedback
                    </div>
                    <div
                      className={styles.progressBodyText}
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
                      background:
                        'color-mix(in srgb, #1A5FFF 7%, var(--soft, #F7F9FF))',
                      borderRadius: 10,
                      border:
                        '1px solid color-mix(in srgb, #1A5FFF 16%, var(--line, #EEF1F8))',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#1A5FFF',
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        marginBottom: 6,
                      }}
                    >
                      Performance action plan
                    </div>
                    <div
                      className={styles.progressBodyText}
                      style={{
                        color: 'var(--text, #0D1B3E)',
                        fontSize: 13,
                        lineHeight: 1.65,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedActionPlans.performance ||
                        'No performance action plan yet.'}
                    </div>

                    <ActionPlanProgress
                      deadline={
                        selectedActionPlans.performanceDeadline
                      }
                      completion={
                        selectedActionPlans.performanceCompletion
                      }
                      accentColor="#1A5FFF"
                    />
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
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#7C3AED',
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        marginBottom: 6,
                      }}
                    >
                      Fitness feedback
                    </div>
                    <div
                      className={styles.progressBodyText}
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

                  <div
                    style={{
                      marginTop: 10,
                      padding: 12,
                      background:
                        'color-mix(in srgb, #7C3AED 7%, var(--soft, #F7F9FF))',
                      borderRadius: 10,
                      border:
                        '1px solid color-mix(in srgb, #7C3AED 16%, var(--line, #EEF1F8))',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#7C3AED',
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                        marginBottom: 6,
                      }}
                    >
                      Fitness action plan
                    </div>
                    <div
                      className={styles.progressBodyText}
                      style={{
                        color: 'var(--text, #0D1B3E)',
                        fontSize: 13,
                        lineHeight: 1.65,
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedActionPlans.fitness ||
                        'No fitness action plan yet.'}
                    </div>

                    <ActionPlanProgress
                      deadline={
                        selectedActionPlans.fitnessDeadline
                      }
                      completion={
                        selectedActionPlans.fitnessCompletion
                      }
                      accentColor="#7C3AED"
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  minWidth: 0,
                  width: '100%',
                  gridColumn:
                    progressCompact && !progressSingleColumn
                      ? '1 / -1'
                      : 'auto',
                }}
              >
                <div className={styles.card}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div
                        className={styles.cardTitle}
                        style={{ marginBottom: 4 }}
                      >
                        Upcoming matches
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted, #8892A4)',
                          lineHeight: 1.5,
                        }}
                      >
                        Player-created upcoming matches appear here only when
                        {` ${selectedStudent.name} `}tags you as the coach.
                      </div>
                    </div>

                    {selectedStudent.upcomingMatches?.length > 0 && (
                      <span
                        style={{
                          padding: '4px 9px',
                          borderRadius: 999,
                          background:
                            'color-mix(in srgb, #F59E0B 12%, var(--card, #FFFFFF))',
                          color: '#B45309',
                          fontSize: 10,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {selectedStudent.upcomingMatches.length}{' '}
                        upcoming
                      </span>
                    )}
                  </div>

                  {!selectedStudent.upcomingMatches?.length ? (
                    <div
                      style={{
                        padding: '18px 14px',
                        borderRadius: 12,
                        background: 'var(--soft, #F7F9FF)',
                        color: 'var(--text-muted, #8892A4)',
                        fontSize: 12,
                        textAlign: 'center',
                        lineHeight: 1.55,
                      }}
                    >
                      No upcoming match has been tagged to you by this player.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 9,
                      }}
                    >
                      {selectedStudent.upcomingMatches
                        .slice(0, 5)
                        .map(match => (
                          <div
                            key={match.id}
                            style={{
                              padding: '12px 13px',
                              borderRadius: 11,
                              border:
                                '1px solid var(--line, #EEF1F8)',
                              background:
                                'var(--card, #FFFFFF)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 12,
                              }}
                            >
                              <div
                                style={{
                                  minWidth: 0,
                                  flex: 1,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 700,
                                      color:
                                        'var(--text, #0D1B3E)',
                                    }}
                                  >
                                    {match.title}
                                  </span>

                                  <span
                                    className={
                                      match.scheduleType ===
                                      'Competition'
                                        ? styles.badgeAmber
                                        : styles.badgeGreen
                                    }
                                  >
                                    {match.scheduleType}
                                  </span>

                                  <span
                                    className={styles.badgeBlue}
                                  >
                                    {match.matchType ||
                                      'Singles'}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    marginTop: 5,
                                    fontSize: 11,
                                    color:
                                      'var(--text-muted, #8892A4)',
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {formatDate(match.date)}
                                  {match.startTime
                                    ? ` • ${String(
                                        match.startTime
                                      ).slice(0, 5)}`
                                    : ''}
                                  {match.endTime
                                    ? `–${String(
                                        match.endTime
                                      ).slice(0, 5)}`
                                    : ''}
                                  {match.venue
                                    ? ` • ${match.venue}`
                                    : ''}
                                </div>

                                {match.notes && (
                                  <div
                                    style={{
                                      marginTop: 7,
                                      padding:
                                        '8px 9px',
                                      borderRadius: 8,
                                      background:
                                        'var(--soft, #F7F9FF)',
                                      color:
                                        'var(--text, #0D1B3E)',
                                      fontSize: 11,
                                      lineHeight: 1.5,
                                      whiteSpace:
                                        'pre-wrap',
                                    }}
                                  >
                                    {match.notes}
                                  </div>
                                )}
                              </div>

                              <span
                                style={{
                                  flexShrink: 0,
                                  padding: '4px 8px',
                                  borderRadius: 999,
                                  background:
                                    'color-mix(in srgb, #7C3AED 10%, var(--card, #FFFFFF))',
                                  color: '#7C3AED',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Tagged to you
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className={styles.card}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div
                        className={styles.cardTitle}
                        style={{ marginBottom: 4 }}
                      >
                        Match records
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted, #8892A4)',
                          lineHeight: 1.5,
                        }}
                      >
                        Showing the latest 5 matches. Open the full history to
                        view older records or coach notes.
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      {selectedStudent.matches?.length > 5 && (
                        <button
                          type="button"
                          className={styles.btnOutline}
                          onClick={() => setAllMatchesOpen(true)}
                          style={{
                            fontSize: 11,
                            padding: '7px 11px',
                          }}
                        >
                          View all ({selectedStudent.matches.length})
                        </button>
                      )}

                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={openAddMatch}
                        style={{
                          fontSize: 11,
                          padding: '7px 11px',
                        }}
                      >
                        + Add match
                      </button>
                    </div>
                  </div>

                  {!selectedStudent.matches?.length ? (
                    <div
                      style={{
                        padding: '20px 14px',
                        borderRadius: 12,
                        background: 'var(--soft, #F7F9FF)',
                        color: 'var(--text-muted, #8892A4)',
                        fontSize: 12,
                        textAlign: 'center',
                      }}
                    >
                      No match records found for this player.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 9,
                      }}
                    >
                      {selectedStudent.matches.slice(0, 5).map(match => (
                        <div
                          key={match.id}
                          onClick={() => openMatchDetail(match)}
                          style={{
                            padding: '12px 13px',
                            borderRadius: 11,
                            border: '1px solid var(--line, #EEF1F8)',
                            background: 'var(--card, #FFFFFF)',
                            cursor: 'pointer',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 7,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: 'var(--text, #0D1B3E)',
                                  }}
                                >
                                  vs {match.opponent}
                                </span>

                                <span
                                  className={
                                    match.result === 'Win'
                                      ? styles.badgeGreen
                                      : styles.badgeRed
                                  }
                                >
                                  {match.result}
                                </span>
                              </div>

                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: 11,
                                  color: 'var(--text-muted, #8892A4)',
                                }}
                              >
                                {formatDate(match.date)}
                                {' • '}
                                {match.type}
                                {match.score ? ` • ${match.score}` : ''}
                              </div>

                              {match.playerNotes && (
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: 11,
                                    color: 'var(--text-muted, #8892A4)',
                                    lineHeight: 1.5,
                                  }}
                                >
                                  Player note: {match.playerNotes}
                                </div>
                              )}
                            </div>

                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted, #8892A4)',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              View details
                            </div>
                          </div>

                          {match.coachNote && (
                            <div
                              style={{
                                marginTop: 10,
                                padding: '10px 11px',
                                borderRadius: 9,
                                background:
                                  'color-mix(in srgb, #7C3AED 8%, var(--soft, #F7F9FF))',
                                borderLeft: '3px solid #7C3AED',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: '#7C3AED',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                  marginBottom: 4,
                                }}
                              >
                                Coach match note
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  lineHeight: 1.55,
                                  color: 'var(--text, #0D1B3E)',
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {match.coachNote}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.card}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div
                        className={styles.cardTitle}
                        style={{ marginBottom: 4 }}
                      >
                        Injury & recovery status
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted, #8892A4)',
                          lineHeight: 1.5,
                        }}
                      >
                        Showing up to 3 active injuries. Resolved and older
                        records remain available in the full injury history.
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      {selectedStudent.injuries.length > 0 && (
                        <button
                          type="button"
                          className={styles.btnOutline}
                          onClick={() => setAllInjuriesOpen(true)}
                          style={{
                            fontSize: 11,
                            padding: '7px 11px',
                          }}
                        >
                          View all ({selectedStudent.injuries.length})
                        </button>
                      )}

                      <button
                        type="button"
                        className={styles.btnOutline}
                        onClick={() =>
                          openRecommendationEditor(selectedStudent)
                        }
                        style={{
                          fontSize: 11,
                          padding: '7px 11px',
                        }}
                      >
                        {selectedStudent.progress?.injury_recommendation
                          ? 'Edit recommendation'
                          : 'Add recommendation'}
                      </button>
                    </div>
                  </div>

                  {selectedStudent.injuries.filter(injury => injury.isActive)
                    .length === 0 ? (
                    <div
                      style={{
                        padding: '20px 14px',
                        borderRadius: 12,
                        background: 'var(--soft, #F7F9FF)',
                        color: 'var(--text-muted, #8892A4)',
                        fontSize: 12,
                        textAlign: 'center',
                      }}
                    >
                      {selectedStudent.injuries.length === 0
                        ? 'No injury records have been added by this player.'
                        : 'No active injuries. Use View all to see recovered injury history.'}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          viewportWidth <= 1050
                            ? 'minmax(0, 1fr)'
                            : '180px minmax(0, 1fr)',
                        gap: 16,
                        alignItems: 'stretch',
                        minWidth: 0,
                      }}
                    >
                      <InjuryBodyMap
                        injuries={selectedStudent.injuries
                          .filter(injury => injury.isActive)
                          .slice(0, 3)}
                      />

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: 9,
                          minWidth: 0,
                          minHeight: 240,
                        }}
                      >
                        {selectedStudent.injuries
                          .filter(injury => injury.isActive)
                          .slice(0, 3)
                          .map(injury => {
                            const statusColor =
                              getInjuryStatusColor(injury.status)
                            const severityColor =
                              getInjurySeverityColor(injury.severity)

                            return (
                              <div
                                key={injury.id}
                                onClick={() => openInjuryDetail(injury)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={event => {
                                  if (
                                    event.key === 'Enter' ||
                                    event.key === ' '
                                  ) {
                                    event.preventDefault()
                                    openInjuryDetail(injury)
                                  }
                                }}
                                style={{
                                  padding: '11px 12px',
                                  borderRadius: 11,
                                  border:
                                    '1px solid var(--line, #EEF1F8)',
                                  background: 'var(--card, #FFFFFF)',
                                  cursor: 'pointer',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                  }}
                                >
                                  <div
                                    style={{
                                      minWidth: 0,
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: 9,
                                    }}
                                  >
                                    {injury.imageUrl && (
                                      <img
                                        src={injury.imageUrl}
                                        alt=""
                                        style={{
                                          width: 42,
                                          height: 42,
                                          borderRadius: 8,
                                          objectFit: 'cover',
                                          flexShrink: 0,
                                          background:
                                            'var(--soft, #F7F9FF)',
                                        }}
                                      />
                                    )}

                                    <div style={{ minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontSize: 12,
                                          fontWeight: 700,
                                          color:
                                            'var(--text, #0D1B3E)',
                                          overflowWrap: 'anywhere',
                                        }}
                                      >
                                        {injury.name}
                                      </div>

                                      <div
                                        style={{
                                          marginTop: 3,
                                          fontSize: 11,
                                          color:
                                            'var(--text-muted, #8892A4)',
                                        }}
                                      >
                                        Logged {formatDate(injury.date)}
                                      </div>

                                      <div
                                        style={{
                                          marginTop: 4,
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: severityColor,
                                        }}
                                      >
                                        {injury.severity || 'Mild'} severity
                                      </div>
                                    </div>
                                  </div>

                                  <span
                                    style={{
                                      flexShrink: 0,
                                      padding: '3px 8px',
                                      borderRadius: 999,
                                      background:
                                        `color-mix(in srgb, ${statusColor} 12%, var(--card, #FFFFFF))`,
                                      color: statusColor,
                                      fontSize: 9,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {injury.status}
                                  </span>
                                </div>

                                {injury.notes && (
                                  <div
                                    style={{
                                      marginTop: 8,
                                      padding: '8px 9px',
                                      borderRadius: 8,
                                      background: 'var(--soft, #F7F9FF)',
                                      fontSize: 11,
                                      lineHeight: 1.55,
                                      color: 'var(--text, #0D1B3E)',
                                      whiteSpace: 'pre-wrap',
                                    }}
                                  >
                                    {injury.notes}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 11,
                      background:
                        'color-mix(in srgb, #7C3AED 8%, var(--soft, #F7F9FF))',
                      border:
                        '1px solid color-mix(in srgb, #7C3AED 18%, var(--line, #EEF1F8))',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#7C3AED',
                        textTransform: 'uppercase',
                        letterSpacing: 0.55,
                        marginBottom: 5,
                      }}
                    >
                      Coach training recommendation
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        lineHeight: 1.6,
                        color: 'var(--text, #0D1B3E)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedStudent.progress?.injury_recommendation ||
                        'No injury recommendation yet. This is separate from performance and fitness feedback.'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {allMatchesOpen && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              setAllMatchesOpen(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 760,
              width: '92vw',
              maxHeight: '88vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>
                  Match history
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: 'var(--text-muted, #8892A4)',
                  }}
                >
                  {selectedStudent.name} • {selectedStudent.matches.length}{' '}
                  match{selectedStudent.matches.length === 1 ? '' : 'es'}
                </div>
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setAllMatchesOpen(false)}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: 12,
              }}
            >
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => {
                  setAllMatchesOpen(false)
                  openAddMatch()
                }}
                style={{ fontSize: 11 }}
              >
                + Add match
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
              }}
            >
              {selectedStudent.matches.map(match => (
                <div
                  key={match.id}
                  onClick={() => {
                    setAllMatchesOpen(false)
                    openMatchDetail(match)
                  }}
                  style={{
                    padding: '12px 13px',
                    borderRadius: 11,
                    border: '1px solid var(--line, #EEF1F8)',
                    background: 'var(--card, #FFFFFF)',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--text, #0D1B3E)',
                          }}
                        >
                          vs {match.opponent}
                        </span>

                        <span
                          className={
                            match.result === 'Win'
                              ? styles.badgeGreen
                              : styles.badgeRed
                          }
                        >
                          {match.result}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: 'var(--text-muted, #8892A4)',
                        }}
                      >
                        {formatDate(match.date)}
                        {' • '}
                        {match.type}
                        {match.score ? ` • ${match.score}` : ''}
                      </div>

                      {match.coachNote && (
                        <div
                          style={{
                            marginTop: 7,
                            fontSize: 11,
                            color: '#7C3AED',
                            fontWeight: 700,
                          }}
                        >
                          Coach note added
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted, #8892A4)',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      View details
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {allInjuriesOpen && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              setAllInjuriesOpen(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 820,
              width: '92vw',
              maxHeight: '88vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>
                  Injury history
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: 'var(--text-muted, #8892A4)',
                  }}
                >
                  {selectedStudent.name} • {selectedStudent.injuries.length}{' '}
                  record{selectedStudent.injuries.length === 1 ? '' : 's'}
                </div>
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setAllInjuriesOpen(false)}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  viewportWidth <= 700
                    ? 'minmax(0, 1fr)'
                    : '200px minmax(0, 1fr)',
                gap: 18,
                alignItems: 'start',
                minWidth: 0,
              }}
            >
              <InjuryBodyMap injuries={selectedStudent.injuries} />

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                  minWidth: 0,
                }}
              >
                {selectedStudent.injuries.map(injury => {
                  const statusColor =
                    getInjuryStatusColor(injury.status)
                  const severityColor =
                    getInjurySeverityColor(injury.severity)

                  return (
                    <div
                      key={injury.id}
                      onClick={() => {
                        setAllInjuriesOpen(false)
                        openInjuryDetail(injury)
                      }}
                      style={{
                        padding: '12px 13px',
                        borderRadius: 11,
                        border: '1px solid var(--line, #EEF1F8)',
                        background: 'var(--card, #FFFFFF)',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: 'var(--text, #0D1B3E)',
                            }}
                          >
                            {injury.name}
                          </div>
                          <div
                            style={{
                              marginTop: 3,
                              fontSize: 11,
                              color: 'var(--text-muted, #8892A4)',
                            }}
                          >
                            Logged {formatDate(injury.date)}
                          </div>
                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              color: severityColor,
                            }}
                          >
                            {injury.severity || 'Mild'} severity
                          </div>
                        </div>

                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 999,
                            background:
                              `color-mix(in srgb, ${statusColor} 12%, var(--card, #FFFFFF))`,
                            color: statusColor,
                            fontSize: 9,
                            fontWeight: 700,
                          }}
                        >
                          {injury.status}
                        </span>
                      </div>

                      {injury.notes && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: '8px 9px',
                            borderRadius: 8,
                            background: 'var(--soft, #F7F9FF)',
                            fontSize: 11,
                            lineHeight: 1.55,
                            color: 'var(--text, #0D1B3E)',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {injury.notes}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {injuryDetailOpen && selectedStudent && selectedInjury && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              closeInjuryDetail()
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 620,
              width: '92vw',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>
                  Injury details
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: 'var(--text-muted, #8892A4)',
                  }}
                >
                  {selectedStudent.name}
                </div>
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={closeInjuryDetail}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  viewportWidth <= 700
                    ? 'minmax(0, 1fr)'
                    : '150px minmax(0, 1fr)',
                gap: 18,
                alignItems: 'start',
                minWidth: 0,
              }}
            >
              <div>
                <div
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: '1px solid var(--line, #EEF1F8)',
                    background: 'var(--soft, #F7F9FF)',
                  }}
                >
                  <svg
                    viewBox="0 0 120 170"
                    width="130"
                    height="180"
                    role="img"
                    aria-label="Selected injury location"
                    style={{ display: 'block', margin: '0 auto' }}
                  >
                    <image
                      href="/humanbody.png"
                      x="18"
                      y="0"
                      width="84"
                      height="170"
                      preserveAspectRatio="xMidYMid meet"
                      pointerEvents="none"
                    />

                    {(() => {
                      const hasSavedPoint =
                        selectedInjury.bodyX !== null &&
                        selectedInjury.bodyX !== undefined &&
                        selectedInjury.bodyY !== null &&
                        selectedInjury.bodyY !== undefined &&
                        Number.isFinite(Number(selectedInjury.bodyX)) &&
                        Number.isFinite(Number(selectedInjury.bodyY))

                      const point = hasSavedPoint
                        ? {
                            cx: Number(selectedInjury.bodyX),
                            cy: Number(selectedInjury.bodyY),
                          }
                        : getFallbackInjuryPoint(selectedInjury.name)

                      return (
                        <>
                          <circle
                            cx={point.cx}
                            cy={point.cy}
                            r="8"
                            fill="var(--card, #FFFFFF)"
                          />
                          <circle
                            cx={point.cx}
                            cy={point.cy}
                            r="5"
                            fill={getInjuryStatusColor(
                              selectedInjury.status
                            )}
                          />
                        </>
                      )
                    })()}
                  </svg>
                </div>

                {selectedInjury.imageUrl && (
                  <img
                    src={selectedInjury.imageUrl}
                    alt="Injury"
                    style={{
                      marginTop: 12,
                      width: '100%',
                      maxHeight: 180,
                      objectFit: 'cover',
                      borderRadius: 12,
                      border: '1px solid var(--line, #EEF1F8)',
                    }}
                  />
                )}
              </div>

              <div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--text, #0D1B3E)',
                    marginBottom: 14,
                  }}
                >
                  {selectedInjury.name}
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Date</span>
                  <span className={styles.statVal}>
                    {formatDate(selectedInjury.date)}
                  </span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Status</span>
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                      color: getInjuryStatusColor(selectedInjury.status),
                      background:
                        `color-mix(in srgb, ${getInjuryStatusColor(
                          selectedInjury.status
                        )} 12%, var(--card, #FFFFFF))`,
                    }}
                  >
                    {selectedInjury.status}
                  </span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Severity</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: getInjurySeverityColor(selectedInjury.severity),
                    }}
                  >
                    {selectedInjury.severity || 'Mild'}
                  </span>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-muted, #8892A4)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.55,
                      marginBottom: 6,
                    }}
                  >
                    Notes
                  </div>

                  <div
                    style={{
                      minHeight: 70,
                      padding: '12px 13px',
                      borderRadius: 10,
                      background: 'var(--soft, #F7F9FF)',
                      color: 'var(--text, #0D1B3E)',
                      fontSize: 12,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedInjury.notes || 'No notes provided.'}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 18,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={closeInjuryDetail}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {matchDetailOpen && selectedStudent && selectedMatch && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              closeMatchDetail()
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 560,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Match Details
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={closeMatchDetail}
              >
                ×
              </button>
            </div>

            <div
              style={{
                background:
                  selectedMatch.result === 'Win'
                    ? 'rgba(0, 196, 140, 0.10)'
                    : 'rgba(239, 68, 68, 0.10)',
                borderRadius: 12,
                padding: '14px 16px',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--text, #0D1B3E)',
                  }}
                >
                  vs {selectedMatch.opponent}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted, #8892A4)',
                    marginTop: 3,
                  }}
                >
                  {selectedMatch.type}
                  {' • '}
                  {formatDate(selectedMatch.date)}
                </div>
              </div>

              <span
                className={
                  selectedMatch.result === 'Win'
                    ? styles.badgeGreen
                    : styles.badgeRed
                }
              >
                {selectedMatch.result}
              </span>
            </div>

            {selectedMatch.type !== 'Singles' && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Player partner</span>
                <span className={styles.statVal}>
                  {selectedMatch.partnerName || '—'}
                </span>
              </div>
            )}

            {[
              ['Opponent', selectedMatch.opponent],
              ['Match type', selectedMatch.type],
              ['Date', formatDate(selectedMatch.date)],
              ['Set 1', selectedMatch.score1 || '—'],
              ['Set 2', selectedMatch.score2 || '—'],
              ['Set 3', selectedMatch.score3 || '—'],
            ].map(([label, value]) => (
              <div className={styles.statRow} key={label}>
                <span className={styles.statLabel}>{label}</span>
                <span className={styles.statVal}>{value}</span>
              </div>
            ))}

            <div
              className={styles.statRow}
              style={{ alignItems: 'flex-start' }}
            >
              <span className={styles.statLabel}>Player match note</span>
              <span
                className={styles.statVal}
                style={{
                  textAlign: 'right',
                  whiteSpace: 'pre-wrap',
                  maxWidth: 330,
                }}
              >
                {selectedMatch.playerNotes || '—'}
              </span>
            </div>

            <div style={{ marginTop: 18 }}>
              <div
                className={styles.cardTitle}
                style={{ marginBottom: 8 }}
              >
                Match video
              </div>

              {selectedMatch.videoUrl ? (
                <video
                  src={selectedMatch.videoUrl}
                  controls
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    background: '#000',
                    maxHeight: 260,
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '24px 16px',
                    borderRadius: 12,
                    background: 'var(--soft, #F7F9FF)',
                    border: '1px dashed var(--line, #EEF1F8)',
                    color: 'var(--text-muted, #8892A4)',
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                >
                  No video uploaded for this match.
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 12,
                borderRadius: 10,
                background:
                  'color-mix(in srgb, #7C3AED 8%, var(--soft, #F7F9FF))',
                border:
                  '1px solid color-mix(in srgb, #7C3AED 18%, var(--line, #EEF1F8))',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#7C3AED',
                  textTransform: 'uppercase',
                  letterSpacing: 0.55,
                  marginBottom: 5,
                }}
              >
                Coach match note
              </div>

              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: 'var(--text, #0D1B3E)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedMatch.coachNote ||
                  'No coach note has been added for this match yet.'}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 18,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={closeMatchDetail}
              >
                Close
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => {
                  setMatchDetailOpen(false)
                  openMatchNote(selectedMatch)
                }}
              >
                {selectedMatch.coachNote
                  ? 'Edit coach note'
                  : 'Add coach note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {matchModalOpen && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (
              event.target === event.currentTarget &&
              !savingMatch
            ) {
              setMatchModalOpen(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 600,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Add match for {selectedStudent.name}
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setMatchModalOpen(false)}
                disabled={savingMatch}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  viewportWidth <= 700
                    ? 'minmax(0, 1fr)'
                    : 'repeat(2, minmax(0, 1fr))',
                gap: 12,
              }}
            >
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Date</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={matchForm.date}
                  onChange={event =>
                    setMatchForm(current => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                  disabled={savingMatch}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Match type</label>
                <select
                  className={styles.formSelect}
                  value={matchForm.type}
                  onChange={event =>
                    setMatchForm(current => ({
                      ...current,
                      type: event.target.value,
                      partnerName:
                        event.target.value === 'Singles'
                          ? ''
                          : current.partnerName,
                      partnerUserId:
                        event.target.value === 'Singles'
                          ? null
                          : current.partnerUserId,
                      opponent2:
                        event.target.value === 'Singles'
                          ? ''
                          : current.opponent2,
                      opponentUserId2:
                        event.target.value === 'Singles'
                          ? null
                          : current.opponentUserId2,
                    }))
                  }
                  disabled={savingMatch}
                >
                  <option>Singles</option>
                  <option>Mixed Doubles</option>
                  <option>Womens Doubles</option>
                  <option>Mens Double</option>
                </select>
              </div>
            </div>

            {matchForm.type !== 'Singles' && (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  Player partner
                </label>
                <input
                  className={styles.formInput}
                  placeholder="Search account or type manually"
                  value={matchForm.partnerName}
                  onChange={event =>
                    setMatchForm(current => ({
                      ...current,
                      partnerName: event.target.value,
                      partnerUserId: null,
                    }))
                  }
                  disabled={savingMatch}
                />
                <MatchPlayerSuggestions
                  items={partnerSuggestions}
                  onSelect={player =>
                    selectMatchPlayer('partner', player)
                  }
                />
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  matchForm.type === 'Singles' || viewportWidth <= 700
                    ? 'minmax(0, 1fr)'
                    : 'repeat(2, minmax(0, 1fr))',
                gap: 12,
              }}
            >
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  {matchForm.type === 'Singles'
                    ? 'Opponent'
                    : 'Opponent 1'}
                </label>
                <input
                  className={styles.formInput}
                  placeholder="Search account or type manually"
                  value={matchForm.opponent}
                  onChange={event =>
                    setMatchForm(current => ({
                      ...current,
                      opponent: event.target.value,
                      opponentUserId: null,
                    }))
                  }
                  disabled={savingMatch}
                />
                <MatchPlayerSuggestions
                  items={opponent1Suggestions}
                  onSelect={player =>
                    selectMatchPlayer('opponent1', player)
                  }
                />
              </div>

              {matchForm.type !== 'Singles' && (
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>
                    Opponent 2
                  </label>
                  <input
                    className={styles.formInput}
                    placeholder="Search account or type manually"
                    value={matchForm.opponent2}
                    onChange={event =>
                      setMatchForm(current => ({
                        ...current,
                        opponent2: event.target.value,
                        opponentUserId2: null,
                      }))
                    }
                    disabled={savingMatch}
                  />
                  <MatchPlayerSuggestions
                    items={opponent2Suggestions}
                    onSelect={player =>
                      selectMatchPlayer('opponent2', player)
                    }
                  />
                </div>
              )}
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Game score</label>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    viewportWidth <= 560
                      ? 'minmax(0, 1fr)'
                      : 'repeat(3, minmax(0, 1fr))',
                  gap: 10,
                }}
              >
                {[
                  ['score1', 'Set 1', '21-18'],
                  ['score2', 'Set 2', '21-15'],
                  ['score3', 'Set 3', '—'],
                ].map(([key, label, placeholder]) => (
                  <div key={key}>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted, #8892A4)',
                        marginBottom: 5,
                      }}
                    >
                      {label}
                    </div>
                    <input
                      className={styles.formInput}
                      placeholder={placeholder}
                      value={matchForm[key]}
                      onChange={event =>
                        setMatchForm(current => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      disabled={savingMatch}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Result</label>
              <select
                className={styles.formSelect}
                value={matchForm.result}
                onChange={event =>
                  setMatchForm(current => ({
                    ...current,
                    result: event.target.value,
                  }))
                }
                disabled={savingMatch}
              >
                <option>Win</option>
                <option>Loss</option>
              </select>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Match notes</label>
              <textarea
                className={styles.formTextarea}
                rows={3}
                placeholder="Optional notes for this match record."
                value={matchForm.notes}
                onChange={event =>
                  setMatchForm(current => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                disabled={savingMatch}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 14,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setMatchModalOpen(false)}
                disabled={savingMatch}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                onClick={saveMatch}
                disabled={savingMatch}
              >
                {savingMatch ? 'Saving...' : 'Add match'}
              </button>
            </div>
          </div>
        </div>
      )}

      {matchNoteOpen && selectedStudent && selectedMatch && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (
              event.target === event.currentTarget &&
              !savingMatchNote
            ) {
              closeMatchNote()
            }
          }}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 520 }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Coach match note
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={closeMatchNote}
                disabled={savingMatchNote}
              >
                ×
              </button>
            </div>

            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 10,
                background: 'var(--soft, #F7F9FF)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text, #0D1B3E)',
                }}
              >
                {selectedStudent.name} vs {selectedMatch.opponent}
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: 'var(--text-muted, #8892A4)',
                }}
              >
                {formatDate(selectedMatch.date)}
                {' • '}
                {selectedMatch.type}
                {selectedMatch.score ? ` • ${selectedMatch.score}` : ''}
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Coach note</label>

              <textarea
                className={styles.formTextarea}
                rows={6}
                maxLength={1000}
                placeholder="Write observations about this match, strengths, mistakes, and areas to improve."
                value={matchNote}
                onChange={event => setMatchNote(event.target.value)}
                disabled={savingMatchNote}
              />

              <div
                style={{
                  marginTop: 5,
                  textAlign: 'right',
                  color: 'var(--text-muted, #8892A4)',
                  fontSize: 11,
                }}
              >
                {matchNote.length}/1000
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 14,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={closeMatchNote}
                disabled={savingMatchNote}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                onClick={saveMatchNote}
                disabled={savingMatchNote}
              >
                {savingMatchNote ? 'Saving...' : 'Save note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {recommendationOpen && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (
              event.target === event.currentTarget &&
              !savingRecommendation
            ) {
              setRecommendationOpen(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 520 }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Injury training recommendation
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setRecommendationOpen(false)}
                disabled={savingRecommendation}
              >
                ×
              </button>
            </div>

            <div
              style={{
                marginBottom: 14,
                color: 'var(--text-muted, #8892A4)',
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              Add training guidance for{' '}
              <strong>{selectedStudent.name}</strong>.
              This recommendation is separate from
              performance feedback and fitness feedback.
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Recommendation
              </label>

              <textarea
                className={styles.formTextarea}
                rows={6}
                maxLength={1000}
                placeholder="Example: Avoid overhead drills this week. Use light footwork and mobility exercises."
                value={injuryRecommendation}
                onChange={event =>
                  setInjuryRecommendation(event.target.value)
                }
                disabled={savingRecommendation}
              />

              <div
                style={{
                  marginTop: 5,
                  textAlign: 'right',
                  color: 'var(--text-muted, #8892A4)',
                  fontSize: 11,
                }}
              >
                {injuryRecommendation.length}/1000
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 14,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setRecommendationOpen(false)}
                disabled={savingRecommendation}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                onClick={saveInjuryRecommendation}
                disabled={savingRecommendation}
              >
                {savingRecommendation
                  ? 'Saving...'
                  : 'Save recommendation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editOpen && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setEditOpen(false)
            }
          }}
          style={{ padding: 18 }}
        >
          <div
            className={styles.modal}
            style={{
              width: 'min(1180px, 96vw)',
              maxWidth: 1180,
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: 0,
            }}
          >
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: 'var(--card, #FFFFFF)',
                padding: '18px 22px 14px',
                borderBottom:
                  '1px solid var(--line, #EEF1F8)',
              }}
            >
              <div
                className={styles.modalHead}
                style={{ marginBottom: 0 }}
              >
                <div>
                  <div className={styles.modalTitle}>
                    {selectedStudent.progress || selectedStudent.assessment
                      ? `Update ${selectedStudent.name}'s progress`
                      : `Add progress for ${selectedStudent.name}`}
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: 'var(--text-muted, #8892A4)',
                    }}
                  >
                    Performance and fitness are placed side by side so the
                    form does not become one long narrow column.
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ padding: '18px 22px 22px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <div
                  className={styles.formRow}
                  style={{ marginBottom: 0 }}
                >
                  <label className={styles.formLabel}>
                    Progress status
                  </label>
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

                <div
                  className={styles.formRow}
                  style={{ marginBottom: 0 }}
                >
                  <label className={styles.formLabel}>
                    Focus area
                  </label>
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

                <div
                  className={styles.formRow}
                  style={{ marginBottom: 0 }}
                >
                  <label className={styles.formLabel}>
                    Next review date
                  </label>
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
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    viewportWidth <= 1050
                      ? 'minmax(0, 1fr)'
                      : 'repeat(2, minmax(0, 1fr))',
                  gap: 18,
                  alignItems: 'start',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    padding: 18,
                    borderRadius: 14,
                    border: '1px solid var(--line, #EEF1F8)',
                    background:
                      'color-mix(in srgb, #00A878 3%, var(--card, #FFFFFF))',
                  }}
                >
                  <div
                    className={styles.cardTitle}
                    style={{
                      marginBottom: 14,
                      color: '#00A878',
                    }}
                  >
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
                    <AssessmentSlider
                      key={key}
                      label={label}
                      value={form[key]}
                      accentColor="#00A878"
                      onChange={value =>
                        setForm(current => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                    />
                  ))}

                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: '1px solid var(--line, #EEF1F8)',
                    }}
                  >
                    <div className={styles.formRow}>
                      <label className={styles.formLabel}>
                        Performance feedback
                      </label>
                      <textarea
                        className={styles.formTextarea}
                        rows={4}
                        maxLength={1000}
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
                        Performance action plan
                      </label>
                      <textarea
                        className={styles.formTextarea}
                        rows={4}
                        maxLength={1000}
                        placeholder="Example: Practise defensive footwork for 20 minutes, 3 sessions per week until the next review."
                        value={form.performance_action_plan}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            performance_action_plan: event.target.value,
                          }))
                        }
                      />
                      <div
                        style={{
                          marginTop: 5,
                          textAlign: 'right',
                          color: 'var(--text-muted, #8892A4)',
                          fontSize: 11,
                        }}
                      >
                        {form.performance_action_plan.length}/1000
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          viewportWidth <= 700
                            ? 'minmax(0, 1fr)'
                            : 'minmax(160px, 0.7fr) minmax(220px, 1.3fr)',
                        gap: 14,
                        alignItems: 'end',
                      }}
                    >
                      <div className={styles.formRow}>
                        <label className={styles.formLabel}>
                          Action plan deadline
                        </label>
                        <input
                          className={styles.formInput}
                          type="date"
                          value={
                            form.performance_action_deadline
                          }
                          onChange={event =>
                            setForm(current => ({
                              ...current,
                              performance_action_deadline:
                                event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className={styles.formRow}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            marginBottom: 6,
                          }}
                        >
                          <label
                            className={styles.formLabel}
                            style={{ marginBottom: 0 }}
                          >
                            Completion rate
                          </label>

                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#00A878',
                            }}
                          >
                            {form.performance_action_completion}%
                          </span>
                        </div>

                        <div
                          aria-label={`Performance action plan ${form.performance_action_completion}% complete`}
                          style={{
                            height: 8,
                            borderRadius: 999,
                            background:
                              'var(--line, #EEF1F8)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${clamp(
                                form.performance_action_completion
                              )}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: '#00A878',
                            }}
                          />
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 10,
                            color:
                              'var(--text-muted, #8892A4)',
                          }}
                        >
                          Updated by the player
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    padding: 18,
                    borderRadius: 14,
                    border: '1px solid var(--line, #EEF1F8)',
                    background:
                      'color-mix(in srgb, #7C3AED 3%, var(--card, #FFFFFF))',
                  }}
                >
                  <div
                    className={styles.cardTitle}
                    style={{
                      marginBottom: 14,
                      color: '#7C3AED',
                    }}
                  >
                    Coach fitness assessment
                  </div>

                  {[
                    ['endurance', 'Endurance'],
                    ['speed', 'Speed'],
                    ['strength', 'Strength'],
                    ['agility', 'Agility'],
                    ['recovery', 'Recovery'],
                  ].map(([key, label]) => (
                    <AssessmentSlider
                      key={key}
                      label={label}
                      value={form[key]}
                      accentColor="#7C3AED"
                      onChange={value =>
                        setForm(current => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                    />
                  ))}

                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: '1px solid var(--line, #EEF1F8)',
                    }}
                  >
                    <div className={styles.formRow}>
                      <label className={styles.formLabel}>
                        Fitness feedback
                      </label>
                      <textarea
                        className={styles.formTextarea}
                        rows={4}
                        maxLength={1000}
                        placeholder="Write feedback about fitness, recovery, endurance, strength or conditioning."
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
                      <label className={styles.formLabel}>
                        Fitness action plan
                      </label>
                      <textarea
                        className={styles.formTextarea}
                        rows={4}
                        maxLength={1000}
                        placeholder="Example: Complete interval running 3 times per week and record recovery after every session."
                        value={form.fitness_action_plan}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            fitness_action_plan: event.target.value,
                          }))
                        }
                      />
                      <div
                        style={{
                          marginTop: 5,
                          textAlign: 'right',
                          color: 'var(--text-muted, #8892A4)',
                          fontSize: 11,
                        }}
                      >
                        {form.fitness_action_plan.length}/1000
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          viewportWidth <= 700
                            ? 'minmax(0, 1fr)'
                            : 'minmax(160px, 0.7fr) minmax(220px, 1.3fr)',
                        gap: 14,
                        alignItems: 'end',
                      }}
                    >
                      <div className={styles.formRow}>
                        <label className={styles.formLabel}>
                          Action plan deadline
                        </label>
                        <input
                          className={styles.formInput}
                          type="date"
                          value={
                            form.fitness_action_deadline
                          }
                          onChange={event =>
                            setForm(current => ({
                              ...current,
                              fitness_action_deadline:
                                event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className={styles.formRow}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            marginBottom: 6,
                          }}
                        >
                          <label
                            className={styles.formLabel}
                            style={{ marginBottom: 0 }}
                          >
                            Completion rate
                          </label>

                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#7C3AED',
                            }}
                          >
                            {form.fitness_action_completion}%
                          </span>
                        </div>

                        <div
                          aria-label={`Fitness action plan ${form.fitness_action_completion}% complete`}
                          style={{
                            height: 8,
                            borderRadius: 999,
                            background:
                              'var(--line, #EEF1F8)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${clamp(
                                form.fitness_action_completion
                              )}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: '#7C3AED',
                            }}
                          />
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 10,
                            color:
                              'var(--text-muted, #8892A4)',
                          }}
                        >
                          Updated by the player
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  position: 'sticky',
                  bottom: -22,
                  margin: '18px -22px -22px',
                  padding: '14px 22px',
                  background: 'var(--card, #FFFFFF)',
                  borderTop: '1px solid var(--line, #EEF1F8)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  zIndex: 9,
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
                  {saving
                    ? 'Saving...'
                    : selectedStudent.progress || selectedStudent.assessment
                      ? 'Update progress'
                      : 'Add progress'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
