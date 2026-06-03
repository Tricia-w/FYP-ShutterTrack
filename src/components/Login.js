import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const ADMIN_EMAILS = ['admin@demo.com', 'tricia@admin.com']

  function getRedirectPath(role, setupCompleted) {
    if (role === 'coach') return '/coach'
    if (role === 'admin') return '/admin'

    if (role === 'player' && !setupCompleted) {
      return '/setup'
    }

    return '/dashboard'
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) {
        setError('Invalid email or password.')
        setLoading(false)
        return
      }

      const user = data?.user

      if (!user?.id) {
        setError('Login failed. Please try again.')
        setLoading(false)
        return
      }

      const { data: appUser, error: appUserError } = await supabase
        .from('app_users')
        .select('role, setup_completed')
        .eq('user_id', user.id)
        .maybeSingle()

      if (appUserError) {
        setError(appUserError.message)
        setLoading(false)
        return
      }

      if (!appUser) {
        setError('Account data not found. Please register again or contact admin.')
        setLoading(false)
        return
      }

      let role = appUser.role

      if (ADMIN_EMAILS.includes(user.email)) {
        role = 'admin'
      }

      const redirectPath = getRedirectPath(role, appUser.setup_completed)

      setLoading(false)
      navigate(redirectPath, { replace: true })
    } catch (err) {
      setError(err.message || 'Something went wrong during login.')
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    setError('')
    setSuccess('')

    if (!email) {
      setError('Please enter your email first, then click Forgot password.')
      return
    }

    setForgotLoading(true)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
        setForgotLoading(false)
        return
      }

      setSuccess('Password reset link has been sent to your email.')
    } catch (err) {
      setError(err.message || 'Failed to send reset password email.')
    }

    setForgotLoading(false)
  }

  async function handleGoogle() {
    setError('Google login will be added after email login, signup, and setup are working.')
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0D1117',
      }}
    >
      <div
        style={{
          background: '#161B27',
          borderRadius: 20,
          padding: '40px 40px 36px',
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div
            style={{
              width: 38,
              height: 38,
              background: '#1A5FFF',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v9l5 3" />
            </svg>
          </div>

          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
            ShuttleTrack
          </span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
          Welcome Back
        </h1>

        <p style={{ fontSize: 13, color: '#8892A4', marginBottom: 28 }}>
          Login to continue to ShuttleTrack
        </p>

        {error && (
          <div
            style={{
              background: '#2D1B1B',
              color: '#F87171',
              fontSize: 13,
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: '#10251C',
              color: '#34D399',
              fontSize: 13,
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '14px 16px',
              background: '#1E2535',
              border: '1.5px solid #2A3147',
              borderRadius: 12,
              fontSize: 14,
              color: '#fff',
              outline: 'none',
              marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />

          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                paddingRight: 44,
                background: '#1E2535',
                border: '1.5px solid #2A3147',
                borderRadius: 12,
                fontSize: 14,
                color: '#fff',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#8892A4',
                padding: 0,
              }}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
              onClick={() => setRemember((prev) => !prev)}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  border: `2px solid ${remember ? '#1A5FFF' : '#3A4460'}`,
                  borderRadius: 5,
                  background: remember ? '#1A5FFF' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                }}
              >
                {remember && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M2 6l3 3 5-5"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              <span style={{ fontSize: 13, color: '#8892A4', userSelect: 'none' }}>
                Remember for 30 days
              </span>
            </div>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={forgotLoading}
              style={{
                fontSize: 13,
                color: '#1A5FFF',
                cursor: forgotLoading ? 'not-allowed' : 'pointer',
                fontWeight: 500,
                background: 'none',
                border: 'none',
                padding: 0,
                opacity: forgotLoading ? 0.7 : 1,
              }}
            >
              {forgotLoading ? 'Sending...' : 'Forgot password?'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: '#1A5FFF',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: 12,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 1, background: '#2A3147' }} />
          <span style={{ fontSize: 12, color: '#4A5568' }}>or</span>
          <div style={{ flex: 1, height: 1, background: '#2A3147' }} />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          style={{
            width: '100%',
            padding: '13px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: '#1E2535',
            color: '#fff',
            border: '1.5px solid #2A3147',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 20,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#252D40')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#1E2535')}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.5 5C9.7 39.8 16.4 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z" />
          </svg>
          Sign in with Google
        </button>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#8892A4', margin: 0 }}>
          New user?{' '}
          <span
            style={{ color: '#00C48C', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => navigate('/register')}
          >
            Create account
          </span>
        </p>
      </div>
    </div>
  )
}