import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
              'user_id, email, full_name, username, role, setup_completed',
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
              })
              .select(
                'user_id, email, full_name, username, role, setup_completed',
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

        setMessage('Login successful. Redirecting...')

        if (appUser.role === 'admin') {
          navigate('/admin', { replace: true })
          return
        }

        if (appUser.role === 'coach') {
          navigate('/coach', { replace: true })
          return
        }

        if (
          appUser.role === 'player' &&
          appUser.setup_completed !== true
        ) {
          navigate('/setup', { replace: true })
          return
        }

        navigate('/dashboard', { replace: true })
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0D1117',
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          padding: '36px 30px',
          background: '#161B27',
          borderRadius: 20,
          boxShadow: '0 8px 40px rgba(0, 0, 0, 0.4)',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            margin: '0 auto 20px',
            border: '4px solid #2A3147',
            borderTopColor: '#1A5FFF',
            borderRadius: '50%',
            animation:
              'shuttletrackCallbackSpin 0.8s linear infinite',
            boxSizing: 'border-box',
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              background: '#1A5FFF',
              borderRadius: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.2"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v9l5 3" />
            </svg>
          </div>

          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: '#FFFFFF',
            }}
          >
            ShuttleTrack
          </span>
        </div>

        <h1
          style={{
            margin: '0 0 10px',
            color: '#FFFFFF',
            fontSize: 22,
            fontWeight: 800,
          }}
        >
          Google Authentication
        </h1>

        <p
          style={{
            margin: 0,
            color: '#8892A4',
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>

        <style>
          {`
            @keyframes shuttletrackCallbackSpin {
              to {
                transform: rotate(360deg);
              }
            }
          `}
        </style>
      </div>
    </div>
  )
}