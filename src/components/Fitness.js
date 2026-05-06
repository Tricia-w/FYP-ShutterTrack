import { useState } from 'react'
import styles from './Pages.module.css'

const fitnessIndicators = [
  { name: 'Stamina',     val: 72, low: false },
  { name: 'Speed',       val: 68, low: false },
  { name: 'Strength',    val: 74, low: false },
  { name: 'Flexibility', val: 60, low: true  },
  { name: 'Recovery',    val: 80, low: false },
]

const initInjuries = [
  { id: 1, name: 'Right ankle sprain', date: '2026-03-01', status: 'Recovered',  notes: '', color: 'green' },
  { id: 2, name: 'Shoulder soreness',  date: '2026-04-01', status: 'Monitoring', notes: '', color: 'amber' },
]

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES   = ['Su','Mo','Tu','We','Th','Fr','Sa']
const DAY_SHORT   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const INTENSITY_COLOR = { High: 'red', Medium: 'amber', Low: 'green', Rest: 'gray' }
const DOT_COLORS      = { High: '#EF4444', Medium: '#F59E0B', Low: '#00C48C', Rest: '#C8D0E0' }

function getThisWeekDates() {
  const today = new Date()
  const day   = today.getDay()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - day + i)
    return d.toISOString().split('T')[0]
  })
}

function buildInitSessions() {
  const week = getThisWeekDates()
  const templates = [
    { activity: 'Rest day',       duration: '',        intensity: 'Rest'   },
    { activity: 'Court training', duration: '90 min',  intensity: 'High'   },
    { activity: 'Footwork drill', duration: '60 min',  intensity: 'Medium' },
    { activity: 'Match practice', duration: '120 min', intensity: 'High'   },
    { activity: 'Gym session',    duration: '45 min',  intensity: 'Low'    },
    { activity: 'Tournament',     duration: '180 min', intensity: 'High'   },
    { activity: 'Rest day',       duration: '',        intensity: 'Rest'   },
  ]
  return week.map((date, i) => ({
    id: i + 1,
    date,
    day: DAY_SHORT[new Date(date + 'T00:00:00').getDay()],
    ...templates[i],
    color: INTENSITY_COLOR[templates[i].intensity],
  }))
}

const toKey = d => d?.slice(0, 10)
const emptyTrainingForm = { date: new Date().toISOString().split('T')[0], activity: '', duration: '', intensity: 'Medium' }
const emptyInjuryForm   = { name: '', date: '', status: 'Monitoring', notes: '' }

function fmtDate(d) {
  if (!d) return ''
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' }) }
  catch { return d }
}

// Shared training modal for add + edit
function TrainingModal({ title, form, onChange, onSave, onClose, onDelete }) {
  return (
    <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} style={{ maxWidth: 460 }}>
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>{title}</div>
          <button className={styles.modalClose} onClick={onClose}>x</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Date</label>
            <input className={styles.formInput} type="date" value={form.date} onChange={e => onChange('date', e.target.value)}/>
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
          <label className={styles.formLabel}>Activity</label>
          <input className={styles.formInput} placeholder="e.g. Court training" value={form.activity} onChange={e => onChange('activity', e.target.value)}/>
        </div>
        <div className={styles.formRow}>
          <label className={styles.formLabel}>Duration</label>
          <input className={styles.formInput} placeholder="e.g. 90 min" value={form.duration} onChange={e => onChange('duration', e.target.value)}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {onDelete ? (
            <button onClick={onDelete} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#EF4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
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

// Shared injury modal for add + edit
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
          <input className={styles.formInput} placeholder="e.g. Left knee pain" value={form.name} onChange={e => onChange('name', e.target.value)}/>
        </div>
        <div className={styles.g2} style={{ marginBottom: 0 }}>
          <div className={styles.formRow}>
            <label className={styles.formLabel}>Date</label>
            <input className={styles.formInput} type="date" value={form.date} onChange={e => onChange('date', e.target.value)}/>
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
          <label className={styles.formLabel}>Notes (optional)</label>
          <textarea className={styles.formTextarea} placeholder="e.g. Swelling reduced, light stretching only" value={form.notes} onChange={e => onChange('notes', e.target.value)}/>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {onDelete ? (
            <button onClick={onDelete} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#EF4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
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
  const [viewYear,  setViewYear]  = useState(today.getFullYear())

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1) } else setViewMonth(m => m+1) }

  const sessionMap = {}
  sessions.forEach(s => { sessionMap[toKey(s.date)] = s })

  const getKey  = d => `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  const isToday = d => getKey(d) === today.toISOString().split('T')[0]
  const isSel   = d => selectedDate === getKey(d)

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div style={{ background: '#F7F9FF', borderRadius: 14, padding: '14px 12px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#1A5FFF', lineHeight: 1, padding: '0 8px' }}>&#8249;</button>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#0D1B3E' }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#1A5FFF', lineHeight: 1, padding: '0 8px' }}>&#8250;</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: 6 }}>
        {DAY_NAMES.map(d => <div key={d} style={{ fontSize: 10, fontWeight: 700, color: '#8892A4' }}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const key = getKey(d)
          const session = sessionMap[key]
          const today_ = isToday(d)
          const sel = isSel(d)
          return (
            <div key={i} onClick={() => onDayClick(key, session)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3px 0', borderRadius: 8, cursor: 'pointer', background: sel ? '#1A5FFF' : today_ ? '#E8EFFE' : session ? 'rgba(26,95,255,0.06)' : 'transparent', transition: 'background 0.15s' }}>
              <span style={{ fontSize: 12, fontWeight: today_ || sel ? 700 : 400, color: sel ? '#fff' : today_ ? '#1A5FFF' : '#0D1B3E', lineHeight: '26px' }}>{d}</span>
              {session && <div style={{ width: 5, height: 5, borderRadius: '50%', marginTop: 1, background: sel ? '#fff' : DOT_COLORS[session.intensity] || '#C8D0E0' }}/>}
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
        {Object.entries(DOT_COLORS).map(([label, color]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#8892A4' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }}/>{label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Fitness() {
  const [sessions,        setSessions]        = useState(buildInitSessions)
  const [nextSessionId,   setNextSessionId]   = useState(8)
  const [selectedDate,    setSelectedDate]    = useState(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [injuryList,      setInjuryList]      = useState(initInjuries)
  const [nextInjuryId,    setNextInjuryId]    = useState(3)

  const [showFitnessModal, setShowFitnessModal] = useState(false)
  const [showAddTraining,  setShowAddTraining]  = useState(false)
  const [editingSession,   setEditingSession]   = useState(null)
  const [showAddInjury,    setShowAddInjury]    = useState(false)
  const [editingInjury,    setEditingInjury]    = useState(null)

  const [form,        setForm]        = useState({ hr: '', sleep: '', weight: '', fatigue: 'Low', notes: '' })
  const [trainForm,   setTrainForm]   = useState(emptyTrainingForm)
  const [injuryForm,  setInjuryForm]  = useState(emptyInjuryForm)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))
  const handleTrainingChange = (k, v) => setTrainForm(f => ({ ...f, [k]: v }))
  const handleInjuryChange   = (k, v) => setInjuryForm(f => ({ ...f, [k]: v }))

  const handleDayClick = (key, session) => {
    if (selectedDate === key) { setSelectedDate(null); setSelectedSession(null) }
    else { setSelectedDate(key); setSelectedSession(session || null) }
  }

  const handleLogFitness = () => { setShowFitnessModal(false); setForm({ hr: '', sleep: '', weight: '', fatigue: 'Low', notes: '' }) }

  // ── Training handlers ──
  const openAddTraining = (preDate) => {
    setTrainForm({ ...emptyTrainingForm, date: preDate || emptyTrainingForm.date })
    setShowAddTraining(true)
  }

  const openEditTraining = (session) => {
    setEditingSession(session)
    setTrainForm({ date: session.date, activity: session.activity, duration: session.duration, intensity: session.intensity })
  }

  const handleAddTraining = () => {
    if (!trainForm.activity) return
    const color = INTENSITY_COLOR[trainForm.intensity] || 'gray'
    const day   = DAY_SHORT[new Date(trainForm.date + 'T00:00:00').getDay()]
    const entry = { id: nextSessionId, date: trainForm.date, day, activity: trainForm.activity, duration: trainForm.duration, intensity: trainForm.intensity, color }
    setSessions(prev => [...prev.filter(s => toKey(s.date) !== toKey(trainForm.date)), entry].sort((a,b) => a.date.localeCompare(b.date)))
    if (selectedDate === trainForm.date) setSelectedSession(entry)
    setNextSessionId(n => n + 1)
    setShowAddTraining(false)
    setTrainForm(emptyTrainingForm)
  }

  const handleSaveEditTraining = () => {
    if (!trainForm.activity) return
    const color = INTENSITY_COLOR[trainForm.intensity] || 'gray'
    const day   = DAY_SHORT[new Date(trainForm.date + 'T00:00:00').getDay()]
    const updated = { ...editingSession, date: trainForm.date, day, activity: trainForm.activity, duration: trainForm.duration, intensity: trainForm.intensity, color }
    setSessions(prev => prev.map(s => s.id === editingSession.id ? updated : s).sort((a,b) => a.date.localeCompare(b.date)))
    if (selectedDate === trainForm.date || selectedDate === editingSession.date) setSelectedSession(updated)
    setEditingSession(null)
    setTrainForm(emptyTrainingForm)
  }

  const handleDeleteTraining = () => {
    setSessions(prev => prev.filter(s => s.id !== editingSession.id))
    if (selectedDate === editingSession.date) { setSelectedDate(null); setSelectedSession(null) }
    setEditingSession(null)
    setTrainForm(emptyTrainingForm)
  }

  // ── Injury handlers ──
  const openAddInjury  = () => { setInjuryForm(emptyInjuryForm); setShowAddInjury(true) }
  const openEditInjury = (inj) => { setEditingInjury(inj); setInjuryForm({ name: inj.name, date: inj.date, status: inj.status, notes: inj.notes || '' }) }

  const handleAddInjury = () => {
    if (!injuryForm.name) return
    const color = injuryForm.status === 'Recovered' ? 'green' : 'amber'
    setInjuryList(prev => [...prev, { id: nextInjuryId, ...injuryForm, color }])
    setNextInjuryId(n => n + 1)
    setShowAddInjury(false)
    setInjuryForm(emptyInjuryForm)
  }

  const handleSaveEditInjury = () => {
    if (!injuryForm.name) return
    const color = injuryForm.status === 'Recovered' ? 'green' : 'amber'
    setInjuryList(prev => prev.map(inj => inj.id === editingInjury.id ? { ...inj, ...injuryForm, color } : inj))
    setEditingInjury(null)
    setInjuryForm(emptyInjuryForm)
  }

  const handleDeleteInjury = () => {
    setInjuryList(prev => prev.filter(inj => inj.id !== editingInjury.id))
    setEditingInjury(null)
    setInjuryForm(emptyInjuryForm)
  }

  const tableSessions = [...sessions].sort((a,b) => a.date.localeCompare(b.date))

  const pencilIcon = (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ color: '#C8D0E0', flexShrink: 0 }}>
      <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  return (
    <div>
      <div className={styles.pageHead}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className={styles.pageTitle}>Fitness Indicators</div>
            <div className={styles.pageSub}>Track your physical condition, training load, and health</div>
          </div>
          <button className={styles.btnPrimary} onClick={() => setShowFitnessModal(true)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Log Fitness
          </button>
        </div>
      </div>

      <div className={styles.g4} style={{ marginBottom: 16 }}>
        <div className={styles.metricHighlight}>
          <div className={styles.metricIcon} style={{ background: 'rgba(255,255,255,0.12)' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="white" strokeWidth="1.5"/><path d="M9 5v4l2.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div className={styles.metricVal} style={{ color: '#fff' }}>78</div>
          <div className={styles.metricLbl} style={{ color: 'rgba(255,255,255,0.6)' }}>Fitness score</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#E0FAF3' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: '#00C48C' }}><path d="M2 9h2l2-5 3 10 2-5 1 3h4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className={styles.metricVal} style={{ color: '#00C48C' }}>62</div>
          <div className={styles.metricLbl}>Resting HR (bpm)</div>
          <div className={styles.deltaUp}>&#8595; 2 bpm improved</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#E8EFFE' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: '#1A5FFF' }}><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M9 5v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </div>
          <div className={styles.metricVal} style={{ color: '#1A5FFF' }}>6.5h</div>
          <div className={styles.metricLbl}>Weekly training</div>
        </div>
        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#FEF3C7' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: '#F59E0B' }}><path d="M9 2L11.5 7H16L12 10.5L13.5 15.5L9 12.5L4.5 15.5L6 10.5L2 7H6.5L9 2Z" fill="currentColor"/></svg>
          </div>
          <div className={styles.metricVal} style={{ color: '#F59E0B' }}>Mod.</div>
          <div className={styles.metricLbl}>Fatigue level</div>
        </div>
      </div>

      <div className={styles.g2}>
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className={styles.cardTitle} style={{ marginBottom: 0 }}>This week's training load</div>
            <button className={styles.btnPrimary} style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => openAddTraining()}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              Add Training
            </button>
          </div>

          <TrainingCalendar sessions={sessions} onDayClick={handleDayClick} selectedDate={selectedDate} />

          {/* Selected day panel */}
          {selectedDate && (
            <div style={{ background: selectedSession ? '#F0F4FF' : '#F7F9FF', border: `1.5px solid ${selectedSession ? '#1A5FFF' : '#E2E8F0'}`, borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8892A4', marginBottom: 6 }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              {selectedSession ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#0D1B3E' }}>{selectedSession.activity}</div>
                    {selectedSession.duration && <div style={{ fontSize: 12, color: '#8892A4', marginTop: 2 }}>{selectedSession.duration}</div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={selectedSession.color === 'red' ? styles.badgeRed : selectedSession.color === 'amber' ? styles.badgeAmber : selectedSession.color === 'green' ? styles.badgeGreen : styles.badgeGray}>{selectedSession.intensity}</span>
                    <button onClick={() => openEditTraining(selectedSession)} style={{ background: '#E8EFFE', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: '#1A5FFF', fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: '#8892A4' }}>No training logged for this day</span>
                  <button className={styles.btnPrimary} style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => openAddTraining(selectedDate)}>+ Add</button>
                </div>
              )}
            </div>
          )}

          {/* Training table — click row to edit */}
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8892A4', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>All logged sessions</div>
          {tableSessions.map((t, i) => (
            <div key={i} className={styles.listRow}
              onClick={() => openEditTraining(t)}
              style={{ cursor: 'pointer', background: selectedDate === toKey(t.date) ? '#F0F4FF' : 'transparent', borderRadius: 8, transition: 'background 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F7F9FF'}
              onMouseLeave={e => e.currentTarget.style.background = selectedDate === toKey(t.date) ? '#F0F4FF' : 'transparent'}
            >
              <div style={{ width: 36, fontSize: 12, fontWeight: 700, color: '#8892A4' }}>{t.day}</div>
              <div style={{ width: 60, fontSize: 11, color: '#C8D0E0' }}>{new Date(t.date + 'T00:00:00').toLocaleDateString('en-MY', { day: 'numeric', month: 'short' })}</div>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>
                {t.activity}{t.duration && <span style={{ color: '#8892A4', fontWeight: 400 }}> · {t.duration}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={t.color === 'red' ? styles.badgeRed : t.color === 'amber' ? styles.badgeAmber : t.color === 'green' ? styles.badgeGreen : styles.badgeGray}>{t.intensity}</span>
                {pencilIcon}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Physical metrics</div>
            {[
              { label: 'Height', val: '172 cm' },
              { label: 'Weight', val: '65 kg' },
              { label: 'BMI', val: '22.0', badge: 'Normal' },
              { label: 'Body fat', val: '14.2%' },
              { label: 'VO2 Max (est.)', val: '46 ml/kg/min' },
            ].map((r, i) => (
              <div key={i} className={styles.statRow}>
                <span className={styles.statLabel}>{r.label}</span>
                <span className={styles.statVal}>{r.val}{r.badge && <span className={styles.badgeGreen} style={{ fontSize: 10, marginLeft: 6 }}>{r.badge}</span>}</span>
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Fitness indicators</div>
            {fitnessIndicators.map((s, i) => (
              <div key={i} className={styles.skillRow}>
                <div className={styles.skillLbl}>{s.name}</div>
                <div className={styles.skillTrack}>
                  <div className={styles.skillFill} style={{ width: `${s.val}%`, background: s.low ? 'linear-gradient(90deg,#F59E0B,#FBBF24)' : 'linear-gradient(90deg,#1A5FFF,#3B7BFF)' }}/>
                </div>
                <div className={styles.skillVal} style={{ color: s.low ? '#F59E0B' : '#0D1B3E' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Injury Log — clickable rows open edit modal */}
          <div className={styles.card}>
            <div className={styles.cardTitle}>Injury log</div>
            {injuryList.length === 0 && <div style={{ fontSize: 13, color: '#8892A4', padding: '8px 0' }}>No injuries logged.</div>}
            {injuryList.map(inj => (
              <div key={inj.id} className={styles.listRow} onClick={() => openEditInjury(inj)}
                style={{ cursor: 'pointer', borderRadius: 8, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F7F9FF'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{inj.name}</div>
                  <div style={{ fontSize: 11, color: '#8892A4' }}>{fmtDate(inj.date)}</div>
                  {inj.notes && <div style={{ fontSize: 11, color: '#8892A4', marginTop: 2, fontStyle: 'italic' }}>{inj.notes}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={inj.color === 'green' ? styles.badgeGreen : styles.badgeAmber}>{inj.status}</span>
                  {pencilIcon}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <button className={styles.btnOutline} onClick={openAddInjury}>+ Log injury</button>
            </div>
          </div>
        </div>
      </div>

      {/* Log Fitness Modal */}
      {showFitnessModal && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowFitnessModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Log Fitness</div>
              <button className={styles.modalClose} onClick={() => setShowFitnessModal(false)}>x</button>
            </div>
            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}><label className={styles.formLabel}>Resting HR (bpm)</label><input className={styles.formInput} type="number" placeholder="e.g. 62" value={form.hr} onChange={set('hr')}/></div>
              <div className={styles.formRow}><label className={styles.formLabel}>Sleep (hours)</label><input className={styles.formInput} type="number" placeholder="e.g. 7.5" value={form.sleep} onChange={set('sleep')}/></div>
            </div>
            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}><label className={styles.formLabel}>Weight (kg)</label><input className={styles.formInput} type="number" placeholder="e.g. 65" value={form.weight} onChange={set('weight')}/></div>
              <div className={styles.formRow}><label className={styles.formLabel}>Fatigue level</label><select className={styles.formSelect} value={form.fatigue} onChange={set('fatigue')}><option>Low</option><option>Moderate</option><option>High</option></select></div>
            </div>
            <div className={styles.formRow}><label className={styles.formLabel}>Notes (optional)</label><textarea className={styles.formTextarea} placeholder="e.g. Felt great after training" value={form.notes} onChange={set('notes')}/></div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className={styles.btnOutline} onClick={() => setShowFitnessModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleLogFitness}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Training Modal */}
      {showAddTraining && (
        <TrainingModal title="Add Training" form={trainForm} onChange={handleTrainingChange} onSave={handleAddTraining} onClose={() => { setShowAddTraining(false); setTrainForm(emptyTrainingForm) }} />
      )}

      {/* Edit Training Modal */}
      {editingSession && (
        <TrainingModal title="Edit Training" form={trainForm} onChange={handleTrainingChange} onSave={handleSaveEditTraining} onClose={() => { setEditingSession(null); setTrainForm(emptyTrainingForm) }} onDelete={handleDeleteTraining} />
      )}

      {/* Add Injury Modal */}
      {showAddInjury && (
        <InjuryModal title="Log Injury" form={injuryForm} onChange={handleInjuryChange} onSave={handleAddInjury} onClose={() => { setShowAddInjury(false); setInjuryForm(emptyInjuryForm) }} />
      )}

      {/* Edit Injury Modal */}
      {editingInjury && (
        <InjuryModal title="Edit Injury" form={injuryForm} onChange={handleInjuryChange} onSave={handleSaveEditInjury} onClose={() => { setEditingInjury(null); setInjuryForm(emptyInjuryForm) }} onDelete={handleDeleteInjury} />
      )}
    </div>
  )
}