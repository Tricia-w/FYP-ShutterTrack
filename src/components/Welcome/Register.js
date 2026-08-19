import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import styles from '../Welcome/Auth.module.css'

const MAX_NAME_LENGTH = 80
const MAX_USERNAME_LENGTH = 30
const MAX_EMAIL_LENGTH = 254
const MAX_PASSWORD_LENGTH = 128

function isValidEmail(email) {
  return (
    Boolean(email) &&
    email.length <= MAX_EMAIL_LENGTH &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)
  )
}

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

function getFriendlyAuthMessage(error, fallback) {
  console.error(fallback, error)

  const code = String(error?.code || '').toLowerCase()
  const status = Number(error?.status || 0)
  const message = String(error?.message || '')
    .trim()
    .toLowerCase()

  if (
    code === 'over_email_send_rate_limit' ||
    message.includes('email rate limit') ||
    message.includes('rate limit exceeded')
  ) {
    return 'Too many emails were requested. Please wait before trying again.'
  }

  if (
    code === 'over_request_rate_limit' ||
    status === 429 ||
    message.includes('too many requests')
  ) {
    return 'Too many attempts were made. Please wait before trying again.'
  }

  if (
    code === 'email_not_confirmed' ||
    message.includes('email not confirmed')
  ) {
    return 'Verify your existing email before adding another role.'
  }

  if (
    code === 'invalid_credentials' ||
    message.includes('invalid login credentials')
  ) {
    return 'The existing account email or password is incorrect.'
  }

  if (
    code === 'weak_password' ||
    message.includes('weak password')
  ) {
    return 'Please use a stronger password.'
  }

  if (
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('user exists')
  ) {
    return 'This email already belongs to a ShuttleTrack account. Use Add Role and enter the existing password.'
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network')
  ) {
    return 'Unable to connect to the server. Check your internet connection and try again.'
  }

  return fallback
}

function isExistingSignupResponse(error, user) {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '').toLowerCase()

  return (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('already registered') ||
    message.includes('already exists') ||
    (Boolean(user) &&
      Array.isArray(user.identities) &&
      user.identities.length === 0)
  )
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

function PasswordChecklist({ password }) {
  const checks = getPasswordChecks(password)

  const rowStyle = (valid) => ({
    margin: '0 0 4px',
    fontSize: 12,
    color: valid ? '#34D399' : '#8892A4',
  })

  return (
    <div style={{ margin: '-3px 0 15px' }}>
      <p style={rowStyle(checks.length)}>
        {checks.length ? '✓' : '•'} At least 8 characters
      </p>
      <p style={rowStyle(checks.uppercase)}>
        {checks.uppercase ? '✓' : '•'} One uppercase letter
      </p>
      <p style={rowStyle(checks.lowercase)}>
        {checks.lowercase ? '✓' : '•'} One lowercase letter
      </p>
      <p style={rowStyle(checks.number)}>
        {checks.number ? '✓' : '•'} One number
      </p>
      <p style={rowStyle(checks.symbol)}>
        {checks.symbol ? '✓' : '•'} One symbol
      </p>
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()

  const [step, setStep] = useState('role')
  const [role, setRole] = useState('')
  const [accountMode, setAccountMode] = useState('new')

  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    password: '',
    confirm: '',
  })

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [verificationEmail, setVerificationEmail] =
    useState('')
  const [registrationComplete, setRegistrationComplete] =
    useState(false)
  const [resending, setResending] = useState(false)

  const setField = (key) => (event) => {
    setForm((previous) => ({
      ...previous,
      [key]: event.target.value,
    }))
  }

  function resetMessages() {
    setError('')
    setSuccess('')
  }

  async function handleNewAccount() {
    const cleanName = form.name.trim()
    const cleanUsername = form.username.trim()
    const cleanEmail = form.email.trim().toLowerCase()

    if (!cleanName || !cleanEmail || !form.password || !form.confirm) {
      setError('Please fill in all required fields.')
      return
    }

    if (cleanName.length > MAX_NAME_LENGTH) {
      setError(`Full name must be ${MAX_NAME_LENGTH} characters or fewer.`)
      return
    }

    if (cleanUsername.length > MAX_USERNAME_LENGTH) {
      setError(`Username must be ${MAX_USERNAME_LENGTH} characters or fewer.`)
      return
    }

    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    if (form.password.length > MAX_PASSWORD_LENGTH) {
      setError(`Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`)
      return
    }

    const passwordError = getPasswordError(form.password)

    if (passwordError) {
      setError(passwordError)
      return
    }

    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }

    const { data, error: signupError } =
      await supabase.auth.signUp({
        email: cleanEmail,
        password: form.password,
        options: {
          emailRedirectTo:
            `${window.location.origin}/email-verified`,
          data: {
            role,
            requested_role: role,
            full_name: cleanName,
            username: cleanUsername,
            has_player_access: role === 'player',
            has_coach_access: role === 'coach',
          },
        },
      })

    if (
      signupError ||
      isExistingSignupResponse(signupError, data?.user)
    ) {
      if (isExistingSignupResponse(signupError, data?.user)) {
        setAccountMode('existing')
        setError(
          'This email already has a ShuttleTrack account. Enter the existing password below to add this role.',
        )
        return
      }

      throw signupError
    }

    if (!data?.user) {
      throw new Error('Supabase did not return the new account.')
    }

    if (!data.session) {
      setVerificationEmail(cleanEmail)
      setRegistrationComplete(true)
      setSuccess(
        'Account created successfully. Verify your email once before logging in.',
      )
      return
    }

    window.location.replace(
      role === 'coach' ? '/coach/profile?newRole=1' : '/setup',
    )
  }

  async function handleExistingAccount() {
    const cleanEmail = form.email.trim().toLowerCase()

    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    if (!form.password) {
      setError('Enter the password for your existing ShuttleTrack account.')
      return
    }

    /*
     * PublicRoute must keep /register open while this temporary login
     * verifies the account and adds the second role.
     */
    localStorage.setItem('shuttleAddingRole', '1')

    const {
      data: loginData,
      error: loginError,
    } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: form.password,
    })

    if (loginError || !loginData?.user?.id) {
      localStorage.removeItem('shuttleAddingRole')
      throw loginError || new Error('Existing account login failed.')
    }

    const existingUser = loginData.user

    const { data: appUser, error: appUserError } =
      await supabase
        .from('app_users')
        .select(
          `
            user_id,
            role,
            has_player_access,
            has_coach_access,
            account_status,
            removed_at
          `,
        )
        .eq('user_id', existingUser.id)
        .maybeSingle()

    if (appUserError) throw appUserError

    if (!appUser) {
      localStorage.removeItem('shuttleAddingRole')
      await supabase.auth.signOut()

      throw new Error(
        'The Auth account exists, but its ShuttleTrack account record is missing.',
      )
    }

    const accountStatus = String(
      appUser.account_status || 'active',
    ).toLowerCase()

    if (appUser.removed_at) {
      localStorage.removeItem('shuttleAddingRole')
      await supabase.auth.signOut()

      setError(
        'This ShuttleTrack account is no longer available.',
      )
      return
    }

    if (accountStatus === 'disabled') {
      localStorage.removeItem('shuttleAddingRole')
      await supabase.auth.signOut()

      setError(
        'Your ShuttleTrack account has been disabled by an administrator. You cannot add another role at this time.',
      )
      return
    }

    if (accountStatus === 'suspended') {
      localStorage.removeItem('shuttleAddingRole')
      await supabase.auth.signOut()

      setError(
        'Your ShuttleTrack account is currently suspended. You cannot add another role at this time.',
      )
      return
    }

    if (accountStatus !== 'active') {
      localStorage.removeItem('shuttleAddingRole')
      await supabase.auth.signOut()

      setError(
        'Your ShuttleTrack account is not currently active. You cannot add another role at this time.',
      )
      return
    }

    const alreadyHasAccess =
      role === 'coach'
        ? appUser.has_coach_access === true
        : appUser.has_player_access === true

    if (alreadyHasAccess) {
      localStorage.removeItem('shuttleAddingRole')
      await supabase.auth.signOut()
      setError(
        `This account already has ${role === 'coach' ? 'Coach' : 'Player'} access. Use the Login page.`,
      )
      return
    }

    const { error: roleError } = await supabase.rpc(
      'add_current_user_role',
      {
        target_role: role,
        new_full_name: null,
        new_username: null,
      },
    )

    if (roleError) {
      console.error('add_current_user_role RPC error:', roleError)
      throw roleError
    }

    if (role === 'coach') {
      const { error: profileError } = await supabase
        .from('coach_profiles')
        .upsert(
          {
            user_id: existingUser.id,
            display_name:
              existingUser.user_metadata?.full_name ||
              existingUser.email?.split('@')[0] ||
              'Coach',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )

      if (profileError) throw profileError

      localStorage.removeItem('shuttleAddingRole')
      window.location.replace('/coach/profile?newRole=1')
      return
    }

    const { error: profileError } = await supabase
      .from('player_profiles')
      .upsert(
        {
          user_id: existingUser.id,
          display_name:
            existingUser.user_metadata?.full_name ||
            existingUser.email?.split('@')[0] ||
            'Player',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )

    if (profileError) throw profileError

    localStorage.removeItem('shuttleAddingRole')
    window.location.replace('/setup?addRole=1')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    resetMessages()
    setLoading(true)

    try {
      if (accountMode === 'existing') {
        await handleExistingAccount()
      } else {
        await handleNewAccount()
      }
    } catch (err) {
      localStorage.removeItem('shuttleAddingRole')

      setError(
        getFriendlyAuthMessage(
          err,
          accountMode === 'existing'
            ? 'Unable to verify the existing account or add this role.'
            : 'Unable to create the account. Please try again.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  async function resendVerificationEmail() {
    if (!verificationEmail || resending) return

    resetMessages()
    setResending(true)

    try {
      const { error: resendError } =
        await supabase.auth.resend({
          type: 'signup',
          email: verificationEmail,
          options: {
            emailRedirectTo:
              `${window.location.origin}/email-verified`,
          },
        })

      if (resendError) throw resendError

      setSuccess(
        'Verification email sent again. Check Inbox, Spam, Junk, Promotions, and Trash.',
      )
    } catch (err) {
      setError(
        getFriendlyAuthMessage(
          err,
          'Unable to resend the verification email.',
        ),
      )
    } finally {
      setResending(false)
    }
  }

  const roleOptions = [
    {
      key: 'player',
      label: 'Player',
      description:
        'Track your own performance, fitness, matches and progress.',
    },
    {
      key: 'coach',
      label: 'Coach',
      description:
        'Manage badminton players, sessions and coaching progress.',
    },
  ]

  const Logo = () => (
    <div className={styles.logo}>
      <div className={styles.logoMark}>
        <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
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
      <span className={styles.logoName}>ShuttleTrack</span>
    </div>
  )

  if (registrationComplete) {
    return (
      <div className={styles.screen}>
        <div className={styles.box}>
          <Logo />

          <div
            style={{
              width: 70,
              height: 70,
              margin: '8px auto 18px',
              borderRadius: '50%',
              border: '1px solid #00C48C',
              background: '#10251C',
              color: '#34D399',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
            }}
          >
            ✓
          </div>

          <h1
            className={styles.title}
            style={{ textAlign: 'center' }}
          >
            Check your email
          </h1>

          <p
            className={styles.sub}
            style={{ textAlign: 'center', lineHeight: 1.6 }}
          >
            A verification link was sent to
            <br />
            <strong style={{ color: '#FFFFFF' }}>
              {verificationEmail}
            </strong>
          </p>

          {error && <div className={styles.error}>{error}</div>}

          {success && (
            <div
              style={{
                background: '#10251C',
                color: '#34D399',
                padding: '11px 14px',
                borderRadius: 10,
                marginBottom: 16,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {success}
            </div>
          )}

          <div
            style={{
              background: '#1E2535',
              border: '1px solid #2A3147',
              color: '#8892A4',
              borderRadius: 12,
              padding: 14,
              fontSize: 12,
              lineHeight: 1.7,
              marginBottom: 16,
            }}
          >
            Open the email and click the verification link.
            Check Inbox, Spam, Junk, Promotions and Trash if it
            is not visible.
          </div>

          <button
            type="button"
            className={styles.btn}
            onClick={() =>
              navigate('/login', {
                state: { email: verificationEmail },
              })
            }
          >
            Go to Login
          </button>

          <button
            type="button"
            onClick={resendVerificationEmail}
            disabled={resending}
            style={{
              width: '100%',
              marginTop: 10,
              padding: 12,
              borderRadius: 12,
              border: '1px solid #2A3147',
              background: '#1E2535',
              color: '#FFFFFF',
              cursor: resending ? 'not-allowed' : 'pointer',
              opacity: resending ? 0.7 : 1,
            }}
          >
            {resending
              ? 'Sending...'
              : 'Resend verification email'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'role') {
    return (
      <div className={styles.screen}>
        <div className={styles.box} style={{ maxWidth: 520 }}>
          <Logo />

          <h1 className={styles.title}>I am a...</h1>
          <p className={styles.sub}>
            Choose your role to get started
          </p>

          {error && <div className={styles.error}>{error}</div>}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginBottom: 24,
            }}
          >
            {roleOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  setRole(option.key)
                  resetMessages()
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px 18px',
                  borderRadius: 14,
                  cursor: 'pointer',
                  border:
                    role === option.key
                      ? '2px solid #1A5FFF'
                      : '1.5px solid #2A3147',
                  background:
                    role === option.key
                      ? 'rgba(26,95,255,0.08)'
                      : 'transparent',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    flexShrink: 0,
                    background:
                      role === option.key
                        ? '#1A5FFF'
                        : '#1E2535',
                    color:
                      role === option.key
                        ? '#FFFFFF'
                        : '#8892A4',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <circle cx="12" cy="8" r="5" />
                    <path d="M3 21c0-5 4-8 9-8s9 3 9 8" />
                  </svg>
                </div>

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: '#FFFFFF',
                      fontSize: 15,
                      fontWeight: 700,
                      marginBottom: 3,
                    }}
                  >
                    {option.label}
                  </div>

                  <div
                    style={{
                      color: '#8892A4',
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    {option.description}
                  </div>
                </div>

                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border:
                      role === option.key
                        ? 'none'
                        : '2px solid #3A4460',
                    background:
                      role === option.key
                        ? '#1A5FFF'
                        : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {role === option.key && (
                    <span
                      style={{
                        color: '#FFFFFF',
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.btn}
            disabled={!role}
            onClick={() => {
              if (!role) {
                setError('Please select your role.')
                return
              }
              resetMessages()
              setStep('details')
            }}
            style={{
              opacity: role ? 1 : 0.55,
              cursor: role ? 'pointer' : 'not-allowed',
            }}
          >
            Continue →
          </button>

          <p className={styles.link}>
            Already have an account? <Link to="/login">Login</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.box}>
        <Logo />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setStep('role')
              resetMessages()
            }}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: '#8892A4',
              cursor: loading ? 'not-allowed' : 'pointer',
              padding: 0,
              fontSize: 13,
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

        <h1 className={styles.title}>
          {accountMode === 'new'
            ? 'Create Account'
            : `Add ${role === 'coach' ? 'Coach' : 'Player'} Access`}
        </h1>

        <p className={styles.sub}>
          {accountMode === 'new'
            ? `Register as a new badminton ${role}`
            : 'Use your existing ShuttleTrack email and password. No second email verification is needed.'}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 18,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setAccountMode('new')
              resetMessages()
            }}
            style={{
              padding: 10,
              borderRadius: 10,
              border:
                accountMode === 'new'
                  ? '1px solid #1A5FFF'
                  : '1px solid #2A3147',
              background:
                accountMode === 'new'
                  ? '#1A5FFF22'
                  : '#1E2535',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            New Account
          </button>

          <button
            type="button"
            onClick={() => {
              setAccountMode('existing')
              resetMessages()
            }}
            style={{
              padding: 10,
              borderRadius: 10,
              border:
                accountMode === 'existing'
                  ? '1px solid #1A5FFF'
                  : '1px solid #2A3147',
              background:
                accountMode === 'existing'
                  ? '#1A5FFF22'
                  : '#1E2535',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            Add Role
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {success && (
          <div
            style={{
              background: '#10251C',
              color: '#34D399',
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {accountMode === 'new' && (
            <div className={styles.row2}>
              <input
                className={styles.input}
                type="text"
                placeholder="Full Name"
                value={form.name}
                onChange={setField('name')}
                autoComplete="name"
                maxLength={MAX_NAME_LENGTH}
                required
                disabled={loading}
              />

              <input
                className={styles.input}
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={setField('username')}
                autoComplete="username"
                maxLength={MAX_USERNAME_LENGTH}
                disabled={loading}
              />
            </div>
          )}

          <div className={styles.field}>
            <input
              className={styles.input}
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={setField('email')}
              autoComplete="email"
              maxLength={MAX_EMAIL_LENGTH}
              required
              disabled={loading}
            />
          </div>

          <div
            className={styles.field}
            style={{ position: 'relative' }}
          >
            <input
              className={styles.input}
              type={showPassword ? 'text' : 'password'}
              placeholder={
                accountMode === 'existing'
                  ? 'Existing account password'
                  : 'Create password'
              }
              value={form.password}
              onChange={setField('password')}
              autoComplete={
                accountMode === 'existing'
                  ? 'current-password'
                  : 'new-password'
              }
              minLength={accountMode === 'new' ? 8 : undefined}
              maxLength={MAX_PASSWORD_LENGTH}
              required
              disabled={loading}
              style={{ paddingRight: 44 }}
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword((previous) => !previous)
              }
              disabled={loading}
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#8892A4',
                cursor: loading ? 'not-allowed' : 'pointer',
                padding: 0,
                display: 'flex',
              }}
            >
              <EyeIcon visible={showPassword} />
            </button>
          </div>

          {accountMode === 'new' && (
            <>
              <PasswordChecklist password={form.password} />

              <div
                className={styles.field}
                style={{ position: 'relative' }}
              >
                <input
                  className={styles.input}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm Password"
                  value={form.confirm}
                  onChange={setField('confirm')}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={MAX_PASSWORD_LENGTH}
                  required
                  disabled={loading}
                  style={{ paddingRight: 44 }}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirm((previous) => !previous)
                  }
                  disabled={loading}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#8892A4',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  <EyeIcon visible={showConfirm} />
                </button>
              </div>
            </>
          )}

          <button
            className={styles.btn}
            type="submit"
            disabled={loading}
            style={{
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading
              ? accountMode === 'existing'
                ? 'Verifying account...'
                : 'Creating account...'
              : accountMode === 'existing'
                ? `Add ${role === 'coach' ? 'Coach' : 'Player'} Access`
                : 'Continue Setup'}
          </button>
        </form>

        {accountMode === 'existing' ? (
          <p className={styles.link}>
            Forgot the existing password?{' '}
            <Link to="/login">Reset it from Login</Link>
          </p>
        ) : (
          <p className={styles.link}>
            Already have an account? <Link to="/login">Login</Link>
          </p>
        )}
      </div>
    </div>
  )
}