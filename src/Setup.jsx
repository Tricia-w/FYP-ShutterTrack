import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import styles from './Setup.module.css'

const PRESSURE_OPTIONS = ['Calm', 'Aggressive', 'Careful']

export default function Setup() {
  const { user, loading } = useAuth()
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

  const set = (key) => (e) => {
    setForm((prev) => ({
      ...prev,
      [key]: e.target.value,
    }))
  }

  async function handleFinish() {
    setError('')
    setSaving(true)

    try {
      let activeUser = user

      if (!activeUser?.id) {
        const {
          data: { user: currentUser },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          throw userError
        }

        activeUser = currentUser
      }

      if (!activeUser?.id) {
        setError('Account is not ready yet. Please refresh or login again.')
        setSaving(false)
        return
      }

      const { error: setupError } = await supabase
        .from('player_setup')
        .upsert({
          user_id: activeUser.id,
          preferred_event: form.event,
          play_style: form.style,
          biggest_strength: form.strength,
          current_weakness: form.weakness,
          stamina_level: form.stamina,
          pressure_reaction: form.pressure,
        })

      if (setupError) {
        throw setupError
      }

      const { error: updateError } = await supabase
        .from('app_users')
        .update({
          setup_completed: true,
        })
        .eq('user_id', activeUser.id)

      if (updateError) {
        throw updateError
      }

      setSaving(false)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to save setup. Please try again.')
      setSaving(false)
    }
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
              <option>All-Round Player</option>
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
              <option>Net Play</option>
              <option>Footwork</option>
              <option>Endurance</option>
              <option>Drop Shots</option>
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
              <option>Net Play</option>
              <option>Footwork</option>
              <option>Stamina</option>
              <option>Backhand</option>
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
            {PRESSURE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`${styles.pressureBtn} ${
                  form.pressure === option ? styles.pressureActive : ''
                }`}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    pressure: option,
                  }))
                }
              >
                {option}
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