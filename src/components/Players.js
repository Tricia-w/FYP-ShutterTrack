import { useMemo, useState } from 'react'
import styles from './Pages.module.css'

const C = {
  text: 'var(--text, #0D1B3E)',
  muted: 'var(--text-muted, #8892A4)',
  card: 'var(--card, #FFFFFF)',
  soft: 'var(--soft, #F6F8FF)',
  line: 'var(--line, #EEF1F8)',
  blue: '#1A5FFF',
}

const CURRENT_PLAYER = {
  level: 'Intermediate',
  style: 'Aggressive',
  state: 'Penang',
  weakness: 'Defense',
  preferredCourt: 'Doubles',
}

const allPlayers = [
  {
    init: 'A', name: 'Adeline', club: 'Selangor BC', state: 'Selangor',
    level: 'Advanced', style: 'Aggressive',
    smash: 88, defense: 72, footwork: 80, net: 70, serve: 75, stamina: 66,
    overall: 77, matches: 142, winRate: 64, streak: 'W4',
    ig: '@adelinee.smash',
    hand: 'Right', since: '2015', court: 'Singles',
    videos: [
      { opp: 'vs Ali — Selangor Open 2024', score: '21–18, 21–14', result: 'Win', dur: '34 min', w: true },
      { opp: 'vs Danial — KL Masters 2024', score: '19–21, 17–21', result: 'Loss', dur: '41 min', w: false },
      { opp: 'vs Adam — Club League 2024', score: '21–15, 21–19', result: 'Win', dur: '28 min', w: true },
    ],
    isOpp: false,
  },
  {
    init: 'A', name: 'Adam', club: 'KL Badminton', state: 'Kuala Lumpur',
    level: 'Intermediate', style: 'Defensive',
    smash: 60, defense: 85, footwork: 70, net: 78, serve: 68, stamina: 72,
    overall: 65, matches: 87, winRate: 52, streak: 'L2',
    ig: null,
    hand: 'Left', since: '2018', court: 'Doubles',
    videos: [
      { opp: 'vs Ali — KL Open 2024', score: '21–16, 21–18', result: 'Win', dur: '38 min', w: true },
      { opp: 'vs Adeline — Club League 2024', score: '18–21, 14–21', result: 'Loss', dur: '44 min', w: false },
    ],
    isOpp: false,
  },
  {
    init: 'D', name: 'Danial', club: 'Johor BC', state: 'Johor',
    level: 'Advanced', style: 'All-round',
    smash: 80, defense: 80, footwork: 78, net: 75, serve: 77, stamina: 80,
    overall: 81, matches: 203, winRate: 71, streak: 'W6',
    ig: '@dddanial.bwf',
    hand: 'Right', since: '2012', court: 'Singles',
    videos: [
      { opp: 'vs Ali — Johor State 2024', score: '21–14, 21–11', result: 'Win', dur: '29 min', w: true },
      { opp: 'vs Adeline — Selangor Open 2024', score: '21–19, 21–17', result: 'Win', dur: '51 min', w: true },
    ],
    isOpp: false,
  },
  {
    init: 'A', name: 'Ali', club: 'Penang BC', state: 'Penang',
    level: 'Intermediate', style: 'Attacking',
    smash: 76, defense: 60, footwork: 72, net: 65, serve: 65, stamina: 58,
    overall: 61, matches: 54, winRate: 46, streak: 'W1',
    ig: null,
    hand: 'Right', since: '2020', court: 'Singles',
    videos: [
      { opp: 'vs Danial — Penang League 2024', score: '21–18, 21–19', result: 'Win', dur: '48 min', w: true },
    ],
    isOpp: false,
  },
  {
    init: 'R', name: 'Razif', club: 'Seberang BC', state: 'Penang',
    level: 'Intermediate', style: 'Defensive',
    smash: 65, defense: 80, footwork: 70, net: 76, serve: 64, stamina: 68,
    overall: 71, matches: 88, winRate: 59, streak: 'W3',
    ig: '@razif.netplay',
    hand: 'Right', since: '2019', court: 'Doubles',
    videos: [
      { opp: 'vs Adam — Club Match', score: '21–16, 18–21, 21–19', result: 'Win', dur: '49 min', w: true },
    ],
    isOpp: false,
  },
  {
    init: 'K', name: 'Khairul', club: 'Penang BC', state: 'Penang',
    level: 'Advanced', style: 'All-round',
    smash: 78, defense: 75, footwork: 80, net: 74, serve: 72, stamina: 80,
    overall: 77, matches: 134, winRate: 66, streak: 'W5',
    ig: null,
    hand: 'Right', since: '2014', court: 'Singles',
    videos: [
      { opp: 'vs Danial — Friendly Match', score: '21–18, 16–21, 19–21', result: 'Loss', dur: '50 min', w: false },
    ],
    isOpp: false,
  },
]

function SkillBar({ name, val, dim }) {
  return (
    <div className={styles.skillRow}>
      <div className={styles.skillLbl}>{name}</div>

      <div className={styles.skillTrack}>
        <div
          className={styles.skillFill}
          style={{
            width: `${val}%`,
            background: dim
              ? 'linear-gradient(90deg,#93b4f5,#bdd1fb)'
              : 'linear-gradient(90deg,#1A5FFF,#3B7BFF)',
          }}
        />
      </div>

      <div className={styles.skillVal}>{val}</div>
    </div>
  )
}

function VideoRow({ video }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        padding: '9px 10px',
        background: C.soft,
        borderRadius: 10,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 72,
          height: 44,
          borderRadius: 6,
          flexShrink: 0,
          background: video.w ? '#DCE8FB' : '#FEE2E2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 0,
            height: 0,
            borderStyle: 'solid',
            borderWidth: '6px 0 6px 12px',
            borderColor: `transparent transparent transparent ${video.w ? '#1A5FFF' : '#DC2626'}`,
          }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: C.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {video.opp}
        </div>

        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
          {video.score} · {video.result} · {video.dur}
        </div>
      </div>

      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          borderRadius: 20,
          padding: '3px 8px',
          flexShrink: 0,
          background: video.w ? '#DCFCE7' : '#FEE2E2',
          color: video.w ? '#15803D' : '#B91C1C',
        }}
      >
        {video.w ? 'W' : 'L'}
      </span>
    </div>
  )
}

function getPartnerMatch(player, criteria) {
  let score = 0
  const reasons = []

  if (criteria.level === 'Any' || player.level === criteria.level) {
    score += 25
    reasons.push(criteria.level === 'Any' ? 'Level suitable' : 'Same level')
  }

  if (criteria.state === 'Any' || player.state === criteria.state) {
    score += 20
    reasons.push(criteria.state === 'Any' ? 'Location okay' : 'Same state')
  }

  if (criteria.style === 'Auto') {
    if (CURRENT_PLAYER.style === 'Aggressive' && ['Defensive', 'All-round'].includes(player.style)) {
      score += 20
      reasons.push('Balances your attacking style')
    } else if (CURRENT_PLAYER.style === 'Defensive' && ['Aggressive', 'Attacking', 'All-round'].includes(player.style)) {
      score += 20
      reasons.push('Adds attacking support')
    } else if (player.style === 'All-round') {
      score += 15
      reasons.push('Flexible style')
    }
  } else if (criteria.style === 'Any' || player.style === criteria.style) {
    score += 18
    reasons.push(criteria.style === 'Any' ? 'Style suitable' : `Matches ${criteria.style}`)
  }

  if (criteria.gameType === 'Doubles' || criteria.gameType === 'Mixed Doubles') {
    if (player.net >= 70) {
      score += 12
      reasons.push('Good net play')
    }

    if (player.defense >= 70) {
      score += 10
      reasons.push('Strong defense')
    }
  }

  if (criteria.gameType === 'Singles') {
    if (player.footwork >= 75) {
      score += 12
      reasons.push('Good movement')
    }

    if (player.stamina >= 75) {
      score += 10
      reasons.push('Good stamina')
    }
  }

  if (CURRENT_PLAYER.weakness === 'Defense' && player.defense >= 75) {
    score += 13
    reasons.push('Covers your defense weakness')
  }

  return {
    score: Math.min(score, 100),
    reasons: reasons.slice(0, 3),
  }
}

function SmallInfo({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>
        {label}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
        {value}
      </div>
    </div>
  )
}

function FormSelect({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 700,
          color: C.muted,
          marginBottom: 6,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </label>

      <select
        className={styles.formSelect}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%' }}
      >
        {options.map(opt => (
          <option key={opt}>{opt}</option>
        ))}
      </select>
    </div>
  )
}

function PlayerDetail({
  p,
  isPartner,
  onAddOpponent,
  onRemoveOpponent,
  onAddPartner,
  onRemovePartner,
}) {
  const streakColor = p.streak?.startsWith('W') ? '#16a34a' : '#DC2626'
  const [showAllVideos, setShowAllVideos] = useState(false)
  const PREVIEW = 3
  const visibleVideos = showAllVideos ? p.videos : p.videos.slice(0, PREVIEW)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className={styles.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div className={styles.av} style={{ width: 48, height: 48, fontSize: 16, flexShrink: 0 }}>
            {p.init}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
              {p.name}
            </div>

            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {p.club} · {p.state}
            </div>

            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <span className={styles.badgeBlue}>{p.level}</span>
              <span className={styles.badgeGray}>{p.style}</span>

              {p.isOpp && <span className={styles.badgeAmber}>Opponent</span>}
              {isPartner && <span className={styles.badgeGreen}>Partner</span>}
            </div>
          </div>
        </div>

        {p.ig && (
          <div style={{ marginBottom: 14 }}>
            <a
              href={`https://instagram.com/${p.ig.replace('@', '')}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                background: '#FFF0F6',
                border: '1px solid #FBC8DC',
                borderRadius: 20,
                textDecoration: 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="20" height="20" rx="5" stroke="#B5305A" strokeWidth="2" />
                <circle cx="12" cy="12" r="4.5" stroke="#B5305A" strokeWidth="2" />
                <circle cx="17.5" cy="6.5" r="1" fill="#B5305A" />
              </svg>

              <span style={{ fontSize: 11, color: '#B5305A', fontWeight: 600 }}>
                {p.ig}
              </span>
            </a>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Matches', value: p.matches, color: C.text },
            { label: 'Win rate', value: `${p.winRate}%`, color: '#1A5FFF' },
            { label: 'Streak', value: p.streak, color: streakColor },
          ].map(s => (
            <div
              key={s.label}
              style={{
                background: C.soft,
                borderRadius: 10,
                padding: '10px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>
                {s.label}
              </div>

              <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
          <div className={styles.cardTitle}>Skill profile</div>
          <SkillBar name="Smash" val={p.smash} dim={false} />
          <SkillBar name="Footwork" val={p.footwork} dim={false} />
          <SkillBar name="Defense" val={p.defense} dim={false} />
          <SkillBar name="Net play" val={p.net} dim={false} />
          <SkillBar name="Serve" val={p.serve} dim={true} />
          <SkillBar name="Stamina" val={p.stamina} dim={true} />
        </div>
      </div>

      {p.videos.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Match videos</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {visibleVideos.map((v, i) => (
              <VideoRow key={i} video={v} />
            ))}
          </div>

          {p.videos.length > PREVIEW && (
            <button
              onClick={() => setShowAllVideos(prev => !prev)}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '8px',
                fontSize: 12,
                color: '#1A5FFF',
                fontFamily: 'inherit',
                fontWeight: 500,
                background: 'transparent',
                border: `1px solid ${C.line}`,
                borderRadius: 9,
                cursor: 'pointer',
              }}
            >
              {showAllVideos ? 'Show less ↑' : `View all ${p.videos.length} videos ↓`}
            </button>
          )}
        </div>
      )}

      {p.isOpp && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Head-to-head vs you</div>

          <div style={{ display: 'flex', justifyContent: 'space-around', padding: '16px 0', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#00C48C' }}>
                {p.w}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>Your wins</div>
            </div>

            <div style={{ fontSize: 18, fontWeight: 700, color: C.muted, alignSelf: 'center' }}>
              vs
            </div>

            <div>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#EF4444' }}>
                {p.l}
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>Your losses</div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: C.muted }}>
            Last played: {p.last}
          </div>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardTitle}>About</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Club', value: p.club },
            { label: 'Hand', value: p.hand },
            { label: 'Playing since', value: p.since },
            { label: 'Preferred court', value: p.court },
          ].map(item => (
            <SmallInfo key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {isPartner ? (
          <button
            className={styles.btnOutline}
            style={{
              width: '100%',
              color: '#DC2626',
              borderColor: '#FECACA',
              background: '#FEF2F2',
            }}
            onClick={() => onRemovePartner(p.name)}
          >
            Remove partner
          </button>
        ) : (
          <button
            className={styles.btnPrimary}
            style={{ width: '100%' }}
            onClick={() => onAddPartner(p)}
          >
            + Add partner
          </button>
        )}

        {p.isOpp ? (
          <button
            className={styles.btnOutline}
            style={{
              width: '100%',
              color: '#DC2626',
              borderColor: '#FECACA',
              background: '#FEF2F2',
            }}
            onClick={() => onRemoveOpponent(p.name)}
          >
            Remove opponent
          </button>
        ) : (
          <button
            className={styles.btnOutline}
            style={{ width: '100%' }}
            onClick={() => onAddOpponent(p.name)}
          >
            + Add opponent
          </button>
        )}
      </div>
    </div>
  )
}

export default function Players() {
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [styleFilter, setStyleFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [players, setPlayers] = useState(allPlayers)
  const [savedPartners, setSavedPartners] = useState([])

  const [partnerCriteria, setPartnerCriteria] = useState({
    gameType: 'Doubles',
    level: 'Intermediate',
    style: 'Auto',
    state: 'Penang',
    goal: 'Training',
  })

  const pool = players.filter(p => {
    if (tab === 'opp') return p.isOpp

    // Important:
    // All players should still show everyone,
    // even after they are added as opponent.
    return true
  })

  const filtered = pool.filter(p => {
    const mq =
      !search ||
      [p.name, p.club, p.state].some(s =>
        s.toLowerCase().includes(search.toLowerCase())
      )

    return mq && (!levelFilter || p.level === levelFilter) && (!styleFilter || p.style === styleFilter)
  })

  const partnerRecommendations = useMemo(() => {
    return players
      .map(p => {
        const match = getPartnerMatch(p, partnerCriteria)

        return {
          ...p,
          matchScore: match.score,
          reasons: match.reasons,
        }
      })
      .filter(p => p.matchScore >= 45)
      .sort((a, b) => b.matchScore - a.matchScore)
  }, [players, partnerCriteria])

  function handleAddOpponent(name) {
    const found = players.find(p => p.name === name)
    if (!found) return

    const updated = {
      ...found,
      isOpp: true,
      w: found.w ?? 0,
      l: found.l ?? 0,
      last: found.last ?? '—',
    }

    setPlayers(prev => prev.map(p => (p.name === name ? updated : p)))
    setSelected(updated)
    setTab('opp')
  }

  function handleRemoveOpponent(name) {
    const found = players.find(p => p.name === name)
    if (!found) return

    const updated = {
      ...found,
      isOpp: false,
      w: undefined,
      l: undefined,
      last: undefined,
    }

    setPlayers(prev => prev.map(p => (p.name === name ? updated : p)))
    setSelected(updated)
    setTab('all')
  }

  function handleAddPartner(player) {
    setSavedPartners(prev => {
      const exists = prev.some(p => p.name === player.name)
      if (exists) return prev

      return [...prev, player]
    })
  }

  function handleRemovePartner(name) {
    setSavedPartners(prev => prev.filter(p => p.name !== name))
  }

  function isSavedPartner(name) {
    return savedPartners.some(p => p.name === name)
  }

  return (
    <div>
      <div className={styles.pageHead}>
        <div className={styles.pageTitle}>Players & Opponents</div>
        <div className={styles.pageSub}>
          Search players, find suitable partners and review opponent records
        </div>
      </div>

      <div className={styles.tabs} style={{ marginBottom: 16 }}>
        <button
          className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`}
          onClick={() => {
            setTab('all')
            setSelected(null)
          }}
        >
          All players
        </button>

        <button
          className={`${styles.tab} ${tab === 'partner' ? styles.tabActive : ''}`}
          onClick={() => {
            setTab('partner')
            setSelected(null)
          }}
        >
          Find partner
        </button>

        <button
          className={`${styles.tab} ${tab === 'opp' ? styles.tabActive : ''}`}
          onClick={() => {
            setTab('opp')
            setSelected(null)
          }}
        >
          My opponents
        </button>
      </div>

      {tab !== 'partner' && (
        <div className={styles.g2}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                className={styles.formInput}
                style={{ flex: 1, minWidth: 160 }}
                placeholder="Search by name, club or state..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              <select
                className={styles.formSelect}
                style={{ width: 130 }}
                value={levelFilter}
                onChange={e => setLevelFilter(e.target.value)}
              >
                <option value="">All levels</option>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>

              <select
                className={styles.formSelect}
                style={{ width: 130 }}
                value={styleFilter}
                onChange={e => setStyleFilter(e.target.value)}
              >
                <option value="">All styles</option>
                <option>Aggressive</option>
                <option>Defensive</option>
                <option>All-round</option>
                <option>Attacking</option>
              </select>
            </div>

            <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontWeight: 600 }}>
              {filtered.length} player{filtered.length !== 1 ? 's' : ''} found
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.length === 0 && (
                <div
                  className={styles.card}
                  style={{ textAlign: 'center', padding: 40, color: C.muted }}
                >
                  No players match your search.
                </div>
              )}

              {filtered.map((p, i) => {
                const sel = selected?.name === p.name
                const partner = isSavedPartner(p.name)

                return (
                  <div
                    key={i}
                    onClick={() => setSelected(p)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '14px 16px',
                      borderRadius: 16,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: sel ? C.soft : C.card,
                      border: sel ? '2px solid #1A5FFF' : `1.5px solid ${C.line}`,
                    }}
                  >
                    <div className={styles.av}>{p.init}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                        {p.name}
                      </div>

                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {p.club} · {p.state}
                      </div>

                      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <span className={styles.badgeBlue}>{p.level}</span>
                        <span className={styles.badgeGray}>{p.style}</span>

                        {p.isOpp && <span className={styles.badgeAmber}>Opponent</span>}
                        {partner && <span className={styles.badgeGreen}>Partner</span>}
                      </div>
                    </div>

                    {p.isOpp && (
                      <span
                        className={
                          p.w > p.l
                            ? styles.badgeGreen
                            : p.w < p.l
                            ? styles.badgeRed
                            : styles.badgeAmber
                        }
                        style={{ marginRight: 8 }}
                      >
                        H2H {p.w}W {p.l}L
                      </span>
                    )}

                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M5 3l4 4-4 4"
                        stroke={sel ? '#1A5FFF' : '#8892A4'}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            {!selected ? (
              <div
                className={styles.card}
                style={{
                  height: 200,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 8,
                  color: C.muted,
                }}
              >
                <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
                  <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="20" cy="15" r="5" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M8 36c0-6.6 5.4-12 12-12s12 5.4 12 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>

                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  Select a player
                </div>
              </div>
            ) : (
              <PlayerDetail
                key={`${selected.name}-${selected.isOpp}-${isSavedPartner(selected.name)}`}
                p={selected}
                isPartner={isSavedPartner(selected.name)}
                onAddOpponent={handleAddOpponent}
                onRemoveOpponent={handleRemoveOpponent}
                onAddPartner={handleAddPartner}
                onRemovePartner={handleRemovePartner}
              />
            )}
          </div>
        </div>
      )}

      {tab === 'partner' && (
        <div className={styles.g2}>
          <div>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Find suitable partner</div>

              <FormSelect
                label="Game type"
                value={partnerCriteria.gameType}
                onChange={value => setPartnerCriteria(prev => ({ ...prev, gameType: value }))}
                options={['Singles', 'Doubles', 'Mixed Doubles']}
              />

              <FormSelect
                label="Preferred level"
                value={partnerCriteria.level}
                onChange={value => setPartnerCriteria(prev => ({ ...prev, level: value }))}
                options={['Any', 'Beginner', 'Intermediate', 'Advanced']}
              />

              <FormSelect
                label="Preferred style"
                value={partnerCriteria.style}
                onChange={value => setPartnerCriteria(prev => ({ ...prev, style: value }))}
                options={['Auto', 'Any', 'Aggressive', 'Defensive', 'All-round', 'Attacking']}
              />

              <FormSelect
                label="State"
                value={partnerCriteria.state}
                onChange={value => setPartnerCriteria(prev => ({ ...prev, state: value }))}
                options={['Any', 'Penang', 'Selangor', 'Kuala Lumpur', 'Johor']}
              />

              <FormSelect
                label="Goal"
                value={partnerCriteria.goal}
                onChange={value => setPartnerCriteria(prev => ({ ...prev, goal: value }))}
                options={['Casual', 'Training', 'Tournament']}
              />

              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  background: '#F0F5FF',
                  borderRadius: 12,
                  fontSize: 12,
                  color: C.text,
                  lineHeight: 1.7,
                }}
              >
                <strong>Your profile used for matching</strong>
                <br />
                Level: {CURRENT_PLAYER.level}
                <br />
                Style: {CURRENT_PLAYER.style}
                <br />
                State: {CURRENT_PLAYER.state}
                <br />
                Weakness: {CURRENT_PLAYER.weakness}
              </div>
            </div>

            <div className={styles.card} style={{ marginTop: 12 }}>
              <div className={styles.cardTitle}>Saved partners</div>

              {savedPartners.length === 0 && (
                <div style={{ fontSize: 13, color: C.muted }}>
                  No saved partners yet.
                </div>
              )}

              {savedPartners.map(p => (
                <div key={p.name} className={styles.listRow}>
                  <div className={styles.av}>{p.init}</div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                      {p.name}
                    </div>

                    <div style={{ fontSize: 11, color: C.muted }}>
                      {p.club} · {p.level} · {p.style}
                    </div>
                  </div>

                  <button
                    className={styles.btnOutline}
                    style={{
                      fontSize: 11,
                      padding: '5px 10px',
                      color: '#DC2626',
                      borderColor: '#FECACA',
                      background: '#FEF2F2',
                    }}
                    onClick={() => handleRemovePartner(p.name)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Recommended partners</div>

            {partnerRecommendations.length === 0 && (
              <div style={{ fontSize: 13, color: C.muted }}>
                No suitable partners found. Try changing the filters.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {partnerRecommendations.map(p => {
                const saved = isSavedPartner(p.name)

                return (
                  <div
                    key={p.name}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '44px 1fr 76px 110px',
                      gap: 12,
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: `1px solid ${C.line}`,
                    }}
                  >
                    <div className={styles.av}>{p.init}</div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                        {p.name}
                      </div>

                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {p.club} · {p.state}
                      </div>

                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
                        <span className={styles.badgeBlue}>{p.level}</span>
                        <span className={styles.badgeGray}>{p.style}</span>

                        {p.reasons.map(reason => (
                          <span key={reason} className={styles.badgeAmber}>
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: C.muted }}>
                        Match
                      </div>

                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 900,
                          color: p.matchScore >= 75 ? '#00976C' : '#1A5FFF',
                        }}
                      >
                        {p.matchScore}%
                      </div>
                    </div>

                    {saved ? (
                      <button
                        className={styles.btnOutline}
                        style={{
                          color: '#DC2626',
                          borderColor: '#FECACA',
                          background: '#FEF2F2',
                        }}
                        onClick={() => handleRemovePartner(p.name)}
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        className={styles.btnPrimary}
                        onClick={() => handleAddPartner(p)}
                      >
                        Save
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}