import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_EMAILS = ['admin@demo.com']

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const demoUser = localStorage.getItem('demoUser')

      if (demoUser) {
        const parsed = JSON.parse(demoUser)
        setUser(parsed)
        setProfile(parsed)
        setLoading(false)
        return
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        setUser(session.user)
        await fetchOrCreate(session.user)
      } else {
        setUser(null)
        setProfile(null)
      }

      setLoading(false)
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        await fetchOrCreate(session.user)
      } else {
        setUser(null)
        setProfile(null)
      }

      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchOrCreate(u) {
    if (!u?.id) return

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', u.id)
      .maybeSingle()

    if (data) {
      setProfile(data)
      return data
    }

    const selectedRole =
      u.user_metadata?.role ||
      localStorage.getItem('selectedRole') ||
      'player'

    const newProfile = {
      id: u.id,
      name:
        u.user_metadata?.full_name ||
        u.user_metadata?.name ||
        u.email?.split('@')[0] ||
        'Player',
      username: u.user_metadata?.username || '',
      email: u.email,
      role: ADMIN_EMAILS.includes(u.email) ? 'admin' : selectedRole,
      status: 'active',
    }

    const { error } = await supabase.from('profiles').insert(newProfile)

    if (!error) {
      setProfile(newProfile)
      return newProfile
    }

    return null
  }

  const setDemoUser = (demoUser) => {
    setUser(demoUser)
    setProfile(demoUser)
    localStorage.setItem('demoUser', JSON.stringify(demoUser))
  }

  const saveProfile = async (profileData) => {
    let activeUser = user

    if (!activeUser?.id) {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      activeUser = currentUser
    }

    if (!activeUser?.id) {
      console.error('No logged in user found when saving profile.')
      return {
        success: false,
        error: 'No logged in user found. Please login again.',
      }
    }

    const finalProfile = {
      ...profileData,
      id: activeUser.id,
      email: activeUser.email,
      name:
        profileData.name ||
        activeUser.user_metadata?.full_name ||
        activeUser.email?.split('@')[0] ||
        'Player',
      role:
        profileData.role ||
        profile?.role ||
        activeUser.user_metadata?.role ||
        localStorage.getItem('selectedRole') ||
        'player',
      status: profileData.status || profile?.status || 'active',
    }

    const { error } = await supabase
      .from('profiles')
      .upsert(finalProfile, { onConflict: 'id' })
      .select()
      .single()

    if (error) {
      console.error(error)
      return { success: false, error: error.message }
    }

    setProfile((prev) => ({
      ...prev,
      ...finalProfile,
    }))

    return { success: true }
  }

  const loginWithGoogle = async (rememberMe = false) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: {
          access_type: rememberMe ? 'offline' : 'online',
          prompt: rememberMe ? 'consent' : 'select_account',
        },
      },
    })

    return { success: !error, error }
  }

  const logout = async () => {
    localStorage.removeItem('demoUser')
    localStorage.removeItem('selectedRole')
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin: ADMIN_EMAILS.includes(user?.email),
        loginWithGoogle,
        saveProfile,
        logout,
        setDemoUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}