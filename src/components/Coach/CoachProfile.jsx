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
  const relevantCertificationInputRef = useRef(null)
  const [relevantCertificates, setRelevantCertificates] = useState([])
  const [trainingVenues, setTrainingVenues] = useState([])
  const [activeRelevantCertificateId, setActiveRelevantCertificateId] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCertification, setUploadingCertification] = useState(false)
  const [uploadingRelevantCertificate, setUploadingRelevantCertificate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [autosaveStatus, setAutosaveStatus] = useState('Saved')
  const [verificationStatus, setVerificationStatus] = useState('pending')
  const [rejectionReason, setRejectionReason] = useState('')
  const [verifiedAt, setVerifiedAt] = useState(null)
  const [resubmitting, setResubmitting] = useState(false)
  const initialLoadCompleteRef = useRef(false)
  const lastSavedSnapshotRef = useRef('')
  const showLoader = useLoadingDelay(loading, 350)

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    setMessage('')
    initialLoadCompleteRef.current = false

    const [
      profileResult,
      certificatesResult,
      venuesResult,
    ] = await Promise.all([
      supabase
        .from('coach_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('coach_certifications')
        .select('*')
        .eq('coach_user_id', user.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('coach_training_venues')
        .select('*')
        .eq('coach_user_id', user.id)
        .order('is_primary', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ])

    if (profileResult.error) {
      console.error('Failed to load coach profile:', profileResult.error)
      setMessageType('error')
      setMessage(profileResult.error.message || 'Failed to load coach profile.')
      setAutosaveStatus('Save failed')
      setLoading(false)
      return
    }

    if (certificatesResult.error) {
      console.error('Failed to load coach certificates:', certificatesResult.error)
    }

    if (venuesResult.error) {
      console.error('Failed to load training venues:', venuesResult.error)
    }

    const data = profileResult.data

    setVerificationStatus(data?.verification_status || 'pending')
    setRejectionReason(data?.rejection_reason || '')
    setVerifiedAt(data?.verified_at || null)

    const loadedCertificates = (certificatesResult.data || []).map(item => ({
      id: item.id,
      certificate_name: item.certificate_name || '',
      issuer: item.issuer || '',
      file_url: item.file_url || '',
    }))

    let loadedVenues = (venuesResult.data || []).map(item => ({
      id: item.id,
      venue_name: item.venue_name || '',
      venue_address: item.venue_address || '',
      location_url: item.location_url || '',
      is_primary: item.is_primary === true,
    }))

    // Keep existing single-venue data visible after upgrading.
    if (
      loadedVenues.length === 0 &&
      data?.training_venue
    ) {
      loadedVenues = [
        {
          id: `legacy-${user.id}`,
          venue_name: data.training_venue,
          venue_address: '',
          location_url: data.training_venue_url || '',
          is_primary: true,
        },
      ]
    }

    const loadedForm = {
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
    }

    setRelevantCertificates(loadedCertificates)
    setTrainingVenues(loadedVenues)
    setForm(loadedForm)

    lastSavedSnapshotRef.current = JSON.stringify({
      form: loadedForm,
      relevantCertificates: loadedCertificates.map(item => ({
        certificate_name: item.certificate_name,
        issuer: item.issuer,
        file_url: item.file_url,
      })),
      trainingVenues: loadedVenues.map(item => ({
        venue_name: item.venue_name,
        venue_address: item.venue_address,
        location_url: item.location_url,
        is_primary: item.is_primary,
      })),
    })

    initialLoadCompleteRef.current = true
    setAutosaveStatus('Saved')
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
    setAutosaveStatus('Unsaved changes')
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
      const filePath =
        `${currentUser.id}/certificate_${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('coach-certifications')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('coach-certifications')
        .getPublicUrl(filePath)

      setForm(current => ({
        ...current,
        certification_file_url: publicUrlData.publicUrl,
      }))

      setMessageType('success')
      setMessage(
        'Certificate uploaded successfully. Enter the certificate name and issuer; changes will save automatically.'
      )
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


  const addRelevantCertificate = () => {
    if (relevantCertificates.length >= 5) {
      setMessageType('error')
      setMessage('A maximum of five relevant certificates can be added.')
      return
    }

    setRelevantCertificates(current => [
      ...current,
      {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        certificate_name: '',
        issuer: '',
        file_url: '',
      },
    ])
    setMessage('')
  }

  const updateRelevantCertificate = (id, field, value) => {
    setRelevantCertificates(current =>
      current.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    )
    setMessage('')
    setAutosaveStatus('Unsaved changes')
  }

  const removeRelevantCertificate = id => {
    setRelevantCertificates(current =>
      current.filter(item => item.id !== id)
    )
    setMessageType('success')
    setMessage('Relevant certificate removed. Save the profile to confirm the change.')
  }

  const handleRelevantCertificationChange = async event => {
    const file = event.target.files?.[0]
    const certificateId = activeRelevantCertificateId

    if (!file || !certificateId) return

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

    setUploadingRelevantCertificate(true)
    setMessage('')

    try {
      const currentUser = await getCurrentUser()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath =
        `${currentUser.id}/relevant_certificate_${Date.now()}_${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('coach-certifications')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('coach-certifications')
        .getPublicUrl(filePath)

      updateRelevantCertificate(
        certificateId,
        'file_url',
        publicUrlData.publicUrl
      )

      setMessageType('success')
      setMessage('Relevant certificate uploaded. It will be published automatically.')
    } catch (error) {
      console.error('Relevant certification upload error:', error)
      setMessageType('error')
      setMessage(error.message || 'Failed to upload relevant certificate.')
    } finally {
      setUploadingRelevantCertificate(false)
      setActiveRelevantCertificateId(null)
      event.target.value = ''
    }
  }

  const addTrainingVenue = () => {
    if (trainingVenues.length >= 5) {
      setMessageType('error')
      setMessage('A maximum of five training venues can be added.')
      return
    }

    setTrainingVenues(current => [
      ...current,
      {
        id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        venue_name: '',
        venue_address: '',
        location_url: '',
        is_primary: current.length === 0,
      },
    ])
    setMessage('')
    setAutosaveStatus('Unsaved changes')
  }

  const updateTrainingVenue = (id, field, value) => {
    setTrainingVenues(current =>
      current.map(item => {
        if (field === 'is_primary' && value === true) {
          return {
            ...item,
            is_primary: item.id === id,
          }
        }

        return item.id === id
          ? { ...item, [field]: value }
          : item
      })
    )
    setMessage('')
    setAutosaveStatus('Unsaved changes')
  }

  const removeTrainingVenue = id => {
    setTrainingVenues(current => {
      const remaining = current.filter(item => item.id !== id)

      if (
        remaining.length > 0 &&
        !remaining.some(item => item.is_primary)
      ) {
        remaining[0] = {
          ...remaining[0],
          is_primary: true,
        }
      }

      return remaining
    })
    setMessage('')
    setAutosaveStatus('Unsaved changes')
  }

  const createSnapshot = useCallback(
    (nextForm, nextCertificates, nextVenues) => {
      return JSON.stringify({
        form: nextForm,
        relevantCertificates: nextCertificates.map(item => ({
          certificate_name: item.certificate_name,
          issuer: item.issuer,
          file_url: item.file_url,
        })),
        trainingVenues: nextVenues.map(item => ({
          venue_name: item.venue_name,
          venue_address: item.venue_address,
          location_url: item.location_url,
          is_primary: item.is_primary,
        })),
      })
    },
    []
  )

  const persistProfile = useCallback(
    async ({
      nextForm = form,
      nextCertificates = relevantCertificates,
      nextVenues = trainingVenues,
      manual = false,
    } = {}) => {
      if (!user?.id) {
        if (manual) {
          setMessageType('error')
          setMessage('Please log in again.')
        }
        setAutosaveStatus('Save failed')
        return false
      }

      if (!nextForm.display_name.trim()) {
        if (manual) {
          setMessageType('error')
          setMessage('Display name is required.')
        }
        setAutosaveStatus('Display name required')
        return false
      }

      const snapshot = createSnapshot(
        nextForm,
        nextCertificates,
        nextVenues
      )

      if (!manual && snapshot === lastSavedSnapshotRef.current) {
        setAutosaveStatus('Saved')
        return true
      }

      setSaving(true)
      setAutosaveStatus('Saving...')

      if (manual) {
        setMessage('')
      }

      const cleanedVenues = nextVenues
        .map((item, index) => ({
          coach_user_id: user.id,
          venue_name: item.venue_name.trim(),
          venue_address: item.venue_address.trim() || null,
          location_url: item.location_url.trim() || null,
          is_primary: item.is_primary === true,
          sort_order: index,
        }))
        .filter(item => item.venue_name)

      if (
        cleanedVenues.length > 0 &&
        !cleanedVenues.some(item => item.is_primary)
      ) {
        cleanedVenues[0].is_primary = true
      }

      const primaryVenue =
        cleanedVenues.find(item => item.is_primary) ||
        cleanedVenues[0] ||
        null

      const payload = {
        user_id: user.id,
        display_name: nextForm.display_name.trim(),
        headline: nextForm.headline.trim() || null,
        club: nextForm.club.trim() || null,
        state: nextForm.state.trim() || null,
        coaching_level: nextForm.coaching_level,
        experience_years: Number(nextForm.experience_years) || 0,
        specialties: nextForm.specialties,
        player_levels: nextForm.player_levels,
        session_types: nextForm.session_types,
        certification: nextForm.certification.trim() || null,
        certification_issuer:
          nextForm.certification_issuer.trim() || null,
        certification_file_url:
          nextForm.certification_file_url || null,
        player_capacity: Math.max(
          1,
          Number(nextForm.player_capacity) || 10
        ),
        accepting_players: Boolean(nextForm.accepting_players),
        training_venue:
          primaryVenue?.venue_name ||
          nextForm.training_venue.trim() ||
          null,
        training_venue_url:
          primaryVenue?.location_url || null,
        availability: nextForm.availability.trim() || null,
        phone: nextForm.phone.trim() || null,
        instagram: nextForm.instagram.trim() || null,
        bio: nextForm.bio.trim() || null,
        coaching_philosophy:
          nextForm.coaching_philosophy.trim() || null,
        achievements: nextForm.achievements.trim() || null,
        avatar_url: nextForm.avatar_url.trim() || null,
      }

      try {
        const { data, error } = await supabase
          .from('coach_profiles')
          .upsert(payload, {
            onConflict: 'user_id',
          })
          .select()
          .single()

        if (error) throw error

        const { error: deleteVenuesError } = await supabase
          .from('coach_training_venues')
          .delete()
          .eq('coach_user_id', user.id)

        if (deleteVenuesError) {
          throw deleteVenuesError
        }

        if (cleanedVenues.length > 0) {
          const { error: insertVenuesError } = await supabase
            .from('coach_training_venues')
            .insert(cleanedVenues)

          if (insertVenuesError) {
            throw insertVenuesError
          }
        }

        const hasIncompleteCertificate = nextCertificates.some(item => {
          const hasAnyValue = Boolean(
            item.certificate_name.trim() ||
              item.issuer.trim() ||
              item.file_url
          )

          return (
            hasAnyValue &&
            (!item.certificate_name.trim() || !item.file_url)
          )
        })

        if (!hasIncompleteCertificate) {
          const cleanedRelevantCertificates = nextCertificates
            .map((item, index) => ({
              coach_user_id: user.id,
              certificate_name: item.certificate_name.trim(),
              issuer: item.issuer.trim() || null,
              file_url: item.file_url || null,
              sort_order: index,
            }))
            .filter(item => item.certificate_name && item.file_url)

          const { error: deleteCertificatesError } = await supabase
            .from('coach_certifications')
            .delete()
            .eq('coach_user_id', user.id)

          if (deleteCertificatesError) {
            throw deleteCertificatesError
          }

          if (cleanedRelevantCertificates.length > 0) {
            const { error: insertCertificatesError } = await supabase
              .from('coach_certifications')
              .insert(cleanedRelevantCertificates)

            if (insertCertificatesError) {
              throw insertCertificatesError
            }
          }
        }

        window.dispatchEvent(
          new CustomEvent('profile-updated', {
            detail: {
              display_name: data.display_name,
              club: data.club,
            },
          })
        )

        lastSavedSnapshotRef.current = snapshot
        setMessageType('success')

        if (hasIncompleteCertificate) {
          setAutosaveStatus('Profile saved · certificate draft pending')

          if (manual) {
            setMessage(
              'Profile saved. Complete each relevant certificate name and upload its file to publish it.'
            )
          }
        } else {
          setAutosaveStatus('Saved')

          if (manual) {
            setMessage('Coach profile and certificates saved successfully.')
          }
        }

        return true
      } catch (saveError) {
        console.error('Failed to save coach profile:', saveError)
        setMessageType('error')
        setAutosaveStatus('Save failed')

        if (manual) {
          setMessage(
            saveError.message || 'Failed to save coach profile.'
          )
        }

        return false
      } finally {
        setSaving(false)
      }
    },
    [
      createSnapshot,
      form,
      relevantCertificates,
      trainingVenues,
      user?.id,
    ]
  )

  useEffect(() => {
    if (
      loading ||
      !initialLoadCompleteRef.current ||
      !user?.id ||
      saving
    ) {
      return
    }

    const snapshot = createSnapshot(
      form,
      relevantCertificates,
      trainingVenues
    )

    setAutosaveStatus(
      snapshot === lastSavedSnapshotRef.current
        ? 'Saved'
        : 'Unsaved changes'
    )
  }, [
    createSnapshot,
    form,
    loading,
    relevantCertificates,
    trainingVenues,
    saving,
    user?.id,
  ])

  const hasUnsavedChanges =
    autosaveStatus === 'Unsaved changes' ||
    autosaveStatus === 'Display name required' ||
    autosaveStatus === 'Save failed'

  useEffect(() => {
    const handleBeforeUnload = event => {
      if (!hasUnsavedChanges) return

      event.preventDefault()
      event.returnValue = ''
    }

    const handleLinkClick = event => {
      if (!hasUnsavedChanges) return

      const link = event.target.closest?.('a[href]')
      if (!link) return

      const shouldLeave = window.confirm(
        'You have unsaved changes. Please save your profile before leaving. Leave without saving?'
      )

      if (!shouldLeave) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleLinkClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleLinkClick, true)
    }
  }, [hasUnsavedChanges])



  const handleResubmitVerification = async () => {
    if (!user?.id) return

    const hasMainCertificate = Boolean(
      form.certification.trim() && form.certification_file_url
    )

    const hasRelevantCertificate = relevantCertificates.some(
      item => item.certificate_name.trim() && item.file_url
    )

    if (!hasMainCertificate && !hasRelevantCertificate) {
      setMessageType('error')
      setMessage(
        'Upload at least one complete certificate before resubmitting.'
      )
      return
    }

    setResubmitting(true)
    setMessage('')

    try {
      const saved = await persistProfile({
        nextForm: form,
        nextCertificates: relevantCertificates,
        nextVenues: trainingVenues,
        manual: true,
      })

      if (!saved) return

      const { error } = await supabase
        .rpc('resubmit_coach_verification')

      if (error) throw error

      setVerificationStatus('pending')
      setRejectionReason('')
      setVerifiedAt(null)
      setMessageType('success')
      setMessage(
        'Your updated certification has been resubmitted for admin review.'
      )
    } catch (error) {
      console.error('Verification resubmit error:', error)
      setMessageType('error')
      setMessage(
        error.message || 'Failed to resubmit coach verification.'
      )
    } finally {
      setResubmitting(false)
    }
  }

  const handleSave = async event => {
    event.preventDefault()

    await persistProfile({
      nextForm: form,
      nextCertificates: relevantCertificates,
      nextVenues: trainingVenues,
      manual: true,
    })
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


      <div
        className={styles.card}
        style={{
          marginBottom: 16,
          padding: '14px 16px',
          border:
            verificationStatus === 'verified'
              ? '1px solid #A7F3D0'
              : verificationStatus === 'rejected'
                ? '1px solid #FECACA'
                : '1px solid #FDE68A',
          background:
            verificationStatus === 'verified'
              ? '#ECFDF5'
              : verificationStatus === 'rejected'
                ? '#FEF2F2'
                : '#FFFBEB',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color:
                  verificationStatus === 'verified'
                    ? '#047857'
                    : verificationStatus === 'rejected'
                      ? '#B91C1C'
                      : '#B45309',
              }}
            >
              {verificationStatus === 'verified'
                ? '✓ Verified Coach'
                : verificationStatus === 'rejected'
                  ? 'Verification rejected'
                  : 'Verification under review'}
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                lineHeight: 1.6,
                color:
                  verificationStatus === 'verified'
                    ? '#065F46'
                    : verificationStatus === 'rejected'
                      ? '#991B1B'
                      : '#92400E',
              }}
            >
              {verificationStatus === 'verified'
                ? `Your coach profile is visible to players.${
                    verifiedAt
                      ? ` Verified on ${new Date(verifiedAt).toLocaleDateString(
                          'en-MY',
                          {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          }
                        )}.`
                      : ''
                  }`
                : verificationStatus === 'rejected'
                  ? rejectionReason ||
                    'Update your certification and resubmit it for review.'
                  : 'An admin must verify your certification before players can find your coach profile.'}
            </div>
          </div>

          {verificationStatus === 'rejected' && (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleResubmitVerification}
              disabled={resubmitting || saving}
              style={{
                fontSize: 11,
                opacity: resubmitting || saving ? 0.65 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {resubmitting ? 'Resubmitting...' : 'Resubmit verification'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 1050px) {
          .coach-profile-layout {
            grid-template-columns: 1fr !important;
          }
          .coach-profile-preview {
            position: static !important;
          }
        }
        @media (max-width: 640px) {
          .coach-certificate-header {
            align-items: stretch !important;
          }
          .coach-certificate-header > button,
          .coach-certificate-header > span {
            align-self: flex-start;
          }
        }
      `}</style>

      <form onSubmit={handleSave}>
        <div
          className="coach-profile-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(280px, 0.65fr)',
            gap: 16,
            alignItems: 'start',
            width: '100%',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
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
                      color: 'var(--text, #0D1B3E)',
                    }}
                  >
                    Coach profile picture
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--muted, #8892A4)',
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

              <div
                style={{
                  marginTop: 10,
                  padding: '16px',
                  border: '1px solid var(--line, #EEF1F8)',
                  borderRadius: 14,
                  background: 'var(--surface-soft, var(--card, #FFFFFF))',
                  width: '100%',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    marginBottom: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #0D1B3E)' }}>
                      Main certificate
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted, #8892A4)', marginTop: 3 }}>
                      Your most important coaching qualification, such as a BAM, BWF, national or state certificate.
                    </div>
                  </div>
                  <span className={styles.badgeBlue}>Primary</span>
                </div>

                <div className={styles.formRow}>
                  <label className={styles.formLabel}>Certificate name</label>
                  <input
                    className={styles.formInput}
                    value={form.certification}
                    onChange={event =>
                      updateField('certification', event.target.value)
                    }
                    placeholder="e.g. BAM Level 1 or Penang State Coaching Certificate"
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

                <div className={styles.formRow} style={{ marginBottom: 0 }}>
                  <label className={styles.formLabel}>Certificate proof</label>

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
                      ? 'Uploading main certificate...'
                      : form.certification_file_url
                        ? 'Replace main certificate file'
                        : 'Upload main certificate PDF or image'}
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
                        View main certificate
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
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  padding: 14,
                  border: '1px solid var(--line, #EEF1F8)',
                  borderRadius: 14,
                  background: 'var(--card, #FFFFFF)',
                }}
              >
                <input
                  ref={relevantCertificationInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handleRelevantCertificationChange}
                  style={{ display: 'none' }}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: relevantCertificates.length ? 12 : 0,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #0D1B3E)' }}>
                      Other relevant certificates
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted, #8892A4)', marginTop: 3 }}>
                      Optional state, junior development, fitness, tournament or other coaching certificates.
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.btnOutline}
                    onClick={addRelevantCertificate}
                    disabled={relevantCertificates.length >= 5}
                    style={{ fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    + Add certificate
                  </button>
                </div>

                {relevantCertificates.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--muted, #8892A4)', marginTop: 10 }}>
                    No additional certificates added. This section is optional.
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {relevantCertificates.map((certificate, index) => (
                    <div
                      key={certificate.id}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid var(--line, #EEF1F8)',
                        background: 'var(--surface-soft, var(--card, #FFFFFF))',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 10,
                          alignItems: 'center',
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text, #0D1B3E)' }}>
                          Relevant certificate {index + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRelevantCertificate(certificate.id)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#DC2626',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Remove
                        </button>
                      </div>

                      <div className={styles.g2} style={{ marginBottom: 0 }}>
                        <div className={styles.formRow}>
                          <label className={styles.formLabel}>Certificate name</label>
                          <input
                            className={styles.formInput}
                            value={certificate.certificate_name}
                            onChange={event =>
                              updateRelevantCertificate(
                                certificate.id,
                                'certificate_name',
                                event.target.value
                              )
                            }
                            placeholder="e.g. Penang State Coaching Certificate"
                          />
                        </div>

                        <div className={styles.formRow}>
                          <label className={styles.formLabel}>Issued by</label>
                          <input
                            className={styles.formInput}
                            value={certificate.issuer}
                            onChange={event =>
                              updateRelevantCertificate(
                                certificate.id,
                                'issuer',
                                event.target.value
                              )
                            }
                            placeholder="Issuing organisation"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        className={styles.btnOutline}
                        disabled={uploadingRelevantCertificate}
                        onClick={() => {
                          setActiveRelevantCertificateId(certificate.id)
                          relevantCertificationInputRef.current?.click()
                        }}
                        style={{ width: '100%', fontSize: 12 }}
                      >
                        {uploadingRelevantCertificate && activeRelevantCertificateId === certificate.id
                          ? 'Uploading...'
                          : certificate.file_url
                            ? 'Replace certificate file'
                            : 'Upload certificate PDF or image'}
                      </button>

                      {certificate.file_url && (
                        <a
                          href={certificate.file_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            marginTop: 8,
                            color: '#1A5FFF',
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          View uploaded certificate
                        </a>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 11, color: 'var(--muted, #8892A4)', marginTop: 10 }}>
                  Maximum five relevant certificates. Each saved certificate needs a name and uploaded file.
                </div>
              </div>

              <div style={{ height: 8 }} />

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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 10,
                  }}
                >
                  <label
                    className={styles.formLabel}
                    style={{ marginBottom: 0 }}
                  >
                    Training venues
                  </label>

                  <button
                    type="button"
                    className={styles.btnOutline}
                    onClick={addTrainingVenue}
                    disabled={trainingVenues.length >= 5}
                    style={{
                      fontSize: 11,
                      padding: '6px 10px',
                      opacity:
                        trainingVenues.length >= 5
                          ? 0.55
                          : 1,
                    }}
                  >
                    + Add venue
                  </button>
                </div>

                {trainingVenues.length === 0 ? (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      border:
                        '1px dashed var(--line, #DDE3F0)',
                      color:
                        'var(--muted, #8892A4)',
                      fontSize: 12,
                      lineHeight: 1.6,
                    }}
                  >
                    No training venues added yet. Add up to five
                    venues and mark one as the primary venue.
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {trainingVenues.map((venue, index) => (
                      <div
                        key={venue.id}
                        style={{
                          padding: 14,
                          borderRadius: 13,
                          border: venue.is_primary
                            ? '1.5px solid #1A5FFF'
                            : '1px solid var(--line, #DDE3F0)',
                          background: venue.is_primary
                            ? 'rgba(26,95,255,0.05)'
                            : 'var(--card, #FFFFFF)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            marginBottom: 10,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color:
                                'var(--text, #0D1B3E)',
                            }}
                          >
                            Venue {index + 1}
                            {venue.is_primary
                              ? ' · Primary'
                              : ''}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeTrainingVenue(venue.id)
                            }
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#DC2626',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        </div>

                        <input
                          className={styles.formInput}
                          value={venue.venue_name}
                          onChange={event =>
                            updateTrainingVenue(
                              venue.id,
                              'venue_name',
                              event.target.value
                            )
                          }
                          placeholder="Venue name, e.g. Permata Sports Complex"
                          style={{ marginBottom: 9 }}
                        />

                        <input
                          className={styles.formInput}
                          value={venue.venue_address}
                          onChange={event =>
                            updateTrainingVenue(
                              venue.id,
                              'venue_address',
                              event.target.value
                            )
                          }
                          placeholder="Address or area, e.g. Farlim, Penang"
                          style={{ marginBottom: 9 }}
                        />

                        <input
                          className={styles.formInput}
                          type="url"
                          value={venue.location_url}
                          onChange={event =>
                            updateTrainingVenue(
                              venue.id,
                              'location_url',
                              event.target.value
                            )
                          }
                          placeholder="Paste exact Google Maps Share link"
                          style={{ marginBottom: 9 }}
                        />

                        <label
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 7,
                            color:
                              'var(--text, #0D1B3E)',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="primary-training-venue"
                            checked={venue.is_primary}
                            onChange={() =>
                              updateTrainingVenue(
                                venue.id,
                                'is_primary',
                                true
                              )
                            }
                          />
                          Set as primary venue
                        </label>

                        {venue.location_url && (
                          <a
                            href={venue.location_url}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              display: 'inline-flex',
                              marginLeft: 14,
                              color: '#1A5FFF',
                              fontSize: 11,
                              fontWeight: 800,
                              textDecoration: 'none',
                            }}
                          >
                            Test map link ↗
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    marginTop: 8,
                    color: 'var(--muted, #8892A4)',
                    fontSize: 11,
                    lineHeight: 1.5,
                  }}
                >
                  The primary venue appears first on your public
                  coach profile.
                </div>
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
            className={`${styles.card} coach-profile-preview`}
            style={{ position: 'sticky', top: 20, minWidth: 0, overflow: 'hidden' }}
          >
            <div className={styles.cardTitle}>Player preview</div>

            <div
              style={{
                height: 8,
                background: 'var(--line, #EEF1F8)',
                border: '1px solid var(--line, #EEF1F8)',
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

            <div style={{ fontSize: 11, color: 'var(--muted, #8892A4)', marginBottom: 18 }}>
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

              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text, #0D1B3E)' }}>
                    {form.display_name || 'Your coach name'}
                  </div>

                  {verificationStatus === 'verified' && (
                    <span className={styles.badgeGreen}>
                      ✓ Verified
                    </span>
                  )}

                  {verificationStatus === 'pending' && (
                    <span className={styles.badgeAmber}>
                      Pending
                    </span>
                  )}

                  {verificationStatus === 'rejected' && (
                    <span
                      style={{
                        display: 'inline-flex',
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: '#FEE2E2',
                        color: '#DC2626',
                        fontSize: 10,
                        fontWeight: 800,
                      }}
                    >
                      Rejected
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted, #8892A4)' }}>
                  {form.club || 'Club'} · {form.state || 'State'}
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: 13,
                color: 'var(--text, #0D1B3E)',
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
                  background: 'var(--surface-soft, var(--card, #FFFFFF))',
                  border: '1px solid var(--line, #EEF1F8)',
                  padding: 10,
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--muted, #8892A4)' }}>
                  Experience
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1A5FFF' }}>
                  {Number(form.experience_years) || 0} years
                </div>
              </div>

              <div
                style={{
                  background: 'var(--surface-soft, var(--card, #FFFFFF))',
                  border: '1px solid var(--line, #EEF1F8)',
                  padding: 10,
                  borderRadius: 10,
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--muted, #8892A4)' }}>
                  Capacity
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text, #0D1B3E)' }}>
                  Up to {Number(form.player_capacity) || 10}
                </div>
              </div>
            </div>

            {(form.certification || form.certification_file_url) && (
              <div
                style={{
                  marginTop: 16,
                  padding: '14px 15px',
                  background: 'var(--surface-soft, var(--card, #FFFFFF))',
                  borderRadius: 12,
                  border: '1px solid #93B4F5',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 10, color: 'var(--muted, #8892A4)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.7 }}>
                    Main certificate
                  </div>
                  <span className={styles.badgeBlue}>Primary</span>
                </div>

                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'var(--text, #0D1B3E)',
                    marginTop: 7,
                  }}
                >
                  {form.certification || 'Certificate uploaded'}
                </div>

                {form.certification_issuer && (
                  <div style={{ fontSize: 11, color: 'var(--muted, #8892A4)', marginTop: 3 }}>
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
                      marginTop: 9,
                      color: '#1A5FFF',
                      fontSize: 12,
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    View main certificate
                  </a>
                )}
              </div>
            )}

            {relevantCertificates.filter(item => item.certificate_name && item.file_url).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted, #8892A4)', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8 }}>
                  Other relevant certificates
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {relevantCertificates
                    .filter(item => item.certificate_name && item.file_url)
                    .map(item => (
                      <div
                        key={item.id}
                        style={{
                          padding: '10px 11px',
                          borderRadius: 10,
                          background: 'var(--surface-soft, var(--card, #FFFFFF))',
                          border: '1px solid var(--line, #EEF1F8)',
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text, #0D1B3E)' }}>
                          {item.certificate_name}
                        </div>
                        {item.issuer && (
                          <div style={{ fontSize: 10, color: 'var(--muted, #8892A4)', marginTop: 2 }}>
                            Issued by {item.issuer}
                          </div>
                        )}
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ display: 'inline-flex', marginTop: 5, color: '#1A5FFF', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
                        >
                          View certificate
                        </a>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div
              style={{
                borderTop: '1px solid var(--line, #EEF1F8)',
                marginTop: 16,
                paddingTop: 14,
                fontSize: 13,
                color: 'var(--text, #0D1B3E)',
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
                    : hasUnsavedChanges
                      ? '#D97706'
                      : '#8892A4',
              fontWeight: hasUnsavedChanges ? 700 : 500,
            }}
          >
            {message ||
              (hasUnsavedChanges
                ? 'Unsaved changes · Please press Save Profile before leaving.'
                : autosaveStatus)}
          </div>

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving}
            style={{ opacity: saving ? 0.65 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  )
}