import { useCallback, useEffect, useRef, useState } from 'react'
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import styles from './Layout.module.css'

function RadialNavIcon({ name }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    profile: <><circle cx="12" cy="8" r="3.5"/><path d="M4.5 21c0-4 3-7 7.5-7s7.5 3 7.5 7"/></>,
    chart: <><path d="M3 19V5M3 19h18M5 15l5-5 4 3 6-8"/></>,
    fitness: <path d="M2 13h4l2-7 4 13 3-9 2 3h5"/>,
    wallet: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M6 6V4h13"/></>,
    players: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M17.5 14a5 5 0 0 1 3.5 5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></>,
    clubs: <><path d="m3 10 9-7 9 7v11H3z"/><path d="M9 21v-8h6v8"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2.2 2.2M16.8 16.8 19 19M19 5l-2.2 2.2M7.2 16.8 5 19"/></>,
    logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M8 12h10"/></>,
  }
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.dashboard}</svg>
}

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

  // The navigation preference is local to each signed-in account.
  // Keep floating as the default to preserve the user's current layout.
  const [navigationStyle, setNavigationStyle] = useState('floating')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('shuttleClassicSidebarCollapsed') === 'true'
  })

  useEffect(() => {
    window.localStorage.setItem('shuttleClassicSidebarCollapsed', String(sidebarCollapsed))
  }, [sidebarCollapsed])

  // Bottom-right by default. The floating button can be placed anywhere on screen.
  const [radialExpanded, setRadialExpanded] = useState(false)
  const [dragHoverIndex, setDragHoverIndex] = useState(-1)
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  }))
  const isMobileSidebar = viewport.width <= 900
  const isNavCollapsed = !isMobileSidebar && sidebarCollapsed

  const [dock, setDock] = useState(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth - 48 : 1232,
    y: typeof window !== 'undefined' ? window.innerHeight - 56 : 744,
  }))
  const radialGestureRef = useRef(null)
  const radialCleanupRef = useRef(null)
  const skipRoleClickRef = useRef(false)
  const radialItemsRef = useRef([])
  const [floatingDrag, setFloatingDrag] = useState(null)

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

    // Keep the existing sidebar visible while refreshing available modes.
    // `checkingModes` is already true on the initial page load and becomes
    // false after that first check. Setting it back to true here caused the
    // Player/Coach switcher to disappear briefly on every refresh.
    try {
      const [playerResult, coachResult] =
        await Promise.all([
          supabase
            .from('player_profiles')
            .select('id, user_id, display_name, club, profile_photo_url')
            .eq('user_id', user.id)
            .maybeSingle(),

          supabase
            .from('coach_profiles')
            .select('id, user_id, display_name, club, avatar_url')
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
   * Refresh the sidebar club immediately when club membership changes
   * in this browser, and also listen for Supabase updates made from
   * another account/session, such as when a coach accepts a request.
   */

  useEffect(() => {
    if (!user?.id) return undefined

    const refreshClubProfiles = async (event) => {
      const eventClub = event?.detail?.club

      if (typeof eventClub === 'string') {
        setPlayerModeProfile((previousProfile) => ({
          ...(previousProfile || {}),
          club: eventClub,
        }))

        if (mode === 'player') {
          setSidebarProfile((previousProfile) => ({
            ...(previousProfile || {}),
            club: eventClub,
          }))
        }
      }

      await loadAvailableModes()
    }

    window.addEventListener(
      'club-membership-updated',
      refreshClubProfiles,
    )

    const channel = supabase
      .channel(`layout-profile-club-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'player_profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updatedClub = payload?.new?.club || ''

          setPlayerModeProfile((previousProfile) => ({
            ...(previousProfile || {}),
            ...(payload?.new || {}),
            club: updatedClub,
          }))

          if (mode === 'player') {
            setSidebarProfile((previousProfile) => ({
              ...(previousProfile || {}),
              club: updatedClub,
            }))
          }
        },
      )
      .subscribe()

    return () => {
      window.removeEventListener(
        'club-membership-updated',
        refreshClubProfiles,
      )

      supabase.removeChannel(channel)
    }
  }, [loadAvailableModes, mode, user?.id])

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
  const activeSidebarAvatar =
    mode === 'coach'
      ? activeProfile?.avatar_url || sidebarAvatar || ''
      : activeProfile?.profile_photo_url || sidebarAvatar || ''
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
    // Keep the last-used mode for THIS account, not for anyone else
    // who later signs in on the same computer.
    if (user?.id && (mode === 'player' || mode === 'coach')) {
      localStorage.setItem(`shuttleLastRole:${user.id}`, mode)
    }
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
      if (user?.id) {
        localStorage.setItem(`shuttleLastRole:${user.id}`, 'player')
      }
      localStorage.setItem('activeRole', 'player')
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
      if (user?.id) {
        localStorage.setItem(`shuttleLastRole:${user.id}`, 'coach')
      }
      localStorage.setItem('activeRole', 'coach')
      navigate('/coach')
    }
  }

  const radialItems = mode === 'coach'
    ? [
        { label: 'Dashboard', icon: 'dashboard', to: '/coach' },
        { label: 'My Players', icon: 'players', to: '/coach/players' },
        { label: 'Sessions', icon: 'calendar', to: '/coach/sessions' },
        { label: 'Progress', icon: 'chart', to: '/coach/progress' },
        { label: 'Clubs', icon: 'clubs', to: '/coach/clubs' },
        { label: 'My Profile', icon: 'profile', to: '/coach/profile' },
        { label: 'Settings', icon: 'settings', to: '/coach/settings' },
        { label: 'Log out', icon: 'logout', action: handleLogout },
      ]
    : [
        { label: 'Dashboard', icon: 'dashboard', to: '/dashboard' },
        { label: 'My Profile', icon: 'profile', to: '/profile' },
        { label: 'Performance', icon: 'chart', to: '/performance' },
        { label: 'Fitness', icon: 'fitness', to: '/fitness' },
        { label: 'Expenses', icon: 'wallet', to: '/expenses' },
        { label: 'Players & Opponents', icon: 'players', to: '/players' },
        { label: 'Clubs', icon: 'clubs', to: '/clubs' },
        { label: 'Settings', icon: 'settings', to: '/settings' },
        { label: 'Log out', icon: 'logout', action: handleLogout },
      ]

  const navClass = ({ isActive }) =>
    `${styles.navItem} ${isActive ? styles.active : ''}`

  useEffect(() => {
    if (!user?.id) {
      setNavigationStyle('floating')
      return
    }
    try {
      const saved = localStorage.getItem(`shuttleNavigationStyle:${user.id}`)
      setNavigationStyle(saved === 'sidebar' ? 'sidebar' : 'floating')
    } catch {
      setNavigationStyle('floating')
    }
  }, [user?.id])

  useEffect(() => {
    const handleNavigationStyleChange = (event) => {
      if (event?.detail?.userId && String(event.detail.userId) !== String(user?.id)) return
      const next = event?.detail?.style
      if (next === 'sidebar' || next === 'floating') {
        setNavigationStyle(next)
        setRadialExpanded(false)
        setDragHoverIndex(-1)
      }
    }
    window.addEventListener('shuttle-navigation-style-changed', handleNavigationStyleChange)
    return () => window.removeEventListener('shuttle-navigation-style-changed', handleNavigationStyleChange)
  }, [user?.id])

  const hasBothModes = !checkingModes &&
    (hasPlayerProfile || hasPlayerAccess === true || profile?.has_player_access === true) &&
    (hasCoachProfile || hasCoachAccess === true || profile?.has_coach_access === true)

  const openRadialPage = (item) => {
    setDragHoverIndex(-1)
    setRadialExpanded(false)
    if (item.action) item.action()
    else if (item.to && item.to !== location.pathname) navigate(item.to)
  }

  const toggleRadialRole = () => {
    if (!hasBothModes) {
      // Keep the current role when the account does not have both profiles.
      return
    }
    setRadialExpanded(false)
    switchMode(mode === 'player' ? 'coach' : 'player')
  }


  const WHEEL_SIZE = Math.min(328, viewport.width - 16, viewport.height - 16)
  const WHEEL_RADIUS = WHEEL_SIZE / 2
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
  const dockX = floatingDrag?.x ?? clamp(dock.x, 36, Math.max(36, viewport.width - 36))
  const dockY = floatingDrag?.y ?? clamp(dock.y, 44, Math.max(44, viewport.height - 44))
  // The wheel shifts inward when opened, but the collapsed button stays where dropped.
  const menuX = clamp(dockX, WHEEL_RADIUS + 8, Math.max(WHEEL_RADIUS + 8, viewport.width - WHEEL_RADIUS - 8))
  const menuY = clamp(dockY, WHEEL_RADIUS + 8, Math.max(WHEEL_RADIUS + 8, viewport.height - WHEEL_RADIUS - 8))
  const centreX = radialExpanded ? menuX : dockX
  const centreY = radialExpanded ? menuY : dockY

  useEffect(() => {
    const refreshSize = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', refreshSize)
    return () => window.removeEventListener('resize', refreshSize)
  }, [])

  useEffect(() => {
    const key = `shuttleFloatingDock:${user?.id || 'default'}`
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        // Exact position from the freely movable version.
        setDock({ x: saved.x, y: saved.y })
      } else if (saved && ['left', 'right'].includes(saved.side) && Number.isFinite(saved.y)) {
        // Migrate the previous edge-docked position.
        setDock({ x: saved.side === 'left' ? 48 : window.innerWidth - 48, y: saved.y })
      } else {
        setDock({ x: window.innerWidth - 48, y: window.innerHeight - 56 })
      }
    } catch {
      setDock({ x: window.innerWidth - 48, y: window.innerHeight - 56 })
    }
  }, [user?.id])

  // P/C is for the Valorant-style wheel. Drag the separate grip to move it.
  const findRadialTarget = (clientX, clientY) => {
    const nodes = Array.from(document.querySelectorAll('[data-shuttle-radial-index]'))
    let nearest = -1
    let nearestDistance = Infinity
    nodes.forEach((node) => {
      const rect = node.getBoundingClientRect()
      const distance = Math.hypot(clientX - rect.left - rect.width / 2, clientY - rect.top - rect.height / 2)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = Number(node.getAttribute('data-shuttle-radial-index'))
      }
    })
    return nearestDistance <= 38 ? nearest : -1
  }

  const startRadialGesture = (event) => {
    if (event.button !== undefined && event.button !== 0) return
    if (radialCleanupRef.current) radialCleanupRef.current()
    const pointerId = event.pointerId
    const startedExpanded = radialExpanded
    const gesture = { pointerId, x: event.clientX, y: event.clientY, selecting: startedExpanded }
    radialGestureRef.current = gesture
    skipRoleClickRef.current = false

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      radialCleanupRef.current = null
    }

    const onMove = (moveEvent) => {
      const current = radialGestureRef.current
      if (!current || moveEvent.pointerId !== pointerId) return
      if (!current.selecting && Math.hypot(moveEvent.clientX - current.x, moveEvent.clientY - current.y) > 9) {
        current.selecting = true
        skipRoleClickRef.current = true
        setRadialExpanded(true)
      }
      if (current.selecting) {
        setDragHoverIndex(findRadialTarget(moveEvent.clientX, moveEvent.clientY))
      }
    }

    const finish = (endEvent, cancelled = false) => {
      if (endEvent.pointerId !== pointerId) return
      const current = radialGestureRef.current
      if (!current) return
      const selecting = current.selecting
      const destination = selecting && !cancelled
        ? findRadialTarget(endEvent.clientX, endEvent.clientY)
        : -1
      cleanup()
      radialGestureRef.current = null
      setDragHoverIndex(-1)
      if (selecting) {
        skipRoleClickRef.current = true
        if (destination >= 0 && radialItemsRef.current[destination]) {
          openRadialPage(radialItemsRef.current[destination])
        }
      }
    }
    const onUp = (upEvent) => finish(upEvent)
    const onCancel = (cancelEvent) => finish(cancelEvent, true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    radialCleanupRef.current = cleanup
  }

  const startDockGesture = (event) => {
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    if (radialCleanupRef.current) radialCleanupRef.current()
    const pointerId = event.pointerId
    const x0 = clamp(dock.x, 36, Math.max(36, viewport.width - 36))
    const y0 = clamp(dock.y, 44, Math.max(44, viewport.height - 44))
    const startX = event.clientX
    const startY = event.clientY
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      radialCleanupRef.current = null
    }
    const onMove = (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      setFloatingDrag({
        x: clamp(x0 + moveEvent.clientX - startX, 36, Math.max(36, viewport.width - 36)),
        y: clamp(y0 + moveEvent.clientY - startY, 44, Math.max(44, viewport.height - 44)),
      })
    }
    const finish = (endEvent, cancelled = false) => {
      if (endEvent.pointerId !== pointerId) return
      cleanup()
      setFloatingDrag(null)
      if (cancelled) return
      const x = clamp(x0 + endEvent.clientX - startX, 36, Math.max(36, viewport.width - 36))
      const y = clamp(y0 + endEvent.clientY - startY, 44, Math.max(44, viewport.height - 44))
      // Store the actual drop coordinates; do not snap to either edge.
      const nextDock = { x, y }
      setDock(nextDock)
      try { localStorage.setItem(`shuttleFloatingDock:${user?.id || 'default'}`, JSON.stringify(nextDock)) } catch { /* Storage unavailable */ }
    }
    const onUp = (upEvent) => finish(upEvent)
    const onCancel = (cancelEvent) => finish(cancelEvent, true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    radialCleanupRef.current = cleanup
  }

  radialItemsRef.current = radialItems

  useEffect(() => () => {
    if (radialCleanupRef.current) radialCleanupRef.current()
  }, [])

  return (
    <div className={`${styles.app} ${navigationStyle === 'sidebar' ? 'shuttleMobileSidebarLayout' : ''}`} style={navigationStyle === 'floating' ? { display: 'block', width: '100%', minHeight: '100vh' } : undefined}>
      {navigationStyle === 'sidebar' && (
        <style>{`
          /* Mobile classic navigation: full-width top bar, NOT a left sidebar. */
          @media (max-width: 900px) {
            .shuttleMobileSidebarLayout {
              display: flex !important;
              flex-direction: column !important;
              width: 100% !important;
              min-width: 0 !important;
              max-width: 100% !important;
              min-height: 100vh !important;
              overflow-x: clip !important;
            }
            .shuttleMobileSidebarLayout .shuttleMobileSidebar {
              display: block !important;
              position: relative !important;
              inset: auto !important;
              transform: none !important;
              width: 100% !important;
              min-width: 0 !important;
              max-width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              max-height: none !important;
              flex: 0 0 auto !important;
              margin: 0 !important;
              overflow: visible !important;
              box-sizing: border-box !important;
              border-radius: 0 !important;
            }
            .shuttleMobileSidebarLayout .shuttleMobileSidebar .${styles.sidebarLogo} {
              display: flex !important;
              position: relative !important;
              flex-direction: row !important;
              align-items: center !important;
              justify-content: flex-start !important;
              gap: 12px !important;
              min-height: 78px !important;
              padding: 14px 22px !important;
              box-sizing: border-box !important;
              width: 100% !important;
            }
            .shuttleMobileSidebarLayout .shuttleMobileSidebar .${styles.logoMark} {
              display: flex !important;
              visibility: visible !important;
              opacity: 1 !important;
              flex: 0 0 auto !important;
            }
            .shuttleMobileSidebarLayout .shuttleMobileSidebar .${styles.logoName} {
              display: block !important;
              font-size: clamp(17px, 4vw, 24px) !important;
              white-space: nowrap !important;
            }
            .shuttleMobileSidebarLayout .shuttleMobileSidebar .${styles.logoSub} {
              display: none !important;
            }
            .shuttleMobileSidebarLayout .shuttleMobileSidebar .${styles.sidebarCollapseBtn} {
              display: none !important;
            }
            .shuttleMobileSidebarLayout .shuttleMobileSidebar .${styles.roleSwitcherWrap} {
              display: flex !important;
              width: 100% !important;
              box-sizing: border-box !important;
              padding: 14px 20px !important;
              margin: 0 !important;
            }
            .shuttleMobileSidebarLayout .shuttleMobileSidebar .${styles.navSection} {
              display: flex !important;
              flex-direction: row !important;
              align-items: center !important;
              justify-content: flex-start !important;
              flex-wrap: nowrap !important;
              gap: 6px !important;
              width: 100% !important;
              min-height: 78px !important;
              max-width: 100% !important;
              padding: 12px 18px !important;
              margin: 0 !important;
              overflow-x: auto !important;
              overflow-y: hidden !important;
              white-space: nowrap !important;
              box-sizing: border-box !important;
              scrollbar-width: thin;
              -webkit-overflow-scrolling: touch;
            }
            .shuttleMobileSidebarLayout .shuttleMobileSidebar .${styles.navLabel} {
              display: none !important;
            }
            .shuttleMobileSidebarLayout .shuttleMobileSidebar .${styles.navItem} {
              display: inline-flex !important;
              flex: 0 0 auto !important;
              align-items: center !important;
              justify-content: center !important;
              gap: 10px !important;
              width: auto !important;
              min-width: max-content !important;
              padding: 12px 14px !important;
              margin: 0 !important;
              font-size: 14px !important;
              line-height: 1.3 !important;
              overflow: visible !important;
              text-decoration: none !important;
            }
            .shuttleMobileSidebarLayout .shuttleMobileSidebar .${styles.navItem} svg {
              display: block !important;
              width: 22px !important;
              height: 22px !important;
              flex: 0 0 auto !important;
            }
            .shuttleMobileSidebarLayout .shuttleMobileSidebar .${styles.sidebarUser},
            .shuttleMobileSidebarLayout .shuttleMobileSidebar .${styles.sidebarLogout} {
              display: none !important;
            }
            .shuttleMobileSidebarLayout > .${styles.main} {
              display: block !important;
              position: relative !important;
              width: 100% !important;
              min-width: 0 !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding-top: 0 !important;
              flex: 1 1 auto !important;
              box-sizing: border-box !important;
            }
          }
        `}</style>
      )}
      {/* Keep the classic sidebar collapsible on full-size desktops too. */}
      {navigationStyle === 'sidebar' && (
        <style>{`
          /* Explicitly show the collapse control on desktop, even if the CSS module hides it. */
          .${styles.sidebar} .${styles.sidebarLogo} {
            position: relative !important;
          }
          .${styles.sidebar} .${styles.sidebarCollapseBtn} {
            display: flex !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            position: absolute !important;
            top: 17px !important;
            right: 12px !important;
            left: auto !important;
            width: 30px !important;
            height: 30px !important;
            padding: 0 !important;
            align-items: center !important;
            justify-content: center !important;
            border-radius: 9px !important;
            border: 1px solid rgba(175,199,238,0.35) !important;
            background: rgba(255,255,255,0.06) !important;
            color: #dce8ff !important;
            cursor: pointer !important;
            z-index: 5 !important;
          }
          .${styles.sidebar} .${styles.sidebarCollapseBtn}:hover {
            background: rgba(66,115,213,0.4) !important;
          }
          [data-shuttle-sidebar-collapsed="true"] .${styles.sidebarCollapseBtn} {
            top: 14px !important;
            right: 21px !important;
          }
          [data-shuttle-sidebar-collapsed="true"] {
            width: 72px !important;
            min-width: 72px !important;
            max-width: 72px !important;
            flex: 0 0 72px !important;
            overflow-x: hidden !important;
          }
          [data-shuttle-sidebar-collapsed="true"] .${styles.sidebarLogo} {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 12px !important;
            padding: 16px 0 !important;
          }
          [data-shuttle-sidebar-collapsed="true"] .${styles.logoMark} {
            visibility: hidden !important;
          }
          [data-shuttle-sidebar-collapsed="true"] .${styles.logoName},
          [data-shuttle-sidebar-collapsed="true"] .${styles.logoSub},
          [data-shuttle-sidebar-collapsed="true"] .${styles.navLabel},
          [data-shuttle-sidebar-collapsed="true"] .${styles.userMeta},
          [data-shuttle-sidebar-collapsed="true"] .${styles.logoutText} {
            display: none !important;
          }
          [data-shuttle-sidebar-collapsed="true"] .${styles.navSection} {
            padding-left: 7px !important;
            padding-right: 7px !important;
          }
          [data-shuttle-sidebar-collapsed="true"] .${styles.navItem} {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 0 !important;
            padding: 12px 0 !important;
            font-size: 0 !important;
            line-height: 0 !important;
            overflow: hidden !important;
          }
          [data-shuttle-sidebar-collapsed="true"] .${styles.navItem} svg {
            display: block !important;
            width: 19px !important;
            height: 19px !important;
            flex-shrink: 0 !important;
          }
          [data-shuttle-sidebar-collapsed="true"] .${styles.sidebarUser},
          [data-shuttle-sidebar-collapsed="true"] .${styles.sidebarLogout} {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding-left: 0 !important;
            padding-right: 0 !important;
          }
          [data-shuttle-sidebar-collapsed="true"] .${styles.logoutBtn} {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 12px !important;
            font-size: 0 !important;
          }
        `}</style>
      )}
      {navigationStyle === 'sidebar' && (
      <aside
        className={`${styles.sidebar} shuttleMobileSidebar ${
          !isMobileSidebar && isNavCollapsed ? styles.sidebarCollapsed : ''
        }`}
        data-shuttle-sidebar-collapsed={!isMobileSidebar && isNavCollapsed ? 'true' : 'false'}
      >

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

          {!isMobileSidebar && <button
            type="button"
            className={styles.sidebarCollapseBtn}
            onClick={() => setSidebarCollapsed((previous) => !previous)}
            aria-label={
              isNavCollapsed
                ? 'Expand navigation'
                : 'Minimise navigation'
            }
            title={
              isNavCollapsed
                ? 'Expand navigation'
                : 'Minimise navigation'
            }
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              width="16"
              height="16"
              aria-hidden="true"
            >
              <path
                d={
                  sidebarCollapsed ? 'M7 4l6 6-6 6' : 'M13 4l-6 6 6 6' 
                }
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>}
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
            className={styles.roleSwitcherWrap}
            style={{
              padding: isNavCollapsed ? '8px 4px' : '16px 12px',
              borderBottom: '1px solid #1e2d50',
              marginBottom: isNavCollapsed ? 8 : 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: isNavCollapsed ? 'column' : 'row',
                width: '100%',
                background: '#0a1020',
                borderRadius: 10,
                padding: 3,
                gap: 3,
              }}
            >
              <button
                type="button"
                onClick={() => switchMode('player')}
                aria-label="Switch to Player portal"
                title="Player portal"
                style={{
                  flex: 1,
                  padding: isNavCollapsed ? '7px 0' : '7px 0',
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
                {isNavCollapsed ? 'P' : 'Player'}
              </button>

              <button
                type="button"
                onClick={() => switchMode('coach')}
                aria-label="Switch to Coach portal"
                title="Coach portal"
                style={{
                  flex: 1,
                  padding: isNavCollapsed ? '7px 0' : '7px 0',
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
                {isNavCollapsed ? 'C' : 'Coach'}
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
              title="/coach" className={navClass}
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
              title="/coach/players" className={navClass}
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
              title="/coach/sessions" className={navClass}
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
              title="/coach/progress" className={navClass}
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
              title="/coach/clubs" className={navClass}
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
              Club 
            </NavLink>

            <div
              className={styles.navLabel}
              style={{ marginTop: 14 }}
            >
              Account
            </div>

            <NavLink
              to="/coach/profile"
              title="/coach/profile" className={navClass}
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
              title="/coach/settings" className={navClass}
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
              title="/dashboard" className={navClass}
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
              title="/profile" className={navClass}
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
              title="/performance" className={navClass}
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
              title="/fitness" className={navClass}
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
              title="/expenses" className={navClass}
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
              title="/players" className={navClass}
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
              title="/clubs" className={navClass}
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
              title="/settings" className={navClass}
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
            {activeSidebarAvatar ? (
              <img
                src={activeSidebarAvatar}
                alt={`${displayName} profile`}
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

          <div className={styles.userMeta}>
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
            <span className={styles.logoutText}>Log out</span>
          </button>
        </div>
      </aside>
      )}
      <main className={styles.main} style={navigationStyle === 'floating' ? { marginLeft: 0, width: '100%', maxWidth: 'none', minWidth: 0, flex: 'none' } : isMobileSidebar ? { marginLeft: 0, width: '100%', maxWidth: '100%', minWidth: 0, flex: '1 1 auto' } : sidebarCollapsed ? { marginLeft: 0, minWidth: 0, flex: '1 1 0%' } : undefined}>
        <Outlet />
      </main>

      {/* Only mount the radial menu when selected in Settings. */}
      {navigationStyle === 'floating' && radialExpanded && (
        <button type="button" aria-label="Close navigation menu" onClick={() => setRadialExpanded(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 2799, background: 'rgba(5,13,30,.14)', border: 0, cursor: 'default' }} />
      )}
      {navigationStyle === 'floating' && <div style={{ position: 'fixed', left: centreX, top: centreY, width: radialExpanded ? WHEEL_SIZE : 64, height: radialExpanded ? WHEEL_SIZE : 64, transform: 'translate(-50%, -50%)', zIndex: 2800, fontFamily: 'inherit', pointerEvents: 'none' }}>
        {radialExpanded && (
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle at 47% 40%, #1b3763 0%, #102447 54%, #08172c 100%)', border: '1px solid rgba(139,193,255,.4)', boxShadow: '0 20px 65px rgba(3,12,30,.36), inset 0 0 40px rgba(47,103,220,.13)', pointerEvents: 'auto' }}>
            <div style={{ position: 'absolute', inset: '17%', borderRadius: '50%', border: '1px dashed rgba(140,185,255,.19)', pointerEvents: 'none' }} />
              {radialItems.map((item, index) => {
                // Nine nodes for Player, eight for Coach. Avoid the bottom-right handle.
                const angle = -Math.PI / 2 + (index * 2 * Math.PI) / radialItems.length
                const x = 50 + 37.2 * Math.cos(angle)
                const y = 50 + 37.2 * Math.sin(angle)
                const isActive = Boolean(item.to) && (location.pathname === item.to || (item.to !== '/coach' && item.to !== '/dashboard' && location.pathname.startsWith(`${item.to}/`)))
                return (
                  <button
                    key={item.label}
                    data-shuttle-radial-index={index}
                    type="button"
                    onClick={() => openRadialPage(item)}
                    title={item.label}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) ${dragHoverIndex === index ? 'scale(1.19)' : 'scale(1)'}`, transition: 'transform .12s, box-shadow .12s, background .12s', width: 47, height: 47, borderRadius: '50%', border: dragHoverIndex === index ? '2px solid #9dfcec' : isActive ? '2px solid #81B5FF' : '1px solid #476691', background: dragHoverIndex === index ? '#0EA883' : isActive ? '#1A5FFF' : '#1b3458', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: dragHoverIndex === index ? '0 0 24px rgba(52,211,153,.75)' : isActive ? '0 0 14px rgba(59,130,246,.55)' : '0 3px 12px rgba(0,0,0,.25)' }}
                  >
                    <RadialNavIcon name={item.icon} />
                  </button>
                )
              })}
            {dragHoverIndex >= 0 && radialItems[dragHoverIndex] && <div style={{ position: 'absolute', left: '50%', top: '77%', transform: 'translateX(-50%)', color: '#5af5cc', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', pointerEvents: 'none', textShadow: '0 2px 10px #071322' }}>{radialItems[dragHoverIndex].label}</div>}
            <div style={{ position: 'absolute', top: '69%', left: '50%', transform: 'translateX(-50%)', color: '#a3badc', fontSize: 10, fontWeight: 650, whiteSpace: 'nowrap', pointerEvents: 'none' }}>{mode === 'coach' ? 'COACH PORTAL' : 'PLAYER PORTAL'}</div>
          </div>
        )}
        <div style={{ position: 'absolute', width: 64, height: 64, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 2, pointerEvents: 'auto' }}>
          <button type="button" onPointerDown={startRadialGesture}
            onClick={() => {
              if (skipRoleClickRef.current) { skipRoleClickRef.current = false; return }
              toggleRadialRole()
            }}
            title={radialExpanded ? 'Drag toward an icon and release · click to switch role' : 'Drag toward a page icon · tap to switch role'}
            aria-label={hasBothModes ? `Switch to ${mode === 'player' ? 'Coach' : 'Player'} portal` : `${sidebarRole} portal`}
            style={{ position: 'absolute', inset: 0, width: 64, height: 64, borderRadius: '50%', border: `3px solid ${mode === 'coach' ? '#72f0cf' : '#90b6ff'}`, background: mode === 'coach' ? 'linear-gradient(145deg,#0b9a76,#05634f)' : 'linear-gradient(145deg,#2977ff,#1241aa)', color: '#fff', fontSize: 27, fontWeight: 900, cursor: radialExpanded ? 'crosshair' : 'grab', touchAction: 'none', userSelect: 'none', boxShadow: '0 10px 28px rgba(13,40,100,.32)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >{mode === 'coach' ? 'C' : 'P'}</button>
          <button type="button" aria-label={radialExpanded ? 'Minimise navigation' : 'Expand navigation'}
            title={radialExpanded ? 'Minimise menu' : 'Expand menu'}
            onClick={() => { setRadialExpanded((previous) => !previous); setDragHoverIndex(-1) }}
            style={{ position: 'absolute', width: 26, height: 26, right: -5, top: -6, borderRadius: '50%', border: '2px solid #fff', background: '#142c54', color: '#fff', fontSize: 17, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 3px 10px rgba(0,0,0,.28)' }}
          >{radialExpanded ? '−' : '+'}</button>
          {!radialExpanded && <button type="button" aria-label="Move floating navigation" title="Drag to reposition the navigation button"
            onPointerDown={startDockGesture}
            onClick={(event) => { event.preventDefault(); event.stopPropagation() }}
            style={{ position: 'absolute', left: -10, bottom: -9, width: 27, height: 27, borderRadius: '50%', border: '2px solid #fff', background: '#142c54', color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', touchAction: 'none', userSelect: 'none', boxShadow: '0 3px 10px rgba(0,0,0,.25)' }}
          >⠿</button>}
        </div>
      </div>}

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