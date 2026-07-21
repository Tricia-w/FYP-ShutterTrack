import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    setEmail('')
    setPassword('')

    const timer = setTimeout(() => {
      setEmail('')
      setPassword('')
    }, 300)

    return () => clearTimeout(timer)
  }, [])

  function getRedirectPath(role, setupCompleted) {
    if (role === 'coach') {
      return '/coach'
    }

    if (role === 'admin') {
      return '/admin'
    }

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
      const cleanEmail = email.trim().toLowerCase()

      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        })

      if (loginError) {
        setError('Invalid email or password.')
        return
      }

      const user = data?.user

      if (!user?.id) {
        setError('Login failed. Please try again.')
        return
      }

      const { data: appUser, error: appUserError } = await supabase
        .from('app_users')
        .select('role, setup_completed')
        .eq('user_id', user.id)
        .maybeSingle()

      if (appUserError) {
        setError(appUserError.message)
        return
      }

      if (!appUser) {
        setError(
          'Account data not found. Please register again or contact admin.',
        )
        return
      }

      const redirectPath = getRedirectPath(
        appUser.role,
        appUser.setup_completed,
      )

      navigate(redirectPath, { replace: true })
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message || 'Something went wrong during login.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    setError('')
    setSuccess('')

    if (!email.trim()) {
      setError(
        'Please enter your email first, then click Forgot password.',
      )
      return
    }

    setForgotLoading(true)

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          {
            redirectTo: `${window.location.origin}/reset-password`,
          },
        )

      if (resetError) {
        throw resetError
      }

      setSuccess(
        'Password reset link has been sent to your email.',
      )
    } catch (err) {
      console.error('Reset password error:', err)
      setError(
        err.message || 'Failed to send reset password email.',
      )
    } finally {
      setForgotLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setSuccess('')
    setGoogleLoading(true)

    try {
      const { error: googleError } =
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        })

      if (googleError) {
        throw googleError
      }
    } catch (err) {
      console.error('Google login error:', err)

      setError(
        err.message || 'Unable to continue with Google.',
      )

      setGoogleLoading(false)
    }
  }

  const pageStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0D1117',
    padding: '20px',
    boxSizing: 'border-box',
  }

  const cardStyle = {
    background: '#161B27',
    borderRadius: 20,
    padding: '40px 40px 36px',
    width: '100%',
    maxWidth: 480,
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
    boxSizing: 'border-box',
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    background: '#1E2535',
    border: '1.5px solid #2A3147',
    borderRadius: 12,
    fontSize: 14,
    color: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              background: '#1A5FFF',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.2"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v9l5 3" />
            </svg>
          </div>

          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#fff',
            }}
          >
            ShuttleTrack
          </span>
        </div>

        <h1
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: '#fff',
            marginTop: 0,
            marginBottom: 6,
          }}
        >
          Welcome Back
        </h1>

        <p
          style={{
            fontSize: 13,
            color: '#8892A4',
            marginTop: 0,
            marginBottom: 28,
          }}
        >
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
              lineHeight: 1.5,
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
              lineHeight: 1.5,
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleLogin} autoComplete="off">
          <input
            type="email"
            name="shuttletrack-login-email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
            required
            disabled={loading || googleLoading}
            style={{
              ...inputStyle,
              marginBottom: 12,
              opacity:
                loading || googleLoading ? 0.7 : 1,
            }}
          />

          <div
            style={{
              position: 'relative',
              marginBottom: 14,
            }}
          >
            <input
              type={showPassword ? 'text' : 'password'}
              name="shuttletrack-login-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
              required
              disabled={loading || googleLoading}
              style={{
                ...inputStyle,
                paddingRight: 44,
                opacity:
                  loading || googleLoading ? 0.7 : 1,
              }}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword((previous) => !previous)
              }
              aria-label={
                showPassword
                  ? 'Hide password'
                  : 'Show password'
              }
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
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {showPassword ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line
                    x1="1"
                    y1="1"
                    x2="23"
                    y2="23"
                  />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
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
              gap: 12,
              marginBottom: 20,
            }}
          >
            <button
              type="button"
              onClick={() =>
                setRemember((previous) => !previous)
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  border: `2px solid ${
                    remember ? '#1A5FFF' : '#3A4460'
                  }`,
                  borderRadius: 5,
                  background: remember
                    ? '#1A5FFF'
                    : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                  boxSizing: 'border-box',
                }}
              >
                {remember && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
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

              <span
                style={{
                  fontSize: 13,
                  color: '#8892A4',
                  userSelect: 'none',
                  textAlign: 'left',
                }}
              >
                Remember for 30 days
              </span>
            </button>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={
                forgotLoading || loading || googleLoading
              }
              style={{
                fontSize: 13,
                color: '#1A5FFF',
                cursor:
                  forgotLoading ||
                  loading ||
                  googleLoading
                    ? 'not-allowed'
                    : 'pointer',
                fontWeight: 500,
                background: 'none',
                border: 'none',
                padding: 0,
                opacity:
                  forgotLoading ||
                  loading ||
                  googleLoading
                    ? 0.7
                    : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {forgotLoading
                ? 'Sending...'
                : 'Forgot password?'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            style={{
              width: '100%',
              padding: 14,
              background: '#1A5FFF',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 700,
              cursor:
                loading || googleLoading
                  ? 'not-allowed'
                  : 'pointer',
              marginBottom: 12,
              opacity:
                loading || googleLoading ? 0.7 : 1,
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: '#2A3147',
            }}
          />

          <span
            style={{
              fontSize: 12,
              color: '#4A5568',
            }}
          >
            or
          </span>

          <div
            style={{
              flex: 1,
              height: 1,
              background: '#2A3147',
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
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
            cursor:
              googleLoading || loading
                ? 'not-allowed'
                : 'pointer',
            marginBottom: 20,
            transition: 'background 0.15s',
            opacity:
              googleLoading || loading ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!googleLoading && !loading) {
              e.currentTarget.style.background =
                '#252D40'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              '#1E2535'
          }}
        >
          {googleLoading ? (
            <div
              style={{
                width: 18,
                height: 18,
                border: '2px solid #59647A',
                borderTopColor: '#FFFFFF',
                borderRadius: '50%',
                animation:
                  'googleLoginSpin 0.8s linear infinite',
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 48 48"
            >
              <path
                fill="#FFC107"
                d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.1-2.7-.4-4z"
              />

              <path
                fill="#FF3D00"
                d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
              />

              <path
                fill="#4CAF50"
                d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.5 5C9.7 39.8 16.4 44 24 44z"
              />

              <path
                fill="#1976D2"
                d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.7 44 30.3 44 24c0-1.3-.1-2.7-.4-4z"
              />
            </svg>
          )}

          {googleLoading
            ? 'Connecting to Google...'
            : 'Continue with Google'}
        </button>

        <p
          style={{
            textAlign: 'center',
            fontSize: 13,
            color: '#8892A4',
            margin: 0,
          }}
        >
          New user?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            style={{
              color: '#00C48C',
              fontWeight: 600,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 13,
            }}
          >
            Create account
          </button>
        </p>

        <style>
          {`
            @keyframes googleLoginSpin {
              to {
                transform: rotate(360deg);
              }
            }

            @media (max-width: 560px) {
              .shuttletrack-login-card {
                padding: 30px 22px !important;
              }
            }
          `}
        </style>
      </div>
    </div>
  )
}
