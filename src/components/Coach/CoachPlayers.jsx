import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styles from '../Pages.module.css'
import { useCoach } from './CoachContext'
import {
  Avatar,
  CoachPageHeader,
  CoachStats,
  LevelBadge,
  SkillBar,
} from './CoachShared'

export default function CoachPlayers() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    players,
    notes,
    myPlayers,
    upcomingSessions,
    pastSessions,
    addToTeam,
    removeFromTeam,
    addCoachNote,
  } = useCoach()

  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [playerSearch, setPlayerSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [noteText, setNoteText] = useState('')

  useEffect(() => {
    if (searchParams.get('find') === '1') {
      setShowSearch(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const searchResults = useMemo(
    () =>
      players.filter(
        player =>
          !player.assigned &&
          (
            player.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
            player.club.toLowerCase().includes(playerSearch.toLowerCase())
          )
      ),
    [players, playerSearch]
  )

  const playerNotes = selectedPlayer
    ? notes.filter(note => note.playerId === selectedPlayer.id)
    : []

  const handleRemove = playerId => {
    removeFromTeam(playerId)

    if (selectedPlayer?.id === playerId) {
      setSelectedPlayer(null)
    }
  }

  const handleSaveNote = () => {
    if (!selectedPlayer) return

    const saved = addCoachNote(selectedPlayer.id, noteText)

    if (saved) {
      setNoteText('')
      setShowAddNote(false)
    }
  }

  return (
    <div>
      <CoachPageHeader
        title="My Players"
        subtitle="Manage your players and write progress notes"
      />

      <CoachStats
        myPlayers={myPlayers}
        upcomingSessions={upcomingSessions}
        pastSessions={pastSessions}
        notes={notes}
      />

      <div className={styles.g2}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {showSearch && (
            <div className={styles.card} style={{ padding: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#0D1B3E',
                  marginBottom: 10,
                }}
              >
                Search all players
              </div>

              <input
                className={styles.formInput}
                placeholder="Search by name or club..."
                value={playerSearch}
                onChange={event => setPlayerSearch(event.target.value)}
                autoFocus
              />

              {playerSearch && (
                <div
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {searchResults.length === 0 && (
                    <div style={{ fontSize: 12, color: '#8892A4', padding: '8px 0' }}>
                      No players found.
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
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B3E' }}>
                          {player.name}
                        </div>

                        <div style={{ fontSize: 11, color: '#8892A4' }}>
                          {player.club}
                        </div>
                      </div>

                      <LevelBadge level={player.level} />

                      <button
                        className={styles.btnPrimary}
                        style={{ fontSize: 11, padding: '4px 12px' }}
                        onClick={() => {
                          addToTeam(player.id)
                          setPlayerSearch('')
                          setShowSearch(false)
                        }}
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
            <div
              className={styles.card}
              style={{ textAlign: 'center', padding: 40, color: '#8892A4' }}
            >
              No players assigned yet. Use "Find player" to add players.
            </div>
          )}

          {myPlayers.map(player => (
            <div
              key={player.id}
              onClick={() =>
                setSelectedPlayer(
                  selectedPlayer?.id === player.id ? null : player
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
                  selectedPlayer?.id === player.id ? '#E8EFFE' : '#fff',
                border:
                  selectedPlayer?.id === player.id
                    ? '2px solid #1A5FFF'
                    : '1.5px solid #EEF1F8',
                transition: 'all 0.15s',
              }}
            >
              <Avatar name={player.name} />

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
                  {player.name}
                </div>

                <div style={{ fontSize: 11, color: '#8892A4', marginTop: 2 }}>
                  {player.club}
                </div>

                <div style={{ marginTop: 5, display: 'flex', gap: 4 }}>
                  <LevelBadge level={player.level} />

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
                    {player.style}
                  </span>
                </div>
              </div>

              <button
                onClick={event => {
                  event.stopPropagation()
                  handleRemove(player.id)
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

                <SkillBar label="Smash" val={selectedPlayer.smash} />
                <SkillBar label="Footwork" val={selectedPlayer.footwork} />
                <SkillBar label="Defense" val={selectedPlayer.defense} />
                <SkillBar label="Net play" val={selectedPlayer.net} />
                <SkillBar label="Serve" val={selectedPlayer.serve} color="#00C48C" />
                <SkillBar label="Stamina" val={selectedPlayer.stamina} color="#F59E0B" />
              </div>

              <div className={styles.card}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 12,
                  }}
                >
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
                      onChange={event => setNoteText(event.target.value)}
                      placeholder="Write your note here..."
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

                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        marginTop: 8,
                        justifyContent: 'flex-end',
                      }}
                    >
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
                        onClick={handleSaveNote}
                      >
                        Save note
                      </button>
                    </div>
                  </div>
                )}

                {playerNotes.length === 0 && !showAddNote && (
                  <div
                    style={{
                      fontSize: 13,
                      color: '#8892A4',
                      textAlign: 'center',
                      padding: '16px 0',
                    }}
                  >
                    No notes yet for this player.
                  </div>
                )}

                {playerNotes.map(note => (
                  <div
                    key={note.id}
                    style={{
                      padding: '10px 12px',
                      background: '#F7F9FF',
                      borderRadius: 10,
                      marginBottom: 8,
                      borderLeft: '3px solid #1A5FFF',
                    }}
                  >
                    <div style={{ fontSize: 11, color: '#8892A4', marginBottom: 4 }}>
                      {note.date}
                    </div>

                    <div style={{ fontSize: 13, color: '#0D1B3E', lineHeight: 1.6 }}>
                      {note.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
