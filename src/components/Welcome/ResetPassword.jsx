import { useState } from 'react'
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

  if (!password) {
    return 'Password is required.'
  }

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

export default function ResetPassword() {
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleResetPassword(e) {
    e.preventDefault()
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
      const updateResult = await Promise.race([
        supabase.auth.updateUser({
          password,
        }),
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                error: {
                  message:
                    'Password update took too long. Please request a new reset link from the login page.',
                },
              }),
            8000
          )
        ),
      ])

      const { error: updateError } = updateResult

      if (updateError) {
        setError(
          updateError.message ||
            'Reset link is invalid or expired. Please request a new reset link.'
        )
        setLoading(false)
        return
      }

      setSuccess('Password updated successfully. Please login with your new password.')

      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ])

      setLoading(false)

      setTimeout(() => {
        navigate('/', { replace: true })
      }, 1500)
    } catch (err) {
      setError(err.message || 'Failed to update password.')
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#161B27',
          borderRadius: 20,
          padding: 36,
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}
      >
        <h1
          style={{
            color: '#fff',
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

        <form onSubmit={handleResetPassword}>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
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
                opacity: loading ? 0.7 : 1,
              }}
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={loading}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: '#8892A4',
                padding: 0,
              }}
            >
              {showPassword ? 'ðŸ™ˆ' : 'ðŸ‘'}
            </button>
          </div>

          <PasswordChecklist password={password} />

          <div style={{ position: 'relative', marginBottom: 16 }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm new password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={loading}
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
                opacity: loading ? 0.7 : 1,
              }}
            />

            <button
              type="button"
              onClick={() => setShowConfirm((prev) => !prev)}
              disabled={loading}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: '#8892A4',
                padding: 0,
              }}
            >
              {showConfirm ? 'ðŸ™ˆ' : 'ðŸ‘'}
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
              background: '#1A5FFF',
              color: '#fff',
              fontWeight: 700,
              fontSize: 15,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Updating password...' : 'Update Password'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigate('/')}
          disabled={loading}
          style={{
            marginTop: 16,
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: '#8892A4',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 13,
          }}
        >
          Back to login
        </button>
      </div>
    </div>
  )
}
