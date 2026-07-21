import React, { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'

import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'

import Layout from './components/Layout/Layout'

import Dashboard from './components/Player/Dashboard'
import Profile from './components/Player/Profile'
import Performance from './components/Player/Performance'
import Fitness from './components/Player/Fitness'
import Expenses from './components/Player/Expenses'
import Players from './components/Player/Players'
import Settings from './components/Player/Settings'

import Login from './components/Welcome/Login'
import Register from './components/Welcome/Register'
import ResetPassword from './components/Welcome/ResetPassword'

import AuthCallback from './components/Admin/AuthCallback'
import AdminDashboard from './components/Admin/Admin'

import Setup from './Setup'

import CoachDashboard from './components/Coach/CoachDashboard'
import CoachPlayers from './components/Coach/CoachPlayers'
import CoachSessions from './components/Coach/CoachSessions'
import CoachProgress from './components/Coach/CoachProgress'
import CoachProfile from './components/Coach/CoachProfile'

function LoadingScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0D1117',
        color: '#8892A4',
      }}
    >
      Loading...
    </div>
  )
}

function getUserRole(profile, isAdmin) {
  if (isAdmin) {
    return 'admin'
  }

  return profile?.role || 'player'
}

function getSetupCompleted(profile) {
  return profile?.setup_completed === true
}

function getUserRedirectPath(profile, isAdmin) {
  const role = getUserRole(profile, isAdmin)

  if (role === 'admin') {
    return '/admin'
  }

  if (role === 'coach') {
    return '/coach'
  }

  if (role === 'player' && !getSetupCompleted(profile)) {
    return '/setup'
  }

  return '/dashboard'
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function PublicRoute({ children }) {
  const { user, profile, loading, isAdmin } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (user) {
    return (
      <Navigate
        to={getUserRedirectPath(profile, isAdmin)}
        replace
      />
    )
  }

  return children
}

function AdminRoute({ children }) {
  const { user, profile, isAdmin, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const role = getUserRole(profile, isAdmin)

  if (role !== 'admin') {
    return (
      <Navigate
        to={getUserRedirectPath(profile, isAdmin)}
        replace
      />
    )
  }

  return children
}

function CoachRoute({ children }) {
  const { user, profile, loading, isAdmin } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const role = getUserRole(profile, isAdmin)

  if (role !== 'coach') {
    return (
      <Navigate
        to={getUserRedirectPath(profile, isAdmin)}
        replace
      />
    )
  }

  return children
}

/*
  Players can access player pages normally.

  Coaches can access player pages only when their account also has
  a row in player_profiles.
*/
function PlayerRoute({ children }) {
  const { user, profile, loading, isAdmin } = useAuth()

  const [checkingPlayerProfile, setCheckingPlayerProfile] =
    useState(true)
  const [hasPlayerProfile, setHasPlayerProfile] =
    useState(false)

  const role = getUserRole(profile, isAdmin)

  useEffect(() => {
    let active = true

    async function checkPlayerAccess() {
      if (loading) {
        return
      }

      if (!user) {
        if (active) {
          setHasPlayerProfile(false)
          setCheckingPlayerProfile(false)
        }
        return
      }

      if (role === 'admin') {
        if (active) {
          setHasPlayerProfile(false)
          setCheckingPlayerProfile(false)
        }
        return
      }

      if (role === 'player') {
        if (active) {
          setHasPlayerProfile(true)
          setCheckingPlayerProfile(false)
        }
        return
      }

      try {
        setCheckingPlayerProfile(true)

        const { data, error } = await supabase
          .from('player_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (error) {
          throw error
        }

        if (active) {
          setHasPlayerProfile(Boolean(data))
        }
      } catch (error) {
        console.error(
          'Unable to check player profile:',
          error
        )

        if (active) {
          setHasPlayerProfile(false)
        }
      } finally {
        if (active) {
          setCheckingPlayerProfile(false)
        }
      }
    }

    checkPlayerAccess()

    return () => {
      active = false
    }
  }, [loading, role, user])

  if (loading || checkingPlayerProfile) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  if (role === 'coach' && !hasPlayerProfile) {
    return <Navigate to="/coach" replace />
  }

  if (role === 'player' && !getSetupCompleted(profile)) {
    return <Navigate to="/setup" replace />
  }

  return children
}

function PlayerSetupRoute({ children }) {
  const { user, profile, loading, isAdmin } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const role = getUserRole(profile, isAdmin)
  const searchParams = new URLSearchParams(location.search)
  const isRedoSetup = searchParams.get('redo') === '1'

  if (role === 'admin') {
    return <Navigate to="/admin" replace />
  }

  if (role === 'coach') {
    return <Navigate to="/coach" replace />
  }

  if (getSetupCompleted(profile) && !isRedoSetup) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public authentication routes */}
        <Route
          path="/"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />

        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        <Route
          path="/reset-password"
          element={<ResetPassword />}
        />

        <Route
          path="/auth/callback"
          element={<AuthCallback />}
        />

        {/* Player setup */}
        <Route
          path="/setup"
          element={
            <PlayerSetupRoute>
              <Setup />
            </PlayerSetupRoute>
          }
        />

        <Route
          path="/player-setup"
          element={<Navigate to="/setup" replace />}
        />

        {/* Main application layout */}
        <Route
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          {/* Player routes */}
          <Route
            path="/dashboard"
            element={
              <PlayerRoute>
                <Dashboard />
              </PlayerRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <PlayerRoute>
                <Profile />
              </PlayerRoute>
            }
          />

          <Route
            path="/performance"
            element={
              <PlayerRoute>
                <Performance />
              </PlayerRoute>
            }
          />

          <Route
            path="/fitness"
            element={
              <PlayerRoute>
                <Fitness />
              </PlayerRoute>
            }
          />

          <Route
            path="/expenses"
            element={
              <PlayerRoute>
                <Expenses />
              </PlayerRoute>
            }
          />

          <Route
            path="/players"
            element={
              <PlayerRoute>
                <Players />
              </PlayerRoute>
            }
          />

          <Route
            path="/settings"
            element={
              <PlayerRoute>
                <Settings />
              </PlayerRoute>
            }
          />

          {/* Coach routes */}
          <Route
            path="/coach"
            element={
              <CoachRoute>
                <CoachDashboard />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/players"
            element={
              <CoachRoute>
                <CoachPlayers />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/sessions"
            element={
              <CoachRoute>
                <CoachSessions />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/progress"
            element={
              <CoachRoute>
                <CoachProgress />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/profile"
            element={
              <CoachRoute>
                <CoachProfile />
              </CoachRoute>
            }
          />
        </Route>

        {/* Admin route */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        {/* Development-only admin preview */}
        {process.env.NODE_ENV === 'development' && (
          <Route
            path="/admin-preview"
            element={<AdminDashboard />}
          />
        )}

        {/* Unknown routes */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App