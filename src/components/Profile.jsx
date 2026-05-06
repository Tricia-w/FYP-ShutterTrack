import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Pages.module.css'

const skills = [
  {
    name: 'Smash',
    val: 82,
    low: false,
    source: 'Self-reported',
    updatedBy: 'Demo Player',
    updatedAt: '5 May 2026',
  },
  {
    name: 'Defense',
    val: 70,
    low: false,
    source: 'Self-reported',
    updatedBy: 'Demo Player',
    updatedAt: '5 May 2026',
  },
  {
    name: 'Footwork',
    val: 65,
    low: true,
    source: 'Self-reported',
    updatedBy: 'Demo Player',
    updatedAt: '5 May 2026',
  },
  {
    name: 'Drop shot',
    val: 75,
    low: false,
    source: 'Self-reported',
    updatedBy: 'Demo Player',
    updatedAt: '5 May 2026',
  },
  {
    name: 'Net play',
    val: 60,
    low: true,
    source: 'Self-reported',
    updatedBy: 'Demo Player',
    updatedAt: '5 May 2026',
  },
  {
    name: 'Serve',
    val: 78,
    low: false,
    source: 'Self-reported',
    updatedBy: 'Demo Player',
    updatedAt: '5 May 2026',
  },
]

export default function Profile() {
  const { user, saveProfile } = useAuth()
  const navigate = useNavigate()

  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showEquipmentModal, setShowEquipmentModal] = useState(false)

  const avatarInputRef = useRef(null)
  const mediaInputRef = useRef(null)

  const avatarKey = `profileAvatar:${user?.id || user?.email || 'default'}`
  const mediaKey = `profileMedia:${user?.id || user?.email || 'default'}`

  const [avatarUrl, setAvatarUrl] = useState('')
  const [mediaItems, setMediaItems] = useState([])
  const [mediaType, setMediaType] = useState('Match Clip')

  const [form, setForm] = useState({
    name: user?.name || 'Demo Player',
    age: user?.age || '22',
    height: user?.height || '172',
    weight: user?.weight || '65',
    hand: user?.hand || 'Right',
    club: user?.club || 'Penang Badminton Club',
    state: user?.state || 'Penang',

    racket: user?.racket || 'Yonex Astrox 99',
    string: user?.string || 'BG80 Power',
    tension: user?.tension || '26 lbs',
    shoes: user?.shoes || 'Yonex Power Cushion 65',
    lastStringing: user?.lastStringing || '10 Apr 2026',

    instagram: user?.instagram || user?.ig || '',
    showInstagram: user?.showInstagram ?? true,
    bio:
      user?.bio ||
      'Badminton player who enjoys training, match play and improving performance.',
  })

  useEffect(() => {
    const savedAvatar = localStorage.getItem(avatarKey)
    if (savedAvatar) setAvatarUrl(savedAvatar)

    const savedMedia = localStorage.getItem(mediaKey)
    if (savedMedia) {
      try {
        setMediaItems(JSON.parse(savedMedia))
      } catch {
        setMediaItems([])
      }
    }
  }, [avatarKey, mediaKey])

  const set = key => e => {
    setForm(prev => ({
      ...prev,
      [key]: e.target.value,
    }))
  }

  const name = form.name || user?.name || 'Player'

  const initials =
    user?.initials ||
    name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  const cleanInstagram = form.instagram.replace('@', '').trim()

  const handleAvatarChange = e => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.')
      return
    }

    if (file.size > 1024 * 1024) {
      alert('Image must be below 1MB for now.')
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const imageData = reader.result

      setAvatarUrl(imageData)
      localStorage.setItem(avatarKey, imageData)

      window.dispatchEvent(
        new CustomEvent('avatar-updated', {
          detail: {
            key: avatarKey,
            avatarUrl: imageData,
          },
        })
      )
    }

    reader.readAsDataURL(file)
  }

  const handleRemoveAvatar = () => {
    localStorage.removeItem(avatarKey)
    setAvatarUrl('')

    window.dispatchEvent(
      new CustomEvent('avatar-updated', {
        detail: {
          key: avatarKey,
          avatarUrl: '',
        },
      })
    )
  }

  const handleMediaUpload = e => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Please upload an image or video file.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Media must be below 10MB for now.')
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      const newItem = {
        id: Date.now(),
        type: mediaType,
        name: file.name,
        url: reader.result,
        fileType: file.type,
        date: new Date().toLocaleDateString('en-MY', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
      }

      setMediaItems(prev => {
        const updated = [newItem, ...prev]
        localStorage.setItem(mediaKey, JSON.stringify(updated))
        return updated
      })
    }

    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleRemoveMedia = id => {
    setMediaItems(prev => {
      const updated = prev.filter(item => item.id !== id)
      localStorage.setItem(mediaKey, JSON.stringify(updated))
      return updated
    })
  }

  const buildProfilePayload = () => {
    const finalName = form.name || 'Demo Player'

    const newInitials = finalName
      .trim()
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    return {
      ...user,
      ...form,
      name: finalName,
      initials: newInitials,
      avatarUrl,
      ig: form.instagram,
      instagram: form.instagram,
      showInstagram: form.showInstagram,
      bio: form.bio,
    }
  }

  const handleSaveProfile = () => {
    saveProfile(buildProfilePayload())
    setShowProfileModal(false)
  }

  const handleSaveEquipment = () => {
    saveProfile(buildProfilePayload())
    setShowEquipmentModal(false)
  }

  const stats = [
    { label: 'Total matches', value: 24, color: '#1A5FFF', bg: '#E8EFFE' },
    { label: 'Wins', value: 16, color: '#00C48C', bg: '#E0FAF3' },
    { label: 'Losses', value: 8, color: '#EF4444', bg: '#FEE2E2' },
    { label: 'Win rate', value: '67%', color: '#1A5FFF', bg: '#E8EFFE' },
  ]

  const equipment = [
    { label: 'Racket', value: form.racket },
    { label: 'String', value: form.string },
    { label: 'Tension', value: form.tension },
    { label: 'Shoes', value: form.shoes },
    { label: 'Last stringing', value: form.lastStringing },
  ]

  const skillSources = [...new Set(skills.map(skill => skill.source))]
  const skillSourceText = skillSources.length === 1 ? skillSources[0] : 'Mixed'
  const latestSkillUpdate = skills[0]

  const modalStyle = {
    background: '#FFFFFF',
    color: '#0D1B3E',
    border: '1px solid #D9E2F0',
    borderRadius: 20,
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.18)',
    padding: 28,
  }

  return (
    <div>
      <div className={styles.pageHead}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div>
            <div className={styles.pageTitle}>My Profile</div>
            <div className={styles.pageSub}>
              Personal, player and lifestyle information
            </div>
          </div>

          <button
            className={styles.btnPrimary}
            onClick={() => setShowProfileModal(true)}
          >
            Edit Profile
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '3fr 7fr',
          gap: 18,
          alignItems: 'start',
          width: '100%',
        }}
      >
        {/* LEFT SIDE */}
        <div>
          <div
            style={{
              background: 'linear-gradient(180deg, #111827 0%, #0B1220 100%)',
              borderRadius: 22,
              padding: 24,
              color: '#FFFFFF',
              marginBottom: 16,
              boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 14,
                marginBottom: 18,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: '#93A4BC',
                    fontWeight: 700,
                    letterSpacing: 1.6,
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Player Profile
                </div>

                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    lineHeight: 1.1,
                    color: '#FFFFFF',
                    marginBottom: 6,
                  }}
                >
                  {name}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: '#CBD5E1',
                    lineHeight: 1.5,
                  }}
                >
                  {user?.event || 'Singles'} Player · {form.state}
                </div>
              </div>

              <div
                style={{
                  position: 'relative',
                  width: 76,
                  height: 76,
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: '50%',
                    border: '3px solid rgba(255,255,255,0.12)',
                    overflow: 'hidden',
                    background: '#1A5FFF',
                    color: '#FFFFFF',
                    fontSize: 22,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    initials
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  style={{
                    position: 'absolute',
                    right: -2,
                    bottom: -2,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    border: '2px solid #0B1220',
                    background: '#1A5FFF',
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  📷
                </button>

                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  background: 'rgba(26, 95, 255, 0.18)',
                  color: '#93C5FD',
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                {user?.event || 'Singles'}
              </span>

              <span
                style={{
                  background: 'rgba(0, 196, 140, 0.15)',
                  color: '#6EE7B7',
                  padding: '6px 12px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                {user?.style || 'Aggressive Attacker'}
              </span>
            </div>

            {form.showInstagram && cleanInstagram && (
              <a
                href={`https://instagram.com/${cleanInstagram}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '7px 12px',
                  background: 'rgba(244, 114, 182, 0.16)',
                  border: '1px solid rgba(244, 114, 182, 0.3)',
                  borderRadius: 999,
                  textDecoration: 'none',
                  marginBottom: 14,
                  maxWidth: '100%',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="2" width="20" height="20" rx="5" stroke="#F9A8D4" strokeWidth="2" />
                  <circle cx="12" cy="12" r="4.5" stroke="#F9A8D4" strokeWidth="2" />
                  <circle cx="17.5" cy="6.5" r="1" fill="#F9A8D4" />
                </svg>

                <span
                  style={{
                    fontSize: 12,
                    color: '#F9A8D4',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  @{cleanInstagram}
                </span>
              </a>
            )}

            <div
              style={{
                fontSize: 13,
                color: '#D1D5DB',
                lineHeight: 1.7,
                marginBottom: 18,
                fontWeight: 400,
              }}
            >
              {form.bio}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              {[
                { label: 'Style', value: user?.style || 'Aggressive Attacker' },
                { label: 'Strength', value: user?.strength || 'Smash Power' },
                { label: 'Weakness', value: user?.weakness || 'Defense Under Pressure' },
                { label: 'Racket', value: form.racket },
              ].map(item => (
                <div
                  key={item.label}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 58,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: '#93A4BC',
                      fontWeight: 600,
                      letterSpacing: 0.5,
                    }}
                  >
                    {item.label}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      color: '#FFFFFF',
                      fontWeight: 400,
                      marginTop: 5,
                      lineHeight: 1.35,
                    }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                className={styles.btnOutline}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.08)',
                  color: '#FFFFFF',
                  borderColor: 'rgba(255,255,255,0.12)',
                }}
                onClick={() => navigate('/setup')}
              >
                Re-do setup
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  style={{
                    border: 'none',
                    background: 'rgba(239, 68, 68, 0.14)',
                    color: '#FCA5A5',
                    borderRadius: 10,
                    padding: '0 12px',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Personal info</div>

            {[
              { label: 'Age', value: `${form.age} years` },
              { label: 'Height', value: `${form.height} cm` },
              { label: 'Weight', value: `${form.weight} kg` },
              { label: 'Playing hand', value: form.hand },
              { label: 'Club', value: form.club },
              { label: 'State', value: form.state },
              { label: 'Personal info source', value: 'Self-reported' },
            ].map(item => (
              <div key={item.label} className={styles.statRow}>
                <span className={styles.statLabel}>{item.label}</span>

                <span className={styles.statVal}>
                  {item.label === 'Personal info source' ? (
                    <span className={styles.badgeBlue}>{item.value}</span>
                  ) : (
                    item.value
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {stats.map(item => (
              <div
                key={item.label}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--line)',
                  borderRadius: 16,
                  padding: 18,
                  minHeight: 106,
                  boxShadow: '0 8px 20px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: item.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: item.color,
                    }}
                  />
                </div>

                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: item.color,
                    lineHeight: 1,
                  }}
                >
                  {item.value}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginTop: 5,
                  }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.card} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 14,
                flexWrap: 'wrap',
              }}
            >
              <div className={styles.cardTitle}>Skill ratings</div>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#1A5FFF',
                    background: '#E8EFFE',
                    padding: '4px 9px',
                    borderRadius: 999,
                  }}
                >
                  Source: {skillSourceText}
                </span>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#6B7280',
                    background: '#F3F4F6',
                    padding: '4px 9px',
                    borderRadius: 999,
                  }}
                >
                  Updated by: {latestSkillUpdate.updatedBy}
                </span>
              </div>
            </div>

            {skills.map(skill => (
              <div key={skill.name} className={styles.skillRow}>
                <div className={styles.skillLbl}>{skill.name}</div>

                <div className={styles.skillTrack}>
                  <div
                    className={styles.skillFill}
                    style={{
                      width: `${skill.val}%`,
                      background: skill.low
                        ? 'linear-gradient(90deg,#F59E0B,#FBBF24)'
                        : 'linear-gradient(90deg,#1A5FFF,#3B7BFF)',
                    }}
                  />
                </div>

                <div
                  className={styles.skillVal}
                  style={{
                    color: skill.low ? '#F59E0B' : 'var(--text)',
                  }}
                  title={`${skill.source} · ${skill.updatedBy} · ${skill.updatedAt}`}
                >
                  {skill.val}
                </div>
              </div>
            ))}

            <div style={{ marginTop: 14 }}>
              <button
                className={styles.btnOutline}
                onClick={() => navigate('/performance')}
              >
                Update ratings
              </button>
            </div>
          </div>

          <div className={styles.card} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginBottom: 10,
                flexWrap: 'wrap',
              }}
            >
              <div className={styles.cardTitle}>Equipment</div>

              <button
                className={styles.btnOutline}
                onClick={() => setShowEquipmentModal(true)}
              >
                Edit equipment
              </button>
            </div>

            {equipment.map(item => (
              <div key={item.label} className={styles.statRow}>
                <span className={styles.statLabel}>{item.label}</span>
                <span className={styles.statVal}>{item.value}</span>
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <div className={styles.cardTitle}>Profile media</div>

              <div style={{ display: 'flex', gap: 8 }}>
                <select
                  className={styles.formSelect}
                  value={mediaType}
                  onChange={e => setMediaType(e.target.value)}
                  style={{ width: 130, height: 36 }}
                >
                  <option>Match Clip</option>
                  <option>Training Clip</option>
                  <option>Highlight Video</option>
                </select>

                <button
                  className={styles.btnPrimary}
                  onClick={() => mediaInputRef.current?.click()}
                >
                  Upload
                </button>

                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMediaUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            {mediaItems.length === 0 ? (
              <div
                style={{
                  padding: 22,
                  background: 'var(--soft)',
                  borderRadius: 14,
                  color: 'var(--text-muted)',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                No media uploaded yet. Add match clips, training clips or highlight videos.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 10,
                }}
              >
                {mediaItems.map(item => (
                  <div
                    key={item.id}
                    style={{
                      background: 'var(--soft)',
                      borderRadius: 14,
                      overflow: 'hidden',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <div
                      style={{
                        height: 110,
                        background: '#E8EFFE',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {item.fileType.startsWith('image/') ? (
                        <img
                          src={item.url}
                          alt={item.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <video
                          src={item.url}
                          controls
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      )}
                    </div>

                    <div style={{ padding: 10 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {item.name}
                      </div>

                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          marginTop: 3,
                        }}
                      >
                        {item.type} · {item.date}
                      </div>

                      <button
                        onClick={() => handleRemoveMedia(item.id)}
                        style={{
                          marginTop: 8,
                          border: 'none',
                          background: 'transparent',
                          color: '#EF4444',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      {showProfileModal && (
        <div
          className={styles.modalOverlay}
          onClick={e =>
            e.target === e.currentTarget && setShowProfileModal(false)
          }
        >
          <div
            className={styles.modal}
            style={{
              ...modalStyle,
              maxWidth: 760,
              width: '92vw',
              maxHeight: '86vh',
              overflowY: 'auto',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Edit Profile</div>

              <button
                className={styles.modalClose}
                onClick={() => setShowProfileModal(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Full Name</label>
                <input
                  className={styles.formInput}
                  value={form.name}
                  onChange={set('name')}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Age</label>
                <input
                  className={styles.formInput}
                  type="number"
                  value={form.age}
                  onChange={set('age')}
                />
              </div>
            </div>

            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Height cm</label>
                <input
                  className={styles.formInput}
                  type="number"
                  value={form.height}
                  onChange={set('height')}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Weight kg</label>
                <input
                  className={styles.formInput}
                  type="number"
                  value={form.weight}
                  onChange={set('weight')}
                />
              </div>
            </div>

            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Playing Hand</label>
                <select
                  className={styles.formSelect}
                  value={form.hand}
                  onChange={set('hand')}
                >
                  <option>Right</option>
                  <option>Left</option>
                </select>
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>State</label>
                <input
                  className={styles.formInput}
                  value={form.state}
                  onChange={set('state')}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Club</label>
              <input
                className={styles.formInput}
                value={form.club}
                onChange={set('club')}
              />
            </div>

            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Instagram optional</label>
                <input
                  className={styles.formInput}
                  placeholder="@yourusername"
                  value={form.instagram}
                  onChange={set('instagram')}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  Show Instagram publicly
                </label>
                <select
                  className={styles.formSelect}
                  value={form.showInstagram ? 'Yes' : 'No'}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      showInstagram: e.target.value === 'Yes',
                    }))
                  }
                >
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Bio / badminton lifestyle
              </label>
              <textarea
                className={styles.formInput}
                rows={4}
                value={form.bio}
                onChange={set('bio')}
                placeholder="Write something about your badminton lifestyle, training, goals or playing identity..."
                style={{
                  resize: 'vertical',
                  minHeight: 100,
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 12,
              }}
            >
              <button
                className={styles.btnOutline}
                onClick={() => setShowProfileModal(false)}
              >
                Cancel
              </button>

              <button className={styles.btnPrimary} onClick={handleSaveProfile}>
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT EQUIPMENT MODAL */}
      {showEquipmentModal && (
        <div
          className={styles.modalOverlay}
          onClick={e =>
            e.target === e.currentTarget && setShowEquipmentModal(false)
          }
        >
          <div
            className={styles.modal}
            style={{
              ...modalStyle,
              maxWidth: 640,
              width: '92vw',
            }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Edit Equipment</div>

              <button
                className={styles.modalClose}
                onClick={() => setShowEquipmentModal(false)}
              >
                ✕
              </button>
            </div>

            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Racket</label>
                <input
                  className={styles.formInput}
                  value={form.racket}
                  onChange={set('racket')}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>String</label>
                <input
                  className={styles.formInput}
                  value={form.string}
                  onChange={set('string')}
                />
              </div>
            </div>

            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}>
                <label className={styles.formLabel}>Tension</label>
                <input
                  className={styles.formInput}
                  value={form.tension}
                  onChange={set('tension')}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Shoes</label>
                <input
                  className={styles.formInput}
                  value={form.shoes}
                  onChange={set('shoes')}
                />
              </div>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Last stringing</label>
              <input
                className={styles.formInput}
                value={form.lastStringing}
                onChange={set('lastStringing')}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 12,
              }}
            >
              <button
                className={styles.btnOutline}
                onClick={() => setShowEquipmentModal(false)}
              >
                Cancel
              </button>

              <button className={styles.btnPrimary} onClick={handleSaveEquipment}>
                Save Equipment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}