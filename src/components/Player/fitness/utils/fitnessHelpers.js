export const clamp = (
  value,
  min = 0,
  max = 100
) =>
  Math.max(
    min,
    Math.min(max, Number(value) || 0)
  )

export function fmtDate(value) {
  if (!value) return '-'

  try {
    return new Date(
      `${value}T00:00:00`
    ).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

export function fmtTime(value) {
  if (!value) return ''

  const [hour, minute] = String(value).split(':')

  if (hour === undefined || minute === undefined) {
    return value
  }

  const date = new Date()
  date.setHours(Number(hour), Number(minute), 0, 0)

  return date.toLocaleTimeString('en-MY', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function fmtTimeRange(start, end) {
  if (!start && !end) return '-'
  if (start && end) return `${fmtTime(start)} - ${fmtTime(end)}`
  return fmtTime(start || end)
}
