import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import styles from '../Welcome/Auth.module.css'

export default function EmailVerified() {
  const [checking, setChecking] = useState(true)
  const [verified, setVerified] = useState(false)

  // Follow the same theme selected on Login/Register.
  const [isDark] = useState(
    localStorage.getItem('shuttleLoginTheme') === 'dark',
  )

  useEffect(() => {
    let active = true

    async function checkVerification() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (error) {
          console.error(
            'Email verification check error:',
            error,
          )
        }

        if (!active) {
          return
        }

        if (
          user?.id &&
          user?.email_confirmed_at
        ) {
          setVerified(true)
        }
      } catch (error) {
        console.error(
          'Email verification check failed:',
          error,
        )
      } finally {
        if (active) {
          setChecking(false)
        }
      }
    }

    checkVerification()

    return () => {
      active = false
    }
  }, [])

  const screenStyle = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    boxSizing: 'border-box',
    background: isDark
      ? 'radial-gradient(circle at 18% 20%, rgba(26,95,255,0.16), transparent 32%), radial-gradient(circle at 82% 80%, rgba(0,196,140,0.10), transparent 30%), #0D1117'
      : 'radial-gradient(circle at 18% 18%, rgba(26,95,255,0.13), transparent 30%), radial-gradient(circle at 82% 80%, rgba(52,211,153,0.10), transparent 28%), linear-gradient(135deg, #EEF4FF 0%, #F8FBFF 50%, #ECFBF6 100%)',
  }

  const cardStyle = {
    maxWidth: 500,
    textAlign: 'center',
    padding: '42px 42px 38px',
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
  }

  const titleColor =
    isDark ? '#FFFFFF' : '#172033'

  const subColor =
    isDark ? '#8892A4' : '#667085'

  const Logo = () => (
    <div
      className={styles.logo}
      style={{
        justifyContent: 'center',
        marginBottom: 28,
      }}
    >
      <div
        className={styles.logoMark}
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background:
            'linear-gradient(135deg, #1A5FFF, #4C83FF)',
          boxShadow:
            '0 10px 24px rgba(26,95,255,0.30)',
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
        className={styles.logoName}
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: titleColor,
        }}
      >
        ShuttleTrack
      </span>
    </div>
  )

  if (checking) {
    return (
      <div
        className={styles.screen}
        style={screenStyle}
      >
        <div
          className={styles.box}
          style={cardStyle}
        >
          <Logo />

          <h1
            className={styles.title}
            style={{
              fontSize: 30,
              fontWeight: 800,
              margin: '0 0 8px',
              color: titleColor,
            }}
          >
            Checking Email
          </h1>

          <p
            className={styles.sub}
            style={{
              maxWidth: 370,
              margin: '0 auto',
              color: subColor,
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            Confirming your email verification...
          </p>
        </div>
      </div>
    )
  }

  if (!verified) {
    return (
      <div
        className={styles.screen}
        style={screenStyle}
      >
        <div
          className={styles.box}
          style={cardStyle}
        >
          <Logo />

          <div
            style={{
              width: 82,
              height: 82,
              borderRadius: '50%',
              margin: '0 auto 20px',
              background: isDark
                ? 'linear-gradient(180deg, rgba(45,27,27,0.96), rgba(35,22,22,0.96))'
                : '#FEF2F2',
              border: isDark
                ? '1px solid rgba(248,113,113,0.35)'
                : '1px solid #FECACA',
              color: isDark
                ? '#F87171'
                : '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 800,
              boxShadow: isDark
                ? '0 14px 34px rgba(248,113,113,0.10), 0 0 0 8px rgba(248,113,113,0.035)'
                : '0 14px 34px rgba(220,38,38,0.08), 0 0 0 8px rgba(220,38,38,0.03)',
            }}
          >
            !
          </div>

          <h1
            className={styles.title}
            style={{
              fontSize: 30,
              fontWeight: 800,
              margin: '0 0 8px',
              color: titleColor,
            }}
          >
            Verification Unavailable
          </h1>

          <p
            className={styles.sub}
            style={{
              maxWidth: 370,
              margin: '0 auto 24px',
              color: subColor,
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            We could not confirm that your email was verified.
            Please use the verification link sent to your email.
          </p>

          <Link
            to="/login"
            className={styles.btn}
            style={{
              display: 'block',
              width: '100%',
              boxSizing: 'border-box',
              textDecoration: 'none',
              padding: 14,
              borderRadius: 12,
              background:
                'linear-gradient(135deg, #1A5FFF, #3C78FF)',
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: 700,
              boxShadow:
                '0 12px 26px rgba(26,95,255,0.26)',
            }}
          >
            Return to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      className={styles.screen}
      style={screenStyle}
    >
      <div
        className={styles.box}
        style={cardStyle}
      >
        <Logo />

        <div
          style={{
            width: 82,
            height: 82,
            borderRadius: '50%',
            margin: '0 auto 20px',
            background: isDark
              ? 'linear-gradient(180deg, rgba(16,37,28,0.96), rgba(13,31,24,0.96))'
              : '#ECFDF5',
            border: isDark
              ? '1px solid rgba(52,211,153,0.38)'
              : '1px solid #A7F3D0',
            color: isDark
              ? '#34D399'
              : '#047857',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            fontWeight: 800,
            boxShadow: isDark
              ? '0 14px 34px rgba(52,211,153,0.12), 0 0 0 8px rgba(52,211,153,0.04)'
              : '0 14px 34px rgba(16,185,129,0.08), 0 0 0 8px rgba(16,185,129,0.03)',
          }}
        >
          ✓
        </div>

        <h1
          className={styles.title}
          style={{
            fontSize: 30,
            fontWeight: 800,
            margin: '0 0 8px',
            color: titleColor,
          }}
        >
          Email Verified
        </h1>

        <p
          className={styles.sub}
          style={{
            maxWidth: 370,
            margin: '0 auto 24px',
            color: subColor,
            fontSize: 13,
            lineHeight: 1.7,
          }}
        >
          Your email has been verified successfully.
          You can now continue to ShuttleTrack and log in
          to your account.
        </p>

        <div
          style={{
            padding: '12px 14px',
            marginBottom: 18,
            borderRadius: 12,
            background: isDark
              ? 'rgba(52,211,153,0.065)'
              : '#ECFDF5',
            border: isDark
              ? '1px solid rgba(52,211,153,0.16)'
              : '1px solid #A7F3D0',
            color: isDark
              ? '#8EDFC1'
              : '#047857',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          Your account is ready to use.
        </div>

        <Link
          to="/login"
          className={styles.btn}
          style={{
            display: 'block',
            width: '100%',
            boxSizing: 'border-box',
            textDecoration: 'none',
            padding: 14,
            borderRadius: 12,
            background:
              'linear-gradient(135deg, #1A5FFF, #3C78FF)',
            color: '#FFFFFF',
            fontSize: 15,
            fontWeight: 700,
            boxShadow:
              '0 12px 26px rgba(26,95,255,0.26)',
          }}
        >
          Continue to Login
        </Link>
      </div>
    </div>
  )
}