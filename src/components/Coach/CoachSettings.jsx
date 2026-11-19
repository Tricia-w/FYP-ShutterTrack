import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { THEME_OPTIONS, getSavedTheme as getSelectedShuttleTheme, applyShuttleTheme, saveAccountTheme } from '../../theme/themeOptions'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'
import { CoachPageHeader } from './CoachShared'

const readBool = (value, fallback = false) => {
  if (value === null || value === undefined) return fallback
  return Boolean(value)
}

const sanitizePhone = value => {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 11)
}

const getSavedDarkMode = () => {
  if (typeof window === 'undefined') return null
  const savedTheme = localStorage.getItem('shuttleTheme')
  if (savedTheme === 'dark') return true
  if (savedTheme === 'light') return false
  return null
}

const getInitialDarkMode = () => getSavedDarkMode() ?? false

const isValidEmail = value => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}


const THEME_PREVIEWS = {
  light: { background: '#F6F8FF', surface: '#FFFFFF', accent: '#1A5FFF', text: '#0D1B3E' },
  dark: { background: '#0B1220', surface: '#111C33', accent: '#6795FF', text: '#FFFFFF' },
  ocean: { background: '#EAF5FC', surface: '#FFFFFF', accent: '#087FAD', text: '#123B57' },
  forest: { background: '#EFF8F0', surface: '#FFFFFF', accent: '#168456', text: '#193D2D' },
  monochrome: { background: '#F5F5F5', surface: '#FFFFFF', accent: '#262626', text: '#171717' },
}

export default function CoachSettings() {
  const navigate = useNavigate()
  const { user, refreshProfile, logout } = useAuth()
  const [selectedTheme, setSelectedTheme] = useState(() => getSelectedShuttleTheme())
  const [appearanceExpanded, setAppearanceExpanded] = useState(false)
  const [themeSaveError, setThemeSaveError] = useState('')

  // Layout restores the Supabase preference. Keep this page in sync when
  // returning from the other role or changing accounts.
  useEffect(() => {
    const update = event => {
      if (event.detail?.userId === user?.id) {
        setSelectedTheme(event.detail.theme)
      }
    }
    setSelectedTheme(getSelectedShuttleTheme(user?.id || null))
    window.addEventListener('shuttle-theme-changed', update)
    return () => window.removeEventListener('shuttle-theme-changed', update)
  }, [user?.id])

  const changeTheme = async nextTheme => {
    if (!user?.id) return
    const applied = applyShuttleTheme(nextTheme, user.id)
    setSelectedTheme(applied)
    setThemeSaveError('')
    try {
      await saveAccountTheme(supabase, user.id, applied)
    } catch (error) {
      console.error('Could not save account theme:', error)
      // Keep the choice in this account's local cache, but report lack of cloud sync.
      setThemeSaveError('Theme applied on this device, but could not sync to your account. ' + (error.message || 'Please try again.'))
    }
  }

  const [navStyle, setNavStyle] = useState('sidebar')
  const [navStyleUserId, setNavStyleUserId] = useState('')

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      const id = data?.user?.id || ''
      setNavStyleUserId(id)
      try {
        const stored = id ? localStorage.getItem(`shuttleNavigationStyle:${id}`) : null
        setNavStyle(stored === 'floating' ? 'floating' : 'sidebar')
      } catch {
        setNavStyle('sidebar')
      }
    })
    return () => { active = false }
  }, [])

  const changeNavigationStyle = (next) => {
    if (next !== 'sidebar' && next !== 'floating') return
    setNavStyle(next)
    try {
      if (navStyleUserId) localStorage.setItem(`shuttleNavigationStyle:${navStyleUserId}`, next)
    } catch {
      // Browser storage might be disabled.
    }
    window.dispatchEvent(new CustomEvent('shuttle-navigation-style-changed', {
      detail: { style: next, userId: navStyleUserId },
    }))
  }
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
  })
  const [settings, setSettings] = useState({
    darkMode: getInitialDarkMode(),
    playerRequestReminder: true,
    sessionReminder: true,
    progressReminder: true,
    soundEnabled: true,
    profilePublic: true,
    acceptingPlayers: true,
  })
  const [lastUpdated, setLastUpdated] = useState('—')
  const [loading, setLoading] = useState(true)
  const showLoader = useLoadingDelay(loading, 350)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [requestingDelete, setRequestingDelete] = useState(false)
  const [deletionReason, setDeletionReason] = useState('')
  const [approvedDeletionRequest, setApprovedDeletionRequest] = useState(null)
  const [deletionScope, setDeletionScope] = useState('both')
  const [hasBothRoles, setHasBothRoles] = useState(false)
  const [revokingDeletion, setRevokingDeletion] = useState(false)
  const [loggingOutOtherDevices, setLoggingOutOtherDevices] =
    useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState('')
  const [accountSaveStatus, setAccountSaveStatus] = useState('')
  const [accountSaveError, setAccountSaveError] = useState('')
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)
  const [emailChangeMessage, setEmailChangeMessage] = useState('')
  const [emailChangeError, setEmailChangeError] = useState('')
  const accountSaveTimerRef = useRef(null)
  const accountLoadedRef = useRef(false)
  const lastSavedAccountRef = useRef({
    name: '',
    phone: '',
  })


  useEffect(() => {
    const fetchSettings = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const [
          appUserResult,
          coachProfileResult,
          settingsResult,
        ] = await Promise.all([
          supabase
            .from('app_users')
            .select('full_name, email, updated_at')
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('coach_profiles')
            .select(
              'display_name, phone, accepting_players, profile_public, updated_at'
            )
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle(),
        ])
        if (appUserResult.error) {
          console.error('Load app user error:', appUserResult.error)
        }
        if (coachProfileResult.error) {
          console.error(
            'Load coach profile error:',
            coachProfileResult.error
          )
        }
        if (settingsResult.error) {
          console.error(
            'Load coach settings error:',
            settingsResult.error
          )
        }
        const appUser = appUserResult.data
        const coachProfile = coachProfileResult.data
        const savedSettings = settingsResult.data
        const loadedForm = {
          name:
            coachProfile?.display_name ||
            appUser?.full_name ||
            user.user_metadata?.full_name ||
            '',
          email: user.email || appUser?.email || '',
          phone: sanitizePhone(coachProfile?.phone),
        }
        setForm(loadedForm)
        lastSavedAccountRef.current = {
          name: loadedForm.name.trim(),
          phone: loadedForm.phone.trim(),
        }
        setSettings({
          darkMode:
            getSavedDarkMode() ??
            readBool(savedSettings?.dark_mode, false),
          playerRequestReminder: readBool(
            savedSettings?.coach_player_request_reminder,
            true
          ),
          sessionReminder: readBool(
            savedSettings?.coach_session_reminder,
            true
          ),
          progressReminder: readBool(
            savedSettings?.coach_progress_reminder,
            true
          ),
          soundEnabled: readBool(
            savedSettings?.notification_sound_enabled,
            true
          ),
          profilePublic: readBool(
            coachProfile?.profile_public,
            readBool(
              savedSettings?.coach_profile_public,
              true
            )
          ),
          acceptingPlayers: readBool(
            coachProfile?.accepting_players,
            true
          ),
        })
        const latestUpdate =
          savedSettings?.updated_at ||
          coachProfile?.updated_at ||
          appUser?.updated_at
        setLastUpdated(
          latestUpdate
            ? new Date(latestUpdate).toLocaleString('en-MY')
            : '—'
        )
        accountLoadedRef.current = true
      } catch (error) {
        console.error('Coach settings load error:', error)
        setAccountSaveError(
          error.message || 'Unable to load coach settings.'
        )
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [user])

  const set = key => event => {
    setForm(current => ({
      ...current,
      [key]: event.target.value,
    }))
  }

  const getAuthUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user) {
      throw new Error('Please log in again.')
    }
    return data.user
  }, [])

  const loadApprovedDeletionRequest = useCallback(async () => {
    try {
      const authUser = await getAuthUser()
      const { data, error } = await supabase
        .from('account_deletion_requests')
        .select(
          'id, status, deletion_scope, reviewed_at, user_confirmed_at, scheduled_delete_at, deletion_completed_at'
        )
        .eq('user_id', authUser.id)
        .in('status', ['pending', 'reviewing', 'approved'])
        .is('deletion_completed_at', null)
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      setApprovedDeletionRequest(data || null)
    } catch (error) {
      console.error(
        'Coach deletion approval load error:',
        error
      )
    }
  }, [getAuthUser])

  useEffect(() => {
    let active = true
    const loadRoleAccess = async () => {
      try {
        const authUser = await getAuthUser()
        const { data, error } = await supabase
          .from('app_users')
          .select('has_player_access, has_coach_access')
          .eq('user_id', authUser.id)
          .maybeSingle()
        if (error) throw error
        if (active) setHasBothRoles(data?.has_player_access === true && data?.has_coach_access === true)
      } catch (error) {
        console.error('Unable to load role access for deletion:', error)
        if (active) setHasBothRoles(false)
      }
    }
    loadRoleAccess()
    return () => { active = false }
  }, [getAuthUser])
  useEffect(() => {
    let active = true
    let channel = null
    const setupDeletionApprovalListener = async () => {
      try {
        const authUser = await getAuthUser()
        if (!active) return
        await loadApprovedDeletionRequest()
        channel = supabase
          .channel(`account-deletion-approval-${authUser.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'account_deletion_requests',
              filter: `user_id=eq.${authUser.id}`,
            },
            loadApprovedDeletionRequest
          )
          .subscribe()
      } catch (error) {
        console.error(
          'Coach deletion approval listener error:',
          error
        )
      }
    }
    setupDeletionApprovalListener()
    return () => {
      active = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [getAuthUser, loadApprovedDeletionRequest])
  const saveAccountSettings = useCallback(
    async currentForm => {
      const authUser = await getAuthUser()
      const now = new Date().toISOString()
      const cleanName = currentForm.name.trim()
      const cleanPhone = sanitizePhone(currentForm.phone)
      if (!cleanName) {
        throw new Error('Full name is required.')
      }
      /*
       * Do not update app_users here.
       *
       * The login email is read-only, and the coach's public name and
       * phone number belong to coach_profiles. Avoiding an app_users
       * update also prevents the Supabase permission-denied error.
       */
      const { error: coachProfileError } = await supabase
        .from('coach_profiles')
        .upsert(
          {
            user_id: authUser.id,
            display_name: cleanName,
            phone: cleanPhone || null,
            updated_at: now,
          },
          { onConflict: 'user_id' }
        )
      if (coachProfileError) {
        throw coachProfileError
      }
      setLastUpdated(
        new Date(now).toLocaleString('en-MY')
      )
      window.dispatchEvent(
        new CustomEvent('profile-updated', {
          detail: {
            display_name: cleanName,
          },
        })
      )
      if (refreshProfile) {
        await refreshProfile()
      }
    },
    [getAuthUser, refreshProfile]
  )

  useEffect(() => {
    if (!accountLoadedRef.current || loading) {
      return undefined
    }
    const normalizedForm = {
      name: form.name.trim(),
      phone: form.phone.trim(),
    }
    const lastSaved = lastSavedAccountRef.current
    const hasAccountChanges =
      normalizedForm.name !== lastSaved.name ||
      normalizedForm.phone !== lastSaved.phone
    /*
     * Do nothing when the page first loads or when the form
     * still matches the last successfully saved values.
     */
    if (!hasAccountChanges) {
      setAccountSaveStatus('')
      setAccountSaveError('')
      return undefined
    }
    if (accountSaveTimerRef.current) {
      window.clearTimeout(accountSaveTimerRef.current)
    }
    setAccountSaveStatus('Saving...')
    setAccountSaveError('')
    accountSaveTimerRef.current = window.setTimeout(
      async () => {
        try {
          await saveAccountSettings(form)
          lastSavedAccountRef.current = normalizedForm
          setAccountSaveStatus('Saved automatically')
          window.setTimeout(() => {
            setAccountSaveStatus('')
          }, 1800)
        } catch (error) {
          console.error(
            'Coach account autosave error:',
            error
          )
          setAccountSaveStatus('Could not save')
          setAccountSaveError(
            error.message ||
              'Account details could not be saved.'
          )
        }
      },
      700
    )
    return () => {
      if (accountSaveTimerRef.current) {
        window.clearTimeout(accountSaveTimerRef.current)
      }
    }
  }, [form, loading, saveAccountSettings])
  const SETTINGS_COLUMN_MAP = {
    darkMode: 'dark_mode',
    playerRequestReminder: 'coach_player_request_reminder',
    sessionReminder: 'coach_session_reminder',
    progressReminder: 'coach_progress_reminder',
    soundEnabled: 'notification_sound_enabled',
    profilePublic: 'coach_profile_public',
  }

  const toggle = async key => {
    const nextValue = !settings[key]
    setSettings(current => ({
      ...current,
      [key]: nextValue,
    }))
    setAutoSaveStatus('Saving...')
    try {
      const authUser = await getAuthUser()
      const now = new Date().toISOString()
      if (key === 'acceptingPlayers') {
        const { error } = await supabase
          .from('coach_profiles')
          .upsert(
            {
              user_id: authUser.id,
              display_name: form.name.trim() || 'Coach',
              accepting_players: nextValue,
              updated_at: now,
            },
            { onConflict: 'user_id' }
          )
        if (error) throw error
      } else if (key === 'profilePublic') {
        const [
          coachProfileSave,
          userSettingsSave,
        ] = await Promise.all([
          supabase
            .from('coach_profiles')
            .upsert(
              {
                user_id: authUser.id,
                display_name: form.name.trim() || 'Coach',
                profile_public: nextValue,
                updated_at: now,
              },
              { onConflict: 'user_id' }
            ),
          supabase
            .from('user_settings')
            .upsert(
              {
                user_id: authUser.id,
                coach_profile_public: nextValue,
                updated_at: now,
              },
              { onConflict: 'user_id' }
            ),
        ])
        if (coachProfileSave.error) {
          throw coachProfileSave.error
        }
        if (userSettingsSave.error) {
          throw userSettingsSave.error
        }
        window.dispatchEvent(
          new CustomEvent(
            'coach-profile-visibility-updated',
            {
              detail: {
                profile_public: nextValue,
              },
            }
          )
        )
      } else {
        const column = SETTINGS_COLUMN_MAP[key]
        if (!column) return
        const { error } = await supabase
          .from('user_settings')
          .upsert(
            {
              user_id: authUser.id,
              [column]: nextValue,
              updated_at: now,
            },
            { onConflict: 'user_id' }
          )
        if (error) throw error
      }
      if (key === 'soundEnabled') {
        window.dispatchEvent(
          new CustomEvent('notification-sound-updated', {
            detail: {
              enabled: nextValue,
            },
          })
        )
      }
      setLastUpdated(new Date(now).toLocaleString('en-MY'))
      setAutoSaveStatus('Saved automatically')
      window.setTimeout(() => {
        setAutoSaveStatus('')
      }, 1800)
    } catch (error) {
      console.error('Coach setting autosave error:', error)
      setSettings(current => ({
        ...current,
        [key]: !nextValue,
      }))
      setAutoSaveStatus('Could not save')
    }
  }
  const openEmailChangeModal = () => {
    setNewEmail('')
    setEmailChangeError('')
    setShowEmailModal(true)
  }
  const closeEmailChangeModal = () => {
    if (changingEmail) return
    setShowEmailModal(false)
    setNewEmail('')
    setEmailChangeError('')
  }
  const handleRequestEmailChange = async () => {
    if (changingEmail) return
    const cleanEmail = newEmail.trim().toLowerCase()
    const currentEmail = form.email.trim().toLowerCase()
    setEmailChangeError('')
    if (!cleanEmail) {
      setEmailChangeError('Please enter your new email address.')
      return
    }
    if (!isValidEmail(cleanEmail)) {
      setEmailChangeError('Please enter a valid email address.')
      return
    }
    if (cleanEmail === currentEmail) {
      setEmailChangeError(
        'The new email address must be different from your current email.'
      )
      return
    }
    setChangingEmail(true)
    setEmailChangeMessage('')
    try {
      await getAuthUser()
      const redirectUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}`
          : undefined
      const { error } = await supabase.auth.updateUser(
        {
          email: cleanEmail,
        },
        redirectUrl
          ? {
              emailRedirectTo: redirectUrl,
            }
          : undefined
      )
      if (error) throw error
      setShowEmailModal(false)
      setNewEmail('')
      setEmailChangeError('')
      setEmailChangeMessage(
        `Verification sent to ${cleanEmail}. Your current login email will stay active until the required email confirmation is completed.`
      )
    } catch (error) {
      console.error('Change email error:', error)
      setEmailChangeError(
        error?.message ||
          'Unable to send the email change verification.'
      )
    } finally {
      setChangingEmail(false)
    }
  }
  const handleLogout = async () => {
    if (logout) {
      await logout()
    } else {
      await supabase.auth.signOut({
        scope: 'local',
      })
    }
    navigate('/')
  }
  const handleLogoutOtherDevices = async () => {
    if (loggingOutOtherDevices) return
    const confirmed = window.confirm(
      'Log out your account from all other browsers and devices? This browser will stay logged in.'
    )
    if (!confirmed) return
    setLoggingOutOtherDevices(true)
    try {
      const { error } = await supabase.auth.signOut({
        scope: 'others',
      })
      if (error) throw error
      alert(
        'Your account has been logged out from all other browsers and devices. This browser is still logged in.'
      )
    } catch (error) {
      console.error(
        'Logout other devices error:',
        error
      )
      alert(
        error?.message ||
          'Unable to log out the other devices.'
      )
    } finally {
      setLoggingOutOtherDevices(false)
    }
  }
  const handleRevokeDeletionRequest = async () => {
    if (!approvedDeletionRequest?.id || revokingDeletion) return
    if (!window.confirm('Revoke this deletion request? Any scheduled deletion will be cancelled.')) return
    setRevokingDeletion(true)
    try {
      const { error } = await supabase.rpc('cancel_account_deletion', {
        p_request_id: approvedDeletionRequest.id,
      })
      if (error) throw error
      setApprovedDeletionRequest(null)
      await loadApprovedDeletionRequest()
      alert('Your deletion request has been revoked.')
    } catch (error) {
      console.error('Deletion revocation error:', error)
      alert(error?.message || 'Unable to revoke the deletion request.')
      await loadApprovedDeletionRequest()
    } finally {
      setRevokingDeletion(false)
    }
  }
  const handleRequestDeleteAccount = async () => {
    if (requestingDelete) return
    const cleanReason = deletionReason.trim()
    if (!cleanReason) {
      alert('Please enter a reason for requesting account deletion.')
      return
    }
    setRequestingDelete(true)
    try {
      await loadApprovedDeletionRequest()
      const authUser = await getAuthUser()
      if (!hasBothRoles && deletionScope !== 'both') {
        throw new Error('Only accounts with both Player and Coach access can remove one role.')
      }
      const { error } = await supabase
        .from('account_deletion_requests')
        .insert({
          user_id: authUser.id,
          email: form.email || authUser.email || null,
          full_name: form.name.trim() || null,
          role: 'coach',
          reason: cleanReason,
          status: 'pending',
          deletion_scope: hasBothRoles ? deletionScope : 'both',
        })
      if (error) {
        if (error.code === '23505') {
          alert('You already have a pending account deletion request.')
          return
        }
        throw error
      }
      setShowDeleteModal(false)
      setDeletionReason('')
      await loadApprovedDeletionRequest()
      alert(
        'Your account deletion request has been submitted. You can continue using your account while the admin reviews it.'
      )
    } catch (error) {
      console.error('Account deletion request error:', error)
      alert(
        error.message ||
          'Failed to submit account deletion request.'
      )
    } finally {
      setRequestingDelete(false)
    }
  }

  const ToggleSwitch = ({ checked, onChange }) => (
    <button
      type="button"
      onClick={onChange}
      style={{
        width: 46,
        height: 24,
        borderRadius: 999,
        border: 'none',
        padding: 3,
        cursor: 'pointer',
        background: checked
          ? 'var(--navy, #0D1B3E)'
          : '#CBD5E1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: checked
          ? 'flex-end'
          : 'flex-start',
        transition: '0.2s ease',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#FFFFFF',
          display: 'block',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        }}
      />
    </button>
  )

  const SmallButton = ({
    children,
    onClick,
    danger,
    solid,
    disabled,
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 32,
        padding: '0 16px',
        borderRadius: 8,
        border: danger
          ? '1px solid #FDA4AF'
          : '1px solid var(--line, #DDE3EF)',
        background: solid
          ? '#F43F5E'
          : danger
            ? '#FFE4E6'
            : 'var(--card, #FFFFFF)',
        color: solid
          ? '#FFFFFF'
          : danger
            ? '#F43F5E'
            : 'var(--text, #0D1B3E)',
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled
          ? 'not-allowed'
          : 'pointer',
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  )

  const SettingLine = ({
    label,
    checked,
    onChange,
    value,
  }) => (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>
      <span
        className={styles.statVal}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        {value && (
          <span
            style={{
              fontSize: 13,
              color: 'var(--text-muted, #8892A4)',
            }}
          >
            {value}
          </span>
        )}
        <ToggleSwitch
          checked={checked}
          onChange={onChange}
        />
      </span>
    </div>
  )
  if (loading && !showLoader) {
    return null
  }
  if (showLoader) {
    return (
      <div className={styles.card}>
        <Loader text="Loading coach settings..." />
      </div>
    )
  }

  return (
    <div className={styles.coachReadablePage}>
      <CoachPageHeader
        title="Settings"
        subtitle="Manage account, notifications and privacy settings"
        showActions={false}
      />

      <div className={styles.g2}>
        <div>
          <div
            className={styles.card}
            style={{ marginBottom: 16 }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div className={styles.cardTitle}>
                Account Settings
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color:
                    accountSaveStatus === 'Could not save'
                      ? '#EF4444'
                      : accountSaveStatus === 'Saving...'
                        ? 'var(--text-muted, #8892A4)'
                        : '#00A878',
                }}
              >
                {accountSaveStatus ||
                  'Changes save automatically'}
              </span>
            </div>
            {accountSaveError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '9px 11px',
                  borderRadius: 9,
                  border: '1px solid #FECACA',
                  background: '#FEF2F2',
                  color: '#B91C1C',
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {accountSaveError}
              </div>
            )}

            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Full Name
              </label>
              <input
                className={styles.formInput}
                value={form.name}
                onChange={set('name')}
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Email Address
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <input
                  className={styles.formInput}
                  value={form.email}
                  readOnly
                  title="Current login email"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    opacity: 0.72,
                    cursor: 'not-allowed',
                  }}
                />

                <SmallButton onClick={openEmailChangeModal}>
                  Change Email
                </SmallButton>
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 11,
                  color: 'var(--text-muted, #8892A4)',
                  lineHeight: 1.5,
                }}
              >
                Your current login email stays active until the new email is
                verified.
              </div>
              {emailChangeMessage && (
                <div
                  style={{
                    marginTop: 9,
                    padding: '9px 11px',
                    borderRadius: 9,
                    border: '1px solid #A7F3D0',
                    background: '#ECFDF5',
                    color: '#047857',
                    fontSize: 11,
                    lineHeight: 1.5,
                  }}
                >
                  {emailChangeMessage}
                </div>
              )}
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>
                Phone Number
              </label>
              <input
                className={styles.formInput}
                value={form.phone}
                onChange={event => {
                  const phone = sanitizePhone(event.target.value)
                  setForm(current => ({ ...current, phone }))
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={11}
                autoComplete="tel"
                placeholder="01xxxxxxxx"
              />

              <div
                style={{
                  marginTop: 5,
                  fontSize: 11,
                  color: 'var(--text-muted, #8892A4)',
                }}
              >
                Numbers only, maximum 11 digits.
              </div>
            </div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>
                Last updated
              </span>
              <span className={styles.statVal}>
                {lastUpdated}
              </span>
            </div>
          </div>

          <div className={styles.card}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div className={styles.cardTitle} style={{ marginBottom: 0 }}>Appearance</div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                Auto-saved
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 12 }}>
              Customize how ShuttleTrack looks and how you navigate between pages.
            </div>
            {!appearanceExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>
                  <strong>Theme:</strong> {THEME_OPTIONS.find(option => option.value === selectedTheme)?.label || 'Classic Light'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text)' }}>
                  <strong>Navigation:</strong> {navStyle === 'floating' ? 'Floating circular menu' : 'Classic sidebar'}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setAppearanceExpanded(expanded => !expanded)}
              aria-expanded={appearanceExpanded}
              aria-controls="shuttletrack-appearance-options"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 12px', borderRadius: 10,
                border: '1px solid var(--line, #E8EDF6)',
                background: 'var(--soft, #F6F8FF)', color: 'var(--text, #0D1B3E)',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span>{appearanceExpanded ? 'Show less' : 'Show more'}</span>
              <span aria-hidden="true" style={{ fontSize: 17, lineHeight: 1 }}>
                {appearanceExpanded ? '⌃' : '⌄'}
              </span>
            </button>
            {appearanceExpanded && (
              <div id="shuttletrack-appearance-options" style={{ paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              Colour theme
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
              Your theme is saved to your account and shared across Player and Coach modes, including other devices.
            </div>
            {themeSaveError && (
              <div role="alert" style={{ color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 11px', fontSize: 12, marginBottom: 10 }}>
                {themeSaveError}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {THEME_OPTIONS.map(option => {
                const preview = THEME_PREVIEWS[option.value]
                const active = selectedTheme === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => changeTheme(option.value)}
                    aria-pressed={active}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 9,
                      border: active ? '2px solid var(--blue)' : '1px solid var(--line)',
                      background: 'var(--card)', borderRadius: 12, padding: 10,
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      color: 'var(--text)', minWidth: 0,
                    }}
                  >
                    <span aria-hidden="true" style={{
                      background: preview.background, borderRadius: 8, padding: 8,
                      display: 'flex', flexDirection: 'column', gap: 5,
                      border: '1px solid rgba(120,140,170,0.14)',
                    }}>
                      <span style={{ background: preview.surface, borderRadius: 5, padding: 7, display: 'flex', gap: 5 }}>
                        <span style={{ background: preview.accent, borderRadius: 4, height: 9, width: '38%' }} />
                        <span style={{ background: preview.background, borderRadius: 4, height: 9, flex: 1 }} />
                      </span>
                      <span style={{ background: preview.surface, borderRadius: 5, height: 12, opacity: 0.85 }} />
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{option.label}</span>
                      <span aria-hidden="true" style={{ color: active ? 'var(--blue)' : 'var(--text-muted)', fontSize: 16 }}>
                        {active ? '◉' : '○'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div style={{ marginTop: 12 }}>
              <span className={styles.badgeBlue}>
                Current theme: {THEME_OPTIONS.find(option => option.value === selectedTheme)?.label || 'Classic Light'}
              </span>
            </div>

            <div style={{ marginTop: 18, borderTop: '1px solid var(--line, #E8EDF6)', paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text, #0D1B3E)', marginBottom: 4 }}>
                Navigation style
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #8892A4)', marginBottom: 10 }}>
                Choose how to move between pages.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { id: 'sidebar', title: 'Classic sidebar', subtitle: 'Left-side navigation with page labels.', symbol: '☰' },
                  { id: 'floating', title: 'Floating circular menu', subtitle: 'Moveable P/C circle with drag-to-select navigation.', symbol: '◎' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => changeNavigationStyle(option.id)}
                    aria-pressed={navStyle === option.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                      padding: '11px 12px', textAlign: 'left', cursor: 'pointer',
                      background: navStyle === option.id ? 'rgba(26,95,255,0.07)' : 'var(--card, #fff)',
                      border: navStyle === option.id ? '1.5px solid #1A5FFF' : '1px solid var(--line, #E8EDF6)',
                      borderRadius: 10, fontFamily: 'inherit', color: 'var(--text, #0D1B3E)',
                    }}
                  >
                    <span style={{ color: '#1A5FFF', fontSize: 20, width: 24, textAlign: 'center' }}>{option.symbol}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>{option.title}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted, #8892A4)', marginTop: 2 }}>{option.subtitle}</span>
                    </span>
                    <span aria-hidden="true" style={{ color: navStyle === option.id ? '#1A5FFF' : '#A8B4C6' }}>
                      {navStyle === option.id ? '◉' : '○'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
              </div>
            )}
          </div>
        </div>

        <div>
          <div
            className={styles.card}
            style={{ marginBottom: 16 }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div className={styles.cardTitle}>
                Notifications & Privacy
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color:
                    autoSaveStatus === 'Could not save'
                      ? '#EF4444'
                      : '#00A878',
                }}
              >
                {autoSaveStatus ||
                  'Changes save automatically'}
              </span>
            </div>

            <SettingLine
              label="New player request notifications"
              checked={settings.playerRequestReminder}
              onChange={() =>
                toggle('playerRequestReminder')
              }
            />

            <SettingLine
              label="Training session reminders"
              checked={settings.sessionReminder}
              onChange={() =>
                toggle('sessionReminder')
              }
            />

            <SettingLine
              label="Player progress reminders"
              value="Completed, due & overdue"
              checked={settings.progressReminder}
              onChange={() =>
                toggle('progressReminder')
              }
            />

            <SettingLine
              label="Notification sound"
              checked={settings.soundEnabled}
              onChange={() =>
                toggle('soundEnabled')
              }
            />

            <SettingLine
              label="Coach profile visible to players"
              checked={settings.profilePublic}
              onChange={() => toggle('profilePublic')}
            />

            <SettingLine
              label="Accepting new players"
              checked={settings.acceptingPlayers}
              onChange={() =>
                toggle('acceptingPlayers')
              }
            />
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>
              Data & Security
            </div>

            <div
              style={{
                marginTop: 12,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid var(--line, #DDE3EF)',
                background: 'var(--bg, #F8FAFC)',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text, #0D1B3E)',
                }}
              >
                Active login sessions
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--text-muted, #8892A4)',
                }}
              >
                Log out your account from other browsers and devices while
                keeping this browser logged in.
              </div>

              <div style={{ marginTop: 10 }}>
                <SmallButton
                  onClick={handleLogoutOtherDevices}
                  disabled={loggingOutOtherDevices}
                >
                  {loggingOutOtherDevices
                    ? 'Logging Out Other Devices...'
                    : 'Log Out Other Devices'}
                </SmallButton>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 14,
                flexWrap: 'wrap',
              }}
            >
              {approvedDeletionRequest && (
                <div style={{ width: '100%', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Deletion request: <strong>{approvedDeletionRequest.user_confirmed_at ? 'Scheduled (24-hour countdown)' : approvedDeletionRequest.status === 'approved' ? 'Approved — awaiting your confirmation' : approvedDeletionRequest.status === 'reviewing' ? 'Under admin review' : 'Pending admin review'}</strong>
                  {' · '}{approvedDeletionRequest.deletion_scope === 'player' ? 'Player only' : approvedDeletionRequest.deletion_scope === 'coach' ? 'Coach only' : 'Entire account'}
                </div>
              )}
              <SmallButton onClick={handleLogout}>
                Log Out This Device
              </SmallButton>
              {approvedDeletionRequest ? (
                <SmallButton
                  danger
                  disabled={revokingDeletion}
                  onClick={handleRevokeDeletionRequest}
                >
                  {revokingDeletion ? 'Revoking...' : 'Revoke Deletion Request'}
                </SmallButton>
              ) : (
                <SmallButton
                  danger
                  onClick={() => {
                    setDeletionReason('')
                    setDeletionScope('both')
                    setShowDeleteModal(true)
                  }}
                >
                  Request Account Deletion
                </SmallButton>
              )}
            </div>
          </div>
        </div>
      </div>
      {showEmailModal && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (
              event.target === event.currentTarget &&
              !changingEmail
            ) {
              closeEmailChangeModal()
            }
          }}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 480 }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Change Login Email
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeEmailChangeModal}
                disabled={changingEmail}
              >
                ✕
              </button>
            </div>
            <p
              style={{
                color: 'var(--text-muted, #8892A4)',
                lineHeight: 1.6,
              }}
            >
              Enter your new email address. Supabase will send the required
              confirmation email before changing your login email.
            </p>
            <div style={{ marginTop: 14 }}>
              <label
                className={styles.formLabel}
                htmlFor="coach-new-login-email"
              >
                New Email Address
              </label>
              <input
                id="coach-new-login-email"
                type="email"
                className={styles.formInput}
                value={newEmail}
                onChange={event => {
                  setNewEmail(event.target.value)
                  setEmailChangeError('')
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleRequestEmailChange()
                  }
                }}
                placeholder="newemail@example.com"
                autoComplete="email"
                disabled={changingEmail}
                autoFocus
              />
            </div>
            {emailChangeError && (
              <div
                style={{
                  marginTop: 10,
                  padding: '9px 11px',
                  borderRadius: 9,
                  border: '1px solid #FECACA',
                  background: '#FEF2F2',
                  color: '#B91C1C',
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {emailChangeError}
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--line, #DDE3EF)',
                background: 'var(--bg, #F8FAFC)',
                color: 'var(--text-muted, #8892A4)',
                fontSize: 12,
                lineHeight: 1.55,
              }}
            >
              Current email: <b>{form.email}</b>
              <br />
              Your account will continue using this email until verification is
              completed.
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 18,
                flexWrap: 'wrap',
              }}
            >
              <SmallButton
                onClick={closeEmailChangeModal}
                disabled={changingEmail}
              >
                Cancel
              </SmallButton>
              <button
                type="button"
                onClick={handleRequestEmailChange}
                disabled={changingEmail}
                style={{
                  height: 32,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: '1px solid #1A5FFF',
                  background: '#1A5FFF',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: changingEmail ? 'not-allowed' : 'pointer',
                  opacity: changingEmail ? 0.65 : 1,
                }}
              >
                {changingEmail
                  ? 'Sending Verification...'
                  : 'Send Verification Email'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showDeleteModal && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (
              event.target === event.currentTarget &&
              !requestingDelete
            ) {
              setShowDeleteModal(false)
              setDeletionReason('')
            }
          }}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 480 }}
          >
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>
                Request Account Deletion
              </div>
              <button
                className={styles.modalClose}
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletionReason('')
                }}
                disabled={requestingDelete}
              >
                ✕
              </button>
            </div>
            <p
              style={{
                color: 'var(--text-muted, #8892A4)',
                lineHeight: 1.6,
              }}
            >
              This sends an account deletion request to the admin.
              Your account will not be deleted immediately.
            </p>
            <p
              style={{
                color: 'var(--text-muted, #8892A4)',
                lineHeight: 1.6,
              }}
            >
              You will remain logged in and can continue using your
              account while the admin reviews your request.
            </p>
            <div style={{ marginTop: 14, padding: 12, border: '1px solid var(--line)', borderRadius: 10 }}>
              <div className={styles.formLabel} style={{ marginBottom: 9 }}>What would you like to delete?</div>
              {(hasBothRoles ? [
                ['player', 'Delete Player role only — keep Coach access'],
                ['coach', 'Delete Coach role only — keep Player access'],
                ['both', 'Delete entire account — Player and Coach'],
              ] : [['both', 'Delete entire account']]).map(([value, label]) => (
                <label key={value} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 9, fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}>
                  <input type="radio" name="deletionScope" value={value} checked={deletionScope === value} onChange={() => setDeletionScope(value)} disabled={requestingDelete} />
                  <span>{label}</span>
                </label>
              ))}
              <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)' }}>
                Admin approval is required. After approval, you must confirm before the 24-hour countdown begins. You can revoke your request before processing.
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <label
                className={styles.formLabel}
                htmlFor="coach-deletion-reason"
              >
                Reason for deletion
              </label>
              <textarea
                id="coach-deletion-reason"
                className={styles.formInput}
                rows={4}
                maxLength={500}
                value={deletionReason}
                onChange={event =>
                  setDeletionReason(event.target.value)
                }
                placeholder="Please explain why you want to delete your account."
                disabled={requestingDelete}
                style={{
                  width: '100%',
                  minHeight: 96,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
              />

              <div
                style={{
                  marginTop: 5,
                  textAlign: 'right',
                  color: 'var(--text-muted, #8892A4)',
                  fontSize: 11,
                }}
              >
                {deletionReason.length}/500
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 18,
              }}
            >
              <SmallButton
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletionReason('')
                }}
                disabled={requestingDelete}
              >
                Cancel
              </SmallButton>
              <SmallButton
                solid
                danger
                onClick={handleRequestDeleteAccount}
                disabled={requestingDelete}
              >
                {requestingDelete
                  ? 'Submitting...'
                  : 'Submit Request'}
              </SmallButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}