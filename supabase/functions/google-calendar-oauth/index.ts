import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!
const APP_URL = Deno.env.get('APP_URL')!

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-oauth`
const SCOPE = 'openid email https://www.googleapis.com/auth/calendar.events'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const admin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
)

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function getUserId(req: Request) {
  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    throw new Error('Missing authorization header')
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: SUPABASE_ANON_KEY,
    },
  })

  if (!response.ok) {
    throw new Error('Invalid or expired ShuttleTrack session.')
  }

  const user = await response.json()
  const userId = String(user?.id || '').trim()

  if (!userId) {
    throw new Error('Unable to identify the signed-in user.')
  }

  return userId
}

function safeReturnTo(value: string | null) {
  const allowed = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ])

  try {
    allowed.add(new URL(APP_URL).origin)
  } catch {
    // Keep localhost origins and fall back to APP_URL later.
  }

  try {
    const parsed = new URL(value || APP_URL)

    if (allowed.has(parsed.origin)) {
      return parsed.toString()
    }
  } catch {
    // Invalid return URL; use APP_URL below.
  }

  return APP_URL
}

function addResultParam(
  returnTo: string,
  value: string
) {
  try {
    const url = new URL(returnTo)
    url.searchParams.set('googleCalendar', value)
    return url.toString()
  } catch {
    return returnTo
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const googleError = url.searchParams.get('error')

    if (!state) {
      return new Response('Missing OAuth state.', {
        status: 400,
      })
    }

    const { data: stateRow, error: stateError } =
      await admin
        .from('google_calendar_oauth_states')
        .select('state, user_id, expires_at, return_to')
        .eq('state', state)
        .maybeSingle()

    if (stateError || !stateRow) {
      return new Response('Invalid OAuth state.', {
        status: 400,
      })
    }

    await admin
      .from('google_calendar_oauth_states')
      .delete()
      .eq('state', state)

    const returnTo = safeReturnTo(
      stateRow.return_to || APP_URL
    )

    if (
      new Date(stateRow.expires_at).getTime() <
      Date.now()
    ) {
      return Response.redirect(
        addResultParam(returnTo, 'expired'),
        302
      )
    }

    if (googleError) {
      return Response.redirect(
        addResultParam(returnTo, googleError),
        302
      )
    }

    if (!code) {
      return Response.redirect(
        addResultParam(returnTo, 'missing_code'),
        302
      )
    }

    try {
      const tokenResponse = await fetch(
        'https://oauth2.googleapis.com/token',
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
          }).toString(),
        }
      )

      const tokenData = await tokenResponse.json()

      if (!tokenResponse.ok) {
        throw new Error(
          tokenData?.error_description ||
            tokenData?.error ||
            'Unable to exchange Google OAuth code.'
        )
      }

      const accessToken =
        String(tokenData?.access_token || '').trim()

      if (!accessToken) {
        throw new Error(
          'Google did not return an access token.'
        )
      }

      const userInfoResponse = await fetch(
        'https://openidconnect.googleapis.com/v1/userinfo',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      const userInfo = await userInfoResponse.json()

      if (!userInfoResponse.ok) {
        throw new Error(
          'Unable to read Google account information.'
        )
      }

      const googleEmail =
        String(userInfo?.email || '').trim()

      const { data: oldCredential } =
        await admin
          .from('google_calendar_credentials')
          .select('refresh_token')
          .eq('user_id', stateRow.user_id)
          .maybeSingle()

      const refreshToken =
        String(
          tokenData?.refresh_token ||
            oldCredential?.refresh_token ||
            ''
        ).trim()

      if (!refreshToken) {
        throw new Error(
          'Google did not return a refresh token.'
        )
      }

      const now = new Date().toISOString()

      const { error: credentialError } =
        await admin
          .from('google_calendar_credentials')
          .upsert(
            {
              user_id: stateRow.user_id,
              google_email: googleEmail || null,
              refresh_token: refreshToken,
              connected_at: now,
              updated_at: now,
              revoked_at: null,
            },
            {
              onConflict: 'user_id',
            }
          )

      if (credentialError) {
        throw credentialError
      }

      const { error: connectionError } =
        await admin
          .from('google_calendar_connections')
          .upsert(
            {
              user_id: stateRow.user_id,
              enabled: true,
              google_email: googleEmail || null,
              connected_at: now,
              updated_at: now,
            },
            {
              onConflict: 'user_id',
            }
          )

      if (connectionError) {
        throw connectionError
      }

      return Response.redirect(
        addResultParam(returnTo, 'connected'),
        302
      )
    } catch (error) {
      console.error(
        'Google Calendar OAuth callback error:',
        error
      )

      return Response.redirect(
        addResultParam(returnTo, 'error'),
        302
      )
    }
  }

  if (req.method !== 'POST') {
    return json(
      {
        error: 'Method not allowed.',
      },
      405
    )
  }

  try {
    const userId = await getUserId(req)

    let body: {
      action?: string
      returnTo?: string
    } = {}

    try {
      body = await req.json()
    } catch {
      // Empty or invalid JSON body; validation below will reject it.
    }

    if (body.action !== 'connect') {
      return json(
        {
          error: 'Invalid action.',
        },
        400
      )
    }

    const state = crypto.randomUUID()
    const returnTo = safeReturnTo(
      String(body.returnTo || APP_URL)
    )

    const now = new Date()
    const expiresAt = new Date(
      now.getTime() + 10 * 60 * 1000
    )

    const { error: stateError } =
      await admin
        .from('google_calendar_oauth_states')
        .insert({
          state,
          user_id: userId,
          created_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          return_to: returnTo,
        })

    if (stateError) {
      throw stateError
    }

    const googleUrl = new URL(
      'https://accounts.google.com/o/oauth2/v2/auth'
    )

    googleUrl.searchParams.set(
      'client_id',
      GOOGLE_CLIENT_ID
    )

    googleUrl.searchParams.set(
      'redirect_uri',
      REDIRECT_URI
    )

    googleUrl.searchParams.set(
      'response_type',
      'code'
    )

    googleUrl.searchParams.set(
      'scope',
      SCOPE
    )

    googleUrl.searchParams.set(
      'access_type',
      'offline'
    )

    googleUrl.searchParams.set(
      'include_granted_scopes',
      'true'
    )

    googleUrl.searchParams.set(
      'prompt',
      'consent select_account'
    )

    googleUrl.searchParams.set(
      'state',
      state
    )

    return json({
      url: googleUrl.toString(),
    })
  } catch (error) {
    console.error(
      'Google Calendar OAuth start error:',
      error
    )

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to start Google Calendar connection.',
      },
      500
    )
  }
})