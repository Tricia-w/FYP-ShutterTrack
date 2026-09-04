import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function maskEmail(value) {
  const email = String(value || '').trim()
  if (!email.includes('@')) return email

  const [name, domain] = email.split('@')
  const visible = name.length <= 2 ? name.charAt(0) : name.slice(0, 2)

  return `${visible}${'*'.repeat(
    Math.max(2, name.length - visible.length),
  )}@${domain}`
}

export default function VerifyReturningUser() {
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState(
    location.state?.email ||
      sessionStorage.getItem('shuttleReturningEmail') ||
      '',
  )
  const [message, setMessage] = useState(
    location.state?.emailSent
      ? 'Verification email sent. Open the email and click the verification link.'
      : '',
  )
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [completing, setCompleting] = useState(false)

  // Follow the same saved theme as Login/Register.
  const [isDark] = useState(
    localStorage.getItem('shuttleLoginTheme') === 'dark',
  )

  const finishVerification = useCallback(
    async currentUser => {
      if (!currentUser?.id || completing) {
        setVerifying(false)
        return
      }

      setCompleting(true)
      setVerifying(true)
      setError('')

      try {
        const { error: completeError } = await supabase.rpc(
          'complete_returning_user_reverification',
        )

        if (completeError) throw completeError

        const { data: appUser, error: appUserError } =
          await supabase
            .from('app_users')
            .select(`
              role,
              setup_completed,
              account_status,
              has_player_access,
              has_coach_access,
              removed_at
            `)
            .eq('user_id', currentUser.id)
            .maybeSingle()

        if (appUserError) throw appUserError

        if (!appUser) {
          throw new Error(
            'Your ShuttleTrack account record could not be found.',
          )
        }

        const status = String(
          appUser.account_status || 'active',
        ).toLowerCase()

        if (appUser.removed_at || status !== 'active') {
          await supabase.auth.signOut({ scope: 'local' })
          throw new Error(
            'This account is not currently available.',
          )
        }

        sessionStorage.removeItem(
          'shuttleReturningVerificationPending',
        )
        sessionStorage.removeItem('shuttleReturningEmail')

        const hasPlayer =
          appUser.has_player_access === true ||
          appUser.role === 'player'

        const hasCoach =
          appUser.has_coach_access === true ||
          appUser.role === 'coach'

        const savedMode =
          localStorage.getItem('activeRole')

        if (savedMode === 'coach' && hasCoach) {
          navigate('/coach', { replace: true })
          return
        }

        if (savedMode === 'player' && hasPlayer) {
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
          localStorage.setItem(
            'activeRole',
            'coach',
          )
          navigate('/coach', { replace: true })
          return
        }

        if (hasPlayer) {
          localStorage.setItem(
            'activeRole',
            'player',
          )
          navigate(
            appUser.setup_completed
              ? '/dashboard'
              : '/setup',
            { replace: true },
          )
          return
        }

        await supabase.auth.signOut({
          scope: 'local',
        })

        throw new Error(
          'This account does not have Player or Coach access.',
        )
      } catch (verifyError) {
        console.error(
          'Returning-user verification error:',
          verifyError,
        )

        setError(
          verifyError?.message ||
            'Unable to complete verification.',
        )
        setVerifying(false)
        setCompleting(false)
      }
    },
    [completing, navigate],
  )

  useEffect(() => {
    let mounted = true

    async function checkSession() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (sessionError) {
        setError(sessionError.message)
        setVerifying(false)
        return
      }

      const currentUser =
        session?.user || null

      if (currentUser?.email && !email) {
        setEmail(currentUser.email)
      }

      if (currentUser) {
        await finishVerification(currentUser)
      } else {
        setVerifying(false)
      }
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event !== 'SIGNED_IN') return

        const currentUser =
          session?.user || null

        if (!currentUser) return

        window.setTimeout(() => {
          finishVerification(currentUser)
        }, 0)
      },
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [email, finishVerification])

  async function resendVerification() {
    const cleanEmail =
      String(email || '').trim().toLowerCase()

    if (!cleanEmail) {
      setError(
        'Return to login and enter your email again.',
      )
      return
    }

    setSending(true)
    setError('')
    setMessage('')

    try {
      await supabase.auth.signOut({
        scope: 'local',
      })

      const { error: otpError } =
        await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            shouldCreateUser: false,
            emailRedirectTo:
              `${window.location.origin}/verify-returning-user`,
          },
        })

      if (otpError) throw otpError

      sessionStorage.setItem(
        'shuttleReturningEmail',
        cleanEmail,
      )
      sessionStorage.setItem(
        'shuttleReturningVerificationPending',
        'true',
      )

      setMessage(
        'A new verification email was sent. Open it and click the verification link.',
      )
    } catch (sendError) {
      console.error(
        'Resend returning verification error:',
        sendError,
      )

      setError(
        sendError?.message ||
          'Unable to send the verification email.',
      )
    } finally {
      setSending(false)
    }
  }

  async function backToLogin() {
    await supabase.auth.signOut({
      scope: 'local',
    })

    sessionStorage.removeItem(
      'shuttleReturningVerificationPending',
    )

    navigate('/login', {
      replace: true,
      state: { email },
    })
  }

  const primaryText =
    isDark ? '#FFFFFF' : '#172033'

  const secondaryText =
    isDark ? '#AAB2C0' : '#667085'

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: isDark
          ? 'radial-gradient(circle at 18% 20%, rgba(26,95,255,0.16), transparent 32%), radial-gradient(circle at 82% 80%, rgba(0,196,140,0.10), transparent 30%), #0D1117'
          : 'radial-gradient(circle at 18% 18%, rgba(26,95,255,0.13), transparent 30%), radial-gradient(circle at 82% 80%, rgba(52,211,153,0.10), transparent 28%), linear-gradient(135deg, #EEF4FF 0%, #F8FBFF 50%, #ECFBF6 100%)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          padding: 40,
          borderRadius: 24,
          background: isDark
            ? '#181E2B'
            : '#FFFFFF',
          border: isDark
            ? '1px solid #4A5568'
            : '1px solid #DDE5F2',
          boxShadow: isDark
            ? '0 26px 80px rgba(0,0,0,0.38)'
            : '0 26px 70px rgba(30,64,175,0.12)',
          boxSizing: 'border-box',
        }}
      >
        <h1
          style={{
            color: primaryText,
            marginTop: 0,
          }}
        >
          Verify your account
        </h1>

        <p
          style={{
            color: secondaryText,
            lineHeight: 1.7,
          }}
        >
          This player account has not been used for at least
          30 days. Verify your email before continuing to
          ShuttleTrack.
        </p>

        {email && (
          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 10,
              background: isDark
                ? '#1D2535'
                : '#F7F9FC',
              border: isDark
                ? '1px solid #2A3448'
                : '1px solid #DCE3EE',
              color: isDark
                ? '#D6DBE5'
                : '#5F6B7A',
            }}
          >
            Verification email: {maskEmail(email)}
          </div>
        )}

        {verifying && (
          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 10,
              background: isDark
                ? '#12223C'
                : '#EEF4FF',
              border: isDark
                ? '1px solid #244779'
                : '1px solid #CFE0FF',
              color: isDark
                ? '#8CB2FF'
                : '#1A5FFF',
            }}
          >
            Checking verification...
          </div>
        )}

        {message && !verifying && (
          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 10,
              background: isDark
                ? '#10251C'
                : '#ECFDF5',
              border: isDark
                ? '1px solid #1F4A39'
                : '1px solid #A7F3D0',
              color: isDark
                ? '#34D399'
                : '#047857',
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 10,
              background: isDark
                ? '#2D1B1B'
                : '#FEF2F2',
              border: isDark
                ? '1px solid #543131'
                : '1px solid #FECACA',
              color: isDark
                ? '#F87171'
                : '#DC2626',
            }}
          >
            {error}
          </div>
        )}

        {!verifying && (
          <>
            <button
              type="button"
              onClick={resendVerification}
              disabled={sending}
              style={{
                width: '100%',
                padding: 14,
                border: 'none',
                borderRadius: 12,
                background:
                  'linear-gradient(90deg, #1A5FFF, #3F7DFF)',
                color: '#FFFFFF',
                fontWeight: 800,
                cursor: sending
                  ? 'not-allowed'
                  : 'pointer',
                opacity: sending ? 0.7 : 1,
              }}
            >
              {sending
                ? 'Sending...'
                : 'Resend verification email'}
            </button>

            <button
              type="button"
              onClick={backToLogin}
              disabled={sending}
              style={{
                width: '100%',
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                border: isDark
                  ? '1px solid #2A3448'
                  : '1px solid #DCE3EE',
                background: isDark
                  ? '#1D2535'
                  : '#F7F9FC',
                color: isDark
                  ? '#D6DBE5'
                  : '#172033',
                fontWeight: 700,
                cursor: sending
                  ? 'not-allowed'
                  : 'pointer',
                opacity: sending ? 0.7 : 1,
              }}
            >
              Back to login
            </button>
          </>
        )}
      </div>
    </div>
  )
}
