import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function getFriendlyLoginError(error) {
  const code = String(error?.code || '').toLowerCase()
  const message = String(error?.message || '').toLowerCase()

  if (
    code === 'email_not_confirmed' ||
    message.includes('email not confirmed')
  ) {
    return 'Verify your email before logging in.'
  }

  if (
    code === 'invalid_credentials' ||
    message.includes('invalid login credentials')
  ) {
    return 'The email or password is incorrect.'
  }

  if (
    message.includes('rate limit') ||
    message.includes('too many requests')
  ) {
    return 'Too many login attempts. Please wait before trying again.'
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network')
  ) {
    return 'Unable to connect to the server. Check your internet connection.'
  }

  return 'Unable to log in. Please try again.'
}

const RETURNING_REVERIFY_DAYS = 30

function needsReturningReverification(lastSeenAt) {
  if (!lastSeenAt) return false

  const lastSeenMs = new Date(lastSeenAt).getTime()
  if (!Number.isFinite(lastSeenMs)) return false

  const inactiveMs = Date.now() - lastSeenMs
  const thresholdMs =
    RETURNING_REVERIFY_DAYS * 24 * 60 * 60 * 1000

  return inactiveMs >= thresholdMs
}

async function sendReturningVerificationEmail(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo:
        `${window.location.origin}/verify-returning-user`,
    },
  })

  if (error) throw error
}

function EyeIcon({ visible }) {
  if (visible) {
    return (
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
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    )
  }

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M2 12 C4.5 7.5 7.8 5 12 5 C16.2 5 19.5 7.5 22 12 C19.5 16.5 16.2 19 12 19 C7.8 19 4.5 16.5 2 12 Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState(
    location.state?.email ||
      localStorage.getItem('shuttleRememberedEmail') ||
      '',
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(
    localStorage.getItem('shuttleRememberMe') === 'true',
  )

  const [isDark, setIsDark] = useState(
    localStorage.getItem('shuttleLoginTheme') === 'dark',
  )

  useEffect(() => {
    localStorage.setItem(
      'shuttleLoginTheme',
      isDark ? 'dark' : 'light',
    )
  }, [isDark])

  useEffect(() => {
    localStorage.removeItem('shuttleAddingRole')

    const blockedMessage =
      sessionStorage.getItem('shuttleLoginBlockedMessage')

    if (blockedMessage) {
      setError(blockedMessage)
      sessionStorage.removeItem('shuttleLoginBlockedMessage')
    }

    async function checkBrowserSession() {
      const sessionOnly =
        localStorage.getItem('shuttleSessionOnly') === 'true'

      const browserSessionActive =
        sessionStorage.getItem('shuttleBrowserSession') === 'true'

      if (sessionOnly && !browserSessionActive) {
        await supabase.auth.signOut()
        localStorage.removeItem('activeRole')
        localStorage.removeItem('shuttleSessionOnly')
      }
    }

    checkBrowserSession()
  }, [])

  async function blockLoginWithMessage(message) {
    sessionStorage.setItem('shuttleLoginBlockedMessage', message)
    localStorage.removeItem('activeRole')

    try {
      await supabase.auth.signOut()
    } finally {
      setError(message)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()

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

      if (loginError) throw loginError

      const user = data?.user

      if (!user?.id) {
        throw new Error('Supabase did not return the user.')
      }

      if (!user.email_confirmed_at) {
        await supabase.auth.signOut()
        setError('Verify your email before logging in.')
        return
      }

      if (rememberMe) {
        localStorage.setItem('shuttleRememberMe', 'true')
        localStorage.setItem('shuttleRememberedEmail', cleanEmail)
        localStorage.removeItem('shuttleSessionOnly')
        sessionStorage.removeItem('shuttleBrowserSession')
      } else {
        localStorage.setItem('shuttleRememberMe', 'false')
        localStorage.removeItem('shuttleRememberedEmail')
        localStorage.setItem('shuttleSessionOnly', 'true')
        sessionStorage.setItem('shuttleBrowserSession', 'true')
      }

      const { data: appUser, error: appUserError } =
        await supabase
          .from('app_users')
          .select(
            'role, setup_completed, account_status, has_player_access, has_coach_access, removed_at, last_seen_at',
          )
          .eq('user_id', user.id)
          .maybeSingle()

      if (appUserError) throw appUserError

      if (!appUser) {
        await supabase.auth.signOut()
        setError(
          'Your Auth account exists, but its ShuttleTrack account record is missing.',
        )
        return
      }

      const accountStatus = String(
        appUser.account_status || 'active',
      ).toLowerCase()

      if (appUser.removed_at) {
        await blockLoginWithMessage(
          'This ShuttleTrack account is no longer available.',
        )
        return
      }

      if (accountStatus === 'disabled') {
        await blockLoginWithMessage(
          'Your ShuttleTrack account has been disabled by an administrator. You cannot access your account at this time.',
        )
        return
      }

      if (accountStatus === 'suspended') {
        await blockLoginWithMessage(
          'Your ShuttleTrack account is currently suspended.',
        )
        return
      }

      if (accountStatus !== 'active') {
        await blockLoginWithMessage(
          'Your ShuttleTrack account is not currently active. You cannot access your account at this time.',
        )
        return
      }

      const hasPlayer =
        appUser.has_player_access === true ||
        appUser.role === 'player'

      const hasCoach =
        appUser.has_coach_access === true ||
        appUser.role === 'coach'

      if (
        hasPlayer &&
        needsReturningReverification(appUser.last_seen_at)
      ) {
        sessionStorage.setItem(
          'shuttleReturningEmail',
          cleanEmail,
        )
        sessionStorage.setItem(
          'shuttleReturningVerificationPending',
          'true',
        )

        await supabase.auth.signOut({
          scope: 'local',
        })

        await sendReturningVerificationEmail(cleanEmail)

        navigate('/verify-returning-user', {
          replace: true,
          state: {
            email: cleanEmail,
            emailSent: true,
          },
        })
        return
      }

      if (appUser.role === 'admin') {
        localStorage.setItem('activeRole', 'admin')
        navigate('/admin', { replace: true })
        return
      }

      localStorage.removeItem('shuttleAddingRole')

      const savedMode =
        localStorage.getItem('activeRole')

      if (
        savedMode === 'coach' &&
        hasCoach
      ) {
        navigate('/coach', { replace: true })
        return
      }

      if (
        savedMode === 'player' &&
        hasPlayer
      ) {
        navigate(
          appUser.setup_completed
            ? '/dashboard'
            : '/setup',
          { replace: true },
        )
        return
      }

      if (hasPlayer && hasCoach) {
        const primaryRole =
          appUser.role === 'coach'
            ? 'coach'
            : 'player'

        localStorage.setItem(
          'activeRole',
          primaryRole,
        )

        navigate(
          primaryRole === 'coach'
            ? '/coach'
            : appUser.setup_completed
              ? '/dashboard'
              : '/setup',
          { replace: true },
        )
        return
      }

      if (hasCoach) {
        localStorage.setItem('activeRole', 'coach')
        navigate('/coach', { replace: true })
        return
      }

      if (hasPlayer) {
        localStorage.setItem('activeRole', 'player')
        navigate(
          appUser.setup_completed
            ? '/dashboard'
            : '/setup',
          { replace: true },
        )
        return
      }

      await supabase.auth.signOut()
      setError(
        'This account does not have Player or Coach access.',
      )
    } catch (err) {
      console.error('Login error:', err)
      setError(getFriendlyLoginError(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    setError('')
    setSuccess('')

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      setError(
        'Enter your email first, then press Forgot password.',
      )
      return
    }

    setForgotLoading(true)

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo:
              `${window.location.origin}/reset-password`,
          },
        )

      if (resetError) throw resetError

      setSuccess(
        'If an account exists with this email, a reset link has been sent. Check Inbox, Spam, Junk, Promotions, and Trash.',
      )
    } catch (err) {
      console.error('Forgot-password error:', err)

      const message =
        String(err?.message || '').toLowerCase()

      if (message.includes('rate limit')) {
        setError(
          'Too many reset emails were requested. Please wait before trying again.',
        )
      } else {
        setSuccess(
          'If an account exists with this email, a reset link has been sent.',
        )
      }
    } finally {
      setForgotLoading(false)
    }
  }

  async function handleGoogle() {
    setError('')
    setSuccess('')
    setGoogleLoading(true)

    try {
      if (rememberMe) {
        localStorage.setItem('shuttleRememberMe', 'true')
        localStorage.removeItem('shuttleSessionOnly')
        sessionStorage.removeItem('shuttleBrowserSession')
      } else {
        localStorage.setItem('shuttleRememberMe', 'false')
        localStorage.removeItem('shuttleRememberedEmail')
        localStorage.setItem('shuttleSessionOnly', 'true')
        sessionStorage.setItem('shuttleBrowserSession', 'true')
      }

      const { error: googleError } =
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo:
              `${window.location.origin}/auth/callback`,
          },
        })

      if (googleError) throw googleError
    } catch (err) {
      console.error('Google login error:', err)
      setError('Unable to continue with Google.')
      setGoogleLoading(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    background: isDark ? '#1E2535' : '#F7F9FC',
    border: isDark
      ? '1.5px solid #2A3147'
      : '1.5px solid #DCE3EE',
    borderRadius: 12,
    fontSize: 14,
    color: isDark ? '#FFFFFF' : '#172033',
    outline: 'none',
    boxSizing: 'border-box',
    transition:
      'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
  }

  return (
    <div
      className={isDark ? 'login-theme-dark' : 'login-theme-light'}
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: isDark
          ? 'radial-gradient(circle at 18% 20%, rgba(26,95,255,0.16), transparent 32%), radial-gradient(circle at 82% 80%, rgba(0,196,140,0.10), transparent 30%), #0D1117'
          : 'radial-gradient(circle at 18% 18%, rgba(26,95,255,0.13), transparent 30%), radial-gradient(circle at 82% 80%, rgba(52,211,153,0.10), transparent 28%), linear-gradient(135deg, #EEF4FF 0%, #F8FBFF 50%, #ECFBF6 100%)',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <div
        className="shuttletrack-login-shell"
        style={{
          width: '100%',
          maxWidth: 1180,
          display: 'grid',
          gridTemplateColumns: '1fr 520px',
          alignItems: 'center',
          gap: 72,
        }}
      >
        <section
          className="shuttletrack-login-intro"
          style={{
            padding: '20px 10px 20px 24px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              padding: '7px 12px',
              borderRadius: 999,
              background: isDark
                ? 'rgba(26,95,255,0.14)'
                : 'rgba(26,95,255,0.08)',
              border: isDark
                ? '1px solid rgba(76,131,255,0.24)'
                : '1px solid rgba(26,95,255,0.12)',
              color: '#1A5FFF',
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 18,
            }}
          >
            BADMINTON PERFORMANCE MANAGEMENT
          </div>

          <h2
            style={{
              margin: '0 0 16px',
              maxWidth: 560,
              fontSize: 46,
              lineHeight: 1.08,
              letterSpacing: '-0.035em',
              color: isDark ? '#FFFFFF' : '#172033',
              fontWeight: 800,
            }}
          >
            Train smarter.
            <br />
            Track every step.
            <br />
            Improve together.
          </h2>

          <p
            style={{
              margin: '0 0 28px',
              maxWidth: 560,
              fontSize: 15,
              lineHeight: 1.75,
              color: isDark ? '#9AA5B8' : '#667085',
            }}
          >
            ShuttleTrack helps badminton players and coaches manage
            training, monitor fitness and performance progress, record
            match results, and stay connected through one central system.
          </p>

        </section>

      <div
        className="shuttletrack-login-card"
        style={{
          width: '100%',
          maxWidth: 520,
          padding: '44px 44px 38px',
          borderRadius: 24,
          background: isDark
            ? 'linear-gradient(180deg, rgba(24,30,43,0.98), rgba(20,25,36,0.98))'
            : '#FFFFFF',
          border: isDark
            ? '1px solid rgba(74,85,104,0.55)'
            : '1px solid #DDE5F2',
          boxShadow: isDark
            ? '0 26px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.015) inset'
            : '0 26px 70px rgba(30,64,175,0.12), 0 0 0 1px rgba(255,255,255,0.7) inset',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
          <div
            style={{
              width: 42,
              height: 42,
              background:
                'linear-gradient(135deg, #1A5FFF, #4C83FF)',
              borderRadius: 12,
              boxShadow: '0 10px 24px rgba(26,95,255,0.24)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
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
              <circle cx="10" cy="10" r="2" fill="white" />
            </svg>
          </div>

          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: isDark ? '#FFFFFF' : '#172033',
            }}
          >
            ShuttleTrack
          </span>
          </div>

          <button
            type="button"
            onClick={() => setIsDark((previous) => !previous)}
            aria-label={
              isDark ? 'Switch to light mode' : 'Switch to dark mode'
            }
            title={
              isDark ? 'Switch to light mode' : 'Switch to dark mode'
            }
            style={{
              width: 46,
              height: 26,
              borderRadius: 999,
              border: isDark
                ? '1px solid #3A455E'
                : '1px solid #D6DEEA',
              background: isDark ? '#263047' : '#EEF2F7',
              padding: 3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isDark ? 'flex-end' : 'flex-start',
              transition:
                'background 0.2s ease, border-color 0.2s ease',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: isDark ? '#0D1117' : '#FFFFFF',
                boxShadow: '0 2px 7px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                lineHeight: 1,
                transition: 'all 0.2s ease',
              }}
            >
              {isDark ? '🌙' : '☀️'}
            </span>
          </button>
        </div>

        <h1
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: isDark ? '#FFFFFF' : '#172033',
            margin: '0 0 6px',
          }}
        >
          Welcome Back
        </h1>

        <p
          style={{
            fontSize: 13,
            color: isDark ? '#8892A4' : '#667085',
            margin: '0 0 28px',
          }}
        >
          Enter your details to continue to ShuttleTrack.
        </p>


        {error && (
          <div
            style={{
              background: isDark ? '#2D1B1B' : '#FEF2F2',
              color: isDark ? '#F87171' : '#DC2626',
              border: isDark
                ? '1px solid #543131'
                : '1px solid #FECACA',
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: isDark ? '#10251C' : '#ECFDF5',
              color: isDark ? '#34D399' : '#047857',
              border: isDark
                ? '1px solid #1F4A39'
                : '1px solid #A7F3D0',
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 13,
              lineHeight: 1.6,
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
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            disabled={loading || googleLoading}
            style={{
              ...inputStyle,
              marginBottom: 12,
              opacity: loading || googleLoading ? 0.7 : 1,
            }}
          />

          <div style={{ position: 'relative', marginBottom: 14 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              disabled={loading || googleLoading}
              style={{
                ...inputStyle,
                paddingRight: 44,
                opacity: loading || googleLoading ? 0.7 : 1,
              }}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword((previous) => !previous)
              }
              aria-label={
                showPassword ? 'Hide password' : 'Show password'
              }
              disabled={loading || googleLoading}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: isDark ? '#8892A4' : '#7A8699',
                cursor:
                  loading || googleLoading
                    ? 'not-allowed'
                    : 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <EyeIcon visible={showPassword} />
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              marginBottom: 20,
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: isDark ? '#AAB2C0' : '#5F6B7A',
                fontSize: 13,
                cursor:
                  loading || googleLoading
                    ? 'not-allowed'
                    : 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) =>
                  setRememberMe(event.target.checked)
                }
                disabled={loading || googleLoading}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: '#1A5FFF',
                  cursor:
                    loading || googleLoading
                      ? 'not-allowed'
                      : 'pointer',
                }}
              />
              Remember me
            </label>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={forgotLoading || loading || googleLoading}
              style={{
                fontSize: 13,
                color: '#1A5FFF',
                cursor:
                  forgotLoading || loading || googleLoading
                    ? 'not-allowed'
                    : 'pointer',
                background: 'none',
                border: 'none',
                padding: 0,
                opacity:
                  forgotLoading || loading || googleLoading
                    ? 0.7
                    : 1,
              }}
            >
              {forgotLoading ? 'Sending...' : 'Forgot password?'}
            </button>
          </div>

          <button
            type="submit"
            className="loginPressButton"
            disabled={loading || googleLoading}
            style={{
              opacity: loading || googleLoading ? 0.7 : 1,
              cursor:
                loading || googleLoading
                  ? 'not-allowed'
                  : 'pointer',
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
            margin: '14px 0 12px',
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: isDark ? '#2A3147' : '#E2E8F0',
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: isDark ? '#5F6B82' : '#98A2B3',
            }}
          >
            or continue with
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: isDark ? '#2A3147' : '#E2E8F0',
            }}
          />
        </div>

        <button
          type="button"
          className="googleLoginButton"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          style={{
            width: '100%',
            padding: '13px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            background: isDark ? '#1D2535' : '#FFFFFF',
            color: isDark ? '#FFFFFF' : '#172033',
            border: isDark
              ? '1.5px solid #2A3448'
              : '1.5px solid #DCE3EE',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor:
              googleLoading || loading
                ? 'not-allowed'
                : 'pointer',
            opacity: googleLoading || loading ? 0.7 : 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
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

          {googleLoading
            ? 'Connecting to Google...'
            : 'Continue with Google'}
        </button>

        <p
          style={{
            color: isDark ? '#8892A4' : '#667085',
            textAlign: 'center',
            marginTop: 20,
            marginBottom: 0,
            fontSize: 13,
          }}
        >
          New user?{' '}
          <button
            type="button"
            onClick={() => navigate('/register')}
            style={{
              background: 'none',
              border: 'none',
              color: '#10B981',
              cursor: 'pointer',
              fontWeight: 700,
              padding: 0,
            }}
          >
            Create account
          </button>
        </p>
      </div>
      </div>

      <style>
        {`
          .login-theme-light .shuttletrack-login-card input::placeholder {
            color: #98A2B3;
          }

          .login-theme-dark .shuttletrack-login-card input::placeholder {
            color: #6F7B90;
          }

          .shuttletrack-login-card input:focus {
            border-color: #1A5FFF !important;
            box-shadow: 0 0 0 4px rgba(26,95,255,0.10);
          }

          .login-theme-light .shuttletrack-login-card input:focus {
            background: #FFFFFF !important;
          }

          .login-theme-dark .shuttletrack-login-card input:focus {
            background: #20293B !important;
          }

          .loginPressButton {
            width: 100%;
            padding: 14px;
            border: none;
            border-radius: 12px;
            background:
              linear-gradient(90deg, #1A5FFF, #3F7DFF);
            color: #ffffff;
            font-size: 15px;
            font-weight: 700;
            box-shadow:
              0 12px 26px rgba(26,95,255,0.22);
            transition:
              background 0.14s ease,
              transform 0.14s ease,
              box-shadow 0.14s ease;
          }

          .loginPressButton:hover:not(:disabled) {
            background:
              linear-gradient(90deg, #2468FF, #4A82FF);
            box-shadow:
              0 15px 30px rgba(26,95,255,0.28);
          }

          .loginPressButton:active:not(:disabled) {
            transform: translateY(1px);
            background:
              linear-gradient(90deg, #1557EA, #326FEF);
            box-shadow:
              0 8px 18px rgba(26,95,255,0.24);
          }

          .googleLoginButton {
            transition:
              background 0.14s ease,
              border-color 0.14s ease,
              transform 0.14s ease;
          }

          .login-theme-light .googleLoginButton:hover:not(:disabled) {
            background: #F8FAFC !important;
            border-color: #C7D2E3 !important;
          }

          .login-theme-dark .googleLoginButton:hover:not(:disabled) {
            background: #222C3F !important;
            border-color: #39455E !important;
          }

          .googleLoginButton:active:not(:disabled) {
            transform: translateY(1px);
          }

          @media (max-width: 980px) {
            .shuttletrack-login-shell {
              grid-template-columns: 1fr !important;
              max-width: 620px !important;
              gap: 28px !important;
            }

            .shuttletrack-login-intro {
              padding: 10px 6px 0 !important;
              text-align: center;
            }

            .shuttletrack-login-intro h2,
            .shuttletrack-login-intro p {
              margin-left: auto !important;
              margin-right: auto !important;
            }

          }

          @media (max-width: 640px) {
            .shuttletrack-login-intro h2 {
              font-size: 34px !important;
            }

          }

          @media (max-width: 560px) {
            .shuttletrack-login-card {
              padding: 32px 22px !important;
              border-radius: 20px !important;
            }
          }
        `}
      </style>
    </div>
  )
}