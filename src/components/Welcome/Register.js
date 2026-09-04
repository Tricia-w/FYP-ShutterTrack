import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import styles from '../Welcome/Auth.module.css'

const MAX_NAME_LENGTH = 80
const MAX_USERNAME_LENGTH = 30
const MAX_EMAIL_LENGTH = 254
const MAX_PASSWORD_LENGTH = 128
const CONSENT_VERSION = '1.0'

const INITIAL_FORM_STATE = {
  name: '',
  username: '',
  email: '',
  password: '',
  confirm: '',
}

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
    return 'We could not send another verification email. Reason: too many verification emails were requested in a short time. Please wait a while before trying again.'
  }

  if (
    code === 'over_request_rate_limit' ||
    status === 429 ||
    message.includes('too many requests')
  ) {
    return 'We could not continue. Reason: too many attempts were made in a short time. Please wait a while before trying again.'
  }

  if (
    code === 'email_not_confirmed' ||
    message.includes('email not confirmed')
  ) {
    return 'You cannot add another role yet. Reason: your email address has not been verified. Please verify your email first.'
  }

  if (
    code === 'invalid_credentials' ||
    message.includes('invalid login credentials')
  ) {
    return 'We could not sign you in. Reason: the email or password is incorrect. Please check your details and try again.'
  }

  if (
    code === 'weak_password' ||
    message.includes('weak password')
  ) {
    return 'We could not create the account. Reason: the password is not strong enough. Please use a stronger password.'
  }

  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    message.includes('already registered') ||
    message.includes('already exists') ||
    message.includes('user exists')
  ) {
    return 'We could not create a new account with this email. Reason: this email is already registered. Choose "Add Role" to add another role, or go to Login.'
  }

  if (
    code === 'validation_failed' ||
    message.includes('invalid email') ||
    message.includes('email is invalid')
  ) {
    return 'We could not continue. Reason: the email address is not valid. Please check it and try again.'
  }

  if (
    message.includes('failed to fetch') ||
    message.includes('network')
  ) {
    return 'We could not complete the request. Reason: ShuttleTrack could not connect to the server. Please check your internet connection and try again.'
  }

  if (
    message.includes('supabase did not return the new account') ||
    message.includes('could not complete your account setup')
  ) {
    return 'We could not finish setting up your account. Reason: ShuttleTrack did not receive the account information needed to complete registration. Please try again. If you already created an account, try logging in instead.'
  }

  if (
    message.includes('row-level security') ||
    message.includes('rls') ||
    message.includes('permission denied') ||
    message.includes('not authorized')
  ) {
    return 'We could not complete this action. Reason: your account does not have permission to make this change. Please log in again or contact support.'
  }

  if (
    message.includes('duplicate key') ||
    message.includes('unique constraint')
  ) {
    return 'We could not save these details. Reason: some of this information is already being used by another account. Please use different details or try logging in.'
  }

  if (
    message.includes('foreign key') ||
    message.includes('violates foreign key')
  ) {
    return 'We could not finish setting up your account. Reason: ShuttleTrack could not link your account information correctly. Please try again.'
  }

  if (
    message.includes('null value') ||
    message.includes('not-null constraint')
  ) {
    return 'We could not continue. Reason: some required account information is missing. Please check the form and try again.'
  }

  if (
    message.includes('database') ||
    message.includes('postgres') ||
    message.includes('rpc')
  ) {
    return 'We could not complete this request. Reason: the account service is temporarily unavailable. Please try again in a moment.'
  }

  return 'Could not create your account. This email may already be registered, or there may be a temporary server issue.'
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


function LegalModal({ type, onClose, isDark }) {
  if (!type) return null

  const primaryText = isDark ? '#FFFFFF' : '#172033'
  const secondaryText = isDark ? '#A7B0C0' : '#667085'
  const surface = isDark ? '#171D2A' : '#FFFFFF'
  const border = isDark ? '#2A3147' : '#DCE3EE'

  const content = {
    terms: {
      title: 'Terms & Conditions',
      intro:
        'These Terms & Conditions govern your access to and use of the ShuttleTrack system.',
      sections: [
        [
          '1. Acceptance of Terms',
          'By creating an account or using ShuttleTrack, you acknowledge that you have read, understood, and agreed to comply with these Terms & Conditions. If you do not agree with these terms, you should not create an account or continue using the system.',
        ],
        [
          '2. Purpose of the System',
          'ShuttleTrack is a badminton player and coaching management system designed to support player profile management, performance tracking, fitness monitoring, match recording, training activities, scheduling, progress review, and coach-player interaction.',
        ],
        [
          '3. Account Registration and Responsibilities',
          'Users are responsible for providing accurate and current information during registration and profile setup. Users must keep their login credentials secure and must not impersonate another individual, provide intentionally false information, access another user account without authorization, or use ShuttleTrack for fraudulent, abusive, or unlawful purposes.',
        ],
        [
          '4. Player and Coach Access',
          'Access to player and coach information is determined by the role, permissions, profile visibility settings, and coach-player relationships available within ShuttleTrack. Users are responsible for using any information made available to them only for legitimate badminton, coaching, training, or system-related purposes.',
        ],
        [
          '5. Performance, Fitness and Health-Related Information',
          'Performance ratings, fitness information, recovery records, injury information, match records, coach feedback, action plans, and training recommendations are provided for tracking, coaching, and informational purposes only. ShuttleTrack does not provide medical diagnosis or professional healthcare advice. Users should seek appropriate professional advice where necessary.',
        ],
        [
          '6. User Conduct',
          'Users must not use ShuttleTrack to harass, threaten, deceive, exploit, or harm another person. Users must not upload or submit content that is intentionally misleading, inappropriate, unlawful, or unrelated to the intended operation of the system.',
        ],
        [
          '7. Availability and System Changes',
          'ShuttleTrack may modify, improve, suspend, or remove functions as the system develops. While reasonable efforts may be made to maintain availability and data integrity, uninterrupted access to every function cannot be guaranteed.',
        ],
        [
          '8. Suspension or Removal of Access',
          'Access to ShuttleTrack may be restricted, suspended, or removed where an account is found to have violated these Terms & Conditions, applicable system rules, or legitimate administrative requirements.',
        ],
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      intro:
        'This Privacy Policy explains how ShuttleTrack collects, uses, stores, and manages personal information provided through the system.',
      sections: [
        [
          '1. Categories of Personal Data Collected',
          'Depending on the features used, ShuttleTrack may collect personal and account information such as your name, username, email address, profile photograph, age, club, state or location, badminton level and category, playing style, dominant hand, height, weight, skill ratings, fitness test results, training records, recovery information, injury information, match history, match videos, schedules, coach assessments, feedback, action plans, and coach-player relationship information.',
        ],
        [
          '2. Purpose of Data Collection and Use',
          'Personal information may be processed for account creation and authentication, profile management, player discovery, performance and fitness tracking, match and training management, scheduling, progress review, coach-player communication, statistical calculation, and other functions necessary for the operation of ShuttleTrack.',
        ],
        [
          '3. Disclosure and Visibility of Profile Information',
          'Certain profile information may be visible to other ShuttleTrack users when profile visibility is enabled. Private or restricted information, including fitness, recovery, injury, coaching, or account-related records, should only be made available in accordance with the permissions, relationships, and access controls implemented within the system.',
        ],
        [
          '4. Data Storage and Security',
          'ShuttleTrack stores application data using its authentication, database, and storage services. Reasonable technical and organizational measures are used to reduce the risk of unauthorized access, alteration, disclosure, or loss of user information.',
        ],
        [
          '5. Data Accuracy and User Responsibilities',
          'Users are responsible for ensuring that the information they provide is accurate and reasonably up to date. Where supported by the system, users may update their profile details, adjust profile visibility, manage coach-player relationships, and modify information that they have submitted.',
        ],
        [
          '6. Retention of Information',
          'Personal information may be retained for as long as it is reasonably required to provide ShuttleTrack functions, maintain account records, support legitimate administrative requirements, or preserve records generated through the system. Where account deletion is supported, relevant information may be removed or retained only where necessary for legitimate system purposes.',
        ],
        [
          '7. Third-Party Disclosure',
          'ShuttleTrack does not intentionally sell users’ personal information to third parties. Information should only be disclosed where required for system operation, authorized user interactions, legitimate administrative purposes, or where disclosure is required by applicable law.',
        ],
        [
          '8. User Rights and Choices',
          'Where supported by ShuttleTrack, users may review and update profile information, change privacy or visibility settings, manage coach relationships, and request account-related changes. Users should use the available system controls or contact the system administrator where further assistance is required.',
        ],
      ],
    },
    consent: {
      title: 'Profile Data Consent',
      intro:
        'This consent notice explains how your personal information may be collected and processed when you create and use a ShuttleTrack account.',
      sections: [
        [
          '1. Categories of Personal Data Covered by this Consent',
          'By providing consent, you acknowledge that ShuttleTrack may collect, store, and process personal information that you voluntarily provide or generate through use of the system. This may include your name, username, email address, profile photograph, age, badminton level and category, club, location or state, playing style, dominant hand, height, weight, skill ratings, match information, fitness information, training information, recovery records, injury information, schedules, and related profile information.',
        ],
        [
          '2. Purpose of Data Collection and Processing',
          'Your information may be used for account creation, identity and profile management, badminton performance monitoring, fitness tracking, match management, training and scheduling functions, progress review, coach-player interaction, statistical calculation, and player discovery where the relevant visibility settings are enabled.',
        ],
        [
          '3. Disclosure and Visibility of Profile Information',
          'Information intended for your public profile may be visible to other ShuttleTrack users when your profile visibility is enabled. Information classified or treated as private should only be accessible according to the permissions, relationships, and access controls provided by the system.',
        ],
        [
          '4. Consent to Storage and Use',
          'By selecting the consent checkbox, you expressly agree that ShuttleTrack may collect, store, process, and use the personal information described in this notice for the purposes necessary to operate the system and provide its features.',
        ],
        [
          '5. Voluntary Consent and Withdrawal',
          'Providing consent is voluntary. However, ShuttleTrack cannot create or maintain a new account without the minimum information and permissions required to provide the service. Where supported by the system, you may update your information, change relevant privacy settings, or request account-related changes. Withdrawal of consent may affect the availability of features that depend on the relevant information.',
        ],
        [
          '6. Confirmation',
          'By proceeding with account registration after selecting the consent checkbox, you confirm that you have read and understood this Profile Data Consent notice and agree to the collection and use of your information as described above.',
        ],
      ],
    },
  }

  const current = content[type]
  if (!current) return null

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12000,
        background: 'rgba(13,27,62,.58)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: 'min(720px, 100%)',
          maxHeight: '86vh',
          overflowY: 'auto',
          borderRadius: 18,
          padding: 24,
          background: surface,
          border: `1px solid ${border}`,
          boxShadow: '0 24px 80px rgba(0,0,0,.28)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 14,
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 21,
                fontWeight: 700,
                color: primaryText,
              }}
            >
              {current.title}
            </div>

            <div
              style={{
                marginTop: 5,
                fontSize: 12,
                lineHeight: 1.6,
                color: secondaryText,
              }}
            >
              {current.intro}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: 'transparent',
              color: primaryText,
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 15,
          }}
        >
          {current.sections.map(([heading, text]) => (
            <div key={heading}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: primaryText,
                  marginBottom: 5,
                }}
              >
                {heading}
              </div>
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: secondaryText,
                }}
              >
                {text}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: `1px solid ${border}`,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 0,
              borderRadius: 10,
              padding: '10px 16px',
              background: '#1A5FFF',
              color: '#FFFFFF',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()

  const [step, setStep] = useState('role')
  const [role, setRole] = useState('')
  const [accountMode, setAccountMode] = useState('new')

  const [form, setForm] = useState(INITIAL_FORM_STATE)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [registrationComplete, setRegistrationComplete] = useState(false)
  const [resending, setResending] = useState(false)

  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [profileConsentAccepted, setProfileConsentAccepted] = useState(false)
  const [legalModal, setLegalModal] = useState(null)

  // Follow the same saved theme as Login.
  // Register does not have its own theme switch.
  const [isDark] = useState(
    localStorage.getItem('shuttleLoginTheme') === 'dark',
  )

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

  function resetForm() {
    setForm(INITIAL_FORM_STATE)
    setTermsAccepted(false)
    setPrivacyAccepted(false)
    setProfileConsentAccepted(false)
    setLegalModal(null)
  }

  async function handleNewAccount() {
    const cleanName = form.name.trim()
    const cleanUsername = form.username.trim()
    const cleanEmail = form.email.trim().toLowerCase()

    if (!cleanName || !cleanEmail || !form.password || !form.confirm) {
      setError('Please fill in all required fields.')
      setLoading(false)
      return
    }

    if (cleanName.length > MAX_NAME_LENGTH) {
      setError(`Full name must be ${MAX_NAME_LENGTH} characters or fewer.`)
      setLoading(false)
      return
    }

    if (cleanUsername.length > MAX_USERNAME_LENGTH) {
      setError(`Username must be ${MAX_USERNAME_LENGTH} characters or fewer.`)
      setLoading(false)
      return
    }

    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid email address.')
      setLoading(false)
      return
    }

    if (form.password.length > MAX_PASSWORD_LENGTH) {
      setError(`Password must be ${MAX_PASSWORD_LENGTH} characters or fewer.`)
      setLoading(false)
      return
    }

    const passwordError = getPasswordError(form.password)

    if (passwordError) {
      setError(passwordError)
      setLoading(false)
      return
    }

    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    if (
      !termsAccepted ||
      !privacyAccepted ||
      !profileConsentAccepted
    ) {
      setError(
        'Please agree to the Terms & Conditions, confirm that you have read the Privacy Policy, and give consent before continuing.',
      )
      setLoading(false)
      return
    }

    const consentedAt = new Date().toISOString()

    const { data, error: signupError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/email-verified`,
        data: {
          role,
          requested_role: role,
          full_name: cleanName,
          username: cleanUsername,
          has_player_access: role === 'player',
          has_coach_access: role === 'coach',
          terms_accepted: true,
          privacy_accepted: true,
          profile_consent: true,
          consent_version: CONSENT_VERSION,
          consented_at: consentedAt,
        },
      },
    })

    if (signupError || isExistingSignupResponse(signupError, data?.user)) {
      if (isExistingSignupResponse(signupError, data?.user)) {
        setAccountMode('existing')
        setError(
          'We could not create a new account with this email. Reason: this email is already registered. Choose "Add Role" to add another role, or go to Login.',
        )
        setLoading(false)
        return
      }

      throw signupError
    }

    if (!data?.user) {
      throw new Error(
        'We could not finish setting up your account. Reason: ShuttleTrack did not receive the account information needed to complete registration. Please try again. If you already created an account, try logging in instead.'
      )
    }

    if (!data.session) {
      setVerificationEmail(cleanEmail)
      setRegistrationComplete(true)
      setSuccess(
        'Your account was created successfully. Please verify your email before logging in.',
      )
      return
    }

    window.location.replace(
      role === 'coach'
        ? '/coach/profile?newRole=1'
        : '/setup',
    )
  }

  async function handleExistingAccount() {
    const cleanEmail = form.email.trim().toLowerCase()

    if (!isValidEmail(cleanEmail)) {
      setError('Please enter a valid email address.')
      setLoading(false)
      return
    }

    if (!form.password) {
      setError(
        'Please enter the password for your existing ShuttleTrack account.',
      )
      setLoading(false)
      return
    }

    localStorage.setItem('shuttleAddingRole', '1')

    const { data: loginData, error: loginError } =
      await supabase.auth.signInWithPassword({
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
          'user_id, role, has_player_access, has_coach_access, account_status, removed_at',
        )
        .eq('user_id', existingUser.id)
        .maybeSingle()

    if (appUserError) throw appUserError

    if (!appUser) {
      localStorage.removeItem('shuttleAddingRole')
      await supabase.auth.signOut()
      throw new Error(
        'Your account was found, but setup could not continue. Reason: your ShuttleTrack profile could not be loaded. Please try again later or contact support.',
      )
    }

    const accountStatus = String(
      appUser.account_status || 'active',
    ).toLowerCase()

    if (appUser.removed_at) {
      localStorage.removeItem('shuttleAddingRole')
      await supabase.auth.signOut()
      setError('This account is no longer available. Please contact support if you think this is a mistake.')
      setLoading(false)
      return
    }

    if (accountStatus === 'disabled') {
      localStorage.removeItem('shuttleAddingRole')
      await supabase.auth.signOut()
      setError(
        'Your account has been disabled. Please contact support if you need help.',
      )
      setLoading(false)
      return
    }

    if (accountStatus === 'suspended') {
      localStorage.removeItem('shuttleAddingRole')
      await supabase.auth.signOut()
      setError('Your account is currently suspended. Please contact support if you need help.')
      setLoading(false)
      return
    }

    if (accountStatus !== 'active') {
      localStorage.removeItem('shuttleAddingRole')
      await supabase.auth.signOut()
      setError('Your account is not active right now. Please contact support if you need help.')
      setLoading(false)
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
        `This account already has ${
          role === 'coach' ? 'Coach' : 'Player'
        } access. Please use the Login page instead.`,
      )
      setLoading(false)
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
      console.error(
        'add_current_user_role RPC error:',
        roleError,
      )
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
            ? 'We could not verify your account or add the new role. Reason: the account details could not be confirmed. Please check your details and try again.'
            : 'Could not create your account. This email may already be registered, or there may be a temporary server issue.',
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
        'We sent the verification email again. Please check your Inbox, Spam, Junk, Promotions, and Trash folders.',
      )
    } catch (err) {
      setError(
        getFriendlyAuthMessage(
          err,
          'We could not resend the verification email. Reason: the email service did not complete the request. Please try again in a moment.',
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
        <svg
          viewBox="0 0 20 20"
          fill="none"
          width="18"
          height="18"
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
            style={{
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            A verification link was sent to
            <br />
            <strong style={{ color: '#FFFFFF' }}>
              {verificationEmail}
            </strong>
          </p>

          {error && (
            <div className={styles.error}>{error}</div>
          )}

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
    const pageBackground = isDark
      ? 'radial-gradient(circle at 18% 20%, rgba(26,95,255,0.16), transparent 32%), radial-gradient(circle at 82% 80%, rgba(0,196,140,0.10), transparent 30%), #0D1117'
      : 'radial-gradient(circle at 18% 18%, rgba(26,95,255,0.13), transparent 30%), radial-gradient(circle at 82% 80%, rgba(52,211,153,0.10), transparent 28%), linear-gradient(135deg, #EEF4FF 0%, #F8FBFF 50%, #ECFBF6 100%)'

    const cardBackground = isDark
      ? 'linear-gradient(180deg, rgba(24,30,43,0.98), rgba(20,25,36,0.98))'
      : '#FFFFFF'

    const primaryText = isDark ? '#FFFFFF' : '#172033'
    const secondaryText = isDark ? '#8892A4' : '#667085'
    const mutedText = isDark ? '#6F7B90' : '#7A8699'
    const neutralBorder = isDark ? '#2A3147' : '#DCE3EE'
    const neutralSurface = isDark ? '#1E2535' : '#F7F9FC'

    return (
      <div
        className="register-role-screen"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          boxSizing: 'border-box',
          background: pageBackground,
          overflow: 'hidden',
        }}
      >
        <div
          className="register-role-shell"
          style={{
            width: '100%',
            maxWidth: 1180,
            display: 'grid',
            gridTemplateColumns: '520px 1fr',
            alignItems: 'center',
            gap: 72,
          }}
        >
          {/* LEFT SIDE — REGISTER / ROLE SELECTION */}
          <div
            className="register-role-card"
            style={{
              width: '100%',
              padding: '40px 42px 36px',
              borderRadius: 24,
              background: cardBackground,
              border: isDark
                ? '1px solid rgba(74,85,104,0.55)'
                : '1px solid #DDE5F2',
              boxShadow: isDark
                ? '0 26px 80px rgba(0,0,0,0.45)'
                : '0 26px 70px rgba(30,64,175,0.12)',
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
                    boxShadow:
                      '0 10px 24px rgba(26,95,255,0.24)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                    <circle
                      cx="10"
                      cy="10"
                      r="2"
                      fill="white"
                    />
                  </svg>
                </div>

                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: primaryText,
                  }}
                >
                  ShuttleTrack
                </span>
              </div>

              
            </div>

            <h1
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: primaryText,
                margin: '0 0 6px',
              }}
            >
              Create your account
            </h1>

            <p
              style={{
                fontSize: 13,
                color: secondaryText,
                margin: '0 0 24px',
              }}
            >
              Choose how you will use ShuttleTrack.
            </p>

            {error && (
              <div
                style={{
                  background: isDark
                    ? '#2D1B1B'
                    : '#FEF2F2',
                  color: isDark
                    ? '#F87171'
                    : '#DC2626',
                  border: isDark
                    ? '1px solid #543131'
                    : '1px solid #FECACA',
                  padding: '10px 14px',
                  borderRadius: 10,
                  marginBottom: 16,
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginBottom: 22,
              }}
            >
              {roleOptions.map((option) => {
                const selected = role === option.key

                return (
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
                      gap: 15,
                      padding: '15px 16px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      border: selected
                        ? '2px solid #1A5FFF'
                        : `1.5px solid ${neutralBorder}`,
                      background: selected
                        ? isDark
                          ? 'rgba(26,95,255,0.10)'
                          : 'rgba(26,95,255,0.06)'
                        : neutralSurface,
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        flexShrink: 0,
                        background: selected
                          ? '#1A5FFF'
                          : isDark
                            ? '#283145'
                            : '#EAF0F8',
                        color: selected
                          ? '#FFFFFF'
                          : isDark
                            ? '#8892A4'
                            : '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg
                        width="26"
                        height="26"
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
                          color: primaryText,
                          fontSize: 15,
                          fontWeight: 700,
                          marginBottom: 3,
                        }}
                      >
                        {option.label}
                      </div>

                      <div
                        style={{
                          color: secondaryText,
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
                        border: selected
                          ? 'none'
                          : `2px solid ${
                              isDark
                                ? '#3A4460'
                                : '#C8D2E1'
                            }`,
                        background: selected
                          ? '#1A5FFF'
                          : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {selected && (
                        <span
                          style={{
                            color: '#FFFFFF',
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              disabled={!role}
              onClick={() => {
                if (!role) {
                  setError('Please select your role.')
                  return
                }

                resetMessages()
                resetForm()
                setStep('details')
              }}
              style={{
                width: '100%',
                padding: 14,
                border: 'none',
                borderRadius: 12,
                background:
                  'linear-gradient(90deg, #1A5FFF, #3F7DFF)',
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 700,
                boxShadow:
                  '0 12px 26px rgba(26,95,255,0.22)',
                opacity: role ? 1 : 0.55,
                cursor: role
                  ? 'pointer'
                  : 'not-allowed',
              }}
            >
              Continue →
            </button>

            <p
              style={{
                color: secondaryText,
                textAlign: 'center',
                marginTop: 20,
                marginBottom: 0,
                fontSize: 13,
              }}
            >
              Already have an account?{' '}
              <Link
                to="/login"
                style={{
                  color: '#10B981',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Login
              </Link>
            </p>
          </div>

          {/* RIGHT SIDE — ROLE INTRODUCTION */}
          <section
            className="register-role-intro"
            style={{
              padding: '24px 24px 24px 8px',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
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
              CHOOSE YOUR ROLE
            </div>

            <h2
              style={{
                margin: '0 0 16px',
                maxWidth: 560,
                fontSize: 44,
                lineHeight: 1.08,
                letterSpacing: '-0.035em',
                color: primaryText,
                fontWeight: 700,
              }}
            >
              One system.
              <br />
              Two ways to use it.
            </h2>

            <p
              style={{
                margin: '0 0 28px',
                maxWidth: 570,
                fontSize: 15,
                lineHeight: 1.75,
                color: secondaryText,
              }}
            >
              Select the role that best matches how you want
              to use ShuttleTrack. You can start as a player
              or coach and add another role later when needed.
            </p>

            <div
              style={{
                display: 'grid',
                gap: 14,
                maxWidth: 580,
              }}
            >
              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: 16,
                  background: isDark
                    ? 'rgba(255,255,255,0.035)'
                    : 'rgba(255,255,255,0.62)',
                  border: isDark
                    ? '1px solid rgba(255,255,255,0.07)'
                    : '1px solid rgba(210,220,236,0.72)',
                }}
              >
                <div
                  style={{
                    color: '#1A5FFF',
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 7,
                  }}
                >
                  PLAYER
                </div>

                <div
                  style={{
                    color: primaryText,
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 5,
                  }}
                >
                  Track your own badminton journey
                </div>

                <div
                  style={{
                    color: mutedText,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  Record matches, monitor fitness and
                  performance, review progress, and stay
                  connected with your coach.
                </div>
              </div>

              <div
                style={{
                  padding: '18px 20px',
                  borderRadius: 16,
                  background: isDark
                    ? 'rgba(255,255,255,0.035)'
                    : 'rgba(255,255,255,0.62)',
                  border: isDark
                    ? '1px solid rgba(255,255,255,0.07)'
                    : '1px solid rgba(210,220,236,0.72)',
                }}
              >
                <div
                  style={{
                    color: '#10B981',
                    fontSize: 13,
                    fontWeight: 700,
                    marginBottom: 7,
                  }}
                >
                  COACH
                </div>

                <div
                  style={{
                    color: primaryText,
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 5,
                  }}
                >
                  Manage and support your players
                </div>

                <div
                  style={{
                    color: mutedText,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  Organise players and sessions, follow
                  development, review performance information,
                  and guide progress.
                </div>
              </div>
            </div>
          </section>
        </div>

        <style>
          {`
            @media (max-width: 980px) {
              .register-role-shell {
                grid-template-columns: 1fr !important;
                max-width: 620px !important;
                gap: 30px !important;
              }

              .register-role-intro {
                padding: 8px 8px 20px !important;
                text-align: center;
              }

              .register-role-intro h2,
              .register-role-intro p {
                margin-left: auto !important;
                margin-right: auto !important;
              }
            }

            @media (max-width: 560px) {
              .register-role-screen {
                padding: 16px !important;
              }

              .register-role-card {
                padding: 32px 22px !important;
                border-radius: 20px !important;
              }

              .register-role-intro h2 {
                font-size: 34px !important;
              }
            }
          `}
        </style>
      </div>
    )
  }

  // Account details / Add Role step — same logic, updated UI only
  const detailsPageBackground = isDark
    ? 'radial-gradient(circle at 18% 20%, rgba(26,95,255,0.16), transparent 32%), radial-gradient(circle at 82% 80%, rgba(0,196,140,0.10), transparent 30%), #0D1117'
    : 'radial-gradient(circle at 18% 18%, rgba(26,95,255,0.13), transparent 30%), radial-gradient(circle at 82% 80%, rgba(52,211,153,0.10), transparent 28%), linear-gradient(135deg, #EEF4FF 0%, #F8FBFF 50%, #ECFBF6 100%)'

  const detailsPrimary = isDark ? '#FFFFFF' : '#172033'
  const detailsSecondary = isDark ? '#8892A4' : '#667085'
  const detailsBorder = isDark ? '#2A3147' : '#DCE3EE'
  const detailsSurface = isDark ? '#1E2535' : '#F7F9FC'

  return (
    <div
      className="register-details-screen"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        boxSizing: 'border-box',
        background: detailsPageBackground,
      }}
    >
      <div
        className={`register-details-shell ${
          accountMode === 'existing'
            ? 'register-details-shell-existing'
            : 'register-details-shell-new'
        }`}
        style={{
          width: '100%',
          maxWidth: 1180,
          display: 'grid',
          gridTemplateColumns: '560px 1fr',
          gridTemplateAreas:
            accountMode === 'existing'
              ? '"intro form"'
              : '"form intro"',
          alignItems: 'center',
          gap: 72,
        }}
      >
        {/* LEFT — ACCOUNT FORM */}
        <div
          className="register-details-card"
          style={{
            gridArea: 'form',
            width: '100%',
            padding: '38px 40px 34px',
            borderRadius: 24,
            background: isDark
              ? 'linear-gradient(180deg, rgba(24,30,43,0.98), rgba(20,25,36,0.98))'
              : '#FFFFFF',
            border: isDark
              ? '1px solid rgba(74,85,104,0.55)'
              : '1px solid #DDE5F2',
            boxShadow: isDark
              ? '0 26px 80px rgba(0,0,0,0.45)'
              : '0 26px 70px rgba(30,64,175,0.12)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
              marginBottom: 24,
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
                  boxShadow:
                    '0 10px 24px rgba(26,95,255,0.24)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                  <circle
                    cx="10"
                    cy="10"
                    r="2"
                    fill="white"
                  />
                </svg>
              </div>

              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: detailsPrimary,
                }}
              >
                ShuttleTrack
              </span>
            </div>

            
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 14,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setStep('role')
                resetMessages()
                resetForm()
                setLoading(false)
              }}
              disabled={loading}
              style={{
                background: 'none',
                border: 'none',
                color: detailsSecondary,
                cursor: loading
                  ? 'not-allowed'
                  : 'pointer',
                padding: 0,
                fontSize: 13,
              }}
            >
              ← Back
            </button>

            <span
              style={{
                fontSize: 11,
                background: 'rgba(26,95,255,0.10)',
                color: '#1A5FFF',
                padding: '3px 10px',
                borderRadius: 20,
                fontWeight: 700,
                border:
                  '1px solid rgba(26,95,255,0.20)',
              }}
            >
              {role.charAt(0).toUpperCase() +
                role.slice(1)}
            </span>
          </div>

          <h1
            style={{
              margin: '0 0 6px',
              color: detailsPrimary,
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            {accountMode === 'new'
              ? 'Create Account'
              : `Add ${
                  role === 'coach'
                    ? 'Coach'
                    : 'Player'
                } Access`}
          </h1>

          <p
            style={{
              margin: '0 0 22px',
              color: detailsSecondary,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
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
                resetForm()
                setLoading(false)
              }}
              style={{
                padding: 10,
                borderRadius: 10,
                border:
                  accountMode === 'new'
                    ? '1.5px solid #1A5FFF'
                    : `1px solid ${detailsBorder}`,
                background:
                  accountMode === 'new'
                    ? isDark
                      ? 'rgba(26,95,255,0.14)'
                      : 'rgba(26,95,255,0.08)'
                    : detailsSurface,
                color:
                  accountMode === 'new'
                    ? '#1A5FFF'
                    : detailsPrimary,
                fontWeight: 700,
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
                resetForm()
                setLoading(false)
              }}
              style={{
                padding: 10,
                borderRadius: 10,
                border:
                  accountMode === 'existing'
                    ? '1.5px solid #1A5FFF'
                    : `1px solid ${detailsBorder}`,
                background:
                  accountMode === 'existing'
                    ? isDark
                      ? 'rgba(26,95,255,0.14)'
                      : 'rgba(26,95,255,0.08)'
                    : detailsSurface,
                color:
                  accountMode === 'existing'
                    ? '#1A5FFF'
                    : detailsPrimary,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Add Role
            </button>
          </div>

          {error && (
            <div
              style={{
                background: isDark
                  ? '#2D1B1B'
                  : '#FEF2F2',
                color: isDark
                  ? '#F87171'
                  : '#DC2626',
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
                background: isDark
                  ? '#10251C'
                  : '#ECFDF5',
                color: isDark
                  ? '#34D399'
                  : '#047857',
                border: isDark
                  ? '1px solid #1F4A39'
                  : '1px solid #A7F3D0',
                padding: '10px 14px',
                borderRadius: 10,
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              {success}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            autoComplete="off"
          >
            {accountMode === 'new' && (
              <div className="register-detail-grid">
                <input
                  className="register-detail-input"
                  type="text"
                  placeholder="Full Name"
                  value={form.name}
                  onChange={setField('name')}
                  autoComplete="off"
                  maxLength={MAX_NAME_LENGTH}
                  required
                  disabled={loading}
                />

                <input
                  className="register-detail-input"
                  type="text"
                  placeholder="Username"
                  value={form.username}
                  onChange={setField('username')}
                  autoComplete="off"
                  maxLength={MAX_USERNAME_LENGTH}
                  disabled={loading}
                />
              </div>
            )}

            <div className="register-detail-field">
              <input
                className="register-detail-input"
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={setField('email')}
                autoComplete="off"
                maxLength={MAX_EMAIL_LENGTH}
                required
                disabled={loading}
              />
            </div>

            <div
              className="register-detail-field"
              style={{ position: 'relative' }}
            >
              <input
                className="register-detail-input"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                placeholder={
                  accountMode === 'existing'
                    ? 'Existing account password'
                    : 'Create password'
                }
                value={form.password}
                onChange={setField('password')}
                autoComplete="new-password"
                minLength={
                  accountMode === 'new'
                    ? 8
                    : undefined
                }
                maxLength={MAX_PASSWORD_LENGTH}
                required
                disabled={loading}
                style={{ paddingRight: 44 }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (previous) => !previous,
                  )
                }
                disabled={loading}
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: detailsSecondary,
                  cursor: loading
                    ? 'not-allowed'
                    : 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>

            {accountMode === 'new' && (
              <>
                <PasswordChecklist
                  password={form.password}
                />

                <div
                  className="register-detail-field"
                  style={{ position: 'relative' }}
                >
                  <input
                    className="register-detail-input"
                    type={
                      showConfirm
                        ? 'text'
                        : 'password'
                    }
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
                      setShowConfirm(
                        (previous) => !previous,
                      )
                    }
                    disabled={loading}
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: detailsSecondary,
                      cursor: loading
                        ? 'not-allowed'
                        : 'pointer',
                      padding: 0,
                      display: 'flex',
                    }}
                  >
                    <EyeIcon visible={showConfirm} />
                  </button>
                </div>
              </>
            )}

            {accountMode === 'new' && (
              <div
                style={{
                  margin: '4px 0 16px',
                  padding: 13,
                  borderRadius: 12,
                  border: `1px solid ${detailsBorder}`,
                  background: detailsSurface,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: detailsPrimary,
                    marginBottom: 9,
                  }}
                >
                  Terms, privacy & consent
                </div>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 9,
                    marginBottom: 8,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(event) =>
                      setTermsAccepted(event.target.checked)
                    }
                    disabled={loading}
                    style={{
                      marginTop: 2,
                      accentColor: '#1A5FFF',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      lineHeight: 1.55,
                      color: detailsSecondary,
                    }}
                  >
                    I have read and agree to the{' '}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        setLegalModal('terms')
                      }}
                      style={{
                        border: 0,
                        padding: 0,
                        background: 'none',
                        color: '#1A5FFF',
                        font: 'inherit',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Terms & Conditions
                    </button>
                    .
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 9,
                    marginBottom: 8,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(event) =>
                      setPrivacyAccepted(event.target.checked)
                    }
                    disabled={loading}
                    style={{
                      marginTop: 2,
                      accentColor: '#1A5FFF',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      lineHeight: 1.55,
                      color: detailsSecondary,
                    }}
                  >
                    I have read and understood the{' '}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        setLegalModal('privacy')
                      }}
                      style={{
                        border: 0,
                        padding: 0,
                        background: 'none',
                        color: '#1A5FFF',
                        font: 'inherit',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Privacy Policy
                    </button>
                    .
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 9,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={profileConsentAccepted}
                    onChange={(event) =>
                      setProfileConsentAccepted(event.target.checked)
                    }
                    disabled={loading}
                    style={{
                      marginTop: 2,
                      accentColor: '#1A5FFF',
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      lineHeight: 1.55,
                      color: detailsSecondary,
                    }}
                  >
                    I consent to ShuttleTrack collecting, storing and
                    using my profile information as described in the{' '}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        setLegalModal('consent')
                      }}
                      style={{
                        border: 0,
                        padding: 0,
                        background: 'none',
                        color: '#1A5FFF',
                        font: 'inherit',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Profile Data Consent
                    </button>
                    .
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                (accountMode === 'new' &&
                  (!termsAccepted ||
                    !privacyAccepted ||
                    !profileConsentAccepted))
              }
              style={{
                width: '100%',
                padding: 14,
                border: 'none',
                borderRadius: 12,
                background:
                  'linear-gradient(90deg, #1A5FFF, #3F7DFF)',
                color: '#FFFFFF',
                fontSize: 15,
                fontWeight: 700,
                boxShadow:
                  '0 12px 26px rgba(26,95,255,0.22)',
                opacity:
                  loading ||
                  (accountMode === 'new' &&
                    (!termsAccepted ||
                      !privacyAccepted ||
                      !profileConsentAccepted))
                    ? 0.62
                    : 1,
                cursor:
                  loading ||
                  (accountMode === 'new' &&
                    (!termsAccepted ||
                      !privacyAccepted ||
                      !profileConsentAccepted))
                    ? 'not-allowed'
                    : 'pointer',
              }}
            >
              {loading
                ? accountMode === 'existing'
                  ? 'Verifying account...'
                  : 'Creating account...'
                : accountMode === 'existing'
                  ? `Add ${
                      role === 'coach'
                        ? 'Coach'
                        : 'Player'
                    } Access`
                  : 'Continue Setup'}
            </button>
          </form>

          {accountMode === 'existing' ? (
            <p
              style={{
                color: detailsSecondary,
                textAlign: 'center',
                margin: '18px 0 0',
                fontSize: 13,
              }}
            >
              Forgot the existing password?{' '}
              <Link
                to="/login"
                style={{
                  color: '#10B981',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Reset it from Login
              </Link>
            </p>
          ) : (
            <p
              style={{
                color: detailsSecondary,
                textAlign: 'center',
                margin: '18px 0 0',
                fontSize: 13,
              }}
            >
              Already have an account?{' '}
              <Link
                to="/login"
                style={{
                  color: '#10B981',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                Login
              </Link>
            </p>
          )}
        </div>

        {/* RIGHT — CONTEXT */}
        <section
          className="register-details-intro"
          style={{
            gridArea: 'intro',
            padding:
              accountMode === 'existing'
                ? '24px 8px 24px 24px'
                : '24px 24px 24px 8px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
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
            {role === 'coach'
              ? 'COACH ACCOUNT'
              : 'PLAYER ACCOUNT'}
          </div>

          <h2
            style={{
              margin: '0 0 16px',
              maxWidth: 560,
              fontSize: 44,
              lineHeight: 1.08,
              letterSpacing: '-0.035em',
              color: detailsPrimary,
              fontWeight: 700,
            }}
          >
            {accountMode === 'existing'
              ? 'Already using ShuttleTrack?'
              : role === 'coach'
                ? 'Start managing your players.'
                : 'Start tracking your progress.'}
          </h2>

          <p
            style={{
              margin: 0,
              maxWidth: 570,
              fontSize: 15,
              lineHeight: 1.75,
              color: detailsSecondary,
            }}
          >
            {accountMode === 'existing'
              ? `Add ${role === 'coach' ? 'Coach' : 'Player'} access to your existing account using the same email and password. You do not need to create another account or verify your email again.`
              : role === 'coach'
                ? 'Create your coach account to organise players, manage sessions, review performance information and support player development.'
                : 'Create your player account to record matches, monitor fitness and performance, review progress and connect with your coach.'}
          </p>
        </section>
      </div>

      <LegalModal
        type={legalModal}
        onClose={() => setLegalModal(null)}
        isDark={isDark}
      />

      <style>
        {`
          .register-detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-bottom: 12px;
          }

          .register-detail-field {
            margin-bottom: 12px;
          }

          .register-detail-input {
            width: 100%;
            padding: 13px 14px;
            border-radius: 11px;
            border: ${
              isDark
                ? '1.5px solid #2A3147'
                : '1.5px solid #DCE3EE'
            };
            background: ${
              isDark
                ? '#1E2535'
                : '#F7F9FC'
            };
            color: ${
              isDark
                ? '#FFFFFF'
                : '#172033'
            };
            font-size: 13px;
            outline: none;
            box-sizing: border-box;
          }

          .register-detail-input::placeholder {
            color: ${
              isDark
                ? '#6F7B90'
                : '#98A2B3'
            };
          }

          .register-detail-input:focus {
            border-color: #1A5FFF;
            box-shadow: 0 0 0 4px rgba(26,95,255,0.10);
          }

          @media (max-width: 980px) {
            .register-details-shell {
              grid-template-columns: 1fr !important;
              max-width: 650px !important;
              gap: 30px !important;
            }

            .register-details-intro {
              padding: 8px 8px 20px !important;
              text-align: center;
            }

            .register-details-intro h2,
            .register-details-intro p {
              margin-left: auto !important;
              margin-right: auto !important;
            }
          }

          @media (max-width: 560px) {
            .register-details-screen {
              padding: 16px !important;
            }

            .register-details-card {
              padding: 30px 22px !important;
              border-radius: 20px !important;
            }

            .register-detail-grid {
              grid-template-columns: 1fr;
            }

            .register-details-intro h2 {
              font-size: 34px !important;
            }
          }
        `}
      </style>
    </div>
  )
}
