import { useNavigate } from 'react-router-dom'
import styles from '../Layout/Pages.module.css'


const initials = name =>
  String(name || 'Player')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)


export function Avatar({
  name,
  size = 36,
  bg = 'var(--soft-blue, #E8EFFE)',
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
    Advanced: { bg: 'var(--soft-blue, #E8EFFE)', color: '#1A5FFF' },
    Intermediate: { bg: 'var(--soft-green, #E0FAF3)', color: '#00976C' },
    Beginner: { bg: 'var(--soft-yellow, #FEF3C7)', color: '#92400E' },
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
  const safeValue = Math.max(0, Math.min(100, Number(val) || 0))

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
        width: '100%',
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: 'var(--text-muted, #8892A4)',
          width: 64,
          flexShrink: 0,
        }}
      >
        {label}
      </span>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: 5,
          background: 'var(--line, #EEF1F8)',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${safeValue}%`,
            height: '100%',
            background: color,
            borderRadius: 4,
          }}
        />
      </div>

      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text, #0D1B3E)',
          width: 28,
          flexShrink: 0,
          textAlign: 'right',
        }}
      >
        {safeValue}
      </span>
    </div>
  )
}

export function CoachPageHeader({
  title,
  subtitle,
  showActions = true,
  rightAction = null,
}) {
  const navigate = useNavigate()

  return (
    <div className={styles.pageHead} style={{ overflow: 'visible' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className={styles.pageTitle}>{title}</div>
          <div className={styles.pageSub}>{subtitle}</div>
        </div>

        {(showActions || rightAction) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              flexWrap: 'nowrap',
              overflow: 'visible',
              flexShrink: 0,
            }}
          >
            {showActions && (
              <>
              <button
                type="button"
                onClick={() => navigate('/coach/players?find=1')}
                style={{
                  height: 34,
                  minWidth: 104,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: '1px solid #B8C7E6',
                  background: 'var(--card, #FFFFFF)',
                  color: 'var(--text, #0D1B3E)',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Find player
              </button>

              <button
                type="button"
                onClick={() => navigate('/coach/sessions?add=1')}
                style={{
                  height: 34,
                  minWidth: 118,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: '1px solid #1A5FFF',
                  background: '#1A5FFF',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 10px rgba(26, 95, 255, 0.16)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    color: '#13E38C',
                    fontSize: 22,
                    fontWeight: 400,
                    lineHeight: 1,
                    marginTop: -1,
                  }}
                >
                  +
                </span>
                Add session
              </button>
              </>
            )}

            {rightAction}
          </div>
        )}
      </div>
    </div>
  )
}

export function CoachStats({
  myPlayers = [],
  upcomingSessions = [],
  pastSessions = [],
  notes = [],
}) {
  const stats = [
    {
      label: 'My players',
      val: myPlayers.length,
      color: '#1A5FFF',
      bg: 'var(--soft-blue, #E8EFFE)',
    },
    {
      label: 'Upcoming sessions',
      val: upcomingSessions.length,
      color: '#00976C',
      bg: 'var(--soft-green, #E0FAF3)',
    },
    {
      label: 'Past sessions',
      val: pastSessions.length,
      color: '#F59E0B',
      bg: 'var(--soft-yellow, #FEF3C7)',
    },
    {
      label: 'Total notes',
      val: notes.length,
      color: '#7C3AED',
      bg: 'var(--soft-purple, #EDE9FE)',
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