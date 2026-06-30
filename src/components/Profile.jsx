import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import styles from './Pages.module.css'

const skillColumns = [
  { name: 'Smash', column: 'smash' },
  { name: 'Defense', column: 'defense' },
  { name: 'Footwork', column: 'footwork' },
  { name: 'Drop shot', column: 'drop_shot' },
  { name: 'Net play', column: 'net_play' },
  { name: 'Serve', column: 'serve' },
]

const defaultSkills = skillColumns.map(skill => ({
  ...skill,
  val: 50,
  low: true,
  source: 'Self-reported',
  updatedBy: 'Player',
  updatedAt: 'Not updated',
}))

const normaliseDateForSupabase = value => {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

const formatDate = value => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}


const calculateAge = dob => {
  if (!dob) return ''

  const birthDate = new Date(dob)
  const today = new Date()

  if (Number.isNaN(birthDate.getTime())) return ''

  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  return age >= 0 ? age : ''
}

const StatIcon = ({ type, color }) => {
  const commonProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
  }

  if (type === 'matches') {
    return (
      <svg {...commonProps}>
        <rect x="5" y="4" width="14" height="16" rx="3" stroke={color} strokeWidth="2" />
        <path d="M9 8H15" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M9 12H15" stroke={color} strokeWidth="2" strokeLinecap="round" />
        <path d="M9 16H13" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  if (type === 'wins') {
    return (
      <svg {...commonProps}>
        <path d="M5 12.5L10 17L19 7" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (type === 'losses') {
    return (
      <svg {...commonProps}>
        <path d="M7 7L17 17" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
        <path d="M17 7L7 17" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <path d="M4 16L9 11L13 15L20 8" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 8H20V13" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Profile() {
  const { user, saveProfile } = useAuth()
  const navigate = useNavigate()

  const [showProfileModal, setShowProfileModal] = useState(false)
  const [showEquipmentModal, setShowEquipmentModal] = useState(false)
  const [showMediaModal, setShowMediaModal] = useState(false)
  const [mediaTitle, setMediaTitle] = useState('')
  const [selectedMediaFile, setSelectedMediaFile] = useState(null)
  const [setupData, setSetupData] = useState(null)

  const avatarInputRef = useRef(null)
  const mediaInputRef = useRef(null)

  const [avatarUrl, setAvatarUrl] = useState('')
  const [mediaItems, setMediaItems] = useState([])
  const mediaType = 'Profile Media'

  const [profileId, setProfileId] = useState(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [skillsData, setSkillsData] = useState(defaultSkills)
  const [matchSummary, setMatchSummary] = useState({
    total_matches: 0,
    wins: 0,
    losses: 0,
    win_rate: 0,
  })

  const [form, setForm] = useState({
    name: '',
    dateOfBirth: '',
    gender: '',
    height: '',
    weight: '',
    hand: 'Right',
    club: '',
    state: '',
    racket: '',
    string: '',
    tension: '',
    shoes: '',
    lastStringing: '',
    instagram: '',
    showInstagram: true,
    bio: '',
  })


  useEffect(() => {
    let mounted = true

    const loadProfileFromSupabase = async () => {
      setIsLoadingProfile(true)

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError || !authData?.user) return

        const authUser = authData.user

        const [appUserRes, setupRes, profileRes] = await Promise.all([
          supabase
            .from('app_users')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle(),
          supabase
            .from('player_setup')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle(),
          supabase
            .from('player_profiles')
            .select('*')
            .eq('user_id', authUser.id)
            .maybeSingle(),
        ])

        const appUser = appUserRes.data
        const setup = setupRes.data
        const profile = profileRes.data

        let equipmentData = null
        let rating = null
        let summary = null
        let mediaData = []

        if (profile?.id) {
          setProfileId(profile.id)

          const [equipmentRes, ratingRes, summaryRes, mediaRes] = await Promise.all([
            supabase
              .from('player_equipment')
              .select('*')
              .eq('player_id', profile.id)
              .maybeSingle(),
            supabase
              .from('player_skill_ratings')
              .select('*')
              .eq('player_id', profile.id)
              .maybeSingle(),
            supabase
              .from('player_match_summary')
              .select('*')
              .eq('player_id', profile.id)
              .maybeSingle(),
            supabase
              .from('player_profile_media')
              .select('*')
              .eq('player_id', profile.id)
              .order('created_at', { ascending: false }),
          ])

          equipmentData = equipmentRes.data
          rating = ratingRes.data
          summary = summaryRes.data
          mediaData = mediaRes.data || []
        }

        if (!mounted) return

        setSetupData(setup || null)

        if (profile?.profile_photo_url) setAvatarUrl(profile.profile_photo_url)

        setForm(prev => ({
          ...prev,
          name: profile?.display_name || appUser?.full_name || authUser.email?.split('@')[0] || '',
          dateOfBirth: normaliseDateForSupabase(profile?.date_of_birth) || '',
          gender: profile?.gender || '',
          height: profile?.height_cm ? String(profile.height_cm) : '',
          weight: profile?.weight_kg ? String(profile.weight_kg) : '',
          hand: profile?.playing_hand || 'Right',
          club: profile?.club || '',
          state: profile?.state || '',
          bio: profile?.bio || '',
          instagram: profile?.instagram || '',
          showInstagram: profile?.show_instagram ?? true,
          racket: equipmentData?.racket || '',
          string: equipmentData?.string || '',
          tension: equipmentData?.tension_lbs ? String(equipmentData.tension_lbs) : '',
          shoes: equipmentData?.shoes || '',
          lastStringing: normaliseDateForSupabase(equipmentData?.last_stringing_date) || '',
        }))

        if (rating) {
          setSkillsData(
            skillColumns.map(item => {
              const value = Number(rating[item.column] ?? 0)
              return {
                name: item.name,
                val: value,
                low: value < 70,
                source: rating.source || 'Self-reported',
                updatedBy: rating.updated_by_name || profile?.display_name || appUser?.full_name || 'Player',
                updatedAt: formatDate(rating.updated_at) || 'Not updated',
              }
            })
          )
        }

        if (summary) {
          setMatchSummary({
            total_matches: summary.total_matches ?? 0,
            wins: summary.wins ?? 0,
            losses: summary.losses ?? 0,
            win_rate: summary.win_rate ?? 0,
          })
        }

        if (mediaData.length > 0) {
          setMediaItems(
            mediaData.map(item => ({
              id: item.id,
              type: item.media_type,
              title: item.title || item.file_name || 'Untitled media',
              name: item.file_name,
              url: item.media_url || item.file_url,
              fileType: item.file_type || item.mime_type || '',
              date: formatDate(item.created_at),
            }))
          )
        }
      } catch (error) {
        console.error('Profile load error:', error)
      } finally {
        if (mounted) setIsLoadingProfile(false)
      }
    }

    loadProfileFromSupabase()

    return () => {
      mounted = false
    }
  }, [user?.id])

  const set = key => e => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
  }

  const name = form.name || 'Player'
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const preferredEvent = setupData?.preferred_event || 'Not set'
  const playStyle = setupData?.play_style || 'Not set'
  const strength = setupData?.biggest_strength || 'Not set'
  const weakness = setupData?.biggest_weakness || setupData?.weakness || 'Not set'
  const mindset = setupData?.player_type || setupData?.under_pressure || setupData?.mindset || 'Not set'
  const playerMindsetText = String(mindset).toLowerCase().includes('player') ? mindset : `${mindset} Player`
  const cleanInstagram = form.instagram.replace('@', '').trim()

  const getSupabaseUser = async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) throw new Error('User not logged in')
    return authData.user
  }

  const saveMainProfileToSupabase = async authUser => {
    const { data: appUser } = await supabase
      .from('app_users')
      .select('*')
      .eq('user_id', authUser.id)
      .maybeSingle()

    const { data: savedProfile, error } = await supabase
      .from('player_profiles')
      .upsert(
        {
          user_id: authUser.id,
          display_name: form.name || appUser?.full_name || authUser.email?.split('@')[0] || 'Player',
          player_category: preferredEvent,
          state: form.state || null,
          club: form.club || null,
          date_of_birth: form.dateOfBirth || null,
          age: form.dateOfBirth ? calculateAge(form.dateOfBirth) : null,
          gender: form.gender || null,
          height_cm: form.height ? Number(form.height) : null,
          weight_kg: form.weight ? Number(form.weight) : null,
          playing_hand: form.hand || null,
          bio: form.bio || null,
          instagram: form.instagram || null,
          show_instagram: form.showInstagram,
          profile_photo_url: avatarUrl || null,
          info_source: 'Self-reported',
        },
        { onConflict: 'user_id' }
      )
      .select('id')
      .single()

    if (error) throw error
    setProfileId(savedProfile.id)
    return savedProfile.id
  }

  const uploadFileToStorage = async ({ bucket, userId, file, prefix = '' }) => {
    const fileExt = file.name.split('.').pop()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${userId}/${prefix}${Date.now()}_${safeName}`

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: bucket === 'profile-avatars',
        contentType: file.type,
      })

    if (uploadError) throw uploadError

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)

    return {
      path: filePath,
      url: data.publicUrl,
      ext: fileExt,
    }
  }

  const handleAvatarChange = async e => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.')
      e.target.value = ''
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('Profile picture must be below 2MB.')
      e.target.value = ''
      return
    }

    setIsSavingProfile(true)

    try {
      const authUser = await getSupabaseUser()
      const currentProfileId = profileId || (await saveMainProfileToSupabase(authUser))

      const uploaded = await uploadFileToStorage({
        bucket: 'profile-avatars',
        userId: authUser.id,
        file,
        prefix: 'avatar_',
      })

      const { error } = await supabase
        .from('player_profiles')
        .update({ profile_photo_url: uploaded.url })
        .eq('id', currentProfileId)

      if (error) throw error

      setAvatarUrl(uploaded.url)
      saveProfile?.({ ...user, ...form, avatarUrl: uploaded.url })
      alert('Profile picture uploaded successfully')
    } catch (error) {
      console.error('Avatar upload error:', error)
      alert(error.message || 'Failed to upload profile picture')
    } finally {
      setIsSavingProfile(false)
      e.target.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    setIsSavingProfile(true)

    try {
      const authUser = await getSupabaseUser()
      const currentProfileId = profileId || (await saveMainProfileToSupabase(authUser))

      const { error } = await supabase
        .from('player_profiles')
        .update({ profile_photo_url: null })
        .eq('id', currentProfileId)

      if (error) throw error

      setAvatarUrl('')
      saveProfile?.({ ...user, ...form, avatarUrl: '' })
      alert('Profile picture removed')
    } catch (error) {
      console.error('Remove avatar error:', error)
      alert(error.message || 'Failed to remove profile picture')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleMediaFileChange = e => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      alert('Please upload an image or video file.')
      e.target.value = ''
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      alert('Profile media must be below 50MB.')
      e.target.value = ''
      return
    }

    setSelectedMediaFile(file)
  }

  const resetMediaModal = () => {
    setShowMediaModal(false)
    setMediaTitle('')
    setSelectedMediaFile(null)
    if (mediaInputRef.current) mediaInputRef.current.value = ''
  }

  const handleSaveMediaUpload = async () => {
    if (!selectedMediaFile) {
      alert('Please choose a video or image first.')
      return
    }

    if (!mediaTitle.trim()) {
      alert('Please enter a title.')
      return
    }

    setIsSavingProfile(true)

    try {
      const authUser = await getSupabaseUser()
      const currentProfileId = profileId || (await saveMainProfileToSupabase(authUser))

      const uploaded = await uploadFileToStorage({
        bucket: 'profile-media',
        userId: authUser.id,
        file: selectedMediaFile,
        prefix: 'media_',
      })

      const { data: savedMedia, error } = await supabase
        .from('player_profile_media')
        .insert({
          player_id: currentProfileId,
          title: mediaTitle.trim(),
          media_type: 'Profile Media',
          file_name: selectedMediaFile.name,
          media_url: uploaded.url,
          file_url: uploaded.url,
          file_type: selectedMediaFile.type,
        })
        .select('*')
        .single()

      if (error) throw error

      const newItem = {
        id: savedMedia.id,
        title: savedMedia.title || selectedMediaFile.name,
        type: savedMedia.media_type,
        name: savedMedia.file_name,
        url: savedMedia.media_url || savedMedia.file_url,
        fileType: savedMedia.file_type || selectedMediaFile.type,
        date: formatDate(savedMedia.created_at),
      }

      setMediaItems(prev => [newItem, ...prev])
      resetMediaModal()
      alert('Profile media uploaded successfully')
    } catch (error) {
      console.error('Media upload error:', error)
      alert(error.message || 'Failed to upload profile media')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleRemoveMedia = async id => {
    setIsSavingProfile(true)

    try {
      const { error } = await supabase
        .from('player_profile_media')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMediaItems(prev => prev.filter(item => item.id !== id))
    } catch (error) {
      console.error('Remove media error:', error)
      alert(error.message || 'Failed to remove media')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSaveProfile = async () => {
    setIsSavingProfile(true)
    try {
      const authUser = await getSupabaseUser()
      await saveMainProfileToSupabase(authUser)
      await supabase.from('app_users').update({ setup_completed: true }).eq('user_id', authUser.id)
      saveProfile?.({ ...user, ...form, name: form.name, avatarUrl })
      setShowProfileModal(false)
      alert('Profile saved successfully')
    } catch (error) {
      console.error('Profile save error:', error)
      alert(error.message || 'Failed to save profile')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSaveEquipment = async () => {
    setIsSavingProfile(true)
    try {
      const authUser = await getSupabaseUser()
      const currentProfileId = profileId || (await saveMainProfileToSupabase(authUser))

      const { error } = await supabase
        .from('player_equipment')
        .upsert(
          {
            player_id: currentProfileId,
            racket: form.racket || null,
            string: form.string || null,
            tension_lbs: form.tension ? parseInt(form.tension, 10) : null,
            shoes: form.shoes || null,
            last_stringing_date: normaliseDateForSupabase(form.lastStringing),
          },
          { onConflict: 'player_id' }
        )

      if (error) throw error
      setShowEquipmentModal(false)
      alert('Equipment saved successfully')
    } catch (error) {
      console.error('Equipment save error:', error)
      alert(error.message || 'Failed to save equipment')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const stats = [
    { label: 'Total matches', value: matchSummary.total_matches, color: '#1A5FFF', bg: '#E8EFFE', icon: 'matches' },
    { label: 'Wins', value: matchSummary.wins, color: '#00C48C', bg: '#E0FAF3', icon: 'wins' },
    { label: 'Losses', value: matchSummary.losses, color: '#EF4444', bg: '#FEE2E2', icon: 'losses' },
    { label: 'Win rate', value: `${matchSummary.win_rate}%`, color: '#1A5FFF', bg: '#E8EFFE', icon: 'winRate' },
  ]

  const equipment = [
    { label: 'Racket', value: form.racket || '-' },
    { label: 'String', value: form.string || '-' },
    { label: 'Tension', value: form.tension ? `${form.tension} lbs` : '-' },
    { label: 'Shoes', value: form.shoes || '-' },
    { label: 'Last stringing', value: form.lastStringing ? formatDate(form.lastStringing) : '-' },
  ]

  const skillSources = [...new Set(skillsData.map(skill => skill.source))]
  const skillSourceText = skillSources.length === 1 ? skillSources[0] : 'Mixed'
  const latestSkillUpdate = skillsData[0] || defaultSkills[0]

  const modalStyle = {
    background: '#FFFFFF',
    color: '#0D1B3E',
    border: '1px solid #D9E2F0',
    borderRadius: 20,
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.18)',
    padding: 28,
  }

  return (
    <div
      style={{
        opacity: isLoadingProfile ? 0.4 : 1,
        transition: 'opacity 160ms ease',
        pointerEvents: isLoadingProfile ? 'none' : 'auto',
      }}
    >
      <div className={styles.pageHead}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <div className={styles.pageTitle}>My Profile</div>
            <div className={styles.pageSub}>Personal, player and lifestyle information{isLoadingProfile ? ' · Loading saved profile...' : ''}</div>
          </div>
          <button className={styles.btnPrimary} onClick={() => setShowProfileModal(true)}>Edit Profile</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 7fr', gap: 18, alignItems: 'start', width: '100%' }}>
        <div>
          <div style={{ background: 'linear-gradient(180deg, #111827 0%, #0B1220 100%)', borderRadius: 22, padding: 24, color: '#FFFFFF', marginBottom: 16, boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#93A4BC', fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 }}>Player Profile</div>
                <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, color: '#FFFFFF', marginBottom: 6 }}>{name}</div>
                <div style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 1.5 }}>{preferredEvent} Player · {form.state || 'Not set'}</div>
              </div>

              <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
                <button type="button" onClick={() => avatarInputRef.current?.click()} style={{ width: 76, height: 76, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.12)', overflow: 'hidden', background: '#1A5FFF', color: '#FFFFFF', fontSize: 22, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  {avatarUrl ? <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                </button>
                <button type="button" onClick={() => avatarInputRef.current?.click()} style={{ position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: '50%', border: '2px solid #0B1220', background: '#1A5FFF', color: '#FFFFFF', cursor: 'pointer', fontSize: 12 }}>📷</button>
                <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              <span style={{ background: 'rgba(26, 95, 255, 0.18)', color: '#93C5FD', padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>{preferredEvent}</span>
              <span style={{ background: 'rgba(0, 196, 140, 0.15)', color: '#6EE7B7', padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>{playStyle}</span>
            </div>

            {form.showInstagram && cleanInstagram && (
              <a href={`https://instagram.com/${cleanInstagram}`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 12px', background: 'rgba(244, 114, 182, 0.16)', border: '1px solid rgba(244, 114, 182, 0.3)', borderRadius: 999, textDecoration: 'none', marginBottom: 14, maxWidth: '100%' }}>
                <span style={{ fontSize: 12, color: '#F9A8D4', fontWeight: 500, whiteSpace: 'nowrap' }}>@{cleanInstagram}</span>
              </a>
            )}

            <div style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.7, marginBottom: 18, fontWeight: 400 }}>{form.bio || 'No bio added yet.'}</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'Style', value: playStyle },
                { label: 'Strength', value: strength },
                { label: 'Weakness', value: weakness },
                { label: 'What player are you?', value: playerMindsetText },
              ].map(item => (
                <div key={item.label} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 12, minHeight: 58 }}>
                  <div style={{ fontSize: 10, color: '#93A4BC', fontWeight: 600, letterSpacing: 0.5 }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 400, marginTop: 5, lineHeight: 1.35 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className={styles.btnOutline} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.12)' }} onClick={() => navigate('/setup', { state: { returnTo: '/profile' } })}>Re-do setup</button>
              {avatarUrl && <button type="button" onClick={handleRemoveAvatar} style={{ border: 'none', background: 'rgba(239, 68, 68, 0.14)', color: '#FCA5A5', borderRadius: 10, padding: '0 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Remove photo</button>}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Personal info</div>
            {[
              { label: 'Age', value: form.dateOfBirth ? `${calculateAge(form.dateOfBirth)} years` : '-' },
              { label: 'Gender', value: form.gender || 'Prefer not to say' },
              { label: 'Height', value: form.height ? `${form.height} cm` : '-' },
              { label: 'Weight', value: form.weight ? `${form.weight} kg` : '-' },
              { label: 'Playing hand', value: form.hand || '-' },
              { label: 'Club', value: form.club || 'No club' },
              { label: 'State', value: form.state || '-' },
              { label: 'Personal info source', value: 'Self-reported' },
            ].map(item => (
              <div key={item.label} className={styles.statRow}>
                <span className={styles.statLabel}>{item.label}</span>
                <span className={styles.statVal}>{item.label === 'Personal info source' ? <span className={styles.badgeBlue}>{item.value}</span> : item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
            {stats.map(item => (
              <div key={item.label} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 18, minHeight: 106, boxShadow: '0 8px 20px rgba(15, 23, 42, 0.04)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><StatIcon type={item.icon} color={item.color} /></div>
                <div style={{ fontSize: 24, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 5 }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div className={styles.card} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <div className={styles.cardTitle}>Skill ratings</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1A5FFF', background: '#E8EFFE', padding: '4px 9px', borderRadius: 999 }}>Source: {skillSourceText}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', background: '#F3F4F6', padding: '4px 9px', borderRadius: 999 }}>Updated by: {latestSkillUpdate.updatedBy}</span>
              </div>
            </div>

            {skillsData.map(skill => (
              <div key={skill.name} className={styles.skillRow}>
                <div className={styles.skillLbl}>{skill.name}</div>
                <div className={styles.skillTrack}><div className={styles.skillFill} style={{ width: `${skill.val}%`, background: skill.low ? 'linear-gradient(90deg,#F59E0B,#FBBF24)' : 'linear-gradient(90deg,#1A5FFF,#3B7BFF)' }} /></div>
                <div className={styles.skillVal} style={{ color: skill.low ? '#F59E0B' : 'var(--text)' }}>{skill.val}</div>
              </div>
            ))}
            <div style={{ marginTop: 14 }}><button className={styles.btnOutline} onClick={() => navigate('/performance')}>Update ratings</button></div>
          </div>

          <div className={styles.card} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              <div className={styles.cardTitle}>Equipment</div>
              <button className={styles.btnOutline} onClick={() => setShowEquipmentModal(true)}>Edit equipment</button>
            </div>
            {equipment.map(item => (
              <div key={item.label} className={styles.statRow}>
                <span className={styles.statLabel}>{item.label}</span>
                <span className={styles.statVal}>{item.value}</span>
              </div>
            ))}
          </div>

          <div className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div className={styles.cardTitle}>Profile media</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.btnPrimary} onClick={() => setShowMediaModal(true)}>Upload</button>
              </div>
            </div>

            {mediaItems.length === 0 ? (
              <div style={{ padding: 22, background: 'var(--soft)', borderRadius: 14, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No media uploaded yet. Add images or videos.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                {mediaItems.map(item => (
                  <div key={item.id} style={{ background: 'var(--soft)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
                    <div style={{ height: 110, background: '#E8EFFE', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {item.fileType.startsWith('image/') ? <img src={item.url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <video src={item.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title || item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{item.name} · {item.date}</div>
                      <button onClick={() => handleRemoveMedia(item.id)} style={{ marginTop: 8, border: 'none', background: 'transparent', color: '#EF4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showProfileModal && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowProfileModal(false)}>
          <div className={styles.modal} style={{ ...modalStyle, maxWidth: 760, width: '92vw', maxHeight: '86vh', overflowY: 'auto' }}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Edit Profile</div>
              <button className={styles.modalClose} onClick={() => setShowProfileModal(false)}>✕</button>
            </div>

            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}><label className={styles.formLabel}>Full Name</label><input className={styles.formInput} value={form.name} onChange={set('name')} /></div>
              <div className={styles.formRow}><label className={styles.formLabel}>Date of birth</label><input className={styles.formInput} type="date" value={form.dateOfBirth || ''} onChange={set('dateOfBirth')} /></div>
            </div>
            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}><label className={styles.formLabel}>Gender optional</label><select className={styles.formSelect} value={form.gender} onChange={set('gender')}><option value="">Prefer not to say</option><option>Male</option><option>Female</option></select></div>
              <div className={styles.formRow}><label className={styles.formLabel}>Playing Hand</label><select className={styles.formSelect} value={form.hand} onChange={set('hand')}><option>Right</option><option>Left</option></select></div>
            </div>
            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}><label className={styles.formLabel}>Height cm</label><input className={styles.formInput} type="number" value={form.height} onChange={set('height')} /></div>
              <div className={styles.formRow}><label className={styles.formLabel}>Weight kg</label><input className={styles.formInput} type="number" value={form.weight} onChange={set('weight')} /></div>
            </div>
            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}><label className={styles.formLabel}>State</label><input className={styles.formInput} value={form.state} onChange={set('state')} /></div>
            </div>
            <div className={styles.formRow}><label className={styles.formLabel}>Club optional</label><input className={styles.formInput} placeholder="Optional" value={form.club} onChange={set('club')} /></div>
            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}><label className={styles.formLabel}>Instagram optional</label><input className={styles.formInput} placeholder="@yourusername" value={form.instagram} onChange={set('instagram')} /></div>
              <div className={styles.formRow}><label className={styles.formLabel}>Show Instagram publicly</label><select className={styles.formSelect} value={form.showInstagram ? 'Yes' : 'No'} onChange={e => setForm(prev => ({ ...prev, showInstagram: e.target.value === 'Yes' }))}><option>Yes</option><option>No</option></select></div>
            </div>
            <div className={styles.formRow}><label className={styles.formLabel}>Bio / badminton lifestyle</label><textarea className={styles.formInput} rows={4} value={form.bio} onChange={set('bio')} placeholder="Write something about your badminton lifestyle, training, goals or playing identity..." style={{ resize: 'vertical', minHeight: 100, fontFamily: 'inherit', lineHeight: 1.5 }} /></div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button className={styles.btnOutline} onClick={() => setShowProfileModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSaveProfile} disabled={isSavingProfile}>{isSavingProfile ? 'Saving...' : 'Save Profile'}</button>
            </div>
          </div>
        </div>
      )}

      {showEquipmentModal && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowEquipmentModal(false)}>
          <div className={styles.modal} style={{ ...modalStyle, maxWidth: 640, width: '92vw' }}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Edit Equipment</div>
              <button className={styles.modalClose} onClick={() => setShowEquipmentModal(false)}>✕</button>
            </div>
            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}><label className={styles.formLabel}>Racket</label><input className={styles.formInput} value={form.racket} onChange={set('racket')} /></div>
              <div className={styles.formRow}><label className={styles.formLabel}>String</label><input className={styles.formInput} value={form.string} onChange={set('string')} /></div>
            </div>
            <div className={styles.g2} style={{ marginBottom: 0 }}>
              <div className={styles.formRow}><label className={styles.formLabel}>Tension</label><input className={styles.formInput} value={form.tension} onChange={set('tension')} /></div>
              <div className={styles.formRow}><label className={styles.formLabel}>Shoes</label><input className={styles.formInput} value={form.shoes} onChange={set('shoes')} /></div>
            </div>
            <div className={styles.formRow}><label className={styles.formLabel}>Last stringing</label><input className={styles.formInput} type="date" value={form.lastStringing || ''} onChange={set('lastStringing')} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button className={styles.btnOutline} onClick={() => setShowEquipmentModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSaveEquipment} disabled={isSavingProfile}>{isSavingProfile ? 'Saving...' : 'Save Equipment'}</button>
            </div>
          </div>
        </div>
      )}

      {showMediaModal && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && resetMediaModal()}>
          <div className={styles.modal} style={{ ...modalStyle, maxWidth: 560, width: '92vw' }}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Upload Profile Media</div>
              <button className={styles.modalClose} onClick={resetMediaModal}>✕</button>
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Video / media title</label>
              <input
                className={styles.formInput}
                placeholder="Example: Backhand training clip"
                value={mediaTitle}
                onChange={e => setMediaTitle(e.target.value)}
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Choose video or image</label>
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleMediaFileChange}
                style={{ display: 'none' }}
              />

              <button
                type="button"
                onClick={() => mediaInputRef.current?.click()}
                style={{
                  width: '100%',
                  minHeight: 56,
                  borderRadius: 14,
                  border: '1.5px dashed #C8D0E0',
                  background: '#F8FAFC',
                  color: selectedMediaFile ? '#00C48C' : '#64748B',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  textAlign: 'center',
                }}
              >
                <span>{selectedMediaFile ? '✓ Media selected' : '⬆ Choose video or image'}</span>
              </button>

              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Maximum file size: 50MB
              </div>
              {selectedMediaFile && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text)',
                    marginTop: 8,
                    background: '#F1F5F9',
                    borderRadius: 10,
                    padding: '8px 10px',
                    wordBreak: 'break-word',
                  }}
                >
                  Selected: {selectedMediaFile.name}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button className={styles.btnOutline} onClick={resetMediaModal}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleSaveMediaUpload} disabled={isSavingProfile}>
                {isSavingProfile ? 'Uploading...' : 'Save Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
