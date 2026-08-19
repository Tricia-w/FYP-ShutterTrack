import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  const [message, setMessage] = useState(
    'Completing Google authentication...',
  )

  useEffect(() => {
    let active = true

    async function handleGoogleCallback() {
      try {
        setMessage('Checking your Google account...')

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        const user = session?.user

        if (!user?.id) {
          throw new Error(
            'Google authentication session was not found.',
          )
        }

        setMessage('Loading your ShuttleTrack account...')

        const { data: existingAppUser, error: appUserError } =
          await supabase
            .from('app_users')
            .select(
              `
                user_id,
                email,
                full_name,
                username,
                role,
                setup_completed,
                account_status,
                removed_at,
                has_player_access,
                has_coach_access
              `,
            )
            .eq('user_id', user.id)
            .maybeSingle()

        if (appUserError) {
          throw appUserError
        }

        let appUser = existingAppUser

        if (!appUser) {
          setMessage('Creating your ShuttleTrack account...')

          const selectedRole =
            sessionStorage.getItem('googleSelectedRole') ||
            user.user_metadata?.role ||
            'player'

          const safeRole =
            selectedRole === 'coach' ? 'coach' : 'player'

          const fullName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'New User'

          const emailPrefix =
            user.email?.split('@')[0] || 'user'

          const cleanUsername = emailPrefix
            .replace(/[^a-zA-Z0-9_]/g, '')
            .slice(0, 20)

          const generatedUsername = `${
            cleanUsername || 'user'
          }_${user.id.slice(0, 6)}`

          const { data: createdAppUser, error: createError } =
            await supabase
              .from('app_users')
              .insert({
                user_id: user.id,
                email: user.email,
                full_name: fullName,
                username: generatedUsername,
                role: safeRole,
                setup_completed:
                  safeRole === 'coach',
                account_status: 'active',
                has_player_access:
                  safeRole === 'player',
                has_coach_access:
                  safeRole === 'coach',
              })
              .select(
                `
                  user_id,
                  email,
                  full_name,
                  username,
                  role,
                  setup_completed,
                  account_status,
                  removed_at,
                  has_player_access,
                  has_coach_access
                `,
              )
              .single()

          if (createError) {
            throw createError
          }

          appUser = createdAppUser
        }

        sessionStorage.removeItem('googleAuthMode')
        sessionStorage.removeItem('googleSelectedRole')

        if (!active) {
          return
        }

        const accountStatus = String(
          appUser.account_status || 'active',
        ).toLowerCase()

        if (appUser.removed_at) {
          const blockedMessage =
            'This ShuttleTrack account is no longer available.'

          sessionStorage.setItem(
            'shuttleLoginBlockedMessage',
            blockedMessage,
          )

          await supabase.auth.signOut()

          if (active) {
            navigate('/login', { replace: true })
          }

          return
        }

        if (accountStatus === 'disabled') {
          const blockedMessage =
            'Your ShuttleTrack account has been disabled by an administrator. You cannot access your account at this time.'

          sessionStorage.setItem(
            'shuttleLoginBlockedMessage',
            blockedMessage,
          )

          await supabase.auth.signOut()

          if (active) {
            navigate('/login', { replace: true })
          }

          return
        }

        if (accountStatus === 'suspended') {
          const blockedMessage =
            'Your ShuttleTrack account is currently suspended.'

          sessionStorage.setItem(
            'shuttleLoginBlockedMessage',
            blockedMessage,
          )

          await supabase.auth.signOut()

          if (active) {
            navigate('/login', { replace: true })
          }

          return
        }

        if (accountStatus !== 'active') {
          const blockedMessage =
            'Your ShuttleTrack account is not currently active. You cannot access your account at this time.'

          sessionStorage.setItem(
            'shuttleLoginBlockedMessage',
            blockedMessage,
          )

          await supabase.auth.signOut()

          if (active) {
            navigate('/login', { replace: true })
          }

          return
        }

        setMessage('Login successful. Redirecting...')

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

        const savedMode =
          localStorage.getItem('activeRole')

        if (
          savedMode === 'coach' &&
          hasCoach
        ) {
          localStorage.setItem('activeRole', 'coach')
          navigate('/coach', { replace: true })
          return
        }

        if (
          savedMode === 'player' &&
          hasPlayer
        ) {
          localStorage.setItem('activeRole', 'player')

          navigate(
            appUser.setup_completed === true
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
              : appUser.setup_completed === true
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
            appUser.setup_completed === true
              ? '/dashboard'
              : '/setup',
            { replace: true },
          )

          return
        }

        const noRoleMessage =
          'This account does not have Player or Coach access.'

        sessionStorage.setItem(
          'shuttleLoginBlockedMessage',
          noRoleMessage,
        )

        await supabase.auth.signOut()

        if (active) {
          navigate('/login', { replace: true })
        }
      } catch (error) {
        console.error('Google callback error:', error)

        sessionStorage.removeItem('googleAuthMode')
        sessionStorage.removeItem('googleSelectedRole')

        if (!active) {
          return
        }

        const errorMessage =
          error?.message ||
          'Google authentication could not be completed.'

        setMessage(errorMessage)

        setTimeout(() => {
          if (active) {
            navigate('/login', {
              replace: true,
              state: {
                error: errorMessage,
              },
            })
          }
        }, 2500)
      }
    }

    handleGoogleCallback()

    return () => {
      active = false
    }
  }, [navigate])

  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
        background:
          'radial-gradient(circle at 18% 20%, rgba(26,95,255,0.16), transparent 32%), radial-gradient(circle at 82% 80%, rgba(0,196,140,0.10), transparent 30%), #0D1117',
      }}
    >
      <div
        className="shuttletrack-callback-card"
        style={{
          width: '100%',
          maxWidth: 500,
          padding: '42px 42px 38px',
          borderRadius: 24,
          background:
            'linear-gradient(180deg, rgba(24,30,43,0.98), rgba(20,25,36,0.98))',
          border: '1px solid rgba(74,85,104,0.55)',
          boxShadow:
            '0 26px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.015) inset',
          textAlign: 'center',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
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
              boxShadow:
                '0 10px 24px rgba(26,95,255,0.30)',
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

        <div
          style={{
            width: 70,
            height: 70,
            margin: '0 auto 22px',
            borderRadius: '50%',
            background: 'rgba(26,95,255,0.08)',
            border: '1px solid rgba(76,131,255,0.20)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow:
              '0 14px 34px rgba(26,95,255,0.12), 0 0 0 8px rgba(26,95,255,0.035)',
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              border: '4px solid #2A3448',
              borderTopColor: '#1A5FFF',
              borderRadius: '50%',
              animation:
                'shuttletrackCallbackSpin 0.8s linear infinite',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <h1
          style={{
            margin: '0 0 9px',
            color: '#FFFFFF',
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.4px',
          }}
        >
          Google Authentication
        </h1>

        <p
          style={{
            maxWidth: 360,
            margin: '0 auto',
            color: '#8892A4',
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          {message}
        </p>

        <div
          style={{
            marginTop: 22,
            padding: '11px 14px',
            borderRadius: 12,
            background: 'rgba(30,37,53,0.72)',
            border: '1px solid #2A3448',
            color: '#6F7C90',
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          Please keep this page open while we finish signing you in.
        </div>

        <style>
          {`
            @keyframes shuttletrackCallbackSpin {
              to {
                transform: rotate(360deg);
              }
            }

            @media (max-width: 560px) {
              .shuttletrack-callback-card {
                padding: 30px 22px !important;
                border-radius: 20px !important;
              }
            }
          `}
        </style>
      </div>
    </div>
  )
}