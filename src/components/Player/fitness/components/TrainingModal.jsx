import styles from '../../../Layout/Pages.module.css'


function ModalShell({
  title,
  children,
  onClose,
  maxWidth = 560,
}) {
  return (
    <div
      className={styles.modalOverlay}
      onClick={event =>
        event.target === event.currentTarget && onClose()
      }
    >
      <div
        className={`${styles.modal} fitness-mobile-modal`}
        style={{
          width: 'min(92vw, 100%)',
          maxWidth,
        }}
      >
        <div className={styles.modalHead}>
          <div className={styles.modalTitle}>{title}</div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}


function FormActions({
  onSave,
  onClose,
  onDelete,
  saving,
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 8,
      }}
    >
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={saving}
          style={{
            padding: '9px 16px',
            borderRadius: 10,
            border: '1.5px solid #FCA5A5',
            background: '#FEF2F2',
            color: '#EF4444',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Delete
        </button>
      ) : (
        <div />
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="button"
          className={styles.btnOutline}
          onClick={onClose}
          disabled={saving}
        >
          Cancel
        </button>

        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  )
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

  const numeric = Number(
    text.match(/\d+(?:\.\d+)?/)?.[0] || 0
  )

  return Number.isFinite(numeric) ? numeric : 0
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

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
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

export default function TrainingModal({ title, form, onChange, onSave, onClose, onDelete, saving }) {
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
        <div style={{ marginTop: 5, fontSize: 12, color: '#8892A4' }}>
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
