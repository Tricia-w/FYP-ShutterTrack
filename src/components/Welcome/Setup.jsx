import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import styles from './Setup.module.css'

const PRESSURE_OPTIONS = ['Calm', 'Aggressive', 'Careful']

export default function Setup() {
  const { user, loading, saveProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // If user comes from Profile page, go back to Profile.
  // If user comes from login/register, go to Dashboard.
  const returnTo = location.state?.returnTo || '/dashboard'

  const [form, setForm] = useState({
    event: 'Singles',
    style: 'Aggressive Attacker',
    strength: 'Smash Power',
    weakness: 'Defense Under Pressure',
    stamina: 'High',
    pressure: 'Calm',
  })

  const [saving, setSaving] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [loadingSetup, setLoadingSetup] = useState(true)
  const [error, setError] = useState('')

  // Same theme preference used by Login / Register.
  const [isDark, setIsDark] = useState(
    localStorage.getItem('shuttleLoginTheme') === 'dark',
  )

  const busy = saving || skipping || loadingSetup

  useEffect(() => {
    let mounted = true

    async function loadExistingSetup() {
      try {
        const activeUser =
          user?.id
            ? user
            : (await supabase.auth.getUser()).data?.user

        if (!activeUser?.id) {
          if (mounted) setLoadingSetup(false)
          return
        }

        const { data, error: loadError } = await supabase
          .from('player_setup')
          .select('*')
          .eq('user_id', activeUser.id)
          .maybeSingle()

        if (loadError) {
          throw loadError
        }

        if (mounted && data) {
          setForm({
            event:
              data.preferred_event ||
              'Singles',
            style:
              data.play_style ||
              'Aggressive Attacker',
            strength:
              data.biggest_strength ||
              'Smash Power',
            weakness:
              data.biggest_weakness ||
              data.current_weakness ||
              data.weakness ||
              'Defense Under Pressure',
            stamina:
              data.stamina_level ||
              'High',
            pressure:
              data.under_pressure ||
              data.pressure_reaction ||
              data.player_type ||
              data.mindset ||
              'Calm',
          })
        }
      } catch (loadError) {
        console.error('Load existing setup error:', loadError)

        if (mounted) {
          setError(
            loadError.message ||
              'Unable to load your previous setup.'
          )
        }
      } finally {
        if (mounted) {
          setLoadingSetup(false)
        }
      }
    }

    loadExistingSetup()

    return () => {
      mounted = false
    }
  }, [user])

  const set = (key) => (e) => {
    setForm((prev) => ({
      ...prev,
      [key]: e.target.value,
    }))
  }

  async function getActiveUser() {
    if (user?.id) {
      return user
    }

    const {
      data: { user: currentUser },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      throw userError
    }

    return currentUser
  }

  async function handleFinish() {
    setError('')
    setSaving(true)

    try {
      const activeUser = await getActiveUser()

      if (!activeUser?.id) {
        throw new Error('Account is not ready yet. Please refresh or login again.')
      }

      const { error: setupError } = await supabase
        .from('player_setup')
        .upsert(
          {
            user_id: activeUser.id,
            preferred_event: form.event,
            play_style: form.style,
            biggest_strength: form.strength,
            current_weakness: form.weakness,
            stamina_level: form.stamina,
            pressure_reaction: form.pressure,
          },
          {
            onConflict: 'user_id',
          }
        )

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

      saveProfile?.({
        ...user,
        event: form.event,
        style: form.style,
        strength: form.strength,
        weakness: form.weakness,
        stamina: form.stamina,
        pressure: form.pressure,
        playerType: form.pressure,
        reaction: form.pressure,
        underPressure: form.pressure,
        setup_completed: true,
      })

      navigate(returnTo, { replace: true })
    } catch (err) {
      setError(err.message || 'Failed to save setup. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSkip() {
    setError('')
    setSkipping(true)

    try {
      const activeUser = await getActiveUser()

      if (!activeUser?.id) {
        throw new Error(
          'Account is not ready yet. Please refresh or login again.'
        )
      }

      /*
        Mark onboarding as finished even when the player skips.
        No player_setup row is created, so the player can complete
        the setup later from the Profile page.
      */
      const { error: completeSetupError } = await supabase.rpc(
        'complete_player_setup'
      )

      if (completeSetupError) {
        console.error(
          'Skip setup completion RPC error:',
          completeSetupError
        )
        throw new Error(
          'Unable to skip setup right now. Please try again.'
        )
      }

      saveProfile?.({
        ...user,
        setup_completed: true,
      })

      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Skip player setup error:', err)
      setError(err.message || 'Failed to skip setup. Please try again.')
    } finally {
      setSkipping(false)
    }
  }

  const screenStyle = {
    background: isDark
      ? undefined
      : 'radial-gradient(circle at 18% 18%, rgba(26,95,255,0.13), transparent 30%), radial-gradient(circle at 82% 80%, rgba(52,211,153,0.10), transparent 28%), linear-gradient(135deg, #EEF4FF 0%, #F8FBFF 50%, #ECFBF6 100%)',
  }

  const boxStyle = {
    background: isDark ? undefined : '#FFFFFF',
    border: isDark ? undefined : '1px solid #DDE5F2',
    boxShadow: isDark
      ? undefined
      : '0 26px 70px rgba(30,64,175,0.12)',
  }

  const titleStyle = {
    color: isDark ? undefined : '#172033',
  }

  const subStyle = {
    color: isDark ? undefined : '#667085',
  }

  const labelStyle = {
    color: isDark ? undefined : '#5F6B7A',
  }

  const selectStyle = {
    // Use backgroundColor instead of the background shorthand.
    // The CSS module uses a background-image for the select arrow,
    // and `background` was removing that image in light mode.
    backgroundColor: isDark ? undefined : '#F7F9FC',
    border: isDark ? undefined : '1.5px solid #DCE3EE',
    color: isDark ? undefined : '#172033',
  }

  if (loading || loadingSetup) {
    return (
      <div className={styles.screen} style={screenStyle}>
        <div className={styles.box} style={boxStyle}>
          <h1 className={styles.title} style={titleStyle}>
            Loading account...
          </h1>
          <p className={styles.sub} style={subStyle}>
            Please wait while ShuttleTrack prepares your setup.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.screen} style={screenStyle}>
      <div className={styles.box} style={boxStyle}>
        {/* Logo + theme switch. Layout remains the same. */}
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
            className={styles.logo}
            style={{ marginBottom: 0 }}
          >
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

            <span
              className={styles.logoName}
              style={{
                color: isDark ? undefined : '#172033',
              }}
            >
              ShuttleTrack
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const next = !isDark
              setIsDark(next)

              localStorage.setItem(
                'shuttleLoginTheme',
                next ? 'dark' : 'light',
              )
            }}
            aria-label={
              isDark ? 'Switch to light mode' : 'Switch to dark mode'
            }
            title={
              isDark ? 'Switch to light mode' : 'Switch to dark mode'
            }
            style={{
              width: 46,
              height: 26,
              borderRadius: 999,
              border: isDark
                ? '1px solid #3A455E'
                : '1px solid #D6DEEA',
              background: isDark ? '#263047' : '#EEF2F7',
              padding: 3,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isDark ? 'flex-end' : 'flex-start',
              transition:
                'background 0.2s ease, border-color 0.2s ease',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: isDark ? '#0D1117' : '#FFFFFF',
                boxShadow: '0 2px 7px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                lineHeight: 1,
              }}
            >
              {isDark ? '🌙' : '☀️'}
            </span>
          </button>
        </div>

        <h1 className={styles.title} style={titleStyle}>
          {location.search.includes('redo=1')
            ? 'Update Player Setup'
            : 'New Player Setup'}
        </h1>

        <p className={styles.sub} style={subStyle}>
          Answer a few questions so the system can create your initial player status.
        </p>

        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              borderRadius: 12,
              background: isDark
                ? 'rgba(255, 70, 70, 0.12)'
                : '#FEF2F2',
              border: isDark
                ? '1px solid rgba(255, 70, 70, 0.3)'
                : '1px solid #FECACA',
              color: isDark ? '#ff8a8a' : '#DC2626',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <div className={styles.grid2}>
          <div>
            <label className={styles.label} style={labelStyle}>
              Preferred Event
            </label>

            <select
              className={styles.select}
              style={selectStyle}
              value={form.event}
              onChange={set('event')}
              disabled={busy}
            >
              <option>Singles</option>
              <option>Doubles</option>
              <option>Mixed Doubles</option>
            </select>
          </div>

          <div>
            <label className={styles.label} style={labelStyle}>
              How do you usually play?
            </label>

            <select
              className={styles.select}
              style={selectStyle}
              value={form.style}
              onChange={set('style')}
              disabled={busy}
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
            <label className={styles.label} style={labelStyle}>
              What is your biggest strength?
            </label>

            <select
              className={styles.select}
              style={selectStyle}
              value={form.strength}
              onChange={set('strength')}
              disabled={busy}
            >
              <option>Smash Power</option>
              <option>Net Play</option>
              <option>Footwork</option>
              <option>Endurance</option>
              <option>Drop Shots</option>
            </select>
          </div>

          <div>
            <label className={styles.label} style={labelStyle}>
              What is your current weakness?
            </label>

            <select
              className={styles.select}
              style={selectStyle}
              value={form.weakness}
              onChange={set('weakness')}
              disabled={busy}
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
          <label className={styles.label} style={labelStyle}>
            How is your stamina level?
          </label>

          <select
            className={styles.select}
            style={selectStyle}
            value={form.stamina}
            onChange={set('stamina')}
            disabled={busy}
          >
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} style={labelStyle}>
            How do you react under pressure?
          </label>

          <div className={styles.pressureBtns}>
            {PRESSURE_OPTIONS.map((option) => {
              const active = form.pressure === option

              return (
                <button
                  key={option}
                  type="button"
                  disabled={busy}
                  className={`${styles.pressureBtn} ${
                    active ? styles.pressureActive : ''
                  }`}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      pressure: option,
                    }))
                  }
                  style={
                    isDark
                      ? undefined
                      : {
                          background: active
                            ? 'rgba(26,95,255,0.08)'
                            : '#F7F9FC',
                          border: active
                            ? '1.5px solid #1A5FFF'
                            : '1px solid #DCE3EE',
                          color: active
                            ? '#1A5FFF'
                            : '#5F6B7A',
                        }
                  }
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>

        <div
          className={styles.preview}
          style={
            isDark
              ? undefined
              : {
                  background: '#F4F7FF',
                  border: '1px solid #DDE6FB',
                  color: '#667085',
                }
          }
        >
          Result preview: your answers will generate your initial play style,
          strength summary, weakness summary, and default radar status for first-time setup.
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            marginTop: 18,
          }}
        >
          <button
            type="button"
            className={styles.btn}
            onClick={handleFinish}
            disabled={busy}
            style={{
              opacity: busy ? 0.7 : 1,
              flex: 1,
            }}
          >
            {saving
              ? 'Saving setup...'
              : location.search.includes('redo=1')
                ? 'Save Changes'
                : 'Finish Setup'}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            disabled={busy}
            style={{
              flex: 1,
              border: isDark
                ? '1px solid rgba(255, 255, 255, 0.18)'
                : '1px solid #DCE3EE',
              borderRadius: 14,
              background: isDark
                ? 'rgba(255, 255, 255, 0.08)'
                : '#F7F9FC',
              color: isDark ? '#ffffff' : '#172033',
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.7 : 1,
            }}
          >
            {skipping ? 'Skipping...' : 'Set Up Later'}
          </button>
        </div>
      </div>
    </div>
  )
}
