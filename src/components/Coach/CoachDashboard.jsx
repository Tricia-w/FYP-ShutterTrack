import { useNavigate } from 'react-router-dom'
import styles from '../Pages.module.css'
import { useCoach } from './CoachContext'
import { averageSkill, getSkillList } from './coachData'
import {
  Avatar,
  CoachPageHeader,
  CoachStats,
} from './CoachShared'

export default function CoachDashboard() {
  const navigate = useNavigate()
  const {
    players,
    notes,
    myPlayers,
    upcomingSessions,
    pastSessions,
  } = useCoach()

  return (
    <div>
      <CoachPageHeader
        title="Coach Dashboard"
        subtitle="Manage your players, sessions and track progress"
      />

      <CoachStats
        myPlayers={myPlayers}
        upcomingSessions={upcomingSessions}
        pastSessions={pastSessions}
        notes={notes}
      />

      <div className={styles.g2}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>My players overview</div>

          {myPlayers.map(player => {
            const average = averageSkill(player)

            return (
              <div key={player.id} className={styles.listRow}>
                <Avatar name={player.name} />

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
                    {player.name}
                  </div>

                  <div style={{ fontSize: 11, color: '#8892A4', marginTop: 2 }}>
                    {player.club} · {player.style}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#8892A4' }}>Avg</div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 800,
                      color: average >= 75 ? '#00976C' : '#1A5FFF',
                    }}
                  >
                    {average}
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

          {upcomingSessions.slice(0, 3).map(session => (
            <div
              key={session.id}
              className={styles.listRow}
              style={{ alignItems: 'flex-start' }}
            >
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
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: '#1A5FFF',
                    lineHeight: 1,
                  }}
                >
                  {new Date(session.date).getDate()}
                </div>

                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: '#1A5FFF',
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

          {notes.slice(0, 3).map(note => {
            const player = players.find(item => item.id === note.playerId)

            return (
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
                  {player?.name} · {note.date}
                </div>

                <div style={{ fontSize: 13, color: '#0D1B3E', lineHeight: 1.6 }}>
                  {note.text}
                </div>
              </div>
            )
          })}
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Team focus</div>

          {myPlayers.map(player => {
            const weakest = [...getSkillList(player)].sort(
              (a, b) => a.val - b.val
            )[0]

            return (
              <div key={player.id} className={styles.listRow}>
                <Avatar name={player.name} size={32} />

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
                    {player.name}
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
    </div>
  )
}
