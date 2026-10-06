import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import NotificationBell from '../Notifications/NotificationBell'
import { supabase } from '../../lib/supabaseClient'
import { calculateFitnessSummary } from '../../utils/fitnessScore'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'
import TrainingModal from './fitness/components/TrainingModal'
import TestModal from './fitness/components/FitnessTestModal'
import RecoveryModal from './fitness/components/RecoveryModal'
import InjuryModal from './fitness/components/InjuryModal'
import ScheduleModal from './fitness/components/ScheduleModal'
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  getGoogleAccountEmail,
  syncShuttleTrackGoogleCalendar,
} from '../../lib/googleCalendar'


const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const SCHEDULE_COLORS = {
  Training: '#EF4444',
  Competition: '#F59E0B',
  'Friendly Match': '#EAB308',
  'Rest Day': '#C8D0E0',
  Recovery: '#10B981',
  Other: '#8B5CF6',
  'Completed Training': '#1A5FFF',
}

const SCHEDULE_BADGE = {
  Training: 'red',
  Competition: 'amber',
  'Friendly Match': 'amber',
  'Rest Day': 'gray',
  Recovery: 'green',
  Other: 'purple',
  'Completed Training': 'blue',
}

const VALID_TRAINING_FOCUS = [
  'Endurance',
  'Speed',
  'Strength',
  'Agility',
  'Recovery',
  'Matches',
  'Defense Drills',
  'Focus on retuning',
]

function normalizeTrainingFocus(
  value,
  fallbackType = ''
) {
  const raw = String(value || '').trim()

  const exact = VALID_TRAINING_FOCUS.find(
    option =>
      option.toLowerCase() ===
      raw.toLowerCase()
  )

  if (exact) {
    return exact
  }

  const source = String(
    fallbackType || raw || ''
  )
    .trim()
    .toLowerCase()

  const mappings = [
    ['competition', 'Matches'],
    ['friendly match', 'Matches'],
    ['match practice', 'Matches'],
    ['matches', 'Matches'],
    ['strategy session', 'Matches'],
    ['footwork', 'Agility'],
    ['agility', 'Agility'],
    ['smash', 'Strength'],
    ['strength', 'Strength'],
    ['defense', 'Defense Drills'],
    ['defence', 'Defense Drills'],
    ['net play', 'Speed'],
    ['speed', 'Speed'],
    ['fitness & conditioning', 'Endurance'],
    ['conditioning', 'Endurance'],
    ['endurance', 'Endurance'],
    ['stamina', 'Endurance'],
    ['recovery', 'Recovery'],
  ]

  const matched = mappings.find(
    ([key]) => source.includes(key)
  )

  return matched
    ? matched[1]
    : 'Endurance'
}

const todayISO = () => new Date().toISOString().split('T')[0]
const toKey = d => d?.slice(0, 10)
const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number(n) || 0))

const SCHEDULE_META_PREFIX = '__SHUTTLETRACK_TRAINING__:'

function encodeScheduleNotes({
  notes = '',
  endTime = '',
  focus = 'Endurance',
  activity = 'Training',
  matchType = '',
  status = 'scheduled',
}) {
  return `${SCHEDULE_META_PREFIX}${JSON.stringify({
    notes,
    endTime,
    focus,
    activity,
    matchType,
    status,
  })}`
}

function decodeScheduleNotes(value) {
  const raw = String(value || '')

  if (!raw.startsWith(SCHEDULE_META_PREFIX)) {
    return {
      notes: raw,
      endTime: '',
      focus: 'Endurance',
      activity: '',
      matchType: '',
      status: 'scheduled',
    }
  }

  try {
    const parsed = JSON.parse(raw.slice(SCHEDULE_META_PREFIX.length))

    return {
      notes: parsed?.notes || '',
      endTime: parsed?.endTime || '',
      focus: parsed?.focus || 'Endurance',
      activity: parsed?.activity || '',
      matchType: parsed?.matchType || '',
      status: parsed?.status || 'scheduled',
    }
  } catch {
    return {
      notes: raw,
      endTime: '',
      focus: 'Endurance',
      activity: '',
      matchType: '',
      status: 'scheduled',
    }
  }
}

const ACTION_PLAN_META_PREFIX = '__SHUTTLETRACK_ACTION_PLAN__:'

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
  return `${ACTION_PLAN_META_PREFIX}${JSON.stringify({
    performance: {
      text:
        String(
          performance || ''
        ).trim(),
      deadline:
        String(
          performanceDeadline || ''
        ).trim(),
      completionRate:
        clamp(
          performanceCompletion
        ),
    },
    fitness: {
      text:
        String(
          fitness || ''
        ).trim(),
      deadline:
        String(
          fitnessDeadline || ''
        ).trim(),
      completionRate:
        clamp(
          fitnessCompletion
        ),
    },
  })}`
}

const INJURY_META_PREFIX = '__SHUTTLETRACK_INJURY__:'

function encodeInjuryNotes({
  notes = '',
  bodyX = null,
  bodyY = null,
  severity = 'Mild',
  imagePath = '',
}) {
  return `${INJURY_META_PREFIX}${JSON.stringify({
    notes,
    bodyX,
    bodyY,
    severity,
    imagePath,
  })}`
}

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

const FITNESS_COLORS = {
  Endurance: '#10B981',
  Speed: '#2563EB',
  Strength: '#8B5CF6',
  Agility: '#F59E0B',
  Recovery: '#06B6D4',
}

const getMetricColor = (label, value) => {
  const base = FITNESS_COLORS[label] || '#2563EB'
  const score = Math.max(0, Math.min(100, Number(value) || 0))
  const endStrength = Math.round(40 + score * 0.5)
  const startStrength = Math.max(24, endStrength - 16)

  return {
    bar: `linear-gradient(
      90deg,
      color-mix(in srgb, ${base} ${startStrength}%, var(--card, #FFFFFF)),
      color-mix(in srgb, ${base} ${endStrength}%, var(--card, #FFFFFF))
    )`,
    text: `color-mix(in srgb, ${base} 82%, var(--text, #0D1B3E))`,
    iconBg: `color-mix(in srgb, ${base} 18%, var(--card, #FFFFFF))`,
  }
}

const parseMinutes = value => {
  const text = String(value || '').toLowerCase().trim()
  if (!text) return 0

  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*h/)
  const minuteMatch = text.match(/(\d+)\s*(?:min|m)\b/)

  const hours = hourMatch ? Number(hourMatch[1]) : 0
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0

  if (hourMatch || minuteMatch) {
    return Math.round(hours * 60 + minutes)
  }

  const numeric = Number(text.match(/\d+(?:\.\d+)?/)?.[0] || 0)
  return Number.isFinite(numeric) ? numeric : 0
}

function fmtDate(d) {
  if (!d) return '-'
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

function fmtTime(value) {
  if (!value) return ''
  const [hour, minute] = String(value).split(':')
  if (hour === undefined || minute === undefined) return value
  const date = new Date()
  date.setHours(Number(hour), Number(minute), 0, 0)
  return date.toLocaleTimeString('en-MY', {
    hour: 'numeric',
    minute: '2-digit',
  })
}


function getFitnessActionPlanDeadlineStatus(
  deadline,
  completion = 0
) {
  const completionRate = Math.max(
    0,
    Math.min(
      100,
      Number(completion) || 0
    )
  )

  if (completionRate >= 100) {
    return {
      label: 'COMPLETED',
      color: '#047857',
      border: '#059669',
      opacity: 0.38,
    }
  }

  if (!deadline) return null

  const deadlineDate = new Date(
    `${deadline}T00:00:00`
  )

  if (
    Number.isNaN(
      deadlineDate.getTime()
    )
  ) {
    return null
  }

  const today = new Date()

  today.setHours(
    0,
    0,
    0,
    0
  )

  deadlineDate.setHours(
    0,
    0,
    0,
    0
  )

  if (
    deadlineDate.getTime() <
    today.getTime()
  ) {
    return {
      label: 'OVERDUE',
      color: '#7F1D1D',
      border: '#991B1B',
      opacity: 0.42,
    }
  }

  if (
    deadlineDate.getTime() ===
    today.getTime()
  ) {
    return {
      label: 'DUE TODAY',
      color: '#881337',
      border: '#9F1239',
      opacity: 0.42,
    }
  }

  return null
}

function fmtAddedTime(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function safeTimeRange(start, end) {
  const startText = String(start || '').trim()
  const endText = String(end || '').trim()

  const validTime = value =>
    /^\d{2}:\d{2}(:\d{2})?$/.test(value)

  if (!validTime(startText)) return '-'
  if (!validTime(endText)) return fmtTime(startText)

  return `${fmtTime(startText)} - ${fmtTime(endText)}`
}

function fmtTimeRange(start, end) {
  if (!start && !end) return '-'
  if (start && end) return `${fmtTime(start)} - ${fmtTime(end)}`
  return fmtTime(start || end)
}

function isScheduleFinished(item) {
  if (!item?.date) return false

  const endTime =
    item.endTime ||
    item.time ||
    '23:59'

  const finishedAt = new Date(
    `${item.date}T${String(endTime).slice(0, 5)}:00`
  )

  return (
    Number.isFinite(finishedAt.getTime()) &&
    finishedAt.getTime() <= Date.now()
  )
}

function calculateDuration(start, end) {
  if (!start || !end) return ''

  const [sh, sm] = String(start).split(':').map(Number)
  const [eh, em] = String(end).split(':').map(Number)

  if ([sh, sm, eh, em].some(Number.isNaN)) return ''

  let mins = eh * 60 + em - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60

  const h = Math.floor(mins / 60)
  const m = mins % 60

  if (h && m) return `${h}h ${m}min`
  if (h) return `${h}h`
  return `${m}min`
}

function extractVenueFromNotes(notes = '') {
  const match = String(notes).match(
    /(?:^|\n)Venue:\s*(.+?)(?:\n|$)/i
  )

  return match?.[1]?.trim() || ''
}

function getBadgeClass(color) {
  if (color === 'red') return styles.badgeRed
  if (color === 'amber') return styles.badgeAmber
  if (color === 'green') return styles.badgeGreen
  return styles.badgeGray
}

const emptyTraining = (date = todayISO()) => ({
  date,
  startTime: '',
  endTime: '',
  activity: '',
  duration: '',
  focus: 'Endurance',
  notes: '',
})

const emptySchedule = (date = todayISO()) => ({
  date,
  time: '',
  endTime: '',
  duration: '',
  type: 'Training',
  activity: '',
  matchType: 'Singles',
  focus: 'Endurance',
  venue: '',
  taggedCoachUserId: '',
  notes: '',
})

const emptyTest = (date = todayISO()) => ({
  date,
  test: '',
  result: '',
  indicator: '',
  score: 0,
  adjustmentSign: '+',
  adjustmentAmount: 0,
})

const emptyRecovery = (date = todayISO()) => ({
  date,
  sleep: 7,
  tiredness: 3,
  muscleAche: 2,
  hr: '',
  notes: '',
})

const INJURY_IMAGE_BUCKET = 'injury-images'

const getInjuryImageUrl = imagePath => {
  if (!imagePath) return ''

  const { data } = supabase.storage
    .from(INJURY_IMAGE_BUCKET)
    .getPublicUrl(imagePath)

  return data?.publicUrl || ''
}

const emptyInjury = (date = todayISO()) => ({
  name: '',
  date,
  status: 'Monitoring',
  severity: 'Mild',
  notes: '',
  bodyX: null,
  bodyY: null,
  imagePath: '',
  imageUrl: '',
  imageFile: null,
  imageRemoved: false,
})

function rowToTraining(row) {
  const date = row.training_date

  return {
    id: row.id,
    date,
    day: DAY_SHORT[new Date(date + 'T00:00:00').getDay()],
    startTime: row.start_time || '',
    endTime: row.end_time || '',
    activity: row.activity || '',
    duration: row.duration || '',
    focus: row.focus || 'Endurance',
    notes: row.notes || '',
    venue: extractVenueFromNotes(row.notes),
    coachSessionId: row.coach_session_id || null,
    createdAt: row.created_at || '',
    color: 'blue',
    source: 'training_log',
    type: 'Completed Training',
    title: row.activity || 'Completed Training',
    time: fmtTimeRange(row.start_time, row.end_time),
    dotColor: SCHEDULE_COLORS['Completed Training'],
  }
}

function rowToSchedule(row) {
  const type = row.schedule_type || row.title || 'Friendly Match'
  const isCoachTraining = Boolean(row.is_coach_created)
  const meta = decodeScheduleNotes(row.notes)

  return {
    id: row.id,
    date: row.event_date,
    time: row.event_time || '',
    endTime: meta.endTime || '',
    type,
    title: row.title || type,
    activity: meta.activity || row.title || type,
    matchType: meta.matchType || '',
    focus: meta.focus || 'Endurance',
    venue: row.location || '',
    taggedCoachUserId:
      row.tagged_coach_user_id || '',
    googleEventId:
      row.google_event_id || '',
    notes: meta.notes || '',
    color: isCoachTraining ? 'blue' : SCHEDULE_BADGE[type] || 'purple',
    source: isCoachTraining ? 'coach_training' : 'schedule',
    dotColor:
      isCoachTraining &&
      row.attendance_status === 'absent'
        ? '#EF4444'
        : isCoachTraining &&
            row.attendance_status === 'completed'
          ? '#10B981'
          : isCoachTraining
            ? '#7C3AED'
            : SCHEDULE_COLORS[type] || '#8B5CF6',
    coachSessionId: row.coach_session_id || null,
    isCoachCreated: isCoachTraining,
    attendanceStatus: row.attendance_status || 'scheduled',
    scheduleStatus: meta.status || 'scheduled',
    createdAt: row.created_at || '',
  }
}

function rowToTest(row) {
  return {
    id: row.id,
    date: row.test_date,
    test: row.test_name || '',
    result: row.result || '',
    indicator: row.indicator || 'Endurance',
    score: clamp(row.score),
    change: row.change_note || 'Saved',
    addedByCoach: Boolean(
      row.added_by_coach &&
      row.coach_user_id
    ),
    coachUserId: row.coach_user_id || null,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  }
}

const isInitialFitnessBaseline = test => {
  const testName =
    String(test?.test || '')
      .trim()
      .toLowerCase()

  const result =
    String(test?.result || '')
      .trim()
      .toLowerCase()

  const change =
    String(test?.change || '')
      .trim()
      .toLowerCase()

  return (
    testName === 'initial self-assessment' ||
    result === 'self-assessed baseline' ||
    change === 'initial self-assessment'
  )
}

function rowToRecovery(row) {
  return {
    id: row.id,
    date: row.log_date,
    sleep: Number(row.sleep_hours || 0),
    tiredness: Number(row.fatigue_level || 0),
    muscleAche: Number(row.soreness_level || 0),
    hr: Number(row.resting_hr || 0),
    notes: row.notes || '',
  }
}

function rowToInjury(row) {
  const status = row.status || 'Monitoring'
  const meta = decodeInjuryNotes(row.notes)

  const severity =
    ['Mild', 'Moderate', 'Severe'].includes(row.severity)
      ? row.severity
      : meta.severity || 'Mild'

  const imagePath =
    row.image_path ||
    meta.imagePath ||
    ''

  return {
    id: row.id,
    name: row.injury_description || '',
    date: row.injury_date,
    status,
    severity,
    notes: meta.notes || '',
    bodyX: meta.bodyX,
    bodyY: meta.bodyY,
    imagePath,
    imageUrl: getInjuryImageUrl(imagePath),
    color: status === 'Recovered' ? 'green' : 'amber',
  }
}

function recoverySuggestion(score, recovery, activeInjuries, weeklyMinutes) {
  if (!recovery) return 'Add a recovery check-in to get a training suggestion.'
  if (activeInjuries > 0 && score < 60) return 'Rest or light mobility is suggested because recovery is low and there is an active injury.'
  if (activeInjuries > 0) return 'Train carefully and avoid loading the injured area.'
  if (score < 55) return 'Rest is suggested today. Sleep more and avoid high intensity training.'
  if (score < 75) return 'Light to moderate training is suitable. Avoid pushing too hard.'
  if (weeklyMinutes < 120) return 'Recovery looks good. You can add a normal training session.'
  return 'Recovery looks good. Normal badminton training should be okay today.'
}

function FitnessIcon({ type, color = 'currentColor', size = 18 }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  }

  if (type === 'bell') {
    return (
      <svg {...props}>
        <path
          d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 21h4"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'fitness') {
    return (
      <svg {...props}>
        <path
          d="M3 12h4l2-5 4 10 2-5h6"
          stroke={color}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'heart') {
    return (
      <svg {...props}>
        <path
          d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'clock') {
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

  if (type === 'recovery') {
    return (
      <svg {...props}>
        <path
          d="M12 3 19 6v5c0 4.8-2.9 8-7 10-4.1-2-7-5.2-7-10V6l7-3Z"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="m9 12 2 2 4-4"
          stroke={color}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'coach') {
    return (
      <svg {...props}>
        <path
          d="M4 16 9 11l3 3 7-7"
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

  if (type === 'training') {
    return (
      <svg {...props}>
        <path
          d="M7 8h10M5 12h14M7 16h10"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return null
}

function ScoreRing({ value }) {
  const r = 31
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  const ringColor = value >= 70 ? '#00C48C' : value >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <svg className="fitness-mobile-ring" width="82" height="82" viewBox="0 0 82 82">
      <circle cx="41" cy="41" r={r} stroke="rgba(255,255,255,0.22)" strokeWidth="8" fill="none" />
      <circle
        cx="41"
        cy="41"
        r={r}
        stroke={ringColor}
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 41 41)"
      />
      <text x="41" y="38" textAnchor="middle" fontSize="16" fontWeight="600" fill="#fff">
        {value}
      </text>
      <text x="41" y="54" textAnchor="middle" fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.72)">
        %
      </text>
    </svg>
  )
}

function InjuryBodyMap({ injuries }) {
  const getDot = (name = '') => {
    const lower = name.toLowerCase()

    if (lower.includes('neck')) return { cx: 60, cy: 31, color: '#EF4444' }
    if (lower.includes('back')) return { cx: 60, cy: 66, color: '#EF4444' }

    if (
      lower.includes('left') &&
      lower.includes('upper') &&
      lower.includes('chest')
    ) {
      return { cx: 54, cy: 46, color: '#EF4444' }
    }

    if (
      lower.includes('right') &&
      lower.includes('upper') &&
      lower.includes('chest')
    ) {
      return { cx: 66, cy: 46, color: '#EF4444' }
    }

    if (lower.includes('left') && lower.includes('chest')) {
      return { cx: 52, cy: 55, color: '#EF4444' }
    }

    if (lower.includes('right') && lower.includes('chest')) {
      return { cx: 68, cy: 55, color: '#EF4444' }
    }

    if (lower.includes('chest')) {
      return { cx: 60, cy: 53, color: '#EF4444' }
    }

    if (lower.includes('right') && lower.includes('waist')) {
      return { cx: 70, cy: 88, color: '#EF4444' }
    }

    if (lower.includes('left') && lower.includes('waist')) {
      return { cx: 50, cy: 88, color: '#EF4444' }
    }

    if (lower.includes('waist')) {
      return { cx: 60, cy: 88, color: '#EF4444' }
    }

    if (lower.includes('right') && lower.includes('hip')) {
      return { cx: 68, cy: 94, color: '#F59E0B' }
    }

    if (lower.includes('left') && lower.includes('hip')) {
      return { cx: 52, cy: 94, color: '#F59E0B' }
    }

    if (lower.includes('hip')) {
      return { cx: 60, cy: 94, color: '#F59E0B' }
    }

    if (lower.includes('right') && lower.includes('shoulder')) return { cx: 82, cy: 48, color: '#1A5FFF' }
    if (lower.includes('left') && lower.includes('shoulder')) return { cx: 38, cy: 48, color: '#1A5FFF' }

    if (lower.includes('right') && lower.includes('knee')) return { cx: 70, cy: 122, color: '#F59E0B' }
    if (lower.includes('left') && lower.includes('knee')) return { cx: 50, cy: 122, color: '#F59E0B' }

    if (lower.includes('right') && lower.includes('ankle')) return { cx: 72, cy: 150, color: '#EF4444' }
    if (lower.includes('left') && lower.includes('ankle')) return { cx: 48, cy: 150, color: '#EF4444' }

    if (lower.includes('shoulder')) return { cx: 82, cy: 48, color: '#1A5FFF' }
    if (lower.includes('knee')) return { cx: 60, cy: 122, color: '#F59E0B' }
    if (lower.includes('ankle')) return { cx: 72, cy: 150, color: '#EF4444' }
    if (lower.includes('foot')) return { cx: 82, cy: 154, color: '#EF4444' }
    if (lower.includes('calf') || lower.includes('shin')) return { cx: 72, cy: 138, color: '#EF4444' }
    if (lower.includes('wrist') || lower.includes('hand')) return { cx: 94, cy: 101, color: '#8B5CF6' }
    if (lower.includes('elbow')) return { cx: 88, cy: 76, color: '#F59E0B' }
    if (lower.includes('arm')) return { cx: 87, cy: 64, color: '#8B5CF6' }
    if (lower.includes('thigh') || lower.includes('hamstring')) return { cx: 68, cy: 106, color: '#F59E0B' }

    return { cx: 60, cy: 90, color: '#EF4444' }
  }

  return (
    <div
      style={{
        position: 'relative',
        width: 118,
        height: 170,
        flexShrink: 0,
      }}
    >
      <img
        src="/humanbody.png"
        alt="Human body injury map"
        draggable="false"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      <svg
        viewBox="0 0 120 170"
        width="118"
        height="170"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      >
        <g
          fill="none"
          stroke="transparent"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="60" cy="15" r="10" />
          <path d="M54 25 L54 33" />
          <path d="M66 25 L66 33" />
          <path d="M45 35 C50 31, 70 31, 75 35" />
          <path d="M46 36 C43 52, 42 72, 45 91" />
          <path d="M74 36 C77 52, 78 72, 75 91" />
          <path d="M45 91 C50 97, 55 100, 60 100" />
          <path d="M75 91 C70 97, 65 100, 60 100" />
          <path d="M60 35 L60 100" />
          <path d="M45 38 C34 50, 29 72, 25 96" />
          <path d="M75 38 C86 50, 91 72, 95 96" />
          <path d="M54 100 C51 116, 48 132, 45 152" />
          <path d="M45 152 L36 154" />
          <path d="M66 100 C69 116, 72 132, 75 152" />
          <path d="M75 152 L84 154" />
        </g>

        {injuries.slice(0, 3).map(injury => {
          const dot =
            injury.bodyX !== null &&
            injury.bodyX !== undefined &&
            injury.bodyY !== null &&
            injury.bodyY !== undefined &&
            Number.isFinite(Number(injury.bodyX)) &&
            Number.isFinite(Number(injury.bodyY))
              ? {
                  cx: Number(injury.bodyX),
                  cy: Number(injury.bodyY),
                  color:
                    injury.status === 'Recovered'
                      ? '#10B981'
                      : '#EF4444',
                }
              : getDot(injury.name)

          return (
            <g key={injury.id}>
              <circle
                cx={dot.cx}
                cy={dot.cy}
                r="7"
                fill="var(--card, #FFFFFF)"
              />
              <circle
                cx={dot.cx}
                cy={dot.cy}
                r="5"
                fill={dot.color}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ScheduleCalendar({
  schedules,
  selectedDate,
  onDayClick,
  onEditSchedule,
  onEditTraining,
  onCompleteSchedule,
  onMissSchedule,
  saving,
}) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const map = schedules.reduce((acc, item) => {
    const key = toKey(item.date)
    acc[key] = [...(acc[key] || []), item]
    return acc
  }, {})
  const keyOf = d => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const prev = () => month === 0 ? (setMonth(11), setYear(y => y - 1)) : setMonth(m => m - 1)
  const next = () => month === 11 ? (setMonth(0), setYear(y => y + 1)) : setMonth(m => m + 1)

  const selectedItems = selectedDate ? (map[selectedDate] || []) : []

  const handleEdit = item => {
    if (item.source === 'training_log') {
      onEditTraining(item)
      return
    }

    if (item.source === 'coach_training') {
      return
    }

    onEditSchedule(item)
  }

  return (
    <div style={{ background: '#F7F9FF', borderRadius: 14, padding: '14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={prev} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#1A5FFF' }}>&#8249;</button>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#0D1B3E' }}>{MONTHS[month]} {year}</span>
        <button onClick={next} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#1A5FFF' }}>&#8250;</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 6 }}>
        {DAYS.map(d => <div key={d} style={{ fontSize: 12, fontWeight: 700, color: '#8892A4' }}>{d}</div>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const key = keyOf(d)
          const dayItems = map[key] || []
          const isSelected = selectedDate === key
          const isToday = key === todayISO()

          return (
            <div
              key={i}
              onClick={() => onDayClick(key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '5px 0',
                borderRadius: 8,
                cursor: 'pointer',
                background: isSelected ? '#1A5FFF' : isToday ? '#E8EFFE' : dayItems.length ? 'rgba(26,95,255,0.06)' : 'transparent',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: isToday || isSelected ? 700 : 400, color: isSelected ? '#fff' : isToday ? '#1A5FFF' : '#0D1B3E', lineHeight: '24px' }}>
                {d}
              </span>

              {dayItems.length > 0 && (
                <div style={{ display: 'flex', gap: 2, marginTop: 1 }}>
                  {dayItems.slice(0, 4).map(item => (
                    <span key={`${item.source}-${item.id}`} style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? '#fff' : item.dotColor || SCHEDULE_COLORS[item.type] || '#8B5CF6' }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
        {Object.entries(SCHEDULE_COLORS).map(([label, color]) => (
          <span
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: '#8892A4',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: color,
              }}
            />
            {label === 'Training' ? 'Scheduled Training' : label}
          </span>
        ))}
      </div>

      {selectedDate && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #E8EEF8' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E', marginBottom: 8 }}>
            {fmtDate(selectedDate)} planned, completed and absent activities
          </div>

          {selectedItems.length === 0 ? (
            <div style={{ fontSize: 13, color: '#8892A4' }}>No planned or completed activity for this date.</div>
          ) : selectedItems.map(item => {
            const isAbsent =
              item.source === 'coach_training' &&
              item.attendanceStatus === 'absent'

            const isCoachCompleted =
              item.source === 'coach_training' &&
              item.attendanceStatus === 'completed'

            const isMissed =
              item.source === 'schedule' &&
              item.scheduleStatus === 'missed'

            const sessionFinished =
              isScheduleFinished(item)

            const canComplete =
              sessionFinished &&
              !isAbsent &&
              !isCoachCompleted &&
              item.source !== 'training_log' &&
              (
                item.source === 'schedule' ||
                item.source === 'coach_training'
              )

            const canMarkMissed =
              sessionFinished &&
              item.source === 'schedule' &&
              item.type === 'Training' &&
              !isMissed

            return (
              <div
                key={`${item.source}-${item.id}`}
                className={styles.listRow}
                onClick={() => handleEdit(item)}
                style={{
                  cursor:
                    item.source === 'coach_training'
                      ? 'default'
                      : 'pointer',
                  borderRadius: 8,
                  gap: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {item.source === 'training_log'
                      ? item.activity || 'Completed Training'
                      : item.activity || item.title || item.type}
                  </div>

                  <div style={{ fontSize: 13, color: '#8892A4' }}>
                    {item.source === 'training_log'
                      ? `${fmtTimeRange(
                          item.startTime,
                          item.endTime
                        )} · ${
                          item.duration || 'Duration missing'
                        } · ${item.focus || '-'}`
                      : `${fmtTimeRange(
                          item.time,
                          item.endTime
                        )}${
                          item.venue ? ` · ${item.venue}` : ''
                        }`}
                  </div>

                  {item.createdAt && (
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 12,
                        color:
                          'var(--text-muted, #9AA3B2)',
                      }}
                    >
                      Added {fmtAddedTime(item.createdAt)}
                    </div>
                  )}
                </div>

                <span
                  className={getBadgeClass(
                    isAbsent || isMissed
                      ? 'red'
                      : isCoachCompleted
                        ? 'green'
                        : item.color
                  )}
                >
                  {item.source === 'training_log'
                    ? 'Completed'
                    : isAbsent
                      ? 'Absent'
                      : isMissed
                        ? 'Missed'
                        : isCoachCompleted
                          ? 'Completed'
                          : item.source === 'coach_training'
                            ? 'Coach Training'
                            : item.type === 'Training'
                              ? 'Scheduled'
                              : item.type}
                </span>

                {(canComplete || canMarkMissed) && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    {canComplete && (
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        disabled={saving}
                        onClick={event => {
                          event.stopPropagation()
                          onCompleteSchedule(item)
                        }}
                        style={{
                          fontSize: 13,
                          padding: '7px 10px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Completed
                      </button>
                    )}

                    {canMarkMissed && (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={event => {
                          event.stopPropagation()
                          onMissSchedule(item)
                        }}
                        style={{
                          border: '1px solid #FCA5A5',
                          borderRadius: 9,
                          background: '#FEF2F2',
                          color: '#DC2626',
                          fontSize: 13,
                          fontWeight: 700,
                          padding: '7px 10px',
                          cursor: saving ? 'wait' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Missed
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


function TrainingLogDetailModal({
  item,
  onClose,
  onEdit,
}) {
  if (!item) return null

  const original =
    item.original || {}

  const isCoachAssigned =
    original.source ===
      'coach_training'

  const notes =
    original.notes || ''

  const detailRows = [
    {
      label: 'Date',
      value:
        item.date
          ? fmtDate(item.date)
          : '-',
    },
    {
      label: 'Time',
      value:
        safeTimeRange(
          item.time,
          item.endTime
        ),
    },
    {
      label: 'Duration',
      value:
        item.duration || '-',
    },
    {
      label: 'Focus',
      value:
        item.focus || '-',
    },
    {
      label: 'Venue',
      value:
        item.venue || '-',
    },
    {
      label: 'Status',
      value:
        String(
          item.status || 'Scheduled'
        )
          .charAt(0)
          .toUpperCase() +
        String(
          item.status || 'Scheduled'
        )
          .slice(1)
          .toLowerCase(),
    },
    {
      label: 'Source',
      value:
        isCoachAssigned
          ? 'Coach-assigned session'
          : item.sourceType ===
              'training'
            ? 'Completed training'
            : 'Player schedule',
    },
    {
      label: 'Added',
      value:
        item.createdAt
          ? fmtAddedTime(
              item.createdAt
            )
          : 'Not available',
    },
  ]

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="training-detail-title"
      onClick={event => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >
      <div
        className={styles.modal}
        style={{
          maxWidth: 540,
        }}
      >
        <div
          className={
            styles.modalHead
          }
        >
          <div>
            <div
              id="training-detail-title"
              className={
                styles.modalTitle
              }
            >
              Training Details
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                color:
                  'var(--text-muted, #8892A4)',
              }}
            >
              {item.activity ||
                'Training activity'}
            </div>
          </div>

          <button
            type="button"
            className={
              styles.modalClose
            }
            onClick={onClose}
            aria-label="Close training details"
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(2, minmax(0, 1fr))',
            gap: 10,
          }}
        >
          {detailRows.map(
            detail => (
              <div
                key={detail.label}
                style={{
                  padding:
                    '10px 12px',
                  borderRadius: 10,
                  background:
                    'var(--soft, #F7F9FF)',
                  border:
                    '1px solid var(--line, #E8EEF8)',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    marginBottom: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    color:
                      'var(--text-muted, #8892A4)',
                    textTransform:
                      'uppercase',
                    letterSpacing:
                      0.4,
                  }}
                >
                  {detail.label}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    lineHeight: 1.45,
                    color:
                      'var(--text, #0D1B3E)',
                    overflowWrap:
                      'anywhere',
                  }}
                >
                  {detail.value}
                </div>
              </div>
            )
          )}
        </div>

        {notes && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 10,
              background:
                'var(--soft, #F7F9FF)',
              border:
                '1px solid var(--line, #E8EEF8)',
            }}
          >
            <div
              style={{
                marginBottom: 5,
                fontSize: 10,
                fontWeight: 700,
                color:
                  'var(--text-muted, #8892A4)',
                textTransform:
                  'uppercase',
                letterSpacing: 0.4,
              }}
            >
              Notes
            </div>

            <div
              style={{
                whiteSpace:
                  'pre-wrap',
                fontSize: 12,
                lineHeight: 1.55,
                color:
                  'var(--text, #0D1B3E)',
              }}
            >
              {notes}
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent:
              'flex-end',
            gap: 10,
          }}
        >
          <button
            type="button"
            className={
              styles.btnOutline
            }
            onClick={onClose}
          >
            Close
          </button>

          {!isCoachAssigned &&
            onEdit && (
              <button
                type="button"
                className={
                  styles.btnPrimary
                }
                onClick={() =>
                  onEdit(item)
                }
              >
                Edit
              </button>
            )}
        </div>
      </div>
    </div>
  )
}


function AllFitnessRecordsModal({
  type,
  trainingItems = [],
  tests = [],
  recoveryLogs = [],
  injuries = [],
  onClose,
  onTraining,
  onTest,
  onRecovery,
  onInjury,
}) {
  if (!type) return null

  const titleMap = {
    training: 'All Training Log Records',
    tests: 'All Fitness Test Records',
    recovery: 'All Recovery Check-ins',
    injuries: 'All Injury Records',
  }

  const rowStyle = {
    display: 'grid',
    alignItems: 'center',
    gap: 12,
    padding: '12px 10px',
    borderBottom: '1px solid var(--line, #E8EEF8)',
    cursor: 'pointer',
  }

  const sortedRecovery = [...recoveryLogs].sort(
    (a, b) => b.date.localeCompare(a.date)
  )

  const visibleTests =
    tests.filter(
      test => !isInitialFitnessBaseline(test)
    )


  const recordCount =
    type === 'training'
      ? trainingItems.length
      : type === 'tests'
        ? visibleTests.length
        : type === 'recovery'
          ? sortedRecovery.length
          : injuries.length

  const shouldScroll =
    recordCount >= 10

  const getPlayerTestScoreForIndicator = indicator => {
    const normalizedIndicator =
      String(indicator || '')
        .trim()
        .toLowerCase()

    const latestPlayerTest =
      visibleTests
        .filter(
          test =>
            !test.addedByCoach &&
            String(test.indicator || '')
              .trim()
              .toLowerCase() ===
              normalizedIndicator
        )
        .slice()
        .sort((a, b) => {
          const aTime =
            new Date(
              a.createdAt ||
                `${a.date || ''}T00:00:00`
            ).getTime() || 0

          const bTime =
            new Date(
              b.createdAt ||
                `${b.date || ''}T00:00:00`
            ).getTime() || 0

          return bTime - aTime
        })[0] || null

    if (
      !latestPlayerTest ||
      !Number.isFinite(
        Number(latestPlayerTest.score)
      )
    ) {
      return null
    }

    return Number(latestPlayerTest.score)
  }

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      onClick={event => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={styles.modal}
        style={{
          width: 'min(92vw, 900px)',
          maxWidth: 900,
          maxHeight:
            shouldScroll
              ? '82vh'
              : 'none',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>
            {titleMap[type]}
          </div>

          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close all records"
          >
            ×
          </button>
        </div>

        <div
          style={{
            overflowY:
              shouldScroll
                ? 'auto'
                : 'visible',
            maxHeight:
              shouldScroll
                ? '62vh'
                : 'none',
            minHeight: 0,
            paddingRight:
              shouldScroll
                ? 4
                : 0,
          }}
        >
          {type === 'training' && (
            <>
              {trainingItems.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    color: '#8892A4',
                    fontSize: 12,
                  }}
                >
                  No training records yet.
                </div>
              ) : (
                trainingItems.map(item => {
                  const status = String(
                    item.status || 'Scheduled'
                  )
                  const statusLower = status.toLowerCase()

                  return (
                    <div
                      key={item.id}
                      onClick={() => onTraining?.(item)}
                      style={{
                        ...rowStyle,
                        gridTemplateColumns:
                          '90px 150px minmax(160px, 1.2fr) minmax(150px, 1fr) 90px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>
                          {new Date(
                            `${item.date}T00:00:00`
                          ).toLocaleDateString('en-MY', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: '#8892A4',
                          fontWeight: 700,
                        }}
                      >
                        {safeTimeRange(item.time, item.endTime)}
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 700 }}>
                        {item.activity}
                      </div>

                      <div style={{ fontSize: 11, fontWeight: 600 }}>
                        {item.focus || '-'}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          whiteSpace: 'normal',
                          lineHeight: 1.2,
                          textAlign: 'center',
                          maxWidth: 72,
                          color:
                            statusLower === 'awaiting completion'
                              ? '#7C3AED'
                              : statusLower === 'completed'
                                ? '#10B981'
                                : ['missed', 'absent'].includes(statusLower)
                                  ? '#EF4444'
                                  : '#2563EB',
                        }}
                      >
                        {statusLower === 'scheduled'
                          ? 'Upcoming'
                          : statusLower === 'awaiting completion'
                            ? (
                              <>
                                Awaiting
                                <br />
                                completion
                              </>
                            )
                            : status.charAt(0).toUpperCase() +
                              status.slice(1).toLowerCase()}
                      </div>
                    </div>
                  )
                })
              )}
            </>
          )}

          {type === 'tests' && (
            <>
              {tests.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    color: '#8892A4',
                    fontSize: 12,
                  }}
                >
                  No fitness test records yet.
                </div>
              ) : (
                visibleTests.map(test => {
                  const playerScore =
                    test.addedByCoach
                      ? getPlayerTestScoreForIndicator(
                          test.indicator
                        )
                      : null

                  const scoreDifference =
                    playerScore !== null &&
                    Number.isFinite(
                      Number(test.score)
                    )
                      ? Number(test.score) -
                        Number(playerScore)
                      : null

                  return (
                  <div
                    key={test.id}
                    onClick={() => {
                      if (!test.addedByCoach) {
                        onTest?.(test)
                      }
                    }}
                    style={{
                      ...rowStyle,
                      cursor:
                        test.addedByCoach
                          ? 'default'
                          : 'pointer',
                      gridTemplateColumns:
                        'minmax(180px, 1fr) 130px 120px 90px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {test.test}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#8892A4',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>{fmtDate(test.date)}</span>

                        {test.addedByCoach && (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: 999,
                              background:
                                'color-mix(in srgb, #7C3AED 10%, var(--card, #FFFFFF))',
                              color: '#7C3AED',
                              fontSize: 9,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Added by Coach
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {test.indicator}
                    </div>

                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {test.result}
                    </div>

                    <div
                      style={{
                        textAlign: 'right',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color:
                            test.addedByCoach
                              ? '#7C3AED'
                              : 'var(--text, #0D1B3E)',
                        }}
                      >
                        {clamp(test.score)}
                      </div>

                      {test.addedByCoach &&
                        scoreDifference !== null &&
                        scoreDifference !== 0 && (
                          <div
                            style={{
                              marginTop: 3,
                              fontSize: 9,
                              fontWeight: 700,
                              color:
                                scoreDifference > 0
                                  ? '#10B981'
                                  : '#EF4444',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {scoreDifference > 0
                              ? `+${scoreDifference}`
                              : scoreDifference}
                          </div>
                        )}
                    </div>

                  </div>
                  )
                })
              )}
            </>
          )}

          {type === 'recovery' && (
            <>
              {sortedRecovery.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    color: '#8892A4',
                    fontSize: 12,
                  }}
                >
                  No recovery check-ins yet.
                </div>
              ) : (
                sortedRecovery.map(item => (
                  <div
                    key={item.id}
                    onClick={() => onRecovery?.(item)}
                    style={{
                      ...rowStyle,
                      gridTemplateColumns:
                        'minmax(170px, 1fr) repeat(4, minmax(90px, auto))',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700 }}>
                      {fmtDate(item.date)}
                    </div>

                    <div style={{ fontSize: 11 }}>
                      Sleep <strong>{item.sleep}h</strong>
                    </div>

                    <div style={{ fontSize: 11 }}>
                      Tired <strong>{item.tiredness}/10</strong>
                    </div>

                    <div style={{ fontSize: 11 }}>
                      Ache <strong>{item.muscleAche}/10</strong>
                    </div>

                    <div style={{ fontSize: 11 }}>
                      HR <strong>{item.hr} bpm</strong>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {type === 'injuries' && (
            <>
              {injuries.length === 0 ? (
                <div
                  style={{
                    padding: 20,
                    color: '#8892A4',
                    fontSize: 12,
                  }}
                >
                  No injury records yet.
                </div>
              ) : (
                injuries.map(injury => {
                  const severityColor =
                    injury.severity === 'Severe'
                      ? '#EF4444'
                      : injury.severity === 'Moderate'
                        ? '#F59E0B'
                        : '#10B981'

                  return (
                    <div
                      key={injury.id}
                      onClick={() => onInjury?.(injury)}
                      style={{
                        ...rowStyle,
                        gridTemplateColumns:
                          'minmax(200px, 1fr) 120px 120px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          {injury.name}
                        </div>
                        <div style={{ fontSize: 11, color: '#8892A4' }}>
                          {fmtDate(injury.date)}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: severityColor,
                        }}
                      >
                        {injury.severity || 'Mild'} severity
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textAlign: 'right',
                          color:
                            injury.status === 'Recovered'
                              ? '#10B981'
                              : '#F59E0B',
                        }}
                      >
                        {injury.status}
                      </div>
                    </div>
                  )
                })
              )}
            </>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 14,
          }}
        >
          <button
            type="button"
            className={styles.btnOutline}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function FitnessComparisonRow({
  label,
  playerValue,
  playerHasData = true,
  coachValue,
}) {
  const playerScore = Number(playerValue ?? 0)
  const hasCoachValue =
    coachValue !== null &&
    coachValue !== undefined &&
    Number.isFinite(Number(coachValue))
  const coachScore = hasCoachValue ? Number(coachValue) : playerScore
  const hasChange = hasCoachValue
  const playerColor = getMetricColor(label, playerScore)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '130px minmax(0, 1fr) 90px',
        gap: 12,
        alignItems: 'center',
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            background: playerColor.iconBg,
            color: playerColor.text,
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {label[0]}
        </div>

        <div
          className={styles.skillLbl}
          style={{
            width: 'auto',
            minWidth: 0,
            fontSize: 15,
          }}
        >
          {label}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          height: 10,
          borderRadius: 999,
          background: 'var(--line, #EEF1F8)',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            width: `${playerScore}%`,
            height: '100%',
            borderRadius: 999,
            background: playerColor.bar,
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
                height: 18,
                borderRadius: 999,
                background: '#7C3AED',
                boxShadow:
                  '0 0 0 2px color-mix(in srgb, #7C3AED 16%, var(--card, #FFFFFF))',
              }}
            />

            <div
              style={{
                position: 'absolute',
                left: `clamp(0px, calc(${coachScore}% - 22px), calc(100% - 44px))`,
                top: -24,
                minWidth: 44,
                textAlign: 'center',
                fontSize: 10,
                fontWeight: 700,
                color: '#7C3AED',
                background:
                  'color-mix(in srgb, #7C3AED 12%, var(--card, #FFFFFF))',
                borderRadius: 999,
                padding: '2px 6px',
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
          textAlign: 'right',
          fontSize: 14,
          fontWeight: 700,
          color: playerHasData
            ? playerColor.text
            : 'var(--text-muted, #94A3B8)',
          whiteSpace: 'nowrap',
        }}
      >
        {playerHasData ? (
          <>
            {playerScore}
            <span
              style={{
                color: 'var(--text-muted, #8892A4)',
                fontWeight: 500,
                fontSize: 13,
              }}
            >
              {' '} /100
            </span>
          </>
        ) : (
          label === 'Recovery'
            ? 'Not checked'
            : 'Not tested'
        )}
      </div>
    </div>
  )
}

const FITNESS_NOTIFICATION_TYPES = [
  'coach_fitness_assessment',
  'coach_fitness_feedback',
  'coach_progress',
  'coach_training',
  'coach_training_cancelled',
  'coach_relationship_removed',
  'player_schedule_status_reminder',
  'coach_fitness_action_plan_due_tomorrow',
  'coach_fitness_action_plan_due_today',
  'coach_fitness_action_plan_overdue',
]

function DeleteConfirmationModal({
  title,
  message,
  itemName,
  onCancel,
  onConfirm,
  deleting,
}) {
  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      onClick={event => {
        if (event.target === event.currentTarget && !deleting) {
          onCancel()
        }
      }}
    >
      <div className={styles.modal} style={{ maxWidth: 430 }}>
        <div className={styles.modalHead}>
          <div>
            <div className={styles.modalTitle}>{title}</div>
            <div
              style={{
                marginTop: 5,
                fontSize: 12,
                lineHeight: 1.5,
                color: 'var(--text-muted, #8892A4)',
              }}
            >
              {message}
            </div>
          </div>

          <button
            type="button"
            className={styles.modalClose}
            onClick={onCancel}
            disabled={deleting}
            aria-label="Close delete confirmation"
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: 14,
            marginBottom: 18,
            borderRadius: 14,
            background:
              'color-mix(in srgb, #EF4444 8%, var(--card, #FFFFFF))',
            border:
              '1px solid color-mix(in srgb, #EF4444 25%, var(--line, #EEF1F8))',
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text, #0D1B3E)',
              overflowWrap: 'anywhere',
            }}
          >
            {itemName || 'Selected record'}
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
            onClick={onCancel}
            disabled={deleting}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '9px 16px',
              background: '#DC2626',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 700,
              cursor: deleting ? 'wait' : 'pointer',
              opacity: deleting ? 0.65 : 1,
            }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Fitness() {
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const showLoader = useLoadingDelay(loading, 350)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [sessions, setSessions] = useState([])
  const [scheduleList, setScheduleList] = useState([])
  const [tests, setTests] = useState([])
  const [recoveryLogs, setRecoveryLogs] = useState([])
  const [injuries, setInjuries] = useState([])
  const [coachAssessments, setCoachAssessments] = useState([])
  const [coachProgress, setCoachProgress] = useState([])
  const [
    savingCoachActionPlan,
    setSavingCoachActionPlan,
  ] = useState(false)

  const [personalNote, setPersonalNote] = useState('')
  const [draftPersonalNote, setDraftPersonalNote] = useState('')
  const [personalActionPlan, setPersonalActionPlan] = useState('')
  const [draftPersonalActionPlan, setDraftPersonalActionPlan] = useState('')

  const [selectedDate, setSelectedDate] = useState(null)
  const [
    selectedTrainingDetail,
    setSelectedTrainingDetail,
  ] = useState(null)
  const [filter, setFilter] = useState({
    status: 'All',
    search: '',
  })

  const [showSchedule, setShowSchedule] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [showTraining, setShowTraining] = useState(false)
  const [editingTraining, setEditingTraining] = useState(null)
  const [completingSchedule, setCompletingSchedule] = useState(null)
  const [showTest, setShowTest] = useState(false)
  const [editingTest, setEditingTest] = useState(null)
  const [showRecovery, setShowRecovery] = useState(false)
  const [editingRecovery, setEditingRecovery] = useState(null)
  const [showInjury, setShowInjury] = useState(false)
  const [editingInjury, setEditingInjury] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [allRecordsView, setAllRecordsView] = useState(null)
  const [hasCoach, setHasCoach] = useState(false)
  const [coachOptions, setCoachOptions] = useState([])
  const [googleSyncEnabled, setGoogleSyncEnabled] = useState(false)
  const [googleCalendarBusy, setGoogleCalendarBusy] = useState(false)
  const [showFitnessInfo, setShowFitnessInfo] = useState(false)
  const [showFitnessScoreInfo, setShowFitnessScoreInfo] = useState(false)
  const trainingTableRef = useRef(null)
  const trainingCardRef = useRef(null)
  const rightFitnessStackRef = useRef(null)
  const injuryLogCardRef = useRef(null)
  const [trainingSectionHeight, setTrainingSectionHeight] = useState(null)

  const [scheduleForm, setScheduleForm] = useState(emptySchedule())
  const [scheduleAvailabilityError, setScheduleAvailabilityError] = useState('')
  const [checkingScheduleAvailability, setCheckingScheduleAvailability] = useState(false)
  const [trainingForm, setTrainingForm] = useState(emptyTraining())
  const [testForm, setTestForm] = useState(emptyTest())
  const [showInitialFitness, setShowInitialFitness] = useState(false)
  const [initialFitnessForm, setInitialFitnessForm] = useState({
    Endurance: 50,
    Speed: 50,
    Strength: 50,
    Agility: 50,
  })
  const [recoveryForm, setRecoveryForm] = useState(emptyRecovery())
  const [injuryForm, setInjuryForm] = useState(emptyInjury())

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      setLoadError('')

      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError

        const user = auth?.user
        if (!user) throw new Error('Please log in first to view your saved fitness records.')

        setUserId(user.id)

        const [
          scheduleRes,
          trainingRes,
          testsRes,
          recoveryRes,
          injuryRes,
          noteRes,
          assessmentRes,
          progressRes,
          coachAssignmentRes,
          coachRelationshipRes,
          googleCalendarSettingRes,
        ] = await Promise.all([
          supabase.from('player_schedule').select('*').eq('user_id', user.id).order('event_date', { ascending: true }).order('event_time', { ascending: true }),
          supabase.from('fitness_training_logs').select('*').eq('user_id', user.id).order('training_date', { ascending: true }),
          supabase.from('fitness_tests').select('*').eq('user_id', user.id).order('test_date', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('fitness_recovery_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: true }).order('created_at', { ascending: true }),
          supabase.from('fitness_injuries').select('*').eq('user_id', user.id).order('injury_date', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('fitness_coach_notes').select('*').eq('user_id', user.id).maybeSingle(),
          supabase
            .from('coach_player_assessments')
            .select('*')
            .eq('player_user_id', user.id)
            .order('updated_at', { ascending: false }),

          supabase
            .from('coach_player_progress')
            .select('*')
            .eq('player_user_id', user.id)
            .order('updated_at', { ascending: false }),

          supabase
            .from('coach_training_session_players')
            .select(`
              session_id,
              player_focus,
              attendance_status,
              completed_at,
              coach_training_sessions (
                id,
                session_date,
                start_time,
                end_time,
                venue,
                session_type,
                group_notes,
                coach_user_id,
                created_at
              )
            `)
            .eq('player_user_id', user.id),

          supabase
            .from('coach_player_relationships')
            .select('coach_user_id, status')
            .eq('player_user_id', user.id),

          supabase
            .from('google_calendar_connections')
            .select('enabled')
            .eq('user_id', user.id)
            .maybeSingle(),
        ])

        const error = [
          scheduleRes.error,
          trainingRes.error,
          testsRes.error,
          recoveryRes.error,
          injuryRes.error,
          noteRes.error,
          coachAssignmentRes.error,
          coachRelationshipRes.error,
          googleCalendarSettingRes.error,
        ].find(Boolean)

        if (error) throw error
        if (!alive) return

        const activeCoachRelationship = (
          coachRelationshipRes.data || []
        ).some(relationship => {
          const status = String(
            relationship.status || ''
          ).toLowerCase()

          return [
            'accepted',
            'active',
            'connected',
          ].includes(status)
        })

        setHasCoach(activeCoachRelationship)
        setGoogleSyncEnabled(
          Boolean(
            googleCalendarSettingRes.data?.enabled
          )
        )

        const acceptedCoachIds = (
          coachRelationshipRes.data || []
        )
          .filter(relationship => {
            const status = String(
              relationship.status || ''
            ).toLowerCase()

            return [
              'accepted',
              'active',
              'connected',
            ].includes(status)
          })
          .map(relationship =>
            relationship.coach_user_id
          )
          .filter(Boolean)

        if (acceptedCoachIds.length > 0) {
          const {
            data: coachUserRows,
            error: coachUserError,
          } = await supabase
            .from('app_users')
            .select('user_id, full_name')
            .in('user_id', acceptedCoachIds)

          if (coachUserError) {
            console.error(
              'Unable to load coach names:',
              coachUserError
            )
            setCoachOptions(
              acceptedCoachIds.map(coachId => ({
                userId: coachId,
                name: 'Connected coach',
              }))
            )
          } else {
            const nameMap = new Map(
              (coachUserRows || []).map(row => [
                String(row.user_id),
                row.full_name || 'Connected coach',
              ])
            )

            setCoachOptions(
              acceptedCoachIds.map(coachId => ({
                userId: coachId,
                name:
                  nameMap.get(String(coachId)) ||
                  'Connected coach',
              }))
            )
          }
        } else {
          setCoachOptions([])
        }

        const coachSessionById = new Map(
          (coachAssignmentRes.data || []).map(item => [
            String(item.session_id),
            {
              playerFocus: item.player_focus || '',
              attendanceStatus:
                item.attendance_status || 'scheduled',
              completedAt: item.completed_at || null,
              session:
                item.coach_training_sessions || null,
            },
          ])
        )

        setScheduleList(
          (scheduleRes.data || []).map(row => {
            const coachLink = row.coach_session_id
              ? coachSessionById.get(
                  String(row.coach_session_id)
                )
              : null

            const linkedSession = coachLink?.session || null

            return rowToSchedule({
              ...row,
              event_date:
                linkedSession?.session_date ||
                row.event_date,
              event_time:
                linkedSession?.start_time ||
                row.event_time,
              title:
                linkedSession?.session_type ||
                row.title,
              location:
                linkedSession?.venue ||
                row.location,
              schedule_type:
                row.schedule_type ||
                'Training',
              notes: linkedSession
                ? encodeScheduleNotes({
                    notes: [
                      linkedSession.group_notes || '',
                      coachLink?.playerFocus
                        ? `Individual focus: ${coachLink.playerFocus}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join('\n'),
                    endTime:
                      linkedSession.end_time || '',
                    focus:
                      coachLink?.playerFocus ||
                      linkedSession.session_type ||
                      'Training',
                    activity:
                      linkedSession.session_type ||
                      row.title ||
                      'Training',
                    status: 'scheduled',
                  })
                : row.notes,
              attendance_status:
                coachLink?.attendanceStatus ||
                'scheduled',
              completed_at:
                coachLink?.completedAt || null,
              created_at:
                linkedSession?.created_at ||
                row.created_at ||
                null,
            })
          })
        )

        setSessions((trainingRes.data || []).map(rowToTraining))
        setTests((testsRes.data || []).map(rowToTest))
        setRecoveryLogs((recoveryRes.data || []).map(rowToRecovery))
        setInjuries((injuryRes.data || []).map(rowToInjury))

        if (assessmentRes.error) {
          console.error(
            'Coach assessment load error:',
            assessmentRes.error
          )
          setCoachAssessments([])
        } else {
          setCoachAssessments(assessmentRes.data || [])
        }

        if (progressRes.error) {
          console.error(
            'Coach progress load error:',
            progressRes.error
          )
          setCoachProgress([])
        } else {
          setCoachProgress(progressRes.data || [])
        }

        setPersonalNote(noteRes.data?.note || '')
        setDraftPersonalNote(noteRes.data?.note || '')
        setPersonalActionPlan(noteRes.data?.action_plan || '')
        setDraftPersonalActionPlan(noteRes.data?.action_plan || '')
      } catch (err) {
        if (alive) setLoadError(err.message || 'Failed to load fitness records.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [refreshKey])

  useEffect(() => {
    const resetTrainingScroll = () => {
      if (trainingTableRef.current) {
        trainingTableRef.current.scrollLeft = 0
      }
    }

    const frame = requestAnimationFrame(
      resetTrainingScroll
    )

    window.addEventListener(
      'resize',
      resetTrainingScroll
    )

    return () => {
      cancelAnimationFrame(frame)

      window.removeEventListener(
        'resize',
        resetTrainingScroll
      )
    }
  }, [
    refreshKey,
    filter.status,
    filter.search,
  ])

  useLayoutEffect(() => {
    const trainingCard =
      trainingCardRef.current
    const injuryCard =
      injuryLogCardRef.current

    if (!trainingCard || !injuryCard) {
      setTrainingSectionHeight(null)
      return undefined
    }

    let frameId = null

    const syncTrainingHeight = () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }

      frameId = requestAnimationFrame(() => {
        const isStackedLayout =
          typeof window !== 'undefined' &&
          window.innerWidth <= 900

        if (isStackedLayout) {
          setTrainingSectionHeight(null)
          return
        }

        const trainingRect =
          trainingCard.getBoundingClientRect()

        const injuryRect =
          injuryCard.getBoundingClientRect()

        const exactHeight =
          Math.round(
            injuryRect.bottom -
            trainingRect.top
          )

        if (
          Number.isFinite(exactHeight) &&
          exactHeight > 0
        ) {
          setTrainingSectionHeight(
            current =>
              current === exactHeight
                ? current
                : exactHeight
          )
        }
      })
    }

    syncTrainingHeight()

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(syncTrainingHeight)
        : null

    /*
     * IMPORTANT:
     * Observe only the right-side reference cards.
     * Do NOT observe the Training Log itself, otherwise changing its
     * height can trigger another measurement and create a feedback loop.
     */
    const rightStack =
      rightFitnessStackRef.current

    if (rightStack) {
      observer?.observe(rightStack)
    }

    observer?.observe(injuryCard)

    window.addEventListener(
      'resize',
      syncTrainingHeight
    )

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId)
      }

      observer?.disconnect()

      window.removeEventListener(
        'resize',
        syncTrainingHeight
      )
    }
  }, [
    loading,
    showLoader,
    tests.length,
    recoveryLogs.length,
    injuries.length,
  ])

  useEffect(() => {
    if (!userId) return undefined

    const channel = supabase
      .channel(`fitness-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_training_session_players',
          filter: `player_user_id=eq.${userId}`,
        },
        () => setRefreshKey(current => current + 1)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_schedule',
          filter: `user_id=eq.${userId}`,
        },
        () => setRefreshKey(current => current + 1)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fitness_training_logs',
          filter: `user_id=eq.${userId}`,
        },
        () => setRefreshKey(current => current + 1)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fitness_tests',
          filter: `user_id=eq.${userId}`,
        },
        () => setRefreshKey(current => current + 1)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_player_relationships',
          filter: `player_user_id=eq.${userId}`,
        },
        () => setRefreshKey(current => current + 1)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_player_assessments',
          filter: `player_user_id=eq.${userId}`,
        },
        () => setRefreshKey(current => current + 1)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_player_progress',
          filter: `player_user_id=eq.${userId}`,
        },
        () => setRefreshKey(current => current + 1)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const saveGoogleCalendarPreference = async (
    enabled,
    googleEmail = null
  ) => {
    const uid = userId || (await getUserId())

    const { error } = await supabase
      .from('google_calendar_connections')
      .upsert(
        {
          user_id: uid,
          enabled,
          google_email:
            enabled
              ? googleEmail
              : null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      )

    if (error) throw error
  }

  const handleGoogleCalendarToggle = async () => {
    if (googleCalendarBusy) return

    setGoogleCalendarBusy(true)
    setLoadError('')

    try {
      if (googleSyncEnabled) {
        await disconnectGoogleCalendar()
        await saveGoogleCalendarPreference(false)
        setGoogleSyncEnabled(false)

        alert(
          'Google Calendar disconnected. Existing Google Calendar events were kept.'
        )

        return
      }

      await connectGoogleCalendar({
        prompt: 'consent',
      })

      const googleEmail =
        await getGoogleAccountEmail()

      await saveGoogleCalendarPreference(
        true,
        googleEmail
      )

      setGoogleSyncEnabled(true)

      alert(
        'Google Calendar connected. Future ShuttleTrack schedules will sync automatically.'
      )
    } catch (error) {
      console.error(
        'Google Calendar connection error:',
        error
      )

      setLoadError(
        error?.message ||
          'Unable to change Google Calendar connection.'
      )
    } finally {
      setGoogleCalendarBusy(false)
    }
  }

  const getUserId = async () => {
    if (userId) return userId

    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    if (!data?.user) throw new Error('Please log in first.')

    setUserId(data.user.id)
    return data.user.id
  }

  const playerFitnessTests = useMemo(
    () =>
      tests.filter(
        test =>
          !test.addedByCoach ||
          !test.coachUserId
      ),
    [tests]
  )

  const baselineFitnessTests = useMemo(
    () =>
      playerFitnessTests.filter(
        test => isInitialFitnessBaseline(test)
      ),
    [playerFitnessTests]
  )

  const realPlayerFitnessTests = useMemo(
    () =>
      playerFitnessTests.filter(
        test => !isInitialFitnessBaseline(test)
      ),
    [playerFitnessTests]
  )

  const visibleFitnessTests = useMemo(
    () =>
      tests.filter(
        test => !isInitialFitnessBaseline(test)
      ),
    [tests]
  )

  const fitnessSummary = useMemo(
    () =>
      calculateFitnessSummary({
        tests: realPlayerFitnessTests,
        sessions,
        recoveryLogs,
        injuries,
        scheduleList,
      }),
    [
      realPlayerFitnessTests,
      sessions,
      recoveryLogs,
      injuries,
      scheduleList,
    ]
  )

  const {
    fitnessScore: calculatedFitnessScore,
    indicators: calculatedIndicators,
    latestRecovery,
    weeklyMinutes,
    weeklyHours,
    activeInjuries,
    recoveryScore,
  } = fitnessSummary

  // Build player-facing fitness indicators directly from the player's
  // actual saved records. This prevents calculateFitnessSummary defaults
  // (such as 70) from appearing when a test does not exist.
  const latestPlayerTestFor = useMemo(
    () => indicatorName => {
      const normalizedName =
        indicatorName === 'Flexibility'
          ? 'Agility'
          : indicatorName

      return [...realPlayerFitnessTests]
        .filter(test => {
          const testIndicator =
            test.indicator === 'Flexibility'
              ? 'Agility'
              : test.indicator

          return testIndicator === normalizedName
        })
        .sort((a, b) => {
          const aTime = new Date(
            a.updatedAt ||
            a.createdAt ||
            `${a.date || ''}T00:00:00`
          ).getTime()

          const bTime = new Date(
            b.updatedAt ||
            b.createdAt ||
            `${b.date || ''}T00:00:00`
          ).getTime()

          return bTime - aTime
        })[0] || null
    },
    [realPlayerFitnessTests]
  )

  const latestBaselineFor = useMemo(
    () => indicatorName => {
      const normalizedName =
        indicatorName === 'Flexibility'
          ? 'Agility'
          : indicatorName

      return [...baselineFitnessTests]
        .filter(test => {
          const testIndicator =
            test.indicator === 'Flexibility'
              ? 'Agility'
              : test.indicator

          return testIndicator === normalizedName
        })
        .sort((a, b) => {
          const aTime = new Date(
            a.updatedAt ||
            a.createdAt ||
            `${a.date || ''}T00:00:00`
          ).getTime()

          const bTime = new Date(
            b.updatedAt ||
            b.createdAt ||
            `${b.date || ''}T00:00:00`
          ).getTime()

          return bTime - aTime
        })[0] || null
    },
    [baselineFitnessTests]
  )

  const indicators = useMemo(() => {
    const indicatorNames = [
      'Endurance',
      'Speed',
      'Strength',
      'Agility',
    ]

    const testIndicators = indicatorNames.map(name => {
      const latestTest = latestPlayerTestFor(name)
      const baseline = latestBaselineFor(name)
      const source = latestTest || baseline

      return {
        name,
        val: source
          ? Math.max(
              0,
              Math.min(
                100,
                Number(source.score) || 0
              )
            )
          : 0,
        hasData: Boolean(source),
        isBaseline: !latestTest && Boolean(baseline),
      }
    })

    const recoveryIndicator = {
      name: 'Recovery',
      val: latestRecovery
        ? Math.max(
            0,
            Math.min(
              100,
              Number(recoveryScore) || 0
            )
          )
        : 0,
      hasData: Boolean(latestRecovery),
    }

    return [
      ...testIndicators,
      recoveryIndicator,
    ]
  }, [
    latestPlayerTestFor,
    latestBaselineFor,
    latestRecovery,
    recoveryScore,
  ])

  const testIndicatorNames = [
    'Endurance',
    'Speed',
    'Strength',
    'Agility',
  ]

  const missingTestIndicators =
    testIndicatorNames.filter(
      name => !latestPlayerTestFor(name)
    )

  const canSetInitialFitness =
    missingTestIndicators.length > 0

  const recordedIndicators =
    indicators.filter(item => item.hasData)

  const hasAnyFitnessIndicatorData =
    recordedIndicators.length > 0

  // Overall Fitness Score uses only indicators that have real saved data.
  // Missing indicators display 0 but are not included in the average.
  const fitnessScore =
    recordedIndicators.length > 0
      ? Math.round(
          recordedIndicators.reduce(
            (sum, item) =>
              sum + (Number(item.val) || 0),
            0
          ) / recordedIndicators.length
        )
      : 0

  // Keep the summary utility available for other values such as weekly load,
  // while preventing its placeholder indicator values from reaching the UI.
  void calculatedFitnessScore
  void calculatedIndicators

  const fitnessScoreBreakdown = useMemo(() => {
    const items = (indicators || [])
      .filter(item => item.hasData)
      .map(item => ({
        name:
          item.name === 'Flexibility'
            ? 'Agility'
            : item.name,
        value: Math.max(
          0,
          Math.min(
            100,
            Number(item.val) || 0
          )
        ),
      }))

    const total = items.reduce(
      (sum, item) => sum + item.value,
      0
    )

    const average =
      items.length > 0
        ? total / items.length
        : 0

    return {
      items,
      total,
      average,
      roundedAverage: Math.round(average),
      matchesDisplayedScore:
        Math.round(average) ===
        Number(fitnessScore),
    }
  }, [indicators, fitnessScore])

  const hasRecoveryData = Boolean(latestRecovery)

  const recoveryStatus = !hasRecoveryData
    ? 'Not Set'
    : recoveryScore >= 75
      ? 'Good'
      : recoveryScore >= 55
        ? 'Moderate'
        : 'Needs Rest'


  const suggestion = hasRecoveryData
    ? recoverySuggestion(
        recoveryScore,
        latestRecovery,
        activeInjuries,
        weeklyMinutes
      )
    : 'Add a recovery check-in to receive a recovery suggestion.'

  const latestCoachProgress =
    coachProgress[0] || null

  const latestCoachAssessment = useMemo(() => {
    if (!coachAssessments.length) return null

    if (latestCoachProgress?.coach_user_id) {
      return (
        coachAssessments.find(
          assessment =>
            String(assessment.coach_user_id || '') ===
            String(latestCoachProgress.coach_user_id || '')
        ) ||
        coachAssessments[0]
      )
    }

    return coachAssessments[0]
  }, [
    coachAssessments,
    latestCoachProgress?.coach_user_id,
  ])

  const coachActionPlans = useMemo(
    () =>
      decodeActionPlans(
        latestCoachProgress?.coach_comment
      ),
    [latestCoachProgress?.coach_comment]
  )

  const coachFitnessDeadlineStatus =
    getFitnessActionPlanDeadlineStatus(
      coachActionPlans.fitnessDeadline,
      coachActionPlans.fitnessCompletion
    )

  const latestCoachUpdate =
    latestCoachProgress?.updated_at ||
    latestCoachAssessment?.updated_at ||
    ''

  const trainingLogItems = useMemo(() => {
    const scheduledItems = scheduleList.map(item => ({
      id: `schedule-${item.id}`,
      sourceId: item.id,
      sourceType: 'schedule',
      date: item.date,
      time: item.time || item.startTime || '',
      endTime: item.endTime || '',
      activity:
        item.activity ||
        item.title ||
        item.type ||
        'Scheduled activity',
      duration:
        item.duration ||
        calculateDuration(
          item.time || item.startTime,
          item.endTime
        ) ||
        '-',
      focus: normalizeTrainingFocus(
        item.focus,
        item.type ||
          item.activity ||
          item.title
      ),
      venue: item.venue || '',
      createdAt:
        item.createdAt || '',
      status: (() => {
        const scheduleStatus = String(
          item.scheduleStatus || 'scheduled'
        ).toLowerCase()

        const attendanceStatus = String(
          item.attendanceStatus ||
          item.attendance_status ||
          ''
        ).toLowerCase()

        if (scheduleStatus === 'missed') {
          return 'Missed'
        }

        if (scheduleStatus === 'completed') {
          return 'Completed'
        }

        if (attendanceStatus === 'completed') {
          return 'Completed'
        }

        if (attendanceStatus === 'absent') {
          return 'Absent'
        }

        if (
          item.isCoachCreated &&
          isScheduleFinished(item)
        ) {
          return 'Awaiting completion'
        }

        return 'Scheduled'
      })(),
      original: item,
    }))

    const completedItems = sessions.map(item => ({
      id: `training-${item.id}`,
      sourceId: item.id,
      sourceType: 'training',
      date: item.date,
      time: item.time || '',
      endTime: item.endTime || '',
      activity:
        item.activity ||
        item.training ||
        item.title ||
        'Completed training',
      duration: item.duration || '-',
      focus: normalizeTrainingFocus(
        item.focus,
        item.type ||
          item.activity ||
          item.title
      ),
      venue: item.venue || '',
      createdAt:
        item.createdAt || '',
      status: 'Completed',
      original: item,
    }))

    const seenCompletedCoachSessions = new Set(
      completedItems
        .map(item => item.original?.coachSessionId)
        .filter(Boolean)
    )

    const filteredScheduled = scheduledItems.filter(item => {
      const coachSessionId =
        item.original?.coachSessionId ||
        item.original?.coach_session_id

      return !(
        coachSessionId &&
        seenCompletedCoachSessions.has(coachSessionId)
      )
    })

    return [...filteredScheduled, ...completedItems].sort((a, b) => {
      const aValue = `${a.date || ''}T${a.time || '00:00'}`
      const bValue = `${b.date || ''}T${b.time || '00:00'}`
      return bValue.localeCompare(aValue)
    })
  }, [scheduleList, sessions])

  const tableSessions = useMemo(() => {
    const searchText = filter.search.trim().toLowerCase()

    return trainingLogItems.filter(item => {
      const status = String(item.status || 'Scheduled').toLowerCase()

      const matchesStatus =
        filter.status === 'All' ||
        status === filter.status.toLowerCase()

      const itemDate = item.date
        ? new Date(`${item.date}T00:00:00`)
        : null

      const searchableText = [
        item.activity,
        item.focus,
        item.venue,
        item.status,
        item.date,
        itemDate &&
          Number.isFinite(itemDate.getTime())
          ? itemDate.toLocaleDateString('en-MY', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : '',
        itemDate &&
          Number.isFinite(itemDate.getTime())
          ? itemDate.toLocaleDateString('en-MY', {
              month: 'short',
              year: 'numeric',
            })
          : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      const matchesSearch =
        !searchText ||
        searchableText.includes(searchText)

      return (
        matchesStatus &&
        matchesSearch
      )
    })
  }, [
    trainingLogItems,
    filter.status,
    filter.search,
  ])

  useEffect(() => {
    if (!userId || scheduleList.length === 0) {
      return undefined
    }

    let cancelled = false

    const updatePastPlayerSchedules = async () => {
      const overdueItems =
        scheduleList.filter(item => {
          const scheduleStatus =
            String(
              item.scheduleStatus ||
              'scheduled'
            ).toLowerCase()

          return (
            item.source === 'schedule' &&
            !item.isCoachCreated &&
            scheduleStatus === 'scheduled' &&
            isScheduleFinished(item)
          )
        })

      if (overdueItems.length === 0) {
        return
      }

      for (const item of overdueItems) {
        if (cancelled) return

        try {
          const isRestDay =
            item.type === 'Rest Day'

          const nextStatus =
            isRestDay
              ? 'completed'
              : 'missed'

          const { data, error } = await supabase
            .from('player_schedule')
            .update({
              notes: encodeScheduleNotes({
                notes: item.notes || '',
                endTime: item.endTime || '',
                focus: normalizeTrainingFocus(
                  item.focus,
                  item.type ||
                    item.activity ||
                    item.title
                ),
                activity:
                  item.activity ||
                  item.title ||
                  item.type ||
                  'Scheduled activity',
                matchType:
                  item.matchType || '',
                status: nextStatus,
              }),
            })
            .eq('id', item.id)
            .eq('user_id', userId)
            .select('*')
            .single()

          if (error) {
            console.error(
              isRestDay
                ? 'Auto-complete rest day error:'
                : 'Auto-mark overdue schedule missed error:',
              error
            )
            continue
          }

          if (cancelled) return

          const updated =
            rowToSchedule(data)

          setScheduleList(current =>
            current.map(schedule =>
              schedule.id === updated.id
                ? updated
                : schedule
            )
          )

          /*
           * Rest Day needs no attendance confirmation.
           * Once its date has passed, simply mark it Completed
           * and do not create a reminder notification.
           */
          if (isRestDay) {
            continue
          }

          const activityName =
            item.activity ||
            item.title ||
            item.type ||
            'Scheduled activity'

          const scheduleEndTime =
            String(
              item.endTime ||
              item.time ||
              '23:59'
            ).slice(0, 5)

          const scheduleEndedAt =
            new Date(
              `${item.date}T${scheduleEndTime}:00`
            )

          const notificationTime =
            Number.isFinite(
              scheduleEndedAt.getTime()
            )
              ? scheduleEndedAt.toISOString()
              : new Date().toISOString()

          const notificationTitle =
            `Missed schedule: ${activityName}`

          const message =
            `${activityName} ended on ${fmtDate(item.date)} at ${fmtTime(scheduleEndTime)}. ` +
            'It was marked as Missed because no status was selected. ' +
            'If you attended, open the schedule and change it to Completed.'

          const {
            data: existingNotifications,
            error: notificationLoadError,
          } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', userId)
            .eq(
              'source_type',
              'player_schedule_status_reminder'
            )
            .eq('title', notificationTitle)
            .eq('message', message)
            .limit(1)

          if (notificationLoadError) {
            console.error(
              'Load schedule reminder notification error:',
              notificationLoadError
            )
          }

          if (
            !notificationLoadError &&
            (
              existingNotifications ||
              []
            ).length === 0
          ) {
            const {
              error: notificationInsertError,
            } = await supabase
              .from('notifications')
              .insert({
                user_id: userId,
                title:
                  notificationTitle,
                message,
                type: 'warning',
                source_type:
                  'player_schedule_status_reminder',
                action_url:
                  '/player/fitness',
                is_read: false,
                created_at:
                  notificationTime,
              })

            if (
              notificationInsertError
            ) {
              console.error(
                'Create schedule reminder notification error:',
                notificationInsertError
              )
            }
          }
        } catch (error) {
          console.error(
            'Past player schedule status update error:',
            error
          )
        }
      }
    }

    updatePastPlayerSchedules()

    return () => {
      cancelled = true
    }
  }, [userId, scheduleList])

  const calendarItems = useMemo(() => {
    return [
      ...scheduleList,
      ...sessions.map(session => ({
        ...session,
        source: 'training_log',
        type: 'Completed Training',
        title: session.activity || 'Completed Training',
        dotColor: SCHEDULE_COLORS['Completed Training'],
      })),
    ]
  }, [scheduleList, sessions])

  const venueHistory = useMemo(() => {
    const seen = new Set()

    return [
      ...scheduleList.map(item => item.venue),
      ...sessions.map(item => item.venue),
    ]
      .map(venue => String(venue || '').trim())
      .filter(Boolean)
      .filter(venue => {
        const key = venue.toLowerCase()

        if (seen.has(key)) {
          return false
        }

        seen.add(key)
        return true
      })
      .sort((a, b) =>
        a.localeCompare(b, 'en', {
          sensitivity: 'base',
        })
      )
  }, [scheduleList, sessions])

  const upcomingActivitiesCount = useMemo(
    () =>
      scheduleList.filter(item => {
        const status = String(
          item.scheduleStatus || 'scheduled'
        ).toLowerCase()

        return (
          status === 'scheduled' &&
          !isScheduleFinished(item)
        )
      }).length,
    [scheduleList]
  )

  const completedTrainingThisMonth = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    return sessions.filter(session => {
      if (!session?.date) return false

      const date = new Date(
        `${session.date}T00:00:00`
      )

      return (
        Number.isFinite(date.getTime()) &&
        date.getFullYear() === currentYear &&
        date.getMonth() === currentMonth
      )
    }).length
  }, [sessions])

  const setForm = setter => (k, v) => setter(f => ({ ...f, [k]: v }))

  const openAddSchedule = date => {
    setEditingSchedule(null)
    setLoadError('')
    setScheduleAvailabilityError('')
    setCheckingScheduleAvailability(false)
    setScheduleForm(
      emptySchedule(
        date ||
          selectedDate ||
          todayISO()
      )
    )
    setShowSchedule(true)
  }

  const openEditSchedule = row => {
    setEditingSchedule(row)
    setLoadError('')
    setScheduleAvailabilityError('')
    setCheckingScheduleAvailability(false)
    setScheduleForm({
      date: row.date,
      time: row.time ? row.time.slice(0, 5) : '',
      endTime: row.endTime ? row.endTime.slice(0, 5) : '',
      duration:
        calculateDuration(
          row.time ? row.time.slice(0, 5) : '',
          row.endTime ? row.endTime.slice(0, 5) : ''
        ),
      type: row.type || 'Training',
      activity: row.activity || row.title || '',
      matchType: row.matchType || 'Singles',
      focus: row.focus || 'Endurance',
      venue: row.venue || '',
      taggedCoachUserId:
        row.taggedCoachUserId || '',
      notes: row.notes || '',
    })
  }

  const checkPlayerScheduleConflict = useCallback(async uid => {
    if (
      !uid ||
      !scheduleForm.date ||
      !scheduleForm.type
    ) {
      return null
    }

    /*
     * First check the selected date directly.
     * This is needed for Rest Day because Rest Day has no start/end time.
     * It also lets a normal activity detect an existing Rest Day immediately.
     */
    let dayQuery = supabase
      .from('player_schedule')
      .select(
        'id, event_date, event_time, title, schedule_type, notes, coach_session_id, is_coach_created'
      )
      .eq('user_id', uid)
      .eq('event_date', scheduleForm.date)

    if (editingSchedule?.id) {
      dayQuery = dayQuery.neq(
        'id',
        editingSchedule.id
      )
    }

    const {
      data: daySchedules,
      error: dayScheduleError,
    } = await dayQuery

    if (dayScheduleError) {
      throw dayScheduleError
    }

    const existingRows =
      daySchedules || []

    const existingRestDay =
      existingRows.find(row => {
        const rowType =
          String(
            row.schedule_type ||
            row.title ||
            ''
          )
            .trim()
            .toLowerCase()

        return rowType === 'rest day'
      }) || null

    if (
      scheduleForm.type === 'Rest Day'
    ) {
      if (existingRows.length > 0) {
        return {
          type: 'rest_day_conflict',
          message:
            `${fmtDate(scheduleForm.date)} already contains a scheduled activity. ` +
            'Remove or reschedule the activity before setting this date as a Rest Day.',
        }
      }

      return null
    }

    if (existingRestDay) {
      return {
        type: 'existing_rest_day',
        message:
          `${fmtDate(scheduleForm.date)} is already marked as a Rest Day. ` +
          'Remove the Rest Day or select another date.',
      }
    }

    /*
     * Timed conflict checking is still handled by the existing database RPC.
     * This catches overlaps with player-created activities and coach-created
     * sessions using the same server-side rule already used before saving.
     */
    if (
      !scheduleForm.time ||
      !scheduleForm.endTime
    ) {
      return null
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      'check_player_schedule_conflict',
      {
        p_session_date:
          scheduleForm.date,
        p_start_time:
          scheduleForm.time,
        p_end_time:
          scheduleForm.endTime,
        p_ignore_schedule_id:
          editingSchedule?.id ||
          null,
      }
    )

    if (error) {
      throw error
    }

    if (Boolean(data)) {
      return {
        type: 'time_conflict',
        message:
          'This time slot is not available because you already have another activity or coach session scheduled.',
      }
    }

    return null
  }, [
    scheduleForm.date,
    scheduleForm.type,
    scheduleForm.time,
    scheduleForm.endTime,
    editingSchedule?.id,
  ])

  /*
   * Check availability before Save.
   * - Rest Day: check immediately after date + type are selected.
   * - Other activities: check once date + start + end time are available.
   *
   * A small debounce avoids unnecessary database requests while the form
   * is still being changed.
   */
  useEffect(() => {
    if (
      !showSchedule &&
      !editingSchedule
    ) {
      setScheduleAvailabilityError('')
      setCheckingScheduleAvailability(false)
      return undefined
    }

    if (
      !userId ||
      !scheduleForm.date ||
      !scheduleForm.type
    ) {
      setScheduleAvailabilityError('')
      setCheckingScheduleAvailability(false)
      return undefined
    }

    if (
      scheduleForm.type !== 'Rest Day' &&
      (
        !scheduleForm.time ||
        !scheduleForm.endTime
      )
    ) {
      setScheduleAvailabilityError('')
      setCheckingScheduleAvailability(false)
      return undefined
    }

    let cancelled = false

    const timer = window.setTimeout(
      async () => {
        setCheckingScheduleAvailability(true)

        try {
          const conflict =
            await checkPlayerScheduleConflict(
              userId
            )

          if (cancelled) return

          setScheduleAvailabilityError(
            conflict?.message || ''
          )
        } catch (availabilityError) {
          if (cancelled) return

          console.error(
            'Player schedule availability check error:',
            availabilityError
          )

          setScheduleAvailabilityError(
            availabilityError?.message ||
              'Unable to check schedule availability.'
          )
        } finally {
          if (!cancelled) {
            setCheckingScheduleAvailability(false)
          }
        }
      },
      300
    )

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    showSchedule,
    editingSchedule,
    userId,
    scheduleForm.date,
    scheduleForm.type,
    scheduleForm.time,
    scheduleForm.endTime,
    checkPlayerScheduleConflict,
  ])

  const saveSchedule = async () => {
    if (saving) return

    if (!scheduleForm.date || !scheduleForm.type) {
      setLoadError('Please select the date and type.')
      return
    }

    if (
      ['Competition', 'Friendly Match'].includes(scheduleForm.type) &&
      !scheduleForm.activity.trim()
    ) {
      setLoadError(
        scheduleForm.type === 'Competition'
          ? 'Please enter the competition name.'
          : 'Please enter the match title.'
      )
      return
    }

    if (scheduleForm.type === 'Training') {
      if (!scheduleForm.activity.trim()) {
        setLoadError('Please enter the training activity.')
        return
      }

      if (!scheduleForm.time || !scheduleForm.endTime) {
        setLoadError(
          'Please select both start and end time for scheduled training.'
        )
        return
      }

      if (
        parseMinutes(
          calculateDuration(
            scheduleForm.time,
            scheduleForm.endTime
          )
        ) <= 0
      ) {
        setLoadError(
          'The scheduled duration must be longer than 0 minutes.'
        )
        return
      }
    }

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()

      const conflict =
        await checkPlayerScheduleConflict(
          uid
        )

      if (conflict) {
        setScheduleAvailabilityError(
          conflict.message
        )
        setLoadError('')
        return
      }

      const scheduleTitle =
        scheduleForm.activity.trim() ||
        scheduleForm.type

      const payload = {
        user_id: uid,
        event_date: scheduleForm.date,
        event_time: scheduleForm.time || null,
        title: scheduleTitle,
        location: scheduleForm.venue.trim() || null,
        schedule_type: scheduleForm.type,
        tagged_coach_user_id:
          scheduleForm.taggedCoachUserId || null,
        notes: encodeScheduleNotes({
          notes: scheduleForm.notes.trim(),
          endTime: scheduleForm.endTime,
          focus: normalizeTrainingFocus(
            scheduleForm.focus,
            scheduleForm.type
          ),
          activity: scheduleTitle,
          matchType:
            ['Competition', 'Friendly Match'].includes(
              scheduleForm.type
            )
              ? scheduleForm.matchType || 'Singles'
              : '',
          status:
            editingSchedule?.scheduleStatus ||
            'scheduled',
        }),
      }

      const q = editingSchedule
        ? supabase
            .from('player_schedule')
            .update(payload)
            .eq('id', editingSchedule.id)
            .eq('user_id', uid)
        : supabase
            .from('player_schedule')
            .insert(payload)

      const { data, error } =
        await q.select('*').single()

      if (error) throw error

      let savedRow = data

      /*
       * Direct server-side Google Calendar sync.
       *
       * Always call this after the Player schedule is saved. It must not
       * depend on the Player's own Google Calendar setting because a tagged
       * connected Coach should still receive the event even when the Player
       * has not connected Google Calendar.
       *
       * The sync function reads the saved schedule, checks the accepted
       * Coach relationship, and updates every connected target calendar.
       */
      try {
        const calendarSync =
          await syncShuttleTrackGoogleCalendar({
            action: 'upsert',
            sourceType: 'player_schedule',
            sourceId: data.id,
          })

        if (
          Array.isArray(calendarSync?.errors) &&
          calendarSync.errors.length > 0
        ) {
          console.error(
            'Some Google Calendar targets could not be synced:',
            calendarSync.errors
          )
        }
      } catch (googleError) {
        console.error(
          editingSchedule
            ? 'Direct Google Calendar schedule update error:'
            : 'Direct Google Calendar schedule creation error:',
          googleError
        )

        setLoadError(
          `${
            editingSchedule
              ? 'Schedule updated'
              : 'Schedule saved'
          } in ShuttleTrack, but Google Calendar sync failed: ${
            googleError?.message ||
            'Unable to sync connected Google Calendars.'
          }`
        )
      }

      const item = rowToSchedule(savedRow)

      setScheduleList(prev =>
        [
          ...prev.filter(
            schedule =>
              schedule.id !== item.id
          ),
          item,
        ].sort((a, b) => {
          const dateCompare =
            a.date.localeCompare(b.date)

          if (dateCompare !== 0) {
            return dateCompare
          }

          return String(
            a.time || ''
          ).localeCompare(
            String(b.time || '')
          )
        })
      )

      setShowSchedule(false)
      setEditingSchedule(null)
      setScheduleForm(emptySchedule())
    } catch (err) {
      setLoadError(
        err.message ||
          'Failed to save schedule.'
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteSchedule = async () => {
    if (!editingSchedule || saving) return

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()

      /*
       * Remove mapped Google Calendar events BEFORE deleting the
       * ShuttleTrack schedule because the Edge Function verifies the source.
       */
      try {
        const calendarSync =
          await syncShuttleTrackGoogleCalendar({
            action: 'delete',
            sourceType: 'player_schedule',
            sourceId: editingSchedule.id,
          })

        if (
          Array.isArray(calendarSync?.errors) &&
          calendarSync.errors.length > 0
        ) {
          console.error(
            'Some Google Calendar events could not be removed:',
            calendarSync.errors
          )
        }
      } catch (googleError) {
        console.error(
          'Direct Google Calendar schedule delete error:',
          googleError
        )

        setLoadError(
          `The ShuttleTrack schedule will still be deleted, but connected Google Calendar events could not all be removed: ${
            googleError?.message ||
            'Unable to remove connected Google Calendar events.'
          }`
        )
      }

      const { error } = await supabase
        .from('player_schedule')
        .delete()
        .eq('id', editingSchedule.id)
        .eq('user_id', uid)

      if (error) throw error

      setScheduleList(prev =>
        prev.filter(
          schedule =>
            schedule.id !== editingSchedule.id
        )
      )
      setEditingSchedule(null)
      setScheduleForm(emptySchedule())
    } catch (err) {
      setLoadError(err.message || 'Failed to delete schedule.')
    } finally {
      setSaving(false)
    }
  }

  const syncCoachSessionCompletion = async (
    coachSessionId,
    uid
  ) => {
    if (!coachSessionId || !uid) return

    const { error: attendanceError } = await supabase
      .from('coach_training_session_players')
      .update({
        attendance_status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('session_id', coachSessionId)
      .eq('player_user_id', uid)

    if (attendanceError) throw attendanceError
  }

  const markScheduledTrainingMissed = async item => {
    if (
      saving ||
      item?.source !== 'schedule'
    ) {
      return
    }

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()

      const payload = {
        notes: encodeScheduleNotes({
          notes: item.notes || '',
          endTime: item.endTime || '',
          focus: normalizeTrainingFocus(
            item.focus,
            item.type ||
              item.activity ||
              item.title
          ),
          activity:
            item.activity ||
            item.title ||
            item.type ||
            'Scheduled activity',
          matchType:
            item.matchType || '',
          status: 'missed',
        }),
      }

      const { data, error } = await supabase
        .from('player_schedule')
        .update(payload)
        .eq('id', item.id)
        .eq('user_id', uid)
        .select('*')
        .single()

      if (error) throw error

      const updated = rowToSchedule(data)

      setScheduleList(current =>
        current.map(schedule =>
          schedule.id === updated.id
            ? updated
            : schedule
        )
      )
    } catch (error) {
      setLoadError(
        error.message ||
          'Unable to mark the session as missed.'
      )
    } finally {
      setSaving(false)
    }
  }

  const completeScheduledTraining = async item => {
    if (saving) return

    if (item?.attendanceStatus === 'absent') {
      setLoadError(
        'Your coach marked you absent for this session, so it cannot be completed or added to the training load.'
      )
      return
    }

    if (item?.attendanceStatus === 'completed') {
      setLoadError(
        'Your coach has already marked this session as completed.'
      )
      return
    }

    if (!item?.date || !item?.time) {
      setLoadError(
        'This scheduled training does not have enough time information. Open it and add the missing details first.'
      )
      return
    }

    if (!item.endTime) {
      setCompletingSchedule(item)
      setEditingTraining(null)
      setTrainingForm({
        date: item.date,
        startTime: item.time
          ? item.time.slice(0, 5)
          : '',
        endTime: '',
        activity:
          item.activity ||
          item.title ||
          'Training',
        duration: '',
        focus: normalizeTrainingFocus(
          item.focus,
          item.type ||
            item.activity ||
            item.title
        ),
        notes: [
          item.venue ? `Venue: ${item.venue}` : '',
          item.notes || '',
        ]
          .filter(Boolean)
          .join('\n'),
      })
      setShowTraining(true)
      setLoadError(
        'Add the end time, then save to complete this training.'
      )
      return
    }

    const calculatedDuration = calculateDuration(
      item.time,
      item.endTime
    )

    if (parseMinutes(calculatedDuration) <= 0) {
      setLoadError(
        'The scheduled training duration must be longer than 0 minutes.'
      )
      return
    }

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()

      const payload = {
        user_id: uid,
        coach_session_id:
          item.coachSessionId || null,
        training_date: item.date,
        start_time: item.time || null,
        end_time: item.endTime || null,
        activity:
          item.activity ||
          item.title ||
          'Training',
        duration: calculatedDuration,
        intensity: 'Medium',
        focus: normalizeTrainingFocus(
          item.focus,
          item.type ||
            item.activity ||
            item.title
        ),
        notes: [
          item.venue ? `Venue: ${item.venue}` : '',
          item.notes || '',
        ]
          .filter(Boolean)
          .join('\n'),
        updated_at: new Date().toISOString(),
      }

      let existingLogQuery = supabase
        .from('fitness_training_logs')
        .select('id')
        .eq('user_id', uid)

      if (item.coachSessionId) {
        existingLogQuery = existingLogQuery.eq(
          'coach_session_id',
          item.coachSessionId
        )
      } else {
        existingLogQuery = existingLogQuery
          .eq('training_date', item.date)
          .eq(
            'activity',
            item.activity ||
              item.title ||
              'Training'
          )
      }

      const {
        data: existingLog,
        error: existingLogError,
      } = await existingLogQuery.maybeSingle()

      if (existingLogError) throw existingLogError

      const logQuery = existingLog?.id
        ? supabase
            .from('fitness_training_logs')
            .update(payload)
            .eq('id', existingLog.id)
            .eq('user_id', uid)
        : supabase
            .from('fitness_training_logs')
            .insert(payload)

      const { data, error } = await logQuery
        .select('*')
        .single()

      if (error) throw error

      if (item.coachSessionId) {
        await syncCoachSessionCompletion(
          item.coachSessionId,
          uid
        )
      }

      const completedItem = rowToTraining(data)

      setSessions(current => [
        ...current.filter(
          session =>
            session.id !== completedItem.id &&
            !(
              item.coachSessionId &&
              session.coachSessionId ===
                item.coachSessionId
            )
        ),
        completedItem,
      ].sort((a, b) =>
        a.date.localeCompare(b.date)
      ))

      const shouldRemoveSchedule =
        item.source === 'schedule' ||
        item.source === 'coach_training'

      if (shouldRemoveSchedule) {
        let deleteQuery = supabase
          .from('player_schedule')
          .delete()
          .eq('user_id', uid)

        deleteQuery = item.coachSessionId
          ? deleteQuery.eq(
              'coach_session_id',
              item.coachSessionId
            )
          : deleteQuery.eq('id', item.id)

        const { error: deleteError } =
          await deleteQuery

        if (deleteError) throw deleteError

        setScheduleList(current =>
          current.filter(schedule =>
            item.coachSessionId
              ? schedule.coachSessionId !==
                item.coachSessionId
              : schedule.id !== item.id
          )
        )
      }
    } catch (error) {
      setLoadError(
        error.message ||
          'Failed to mark the scheduled training as completed.'
      )
    } finally {
      setSaving(false)
    }
  }

  const completePlayerAddedSchedule = async item => {
    if (
      saving ||
      !item ||
      item.source !== 'schedule'
    ) {
      return
    }

    if (item.type === 'Training') {
      await completeScheduledTraining(item)
      return
    }

    if (item.type === 'Rest Day') {
      setSaving(true)
      setLoadError('')

      try {
        const uid = await getUserId()

        const { data, error } = await supabase
          .from('player_schedule')
          .update({
            notes: encodeScheduleNotes({
              notes: item.notes || '',
              endTime: item.endTime || '',
              focus: item.focus || 'Rest Day',
              activity:
                item.activity ||
                item.title ||
                'Rest Day',
              matchType: '',
              status: 'completed',
            }),
          })
          .eq('id', item.id)
          .eq('user_id', uid)
          .select('*')
          .single()

        if (error) throw error

        const updated =
          rowToSchedule(data)

        setScheduleList(current =>
          current.map(schedule =>
            schedule.id === updated.id
              ? updated
              : schedule
          )
        )
      } catch (error) {
        setLoadError(
          error.message ||
            'Unable to complete the rest day.'
        )
      } finally {
        setSaving(false)
      }

      return
    }

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()

      const payload = {
        notes: encodeScheduleNotes({
          notes: item.notes || '',
          endTime: item.endTime || '',
          focus: normalizeTrainingFocus(
        item.focus,
        item.type ||
          item.activity ||
          item.title
      ),
          activity:
            item.activity ||
            item.title ||
            item.type ||
            'Scheduled activity',
          matchType: item.matchType || '',
          status: 'completed',
        }),
      }

      const { data, error } = await supabase
        .from('player_schedule')
        .update(payload)
        .eq('id', item.id)
        .eq('user_id', uid)
        .select('*')
        .single()

      if (error) throw error

      const updated = rowToSchedule(data)

      setScheduleList(current =>
        current.map(schedule =>
          schedule.id === updated.id
            ? updated
            : schedule
        )
      )
    } catch (error) {
      setLoadError(
        error.message ||
          'Unable to mark the schedule as completed.'
      )
    } finally {
      setSaving(false)
    }
  }

  const openEditTraining = row => {
    setCompletingSchedule(null)
    setEditingTraining(row)
    setTrainingForm({
      date: row.date,
      startTime: row.startTime || '',
      endTime: row.endTime || '',
      activity: row.activity || '',
      duration:
        row.duration ||
        calculateDuration(
          row.startTime || '',
          row.endTime || ''
        ),
      focus: row.focus || 'Endurance',
      notes: row.notes || '',
    })
  }

  const openInitialFitness = () => {
    setInitialFitnessForm(previous => {
      const next = { ...previous }

      testIndicatorNames.forEach(name => {
        const currentTest = latestPlayerTestFor(name)
        const savedBaseline = latestBaselineFor(name)

        next[name] = currentTest
          ? clamp(currentTest.score)
          : savedBaseline
            ? clamp(savedBaseline.score)
            : clamp(previous[name] || 50)
      })

      return next
    })

    setShowInitialFitness(true)
  }

  const saveInitialFitness = async () => {
    if (saving || missingTestIndicators.length === 0) {
      setShowInitialFitness(false)
      return
    }

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()
      const now = new Date().toISOString()
      const savedItems = []

      for (const name of missingTestIndicators) {
        const existingBaseline = latestBaselineFor(name)

        const payload = {
          user_id: uid,
          test_date:
            existingBaseline?.date ||
            todayISO(),
          test_name: 'Initial self-assessment',
          result: 'Self-assessed baseline',
          indicator: name,
          score: clamp(initialFitnessForm[name]),
          added_by_coach: false,
          coach_user_id: null,
          change_note: 'Initial self-assessment',
          updated_at: now,
        }

        const query = existingBaseline?.id
          ? supabase
              .from('fitness_tests')
              .update(payload)
              .eq('id', existingBaseline.id)
              .eq('user_id', uid)
          : supabase
              .from('fitness_tests')
              .insert(payload)

        const { data, error } =
          await query.select('*').single()

        if (error) throw error

        savedItems.push(rowToTest(data))
      }

      setTests(previous => [
        ...savedItems,
        ...previous.filter(
          item =>
            !savedItems.some(
              saved => saved.id === item.id
            )
        ),
      ])

      setShowInitialFitness(false)
    } catch (err) {
      setLoadError(
        err.message ||
          'Failed to save initial fitness levels.'
      )
    } finally {
      setSaving(false)
    }
  }

  const openAddTest = () => {
    setTestForm(emptyTest())
    setShowTest(true)
  }

  const openEditTest = row => {
    if (row?.addedByCoach) {
      return
    }

    setEditingTest(row)
    setTestForm({
      date: row.date,
      test: row.test,
      result: row.result,
      indicator: row.indicator,
      score: row.score,
      adjustmentSign: '+',
      adjustmentAmount: 0,
    })
  }

  const openAddRecovery = () => {
    setRecoveryForm(emptyRecovery())
    setShowRecovery(true)
  }

  const openEditRecovery = row => {
    setEditingRecovery(row)
    setRecoveryForm({
      date: row.date,
      sleep: row.sleep,
      tiredness: row.tiredness,
      muscleAche: row.muscleAche,
      hr: row.hr,
      notes: row.notes,
    })
  }

  const openAddInjury = () => {
    setInjuryForm(emptyInjury())
    setShowInjury(true)
  }

  const openEditInjury = row => {
    setEditingInjury(row)
    setInjuryForm({
      name: row.name,
      date: row.date,
      status: row.status,
      severity: row.severity || 'Mild',
      notes: row.notes,
      bodyX: row.bodyX ?? null,
      bodyY: row.bodyY ?? null,
      imagePath: row.imagePath || '',
      imageUrl: row.imageUrl || '',
      imageFile: null,
      imageRemoved: false,
    })
  }

  const saveTraining = async () => {
    if (saving) return

    if (!trainingForm.activity.trim()) {
      setLoadError('Please enter the training activity.')
      return
    }

    if (!trainingForm.date) {
      setLoadError('Please select the training date.')
      return
    }

    if (!trainingForm.startTime || !trainingForm.endTime) {
      setLoadError(
        'Please select both start time and end time so the weekly training load can be calculated.'
      )
      return
    }

    const calculatedDuration = calculateDuration(
      trainingForm.startTime,
      trainingForm.endTime
    )

    if (!calculatedDuration || parseMinutes(calculatedDuration) <= 0) {
      setLoadError('The training duration must be longer than 0 minutes.')
      return
    }

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()

      const payload = {
        user_id: uid,
        coach_session_id:
          completingSchedule?.coachSessionId ||
          editingTraining?.coachSessionId ||
          null,
        training_date: trainingForm.date,
        start_time: trainingForm.startTime || null,
        end_time: trainingForm.endTime || null,
        activity: trainingForm.activity.trim(),
        duration: calculatedDuration,
        intensity: 'Medium',
        focus: normalizeTrainingFocus(
          trainingForm.focus,
          completingSchedule?.type ||
            trainingForm.activity
        ),
        notes: trainingForm.notes.trim(),
        updated_at: new Date().toISOString(),
      }

      let existingLog = null

      if (
        !editingTraining &&
        completingSchedule?.coachSessionId
      ) {
        const {
          data: existingCoachLog,
          error: existingCoachLogError,
        } = await supabase
          .from('fitness_training_logs')
          .select('id')
          .eq('user_id', uid)
          .eq(
            'coach_session_id',
            completingSchedule.coachSessionId
          )
          .maybeSingle()

        if (existingCoachLogError) {
          throw existingCoachLogError
        }

        existingLog = existingCoachLog
      }

      const q = editingTraining?.id
        ? supabase
            .from('fitness_training_logs')
            .update(payload)
            .eq('id', editingTraining.id)
            .eq('user_id', uid)
        : existingLog?.id
          ? supabase
              .from('fitness_training_logs')
              .update(payload)
              .eq('id', existingLog.id)
              .eq('user_id', uid)
          : supabase
              .from('fitness_training_logs')
              .insert(payload)

      const { data, error } = await q
        .select('*')
        .single()
      if (error) throw error

      const item = rowToTraining(data)

      setSessions(prev => [
        ...prev.filter(
          s =>
            s.id !== item.id &&
            !(
              !editingTraining &&
              toKey(s.date) === toKey(item.date) &&
              s.activity === item.activity
            )
        ),
        item,
      ].sort((a, b) => a.date.localeCompare(b.date)))

      if (
        completingSchedule?.coachSessionId
      ) {
        await syncCoachSessionCompletion(
          completingSchedule.coachSessionId,
          uid
        )
      }

      if (completingSchedule) {
        let scheduleDeleteQuery = supabase
          .from('player_schedule')
          .delete()
          .eq('user_id', uid)

        scheduleDeleteQuery =
          completingSchedule.coachSessionId
            ? scheduleDeleteQuery.eq(
                'coach_session_id',
                completingSchedule.coachSessionId
              )
            : scheduleDeleteQuery.eq(
                'id',
                completingSchedule.id
              )

        const { error: scheduleDeleteError } =
          await scheduleDeleteQuery

        if (scheduleDeleteError) {
          throw scheduleDeleteError
        }

        setScheduleList(prev =>
          prev.filter(schedule =>
            completingSchedule.coachSessionId
              ? schedule.coachSessionId !==
                completingSchedule.coachSessionId
              : schedule.id !==
                completingSchedule.id
          )
        )
      }

      setCompletingSchedule(null)
      setShowTraining(false)
      setEditingTraining(null)
      setTrainingForm(emptyTraining())
    } catch (err) {
      setLoadError(err.message || 'Failed to save training.')
    } finally {
      setSaving(false)
    }
  }

  const deleteTraining = async () => {
    if (!editingTraining || saving) return

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()
      const { error } = await supabase.from('fitness_training_logs').delete().eq('id', editingTraining.id).eq('user_id', uid)
      if (error) throw error

      setSessions(prev => prev.filter(s => s.id !== editingTraining.id))
      setEditingTraining(null)
      setTrainingForm(emptyTraining())
    } catch (err) {
      setLoadError(err.message || 'Failed to delete training.')
    } finally {
      setSaving(false)
    }
  }

  const saveTest = async () => {
    if (editingTest?.addedByCoach) {
      setLoadError(
        'Coach-added fitness tests are read-only for players.'
      )
      return
    }

    if (!testForm.indicator) {
      setLoadError('Please select a fitness indicator.')
      return
    }

    if (!testForm.test.trim() || !testForm.result.trim() || saving) return

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()

      const payload = {
        user_id: uid,
        test_date: testForm.date,
        test_name: testForm.test.trim(),
        result: testForm.result.trim(),
        indicator: testForm.indicator,
        score: clamp(testForm.score),

        // This form belongs to the player side.
        // Keep player tests separate from coach-added tests.
        added_by_coach: false,
        coach_user_id: null,

        change_note:
          Number(testForm.adjustmentAmount) > 0
            ? `${testForm.adjustmentSign === '-' ? '-' : '+'}${Number(testForm.adjustmentAmount)} points`
            : editingTest
              ? 'Updated'
              : 'No score adjustment',
        updated_at: new Date().toISOString(),
      }

      const q = editingTest
        ? supabase.from('fitness_tests').update(payload).eq('id', editingTest.id).eq('user_id', uid)
        : supabase.from('fitness_tests').insert(payload)

      const { data, error } = await q.select('*').single()
      if (error) throw error

      const item = rowToTest(data)
      setTests(prev => [item, ...prev.filter(t => t.id !== item.id)])

      setShowTest(false)
      setEditingTest(null)
      setTestForm(emptyTest())
    } catch (err) {
      setLoadError(err.message || 'Failed to save fitness test.')
    } finally {
      setSaving(false)
    }
  }

  const deleteTest = async () => {
    if (editingTest?.addedByCoach) {
      setLoadError(
        'Coach-added fitness tests cannot be deleted by players.'
      )
      return
    }

    if (!editingTest || saving) return

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()
      const { error } = await supabase.from('fitness_tests').delete().eq('id', editingTest.id).eq('user_id', uid)
      if (error) throw error

      setTests(prev => prev.filter(t => t.id !== editingTest.id))
      setEditingTest(null)
      setTestForm(emptyTest())
    } catch (err) {
      setLoadError(err.message || 'Failed to delete fitness test.')
    } finally {
      setSaving(false)
    }
  }

  const saveRecovery = async () => {
    if (saving) return

    const heartRate = Number(recoveryForm.hr)

    if (
      !Number.isFinite(heartRate) ||
      heartRate < 30 ||
      heartRate > 220
    ) {
      setLoadError(
        'Please enter a valid resting heart rate between 30 and 220 BPM, or upload a clear BPM image.'
      )
      return
    }

    if (!recoveryForm.date) {
      setLoadError('Please select the recovery check-in date.')
      return
    }

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()

      const payload = {
        user_id: uid,
        log_date: recoveryForm.date,
        sleep_hours: Number(recoveryForm.sleep),
        fatigue_level: Number(recoveryForm.tiredness),
        soreness_level: Number(recoveryForm.muscleAche),
        resting_hr: heartRate,
        notes: recoveryForm.notes.trim(),
        updated_at: new Date().toISOString(),
      }

      const q = editingRecovery
        ? supabase
            .from('fitness_recovery_logs')
            .update(payload)
            .eq('id', editingRecovery.id)
            .eq('user_id', uid)
        : supabase
            .from('fitness_recovery_logs')
            .insert(payload)

      const { data, error } = await q.select('*').single()
      if (error) throw error

      const item = rowToRecovery(data)

      setRecoveryLogs(prev =>
        [
          ...prev.filter(r => r.id !== item.id),
          item,
        ].sort((a, b) => a.date.localeCompare(b.date))
      )

      setShowRecovery(false)
      setEditingRecovery(null)
      setRecoveryForm(emptyRecovery())
    } catch (err) {
      setLoadError(
        err.message || 'Failed to save recovery check-in.'
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteRecovery = async () => {
    if (!editingRecovery || saving) return

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()
      const { error } = await supabase.from('fitness_recovery_logs').delete().eq('id', editingRecovery.id).eq('user_id', uid)
      if (error) throw error

      setRecoveryLogs(prev => prev.filter(r => r.id !== editingRecovery.id))
      setEditingRecovery(null)
      setRecoveryForm(emptyRecovery())
    } catch (err) {
      setLoadError(err.message || 'Failed to delete recovery check-in.')
    } finally {
      setSaving(false)
    }
  }

  const saveInjury = async () => {
    if (!injuryForm.name.trim() || saving) return

    setSaving(true)
    setLoadError('')

    let uploadedImagePath = ''

    try {
      const uid = await getUserId()

      let imagePath =
        injuryForm.imagePath || ''

      if (injuryForm.imageFile) {
        const file =
          injuryForm.imageFile

        const extension =
          String(
            file.name || 'image.jpg'
          )
            .split('.')
            .pop()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '') ||
          'jpg'

        const imageName =
          `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 10)}.${extension}`

        uploadedImagePath =
          `${uid}/${imageName}`

        const {
          error: imageUploadError,
        } = await supabase.storage
          .from(INJURY_IMAGE_BUCKET)
          .upload(
            uploadedImagePath,
            file,
            {
              cacheControl: '3600',
              upsert: false,
              contentType:
                file.type || undefined,
            }
          )

        if (imageUploadError) {
          throw new Error(
            `Failed to upload injury photo: ${imageUploadError.message}`
          )
        }

        imagePath =
          uploadedImagePath
      }

      const payload = {
        user_id: uid,
        injury_date: injuryForm.date,
        injury_description:
          injuryForm.name.trim(),
        status: injuryForm.status,
        severity:
          injuryForm.severity ||
          'Mild',
        image_path:
          imagePath || null,
        notes: encodeInjuryNotes({
          notes:
            injuryForm.notes.trim(),
          bodyX: injuryForm.bodyX,
          bodyY: injuryForm.bodyY,
        }),
        updated_at:
          new Date().toISOString(),
      }

      const q = editingInjury
        ? supabase
            .from('fitness_injuries')
            .update(payload)
            .eq('id', editingInjury.id)
            .eq('user_id', uid)
        : supabase
            .from('fitness_injuries')
            .insert(payload)

      const { data, error } =
        await q
          .select('*')
          .single()

      if (error) throw error

      const previousImagePath =
        editingInjury?.imagePath ||
        ''

      if (
        previousImagePath &&
        previousImagePath !== imagePath
      ) {
        const {
          error: removeOldImageError,
        } = await supabase.storage
          .from(INJURY_IMAGE_BUCKET)
          .remove([
            previousImagePath,
          ])

        if (removeOldImageError) {
          console.error(
            'Failed to remove previous injury image:',
            removeOldImageError
          )
        }
      }

      const item =
        rowToInjury(data)

      setInjuries(prev => [
        item,
        ...prev.filter(
          i => i.id !== item.id
        ),
      ])

      setShowInjury(false)
      setEditingInjury(null)
      setInjuryForm(emptyInjury())
    } catch (err) {
      if (uploadedImagePath) {
        try {
          await supabase.storage
            .from(INJURY_IMAGE_BUCKET)
            .remove([
              uploadedImagePath,
            ])
        } catch (cleanupError) {
          console.error(
            'Failed to clean up injury image:',
            cleanupError
          )
        }
      }

      setLoadError(
        err.message ||
          'Failed to save injury.'
      )
    } finally {
      setSaving(false)
    }
  }

  const deleteInjury = async () => {
    if (!editingInjury || saving) return

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()

      const { error } = await supabase
        .from('fitness_injuries')
        .delete()
        .eq('id', editingInjury.id)
        .eq('user_id', uid)

      if (error) throw error

      if (editingInjury.imagePath) {
        const {
          error: imageDeleteError,
        } = await supabase.storage
          .from(INJURY_IMAGE_BUCKET)
          .remove([
            editingInjury.imagePath,
          ])

        if (imageDeleteError) {
          console.error(
            'Failed to delete injury image:',
            imageDeleteError
          )
        }
      }

      setInjuries(prev =>
        prev.filter(
          i => i.id !== editingInjury.id
        )
      )

      setEditingInjury(null)
      setInjuryForm(emptyInjury())
    } catch (err) {
      setLoadError(
        err.message ||
          'Failed to delete injury.'
      )
    } finally {
      setSaving(false)
    }
  }

  const requestDeleteSchedule = () => {
    setDeleteConfirm({
      title: 'Delete schedule?',
      message:
        'This scheduled activity will be permanently removed from your calendar.',
      itemName:
        editingSchedule?.activity ||
        editingSchedule?.title ||
        editingSchedule?.type ||
        'Scheduled activity',
      action: deleteSchedule,
    })
  }

  const requestDeleteTraining = () => {
    setDeleteConfirm({
      title: 'Delete completed training?',
      message:
        'This record will be removed from the Completed Training Log and your weekly training load may change.',
      itemName:
        editingTraining?.activity ||
        'Completed training',
      action: deleteTraining,
    })
  }

  const requestDeleteTest = () => {
    setDeleteConfirm({
      title: 'Delete fitness test?',
      message:
        'This fitness test result will be permanently removed.',
      itemName:
        editingTest?.test ||
        'Fitness test',
      action: deleteTest,
    })
  }

  const requestDeleteRecovery = () => {
    setDeleteConfirm({
      title: 'Delete recovery check-in?',
      message:
        'This recovery record will be permanently removed and your recovery score may change.',
      itemName: editingRecovery?.date
        ? `Recovery check-in · ${fmtDate(editingRecovery.date)}`
        : 'Recovery check-in',
      action: deleteRecovery,
    })
  }

  const requestDeleteInjury = () => {
    setDeleteConfirm({
      title: 'Delete injury record?',
      message:
        'This injury record will be permanently removed.',
      itemName:
        editingInjury?.name ||
        'Injury record',
      action: deleteInjury,
    })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm?.action || saving) return

    await deleteConfirm.action()
    setDeleteConfirm(null)
  }

  const updateFitnessActionCompletion =
    async completionRate => {
      if (
        !latestCoachProgress?.id ||
        savingCoachActionPlan
      ) {
        return
      }

      const nextCompletion =
        clamp(completionRate)

      const currentPlans =
        decodeActionPlans(
          latestCoachProgress.coach_comment
        )

      const nextCoachComment =
        encodeActionPlans({
          performance:
            currentPlans.performance,
          performanceDeadline:
            currentPlans.performanceDeadline,
          performanceCompletion:
            currentPlans.performanceCompletion,
          fitness:
            currentPlans.fitness,
          fitnessDeadline:
            currentPlans.fitnessDeadline,
          fitnessCompletion:
            nextCompletion,
        })

      setSavingCoachActionPlan(true)
      setLoadError('')

      try {
        const uid =
          await getUserId()

        const {
          data,
          error,
        } = await supabase
          .from(
            'coach_player_progress'
          )
          .update({
            coach_comment:
              nextCoachComment,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            latestCoachProgress.id
          )
          .eq(
            'player_user_id',
            uid
          )
          .select('*')

        if (error) {
          throw error
        }

        const updatedRow =
          data?.[0] || null

        if (!updatedRow) {
          throw new Error(
            'Your account does not currently have permission to update this action plan completion rate.'
          )
        }

        setCoachProgress(
          current =>
            current.map(item =>
              item.id ===
              updatedRow.id
                ? updatedRow
                : item
            )
        )
      } catch (error) {
        console.error(
          'Update fitness action plan completion error:',
          error
        )

        setLoadError(
          error.message ||
            'Failed to update fitness action plan completion.'
        )
      } finally {
        setSavingCoachActionPlan(false)
      }
    }

  const savePersonalNote = async () => {
    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()

      const { data, error } = await supabase
        .from('fitness_coach_notes')
        .upsert(
          {
            user_id: uid,
            note: draftPersonalNote.trim(),
            action_plan: draftPersonalActionPlan.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .single()

      if (error) throw error

      setPersonalNote(data.note || '')
      setDraftPersonalNote(data.note || '')
      setPersonalActionPlan(data.action_plan || '')
      setDraftPersonalActionPlan(data.action_plan || '')
    } catch (err) {
      setLoadError(err.message || 'Failed to save note.')
    } finally {
      setSaving(false)
    }
  }

  const savePersonalActionPlan = async () => {
    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()

      const { data, error } = await supabase
        .from('fitness_coach_notes')
        .upsert(
          {
            user_id: uid,
            note: draftPersonalNote.trim() || null,
            action_plan:
              draftPersonalActionPlan.trim() || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .single()

      if (error) throw error

      setPersonalNote(data.note || '')
      setDraftPersonalNote(data.note || '')
      setPersonalActionPlan(data.action_plan || '')
      setDraftPersonalActionPlan(data.action_plan || '')
    } catch (err) {
      setLoadError(
        err.message ||
          'Failed to save personal fitness action plan.'
      )
    } finally {
      setSaving(false)
    }
  }

  const exportReport = () => {
    const text = [
      'ShuttleTracker Fitness Report',
      `Fitness score: ${fitnessScore}/100`,
      `Recovery status: ${
        hasRecoveryData
          ? `${recoveryStatus} (${recoveryScore}/100)`
          : 'Not Set'
      }`,
      `Weekly training load: ${weeklyHours}h`,
      `Upcoming activities: ${upcomingActivitiesCount}`,
      `Completed training this month: ${completedTrainingThisMonth}`,
      `Fitness tests: ${tests.length}`,
      `Active injuries: ${activeInjuries}`,
      `Suggestion: ${
        hasRecoveryData
          ? suggestion
          : 'No recovery suggestion yet'
      }`,
      '',
      'Personal Note:',
      personalNote || draftPersonalNote || '-',
      '',
      'My Fitness Action Plan:',
      personalActionPlan || draftPersonalActionPlan || '-',
      '',
      'Coach Fitness Feedback:',
      latestCoachAssessment?.fitness_comment || '-',
      '',
      'Coach Fitness Action Plan:',
      coachActionPlans.fitness || '-',
      `Deadline: ${
        coachActionPlans.fitnessDeadline
          ? fmtDate(
              coachActionPlans.fitnessDeadline
            )
          : '-'
      }`,
      `Completion: ${coachActionPlans.fitnessCompletion}%`,
    ].join('\n')

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fitness-report.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  const pencilIcon = (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: '#C8D0E0', flexShrink: 0 }}>
      <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  if (loading && !showLoader) {
    return null
  }

  if (showLoader) {
    return (
      <div className={styles.card}>
        <Loader text="Loading fitness..." />
      </div>
    )
  }

  return (
    <div className={styles.playerReadablePage}>
      <div className={styles.pageHead}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div className={styles.pageTitle}>Fitness</div>
            <div className={styles.pageSub}>
              Plan training, confirm completed sessions and track your recovery.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
              className={styles.btnPrimary}
              style={{ background: '#10B981' }}
              onClick={openAddTest}
            >
              + Fitness Test
            </button>

            <button
              type="button"
              className={styles.btnPrimary}
              style={{ background: '#7C3AED' }}
              onClick={openAddRecovery}
            >
              + Recovery Check-in
            </button>

            <button
              type="button"
              className={styles.btnOutline}
              onClick={openAddInjury}
            >
              + Log Injury
            </button>

            <NotificationBell
              supabase={supabase}
              userId={userId}
              title="Fitness notifications"
              sourceTypes={FITNESS_NOTIFICATION_TYPES}
            />
          </div>
        </div>
      </div>

      {(saving || loadError) && !showSchedule && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 12,
            background: loadError ? '#FEF2F2' : '#F7F9FF',
            color: loadError ? '#EF4444' : '#64748B',
            border: loadError ? '1px solid #FCA5A5' : '1px solid #E8EEF8',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {loadError || 'Saving record...'}
        </div>
      )}

      <div
        style={{
          marginBottom: 16,
          padding: '12px 14px',
          borderRadius: 12,
          border: '1px solid var(--line, #E8EEF8)',
          background: 'var(--card, #FFFFFF)',
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--text-muted, #64748B)',
        }}
      >
        <span
          style={{
            fontWeight: 700,
            color: 'var(--text, #0D1B3E)',
          }}
        >
          {hasCoach ? 'Coach-connected mode: ' : 'Self-managed mode: '}
        </span>
        {hasCoach
          ? 'Sessions created or completed by your coach sync automatically. You only need to confirm your own planned sessions and add unplanned training when necessary.'
          : 'You can plan your own sessions, mark them completed or missed, and log unplanned training. A coach is not required to use this page.'}
      </div>

      <div
        className="fitness-mobile-metrics"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div className={styles.metricHighlight}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginBottom: 10,
                }}
              >
                <FitnessIcon
                  type="fitness"
                  color="#FFFFFF"
                  size={18}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'end', gap: 6, marginTop: 8 }}>
                <div
                  className={styles.metricVal}
                  style={{
                    color: '#FFFFFF',
                    WebkitTextFillColor: '#FFFFFF',
                  }}
                >
                  {fitnessScore}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>/100</div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 1,
                }}
              >
                <div
                  className={styles.metricLbl}
                  style={{
                    color: 'rgba(255,255,255,0.72)',
                  }}
                >
                  Fitness score
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowFitnessScoreInfo(true)
                  }
                  aria-label="How fitness score is calculated"
                  title="How fitness score is calculated"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border:
                      '1px solid rgba(255,255,255,0.55)',
                    background:
                      'rgba(255,255,255,0.12)',
                    color: '#FFFFFF',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  i
                </button>
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  color: fitnessScore >= 70 ? '#00C48C' : fitnessScore >= 50 ? '#F59E0B' : '#EF4444',
                }}
              >
                {!hasAnyFitnessIndicatorData
                  ? 'No fitness data yet'
                  : fitnessScore >= 70
                    ? 'Good condition'
                    : fitnessScore >= 50
                      ? 'Moderate'
                      : 'Needs improvement'}
              </div>
            </div>
            <ScoreRing value={fitnessScore} />
          </div>
        </div>

        <div className={styles.metric}>
          <div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#E8EFFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginBottom: 10,
              }}
            >
              <FitnessIcon type="clock" color="#1A5FFF" size={18} />
            </div>

            <div
              className={styles.metricVal}
              style={{
                color: '#1A5FFF',
                WebkitTextFillColor: '#1A5FFF',
              }}
            >
              {upcomingActivitiesCount}
            </div>

            <div className={styles.metricLbl}>Upcoming activities</div>
            <div style={{ marginTop: 5, fontSize: 13, color: '#8892A4' }}>
              planned training, matches & events
            </div>
          </div>
        </div>

        <div className={styles.metric}>
          <div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#DDF8EF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginBottom: 10,
              }}
            >
              <FitnessIcon type="training" color="#10B981" size={18} />
            </div>

            <div
              className={styles.metricVal}
              style={{
                color: '#10B981',
                WebkitTextFillColor: '#10B981',
              }}
            >
              {completedTrainingThisMonth}
            </div>

            <div className={styles.metricLbl}>Completed training</div>
            <div style={{ marginTop: 5, fontSize: 13, color: '#8892A4' }}>
              this month
            </div>
          </div>
        </div>

        <div className={styles.metric}>
          <div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#F3E8FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginBottom: 10,
              }}
            >
              <FitnessIcon type="fitness" color="#7C3AED" size={18} />
            </div>

            <div
              className={styles.metricVal}
              style={{
                color: '#7C3AED',
                WebkitTextFillColor: '#7C3AED',
              }}
            >
              {tests.length}
            </div>

            <div className={styles.metricLbl}>Fitness tests</div>
            <div style={{ marginTop: 5, fontSize: 13, color: '#8892A4' }}>
              recorded test results
            </div>
          </div>
        </div>

        <div className={styles.metric}>
          <div>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: activeInjuries > 0 ? '#FEF2F2' : '#DDF8EF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginBottom: 10,
              }}
            >
              <FitnessIcon
                type="recovery"
                color={activeInjuries > 0 ? '#EF4444' : '#10B981'}
                size={18}
              />
            </div>

            <div
              className={styles.metricVal}
              style={{
                color: activeInjuries > 0 ? '#EF4444' : '#10B981',
                WebkitTextFillColor: activeInjuries > 0 ? '#EF4444' : '#10B981',
              }}
            >
              {activeInjuries}
            </div>

            <div className={styles.metricLbl}>Active injuries</div>
            <div style={{ marginTop: 5, fontSize: 13, color: '#8892A4' }}>
              {activeInjuries > 0 ? 'currently monitored' : 'no active injury'}
            </div>
          </div>
        </div>
      </div>

      <div
        className="fitness-mobile-two-column"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          alignItems: 'stretch',
          marginBottom: 16,
        }}
      >
        <div className={styles.card}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
              Schedule Calendar
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                className={
                  googleSyncEnabled
                    ? styles.btnOutline
                    : styles.btnPrimary
                }
                disabled={googleCalendarBusy}
                style={{
                  fontSize: 14,
                  padding: '7px 14px',
                  whiteSpace: 'nowrap',
                  opacity: googleCalendarBusy ? 0.7 : 1,
                }}
                onClick={handleGoogleCalendarToggle}
              >
                {googleCalendarBusy
                  ? 'Please wait...'
                  : googleSyncEnabled
                    ? 'Disconnect Google Calendar'
                    : 'Connect Google Calendar'}
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                style={{
                  fontSize: 14,
                  padding: '7px 14px',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => openAddSchedule(selectedDate)}
              >
                + Add Schedule
              </button>
            </div>
          </div>

          <ScheduleCalendar
            schedules={calendarItems}
            selectedDate={selectedDate}
            onDayClick={key => setSelectedDate(selectedDate === key ? null : key)}
            onEditSchedule={openEditSchedule}
            onEditTraining={openEditTraining}
            onCompleteSchedule={async item => {
              if (item.source === 'coach_training') {
                await completeScheduledTraining(item)
                return
              }

              await completePlayerAddedSchedule(item)
            }}
            onMissSchedule={markScheduledTrainingMissed}
            saving={saving}
          />
        </div>

        <div
          className={styles.card}
          style={{
            position: 'relative',
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 0,
              }}
            >
              <div
                className={styles.cardTitle}
                style={{ marginBottom: 0 }}
              >
                Fitness Indicators
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  aria-label="About fitness indicators"
                  aria-expanded={showFitnessInfo}
                  onClick={() =>
                    setShowFitnessInfo(current => !current)
                  }
                  style={{
                    width: 18,
                    height: 18,
                    padding: 0,
                    borderRadius: '50%',
                    border:
                      '1px solid var(--line, #C9D4E5)',
                    color:
                      'var(--text-muted, #64748B)',
                    fontSize: 13,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background:
                      'var(--card, #FFFFFF)',
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                >
                  i
                </button>

                {showFitnessInfo && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 52,
                      left: 20,
                      right: 20,
                      zIndex: 30,
                      width: 'auto',
                      minWidth: 0,
                      maxWidth: 'none',
                      padding: '13px 14px',
                      borderRadius: 12,
                      border:
                        '1px solid var(--line, #E2E8F0)',
                      background:
                        'var(--card, #FFFFFF)',
                      boxShadow:
                        '0 12px 30px rgba(15, 23, 42, 0.14)',
                      color:
                        'var(--text, #0D1B3E)',
                    }}
                  >
                    {[
                      [
                        'Endurance',
                        'Helps you maintain energy, movement and performance during long rallies and matches without tiring too quickly.',
                      ],
                      [
                        'Speed',
                        'Helps you move quickly around the court, reach the shuttle faster and react effectively to fast shots.',
                      ],
                      [
                        'Strength',
                        'Supports powerful smashes, stable lunges and explosive movements needed during attacking and defensive play.',
                      ],
                      [
                        'Agility',
                        'Helps you change direction quickly, move efficiently between court positions and stay balanced during fast rallies.',
                      ],
                      [
                        'Recovery',
                        'Shows how well your body recovers from training and matches so you can perform effectively in the next session.',
                      ],
                    ].map(([name, description]) => (
                      <div
                        key={name}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '85px minmax(0, 1fr)',
                          gap: 8,
                          alignItems: 'start',
                          marginBottom:
                            name === 'Recovery' ? 0 : 9,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#1A5FFF',
                          }}
                        >
                          {name}
                        </div>

                        <div
                          style={{
                            fontSize: 13,
                            lineHeight: 1.45,
                            color:
                              'var(--text-muted, #64748B)',
                          }}
                        >
                          {description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              {canSetInitialFitness && (
                <button
                  type="button"
                  className={styles.btnOutline}
                  style={{
                    fontSize: 13,
                    padding: '7px 12px',
                  }}
                  onClick={openInitialFitness}
                >
                  Set initial levels
                </button>
              )}

              <button
                type="button"
                className={styles.btnOutline}
                style={{
                  fontSize: 13,
                  padding: '7px 12px',
                }}
                onClick={openAddTest}
              >
                Add fitness test
              </button>
            </div>
          </div>

          {indicators.map(item => {
            const displayLabel =
              item.name === 'Flexibility'
                ? 'Agility'
                : item.name

            const coachKey =
              item.name === 'Flexibility' ||
              item.name === 'Agility'
                ? 'agility'
                : item.name.toLowerCase()

            return (
              <FitnessComparisonRow
                key={item.name}
                label={displayLabel}
                playerValue={item.val}
                playerHasData={item.hasData}
                coachValue={latestCoachAssessment?.[coachKey]}
              />
            )
          })}

          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: '#8892A4',
              marginTop: 8,
            }}
          >
            Self-assessed starting levels can be edited only before a fitness
            test is recorded for that indicator. After a fitness test is added,
            the tested score is used and the starting level is locked. Recovery
            is calculated from the latest recovery check-in. Coach assessments
            remain separate and are shown by the purple marker.
          </div>
        </div>
      </div>

      <div
        className="fitness-mobile-two-column"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div className={styles.card}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
              Personal Note
            </div>

            <button
              className={styles.btnOutline}
              style={{ fontSize: 14, padding: '7px 14px' }}
              onClick={exportReport}
            >
              Export Report
            </button>
          </div>

          <div
            style={{
              marginBottom: 10,
              fontSize: 14,
              lineHeight: 1.55,
              color: 'var(--text-muted, #8892A4)',
            }}
          >
            Use this to write your own fitness reminder.
          </div>

          <textarea
            className={styles.formTextarea}
            placeholder="e.g. Need to improve footwork and reduce tiredness this week."
            value={draftPersonalNote}
            onChange={event =>
              setDraftPersonalNote(event.target.value)
            }
            style={{
              minHeight: 120,
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 10,
              marginTop: 10,
            }}
          >
            <button
              className={styles.btnPrimary}
              onClick={savePersonalNote}
              disabled={saving}
            >
              Save Note
            </button>
          </div>
        </div>

        {hasCoach && (
          <div className={styles.card}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
                Coach Fitness
              </div>

              {latestCoachUpdate && (
                <div style={{ fontSize: 13, color: 'var(--text-muted, #8892A4)' }}>
                  {new Date(
                    latestCoachUpdate
                  ).toLocaleDateString('en-MY', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              )}
            </div>

            <div
              style={{
                padding: '13px 14px',
                borderRadius: 12,
                background:
                  'color-mix(in srgb, #7C3AED 8%, var(--soft, #F6F8FF))',
                border:
                  '1px solid color-mix(in srgb, #7C3AED 18%, var(--line, #EEF1F8))',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#7C3AED',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 7,
                }}
              >
                Coach fitness feedback
              </div>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text, #0D1B3E)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {latestCoachAssessment?.fitness_comment ||
                  'No fitness feedback from your coach yet.'}
              </div>
            </div>

            <div
              style={{
                position: 'relative',
                marginTop: 12,
                padding: '13px 14px',
                borderRadius: 12,
                background:
                  'color-mix(in srgb, #1A5FFF 6%, var(--soft, #F6F8FF))',
                border:
                  '1px solid color-mix(in srgb, #1A5FFF 16%, var(--line, #EEF1F8))',
                overflow: 'hidden',
              }}
            >
              {coachFitnessDeadlineStatus && (
                <div
                  aria-label={`Fitness action plan status: ${coachFitnessDeadlineStatus.label}`}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    transform:
                      'translate(-50%, -50%) rotate(-18deg)',
                    zIndex: 4,
                    width: 'min(72%, 330px)',
                    minHeight: 78,
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border:
                      `5px double ${coachFitnessDeadlineStatus.border}`,
                    borderRadius: 12,
                    color:
                      coachFitnessDeadlineStatus.color,
                    background:
                      'transparent',
                    fontSize:
                      coachFitnessDeadlineStatus.label ===
                      'DUE TODAY'
                        ? 30
                        : 36,
                    fontWeight: 900,
                    letterSpacing: 4,
                    lineHeight: 1,
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    opacity:
                      coachFitnessDeadlineStatus.opacity,
                    pointerEvents: 'none',
                    userSelect: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  {coachFitnessDeadlineStatus.label}
                </div>
              )}
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1A5FFF',
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 7,
                }}
              >
                Fitness action plan
              </div>

              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text, #0D1B3E)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {coachActionPlans.fitness ||
                  'No fitness action plan from your coach yet.'}
              </div>

              {coachActionPlans.fitness && (
                <>
                  <div
                    style={{
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop:
                        '1px solid var(--line, #EEF1F8)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                      fontSize: 14,
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
                        {coachActionPlans.fitnessDeadline
                          ? fmtDate(
                              coachActionPlans.fitnessDeadline
                            )
                          : 'Not set'}
                      </strong>
                    </span>

                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color:
                          coachFitnessDeadlineStatus?.label ===
                          'COMPLETED'
                            ? '#047857'
                            : '#7C3AED',
                      }}
                    >
                      {coachActionPlans.fitnessCompletion}%
                    </span>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                    }}
                  >
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={
                        coachActionPlans.fitnessCompletion
                      }
                      disabled={
                        savingCoachActionPlan
                      }
                      onChange={event => {
                        const nextValue =
                          Number(
                            event.target.value
                          )

                        setCoachProgress(
                          current =>
                            current.map(item => {
                              if (
                                item.id !==
                                latestCoachProgress.id
                              ) {
                                return item
                              }

                              const plans =
                                decodeActionPlans(
                                  item.coach_comment
                                )

                              return {
                                ...item,
                                coach_comment:
                                  encodeActionPlans(
                                    {
                                      performance:
                                        plans.performance,
                                      performanceDeadline:
                                        plans.performanceDeadline,
                                      performanceCompletion:
                                        plans.performanceCompletion,
                                      fitness:
                                        plans.fitness,
                                      fitnessDeadline:
                                        plans.fitnessDeadline,
                                      fitnessCompletion:
                                        nextValue,
                                    }
                                  ),
                              }
                            })
                        )
                      }}
                      onMouseUp={event =>
                        updateFitnessActionCompletion(
                          event.currentTarget.value
                        )
                      }
                      onTouchEnd={event =>
                        updateFitnessActionCompletion(
                          event.currentTarget.value
                        )
                      }
                      onKeyUp={event => {
                        if (
                          [
                            'ArrowLeft',
                            'ArrowRight',
                            'Home',
                            'End',
                            'PageUp',
                            'PageDown',
                          ].includes(event.key)
                        ) {
                          updateFitnessActionCompletion(
                            event.currentTarget.value
                          )
                        }
                      }}
                      style={{
                        width: '100%',
                        accentColor: '#7C3AED',
                        cursor:
                          savingCoachActionPlan
                            ? 'wait'
                            : 'pointer',
                      }}
                    />

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 4,
                        fontSize: 13,
                        color:
                          'var(--text-muted, #8892A4)',
                      }}
                    >
                      <span>0%</span>
                      <span>50%</span>
                      <span>100%</span>
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        color:
                          'var(--text-muted, #8892A4)',
                      }}
                    >
                      {savingCoachActionPlan
                        ? 'Saving progress...'
                        : 'Move the slider to update your completion.'}
                    </div>
                  </div>
                </>
              )}
            </div>

          </div>
        )}

        {!hasCoach && (
          <div className={styles.card}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <div
                className={styles.cardTitle}
                style={{ marginBottom: 0 }}
              >
                My Fitness Action Plan
              </div>

              <span
                style={{
                  padding: '4px 9px',
                  borderRadius: 999,
                  background:
                    'color-mix(in srgb, #1A5FFF 10%, var(--card, #FFFFFF))',
                  color: '#1A5FFF',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                Self-managed
              </span>
            </div>

            <div
              style={{
                marginBottom: 10,
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--text-muted, #8892A4)',
              }}
            >
              Set clear fitness goals for yourself. Write what you plan to do,
              how often you will do it, and what you want to improve before
              your next review.
            </div>

            <textarea
              className={styles.formTextarea}
              rows={6}
              maxLength={1000}
              placeholder="Example: Complete interval running 3 times this week for 20 minutes, do 2 strength sessions, and record a recovery check-in after each training day."
              value={draftPersonalActionPlan}
              onChange={event =>
                setDraftPersonalActionPlan(
                  event.target.value
                )
              }
              style={{
                minHeight: 120,
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginTop: 10,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: '#8892A4',
                }}
              >
                {draftPersonalActionPlan.length}/1000
              </div>

              <button
                className={styles.btnPrimary}
                onClick={savePersonalActionPlan}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Action Plan'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        className="fitness-mobile-three-column"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.65fr 0.9fr 0.9fr',
          gap: 16,
          marginBottom: 16,
          alignItems: 'start',
        }}
      >
        <div
          ref={trainingCardRef}
          className={`${styles.card} fitness-training-card`}
          style={{
            gridColumn: '1',

            height:
              trainingSectionHeight
                ? `${trainingSectionHeight}px`
                : 'auto',
            minHeight:
              trainingSectionHeight
                ? `${trainingSectionHeight}px`
                : 0,
            maxHeight:
              trainingSectionHeight
                ? `${trainingSectionHeight}px`
                : 'none',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            alignSelf: 'start',
          }}
        >
          <div style={{ marginBottom: 14, flexShrink: 0 }}>
            <button
              type="button"
              className={styles.cardTitle}
              onClick={() => setAllRecordsView('training')}
              title="View all training records"
              style={{
                marginBottom: 4,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Training Log
            </button>
            <div style={{ fontSize: 14, color: 'var(--text-muted, #8892A4)' }}>
              Upcoming schedules are highlighted in blue. Completed sessions remain as training history.
            </div>
          </div>

          <div
            className="fitness-training-filters"
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(260px, 1fr) minmax(140px, 180px) auto',
              gap: 8,
              marginBottom: 10,
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <input
              className={styles.formInput}
              value={filter.search}
              onChange={event =>
                setFilter(current => ({
                  ...current,
                  search: event.target.value,
                }))
              }
              placeholder="Search training, focus, location or month"
            />

            <select
              className={styles.formSelect}
              value={filter.status}
              onChange={event =>
                setFilter(current => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            >
              <option value="All">All status</option>
              <option value="scheduled">Upcoming</option>
              <option value="completed">Completed</option>
              <option value="awaiting completion">Awaiting completion</option>
              <option value="missed">Missed</option>
              <option value="absent">Absent</option>
            </select>

            {(filter.search ||
              filter.status !== 'All') && (
              <button
                type="button"
                onClick={() =>
                  setFilter({
                    status: 'All',
                    search: '',
                  })
                }
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#1A5FFF',
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '8px 4px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Clear
              </button>
            )}
          </div>

          <div
            ref={trainingTableRef}
            className="fitness-training-table-wrap"
            style={{
              flex: 1,
              minHeight: 0,
              maxHeight: '100%',
              display: 'flex',
              flexDirection: 'column',
              overflowX: 'auto',
              overflowY: 'hidden',
              WebkitOverflowScrolling: 'touch',
              width: '100%',
              maxWidth: '100%',
            }}
          >
            <div
              className="fitness-training-header"
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '64px 114px minmax(160px, 1.3fr) minmax(190px, 1.7fr) 110px',
                gap: 10,
                padding: '0 10px 8px',
                color: '#8892A4',
                fontSize: 14,
                fontWeight: 700,
                alignItems: 'center',
                boxSizing: 'border-box',
                flexShrink: 0,
                width: 700,
                minWidth: 700,
              }}
            >
              <div>Date</div>
              <div>Time</div>
              <div>Training</div>
              <div>Focus</div>
              <div>Status</div>
            </div>

            {tableSessions.length === 0 && (
              <div
                style={{
                  padding: '18px 8px',
                  color: '#8892A4',
                  fontSize: 14,
                }}
              >
                No scheduled or completed sessions yet.
              </div>
            )}

            {tableSessions.length > 0 && (
              <div
                className="fitness-training-body"
                style={{
                  width: 700,
                  minWidth: 700,
                  flex: 1,
                  minHeight: 0,
                  maxHeight: '100%',
                  overflowY: 'auto',
                  overflowX: 'visible',
                  overscrollBehavior: 'contain',
                }}
              >
                {tableSessions.map(t => {
                  const statusText = String(
                    t.status || 'Scheduled'
                  )
                  const statusLower = statusText.toLowerCase()

                  return (
                    <div
                      key={t.id}
                      className={`${styles.listRow} fitness-training-row`}
                      onClick={() => {
                        setSelectedTrainingDetail(
                          t
                        )
                      }}
                      title="View training details"
                      style={{
                        cursor: 'pointer',
                        width: 700,
                        minWidth: 700,
                        display: 'grid',
                        gridTemplateColumns:
                          '64px 114px minmax(160px, 1.3fr) minmax(190px, 1.7fr) 110px',
                        gap: 10,
                        alignItems: 'center',
                        boxSizing: 'border-box',
                        borderRadius: 10,
                        padding: '10px 10px',
                        marginBottom: 6,
                        border:
                          statusLower === 'scheduled'
                            ? '1px solid color-mix(in srgb, #2563EB 30%, var(--line, #E8EEF8))'
                            : '1px solid transparent',
                        borderLeft:
                          statusLower === 'scheduled'
                            ? '4px solid #2563EB'
                            : statusLower === 'completed'
                              ? '4px solid #10B981'
                              : ['missed', 'absent'].includes(statusLower)
                                ? '4px solid #EF4444'
                                : '4px solid transparent',
                        background:
                          statusLower === 'scheduled'
                            ? 'color-mix(in srgb, #2563EB 8%, var(--card, #FFFFFF))'
                            : 'transparent',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: 'var(--text, #0D1B3E)',
                          }}
                        >
                          {new Date(
                            `${t.date}T00:00:00`
                          ).toLocaleDateString('en-MY', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                        <div style={{ fontSize: 13, color: '#8892A4' }}>
                          {new Date(
                            `${t.date}T00:00:00`
                          ).toLocaleDateString('en-MY', {
                            weekday: 'short',
                          })}
                        </div>
                      </div>

                      <div style={{ fontSize: 13, color: '#8892A4', fontWeight: 700 }}>
                        {safeTimeRange(t.time, t.endTime)}
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                          fontSize: 14,
                          fontWeight: 700,
                          lineHeight: 1.2,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {t.activity}
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                          maxWidth: '100%',
                          fontSize: 14,
                          color: 'var(--text, #0D1B3E)',
                          fontWeight: 600,
                          lineHeight: 1.25,
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        {t.focus || '-'}
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                          maxWidth: '100%',
                          fontSize: 13,
                          fontWeight: 700,
                          textAlign: 'left',
                          whiteSpace:
                            statusLower === 'awaiting completion'
                              ? 'normal'
                              : 'nowrap',
                          lineHeight: 1.2,
                          color:
                            statusLower === 'awaiting completion'
                              ? '#7C3AED'
                              : statusLower === 'completed'
                                ? '#10B981'
                                : ['missed', 'absent'].includes(statusLower)
                                  ? '#EF4444'
                                  : '#2563EB',
                        }}
                      >
                        {statusLower === 'scheduled'
                          ? 'Upcoming'
                          : statusLower === 'awaiting completion'
                            ? (
                              <>
                                Awaiting
                                <br />
                                completion
                              </>
                            )
                            : statusText.charAt(0).toUpperCase() +
                              statusText.slice(1).toLowerCase()}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div
          ref={rightFitnessStackRef}
          className="fitness-right-stack"
          style={{
            gridColumn: '2 / 4',
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gridTemplateRows: 'auto auto',
            gap: 16,
            minWidth: 0,
            alignContent: 'start',
            alignSelf: 'start',
            height: 'fit-content',
          }}
        >
        <div
          className={`${styles.card} fitness-tests-card`}
          style={{
            gridColumn: '1',
            gridRow: '1',
            minHeight: 0,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <button
              type="button"
              className={styles.cardTitle}
              onClick={() => setAllRecordsView('tests')}
              title="View all fitness test records"
              style={{
                marginBottom: 0,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Fitness Test Records
            </button>
            <button className={styles.btnOutline} style={{ fontSize: 14, padding: '7px 14px' }} onClick={openAddTest}>Add</button>
          </div>

          {visibleFitnessTests.length === 0 && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-start',
                padding: '18px 0',
                color: '#8892A4',
                fontSize: 14,
              }}
            >
              No fitness test saved yet.
            </div>
          )}

          {visibleFitnessTests.length > 0 && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {visibleFitnessTests.slice(0, 5).map(test => (
            <div
              key={test.id}
              className={styles.listRow}
              onClick={() => {
                if (!test.addedByCoach) {
                  openEditTest(test)
                }
              }}
              style={{
                cursor:
                  test.addedByCoach
                    ? 'default'
                    : 'pointer',
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 90px 20px',
                gap: 10,
                alignItems: 'center',
                paddingTop: 12,
                paddingBottom: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {test.test}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: '#8892A4',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <span>
                    {fmtDate(test.date)} · {test.indicator}
                  </span>

                  {test.addedByCoach && (
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 999,
                        background:
                          'color-mix(in srgb, #7C3AED 10%, var(--card, #FFFFFF))',
                        color: '#7C3AED',
                        fontSize: 12,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Added by Coach
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: '#0D1B3E',
                  fontWeight: 700,
                }}
              >
                {test.result}
              </div>

              {test.addedByCoach
                ? <span />
                : pencilIcon}
            </div>
              ))}

            </div>
          )}
        </div>

        <div
          className={`${styles.card} fitness-recovery-card`}
          style={{
            gridColumn: '2',
            gridRow: '1',
            minWidth: 0,
          }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <button
                type="button"
                className={styles.cardTitle}
                onClick={() => setAllRecordsView('recovery')}
                title="View all recovery check-ins"
                style={{
                  marginBottom: 0,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                Recovery Check-in
              </button>
              <button className={styles.btnOutline} style={{ fontSize: 14, padding: '7px 14px' }} onClick={openAddRecovery}>Add</button>
            </div>

            {[
              { label: 'Sleep Hours', val: latestRecovery ? `${latestRecovery.sleep} h` : '-', badge: latestRecovery ? (latestRecovery.sleep >= 7 ? 'Good' : 'Low') : 'No data', color: latestRecovery ? (latestRecovery.sleep >= 7 ? 'green' : 'amber') : 'gray' },
              { label: 'Tiredness', val: latestRecovery ? `${latestRecovery.tiredness} /10` : '-', badge: latestRecovery ? (latestRecovery.tiredness <= 3 ? 'Low' : 'Moderate') : 'No data', color: latestRecovery ? (latestRecovery.tiredness <= 3 ? 'green' : 'amber') : 'gray' },
              { label: 'Muscle Ache', val: latestRecovery ? `${latestRecovery.muscleAche} /10` : '-', badge: latestRecovery ? (latestRecovery.muscleAche <= 3 ? 'Low' : 'Moderate') : 'No data', color: latestRecovery ? (latestRecovery.muscleAche <= 3 ? 'green' : 'amber') : 'gray' },
              { label: 'Resting Heart Rate', val: latestRecovery ? `${latestRecovery.hr} bpm` : '-', badge: latestRecovery ? 'Saved' : 'No data', color: latestRecovery ? 'green' : 'gray' },
              {
                label: 'Recovery Score',
                val: hasRecoveryData ? `${recoveryScore} /100` : '-',
                badge: recoveryStatus,
                color: !hasRecoveryData
                  ? 'gray'
                  : recoveryScore >= 75
                    ? 'green'
                    : recoveryScore >= 55
                      ? 'amber'
                      : 'red',
              },
            ].map((r, i) => (
              <div key={i} className={styles.statRow}>
                <span className={styles.statLabel}>{r.label}</span>
                <span className={styles.statVal}>
                  {r.val}
                  <span className={getBadgeClass(r.color)} style={{ fontSize: 13, marginLeft: 8 }}>{r.badge}</span>
                </span>
              </div>
            ))}

            <div style={{ marginTop: 12, borderTop: '1px solid #EEF2F7', paddingTop: 10 }}>
              {[...recoveryLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(r => (
                <div key={r.id} className={styles.listRow} onClick={() => openEditRecovery(r)} style={{ cursor: 'pointer', borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{fmtDate(r.date)}</div>
                    <div style={{ fontSize: 14, color: '#8892A4' }}>Sleep {r.sleep}h · Tired {r.tiredness}/10 · Ache {r.muscleAche}/10</div>
                  </div>
                  {pencilIcon}
                </div>
              ))}
            </div>
        </div>

        <div
          ref={injuryLogCardRef}
          className={`${styles.card} fitness-injury-card`}
          style={{
            gridColumn: '1 / 3',
            gridRow: '2',
            minWidth: 0,
            height: 'fit-content',
            alignSelf: 'start',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <button
              type="button"
              className={styles.cardTitle}
              onClick={() => setAllRecordsView('injuries')}
              title="View all injury records"
              style={{
                marginBottom: 0,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Injury Log
            </button>
              <button className={styles.btnOutline} style={{ fontSize: 14, padding: '7px 14px' }} onClick={openAddInjury}>Add</button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 145px',
                gap: 18,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {injuries.length === 0 && (
                  <div
                    style={{
                      padding: '18px 0',
                      color: '#8892A4',
                      fontSize: 14,
                    }}
                  >
                    No injury records yet.
                  </div>
                )}

                {injuries.slice(0, 3).map(injury => {
                  const severityColor =
                    injury.severity === 'Severe'
                      ? '#EF4444'
                      : injury.severity === 'Moderate'
                        ? '#F59E0B'
                        : '#10B981'

                  return (
                    <div
                      key={injury.id}
                      onClick={() =>
                        openEditInjury(injury)
                      }
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          injury.imageUrl
                            ? '42px minmax(0, 1fr) 112px'
                            : 'minmax(0, 1fr) 112px',
                        gap: 10,
                        alignItems: 'center',
                        minHeight: 68,
                        padding: '10px 0',
                        cursor: 'pointer',
                        borderBottom:
                          '1px solid var(--line, #E8EEF8)',
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
                            background: '#F7F9FF',
                          }}
                        />
                      )}

                      <div
                        style={{
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: 'var(--text, #0D1B3E)',
                            lineHeight: 1.3,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {injury.name}
                        </div>

                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 14,
                            color: '#8892A4',
                          }}
                        >
                          {fmtDate(injury.date)}
                        </div>

                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 14,
                            fontWeight: 700,
                            color: severityColor,
                          }}
                        >
                          {injury.severity || 'Mild'} severity
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          minWidth: 0,
                        }}
                      >
                        <span
                          className={getBadgeClass(
                            injury.color
                          )}
                          style={{
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {injury.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div
                style={{
                  minWidth: 145,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderLeft:
                    '1px solid var(--line, #E8EEF8)',
                  paddingLeft: 14,
                }}
              >
                <InjuryBodyMap injuries={injuries} />
              </div>
            </div>
        </div>
        </div>
      </div>

      <style>
        {`
          .fitness-mobile-metrics,
          .fitness-mobile-metrics > *,
          .fitness-mobile-two-column,
          .fitness-mobile-two-column > *,
          .fitness-mobile-three-column,
          .fitness-mobile-three-column > * {
            min-width: 0;
          }

          .fitness-training-table-wrap {
            width: 100%;
            min-width: 0;
            max-width: 100%;
            direction: ltr;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: thin;
          }

          .fitness-training-header,
          .fitness-training-body,
          .fitness-training-row {
            box-sizing: border-box;
          }

          .fitness-training-body {
            padding-right: 0 !important;
            scrollbar-gutter: auto !important;
            overflow-x: hidden !important;
          }

          @media (max-width: 1200px) {
            .fitness-mobile-metrics {
              grid-template-columns:
                repeat(3, minmax(0, 1fr)) !important;
            }
          }

          @media (max-width: 900px) {
            .fitness-mobile-two-column,
            .fitness-mobile-three-column {
              grid-template-columns: 1fr !important;
              grid-template-rows: auto !important;
            }

            .fitness-right-stack {
              grid-column: auto !important;
              grid-template-columns: 1fr !important;
              grid-template-rows: auto !important;
            }

            .fitness-training-card,
            .fitness-tests-card,
            .fitness-recovery-card,
            .fitness-injury-card {
              grid-column: auto !important;
              grid-row: auto !important;
            }

            .fitness-injury-card > div:last-child {
              grid-template-columns: 1fr !important;
            }

            .fitness-injury-card > div:last-child > div:last-child {
              border-left: 0 !important;
              border-top: 1px solid var(--line, #E8EEF8) !important;
              padding-left: 0 !important;
              padding-top: 12px !important;
            }

            .fitness-training-filters {
              grid-template-columns:
                repeat(2, minmax(0, 1fr)) !important;
            }
          }

          @media (max-width: 640px) {
            [aria-label^='Fitness action plan status'] {
              width: min(76%, 220px) !important;
              min-height: 60px !important;
              padding: 8px 10px !important;
              font-size: 22px !important;
              letter-spacing: 2.5px !important;
              border-width: 4px !important;
            }
            .fitness-training-filters {
              grid-template-columns: 1fr !important;
            }

            .fitness-mobile-metrics {
              display: grid !important;
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 10px !important;
              margin-bottom: 12px !important;
            }

            .fitness-mobile-metrics > * {
              min-height: 145px !important;
              padding: 16px !important;
              border-radius: 16px !important;
              box-sizing: border-box;
            }

            .fitness-mobile-metrics > * > div {
              display: block !important;
              height: auto !important;
            }

            .fitness-mobile-ring {
              display: none !important;
            }

            .fitness-mobile-two-column,
            .fitness-mobile-three-column {
              gap: 12px !important;
              margin-bottom: 12px !important;
            }

            .fitness-training-table-wrap {
              overflow-x: auto;
              overflow-y: hidden;
              -webkit-overflow-scrolling: touch;
              scrollbar-width: thin;
              padding-bottom: 0;
              touch-action: pan-x pan-y;
              overscroll-behavior-x: contain;
            }

            .fitness-training-header,
            .fitness-training-body {
              width: 700px !important;
              min-width: 700px !important;
              max-width: 700px !important;
            }

            .fitness-training-body {
              overflow-x: hidden !important;
              overflow-y: auto !important;
            }

            .fitness-training-row {
              width: 700px !important;
              min-width: 700px !important;
              max-width: 700px !important;
            }

            /*
             * Mobile only:
             * Keep the main Training Log compact by showing the latest
             * 10 filtered records. The Training Log heading already opens
             * the existing All Training Log Records modal, so no extra
             * View All button is needed.
             *
             * Desktop is intentionally unchanged.
             */
            .fitness-training-body
              .fitness-training-row:nth-child(n + 11) {
              display: none !important;
            }

            .fitness-training-header > :nth-child(5),
            .fitness-training-row > :nth-child(5) {
              text-align: left !important;
              justify-self: stretch;
            }
          }

          @media (max-width: 390px) {
            .fitness-mobile-metrics {
              gap: 8px !important;
            }

            .fitness-mobile-metrics > * {
              min-height: 138px !important;
              padding: 13px !important;
            }
          }

          @media (max-width: 640px) {
            .fitness-mobile-modal {
              width: min(94vw, 100%) !important;
              max-height: calc(100dvh - 24px) !important;
              overflow-y: auto !important;
              overflow-x: hidden !important;
              -webkit-overflow-scrolling: touch;
              overscroll-behavior: contain;
              padding-bottom:
                calc(20px + env(safe-area-inset-bottom)) !important;
              box-sizing: border-box !important;
            }

            .fitness-mobile-modal input,
            .fitness-mobile-modal select,
            .fitness-mobile-modal textarea {
              min-width: 0 !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
              font-size: 16px !important;
            }

            .fitness-recovery-top-grid,
            .fitness-recovery-metrics-grid,
            .fitness-injury-meta-grid,
            .fitness-test-top-grid {
              min-width: 0 !important;
              width: 100% !important;
            }

            .fitness-recovery-top-grid > *,
            .fitness-recovery-metrics-grid > *,
            .fitness-injury-meta-grid > *,
            .fitness-test-top-grid > * {
              min-width: 0 !important;
              max-width: 100% !important;
            }

            .fitness-recovery-top-grid input,
            .fitness-recovery-top-grid select,
            .fitness-recovery-metrics-grid input,
            .fitness-recovery-metrics-grid select,
            .fitness-injury-meta-grid input,
            .fitness-injury-meta-grid select,
            .fitness-test-top-grid input,
            .fitness-test-top-grid select {
              display: block !important;
              width: 100% !important;
              min-width: 0 !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }

            .fitness-recovery-top-grid,
            .fitness-test-top-grid {
              grid-template-columns:
                repeat(2, minmax(0, 1fr)) !important;
              column-gap: 14px !important;
              row-gap: 10px !important;
            }

            .fitness-recovery-metrics-grid {
              grid-template-columns:
                repeat(2, minmax(0, 1fr)) !important;
              column-gap: 14px !important;
              row-gap: 10px !important;
            }

            .fitness-recovery-metrics-grid > :nth-child(3) {
              grid-column: 1 / -1 !important;
            }

            .fitness-injury-meta-grid {
              grid-template-columns:
                repeat(2, minmax(0, 1fr)) !important;
              column-gap: 14px !important;
              row-gap: 10px !important;
            }

            .fitness-injury-meta-grid > :nth-child(3) {
              grid-column: 1 / -1 !important;
            }
          }

          @media (max-width: 390px) {
            .fitness-recovery-top-grid,
            .fitness-test-top-grid,
            .fitness-injury-meta-grid {
              grid-template-columns: 1fr !important;
            }

            .fitness-injury-meta-grid > :nth-child(3) {
              grid-column: auto !important;
            }
          }

        `}
      </style>

      {allRecordsView && (
        <AllFitnessRecordsModal
          type={allRecordsView}
          trainingItems={trainingLogItems}
          tests={tests}
          recoveryLogs={recoveryLogs}
          injuries={injuries}
          onClose={() => setAllRecordsView(null)}
          onTraining={item => {
            setAllRecordsView(null)
            setSelectedTrainingDetail(item)
          }}
          onTest={item => {
            setAllRecordsView(null)
            openEditTest(item)
          }}
          onRecovery={item => {
            setAllRecordsView(null)
            openEditRecovery(item)
          }}
          onInjury={item => {
            setAllRecordsView(null)
            openEditInjury(item)
          }}
        />
      )}

      {selectedTrainingDetail && (
        <TrainingLogDetailModal
          item={
            selectedTrainingDetail
          }
          onClose={() =>
            setSelectedTrainingDetail(
              null
            )
          }
          onEdit={item => {
            setSelectedTrainingDetail(
              null
            )

            if (
              item.sourceType ===
                'schedule' &&
              item.original?.source !==
                'coach_training'
            ) {
              openEditSchedule(
                item.original
              )
              return
            }

            if (
              item.sourceType ===
              'training'
            ) {
              openEditTraining(
                item.original
              )
            }
          }}
        />
      )}

      {showSchedule && (
        <ScheduleModal
          title="Add Schedule"
          form={scheduleForm}
          onChange={setForm(setScheduleForm)}
          onSave={saveSchedule}
          onClose={() => {
            setShowSchedule(false)
            setEditingSchedule(null)
            setScheduleForm(emptySchedule())
            setLoadError('')
            setScheduleAvailabilityError('')
            setCheckingScheduleAvailability(false)
          }}
          coachOptions={coachOptions}
          venueHistory={venueHistory}
          saving={saving}
          error={loadError}
          availabilityError={scheduleAvailabilityError}
          checkingAvailability={checkingScheduleAvailability}
        />
      )}

      {editingSchedule && (
        <ScheduleModal
          title="Edit Schedule"
          form={scheduleForm}
          onChange={setForm(setScheduleForm)}
          onSave={saveSchedule}
          onClose={() => {
            setEditingSchedule(null)
            setScheduleForm(emptySchedule())
            setLoadError('')
            setScheduleAvailabilityError('')
            setCheckingScheduleAvailability(false)
          }}
          onDelete={requestDeleteSchedule}
          scheduleItem={editingSchedule}
          canChangeStatus={isScheduleFinished(editingSchedule)}
          coachOptions={coachOptions}
          availabilityError={scheduleAvailabilityError}
          checkingAvailability={checkingScheduleAvailability}
          onComplete={async () => {
            const item = editingSchedule
            setEditingSchedule(null)
            setScheduleForm(emptySchedule())
            await completePlayerAddedSchedule(item)
          }}
          onMiss={async () => {
            const item = editingSchedule
            setEditingSchedule(null)
            setScheduleForm(emptySchedule())
            await markScheduledTrainingMissed(item)
          }}
          saving={saving}
          error={loadError}
        />
      )}

      {showTraining && (
        <TrainingModal
          title={
            completingSchedule
              ? 'Complete Scheduled Training'
              : 'Log Unplanned Training'
          }
          form={trainingForm}
          onChange={setForm(setTrainingForm)}
          onSave={saveTraining}
          onClose={() => {
            setShowTraining(false)
            setCompletingSchedule(null)
            setTrainingForm(emptyTraining())
          }}
          saving={saving}
        />
      )}

      {editingTraining && (
        <TrainingModal
          title="Edit Training"
          form={trainingForm}
          onChange={setForm(setTrainingForm)}
          onSave={saveTraining}
          onClose={() => { setEditingTraining(null); setTrainingForm(emptyTraining()) }}
          onDelete={requestDeleteTraining}
          saving={saving}
        />
      )}

      {showInitialFitness && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="initial-fitness-title"
          onClick={event => {
            if (event.target === event.currentTarget && !saving) {
              setShowInitialFitness(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 540,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div>
                <div
                  id="initial-fitness-title"
                  className={styles.modalTitle}
                >
                  Set Initial Fitness Levels
                </div>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--text-muted, #8892A4)',
                  }}
                >
                  Set or edit a starting self-assessment before a fitness
                  test is recorded. Once a test is added for an indicator,
                  its starting level is locked.
                </div>
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={() => {
                  if (!saving) setShowInitialFitness(false)
                }}
                aria-label="Close initial fitness levels"
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {testIndicatorNames.map(name => {
                const existingTest = latestPlayerTestFor(name)
                const isLocked = Boolean(existingTest)
                const currentValue = isLocked
                  ? clamp(existingTest.score)
                  : clamp(initialFitnessForm[name])

                return (
                  <div
                    key={name}
                    className={styles.formRow}
                    style={{
                      marginBottom: 0,
                      paddingBottom: 14,
                      borderBottom:
                        '1px solid var(--line, #E8EEF8)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <label
                        className={styles.formLabel}
                        style={{
                          marginBottom: 0,
                          fontSize: 14,
                        }}
                      >
                        {name}
                      </label>

                      {isLocked ? (
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#10B981',
                          }}
                        >
                          {currentValue} /100 · Locked
                        </span>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <input
                            className={styles.formInput}
                            type="number"
                            min="0"
                            max="100"
                            value={currentValue}
                            disabled={saving}
                            onChange={event =>
                              setInitialFitnessForm(previous => ({
                                ...previous,
                                [name]: clamp(event.target.value),
                              }))
                            }
                            style={{
                              width: 78,
                              height: 38,
                              padding: '7px 9px',
                              textAlign: 'center',
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          />

                          <span
                            style={{
                              fontSize: 14,
                              color:
                                'var(--text-muted, #8892A4)',
                            }}
                          >
                            /100
                          </span>
                        </div>
                      )}
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={currentValue}
                      disabled={isLocked || saving}
                      onChange={event =>
                        setInitialFitnessForm(previous => ({
                          ...previous,
                          [name]: Number(event.target.value),
                        }))
                      }
                      style={{
                        width: '100%',
                        accentColor: '#1A5FFF',
                        cursor: isLocked
                          ? 'not-allowed'
                          : 'pointer',
                      }}
                    />

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 5,
                        fontSize: 12,
                        color:
                          'var(--text-muted, #8892A4)',
                      }}
                    >
                      <span>0</span>
                      <span>
                        {isLocked
                          ? 'Locked after fitness test'
                          : 'Self-assessed starting level'}
                      </span>
                      <span>100</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              style={{
                marginTop: 18,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                disabled={saving}
                onClick={() => setShowInitialFitness(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className={styles.btnPrimary}
                disabled={
                  saving ||
                  missingTestIndicators.length === 0
                }
                onClick={saveInitialFitness}
              >
                {saving ? 'Saving...' : 'Save initial levels'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTest && (
        <TestModal
          title="Add Fitness Test"
          form={testForm}
          onChange={setForm(setTestForm)}
          onSave={saveTest}
          onClose={() => { setShowTest(false); setTestForm(emptyTest()) }}
          saving={saving}
          currentScore={
            testForm.indicator
              ? Number(
                  (
                    latestPlayerTestFor(testForm.indicator) ||
                    latestBaselineFor(testForm.indicator)
                  )?.score
                ) || 0
              : 0
          }
        />
      )}

      {editingTest && (
        <TestModal
          title="Edit Fitness Test"
          form={testForm}
          onChange={setForm(setTestForm)}
          onSave={saveTest}
          onClose={() => { setEditingTest(null); setTestForm(emptyTest()) }}
          onDelete={requestDeleteTest}
          saving={saving}
          currentScore={
            testForm.indicator
              ? Number(
                  (
                    latestPlayerTestFor(testForm.indicator) ||
                    latestBaselineFor(testForm.indicator)
                  )?.score
                ) || 0
              : 0
          }
        />
      )}

      {showRecovery && (
        <RecoveryModal
          title="Recovery Check-in"
          form={recoveryForm}
          onChange={setForm(setRecoveryForm)}
          onSave={saveRecovery}
          onClose={() => { setShowRecovery(false); setRecoveryForm(emptyRecovery()) }}
          saving={saving}
        />
      )}

      {editingRecovery && (
        <RecoveryModal
          title="Edit Recovery Check-in"
          form={recoveryForm}
          onChange={setForm(setRecoveryForm)}
          onSave={saveRecovery}
          onClose={() => { setEditingRecovery(null); setRecoveryForm(emptyRecovery()) }}
          onDelete={requestDeleteRecovery}
          saving={saving}
        />
      )}

      {showInjury && (
        <InjuryModal
          title="Log Injury"
          form={injuryForm}
          onChange={setForm(setInjuryForm)}
          onSave={saveInjury}
          onClose={() => { setShowInjury(false); setInjuryForm(emptyInjury()) }}
          saving={saving}
        />
      )}

      {editingInjury && (
        <InjuryModal
          title="Edit Injury"
          form={injuryForm}
          onChange={setForm(setInjuryForm)}
          onSave={saveInjury}
          onClose={() => { setEditingInjury(null); setInjuryForm(emptyInjury()) }}
          onDelete={requestDeleteInjury}
          saving={saving}
        />
      )}

      {showFitnessScoreInfo && (
        <div
          className={styles.modalOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="fitness-score-info-title"
          onClick={event => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowFitnessScoreInfo(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 540 }}
          >
            <div className={styles.modalHead}>
              <div>
                <div
                  id="fitness-score-info-title"
                  className={styles.modalTitle}
                >
                  How the Fitness Score is calculated
                </div>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 12,
                    lineHeight: 1.5,
                    color:
                      'var(--text-muted, #8892A4)',
                  }}
                >
                  The score summarises the five fitness indicators shown on this page into one value out of 100.
                </div>
              </div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={() =>
                  setShowFitnessScoreInfo(false)
                }
                aria-label="Close fitness score information"
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gap: 8,
              }}
            >
              {fitnessScoreBreakdown.items.map(
                item => (
                  <div
                    key={item.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent:
                        'space-between',
                      gap: 14,
                      padding: '9px 11px',
                      borderRadius: 10,
                      background:
                        'var(--soft, #F7F9FF)',
                      border:
                        '1px solid var(--line, #E8EEF8)',
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
                      {item.name}
                    </span>

                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#1A5FFF',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {Math.round(item.value)} /100
                    </span>
                  </div>
                )
              )}
            </div>

            {fitnessScoreBreakdown.items.length > 0 && (
              <div
                style={{
                  marginTop: 14,
                  padding: 13,
                  borderRadius: 12,
                  background:
                    'color-mix(in srgb, #1A5FFF 7%, var(--card, #FFFFFF))',
                  border:
                    '1px solid color-mix(in srgb, #1A5FFF 20%, var(--line, #E8EEF8))',
                }}
              >
                {fitnessScoreBreakdown.matchesDisplayedScore ? (
                  <>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color:
                          'var(--text, #0D1B3E)',
                        lineHeight: 1.6,
                      }}
                    >
                      Formula
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        lineHeight: 1.6,
                        color:
                          'var(--text-muted, #64748B)',
                      }}
                    >
                      (
                      {fitnessScoreBreakdown.items
                        .map(item =>
                          Math.round(item.value)
                        )
                        .join(' + ')}
                      ) ÷{' '}
                      {fitnessScoreBreakdown.items.length}
                      {' '}= {' '}
                      {fitnessScoreBreakdown.average.toFixed(1)}
                    </div>

                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#1A5FFF',
                      }}
                    >
                      Rounded Fitness Score = {fitnessScore}/100
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.6,
                      color:
                        'var(--text-muted, #64748B)',
                    }}
                  >
                    ShuttleTrack calculates this score through the fitness summary using fitness-test results, completed training, recovery check-ins, injury status and schedule information.
                  </div>
                )}
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                fontSize: 11,
                lineHeight: 1.55,
                color:
                  'var(--text-muted, #8892A4)',
              }}
            >
              Endurance, Speed, Strength and Agility are based on the player's fitness-test records. Recovery reflects the player's latest recovery information. Coach assessment markers are shown separately and do not replace the player's own indicator values.
            </div>

            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop:
                  '1px solid var(--line, #E8EEF8)',
                fontSize: 11,
                lineHeight: 1.6,
                color:
                  'var(--text-muted, #8892A4)',
              }}
            >
              Score interpretation: 70–100 = Good condition, 50–69 = Moderate, below 50 = Needs improvement.
            </div>

            <div
              style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() =>
                  setShowFitnessScoreInfo(false)
                }
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <DeleteConfirmationModal
          title={deleteConfirm.title}
          message={deleteConfirm.message}
          itemName={deleteConfirm.itemName}
          onCancel={() => {
            if (!saving) setDeleteConfirm(null)
          }}
          onConfirm={confirmDelete}
          deleting={saving}
        />
      )}
    </div>
  )
}