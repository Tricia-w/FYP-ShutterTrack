import { useEffect, useState } from 'react'
import styles from '../../../Layout/Pages.module.css'

// Standalone Fitness Development chart, used by the Fitness flip card.
const FITNESS_COLORS = {
  Endurance: '#10B981',
  Speed: '#2563EB',
  Strength: '#8B5CF6',
  Agility: '#F59E0B',
}
const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number(n) || 0))

// Visualises saved player fitness tests without modifying the score calculations.
export default function FitnessDevelopmentTimeline({ tests }) {
  const [indicator, setIndicator] = useState('All')
  const [period, setPeriod] = useState('All')
  const [hovered, setHovered] = useState(null)
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)')
    const update = () => setMobile(media.matches)
    update()
    if (media.addEventListener) { media.addEventListener('change', update); return () => media.removeEventListener('change', update) }
    media.addListener(update)
    return () => media.removeListener(update)
  }, [])

  const names = ['Endurance', 'Speed', 'Strength', 'Agility']
  const durationDays = { '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }
  const cutoff = durationDays[period] ? Date.now() - durationDays[period] * 86400000 : 0
  const data = tests
    .filter(test => !test.addedByCoach && names.includes(test.indicator === 'Flexibility' ? 'Agility' : test.indicator))
    .map(test => ({ ...test, name: test.indicator === 'Flexibility' ? 'Agility' : test.indicator, timestamp: new Date(`${test.date}T12:00:00`).getTime() }))
    .filter(test => Number.isFinite(test.timestamp) && test.timestamp >= cutoff)
    .sort((a, b) => a.timestamp - b.timestamp)
  const shown = indicator === 'All' ? names : [indicator]
  const groups = shown.map(name => ({ name, entries: data.filter(item => item.name === name) })).filter(group => group.entries.length)
  const width = 560
  const height = mobile ? 290 : 215
  const left = 39
  const right = 16
  const top = 14
  const bottom = 30
  const chartHeight = height - top - bottom
  const allTimes = groups.flatMap(group => group.entries.map(item => item.timestamp))
  const singleTestIndicators = groups.filter(group => group.entries.length === 1).map(group => group.name)
  const first = allTimes.length ? Math.min(...allTimes) : 0
  const last = allTimes.length ? Math.max(...allTimes) : 0
  const x = date => first === last ? left + 24 : left + (date - first) / (last - first) * (width - left - right)
  const y = score => top + chartHeight * (1 - clamp(score) / 100)
  const dateLabel = value => new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: '2-digit' })

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8, margin: '8px 0 16px', flexWrap: 'wrap' }}>
        <select className={styles.formSelect} aria-label="Fitness indicator to chart" value={indicator} onChange={event => { setIndicator(event.target.value); setHovered(null) }} style={{ flex: '1 1 150px', minWidth: 0 }}>
          <option value="All">All Indicators</option>
          {names.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className={styles.formSelect} aria-label="Fitness development time range" value={period} onChange={event => { setPeriod(event.target.value); setHovered(null) }} style={{ flex: '0 1 125px', minWidth: 100 }}>
          <option value="All">All time</option>
          <option value="1M">1 month</option>
          <option value="3M">3 months</option>
          <option value="6M">6 months</option>
          <option value="1Y">1 year</option>
        </select>
      </div>
      {groups.length === 0 ? (
        <div style={{ padding: '42px 8px', color: 'var(--text-muted, #8892A4)', textAlign: 'center', fontSize: 13 }}>
          No saved fitness tests in this range. Add a fitness test to track development.
        </div>
      ) : (
        <>
          <div style={{ position: 'relative' }} onMouseLeave={() => setHovered(null)}>
            {hovered && (
              <div style={{ position: 'absolute', right: 4, top: 0, zIndex: 3, border: '1px solid var(--line, #EEF1F8)', borderRadius: 9, background: 'var(--card, #FFFFFF)', padding: '7px 10px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,.1)', pointerEvents: 'none' }}>
                <strong style={{ color: FITNESS_COLORS[hovered.name] }}>{hovered.name}: {hovered.score}/100</strong>
                <div style={{ color: 'var(--text-muted, #8892A4)' }}>{dateLabel(hovered.timestamp)}</div>
              </div>
            )}
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Fitness test progress over time" style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}>
              {[0, 25, 50, 75, 100].map(score => (
                <g key={score}>
                  <line x1={left} x2={width - right} y1={y(score)} y2={y(score)} stroke="var(--line, #E5E7EB)" strokeDasharray="4 5" />
                  <text x={left - 9} y={y(score) + 4} textAnchor="end" fontSize="12" fill="var(--text-muted, #8892A4)">{score}</text>
                </g>
              ))}
              {groups.map(group => {
                const color = FITNESS_COLORS[group.name]
                const points = group.entries.map(item => `${x(item.timestamp)},${y(item.score)}`).join(' ')
                return (
                  <g key={group.name}>
                    {group.entries.length > 1 && <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
                    {group.entries.length > 1 && <polyline points={points} fill="none" stroke="transparent" strokeWidth="18" style={{ cursor: 'crosshair', pointerEvents: 'stroke' }} onMouseMove={event => {
                      const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect()
                      if (!rect) return
                      const position = (event.clientX - rect.left) * width / rect.width
                      const closest = group.entries.reduce((best, item) => Math.abs(x(item.timestamp) - position) < Math.abs(x(best.timestamp) - position) ? item : best, group.entries[0])
                      setHovered(closest)
                    }} />}
                    {group.entries.map((item, index) => (
                      <circle key={`${group.name}-${item.id || index}`} cx={x(item.timestamp)} cy={y(item.score)} r={4.5} fill={color} stroke="var(--card, #FFFFFF)" strokeWidth="1.5" onMouseEnter={() => setHovered(item)} onMouseMove={() => setHovered(item)}>
                        <title>{`${group.name}: ${item.score}/100 · ${dateLabel(item.timestamp)}`}</title>
                      </circle>
                    ))}
                  </g>
                )
              })}
              {first === last ? (
                <text x={x(first)} y={height - 4} textAnchor="middle" fontSize="12" fill="var(--text-muted, #8892A4)">{dateLabel(first)}</text>
              ) : (
                <>
                  <text x={left} y={height - 4} fontSize="12" fill="var(--text-muted, #8892A4)">{dateLabel(first)}</text>
                  <text x={width - right} y={height - 4} textAnchor="end" fontSize="12" fill="var(--text-muted, #8892A4)">{dateLabel(last)}</text>
                </>
              )}
            </svg>
          </div>
          {indicator === 'All' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: mobile ? '8px 12px' : '8px 18px', marginTop: mobile ? 16 : 18, paddingTop: 12, borderTop: '1px solid var(--line, #EEF1F8)' }}>
              {names.map(name => (
                <span key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: mobile ? 10 : 12, color: 'var(--text, #0D1B3E)' }}>
                  <span style={{ width: mobile ? 12 : 16, height: 3, borderRadius: 3, background: FITNESS_COLORS[name] }} />{name}
                </span>
              ))}
            </div>
          )}
          {singleTestIndicators.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted, #8892A4)' }}>
              {singleTestIndicators.join(', ')} {singleTestIndicators.length === 1 ? 'has' : 'have'} only one saved test, so {singleTestIndicators.length === 1 ? 'it appears' : 'they appear'} as {singleTestIndicators.length === 1 ? 'a dot' : 'dots'} until another test is recorded.
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-muted, #8892A4)', marginTop: 10, lineHeight: 1.5 }}>
            Based on your saved fitness tests. Coach assessments are shown separately. Recovery is calculated from check-ins and is not included in this test timeline.
          </div>
        </>
      )}
    </div>
  )
}
