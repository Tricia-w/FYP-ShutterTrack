import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Pages.module.css'

// ── Mock data ────────────────────────────────────────────────────────────────

const ALL_PLAYERS = [
  { id: 1, name: 'Adeline',    club: 'Penang BC',    level: 'Advanced',     style: 'Aggressive', smash: 82, defense: 70, footwork: 78, net: 72, serve: 68, stamina: 75, assigned: true  },
  { id: 2, name: 'Yee En', club: 'Seberang BC',  level: 'Intermediate', style: 'Defensive',  smash: 65, defense: 80, footwork: 70, net: 76, serve: 64, stamina: 68, assigned: true  },
  { id: 3, name: 'JetHow', club: 'Penang BC',    level: 'Advanced',     style: 'All-round',  smash: 78, defense: 75, footwork: 80, net: 74, serve: 72, stamina: 80, assigned: true  },
  { id: 4, name: 'Syafiq Yusuf',   club: 'USM BC',       level: 'Intermediate', style: 'Attacking',  smash: 74, defense: 60, footwork: 68, net: 62, serve: 60, stamina: 64, assigned: false },
  { id: 5, name: 'Farid Noor',     club: 'Penang BC',    level: 'Beginner',     style: 'Defensive',  smash: 50, defense: 65, footwork: 55, net: 58, serve: 52, stamina: 60, assigned: false },
  { id: 6, name: 'Hafiz Rahman',   club: 'Kedah BC',     level: 'Advanced',     style: 'Aggressive', smash: 88, defense: 68, footwork: 82, net: 70, serve: 74, stamina: 78, assigned: false },
  { id: 7, name: 'Nurul Izzah',    club: 'KL Badminton', level: 'Intermediate', style: 'Defensive',  smash: 60, defense: 84, footwork: 70, net: 78, serve: 66, stamina: 72, assigned: false },
]

const INIT_SESSIONS = [
  { id: 1, date: '2026-05-05', time: '07:00', venue: 'Dewan Sukan USM', type: 'Footwork Drills', players: [1, 2, 3], notes: 'Focus on back court movement' },
  { id: 2, date: '2026-05-07', time: '18:00', venue: 'Kompleks Sukan',  type: 'Match Practice',  players: [1, 3],    notes: 'Singles practice sets' },
  { id: 3, date: '2026-05-10', time: '07:00', venue: 'Dewan Sukan USM', type: 'Smash Training',  players: [1, 2, 3], notes: 'Jump smash technique' },
]

const INIT_NOTES = [
  { id: 1, playerId: 1, date: '28 Apr', text: 'Adeline shows great improvement in back court smash. Needs to work on net play consistency.' },
  { id: 2, playerId: 2, date: '25 Apr', text: 'Yee En defense is solid. Encourage more aggressive attacking opportunities.' },
  { id: 3, playerId: 3, date: '22 Apr', text: 'JetHow is the most balanced player. Ready to compete at state level.' },
]

const SESSION_TYPES = [
  'Footwork Drills',
  'Smash Training',
  'Defense Drills',
  'Match Practice',
  'Net Play',
  'Fitness & Conditioning',
  'Strategy Session',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function averageSkill(player) {
  return Math.round(
    (
      player.smash +
      player.footwork +
      player.defense +
      player.net +
      player.serve +
      player.stamina
    ) / 6
  )
}

function getSkillList(player) {
  return [
    { label: 'Smash', val: player.smash },
    { label: 'Footwork', val: player.footwork },
    { label: 'Defense', val: player.defense },
    { label: 'Net play', val: player.net },
    { label: 'Serve', val: player.serve },
    { label: 'Stamina', val: player.stamina },
  ]
}

function SkillBar({ label, val, color = '#1A5FFF' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: '#8892A4', width: 64, flexShrink: 0 }}>
        {label}
      </span>

      <div style={{ flex: 1, height: 5, background: '#EEF1F8', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            width: `${val}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
            transition: 'width 0.6s ease',
          }}
        />
      </div>

      <span style={{ fontSize: 11, fontWeight: 700, color: '#0D1B3E', width: 24, textAlign: 'right' }}>
        {val}
      </span>
    </div>
  )
}

function Avatar({ name, size = 36, bg = '#E8EFFE', color = '#1A5FFF' }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.33,
        fontWeight: 700,
        color,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  )
}

function LevelBadge({ level }) {
  const map = {
    Advanced: { bg: '#E8EFFE', color: '#1A5FFF' },
    Intermediate: { bg: '#E0FAF3', color: '#00976C' },
    Beginner: { bg: '#FEF3C7', color: '#92400E' },
  }

  const s = map[level] || map.Beginner

  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 20,
      }}
    >
      {level}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Coach({ page = 'dashboard' }) {
  const navigate = useNavigate()

  const [players, setPlayers] = useState(ALL_PLAYERS)
  const [sessions, setSessions] = useState(INIT_SESSIONS)
  const [notes, setNotes] = useState(INIT_NOTES)

  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [playerSearch, setPlayerSearch] = useState('')
  const [showAddSession, setShowAddSession] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [noteText, setNoteText] = useState('')

  const [sessionForm, setSessionForm] = useState({
    date: '',
    time: '',
    venue: '',
    type: SESSION_TYPES[0],
    players: [],
    notes: '',
  })

  const activePage = ['dashboard', 'players', 'sessions', 'progress'].includes(page)
    ? page
    : 'dashboard'

  const myPlayers = players.filter(p => p.assigned)

  const searchResults = players.filter(p =>
    !p.assigned &&
    (
      p.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
      p.club.toLowerCase().includes(playerSearch.toLowerCase())
    )
  )

  const upcomingSessions = sessions
    .filter(s => new Date(s.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const pastSessions = sessions
    .filter(s => new Date(s.date) < new Date())
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  const playerNotes = selectedPlayer
    ? notes.filter(n => n.playerId === selectedPlayer.id)
    : []

  const addToTeam = (playerId) => {
    setPlayers(prev =>
      prev.map(p => p.id === playerId ? { ...p, assigned: true } : p)
    )

    setPlayerSearch('')
    setShowSearch(false)
  }

  const removeFromTeam = (playerId) => {
    setPlayers(prev =>
      prev.map(p => p.id === playerId ? { ...p, assigned: false } : p)
    )

    if (selectedPlayer?.id === playerId) {
      setSelectedPlayer(null)
    }
  }

  const addNote = () => {
    if (!noteText.trim() || !selectedPlayer) return

    setNotes(prev => [
      {
        id: Date.now(),
        playerId: selectedPlayer.id,
        date: new Date().toLocaleDateString('en-MY', {
          day: 'numeric',
          month: 'short',
        }),
        text: noteText,
      },
      ...prev,
    ])

    setNoteText('')
    setShowAddNote(false)
  }

  const addSession = () => {
    if (!sessionForm.date || !sessionForm.venue) return

    setSessions(prev => [
      {
        id: Date.now(),
        ...sessionForm,
      },
      ...prev,
    ])

    setSessionForm({
      date: '',
      time: '',
      venue: '',
      type: SESSION_TYPES[0],
      players: [],
      notes: '',
    })

    setShowAddSession(false)
  }

  const toggleSessionPlayer = (id) => {
    setSessionForm(f => ({
      ...f,
      players: f.players.includes(id)
        ? f.players.filter(p => p !== id)
        : [...f.players, id],
    }))
  }

  const openFindPlayer = () => {
    navigate('/coach/players')
    setShowSearch(true)
  }

  const openAddSession = () => {
    navigate('/coach/sessions')
    setShowAddSession(true)
  }

  return (
    <div>

      {/* Header */}
      <div className={styles.pageHead}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className={styles.pageTitle}>
              {activePage === 'dashboard' && 'Coach Dashboard'}
              {activePage === 'players' && 'My Players'}
              {activePage === 'sessions' && 'Training Sessions'}
              {activePage === 'progress' && 'Player Progress'}
            </div>

            <div className={styles.pageSub}>
              Manage your players, sessions and track progress
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.btnOutline} onClick={openFindPlayer}>
              Find player
            </button>

            <button className={styles.btnPrimary} onClick={openAddSession}>
              Add session
            </button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className={styles.g4} style={{ marginBottom: 16 }}>
        {[
          { label: 'My players', val: myPlayers.length, color: '#1A5FFF', bg: '#E8EFFE' },
          { label: 'Upcoming sessions', val: upcomingSessions.length, color: '#00976C', bg: '#E0FAF3' },
          { label: 'Past sessions', val: pastSessions.length, color: '#F59E0B', bg: '#FEF3C7' },
          { label: 'Total notes', val: notes.length, color: '#7C3AED', bg: '#EDE9FE' },
        ].map((m, i) => (
          <div key={i} className={styles.metric}>
            <div className={styles.metricIcon} style={{ background: m.bg }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
            </div>

            <div className={styles.metricVal} style={{ color: m.color }}>
              {m.val}
            </div>

            <div className={styles.metricLbl}>
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Dashboard page */}
      {activePage === 'dashboard' && (
        <div className={styles.g2}>

          <div className={styles.card}>
            <div className={styles.cardTitle}>My players overview</div>

            {myPlayers.map(p => {
              const avg = averageSkill(p)

              return (
                <div key={p.id} className={styles.listRow}>
                  <Avatar name={p.name} />

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
                      {p.name}
                    </div>

                    <div style={{ fontSize: 11, color: '#8892A4', marginTop: 2 }}>
                      {p.club} · {p.style}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#8892A4' }}>Avg</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: avg >= 75 ? '#00976C' : '#1A5FFF' }}>
                      {avg}
                    </div>
                  </div>
                </div>
              )
            })}

            <button
              className={styles.btnOutline}
              style={{ marginTop: 12 }}
              onClick={() => navigate('/coach/players')}
            >
              View all players →
            </button>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Upcoming sessions</div>

            {upcomingSessions.length === 0 && (
              <div style={{ fontSize: 13, color: '#8892A4', padding: '20px 0' }}>
                No upcoming sessions.
              </div>
            )}

            {upcomingSessions.slice(0, 3).map(s => (
              <div key={s.id} className={styles.listRow} style={{ alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: '#E8EFFE',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1A5FFF', lineHeight: 1 }}>
                    {new Date(s.date).getDate()}
                  </div>

                  <div style={{ fontSize: 9, fontWeight: 600, color: '#1A5FFF', textTransform: 'uppercase' }}>
                    {new Date(s.date).toLocaleDateString('en-MY', { month: 'short' })}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
                    {s.type}
                  </div>

                  <div style={{ fontSize: 12, color: '#8892A4', marginTop: 2 }}>
                    {s.venue} · {s.time}
                  </div>

                  <div style={{ fontSize: 11, color: '#8892A4', marginTop: 4 }}>
                    {s.players
                      .map(id => players.find(p => p.id === id)?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                </div>
              </div>
            ))}

            <button
              className={styles.btnOutline}
              style={{ marginTop: 12 }}
              onClick={() => navigate('/coach/sessions')}
            >
              View sessions →
            </button>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Recent coach notes</div>

            {notes.slice(0, 3).map(n => {
              const player = players.find(p => p.id === n.playerId)

              return (
                <div
                  key={n.id}
                  style={{
                    padding: '10px 12px',
                    background: '#F7F9FF',
                    borderRadius: 10,
                    marginBottom: 8,
                    borderLeft: '3px solid #1A5FFF',
                  }}
                >
                  <div style={{ fontSize: 11, color: '#8892A4', marginBottom: 4 }}>
                    {player?.name} · {n.date}
                  </div>

                  <div style={{ fontSize: 13, color: '#0D1B3E', lineHeight: 1.6 }}>
                    {n.text}
                  </div>
                </div>
              )
            })}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Team focus</div>

            {myPlayers.map(p => {
              const sorted = getSkillList(p).sort((a, b) => a.val - b.val)
              const weakest = sorted[0]

              return (
                <div key={p.id} className={styles.listRow}>
                  <Avatar name={p.name} size={32} />

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
                      {p.name}
                    </div>

                    <div style={{ fontSize: 12, color: '#8892A4' }}>
                      Needs work: <strong>{weakest.label}</strong> ({weakest.val})
                    </div>
                  </div>
                </div>
              )
            })}

            <button
              className={styles.btnOutline}
              style={{ marginTop: 12 }}
              onClick={() => navigate('/coach/progress')}
            >
              View progress →
            </button>
          </div>

        </div>
      )}

      {/* My Players page */}
      {activePage === 'players' && (
        <div className={styles.g2}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

            {showSearch && (
              <div className={styles.card} style={{ padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E', marginBottom: 10 }}>
                  Search all players
                </div>

                <input
                  className={styles.formInput}
                  placeholder='Search by name or club...'
                  value={playerSearch}
                  onChange={e => setPlayerSearch(e.target.value)}
                  autoFocus
                />

                {playerSearch && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {searchResults.length === 0 && (
                      <div style={{ fontSize: 12, color: '#8892A4', padding: '8px 0' }}>
                        No players found.
                      </div>
                    )}

                    {searchResults.map(p => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          background: '#F7F9FF',
                          borderRadius: 10,
                        }}
                      >
                        <Avatar name={p.name} size={32} />

                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3E' }}>
                            {p.name}
                          </div>

                          <div style={{ fontSize: 11, color: '#8892A4' }}>
                            {p.club} · <LevelBadge level={p.level} />
                          </div>
                        </div>

                        <button
                          className={styles.btnPrimary}
                          style={{ fontSize: 11, padding: '4px 12px' }}
                          onClick={() => addToTeam(p.id)}
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  className={styles.btnOutline}
                  style={{ marginTop: 10, fontSize: 12, width: '100%' }}
                  onClick={() => {
                    setShowSearch(false)
                    setPlayerSearch('')
                  }}
                >
                  Close
                </button>
              </div>
            )}

            {myPlayers.length === 0 && (
              <div className={styles.card} style={{ textAlign: 'center', padding: 40, color: '#8892A4' }}>
                No players assigned yet. Use "Find player" to add players to your team.
              </div>
            )}

            {myPlayers.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedPlayer(selectedPlayer?.id === p.id ? null : p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: selectedPlayer?.id === p.id ? '#E8EFFE' : '#fff',
                  border: selectedPlayer?.id === p.id ? '2px solid #1A5FFF' : '1.5px solid #EEF1F8',
                  transition: 'all 0.15s',
                }}
              >
                <Avatar name={p.name} />

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
                    {p.name}
                  </div>

                  <div style={{ fontSize: 11, color: '#8892A4', marginTop: 2 }}>
                    {p.club}
                  </div>

                  <div style={{ marginTop: 5, display: 'flex', gap: 4 }}>
                    <LevelBadge level={p.level} />

                    <span
                      style={{
                        fontSize: 10,
                        background: '#F3F4F6',
                        color: '#6B7280',
                        padding: '2px 8px',
                        borderRadius: 20,
                        fontWeight: 600,
                      }}
                    >
                      {p.style}
                    </span>
                  </div>
                </div>

                <button
                  onClick={e => {
                    e.stopPropagation()
                    removeFromTeam(p.id)
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
                  flexDirection: 'column',
                  gap: 8,
                  color: '#8892A4',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  Select a player
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                <div className={styles.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <Avatar name={selectedPlayer.name} size={44} />

                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0D1B3E' }}>
                        {selectedPlayer.name}
                      </div>

                      <div style={{ fontSize: 12, color: '#8892A4' }}>
                        {selectedPlayer.club}
                      </div>

                      <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
                        <LevelBadge level={selectedPlayer.level} />

                        <span
                          style={{
                            fontSize: 10,
                            background: '#F3F4F6',
                            color: '#6B7280',
                            padding: '2px 8px',
                            borderRadius: 20,
                            fontWeight: 600,
                          }}
                        >
                          {selectedPlayer.style}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardTitle}>Skill profile</div>

                  <SkillBar label='Smash' val={selectedPlayer.smash} />
                  <SkillBar label='Footwork' val={selectedPlayer.footwork} />
                  <SkillBar label='Defense' val={selectedPlayer.defense} />
                  <SkillBar label='Net play' val={selectedPlayer.net} />
                  <SkillBar label='Serve' val={selectedPlayer.serve} color='#00C48C' />
                  <SkillBar label='Stamina' val={selectedPlayer.stamina} color='#F59E0B' />
                </div>

                <div className={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div className={styles.cardTitle}>Coach notes</div>

                    <button
                      className={styles.btnPrimary}
                      style={{ fontSize: 11, padding: '5px 12px' }}
                      onClick={() => setShowAddNote(true)}
                    >
                      + Add note
                    </button>
                  </div>

                  {showAddNote && (
                    <div style={{ marginBottom: 12 }}>
                      <textarea
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder='Write your note here...'
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          border: '1.5px solid #EEF1F8',
                          borderRadius: 10,
                          fontSize: 13,
                          resize: 'vertical',
                          outline: 'none',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                          color: '#0D1B3E',
                        }}
                      />

                      <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                        <button
                          className={styles.btnOutline}
                          style={{ fontSize: 12 }}
                          onClick={() => {
                            setShowAddNote(false)
                            setNoteText('')
                          }}
                        >
                          Cancel
                        </button>

                        <button
                          className={styles.btnPrimary}
                          style={{ fontSize: 12 }}
                          onClick={addNote}
                        >
                          Save note
                        </button>
                      </div>
                    </div>
                  )}

                  {playerNotes.length === 0 && !showAddNote && (
                    <div style={{ fontSize: 13, color: '#8892A4', textAlign: 'center', padding: '16px 0' }}>
                      No notes yet for this player.
                    </div>
                  )}

                  {playerNotes.map(n => (
                    <div
                      key={n.id}
                      style={{
                        padding: '10px 12px',
                        background: '#F7F9FF',
                        borderRadius: 10,
                        marginBottom: 8,
                        borderLeft: '3px solid #1A5FFF',
                      }}
                    >
                      <div style={{ fontSize: 11, color: '#8892A4', marginBottom: 4 }}>
                        {n.date}
                      </div>

                      <div style={{ fontSize: 13, color: '#0D1B3E', lineHeight: 1.6 }}>
                        {n.text}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* Sessions page */}
      {activePage === 'sessions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Upcoming sessions</div>

            {upcomingSessions.length === 0 && (
              <div style={{ fontSize: 13, color: '#8892A4', textAlign: 'center', padding: '20px 0' }}>
                No upcoming sessions. Click "Add session" to schedule one.
              </div>
            )}

            {upcomingSessions.map(s => (
              <div key={s.id} className={styles.listRow} style={{ alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: '#E8EFFE',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1A5FFF', lineHeight: 1 }}>
                    {new Date(s.date).getDate()}
                  </div>

                  <div style={{ fontSize: 9, fontWeight: 600, color: '#1A5FFF', textTransform: 'uppercase' }}>
                    {new Date(s.date).toLocaleDateString('en-MY', { month: 'short' })}
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
                    {s.type}
                  </div>

                  <div style={{ fontSize: 12, color: '#8892A4', marginTop: 2 }}>
                    {s.venue} · {s.time}
                  </div>

                  <div style={{ fontSize: 11, color: '#8892A4', marginTop: 4 }}>
                    {s.players
                      .map(id => players.find(p => p.id === id)?.name)
                      .filter(Boolean)
                      .join(', ')}
                  </div>

                  {s.notes && (
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4, fontStyle: 'italic' }}>
                      {s.notes}
                    </div>
                  )}
                </div>

                <span
                  style={{
                    background: '#E0FAF3',
                    color: '#00976C',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 20,
                    flexShrink: 0,
                  }}
                >
                  Upcoming
                </span>
              </div>
            ))}
          </div>

          {pastSessions.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Past sessions</div>

              {pastSessions.map(s => (
                <div key={s.id} className={styles.listRow} style={{ alignItems: 'flex-start', paddingTop: 12, paddingBottom: 12, opacity: 0.7 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: '#F3F4F6',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#6B7280', lineHeight: 1 }}>
                      {new Date(s.date).getDate()}
                    </div>

                    <div style={{ fontSize: 9, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase' }}>
                      {new Date(s.date).toLocaleDateString('en-MY', { month: 'short' })}
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
                      {s.type}
                    </div>

                    <div style={{ fontSize: 12, color: '#8892A4', marginTop: 2 }}>
                      {s.venue} · {s.time}
                    </div>

                    <div style={{ fontSize: 11, color: '#8892A4', marginTop: 4 }}>
                      {s.players
                        .map(id => players.find(p => p.id === id)?.name)
                        .filter(Boolean)
                        .join(', ')}
                    </div>
                  </div>

                  <span
                    style={{
                      background: '#F3F4F6',
                      color: '#6B7280',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 20,
                      flexShrink: 0,
                    }}
                  >
                    Done
                  </span>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* Progress page */}
      {activePage === 'progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Team skill overview</div>

            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Smash</th>
                    <th>Footwork</th>
                    <th>Defense</th>
                    <th>Net play</th>
                    <th>Serve</th>
                    <th>Stamina</th>
                    <th>Avg</th>
                  </tr>
                </thead>

                <tbody>
                  {myPlayers.map(p => {
                    const avg = averageSkill(p)

                    return (
                      <tr key={p.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar name={p.name} size={28} />

                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#0D1B3E' }}>
                                {p.name}
                              </div>

                              <LevelBadge level={p.level} />
                            </div>
                          </div>
                        </td>

                        {[p.smash, p.footwork, p.defense, p.net, p.serve, p.stamina].map((val, i) => (
                          <td key={i}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ width: 32, height: 4, background: '#EEF1F8', borderRadius: 2, overflow: 'hidden' }}>
                                <div
                                  style={{
                                    width: `${val}%`,
                                    height: '100%',
                                    background: val >= 75 ? '#00C48C' : val >= 60 ? '#1A5FFF' : '#F59E0B',
                                    borderRadius: 2,
                                  }}
                                />
                              </div>

                              <span style={{ fontSize: 12, fontWeight: 600, color: '#0D1B3E' }}>
                                {val}
                              </span>
                            </div>
                          </td>
                        ))}

                        <td>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: avg >= 75 ? '#00976C' : avg >= 60 ? '#1A5FFF' : '#F59E0B',
                            }}
                          >
                            {avg}
                          </span>
                        </td>
                      </tr>
                    )
                  })}

                  {myPlayers.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#8892A4' }}>
                        No players in your team yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.g2}>
            {myPlayers.map(p => {
              const avg = averageSkill(p)
              const strongest = getSkillList(p).sort((a, b) => b.val - a.val)

              return (
                <div key={p.id} className={styles.card}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Avatar name={p.name} size={38} />

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
                        {p.name}
                      </div>

                      <LevelBadge level={p.level} />
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 10, color: '#8892A4' }}>
                        Overall
                      </div>

                      <div
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          color: avg >= 75 ? '#00976C' : avg >= 60 ? '#1A5FFF' : '#F59E0B',
                        }}
                      >
                        {avg}
                      </div>
                    </div>
                  </div>

                  <SkillBar label='Smash' val={p.smash} />
                  <SkillBar label='Footwork' val={p.footwork} />
                  <SkillBar label='Defense' val={p.defense} />
                  <SkillBar label='Net play' val={p.net} />
                  <SkillBar label='Serve' val={p.serve} color='#00C48C' />
                  <SkillBar label='Stamina' val={p.stamina} color='#F59E0B' />

                  <div
                    style={{
                      marginTop: 10,
                      padding: '8px 10px',
                      background: '#F7F9FF',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#0D1B3E',
                    }}
                  >
                    💪 Strongest: <strong>{strongest[0].label}</strong> ({strongest[0].val}) · Needs work: <strong>{strongest[strongest.length - 1].label}</strong> ({strongest[strongest.length - 1].val})
                  </div>
                </div>
              )
            })}
          </div>

        </div>
      )}

      {/* Add session modal */}
      {showAddSession && (
        <div
          className={styles.modalOverlay}
          onClick={e => e.target === e.currentTarget && setShowAddSession(false)}
        >
          <div className={styles.modal} style={{ maxWidth: 520 }}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Add training session</div>

              <button
                className={styles.modalClose}
                onClick={() => setShowAddSession(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Date</label>

                <input
                  className={styles.formInput}
                  type='date'
                  value={sessionForm.date}
                  onChange={e => setSessionForm(f => ({ ...f, date: e.target.value }))}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Time</label>

                <input
                  className={styles.formInput}
                  type='time'
                  value={sessionForm.time}
                  onChange={e => setSessionForm(f => ({ ...f, time: e.target.value }))}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Venue</label>

              <input
                className={styles.formInput}
                placeholder='e.g. Dewan Sukan USM'
                value={sessionForm.venue}
                onChange={e => setSessionForm(f => ({ ...f, venue: e.target.value }))}
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Session type</label>

              <select
                className={styles.formSelect}
                value={sessionForm.type}
                onChange={e => setSessionForm(f => ({ ...f, type: e.target.value }))}
              >
                {SESSION_TYPES.map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Players attending</label>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {myPlayers.map(p => (
                  <div
                    key={p.id}
                    onClick={() => toggleSessionPlayer(p.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      background: sessionForm.players.includes(p.id) ? '#1A5FFF' : '#EEF1F8',
                      color: sessionForm.players.includes(p.id) ? '#fff' : '#8892A4',
                    }}
                  >
                    {p.name.split(' ')[0]}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Notes optional</label>

              <input
                className={styles.formInput}
                placeholder='e.g. Focus on back court movement'
                value={sessionForm.notes}
                onChange={e => setSessionForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button
                className={styles.btnOutline}
                onClick={() => setShowAddSession(false)}
              >
                Cancel
              </button>

              <button
                className={styles.btnPrimary}
                onClick={addSession}
              >
                Save session
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}