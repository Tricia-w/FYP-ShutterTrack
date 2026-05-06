import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Login from './components/Login'
import Register from './components/Register'
import Setup from './Setup'
import Profile from './components/Profile'
import Performance from './components/Performance'
import Fitness from './components/Fitness'
import Expenses from './components/Expenses'
import Players from './components/Players'
import Settings from './components/Settings'
import AdminDashboard from './components/Admin'
import Coach from './components/Coach'

function LoadingScreen() {
  return (
    <div style={{ padding: 40, textAlign: 'center', color: '#8892A4' }}>
      Loading...
    </div>
  )
}

function getUserRole(user, profile) {
  return (
    profile?.role ||
    user?.role ||
    user?.user_metadata?.role ||
    user?.app_metadata?.role ||
    'player'
  )
}

// Redirects to login if not logged in
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/" replace />

  return children
}

// Redirects based on role if already logged in
function PublicRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />

  if (user) {
    const role = getUserRole(user, profile)

    if (role === 'coach') {
      return <Navigate to="/coach" replace />
    }

    if (role === 'admin') {
      return <Navigate to="/admin" replace />
    }

    return <Navigate to="/dashboard" replace />
  }

  return children
}

// Admin only
function AdminRoute({ children }) {
  const { user, profile, isAdmin, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/" replace />

  const role = getUserRole(user, profile)

  if (!isAdmin && role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// Coach only
function CoachRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/" replace />

  const role = getUserRole(user, profile)

  if (role !== 'coach') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public routes */}
        <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/setup" element={<Setup />} />

        {/* Protected routes inside layout */}
        <Route element={<PrivateRoute><Layout /></PrivateRoute>}>

          {/* Player pages */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/performance" element={<Performance />} />
          <Route path="/fitness" element={<Fitness />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/players" element={<Players />} />
          <Route path="/settings" element={<Settings />} />

          {/* Coach pages */}
          <Route
            path="/coach"
            element={
              <CoachRoute>
                <Coach page="dashboard" />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/players"
            element={
              <CoachRoute>
                <Coach page="players" />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/sessions"
            element={
              <CoachRoute>
                <Coach page="sessions" />
              </CoachRoute>
            }
          />

          <Route
            path="/coach/progress"
            element={
              <CoachRoute>
                <Coach page="progress" />
              </CoachRoute>
            }
          />

        </Route>

        {/* Admin only */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App