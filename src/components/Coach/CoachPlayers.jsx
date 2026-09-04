import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'
import { Avatar, CoachPageHeader, LevelBadge } from './CoachShared'
import CoachNotificationBell from '../Notifications/CoachNotificationBell'

const DEFAULT_SKILL = 50
const REPORT_REASON_OPTIONS = [
  'Harassment or bullying',
  'Fake or misleading profile',
  'Inappropriate content',
  'Spam or scam',
  'Unsafe behaviour',
  'Impersonation',
  'Other',
]

function getLocalISODate(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getPlayerId(row) {
  return row?.user_id || row?.player_id || row?.id || null
}

function normalizeMatchResult(value) {
  return String(value || '').trim().toLowerCase()
}

function getNumericValue(value) {
  if (value === null || value === undefined || value === '') return null
  const direct = Number(value)
  if (Number.isFinite(direct)) return direct
  const match = String(value).match(/\d+(?:\.\d+)?/)
  if (!match) return null
  const parsed = Number(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

function getProfileAge(profile) {
  const saved = getNumericValue(profile?.age)
  if (saved !== null && saved >= 0) return saved

  const birthValue =
    profile?.date_of_birth || profile?.dateOfBirth || profile?.dob || null

  if (!birthValue) return null
  const birth = new Date(birthValue)
  if (Number.isNaN(birth.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const diff = today.getMonth() - birth.getMonth()

  if (
    diff < 0 ||
    (diff === 0 && today.getDate() < birth.getDate())
  ) {
    age -= 1
  }

  return age >= 0 ? age : null
}

function getProfileExperienceYears(profile) {
  const directFields = [
    profile?.experience_years,
    profile?.years_experience,
    profile?.playing_experience_years,
    profile?.playing_experience,
    profile?.experience,
  ]

  for (const value of directFields) {
    const parsed = getNumericValue(value)
    if (parsed !== null && parsed >= 0) return Math.round(parsed)
  }

  const playingSince =
    profile?.playing_since ||
    profile?.since ||
    profile?.started_playing_year ||
    profile?.start_year ||
    null

  if (playingSince) {
    const text = String(playingSince).trim()
    if (/^\d{4}$/.test(text)) {
      const startYear = Number(text)
      const currentYear = new Date().getFullYear()
      if (startYear >= 1900 && startYear <= currentYear) {
        return currentYear - startYear
      }
    }

    const startDate = new Date(playingSince)
    if (!Number.isNaN(startDate.getTime())) {
      const currentYear = new Date().getFullYear()
      const startYear = startDate.getFullYear()
      if (startYear >= 1900 && startYear <= currentYear) {
        return currentYear - startYear
      }
    }
  }

  const age = getProfileAge(profile)
  const startAge = getNumericValue(
    profile?.started_playing_age ??
      profile?.starting_age ??
      profile?.start_age
  )

  if (
    age !== null &&
    startAge !== null &&
    startAge >= 0 &&
    startAge <= age
  ) {
    return Math.max(0, Math.round(age - startAge))
  }

  return null
}

function buildPlayerMatchStats(matches = []) {
  const sorted = [...matches].sort((a, b) => {
    const ad = new Date(a.match_date || a.created_at || 0).getTime()
    const bd = new Date(b.match_date || b.created_at || 0).getTime()
    return bd - ad
  })

  const wins = sorted.filter(
    match => normalizeMatchResult(match.result) === 'win'
  ).length

  const totalMatches = sorted.length
  const winRate = totalMatches
    ? Math.round((wins / totalMatches) * 100)
    : 0

  let streakCount = 0
  let streakType = ''

  for (const match of sorted) {
    const result = normalizeMatchResult(match.result)
    if (result !== 'win' && result !== 'loss') continue

    const currentType = result === 'win' ? 'W' : 'L'

    if (!streakType) {
      streakType = currentType
      streakCount = 1
      continue
    }

    if (currentType === streakType) streakCount += 1
    else break
  }

  return {
    matches: totalMatches,
    winRate,
    streak: streakType ? `${streakType}${streakCount}` : 'W0',
  }
}


function formatPlayerMatchDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return date.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getPlayerMatchOpponent(match = {}) {
  const matchType = String(match.match_type || '').toLowerCase()

  if (matchType === 'singles') {
    return String(match.opponent_name || '').trim() || 'Unknown opponent'
  }

  const opponents = [
    match.opponent_name,
    match.opponent_name2,
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' & ')

  return opponents || 'Unknown opponent'
}

function getPlayerMatchScore(match = {}) {
  return [
    match.score1,
    match.score2,
    match.score3,
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(', ')
}

function getPlayerMatchResultStyle(result) {
  const normalized = normalizeMatchResult(result)

  if (normalized === 'win') {
    return {
      label: 'WIN',
      color: '#16A34A',
      background: '#F0FDF4',
      border: '#BBF7D0',
    }
  }

  if (normalized === 'loss') {
    return {
      label: 'LOSS',
      color: '#DC2626',
      background: '#FEF2F2',
      border: '#FECACA',
    }
  }

  return {
    label: String(result || '—').toUpperCase(),
    color: '#6B7280',
    background: '#F3F4F6',
    border: '#E5E7EB',
  }
}

function getRelationshipStatus(row) {
  const raw = String(
    row?.status ||
      row?.relationship_status ||
      row?.request_status ||
      ''
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')

  if (
    [
      'pending',
      'requested',
      'request_pending',
      'pending_request',
      'request_sent',
      'sent',
      'awaiting_response',
    ].includes(raw)
  ) return 'pending'

  if (['accepted', 'active', 'approved'].includes(raw)) return 'accepted'
  if (['declined', 'rejected'].includes(raw)) return 'declined'
  if (['removed', 'cancelled', 'canceled'].includes(raw)) return 'removed'
  return raw
}

function getRequestedBy(row) {
  return String(
    row?.requested_by ||
      row?.requester_role ||
      row?.created_by_role ||
      ''
  ).toLowerCase()
}

function normalizePlayer(
  profile,
  skillRow,
  relationship,
  source = 'registered',
  matchStats = null,
  latestMatches = []
) {
  const playerId = getPlayerId(profile)
  const status = getRelationshipStatus(relationship)
  const requestedBy = getRequestedBy(relationship)

  return {
    id: playerId,
    profileId: profile?.id || null,
    source,
    isRegistered: source === 'registered' && Boolean(profile?.user_id),
    name:
      profile?.display_name ||
      profile?.full_name ||
      profile?.name ||
      profile?.username ||
      'Unnamed player',
    club: profile?.club || profile?.external_club || 'No club',
    state: profile?.state || profile?.location || '',
    location: profile?.location || profile?.state || '',
    category:
      profile?.player_category ||
      profile?.category ||
      profile?.playing_category ||
      'Not specified',
    level:
      profile?.level ||
      profile?.playing_level ||
      profile?.skill_level ||
      profile?.category ||
      profile?.player_category ||
      'Beginner',
    style:
      profile?.playing_style ||
      profile?.play_style ||
      profile?.style ||
      'All-round',
    dominantHand:
      profile?.dominant_hand ||
      profile?.hand ||
      profile?.playing_hand ||
      'Not specified',
    age: profile?.age ?? null,
    height: profile?.height_cm ?? profile?.height ?? null,
    weight: profile?.weight_kg ?? profile?.weight ?? null,
    bio: profile?.bio || profile?.about || '',
    phone: profile?.phone || '',
    avatarUrl:
      profile?.avatar_url ||
      profile?.profile_picture ||
      profile?.photo_url ||
      null,
    matches: Number(
      matchStats?.matches ??
        profile?.matches ??
        profile?.total_matches ??
        profile?.match_count ??
        0
    ),
    winRate: Number(
      matchStats?.winRate ??
        profile?.win_rate ??
        profile?.winRate ??
        0
    ),
    streak:
      matchStats?.streak ||
      profile?.streak ||
      profile?.current_streak ||
      'W0',
    latestMatches: Array.isArray(latestMatches)
      ? latestMatches.slice(0, 3)
      : [],
    experienceYears: getProfileExperienceYears(profile),
    smash: Number(skillRow?.smash ?? DEFAULT_SKILL),
    defense: Number(skillRow?.defense ?? DEFAULT_SKILL),
    footwork: Number(skillRow?.footwork ?? DEFAULT_SKILL),
    dropShot: Number(
      skillRow?.drop_shot ??
        skillRow?.dropshot ??
        skillRow?.dropShot ??
        DEFAULT_SKILL
    ),
    netPlay: Number(
      skillRow?.net_play ??
        skillRow?.net ??
        skillRow?.netplay ??
        DEFAULT_SKILL
    ),
    serve: Number(skillRow?.serve ?? DEFAULT_SKILL),
    relationshipId: relationship?.id || null,
    relationshipStatus: status,
    relationshipMessage: relationship?.message || '',
    relationshipCreatedAt: relationship?.created_at || null,
    relationshipRespondedAt: relationship?.responded_at || null,
    requestedBy,
    assigned: status === 'accepted',
    pending: status === 'pending',
  }
}

function ProfileAvatar({ player, size = 56 }) {
  if (player?.avatarUrl) {
    return (
      <img
        src={player.avatarUrl}
        alt={`${player.name} profile`}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
          border: '2px solid var(--line, #EEF1F8)',
        }}
      />
    )
  }

  return <Avatar name={player?.name} size={size} />
}

function ProfileSkillBar({ label, value, dim = false }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0))

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '76px minmax(0, 1fr) 28px',
        alignItems: 'center',
        gap: 10,
        marginBottom: 9,
      }}
    >
      <div style={{ fontSize: 11, color: '#8892A4', textAlign: 'right' }}>
        {label}
      </div>
      <div
        style={{
          height: 7,
          borderRadius: 999,
          background: 'var(--line, #E8EDF6)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${safeValue}%`,
            height: '100%',
            borderRadius: 999,
            background: dim ? '#9CB9F2' : '#2F6BFF',
          }}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: '#0D1B3E',
          textAlign: 'right',
        }}
      >
        {safeValue}
      </div>
    </div>
  )
}

function ProfileInfoItem({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#8892A4', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
        {value || 'Not specified'}
      </div>
    </div>
  )
}

function formatRelationshipDate(value) {
  if (!value) return 'No date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No date'

  return date.toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function RequestHistoryBadge({ status }) {
  const settings = {
    accepted: {
      label: 'Accepted',
      background: '#ECFDF5',
      color: '#047857',
      border: '#A7F3D0',
    },
    declined: {
      label: 'Declined',
      background: '#FEF2F2',
      color: '#B91C1C',
      border: '#FECACA',
    },
    removed: {
      label: 'Cancelled / Removed',
      background: '#F3F4F6',
      color: '#4B5563',
      border: '#E5E7EB',
    },
  }

  const current = settings[status] || {
    label: status || 'Unknown',
    background: '#F3F4F6',
    color: '#4B5563',
    border: '#E5E7EB',
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 9px',
        borderRadius: 999,
        background: current.background,
        color: current.color,
        border: `1px solid ${current.border}`,
        fontSize: 10,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      {current.label}
    </span>
  )
}

function PlayerRadarChart({ player, size = 330 }) {
  const skills = [
    ['Smash', Number(player?.smash ?? 0)],
    ['Defense', Number(player?.defense ?? 0)],
    ['Footwork', Number(player?.footwork ?? 0)],
    ['Drop shot', Number(player?.dropShot ?? 0)],
    ['Net play', Number(player?.netPlay ?? 0)],
    ['Serve', Number(player?.serve ?? 0)],
  ]

  const center = size / 2
  const radius = size * 0.31
  const pointAt = (index, percentage) => {
    const angle = (Math.PI * 2 * index) / skills.length - Math.PI / 2
    const distance = radius * (percentage / 100)
    return {
      x: center + Math.cos(angle) * distance,
      y: center + Math.sin(angle) * distance,
    }
  }

  const dataPoints = skills
    .map(([, value], index) => {
      const point = pointAt(index, Math.max(0, Math.min(100, value)))
      return `${point.x},${point.y}`
    })
    .join(' ')

  return (
    <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size }}>
        {[1, 2, 3, 4, 5].map(level => {
          const points = skills
            .map((_, index) => {
              const point = pointAt(index, level * 20)
              return `${point.x},${point.y}`
            })
            .join(' ')

          return (
            <polygon
              key={level}
              points={points}
              fill="none"
              stroke="#DDE4F0"
              strokeWidth="1"
            />
          )
        })}

        {skills.map(([label], index) => {
          const point = pointAt(index, 100)
          return (
            <line
              key={label}
              x1={center}
              y1={center}
              x2={point.x}
              y2={point.y}
              stroke="#DDE4F0"
            />
          )
        })}

        <polygon
          points={dataPoints}
          fill="rgba(26,95,255,.2)"
          stroke="#1A5FFF"
          strokeWidth="2.5"
        />

        {skills.map(([label, value], index) => {
          const point = pointAt(index, Math.max(0, Math.min(100, value)))
          const text = pointAt(index, 121)

          return (
            <g key={label}>
              <circle cx={point.x} cy={point.y} r="4" fill="#1A5FFF" />
              <text
                x={text.x}
                y={text.y - 3}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#0D1B3E"
              >
                {label}
              </text>
              <text
                x={text.x}
                y={text.y + 12}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#1A5FFF"
              >
                {value}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ReportPlayerModal({ player, submitting, onClose, onSubmit }) {
  const [reason, setReason] = useState(REPORT_REASON_OPTIONS[0])
  const [details, setDetails] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    setReason(REPORT_REASON_OPTIONS[0])
    setDetails('')
    setFormError('')
  }, [player?.id])

  if (!player) return null

  const handleSubmit = async event => {
    event.preventDefault()

    if (!reason) return setFormError('Please select a report reason.')
    if (reason === 'Other' && !details.trim()) {
      return setFormError('Please explain the reason for this report.')
    }

    setFormError('')
    await onSubmit({ reason, details: details.trim() })
  }

  return (
    <div
      onMouseDown={event => {
        if (event.target === event.currentTarget && !submitting) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(13,27,62,.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className={styles.card}
        style={{ width: 'min(520px,100%)', padding: 22 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Report player</div>
            <div style={{ marginTop: 4, fontSize: 12, color: '#8892A4' }}>
              Report {player.name} to the ShuttleTrack administrator.
            </div>
          </div>

          <button
            type="button"
            className={styles.btnOutline}
            onClick={onClose}
            disabled={submitting}
          >
            ×
          </button>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Reason</label>
          <select
            className={styles.formSelect}
            value={reason}
            onChange={event => setReason(event.target.value)}
            disabled={submitting}
            style={{ width: '100%' }}
          >
            {REPORT_REASON_OPTIONS.map(option => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className={styles.formRow}>
          <label className={styles.formLabel}>Additional details</label>
          <textarea
            className={styles.formInput}
            rows={5}
            maxLength={1000}
            value={details}
            onChange={event => setDetails(event.target.value)}
            disabled={submitting}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        {formError && (
          <div style={{ color: '#B91C1C', marginBottom: 12 }}>{formError}</div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
          <button
            type="button"
            className={styles.btnOutline}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              border: 0,
              borderRadius: 10,
              padding: '9px 15px',
              background: '#DC2626',
              color: '#fff',
              fontWeight: 800,
            }}
          >
            {submitting ? 'Submitting...' : 'Submit report'}
          </button>
        </div>
      </form>
    </div>
  )
}

function PlayerMetricIcon({ type, color = 'currentColor', size = 18 }) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  }

  if (type === 'players') {
    return (
      <svg {...props}>
        <circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.8" />
        <circle cx="17" cy="9" r="2.5" stroke={color} strokeWidth="1.8" />
        <path
          d="M3.5 19c.6-3.2 2.5-5 5.5-5s4.9 1.8 5.5 5"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'requests') {
    return (
      <svg {...props}>
        <circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.8" />
        <path d="M17 8v6M14 11h6" stroke={color} strokeWidth="1.8" />
      </svg>
    )
  }

  if (type === 'available') {
    return (
      <svg {...props}>
        <circle cx="11" cy="11" r="7" stroke={color} strokeWidth="1.8" />
        <path d="m16.5 16.5 4 4" stroke={color} strokeWidth="1.8" />
      </svg>
    )
  }

  return (
    <svg {...props}>
      <path
        d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5M12 8v4l2.8 1.7"
        stroke={color}
        strokeWidth="1.8"
      />
    </svg>
  )
}

function PlayerStats({
  myPlayers = [],
  pendingPlayers = [],
  availablePlayers = [],
  requestHistory = [],
}) {
  const items = [
    ['My players', myPlayers.length, '#1A5FFF', '#E8EFFE', 'players'],
    ['Pending requests', pendingPlayers.length, '#00976C', '#DDF8EF', 'requests'],
    ['Available players', availablePlayers.length, '#F59E0B', '#FEF3C7', 'available'],
    ['Request history', requestHistory.length, '#7C3AED', '#EDE9FE', 'history'],
  ]

  return (
    <div className={styles.g4} style={{ marginBottom: 16 }}>
      {items.map(([label, value, color, background, icon]) => (
        <div key={label} className={styles.metric}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <PlayerMetricIcon type={icon} color={color} size={18} />
          </div>
          <div
            className={styles.metricVal}
            style={{ color, WebkitTextFillColor: color }}
          >
            {value}
          </div>
          <div className={styles.metricLbl}>{label}</div>
        </div>
      ))}
    </div>
  )
}

export default function CoachPlayers() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [players, setPlayers] = useState([])
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [profilePlayerId, setProfilePlayerId] = useState(null)

  const [playerSearch, setPlayerSearch] = useState('')
  const [showSearch, setShowSearch] = useState(true)
  const [showRequests, setShowRequests] = useState(true)
  const [showRequestHistory, setShowRequestHistory] = useState(false)

  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [reportPlayer, setReportPlayer] = useState(null)
  const [submittingReport, setSubmittingReport] = useState(false)

  const [showScanner, setShowScanner] = useState(false)
  const [scannerStarting, setScannerStarting] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [scanSuccessLabel, setScanSuccessLabel] = useState('')
  const [scanError, setScanError] = useState('')

  const qrScannerRef = useRef(null)
  const scanCloseTimerRef = useRef(null)

  const showLoader = useLoadingDelay(loading, 350)

  useEffect(() => {
    if (searchParams.get('find') === '1') {
      setShowSearch(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setPlayers([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [
        profilesResult,
        publicPlayersResult,
        skillsResult,
        relationshipsResult,
        matchesResult,
        publicMatchesResult,
        directoryAccountsResult,
      ] = await Promise.all([
        supabase.from('player_profiles').select('*').order('display_name', { ascending: true }),
        supabase.from('public_players').select('*').order('name', { ascending: true }),
        supabase.from('player_skill_ratings').select('*'),
        supabase
          .from('coach_player_relationships')
          .select('*')
          .eq('coach_user_id', user.id),
        supabase
          .from('player_matches')
          .select('*')
          .order('match_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('public_player_matches')
          .select(`
            *,
            public_players (
              id,
              name
            )
          `)
          .order('match_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.rpc('get_directory_visible_accounts'),
      ])

      const firstError = [
        profilesResult.error,
        publicPlayersResult.error,
        skillsResult.error,
        relationshipsResult.error,
        matchesResult.error,
        publicMatchesResult.error,
        directoryAccountsResult.error,
      ].find(Boolean)

      if (firstError) throw firstError

      const visibleDirectoryUserIds = new Set(
        (directoryAccountsResult.data || [])
          .map(row => row?.user_id && String(row.user_id))
          .filter(Boolean)
      )

      const relationshipMap = new Map(
        (relationshipsResult.data || []).map(row => [
          row.player_user_id,
          row,
        ])
      )

      const skillMap = new Map()
      ;(skillsResult.data || []).forEach(row => {
        ;[
          row.player_id,
          row.user_id,
          row.player_user_id,
          row.profile_id,
        ]
          .filter(Boolean)
          .forEach(key => skillMap.set(key, row))
      })

      const matchesByProfileId = new Map()
      ;(matchesResult.data || []).forEach(match => {
        const profileId = match.player_id || match.profile_id || null
        if (!profileId) return
        const current = matchesByProfileId.get(profileId) || []
        current.push(match)
        matchesByProfileId.set(profileId, current)
      })

      const matchStatsByProfileId = new Map()
      matchesByProfileId.forEach((list, profileId) => {
        matchStatsByProfileId.set(profileId, buildPlayerMatchStats(list))
      })

      const publicMatchesByPlayerId = new Map()
      const publicMatchesByPlayerName = new Map()

      ;(publicMatchesResult.data || []).forEach(match => {
        const joinedPlayer = Array.isArray(match.public_players)
          ? match.public_players[0]
          : match.public_players

        const linkedPlayerId =
          joinedPlayer?.id ||
          match.player_id ||
          match.public_player_id ||
          null

        const linkedPlayerName = String(
          joinedPlayer?.name ||
          match.player_name ||
          ''
        )
          .trim()
          .toLowerCase()

        const normalizedMatch = {
          ...match,
          player_id: linkedPlayerId,
          player_name:
            joinedPlayer?.name ||
            match.player_name ||
            '',
          match_type:
            match.match_type ||
            'Singles',
        }

        if (linkedPlayerId) {
          const idKey = String(linkedPlayerId)
          const currentById =
            publicMatchesByPlayerId.get(idKey) || []

          currentById.push(normalizedMatch)
          publicMatchesByPlayerId.set(idKey, currentById)
        }

        if (linkedPlayerName) {
          const currentByName =
            publicMatchesByPlayerName.get(linkedPlayerName) || []

          currentByName.push(normalizedMatch)
          publicMatchesByPlayerName.set(linkedPlayerName, currentByName)
        }
      })

      const sortMatchesNewestFirst = matches =>
        [...matches].sort((a, b) => {
          const aDate = new Date(
            a.match_date || a.created_at || 0
          ).getTime()

          const bDate = new Date(
            b.match_date || b.created_at || 0
          ).getTime()

          return bDate - aDate
        })

      publicMatchesByPlayerId.forEach((list, playerId) => {
        publicMatchesByPlayerId.set(
          playerId,
          sortMatchesNewestFirst(list)
        )
      })

      publicMatchesByPlayerName.forEach((list, playerName) => {
        publicMatchesByPlayerName.set(
          playerName,
          sortMatchesNewestFirst(list)
        )
      })

      const allRegisteredProfiles = profilesResult.data || []

      const allRegisteredNames = new Set(
        allRegisteredProfiles
          .map(profile =>
            String(profile.display_name || '').trim().toLowerCase()
          )
          .filter(Boolean)
      )

      const allRegisteredUserIds = new Set(
        allRegisteredProfiles
          .map(profile => (profile.user_id ? String(profile.user_id) : ''))
          .filter(Boolean)
      )

      const registeredPlayers = allRegisteredProfiles
        .filter(profile => {
          const playerId = getPlayerId(profile)
          if (!playerId || playerId === user.id) return false

          if (
            profile.user_id &&
            !visibleDirectoryUserIds.has(String(profile.user_id))
          ) {
            return false
          }

          const relationship = relationshipMap.get(playerId)
          const status = getRelationshipStatus(relationship)
          const connected = status === 'accepted' || status === 'pending'

          return profile.profile_public !== false || connected
        })
        .map(profile => {
          const playerId = getPlayerId(profile)
          const skillRow =
            skillMap.get(playerId) ||
            skillMap.get(profile.id) ||
            null

          const playerMatches =
            matchesByProfileId.get(profile.id) || []

          return normalizePlayer(
            profile,
            skillRow,
            relationshipMap.get(playerId),
            'registered',
            matchStatsByProfileId.get(profile.id) || null,
            playerMatches.slice(0, 3)
          )
        })

      const publicPlayers = (publicPlayersResult.data || [])
        .filter(row => {
          const linkedUserId = row.user_id || row.player_user_id || null
          const name = String(row?.name || '').trim().toLowerCase()
          if (!name) return false

          if (
            linkedUserId &&
            !visibleDirectoryUserIds.has(String(linkedUserId))
          ) {
            return false
          }

          if (
            linkedUserId &&
            allRegisteredUserIds.has(String(linkedUserId))
          ) {
            return false
          }

          if (allRegisteredNames.has(name)) return false
          return true
        })
        .map(row => {
          const linkedUserId = row.user_id || row.player_user_id || null
          const relationship = linkedUserId
            ? relationshipMap.get(linkedUserId)
            : null

          const publicSkillRow =
            skillMap.get(linkedUserId) ||
            skillMap.get(row.id) || {
              smash: row.smash,
              defense: row.defense,
              footwork: row.footwork,
              drop_shot: row.drop_shot,
              net_play: row.net_play,
              serve: row.serve,
            }

          const rowIdKey = String(row.id)
          const rowNameKey = String(row.name || '')
            .trim()
            .toLowerCase()

          const publicPlayerMatches =
            publicMatchesByPlayerId.get(rowIdKey) ||
            publicMatchesByPlayerName.get(rowNameKey) ||
            []

          const publicMatchStats =
            publicPlayerMatches.length > 0
              ? buildPlayerMatchStats(publicPlayerMatches)
              : null

          return normalizePlayer(
            {
              ...row,
              user_id: linkedUserId,
              display_name: row.name,
              player_category:
                row.player_category ||
                row.category ||
                row.level,
              playing_style:
                row.playing_style ||
                row.style ||
                'All-round',
            },
            publicSkillRow,
            relationship,
            linkedUserId ? 'registered' : 'public',
            publicMatchStats,
            publicPlayerMatches.slice(0, 3)
          )
        })
        .filter(player => player.id)

      setPlayers(
        [...registeredPlayers, ...publicPlayers].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      )
    } catch (loadError) {
      console.error('CoachPlayers load error:', loadError)
      setError(
        loadError.message ||
          'Unable to load players from the database.'
      )
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!user?.id) return undefined

    const channel = supabase
      .channel(`coach-players-updates-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_profiles' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coach_player_relationships',
          filter: `coach_user_id=eq.${user.id}`,
        },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_users' },
        () => loadData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadData, user?.id])

  const myPlayers = useMemo(
    () => players.filter(player => player.assigned),
    [players]
  )

  const pendingPlayers = useMemo(
    () =>
      players.filter(
        player => player.pending && player.requestedBy !== 'coach'
      ),
    [players]
  )

  const outgoingRequests = useMemo(
    () =>
      players.filter(
        player => player.pending && player.requestedBy === 'coach'
      ),
    [players]
  )

  const requestHistory = useMemo(
    () =>
      players
        .filter(player =>
          ['accepted', 'declined', 'removed'].includes(
            player.relationshipStatus
          )
        )
        .sort((a, b) => {
          const ad = new Date(
            a.relationshipRespondedAt ||
              a.relationshipCreatedAt ||
              0
          ).getTime()

          const bd = new Date(
            b.relationshipRespondedAt ||
              b.relationshipCreatedAt ||
              0
          ).getTime()

          return bd - ad
        }),
    [players]
  )

  const selectedPlayer = useMemo(
    () =>
      myPlayers.find(player => player.id === selectedPlayerId) || null,
    [myPlayers, selectedPlayerId]
  )

  const profilePlayer = useMemo(
    () =>
      players.find(player => player.id === profilePlayerId) || null,
    [players, profilePlayerId]
  )

  const availablePlayers = useMemo(
    () =>
      players.filter(player => !player.assigned && !player.pending),
    [players]
  )

  const searchResults = useMemo(() => {
    const keyword = playerSearch.trim().toLowerCase()
    if (!keyword) return availablePlayers

    return availablePlayers.filter(player =>
      [
        player.name,
        player.club,
        player.state,
        player.category,
        player.level,
      ].some(value =>
        String(value || '')
          .toLowerCase()
          .includes(keyword)
      )
    )
  }, [availablePlayers, playerSearch])

  const updatePlayerRelationship = (playerId, changes) => {
    setPlayers(current =>
      current.map(player =>
        player.id === playerId
          ? { ...player, ...changes }
          : player
      )
    )
  }

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleAddPlayer = async player => {
    if (!user?.id || !player?.id) return

    if (!player.isRegistered) {
      setError(
        'This is a public/demo player profile and is not linked to a registered account.'
      )
      return
    }

    clearMessages()
    setSavingId(player.id)

    try {
      const { data, error: relationshipError } = await supabase
        .from('coach_player_relationships')
        .upsert(
          {
            player_user_id: player.id,
            coach_user_id: user.id,
            status: 'pending',
            requested_by: 'coach',
            message: null,
            responded_at: null,
          },
          { onConflict: 'player_user_id,coach_user_id' }
        )
        .select()
        .single()

      if (relationshipError) throw relationshipError

      const coachName =
        user?.user_metadata?.display_name ||
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email ||
        'A coach'

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: player.id,
          title: 'New coaching request',
          message: `${coachName} sent you a coaching request.`,
          type: 'info',
          source_type: 'coach_request_received',
          action_url: '/players?tab=coach',
          is_read: false,
        })

      if (notificationError) {
        console.error('Coach request notification error:', notificationError)
      }

      updatePlayerRelationship(player.id, {
        relationshipId: data.id,
        relationshipStatus: 'pending',
        requestedBy: 'coach',
        assigned: false,
        pending: true,
      })

      setPlayerSearch('')
      setSuccess(
        notificationError
          ? `The coaching request was sent to ${player.name}, but the notification could not be created.`
          : `A coaching request and notification were sent to ${player.name}. They must accept it before appearing in My Players.`
      )
    } catch (addError) {
      console.error('Add player error:', addError)
      setError(addError.message || 'Unable to add player.')
    } finally {
      setSavingId(null)
    }
  }

  const handleAcceptRequest = async player => {
    clearMessages()
    setSavingId(player.id)

    try {
      const { data, error: acceptError } = await supabase
        .from('coach_player_relationships')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
        })
        .eq('coach_user_id', user.id)
        .eq('player_user_id', player.id)
        .select()
        .single()

      if (acceptError) throw acceptError

      updatePlayerRelationship(player.id, {
        relationshipId: data.id,
        relationshipStatus: 'accepted',
        assigned: true,
        pending: false,
      })

      setSuccess(`${player.name}'s request was accepted.`)
    } catch (acceptError) {
      console.error('Accept request error:', acceptError)
      setError(acceptError.message || 'Unable to accept the request.')
    } finally {
      setSavingId(null)
    }
  }

  const handleDeclineRequest = async player => {
    clearMessages()
    setSavingId(player.id)

    try {
      const { error: declineError } = await supabase
        .from('coach_player_relationships')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString(),
        })
        .eq('coach_user_id', user.id)
        .eq('player_user_id', player.id)

      if (declineError) throw declineError

      updatePlayerRelationship(player.id, {
        relationshipStatus: 'declined',
        assigned: false,
        pending: false,
      })

      setSuccess(`${player.name}'s request was declined.`)
    } catch (declineError) {
      console.error('Decline request error:', declineError)
      setError(declineError.message || 'Unable to decline the request.')
    } finally {
      setSavingId(null)
    }
  }

  const handleCancelOutgoingRequest = async player => {
    if (!user?.id || !player?.id) return

    if (
      !window.confirm(
        `Cancel the coaching request sent to ${player.name}?`
      )
    ) {
      return
    }

    clearMessages()
    setSavingId(player.id)

    try {
      const { error: cancelError } = await supabase
        .from('coach_player_relationships')
        .update({
          status: 'cancelled',
          responded_at: new Date().toISOString(),
        })
        .eq('coach_user_id', user.id)
        .eq('player_user_id', player.id)
        .eq('status', 'pending')
        .eq('requested_by', 'coach')

      if (cancelError) throw cancelError

      updatePlayerRelationship(player.id, {
        relationshipStatus: 'removed',
        requestedBy: 'coach',
        assigned: false,
        pending: false,
      })

      if (profilePlayerId === player.id) {
        setProfilePlayerId(null)
      }

      setSuccess(
        `The coaching request to ${player.name} was cancelled.`
      )
    } catch (cancelError) {
      console.error('Cancel outgoing request error:', cancelError)
      setError(
        cancelError.message ||
          'Unable to cancel the coaching request.'
      )
    } finally {
      setSavingId(null)
    }
  }

  const handleRemove = async player => {
    if (
      !window.confirm(
        `Remove ${player.name} from My Players? Their future coach-created sessions will also be removed. Completed training history will be kept.`
      )
    ) {
      return
    }

    clearMessages()
    setSavingId(player.id)

    try {
      const today = getLocalISODate()

      const { data: futureSessions, error: futureSessionsError } =
        await supabase
          .from('coach_training_sessions')
          .select('id, session_date')
          .eq('coach_user_id', user.id)
          .gte('session_date', today)

      if (futureSessionsError) throw futureSessionsError

      const ids = (futureSessions || []).map(row => row.id).filter(Boolean)

      if (ids.length) {
        const { error: scheduleDeleteError } = await supabase
          .from('player_schedule')
          .delete()
          .eq('user_id', player.id)
          .in('coach_session_id', ids)

        if (scheduleDeleteError) throw scheduleDeleteError

        const { error: assignmentDeleteError } = await supabase
          .from('coach_training_session_players')
          .delete()
          .eq('player_user_id', player.id)
          .in('session_id', ids)

        if (assignmentDeleteError) throw assignmentDeleteError
      }

      const { error: removeError } = await supabase
        .from('coach_player_relationships')
        .update({
          status: 'removed',
          responded_at: new Date().toISOString(),
        })
        .eq('coach_user_id', user.id)
        .eq('player_user_id', player.id)

      if (removeError) throw removeError

      updatePlayerRelationship(player.id, {
        relationshipStatus: 'removed',
        assigned: false,
        pending: false,
      })

      if (selectedPlayerId === player.id) setSelectedPlayerId(null)
      if (profilePlayerId === player.id) setProfilePlayerId(null)

      setSuccess(`${player.name} was removed from My Players.`)
    } catch (removeError) {
      console.error('Remove player error:', removeError)
      setError(
        removeError.message ||
          'Unable to remove the player and clean up future sessions.'
      )
    } finally {
      setSavingId(null)
    }
  }

  const openReportPlayer = player => {
    if (!player?.isRegistered || !player?.id) {
      setError(
        'Only registered player accounts can be reported from this page.'
      )
      return
    }

    clearMessages()
    setReportPlayer(player)
  }

  const submitPlayerReport = async ({ reason, details }) => {
    if (!user?.id || !reportPlayer?.id) return

    setSubmittingReport(true)
    setError('')

    try {
      const { error: reportError } = await supabase
        .from('user_reports')
        .insert({
          reporter_user_id: user.id,
          reported_user_id: reportPlayer.id,
          category: 'player',
          subject: reportPlayer.name,
          description: [
            `Reason: ${reason}`,
            `Details: ${details || 'No additional details provided.'}`,
          ].join('\n'),
          status: 'pending',
        })

      if (reportError) throw reportError

      const name = reportPlayer.name
      setReportPlayer(null)
      setSuccess(
        `Your report about ${name} was submitted for admin review.`
      )
    } catch (reportError) {
      console.error('Coach report player error:', reportError)
      setError(
        reportError.message ||
          'Unable to submit the player report.'
      )
    } finally {
      setSubmittingReport(false)
    }
  }

  const stopQrScanner = useCallback(async () => {
    if (scanCloseTimerRef.current) {
      window.clearTimeout(scanCloseTimerRef.current)
      scanCloseTimerRef.current = null
    }

    const scanner = qrScannerRef.current
    qrScannerRef.current = null

    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop()
      } catch (scannerStopError) {
        console.warn('Unable to stop coach QR scanner:', scannerStopError)
      }

      try {
        await scanner.clear()
      } catch (scannerClearError) {
        console.warn('Unable to clear coach QR scanner:', scannerClearError)
      }
    }

    setCameraActive(false)
    setScannerStarting(false)
  }, [])

  const closeScanner = useCallback(async () => {
    await stopQrScanner()
    setShowScanner(false)
    setScanSuccess(false)
    setScanSuccessLabel('')
    setScanError('')
  }, [stopQrScanner])

  const processScannedValue = useCallback(
    async decodedText => {
      if (scanSuccess) return

      const rawValue = String(decodedText || '').trim()
      let verificationToken = ''

      if (rawValue.startsWith('SHUTTLETRACK_VERIFY_SKILL:')) {
        verificationToken = rawValue
          .slice('SHUTTLETRACK_VERIFY_SKILL:'.length)
          .trim()
      } else if (rawValue.includes('/verify-skill/')) {
        try {
          const parsedUrl = rawValue.startsWith('/')
            ? new URL(rawValue, window.location.origin)
            : new URL(rawValue)

          const parts = parsedUrl.pathname.split('/').filter(Boolean)
          const index = parts.findIndex(part => part === 'verify-skill')

          if (index >= 0) {
            verificationToken = parts[index + 1] || ''
          }
        } catch {
          const marker = '/verify-skill/'
          const index = rawValue.indexOf(marker)

          if (index >= 0) {
            verificationToken = rawValue
              .slice(index + marker.length)
              .split(/[?#/]/)[0]
              .trim()
          }
        }
      }

      if (verificationToken) {
        setScanError('')
        setScanSuccess(true)
        setScanSuccessLabel('Verification QR found')

        if (qrScannerRef.current?.isScanning) {
          try {
            await qrScannerRef.current.pause(true)
          } catch {}
        }

        scanCloseTimerRef.current = window.setTimeout(async () => {
          await stopQrScanner()
          setShowScanner(false)
          setScanSuccess(false)
          setScanSuccessLabel('')
          setScanError('')
          navigate(
            `/verify-skill/${encodeURIComponent(verificationToken)}`
          )
        }, 700)

        return
      }

      let scannedUserId = ''

      if (rawValue.startsWith('SHUTTLETRACK_PLAYER:')) {
        scannedUserId = rawValue
          .slice('SHUTTLETRACK_PLAYER:'.length)
          .trim()
      } else {
        try {
          const scannedUrl = rawValue.startsWith('/')
            ? new URL(rawValue, window.location.origin)
            : new URL(rawValue)

          const parts = scannedUrl.pathname.split('/').filter(Boolean)
          const index = parts.findIndex(
            part =>
              part === 'player' ||
              part === 'p' ||
              part === 'scan'
          )

          scannedUserId =
            index >= 0
              ? parts[index + 1] || parts[parts.length - 1] || ''
              : ''
        } catch {
          scannedUserId = ''
        }
      }

      if (!scannedUserId) {
        setScanError(
          'This is not a valid ShuttleTrack QR code. Scan a player QR or skill verification QR.'
        )
        return
      }

      const scannedPlayer = players.find(
        player =>
          String(player.id || '') === String(scannedUserId) ||
          String(player.profileId || '') === String(scannedUserId)
      )

      if (!scannedPlayer) {
        setScanError(
          'Player profile not found. The profile may be private, hidden, or unavailable.'
        )
        return
      }

      setScanError('')
      setScanSuccess(true)
      setScanSuccessLabel('Player found')
      setProfilePlayerId(scannedPlayer.id)

      if (qrScannerRef.current?.isScanning) {
        try {
          await qrScannerRef.current.pause(true)
        } catch {}
      }

      scanCloseTimerRef.current = window.setTimeout(
        async () => closeScanner(),
        900
      )
    },
    [
      closeScanner,
      navigate,
      players,
      scanSuccess,
      stopQrScanner,
    ]
  )

  const startQrScanner = useCallback(async () => {
    if (scannerStarting || cameraActive || scanSuccess) return

    setScanError('')

    try {
      await stopQrScanner()
      setScannerStarting(true)

      const reader = document.getElementById(
        'coach-shuttletrack-qr-reader'
      )

      if (!reader) {
        throw new Error(
          'Scanner area is not ready. Please reopen the scanner.'
        )
      }

      const scanner = new Html5Qrcode(
        'coach-shuttletrack-qr-reader',
        { verbose: false }
      )

      qrScannerRef.current = scanner

      let cameraConfig = { facingMode: 'environment' }

      try {
        const cameras = await Html5Qrcode.getCameras()

        if (cameras.length > 0) {
          const backCamera = cameras.find(camera =>
            /back|rear|environment/i.test(camera.label || '')
          )
          cameraConfig = backCamera?.id || cameras[0].id
        }
      } catch {}

      await scanner.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.floor(Math.min(width, height) * 0.72)
            return { width: size, height: size }
          },
          aspectRatio: 1,
        },
        processScannedValue,
        () => {}
      )

      setCameraActive(true)
    } catch (scannerError) {
      console.error('Failed to start coach QR scanner:', scannerError)
      setScanError(
        scannerError?.message ||
          'Camera could not start. Allow camera permission and try again.'
      )
      await stopQrScanner()
    } finally {
      setScannerStarting(false)
    }
  }, [
    cameraActive,
    processScannedValue,
    scanSuccess,
    scannerStarting,
    stopQrScanner,
  ])

  useEffect(() => {
    if (!showScanner) return undefined

    const timer = window.setTimeout(() => startQrScanner(), 150)
    return () => window.clearTimeout(timer)
  }, [showScanner, startQrScanner])

  useEffect(() => {
    return () => {
      if (scanCloseTimerRef.current) {
        window.clearTimeout(scanCloseTimerRef.current)
      }

      const scanner = qrScannerRef.current
      qrScannerRef.current = null

      if (scanner?.isScanning) {
        scanner.stop().catch(() => {})
      }
    }
  }, [])

  return (
    <div className={styles.coachReadablePage}>
      <CoachPageHeader
        title="My Players"
        subtitle="Manage your players and write progress notes"
        showFindPlayer={false}
        rightAction={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <button
              type="button"
              className={styles.btnOutline}
              onClick={() => {
                setScanError('')
                setScanSuccess(false)
                setScanSuccessLabel('')
                setShowScanner(true)
              }}
              style={{ whiteSpace: 'nowrap' }}
            >
              Scan QR
            </button>

            <CoachNotificationBell
              supabase={supabase}
              mode="players"
              title="Player notifications"
            />
          </div>
        }
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <button
          type="button"
          className={
            pendingPlayers.length > 0
              ? styles.btnPrimary
              : styles.btnOutline
          }
          onClick={() => {
            setShowRequests(current => !current)
            setShowRequestHistory(false)
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            fontSize: 12,
          }}
        >
          Requests
          <span
            style={{
              minWidth: 20,
              height: 20,
              padding: '0 6px',
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background:
                pendingPlayers.length > 0
                  ? 'rgba(255,255,255,0.22)'
                  : '#EEF1F8',
              color:
                pendingPlayers.length > 0
                  ? '#FFFFFF'
                  : '#0D1B3E',
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {pendingPlayers.length}
          </span>
        </button>

        <button
          type="button"
          className={
            showRequestHistory
              ? styles.btnPrimary
              : styles.btnOutline
          }
          onClick={() => {
            setShowRequestHistory(current => !current)
            setShowRequests(false)
          }}
          style={{ fontSize: 12 }}
        >
          Request history
        </button>
      </div>

      <PlayerStats
        myPlayers={myPlayers}
        pendingPlayers={pendingPlayers}
        availablePlayers={availablePlayers}
        requestHistory={requestHistory}
      />

      {error && (
        <div
          className={styles.card}
          style={{
            marginBottom: 12,
            padding: '12px 14px',
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
            marginBottom: 12,
            padding: '12px 14px',
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
            <Loader text="Loading players..." />
          </div>
        ) : null
      ) : (
        <>
          {showRequests && pendingPlayers.length > 0 && (
            <div className={styles.card} style={{ marginBottom: 14 }}>
              <div className={styles.cardTitle} style={{ marginBottom: 12 }}>
                Player requests ({pendingPlayers.length})
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {pendingPlayers.map(player => (
                  <div
                    key={player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      background: '#F7F9FF',
                      borderRadius: 10,
                    }}
                  >
                    <Avatar name={player.name} size={38} />

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#0D1B3E',
                        }}
                      >
                        {player.name}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: '#8892A4',
                          marginTop: 2,
                        }}
                      >
                        {player.category} • {player.state || 'No state'}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={() => setProfilePlayerId(player.id)}
                      style={{ fontSize: 11 }}
                    >
                      View profile
                    </button>

                    <button
                      type="button"
                      className={styles.btnOutline}
                      disabled={savingId === player.id}
                      onClick={() => handleDeclineRequest(player)}
                      style={{ fontSize: 11 }}
                    >
                      Decline
                    </button>

                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={savingId === player.id}
                      onClick={() => handleAcceptRequest(player)}
                      style={{ fontSize: 11 }}
                    >
                      {savingId === player.id ? 'Saving...' : 'Accept'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showRequests && pendingPlayers.length === 0 && (
            <div
              className={styles.card}
              style={{
                marginBottom: 14,
                padding: 18,
                textAlign: 'center',
                color: '#8892A4',
              }}
            >
              No incoming player requests.
            </div>
          )}

          {showRequests && outgoingRequests.length > 0 && (
            <div className={styles.card} style={{ marginBottom: 14 }}>
              <div className={styles.cardTitle} style={{ marginBottom: 12 }}>
                Requests sent ({outgoingRequests.length})
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {outgoingRequests.map(player => (
                  <div
                    key={player.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      background: '#F7F9FF',
                      borderRadius: 10,
                    }}
                  >
                    <Avatar name={player.name} size={38} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#0D1B3E',
                        }}
                      >
                        {player.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#8892A4',
                          marginTop: 2,
                        }}
                      >
                        Awaiting player response
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={() => setProfilePlayerId(player.id)}
                      style={{ fontSize: 11 }}
                    >
                      View profile
                    </button>

                    <button
                      type="button"
                      className={styles.btnOutline}
                      disabled={savingId === player.id}
                      onClick={() => handleCancelOutgoingRequest(player)}
                      style={{
                        fontSize: 11,
                        color: '#DC2626',
                        borderColor: '#FECACA',
                        background: '#FEF2F2',
                      }}
                    >
                      {savingId === player.id
                        ? 'Cancelling...'
                        : 'Cancel request'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showRequestHistory && (
            <div className={styles.card} style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div className={styles.cardTitle}>Request history</div>

                <button
                  type="button"
                  className={styles.btnOutline}
                  style={{ fontSize: 11 }}
                  onClick={() => setShowRequestHistory(false)}
                >
                  Close
                </button>
              </div>

              {requestHistory.length === 0 ? (
                <div
                  style={{
                    padding: '18px 0',
                    textAlign: 'center',
                    color: '#8892A4',
                    fontSize: 13,
                  }}
                >
                  No previous requests yet.
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {requestHistory.map(player => (
                    <div
                      key={`${player.relationshipId}-${player.id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: 12,
                        background: '#F7F9FF',
                        borderRadius: 10,
                      }}
                    >
                      <Avatar name={player.name} size={38} />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            flexWrap: 'wrap',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: '#0D1B3E',
                            }}
                          >
                            {player.name}
                          </div>

                          <RequestHistoryBadge
                            status={player.relationshipStatus}
                          />
                        </div>

                        <div
                          style={{
                            fontSize: 11,
                            color: '#8892A4',
                            marginTop: 3,
                          }}
                        >
                          {player.category} • {player.state || 'No state'}
                        </div>

                        {player.relationshipMessage && (
                          <div
                            style={{
                              fontSize: 12,
                              color: '#0D1B3E',
                              marginTop: 6,
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            “{player.relationshipMessage}”
                          </div>
                        )}

                        <div
                          style={{
                            fontSize: 10,
                            color: '#8892A4',
                            marginTop: 5,
                          }}
                        >
                          Requested:{' '}
                          {formatRelationshipDate(
                            player.relationshipCreatedAt
                          )}
                          {player.relationshipRespondedAt && (
                            <>
                              {' '}• Responded:{' '}
                              {formatRelationshipDate(
                                player.relationshipRespondedAt
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        className={styles.btnOutline}
                        style={{ fontSize: 11 }}
                        onClick={() => setProfilePlayerId(player.id)}
                      >
                        View profile
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.g2}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div className={styles.card} style={{ padding: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#0D1B3E',
                    }}
                  >
                    Available players ({availablePlayers.length})
                  </div>

                  <button
                    type="button"
                    className={styles.btnOutline}
                    style={{ fontSize: 11 }}
                    onClick={() => setShowSearch(current => !current)}
                  >
                    {showSearch ? 'Hide list' : 'Show list'}
                  </button>
                </div>

                <input
                  className={styles.formInput}
                  placeholder="Search by name, club, state or category..."
                  value={playerSearch}
                  onChange={event =>
                    setPlayerSearch(event.target.value)
                  }
                />

                {showSearch && (
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      maxHeight: 430,
                      overflowY: 'auto',
                      paddingRight: 4,
                    }}
                  >
                    {searchResults.length === 0 && (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#8892A4',
                          padding: '8px 0',
                        }}
                      >
                        No available players found.
                      </div>
                    )}

                    {searchResults.map(player => (
                      <div
                        key={player.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setProfilePlayerId(player.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          background: 'var(--soft, #F7F9FF)',
                          borderRadius: 10,
                          cursor: 'pointer',
                        }}
                      >
                        <Avatar name={player.name} size={32} />

                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: '#0D1B3E',
                            }}
                          >
                            {player.name}
                          </div>

                          <div
                            style={{
                              fontSize: 11,
                              color: '#8892A4',
                            }}
                          >
                            {player.club} • {player.state || 'No state'}
                          </div>
                        </div>

                        <LevelBadge level={player.level} />

                        {player.isRegistered ? (
                          <button
                            type="button"
                            className={styles.btnPrimary}
                            disabled={savingId === player.id}
                            onClick={event => {
                              event.stopPropagation()
                              handleAddPlayer(player)
                            }}
                            style={{
                              fontSize: 11,
                              padding: '4px 12px',
                            }}
                          >
                            {savingId === player.id
                              ? 'Sending...'
                              : '+ Request'}
                          </button>
                        ) : (
                          <span
                            style={{
                              fontSize: 11,
                              color: '#8892A4',
                              fontWeight: 600,
                            }}
                          >
                            View only
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {showSearch && playerSearch && (
                  <button
                    type="button"
                    className={styles.btnOutline}
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      width: '100%',
                    }}
                    onClick={() => setPlayerSearch('')}
                  >
                    Clear search
                  </button>
                )}
              </div>

              {myPlayers.length === 0 && (
                <div
                  className={styles.card}
                  style={{
                    textAlign: 'center',
                    padding: 40,
                    color: '#8892A4',
                  }}
                >
                  No players assigned yet. Accept a request or add one
                  from Available Players.
                </div>
              )}

              {myPlayers.map(player => (
                <div
                  key={player.id}
                  className={styles.card}
                  onClick={() =>
                    setSelectedPlayerId(current =>
                      current === player.id ? null : player.id
                    )
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 14,
                    cursor: 'pointer',
                    background:
                      selectedPlayerId === player.id
                        ? 'rgba(26,95,255,.14)'
                        : undefined,
                    border:
                      selectedPlayerId === player.id
                        ? '2px solid #1A5FFF'
                        : undefined,
                  }}
                >
                  <Avatar name={player.name} />

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {player.name}
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        color: '#8892A4',
                        marginTop: 2,
                      }}
                    >
                      {player.club}
                    </div>

                    <div
                      style={{
                        marginTop: 5,
                        display: 'flex',
                        gap: 4,
                      }}
                    >
                      <LevelBadge level={player.level} />
                      <span
                        style={{
                          fontSize: 10,
                          background: 'rgba(136,146,164,.14)',
                          padding: '2px 8px',
                          borderRadius: 20,
                          fontWeight: 600,
                        }}
                      >
                        {player.style}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.btnOutline}
                    onClick={event => {
                      event.stopPropagation()
                      setProfilePlayerId(player.id)
                    }}
                    style={{ fontSize: 11 }}
                  >
                    Profile
                  </button>

                  <button
                    type="button"
                    disabled={savingId === player.id}
                    onClick={event => {
                      event.stopPropagation()
                      handleRemove(player)
                    }}
                    style={{
                      background: '#FEF2F2',
                      border: '1px solid #FEE2E2',
                      color: '#DC2626',
                      borderRadius: 8,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div>
              {!selectedPlayer ? (
                <div
                  className={styles.card}
                  style={{
                    height: 200,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#8892A4',
                  }}
                >
                  Select a player
                </div>
              ) : (
                <div className={styles.card}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <Avatar name={selectedPlayer.name} size={44} />

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 800,
                          color: '#0D1B3E',
                        }}
                      >
                        {selectedPlayer.name}
                      </div>

                      <div style={{ fontSize: 12, color: '#8892A4' }}>
                        {selectedPlayer.club}
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={() =>
                        setProfilePlayerId(selectedPlayer.id)
                      }
                    >
                      View profile
                    </button>
                  </div>

                  <div className={styles.cardTitle}>Skill profile</div>
                  <PlayerRadarChart player={selectedPlayer} />
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {profilePlayer && (
        <div
          onClick={() => setProfilePlayerId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(13,27,62,.52)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            className={styles.card}
            onClick={event => event.stopPropagation()}
            style={{
              width: 'min(820px,100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 0,
            }}
          >
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '20px 22px 16px',
                borderBottom: '1px solid #EEF1F8',
                background: '#fff',
              }}
            >
              <ProfileAvatar player={profilePlayer} size={58} />

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 19,
                    fontWeight: 800,
                    color: '#0D1B3E',
                  }}
                >
                  {profilePlayer.name}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: '#8892A4',
                    marginTop: 3,
                  }}
                >
                  {profilePlayer.club} • {profilePlayer.state || 'No state'}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 5,
                    flexWrap: 'wrap',
                    marginTop: 7,
                  }}
                >
                  <LevelBadge level={profilePlayer.level} />
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontWeight: 700,
                      background: '#F3F4F6',
                      color: '#6B7280',
                    }}
                  >
                    {profilePlayer.style}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => setProfilePlayerId(null)}
              >
                Close
              </button>
            </div>

            <div
              style={{
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div className={styles.card} style={{ padding: 18 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                    gap: 10,
                    marginBottom: 18,
                  }}
                >
                  {[
                    ['Matches', profilePlayer.matches, '#0D1B3E'],
                    ['Win rate', `${profilePlayer.winRate}%`, '#1A5FFF'],
                    [
                      'Streak',
                      profilePlayer.streak,
                      String(profilePlayer.streak).startsWith('W')
                        ? '#00A878'
                        : '#DC2626',
                    ],
                  ].map(([label, value, color]) => (
                    <div
                      key={label}
                      style={{
                        padding: '11px 10px',
                        borderRadius: 11,
                        textAlign: 'center',
                        background: '#F6F8FF',
                      }}
                    >
                      <div style={{ fontSize: 10, color: '#8892A4' }}>
                        {label}
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 17,
                          fontWeight: 800,
                          color,
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    borderTop: '1px solid #EEF1F8',
                    paddingTop: 16,
                    marginBottom: 18,
                  }}
                >
                  <div className={styles.cardTitle}>Latest matches</div>

                  {profilePlayer.latestMatches?.length > 0 ? (
                    <div
                      style={{
                        marginTop: 10,
                        borderRadius: 12,
                        background: '#F6F8FF',
                        border: '1px solid #EEF1F8',
                        overflow: 'hidden',
                      }}
                    >
                      {profilePlayer.latestMatches.map((match, index) => {
                        const resultStyle =
                          getPlayerMatchResultStyle(match.result)
                        const opponent =
                          getPlayerMatchOpponent(match)
                        const score =
                          getPlayerMatchScore(match)

                        return (
                          <div
                            key={match.id || index}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '11px 13px',
                              borderBottom:
                                index !==
                                profilePlayer.latestMatches.length - 1
                                  ? '1px solid #EEF1F8'
                                  : 'none',
                            }}
                          >
                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: '#0D1B3E',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                vs {opponent}
                              </div>

                              <div
                                style={{
                                  marginTop: 3,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  flexWrap: 'wrap',
                                  fontSize: 10,
                                  color: '#8892A4',
                                }}
                              >
                                {match.match_type && (
                                  <>
                                    <span>{match.match_type}</span>
                                    <span>•</span>
                                  </>
                                )}
                                <span>
                                  {formatPlayerMatchDate(
                                    match.match_date
                                  )}
                                </span>
                              </div>
                            </div>

                            <div
                              style={{
                                flexShrink: 0,
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#0D1B3E',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {score || '—'}
                            </div>

                            <span
                              style={{
                                flexShrink: 0,
                                minWidth: 50,
                                textAlign: 'center',
                                padding: '4px 8px',
                                borderRadius: 999,
                                background: resultStyle.background,
                                border: `1px solid ${resultStyle.border}`,
                                color: resultStyle.color,
                                fontSize: 9,
                                fontWeight: 800,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {resultStyle.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 16,
                        borderRadius: 12,
                        background: '#F6F8FF',
                        border: '1px solid #EEF1F8',
                        color: '#8892A4',
                        fontSize: 12,
                        textAlign: 'center',
                      }}
                    >
                      No match records yet.
                    </div>
                  )}
                </div>

                <div
                  style={{
                    borderTop: '1px solid #EEF1F8',
                    paddingTop: 16,
                  }}
                >
                  <div className={styles.cardTitle}>Skill profile</div>

                  <div style={{ marginTop: 12 }}>
                    <ProfileSkillBar
                      label="Smash"
                      value={profilePlayer.smash}
                    />
                    <ProfileSkillBar
                      label="Footwork"
                      value={profilePlayer.footwork}
                    />
                    <ProfileSkillBar
                      label="Defense"
                      value={profilePlayer.defense}
                    />
                    <ProfileSkillBar
                      label="Net play"
                      value={profilePlayer.netPlay}
                    />
                    <ProfileSkillBar
                      label="Drop shot"
                      value={profilePlayer.dropShot}
                      dim
                    />
                    <ProfileSkillBar
                      label="Serve"
                      value={profilePlayer.serve}
                      dim
                    />
                  </div>
                </div>
              </div>

              <div className={styles.card} style={{ padding: 18 }}>
                <div className={styles.cardTitle}>About player</div>

                {profilePlayer.bio && (
                  <div
                    style={{
                      marginTop: 10,
                      marginBottom: 18,
                      fontSize: 13,
                      lineHeight: 1.7,
                      color: '#0D1B3E',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {profilePlayer.bio}
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
                    gap: '14px 28px',
                    marginTop: profilePlayer.bio ? 0 : 12,
                  }}
                >
                  <ProfileInfoItem
                    label="Category"
                    value={profilePlayer.category}
                  />
                  <ProfileInfoItem
                    label="Level"
                    value={profilePlayer.level}
                  />
                  <ProfileInfoItem
                    label="Playing style"
                    value={profilePlayer.style}
                  />
                  <ProfileInfoItem
                    label="Dominant hand"
                    value={profilePlayer.dominantHand}
                  />
                  <ProfileInfoItem
                    label="Club"
                    value={profilePlayer.club}
                  />
                  <ProfileInfoItem
                    label="State"
                    value={profilePlayer.state}
                  />
                  <ProfileInfoItem
                    label="Experience"
                    value={
                      profilePlayer.experienceYears !== null &&
                      profilePlayer.experienceYears !== undefined
                        ? `${profilePlayer.experienceYears} ${
                            profilePlayer.experienceYears === 1
                              ? 'year'
                              : 'years'
                          }`
                        : 'Not specified'
                    }
                  />
                  <ProfileInfoItem
                    label="Age"
                    value={profilePlayer.age}
                  />
                  <ProfileInfoItem
                    label="Height"
                    value={
                      profilePlayer.height
                        ? `${profilePlayer.height} cm`
                        : 'Not specified'
                    }
                  />
                  <ProfileInfoItem
                    label="Weight"
                    value={
                      profilePlayer.weight
                        ? `${profilePlayer.weight} kg`
                        : 'Not specified'
                    }
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {profilePlayer.isRegistered && (
                  <button
                    type="button"
                    className={styles.btnOutline}
                    disabled={submittingReport}
                    onClick={() => openReportPlayer(profilePlayer)}
                    style={{
                      color: '#DC2626',
                      borderColor: '#FECACA',
                      background: '#FFF7F7',
                    }}
                  >
                    Report player
                  </button>
                )}

                {profilePlayer.pending &&
                  profilePlayer.requestedBy === 'coach' && (
                    <button
                      type="button"
                      className={styles.btnOutline}
                      disabled={savingId === profilePlayer.id}
                      onClick={() =>
                        handleCancelOutgoingRequest(profilePlayer)
                      }
                      style={{
                        color: '#DC2626',
                        borderColor: '#FECACA',
                        background: '#FEF2F2',
                      }}
                    >
                      {savingId === profilePlayer.id
                        ? 'Cancelling...'
                        : 'Cancel request'}
                    </button>
                  )}

                {!profilePlayer.assigned &&
                  !profilePlayer.pending &&
                  profilePlayer.isRegistered && (
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={savingId === profilePlayer.id}
                      onClick={() =>
                        handleAddPlayer(profilePlayer)
                      }
                    >
                      {savingId === profilePlayer.id
                        ? 'Sending...'
                        : '+ Send coaching request'}
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <div
          onMouseDown={event => {
            if (event.target === event.currentTarget) {
              closeScanner()
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10060,
            background: 'rgba(13,27,62,.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
          }}
        >
          <div
            className={styles.card}
            style={{
              width: 'min(520px,100%)',
              padding: 20,
              borderRadius: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: '#0D1B3E',
                  }}
                >
                  Scan ShuttleTrack QR
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 12,
                    color: '#8892A4',
                  }}
                >
                  Scan a player QR or skill verification QR.
                </div>
              </div>

              <button
                type="button"
                className={styles.btnOutline}
                onClick={closeScanner}
              >
                ×
              </button>
            </div>

            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 18,
                border: scanSuccess
                  ? '4px solid #16A34A'
                  : scanError
                    ? '3px solid #EF4444'
                    : '3px solid #D9E2F2',
                background: '#0F172A',
                minHeight: 300,
              }}
            >
              <div
                id="coach-shuttletrack-qr-reader"
                style={{
                  width: '100%',
                  minHeight: 300,
                  background: '#0F172A',
                }}
              />

              {!cameraActive &&
                !scannerStarting &&
                !scanSuccess && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 12,
                      color: '#fff',
                      background:
                        'linear-gradient(180deg,#172554,#0F172A)',
                    }}
                  >
                    <div style={{ fontSize: 38 }}>📷</div>
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      onClick={startQrScanner}
                    >
                      Start camera
                    </button>
                  </div>
                )}

              {scannerStarting && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    background: 'rgba(15,23,42,.8)',
                    fontWeight: 800,
                  }}
                >
                  Starting camera...
                </div>
              )}

              {scanSuccess && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    background: 'rgba(240,253,244,.94)',
                    color: '#166534',
                    fontWeight: 900,
                  }}
                >
                  <div
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 999,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#16A34A',
                      color: '#fff',
                      fontSize: 38,
                    }}
                  >
                    ✓
                  </div>
                  {scanSuccessLabel || 'QR found'}
                </div>
              )}
            </div>

            {scanError && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 11,
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#B91C1C',
                  fontSize: 12,
                }}
              >
                {scanError}
              </div>
            )}
          </div>
        </div>
      )}

      <ReportPlayerModal
        player={reportPlayer}
        submitting={submittingReport}
        onClose={() => {
          if (!submittingReport) setReportPlayer(null)
        }}
        onSubmit={submitPlayerReport}
      />
    </div>
  )
}
