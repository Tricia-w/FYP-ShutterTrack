import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
//import { useNavigate } from 'react-router-dom'
import NotificationBell from '../Notifications/NotificationBell'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { calculateMatchStats } from '../../utils/matchStats'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'

const C = {
  text: 'var(--text, #0D1B3E)',
  muted: 'var(--text-muted, #8892A4)',
  card: 'var(--card, #FFFFFF)',
  soft: 'var(--soft, #F6F8FF)',
  line: 'var(--line, #EEF1F8)',
}

const SKILL_COLUMNS = [
  { name: 'Smash', column: 'smash' },
  { name: 'Defense', column: 'defense' },
  { name: 'Footwork', column: 'footwork' },
  { name: 'Drop shot', column: 'drop_shot' },
  { name: 'Net play', column: 'net_play' },
  { name: 'Serve', column: 'serve' },
]

const defaultSkills = SKILL_COLUMNS.map(skill => ({ ...skill, val: 50 }))

const SKILL_COLORS = {
  Smash: '#2563EB',
  Defense: '#14B8A6',
  Footwork: '#8B5CF6',
  'Drop shot': '#F59E0B',
  'Net play': '#EC4899',
  Serve: '#06B6D4',
}

const getMetricColor = label => {
  const base = SKILL_COLORS[label] || '#2563EB'

  return {
    bar: `linear-gradient(
      90deg,
      color-mix(in srgb, ${base} 38%, var(--card, #FFFFFF)) 0%,
      color-mix(in srgb, ${base} 68%, var(--card, #FFFFFF)) 55%,
      ${base} 100%
    )`,
    text: base,
    icon: `color-mix(in srgb, ${base} 18%, var(--card, #FFFFFF))`,
  }
}

const MATCH_TYPES = ['Singles', 'Mixed Doubles', 'Womens Doubles', 'Mens Double']
const isSingles = type => type === 'Singles'

const ACTION_PLAN_META_PREFIX = '__SHUTTLETRACK_ACTION_PLAN__:'

function decodeActionPlans(value) {
  const raw = String(value || '')

  const empty = {
    performance: '',
    performanceDeadline: '',
    performanceCompletion: 0,
    fitness: '',
    fitnessDeadline: '',
    fitnessCompletion: 0,
  }

  if (!raw.startsWith(ACTION_PLAN_META_PREFIX)) {
    return {
      ...empty,
      performance: raw,
    }
  }

  try {
    const parsed = JSON.parse(
      raw.slice(ACTION_PLAN_META_PREFIX.length)
    )

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
          ? Math.max(
              0,
              Math.min(
                100,
                Number(
                  performanceValue.completionRate
                ) || 0
              )
            )
          : 0,

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
          ? Math.max(
              0,
              Math.min(
                100,
                Number(
                  fitnessValue.completionRate
                ) || 0
              )
            )
          : 0,
    }
  } catch {
    return {
      ...empty,
      performance: raw,
    }
  }
}

function encodeActionPlans({
  performance = '',
  performanceDeadline = '',
  performanceCompletion = 0,
  fitness = '',
  fitnessDeadline = '',
  fitnessCompletion = 0,
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
    Math.max(
      0,
      Math.min(
        100,
        Number(
          performanceCompletion
        ) || 0
      )
    )

  const cleanFitnessCompletion =
    Math.max(
      0,
      Math.min(
        100,
        Number(
          fitnessCompletion
        ) || 0
      )
    )

  return `${ACTION_PLAN_META_PREFIX}${JSON.stringify({
    performance: {
      text: cleanPerformance,
      deadline:
        cleanPerformanceDeadline,
      completionRate:
        cleanPerformanceCompletion,
    },
    fitness: {
      text: cleanFitness,
      deadline:
        cleanFitnessDeadline,
      completionRate:
        cleanFitnessCompletion,
    },
  })}`
}

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
    const parsed = JSON.parse(raw.slice(SCHEDULE_META_PREFIX.length))

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

function encodeScheduleNotes({
  notes = '',
  endTime = '',
  activity = '',
  matchType = '',
  status = 'scheduled',
}) {
  return `${SCHEDULE_META_PREFIX}${JSON.stringify({
    notes,
    endTime,
    focus: '',
    activity,
    matchType,
    status,
  })}`
}

const mapUpcomingSchedule = row => {
  const meta = decodeScheduleNotes(row.notes)

  return {
    id: `schedule-${row.id}`,
    schedule_id: row.id,
    is_upcoming: true,
    match_date: row.event_date,
    schedule_type: row.schedule_type || 'Competition',
    match_type: meta.matchType || 'Singles',
    title: row.title || meta.activity || row.schedule_type || 'Upcoming match',
    venue: row.location || '',
    start_time: row.event_time || '',
    end_time: meta.endTime || '',
    notes: meta.notes || '',
    raw_notes: row.notes || '',
    schedule_status: meta.status || 'scheduled',
    created_at: row.created_at || '',
  }
}

const emptyForm = {
  type: 'Singles',
  date: new Date().toISOString().split('T')[0],
  partnerName: '',
  partnerUserId: null,
  opponentName: '',
  opponentUserId: null,
  opponentName2: '',
  opponentUserId2: null,
  score1: '',
  score2: '',
  score3: '',
  result: 'Win',
  roundName: '',
  notes: '',
  videoFile: null,
  videoUrl: '',
  videoFileName: '',
}

const emptyUpcomingForm = {
  date: new Date().toISOString().split('T')[0],
  type: 'Competition',
  title: '',
  matchType: 'Singles',
  startTime: '',
  endTime: '',
  venue: '',
  notes: '',
}

const getInitials = name => {
  const value = String(name || '-').trim()

  if (value.includes('&')) {
    return value
      .split('&')
      .map(part => part.trim().split(/\s+/)[0]?.[0] || '')
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const words = value.split(/\s+/).filter(Boolean)

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
}

const fmtDate = value => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const fmtAddedTime = value => {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

const scoreText = match =>
  [match.score1, match.score2, match.score3].filter(Boolean).join(', ')

const getDisplayName = match => {
  if (isSingles(match.match_type)) return match.opponent_name || '-'
  const opponents = [match.opponent_name, match.opponent_name2]
    .filter(Boolean)
    .join(' & ')
  return opponents || '-'
}

const mapDbMatch = (row, coachNotes = []) => ({
  id: row.id,
  match_type: row.match_type || 'Singles',
  match_date: row.match_date,
  partner_name: row.partner_name || '',
  partner_user_id: row.partner_user_id || null,
  opponent_name: row.opponent_name || '',
  opponent_user_id: row.opponent_user_id || null,
  opponent_name2: row.opponent_name2 || '',
  opponent_user_id2: row.opponent_user_id2 || null,
  score1: row.score1 || '',
  score2: row.score2 || '',
  score3: row.score3 || '',
  result: row.result || 'Win',
  source_schedule_id: row.source_schedule_id || null,
  round_name: row.round_name || '',
  notes: row.notes || '',
  video_url: row.video_url || '',
  video_file_name: row.video_file_name || '',
  created_at: row.created_at || '',
  added_by_role: row.added_by_role || '',
  coach_notes: coachNotes,
})

function MiniIcon({ type, color = 'currentColor', size = 18 }) {
  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  }

  if (type === 'plus') {
    return (
      <svg {...svgProps}>
        <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'matches') {
    return (
      <svg {...svgProps}>
        <rect x="6" y="4" width="12" height="16" rx="3" stroke={color} strokeWidth="2" />
        <path d="M9 8h6M9 12h6M9 16h4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'win') {
    return (
      <svg {...svgProps}>
        <path d="M6 12.5l4 4L18 8" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (type === 'score') {
    return (
      <svg {...svgProps}>
        <path d="M5 16l4.2-4.2 3.2 3.2L19 8.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 8.5H19V13" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (type === 'streak') {
    return (
      <svg {...svgProps}>
        <path d="m12 4 2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.3-4.6 2.3.9-5.2-3.8-3.7 5.2-.8L12 4Z" fill={color} />
      </svg>
    )
  }

  if (type === 'warning') {
    return (
      <svg {...svgProps}>
        <path d="M12 4 20 18H4L12 4Z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 9v4" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="16" r="1" fill={color} />
      </svg>
    )
  }

  if (type === 'success') {
    return (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.8" />
        <path d="m8 12.5 2.5 2.5L16 9.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return null
}

function PerformanceComparisonRow({
  label,
  playerValue,
  coachValue,
  verifierLabel = 'Coach',
  verifierColor = '#7C3AED',
}) {
  const playerScore = Number(playerValue ?? 50)
  const hasCoachValue =
    coachValue !== null &&
    coachValue !== undefined &&
    Number.isFinite(Number(coachValue))
  const coachScore = hasCoachValue ? Number(coachValue) : playerScore
  const hasChange = hasCoachValue && coachScore !== playerScore
  const playerColor = getMetricColor(label)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '78px minmax(0, 1fr) 48px',
        gap: 10,
        alignItems: 'center',
        marginBottom: 14,
      }}
    >
      <div className={styles.skillLbl} style={{ width: 'auto', minWidth: 0 }}>
        {label}
      </div>

      <div
        style={{
          position: 'relative',
          height: 8,
          borderRadius: 999,
          background: 'color-mix(in srgb, var(--line, #EEF1F8) 88%, var(--card, #FFFFFF))',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            width: `${playerScore}%`,
            height: '100%',
            borderRadius: 999,
            background: playerColor.bar,
          }}
        />

        {hasChange && (
          <>
            <div
              title={`${verifierLabel} assessment: ${coachScore}`}
              style={{
                position: 'absolute',
                left: `calc(${coachScore}% - 1px)`,
                top: -5,
                width: 2,
                height: 18,
                borderRadius: 999,
                background: verifierColor,
                boxShadow: `0 0 0 2px color-mix(in srgb, ${verifierColor} 16%, var(--card, #FFFFFF))`,
              }}
            />

            <div
              style={{
                position: 'absolute',
                left: `clamp(0px, calc(${coachScore}% - 26px), calc(100% - 52px))`,
                top: -24,
                minWidth: 52,
                textAlign: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: verifierColor,
                background: `color-mix(in srgb, ${verifierColor} 12%, var(--card, #FFFFFF))`,
                borderRadius: 999,
                padding: '2px 6px',
                whiteSpace: 'nowrap',
              }}
            >
              {verifierLabel} {coachScore}
            </div>
          </>
        )}
      </div>

      <div
        style={{
          width: 48,
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: playerColor.text,
          whiteSpace: 'nowrap',
        }}
      >
        {playerScore}
      </div>
    </div>
  )
}

const PERFORMANCE_NOTIFICATION_TYPES = [
  'coach_performance_assessment',
  'coach_performance_feedback',
  'coach_progress',
]

const getSkillAdvice = skillName => {
  const adviceMap = {
    Smash: 'Work on timing, racket preparation, and transferring power from your legs and core.',
    Defense: 'Practise a low defensive stance, quick racket recovery, and returning smashes to different areas.',
    Footwork: 'Use shadow footwork drills and focus on returning to the centre after every shot.',
    'Drop shot': 'Practise a softer grip, maintain a consistent contact point, and disguise the shot until the final moment.',
    'Net play': 'Keep your racket up, use a relaxed grip, and try to take the shuttle earlier at the net.',
    Serve: 'Practise consistent placement, controlled movement, and reducing unnecessary wrist action.',
  }

  return (
    adviceMap[skillName] ||
    'Include focused practice for this skill during your next training session.'
  )
}

export default function Performance() {
  const { user } = useAuth()
  const videoRef = useRef(null)
  const videoInputRef = useRef(null)

  const [profileId, setProfileId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const showLoader = useLoadingDelay(isLoading, 350)
  const [isSaving, setIsSaving] = useState(false)
  const [matches, setMatches] = useState([])
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [skills, setSkills] = useState(defaultSkills)
  const [hasSkillRecord, setHasSkillRecord] = useState(false)
  const [coachProgress, setCoachProgress] = useState([])
  const [coachAssessments, setCoachAssessments] = useState([])
  const [
    savingActionPlanId,
    setSavingActionPlanId,
  ] = useState(null)

  const [verificationRequest, setVerificationRequest] = useState(null)
  const [verificationSummary, setVerificationSummary] = useState({
    playerCount: 0,
    coachCount: 0,
  })
  const [verificationAssessments, setVerificationAssessments] = useState([])
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [showVerificationDetailsModal, setShowVerificationDetailsModal] = useState(false)
  const [deletingVerificationId, setDeletingVerificationId] = useState(null)
  const [creatingVerification, setCreatingVerification] = useState(false)

  const [filterType, setFilterType] = useState('All')
  const [sortOrder, setSortOrder] = useState('Latest')

  const [showMatchModal, setShowMatchModal] = useState(false)
  const [showUpcomingModal, setShowUpcomingModal] = useState(false)
  const [editingUpcoming, setEditingUpcoming] = useState(null)
  const [upcomingForm, setUpcomingForm] = useState(emptyUpcomingForm)
  const [sourceUpcomingMatch, setSourceUpcomingMatch] = useState(null)
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewMatch, setViewMatch] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [removeVideo, setRemoveVideo] = useState(false)
  const [skillVals, setSkillVals] = useState(defaultSkills.map(skill => skill.val))

  const [partnerSuggestions, setPartnerSuggestions] = useState([])
  const [opponent1Suggestions, setOpponent1Suggestions] = useState([])
  const [opponent2Suggestions, setOpponent2Suggestions] = useState([])

  const set = key => e => {
    const value = e.target.value
    setForm(prev => ({ ...prev, [key]: value }))

    if (key === 'partnerName') setForm(prev => ({ ...prev, partnerUserId: null }))
    if (key === 'opponentName') setForm(prev => ({ ...prev, opponentUserId: null }))
    if (key === 'opponentName2') setForm(prev => ({ ...prev, opponentUserId2: null }))
  }

  const getAuthUser = async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) throw new Error('User not logged in')
    return data.user
  }

  const getOrCreateProfile = useCallback(async authUser => {
    const { data: existingProfile, error: selectError } = await supabase
      .from('player_profiles')
      .select('id, display_name')
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (selectError) throw selectError
    if (existingProfile?.id) return existingProfile.id

    const { data: appUser } = await supabase
      .from('app_users')
      .select('full_name')
      .eq('user_id', authUser.id)
      .maybeSingle()

    const { data: newProfile, error: insertError } = await supabase
      .from('player_profiles')
      .insert({
        user_id: authUser.id,
        display_name: appUser?.full_name || authUser.email?.split('@')[0] || 'Player',
        info_source: 'Self-reported',
      })
      .select('id')
      .single()

    if (insertError) throw insertError
    return newProfile.id
  }, [])

  const loadVerificationData = useCallback(async authUser => {
    const { data: requestRows, error: requestError } = await supabase
      .from('skill_verification_requests')
      .select('*')
      .eq('player_user_id', authUser.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (requestError) {
      console.error('Skill verification request load error:', requestError)
      setVerificationRequest(null)
      setVerificationSummary({ playerCount: 0, coachCount: 0 })
      setVerificationAssessments([])
      return
    }

    const activeRequest = requestRows?.[0] || null
    setVerificationRequest(activeRequest)

    if (!activeRequest?.id) {
      setVerificationSummary({ playerCount: 0, coachCount: 0 })
      setVerificationAssessments([])
      return
    }

    const { data: rows, error } = await supabase
      .from('skill_verifications')
      .select(`
        id,
        verifier_user_id,
        verifier_role,
        verified_at,
        smash,
        defense,
        footwork,
        drop_shot,
        net_play,
        serve,
        feedback
      `)
      .eq('request_id', activeRequest.id)
      .order('verified_at', { ascending: false })

    if (error) {
      console.error('Skill verification load error:', error)
      setVerificationSummary({ playerCount: 0, coachCount: 0 })
      setVerificationAssessments([])
      return
    }

    const verificationRows = rows || []

    setVerificationAssessments(verificationRows)
    setVerificationSummary({
      playerCount: verificationRows.filter(
        row => row.verifier_role === 'player'
      ).length,
      coachCount: verificationRows.filter(
        row => row.verifier_role === 'coach'
      ).length,
    })
  }, [])

  const loadPageData = useCallback(async () => {
    setIsLoading(true)

    try {
      const authUser = await getAuthUser()
      const currentProfileId = await getOrCreateProfile(authUser)
      setProfileId(currentProfileId)

      const { data: matchRows, error: matchError } = await supabase
        .from('player_matches')
        .select('*')
        .eq('player_id', currentProfileId)
        .order('match_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (matchError) throw matchError

      const loadedMatchRows = matchRows || []
      const matchIds = loadedMatchRows.map(row => row.id).filter(Boolean)

      let coachNoteRows = []

      if (matchIds.length > 0) {
        const { data: noteRows, error: noteError } = await supabase
          .from('coach_match_notes')
          .select(`
            id,
            match_id,
            coach_user_id,
            player_user_id,
            note,
            created_at,
            updated_at
          `)
          .eq('player_user_id', authUser.id)
          .in('match_id', matchIds)
          .order('updated_at', { ascending: false })

        if (noteError) {
          console.error('Coach match notes load error:', noteError)
        } else {
          coachNoteRows = noteRows || []
        }
      }

      const notesByMatchId = new Map()

      coachNoteRows.forEach(note => {
        const key = String(note.match_id)
        const current = notesByMatchId.get(key) || []
        current.push(note)
        notesByMatchId.set(key, current)
      })

      setMatches(
        loadedMatchRows.map(row =>
          mapDbMatch(
            row,
            notesByMatchId.get(String(row.id)) || []
          )
        )
      )

      const today = new Date().toISOString().split('T')[0]

      const { data: upcomingRows, error: upcomingError } = await supabase
        .from('player_schedule')
        .select('*')
        .eq('user_id', authUser.id)
        .in('schedule_type', ['Competition', 'Friendly Match'])
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true })

      if (upcomingError) {
        console.error('Upcoming match schedule load error:', upcomingError)
        setUpcomingMatches([])
      } else {
        setUpcomingMatches(
          (upcomingRows || [])
            .map(mapUpcomingSchedule)
            .filter(item => item.schedule_status === 'scheduled')
        )
      }

      const { data: rating, error: ratingError } = await supabase
        .from('player_skill_ratings')
        .select('*')
        .eq('player_id', currentProfileId)
        .maybeSingle()

      if (ratingError) throw ratingError

      if (rating) {
        setHasSkillRecord(true)
        setSkills(
          SKILL_COLUMNS.map(skill => ({
            ...skill,
            val: Number(rating[skill.column] ?? 50),
          }))
        )
      } else {
        setHasSkillRecord(false)
        setSkills(defaultSkills)
      }

      const { data: progressRows, error: progressError } = await supabase
        .from('coach_player_progress')
        .select(`
          id,
          coach_user_id,
          progress_status,
          focus_area,
          coach_comment,
          next_review_date,
          updated_at
        `)
        .eq('player_user_id', authUser.id)
        .order('updated_at', { ascending: false })

      if (progressError) throw progressError
      setCoachProgress(progressRows || [])

      const { data: assessmentRows, error: assessmentError } = await supabase
        .from('coach_player_assessments')
        .select('*')
        .eq('player_user_id', authUser.id)
        .order('updated_at', { ascending: false })

      if (assessmentError) {
        console.error('Coach assessment load error:', assessmentError)
        setCoachAssessments([])
      } else {
        setCoachAssessments(assessmentRows || [])
      }

      await loadVerificationData(authUser)
    } catch (error) {
      console.error('Performance load error:', error)
      alert(error.message || 'Failed to load performance data')
    } finally {
      setIsLoading(false)
    }
  }, [getOrCreateProfile, loadVerificationData])

  useEffect(() => {
    loadPageData()
  }, [loadPageData])

  const searchPlayers = async (keyword, setter) => {
    const term = keyword.trim()

    if (term.length < 2) {
      setter([])
      return
    }

    const { data: authData } = await supabase.auth.getUser()
    const currentUserId = authData?.user?.id

    const [registeredRes, publicRes] = await Promise.all([
      supabase
        .from('player_profiles')
        .select('id, user_id, display_name, profile_photo_url')
        .ilike('display_name', `%${term}%`)
        .limit(6),

      supabase
        .from('public_players')
        .select('id, name')
        .ilike('name', `%${term}%`)
        .limit(6),
    ])

    if (registeredRes.error) {
      console.error('Registered player search error:', registeredRes.error)
    }

    if (publicRes.error) {
      console.error('Public player search error:', publicRes.error)
    }

    const registeredPlayers = (registeredRes.data || [])
      .filter(player => player.user_id !== currentUserId)
      .map(player => ({
        id: `registered-${player.id}`,
        profileId: player.id,
        user_id: player.user_id,
        display_name: player.display_name,
        profile_photo_url: player.profile_photo_url || '',
        source: 'Account',
      }))

    const publicPlayers = (publicRes.data || []).map(player => ({
      id: `public-${player.id}`,
      publicId: player.id,
      user_id: null,
      display_name: player.name,
      profile_photo_url: '',
      source: 'Public player',
    }))

    const merged = [...registeredPlayers, ...publicPlayers]
      .filter(player => player.display_name)
      .slice(0, 8)

    setter(merged)
  }

  useEffect(() => {
    const timer = setTimeout(() => searchPlayers(form.partnerName, setPartnerSuggestions), 250)
    return () => clearTimeout(timer)
  }, [form.partnerName])

  useEffect(() => {
    const timer = setTimeout(() => searchPlayers(form.opponentName, setOpponent1Suggestions), 250)
    return () => clearTimeout(timer)
  }, [form.opponentName])

  useEffect(() => {
    const timer = setTimeout(() => searchPlayers(form.opponentName2, setOpponent2Suggestions), 250)
    return () => clearTimeout(timer)
  }, [form.opponentName2])

  const selectPlayer = (field, player) => {
    if (field === 'partner') {
      setForm(prev => ({ ...prev, partnerName: player.display_name, partnerUserId: player.user_id }))
      setPartnerSuggestions([])
    }

    if (field === 'opponent1') {
      setForm(prev => ({ ...prev, opponentName: player.display_name, opponentUserId: player.user_id }))
      setOpponent1Suggestions([])
    }

    if (field === 'opponent2') {
      setForm(prev => ({ ...prev, opponentName2: player.display_name, opponentUserId2: player.user_id }))
      setOpponent2Suggestions([])
    }
  }

  const stats = useMemo(
    () => calculateMatchStats(matches),
    [matches]
  )

  const visibleMatches = useMemo(() => {
    const combined = [
      ...upcomingMatches,
      ...matches,
    ]

    return combined
      .filter(match => {
        if (filterType === 'All') return true
        if (match.is_upcoming) return false
        return match.match_type === filterType
      })
      .sort((a, b) => {
        const dateA = new Date(`${a.match_date}T00:00:00`).getTime()
        const dateB = new Date(`${b.match_date}T00:00:00`).getTime()

        return sortOrder === 'Latest'
          ? dateB - dateA
          : dateA - dateB
      })
  }, [matches, upcomingMatches, filterType, sortOrder])

  const recommendations = useMemo(() => {
    const lowSkills = skills.filter(skill => skill.val < 70)

    const output = lowSkills.slice(0, 2).map(skill => ({
      icon: 'warning',
      type: 'warning',
      text: `${skill.name} (${skill.val}): ${getSkillAdvice(skill.name)}`,
    }))

    const bestSkill = [...skills].sort((a, b) => b.val - a.val)[0]

    if (bestSkill) {
      output.push({
        icon: 'success',
        type: 'success',
        text: `${bestSkill.name} (${bestSkill.val}): Strong skill. Keep maintaining it.`,
      })
    }

    if (matches.length > 0) {
      output.push({
        icon: stats.losses > stats.wins ? 'warning' : 'success',
        type: stats.losses > stats.wins ? 'warning' : 'success',
        text: `Record: ${stats.wins}W ${stats.losses}L. ${
          stats.losses > stats.wins
            ? 'Focus on consistency and reducing unforced errors.'
            : 'Good match record so far.'
        }`,
      })
    }

    return output
  }, [skills, matches.length, stats.losses, stats.wins])

  const getMatchesForSchedule = scheduleId =>
    matches.filter(match => match.source_schedule_id === scheduleId)

  const getSuggestedNextRound = scheduleId => {
    const linked = getMatchesForSchedule(scheduleId)
    return `Round ${linked.length + 1}`
  }

  const openUpcomingEdit = item => {
    setEditingUpcoming(item)
    setUpcomingForm({
      date: item.match_date || new Date().toISOString().split('T')[0],
      type: item.schedule_type || 'Competition',
      title: item.title || '',
      matchType: item.match_type || 'Singles',
      startTime: item.start_time ? String(item.start_time).slice(0, 5) : '',
      endTime: item.end_time ? String(item.end_time).slice(0, 5) : '',
      venue: item.venue || '',
      notes: item.notes || '',
    })
    setShowUpcomingModal(true)
  }

  const openMatchDetailsFromUpcoming = item => {
    const matchType =
      upcomingForm.matchType ||
      item?.match_type ||
      'Singles'

    const date =
      upcomingForm.date ||
      item?.match_date ||
      new Date().toISOString().split('T')[0]

    setEditingId(null)
    setRemoveVideo(false)

    if (videoInputRef.current) {
      videoInputRef.current.value = ''
    }

    setSourceUpcomingMatch({
      ...item,
      title: upcomingForm.title || item?.title || '',
      schedule_type:
        upcomingForm.type ||
        item?.schedule_type ||
        'Competition',
      match_type: matchType,
      match_date: date,
      venue: upcomingForm.venue || item?.venue || '',
      notes: upcomingForm.notes || item?.notes || '',
    })

    setForm({
      ...emptyForm,
      type: matchType,
      date,
      roundName: getSuggestedNextRound(item?.schedule_id),
      notes: '',
    })

    setShowUpcomingModal(false)
    setEditingUpcoming(null)
    setShowMatchModal(true)
  }

  const finishUpcomingEvent = async item => {
    if (!item?.schedule_id) return

    const linkedMatches = getMatchesForSchedule(item.schedule_id)

    if (linkedMatches.length === 0) {
      alert('Add at least one match result before finishing this event.')
      return
    }

    const confirmed = window.confirm(
      `Finish ${item.title || 'this event'}? It will be removed from Upcoming Matches, but all logged rounds will stay in Match History.`
    )

    if (!confirmed) return

    setIsSaving(true)

    try {
      const authUser = await getAuthUser()
      const currentMeta = decodeScheduleNotes(item.raw_notes || '')

      const { error } = await supabase
        .from('player_schedule')
        .update({
          notes: encodeScheduleNotes({
            notes:
              upcomingForm.notes ||
              item.notes ||
              currentMeta.notes ||
              '',
            endTime:
              upcomingForm.endTime ||
              item.end_time ||
              currentMeta.endTime ||
              '',
            activity:
              upcomingForm.title ||
              item.title ||
              currentMeta.activity ||
              '',
            matchType:
              upcomingForm.matchType ||
              item.match_type ||
              currentMeta.matchType ||
              'Singles',
            status: 'completed',
          }),
        })
        .eq('id', item.schedule_id)
        .eq('user_id', authUser.id)

      if (error) throw error

      setShowUpcomingModal(false)
      setEditingUpcoming(null)
      await loadPageData()
    } catch (error) {
      console.error('Finish upcoming event error:', error)
      alert(error.message || 'Failed to finish this event')
    } finally {
      setIsSaving(false)
    }
  }

  const saveUpcomingMatch = async () => {
    if (!editingUpcoming?.schedule_id) return

    if (!upcomingForm.title.trim()) {
      alert(
        upcomingForm.type === 'Competition'
          ? 'Please enter the competition name.'
          : 'Please enter the match title.'
      )
      return
    }

    setIsSaving(true)

    try {
      const authUser = await getAuthUser()

      const payload = {
        event_date: upcomingForm.date,
        event_time: upcomingForm.startTime || null,
        schedule_type: upcomingForm.type,
        title: upcomingForm.title.trim(),
        location: upcomingForm.venue.trim() || null,
        notes: encodeScheduleNotes({
          notes: upcomingForm.notes.trim(),
          endTime: upcomingForm.endTime,
          activity: upcomingForm.title.trim(),
          matchType: upcomingForm.matchType || 'Singles',
          status: editingUpcoming.schedule_status || 'scheduled',
        }),
      }

      const { error } = await supabase
        .from('player_schedule')
        .update(payload)
        .eq('id', editingUpcoming.schedule_id)
        .eq('user_id', authUser.id)

      if (error) throw error

      setShowUpcomingModal(false)
      setEditingUpcoming(null)
      setUpcomingForm(emptyUpcomingForm)
      await loadPageData()
    } catch (error) {
      console.error('Save upcoming match error:', error)
      alert(error.message || 'Failed to update upcoming match')
    } finally {
      setIsSaving(false)
    }
  }

  const openAdd = () => {
    setEditingId(null)
    setSourceUpcomingMatch(null)
    setRemoveVideo(false)
    setForm(emptyForm)
    if (videoInputRef.current) videoInputRef.current.value = ''
    setShowMatchModal(true)
  }

  const openEdit = (match, event) => {
    event.stopPropagation()
    setSourceUpcomingMatch(null)
    setRemoveVideo(false)
    if (videoInputRef.current) videoInputRef.current.value = ''
    setEditingId(match.id)
    setForm({
      type: match.match_type,
      date: match.match_date || new Date().toISOString().split('T')[0],
      partnerName: match.partner_name || '',
      partnerUserId: match.partner_user_id || null,
      opponentName: match.opponent_name || '',
      opponentUserId: match.opponent_user_id || null,
      opponentName2: match.opponent_name2 || '',
      opponentUserId2: match.opponent_user_id2 || null,
      score1: match.score1 || '',
      score2: match.score2 || '',
      score3: match.score3 || '',
      result: match.result || 'Win',
      roundName: match.round_name || '',
      notes: match.notes || '',
      videoFile: null,
      videoUrl: match.video_url || '',
      videoFileName: match.video_file_name || '',
    })
    setShowMatchModal(true)
  }

  const handleVideoUpload = event => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      alert('Please upload a video file.')
      event.target.value = ''
      return
    }

    if (file.size > 100 * 1024 * 1024) {
      alert('Match video must be below 100MB.')
      event.target.value = ''
      return
    }

    setRemoveVideo(false)

    setForm(prev => ({
      ...prev,
      videoFile: file,
      videoUrl: URL.createObjectURL(file),
      videoFileName: file.name,
    }))
  }

  const uploadMatchVideo = async (authUser, file) => {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${authUser.id}/match_${Date.now()}_${safeName}`

    const { error } = await supabase.storage
      .from('profile-media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      })

    if (error) throw error

    const { data } = supabase.storage
      .from('profile-media')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  const handleSaveMatch = async () => {
    if (!form.opponentName.trim()) {
      alert('Please enter opponent name.')
      return
    }

    if (!isSingles(form.type) && !form.opponentName2.trim()) {
      alert('Please enter opponent 2 name for doubles.')
      return
    }

    if (!form.score1.trim()) {
      alert('Please enter at least set 1 score.')
      return
    }

    setIsSaving(true)

    try {
      const authUser = await getAuthUser()
      const currentProfileId =
        profileId ||
        (await getOrCreateProfile(authUser))

      setProfileId(currentProfileId)

      let finalVideoUrl = removeVideo ? null : form.videoUrl || null
      let finalVideoFileName = removeVideo ? null : form.videoFileName || null

      if (!removeVideo && form.videoFile) {
        finalVideoUrl = await uploadMatchVideo(authUser, form.videoFile)
        finalVideoFileName = form.videoFile.name
      }

      const payload = {
        player_id: currentProfileId,
        match_type: form.type,
        match_date: form.date,
        partner_name: isSingles(form.type)
          ? null
          : form.partnerName.trim() || null,
        partner_user_id: isSingles(form.type)
          ? null
          : form.partnerUserId,
        opponent_name: form.opponentName.trim(),
        opponent_user_id: form.opponentUserId,
        opponent_name2: isSingles(form.type)
          ? null
          : form.opponentName2.trim() || null,
        opponent_user_id2: isSingles(form.type)
          ? null
          : form.opponentUserId2,
        score1: form.score1.trim(),
        score2: form.score2.trim() || null,
        score3: form.score3.trim() || null,
        result: form.result,
        source_schedule_id: sourceUpcomingMatch?.schedule_id || null,
        round_name: form.roundName.trim() || null,
        notes: form.notes.trim() || null,
        video_url: finalVideoUrl,
        video_file_name: finalVideoFileName,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error } = await supabase
          .from('player_matches')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('player_matches')
          .insert(payload)

        if (error) throw error
      }

      setShowMatchModal(false)
      setSourceUpcomingMatch(null)
      setRemoveVideo(false)
      setForm(emptyForm)

      if (videoInputRef.current) {
        videoInputRef.current.value = ''
      }

      await loadPageData()
    } catch (error) {
      console.error('Save match error:', error)
      alert(error.message || 'Failed to save match')
    } finally {
      setIsSaving(false)
    }
  }

  const createVerificationRequest = async () => {
    if (creatingVerification) return

    if (!hasSkillRecord) {
      alert('Please save your skill self-assessment first.')
      return
    }

    setCreatingVerification(true)

    try {
      const authUser = await getAuthUser()
      const currentProfileId =
        profileId ||
        (await getOrCreateProfile(authUser))

      setProfileId(currentProfileId)

      const { error: invalidateError } = await supabase
        .from('skill_verification_requests')
        .update({
          is_active: false,
          invalidated_at: new Date().toISOString(),
        })
        .eq('player_user_id', authUser.id)
        .eq('is_active', true)

      if (invalidateError) throw invalidateError

      const payload = {
        player_user_id: authUser.id,
        player_profile_id: currentProfileId,
        smash: Number(skills[0]?.val ?? 50),
        defense: Number(skills[1]?.val ?? 50),
        footwork: Number(skills[2]?.val ?? 50),
        drop_shot: Number(skills[3]?.val ?? 50),
        net_play: Number(skills[4]?.val ?? 50),
        serve: Number(skills[5]?.val ?? 50),
        is_active: true,
      }

      const { data, error } = await supabase
        .from('skill_verification_requests')
        .insert(payload)
        .select('*')
        .single()

      if (error) throw error

      setVerificationRequest(data)
      setVerificationSummary({
        playerCount: 0,
        coachCount: 0,
      })
      setVerificationAssessments([])
      setShowVerificationModal(true)
    } catch (error) {
      console.error('Create verification request error:', error)
      alert(error.message || 'Failed to create verification request')
    } finally {
      setCreatingVerification(false)
    }
  }

  const copyVerificationLink = async () => {
    if (!verificationRequest?.token) return

    const url =
      `${window.location.origin}/verify-skill/${verificationRequest.token}`

    try {
      await navigator.clipboard.writeText(url)
      alert('Verification link copied.')
    } catch (error) {
      console.error('Copy verification link error:', error)
      window.prompt('Copy this verification link:', url)
    }
  }

  const deleteVerification = async verificationId => {
    if (!verificationId || deletingVerificationId) return

    const confirmed = window.confirm(
      'Remove this verification from your Verification Details?'
    )

    if (!confirmed) return

    setDeletingVerificationId(verificationId)

    try {
      const authUser = await getAuthUser()

      const { error } = await supabase
        .from('skill_verifications')
        .delete()
        .eq('id', verificationId)
        .eq('request_id', verificationRequest?.id)

      if (error) throw error

      await loadVerificationData(authUser)
    } catch (error) {
      console.error('Delete verification error:', error)
      alert(error.message || 'Failed to remove this verification')
    } finally {
      setDeletingVerificationId(null)
    }
  }

  const handleUpdateSkills = async () => {
    setIsSaving(true)

    try {
      const authUser = await getAuthUser()
      const currentProfileId =
        profileId ||
        (await getOrCreateProfile(authUser))

      setProfileId(currentProfileId)

      const { error: invalidateError } = await supabase
        .from('skill_verification_requests')
        .update({
          is_active: false,
          invalidated_at: new Date().toISOString(),
        })
        .eq('player_user_id', authUser.id)
        .eq('is_active', true)

      if (invalidateError) throw invalidateError

      const payload = {
        player_id: currentProfileId,
        smash: skillVals[0],
        defense: skillVals[1],
        footwork: skillVals[2],
        drop_shot: skillVals[3],
        net_play: skillVals[4],
        serve: skillVals[5],
        source: 'Self-reported',
        updated_by_name: user?.name || 'Player',
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('player_skill_ratings')
        .upsert(payload, { onConflict: 'player_id' })

      if (error) throw error

      setSkills(
        SKILL_COLUMNS.map((skill, index) => ({
          ...skill,
          val: skillVals[index],
        }))
      )
      setHasSkillRecord(true)
      setVerificationRequest(null)
      setVerificationSummary({
        playerCount: 0,
        coachCount: 0,
      })
      setVerificationAssessments([])
      setShowSkillModal(false)
    } catch (error) {
      console.error('Save skills error:', error)
      alert(error.message || 'Failed to save skills')
    } finally {
      setIsSaving(false)
    }
  }

  const updatePerformanceActionCompletion =
    async (
      progressItem,
      completionRate
    ) => {
      if (
        !progressItem?.id ||
        savingActionPlanId
      ) {
        return
      }

      const nextCompletion =
        Math.max(
          0,
          Math.min(
            100,
            Number(
              completionRate
            ) || 0
          )
        )

      const currentPlans =
        decodeActionPlans(
          progressItem.coach_comment
        )

      const nextCoachComment =
        encodeActionPlans({
          performance:
            currentPlans.performance,
          performanceDeadline:
            currentPlans.performanceDeadline,
          performanceCompletion:
            nextCompletion,
          fitness:
            currentPlans.fitness,
          fitnessDeadline:
            currentPlans.fitnessDeadline,
          fitnessCompletion:
            currentPlans.fitnessCompletion,
        })

      setSavingActionPlanId(
        progressItem.id
      )

      try {
        const authUser =
          await getAuthUser()

        const {
          data,
          error,
        } = await supabase
          .from(
            'coach_player_progress'
          )
          .update({
            coach_comment:
              nextCoachComment,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            'id',
            progressItem.id
          )
          .eq(
            'player_user_id',
            authUser.id
          )
          .select(`
            id,
            coach_user_id,
            progress_status,
            focus_area,
            coach_comment,
            next_review_date,
            updated_at
          `)

        if (error) {
          throw error
        }

        const updatedRow =
          data?.[0] || null

        if (!updatedRow) {
          throw new Error(
            'Your account does not currently have permission to update this action plan completion rate.'
          )
        }

        setCoachProgress(
          current =>
            current.map(item =>
              item.id ===
              updatedRow.id
                ? updatedRow
                : item
            )
        )
      } catch (error) {
        console.error(
          'Update action plan completion error:',
          error
        )

        alert(
          error.message ||
            'Failed to update action plan completion.'
        )
      } finally {
        setSavingActionPlanId(
          null
        )
      }
    }

  const SuggestionBox = ({ items, onSelect }) => {
    if (!items.length) return null

    return (
      <div
        style={{
          border: `1px solid ${C.line}`,
          borderRadius: 10,
          background: '#FFFFFF',
          marginTop: 6,
          overflow: 'hidden',
          boxShadow: '0 10px 25px rgba(15, 23, 42, 0.08)',
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
              background: '#FFFFFF',
              padding: '10px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              textAlign: 'left',
              color: '#0D1B3E',
            }}
          >
            <span
              className={styles.av}
              style={{
                width: 28,
                height: 28,
                fontSize: 10,
                background: '#E8EFFE',
                color: '#1A5FFF',
                WebkitTextFillColor: '#1A5FFF',
                border: '1px solid #D8E4FF',
                flexShrink: 0,
              }}
            >
              {getInitials(item.display_name)}
            </span>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#0D1B3E',
                  WebkitTextFillColor: '#0D1B3E',
                  lineHeight: 1.25,
                }}
              >
                {item.display_name}
              </div>
            </div>

            <span
              style={{
                fontSize: 11,
                color: '#8892A4',
                WebkitTextFillColor: '#8892A4',
                marginLeft: 'auto',
                flexShrink: 0,
              }}
            >
              {item.source || 'Account'}
            </span>
          </button>
        ))}
      </div>
    )
  }

  if (isLoading && !showLoader) {
    return null
  }

  if (showLoader) {
    return (
      <div className={styles.card}>
        <Loader text="Loading performance..." />
      </div>
    )
  }

  return (
    <div className={styles.playerReadablePage}>
      <style>{`
        .performanceVerificationNote {
          font-size: 13px !important;
        }

        .performanceCoachFeedback [style*='font-size: 10px'],
        .performanceCoachFeedback [style*='font-size: 11px'] {
          font-size: 13px !important;
        }

        .performanceCoachFeedback [style*='font-size: 12px'],
        .performanceCoachFeedback [style*='font-size: 13px'] {
          font-size: 14px !important;
        }

        .performanceRecommendation {
          font-size: 14px !important;
          font-weight: 400 !important;
        }
      `}</style>

      <div className={styles.pageHead}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div className={styles.pageTitle}>Performance</div>
            <div className={styles.pageSub}>
              Match records, results, and skill progress
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className={styles.btnPrimary} onClick={openAdd}>
              <MiniIcon type="plus" />
              Log Match
            </button>

            <NotificationBell
              supabase={supabase}
              userId={user?.id}
              title="Performance notifications"
              sourceTypes={PERFORMANCE_NOTIFICATION_TYPES}
            />
          </div>
        </div>
      </div>

      <div className={styles.g4} style={{ marginBottom: 16 }}>
        <div className={styles.metric}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#E8EFFE',
              color: '#1A5FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <MiniIcon type="matches" color="#1A5FFF" />
          </div>
          <div
            className={styles.metricVal}
            style={{
              color: '#1A5FFF',
              WebkitTextFillColor: '#1A5FFF',
            }}
          >
            {matches.length}
          </div>
          <div className={styles.metricLbl}>Total matches</div>
        </div>

        <div className={styles.metric}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#DDF8EF',
              color: '#00C48C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <MiniIcon type="win" color="#00C48C" />
          </div>
          <div
            className={styles.metricVal}
            style={{
              color: '#00C48C',
              WebkitTextFillColor: '#00C48C',
            }}
          >
            {stats.winRate}%
          </div>
          <div className={styles.metricLbl}>Win rate</div>
        </div>

        <div className={styles.metric}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#E8EFFE',
              color: '#1A5FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <MiniIcon type="score" color="#1A5FFF" />
          </div>
          <div
            className={styles.metricVal}
            style={{
              color: '#1A5FFF',
              WebkitTextFillColor: '#1A5FFF',
            }}
          >
            {stats.averageScorePerSet}
          </div>
          <div className={styles.metricLbl}>Avg score/set</div>
        </div>

        <div className={styles.metric}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#FEF3C7',
              color: '#F59E0B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <MiniIcon type="streak" color="#F59E0B" />
          </div>
          <div
            className={styles.metricVal}
            style={{
              color: '#F59E0B',
              WebkitTextFillColor: '#F59E0B',
            }}
          >
            {stats.bestWinStreak}W
          </div>
          <div className={styles.metricLbl}>Best win streak</div>
        </div>
      </div>

      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <div className={styles.cardTitle}>
            Match history — upcoming and completed matches
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              className={styles.formSelect}
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              style={{ width: 155, height: 36 }}
            >
              <option>All</option>
              {MATCH_TYPES.map(type => (
                <option key={type}>{type}</option>
              ))}
            </select>

            <select
              className={styles.formSelect}
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              style={{ width: 120, height: 36 }}
            >
              <option>Latest</option>
              <option>Oldest</option>
            </select>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Date</th>
                <th>Opponent</th>
                <th style={{ width: 135 }}>Type</th>
                <th style={{ width: 180 }}>Score</th>
                <th style={{ width: 80, textAlign: 'center' }}>Result</th>
                <th style={{ width: 60 }}>Video</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {visibleMatches.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div
                      style={{
                        padding: 38,
                        textAlign: 'center',
                        color: C.muted,
                      }}
                    >
                      <div style={{ fontSize: 34, marginBottom: 10 }}>🏸</div>
                      <div style={{ fontWeight: 700, color: C.text }}>
                        No matches logged yet
                      </div>
                      <div style={{ marginTop: 6, fontSize: 13 }}>
                        Start by adding your first match to see your win rate and progress.
                      </div>
                      <button
                        className={styles.btnPrimary}
                        style={{ marginTop: 14 }}
                        onClick={openAdd}
                      >
                        Log First Match
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleMatches.map(match => {
                  if (match.is_upcoming) {
                    return (
                      <tr
                        key={match.id}
                        onClick={() => openUpcomingEdit(match)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td style={{ color: C.muted, fontSize: 12 }}>
                          {fmtDate(match.match_date)}
                        </td>

                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              minWidth: 0,
                            }}
                          >
                            <div
                              className={styles.av}
                              style={{
                                width: 28,
                                height: 28,
                                fontSize: 10,
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(match.title)}
                            </div>

                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, color: C.text }}>
                                {match.title}
                              </div>

                              <div
                                style={{
                                  marginTop: 2,
                                  fontSize: 10,
                                  color: C.muted,
                                }}
                              >
                                {match.schedule_type}
                                {match.venue ? ` • ${match.venue}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={
                              match.match_type?.includes('Double')
                                ? styles.badgePurple
                                : styles.badgeBlue
                            }
                          >
                            {match.match_type || 'Singles'}
                          </span>
                        </td>

                        <td style={{ fontSize: 12, color: C.muted }}>—</td>

                        <td style={{ textAlign: 'center' }}>
                          <span className={styles.badgeBlue}>Upcoming</span>
                        </td>

                        <td style={{ textAlign: 'center', color: C.muted }}>
                          —
                        </td>

                        <td onClick={event => event.stopPropagation()}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'center',
                            }}
                          >
                            <button
                              className={styles.btnIcon}
                              onClick={() => openUpcomingEdit(match)}
                              title="Edit upcoming match"
                            >
                              ✎
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr
                      key={match.id}
                      onClick={() => {
                        setViewMatch(match)
                        setShowViewModal(true)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ color: C.muted, fontSize: 12 }}>
                          {fmtDate(match.match_date)}
                        </td>

                      <td>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <div
                            className={styles.av}
                            style={{
                              width: 28,
                              height: 28,
                              fontSize: 10,
                            }}
                          >
                            {getInitials(getDisplayName(match))}
                          </div>

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: C.text }}>
                              {getDisplayName(match)}
                            </div>

                            {match.round_name && (
                              <div
                                style={{
                                  marginTop: 2,
                                  fontSize: 10,
                                  color: C.muted,
                                }}
                              >
                                {match.round_name}
                              </div>
                            )}
                          </div>

                          {match.coach_notes?.length > 0 && (
                            <span
                              title="Coach note available"
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: '#7C3AED',
                                background:
                                  'color-mix(in srgb, #7C3AED 12%, var(--card, #FFFFFF))',
                                borderRadius: 999,
                                padding: '2px 6px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Coach note
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            match.match_type.includes('Double')
                              ? styles.badgePurple
                              : styles.badgeBlue
                          }
                        >
                          {match.match_type}
                        </span>
                      </td>

                      <td
                        style={{
                          fontWeight: 600,
                          fontSize: 12,
                          color: C.text,
                        }}
                      >
                        {scoreText(match)}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={
                            match.result === 'Win'
                              ? styles.badgeGreen
                              : styles.badgeRed
                          }
                        >
                          {match.result}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {match.video_url ? (
                          <span style={{ fontSize: 16 }} title="Has video">
                            🎬
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: C.muted }}>
                            —
                          </span>
                        )}
                      </td>

                      <td onClick={event => event.stopPropagation()}>
                        <div
                          style={{
                            display: 'flex',
                            gap: 6,
                            justifyContent: 'center',
                          }}
                        >
                          <button
                            className={styles.btnIcon}
                            onClick={event => openEdit(match, event)}
                            title="Edit"
                          >
                            ✎
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.g2}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Skill self-assessment</div>

          {skills.map(skill => {
            const latestCoachAssessment = coachAssessments[0] || null

            return (
              <PerformanceComparisonRow
                key={skill.name}
                label={skill.name}
                playerValue={skill.val}
                coachValue={latestCoachAssessment?.[skill.column]}
                verifierLabel="Coach"
                verifierColor="#7C3AED"
              />
            )
          })}

          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: `1px solid ${C.line}`,
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
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 4,
                  }}
                >
                  Verification
                </div>

                {verificationRequest ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {verificationSummary.playerCount > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#059669',
                          background: '#ECFDF5',
                          borderRadius: 999,
                          padding: '4px 8px',
                        }}
                      >
                        ✓ Verified by {verificationSummary.playerCount} player
                        {verificationSummary.playerCount === 1 ? '' : 's'}
                      </span>
                    )}

                    {verificationSummary.coachCount > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#7C3AED',
                          background: '#F3E8FF',
                          borderRadius: 999,
                          padding: '4px 8px',
                        }}
                      >
                        ✓ Coach verified
                      </span>
                    )}

                    {verificationSummary.playerCount === 0 &&
                      verificationSummary.coachCount === 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#D97706',
                            background: '#FFF7ED',
                            borderRadius: 999,
                            padding: '4px 8px',
                          }}
                        >
                          Pending verification
                        </span>
                      )}
                  </div>
                ) : (
                  <div>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#D97706',
                        background: '#FFF7ED',
                        borderRadius: 999,
                        padding: '4px 8px',
                      }}
                    >
                      Not verified
                    </span>
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 10,
                        color: C.muted,
                      }}
                    >
                      Self-assessment only
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className={styles.btnOutline}
                  style={{ fontSize: 12, padding: '7px 14px' }}
                  onClick={() => {
                    setSkillVals(skills.map(skill => skill.val))
                    setShowSkillModal(true)
                  }}
                >
                  Update skills
                </button>

                {verificationAssessments.length > 0 && (
                  <button
                    className={styles.btnOutline}
                    style={{ fontSize: 12, padding: '7px 14px' }}
                    onClick={() => setShowVerificationDetailsModal(true)}
                  >
                    View verification
                  </button>
                )}

                <button
                  className={styles.btnPrimary}
                  style={{ fontSize: 12, padding: '7px 14px' }}
                  onClick={() => {
                    if (verificationRequest) {
                      setShowVerificationModal(true)
                    } else {
                      createVerificationRequest()
                    }
                  }}
                  disabled={creatingVerification}
                >
                  {creatingVerification
                    ? 'Creating...'
                    : verificationRequest
                      ? 'Share verification'
                      : 'Verify skills'}
                </button>
              </div>
            </div>
          </div>

          <div
            className="performanceVerificationNote"
            style={{ marginTop: 10, fontSize: 11, color: C.muted, lineHeight: 1.5 }}
          >
            Verification is optional. Unverified ratings use your self-assessment;
            the purple marker shows your coach&apos;s rating. Verified results remain
            separate in Verification Details and reset when you update your skills.
          </div>

        </div>

        {(hasSkillRecord || matches.length > 0) && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Recommendations</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recommendations.map((item, index) => (
                <div
                  key={index}
                  className={`${
                    item.type === 'success'
                      ? styles.alertSuccess
                      : styles.alertWarning
                  } performanceRecommendation`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    minHeight: 52,
                    paddingTop: 10,
                    paddingBottom: 10,
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background:
                        item.type === 'success'
                          ? '#DDF8EF'
                          : '#FFF3D6',
                      color:
                        item.type === 'success'
                          ? '#059669'
                          : '#D97706',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <MiniIcon
                      type={item.icon}
                      color={
                        item.type === 'success'
                          ? '#059669'
                          : '#D97706'
                      }
                      size={16}
                    />
                  </span>

                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'block',
                      lineHeight: 1.45,
                      padding: 0,
                    }}
                  >
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {(coachAssessments[0]?.performance_comment ||
        coachProgress.length > 0) && (
        <div
          className={`${styles.card} performanceCoachFeedback`}
          style={{ marginTop: 16 }}
        >
          <div className={styles.cardTitle}>Coach Feedback</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {coachProgress.map(item => {
              const actionPlans = decodeActionPlans(item.coach_comment)

              const matchingAssessment =
                coachAssessments.find(
                  assessment =>
                    String(assessment.coach_user_id || '') ===
                    String(item.coach_user_id || '')
                ) ||
                coachAssessments[0] ||
                null

              return (
                <div
                  key={item.id}
                  style={{
                    padding: 14,
                    background: C.soft,
                    borderRadius: 12,
                    borderLeft: '3px solid #1A5FFF',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                      marginBottom: 10,
                    }}
                  >
                    <span className={styles.badgeBlue}>
                      {item.progress_status || 'Not reviewed'}
                    </span>

                    <span style={{ fontSize: 11, color: C.muted }}>
                      {item.updated_at
                        ? new Date(item.updated_at).toLocaleDateString('en-MY', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : ''}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      color: C.text,
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {matchingAssessment?.performance_comment ||
                      'No performance feedback provided.'}
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'minmax(160px, 0.75fr) minmax(280px, 1.5fr) minmax(160px, 0.75fr)',
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    <div
                      style={{
                        background: C.card,
                        border: `1px solid ${C.line}`,
                        borderRadius: 10,
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>
                        Focus area
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                        {item.focus_area || 'Not set'}
                      </div>
                    </div>

                    <div
                      style={{
                        background: C.card,
                        border: `1px solid ${C.line}`,
                        borderRadius: 10,
                        padding: '10px 12px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: C.muted,
                          marginBottom: 3,
                        }}
                      >
                        Performance action plan
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: C.text,
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {actionPlans.performance ||
                          'No performance action plan set.'}
                      </div>

                      {actionPlans.performance && (
                        <>
                          <div
                            style={{
                              marginTop: 10,
                              paddingTop: 9,
                              borderTop:
                                `1px solid ${C.line}`,
                              display: 'flex',
                              justifyContent:
                                'space-between',
                              gap: 10,
                              flexWrap: 'wrap',
                              fontSize: 12,
                              color: C.muted,
                            }}
                          >
                            <span>
                              Deadline:{' '}
                              <strong
                                style={{
                                  fontWeight: 700,
                                  color: C.text,
                                }}
                              >
                                {actionPlans.performanceDeadline
                                  ? new Date(
                                      `${actionPlans.performanceDeadline}T00:00:00`
                                    ).toLocaleDateString(
                                      'en-MY',
                                      {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                      }
                                    )
                                  : 'Not set'}
                              </strong>
                            </span>

                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#1A5FFF',
                              }}
                            >
                              {actionPlans.performanceCompletion}%
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop: 8,
                            }}
                          >
                            <input
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={
                                actionPlans.performanceCompletion
                              }
                              disabled={
                                savingActionPlanId ===
                                item.id
                              }
                              onChange={event => {
                                const nextValue =
                                  Number(
                                    event.target.value
                                  )

                                setCoachProgress(
                                  current =>
                                    current.map(
                                      progress =>
                                        progress.id ===
                                        item.id
                                          ? {
                                              ...progress,
                                              coach_comment:
                                                encodeActionPlans(
                                                  {
                                                    performance:
                                                      actionPlans.performance,
                                                    performanceDeadline:
                                                      actionPlans.performanceDeadline,
                                                    performanceCompletion:
                                                      nextValue,
                                                    fitness:
                                                      actionPlans.fitness,
                                                    fitnessDeadline:
                                                      actionPlans.fitnessDeadline,
                                                    fitnessCompletion:
                                                      actionPlans.fitnessCompletion,
                                                  }
                                                ),
                                            }
                                          : progress
                                    )
                                )
                              }}
                              onMouseUp={event =>
                                updatePerformanceActionCompletion(
                                  item,
                                  event.currentTarget.value
                                )
                              }
                              onTouchEnd={event =>
                                updatePerformanceActionCompletion(
                                  item,
                                  event.currentTarget.value
                                )
                              }
                              onKeyUp={event => {
                                if (
                                  [
                                    'ArrowLeft',
                                    'ArrowRight',
                                    'Home',
                                    'End',
                                    'PageUp',
                                    'PageDown',
                                  ].includes(
                                    event.key
                                  )
                                ) {
                                  updatePerformanceActionCompletion(
                                    item,
                                    event.currentTarget.value
                                  )
                                }
                              }}
                              style={{
                                width: '100%',
                                accentColor:
                                  '#1A5FFF',
                                cursor:
                                  savingActionPlanId ===
                                  item.id
                                    ? 'wait'
                                    : 'pointer',
                              }}
                            />

                            <div
                              style={{
                                display: 'flex',
                                justifyContent:
                                  'space-between',
                                marginTop: 4,
                                fontSize: 10,
                                color: C.muted,
                              }}
                            >
                              <span>0%</span>
                              <span>50%</span>
                              <span>100%</span>
                            </div>

                            <div
                              style={{
                                marginTop: 6,
                                fontSize: 11,
                                color: C.muted,
                              }}
                            >
                              {savingActionPlanId ===
                              item.id
                                ? 'Saving progress...'
                                : 'Move the slider to update your completion.'}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    <div
                      style={{
                        background: C.card,
                        border: `1px solid ${C.line}`,
                        borderRadius: 10,
                        padding: '10px 12px',
                      }}
                    >
                      <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>
                        Next review
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                        {item.next_review_date
                          ? new Date(
                              `${item.next_review_date}T00:00:00`
                            ).toLocaleDateString('en-MY', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Not set'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showUpcomingModal && editingUpcoming && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              setShowUpcomingModal(false)
              setEditingUpcoming(null)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 560,
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Edit Upcoming Match</div>

              <button
                className={styles.modalClose}
                onClick={() => {
                  setShowUpcomingModal(false)
                  setEditingUpcoming(null)
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14,
              }}
            >
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Date</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={upcomingForm.date}
                  onChange={event =>
                    setUpcomingForm(prev => ({
                      ...prev,
                      date: event.target.value,
                    }))
                  }
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Type</label>
                <select
                  className={styles.formSelect}
                  value={upcomingForm.type}
                  onChange={event =>
                    setUpcomingForm(prev => ({
                      ...prev,
                      type: event.target.value,
                    }))
                  }
                >
                  <option>Competition</option>
                  <option>Friendly Match</option>
                </select>
              </div>
            </div>

            {editingUpcoming.created_at && (
              <div
                style={{
                  marginTop: -2,
                  marginBottom: 14,
                  padding: '9px 11px',
                  borderRadius: 10,
                  background: C.soft,
                  border: `1px solid ${C.line}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    color: C.muted,
                  }}
                >
                  Added
                </span>

                <span
                  style={{
                    color: C.text,
                    fontWeight: 700,
                    textAlign: 'right',
                  }}
                >
                  {fmtAddedTime(editingUpcoming.created_at)}
                </span>
              </div>
            )}

            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                {upcomingForm.type === 'Competition'
                  ? 'Competition name'
                  : 'Match title'}
              </label>
              <input
                className={styles.formInput}
                value={upcomingForm.title}
                placeholder={
                  upcomingForm.type === 'Competition'
                    ? 'e.g. Penang Open Championship'
                    : 'e.g. Club friendly vs KBA'
                }
                onChange={event =>
                  setUpcomingForm(prev => ({
                    ...prev,
                    title: event.target.value,
                  }))
                }
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Match type</label>
              <select
                className={styles.formSelect}
                value={upcomingForm.matchType}
                onChange={event =>
                  setUpcomingForm(prev => ({
                    ...prev,
                    matchType: event.target.value,
                  }))
                }
              >
                <option>Singles</option>
                <option>Mixed Doubles</option>
                <option>Womens Doubles</option>
                <option>Mens Double</option>
              </select>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14,
              }}
            >
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Start time</label>
                <input
                  className={styles.formInput}
                  type="time"
                  value={upcomingForm.startTime}
                  onChange={event =>
                    setUpcomingForm(prev => ({
                      ...prev,
                      startTime: event.target.value,
                    }))
                  }
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>End time</label>
                <input
                  className={styles.formInput}
                  type="time"
                  value={upcomingForm.endTime}
                  onChange={event =>
                    setUpcomingForm(prev => ({
                      ...prev,
                      endTime: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Venue</label>
              <input
                className={styles.formInput}
                placeholder="e.g. Sports Arena"
                value={upcomingForm.venue}
                onChange={event =>
                  setUpcomingForm(prev => ({
                    ...prev,
                    venue: event.target.value,
                  }))
                }
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Notes optional</label>
              <textarea
                className={styles.formTextarea}
                value={upcomingForm.notes}
                placeholder="e.g. Bring extra racket and warm up early"
                onChange={event =>
                  setUpcomingForm(prev => ({
                    ...prev,
                    notes: event.target.value,
                  }))
                }
              />
            </div>

            {getMatchesForSchedule(editingUpcoming.schedule_id).length > 0 && (
              <div
                style={{
                  marginBottom: 14,
                  padding: '12px',
                  borderRadius: 10,
                  border: `1px solid ${C.line}`,
                  background: C.soft,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 8,
                  }}
                >
                  Matches in this event
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 7,
                  }}
                >
                  {getMatchesForSchedule(editingUpcoming.schedule_id).map(match => (
                    <div
                      key={match.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        fontSize: 11,
                      }}
                    >
                      <div style={{ minWidth: 0, color: C.text }}>
                        <span style={{ fontWeight: 700 }}>
                          {match.round_name || 'Match'}
                        </span>
                        {' · '}
                        vs {getDisplayName(match)}
                      </div>

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
                  ))}
                </div>
              </div>
            )}

            <div
              style={{
                padding: '10px 12px',
                marginBottom: 14,
                borderRadius: 10,
                background:
                  'color-mix(in srgb, #1A5FFF 8%, var(--card, #FFFFFF))',
                color: C.muted,
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              This is the same calendar record from Fitness. Editing it here also updates the Fitness calendar. It does not affect your win rate or streak until a completed match result is logged.
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className={styles.btnOutline}
                  onClick={() => openMatchDetailsFromUpcoming(editingUpcoming)}
                  disabled={isSaving}
                >
                  + Add match / next round
                </button>

                {getMatchesForSchedule(editingUpcoming.schedule_id).length > 0 && (
                  <button
                    className={styles.btnOutline}
                    onClick={() => finishUpcomingEvent(editingUpcoming)}
                    disabled={isSaving}
                    style={{
                      color: '#00A878',
                      borderColor: '#A7F3D0',
                    }}
                  >
                    Finish event
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className={styles.btnOutline}
                  onClick={() => {
                    setShowUpcomingModal(false)
                    setEditingUpcoming(null)
                  }}
                >
                  Cancel
                </button>

                <button
                  className={styles.btnPrimary}
                  onClick={saveUpcomingMatch}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMatchModal && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              setShowMatchModal(false)
              setSourceUpcomingMatch(null)
              setRemoveVideo(false)
              if (videoInputRef.current) {
                videoInputRef.current.value = ''
              }
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 580,
              maxHeight: '92vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                {editingId ? 'Edit Match' : 'Log a match'}
              </div>
              <button
                className={styles.modalClose}
                onClick={() => {
                  setShowMatchModal(false)
                  setSourceUpcomingMatch(null)
                  setRemoveVideo(false)
                  if (videoInputRef.current) {
                    videoInputRef.current.value = ''
                  }
                }}
              >
                ✕
              </button>
            </div>

            {sourceUpcomingMatch && !editingId && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '11px 12px',
                  borderRadius: 10,
                  background:
                    'color-mix(in srgb, #1A5FFF 8%, var(--card, #FFFFFF))',
                  border:
                    '1px solid color-mix(in srgb, #1A5FFF 16%, var(--line, #EEF1F8))',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#1A5FFF',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 4,
                  }}
                >
                  From upcoming {sourceUpcomingMatch.schedule_type}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.text,
                  }}
                >
                  {sourceUpcomingMatch.title}
                </div>

                <div
                  style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: C.muted,
                  }}
                >
                  {fmtDate(sourceUpcomingMatch.match_date)}
                  {sourceUpcomingMatch.venue
                    ? ` • ${sourceUpcomingMatch.venue}`
                    : ''}
                </div>
              </div>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14,
                marginBottom: 16,
              }}
            >
              <div>
                <label className={styles.formLabel}>Match type</label>
                <select
                  className={styles.formSelect}
                  value={form.type}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      type: e.target.value,
                      partnerName: '',
                      partnerUserId: null,
                      opponentName2: '',
                      opponentUserId2: null,
                    }))
                  }
                >
                  {MATCH_TYPES.map(type => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={styles.formLabel}>Date</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={form.date}
                  onChange={set('date')}
                />
              </div>
            </div>

            {sourceUpcomingMatch && !editingId && (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Round</label>
                <input
                  className={styles.formInput}
                  list="match-round-options"
                  placeholder="Choose a round or type manually"
                  value={form.roundName}
                  onChange={set('roundName')}
                  autoComplete="off"
                />
                <datalist id="match-round-options">
                  <option value="Group Stage" />
                  <option value="Round 1" />
                  <option value="Round 2" />
                  <option value="Round 3" />
                  <option value="Round 4" />
                  <option value="Round of 64" />
                  <option value="Round of 32" />
                  <option value="Round of 16" />
                  <option value="Quarter Final" />
                  <option value="Semi Final" />
                  <option value="Final" />
                  <option value="3rd Place Playoff" />
                  <option value="Other" />
                </datalist>

                <div style={{ marginTop: 5, fontSize: 10, color: C.muted }}>
                  Select a suggested round or type your own, e.g. Qualifier, Pool A Match 2, Bronze Match.
                </div>
              </div>
            )}

            {!isSingles(form.type) && (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Your Partner Name</label>
                <input
                  className={styles.formInput}
                  placeholder="Search account or type manually"
                  value={form.partnerName}
                  onChange={set('partnerName')}
                />
                <SuggestionBox
                  items={partnerSuggestions}
                  onSelect={player => selectPlayer('partner', player)}
                />
                {form.partnerUserId && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#00C48C',
                      marginTop: 5,
                    }}
                  >
                    Linked to account ✓
                  </div>
                )}
              </div>
            )}

            <div
              className={
                isSingles(form.type)
                  ? styles.formRow
                  : styles.g2
              }
              style={{ marginBottom: 0 }}
            >
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  {isSingles(form.type)
                    ? 'Opponent Name'
                    : 'Opponent 1 Name'}
                </label>
                <input
                  className={styles.formInput}
                  placeholder="Search account or type manually"
                  value={form.opponentName}
                  onChange={set('opponentName')}
                />
                <SuggestionBox
                  items={opponent1Suggestions}
                  onSelect={player => selectPlayer('opponent1', player)}
                />
                {form.opponentUserId && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#00C48C',
                      marginTop: 5,
                    }}
                  >
                    Linked to account ✓
                  </div>
                )}
              </div>

              {!isSingles(form.type) && (
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Opponent 2 Name</label>
                  <input
                    className={styles.formInput}
                    placeholder="Search account or type manually"
                    value={form.opponentName2}
                    onChange={set('opponentName2')}
                  />
                  <SuggestionBox
                    items={opponent2Suggestions}
                    onSelect={player => selectPlayer('opponent2', player)}
                  />
                  {form.opponentUserId2 && (
                    <div
                      style={{
                        fontSize: 11,
                        color: '#00C48C',
                        marginTop: 5,
                      }}
                    >
                      Linked to account ✓
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Game Score</label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 10,
                }}
              >
                {['score1', 'score2', 'score3'].map((key, index) => (
                  <div key={key}>
                    <div
                      style={{
                        fontSize: 11,
                        color: C.muted,
                        marginBottom: 5,
                        fontWeight: 500,
                      }}
                    >
                      Set {index + 1}
                    </div>
                    <input
                      className={styles.formInput}
                      placeholder={
                        index === 2
                          ? '—'
                          : index === 0
                            ? '21-18'
                            : '21-15'
                      }
                      value={form[key]}
                      onChange={set(key)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 14,
                marginBottom: 16,
              }}
            >
              <div>
                <label className={styles.formLabel}>Result</label>
                <select
                  className={styles.formSelect}
                  value={form.result}
                  onChange={set('result')}
                >
                  <option>Win</option>
                  <option>Loss</option>
                </select>
              </div>

              <div>
                <label className={styles.formLabel}>Upload Video</label>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  style={{ display: 'none' }}
                />

                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  style={{
                    width: '100%',
                    height: 42,
                    borderRadius: 10,
                    border: '1.5px solid var(--line)',
                    background:
                      form.videoFile || form.videoUrl
                        ? '#F0FDF4'
                        : '#FFFFFF',
                    color:
                      form.videoFile || form.videoUrl
                        ? '#00A878'
                        : 'var(--text-muted)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 20 20"
                    fill="none"
                  >
                    <path
                      d="M10 3v9M10 3L7 6M10 3l3 3"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 13v2a2 2 0 002 2h8a2 2 0 002-2v-2"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>
                    {form.videoFile || form.videoUrl
                      ? 'Video selected'
                      : 'Upload video'}
                  </span>
                </button>

                {form.videoFileName && (
                  <div
                    style={{
                      marginTop: 7,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {form.videoFileName}
                  </div>
                )}
              </div>
            </div>

            {form.videoUrl && (
              <div className={styles.formRow}>
                <video
                  src={form.videoUrl}
                  controls
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    maxHeight: 180,
                    background: '#000',
                  }}
                />

                <button
                  type="button"
                  onClick={() => {
                    setRemoveVideo(true)
                    setForm(prev => ({
                      ...prev,
                      videoFile: null,
                      videoUrl: '',
                      videoFileName: '',
                    }))
                    if (videoInputRef.current) {
                      videoInputRef.current.value = ''
                    }
                  }}
                  style={{
                    marginTop: 9,
                    border: 'none',
                    background: '#FEE2E2',
                    color: '#DC2626',
                    borderRadius: 9,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Remove video
                </button>
              </div>
            )}

            {removeVideo && (
              <div
                style={{
                  marginTop: -4,
                  marginBottom: 14,
                  padding: '9px 12px',
                  borderRadius: 10,
                  background: '#FFF7ED',
                  color: '#C2410C',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Video will be removed after you save this match.
              </div>
            )}

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Notes</label>
              <textarea
                className={styles.formTextarea}
                placeholder="e.g. Need improve speed"
                value={form.notes}
                onChange={set('notes')}
                style={{ minHeight: 80 }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
                marginTop: 8,
              }}
            >
              <button
                className={styles.btnOutline}
                onClick={() => {
                  setShowMatchModal(false)
                  setSourceUpcomingMatch(null)
                  setRemoveVideo(false)
                  if (videoInputRef.current) {
                    videoInputRef.current.value = ''
                  }
                }}
              >
                Cancel
              </button>

              <button
                className={styles.btnPrimary}
                onClick={handleSaveMatch}
                disabled={isSaving}
              >
                {isSaving
                  ? 'Saving...'
                  : editingId
                    ? 'Update'
                    : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && viewMatch && (
        <div
          className={styles.modalOverlay}
          onClick={event =>
            event.target === event.currentTarget &&
            setShowViewModal(false)
          }
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 520,
              maxHeight: '88vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Match Details</div>
              <button
                className={styles.modalClose}
                onClick={() => setShowViewModal(false)}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background:
                  viewMatch.result === 'Win'
                    ? 'rgba(0, 196, 140, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)',
                borderRadius: 12,
                padding: '14px 18px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                className={styles.av}
                style={{
                  width: 48,
                  height: 48,
                  fontSize: 16,
                  background:
                    viewMatch.result === 'Win'
                      ? '#00C48C'
                      : '#EF4444',
                  color: '#fff',
                }}
              >
                {getInitials(getDisplayName(viewMatch))}
              </div>

              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 16,
                    color: C.text,
                  }}
                >
                  vs {getDisplayName(viewMatch)}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: C.muted,
                    marginTop: 2,
                  }}
                >
                  {viewMatch.match_type} · {fmtDate(viewMatch.match_date)}
                </div>
              </div>

              <span
                className={
                  viewMatch.result === 'Win'
                    ? styles.badgeGreen
                    : styles.badgeRed
                }
                style={{
                  marginLeft: 'auto',
                  fontSize: 13,
                  padding: '5px 14px',
                }}
              >
                {viewMatch.result}
              </span>
            </div>

            {!isSingles(viewMatch.match_type) && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Your partner</span>
                <span className={styles.statVal}>
                  {viewMatch.partner_name || '—'}
                </span>
              </div>
            )}

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Score</span>
              <span
                className={styles.statVal}
                style={{ fontWeight: 600 }}
              >
                {scoreText(viewMatch)}
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Match type</span>
              <span className={styles.statVal}>
                {viewMatch.match_type}
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Date</span>
              <span className={styles.statVal}>
                {fmtDate(viewMatch.match_date)}
              </span>
            </div>

            {viewMatch.added_by_role && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Added by</span>
                <span className={styles.statVal}>
                  {viewMatch.added_by_role === 'coach'
                    ? 'Coach'
                    : 'Player'}
                </span>
              </div>
            )}

            {viewMatch.created_at && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Added</span>
                <span className={styles.statVal}>
                  {fmtAddedTime(viewMatch.created_at)}
                </span>
              </div>
            )}

            {viewMatch.round_name && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Round</span>
                <span className={styles.statVal}>
                  {viewMatch.round_name}
                </span>
              </div>
            )}

            <div
              className={styles.statRow}
              style={{ alignItems: 'flex-start', paddingTop: 12 }}
            >
              <span className={styles.statLabel}>Notes</span>
              <span
                className={styles.statVal}
                style={{
                  textAlign: 'right',
                  color: C.muted,
                  fontWeight: 400,
                }}
              >
                {viewMatch.notes || '—'}
              </span>
            </div>

            {viewMatch.coach_notes?.length > 0 && (
              <div
                style={{
                  marginTop: 18,
                  padding: 14,
                  borderRadius: 12,
                  background:
                    'color-mix(in srgb, #7C3AED 8%, var(--soft, #F6F8FF))',
                  border:
                    '1px solid color-mix(in srgb, #7C3AED 20%, var(--line, #EEF1F8))',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#7C3AED',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    marginBottom: 8,
                  }}
                >
                  Coach match note
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {viewMatch.coach_notes.map(note => (
                    <div
                      key={note.id}
                      style={{
                        padding: '10px 11px',
                        borderRadius: 10,
                        background: C.card,
                        border: `1px solid ${C.line}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          lineHeight: 1.6,
                          color: C.text,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {note.note}
                      </div>

                      <div
                        style={{
                          marginTop: 7,
                          fontSize: 12,
                          fontWeight: 400,
                          color: C.muted,
                        }}
                      >
                        {note.updated_at
                          ? `Updated ${fmtDate(note.updated_at)}`
                          : note.created_at
                            ? `Added ${fmtDate(note.created_at)}`
                            : 'Coach feedback'}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    fontWeight: 400,
                    color: C.muted,
                  }}
                >
                  Coach notes are read-only.
                </div>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <div className={styles.cardTitle}>Match video</div>
              {viewMatch.video_url ? (
                <video
                  ref={videoRef}
                  src={viewMatch.video_url}
                  controls
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    background: '#000',
                    maxHeight: 280,
                  }}
                />
              ) : (
                <div
                  style={{
                    background: C.soft,
                    borderRadius: 12,
                    padding: '32px 20px',
                    textAlign: 'center',
                    color: C.muted,
                    fontSize: 13,
                    border: `2px dashed ${C.line}`,
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
                  No video uploaded for this match.
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 20,
              }}
            >
              <button
                className={styles.btnPrimary}
                onClick={() => setShowViewModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showVerificationModal && verificationRequest && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              setShowVerificationModal(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 520,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Verify Skill Assessment
              </div>

              <button
                className={styles.modalClose}
                onClick={() => setShowVerificationModal(false)}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: '#F8FAFC',
                border: `1px solid ${C.line}`,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 5,
                }}
              >
                Verification is optional
              </div>

              <div
                style={{
                  fontSize: 11,
                  color: C.muted,
                  lineHeight: 1.55,
                }}
              >
                Your self-assessment can still be used without verification.
                If you want an independent check, share the verification link
                with another ShuttleTrack player or coach.
              </div>
            </div>

            <div
              style={{
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 8,
                }}
              >
                Current self-assessment
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                }}
              >
                {[
                  ['Smash', verificationRequest.smash],
                  ['Defense', verificationRequest.defense],
                  ['Footwork', verificationRequest.footwork],
                  ['Drop shot', verificationRequest.drop_shot],
                  ['Net play', verificationRequest.net_play],
                  ['Serve', verificationRequest.serve],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding: '10px 11px',
                      borderRadius: 10,
                      background: C.soft,
                      border: `1px solid ${C.line}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: C.muted,
                        marginBottom: 3,
                      }}
                    >
                      {label}
                    </div>

                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: C.text,
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background:
                  'color-mix(in srgb, #1A5FFF 8%, var(--card, #FFFFFF))',
                color: C.muted,
                fontSize: 11,
                lineHeight: 1.55,
                marginBottom: 16,
              }}
            >
              The verifier must be logged in. You cannot verify your own
              assessment, and each account can verify the current assessment
              only once. Updating your skills resets the current verification.
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <button
                className={styles.btnOutline}
                onClick={() => setShowVerificationModal(false)}
              >
                Not now
              </button>

              <button
                className={styles.btnPrimary}
                onClick={copyVerificationLink}
              >
                Copy verification link
              </button>
            </div>
          </div>
        </div>
      )}


      {showVerificationDetailsModal && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              setShowVerificationDetailsModal(false)
            }
          }}
        >
          <div
            className={styles.modal}
            style={{
              maxWidth: 620,
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Verification Details
              </div>

              <button
                className={styles.modalClose}
                onClick={() => setShowVerificationDetailsModal(false)}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                fontSize: 12,
                color: C.muted,
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              These ratings were submitted independently by other ShuttleTrack users.
              They do not change your self-assessment and they do not add extra markers
              to the main skill chart. Use the × button on a verification card to remove
              it after you no longer need it.
            </div>

            {verificationAssessments.length === 0 ? (
              <div
                style={{
                  padding: 18,
                  borderRadius: 12,
                  background: C.soft,
                  border: `1px solid ${C.line}`,
                  color: C.muted,
                  fontSize: 12,
                  textAlign: 'center',
                }}
              >
                No verification assessment has been submitted yet.
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {verificationAssessments.map((item, index) => {
                  const isCoachVerification = item.verifier_role === 'coach'
                  const roleLabel = isCoachVerification ? 'Coach' : 'Player'
                  const accent = isCoachVerification ? '#7C3AED' : '#059669'

                  return (
                    <div
                      key={item.id || `${item.verifier_user_id}-${index}`}
                      style={{
                        padding: 14,
                        borderRadius: 12,
                        border: `1px solid ${C.line}`,
                        background: C.card,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                          flexWrap: 'wrap',
                          marginBottom: 12,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: accent,
                            background: `color-mix(in srgb, ${accent} 10%, var(--card, #FFFFFF))`,
                            borderRadius: 999,
                            padding: '5px 9px',
                          }}
                        >
                          Verified by {roleLabel}
                        </span>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              color: C.muted,
                            }}
                          >
                            {item.verified_at
                              ? new Date(item.verified_at).toLocaleDateString('en-MY', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : ''}
                          </span>

                          <button
                            type="button"
                            onClick={() => deleteVerification(item.id)}
                            disabled={deletingVerificationId === item.id}
                            title="Remove verification"
                            aria-label="Remove verification"
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 8,
                              border: '1px solid #FECACA',
                              background: '#FEF2F2',
                              color: '#DC2626',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor:
                                deletingVerificationId === item.id
                                  ? 'not-allowed'
                                  : 'pointer',
                              opacity:
                                deletingVerificationId === item.id
                                  ? 0.55
                                  : 1,
                              fontSize: 13,
                              fontWeight: 700,
                              lineHeight: 1,
                              flexShrink: 0,
                            }}
                          >
                            {deletingVerificationId === item.id ? '…' : '✕'}
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 8,
                        }}
                      >
                        {SKILL_COLUMNS.map(skill => {
                          const playerScore = Number(
                            skills.find(current => current.column === skill.column)?.val ?? 50
                          )
                          const verifierScore = Number(item[skill.column] ?? playerScore)
                          const difference = verifierScore - playerScore

                          return (
                            <div
                              key={skill.column}
                              style={{
                                padding: '10px 11px',
                                borderRadius: 10,
                                background: C.soft,
                                border: `1px solid ${C.line}`,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 10,
                                  color: C.muted,
                                  marginBottom: 5,
                                }}
                              >
                                {skill.name}
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                  alignItems: 'center',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: C.text,
                                  }}
                                >
                                  You: <strong>{playerScore}</strong>
                                </span>

                                <span
                                  style={{
                                    fontSize: 11,
                                    color: accent,
                                  }}
                                >
                                  {roleLabel}: <strong>{verifierScore}</strong>
                                </span>
                              </div>

                              {difference !== 0 && (
                                <div
                                  style={{
                                    marginTop: 4,
                                    fontSize: 9,
                                    color: C.muted,
                                  }}
                                >
                                  Difference: {difference > 0 ? '+' : ''}{difference}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {item.feedback && (
                        <div
                          style={{
                            marginTop: 12,
                            padding: '10px 11px',
                            borderRadius: 10,
                            background: `color-mix(in srgb, ${accent} 7%, var(--card, #FFFFFF))`,
                            border: `1px solid ${C.line}`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: accent,
                              marginBottom: 5,
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                            }}
                          >
                            Feedback
                          </div>

                          <div
                            style={{
                              fontSize: 11,
                              lineHeight: 1.55,
                              color: C.text,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {item.feedback}
                          </div>
                        </div>
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
                marginTop: 18,
              }}
            >
              <button
                className={styles.btnPrimary}
                onClick={() => setShowVerificationDetailsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showSkillModal && (
        <div
          className={styles.modalOverlay}
          onClick={event =>
            event.target === event.currentTarget &&
            setShowSkillModal(false)
          }
        >
          <div
            className={styles.modal}
            style={{
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Update Skills</div>
              <button
                className={styles.modalClose}
                onClick={() => setShowSkillModal(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.tip}>
              Rate each skill honestly from 1–100. These scores are self-reported until another player or coach verifies them. Verification is optional, and updating your scores resets the current verification.
            </div>

            {skills.map((skill, index) => (
              <div key={skill.name} className={styles.formRow}>
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
                    {skill.name}
                  </label>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                    }}
                  >
                    {skillVals[index]}
                  </span>
                </div>

                <input
                  type="range"
                  min="1"
                  max="100"
                  value={skillVals[index]}
                  style={{
                    width: '100%',
                    accentColor: '#1A5FFF',
                  }}
                  onChange={event =>
                    setSkillVals(prev =>
                      prev.map((value, i) =>
                        i === index
                          ? Number(event.target.value)
                          : value
                      )
                    )
                  }
                />
              </div>
            ))}

            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
                marginTop: 8,
              }}
            >
              <button
                className={styles.btnOutline}
                onClick={() => setShowSkillModal(false)}
              >
                Cancel
              </button>

              <button
                className={styles.btnPrimary}
                onClick={handleUpdateSkills}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Skills'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
