import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'
import {
  Avatar,
  CoachPageHeader,
  LevelBadge,
} from './CoachShared'

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

function getPlayerId(row) {
  return row?.user_id || row?.player_id || row?.id || null
}

function normalizeMatchResult(value) {
  return String(value || '').trim().toLowerCase()
}

function buildPlayerMatchStats(matches = []) {
  const sortedMatches = [...matches].sort((a, b) => {
    const aDate = new Date(a.match_date || a.created_at || 0).getTime()
    const bDate = new Date(b.match_date || b.created_at || 0).getTime()
    return bDate - aDate
  })

  const wins = sortedMatches.filter(
    match => normalizeMatchResult(match.result) === 'win'
  ).length

  const totalMatches = sortedMatches.length
  const winRate = totalMatches
    ? Math.round((wins / totalMatches) * 100)
    : 0

  let streakCount = 0
  let streakType = ''

  for (const match of sortedMatches) {
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

function getRelationshipStatus(row) {
  const rawStatus = String(
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
    ].includes(rawStatus)
  ) {
    return 'pending'
  }

  if (['accepted', 'active', 'approved'].includes(rawStatus)) {
    return 'accepted'
  }

  if (['declined', 'rejected'].includes(rawStatus)) {
    return 'declined'
  }

  if (['removed', 'cancelled', 'canceled'].includes(rawStatus)) {
    return 'removed'
  }

  return rawStatus
}

function getRequestedBy(row) {
  return String(
    row?.requested_by ||
    row?.requester_role ||
    row?.created_by_role ||
    ''
  ).toLowerCase()
}

function normalizePlayer(profile, skillRow, relationship, source = 'registered', matchStats = null) {
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

    club:
      profile?.club ||
      profile?.external_club ||
      'No club',
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
    height:
      profile?.height_cm ??
      profile?.height ??
      null,

    weight:
      profile?.weight_kg ??
      profile?.weight ??
      null,
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
    playingSince:
      profile?.playing_since ||
      profile?.since ||
      'Not specified',
    preferredCourt:
      profile?.preferred_court ||
      profile?.court ||
      'Not specified',

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



function ReportPlayerModal({
  player,
  submitting,
  onClose,
  onSubmit,
}) {
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

    if (!reason) {
      setFormError('Please select a report reason.')
      return
    }

    if (reason === 'Other' && !details.trim()) {
      setFormError('Please explain the reason for this report.')
      return
    }

    setFormError('')

    await onSubmit({
      reason,
      details: details.trim(),
    })
  }

  return (
    <div
      role="presentation"
      onMouseDown={event => {
        if (
          event.target === event.currentTarget &&
          !submitting
        ) {
          onClose()
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: 'rgba(13, 27, 62, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className={styles.card}
        style={{
          width: 'min(520px, 100%)',
          padding: 22,
          background: 'var(--card, #FFFFFF)',
          border: '1px solid var(--line, #EEF1F8)',
          borderRadius: 18,
          boxShadow: '0 24px 60px rgba(13,27,62,0.25)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: 'var(--text, #0D1B3E)',
              }}
            >
              Report player
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                lineHeight: 1.55,
                color: 'var(--text-muted, #8892A4)',
              }}
            >
              Report {player.name} to the ShuttleTrack administrator.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close report form"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: '1px solid var(--line, #DDE3EF)',
              background: 'var(--card, #FFFFFF)',
              color: 'var(--text-muted, #8892A4)',
              fontSize: 18,
              cursor: submitting ? 'wait' : 'pointer',
            }}
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
          <label className={styles.formLabel}>
            Additional details
          </label>

          <textarea
            className={styles.formInput}
            rows={5}
            maxLength={1000}
            value={details}
            onChange={event => setDetails(event.target.value)}
            disabled={submitting}
            placeholder="Explain what happened. Do not include passwords or financial information."
            style={{
              width: '100%',
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />

          <div
            style={{
              marginTop: 5,
              textAlign: 'right',
              color: 'var(--text-muted, #8892A4)',
              fontSize: 10,
            }}
          >
            {details.length}/1000
          </div>
        </div>

        {formError && (
          <div
            style={{
              marginBottom: 14,
              padding: '11px 12px',
              borderRadius: 10,
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#B91C1C',
              fontSize: 12,
            }}
          >
            {formError}
          </div>
        )}

        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 11,
            background: '#FFF7ED',
            color: '#9A3412',
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          Reports are reviewed by an administrator. Submit only genuine
          safety or behaviour concerns.
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 9,
          }}
        >
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
              border: 'none',
              borderRadius: 10,
              padding: '9px 15px',
              background: '#DC2626',
              color: '#FFFFFF',
              fontSize: 12,
              fontWeight: 800,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.65 : 1,
            }}
          >
            {submitting ? 'Submitting...' : 'Submit report'}
          </button>
        </div>
      </form>
    </div>
  )
}

function PlayerRadarChart({ player, size = 330 }) {
  const skills = [
    { label: 'Smash', value: Number(player?.smash ?? 0) },
    { label: 'Defense', value: Number(player?.defense ?? 0) },
    { label: 'Footwork', value: Number(player?.footwork ?? 0) },
    { label: 'Drop shot', value: Number(player?.dropShot ?? 0) },
    { label: 'Net play', value: Number(player?.netPlay ?? 0) },
    { label: 'Serve', value: Number(player?.serve ?? 0) },
  ]

  const center = size / 2
  const radius = size * 0.31
  const levels = 5

  const pointAt = (index, percentage) => {
    const angle =
      (Math.PI * 2 * index) / skills.length - Math.PI / 2
    const distance = radius * (percentage / 100)

    return {
      x: center + Math.cos(angle) * distance,
      y: center + Math.sin(angle) * distance,
    }
  }

  const dataPoints = skills
    .map((skill, index) => {
      const point = pointAt(
        index,
        Math.max(0, Math.min(100, skill.value))
      )

      return `${point.x},${point.y}`
    })
    .join(' ')

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <svg
        width="100%"
        height="auto"
        viewBox={`0 0 ${size} ${size}`}
        style={{ maxWidth: size }}
        aria-label="Player skill radar chart"
      >
        {[...Array(levels)].map((_, levelIndex) => {
          const percentage =
            ((levelIndex + 1) / levels) * 100

          const points = skills
            .map((_, index) => {
              const point = pointAt(index, percentage)
              return `${point.x},${point.y}`
            })
            .join(' ')

          return (
            <polygon
              key={percentage}
              points={points}
              fill="none"
              stroke="#DDE4F0"
              strokeWidth="1"
            />
          )
        })}

        {skills.map((skill, index) => {
          const outerPoint = pointAt(index, 100)

          return (
            <line
              key={`axis-${skill.label}`}
              x1={center}
              y1={center}
              x2={outerPoint.x}
              y2={outerPoint.y}
              stroke="#DDE4F0"
              strokeWidth="1"
            />
          )
        })}

        <polygon
          points={dataPoints}
          fill="rgba(26, 95, 255, 0.2)"
          stroke="#1A5FFF"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {skills.map((skill, index) => {
          const point = pointAt(
            index,
            Math.max(0, Math.min(100, skill.value))
          )

          return (
            <circle
              key={`value-${skill.label}`}
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#1A5FFF"
            />
          )
        })}

        {skills.map((skill, index) => {
          const labelPoint = pointAt(index, 121)

          return (
            <g key={`label-${skill.label}`}>
              <text
                x={labelPoint.x}
                y={labelPoint.y - 3}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="#0D1B3E"
              >
                {skill.label}
              </text>

              <text
                x={labelPoint.x}
                y={labelPoint.y + 12}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#1A5FFF"
              >
                {skill.value}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
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
      <div
        style={{
          fontSize: 11,
          color: 'var(--text-muted, #8892A4)',
          textAlign: 'right',
        }}
      >
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
          color: 'var(--text, #0D1B3E)',
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
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted, #8892A4)',
          marginBottom: 3,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--text, #0D1B3E)',
        }}
      >
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


function PlayerMetricIcon({
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

  if (type === 'players') {
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

  if (type === 'requests') {
    return (
      <svg {...props}>
        <circle
          cx="9"
          cy="8"
          r="3"
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
          d="M17 8v6M14 11h6"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'available') {
    return (
      <svg {...props}>
        <circle
          cx="11"
          cy="11"
          r="7"
          stroke={color}
          strokeWidth="1.8"
        />
        <path
          d="m16.5 16.5 4 4"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle
          cx="11"
          cy="9"
          r="2"
          stroke={color}
          strokeWidth="1.6"
        />
        <path
          d="M7.5 15c.5-2 1.7-3 3.5-3s3 1 3.5 3"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'history') {
    return (
      <svg {...props}>
        <path
          d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 4v4.5h4.5"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M12 8v4l2.8 1.7"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return null
}

function PlayerStats({
  myPlayers = [],
  pendingPlayers = [],
  availablePlayers = [],
  requestHistory = [],
}) {
  const items = [
    {
      label: 'My players',
      value: myPlayers.length,
      color: '#1A5FFF',
      background: '#E8EFFE',
      icon: 'players',
    },
    {
      label: 'Pending requests',
      value: pendingPlayers.length,
      color: '#00976C',
      background: '#DDF8EF',
      icon: 'requests',
    },
    {
      label: 'Available players',
      value: availablePlayers.length,
      color: '#F59E0B',
      background: '#FEF3C7',
      icon: 'available',
    },
    {
      label: 'Request history',
      value: requestHistory.length,
      color: '#7C3AED',
      background: '#EDE9FE',
      icon: 'history',
    },
  ]

  return (
    <div className={styles.g4} style={{ marginBottom: 16 }}>
      {items.map(item => (
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
            <PlayerMetricIcon
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
  )
}

export default function CoachPlayers() {
  const { user } = useAuth()
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
      ] = await Promise.all([
        supabase
          .from('player_profiles')
          .select('*')
          .order('display_name', { ascending: true }),

        supabase
          .from('public_players')
          .select('*')
          .order('name', { ascending: true }),

        supabase
          .from('player_skill_ratings')
          .select('*'),

        supabase
          .from('coach_player_relationships')
          .select('*')
          .eq('coach_user_id', user.id),

        supabase
          .from('player_matches')
          .select('*')
          .order('match_date', { ascending: false })
          .order('created_at', { ascending: false }),
      ])

      if (profilesResult.error) throw profilesResult.error
      if (publicPlayersResult.error) throw publicPlayersResult.error
      if (skillsResult.error) throw skillsResult.error
      if (relationshipsResult.error) throw relationshipsResult.error
      if (matchesResult.error) throw matchesResult.error

      const relationshipMap = new Map(
        (relationshipsResult.data || []).map(row => [
          row.player_user_id,
          row,
        ])
      )

      const skillMap = new Map()

      ;(skillsResult.data || []).forEach(row => {
        const possibleKeys = [
          row.player_id,
          row.user_id,
          row.player_user_id,
          row.profile_id,
        ].filter(Boolean)

        possibleKeys.forEach(key => {
          skillMap.set(key, row)
        })
      })

      const matchesByProfileId = new Map()

      ;(matchesResult.data || []).forEach(match => {
        const profileId = match.player_id || match.profile_id || null
        if (!profileId) return

        const currentMatches = matchesByProfileId.get(profileId) || []
        currentMatches.push(match)
        matchesByProfileId.set(profileId, currentMatches)
      })

      const matchStatsByProfileId = new Map()

      matchesByProfileId.forEach((playerMatches, profileId) => {
        matchStatsByProfileId.set(
          profileId,
          buildPlayerMatchStats(playerMatches)
        )
      })

      const allRegisteredProfiles = profilesResult.data || []

      /*
       * Build duplicate guards before filtering private profiles.
       * This prevents a hidden registered account from reappearing
       * through an old public_players row.
       */
      const allRegisteredNames = new Set(
        allRegisteredProfiles
          .map(profile =>
            String(profile.display_name || '')
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      )

      const allRegisteredUserIds = new Set(
        allRegisteredProfiles
          .map(profile =>
            profile.user_id ? String(profile.user_id) : ''
          )
          .filter(Boolean)
      )

      const registeredPlayers = allRegisteredProfiles
        .filter(profile => {
          const playerId = getPlayerId(profile)
          if (!playerId || playerId === user.id) return false

          const relationship = relationshipMap.get(playerId)
          const relationshipStatus =
            getRelationshipStatus(relationship)

          /*
           * Private profiles stay visible only when this coach already
           * has a pending or accepted relationship with the player.
           */
          const connectedToThisCoach =
            relationshipStatus === 'accepted' ||
            relationshipStatus === 'pending'

          return (
            profile.profile_public !== false ||
            connectedToThisCoach
          )
        })
        .map(profile => {
          const playerId = getPlayerId(profile)

          const skillRow =
            skillMap.get(playerId) ||
            skillMap.get(profile.id) ||
            null

          return normalizePlayer(
            profile,
            skillRow,
            relationshipMap.get(playerId),
            'registered',
            matchStatsByProfileId.get(profile.id) || null
          )
        })

      const publicPlayers = (publicPlayersResult.data || [])
        .filter(row => {
          const linkedUserId =
            row.user_id ||
            row.player_user_id ||
            null

          const name = String(row?.name || '')
            .trim()
            .toLowerCase()

          if (!name) return false

          if (
            linkedUserId &&
            allRegisteredUserIds.has(String(linkedUserId))
          ) {
            return false
          }

          if (allRegisteredNames.has(name)) {
            return false
          }

          return true
        })
        .map(row => {
          const linkedUserId =
            row.user_id ||
            row.player_user_id ||
            null

          const relationship = linkedUserId
            ? relationshipMap.get(linkedUserId)
            : null

          const publicSkillRow =
            skillMap.get(linkedUserId) ||
            skillMap.get(row.id) ||
            {
              smash: row.smash,
              defense: row.defense,
              footwork: row.footwork,
              drop_shot: row.drop_shot,
              net_play: row.net_play,
              serve: row.serve,
            }

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
            matchStatsByProfileId.get(row.id) || null
          )
        })
        .filter(player => player.id)

      const normalizedPlayers = [
        ...registeredPlayers,
        ...publicPlayers,
      ].sort((a, b) => a.name.localeCompare(b.name))

      setPlayers(normalizedPlayers)
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
    const channel = supabase
      .channel(`coach-players-profile-updates-${user?.id || 'guest'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'player_profiles',
        },
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
    () => players.filter(player => player.pending),
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
          const aDate = new Date(
            a.relationshipRespondedAt ||
            a.relationshipCreatedAt ||
            0
          ).getTime()

          const bDate = new Date(
            b.relationshipRespondedAt ||
            b.relationshipCreatedAt ||
            0
          ).getTime()

          return bDate - aDate
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
      players.filter(
        player => !player.assigned && !player.pending
      ),
    [players]
  )

  const searchResults = useMemo(() => {
    const keyword = playerSearch.trim().toLowerCase()

    if (!keyword) return availablePlayers

    return availablePlayers.filter(player =>
      player.name.toLowerCase().includes(keyword) ||
      player.club.toLowerCase().includes(keyword) ||
      player.state.toLowerCase().includes(keyword) ||
      player.category.toLowerCase().includes(keyword) ||
      player.level.toLowerCase().includes(keyword)
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
            status: 'accepted',
            message: null,
            responded_at: new Date().toISOString(),
          },
          {
            onConflict: 'player_user_id,coach_user_id',
          }
        )
        .select()
        .single()

      if (relationshipError) throw relationshipError

      updatePlayerRelationship(player.id, {
        relationshipId: data.id,
        relationshipStatus: 'accepted',
        assigned: true,
        pending: false,
      })

      setPlayerSearch('')
      setSuccess(`${player.name} was added to My Players.`)
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

  const handleRemove = async player => {
    const confirmed = window.confirm(
      `Remove ${player.name} from My Players?`
    )

    if (!confirmed) return

    clearMessages()
    setSavingId(player.id)

    try {
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

      if (selectedPlayerId === player.id) {
        setSelectedPlayerId(null)
      }

      setSuccess(`${player.name} was removed from My Players.`)
    } catch (removeError) {
      console.error('Remove player error:', removeError)
      setError(removeError.message || 'Unable to remove player.')
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

    if (reportPlayer.id === user.id) {
      setError('You cannot report your own account.')
      setReportPlayer(null)
      return
    }

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
            `Details: ${
              details || 'No additional details provided.'
            }`,
          ].join('\n'),
          status: 'pending',
        })

      if (reportError) throw reportError

      const reportedName = reportPlayer.name

      setReportPlayer(null)
      setSuccess(
        `Your report about ${reportedName} was submitted for admin review.`
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

  return (
    <div>
      <CoachPageHeader
        title="My Players"
        subtitle="Manage your players and write progress notes"
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
          style={{
            fontSize: 12,
          }}
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
            <div
              className={styles.card}
              style={{ marginBottom: 14 }}
            >
              <div
                className={styles.cardTitle}
                style={{ marginBottom: 12 }}
              >
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
                      padding: '12px',
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
              No pending player requests.
            </div>
          )}

          {showRequestHistory && (
            <div
              className={styles.card}
              style={{ marginBottom: 14 }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div className={styles.cardTitle}>
                  Request history
                </div>

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
                        padding: '12px',
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
              <div
                className={styles.card}
                style={{ padding: 16 }}
              >
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
                    autoFocus
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
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 12px',
                            background: '#F7F9FF',
                            borderRadius: 10,
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

                          <button
                            type="button"
                            className={styles.btnOutline}
                            onClick={() => setProfilePlayerId(player.id)}
                            style={{
                              fontSize: 11,
                              padding: '4px 10px',
                            }}
                          >
                            Profile
                          </button>

                          {player.isRegistered ? (
                            <button
                              type="button"
                              className={styles.btnPrimary}
                              disabled={savingId === player.id}
                              onClick={() => handleAddPlayer(player)}
                              style={{
                                fontSize: 11,
                                padding: '4px 12px',
                              }}
                            >
                              {savingId === player.id ? 'Saving...' : '+ Add'}
                            </button>
                          ) : (
                            <span
                              style={{
                                fontSize: 11,
                                color: '#8892A4',
                                fontWeight: 600,
                                padding: '4px 8px',
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
                  No players assigned yet. Accept a request or add one from Available Players.
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
                        ? 'rgba(26, 95, 255, 0.14)'
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
                        color: 'inherit',
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
                          background: 'rgba(136, 146, 164, 0.14)',
                          color: 'inherit',
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
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
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
                        onClick={() => setProfilePlayerId(selectedPlayer.id)}
                      >
                        View profile
                      </button>
                    </div>

                    <div className={styles.cardTitle}>
                      Skill profile
                    </div>

                    <PlayerRadarChart player={selectedPlayer} />
                  </div>
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
            background: 'rgba(13, 27, 62, 0.52)',
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
              width: 'min(820px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 0,
              background: 'var(--card, #FFFFFF)',
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
                borderBottom: '1px solid var(--line, #EEF1F8)',
                background: 'var(--card, #FFFFFF)',
              }}
            >
              <ProfileAvatar player={profilePlayer} size={58} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 19,
                    fontWeight: 800,
                    color: 'var(--text, #0D1B3E)',
                  }}
                >
                  {profilePlayer.name}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted, #8892A4)',
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
                      background: 'var(--soft, #F3F4F6)',
                      color: 'var(--text-muted, #6B7280)',
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
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: 10,
                    marginBottom: 18,
                  }}
                >
                  {[
                    {
                      label: 'Matches',
                      value: profilePlayer.matches,
                      color: 'var(--text, #0D1B3E)',
                    },
                    {
                      label: 'Win rate',
                      value: `${profilePlayer.winRate}%`,
                      color: '#1A5FFF',
                    },
                    {
                      label: 'Streak',
                      value: profilePlayer.streak,
                      color: String(profilePlayer.streak).startsWith('W')
                        ? '#00A878'
                        : '#DC2626',
                    },
                  ].map(stat => (
                    <div
                      key={stat.label}
                      style={{
                        padding: '11px 10px',
                        borderRadius: 11,
                        textAlign: 'center',
                        background: 'var(--soft, #F6F8FF)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: 'var(--text-muted, #8892A4)',
                        }}
                      >
                        {stat.label}
                      </div>

                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 17,
                          fontWeight: 800,
                          color: stat.color,
                        }}
                      >
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    borderTop: '1px solid var(--line, #EEF1F8)',
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
                      color: 'var(--text, #0D1B3E)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {profilePlayer.bio}
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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
                    label="Playing since"
                    value={profilePlayer.playingSince}
                  />
                  <ProfileInfoItem
                    label="Preferred court"
                    value={profilePlayer.preferredCourt}
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

                {!profilePlayer.assigned &&
                  !profilePlayer.pending &&
                  profilePlayer.isRegistered && (
                    <button
                      type="button"
                      className={styles.btnPrimary}
                      disabled={savingId === profilePlayer.id}
                      onClick={() => handleAddPlayer(profilePlayer)}
                    >
                      {savingId === profilePlayer.id
                        ? 'Adding...'
                        : '+ Add to My Players'}
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
      <ReportPlayerModal
        player={reportPlayer}
        submitting={submittingReport}
        onClose={() => {
          if (!submittingReport) {
            setReportPlayer(null)
          }
        }}
        onSubmit={submitPlayerReport}
      />

    </div>
  )
}