const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type CertificateRequest = {
  file_url?: string
  mime_type?: string
  file_name?: string
}

type CertificateResult = {
  certification_name: string
  issued_by: string
  confidence: number
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      { success: false, error: 'Method not allowed.' },
      405
    )
  }

  try {
    const openAiKey = Deno.env.get('OPENAI_API_KEY')

    if (!openAiKey) {
      return jsonResponse(
        {
          success: false,
          error: 'OPENAI_API_KEY is not configured.',
        },
        500
      )
    }

    const body = (await request.json()) as CertificateRequest
    const fileUrl = String(body.file_url || '').trim()
    const mimeType = String(body.mime_type || '').trim().toLowerCase()
    const fileName = String(body.file_name || '').trim()

    if (!fileUrl) {
      return jsonResponse(
        { success: false, error: 'file_url is required.' },
        400
      )
    }

    const allowedTypes = new Set([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
    ])

    if (!allowedTypes.has(mimeType)) {
      return jsonResponse(
        {
          success: false,
          error: 'Unsupported certificate file type.',
        },
        400
      )
    }

    const fileContent =
      mimeType === 'application/pdf'
        ? {
            type: 'input_file',
            file_url: fileUrl,
          }
        : {
            type: 'input_image',
            image_url: fileUrl,
            detail: 'high',
          }

    const openAiResponse = await fetch(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: [
                    'Read this coaching certificate.',
                    'Extract only:',
                    '1. The certificate or qualification name.',
                    '2. The organisation that issued it.',
                    '',
                    'Do not treat the recipient or coach name as the issuer.',
                    'Do not invent missing information.',
                    'Use an empty string when a field is not visible.',
                    'Confidence must be between 0 and 1.',
                    fileName
                      ? `The uploaded filename is: ${fileName}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join('\n'),
                },
                fileContent,
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'certificate_details',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  certification_name: {
                    type: 'string',
                  },
                  issued_by: {
                    type: 'string',
                  },
                  confidence: {
                    type: 'number',
                    minimum: 0,
                    maximum: 1,
                  },
                },
                required: [
                  'certification_name',
                  'issued_by',
                  'confidence',
                ],
              },
            },
          },
        }),
      }
    )

    const openAiData = await openAiResponse.json()

    if (!openAiResponse.ok) {
      console.error('OpenAI certificate read error:', openAiData)

      return jsonResponse(
        {
          success: false,
          error:
            openAiData?.error?.message ||
            'The certificate reading service failed.',
        },
        openAiResponse.status
      )
    }

    const outputText = getOutputText(openAiData)

    if (!outputText) {
      return jsonResponse(
        {
          success: false,
          error: 'No certificate details were returned.',
        },
        422
      )
    }

    let parsed: CertificateResult

    try {
      parsed = JSON.parse(outputText) as CertificateResult
    } catch {
      console.error('Invalid structured output:', outputText)

      return jsonResponse(
        {
          success: false,
          error: 'The certificate response could not be parsed.',
        },
        422
      )
    }

    return jsonResponse({
      success: true,
      certification_name: cleanText(parsed.certification_name),
      issued_by: cleanText(parsed.issued_by),
      confidence: clampConfidence(parsed.confidence),
    })
  } catch (error) {
    console.error('read-coach-certificate error:', error)

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to read certificate.',
      },
      500
    )
  }
})

function getOutputText(data: unknown): string {
  if (!data || typeof data !== 'object') {
    return ''
  }

  const response = data as {
    output_text?: unknown
    output?: Array<{
      content?: Array<{
        type?: unknown
        text?: unknown
      }>
    }>
  }

  if (typeof response.output_text === 'string') {
    return response.output_text.trim()
  }

  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (
        content.type === 'output_text' &&
        typeof content.text === 'string'
      ) {
        return content.text.trim()
      }
    }
  }

  return ''
}

function cleanText(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

function clampConfidence(value: unknown): number {
  const number = Number(value)

  if (!Number.isFinite(number)) return 0

  return Math.max(0, Math.min(1, number))
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}