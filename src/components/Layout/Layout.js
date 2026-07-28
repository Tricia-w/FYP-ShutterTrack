import { useCallback, useEffect, useState } from 'react'
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import styles from './Layout.module.css'

export default function Layout() {
  const {
    user,
    profile,
    hasPlayerAccess,
    hasCoachAccess,
    refreshProfile,
    logout,
  } = useAuth()

  const navigate = useNavigate()
  const location = useLocation()

  const accountRole = (
    profile?.role ||
    user?.role ||
    'player'
  ).toLowerCase()

  const [mode, setMode] = useState(
    location.pathname.startsWith('/coach')
      ? 'coach'
      : 'player'
  )

  const avatarKey =
    `profileAvatar:${user?.id || user?.email || 'default'}`

  const [sidebarAvatar, setSidebarAvatar] = useState('')
  const [sidebarProfile, setSidebarProfile] = useState(
    profile || null
  )
  const [showAccessDenied, setShowAccessDenied] =
    useState(false)

  const [hasPlayerProfile, setHasPlayerProfile] =
    useState(false)
  const [hasCoachProfile, setHasCoachProfile] =
    useState(false)
  const [checkingModes, setCheckingModes] =
    useState(true)

  const [playerModeProfile, setPlayerModeProfile] =
    useState(null)
  const [coachModeProfile, setCoachModeProfile] =
    useState(null)

  const loadAvailableModes = useCallback(async () => {
    if (!user?.id) {
      setHasPlayerProfile(false)
      setHasCoachProfile(false)
      setPlayerModeProfile(null)
      setCoachModeProfile(null)
      setCheckingModes(false)
      return
    }

    setCheckingModes(true)

    try {
      const [playerResult, coachResult] =
        await Promise.all([
          supabase
            .from('player_profiles')
            .select('id, user_id, display_name, club')
            .eq('user_id', user.id)
            .maybeSingle(),

          supabase
            .from('coach_profiles')
            .select('id, user_id, display_name, club')
            .eq('user_id', user.id)
            .maybeSingle(),
        ])

      if (playerResult.error) {
        console.error(
          'Unable to check player profile:',
          playerResult.error
        )
      }

      if (coachResult.error) {
        console.error(
          'Unable to check coach profile:',
          coachResult.error
        )
      }

      /*
       * app_users access flags control page access.
       * Profile rows are used for role-specific display data.
       * The original role remains only as a backward-compatible fallback.
       */
      const playerExists =
        hasPlayerAccess === true ||
        profile?.has_player_access === true ||
        Boolean(playerResult.data) ||
        accountRole === 'player'

      const coachExists =
        hasCoachAccess === true ||
        profile?.has_coach_access === true ||
        Boolean(coachResult.data) ||
        accountRole === 'coach'

      setHasPlayerProfile(playerExists)
      setHasCoachProfile(coachExists)
      setPlayerModeProfile(playerResult.data || null)
      setCoachModeProfile(coachResult.data || null)
    } catch (error) {
      console.error(
        'Unable to load available account modes:',
        error
      )

      setHasPlayerProfile(
        hasPlayerAccess === true ||
          profile?.has_player_access === true ||
          accountRole === 'player',
      )
      setHasCoachProfile(
        hasCoachAccess === true ||
          profile?.has_coach_access === true ||
          accountRole === 'coach',
      )
      setPlayerModeProfile(null)
      setCoachModeProfile(null)
    } finally {
      setCheckingModes(false)
    }
  }, [
    accountRole,
    hasCoachAccess,
    hasPlayerAccess,
    profile?.has_coach_access,
    profile?.has_player_access,
    user?.id,
  ])

  useEffect(() => {
    setSidebarProfile(profile || null)
  }, [profile])

  useEffect(() => {
    loadAvailableModes()
  }, [loadAvailableModes])

  /*
   * Profile pages can dispatch this event after saving.
   * The event data is shown immediately, then the latest values
   * are reloaded from Supabase.
   */
  useEffect(() => {
    const handleProfileUpdated = async (event) => {
      if (event?.detail) {
        setSidebarProfile((previousProfile) => ({
          ...(previousProfile || {}),
          ...event.detail,
        }))

        if (mode === 'coach') {
          setCoachModeProfile((previousProfile) => ({
            ...(previousProfile || {}),
            ...event.detail,
          }))
        } else {
          setPlayerModeProfile((previousProfile) => ({
            ...(previousProfile || {}),
            ...event.detail,
          }))
        }
      }

      try {
        const latestProfile = await refreshProfile()

        if (latestProfile) {
          setSidebarProfile(latestProfile)
        }

        await loadAvailableModes()
      } catch (error) {
        console.error(
          'Unable to refresh sidebar profile:',
          error
        )
      }
    }

    window.addEventListener(
      'profile-updated',
      handleProfileUpdated
    )

    return () => {
      window.removeEventListener(
        'profile-updated',
        handleProfileUpdated
      )
    }
  }, [loadAvailableModes, mode, refreshProfile])

  useEffect(() => {
    if (location.pathname.startsWith('/coach')) {
      setMode('coach')
    } else {
      setMode('player')
    }
  }, [location.pathname])

  useEffect(() => {
    const loadAvatar = () => {
      const savedAvatar = localStorage.getItem(avatarKey)
      setSidebarAvatar(savedAvatar || '')
    }

    loadAvatar()

    window.addEventListener('avatar-updated', loadAvatar)

    return () => {
      window.removeEventListener(
        'avatar-updated',
        loadAvatar
      )
    }
  }, [avatarKey])

  const activeProfile =
    mode === 'coach'
      ? coachModeProfile || sidebarProfile || profile || {}
      : playerModeProfile || sidebarProfile || profile || {}

  const displayName =
    activeProfile?.display_name ||
    activeProfile?.full_name ||
    activeProfile?.name ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.name ||
    user?.email?.split('@')[0] ||
    (mode === 'coach' ? 'Coach' : 'Player')

  const savedClub =
    activeProfile?.club ||
    activeProfile?.club_name ||
    user?.user_metadata?.club ||
    user?.club ||
    ''

  const clubName =
    typeof savedClub === 'string' && savedClub.trim()
      ? savedClub.trim()
      : 'No club set'

  const initials =
    displayName
      ?.split(' ')
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'PL'

  const sidebarRole =
    mode === 'coach' ? 'Coach' : 'Player'

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const switchMode = (selectedMode) => {
    if (selectedMode === 'player') {
      const canOpenPlayer =
        hasPlayerProfile ||
        hasPlayerAccess === true ||
        profile?.has_player_access === true

      if (!canOpenPlayer) {
        setShowAccessDenied(true)
        return
      }

      setMode('player')
      navigate('/dashboard')
      return
    }

    if (selectedMode === 'coach') {
      const canOpenCoach =
        hasCoachProfile ||
        hasCoachAccess === true ||
        profile?.has_coach_access === true

      if (!canOpenCoach) {
        return
      }

      setMode('coach')
      navigate('/coach')
    }
  }

  const navClass = ({ isActive }) =>
    `${styles.navItem} ${
      isActive ? styles.active : ''
    }`

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar}>
        {/* Logo */}
        <div className={styles.sidebarLogo}>
          <div className={styles.logoMark}>
            <svg
              viewBox="0 0 20 20"
              fill="none"
              width="20"
              height="20"
            >
              <circle
                cx="10"
                cy="10"
                r="8"
                stroke="white"
                strokeWidth="1.5"
              />
              <path
                d="M6 10 Q10 4 14 10 Q10 16 6 10Z"
                fill="white"
                opacity="0.8"
              />
              <circle
                cx="10"
                cy="10"
                r="2"
                fill="white"
              />
            </svg>
          </div>

          <div className={styles.logoName}>
            ShuttleTrack
          </div>

          <div className={styles.logoSub}>
            {mode === 'coach'
              ? 'Coach Mode'
              : 'Player Monitor'}
          </div>
        </div>

        {/* Role switcher — only when both profiles exist */}
        {!checkingModes &&
          (hasPlayerProfile ||
            hasPlayerAccess === true ||
            profile?.has_player_access === true) &&
          (hasCoachProfile ||
            hasCoachAccess === true ||
            profile?.has_coach_access === true) && (
          <div
            style={{
              padding: '0 12px 16px',
              borderBottom: '1px solid #1e2d50',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                background: '#0a1020',
                borderRadius: 10,
                padding: 3,
                gap: 3,
              }}
            >
              <button
                type="button"
                onClick={() => switchMode('player')}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background:
                    mode === 'player'
                      ? '#1A5FFF'
                      : 'transparent',
                  color:
                    mode === 'player'
                      ? '#fff'
                      : '#4b6080',
                }}
              >
                Player
              </button>

              <button
                type="button"
                onClick={() => switchMode('coach')}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  background:
                    mode === 'coach'
                      ? '#00976C'
                      : 'transparent',
                  color:
                    mode === 'coach'
                      ? '#fff'
                      : '#4b6080',
                }}
              >
                Coach
              </button>
            </div>
          </div>
        )}

        {/* Coach mode */}
        {(hasCoachProfile ||
          hasCoachAccess === true ||
          profile?.has_coach_access === true) &&
          mode === 'coach' && (
          <nav className={styles.navSection}>
            <div className={styles.navLabel}>
              Coach
            </div>

            <NavLink
              to="/coach"
              end
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <rect
                  x="1"
                  y="1"
                  width="6"
                  height="6"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="9"
                  y="1"
                  width="6"
                  height="6"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="1"
                  y="9"
                  width="6"
                  height="6"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="9"
                  y="9"
                  width="6"
                  height="6"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              Dashboard
            </NavLink>

            <NavLink
              to="/coach/players"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <circle
                  cx="6"
                  cy="5"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M2 14c0-3.3 2.7-6 6-6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle
                  cx="13"
                  cy="10"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M13 8v2l1 1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              My Players
            </NavLink>

            <NavLink
              to="/coach/sessions"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <rect
                  x="2"
                  y="2"
                  width="12"
                  height="12"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M2 6h12M6 2v4M10 2v4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Sessions
            </NavLink>

            <NavLink
              to="/coach/progress"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <polyline
                  points="1,12 5,7 8,9 11,4 15,6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Progress
            </NavLink>

            <NavLink
              to="/coach/clubs"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <path
                  d="M2 13.5V6.5L8 2l6 4.5v7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 13.5V9h6v4.5M1 13.5h14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Club Management
            </NavLink>

            <div
              className={styles.navLabel}
              style={{ marginTop: 14 }}
            >
              Account
            </div>

            <NavLink
              to="/coach/profile"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <circle
                  cx="8"
                  cy="5"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              My Profile
            </NavLink>

            <div
              className={styles.navLabel}
              style={{ marginTop: 14 }}
            >
              System
            </div>

            <NavLink
              to="/coach/settings"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="2.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Settings
            </NavLink>
          </nav>
        )}

        {/* Player mode */}
        {(hasPlayerProfile ||
          hasPlayerAccess === true ||
          profile?.has_player_access === true) &&
          mode === 'player' && (
          <nav className={styles.navSection}>
            <div className={styles.navLabel}>
              Overview
            </div>

            <NavLink
              to="/dashboard"
              end
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <rect
                  x="1"
                  y="1"
                  width="6"
                  height="6"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="9"
                  y="1"
                  width="6"
                  height="6"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="1"
                  y="9"
                  width="6"
                  height="6"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="9"
                  y="9"
                  width="6"
                  height="6"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              Dashboard
            </NavLink>

            <div
              className={styles.navLabel}
              style={{ marginTop: 14 }}
            >
              My Data
            </div>

            <NavLink
              to="/profile"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <circle
                  cx="8"
                  cy="5"
                  r="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              My Profile
            </NavLink>

            <NavLink
              to="/performance"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <polyline
                  points="1,12 5,7 8,9 11,4 15,6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Performance
            </NavLink>

            <NavLink
              to="/fitness"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <path
                  d="M1 8h2.5l1.5-5 3 10 2-5 1 3H15"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Fitness
            </NavLink>

            <NavLink
              to="/expenses"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <rect
                  x="1"
                  y="3"
                  width="14"
                  height="10"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M1 7h14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle
                  cx="5"
                  cy="10.5"
                  r="1"
                  fill="currentColor"
                />
              </svg>
              Expenses
            </NavLink>

            <div
              className={styles.navLabel}
              style={{ marginTop: 14 }}
            >
              Community
            </div>

            <NavLink
              to="/players"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <circle
                  cx="6"
                  cy="6"
                  r="3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M10 10.5L14 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle
                  cx="12"
                  cy="5"
                  r="2.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
              Players & Opponents
            </NavLink>

            <NavLink
              to="/clubs"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <path
                  d="M2 13.5V6.5L8 2l6 4.5v7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M5 13.5V9h6v4.5M1 13.5h14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Clubs
            </NavLink>

            <div
              className={styles.navLabel}
              style={{ marginTop: 14 }}
            >
              System
            </div>

            <NavLink
              to="/settings"
              className={navClass}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                width="16"
                height="16"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="2.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Settings
            </NavLink>
          </nav>
        )}

        {/* User information */}
        <div className={styles.sidebarUser}>
          <div className={styles.userAv}>
            {sidebarAvatar ? (
              <img
                src={sidebarAvatar}
                alt="Profile"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '50%',
                }}
              />
            ) : (
              initials
            )}
          </div>

          <div>
            <div className={styles.userName}>
              {displayName}
            </div>

            <div className={styles.userRole}>
              {sidebarRole} · {clubName}
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className={styles.sidebarLogout}>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M5 1H2a1 1 0 00-1 1v10a1 1 0 001 1h3M9 10l3-3-3-3M12 7H5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Log out
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>

      {showAccessDenied && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="player-access-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowAccessDenied(false)
            }
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              background: '#ffffff',
              borderRadius: 18,
              padding: 28,
              boxShadow:
                '0 20px 50px rgba(0, 0, 0, 0.2)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: '#FEF2F2',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: 28,
              }}
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="5"
                  y="10"
                  width="14"
                  height="10"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M8 10V7a4 4 0 0 1 8 0v3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <h2
              id="player-access-title"
              style={{
                margin: '0 0 10px',
                color: '#0D1B3E',
                fontSize: 22,
              }}
            >
              Player access unavailable
            </h2>

            <p
              style={{
                margin: '0 0 22px',
                color: '#64748B',
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              This account does not have a player
              profile, so Player Mode cannot be
              opened.
            </p>

            <button
              type="button"
              onClick={() =>
                setShowAccessDenied(false)
              }
              style={{
                width: '100%',
                padding: '11px 16px',
                border: 'none',
                borderRadius: 10,
                background: '#1A5FFF',
                color: '#ffffff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Back to Coach Mode
            </button>
          </div>
        </div>
      )}
    </div>
  )
}