import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import styles from './Pages.module.css'

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const INTENSITY_COLOR = {
  High: 'red',
  Medium: 'amber',
  Low: 'green',
  Rest: 'gray',
}

const DOT_COLORS = {
  High: '#EF4444',
  Medium: '#F59E0B',
  Low: '#00C48C',
  Rest: '#C8D0E0',
}

const SCHEDULE_COLORS = {
  Training: '#1A5FFF',
  Competition: '#F59E0B',
  'Friendly Match': '#00C48C',
  'Rest Day': '#C8D0E0',
  Recovery: '#10B981',
  Other: '#8B5CF6',
  'Training Log': '#1A5FFF',
}

const SCHEDULE_BADGE = {
  Training: 'blue',
  Competition: 'amber',
  'Friendly Match': 'green',
  'Rest Day': 'gray',
  Recovery: 'green',
  Other: 'purple',
  'Training Log': 'blue',
}

const INDICATOR_COLORS = {
  Stamina: '#00C48C',
  Speed: '#1A5FFF',
  Strength: '#8B5CF6',
  Flexibility: '#F59E0B',
  Recovery: '#10B981',
}

const todayISO = () => new Date().toISOString().split('T')[0]
const toKey = d => d?.slice(0, 10)
const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number(n) || 0))
const parseMinutes = d => (String(d || '').match(/\d+/) ? Number(String(d).match(/\d+/)[0]) : 0)

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

function fmtTimeRange(start, end) {
  if (!start && !end) return '-'
  if (start && end) return `${fmtTime(start)} - ${fmtTime(end)}`
  return fmtTime(start || end)
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


function getThisWeekDates() {
  const today = new Date()
  const day = today.getDay()

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - day + i)
    return d.toISOString().split('T')[0]
  })
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
  type: 'Training',
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
    color: 'blue',
    source: 'training_log',
    type: 'Training Log',
    title: row.activity || 'Training Log',
    venue: '',
    time: fmtTimeRange(row.start_time, row.end_time),
    dotColor: SCHEDULE_COLORS['Training Log'],
  }
}


function rowToSchedule(row) {
  const type = row.schedule_type || row.title || 'Friendly Match'

  return {
    id: row.id,
    date: row.event_date,
    time: row.event_time || '',
    type,
    title: row.title || type,
    venue: row.location || '',
    notes: row.notes || '',
    color: SCHEDULE_BADGE[type] || 'purple',
    source: 'schedule',
    dotColor: SCHEDULE_COLORS[type] || '#8B5CF6',
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

  return {
    id: row.id,
    name: row.injury_description || '',
    date: row.injury_date,
    status,
    notes: row.notes || '',
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

function ScoreRing({ value }) {
  const r = 31
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  const ringColor = value >= 70 ? '#00C48C' : value >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <svg width="82" height="82" viewBox="0 0 82 82">
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
    <svg width="92" height="92" viewBox="0 0 92 92">
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
    if (lower.includes('chest')) return { cx: 60, cy: 53, color: '#EF4444' }
    if (lower.includes('hip')) return { cx: 60, cy: 96, color: '#F59E0B' }

    if (lower.includes('right') && lower.includes('shoulder')) return { cx: 82, cy: 48, color: '#1A5FFF' }
    if (lower.includes('left') && lower.includes('shoulder')) return { cx: 38, cy: 48, color: '#1A5FFF' }

    if (lower.includes('right') && lower.includes('knee')) return { cx: 70, cy: 124, color: '#F59E0B' }
    if (lower.includes('left') && lower.includes('knee')) return { cx: 50, cy: 124, color: '#F59E0B' }

    if (lower.includes('right') && lower.includes('ankle')) return { cx: 72, cy: 150, color: '#EF4444' }
    if (lower.includes('left') && lower.includes('ankle')) return { cx: 48, cy: 150, color: '#EF4444' }

    if (lower.includes('shoulder')) return { cx: 82, cy: 48, color: '#1A5FFF' }
    if (lower.includes('knee')) return { cx: 70, cy: 124, color: '#F59E0B' }
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
    <div style={{ width: 118, height: 170, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg viewBox="0 0 120 170" width="110" height="160">
        <g fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="60" cy="15" r="10" />
          <path d="M54 25 L54 33" />
          <path d="M66 25 L66 33" />
          <path d="M45 35 C50 31, 70 31, 75 35" />
          <path d="M46 36 C43 52, 42 72, 45 91" />
          <path d="M74 36 C77 52, 78 72, 75 91" />
          <path d="M45 91 C50 97, 55 100, 60 100" />
          <path d="M75 91 C70 97, 65 100, 60 100" />
          <path d="M60 35 L60 100" opacity="0.45" />
          <path d="M45 38 C34 50, 29 72, 25 96" />
          <path d="M75 38 C86 50, 91 72, 95 96" />
          <path d="M54 100 C51 116, 48 132, 45 152" />
          <path d="M45 152 L36 154" />
          <path d="M66 100 C69 116, 72 132, 75 152" />
          <path d="M75 152 L84 154" />
        </g>

        {injuries.slice(0, 3).map(injury => {
          const dot = getDot(injury.name)
          return (
            <g key={injury.id}>
              <circle cx={dot.cx} cy={dot.cy} r="7" fill="white" />
              <circle cx={dot.cx} cy={dot.cy} r="5" fill={dot.color} />
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
          <input className={styles.formInput} type="time" value={form.startTime} onChange={e => onChange('startTime', e.target.value)} />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>End time</label>
          <input className={styles.formInput} type="time" value={form.endTime} onChange={e => onChange('endTime', e.target.value)} />
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
        <label className={styles.formLabel}>Duration auto calculated</label>
        <input
          className={styles.formInput}
          value={calculateDuration(form.startTime, form.endTime) || 'Select start and end time'}
          readOnly
          style={{ background: '#F8FAFC', color: calculateDuration(form.startTime, form.endTime) ? '#0D1B3E' : '#8892A4' }}
        />
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

function InjuryModal({ title, form, onChange, onSave, onClose, onDelete, saving }) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <div className={styles.formRow}>
        <label className={styles.formLabel}>Injury description</label>
        <input className={styles.formInput} placeholder="e.g. Neck pain, left knee pain" value={form.name} onChange={e => onChange('name', e.target.value)} />
      </div>

      <div className={styles.g2} style={{ marginBottom: 0 }}>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Date</label>
          <input className={styles.formInput} type="date" value={form.date} onChange={e => onChange('date', e.target.value)} />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Status</label>
          <select className={styles.formSelect} value={form.status} onChange={e => onChange('status', e.target.value)}>
            <option>Monitoring</option>
            <option>Recovering</option>
            <option>Recovered</option>
          </select>
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Notes</label>
        <textarea className={styles.formTextarea} placeholder="e.g. Light stretching only" value={form.notes} onChange={e => onChange('notes', e.target.value)} />
      </div>

      <FormActions onSave={onSave} onClose={onClose} onDelete={onDelete} saving={saving} />
    </ModalShell>
  )
}


function ScheduleModal({ title, form, onChange, onSave, onClose, onDelete, saving }) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Date</label>
          <input className={styles.formInput} type="date" value={form.date} onChange={e => onChange('date', e.target.value)} />
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Time</label>
          <input className={styles.formInput} type="time" value={form.time} onChange={e => onChange('time', e.target.value)} />
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Type</label>
        <select className={styles.formSelect} value={form.type} onChange={e => onChange('type', e.target.value)}>
          <option>Training</option>
          <option>Competition</option>
          <option>Friendly Match</option>
          <option>Rest Day</option>
          <option>Recovery</option>
          <option>Other</option>
        </select>
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Venue</label>
        <input className={styles.formInput} placeholder="e.g. Sports Arena" value={form.venue} onChange={e => onChange('venue', e.target.value)} />
      </div>

      <div className={styles.formRow}>
        <label className={styles.formLabel}>Notes optional</label>
        <textarea className={styles.formTextarea} placeholder="e.g. Bring extra racket, warm up early" value={form.notes} onChange={e => onChange('notes', e.target.value)} />
      </div>

      <FormActions onSave={onSave} onClose={onClose} onDelete={onDelete} saving={saving} />
    </ModalShell>
  )
}


function ScheduleCalendar({ schedules, selectedDate, onDayClick, onEditSchedule, onEditTraining }) {
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
    if (item.source === 'training_log') onEditTraining(item)
    else onEditSchedule(item)
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
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#8892A4' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            {label}
          </span>
        ))}
      </div>

      {selectedDate && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #E8EEF8' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0D1B3E', marginBottom: 8 }}>
            {fmtDate(selectedDate)} schedule and training log
          </div>

          {selectedItems.length === 0 ? (
            <div style={{ fontSize: 12, color: '#8892A4' }}>No schedule or training log for this date.</div>
          ) : selectedItems.map(item => (
            <div key={`${item.source}-${item.id}`} className={styles.listRow} onClick={() => handleEdit(item)} style={{ cursor: 'pointer', borderRadius: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>
                  {item.source === 'training_log' ? item.activity || 'Training Log' : item.type}
                </div>
                <div style={{ fontSize: 11, color: '#8892A4' }}>
                  {item.source === 'training_log'
                    ? `${fmtTimeRange(item.startTime, item.endTime)} · ${item.duration || '-'} · ${item.focus || '-'}`
                    : `${item.time ? item.time.slice(0, 5) : 'No time'}${item.venue ? ` · ${item.venue}` : ''}`}
                </div>
              </div>
              <span className={getBadgeClass(item.color)}>{item.source === 'training_log' ? 'Training Log' : item.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Fitness() {
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [sessions, setSessions] = useState([])
  const [scheduleList, setScheduleList] = useState([])
  const [tests, setTests] = useState([])
  const [recoveryLogs, setRecoveryLogs] = useState([])
  const [injuries, setInjuries] = useState([])

  const [personalNote, setPersonalNote] = useState('')
  const [draftPersonalNote, setDraftPersonalNote] = useState('')

  const [selectedDate, setSelectedDate] = useState(null)
  const [filter, setFilter] = useState({ focus: 'All' })

  const [showSchedule, setShowSchedule] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [showTraining, setShowTraining] = useState(false)
  const [editingTraining, setEditingTraining] = useState(null)
  const [showTest, setShowTest] = useState(false)
  const [editingTest, setEditingTest] = useState(null)
  const [showRecovery, setShowRecovery] = useState(false)
  const [editingRecovery, setEditingRecovery] = useState(null)
  const [showInjury, setShowInjury] = useState(false)
  const [editingInjury, setEditingInjury] = useState(null)

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

        const [scheduleRes, trainingRes, testsRes, recoveryRes, injuryRes, noteRes] = await Promise.all([
          supabase.from('player_schedule').select('*').eq('user_id', user.id).order('event_date', { ascending: true }).order('event_time', { ascending: true }),
          supabase.from('fitness_training_logs').select('*').eq('user_id', user.id).order('training_date', { ascending: true }),
          supabase.from('fitness_tests').select('*').eq('user_id', user.id).order('test_date', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('fitness_recovery_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: true }).order('created_at', { ascending: true }),
          supabase.from('fitness_injuries').select('*').eq('user_id', user.id).order('injury_date', { ascending: false }).order('created_at', { ascending: false }),
          supabase.from('fitness_coach_notes').select('*').eq('user_id', user.id).maybeSingle(),
        ])

        const error = [scheduleRes.error, trainingRes.error, testsRes.error, recoveryRes.error, injuryRes.error, noteRes.error].find(Boolean)
        if (error) throw error
        if (!alive) return

        setScheduleList((scheduleRes.data || []).map(rowToSchedule))
        setSessions((trainingRes.data || []).map(rowToTraining))
        setTests((testsRes.data || []).map(rowToTest))
        setRecoveryLogs((recoveryRes.data || []).map(rowToRecovery))
        setInjuries((injuryRes.data || []).map(rowToInjury))

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
  }, [])

  const getUserId = async () => {
    if (userId) return userId

    const { data, error } = await supabase.auth.getUser()
    if (error) throw error
    if (!data?.user) throw new Error('Please log in first.')

    setUserId(data.user.id)
    return data.user.id
  }

  const latestRecovery = useMemo(() => {
    return [...recoveryLogs].sort((a, b) => a.date.localeCompare(b.date)).at(-1) || null
  }, [recoveryLogs])

  const weeklyMinutes = useMemo(() => {
    return sessions
      .filter(s => getThisWeekDates().includes(toKey(s.date)) && s.intensity !== 'Rest')
      .reduce((sum, s) => sum + parseMinutes(s.duration), 0)
  }, [sessions])

  const weeklyHours = Number((weeklyMinutes / 60).toFixed(1))
  const activeInjuries = injuries.filter(i => i.status !== 'Recovered').length

  const indicators = useMemo(() => {
    const latestScore = indicator => tests.find(t => t.indicator === indicator)?.score ?? null

    const recoveryBase = latestRecovery
      ? clamp(100 - latestRecovery.tiredness * 8 - latestRecovery.muscleAche * 5 + Math.min(8, latestRecovery.sleep) - activeInjuries * 5)
      : 50

    return [
      { name: 'Stamina', val: Math.round(latestScore('Stamina') ?? (sessions.length ? clamp(50 + Math.min(22, weeklyMinutes / 25)) : 50)) },
      { name: 'Speed', val: Math.round(latestScore('Speed') ?? 50) },
      { name: 'Strength', val: Math.round(latestScore('Strength') ?? 50) },
      { name: 'Flexibility', val: Math.round(latestScore('Flexibility') ?? 50), low: (latestScore('Flexibility') ?? 50) < 65 },
      { name: 'Recovery', val: Math.round(recoveryBase), low: recoveryBase < 65 },
    ]
  }, [tests, sessions.length, weeklyMinutes, latestRecovery, activeInjuries])

  const fitnessScore = Math.round(indicators.reduce((sum, i) => sum + i.val, 0) / indicators.length)
  const recoveryScore = indicators.find(i => i.name === 'Recovery')?.val || 50
  const recoveryStatus = recoveryScore >= 75 ? 'Good' : recoveryScore >= 55 ? 'Moderate' : 'Needs Rest'
  const tirednessLabel = latestRecovery ? latestRecovery.tiredness <= 3 ? 'Low' : latestRecovery.tiredness <= 6 ? 'Moderate' : 'High' : 'No data'
  const suggestion = recoverySuggestion(recoveryScore, latestRecovery, activeInjuries, weeklyMinutes)

  const tableSessions = useMemo(() => {
    return [...sessions]
      .filter(s => filter.focus === 'All' || s.focus === filter.focus)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [sessions, filter])

  const calendarItems = useMemo(() => {
    return [
      ...scheduleList,
      ...sessions.map(session => ({
        ...session,
        source: 'training_log',
        type: 'Training Log',
        title: session.activity || 'Training Log',
        dotColor: SCHEDULE_COLORS['Training Log'],
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
      type: row.type || 'Training',
      venue: row.venue || '',
      notes: row.notes || '',
    })
  }

  const saveSchedule = async () => {
    if (saving) return
    if (!scheduleForm.date || !scheduleForm.type) return

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()
      const payload = {
        user_id: uid,
        event_date: scheduleForm.date,
        event_time: scheduleForm.time || null,
        title: scheduleForm.type,
        location: scheduleForm.venue.trim() || null,
        schedule_type: scheduleForm.type,
        notes: scheduleForm.notes.trim() || null,
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

  const openAddTraining = date => {
    setTrainingForm(emptyTraining(date || todayISO()))
    setShowTraining(true)
  }

  const openEditTraining = row => {
    setEditingTraining(row)
    setTrainingForm({
      date: row.date,
      startTime: row.startTime || '',
      endTime: row.endTime || '',
      activity: row.activity || '',
      duration: row.duration || '',
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
    })
  }

  const saveTraining = async () => {
    if (saving) return
    if (!trainingForm.activity.trim()) return

    setSaving(true)
    setLoadError('')

    try {
      const uid = await getUserId()

      const payload = {
        user_id: uid,
        training_date: trainingForm.date,
        start_time: trainingForm.startTime || null,
        end_time: trainingForm.endTime || null,
        activity: trainingForm.activity.trim(),
        duration: calculateDuration(trainingForm.startTime, trainingForm.endTime),
        intensity: 'Medium',
        focus: trainingForm.focus,
        notes: trainingForm.notes.trim(),
        updated_at: new Date().toISOString(),
      }

      const q = editingTraining
        ? supabase.from('fitness_training_logs').update(payload).eq('id', editingTraining.id).eq('user_id', uid)
        : supabase.from('fitness_training_logs').upsert(payload, { onConflict: 'user_id,training_date' })

      const { data, error } = await q.select('*').single()
      if (error) throw error

      const item = rowToTraining(data)

      setSessions(prev => [
        ...prev.filter(s => s.id !== item.id && toKey(s.date) !== toKey(item.date)),
        item,
      ].sort((a, b) => a.date.localeCompare(b.date)))

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
        notes: injuryForm.notes.trim(),
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

  return (
    <div>
      <div className={styles.pageHead}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div className={styles.pageTitle}>Fitness</div>
            <div className={styles.pageSub}>Plan your schedule, track completed training, fitness tests, recovery and injuries.</div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className={styles.btnPrimary} onClick={() => openAddSchedule()}>+ Add Schedule</button>
            <button className={styles.btnPrimary} style={{ background: '#10B981' }} onClick={openAddTest}>+ Fitness Test</button>
            <button className={styles.btnPrimary} style={{ background: '#7C3AED' }} onClick={openAddRecovery}>+ Recovery Check-in</button>
            <button className={styles.btnOutline} onClick={openAddInjury}>+ Log Injury</button>
          </div>
        </div>
      </div>

      {(loading || saving || loadError) && (
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
          {loadError || (saving ? 'Saving record...' : 'Loading saved fitness records...')}
        </div>
      )}

      <div className={styles.g4} style={{ marginBottom: 16 }}>
        <div className={styles.metricHighlight}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div className={styles.metricIcon} style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}>⏱</div>
              <div style={{ display: 'flex', alignItems: 'end', gap: 6, marginTop: 8 }}>
                <div className={styles.metricVal} style={{ color: '#fff' }}>{fitnessScore}</div>
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
            <div className={styles.metricIcon} style={{ background: '#E0FAF3' }}>↯</div>
            <div className={styles.metricVal} style={{ color: '#00C48C' }}>
              {latestRecovery?.hr || '-'}
              <span style={{ fontSize: 14, color: '#0D1B3E', marginLeft: 4 }}>bpm</span>
            </div>
            <div className={styles.metricLbl}>Resting heart rate</div>
            <div className={styles.deltaUp}>from recovery check-in</div>
          </div>
        </div>

        <div className={styles.metric}>
          <div>
            <div className={styles.metricIcon} style={{ background: '#FEF2F2' }}>⏱</div>
            <div className={styles.metricVal} style={{ color: '#0D1B3E' }}>
              {weeklyHours}
              <span style={{ fontSize: 14, marginLeft: 4 }}>h</span>
            </div>
            <div className={styles.metricLbl}>Weekly training load</div>
            <div className={styles.deltaUp}>from training log</div>
          </div>
        </div>

        <div className={styles.metric}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div className={styles.metricIcon} style={{ background: '#E0FAF3' }}>♡</div>
              <div className={styles.metricVal} style={{ color: recoveryScore >= 75 ? '#10B981' : '#F59E0B' }}>{recoveryStatus}</div>
              <div className={styles.metricLbl}>Recovery status</div>
              <div style={{ fontSize: 12, color: '#8892A4', marginTop: 5 }}>Tiredness: {tirednessLabel}</div>
            </div>
            <ProgressRing value={recoveryScore} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.15fr', gap: 16, marginBottom: 16 }}>
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>Schedule Calendar</div>
            <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => openAddSchedule(selectedDate)}>+ Add</button>
          </div>

          <ScheduleCalendar
            schedules={calendarItems}
            selectedDate={selectedDate}
            onDayClick={key => setSelectedDate(selectedDate === key ? null : key)}
            onEditSchedule={openEditSchedule}
            onEditTraining={openEditTraining}
          />
        </div>

        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>Fitness Indicators</div>
            <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={openAddTest}>Update</button>
          </div>

          {indicators.map(item => (
            <div key={item.name} className={styles.skillRow} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 130 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    background: `${INDICATOR_COLORS[item.name]}18`,
                    color: INDICATOR_COLORS[item.name],
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {item.name[0]}
                </div>
                <div className={styles.skillLbl} style={{ width: 'auto' }}>{item.name}</div>
              </div>

              <div className={styles.skillTrack}>
                <div
                  className={styles.skillFill}
                  style={{
                    width: `${item.val}%`,
                    background: item.low ? 'linear-gradient(90deg,#F59E0B,#FBBF24)' : 'linear-gradient(90deg,#1A5FFF,#3B7BFF)',
                  }}
                />
              </div>

              <div className={styles.skillVal} style={{ color: item.low ? '#F59E0B' : '#0D1B3E', width: 55 }}>
                {item.val}
                <span style={{ color: '#8892A4', fontWeight: 500 }}> /100</span>
              </div>
            </div>
          ))}

          <div style={{ fontSize: 12, color: '#8892A4', marginTop: 8 }}>
            Indicators are updated from training logs, fitness tests, recovery check-ins and injury status.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Recovery Suggestion</div>
          <div className={styles.recoveryText}>{suggestion}</div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#8892A4' }}>
            Based on recovery score, tiredness, muscle ache, weekly load and injury status.
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Quick Summary</div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Scheduled events</span>
            <span className={styles.statVal}>{scheduleList.length}</span>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>Training records</span>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 0.9fr', gap: 16, marginBottom: 16 }}>
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>Training Log</div>
            <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => openAddTraining()}>+ Add</button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <select className={styles.formSelect} value={filter.focus} onChange={e => setFilter(f => ({ ...f, focus: e.target.value }))}>
              <option>All</option>
              <option>Stamina</option>
              <option>Speed</option>
              <option>Strength</option>
              <option>Flexibility</option>
              <option>Recovery</option>
              <option>Matches</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '70px 95px 1fr 80px 80px 30px', gap: 10, padding: '0 8px 8px', color: '#8892A4', fontSize: 11, fontWeight: 700 }}>
            <div>Date</div>
            <div>Time</div>
            <div>Training</div>
            <div>Duration</div>
            <div>Focus</div>
            <div />
          </div>

          {tableSessions.length === 0 && <div style={{ padding: '18px 8px', color: '#8892A4', fontSize: 12 }}>No training records yet.</div>}

          {tableSessions.slice(0, 7).map(t => (
            <div
              key={t.id}
              className={styles.listRow}
              onClick={() => openEditTraining(t)}
              style={{ cursor: 'pointer', display: 'grid', gridTemplateColumns: '70px 95px 1fr 80px 80px 30px', gap: 10, alignItems: 'center', borderRadius: 8 }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0D1B3E' }}>
                  {new Date(t.date + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}
                </div>
                <div style={{ fontSize: 11, color: '#8892A4' }}>{t.day}</div>
              </div>

              <div style={{ fontSize: 12, color: '#8892A4', fontWeight: 700 }}>{fmtTimeRange(t.startTime, t.endTime)}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t.activity}</div>
              <div style={{ fontSize: 12, color: '#8892A4' }}>{t.duration || '-'}</div>
              <div style={{ fontSize: 12, color: '#0D1B3E', fontWeight: 600 }}>{t.focus || '-'}</div>
              {pencilIcon}
            </div>
          ))}
        </div>

        <div className={styles.card}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              { label: 'Recovery Score', val: `${recoveryScore} /100`, badge: recoveryStatus, color: recoveryScore >= 75 ? 'green' : recoveryScore >= 55 ? 'amber' : 'red' },
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
              <div style={{ flex: 1, minWidth: 0 }}>
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

      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className={styles.cardTitle} style={{ marginBottom: 0 }}>Personal Note</div>
          <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={exportReport}>Export Report</button>
        </div>

        <textarea
          className={styles.formTextarea}
          placeholder="e.g. Need to improve footwork and reduce tiredness this week."
          value={draftPersonalNote}
          onChange={e => setDraftPersonalNote(e.target.value)}
          style={{ minHeight: 130 }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <div style={{ fontSize: 11, color: '#8892A4' }}>Use this to write your own fitness reminder.</div>
          <button className={styles.btnPrimary} onClick={savePersonalNote} disabled={saving}>Save Note</button>
        </div>
      </div>

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
          onClose={() => { setEditingSchedule(null); setScheduleForm(emptySchedule()) }}
          onDelete={deleteSchedule}
          saving={saving}
        />
      )}

      {showTraining && (
        <TrainingModal
          title="Add Training"
          form={trainingForm}
          onChange={setForm(setTrainingForm)}
          onSave={saveTraining}
          onClose={() => { setShowTraining(false); setTrainingForm(emptyTraining()) }}
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
          onDelete={deleteTraining}
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
          onDelete={deleteTest}
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
          onDelete={deleteRecovery}
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
          onDelete={deleteInjury}
          saving={saving}
        />
      )}
    </div>
  )
}