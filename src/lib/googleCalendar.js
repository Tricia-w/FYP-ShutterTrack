const GOOGLE_CALENDAR_SCOPE =
  'https://www.googleapis.com/auth/calendar.events'

let accessToken = ''
let tokenClient = null

export function isGoogleCalendarConnected() {
  return Boolean(accessToken)
}

export function connectGoogleCalendar({
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
          client_id: clientId,
          scope: GOOGLE_CALENDAR_SCOPE,

          callback: response => {
            if (response.error) {
              reject(
                new Error(
                  response.error_description ||
                    response.error
                )
              )
              return
            }

            accessToken =
              response.access_token || ''

            resolve({
              connected:
                Boolean(accessToken),
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
    await connectGoogleCalendar({
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

    if (!window.google?.accounts?.oauth2?.revoke) {
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

function addOneHour(timeValue) {
  const raw =
    String(timeValue || '').slice(
      0,
      5
    )

  const match =
    raw.match(
      /^(\d{2}):(\d{2})$/
    )

  if (!match) return '10:00'

  const hour =
    Number(match[1])

  const minute =
    Number(match[2])

  const total =
    (hour * 60 +
      minute +
      60) %
    (24 * 60)

  return `${String(
    Math.floor(total / 60)
  ).padStart(2, '0')}:${String(
    total % 60
  ).padStart(2, '0')}`
}

function buildGoogleEventBody({
  title,
  date,
  startTime,
  endTime,
  venue,
  description,
  scheduleType,
}) {
  const safeStart =
    startTime || '09:00'

  const safeEnd =
    endTime ||
    addOneHour(safeStart)

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
            method: 'popup',
            minutes:
              24 * 60,
          },
          {
            method: 'popup',
            minutes: 120,
          },
        ]
      : [
          {
            method: 'popup',
            minutes: 60,
          },
        ]

  return {
    summary: title,
    location: venue || '',
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
    reminders: {
      useDefault: false,
      overrides: reminders,
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
    response.status === 401
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
  }
) {
  const token =
    await ensureGoogleCalendarAccess()

  const response =
    await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${token}`,
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify(
          buildGoogleEventBody({
            title,
            date,
            startTime,
            endTime,
            venue,
            description,
            scheduleType,
          })
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
}) {
  if (!eventId) {
    throw new Error(
      'Google Calendar event ID is missing.'
    )
  }

  const token =
    await ensureGoogleCalendarAccess()

  const response =
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
        eventId
      )}`,
      {
        method: 'PATCH',
        headers: {
          Authorization:
            `Bearer ${token}`,
          'Content-Type':
            'application/json',
        },
        body: JSON.stringify(
          buildGoogleEventBody({
            title,
            date,
            startTime,
            endTime,
            venue,
            description,
            scheduleType,
          })
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
  if (!eventId) return

  const token =
    await ensureGoogleCalendarAccess()

  const response =
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
        eventId
      )}`,
      {
        method: 'DELETE',
        headers: {
          Authorization:
            `Bearer ${token}`,
        },
      }
    )

  if (
    response.status === 404 ||
    response.status === 410
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