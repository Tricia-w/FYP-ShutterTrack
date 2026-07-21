import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'
import { CoachPageHeader } from './CoachShared'

const SPECIALTY_OPTIONS = [
  'Singles',
  'Doubles',
  'Mixed Doubles',
  'Technique and Footwork',
  'Fitness and Conditioning',
  'Junior Development',
  'Match Strategy',
  'Beginner Coaching',
]

const PLAYER_LEVEL_OPTIONS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Competitive',
]

const SESSION_TYPE_OPTIONS = [
  'Private Coaching',
  'Small Group',
  'Large Group',
  'Online Consultation',
]

const COACHING_LEVEL_OPTIONS = [
  'Community Coach',
  'Assistant Coach',
  'Club Coach',
  'State Coach',
  'National Coach',
  'Independent Coach',
]

const MALAYSIA_STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Melaka',
  'Negeri Sembilan',
  'Pahang',
  'Penang',
  'Perak',
  'Perlis',
  'Sabah',
  'Sarawak',
  'Selangor',
  'Terengganu',
  'Kuala Lumpur',
  'Labuan',
  'Putrajaya',
]

const EMPTY_FORM = {
  display_name: '',
  headline: '',
  club: '',
  state: '',
  coaching_level: 'Community Coach',
  experience_years: '',
  specialties: [],
  player_levels: [],
  session_types: [],
  certification: '',
  certification_issuer: '',
  certification_file_url: '',
  player_capacity: '10',
  accepting_players: true,
  training_venue: '',
  availability: '',
  phone: '',
  instagram: '',
  bio: '',
  coaching_philosophy: '',
  achievements: '',
  avatar_url: '',
}

function initials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'CO'
  )
}

function MultiChoice({ label, options, values, onChange }) {
  const toggleValue = value => {
    onChange(
      values.includes(value)
        ? values.filter(item => item !== value)
        : [...values, value]
    )
  }

  return (
    <div className={styles.formRow}>
      <label className={styles.formLabel}>{label}</label>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(option => {
          const selected = values.includes(option)

          return (
            <button
              key={option}
              type="button"
              onClick={() => toggleValue(option)}
              style={{
                border: selected
                  ? '1px solid #1A5FFF'
                  : '1px solid var(--line, #DDE3F0)',
                background: selected ? '#E8EFFE' : 'var(--card, #FFFFFF)',
                color: selected ? '#1A5FFF' : 'var(--text, #0D1B3E)',
                borderRadius: 999,
                padding: '7px 11px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {selected ? '✓ ' : ''}
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CoachProfile() {
  const { user, profile } = useAuth()

  const [form, setForm] = useState(EMPTY_FORM)
  const avatarInputRef = useRef(null)
  const certificationInputRef = useRef(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCertification, setUploadingCertification] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const showLoader = useLoadingDelay(loading, 350)

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setMessage('')

    const { data, error } = await supabase
      .from('coach_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Failed to load coach profile:', error)
      setMessageType('error')
      setMessage(error.message || 'Failed to load coach profile.')
      setLoading(false)
      return
    }

    setForm({
      display_name:
        data?.display_name ||
        profile?.display_name ||
        profile?.full_name ||
        user?.user_metadata?.display_name ||
        user?.user_metadata?.full_name ||
        '',
      headline: data?.headline || '',
      club:
        data?.club ||
        profile?.club ||
        profile?.club_name ||
        user?.user_metadata?.club ||
        '',
      state: data?.state || profile?.state || profile?.location || '',
      coaching_level: data?.coaching_level || 'Community Coach',
      experience_years:
        data?.experience_years === null ||
        data?.experience_years === undefined
          ? ''
          : String(data.experience_years),
      specialties: Array.isArray(data?.specialties) ? data.specialties : [],
      player_levels: Array.isArray(data?.player_levels)
        ? data.player_levels
        : [],
      session_types: Array.isArray(data?.session_types)
        ? data.session_types
        : [],
      certification:
        data?.certification === 'Not provided'
          ? ''
          : data?.certification || '',
      certification_issuer: data?.certification_issuer || '',
      certification_file_url: data?.certification_file_url || '',
      player_capacity:
        data?.player_capacity === null ||
        data?.player_capacity === undefined
          ? '10'
          : String(data.player_capacity),
      accepting_players: data?.accepting_players ?? true,
      training_venue: data?.training_venue || '',
      availability: data?.availability || '',
      phone: data?.phone || profile?.phone || '',
      instagram: data?.instagram || '',
      bio: data?.bio || profile?.bio || '',
      coaching_philosophy: data?.coaching_philosophy || '',
      achievements: data?.achievements || '',
      avatar_url: data?.avatar_url || '',
    })

    setLoading(false)
  }, [profile, user])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const updateField = (field, value) => {
    setForm(current => ({
      ...current,
      [field]: value,
    }))
    setMessage('')
  }

  const completion = useMemo(() => {
    const checks = [
      form.display_name,
      form.headline,
      form.club,
      form.state,
      form.coaching_level,
      form.experience_years !== '',
      form.specialties.length > 0,
      form.player_levels.length > 0,
      form.session_types.length > 0,
      form.certification,
      form.certification_file_url,
      form.training_venue,
      form.availability,
      form.bio,
    ]

    return Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    )
  }, [form])

  const getCurrentUser = async () => {
    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser()

    if (error || !currentUser) {
      throw new Error('User not logged in.')
    }

    return currentUser
  }

  const uploadCoachAvatar = async file => {
    const currentUser = await getCurrentUser()

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${currentUser.id}/coach_avatar_${Date.now()}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from('profile-avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      })

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('profile-avatars')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  const handleAvatarChange = async event => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMessageType('error')
      setMessage('Please choose an image file.')
      event.target.value = ''
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessageType('error')
      setMessage('Profile picture must be below 2MB.')
      event.target.value = ''
      return
    }

    setUploadingAvatar(true)
    setMessage('')

    try {
      const avatarUrl = await uploadCoachAvatar(file)

      const { error } = await supabase
        .from('coach_profiles')
        .upsert(
          {
            user_id: user.id,
            display_name: form.display_name.trim() || 'Coach',
            avatar_url: avatarUrl,
          },
          { onConflict: 'user_id' }
        )

      if (error) throw error

      updateField('avatar_url', avatarUrl)

      const avatarKey = `profileAvatar:${user?.id || user?.email || 'default'}`
      localStorage.setItem(avatarKey, avatarUrl)
      window.dispatchEvent(new Event('avatar-updated'))

      setMessageType('success')
      setMessage('Profile picture updated successfully.')
    } catch (error) {
      console.error('Coach avatar upload error:', error)
      setMessageType('error')
      setMessage(error.message || 'Failed to upload profile picture.')
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    if (!user?.id) return

    setUploadingAvatar(true)
    setMessage('')

    try {
      const { error } = await supabase
        .from('coach_profiles')
        .upsert(
          {
            user_id: user.id,
            display_name: form.display_name.trim() || 'Coach',
            avatar_url: null,
          },
          { onConflict: 'user_id' }
        )

      if (error) throw error

      updateField('avatar_url', '')

      const avatarKey = `profileAvatar:${user?.id || user?.email || 'default'}`
      localStorage.removeItem(avatarKey)
      window.dispatchEvent(new Event('avatar-updated'))

      setMessageType('success')
      setMessage('Profile picture removed.')
    } catch (error) {
      console.error('Coach avatar remove error:', error)
      setMessageType('error')
      setMessage(error.message || 'Failed to remove profile picture.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleCertificationChange = async event => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ]

    if (!allowedTypes.includes(file.type)) {
      setMessageType('error')
      setMessage('Please upload a PDF, JPG, PNG or WebP certificate.')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessageType('error')
      setMessage('Certification file must be below 5MB.')
      event.target.value = ''
      return
    }

    setUploadingCertification(true)
    setMessage('')

    try {
      const currentUser = await getCurrentUser()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${currentUser.id}/certificate_${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('coach-certifications')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('coach-certifications')
        .getPublicUrl(filePath)

      updateField('certification_file_url', data.publicUrl)
      setMessageType('success')
      setMessage('Certification file uploaded successfully.')
    } catch (error) {
      console.error('Certification upload error:', error)
      setMessageType('error')
      setMessage(error.message || 'Failed to upload certification file.')
    } finally {
      setUploadingCertification(false)
      event.target.value = ''
    }
  }

  const handleRemoveCertification = () => {
    updateField('certification_file_url', '')
    setMessageType('success')
    setMessage('Certification file removed from the profile.')
  }

  const handleSave = async event => {
    event.preventDefault()

    if (!user?.id) {
      setMessageType('error')
      setMessage('Please log in again.')
      return
    }

    if (!form.display_name.trim()) {
      setMessageType('error')
      setMessage('Display name is required.')
      return
    }

    setSaving(true)
    setMessage('')

    const payload = {
      user_id: user.id,
      display_name: form.display_name.trim(),
      headline: form.headline.trim() || null,
      club: form.club.trim() || null,
      state: form.state.trim() || null,
      coaching_level: form.coaching_level,
      experience_years: Number(form.experience_years) || 0,
      specialties: form.specialties,
      player_levels: form.player_levels,
      session_types: form.session_types,
      certification: form.certification.trim() || null,
      certification_issuer: form.certification_issuer.trim() || null,
      certification_file_url: form.certification_file_url || null,
      player_capacity: Math.max(1, Number(form.player_capacity) || 10),
      accepting_players: Boolean(form.accepting_players),
      training_venue: form.training_venue.trim() || null,
      availability: form.availability.trim() || null,
      phone: form.phone.trim() || null,
      instagram: form.instagram.trim() || null,
      bio: form.bio.trim() || null,
      coaching_philosophy: form.coaching_philosophy.trim() || null,
      achievements: form.achievements.trim() || null,
      avatar_url: form.avatar_url.trim() || null,
    }

    const { data, error } = await supabase
      .from('coach_profiles')
      .upsert(payload, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    setSaving(false)

    if (error) {
      console.error('Failed to save coach profile:', error)
      setMessageType('error')
      setMessage(error.message || 'Failed to save coach profile.')
      return
    }

    window.dispatchEvent(
      new CustomEvent('profile-updated', {
        detail: {
          display_name: data.display_name,
          club: data.club,
        },
      })
    )

    setMessageType('success')
    setMessage('Coach profile saved. Players can now see the updated details.')
  }

  if (loading && !showLoader) {
    return null
  }

  if (showLoader) {
    return (
      <div className={styles.card}>
        <Loader text="Loading coach profile..." />
      </div>
    )
  }

  return (
    <div>
      <CoachPageHeader
        title="Coach Profile"
        subtitle="Build a profile that helps players understand your coaching services"
        showActions={false}
      />

      <form onSubmit={handleSave}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(300px, 0.65fr)',
            gap: 16,
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className={styles.card}>
              <div className={styles.cardTitle}>Public identity</div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '4px 0 18px',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: 82,
                    height: 82,
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label="Change coach profile picture"
                    style={{
                      width: 82,
                      height: 82,
                      padding: 0,
                      borderRadius: '50%',
                      overflow: 'hidden',
                      border: '3px solid #E8EFFE',
                      background: '#1A5FFF',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 22,
                      fontWeight: 800,
                      cursor: uploadingAvatar ? 'wait' : 'pointer',
                    }}
                  >
                    {form.avatar_url ? (
                      <img
                        src={form.avatar_url}
                        alt="Coach profile"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      initials(form.display_name)
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label="Upload coach profile picture"
                    style={{
                      position: 'absolute',
                      right: -2,
                      bottom: -2,
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      border: '2px solid #FFFFFF',
                      background: '#1A5FFF',
                      color: '#FFFFFF',
                      cursor: uploadingAvatar ? 'wait' : 'pointer',
                      fontSize: 13,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M8.5 6.5 10 4h4l1.5 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h3.5Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="13"
                        r="3.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </button>

                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarChange}
                    style={{ display: 'none' }}
                  />
                </div>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: '#0D1B3E',
                    }}
                  >
                    Coach profile picture
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: '#8892A4',
                      lineHeight: 1.5,
                      marginTop: 4,
                    }}
                  >
                    Click the picture or camera button to upload. JPG, PNG or
                    WebP, maximum 2MB.
                  </div>

                  {form.avatar_url && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                      style={{
                        marginTop: 8,
                        border: 'none',
                        background: 'transparent',
                        color: '#DC2626',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: uploadingAvatar ? 'wait' : 'pointer',
                        padding: 0,
                      }}
                    >
                      Remove photo
                    </button>
                  )}

                  {uploadingAvatar && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12,
                        color: '#1A5FFF',
                        fontWeight: 700,
                      }}
                    >
                      Uploading picture...
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Display name *</label>
                <input
                  className={styles.formInput}
                  value={form.display_name}
                  onChange={event =>
                    updateField('display_name', event.target.value)
                  }
                  placeholder="Your coaching name"
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Profile headline</label>
                <input
                  className={styles.formInput}
                  value={form.headline}
                  onChange={event =>
                    updateField('headline', event.target.value)
                  }
                  placeholder="Helping players improve footwork and match confidence"
                />
              </div>

              <div className={styles.g2} style={{ marginBottom: 0 }}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Club or academy</label>
                  <input
                    className={styles.formInput}
                    value={form.club}
                    onChange={event =>
                      updateField('club', event.target.value)
                    }
                    placeholder="Penang Badminton Club"
                  />
                </div>

                <div className={styles.formRow}>
                  <label className={styles.formLabel}>State</label>
                  <select
                    className={styles.formSelect}
                    value={form.state}
                    onChange={event =>
                      updateField('state', event.target.value)
                    }
                  >
                    <option value="">Select state</option>
                    {MALAYSIA_STATES.map(state => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Coaching background</div>

              <div className={styles.g2} style={{ marginBottom: 0 }}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Coaching level</label>
                  <select
                    className={styles.formSelect}
                    value={form.coaching_level}
                    onChange={event =>
                      updateField('coaching_level', event.target.value)
                    }
                  >
                    {COACHING_LEVEL_OPTIONS.map(option => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formRow}>
                  <label className={styles.formLabel}>
                    Years of experience
                  </label>
                  <input
                    className={styles.formInput}
                    type="number"
                    min="0"
                    max="80"
                    value={form.experience_years}
                    onChange={event =>
                      updateField('experience_years', event.target.value)
                    }
                    placeholder="5"
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Certification name</label>
                <input
                  className={styles.formInput}
                  value={form.certification}
                  onChange={event =>
                    updateField('certification', event.target.value)
                  }
                  placeholder="e.g. BAM Level 1"
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Issued by</label>
                <input
                  className={styles.formInput}
                  value={form.certification_issuer}
                  onChange={event =>
                    updateField('certification_issuer', event.target.value)
                  }
                  placeholder="e.g. Badminton Association of Malaysia"
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Certification proof</label>

                <input
                  ref={certificationInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handleCertificationChange}
                  style={{ display: 'none' }}
                />

                <button
                  type="button"
                  className={styles.btnOutline}
                  onClick={() => certificationInputRef.current?.click()}
                  disabled={uploadingCertification}
                  style={{ width: '100%' }}
                >
                  {uploadingCertification
                    ? 'Uploading certificate...'
                    : form.certification_file_url
                      ? 'Replace certificate file'
                      : 'Upload certificate PDF or image'}
                </button>

                {form.certification_file_url && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                      alignItems: 'center',
                      marginTop: 10,
                      flexWrap: 'wrap',
                    }}
                  >
                    <a
                      href={form.certification_file_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: '#1A5FFF',
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      View uploaded certificate
                    </a>

                    <button
                      type="button"
                      onClick={handleRemoveCertification}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#DC2626',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div
                  style={{
                    fontSize: 11,
                    color: '#8892A4',
                    marginTop: 6,
                  }}
                >
                  Accepted: PDF, JPG, PNG or WebP. Maximum 5MB.
                </div>
              </div>

              <MultiChoice
                label="Coaching specialties"
                options={SPECIALTY_OPTIONS}
                values={form.specialties}
                onChange={value => updateField('specialties', value)}
              />

              <MultiChoice
                label="Player levels accepted"
                options={PLAYER_LEVEL_OPTIONS}
                values={form.player_levels}
                onChange={value => updateField('player_levels', value)}
              />

              <MultiChoice
                label="Session types"
                options={SESSION_TYPE_OPTIONS}
                values={form.session_types}
                onChange={value => updateField('session_types', value)}
              />
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>Availability and contact</div>

              <div className={styles.g2} style={{ marginBottom: 0 }}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Player capacity</label>
                  <input
                    className={styles.formInput}
                    type="number"
                    min="1"
                    max="500"
                    value={form.player_capacity}
                    onChange={event =>
                      updateField('player_capacity', event.target.value)
                    }
                  />
                </div>

                <div className={styles.formRow}>
                  <label className={styles.formLabel}>
                    Accepting new players
                  </label>
                  <select
                    className={styles.formSelect}
                    value={form.accepting_players ? 'Yes' : 'No'}
                    onChange={event =>
                      updateField(
                        'accepting_players',
                        event.target.value === 'Yes'
                      )
                    }
                  >
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Training venue</label>
                <input
                  className={styles.formInput}
                  value={form.training_venue}
                  onChange={event =>
                    updateField('training_venue', event.target.value)
                  }
                  placeholder="Where do you usually conduct training?"
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Availability</label>
                <input
                  className={styles.formInput}
                  value={form.availability}
                  onChange={event =>
                    updateField('availability', event.target.value)
                  }
                  placeholder="Weekdays after 6 PM and weekends"
                />
              </div>

              <div className={styles.g2} style={{ marginBottom: 0 }}>
                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Contact number</label>
                  <input
                    className={styles.formInput}
                    value={form.phone}
                    onChange={event =>
                      updateField('phone', event.target.value)
                    }
                    placeholder="Optional"
                  />
                </div>

                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Instagram</label>
                  <input
                    className={styles.formInput}
                    value={form.instagram}
                    onChange={event =>
                      updateField('instagram', event.target.value)
                    }
                    placeholder="@coachname"
                  />
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardTitle}>About your coaching</div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>About coach</label>
                <textarea
                  className={styles.formInput}
                  rows={5}
                  value={form.bio}
                  onChange={event => updateField('bio', event.target.value)}
                  placeholder="Introduce your coaching background and the players you usually support."
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  Coaching philosophy
                </label>
                <textarea
                  className={styles.formInput}
                  rows={4}
                  value={form.coaching_philosophy}
                  onChange={event =>
                    updateField('coaching_philosophy', event.target.value)
                  }
                  placeholder="Describe your training approach."
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>

              <div className={styles.formRow}>
                <label className={styles.formLabel}>Achievements</label>
                <textarea
                  className={styles.formInput}
                  rows={4}
                  value={form.achievements}
                  onChange={event =>
                    updateField('achievements', event.target.value)
                  }
                  placeholder="Competitions, coaching milestones or player results."
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            </div>
          </div>

          <div
            className={styles.card}
            style={{ position: 'sticky', top: 20 }}
          >
            <div className={styles.cardTitle}>Player preview</div>

            <div
              style={{
                height: 8,
                background: '#EEF1F8',
                borderRadius: 999,
                overflow: 'hidden',
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: `${completion}%`,
                  height: '100%',
                  background: '#1A5FFF',
                }}
              />
            </div>

            <div style={{ fontSize: 11, color: '#8892A4', marginBottom: 18 }}>
              {completion === 100
                ? 'Profile complete'
                : completion >= 80
                  ? 'Profile almost complete'
                  : `Profile completion: ${completion}%`}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 14,
              }}
            >
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt=""
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: '#E8EFFE',
                    color: '#1A5FFF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                  }}
                >
                  {initials(form.display_name)}
                </div>
              )}

              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0D1B3E' }}>
                  {form.display_name || 'Your coach name'}
                </div>
                <div style={{ fontSize: 12, color: '#8892A4' }}>
                  {form.club || 'Club'} · {form.state || 'State'}
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                color: '#0D1B3E',
                lineHeight: 1.6,
                marginBottom: 14,
              }}
            >
              {form.headline || 'Add a short headline that explains how you help players.'}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span className={styles.badgeBlue}>
                {form.coaching_level}
              </span>

              <span
                className={
                  form.accepting_players
                    ? styles.badgeGreen
                    : styles.badgeGray
                }
              >
                {form.accepting_players
                  ? 'Accepting players'
                  : 'Not accepting players'}
              </span>

              {form.specialties.slice(0, 3).map(item => (
                <span key={item} className={styles.badgeGray}>
                  {item}
                </span>
              ))}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 16,
              }}
            >
              <div
                style={{
                  background: '#F6F8FF',
                  padding: 10,
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 10, color: '#8892A4' }}>
                  Experience
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1A5FFF' }}>
                  {Number(form.experience_years) || 0} years
                </div>
              </div>

              <div
                style={{
                  background: '#F6F8FF',
                  padding: 10,
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 10, color: '#8892A4' }}>
                  Capacity
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0D1B3E' }}>
                  Up to {Number(form.player_capacity) || 10}
                </div>
              </div>
            </div>

            {(form.certification || form.certification_file_url) && (
              <div
                style={{
                  marginTop: 16,
                  padding: '11px 12px',
                  background: '#F6F8FF',
                  borderRadius: 10,
                  border: '1px solid #EEF1F8',
                }}
              >
                <div style={{ fontSize: 10, color: '#8892A4' }}>
                  Certification
                </div>

                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#0D1B3E',
                    marginTop: 3,
                  }}
                >
                  {form.certification || 'Certificate uploaded'}
                </div>

                {form.certification_issuer && (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#8892A4',
                      marginTop: 3,
                    }}
                  >
                    Issued by {form.certification_issuer}
                  </div>
                )}

                {form.certification_file_url && (
                  <a
                    href={form.certification_file_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      marginTop: 7,
                      color: '#1A5FFF',
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    View certificate
                  </a>
                )}
              </div>
            )}

            <div
              style={{
                borderTop: '1px solid #EEF1F8',
                marginTop: 16,
                paddingTop: 14,
                fontSize: 13,
                color: '#0D1B3E',
                lineHeight: 1.65,
                whiteSpace: 'pre-wrap',
              }}
            >
              {form.bio || 'Your biography will appear here.'}
            </div>
          </div>
        </div>

        <div
          className={styles.card}
          style={{
            marginTop: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              fontSize: 13,
              color:
                messageType === 'error'
                  ? '#DC2626'
                  : message
                    ? '#00976C'
                    : '#8892A4',
            }}
          >
            {message || 'Saved details will appear in Find Coach.'}
          </div>

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving}
            style={{ opacity: saving ? 0.65 : 1 }}
          >
            {saving ? 'Saving...' : 'Save coach profile'}
          </button>
        </div>
      </form>
    </div>
  )
}