import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
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
  notes: '',
  videoFile: null,
  videoUrl: '',
  videoFileName: '',
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

const scoreText = match => [match.score1, match.score2, match.score3].filter(Boolean).join(', ')

const getDisplayName = match => {
  if (isSingles(match.match_type)) return match.opponent_name || '-'
  const opponents = [match.opponent_name, match.opponent_name2].filter(Boolean).join(' & ')
  return opponents || '-'
}

const mapDbMatch = row => ({
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
  notes: row.notes || '',
  video_url: row.video_url || '',
  video_file_name: row.video_file_name || '',
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
        <path
          d="M12 5v14M5 12h14"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'matches') {
    return (
      <svg {...svgProps}>
        <rect
          x="6"
          y="4"
          width="12"
          height="16"
          rx="3"
          stroke={color}
          strokeWidth="2"
        />
        <path
          d="M9 8h6M9 12h6M9 16h4"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'win') {
    return (
      <svg {...svgProps}>
        <path
          d="M6 12.5l4 4L18 8"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'score') {
    return (
      <svg {...svgProps}>
        <path
          d="M5 16l4.2-4.2 3.2 3.2L19 8.5"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14.5 8.5H19V13"
          stroke={color}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'streak') {
    return (
      <svg {...svgProps}>
        <path
          d="m12 4 2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.3-4.6 2.3.9-5.2-3.8-3.7 5.2-.8L12 4Z"
          fill={color}
        />
      </svg>
    )
  }

  if (type === 'bell') {
    return (
      <svg {...svgProps}>
        <path
          d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M10 21h4"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'edit') {
    return (
      <svg {...svgProps}>
        <path
          d="M4 20h4l9.5-9.5a1.8 1.8 0 0 0 0-2.5L16 6.5a1.8 1.8 0 0 0-2.5 0L4 16v4Z"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="m12.5 7.5 4 4"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'delete') {
    return (
      <svg {...svgProps}>
        <path
          d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'video') {
    return (
      <svg {...svgProps}>
        <rect
          x="4"
          y="7"
          width="10"
          height="10"
          rx="2"
          stroke={color}
          strokeWidth="1.8"
        />
        <path d="m14 10 6-3v10l-6-3v-4Z" fill={color} />
      </svg>
    )
  }

  if (type === 'warning') {
    return (
      <svg {...svgProps}>
        <path
          d="M12 4 20 18H4L12 4Z"
          stroke={color}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M12 9v4"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="12" cy="16" r="1" fill={color} />
      </svg>
    )
  }

  if (type === 'success') {
    return (
      <svg {...svgProps}>
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke={color}
          strokeWidth="1.8"
        />
        <path
          d="m8 12.5 2.5 2.5L16 9.5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return null
}

function PerformanceComparisonRow({
  label,
  playerValue,
  coachValue,
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
      <div
        className={styles.skillLbl}
        style={{
          width: 'auto',
          minWidth: 0,
        }}
      >
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
              title={`Coach assessment: ${coachScore}`}
              style={{
                position: 'absolute',
                left: `calc(${coachScore}% - 1px)`,
                top: -5,
                width: 2,
                height: 18,
                borderRadius: 999,
                background: '#7C3AED',
                boxShadow:
                  '0 0 0 2px color-mix(in srgb, #7C3AED 16%, var(--card, #FFFFFF))',
              }}
            />

            <div
              style={{
                position: 'absolute',
                left: `clamp(0px, calc(${coachScore}% - 22px), calc(100% - 44px))`,
                top: -24,
                minWidth: 44,
                textAlign: 'center',
                fontSize: 9,
                fontWeight: 800,
                color: '#7C3AED',
                background:
                  'color-mix(in srgb, #7C3AED 12%, var(--card, #FFFFFF))',
                borderRadius: 999,
                padding: '2px 6px',
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
          width: 48,
          textAlign: 'center',
          fontSize: 11,
          fontWeight: 800,
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

const getPerformanceNotificationMeta = item => {
  const title = String(item?.title || '').toLowerCase()
  const type = String(item?.type || '').toLowerCase()
  const sourceType = String(item?.source_type || '').toLowerCase()

  if (
    type === 'success' ||
    title.includes('accepted') ||
    title.includes('completed')
  ) {
    return {
      icon: 'success',
      background: '#E7F8F0',
      color: '#16A34A',
    }
  }

  if (
    type === 'warning' ||
    title.includes('reminder') ||
    title.includes('upcoming')
  ) {
    return {
      icon: 'warning',
      background: '#FFF7E6',
      color: '#F59E0B',
    }
  }

  if (
    sourceType.includes('coach') ||
    title.includes('coach') ||
    title.includes('progress')
  ) {
    return {
      icon: 'score',
      background: '#E8EFFE',
      color: '#1A5FFF',
    }
  }

  return {
    icon: 'bell',
    background: '#EEF2FF',
    color: '#6366F1',
  }
}


function PageNotificationBell({ userId }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)

  const loadNotifications = useCallback(async () => {
    if (!userId) return

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .in('source_type', PERFORMANCE_NOTIFICATION_TYPES)
      .order('created_at', { ascending: false })
      .limit(8)

    if (error) {
      console.error('Page notification load error:', error)
      return
    }

    setItems(data || [])
  }, [userId])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const unread = items.filter(item => !item.is_read).length

  const openNotification = async item => {
    setItems(current =>
      current.map(row =>
        row.id === item.id ? { ...row, is_read: true } : row
      )
    )

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', item.id)
      .eq('user_id', userId)

    setOpen(false)

    if (item.action_url) {
      navigate(item.action_url)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={event => {
          event.stopPropagation()
          setOpen(current => !current)
          loadNotifications()
        }}
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          border: '1px solid var(--line, #E2E8F0)',
          background: 'var(--card, #FFFFFF)',
          color: 'var(--text, #0D1B3E)',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          position: 'relative',
          fontSize: 18,
        }}
        title="Page notifications"
      >
        🔔

        {unread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -5,
              right: -5,
              minWidth: 18,
              height: 18,
              borderRadius: 999,
              padding: '0 5px',
              display: 'grid',
              placeItems: 'center',
              background: '#EF4444',
              color: '#FFFFFF',
              fontSize: 9,
              fontWeight: 800,
            }}
          >
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 50,
            right: 0,
            width: 330,
            maxHeight: 360,
            overflowY: 'auto',
            padding: 10,
            borderRadius: 16,
            border: '1px solid var(--line, #EEF1F8)',
            background: 'var(--card, #FFFFFF)',
            boxShadow: '0 18px 45px rgba(13, 27, 62, 0.16)',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: 'var(--text, #0D1B3E)',
              marginBottom: 9,
            }}
          >
            Performance notifications
          </div>

          {items.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: 'center',
                color: 'var(--text-muted, #8892A4)',
                fontSize: 12,
              }}
            >
              No notifications for this page.
            </div>
          ) : (
            items.map(item => {
              const meta = getPerformanceNotificationMeta(item)

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openNotification(item)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 11px',
                    marginBottom: 7,
                    textAlign: 'left',
                    cursor: 'pointer',
                    background: item.is_read
                      ? 'var(--soft, #F6F8FF)'
                      : 'color-mix(in srgb, #1A5FFF 9%, var(--card, #FFFFFF))',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 5,
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: meta.background,
                        color: meta.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <MiniIcon
                        type={meta.icon}
                        color={meta.color}
                        size={14}
                      />
                    </span>

                    <span
                      style={{
                        minWidth: 0,
                        fontSize: 12,
                        fontWeight: 800,
                        color: 'var(--text, #0D1B3E)',
                      }}
                    >
                      {item.title}
                    </span>

                    {!item.is_read && (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 999,
                          background: '#1A5FFF',
                          marginLeft: 'auto',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>

                  <div
                    style={{
                      paddingLeft: 34,
                      fontSize: 11,
                      lineHeight: 1.45,
                      color: 'var(--text-muted, #8892A4)',
                    }}
                  >
                    {item.message}
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

const getSkillAdvice = skillName => {
  const adviceMap = {
    Smash:
      'Work on timing, racket preparation, and transferring power from your legs and core.',

    Defense:
      'Practise a low defensive stance, quick racket recovery, and returning smashes to different areas.',

    Footwork:
      'Use shadow footwork drills and focus on returning to the centre after every shot.',

    'Drop shot':
      'Practise a softer grip, maintain a consistent contact point, and disguise the shot until the final moment.',

    'Net play':
      'Keep your racket up, use a relaxed grip, and try to take the shuttle earlier at the net.',

    Serve:
      'Practise consistent placement, controlled movement, and reducing unnecessary wrist action.',
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
  const [skills, setSkills] = useState(defaultSkills)
  const [hasSkillRecord, setHasSkillRecord] = useState(false)
  const [coachProgress, setCoachProgress] = useState([])
  const [coachAssessments, setCoachAssessments] = useState([])

  const [filterType, setFilterType] = useState('All')
  const [sortOrder, setSortOrder] = useState('Latest')

  const [showMatchModal, setShowMatchModal] = useState(false)
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewMatch, setViewMatch] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
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
      setMatches((matchRows || []).map(mapDbMatch))

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
    } catch (error) {
      console.error('Performance load error:', error)
      alert(error.message || 'Failed to load performance data')
    } finally {
      setIsLoading(false)
    }
  }, [getOrCreateProfile])

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

  const stats = useMemo(() => {
    const wins = matches.filter(match => match.result === 'Win').length
    const losses = matches.filter(match => match.result === 'Loss').length
    const winRate = matches.length ? Math.round((wins / matches.length) * 100) : 0

    const setScores = matches
      .flatMap(match => [match.score1, match.score2, match.score3])
      .filter(Boolean)
      .flatMap(score => String(score).split('-').map(num => Number(num.trim())))
      .filter(num => !Number.isNaN(num))

    const avgScore = setScores.length
      ? (setScores.reduce((sum, score) => sum + score, 0) / setScores.length).toFixed(1)
      : '0.0'

    let bestStreak = 0
    let currentStreak = 0
    ;[...matches]
      .sort((a, b) => new Date(a.match_date) - new Date(b.match_date))
      .forEach(match => {
        if (match.result === 'Win') {
          currentStreak += 1
          bestStreak = Math.max(bestStreak, currentStreak)
        } else {
          currentStreak = 0
        }
      })

    return { wins, losses, winRate, avgScore, bestStreak }
  }, [matches])

  const visibleMatches = useMemo(() => {
    return matches
      .filter(match => filterType === 'All' || match.match_type === filterType)
      .sort((a, b) => {
        const dateA = new Date(a.match_date).getTime()
        const dateB = new Date(b.match_date).getTime()
        return sortOrder === 'Latest' ? dateB - dateA : dateA - dateB
      })
  }, [matches, filterType, sortOrder])

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

  const openAdd = () => {
    setEditingId(null)
    setRemoveVideo(false)
    setForm(emptyForm)
    if (videoInputRef.current) videoInputRef.current.value = ''
    setShowMatchModal(true)
  }

  const openEdit = (match, event) => {
    event.stopPropagation()
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

    const { data } = supabase.storage.from('profile-media').getPublicUrl(filePath)
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
      const currentProfileId = profileId || (await getOrCreateProfile(authUser))
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
        partner_name: isSingles(form.type) ? null : form.partnerName.trim() || null,
        partner_user_id: isSingles(form.type) ? null : form.partnerUserId,
        opponent_name: form.opponentName.trim(),
        opponent_user_id: form.opponentUserId,
        opponent_name2: isSingles(form.type) ? null : form.opponentName2.trim() || null,
        opponent_user_id2: isSingles(form.type) ? null : form.opponentUserId2,
        score1: form.score1.trim(),
        score2: form.score2.trim() || null,
        score3: form.score3.trim() || null,
        result: form.result,
        notes: form.notes.trim() || null,
        video_url: finalVideoUrl,
        video_file_name: finalVideoFileName,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error } = await supabase.from('player_matches').update(payload).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('player_matches').insert(payload)
        if (error) throw error
      }

      setShowMatchModal(false)
      setRemoveVideo(false)
      setForm(emptyForm)
      if (videoInputRef.current) videoInputRef.current.value = ''
      await loadPageData()
    } catch (error) {
      console.error('Save match error:', error)
      alert(error.message || 'Failed to save match')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = (id, event) => {
    event.stopPropagation()
    setDeleteConfirm(id)
  }

  const confirmDelete = async () => {
    setIsSaving(true)

    try {
      const { error } = await supabase.from('player_matches').delete().eq('id', deleteConfirm)
      if (error) throw error
      setDeleteConfirm(null)
      await loadPageData()
    } catch (error) {
      console.error('Delete match error:', error)
      alert(error.message || 'Failed to delete match')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateSkills = async () => {
    setIsSaving(true)

    try {
      const authUser = await getAuthUser()
      const currentProfileId = profileId || (await getOrCreateProfile(authUser))
      setProfileId(currentProfileId)

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

      setSkills(SKILL_COLUMNS.map((skill, index) => ({ ...skill, val: skillVals[index] })))
      setHasSkillRecord(true)
      setShowSkillModal(false)
    } catch (error) {
      console.error('Save skills error:', error)
      alert(error.message || 'Failed to save skills')
    } finally {
      setIsSaving(false)
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
    <div>
      <div className={styles.pageHead}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className={styles.pageTitle}>Performance</div>
            <div className={styles.pageSub}>Match records, results, and skill progress</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className={styles.btnPrimary} onClick={openAdd}>
              <MiniIcon type="plus" />
              Log Match
            </button>

            <PageNotificationBell userId={user?.id} />
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
            {stats.avgScore}
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
            {stats.bestStreak}W
          </div>
          <div className={styles.metricLbl}>Best win streak</div>
        </div>
      </div>

      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div className={styles.cardTitle}>Match history — click a row to view details</div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className={styles.formSelect} value={filterType} onChange={e => setFilterType(e.target.value)} style={{ width: 155, height: 36 }}>
              <option>All</option>
              {MATCH_TYPES.map(type => <option key={type}>{type}</option>)}
            </select>

            <select className={styles.formSelect} value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ width: 120, height: 36 }}>
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
                <th style={{ width: 80 }}>Result</th>
                <th style={{ width: 60 }}>Video</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {visibleMatches.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div style={{ padding: 38, textAlign: 'center', color: C.muted }}>
                      <div style={{ fontSize: 34, marginBottom: 10 }}>🏸</div>
                      <div style={{ fontWeight: 800, color: C.text }}>No matches logged yet</div>
                      <div style={{ marginTop: 6, fontSize: 13 }}>Start by adding your first match to see your win rate and progress.</div>
                      <button className={styles.btnPrimary} style={{ marginTop: 14 }} onClick={openAdd}>Log First Match</button>
                    </div>
                  </td>
                </tr>
              ) : (
                visibleMatches.map(match => (
                  <tr key={match.id} onClick={() => { setViewMatch(match); setShowViewModal(true) }} style={{ cursor: 'pointer' }}>
                    <td style={{ color: C.muted, fontSize: 12 }}>{fmtDate(match.match_date)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className={styles.av} style={{ width: 28, height: 28, fontSize: 10 }}>{getInitials(getDisplayName(match))}</div>
                        <span style={{ fontWeight: 600, color: C.text }}>{getDisplayName(match)}</span>
                      </div>
                    </td>
                    <td><span className={match.match_type.includes('Double') ? styles.badgePurple : styles.badgeBlue}>{match.match_type}</span></td>
                    <td style={{ fontWeight: 600, fontSize: 12, color: C.text }}>{scoreText(match)}</td>
                    <td><span className={match.result === 'Win' ? styles.badgeGreen : styles.badgeRed}>{match.result}</span></td>
                    <td>{match.video_url ? <span style={{ fontSize: 16 }} title="Has video">🎬</span> : <span style={{ fontSize: 12, color: C.muted }}>—</span>}</td>
                    <td onClick={event => event.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className={styles.btnIcon} onClick={event => openEdit(match, event)} title="Edit">✎</button>
                        <button className={styles.btnIconRed} onClick={event => handleDelete(match.id, event)} title="Delete">🗑</button>
                      </div>
                    </td>
                  </tr>
                ))
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
              />
            )
          })}

          <div style={{ marginTop: 14 }}>
            <button className={styles.btnPrimary} style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => { setSkillVals(skills.map(skill => skill.val)); setShowSkillModal(true) }}>
              Update skills
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: C.muted }}>
            A purple marker shows the coach assessment only when it is different from your own rating.
          </div>
        </div>

        {(hasSkillRecord || matches.length > 0) && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Recommendations</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recommendations.map((item, index) => (
                <div
                  key={index}
                  className={item.type === 'success' ? styles.alertSuccess : styles.alertWarning}
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
        <div className={styles.card} style={{ marginTop: 16 }}>
          <div className={styles.cardTitle}>Coach Feedback</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {coachProgress.map(item => (
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
                  {coachAssessments[0]?.performance_comment ||
                    'No performance feedback provided.'}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
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
            ))}
          </div>
        </div>
      )}

      {showMatchModal && (
        <div className={styles.modalOverlay} onClick={event => { if (event.target === event.currentTarget) { setShowMatchModal(false); setRemoveVideo(false); if (videoInputRef.current) videoInputRef.current.value = '' } }}>
          <div className={styles.modal} style={{ maxWidth: 580, maxHeight: '92vh', overflowY: 'auto' }}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>{editingId ? 'Edit Match' : 'Log a match'}</div>
              <button className={styles.modalClose} onClick={() => { setShowMatchModal(false); setRemoveVideo(false); if (videoInputRef.current) videoInputRef.current.value = '' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label className={styles.formLabel}>Match type</label>
                <select className={styles.formSelect} value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value, partnerName: '', partnerUserId: null, opponentName2: '', opponentUserId2: null }))}>
                  {MATCH_TYPES.map(type => <option key={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <label className={styles.formLabel}>Date</label>
                <input className={styles.formInput} type="date" value={form.date} onChange={set('date')} />
              </div>
            </div>

            {!isSingles(form.type) && (
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Your Partner Name</label>
                <input className={styles.formInput} placeholder="Search account or type manually" value={form.partnerName} onChange={set('partnerName')} />
                <SuggestionBox items={partnerSuggestions} onSelect={player => selectPlayer('partner', player)} />
                {form.partnerUserId && <div style={{ fontSize: 11, color: '#00C48C', marginTop: 5 }}>Linked to account ✓</div>}
              </div>
            )}

            <div className={isSingles(form.type) ? styles.formRow : styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>{isSingles(form.type) ? 'Opponent Name' : 'Opponent 1 Name'}</label>
                <input className={styles.formInput} placeholder="Search account or type manually" value={form.opponentName} onChange={set('opponentName')} />
                <SuggestionBox items={opponent1Suggestions} onSelect={player => selectPlayer('opponent1', player)} />
                {form.opponentUserId && <div style={{ fontSize: 11, color: '#00C48C', marginTop: 5 }}>Linked to account ✓</div>}
              </div>

              {!isSingles(form.type) && (
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Opponent 2 Name</label>
                  <input className={styles.formInput} placeholder="Search account or type manually" value={form.opponentName2} onChange={set('opponentName2')} />
                  <SuggestionBox items={opponent2Suggestions} onSelect={player => selectPlayer('opponent2', player)} />
                  {form.opponentUserId2 && <div style={{ fontSize: 11, color: '#00C48C', marginTop: 5 }}>Linked to account ✓</div>}
                </div>
              )}
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Game Score</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {['score1', 'score2', 'score3'].map((key, index) => (
                  <div key={key}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 5, fontWeight: 500 }}>Set {index + 1}</div>
                    <input className={styles.formInput} placeholder={index === 2 ? '—' : index === 0 ? '21-18' : '21-15'} value={form[key]} onChange={set(key)} />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label className={styles.formLabel}>Result</label>
                <select className={styles.formSelect} value={form.result} onChange={set('result')}>
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
                    background: form.videoFile || form.videoUrl ? '#F0FDF4' : '#FFFFFF',
                    color: form.videoFile || form.videoUrl ? '#00A878' : 'var(--text-muted)',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <svg width="17" height="17" viewBox="0 0 20 20" fill="none">
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
                  <span>{form.videoFile || form.videoUrl ? 'Video selected' : 'Upload video'}</span>
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
                <video src={form.videoUrl} controls style={{ width: '100%', borderRadius: 10, maxHeight: 180, background: '#000' }} />

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
                    if (videoInputRef.current) videoInputRef.current.value = ''
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
              <textarea className={styles.formTextarea} placeholder="e.g. Need improve speed" value={form.notes} onChange={set('notes')} style={{ minHeight: 80 }} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className={styles.btnOutline} onClick={() => { setShowMatchModal(false); setRemoveVideo(false); if (videoInputRef.current) videoInputRef.current.value = '' }}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSaveMatch} disabled={isSaving}>{isSaving ? 'Saving...' : editingId ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && viewMatch && (
        <div className={styles.modalOverlay} onClick={event => event.target === event.currentTarget && setShowViewModal(false)}>
          <div className={styles.modal} style={{ maxWidth: 520, maxHeight: '88vh', overflowY: 'auto' }}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Match Details</div>
              <button className={styles.modalClose} onClick={() => setShowViewModal(false)}>✕</button>
            </div>

            <div style={{ background: viewMatch.result === 'Win' ? 'rgba(0, 196, 140, 0.12)' : 'rgba(239, 68, 68, 0.12)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className={styles.av} style={{ width: 48, height: 48, fontSize: 16, background: viewMatch.result === 'Win' ? '#00C48C' : '#EF4444', color: '#fff' }}>{getInitials(getDisplayName(viewMatch))}</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>vs {getDisplayName(viewMatch)}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{viewMatch.match_type} · {fmtDate(viewMatch.match_date)}</div>
              </div>
              <span className={viewMatch.result === 'Win' ? styles.badgeGreen : styles.badgeRed} style={{ marginLeft: 'auto', fontSize: 13, padding: '5px 14px' }}>{viewMatch.result}</span>
            </div>

            {!isSingles(viewMatch.match_type) && (
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Your partner</span>
                <span className={styles.statVal}>{viewMatch.partner_name || '—'}</span>
              </div>
            )}

            <div className={styles.statRow}><span className={styles.statLabel}>Score</span><span className={styles.statVal} style={{ fontWeight: 800 }}>{scoreText(viewMatch)}</span></div>
            <div className={styles.statRow}><span className={styles.statLabel}>Match type</span><span className={styles.statVal}>{viewMatch.match_type}</span></div>
            <div className={styles.statRow}><span className={styles.statLabel}>Date</span><span className={styles.statVal}>{fmtDate(viewMatch.match_date)}</span></div>
            <div className={styles.statRow} style={{ alignItems: 'flex-start', paddingTop: 12 }}><span className={styles.statLabel}>Notes</span><span className={styles.statVal} style={{ textAlign: 'right', color: C.muted, fontWeight: 400 }}>{viewMatch.notes || '—'}</span></div>

            <div style={{ marginTop: 20 }}>
              <div className={styles.cardTitle}>Match video</div>
              {viewMatch.video_url ? (
                <video ref={videoRef} src={viewMatch.video_url} controls style={{ width: '100%', borderRadius: 12, background: '#000', maxHeight: 280 }} />
              ) : (
                <div style={{ background: C.soft, borderRadius: 12, padding: '32px 20px', textAlign: 'center', color: C.muted, fontSize: 13, border: `2px dashed ${C.line}` }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
                  No video uploaded for this match.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button className={styles.btnPrimary} onClick={() => setShowViewModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: 380 }}>
            <div className={styles.modalHead}><div className={styles.modalTitle}>Delete Match</div></div>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Are you sure you want to delete this match? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className={styles.btnOutline} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className={styles.btnDanger} onClick={confirmDelete} disabled={isSaving}>{isSaving ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {showSkillModal && (
        <div className={styles.modalOverlay} onClick={event => event.target === event.currentTarget && setShowSkillModal(false)}>
          <div className={styles.modal} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Update Skills</div>
              <button className={styles.modalClose} onClick={() => setShowSkillModal(false)}>✕</button>
            </div>

            <div className={styles.tip}>Rate each skill honestly from 1–100. Labeled as self-reported data.</div>

            {skills.map((skill, index) => (
              <div key={skill.name} className={styles.formRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className={styles.formLabel} style={{ marginBottom: 0 }}>{skill.name}</label>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{skillVals[index]}</span>
                </div>
                <input type="range" min="1" max="100" value={skillVals[index]} style={{ width: '100%', accentColor: '#1A5FFF' }} onChange={event => setSkillVals(prev => prev.map((value, i) => i === index ? Number(event.target.value) : value))} />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className={styles.btnOutline} onClick={() => setShowSkillModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleUpdateSkills} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Skills'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}