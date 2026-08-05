import { useEffect, useMemo, useRef, useState } from 'react'
import NotificationBell from '../Notifications/NotificationBell'
import { supabase } from '../../lib/supabaseClient'
import { calculateFitnessSummary } from '../../utils/fitnessScore'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const SCHEDULE_COLORS = {
  Training: '#1A5FFF',
  Competition: '#F59E0B',
  'Friendly Match': '#00C48C',
  'Rest Day': '#C8D0E0',
  Recovery: '#10B981',
  Other: '#8B5CF6',
  'Completed Training': '#1A5FFF',
}

const SCHEDULE_BADGE = {
  Training: 'blue',
  Competition: 'amber',
  'Friendly Match': 'green',
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
  focus = 'Stamina',
  activity = 'Training',
  status = 'scheduled',
}) {
  return `${SCHEDULE_META_PREFIX}${JSON.stringify({
    notes,
    endTime,
    focus,
    activity,
    status,
  })}`
}

function decodeScheduleNotes(value) {
  const raw = String(value || '')

  if (!raw.startsWith(SCHEDULE_META_PREFIX)) {
    return {
      notes: raw,
      endTime: '',
      focus: 'Stamina',
      activity: '',
      status: 'scheduled',
    }
  }

  try {
    const parsed = JSON.parse(raw.slice(SCHEDULE_META_PREFIX.length))

    return {
      notes: parsed?.notes || '',
      endTime: parsed?.endTime || '',
      focus: parsed?.focus || 'Stamina',
      activity: parsed?.activity || '',
      status: parsed?.status || 'scheduled',
    }
  } catch {
    return {
      notes: raw,
      endTime: '',
      focus: 'Stamina',
      activity: '',
      status: 'scheduled',
    }
  }
}


const INJURY_META_PREFIX = '__SHUTTLETRACK_INJURY__:'

function encodeInjuryNotes({
  notes = '',
  bodyX = null,
  bodyY = null,
}) {
  return `${INJURY_META_PREFIX}${JSON.stringify({
    notes,
    bodyX,
    bodyY,
  })}`
}

function decodeInjuryNotes(value) {
  const raw = String(value || '')

  if (!raw.startsWith(INJURY_META_PREFIX)) {
    return {
      notes: raw,
      bodyX: null,
      bodyY: null,
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
    }
  } catch {
    return {
      notes: raw,
      bodyX: null,
      bodyY: null,
    }
  }
}

const FITNESS_COLORS = {
  Stamina: '#10B981',
  Speed: '#2563EB',
  Strength: '#8B5CF6',
  Flexibility: '#F59E0B',
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
  focus: 'Stamina',
  notes: '',
})

const emptySchedule = (date = todayISO()) => ({
  date,
  time: '',
  endTime: '',
  duration: '',
  type: 'Training',
  activity: '',
  focus: 'Stamina',
  venue: '',
  notes: '',
})

const emptyTest = (date = todayISO()) => ({
  date,
  test: '',
  result: '',
  indicator: 'Stamina',
  score: 70,
})

const emptyRecovery = (date = todayISO()) => ({
  date,
  sleep: 7,
  tiredness: 3,
  muscleAche: 2,
  hr: 62,
  notes: '',
})

const emptyInjury = (date = todayISO()) => ({
  name: '',
  date,
  status: 'Monitoring',
  notes: '',
  bodyX: null,
  bodyY: null,
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
    focus: row.focus || 'Stamina',
    notes: row.notes || '',
    venue: extractVenueFromNotes(row.notes),
    coachSessionId: row.coach_session_id || null,
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
    focus: meta.focus || 'Stamina',
    venue: row.location || '',
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
  }
}

function rowToTest(row) {
  return {
    id: row.id,
    date: row.test_date,
    test: row.test_name || '',
    result: row.result || '',
    indicator: row.indicator || 'Stamina',
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

  return {
    id: row.id,
    name: row.injury_description || '',
    date: row.injury_date,
    status,
    notes: meta.notes || '',
    bodyX: meta.bodyX,
    bodyY: meta.bodyY,
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
      <text x="41" y="38" textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff">
        {value}
      </text>
      <text x="41" y="54" textAnchor="middle" fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.72)">
        %
      </text>
    </svg>
  )
}

function ProgressRing({ value }) {
  const r = 34
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c

  return (
    <svg className="fitness-mobile-ring" width="92" height="92" viewBox="0 0 92 92">
      <circle cx="46" cy="46" r={r} stroke="#E8EEF8" strokeWidth="9" fill="none" />
      <circle
        cx="46"
        cy="46"
        r={r}
        stroke="#10B981"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 46 46)"
      />
      <text x="46" y="50" textAnchor="middle" fontSize="14" fontWeight="800" fill="currentColor">
        {value}%
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
        {/* Keep the original body coordinate layer, but hide its lines. */}
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
            <option>Stamina</option>
            <option>Speed</option>
            <option>Strength</option>
            <option>Flexibility</option>
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
        <label className={styles.formLabel}>
          Duration
        </label>
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
        <div
          style={{
            marginTop: 5,
            fontSize: 10,
            color: '#8892A4',
          }}
        >
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
            <option>Stamina</option>
            <option>Speed</option>
            <option>Strength</option>
            <option>Flexibility</option>
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

function RecoveryModal({ title, form, onChange, onSave, onClose, onDelete, saving }) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Date</label>
          <input className={styles.formInput} type="date" value={form.date} onChange={e => onChange('date', e.target.value)} />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Resting heart rate</label>
          <input className={styles.formInput} type="number" value={form.hr} onChange={e => onChange('hr', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Sleep hours</label>
          <input className={styles.formInput} type="number" min="0" max="24" value={form.sleep} onChange={e => onChange('sleep', e.target.value)} />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Tiredness /10</label>
          <input className={styles.formInput} type="number" min="1" max="10" value={form.tiredness} onChange={e => onChange('tiredness', e.target.value)} />
          <div style={{ fontSize: 10, color: '#8892A4', marginTop: 4 }}>1 = not tired, 10 = very tired</div>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Muscle ache /10</label>
          <input className={styles.formInput} type="number" min="1" max="10" value={form.muscleAche} onChange={e => onChange('muscleAche', e.target.value)} />
          <div style={{ fontSize: 10, color: '#8892A4', marginTop: 4 }}>1 = no ache, 10 = very painful</div>
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Notes</label>
        <textarea className={styles.formTextarea} placeholder="e.g. Slept only 6 hours, felt tired after training." value={form.notes} onChange={e => onChange('notes', e.target.value)} />
      </div>

      <FormActions onSave={onSave} onClose={onClose} onDelete={onDelete} saving={saving} />
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

  const hasBodyPoint =
    form.bodyX !== null &&
    form.bodyX !== undefined &&
    form.bodyY !== null &&
    form.bodyY !== undefined &&
    Number.isFinite(Number(form.bodyX)) &&
    Number.isFinite(Number(form.bodyY))

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
          tap the body diagram, or use both. Tapping suggests a body-part
          name when the description is empty.
        </div>
      </div>

      <div className={styles.g2} style={{ marginBottom: 0 }}>
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
            {/* Visible body picture. */}
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

            {/* Existing 120 × 170 body coordinate layer stays unchanged. */}
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
  saving,
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
      ? 'Match name'
      : isRecovery
        ? 'Recovery activity'
        : selectedType === 'Other'
          ? 'Activity name'
          : 'Training activity'

  const activityPlaceholder = isCompetition
    ? 'e.g. Penang Open Championship'
    : isFriendly
      ? 'e.g. Friendly match with club team'
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
              gridTemplateColumns: isTraining ? '1fr 1fr' : '1fr',
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
                  <option>Stamina</option>
                  <option>Speed</option>
                  <option>Strength</option>
                  <option>Flexibility</option>
                  <option>Recovery</option>
                  <option>Matches</option>
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
              fontWeight: 800,
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
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0D1B3E', marginBottom: 8 }}>
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
                  <div style={{ fontSize: 13, fontWeight: 800 }}>
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
                          border:
                            '1px solid #FCA5A5',
                          borderRadius: 9,
                          background: '#FEF2F2',
                          color: '#DC2626',
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '7px 10px',
                          cursor: saving
                            ? 'wait'
                            : 'pointer',
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
            fontWeight: 800,
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
                fontWeight: 800,
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
          fontWeight: 800,
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
              fontWeight: 800,
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
              fontWeight: 800,
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

  const [personalNote, setPersonalNote] = useState('')
  const [draftPersonalNote, setDraftPersonalNote] = useState('')

  const [selectedDate, setSelectedDate] = useState(null)
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
  const trainingTableRef = useRef(null)

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
          coachAssignmentRes,
          coachRelationshipRes,
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
                coach_user_id
              )
            `)
            .eq('player_user_id', user.id),

          supabase
            .from('coach_player_relationships')
            .select('coach_user_id, status')
            .eq('player_user_id', user.id),
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
            })
          })
        )
        setSessions((trainingRes.data || []).map(rowToTraining))
        setTests((testsRes.data || []).map(rowToTest))
        setRecoveryLogs((recoveryRes.data || []).map(rowToRecovery))
        setInjuries((injuryRes.data || []).map(rowToInjury))
        if (assessmentRes.error) {
          console.error('Coach assessment load error:', assessmentRes.error)
          setCoachAssessments([])
        } else {
          setCoachAssessments(assessmentRes.data || [])
        }

        setPersonalNote(noteRes.data?.note || '')
        setDraftPersonalNote(noteRes.data?.note || '')
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

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

  const tirednessLabel = !hasRecoveryData
    ? 'No data'
    : latestRecovery.tiredness <= 3
      ? 'Low'
      : latestRecovery.tiredness <= 6
        ? 'Moderate'
        : 'High'

  const suggestion = hasRecoveryData
    ? recoverySuggestion(
        recoveryScore,
        latestRecovery,
        activeInjuries,
        weeklyMinutes
      )
    : 'Add a recovery check-in to receive a recovery suggestion.'

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
    setScheduleForm(emptySchedule(date || selectedDate || todayISO()))
    setShowSchedule(true)
  }

  const openEditSchedule = row => {
    setEditingSchedule(row)
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
      focus: row.focus || 'Stamina',
      venue: row.venue || '',
      notes: row.notes || '',
    })
  }

  const saveSchedule = async () => {
    if (saving) return

    if (!scheduleForm.date || !scheduleForm.type) {
      setLoadError('Please select the date and type.')
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
        setLoadError('The scheduled duration must be longer than 0 minutes.')
        return
      }
    }

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()
      const isTraining = scheduleForm.type === 'Training'

      const payload = {
        user_id: uid,
        event_date: scheduleForm.date,
        event_time: scheduleForm.time || null,
        title: isTraining
          ? scheduleForm.activity.trim()
          : scheduleForm.type,
        location: scheduleForm.venue.trim() || null,
        schedule_type: scheduleForm.type,
        notes: isTraining
          ? encodeScheduleNotes({
              notes: scheduleForm.notes.trim(),
              endTime: scheduleForm.endTime,
              focus: scheduleForm.focus,
              activity: scheduleForm.activity.trim(),
              status:
                editingSchedule?.scheduleStatus ||
                'scheduled',
            })
          : scheduleForm.notes.trim() || null,
      }

      const q = editingSchedule
        ? supabase.from('player_schedule').update(payload).eq('id', editingSchedule.id).eq('user_id', uid)
        : supabase.from('player_schedule').insert(payload)

      const { data, error } = await q.select('*').single()
      if (error) throw error

      const item = rowToSchedule(data)
      setScheduleList(prev => [...prev.filter(s => s.id !== item.id), item].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date)
        if (dateCompare !== 0) return dateCompare
        return String(a.time || '').localeCompare(String(b.time || ''))
      }))

      setShowSchedule(false)
      setEditingSchedule(null)
      setScheduleForm(emptySchedule())
    } catch (err) {
      setLoadError(err.message || 'Failed to save schedule.')
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
          focus: item.focus || 'Stamina',
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
        focus: item.focus || 'Stamina',
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
        focus: item.focus || 'Stamina',
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

//  const openAddTraining = date => {
  //  setCompletingSchedule(null)
  //  setTrainingForm(emptyTraining(date || todayISO()))
  //  setShowTraining(true)
 // }

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
      focus: row.focus || 'Stamina',
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
      notes: row.notes,
      bodyX: row.bodyX ?? null,
      bodyY: row.bodyY ?? null,
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
        resting_hr: Number(recoveryForm.hr),
        notes: recoveryForm.notes.trim(),
        updated_at: new Date().toISOString(),
      }

      const q = editingRecovery
        ? supabase.from('fitness_recovery_logs').update(payload).eq('id', editingRecovery.id).eq('user_id', uid)
        : supabase.from('fitness_recovery_logs').insert(payload)

      const { data, error } = await q.select('*').single()
      if (error) throw error

      const item = rowToRecovery(data)
      setRecoveryLogs(prev => [...prev.filter(r => r.id !== item.id), item].sort((a, b) => a.date.localeCompare(b.date)))

      setShowRecovery(false)
      setEditingRecovery(null)
      setRecoveryForm(emptyRecovery())
    } catch (err) {
      setLoadError(err.message || 'Failed to save recovery check-in.')
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

    try {
      const uid = await getUserId()

      const payload = {
        user_id: uid,
        injury_date: injuryForm.date,
        injury_description: injuryForm.name.trim(),
        status: injuryForm.status,
        notes: encodeInjuryNotes({
          notes: injuryForm.notes.trim(),
          bodyX: injuryForm.bodyX,
          bodyY: injuryForm.bodyY,
        }),
        updated_at: new Date().toISOString(),
      }

      const q = editingInjury
        ? supabase.from('fitness_injuries').update(payload).eq('id', editingInjury.id).eq('user_id', uid)
        : supabase.from('fitness_injuries').insert(payload)

      const { data, error } = await q.select('*').single()
      if (error) throw error

      const item = rowToInjury(data)
      setInjuries(prev => [item, ...prev.filter(i => i.id !== item.id)])

      setShowInjury(false)
      setEditingInjury(null)
      setInjuryForm(emptyInjury())
    } catch (err) {
      setLoadError(err.message || 'Failed to save injury.')
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
      const { error } = await supabase.from('fitness_injuries').delete().eq('id', editingInjury.id).eq('user_id', uid)
      if (error) throw error

      setInjuries(prev => prev.filter(i => i.id !== editingInjury.id))
      setEditingInjury(null)
      setInjuryForm(emptyInjury())
    } catch (err) {
      setLoadError(err.message || 'Failed to delete injury.')
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
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select('*')
        .single()

      if (error) throw error

      setPersonalNote(data.note || '')
      setDraftPersonalNote(data.note || '')
    } catch (err) {
      setLoadError(err.message || 'Failed to save note.')
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
      `Active injuries: ${activeInjuries}`,
      `Suggestion: ${suggestion}`,
      '',
      'Personal Note:',
      personalNote || draftPersonalNote || '-',
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
    <div>
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

      {(saving || loadError) && (
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
            fontWeight: 800,
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
        className={`${styles.g4} fitness-mobile-metrics`}
        style={{ marginBottom: 16 }}
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
                  fontWeight: 800,
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
                background: '#DDF8EF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginBottom: 10,
              }}
            >
              <FitnessIcon type="heart" color="#00C48C" size={18} />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 4,
              }}
            >
              <div
                className={styles.metricVal}
                style={{
                  color: '#00C48C',
                  WebkitTextFillColor: '#00C48C',
                }}
              >
                {latestRecovery?.hr || '-'}
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted, #8892A4)',
                  fontWeight: 600,
                }}
              >
                bpm
              </span>
            </div>

            <div className={styles.metricLbl}>Resting heart rate</div>
            <div
              style={{
                marginTop: 5,
                fontSize: 11,
                fontWeight: 500,
                color: '#00C48C',
              }}
            >
              from recovery check-in
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
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 4,
              }}
            >
              <div
                className={styles.metricVal}
                style={{
                  color: '#1A5FFF',
                  WebkitTextFillColor: '#1A5FFF',
                }}
              >
                {weeklyHours}
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted, #8892A4)',
                  fontWeight: 600,
                }}
              >
                h
              </span>
            </div>

            <div className={styles.metricLbl}>Weekly training load</div>
            <div
              style={{
                marginTop: 5,
                fontSize: 11,
                fontWeight: 500,
                color: weeklyMinutes > 0 ? '#00C48C' : '#8892A4',
              }}
            >
              {weeklyMinutes > 0
                ? 'from this week’s training log'
                : 'no training logged this week'}
            </div>
          </div>
        </div>

        <div className={styles.metric}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              height: '100%',
            }}
          >
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
                <FitnessIcon type="recovery" color="#10B981" size={18} />
              </div>

              <div
                className={styles.metricVal}
                style={{
                  color:
                    !hasRecoveryData
                      ? '#8892A4'
                      : recoveryScore >= 75
                        ? '#10B981'
                        : recoveryScore >= 55
                          ? '#F59E0B'
                          : '#EF4444',
                  WebkitTextFillColor:
                    !hasRecoveryData
                      ? '#8892A4'
                      : recoveryScore >= 75
                        ? '#10B981'
                        : recoveryScore >= 55
                          ? '#F59E0B'
                          : '#EF4444',
                }}
              >
                {recoveryStatus}
              </div>

              <div className={styles.metricLbl}>Recovery status</div>
              <div
                style={{
                  marginTop: 5,
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--text-muted, #8892A4)',
                }}
              >
                Tiredness: {tirednessLabel}
              </div>
            </div>

            <ProgressRing value={recoveryScore} />
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
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div
              className={styles.cardTitle}
              style={{ marginBottom: 0 }}
            >
              Schedule Calendar
            </div>

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

        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>Fitness Indicators</div>
            <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={openAddTest}>Update</button>
          </div>

          {indicators.map(item => {
            const latestCoachAssessment = coachAssessments[0] || null
            const coachKey = item.name.toLowerCase()

            return (
              <FitnessComparisonRow
                key={item.name}
                label={item.name}
                playerValue={item.val}
                coachValue={latestCoachAssessment?.[coachKey]}
              />
            )
          })}

          <div style={{ fontSize: 12, color: '#8892A4', marginTop: 8 }}>
            Player values come from training logs, fitness tests, recovery check-ins and injury status. A purple marker shows the coach assessment only when it is different.
          </div>

          {coachAssessments[0]?.fitness_comment && (
            <div
              style={{
                marginTop: 14,
                padding: '12px 14px',
                borderRadius: 12,
                background:
                  'color-mix(in srgb, #7C3AED 8%, var(--soft, #F6F8FF))',
                border:
                  '1px solid color-mix(in srgb, #7C3AED 18%, var(--line, #EEF1F8))',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 7,
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#7C3AED',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                  }}
                >
                  Coach fitness feedback
                </div>

                {coachAssessments[0]?.updated_at && (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-muted, #8892A4)',
                    }}
                  >
                    {new Date(
                      coachAssessments[0].updated_at
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
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: 'var(--text, #0D1B3E)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {coachAssessments[0].fitness_comment}
              </div>
            </div>
          )}
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

          <textarea
            className={styles.formTextarea}
            placeholder="e.g. Need to improve footwork and reduce tiredness this week."
            value={draftPersonalNote}
            onChange={event =>
              setDraftPersonalNote(event.target.value)
            }
            style={{ minHeight: 105 }}
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
            <div style={{ fontSize: 11, color: '#8892A4' }}>
              Use this to write your own fitness reminder.
            </div>

            <button
              className={styles.btnPrimary}
              onClick={savePersonalNote}
              disabled={saving}
            >
              Save Note
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Quick Summary</div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Scheduled events</span>
            <span className={styles.statVal}>{scheduleList.length}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Completed training records</span>
            <span className={styles.statVal}>{sessions.length}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Fitness tests</span>
            <span className={styles.statVal}>{tests.length}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Active injuries</span>
            <span className={styles.statVal}>{activeInjuries}</span>
          </div>
        </div>
      </div>

      <div
        className="fitness-mobile-three-column"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.65fr 0.9fr 0.9fr',
          gap: 16,
          marginBottom: 16,
          alignItems: 'stretch',
        }}
      >
        <div
          className={styles.card}
          style={{
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ marginBottom: 14 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 4 }}>
              Training Log
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted, #8892A4)',
              }}
            >
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
                  fontWeight: 800,
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
                maxHeight: 430,
                overflowY:
                  tableSessions.length > 7
                    ? 'auto'
                    : 'visible',
                overflowX: 'visible',
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
                      if (
                        t.sourceType === 'schedule' &&
                        t.original?.source !== 'coach_training'
                      ) {
                        openEditSchedule(t.original)
                      } else if (t.sourceType === 'training') {
                        openEditTraining(t.original)
                      }
                    }}
                    style={{
                      cursor:
                        t.sourceType === 'schedule' &&
                        t.original?.source === 'coach_training'
                          ? 'default'
                          : 'pointer',
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
                      <div
                        style={{
                          fontSize: 11,
                          color: '#8892A4',
                        }}
                      >
                        {new Date(
                          `${t.date}T00:00:00`
                        ).toLocaleDateString('en-MY', {
                          weekday: 'short',
                        })}
                      </div>
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: '#8892A4',
                        fontWeight: 700,
                      }}
                    >
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
            height: '100%',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>Fitness Test Records</div>
            <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={openAddTest}>Add</button>
          </div>

          {tests.length === 0 && <div style={{ padding: '18px 0', color: '#8892A4', fontSize: 12 }}>No fitness test saved yet.</div>}

          {tests.slice(0, 7).map(test => (
            <div
              key={test.id}
              className={styles.listRow}
              onClick={() => openEditTest(test)}
              style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 75px 65px 20px', gap: 10, alignItems: 'center' }}
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

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            height: '100%',
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

                {injuries.slice(0, 3).map(injury => (
                  <div key={injury.id} className={styles.listRow} onClick={() => openEditInjury(injury)} style={{ cursor: 'pointer', borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{injury.name}</div>
                      <div style={{ fontSize: 11, color: '#8892A4' }}>{fmtDate(injury.date)}</div>
                    </div>
                    <span className={getBadgeClass(injury.color)}>{injury.status}</span>
                  </div>
                ))}
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

      {showSchedule && (
        <ScheduleModal
          title="Add Schedule"
          form={scheduleForm}
          onChange={setForm(setScheduleForm)}
          onSave={saveSchedule}
          onClose={() => { setShowSchedule(false); setScheduleForm(emptySchedule()) }}
          saving={saving}
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
          }}
          onDelete={requestDeleteSchedule}
          scheduleItem={editingSchedule}
          canChangeStatus={isScheduleFinished(editingSchedule)}
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