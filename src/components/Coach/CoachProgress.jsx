import styles from '../Pages.module.css'
import { useCoach } from './CoachContext'
import { averageSkill, getSkillList } from './coachData'
import {
  Avatar,
  CoachPageHeader,
  CoachStats,
  LevelBadge,
  SkillBar,
} from './CoachShared'

export default function CoachProgress() {
  const {
    notes,
    myPlayers,
    upcomingSessions,
    pastSessions,
  } = useCoach()

  return (
    <div>
      <CoachPageHeader
        title="Player Progress"
        subtitle="Compare player skills and identify areas to improve"
      />

      <CoachStats
        myPlayers={myPlayers}
        upcomingSessions={upcomingSessions}
        pastSessions={pastSessions}
        notes={notes}
      />

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
                {myPlayers.map(player => {
                  const average = averageSkill(player)

                  return (
                    <tr key={player.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={player.name} size={28} />

                          <div>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#0D1B3E',
                              }}
                            >
                              {player.name}
                            </div>

                            <LevelBadge level={player.level} />
                          </div>
                        </div>
                      </td>

                      {[
                        player.smash,
                        player.footwork,
                        player.defense,
                        player.net,
                        player.serve,
                        player.stamina,
                      ].map((value, index) => (
                        <td key={index}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div
                              style={{
                                width: 32,
                                height: 4,
                                background: '#EEF1F8',
                                borderRadius: 2,
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${value}%`,
                                  height: '100%',
                                  background:
                                    value >= 75
                                      ? '#00C48C'
                                      : value >= 60
                                        ? '#1A5FFF'
                                        : '#F59E0B',
                                  borderRadius: 2,
                                }}
                              />
                            </div>

                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: '#0D1B3E',
                              }}
                            >
                              {value}
                            </span>
                          </div>
                        </td>
                      ))}

                      <td>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color:
                              average >= 75
                                ? '#00976C'
                                : average >= 60
                                  ? '#1A5FFF'
                                  : '#F59E0B',
                          }}
                        >
                          {average}
                        </span>
                      </td>
                    </tr>
                  )
                })}

                {myPlayers.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        textAlign: 'center',
                        padding: 32,
                        color: '#8892A4',
                      }}
                    >
                      No players in your team yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.g2}>
          {myPlayers.map(player => {
            const average = averageSkill(player)
            const sortedSkills = [...getSkillList(player)].sort(
              (a, b) => b.val - a.val
            )

            return (
              <div key={player.id} className={styles.card}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 12,
                  }}
                >
                  <Avatar name={player.name} size={38} />

                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0D1B3E' }}>
                      {player.name}
                    </div>

                    <LevelBadge level={player.level} />
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#8892A4' }}>
                      Overall
                    </div>

                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color:
                          average >= 75
                            ? '#00976C'
                            : average >= 60
                              ? '#1A5FFF'
                              : '#F59E0B',
                      }}
                    >
                      {average}
                    </div>
                  </div>
                </div>

                <SkillBar label="Smash" val={player.smash} />
                <SkillBar label="Footwork" val={player.footwork} />
                <SkillBar label="Defense" val={player.defense} />
                <SkillBar label="Net play" val={player.net} />
                <SkillBar label="Serve" val={player.serve} color="#00C48C" />
                <SkillBar label="Stamina" val={player.stamina} color="#F59E0B" />

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
                  💪 Strongest: <strong>{sortedSkills[0].label}</strong> (
                  {sortedSkills[0].val}) · Needs work:{' '}
                  <strong>{sortedSkills[sortedSkills.length - 1].label}</strong> (
                  {sortedSkills[sortedSkills.length - 1].val})
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
