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

  useEffect(() => {
    localStorage.removeItem('shuttleAddingRole')

    async function checkBrowserSession() {
      const sessionOnly =
        localStorage.getItem('shuttleSessionOnly') === 'true'

      const browserSessionActive =
        sessionStorage.getItem('shuttleBrowserSession') === 'true'

      // The user previously logged in without selecting Remember me.
      // sessionStorage disappears after the browser session is closed.
      if (sessionOnly && !browserSessionActive) {
        await supabase.auth.signOut()
        localStorage.removeItem('activeRole')
        localStorage.removeItem('shuttleSessionOnly')
      }
    }

    checkBrowserSession()
  }, [])

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

      // Never save the password.
      // Remember me keeps the Supabase session after the browser closes.
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
            'role, setup_completed, account_status, has_player_access, has_coach_access',
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

      if (
        appUser.account_status &&
        appUser.account_status !== 'active'
      ) {
        await supabase.auth.signOut()
        setError('This account is not active.')
        return
      }

      if (appUser.role === 'admin') {
        localStorage.setItem('activeRole', 'admin')
        navigate('/admin', { replace: true })
        return
      }

      const hasPlayer =
        appUser.has_player_access === true ||
        appUser.role === 'player'

      const hasCoach =
        appUser.has_coach_access === true ||
        appUser.role === 'coach'

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
    background: 'rgba(30,37,53,0.92)',
    border: '1.5px solid #2A3147',
    borderRadius: 12,
    fontSize: 14,
    color: '#FFFFFF',
    outline: 'none',
    boxSizing: 'border-box',
    transition:
      'border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 18% 20%, rgba(26,95,255,0.16), transparent 32%), radial-gradient(circle at 82% 80%, rgba(0,196,140,0.10), transparent 30%), #0D1117',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <div
        className="shuttletrack-login-card"
        style={{
          width: '100%',
          maxWidth: 520,
          padding: '44px 44px 38px',
          borderRadius: 24,
          background:
            'linear-gradient(180deg, rgba(24,30,43,0.98), rgba(20,25,36,0.98))',
          border: '1px solid rgba(74,85,104,0.55)',
          boxShadow:
            '0 26px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.015) inset',
          boxSizing: 'border-box',
        }}
      >
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
              width: 42,
              height: 42,
              background:
                'linear-gradient(135deg, #1A5FFF, #4C83FF)',
              borderRadius: 12,
              boxShadow: '0 10px 24px rgba(26,95,255,0.30)',
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
              color: '#FFFFFF',
            }}
          >
            ShuttleTrack
          </span>
        </div>

        <h1
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: '#FFFFFF',
            margin: '0 0 6px',
          }}
        >
          Welcome Back
        </h1>

        <p
          style={{
            fontSize: 13,
            color: '#8892A4',
            margin: '0 0 28px',
          }}
        >
          Enter your details to continue to ShuttleTrack.
        </p>

        {error && (
          <div
            style={{
              background: '#2D1B1B',
              color: '#F87171',
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
              background: '#10251C',
              color: '#34D399',
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
                color: '#8892A4',
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
                color: '#AAB2C0',
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
          <div style={{ flex: 1, height: 1, background: '#2A3147' }} />
          <span style={{ fontSize: 11, color: '#5F6B82' }}>or continue with</span>
          <div style={{ flex: 1, height: 1, background: '#2A3147' }} />
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
            background: '#1D2535',
            color: '#FFFFFF',
            border: '1.5px solid #2A3448',
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
            color: '#8892A4',
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
              color: '#34D399',
              cursor: 'pointer',
              fontWeight: 700,
              padding: 0,
            }}
          >
            Create account
          </button>
        </p>
      </div>

      <style>
        {`
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
              0 12px 26px rgba(26,95,255,0.28);
            transition:
              background 0.14s ease,
              transform 0.14s ease,
              box-shadow 0.14s ease;
          }

          .loginPressButton:hover:not(:disabled) {
            background:
              linear-gradient(90deg, #2468FF, #4A82FF);
            box-shadow:
              0 15px 30px rgba(26,95,255,0.34);
          }

          .loginPressButton:active:not(:disabled) {
            transform: translateY(1px);
            background:
              linear-gradient(180deg, #101A2B, #0C1524);
            box-shadow:
              0 14px 30px rgba(26,95,255,0.42),
              0 20px 36px rgba(26,95,255,0.28),
              0 0 0 1px rgba(76,131,255,0.14) inset;
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