import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_EMAILS = ['admin@demo.com', 'tricia@admin.com']

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadAppUser(currentUser) {
    if (!currentUser?.id) {
      setProfile(null)
      return null
    }

    const { data, error } = await supabase
      .from('app_users')
      .select('user_id, email, full_name, username, role, setup_completed')
      .eq('user_id', currentUser.id)
      .maybeSingle()

    if (error) {
      console.error('loadAppUser error:', error.message)
      setProfile(null)
      return null
    }

    if (data) {
      setProfile(data)
      return data
    }

    console.warn('No app_users row found for this user.')
    setProfile(null)
    return null
  }

  async function refreshProfile() {
    if (!user?.id) return null
    return await loadAppUser(user)
  }

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      console.log('Auth init started')

      try {
        setLoading(true)

        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ data: { session: null }, error: null }),
              1500
            )
          ),
        ])

        const {
          data: { session },
          error,
        } = sessionResult

        if (error) {
          console.error('getSession error:', error.message)
        }

        if (!mounted) return

        const currentUser = session?.user || null

        console.log('Current user:', currentUser)

        setUser(currentUser)

        if (currentUser) {
          await loadAppUser(currentUser)
        } else {
          setProfile(null)
        }
      } catch (err) {
        console.error('Auth init failed:', err)
        setUser(null)
        setProfile(null)
      } finally {
        if (mounted) {
          console.log('Auth loading finished')
          setLoading(false)
        }
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event)

      const currentUser = session?.user || null

      setUser(currentUser)

      if (!currentUser) {
        setProfile(null)
        setLoading(false)
        return
      }

      setLoading(true)

      setTimeout(async () => {
        try {
          await loadAppUser(currentUser)
        } catch (err) {
          console.error('Auth state change load error:', err)
          setProfile(null)
        } finally {
          setLoading(false)
        }
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function saveProfile(profileData) {
    let activeUser = user

    if (!activeUser?.id) {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      activeUser = currentUser
    }

    if (!activeUser?.id) {
      return {
        success: false,
        error: 'No logged in user found. Please login again.',
      }
    }

    const updateData = {}

    if (profileData.full_name || profileData.name) {
      updateData.full_name = profileData.full_name || profileData.name
    }

    if (profileData.username !== undefined) {
      updateData.username = profileData.username
    }

    if (profileData.role) {
      updateData.role = profileData.role
    }

    if (profileData.setup_completed !== undefined) {
      updateData.setup_completed = profileData.setup_completed
    }

    const { data, error } = await supabase
      .from('app_users')
      .update(updateData)
      .eq('user_id', activeUser.id)
      .select()
      .single()

    if (error) {
      console.error('saveProfile error:', error.message)
      return {
        success: false,
        error: error.message,
      }
    }

    setProfile(data)

    return {
      success: true,
      data,
    }
  }

  async function loginWithGoogle() {
    return {
      success: false,
      error: 'Google login will be added later after email login and setup are working.',
    }
  }

  async function logout() {
    localStorage.removeItem('demoUser')
    localStorage.removeItem('selectedRole')
    localStorage.removeItem('pendingRole')

    await supabase.auth.signOut()

    setUser(null)
    setProfile(null)
    setLoading(false)
  }

  function setDemoUser(demoUser) {
    setUser(demoUser)
    setProfile(demoUser)
    localStorage.setItem('demoUser', JSON.stringify(demoUser))
    setLoading(false)
  }

  const isAdmin =
    ADMIN_EMAILS.includes(user?.email) ||
    profile?.role === 'admin'

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin,
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
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}