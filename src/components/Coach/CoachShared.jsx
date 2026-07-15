import { useNavigate } from 'react-router-dom'
import styles from '../Pages.module.css'
import { initials } from './coachData'

export function Avatar({
  name,
  size = 36,
  bg = '#E8EFFE',
  color = '#1A5FFF',
}) {
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

export function LevelBadge({ level }) {
  const map = {
    Advanced: { bg: '#E8EFFE', color: '#1A5FFF' },
    Intermediate: { bg: '#E0FAF3', color: '#00976C' },
    Beginner: { bg: '#FEF3C7', color: '#92400E' },
  }

  const badge = map[level] || map.Beginner

  return (
    <span
      style={{
        background: badge.bg,
        color: badge.color,
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

export function SkillBar({ label, val, color = '#1A5FFF' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: '#8892A4', width: 64, flexShrink: 0 }}>
        {label}
      </span>

      <div
        style={{
          flex: 1,
          height: 5,
          background: '#EEF1F8',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
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

      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#0D1B3E',
          width: 24,
          textAlign: 'right',
        }}
      >
        {val}
      </span>
    </div>
  )
}

export function CoachPageHeader({ title, subtitle, showActions = true }) {
  const navigate = useNavigate()

  return (
    <div className={styles.pageHead}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div className={styles.pageTitle}>{title}</div>
          <div className={styles.pageSub}>{subtitle}</div>
        </div>

        {showActions && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={styles.btnOutline}
              onClick={() => navigate('/coach/players?find=1')}
            >
              Find player
            </button>

            <button
              className={styles.btnPrimary}
              onClick={() => navigate('/coach/sessions?add=1')}
            >
              Add session
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export function CoachStats({
  myPlayers,
  upcomingSessions,
  pastSessions,
  notes,
}) {
  const stats = [
    {
      label: 'My players',
      val: myPlayers.length,
      color: '#1A5FFF',
      bg: '#E8EFFE',
    },
    {
      label: 'Upcoming sessions',
      val: upcomingSessions.length,
      color: '#00976C',
      bg: '#E0FAF3',
    },
    {
      label: 'Past sessions',
      val: pastSessions.length,
      color: '#F59E0B',
      bg: '#FEF3C7',
    },
    {
      label: 'Total notes',
      val: notes.length,
      color: '#7C3AED',
      bg: '#EDE9FE',
    },
  ]

  return (
    <div className={styles.g4} style={{ marginBottom: 16 }}>
      {stats.map(stat => (
        <div key={stat.label} className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: stat.bg }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: stat.color,
              }}
            />
          </div>

          <div className={styles.metricVal} style={{ color: stat.color }}>
            {stat.val}
          </div>

          <div className={styles.metricLbl}>{stat.label}</div>
        </div>
      ))}
    </div>
  )
}
