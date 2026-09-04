import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import NotificationBell from '../Notifications/NotificationBell'
import { supabase } from '../../lib/supabaseClient'
import { calculateFitnessSummary } from '../../utils/fitnessScore'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'
import { createWorker, PSM } from 'tesseract.js'
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  createGoogleCalendarEvent,
  ensureGoogleCalendarAccess,
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
  Flexibility: '#F59E0B',
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

function calculateEndTime(startTime, durationValue) {
  const durationMinutes = parseMinutes(durationValue)

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
    (hour * 60 + minute + durationMinutes) % (24 * 60)

  const endHour = Math.floor(totalMinutes / 60)
  const endMinute = totalMinutes % 60

  return `${String(endHour).padStart(2, '0')}:${String(
    endMinute
  ).padStart(2, '0')}`
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
  indicator: 'Endurance',
  score: 70,
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
  }
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

function ModalShell({ title, children, onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 560 }}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>{title}</div>
          <button className={styles.modalClose} onClick={onClose}>x</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormActions({ onSave, onClose, onDelete, saving }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
      {onDelete ? (
        <button
          onClick={onDelete}
          disabled={saving}
          style={{
            padding: '9px 16px',
            borderRadius: 10,
            border: '1.5px solid #FCA5A5',
            background: '#FEF2F2',
            color: '#EF4444',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      ) : <div />}

      <div style={{ display: 'flex', gap: 10 }}>
        <button className={styles.btnOutline} onClick={onClose} disabled={saving}>Cancel</button>
        <button className={styles.btnPrimary} onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </div>
  )
}

function TrainingModal({ title, form, onChange, onSave, onClose, onDelete, saving }) {
  const handleTimeChange = (field, value) => {
    onChange(field, value)

    if (field === 'startTime' && form.duration) {
      const nextEndTime = calculateEndTime(
        value,
        form.duration
      )

      if (nextEndTime) {
        onChange('endTime', nextEndTime)
      }
    }

    if (field === 'endTime' && form.startTime) {
      onChange(
        'duration',
        calculateDuration(form.startTime, value)
      )
    }
  }

  const handleDurationChange = value => {
    onChange('duration', value)

    const nextEndTime = calculateEndTime(
      form.startTime,
      value
    )

    if (nextEndTime) {
      onChange('endTime', nextEndTime)
    }
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Date</label>
          <input className={styles.formInput} type="date" value={form.date} onChange={e => onChange('date', e.target.value)} />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Focus area</label>
          <select className={styles.formSelect} value={form.focus} onChange={e => onChange('focus', e.target.value)}>
            <option>Endurance</option>
            <option>Speed</option>
            <option>Strength</option>
            <option value="Agility">Agility</option>
            <option>Recovery</option>
            <option>Matches</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Start time</label>
          <input
            className={styles.formInput}
            type="time"
            value={form.startTime}
            onChange={e =>
              handleTimeChange('startTime', e.target.value)
            }
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>End time</label>
          <input
            className={styles.formInput}
            type="time"
            value={form.endTime}
            onChange={e =>
              handleTimeChange('endTime', e.target.value)
            }
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Training activity</label>
        <input
          className={styles.formInput}
          placeholder="e.g. Court training"
          value={form.activity}
          onChange={e => onChange('activity', e.target.value)}
        />
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Duration</label>
        <input
          className={styles.formInput}
          value={
            form.duration ||
            calculateDuration(
              form.startTime,
              form.endTime
            )
          }
          onChange={event =>
            handleDurationChange(event.target.value)
          }
          placeholder="e.g. 2h, 1h 30min or 45min"
        />
        <div style={{ marginTop: 5, fontSize: 10, color: '#8892A4' }}>
          Entering a duration automatically updates the end time.
          Changing the end time recalculates the duration.
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Notes optional</label>
        <textarea
          className={styles.formTextarea}
          placeholder="e.g. Practiced footwork and smash defense."
          value={form.notes}
          onChange={e => onChange('notes', e.target.value)}
        />
      </div>

      <FormActions onSave={onSave} onClose={onClose} onDelete={onDelete} saving={saving} />
    </ModalShell>
  )
}

function TestModal({ title, form, onChange, onSave, onClose, onDelete, saving }) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Date</label>
          <input className={styles.formInput} type="date" value={form.date} onChange={e => onChange('date', e.target.value)} />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Indicator updated</label>
          <select className={styles.formSelect} value={form.indicator} onChange={e => onChange('indicator', e.target.value)}>
            <option>Endurance</option>
            <option>Speed</option>
            <option>Strength</option>
            <option value="Agility">Agility</option>
          </select>
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Test name</label>
        <input className={styles.formInput} placeholder="e.g. 20m Sprint" value={form.test} onChange={e => onChange('test', e.target.value)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Result</label>
          <input className={styles.formInput} placeholder="e.g. 3.35 s" value={form.result} onChange={e => onChange('result', e.target.value)} />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Score /100</label>
          <input className={styles.formInput} type="number" min="0" max="100" value={form.score} onChange={e => onChange('score', e.target.value)} />
        </div>
      </div>

      <FormActions onSave={onSave} onClose={onClose} onDelete={onDelete} saving={saving} />
    </ModalShell>
  )
}

const recognizeOcr = async (
  worker,
  source
) => {
  /*
   * Send generated canvases to Tesseract as PNG Blob URLs.
   * Blob URLs are more memory-friendly than very large data URLs.
   */
  if (
    typeof HTMLCanvasElement !==
      'undefined' &&
    source instanceof
      HTMLCanvasElement
  ) {
    const blob =
      await new Promise(
        (resolve, reject) => {
          source.toBlob(
            result => {
              if (result) {
                resolve(result)
              } else {
                reject(
                  new Error(
                    'Unable to prepare OCR image.'
                  )
                )
              }
            },
            'image/png',
            1
          )
        }
      )

    const blobUrl =
      URL.createObjectURL(blob)

    try {
      return await worker.recognize(
        blobUrl
      )
    } finally {
      URL.revokeObjectURL(
        blobUrl
      )
    }
  }

  return worker.recognize(
    source
  )
}

function RecoveryModal({
  title,
  form,
  onChange,
  onSave,
  onClose,
  onDelete,
  saving,
}) {
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrMessage, setOcrMessage] = useState('')
  const [detectedBpm, setDetectedBpm] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [uploadedBpmFile, setUploadedBpmFile] = useState(null)
  const [cropMode, setCropMode] = useState(false)
  const [cropRect, setCropRect] = useState(null)

  const fileInputRef = useRef(null)
  const cropImageRef = useRef(null)
  const cropDragStartRef = useRef(null)
  const ocrCancelledRef = useRef(false)

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  const isValidBpm = value => {
    const bpm = Number(value)

    return (
      Number.isFinite(bpm) &&
      bpm >= 30 &&
      bpm <= 220
    )
  }

  const createCrop = (
    bitmap,
    {
      x,
      y,
      width,
      height,
      scale = 5,
      mode = 'normal',
    }
  ) => {
    const sx = Math.max(
      0,
      Math.round(bitmap.width * x)
    )
    const sy = Math.max(
      0,
      Math.round(bitmap.height * y)
    )
    const sw = Math.max(
      1,
      Math.min(
        bitmap.width - sx,
        Math.round(bitmap.width * width)
      )
    )
    const sh = Math.max(
      1,
      Math.min(
        bitmap.height - sy,
        Math.round(bitmap.height * height)
      )
    )

    /*
     * Do not let OCR crops become extremely large.
     *
     * A 3000-4000px phone photo combined with scale 18/24/28 can
     * otherwise create a temporary canvas over 10,000-20,000px wide,
     * which can make Tesseract fail with:
     * "Error attempting to read image."
     *
     * Keep the requested zoom, but cap the longest output side.
     */
    const requestedWidth =
      Math.max(
        1,
        Math.round(sw * scale)
      )

    const requestedHeight =
      Math.max(
        1,
        Math.round(sh * scale)
      )

    const MAX_OCR_SIDE = 2400

    const outputScale =
      Math.min(
        1,
        MAX_OCR_SIDE /
          Math.max(
            requestedWidth,
            requestedHeight
          )
      )

    const canvas =
      document.createElement('canvas')

    canvas.width =
      Math.max(
        1,
        Math.round(
          requestedWidth *
            outputScale
        )
      )

    canvas.height =
      Math.max(
        1,
        Math.round(
          requestedHeight *
            outputScale
        )
      )

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    })

    ctx.imageSmoothingEnabled = false

    ctx.drawImage(
      bitmap,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      canvas.width,
      canvas.height
    )

    if (mode === 'normal') {
      return canvas
    }

    const imageData = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    )

    const pixels = imageData.data

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]

      let value = 0

      if (mode === 'gray') {
        const gray =
          r * 0.299 +
          g * 0.587 +
          b * 0.114

        value = Math.max(
          0,
          Math.min(
            255,
            Math.round(
              (gray - 128) * 1.8 + 128
            )
          )
        )
      }

      if (mode === 'bright') {
        const gray =
          r * 0.299 +
          g * 0.587 +
          b * 0.114

        value =
          gray >= 145
            ? 255
            : 0
      }

      if (mode === 'red') {
        const redDifference =
          r - (g + b) / 2

        value = Math.max(
          0,
          Math.min(
            255,
            Math.round(
              redDifference * 3.2 + 128
            )
          )
        )
      }

      if (mode === 'softBright') {
        const gray =
          r * 0.299 +
          g * 0.587 +
          b * 0.114

        value =
          gray >= 90
            ? 255
            : 0
      }

      if (mode === 'invertGray') {
        const gray =
          r * 0.299 +
          g * 0.587 +
          b * 0.114

        const contrasted = Math.max(
          0,
          Math.min(
            255,
            Math.round(
              (gray - 92) * 2.25 + 128
            )
          )
        )

        value = 255 - contrasted
      }

      if (mode === 'pinkMask') {
        /*
         * Smartwatch heart-rate values are commonly drawn in
         * pink/red on a nearly black display. Convert those pixels
         * to solid black on a white background so Tesseract sees
         * clean number shapes instead of tiny coloured anti-aliased
         * pixels.
         */
        const maxOther = Math.max(g, b)
        const redLead = r - g
        const pinkBrightness = r + b

        const isPinkOrRed =
          r >= 105 &&
          (
            redLead >= 20 ||
            (
              r >= 145 &&
              pinkBrightness >= 260 &&
              r >= maxOther - 10
            )
          )

        value =
          isPinkOrRed
            ? 0
            : 255
      }

      pixels[i] = value
      pixels[i + 1] = value
      pixels[i + 2] = value
      pixels[i + 3] = 255
    }

    ctx.putImageData(
      imageData,
      0,
      0
    )

    return canvas
  }

  const extractContextCandidates = (
    text,
    source = 'full'
  ) => {
    if (!text) return []

    const raw = String(text)
      .replace(/\r/g, '\n')
      .replace(/[|]/g, 'I')
      .trim()

    const candidates = []

    const add = (
      value,
      score,
      reason,
      labelled = false
    ) => {
      const bpm = Number(value)

      if (!isValidBpm(bpm)) {
        return
      }

      candidates.push({
        value: bpm,
        score,
        reason,
        source,
        labelled,
      })
    }

    const sanitised = raw
      .replace(
        /\b(?:max(?:imum)?|min(?:imum)?)\b[^\n]{0,20}\b\d{2,3}\b/gi,
        ' '
      )
      .replace(
        /\b\d{2,3}\s*kcal\b/gi,
        ' '
      )
      .replace(
        /\b\d{1,3}\s*%/g,
        ' '
      )
      .replace(
        /\b\d{1,2}\s*:\s*\d{2}\b/g,
        ' '
      )

    for (
      const match of sanitised.matchAll(
        /\baverage\b[^\d]{0,30}(\d{2,3})\s*bpm\b/gi
      )
    ) {
      add(
        match[1],
        2000,
        'Average + BPM',
        true
      )
    }

    for (
      const match of sanitised.matchAll(
        /\b(\d{2,3})\s*bpm\b/gi
      )
    ) {
      const start = Math.max(
        0,
        match.index - 25
      )
      const end = Math.min(
        sanitised.length,
        match.index +
          match[0].length +
          35
      )

      const nearbyMatchText =
        sanitised.slice(
          start,
          end
        )

      if (
        /\bago\b|\bprevious\b|\bhistory\b/i.test(
          nearbyMatchText
        )
      ) {
        console.log(
          'Rejecting historical BPM:',
          nearbyMatchText
        )
        continue
      }

      add(
        match[1],
        1800,
        'number directly beside BPM',
        true
      )
    }

    for (
      const match of sanitised.matchAll(
        /\bheart\s*rate\b(?:(?!\bmax\b|\bmin\b)[\s\S]){0,80}?(\d{2,3})\b/gi
      )
    ) {
      add(
        match[1],
        1500,
        'first number after Heart Rate',
        true
      )
    }

    for (
      const match of sanitised.matchAll(
        /\bpulse\b(?:(?!\bmax\b|\bmin\b)[\s\S]){0,50}?(\d{2,3})\b/gi
      )
    ) {
      add(
        match[1],
        1400,
        'first number after Pulse',
        true
      )
    }

    const lines = sanitised
      .split(/\n+/)
      .map(line =>
        line.replace(/\s+/g, ' ').trim()
      )
      .filter(Boolean)

    lines.forEach((line, index) => {
      const previous = lines[index - 1] || ''
      const next = lines[index + 1] || ''
      const nearby =
        `${previous} ${line} ${next}`

      if (
        /\bkcal\b|\bcalories?\b|\bduration\b|\bmax(?:imum)?\b|\bmin(?:imum)?\b|\bago\b|\bprevious\b|\bhistory\b/i.test(
          nearby
        )
      ) {
        return
      }

      const values = [
        ...line.matchAll(
          /\b(\d{2,3})\b/g
        ),
      ]
        .map(match => Number(match[1]))
        .filter(isValidBpm)

      if (!values.length) {
        return
      }

      if (values.length >= 3) {
        return
      }

      values.forEach(value => {
        let score =
          source === 'summary'
            ? 900
            : source === 'full'
              ? 120
              : 400

        let labelled = false
        let reason =
          `${source} contextual number`

        if (/\baverage\b/i.test(nearby)) {
          score += 700
          labelled = true
          reason = 'number near Average'
        }

        if (/\bbpm\b/i.test(nearby)) {
          score += 800
          labelled = true
          reason = 'number near BPM'
        }

        if (
          /heart\s*rate|\bpulse\b|\bHR\b/i.test(
            nearby
          )
        ) {
          score += 550
          labelled = true
          reason =
            'number near Heart Rate'
        }

        add(
          value,
          score,
          reason,
          labelled
        )
      })
    })

    return candidates
  }

  const extractDigitCandidates = (
    text,
    source,
    confidence = 0,
    baseScore = 500
  ) => {
    const compact = String(text || '')
      .replace(/\s+/g, '')
      .trim()

    /*
     * On tiny seven-segment / smartwatch digits Tesseract can read
     * an 8 as B. Correct that only inside short digit-like tokens.
     */
    const digitLike = compact.replace(
      /(?<=[0-9B])B(?=[0-9B])|^B(?=[0-9B])|(?<=[0-9B])B$/g,
      '8'
    )

    const values = (
      digitLike.match(/\d{2,3}/g) ||
      []
    )
      .map(Number)
      .filter(isValidBpm)

    return values.map(value => ({
      value,
      score:
        baseScore +
        Math.max(
          0,
          Number(confidence) || 0
        ) *
          0.6,
      reason:
        `${source} digit-only OCR`,
      source,
      labelled: false,
    }))
  }

  const detectWatchScreenBounds = bitmap => {
    /*
     * Auto-find the smartwatch display using the red/pink pixels that
     * normally belong to the heart-rate UI. This avoids requiring the
     * user to crop the photo manually.
     *
     * The returned values are normalised 0..1 coordinates so they can
     * be passed directly into createCrop().
     */
    const maxSide = 320
    const scale = Math.min(
      1,
      maxSide /
        Math.max(
          bitmap.width,
          bitmap.height
        )
    )

    const width = Math.max(
      1,
      Math.round(bitmap.width * scale)
    )
    const height = Math.max(
      1,
      Math.round(bitmap.height * scale)
    )

    const canvas =
      document.createElement('canvas')

    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    })

    ctx.drawImage(
      bitmap,
      0,
      0,
      width,
      height
    )

    const imageData =
      ctx.getImageData(
        0,
        0,
        width,
        height
      )

    const pixels =
      imageData.data

    const points = []

    /*
     * Ignore the very outer edge of the photo. Pink/red pixels there
     * are more likely to be unrelated objects or UI artefacts.
     */
    const minX =
      Math.round(width * 0.08)
    const maxX =
      Math.round(width * 0.92)
    const minY =
      Math.round(height * 0.06)
    const maxY =
      Math.round(height * 0.94)

    for (
      let y = minY;
      y < maxY;
      y += 2
    ) {
      for (
        let x = minX;
        x < maxX;
        x += 2
      ) {
        const index =
          (y * width + x) * 4

        const r = pixels[index]
        const g = pixels[index + 1]
        const b = pixels[index + 2]

        const looksPinkOrRed =
          r >= 105 &&
          r >= g + 18 &&
          (
            r + b >= 220 ||
            r >= 155
          )

        if (looksPinkOrRed) {
          points.push({ x, y })
        }
      }
    }

    if (points.length < 3) {
      return null
    }

    /*
     * Use the median pink/red point instead of the extreme bounding
     * box. This is resistant to one stray red pixel elsewhere.
     */
    const xs =
      points
        .map(point => point.x)
        .sort((a, b) => a - b)

    const ys =
      points
        .map(point => point.y)
        .sort((a, b) => a - b)

    const median = values =>
      values[
        Math.floor(
          values.length / 2
        )
      ]

    const centerX =
      median(xs)
    const centerY =
      median(ys)

    /*
     * Estimate the spread of relevant red pixels around the median,
     * then expand substantially to include the whole watch display.
     */
    const nearby = points.filter(
      point =>
        Math.abs(
          point.x - centerX
        ) <= width * 0.22 &&
        Math.abs(
          point.y - centerY
        ) <= height * 0.28
    )

    const active =
      nearby.length >= 3
        ? nearby
        : points

    const activeXs =
      active.map(point => point.x)
    const activeYs =
      active.map(point => point.y)

    const left =
      Math.min(...activeXs)
    const right =
      Math.max(...activeXs)
    const top =
      Math.min(...activeYs)
    const bottom =
      Math.max(...activeYs)

    const pinkWidth =
      Math.max(
        8,
        right - left
      )
    const pinkHeight =
      Math.max(
        8,
        bottom - top
      )

    /*
     * The red graph/heart elements occupy only part of the display,
     * so expand generously around them.
     */
    let cropWidth =
      Math.max(
        pinkWidth * 2.7,
        width * 0.18
      )

    let cropHeight =
      Math.max(
        pinkHeight * 2.9,
        height * 0.24
      )

    /*
     * Smartwatch displays are usually taller than they are wide.
     */
    cropHeight =
      Math.max(
        cropHeight,
        cropWidth * 1.05
      )

    cropWidth =
      Math.min(
        cropWidth,
        width * 0.55
      )

    cropHeight =
      Math.min(
        cropHeight,
        height * 0.62
      )

    let cropX =
      centerX -
      cropWidth / 2

    let cropY =
      centerY -
      cropHeight / 2

    cropX =
      Math.max(
        0,
        Math.min(
          width - cropWidth,
          cropX
        )
      )

    cropY =
      Math.max(
        0,
        Math.min(
          height - cropHeight,
          cropY
        )
      )

    const bounds = {
      x: cropX / width,
      y: cropY / height,
      width:
        cropWidth / width,
      height:
        cropHeight / height,
    }

    console.log(
      'AUTO WATCH BOUNDS:',
      bounds
    )

    return bounds
  }

  const createRotatedCanvas = (
    sourceCanvas,
    degrees = 180
  ) => {
    const canvas =
      document.createElement('canvas')

    const normalized =
      ((degrees % 360) + 360) % 360

    if (
      normalized === 90 ||
      normalized === 270
    ) {
      canvas.width =
        sourceCanvas.height
      canvas.height =
        sourceCanvas.width
    } else {
      canvas.width =
        sourceCanvas.width
      canvas.height =
        sourceCanvas.height
    }

    const ctx =
      canvas.getContext('2d', {
        willReadFrequently: true,
      })

    ctx.translate(
      canvas.width / 2,
      canvas.height / 2
    )

    ctx.rotate(
      normalized *
        Math.PI /
        180
    )

    ctx.drawImage(
      sourceCanvas,
      -sourceCanvas.width / 2,
      -sourceCanvas.height / 2
    )

    return canvas
  }

  const scanAutoZoomedWatch = async (
    worker,
    bitmap,
    candidates
  ) => {
    const bounds =
      detectWatchScreenBounds(
        bitmap
      )

    if (!bounds) {
      return null
    }

    /*
     * Auto-zoom the detected watch area before OCR. This is the step
     * that replaces manual cropping by the user.
     */
    const baseNormal =
      createCrop(
        bitmap,
        {
          ...bounds,
          scale: 10,
          mode: 'normal',
        }
      )

    const baseGray =
      createCrop(
        bitmap,
        {
          ...bounds,
          scale: 10,
          mode: 'gray',
        }
      )

    const basePink =
      createCrop(
        bitmap,
        {
          ...bounds,
          scale: 10,
          mode: 'pinkMask',
        }
      )

    const versions = [
      {
        name: 'auto-normal',
        canvas: baseNormal,
      },
      {
        name: 'auto-gray',
        canvas: baseGray,
      },
      {
        name: 'auto-pink',
        canvas: basePink,
      },

      /*
       * People often photograph the watch upside down. Tesseract is
       * much more accurate if we explicitly try a 180° copy.
       */
      {
        name:
          'auto-normal-180',
        canvas:
          createRotatedCanvas(
            baseNormal,
            180
          ),
      },
      {
        name:
          'auto-gray-180',
        canvas:
          createRotatedCanvas(
            baseGray,
            180
          ),
      },
      {
        name:
          'auto-pink-180',
        canvas:
          createRotatedCanvas(
            basePink,
            180
          ),
      },
    ]

    const hits = new Map()

    for (const version of versions) {
      await worker.setParameters({
        tessedit_pageseg_mode:
          PSM.SPARSE_TEXT,
        tessedit_char_whitelist:
          '0123456789',
        user_defined_dpi:
          '300',
      })

      const result =
        await recognizeOcr(worker, 
          version.canvas
        )

      const found =
        extractDigitCandidates(
          result.data.text,
          version.name,
          result.data.confidence,
          1850
        )

      console.log(
        `AUTO ZOOM ${version.name}:`,
        result.data.text,
        result.data.confidence
      )

      for (const item of found) {
        candidates.push(item)

        const current =
          hits.get(item.value) || {
            value: item.value,
            hits: 0,
            bestConfidence: 0,
            sources: new Set(),
          }

        current.hits += 1
        current.bestConfidence =
          Math.max(
            current.bestConfidence,
            Number(
              result.data.confidence
            ) || 0
          )
        current.sources.add(
          version.name
        )

        hits.set(
          item.value,
          current
        )
      }
    }

    const ranked =
      [...hits.values()]
        .sort((a, b) => {
          if (
            b.hits !== a.hits
          ) {
            return (
              b.hits - a.hits
            )
          }

          return (
            b.bestConfidence -
            a.bestConfidence
          )
        })

    console.log(
      'AUTO ZOOM BPM RANKING:',
      ranked
    )

    /*
     * Require agreement across two processed versions before the
     * automatic crop is allowed to fill the form.
     */
    const agreed =
      ranked.find(
        item =>
          item.hits >= 2
      )

    if (agreed) {
      return agreed.value
    }

    const strongSingle =
      ranked.find(
        item =>
          item.hits === 1 &&
          item.bestConfidence >= 78
      )

    return (
      strongSingle?.value ||
      null
    )
  }

  const scanPrimaryTopBpm = async (
    worker,
    bitmap,
    candidates
  ) => {
    /*
     * The actual BPM on smartwatch screens is usually the large
     * number near the top of the display. Small numbers lower down
     * are often graph scale labels, min/max values or historical
     * readings. Scan narrow top-display bands first and give them
     * much higher authority.
     */
    const topRegions = [
      {
        name: 'top-bpm-a',
        x: 0.34,
        y: 0.18,
        width: 0.32,
        height: 0.16,
      },
      {
        name: 'top-bpm-b',
        x: 0.34,
        y: 0.22,
        width: 0.32,
        height: 0.16,
      },
      {
        name: 'top-bpm-c',
        x: 0.36,
        y: 0.26,
        width: 0.28,
        height: 0.15,
      },
      {
        name: 'top-bpm-tight-a',
        x: 0.40,
        y: 0.20,
        width: 0.20,
        height: 0.13,
      },
      {
        name: 'top-bpm-tight-b',
        x: 0.40,
        y: 0.24,
        width: 0.20,
        height: 0.13,
      },
      {
        name: 'top-bpm-tight-c',
        x: 0.40,
        y: 0.28,
        width: 0.20,
        height: 0.13,
      },
    ]

    const modes = [
      'pinkMask',
      'invertGray',
      'gray',
      'normal',
    ]

    const hits = new Map()

    for (const region of topRegions) {
      for (const mode of modes) {
        await worker.setParameters({
          tessedit_pageseg_mode:
            PSM.SINGLE_WORD,
          tessedit_char_whitelist:
            '0123456789',
          user_defined_dpi:
            '300',
        })

        const crop =
          createCrop(
            bitmap,
            {
              ...region,
              scale:
                region.name.includes('tight')
                  ? 28
                  : 22,
              mode,
            }
          )

        const result =
          await recognizeOcr(worker, crop)

        const found =
          extractDigitCandidates(
            result.data.text,
            `${region.name}-${mode}`,
            result.data.confidence,
            2400
          )

        console.log(
          `PRIMARY TOP BPM ${region.name} ${mode}:`,
          result.data.text,
          result.data.confidence
        )

        for (const item of found) {
          candidates.push({
            ...item,
            score: item.score + 300,
          })

          const current =
            hits.get(item.value) || {
              value: item.value,
              hits: 0,
              bestConfidence: 0,
              sources: new Set(),
            }

          current.hits += 1
          current.bestConfidence = Math.max(
            current.bestConfidence,
            Number(result.data.confidence) || 0
          )
          current.sources.add(
            `${region.name}-${mode}`
          )

          hits.set(item.value, current)
        }
      }
    }

    const ranked =
      [...hits.values()]
        .sort((a, b) => {
          if (b.hits !== a.hits) {
            return b.hits - a.hits
          }

          return (
            b.bestConfidence -
            a.bestConfidence
          )
        })

    console.log(
      'PRIMARY TOP BPM RANKING:',
      ranked
    )

    /*
     * If the same top-display value appears at least twice, trust it
     * immediately. This stops graph tick values such as 100/150/200
     * from winning simply because they appear multiple times lower
     * on the screen.
     */
    const repeatedTop =
      ranked.find(
        item => item.hits >= 2
      )

    if (repeatedTop) {
      return repeatedTop.value
    }

    /*
     * A single very confident read from a tight top crop is also
     * acceptable.
     */
    const strongTop =
      ranked.find(
        item =>
          item.hits === 1 &&
          item.bestConfidence >= 72
      )

    return strongTop?.value || null
  }

  const scanFocusedWatchBpm = async (
    worker,
    bitmap,
    candidates
  ) => {
    /*
     * Do not rely on one fixed crop. Phone photos vary in framing,
     * tilt and distance, so scan several overlapping areas around
     * the central watch display.
     */
    const regions = [
      {
        name: 'watch-upper',
        x: 0.32,
        y: 0.22,
        width: 0.36,
        height: 0.24,
      },
      {
        name: 'watch-upper-mid',
        x: 0.32,
        y: 0.29,
        width: 0.36,
        height: 0.24,
      },
      {
        name: 'watch-center',
        x: 0.32,
        y: 0.36,
        width: 0.36,
        height: 0.24,
      },
      {
        name: 'watch-center-low',
        x: 0.32,
        y: 0.43,
        width: 0.36,
        height: 0.23,
      },
      {
        name: 'watch-tight-upper',
        x: 0.39,
        y: 0.27,
        width: 0.22,
        height: 0.18,
      },
      {
        name: 'watch-tight-mid',
        x: 0.39,
        y: 0.34,
        width: 0.22,
        height: 0.18,
      },
      {
        name: 'watch-tight-low',
        x: 0.39,
        y: 0.41,
        width: 0.22,
        height: 0.18,
      },
    ]

    const modes = [
      'pinkMask',
      'invertGray',
      'gray',
      'normal',
    ]

    await worker.setParameters({
      tessedit_pageseg_mode:
        PSM.SINGLE_WORD,
      tessedit_char_whitelist:
        '0123456789',
      user_defined_dpi:
        '300',
    })

    const focusedHits = new Map()

    for (const region of regions) {
      for (const mode of modes) {
        await worker.setParameters({
          tessedit_pageseg_mode:
            region.name.includes('tight')
              ? PSM.SINGLE_WORD
              : PSM.SINGLE_LINE,
          tessedit_char_whitelist:
            '0123456789',
          user_defined_dpi:
            '300',
        })

        const crop =
          createCrop(
            bitmap,
            {
              ...region,
              scale:
                region.name.includes('tight')
                  ? 24
                  : 18,
              mode,
            }
          )

        const result =
          await recognizeOcr(worker, crop)

        const extracted =
          extractDigitCandidates(
            result.data.text,
            `${region.name}-${mode}`,
            result.data.confidence,
            1050
          )

        console.log(
          `BPM ${region.name} ${mode}:`,
          result.data.text,
          result.data.confidence
        )

        for (const item of extracted) {
          /*
           * Prefer likely resting-heart-rate values, but still allow
           * higher values because the upload may be from a general
           * heart-rate screen rather than a true resting measurement.
           */
          let bonus = 0

          if (item.value >= 45 && item.value <= 120) {
            bonus += 120
          }

          candidates.push({
            ...item,
            score: item.score + bonus,
          })

          const current =
            focusedHits.get(item.value) || {
              value: item.value,
              hits: 0,
              sources: new Set(),
              bestConfidence: 0,
            }

          current.hits += 1
          current.sources.add(
            `${region.name}-${mode}`
          )
          current.bestConfidence =
            Math.max(
              current.bestConfidence,
              Number(result.data.confidence) || 0
            )

          focusedHits.set(
            item.value,
            current
          )
        }
      }
    }

    const rankedFocused =
      [...focusedHits.values()]
        .sort((a, b) => {
          if (b.hits !== a.hits) {
            return b.hits - a.hits
          }

          return (
            b.bestConfidence -
            a.bestConfidence
          )
        })

    console.log(
      'FOCUSED BPM HITS:',
      rankedFocused
    )

    /*
     * Two independent focused reads of the same value are enough.
     * This is much safer than accepting a single broad OCR number.
     */
    const agreed =
      rankedFocused.find(
        item => item.hits >= 2
      )

    if (agreed) {
      return agreed.value
    }

    /*
     * If only one focused crop reads a value, only trust it when
     * Tesseract confidence is reasonably strong.
     */
    const strongSingle =
      rankedFocused.find(
        item =>
          item.hits === 1 &&
          item.bestConfidence >= 62
      )

    return strongSingle?.value || null
  }

  const chooseBestBpm = candidates => {
    if (!candidates.length) {
      return null
    }

    const grouped = new Map()

    candidates.forEach(candidate => {
      const current =
        grouped.get(candidate.value) || {
          value: candidate.value,
          bestScore: -Infinity,
          hits: 0,
          sources: new Set(),
          labelledHits: 0,
          reasons: [],
        }

      current.bestScore =
        Math.max(
          current.bestScore,
          candidate.score
        )
      current.hits += 1
      current.sources.add(
        candidate.source
      )

      if (candidate.labelled) {
        current.labelledHits += 1
      }

      current.reasons.push(
        `${candidate.source}: ${candidate.reason}`
      )

      grouped.set(
        candidate.value,
        current
      )
    })

    const ranked = [
      ...grouped.values(),
    ]
      .map(item => ({
        ...item,
        finalScore:
          item.bestScore +
          Math.min(
            450,
            (item.sources.size - 1) *
              150
          ) +
          Math.min(
            300,
            item.labelledHits * 150
          ) +
          Math.min(
            120,
            (item.hits - 1) * 35
          ),
      }))
      .sort(
        (a, b) =>
          b.finalScore -
          a.finalScore
      )

    console.log(
      'BPM FINAL RANKING:',
      ranked
    )

    const labelledWinner =
      ranked.find(
        item =>
          item.labelledHits > 0 &&
          item.bestScore >= 1400
      )

    if (labelledWinner) {
      return labelledWinner.value
    }

    const best = ranked[0]
    const second = ranked[1]

    if (!best) return null

    if (
      best.sources.size >= 2 &&
      (
        !second ||
        best.finalScore -
          second.finalScore >=
          80
      )
    ) {
      return best.value
    }

    /*
     * A tightly focused BPM crop is intentionally given a score
     * above 1400. If one of those focused scans finds a clear
     * 2-3 digit number, allow it to win even when another image
     * preprocessing pass did not recognise the same digits.
     *
     * This prevents a clear large BPM such as 88, 120 or 198 from
     * being rejected simply because only one focused OCR pass read it.
     */
    if (
      best.bestScore >= 1400 &&
      (
        !second ||
        best.finalScore -
          second.finalScore >=
          120
      )
    ) {
      return best.value
    }

    return null
  }

  const clamp01 = value =>
    Math.max(
      0,
      Math.min(
        1,
        Number(value) || 0
      )
    )

  const getCropPointer = event => {
    const image =
      cropImageRef.current

    if (!image) return null

    const rect =
      image.getBoundingClientRect()

    if (
      !rect.width ||
      !rect.height
    ) {
      return null
    }

    return {
      x: clamp01(
        (event.clientX - rect.left) /
          rect.width
      ),
      y: clamp01(
        (event.clientY - rect.top) /
          rect.height
      ),
    }
  }

  const handleCropPointerDown = event => {
    const point =
      getCropPointer(event)

    if (!point) return

    event.preventDefault()

    cropDragStartRef.current =
      point

    setCropRect({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0,
    })

    try {
      event.currentTarget
        .setPointerCapture(
          event.pointerId
        )
    } catch {
      // Pointer capture is optional.
    }
  }

  const handleCropPointerMove = event => {
    const start =
      cropDragStartRef.current

    if (!start) return

    const point =
      getCropPointer(event)

    if (!point) return

    const x =
      Math.min(
        start.x,
        point.x
      )
    const y =
      Math.min(
        start.y,
        point.y
      )

    const width =
      Math.abs(
        point.x - start.x
      )
    const height =
      Math.abs(
        point.y - start.y
      )

    setCropRect({
      x,
      y,
      width,
      height,
    })
  }

  const handleCropPointerUp = event => {
    cropDragStartRef.current =
      null

    try {
      event.currentTarget
        .releasePointerCapture(
          event.pointerId
        )
    } catch {
      // Pointer capture is optional.
    }
  }

  const scanManualCrop = async () => {
    if (
      !uploadedBpmFile ||
      !cropRect
    ) {
      setOcrMessage(
        'Drag a box around the watch screen first.'
      )
      return
    }

    if (
      cropRect.width < 0.025 ||
      cropRect.height < 0.025
    ) {
      setOcrMessage(
        'The crop area is too small. Drag a box around the watch screen.'
      )
      return
    }

    ocrCancelledRef.current = false

    setOcrLoading(true)
    setDetectedBpm(null)
    setOcrMessage(
      'Scanning the selected watch area...'
    )

    let worker = null
    let bitmap = null

    try {
      bitmap =
        await createImageBitmap(
          uploadedBpmFile
        )

      worker =
        await createWorker('eng')

      /*
       * Convert a region expressed relative to the selected crop
       * into coordinates relative to the original uploaded image.
       *
       * This means the user can crop around the WHOLE watch screen.
       * We then automatically inspect smaller zones inside that crop.
       */
      const subCrop = ({
        x,
        y,
        width,
        height,
      }) => ({
        x:
          cropRect.x +
          cropRect.width * x,
        y:
          cropRect.y +
          cropRect.height * y,
        width:
          cropRect.width *
          width,
        height:
          cropRect.height *
          height,
      })

      /*
       * Search several overlapping zones inside the user's crop.
       *
       * The main BPM number on smartwatch displays is usually near
       * one end of the screen. Because the watch may be upside down,
       * we scan both the upper and lower portions.
       */
      const regions = [
        {
          name: 'whole',
          ...subCrop({
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          }),
          priority: 250,
        },
        {
          name: 'upper-half',
          ...subCrop({
            x: 0.08,
            y: 0.02,
            width: 0.84,
            height: 0.48,
          }),
          priority: 550,
        },
        {
          name: 'lower-half',
          ...subCrop({
            x: 0.08,
            y: 0.50,
            width: 0.84,
            height: 0.48,
          }),
          priority: 550,
        },
        {
          name: 'upper-number',
          ...subCrop({
            x: 0.18,
            y: 0.02,
            width: 0.64,
            height: 0.30,
          }),
          priority: 900,
        },
        {
          name: 'lower-number',
          ...subCrop({
            x: 0.18,
            y: 0.68,
            width: 0.64,
            height: 0.30,
          }),
          priority: 900,
        },
        {
          name: 'center-upper',
          ...subCrop({
            x: 0.16,
            y: 0.18,
            width: 0.68,
            height: 0.30,
          }),
          priority: 650,
        },
        {
          name: 'center-lower',
          ...subCrop({
            x: 0.16,
            y: 0.52,
            width: 0.68,
            height: 0.30,
          }),
          priority: 650,
        },
      ]

      const modes = [
        'pinkMask',
        'gray',
        'normal',
      ]

      const manualCandidates = []

      for (const region of regions) {
        for (const mode of modes) {
          const crop =
            createCrop(
              bitmap,
              {
                x: region.x,
                y: region.y,
                width:
                  region.width,
                height:
                  region.height,
                scale:
                  region.name ===
                    'whole'
                    ? 10
                    : 18,
                mode,
              }
            )

          const versions = [
            {
              name:
                `${region.name}-${mode}`,
              canvas: crop,
            },
            {
              name:
                `${region.name}-${mode}-180`,
              canvas:
                createRotatedCanvas(
                  crop,
                  180
                ),
            },
          ]

          for (
            const version of versions
          ) {
            await worker.setParameters({
              tessedit_pageseg_mode:
                region.name ===
                  'whole'
                  ? PSM.SPARSE_TEXT
                  : PSM.SINGLE_LINE,
              tessedit_char_whitelist:
                '0123456789',
              user_defined_dpi:
                '300',
            })

            const result =
              await recognizeOcr(
                worker,
                version.canvas
              )

            console.log(
              `MANUAL SMART CROP ${version.name}:`,
              result.data.text,
              result.data.confidence
            )

            const found =
              extractDigitCandidates(
                result.data.text,
                version.name,
                result.data.confidence,
                2200 +
                  region.priority
              )

            /*
             * Prefer realistic resting BPM values slightly, but do
             * not exclude higher readings because users may upload
             * a general heart-rate screen.
             */
            manualCandidates.push(
              ...found.map(item => ({
                ...item,
                score:
                  item.score +
                  (
                    item.value >= 45 &&
                    item.value <= 120
                      ? 180
                      : 0
                  ),
              }))
            )
          }
        }
      }

      const grouped =
        new Map()

      manualCandidates.forEach(
        candidate => {
          const current =
            grouped.get(
              candidate.value
            ) || {
              value:
                candidate.value,
              hits: 0,
              bestScore:
                -Infinity,
              sources:
                new Set(),
            }

          current.hits += 1

          current.bestScore =
            Math.max(
              current.bestScore,
              candidate.score
            )

          current.sources.add(
            candidate.source
          )

          grouped.set(
            candidate.value,
            current
          )
        }
      )

      const ranked =
        [...grouped.values()]
          .map(item => ({
            ...item,
            finalScore:
              item.bestScore +
              Math.min(
                900,
                (item.sources.size -
                  1) *
                  180
              ) +
              Math.min(
                500,
                (item.hits - 1) *
                  90
              ),
          }))
          .sort(
            (a, b) =>
              b.finalScore -
              a.finalScore
          )

      console.log(
        'MANUAL SMART CROP BPM RANKING:',
        ranked
      )

      const best =
        ranked[0]

      const second =
        ranked[1]

      let bpm = null

      /*
       * Tight upper/lower BPM zones receive a much larger base score,
       * so the main large number should outrank graph labels and
       * secondary values even when the user selected the whole watch.
       */
      if (
        best &&
        (
          best.hits >= 2 ||
          !second ||
          best.finalScore -
            second.finalScore >=
            140
        )
      ) {
        bpm =
          best.value
      }

      if (
        !bpm ||
        !isValidBpm(bpm)
      ) {
        setOcrMessage(
          'Could not identify the main BPM number. Try selecting the watch screen more closely, but you do not need to crop only the digits.'
        )
        return
      }

      if (
        ocrCancelledRef.current
      ) {
        return
      }

      setDetectedBpm(bpm)
      onChange('hr', bpm)

      setOcrMessage(
        `BPM detected from crop: ${bpm} BPM. Please verify the value before saving.`
      )

      setCropMode(false)
    } catch (error) {
      if (
        !ocrCancelledRef.current
      ) {
        console.error(
          'Manual BPM crop OCR error:',
          error
        )

        setOcrMessage(
          'Unable to scan the cropped watch area. Please try again or enter the BPM manually.'
        )
      }
    } finally {
      if (bitmap) {
        bitmap.close()
      }

      if (worker) {
        try {
          await worker.terminate()
        } catch (error) {
          console.error(
            'Failed to terminate crop OCR worker:',
            error
          )
        }
      }

      setOcrLoading(false)
    }
  }

  const handleBpmImage = async event => {
    const file =
      event.target.files?.[0]

    if (!file) return

    if (
      !file.type.startsWith(
        'image/'
      )
    ) {
      setOcrMessage(
        'Please upload an image file.'
      )
      return
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setOcrMessage(
        'Please choose an image smaller than 10 MB.'
      )
      return
    }

    if (imagePreview) {
      URL.revokeObjectURL(
        imagePreview
      )
    }

    ocrCancelledRef.current = false

    setImagePreview(
      URL.createObjectURL(file)
    )
    setUploadedBpmFile(file)
    setCropMode(false)
    setCropRect(null)
    setDetectedBpm(null)
    setOcrMessage(
      'Scanning image for heart rate...'
    )
    setOcrLoading(true)

    let worker = null
    let bitmap = null

    try {
      bitmap =
        await createImageBitmap(file)

      worker =
        await createWorker('eng')

      const candidates = []

      await worker.setParameters({
        tessedit_pageseg_mode:
          PSM.SPARSE_TEXT,
        preserve_interword_spaces:
          '1',
        user_defined_dpi:
          '300',
      })

      const fullResult =
        await recognizeOcr(worker, file)

      console.log(
        'BPM FULL:',
        fullResult.data.text
      )

      candidates.push(
        ...extractContextCandidates(
          fullResult.data.text,
          'full'
        )
      )

      let bpm =
        chooseBestBpm(candidates)

      if (!bpm) {
        const summaryCrop =
          createCrop(
            bitmap,
            {
              x: 0.03,
              y: 0.72,
              width: 0.94,
              height: 0.20,
              scale: 4,
            }
          )

        const summaryResult =
          await recognizeOcr(worker, 
            summaryCrop
          )

        console.log(
          'BPM SUMMARY:',
          summaryResult.data.text
        )

        candidates.push(
          ...extractContextCandidates(
            summaryResult.data.text,
            'summary'
          )
        )

        bpm =
          chooseBestBpm(candidates)
      }

      await worker.setParameters({
        tessedit_pageseg_mode:
          PSM.SPARSE_TEXT,
        tessedit_char_whitelist:
          '0123456789',
        user_defined_dpi:
          '300',
      })

      /*
       * AUTO CROP / AUTO ZOOM
       *
       * Find the watch display from its pink/red UI pixels, enlarge it
       * automatically and also test a 180-degree copy. The user no
       * longer needs to crop the source image manually.
       */
      if (!bpm) {
        bpm =
          await scanAutoZoomedWatch(
            worker,
            bitmap,
            candidates
          )
      }

      /*
       * If automatic localisation did not produce a reliable value,
       * use the older fixed-position top BPM scan as a fallback.
       */
      if (!bpm) {
        bpm =
          await scanPrimaryTopBpm(
            worker,
            bitmap,
            candidates
          )
      }

      /*
       * If the main number was not readable, fall back to broader
       * overlapping watch-screen scans.
       */
      if (!bpm) {
        bpm =
          await scanFocusedWatchBpm(
            worker,
            bitmap,
            candidates
          )
      }

      /*
       * Return to sparse digit mode for the broader fallback crops.
       */
      await worker.setParameters({
        tessedit_pageseg_mode:
          PSM.SPARSE_TEXT,
        tessedit_char_whitelist:
          '0123456789',
        user_defined_dpi:
          '300',
      })

      if (!bpm) {
        const watchCrop =
          createCrop(
            bitmap,
            {
              x: 0.32,
              y: 0.25,
              width: 0.36,
              height: 0.50,
              scale: 8,
              mode: 'normal',
            }
          )

        const watchResult =
          await recognizeOcr(worker, 
            watchCrop
          )

        candidates.push(
          ...extractDigitCandidates(
            watchResult.data.text,
            'watch-normal',
            watchResult.data.confidence,
            650
          )
        )
      }

      if (!bpm) {
        const watchGrayCrop =
          createCrop(
            bitmap,
            {
              x: 0.32,
              y: 0.25,
              width: 0.36,
              height: 0.50,
              scale: 8,
              mode: 'gray',
            }
          )

        const watchGrayResult =
          await recognizeOcr(worker, 
            watchGrayCrop
          )

        candidates.push(
          ...extractDigitCandidates(
            watchGrayResult.data.text,
            'watch-gray',
            watchGrayResult.data.confidence,
            650
          )
        )

        bpm =
          chooseBestBpm(candidates)
      }

      if (!bpm) {
        const centerCrop =
          createCrop(
            bitmap,
            {
              x: 0.23,
              y: 0.23,
              width: 0.54,
              height: 0.35,
              scale: 6,
              mode: 'normal',
            }
          )

        const centerResult =
          await recognizeOcr(worker, 
            centerCrop
          )

        candidates.push(
          ...extractDigitCandidates(
            centerResult.data.text,
            'center-normal',
            centerResult.data.confidence,
            620
          )
        )
      }

      if (!bpm) {
        const redCrop =
          createCrop(
            bitmap,
            {
              x: 0.23,
              y: 0.23,
              width: 0.54,
              height: 0.35,
              scale: 6,
              mode: 'red',
            }
          )

        const redResult =
          await recognizeOcr(worker, 
            redCrop
          )

        candidates.push(
          ...extractDigitCandidates(
            redResult.data.text,
            'center-red',
            redResult.data.confidence,
            700
          )
        )

        bpm =
          chooseBestBpm(candidates)
      }

      if (!bpm) {
        const lowerCrop =
          createCrop(
            bitmap,
            {
              x: 0.28,
              y: 0.44,
              width: 0.44,
              height: 0.29,
              scale: 7,
              mode: 'normal',
            }
          )

        const lowerResult =
          await recognizeOcr(worker, 
            lowerCrop
          )

        candidates.push(
          ...extractDigitCandidates(
            lowerResult.data.text,
            'lower-normal',
            lowerResult.data.confidence,
            700
          )
        )
      }

      if (!bpm) {
        const lowerBrightCrop =
          createCrop(
            bitmap,
            {
              x: 0.28,
              y: 0.44,
              width: 0.44,
              height: 0.29,
              scale: 7,
              mode: 'bright',
            }
          )

        const lowerBrightResult =
          await recognizeOcr(worker, 
            lowerBrightCrop
          )

        candidates.push(
          ...extractDigitCandidates(
            lowerBrightResult.data.text,
            'lower-bright',
            lowerBrightResult.data.confidence,
            700
          )
        )

        bpm =
          chooseBestBpm(candidates)
      }

      {
        const microWatchNormal =
          createCrop(
            bitmap,
            {
              x: 0.405,
              y: 0.335,
              width: 0.19,
              height: 0.13,
              scale: 18,
              mode: 'normal',
            }
          )

        await worker.setParameters({
          tessedit_pageseg_mode:
            PSM.SINGLE_WORD,
          tessedit_char_whitelist:
            '0123456789',
          user_defined_dpi:
            '300',
        })

        const microWatchNormalResult =
          await recognizeOcr(worker, 
            microWatchNormal
          )

        const microWatchGray =
          createCrop(
            bitmap,
            {
              x: 0.405,
              y: 0.335,
              width: 0.19,
              height: 0.13,
              scale: 18,
              mode: 'gray',
            }
          )

        const microWatchGrayResult =
          await recognizeOcr(worker, 
            microWatchGray
          )

        const normalValues =
          extractDigitCandidates(
            microWatchNormalResult.data.text,
            'micro-watch-normal',
            microWatchNormalResult.data.confidence,
            900
          )

        const grayValues =
          extractDigitCandidates(
            microWatchGrayResult.data.text,
            'micro-watch-gray',
            microWatchGrayResult.data.confidence,
            900
          )

        candidates.push(
          ...normalValues,
          ...grayValues
        )

        console.log(
          'MICRO WATCH NORMAL:',
          microWatchNormalResult.data.text,
          microWatchNormalResult.data.confidence
        )

        console.log(
          'MICRO WATCH GRAY:',
          microWatchGrayResult.data.text,
          microWatchGrayResult.data.confidence
        )

        const normalBpms =
          normalValues.map(
            item => item.value
          )

        const grayBpms =
          grayValues.map(
            item => item.value
          )

        const microAgreement =
          normalBpms.find(value =>
            grayBpms.includes(value)
          )

        if (microAgreement) {
          bpm = microAgreement
        }
      }

      if (!bpm) {
        const heartDigitsNormal =
          createCrop(
            bitmap,
            {
              x: 0.365,
              y: 0.61,
              width: 0.27,
              height: 0.105,
              scale: 12,
              mode: 'normal',
            }
          )

        await worker.setParameters({
          tessedit_pageseg_mode:
            PSM.SINGLE_WORD,
          tessedit_char_whitelist:
            '0123456789',
          user_defined_dpi:
            '300',
        })

        const heartDigitsNormalResult =
          await recognizeOcr(worker, 
            heartDigitsNormal
          )

        candidates.push(
          ...extractDigitCandidates(
            heartDigitsNormalResult.data.text,
            'heart-digits-normal',
            heartDigitsNormalResult.data.confidence,
            980
          )
        )

        const heartDigitsGray =
          createCrop(
            bitmap,
            {
              x: 0.365,
              y: 0.61,
              width: 0.27,
              height: 0.105,
              scale: 12,
              mode: 'gray',
            }
          )

        const heartDigitsGrayResult =
          await recognizeOcr(worker, 
            heartDigitsGray
          )

        candidates.push(
          ...extractDigitCandidates(
            heartDigitsGrayResult.data.text,
            'heart-digits-gray',
            heartDigitsGrayResult.data.confidence,
            980
          )
        )

        const heartNormalValues =
          extractDigitCandidates(
            heartDigitsNormalResult.data.text,
            'heart-normal-check',
            heartDigitsNormalResult.data.confidence,
            0
          ).map(item => item.value)

        const heartGrayValues =
          extractDigitCandidates(
            heartDigitsGrayResult.data.text,
            'heart-gray-check',
            heartDigitsGrayResult.data.confidence,
            0
          ).map(item => item.value)

        const heartAgreement =
          heartNormalValues.find(value =>
            heartGrayValues.includes(value)
          )

        if (heartAgreement) {
          bpm = heartAgreement
        }
      }

      if (!bpm) {
        bpm =
          chooseBestBpm(candidates)
      }

      console.log(
        'ALL BPM CANDIDATES:',
        candidates
      )

      console.log(
        'FINAL BPM:',
        bpm
      )

      if (!bpm) {
        setOcrMessage(
          'Could not detect a reliable BPM value. Please try another screenshot or enter it manually.'
        )
        return
      }

      if (ocrCancelledRef.current) {
        return
      }

      setDetectedBpm(bpm)
      onChange('hr', bpm)

      setOcrMessage(
        `BPM detected successfully: ${bpm} BPM. Please verify the value before saving.`
      )
    } catch (error) {
      if (!ocrCancelledRef.current) {
        console.error(
          'BPM OCR error:',
          error
        )

        setOcrMessage(
          'Unable to scan this image. Please try another image or enter the BPM manually.'
        )
      }
    } finally {
      if (bitmap) {
        bitmap.close()
      }

      if (worker) {
        try {
          await worker.terminate()
        } catch (error) {
          console.error(
            'Failed to terminate OCR worker:',
            error
          )
        }
      }

      setOcrLoading(false)

      if (event.target) {
        event.target.value = ''
      }
    }
  }

  const clearBpmImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }

    setImagePreview('')
    setUploadedBpmFile(null)
    setCropMode(false)
    setCropRect(null)
    cropDragStartRef.current = null
    setDetectedBpm(null)
    setOcrMessage('')
  }

  const handleClose = () => {
    ocrCancelledRef.current = true
    onClose()
  }

  const hrValue = form.hr === null || form.hr === undefined
    ? ''
    : form.hr

  return (
    <ModalShell title={title} onClose={handleClose}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}
      >
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Date</label>
          <input
            className={styles.formInput}
            type="date"
            value={form.date}
            onChange={e => onChange('date', e.target.value)}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>
            Resting heart rate
          </label>

          <div style={{ position: 'relative' }}>
            <input
              className={styles.formInput}
              type="number"
              min="30"
              max="220"
              inputMode="numeric"
              placeholder="e.g. 62"
              value={hrValue}
              onChange={e => {
                setDetectedBpm(null)
                onChange('hr', e.target.value)
              }}
              style={{ paddingRight: 58 }}
            />

            <span
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 11,
                fontWeight: 700,
                color: '#8892A4',
                pointerEvents: 'none',
              }}
            >
              BPM
            </span>
          </div>
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          Or upload BPM image
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleBpmImage}
          style={{ display: 'none' }}
        />

        <button
          type="button"
          className={styles.btnOutline}
          onClick={() => fileInputRef.current?.click()}
          disabled={ocrLoading || saving}
          style={{
            width: '100%',
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            borderStyle: 'dashed',
          }}
        >
          {ocrLoading
            ? 'Reading BPM from image...'
            : '📷 Upload BPM Image'}
        </button>

        <div
          style={{
            marginTop: 5,
            fontSize: 10,
            color: '#8892A4',
            lineHeight: 1.45,
          }}
        >
          Upload a screenshot or photo showing the heart-rate reading.
          The system will try automatic detection first. If needed, use
          Crop & Rescan BPM to select the main number manually.
        </div>

        {imagePreview && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 12,
              border: '1px solid #E8EEF8',
              background: '#F7F9FF',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#0D1B3E',
                }}
              >
                Uploaded image
              </span>

              <button
                type="button"
                onClick={clearBpmImage}
                disabled={ocrLoading}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#EF4444',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>

            <img
              src={imagePreview}
              alt="Uploaded BPM reading"
              style={{
                display: 'block',
                width: '100%',
                maxHeight: 180,
                objectFit: 'contain',
                borderRadius: 8,
                background: '#FFFFFF',
              }}
            />
          </div>
        )}

        {imagePreview && (
          <div
            style={{
              marginTop: 8,
            }}
          >
            <button
              type="button"
              className={styles.btnOutline}
              disabled={
                ocrLoading ||
                saving
              }
              onClick={() => {
                setCropMode(
                  current =>
                    !current
                )

                setCropRect(null)
              }}
              style={{
                width: '100%',
                minHeight: 38,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {cropMode
                ? 'Cancel Crop'
                : 'Crop & Rescan BPM'}
            </button>
          </div>
        )}

        {imagePreview &&
          cropMode && (
            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                border:
                  '1px solid #DCE5F5',
                background:
                  '#F7F9FF',
              }}
            >
              <div
                style={{
                  marginBottom: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color:
                    '#0D1B3E',
                }}
              >
                Drag a box around the watch screen
              </div>

              <div
                style={{
                  marginBottom: 10,
                  fontSize: 10,
                  lineHeight: 1.45,
                  color:
                    '#64748B',
                }}
              >
                Select the watch display area. You do not need to crop tightly
                around only the BPM digits; the scanner will search inside
                your selected area automatically.
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'center',
                  overflow: 'hidden',
                  borderRadius: 10,
                  background:
                    '#FFFFFF',
                  border:
                    '1px solid #E8EEF8',
                  padding: 8,
                }}
              >
                <div
                  onPointerDown={
                    handleCropPointerDown
                  }
                  onPointerMove={
                    handleCropPointerMove
                  }
                  onPointerUp={
                    handleCropPointerUp
                  }
                  onPointerCancel={
                    handleCropPointerUp
                  }
                  style={{
                    position:
                      'relative',
                    display:
                      'inline-block',
                    maxWidth:
                      '100%',
                    touchAction:
                      'none',
                    cursor:
                      'crosshair',
                    userSelect:
                      'none',
                  }}
                >
                  <img
                    ref={
                      cropImageRef
                    }
                    src={
                      imagePreview
                    }
                    alt="Select BPM crop area"
                    draggable="false"
                    style={{
                      display:
                        'block',
                      maxWidth:
                        '100%',
                      maxHeight:
                        330,
                      width:
                        'auto',
                      height:
                        'auto',
                      pointerEvents:
                        'none',
                      userSelect:
                        'none',
                    }}
                  />

                  {cropRect &&
                    cropRect.width >
                      0 &&
                    cropRect.height >
                      0 && (
                      <div
                        style={{
                          position:
                            'absolute',
                          left:
                            `${cropRect.x * 100}%`,
                          top:
                            `${cropRect.y * 100}%`,
                          width:
                            `${cropRect.width * 100}%`,
                          height:
                            `${cropRect.height * 100}%`,
                          border:
                            '2px solid #1A5FFF',
                          background:
                            'rgba(26,95,255,0.12)',
                          boxShadow:
                            '0 0 0 9999px rgba(15,23,42,0.35)',
                          boxSizing:
                            'border-box',
                          pointerEvents:
                            'none',
                        }}
                      />
                    )}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent:
                    'space-between',
                  alignItems:
                    'center',
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <button
                  type="button"
                  className={
                    styles.btnOutline
                  }
                  disabled={
                    ocrLoading
                  }
                  onClick={() =>
                    setCropRect(
                      null
                    )
                  }
                  style={{
                    fontSize: 11,
                  }}
                >
                  Reset Crop
                </button>

                <button
                  type="button"
                  className={
                    styles.btnPrimary
                  }
                  disabled={
                    ocrLoading ||
                    !cropRect ||
                    cropRect.width <
                      0.025 ||
                    cropRect.height <
                      0.025
                  }
                  onClick={
                    scanManualCrop
                  }
                  style={{
                    fontSize: 11,
                  }}
                >
                  {ocrLoading
                    ? 'Scanning...'
                    : 'Scan Crop'}
                </button>
              </div>
            </div>
          )}

        {ocrMessage && (
          <div
            style={{
              marginTop: 8,
              padding: '9px 11px',
              borderRadius: 9,
              background: detectedBpm
                ? '#ECFDF5'
                : '#F7F9FF',
              border: detectedBpm
                ? '1px solid #A7F3D0'
                : '1px solid #E8EEF8',
              color: detectedBpm
                ? '#047857'
                : '#64748B',
              fontSize: 11,
              lineHeight: 1.45,
              fontWeight: 700,
            }}
          >
            {ocrMessage}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 14,
        }}
      >
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Sleep hours</label>
          <input
            className={styles.formInput}
            type="number"
            min="0"
            max="24"
            value={form.sleep}
            onChange={e => onChange('sleep', e.target.value)}
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Tiredness /10</label>
          <input
            className={styles.formInput}
            type="number"
            min="1"
            max="10"
            value={form.tiredness}
            onChange={e => onChange('tiredness', e.target.value)}
          />
          <div
            style={{
              fontSize: 10,
              color: '#8892A4',
              marginTop: 4,
            }}
          >
            1 = not tired, 10 = very tired
          </div>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Muscle ache /10</label>
          <input
            className={styles.formInput}
            type="number"
            min="1"
            max="10"
            value={form.muscleAche}
            onChange={e => onChange('muscleAche', e.target.value)}
          />
          <div
            style={{
              fontSize: 10,
              color: '#8892A4',
              marginTop: 4,
            }}
          >
            1 = no ache, 10 = very painful
          </div>
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Notes</label>
        <textarea
          className={styles.formTextarea}
          placeholder="e.g. Slept only 6 hours, felt tired after training."
          value={form.notes}
          onChange={e => onChange('notes', e.target.value)}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        {onDelete ? (
          <button
            onClick={onDelete}
            disabled={saving}
            style={{
              padding: '9px 16px',
              borderRadius: 10,
              border: '1.5px solid #FCA5A5',
              background: '#FEF2F2',
              color: '#EF4444',
              fontWeight: 700,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        ) : (
          <div />
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
          }}
        >
          <button
            className={styles.btnOutline}
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            className={styles.btnPrimary}
            onClick={onSave}
            disabled={saving || ocrLoading}
          >
            {saving
              ? 'Saving...'
              : ocrLoading
                ? 'Scanning...'
                : 'Save'}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function getBodyPointFromName(name = '') {
  const lower = String(name || '')
    .toLowerCase()
    .trim()

  if (!lower) return null

  const isLeft = /\bleft\b/.test(lower)
  const isRight = /\bright\b/.test(lower)

  const sideX = isLeft ? 50 : isRight ? 70 : 60
  const sideLabel = isLeft
    ? 'Left'
    : isRight
      ? 'Right'
      : ''

  if (
    lower.includes('head') ||
    lower.includes('forehead')
  ) {
    return {
      x: 60,
      y: 16,
      label: 'Head',
    }
  }

  if (lower.includes('neck')) {
    return {
      x: sideX,
      y: 31,
      label: sideLabel
        ? `${sideLabel} neck`
        : 'Neck',
    }
  }

  if (lower.includes('shoulder')) {
    return {
      x: isLeft ? 42 : isRight ? 78 : 60,
      y: 43,
      label: sideLabel
        ? `${sideLabel} shoulder`
        : 'Shoulder',
    }
  }

  if (
    lower.includes('upper chest') ||
    lower.includes('chest') ||
    lower.includes('pectoral')
  ) {
    return {
      x: isLeft ? 52 : isRight ? 68 : 60,
      y: 50,
      label: sideLabel
        ? `${sideLabel} upper chest`
        : 'Upper chest',
    }
  }

  if (
    lower.includes('upper arm') ||
    lower.includes('bicep') ||
    lower.includes('tricep') ||
    (
      lower.includes('arm') &&
      !lower.includes('forearm')
    )
  ) {
    return {
      x: isLeft ? 37 : isRight ? 83 : 60,
      y: 63,
      label: sideLabel
        ? `${sideLabel} upper arm`
        : 'Upper arm',
    }
  }

  if (
    lower.includes('elbow')
  ) {
    return {
      x: isLeft ? 31 : isRight ? 89 : 60,
      y: 78,
      label: sideLabel
        ? `${sideLabel} elbow`
        : 'Elbow',
    }
  }

  if (
    lower.includes('forearm')
  ) {
    return {
      x: isLeft ? 29 : isRight ? 91 : 60,
      y: 88,
      label: sideLabel
        ? `${sideLabel} forearm`
        : 'Forearm',
    }
  }

  if (
    lower.includes('wrist') ||
    lower.includes('hand') ||
    lower.includes('palm') ||
    lower.includes('finger')
  ) {
    return {
      x: isLeft ? 27 : isRight ? 93 : 60,
      y: 98,
      label: sideLabel
        ? `${sideLabel} wrist`
        : 'Wrist',
    }
  }

  if (
    lower.includes('ribs') ||
    lower.includes('rib')
  ) {
    return {
      x: isLeft ? 51 : isRight ? 69 : 60,
      y: 67,
      label: sideLabel
        ? `${sideLabel} ribs`
        : 'Ribs',
    }
  }

  if (
    lower.includes('waist') ||
    lower.includes('abdomen') ||
    lower.includes('stomach')
  ) {
    return {
      x: sideX,
      y: 86,
      label: sideLabel
        ? `${sideLabel} waist`
        : 'Waist',
    }
  }

  if (
    lower.includes('back')
  ) {
    return {
      x: sideX,
      y: lower.includes('lower') ? 86 : 66,
      label: sideLabel
        ? `${sideLabel} back`
        : lower.includes('lower')
          ? 'Lower back'
          : 'Back',
    }
  }

  if (
    lower.includes('hip') ||
    lower.includes('groin')
  ) {
    return {
      x: sideX,
      y: 94,
      label: sideLabel
        ? `${sideLabel} hip`
        : 'Hip',
    }
  }

  if (
    lower.includes('thigh') ||
    lower.includes('hamstring') ||
    lower.includes('quadricep') ||
    lower.includes('quad')
  ) {
    return {
      x: sideX,
      y: 106,
      label: sideLabel
        ? `${sideLabel} thigh`
        : 'Thigh',
    }
  }

  if (lower.includes('knee')) {
    return {
      x: sideX,
      y: 122,
      label: sideLabel
        ? `${sideLabel} knee`
        : 'Knee',
    }
  }

  if (
    lower.includes('calf') ||
    lower.includes('shin') ||
    lower.includes('lower leg')
  ) {
    return {
      x: sideX,
      y: 140,
      label: sideLabel
        ? `${sideLabel} calf`
        : 'Calf',
    }
  }

  if (
    lower.includes('ankle')
  ) {
    return {
      x: sideX,
      y: 153,
      label: sideLabel
        ? `${sideLabel} ankle`
        : 'Ankle',
    }
  }

  if (
    lower.includes('foot') ||
    lower.includes('heel') ||
    lower.includes('toe')
  ) {
    return {
      x: sideX,
      y: 160,
      label: sideLabel
        ? `${sideLabel} foot`
        : 'Foot',
    }
  }

  return null
}

function getTappedBodyLabel(x, y) {
  const px = Number(x)
  const py = Number(y)

  if (!Number.isFinite(px) || !Number.isFinite(py)) {
    return ''
  }

  const side =
    px < 55
      ? 'Left'
      : px > 65
        ? 'Right'
        : ''

  if (py <= 25) return 'Head'
  if (py <= 34) return side ? `${side} neck` : 'Neck'

  if (py <= 48) {
    if (px < 48) return 'Left shoulder'
    if (px > 72) return 'Right shoulder'
    if (px < 60) return 'Left upper chest'
    if (px > 60) return 'Right upper chest'
    return 'Upper chest'
  }

  if (py <= 68) {
    if (px < 38) return 'Left upper arm'
    if (px > 82) return 'Right upper arm'
    return side ? `${side} ribs` : 'Chest'
  }

  if (py <= 88) {
    if (px < 32) return 'Left elbow'
    if (px > 88) return 'Right elbow'
    return side ? `${side} waist` : 'Waist'
  }

  if (py <= 98) {
    if (px < 32) return 'Left wrist'
    if (px > 88) return 'Right wrist'
    return side ? `${side} hip` : 'Hip'
  }

  if (py <= 114) {
    return side ? `${side} thigh` : 'Thigh'
  }

  if (py <= 130) {
    return side ? `${side} knee` : 'Knee'
  }

  if (py <= 150) {
    return side ? `${side} calf` : 'Calf'
  }

  return side ? `${side} ankle` : 'Ankle'
}

function InjuryModal({
  title,
  form,
  onChange,
  onSave,
  onClose,
  onDelete,
  saving,
}) {
  const injuryImageInputRef = useRef(null)

  const handleBodyTap = event => {
    const svg = event.currentTarget
    const rect = svg.getBoundingClientRect()

    const x = ((event.clientX - rect.left) / rect.width) * 120
    const y = ((event.clientY - rect.top) / rect.height) * 170

    const roundedX = Math.round(x)
    const roundedY = Math.round(y)
    const suggestedLabel = getTappedBodyLabel(
      roundedX,
      roundedY
    )

    onChange('bodyX', roundedX)
    onChange('bodyY', roundedY)

    const currentName = String(form.name || '').trim()

    const isAutoGeneratedName =
      !currentName ||
      /^[a-z ]+\s+(pain|injury|strain|sprain)$/i.test(
        currentName
      )

    if (isAutoGeneratedName && suggestedLabel) {
      onChange('name', `${suggestedLabel} pain`)
    }
  }

  const handleInjuryImage = event => {
    const file = event.target.files?.[0]

    if (!file) return

    if (!file.type.startsWith('image/')) {
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      return
    }

    if (
      form.imageUrl &&
      form.imageUrl.startsWith('blob:')
    ) {
      URL.revokeObjectURL(form.imageUrl)
    }

    onChange('imageFile', file)
    onChange('imageUrl', URL.createObjectURL(file))
    onChange('imageRemoved', false)

    if (event.target) {
      event.target.value = ''
    }
  }

  const clearInjuryImage = () => {
    if (
      form.imageUrl &&
      form.imageUrl.startsWith('blob:')
    ) {
      URL.revokeObjectURL(form.imageUrl)
    }

    onChange('imageFile', null)
    onChange('imageUrl', '')
    onChange('imagePath', '')
    onChange('imageRemoved', true)
  }

  const hasBodyPoint =
    form.bodyX !== null &&
    form.bodyX !== undefined &&
    form.bodyY !== null &&
    form.bodyY !== undefined &&
    Number.isFinite(Number(form.bodyX)) &&
    Number.isFinite(Number(form.bodyY))

  const severityColor =
    form.severity === 'Severe'
      ? '#EF4444'
      : form.severity === 'Moderate'
        ? '#F59E0B'
        : '#10B981'

  return (
    <ModalShell title={title} onClose={onClose}>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          Injury description
        </label>
        <input
          className={styles.formInput}
          placeholder="e.g. Left wrist pain or right hip strain"
          value={form.name}
          onChange={event => {
            const value = event.target.value
            const detectedPoint =
              getBodyPointFromName(value)

            onChange('name', value)

            if (detectedPoint) {
              onChange('bodyX', detectedPoint.x)
              onChange('bodyY', detectedPoint.y)
            } else if (!value.trim()) {
              onChange('bodyX', null)
              onChange('bodyY', null)
            }
          }}
        />
        <div
          style={{
            marginTop: 5,
            fontSize: 10,
            color: 'var(--text-muted, #8892A4)',
          }}
        >
          Type a recognised body part to place the dot automatically,
          tap the body diagram, or use both.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 14,
        }}
      >
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Date</label>
          <input
            className={styles.formInput}
            type="date"
            value={form.date}
            onChange={event =>
              onChange('date', event.target.value)
            }
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Status</label>
          <select
            className={styles.formSelect}
            value={form.status}
            onChange={event =>
              onChange('status', event.target.value)
            }
          >
            <option>Monitoring</option>
            <option>Recovering</option>
            <option>Recovered</option>
          </select>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Severity</label>
          <select
            className={styles.formSelect}
            value={form.severity}
            onChange={event =>
              onChange('severity', event.target.value)
            }
            style={{
              color: severityColor,
              fontWeight: 700,
            }}
          >
            <option value="Mild">Mild</option>
            <option value="Moderate">Moderate</option>
            <option value="Severe">Severe</option>
          </select>
        </div>
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
            Tap injury location optional
          </label>

          {hasBodyPoint && (
            <button
              type="button"
              className={styles.btnOutline}
              style={{
                padding: '5px 9px',
                fontSize: 10,
              }}
              onClick={() => {
                onChange('bodyX', null)
                onChange('bodyY', null)
              }}
            >
              Clear point
            </button>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: 12,
            borderRadius: 14,
            border: '1px solid var(--line, #E8EEF8)',
            background: 'var(--soft, #F7F9FF)',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: 180,
              height: 255,
              flexShrink: 0,
            }}
          >
            <img
              src="/humanbody.png"
              alt="Tap the human body to select the injury location"
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
              width="180"
              height="255"
              onClick={handleBodyTap}
              role="button"
              tabIndex={0}
              aria-label="Tap the body to select the injury location"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                cursor: 'crosshair',
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

              {hasBodyPoint && (
                <>
                  <circle
                    cx={Number(form.bodyX)}
                    cy={Number(form.bodyY)}
                    r="8"
                    fill="var(--card, #FFFFFF)"
                  />
                  <circle
                    cx={Number(form.bodyX)}
                    cy={Number(form.bodyY)}
                    r="5.5"
                    fill="#EF4444"
                  />
                </>
              )}
            </svg>
          </div>
        </div>

        <div
          style={{
            marginTop: 6,
            fontSize: 10,
            textAlign: 'center',
            color: 'var(--text-muted, #8892A4)',
          }}
        >
          {hasBodyPoint
            ? `Selected: ${getTappedBodyLabel(
                form.bodyX,
                form.bodyY
              ) || 'Body location'}`
            : 'No location selected yet.'}
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>
          Injury photo optional
        </label>

        <input
          ref={injuryImageInputRef}
          type="file"
          accept="image/*"
          onChange={handleInjuryImage}
          style={{ display: 'none' }}
        />

        {!form.imageUrl ? (
          <button
            type="button"
            className={styles.btnOutline}
            onClick={() =>
              injuryImageInputRef.current?.click()
            }
            disabled={saving}
            style={{
              width: '100%',
              minHeight: 44,
              borderStyle: 'dashed',
            }}
          >
            📷 Upload Injury Photo
          </button>
        ) : (
          <div
            style={{
              padding: 10,
              borderRadius: 12,
              border: '1px solid var(--line, #E8EEF8)',
              background: 'var(--soft, #F7F9FF)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text, #0D1B3E)',
                }}
              >
                Injury photo
              </span>

              <button
                type="button"
                onClick={clearInjuryImage}
                disabled={saving}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#EF4444',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>

            <img
              src={form.imageUrl}
              alt="Injury preview"
              style={{
                width: '100%',
                maxHeight: 180,
                objectFit: 'contain',
                borderRadius: 8,
                background: '#FFFFFF',
              }}
            />
          </div>
        )}

        <div
          style={{
            marginTop: 5,
            fontSize: 10,
            color: 'var(--text-muted, #8892A4)',
          }}
        >
          JPG, PNG or other image formats supported by your browser. Maximum 10 MB.
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Notes</label>
        <textarea
          className={styles.formTextarea}
          placeholder="e.g. Pain increases during overhead shots"
          value={form.notes}
          onChange={event =>
            onChange('notes', event.target.value)
          }
        />
      </div>

      <FormActions
        onSave={onSave}
        onClose={onClose}
        onDelete={onDelete}
        saving={saving}
      />
    </ModalShell>
  )
}

function ScheduleModal({
  title,
  form,
  onChange,
  onSave,
  onClose,
  onDelete,
  onComplete,
  onMiss,
  scheduleItem,
  canChangeStatus = false,
  coachOptions = [],
  saving,
  error = '',
}) {
  const selectedType = String(form.type || 'Training')
  const typeLower = selectedType.toLowerCase()

  const isRestDay = typeLower.includes('rest')
  const isCompetition = typeLower.includes('competition')
  const isFriendly = typeLower.includes('friendly')
  const isRecovery = typeLower.includes('recovery')
  const isTraining = typeLower === 'training'

  const activityLabel = isCompetition
    ? 'Competition name'
    : isFriendly
      ? 'Match title'
      : isRecovery
        ? 'Recovery activity'
        : selectedType === 'Other'
          ? 'Activity name'
          : 'Training activity'

  const activityPlaceholder = isCompetition
    ? 'e.g. Penang Open Championship'
    : isFriendly
      ? 'e.g. Club friendly vs KBA'
      : isRecovery
        ? 'e.g. Mobility and stretching'
        : selectedType === 'Other'
          ? 'e.g. Team briefing'
          : 'e.g. Footwork drills'

  const helperText = isCompetition
    ? 'This competition will appear under Upcoming Events. After it ends, mark it Completed or Missed.'
    : isFriendly
      ? 'This friendly match will appear under Upcoming Events. After it ends, mark it Completed or Missed.'
      : isRecovery
        ? 'This recovery session will appear under Upcoming Events and can be completed after the end time.'
        : isRestDay
          ? 'This rest day will appear in your calendar. No training history record will be created.'
          : 'This is a planned session. After the end time, choose Completed to add it automatically to Training Log, or Missed if you did not attend.'

  const handleTimeChange = (field, value) => {
    onChange(field, value)

    if (field === 'time' && form.duration) {
      const nextEndTime = calculateEndTime(
        value,
        form.duration
      )

      if (nextEndTime) {
        onChange('endTime', nextEndTime)
      }
    }

    if (field === 'endTime' && form.time) {
      onChange(
        'duration',
        calculateDuration(form.time, value)
      )
    }
  }

  const handleDurationChange = value => {
    onChange('duration', value)

    const nextEndTime = calculateEndTime(
      form.time,
      value
    )

    if (nextEndTime) {
      onChange('endTime', nextEndTime)
    }
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 10,
            border:
              '1px solid color-mix(in srgb, #EF4444 30%, var(--line, #EEF1F8))',
            background:
              'color-mix(in srgb, #EF4444 8%, var(--card, #FFFFFF))',
            color: '#B91C1C',
            fontSize: 12,
            lineHeight: 1.5,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}
      >
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Date</label>
          <input
            className={styles.formInput}
            type="date"
            value={form.date}
            onChange={event =>
              onChange('date', event.target.value)
            }
          />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Type</label>
          <select
            className={styles.formSelect}
            value={form.type}
            onChange={event => {
              const nextType = event.target.value
              onChange('type', nextType)

              if (nextType !== 'Training') {
                onChange('focus', nextType)
              }
            }}
          >
            <option>Training</option>
            <option>Competition</option>
            <option>Friendly Match</option>
            <option>Rest Day</option>
            <option>Recovery</option>
            <option>Other</option>
          </select>
        </div>
      </div>

      {!isRestDay && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
            }}
          >
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Start time</label>
              <input
                className={styles.formInput}
                type="time"
                value={form.time}
                onChange={event =>
                  handleTimeChange('time', event.target.value)
                }
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>End time</label>
              <input
                className={styles.formInput}
                type="time"
                value={form.endTime}
                onChange={event =>
                  handleTimeChange('endTime', event.target.value)
                }
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                isTraining || isCompetition || isFriendly
                  ? '1fr 1fr'
                  : '1fr',
              gap: 14,
            }}
          >
            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                {activityLabel}
              </label>
              <input
                className={styles.formInput}
                placeholder={activityPlaceholder}
                value={form.activity}
                onChange={event =>
                  onChange('activity', event.target.value)
                }
              />
            </div>

            {isTraining && (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  Focus area
                </label>
                <select
                  className={styles.formSelect}
                  value={form.focus}
                  onChange={event =>
                    onChange('focus', event.target.value)
                  }
                >
                  <option>Endurance</option>
                  <option>Speed</option>
                  <option>Strength</option>
                  <option value="Agility">Agility</option>
                  <option>Recovery</option>
                  <option>Matches</option>
                </select>
              </div>
            )}

            {(isCompetition || isFriendly) && (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  Match type
                </label>
                <select
                  className={styles.formSelect}
                  value={form.matchType || 'Singles'}
                  onChange={event =>
                    onChange('matchType', event.target.value)
                  }
                >
                  <option>Singles</option>
                  <option>Mixed Doubles</option>
                  <option>Womens Doubles</option>
                  <option>Mens Double</option>
                </select>
              </div>
            )}
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>
              Planned duration
            </label>
            <input
              className={styles.formInput}
              value={
                form.duration ||
                calculateDuration(
                  form.time,
                  form.endTime
                )
              }
              onChange={event =>
                handleDurationChange(event.target.value)
              }
              placeholder="e.g. 2h, 1h 30min or 45min"
            />
            <div
              style={{
                marginTop: 5,
                fontSize: 10,
                color: '#8892A4',
              }}
            >
              Enter a duration to calculate the end time automatically.
            </div>
          </div>
        </>
      )}

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Venue</label>
        <input
          className={styles.formInput}
          placeholder={
            isRestDay
              ? 'Optional'
              : 'e.g. Sports Arena'
          }
          value={form.venue}
          onChange={event =>
            onChange('venue', event.target.value)
          }
        />
      </div>

      {coachOptions.length > 0 && (
        <div className={styles.formRow}>
          <label className={styles.formLabel}>
            Tag coach optional
          </label>
          <select
            className={styles.formSelect}
            value={form.taggedCoachUserId || ''}
            onChange={event =>
              onChange(
                'taggedCoachUserId',
                event.target.value
              )
            }
          >
            <option value="">Do not tag a coach</option>
            {coachOptions.map(coach => (
              <option
                key={coach.userId}
                value={coach.userId}
              >
                {coach.name}
              </option>
            ))}
          </select>
          <div
            style={{
              marginTop: 5,
              fontSize: 10,
              color: '#8892A4',
              lineHeight: 1.45,
            }}
          >
            The tagged coach can view this player-added
            schedule in Coach Sessions. They cannot edit or
            delete it.
          </div>
        </div>
      )}

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Notes optional</label>
        <textarea
          className={styles.formTextarea}
          placeholder="e.g. Bring extra racket and warm up early"
          value={form.notes}
          onChange={event =>
            onChange('notes', event.target.value)
          }
        />
      </div>

      <div
        style={{
          marginBottom: 14,
          padding: '10px 12px',
          borderRadius: 10,
          background:
            'color-mix(in srgb, #1A5FFF 8%, var(--card, #FFFFFF))',
          color: 'var(--text-muted, #8892A4)',
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        {helperText}
      </div>

      {scheduleItem && !isRestDay && (
        <div
          style={{
            marginBottom: 14,
            padding: '12px',
            borderRadius: 12,
            border: '1px solid var(--line, #E8EEF8)',
            background:
              canChangeStatus
                ? 'color-mix(in srgb, #2563EB 6%, var(--card, #FFFFFF))'
                : 'var(--soft, #F7F9FF)',
          }}
        >
          <div
            style={{
              marginBottom: 8,
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text, #0D1B3E)',
            }}
          >
            Schedule status
          </div>

          {canChangeStatus ? (
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className={styles.btnPrimary}
                style={{ background: '#10B981' }}
                disabled={saving}
                onClick={onComplete}
              >
                Mark Completed
              </button>

              <button
                type="button"
                className={styles.btnOutline}
                style={{
                  borderColor: '#EF4444',
                  color: '#EF4444',
                }}
                disabled={saving}
                onClick={onMiss}
              >
                Mark Missed
              </button>
            </div>
          ) : (
            <div
              style={{
                fontSize: 11,
                lineHeight: 1.5,
                color: 'var(--text-muted, #8892A4)',
              }}
            >
              Status can be changed to Completed or Missed after the scheduled end time.
            </div>
          )}
        </div>
      )}

      <FormActions
        onSave={onSave}
        onClose={onClose}
        onDelete={onDelete}
        saving={saving}
      />
    </ModalShell>
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
        {DAYS.map(d => <div key={d} style={{ fontSize: 10, fontWeight: 700, color: '#8892A4' }}>{d}</div>)}
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
              <span style={{ fontSize: 12, fontWeight: isToday || isSelected ? 700 : 400, color: isSelected ? '#fff' : isToday ? '#1A5FFF' : '#0D1B3E', lineHeight: '24px' }}>
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
              fontSize: 10,
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
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0D1B3E', marginBottom: 8 }}>
            {fmtDate(selectedDate)} planned, completed and absent activities
          </div>

          {selectedItems.length === 0 ? (
            <div style={{ fontSize: 12, color: '#8892A4' }}>No planned or completed activity for this date.</div>
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
              !isMissed &&
              item.source !== 'training_log' &&
              (item.type === 'Training' ||
                item.source === 'coach_training')

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

                  <div style={{ fontSize: 11, color: '#8892A4' }}>
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
                        fontSize: 10,
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
                          fontSize: 11,
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
                          fontSize: 11,
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

function FitnessComparisonRow({
  label,
  playerValue,
  coachValue,
}) {
  const playerScore = Number(playerValue ?? 50)
  const hasCoachValue =
    coachValue !== null &&
    coachValue !== undefined &&
    Number.isFinite(Number(coachValue))
  const coachScore = hasCoachValue ? Number(coachValue) : playerScore
  const hasChange = hasCoachValue && coachScore !== playerScore
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
            fontSize: 13,
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
          }}
        >
          {label}
        </div>
      </div>

      <div
        style={{
          position: 'relative',
          height: 8,
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
                fontSize: 9,
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
          fontSize: 11,
          fontWeight: 700,
          color: playerColor.text,
          whiteSpace: 'nowrap',
        }}
      >
        {playerScore}
        <span
          style={{
            color: 'var(--text-muted, #8892A4)',
            fontWeight: 500,
          }}
        >
          {' '} /100
        </span>
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
  const [hasCoach, setHasCoach] = useState(false)
  const [coachOptions, setCoachOptions] = useState([])
  const [googleSyncEnabled, setGoogleSyncEnabled] = useState(false)
  const [googleCalendarBusy, setGoogleCalendarBusy] = useState(false)
  const [showFitnessInfo, setShowFitnessInfo] = useState(false)
  const trainingTableRef = useRef(null)
  const [
    fitnessRightColumnNode,
    setFitnessRightColumnNode,
  ] = useState(null)
  const [threeColumnHeight, setThreeColumnHeight] = useState(null)

  const [scheduleForm, setScheduleForm] = useState(emptySchedule())
  const [trainingForm, setTrainingForm] = useState(emptyTraining())
  const [testForm, setTestForm] = useState(emptyTest())
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

    resetTrainingScroll()
    window.addEventListener('resize', resetTrainingScroll)

    return () => {
      window.removeEventListener('resize', resetTrainingScroll)
    }
  }, [])

  useLayoutEffect(() => {
    if (!fitnessRightColumnNode) {
      setThreeColumnHeight(null)
      return undefined
    }

    let frameId = null

    const measureRightStack = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }

      frameId = requestAnimationFrame(() => {
        if (window.innerWidth <= 900) {
          setThreeColumnHeight(null)
          return
        }

        const rect =
          fitnessRightColumnNode.getBoundingClientRect()

        const nextHeight =
          Math.ceil(rect.height)

        setThreeColumnHeight(
          nextHeight > 0
            ? nextHeight
            : null
        )
      })
    }

    measureRightStack()

    const observer =
      new ResizeObserver(
        measureRightStack
      )

    observer.observe(
      fitnessRightColumnNode
    )

    window.addEventListener(
      'resize',
      measureRightStack
    )

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }

      observer.disconnect()

      window.removeEventListener(
        'resize',
        measureRightStack
      )
    }
  }, [fitnessRightColumnNode])

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

  const saveGoogleCalendarPreference = async enabled => {
    const uid = userId || (await getUserId())

    const { error } = await supabase
      .from('google_calendar_connections')
      .upsert(
        {
          user_id: uid,
          enabled,
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

      await saveGoogleCalendarPreference(true)
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

  const fitnessSummary = useMemo(
    () =>
      calculateFitnessSummary({
        tests,
        sessions,
        recoveryLogs,
        injuries,
        scheduleList,
      }),
    [tests, sessions, recoveryLogs, injuries, scheduleList]
  )

  const {
    fitnessScore,
    indicators,
    latestRecovery,
    weeklyMinutes,
    weeklyHours,
    activeInjuries,
    recoveryScore,
  } = fitnessSummary

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
      focus: item.focus || item.type || 'Training',
      venue: item.venue || '',
      createdAt:
        item.createdAt || '',
      status:
        item.scheduleStatus === 'missed'
          ? 'Missed'
          : item.attendanceStatus ||
            item.attendance_status ||
            item.status ||
            'Scheduled',
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
      focus: item.focus || item.type || 'Training',
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

  const setForm = setter => (k, v) => setter(f => ({ ...f, [k]: v }))

  const openAddSchedule = date => {
    setEditingSchedule(null)
    setLoadError('')
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

  const checkPlayerScheduleConflict = async uid => {
    if (
      !uid ||
      !scheduleForm.date ||
      !scheduleForm.time ||
      !scheduleForm.endTime ||
      scheduleForm.type === 'Rest Day'
    ) {
      return false
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

    return Boolean(data)
  }

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

      const hasConflict =
        await checkPlayerScheduleConflict(
          uid
        )

      if (hasConflict) {
        setLoadError(
          'This time slot is not available because you already have another activity scheduled.'
        )
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
          focus: scheduleForm.focus,
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

      if (
        !editingSchedule &&
        googleSyncEnabled
      ) {
        try {
          await ensureGoogleCalendarAccess()

          const googleEvent =
            await createGoogleCalendarEvent({
              title: scheduleTitle,
              date: scheduleForm.date,
              startTime:
                scheduleForm.time || '09:00',
              endTime:
                scheduleForm.endTime || '',
              venue:
                scheduleForm.venue.trim(),
              scheduleType:
                scheduleForm.type,
              description: [
                `ShuttleTrack ${scheduleForm.type}`,
                ['Competition', 'Friendly Match'].includes(
                  scheduleForm.type
                ) && scheduleForm.matchType
                  ? `Match type: ${scheduleForm.matchType}`
                  : '',
                scheduleForm.notes.trim(),
              ]
                .filter(Boolean)
                .join('\n'),
            })

          if (googleEvent?.id) {
            const {
              data: googleLinkedRow,
              error: googleIdError,
            } = await supabase
              .from('player_schedule')
              .update({
                google_event_id:
                  googleEvent.id,
              })
              .eq('id', data.id)
              .eq('user_id', uid)
              .select('*')
              .single()

            if (googleIdError) {
              console.error(
                'Unable to save Google event ID:',
                googleIdError
              )
            } else if (googleLinkedRow) {
              savedRow = googleLinkedRow
            }
          }
        } catch (googleError) {
          console.error(
            'Google Calendar event creation error:',
            googleError
          )

          setLoadError(
            `Schedule saved in ShuttleTrack, but Google Calendar sync failed: ${
              googleError?.message ||
              'Unable to create Google Calendar event.'
            }`
          )
        }
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
      const { error } = await supabase.from('player_schedule').delete().eq('id', editingSchedule.id).eq('user_id', uid)
      if (error) throw error

      setScheduleList(prev => prev.filter(s => s.id !== editingSchedule.id))
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
          focus: item.focus || 'Endurance',
          activity:
            item.activity ||
            item.title ||
            'Training',
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

    if (item?.scheduleStatus === 'missed') {
      setLoadError(
        'This session was marked as missed.'
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
        focus: item.focus || 'Endurance',
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
        focus: item.focus || 'Endurance',
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

  const openAddTest = () => {
    setTestForm(emptyTest())
    setShowTest(true)
  }

  const openEditTest = row => {
    setEditingTest(row)
    setTestForm({
      date: row.date,
      test: row.test,
      result: row.result,
      indicator: row.indicator,
      score: row.score,
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
        focus: trainingForm.focus,
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
        change_note: editingTest ? 'Updated' : 'New',
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
      `Recovery status: ${recoveryStatus} (${recoveryScore}/100)`,
      `Weekly training load: ${weeklyHours}h`,
      `Scheduled events: ${scheduleList.length}`,
      `Completed training records: ${sessions.length}`,
      `Fitness tests: ${tests.length}`,
      `Active injuries: ${activeInjuries}`,
      `Suggestion: ${suggestion}`,
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
            fontSize: 12,
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
          fontSize: 12,
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
              <div className={styles.metricLbl} style={{ color: 'rgba(255,255,255,0.72)' }}>Fitness score</div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  color: fitnessScore >= 70 ? '#00C48C' : fitnessScore >= 50 ? '#F59E0B' : '#EF4444',
                }}
              >
                {fitnessScore >= 70 ? 'Good condition' : fitnessScore >= 50 ? 'Moderate' : 'Needs improvement'}
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
              {scheduleList.length}
            </div>

            <div className={styles.metricLbl}>Scheduled events</div>
            <div style={{ marginTop: 5, fontSize: 11, color: '#8892A4' }}>
              planned sessions & events
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
              {sessions.length}
            </div>

            <div className={styles.metricLbl}>Completed training</div>
            <div style={{ marginTop: 5, fontSize: 11, color: '#8892A4' }}>
              saved training records
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
            <div style={{ marginTop: 5, fontSize: 11, color: '#8892A4' }}>
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
            <div style={{ marginTop: 5, fontSize: 11, color: '#8892A4' }}>
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
                  fontSize: 12,
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
                  fontSize: 12,
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
            onCompleteSchedule={completeScheduledTraining}
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
                    fontSize: 11,
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
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#1A5FFF',
                          }}
                        >
                          {name}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
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

            <button
              className={styles.btnOutline}
              style={{
                fontSize: 12,
                padding: '7px 14px',
              }}
              onClick={openAddTest}
            >
              Update
            </button>
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
                coachValue={latestCoachAssessment?.[coachKey]}
              />
            )
          })}

          <div style={{ fontSize: 12, color: '#8892A4', marginTop: 8 }}>
            Player values come from training logs, fitness tests, recovery check-ins and injury status. A purple marker shows the coach assessment only when it is different.
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
              style={{ fontSize: 12, padding: '7px 14px' }}
              onClick={exportReport}
            >
              Export Report
            </button>
          </div>

          <div
            style={{
              marginBottom: 10,
              fontSize: 12,
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
                <div style={{ fontSize: 10, color: 'var(--text-muted, #8892A4)' }}>
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
                  fontSize: 11,
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
                  fontSize: 13,
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
                marginTop: 12,
                padding: '13px 14px',
                borderRadius: 12,
                background:
                  'color-mix(in srgb, #1A5FFF 6%, var(--soft, #F6F8FF))',
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
                  marginBottom: 7,
                }}
              >
                Fitness action plan
              </div>

              <div
                style={{
                  fontSize: 13,
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
                      fontSize: 12,
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
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#7C3AED',
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
                        fontSize: 10,
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
                        fontSize: 11,
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
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                Self-managed
              </span>
            </div>

            <div
              style={{
                marginBottom: 10,
                fontSize: 12,
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
                  fontSize: 11,
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
          className={styles.card}
          style={{
            height:
              threeColumnHeight
                ? `${threeColumnHeight}px`
                : 'auto',
            maxHeight:
              threeColumnHeight
                ? `${threeColumnHeight}px`
                : 'none',
            minHeight: 0,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ marginBottom: 14, flexShrink: 0 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 4 }}>
              Training Log
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted, #8892A4)' }}>
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
                  fontSize: 11,
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
              overflow: 'hidden',
            }}
          >
            <div
              className="fitness-training-header"
              style={{
                display: 'grid',
                gridTemplateColumns:
                  '66px 118px minmax(125px, 1.35fr) 70px minmax(90px, 0.9fr) 82px',
                gap: 10,
                padding: '0 10px 8px',
                color: '#8892A4',
                fontSize: 11,
                fontWeight: 700,
                alignItems: 'center',
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            >
              <div>Date</div>
              <div>Time</div>
              <div>Training</div>
              <div>Duration</div>
              <div>Focus</div>
              <div>Status</div>
            </div>

            {tableSessions.length === 0 && (
              <div
                style={{
                  padding: '18px 8px',
                  color: '#8892A4',
                  fontSize: 12,
                }}
              >
                No scheduled or completed sessions yet.
              </div>
            )}

            {tableSessions.length > 0 && (
              <div
                className="fitness-training-body"
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: 0,
                  maxHeight: '100%',
                  overflowY: 'auto',
                  overflowX: 'hidden',
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
                        width: '100%',
                        display: 'grid',
                        gridTemplateColumns:
                          '66px 118px minmax(125px, 1.35fr) 70px minmax(90px, 0.9fr) 82px',
                        gap: 10,
                        alignItems: 'center',
                        minWidth: 0,
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
                            fontSize: 12,
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
                        <div style={{ fontSize: 11, color: '#8892A4' }}>
                          {new Date(
                            `${t.date}T00:00:00`
                          ).toLocaleDateString('en-MY', {
                            weekday: 'short',
                          })}
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: '#8892A4', fontWeight: 700 }}>
                        {safeTimeRange(t.time, t.endTime)}
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                          fontSize: 13,
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
                          fontSize: 12,
                          color: '#8892A4',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.duration || '-'}
                      </div>

                      <div
                        style={{
                          minWidth: 0,
                          maxWidth: '100%',
                          fontSize: 12,
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
                          fontSize: 11,
                          fontWeight: 700,
                          textAlign: 'left',
                          whiteSpace: 'normal',
                          overflowWrap: 'anywhere',
                          lineHeight: 1.2,
                          color:
                            statusLower === 'completed'
                              ? '#10B981'
                              : ['missed', 'absent'].includes(statusLower)
                                ? '#EF4444'
                                : '#2563EB',
                        }}
                      >
                        {statusLower === 'scheduled'
                          ? 'Upcoming'
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
          className={styles.card}
          style={{
            height:
              threeColumnHeight
                ? `${threeColumnHeight}px`
                : 'auto',
            maxHeight:
              threeColumnHeight
                ? `${threeColumnHeight}px`
                : 'none',
            minHeight: 0,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>Fitness Test Records</div>
            <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={openAddTest}>Add</button>
          </div>

          {tests.length === 0 && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'flex-start',
                padding: '18px 0',
                color: '#8892A4',
                fontSize: 12,
              }}
            >
              No fitness test saved yet.
            </div>
          )}

          {tests.length > 0 && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {tests.slice(0, 7).map(test => (
            <div
              key={test.id}
              className={styles.listRow}
              onClick={() => openEditTest(test)}
              style={{
                cursor: 'pointer',
                display: 'grid',
                gridTemplateColumns: '1fr 75px 65px 20px',
                gap: 10,
                alignItems: 'center',
                paddingTop: 12,
                paddingBottom: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{test.test}</div>
                <div style={{ fontSize: 11, color: '#8892A4' }}>{fmtDate(test.date)} · {test.indicator}</div>
              </div>
              <div style={{ fontSize: 12, color: '#0D1B3E', fontWeight: 700 }}>{test.result}</div>
              <div style={{ fontSize: 12, color: '#10B981', fontWeight: 700, textAlign: 'right' }}>{test.change}</div>
              {pencilIcon}
            </div>
              ))}

            </div>
          )}
        </div>

        <div
          ref={setFitnessRightColumnNode}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minWidth: 0,
          }}
        >
          <div className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className={styles.cardTitle} style={{ marginBottom: 0 }}>Recovery Check-in</div>
              <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={openAddRecovery}>Add</button>
            </div>

            {[
              { label: 'Sleep Hours', val: latestRecovery ? `${latestRecovery.sleep} h` : '-', badge: latestRecovery ? (latestRecovery.sleep >= 7 ? 'Good' : 'Low') : 'No data', color: latestRecovery ? (latestRecovery.sleep >= 7 ? 'green' : 'amber') : 'gray' },
              { label: 'Tiredness', val: latestRecovery ? `${latestRecovery.tiredness} /10` : '-', badge: latestRecovery ? (latestRecovery.tiredness <= 3 ? 'Low' : 'Monitor') : 'No data', color: latestRecovery ? (latestRecovery.tiredness <= 3 ? 'green' : 'amber') : 'gray' },
              { label: 'Muscle Ache', val: latestRecovery ? `${latestRecovery.muscleAche} /10` : '-', badge: latestRecovery ? (latestRecovery.muscleAche <= 3 ? 'Low' : 'Monitor') : 'No data', color: latestRecovery ? (latestRecovery.muscleAche <= 3 ? 'green' : 'amber') : 'gray' },
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
                  <span className={getBadgeClass(r.color)} style={{ fontSize: 10, marginLeft: 8 }}>{r.badge}</span>
                </span>
              </div>
            ))}

            <div style={{ marginTop: 12, borderTop: '1px solid #EEF2F7', paddingTop: 10 }}>
              {[...recoveryLogs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).map(r => (
                <div key={r.id} className={styles.listRow} onClick={() => openEditRecovery(r)} style={{ cursor: 'pointer', borderRadius: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{fmtDate(r.date)}</div>
                    <div style={{ fontSize: 11, color: '#8892A4' }}>Sleep {r.sleep}h · Tired {r.tiredness}/10 · Ache {r.muscleAche}/10</div>
                  </div>
                  {pencilIcon}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className={styles.cardTitle} style={{ marginBottom: 0 }}>Injury Log</div>
              <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={openAddInjury}>Add</button>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 170,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                }}
              >
                {injuries.length === 0 && <div style={{ padding: '18px 0', color: '#8892A4', fontSize: 12 }}>No injury records yet.</div>}

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
                      className={styles.listRow}
                      onClick={() =>
                        openEditInjury(injury)
                      }
                      style={{
                        cursor: 'pointer',
                        borderRadius: 8,
                        gap: 10,
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
                            background: '#F7F9FF',
                          }}
                        />
                      )}

                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          {injury.name}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: '#8892A4',
                          }}
                        >
                          {fmtDate(injury.date)}
                        </div>

                        <div
                          style={{
                            marginTop: 3,
                            fontSize: 11,
                            fontWeight: 700,
                            color: severityColor,
                          }}
                        >
                          {injury.severity || 'Mild'} severity
                        </div>
                      </div>

                      <span
                        className={getBadgeClass(
                          injury.color
                        )}
                      >
                        {injury.status}
                      </span>
                    </div>
                  )
                })}
              </div>

              <InjuryBodyMap injuries={injuries} />
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
            direction: ltr;
            overflow: visible;
          }

          .fitness-training-header,
          .fitness-training-body,
          .fitness-training-row {
            width: 100%;
            min-width: 0;
            box-sizing: border-box;
          }

          .fitness-training-body {
            padding-right: 0 !important;
            scrollbar-gutter: auto !important;
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
            }

            .fitness-training-filters {
              grid-template-columns:
                repeat(2, minmax(0, 1fr)) !important;
            }
          }

          @media (max-width: 640px) {
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
              padding-bottom: 7px;
            }

            .fitness-training-header,
            .fitness-training-body {
              width: 700px;
              min-width: 700px;
            }

            .fitness-training-body {
              overflow-x: visible !important;
              overflow-y: auto !important;
            }

            .fitness-training-row {
              width: 700px;
              min-width: 700px;
            }

            .fitness-training-header > :nth-child(6),
            .fitness-training-row > :nth-child(6) {
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
        `}
      </style>

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
          }}
          coachOptions={coachOptions}
          saving={saving}
          error={loadError}
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
          }}
          onDelete={requestDeleteSchedule}
          scheduleItem={editingSchedule}
          canChangeStatus={isScheduleFinished(editingSchedule)}
          coachOptions={coachOptions}
          onComplete={async () => {
            const item = editingSchedule
            setEditingSchedule(null)
            setScheduleForm(emptySchedule())
            await completeScheduledTraining(item)
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

      {showTest && (
        <TestModal
          title="Add Fitness Test"
          form={testForm}
          onChange={setForm(setTestForm)}
          onSave={saveTest}
          onClose={() => { setShowTest(false); setTestForm(emptyTest()) }}
          saving={saving}
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
