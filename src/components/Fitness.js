import { useMemo, useState } from 'react'
import styles from './Pages.module.css'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa']
const DAY_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

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

const INDICATOR_COLORS = {
  Stamina: '#00C48C',
  Speed: '#1A5FFF',
  Strength: '#8B5CF6',
  Flexibility: '#F59E0B',
  Recovery: '#10B981',
}

const initInjuries = [
  { id: 1, name: 'Right ankle sprain', date: '2026-03-01', status: 'Recovered', notes: '', color: 'green' },
  { id: 2, name: 'Left knee strain', date: '2026-02-15', status: 'Recovered', notes: '', color: 'green' },
  { id: 3, name: 'Right shoulder pain', date: '2026-01-10', status: 'Monitoring', notes: '', color: 'amber' },
]

const initFitnessTests = [
  { id: 1, date: '2026-05-08', test: '20m Sprint', result: '3.35 s', indicator: 'Speed', score: 68, change: '+0.12s' },
  { id: 2, date: '2026-05-08', test: 'Plank Hold', result: '2:10 min', indicator: 'Strength', score: 74, change: '+0:20' },
  { id: 3, date: '2026-05-08', test: 'Push-up Max', result: '38 reps', indicator: 'Strength', score: 74, change: '+3' },
  { id: 4, date: '2026-05-08', test: 'Sit-and-Reach', result: '22 cm', indicator: 'Flexibility', score: 60, change: '+2 cm' },
  { id: 5, date: '2026-05-08', test: 'Yo-Yo Test L1', result: '12.4', indicator: 'Stamina', score: 72, change: '+0.8' },
]

const initRecoveryLogs = [
  { id: 1, date: '2026-05-11', sleep: 7.5, fatigue: 3, soreness: 2, hr: 62, notes: 'Body feels normal.' },
]

const emptyTrainingForm = {
  date: new Date().toISOString().split('T')[0],
  activity: '',
  duration: '',
  intensity: 'Medium',
  focus: 'Stamina',
}

const emptyInjuryForm = {
  name: '',
  date: new Date().toISOString().split('T')[0],
  status: 'Monitoring',
  notes: '',
}

const emptyTestForm = {
  date: new Date().toISOString().split('T')[0],
  test: '',
  result: '',
  indicator: 'Stamina',
  score: 70,
}

const emptyRecoveryForm = {
  date: new Date().toISOString().split('T')[0],
  sleep: 7,
  fatigue: 3,
  soreness: 2,
  hr: 62,
  notes: '',
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function toKey(d) {
  return d?.slice(0, 10)
}

function clamp(n, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(n) || 0))
}

function parseMinutes(duration) {
  if (!duration) return 0
  const match = String(duration).match(/\d+/)
  return match ? Number(match[0]) : 0
}

function fmtDate(d) {
  if (!d) return ''
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

function getThisWeekDates() {
  const today = new Date()
  const day = today.getDay()

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - day + i)
    return d.toISOString().split('T')[0]
  })
}

function isThisWeek(date) {
  return getThisWeekDates().includes(toKey(date))
}

function buildInitSessions() {
  const week = getThisWeekDates()

  const templates = [
    { activity: 'Rest day', duration: '', intensity: 'Rest', focus: 'Recovery' },
    { activity: 'Court training', duration: '90 min', intensity: 'High', focus: 'Matches' },
    { activity: 'Footwork drill', duration: '60 min', intensity: 'Medium', focus: 'Speed' },
    { activity: 'Match practice', duration: '120 min', intensity: 'High', focus: 'Matches' },
    { activity: 'Gym session', duration: '45 min', intensity: 'Medium', focus: 'Strength' },
    { activity: 'Footwork drill', duration: '60 min', intensity: 'Low', focus: 'Speed' },
    { activity: 'Rest day', duration: '', intensity: 'Rest', focus: 'Recovery' },
  ]

  return week.map((date, i) => ({
    id: i + 1,
    date,
    day: DAY_SHORT[new Date(date + 'T00:00:00').getDay()],
    ...templates[i],
    color: INTENSITY_COLOR[templates[i].intensity],
  }))
}

function getBadgeClass(color) {
  if (color === 'red') return styles.badgeRed
  if (color === 'amber') return styles.badgeAmber
  if (color === 'green') return styles.badgeGreen
  return styles.badgeGray
}

function ScoreRing({ value }) {
  const radius = 31
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <svg width="82" height="82" viewBox="0 0 82 82">
      <circle cx="41" cy="41" r={radius} stroke="rgba(255,255,255,0.14)" strokeWidth="8" fill="none" />
      <circle
        cx="41"
        cy="41"
        r={radius}
        stroke="#1A5FFF"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 41 41)"
      />
      <text x="41" y="38" textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff">
        {value}
      </text>
      <text x="41" y="54" textAnchor="middle" fontSize="10" fontWeight="700" fill="rgba(255,255,255,0.7)">
        %
      </text>
    </svg>
  )
}

function ProgressRing({ value }) {
  const radius = 34
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <svg width="92" height="92" viewBox="0 0 92 92">
      <circle cx="46" cy="46" r={radius} stroke="#E8EEF8" strokeWidth="9" fill="none" />
      <circle
        cx="46"
        cy="46"
        r={radius}
        stroke="#10B981"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 46 46)"
      />
      <text x="46" y="50" textAnchor="middle" fontSize="14" fontWeight="800" fill="#0D1B3E">
        {value}%
      </text>
    </svg>
  )
}

function InjuryBodyMap({ injuries }) {
  const getDotPosition = (name) => {
    const lower = name.toLowerCase()

    if (lower.includes('right') && lower.includes('shoulder')) return { cx: 82, cy: 48, color: '#1A5FFF' }
    if (lower.includes('left') && lower.includes('shoulder')) return { cx: 38, cy: 48, color: '#1A5FFF' }

    if (lower.includes('right') && lower.includes('elbow')) return { cx: 88, cy: 76, color: '#F59E0B' }
    if (lower.includes('left') && lower.includes('elbow')) return { cx: 32, cy: 76, color: '#F59E0B' }

    if (lower.includes('right') && lower.includes('wrist')) return { cx: 94, cy: 101, color: '#8B5CF6' }
    if (lower.includes('left') && lower.includes('wrist')) return { cx: 26, cy: 101, color: '#8B5CF6' }

    if (lower.includes('right') && lower.includes('knee')) return { cx: 70, cy: 116, color: '#F59E0B' }
    if (lower.includes('left') && lower.includes('knee')) return { cx: 50, cy: 116, color: '#F59E0B' }

    if (lower.includes('right') && lower.includes('ankle')) return { cx: 72, cy: 146, color: '#EF4444' }
    if (lower.includes('left') && lower.includes('ankle')) return { cx: 48, cy: 146, color: '#EF4444' }

    if (lower.includes('shoulder')) return { cx: 82, cy: 48, color: '#1A5FFF' }
    if (lower.includes('elbow')) return { cx: 88, cy: 76, color: '#F59E0B' }
    if (lower.includes('wrist')) return { cx: 94, cy: 101, color: '#8B5CF6' }
    if (lower.includes('knee')) return { cx: 70, cy: 116, color: '#F59E0B' }
    if (lower.includes('ankle')) return { cx: 72, cy: 146, color: '#EF4444' }

    return { cx: 60, cy: 90, color: '#EF4444' }
  }

  return (
    <div
      style={{
        width: 118,
        height: 170,
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
      }}
    >
      <svg viewBox="0 0 120 170" width="110" height="160">
        <g
          fill="none"
          stroke="#CBD5E1"
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

          <path d="M60 35 L60 100" opacity="0.45" />

          <path d="M45 38 C34 50, 29 72, 25 96" />
          <path d="M41 50 C35 67, 32 84, 30 101" opacity="0.65" />
          <path d="M24 97 C23 102, 26 106, 30 103" />

          <path d="M75 38 C86 50, 91 72, 95 96" />
          <path d="M79 50 C85 67, 88 84, 90 101" opacity="0.65" />
          <path d="M96 97 C97 102, 94 106, 90 103" />

          <path d="M54 100 C51 116, 48 132, 45 152" />
          <path d="M45 152 L36 154" />

          <path d="M66 100 C69 116, 72 132, 75 152" />
          <path d="M75 152 L84 154" />

          <path d="M60 101 C57 119, 55 136, 53 151" opacity="0.5" />
          <path d="M60 101 C63 119, 65 136, 67 151" opacity="0.5" />
        </g>

        {injuries.map(inj => {
          const dot = getDotPosition(inj.name)

          return (
            <g key={inj.id}>
              <circle cx={dot.cx} cy={dot.cy} r="7" fill="white" />
              <circle cx={dot.cx} cy={dot.cy} r="5" fill={dot.color} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function TrainingModal({ title, form, onChange, onSave, onClose, onDelete }) {
  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 520 }}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>{title}</div>
          <button className={styles.modalClose} onClick={onClose}>x</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Date</label>
            <input className={styles.formInput} type="date" value={form.date} onChange={e => onChange('date', e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>Intensity</label>
            <select className={styles.formSelect} value={form.intensity} onChange={e => onChange('intensity', e.target.value)}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Rest</option>
            </select>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Duration</label>
            <input className={styles.formInput} placeholder="e.g. 90 min" value={form.duration} onChange={e => onChange('duration', e.target.value)} />
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

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {onDelete ? (
            <button
              onClick={onDelete}
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
            <button className={styles.btnOutline} onClick={onClose}>Cancel</button>
            <button className={styles.btnPrimary} onClick={onSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FitnessTestModal({ form, onChange, onSave, onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 520 }}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>Add Fitness Test</div>
          <button className={styles.modalClose} onClick={onClose}>x</button>
        </div>

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

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button className={styles.btnOutline} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

function RecoveryModal({ form, onChange, onSave, onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 520 }}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>Recovery Check-in</div>
          <button className={styles.modalClose} onClick={onClose}>x</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Date</label>
            <input className={styles.formInput} type="date" value={form.date} onChange={e => onChange('date', e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>Resting HR</label>
            <input className={styles.formInput} type="number" value={form.hr} onChange={e => onChange('hr', e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Sleep hours</label>
            <input className={styles.formInput} type="number" value={form.sleep} onChange={e => onChange('sleep', e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>Fatigue /10</label>
            <input className={styles.formInput} type="number" min="1" max="10" value={form.fatigue} onChange={e => onChange('fatigue', e.target.value)} />
          </div>

          <div className={styles.formRow}>
            <label className={styles.formLabel}>Soreness /10</label>
            <input className={styles.formInput} type="number" min="1" max="10" value={form.soreness} onChange={e => onChange('soreness', e.target.value)} />
          </div>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Notes</label>
          <textarea
            className={styles.formTextarea}
            placeholder="e.g. Legs feel tired after match practice"
            value={form.notes}
            onChange={e => onChange('notes', e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button className={styles.btnOutline} onClick={onClose}>Cancel</button>
          <button className={styles.btnPrimary} onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  )
}

function InjuryModal({ title, form, onChange, onSave, onClose, onDelete }) {
  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>{title}</div>
          <button className={styles.modalClose} onClick={onClose}>x</button>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Injury description</label>
          <input className={styles.formInput} placeholder="e.g. Left knee pain" value={form.name} onChange={e => onChange('name', e.target.value)} />
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

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {onDelete ? (
            <button
              onClick={onDelete}
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
            <button className={styles.btnOutline} onClick={onClose}>Cancel</button>
            <button className={styles.btnPrimary} onClick={onSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TrainingCalendar({ sessions, onDayClick, selectedDate }) {
  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(y => y - 1)
    } else {
      setViewMonth(m => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(y => y + 1)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  const sessionMap = {}
  sessions.forEach(s => {
    sessionMap[toKey(s.date)] = s
  })

  const getKey = d => {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{ background: '#F7F9FF', borderRadius: 14, padding: '14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button
          onClick={prevMonth}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 20,
            color: '#1A5FFF',
            lineHeight: 1,
            padding: '0 8px',
          }}
        >
          &#8249;
        </button>

        <span style={{ fontWeight: 700, fontSize: 13, color: '#0D1B3E' }}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>

        <button
          onClick={nextMonth}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 20,
            color: '#1A5FFF',
            lineHeight: 1,
            padding: '0 8px',
          }}
        >
          &#8250;
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 6 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ fontSize: 10, fontWeight: 700, color: '#8892A4' }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />

          const key = getKey(d)
          const session = sessionMap[key]
          const isToday = key === todayISO()
          const isSelected = selectedDate === key

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
                background: isSelected
                  ? '#1A5FFF'
                  : isToday
                    ? '#E8EFFE'
                    : session
                      ? 'rgba(26,95,255,0.06)'
                      : 'transparent',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: isToday || isSelected ? 700 : 400,
                  color: isSelected ? '#fff' : isToday ? '#1A5FFF' : '#0D1B3E',
                  lineHeight: '24px',
                }}
              >
                {d}
              </span>

              {session && (
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    marginTop: 1,
                    background: isSelected ? '#fff' : DOT_COLORS[session.intensity] || '#C8D0E0',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        {Object.entries(DOT_COLORS).map(([label, color]) => (
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
                display: 'inline-block',
              }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function FitnessProgressChart({ indicators }) {
  const dates = ['13 Apr', '20 Apr', '27 Apr', '4 May', '11 May']

  const series = indicators.map((item, idx) => {
    const v = item.val
    return {
      name: item.name,
      color: INDICATOR_COLORS[item.name],
      values: [
        clamp(v - 12 + idx),
        clamp(v - 8 + idx),
        clamp(v - 5),
        clamp(v - 3),
        clamp(v),
      ],
    }
  })

  const xPoints = [40, 200, 360, 520, 680]
  const getY = val => 150 - (val / 100) * 120

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg width="740" height="190" viewBox="0 0 740 190">
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line x1="40" x2="700" y1={getY(v)} y2={getY(v)} stroke="#EEF2F7" strokeWidth="1" />
            <text x="12" y={getY(v) + 4} fontSize="10" fill="#8892A4">
              {v}
            </text>
          </g>
        ))}

        {dates.map((d, i) => (
          <text key={d} x={xPoints[i]} y="178" textAnchor="middle" fontSize="10" fill="#8892A4">
            {d}
          </text>
        ))}

        {series.map(s => (
          <polyline
            key={s.name}
            points={s.values.map((v, i) => `${xPoints[i]},${getY(v)}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
    </div>
  )
}

export default function Fitness() {
  const [sessions, setSessions] = useState(buildInitSessions)
  const [nextSessionId, setNextSessionId] = useState(8)
  const [selectedDate, setSelectedDate] = useState(null)

  const [fitnessTests, setFitnessTests] = useState(initFitnessTests)
  const [nextTestId, setNextTestId] = useState(6)

  const [recoveryLogs, setRecoveryLogs] = useState(initRecoveryLogs)
  const [nextRecoveryId, setNextRecoveryId] = useState(2)

  const [injuryList, setInjuryList] = useState(initInjuries)
  const [nextInjuryId, setNextInjuryId] = useState(4)

  const [showAddTraining, setShowAddTraining] = useState(false)
  const [editingSession, setEditingSession] = useState(null)

  const [showFitnessTest, setShowFitnessTest] = useState(false)
  const [showRecovery, setShowRecovery] = useState(false)

  const [showAddInjury, setShowAddInjury] = useState(false)
  const [editingInjury, setEditingInjury] = useState(null)

  const [trainForm, setTrainForm] = useState(emptyTrainingForm)
  const [testForm, setTestForm] = useState(emptyTestForm)
  const [recoveryForm, setRecoveryForm] = useState(emptyRecoveryForm)
  const [injuryForm, setInjuryForm] = useState(emptyInjuryForm)

  const latestRecovery = recoveryLogs[recoveryLogs.length - 1]

  const weeklyMinutes = useMemo(() => {
    return sessions
      .filter(s => isThisWeek(s.date) && s.intensity !== 'Rest')
      .reduce((total, s) => total + parseMinutes(s.duration), 0)
  }, [sessions])

  const weeklyHours = (weeklyMinutes / 60).toFixed(1)
  const activeInjuries = injuryList.filter(inj => inj.status !== 'Recovered').length

  const indicators = useMemo(() => {
    const latestScore = indicator => {
      const item = [...fitnessTests].reverse().find(t => t.indicator === indicator)
      return item ? clamp(item.score) : null
    }

    const staminaBase = latestScore('Stamina') ?? clamp(62 + Math.min(18, weeklyMinutes / 25))
    const speedBase = latestScore('Speed') ?? 68
    const strengthBase = latestScore('Strength') ?? 74
    const flexibilityBase = latestScore('Flexibility') ?? 60

    const recoveryBase = latestRecovery
      ? clamp(
          100
          - Number(latestRecovery.fatigue || 0) * 8
          - Number(latestRecovery.soreness || 0) * 5
          + Math.min(8, Number(latestRecovery.sleep || 0))
          - activeInjuries * 5
        )
      : 80

    return [
      { name: 'Stamina', val: Math.round(staminaBase) },
      { name: 'Speed', val: Math.round(speedBase) },
      { name: 'Strength', val: Math.round(strengthBase) },
      { name: 'Flexibility', val: Math.round(flexibilityBase), low: flexibilityBase < 65 },
      { name: 'Recovery', val: Math.round(recoveryBase), low: recoveryBase < 65 },
    ]
  }, [fitnessTests, weeklyMinutes, latestRecovery, activeInjuries])

  const fitnessScore = Math.round(
    indicators.reduce((sum, item) => sum + item.val, 0) / indicators.length
  )

  const recoveryScore = indicators.find(i => i.name === 'Recovery')?.val || 80
  const recoveryStatus = recoveryScore >= 75 ? 'Good' : recoveryScore >= 55 ? 'Moderate' : 'Needs Rest'

  const fatigueLabel = latestRecovery
    ? Number(latestRecovery.fatigue) <= 3
      ? 'Low'
      : Number(latestRecovery.fatigue) <= 6
        ? 'Mod.'
        : 'High'
    : 'Mod.'

  const handleTrainingChange = (k, v) => setTrainForm(f => ({ ...f, [k]: v }))
  const handleTestChange = (k, v) => setTestForm(f => ({ ...f, [k]: v }))
  const handleRecoveryChange = (k, v) => setRecoveryForm(f => ({ ...f, [k]: v }))
  const handleInjuryChange = (k, v) => setInjuryForm(f => ({ ...f, [k]: v }))

  const handleDayClick = (key) => {
    if (selectedDate === key) {
      setSelectedDate(null)
    } else {
      setSelectedDate(key)
    }
  }

  const openAddTraining = preDate => {
    setTrainForm({
      ...emptyTrainingForm,
      date: preDate || todayISO(),
    })
    setShowAddTraining(true)
  }

  const openEditTraining = session => {
    setEditingSession(session)
    setTrainForm({
      date: session.date,
      activity: session.activity,
      duration: session.duration,
      intensity: session.intensity,
      focus: session.focus || 'Stamina',
    })
  }

  const handleAddTraining = () => {
    if (!trainForm.activity) return

    const color = INTENSITY_COLOR[trainForm.intensity] || 'gray'
    const day = DAY_SHORT[new Date(trainForm.date + 'T00:00:00').getDay()]

    const entry = {
      id: nextSessionId,
      date: trainForm.date,
      day,
      activity: trainForm.activity,
      duration: trainForm.duration,
      intensity: trainForm.intensity,
      focus: trainForm.focus,
      color,
    }

    setSessions(prev => [
      ...prev.filter(s => toKey(s.date) !== toKey(trainForm.date)),
      entry,
    ].sort((a, b) => a.date.localeCompare(b.date)))

    setNextSessionId(n => n + 1)
    setShowAddTraining(false)
    setTrainForm(emptyTrainingForm)
  }

  const handleSaveEditTraining = () => {
    if (!trainForm.activity) return

    const color = INTENSITY_COLOR[trainForm.intensity] || 'gray'
    const day = DAY_SHORT[new Date(trainForm.date + 'T00:00:00').getDay()]

    const updated = {
      ...editingSession,
      date: trainForm.date,
      day,
      activity: trainForm.activity,
      duration: trainForm.duration,
      intensity: trainForm.intensity,
      focus: trainForm.focus,
      color,
    }

    setSessions(prev =>
      prev.map(s => s.id === editingSession.id ? updated : s)
        .sort((a, b) => a.date.localeCompare(b.date))
    )

    setEditingSession(null)
    setTrainForm(emptyTrainingForm)
  }

  const handleDeleteTraining = () => {
    setSessions(prev => prev.filter(s => s.id !== editingSession.id))

    if (selectedDate === editingSession.date) {
      setSelectedDate(null)
    }

    setEditingSession(null)
    setTrainForm(emptyTrainingForm)
  }

  const handleAddFitnessTest = () => {
    if (!testForm.test || !testForm.result) return

    setFitnessTests(prev => [
      {
        id: nextTestId,
        ...testForm,
        score: clamp(testForm.score),
        change: 'New',
      },
      ...prev,
    ])

    setNextTestId(n => n + 1)
    setShowFitnessTest(false)
    setTestForm(emptyTestForm)
  }

  const handleAddRecovery = () => {
    setRecoveryLogs(prev => [
      ...prev,
      {
        id: nextRecoveryId,
        ...recoveryForm,
        sleep: Number(recoveryForm.sleep),
        fatigue: Number(recoveryForm.fatigue),
        soreness: Number(recoveryForm.soreness),
        hr: Number(recoveryForm.hr),
      },
    ])

    setNextRecoveryId(n => n + 1)
    setShowRecovery(false)
    setRecoveryForm(emptyRecoveryForm)
  }

  const openAddInjury = () => {
    setInjuryForm(emptyInjuryForm)
    setShowAddInjury(true)
  }

  const openEditInjury = inj => {
    setEditingInjury(inj)
    setInjuryForm({
      name: inj.name,
      date: inj.date,
      status: inj.status,
      notes: inj.notes || '',
    })
  }

  const handleAddInjury = () => {
    if (!injuryForm.name) return

    const color = injuryForm.status === 'Recovered' ? 'green' : 'amber'

    setInjuryList(prev => [
      ...prev,
      {
        id: nextInjuryId,
        ...injuryForm,
        color,
      },
    ])

    setNextInjuryId(n => n + 1)
    setShowAddInjury(false)
    setInjuryForm(emptyInjuryForm)
  }

  const handleSaveEditInjury = () => {
    if (!injuryForm.name) return

    const color = injuryForm.status === 'Recovered' ? 'green' : 'amber'

    setInjuryList(prev =>
      prev.map(inj =>
        inj.id === editingInjury.id
          ? { ...inj, ...injuryForm, color }
          : inj
      )
    )

    setEditingInjury(null)
    setInjuryForm(emptyInjuryForm)
  }

  const handleDeleteInjury = () => {
    setInjuryList(prev => prev.filter(inj => inj.id !== editingInjury.id))
    setEditingInjury(null)
    setInjuryForm(emptyInjuryForm)
  }

  const tableSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date))

  const pencilIcon = (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: '#C8D0E0', flexShrink: 0 }}>
      <path
        d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  return (
    <div>
      <div className={styles.pageHead}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div className={styles.pageTitle}>Fitness</div>
            <div className={styles.pageSub}>
              Track your training, fitness tests, recovery and overall physical condition.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className={styles.btnPrimary} onClick={() => openAddTraining()}>
              + Add Training
            </button>

            <button className={styles.btnPrimary} style={{ background: '#10B981' }} onClick={() => setShowFitnessTest(true)}>
              + Fitness Test
            </button>

            <button className={styles.btnPrimary} style={{ background: '#7C3AED' }} onClick={() => setShowRecovery(true)}>
              + Recovery Check-in
            </button>

            <button className={styles.btnOutline} onClick={openAddInjury}>
              + Log Injury
            </button>
          </div>
        </div>
      </div>

      <div className={styles.g4} style={{ marginBottom: 16 }}>
        <div className={styles.metricHighlight}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div>
              <div className={styles.metricIcon} style={{ background: 'rgba(255,255,255,0.12)' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="7" stroke="white" strokeWidth="1.5" />
                  <path d="M9 5v4l2.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>

              <div style={{ display: 'flex', alignItems: 'end', gap: 6, marginTop: 8 }}>
                <div className={styles.metricVal} style={{ color: '#fff' }}>{fitnessScore}</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 700, marginBottom: 5 }}>
                  /100
                </div>
              </div>

              <div className={styles.metricLbl} style={{ color: 'rgba(255,255,255,0.65)' }}>
                Fitness score
              </div>
            </div>

            <ScoreRing value={fitnessScore} />
          </div>
        </div>

        <div className={styles.metric}>
          <div>
            <div className={styles.metricIcon} style={{ background: '#E0FAF3' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: '#00C48C' }}>
                <path d="M2 9h2l2-5 3 10 2-5 1 3h4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className={styles.metricVal} style={{ color: '#00C48C' }}>
              {latestRecovery?.hr || 62}
              <span style={{ fontSize: 14, color: '#0D1B3E', marginLeft: 4 }}>bpm</span>
            </div>

            <div className={styles.metricLbl}>Resting HR</div>
            <div className={styles.deltaUp}>↓ 2 bpm vs last week</div>
          </div>
        </div>

        <div className={styles.metric}>
          <div>
            <div className={styles.metricIcon} style={{ background: '#FEF2F2' }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: '#EF4444' }}>
                <circle cx="9" cy="10" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M9 4V2M6.5 2h5M9 10l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            <div className={styles.metricVal} style={{ color: '#0D1B3E' }}>
              {weeklyHours}
              <span style={{ fontSize: 14, marginLeft: 4 }}>h</span>
            </div>

            <div className={styles.metricLbl}>Weekly training load</div>
            <div className={styles.deltaUp}>↑ from training log</div>
          </div>
        </div>

        <div className={styles.metric}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div className={styles.metricIcon} style={{ background: '#E0FAF3' }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: '#10B981' }}>
                  <path d="M9 15s6-3.5 6-8.5A3.5 3.5 0 0 0 9 4a3.5 3.5 0 0 0-6 2.5C3 11.5 9 15 9 15Z" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>

              <div className={styles.metricVal} style={{ color: recoveryScore >= 75 ? '#10B981' : '#F59E0B' }}>
                {recoveryStatus}
              </div>

              <div className={styles.metricLbl}>Recovery status</div>
              <div style={{ fontSize: 12, color: '#8892A4', marginTop: 5 }}>
                Fatigue: {fatigueLabel}
              </div>
            </div>

            <ProgressRing value={recoveryScore} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.15fr', gap: 16, marginBottom: 16 }}>
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
              This Week's Training Calendar
            </div>

            <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => openAddTraining()}>
              + Add
            </button>
          </div>

          <TrainingCalendar sessions={sessions} onDayClick={handleDayClick} selectedDate={selectedDate} />
        </div>

        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
              Fitness Indicators
            </div>

            <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => setShowFitnessTest(true)}>
              Update
            </button>
          </div>

          {indicators.map((s, i) => (
            <div key={i} className={styles.skillRow} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: 130 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    background: `${INDICATOR_COLORS[s.name]}18`,
                    color: INDICATOR_COLORS[s.name],
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  {s.name[0]}
                </div>

                <div className={styles.skillLbl} style={{ width: 'auto' }}>{s.name}</div>
              </div>

              <div className={styles.skillTrack}>
                <div
                  className={styles.skillFill}
                  style={{
                    width: `${s.val}%`,
                    background: s.low
                      ? 'linear-gradient(90deg,#F59E0B,#FBBF24)'
                      : 'linear-gradient(90deg,#1A5FFF,#3B7BFF)',
                  }}
                />
              </div>

              <div className={styles.skillVal} style={{ color: s.low ? '#F59E0B' : '#0D1B3E', width: 55 }}>
                {s.val}<span style={{ color: '#8892A4', fontWeight: 500 }}> /100</span>
              </div>
            </div>
          ))}

          <div style={{ fontSize: 12, color: '#8892A4', marginTop: 8 }}>
            Indicators are updated from training logs, fitness tests, recovery check-ins and injury status.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr 0.9fr', gap: 16, marginBottom: 16 }}>
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
              Training Log
            </div>

            <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => openAddTraining()}>
              View / Add
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '70px 1fr 80px 80px 80px 30px',
              gap: 10,
              padding: '0 8px 8px',
              color: '#8892A4',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            <div>Date</div>
            <div>Training</div>
            <div>Duration</div>
            <div>Intensity</div>
            <div>Focus</div>
            <div />
          </div>

          {tableSessions.map(t => (
            <div
              key={t.id}
              className={styles.listRow}
              onClick={() => openEditTraining(t)}
              style={{
                cursor: 'pointer',
                display: 'grid',
                gridTemplateColumns: '70px 1fr 80px 80px 80px 30px',
                gap: 10,
                alignItems: 'center',
                borderRadius: 8,
              }}
            >
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0D1B3E' }}>
                  {new Date(t.date + 'T00:00:00').toLocaleDateString('en-MY', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </div>

                <div style={{ fontSize: 11, color: '#8892A4' }}>{t.day}</div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700 }}>{t.activity}</div>
              <div style={{ fontSize: 12, color: '#8892A4' }}>{t.duration || '-'}</div>

              <span className={getBadgeClass(t.color)} style={{ width: 'fit-content' }}>
                {t.intensity}
              </span>

              <div style={{ fontSize: 12, color: '#0D1B3E', fontWeight: 600 }}>
                {t.focus || '-'}
              </div>

              {pencilIcon}
            </div>
          ))}
        </div>

        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
              Fitness Test Records
            </div>

            <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => setShowFitnessTest(true)}>
              Add
            </button>
          </div>

          {fitnessTests.slice(0, 6).map(test => (
            <div key={test.id} className={styles.listRow} style={{ display: 'grid', gridTemplateColumns: '1fr 75px 65px', gap: 10, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{test.test}</div>
                <div style={{ fontSize: 11, color: '#8892A4' }}>{fmtDate(test.date)} · {test.indicator}</div>
              </div>

              <div style={{ fontSize: 12, color: '#0D1B3E', fontWeight: 700 }}>{test.result}</div>
              <div style={{ fontSize: 12, color: '#10B981', fontWeight: 700, textAlign: 'right' }}>{test.change}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
                Recovery Check-in
              </div>

              <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => setShowRecovery(true)}>
                Add
              </button>
            </div>

            {[
              {
                label: 'Sleep Hours',
                val: `${latestRecovery?.sleep || 0} h`,
                badge: latestRecovery?.sleep >= 7 ? 'Good' : 'Low',
                color: latestRecovery?.sleep >= 7 ? 'green' : 'amber',
              },
              {
                label: 'Fatigue Level',
                val: `${latestRecovery?.fatigue || 0} /10`,
                badge: Number(latestRecovery?.fatigue || 0) <= 3 ? 'Low' : 'Monitor',
                color: Number(latestRecovery?.fatigue || 0) <= 3 ? 'green' : 'amber',
              },
              {
                label: 'Muscle Soreness',
                val: `${latestRecovery?.soreness || 0} /10`,
                badge: Number(latestRecovery?.soreness || 0) <= 3 ? 'Low' : 'Monitor',
                color: Number(latestRecovery?.soreness || 0) <= 3 ? 'green' : 'amber',
              },
              {
                label: 'Resting HR',
                val: `${latestRecovery?.hr || 0} bpm`,
                badge: 'Normal',
                color: 'green',
              },
              {
                label: 'Recovery Score',
                val: `${recoveryScore} /100`,
                badge: recoveryStatus,
                color: recoveryScore >= 75 ? 'green' : 'amber',
              },
            ].map((r, i) => (
              <div key={i} className={styles.statRow}>
                <span className={styles.statLabel}>{r.label}</span>

                <span className={styles.statVal}>
                  {r.val}
                  <span className={r.color === 'green' ? styles.badgeGreen : styles.badgeAmber} style={{ fontSize: 10, marginLeft: 8 }}>
                    {r.badge}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div className={styles.cardTitle} style={{ marginBottom: 0 }}>
                Injury Log
              </div>

              <button className={styles.btnOutline} style={{ fontSize: 12, padding: '7px 14px' }} onClick={openAddInjury}>
                View All
              </button>
            </div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {injuryList.map(inj => (
                  <div
                    key={inj.id}
                    className={styles.listRow}
                    onClick={() => openEditInjury(inj)}
                    style={{ cursor: 'pointer', borderRadius: 8 }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{inj.name}</div>
                      <div style={{ fontSize: 11, color: '#8892A4' }}>{fmtDate(inj.date)}</div>
                    </div>

                    <span className={inj.color === 'green' ? styles.badgeGreen : styles.badgeAmber}>
                      {inj.status}
                    </span>
                  </div>
                ))}
              </div>

              <InjuryBodyMap injuries={injuryList} />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Fitness Progress Over Time</div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
          {indicators.map(item => (
            <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: INDICATOR_COLORS[item.name] }} />
              {item.name}
            </div>
          ))}
        </div>

        <FitnessProgressChart indicators={indicators} />
      </div>

      {showAddTraining && (
        <TrainingModal
          title="Add Training"
          form={trainForm}
          onChange={handleTrainingChange}
          onSave={handleAddTraining}
          onClose={() => {
            setShowAddTraining(false)
            setTrainForm(emptyTrainingForm)
          }}
        />
      )}

      {editingSession && (
        <TrainingModal
          title="Edit Training"
          form={trainForm}
          onChange={handleTrainingChange}
          onSave={handleSaveEditTraining}
          onClose={() => {
            setEditingSession(null)
            setTrainForm(emptyTrainingForm)
          }}
          onDelete={handleDeleteTraining}
        />
      )}

      {showFitnessTest && (
        <FitnessTestModal
          form={testForm}
          onChange={handleTestChange}
          onSave={handleAddFitnessTest}
          onClose={() => {
            setShowFitnessTest(false)
            setTestForm(emptyTestForm)
          }}
        />
      )}

      {showRecovery && (
        <RecoveryModal
          form={recoveryForm}
          onChange={handleRecoveryChange}
          onSave={handleAddRecovery}
          onClose={() => {
            setShowRecovery(false)
            setRecoveryForm(emptyRecoveryForm)
          }}
        />
      )}

      {showAddInjury && (
        <InjuryModal
          title="Log Injury"
          form={injuryForm}
          onChange={handleInjuryChange}
          onSave={handleAddInjury}
          onClose={() => {
            setShowAddInjury(false)
            setInjuryForm(emptyInjuryForm)
          }}
        />
      )}

      {editingInjury && (
        <InjuryModal
          title="Edit Injury"
          form={injuryForm}
          onChange={handleInjuryChange}
          onSave={handleSaveEditInjury}
          onClose={() => {
            setEditingInjury(null)
            setInjuryForm(emptyInjuryForm)
          }}
          onDelete={handleDeleteInjury}
        />
      )}
    </div>
  )
}