import React from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'

import { useAuth } from './context/AuthContext'
import Layout from './components/Layout/Layout'

import Dashboard from './components/Player/Dashboard'
import Profile from './components/Player/Profile'
import Performance from './components/Player/Performance'
import Fitness from './components/Player/Fitness'
import Expenses from './components/Player/Expenses'
import Players from './components/Player/Players'
import Clubs from './components/Player/Clubs'
import Settings from './components/Player/Settings'

import Login from './components/Welcome/Login'
import Register from './components/Welcome/Register'
import ResetPassword from './components/Welcome/ResetPassword'
import EmailVerified from './components/Welcome/EmailVerified'

import AuthCallback from './components/Welcome/AuthCallback'
import AdminDashboard from './components/Admin/Admin'

import Setup from './components/Welcome/Setup'

import CoachDashboard from './components/Coach/CoachDashboard'
import CoachPlayers from './components/Coach/CoachPlayers'
import CoachSessions from './components/Coach/CoachSessions'
import CoachProgress from './components/Coach/CoachProgress'
import CoachProfile from './components/Coach/CoachProfile'
import CoachSettings from './components/Coach/CoachSettings'

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
  if (isAdmin) return 'admin'
  return profile?.role || 'player'
}

function hasPlayerAccess(profile, isAdmin) {
  if (isAdmin) return false

  if (typeof profile?.has_player_access === 'boolean') {
    return profile.has_player_access
  }

  return profile?.role === 'player'
}

function hasCoachAccess(profile, isAdmin) {
  if (isAdmin) return false

  if (typeof profile?.has_coach_access === 'boolean') {
    return profile.has_coach_access
  }

  return profile?.role === 'coach'
}

function getSetupCompleted(profile) {
  return profile?.setup_completed === true
}

function getUserRedirectPath(profile, isAdmin) {
  const role = getUserRole(profile, isAdmin)

  if (role === 'admin') return '/admin'

  if (
    role === 'coach' &&
    hasCoachAccess(profile, isAdmin)
  ) {
    return '/coach'
  }

  if (
    hasPlayerAccess(profile, isAdmin) &&
    !getSetupCompleted(profile)
  ) {
    return '/setup'
  }

  if (hasPlayerAccess(profile, isAdmin)) {
    return '/dashboard'
  }

  if (hasCoachAccess(profile, isAdmin)) {
    return '/coach'
  }

  return '/login'
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}

function PublicRoute({ children }) {
  const {
    user,
    profile,
    loading,
    isAdmin,
  } = useAuth()

  const location = useLocation()

  if (loading) return <LoadingScreen />

  const addingRole =
    sessionStorage.getItem(
      'shuttleAddingRole',
    ) === '1'

  if (
    user &&
    !(
      location.pathname === '/register' &&
      addingRole
    )
  ) {
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
  const {
    user,
    profile,
    isAdmin,
    loading,
  } = useAuth()

  if (loading) return <LoadingScreen />

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (getUserRole(profile, isAdmin) !== 'admin') {
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
  const {
    user,
    profile,
    loading,
    isAdmin,
  } = useAuth()

  if (loading) return <LoadingScreen />

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />
  }

  if (!hasCoachAccess(profile, isAdmin)) {
    return (
      <Navigate
        to={getUserRedirectPath(profile, isAdmin)}
        replace
      />
    )
  }

  return children
}

function PlayerRoute({ children }) {
  const {
    user,
    profile,
    loading,
    isAdmin,
  } = useAuth()

  if (loading) return <LoadingScreen />

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />
  }

  if (!hasPlayerAccess(profile, isAdmin)) {
    return (
      <Navigate
        to={getUserRedirectPath(profile, isAdmin)}
        replace
      />
    )
  }

  if (!getSetupCompleted(profile)) {
    return <Navigate to="/setup" replace />
  }

  return children
}

function PlayerSetupRoute({ children }) {
  const {
    user,
    profile,
    loading,
    isAdmin,
  } = useAuth()

  const location = useLocation()

  if (loading) return <LoadingScreen />

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />
  }

  if (!hasPlayerAccess(profile, isAdmin)) {
    return (
      <Navigate
        to={getUserRedirectPath(profile, isAdmin)}
        replace
      />
    )
  }

  const searchParams =
    new URLSearchParams(location.search)

  const isRedoSetup =
    searchParams.get('redo') === '1'

  const isAddingRole =
    searchParams.get('addRole') === '1'

  if (
    getSetupCompleted(profile) &&
    !isRedoSetup &&
    !isAddingRole
  ) {
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

        <Route
          path="/email-verified"
          element={<EmailVerified />}
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
            path="/clubs"
            element={
              <PlayerRoute>
                <Clubs />
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
            path="/coach/clubs"
            element={
              <CoachRoute>
                <Clubs />
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

          <Route
            path="/coach/settings"
            element={
              <CoachRoute>
                <CoachSettings />
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