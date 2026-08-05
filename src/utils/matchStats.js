export function normaliseMatchResult(value) {
  const result = String(value || '').trim().toLowerCase()

  if (result === 'win' || result === 'won' || result === 'w') {
    return 'win'
  }

  if (
    result === 'loss' ||
    result === 'lost' ||
    result === 'lose' ||
    result === 'l'
  ) {
    return 'loss'
  }

  return ''
}

function getMatchTime(match) {
  const value =
    match?.match_date ||
    match?.created_at ||
    match?.updated_at ||
    ''

  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function extractSetScores(matches = []) {
  return matches
    .flatMap(match => [
      match?.score1,
      match?.score2,
      match?.score3,
    ])
    .filter(value => value !== null && value !== undefined && value !== '')
    .flatMap(score =>
      String(score)
        .split('-')
        .map(value => Number(value.trim()))
    )
    .filter(Number.isFinite)
}

export function calculateMatchStats(matches = []) {
  const validMatches = Array.isArray(matches) ? matches : []

  const sortedLatestFirst = [...validMatches].sort(
    (a, b) => getMatchTime(b) - getMatchTime(a)
  )

  const wins = sortedLatestFirst.filter(
    match => normaliseMatchResult(match?.result) === 'win'
  ).length

  const losses = sortedLatestFirst.filter(
    match => normaliseMatchResult(match?.result) === 'loss'
  ).length

  const decidedMatches = wins + losses

  const winRate =
    decidedMatches > 0
      ? Math.round((wins / decidedMatches) * 100)
      : 0

  let currentStreakType = ''
  let currentStreakCount = 0

  for (const match of sortedLatestFirst) {
    const result = normaliseMatchResult(match?.result)

    if (!result) continue

    const type = result === 'win' ? 'W' : 'L'

    if (!currentStreakType) {
      currentStreakType = type
      currentStreakCount = 1
      continue
    }

    if (type === currentStreakType) {
      currentStreakCount += 1
    } else {
      break
    }
  }

  let bestWinStreak = 0
  let runningWinStreak = 0

  ;[...sortedLatestFirst]
    .reverse()
    .forEach(match => {
      const result = normaliseMatchResult(match?.result)

      if (result === 'win') {
        runningWinStreak += 1
        bestWinStreak = Math.max(
          bestWinStreak,
          runningWinStreak
        )
      } else if (result === 'loss') {
        runningWinStreak = 0
      }
    })

  const setScores = extractSetScores(sortedLatestFirst)

  const averageScorePerSet =
    setScores.length > 0
      ? (
          setScores.reduce((sum, score) => sum + score, 0) /
          setScores.length
        ).toFixed(1)
      : '0.0'

  return {
    totalMatches: validMatches.length,
    decidedMatches,
    wins,
    losses,
    winRate,
    currentStreakType,
    currentStreakCount,
    currentStreak:
      currentStreakType && currentStreakCount > 0
        ? `${currentStreakType}${currentStreakCount}`
        : 'W0',
    bestWinStreak,
    averageScorePerSet,
  }
}