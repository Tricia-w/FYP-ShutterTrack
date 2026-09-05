import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import styles from '../Layout/Pages.module.css'
import Loader from '../Loader/Loader'
import useLoadingDelay from '../Loader/LoadingDelay'

const MONTH_NAMES_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const readBool = (value, fallback = false) => {
  if (value === null || value === undefined) return fallback
  return Boolean(value)
}

const sanitizePhone = value => {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(0, 11)
}

const getSavedTheme = () => {
  if (typeof window === 'undefined') return null

  const savedTheme = localStorage.getItem('shuttleTheme')

  if (savedTheme === 'dark') return true
  if (savedTheme === 'light') return false

  return null
}

const getInitialDarkMode = () => {
  return getSavedTheme() ?? false
}

const getDateKey = value => {
  if (!value) return ''
  return String(value).slice(0, 10)
}

const getCurrentMonthKey = () => {
  const now = new Date()
  return `${MONTH_NAMES_LONG[now.getMonth()]} ${now.getFullYear()}`
}

const getCurrentMonthDateRange = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const toISODate = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`

  return {
    start: toISODate(start),
    end: toISODate(end),
  }
}

const getScheduleStart = row => {
  if (!row?.event_date) return null

  const time = row.event_time ? String(row.event_time).slice(0, 5) : '00:00'
  const parsed = new Date(`${row.event_date}T${time}`)

  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const getScheduleEnd = row => {
  const start = getScheduleStart(row)
  if (!start) return null

  return new Date(start.getTime() + 2 * 60 * 60 * 1000)
}

const formatReminderDateTime = value => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'

  return d.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatRM = value => {
  return `RM ${Number(value || 0).toFixed(2)}`
}

const isMatchSchedule = row => {
  const type = row?.schedule_type || row?.title || ''
  return type === 'Competition' || type === 'Friendly Match'
}

const isTrainingSchedule = row => {
  const type = row?.schedule_type || row?.title || ''
  return type === 'Training'
}

const isValidEmail = value => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export default function Settings() {
  const navigate = useNavigate()
  const { refreshProfile, logout } = useAuth()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
  })

  const [settings, setSettings] = useState({
    darkMode: getInitialDarkMode(),

    matchReminder: true,
    fitnessReminder: true,
    expenseReminder: true,
    coachNoteReminder: true,

    matchBeforeReminder: true,
    matchLogResultReminder: true,

    fitnessBeforeReminder: true,
    fitnessLogAfterReminder: true,

    expenseLogAfterReminder: true,
    expenseBudgetAlert: true,

    soundEnabled: true,
    profilePublic: true,
  })

  const [openCustomize, setOpenCustomize] = useState({
    match: false,
    fitness: false,
    expense: false,
  })

  const [currentBudget, setCurrentBudget] = useState(0)
  const [lastUpdated, setLastUpdated] = useState('—')
  const [loading, setLoading] = useState(true)
  const showLoader = useLoadingDelay(loading, 350)
  const [checkingReminders, setCheckingReminders] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [requestingDelete, setRequestingDelete] = useState(false)
  const [deletionReason, setDeletionReason] = useState('')
  const [loggingOutOtherDevices, setLoggingOutOtherDevices] =
    useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState('')
  const [accountSaveStatus, setAccountSaveStatus] = useState('')
  const [accountSaveError, setAccountSaveError] = useState('')

  const [showEmailModal, setShowEmailModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)
  const [emailChangeMessage, setEmailChangeMessage] = useState('')
  const [emailChangeError, setEmailChangeError] = useState('')

  const accountSaveTimerRef = useRef(null)
  const accountLoadedRef = useRef(false)
  const lastSavedAccountRef = useRef({
    name: '',
    phone: '',
  })

  const fetchSettingsRef = useRef(null)

  useEffect(() => {
    fetchSettingsRef.current = fetchSettings
  })

  useEffect(() => {
    fetchSettingsRef.current?.()
  }, [])

  useEffect(() => {
    const theme = settings.darkMode ? 'dark' : 'light'

    document.documentElement.setAttribute('data-theme', theme)
    document.body.setAttribute('data-theme', theme)
    localStorage.setItem('shuttleTheme', theme)
  }, [settings.darkMode])

  const getAuthUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser()

    if (error || !data?.user) {
      throw new Error('Please login first.')
    }

    return data.user
  }, [])

  const getPlayerProfileId = async userId => {
    const { data, error } = await supabase
      .from('player_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.log(error)
      return null
    }

    return data?.id || null
  }

  const fetchCurrentBudget = async userId => {
    const currentMonthKey = getCurrentMonthKey()

    const { data, error } = await supabase
      .from('expense_budgets')
      .select('budget')
      .eq('user_id', userId)
      .eq('month', currentMonthKey)
      .maybeSingle()

    if (error) {
      console.log(error)
      setCurrentBudget(0)
      return 0
    }

    const budget = Number(data?.budget || 0)
    setCurrentBudget(budget)
    return budget
  }

  const fetchSettings = async () => {
    setLoading(true)

    const { data: userData } = await supabase.auth.getUser()
    const authUser = userData?.user

    if (!authUser) {
      setLoading(false)
      return
    }

    const [
      appUserResult,
      playerProfileResult,
      settingsResult,
    ] = await Promise.all([
      supabase
        .from('app_users')
        .select('full_name, email, updated_at')
        .eq('user_id', authUser.id)
        .maybeSingle(),

      supabase
        .from('player_profiles')
        .select('display_name, updated_at')
        .eq('user_id', authUser.id)
        .maybeSingle(),

      supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle(),
    ])

    if (appUserResult.error) {
      console.log(appUserResult.error)
    }

    if (playerProfileResult.error) {
      console.log(playerProfileResult.error)
    }

    if (settingsResult.error) {
      console.log(settingsResult.error)
    }

    const appUser = appUserResult.data
    const playerProfile = playerProfileResult.data
    const userSettings = settingsResult.data

    await fetchCurrentBudget(authUser.id)

    const loadedForm = {
      name:
        playerProfile?.display_name ||
        appUser?.full_name ||
        authUser.user_metadata?.full_name ||
        '',
      email: authUser.email || appUser?.email || '',
      phone: sanitizePhone(userSettings?.phone),
    }

    setForm(loadedForm)

    lastSavedAccountRef.current = {
      name: loadedForm.name.trim(),
      phone: loadedForm.phone.trim(),
    }

    accountLoadedRef.current = true

    const loadedSettings = {
      darkMode:
        getSavedTheme() ??
        readBool(userSettings?.dark_mode, false),

      matchReminder: readBool(userSettings?.match_reminders, true),
      fitnessReminder: readBool(userSettings?.fitness_reminders, true),
      expenseReminder: readBool(userSettings?.expense_reminders, true),
      coachNoteReminder: readBool(userSettings?.coach_note_reminder, true),

      matchBeforeReminder: readBool(userSettings?.match_before_reminder, true),
      matchLogResultReminder: readBool(
        userSettings?.match_log_result_reminder,
        true
      ),

      fitnessBeforeReminder: readBool(
        userSettings?.fitness_before_reminder,
        true
      ),
      fitnessLogAfterReminder: readBool(
        userSettings?.fitness_log_after_reminder,
        true
      ),

      expenseLogAfterReminder: readBool(
        userSettings?.expense_log_after_reminder,
        true
      ),
      expenseBudgetAlert: readBool(userSettings?.expense_budget_alert, true),

      soundEnabled: readBool(
        userSettings?.notification_sound_enabled,
        true
      ),

      profilePublic: readBool(userSettings?.profile_public, true),
    }

    setSettings(current => ({
      ...loadedSettings,
      darkMode:
        getSavedTheme() ??
        current.darkMode ??
        loadedSettings.darkMode,
    }))

    const latestUpdate =
      userSettings?.updated_at ||
      playerProfile?.updated_at ||
      appUser?.updated_at

    setLastUpdated(
      latestUpdate
        ? new Date(latestUpdate).toLocaleString()
        : '—'
    )

    setLoading(false)

    await runReminderChecks(loadedSettings)
  }

  const createNotification = async ({
    title,
    message,
    type = 'info',
    dedupeKey = null,
  }) => {
    const user = await getAuthUser()

    const payload = {
      user_id: user.id,
      title,
      message,
      type,
    }

    if (dedupeKey) {
      payload.dedupe_key = dedupeKey
    }

    const { error } = await supabase.from('notifications').insert(payload)

    if (error) {
      if (error.code === '23505') return
      console.log(error)
    }
  }

  const checkMatchReminders = async currentSettings => {
    if (!currentSettings.matchReminder) return

    const user = await getAuthUser()
    const profileId = await getPlayerProfileId(user.id)

    const { data: schedules, error: scheduleError } = await supabase
      .from('player_schedule')
      .select('*')
      .eq('user_id', user.id)

    if (scheduleError) {
      console.log(scheduleError)
      return
    }

    let matchLogs = []

    if (profileId) {
      const { data, error } = await supabase
        .from('player_matches')
        .select('id, match_date, result, score1')
        .eq('player_id', profileId)

      if (error) console.log(error)
      matchLogs = data || []
    }

    const now = new Date()

    for (const schedule of schedules || []) {
      if (!isMatchSchedule(schedule)) continue

      const start = getScheduleStart(schedule)
      const end = getScheduleEnd(schedule)
      if (!start || !end) continue

      const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60)
      const endedHoursAgo = (now.getTime() - end.getTime()) / (1000 * 60 * 60)

      const eventDate = getDateKey(schedule.event_date)
      const hasLoggedResult = matchLogs.some(match => {
        return getDateKey(match.match_date) === eventDate
      })

      if (
        currentSettings.matchBeforeReminder &&
        diffHours > 0 &&
        diffHours <= 24
      ) {
        await createNotification({
          title: 'Upcoming Match Reminder',
          message: `${schedule.schedule_type || 'Match'} at ${formatReminderDateTime(
            start
          )}${schedule.location ? `, ${schedule.location}` : ''}.`,
          type: 'info',
          dedupeKey: `match-before-${schedule.id}-${eventDate}`,
        })
      }

      if (
        currentSettings.matchLogResultReminder &&
        endedHoursAgo >= 0 &&
        endedHoursAgo <= 48 &&
        !hasLoggedResult
      ) {
        await createNotification({
          title: 'Log Match Result',
          message: `Don't forget to log your match result for ${formatReminderDateTime(
            start
          )}.`,
          type: 'info',
          dedupeKey: `match-log-result-${schedule.id}-${eventDate}`,
        })
      }
    }
  }

  const checkFitnessReminders = async currentSettings => {
    if (!currentSettings.fitnessReminder) return

    const user = await getAuthUser()

    const [scheduleRes, logRes] = await Promise.all([
      supabase.from('player_schedule').select('*').eq('user_id', user.id),
      supabase.from('fitness_training_logs').select('*').eq('user_id', user.id),
    ])

    if (scheduleRes.error) {
      console.log(scheduleRes.error)
      return
    }

    if (logRes.error) {
      console.log(logRes.error)
      return
    }

    const schedules = scheduleRes.data || []
    const logs = logRes.data || []
    const now = new Date()

    for (const schedule of schedules) {
      if (!isTrainingSchedule(schedule)) continue

      const start = getScheduleStart(schedule)
      const end = getScheduleEnd(schedule)
      if (!start || !end) continue

      const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60)
      const endedHoursAgo = (now.getTime() - end.getTime()) / (1000 * 60 * 60)

      const eventDate = getDateKey(schedule.event_date)
      const hasTrainingLog = logs.some(log => {
        return getDateKey(log.training_date) === eventDate
      })

      if (
        currentSettings.fitnessBeforeReminder &&
        diffHours > 0 &&
        diffHours <= 24
      ) {
        await createNotification({
          title: 'Training Reminder',
          message: `Training starts at ${formatReminderDateTime(start)}${
            schedule.location ? `, ${schedule.location}` : ''
          }.`,
          type: 'info',
          dedupeKey: `fitness-before-${schedule.id}-${eventDate}`,
        })
      }

      if (
        currentSettings.fitnessLogAfterReminder &&
        endedHoursAgo >= 0 &&
        endedHoursAgo <= 24 &&
        !hasTrainingLog
      ) {
        await createNotification({
          title: 'Log Training',
          message: `Don't forget to log your training session for ${formatReminderDateTime(
            start
          )}.`,
          type: 'info',
          dedupeKey: `fitness-log-after-${schedule.id}-${eventDate}`,
        })
      }
    }
  }

  const checkExpenseReminders = async currentSettings => {
    if (!currentSettings.expenseReminder) return

    const user = await getAuthUser()
    const now = new Date()

    const { start, end } = getCurrentMonthDateRange()
    const currentMonthKey = getCurrentMonthKey()

    const [expenseRes, budgetRes, scheduleRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', start)
        .lt('date', end),

      supabase
        .from('expense_budgets')
        .select('budget')
        .eq('user_id', user.id)
        .eq('month', currentMonthKey)
        .maybeSingle(),

      supabase
        .from('player_schedule')
        .select('*')
        .eq('user_id', user.id),
    ])

    if (expenseRes.error) {
      console.log(expenseRes.error)
      return
    }

    if (budgetRes.error) {
      console.log(budgetRes.error)
    }

    if (scheduleRes.error) {
      console.log(scheduleRes.error)
    }

    const expenses = expenseRes.data || []
    const schedules = scheduleRes.data || []
    const budget = Number(budgetRes.data?.budget || 0)

    setCurrentBudget(budget)

    if (currentSettings.expenseLogAfterReminder) {
      const recentEvents = schedules.filter(schedule => {
        const type = schedule.schedule_type || schedule.title || ''

        if (!['Training', 'Competition', 'Friendly Match'].includes(type)) {
          return false
        }

        const endTime = getScheduleEnd(schedule)
        if (!endTime) return false

        const endedHoursAgo =
          (now.getTime() - endTime.getTime()) / (1000 * 60 * 60)

        return endedHoursAgo >= 0 && endedHoursAgo <= 24
      })

      for (const event of recentEvents) {
        const eventDate = getDateKey(event.event_date)

        const hasExpenseForDate = expenses.some(expense => {
          return getDateKey(expense.date) === eventDate
        })

        if (!hasExpenseForDate) {
          await createNotification({
            title: 'Log Expense',
            message:
              'Any court fee, shuttlecock, transport, food, or other badminton expense to log?',
            type: 'info',
            dedupeKey: `expense-log-after-${event.id}-${eventDate}`,
          })
        }
      }
    }

    if (currentSettings.expenseBudgetAlert && budget > 0) {
      const monthlyTotal = expenses.reduce((sum, expense) => {
        return sum + Number(expense.amount || 0)
      }, 0)

      const percentage = (monthlyTotal / budget) * 100

      if (percentage >= 100) {
        await createNotification({
          title: 'Budget Limit Reached',
          message: `You have spent ${formatRM(
            monthlyTotal
          )} this month, which is over your ${formatRM(budget)} monthly budget.`,
          type: 'info',
          dedupeKey: `budget-over-${currentMonthKey}`,
        })
      } else if (percentage >= 80) {
        await createNotification({
          title: 'Budget Alert',
          message: `You have used ${percentage.toFixed(
            0
          )}% of your monthly badminton budget.`,
          type: 'info',
          dedupeKey: `budget-80-${currentMonthKey}`,
        })
      }
    }
  }

  const checkCoachNoteReminders = async currentSettings => {
    if (!currentSettings.coachNoteReminder) return

    const user = await getAuthUser()

    const { data, error } = await supabase
      .from('coach_player_notes')
      .select('*')
      .eq('player_user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.log(error)
      return
    }

    for (const note of data || []) {
      await createNotification({
        title: 'New Coach Note',
        message: 'Your coach left a new note for you.',
        type: 'info',
        dedupeKey: `coach-note-${note.id}`,
      })
    }
  }

  const runReminderChecks = async currentSettings => {
    setCheckingReminders(true)

    try {
      await checkMatchReminders(currentSettings)
      await checkFitnessReminders(currentSettings)
      await checkExpenseReminders(currentSettings)
      await checkCoachNoteReminders(currentSettings)
    } catch (error) {
      console.log(error)
    } finally {
      setCheckingReminders(false)
    }
  }

  const set = key => e => {
    setForm(f => ({ ...f, [key]: e.target.value }))
  }

  const SETTINGS_COLUMN_MAP = {
    darkMode: 'dark_mode',
    matchReminder: 'match_reminders',
    fitnessReminder: 'fitness_reminders',
    expenseReminder: 'expense_reminders',
    coachNoteReminder: 'coach_note_reminder',
    matchBeforeReminder: 'match_before_reminder',
    matchLogResultReminder: 'match_log_result_reminder',
    fitnessBeforeReminder: 'fitness_before_reminder',
    fitnessLogAfterReminder: 'fitness_log_after_reminder',
    expenseLogAfterReminder: 'expense_log_after_reminder',
    expenseBudgetAlert: 'expense_budget_alert',
    soundEnabled: 'notification_sound_enabled',
    profilePublic: 'profile_public',
  }

  const toggle = async key => {
    const nextValue = !settings[key]

    setSettings(current => ({
      ...current,
      [key]: nextValue,
    }))

    if (key === 'darkMode') {
      const theme = nextValue ? 'dark' : 'light'

      document.documentElement.setAttribute('data-theme', theme)
      document.body.setAttribute('data-theme', theme)
      localStorage.setItem('shuttleTheme', theme)
    }

    const column = SETTINGS_COLUMN_MAP[key]

    if (!column) return

    setAutoSaveStatus('Saving...')

    try {
      const user = await getAuthUser()
      const now = new Date().toISOString()

      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            [column]: nextValue,
            updated_at: now,
          },
          { onConflict: 'user_id' }
        )

      if (error) throw error

      if (key === 'soundEnabled') {
        window.dispatchEvent(
          new CustomEvent('notification-sound-updated', {
            detail: {
              enabled: nextValue,
            },
          })
        )
      }

      setLastUpdated(new Date(now).toLocaleString())
      setAutoSaveStatus('Saved automatically')

      if (key === 'profilePublic') {
        const { error: profilePrivacyError } = await supabase
          .from('player_profiles')
          .update({
            profile_public: nextValue,
            updated_at: now,
          })
          .eq('user_id', user.id)

        if (profilePrivacyError) {
          throw profilePrivacyError
        }

        window.dispatchEvent(
          new CustomEvent('profile-visibility-updated', {
            detail: {
              userId: user.id,
              profilePublic: nextValue,
            },
          })
        )
      }

      window.setTimeout(() => {
        setAutoSaveStatus('')
      }, 1800)
    } catch (error) {
      console.error('Auto-save setting error:', error)
      setAutoSaveStatus('Could not save')

      setSettings(current => ({
        ...current,
        [key]: !nextValue,
      }))

      if (key === 'darkMode') {
        const revertedTheme = !nextValue ? 'dark' : 'light'

        document.documentElement.setAttribute('data-theme', revertedTheme)
        document.body.setAttribute('data-theme', revertedTheme)
        localStorage.setItem('shuttleTheme', revertedTheme)
      }
    }
  }

  const saveAccountSettings = useCallback(
    async currentForm => {
      const authUser = await getAuthUser()
      const now = new Date().toISOString()

      const cleanName = currentForm.name.trim()
      const cleanPhone = sanitizePhone(currentForm.phone)

      if (!cleanName) {
        throw new Error('Full name is required.')
      }

      /*
       * The login email remains read-only.
       * Save the player's displayed name to player_profiles so the
       * profile and sidebar remain consistent.
       */
      const { error: playerProfileError } = await supabase
        .from('player_profiles')
        .upsert(
          {
            user_id: authUser.id,
            display_name: cleanName,
            updated_at: now,
          },
          { onConflict: 'user_id' }
        )

      if (playerProfileError) {
        throw playerProfileError
      }

      const { error: settingsError } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: authUser.id,
            phone: cleanPhone || null,
            updated_at: now,
          },
          { onConflict: 'user_id' }
        )

      if (settingsError) {
        throw settingsError
      }

      setLastUpdated(new Date(now).toLocaleString())

      window.dispatchEvent(
        new CustomEvent('profile-updated', {
          detail: {
            display_name: cleanName,
          },
        })
      )

      if (refreshProfile) {
        await refreshProfile()
      }
    },
    [getAuthUser, refreshProfile]
  )

  useEffect(() => {
    if (!accountLoadedRef.current || loading) {
      return undefined
    }

    const normalizedForm = {
      name: form.name.trim(),
      phone: form.phone.trim(),
    }

    const lastSaved = lastSavedAccountRef.current

    const hasAccountChanges =
      normalizedForm.name !== lastSaved.name ||
      normalizedForm.phone !== lastSaved.phone

    /*
     * Do not save when the page first loads.
     * Only save after the user changes the name or phone number.
     */
    if (!hasAccountChanges) {
      setAccountSaveStatus('')
      setAccountSaveError('')
      return undefined
    }

    if (accountSaveTimerRef.current) {
      window.clearTimeout(accountSaveTimerRef.current)
    }

    setAccountSaveStatus('Saving...')
    setAccountSaveError('')

    accountSaveTimerRef.current = window.setTimeout(
      async () => {
        try {
          await saveAccountSettings(form)

          lastSavedAccountRef.current = normalizedForm

          setAccountSaveStatus('Saved automatically')
          setAccountSaveError('')

          window.setTimeout(() => {
            setAccountSaveStatus('')
          }, 1800)
        } catch (error) {
          console.error(
            'Auto-save account error:',
            error
          )

          setAccountSaveStatus('Could not save')
          setAccountSaveError(
            error?.message ||
              error?.details ||
              'The account details could not be saved.'
          )
        }
      },
      700
    )

    return () => {
      if (accountSaveTimerRef.current) {
        window.clearTimeout(accountSaveTimerRef.current)
      }
    }
  }, [form, loading, saveAccountSettings])

  const openEmailChangeModal = () => {
    setNewEmail('')
    setEmailChangeError('')
    setShowEmailModal(true)
  }

  const closeEmailChangeModal = () => {
    if (changingEmail) return

    setShowEmailModal(false)
    setNewEmail('')
    setEmailChangeError('')
  }

  const handleRequestEmailChange = async () => {
    if (changingEmail) return

    const cleanEmail = newEmail.trim().toLowerCase()
    const currentEmail = form.email.trim().toLowerCase()

    setEmailChangeError('')

    if (!cleanEmail) {
      setEmailChangeError('Please enter your new email address.')
      return
    }

    if (!isValidEmail(cleanEmail)) {
      setEmailChangeError('Please enter a valid email address.')
      return
    }

    if (cleanEmail === currentEmail) {
      setEmailChangeError(
        'The new email address must be different from your current email.'
      )
      return
    }

    setChangingEmail(true)
    setEmailChangeMessage('')

    try {
      await getAuthUser()

      const redirectUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${window.location.pathname}`
          : undefined

      const { error } = await supabase.auth.updateUser(
        {
          email: cleanEmail,
        },
        redirectUrl
          ? {
              emailRedirectTo: redirectUrl,
            }
          : undefined
      )

      if (error) throw error

      setShowEmailModal(false)
      setNewEmail('')
      setEmailChangeError('')
      setEmailChangeMessage(
        `Verification sent to ${cleanEmail}. Your current login email will stay active until the required email confirmation is completed.`
      )
    } catch (error) {
      console.error('Change email error:', error)

      setEmailChangeError(
        error?.message ||
          'Unable to send the email change verification.'
      )
    } finally {
      setChangingEmail(false)
    }
  }

  const handleLogout = async () => {
    if (logout) {
      await logout()
    } else {
      await supabase.auth.signOut({
        scope: 'local',
      })
    }

    navigate('/')
  }

  const handleLogoutOtherDevices = async () => {
    if (loggingOutOtherDevices) return

    const confirmed = window.confirm(
      'Log out your account from all other browsers and devices? This browser will stay logged in.'
    )

    if (!confirmed) return

    setLoggingOutOtherDevices(true)

    try {
      const { error } = await supabase.auth.signOut({
        scope: 'others',
      })

      if (error) throw error

      alert(
        'Your account has been logged out from all other browsers and devices. This browser is still logged in.'
      )
    } catch (error) {
      console.error(
        'Logout other devices error:',
        error
      )

      alert(
        error?.message ||
          'Unable to log out the other devices.'
      )
    } finally {
      setLoggingOutOtherDevices(false)
    }
  }

  const handleRequestDeleteAccount = async () => {
    if (requestingDelete) return

    const cleanReason = deletionReason.trim()

    if (!cleanReason) {
      alert('Please enter a reason for requesting account deletion.')
      return
    }

    setRequestingDelete(true)

    try {
      const authUser = await getAuthUser()

      const { error } = await supabase
        .from('account_deletion_requests')
        .insert({
          user_id: authUser.id,
          email: form.email || authUser.email || null,
          full_name: form.name.trim() || null,
          role: 'player',
          reason: cleanReason,
          status: 'pending',
        })

      if (error) {
        if (error.code === '23505') {
          alert('You already have a pending account deletion request.')
          return
        }

        throw error
      }

      setShowDeleteModal(false)
      setDeletionReason('')

      alert(
        'Your account deletion request has been submitted. You can continue using your account while the admin reviews it.'
      )
    } catch (error) {
      console.error('Account deletion request error:', error)
      alert(
        error.message ||
          'Failed to submit account deletion request.'
      )
    } finally {
      setRequestingDelete(false)
    }
  }

  const ToggleSwitch = ({ checked, onChange }) => (
    <button
      type="button"
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

  const SmallButton = ({ children, onClick, danger, solid, disabled }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 32,
        padding: '0 16px',
        borderRadius: 8,
        border: danger ? '1px solid #FDA4AF' : '1px solid var(--line)',
        background: solid ? '#F43F5E' : danger ? '#FFE4E6' : 'var(--card)',
        color: solid ? '#FFFFFF' : danger ? '#F43F5E' : 'var(--text)',
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  )

  const MiniButton = ({ children, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 28,
        padding: '0 10px',
        borderRadius: 8,
        border: '1px solid var(--line)',
        background: 'var(--card)',
        color: 'var(--text)',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )

  const SettingLine = ({ label, checked, onChange, value, action }) => (
    <div className={styles.statRow}>
      <span className={styles.statLabel}>{label}</span>

      <span
        className={styles.statVal}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        {value && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {value}
          </span>
        )}

        {action}

        <ToggleSwitch checked={checked} onChange={onChange} />
      </span>
    </div>
  )

  const CheckLine = ({ label, checked, onChange }) => (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 0',
        color: 'var(--text)',
        fontSize: 14,
        cursor: 'pointer',
      }}
    >
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  )

  const CustomizeBox = ({ children }) => (
    <div
      style={{
        margin: '0 0 12px 0',
        padding: '10px 14px',
        borderRadius: 12,
        border: '1px solid var(--line)',
        background: 'var(--bg)',
      }}
    >
      {children}
    </div>
  )

  if (loading && !showLoader) {
    return null
  }

  if (showLoader) {
    return (
      <div className={styles.card}>
        <Loader text="Loading settings..." />
      </div>
    )
  }

  return (
    <div className={styles.playerReadablePage}>
      <div className={styles.pageHead}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div>
            <div className={styles.pageTitle}>Settings</div>
            <div className={styles.pageSub}>
              Manage account, reminders and privacy settings
            </div>
          </div>


        </div>
      </div>

      {checkingReminders && (
        <div className={styles.card} style={{ marginBottom: 16 }}>
          Checking reminders...
        </div>
      )}

      <div className={styles.g2}>
        <div>
          <div className={styles.card} style={{ marginBottom: 16 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div className={styles.cardTitle}>Account Settings</div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color:
                    accountSaveStatus === 'Could not save'
                      ? '#EF4444'
                      : accountSaveStatus === 'Saving...'
                        ? 'var(--text-muted)'
                        : '#00A878',
                }}
              >
                {accountSaveStatus || 'Changes save automatically'}
              </span>
            </div>

            {accountSaveError && (
              <div
                style={{
                  marginBottom: 12,
                  padding: '9px 11px',
                  borderRadius: 9,
                  border: '1px solid #FECACA',
                  background: '#FEF2F2',
                  color: '#B91C1C',
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {accountSaveError}
              </div>
            )}

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

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <input
                  className={styles.formInput}
                  value={form.email}
                  readOnly
                  title="Current login email"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    opacity: 0.72,
                    cursor: 'not-allowed',
                  }}
                />

                <SmallButton onClick={openEmailChangeModal}>
                  Change Email
                </SmallButton>
              </div>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                }}
              >
                Your current login email stays active until the new email is
                verified.
              </div>

              {emailChangeMessage && (
                <div
                  style={{
                    marginTop: 9,
                    padding: '9px 11px',
                    borderRadius: 9,
                    border: '1px solid #A7F3D0',
                    background: '#ECFDF5',
                    color: '#047857',
                    fontSize: 11,
                    lineHeight: 1.5,
                  }}
                >
                  {emailChangeMessage}
                </div>
              )}
            </div>

            <div className={styles.formRow}>
              <label className={styles.formLabel}>Phone Number</label>
              <input
                className={styles.formInput}
                value={form.phone}
                onChange={event => {
                  const phone = sanitizePhone(event.target.value)
                  setForm(current => ({ ...current, phone }))
                }}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={11}
                autoComplete="tel"
                placeholder="01xxxxxxxxxx"
              />
              <div
                style={{
                  marginTop: 5,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}
              >
                Numbers only, maximum 11 digits.
              </div>
            </div>

            <div className={styles.statRow}>
              <span className={styles.statLabel}>Last updated</span>
              <span className={styles.statVal}>{lastUpdated}</span>
            </div>
          </div>

          <div className={styles.card}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div className={styles.cardTitle}>Appearance</div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}
              >
                Auto-saved
              </span>
            </div>

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
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <div className={styles.cardTitle}>Notifications & Privacy</div>

              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color:
                    autoSaveStatus === 'Could not save'
                      ? '#EF4444'
                      : '#00A878',
                }}
              >
                {autoSaveStatus || 'Changes save automatically'}
              </span>
            </div>

            <SettingLine
              label="Match reminders"
              checked={settings.matchReminder}
              onChange={() => toggle('matchReminder')}
              action={
                settings.matchReminder && (
                  <MiniButton
                    onClick={() =>
                      setOpenCustomize(s => ({ ...s, match: !s.match }))
                    }
                  >
                    Customize {openCustomize.match ? '▲' : '▼'}
                  </MiniButton>
                )
              }
            />

            {settings.matchReminder && openCustomize.match && (
              <CustomizeBox>
                <CheckLine
                  label="Remind before upcoming match"
                  checked={settings.matchBeforeReminder}
                  onChange={() => toggle('matchBeforeReminder')}
                />

                <CheckLine
                  label="Remind me to log match result after match"
                  checked={settings.matchLogResultReminder}
                  onChange={() => toggle('matchLogResultReminder')}
                />
              </CustomizeBox>
            )}

            <SettingLine
              label="Fitness reminders"
              checked={settings.fitnessReminder}
              onChange={() => toggle('fitnessReminder')}
              action={
                settings.fitnessReminder && (
                  <MiniButton
                    onClick={() =>
                      setOpenCustomize(s => ({ ...s, fitness: !s.fitness }))
                    }
                  >
                    Customize {openCustomize.fitness ? '▲' : '▼'}
                  </MiniButton>
                )
              }
            />

            {settings.fitnessReminder && openCustomize.fitness && (
              <CustomizeBox>
                <CheckLine
                  label="Remind training before scheduled training"
                  checked={settings.fitnessBeforeReminder}
                  onChange={() => toggle('fitnessBeforeReminder')}
                />

                <CheckLine
                  label="Remind me to log training after training"
                  checked={settings.fitnessLogAfterReminder}
                  onChange={() => toggle('fitnessLogAfterReminder')}
                />
              </CustomizeBox>
            )}

            <SettingLine
              label="Expense reminders"
              checked={settings.expenseReminder}
              onChange={() => toggle('expenseReminder')}
              action={
                settings.expenseReminder && (
                  <MiniButton
                    onClick={() =>
                      setOpenCustomize(s => ({ ...s, expense: !s.expense }))
                    }
                  >
                    Customize {openCustomize.expense ? '▲' : '▼'}
                  </MiniButton>
                )
              }
            />

            {settings.expenseReminder && openCustomize.expense && (
              <CustomizeBox>
                <CheckLine
                  label="Remind me to log expense after match/training"
                  checked={settings.expenseLogAfterReminder}
                  onChange={() => toggle('expenseLogAfterReminder')}
                />

                <CheckLine
                  label="Budget limit alert"
                  checked={settings.expenseBudgetAlert}
                  onChange={() => toggle('expenseBudgetAlert')}
                />

                {settings.expenseBudgetAlert && (
                  <div
                    style={{
                      marginTop: 10,
                      marginBottom: 8,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'var(--card)',
                      border: '1px solid var(--line)',
                      color: 'var(--text-muted)',
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    Current monthly budget: <b>{formatRM(currentBudget)}</b>
                    <br />
                    Budget amount is managed in Expense Tracker. This setting
                    only controls whether budget alert notifications are enabled.
                  </div>
                )}
              </CustomizeBox>
            )}

            <SettingLine
              label="Coach note reminders"
              checked={settings.coachNoteReminder}
              onChange={() => toggle('coachNoteReminder')}
            />

            <SettingLine
              label="Notification sound"
              checked={settings.soundEnabled}
              onChange={() => toggle('soundEnabled')}
            />

            <SettingLine
              label="Profile visibility public"
              checked={settings.profilePublic}
              onChange={() => toggle('profilePublic')}
            />
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Data & Security</div>

            <div
              style={{
                marginTop: 12,
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--bg)',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--text)',
                }}
              >
                Active login sessions
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--text-muted)',
                }}
              >
                Log out your account from other browsers and devices while
                keeping this browser logged in.
              </div>

              <div style={{ marginTop: 10 }}>
                <SmallButton
                  onClick={handleLogoutOtherDevices}
                  disabled={loggingOutOtherDevices}
                >
                  {loggingOutOtherDevices
                    ? 'Logging Out Other Devices...'
                    : 'Log Out Other Devices'}
                </SmallButton>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 14,
                flexWrap: 'wrap',
              }}
            >
              <SmallButton onClick={handleLogout}>
                Log Out This Device
              </SmallButton>

              <SmallButton
                danger
                onClick={() => {
                  setDeletionReason('')
                  setShowDeleteModal(true)
                }}
              >
                Request Account Deletion
              </SmallButton>
            </div>
          </div>
        </div>
      </div>

      {showEmailModal && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (
              event.target === event.currentTarget &&
              !changingEmail
            ) {
              closeEmailChangeModal()
            }
          }}
        >
          <div className={styles.modal} style={{ maxWidth: 480 }}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Change Login Email</div>

              <button
                type="button"
                className={styles.modalClose}
                onClick={closeEmailChangeModal}
                disabled={changingEmail}
              >
                ✕
              </button>
            </div>

            <p
              style={{
                color: 'var(--text-muted)',
                lineHeight: 1.6,
              }}
            >
              Enter your new email address. Supabase will send the required
              confirmation email before changing your login email.
            </p>

            <div style={{ marginTop: 14 }}>
              <label
                className={styles.formLabel}
                htmlFor="player-new-login-email"
              >
                New Email Address
              </label>

              <input
                id="player-new-login-email"
                type="email"
                className={styles.formInput}
                value={newEmail}
                onChange={event => {
                  setNewEmail(event.target.value)
                  setEmailChangeError('')
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    handleRequestEmailChange()
                  }
                }}
                placeholder="newemail@example.com"
                autoComplete="email"
                disabled={changingEmail}
                autoFocus
              />
            </div>

            {emailChangeError && (
              <div
                style={{
                  marginTop: 10,
                  padding: '9px 11px',
                  borderRadius: 9,
                  border: '1px solid #FECACA',
                  background: '#FEF2F2',
                  color: '#B91C1C',
                  fontSize: 11,
                  lineHeight: 1.5,
                }}
              >
                {emailChangeError}
              </div>
            )}

            <div
              style={{
                marginTop: 12,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--text-muted)',
                fontSize: 12,
                lineHeight: 1.55,
              }}
            >
              Current email: <b>{form.email}</b>
              <br />
              Your account will continue using this email until verification is
              completed.
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 18,
                flexWrap: 'wrap',
              }}
            >
              <SmallButton
                onClick={closeEmailChangeModal}
                disabled={changingEmail}
              >
                Cancel
              </SmallButton>

              <button
                type="button"
                onClick={handleRequestEmailChange}
                disabled={changingEmail}
                style={{
                  height: 32,
                  padding: '0 16px',
                  borderRadius: 8,
                  border: '1px solid #1A5FFF',
                  background: '#1A5FFF',
                  color: '#FFFFFF',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: changingEmail ? 'not-allowed' : 'pointer',
                  opacity: changingEmail ? 0.65 : 1,
                }}
              >
                {changingEmail
                  ? 'Sending Verification...'
                  : 'Send Verification Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div
          className={styles.modalOverlay}
          onClick={event => {
            if (
              event.target === event.currentTarget &&
              !requestingDelete
            ) {
              setShowDeleteModal(false)
              setDeletionReason('')
            }
          }}
        >
          <div className={styles.modal} style={{ maxWidth: 480 }}>
            <div className={styles.modalHead}>
              <div className={styles.modalTitle}>Request Account Deletion</div>

              <button
                className={styles.modalClose}
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletionReason('')
                }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              This will send an account deletion request to the admin. Your
              account will not be deleted immediately.
            </p>

            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              You will remain logged in and can continue using your account
              while the admin reviews your request.
            </p>

            <div style={{ marginTop: 14 }}>
              <label
                className={styles.formLabel}
                htmlFor="player-deletion-reason"
              >
                Reason for deletion
              </label>

              <textarea
                id="player-deletion-reason"
                className={styles.formInput}
                rows={4}
                maxLength={500}
                value={deletionReason}
                onChange={event => setDeletionReason(event.target.value)}
                placeholder="Please explain why you want to delete your account."
                disabled={requestingDelete}
                style={{
                  width: '100%',
                  minHeight: 96,
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                }}
              />

              <div
                style={{
                  marginTop: 5,
                  textAlign: 'right',
                  color: 'var(--text-muted)',
                  fontSize: 11,
                }}
              >
                {deletionReason.length}/500
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 18,
              }}
            >
              <SmallButton
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletionReason('')
                }}
                disabled={requestingDelete}
              >
                Cancel
              </SmallButton>

              <SmallButton
                solid
                danger
                onClick={handleRequestDeleteAccount}
                disabled={requestingDelete}
              >
                {requestingDelete ? 'Submitting...' : 'Submit Request'}
              </SmallButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
