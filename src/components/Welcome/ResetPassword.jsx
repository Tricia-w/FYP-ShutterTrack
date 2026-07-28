import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function getPasswordChecks(password) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  }
}

function getPasswordError(password) {
  const checks = getPasswordChecks(password)

  if (!password) return 'Password is required.'

  if (
    !checks.length ||
    !checks.uppercase ||
    !checks.lowercase ||
    !checks.number ||
    !checks.symbol
  ) {
    return 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'
  }

  return ''
}

function getFriendlyUpdateError(error) {
  const message = String(error?.message || '').toLowerCase()

  if (
    message.includes('same password') ||
    message.includes('different from the old password')
  ) {
    return 'Your new password must be different from your previous password.'
  }

  if (
    message.includes('session') ||
    message.includes('expired') ||
    message.includes('invalid')
  ) {
    return 'This password-reset link is invalid or expired. Please request a new one.'
  }

  return 'Unable to update your password. Please request a new reset link and try again.'
}

function PasswordChecklist({ password }) {
  const checks = getPasswordChecks(password)

  const itemStyle = (valid) => ({
    fontSize: 12,
    color: valid ? '#34D399' : '#8892A4',
    margin: '0 0 5px',
  })

  return (
    <div style={{ marginTop: -4, marginBottom: 16 }}>
      <p style={itemStyle(checks.length)}>
        {checks.length ? '✓' : '•'} At least 8 characters
      </p>
      <p style={itemStyle(checks.uppercase)}>
        {checks.uppercase ? '✓' : '•'} One uppercase letter
      </p>
      <p style={itemStyle(checks.lowercase)}>
        {checks.lowercase ? '✓' : '•'} One lowercase letter
      </p>
      <p style={itemStyle(checks.number)}>
        {checks.number ? '✓' : '•'} One number
      </p>
      <p style={itemStyle(checks.symbol)}>
        {checks.symbol ? '✓' : '•'} One symbol
      </p>
    </div>
  )
}

function EyeIcon({ visible }) {
  return visible ? (
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
  ) : (
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

export default function ResetPassword() {
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingLink, setCheckingLink] = useState(true)
  const [validRecovery, setValidRecovery] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    let active = true

    async function checkRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!active) return

      if (session) {
        setValidRecovery(true)
      }

      setCheckingLink(false)
    }

    checkRecoverySession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return

        if (
          event === 'PASSWORD_RECOVERY' &&
          session
        ) {
          setValidRecovery(true)
          setCheckingLink(false)
        }
      },
    )

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleResetPassword(event) {
    event.preventDefault()

    setError('')
    setSuccess('')

    const passwordError = getPasswordError(password)

    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        })

      if (updateError) {
        throw updateError
      }

      setSuccess(
        'Password updated successfully. You may now log in with your new password.',
      )

      await supabase.auth.signOut()

      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 1800)
    } catch (err) {
      console.error('Reset-password error:', err)
      setError(getFriendlyUpdateError(err))
    } finally {
      setLoading(false)
    }
  }

  const page = (content) => (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 18% 20%, rgba(26,95,255,0.16), transparent 32%), radial-gradient(circle at 82% 80%, rgba(0,196,140,0.10), transparent 30%), #0D1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      <div
        className="reset-password-card"
        style={{
          width: '100%',
          maxWidth: 500,
          background:
            'linear-gradient(180deg, rgba(24,30,43,0.98), rgba(20,25,36,0.98))',
          border: '1px solid rgba(74,85,104,0.55)',
          borderRadius: 24,
          padding: '42px 42px 38px',
          boxShadow:
            '0 26px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.015) inset',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 1,
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

        {content}
      </div>

      <style>
        {`
          @media (max-width: 560px) {
            .reset-password-card {
              padding: 30px 22px !important;
            }
          }
        `}
      </style>
    </div>
  )

  if (checkingLink) {
    return page(
      <>
        <h1
          style={{
            color: '#FFFFFF',
            fontSize: 28,
            fontWeight: 800,
            margin: '0 0 8px',
          }}
        >
          Checking Reset Link
        </h1>
        <p
          style={{
            color: '#8892A4',
            fontSize: 13,
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          Please wait while ShuttleTrack verifies the
          password-reset link.
        </p>
      </>,
    )
  }

  if (!validRecovery) {
    return page(
      <>
        <h1
          style={{
            color: '#FFFFFF',
            fontSize: 28,
            fontWeight: 800,
            margin: '0 0 8px',
          }}
        >
          Reset Link Unavailable
        </h1>

        <p
          style={{
            color: '#8892A4',
            lineHeight: 1.7,
          }}
        >
          This password-reset link is invalid, expired,
          already used, or this page was opened directly.
        </p>

        <button
          type="button"
          onClick={() =>
            navigate('/forgot-password')
          }
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 12,
            border: 'none',
            background:
              'linear-gradient(135deg, #1A5FFF, #3C78FF)',
            color: '#FFFFFF',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Request New Reset Link
        </button>
      </>,
    )
  }

  return page(
    <>
      <h1
        style={{
          color: '#FFFFFF',
          fontSize: 28,
          fontWeight: 800,
          marginBottom: 8,
        }}
      >
        Reset Password
      </h1>

      <p
        style={{
          color: '#8892A4',
          fontSize: 13,
          marginBottom: 24,
        }}
      >
        Create a new secure password for your account.
      </p>

      {error && (
        <div
          style={{
            background: '#2D1B1B',
            border: '1px solid #7F1D1D',
            color: '#FCA5A5',
            fontSize: 13,
            padding: '11px 14px',
            borderRadius: 10,
            marginBottom: 16,
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: '#10251C',
            border: '1px solid #1F6F50',
            color: '#34D399',
            fontSize: 13,
            padding: '11px 14px',
            borderRadius: 10,
            marginBottom: 16,
            lineHeight: 1.6,
          }}
        >
          {success}
        </div>
      )}

      <form onSubmit={handleResetPassword}>
        <div
          style={{
            position: 'relative',
            marginBottom: 12,
          }}
        >
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="New password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            disabled={loading}
            required
            style={{
              width: '100%',
              padding: '14px 44px 14px 16px',
              background: 'rgba(30,37,53,0.92)',
              border: '1.5px solid #2A3448',
              borderRadius: 12,
              fontSize: 14,
              color: '#FFFFFF',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <button
            type="button"
            onClick={() =>
              setShowPassword((value) => !value)
            }
            disabled={loading}
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
              color: '#8892A4',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <EyeIcon visible={showPassword} />
          </button>
        </div>

        <PasswordChecklist password={password} />

        <div
          style={{
            position: 'relative',
            marginBottom: 16,
          }}
        >
          <input
            type={showConfirm ? 'text' : 'password'}
            placeholder="Confirm new password"
            value={confirm}
            onChange={(event) =>
              setConfirm(event.target.value)
            }
            disabled={loading}
            required
            style={{
              width: '100%',
              padding: '14px 44px 14px 16px',
              background: 'rgba(30,37,53,0.92)',
              border: '1.5px solid #2A3448',
              borderRadius: 12,
              fontSize: 14,
              color: '#FFFFFF',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <button
            type="button"
            onClick={() =>
              setShowConfirm((value) => !value)
            }
            disabled={loading}
            aria-label={
              showConfirm
                ? 'Hide confirm password'
                : 'Show confirm password'
            }
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#8892A4',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <EyeIcon visible={showConfirm} />
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            borderRadius: 12,
            border: 'none',
            background:
              'linear-gradient(135deg, #1A5FFF, #3C78FF)',
            color: '#FFFFFF',
            fontWeight: 700,
            fontSize: 15,
            cursor: loading
              ? 'not-allowed'
              : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? 'Updating password...'
            : 'Update Password'}
        </button>
      </form>
    </>,
  )
}