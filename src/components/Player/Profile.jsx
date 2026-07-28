import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'

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

const PROFILE_SKILL_COLORS = {
  Smash: '#2563EB',
  Defense: '#14B8A6',
  Footwork: '#8B5CF6',
  'Drop shot': '#F59E0B',
  'Net play': '#EC4899',
  Serve: '#06B6D4',
}

const getSkillColor = label => {
  const base = PROFILE_SKILL_COLORS[label] || '#2563EB'

  return {
    bar: `linear-gradient(
      90deg,
      color-mix(in srgb, ${base} 38%, var(--card, #FFFFFF)) 0%,
      color-mix(in srgb, ${base} 68%, var(--card, #FFFFFF)) 55%,
      ${base} 100%
    )`,
    text: base,
  }
}

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

const calculatePlayingExperience = (dateOfBirth, startedPlayingAge) => {
  const currentAge = Number(calculateAge(dateOfBirth))
  const startAge = Number(startedPlayingAge)

  if (
    !dateOfBirth ||
    startedPlayingAge === '' ||
    startedPlayingAge === null ||
    startedPlayingAge === undefined ||
    !Number.isFinite(currentAge) ||
    !Number.isFinite(startAge) ||
    startAge < 0 ||
    startAge > currentAge
  ) {
    return null
  }

  return currentAge - startAge
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
  const [joinedClubs, setJoinedClubs] = useState([])
  const [clubEntryMode, setClubEntryMode] = useState('none')

  const avatarInputRef = useRef(null)
  const mediaInputRef = useRef(null)

  const [avatarUrl, setAvatarUrl] = useState('')
  const [mediaItems, setMediaItems] = useState([])

  const [profileId, setProfileId] = useState(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const showLoader = useLoadingDelay(isLoadingProfile, 350)
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
    externalClub: '',
    state: '',
    racket: '',
    string: '',
    tension: '',
    shoes: '',
    lastStringing: '',
    instagram: '',
    showInstagram: true,
    bio: '',
    startedPlayingAge: '',
  })


  useEffect(() => {
    let mounted = true

    const loadProfileFromSupabase = async () => {
      setIsLoadingProfile(true)

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError || !authData?.user) return

        const authUser = authData.user

        const [appUserRes, setupRes, profileRes, membershipRes] = await Promise.all([
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
          supabase
            .from('club_members')
            .select('club_id, status, clubs(id, short_name, name)')
            .eq('user_id', authUser.id)
            .eq('status', 'accepted'),
        ])

        const appUser = appUserRes.data
        const setup = setupRes.data
        const profile = profileRes.data

        if (membershipRes.error) {
          console.error('Unable to load accepted club memberships:', membershipRes.error)
        }

        const acceptedClubs = (membershipRes.data || [])
          .map(item => {
            const club = Array.isArray(item.clubs) ? item.clubs[0] : item.clubs
            if (!club) return null

            return {
              id: club.id,
              shortName: String(club.short_name || '').trim().toUpperCase(),
              name: club.name || 'Unnamed club',
            }
          })
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name))

        let equipmentData = null
        let rating = null
        let matchRows = []
        let mediaData = []

        if (profile?.id) {
          setProfileId(profile.id)

          const [equipmentRes, ratingRes, matchesRes, mediaRes] = await Promise.all([
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
              .from('player_matches')
              .select('result')
              .eq('player_id', profile.id),
            supabase
              .from('player_profile_media')
              .select('*')
              .eq('player_id', profile.id)
              .order('created_at', { ascending: false }),
          ])

          equipmentData = equipmentRes.data
          rating = ratingRes.data
          matchRows = matchesRes.data || []
          mediaData = mediaRes.data || []
        }

        if (!mounted) return

        setSetupData(setup || null)
        setJoinedClubs(acceptedClubs)

        if (profile?.profile_photo_url) setAvatarUrl(profile.profile_photo_url)

        const savedClub = String(profile?.club || '').trim().toUpperCase()
        const stillAccepted = acceptedClubs.some(
          club => club.shortName === savedClub
        )
        const safeClubValue = stillAccepted
          ? savedClub
          : acceptedClubs.length === 1
            ? acceptedClubs[0].shortName
            : ''

        if (profile?.id && savedClub && !stillAccepted) {
          const { error: clearStaleClubError } = await supabase
            .from('player_profiles')
            .update({ club: null })
            .eq('id', profile.id)

          if (clearStaleClubError) {
            console.error('Unable to clear stale club from player profile:', clearStaleClubError)
          }
        }

        setForm(prev => ({
          ...prev,
          name: profile?.display_name || appUser?.full_name || authUser.email?.split('@')[0] || '',
          dateOfBirth: normaliseDateForSupabase(profile?.date_of_birth) || '',
          gender: profile?.gender || '',
          height: profile?.height_cm ? String(profile.height_cm) : '',
          weight: profile?.weight_kg ? String(profile.weight_kg) : '',
          hand: profile?.playing_hand || 'Right',
          club: safeClubValue,
          externalClub: profile?.external_club || '',
          state: profile?.state || '',
          bio: profile?.bio || '',
          startedPlayingAge:
            profile?.started_playing_age !== null &&
            profile?.started_playing_age !== undefined
              ? String(profile.started_playing_age)
              : '',
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
              const value = Number(rating[item.column] ?? 50)
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

        const wins = matchRows.filter(match => match.result === 'Win').length
        const losses = matchRows.filter(match => match.result === 'Loss').length

        setMatchSummary({
          total_matches: matchRows.length,
          wins,
          losses,
          win_rate: matchRows.length ? Math.round((wins / matchRows.length) * 100) : 0,
        })

        if (mediaData.length > 0) {
          setMediaItems(
            mediaData.map(item => ({
              id: item.id,
              type: item.media_type,
              title: item.title || item.file_name || 'Untitled media',
              name: item.file_name,
              url: item.media_url || item.file_url,
              fileType: item.file_type || item.mime_type || '',
              isFeatured: Boolean(item.is_featured),
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

  useEffect(() => {
    let active = true

    const refreshAcceptedClubs = async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError || !authData?.user) return

        const authUser = authData.user

        const { data, error } = await supabase
          .from('club_members')
          .select('club_id, status, clubs(id, short_name, name)')
          .eq('user_id', authUser.id)
          .eq('status', 'accepted')

        if (error) throw error
        if (!active) return

        const acceptedClubs = (data || [])
          .map(item => {
            const club = Array.isArray(item.clubs) ? item.clubs[0] : item.clubs
            if (!club) return null

            return {
              id: club.id,
              shortName: String(club.short_name || '').trim().toUpperCase(),
              name: club.name || 'Unnamed club',
            }
          })
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name))

        setJoinedClubs(acceptedClubs)

        setForm(previous => {
          const currentClub = String(previous.club || '').trim().toUpperCase()
          const stillAccepted = acceptedClubs.some(
            club => club.shortName === currentClub
          )

          if (stillAccepted) return previous

          return {
            ...previous,
            club: acceptedClubs.length === 1
              ? acceptedClubs[0].shortName
              : '',
          }
        })

        const { data: profileRow, error: profileError } = await supabase
          .from('player_profiles')
          .select('id, club')
          .eq('user_id', authUser.id)
          .maybeSingle()

        if (profileError) throw profileError

        const savedClub = String(profileRow?.club || '').trim().toUpperCase()
        const savedClubStillAccepted = acceptedClubs.some(
          club => club.shortName === savedClub
        )

        if (profileRow?.id && savedClub && !savedClubStillAccepted) {
          const { error: clearError } = await supabase
            .from('player_profiles')
            .update({ club: null })
            .eq('id', profileRow.id)

          if (clearError) throw clearError
        }
      } catch (error) {
        console.error('Unable to refresh accepted clubs:', error)
      }
    }

    const handleMembershipUpdated = () => {
      refreshAcceptedClubs()
    }

    window.addEventListener(
      'club-membership-updated',
      handleMembershipUpdated,
    )

    const channel = supabase
      .channel(`profile-club-membership-${user?.id || 'current'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'club_members',
        },
        () => refreshAcceptedClubs(),
      )
      .subscribe()

    return () => {
      active = false
      window.removeEventListener(
        'club-membership-updated',
        handleMembershipUpdated,
      )
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  useEffect(() => {
    if (!showProfileModal) return

    if (form.club) {
      setClubEntryMode(form.club)
    } else if (form.externalClub?.trim()) {
      setClubEntryMode('__external__')
    } else {
      setClubEntryMode('none')
    }
  }, [showProfileModal, form.club, form.externalClub])

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

  const displayedClub =
    form.club ||
    form.externalClub?.trim() ||
    'No club'

  const preferredEvent = setupData?.preferred_event || 'Not set'
  const playStyle = setupData?.play_style || 'Not set'
  const strength = setupData?.biggest_strength || 'Not set'
  const weakness =
    setupData?.biggest_weakness ||
    setupData?.current_weakness ||
    setupData?.weakness ||
    'Not set'

  const mindset =
    setupData?.player_type ||
    setupData?.under_pressure ||
    setupData?.pressure_reaction ||
    setupData?.mindset ||
    'Not set'
  const playerMindsetText = String(mindset).toLowerCase().includes('player') ? mindset : `${mindset} Player`
  const cleanInstagram = form.instagram.replace('@', '').trim()
  const playingExperience = calculatePlayingExperience(
    form.dateOfBirth,
    form.startedPlayingAge
  )

  const getSupabaseUser = async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) throw new Error('User not logged in')
    return authData.user
  }

  const getValidatedClubValue = () => {
    const selectedClub = String(form.club || '').trim().toUpperCase()

    if (!selectedClub) return null

    const isAccepted = joinedClubs.some(
      club => club.shortName === selectedClub
    )

    return isAccepted ? selectedClub : null
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
          club: getValidatedClubValue(),
          external_club: form.externalClub?.trim() || null,
          date_of_birth: form.dateOfBirth || null,
          age: form.dateOfBirth ? calculateAge(form.dateOfBirth) : null,
          gender: form.gender || null,
          height_cm: form.height ? Number(form.height) : null,
          weight_kg: form.weight ? Number(form.weight) : null,
          playing_hand: form.hand || null,
          started_playing_age:
            form.startedPlayingAge !== ''
              ? Number(form.startedPlayingAge)
              : null,
          experience_years: playingExperience,
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
          is_featured: false,
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
        isFeatured: Boolean(savedMedia.is_featured),
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

  const handleSetFeaturedVideo = async item => {
    if (!profileId || !item?.id || isSavingProfile) return

    if (!String(item.fileType || '').startsWith('video/')) {
      alert('Only videos can be selected as the featured playing video.')
      return
    }

    setIsSavingProfile(true)

    try {
      const { error: clearError } = await supabase
        .from('player_profile_media')
        .update({ is_featured: false })
        .eq('player_id', profileId)
        .eq('is_featured', true)

      if (clearError) throw clearError

      const { error: featureError } = await supabase
        .from('player_profile_media')
        .update({ is_featured: true })
        .eq('id', item.id)
        .eq('player_id', profileId)

      if (featureError) throw featureError

      setMediaItems(current =>
        current.map(media => ({
          ...media,
          isFeatured: media.id === item.id,
        }))
      )
    } catch (error) {
      console.error('Set featured video error:', error)
      alert(error.message || 'Failed to set the featured playing video')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleRemoveFeaturedVideo = async item => {
    if (!profileId || !item?.id || isSavingProfile) return

    setIsSavingProfile(true)

    try {
      const { error } = await supabase
        .from('player_profile_media')
        .update({ is_featured: false })
        .eq('id', item.id)
        .eq('player_id', profileId)

      if (error) throw error

      setMediaItems(current =>
        current.map(media =>
          media.id === item.id
            ? { ...media, isFeatured: false }
            : media
        )
      )
    } catch (error) {
      console.error('Remove featured video error:', error)
      alert(error.message || 'Failed to remove the featured playing video')
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
    if (clubEntryMode === '__external__' && !form.externalClub.trim()) {
      alert('Please enter your club name, or select No club.')
      return
    }

    if (clubEntryMode !== '__external__' && form.externalClub) {
      setForm(previous => ({
        ...previous,
        externalClub: '',
      }))
    }

    const currentAge = Number(calculateAge(form.dateOfBirth))
    const startAge = Number(form.startedPlayingAge)

    if (
      form.startedPlayingAge !== '' &&
      (!form.dateOfBirth ||
        !Number.isFinite(startAge) ||
        startAge < 0 ||
        !Number.isFinite(currentAge) ||
        startAge > currentAge)
    ) {
      alert('Starting age cannot be greater than your current age.')
      return
    }

    setIsSavingProfile(true)
    try {
      const authUser = await getSupabaseUser()
      await saveMainProfileToSupabase(authUser)

      const validatedClub = getValidatedClubValue()
      setForm(previous => ({
        ...previous,
        club: validatedClub || '',
      }))

      await supabase.from('app_users').update({ setup_completed: true }).eq('user_id', authUser.id)
      saveProfile?.({
        ...user,
        ...form,
        club: validatedClub || '',
        externalClub: form.externalClub?.trim() || '',
        name: form.name,
        avatarUrl,
      })
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
    {
      label: 'Total matches',
      value: matchSummary.total_matches,
      color: '#1A5FFF',
      bg: '#E8EFFE',
      icon: 'matches',
    },
    {
      label: 'Wins',
      value: matchSummary.wins,
      color: '#00C48C',
      bg: '#DDF8EF',
      icon: 'wins',
    },
    {
      label: 'Losses',
      value: matchSummary.losses,
      color: '#EF4444',
      bg: '#FEE2E2',
      icon: 'losses',
    },
    {
      label: 'Win rate',
      value: `${matchSummary.win_rate}%`,
      color: '#1A5FFF',
      bg: '#E8EFFE',
      icon: 'winRate',
    },
  ]

  const equipment = [
    { label: 'Racket', value: form.racket || '-' },
    { label: 'String', value: form.string || '-' },
    { label: 'Tension', value: form.tension ? `${form.tension} lbs` : '-' },
    { label: 'Shoes', value: form.shoes || '-' },
    { label: 'Last stringing', value: form.lastStringing ? formatDate(form.lastStringing) : '-' },
  ]

  const modalStyle = {
    background: 'var(--card, #FFFFFF)',
    color: 'var(--text, #0D1B3E)',
    border: '1px solid var(--line, #D9E2F0)',
    borderRadius: 20,
    boxShadow: '0 24px 70px rgba(15, 23, 42, 0.28)',
    padding: 28,
  }

  if (isLoadingProfile && !showLoader) {
    return null
  }

  if (showLoader) {
    return (
      <div className={styles.card}>
        <Loader text="Loading profile..." />
      </div>
    )
  }

  return (
    <div className="profileResponsivePage">
      <style>{`
        .profileResponsivePage {
          width: 100%;
          min-width: 0;
          overflow-x: hidden;
        }

        .profileHeaderRow {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .profileMainGrid {
          display: grid;
          grid-template-columns: minmax(260px, 3fr) minmax(0, 7fr);
          gap: 18px;
          align-items: start;
          width: 100%;
        }

        .profileLeftColumn,
        .profileRightColumn {
          min-width: 0;
        }

        .profileHeroCard {
          background: linear-gradient(180deg, #111827 0%, #0B1220 100%);
          border-radius: 22px;
          padding: 24px;
          color: #FFFFFF;
          margin-bottom: 16px;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
          min-width: 0;
        }

        .profileHeroTop {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 18px;
        }

        .profileTraitsGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .profileHeroActions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .profileStatsGrid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .profileStatCard {
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 18px;
          min-height: 106px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
          min-width: 0;
          overflow: hidden;
        }

        .profileStatIconBox {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 10px;
          flex-shrink: 0;
        }

        .profileSkillRow {
          display: grid;
          grid-template-columns: 78px minmax(0, 1fr) 44px;
          gap: 10px;
          align-items: center;
          margin-bottom: 14px;
        }

        .profileSkillLabel {
          font-size: 11px;
          color: var(--text-muted, #8892A4);
          min-width: 0;
        }

        .profileSkillTrack {
          position: relative;
          height: 8px;
          border-radius: 999px;
          background: var(--line, #EEF1F8);
          overflow: hidden;
        }

        .profileSkillFill {
          height: 100%;
          border-radius: 999px;
        }

        .profileSkillNumber {
          width: 44px;
          text-align: center;
          font-size: 11px;
          font-weight: 800;
          line-height: 1;
        }

        .profileSectionHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
          flex-wrap: wrap;
        }

        .profileMediaHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .profileMediaGrid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
        }

        @media (max-width: 900px) {
          .profileMainGrid {
            grid-template-columns: minmax(0, 1fr);
          }

          .profileLeftColumn,
          .profileRightColumn {
            width: 100%;
          }

          .profileStatsGrid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .profileHeaderRow {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }

          .profileEditButton {
            width: 100%;
          }

          .profileMainGrid {
            gap: 14px;
          }

          .profileHeroCard {
            padding: 18px;
            border-radius: 18px;
          }

          .profileHeroTop {
            gap: 12px;
          }

          .profileTraitsGrid {
            gap: 8px;
          }

          .profileStatsGrid {
            gap: 10px;
            margin-bottom: 14px;
          }

          .profileStatCard {
            min-height: 118px;
            padding: 16px;
          }

          .profileSectionHeader {
            align-items: flex-start;
          }

          .profileSectionHeader > div:last-child {
            max-width: 100%;
          }

          .profileMediaHeader {
            align-items: stretch;
            flex-direction: column;
          }

          .profileMediaHeader > div:last-child,
          .profileMediaHeader button {
            width: 100%;
          }

          .profileMediaGrid {
            grid-template-columns: minmax(0, 1fr);
          }

          .profileResponsivePage .${styles.g2} {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .profileSkillRow {
            grid-template-columns: 72px minmax(0, 1fr) 40px;
            gap: 8px;
          }

          .profileResponsivePage .${styles.statRow} {
            gap: 12px;
          }

          .profileResponsivePage .${styles.statVal} {
            max-width: 58%;
            text-align: right;
            overflow-wrap: anywhere;
          }
        }

        @media (max-width: 380px) {
          .profileTraitsGrid {
            grid-template-columns: minmax(0, 1fr);
          }

          .profileHeroActions {
            flex-direction: column;
          }

          .profileHeroActions button {
            width: 100%;
            min-height: 42px;
          }

          .profileSkillRow {
            grid-template-columns: 64px minmax(0, 1fr) 36px;
            gap: 6px;
          }
        }
      `}</style>
      <div className={styles.pageHead}>
        <div className="profileHeaderRow">
          <div>
            <div className={styles.pageTitle}>My Profile</div>
            <div className={styles.pageSub}>Personal, player and lifestyle information</div>
          </div>
          <button className={`${styles.btnPrimary} profileEditButton`} onClick={() => setShowProfileModal(true)}>Edit Profile</button>
        </div>
      </div>

      <div className="profileMainGrid">
        <div className="profileLeftColumn">
          <div className="profileHeroCard">
            <div className="profileHeroTop">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#93A4BC', fontWeight: 700, letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 8 }}>Player Profile</div>
                <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, color: '#FFFFFF', marginBottom: 6 }}>{name}</div>
                <div style={{ fontSize: 13, color: '#CBD5E1', lineHeight: 1.5 }}>{preferredEvent} Player · {form.state || 'Not set'}</div>
              </div>

              <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
                <button type="button" onClick={() => avatarInputRef.current?.click()} style={{ width: 76, height: 76, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.12)', overflow: 'hidden', background: '#1A5FFF', color: '#FFFFFF', fontSize: 22, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                  {avatarUrl ? <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
                </button>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  aria-label="Change profile photo"
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
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
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

            <div className="profileTraitsGrid">
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

            <div className="profileHeroActions">
              <button className={styles.btnOutline} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.12)' }} onClick={() => navigate('/setup?redo=1', { state: { returnTo: '/profile' } })}>Re-do setup</button>
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

              {
                label: 'Experience',
                value:
                  playingExperience !== null
                    ? `${playingExperience} ${playingExperience === 1 ? 'year' : 'years'}`
                    : '-',
              },
              { label: 'Club', value: displayedClub },
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

        <div className="profileRightColumn">
          <div className="profileStatsGrid">
            {stats.map(item => (
              <div key={item.label} className="profileStatCard">
                <div
                  className="profileStatIconBox"
                  style={{
                    background: item.bg,
                  }}
                >
                  <StatIcon
                    type={item.icon}
                    color={item.color}
                  />
                </div>

                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: item.color,
                    WebkitTextFillColor: item.color,
                    lineHeight: 1,
                  }}
                >
                  {item.value}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted, #8892A4)',
                    marginTop: 5,
                  }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.card} style={{ marginBottom: 16 }}>
            <div className="profileSectionHeader">
              <div className={styles.cardTitle}>Skill ratings</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#1A5FFF',
                    background:
                      'color-mix(in srgb, #1A5FFF 14%, var(--card, #FFFFFF))',
                    padding: '4px 9px',
                    borderRadius: 999,
                  }}
                >
                  Player assessment
                </span>

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted, #6B7280)',
                    background: 'var(--soft, #F3F4F6)',
                    padding: '4px 9px',
                    borderRadius: 999,
                  }}
                >
                  Updated by player
                </span>
              </div>
            </div>

            {skillsData.map(skill => {
              const skillColor = getSkillColor(skill.name)

              return (
                <div key={skill.name} className="profileSkillRow">
                  <div className="profileSkillLabel">
                    {skill.name}
                  </div>

                  <div className="profileSkillTrack">
                    <div
                      className="profileSkillFill"
                      style={{
                        width: `${skill.val}%`,
                        background: skillColor.bar,
                      }}
                    />
                  </div>

                  <div
                    className="profileSkillNumber"
                    style={{
                      color: skillColor.text,
                      WebkitTextFillColor: skillColor.text,
                    }}
                  >
                    {skill.val}
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 14 }}><button className={styles.btnOutline} onClick={() => navigate('/performance')}>Update ratings</button></div>
          </div>

          <div className={styles.card} style={{ marginBottom: 16 }}>
            <div className="profileSectionHeader" style={{ marginBottom: 10 }}>
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
            <div className="profileMediaHeader">
              <div className={styles.cardTitle}>Profile media</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={styles.btnPrimary} onClick={() => setShowMediaModal(true)}>Upload</button>
              </div>
            </div>

            <div
              style={{
                marginBottom: 12,
                fontSize: 11,
                lineHeight: 1.5,
                color: 'var(--text-muted, #8892A4)',
              }}
            >
              Upload multiple media items, then star one video to show it as your public Playing Video.
            </div>

            {mediaItems.length === 0 ? (
              <div style={{ padding: 22, background: 'var(--soft)', borderRadius: 14, color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>No media uploaded yet. Add images or videos.</div>
            ) : (
              <div className="profileMediaGrid">
                {mediaItems.map(item => (
                  <div key={item.id} style={{ background: 'var(--soft)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
                    <div
                      style={{
                        height: 110,
                        background:
                          'color-mix(in srgb, #1A5FFF 10%, var(--soft, #F6F8FF))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {item.fileType.startsWith('image/') ? <img src={item.url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <video src={item.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ padding: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title || item.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{item.name} · {item.date}</div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          marginTop: 9,
                        }}
                      >
                        {item.fileType.startsWith('video/') ? (
                          <button
                            type="button"
                            onClick={() =>
                              item.isFeatured
                                ? handleRemoveFeaturedVideo(item)
                                : handleSetFeaturedVideo(item)
                            }
                            disabled={isSavingProfile}
                            title={
                              item.isFeatured
                                ? 'Remove as featured playing video'
                                : 'Show this video on your public player profile'
                            }
                            style={{
                              border: item.isFeatured
                                ? '1px solid #F59E0B'
                                : '1px solid var(--line, #D8E1EF)',
                              background: item.isFeatured
                                ? '#FFF7E6'
                                : 'var(--card, #FFFFFF)',
                              color: item.isFeatured
                                ? '#B45309'
                                : 'var(--text-muted, #64748B)',
                              borderRadius: 9,
                              padding: '6px 9px',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: isSavingProfile ? 'wait' : 'pointer',
                            }}
                          >
                            {item.isFeatured ? '★ Featured' : '☆ Feature'}
                          </button>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            Images cannot be featured
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(item.id)}
                          disabled={isSavingProfile}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#EF4444',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: isSavingProfile ? 'wait' : 'pointer',
                            padding: 0,
                          }}
                        >
                          Remove
                        </button>
                      </div>
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
              <div className={styles.formRow}>
                <label className={styles.formLabel}>
                  At what age did you start playing badminton?
                </label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="0"
                  max={calculateAge(form.dateOfBirth) || 100}
                  placeholder="e.g. 12"
                  value={form.startedPlayingAge}
                  onChange={set('startedPlayingAge')}
                />
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color:
                      playingExperience !== null
                        ? '#10B981'
                        : 'var(--text-muted, #8892A4)',
                  }}
                >
                  {playingExperience !== null
                    ? `Estimated experience: ${playingExperience} ${
                        playingExperience === 1 ? 'year' : 'years'
                      }`
                    : 'Enter your date of birth and starting age to calculate experience.'}
                </div>
              </div>
            </div>
            <div className={styles.formRow}>
              <label className={styles.formLabel}>Club optional</label>

              <select
                className={styles.formSelect}
                value={clubEntryMode}
                onChange={event => {
                  const value = event.target.value
                  setClubEntryMode(value)

                  if (value === '__external__') {
                    setForm(previous => ({
                      ...previous,
                      club: '',
                    }))
                    return
                  }

                  if (value === 'none') {
                    setForm(previous => ({
                      ...previous,
                      club: '',
                      externalClub: '',
                    }))
                    return
                  }

                  setForm(previous => ({
                    ...previous,
                    club: value,
                    externalClub: '',
                  }))
                }}
              >
                <option value="none">No club</option>

                {joinedClubs.map(club => (
                  <option key={club.id} value={club.shortName}>
                    {club.shortName
                      ? `${club.shortName} · ${club.name}`
                      : club.name}
                  </option>
                ))}

                <option value="__external__">
                  Other club outside ShuttleTrack
                </option>
              </select>

              {clubEntryMode === '__external__' && (
                <input
                  className={styles.formInput}
                  value={form.externalClub}
                  onChange={set('externalClub')}
                  placeholder="Type your club name"
                  maxLength={120}
                  style={{ marginTop: 8 }}
                />
              )}

              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: 'var(--text-muted, #8892A4)',
                  lineHeight: 1.5,
                }}
              >
                Accepted ShuttleTrack clubs appear in the list. Choose
                “Other club outside ShuttleTrack” to enter a club manually.
              </div>
            </div>
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
                  border: '1.5px dashed var(--line, #C8D0E0)',
                  background: 'var(--soft, #F8FAFC)',
                  color: selectedMediaFile
                    ? '#00C48C'
                    : 'var(--text-muted, #64748B)',
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
                {selectedMediaFile ? (
                  <span>✓ Media selected</span>
                ) : (
                  <>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M12 16V4M7.5 8.5 12 4l4.5 4.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>Choose video or image</span>
                  </>
                )}
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
                    background: 'var(--soft, #F1F5F9)',
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