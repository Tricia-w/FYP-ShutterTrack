
export const VALID_TRAINING_FOCUS = [
  'Endurance',
  'Speed',
  'Strength',
  'Agility',
  'Recovery',
  'Matches',
  'Defense Drills',
  'Focus on retuning',
]

export function normalizeTrainingFocus(value, fallbackType = '') {
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

export const parseMinutes = value => {
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

export function calculateDuration(start, end) {
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

export function calculateEndTime(startTime, durationValue) {
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
