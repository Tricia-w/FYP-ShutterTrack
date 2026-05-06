import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import styles from './Pages.module.css'

export default function Settings() {
  const navigate = useNavigate()
  const { user, saveProfile, logout } = useAuth()

  const [form, setForm] = useState({
    name: user?.name || 'Demo Player',
    email: user?.email || 'player@demo.com',
    phone: user?.phone || '016-0000000',
  })

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('playerSettings')
    const savedTheme = localStorage.getItem('shuttleTheme') || 'light'

    return saved
      ? {
          ...JSON.parse(saved),
          darkMode: savedTheme === 'dark',
        }
      : {
          darkMode: savedTheme === 'dark',
          matchReminder: true,
          fitnessReminder: true,
          expenseReminder: false,
          profilePublic: true,
          dataBackup: true,
        }
  })

  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    const theme = settings.darkMode ? 'dark' : 'light'

    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('shuttleTheme', theme)
    localStorage.setItem('playerSettings', JSON.stringify(settings))
  }, [settings])

  const set = key => e => {
    setForm(f => ({ ...f, [key]: e.target.value }))
  }

  const toggle = key => {
    setSettings(s => ({ ...s, [key]: !s[key] }))
  }

  const handleSaveAccount = () => {
    saveProfile?.({
      ...user,
      name: form.name,
      email: form.email,
      phone: form.phone,
    })

    alert('Settings saved successfully.')
  }

  const handleLogout = () => {
    if (logout) logout()
    navigate('/')
  }

  const handleDeleteAccount = () => {
    setShowDeleteModal(false)
    alert('Delete account function can be connected to backend later.')
  }

  const ToggleSwitch = ({ checked, onChange }) => (
    <button
      onClick={onChange}
      style={{
        width: 46,
        height: 24,
        borderRadius: 999,
        border: 'none',
        padding: 3,
        cursor: 'pointer',
        background: checked ? '#0D1B3E' : '#CBD5E1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
        transition: '0.2s ease',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#FFFFFF',
          display: 'block',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        }}
      />
    </button>
  )

  const SettingLine = ({ label, checked, onChange, value }) => (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>

      <span
        className={styles.statVal}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {value && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {value}
          </span>
        )}

        <ToggleSwitch checked={checked} onChange={onChange} />
      </span>
    </div>
  )

  const SmallButton = ({ children, onClick, danger, solid }) => (
    <button
      onClick={onClick}
      style={{
        height: 32,
        padding: '0 16px',
        borderRadius: 8,
        border: danger ? '1px solid #FDA4AF' : '1px solid var(--line)',
        background: solid
          ? '#F43F5E'
          : danger
          ? '#FFE4E6'
          : 'var(--card)',
        color: solid ? '#FFFFFF' : danger ? '#F43F5E' : 'var(--text)',
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )

  return (
    <div>
      <div className={styles.pageHead}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div className={styles.pageTitle}>Settings</div>
            <div className={styles.pageSub}>
              Manage account, reminders and privacy settings
            </div>
          </div>

          <button className={styles.btnPrimary} onClick={handleSaveAccount}>
            Save Changes
          </button>
        </div>
      </div>

      <div className={styles.g2}>
        <div>
          <div className={styles.card} style={{ marginBottom: 16 }}>
            <div className={styles.cardTitle}>Account Settings</div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Full Name</label>
              <input
                className={styles.formInput}
                value={form.name}
                onChange={set('name')}
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Email Address</label>
              <input
                className={styles.formInput}
                value={form.email}
                onChange={set('email')}
              />
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Phone Number</label>
              <input
                className={styles.formInput}
                value={form.phone}
                onChange={set('phone')}
              />
            </div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Last updated</span>
              <span className={styles.statVal}>14 Apr 2026, 8:30 PM</span>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Appearance</div>

            <SettingLine
              label="Dark mode"
              value={settings.darkMode ? 'On' : 'Off'}
              checked={settings.darkMode}
              onChange={() => toggle('darkMode')}
            />

            <div style={{ marginTop: 12 }}>
              <span className={styles.badgeBlue}>
                Current mode: {settings.darkMode ? 'Dark' : 'Light'}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className={styles.card} style={{ marginBottom: 16 }}>
            <div className={styles.cardTitle}>Notifications & Privacy</div>

            <SettingLine
              label="Match reminders"
              checked={settings.matchReminder}
              onChange={() => toggle('matchReminder')}
            />

            <SettingLine
              label="Fitness reminders"
              checked={settings.fitnessReminder}
              onChange={() => toggle('fitnessReminder')}
            />

            <SettingLine
              label="Expense reminders"
              checked={settings.expenseReminder}
              onChange={() => toggle('expenseReminder')}
            />

            <SettingLine
              label="Profile visibility public"
              checked={settings.profilePublic}
              onChange={() => toggle('profilePublic')}
            />
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Data & Security</div>

            <SettingLine
              label="Automatic data backup"
              checked={settings.dataBackup}
              onChange={() => toggle('dataBackup')}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 12,
              }}
            >
              <SmallButton onClick={handleLogout}>Log Out</SmallButton>

              <SmallButton danger onClick={() => setShowDeleteModal(true)}>
                Delete Account
              </SmallButton>
            </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div
          className={styles.modalOverlay}
          onClick={e =>
            e.target === e.currentTarget && setShowDeleteModal(false)
          }
        >
          <div className={styles.modal} style={{ maxWidth: 460 }}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Delete Account</div>

              <button
                className={styles.modalClose}
                onClick={() => setShowDeleteModal(false)}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              This action will remove the user account from the system. This
              function can be connected to backend later.
            </p>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 18,
              }}
            >
              <SmallButton onClick={() => setShowDeleteModal(false)}>
                Cancel
              </SmallButton>

              <SmallButton solid danger onClick={handleDeleteAccount}>
                Confirm Delete
              </SmallButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}