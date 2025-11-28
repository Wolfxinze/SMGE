import { corsHeaders } from '../_shared/cors.ts'

/**
 * Supabase Edge Function: Process Scheduled Posts
 *
 * This function is triggered by a cron job every minute to process posts
 * that are due for publishing. It delegates to the internal Next.js API
 * which has access to Node.js platform implementations (Twitter, etc.).
 *
 * Cron Schedule: Every minute (see _cron/cron.yaml)
 */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Call internal Next.js API endpoint that has access to Node.js platform implementations
    const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000'
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    console.log('Calling internal API to process scheduled posts...')

    const response = await fetch(`${appUrl}/api/scheduler/process`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API call failed: ${response.status} ${errorText}`)
    }

    const result = await response.json()

    console.log(`Processing completed: ${result.succeeded} succeeded, ${result.failed} failed`)

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('Error processing scheduled posts:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})
