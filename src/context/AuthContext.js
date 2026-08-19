import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const RETURNING_REVERIFY_DAYS = 30

function needsReturningReverification(appUser) {
  if (!appUser?.last_seen_at) return false

  const isPlayerAccount =
    appUser.has_player_access === true ||
    String(appUser.role || '').toLowerCase() === 'player'

  if (!isPlayerAccount) return false

  const lastSeenMs = new Date(appUser.last_seen_at).getTime()
  if (!Number.isFinite(lastSeenMs)) return false

  const inactiveMs = Date.now() - lastSeenMs
  const thresholdMs =
    RETURNING_REVERIFY_DAYS * 24 * 60 * 60 * 1000

  return inactiveMs >= thresholdMs
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')

  /*
   * Loads the correct role profile:
   *
   * player -> player_profiles
   * coach  -> coach_profiles
   * admin  -> app_users only
   */
  const loadRoleProfile = useCallback(
    async (currentUser, role) => {
      if (!currentUser?.id) return null

      const normalizedRole = role?.toLowerCase()

      if (normalizedRole === 'coach') {
        const { data, error } = await supabase
          .from('coach_profiles')
          .select(`
            user_id,
            display_name,
            club
          `)
          .eq('user_id', currentUser.id)
          .maybeSingle()

        if (error) {
          console.error(
            'load coach_profiles error:',
            error.message
          )
          return null
        }

        return data
      }

      if (normalizedRole === 'player') {
        const { data, error } = await supabase
          .from('player_profiles')
          .select(`
            user_id,
            display_name,
            club
          `)
          .eq('user_id', currentUser.id)
          .maybeSingle()

        if (error) {
          console.error(
            'load player_profiles error:',
            error.message
          )
          return null
        }

        return data
      }

      return null
    },
    []
  )

  /*
   * Loads app_users first, then combines it with the
   * matching player_profiles or coach_profiles row.
   */
  const loadAppUser = useCallback(
    async (currentUser) => {
      if (!currentUser?.id) {
        setProfile(null)
        return null
      }

      try {
        const { data: appUser, error: appUserError } =
          await supabase
            .from('app_users')
            .select(`
              user_id,
              email,
              full_name,
              username,
              role,
              setup_completed,
              has_player_access,
              has_coach_access,
              account_status,
              removed_at,
              last_seen_at,
              created_at,
              updated_at
            `)
            .eq('user_id', currentUser.id)
            .maybeSingle()

        if (appUserError) {
          throw appUserError
        }

        if (!appUser) {
          console.warn(
            'No app_users row found for this user.'
          )
          setProfile(null)
          return null
        }

        const accountStatus = String(
          appUser.account_status || 'active'
        ).toLowerCase()

        if (appUser.removed_at) {
          const message =
            'This ShuttleTrack account is no longer available.'

          sessionStorage.setItem(
            'shuttleLoginBlockedMessage',
            message
          )

          setAuthError(message)
          setProfile(null)

          await supabase.auth.signOut()

          setUser(null)
          return null
        }

        if (accountStatus === 'disabled') {
          const message =
            'Your ShuttleTrack account has been disabled by an administrator. You cannot access your account at this time.'

          sessionStorage.setItem(
            'shuttleLoginBlockedMessage',
            message
          )

          setAuthError(message)
          setProfile(null)

          await supabase.auth.signOut()

          setUser(null)
          return null
        }

        if (accountStatus === 'suspended') {
          const message =
            'Your ShuttleTrack account is currently suspended.'

          sessionStorage.setItem(
            'shuttleLoginBlockedMessage',
            message
          )

          setAuthError(message)
          setProfile(null)

          await supabase.auth.signOut()

          setUser(null)
          return null
        }

        if (accountStatus !== 'active') {
          const message =
            'Your ShuttleTrack account is not currently active. You cannot access your account at this time.'

          sessionStorage.setItem(
            'shuttleLoginBlockedMessage',
            message
          )

          setAuthError(message)
          setProfile(null)

          await supabase.auth.signOut()

          setUser(null)
          return null
        }

        const roleProfile = await loadRoleProfile(
          currentUser,
          appUser.role
        )

        const combinedProfile = {
          ...appUser,

          requires_reverification:
            needsReturningReverification(appUser),

          display_name:
            roleProfile?.display_name ||
            appUser.full_name ||
            appUser.username ||
            currentUser.user_metadata?.display_name ||
            currentUser.user_metadata?.full_name ||
            currentUser.email?.split('@')[0] ||
            'User',

          club: roleProfile?.club || '',
        }

        setAuthError('')
        setProfile(combinedProfile)

        return combinedProfile
      } catch (error) {
        console.error(
          'loadAppUser error:',
          error?.message || error
        )

        setProfile(null)
        return null
      }
    },
    [loadRoleProfile]
  )

  /*
   * Updates last_seen_at through your Supabase RPC.
   */
  const touchLastSeen = useCallback(
    async (currentUser) => {
      if (!currentUser?.id) return false

      const { error } = await supabase.rpc(
        'touch_last_seen'
      )

      if (error) {
        console.error(
          'touch_last_seen error:',
          error.message
        )

        if (
          error.message.includes('ACCOUNT_BLOCKED') ||
          error.message.includes('account has been')
        ) {
          const message =
            'This account is no longer active.'

          sessionStorage.setItem(
            'shuttleLoginBlockedMessage',
            message
          )

          setAuthError(message)

          await supabase.auth.signOut()

          setUser(null)
          setProfile(null)
        }

        return false
      }

      return true
    },
    []
  )

  /*
   * Reloads both app_users and the correct role profile.
   * Use this after saving Player Profile or Coach Profile.
   */
  const refreshProfile = useCallback(async () => {
    if (!user?.id) return null

    return loadAppUser(user)
  }, [user, loadAppUser])

  /*
   * Initial authentication loading.
   *
   * Important:
   * - getSession() restores the current browser session.
   * - onAuthStateChange() loads app_users only for auth events
   *   that actually require a profile refresh.
   * - TOKEN_REFRESHED is ignored for profile loading so a token
   *   refresh does not trigger another app_users query.
   *
   * This keeps refresh/login behaviour the same while reducing
   * duplicate Supabase requests.
   */
  useEffect(() => {
    let mounted = true
    let profileLoadTimer = null

    async function initAuth() {
      try {
        setLoading(true)

        const sessionOnly =
          localStorage.getItem('shuttleSessionOnly') === 'true'

        const browserSessionActive =
          sessionStorage.getItem('shuttleBrowserSession') === 'true'

        /*
         * If Remember me was OFF, the session should only survive
         * for the current browser session. sessionStorage is cleared
         * when that browser session ends, so a restored Supabase
         * session must be signed out here before protected routes load.
         */
        if (sessionOnly && !browserSessionActive) {
          await supabase.auth.signOut({
            scope: 'local',
          })

          localStorage.removeItem('activeRole')
          localStorage.removeItem('shuttleSessionOnly')
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error(
            'getSession error:',
            error.message
          )
        }

        if (!mounted) return

        const currentUser = session?.user || null

        setUser(currentUser)

        if (!currentUser) {
          setProfile(null)
          setLoading(false)
        }

        /*
         * Do not call loadAppUser() here.
         * INITIAL_SESSION from onAuthStateChange will load it.
         */
      } catch (error) {
        console.error('Auth init failed:', error)

        if (mounted) {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUser = session?.user || null

        /*
         * Token refreshes do not change the ShuttleTrack profile,
         * so do not query app_users again.
         */
        if (event === 'TOKEN_REFRESHED') {
          if (mounted) {
            setUser(currentUser)
          }
          return
        }

        /*
         * Signed out / session removed.
         */
        if (!currentUser) {
          if (mounted) {
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
          return
        }

        /*
         * Only these events need to reload the application profile.
         */
        if (
          event !== 'INITIAL_SESSION' &&
          event !== 'SIGNED_IN' &&
          event !== 'USER_UPDATED'
        ) {
          if (mounted) {
            setUser(currentUser)
          }
          return
        }

        if (mounted) {
          setUser(currentUser)
          setLoading(true)
        }

        /*
         * If Supabase emits another profile-loading auth event
         * immediately, cancel the previous queued load. This avoids
         * duplicate app_users queries during startup.
         */
        if (profileLoadTimer) {
          window.clearTimeout(profileLoadTimer)
        }

        profileLoadTimer = window.setTimeout(async () => {
          try {
            const loadedProfile =
              await loadAppUser(currentUser)

            if (
              loadedProfile &&
              !loadedProfile.requires_reverification
            ) {
              await touchLastSeen(currentUser)
            }
          } catch (error) {
            console.error(
              'Auth state load error:',
              error
            )

            if (mounted) {
              setProfile(null)
            }
          } finally {
            if (mounted) {
              setLoading(false)
            }
          }
        }, 0)
      }
    )

    return () => {
      mounted = false

      if (profileLoadTimer) {
        window.clearTimeout(profileLoadTimer)
      }

      subscription.unsubscribe()
    }
  }, [loadAppUser, touchLastSeen])

  /*
   * While the app is open, refresh account status and
   * last_seen_at every five minutes.
   */
  useEffect(() => {
    if (!user?.id) return undefined

    const currentUser = user

    const heartbeat = async () => {
      const loadedProfile =
        await loadAppUser(currentUser)

      if (
        loadedProfile &&
        !loadedProfile.requires_reverification
      ) {
        await touchLastSeen(currentUser)
      }
    }

    const intervalId = window.setInterval(
      heartbeat,
      5 * 60 * 1000
    )

    return () => {
      window.clearInterval(intervalId)
    }
  }, [user, loadAppUser, touchLastSeen])

  /*
   * Saves shared account fields to app_users and saves
   * display_name/club to the matching role profile table.
   */
  async function saveProfile(profileData) {
    let activeUser = user

    if (!activeUser?.id) {
      const {
        data: { user: currentUser },
        error: getUserError,
      } = await supabase.auth.getUser()

      if (getUserError) {
        return {
          success: false,
          error: getUserError.message,
        }
      }

      activeUser = currentUser
    }

    if (!activeUser?.id) {
      return {
        success: false,
        error:
          'No logged-in user found. Please log in again.',
      }
    }

    /*
     * Reload app_users so the current database role
     * decides which profile table should be updated.
     */
    const { data: currentAppUser, error: appUserReadError } =
      await supabase
        .from('app_users')
        .select('role')
        .eq('user_id', activeUser.id)
        .maybeSingle()

    if (appUserReadError) {
      console.error(
        'read app_users role error:',
        appUserReadError.message
      )

      return {
        success: false,
        error: appUserReadError.message,
      }
    }

    const currentRole =
      currentAppUser?.role?.toLowerCase() ||
      profile?.role?.toLowerCase() ||
      'player'

    /*
     * Normal users are not allowed to change role or
     * account_status through this function.
     */
    const appUserUpdate = {}

    if (
      profileData.full_name !== undefined ||
      profileData.name !== undefined
    ) {
      const fullName =
        profileData.full_name ?? profileData.name

      appUserUpdate.full_name =
        typeof fullName === 'string'
          ? fullName.trim()
          : fullName
    }

    if (profileData.username !== undefined) {
      appUserUpdate.username =
        typeof profileData.username === 'string'
          ? profileData.username.trim()
          : profileData.username
    }

    if (
      profileData.setup_completed !== undefined
    ) {
      appUserUpdate.setup_completed =
        profileData.setup_completed
    }

    if (Object.keys(appUserUpdate).length > 0) {
      const { error: appUserUpdateError } =
        await supabase
          .from('app_users')
          .update(appUserUpdate)
          .eq('user_id', activeUser.id)

      if (appUserUpdateError) {
        console.error(
          'save app_users error:',
          appUserUpdateError.message
        )

        return {
          success: false,
          error: appUserUpdateError.message,
        }
      }
    }

    /*
     * display_name and club belong to player_profiles
     * or coach_profiles.
     */
    const roleProfileUpdate = {}

    if (profileData.display_name !== undefined) {
      roleProfileUpdate.display_name =
        typeof profileData.display_name === 'string'
          ? profileData.display_name.trim()
          : profileData.display_name
    }

    if (
      profileData.club !== undefined ||
      profileData.club_name !== undefined
    ) {
      const clubValue =
        profileData.club ?? profileData.club_name

      roleProfileUpdate.club =
        typeof clubValue === 'string'
          ? clubValue.trim()
          : clubValue
    }

    if (
      Object.keys(roleProfileUpdate).length > 0 &&
      (currentRole === 'player' ||
        currentRole === 'coach')
    ) {
      const roleTable =
        currentRole === 'coach'
          ? 'coach_profiles'
          : 'player_profiles'

      const { error: roleProfileError } =
        await supabase
          .from(roleTable)
          .update(roleProfileUpdate)
          .eq('user_id', activeUser.id)

      if (roleProfileError) {
        console.error(
          `save ${roleTable} error:`,
          roleProfileError.message
        )

        return {
          success: false,
          error: roleProfileError.message,
        }
      }
    }

    /*
     * Reload the combined profile so the sidebar updates
     * immediately without requiring a page refresh.
     */
    const updatedProfile =
      await loadAppUser(activeUser)

    if (!updatedProfile) {
      return {
        success: false,
        error:
          'The profile was saved but could not be reloaded.',
      }
    }

    window.dispatchEvent(
      new CustomEvent('profile-updated', {
        detail: updatedProfile,
      })
    )

    return {
      success: true,
      data: updatedProfile,
    }
  }

  async function loginWithGoogle() {
    return {
      success: false,
      error:
        'Google login will be added later after email login and setup are working.',
    }
  }

  async function logout() {
    localStorage.removeItem('demoUser')
    localStorage.removeItem('selectedRole')
    localStorage.removeItem('pendingRole')
    localStorage.removeItem('activeRole')
    localStorage.removeItem('shuttleSessionOnly')
    sessionStorage.removeItem('shuttleAddingRole')
    sessionStorage.removeItem('shuttleBrowserSession')

    const { error } = await supabase.auth.signOut({
      scope: 'local',
    })

    if (error) {
      console.error('Logout error:', error.message)

      return {
        success: false,
        error: error.message,
      }
    }

    setUser(null)
    setProfile(null)
    setAuthError('')
    setLoading(false)

    return {
      success: true,
    }
  }

  function setDemoUser(demoUser) {
    setUser(demoUser)
    setProfile(demoUser)

    localStorage.setItem(
      'demoUser',
      JSON.stringify(demoUser)
    )

    setLoading(false)
  }

  const isAdmin =
    profile?.role?.toLowerCase() === 'admin' &&
    profile?.account_status === 'active'

  const hasPlayerAccess =
    profile?.has_player_access === true ||
    profile?.role?.toLowerCase() === 'player'

  const hasCoachAccess =
    profile?.has_coach_access === true ||
    profile?.role?.toLowerCase() === 'coach'

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authError,
        isAdmin,
        hasPlayerAccess,
        hasCoachAccess,
        refreshProfile,
        saveProfile,
        loginWithGoogle,
        logout,
        setDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider'
    )
  }

  return context
}