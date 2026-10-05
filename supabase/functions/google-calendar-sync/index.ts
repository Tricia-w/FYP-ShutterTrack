import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL =
  Deno.env.get('SUPABASE_URL')!

const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY')!

const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const GOOGLE_CLIENT_ID =
  Deno.env.get('GOOGLE_CLIENT_ID')!

const GOOGLE_CLIENT_SECRET =
  Deno.env.get('GOOGLE_CLIENT_SECRET')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
}

type SyncAction =
  | 'upsert'
  | 'delete'

type SourceType =
  | 'coach_session'
  | 'player_schedule'

type SyncRequest = {
  action?: SyncAction
  sourceType?: SourceType
  sourceId?: string
}

type GoogleCredential = {
  user_id: string
  refresh_token: string
  revoked_at: string | null
}

type ExistingLink = {
  owner_user_id: string
  google_event_id: string
}

type GoogleTokenResult = {
  access_token?: string
  error?: string
  error_description?: string
}

type GoogleEventResult = {
  id?: string
  error?: {
    message?: string
  }
}

function json(
  data: unknown,
  status = 200
) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type':
          'application/json',
      },
    }
  )
}

async function getAuthenticatedUserId(
  req: Request
) {
  const authHeader =
    req.headers.get('Authorization')

  if (!authHeader) {
    throw new Error(
      'Missing Authorization header.'
    )
  }

  const response =
    await fetch(
      `${SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          Authorization:
            authHeader,
          apikey:
            SUPABASE_ANON_KEY,
        },
      }
    )

  if (!response.ok) {
    throw new Error(
      'Invalid or expired ShuttleTrack session.'
    )
  }

  const user =
    await response.json()

  const userId =
    String(
      user?.id || ''
    ).trim()

  if (!userId) {
    throw new Error(
      'Unable to identify the signed-in user.'
    )
  }

  return userId
}

function addOneHour(
  timeValue: string | null
) {
  const raw =
    String(
      timeValue || ''
    ).slice(0, 5)

  const match =
    raw.match(
      /^(\d{2}):(\d{2})$/
    )

  if (!match) {
    return '10:00'
  }

  const hour =
    Number(match[1])

  const minute =
    Number(match[2])

  const total =
    (
      hour * 60 +
      minute +
      60
    ) %
    (24 * 60)

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

function decodePlayerScheduleNotes(
  value: string | null
) {
  const prefix =
    '__SHUTTLETRACK_TRAINING__:'

  const raw =
    String(value || '')

  if (
    !raw.startsWith(prefix)
  ) {
    return {
      notes: raw,
      endTime: '',
    }
  }

  try {
    const parsed =
      JSON.parse(
        raw.slice(
          prefix.length
        )
      )

    return {
      notes:
        String(
          parsed?.notes || ''
        ),
      endTime:
        String(
          parsed?.endTime || ''
        ),
    }
  } catch {
    return {
      notes: raw,
      endTime: '',
    }
  }
}

function buildEventBody({
  title,
  date,
  startTime,
  endTime,
  venue,
  description,
}: {
  title: string
  date: string
  startTime: string | null
  endTime: string | null
  venue: string | null
  description: string
}) {
  const safeStart =
    String(
      startTime || '09:00'
    ).slice(0, 5)

  const safeEnd =
    String(
      endTime ||
        addOneHour(
          safeStart
        )
    ).slice(0, 5)

  return {
    summary:
      title,
    location:
      venue || '',
    description,
    start: {
      dateTime:
        `${date}T${safeStart}:00`,
      timeZone:
        'Asia/Kuala_Lumpur',
    },
    end: {
      dateTime:
        `${date}T${safeEnd}:00`,
      timeZone:
        'Asia/Kuala_Lumpur',
    },
    reminders: {
      useDefault:
        false,
      overrides: [
        {
          method:
            'popup',
          minutes:
            60,
        },
      ],
    },
  }
}

async function refreshGoogleAccessToken(
  refreshToken: string
) {
  const body =
    new URLSearchParams({
      client_id:
        GOOGLE_CLIENT_ID,
      client_secret:
        GOOGLE_CLIENT_SECRET,
      refresh_token:
        refreshToken,
      grant_type:
        'refresh_token',
    })

  const response =
    await fetch(
      'https://oauth2.googleapis.com/token',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },
        body:
          body.toString(),
      }
    )

  const data:
    GoogleTokenResult =
      await response.json()

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      data.error_description ||
        data.error ||
        'Unable to refresh Google Calendar access.'
    )
  }

  return data.access_token
}

async function createGoogleEvent(
  accessToken: string,
  body: Record<
    string,
    unknown
  >
) {
  const response =
    await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          'Content-Type':
            'application/json',
        },
        body:
          JSON.stringify(body),
      }
    )

  const data:
    GoogleEventResult =
      await response.json()

  if (
    !response.ok ||
    !data.id
  ) {
    throw new Error(
      data.error?.message ||
        'Unable to create Google Calendar event.'
    )
  }

  return data.id
}

async function updateGoogleEvent(
  accessToken: string,
  eventId: string,
  body: Record<
    string,
    unknown
  >
) {
  const response =
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
        eventId
      )}`,
      {
        method: 'PATCH',
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          'Content-Type':
            'application/json',
        },
        body:
          JSON.stringify(body),
      }
    )

  if (!response.ok) {
    let message =
      'Unable to update Google Calendar event.'

    try {
      const data:
        GoogleEventResult =
          await response.json()

      message =
        data.error?.message ||
        message
    } catch {
      // Keep fallback message.
    }

    throw new Error(message)
  }
}

async function deleteGoogleEvent(
  accessToken: string,
  eventId: string
) {
  const response =
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
        eventId
      )}`,
      {
        method: 'DELETE',
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
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
    throw new Error(
      'Unable to delete Google Calendar event.'
    )
  }
}

Deno.serve(
  async (req: Request) => {
    if (
      req.method === 'OPTIONS'
    ) {
      return new Response(
        'ok',
        {
          headers:
            corsHeaders,
        }
      )
    }

    if (
      req.method !== 'POST'
    ) {
      return json(
        {
          error:
            'Method not allowed.',
        },
        405
      )
    }

    const admin =
      createClient(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY
      )

    try {
      const callerUserId =
        await getAuthenticatedUserId(
          req
        )

      let body:
        SyncRequest = {}

      try {
        body =
          await req.json()
      } catch {
        body = {}
      }

      const action =
        body.action

      const sourceType =
        body.sourceType

      const sourceId =
        String(
          body.sourceId || ''
        ).trim()

      if (
        !action ||
        ![
          'upsert',
          'delete',
        ].includes(
          action
        )
      ) {
        return json(
          {
            error:
              'Invalid sync action.',
          },
          400
        )
      }

      if (
        !sourceType ||
        ![
          'coach_session',
          'player_schedule',
        ].includes(
          sourceType
        )
      ) {
        return json(
          {
            error:
              'Invalid source type.',
          },
          400
        )
      }

      if (!sourceId) {
        return json(
          {
            error:
              'Source ID is required.',
          },
          400
        )
      }

      let targetUserIds:
        string[] = []

      let eventBody:
        Record<
          string,
          unknown
        > | null = null

      if (
        sourceType ===
        'coach_session'
      ) {
        const {
          data: session,
          error:
            sessionError,
        } =
          await admin
            .from(
              'coach_training_sessions'
            )
            .select(
              'id, coach_user_id, session_date, start_time, end_time, venue, session_type, group_notes'
            )
            .eq(
              'id',
              sourceId
            )
            .maybeSingle()

        if (
          sessionError
        ) {
          throw sessionError
        }

        if (!session) {
          return json(
            {
              error:
                'Coach session was not found.',
            },
            404
          )
        }

        if (
          String(
            session.coach_user_id
          ) !==
          callerUserId
        ) {
          return json(
            {
              error:
                'You are not allowed to sync this coach session.',
            },
            403
          )
        }

        const {
          data:
            assignments,
          error:
            assignmentError,
        } =
          await admin
            .from(
              'coach_training_session_players'
            )
            .select(
              'player_user_id'
            )
            .eq(
              'session_id',
              sourceId
            )

        if (
          assignmentError
        ) {
          throw assignmentError
        }

        targetUserIds =
          [
            String(
              session.coach_user_id
            ),
            ...(
              assignments ||
              []
            )
              .map(
                (row: {
                  player_user_id:
                    string | null
                }) =>
                  String(
                    row.player_user_id ||
                      ''
                  )
              )
              .filter(
                Boolean
              ),
          ]

        eventBody =
          buildEventBody({
            title:
              String(
                session.session_type ||
                  'Training Session'
              ),
            date:
              String(
                session.session_date
              ),
            startTime:
              session.start_time,
            endTime:
              session.end_time,
            venue:
              session.venue,
            description:
              [
                'ShuttleTrack coach session',
                session.group_notes ||
                  '',
              ]
                .filter(
                  Boolean
                )
                .join(
                  '\n\n'
                ),
          })
      }

      if (
        sourceType ===
        'player_schedule'
      ) {
        const {
          data: schedule,
          error:
            scheduleError,
        } =
          await admin
            .from(
              'player_schedule'
            )
            .select(
              'id, user_id, event_date, event_time, title, location, schedule_type, tagged_coach_user_id, notes'
            )
            .eq(
              'id',
              sourceId
            )
            .maybeSingle()

        if (
          scheduleError
        ) {
          throw scheduleError
        }

        if (!schedule) {
          return json(
            {
              error:
                'Player schedule was not found.',
            },
            404
          )
        }

        if (
          String(
            schedule.user_id
          ) !==
          callerUserId
        ) {
          return json(
            {
              error:
                'You are not allowed to sync this player schedule.',
            },
            403
          )
        }

        const playerNotes =
          decodePlayerScheduleNotes(
            schedule.notes
          )

        targetUserIds = [
          String(
            schedule.user_id
          ),
        ]

        const taggedCoachId =
          String(
            schedule.tagged_coach_user_id ||
              ''
          ).trim()

        if (
          taggedCoachId
        ) {
          const {
            data:
              relationship,
            error:
              relationshipError,
          } =
            await admin
              .from(
                'coach_player_relationships'
              )
              .select(
                'status'
              )
              .eq(
                'player_user_id',
                schedule.user_id
              )
              .eq(
                'coach_user_id',
                taggedCoachId
              )
              .maybeSingle()

          if (
            relationshipError
          ) {
            throw relationshipError
          }

          const status =
            String(
              relationship?.status ||
                ''
            ).toLowerCase()

          if (
            [
              'accepted',
              'active',
              'connected',
            ].includes(
              status
            )
          ) {
            targetUserIds.push(
              taggedCoachId
            )
          }
        }

        eventBody =
          buildEventBody({
            title:
              String(
                schedule.title ||
                  schedule.schedule_type ||
                  'ShuttleTrack Schedule'
              ),
            date:
              String(
                schedule.event_date
              ),
            startTime:
              schedule.event_time,
            endTime:
              playerNotes.endTime ||
              null,
            venue:
              schedule.location,
            description:
              [
                `ShuttleTrack ${String(
                  schedule.schedule_type ||
                    'schedule'
                )}`,
                playerNotes.notes,
              ]
                .filter(
                  Boolean
                )
                .join(
                  '\n\n'
                ),
          })
      }

      targetUserIds =
        [
          ...new Set(
            targetUserIds
          ),
        ]

      const {
        data:
          existingLinksData,
        error:
          existingLinksError,
      } =
        await admin
          .from(
            'google_calendar_event_links'
          )
          .select(
            'owner_user_id, google_event_id'
          )
          .eq(
            'source_type',
            sourceType
          )
          .eq(
            'source_id',
            sourceId
          )

      if (
        existingLinksError
      ) {
        throw existingLinksError
      }

      const existingLinks =
        (
          existingLinksData ||
          []
        ) as ExistingLink[]

      const existingLinkMap =
        new Map(
          existingLinks.map(
            link => [
              String(
                link.owner_user_id
              ),
              String(
                link.google_event_id
              ),
            ]
          )
        )

      const credentialUserIds =
        [
          ...new Set([
            ...targetUserIds,
            ...existingLinks.map(
              link =>
                String(
                  link.owner_user_id
                )
            ),
          ]),
        ]

      let credentials:
        GoogleCredential[] = []

      if (
        credentialUserIds.length >
        0
      ) {
        const {
          data:
            credentialData,
          error:
            credentialError,
        } =
          await admin
            .from(
              'google_calendar_credentials'
            )
            .select(
              'user_id, refresh_token, revoked_at'
            )
            .in(
              'user_id',
              credentialUserIds
            )
            .is(
              'revoked_at',
              null
            )

        if (
          credentialError
        ) {
          throw credentialError
        }

        credentials =
          (
            credentialData ||
            []
          ) as GoogleCredential[]
      }

      const credentialMap =
        new Map(
          credentials.map(
            credential => [
              String(
                credential.user_id
              ),
              credential,
            ]
          )
        )

      const syncedUsers:
        string[] = []

      const skippedUsers:
        string[] = []

      const removedUsers:
        string[] = []

      const errors:
        {
          userId: string
          message: string
        }[] = []

      if (
        action ===
        'delete'
      ) {
        for (
          const link of
          existingLinks
        ) {
          const ownerUserId =
            String(
              link.owner_user_id
            )

          const credential =
            credentialMap.get(
              ownerUserId
            )

          if (!credential) {
            skippedUsers.push(
              ownerUserId
            )
            continue
          }

          try {
            const googleToken =
              await refreshGoogleAccessToken(
                credential.refresh_token
              )

            await deleteGoogleEvent(
              googleToken,
              link.google_event_id
            )

            await admin
              .from(
                'google_calendar_event_links'
              )
              .delete()
              .eq(
                'owner_user_id',
                ownerUserId
              )
              .eq(
                'source_type',
                sourceType
              )
              .eq(
                'source_id',
                sourceId
              )

            removedUsers.push(
              ownerUserId
            )
          } catch (
            deleteError
          ) {
            errors.push({
              userId:
                ownerUserId,
              message:
                deleteError instanceof
                Error
                  ? deleteError.message
                  : 'Unable to delete Google event.',
            })
          }
        }

        return json({
          ok: true,
          action,
          sourceType,
          sourceId,
          removedUsers,
          skippedUsers,
          errors,
        })
      }

      if (!eventBody) {
        throw new Error(
          'Google Calendar event payload could not be built.'
        )
      }

      /*
       * Remove Google events for users who used to be part of the source
       * but are no longer assigned/tagged.
       */
      for (
        const link of
        existingLinks
      ) {
        const ownerUserId =
          String(
            link.owner_user_id
          )

        if (
          targetUserIds.includes(
            ownerUserId
          )
        ) {
          continue
        }

        const credential =
          credentialMap.get(
            ownerUserId
          )

        if (!credential) {
          skippedUsers.push(
            ownerUserId
          )
          continue
        }

        try {
          const googleToken =
            await refreshGoogleAccessToken(
              credential.refresh_token
            )

          await deleteGoogleEvent(
            googleToken,
            link.google_event_id
          )

          await admin
            .from(
              'google_calendar_event_links'
            )
            .delete()
            .eq(
              'owner_user_id',
              ownerUserId
            )
            .eq(
              'source_type',
              sourceType
            )
            .eq(
              'source_id',
              sourceId
            )

          removedUsers.push(
            ownerUserId
          )
        } catch (
          removeError
        ) {
          errors.push({
            userId:
              ownerUserId,
            message:
              removeError instanceof
              Error
                ? removeError.message
                : 'Unable to remove old Google event.',
          })
        }
      }

      /*
       * Create/update in every currently connected target user's own
       * primary Google Calendar.
       */
      for (
        const ownerUserId of
        targetUserIds
      ) {
        const credential =
          credentialMap.get(
            ownerUserId
          )

        if (!credential) {
          skippedUsers.push(
            ownerUserId
          )
          continue
        }

        try {
          const googleToken =
            await refreshGoogleAccessToken(
              credential.refresh_token
            )

          const existingEventId =
            existingLinkMap.get(
              ownerUserId
            )

          let googleEventId =
            existingEventId ||
            ''

          if (
            existingEventId
          ) {
            try {
              await updateGoogleEvent(
                googleToken,
                existingEventId,
                eventBody
              )
            } catch {
              /*
               * If the event was manually removed from Google Calendar,
               * recreate it and replace the stored event ID.
               */
              googleEventId =
                await createGoogleEvent(
                  googleToken,
                  eventBody
                )
            }
          } else {
            googleEventId =
              await createGoogleEvent(
                googleToken,
                eventBody
              )
          }

          const {
            error:
              linkError,
          } =
            await admin
              .from(
                'google_calendar_event_links'
              )
              .upsert(
                {
                  owner_user_id:
                    ownerUserId,
                  source_type:
                    sourceType,
                  source_id:
                    sourceId,
                  google_event_id:
                    googleEventId,
                  updated_at:
                    new Date()
                      .toISOString(),
                },
                {
                  onConflict:
                    'owner_user_id,source_type,source_id',
                }
              )

          if (linkError) {
            throw linkError
          }

          syncedUsers.push(
            ownerUserId
          )
        } catch (
          syncError
        ) {
          const message =
            syncError instanceof
            Error
              ? syncError.message
              : 'Unable to sync Google Calendar.'

          errors.push({
            userId:
              ownerUserId,
            message,
          })

          /*
           * Most commonly invalid_grant means the user revoked access.
           * Mark the stored connection disabled so later syncs skip it
           * until the user reconnects.
           */
          if (
            message
              .toLowerCase()
              .includes(
                'invalid_grant'
              )
          ) {
            const now =
              new Date()
                .toISOString()

            await admin
              .from(
                'google_calendar_credentials'
              )
              .update({
                revoked_at:
                  now,
                updated_at:
                  now,
              })
              .eq(
                'user_id',
                ownerUserId
              )

            await admin
              .from(
                'google_calendar_connections'
              )
              .update({
                enabled:
                  false,
                updated_at:
                  now,
              })
              .eq(
                'user_id',
                ownerUserId
              )
          }
        }
      }

      return json({
        ok: true,
        action,
        sourceType,
        sourceId,
        syncedUsers,
        skippedUsers,
        removedUsers,
        errors,
      })
    } catch (error) {
      console.error(
        'Google Calendar sync error:',
        error
      )

      return json(
        {
          error:
            error instanceof
            Error
              ? error.message
              : 'Unexpected Google Calendar sync error.',
        },
        500
      )
    }
  }
)