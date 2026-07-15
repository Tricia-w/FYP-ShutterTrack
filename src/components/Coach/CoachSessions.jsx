import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import styles from '../Pages.module.css'
import { useCoach } from './CoachContext'
import {
  CoachPageHeader,
  CoachStats,
} from './CoachShared'

const emptyForm = sessionTypes => ({
  date: '',
  time: '',
  venue: '',
  type: sessionTypes[0],
  players: [],
  notes: '',
})

export default function CoachSessions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    players,
    notes,
    myPlayers,
    upcomingSessions,
    pastSessions,
    sessionTypes,
    addSession,
  } = useCoach()

  const [showAddSession, setShowAddSession] = useState(false)
  const [sessionForm, setSessionForm] = useState(() =>
    emptyForm(sessionTypes)
  )

  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setShowAddSession(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const toggleSessionPlayer = playerId => {
    setSessionForm(current => ({
      ...current,
      players: current.players.includes(playerId)
        ? current.players.filter(id => id !== playerId)
        : [...current.players, playerId],
    }))
  }

  const handleSave = () => {
    const saved = addSession(sessionForm)

    if (saved) {
      setSessionForm(emptyForm(sessionTypes))
      setShowAddSession(false)
    }
  }

  const renderSession = (session, status) => (
    <div
      key={session.id}
      className={styles.listRow}
      style={{
        alignItems: 'flex-start',
        paddingTop: 12,
        paddingBottom: 12,
        opacity: status === 'Done' ? 0.72 : 1,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: status === 'Done' ? '#F3F4F6' : '#E8EFFE',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: status === 'Done' ? '#6B7280' : '#1A5FFF',
            lineHeight: 1,
          }}
        >
          {new Date(session.date).getDate()}
        </div>

        <div
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: status === 'Done' ? '#6B7280' : '#1A5FFF',
            textTransform: 'uppercase',
          }}
        >
          {new Date(session.date).toLocaleDateString('en-MY', {
            month: 'short',
          })}
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
          {session.type}
        </div>

        <div style={{ fontSize: 12, color: '#8892A4', marginTop: 2 }}>
          {session.venue} · {session.time}
        </div>

        <div style={{ fontSize: 11, color: '#8892A4', marginTop: 4 }}>
          {session.players
            .map(id => players.find(player => player.id === id)?.name)
            .filter(Boolean)
            .join(', ')}
        </div>

        {session.notes && (
          <div
            style={{
              fontSize: 12,
              color: '#6B7280',
              marginTop: 4,
              fontStyle: 'italic',
            }}
          >
            {session.notes}
          </div>
        )}
      </div>

      <span
        style={{
          background: status === 'Done' ? '#F3F4F6' : '#E0FAF3',
          color: status === 'Done' ? '#6B7280' : '#00976C',
          fontSize: 10,
          fontWeight: 700,
          padding: '3px 10px',
          borderRadius: 20,
          flexShrink: 0,
        }}
      >
        {status}
      </span>
    </div>
  )

  return (
    <div>
      <CoachPageHeader
        title="Training Sessions"
        subtitle="Schedule and manage training sessions"
      />

      <CoachStats
        myPlayers={myPlayers}
        upcomingSessions={upcomingSessions}
        pastSessions={pastSessions}
        notes={notes}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Upcoming sessions</div>

          {upcomingSessions.length === 0 && (
            <div
              style={{
                fontSize: 13,
                color: '#8892A4',
                textAlign: 'center',
                padding: '20px 0',
              }}
            >
              No upcoming sessions. Click "Add session" to schedule one.
            </div>
          )}

          {upcomingSessions.map(session =>
            renderSession(session, 'Upcoming')
          )}
        </div>

        {pastSessions.length > 0 && (
          <div className={styles.card}>
            <div className={styles.cardTitle}>Past sessions</div>
            {pastSessions.map(session => renderSession(session, 'Done'))}
          </div>
        )}
      </div>

      {showAddSession && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (event.target === event.currentTarget) {
              setShowAddSession(false)
            }
          }}
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
                  type="date"
                  value={sessionForm.date}
                  onChange={event =>
                    setSessionForm(current => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Time</label>
                <input
                  className={styles.formInput}
                  type="time"
                  value={sessionForm.time}
                  onChange={event =>
                    setSessionForm(current => ({
                      ...current,
                      time: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Venue</label>
              <input
                className={styles.formInput}
                placeholder="e.g. Dewan Sukan USM"
                value={sessionForm.venue}
                onChange={event =>
                  setSessionForm(current => ({
                    ...current,
                    venue: event.target.value,
                  }))
                }
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Session type</label>
              <select
                className={styles.formSelect}
                value={sessionForm.type}
                onChange={event =>
                  setSessionForm(current => ({
                    ...current,
                    type: event.target.value,
                  }))
                }
              >
                {sessionTypes.map(type => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Players attending</label>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {myPlayers.map(player => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => toggleSessionPlayer(player.id)}
                    style={{
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      background: sessionForm.players.includes(player.id)
                        ? '#1A5FFF'
                        : '#EEF1F8',
                      color: sessionForm.players.includes(player.id)
                        ? '#fff'
                        : '#8892A4',
                    }}
                  >
                    {player.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Notes optional</label>
              <input
                className={styles.formInput}
                placeholder="e.g. Focus on back court movement"
                value={sessionForm.notes}
                onChange={event =>
                  setSessionForm(current => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
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
                onClick={() => setShowAddSession(false)}
              >
                Cancel
              </button>

              <button
                className={styles.btnPrimary}
                onClick={handleSave}
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
