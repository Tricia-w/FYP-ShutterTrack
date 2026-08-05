const SCHEDULE_META_PREFIX = '__SHUTTLETRACK_TRAINING__:'

const clampScore = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number(value) || 0))

const dateKey = value => String(value || '').slice(0, 10)

const localDateKey = date => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const getCurrentWeekDates = referenceDate => {
  const today = new Date(referenceDate)
  const day = today.getDay()

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - day + index)
    return localDateKey(date)
  })
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

const calculateTimeMinutes = (start, end) => {
  if (!start || !end) return 0

  const [startHour, startMinute] = String(start)
    .slice(0, 5)
    .split(':')
    .map(Number)
  const [endHour, endMinute] = String(end)
    .slice(0, 5)
    .split(':')
    .map(Number)

  if (
    [startHour, startMinute, endHour, endMinute].some(Number.isNaN)
  ) {
    return 0
  }

  let total =
    endHour * 60 +
    endMinute -
    (startHour * 60 + startMinute)

  if (total < 0) total += 24 * 60

  return total
}

const decodeScheduleMeta = value => {
  const raw = String(value || '')

  if (!raw.startsWith(SCHEDULE_META_PREFIX)) {
    return {
      endTime: '',
      status: '',
    }
  }

  try {
    const parsed = JSON.parse(raw.slice(SCHEDULE_META_PREFIX.length))

    return {
      endTime: parsed?.endTime || '',
      status: parsed?.status || '',
    }
  } catch {
    return {
      endTime: '',
      status: '',
    }
  }
}

const getTrainingMinutes = item => {
  const savedMinutes = parseMinutes(item?.duration)
  if (savedMinutes > 0) return savedMinutes

  const scheduleMeta = decodeScheduleMeta(item?.notes)
  const startTime =
    item?.startTime ||
    item?.start_time ||
    item?.time ||
    item?.event_time ||
    ''
  const endTime =
    item?.endTime ||
    item?.end_time ||
    scheduleMeta.endTime ||
    ''

  return calculateTimeMinutes(startTime, endTime)
}

const getRowDate = item =>
  dateKey(
    item?.date ||
      item?.test_date ||
      item?.training_date ||
      item?.log_date ||
      item?.injury_date ||
      item?.event_date
  )

const getCreatedAt = item =>
  String(item?.createdAt || item?.created_at || item?.updated_at || '')

const sortNewestFirst = (left, right) => {
  const dateCompare = getRowDate(right).localeCompare(getRowDate(left))
  if (dateCompare !== 0) return dateCompare

  return getCreatedAt(right).localeCompare(getCreatedAt(left))
}

const getRecoveryValue = (recovery, normalizedKey, databaseKey) =>
  Number(recovery?.[normalizedKey] ?? recovery?.[databaseKey] ?? 0)

const getCoachSessionId = item =>
  item?.coachSessionId || item?.coach_session_id || null

const getScheduleStatus = item => {
  const scheduleMeta = decodeScheduleMeta(item?.notes)

  return String(
    item?.attendanceStatus ||
      item?.attendance_status ||
      item?.status ||
      scheduleMeta.status ||
      ''
  ).toLowerCase()
}

export function calculateFitnessSummary({
  tests = [],
  sessions = [],
  recoveryLogs = [],
  injuries = [],
  scheduleList = [],
  referenceDate = new Date(),
} = {}) {
  const orderedTests = [...tests].sort(sortNewestFirst)
  const orderedRecoveryLogs = [...recoveryLogs].sort(sortNewestFirst)
  const latestRecovery = orderedRecoveryLogs[0] || null
  const weekDates = new Set(getCurrentWeekDates(referenceDate))

  const completedTrainingLogs = sessions
    .filter(session => weekDates.has(getRowDate(session)))
    .map(session => ({
      key: getCoachSessionId(session)
        ? `coach-${getCoachSessionId(session)}`
        : `training-${session.id}`,
      minutes: getTrainingMinutes(session),
    }))

  const completedSchedules = scheduleList
    .filter(item => {
      return (
        getScheduleStatus(item) === 'completed' &&
        weekDates.has(getRowDate(item))
      )
    })
    .map(item => ({
      key: getCoachSessionId(item)
        ? `coach-${getCoachSessionId(item)}`
        : `schedule-${item.id}`,
      minutes: getTrainingMinutes(item),
    }))

  const uniqueRecords = new Map()

  ;[...completedTrainingLogs, ...completedSchedules].forEach(record => {
    const previous = uniqueRecords.get(record.key) || 0
    uniqueRecords.set(record.key, Math.max(previous, record.minutes))
  })

  const weeklyMinutes = [...uniqueRecords.values()].reduce(
    (sum, minutes) => sum + minutes,
    0
  )

  const activeInjuries = injuries.filter(item => {
    return String(item?.status || '').toLowerCase() !== 'recovered'
  }).length

  const latestScore = indicator => {
    const matchingTest = orderedTests.find(item => {
      return (
        String(item?.indicator || '').toLowerCase() ===
        indicator.toLowerCase()
      )
    })

    if (!matchingTest) return null

    return clampScore(matchingTest.score)
  }

  const recoveryBase = latestRecovery
    ? clampScore(
        100 -
          getRecoveryValue(
            latestRecovery,
            'tiredness',
            'fatigue_level'
          ) *
            8 -
          getRecoveryValue(
            latestRecovery,
            'muscleAche',
            'soreness_level'
          ) *
            5 +
          Math.min(
            8,
            getRecoveryValue(
              latestRecovery,
              'sleep',
              'sleep_hours'
            )
          ) -
          activeInjuries * 5
      )
    : 50

  const staminaTestScore = latestScore('Stamina')
  const speedTestScore = latestScore('Speed')
  const strengthTestScore = latestScore('Strength')
  const flexibilityTestScore = latestScore('Flexibility')

  const indicators = [
    {
      name: 'Stamina',
      val: Math.round(
        staminaTestScore ??
          (sessions.length
            ? clampScore(50 + Math.min(22, weeklyMinutes / 25))
            : 50)
      ),
    },
    {
      name: 'Speed',
      val: Math.round(speedTestScore ?? 50),
    },
    {
      name: 'Strength',
      val: Math.round(strengthTestScore ?? 50),
    },
    {
      name: 'Flexibility',
      val: Math.round(flexibilityTestScore ?? 50),
      low: (flexibilityTestScore ?? 50) < 65,
    },
    {
      name: 'Recovery',
      val: Math.round(recoveryBase),
      low: recoveryBase < 65,
    },
  ]

  const fitnessScore = Math.round(
    indicators.reduce((sum, item) => sum + item.val, 0) /
      indicators.length
  )

  const hasFitnessData = Boolean(
    tests.length ||
      sessions.length ||
      recoveryLogs.length ||
      injuries.length ||
      completedSchedules.length
  )

  return {
    fitnessScore,
    indicators,
    latestRecovery,
    weeklyMinutes,
    weeklyHours: Number((weeklyMinutes / 60).toFixed(1)),
    activeInjuries,
    recoveryScore: latestRecovery
      ? indicators.find(item => item.name === 'Recovery')?.val || 0
      : 0,
    hasFitnessData,
  }
}