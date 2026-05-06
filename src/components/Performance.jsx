import { useState, useRef } from 'react'
import styles from './Pages.module.css'

const C = {
  text: 'var(--text, #0D1B3E)',
  muted: 'var(--text-muted, #8892A4)',
  card: 'var(--card, #FFFFFF)',
  soft: 'var(--soft, #F6F8FF)',
  line: 'var(--line, #EEF1F8)',
}

const initMatches = [
  {
    id: 1,
    init: 'A',
    name: 'Adeline',
    partner: '',
    type: 'Singles',
    date: '2026-04-20',
    score1: '21-18',
    score2: '21-15',
    score3: '',
    result: 'Win',
    notes: 'Strong smash performance throughout the match.',
    video: null,
  },
  {
    id: 2,
    init: 'A',
    name: 'Adam',
    partner: '',
    type: 'Singles',
    date: '2026-04-18',
    score1: '15-21',
    score2: '18-21',
    score3: '',
    result: 'Loss',
    notes: 'Weak defense under pressure.',
    video: null,
  },
  {
    id: 3,
    init: 'DA',
    name: 'Danial',
    partner: 'Ali',
    type: 'Doubles',
    date: '2026-04-15',
    score1: '21-14',
    score2: '19-21',
    score3: '21-18',
    result: 'Win',
    notes: 'Good teamwork and communication.',
    video: null,
  },
]

const initSkills = [
  { name: 'Smash', val: 82 },
  { name: 'Defense', val: 70 },
  { name: 'Footwork', val: 65 },
  { name: 'Drop shot', val: 75 },
  { name: 'Net play', val: 60 },
  { name: 'Serve', val: 78 },
  { name: 'Clear', val: 72 },
  { name: 'Drive', val: 68 },
]

const MATCH_TYPES = ['Singles', 'Mixed Doubles', 'Womens Doubles', 'Mens Double']
const isSingles = t => t === 'Singles'

const emptyForm = {
  type: 'Singles',
  date: new Date().toISOString().split('T')[0],
  player1: '',
  player2: '',
  score1: '',
  score2: '',
  score3: '',
  result: 'Win',
  notes: '',
  video: null,
}

const getDisplayScore = m => {
  const parts = [m.score1, m.score2, m.score3].filter(Boolean)
  return parts.join(', ')
}

const getDisplayName = m => {
  if (isSingles(m.type)) return m.name
  return m.partner ? `${m.name} & ${m.partner}` : m.name
}

const getInit = name =>
  name
    .trim()
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

export default function Performance() {
  const [matches, setMatches] = useState(initMatches)
  const [skills, setSkills] = useState(initSkills)
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [showSkillModal, setShowSkillModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [viewMatch, setViewMatch] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [skillVals, setSkillVals] = useState(initSkills.map(s => s.val))
  const [nextId, setNextId] = useState(6)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const videoRef = useRef()

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const wins = matches.filter(m => m.result === 'Win').length
  const losses = matches.filter(m => m.result === 'Loss').length
  const winRate = matches.length ? Math.round((wins / matches.length) * 100) : 0

  const recommendations = [
    {
      icon: '⚠️',
      text: 'Footwork (65): Below threshold. Add 2× footwork drills per week.',
      type: 'warning',
    },
    {
      icon: '⚠️',
      text: 'Net play (60): Needs work. Practice net kill and net lift drills.',
      type: 'warning',
    },
    {
      icon: '✅',
      text: 'Smash (82): Good. Maintain with weekly power training.',
      type: 'success',
    },
    {
      icon: losses > wins ? '⚠️' : '✅',
      text: `Record: ${wins}W ${losses}L. ${
        losses > wins ? 'Focus on consistency.' : 'Great win ratio!'
      }`,
      type: losses > wins ? 'warning' : 'success',
    },
  ]

  const handleVideoUpload = e => {
    const file = e.target.files[0]
    if (!file) return
    setForm(f => ({ ...f, video: URL.createObjectURL(file) }))
  }

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowMatchModal(true)
  }

  const openEdit = (m, e) => {
    e.stopPropagation()
    setEditingId(m.id)
    setForm({
      type: m.type,
      date: m.date,
      player1: m.name,
      player2: m.partner || '',
      score1: m.score1,
      score2: m.score2,
      score3: m.score3,
      result: m.result,
      notes: m.notes,
      video: m.video,
    })
    setShowMatchModal(true)
  }

  const openView = m => {
    setViewMatch(m)
    setShowViewModal(true)
  }

  const handleSaveMatch = () => {
    if (!form.player1 || !form.score1) return

    const init = getInit(form.player1)

    const entry = {
      type: form.type,
      date: form.date,
      name: form.player1,
      partner: isSingles(form.type) ? '' : form.player2,
      init,
      score1: form.score1,
      score2: form.score2,
      score3: form.score3,
      result: form.result,
      notes: form.notes,
      video: form.video,
    }

    if (editingId) {
      setMatches(prev =>
        prev.map(m => (m.id === editingId ? { ...m, ...entry } : m))
      )
    } else {
      setMatches(prev => [{ id: nextId, ...entry }, ...prev])
      setNextId(n => n + 1)
    }

    setShowMatchModal(false)
    setForm(emptyForm)
  }

  const handleDelete = (id, e) => {
    e.stopPropagation()
    setDeleteConfirm(id)
  }

  const confirmDelete = () => {
    setMatches(prev => prev.filter(m => m.id !== deleteConfirm))
    setDeleteConfirm(null)
  }

  const handleUpdateSkills = () => {
    setSkills(prev => prev.map((s, i) => ({ ...s, val: skillVals[i] })))
    setShowSkillModal(false)
  }

  const fmtDate = d => {
    if (!d) return '—'
    const dt = new Date(d)
    return dt.toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div>
      <div className={styles.pageHead}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div className={styles.pageTitle}>Performance</div>
            <div className={styles.pageSub}>
              Match history, results, and skill tracking
            </div>
          </div>

          <button className={styles.btnPrimary} onClick={openAdd}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1v12M1 7h12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Log Match
          </button>
        </div>
      </div>

      <div className={styles.g4} style={{ marginBottom: 16 }}>
        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#E8EFFE' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: '#1A5FFF' }}>
              <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className={styles.metricVal} style={{ color: '#1A5FFF' }}>
            {matches.length}
          </div>
          <div className={styles.metricLbl}>Total matches</div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#E0FAF3' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: '#00C48C' }}>
              <path d="M3 10L7 14L15 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className={styles.metricVal} style={{ color: '#00C48C' }}>
            {winRate}%
          </div>
          <div className={styles.metricLbl}>Win rate</div>
          <div className={styles.deltaUp}>↑ 4% this month</div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#E8EFFE' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: '#1A5FFF' }}>
              <polyline
                points="2,14 6,8 9,10 12,5 16,7"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className={styles.metricVal} style={{ color: '#1A5FFF' }}>
            18.4
          </div>
          <div className={styles.metricLbl}>Avg score/set</div>
        </div>

        <div className={styles.metric}>
          <div className={styles.metricIcon} style={{ background: '#FEF3C7' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ color: '#F59E0B' }}>
              <path
                d="M9 2L11.5 7H16L12 10.5L13.5 15.5L9 12.5L4.5 15.5L6 10.5L2 7H6.5L9 2Z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div className={styles.metricVal} style={{ color: '#F59E0B' }}>
            5W
          </div>
          <div className={styles.metricLbl}>Best win streak</div>
        </div>
      </div>

      <div className={styles.card} style={{ marginBottom: 16 }}>
        <div className={styles.cardTitle}>
          Match history — click a row to view details
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 100 }}>Date</th>
                <th>Opponent</th>
                <th style={{ width: 120 }}>Type</th>
                <th style={{ width: 180 }}>Score</th>
                <th style={{ width: 80 }}>Result</th>
                <th style={{ width: 60 }}>Video</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {matches.map(m => (
                <tr
                  key={m.id}
                  onClick={() => openView(m)}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ color: C.muted, fontSize: 12 }}>
                    {fmtDate(m.date)}
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        className={styles.av}
                        style={{ width: 28, height: 28, fontSize: 10 }}
                      >
                        {m.init}
                      </div>
                      <span style={{ fontWeight: 600, color: C.text }}>
                        {getDisplayName(m)}
                      </span>
                    </div>
                  </td>

                  <td>
                    <span className={m.type.includes('Double') ? styles.badgePurple : styles.badgeBlue}>
                      {m.type}
                    </span>
                  </td>

                  <td style={{ fontWeight: 600, fontSize: 12, color: C.text }}>
                    {getDisplayScore(m)}
                  </td>

                  <td>
                    <span className={m.result === 'Win' ? styles.badgeGreen : styles.badgeRed}>
                      {m.result}
                    </span>
                  </td>

                  <td>
                    {m.video ? (
                      <span style={{ fontSize: 16 }} title="Has video">🎬</span>
                    ) : (
                      <span style={{ fontSize: 12, color: C.muted }}>—</span>
                    )}
                  </td>

                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className={styles.btnIcon} onClick={e => openEdit(m, e)} title="Edit">
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>

                      <button className={styles.btnIconRed} onClick={e => handleDelete(m.id, e)} title="Delete">
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                          <path
                            d="M2 4h10M5 4V2h4v2M6 7v4M8 7v4M3 4l1 8h6l1-8"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.g2}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Skill self-assessment</div>

          {skills.map((s, i) => (
            <div key={i} className={styles.skillRow}>
              <div className={styles.skillLbl}>{s.name}</div>

              <div className={styles.skillTrack}>
                <div
                  className={styles.skillFill}
                  style={{
                    width: `${s.val}%`,
                    background:
                      s.val < 68
                        ? 'linear-gradient(90deg,#F59E0B,#FBBF24)'
                        : 'linear-gradient(90deg,#1A5FFF,#3B7BFF)',
                  }}
                />
              </div>

              <div
                className={styles.skillVal}
                style={{ color: s.val < 68 ? '#F59E0B' : C.text }}
              >
                {s.val}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 14 }}>
            <button
              className={styles.btnPrimary}
              style={{ fontSize: 12, padding: '7px 14px' }}
              onClick={() => {
                setSkillVals(skills.map(s => s.val))
                setShowSkillModal(true)
              }}
            >
              Update skills
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Recommendations</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recommendations.map((r, i) => (
              <div
                key={i}
                className={r.type === 'success' ? styles.alertSuccess : styles.alertWarning}
                style={{ display: 'flex', gap: 10 }}
              >
                <span>{r.icon}</span>
                <span>{r.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showMatchModal && (
        <div
          className={styles.modalOverlay}
          onClick={e => e.target === e.currentTarget && setShowMatchModal(false)}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 520, maxHeight: '92vh', overflowY: 'auto' }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                {editingId ? 'Edit Match' : 'Log a match'}
              </div>

              <button
                className={styles.modalClose}
                onClick={() => setShowMatchModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label className={styles.formLabel}>Match type</label>
                <select className={styles.formSelect} value={form.type} onChange={set('type')}>
                  {MATCH_TYPES.map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={styles.formLabel}>Date</label>
                <input
                  className={styles.formInput}
                  type="date"
                  value={form.date}
                  onChange={set('date')}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Opponent Name</label>

              {isSingles(form.type) ? (
                <input
                  className={styles.formInput}
                  placeholder="Player 1"
                  value={form.player1}
                  onChange={set('player1')}
                />
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <input
                    className={styles.formInput}
                    placeholder="Player 1"
                    value={form.player1}
                    onChange={set('player1')}
                  />
                  <input
                    className={styles.formInput}
                    placeholder="Player 2"
                    value={form.player2}
                    onChange={set('player2')}
                  />
                </div>
              )}
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Game Score</label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {['score1', 'score2', 'score3'].map((key, index) => (
                  <div key={key}>
                    <div
                      style={{
                        fontSize: 11,
                        color: C.muted,
                        marginBottom: 5,
                        fontWeight: 500,
                      }}
                    >
                      Set {index + 1}
                    </div>

                    <input
                      className={styles.formInput}
                      placeholder={index === 2 ? '—' : index === 0 ? '21 - 18' : '21 - 15'}
                      value={form[key]}
                      onChange={set(key)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label className={styles.formLabel}>Result</label>
                <select className={styles.formSelect} value={form.result} onChange={set('result')}>
                  <option>Win</option>
                  <option>Loss</option>
                </select>
              </div>

              <div>
                <label className={styles.formLabel}>Upload Video</label>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 14px',
                    border: `1.5px solid ${C.line}`,
                    borderRadius: 10,
                    background: C.card,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: form.video ? '#00C48C' : C.muted,
                    fontWeight: form.video ? 600 : 400,
                  }}
                  onClick={() => document.getElementById('vidUpload').click()}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M10 3v10M10 3L7 6M10 3l3 3"
                      stroke={form.video ? '#00C48C' : '#8892A4'}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M3 13v2a2 2 0 002 2h10a2 2 0 002-2v-2"
                      stroke={form.video ? '#00C48C' : '#8892A4'}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>

                  <span>{form.video ? 'Video attached ✓' : 'Attachment'}</span>

                  <input
                    id="vidUpload"
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={handleVideoUpload}
                  />
                </div>
              </div>
            </div>

            {form.video && (
              <div className={styles.formRow}>
                <video
                  src={form.video}
                  controls
                  style={{
                    width: '100%',
                    borderRadius: 10,
                    maxHeight: 160,
                    background: '#000',
                  }}
                />
              </div>
            )}

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Notes</label>
              <textarea
                className={styles.formTextarea}
                placeholder="e.g. Need improve speed"
                value={form.notes}
                onChange={set('notes')}
                style={{ minHeight: 80 }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className={styles.btnOutline} onClick={() => setShowMatchModal(false)}>
                Cancel
              </button>
              <button className={styles.btnPrimary} onClick={handleSaveMatch}>
                {editingId ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && viewMatch && (
        <div
          className={styles.modalOverlay}
          onClick={e => e.target === e.currentTarget && setShowViewModal(false)}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 500, maxHeight: '88vh', overflowY: 'auto' }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Match Details</div>
              <button className={styles.modalClose} onClick={() => setShowViewModal(false)}>
                ✕
              </button>
            </div>

            <div
              style={{
                background:
                  viewMatch.result === 'Win'
                    ? 'rgba(0, 196, 140, 0.12)'
                    : 'rgba(239, 68, 68, 0.12)',
                borderRadius: 12,
                padding: '14px 18px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                className={styles.av}
                style={{
                  width: 48,
                  height: 48,
                  fontSize: 16,
                  background: viewMatch.result === 'Win' ? '#00C48C' : '#EF4444',
                  color: '#fff',
                }}
              >
                {viewMatch.init}
              </div>

              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: C.text }}>
                  vs {getDisplayName(viewMatch)}
                </div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {viewMatch.type} · {fmtDate(viewMatch.date)}
                </div>
              </div>

              <span
                className={viewMatch.result === 'Win' ? styles.badgeGreen : styles.badgeRed}
                style={{ marginLeft: 'auto', fontSize: 13, padding: '5px 14px' }}
              >
                {viewMatch.result}
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Score</span>
              <span className={styles.statVal} style={{ fontWeight: 800 }}>
                {getDisplayScore(viewMatch)}
              </span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Match type</span>
              <span className={styles.statVal}>{viewMatch.type}</span>
            </div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Date</span>
              <span className={styles.statVal}>{fmtDate(viewMatch.date)}</span>
            </div>

            <div className={styles.statRow} style={{ alignItems: 'flex-start', paddingTop: 12 }}>
              <span className={styles.statLabel}>Notes</span>
              <span
                className={styles.statVal}
                style={{ textAlign: 'right', color: C.muted, fontWeight: 400 }}
              >
                {viewMatch.notes || '—'}
              </span>
            </div>

            <div style={{ marginTop: 20 }}>
              <div className={styles.cardTitle}>Match video</div>

              {viewMatch.video ? (
                <video
                  ref={videoRef}
                  src={viewMatch.video}
                  controls
                  style={{
                    width: '100%',
                    borderRadius: 12,
                    background: '#000',
                    maxHeight: 280,
                  }}
                />
              ) : (
                <div
                  style={{
                    background: C.soft,
                    borderRadius: 12,
                    padding: '32px 20px',
                    textAlign: 'center',
                    color: C.muted,
                    fontSize: 13,
                    border: `2px dashed ${C.line}`,
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
                  No video uploaded for this match.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button className={styles.btnPrimary} onClick={() => setShowViewModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} style={{ maxWidth: 380 }}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Delete Match</div>
            </div>

            <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
              Are you sure you want to delete this match? This cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className={styles.btnOutline} onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button className={styles.btnDanger} onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showSkillModal && (
        <div
          className={styles.modalOverlay}
          onClick={e => e.target === e.currentTarget && setShowSkillModal(false)}
        >
          <div
            className={styles.modal}
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Update Skills</div>
              <button className={styles.modalClose} onClick={() => setShowSkillModal(false)}>
                ✕
              </button>
            </div>

            <div className={styles.tip}>
              Rate each skill honestly from 1–100. Labeled as self-reported data.
            </div>

            {skills.map((s, i) => (
              <div key={i} className={styles.formRow}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <label className={styles.formLabel} style={{ marginBottom: 0 }}>
                    {s.name}
                  </label>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                    {skillVals[i]}
                  </span>
                </div>

                <input
                  type="range"
                  min="1"
                  max="100"
                  value={skillVals[i]}
                  style={{ width: '100%', accentColor: '#1A5FFF' }}
                  onChange={e =>
                    setSkillVals(prev =>
                      prev.map((v, j) => (j === i ? +e.target.value : v))
                    )
                  }
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className={styles.btnOutline} onClick={() => setShowSkillModal(false)}>
                Cancel
              </button>
              <button className={styles.btnPrimary} onClick={handleUpdateSkills}>
                Save Skills
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}