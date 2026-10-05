import { supabase } from './supabaseClient'

const GOOGLE_CALENDAR_SCOPE =
  'openid email https://www.googleapis.com/auth/calendar.events'

let accessToken = ''
let tokenClient = null

const SUPABASE_URL =
  String(
    process.env.REACT_APP_SUPABASE_URL || ''
  ).replace(/\/$/, '')

const SUPABASE_ANON_KEY =
  String(
    process.env.REACT_APP_SUPABASE_ANON_KEY || ''
  )

const GOOGLE_OAUTH_FUNCTION_URL =
  `${SUPABASE_URL}/functions/v1/google-calendar-oauth`

export function isGoogleCalendarConnected() {
  return Boolean(accessToken)
}

/*
 * New server-side OAuth connection flow.
 * Sends BOTH:
 * - Authorization: Bearer <signed-in ShuttleTrack user's access token>
 * - apikey: Supabase anon key
 *
 * This avoids the "Missing authorization header" error from the
 * Edge Function gateway.
 */
export async function connectGoogleCalendar() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY
  ) {
    throw new Error(
      'Supabase environment variables are missing.'
    )
  }

  const {
    data,
    error,
  } =
    await supabase.auth.getSession()

  if (error) {
    throw error
  }

  const session =
    data?.session

  const userToken =
    session?.access_token

  if (!userToken) {
    throw new Error(
      'Please log in to ShuttleTrack first.'
    )
  }

  const response =
    await fetch(
      GOOGLE_OAUTH_FUNCTION_URL,
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${userToken}`,
          apikey:
            SUPABASE_ANON_KEY,
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify({
          action: 'connect',
          returnTo:
            window.location.href,
        }),
      }
    )

  let result = null

  try {
    result =
      await response.json()
  } catch {
    result = null
  }

  if (!response.ok) {
    throw new Error(
      result?.error ||
        result?.message ||
        'Unable to start Google Calendar connection.'
    )
  }

  const url =
    String(
      result?.url || ''
    ).trim()

  if (!url) {
    throw new Error(
      'Google Calendar authorization URL was not returned.'
    )
  }

  window.location.assign(url)

  return {
    redirecting: true,
  }
}

/*
 * Temporary legacy browser OAuth access.
 * Kept only so your existing Google Calendar create/update/delete code
 * does not break before we replace event syncing with the server-side
 * direct Coach <-> Player sync function.
 */
function requestBrowserGoogleAccess({
  prompt = '',
} = {}) {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(
        new Error(
          'Google login is still loading. Please try again.'
        )
      )
      return
    }

    const clientId =
      process.env.REACT_APP_GOOGLE_CLIENT_ID

    if (!clientId) {
      reject(
        new Error(
          'Google Calendar Client ID is missing.'
        )
      )
      return
    }

    if (!tokenClient) {
      tokenClient =
        window.google.accounts.oauth2.initTokenClient({
          client_id:
            clientId,
          scope:
            GOOGLE_CALENDAR_SCOPE,

          callback:
            response => {
              if (
                response.error
              ) {
                reject(
                  new Error(
                    response.error_description ||
                      response.error
                  )
                )
                return
              }

              accessToken =
                response.access_token ||
                ''

              resolve({
                connected:
                  Boolean(
                    accessToken
                  ),
                accessToken,
              })
            },
        })
    }

    tokenClient.requestAccessToken({
      prompt,
    })
  })
}

export async function ensureGoogleCalendarAccess() {
  if (accessToken) {
    return accessToken
  }

  const result =
    await requestBrowserGoogleAccess({
      prompt: '',
    })

  if (!result?.accessToken) {
    throw new Error(
      'Google Calendar needs to be reconnected.'
    )
  }

  return result.accessToken
}

export function disconnectGoogleCalendar() {
  return new Promise(resolve => {
    if (!accessToken) {
      resolve()
      return
    }

    const tokenToRevoke =
      accessToken

    accessToken = ''

    if (
      !window.google?.accounts
        ?.oauth2?.revoke
    ) {
      resolve()
      return
    }

    window.google.accounts.oauth2.revoke(
      tokenToRevoke,
      () => {
        resolve()
      }
    )
  })
}

export function getGoogleCalendarToken() {
  return accessToken
}

export async function getGoogleAccountEmail() {
  const {
    data: userData,
    error: userError,
  } =
    await supabase.auth.getUser()

  if (userError) {
    throw userError
  }

  const userId =
    userData?.user?.id

  if (!userId) {
    throw new Error(
      'Please log in to ShuttleTrack first.'
    )
  }

  const {
    data: connection,
    error:
      connectionError,
  } = await supabase
    .from(
      'google_calendar_connections'
    )
    .select(
      'google_email'
    )
    .eq(
      'user_id',
      userId
    )
    .maybeSingle()

  if (connectionError) {
    throw connectionError
  }

  const savedEmail =
    String(
      connection?.google_email ||
        ''
    ).trim()

  if (savedEmail) {
    return savedEmail
  }

  const token =
    await ensureGoogleCalendarAccess()

  const response =
    await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    )

  if (!response.ok) {
    return readGoogleError(
      response,
      'Unable to read Google account email.'
    )
  }

  const data =
    await response.json()

  const email =
    String(
      data?.email || ''
    ).trim()

  if (!email) {
    throw new Error(
      'Google account email was not returned.'
    )
  }

  return email
}


export async function syncShuttleTrackGoogleCalendar({
  action = 'upsert',
  sourceType,
  sourceId,
}) {
  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY
  ) {
    throw new Error(
      'Supabase environment variables are missing.'
    )
  }

  if (
    !sourceType ||
    !sourceId
  ) {
    throw new Error(
      'Google Calendar sync source is missing.'
    )
  }

  const {
    data,
    error,
  } =
    await supabase.auth.getSession()

  if (error) {
    throw error
  }

  const userToken =
    data?.session?.access_token

  if (!userToken) {
    throw new Error(
      'Please log in to ShuttleTrack first.'
    )
  }

  const response =
    await fetch(
      `${SUPABASE_URL}/functions/v1/google-calendar-sync`,
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${userToken}`,
          apikey:
            SUPABASE_ANON_KEY,
          'Content-Type':
            'application/json',
        },
        body:
          JSON.stringify({
            action,
            sourceType,
            sourceId,
          }),
      }
    )

  let result = null

  try {
    result =
      await response.json()
  } catch {
    result = null
  }

  if (!response.ok) {
    throw new Error(
      result?.error ||
        result?.message ||
        'Unable to sync Google Calendar.'
    )
  }

  return result
}

function addOneHour(
  timeValue
) {
  const raw =
    String(
      timeValue || ''
    ).slice(
      0,
      5
    )

  const match =
    raw.match(
      /^(\d{2}):(\d{2})$/
    )

  if (!match) {
    return '10:00'
  }

  const hour =
    Number(
      match[1]
    )

  const minute =
    Number(
      match[2]
    )

  const total =
    (
      hour * 60 +
      minute +
      60
    ) %
    (
      24 * 60
    )

  return `${String(
    Math.floor(
      total / 60
    )
  ).padStart(
    2,
    '0'
  )}:${String(
    total % 60
  ).padStart(
    2,
    '0'
  )}`
}

function buildGoogleEventBody({
  title,
  date,
  startTime,
  endTime,
  venue,
  description,
  scheduleType,
  attendees = [],
}) {
  const safeStart =
    startTime ||
    '09:00'

  const safeEnd =
    endTime ||
    addOneHour(
      safeStart
    )

  const startDateTime =
    `${date}T${safeStart}:00`

  const endDateTime =
    `${date}T${safeEnd}:00`

  const reminders =
    scheduleType ===
      'Competition' ||
    scheduleType ===
      'Friendly Match'
      ? [
          {
            method:
              'popup',
            minutes:
              24 * 60,
          },
          {
            method:
              'popup',
            minutes:
              120,
          },
        ]
      : [
          {
            method:
              'popup',
            minutes:
              60,
          },
        ]

  const attendeeRows =
    [
      ...new Set(
        (
          attendees ||
          []
        )
          .map(email =>
            String(
              email ||
                ''
            )
              .trim()
              .toLowerCase()
          )
          .filter(
            Boolean
          )
      ),
    ].map(email => ({
      email,
    }))

  return {
    summary:
      title,
    location:
      venue ||
      '',
    description:
      description ||
      'Created from ShuttleTrack',
    start: {
      dateTime:
        startDateTime,
      timeZone:
        'Asia/Kuala_Lumpur',
    },
    end: {
      dateTime:
        endDateTime,
      timeZone:
        'Asia/Kuala_Lumpur',
    },
    attendees:
      attendeeRows.length >
      0
        ? attendeeRows
        : undefined,
    reminders: {
      useDefault:
        false,
      overrides:
        reminders,
    },
  }
}

async function readGoogleError(
  response,
  fallback
) {
  let data = null

  try {
    data =
      await response.json()
  } catch {
    data = null
  }

  if (
    response.status ===
    401
  ) {
    accessToken = ''
  }

  throw new Error(
    data?.error?.message ||
      fallback
  )
}

export async function createGoogleCalendarEvent(
  {
    title,
    date,
    startTime,
    endTime,
    venue,
    description,
    scheduleType,
    attendees = [],
  }
) {
  const token =
    await ensureGoogleCalendarAccess()

  const body =
    buildGoogleEventBody({
      title,
      date,
      startTime,
      endTime,
      venue,
      description,
      scheduleType,
      attendees,
    })

  const hasAttendees =
    Array.isArray(
      body.attendees
    ) &&
    body.attendees
      .length >
      0

  const url =
    hasAttendees
      ? 'https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all'
      : 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

  const response =
    await fetch(
      url,
      {
        method:
          'POST',
        headers: {
          Authorization:
            `Bearer ${token}`,
          'Content-Type':
            'application/json',
        },
        body:
          JSON.stringify(
            body
          ),
      }
    )

  if (!response.ok) {
    return readGoogleError(
      response,
      'Unable to create Google Calendar event.'
    )
  }

  return response.json()
}

export async function updateGoogleCalendarEvent({
  eventId,
  title,
  date,
  startTime,
  endTime,
  venue,
  description,
  scheduleType,
  attendees = [],
}) {
  if (!eventId) {
    throw new Error(
      'Google Calendar event ID is missing.'
    )
  }

  const token =
    await ensureGoogleCalendarAccess()

  const body =
    buildGoogleEventBody({
      title,
      date,
      startTime,
      endTime,
      venue,
      description,
      scheduleType,
      attendees,
    })

  const hasAttendees =
    Array.isArray(
      body.attendees
    ) &&
    body.attendees
      .length >
      0

  const baseUrl =
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
      eventId
    )}`

  const url =
    hasAttendees
      ? `${baseUrl}?sendUpdates=all`
      : baseUrl

  const response =
    await fetch(
      url,
      {
        method:
          'PATCH',
        headers: {
          Authorization:
            `Bearer ${token}`,
          'Content-Type':
            'application/json',
        },
        body:
          JSON.stringify(
            body
          ),
      }
    )

  if (!response.ok) {
    return readGoogleError(
      response,
      'Unable to update Google Calendar event.'
    )
  }

  return response.json()
}

export async function deleteGoogleCalendarEvent({
  eventId,
}) {
  if (!eventId) {
    return
  }

  const token =
    await ensureGoogleCalendarAccess()

  const response =
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
        eventId
      )}?sendUpdates=all`,
      {
        method:
          'DELETE',
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    )

  if (
    response.status ===
      404 ||
    response.status ===
      410
  ) {
    return
  }

  if (!response.ok) {
    return readGoogleError(
      response,
      'Unable to delete Google Calendar event.'
    )
  }
}