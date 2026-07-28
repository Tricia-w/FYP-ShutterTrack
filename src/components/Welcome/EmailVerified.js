import { Link } from 'react-router-dom'
import styles from '../Welcome/Auth.module.css'

export default function EmailVerified() {
  return (
    <div className={styles.screen}>
      <div
        className={styles.box}
        style={{
          maxWidth: 500,
          textAlign: 'center',
          padding: '42px 42px 38px',
          borderRadius: 24,
          background:
            'linear-gradient(180deg, rgba(24,30,43,0.98), rgba(20,25,36,0.98))',
          border: '1px solid rgba(74,85,104,0.55)',
          boxShadow:
            '0 26px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.015) inset',
        }}
      >
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
            }}
          >
            ShuttleTrack
          </span>
        </div>

        <div
          style={{
            width: 82,
            height: 82,
            borderRadius: '50%',
            margin: '0 auto 20px',
            background:
              'linear-gradient(180deg, rgba(16,37,28,0.96), rgba(13,31,24,0.96))',
            border: '1px solid rgba(52,211,153,0.38)',
            color: '#34D399',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 38,
            fontWeight: 800,
            boxShadow:
              '0 14px 34px rgba(52,211,153,0.12), 0 0 0 8px rgba(52,211,153,0.04)',
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
          }}
        >
          Email Verified
        </h1>

        <p
          className={styles.sub}
          style={{
            maxWidth: 370,
            margin: '0 auto 24px',
            color: '#8892A4',
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
            background: 'rgba(52,211,153,0.065)',
            border: '1px solid rgba(52,211,153,0.16)',
            color: '#8EDFC1',
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