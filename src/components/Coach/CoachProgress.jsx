import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { calculateFitnessSummary } from '../../utils/fitnessScore'
import { useAuth } from '../../context/AuthContext'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'
import { Avatar, CoachPageHeader, LevelBadge } from './CoachShared'
import CoachNotificationBell from '../Notifications/CoachNotificationBell'
import TestModal from '../Player/fitness/components/FitnessTestModal'
import FitnessDevelopmentTimeline from '../Player/fitness/components/FitnessDevelopmentTimeline'

const DEFAULT_SCORE = 50

const ACTION_PLAN_META_PREFIX = '__SHUTTLETRACK_ACTION_PLAN__:'

const SCHEDULE_META_PREFIX = '__SHUTTLETRACK_TRAINING__:'

function decodeScheduleNotes(value) {
  const raw = String(value || '')
  if (!raw.startsWith(SCHEDULE_META_PREFIX)) {
    return {
      notes: raw,
      endTime: '',
      focus: '',
      activity: '',
      matchType: '',
      status: 'scheduled',
    }
  }
  try {
    const parsed = JSON.parse(
      raw.slice(SCHEDULE_META_PREFIX.length)
    )
    return {
      notes: parsed?.notes || '',
      endTime: parsed?.endTime || '',
      focus: parsed?.focus || '',
      activity: parsed?.activity || '',
      matchType: parsed?.matchType || '',
      status: parsed?.status || 'scheduled',
    }
  } catch {
    return {
      notes: raw,
      endTime: '',
      focus: '',
      activity: '',
      matchType: '',
      status: 'scheduled',
    }
  }
}

function mapTaggedUpcomingMatch(row) {
  const meta = decodeScheduleNotes(row?.notes)
  return {
    id: row?.id,
    playerUserId: row?.user_id || '',
    date: row?.event_date || '',
    startTime: row?.event_time || '',
    endTime: meta.endTime || '',
    scheduleType:
      row?.schedule_type || 'Friendly Match',
    title:
      row?.title ||
      meta.activity ||
      row?.schedule_type ||
      'Upcoming match',
    matchType:
      meta.matchType || 'Singles',
    venue: row?.location || '',
    notes: meta.notes || '',
    status: meta.status || 'scheduled',
  }
}

function decodeActionPlans(value) {
  const raw = String(value || '')
  const empty = {
    performance: '',
    performanceDeadline: '',
    performanceCompletion: 0,
    performanceReviewDate: '',
    fitness: '',
    fitnessDeadline: '',
    fitnessCompletion: 0,
    fitnessReviewDate: '',
  }
  if (!raw.startsWith(ACTION_PLAN_META_PREFIX)) {
    return empty
  }
  try {
    const parsed = JSON.parse(
      raw.slice(ACTION_PLAN_META_PREFIX.length)
    )
    /*
     * Backward compatibility:
     * Old saved format:
     * {
     *   performance: "text",
     *   fitness: "text"
     * }
     *
     * New format:
     * {
     *   performance: {
     *     text: "...",
     *     deadline: "2026-09-30",
     *     completionRate: 50
     *   },
     *   fitness: {
     *     text: "...",
     *     deadline: "2026-10-15",
     *     completionRate: 25
     *   }
     * }
     */
    const performanceValue =
      parsed?.performance
    const fitnessValue =
      parsed?.fitness
    const performanceIsObject =
      performanceValue &&
      typeof performanceValue === 'object' &&
      !Array.isArray(performanceValue)
    const fitnessIsObject =
      fitnessValue &&
      typeof fitnessValue === 'object' &&
      !Array.isArray(fitnessValue)
    return {
      performance:
        performanceIsObject
          ? performanceValue.text || ''
          : performanceValue || '',
      performanceDeadline:
        performanceIsObject
          ? performanceValue.deadline || ''
          : '',
      performanceCompletion:
        performanceIsObject
          ? clamp(
              performanceValue.completionRate
            )
          : 0,
      performanceReviewDate:
        performanceIsObject
          ? performanceValue.reviewDate || ''
          : '',
      fitness:
        fitnessIsObject
          ? fitnessValue.text || ''
          : fitnessValue || '',
      fitnessDeadline:
        fitnessIsObject
          ? fitnessValue.deadline || ''
          : '',
      fitnessCompletion:
        fitnessIsObject
          ? clamp(
              fitnessValue.completionRate
            )
          : 0,
      fitnessReviewDate:
        fitnessIsObject
          ? fitnessValue.reviewDate || ''
          : '',
    }
  } catch {
    return empty
  }
}

function encodeActionPlans({
  performance = '',
  performanceDeadline = '',
  performanceCompletion = 0,
  performanceReviewDate = '',
  fitness = '',
  fitnessDeadline = '',
  fitnessCompletion = 0,
  fitnessReviewDate = '',
}) {
  const cleanPerformance =
    String(performance || '').trim()
  const cleanFitness =
    String(fitness || '').trim()
  const cleanPerformanceDeadline =
    String(
      performanceDeadline || ''
    ).trim()
  const cleanFitnessDeadline =
    String(
      fitnessDeadline || ''
    ).trim()
  const cleanPerformanceCompletion =
    clamp(performanceCompletion)
  const cleanPerformanceReviewDate =
    String(
      performanceReviewDate || ''
    ).trim()
  const cleanFitnessCompletion =
    clamp(fitnessCompletion)
  const cleanFitnessReviewDate =
    String(
      fitnessReviewDate || ''
    ).trim()
  const hasPerformance =
    Boolean(
      cleanPerformance ||
      cleanPerformanceDeadline ||
      cleanPerformanceCompletion ||
      cleanPerformanceReviewDate
    )
  const hasFitness =
    Boolean(
      cleanFitness ||
      cleanFitnessDeadline ||
      cleanFitnessCompletion ||
      cleanFitnessReviewDate
    )
  if (!hasPerformance && !hasFitness) {
    return null
  }
  return `${ACTION_PLAN_META_PREFIX}${JSON.stringify({
    performance: {
      text: cleanPerformance,
      deadline:
        cleanPerformanceDeadline,
      completionRate:
        cleanPerformanceCompletion,
      reviewDate:
        cleanPerformanceReviewDate,
    },
    fitness: {
      text: cleanFitness,
      deadline:
        cleanFitnessDeadline,
      completionRate:
        cleanFitnessCompletion,
      reviewDate:
        cleanFitnessReviewDate,
    },
  })}`
}

const PERFORMANCE_COLORS = {
  Smash: '#2563EB',
  Defense: '#14B8A6',
  Footwork: '#8B5CF6',
  'Drop shot': '#F59E0B',
  'Net play': '#EC4899',
  Serve: '#06B6D4',
}

const FITNESS_COLORS = {
  Endurance: '#10B981',
  Speed: '#2563EB',
  Strength: '#8B5CF6',
  Agility: '#F59E0B',
  Recovery: '#06B6D4',
}

const getMetricColor = (label, value, group = 'performance') => {
  const palette =
    group === 'fitness' ? FITNESS_COLORS : PERFORMANCE_COLORS
  const base = palette[label] || '#2563EB'
  const score = Math.max(0, Math.min(100, Number(value) || 0))
  const strength = Math.round(40 + score * 0.5)
  return `color-mix(
    in srgb,
    ${base} ${strength}%,
    var(--card, #FFFFFF)
  )`
}

const PERFORMANCE_FIELDS = [
  { key: 'smash', label: 'Smash' },
  { key: 'defense', label: 'Defense' },
  { key: 'footwork', label: 'Footwork' },
  { key: 'dropShot', label: 'Drop shot' },
  { key: 'netPlay', label: 'Net play' },
  { key: 'serve', label: 'Serve' },
]

const FITNESS_FIELDS = [
  { key: 'endurance', label: 'Endurance' },
  { key: 'speed', label: 'Speed' },
  { key: 'strength', label: 'Strength' },
  { key: 'agility', label: 'Agility' },
  { key: 'recovery', label: 'Recovery' },
]

const clamp = value =>
  Math.max(0, Math.min(100, Number(value) || 0))

const parseMinutes = value => {
  const match = String(value || '').match(/\d+/)
  return match ? Number(match[0]) : 0
}

const getThisWeekDates = () => {
  const today = new Date()
  const day = today.getDay()
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - day + index)
    return date.toISOString().split('T')[0]
  })
}

const averageValues = values => {
  const numbers = values.map(Number).filter(Number.isFinite)
  if (!numbers.length) return 0
  return Math.round(
    numbers.reduce((sum, value) => sum + value, 0) / numbers.length
  )
}

const hasMeaningfulProgressNote = student => {
  const actionPlans = decodeActionPlans(
    student.progress?.coach_comment
  )
  return Boolean(
    String(actionPlans.performance || '').trim() ||
    String(actionPlans.fitness || '').trim() ||
    String(student.progress?.focus_area || '').trim() ||
    String(student.progress?.progress_status || '').trim() ||
    String(student.progress?.injury_recommendation || '').trim() ||
    String(student.assessment?.performance_comment || '').trim() ||
    String(student.assessment?.fitness_comment || '').trim()
  )
}

const hasCoachProgressRecord = student => {
  if (!student) return false
  const actionPlans = decodeActionPlans(
    student.progress?.coach_comment
  )
  return Boolean(
    String(student.progress?.progress_status || '').trim() ||
    String(student.progress?.focus_area || '').trim() ||
    String(student.progress?.next_review_date || '').trim() ||
    String(actionPlans.performance || '').trim() ||
    String(actionPlans.performanceDeadline || '').trim() ||
    Number(actionPlans.performanceCompletion || 0) > 0 ||
    String(actionPlans.performanceReviewDate || '').trim() ||
    String(actionPlans.fitness || '').trim() ||
    String(actionPlans.fitnessDeadline || '').trim() ||
    Number(actionPlans.fitnessCompletion || 0) > 0 ||
    String(actionPlans.fitnessReviewDate || '').trim() ||
    String(student.assessment?.performance_comment || '').trim() ||
    String(student.assessment?.fitness_comment || '').trim()
  )
}

function calculateFitnessIndicators({
  tests,
  trainingLogs,
  recoveryLogs,
  injuries,
}) {
  const sortedTests = [...tests].sort((a, b) => {
    const dateCompare = String(b.test_date || '').localeCompare(
      String(a.test_date || '')
    )
    if (dateCompare !== 0) return dateCompare
    return String(b.created_at || '').localeCompare(
      String(a.created_at || '')
    )
  })
  const latestScore = indicator => {
    const row = sortedTests.find(item => item.indicator === indicator)
    return row ? clamp(row.score) : null
  }
  const weeklyDates = getThisWeekDates()
  const weeklyMinutes = trainingLogs
    .filter(log =>
      weeklyDates.includes(
        String(log.training_date || '').slice(0, 10)
      )
    )
    .reduce(
      (sum, log) => sum + parseMinutes(log.duration),
      0
    )
  /*
   * IMPORTANT:
   * Recovery is NOT recalculated separately on the Coach Progress page.
   *
   * The Player Fitness page imports calculateFitnessSummary() from:
   * ../../utils/fitnessScore
   *
   * So the coach page now sends the same type of mapped data into that
   * exact shared calculator and reads recoveryScore from it.
   */
  const sharedFitnessSummary = calculateFitnessSummary({
    tests: (tests || []).map(row => ({
      id: row.id,
      date: row.test_date,
      test: row.test_name || '',
      result: row.result || '',
      indicator: row.indicator || 'Endurance',
      score: clamp(row.score),
      addedByCoach: Boolean(
        row.added_by_coach &&
        row.coach_user_id
      ),
      coachUserId: row.coach_user_id || null,
      createdAt: row.created_at || '',
      updatedAt: row.updated_at || '',
    })),
    sessions: (trainingLogs || []).map(row => ({
      id: row.id,
      date: row.training_date,
      startTime: row.start_time || '',
      endTime: row.end_time || '',
      activity: row.activity || '',
      duration: row.duration || '',
      focus: row.focus || 'Endurance',
      notes: row.notes || '',
      coachSessionId: row.coach_session_id || null,
      createdAt: row.created_at || '',
    })),
    recoveryLogs: (recoveryLogs || []).map(row => ({
      id: row.id,
      date: row.log_date,
      sleep: Number(row.sleep_hours || 0),
      tiredness: Number(row.fatigue_level || 0),
      muscleAche: Number(row.soreness_level || 0),
      hr: Number(row.resting_hr || 0),
      notes: row.notes || '',
    })),
    injuries: (injuries || []).map(row => ({
      id: row.id,
      name: row.injury_description || '',
      date: row.injury_date,
      status: row.status || 'Monitoring',
      notes: row.notes || '',
    })),
    // Recovery calculation does not need the coach page to invent a
    // separate schedule representation. Keep this empty rather than
    // creating different logic from Player Fitness.
    scheduleList: [],
  })
  const sharedRecoveryScore =
    Number(sharedFitnessSummary?.recoveryScore)
  return {
    endurance: Math.round(
      latestScore('Endurance') ??
        (trainingLogs.length
          ? clamp(DEFAULT_SCORE + Math.min(22, weeklyMinutes / 25))
          : DEFAULT_SCORE)
    ),
    speed: Math.round(latestScore('Speed') ?? DEFAULT_SCORE),
    strength: Math.round(latestScore('Strength') ?? DEFAULT_SCORE),
    agility: Math.round(
      latestScore('Agility') ?? DEFAULT_SCORE
    ),
    // Exact same Recovery result source as Player Fitness.
    recovery: Number.isFinite(sharedRecoveryScore)
      ? Math.round(clamp(sharedRecoveryScore))
      : DEFAULT_SCORE,
  }
}

function formatDate(value) {
  if (!value) return 'Not set'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const getMatchOpponent = match => {
  const names = [
    match?.opponent_name,
    match?.opponent_name2,
  ].filter(Boolean)
  return names.length
    ? names.join(' & ')
    : 'Unknown opponent'
}

const getMatchScore = match =>
  [match?.score1, match?.score2, match?.score3]
    .filter(Boolean)
    .join(', ')

const mapPlayerMatch = (row, coachNote = null) => ({
  id: row.id,
  playerId: row.player_id,
  date: row.match_date,
  type: row.match_type || 'Singles',
  opponentName: row.opponent_name || '',
  opponentName2: row.opponent_name2 || '',
  opponent: getMatchOpponent(row),
  partnerName: row.partner_name || '',
  score1: row.score1 || '',
  score2: row.score2 || '',
  score3: row.score3 || '',
  score: getMatchScore(row),
  result: row.result || '',
  playerNotes: row.notes || '',
  videoUrl: row.video_url || '',
  videoFileName: row.video_file_name || '',
  createdAt: row.created_at || '',
  updatedAt: row.updated_at || '',
  coachNote: coachNote?.note || '',
  coachNoteId: coachNote?.id || null,
})

const INJURY_META_PREFIX = '__SHUTTLETRACK_INJURY__:'

function decodeInjuryNotes(value) {
  const raw = String(value || '')
  if (!raw.startsWith(INJURY_META_PREFIX)) {
    return {
      notes: raw,
      bodyX: null,
      bodyY: null,
      severity: 'Mild',
      imagePath: '',
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
      severity:
        ['Mild', 'Moderate', 'Severe'].includes(
          parsed?.severity
        )
          ? parsed.severity
          : 'Mild',
      imagePath: parsed?.imagePath || '',
    }
  } catch {
    return {
      notes: raw,
      bodyX: null,
      bodyY: null,
      severity: 'Mild',
      imagePath: '',
    }
  }
}

const INJURY_IMAGE_BUCKET = 'injury-images'

function getInjuryImageUrl(imagePath) {
  if (!imagePath) return ''
  const { data } = supabase.storage
    .from(INJURY_IMAGE_BUCKET)
    .getPublicUrl(imagePath)
  return data?.publicUrl || ''
}

function getInjurySeverityColor(severity) {
  const normalized = String(severity || '').toLowerCase()
  if (normalized === 'severe') return '#EF4444'
  if (normalized === 'moderate') return '#F59E0B'
  return '#10B981'
}

function normalizeInjury(row) {
  const meta = decodeInjuryNotes(row?.notes)
  const status = row?.status || 'Monitoring'
  const severity =
    ['Mild', 'Moderate', 'Severe'].includes(row?.severity)
      ? row.severity
      : meta.severity || 'Mild'
  const imagePath =
    row?.image_path ||
    meta.imagePath ||
    ''
  return {
    id: row?.id,
    name: row?.injury_description || 'Unnamed injury',
    date: row?.injury_date || '',
    status,
    severity,
    notes: meta.notes,
    bodyX: meta.bodyX,
    bodyY: meta.bodyY,
    imagePath,
    imageUrl: getInjuryImageUrl(imagePath),
    createdAt: row?.created_at || '',
    updatedAt: row?.updated_at || '',
    isActive:
      String(status).toLowerCase() !== 'recovered',
  }
}

function getInjuryStatusColor(status) {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'recovered') return '#10B981'
  if (normalized === 'recovering') return '#F59E0B'
  return '#EF4444'
}

function getFallbackInjuryPoint(name = '') {
  const lower = String(name || '').toLowerCase().trim()
  const isLeft = /\bleft\b/.test(lower)
  const isRight = /\bright\b/.test(lower)
  const sideX = isLeft ? 50 : isRight ? 70 : 60
  if (
    lower.includes('head') ||
    lower.includes('forehead')
  ) {
    return { cx: 60, cy: 16 }
  }
  if (lower.includes('neck')) {
    return { cx: sideX, cy: 31 }
  }
  if (lower.includes('shoulder')) {
    return {
      cx: isLeft ? 42 : isRight ? 78 : 60,
      cy: 43,
    }
  }
  if (
    lower.includes('upper chest') ||
    lower.includes('chest') ||
    lower.includes('pectoral')
  ) {
    return {
      cx: isLeft ? 52 : isRight ? 68 : 60,
      cy: 50,
    }
  }
  if (
    lower.includes('upper arm') ||
    lower.includes('bicep') ||
    lower.includes('tricep') ||
    (lower.includes('arm') &&
      !lower.includes('forearm'))
  ) {
    return {
      cx: isLeft ? 37 : isRight ? 83 : 60,
      cy: 63,
    }
  }
  if (lower.includes('elbow')) {
    return {
      cx: isLeft ? 31 : isRight ? 89 : 60,
      cy: 78,
    }
  }
  if (lower.includes('forearm')) {
    return {
      cx: isLeft ? 29 : isRight ? 91 : 60,
      cy: 88,
    }
  }
  if (
    lower.includes('wrist') ||
    lower.includes('hand') ||
    lower.includes('palm') ||
    lower.includes('finger')
  ) {
    return {
      cx: isLeft ? 27 : isRight ? 93 : 60,
      cy: 98,
    }
  }
  if (
    lower.includes('rib') ||
    lower.includes('ribs')
  ) {
    return {
      cx: isLeft ? 51 : isRight ? 69 : 60,
      cy: 67,
    }
  }
  if (
    lower.includes('waist') ||
    lower.includes('abdomen') ||
    lower.includes('stomach')
  ) {
    return { cx: sideX, cy: 86 }
  }
  if (lower.includes('back')) {
    return {
      cx: sideX,
      cy: lower.includes('lower') ? 86 : 66,
    }
  }
  if (
    lower.includes('hip') ||
    lower.includes('groin')
  ) {
    return { cx: sideX, cy: 94 }
  }
  if (
    lower.includes('thigh') ||
    lower.includes('hamstring') ||
    lower.includes('quadricep') ||
    lower.includes('quad')
  ) {
    return { cx: sideX, cy: 106 }
  }
  if (lower.includes('knee')) {
    return { cx: sideX, cy: 122 }
  }
  if (
    lower.includes('calf') ||
    lower.includes('shin') ||
    lower.includes('lower leg')
  ) {
    return { cx: sideX, cy: 140 }
  }
  if (lower.includes('ankle')) {
    return { cx: sideX, cy: 153 }
  }
  if (
    lower.includes('foot') ||
    lower.includes('heel') ||
    lower.includes('toe')
  ) {
    return { cx: sideX, cy: 160 }
  }
  return { cx: 60, cy: 90 }
}

function InjuryBodyMap({ injuries = [] }) {
  const visibleInjuries = injuries
    .filter(Boolean)
    .slice(0, 8)

  return (
    <div
      style={{
        width: 180,
        minWidth: 180,
        height: 240,
        padding: 12,
        boxSizing: 'border-box',
        borderRadius: 14,
        border:
          '1px solid var(--line, #E2E8F0)',
        background: 'var(--card, #FFFFFF)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        viewBox="0 0 120 170"
        width="132"
        height="188"
        role="img"
        aria-label="Student injury location body map"
        style={{
          display: 'block',
          overflow: 'visible',
        }}
      >
        <image
          href="/humanbody.png"
          x="18"
          y="0"
          width="84"
          height="170"
          preserveAspectRatio="xMidYMid meet"
          pointerEvents="none"
        />
        {visibleInjuries.map((injury, index) => {
          const hasSavedPoint =
            injury.bodyX !== null &&
            injury.bodyX !== undefined &&
            injury.bodyY !== null &&
            injury.bodyY !== undefined &&
            Number.isFinite(Number(injury.bodyX)) &&
            Number.isFinite(Number(injury.bodyY))
          const point = hasSavedPoint
            ? {
                cx: Number(injury.bodyX),
                cy: Number(injury.bodyY),
              }
            : getFallbackInjuryPoint(injury.name)
          const markerColor =
            getInjuryStatusColor(injury.status)
          return (
            <g
              key={`${injury.id || injury.name}-${index}`}
            >
              <circle
                cx={point.cx}
                cy={point.cy}
                r="8"
                fill="var(--card, #FFFFFF)"
                opacity="0.98"
              />
              <circle
                cx={point.cx}
                cy={point.cy}
                r="5"
                fill={markerColor}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ComparisonSkillRow({
  label,
  studentValue,
  coachValue,
  color,
}) {
  const studentScore =
    clamp(studentValue ?? DEFAULT_SCORE)
  const hasCoachValue =
    coachValue !== null &&
    coachValue !== undefined &&
    Number.isFinite(Number(coachValue))
  const coachScore = hasCoachValue
    ? clamp(coachValue)
    : studentScore
  const hasChange =
    hasCoachValue &&
    coachScore !== studentScore

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          '68px minmax(0, 1fr) 44px',
        gap: 8,
        width: '100%',
        minWidth: 0,
        alignItems: 'center',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color:
            'var(--text-muted, #8892A4)',
        }}
      >
        {label}
      </div>

      <div
        style={{
          position: 'relative',
          minWidth: 0,
          height: 7,
          borderRadius: 999,
          background:
            'var(--line, #EEF1F8)',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            width: `${studentScore}%`,
            height: '100%',
            borderRadius: 999,
            background: color(studentScore),
          }}
        />
        {hasChange && (
          <>
            <div
              title={`Coach assessment: ${coachScore}`}
              style={{
                position: 'absolute',
                left:
                  `calc(${coachScore}% - 1px)`,
                top: -5,
                width: 2,
                height: 17,
                borderRadius: 999,
                background: '#7C3AED',
                boxShadow:
                  '0 0 0 2px color-mix(in srgb, #7C3AED 16%, var(--card, #FFFFFF))',
              }}
            />

            <div
              style={{
                position: 'absolute',
                left:
                  `clamp(0px, calc(${coachScore}% - 21px), calc(100% - 42px))`,
                top: -23,
                minWidth: 42,
                textAlign: 'center',
                fontSize: 8,
                fontWeight: 700,
                color: '#7C3AED',
                background:
                  'color-mix(in srgb, #7C3AED 12%, var(--card, #FFFFFF))',
                borderRadius: 999,
                padding: '2px 5px',
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
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 700,
          whiteSpace: 'nowrap',
          color:
            'var(--text, #0D1B3E)',
          minWidth: 0,
        }}
      >
        {studentScore}
      </div>
    </div>
  )
}

function ProgressMetricIcon({
  type,
  color = 'currentColor',
  size = 18,
}) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  }
  if (type === 'students') {
    return (
      <svg {...props}>
        <circle
          cx="9"
          cy="8"
          r="3"
          stroke={color}
          strokeWidth="1.8"
        />
        <circle
          cx="17"
          cy="9"
          r="2.5"
          stroke={color}
          strokeWidth="1.8"
        />
        <path
          d="M3.5 19c.6-3.2 2.5-5 5.5-5s4.9 1.8 5.5 5"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M14 15c2.8 0 4.7 1.4 5.5 4"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  if (type === 'performance') {
    return (
      <svg {...props}>
        <path
          d="M4 17 9 12l3 3 7-8"
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
  if (type === 'fitness') {
    return (
      <svg {...props}>
        <path
          d="M5 12h2l2-5 3 10 2-5h5"
          stroke={color}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 4h16v16H4z"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.65"
        />
      </svg>
    )
  }
  if (type === 'notes') {
    return (
      <svg {...props}>
        <path
          d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5Z"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M14 3.5V8h4"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9 12h6M9 16h5"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return null
}

const getPlayerInitials = name => {
  const value = String(name || '-').trim()
  if (!value) return '-'
  const words = value
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase()
  }
  return `${words[0][0]}${words[words.length - 1][0]}`
    .toUpperCase()
}

function MatchPlayerSuggestions({
  items,
  onSelect,
}) {
  if (!items.length) return null

  return (
    <div
      style={{
        border:
          '1px solid var(--line, #EEF1F8)',
        borderRadius: 10,
        background:
          'var(--card, #FFFFFF)',
        marginTop: 6,
        overflow: 'hidden',
        boxShadow:
          '0 10px 25px rgba(15, 23, 42, 0.08)',
      }}
    >
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item)}
          style={{
            width: '100%',
            border: 'none',
            background:
              'var(--card, #FFFFFF)',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            textAlign: 'left',
            color:
              'var(--text, #0D1B3E)',
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 700,
              background: '#E8EFFE',
              color: '#1A5FFF',
              border:
                '1px solid #D8E4FF',
            }}
          >
            {getPlayerInitials(
              item.display_name
            )}
          </span>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color:
                  'var(--text, #0D1B3E)',
              }}
            >
              {item.display_name}
            </div>
          </div>
          <span
            style={{
              fontSize: 11,
              color:
                'var(--text-muted, #8892A4)',
              marginLeft: 'auto',
              flexShrink: 0,
            }}
          >
            {item.source}
          </span>
        </button>
      ))}
    </div>
  )
}

function AssessmentSlider({
  label,
  value,
  accentColor,
  onChange,
}) {

  return (
    <div className={styles.formRow}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <label
          className={styles.formLabel}
          style={{ marginBottom: 0 }}
        >
          {label}
        </label>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {value}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        style={{
          width: '100%',
          accentColor,
        }}
        onChange={event =>
          onChange(
            Number(event.target.value)
          )
        }
      />
    </div>
  )
}

function ActionPlanProgress({
  deadline,
  completion,
  accentColor = '#1A5FFF',
}) {
  const value =
    clamp(completion)
  const today =
    new Date()
      .toISOString()
      .slice(0, 10)
  const deadlineValue =
    String(deadline || '')
      .slice(0, 10)
  const isCompleted =
    value >= 100
  const isOverdue =
    Boolean(
      deadlineValue &&
      deadlineValue < today &&
      !isCompleted
    )
  const isDueToday =
    Boolean(
      deadlineValue &&
      deadlineValue === today &&
      !isCompleted
    )

  return (
    <div
      style={{
        marginTop: 10,
        paddingTop: 10,
        borderTop:
          '1px solid var(--line, #EEF1F8)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 7,
          fontSize: 11,
          color:
            'var(--text-muted, #8892A4)',
        }}
      >
        <span>
          Deadline:{' '}
          <strong
            style={{
              fontWeight: 700,
              color:
                isOverdue || isDueToday
                  ? '#EF4444'
                  : 'var(--text, #0D1B3E)',
            }}
          >
            {deadline
              ? formatDate(deadline)
              : 'Not set'}
          </strong>
          {isCompleted && deadline && (
            <span
              style={{
                marginLeft: 7,
                color: '#10B981',
                fontWeight: 700,
              }}
            >
              Completed
            </span>
          )}
          {isDueToday && (
            <span
              style={{
                marginLeft: 7,
                color: '#EF4444',
                fontWeight: 700,
              }}
            >
              Due today
            </span>
          )}
          {isOverdue && (
            <span
              style={{
                marginLeft: 7,
                color: '#EF4444',
                fontWeight: 700,
              }}
            >
              Overdue
            </span>
          )}
        </span>
        <span
          style={{
            fontWeight: 700,
            color: accentColor,
          }}
        >
          {value}% complete
        </span>
      </div>

      <div
        style={{
          height: 7,
          borderRadius: 999,
          background:
            'var(--line, #EEF1F8)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            borderRadius: 999,
            background: accentColor,
            transition:
              'width 180ms ease',
          }}
        />
      </div>
    </div>
  )
}

function CoachRatingHistory({ section, entries, loading, error, refresh }) {
  const rows = entries.filter(entry => entry.section === section)
  const fieldLabel = key => ({
    smash: 'Smash', defense: 'Defense', footwork: 'Footwork',
    drop_shot: 'Drop shot', net_play: 'Net play', serve: 'Serve',
    endurance: 'Endurance', speed: 'Speed', strength: 'Strength',
    agility: 'Agility', recovery: 'Recovery',
  }[key] || String(key).replaceAll('_', ' '))
  const scoreText = value => value == null ? 'Not rated' : `${value}/100`
  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>{section === 'performance' ? 'Performance' : 'Fitness'} assessment history</strong>
        <button type="button" className={styles.btnOutline} onClick={refresh} style={{ fontSize: 11, padding: '7px 10px' }}>Refresh</button>
      </div>
      {loading && <p style={{ color: 'var(--text-muted, #8892A4)', fontSize: 12 }}>Loading history...</p>}
      {error && <p role="status" style={{ fontSize: 12, color: '#B45309' }}>{error}</p>}
      {!loading && rows.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted, #8892A4)', lineHeight: 1.6 }}>No {section} assessment history yet. The date, scores and changes will appear here when the coach saves a new update.</p>
      )}
      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        {rows.map((entry, index) => {
          const changedKeys = (entry.changed_fields || []).filter(key => key in (entry.scores || {}))
          // Prefer exact previous scores captured when the assessment was saved.
          // Older snapshots may not contain them; do not assume a direction.
          const savedPrevious = entry.scores?.__previous || {}
          const nextOlder = rows[index + 1]
          const olderScores = nextOlder?.scores || {}
          const beforeValue = key => Object.prototype.hasOwnProperty.call(savedPrevious, key)
            ? savedPrevious[key]
            : Object.prototype.hasOwnProperty.call(olderScores, key) ? olderScores[key] : undefined
          return (
            <details key={entry.id} style={{ padding: '12px 0', borderTop: '1px solid var(--line, #EEF1F8)', fontSize: 12 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, lineHeight: 1.6 }}>
                {new Date(entry.recorded_at).toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })}
                {' · '}{changedKeys.length ? `${changedKeys.length} rating${changedKeys.length === 1 ? '' : 's'} changed` : 'Feedback / plan update'}
              </summary>
              {changedKeys.length > 0 && (
                <div style={{ marginTop: 12, marginBottom: 10 }}>
                  <strong style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>Skills updated</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {changedKeys.map(key => {
                      const before = beforeValue(key)
                      const after = entry.scores?.[key]
                      const hasBefore = before !== undefined && before !== null && Number.isFinite(Number(before))
                      const hasAfter = after !== undefined && after !== null && Number.isFinite(Number(after))
                      const diff = hasBefore && hasAfter ? Number(after) - Number(before) : null
                      const color = diff === null ? '#64748B' : diff > 0 ? '#15803D' : diff < 0 ? '#DC2626' : '#64748B'
                      const background = diff === null ? '#F1F5F9' : diff > 0 ? '#DCFCE7' : diff < 0 ? '#FEE2E2' : '#F1F5F9'
                      return (
                        <div key={key} style={{ padding: '8px 11px', borderRadius: 9, border: `1px solid ${color}35`, background, color, lineHeight: 1.65 }}>
                          <strong>{fieldLabel(key)}</strong>{' · '}
                          {before === undefined ? `Now ${scoreText(after)} (previous score unavailable)` : `${scoreText(before)} → ${scoreText(after)}`}
                          {diff !== null && diff !== 0 && <strong>{` ${diff > 0 ? '▲ +' : '▼ '}${diff}`}</strong>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 16px', marginTop: 10 }}>
                {Object.entries(entry.scores || {}).filter(([key]) => !key.startsWith('__')).map(([key, value]) => (
                  <span key={key}>{fieldLabel(key)}: <b>{scoreText(value)}</b></span>
                ))}
              </div>
              {entry.feedback && <p>Feedback: {entry.feedback}</p>}
              {entry.action_plan && <p>Action plan: {entry.action_plan}</p>}
            </details>
          )
        })}
      </div>
    </div>
  )
}

const COACH_TIMELINE_SKILLS = [
  {name:'Smash',column:'smash'}, {name:'Defense',column:'defense'},
  {name:'Footwork',column:'footwork'}, {name:'Drop shot',column:'drop_shot'},
  {name:'Net play',column:'net_play'}, {name:'Serve',column:'serve'},
]

function CoachPlayerPerformanceTimeline({ records }) {
  // Mobile-only sizing: a taller plotting area without stretching SVG text.
  const [isMobileTimeline, setIsMobileTimeline] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  )
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')
    const updateMobile = () => setIsMobileTimeline(media.matches)
    updateMobile()
    if (media.addEventListener) {
      media.addEventListener('change', updateMobile)
      return () => media.removeEventListener('change', updateMobile)
    }
    media.addListener(updateMobile)
    return () => media.removeListener(updateMobile)
  }, [])
  const [selectedSkill, setSelectedSkill] = useState('all')
  const [period, setPeriod] = useState('All')
  const [hovered, setHovered] = useState(null)
  const allSkills = selectedSkill === 'all'
  const visibleSkills = allSkills
    ? COACH_TIMELINE_SKILLS
    : COACH_TIMELINE_SKILLS.filter(skill => skill.column === selectedSkill)
  const selected = visibleSkills[0] || COACH_TIMELINE_SKILLS[0]
  const days = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }
  const filtered = records
    .filter(item => !days[period] || new Date(item.recorded_at).getTime() >= Date.now() - days[period] * 86400000)
    .slice()
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
  const width = 560
  const height = isMobileTimeline ? 350 : 225
  const padX = 38
  const padY = 24
  const chartW = width - padX * 2
  const chartH = height - padY * 2
  const minT = filtered.length ? new Date(filtered[0].recorded_at).getTime() : 0
  const maxT = filtered.length ? new Date(filtered[filtered.length - 1].recorded_at).getTime() : 0
  const x = (item, index) => maxT === minT
    ? padX + (filtered.length === 1 ? 0 : chartW * index / (filtered.length - 1))
    : padX + chartW * (new Date(item.recorded_at).getTime() - minT) / (maxT - minT)
  const y = (item, column) => padY + chartH * (1 - Math.min(100, Math.max(0, Number(item[column]) || 0)) / 100)
  const fmtScore = (skill, item) => `${skill.name}: ${item[skill.column] ?? '–'}/100`
  const showLineDetails = (event, skill) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!rect || !filtered.length) return
    const svgX = (event.clientX - rect.left) * width / rect.width
    const nearestIndex = filtered.reduce((closest, item, index) =>
      Math.abs(x(item, index) - svgX) < Math.abs(x(filtered[closest], closest) - svgX)
        ? index : closest, 0)
    setHovered({ column: skill.column, index: nearestIndex })
  }
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
        <select className={styles.formSelect} aria-label="Skill to chart" value={selectedSkill}
          onChange={e => setSelectedSkill(e.target.value)} style={{ flex: '1 1 150px', minWidth: 0 }}>
          <option value="all">All Skills</option>
          {COACH_TIMELINE_SKILLS.map(item => <option key={item.column} value={item.column}>{item.name}</option>)}
        </select>
        <select className={styles.formSelect} aria-label="Time range" value={period}
          onChange={e => { setPeriod(e.target.value); setHovered(null) }} style={{ flex: '0 1 125px' }}>
          {[['All', 'All time'], ['1M', '1 month'], ['3M', '3 months'], ['6M', '6 months'], ['1Y', '1 year']]
            .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: '44px 10px', color: 'var(--text-muted, #8892A4)', textAlign: 'center', fontSize: 14 }}>
          No player self-assessments recorded yet.
        </div>
      ) : (
        <>
          <div style={{ position: 'relative' }} onMouseLeave={() => setHovered(null)}>
          {hovered && filtered[hovered.index] && (() => {
            const skill = COACH_TIMELINE_SKILLS.find(item => item.column === hovered.column)
            const item = filtered[hovered.index]
            return <div style={{ position: 'absolute', top: 3, right: 6, zIndex: 2,
              padding: '7px 10px', borderRadius: 9, background: 'var(--card, #FFFFFF)',
              border: `1px solid ${'var(--line, #EEF1F8)'}`, boxShadow: '0 4px 16px rgba(0,0,0,.10)',
              color: 'var(--text, #0D1B3E)', fontSize: 12, pointerEvents: 'none' }}>
              <strong style={{ color: PERFORMANCE_COLORS[skill.name] }}>{skill.name}: {item[skill.column]}/100</strong>
              <div style={{ color: 'var(--text-muted, #8892A4)', marginTop: 2 }}>{new Date(item.recorded_at).toLocaleDateString('en-MY')}</div>
            </div>
          })()}
          <svg viewBox={`0 0 ${width} ${height}`} role="img"
            aria-label={allSkills ? 'Development of all six skills' : `${selected.name} score development`}
            style={{ width: '100%', height: 'auto', minHeight: 160, display: 'block' }}>
            {[0, 25, 50, 75, 100].map(score => {
              const lineY = padY + chartH * (1 - score / 100)
              return <g key={score}>
                <line x1={padX} x2={width - padX} y1={lineY} y2={lineY} stroke="var(--line, #E5E7EB)" strokeDasharray="4 5" />
                <text x={padX - 9} y={lineY + 4} textAnchor="end" fontSize="12" fill="var(--text-muted, #8892A4)">{score}</text>
              </g>
            })}
            {visibleSkills.map(skill => {
              const color = PERFORMANCE_COLORS[skill.name] || '#2563EB'
              const points = filtered.map((item, index) => `${x(item, index)},${y(item, skill.column)}`).join(' ')
              return <g key={skill.column}>
                {filtered.length > 1 && <polyline points={points} fill="none" stroke={color}
                  strokeWidth={allSkills ? '2.5' : '3'} strokeLinecap="round" strokeLinejoin="round" />}
                {filtered.length > 1 && <polyline points={points} fill="none" stroke="transparent"
                  strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"
                  style={{ cursor: 'crosshair', pointerEvents: 'stroke' }}
                  onMouseMove={event => showLineDetails(event, skill)}
                  onMouseEnter={event => showLineDetails(event, skill)} />}
                {filtered.map((item, index) =>
                  <circle key={`${skill.column}-${item.recorded_at}-${index}`}
                    cx={x(item, index)} cy={y(item, skill.column)} r={allSkills ? 3.5 : 5}
                    fill={color} stroke="var(--card, white)" strokeWidth="1.5"
                    style={{ cursor: 'crosshair' }}
                    onMouseEnter={() => setHovered({ column: skill.column, index })}
                    onMouseMove={() => setHovered({ column: skill.column, index })}>
                    <title>{`${new Date(item.recorded_at).toLocaleDateString('en-MY')}: ${fmtScore(skill, item)}`}</title>
                  </circle>
                )}
              </g>
            })}
            {filtered.length === 1 ? (
              <text x={padX} y={height - 4} textAnchor="start" fontSize="12" fill="var(--text-muted, #8892A4)">
                {new Date(filtered[0].recorded_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: '2-digit' })}
              </text>
            ) : (
              <>
                <text x={padX} y={height - 4} fontSize="12" fill="var(--text-muted, #8892A4)">
                  {new Date(filtered[0].recorded_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: '2-digit' })}
                </text>
                <text x={width - padX} y={height - 4} textAnchor="end" fontSize="12" fill="var(--text-muted, #8892A4)">
                  {new Date(filtered[filtered.length - 1].recorded_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: '2-digit' })}
                </text>
              </>
            )}
          </svg>
          </div>
          {allSkills && (
            <div style={{ display: 'flex', gap: isMobileTimeline ? '7px 9px' : '8px 15px', flexWrap: 'wrap', margin: '24px 0 12px', paddingTop: 12, borderTop: '1px solid var(--line, #E5E7EB)' }}>
              {COACH_TIMELINE_SKILLS.map(skill => (
                <span key={skill.column} title={`${skill.name}: ${filtered[filtered.length - 1][skill.column] ?? '–'}/100`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: isMobileTimeline ? 4 : 6, fontSize: isMobileTimeline ? 10 : 12, color: 'var(--text, #0D1B3E)' }}>
                  <span style={{ width: isMobileTimeline ? 10 : 15, height: 3, borderRadius: 3, background: PERFORMANCE_COLORS[skill.name] }} />
                  {skill.name}
                </span>
              ))}
            </div>
          )}
          {filtered.length === 1 && (
            <div style={{ color: 'var(--text-muted, #8892A4)', fontSize: 12, lineHeight: 1.55, marginTop: 8 }}>
              All six skills have only one saved assessment, so they appear as dots until another changed assessment is recorded.
            </div>
          )}
          <div style={{ color: 'var(--text-muted, #8892A4)', fontSize: 12, lineHeight: 1.55, marginTop: 12 }}>
            Based on the Player's saved self-assessment history. Coach assessments are shown separately and do not change this timeline.
          </div>
        </>
      )}
    </div>
  )
}

export default function CoachProgress() {
  const { user } = useAuth()
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1600
  )

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth)
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])
  const progressSingleColumn = viewportWidth <= 900
  const progressCompact = viewportWidth <= 1350
  const [students, setStudents] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const showLoader = useLoadingDelay(loading, 350)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [progressSaveNotice, setProgressSaveNotice] = useState(null)
  const [progressSection, setProgressSection] = useState('performance')
  const [assessmentHistory, setAssessmentHistory] = useState([])
  const [performanceRecordsOpen, setPerformanceRecordsOpen] = useState(false)
  const [developmentSection, setDevelopmentSection] = useState(null)
  const [playerSkillHistory, setPlayerSkillHistory] = useState([])
  const [developmentLoading, setDevelopmentLoading] = useState(false)
  const [developmentError, setDevelopmentError] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [matchModalOpen, setMatchModalOpen] =
    useState(false)
  const [matchDetailOpen, setMatchDetailOpen] =
    useState(false)
  const [matchNoteOpen, setMatchNoteOpen] =
    useState(false)
  const [allMatchesOpen, setAllMatchesOpen] =
    useState(false)
  const [allInjuriesOpen, setAllInjuriesOpen] =
    useState(false)
  const [fitnessRecordsOpen, setFitnessRecordsOpen] =
    useState(false)
  const [fitnessTestAddOpen, setFitnessTestAddOpen] =
    useState(false)
  const [fitnessTestEditOpen, setFitnessTestEditOpen] =
    useState(false)
  const [editingFitnessTest, setEditingFitnessTest] =
    useState(null)
  const [savingFitnessTest, setSavingFitnessTest] =
    useState(false)
  const [selectedMatch, setSelectedMatch] =
    useState(null)
  const [selectedInjury, setSelectedInjury] =
    useState(null)
  const [injuryDetailOpen, setInjuryDetailOpen] =
    useState(false)
  const [matchNote, setMatchNote] = useState('')
  const [savingMatch, setSavingMatch] =
    useState(false)
  const [savingMatchNote, setSavingMatchNote] =
    useState(false)
  const [matchForm, setMatchForm] = useState({
    date: new Date()
      .toISOString()
      .split('T')[0],
    type: 'Singles',
    opponent: '',
    opponentUserId: null,
    opponent2: '',
    opponentUserId2: null,
    partnerName: '',
    partnerUserId: null,
    score1: '',
    score2: '',
    score3: '',
    result: 'Win',
    notes: '',
  })
  const [fitnessTestForm, setFitnessTestForm] = useState({
    date: new Date().toISOString().split('T')[0],
    indicator: '',
    test: '',
    result: '',
    score: 0,
    adjustmentSign: '+',
    adjustmentAmount: 0,
  })
  const [
    partnerSuggestions,
    setPartnerSuggestions,
  ] = useState([])
  const [
    opponent1Suggestions,
    setOpponent1Suggestions,
  ] = useState([])
  const [
    opponent2Suggestions,
    setOpponent2Suggestions,
  ] = useState([])
  const [
    recommendationOpen,
    setRecommendationOpen,
  ] = useState(false)
  const [
    injuryRecommendation,
    setInjuryRecommendation,
  ] = useState('')
  const [
    savingRecommendation,
    setSavingRecommendation,
  ] = useState(false)
  const [form, setForm] = useState({
    progress_status: 'On track',
    focus_area: '',
    performance_comment: '',
    performance_action_plan: '',
    performance_action_deadline: '',
    performance_action_completion: 0,
    fitness_comment: '',
    fitness_action_plan: '',
    fitness_action_deadline: '',
    fitness_action_completion: 0,
    performance_review_date: '',
    fitness_review_date: '',
    smash: 50,
    defense: 50,
    footwork: 50,
    drop_shot: 50,
    net_play: 50,
    serve: 50,
    endurance: 50,
    speed: 50,
    strength: 50,
    agility: 50,
    recovery: 50,
  })
  const loadProgress = useCallback(async () => {
    if (!user?.id) {
      setStudents([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const {
        data: relationships,
        error: relationshipError,
      } = await supabase
        .from(
          'coach_player_relationships'
        )
        .select('player_user_id')
        .eq('coach_user_id', user.id)
        .eq('status', 'accepted')
      if (relationshipError) {
        throw relationshipError
      }
      const studentUserIds = [
        ...new Set(
          (relationships || [])
            .map(
              row => row.player_user_id
            )
            .filter(Boolean)
        ),
      ]
      if (studentUserIds.length === 0) {
        setStudents([])
        setSelectedId(null)
        return
      }
      const [
        profilesResult,
        trainingResult,
        testsResult,
        recoveryResult,
        injuriesResult,
        progressResult,
        assessmentResult,
        taggedScheduleResult,
      ] = await Promise.all([
        supabase
          .from('player_profiles')
          .select('*')
          .in(
            'user_id',
            studentUserIds
          )
          .order('display_name', {
            ascending: true,
          }),
        supabase
          .from('fitness_training_logs')
          .select('*')
          .in(
            'user_id',
            studentUserIds
          ),
        supabase
          .from('fitness_tests')
          .select('*')
          .in(
            'user_id',
            studentUserIds
          ),
        supabase
          .from(
            'fitness_recovery_logs'
          )
          .select('*')
          .in(
            'user_id',
            studentUserIds
          ),
        supabase
          .from('fitness_injuries')
          .select('*')
          .in(
            'user_id',
            studentUserIds
          ),
        supabase
          .from(
            'coach_player_progress'
          )
          .select('*')
          .eq(
            'coach_user_id',
            user.id
          )
          .in(
            'player_user_id',
            studentUserIds
          ),
        supabase
          .from(
            'coach_player_assessments'
          )
          .select('*')
          .eq(
            'coach_user_id',
            user.id
          )
          .in(
            'player_user_id',
            studentUserIds
          ),
        supabase
          .from('player_schedule')
          .select('*')
          .eq(
            'tagged_coach_user_id',
            user.id
          )
          .in(
            'user_id',
            studentUserIds
          )
          .in(
            'schedule_type',
            ['Competition', 'Friendly Match']
          )
          .gte(
            'event_date',
            new Date()
              .toISOString()
              .slice(0, 10)
          )
          .order('event_date', {
            ascending: true,
          })
          .order('event_time', {
            ascending: true,
          }),
      ])
      const firstError = [
        profilesResult.error,
        trainingResult.error,
        testsResult.error,
        recoveryResult.error,
        injuriesResult.error,
        progressResult.error,
        taggedScheduleResult.error,
      ].find(Boolean)
      if (firstError) {
        throw firstError
      }
      const profileRows =
        profilesResult.data || []
      const profileIds = profileRows
        .map(profile => profile.id)
        .filter(Boolean)
      const [skillResult, matchResult] =
        profileIds.length
          ? await Promise.all([
              supabase
                .from(
                  'player_skill_ratings'
                )
                .select('*')
                .in(
                  'player_id',
                  profileIds
                ),
              supabase
                .from('player_matches')
                .select('*')
                .in(
                  'player_id',
                  profileIds
                )
                .order('match_date', {
                  ascending: false,
                })
                .order('created_at', {
                  ascending: false,
                }),
            ])
          : [
              {
                data: [],
                error: null,
              },
              {
                data: [],
                error: null,
              },
            ]
      if (skillResult.error) {
        throw skillResult.error
      }
      if (matchResult.error) {
        throw matchResult.error
      }
      const skillRows =
        skillResult.data || []
      const matchRows =
        matchResult.data || []
      const matchIds = matchRows
        .map(row => row.id)
        .filter(Boolean)
      let coachNoteRows = []
      if (matchIds.length > 0) {
        const {
          data: noteRows,
          error: noteError,
        } = await supabase
          .from('coach_match_notes')
          .select('*')
          .eq(
            'coach_user_id',
            user.id
          )
          .in('match_id', matchIds)
        if (noteError) {
          console.error(
            'Coach match notes load error:',
            noteError
          )
        } else {
          coachNoteRows =
            noteRows || []
        }
      }
      const coachNoteByMatchId =
        new Map(
          coachNoteRows.map(row => [
            String(row.match_id),
            row,
          ])
        )
      const matchesByProfileId =
        new Map()
      matchRows.forEach(row => {
        const key = String(
          row.player_id
        )
        const current =
          matchesByProfileId.get(key) ||
          []
        current.push(
          mapPlayerMatch(
            row,
            coachNoteByMatchId.get(
              String(row.id)
            ) || null
          )
        )
        matchesByProfileId.set(
          key,
          current
        )
      })
      const skillsByProfileId =
        new Map(
          skillRows.map(row => [
            String(row.player_id),
            row,
          ])
        )
      const progressByUserId =
        new Map(
          (
            progressResult.data || []
          ).map(row => [
            String(
              row.player_user_id
            ),
            row,
          ])
        )
      if (assessmentResult.error) {
        console.error(
          'Coach assessment load error:',
          assessmentResult.error
        )
      }
      const assessmentByUserId =
        new Map(
          (
            assessmentResult.error
              ? []
              : assessmentResult.data ||
                []
          ).map(row => [
            String(
              row.player_user_id
            ),
            row,
          ])
        )
      const groupedByUserId = rows => {
        const map = new Map()
        ;(rows || []).forEach(row => {
          const key = String(
            row.user_id
          )
          const current =
            map.get(key) || []
          current.push(row)
          map.set(key, current)
        })
        return map
      }
      const trainingByUserId =
        groupedByUserId(
          trainingResult.data
        )
      const testsByUserId =
        groupedByUserId(
          testsResult.data
        )
      const recoveryByUserId =
        groupedByUserId(
          recoveryResult.data
        )
      const injuriesByUserId =
        groupedByUserId(
          injuriesResult.data
        )
      const taggedUpcomingByUserId =
        new Map()
      ;(
        taggedScheduleResult.data ||
        []
      ).forEach(row => {
        const mapped =
          mapTaggedUpcomingMatch(row)
        if (
          mapped.status !==
          'scheduled'
        ) {
          return
        }
        const key = String(
          row.user_id || ''
        )
        if (!key) return
        const current =
          taggedUpcomingByUserId.get(
            key
          ) || []
        current.push(mapped)
        taggedUpcomingByUserId.set(
          key,
          current
        )
      })
      const normalizedStudents =
        profileRows.map(profile => {
          const userId = String(
            profile.user_id
          )
          const skillRow =
            skillsByProfileId.get(
              String(profile.id)
            ) || {}
          const performance = {
            smash: Number(
              skillRow.smash ??
                DEFAULT_SCORE
            ),
            defense: Number(
              skillRow.defense ??
                DEFAULT_SCORE
            ),
            footwork: Number(
              skillRow.footwork ??
                DEFAULT_SCORE
            ),
            dropShot: Number(
              skillRow.drop_shot ??
                DEFAULT_SCORE
            ),
            netPlay: Number(
              skillRow.net_play ??
                DEFAULT_SCORE
            ),
            serve: Number(
              skillRow.serve ??
                DEFAULT_SCORE
            ),
          }
          const injuryRows =
            injuriesByUserId.get(
              userId
            ) || []
          const playerFitnessTests =
            (testsByUserId.get(userId) || []).filter(
              test => !test.added_by_coach
            )
          const fitness =
            calculateFitnessIndicators({
              tests: playerFitnessTests,
              trainingLogs:
                trainingByUserId.get(
                  userId
                ) || [],
              recoveryLogs:
                recoveryByUserId.get(
                  userId
                ) || [],
              injuries: injuryRows,
            })
          const normalizedInjuries =
            injuryRows
              .map(normalizeInjury)
              .sort((a, b) => {
                if (
                  a.isActive !==
                  b.isActive
                ) {
                  return a.isActive
                    ? -1
                    : 1
                }
                const dateCompare =
                  String(
                    b.date || ''
                  ).localeCompare(
                    String(
                      a.date || ''
                    )
                  )
                if (
                  dateCompare !== 0
                ) {
                  return dateCompare
                }
                return String(
                  b.createdAt || ''
                ).localeCompare(
                  String(
                    a.createdAt || ''
                  )
                )
              })
          const activeInjuryCount =
            normalizedInjuries.filter(
              injury =>
                injury.isActive
            ).length
          return {
            id: profile.user_id,
            profileId: profile.id,
            name:
              profile.display_name ||
              'Unnamed player',
            level:
              profile.playing_level ||
              profile.level ||
              profile.player_category ||
              profile.category ||
              'Not specified',
            club:
              profile.club ||
              'No club',
            state:
              profile.state ||
              profile.location ||
              '',
            performance,
            fitness,
            fitnessTests:
              (testsByUserId.get(userId) || [])
                .slice()
                .sort((a, b) => {
                  const dateCompare =
                    String(b.test_date || '').localeCompare(
                      String(a.test_date || '')
                    )
                  if (dateCompare !== 0) {
                    return dateCompare
                  }
                  return String(
                    b.created_at || ''
                  ).localeCompare(
                    String(a.created_at || '')
                  )
                }),
            injuries:
              normalizedInjuries,
            activeInjuryCount,
            performanceAverage:
              averageValues(
                Object.values(
                  performance
                )
              ),
            fitnessAverage:
              averageValues(
                Object.values(
                  fitness
                )
              ),
            matches:
              matchesByProfileId.get(
                String(profile.id)
              ) || [],
            upcomingMatches:
              taggedUpcomingByUserId.get(
                userId
              ) || [],
            progress:
              progressByUserId.get(
                userId
              ) || null,
            assessment:
              assessmentByUserId.get(
                userId
              ) || null,
          }
        })
      setStudents(
        normalizedStudents
      )
      setSelectedId(current =>
        normalizedStudents.some(
          student =>
            student.id === current
        )
          ? current
          : null
      )
      try {
        const today =
          new Date()
            .toISOString()
            .slice(0, 10)
        const {
          data: reminderSettings,
          error: reminderSettingsError,
        } = await supabase
          .from('user_settings')
          .select('coach_progress_reminder')
          .eq('user_id', user.id)
          .maybeSingle()
        if (reminderSettingsError) {
          console.error(
            'Load progress reminder setting error:',
            reminderSettingsError
          )
        }
        const remindersEnabled =
          reminderSettings?.coach_progress_reminder !== false
        if (remindersEnabled) {
          const reminderCandidates = []
          normalizedStudents.forEach(student => {
            if (!student.progress?.coach_comment) {
              return
            }
            const actionPlans =
              decodeActionPlans(
                student.progress.coach_comment
              )
            const plans = [
              {
                type: 'Performance',
                text: actionPlans.performance,
                deadline:
                  actionPlans.performanceDeadline,
                completion:
                  clamp(
                    actionPlans.performanceCompletion
                  ),
              },
              {
                type: 'Fitness',
                text: actionPlans.fitness,
                deadline:
                  actionPlans.fitnessDeadline,
                completion:
                  clamp(
                    actionPlans.fitnessCompletion
                  ),
              },
            ]
            plans.forEach(plan => {
              const hasPlan =
                Boolean(
                  String(plan.text || '').trim() ||
                  String(plan.deadline || '').trim() ||
                  plan.completion > 0
                )
              if (!hasPlan) {
                return
              }
              const deadline =
                String(
                  plan.deadline || ''
                ).slice(0, 10)
              const isCompleted =
                plan.completion >= 100
              const isDueToday =
                Boolean(
                  deadline &&
                  deadline === today &&
                  !isCompleted
                )
              const isOverdue =
                Boolean(
                  deadline &&
                  deadline < today &&
                  !isCompleted
                )
              if (
                !isCompleted &&
                !isDueToday &&
                !isOverdue
              ) {
                return
              }
              let title = ''
              let message = ''
              let type = 'warning'
              const planName =
                `${plan.type.toLowerCase()} action plan`
              if (isCompleted) {
                title = 'Action Plan Completed'
                type = 'success'
                message = deadline
                  ? `${student.name} completed the ${planName} with deadline ${formatDate(
                      deadline
                    )}.`
                  : `${student.name} completed the ${planName}.`
              } else if (isDueToday) {
                title = 'Action Plan Due Today'
                message =
                  `${student.name}'s ${planName} is due today.`
              } else {
                title = 'Action Plan Overdue'
                message =
                  `${student.name}'s ${planName} was due on ${formatDate(
                    deadline
                  )} and is still ${plan.completion}% complete.`
              }
              reminderCandidates.push({
                user_id: user.id,
                title,
                message,
                type,
                source_type:
                  'coach_progress_reminder',
                action_url:
                  '/coach/progress',
                is_read: false,
              })
            })
          })
          if (reminderCandidates.length > 0) {
            const {
              data: existingReminders,
              error: existingReminderError,
            } = await supabase
              .from('notifications')
              .select('id, title, message')
              .eq('user_id', user.id)
              .eq(
                'source_type',
                'coach_progress_reminder'
              )
            if (existingReminderError) {
              console.error(
                'Load existing progress reminders error:',
                existingReminderError
              )
            } else {
              const existingKeys =
                new Set(
                  (
                    existingReminders || []
                  ).map(item =>
                    `${String(
                      item.title || ''
                    )}|${String(
                      item.message || ''
                    )}`
                  )
                )
              const remindersToInsert =
                reminderCandidates.filter(
                  reminder => {
                    const key =
                      `${reminder.title}|${reminder.message}`
                    return !existingKeys.has(key)
                  }
                )
              if (
                remindersToInsert.length > 0
              ) {
                const {
                  error: reminderInsertError,
                } = await supabase
                  .from('notifications')
                  .insert(
                    remindersToInsert
                  )
                if (reminderInsertError) {
                  console.error(
                    'Create progress reminders error:',
                    reminderInsertError
                  )
                }
              }
            }
          }
        }
      } catch (reminderError) {
        console.error(
          'Progress reminder generation error:',
          reminderError
        )
      }
    } catch (loadError) {
      console.error(
        'Coach progress load error:',
        loadError
      )
      setError(
        loadError.message ||
          'Unable to load student progress from the database.'
      )
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadProgress()
  }, [loadProgress])
  const selectedStudent = useMemo(
    () =>
      students.find(
        student =>
          student.id === selectedId
      ) || null,
    [students, selectedId]
  )
  // Read history only for the selected player and current coach.
  const loadAssessmentHistory = useCallback(async () => {
    if (!selectedId || !user?.id) {
      setAssessmentHistory([])
      return
    }
    setHistoryLoading(true)
    setHistoryError('')
    const { data, error: readError } = await supabase
      .from('coach_assessment_history')
      .select('id, section, scores, feedback, action_plan, changed_fields, recorded_at')
      .eq('coach_user_id', user.id)
      .eq('player_user_id', selectedId)
      .order('recorded_at', { ascending: false })
      .limit(100)
    if (readError) {
      setAssessmentHistory([])
      setHistoryError('History unavailable. Run the accompanying SQL setup first.')
    } else {
      setAssessmentHistory(data || [])
    }
    setHistoryLoading(false)
  }, [selectedId, user?.id])

  useEffect(() => {
    loadAssessmentHistory()
  }, [loadAssessmentHistory])

  const openDevelopment = async section => {
    if (!selectedStudent) return
    const player = selectedStudent
    setDevelopmentSection(section)
    setDevelopmentError('')
    if (section !== 'performance') return
    setDevelopmentLoading(true)
    setPlayerSkillHistory([])
    try {
      const { data, error: historyError } = await supabase
        .from('player_skill_rating_history')
        .select('recorded_at, smash, defense, footwork, drop_shot, net_play, serve')
        .eq('player_id', player.profileId)
        .order('recorded_at', { ascending: true })
      if (historyError) throw historyError
      setPlayerSkillHistory(data || [])
    } catch (readError) {
      console.error('Coach player performance development load error:', readError)
      setDevelopmentError('Unable to load Player Performance history. Check whether accepted coaches have SELECT permission on player_skill_rating_history.')
    } finally {
      setDevelopmentLoading(false)
    }
  }

  const selectedActionPlans =
    useMemo(
      () =>
        decodeActionPlans(
          selectedStudent
            ?.progress
            ?.coach_comment
        ),
      [
        selectedStudent
          ?.progress
          ?.coach_comment,
      ]
    )
  const selectedHasCoachProgress =
    useMemo(
      () =>
        hasCoachProgressRecord(
          selectedStudent
        ),
      [selectedStudent]
    )
  const hasPerformanceFeedback =
    Boolean(
      String(
        selectedStudent
          ?.assessment
          ?.performance_comment ||
          ''
      ).trim()
    )
  const hasPerformanceActionPlan =
    Boolean(
      String(
        selectedActionPlans.performance ||
          ''
      ).trim() ||
      String(
        selectedActionPlans.performanceDeadline ||
          ''
      ).trim() ||
      Number(
        selectedActionPlans.performanceCompletion ||
          0
      ) > 0
    )
  const hasFitnessFeedback =
    Boolean(
      String(
        selectedStudent
          ?.assessment
          ?.fitness_comment ||
          ''
      ).trim()
    )
  const hasFitnessActionPlan =
    Boolean(
      String(
        selectedActionPlans.fitness ||
          ''
      ).trim() ||
      String(
        selectedActionPlans.fitnessDeadline ||
          ''
      ).trim() ||
      Number(
        selectedActionPlans.fitnessCompletion ||
          0
      ) > 0
    )
  const getCoachFitnessValue = useCallback(
    fieldKey => {
      if (!selectedStudent) {
        return null
      }
      const indicatorLabel =
        FITNESS_FIELDS.find(
          field => field.key === fieldKey
        )?.label || fieldKey
      const latestCoachTest =
        (selectedStudent.fitnessTests || [])
          .filter(
            test =>
              test.added_by_coach &&
              String(test.indicator || '')
                .trim()
                .toLowerCase() ===
                String(indicatorLabel || '')
                  .trim()
                  .toLowerCase()
          )
          .slice()
          .sort((a, b) => {
            const aTime =
              new Date(
                a.created_at ||
                  `${a.test_date || ''}T00:00:00`
              ).getTime() || 0
            const bTime =
              new Date(
                b.created_at ||
                  `${b.test_date || ''}T00:00:00`
              ).getTime() || 0
            return bTime - aTime
          })[0] || null
      const assessmentValue =
        selectedStudent.assessment?.[
          fieldKey
        ]
      const hasAssessmentValue =
        assessmentValue !== null &&
        assessmentValue !== undefined &&
        Number.isFinite(
          Number(assessmentValue)
        )
      if (!latestCoachTest) {
        return hasAssessmentValue
          ? Number(assessmentValue)
          : null
      }
      const coachTestValue =
        Number(latestCoachTest.score)
      if (
        !Number.isFinite(coachTestValue)
      ) {
        return hasAssessmentValue
          ? Number(assessmentValue)
          : null
      }
      if (!hasAssessmentValue) {
        return coachTestValue
      }
      const coachTestTime =
        new Date(
          latestCoachTest.created_at ||
            `${latestCoachTest.test_date || ''}T00:00:00`
        ).getTime() || 0
      const assessmentTime =
        new Date(
          selectedStudent.assessment
            ?.updated_at || 0
        ).getTime() || 0
      return coachTestTime >=
        assessmentTime
        ? coachTestValue
        : Number(assessmentValue)
    },
    [selectedStudent]
  )
  const searchMatchPlayers =
    useCallback(
      async (keyword, setter) => {
        const term = String(
          keyword || ''
        ).trim()
        if (term.length < 2) {
          setter([])
          return
        }
        try {
          const [
            registeredRes,
            publicRes,
          ] = await Promise.all([
            supabase
              .from(
                'player_profiles'
              )
              .select(
                'id, user_id, display_name, profile_photo_url'
              )
              .ilike(
                'display_name',
                `%${term}%`
              )
              .limit(6),
            supabase
              .from(
                'public_players'
              )
              .select('id, name')
              .ilike(
                'name',
                `%${term}%`
              )
              .limit(6),
          ])
          if (
            registeredRes.error
          ) {
            console.error(
              'Registered player search error:',
              registeredRes.error
            )
          }
          if (publicRes.error) {
            console.error(
              'Public player search error:',
              publicRes.error
            )
          }
          const registeredPlayers =
            (
              registeredRes.data ||
              []
            )
              .filter(
                player =>
                  String(
                    player.user_id ||
                      ''
                  ) !==
                  String(
                    selectedStudent?.id ||
                      ''
                  )
              )
              .map(player => ({
                id:
                  `registered-${player.id}`,
                profileId:
                  player.id,
                user_id:
                  player.user_id,
                display_name:
                  player.display_name,
                profile_photo_url:
                  player.profile_photo_url ||
                  '',
                source:
                  'Account',
              }))
          const publicPlayers =
            (
              publicRes.data || []
            ).map(player => ({
              id:
                `public-${player.id}`,
              publicId:
                player.id,
              user_id: null,
              display_name:
                player.name,
              profile_photo_url:
                '',
              source:
                'Public player',
            }))
          const seen = new Set()
          const merged = [
            ...registeredPlayers,
            ...publicPlayers,
          ]
            .filter(player => {
              const key = String(
                player.display_name ||
                  ''
              )
                .trim()
                .toLowerCase()
              if (
                !key ||
                seen.has(key)
              ) {
                return false
              }
              seen.add(key)
              return true
            })
            .slice(0, 8)
          setter(merged)
        } catch (searchError) {
          console.error(
            'Match player search error:',
            searchError
          )
          setter([])
        }
      },
      [selectedStudent?.id]
    )

  useEffect(() => {
    const timer = setTimeout(
      () =>
        searchMatchPlayers(
          matchForm.partnerName,
          setPartnerSuggestions
        ),
      250
    )
    return () => clearTimeout(timer)
  }, [
    matchForm.partnerName,
    searchMatchPlayers,
  ])

  useEffect(() => {
    const timer = setTimeout(
      () =>
        searchMatchPlayers(
          matchForm.opponent,
          setOpponent1Suggestions
        ),
      250
    )
    return () => clearTimeout(timer)
  }, [
    matchForm.opponent,
    searchMatchPlayers,
  ])

  useEffect(() => {
    const timer = setTimeout(
      () =>
        searchMatchPlayers(
          matchForm.opponent2,
          setOpponent2Suggestions
        ),
      250
    )
    return () => clearTimeout(timer)
  }, [
    matchForm.opponent2,
    searchMatchPlayers,
  ])
  const selectMatchPlayer = (
    field,
    player
  ) => {
    if (field === 'partner') {
      setMatchForm(current => ({
        ...current,
        partnerName:
          player.display_name,
        partnerUserId:
          player.user_id,
      }))
      setPartnerSuggestions([])
      return
    }
    if (field === 'opponent1') {
      setMatchForm(current => ({
        ...current,
        opponent:
          player.display_name,
        opponentUserId:
          player.user_id,
      }))
      setOpponent1Suggestions([])
      return
    }
    if (field === 'opponent2') {
      setMatchForm(current => ({
        ...current,
        opponent2:
          player.display_name,
        opponentUserId2:
          player.user_id,
      }))
      setOpponent2Suggestions([])
    }
  }
  const totalNotes = useMemo(
    () =>
      students.filter(
        hasMeaningfulProgressNote
      ).length,
    [students]
  )
  const resetMatchForm = () => {
    setMatchForm({
      date: new Date()
        .toISOString()
        .split('T')[0],
      type: 'Singles',
      opponent: '',
      opponentUserId: null,
      opponent2: '',
      opponentUserId2: null,
      partnerName: '',
      partnerUserId: null,
      score1: '',
      score2: '',
      score3: '',
      result: 'Win',
      notes: '',
    })
    setPartnerSuggestions([])
    setOpponent1Suggestions([])
    setOpponent2Suggestions([])
  }
  const handleFitnessTestChange = (key, value) => {
    setFitnessTestForm(current => ({
      ...current,
      [key]: value,
    }))
  }
  const getPlayerFitnessTestScore = indicator => {
    if (!selectedStudent) return null
    const normalizedIndicator =
      String(indicator || '')
        .trim()
        .toLowerCase()
    const latestPlayerTest =
      (selectedStudent.fitnessTests || [])
        .filter(
          test =>
            !test.added_by_coach &&
            String(test.indicator || '')
              .trim()
              .toLowerCase() ===
              normalizedIndicator
        )
        .slice()
        .sort((a, b) => {
          const aTime =
            new Date(
              a.created_at ||
                `${a.test_date || ''}T00:00:00`
            ).getTime() || 0
          const bTime =
            new Date(
              b.created_at ||
                `${b.test_date || ''}T00:00:00`
            ).getTime() || 0
          return bTime - aTime
        })[0] || null
    if (
      !latestPlayerTest ||
      !Number.isFinite(
        Number(latestPlayerTest.score)
      )
    ) {
      return null
    }
    return Number(latestPlayerTest.score)
  }
  const openEditFitnessTest = test => {
    if (
      !test?.added_by_coach ||
      String(test.coach_user_id || '') !== String(user?.id || '')
    ) {
      return
    }
    setEditingFitnessTest(test)
    setFitnessTestForm({
      date:
        String(test.test_date || '').slice(0, 10) ||
        new Date().toISOString().split('T')[0],
      indicator: test.indicator || '',
      test: test.test_name || '',
      result: test.result || '',
      score: clamp(test.score),
      adjustmentSign: '+',
      adjustmentAmount: 0,
    })
    setFitnessRecordsOpen(false)
    setFitnessTestEditOpen(true)
    setError('')
    setSuccess('')
  }
  const saveEditedFitnessTest = async () => {
    if (
      !user?.id ||
      !selectedStudent ||
      !editingFitnessTest ||
      savingFitnessTest
    ) {
      return
    }
    if (
      !editingFitnessTest.added_by_coach ||
      String(editingFitnessTest.coach_user_id || '') !== String(user.id)
    ) {
      alert('You can only edit fitness tests that you added.')
      return
    }
    if (!fitnessTestForm.test.trim()) {
      alert('Please enter the test name.')
      return
    }
    if (!fitnessTestForm.result.trim()) {
      alert('Please enter the test result.')
      return
    }
    setSavingFitnessTest(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        test_date: fitnessTestForm.date,
        indicator: fitnessTestForm.indicator,
        test_name: fitnessTestForm.test.trim(),
        result: fitnessTestForm.result.trim(),
        score: clamp(fitnessTestForm.score),
        change_note:
          Number(fitnessTestForm.adjustmentAmount) > 0
            ? `${fitnessTestForm.adjustmentSign === '-' ? '-' : '+'}${Number(
                fitnessTestForm.adjustmentAmount
              )} points`
            : 'Updated',
        updated_at: new Date().toISOString(),
      }
      const {
        data,
        error: updateError,
      } = await supabase
        .from('fitness_tests')
        .update(payload)
        .eq('id', editingFitnessTest.id)
        .eq('added_by_coach', true)
        .eq('coach_user_id', user.id)
        .select('*')
        .single()
      if (updateError) {
        throw updateError
      }
      const indicatorKey =
        String(fitnessTestForm.indicator || '')
          .trim()
          .toLowerCase()
      const syncedCoachScore =
        clamp(fitnessTestForm.score)
      const {
        data: syncedAssessment,
        error: assessmentSyncError,
      } = await supabase
        .from('coach_player_assessments')
        .upsert(
          {
            coach_user_id: user.id,
            player_user_id: selectedStudent.id,
            [indicatorKey]: syncedCoachScore,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict:
              'coach_user_id,player_user_id',
          }
        )
        .select('*')
        .single()
      if (assessmentSyncError) {
        throw assessmentSyncError
      }
      setStudents(current =>
        current.map(student =>
          student.id === selectedStudent.id
            ? {
                ...student,
                fitnessTests: (
                  student.fitnessTests || []
                )
                  .map(test =>
                    test.id === data.id
                      ? data
                      : test
                  )
                  .sort((a, b) => {
                    const dateCompare =
                      String(b.test_date || '').localeCompare(
                        String(a.test_date || '')
                      )
                    if (dateCompare !== 0) {
                      return dateCompare
                    }
                    return String(
                      b.created_at || ''
                    ).localeCompare(
                      String(a.created_at || '')
                    )
                  }),
                assessment: {
                  ...(student.assessment || {}),
                  ...(syncedAssessment || {}),
                  [indicatorKey]:
                    syncedCoachScore,
                },
              }
            : student
        )
      )
      setFitnessTestEditOpen(false)
      setEditingFitnessTest(null)
      setFitnessRecordsOpen(true)
      setSuccess(
        `Coach fitness test updated for ${selectedStudent.name}.`
      )
    } catch (saveError) {
      console.error(
        'Update coach fitness test error:',
        saveError
      )
      setError(
        saveError.message ||
          'Unable to update the fitness test record.'
      )
    } finally {
      setSavingFitnessTest(false)
    }
  }
  const resetFitnessTestForm = () => {
    setFitnessTestForm({
      date: new Date().toISOString().split('T')[0],
      indicator: '',
      test: '',
      result: '',
      score: 0,
      adjustmentSign: '+',
      adjustmentAmount: 0,
    })
  }
  const openAddFitnessTest = () => {
    if (!selectedStudent) return
    resetFitnessTestForm()
    setFitnessRecordsOpen(false)
    setFitnessTestAddOpen(true)
    setError('')
    setSuccess('')
  }
  const saveCoachFitnessTest = async () => {
    if (
      !user?.id ||
      !selectedStudent ||
      savingFitnessTest
    ) {
      return
    }
    if (!fitnessTestForm.test.trim()) {
      alert('Please enter the test name.')
      return
    }
    if (!fitnessTestForm.result.trim()) {
      alert('Please enter the test result.')
      return
    }
    setSavingFitnessTest(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        user_id: selectedStudent.id,
        test_date: fitnessTestForm.date,
        indicator: fitnessTestForm.indicator,
        test_name: fitnessTestForm.test.trim(),
        result: fitnessTestForm.result.trim(),
        score: clamp(fitnessTestForm.score),
        added_by_coach: true,
        coach_user_id: user.id,
        change_note:
          Number(fitnessTestForm.adjustmentAmount) > 0
            ? `${fitnessTestForm.adjustmentSign === '-' ? '-' : '+'}${Number(
                fitnessTestForm.adjustmentAmount
              )} points`
            : 'No score adjustment',
      }
      const {
        data,
        error: insertError,
      } = await supabase
        .from('fitness_tests')
        .insert(payload)
        .select('*')
        .single()
      if (insertError) {
        throw insertError
      }
      const indicatorKey =
        String(fitnessTestForm.indicator || '')
          .trim()
          .toLowerCase()
      const syncedCoachScore =
        clamp(fitnessTestForm.score)
      const assessmentPayload = {
        coach_user_id: user.id,
        player_user_id: selectedStudent.id,
        [indicatorKey]: syncedCoachScore,
        updated_at: new Date().toISOString(),
      }
      if (!selectedStudent.assessment) {
        for (const key of ['smash', 'defense', 'footwork', 'drop_shot', 'net_play', 'serve', 'endurance', 'speed', 'strength', 'agility', 'recovery']) {
          if (key !== indicatorKey) assessmentPayload[key] = null
        }
      }
      const {
        data: syncedAssessment,
        error: assessmentSyncError,
      } = await supabase
        .from('coach_player_assessments')
        .upsert(
          assessmentPayload,
          {
            onConflict:
              'coach_user_id,player_user_id',
          }
        )
        .select('*')
        .single()
      if (assessmentSyncError) {
        throw assessmentSyncError
      }
      setStudents(current =>
        current.map(student =>
          student.id === selectedStudent.id
            ? {
                ...student,
                fitnessTests: [
                  data,
                  ...(student.fitnessTests || []),
                ].sort((a, b) => {
                  const dateCompare =
                    String(b.test_date || '').localeCompare(
                      String(a.test_date || '')
                    )
                  if (dateCompare !== 0) {
                    return dateCompare
                  }
                  return String(
                    b.created_at || ''
                  ).localeCompare(
                    String(a.created_at || '')
                  )
                }),
                assessment: {
                  ...(student.assessment || {}),
                  ...(syncedAssessment || {}),
                  [indicatorKey]:
                    syncedCoachScore,
                },
              }
            : student
        )
      )
      setFitnessTestAddOpen(false)
      resetFitnessTestForm()
      setFitnessRecordsOpen(true)
      setSuccess(
        `Fitness test added for ${selectedStudent.name}. Coach ${fitnessTestForm.indicator} rating updated to ${clamp(
          fitnessTestForm.score
        )}.`
      )
    } catch (saveError) {
      console.error(
        'Save coach fitness test error:',
        saveError
      )
      setError(
        saveError.message ||
          'Unable to add the fitness test record.'
      )
    } finally {
      setSavingFitnessTest(false)
    }
  }
  const openAddMatch = () => {
    resetMatchForm()
    setMatchModalOpen(true)
    setError('')
    setSuccess('')
  }
  const saveMatch = async () => {
    if (
      !user?.id ||
      !selectedStudent ||
      savingMatch
    ) {
      return
    }
    if (
      !matchForm.opponent.trim()
    ) {
      alert(
        'Please enter the opponent name.'
      )
      return
    }
    if (
      !matchForm.score1.trim()
    ) {
      alert(
        'Please enter at least Set 1 score.'
      )
      return
    }
    const isSingles =
      matchForm.type === 'Singles'
    if (
      !isSingles &&
      !matchForm.opponent2.trim()
    ) {
      alert(
        'Please enter Opponent 2 for doubles.'
      )
      return
    }
    setSavingMatch(true)
    setError('')
    setSuccess('')
    try {
      const payload = {
        player_id:
          selectedStudent.profileId,
        match_type:
          matchForm.type,
        match_date:
          matchForm.date,
        partner_name: isSingles
          ? null
          : matchForm.partnerName.trim() ||
            null,
        partner_user_id: isSingles
          ? null
          : matchForm.partnerUserId,
        opponent_name:
          matchForm.opponent.trim(),
        opponent_user_id:
          matchForm.opponentUserId,
        opponent_name2: isSingles
          ? null
          : matchForm.opponent2.trim() ||
            null,
        opponent_user_id2:
          isSingles
            ? null
            : matchForm.opponentUserId2,
        score1:
          matchForm.score1.trim(),
        score2:
          matchForm.score2.trim() ||
          null,
        score3:
          matchForm.score3.trim() ||
          null,
        result:
          matchForm.result,
        notes:
          matchForm.notes.trim() ||
          null,
        updated_at:
          new Date().toISOString(),
      }
      const {
        data,
        error: saveError,
      } = await supabase
        .from('player_matches')
        .insert(payload)
        .select('*')
        .single()
      if (saveError) {
        throw saveError
      }
      const newMatch =
        mapPlayerMatch(data)
      setStudents(current =>
        current.map(student =>
          student.id ===
          selectedStudent.id
            ? {
                ...student,
                matches: [
                  newMatch,
                  ...(student.matches ||
                    []),
                ],
              }
            : student
        )
      )
      setMatchModalOpen(false)
      resetMatchForm()
      setSuccess(
        `Match record added for ${selectedStudent.name}.`
      )
    } catch (saveError) {
      console.error(
        'Save coach match error:',
        saveError
      )
      setError(
        saveError.message ||
          'Unable to add the match record.'
      )
    } finally {
      setSavingMatch(false)
    }
  }
  const openMatchDetail = match => {
    setSelectedMatch(match)
    setMatchDetailOpen(true)
    setError('')
    setSuccess('')
  }
  const openInjuryDetail =
    injury => {
      setSelectedInjury(injury)
      setInjuryDetailOpen(true)
      setError('')
      setSuccess('')
    }
  const closeInjuryDetail = () => {
    setInjuryDetailOpen(false)
    setSelectedInjury(null)
  }
  const closeMatchDetail = () => {
    setMatchDetailOpen(false)
    setSelectedMatch(null)
  }
  const openMatchNote = match => {
    setSelectedMatch(match)
    setMatchNote(
      match.coachNote || ''
    )
    setMatchNoteOpen(true)
    setError('')
    setSuccess('')
  }
  const closeMatchNote = () => {
    if (savingMatchNote) return
    setMatchNoteOpen(false)
    setSelectedMatch(null)
    setMatchNote('')
  }
  const saveMatchNote = async () => {
    if (
      !user?.id ||
      !selectedStudent ||
      !selectedMatch ||
      savingMatchNote
    ) {
      return
    }
    if (!matchNote.trim()) {
      alert(
        'Please enter a coach note.'
      )
      return
    }
    setSavingMatchNote(true)
    setError('')
    setSuccess('')
    try {
      const now =
        new Date().toISOString()
      const {
        data,
        error: saveError,
      } = await supabase
        .from('coach_match_notes')
        .upsert(
          {
            match_id:
              selectedMatch.id,
            coach_user_id:
              user.id,
            player_user_id:
              selectedStudent.id,
            note:
              matchNote.trim(),
            updated_at: now,
          },
          {
            onConflict:
              'match_id,coach_user_id',
          }
        )
        .select('*')
        .single()
      if (saveError) {
        throw saveError
      }
      setStudents(current =>
        current.map(student =>
          student.id ===
          selectedStudent.id
            ? {
                ...student,
                matches: (
                  student.matches ||
                  []
                ).map(match =>
                  match.id ===
                  selectedMatch.id
                    ? {
                        ...match,
                        coachNote:
                          data.note ||
                          '',
                        coachNoteId:
                          data.id,
                      }
                    : match
                ),
              }
            : student
        )
      )
      setMatchNoteOpen(false)
      setSelectedMatch(current =>
        current
          ? {
              ...current,
              coachNote:
                data.note || '',
              coachNoteId:
                data.id,
            }
          : current
      )
      setMatchNote('')
      setSuccess(
        `Coach match note saved for ${selectedStudent.name}.`
      )
    } catch (saveError) {
      console.error(
        'Save coach match note error:',
        saveError
      )
      setError(
        saveError.message ||
          'Unable to save the coach match note.'
      )
    } finally {
      setSavingMatchNote(false)
    }
  }
  const [editedCoachRatings, setEditedCoachRatings] = useState([])
  const openEditor = student => {
    setProgressSaveNotice(null)
    setEditedCoachRatings([])
    const actionPlans =
      decodeActionPlans(
        student.progress
          ?.coach_comment
      )
    setSelectedId(student.id)
    setForm({
      progress_status:
        student.progress
          ?.progress_status ||
        'On track',
      focus_area:
        student.progress
          ?.focus_area || '',
      performance_comment:
        student.assessment
          ?.performance_comment ||
        '',
      performance_action_plan:
        actionPlans.performance ||
        '',
      performance_action_deadline:
        actionPlans.performanceDeadline ||
        '',
      performance_action_completion:
        actionPlans.performanceCompletion ||
        0,
      fitness_comment:
        student.assessment
          ?.fitness_comment ||
        '',
      fitness_action_plan:
        actionPlans.fitness || '',
      fitness_action_deadline:
        actionPlans.fitnessDeadline ||
        '',
      fitness_action_completion:
        actionPlans.fitnessCompletion ||
        0,
      performance_review_date:
        actionPlans.performanceReviewDate ||
        student.progress
          ?.next_review_date ||
        '',
      fitness_review_date:
        actionPlans.fitnessReviewDate ||
        student.progress
          ?.next_review_date ||
        '',
      smash: Number(student.assessment?.smash ?? DEFAULT_SCORE),
      defense: Number(student.assessment?.defense ?? DEFAULT_SCORE),
      footwork: Number(student.assessment?.footwork ?? DEFAULT_SCORE),
      drop_shot: Number(student.assessment?.drop_shot ?? DEFAULT_SCORE),
      net_play: Number(student.assessment?.net_play ?? DEFAULT_SCORE),
      serve: Number(student.assessment?.serve ?? DEFAULT_SCORE),
      endurance: Number(student.assessment?.endurance ?? DEFAULT_SCORE),
      speed: Number(student.assessment?.speed ?? DEFAULT_SCORE),
      strength: Number(student.assessment?.strength ?? DEFAULT_SCORE),
      agility: Number(student.assessment?.agility ?? DEFAULT_SCORE),
      recovery: Number(student.assessment?.recovery ?? DEFAULT_SCORE),
    })
    setProgressSection('performance')
    setEditOpen(true)
    setError('')
    setSuccess('')
  }
  const openRecommendationEditor =
    student => {
      setSelectedId(student.id)
      setInjuryRecommendation(
        student.progress
          ?.injury_recommendation ||
          ''
      )
      setRecommendationOpen(true)
      setError('')
      setSuccess('')
    }
  const saveInjuryRecommendation =
    async () => {
      if (
        !user?.id ||
        !selectedStudent ||
        savingRecommendation
      ) {
        return
      }
      setSavingRecommendation(true)
      setError('')
      setSuccess('')
      try {
        const now =
          new Date().toISOString()
        const {
          data,
          error: saveError,
        } = await supabase
          .from(
            'coach_player_progress'
          )
          .upsert(
            {
              coach_user_id:
                user.id,
              player_user_id:
                selectedStudent.id,
              injury_recommendation:
                injuryRecommendation.trim() ||
                null,
              updated_at: now,
            },
            {
              onConflict:
                'coach_user_id,player_user_id',
            }
          )
          .select('*')
          .single()
        if (saveError) {
          throw saveError
        }
        setStudents(current =>
          current.map(student =>
            student.id ===
            selectedStudent.id
              ? {
                  ...student,
                  progress: {
                    ...(student.progress ||
                      {}),
                    ...data,
                  },
                }
              : student
          )
        )
        setRecommendationOpen(
          false
        )
        setSuccess(
          injuryRecommendation.trim()
            ? `${selectedStudent.name}'s injury recommendation was saved.`
            : `${selectedStudent.name}'s injury recommendation was removed.`
        )
      } catch (saveError) {
        console.error(
          'Save injury recommendation error:',
          saveError
        )
        setError(
          saveError.message ||
            'Unable to save the injury recommendation.'
        )
      } finally {
        setSavingRecommendation(
          false
        )
      }
    }

  const clearProgress = async () => {
    if (
      !user?.id ||
      !selectedStudent ||
      saving
    ) {
      return
    }
    const confirmed = window.confirm(
      `Clear the current coach progress for ${selectedStudent.name}? Performance and fitness feedback, action plans, status, focus area and next review will be cleared. Coach skill ratings and injury recommendations will remain unchanged.`
    )
    if (!confirmed) {
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const progressDelete = selectedStudent.progress
        ? supabase
            .from('coach_player_progress')
            .delete()
            .eq('coach_user_id', user.id)
            .eq('player_user_id', selectedStudent.id)
        : Promise.resolve({
            error: null,
          })
      const assessmentUpdate = selectedStudent.assessment
        ? supabase
            .from('coach_player_assessments')
            .update({
              performance_comment: null,
              fitness_comment: null,
              updated_at: new Date().toISOString(),
            })
            .eq('coach_user_id', user.id)
            .eq('player_user_id', selectedStudent.id)
            .select('*')
            .single()
        : Promise.resolve({
            data: null,
            error: null,
          })
      const [
        progressResult,
        assessmentResult,
      ] = await Promise.all([
        progressDelete,
        assessmentUpdate,
      ])
      if (progressResult.error) {
        throw progressResult.error
      }
      if (assessmentResult.error) {
        throw assessmentResult.error
      }
      setStudents(current =>
        current.map(student =>
          student.id === selectedStudent.id
            ? {
                ...student,
                progress: null,
                assessment:
                  assessmentResult.data ||
                  (student.assessment
                    ? {
                        ...student.assessment,
                        performance_comment: null,
                        fitness_comment: null,
                      }
                    : null),
              }
            : student
        )
      )
      setForm(current => ({
        ...current,
        progress_status: 'On track',
        focus_area: '',
        performance_comment: '',
        performance_action_plan: '',
        performance_action_deadline: '',
        performance_action_completion: 0,
        fitness_comment: '',
        fitness_action_plan: '',
        fitness_action_deadline: '',
        fitness_action_completion: 0,
        performance_review_date: '',
        fitness_review_date: '',
      }))
      setSuccess(
        `${selectedStudent.name}'s coach progress was cleared.`
      )
    } catch (clearError) {
      console.error(
        'Clear coach progress error:',
        clearError
      )
      setError(
        clearError.message ||
          'Unable to clear coach progress.'
      )
    } finally {
      setSaving(false)
    }
  }
  const saveProgressSection = async section => {
    if (
      !user?.id ||
      !selectedStudent ||
      saving
    ) {
      return
    }

    const isPerformance =
      section === 'performance'

    const isFitness =
      section === 'fitness'

    if (!isPerformance && !isFitness) {
      return
    }

    setSaving(true)
    setProgressSaveNotice(null)
    setError('')
    setSuccess('')

    try {
      const currentPlans =
        decodeActionPlans(
          selectedStudent.progress
            ?.coach_comment
        )

      const nextPerformanceReviewDate =
        isPerformance
          ? form.performance_review_date
          : currentPlans.performanceReviewDate

      const nextFitnessReviewDate =
        isFitness
          ? form.fitness_review_date
          : currentPlans.fitnessReviewDate

      const legacyReviewDates = [
        nextPerformanceReviewDate,
        nextFitnessReviewDate,
      ]
        .filter(Boolean)
        .sort()

      const progressPayload = {
        coach_user_id: user.id,
        player_user_id:
          selectedStudent.id,
        progress_status:
          form.progress_status,
        focus_area:
          form.focus_area.trim() ||
          null,
        coach_comment:
          encodeActionPlans({
            performance:
              isPerformance
                ? form.performance_action_plan
                : currentPlans.performance,
            performanceDeadline:
              isPerformance
                ? form.performance_action_deadline
                : currentPlans.performanceDeadline,
            performanceCompletion:
              isPerformance
                ? form.performance_action_completion
                : currentPlans.performanceCompletion,
            performanceReviewDate:
              nextPerformanceReviewDate,
            fitness:
              isFitness
                ? form.fitness_action_plan
                : currentPlans.fitness,
            fitnessDeadline:
              isFitness
                ? form.fitness_action_deadline
                : currentPlans.fitnessDeadline,
            fitnessCompletion:
              isFitness
                ? form.fitness_action_completion
                : currentPlans.fitnessCompletion,
            fitnessReviewDate:
              nextFitnessReviewDate,
          }),
        // Keep the old shared column populated for backward compatibility.
        // The UI now uses the two separate review dates stored above.
        next_review_date:
          legacyReviewDates[0] ||
          null,
        updated_at:
          new Date().toISOString(),
      }

      const performanceKeys = ['smash', 'defense', 'footwork', 'drop_shot', 'net_play', 'serve']
      const fitnessKeys = ['endurance', 'speed', 'strength', 'agility', 'recovery']
      const scoreKeys = isPerformance ? performanceKeys : fitnessKeys
      // A touched slider is only a change if its value differs from the
      // coach's existing value. Player scores are never used here.
      const changedScores = Object.fromEntries(
        scoreKeys.filter(key => editedCoachRatings.includes(key))
          .filter(key => {
            const previous = selectedStudent.assessment?.[key]
            return previous == null || Number(previous) !== Number(form[key])
          })
          .map(key => [key, Number(form[key])])
      )
      const previousScores = Object.fromEntries(
        Object.keys(changedScores).map(key => [key, selectedStudent.assessment?.[key] ?? null])
      )
      const commentKey = isPerformance ? 'performance_comment' : 'fitness_comment'
      const comment = String(form[commentKey] || '').trim() || null
      const oldComment = selectedStudent.assessment?.[commentKey] || null
      const hasAssessmentChanges = Object.keys(changedScores).length > 0 || comment !== oldComment

      const progressSave = await supabase
        .from('coach_player_progress')
        .upsert(progressPayload, { onConflict: 'coach_user_id,player_user_id' })
        .select('*')
        .single()
      if (progressSave.error) throw progressSave.error

      let assessmentData = selectedStudent.assessment || null
      if (hasAssessmentChanges) {
        const assessmentPayload = {
          coach_user_id: user.id,
          player_user_id: selectedStudent.id,
          ...changedScores,
          [commentKey]: comment,
          updated_at: new Date().toISOString(),
        }
        if (!selectedStudent.assessment) {
          // Override any numeric column defaults: not assessed means NULL.
          for (const key of [...performanceKeys, ...fitnessKeys]) {
            if (!(key in changedScores)) assessmentPayload[key] = null
          }
        }
        const assessmentSave = await supabase
          .from('coach_player_assessments')
          .upsert(assessmentPayload, { onConflict: 'coach_user_id,player_user_id' })
          .select('*')
          .single()
        if (assessmentSave.error) throw assessmentSave.error
        assessmentData = assessmentSave.data
      }
      setEditedCoachRatings([])

      // Store a dated snapshot only when this section is explicitly saved.
      // Preserve missing scores as null, never copy the player's values.
      const snapshotKeys = isPerformance ? performanceKeys : fitnessKeys
      const scores = Object.fromEntries(snapshotKeys.map(key => [
        key,
        Object.prototype.hasOwnProperty.call(changedScores, key)
          ? changedScores[key]
          : (assessmentData?.[key] ?? null),
      ]))
      // Embed original coach scores in the existing JSONB column, avoiding a
      // database migration and retaining compatibility with old history rows.
      // This metadata is not a player rating and is hidden from score lists.
      if (Object.keys(previousScores).length > 0) {
        scores.__previous = previousScores
      }
      const { error: historySaveError } = await supabase
        .from('coach_assessment_history')
        .insert({
          coach_user_id: user.id,
          player_user_id: selectedStudent.id,
          section,
          scores,
          feedback: comment,
          action_plan: isPerformance
            ? form.performance_action_plan
            : form.fitness_action_plan,
          changed_fields: Object.keys(changedScores),
        })
      if (historySaveError) {
        setHistoryError('Progress was saved, but history could not be recorded. Check the history table and RLS setup.')
      } else {
        await loadAssessmentHistory()
      }

      setStudents(current =>
        current.map(student =>
          student.id ===
          selectedStudent.id
            ? {
                ...student,
                progress:
                  progressSave.data,
                assessment: {
                  ...(student.assessment || {}),
                  ...(assessmentData || {}),
                },
              }
            : student
        )
      )

      setSuccess(
        isPerformance
          ? `${selectedStudent.name}'s performance progress was updated.`
          : `${selectedStudent.name}'s fitness progress was updated.`
      )
      setProgressSaveNotice({ playerId: selectedStudent.id, section, savedAt: new Date().toISOString() })
    } catch (saveError) {
      console.error(
        `Save ${section} progress error:`,
        saveError
      )

      setError(
        saveError.message ||
          `Unable to save ${section} progress.`
      )
    } finally {
      setSaving(false)
    }
  }


  return (
    <div className={styles.progressPage}>
      <CoachPageHeader
        title="Player Progress"
        subtitle="View synced performance and fitness data for your accepted students"
        rightAction={
          <CoachNotificationBell
            supabase={supabase}
            mode="progress"
            title="Progress notifications"
          />
        }
      />

      <div
        className={styles.g4}
        style={{
          marginBottom: 16,
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: 12,
          width: '100%',
          minWidth: 0,
        }}
      >
        {[
          {
            label: 'My students',
            value: students.length,
            color: '#1A5FFF',
            background: '#E8EFFE',
            icon: 'students',
          },
          {
            label: selectedStudent
              ? `${selectedStudent.name}'s Performance Avg`
              : "Students' Performance Avg",
            value: selectedStudent
              ? selectedStudent.performanceAverage
              : students.length
                ? averageValues(students.map(student => student.performanceAverage))
                : 0,
            color: '#00A878',
            background: '#E0FAF3',
            icon: 'performance',
          },
          {
            label: selectedStudent
              ? `${selectedStudent.name}'s Fitness Avg`
              : "Students' Fitness Avg",
            value: selectedStudent
              ? selectedStudent.fitnessAverage
              : students.length
                ? averageValues(students.map(student => student.fitnessAverage))
                : 0,
            color: '#F59E0B',
            background: '#FEF3C7',
            icon: 'fitness',
          },
          {
            label: 'Progress notes',
            value: totalNotes,
            color: '#7C3AED',
            background: '#EDE9FE',
            icon: 'notes',
          },
        ].map(item => (
          <div key={item.label} className={styles.metric}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: item.background,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <ProgressMetricIcon
                type={item.icon}
                color={item.color}
                size={18}
              />
            </div>

            <div
              className={styles.metricVal}
              style={{
                color: item.color,
                WebkitTextFillColor: item.color,
              }}
            >
              {item.value}
            </div>

            <div className={styles.metricLbl}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
      {error && (
        <div
          className={styles.card}
          style={{
            marginBottom: 14,
            padding: 14,
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
          }}
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className={styles.card}
          style={{
            marginBottom: 14,
            padding: 14,
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#047857',
          }}
        >
          {success}
        </div>
      )}
      {loading ? (
        showLoader ? (
          <div className={styles.card}>
            <Loader text="Loading accepted students..." />
          </div>
        ) : null
      ) : students.length === 0 ? (
        <div
          className={styles.card}
          style={{
            padding: 40,
            textAlign: 'center',
            color: '#8892A4',
          }}
        >
          No accepted students yet. Only students with an accepted coach
          relationship appear here.
        </div>
      ) : (
        <div
          className={styles.g2}
          style={{
            display: 'grid',
            gridTemplateColumns: progressSingleColumn
              ? 'minmax(0, 1fr)'
              : progressCompact
                ? 'minmax(220px, 0.72fr) minmax(0, 1.28fr)'
                : 'minmax(220px, 0.72fr) minmax(0, 1.15fr) minmax(0, 1.2fr)',
            gap: 12,
            alignItems: 'start',
            width: '100%',
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minWidth: 0,
              width: '100%',
            }}
          >
            <button
              type="button"
              className={styles.btnOutline}
              onClick={() => setSelectedId(null)}
              aria-pressed={!selectedId}
              style={{
                width: '100%',
                padding: '10px 12px',
                textAlign: 'center',
                background: !selectedId ? '#E8EFFE' : 'var(--card, #FFFFFF)',
                border: !selectedId ? '2px solid #1A5FFF' : '1.5px solid #EEF1F8',
                color: !selectedId ? '#1A5FFF' : 'var(--text, #0D1B3E)',
                borderRadius: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              All students (overall averages)
            </button>
            {students.map(student => (
              <div
                key={student.id}
                onClick={() => setSelectedId(student.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: progressCompact
                    ? '38px minmax(0, 1fr)'
                    : '38px minmax(0, 1fr) auto',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  minWidth: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                  background:
                    selectedId === student.id ? '#E8EFFE' : '#FFFFFF',
                  border:
                    selectedId === student.id
                      ? '2px solid #1A5FFF'
                      : '1.5px solid #EEF1F8',
                }}
              >
                <Avatar name={student.name} size={38} />

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#0D1B3E',
                    }}
                  >
                    {student.name}
                  </div>

                  <div
                    style={{
                      fontSize: 11,
                      color: '#8892A4',
                      marginTop: 2,
                    }}
                  >
                    {student.club}
                    {student.state ? ` • ${student.state}` : ''}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 5,
                      marginTop: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <LevelBadge level={student.level} />
                    {student.progress?.progress_status && (
                      <span className={styles.badgeGreen}>
                        {student.progress.progress_status}
                      </span>
                    )}
                    {student.activeInjuryCount > 0 && (
                      <span className={styles.badgeRed}>
                        {student.activeInjuryCount}{' '}
                        Active Injur
                        {student.activeInjuryCount === 1 ? 'y' : 'ies'}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    textAlign: progressCompact ? 'left' : 'right',
                    gridColumn: progressCompact ? '2 / 3' : 'auto',
                    display: progressCompact ? 'flex' : 'block',
                    alignItems: progressCompact ? 'center' : 'initial',
                    gap: progressCompact ? 6 : 0,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: '#8892A4',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Performance
                  </div>

                  <div
                    style={{
                      fontSize: progressCompact ? 14 : 16,
                      fontWeight: 700,
                      color: '#1A5FFF',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {student.performanceAverage}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!selectedStudent && (
            <div
              className={styles.card}
              style={{
                gridColumn: progressSingleColumn ? 'auto' : 'span 2',
                padding: 22,
                minWidth: 0,
              }}
            >
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text, #0D1B3E)' }}>
                  All Students' Averages
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #8892A4)', marginTop: 5 }}>
                  Performance and fitness averages for each accepted student. Select a student to view their progress.
                </div>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
                  gap: 12,
                  alignItems: 'stretch',
                }}
              >
                {students.map(student => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedId(student.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 15,
                      padding: 16,
                      textAlign: 'left',
                      background: 'var(--card, #FFFFFF)',
                      border: '1px solid var(--line, #EEF1F8)',
                      borderRadius: 14,
                      cursor: 'pointer',
                      minWidth: 0,
                      color: 'var(--text, #0D1B3E)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <Avatar name={student.name} size={38} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, overflowWrap: 'anywhere' }}>
                          {student.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted, #8892A4)', marginTop: 3 }}>
                          {student.club}{student.state ? ` • ${student.state}` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                      <div style={{ borderRadius: 10, padding: '12px 10px', background: 'color-mix(in srgb, #10B981 10%, var(--card, #FFFFFF))' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted, #8892A4)' }}>Performance Avg</div>
                        <div style={{ fontSize: 25, fontWeight: 800, color: '#059669', marginTop: 4 }}>
                          {student.performanceAverage}
                        </div>
                      </div>
                      <div style={{ borderRadius: 10, padding: '12px 10px', background: 'color-mix(in srgb, #F59E0B 12%, var(--card, #FFFFFF))' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted, #8892A4)' }}>Fitness Avg</div>
                        <div style={{ fontSize: 25, fontWeight: 800, color: '#D97706', marginTop: 4 }}>
                          {student.fitnessAverage}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedStudent && (
            <>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  minWidth: 0,
                  width: '100%',
                  height: '100%',
                }}
              >
                <div
                  className={styles.card}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 16,
                      paddingBottom: 14,
                      borderBottom:
                        '1px solid var(--line, #EEF1F8)',
                    }}
                  >
                    <Avatar name={selectedStudent.name} size={44} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: 'var(--text, #0D1B3E)',
                        }}
                      >
                        {selectedStudent.name}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted, #8892A4)',
                          marginTop: 2,
                        }}
                      >
                        {selectedStudent.club}
                        {selectedStudent.state
                          ? ` • ${selectedStudent.state}`
                          : ''}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          marginTop: 7,
                        }}
                      >
                        <LevelBadge level={selectedStudent.level} />
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 999,
                            background:
                              'color-mix(in srgb, #7C3AED 10%, var(--card, #FFFFFF))',
                            color: '#7C3AED',
                            fontSize: 10,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Purple marker = coach rating
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <div className={styles.cardTitle} style={{ marginBottom: 4 }}>Performance skills</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted, #8892A4)', lineHeight: 1.45 }}>
                          Player self-assessment with coach comparison markers.
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
                        <button type="button" className={styles.btnOutline} onClick={() => openDevelopment('performance')} style={{ fontSize: 11, padding: '7px 10px', whiteSpace: 'nowrap' }}>
                          View Development
                        </button>
                        <button type="button" className={styles.btnOutline} onClick={() => { setPerformanceRecordsOpen(true); loadAssessmentHistory() }} style={{ fontSize: 11, padding: '7px 10px', whiteSpace: 'nowrap' }}>
                          View records
                        </button>
                      </div>
                    </div>
                  </div>
                  {PERFORMANCE_FIELDS.map(field => {
                    const dbKey =
                      field.key === 'dropShot'
                        ? 'drop_shot'
                        : field.key === 'netPlay'
                          ? 'net_play'
                          : field.key
                    return (
                      <ComparisonSkillRow
                        key={field.key}
                        label={field.label}
                        studentValue={selectedStudent.performance[field.key]}
                        coachValue={selectedStudent.assessment?.[dbKey]}
                        color={value =>
                          getMetricColor(field.label, value, 'performance')
                        }
                      />
                    )
                  })}
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 11,
                      color: 'var(--text-muted, #8892A4)',
                    }}
                  >
                    A purple marker shows the coach rating only when it is different.
                  </div>
                </div>

                <div
                  className={styles.card}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 10,
                      marginBottom: 24,
                    }}
                  >
                    <div>
                      <div
                        className={styles.cardTitle}
                        style={{ marginBottom: 4 }}
                      >
                        Fitness indicators
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted, #8892A4)',
                          lineHeight: 1.45,
                        }}
                      >
                        Current player fitness values and coach assessment.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginLeft: 'auto' }}>
                      <button type="button" className={styles.btnOutline} onClick={() => openDevelopment('fitness')} style={{ fontSize: 11, padding: '7px 10px', whiteSpace: 'nowrap' }}>
                        View Development
                      </button>
                      <button type="button" className={styles.btnOutline} onClick={() => setFitnessRecordsOpen(true)} style={{ fontSize: 11, padding: '7px 10px', whiteSpace: 'nowrap' }}>
                        View records
                      </button>
                    </div>
                  </div>
                  {FITNESS_FIELDS.map(field => (
                    <ComparisonSkillRow
                      key={field.key}
                      label={field.label}
                      studentValue={selectedStudent.fitness[field.key]}
                      coachValue={getCoachFitnessValue(field.key)}
                      color={value =>
                        getMetricColor(field.label, value, 'fitness')
                      }
                    />
                  ))}
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 11,
                      color: 'var(--text-muted, #8892A4)',
                    }}
                  >
                    Fitness values come from the player record. The purple marker
                    shows the coach's latest rating or coach-added test score.
                  </div>
                </div>

                <div className={styles.card}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div>
                      <div
                        className={styles.cardTitle}
                        style={{ marginBottom: 4 }}
                      >
                        Coach progress record
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted, #8892A4)',
                          lineHeight: 1.45,
                        }}
                      >
                        Coach feedback, action plans and next review details.
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        justifyContent: 'flex-end',
                      }}
                    >
                      {selectedHasCoachProgress ? (
                        <button
                          type="button"
                          className={styles.btnOutline}
                          onClick={clearProgress}
                          disabled={saving}
                          style={{
                            fontSize: 11,
                            padding: '7px 11px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          Clear
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() => openEditor(selectedStudent)}
                        disabled={saving}
                        style={{
                          fontSize: 11,
                          padding: '7px 11px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {selectedHasCoachProgress
                          ? 'Update progress'
                          : 'Add progress'}
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '4px 12px',
                      borderRadius: 11,
                      background: 'var(--soft, #F7F9FF)',
                      border:
                        '1px solid var(--line, #EEF1F8)',
                      marginBottom: 12,
                    }}
                  >
                    <div className={styles.statRow}>
                      <span className={styles.statLabel}>
                        Status
                      </span>
                      <span className={styles.statVal}>
                        {selectedStudent.progress?.progress_status ||
                          'Not reviewed'}
                      </span>
                    </div>

                    <div className={styles.statRow}>
                      <span className={styles.statLabel}>
                        Focus area
                      </span>
                      <span className={styles.statVal}>
                        {selectedStudent.progress?.focus_area ||
                          'Not set'}
                      </span>
                    </div>

                    <div className={styles.statRow}>
                      <span className={styles.statLabel}>
                        Performance next review
                      </span>
                      <span className={styles.statVal}>
                        {formatDate(
                          selectedActionPlans.performanceReviewDate ||
                            selectedStudent.progress?.next_review_date
                        )}
                      </span>
                    </div>

                    <div className={styles.statRow}>
                      <span className={styles.statLabel}>
                        Fitness next review
                      </span>
                      <span className={styles.statVal}>
                        {formatDate(
                          selectedActionPlans.fitnessReviewDate ||
                            selectedStudent.progress?.next_review_date
                        )}
                      </span>
                    </div>
                  </div>
                  {hasPerformanceFeedback ? (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        background: 'var(--soft, #F7F9FF)',
                        borderRadius: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#1A5FFF',
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          marginBottom: 6,
                        }}
                      >
                        Performance feedback
                      </div>

                      <div
                        className={styles.progressBodyText}
                        style={{
                          color: 'var(--text, #0D1B3E)',
                          fontSize: 13,
                          lineHeight: 1.65,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {selectedStudent.assessment?.performance_comment}
                      </div>
                    </div>
                  ) : null}
                  {hasPerformanceActionPlan ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        background:
                          'color-mix(in srgb, #1A5FFF 7%, var(--soft, #F7F9FF))',
                        borderRadius: 10,
                        border:
                          '1px solid color-mix(in srgb, #1A5FFF 16%, var(--line, #EEF1F8))',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#1A5FFF',
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          marginBottom: 6,
                        }}
                      >
                        Performance action plan
                      </div>
                      {selectedActionPlans.performance ? (
                        <div
                          className={styles.progressBodyText}
                          style={{
                            color: 'var(--text, #0D1B3E)',
                            fontSize: 13,
                            lineHeight: 1.65,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {selectedActionPlans.performance}
                        </div>
                      ) : null}
                      <ActionPlanProgress
                        deadline={
                          selectedActionPlans.performanceDeadline
                        }
                        completion={
                          selectedActionPlans.performanceCompletion
                        }
                        accentColor="#1A5FFF"
                      />
                    </div>
                  ) : null}
                  {hasFitnessFeedback ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        background: 'var(--soft, #F7F9FF)',
                        borderRadius: 10,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#7C3AED',
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          marginBottom: 6,
                        }}
                      >
                        Fitness feedback
                      </div>

                      <div
                        className={styles.progressBodyText}
                        style={{
                          color: 'var(--text, #0D1B3E)',
                          fontSize: 13,
                          lineHeight: 1.65,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {selectedStudent.assessment?.fitness_comment}
                      </div>
                    </div>
                  ) : null}
                  {hasFitnessActionPlan ? (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        background:
                          'color-mix(in srgb, #7C3AED 7%, var(--soft, #F7F9FF))',
                        borderRadius: 10,
                        border:
                          '1px solid color-mix(in srgb, #7C3AED 16%, var(--line, #EEF1F8))',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#7C3AED',
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          marginBottom: 6,
                        }}
                      >
                        Fitness action plan
                      </div>
                      {selectedActionPlans.fitness ? (
                        <div
                          className={styles.progressBodyText}
                          style={{
                            color: 'var(--text, #0D1B3E)',
                            fontSize: 13,
                            lineHeight: 1.65,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {selectedActionPlans.fitness}
                        </div>
                      ) : null}
                      <ActionPlanProgress
                        deadline={
                          selectedActionPlans.fitnessDeadline
                        }
                        completion={
                          selectedActionPlans.fitnessCompletion
                        }
                        accentColor="#7C3AED"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  minWidth: 0,
                  width: '100%',
                  gridColumn:
                    progressCompact && !progressSingleColumn
                      ? '1 / -1'
                      : 'auto',
                }}
              >
                <div className={styles.card}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div
                        className={styles.cardTitle}
                        style={{ marginBottom: 4 }}
                      >
                        Upcoming matches
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted, #8892A4)',
                          lineHeight: 1.5,
                        }}
                      >
                        Player-created upcoming matches appear here only when
                        {` ${selectedStudent.name} `}tags you as the coach.
                      </div>
                    </div>
                    {selectedStudent.upcomingMatches?.length > 0 && (
                      <span
                        style={{
                          padding: '4px 9px',
                          borderRadius: 999,
                          background:
                            'color-mix(in srgb, #F59E0B 12%, var(--card, #FFFFFF))',
                          color: '#B45309',
                          fontSize: 10,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {selectedStudent.upcomingMatches.length}{' '}
                        upcoming
                      </span>
                    )}
                  </div>
                  {!selectedStudent.upcomingMatches?.length ? (
                    <div
                      style={{
                        padding: '18px 14px',
                        borderRadius: 12,
                        background: 'var(--soft, #F7F9FF)',
                        color: 'var(--text-muted, #8892A4)',
                        fontSize: 12,
                        textAlign: 'center',
                        lineHeight: 1.55,
                      }}
                    >
                      No upcoming match has been tagged to you by this player.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 9,
                      }}
                    >
                      {selectedStudent.upcomingMatches
                        .slice(0, 5)
                        .map(match => (
                          <div
                            key={match.id}
                            style={{
                              padding: '12px 13px',
                              borderRadius: 11,
                              border:
                                '1px solid var(--line, #EEF1F8)',
                              background:
                                'var(--card, #FFFFFF)',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: 12,
                              }}
                            >
                              <div
                                style={{
                                  minWidth: 0,
                                  flex: 1,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    flexWrap: 'wrap',
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 700,
                                      color:
                                        'var(--text, #0D1B3E)',
                                    }}
                                  >
                                    {match.title}
                                  </span>
                                  <span
                                    className={
                                      match.scheduleType ===
                                      'Competition'
                                        ? styles.badgeAmber
                                        : styles.badgeGreen
                                    }
                                  >
                                    {match.scheduleType}
                                  </span>
                                  <span
                                    className={styles.badgeBlue}
                                  >
                                    {match.matchType ||
                                      'Singles'}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    marginTop: 5,
                                    fontSize: 11,
                                    color:
                                      'var(--text-muted, #8892A4)',
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {formatDate(match.date)}
                                  {match.startTime
                                    ? ` • ${String(
                                        match.startTime
                                      ).slice(0, 5)}`
                                    : ''}
                                  {match.endTime
                                    ? `–${String(
                                        match.endTime
                                      ).slice(0, 5)}`
                                    : ''}
                                  {match.venue
                                    ? ` • ${match.venue}`
                                    : ''}
                                </div>
                                {match.notes && (
                                  <div
                                    style={{
                                      marginTop: 7,
                                      padding:
                                        '8px 9px',
                                      borderRadius: 8,
                                      background:
                                        'var(--soft, #F7F9FF)',
                                      color:
                                        'var(--text, #0D1B3E)',
                                      fontSize: 11,
                                      lineHeight: 1.5,
                                      whiteSpace:
                                        'pre-wrap',
                                    }}
                                  >
                                    {match.notes}
                                  </div>
                                )}
                              </div>
                              <span
                                style={{
                                  flexShrink: 0,
                                  padding: '4px 8px',
                                  borderRadius: 999,
                                  background:
                                    'color-mix(in srgb, #7C3AED 10%, var(--card, #FFFFFF))',
                                  color: '#7C3AED',
                                  fontSize: 9,
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Tagged to you
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className={styles.card}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div
                        className={styles.cardTitle}
                        style={{ marginBottom: 4 }}
                      >
                        Match records
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted, #8892A4)',
                          lineHeight: 1.5,
                        }}
                      >
                        Latest match history for this player. Open the full
                        history to review older records and coach notes.
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      {selectedStudent.matches?.length > 5 && (
                        <button
                          type="button"
                          className={styles.btnOutline}
                          onClick={() => setAllMatchesOpen(true)}
                          style={{
                            fontSize: 11,
                            padding: '7px 11px',
                          }}
                        >
                          View all ({selectedStudent.matches.length})
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={openAddMatch}
                        style={{
                          fontSize: 11,
                          padding: '7px 11px',
                        }}
                      >
                        + Add match
                      </button>
                    </div>
                  </div>
                  {!selectedStudent.matches?.length ? (
                    <div
                      style={{
                        padding: '20px 14px',
                        borderRadius: 12,
                        background: 'var(--soft, #F7F9FF)',
                        color: 'var(--text-muted, #8892A4)',
                        fontSize: 12,
                        textAlign: 'center',
                      }}
                    >
                      No match records found for this player.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 9,
                      }}
                    >
                      {selectedStudent.matches.slice(0, 5).map(match => (
                        <div
                          key={match.id}
                          onClick={() => openMatchDetail(match)}
                          style={{
                            padding: '12px 13px',
                            borderRadius: 11,
                            border: '1px solid var(--line, #EEF1F8)',
                            background: 'var(--card, #FFFFFF)',
                            cursor: 'pointer',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              flexWrap: 'wrap',
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 7,
                                  flexWrap: 'wrap',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: 'var(--text, #0D1B3E)',
                                  }}
                                >
                                  vs {match.opponent}
                                </span>
                                <span
                                  className={
                                    match.result === 'Win'
                                      ? styles.badgeGreen
                                      : styles.badgeRed
                                  }
                                >
                                  {match.result}
                                </span>
                              </div>

                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: 11,
                                  color: 'var(--text-muted, #8892A4)',
                                }}
                              >
                                {formatDate(match.date)}
                                {' • '}
                                {match.type}
                                {match.score ? ` • ${match.score}` : ''}
                              </div>
                              {match.playerNotes && (
                                <div
                                  style={{
                                    marginTop: 6,
                                    fontSize: 11,
                                    color: 'var(--text-muted, #8892A4)',
                                    lineHeight: 1.5,
                                  }}
                                >
                                  Player note: {match.playerNotes}
                                </div>
                              )}
                            </div>

                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--text-muted, #8892A4)',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              View details
                            </div>
                          </div>
                          {match.coachNote && (
                            <div
                              style={{
                                marginTop: 10,
                                padding: '10px 11px',
                                borderRadius: 9,
                                background:
                                  'color-mix(in srgb, #7C3AED 8%, var(--soft, #F7F9FF))',
                                borderLeft: '3px solid #7C3AED',
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: '#7C3AED',
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.5,
                                  marginBottom: 4,
                                }}
                              >
                                Coach match note
                              </div>

                              <div
                                style={{
                                  fontSize: 11,
                                  lineHeight: 1.55,
                                  color: 'var(--text, #0D1B3E)',
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {match.coachNote}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.card}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 14,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div
                        className={styles.cardTitle}
                        style={{ marginBottom: 4 }}
                      >
                        Injury & recovery status
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted, #8892A4)',
                          lineHeight: 1.5,
                        }}
                      >
                        Showing up to 3 active injuries. Resolved and older
                        records remain available in the full injury history.
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      {selectedStudent.injuries.length > 0 && (
                        <button
                          type="button"
                          className={styles.btnOutline}
                          onClick={() => setAllInjuriesOpen(true)}
                          style={{
                            fontSize: 11,
                            padding: '7px 11px',
                          }}
                        >
                          View all ({selectedStudent.injuries.length})
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.btnOutline}
                        onClick={() =>
                          openRecommendationEditor(selectedStudent)
                        }
                        style={{
                          fontSize: 11,
                          padding: '7px 11px',
                        }}
                      >
                        {selectedStudent.progress?.injury_recommendation
                          ? 'Edit recommendation'
                          : 'Add recommendation'}
                      </button>
                    </div>
                  </div>
                  {selectedStudent.injuries.filter(injury => injury.isActive)
                    .length === 0 ? (
                    <div
                      style={{
                        padding: '20px 14px',
                        borderRadius: 12,
                        background: 'var(--soft, #F7F9FF)',
                        color: 'var(--text-muted, #8892A4)',
                        fontSize: 12,
                        textAlign: 'center',
                      }}
                    >
                      {selectedStudent.injuries.length === 0
                        ? 'No injury records have been added by this player.'
                        : 'No active injuries. Use View all to see recovered injury history.'}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          viewportWidth <= 1050
                            ? 'minmax(0, 1fr)'
                            : '180px minmax(0, 1fr)',
                        gap: 16,
                        alignItems: 'stretch',
                        minWidth: 0,
                      }}
                    >
                      <InjuryBodyMap
                        injuries={selectedStudent.injuries
                          .filter(injury => injury.isActive)
                          .slice(0, 3)}
                      />

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          gap: 9,
                          minWidth: 0,
                          minHeight: 240,
                        }}
                      >
                        {selectedStudent.injuries
                          .filter(injury => injury.isActive)
                          .slice(0, 3)
                          .map(injury => {
                            const statusColor =
                              getInjuryStatusColor(injury.status)
                            const severityColor =
                              getInjurySeverityColor(injury.severity)
                            return (
                              <div
                                key={injury.id}
                                onClick={() => openInjuryDetail(injury)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={event => {
                                  if (
                                    event.key === 'Enter' ||
                                    event.key === ' '
                                  ) {
                                    event.preventDefault()
                                    openInjuryDetail(injury)
                                  }
                                }}
                                style={{
                                  padding: '11px 12px',
                                  borderRadius: 11,
                                  border:
                                    '1px solid var(--line, #EEF1F8)',
                                  background: 'var(--card, #FFFFFF)',
                                  cursor: 'pointer',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    justifyContent: 'space-between',
                                    gap: 10,
                                  }}
                                >
                                  <div
                                    style={{
                                      minWidth: 0,
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: 9,
                                    }}
                                  >
                                    {injury.imageUrl && (
                                      <img
                                        src={injury.imageUrl}
                                        alt=""
                                        style={{
                                          width: 42,
                                          height: 42,
                                          borderRadius: 8,
                                          objectFit: 'cover',
                                          flexShrink: 0,
                                          background:
                                            'var(--soft, #F7F9FF)',
                                        }}
                                      />
                                    )}

                                    <div style={{ minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontSize: 12,
                                          fontWeight: 700,
                                          color:
                                            'var(--text, #0D1B3E)',
                                          overflowWrap: 'anywhere',
                                        }}
                                      >
                                        {injury.name}
                                      </div>

                                      <div
                                        style={{
                                          marginTop: 3,
                                          fontSize: 11,
                                          color:
                                            'var(--text-muted, #8892A4)',
                                        }}
                                      >
                                        Logged {formatDate(injury.date)}
                                      </div>

                                      <div
                                        style={{
                                          marginTop: 4,
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: severityColor,
                                        }}
                                      >
                                        {injury.severity || 'Mild'} severity
                                      </div>
                                    </div>
                                  </div>
                                  <span
                                    style={{
                                      flexShrink: 0,
                                      padding: '3px 8px',
                                      borderRadius: 999,
                                      background:
                                        `color-mix(in srgb, ${statusColor} 12%, var(--card, #FFFFFF))`,
                                      color: statusColor,
                                      fontSize: 9,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {injury.status}
                                  </span>
                                </div>
                                {injury.notes && (
                                  <div
                                    style={{
                                      marginTop: 8,
                                      padding: '8px 9px',
                                      borderRadius: 8,
                                      background: 'var(--soft, #F7F9FF)',
                                      fontSize: 11,
                                      lineHeight: 1.55,
                                      color: 'var(--text, #0D1B3E)',
                                      whiteSpace: 'pre-wrap',
                                    }}
                                  >
                                    {injury.notes}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 11,
                      background:
                        'color-mix(in srgb, #7C3AED 8%, var(--soft, #F7F9FF))',
                      border:
                        '1px solid color-mix(in srgb, #7C3AED 18%, var(--line, #EEF1F8))',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#7C3AED',
                        textTransform: 'uppercase',
                        letterSpacing: 0.55,
                        marginBottom: 5,
                      }}
                    >
                      Coach training recommendation
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        lineHeight: 1.6,
                        color: 'var(--text, #0D1B3E)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {selectedStudent.progress?.injury_recommendation ||
                        'No injury recommendation yet. This is separate from performance and fitness feedback.'}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {developmentSection && selectedStudent && (
        <div className={styles.modalOverlay} onClick={event => { if (event.target === event.currentTarget) setDevelopmentSection(null) }}>
          <div className={styles.modal} style={{ maxWidth: 860, width: '94vw', maxHeight: '88vh', overflowY: 'auto' }}>
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>
                  {developmentSection === 'performance' ? 'Performance Development' : 'Fitness Development'}
                </div>
                <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-muted, #8892A4)' }}>
                  {selectedStudent.name} • Player assessment history
                </div>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setDevelopmentSection(null)} aria-label="Close development chart">×</button>
            </div>
            {developmentSection === 'performance' ? (
              <>
                {developmentLoading && <p>Loading performance history...</p>}
                {developmentError && <p role="alert" style={{ color: '#DC2626' }}>{developmentError}</p>}
                {!developmentLoading && !developmentError && (
                  <CoachPlayerPerformanceTimeline records={playerSkillHistory} />
                )}
              </>
            ) : (
              <FitnessDevelopmentTimeline tests={(selectedStudent.fitnessTests || []).map(row => ({
                id: row.id,
                date: row.test_date,
                test: row.test_name || '',
                result: row.result || '',
                indicator: row.indicator || 'Endurance',
                score: clamp(row.score),
                change: row.change_note || 'Saved',
                addedByCoach: Boolean(row.added_by_coach && row.coach_user_id),
                coachUserId: row.coach_user_id || null,
                createdAt: row.created_at || '',
                updatedAt: row.updated_at || '',
              }))} />
            )}
          </div>
        </div>
      )}
      {performanceRecordsOpen && selectedStudent && (
        <div className={styles.modalOverlay} onClick={event => { if (event.target === event.currentTarget) setPerformanceRecordsOpen(false) }}>
          <div className={styles.modal} style={{ maxWidth: 760, width: '92vw', maxHeight: '86vh', overflowY: 'auto' }}>
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>Performance Assessment Records</div>
                <div style={{ marginTop: 3, fontSize: 11, color: 'var(--text-muted, #8892A4)' }}>
                  {selectedStudent.name} • Saved coach assessment updates
                </div>
              </div>
              <button type="button" className={styles.modalClose} onClick={() => setPerformanceRecordsOpen(false)} aria-label="Close performance records">×</button>
            </div>
            <CoachRatingHistory section="performance" entries={assessmentHistory} loading={historyLoading} error={historyError} refresh={loadAssessmentHistory} />
          </div>
        </div>
      )}
      {fitnessRecordsOpen && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              setFitnessRecordsOpen(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 760,
              width: '92vw',
              maxHeight: '86vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>
                  Fitness Test Records
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: 'var(--text-muted, #8892A4)',
                  }}
                >
                  {selectedStudent.name} • Player and coach fitness test records
                </div>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setFitnessRecordsOpen(false)}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 240,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background:
                    'color-mix(in srgb, #7C3AED 7%, var(--soft, #F7F9FF))',
                  border:
                    '1px solid color-mix(in srgb, #7C3AED 14%, var(--line, #EEF1F8))',
                  color: 'var(--text-muted, #8892A4)',
                  fontSize: 11,
                  lineHeight: 1.55,
                }}
              >
                Player records stay unchanged; coach-added tests are labelled
                <strong> Added by Coach</strong>.
              </div>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={openAddFitnessTest}
                style={{
                  fontSize: 11,
                  padding: '8px 11px',
                  whiteSpace: 'nowrap',
                }}
              >
                + Add fitness test
              </button>
            </div>
            {!selectedStudent.fitnessTests?.length ? (
              <div
                style={{
                  padding: '26px 16px',
                  borderRadius: 12,
                  background: 'var(--soft, #F7F9FF)',
                  color: 'var(--text-muted, #8892A4)',
                  fontSize: 12,
                  textAlign: 'center',
                }}
              >
                No fitness test records have been added by this player.
              </div>
            ) : (
              <div
                style={{
                  border:
                    '1px solid var(--line, #EEF1F8)',
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      viewportWidth <= 650
                        ? 'minmax(0, 1fr)'
                        : 'minmax(180px, 1.4fr) minmax(100px, 0.8fr) minmax(100px, 0.8fr) 72px',
                    gap: 10,
                    padding: '10px 12px',
                    background: 'var(--soft, #F7F9FF)',
                    color: 'var(--text-muted, #8892A4)',
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.45,
                  }}
                >
                  <span>Test</span>
                  {viewportWidth > 650 && <span>Indicator</span>}
                  {viewportWidth > 650 && <span>Result</span>}
                  {viewportWidth > 650 && <span>Score</span>}
                </div>
                {selectedStudent.fitnessTests.map(test => {
                  const canEditCoachTest =
                    test.added_by_coach &&
                    String(test.coach_user_id || '') ===
                      String(user?.id || '')
                  const playerScore =
                    test.added_by_coach
                      ? getPlayerFitnessTestScore(
                          test.indicator
                        )
                      : null
                  const scoreDifference =
                    playerScore !== null &&
                    Number.isFinite(
                      Number(test.score)
                    )
                      ? Number(test.score) -
                        Number(playerScore)
                      : null
                  return (
                  <div
                    key={test.id}
                    onClick={() => {
                      if (canEditCoachTest) {
                        openEditFitnessTest(test)
                      }
                    }}
                    role={canEditCoachTest ? 'button' : undefined}
                    tabIndex={canEditCoachTest ? 0 : undefined}
                    onKeyDown={event => {
                      if (
                        canEditCoachTest &&
                        (event.key === 'Enter' ||
                          event.key === ' ')
                      ) {
                        event.preventDefault()
                        openEditFitnessTest(test)
                      }
                    }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        viewportWidth <= 650
                          ? 'minmax(0, 1fr)'
                          : 'minmax(180px, 1.4fr) minmax(100px, 0.8fr) minmax(100px, 0.8fr) 72px',
                      gap: 10,
                      padding: '12px',
                      alignItems: 'center',
                      borderTop:
                        '1px solid var(--line, #EEF1F8)',
                      cursor:
                        canEditCoachTest
                          ? 'pointer'
                          : 'default',
                      background:
                        canEditCoachTest
                          ? 'color-mix(in srgb, #7C3AED 2%, var(--card, #FFFFFF))'
                          : 'var(--card, #FFFFFF)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--text, #0D1B3E)',
                        }}
                      >
                        {test.test_name || 'Fitness test'}
                      </div>

                      <div
                        style={{
                          marginTop: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                          fontSize: 11,
                          color: 'var(--text-muted, #8892A4)',
                        }}
                      >
                        <span>{formatDate(test.test_date)}</span>
                        {test.added_by_coach && (
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: 999,
                              background:
                                'color-mix(in srgb, #7C3AED 10%, var(--card, #FFFFFF))',
                              color: '#7C3AED',
                              fontSize: 9,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Added by Coach
                          </span>
                        )}
                        {canEditCoachTest && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              color: '#7C3AED',
                            }}
                          >
                            Click to edit
                          </span>
                        )}
                      </div>
                      {viewportWidth <= 650 && (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: 11,
                            color: 'var(--text-muted, #8892A4)',
                            lineHeight: 1.5,
                          }}
                        >
                          {test.indicator || '—'} • {test.result || '—'} •{' '}
                          Score {clamp(test.score)}/100
                          {test.added_by_coach &&
                            scoreDifference !== null &&
                            scoreDifference !== 0
                              ? ` (${
                                  scoreDifference > 0
                                    ? '+'
                                    : ''
                                }${scoreDifference})`
                              : ''}
                        </div>
                      )}
                    </div>
                    {viewportWidth > 650 && (
                      <>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--text, #0D1B3E)',
                          }}
                        >
                          {test.indicator || '—'}
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: 'var(--text, #0D1B3E)',
                          }}
                        >
                          {test.result || '—'}
                        </div>

                        <div
                          style={{
                            textAlign: 'right',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: '#7C3AED',
                            }}
                          >
                            {clamp(test.score)}
                          </div>
                          {test.added_by_coach &&
                            scoreDifference !== null &&
                            scoreDifference !== 0 && (
                              <div
                                style={{
                                  marginTop: 3,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color:
                                    scoreDifference > 0
                                      ? '#10B981'
                                      : '#EF4444',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {scoreDifference > 0
                                  ? `+${scoreDifference}`
                                  : scoreDifference}
                              </div>
                            )}
                        </div>
                      </>
                    )}
                  </div>
                  )
                })}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 16,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setFitnessRecordsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {fitnessTestEditOpen &&
        selectedStudent &&
        editingFitnessTest && (
          <TestModal
            title="Edit Fitness Test"
            form={fitnessTestForm}
            onChange={handleFitnessTestChange}
            onSave={saveEditedFitnessTest}
            onClose={() => {
              if (savingFitnessTest) return
              setFitnessTestEditOpen(false)
              setEditingFitnessTest(null)
              resetFitnessTestForm()
              setFitnessRecordsOpen(true)
            }}
            saving={savingFitnessTest}
            currentScore={
              fitnessTestForm.indicator
                ? Number(
                    getPlayerFitnessTestScore(
                      fitnessTestForm.indicator
                    )
                  ) || 0
                : 0
            }
          />
        )}
      {fitnessTestAddOpen && selectedStudent && (
        <TestModal
          title="Add Fitness Test"
          form={fitnessTestForm}
          onChange={handleFitnessTestChange}
          onSave={saveCoachFitnessTest}
          onClose={() => {
            if (savingFitnessTest) return
            setFitnessTestAddOpen(false)
            resetFitnessTestForm()
            setFitnessRecordsOpen(true)
          }}
          saving={savingFitnessTest}
          currentScore={
            fitnessTestForm.indicator
              ? Number(
                  getPlayerFitnessTestScore(
                    fitnessTestForm.indicator
                  )
                ) || 0
              : 0
          }
        />
      )}
      {allMatchesOpen && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              setAllMatchesOpen(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 760,
              width: '92vw',
              maxHeight: '88vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>
                  Match history
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: 'var(--text-muted, #8892A4)',
                  }}
                >
                  {selectedStudent.name} • {selectedStudent.matches.length}{' '}
                  match{selectedStudent.matches.length === 1 ? '' : 'es'}
                </div>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setAllMatchesOpen(false)}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: 12,
              }}
            >
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => {
                  setAllMatchesOpen(false)
                  openAddMatch()
                }}
                style={{ fontSize: 11 }}
              >
                + Add match
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
              }}
            >
              {selectedStudent.matches.map(match => (
                <div
                  key={match.id}
                  onClick={() => {
                    setAllMatchesOpen(false)
                    openMatchDetail(match)
                  }}
                  style={{
                    padding: '12px 13px',
                    borderRadius: 11,
                    border: '1px solid var(--line, #EEF1F8)',
                    background: 'var(--card, #FFFFFF)',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--text, #0D1B3E)',
                          }}
                        >
                          vs {match.opponent}
                        </span>
                        <span
                          className={
                            match.result === 'Win'
                              ? styles.badgeGreen
                              : styles.badgeRed
                          }
                        >
                          {match.result}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: 'var(--text-muted, #8892A4)',
                        }}
                      >
                        {formatDate(match.date)}
                        {' • '}
                        {match.type}
                        {match.score ? ` • ${match.score}` : ''}
                      </div>
                      {match.coachNote && (
                        <div
                          style={{
                            marginTop: 7,
                            fontSize: 11,
                            color: '#7C3AED',
                            fontWeight: 700,
                          }}
                        >
                          Coach note added
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted, #8892A4)',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      View details
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {allInjuriesOpen && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              setAllInjuriesOpen(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 820,
              width: '92vw',
              maxHeight: '88vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>
                  Injury history
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: 'var(--text-muted, #8892A4)',
                  }}
                >
                  {selectedStudent.name} • {selectedStudent.injuries.length}{' '}
                  record{selectedStudent.injuries.length === 1 ? '' : 's'}
                </div>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setAllInjuriesOpen(false)}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  viewportWidth <= 700
                    ? 'minmax(0, 1fr)'
                    : '200px minmax(0, 1fr)',
                gap: 18,
                alignItems: 'start',
                minWidth: 0,
              }}
            >
              <InjuryBodyMap injuries={selectedStudent.injuries} />

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 9,
                  minWidth: 0,
                }}
              >
                {selectedStudent.injuries.map(injury => {
                  const statusColor =
                    getInjuryStatusColor(injury.status)
                  const severityColor =
                    getInjurySeverityColor(injury.severity)
                  return (
                    <div
                      key={injury.id}
                      onClick={() => {
                        setAllInjuriesOpen(false)
                        openInjuryDetail(injury)
                      }}
                      style={{
                        padding: '12px 13px',
                        borderRadius: 11,
                        border: '1px solid var(--line, #EEF1F8)',
                        background: 'var(--card, #FFFFFF)',
                        cursor: 'pointer',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 10,
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
                            {injury.name}
                          </div>

                          <div
                            style={{
                              marginTop: 3,
                              fontSize: 11,
                              color: 'var(--text-muted, #8892A4)',
                            }}
                          >
                            Logged {formatDate(injury.date)}
                          </div>

                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              color: severityColor,
                            }}
                          >
                            {injury.severity || 'Mild'} severity
                          </div>
                        </div>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 999,
                            background:
                              `color-mix(in srgb, ${statusColor} 12%, var(--card, #FFFFFF))`,
                            color: statusColor,
                            fontSize: 9,
                            fontWeight: 700,
                          }}
                        >
                          {injury.status}
                        </span>
                      </div>
                      {injury.notes && (
                        <div
                          style={{
                            marginTop: 8,
                            padding: '8px 9px',
                            borderRadius: 8,
                            background: 'var(--soft, #F7F9FF)',
                            fontSize: 11,
                            lineHeight: 1.55,
                            color: 'var(--text, #0D1B3E)',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {injury.notes}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      {injuryDetailOpen && selectedStudent && selectedInjury && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              closeInjuryDetail()
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 620,
              width: '92vw',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div>
                <div className={styles.modalTitle}>
                  Injury details
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: 'var(--text-muted, #8892A4)',
                  }}
                >
                  {selectedStudent.name}
                </div>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeInjuryDetail}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  viewportWidth <= 700
                    ? 'minmax(0, 1fr)'
                    : '150px minmax(0, 1fr)',
                gap: 18,
                alignItems: 'start',
                minWidth: 0,
              }}
            >
              <div>
                <div
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: '1px solid var(--line, #EEF1F8)',
                    background: 'var(--soft, #F7F9FF)',
                  }}
                >
                  <svg
                    viewBox="0 0 120 170"
                    width="130"
                    height="180"
                    role="img"
                    aria-label="Selected injury location"
                    style={{ display: 'block', margin: '0 auto' }}
                  >
                    <image
                      href="/humanbody.png"
                      x="18"
                      y="0"
                      width="84"
                      height="170"
                      preserveAspectRatio="xMidYMid meet"
                      pointerEvents="none"
                    />
                    {(() => {
                      const hasSavedPoint =
                        selectedInjury.bodyX !== null &&
                        selectedInjury.bodyX !== undefined &&
                        selectedInjury.bodyY !== null &&
                        selectedInjury.bodyY !== undefined &&
                        Number.isFinite(Number(selectedInjury.bodyX)) &&
                        Number.isFinite(Number(selectedInjury.bodyY))
                      const point = hasSavedPoint
                        ? {
                            cx: Number(selectedInjury.bodyX),
                            cy: Number(selectedInjury.bodyY),
                          }
                        : getFallbackInjuryPoint(selectedInjury.name)
                      return (
                        <>
                          <circle
                            cx={point.cx}
                            cy={point.cy}
                            r="8"
                            fill="var(--card, #FFFFFF)"
                          />
                          <circle
                            cx={point.cx}
                            cy={point.cy}
                            r="5"
                            fill={getInjuryStatusColor(
                              selectedInjury.status
                            )}
                          />
                        </>
                      )
                    })()}
                  </svg>
                </div>
                {selectedInjury.imageUrl && (
                  <img
                    src={selectedInjury.imageUrl}
                    alt="Injury"
                    style={{
                      marginTop: 12,
                      width: '100%',
                      maxHeight: 180,
                      objectFit: 'cover',
                      borderRadius: 12,
                      border: '1px solid var(--line, #EEF1F8)',
                    }}
                  />
                )}
              </div>

              <div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: 'var(--text, #0D1B3E)',
                    marginBottom: 14,
                  }}
                >
                  {selectedInjury.name}
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Date</span>
                  <span className={styles.statVal}>
                    {formatDate(selectedInjury.date)}
                  </span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Status</span>
                  <span
                    style={{
                      padding: '3px 9px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                      color: getInjuryStatusColor(selectedInjury.status),
                      background:
                        `color-mix(in srgb, ${getInjuryStatusColor(
                          selectedInjury.status
                        )} 12%, var(--card, #FFFFFF))`,
                    }}
                  >
                    {selectedInjury.status}
                  </span>
                </div>

                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Severity</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: getInjurySeverityColor(selectedInjury.severity),
                    }}
                  >
                    {selectedInjury.severity || 'Mild'}
                  </span>
                </div>

                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-muted, #8892A4)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.55,
                      marginBottom: 6,
                    }}
                  >
                    Notes
                  </div>

                  <div
                    style={{
                      minHeight: 70,
                      padding: '12px 13px',
                      borderRadius: 10,
                      background: 'var(--soft, #F7F9FF)',
                      color: 'var(--text, #0D1B3E)',
                      fontSize: 12,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedInjury.notes || 'No notes provided.'}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 18,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={closeInjuryDetail}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {matchDetailOpen && selectedStudent && selectedMatch && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              closeMatchDetail()
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 560,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Match Details
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeMatchDetail}
              >
                ×
              </button>
            </div>

            <div
              style={{
                background:
                  selectedMatch.result === 'Win'
                    ? 'rgba(0, 196, 140, 0.10)'
                    : 'rgba(239, 68, 68, 0.10)',
                borderRadius: 12,
                padding: '14px 16px',
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--text, #0D1B3E)',
                  }}
                >
                  vs {selectedMatch.opponent}
                </div>

                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted, #8892A4)',
                    marginTop: 3,
                  }}
                >
                  {selectedMatch.type}
                  {' • '}
                  {formatDate(selectedMatch.date)}
                </div>
              </div>
              <span
                className={
                  selectedMatch.result === 'Win'
                    ? styles.badgeGreen
                    : styles.badgeRed
                }
              >
                {selectedMatch.result}
              </span>
            </div>
            {selectedMatch.type !== 'Singles' && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Player partner</span>
                <span className={styles.statVal}>
                  {selectedMatch.partnerName || '—'}
                </span>
              </div>
            )}
            {[
              ['Opponent', selectedMatch.opponent],
              ['Match type', selectedMatch.type],
              ['Date', formatDate(selectedMatch.date)],
              ['Set 1', selectedMatch.score1 || '—'],
              ['Set 2', selectedMatch.score2 || '—'],
              ['Set 3', selectedMatch.score3 || '—'],
            ].map(([label, value]) => (
              <div className={styles.statRow} key={label}>
                <span className={styles.statLabel}>{label}</span>
                <span className={styles.statVal}>{value}</span>
              </div>
            ))}
            <div
              className={styles.statRow}
              style={{ alignItems: 'flex-start' }}
            >
              <span className={styles.statLabel}>Player match note</span>
              <span
                className={styles.statVal}
                style={{
                  textAlign: 'right',
                  whiteSpace: 'pre-wrap',
                  maxWidth: 330,
                }}
              >
                {selectedMatch.playerNotes || '—'}
              </span>
            </div>

            <div style={{ marginTop: 18 }}>
              <div
                className={styles.cardTitle}
                style={{ marginBottom: 8 }}
              >
                Match video
              </div>
              {selectedMatch.videoUrl ? (
                <video
                  src={selectedMatch.videoUrl}
                  controls
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    background: '#000',
                    maxHeight: 260,
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: '24px 16px',
                    borderRadius: 12,
                    background: 'var(--soft, #F7F9FF)',
                    border: '1px dashed var(--line, #EEF1F8)',
                    color: 'var(--text-muted, #8892A4)',
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                >
                  No video uploaded for this match.
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 12,
                borderRadius: 10,
                background:
                  'color-mix(in srgb, #7C3AED 8%, var(--soft, #F7F9FF))',
                border:
                  '1px solid color-mix(in srgb, #7C3AED 18%, var(--line, #EEF1F8))',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#7C3AED',
                  textTransform: 'uppercase',
                  letterSpacing: 0.55,
                  marginBottom: 5,
                }}
              >
                Coach match note
              </div>

              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.6,
                  color: 'var(--text, #0D1B3E)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedMatch.coachNote ||
                  'No coach note has been added for this match yet.'}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 18,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={closeMatchDetail}
              >
                Close
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => {
                  setMatchDetailOpen(false)
                  openMatchNote(selectedMatch)
                }}
              >
                {selectedMatch.coachNote
                  ? 'Edit coach note'
                  : 'Add coach note'}
              </button>
            </div>
          </div>
        </div>
      )}
      {matchModalOpen && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (
              event.target === event.currentTarget &&
              !savingMatch
            ) {
              setMatchModalOpen(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 600,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Add match for {selectedStudent.name}
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setMatchModalOpen(false)}
                disabled={savingMatch}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  viewportWidth <= 700
                    ? 'minmax(0, 1fr)'
                    : 'repeat(2, minmax(0, 1fr))',
                gap: 12,
              }}
            >
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Date</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={matchForm.date}
                  onChange={event =>
                    setMatchForm(current => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                  disabled={savingMatch}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Match type</label>
                <select
                  className={styles.formSelect}
                  value={matchForm.type}
                  onChange={event =>
                    setMatchForm(current => ({
                      ...current,
                      type: event.target.value,
                      partnerName:
                        event.target.value === 'Singles'
                          ? ''
                          : current.partnerName,
                      partnerUserId:
                        event.target.value === 'Singles'
                          ? null
                          : current.partnerUserId,
                      opponent2:
                        event.target.value === 'Singles'
                          ? ''
                          : current.opponent2,
                      opponentUserId2:
                        event.target.value === 'Singles'
                          ? null
                          : current.opponentUserId2,
                    }))
                  }
                  disabled={savingMatch}
                >
                  <option>Singles</option>
                  <option>Mixed Doubles</option>
                  <option>Womens Doubles</option>
                  <option>Mens Double</option>
                </select>
              </div>
            </div>
            {matchForm.type !== 'Singles' && (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  Player partner
                </label>
                <input
                  className={styles.formInput}
                  placeholder="Search account or type manually"
                  value={matchForm.partnerName}
                  onChange={event =>
                    setMatchForm(current => ({
                      ...current,
                      partnerName: event.target.value,
                      partnerUserId: null,
                    }))
                  }
                  disabled={savingMatch}
                />
                <MatchPlayerSuggestions
                  items={partnerSuggestions}
                  onSelect={player =>
                    selectMatchPlayer('partner', player)
                  }
                />
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  matchForm.type === 'Singles' || viewportWidth <= 700
                    ? 'minmax(0, 1fr)'
                    : 'repeat(2, minmax(0, 1fr))',
                gap: 12,
              }}
            >
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  {matchForm.type === 'Singles'
                    ? 'Opponent'
                    : 'Opponent 1'}
                </label>
                <input
                  className={styles.formInput}
                  placeholder="Search account or type manually"
                  value={matchForm.opponent}
                  onChange={event =>
                    setMatchForm(current => ({
                      ...current,
                      opponent: event.target.value,
                      opponentUserId: null,
                    }))
                  }
                  disabled={savingMatch}
                />
                <MatchPlayerSuggestions
                  items={opponent1Suggestions}
                  onSelect={player =>
                    selectMatchPlayer('opponent1', player)
                  }
                />
              </div>
              {matchForm.type !== 'Singles' && (
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>
                    Opponent 2
                  </label>
                  <input
                    className={styles.formInput}
                    placeholder="Search account or type manually"
                    value={matchForm.opponent2}
                    onChange={event =>
                      setMatchForm(current => ({
                        ...current,
                        opponent2: event.target.value,
                        opponentUserId2: null,
                      }))
                    }
                    disabled={savingMatch}
                  />
                  <MatchPlayerSuggestions
                    items={opponent2Suggestions}
                    onSelect={player =>
                      selectMatchPlayer('opponent2', player)
                    }
                  />
                </div>
              )}
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Game score</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    viewportWidth <= 560
                      ? 'minmax(0, 1fr)'
                      : 'repeat(3, minmax(0, 1fr))',
                  gap: 10,
                }}
              >
                {[
                  ['score1', 'Set 1', '21-18'],
                  ['score2', 'Set 2', '21-15'],
                  ['score3', 'Set 3', '—'],
                ].map(([key, label, placeholder]) => (
                  <div key={key}>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted, #8892A4)',
                        marginBottom: 5,
                      }}
                    >
                      {label}
                    </div>
                    <input
                      className={styles.formInput}
                      placeholder={placeholder}
                      value={matchForm[key]}
                      onChange={event =>
                        setMatchForm(current => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      disabled={savingMatch}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Result</label>
              <select
                className={styles.formSelect}
                value={matchForm.result}
                onChange={event =>
                  setMatchForm(current => ({
                    ...current,
                    result: event.target.value,
                  }))
                }
                disabled={savingMatch}
              >
                <option>Win</option>
                <option>Loss</option>
              </select>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Match notes</label>
              <textarea
                className={styles.formTextarea}
                rows={3}
                placeholder="Optional notes for this match record."
                value={matchForm.notes}
                onChange={event =>
                  setMatchForm(current => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                disabled={savingMatch}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 14,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setMatchModalOpen(false)}
                disabled={savingMatch}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={saveMatch}
                disabled={savingMatch}
              >
                {savingMatch ? 'Saving...' : 'Add match'}
              </button>
            </div>
          </div>
        </div>
      )}
      {matchNoteOpen && selectedStudent && selectedMatch && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (
              event.target === event.currentTarget &&
              !savingMatchNote
            ) {
              closeMatchNote()
            }
          }}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 520 }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Coach match note
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeMatchNote}
                disabled={savingMatchNote}
              >
                ×
              </button>
            </div>

            <div
              style={{
                marginBottom: 14,
                padding: 12,
                borderRadius: 10,
                background: 'var(--soft, #F7F9FF)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text, #0D1B3E)',
                }}
              >
                {selectedStudent.name} vs {selectedMatch.opponent}
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: 'var(--text-muted, #8892A4)',
                }}
              >
                {formatDate(selectedMatch.date)}
                {' • '}
                {selectedMatch.type}
                {selectedMatch.score ? ` • ${selectedMatch.score}` : ''}
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Coach note</label>
              <textarea
                className={styles.formTextarea}
                rows={6}
                maxLength={1000}
                placeholder="Write observations about this match, strengths, mistakes, and areas to improve."
                value={matchNote}
                onChange={event => setMatchNote(event.target.value)}
                disabled={savingMatchNote}
              />

              <div
                style={{
                  marginTop: 5,
                  textAlign: 'right',
                  color: 'var(--text-muted, #8892A4)',
                  fontSize: 11,
                }}
              >
                {matchNote.length}/1000
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 14,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={closeMatchNote}
                disabled={savingMatchNote}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={saveMatchNote}
                disabled={savingMatchNote}
              >
                {savingMatchNote ? 'Saving...' : 'Save note'}
              </button>
            </div>
          </div>
        </div>
      )}
      {recommendationOpen && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (
              event.target === event.currentTarget &&
              !savingRecommendation
            ) {
              setRecommendationOpen(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 520 }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Injury training recommendation
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setRecommendationOpen(false)}
                disabled={savingRecommendation}
              >
                ×
              </button>
            </div>

            <div
              style={{
                marginBottom: 14,
                color: 'var(--text-muted, #8892A4)',
                fontSize: 12,
                lineHeight: 1.6,
              }}
            >
              Add training guidance for{' '}
              <strong>{selectedStudent.name}</strong>.
              This recommendation is separate from
              performance feedback and fitness feedback.
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Recommendation
              </label>
              <textarea
                className={styles.formTextarea}
                rows={6}
                maxLength={1000}
                placeholder="Example: Avoid overhead drills this week. Use light footwork and mobility exercises."
                value={injuryRecommendation}
                onChange={event =>
                  setInjuryRecommendation(event.target.value)
                }
                disabled={savingRecommendation}
              />

              <div
                style={{
                  marginTop: 5,
                  textAlign: 'right',
                  color: 'var(--text-muted, #8892A4)',
                  fontSize: 11,
                }}
              >
                {injuryRecommendation.length}/1000
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 14,
              }}
            >
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setRecommendationOpen(false)}
                disabled={savingRecommendation}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={saveInjuryRecommendation}
                disabled={savingRecommendation}
              >
                {savingRecommendation
                  ? 'Saving...'
                  : 'Save recommendation'}
              </button>
            </div>
          </div>
        </div>
      )}
      {editOpen && selectedStudent && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setEditOpen(false)
            }
          }}
          style={{ padding: 18 }}
        >
          <div
            className={styles.modal}
            style={{
              width: 'min(860px, 90vw)',
              maxWidth: 860,
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: 0,
            }}
          >
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: 'var(--card, #FFFFFF)',
                padding: '18px 22px 14px',
                borderBottom:
                  '1px solid var(--line, #EEF1F8)',
              }}
            >
              <div
                className={styles.modalHead}
                style={{ marginBottom: 0 }}
              >
                <div>
                  <div className={styles.modalTitle}>
                    {selectedStudent.progress || selectedStudent.assessment
                      ? `Update ${selectedStudent.name}'s progress`
                      : `Add progress for ${selectedStudent.name}`}
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 11,
                      color: 'var(--text-muted, #8892A4)',
                    }}
                  >
                    Select Performance or Fitness to update one section at a time.
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.modalClose}
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ padding: '18px 22px 22px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: 12,
                  marginBottom: 18,
                }}
              >
                <div
                  className={styles.formRow}
                  style={{ marginBottom: 0 }}
                >
                  <label className={styles.formLabel}>
                    Progress status
                  </label>
                  <select
                    className={styles.formSelect}
                    value={form.progress_status}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        progress_status: event.target.value,
                      }))
                    }
                  >
                    <option>On track</option>
                    <option>Improving</option>
                    <option>Needs attention</option>
                    <option>Injured / recovering</option>
                  </select>
                </div>

                <div
                  className={styles.formRow}
                  style={{ marginBottom: 0 }}
                >
                  <label className={styles.formLabel}>
                    Focus area
                  </label>
                  <input
                    className={styles.formInput}
                    placeholder="e.g. Footwork, recovery, match consistency"
                    value={form.focus_area}
                    onChange={event =>
                      setForm(current => ({
                        ...current,
                        focus_area: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 16,
                  padding: 4,
                  borderRadius: 12,
                  background:
                    'var(--soft, #F7F9FF)',
                  border:
                    '1px solid var(--line, #EEF1F8)',
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setProgressSection('performance')
                  }
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    background:
                      progressSection === 'performance'
                        ? '#1A5FFF'
                        : 'transparent',
                    color:
                      progressSection === 'performance'
                        ? '#FFFFFF'
                        : 'var(--text, #0D1B3E)',
                  }}
                >
                  Performance
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setProgressSection('fitness')
                  }
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 9,
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    background:
                      progressSection === 'fitness'
                        ? '#7C3AED'
                        : 'transparent',
                    color:
                      progressSection === 'fitness'
                        ? '#FFFFFF'
                        : 'var(--text, #0D1B3E)',
                  }}
                >
                  Fitness
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'minmax(0, 1fr)',
                  gap: 18,
                  alignItems: 'start',
                  minWidth: 0,
                }}
              >

                <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted, #8892A4)' }}>
                  A slider marked “Not rated” is only a starting position, not a saved coach score.
                  Move the slider to submit a Coach rating; updating feedback alone will not rate a skill.
                </div>
                {progressSection === 'performance' && (
                <div onChangeCapture={() => setProgressSaveNotice(null)}
                  style={{
                    padding: 18,
                    borderRadius: 14,
                    border: '1px solid var(--line, #EEF1F8)',
                    background:
                      'color-mix(in srgb, #00A878 3%, var(--card, #FFFFFF))',
                  }}
                >
                  <div
                    className={styles.cardTitle}
                    style={{
                      marginBottom: 14,
                      color: '#00A878',
                    }}
                  >
                    Performance progress
                  </div>
                  {[
                    ['smash', 'Smash'],
                    ['defense', 'Defense'],
                    ['footwork', 'Footwork'],
                    ['drop_shot', 'Drop shot'],
                    ['net_play', 'Net play'],
                    ['serve', 'Serve'],
                  ].map(([key, label]) => (
                    <AssessmentSlider
                      key={key}
                      label={`${label} — ${editedCoachRatings.includes(key) || selectedStudent?.assessment?.[key] != null ? 'Coach rating' : 'Not rated'}`}
                      value={form[key]}
                      accentColor="#00A878"
                      onChange={value => {
                        setEditedCoachRatings(current =>
                          current.includes(key) ? current : [...current, key]
                        )
                        setForm(current => ({
                          ...current,
                          [key]: value,
                        }))
                      }}
                    />
                  ))}
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: '1px solid var(--line, #EEF1F8)',
                    }}
                  >
                    <div className={styles.formRow}>
                      <label className={styles.formLabel}>
                        Performance feedback
                      </label>
                      <textarea
                        className={styles.formTextarea}
                        rows={4}
                        maxLength={1000}
                        placeholder="Write feedback about the student's badminton skills and match performance."
                        value={form.performance_comment}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            performance_comment: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className={styles.formRow}>
                      <label className={styles.formLabel}>
                        Performance action plan
                      </label>
                      <textarea
                        className={styles.formTextarea}
                        rows={4}
                        maxLength={1000}
                        placeholder="Example: Practise defensive footwork for 20 minutes, 3 sessions per week until the next review."
                        value={form.performance_action_plan}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            performance_action_plan: event.target.value,
                          }))
                        }
                      />

                      <div
                        style={{
                          marginTop: 5,
                          textAlign: 'right',
                          color: 'var(--text-muted, #8892A4)',
                          fontSize: 11,
                        }}
                      >
                        {form.performance_action_plan.length}/1000
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          viewportWidth <= 700
                            ? 'minmax(0, 1fr)'
                            : 'minmax(160px, 0.7fr) minmax(220px, 1.3fr)',
                        gap: 14,
                        alignItems: 'end',
                      }}
                    >
                      <div className={styles.formRow}>
                        <label className={styles.formLabel}>
                          Action plan deadline
                        </label>
                        <input
                          className={styles.formInput}
                          type="date"
                          value={
                            form.performance_action_deadline
                          }
                          onChange={event =>
                            setForm(current => ({
                              ...current,
                              performance_action_deadline:
                                event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className={styles.formRow}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            marginBottom: 6,
                          }}
                        >
                          <label
                            className={styles.formLabel}
                            style={{ marginBottom: 0 }}
                          >
                            Completion rate
                          </label>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#00A878',
                            }}
                          >
                            {form.performance_action_completion}%
                          </span>
                        </div>

                        <div
                          aria-label={`Performance action plan ${form.performance_action_completion}% complete`}
                          style={{
                            height: 8,
                            borderRadius: 999,
                            background:
                              'var(--line, #EEF1F8)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${clamp(
                                form.performance_action_completion
                              )}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: '#00A878',
                            }}
                          />
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 10,
                            color:
                              'var(--text-muted, #8892A4)',
                          }}
                        >
                          Updated by the player
                        </div>
                      </div>
                    </div>

                    <div
                      className={styles.formRow}
                      style={{ marginTop: 14 }}
                    >
                      <label className={styles.formLabel}>
                        Performance next review date
                      </label>
                      <input
                        className={styles.formInput}
                        type="date"
                        value={
                          form.performance_review_date
                        }
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            performance_review_date:
                              event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        marginTop: 16,
                        paddingTop: 14,
                        borderTop:
                          '1px solid var(--line, #EEF1F8)',
                      }}
                    >
                      <div role="status" aria-live="polite" style={{ fontSize: 12, color: 'var(--text-muted, #8892A4)', lineHeight: 1.5 }}>
                        {progressSaveNotice?.playerId === selectedStudent.id && progressSaveNotice?.section === 'performance' && (
                          <strong style={{ display: 'block', color: '#059669' }}>✓ Saved successfully</strong>
                        )}
                        {(() => {
                          const savedAt = (progressSaveNotice?.playerId === selectedStudent.id && progressSaveNotice?.section === 'performance'
                            ? progressSaveNotice.savedAt
                            : assessmentHistory.find(entry => entry.section === 'performance')?.recorded_at)
                          return savedAt
                            ? `Last saved: ${new Date(savedAt).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`
                            : 'Last saved time not available'
                        })()}
                      </div>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() =>
                          saveProgressSection('performance')
                        }
                        disabled={saving}
                      >
                        {saving
                          ? 'Saving...'
                          : 'Update Performance'}
                      </button>
                    </div>
                  </div>
                </div>

                )}

                {progressSection === 'fitness' && (
                <div onChangeCapture={() => setProgressSaveNotice(null)}
                  style={{
                    padding: 18,
                    borderRadius: 14,
                    border: '1px solid var(--line, #EEF1F8)',
                    background:
                      'color-mix(in srgb, #7C3AED 3%, var(--card, #FFFFFF))',
                  }}
                >
                  <div
                    className={styles.cardTitle}
                    style={{
                      marginBottom: 14,
                      color: '#7C3AED',
                    }}
                  >
                    Fitness progress
                  </div>
                  {[
                    ['endurance', 'Endurance'],
                    ['speed', 'Speed'],
                    ['strength', 'Strength'],
                    ['agility', 'Agility'],
                    ['recovery', 'Recovery'],
                  ].map(([key, label]) => (
                    <AssessmentSlider
                      key={key}
                      label={`${label} — ${editedCoachRatings.includes(key) || selectedStudent?.assessment?.[key] != null ? 'Coach rating' : 'Not rated'}`}
                      value={form[key]}
                      accentColor="#7C3AED"
                      onChange={value => {
                        setEditedCoachRatings(current =>
                          current.includes(key) ? current : [...current, key]
                        )
                        setForm(current => ({
                          ...current,
                          [key]: value,
                        }))
                      }}
                    />
                  ))}
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: '1px solid var(--line, #EEF1F8)',
                    }}
                  >
                    <div className={styles.formRow}>
                      <label className={styles.formLabel}>
                        Fitness feedback
                      </label>
                      <textarea
                        className={styles.formTextarea}
                        rows={4}
                        maxLength={1000}
                        placeholder="Write feedback about fitness, recovery, endurance, strength or conditioning."
                        value={form.fitness_comment}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            fitness_comment: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className={styles.formRow}>
                      <label className={styles.formLabel}>
                        Fitness action plan
                      </label>
                      <textarea
                        className={styles.formTextarea}
                        rows={4}
                        maxLength={1000}
                        placeholder="Example: Complete interval running 3 times per week and record recovery after every session."
                        value={form.fitness_action_plan}
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            fitness_action_plan: event.target.value,
                          }))
                        }
                      />

                      <div
                        style={{
                          marginTop: 5,
                          textAlign: 'right',
                          color: 'var(--text-muted, #8892A4)',
                          fontSize: 11,
                        }}
                      >
                        {form.fitness_action_plan.length}/1000
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          viewportWidth <= 700
                            ? 'minmax(0, 1fr)'
                            : 'minmax(160px, 0.7fr) minmax(220px, 1.3fr)',
                        gap: 14,
                        alignItems: 'end',
                      }}
                    >
                      <div className={styles.formRow}>
                        <label className={styles.formLabel}>
                          Action plan deadline
                        </label>
                        <input
                          className={styles.formInput}
                          type="date"
                          value={
                            form.fitness_action_deadline
                          }
                          onChange={event =>
                            setForm(current => ({
                              ...current,
                              fitness_action_deadline:
                                event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className={styles.formRow}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 10,
                            marginBottom: 6,
                          }}
                        >
                          <label
                            className={styles.formLabel}
                            style={{ marginBottom: 0 }}
                          >
                            Completion rate
                          </label>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#7C3AED',
                            }}
                          >
                            {form.fitness_action_completion}%
                          </span>
                        </div>

                        <div
                          aria-label={`Fitness action plan ${form.fitness_action_completion}% complete`}
                          style={{
                            height: 8,
                            borderRadius: 999,
                            background:
                              'var(--line, #EEF1F8)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${clamp(
                                form.fitness_action_completion
                              )}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: '#7C3AED',
                            }}
                          />
                        </div>

                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 10,
                            color:
                              'var(--text-muted, #8892A4)',
                          }}
                        >
                          Updated by the player
                        </div>
                      </div>
                    </div>

                    <div
                      className={styles.formRow}
                      style={{ marginTop: 14 }}
                    >
                      <label className={styles.formLabel}>
                        Fitness next review date
                      </label>
                      <input
                        className={styles.formInput}
                        type="date"
                        value={
                          form.fitness_review_date
                        }
                        onChange={event =>
                          setForm(current => ({
                            ...current,
                            fitness_review_date:
                              event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        marginTop: 16,
                        paddingTop: 14,
                        borderTop:
                          '1px solid var(--line, #EEF1F8)',
                      }}
                    >
                      <div role="status" aria-live="polite" style={{ fontSize: 12, color: 'var(--text-muted, #8892A4)', lineHeight: 1.5 }}>
                        {progressSaveNotice?.playerId === selectedStudent.id && progressSaveNotice?.section === 'fitness' && (
                          <strong style={{ display: 'block', color: '#059669' }}>✓ Saved successfully</strong>
                        )}
                        {(() => {
                          const savedAt = (progressSaveNotice?.playerId === selectedStudent.id && progressSaveNotice?.section === 'fitness'
                            ? progressSaveNotice.savedAt
                            : assessmentHistory.find(entry => entry.section === 'fitness')?.recorded_at)
                          return savedAt
                            ? `Last saved: ${new Date(savedAt).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`
                            : 'Last saved time not available'
                        })()}
                      </div>
                      <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={() =>
                          saveProgressSection('fitness')
                        }
                        disabled={saving}
                      >
                        {saving
                          ? 'Saving...'
                          : 'Update Fitness'}
                      </button>
                    </div>
                  </div>
                </div>
                )}

              </div>

              <div
                style={{
                  position: 'sticky',
                  bottom: -22,
                  margin: '18px -22px -22px',
                  padding: '14px 22px',
                  background: 'var(--card, #FFFFFF)',
                  borderTop: '1px solid var(--line, #EEF1F8)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  zIndex: 9,
                }}
              >
                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}