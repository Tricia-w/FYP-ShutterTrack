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

function normalizeTrainingFocus(value, fallbackType = '') {
  const raw = String(value || '').trim()

  const exact = VALID_TRAINING_FOCUS.find(
    option => option.toLowerCase() === raw.toLowerCase()
  )

  if (exact) return exact

  const source = String(fallbackType || raw || '')
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

  const matched = mappings.find(([key]) => source.includes(key))
  return matched ? matched[1] : 'Endurance'
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

export default function ScheduleModal({
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
  venueHistory = [],
  saving,
  error = '',
  availabilityError = '',
  checkingAvailability = false,
}) {
  const selectedType = String(form.type || 'Training')
  const typeLower = selectedType.toLowerCase()

  const isRestDay = typeLower.includes('rest')
  const isCompetition = typeLower.includes('competition')
  const isFriendly = typeLower.includes('friendly')
  const isRecovery = typeLower.includes('recovery')
  const isTraining = typeLower === 'training'

  const currentScheduleStatus =
    String(
      scheduleItem?.scheduleStatus ||
      'scheduled'
    ).toLowerCase()

  const isCurrentlyMissed =
    currentScheduleStatus === 'missed'

  const isCurrentlyCompleted =
    currentScheduleStatus === 'completed'

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
    <ModalShell
      title={title}
      onClose={onClose}
      maxWidth={820}
    >
      {(checkingAvailability || availabilityError) && (
        <div
          role={availabilityError ? 'alert' : 'status'}
          style={{
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 10,
            border: availabilityError
              ? '1px solid color-mix(in srgb, #EF4444 30%, var(--line, #EEF1F8))'
              : '1px solid color-mix(in srgb, #2563EB 24%, var(--line, #EEF1F8))',
            background: availabilityError
              ? 'color-mix(in srgb, #EF4444 8%, var(--card, #FFFFFF))'
              : 'color-mix(in srgb, #2563EB 7%, var(--card, #FFFFFF))',
            color: availabilityError
              ? '#B91C1C'
              : 'var(--text, #0D1B3E)',
            fontSize: 14,
            lineHeight: 1.5,
            fontWeight: 700,
          }}
        >
          {checkingAvailability
            ? 'Checking schedule availability...'
            : availabilityError}
        </div>
      )}

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
            fontSize: 14,
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
          gap: 18,
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
                onChange(
                  'focus',
                  normalizeTrainingFocus(
                    nextType,
                    nextType
                  )
                )
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
              gap: 18,
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
              gap: 18,
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
                fontSize: 12,
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
          list="player-venue-history"
          autoComplete="off"
          onChange={event =>
            onChange('venue', event.target.value)
          }
        />

        <datalist id="player-venue-history">
          {venueHistory.map(venue => (
            <option
              key={venue}
              value={venue}
            />
          ))}
        </datalist>
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
              fontSize: 12,
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
          fontSize: 13,
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
              fontSize: 13,
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
              {!isCurrentlyCompleted && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  style={{ background: '#10B981' }}
                  disabled={saving}
                  onClick={onComplete}
                >
                  {isCurrentlyMissed
                    ? 'Change to Completed'
                    : 'Mark Completed'}
                </button>
              )}

              {!isCurrentlyMissed &&
                scheduleItem?.type !== 'Rest Day' && (
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
                    {isCurrentlyCompleted
                      ? 'Change to Missed'
                      : 'Mark Missed'}
                  </button>
                )}

              {isCurrentlyCompleted &&
                scheduleItem?.type === 'Rest Day' && (
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#10B981',
                    }}
                  >
                    This rest day is completed.
                  </div>
                )}
            </div>
          ) : (
            <div
              style={{
                fontSize: 13,
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
