import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SkillRadarChart from './SkillRadarChart'
import ExpensePieChart from './ExpensesPie'
import styles from './Pages.module.css'

const recentMatches = [
  { init: 'A', name: 'Adeline', type: 'Singles', date: '20 Apr 2026', result: 'Win 21–18', win: true },
  { init: 'A', name: 'Adam', type: 'Singles', date: '18 Apr 2026', result: 'Loss 15–21', win: false },
  { init: 'DA', name: 'Danial & Ali', type: 'Doubles', date: '15 Apr 2026', result: 'Win 21–14', win: true },
]

const skills = [
  { name: 'Smash', val: 82, low: false },
  { name: 'Defense', val: 70, low: false },
  { name: 'Footwork', val: 65, low: true },
  { name: 'Drop shot', val: 75, low: false },
  { name: 'Net play', val: 60, low: true },
  { name: 'Serve', val: 78, low: false },
]

// Matched with Expenses.js logic
const expenses = [
  { label: 'Court rental', val: 60, pct: 36, color: '#1A5FFF' },
  { label: 'Equipment', val: 45, pct: 27, color: '#00C48C' },
  { label: 'Stringing', val: 35, pct: 21, color: '#7C3AED' },
  { label: 'Transport', val: 25, pct: 15, color: '#F59E0B' },
]

const schedule = [
  { day: 24, month: 'Apr', title: 'Training session', sub: '7:00 PM · Kompleks Sukan', badge: 'Training', color: 'blue' },
  { day: 26, month: 'Apr', title: 'Club tournament', sub: '9:00 AM · Sports Arena', badge: 'Tournament', color: 'amber' },
  { day: 28, month: 'Apr', title: 'Friendly match', sub: '6:30 PM · Dewan Sukan', badge: 'Friendly', color: 'green' },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatRM(value) {
  return `RM ${Number(value).toFixed(2)}`
}

function formatRMNoDecimal(value) {
  return `RM ${Math.round(Number(value))}`
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const name = user?.name?.split(' ')[0] || 'Player'
  const weakness = user?.weakness || 'Defense Under Pressure'

  const totalExpenses = expenses.reduce((sum, item) => sum + item.val, 0)
  const lastMonthExpense = 210
  const savedAmount = lastMonthExpense - totalExpenses

  return (
    <div>
      <div className={styles.pageHead}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className={styles.pageTitle}>
              {getGreeting()}, {name} 👋
            </div>

            <div className={styles.pageSub}>
              {new Date().toLocaleDateString('en-MY', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })} · Penang Badminton Club
            </div>
          </div>

          <button className={styles.btnPrimary} onClick={() => navigate('/performance')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Log Match
          </button>
        </div>
      </div>

      <div className={styles.tip}>
        <strong>Tip:</strong> Your weakness is{' '}
        <strong style={{ color: '#1A5FFF' }}>{weakness}</strong>. Focus on targeted drills to improve this area.
      </div>

      {/* Metric Cards */}
      <div className={styles.g4} style={{ marginBottom: 16 }}>
        <div className={styles.metricHighlight}>
          <div className={styles.metricIcon} style={{ background: 'rgba(255,255,255,0.12)' }}>
            <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
              <path d="M9 2L11 7H16L12 10.5L13.5 16L9 13L4.5 16L6 10.5L2 7H7L9 2Z" fill="white" />
            </svg>
          </div>

          <div className={styles.metricVal} style={{ color: '#fff' }}>
            24
          </div>

          <div className={styles.metricLbl} style={{ color: 'rgba(255,255,255,0.6)' }}>
            Total matches
          </div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#E0FAF3' }}>
            <svg viewBox="0 0 18 18" fill="none" width="18" height="18" style={{ color: '#00C48C' }}>
              <path d="M3 10L7 14L15 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className={styles.metricVal} style={{ color: '#00C48C' }}>
            67%
          </div>

          <div className={styles.metricLbl}>Win rate</div>
          <div className={styles.deltaUp}>↑ 4% vs last month</div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#E8EFFE' }}>
            <svg viewBox="0 0 18 18" fill="none" width="18" height="18" style={{ color: '#1A5FFF' }}>
              <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M9 5v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          <div className={styles.metricVal} style={{ color: '#1A5FFF' }}>
            78
          </div>

          <div className={styles.metricLbl}>Fitness score</div>
          <div className={styles.deltaUp}>↑ 3 pts this week</div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#FEF3C7' }}>
            <svg viewBox="0 0 18 18" fill="none" width="18" height="18" style={{ color: '#F59E0B' }}>
              <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 8h14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>

          <div className={styles.metricVal} style={{ color: '#F59E0B' }}>
            {formatRMNoDecimal(totalExpenses)}
          </div>

          <div className={styles.metricLbl}>Monthly spend</div>
          <div className={styles.deltaDown}>
            ↓ RM {savedAmount} vs last month
          </div>
        </div>
      </div>

      <div className={styles.g2} style={{ marginBottom: 16 }}>
        {/* Recent Matches */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Recent Matches</div>

          {recentMatches.map((m, i) => (
            <div key={i} className={styles.listRow}>
              <div className={styles.av}>{m.init}</div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: '#8892A4' }}>
                  {m.type} · {m.date}
                </div>
              </div>

              <span className={m.win ? styles.badgeGreen : styles.badgeRed}>
                {m.result}
              </span>
            </div>
          ))}

          <div style={{ marginTop: 14 }}>
            <button className={styles.btnOutline} onClick={() => navigate('/performance')}>
              View all matches →
            </button>
          </div>
        </div>

        {/* Skill Overview — Radar Chart */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Skill Overview</div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#8892A4' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#1A5FFF', display: 'inline-block' }} />
              Strong (≥75)
            </span>

            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#8892A4' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: '#F59E0B', display: 'inline-block' }} />
              Needs work
            </span>
          </div>

          <SkillRadarChart skills={skills} />

          <div style={{ marginTop: 14 }}>
            <button className={styles.btnOutline} onClick={() => navigate('/performance')}>
              Update skills →
            </button>
          </div>
        </div>
      </div>

      <div className={styles.g2}>
        {/* Expenses */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Expense Breakdown — April 2026</div>

          <ExpensePieChart expenses={expenses} />

          <div style={{ marginTop: 14 }}>
            {expenses.map((e, i) => (
              <div key={i} className={styles.expBarRow}>
                <div className={styles.expBarLbl}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: e.color,
                      display: 'inline-block',
                      marginRight: 6,
                    }}
                  />
                  {e.label}
                </div>

                <div className={styles.expBarTrack}>
                  <div
                    className={styles.expBarFill}
                    style={{
                      width: `${e.pct}%`,
                      background: e.color,
                    }}
                  />
                </div>

                <div className={styles.expBarVal}>{formatRM(e.val)}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              borderTop: '2px solid #EEF1F8',
              marginTop: 8,
              paddingTop: 10,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: '#8892A4', fontWeight: 500 }}>Total</span>

            <span style={{ fontWeight: 800, color: '#0D1B3E', fontSize: 15 }}>
              {formatRM(totalExpenses)}
            </span>
          </div>

          <div style={{ marginTop: 14 }}>
            <button className={styles.btnOutline} onClick={() => navigate('/expenses')}>
              View expenses →
            </button>
          </div>
        </div>

        {/* Schedule */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>Upcoming Schedule</div>

          {schedule.map((s, i) => (
            <div key={i} className={styles.listRow}>
              <div style={{ textAlign: 'center', minWidth: 40 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 800, color: '#1A5FFF' }}>
                  {s.day}
                </div>

                <div style={{ fontSize: 10, color: '#8892A4', fontWeight: 600, textTransform: 'uppercase' }}>
                  {s.month}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: '#8892A4' }}>{s.sub}</div>
              </div>

              <span
                className={
                  s.color === 'blue'
                    ? styles.badgeBlue
                    : s.color === 'amber'
                    ? styles.badgeAmber
                    : styles.badgeGreen
                }
              >
                {s.badge}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}