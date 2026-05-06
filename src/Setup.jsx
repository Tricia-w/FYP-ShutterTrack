import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import styles from './Setup.module.css'

const PRESSURE_OPTIONS = ['Calm', 'Aggressive', 'Careful']

export default function Setup() {
  const { user, profile, saveProfile, loading } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    event: 'Singles',
    style: 'Aggressive Attacker',
    strength: 'Smash Power',
    weakness: 'Defense Under Pressure',
    stamina: 'High',
    pressure: 'Calm',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  const getInitials = (name) => {
    return name
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleFinish = async () => {
    setError('')
    setSaving(true)

    let activeUser = user

    if (!activeUser?.id) {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      activeUser = currentUser
    }

    if (!activeUser?.id) {
      setSaving(false)
      setError('Account is not ready yet. Please refresh or login again.')
      return
    }

    const selectedRole =
      profile?.role ||
      activeUser.user_metadata?.role ||
      localStorage.getItem('selectedRole') ||
      'player'

    const name =
      profile?.name ||
      activeUser.user_metadata?.full_name ||
      activeUser.user_metadata?.name ||
      activeUser.email?.split('@')[0] ||
      'Player'

    const initials = getInitials(name)

    const result = await saveProfile({
      ...form,
      name,
      initials,
      role: selectedRole,
      status: 'active',
    })

    if (!result?.success) {
      setSaving(false)
      setError(result?.error || 'Failed to save setup. Please try again.')
      return
    }

    localStorage.removeItem('selectedRole')
    setSaving(false)

    navigate('/dashboard')
  }

  if (loading) {
    return (
      <div className={styles.screen}>
        <div className={styles.box}>
          <h1 className={styles.title}>Loading account...</h1>
          <p className={styles.sub}>
            Please wait while ShuttleTrack prepares your setup.
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

        <h1 className={styles.title}>New Player Setup</h1>
        <p className={styles.sub}>
          Answer a few questions so the system can create your initial player status
        </p>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(255, 70, 70, 0.12)',
              border: '1px solid rgba(255, 70, 70, 0.3)',
              color: '#ff8a8a',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <div className={styles.grid2}>
          <div>
            <label className={styles.label}>Preferred Event</label>
            <select
              className={styles.select}
              value={form.event}
              onChange={set('event')}
            >
              <option>Singles</option>
              <option>Doubles</option>
              <option>Mixed Doubles</option>
            </select>
          </div>

          <div>
            <label className={styles.label}>How do you usually play?</label>
            <select
              className={styles.select}
              value={form.style}
              onChange={set('style')}
            >
              <option>Aggressive Attacker</option>
              <option>Defensive Player</option>
              <option>All-round Player</option>
              <option>Counter Attacker</option>
              <option>Net Rusher</option>
            </select>
          </div>
        </div>

        <div className={styles.grid2}>
          <div>
            <label className={styles.label}>What is your biggest strength?</label>
            <select
              className={styles.select}
              value={form.strength}
              onChange={set('strength')}
            >
              <option>Smash Power</option>
              <option>Defense</option>
              <option>Footwork</option>
              <option>Net Play</option>
              <option>Consistency</option>
              <option>Serve</option>
            </select>
          </div>

          <div>
            <label className={styles.label}>What is your current weakness?</label>
            <select
              className={styles.select}
              value={form.weakness}
              onChange={set('weakness')}
            >
              <option>Defense Under Pressure</option>
              <option>Footwork</option>
              <option>Net Play</option>
              <option>Smash Accuracy</option>
              <option>Stamina</option>
              <option>Mental Strength</option>
            </select>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>How is your stamina level?</label>
          <select
            className={styles.select}
            value={form.stamina}
            onChange={set('stamina')}
          >
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>How do you react under pressure?</label>

          <div className={styles.pressureBtns}>
            {PRESSURE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                className={`${styles.pressureBtn} ${
                  form.pressure === opt ? styles.pressureActive : ''
                }`}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    pressure: opt,
                  }))
                }
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.preview}>
          Result preview: your answers will generate your initial play style,
          strength summary, weakness summary, and default radar status for first-time setup.
        </div>

        <button
          className={styles.btn}
          onClick={handleFinish}
          disabled={saving}
          style={{ opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving setup...' : 'Finish Setup'}
        </button>
      </div>
    </div>
  )
}