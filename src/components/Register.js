import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import styles from './Auth.module.css'

export default function Register() {
  const [step, setStep] = useState(1)
  const [role, setRole] = useState('')
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
  })

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const navigate = useNavigate()

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  const ROLES = [
    {
      key: 'player',
      label: 'Player',
      desc: 'Track your own performance, fitness, expenses and match history.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="8" r="5" />
          <path d="M3 21c0-5 4-8 9-8s9 3 9 8" />
        </svg>
      ),
    },
    {
      key: 'coach',
      label: 'Coach',
      desc: 'You play and coach. Get full player dashboard plus coach tools to manage your team.',
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="9" cy="7" r="4" />
          <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
        </svg>
      ),
    },
  ]

  async function handleGoogle() {
    setError('')

    if (!role) {
      setError('Please select your role first.')
      return
    }

    localStorage.setItem('selectedRole', role)

    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/setup`,
      },
    })

    if (err) {
      setError(err.message)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name || !form.email || !form.password) {
      setError('Please fill in all required fields.')
      return
    }

    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    localStorage.setItem('selectedRole', role)

    const { data, error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.name,
          username: form.username,
          role,
        },
      },
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    if (!data?.session && data?.user) {
      setError('Account created. Please check your email to confirm your account, then login.')
      setLoading(false)

      setTimeout(() => {
        navigate('/')
      }, 1500)

      return
    }

    setLoading(false)
    navigate('/setup')
  }

  if (step === 1) {
    return (
      <div className={styles.screen}>
        <div className={styles.box} style={{ maxWidth: 520 }}>
          <div className={styles.logo}>
            <div className={styles.logoMark}>
              <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="1.5" />
                <path d="M6 10 Q10 4 14 10 Q10 16 6 10Z" fill="white" opacity="0.8" />
                <circle cx="10" cy="10" r="2" fill="white" />
              </svg>
            </div>
            <span className={styles.logoName}>ShuttleTrack</span>
          </div>

          <h1 className={styles.title}>I am a...</h1>
          <p className={styles.sub}>Choose your role to get started</p>

          {error && <div className={styles.error}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {ROLES.map((r) => (
              <div
                key={r.key}
                onClick={() => {
                  setRole(r.key)
                  setError('')
                  localStorage.setItem('selectedRole', r.key)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 18px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  border: role === r.key ? '2px solid #1A5FFF' : '1.5px solid #2A3147',
                  background: role === r.key ? 'rgba(26,95,255,0.08)' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: role === r.key ? '#1A5FFF' : '#1E2535',
                    color: role === r.key ? '#fff' : '#8892A4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  {r.icon}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: 12, color: '#8892A4', lineHeight: 1.5 }}>
                    {r.desc}
                  </div>
                </div>

                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: role === r.key ? 'none' : '2px solid #3A4460',
                    background: role === r.key ? '#1A5FFF' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  {role === r.key && (
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
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              if (!role) {
                setError('Please select your role.')
                return
              }

              localStorage.setItem('selectedRole', role)
              setError('')
              setStep(2)
            }}
            style={{
              width: '100%',
              padding: '13px',
              marginBottom: 12,
              background: role ? '#1A5FFF' : '#1E2535',
              color: role ? '#fff' : '#4A5568',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: role ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            Continue →
          </button>

          <p style={{ textAlign: 'center', fontSize: 13, color: '#8892A4', margin: 0 }}>
            Already have an account?{' '}
            <Link to="/" style={{ color: '#00C48C', fontWeight: 600 }}>
              Login
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.box}>
        <div className={styles.logo}>
          <div className={styles.logoMark}>
            <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
              <circle cx="10" cy="10" r="8" stroke="white" strokeWidth="1.5" />
              <path d="M6 10 Q10 4 14 10 Q10 16 6 10Z" fill="white" opacity="0.8" />
              <circle cx="10" cy="10" r="2" fill="white" />
            </svg>
          </div>
          <span className={styles.logoName}>ShuttleTrack</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => setStep(1)}
            style={{
              background: 'none',
              border: 'none',
              color: '#8892A4',
              cursor: 'pointer',
              fontSize: 13,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            ← Back
          </button>

          <span
            style={{
              fontSize: 11,
              background: '#1A5FFF22',
              color: '#1A5FFF',
              padding: '2px 10px',
              borderRadius: 20,
              fontWeight: 700,
              border: '1px solid #1A5FFF44',
            }}
          >
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </span>
        </div>

        <h1 className={styles.title}>Create Account</h1>
        <p className={styles.sub}>Register as a new badminton {role}</p>

        {error && <div className={styles.error}>{error}</div>}

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
            marginBottom: 16,
            boxSizing: 'border-box',
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
          Sign up with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: '#2A3147' }} />
          <span style={{ fontSize: 12, color: '#4A5568' }}>or register with email</span>
          <div style={{ flex: 1, height: 1, background: '#2A3147' }} />
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.row2}>
            <input
              className={styles.input}
              type="text"
              placeholder="Full Name"
              value={form.name}
              onChange={set('name')}
              required
            />

            <input
              className={styles.input}
              type="text"
              placeholder="Username"
              value={form.username}
              onChange={set('username')}
            />
          </div>

          <div className={styles.field}>
            <input
              className={styles.input}
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={set('email')}
              required
            />
          </div>

          <div className={styles.field} style={{ position: 'relative' }}>
            <input
              className={styles.input}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={form.password}
              onChange={set('password')}
              required
              style={{ paddingRight: 44 }}
            />

            <button
              type="button"
              onClick={() => setShowPassword((p) => !p)}
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

          <div className={styles.field} style={{ position: 'relative' }}>
            <input
              className={styles.input}
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm Password"
              value={form.confirm}
              onChange={set('confirm')}
              required
              style={{ paddingRight: 44 }}
            />

            <button
              type="button"
              onClick={() => setShowConfirm((p) => !p)}
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
              {showConfirm ? (
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

          <button className={styles.btn} type="submit" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Creating account...' : 'Continue Setup'}
          </button>
        </form>

        <p className={styles.link}>
          Already have an account? <Link to="/">Login</Link>
        </p>
      </div>
    </div>
  )
}